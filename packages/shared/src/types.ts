export type RoomStatus = "lobby" | "playing" | "ended";

export type Player = {
  id: string;
  name: string;
  socketId: string;
  score: number;
};

export type Room = {
  code: string;
  status: RoomStatus;
  players: Player[];
  secretWord?: string;
  startedAt?: number;
  endsAt?: number;
};

export type LetterState = "correct" | "present" | "absent";
export type GuessFeedback = { letters: LetterState[] };

export type ServerToClientEvents = {
  "room:created": (payload: { roomCode: string; playerId: string }) => void;
  "room:joined": (payload: { roomCode: string; playerId: string }) => void;
  "game:state": (payload: any) => void;
  "game:feedback": (payload: { feedback: GuessFeedback }) => void;
  "game:ended": (payload: { winnerId?: string; reason: "guessed" | "timeout" | "left" }) => void;
  "error": (payload: { message: string }) => void;
};

export type ClientToServerEvents = {
  "room:create": (payload: { name: string }) => void;
  "room:join": (payload: { roomCode: string; name: string }) => void;
  "game:guess": (payload: { roomCode: string; playerId: string; guess: string }) => void;
  "game:rematch": (payload: { roomCode: string; playerId: string }) => void;
  "room:leave": (payload: { roomCode: string; playerId: string }) => void;
};
