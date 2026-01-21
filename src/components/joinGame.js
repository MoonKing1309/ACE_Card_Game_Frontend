import React, { useState } from 'react';
import { API_BASE } from '../api';
import { useNavigate } from 'react-router-dom';

export default function JoinGame() {
    const [username, setUsername] = useState('');
    const [gameCode, setGameCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    async function handleSubmit(e) {
        e.preventDefault();
        setError(null);

        const name = username.trim();
        const code = gameCode.trim();

        if (!name || !code) {
            setError('Please enter a name and game code.');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/games/join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: name, code }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({ message: 'Failed to join' }));
                throw new Error(err.message || 'Failed to join');
            }

            const data = await res.json();
            // expected: { gameId, playerId, token? }
            if (!data.gameId) throw new Error('Invalid server response');

            // store minimal info for later use
            localStorage.setItem('playerName', name);
            if (data.playerId) localStorage.setItem('playerId', data.playerId);
            if (data.token) localStorage.setItem('token', data.token);

            navigate(`/room/${data.gameId}`);
        } catch (err) {
            setError(err.message || 'Unable to join game');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="join-game">
            <h2>Join Game</h2>
            <form onSubmit={handleSubmit}>
                <div>
                    <label>
                        Name
                        <input
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Your name"
                            maxLength={32}
                            required
                        />
                    </label>
                </div>
                <div>
                    <label>
                        Game Code
                        <input
                            value={gameCode}
                            onChange={(e) => setGameCode(e.target.value)}
                            placeholder="ABCD1234"
                            maxLength={16}
                            required
                        />
                    </label>
                </div>
                <div>
                    <button type="submit" disabled={loading}>
                        {loading ? 'Joining...' : 'Join Game'}
                    </button>
                </div>
                {error && <div className="error" role="alert">{error}</div>}
            </form>
        </div>
    );
}