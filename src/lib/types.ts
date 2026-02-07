export type CharacterId = 'lion' | 'wolf' | 'unicorn';

export interface CharacterDef {
  id: CharacterId;
  name: string;
  emoji: string;
  color: string;
  secondaryColor: string;
  attackName: string;
  attackDesc: string;
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
  },
  wolf: {
    id: 'wolf',
    name: 'Water Wolf',
    emoji: '🐺',
    color: '#4488FF',
    secondaryColor: '#00CCFF',
    attackName: 'Ice Howl',
    attackDesc: 'Freeze nearest opponent for 1s!',
  },
  unicorn: {
    id: 'unicorn',
    name: 'Rainbow Unicorn',
    emoji: '🦄',
    color: '#CC44FF',
    secondaryColor: '#FF88DD',
    attackName: 'Rainbow Shield',
    attackDesc: 'Block the next incoming attack!',
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
  // Battle
  battleFinished: boolean;
  battleFinishTime: number;
  attackCooldown: number;
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
  type: 'player_update' | 'phase_change' | 'player_join' | 'player_ready' | 'character_pick' | 'attack' | 'start_game' | 'lap_complete' | 'race_finish' | 'battle_finish';
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
  RACE_LAPS: 5,
  BATTLE_LAPS: 1,
  BASE_SPEED: 2.5,
  BOOST_SPEED: 5,
  BOOST_DURATION: 500,
  BOOST_COOLDOWN: 3000,
  JUMP_DURATION: 600,
  JUMP_COOLDOWN: 1500,
  FREEZE_DURATION: 1000,
  HIT_STUN_DURATION: 800,
  HIT_SLOW_FACTOR: 0.3,
  OBSTACLE_INTERVAL: 400,
  PLAYER_SIZE: 36,
};
