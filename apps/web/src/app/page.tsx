"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const s = getSocket();

    s.on("error", (p) => setErr(p.message));

    s.on("room:created", ({ roomCode, playerId }) => {
      localStorage.setItem("playerId", playerId);
      router.push(`/game/${roomCode}`);
    });

    s.on("room:joined", ({ roomCode, playerId }) => {
      localStorage.setItem("playerId", playerId);
      router.push(`/game/${roomCode}`);
    });

    return () => {
      s.off("error");
      s.off("room:created");
      s.off("room:joined");
    };
  }, [router]);

  return (
    <main style={{ maxWidth: 520, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>Guess Word Versus</h1>

      <div style={{ marginTop: 24 }}>
        <label>Nume</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ width: "100%", padding: 10, marginTop: 6 }}
          placeholder="rduku"
        />
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <button
          onClick={() => {
            setErr(null);
            getSocket().emit("room:create", { name });
          }}
          style={{ padding: 10, flex: 1 }}
        >
          Create room
        </button>
      </div>

      <div style={{ marginTop: 24 }}>
        <label>Room code</label>
        <input
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
          style={{ width: "100%", padding: 10, marginTop: 6 }}
          placeholder="ABCDE"
        />
        <button
          onClick={() => {
            setErr(null);
            getSocket().emit("room:join", { roomCode, name });
          }}
          style={{ padding: 10, width: "100%", marginTop: 10 }}
        >
          Join room
        </button>
      </div>

      {err && <p style={{ color: "crimson", marginTop: 16 }}>{err}</p>}
    </main>
  );
}
