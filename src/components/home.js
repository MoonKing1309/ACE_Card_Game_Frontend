import React, { useState } from "react";
import { API_BASE } from "../api";

// frontend/src/components/home.js

export default function Home() {
    const [name, setName] = useState("");
    const [room, setRoom] = useState("");
    const [createNew, setCreateNew] = useState(false);
    const [error, setError] = useState("");

    function makeRoomId() {
        return Math.random().toString(36).slice(2, 8).toUpperCase();
    }

    function handleSubmit(e) {
        e.preventDefault();
        setError("");
        const roomId = createNew ? makeRoomId() : room.trim().toUpperCase();

        if (!name.trim()) {
            setError("Enter a player name");
            return;
        }
        if (!roomId) {
            setError("Enter or create a room");
            return;
        }

        // call backend join endpoint which creates room if missing
        (async () => {
            try {
                const res = await fetch(`${API_BASE}/api/games/join`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: name.trim(), code: roomId })
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({ message: 'Failed to join' }));
                    throw new Error(err.message || 'Failed to join');
                }
                const data = await res.json();
                if (!data.gameId) throw new Error('Invalid server response');

                // store minimal session info for later API calls
                localStorage.setItem('playerName', name.trim());
                if (data.playerId) localStorage.setItem('playerId', data.playerId);
                if (data.token) localStorage.setItem('token', data.token);

                // navigate to room
                window.location.href = `/room/${data.gameId}`;
            } catch (err) {
                setError(err.message || 'Unable to join room');
            }
        })();
    }

    return (
        <div style={styles.page}>
            <form onSubmit={handleSubmit} style={styles.card}>
                <h2 style={styles.title}>ACE — Login</h2>

                <label style={styles.label}>
                    Player name
                    <input
                        style={styles.input}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Alice"
                        maxLength={20}
                    />
                </label>

                <label style={styles.label}>
                    Room ID
                    <input
                        style={styles.input}
                        value={room}
                        onChange={(e) => setRoom(e.target.value)}
                        placeholder="AB12CD or create new"
                        disabled={createNew}
                        maxLength={10}
                    />
                </label>

                <label style={styles.inline}>
                    <input
                        type="checkbox"
                        checked={createNew}
                        onChange={(e) => setCreateNew(e.target.checked)}
                    />
                    Create new room
                </label>

                {error && <div style={styles.error}>{error}</div>}

                <button type="submit" style={styles.button}>
                    Join
                </button>

                <p style={styles.hint}>
                    Room is persistent. Rejoin the same room with the same players to continue.
                </p>
            </form>
        </div>
    );
}

const styles = {
    page: {
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f6f8fa",
        fontFamily: "sans-serif",
    },
    card: {
        width: 360,
        padding: 20,
        borderRadius: 8,
        boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
        background: "#fff",
        display: "flex",
        flexDirection: "column",
        gap: 10,
    },
    title: { margin: 0, textAlign: "center" },
    label: { display: "flex", flexDirection: "column", fontSize: 13 },
    input: {
        marginTop: 6,
        padding: "8px 10px",
        fontSize: 14,
        borderRadius: 4,
        border: "1px solid #ddd",
    },
    inline: { display: "flex", alignItems: "center", gap: 8, fontSize: 13 },
    button: {
        marginTop: 6,
        padding: "10px 12px",
        borderRadius: 6,
        border: "none",
        background: "#111827",
        color: "#fff",
        cursor: "pointer",
        fontSize: 14,
    },
    error: { color: "#b00020", fontSize: 13 },
    hint: { marginTop: 8, fontSize: 12, color: "#6b7280", textAlign: "center" },
};