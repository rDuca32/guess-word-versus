import type { Room } from "shared";

const WORD_LIST = [
    "apple", "grape", "lemon", "peach", "melon", "berry", "mango", "plumb", "olive", "pearl",
    "beach", "brain", "bread", "brush", "chair", "chest", "chord", "click", "clock", "cloud",
    "dance", "diary", "drink", "earth", "flute", "fruit", "glass", "heart", "house", "juice",
    "light", "money", "music", "night", "ocean", "party", "piano", "pilot", "plane", "phone",
    "pizza", "plant", "radio", "river", "scene", "shirt", "shoes", "smile", "snake", "space",
    "spoon", "storm", "table", "tiger", "toast", "touch", "train", "truck", "voice", "water",
    "watch", "whale", "world", "write", "youth", "zebra", "alarm", "album", "angle", "ankle",
    "apple", "armor", "arrow", "asset", "atlas", "audio", "awful", "bacon", "badge", "baked",
    "basic", "beard", "beast", "below", "bench", "birth", "black", "blade", "blind", "block",
    "blood", "board", "bonus", "boost", "bound", "brain", "brave", "bread", "break", "brick",
    "brief", "bring", "broad", "brown", "build", "built", "buyer", "cabin", "cable", "calm",
    "candy", "cards", "carry", "carve", "catch", "cause", "chain", "chair", "chalk", "charm",
    "chart", "check", "cheek", "chess", "chief", "child", "china", "choir", "chunk", "civil",
    "claim", "class", "clean", "clear", "climb", "clock", "close", "cloth", "cloud", "coach",
    "coast", "count", "court", "cover", "craft", "crash", "cream", "crime", "cross", "crowd",
    "crown", "curve", "cycle", "daily", "dance", "death", "depth", "dirty", "doubt", "dozen",
    "draft", "drain", "drama", "dream", "dress", "drink", "drive", "drone", "early", "earth",
    "eight", "elbow", "empty", "enemy", "enjoy", "enter", "entry", "equal", "error", "event"
];

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

    startGame(room: Room) {
        room.secretWord = this.getRandomWord();
        room.guessesByPlayer = Object.fromEntries(room.players.map(p => [p.id, []]));
        room.winnerId = undefined;
    }

    getRandomWord(): string {
        return WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];
    }
}