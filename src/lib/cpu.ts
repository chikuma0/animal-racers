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

export interface CpuFightState {
  decisionCooldownMs: number;
  actionHoldMs: number;
  jumpCooldownMs: number;
  specialIntentCooldownMs: number;
  driftBias: number;
  driftTimerMs: number;
  lastMoveX: -1 | 0 | 1;
  queuedPunch: boolean;
  queuedSpecial: boolean;
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

export function createCpuFightState(): CpuFightState {
  return {
    decisionCooldownMs: 0,
    actionHoldMs: 0,
    jumpCooldownMs: 0,
    specialIntentCooldownMs: 0,
    driftBias: 0.5,
    driftTimerMs: 0,
    lastMoveX: 0,
    queuedPunch: false,
    queuedSpecial: false,
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

export function stepCpuFightState(
  brain: CpuFightState,
  player: PlayerState,
  target: PlayerState,
  dt: number
): { brain: CpuFightState; inputs: CpuFightInputs } {
  if (!player.character) {
    return {
      brain,
      inputs: { moveX: 0, jump: false, punch: false, special: false },
    };
  }

  const fight = player.fight;
  const targetFight = target.fight;
  const next: CpuFightState = {
    ...brain,
    decisionCooldownMs: Math.max(0, brain.decisionCooldownMs - dt),
    actionHoldMs: Math.max(0, brain.actionHoldMs - dt),
    jumpCooldownMs: Math.max(0, brain.jumpCooldownMs - dt),
    specialIntentCooldownMs: Math.max(0, brain.specialIntentCooldownMs - dt),
    driftTimerMs: Math.max(0, brain.driftTimerMs - dt),
  };

  if (fight.dead || fight.freezeTimer > 0 || fight.hitStunTimer > 0) {
    next.lastMoveX = 0;
    next.queuedPunch = false;
    next.queuedSpecial = false;
    return {
      brain: next,
      inputs: { moveX: 0, jump: false, punch: false, special: false },
    };
  }

  if (next.driftTimerMs <= 0) {
    next.driftBias = 0.2 + Math.random() * 0.6;
    next.driftTimerMs = 320 + Math.random() * 380;
  }

  const dx = targetFight.fx - fight.fx;
  const distance = Math.abs(dx);
  const aligned = Math.abs(targetFight.fy - fight.fy) < 60;
  const sign = dx > 10 ? 1 : dx < -10 ? -1 : 0;
  const inFront = (fight.facing === 1 && dx > 0) || (fight.facing === -1 && dx < 0);
  const punchRange = CHARACTERS[player.character].punchRange;
  let moveX = next.lastMoveX;
  let jump = false;
  let punch = false;
  let special = false;

  if (next.actionHoldMs > 0) {
    return {
      brain: next,
      inputs: {
        moveX,
        jump: false,
        punch: next.queuedPunch,
        special: next.queuedSpecial,
      },
    };
  }

  if (next.decisionCooldownMs > 0) {
    return {
      brain: next,
      inputs: { moveX, jump: false, punch: false, special: false },
    };
  }

  next.queuedPunch = false;
  next.queuedSpecial = false;
  next.decisionCooldownMs = 140 + Math.random() * 170;

  const desiredRange = Math.max(40, punchRange * (0.68 + next.driftBias * 0.22));
  const retreatRange = Math.max(30, punchRange * 0.45);
  const punchReady = fight.punchCooldown <= 0 && !fight.punching && !fight.dashActive;
  const specialReady = fight.specialCooldown <= 0 && !fight.specialActive && !fight.dashActive;
  const targetPressing = distance < punchRange * 0.9 && (targetFight.punching || targetFight.specialActive);

  if (distance > desiredRange + 12) {
    moveX = sign;
  } else if (distance < retreatRange && sign !== 0) {
    moveX = (sign * -1) as -1 | 1;
  } else {
    moveX = Math.random() < 0.55 ? 0 : (next.driftBias > 0.5 ? 1 : -1);
  }

  if (Math.random() < 0.2) {
    moveX = 0;
  }

  if (
    fight.grounded &&
    next.jumpCooldownMs <= 0 &&
    distance > 80 &&
    distance < 150 &&
    Math.random() < 0.08
  ) {
    jump = true;
    next.jumpCooldownMs = 900 + Math.random() * 500;
  }

  if (
    punchReady &&
    aligned &&
    inFront &&
    distance < punchRange * 0.86 &&
    Math.random() < (targetPressing ? 0.38 : 0.52)
  ) {
    punch = true;
    next.queuedPunch = true;
    next.actionHoldMs = 70;
    moveX = 0;
  }

  if (specialReady && next.specialIntentCooldownMs <= 0) {
    if (
      player.character === 'lion' &&
      aligned &&
      inFront &&
      distance > 70 &&
      distance < 120 &&
      Math.random() < 0.16
    ) {
      special = true;
    } else if (
      player.character === 'wolf' &&
      aligned &&
      distance > 80 &&
      distance < 115 &&
      targetFight.freezeTimer <= 0 &&
      Math.random() < 0.1
    ) {
      special = true;
    } else if (
      player.character === 'unicorn' &&
      (fight.hp < 32 || targetPressing) &&
      distance < 95 &&
      Math.random() < 0.22
    ) {
      special = true;
    }
  }

  if (special) {
    next.queuedSpecial = true;
    next.specialIntentCooldownMs = 1100 + Math.random() * 600;
    next.actionHoldMs = 90;
    moveX = 0;
  }

  next.lastMoveX = moveX;

  return {
    brain: next,
    inputs: { moveX, jump, punch, special },
  };
}
