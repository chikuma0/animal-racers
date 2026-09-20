import { courseCurvature } from './course';
export { courseCenter, courseSlope, courseCurvature, COURSE_MAX_SECOND_DERIVATIVE } from './course';

/** Deterministic, serializable championship authority. All times are seconds. */
export type CharacterId = 'lion' | 'wolf' | 'unicorn';
export type Phase = 'countdown' | 'race' | 'transition' | 'fight' | 'results';
export type Slot = 0 | 1;
export interface Input { move: number; jump: boolean; attack: boolean; special: boolean; guard: boolean }
export interface GameEvent { id: number; type: string; slot: number; x: number; z: number }
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
  vy: number; connected: boolean; raceStatus: 'running' | 'finished' | 'dnf'; raceProgress: number;
  hitObstacles: number[]; attackConnected: boolean; previous: Input;
  buffer: { jump: number; attack: number; special: number };
  guardRecovery: number; guardBroken: boolean; ai: { nextTick: number; nextAttackTick: number; input: Input };
}
export interface Match {
  phase: Phase; phaseTime: number; tick: number; seed: number;
  players: [Racer, Racer]; raceTime: number; fightTime: number;
  result: Championship | null; events: GameEvent[];
  eventSequence: number; phaseTick: number; raceTicks: number; fightTicks: number;
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
  lion: { name: 'Fire Lion', special: 'Sunset Strike', description: 'A powerful committed strike. Evade the windup, then answer.' },
  wolf: { name: 'Water Wolf', special: 'Creek Slash', description: 'Quick footwork and a lighter strike. Find the opening after an evade.' },
  unicorn: { name: 'Rainbow Unicorn', special: 'Prism Strike', description: 'A protective shimmer extends the evade. Answer with a clear hoof strike.' },
} as const;

export interface Obstacle { id: number; z: number; x: number; width: number; kind: 'hurdle' | 'barrel' | 'arch' }
/** Six readable moments, with long drafting/passing sections between them. */
export const OBSTACLES: readonly Obstacle[] = [
  { id: 0, z: 82, x: 0, width: 4.4, kind: 'hurdle' },
  { id: 1, z: 156, x: -2.6, width: 1.6, kind: 'barrel' },
  { id: 2, z: 156, x: 2.6, width: 1.6, kind: 'barrel' },
  { id: 3, z: 235, x: -2.1, width: 4.4, kind: 'arch' },
  { id: 4, z: 309, x: 0, width: 8.6, kind: 'hurdle' },
  { id: 5, z: 382, x: 2.1, width: 4.4, kind: 'arch' },
  { id: 6, z: 444, x: 0, width: 2.2, kind: 'barrel' },
];
export const RACE = { lateralSpeed: 5.2, acceleration: 6.5, leapVelocity: 7.6, gravity: 20,
  stumbleDuration: .32, stumbleSpeed: 5.6, turnDrift: 1.25, maxTurnDrift: .85, bodyGap: 3, bodyWidth: 1.5,
  shoulderStart: 3.6, shoulderSpeed: .88,
  draftMinGap: .4, draftMaxGap: 12, draftWidth: 1.7, draftCharge: .9, draftDecay: .25, draftSpeed: 1.8 } as const;
/** Rear-quarter entry stays reachable outside shoulder clearance; the far trail narrows. */
export function draftWidthAtGap(gap: number): number {
  return RACE.draftWidth - .45 * Math.max(0, Math.min(1, (gap - RACE.bodyGap) / (RACE.draftMaxGap - RACE.bodyGap)));
}
export interface Attack { windup: number; active: number; recovery: number; reach: number; damage: number; stun: number; knockback: number }
const LION_STRIKE: Attack = { windup: .68, active: .14, recovery: .82, reach: 1.85, damage: 26, stun: .22, knockback: 1.10 };
/** `attack` is a legacy timing fallback. Gameplay always uses the species entry. */
export const ATTACKS: Readonly<Record<'attack' | CharacterId, Attack>> = {
  attack: LION_STRIKE, lion: LION_STRIKE,
  wolf: { windup: .55, active: .12, recovery: .82, reach: 1.85, damage: 18, stun: .18, knockback: .75 },
  unicorn: { windup: .60, active: .14, recovery: .76, reach: 1.85, damage: 22, stun: .20, knockback: .90 },
};
export const FIGHT_SPEED: Readonly<Record<CharacterId, number>> = { lion: 3.4, wolf: 4.2, unicorn: 3.6 };
export const FIGHT_BODY_GAP = 1.75;
export const FIGHT_BOUND = 4.4;
export const COUNTER_WINDOW = .95;
export const COUNTER_WINDUP = .24;
export interface Dodge { duration: number; invulnerableStart: number; invulnerableEnd: number; speed: number; cooldown: number }
export const DODGE: Readonly<Record<CharacterId, Dodge>> = {
  lion: { duration: .40, invulnerableStart: .06, invulnerableEnd: .30, speed: 2.8, cooldown: 1.25 },
  wolf: { duration: .38, invulnerableStart: .05, invulnerableEnd: .29, speed: 3.6, cooldown: 1.10 },
  unicorn: { duration: .42, invulnerableStart: .04, invulnerableEnd: .36, speed: 2.2, cooldown: 1.35 },
};
export function strikeTiming(player: Racer): Attack {
  const base = ATTACKS[player.character];
  return player.action === 'attack' ? { ...base, windup: player.strikeWindup } : base;
}
export function strikePhase(player: Racer): 'none' | 'windup' | 'active' | 'recovery' {
  if (player.action !== 'attack') return 'none';
  if (player.actionTime + 1e-8 < player.strikeWindup) return 'windup';
  return player.actionTime < player.strikeWindup + ATTACKS[player.character].active ? 'active' : 'recovery';
}
const EPSILON = 1e-8;
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const tenth = (n: number) => Math.round(n * 10) / 10;
const approach = (n: number, target: number, amount: number) => n + clamp(target - n, -amount, amount);
export const neutralInput = (): Input => ({ move: 0, jump: false, attack: false, special: false, guard: false });
function cleanInput(input: Input): Input {
  return { move: Number.isFinite(input.move) ? clamp(input.move, -1, 1) : 0,
    jump: input.jump === true, attack: input.attack === true, special: input.special === true, guard: input.guard === true };
}
function newRacer(character: CharacterId, slot: Slot): Racer {
  return { character, x: slot === 0 ? -1.25 : 1.25, z: 0, y: 0, speed: 0, finishTime: null,
    hp: 100, facing: slot === 0 ? 1 : -1, action: 'race_idle', actionTime: 0, stun: 0,
    invulnerable: 0, cooldown: 0, guard: 100, energy: 100, boost: 0, vy: 0,
    draft: 0, drafting: false, dodgeCooldown: 0, dodgeDirection: slot === 0 ? -1 : 1,
    counterWindow: 0, strikeWindup: ATTACKS[character].windup, strikeCounter: false, strikeId: 0,
    connected: true, raceStatus: 'running', raceProgress: 0, hitObstacles: [], attackConnected: false,
    previous: neutralInput(), buffer: { jump: 0, attack: 0, special: 0 }, guardRecovery: 0, guardBroken: false, ai: { nextTick: 0, nextAttackTick: 0, input: neutralInput() } };
}
export function createMatch(characters: [CharacterId, CharacterId], seed = 1): Match {
  for (const character of characters) if (!Object.hasOwn(CHARACTERS, character)) throw new Error('Unknown character');
  return { phase: 'countdown', phaseTime: 0, tick: 0, seed: seed >>> 0,
    players: [newRacer(characters[0], 0), newRacer(characters[1], 1)],
    raceTime: 0, fightTime: 0, result: null, events: [], eventSequence: 0,
    phaseTick: 0, raceTicks: 0, fightTicks: 0, fightEnd: 'pending' };
}
function event(match: Match, type: string, slot: number, position?: { x: number; z: number }) {
  const player = match.players[slot === 1 ? 1 : 0];
  match.events.push({ id: ++match.eventSequence, type, slot, x: position?.x ?? player.x, z: position?.z ?? player.z });
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
  for (const key of ['stun', 'invulnerable', 'cooldown', 'boost', 'guardRecovery', 'dodgeCooldown', 'counterWindow'] as const) {
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
    player.draft = clamp(player.draft + FIXED_DT * (drafting ? 1 / RACE.draftCharge : -RACE.draftDecay), 0, 1);
    if (oldDraft < 1 && player.draft === 1) event(match, 'draft-ready', slot);
    const drift = clamp(-courseCurvature(player.z) * player.speed * player.speed * RACE.turnDrift, -RACE.maxTurnDrift, RACE.maxTurnDrift);
    player.x = clamp(player.x + (input.move * RACE.lateralSpeed * (player.stun > 0 ? .7 : 1) + drift) * FIXED_DT, -4.3, 4.3);
    if (input.jump && !player.previous.jump && player.y === 0 && player.stun === 0) jump(match, player, slot, RACE.leapVelocity);
    const landed = gravity(match, player, slot, RACE.gravity);
    const shoulder = Math.abs(player.x) > RACE.shoulderStart ? RACE.shoulderSpeed : 1;
    const targetSpeed = player.stun > 0 ? RACE.stumbleSpeed : (RUN_SPEED + RACE.draftSpeed * player.draft) * shoulder;
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
    player.strikeWindup = ATTACKS[player.character].windup; player.strikeCounter = false; player.strikeId = 0;
    player.guardRecovery = 0; player.guardBroken = false; player.attackConnected = false; action(player, 'fight_idle');
    player.buffer = { jump: 0, attack: 0, special: 0 };
  });
  phase(match, 'fight');
}
function stepFight(match: Match, inputs: [Input, Input]) {
  match.fightTicks++; match.fightTime = match.fightTicks * FIXED_DT;
  const initialPositions = match.players.map(player => player.x);
  const initialOrder = Math.sign(initialPositions[1] - initialPositions[0]) || match.players[0].facing;
  match.players.forEach((player, index) => {
    const slot = index as Slot, input = inputs[slot], spec = ATTACKS[player.character], dodge = DODGE[player.character];
    timers(player); player.y = 0; player.vy = 0;
    const strikePressed = (input.attack || input.special) && !(player.previous.attack || player.previous.special);
    const evadePressed = (input.jump || input.guard) && !(player.previous.jump || player.previous.guard);
    player.buffer.attack = strikePressed ? .14 : Math.max(0, player.buffer.attack - FIXED_DT);
    player.buffer.jump = evadePressed ? .14 : Math.max(0, player.buffer.jump - FIXED_DT);
    if ((player.action === 'attack' && player.actionTime + EPSILON >= player.strikeWindup + spec.active + spec.recovery)
      || (player.action === 'evade' && player.actionTime + EPSILON >= dodge.duration)) action(player, 'fight_idle');
    if (player.stun > 0) { action(player, 'hit'); return; }
    if (player.action !== 'attack' && player.action !== 'evade') {
      const rivalOffset = initialPositions[slot === 0 ? 1 : 0] - initialPositions[slot];
      if (rivalOffset !== 0) player.facing = rivalOffset > 0 ? 1 : -1;
      if (player.buffer.jump > 0 && player.dodgeCooldown === 0) {
        player.buffer.jump = 0; player.dodgeCooldown = dodge.cooldown;
        player.dodgeDirection = Math.abs(input.move) > .2 ? (input.move > 0 ? 1 : -1) : player.facing === 1 ? -1 : 1;
        action(player, 'evade'); event(match, 'evade', slot);
      } else if (player.buffer.attack > 0) {
        player.buffer.attack = 0; player.strikeCounter = player.counterWindow > 0;
        player.strikeWindup = player.strikeCounter ? COUNTER_WINDUP : spec.windup;
        player.counterWindow = 0; player.strikeId++; player.attackConnected = false;
        action(player, 'attack'); event(match, player.strikeCounter ? 'counter' : 'attack', slot);
      } else {
        action(player, Math.abs(input.move) > .05 ? 'fight_move' : 'fight_idle');
        player.x = clamp(player.x + input.move * FIGHT_SPEED[player.character] * FIXED_DT, -FIGHT_BOUND, FIGHT_BOUND);
      }
    }
    if (player.action === 'evade') player.x = clamp(player.x + player.dodgeDirection * dodge.speed * FIXED_DT, -FIGHT_BOUND, FIGHT_BOUND);
  });
  if ((match.players[1].x - match.players[0].x) * initialOrder < FIGHT_BODY_GAP) {
    const center = clamp((match.players[0].x + match.players[1].x) / 2, -FIGHT_BOUND + FIGHT_BODY_GAP / 2, FIGHT_BOUND - FIGHT_BODY_GAP / 2);
    match.players[0].x = center - FIGHT_BODY_GAP / 2 * initialOrder; match.players[1].x = center + FIGHT_BODY_GAP / 2 * initialOrder;
  }
  const impacts: { attacker: Slot; defender: Slot; attack: Attack; facing: 1 | -1 }[] = [];
  match.players.forEach((player, index) => {
    const slot = index as Slot, other = (slot === 0 ? 1 : 0) as Slot, defender = match.players[other];
    if (strikePhase(player) !== 'active' || player.stun > 0 || player.attackConnected) return;
    const spec = ATTACKS[player.character], distance = (defender.x - player.x) * player.facing, dodge = DODGE[defender.character];
    if (distance < 0) return;
    const evading = defender.action === 'evade' && defender.actionTime + EPSILON >= dodge.invulnerableStart;
    const protectedEvade = evading && defender.actionTime <= dodge.invulnerableEnd + EPSILON;
    const steppedClear = evading && distance > spec.reach;
    if ((protectedEvade || steppedClear) && distance <= spec.reach + dodge.speed * dodge.duration + .25) {
      player.attackConnected = true; defender.counterWindow = COUNTER_WINDOW; event(match, 'evade-success', other); return;
    }
    if (distance > spec.reach) return;
    player.attackConnected = true;
    if (defender.invulnerable > 0) return;
    impacts.push({ attacker: slot, defender: other, attack: spec, facing: player.facing });
  });
  // Decide all contacts before applying any: committed same-tick strikes trade.
  for (const impact of impacts) {
    const defender = match.players[impact.defender], attacker = match.players[impact.attacker];
    defender.hp = Math.max(0, defender.hp - impact.attack.damage);
    defender.stun = impact.attack.stun; defender.invulnerable = .65; defender.counterWindow = 0;
    const before = defender.x;
    defender.x = clamp(defender.x + impact.facing * impact.attack.knockback, -FIGHT_BOUND, FIGHT_BOUND);
    // At a wall the attacker supplies the missing separation by recoiling.
    const remaining = impact.attack.knockback - Math.abs(defender.x - before);
    if (remaining > 0) attacker.x = clamp(attacker.x - impact.facing * remaining, -FIGHT_BOUND, FIGHT_BOUND);
    action(defender, 'hit'); event(match, 'hit', impact.defender);
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
function pool(advantage: number): [number, number] {
  const delta = 25 * clamp(advantage, -1, 1);
  const first = tenth(25 + Math.sign(delta) * tenth(Math.abs(delta)));
  return [first, tenth(50 - first)];
}
/** Final health and effective race time only: activity counts cannot farm points. */
export function scoreMatch(match: Match): Championship {
  const [first, second] = match.players;
  if (!first.connected || !second.connected) {
    const winner: Slot | null = first.connected === second.connected ? null : first.connected ? 0 : 1;
    const race: [number, number] = winner === null ? [25, 25] : winner === 0 ? [50, 0] : [0, 50];
    return { race, fight: [...race], total: [race[0] * 2, race[1] * 2], winner,
      reason: winner === null ? 'Both competitors disconnected · no trophy awarded' : 'Disconnect forfeit · connected rival wins both event pools' };
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
  match.result = scoreMatch(match); phase(match, 'results');
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
/** Open beginner behavior: 200ms decisions, delayed imperfect reads, ordinary inputs. */
export function cpuInput(match: Match, slot: Slot): Input {
  const player = match.players[slot], rival = match.players[slot === 0 ? 1 : 0];
  if (match.tick < player.ai.nextTick) return { ...player.ai.input };
  player.ai.nextTick = match.tick + 12;
  const decision = Math.floor(match.tick / 12), roll = noise(match.seed, decision, slot), input = neutralInput();
  if (match.phase === 'race' && player.raceStatus === 'running') {
    const gap = rival.z - player.z;
    let target = gap > RACE.draftMinGap && gap < 14 ? rival.x : slot === 0 ? -1.3 : 1.3;
    if (player.draft > .8 && gap > 0 && gap < 4.2) target = clamp(rival.x + (rival.x > 0 ? -1 : 1) * 2.0, -3.5, 3.5);
    const upcoming = OBSTACLES.filter(obstacle => obstacle.z > player.z && obstacle.z - player.z < 16);
    const nearest = upcoming[0];
    if (nearest) {
      const row = upcoming.filter(obstacle => obstacle.z === nearest.z);
      const inPath = row.find(obstacle => Math.abs(player.x - obstacle.x) < obstacle.width / 2 + .5);
      if (inPath && inPath.kind !== 'arch') input.jump = inPath.z - player.z < player.speed * .43 && inPath.z - player.z > player.speed * .16;
      else if (inPath) {
        const lanes = [-3, 0, 3].filter(x => row.every(obstacle => Math.abs(x - obstacle.x) > obstacle.width / 2 + .55));
        target = lanes.sort((a, b) => Math.abs(a - player.x) - Math.abs(b - player.x))[0] ?? -Math.sign(inPath.x || 1) * 3.3;
      }
    }
    input.move = clamp((target - player.x) * 1.6, -1, 1);
  } else if (match.phase === 'fight') {
    const distance = Math.abs(rival.x - player.x), toward = Math.sign(rival.x - player.x), spec = ATTACKS[player.character];
    const rivalPhase = strikePhase(rival), reaction = .26 + noise(match.seed, rival.strikeId, slot) * .14;
    const threat = rivalPhase === 'windup' && rival.actionTime >= reaction && distance < ATTACKS[rival.character].reach + .7;
    const free = player.stun === 0 && player.action !== 'attack' && player.action !== 'evade';
    if (free && threat && player.dodgeCooldown === 0 && roll < .60) {
      input.jump = true; input.move = -toward;
    } else if (free) {
      // Approach in short, readable steps; do not instantly erase knockback.
      const ready = match.tick >= player.ai.nextAttackTick;
      input.move = distance > spec.reach - .04 && (ready || rivalPhase === 'recovery') ? toward * .78 : 0;
      if (player.counterWindow > 0) input.move = distance > spec.reach - .03 ? toward : 0;
      if (match.fightTime >= 1.8 && distance <= spec.reach - .02 && (ready || player.counterWindow > 0)) {
        input.attack = true; player.ai.nextAttackTick = match.tick + 120 + Math.floor(roll * 30);
      } else if (threat && roll < .35) input.move = -toward * .7;
    }
  }
  player.ai.input = input; return { ...input };
}
