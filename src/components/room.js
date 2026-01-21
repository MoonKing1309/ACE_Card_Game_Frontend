import React, { useEffect, useState } from "react";
import { API_BASE } from "../api";

// /frontend/src/components/room.js

/*
    Barebone room component for ACE Card Game.
    - Local persistent rooms via localStorage key "ace_room_<roomId>"
    - Add players, start game, play cards by clicking player's card.
    - Enforces following-suit rules and punishment mechanics simplified per spec.
    - Minimal UI, no styling.
*/

const SUITS = ["Spade", "Diamond", "Clover", "Hearts"];
const RANKS = ["A", "K", "Q", "J", "10", "9", "8", "7", "6", "5", "4", "3", "2"];

function createDeck() {
    const deck = [];
    for (const suit of SUITS) {
        for (const rank of RANKS) {
            deck.push({ suit, rank, id: `${rank[0]}${suit[0]}` });
        }
    }
    return deck;
}
function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
function rankWeight(rank) {
    return RANKS.indexOf(rank); // lower index => heavier (A = 0)
}
function playerHasSuit(player, suit) {
    return player.hand.some((c) => c.suit === suit);
}
function saveRoom(roomId, state) {
    localStorage.setItem(`ace_room_${roomId}`, JSON.stringify(state));
}
function loadRoom(roomId) {
    const s = localStorage.getItem(`ace_room_${roomId}`);
    return s ? JSON.parse(s) : null;
}

async function loadRemoteRoom(roomId) {
    try {
        const res = await fetch(`${API_BASE}/api/games/${roomId}`);
        if (!res.ok) return null;
        const room = await res.json();
        return room.gameState || null;
    } catch (err) {
        return null;
    }
}

async function saveRemoteRoom(roomId, state) {
    const token = localStorage.getItem('token');
    if (!token) return false;
    try {
        const res = await fetch(`${API_BASE}/api/games/${roomId}/state`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, gameState: state }),
        });
        return res.ok;
    } catch (err) {
        return false;
    }
}

export default function Room() {
    const [roomId, setRoomId] = useState("default");
    const [state, setState] = useState({
        players: [], // {name, hand:[], eliminatedOrder: null}
        started: false,
        deck: [],
        pool: [], // [{playerIndex, card}]
        poolSuit: null,
        currentPlayer: 0,
        playsThisTrick: 0,
        eliminatedSeq: [], // indices in elimination order (first out first)
    });

    useEffect(() => {
        (async () => {
            // try remote first, then fallback to local
            const remote = await loadRemoteRoom(roomId);
            if (remote) {
                setState(remote);
                return;
            }
            const saved = loadRoom(roomId);
            if (saved) setState(saved);
        })();
    }, [roomId]);

    useEffect(() => {
        // persist locally immediately, try remote persist in background
        saveRoom(roomId, state);
        saveRemoteRoom(roomId, state);
    }, [roomId, state]);

    function addPlayer(name) {
        if (!name) return;
        setState((s) => {
            if (s.started) return s;
            return { ...s, players: [...s.players, { name, hand: [], eliminatedOrder: null }] };
        });
    }

    function startGame() {
        setState((s) => {
            if (s.players.length < 2) return s;
            const deck = shuffle(createDeck());
            const hands = s.players.map(() => []);
            let i = 0;
            while (deck.length) {
                hands[i % hands.length].push(deck.shift());
                i++;
            }
            const players = s.players.map((p, idx) => ({ ...p, hand: hands[idx], eliminatedOrder: null }));
            // find who has A of Spade
            let startIndex = players.findIndex((p) => p.hand.some((c) => c.suit === "Spade" && c.rank === "A"));
            if (startIndex === -1) startIndex = 0;
            return {
                ...s,
                started: true,
                deck: [], // cards not in players are none (distributed)
                players,
                pool: [],
                poolSuit: null,
                currentPlayer: startIndex,
                playsThisTrick: 0,
                eliminatedSeq: [],
            };
        });
    }

    function playCard(playerIndex, cardIndex) {
        setState((s) => {
            if (!s.started) return s;
            if (s.currentPlayer !== playerIndex) return s; // only current player can play
            const player = s.players[playerIndex];
            const card = player.hand[cardIndex];
            if (!card) return s;

            // enforce follow-suit if possible
            const poolSuit = s.poolSuit;
            if (poolSuit && playerHasSuit(player, poolSuit) && card.suit !== poolSuit) {
                // illegal play
                return s;
            }

            const newPlayers = s.players.map((p) => ({ ...p, hand: [...p.hand] }));
            newPlayers[playerIndex].hand.splice(cardIndex, 1);
            const newPool = [...s.pool, { playerIndex, card }];
            const newPoolSuit = s.poolSuit || card.suit;
            const newPlays = s.playsThisTrick + 1;

            // When everyone has played once (active players are those not eliminated yet),
            const activePlayers = newPlayers.filter((p) => p.hand.length >= 0).length - 0; // all players always active until eliminated by zero cards
            // But elimination occurs when a player reaches zero cards; they are out of play
            // Count active players as those with hand.length > 0
            const activeCount = newPlayers.filter((p) => p.hand.length > 0).length;
            const playersInTrick = activeCount === 0 ? newPlayers.length : activeCount;

            let nextState = {
                ...s,
                players: newPlayers,
                pool: newPool,
                poolSuit: newPoolSuit,
                playsThisTrick: newPlays,
            };

            // if trick complete: each active player had a play (we approximate by plays equaling number of active players)
            if (newPlays >= playersInTrick) {
                // Check if any off-suit played by someone who had no poolSuit -> that is allowed punishment
                const anyPunish = newPool.some(
                    (p) => p.card.suit !== newPoolSuit && !s.players[p.playerIndex].hand.concat([p.card]).some((c) => c.suit === newPoolSuit)
                );
                if (anyPunish) {
                    // determine victim: highest card among pool cards with poolSuit
                    const poolSuitCards = newPool.filter((x) => x.card.suit === newPoolSuit);
                    let victimIndex = null;
                    if (poolSuitCards.length > 0) {
                        poolSuitCards.sort((a, b) => rankWeight(a.card.rank) - rankWeight(b.card.rank));
                        victimIndex = poolSuitCards[0].playerIndex;
                    } else {
                        // no one had pool suit (edge), pick first player in trick
                        victimIndex = newPool[0].playerIndex;
                    }
                    // victim receives all pool cards (adds to their hand)
                    const collected = newPool.map((x) => x.card);
                    nextState.players = nextState.players.map((p, idx) =>
                        idx === victimIndex ? { ...p, hand: [...p.hand, ...collected] } : p
                    );
                    // pool dissolves
                    nextState.pool = [];
                    nextState.poolSuit = null;
                    nextState.playsThisTrick = 0;
                    // next current player: player after victim
                    let nextIdx = (victimIndex + 1) % newPlayers.length;
                    // skip eliminated (hand length === 0)
                    while (nextState.players[nextIdx].hand.length === 0 && nextState.players.filter((p) => p.hand.length > 0).length > 0) {
                        nextIdx = (nextIdx + 1) % newPlayers.length;
                    }
                    nextState.currentPlayer = nextIdx;
                } else {
                    // no punishment: pool cards are discarded (removed), not given to anyone
                    nextState.pool = [];
                    nextState.poolSuit = null;
                    nextState.playsThisTrick = 0;
                    // determine winner: highest rank among pool cards of poolSuit
                    const suitCards = newPool.filter((x) => x.card.suit === newPoolSuit);
                    let winnerIndex;
                    if (suitCards.length > 0) {
                        suitCards.sort((a, b) => rankWeight(a.card.rank) - rankWeight(b.card.rank));
                        winnerIndex = suitCards[0].playerIndex;
                    } else {
                        winnerIndex = newPool[0].playerIndex;
                    }
                    // next current player is player after winner
                    let nextIdx = (winnerIndex + 1) % newPlayers.length;
                    while (nextState.players[nextIdx].hand.length === 0 && nextState.players.filter((p) => p.hand.length > 0).length > 0) {
                        nextIdx = (nextIdx + 1) % newPlayers.length;
                    }
                    nextState.currentPlayer = nextIdx;
                }

                // mark eliminated players (zero hand) in order
                const elimSeq = [...nextState.eliminatedSeq];
                nextState.players.forEach((p, idx) => {
                    if (p.hand.length === 0 && !elimSeq.includes(idx)) {
                        elimSeq.push(idx);
                        nextState.players[idx].eliminatedOrder = elimSeq.length;
                    }
                });
                nextState.eliminatedSeq = elimSeq;

                // check game end: only one player with cards >0 remains
                const alive = nextState.players.filter((p) => p.hand.length > 0);
                if (alive.length <= 1) {
                    // game over: add loser assignment (we simply set started false)
                    nextState.started = false;
                    // Note: awarding heavy cards per rule 8 is not implemented here (UI can display loser)
                }
            } else {
                // advance to next player clockwise skipping eliminated (hands length === 0)
                let nextIdx = (playerIndex + 1) % newPlayers.length;
                while (nextState.players[nextIdx].hand.length === 0 && nextState.players.filter((p) => p.hand.length > 0).length > 0) {
                    nextIdx = (nextIdx + 1) % newPlayers.length;
                }
                nextState.currentPlayer = nextIdx;
            }

            return nextState;
        });
    }

    function resetRoom() {
        setState({
            players: [],
            started: false,
            deck: [],
            pool: [],
            poolSuit: null,
            currentPlayer: 0,
            playsThisTrick: 0,
            eliminatedSeq: [],
        });
        localStorage.removeItem(`ace_room_${roomId}`);
    }

    return (
        <div style={{ padding: 16 }}>
            <div>
                <label>Room ID: </label>
                <input value={roomId} onChange={(e) => setRoomId(e.target.value)} />
                <button onClick={() => {
                    const r = loadRoom(roomId);
                    if (r) setState(r);
                }}>Load</button>
                <button onClick={() => { saveRoom(roomId, state); }}>Save</button>
                <button onClick={resetRoom}>Reset</button>
            </div>

            {!state.started && (
                <div style={{ marginTop: 12 }}>
                    <h3>Players</h3>
                    <ul>
                        {state.players.map((p, i) => <li key={i}>{i}: {p.name}</li>)}
                    </ul>
                    <AddPlayer onAdd={(name) => addPlayer(name)} />
                    <button onClick={startGame} disabled={state.players.length < 2}>Start Game</button>
                </div>
            )}

            {state.started && (
                <div style={{ marginTop: 12 }}>
                    <h3>Game Room: {roomId}</h3>
                    <div>Current Player: {state.currentPlayer} - {state.players[state.currentPlayer].name}</div>
                    <div>Pool Suit: {state.poolSuit || "-"}</div>
                    <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                        {state.players.map((p, idx) => (
                            <div key={idx} style={{ border: "1px solid #ccc", padding: 8 }}>
                                <div><strong>{idx}: {p.name}</strong> {p.hand.length === 0 ? "(out)" : ""}</div>
                                <div>Hand ({p.hand.length}):</div>
                                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                    {p.hand.map((c, ci) => (
                                        <button
                                            key={ci}
                                            onClick={() => playCard(idx, ci)}
                                            disabled={state.currentPlayer !== idx}
                                            title={`${c.rank} of ${c.suit}`}
                                        >
                                            {c.rank}{c.suit[0]}
                                        </button>
                                    ))}
                                </div>
                                {p.eliminatedOrder && <div>Eliminated #{p.eliminatedOrder}</div>}
                            </div>
                        ))}
                    </div>

                    <div style={{ marginTop: 12 }}>
                        <h4>Current Pool</h4>
                        <div style={{ display: "flex", gap: 8 }}>
                            {state.pool.map((p, i) => (
                                <div key={i}>{p.playerIndex}: {p.card.rank}{p.card.suit[0]}</div>
                            ))}
                        </div>
                    </div>

                    {!state.started && <div>Game over</div>}
                </div>
            )}

            {!state.started && state.eliminatedSeq.length > 0 && (
                <div style={{ marginTop: 12 }}>
                    <h3>Elimination Order</h3>
                    <ol>
                        {state.eliminatedSeq.map((idx) => <li key={idx}>{state.players[idx].name}</li>)}
                    </ol>
                </div>
            )}
        </div>
    );
}

function AddPlayer({ onAdd }) {
    const [name, setName] = useState("");
    return (
        <div>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="player name" />
            <button onClick={() => { if (name) { onAdd(name); setName(""); } }}>Add</button>
        </div>
    );
}