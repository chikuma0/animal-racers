'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { MultiplayerManager } from '@/lib/multiplayer';
import { GameEngine } from '@/lib/engine';
import { renderGame } from '@/lib/renderer';
import {
  GamePhase,
  PlayerState,
  CharacterId,
  CHARACTERS,
  TRACK,
  BroadcastPayload,
} from '@/lib/types';

function createPlayer(id: string, name: string): PlayerState {
  return {
    id,
    name,
    character: null,
    ready: false,
    x: 0.5,
    progress: 0,
    lap: 0,
    speed: 0,
    boosting: false,
    jumping: false,
    frozen: false,
    shielded: false,
    hitStun: 0,
    finished: false,
    finishTime: 0,
    battleFinished: false,
    battleFinishTime: 0,
    attackCooldown: 0,
  };
}

export default function Game() {
  const [phase, setPhase] = useState<GamePhase>('home');
  const [roomCode, setRoomCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [localPlayer, setLocalPlayer] = useState<PlayerState | null>(null);
  const [remotePlayers, setRemotePlayers] = useState<Record<string, PlayerState>>({});
  const [countdownText, setCountdownText] = useState<string | null>(null);
  const [takenCharacters, setTakenCharacters] = useState<Set<CharacterId>>(new Set());
  const [remoteReady, setRemoteReady] = useState<Set<string>>(new Set());
  const [raceResults, setRaceResults] = useState<{ name: string; character: CharacterId; time: number }[]>([]);
  const [battleResults, setBattleResults] = useState<{ name: string; character: CharacterId; time: number }[]>([]);
  const [, setGameStartTime] = useState(0);
  const [battleTransition, setBattleTransition] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mpRef = useRef<MultiplayerManager | null>(null);
  const engineRef = useRef<GameEngine>(new GameEngine());
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const tiltXRef = useRef<number>(0);
  const boostPressedRef = useRef(false);
  const jumpPressedRef = useRef(false);
  const boostCooldownRef = useRef(0);
  const jumpCooldownRef = useRef(0);
  const localPlayerRef = useRef<PlayerState | null>(null);
  const remotePlayersRef = useRef<Record<string, PlayerState>>({});
  const phaseRef = useRef<GamePhase>('home');
  const broadcastIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const attackCooldownRef = useRef(0);

  // Keep refs in sync
  useEffect(() => { localPlayerRef.current = localPlayer; }, [localPlayer]);
  useEffect(() => { remotePlayersRef.current = remotePlayers; }, [remotePlayers]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // Initialize multiplayer
  useEffect(() => {
    mpRef.current = new MultiplayerManager();
    return () => {
      mpRef.current?.disconnect();
      if (broadcastIntervalRef.current) clearInterval(broadcastIntervalRef.current);
    };
  }, []);

  // Setup multiplayer listeners
  const setupListeners = useCallback(() => {
    const mp = mpRef.current;
    if (!mp) return;

    mp.on('player_join', (payload: BroadcastPayload) => {
      const name = payload.data.name as string;
      const newPlayer = createPlayer(payload.senderId, name);
      setRemotePlayers(prev => ({ ...prev, [payload.senderId]: newPlayer }));
    });

    mp.on('character_pick', (payload: BroadcastPayload) => {
      const char = payload.data.character as CharacterId;
      setRemotePlayers(prev => ({
        ...prev,
        [payload.senderId]: { ...prev[payload.senderId], character: char },
      }));
      setTakenCharacters(prev => new Set([...prev, char]));
    });

    mp.on('player_ready', (payload: BroadcastPayload) => {
      setRemoteReady(prev => new Set([...prev, payload.senderId]));
    });

    mp.on('start_game', (payload: BroadcastPayload) => {
      const startTime = payload.data.startTime as number;
      setGameStartTime(startTime);
      startCountdown(startTime);
    });

    mp.on('player_update', (payload: BroadcastPayload) => {
      setRemotePlayers(prev => ({
        ...prev,
        [payload.senderId]: {
          ...prev[payload.senderId],
          ...(payload.data as Partial<PlayerState>),
          id: payload.senderId,
        } as PlayerState,
      }));
    });

    mp.on('attack', (payload: BroadcastPayload) => {
      handleIncomingAttack(payload);
    });

    mp.on('phase_change', (payload: BroadcastPayload) => {
      const newPhase = payload.data.phase as GamePhase;
      if (newPhase === 'battle') {
        startBattlePhase();
      } else if (newPhase === 'results') {
        setPhase('results');
      }
    });

    mp.on('race_finish', (payload: BroadcastPayload) => {
      const time = payload.data.finishTime as number;
      const rp = remotePlayersRef.current[payload.senderId];
      if (rp) {
        setRaceResults(prev => [...prev, { name: rp.name, character: rp.character!, time }]);
      }
    });

    mp.on('battle_finish', (payload: BroadcastPayload) => {
      const time = payload.data.battleFinishTime as number;
      const rp = remotePlayersRef.current[payload.senderId];
      if (rp) {
        setBattleResults(prev => [...prev, { name: rp.name, character: rp.character!, time }]);
      }
    });
  }, []);

  const handleIncomingAttack = (payload: BroadcastPayload) => {
    const attackChar = payload.data.character as CharacterId;
    const lp = localPlayerRef.current;
    if (!lp) return;

    if (attackChar === 'lion') {
      // Fire Dash - knock aside
      if (lp.shielded) {
        setLocalPlayer(prev => prev ? { ...prev, shielded: false } : prev);
      } else {
        setLocalPlayer(prev => prev ? { ...prev, hitStun: TRACK.HIT_STUN_DURATION, x: Math.max(0.1, Math.min(0.9, prev.x + (Math.random() > 0.5 ? 0.15 : -0.15))) } : prev);
        engineRef.current.addShake(10);
      }
    } else if (attackChar === 'wolf') {
      // Ice Howl - freeze
      if (lp.shielded) {
        setLocalPlayer(prev => prev ? { ...prev, shielded: false } : prev);
      } else {
        setLocalPlayer(prev => prev ? { ...prev, frozen: true } : prev);
        setTimeout(() => {
          setLocalPlayer(prev => prev ? { ...prev, frozen: false } : prev);
        }, TRACK.FREEZE_DURATION);
      }
    }
    // Unicorn's Rainbow Shield is self-buff, not an attack on others
  };

  // Accelerometer
  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma !== null) {
        tiltXRef.current = Math.max(-1, Math.min(1, e.gamma / 30));
      }
    };

    // Request permission on iOS
    const requestPermission = async () => {
      if (typeof (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission === 'function') {
        try {
          const perm = await (DeviceOrientationEvent as unknown as { requestPermission: () => Promise<string> }).requestPermission();
          if (perm === 'granted') {
            window.addEventListener('deviceorientation', handleOrientation);
          }
        } catch {
          // Fall back to touch
        }
      } else {
        window.addEventListener('deviceorientation', handleOrientation);
      }
    };

    requestPermission();

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, []);

  // Touch controls for steering
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (touch) {
      touchStartXRef.current = touch.clientX;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const touch = e.touches[0];
    if (touch) {
      const dx = touch.clientX - touchStartXRef.current;
      tiltXRef.current = Math.max(-1, Math.min(1, dx / 50));
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    touchStartXRef.current = null;
    tiltXRef.current = 0;
  }, []);

  // Game loop
  const gameLoop = useCallback((timestamp: number) => {
    if (!canvasRef.current || !localPlayerRef.current) {
      animFrameRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    const dt = lastTimeRef.current ? Math.min(timestamp - lastTimeRef.current, 50) : 16;
    lastTimeRef.current = timestamp;
    const now = Date.now();

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const engine = engineRef.current;
    let player = localPlayerRef.current;
    const currentPhase = phaseRef.current;
    const isBattle = currentPhase === 'battle';
    const isRacing = currentPhase === 'racing' || isBattle;

    if (isRacing && !player.finished && !(isBattle && player.battleFinished)) {
      // Handle boost
      if (boostPressedRef.current && boostCooldownRef.current <= 0) {
        player = { ...player, boosting: true };
        boostCooldownRef.current = TRACK.BOOST_COOLDOWN;
        setTimeout(() => {
          setLocalPlayer(prev => prev ? { ...prev, boosting: false } : prev);
        }, TRACK.BOOST_DURATION);
        const charDef = player.character ? CHARACTERS[player.character] : null;
        if (charDef) {
          engine.addParticles(player.x * TRACK.WIDTH, TRACK.VISIBLE_HEIGHT * 0.65, charDef.color, 8);
        }
        engine.addShake(3);
        boostPressedRef.current = false;
      }
      boostCooldownRef.current = Math.max(0, boostCooldownRef.current - dt);

      // Handle jump
      if (jumpPressedRef.current && jumpCooldownRef.current <= 0) {
        player = { ...player, jumping: true };
        jumpCooldownRef.current = TRACK.JUMP_COOLDOWN;
        setTimeout(() => {
          setLocalPlayer(prev => prev ? { ...prev, jumping: false } : prev);
        }, TRACK.JUMP_DURATION);
        jumpPressedRef.current = false;
      }
      jumpCooldownRef.current = Math.max(0, jumpCooldownRef.current - dt);

      // Battle auto-attack
      if (isBattle && player.character) {
        attackCooldownRef.current -= dt;
        if (attackCooldownRef.current <= 0) {
          attackCooldownRef.current = 4000; // Attack every 4 seconds
          mpRef.current?.broadcastAttack(player.character);

          // Unicorn self-buff
          if (player.character === 'unicorn') {
            player = { ...player, shielded: true };
          }
          // Lion boost on attack
          if (player.character === 'lion') {
            player = { ...player, boosting: true };
            setTimeout(() => {
              setLocalPlayer(prev => prev ? { ...prev, boosting: false } : prev);
            }, 300);
            engine.addShake(5);
          }

          if (player.character) {
            const charDef = CHARACTERS[player.character];
            engine.addParticles(player.x * TRACK.WIDTH, TRACK.VISIBLE_HEIGHT * 0.65, charDef.color, 12);
          }
        }
      }

      // Update physics
      player = engine.updatePlayer(player, dt, tiltXRef.current, player.boosting, player.jumping, isBattle, now);

      // Check if finished
      if (player.finished && !isBattle) {
        mpRef.current?.broadcastRaceFinish(player.finishTime);
        setRaceResults(prev => {
          if (prev.find(r => r.name === player.name)) return prev;
          return [...prev, { name: player.name, character: player.character!, time: player.finishTime }];
        });
      }
      if (player.battleFinished && isBattle) {
        mpRef.current?.broadcastBattleFinish(player.battleFinishTime);
        setBattleResults(prev => {
          if (prev.find(r => r.name === player.name)) return prev;
          return [...prev, { name: player.name, character: player.character!, time: player.battleFinishTime }];
        });
      }

      setLocalPlayer(player);
    }

    // Update particles
    engine.updateParticles(dt);

    // Render
    const otherPlayers = Object.values(remotePlayersRef.current);
    renderGame(ctx, canvasRef.current, engine, player, otherPlayers, isBattle, countdownText);

    animFrameRef.current = requestAnimationFrame(gameLoop);
  }, [countdownText]);

  // Start/stop game loop based on phase
  useEffect(() => {
    if (phase === 'racing' || phase === 'battle' || phase === 'countdown') {
      animFrameRef.current = requestAnimationFrame(gameLoop);
      return () => {
        cancelAnimationFrame(animFrameRef.current);
      };
    }
  }, [phase, gameLoop]);

  // Broadcast position at 10Hz during racing
  useEffect(() => {
    if (phase === 'racing' || phase === 'battle') {
      broadcastIntervalRef.current = setInterval(() => {
        if (localPlayerRef.current) {
          mpRef.current?.broadcastPosition(localPlayerRef.current);
        }
      }, 100);
      return () => {
        if (broadcastIntervalRef.current) clearInterval(broadcastIntervalRef.current);
      };
    }
  }, [phase]);

  // Resize canvas
  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const w = Math.min(window.innerWidth, 420);
      const h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // Auto-check for battle transition and results
  useEffect(() => {
    if (phase === 'racing' && localPlayer?.finished) {
      // Check if all players finished
      const allRemoteFinished = Object.values(remotePlayers).every(p => p.finished);
      const totalPlayers = 1 + Object.keys(remotePlayers).length;
      if (allRemoteFinished || raceResults.length >= totalPlayers) {
        // Wait a moment then transition to battle
        if (!battleTransition) {
          setBattleTransition(true);
          setTimeout(() => {
            if (isHost) {
              mpRef.current?.broadcastPhaseChange('battle');
            }
            startBattlePhase();
          }, 2000);
        }
      }
    }
  }, [phase, localPlayer, remotePlayers, raceResults, isHost, battleTransition]);

  // Check battle completion
  useEffect(() => {
    if (phase === 'battle' && localPlayer?.battleFinished) {
      const allRemoteFinished = Object.values(remotePlayers).every(p => p.battleFinished);
      const totalPlayers = 1 + Object.keys(remotePlayers).length;
      if (allRemoteFinished || battleResults.length >= totalPlayers) {
        setTimeout(() => {
          if (isHost) {
            mpRef.current?.broadcastPhaseChange('results');
          }
          setPhase('results');
        }, 2000);
      }
    }
  }, [phase, localPlayer, remotePlayers, battleResults, isHost]);

  const startBattlePhase = () => {
    setBattleTransition(false);
    setLocalPlayer(prev => prev ? {
      ...prev,
      progress: 0,
      lap: 0,
      speed: 0,
      finished: false,
      battleFinished: false,
      battleFinishTime: 0,
      hitStun: 0,
      frozen: false,
      boosting: false,
      jumping: false,
      shielded: false,
    } : prev);
    attackCooldownRef.current = 2000;
    engineRef.current.resetTrack(99);

    setCountdownText('⚔️ BATTLE!');
    setPhase('battle');
    setTimeout(() => setCountdownText('3'), 1000);
    setTimeout(() => setCountdownText('2'), 2000);
    setTimeout(() => setCountdownText('1'), 3000);
    setTimeout(() => {
      setCountdownText('GO!');
      setTimeout(() => setCountdownText(null), 500);
    }, 4000);
  };

  const startCountdown = (startTime: number) => {
    const delay = startTime - Date.now();
    setPhase('countdown');

    // Reset player for racing
    setLocalPlayer(prev => prev ? {
      ...prev,
      x: 0.5,
      progress: 0,
      lap: 0,
      speed: 0,
      boosting: false,
      jumping: false,
      frozen: false,
      shielded: false,
      hitStun: 0,
      finished: false,
      finishTime: 0,
      battleFinished: false,
      battleFinishTime: 0,
    } : prev);

    engineRef.current.resetTrack(42);
    setRaceResults([]);
    setBattleResults([]);

    setCountdownText('GET READY!');
    setTimeout(() => setCountdownText('3'), Math.max(0, delay - 3000));
    setTimeout(() => setCountdownText('2'), Math.max(0, delay - 2000));
    setTimeout(() => setCountdownText('1'), Math.max(0, delay - 1000));
    setTimeout(() => {
      setCountdownText('GO! 🏁');
      setPhase('racing');
      setTimeout(() => setCountdownText(null), 800);
    }, delay);
  };

  // ========== SCREENS ==========

  // HOME SCREEN
  if (phase === 'home') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-800 via-green-600 to-emerald-500 flex flex-col items-center justify-center p-6 text-white">
        <div className="text-6xl mb-2 animate-bounce">🏎️</div>
        <h1 className="text-5xl font-extrabold mb-2 tracking-tight" style={{ textShadow: '3px 3px 0 #000' }}>
          ANIMAL
        </h1>
        <h1 className="text-5xl font-extrabold mb-6 tracking-tight" style={{ textShadow: '3px 3px 0 #000' }}>
          RACERS
        </h1>
        <div className="flex gap-4 text-4xl mb-8">
          <span className="animate-pulse">🦁</span>
          <span className="animate-pulse" style={{ animationDelay: '0.2s' }}>🐺</span>
          <span className="animate-pulse" style={{ animationDelay: '0.4s' }}>🦄</span>
        </div>

        <input
          type="text"
          placeholder="Your Name"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value.slice(0, 10))}
          className="w-64 p-3 mb-4 rounded-xl text-center text-xl font-bold bg-white/20 backdrop-blur border-2 border-white/40 text-white placeholder-white/60 outline-none focus:border-yellow-300"
          maxLength={10}
        />

        <button
          onClick={async () => {
            if (!playerName.trim()) return;
            const mp = mpRef.current!;
            const code = mp.generateRoomCode();
            setRoomCode(code);
            setIsHost(true);
            await mp.joinRoom(code);
            setupListeners();
            const player = createPlayer(mp.getPlayerId(), playerName.trim());
            setLocalPlayer(player);
            setPhase('character-select');
          }}
          disabled={!playerName.trim()}
          className="w-64 p-4 mb-3 rounded-2xl text-xl font-bold bg-yellow-400 text-yellow-900 shadow-lg active:scale-95 transition-transform disabled:opacity-50 disabled:active:scale-100"
        >
          🏠 Create Room
        </button>

        <div className="flex items-center gap-2 w-64">
          <input
            type="text"
            placeholder="Code"
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
            className="flex-1 p-3 rounded-xl text-center text-xl font-bold bg-white/20 backdrop-blur border-2 border-white/40 text-white placeholder-white/60 outline-none focus:border-yellow-300"
            maxLength={4}
            inputMode="numeric"
          />
          <button
            onClick={async () => {
              if (!playerName.trim() || inputCode.length !== 4) return;
              const mp = mpRef.current!;
              setRoomCode(inputCode);
              setIsHost(false);
              await mp.joinRoom(inputCode);
              setupListeners();
              const player = createPlayer(mp.getPlayerId(), playerName.trim());
              setLocalPlayer(player);
              mp.broadcastJoin(playerName.trim());
              setPhase('character-select');
            }}
            disabled={!playerName.trim() || inputCode.length !== 4}
            className="p-4 rounded-2xl text-xl font-bold bg-blue-400 text-blue-900 shadow-lg active:scale-95 transition-transform disabled:opacity-50"
          >
            Join
          </button>
        </div>
      </div>
    );
  }

  // CHARACTER SELECT
  if (phase === 'character-select') {
    const allChars: CharacterId[] = ['lion', 'wolf', 'unicorn'];
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-900 via-purple-700 to-indigo-600 flex flex-col items-center p-6 text-white">
        <div className="text-sm font-mono bg-black/30 px-3 py-1 rounded-full mb-4">
          Room: <span className="font-bold text-yellow-300 text-lg">{roomCode}</span>
        </div>
        <h2 className="text-3xl font-extrabold mb-6" style={{ textShadow: '2px 2px 0 #000' }}>
          Choose Your Racer!
        </h2>
        <div className="space-y-4 w-full max-w-sm">
          {allChars.map(charId => {
            const char = CHARACTERS[charId];
            const taken = takenCharacters.has(charId);
            const selected = localPlayer?.character === charId;
            return (
              <button
                key={charId}
                onClick={() => {
                  if (taken || selected) return;
                  setLocalPlayer(prev => prev ? { ...prev, character: charId } : prev);
                  setTakenCharacters(prev => new Set([...prev, charId]));
                  mpRef.current?.broadcastCharacterPick(charId);
                }}
                disabled={taken && !selected}
                className={`w-full p-4 rounded-2xl flex items-center gap-4 transition-all ${
                  selected
                    ? 'bg-yellow-400 text-yellow-900 scale-105 shadow-xl border-4 border-yellow-200'
                    : taken
                    ? 'bg-gray-600/50 text-gray-400'
                    : 'bg-white/15 backdrop-blur active:scale-95 border-2 border-white/20'
                }`}
              >
                <span className="text-5xl">{char.emoji}</span>
                <div className="text-left flex-1">
                  <div className="text-xl font-bold">{char.name}</div>
                  <div className="text-sm opacity-80">{char.attackName}: {char.attackDesc}</div>
                </div>
                {selected && <span className="text-2xl">✅</span>}
                {taken && !selected && <span className="text-lg">🔒</span>}
              </button>
            );
          })}
        </div>
        {localPlayer?.character && (
          <button
            onClick={() => setPhase('waiting')}
            className="mt-6 w-64 p-4 rounded-2xl text-xl font-bold bg-green-400 text-green-900 shadow-lg active:scale-95 transition-transform animate-pulse"
          >
            Continue →
          </button>
        )}
      </div>
    );
  }

  // WAITING ROOM
  if (phase === 'waiting') {
    const allPlayers = [
      { id: localPlayer?.id, name: localPlayer?.name, character: localPlayer?.character, ready: localPlayer?.ready },
      ...Object.values(remotePlayers).map(p => ({ id: p.id, name: p.name, character: p.character, ready: remoteReady.has(p.id) })),
    ];
    const totalReady = allPlayers.filter(p => p.ready || (p.id === localPlayer?.id && localPlayer?.ready)).length;
    const canStart = isHost && totalReady === allPlayers.length && allPlayers.length >= 1;

    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-700 via-orange-500 to-yellow-500 flex flex-col items-center p-6 text-white">
        <div className="text-sm font-mono bg-black/30 px-4 py-2 rounded-full mb-4">
          Room Code: <span className="font-bold text-3xl text-yellow-200">{roomCode}</span>
        </div>
        <p className="text-sm mb-4 opacity-80">Share this code with other players!</p>

        <h2 className="text-2xl font-bold mb-4">Players ({allPlayers.length}/3)</h2>

        <div className="space-y-3 w-full max-w-sm mb-6">
          {allPlayers.map((p, i) => {
            const charDef = p.character ? CHARACTERS[p.character] : null;
            return (
              <div key={i} className="flex items-center gap-3 bg-white/20 backdrop-blur rounded-xl p-3">
                <span className="text-3xl">{charDef?.emoji || '❓'}</span>
                <div className="flex-1">
                  <div className="font-bold">{p.name} {p.id === localPlayer?.id ? '(You)' : ''}</div>
                  <div className="text-sm opacity-80">{charDef?.name || 'No character'}</div>
                </div>
                {(p.ready || (p.id === localPlayer?.id && localPlayer?.ready)) && (
                  <span className="text-2xl">✅</span>
                )}
              </div>
            );
          })}
        </div>

        {!localPlayer?.ready ? (
          <button
            onClick={() => {
              setLocalPlayer(prev => prev ? { ...prev, ready: true } : prev);
              mpRef.current?.broadcastReady();
            }}
            className="w-64 p-4 rounded-2xl text-xl font-bold bg-green-400 text-green-900 shadow-lg active:scale-95 transition-transform"
          >
            ✋ Ready!
          </button>
        ) : (
          <div className="text-lg font-bold text-green-200 animate-pulse">
            Waiting for others...
          </div>
        )}

        {canStart && (
          <button
            onClick={() => {
              const startTime = Date.now() + 4000;
              mpRef.current?.broadcastStartGame();
              setGameStartTime(startTime);
              startCountdown(startTime);
            }}
            className="mt-4 w-64 p-4 rounded-2xl text-xl font-bold bg-red-500 text-white shadow-lg active:scale-95 transition-transform animate-bounce"
          >
            🏁 START RACE!
          </button>
        )}
      </div>
    );
  }

  // RESULTS
  if (phase === 'results') {
    const sortedRace = [...raceResults].sort((a, b) => a.time - b.time);
    const sortedBattle = [...battleResults].sort((a, b) => a.time - b.time);

    return (
      <div className="min-h-screen bg-gradient-to-b from-yellow-600 via-amber-500 to-orange-500 flex flex-col items-center p-6 text-white">
        <div className="text-6xl mb-2">🏆</div>
        <h1 className="text-4xl font-extrabold mb-6" style={{ textShadow: '2px 2px 0 #000' }}>
          RESULTS!
        </h1>

        {/* Race Results */}
        <div className="w-full max-w-sm mb-6">
          <h3 className="text-xl font-bold mb-2 text-center">🏁 Race</h3>
          <div className="space-y-2">
            {sortedRace.map((r, i) => {
              const charDef = CHARACTERS[r.character];
              return (
                <div key={i} className={`flex items-center gap-3 p-3 rounded-xl ${i === 0 ? 'bg-yellow-300/40 border-2 border-yellow-200' : 'bg-white/15'}`}>
                  <span className="text-2xl font-bold">{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
                  <span className="text-3xl">{charDef.emoji}</span>
                  <div className="flex-1">
                    <div className="font-bold">{r.name}</div>
                  </div>
                  {i === 0 && <span className="text-2xl">🏆</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Battle Results */}
        {sortedBattle.length > 0 && (
          <div className="w-full max-w-sm mb-6">
            <h3 className="text-xl font-bold mb-2 text-center">⚔️ Battle</h3>
            <div className="space-y-2">
              {sortedBattle.map((r, i) => {
                const charDef = CHARACTERS[r.character];
                return (
                  <div key={i} className={`flex items-center gap-3 p-3 rounded-xl ${i === 0 ? 'bg-purple-300/40 border-2 border-purple-200' : 'bg-white/15'}`}>
                    <span className="text-2xl font-bold">{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
                    <span className="text-3xl">{charDef.emoji}</span>
                    <div className="flex-1">
                      <div className="font-bold">{r.name}</div>
                    </div>
                    {i === 0 && <span className="text-2xl">🏆✨</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <button
          onClick={() => {
            setPhase('home');
            setLocalPlayer(null);
            setRemotePlayers({});
            setTakenCharacters(new Set());
            setRemoteReady(new Set());
            setRaceResults([]);
            setBattleResults([]);
            setBattleTransition(false);
            mpRef.current?.disconnect();
          }}
          className="w-64 p-4 rounded-2xl text-xl font-bold bg-white/20 backdrop-blur border-2 border-white/40 active:scale-95 transition-transform"
        >
          🏠 Play Again
        </button>
      </div>
    );
  }

  // RACING / BATTLE / COUNTDOWN — Canvas view with controls
  return (
    <div
      className="fixed inset-0 bg-black touch-none select-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <canvas ref={canvasRef} className="block" />

      {/* Control buttons */}
      {(phase === 'racing' || phase === 'battle') && (
        <>
          {/* Boost button - left */}
          <button
            onTouchStart={(e) => {
              e.stopPropagation();
              boostPressedRef.current = true;
            }}
            className={`fixed bottom-8 left-6 w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold shadow-2xl active:scale-90 transition-transform ${
              boostCooldownRef.current > 0
                ? 'bg-gray-600/80 text-gray-400'
                : 'bg-orange-500/90 text-white border-4 border-orange-300'
            }`}
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            🔥
          </button>

          {/* Jump button - right */}
          <button
            onTouchStart={(e) => {
              e.stopPropagation();
              jumpPressedRef.current = true;
            }}
            className={`fixed bottom-8 right-6 w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold shadow-2xl active:scale-90 transition-transform ${
              jumpCooldownRef.current > 0
                ? 'bg-gray-600/80 text-gray-400'
                : 'bg-blue-500/90 text-white border-4 border-blue-300'
            }`}
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            ⬆️
          </button>

          {/* Battle indicator */}
          {phase === 'battle' && (
            <div className="fixed top-14 left-1/2 -translate-x-1/2 bg-red-600/80 backdrop-blur px-4 py-1 rounded-full text-white font-bold text-lg animate-pulse">
              ⚔️ BATTLE MODE ⚔️
            </div>
          )}
        </>
      )}
    </div>
  );
}
