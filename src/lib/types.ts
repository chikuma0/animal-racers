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
  code: string;
  hostId: string;
  players: Record<string, PlayerState>;
  phase: GamePhase;
  raceStartTime: number;
  battleStartTime: number;
}

export interface BroadcastPayload {
  type: 'player_update' | 'phase_change' | 'player_join' | 'player_ready' | 'character_pick' | 'attack' | 'start_game' | 'lap_complete' | 'race_finish' | 'battle_finish' | 'fight_update' | 'fight_hit' | 'fight_special';
  senderId: string;
  data: Record<string, unknown>;
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
