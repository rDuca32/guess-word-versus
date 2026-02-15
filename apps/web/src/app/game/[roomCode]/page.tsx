"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { getSocket } from "@/lib/socket";

type GameStatePayload = {
    roomCode: string;
    status: "lobby" | "playing" | "ended";
    players: { id: string; name: string; score: number }[];
    timerRemaining?: number;
};

export default function GameRoom() {
    const params = useParams<{ roomCode: string }>();
    const roomCode = useMemo(() => (params?.roomCode ?? "").toString().toUpperCase(), [params]);

    const [state, setState] = useState<GameStatePayload | null>(null);
    const [ended, setEnded] = useState<string | null>(null);

    useEffect(() => {
        const s = getSocket();
        s.on("game:state", (p: any) => setState(p));
        s.on("game:ended", (p) => setEnded(`Game ended: ${p.reason}`));
        s.on("error", (p) => setEnded(`Error: ${p.message}`));

        return () => {
            s.off("game:state");
            s.off("game:ended");
            s.off("error");
        };
    }, []);

    return (
        <main style={{ maxWidth: 700, margin: "40px auto", padding: 16 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700 }}>Room {roomCode}</h1>

            {!state ? (
                <p>Loading state…</p>
            ) : (
                <>
                    <p>Status: <b>{state.status}</b></p>
                    {typeof state.timerRemaining === "number" && (
                        <p>Timer: <b>{state.timerRemaining}s</b></p>
                    )}

                    <h3 style={{ marginTop: 18 }}>Players</h3>
                    <ul>
                        {state.players.map((p) => (
                            <li key={p.id}>
                                {p.name} — wins: {p.score}
                            </li>
                        ))}
                    </ul>

                    {state.status === "lobby" && <p>Waiting for second player…</p>}
                </>
            )}

            {ended && <p style={{ marginTop: 16, color: "crimson" }}>{ended}</p>}
        </main>
    );
}
