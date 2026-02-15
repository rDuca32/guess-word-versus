import { io, Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "shared";

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

export function getSocket() {
    if (socket) return socket;
    const url = process.env.NEXT_PUBLIC_SERVER_URL!;
    socket = io(url, { transports: ["websocket"] });
    return socket;
}
