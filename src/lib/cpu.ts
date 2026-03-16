import { Obstacle } from './engine';
import { CHARACTERS, CharacterId, PlayerState, TRACK } from './types';

export const CPU_PLAYER_ID = 'cpu-opponent';
export const CPU_PLAYER_NAME = 'CPU Rival';

export interface CpuRaceState {
  boostCooldownMs: number;
  boostRemainingMs: number;
  jumpCooldownMs: number;
  jumpRemainingMs: number;
  steeringBias: number;
  steeringTimerMs: number;
}

export interface CpuFightInputs {
  moveX: -1 | 0 | 1;
  jump: boolean;
  punch: boolean;
  special: boolean;
}

export function createCpuRaceState(): CpuRaceState {
  return {
    boostCooldownMs: 0,
    boostRemainingMs: 0,
    jumpCooldownMs: 0,
    jumpRemainingMs: 0,
    steeringBias: 0.5,
    steeringTimerMs: 0,
  };
}

export function chooseCpuCharacter(playerCharacter: CharacterId | null): CharacterId {
  const characters: CharacterId[] = ['lion', 'wolf', 'unicorn'];
  return characters.find(character => character !== playerCharacter) ?? 'wolf';
}

export function stepCpuRaceState(
  brain: CpuRaceState,
  player: PlayerState,
  opponent: PlayerState,
  obstacles: Obstacle[],
  dt: number
): { brain: CpuRaceState; tiltX: number; boosting: boolean; jumping: boolean } {
  const next: CpuRaceState = {
    ...brain,
    boostCooldownMs: Math.max(0, brain.boostCooldownMs - dt),
    boostRemainingMs: Math.max(0, brain.boostRemainingMs - dt),
    jumpCooldownMs: Math.max(0, brain.jumpCooldownMs - dt),
    jumpRemainingMs: Math.max(0, brain.jumpRemainingMs - dt),
    steeringTimerMs: Math.max(0, brain.steeringTimerMs - dt),
  };

  if (next.steeringTimerMs <= 0) {
    next.steeringBias = 0.2 + Math.random() * 0.6;
    next.steeringTimerMs = 500 + Math.random() * 700;
  }

  let targetX = 0.25 + next.steeringBias * 0.5;
  const lookAheadObstacles = obstacles
    .map(obstacle => ({
      obstacle,
      ahead: (obstacle.y - player.progress + TRACK.LAP_LENGTH) % TRACK.LAP_LENGTH,
    }))
    .filter(entry => entry.ahead > 0 && entry.ahead < 150)
    .sort((a, b) => a.ahead - b.ahead);

  const imminentObstacle = lookAheadObstacles.find(entry => {
    const padding = entry.obstacle.width / 2 + 0.08;
    return Math.abs(player.x - entry.obstacle.x) < padding;
  });

  if (imminentObstacle) {
    if (
      imminentObstacle.ahead < 50 &&
      next.jumpCooldownMs <= 0 &&
      ['rock', 'log', 'bush'].includes(imminentObstacle.obstacle.type)
    ) {
      next.jumpRemainingMs = TRACK.JUMP_DURATION;
      next.jumpCooldownMs = TRACK.JUMP_COOLDOWN;
    }

    targetX = imminentObstacle.obstacle.x < 0.5 ? 0.82 : 0.18;
  } else {
    const progressGap = opponent.progress - player.progress;
    if (progressGap > 120) {
      targetX = Math.max(0.12, Math.min(0.88, opponent.x + (Math.random() - 0.5) * 0.12));
    } else {
      targetX = Math.max(0.12, Math.min(0.88, 0.5 + (next.steeringBias - 0.5) * 0.35));
    }
  }

  if (next.boostCooldownMs <= 0 && next.boostRemainingMs <= 0) {
    const progressGap = opponent.progress - player.progress;
    const shouldBoost = progressGap > 80 || Math.random() < 0.0025 * (dt / 16);
    if (shouldBoost) {
      next.boostRemainingMs = TRACK.BOOST_DURATION;
      next.boostCooldownMs = TRACK.BOOST_COOLDOWN;
    }
  }

  const tiltX = Math.max(-1, Math.min(1, (targetX - player.x) / 0.12));

  return {
    brain: next,
    tiltX,
    boosting: next.boostRemainingMs > 0,
    jumping: next.jumpRemainingMs > 0,
  };
}

export function getCpuFightInputs(player: PlayerState, target: PlayerState): CpuFightInputs {
  if (!player.character) {
    return { moveX: 0, jump: false, punch: false, special: false };
  }

  const fight = player.fight;
  const targetFight = target.fight;
  const dx = targetFight.fx - fight.fx;
  const distance = Math.abs(dx);
  const aligned = Math.abs(targetFight.fy - fight.fy) < 60;
  const sign = dx > 10 ? 1 : dx < -10 ? -1 : 0;
  const inFront = (fight.facing === 1 && dx > 0) || (fight.facing === -1 && dx < 0);
  const punchRange = CHARACTERS[player.character].punchRange;

  let moveX: -1 | 0 | 1 = 0;
  if (distance > punchRange * 0.8) {
    moveX = sign;
  } else if (distance < 35 && sign !== 0) {
    moveX = (sign * -1) as -1 | 1;
  }

  const punch = aligned && inFront && distance < punchRange * 0.95;

  let special = false;
  if (player.character === 'lion') {
    special = aligned && distance < 140;
  } else if (player.character === 'wolf') {
    special = aligned && distance < 110;
  } else if (player.character === 'unicorn') {
    special = fight.hp < 45 || distance < 55;
  }

  const jump =
    fight.grounded &&
    distance > 70 &&
    distance < 150 &&
    Math.random() < 0.015;

  return { moveX, jump, punch, special };
}
