'use client';

import Image from 'next/image';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { CHARACTER_ART, primeGameAssets } from '@/lib/assets';
import {
  chooseCpuCharacter,
  CPU_PLAYER_ID,
  CPU_PLAYER_NAME,
  createCpuRaceState,
  getCpuFightInputs,
  stepCpuRaceState,
} from '@/lib/cpu';
import { GameEngine } from '@/lib/engine';
import { MultiplayerManager } from '@/lib/multiplayer';
import { renderFightGame, renderGame } from '@/lib/renderer';
import {
  ARENA,
  CHARACTERS,
  CanonicalFightResult,
  CanonicalRaceResult,
  CharacterId,
  FightDamageAppliedMessage,
  FightHitReportMessage,
  FightState,
  FightSyncState,
  GamePhase,
  NetworkPhase,
  PhaseStartMessage,
  PlayerState,
  ProtocolMessage,
  RoomPlayer,
  RoomState,
  TRACK,
  createDefaultFightState,
  toFightSyncState,
  toRaceSyncState,
} from '@/lib/types';
import {
  applyCharacterPick,
  applyJoinRequest,
  applyRaceFinish,
  applyReadyState,
  buildFightResults,
  canStartRace,
  cloneRoomState,
  createRoomState,
  getGuestPlayerIds,
  haveAllPlayersFinishedRace,
  shouldAcceptFightHit,
  syncConnectedPlayers,
} from '@/lib/session';

const RACE_COUNTDOWN_MS = 3000;
const BATTLE_COUNTDOWN_MS = 3000;
const PHASE_START_DELAY_MS = 250;
const JOIN_REQUEST_TIMEOUT_MS = 4000;
const BETWEEN_PHASE_DELAY_MS = 1500;

interface PendingPhaseStart {
  phase: NetworkPhase;
  phaseSeq: number;
  countdownMs: number;
  awaitingIds: Set<string>;
}

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

function syncStablePlayerState(player: PlayerState, roomPlayer: RoomPlayer): PlayerState {
  return {
    ...player,
    id: roomPlayer.id,
    name: roomPlayer.name,
    character: roomPlayer.character,
    ready: roomPlayer.ready,
  };
}

function resetRacePlayer(player: PlayerState): PlayerState {
  return {
    ...player,
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
    fight: createDefaultFightState(),
  };
}

function resetFightPlayer(player: PlayerState, fight: FightState): PlayerState {
  return {
    ...player,
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
    fight,
  };
}

function applyFightSyncState(existing: FightState, state: FightSyncState): FightState {
  return {
    ...existing,
    ...state,
    maxHp: existing.maxHp,
  };
}

function formatElapsed(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}

function makeEventId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Math.floor(performance.now())}`;
}

function CharacterArtwork({
  characterId,
  size,
  priority = false,
}: {
  characterId: CharacterId;
  size: number;
  priority?: boolean;
}) {
  const art = CHARACTER_ART[characterId];
  const character = CHARACTERS[characterId];

  return (
    <div
      className="relative overflow-hidden rounded-[22px] border"
      style={{
        width: size,
        height: size,
        borderColor: `${art.accent}66`,
        backgroundImage: `radial-gradient(circle at 30% 30%, ${art.glow}55, transparent 68%), linear-gradient(180deg, rgba(19, 35, 29, 0.96), rgba(9, 18, 15, 0.96))`,
        boxShadow: `0 18px 42px ${art.accent}18`,
      }}
    >
      <div className="absolute inset-x-0 top-0 h-1/2 bg-white/5" />
      <Image
        src={art.racer}
        alt={character.name}
        width={size}
        height={size}
        priority={priority}
        className="absolute inset-0 h-full w-full object-contain p-2"
      />
    </div>
  );
}

export default function Game() {
  const [phase, setPhase] = useState<GamePhase>('home');
  const [roomCode, setRoomCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [localPlayer, setLocalPlayer] = useState<PlayerState | null>(null);
  const [remotePlayers, setRemotePlayers] = useState<Record<string, PlayerState>>({});
  const [countdownText, setCountdownText] = useState<string | null>(null);
  const [tiltPermission, setTiltPermission] = useState(false);
  const [showFinished, setShowFinished] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [soloMode, setSoloMode] = useState(false);
  const [artReady, setArtReady] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mpRef = useRef<MultiplayerManager | null>(null);
  const engineRef = useRef<GameEngine>(new GameEngine());
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const tiltXRef = useRef(0);
  const boostActiveRef = useRef(false);
  const jumpActiveRef = useRef(false);
  const boostCooldownRef = useRef(0);
  const jumpCooldownRef = useRef(0);
  const localPlayerRef = useRef<PlayerState | null>(null);
  const remotePlayersRef = useRef<Record<string, PlayerState>>({});
  const roomStateRef = useRef<RoomState | null>(null);
  const phaseRef = useRef<GamePhase>('home');
  const isHostRef = useRef(false);
  const soloModeRef = useRef(false);
  const countdownTextRef = useRef<string | null>(null);
  const broadcastIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const keysDownRef = useRef<Set<string>>(new Set());
  const fightMoveXRef = useRef(0);
  const fightJumpRef = useRef(false);
  const fightPunchRef = useRef(false);
  const fightSpecialRef = useRef(false);
  const fightTimerRef = useRef(ARENA.FIGHT_DURATION);
  const scheduledTimeoutsRef = useRef<number[]>([]);
  const pendingPhaseRef = useRef<PendingPhaseStart | null>(null);
  const currentPhaseSeqRef = useRef(0);
  const raceStartPerfRef = useRef(0);
  const fightStartPerfRef = useRef(0);
  const cpuRaceBrainRef = useRef(createCpuRaceState());
  const transitionQueuedRef = useRef(false);
  const battleResolvedRef = useRef(false);
  const reportedRaceFinishRef = useRef(false);
  const appliedFightHitIdsRef = useRef<Set<string>>(new Set());
  const emittedFightHitIdsRef = useRef<Set<string>>(new Set());
  const handleProtocolMessageRef = useRef<(message: ProtocolMessage) => void>(() => {});
  const handlePresenceSyncRef = useRef<(connectedIds: Set<string>) => void>(() => {});

  useEffect(() => {
    localPlayerRef.current = localPlayer;
  }, [localPlayer]);

  useEffect(() => {
    remotePlayersRef.current = remotePlayers;
  }, [remotePlayers]);

  useEffect(() => {
    roomStateRef.current = roomState;
  }, [roomState]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    countdownTextRef.current = countdownText;
  }, [countdownText]);

  useEffect(() => {
    isHostRef.current = isHost;
  }, [isHost]);

  useEffect(() => {
    soloModeRef.current = soloMode;
  }, [soloMode]);

  useEffect(() => {
    let cancelled = false;

    void primeGameAssets().finally(() => {
      if (!cancelled) {
        setArtReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const clearScheduledTimeouts = useCallback(() => {
    for (const timeoutId of scheduledTimeoutsRef.current) {
      window.clearTimeout(timeoutId);
    }
    scheduledTimeoutsRef.current = [];
  }, []);

  const scheduleTimeout = useCallback((callback: () => void, delayMs: number) => {
    const timeoutId = window.setTimeout(() => {
      scheduledTimeoutsRef.current = scheduledTimeoutsRef.current.filter(id => id !== timeoutId);
      callback();
    }, delayMs);
    scheduledTimeoutsRef.current.push(timeoutId);
    return timeoutId;
  }, []);

  const syncPlayersFromRoom = useCallback((room: RoomState) => {
    const localId = mpRef.current?.getPlayerId();
    if (!localId) return;

    const roomLocalPlayer = room.players[localId];
    if (roomLocalPlayer) {
      setLocalPlayer(prev => {
        const base = prev ?? createPlayer(localId, roomLocalPlayer.name);
        return syncStablePlayerState(base, roomLocalPlayer);
      });
    }

    setRemotePlayers(prev => {
      const next: Record<string, PlayerState> = {};
      for (const roomPlayer of Object.values(room.players)) {
        if (roomPlayer.id === localId) continue;
        const base = prev[roomPlayer.id] ?? createPlayer(roomPlayer.id, roomPlayer.name);
        next[roomPlayer.id] = syncStablePlayerState(base, roomPlayer);
      }
      return next;
    });

    setIsHost(room.hostId === localId);
  }, []);

  const commitRoomState = useCallback(
    (nextRoom: RoomState, broadcastSnapshot: boolean) => {
      roomStateRef.current = nextRoom;
      setRoomState(nextRoom);
      syncPlayersFromRoom(nextRoom);

      if (!broadcastSnapshot) return;

      const mp = mpRef.current;
      if (!mp) return;

      void mp.send({
        type: 'room_snapshot',
        senderId: mp.getPlayerId(),
        room: nextRoom,
      });
    },
    [syncPlayersFromRoom]
  );

  const resetToHome = useCallback(
    async (message?: string) => {
      clearScheduledTimeouts();
      pendingPhaseRef.current = null;
      transitionQueuedRef.current = false;
      battleResolvedRef.current = false;
      reportedRaceFinishRef.current = false;
      appliedFightHitIdsRef.current.clear();
      emittedFightHitIdsRef.current.clear();
      currentPhaseSeqRef.current = 0;
      raceStartPerfRef.current = 0;
      fightStartPerfRef.current = 0;
      cpuRaceBrainRef.current = createCpuRaceState();

      if (broadcastIntervalRef.current) {
        clearInterval(broadcastIntervalRef.current);
        broadcastIntervalRef.current = null;
      }

      cancelAnimationFrame(animFrameRef.current);

      if (mpRef.current) {
        await mpRef.current.disconnect();
      }

      setPhase('home');
      setRoomCode('');
      setInputCode('');
      setIsHost(false);
      isHostRef.current = false;
      setSoloMode(false);
      soloModeRef.current = false;
      setRoomState(null);
      roomStateRef.current = null;
      setLocalPlayer(null);
      localPlayerRef.current = null;
      setRemotePlayers({});
      remotePlayersRef.current = {};
      setCountdownText(null);
      setStatusMessage(null);
      setShowFinished(false);
      fightTimerRef.current = ARENA.FIGHT_DURATION;
      setErrorMessage(message ?? null);
    },
    [clearScheduledTimeouts]
  );

  const requestTiltPermission = async () => {
    const DOE = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
    if (typeof DOE.requestPermission === 'function') {
      try {
        const permission = await DOE.requestPermission();
        if (permission === 'granted') {
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

  const prepareRaceState = useCallback((room: RoomState) => {
    const localId = mpRef.current?.getPlayerId();
    if (!localId) return;

    const engine = engineRef.current;
    engine.resetTrack(42);
    engine.particles = [];
    engine.screenShake = 0;

    reportedRaceFinishRef.current = false;
    transitionQueuedRef.current = false;
    setShowFinished(false);
    raceStartPerfRef.current = 0;
    cpuRaceBrainRef.current = createCpuRaceState();

    const roomLocalPlayer = room.players[localId];
    if (roomLocalPlayer) {
      setLocalPlayer(prev => {
        const base = syncStablePlayerState(prev ?? createPlayer(localId, roomLocalPlayer.name), roomLocalPlayer);
        return resetRacePlayer(base);
      });
    }

    setRemotePlayers(prev => {
      const next: Record<string, PlayerState> = {};
      for (const roomPlayer of Object.values(room.players)) {
        if (roomPlayer.id === localId) continue;
        const base = syncStablePlayerState(prev[roomPlayer.id] ?? createPlayer(roomPlayer.id, roomPlayer.name), roomPlayer);
        next[roomPlayer.id] = resetRacePlayer(base);
      }
      return next;
    });
  }, []);

  const prepareBattleState = useCallback((room: RoomState) => {
    const localId = mpRef.current?.getPlayerId();
    if (!localId) return;

    const engine = engineRef.current;
    const totalPlayers = Object.keys(room.players).length;
    const localIndex = localId === room.hostId ? 0 : 1;

    engine.particles = [];
    engine.screenShake = 0;
    appliedFightHitIdsRef.current.clear();
    emittedFightHitIdsRef.current.clear();
    battleResolvedRef.current = false;
    transitionQueuedRef.current = false;
    fightStartPerfRef.current = 0;
    fightTimerRef.current = ARENA.FIGHT_DURATION;
    setShowFinished(false);

    const roomLocalPlayer = room.players[localId];
    if (roomLocalPlayer) {
      setLocalPlayer(prev => {
        const base = syncStablePlayerState(prev ?? createPlayer(localId, roomLocalPlayer.name), roomLocalPlayer);
        return resetFightPlayer(base, engine.initFightState(localIndex, totalPlayers));
      });
    }

    setRemotePlayers(prev => {
      const next: Record<string, PlayerState> = {};
      let fighterIndex = 0;
      for (const roomPlayer of Object.values(room.players)) {
        if (roomPlayer.id === localId) continue;
        fighterIndex += 1;
        const base = syncStablePlayerState(prev[roomPlayer.id] ?? createPlayer(roomPlayer.id, roomPlayer.name), roomPlayer);
        next[roomPlayer.id] = resetFightPlayer(base, engine.initFightState(fighterIndex, totalPlayers));
      }
      return next;
    });
  }, []);

  const beginLocalPhaseStart = useCallback(
    (message: PhaseStartMessage) => {
      clearScheduledTimeouts();
      currentPhaseSeqRef.current = message.phaseSeq;
      setStatusMessage(null);
      setShowFinished(false);

      const room = roomStateRef.current;
      if (!room) return;

      const countdownSeconds = Math.max(1, Math.ceil(message.countdownMs / 1000));

      if (message.phase === 'racing') {
        prepareRaceState(room);
        setPhase('countdown');
        setCountdownText('GET READY!');
      } else {
        prepareBattleState(room);
        setPhase('battle');
        setCountdownText('⚔️ FIGHT!');
      }

      for (let index = 0; index < countdownSeconds; index += 1) {
        const remaining = countdownSeconds - index;
        scheduleTimeout(() => {
          engineRef.current.soundFX.countdown();
          setCountdownText(String(remaining));
        }, message.startInMs + index * 1000);
      }

      scheduleTimeout(() => {
        engineRef.current.soundFX.go();
        if (message.phase === 'racing') {
          raceStartPerfRef.current = performance.now();
          setPhase('racing');
          setCountdownText('GO! 🏁');
          scheduleTimeout(() => setCountdownText(null), 800);
        } else {
          fightStartPerfRef.current = performance.now();
          fightTimerRef.current = ARENA.FIGHT_DURATION;
          setCountdownText('GO!');
          scheduleTimeout(() => setCountdownText(null), 500);
        }
      }, message.startInMs + message.countdownMs);
    },
    [clearScheduledTimeouts, prepareBattleState, prepareRaceState, scheduleTimeout]
  );

  const startPreparedPhase = useCallback(() => {
    const pending = pendingPhaseRef.current;
    const room = roomStateRef.current;
    const mp = mpRef.current;
    if (!pending || !room || !mp) return;

    pendingPhaseRef.current = null;

    const nextRoom = cloneRoomState(room);
    nextRoom.phase = pending.phase;
    nextRoom.phaseSeq = pending.phaseSeq;

    if (pending.phase === 'racing') {
      nextRoom.raceResults = [];
      nextRoom.fightResults = [];
      nextRoom.fightWinnerId = null;
    } else if (pending.phase === 'battle') {
      nextRoom.fightResults = [];
      nextRoom.fightWinnerId = null;
    }

    commitRoomState(nextRoom, true);

    const startMessage: PhaseStartMessage = {
      type: 'phase_start',
      senderId: mp.getPlayerId(),
      phaseSeq: pending.phaseSeq,
      phase: pending.phase,
      countdownMs: pending.countdownMs,
      startInMs: PHASE_START_DELAY_MS,
    };

    void mp.send(startMessage);
    beginLocalPhaseStart(startMessage);
  }, [beginLocalPhaseStart, commitRoomState]);

  const prepareAuthoritativePhase = useCallback(
    (nextPhase: NetworkPhase) => {
      const room = roomStateRef.current;
      const mp = mpRef.current;
      if (!room || !mp || !isHostRef.current) return;

      clearScheduledTimeouts();

      const phaseSeq = room.phaseSeq + 1;
      const countdownMs = nextPhase === 'racing' ? RACE_COUNTDOWN_MS : BATTLE_COUNTDOWN_MS;
      const awaitingIds = soloModeRef.current ? new Set<string>() : new Set(getGuestPlayerIds(room));

      pendingPhaseRef.current = {
        phase: nextPhase,
        phaseSeq,
        countdownMs,
        awaitingIds,
      };

      if (awaitingIds.size > 0) {
        void mp.send({
          type: 'phase_prepare',
          senderId: mp.getPlayerId(),
          phaseSeq,
          phase: nextPhase,
          countdownMs,
        });
      }

      scheduleTimeout(() => {
        if (pendingPhaseRef.current?.phaseSeq === phaseSeq) {
          startPreparedPhase();
        }
      }, 1500);

      if (awaitingIds.size === 0) {
        startPreparedPhase();
      }
    },
    [clearScheduledTimeouts, scheduleTimeout, startPreparedPhase]
  );

  const finishBattleOnHost = useCallback(() => {
    const room = roomStateRef.current;
    const mp = mpRef.current;
    const localPlayerValue = localPlayerRef.current;
    if (!room || !mp || !localPlayerValue || !isHostRef.current || battleResolvedRef.current) {
      return;
    }

    battleResolvedRef.current = true;
    clearScheduledTimeouts();

    const resultsRoom = cloneRoomState(room);
    resultsRoom.phase = 'results';
    resultsRoom.phaseSeq = room.phaseSeq + 1;

    const fighters: Record<string, FightState> = {
      [localPlayerValue.id]: localPlayerValue.fight,
    };
    for (const [playerId, player] of Object.entries(remotePlayersRef.current)) {
      fighters[playerId] = player.fight;
    }

    const finalizedRoom = buildFightResults(resultsRoom, fighters);

    commitRoomState(finalizedRoom, false);
    setPhase('results');
    setCountdownText(null);
    setStatusMessage(null);

    void mp.send({
      type: 'phase_end',
      senderId: mp.getPlayerId(),
      phaseSeq: room.phaseSeq,
      phase: 'battle',
    });
    void mp.send({
      type: 'results',
      senderId: mp.getPlayerId(),
      phaseSeq: finalizedRoom.phaseSeq,
      room: finalizedRoom,
    });
  }, [clearScheduledTimeouts, commitRoomState]);

  const handleLocalRaceFinish = useCallback(() => {
    if (reportedRaceFinishRef.current) return;
    const room = roomStateRef.current;
    const mp = mpRef.current;
    const localId = mp?.getPlayerId();
    if (!room || !mp || !localId || raceStartPerfRef.current <= 0) return;

    reportedRaceFinishRef.current = true;
    const elapsedMs = Math.max(0, performance.now() - raceStartPerfRef.current);

    setShowFinished(true);
    scheduleTimeout(() => setShowFinished(false), 2000);

    if (isHostRef.current) {
      const nextRoom = applyRaceFinish(room, localId, elapsedMs);
      commitRoomState(nextRoom, true);

      if (haveAllPlayersFinishedRace(nextRoom) && !transitionQueuedRef.current) {
        transitionQueuedRef.current = true;
        void mp.send({
          type: 'phase_end',
          senderId: mp.getPlayerId(),
          phaseSeq: nextRoom.phaseSeq,
          phase: 'racing',
        });
        scheduleTimeout(() => prepareAuthoritativePhase('battle'), BETWEEN_PHASE_DELAY_MS);
      }
    } else {
      void mp.send({
        type: 'race_finish',
        senderId: localId,
        phaseSeq: currentPhaseSeqRef.current,
        elapsedMs,
      });
    }
  }, [commitRoomState, prepareAuthoritativePhase, scheduleTimeout]);

  handleProtocolMessageRef.current = (message: ProtocolMessage) => {
    const mp = mpRef.current;
    const room = roomStateRef.current;
    const localId = mp?.getPlayerId();
    if (!mp || !localId) return;

    switch (message.type) {
      case 'join_request': {
        if (!isHostRef.current || !room) return;
        const decision = applyJoinRequest(room, message.senderId, message.name);
        if (decision.accepted) {
          commitRoomState(decision.room, true);
          setPhase('waiting');
          setStatusMessage('Guest joined the room.');
        } else {
          void mp.send({
            type: 'join_rejected',
            senderId: localId,
            recipientId: message.senderId,
            reason: decision.reason ?? 'Unable to join room.',
          });
        }
        return;
      }
      case 'pick_character': {
        if (!isHostRef.current || !room || room.phase !== 'waiting') return;
        commitRoomState(applyCharacterPick(room, message.senderId, message.character), true);
        return;
      }
      case 'set_ready': {
        if (!isHostRef.current || !room || room.phase !== 'waiting') return;
        commitRoomState(applyReadyState(room, message.senderId, message.ready), true);
        return;
      }
      case 'phase_ack': {
        if (!isHostRef.current) return;
        const pending = pendingPhaseRef.current;
        if (!pending || pending.phaseSeq !== message.phaseSeq || pending.phase !== message.phase) return;
        pending.awaitingIds.delete(message.senderId);
        if (pending.awaitingIds.size === 0) {
          startPreparedPhase();
        }
        return;
      }
      case 'room_snapshot': {
        if (room && message.room.phaseSeq < room.phaseSeq) return;
        commitRoomState(message.room, false);
        setStatusMessage(null);
        if (phaseRef.current === 'home') {
          setPhase('waiting');
        }
        return;
      }
      case 'join_rejected': {
        if (message.recipientId === localId) {
          void resetToHome(message.reason);
        }
        return;
      }
      case 'phase_prepare': {
        if (isHostRef.current) return;
        if (message.phaseSeq <= currentPhaseSeqRef.current) return;
        setStatusMessage(message.phase === 'racing' ? 'Syncing race...' : 'Syncing fight...');
        void mp.send({
          type: 'phase_ack',
          senderId: localId,
          phaseSeq: message.phaseSeq,
          phase: message.phase,
        });
        return;
      }
      case 'phase_start': {
        if (message.phaseSeq < currentPhaseSeqRef.current) return;
        beginLocalPhaseStart(message);
        return;
      }
      case 'phase_end': {
        setCountdownText(null);
        if (message.phase === 'battle') {
          fightTimerRef.current = 0;
        }
        return;
      }
      case 'race_state': {
        if (message.phaseSeq !== currentPhaseSeqRef.current) return;
        setRemotePlayers(prev => {
          const roomPlayer = room?.players[message.senderId];
          const base = prev[message.senderId] ?? createPlayer(message.senderId, roomPlayer?.name ?? 'Player');
          return {
            ...prev,
            [message.senderId]: {
              ...syncStablePlayerState(base, roomPlayer ?? {
                id: message.senderId,
                name: base.name,
                connected: true,
                character: base.character,
                ready: base.ready,
              }),
              ...message.state,
            },
          };
        });
        return;
      }
      case 'fight_state': {
        if (message.phaseSeq !== currentPhaseSeqRef.current) return;
        setRemotePlayers(prev => {
          const roomPlayer = room?.players[message.senderId];
          const base = prev[message.senderId] ?? createPlayer(message.senderId, roomPlayer?.name ?? 'Player');
          const syncedBase = syncStablePlayerState(base, roomPlayer ?? {
            id: message.senderId,
            name: base.name,
            connected: true,
            character: base.character,
            ready: base.ready,
          });
          return {
            ...prev,
            [message.senderId]: {
              ...syncedBase,
              fight: applyFightSyncState(syncedBase.fight, message.state),
            },
          };
        });
        return;
      }
      case 'race_finish': {
        if (!isHostRef.current || !room || room.phase !== 'racing' || message.phaseSeq !== room.phaseSeq) return;
        const nextRoom = applyRaceFinish(room, message.senderId, message.elapsedMs);
        commitRoomState(nextRoom, true);
        if (haveAllPlayersFinishedRace(nextRoom) && !transitionQueuedRef.current) {
          transitionQueuedRef.current = true;
          void mp.send({
            type: 'phase_end',
            senderId: localId,
            phaseSeq: nextRoom.phaseSeq,
            phase: 'racing',
          });
          scheduleTimeout(() => prepareAuthoritativePhase('battle'), BETWEEN_PHASE_DELAY_MS);
        }
        return;
      }
      case 'fight_hit_report': {
        if (!isHostRef.current || !room || !shouldAcceptFightHit(room, message, appliedFightHitIdsRef.current)) {
          return;
        }

        appliedFightHitIdsRef.current.add(message.attackId);
        const engine = engineRef.current;

        if (message.targetId === localId) {
          const currentFight = localPlayerRef.current?.fight;
          if (!currentFight) return;
          const nextFight = engine.applyFightDamage(
            currentFight,
            message.damage,
            message.attackerX,
            message.freeze
          );
          engine.addFightParticles(currentFight.fx, currentFight.fy - 30, '#FF4444', 10);
          setLocalPlayer(prev => (prev ? { ...prev, fight: nextFight } : prev));
          if (nextFight.dead) {
            finishBattleOnHost();
          }
        } else {
          const target = remotePlayersRef.current[message.targetId];
          if (!target) return;
          const nextFight = engine.applyFightDamage(
            target.fight,
            message.damage,
            message.attackerX,
            message.freeze
          );
          engine.addFightParticles(target.fight.fx, target.fight.fy - 30, '#FF4444', 10);
          setRemotePlayers(prev => ({
            ...prev,
            [message.targetId]: {
              ...prev[message.targetId],
              fight: nextFight,
            },
          }));
          void mp.send({
            type: 'fight_damage_applied',
            senderId: localId,
            recipientId: message.targetId,
            phaseSeq: message.phaseSeq,
            attackId: message.attackId,
            attackerId: message.attackerId,
            attackerX: message.attackerX,
            damage: message.damage,
            freeze: message.freeze,
            fighter: toFightSyncState(nextFight),
          });
          if (nextFight.dead) {
            finishBattleOnHost();
          }
        }
        return;
      }
      case 'fight_damage_applied': {
        if (message.recipientId !== localId || message.phaseSeq !== currentPhaseSeqRef.current) return;
        if (appliedFightHitIdsRef.current.has(message.attackId)) return;
        appliedFightHitIdsRef.current.add(message.attackId);
        engineRef.current.addFightParticles(message.fighter.fx, message.fighter.fy - 30, '#FF4444', 10);
        setLocalPlayer(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            fight: applyFightSyncState(prev.fight, message.fighter),
          };
        });
        return;
      }
      case 'results': {
        if (room && message.room.phaseSeq < room.phaseSeq) return;
        clearScheduledTimeouts();
        commitRoomState(message.room, false);
        setPhase('results');
        setCountdownText(null);
        setStatusMessage(null);
        return;
      }
      case 'player_left': {
        if (!isHostRef.current && room && message.playerId === room.hostId) {
          void resetToHome('Host left the room.');
        }
        return;
      }
    }
  };

  handlePresenceSyncRef.current = connectedIds => {
    const room = roomStateRef.current;
    const localId = mpRef.current?.getPlayerId();
    if (!room || !localId) return;

    if (isHostRef.current) {
      const { room: nextRoom, removedPlayerIds } = syncConnectedPlayers(room, connectedIds);
      if (removedPlayerIds.length > 0) {
        for (const removedPlayerId of removedPlayerIds) {
          void mpRef.current?.send({
            type: 'player_left',
            senderId: localId,
            playerId: removedPlayerId,
          });
        }
        clearScheduledTimeouts();
        transitionQueuedRef.current = false;
        battleResolvedRef.current = false;
        setPhase('waiting');
        setCountdownText(null);
        setStatusMessage('Other player disconnected.');
        commitRoomState(nextRoom, true);
      }
      return;
    }

    if (!connectedIds.has(room.hostId)) {
      void resetToHome('Host left the room.');
    }
  };

  useEffect(() => {
    const manager = new MultiplayerManager();
    mpRef.current = manager;

    const offMessage = manager.onMessage(message => handleProtocolMessageRef.current(message));
    const offPresence = manager.onPresenceSync(ids => handlePresenceSyncRef.current(ids));

    return () => {
      offMessage();
      offPresence();
      clearScheduledTimeouts();
      void manager.disconnect();
      if (broadcastIntervalRef.current) {
        clearInterval(broadcastIntervalRef.current);
      }
    };
  }, [clearScheduledTimeouts]);

  useEffect(() => {
    if (!tiltPermission) return;

    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.gamma === null) return;
      const raw = event.gamma / 25;
      const deadZone = 0.05;
      const value = Math.abs(raw) < deadZone ? 0 : raw;
      tiltXRef.current = Math.max(-1, Math.min(1, value));
    };

    window.addEventListener('deviceorientation', handleOrientation);
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, [tiltPermission]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      keysDownRef.current.add(key);

      if (key === 'w' || key === 'arrowup') {
        event.preventDefault();
        if (phaseRef.current === 'battle') {
          fightJumpRef.current = true;
        } else if (phaseRef.current === 'racing') {
          boostActiveRef.current = true;
        }
      }

      if (key === ' ' || key === 'space') {
        event.preventDefault();
        if (phaseRef.current === 'battle') {
          fightJumpRef.current = true;
        } else if (phaseRef.current === 'racing') {
          jumpActiveRef.current = true;
        }
      }

      if (key === 'f' && phaseRef.current === 'battle') {
        event.preventDefault();
        fightPunchRef.current = true;
      }

      if (key === 'g' && phaseRef.current === 'battle') {
        event.preventDefault();
        fightSpecialRef.current = true;
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      keysDownRef.current.delete(event.key.toLowerCase());
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    const touch = event.touches[0];
    if (!touch) return;
    touchStartXRef.current = touch.clientX;
  }, []);

  const handleTouchMove = useCallback(
    (event: React.TouchEvent) => {
      if (touchStartXRef.current === null) return;
      const touch = event.touches[0];
      if (!touch || tiltPermission) return;
      const deltaX = touch.clientX - touchStartXRef.current;
      tiltXRef.current = Math.max(-1, Math.min(1, deltaX / 60));
    },
    [tiltPermission]
  );

  const handleTouchEnd = useCallback(() => {
    touchStartXRef.current = null;
    if (!tiltPermission) {
      tiltXRef.current = 0;
    }
  }, [tiltPermission]);

  const gameLoop = useCallback(
    (timestamp: number) => {
      const canvas = canvasRef.current;
      const player = localPlayerRef.current;

      if (!canvas || !player) {
        animFrameRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      const dt = lastTimeRef.current ? Math.min(timestamp - lastTimeRef.current, 50) : 16;
      lastTimeRef.current = timestamp;
      const now = performance.now();

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animFrameRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      const width = window.innerWidth;
      const height = window.innerHeight;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0);

      const engine = engineRef.current;
      let nextLocalPlayer = player;
      let nextRemotePlayers = remotePlayersRef.current;
      let remotePlayersChanged = false;
      const currentPhase = phaseRef.current;
      const isBattlePhase = currentPhase === 'battle';
      const isRacePhase = currentPhase === 'racing';
      const keys = keysDownRef.current;

      if (isBattlePhase) {
        if (keys.has('a') || keys.has('arrowleft')) {
          fightMoveXRef.current = -1;
        } else if (keys.has('d') || keys.has('arrowright')) {
          fightMoveXRef.current = 1;
        } else {
          fightMoveXRef.current = 0;
        }

        if (tiltPermission && Math.abs(tiltXRef.current) > 0.2) {
          fightMoveXRef.current = tiltXRef.current > 0 ? 1 : -1;
        }

        if (fightStartPerfRef.current > 0) {
          const remaining = Math.max(0, ARENA.FIGHT_DURATION - (now - fightStartPerfRef.current));
          fightTimerRef.current = remaining;

          if (isHostRef.current && remaining <= 0) {
            finishBattleOnHost();
          }
        }

        if (countdownTextRef.current === null && nextLocalPlayer.character && !battleResolvedRef.current) {
          const updatedFight = engine.updateFighter(
            nextLocalPlayer.fight,
            dt,
            fightMoveXRef.current,
            fightJumpRef.current,
            fightPunchRef.current,
            fightSpecialRef.current,
            nextLocalPlayer.character
          );

          fightJumpRef.current = false;
          fightPunchRef.current = false;
          fightSpecialRef.current = false;

          if (nextLocalPlayer.character) {
            for (const [remoteId, remotePlayer] of Object.entries(remotePlayersRef.current)) {
              if (!remotePlayer.character || remotePlayer.fight.dead) continue;
              const hit = engine.checkFightHit(updatedFight, nextLocalPlayer.character, remotePlayer.fight);
              if (!hit) continue;

              const attackKind = hit.type === 'punch' ? 'punch' : 'special';
              const attackId = makeEventId(`${currentPhaseSeqRef.current}-${nextLocalPlayer.id}-${attackKind}`);
              if (emittedFightHitIdsRef.current.has(attackId)) continue;
              emittedFightHitIdsRef.current.add(attackId);

              if (isHostRef.current) {
                const nextFight = engine.applyFightDamage(remotePlayer.fight, hit.damage, updatedFight.fx, Boolean(hit.freeze));
                engine.addFightParticles(remotePlayer.fight.fx, remotePlayer.fight.fy - 30, CHARACTERS[nextLocalPlayer.character].color, 12);
                appliedFightHitIdsRef.current.add(attackId);
                nextRemotePlayers = {
                  ...nextRemotePlayers,
                  [remoteId]: {
                    ...remotePlayer,
                    fight: nextFight,
                  },
                };
                remotePlayersChanged = true;
                remotePlayersRef.current = nextRemotePlayers;
                void mpRef.current?.send({
                  type: 'fight_damage_applied',
                  senderId: nextLocalPlayer.id,
                  recipientId: remoteId,
                  phaseSeq: currentPhaseSeqRef.current,
                  attackId,
                  attackerId: nextLocalPlayer.id,
                  attackerX: updatedFight.fx,
                  damage: hit.damage,
                  freeze: Boolean(hit.freeze),
                  fighter: toFightSyncState(nextFight),
                } as FightDamageAppliedMessage);
                if (nextFight.dead) {
                  finishBattleOnHost();
                }
              } else {
                void mpRef.current?.send({
                  type: 'fight_hit_report',
                  senderId: nextLocalPlayer.id,
                  phaseSeq: currentPhaseSeqRef.current,
                  attackId,
                  attackerId: nextLocalPlayer.id,
                  attackerX: updatedFight.fx,
                  targetId: remoteId,
                  attackType: hit.type,
                  damage: hit.damage,
                  freeze: Boolean(hit.freeze),
                } as FightHitReportMessage);
              }
            }
          }

          nextLocalPlayer = { ...nextLocalPlayer, fight: updatedFight };
          setLocalPlayer(nextLocalPlayer);

          if (isHostRef.current) {
            const anyRemoteDead = Object.values(remotePlayersRef.current).some(remotePlayer => remotePlayer.fight.dead);
            if (updatedFight.dead || anyRemoteDead) {
              finishBattleOnHost();
            }
          }
        }

        if (soloModeRef.current && countdownTextRef.current === null && !battleResolvedRef.current) {
          const cpuPlayer = nextRemotePlayers[CPU_PLAYER_ID];
          if (cpuPlayer?.character && !cpuPlayer.fight.dead) {
            const cpuInputs = getCpuFightInputs(cpuPlayer, nextLocalPlayer);
            const updatedCpuFight = engine.updateFighter(
              cpuPlayer.fight,
              dt,
              cpuInputs.moveX,
              cpuInputs.jump,
              cpuInputs.punch,
              cpuInputs.special,
              cpuPlayer.character
            );

            const cpuHit = engine.checkFightHit(updatedCpuFight, cpuPlayer.character, nextLocalPlayer.fight);
            if (cpuHit) {
              const cpuAttackKind = cpuHit.type === 'punch' ? 'punch' : 'special';
              const cpuAttackId = makeEventId(`${currentPhaseSeqRef.current}-${cpuPlayer.id}-${cpuAttackKind}`);
              if (!emittedFightHitIdsRef.current.has(cpuAttackId)) {
                emittedFightHitIdsRef.current.add(cpuAttackId);
                appliedFightHitIdsRef.current.add(cpuAttackId);
                const nextLocalFight = engine.applyFightDamage(
                  nextLocalPlayer.fight,
                  cpuHit.damage,
                  updatedCpuFight.fx,
                  Boolean(cpuHit.freeze)
                );
                engine.addFightParticles(
                  nextLocalPlayer.fight.fx,
                  nextLocalPlayer.fight.fy - 30,
                  CHARACTERS[cpuPlayer.character].color,
                  12
                );
                nextLocalPlayer = {
                  ...nextLocalPlayer,
                  fight: nextLocalFight,
                };
                setLocalPlayer(nextLocalPlayer);
                if (nextLocalFight.dead) {
                  finishBattleOnHost();
                }
              }
            }

            nextRemotePlayers = {
              ...nextRemotePlayers,
              [CPU_PLAYER_ID]: {
                ...cpuPlayer,
                fight: updatedCpuFight,
              },
            };
            remotePlayersChanged = true;
            remotePlayersRef.current = nextRemotePlayers;

            if (updatedCpuFight.dead) {
              finishBattleOnHost();
            }
          }
        }

        engine.updateParticles(dt);
        if (remotePlayersChanged) {
          setRemotePlayers(nextRemotePlayers);
        }
        renderFightGame(
          ctx,
          canvas,
          engine,
          nextLocalPlayer,
          Object.values(nextRemotePlayers),
          fightTimerRef.current,
          countdownTextRef.current
        );
      } else if (isRacePhase) {
        if (keys.has('a') || keys.has('arrowleft')) {
          tiltXRef.current = -1;
        } else if (keys.has('d') || keys.has('arrowright')) {
          tiltXRef.current = 1;
        } else if (!tiltPermission && touchStartXRef.current === null) {
          tiltXRef.current = 0;
        }

        if (!nextLocalPlayer.finished) {
          if (boostActiveRef.current && boostCooldownRef.current <= 0) {
            nextLocalPlayer = { ...nextLocalPlayer, boosting: true };
            boostCooldownRef.current = TRACK.BOOST_COOLDOWN;
            scheduleTimeout(() => {
              setLocalPlayer(prev => (prev ? { ...prev, boosting: false } : prev));
            }, TRACK.BOOST_DURATION);
            const charDef = nextLocalPlayer.character ? CHARACTERS[nextLocalPlayer.character] : null;
            if (charDef) {
              engine.addParticles(nextLocalPlayer.x * TRACK.WIDTH, TRACK.VISIBLE_HEIGHT * 0.65, charDef.color, 12);
            }
            engine.addShake(6);
            engine.soundFX.boost();
            boostActiveRef.current = false;
          }
          boostCooldownRef.current = Math.max(0, boostCooldownRef.current - dt);

          if (jumpActiveRef.current && jumpCooldownRef.current <= 0) {
            nextLocalPlayer = { ...nextLocalPlayer, jumping: true };
            jumpCooldownRef.current = TRACK.JUMP_COOLDOWN;
            scheduleTimeout(() => {
              setLocalPlayer(prev => (prev ? { ...prev, jumping: false } : prev));
            }, TRACK.JUMP_DURATION);
            engine.soundFX.jump();
            engine.addParticles(nextLocalPlayer.x * TRACK.WIDTH, TRACK.VISIBLE_HEIGHT * 0.65, '#ffffff', 6);
            jumpActiveRef.current = false;
          }
          jumpCooldownRef.current = Math.max(0, jumpCooldownRef.current - dt);

          if (nextLocalPlayer.boosting && nextLocalPlayer.character) {
            engine.addTrailParticle(
              nextLocalPlayer.x * TRACK.WIDTH,
              TRACK.VISIBLE_HEIGHT * 0.65,
              CHARACTERS[nextLocalPlayer.character].color
            );
          }

          nextLocalPlayer = engine.updatePlayer(
            nextLocalPlayer,
            dt,
            tiltXRef.current,
            nextLocalPlayer.boosting,
            nextLocalPlayer.jumping,
            false,
            now
          );

          if (nextLocalPlayer.finished) {
            handleLocalRaceFinish();
          }

          setLocalPlayer(nextLocalPlayer);
        }

        if (soloModeRef.current) {
          const cpuPlayer = nextRemotePlayers[CPU_PLAYER_ID];
          if (cpuPlayer && raceStartPerfRef.current > 0 && !cpuPlayer.finished) {
            const cpuControls = stepCpuRaceState(
              cpuRaceBrainRef.current,
              cpuPlayer,
              nextLocalPlayer,
              engine.obstacles,
              dt
            );
            cpuRaceBrainRef.current = cpuControls.brain;

            let updatedCpuPlayer: PlayerState = {
              ...cpuPlayer,
              boosting: cpuControls.boosting,
              jumping: cpuControls.jumping,
            };

            updatedCpuPlayer = engine.updatePlayer(
              updatedCpuPlayer,
              dt,
              cpuControls.tiltX,
              updatedCpuPlayer.boosting,
              updatedCpuPlayer.jumping,
              false,
              now
            );

            nextRemotePlayers = {
              ...nextRemotePlayers,
              [CPU_PLAYER_ID]: updatedCpuPlayer,
            };
            remotePlayersChanged = true;
            remotePlayersRef.current = nextRemotePlayers;

            if (
              updatedCpuPlayer.finished &&
              isHostRef.current &&
              roomStateRef.current &&
              !roomStateRef.current.raceResults.some(result => result.playerId === CPU_PLAYER_ID)
            ) {
              const cpuElapsedMs = Math.max(0, performance.now() - raceStartPerfRef.current);
              const nextRoom = applyRaceFinish(roomStateRef.current, CPU_PLAYER_ID, cpuElapsedMs);
              commitRoomState(nextRoom, true);

              if (haveAllPlayersFinishedRace(nextRoom) && !transitionQueuedRef.current) {
                transitionQueuedRef.current = true;
                void mpRef.current?.send({
                  type: 'phase_end',
                  senderId: nextLocalPlayer.id,
                  phaseSeq: nextRoom.phaseSeq,
                  phase: 'racing',
                });
                scheduleTimeout(() => prepareAuthoritativePhase('battle'), BETWEEN_PHASE_DELAY_MS);
              }
            }
          }
        }

        engine.updateParticles(dt);
        if (remotePlayersChanged) {
          setRemotePlayers(nextRemotePlayers);
        }
        renderGame(
          ctx,
          canvas,
          engine,
          nextLocalPlayer,
          Object.values(nextRemotePlayers),
          false,
          countdownTextRef.current
        );
      } else {
        engine.updateParticles(dt);
        if (remotePlayersChanged) {
          setRemotePlayers(nextRemotePlayers);
        }
        renderGame(
          ctx,
          canvas,
          engine,
          nextLocalPlayer,
          Object.values(nextRemotePlayers),
          false,
          countdownTextRef.current
        );
      }

      animFrameRef.current = requestAnimationFrame(gameLoop);
    },
    [commitRoomState, finishBattleOnHost, handleLocalRaceFinish, prepareAuthoritativePhase, scheduleTimeout, tiltPermission]
  );

  useEffect(() => {
    if (phase === 'countdown' || phase === 'racing' || phase === 'battle') {
      lastTimeRef.current = 0;
      animFrameRef.current = requestAnimationFrame(gameLoop);
      return () => cancelAnimationFrame(animFrameRef.current);
    }
  }, [gameLoop, phase]);

  useEffect(() => {
    const mp = mpRef.current;
    if (!mp) return;

    if (soloModeRef.current) {
      return;
    }

    if (phase === 'racing') {
      broadcastIntervalRef.current = setInterval(() => {
        const currentPlayer = localPlayerRef.current;
        if (!currentPlayer) return;
        void mp.send({
          type: 'race_state',
          senderId: currentPlayer.id,
          phaseSeq: currentPhaseSeqRef.current,
          state: toRaceSyncState(currentPlayer),
        });
      }, 100);
      return () => {
        if (broadcastIntervalRef.current) {
          clearInterval(broadcastIntervalRef.current);
          broadcastIntervalRef.current = null;
        }
      };
    }

    if (phase === 'battle') {
      broadcastIntervalRef.current = setInterval(() => {
        const currentPlayer = localPlayerRef.current;
        if (!currentPlayer) return;
        void mp.send({
          type: 'fight_state',
          senderId: currentPlayer.id,
          phaseSeq: currentPhaseSeqRef.current,
          state: toFightSyncState(currentPlayer.fight),
        });
      }, 100);
      return () => {
        if (broadcastIntervalRef.current) {
          clearInterval(broadcastIntervalRef.current);
          broadcastIntervalRef.current = null;
        }
      };
    }
  }, [phase]);

  const handleStartSolo = async () => {
    if (!playerName.trim() || !mpRef.current) return;
    await requestTiltPermission();

    const manager = mpRef.current;
    const name = playerName.trim();
    const localId = manager.getPlayerId();
    const room = createRoomState('SOLO', localId, name);

    room.players[CPU_PLAYER_ID] = {
      id: CPU_PLAYER_ID,
      name: CPU_PLAYER_NAME,
      connected: true,
      character: null,
      ready: false,
    };

    setSoloMode(true);
    soloModeRef.current = true;
    setRoomCode('SOLO');
    setErrorMessage(null);
    setPhase('waiting');
    setIsHost(true);
    isHostRef.current = true;
    setLocalPlayer(createPlayer(localId, name));
    commitRoomState(room, false);
    setStatusMessage('Pick your racer. The CPU will lock in after you do.');
  };

  const handleCreateRoom = async () => {
    if (!playerName.trim() || !mpRef.current) return;
    await requestTiltPermission();

    const manager = mpRef.current;
    const code = manager.generateRoomCode();
    const name = playerName.trim();

    try {
      await manager.joinRoom(code);
      const nextRoom = createRoomState(code, manager.getPlayerId(), name);
      setSoloMode(false);
      soloModeRef.current = false;
      setRoomCode(code);
      setErrorMessage(null);
      setPhase('waiting');
      setIsHost(true);
      isHostRef.current = true;
      setLocalPlayer(createPlayer(manager.getPlayerId(), name));
      commitRoomState(nextRoom, false);
      setStatusMessage('Share this code with one other player.');
    } catch {
      setErrorMessage('Could not create room.');
    }
  };

  const handleJoinRoom = async () => {
    if (!playerName.trim() || inputCode.length !== 4 || !mpRef.current) return;
    await requestTiltPermission();

    const manager = mpRef.current;
    const name = playerName.trim();

    try {
      await manager.joinRoom(inputCode);
      setSoloMode(false);
      soloModeRef.current = false;
      setRoomCode(inputCode);
      setErrorMessage(null);
      setPhase('waiting');
      setIsHost(false);
      isHostRef.current = false;
      setRoomState(null);
      roomStateRef.current = null;
      setLocalPlayer(createPlayer(manager.getPlayerId(), name));
      setStatusMessage('Joining room...');

      void manager.send({
        type: 'join_request',
        senderId: manager.getPlayerId(),
        name,
      });

      scheduleTimeout(() => {
        if (!roomStateRef.current) {
          void resetToHome('No host responded for that room.');
        }
      }, JOIN_REQUEST_TIMEOUT_MS);
    } catch {
      setErrorMessage('Could not join room.');
    }
  };

  const handleCharacterPick = (character: CharacterId) => {
    const room = roomStateRef.current;
    const mp = mpRef.current;
    const localId = mp?.getPlayerId();
    if (!room || !mp || !localId || room.phase !== 'waiting') return;

    if (Object.values(room.players).some(player => player.id !== localId && player.character === character)) {
      return;
    }

    if (isHostRef.current) {
      let nextRoom = applyCharacterPick(room, localId, character);
      if (soloModeRef.current) {
        nextRoom = cloneRoomState(nextRoom);
        nextRoom.players[localId].ready = true;
        const cpuPlayer = nextRoom.players[CPU_PLAYER_ID];
        if (cpuPlayer) {
          cpuPlayer.character = chooseCpuCharacter(character);
          cpuPlayer.ready = true;
        }
        setStatusMessage('CPU locked in. Starting race...');
        commitRoomState(nextRoom, true);
        scheduleTimeout(() => {
          if (roomStateRef.current && canStartRace(roomStateRef.current)) {
            prepareAuthoritativePhase('racing');
          }
        }, 250);
        return;
      }
      commitRoomState(nextRoom, true);
    } else {
      void mp.send({
        type: 'pick_character',
        senderId: localId,
        character,
      });
    }
  };

  const handleReadyToggle = () => {
    const room = roomStateRef.current;
    const mp = mpRef.current;
    const localId = mp?.getPlayerId();
    if (!room || !mp || !localId) return;
    const roomLocalPlayer = room.players[localId];
    if (!roomLocalPlayer?.character) return;

    const nextReady = !roomLocalPlayer.ready;
    if (isHostRef.current) {
      commitRoomState(applyReadyState(room, localId, nextReady), true);
    } else {
      void mp.send({
        type: 'set_ready',
        senderId: localId,
        ready: nextReady,
      });
    }
  };

  const handleStartRace = () => {
    if (!roomState || !isHost || !canStartRace(roomState)) return;
    prepareAuthoritativePhase('racing');
  };

  const localId = mpRef.current?.getPlayerId() ?? '';
  const waitingPlayers = roomState ? Object.values(roomState.players) : [];
  const localRoomPlayer = roomState?.players[localId] ?? null;
  const raceResults: CanonicalRaceResult[] = roomState?.raceResults ?? [];
  const fightResults: CanonicalFightResult[] = roomState?.fightResults ?? [];
  const fightWinnerId = roomState?.fightWinnerId ?? null;
  const shellStyle: React.CSSProperties = {
    minHeight: '100dvh',
    WebkitOverflowScrolling: 'touch',
    touchAction: 'pan-y',
  };

  if (phase === 'home') {
    return (
      <div className="game-shell" style={shellStyle}>
        <div className="game-shell-inner space-y-4">
          <div className="game-panel px-5 py-6 sm:px-6">
            <div className="hero-badge">
              <span className="loader-dot" style={{ animationDelay: artReady ? '-0.2s' : '0s' }} />
              {artReady ? 'Art Pack Ready' : 'Syncing Art Pack'}
            </div>

            <div className="hero-mark mt-5">
              <div className="relative h-[92px] w-[92px]">
                <div className="absolute left-0 top-5">
                  <CharacterArtwork characterId="lion" size={52} priority />
                </div>
                <div className="absolute right-0 top-0">
                  <CharacterArtwork characterId="wolf" size={52} priority />
                </div>
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2">
                  <CharacterArtwork characterId="unicorn" size={58} priority />
                </div>
              </div>
            </div>

            <h1 className="hero-title text-center">
              Animal
              <br />
              Racers
            </h1>
            <p className="hero-subtitle text-center">
              Race feral champions through a jungle sprint, then settle it in the arena.
            </p>

            {errorMessage && (
              <div className="mt-4 rounded-[18px] border border-red-400/35 bg-red-500/14 px-4 py-3 text-sm font-semibold text-red-100">
                {errorMessage}
              </div>
            )}

            <div className="mt-6 space-y-3">
              <input
                type="text"
                placeholder="Pilot Name"
                value={playerName}
                onChange={event => setPlayerName(event.target.value.slice(0, 10))}
                className="hero-input text-center text-lg font-semibold"
                maxLength={10}
                autoComplete="off"
              />

              <button
                onClick={handleStartSolo}
                disabled={!playerName.trim()}
                className="hero-button hero-button-secondary"
              >
                Solo vs CPU
              </button>

              <button
                onClick={handleCreateRoom}
                disabled={!playerName.trim()}
                className="hero-button hero-button-primary"
              >
                Create Room
              </button>

              <div className="grid grid-cols-[1fr_auto] gap-2">
                <input
                  type="text"
                  placeholder="Room Code"
                  value={inputCode}
                  onChange={event => setInputCode(event.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="hero-input telemetry text-center text-lg font-semibold"
                  maxLength={4}
                  inputMode="numeric"
                  autoComplete="off"
                />
                <button
                  onClick={handleJoinRoom}
                  disabled={!playerName.trim() || inputCode.length !== 4}
                  className="hero-button hero-button-ghost !w-auto px-5"
                >
                  Join
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {(['lion', 'wolf', 'unicorn'] as CharacterId[]).map(characterId => {
              const character = CHARACTERS[characterId];
              return (
                <div key={characterId} className="character-card px-3 py-3 text-center">
                  <div className="mx-auto w-fit">
                    <CharacterArtwork characterId={characterId} size={78} />
                  </div>
                  <div className="mt-3 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-100/60">
                    {character.specialName}
                  </div>
                  <div className="mt-1 text-sm font-black leading-tight">{character.name}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'waiting') {
    const canLaunchRace = Boolean(roomState && isHost && canStartRace(roomState));

    return (
      <div className="game-shell" style={shellStyle}>
        <div className="game-shell-inner space-y-4">
          <div className="game-panel px-5 py-5 sm:px-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="hero-badge">{soloMode ? 'Solo Exhibition' : 'Lobby Broadcast'}</div>
                <h2 className="mt-4 text-3xl font-black uppercase tracking-[-0.04em]">
                  {soloMode ? 'CPU Ready' : 'Assemble The Pack'}
                </h2>
                <p className="mt-2 text-sm text-emerald-50/68">
                  Lock one champion, ready up, and launch straight into the jungle circuit.
                </p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-black/25 px-4 py-3 text-right">
                <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/45">
                  {soloMode ? 'Mode' : 'Room Code'}
                </div>
                <div className="telemetry mt-1 text-3xl font-black tracking-[0.24em] text-amber-200">
                  {soloMode ? 'SOLO' : roomCode}
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <div className="status-chip">Players {waitingPlayers.length}/2</div>
              <div className="status-chip">{artReady ? 'Assets Live' : 'Loading Art'}</div>
              {statusMessage && <div className="status-chip !text-amber-100 !border-amber-200/20">{statusMessage}</div>}
            </div>
          </div>

          <div className="game-panel px-4 py-4 sm:px-5">
            <div className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-emerald-50/45">Lineup</div>
            <div className="space-y-3">
              {waitingPlayers.map(player => {
                const character = player.character ? CHARACTERS[player.character] : null;
                return (
                  <div
                    key={player.id}
                    className={`rounded-[22px] border px-3 py-3 ${
                      player.ready
                        ? 'border-emerald-300/30 bg-emerald-400/10'
                        : 'border-white/10 bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {player.character ? (
                        <CharacterArtwork characterId={player.character} size={72} />
                      ) : (
                        <div className="flex h-[72px] w-[72px] items-center justify-center rounded-[22px] border border-dashed border-white/15 bg-black/20 text-2xl text-white/35">
                          ?
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="truncate text-lg font-black uppercase tracking-[-0.03em]">
                            {player.name}
                          </div>
                          {player.id === localId && <div className="status-chip">You</div>}
                          {player.id === roomState?.hostId && <div className="status-chip">Host</div>}
                        </div>
                        <div className="mt-1 text-sm text-white/62">
                          {character?.name ?? 'No champion selected'}
                        </div>
                        <div className="mt-3 flex gap-2">
                          <div className="status-chip">{player.connected ? 'Connected' : 'Dropped'}</div>
                          <div className="status-chip">{player.ready ? 'Ready' : 'Waiting'}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="game-panel px-4 py-4 sm:px-5">
            <div className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-emerald-50/45">Choose Your Racer</div>
            <div className="space-y-3">
              {(['lion', 'wolf', 'unicorn'] as CharacterId[]).map(characterId => {
                const character = CHARACTERS[characterId];
                const claimedByOther = waitingPlayers.some(
                  player => player.id !== localId && player.character === characterId
                );
                const selected = localRoomPlayer?.character === characterId;
                return (
                  <button
                    key={characterId}
                    onClick={() => handleCharacterPick(characterId)}
                    disabled={!roomState || claimedByOther}
                    className={`character-card w-full p-3 text-left transition-transform active:scale-[0.99] ${
                      selected ? 'character-card-selected' : ''
                    } ${claimedByOther ? 'character-card-claimed' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <CharacterArtwork characterId={characterId} size={92} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="truncate text-xl font-black tracking-[-0.04em]">{character.name}</div>
                          {selected && <div className="status-chip !text-amber-100 !border-amber-200/25">Selected</div>}
                          {claimedByOther && <div className="status-chip">Locked</div>}
                        </div>
                        <div className="mt-2 text-sm text-white/68">
                          {character.attackDesc}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <div className="status-chip">{character.punchName}</div>
                          <div className="status-chip">{character.punchDamage} Damage</div>
                          <div className="status-chip">{character.specialName}</div>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {!localRoomPlayer?.character ? (
            <div className="status-chip !w-full !justify-center !py-3">Pick a champion to continue</div>
          ) : soloMode ? (
            <div className="status-chip !w-full !justify-center !py-3">CPU locked in. Race launch is automatic.</div>
          ) : (
            <button
              onClick={handleReadyToggle}
              className={`hero-button ${
                localRoomPlayer.ready ? 'hero-button-ghost' : 'hero-button-secondary'
              }`}
            >
              {localRoomPlayer.ready ? 'Unready' : 'Ready Up'}
            </button>
          )}

          {isHost && !soloMode && (
            <button
              onClick={handleStartRace}
              disabled={!canLaunchRace}
              className="hero-button hero-button-primary"
            >
              Start Race
            </button>
          )}
        </div>
      </div>
    );
  }

  if (phase === 'results') {
    return (
      <div className="game-shell" style={shellStyle}>
        <div className="game-shell-inner space-y-4">
          <div className="game-panel px-5 py-6 text-center sm:px-6">
            <div className="hero-badge mx-auto">Final Broadcast</div>
            <div className="mx-auto mt-5 flex h-[120px] w-[120px] items-center justify-center rounded-[36px] border border-amber-200/18 bg-[radial-gradient(circle_at_30%_25%,rgba(255,211,107,0.38),transparent_42%),linear-gradient(180deg,rgba(19,35,29,0.95),rgba(9,18,15,0.95))] text-6xl shadow-[0_24px_70px_rgba(0,0,0,0.34)]">
              🏆
            </div>
            <h1 className="hero-title text-center">Race Complete</h1>
            <p className="hero-subtitle text-center">
              Championship standings are locked. Review the sprint and the arena finish below.
            </p>
          </div>

          {raceResults.length > 0 && (
            <div className="game-panel px-4 py-4 sm:px-5">
              <div className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-amber-100/55">Race Results</div>
              <div className="space-y-3">
                {raceResults.map(result => {
                  const player = roomState?.players[result.playerId];
                  const characterId = player?.character;
                  const isWinner = result.rank === 1;
                  return (
                    <div
                      key={result.playerId}
                      className={`rounded-[24px] border px-3 py-3 ${
                        isWinner ? 'border-amber-200/30 bg-amber-300/10' : 'border-white/10 bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-[16px] border border-white/10 bg-black/20 text-xl font-black">
                          {result.rank === 1 ? '01' : '02'}
                        </div>
                        {characterId ? (
                          <CharacterArtwork characterId={characterId} size={74} />
                        ) : (
                          <div className="flex h-[74px] w-[74px] items-center justify-center rounded-[22px] border border-dashed border-white/15 bg-black/20 text-2xl text-white/35">
                            ?
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-lg font-black uppercase tracking-[-0.03em]">
                            {player?.name ?? 'Unknown'}
                          </div>
                          <div className="mt-1 text-sm text-white/62">
                            {characterId ? CHARACTERS[characterId].name : 'Unassigned'}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="status-chip">{formatElapsed(result.elapsedMs)}</div>
                          {isWinner && <div className="mt-2 text-xs font-bold uppercase tracking-[0.22em] text-amber-200">Winner</div>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {fightResults.length > 0 && (
            <div className="game-panel px-4 py-4 sm:px-5">
              <div className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-amber-100/55">Arena Results</div>
              <div className="space-y-3">
                {fightResults.map(result => {
                  const player = roomState?.players[result.playerId];
                  const characterId = player?.character;
                  const isWinner = result.rank === 1;
                  return (
                    <div
                      key={result.playerId}
                      className={`rounded-[24px] border px-3 py-3 ${
                        isWinner ? 'border-fuchsia-200/30 bg-fuchsia-300/10' : 'border-white/10 bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-[16px] border border-white/10 bg-black/20 text-xl font-black">
                          {result.rank === 1 ? '01' : '02'}
                        </div>
                        {characterId ? (
                          <CharacterArtwork characterId={characterId} size={74} />
                        ) : (
                          <div className="flex h-[74px] w-[74px] items-center justify-center rounded-[22px] border border-dashed border-white/15 bg-black/20 text-2xl text-white/35">
                            ?
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-lg font-black uppercase tracking-[-0.03em]">
                            {player?.name ?? 'Unknown'}
                          </div>
                          <div className="mt-1 text-sm text-white/62">
                            {characterId ? CHARACTERS[characterId].specialName : 'No special'}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="status-chip">{result.hp} HP</div>
                          {isWinner && <div className="mt-2 text-xs font-bold uppercase tracking-[0.22em] text-fuchsia-200">Winner</div>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {fightWinnerId && roomState?.players[fightWinnerId] && (
            <div className="status-chip !w-full !justify-center !py-3 !text-amber-100 !border-amber-200/25">
              {roomState.players[fightWinnerId].name} wins the arena clash
            </div>
          )}

          <button
            onClick={() => {
              void resetToHome();
            }}
            className="hero-button hero-button-primary"
          >
            Play Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black select-none"
      style={{ touchAction: 'none' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {phase === 'racing' && (
        <>
          <button
            onTouchStart={event => {
              event.stopPropagation();
              event.preventDefault();
              boostActiveRef.current = true;
            }}
            onMouseDown={event => {
              event.preventDefault();
              boostActiveRef.current = true;
            }}
            className="fixed bottom-6 left-4 flex h-24 w-24 items-center justify-center rounded-[28px] border border-amber-200/30 bg-[linear-gradient(180deg,rgba(255,187,86,0.96),rgba(198,97,18,0.96))] text-4xl text-white shadow-[0_20px_44px_rgba(0,0,0,0.34)] active:scale-90 transition-transform"
            style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'none' }}
          >
            🔥
          </button>

          <button
            onTouchStart={event => {
              event.stopPropagation();
              event.preventDefault();
              jumpActiveRef.current = true;
            }}
            onMouseDown={event => {
              event.preventDefault();
              jumpActiveRef.current = true;
            }}
            className="fixed bottom-6 right-4 flex h-24 w-24 items-center justify-center rounded-[28px] border border-cyan-200/30 bg-[linear-gradient(180deg,rgba(90,180,255,0.96),rgba(24,96,188,0.96))] text-4xl text-white shadow-[0_20px_44px_rgba(0,0,0,0.34)] active:scale-90 transition-transform"
            style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'none' }}
          >
            ⬆️
          </button>

          <div className="fixed bottom-1 left-4 w-24 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-white/58">
            Boost
          </div>
          <div className="fixed bottom-1 right-4 w-24 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-white/58">
            Jump
          </div>

          <div className="fixed top-16 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-black/30 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-white/72 backdrop-blur-md">
            {tiltPermission ? 'Tilt To Steer' : 'A/D Or Arrow Keys To Steer'}
          </div>

          {showFinished && (
            <div className="fixed left-1/2 top-1/3 -translate-x-1/2 rounded-[24px] border border-emerald-200/30 bg-[linear-gradient(180deg,rgba(31,145,99,0.96),rgba(12,79,54,0.94))] px-8 py-4 text-2xl font-black uppercase tracking-[0.12em] text-white shadow-[0_24px_54px_rgba(0,0,0,0.36)] animate-bounce">
              Finish Locked
            </div>
          )}
        </>
      )}

      {phase === 'battle' && (
        <>
          <button
            onTouchStart={event => {
              event.stopPropagation();
              event.preventDefault();
              fightMoveXRef.current = -1;
            }}
            onTouchEnd={event => {
              event.stopPropagation();
              fightMoveXRef.current = 0;
            }}
            onMouseDown={event => {
              event.preventDefault();
              fightMoveXRef.current = -1;
            }}
            onMouseUp={() => {
              fightMoveXRef.current = 0;
            }}
            className="fixed bottom-28 left-4 flex h-16 w-16 items-center justify-center rounded-[18px] border border-white/12 bg-[linear-gradient(180deg,rgba(55,64,86,0.94),rgba(22,27,39,0.94))] text-2xl text-white shadow-[0_18px_36px_rgba(0,0,0,0.32)] active:scale-90 transition-transform"
            style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'none' }}
          >
            ◀
          </button>

          <button
            onTouchStart={event => {
              event.stopPropagation();
              event.preventDefault();
              fightMoveXRef.current = 1;
            }}
            onTouchEnd={event => {
              event.stopPropagation();
              fightMoveXRef.current = 0;
            }}
            onMouseDown={event => {
              event.preventDefault();
              fightMoveXRef.current = 1;
            }}
            onMouseUp={() => {
              fightMoveXRef.current = 0;
            }}
            className="fixed bottom-28 left-24 flex h-16 w-16 items-center justify-center rounded-[18px] border border-white/12 bg-[linear-gradient(180deg,rgba(55,64,86,0.94),rgba(22,27,39,0.94))] text-2xl text-white shadow-[0_18px_36px_rgba(0,0,0,0.32)] active:scale-90 transition-transform"
            style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'none' }}
          >
            ▶
          </button>

          <button
            onTouchStart={event => {
              event.stopPropagation();
              event.preventDefault();
              fightJumpRef.current = true;
            }}
            onMouseDown={event => {
              event.preventDefault();
              fightJumpRef.current = true;
            }}
            className="fixed bottom-48 left-12 flex h-16 w-16 items-center justify-center rounded-[18px] border border-cyan-200/24 bg-[linear-gradient(180deg,rgba(82,148,255,0.94),rgba(25,82,176,0.94))] text-2xl text-white shadow-[0_18px_36px_rgba(0,0,0,0.32)] active:scale-90 transition-transform"
            style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'none' }}
          >
            ▲
          </button>

          <button
            onTouchStart={event => {
              event.stopPropagation();
              event.preventDefault();
              fightPunchRef.current = true;
            }}
            onMouseDown={event => {
              event.preventDefault();
              fightPunchRef.current = true;
            }}
            className="fixed bottom-28 right-4 flex h-20 w-20 items-center justify-center rounded-[24px] border border-red-200/28 bg-[linear-gradient(180deg,rgba(255,92,102,0.96),rgba(157,28,38,0.94))] text-3xl text-white shadow-[0_20px_44px_rgba(0,0,0,0.34)] active:scale-90 transition-transform"
            style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'none' }}
          >
            👊
          </button>

          <button
            onTouchStart={event => {
              event.stopPropagation();
              event.preventDefault();
              fightSpecialRef.current = true;
            }}
            onMouseDown={event => {
              event.preventDefault();
              fightSpecialRef.current = true;
            }}
            className="fixed bottom-6 right-4 flex h-20 w-20 items-center justify-center rounded-[24px] border border-amber-100/28 bg-[linear-gradient(180deg,rgba(255,205,95,0.96),rgba(186,108,18,0.94))] text-3xl text-white shadow-[0_20px_44px_rgba(0,0,0,0.34)] active:scale-90 transition-transform"
            style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'none' }}
          >
            ⚡
          </button>

          <div className="fixed bottom-24 left-12 w-20 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
            Move
          </div>
          <div className="fixed bottom-44 left-8 w-24 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
            Jump
          </div>
          <div className="fixed bottom-24 right-0 w-28 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
            Punch
          </div>
          <div className="fixed bottom-2 right-0 w-28 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
            Special
          </div>
          <div className="fixed top-[74px] left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-black/30 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-white/72 backdrop-blur-md">
            A/D Move • W Jump • F Punch • G Special
          </div>
        </>
      )}
    </div>
  );
}
