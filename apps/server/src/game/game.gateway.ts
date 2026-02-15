import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    MessageBody,
    ConnectedSocket,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { RoomManager } from "./room.manager";
import { makeRoomCode, nowMs } from "./utils";

import type {
    Room,
    Player,
    ClientToServerEvents,
    ServerToClientEvents,
} from "shared";

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

const GAME_SECONDS = 90;

@WebSocketGateway({
    cors: {
        origin: "http://localhost:3000",
        credentials: true,
    },
})
export class GameGateway {
    @WebSocketServer()
    server!: TypedServer;

    private roomManager = new RoomManager();

    private tickInterval = setInterval(() => {
        for (const room of (this as any).roomManager["rooms"].values() as Iterable<Room>) {
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
            room.status === "playing" && room.endsAt ? Math.max(0, Math.ceil((room.endsAt - nowMs()) / 1000)) : undefined;

        this.server.to(room.code).emit("game:state", {
            roomCode: room.code,
            status: room.status,
            players: room.players.map((p) => ({ id: p.id, name: p.name, score: p.score })),
            timerRemaining,
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
        this.roomManager.updateRoom(room.code, room);

        socket.join(room.code);

        socket.emit("room:joined", { roomCode: room.code, playerId: player.id });

        if (room.players.length === 2 && room.status === "lobby") {
            room.status = "playing";
            room.startedAt = nowMs();
            room.endsAt = room.startedAt + GAME_SECONDS * 1000;
            this.roomManager.updateRoom(room.code, room);
        }

        this.emitState(room);
    }

    handleDisconnect(socket: TypedSocket) {
        for (const room of (this as any).roomManager["rooms"].values() as Iterable<Room>) {
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
}