import { CPU_DIFFICULTY_SETTINGS, type CpuDifficulty } from './difficulty';
import { courseCurvature } from './course';
export { courseCenter, courseSlope, courseCurvature, COURSE_MAX_SECOND_DERIVATIVE } from './course';

/** Deterministic, serializable championship authority. All times are seconds. */
export type CharacterId = 'lion' | 'wolf' | 'unicorn';
export type Phase = 'countdown' | 'race' | 'transition' | 'fight' | 'results';
export type Slot = 0 | 1;
export interface Input { move: number; jump: boolean; attack: boolean; special: boolean; guard: boolean; cancelAttack?: boolean }
export interface GameEvent { id: number; type: string; slot: number; x: number; z: number; strikeKind?: 'quick' | 'power' }
export interface Championship {
  race: [number, number]; fight: [number, number]; total: [number, number];
  winner: Slot | null; reason: string;
}
export interface Racer {
  character: CharacterId; x: number; z: number; y: number; speed: number;
  finishTime: number | null; hp: number; facing: 1 | -1; action: string;
  actionTime: number; stun: number; invulnerable: number; cooldown: number;
  guard: number; energy: number; boost: number;
  draft: number; drafting: boolean; dodgeCooldown: number; dodgeDirection: 1 | -1;
  counterWindow: number; strikeWindup: number; strikeCounter: boolean; strikeId: number;
  strikeKind: 'quick' | 'power';
  comboStep: 0 | 1; comboWindow: number; comboPending: boolean; comboTarget: Slot | null; comboSourceId: number;
  lastHitBy: Slot | null; lastHitStrike: number; slow: number; ward: boolean;
  vy: number; connected: boolean; raceStatus: 'running' | 'finished' | 'dnf'; raceProgress: number;
  hitObstacles: number[]; attackConnected: boolean; previous: Input;
  buffer: { jump: number; attack: number; special: number };
  guardRecovery: number; guardBroken: boolean; ai: { nextTick: number; nextAttackTick: number; input: Input };
}
export interface Match {
  /** Present only in local CPU matches; serialized so replays keep their balance. */
  soloCpu?: { slot: Slot; difficulty: CpuDifficulty };
  format: 'championship' | 'duel';
  phase: Phase; phaseTime: number; tick: number; seed: number;
  players: [Racer, Racer]; raceTime: number; fightTime: number;
  result: Championship | null; events: GameEvent[];
  eventSequence: number; phaseTick: number; raceTicks: number; fightTicks: number;
  hitPause: number;
  fightEnd: 'pending' | 'knockout' | 'double-knockout' | 'timeout' | 'disconnect';
}
export const FIXED_DT = 1 / 60;
export const COURSE_LENGTH = 500;
export const RACE_DURATION = 95;
export const FIGHT_DURATION = 60;
export const COUNTDOWN_DURATION = 3;
export const TRANSITION_DURATION = 4;
/** Nominal ground speed shared with the renderer's authored-run cadence. */
export const RUN_SPEED = 8;
export const RACE_GAP_FOR_FULL_POOL = 4;
export const CHARACTERS = {
  lion: { name: 'Fire Lion', special: 'Sunset Strike', description: 'Quick one–two strikes and a flame body blow that pressures guard.' },
  wolf: { name: 'Water Wolf', special: 'Creek Slash', description: 'Fast footwork and a frost sweep that briefly slows movement.' },
  unicorn: { name: 'Rainbow Unicorn', special: 'Prism Strike', description: 'Hoof strikes and a prism push that spends guard on one protective ward.' },
} as const;

export interface Obstacle { id: number; z: number; x: number; width: number; kind: 'hurdle' | 'barrel' | 'arch' }
/** Twelve readable choices at a steady rhythm, with 30m+ anticipation between rows. */
export const OBSTACLES: readonly Obstacle[] = [
  { id: 0, z: 42, x: 0, width: 4.4, kind: 'hurdle' },
  { id: 1, z: 80, x: 0, width: 2.2, kind: 'barrel' },
  { id: 2, z: 118, x: -2.1, width: 4.4, kind: 'arch' },
  { id: 3, z: 156, x: -2.6, width: 1.6, kind: 'barrel' },
  { id: 4, z: 156, x: 2.6, width: 1.6, kind: 'barrel' },
  { id: 5, z: 194, x: 0, width: 8.6, kind: 'hurdle' },
  { id: 6, z: 232, x: 2.1, width: 4.4, kind: 'arch' },
  { id: 7, z: 270, x: -1.8, width: 4.8, kind: 'hurdle' },
  { id: 8, z: 308, x: 0, width: 2.2, kind: 'barrel' },
  { id: 9, z: 346, x: -2.1, width: 4.4, kind: 'arch' },
  { id: 10, z: 384, x: -2.6, width: 1.6, kind: 'barrel' },
  { id: 11, z: 384, x: 2.6, width: 1.6, kind: 'barrel' },
  { id: 12, z: 422, x: 0, width: 8.6, kind: 'hurdle' },
  { id: 13, z: 460, x: 2.1, width: 4.4, kind: 'arch' },
];
export const RACE = { lateralSpeed: 5.2, acceleration: 6.5, leapVelocity: 7.6, gravity: 20,
  stumbleDuration: .32, stumbleSpeed: 5.6, turnDrift: 1.25, maxTurnDrift: .85, bodyGap: 3, bodyWidth: 1.5,
  shoulderStart: 3.6, shoulderSpeed: .88,
  draftMinGap: 3, draftMaxGap: 12, draftWidth: 1.7, draftCharge: 1.2, draftDecay: 4, draftSpeed: .35 } as const;
/** Following aid stays inside the visible trail and cannot carry through a pass. */
export function draftWidthAtGap(gap: number): number {
  return RACE.draftWidth - .45 * Math.max(0, Math.min(1, (gap - RACE.bodyGap) / (RACE.draftMaxGap - RACE.bodyGap)));
}
export interface Attack { windup: number; active: number; recovery: number; reach: number; damage: number; stun: number; knockback: number }
const LION_STRIKE: Attack = { windup: .70, active: .14, recovery: .82, reach: 1.85, damage: 30, stun: .22, knockback: 1.20 };
/** `attack` is a legacy timing fallback. Gameplay always uses the species entry. */
export const ATTACKS: Readonly<Record<'attack' | CharacterId, Attack>> = {
  attack: LION_STRIKE, lion: LION_STRIKE,
  wolf: { windup: .64, active: .12, recovery: .68, reach: 1.85, damage: 21, stun: .16, knockback: .65 },
  unicorn: { windup: .66, active: .14, recovery: .78, reach: 1.85, damage: 26, stun: .20, knockback: 1.05 },
};
export const QUICK_ATTACKS: Readonly<Record<CharacterId, Attack>> = {
  lion: { windup: .18, active: .10, recovery: .40, reach: 1.85, damage: 12, stun: .12, knockback: .50 },
  wolf: { windup: .14, active: .10, recovery: .36, reach: 1.85, damage: 9, stun: .10, knockback: .40 },
  unicorn: { windup: .16, active: .10, recovery: .38, reach: 1.85, damage: 10, stun: .11, knockback: .45 },
};
export const COMBO_ATTACKS: Readonly<Record<CharacterId, Attack>> = {
  lion: { ...QUICK_ATTACKS.lion, damage: 14, recovery: .54, knockback: .75 },
  wolf: { ...QUICK_ATTACKS.wolf, damage: 11, recovery: .50, knockback: .65 },
  unicorn: { ...QUICK_ATTACKS.unicorn, damage: 12, recovery: .52, knockback: .70 },
};
export const COMBO = { window: .48, linkRecovery: .04, stepSpeed: 3.6, stepWindow: .12 } as const;
export const GUARD = { moveFactor: .35, regen: 18, recovery: .9, resume: 30, breakStun: .30, quickDamageFactor: 1.3, powerChip: 2 } as const;
export const POWER_RULES = {
  lion: { guardDamage: 65, stepSpeed: 2.4, stepWindow: .10 },
  wolf: { guardDamage: 48, slowDuration: .9, slowFactor: .65 },
  unicorn: { guardDamage: 55, wardCost: 30, wardStart: .10, wardEnd: .72 },
} as const;
export const HIT_PAUSE = { quick: 2, power: 4 } as const;
export const FIGHT_SPEED: Readonly<Record<CharacterId, number>> = { lion: 3.4, wolf: 4.2, unicorn: 3.6 };
export const FIGHT_BODY_GAP = 1.75;
export const FIGHT_BOUND = 4.4;
export const COUNTER_WINDOW = .95;
export const COUNTER_WINDUP = .08;
export interface Dodge { duration: number; invulnerableStart: number; invulnerableEnd: number; speed: number; cooldown: number }
export const DODGE: Readonly<Record<CharacterId, Dodge>> = {
  lion: { duration: .40, invulnerableStart: .06, invulnerableEnd: .30, speed: 2.8, cooldown: 1.25 },
  wolf: { duration: .38, invulnerableStart: .05, invulnerableEnd: .29, speed: 3.6, cooldown: 1.10 },
  unicorn: { duration: .42, invulnerableStart: .04, invulnerableEnd: .36, speed: 2.2, cooldown: 1.35 },
};
export function strikeTiming(player: Racer): Attack {
  const base = player.strikeKind === 'power' ? ATTACKS[player.character] : player.comboStep === 1 ? COMBO_ATTACKS[player.character] : QUICK_ATTACKS[player.character];
  return player.action === 'attack' ? { ...base, windup: player.strikeWindup } : base;
}
export function strikePhase(player: Racer): 'none' | 'windup' | 'active' | 'recovery' {
  if (player.action !== 'attack') return 'none';
  if (player.actionTime + 1e-8 < player.strikeWindup) return 'windup';
  return player.actionTime < player.strikeWindup + strikeTiming(player).active ? 'active' : 'recovery';
}
const EPSILON = 1e-8;
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const tenth = (n: number) => Math.round(n * 10) / 10;
const approach = (n: number, target: number, amount: number) => n + clamp(target - n, -amount, amount);
export const neutralInput = (): Input => ({ move: 0, jump: false, attack: false, special: false, guard: false, cancelAttack: false });
function cleanInput(input: Input): Input {
  return { move: Number.isFinite(input.move) ? clamp(input.move, -1, 1) : 0,
    jump: input.jump === true, attack: input.attack === true, special: input.special === true, guard: input.guard === true, cancelAttack: input.cancelAttack === true };
}
function newRacer(character: CharacterId, slot: Slot): Racer {
  return { character, x: slot === 0 ? -1.25 : 1.25, z: 0, y: 0, speed: 0, finishTime: null,
    hp: 100, facing: slot === 0 ? 1 : -1, action: 'race_idle', actionTime: 0, stun: 0,
    invulnerable: 0, cooldown: 0, guard: 100, energy: 100, boost: 0, vy: 0,
    draft: 0, drafting: false, dodgeCooldown: 0, dodgeDirection: slot === 0 ? -1 : 1,
    counterWindow: 0, strikeWindup: QUICK_ATTACKS[character].windup, strikeCounter: false, strikeId: 0, strikeKind: 'quick',
    comboStep: 0, comboWindow: 0, comboPending: false, comboTarget: null, comboSourceId: 0, lastHitBy: null, lastHitStrike: 0, slow: 0, ward: false,
    connected: true, raceStatus: 'running', raceProgress: 0, hitObstacles: [], attackConnected: false,
    previous: neutralInput(), buffer: { jump: 0, attack: 0, special: 0 }, guardRecovery: 0, guardBroken: false, ai: { nextTick: 0, nextAttackTick: 0, input: neutralInput() } };
}
export function createMatch(characters: [CharacterId, CharacterId], seed = 1): Match {
  for (const character of characters) if (!Object.hasOwn(CHARACTERS, character)) throw new Error('Unknown character');
  return { format: 'championship', phase: 'countdown', phaseTime: 0, tick: 0, seed: seed >>> 0,
    players: [newRacer(characters[0], 0), newRacer(characters[1], 1)],
    raceTime: 0, fightTime: 0, result: null, events: [], eventSequence: 0,
    phaseTick: 0, raceTicks: 0, fightTicks: 0, hitPause: 0, fightEnd: 'pending' };
}
/** Solo practice uses the real intro and duel authority, with no invented race result. */
export function createDuelMatch(characters: [CharacterId, CharacterId], seed = 1): Match {
  const match = createMatch(characters, seed); match.format = 'duel';
  for (const player of match.players) action(player, 'transform');
  phase(match, 'transition'); return match;
}
function event(match: Match, type: string, slot: number, position?: { x: number; z: number }, strikeKind?: 'quick' | 'power') {
  const player = match.players[slot === 1 ? 1 : 0];
  match.events.push({ id: ++match.eventSequence, type, slot, x: position?.x ?? player.x, z: position?.z ?? player.z, ...(strikeKind ? { strikeKind } : {}) });
  if (match.events.length > 48) match.events.splice(0, match.events.length - 48);
}
function action(player: Racer, name: string) {
  if (player.action !== name) { player.action = name; player.actionTime = 0; }
}
function phase(match: Match, name: Phase) {
  match.phase = name; match.phaseTime = 0; match.phaseTick = 0;
  for (const player of match.players) { player.previous = neutralInput(); player.ai.nextTick = 0; player.ai.nextAttackTick = 0; }
  event(match, name, -1);
}
function timers(player: Racer) {
  player.actionTime += FIXED_DT;
  for (const key of ['stun', 'invulnerable', 'cooldown', 'boost', 'guardRecovery', 'dodgeCooldown', 'counterWindow', 'comboWindow', 'slow'] as const) {
    player[key] = Math.max(0, player[key] - FIXED_DT);
  }
  player.energy = Math.min(100, player.energy + FIXED_DT * 10);
}
function jump(match: Match, player: Racer, slot: Slot, velocity: number) {
  player.vy = velocity; action(player, 'jump'); event(match, 'jump', slot);
}
function gravity(match: Match, player: Racer, slot: Slot, acceleration: number): boolean {
  if (player.y <= 0 && player.vy <= 0) return false;
  player.y = Math.max(0, player.y + player.vy * FIXED_DT - acceleration * FIXED_DT * FIXED_DT / 2);
  player.vy -= acceleration * FIXED_DT;
  if (player.y === 0) { player.vy = 0; event(match, 'land', slot); return true; }
  return false;
}
function stepRace(match: Match, inputs: [Input, Input]) {
  match.raceTicks++; match.raceTime = match.raceTicks * FIXED_DT;
  const before = match.players.map(player => ({ x: player.x, z: player.z, y: player.y, status: player.raceStatus }));
  match.players.forEach((player, index) => {
    const slot = index as Slot, other = slot === 0 ? 1 : 0, input = inputs[slot];
    timers(player);
    if (player.raceStatus !== 'running') {
      player.speed = 0; player.drafting = false;
      const landed = gravity(match, player, slot, RACE.gravity);
      if (player.y > 0) action(player, 'jump'); else if (landed) action(player, 'land');
      else if (player.action !== 'land' || player.actionTime >= .16) action(player, 'race_idle');
      return;
    }
    const gap = before[other].z - before[slot].z;
    const drafting = before[other].status === 'running' && gap >= RACE.draftMinGap && gap <= RACE.draftMaxGap
      && Math.abs(before[other].x - before[slot].x) <= draftWidthAtGap(gap) && player.stun === 0;
    if (drafting && !player.drafting) event(match, 'draft-start', slot);
    const oldDraft = player.draft;
    player.drafting = drafting;
    player.draft = drafting ? clamp(player.draft + FIXED_DT / RACE.draftCharge, 0, 1) : 0;
    if (oldDraft < 1 && player.draft === 1) event(match, 'draft-ready', slot);
    const drift = clamp(-courseCurvature(player.z) * player.speed * player.speed * RACE.turnDrift, -RACE.maxTurnDrift, RACE.maxTurnDrift);
    const priorX = player.x;
    player.x = clamp(player.x + (input.move * RACE.lateralSpeed * (player.stun > 0 ? .7 : 1) + drift) * FIXED_DT, -4.3, 4.3);
    if (input.jump && !player.previous.jump && player.y === 0 && player.stun === 0) jump(match, player, slot, RACE.leapVelocity);
    const landed = gravity(match, player, slot, RACE.gravity);
    const shoulder = Math.abs(player.x) > RACE.shoulderStart ? RACE.shoulderSpeed : 1;
    const pursuit = drafting ? RACE.draftSpeed * player.draft * clamp((gap - RACE.draftMinGap) / 3, 0, 1) : 0;
    const cpuPace = match.soloCpu?.slot === slot ? CPU_DIFFICULTY_SETTINGS[match.soloCpu.difficulty].racePace : 1;
    const targetPace = (player.stun > 0 ? RACE.stumbleSpeed : (RUN_SPEED + pursuit) * shoulder) * cpuPace;
    // Lateral travel spends part of the same pace budget; clean steering cancels drift.
    const lateralSpeed = (player.x - priorX) / FIXED_DT;
    const targetSpeed = Math.sqrt(Math.max(0, targetPace * targetPace - lateralSpeed * lateralSpeed));
    const priorSpeed = player.speed;
    player.speed = approach(player.speed, targetSpeed, RACE.acceleration * FIXED_DT);
    player.z += (priorSpeed + player.speed) * .5 * FIXED_DT;
    if (player.stun > 0) action(player, 'stumble'); else if (player.y > 0) action(player, 'jump');
    else if (landed) action(player, 'land'); else if (player.action !== 'land' || player.actionTime >= .16) action(player, 'run');
  });
  const [first, second] = match.players;
  if (first.raceStatus === 'running' && second.raceStatus === 'running'
      && Math.abs(first.z - second.z) < RACE.bodyGap && Math.abs(first.x - second.x) < RACE.bodyWidth) {
    const oldGap = before[1].z - before[0].z;
    if (Math.abs(oldGap) >= RACE.bodyGap - EPSILON) {
      const follower = oldGap > 0 ? first : second, leader = oldGap > 0 ? second : first;
      follower.z = Math.max(before[oldGap > 0 ? 0 : 1].z, leader.z - RACE.bodyGap);
      follower.speed = Math.min(follower.speed, leader.speed);
    } else {
      const order = Math.sign(before[1].x - before[0].x) || 1;
      const center = clamp((first.x + second.x) / 2, -4.3 + RACE.bodyWidth / 2, 4.3 - RACE.bodyWidth / 2);
      first.x = center - order * RACE.bodyWidth / 2; second.x = center + order * RACE.bodyWidth / 2;
    }
  }
  const oldGap = before[1].z - before[0].z, newGap = second.z - first.z;
  if (before.every(player => player.status === 'running') && oldGap * newGap < 0) {
    const crossing = oldGap / (oldGap - newGap);
    const crossingZ = before[0].z + (first.z - before[0].z) * crossing;
    // Projected finish overshoot can reverse order after the race has ended.
    if (crossingZ < COURSE_LENGTH - EPSILON) {
      const slot: Slot = newGap < 0 ? 0 : 1;
      event(match, 'pass', slot, { x: before[slot].x + (match.players[slot].x - before[slot].x) * crossing, z: crossingZ });
    }
  }
  match.players.forEach((player, index) => {
    if (player.raceStatus !== 'running') return;
    for (const obstacle of OBSTACLES) {
      if (obstacle.z < before[index].z || obstacle.z > player.z || player.hitObstacles.includes(obstacle.id)) continue;
      const crossing = clamp((obstacle.z - before[index].z) / Math.max(EPSILON, player.z - before[index].z), 0, 1);
      const crossingX = before[index].x + (player.x - before[index].x) * crossing;
      const crossingY = before[index].y + (player.y - before[index].y) * crossing;
      const clears = obstacle.kind !== 'arch' && crossingY > (obstacle.kind === 'hurdle' ? .65 : .8);
      if (Math.abs(crossingX - obstacle.x) < obstacle.width / 2 + .32 && !clears) {
        player.hitObstacles.push(obstacle.id); player.stun = RACE.stumbleDuration; player.speed = Math.min(player.speed, RACE.stumbleSpeed);
        player.draft *= .5; player.drafting = false; action(player, 'stumble'); event(match, 'obstacle', index); break;
      }
    }
    if (player.z >= COURSE_LENGTH) {
      player.finishTime = (match.raceTicks - 1 + clamp((COURSE_LENGTH - before[index].z) / Math.max(EPSILON, player.z - before[index].z), 0, 1)) * FIXED_DT;
      player.z = COURSE_LENGTH; player.speed = 0; player.raceStatus = 'finished'; player.drafting = false;
      if (player.y === 0) action(player, 'race_idle'); event(match, 'finish', index);
    }
    player.raceProgress = player.z;
  });
  if (match.raceTime >= RACE_DURATION || match.players.every(player => player.raceStatus !== 'running')) {
    for (const player of match.players) {
      if (player.raceStatus === 'running') player.raceStatus = 'dnf';
      player.speed = 0; player.y = 0; player.vy = 0; player.drafting = false; action(player, 'transform');
    }
    phase(match, 'transition');
  }
}
function startFight(match: Match) {
  match.players.forEach((player, index) => {
    player.x = index === 0 ? -1.75 : 1.75; player.z = 0; player.y = 0; player.vy = 0;
    player.facing = index === 0 ? 1 : -1; player.hp = 100; player.energy = 100; player.guard = 100;
    player.stun = 0; player.invulnerable = 0; player.cooldown = 0; player.boost = 0;
    player.draft = 0; player.drafting = false; player.dodgeCooldown = 0; player.counterWindow = 0;
    player.strikeWindup = QUICK_ATTACKS[player.character].windup; player.strikeCounter = false; player.strikeId = 0;
    player.strikeKind = 'quick';
    player.comboStep = 0; player.comboWindow = 0; player.comboPending = false; player.comboTarget = null; player.comboSourceId = 0;
    player.lastHitBy = null; player.lastHitStrike = 0; player.slow = 0; player.ward = false;
    player.guardRecovery = 0; player.guardBroken = false; player.attackConnected = false; action(player, 'fight_idle');
    player.buffer = { jump: 0, attack: 0, special: 0 };
  });
  match.hitPause = 0; phase(match, 'fight');
}
function clearIntents(player: Racer) {
  player.buffer = { jump: 0, attack: 0, special: 0 }; player.comboPending = false; player.comboWindow = 0;
}
function fightIntent(player: Racer, input: Input) {
  if (input.cancelAttack) { clearIntents(player); return; }
  if (input.attack && !player.previous.attack) {
    if (player.action === 'attack' && player.strikeKind === 'quick' && player.comboStep === 0 && player.attackConnected && player.comboWindow > 0) player.comboPending = true;
    else player.buffer.attack = .14;
  }
  if (input.special && !player.previous.special) player.buffer.special = .14;
  if (input.jump && !player.previous.jump) player.buffer.jump = .14;
}
function startStrike(match: Match, player: Racer, slot: Slot, kind: 'quick' | 'power', second = false) {
  player.strikeKind = kind; player.comboStep = second ? 1 : 0;
  player.strikeCounter = kind === 'quick' && !second && player.counterWindow > 0;
  const spec = kind === 'power' ? ATTACKS[player.character] : second ? COMBO_ATTACKS[player.character] : QUICK_ATTACKS[player.character];
  player.strikeWindup = player.strikeCounter ? COUNTER_WINDUP : spec.windup;
  player.counterWindow = 0; player.strikeId++; player.attackConnected = false; player.comboPending = false; player.comboWindow = 0;
  if (!second) { player.comboTarget = null; player.comboSourceId = 0; }
  player.buffer.attack = 0; player.buffer.special = 0; player.ward = false;
  if (kind === 'power' && player.character === 'unicorn' && !player.guardBroken && player.guard >= POWER_RULES.unicorn.wardCost) {
    player.guard -= POWER_RULES.unicorn.wardCost; player.guardRecovery = GUARD.recovery; player.ward = true;
    if (player.guard === 0) player.guardBroken = true;
  }
  player.action = 'attack'; player.actionTime = 0;
  event(match, player.strikeCounter ? 'counter' : second ? 'combo' : kind === 'power' ? 'power' : 'attack', slot);
}
function stepFight(match: Match, inputs: [Input, Input]) {
  match.fightTicks++; match.fightTime = match.fightTicks * FIXED_DT;
  match.players.forEach((player, index) => fightIntent(player, inputs[index]));
  if (match.hitPause > 0) {
    match.hitPause--;
    if (match.fightTime >= FIGHT_DURATION) { match.fightEnd = 'timeout'; endMatch(match); }
    return;
  }
  const initialPositions = match.players.map(player => player.x);
  const initialOrder = Math.sign(initialPositions[1] - initialPositions[0]) || match.players[0].facing;
  match.players.forEach((player, index) => {
    const slot = index as Slot, input = inputs[slot], spec = strikeTiming(player), dodge = DODGE[player.character];
    timers(player); player.y = 0; player.vy = 0;
    for (const key of ['jump', 'attack', 'special'] as const) player.buffer[key] = Math.max(0, player.buffer[key] - FIXED_DT);
    if (player.comboWindow === 0) player.comboPending = false;
    if (!input.guard && player.guardRecovery === 0 && player.stun === 0 && player.action !== 'attack') {
      player.guard = Math.min(100, player.guard + GUARD.regen * FIXED_DT);
      if (player.guard >= GUARD.resume) player.guardBroken = false;
    }
    if ((player.action === 'attack' && player.actionTime + EPSILON >= spec.windup + spec.active + spec.recovery)
      || (player.action === 'evade' && player.actionTime + EPSILON >= dodge.duration)) { player.ward = false; action(player, 'fight_idle'); }
    if (player.stun > 0) { player.comboPending = false; player.comboWindow = 0; player.ward = false; action(player, 'hit'); return; }
    if (player.action === 'attack' && player.strikeKind === 'quick' && player.comboStep === 0 && player.comboPending
        && player.actionTime + EPSILON >= player.strikeWindup + spec.active + COMBO.linkRecovery) {
      startStrike(match, player, slot, 'quick', true);
    }
    if (player.action !== 'attack' && player.action !== 'evade') {
      const offset = initialPositions[slot === 0 ? 1 : 0] - initialPositions[slot];
      if (offset !== 0) player.facing = offset > 0 ? 1 : -1;
      if (player.buffer.jump > 0 && player.dodgeCooldown === 0) {
        clearIntents(player); player.ward = false; player.dodgeCooldown = dodge.cooldown;
        player.dodgeDirection = Math.abs(input.move) > .2 ? (input.move > 0 ? 1 : -1) : player.facing === 1 ? -1 : 1;
        action(player, 'evade'); event(match, 'evade', slot);
      } else if (player.buffer.special > 0) startStrike(match, player, slot, 'power');
      else if (player.buffer.attack > 0) startStrike(match, player, slot, 'quick');
      else {
        const guarding = input.guard && !player.guardBroken && player.guard > 0;
        action(player, guarding ? 'guard' : Math.abs(input.move) > .05 ? 'fight_move' : 'fight_idle');
        const modifier = (guarding ? GUARD.moveFactor : 1) * (player.slow > 0 ? POWER_RULES.wolf.slowFactor : 1);
        player.x = clamp(player.x + input.move * FIGHT_SPEED[player.character] * modifier * FIXED_DT, -FIGHT_BOUND, FIGHT_BOUND);
      }
    }
    if (player.action === 'evade') player.x = clamp(player.x + player.dodgeDirection * dodge.speed * FIXED_DT, -FIGHT_BOUND, FIGHT_BOUND);
    if (player.action === 'attack' && player.strikeKind === 'power' && player.character === 'lion'
        && player.actionTime >= player.strikeWindup - POWER_RULES.lion.stepWindow && player.actionTime < player.strikeWindup) {
      player.x = clamp(player.x + player.facing * POWER_RULES.lion.stepSpeed * FIXED_DT, -FIGHT_BOUND, FIGHT_BOUND);
    }
    if (player.action === 'attack' && player.strikeKind === 'quick' && player.comboStep === 1
        && player.actionTime >= player.strikeWindup - COMBO.stepWindow && player.actionTime < player.strikeWindup) {
      player.x = clamp(player.x + player.facing * COMBO.stepSpeed * FIXED_DT, -FIGHT_BOUND, FIGHT_BOUND);
    }
  });
  if ((match.players[1].x - match.players[0].x) * initialOrder < FIGHT_BODY_GAP) {
    const center = clamp((match.players[0].x + match.players[1].x) / 2, -FIGHT_BOUND + FIGHT_BODY_GAP / 2, FIGHT_BOUND - FIGHT_BODY_GAP / 2);
    match.players[0].x = center - FIGHT_BODY_GAP / 2 * initialOrder; match.players[1].x = center + FIGHT_BODY_GAP / 2 * initialOrder;
  }
  type Contact = { attacker: Slot; defender: Slot; attack: Attack; facing: 1 | -1; kind: 'quick' | 'power'; strikeId: number; blocked: boolean; warded: boolean };
  const contacts: Contact[] = [];
  match.players.forEach((player, index) => {
    const slot = index as Slot, other = (slot === 0 ? 1 : 0) as Slot, defender = match.players[other];
    if (strikePhase(player) !== 'active' || player.stun > 0 || player.attackConnected) return;
    const spec = strikeTiming(player), distance = (defender.x - player.x) * player.facing, dodge = DODGE[defender.character];
    if (distance < 0) return;
    const evading = defender.action === 'evade' && defender.actionTime + EPSILON >= dodge.invulnerableStart;
    if (evading && (defender.actionTime <= dodge.invulnerableEnd + EPSILON || distance > spec.reach)
        && distance <= spec.reach + dodge.speed * dodge.duration + .25) {
      player.attackConnected = true; defender.counterWindow = COUNTER_WINDOW; event(match, 'evade-success', other); return;
    }
    if (distance > spec.reach) return;
    player.attackConnected = true;
    const chainContact = player.strikeKind === 'quick' && player.comboStep === 1 && player.comboTarget === other
      && defender.lastHitBy === slot && defender.lastHitStrike === player.comboSourceId;
    if (defender.invulnerable > 0 && !chainContact) return;
    const frontal = (player.x - defender.x) * defender.facing >= 0;
    const warded = player.strikeKind === 'quick' && frontal && defender.ward && defender.action === 'attack'
      && defender.actionTime >= POWER_RULES.unicorn.wardStart && defender.actionTime <= POWER_RULES.unicorn.wardEnd;
    const blocked = frontal && defender.action === 'guard' && !defender.guardBroken && defender.guard > 0;
    contacts.push({ attacker: slot, defender: other, attack: spec, facing: player.facing, kind: player.strikeKind, strikeId: player.strikeId, blocked, warded });
  });
  // Snapshot contacts before mutation: same-tick committed strikes still trade.
  for (const contact of contacts) {
    const defender = match.players[contact.defender], attacker = match.players[contact.attacker];
    match.hitPause = Math.max(match.hitPause, HIT_PAUSE[contact.kind]);
    if (attacker.strikeKind === 'quick' && attacker.comboStep === 0) {
      attacker.comboWindow = COMBO.window; attacker.comboTarget = contact.defender; attacker.comboSourceId = contact.strikeId;
    }
    if (contact.warded) { defender.ward = false; event(match, 'ward-block', contact.defender, undefined, contact.kind); continue; }
    const damage = contact.attack.damage, knockback = contact.attack.knockback;
    let stun = contact.attack.stun;
    if (contact.blocked) {
      const cost = contact.kind === 'power' ? POWER_RULES[attacker.character].guardDamage : damage * GUARD.quickDamageFactor;
      defender.guard = Math.max(0, defender.guard - cost); defender.guardRecovery = GUARD.recovery;
      if (defender.guard > 0) { defender.hp = Math.max(0, defender.hp - (contact.kind === 'power' ? GUARD.powerChip : 0)); event(match, 'block', contact.defender, undefined, contact.kind); continue; }
      defender.guardBroken = true; stun = GUARD.breakStun; event(match, 'guard-break', contact.defender, undefined, contact.kind);
    }
    defender.hp = Math.max(0, defender.hp - damage); defender.stun = stun; defender.invulnerable = .65;
    defender.guardRecovery = GUARD.recovery; defender.counterWindow = 0; defender.comboWindow = 0; defender.comboPending = false; defender.ward = false;
    defender.lastHitBy = contact.attacker; defender.lastHitStrike = contact.strikeId;
    if (contact.kind === 'power' && attacker.character === 'wolf') defender.slow = POWER_RULES.wolf.slowDuration;
    const before = defender.x; defender.x = clamp(defender.x + contact.facing * knockback, -FIGHT_BOUND, FIGHT_BOUND);
    const remaining = knockback - Math.abs(defender.x - before);
    if (remaining > 0) attacker.x = clamp(attacker.x - contact.facing * remaining, -FIGHT_BOUND, FIGHT_BOUND);
    action(defender, 'hit'); event(match, 'hit', contact.defender, undefined, contact.kind);
  }
  if (match.players.some(player => player.hp <= 0) || match.fightTime >= FIGHT_DURATION) {
    match.fightEnd = match.players.every(player => player.hp <= 0) ? 'double-knockout' : match.players.some(player => player.hp <= 0) ? 'knockout' : 'timeout';
    endMatch(match);
  }
}
function effectiveRaceTime(player: Racer): number {
  if (player.finishTime !== null && player.raceStatus === 'finished') return clamp(player.finishTime, 0, RACE_DURATION);
  return RACE_DURATION + (COURSE_LENGTH - clamp(player.raceProgress, 0, COURSE_LENGTH)) / RUN_SPEED;
}
function pool(advantage: number, budget = 50): [number, number] {
  const half = budget / 2, delta = half * clamp(advantage, -1, 1);
  const first = tenth(half + Math.sign(delta) * tenth(Math.abs(delta)));
  return [first, tenth(budget - first)];
}
/** Final health and effective race time only: activity counts cannot farm points. */
export function scoreMatch(match: Match): Championship {
  const [first, second] = match.players;
  if (!first.connected || !second.connected) {
    const winner: Slot | null = first.connected === second.connected ? null : first.connected ? 0 : 1;
    if (match.format === 'duel') {
      const fight: [number, number] = winner === null ? [50, 50] : winner === 0 ? [100, 0] : [0, 100];
      return { race: [0, 0], fight, total: [...fight], winner, reason: 'Duel Practice · disconnect forfeit' };
    }
    const race: [number, number] = winner === null ? [25, 25] : winner === 0 ? [50, 0] : [0, 50];
    return { race, fight: [...race], total: [race[0] * 2, race[1] * 2], winner,
      reason: winner === null ? 'Both competitors disconnected · no trophy awarded' : 'Disconnect forfeit · connected rival wins both event pools' };
  }
  if (match.format === 'duel') {
    const fight = pool((clamp(first.hp, 0, 100) - clamp(second.hp, 0, 100)) / 100, 100);
    const winner: Slot | null = fight[0] === fight[1] ? null : fight[0] > fight[1] ? 0 : 1;
    return { race: [0, 0], fight, total: [...fight], winner, reason: `Duel Practice · ${winner === null ? 'draw' : 'final health'}` };
  }
  const race = pool((effectiveRaceTime(second) - effectiveRaceTime(first)) / RACE_GAP_FOR_FULL_POOL);
  const fight = pool((clamp(first.hp, 0, 100) - clamp(second.hp, 0, 100)) / 100);
  const total: [number, number] = [tenth(race[0] + fight[0]), tenth(race[1] + fight[1])];
  const winner: Slot | null = total[0] === total[1] ? null : total[0] > total[1] ? 0 : 1;
  const detail = match.fightEnd === 'double-knockout' ? 'double knockout' : match.fightEnd === 'timeout' ? 'fight timeout' : 'final health';
  const nonfinishers = match.players.filter(player => player.raceStatus === 'dnf').length;
  return { race, fight, total, winner,
    reason: `${winner === null ? 'Championship tied · shared honours' : 'Combined race + fight points'} · ${detail}${nonfinishers ? ` · ${nonfinishers} race DNF scored by progress` : ''}` };
}
function endMatch(match: Match) {
  match.hitPause = 0; match.result = scoreMatch(match); phase(match, 'results');
  match.players.forEach((player, index) => {
    player.speed = 0; player.stun = 0; action(player, match.result!.winner === null || match.result!.winner === index ? 'celebrate' : 'defeat');
  });
}
/** Authoritative terminal forfeit; reconnects require a new match/rematch. */
export function forfeitMatch(match: Match, slot: Slot): void {
  if (match.phase === 'results') return;
  match.players[slot].connected = false; match.fightEnd = 'disconnect'; event(match, 'disconnect', slot); endMatch(match);
}
/** One simulation tick. The caller owns its accumulator and overload policy. */
export function stepMatch(match: Match, rawInputs: [Input, Input], dt: number): void {
  if (!Number.isFinite(dt) || Math.abs(dt - FIXED_DT) > EPSILON) throw new Error('stepMatch requires a fixed 1/60 second timestep');
  if (match.phase === 'results') return;
  if (match.players.some(player => !player.connected)) { match.fightEnd = 'disconnect'; endMatch(match); return; }
  const inputs = rawInputs.map(cleanInput) as [Input, Input];
  match.tick++; match.phaseTick++; match.phaseTime = match.phaseTick * FIXED_DT;
  if (match.phase === 'countdown') {
    if (match.phaseTime >= COUNTDOWN_DURATION) phase(match, 'race');
  } else if (match.phase === 'race') stepRace(match, inputs);
  else if (match.phase === 'transition') {
    for (const player of match.players) player.actionTime += FIXED_DT;
    if (match.phaseTime >= TRANSITION_DURATION) startFight(match);
  } else if (match.phase === 'fight') stepFight(match, inputs);
  for (const slot of [0, 1] as const) match.players[slot].previous = inputs[slot];
}
function noise(seed: number, decision: number, slot: Slot): number {
  let n = (seed ^ Math.imul(decision + 1, 0x45d9f3b) ^ Math.imul(slot + 1, 0x9e3779b9)) >>> 0;
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
/** Ordinary inputs; optional solo settings never change the human's combat rules. */
export function cpuInput(match: Match, slot: Slot): Input {
  const difficulty = match.soloCpu?.slot === slot ? match.soloCpu.difficulty : 'hard';
  const settings = CPU_DIFFICULTY_SETTINGS[difficulty], hard = difficulty === 'hard';
  const player = match.players[slot], rival = match.players[slot === 0 ? 1 : 0];
  if (match.tick < player.ai.nextTick) return { ...player.ai.input };
  const decision = Math.floor(match.tick / 12), roll = noise(match.seed, decision, slot), input = neutralInput();
  player.ai.nextTick = match.tick + settings.decisionTicks + Math.floor(roll * settings.decisionJitter);
  if (match.phase === 'race' && player.raceStatus === 'running') {
    const gap = rival.z - player.z;
    let target = gap > RACE.draftMinGap && gap < 14 ? rival.x : slot === 0 ? -1.3 : 1.3;
    if (gap > 0 && gap < 3.4) target = clamp(rival.x + (rival.x > 0 ? -1 : 1) * 1.8, -3.5, 3.5);
    const upcoming = OBSTACLES.filter(obstacle => obstacle.z > player.z && obstacle.z - player.z < 16);
    const nearest = upcoming[0];
    // One stable read per obstacle, not a fresh chance on each decision.
    if (nearest && (hard || noise(match.seed, nearest.id + 10000, slot) < settings.noticeObstacle)) {
      const row = upcoming.filter(obstacle => obstacle.z === nearest.z);
      const inPath = row.find(obstacle => Math.abs(player.x - obstacle.x) < obstacle.width / 2 + .5);
      if (inPath && inPath.kind !== 'arch') input.jump = inPath.z - player.z < player.speed * .43 && inPath.z - player.z > player.speed * .16;
      else if (inPath) {
        const lanes = [-3, 0, 3].filter(x => row.every(obstacle => Math.abs(x - obstacle.x) > obstacle.width / 2 + .55));
        target = lanes.sort((a, b) => Math.abs(a - player.x) - Math.abs(b - player.x))[0] ?? -Math.sign(inPath.x || 1) * 3.3;
      }
    }
    // Longer decisions also hold steering longer. Scale the correction to avoid
    // oscillating across the track and losing most forward pace to weaving.
    const steeringGain = hard ? 1.6 : .75 / (RACE.lateralSpeed * (player.ai.nextTick - match.tick) * FIXED_DT);
    input.move = clamp((target - player.x) * steeringGain, -1, 1);
  } else if (match.phase === 'fight') {
    const distance = Math.abs(rival.x - player.x), toward = Math.sign(rival.x - player.x), rivalPhase = strikePhase(rival);
    const powerThreat = rival.strikeKind === 'power' && rivalPhase === 'windup' && rival.actionTime >= .16 && distance < 2.4;
    const quickThreat = rival.strikeKind === 'quick' && rival.action === 'attack' && distance < 2.4
      && (rivalPhase === 'windup' || rivalPhase === 'active' || rival.comboStep === 0 && rival.comboWindow > 0);
    // Every incoming strike gets one defense roll. Repeated decisions during a
    // long windup must not turn a small chance into near-perfect defense.
    const defenseRoll = hard ? roll : noise(match.seed, rival.strikeId + 20000, slot);
    const comboRoll = hard ? roll : noise(match.seed, player.strikeId + 30000, slot);
    const free = player.stun === 0 && player.action !== 'attack' && player.action !== 'evade';
    if (player.action === 'attack' && player.strikeKind === 'quick' && player.comboStep === 0 && player.comboWindow > 0 && !player.ai.input.attack && comboRoll < settings.comboChance) input.attack = true;
    else if (free && powerThreat && player.dodgeCooldown === 0 && defenseRoll < settings.evadeChance) { input.jump = true; input.move = -toward; }
    else if (free && !player.guardBroken && player.guard > 20 && distance < 2.2 && (quickThreat ? defenseRoll < settings.threatGuardChance : roll < settings.idleGuardChance)) input.guard = true;
    else if (free) {
      const ready = match.tick >= player.ai.nextAttackTick;
      input.move = distance > 1.81 && (ready || rivalPhase === 'recovery') ? toward * .78 : 0;
      const counterReady = hard && player.counterWindow > 0;
      if (counterReady) input.move = distance > 1.81 ? toward : 0;
      if (match.fightTime >= settings.openingSeconds && distance <= 1.83 && (ready || counterReady)) {
        input.special = player.counterWindow === 0 && ((hard && rival.action === 'guard') || roll < settings.powerChance); input.attack = !input.special;
        player.ai.nextAttackTick = match.tick + settings.attackTicks + Math.floor(roll * settings.attackJitter);
      }
    }
  }
  player.ai.input = input; return { ...input };
}
