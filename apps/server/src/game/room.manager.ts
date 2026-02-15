import type { Room } from "shared";

export class RoomManager {
    private rooms = new Map<string, Room>();

    createRoom(room: Room) {
        this.rooms.set(room.code, room);
        return room;
    }

    getRoom(code: string) {
        return this.rooms.get(code);
    }

    updateRoom(code: string, room: Room) {
        this.rooms.set(code, room);
    }

    deleteRoom(code: string) {
        this.rooms.delete(code);
    }
}