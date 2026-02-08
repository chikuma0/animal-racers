'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { MultiplayerManager } from '@/lib/multiplayer';
import { GameEngine } from '@/lib/engine';
import { renderGame, renderFightGame } from '@/lib/renderer';
import {
  GamePhase,
  PlayerState,
  CharacterId,
  CHARACTERS,
  TRACK,
  ARENA,
  BroadcastPayload,
  FightState,
  createDefaultFightState,
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
    fight: createDefaultFightState(),
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
  const [battleResults, setBattleResults] = useState<{ name: string; character: CharacterId; hp: number }[]>([]);
  const [battleTransition, setBattleTransition] = useState(false);
  const [tiltPermission, setTiltPermission] = useState(false);
  const [showFinished, setShowFinished] = useState(false);
  const [_fightTimer, setFightTimer] = useState(ARENA.FIGHT_DURATION);
  const [fightWinner, setFightWinner] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mpRef = useRef<MultiplayerManager | null>(null);
  const engineRef = useRef<GameEngine>(new GameEngine());
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const tiltXRef = useRef<number>(0);
  const boostActiveRef = useRef(false);
  const jumpActiveRef = useRef(false);
  const boostCooldownRef = useRef(0);
  const jumpCooldownRef = useRef(0);
  const localPlayerRef = useRef<PlayerState | null>(null);
  const remotePlayersRef = useRef<Record<string, PlayerState>>({});
  const phaseRef = useRef<GamePhase>('home');
  const broadcastIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchCurrentXRef = useRef<number | null>(null);
  const _attackCooldownRef = useRef(0);
  const countdownTextRef = useRef<string | null>(null);
  const keysDownRef = useRef<Set<string>>(new Set());
  const attackActiveRef = useRef(false);
  const fightTimerRef = useRef(ARENA.FIGHT_DURATION);
  const fightStartTimeRef = useRef(0);
  const fightOverRef = useRef(false);
  // Fighting game inputs
  const fightMoveXRef = useRef(0);
  const fightJumpRef = useRef(false);
  const fightPunchRef = useRef(false);
  const fightSpecialRef = useRef(false);
  // Track which hits we've already applied (to avoid double-hit)
  const hitTrackRef = useRef<Set<string>>(new Set());

  // Keep refs in sync
  useEffect(() => { localPlayerRef.current = localPlayer; }, [localPlayer]);
  useEffect(() => { remotePlayersRef.current = remotePlayers; }, [remotePlayers]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { countdownTextRef.current = countdownText; }, [countdownText]);

  // Initialize multiplayer
  useEffect(() => {
    mpRef.current = new MultiplayerManager();
    return () => {
      mpRef.current?.disconnect();
      if (broadcastIntervalRef.current) clearInterval(broadcastIntervalRef.current);
    };
  }, []);

  // Multiplayer listeners setup
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
        [payload.senderId]: { ...(prev[payload.senderId] || createPlayer(payload.senderId, 'Player')), character: char },
      }));
      setTakenCharacters(prev => new Set([...prev, char]));
    });

    mp.on('player_ready', (payload: BroadcastPayload) => {
      setRemoteReady(prev => new Set([...prev, payload.senderId]));
    });

    mp.on('start_game', (payload: BroadcastPayload) => {
      const startTime = payload.data.startTime as number;
      startCountdown(startTime);
    });

    mp.on('player_update', (payload: BroadcastPayload) => {
      const data = payload.data as Partial<PlayerState>;
      setRemotePlayers(prev => {
        const existing = prev[payload.senderId] || createPlayer(payload.senderId, data.name as string || 'Player');
        return {
          ...prev,
          [payload.senderId]: { ...existing, ...data, id: payload.senderId } as PlayerState,
        };
      });
    });

    mp.on('fight_update', (payload: BroadcastPayload) => {
      const data = payload.data;
      setRemotePlayers(prev => {
        const existing = prev[payload.senderId] || createPlayer(payload.senderId, data.name as string || 'Player');
        const fight: FightState = {
          ...existing.fight,
          fx: data.fx as number,
          fy: data.fy as number,
          fvx: data.fvx as number,
          fvy: data.fvy as number,
          hp: data.hp as number,
          facing: data.facing as 1 | -1,
          grounded: data.grounded as boolean,
          punching: data.punching as boolean,
          punchTimer: data.punchTimer as number,
          specialActive: data.specialActive as boolean,
          specialTimer: data.specialTimer as number,
          blockTimer: data.blockTimer as number,
          freezeTimer: data.freezeTimer as number,
          hitStunTimer: data.hitStunTimer as number,
          dashActive: data.dashActive as boolean,
          dashTimer: data.dashTimer as number,
          dead: data.dead as boolean,
          invulnTimer: data.invulnTimer as number,
        };
        return {
          ...prev,
          [payload.senderId]: { ...existing, character: data.character as CharacterId, name: data.name as string || existing.name, fight },
        };
      });
    });

    mp.on('fight_hit', (payload: BroadcastPayload) => {
      const targetId = payload.data.targetId as string;
      const damage = payload.data.damage as number;
      const freeze = payload.data.freeze as boolean;

      // If we are the target, apply damage
      const mp2 = mpRef.current;
      if (mp2 && targetId === mp2.getPlayerId()) {
        setLocalPlayer(prev => {
          if (!prev) return prev;
          const engine = engineRef.current;
          const newFight = engine.applyFightDamage(prev.fight, damage, 0, freeze);
          // Add hit particles
          engine.addFightParticles(prev.fight.fx, prev.fight.fy - 30, '#FF4444', 10);
          return { ...prev, fight: newFight };
        });
      }
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
      if (rp && rp.character) {
        setRaceResults(prev => {
          if (prev.find(r => r.name === rp.name)) return prev;
          return [...prev, { name: rp.name, character: rp.character!, time }];
        });
      }
    });

    mp.on('battle_finish', (_payload: BroadcastPayload) => {
      // Not used in fighting mode, kept for compat
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleIncomingAttack = (payload: BroadcastPayload) => {
    const attackChar = payload.data.character as CharacterId;
    const lp = localPlayerRef.current;
    if (!lp) return;

    if (attackChar === 'lion') {
      if (lp.shielded) {
        setLocalPlayer(prev => prev ? { ...prev, shielded: false } : prev);
      } else {
        setLocalPlayer(prev => prev ? {
          ...prev,
          hitStun: TRACK.HIT_STUN_DURATION,
          x: Math.max(0.1, Math.min(0.9, prev.x + (Math.random() > 0.5 ? 0.15 : -0.15)))
        } : prev);
        engineRef.current.addShake(10);
      }
    } else if (attackChar === 'wolf') {
      if (lp.shielded) {
        setLocalPlayer(prev => prev ? { ...prev, shielded: false } : prev);
      } else {
        setLocalPlayer(prev => prev ? { ...prev, frozen: true } : prev);
        setTimeout(() => {
          setLocalPlayer(prev => prev ? { ...prev, frozen: false } : prev);
        }, TRACK.FREEZE_DURATION);
      }
    }
  };

  const requestTiltPermission = async () => {
    const DOE = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
    if (typeof DOE.requestPermission === 'function') {
      try {
        const perm = await DOE.requestPermission();
        if (perm === 'granted') {
          setTiltPermission(true);
          return true;
        }
      } catch {
        return false;
      }
    } else {
      setTiltPermission(true);
      return true;
    }
    return false;
  };

  // Accelerometer listener
  useEffect(() => {
    if (!tiltPermission) return;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma !== null) {
        const raw = e.gamma / 25;
        const deadZone = 0.05;
        const val = Math.abs(raw) < deadZone ? 0 : raw;
        tiltXRef.current = Math.max(-1, Math.min(1, val));
      }
    };

    window.addEventListener('deviceorientation', handleOrientation);
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, [tiltPermission]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keysDownRef.current.add(key);

      if (key === 'w' || key === 'arrowup') {
        e.preventDefault();
        if (phaseRef.current === 'battle') {
          fightJumpRef.current = true;
        } else {
          boostActiveRef.current = true;
        }
      }
      if (key === ' ' || key === 'space') {
        e.preventDefault();
        if (phaseRef.current === 'battle') {
          fightJumpRef.current = true;
        } else {
          jumpActiveRef.current = true;
        }
      }
      // Fight controls
      if (key === 'f') {
        e.preventDefault();
        if (phaseRef.current === 'battle') {
          fightPunchRef.current = true;
        } else {
          attackActiveRef.current = true;
        }
      }
      if (key === 'g') {
        e.preventDefault();
        if (phaseRef.current === 'battle') {
          fightSpecialRef.current = true;
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keysDownRef.current.delete(key);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Touch controls
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (touch) {
      touchStartXRef.current = touch.clientX;
      touchCurrentXRef.current = touch.clientX;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const touch = e.touches[0];
    if (touch) {
      touchCurrentXRef.current = touch.clientX;
      const dx = touch.clientX - touchStartXRef.current;
      if (!tiltPermission) {
        tiltXRef.current = Math.max(-1, Math.min(1, dx / 60));
      }
    }
  }, [tiltPermission]);

  const handleTouchEnd = useCallback(() => {
    touchStartXRef.current = null;
    touchCurrentXRef.current = null;
    if (!tiltPermission) {
      tiltXRef.current = 0;
    }
  }, [tiltPermission]);

  // Game loop
  const gameLoop = useCallback((timestamp: number) => {
    if (!canvasRef.current || !localPlayerRef.current) {
      animFrameRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    const dt = lastTimeRef.current ? Math.min(timestamp - lastTimeRef.current, 50) : 16;
    lastTimeRef.current = timestamp;
    const now = Date.now();

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const engine = engineRef.current;
    let player = localPlayerRef.current;
    const currentPhase = phaseRef.current;
    const isBattle = currentPhase === 'battle';
    const isRacing = currentPhase === 'racing';

    // Keyboard steering (A/D or ArrowLeft/ArrowRight)
    const keys = keysDownRef.current;

    if (isBattle) {
      // === FIGHTING GAME LOGIC ===

      // Movement input
      if (keys.has('a') || keys.has('arrowleft')) {
        fightMoveXRef.current = -1;
      } else if (keys.has('d') || keys.has('arrowright')) {
        fightMoveXRef.current = 1;
      } else {
        fightMoveXRef.current = 0;
      }

      // Mobile tilt for movement in fight mode
      if (tiltPermission && Math.abs(tiltXRef.current) > 0.2) {
        fightMoveXRef.current = tiltXRef.current > 0 ? 1 : -1;
      }

      if (!fightOverRef.current && countdownTextRef.current === null) {
        // Update fight timer
        if (fightStartTimeRef.current > 0) {
          const elapsed = now - fightStartTimeRef.current;
          const remaining = Math.max(0, ARENA.FIGHT_DURATION - elapsed);
          fightTimerRef.current = remaining;
          setFightTimer(remaining);

          if (remaining <= 0) {
            // Time's up! Most HP wins
            fightOverRef.current = true;
            endFight();
          }
        }

        // Update local fighter
        if (player.character && !player.fight.dead) {
          const newFight = engine.updateFighter(
            player.fight,
            dt,
            fightMoveXRef.current,
            fightJumpRef.current,
            fightPunchRef.current,
            fightSpecialRef.current,
            player.character
          );

          // Clear one-shot inputs
          fightJumpRef.current = false;
          fightPunchRef.current = false;
          fightSpecialRef.current = false;

          // Check hits against remote players
          const remotes = Object.entries(remotePlayersRef.current);
          for (const [remoteId, remote] of remotes) {
            if (!remote.character || remote.fight.dead) continue;

            const hitResult = engine.checkFightHit(newFight, player.character, remote.fight);
            const hitKey = `${player.id}-${remoteId}-${newFight.punching ? 'p' : 's'}-${Math.floor(now / 300)}`;

            if (hitResult && !hitTrackRef.current.has(hitKey)) {
              hitTrackRef.current.add(hitKey);
              // Broadcast the hit
              mpRef.current?.broadcastFightHit(remoteId, hitResult.damage, hitResult.freeze || false);
              // Add hit particles
              engine.addFightParticles(remote.fight.fx, remote.fight.fy - 30, CHARACTERS[player.character].color, 12);

              // Clean up old hit tracking
              if (hitTrackRef.current.size > 100) {
                const arr = Array.from(hitTrackRef.current);
                hitTrackRef.current = new Set(arr.slice(-50));
              }
            }
          }

          // Also check single-player mode: if we have the remote fight state locally, apply damage ourselves
          // (for the case where we're host and there's an AI or local sim)

          // Check if player died
          if (newFight.dead) {
            fightOverRef.current = true;
            endFight();
          }

          player = { ...player, fight: newFight };
          setLocalPlayer(player);
        }

        // Check if any remote player died
        const anyRemoteDead = Object.values(remotePlayersRef.current).some(p => p.fight?.dead);
        if (anyRemoteDead && !fightOverRef.current) {
          fightOverRef.current = true;
          setTimeout(() => endFight(), 1000);
        }
      }

      // Update particles
      engine.updateParticles(dt);

      // Render fight
      const otherPlayers = Object.values(remotePlayersRef.current);
      renderFightGame(ctx, canvas, engine, player, otherPlayers, fightTimerRef.current, countdownTextRef.current);

    } else if (isRacing) {
      // === RACING LOGIC (unchanged) ===

      if (keys.has('a') || keys.has('arrowleft')) {
        tiltXRef.current = -1;
      } else if (keys.has('d') || keys.has('arrowright')) {
        tiltXRef.current = 1;
      } else if (!tiltPermission && touchStartXRef.current === null) {
        tiltXRef.current = 0;
      }

      if (!player.finished) {
        // Handle boost
        if (boostActiveRef.current && boostCooldownRef.current <= 0) {
          player = { ...player, boosting: true };
          boostCooldownRef.current = TRACK.BOOST_COOLDOWN;
          setTimeout(() => {
            setLocalPlayer(prev => prev ? { ...prev, boosting: false } : prev);
          }, TRACK.BOOST_DURATION);
          const charDef = player.character ? CHARACTERS[player.character] : null;
          if (charDef) {
            engine.addParticles(player.x * TRACK.WIDTH, TRACK.VISIBLE_HEIGHT * 0.65, charDef.color, 12);
          }
          engine.addShake(6);
          engine.soundFX.boost();
          boostActiveRef.current = false;
        }
        boostCooldownRef.current = Math.max(0, boostCooldownRef.current - dt);

        // Handle jump
        if (jumpActiveRef.current && jumpCooldownRef.current <= 0) {
          player = { ...player, jumping: true };
          jumpCooldownRef.current = TRACK.JUMP_COOLDOWN;
          setTimeout(() => {
            setLocalPlayer(prev => prev ? { ...prev, jumping: false } : prev);
          }, TRACK.JUMP_DURATION);
          engine.soundFX.jump();
          engine.addParticles(player.x * TRACK.WIDTH, TRACK.VISIBLE_HEIGHT * 0.65, '#ffffff', 6);
          jumpActiveRef.current = false;
        }
        jumpCooldownRef.current = Math.max(0, jumpCooldownRef.current - dt);

        // Boost trail
        if (player.boosting && player.character) {
          const charDef = CHARACTERS[player.character];
          engine.addTrailParticle(player.x * TRACK.WIDTH, TRACK.VISIBLE_HEIGHT * 0.65, charDef.color);
        }

        // Update physics
        player = engine.updatePlayer(player, dt, tiltXRef.current, player.boosting, player.jumping, false, now);

        // Check finish
        if (player.finished) {
          mpRef.current?.broadcastRaceFinish(player.finishTime);
          setRaceResults(prev => {
            if (prev.find(r => r.name === player.name)) return prev;
            return [...prev, { name: player.name, character: player.character!, time: player.finishTime }];
          });
          setShowFinished(true);
          setTimeout(() => setShowFinished(false), 2000);
        }

        setLocalPlayer(player);
      }

      engine.updateParticles(dt);

      const otherPlayers = Object.values(remotePlayersRef.current);
      renderGame(ctx, canvas, engine, player, otherPlayers, false, countdownTextRef.current);

    } else {
      // Countdown phase - just render
      engine.updateParticles(dt);
      const otherPlayers = Object.values(remotePlayersRef.current);
      renderGame(ctx, canvas, engine, player, otherPlayers, false, countdownTextRef.current);
    }

    animFrameRef.current = requestAnimationFrame(gameLoop);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const endFight = () => {
    const lp = localPlayerRef.current;
    if (!lp) return;

    const allPlayers = [lp, ...Object.values(remotePlayersRef.current)].filter(p => p.character);
    const results = allPlayers
      .map(p => ({
        name: p.name,
        character: p.character!,
        hp: p.fight?.hp ?? 0,
      }))
      .sort((a, b) => b.hp - a.hp);

    setBattleResults(results);

    if (results.length > 0) {
      setFightWinner(results[0].name);
    }

    setTimeout(() => {
      setPhase('results');
    }, 2000);
  };

  // Start/stop game loop
  useEffect(() => {
    if (phase === 'racing' || phase === 'battle' || phase === 'countdown') {
      lastTimeRef.current = 0;
      animFrameRef.current = requestAnimationFrame(gameLoop);
      return () => cancelAnimationFrame(animFrameRef.current);
    }
  }, [phase, gameLoop]);

  // Broadcast position at 10Hz during racing
  useEffect(() => {
    if (phase === 'racing') {
      broadcastIntervalRef.current = setInterval(() => {
        if (localPlayerRef.current) {
          mpRef.current?.broadcastPosition(localPlayerRef.current);
        }
      }, 100);
      return () => {
        if (broadcastIntervalRef.current) clearInterval(broadcastIntervalRef.current);
      };
    } else if (phase === 'battle') {
      broadcastIntervalRef.current = setInterval(() => {
        if (localPlayerRef.current) {
          mpRef.current?.broadcastFightState(localPlayerRef.current);
        }
      }, 100);
      return () => {
        if (broadcastIntervalRef.current) clearInterval(broadcastIntervalRef.current);
      };
    }
  }, [phase]);

  // Auto-transition from race to battle (fighting game) when all finished
  useEffect(() => {
    if (phase !== 'racing' || !localPlayer?.finished) return;

    const totalPlayers = 1 + Object.keys(remotePlayers).length;
    const allFinished = Object.values(remotePlayers).every(p => p.finished) || raceResults.length >= totalPlayers;

    if (allFinished && !battleTransition) {
      setBattleTransition(true);
      setTimeout(() => {
        if (isHost) {
          mpRef.current?.broadcastPhaseChange('battle');
        }
        startBattlePhase();
      }, 2500);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, localPlayer, remotePlayers, raceResults, isHost, battleTransition]);

  const startBattlePhase = () => {
    setBattleTransition(false);
    setShowFinished(false);
    fightOverRef.current = false;
    hitTrackRef.current.clear();
    setFightWinner(null);
    setBattleResults([]);

    const engine = engineRef.current;

    // Initialize fight states
    const allPlayerIds = [mpRef.current?.getPlayerId() || '', ...Object.keys(remotePlayersRef.current)];
    const totalPlayers = allPlayerIds.length;
    const localIdx = 0;

    setLocalPlayer(prev => {
      if (!prev) return prev;
      const fightState = engine.initFightState(localIdx, totalPlayers);
      return {
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
        fight: fightState,
      };
    });

    // Initialize remote players fight states
    setRemotePlayers(prev => {
      const updated = { ...prev };
      let idx = 1;
      for (const id of Object.keys(updated)) {
        const fightState = engine.initFightState(idx, totalPlayers);
        updated[id] = {
          ...updated[id],
          fight: fightState,
        };
        idx++;
      }
      return updated;
    });

    fightTimerRef.current = ARENA.FIGHT_DURATION;
    setFightTimer(ARENA.FIGHT_DURATION);
    engine.particles = [];
    engine.screenShake = 0;

    setCountdownText('⚔️ FIGHT!');
    setPhase('battle');

    setTimeout(() => {
      engineRef.current.soundFX.countdown();
      setCountdownText('3');
    }, 1000);
    setTimeout(() => {
      engineRef.current.soundFX.countdown();
      setCountdownText('2');
    }, 2000);
    setTimeout(() => {
      engineRef.current.soundFX.countdown();
      setCountdownText('1');
    }, 3000);
    setTimeout(() => {
      engineRef.current.soundFX.go();
      setCountdownText('GO!');
      fightStartTimeRef.current = Date.now();
      setTimeout(() => setCountdownText(null), 500);
    }, 4000);
  };

  const startCountdown = (startTime: number) => {
    const delay = Math.max(startTime - Date.now(), 100);

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
      fight: createDefaultFightState(),
    } : prev);

    engineRef.current.resetTrack(42);
    setRaceResults([]);
    setBattleResults([]);
    setShowFinished(false);
    setBattleTransition(false);
    fightOverRef.current = false;
    setFightWinner(null);

    setCountdownText('GET READY!');
    setPhase('countdown');

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
      <div className="min-h-screen bg-gradient-to-b from-green-800 via-green-600 to-emerald-500 flex flex-col items-center justify-center p-4 text-white overflow-y-auto"
        style={{ minHeight: '100dvh' }}>
        <div className="text-7xl mb-3 animate-bounce">🏎️</div>
        <h1 className="text-5xl font-extrabold mb-1 tracking-tight" style={{ textShadow: '3px 3px 0 #000' }}>
          ANIMAL
        </h1>
        <h1 className="text-5xl font-extrabold mb-4 tracking-tight" style={{ textShadow: '3px 3px 0 #000' }}>
          RACERS
        </h1>
        <div className="flex gap-6 text-5xl mb-6">
          <span className="animate-pulse">🦁</span>
          <span className="animate-pulse" style={{ animationDelay: '0.2s' }}>🐺</span>
          <span className="animate-pulse" style={{ animationDelay: '0.4s' }}>🦄</span>
        </div>

        <input
          type="text"
          placeholder="Your Name"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value.slice(0, 10))}
          className="w-72 p-4 mb-4 rounded-2xl text-center text-xl font-bold bg-white/20 backdrop-blur border-2 border-white/40 text-white placeholder-white/50 outline-none focus:border-yellow-300"
          style={{ fontSize: '20px' }}
          maxLength={10}
          autoComplete="off"
        />

        <button
          onClick={async () => {
            if (!playerName.trim()) return;
            await requestTiltPermission();
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
          className="w-72 p-4 mb-3 rounded-2xl text-xl font-bold bg-yellow-400 text-yellow-900 shadow-lg active:scale-95 transition-transform disabled:opacity-50"
        >
          🏠 Create Room
        </button>

        <div className="flex items-center gap-2 w-72">
          <input
            type="text"
            placeholder="Code"
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
            className="flex-1 p-4 rounded-2xl text-center text-xl font-bold bg-white/20 backdrop-blur border-2 border-white/40 text-white placeholder-white/50 outline-none focus:border-yellow-300"
            style={{ fontSize: '20px' }}
            maxLength={4}
            inputMode="numeric"
            autoComplete="off"
          />
          <button
            onClick={async () => {
              if (!playerName.trim() || inputCode.length !== 4) return;
              await requestTiltPermission();
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
      <div className="min-h-screen bg-gradient-to-b from-purple-900 via-purple-700 to-indigo-600 flex flex-col items-center p-4 text-white overflow-y-auto"
        style={{ minHeight: '100dvh' }}>
        <div className="text-sm font-mono bg-black/30 px-3 py-1 rounded-full mb-3">
          Room: <span className="font-bold text-yellow-300 text-lg">{roomCode}</span>
        </div>
        <h2 className="text-3xl font-extrabold mb-4" style={{ textShadow: '2px 2px 0 #000' }}>
          Choose Your Racer!
        </h2>
        <div className="space-y-3 w-full max-w-sm">
          {allChars.map(charId => {
            const char = CHARACTERS[charId];
            const taken = takenCharacters.has(charId) && localPlayer?.character !== charId;
            const selected = localPlayer?.character === charId;
            return (
              <button
                key={charId}
                onClick={() => {
                  if (taken || selected) return;
                  if (localPlayer?.character) {
                    setTakenCharacters(prev => {
                      const next = new Set(prev);
                      next.delete(localPlayer.character!);
                      return next;
                    });
                  }
                  setLocalPlayer(prev => prev ? { ...prev, character: charId } : prev);
                  setTakenCharacters(prev => new Set([...prev, charId]));
                  mpRef.current?.broadcastCharacterPick(charId);
                }}
                disabled={taken}
                className={`w-full p-4 rounded-2xl flex items-center gap-4 transition-all ${
                  selected
                    ? 'bg-yellow-400 text-yellow-900 scale-105 shadow-xl ring-4 ring-yellow-200'
                    : taken
                    ? 'bg-gray-600/50 text-gray-400 opacity-60'
                    : 'bg-white/15 backdrop-blur active:scale-95 border-2 border-white/20'
                }`}
              >
                <span className="text-5xl">{char.emoji}</span>
                <div className="text-left flex-1">
                  <div className="text-xl font-bold">{char.name}</div>
                  <div className="text-sm opacity-80">🥊 {char.punchName} ({char.punchDamage} dmg)</div>
                  <div className="text-sm opacity-80">⚡ {char.specialName}: {char.attackDesc}</div>
                </div>
                {selected && <span className="text-2xl">✅</span>}
                {taken && <span className="text-xl">🔒</span>}
              </button>
            );
          })}
        </div>
        {localPlayer?.character && (
          <button
            onClick={() => setPhase('waiting')}
            className="mt-4 w-72 p-4 rounded-2xl text-xl font-bold bg-green-400 text-green-900 shadow-lg active:scale-95 transition-transform animate-pulse"
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
      { id: localPlayer?.id || '', name: localPlayer?.name || '', character: localPlayer?.character || null, ready: localPlayer?.ready || false },
      ...Object.values(remotePlayers).map(p => ({
        id: p.id,
        name: p.name,
        character: p.character,
        ready: remoteReady.has(p.id),
      })),
    ];
    const allReady = allPlayers.every(p => p.ready || (p.id === localPlayer?.id && localPlayer?.ready));
    const canStart = isHost && allReady && allPlayers.length >= 1;

    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-700 via-orange-500 to-yellow-400 flex flex-col items-center p-4 text-white overflow-y-auto"
        style={{ minHeight: '100dvh' }}>
        <div className="bg-black/30 px-6 py-3 rounded-2xl mb-4 text-center">
          <div className="text-xs opacity-70 mb-1">Room Code</div>
          <div className="text-4xl font-mono font-bold tracking-widest text-yellow-200">{roomCode}</div>
        </div>
        <p className="text-sm mb-4 opacity-80">Share this code!</p>

        <h2 className="text-2xl font-bold mb-3">Players ({allPlayers.length}/3)</h2>

        <div className="space-y-3 w-full max-w-sm mb-6">
          {allPlayers.map((p, i) => {
            const charDef = p.character ? CHARACTERS[p.character] : null;
            const isReady = p.ready || (p.id === localPlayer?.id && localPlayer?.ready);
            return (
              <div key={i} className={`flex items-center gap-3 rounded-2xl p-4 ${isReady ? 'bg-green-500/30 border-2 border-green-300/50' : 'bg-white/20'}`}>
                <span className="text-4xl">{charDef?.emoji || '❓'}</span>
                <div className="flex-1">
                  <div className="font-bold text-lg">{p.name} {p.id === localPlayer?.id ? '(You)' : ''}</div>
                  <div className="text-sm opacity-80">{charDef?.name || 'No character'}</div>
                </div>
                {isReady && <span className="text-3xl">✅</span>}
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
            className="w-72 p-4 rounded-2xl text-xl font-bold bg-green-400 text-green-900 shadow-lg active:scale-95 transition-transform"
          >
            ✋ Ready!
          </button>
        ) : !canStart ? (
          <div className="text-lg font-bold text-green-200 animate-pulse">
            Waiting for others...
          </div>
        ) : null}

        {canStart && (
          <button
            onClick={() => {
              const startTime = Date.now() + 4000;
              mpRef.current?.broadcastStartGame();
              startCountdown(startTime);
            }}
            className="mt-3 w-72 p-5 rounded-2xl text-2xl font-bold bg-red-500 text-white shadow-lg active:scale-95 transition-transform animate-bounce"
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
    const sortedBattle = [...battleResults].sort((a, b) => b.hp - a.hp);

    return (
      <div className="min-h-screen bg-gradient-to-b from-yellow-600 via-amber-500 to-orange-500 flex flex-col items-center p-4 text-white overflow-y-auto"
        style={{ minHeight: '100dvh' }}>
        <div className="text-7xl mb-2 animate-bounce">🏆</div>
        <h1 className="text-4xl font-extrabold mb-4" style={{ textShadow: '2px 2px 0 #000' }}>
          RESULTS!
        </h1>

        {/* Race Results */}
        {sortedRace.length > 0 && (
          <div className="w-full max-w-sm mb-4">
            <h3 className="text-xl font-bold mb-2 text-center">🏁 Race</h3>
            <div className="space-y-2">
              {sortedRace.map((r, i) => {
                const charDef = CHARACTERS[r.character];
                const medals = ['🥇', '🥈', '🥉'];
                return (
                  <div key={i} className={`flex items-center gap-3 p-3 rounded-xl ${i === 0 ? 'bg-yellow-300/40 ring-2 ring-yellow-200' : 'bg-white/15'}`}>
                    <span className="text-3xl">{medals[i] || ''}</span>
                    <span className="text-3xl">{charDef.emoji}</span>
                    <div className="flex-1 font-bold text-lg">{r.name}</div>
                    {i === 0 && <span className="text-3xl">🏆</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Battle (Fighting) Results */}
        {sortedBattle.length > 0 && (
          <div className="w-full max-w-sm mb-4">
            <h3 className="text-xl font-bold mb-2 text-center">⚔️ Fight</h3>
            <div className="space-y-2">
              {sortedBattle.map((r, i) => {
                const charDef = CHARACTERS[r.character];
                const medals = ['🥇', '🥈', '🥉'];
                return (
                  <div key={i} className={`flex items-center gap-3 p-3 rounded-xl ${i === 0 ? 'bg-purple-300/40 ring-2 ring-purple-200' : 'bg-white/15'}`}>
                    <span className="text-3xl">{medals[i] || ''}</span>
                    <span className="text-3xl">{charDef.emoji}</span>
                    <div className="flex-1">
                      <div className="font-bold text-lg">{r.name}</div>
                      <div className="text-sm opacity-80">{r.hp} HP remaining</div>
                    </div>
                    {i === 0 && <span className="text-3xl">🏆✨</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {fightWinner && (
          <div className="text-2xl font-bold text-yellow-200 mb-3 animate-pulse">
            🎉 {fightWinner} wins the fight!
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
            setShowFinished(false);
            setFightWinner(null);
            fightOverRef.current = false;
            mpRef.current?.disconnect();
          }}
          className="mt-2 w-72 p-4 rounded-2xl text-xl font-bold bg-white/20 backdrop-blur border-2 border-white/40 active:scale-95 transition-transform"
        >
          🏠 Play Again
        </button>
      </div>
    );
  }

  // RACING / BATTLE / COUNTDOWN — Canvas view with controls
  return (
    <div
      className="fixed inset-0 bg-black select-none"
      style={{ touchAction: 'none' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <canvas ref={canvasRef} className="block mx-auto" />

      {/* Control buttons overlay */}
      {phase === 'racing' && (
        <>
          {/* Boost button - left */}
          <button
            onTouchStart={(e) => {
              e.stopPropagation();
              e.preventDefault();
              boostActiveRef.current = true;
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              boostActiveRef.current = true;
            }}
            className="fixed bottom-6 left-4 w-24 h-24 rounded-full flex items-center justify-center text-4xl shadow-2xl active:scale-90 transition-transform bg-orange-500/90 text-white border-4 border-orange-300"
            style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'none' }}
          >
            🔥
          </button>

          {/* Jump button - right */}
          <button
            onTouchStart={(e) => {
              e.stopPropagation();
              e.preventDefault();
              jumpActiveRef.current = true;
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              jumpActiveRef.current = true;
            }}
            className="fixed bottom-6 right-4 w-24 h-24 rounded-full flex items-center justify-center text-4xl shadow-2xl active:scale-90 transition-transform bg-blue-500/90 text-white border-4 border-blue-300"
            style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'none' }}
          >
            ⬆️
          </button>

          <div className="fixed bottom-1 left-4 w-24 text-center text-xs text-white/60 font-bold">
            BOOST (W)
          </div>
          <div className="fixed bottom-1 right-4 w-24 text-center text-xs text-white/60 font-bold">
            JUMP (SPACE)
          </div>

          {/* Steer hint */}
          <div className="fixed top-16 left-1/2 -translate-x-1/2 bg-white/20 backdrop-blur px-3 py-1 rounded-full text-white text-xs">
            {tiltPermission ? '📱 Tilt to steer' : '← A/D or Arrow Keys to steer →'}
          </div>

          {/* Finished overlay */}
          {showFinished && (
            <div className="fixed top-1/3 left-1/2 -translate-x-1/2 bg-green-500/90 backdrop-blur px-8 py-4 rounded-2xl text-white font-bold text-2xl shadow-xl animate-bounce">
              🏁 FINISHED! 🏁
            </div>
          )}
        </>
      )}

      {/* BATTLE (Fighting Game) Controls */}
      {phase === 'battle' && (
        <>
          {/* D-pad: Left */}
          <button
            onTouchStart={(e) => {
              e.stopPropagation();
              e.preventDefault();
              fightMoveXRef.current = -1;
            }}
            onTouchEnd={(e) => {
              e.stopPropagation();
              fightMoveXRef.current = 0;
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              fightMoveXRef.current = -1;
            }}
            onMouseUp={() => fightMoveXRef.current = 0}
            className="fixed bottom-28 left-4 w-16 h-16 rounded-xl flex items-center justify-center text-2xl shadow-2xl active:scale-90 transition-transform bg-gray-700/90 text-white border-2 border-gray-500"
            style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'none' }}
          >
            ◀
          </button>

          {/* D-pad: Right */}
          <button
            onTouchStart={(e) => {
              e.stopPropagation();
              e.preventDefault();
              fightMoveXRef.current = 1;
            }}
            onTouchEnd={(e) => {
              e.stopPropagation();
              fightMoveXRef.current = 0;
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              fightMoveXRef.current = 1;
            }}
            onMouseUp={() => fightMoveXRef.current = 0}
            className="fixed bottom-28 left-24 w-16 h-16 rounded-xl flex items-center justify-center text-2xl shadow-2xl active:scale-90 transition-transform bg-gray-700/90 text-white border-2 border-gray-500"
            style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'none' }}
          >
            ▶
          </button>

          {/* Jump button */}
          <button
            onTouchStart={(e) => {
              e.stopPropagation();
              e.preventDefault();
              fightJumpRef.current = true;
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              fightJumpRef.current = true;
            }}
            className="fixed bottom-48 left-12 w-16 h-16 rounded-xl flex items-center justify-center text-2xl shadow-2xl active:scale-90 transition-transform bg-blue-600/90 text-white border-2 border-blue-400"
            style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'none' }}
          >
            ▲
          </button>

          {/* Punch button */}
          <button
            onTouchStart={(e) => {
              e.stopPropagation();
              e.preventDefault();
              fightPunchRef.current = true;
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              fightPunchRef.current = true;
            }}
            className="fixed bottom-28 right-4 w-20 h-20 rounded-full flex items-center justify-center text-3xl shadow-2xl active:scale-90 transition-transform bg-red-600/90 text-white border-4 border-red-400"
            style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'none' }}
          >
            👊
          </button>

          {/* Special button */}
          <button
            onTouchStart={(e) => {
              e.stopPropagation();
              e.preventDefault();
              fightSpecialRef.current = true;
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              fightSpecialRef.current = true;
            }}
            className="fixed bottom-6 right-4 w-20 h-20 rounded-full flex items-center justify-center text-3xl shadow-2xl active:scale-90 transition-transform bg-yellow-500/90 text-white border-4 border-yellow-300"
            style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'none' }}
          >
            ⚡
          </button>

          {/* Labels */}
          <div className="fixed bottom-24 left-12 w-20 text-center text-xs text-white/50 font-bold">
            MOVE
          </div>
          <div className="fixed bottom-44 left-8 w-24 text-center text-xs text-white/50 font-bold">
            JUMP (W)
          </div>
          <div className="fixed bottom-24 right-0 w-28 text-center text-xs text-white/50 font-bold">
            PUNCH (F)
          </div>
          <div className="fixed bottom-2 right-0 w-28 text-center text-xs text-white/50 font-bold">
            SPECIAL (G)
          </div>

          {/* Fight mode indicator */}
          <div className="fixed top-[74px] left-1/2 -translate-x-1/2 bg-white/15 backdrop-blur px-3 py-1 rounded-full text-white text-xs">
            A/D: Move • W: Jump • F: Punch • G: Special
          </div>

          {/* KO overlay */}
          {fightWinner && (
            <div className="fixed top-1/3 left-1/2 -translate-x-1/2 bg-red-600/90 backdrop-blur px-8 py-4 rounded-2xl text-white font-bold text-3xl shadow-xl animate-bounce">
              💥 K.O.! 💥
            </div>
          )}
        </>
      )}
    </div>
  );
}
