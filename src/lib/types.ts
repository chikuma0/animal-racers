export type CharacterId = 'lion' | 'wolf' | 'unicorn';

export interface CharacterDef {
  id: CharacterId;
  name: string;
  emoji: string;
  color: string;
  secondaryColor: string;
  attackName: string;
  attackDesc: string;
  // Fighting stats
  punchName: string;
  punchDamage: number;
  punchRange: number;
  punchSpeed: number; // ms cooldown
  specialName: string;
  specialDamage: number;
  specialCooldown: number; // ms
}

export const CHARACTERS: Record<CharacterId, CharacterDef> = {
  lion: {
    id: 'lion',
    name: 'Fire Lion',
    emoji: '🦁',
    color: '#FF4444',
    secondaryColor: '#FF8800',
    attackName: 'Fire Dash',
    attackDesc: 'Burst forward & knock others aside!',
    punchName: 'Fire Punch',
    punchDamage: 15,
    punchRange: 60,
    punchSpeed: 400,
    specialName: 'Fire Dash',
    specialDamage: 25,
    specialCooldown: 4000,
  },
  wolf: {
    id: 'wolf',
    name: 'Water Wolf',
    emoji: '🐺',
    color: '#4488FF',
    secondaryColor: '#00CCFF',
    attackName: 'Ice Howl',
    attackDesc: 'Freeze nearest opponent for 2s!',
    punchName: 'Ice Claw',
    punchDamage: 12,
    punchRange: 80,
    punchSpeed: 500,
    specialName: 'Ice Howl',
    specialDamage: 0,
    specialCooldown: 5000,
  },
  unicorn: {
    id: 'unicorn',
    name: 'Rainbow Unicorn',
    emoji: '🦄',
    color: '#CC44FF',
    secondaryColor: '#FF88DD',
    attackName: 'Rainbow Shield',
    attackDesc: 'Block attacks for 3 seconds!',
    punchName: 'Horn Strike',
    punchDamage: 13,
    punchRange: 75,
    punchSpeed: 450,
    specialName: 'Rainbow Shield',
    specialDamage: 0,
    specialCooldown: 6000,
  },
};

export type GamePhase = 'home' | 'character-select' | 'waiting' | 'countdown' | 'racing' | 'battle' | 'results';
export type NetworkPhase = 'racing' | 'battle';

export interface PlayerState {
  id: string;
  name: string;
  character: CharacterId | null;
  ready: boolean;
  // Race state
  x: number;         // lateral position on track (0-1)
  progress: number;  // distance along track
  lap: number;
  speed: number;
  boosting: boolean;
  jumping: boolean;
  frozen: boolean;
  shielded: boolean;
  hitStun: number;
  finished: boolean;
  finishTime: number;
  // Battle (racing-style, kept for compat)
  battleFinished: boolean;
  battleFinishTime: number;
  attackCooldown: number;
  // Fighting game state
  fight: FightState;
}

export interface FightState {
  fx: number;        // x position in arena (0 = left, ARENA_WIDTH = right)
  fy: number;        // y position (0 = ground)
  fvx: number;       // velocity x
  fvy: number;       // velocity y
  hp: number;
  maxHp: number;
  facing: 1 | -1;    // 1 = right, -1 = left
  grounded: boolean;
  punching: boolean;
  punchTimer: number;
  punchCooldown: number;
  specialActive: boolean;
  specialTimer: number;
  specialCooldown: number;
  blockTimer: number;  // for unicorn shield
  freezeTimer: number; // frozen by wolf howl
  hitStunTimer: number;
  knockbackVx: number;
  dashActive: boolean; // for lion fire dash
  dashTimer: number;
  invulnTimer: number; // brief invuln after being hit
  dead: boolean;
}

export function createDefaultFightState(): FightState {
  return {
    fx: 0,
    fy: 0,
    fvx: 0,
    fvy: 0,
    hp: 100,
    maxHp: 100,
    facing: 1,
    grounded: true,
    punching: false,
    punchTimer: 0,
    punchCooldown: 0,
    specialActive: false,
    specialTimer: 0,
    specialCooldown: 0,
    blockTimer: 0,
    freezeTimer: 0,
    hitStunTimer: 0,
    knockbackVx: 0,
    dashActive: false,
    dashTimer: 0,
    invulnTimer: 0,
    dead: false,
  };
}

export interface RoomState {
  roomCode: string;
  hostId: string;
  phase: Extract<GamePhase, 'waiting' | 'racing' | 'battle' | 'results'>;
  phaseSeq: number;
  maxPlayers: 2;
  players: Record<string, RoomPlayer>;
  raceResults: CanonicalRaceResult[];
  fightResults: CanonicalFightResult[];
  fightWinnerId: string | null;
}

export interface RoomPlayer {
  id: string;
  name: string;
  connected: boolean;
  character: CharacterId | null;
  ready: boolean;
}

export interface CanonicalRaceResult {
  playerId: string;
  elapsedMs: number;
  rank: number;
}

export interface CanonicalFightResult {
  playerId: string;
  hp: number;
  rank: number;
}

export interface RaceSyncState {
  x: number;
  progress: number;
  lap: number;
  speed: number;
  boosting: boolean;
  jumping: boolean;
  finished: boolean;
}

export interface FightSyncState {
  fx: number;
  fy: number;
  fvx: number;
  fvy: number;
  hp: number;
  facing: 1 | -1;
  grounded: boolean;
  punching: boolean;
  punchTimer: number;
  punchCooldown: number;
  specialActive: boolean;
  specialTimer: number;
  specialCooldown: number;
  blockTimer: number;
  freezeTimer: number;
  hitStunTimer: number;
  knockbackVx: number;
  dashActive: boolean;
  dashTimer: number;
  invulnTimer: number;
  dead: boolean;
}

interface ProtocolBase {
  type: string;
  senderId: string;
  recipientId?: string;
}

export interface JoinRequestMessage extends ProtocolBase {
  type: 'join_request';
  name: string;
}

export interface PickCharacterMessage extends ProtocolBase {
  type: 'pick_character';
  character: CharacterId;
}

export interface SetReadyMessage extends ProtocolBase {
  type: 'set_ready';
  ready: boolean;
}

export interface PhaseAckMessage extends ProtocolBase {
  type: 'phase_ack';
  phaseSeq: number;
  phase: NetworkPhase;
}

export interface RaceFinishMessage extends ProtocolBase {
  type: 'race_finish';
  phaseSeq: number;
  elapsedMs: number;
}

export interface FightHitReportMessage extends ProtocolBase {
  type: 'fight_hit_report';
  phaseSeq: number;
  attackId: string;
  attackerId: string;
  attackerX: number;
  targetId: string;
  attackType: 'punch' | 'special';
  damage: number;
  freeze: boolean;
}

export interface RaceStateMessage extends ProtocolBase {
  type: 'race_state';
  phaseSeq: number;
  state: RaceSyncState;
}

export interface FightStateMessage extends ProtocolBase {
  type: 'fight_state';
  phaseSeq: number;
  state: FightSyncState;
}

export interface FightDamageAppliedMessage extends ProtocolBase {
  type: 'fight_damage_applied';
  phaseSeq: number;
  attackId: string;
  attackerId: string;
  attackerX: number;
  damage: number;
  freeze: boolean;
  fighter: FightSyncState;
}

export interface RoomSnapshotMessage extends ProtocolBase {
  type: 'room_snapshot';
  room: RoomState;
}

export interface JoinRejectedMessage extends ProtocolBase {
  type: 'join_rejected';
  reason: string;
}

export interface PhasePrepareMessage extends ProtocolBase {
  type: 'phase_prepare';
  phaseSeq: number;
  phase: NetworkPhase;
  countdownMs: number;
}

export interface PhaseStartMessage extends ProtocolBase {
  type: 'phase_start';
  phaseSeq: number;
  phase: NetworkPhase;
  countdownMs: number;
  startInMs: number;
}

export interface PhaseEndMessage extends ProtocolBase {
  type: 'phase_end';
  phaseSeq: number;
  phase: NetworkPhase;
}

export interface ResultsMessage extends ProtocolBase {
  type: 'results';
  phaseSeq: number;
  room: RoomState;
}

export interface PlayerLeftMessage extends ProtocolBase {
  type: 'player_left';
  playerId: string;
}

export type ProtocolMessage =
  | JoinRequestMessage
  | PickCharacterMessage
  | SetReadyMessage
  | PhaseAckMessage
  | RaceFinishMessage
  | FightHitReportMessage
  | RaceStateMessage
  | FightStateMessage
  | FightDamageAppliedMessage
  | RoomSnapshotMessage
  | JoinRejectedMessage
  | PhasePrepareMessage
  | PhaseStartMessage
  | PhaseEndMessage
  | ResultsMessage
  | PlayerLeftMessage;

export const MAX_ROOM_PLAYERS = 2;

export function toRaceSyncState(player: PlayerState): RaceSyncState {
  return {
    x: player.x,
    progress: player.progress,
    lap: player.lap,
    speed: player.speed,
    boosting: player.boosting,
    jumping: player.jumping,
    finished: player.finished,
  };
}

export function toFightSyncState(fight: FightState): FightSyncState {
  return {
    fx: fight.fx,
    fy: fight.fy,
    fvx: fight.fvx,
    fvy: fight.fvy,
    hp: fight.hp,
    facing: fight.facing,
    grounded: fight.grounded,
    punching: fight.punching,
    punchTimer: fight.punchTimer,
    punchCooldown: fight.punchCooldown,
    specialActive: fight.specialActive,
    specialTimer: fight.specialTimer,
    specialCooldown: fight.specialCooldown,
    blockTimer: fight.blockTimer,
    freezeTimer: fight.freezeTimer,
    hitStunTimer: fight.hitStunTimer,
    knockbackVx: fight.knockbackVx,
    dashActive: fight.dashActive,
    dashTimer: fight.dashTimer,
    invulnTimer: fight.invulnTimer,
    dead: fight.dead,
  };
}

export const TRACK = {
  WIDTH: 360,
  VISIBLE_HEIGHT: 640,
  LANE_COUNT: 5,
  LANE_WIDTH: 60,
  TRACK_LEFT: 30,
  TRACK_RIGHT: 330,
  LAP_LENGTH: 4000,
  RACE_LAPS: 3,
  BATTLE_LAPS: 1,
  BASE_SPEED: 4.5,
  BOOST_SPEED: 9,
  BOOST_DURATION: 600,
  BOOST_COOLDOWN: 2000,
  JUMP_DURATION: 500,
  JUMP_COOLDOWN: 1000,
  FREEZE_DURATION: 800,
  HIT_STUN_DURATION: 600,
  HIT_SLOW_FACTOR: 0.4,
  OBSTACLE_INTERVAL: 350,
  PLAYER_SIZE: 40,
};

export const ARENA = {
  WIDTH: 360,
  HEIGHT: 400,
  GROUND_Y: 300,
  GRAVITY: 0.6,
  MOVE_SPEED: 3.5,
  JUMP_FORCE: -12,
  FIGHT_DURATION: 60000, // 60 seconds
  PLAYER_WIDTH: 50,
  PLAYER_HEIGHT: 70,
};
