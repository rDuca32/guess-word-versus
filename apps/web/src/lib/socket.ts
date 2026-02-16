import { io, Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "shared";

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

export function getSocket() {
    if (socket) return socket;

    const url =
        typeof window !== "undefined"
            ? `${window.location.protocol}//${window.location.hostname}:3001`
            : "http://localhost:3001";

    socket = io(url, {
        transports: ["websocket"],
        withCredentials: true,
    });

    return socket;
}
