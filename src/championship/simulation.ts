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
  vy: number; connected: boolean; raceStatus: 'running' | 'finished' | 'dnf'; raceProgress: number;
  hitObstacles: number[]; attackConnected: boolean; previous: Input;
  buffer: { jump: number; attack: number; special: number };
  guardRecovery: number; ai: { nextTick: number; input: Input };
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
export const RACE_GAP_FOR_FULL_POOL = 16;
export const CHARACTERS = {
  lion: { name: 'Fire Lion', special: 'Ember rush', description: 'A short, committed fire lunge. Guard or step out of its path.' },
  wolf: { name: 'Water Wolf', special: 'Frost howl', description: 'Longer reach with a readable windup. Close in during recovery.' },
  unicorn: { name: 'Rainbow Unicorn', special: 'Prism ward', description: 'Brief frontal protection followed by a hoof strike. Bait it from outside its reach.' },
} as const;

export interface Obstacle { id: number; z: number; x: number; width: number; kind: 'hurdle' | 'barrel' | 'arch' }
/** Authored rhythm: introduction, alternating lanes, canyon slalom, final sprint. */
export const OBSTACLES: readonly Obstacle[] = [
  { id: 0, z: 45, x: 0, width: 2.0, kind: 'hurdle' },
  { id: 1, z: 76, x: -2.6, width: 1.5, kind: 'barrel' },
  { id: 2, z: 107, x: 2.6, width: 1.5, kind: 'barrel' },
  { id: 3, z: 138, x: 0, width: 2.4, kind: 'arch' },
  { id: 4, z: 171, x: -2.5, width: 2.2, kind: 'hurdle' },
  { id: 5, z: 171, x: 2.5, width: 2.2, kind: 'hurdle' },
  { id: 6, z: 204.5, x: 0, width: 1.6, kind: 'barrel' },
  { id: 7, z: 234, x: -2.6, width: 2.4, kind: 'arch' },
  { id: 8, z: 262, x: 2.6, width: 2.4, kind: 'arch' },
  { id: 9, z: 291, x: 0, width: 2.2, kind: 'hurdle' },
  { id: 10, z: 323, x: -2.6, width: 1.5, kind: 'barrel' },
  { id: 11, z: 323, x: 0, width: 1.5, kind: 'barrel' },
  { id: 12, z: 355, x: 2.3, width: 3.8, kind: 'arch' },
  { id: 13, z: 387, x: -2.3, width: 3.8, kind: 'arch' },
  { id: 14, z: 418, x: 0, width: 2.4, kind: 'hurdle' },
  { id: 15, z: 449, x: -2.6, width: 1.4, kind: 'barrel' },
  { id: 16, z: 449, x: 2.6, width: 1.4, kind: 'barrel' },
];

interface Attack { windup: number; active: number; recovery: number; reach: number; damage: number; stun: number; knockback: number }
export const ATTACKS: Readonly<Record<'attack' | CharacterId, Attack>> = {
  attack: { windup: .18, active: .10, recovery: .29, reach: 1.5, damage: 11, stun: .20, knockback: .32 },
  lion: { windup: .32, active: .14, recovery: .48, reach: 1.75, damage: 18, stun: .24, knockback: .70 },
  wolf: { windup: .43, active: .16, recovery: .55, reach: 2.75, damage: 14, stun: .27, knockback: .40 },
  unicorn: { windup: .40, active: .12, recovery: .43, reach: 1.65, damage: 13, stun: .21, knockback: .55 },
};
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
    connected: true, raceStatus: 'running', raceProgress: 0, hitObstacles: [], attackConnected: false,
    previous: neutralInput(), buffer: { jump: 0, attack: 0, special: 0 }, guardRecovery: 0, ai: { nextTick: 0, input: neutralInput() } };
}
export function createMatch(characters: [CharacterId, CharacterId], seed = 1): Match {
  for (const character of characters) if (!Object.hasOwn(CHARACTERS, character)) throw new Error('Unknown character');
  return { phase: 'countdown', phaseTime: 0, tick: 0, seed: seed >>> 0,
    players: [newRacer(characters[0], 0), newRacer(characters[1], 1)],
    raceTime: 0, fightTime: 0, result: null, events: [], eventSequence: 0,
    phaseTick: 0, raceTicks: 0, fightTicks: 0, fightEnd: 'pending' };
}
function event(match: Match, type: string, slot: number) {
  const player = match.players[slot === 1 ? 1 : 0];
  match.events.push({ id: ++match.eventSequence, type, slot, x: player.x, z: player.z });
  if (match.events.length > 48) match.events.splice(0, match.events.length - 48);
}
function action(player: Racer, name: string) {
  if (player.action !== name) { player.action = name; player.actionTime = 0; }
}
function phase(match: Match, name: Phase) {
  match.phase = name; match.phaseTime = 0; match.phaseTick = 0;
  for (const player of match.players) { player.previous = neutralInput(); player.ai.nextTick = 0; }
  event(match, name, -1);
}
function timers(player: Racer) {
  player.actionTime += FIXED_DT;
  for (const key of ['stun', 'invulnerable', 'cooldown', 'boost', 'guardRecovery'] as const) {
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
  match.players.forEach((player, index) => {
    const slot = index as Slot, input = inputs[slot];
    timers(player);
    if (player.raceStatus !== 'running') {
      // Finishing locks time/progress, but must not freeze an airborne runner.
      player.speed = 0;
      const landed = gravity(match, player, slot, 20);
      if (player.y > 0) action(player, 'jump');
      else if (landed) action(player, 'land');
      else if (player.action !== 'land' || player.actionTime >= .16) action(player, 'race_idle');
      return;
    }
    const oldZ = player.z, oldY = player.y;
    player.x = clamp(player.x + input.move * 5.2 * FIXED_DT * (player.stun > 0 ? .45 : 1), -4.3, 4.3);
    if (input.jump && !player.previous.jump && player.y === 0 && player.stun === 0) jump(match, player, slot, 7.6);
    if (input.special && !player.previous.special && player.cooldown === 0 && player.energy >= 35 && player.stun === 0) {
      player.energy -= 35; player.boost = 1.1; player.cooldown = 3; event(match, 'boost', slot);
    }
    const landed = gravity(match, player, slot, 20);
    const targetSpeed = player.stun > 0 ? 3.5 : RUN_SPEED * (player.boost > 0 ? 1.24 : 1);
    const priorSpeed = player.speed;
    player.speed = approach(player.speed, targetSpeed, FIXED_DT * (player.stun > 0 ? 16 : 3.5));
    player.z += (priorSpeed + player.speed) * .5 * FIXED_DT;
    for (const obstacle of OBSTACLES) {
      if (obstacle.z < oldZ || obstacle.z > player.z || player.hitObstacles.includes(obstacle.id)) continue;
      const crossing = clamp((obstacle.z - oldZ) / Math.max(EPSILON, player.z - oldZ), 0, 1);
      const crossingY = oldY + (player.y - oldY) * crossing;
      const clears = obstacle.kind !== 'arch' && crossingY > (obstacle.kind === 'hurdle' ? .65 : .8);
      if (Math.abs(player.x - obstacle.x) < obstacle.width / 2 + .32 && !clears) {
        player.hitObstacles.push(obstacle.id); player.stun = .55; player.speed = Math.min(player.speed, 3.5);
        player.boost = 0; action(player, 'stumble'); event(match, 'obstacle', slot); break;
      }
    }
    if (player.z >= COURSE_LENGTH) {
      player.finishTime = (match.raceTicks - 1 + clamp((COURSE_LENGTH - oldZ) / (player.z - oldZ), 0, 1)) * FIXED_DT;
      player.z = COURSE_LENGTH; player.speed = 0; player.raceStatus = 'finished';
      action(player, 'race_idle'); event(match, 'finish', slot);
    } else if (player.stun > 0) action(player, 'stumble');
    else if (player.y > 0) action(player, 'jump');
    else if (landed) action(player, 'land');
    else if (player.action !== 'land' || player.actionTime >= .16) action(player, 'run');
    player.raceProgress = player.z;
  });
  if (match.raceTime >= RACE_DURATION || match.players.every(player => player.raceStatus !== 'running')) {
    for (const player of match.players) {
      if (player.raceStatus === 'running') player.raceStatus = 'dnf';
      player.speed = 0; player.y = 0; player.vy = 0; action(player, 'transform');
    }
    phase(match, 'transition');
  }
}
function startFight(match: Match) {
  match.players.forEach((player, index) => {
    player.x = index === 0 ? -1.75 : 1.75; player.z = 0; player.y = 0; player.vy = 0;
    player.facing = index === 0 ? 1 : -1; player.hp = 100; player.energy = 100; player.guard = 100;
    player.stun = 0; player.invulnerable = 0; player.cooldown = 0; player.boost = 0;
    player.guardRecovery = 0; player.attackConnected = false; action(player, 'fight_idle');
    player.buffer = { jump: 0, attack: 0, special: 0 };
  });
  phase(match, 'fight');
}
function attackFor(player: Racer): Attack | null {
  return player.action === 'attack' ? ATTACKS.attack : player.action === 'special' ? ATTACKS[player.character] : null;
}
function isWarded(player: Racer): boolean {
  return player.character === 'unicorn' && player.action === 'special' && player.actionTime >= .08 && player.actionTime <= .52;
}
function stepFight(match: Match, inputs: [Input, Input]) {
  match.fightTicks++; match.fightTime = match.fightTicks * FIXED_DT;
  const initialOrder = match.players[0].x <= match.players[1].x ? 1 : -1;
  match.players.forEach((player, index) => {
    const slot = index as Slot, input = inputs[slot], opponent = match.players[slot === 0 ? 1 : 0];
    timers(player);
    // A short press survives the end of recovery/hitstun; holding does not repeat.
    for (const key of ['jump', 'attack', 'special'] as const) {
      player.buffer[key] = input[key] && !player.previous[key] ? .14 : Math.max(0, player.buffer[key] - FIXED_DT);
    }
    gravity(match, player, slot, 18);
    const attacking = attackFor(player);
    if (attacking && player.actionTime + EPSILON >= attacking.windup + attacking.active + attacking.recovery) {
      action(player, 'fight_idle'); player.attackConnected = false;
    }
    if (player.stun > 0) { action(player, 'hit'); return; }
    if (!attackFor(player)) {
      player.facing = opponent.x >= player.x ? 1 : -1;
      if (player.buffer.jump > 0 && player.y === 0) { jump(match, player, slot, 6.8); player.buffer.jump = 0; }
      if (player.buffer.special > 0 && player.cooldown === 0 && player.energy >= 40) {
        player.buffer.special = 0;
        player.energy -= 40; player.cooldown = 3.2; action(player, 'special');
        player.attackConnected = false; event(match, 'special', slot);
      } else if (player.buffer.attack > 0 && !input.guard) {
        player.buffer.attack = 0;
        action(player, 'attack'); player.attackConnected = false; event(match, 'attack', slot);
      } else {
        action(player, input.guard && player.y === 0 && player.guard > 0 ? 'guard' : player.y > 0 ? 'jump' : Math.abs(input.move) > .05 ? 'fight_move' : 'fight_idle');
        const movementSpeed = player.action === 'guard' ? 1.45 : player.y > 0 ? 2.6 : 3.6;
        player.x = clamp(player.x + input.move * movementSpeed * FIXED_DT, -4.4, 4.4);
      }
    }
    if (player.action === 'special' && player.character === 'lion' && player.actionTime >= ATTACKS.lion.windup && player.actionTime < ATTACKS.lion.windup + ATTACKS.lion.active) {
      player.x = clamp(player.x + player.facing * 7 * FIXED_DT, -4.4, 4.4);
    }
    if (player.action !== 'guard' && player.guardRecovery === 0) player.guard = Math.min(100, player.guard + 18 * FIXED_DT);
  });
  // Resolve bodies before contact. Grounded fighters cannot pass through each other.
  if (Math.abs(match.players[0].y - match.players[1].y) < .7 && (match.players[1].x - match.players[0].x) * initialOrder < .85) {
    const center = clamp((match.players[0].x + match.players[1].x) / 2, -3.975, 3.975);
    match.players[0].x = center - .425 * initialOrder; match.players[1].x = center + .425 * initialOrder;
  }
  const impacts: { attacker: Slot; defender: Slot; attack: Attack; defended: boolean; warded: boolean; facing: 1 | -1 }[] = [];
  match.players.forEach((player, index) => {
    const slot = index as Slot, other = (slot === 0 ? 1 : 0) as Slot, defender = match.players[other];
    const attack = attackFor(player);
    if (!attack || player.stun > 0 || player.attackConnected || player.actionTime + EPSILON < attack.windup || player.actionTime >= attack.windup + attack.active) return;
    const forwardDistance = (defender.x - player.x) * player.facing;
    if (forwardDistance < 0 || forwardDistance > attack.reach || Math.abs(player.y - defender.y) > .9) return;
    player.attackConnected = true;
    if (defender.invulnerable > 0) return;
    const frontal = (player.x - defender.x) * defender.facing >= 0;
    impacts.push({ attacker: slot, defender: other, attack, defended: frontal && defender.action === 'guard', warded: frontal && isWarded(defender), facing: player.facing });
  });
  // Gather first, apply second: an earlier array slot can never cancel a same-tick hit.
  for (const impact of impacts) {
    const defender = match.players[impact.defender];
    if (impact.warded) { event(match, 'ward', impact.defender); continue; }
    if (impact.defended) {
      defender.guard = Math.max(0, defender.guard - impact.attack.damage * 2.2);
      defender.guardRecovery = .6; defender.hp = Math.max(0, defender.hp - 1);
      defender.x = clamp(defender.x + impact.facing * .14, -4.4, 4.4);
      if (defender.guard === 0) {
        defender.stun = .38; defender.invulnerable = .62; action(defender, 'hit'); event(match, 'guard-break', impact.defender);
      } else event(match, 'block', impact.defender);
    } else {
      defender.hp = Math.max(0, defender.hp - impact.attack.damage);
      defender.stun = impact.attack.stun; defender.invulnerable = .52;
      defender.x = clamp(defender.x + impact.facing * impact.attack.knockback, -4.4, 4.4);
      action(defender, 'hit'); event(match, 'hit', impact.defender);
    }
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
/** Open CPU rules: 200ms decisions, visible hazards, identical stats/inputs. */
export function cpuInput(match: Match, slot: Slot): Input {
  const player = match.players[slot], rival = match.players[slot === 0 ? 1 : 0];
  if (match.tick < player.ai.nextTick) return { ...player.ai.input };
  player.ai.nextTick = match.tick + 12;
  const decision = Math.floor(match.tick / 12), roll = noise(match.seed, decision, slot), input = neutralInput();
  if (match.phase === 'race' && player.raceStatus === 'running') {
    const upcoming = OBSTACLES.filter(obstacle => obstacle.z > player.z && obstacle.z - player.z < 14);
    const nearest = upcoming[0];
    if (nearest) {
      const row = upcoming.filter(obstacle => obstacle.z === nearest.z);
      const inPath = row.find(obstacle => Math.abs(player.x - obstacle.x) < obstacle.width / 2 + .45);
      if (inPath && inPath.kind !== 'arch') input.jump = inPath.z - player.z < 5 && inPath.z - player.z > 1;
      else if (inPath) {
        const lanes = [-2.8, 0, 2.8].filter(x => row.every(obstacle => Math.abs(x - obstacle.x) > obstacle.width / 2 + .55));
        const target = lanes.sort((a, b) => Math.abs(a - player.x) - Math.abs(b - player.x))[0] ?? -Math.sign(inPath.x || 1) * 3.6;
        input.move = clamp((target - player.x) * 1.5, -1, 1);
      }
    } else {
      const desired = (slot === 0 ? -1 : 1) * 1.3;
      input.move = clamp((desired - player.x) * .6, -1, 1);
      input.special = roll > .65 && player.energy >= 45 && player.cooldown === 0;
    }
  } else if (match.phase === 'fight') {
    const distance = Math.abs(rival.x - player.x), toward = Math.sign(rival.x - player.x);
    const rivalAttack = attackFor(rival);
    const threat = rivalAttack && rival.actionTime < rivalAttack.windup + rivalAttack.active && distance < rivalAttack.reach + .5;
    if (threat && roll < .67 && player.guard > 18 && !attackFor(player)) {
      input.guard = true; input.move = -toward * .35;
    } else {
      input.move = distance > 1.25 ? toward : distance < .95 ? -toward * .4 : 0;
      if (decision % 3 === 0 && !attackFor(player) && player.stun === 0) {
        input.special = player.energy >= 40 && player.cooldown === 0 && distance <= ATTACKS[player.character].reach + (player.character === 'lion' ? .6 : 0) && roll > .45;
        input.attack = !input.special && distance <= 1.45;
        input.jump = !input.attack && !input.special && distance > 2 && roll < .08;
      }
    }
  }
  player.ai.input = input; return { ...input };
}
