import {
  CanonicalFightResult,
  CanonicalRaceResult,
  CharacterId,
  FightHitReportMessage,
  FightState,
  GamePhase,
  MAX_ROOM_PLAYERS,
  RoomPlayer,
  RoomState,
} from './types';

export interface JoinDecision {
  accepted: boolean;
  room: RoomState;
  reason?: string;
}

function clonePlayers(players: Record<string, RoomPlayer>): Record<string, RoomPlayer> {
  return Object.fromEntries(
    Object.entries(players).map(([id, player]) => [id, { ...player }])
  );
}

export function cloneRoomState(room: RoomState): RoomState {
  return {
    ...room,
    players: clonePlayers(room.players),
    raceResults: room.raceResults.map(result => ({ ...result })),
    fightResults: room.fightResults.map(result => ({ ...result })),
  };
}

export function createRoomState(roomCode: string, hostId: string, hostName: string): RoomState {
  return {
    roomCode,
    hostId,
    phase: 'waiting',
    phaseSeq: 0,
    maxPlayers: MAX_ROOM_PLAYERS,
    players: {
      [hostId]: {
        id: hostId,
        name: hostName,
        connected: true,
        character: null,
        ready: false,
      },
    },
    raceResults: [],
    fightResults: [],
    fightWinnerId: null,
  };
}

export function getConnectedPlayerIds(room: RoomState): string[] {
  return Object.values(room.players)
    .filter(player => player.connected)
    .map(player => player.id);
}

export function getGuestPlayerIds(room: RoomState): string[] {
  return getConnectedPlayerIds(room).filter(id => id !== room.hostId);
}

export function getOtherPlayerId(room: RoomState, playerId: string): string | null {
  return Object.keys(room.players).find(id => id !== playerId) ?? null;
}

export function applyJoinRequest(room: RoomState, playerId: string, name: string): JoinDecision {
  const next = cloneRoomState(room);

  if (next.players[playerId]) {
    next.players[playerId] = { ...next.players[playerId], name, connected: true };
    return { accepted: true, room: next };
  }

  if (next.phase !== 'waiting') {
    return { accepted: false, room: next, reason: 'Match already started.' };
  }

  if (Object.keys(next.players).length >= next.maxPlayers) {
    return { accepted: false, room: next, reason: 'Room is full.' };
  }

  next.players[playerId] = {
    id: playerId,
    name,
    connected: true,
    character: null,
    ready: false,
  };

  return { accepted: true, room: next };
}

export function applyCharacterPick(
  room: RoomState,
  playerId: string,
  character: CharacterId
): RoomState {
  const next = cloneRoomState(room);
  const player = next.players[playerId];
  if (!player) return next;

  const claimedByOtherPlayer = Object.values(next.players).some(
    other => other.id !== playerId && other.character === character
  );
  if (claimedByOtherPlayer) {
    return next;
  }

  player.character = character;
  player.ready = false;
  return next;
}

export function applyReadyState(room: RoomState, playerId: string, ready: boolean): RoomState {
  const next = cloneRoomState(room);
  const player = next.players[playerId];
  if (!player) return next;

  player.ready = ready && Boolean(player.character);
  return next;
}

export function syncConnectedPlayers(
  room: RoomState,
  connectedIds: Set<string>
): { room: RoomState; removedPlayerIds: string[] } {
  const next = cloneRoomState(room);
  const removedPlayerIds: string[] = [];

  for (const playerId of Object.keys(next.players)) {
    if (playerId === next.hostId) {
      next.players[playerId].connected = connectedIds.has(playerId);
      continue;
    }

    if (!connectedIds.has(playerId)) {
      delete next.players[playerId];
      removedPlayerIds.push(playerId);
    } else {
      next.players[playerId].connected = true;
    }
  }

  if (removedPlayerIds.length > 0) {
    next.phase = 'waiting';
    next.phaseSeq += 1;
    next.raceResults = [];
    next.fightResults = [];
    next.fightWinnerId = null;
    for (const player of Object.values(next.players)) {
      player.ready = false;
    }
  }

  return { room: next, removedPlayerIds };
}

export function canStartRace(room: RoomState): boolean {
  const connectedPlayers = Object.values(room.players).filter(player => player.connected);
  return (
    connectedPlayers.length === MAX_ROOM_PLAYERS &&
    connectedPlayers.every(player => player.ready && player.character)
  );
}

export function beginAuthoritativePhase(room: RoomState, phase: Extract<GamePhase, 'racing' | 'battle' | 'results'>): RoomState {
  const next = cloneRoomState(room);
  next.phaseSeq += 1;
  next.phase = phase;

  if (phase === 'racing') {
    next.raceResults = [];
    next.fightResults = [];
    next.fightWinnerId = null;
  }

  if (phase === 'battle') {
    next.fightResults = [];
    next.fightWinnerId = null;
  }

  return next;
}

function assignRanks<T extends CanonicalRaceResult | CanonicalFightResult>(
  entries: T[],
  compare: (a: T, b: T) => number
): T[] {
  return [...entries]
    .sort(compare)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export function applyRaceFinish(room: RoomState, playerId: string, elapsedMs: number): RoomState {
  const next = cloneRoomState(room);
  const existing = next.raceResults.find(result => result.playerId === playerId);
  if (existing) {
    existing.elapsedMs = Math.min(existing.elapsedMs, elapsedMs);
  } else {
    next.raceResults.push({ playerId, elapsedMs, rank: 0 });
  }
  next.raceResults = assignRanks(next.raceResults, (a, b) => a.elapsedMs - b.elapsedMs);
  return next;
}

export function haveAllPlayersFinishedRace(room: RoomState): boolean {
  const connectedCount = getConnectedPlayerIds(room).length;
  return connectedCount === MAX_ROOM_PLAYERS && room.raceResults.length >= connectedCount;
}

export function buildFightResults(
  room: RoomState,
  fighters: Record<string, FightState>
): RoomState {
  const next = cloneRoomState(room);
  const results: CanonicalFightResult[] = Object.keys(next.players)
    .filter(playerId => fighters[playerId])
    .map(playerId => ({
      playerId,
      hp: fighters[playerId].hp,
      rank: 0,
    }));

  next.fightResults = assignRanks(results, (a, b) => b.hp - a.hp);
  next.fightWinnerId = next.fightResults[0]?.playerId ?? null;
  return next;
}

export function shouldAcceptFightHit(
  room: RoomState,
  report: FightHitReportMessage,
  appliedAttackIds: Set<string>
): boolean {
  if (room.phase !== 'battle') return false;
  if (room.phaseSeq !== report.phaseSeq) return false;
  if (appliedAttackIds.has(report.attackId)) return false;
  if (!room.players[report.attackerId] || !room.players[report.targetId]) return false;
  if (report.attackerId === report.targetId) return false;
  return true;
}
