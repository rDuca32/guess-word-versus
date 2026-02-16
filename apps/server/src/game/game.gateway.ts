import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    MessageBody,
    ConnectedSocket,
    OnGatewayDisconnect,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { RoomManager } from "./room.manager";
import { makeRoomCode, nowMs } from "./utils";

import type { Room, Player, ClientToServerEvents, ServerToClientEvents } from "shared";
import type { LetterState } from "shared";
import { wordleFeedback } from "./wordle-feedback";

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

const GAME_SECONDS = 90;

@WebSocketGateway({
    cors: { origin: true, credentials: true },
})
export class GameGateway implements OnGatewayDisconnect {
    @WebSocketServer()
    server!: TypedServer;

    private roomManager = new RoomManager();

    private tickInterval = setInterval(() => {
        const rooms: Iterable<Room> = (this as any).roomManager?.rooms?.values?.() ?? [];
        for (const room of rooms) {
            if (room.status !== "playing" || !room.endsAt) continue;

            const remainingMs = room.endsAt - nowMs();
            if (remainingMs <= 0) {
                room.status = "ended";
                this.roomManager.updateRoom(room.code, room);
                this.server.to(room.code).emit("game:ended", { reason: "timeout" });
                this.emitState(room);
            } else {
                this.emitState(room);
            }
        }
    }, 1000);

    private emitState(room: Room) {
        const timerRemaining =
            room.status === "playing" && room.endsAt
                ? Math.max(0, Math.ceil((room.endsAt - nowMs()) / 1000))
                : undefined;

        this.server.to(room.code).emit("game:state", {
            roomCode: room.code,
            status: room.status,
            players: room.players.map((p) => ({ id: p.id, name: p.name, score: p.score })),
            timerRemaining,
            rematchVotes: room.rematchVotes ?? [],
        });
    }

    @SubscribeMessage("room:create")
    handleCreate(@MessageBody() body: { name: string }, @ConnectedSocket() socket: TypedSocket) {
        const name = (body?.name ?? "").trim().slice(0, 20);
        if (!name) return socket.emit("error", { message: "Name is required." });

        let code = makeRoomCode();
        while (this.roomManager.getRoom(code)) code = makeRoomCode();

        const player: Player = {
            id: crypto.randomUUID(),
            name,
            socketId: socket.id,
            score: 0,
        };

        const room: Room = {
            code,
            status: "lobby",
            players: [player],
            guessesByPlayer: {},
            rematchVotes: [],
        };

        this.roomManager.createRoom(room);
        socket.join(code);

        socket.emit("room:created", { roomCode: code, playerId: player.id });
        this.emitState(room);
    }

    @SubscribeMessage("room:join")
    handleJoin(@MessageBody() body: { roomCode: string; name: string }, @ConnectedSocket() socket: TypedSocket) {
        const roomCode = (body?.roomCode ?? "").trim().toUpperCase();
        const name = (body?.name ?? "").trim().slice(0, 20);

        if (!roomCode) return socket.emit("error", { message: "Room code is required." });
        if (!name) return socket.emit("error", { message: "Name is required." });

        const room = this.roomManager.getRoom(roomCode);
        if (!room) return socket.emit("error", { message: "Room not found." });
        if (room.players.length >= 2) return socket.emit("error", { message: "Room is full." });

        const player: Player = {
            id: crypto.randomUUID(),
            name,
            socketId: socket.id,
            score: 0,
        };

        room.players.push(player);
        room.guessesByPlayer ??= {};
        room.rematchVotes = [];
        this.roomManager.updateRoom(room.code, room);

        socket.join(room.code);
        socket.emit("room:joined", { roomCode: room.code, playerId: player.id });

        if (room.players.length === 2 && room.status === "lobby") {
            if (typeof (this.roomManager as any).startGame === "function") {
                (this.roomManager as any).startGame(room);
            } else {
                room.secretWord = room.secretWord || "apple";
                room.guessesByPlayer = { [room.players[0].id]: [], [room.players[1].id]: [] };
            }

            room.status = "playing";
            room.startedAt = nowMs();
            room.endsAt = room.startedAt + GAME_SECONDS * 1000;
            this.roomManager.updateRoom(room.code, room);
        }

        this.emitState(room);
    }

    handleDisconnect(socket: TypedSocket) {
        const rooms: Iterable<Room> = (this as any).roomManager?.rooms?.values?.() ?? [];
        for (const room of rooms) {
            const idx = room.players.findIndex((p) => p.socketId === socket.id);
            if (idx === -1) continue;

            room.players.splice(idx, 1);

            if (room.status === "playing") {
                room.status = "ended";
                this.roomManager.updateRoom(room.code, room);
                this.server.to(room.code).emit("game:ended", { reason: "left" });
            }

            if (room.players.length === 0) this.roomManager.deleteRoom(room.code);
            else this.roomManager.updateRoom(room.code, room);

            this.emitState(room);
            break;
        }
    }

    @SubscribeMessage("game:guess")
    handleGuess(
        @MessageBody() data: { roomCode: string; playerId: string; guess: string },
        @ConnectedSocket() client: TypedSocket
    ) {
        const roomCode = (data?.roomCode ?? "").trim().toUpperCase();
        const playerId = (data?.playerId ?? "").trim();
        const guess = (data?.guess ?? "").trim().toUpperCase();

        const room = this.roomManager.getRoom(roomCode);
        if (!room) return client.emit("error", { message: "Room not found." });

        if (!room.players.some((p) => p.id === playerId))
            return client.emit("error", { message: "Player not in room." });

        if (room.status !== "playing")
            return client.emit("error", { message: "Game is not playing." });

        if (!/^[A-Za-z]{5}$/.test(guess))
            return client.emit("error", { message: "Guess must be exactly 5 letters (A-Z)." });

        room.guessesByPlayer ??= {};
        const tries = room.guessesByPlayer[playerId] ?? [];
        if (tries.length >= 6)
            return client.emit("error", { message: "No attempts left." });

        if (!room.secretWord)
            return client.emit("error", { message: "Server error: secret word missing." });

        const letters: LetterState[] = wordleFeedback(room.secretWord.toUpperCase(), guess);

        room.guessesByPlayer[playerId] = [...tries, guess];
        this.roomManager.updateRoom(room.code, room);

        client.emit("game:feedback", { feedback: { letters, guess } });

        const isCorrect = letters.every((x) => x === "correct");
        if (isCorrect) {
            room.winnerId = playerId;

            const winner = room.players.find(p => p.id === playerId);
            if (winner) {
                winner.score += 1;
            }

            room.status = "ended";
            this.roomManager.updateRoom(room.code, room);
            this.server.to(room.code).emit("game:ended", { reason: "guessed", winnerId: playerId });
        }
        this.emitState(room);
    }

    @SubscribeMessage("game:rematch")
    handleRematch(
        @MessageBody() data: { roomCode: string; playerId: string },
        @ConnectedSocket() client: TypedSocket
    ) {
        const roomCode = (data?.roomCode ?? "").trim().toUpperCase();
        const room = this.roomManager.getRoom(roomCode);

        if (!room) return client.emit("error", { message: "Room not found." });
        if (room.status !== "ended") return;

        room.rematchVotes ??= [];
        if (!room.rematchVotes.includes(data.playerId)) {
            room.rematchVotes.push(data.playerId);
        }

        if (room.players.length === 2 && room.rematchVotes.length >= 2) {
            this.roomManager.startGame(room);
            room.status = "playing";
            room.startedAt = nowMs();
            room.endsAt = room.startedAt + GAME_SECONDS * 1000;
            room.rematchVotes = [];
        }

        this.roomManager.updateRoom(room.code, room);
        this.emitState(room);
    }
}
