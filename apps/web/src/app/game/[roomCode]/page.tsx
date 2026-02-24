"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { getSocket } from "@/lib/socket";

type LetterState = "correct" | "present" | "absent";

type GameStatePayload = {
    roomCode: string;
    status: "lobby" | "playing" | "ended";
    players: { id: string; name: string; score: number }[];
    timerRemaining?: number;
    rematchVotes?: string[];
};

type FeedbackRow = { guess: string; feedback: LetterState[] };

const COLORS: Record<LetterState, string> = {
    correct: "#6aaa64",
    present: "#c9b458",
    absent: "#787c7e",
};

const KEY_ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"].map((r) => r.split(""));

function Keyboard({ usedLetters }: { usedLetters: Set<string> }) {
    return (
        <div style={{ display: "grid", gap: 5, justifyContent: "center", marginTop: 10 }}>
            {KEY_ROWS.map((row, idx) => (
                <div key={idx} style={{ display: "flex", gap: 5, justifyContent: "center" }}>
                    {row.map((k) => {
                        const used = usedLetters.has(k);
                        return (
                            <div
                                key={k}
                                style={{
                                    height: 50,
                                    minWidth: 30,
                                    padding: "10px",
                                    borderRadius: 10,
                                    display: "grid",
                                    placeItems: "center",
                                    fontWeight: 750,
                                    border: "1px solid #222",
                                    background: used ? "#d1d5db" : "#111",
                                    color: used ? "#6b7280" : "white",
                                    userSelect: "none",
                                }}
                            >
                                {k}
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}

export default function GameRoom() {
    const params = useParams<{ roomCode: string }>();
    const roomCode = useMemo(
        () => (params?.roomCode ?? "").toString().toUpperCase(),
        [params],
    );

    const [state, setState] = useState<GameStatePayload | null>(null);
    const [ended, setEnded] = useState<string | null>(null);

    const [guess, setGuess] = useState("");
    const [rows, setRows] = useState<FeedbackRow[]>([]);

    const usedLetters = useMemo(() => {
        const s = new Set<string>();
        for (const r of rows) {
            for (const ch of r.guess.toUpperCase()) {
                if (ch >= "A" && ch <= "Z")
                    s.add(ch);
            }
        }
        return s;
    }, [rows]);

    const prevStatusRef = useRef<GameStatePayload["status"] | null>(null);

    const [playerId, setPlayerId] = useState<string | null>(null);

    const [revealWord, setRevealWord] = useState<string | null>(null);

    useEffect(() => {
        if (typeof window === "undefined") return;
        setPlayerId(sessionStorage.getItem(`playerId:${roomCode}`));
    }, [roomCode]);

    useEffect(() => {
        const s = getSocket();

        const onState = (p: GameStatePayload) => {
            setState(p);

            const prev = prevStatusRef.current;
            prevStatusRef.current = p.status;

            if (p.status === "playing" && prev !== "playing") {
                setEnded(null);
                setRows([]);
                setGuess("");
                setRevealWord(null);
            }

            if (p.status === "ended" && prev === "playing") {
                setEnded((x) => x ?? "Game over");
            }
        };

        const onEnded = (p: { reason: string; secretWord?: string }) => {
            const word = typeof p.secretWord === "string" ? p.secretWord.toUpperCase() : null;
            setRevealWord(word);
            setEnded(`Game ended: ${p.reason}`);
        };

        const onErr = (p: any) => setEnded(`Error: ${p.message}`);

        const onFeedback = (payload: { feedback: { letters: LetterState[]; guess: string } }) => {
            const g = payload.feedback.guess ?? "";
            setRows((prev) => [...prev, { guess: g.toUpperCase(), feedback: payload.feedback.letters }]);

            const isWin = payload.feedback.letters.every((l) => l === "correct");
            if (isWin) {
                setEnded("You guessed the word!");
                setRevealWord(g.toUpperCase());
            }
        };

        s.on("game:state", onState);
        s.on("game:ended", onEnded);
        s.on("error", onErr);
        s.on("game:feedback", onFeedback);

        return () => {
            s.off("game:state", onState);
            s.off("game:ended", onEnded);
            s.off("error", onErr);
            s.off("game:feedback", onFeedback);
        };
    }, []);

    const canPlay = state?.status === "playing" && !ended;
    const attemptsLeft = Math.max(0, 6 - rows.length);

    const handleChange = (value: string) => {
        const cleaned = value.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 5);
        setGuess(cleaned);
    };

    const handleRematch = () => {
        if (!playerId) return;
        getSocket().emit("game:rematch", { roomCode, playerId });
    };

    const hasVotedRematch = state?.rematchVotes?.includes(playerId ?? "");

    const submitGuess = () => {
        if (!canPlay) return;
        if (guess.length !== 5) return;
        if (rows.length >= 6) return;

        if (!playerId) {
            setEnded("Error: missing playerId (go back and re-join from lobby).");
            return;
        }

        getSocket().emit("game:guess", { roomCode, playerId, guess });
        setGuess("");
    };

    const grid: Array<{ guess: string; feedback: LetterState[] | null; isCurrent?: boolean }> = rows.map((r) => ({
        guess: r.guess,
        feedback: r.feedback,
    }));

    if (grid.length < 6 && !ended) {
        grid.push({ guess, feedback: null, isCurrent: true });
    }
    while (grid.length < 6 && !ended) {
        grid.push({ guess: "", feedback: null });
    }

    return (
        <main style={{ maxWidth: 700, margin: "30px auto", padding: 15 }}>
            <header style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <h1 style={{ fontSize: 25, fontWeight: 750 }}>Room {roomCode}</h1>
                <div style={{ textAlign: "right", fontSize: 15, opacity: 0.75 }}>
                    <div>Status: <b>{state?.status ?? "loading"}</b></div>
                    {typeof state?.timerRemaining === "number" && (
                        <div>Timer: <b>{state.timerRemaining}s</b></div>
                    )}
                </div>
            </header>

            <section style={{ marginTop: 15 }}>
                <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                    {state?.players?.map((p) => (
                        <div
                            key={p.id}
                            style={{
                                border: "1px solid #ddd",
                                borderRadius: 10,
                                padding: "5px 10px",
                                fontSize: 15,
                            }}
                        >
                            <b>{p.name}</b> · wins {p.score}
                        </div>
                    ))}
                </div>
                {state?.status === "lobby" && <p style={{ marginTop: 10, opacity: 0.75 }}>Waiting for second player…</p>}
            </section>

            <section style={{ marginTop: 25, display: "grid", gap: 7, justifyContent: "center" }}>
                {grid.map((r, rowIdx) => (
                    <div key={rowIdx} style={{ display: "grid", gridTemplateColumns: "repeat(5, 50px)", gap: 7 }}>
                        {Array.from({ length: 5 }).map((_, colIdx) => {
                            const letter = (r.guess[colIdx] ?? "").toUpperCase();
                            const cellState = r.feedback ? r.feedback[colIdx] : null;

                            return (
                                <div
                                    key={colIdx}
                                    style={{
                                        width: 50,
                                        height: 50,
                                        border: "3px solid #d3d6da",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: 20,
                                        fontWeight: 750,
                                        background: cellState ? COLORS[cellState] : "white",
                                        color: cellState ? "white" : "#111",
                                        borderColor: cellState ? COLORS[cellState] : (r.isCurrent && canPlay ? "#999" : "#d3d6da"),
                                        userSelect: "none",
                                    }}
                                >
                                    {letter}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </section>

            <section style={{ marginTop: 20, display: "flex", justifyContent: "center" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <input
                        value={guess}
                        onChange={(e) => handleChange(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                submitGuess();
                            }
                        }}
                        disabled={!canPlay || rows.length >= 6}
                        placeholder={canPlay ? "Type 5 letters" : "Waiting…"}
                        style={{
                            width: 220,
                            padding: "10px 15px",
                            borderRadius: 10,
                            border: "1px solid #ddd",
                            fontSize: 15,
                            letterSpacing: 2,
                            textTransform: "uppercase",
                        }}
                    />
                    <button
                        onClick={submitGuess}
                        disabled={!canPlay || guess.length !== 5 || rows.length >= 6}
                        style={{
                            padding: "10px 15px",
                            borderRadius: 10,
                            border: "1px solid #ddd",
                            fontWeight: 750,
                        }}
                    >
                        Guess
                    </button>
                </div>
            </section>

            <Keyboard usedLetters={usedLetters} />

            <section style={{ marginTop: 15, textAlign: "center", opacity: 0.75, fontSize: 15 }}>
                Attempts left: <b>{attemptsLeft}</b>
            </section>

            {ended && <p style={{ marginTop: 15, color: "crimson", textAlign: "center" }}>{ended}</p>}

            {state?.status === "ended" && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(0,0,0,0.55)",
                        display: "grid",
                        placeItems: "center",
                        zIndex: 100,
                        padding: 15,
                    }}
                >
                    <div
                        style={{
                            width: "min(420px, 100%)",
                            background: "#1f1f1f",
                            color: "white",
                            borderRadius: 15,
                            padding: 20,
                            boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                            <h2 style={{ fontSize: 25, fontWeight: 750, margin: 0 }}>Game Over</h2>
                            <div style={{ fontSize: 13, opacity: 0.7 }}>
                                Ready: <b>{state?.rematchVotes?.length ?? 0}</b>/2
                            </div>
                        </div>

                        <div style={{ marginTop: 10, marginBottom: 15, opacity: 0.75 }}>
                            {ended ?? "Game ended."}
                            {revealWord && (
                                <p style={{ marginTop: 10, marginBottom: 5, opacity: 1 }}>
                                    The word was: <b style={{ letterSpacing: 2 }}>{revealWord}</b>
                                </p>
                            )}
                        </div>

                        <div
                            style={{
                                display: "flex",
                                gap: 10,
                                alignItems: "center",
                                justifyContent: "space-between",
                                marginTop: 10,
                            }}
                        >
                            <button
                                onClick={handleRematch}
                                disabled={hasVotedRematch}
                                style={{
                                    flex: 1,
                                    padding: "13px 15px",
                                    borderRadius: 10,
                                    border: "1px solid #666",
                                    background: hasVotedRematch ? "#666" : "#111",
                                    color: hasVotedRematch ? "#666" : "white",
                                    fontWeight: 800,
                                    cursor: hasVotedRematch ? "default" : "pointer",
                                }}
                            >
                                {hasVotedRematch ? "Waiting for opponent…" : "Rematch"}
                            </button>

                            <div style={{ fontSize: 13, opacity: 0.75, textAlign: "right", minWidth: 100 }}>
                                {hasVotedRematch ? "You are ready " : "Click to vote"}
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </main>
    );
}