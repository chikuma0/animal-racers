import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as ts from 'typescript';
import * as authority from './simulation';
import {
  ATTACKS, QUICK_ATTACKS, COMBO_ATTACKS, GUARD, POWER_RULES, HIT_PAUSE, DODGE, FIGHT_SPEED, FIGHT_BODY_GAP, COUNTER_WINDUP, COURSE_LENGTH, COUNTDOWN_DURATION, FIGHT_DURATION, FIXED_DT, OBSTACLES,
  courseCenter, courseSlope, COURSE_MAX_SECOND_DERIVATIVE, strikePhase,
  RACE_DURATION, RUN_SPEED, TRANSITION_DURATION, createMatch, createDuelMatch, cpuInput, forfeitMatch, neutralInput,
  scoreMatch, stepMatch, type CharacterId, type Input, type Match, type Slot,
} from './simulation';

const idle = (): [Input, Input] => [neutralInput(), neutralInput()];
function ticks(match: Match, count: number, input: [Input, Input] = idle()) {
  for (let i = 0; i < count; i++) stepMatch(match, input, FIXED_DT);
}
function fight(characters: [CharacterId, CharacterId] = ['lion', 'wolf']): Match {
  const match = createMatch(characters);
  match.phase = 'fight';
  match.players.forEach((player, i) => {
    player.x = i === 0 ? -.875 : .875; player.action = 'fight_idle';
    player.finishTime = 70; player.raceStatus = 'finished'; player.raceProgress = COURSE_LENGTH;
  });
  return match;
}
function scored(times: [number | null, number | null], hp: [number, number], progress: [number, number] = [0, 0]) {
  const match = fight();
  match.players.forEach((player, index) => {
    player.finishTime = times[index]; player.raceStatus = times[index] === null ? 'dnf' : 'finished';
    player.raceProgress = times[index] === null ? progress[index] : COURSE_LENGTH; player.hp = hp[index];
  });
  return match;
}
function fullCpu(characters: [CharacterId, CharacterId], seed: number) {
  const match = createMatch(characters, seed);
  const limit = (COUNTDOWN_DURATION + RACE_DURATION + TRANSITION_DURATION + FIGHT_DURATION + 1) * 60;
  let iterations = 0;
  while (match.phase !== 'results' && iterations++ < limit) {
    stepMatch(match, [cpuInput(match, 0), cpuInput(match, 1)], FIXED_DT);
  }
  return match;
}

describe('bounded, normalized championship scoring', () => {
  it('lets a narrow race winner lose the championship after a decisive fight', () => {
    const result = scoreMatch(scored([69.85, 70], [0, 80]));
    expect(result.race).toEqual([25.9, 24.1]);
    expect(result.fight).toEqual([5, 45]);
    expect(result.total).toEqual([30.9, 69.1]);
    expect(result.winner).toBe(1);
  });
  it('preserves a strong race win against a close fight loss', () => {
    const result = scoreMatch(scored([69, 70.5], [0, 26]));
    expect(result.race).toEqual([34.4, 15.6]);
    expect(result.fight).toEqual([18.5, 31.5]);
    expect(result.total).toEqual([52.9, 47.1]);
    expect(result.winner).toBe(0);
  });
  it('has an exact tie when equal normalized split wins cancel', () => {
    const result = scoreMatch(scored([68, 70], [0, 50]));
    expect(result.total).toEqual([50, 50]); expect(result.winner).toBeNull();
  });
  it('gives equal fight points for double knockout, preserving the race result', () => {
    const match = scored([68, 70], [0, 0]); match.fightEnd = 'double-knockout';
    const result = scoreMatch(match);
    expect(result.fight).toEqual([25, 25]); expect(result.winner).toBe(0);
    expect(result.reason).toContain('double knockout');
  });
  it('uses remaining health at timeout; waiting and attack-event counts add no points', () => {
    const match = scored([70, 70], [80, 60]); match.fightEnd = 'timeout';
    const before = scoreMatch(match);
    match.fightTime = FIGHT_DURATION;
    match.events = Array.from({ length: 40 }, (_, id) => ({ id, type: 'attack', slot: 0, x: 0, z: 0 }));
    expect(scoreMatch(match)).toEqual(before);
    expect(before.fight).toEqual([30, 20]); expect(before.reason).toContain('timeout');
  });
  it('scores DNF by preserved course progress, including both DNF and near-finish cases', () => {
    const both = scored([null, null], [100, 100], [400, 200]);
    expect(scoreMatch(both).race).toEqual([50, 0]);
    expect(scoreMatch(both).reason).toContain('2 race DNF');
    const near = scored([94.9, null], [100, 100], [0, 499]);
    expect(scoreMatch(near).race[0]).toBeGreaterThan(25);
    near.players[1].z = 0;
    expect(scoreMatch(near).race[0]).toBeLessThan(27);
  });
  it('never rewards worsening your finish time, progress or final health', () => {
    let previous = -Infinity;
    for (let time = RACE_DURATION; time >= 50; time -= .13) {
      const result = scoreMatch(scored([time, 75], [45, 50]));
      expect(result.total[0]).toBeGreaterThanOrEqual(previous); previous = result.total[0];
    }
    previous = -Infinity;
    for (let progress = 0; progress <= COURSE_LENGTH; progress += 3.5) {
      const result = scoreMatch(scored([null, null], [45, 50], [progress, 400]));
      expect(result.total[0]).toBeGreaterThanOrEqual(previous); previous = result.total[0];
    }
    previous = -Infinity;
    for (let hp = 0; hp <= 100; hp++) {
      const result = scoreMatch(scored([72, 75], [hp, 50]));
      expect(result.total[0]).toBeGreaterThanOrEqual(previous); previous = result.total[0];
    }
  });
  it('keeps exact complementary pools and slot-symmetric quantized points', () => {
    for (let gap = -22; gap <= 22; gap += .032) {
      const result = scoreMatch(scored([72, 72 + gap], [47, 71]));
      const swapped = scoreMatch(scored([72 + gap, 72], [71, 47]));
      for (const pool of [result.race, result.fight]) {
        expect(pool[0] + pool[1]).toBe(50);
        expect(pool[0]).toBeGreaterThanOrEqual(0); expect(pool[0]).toBeLessThanOrEqual(50);
        expect(pool[0] * 10).toBeCloseTo(Math.round(pool[0] * 10), 8);
      }
      expect(result.total[0] + result.total[1]).toBe(100);
      expect(result.total).toEqual([...swapped.total].reverse());
    }
  });
  it('forfeits on disconnect even if the disconnecting player led; both disconnected get no trophy', () => {
    const match = scored([50, 90], [100, 1]);
    forfeitMatch(match, 0);
    expect(match.phase).toBe('results'); expect(match.result?.winner).toBe(1);
    expect(match.result?.total).toEqual([0, 100]);
    const terminal = JSON.stringify(match); forfeitMatch(match, 1); ticks(match, 20);
    expect(JSON.stringify(match)).toBe(terminal);
    const both = fight(); both.players.forEach(player => { player.connected = false; });
    stepMatch(both, idle(), FIXED_DT);
    expect(both.result?.winner).toBeNull(); expect(both.result?.reason).toContain('no trophy');
  });
});

const species: CharacterId[] = ['lion', 'wolf', 'unicorn'];
function race(z = 0): Match {
  const match = createMatch(['lion', 'wolf']); match.phase = 'race';
  match.players.forEach((p, i) => { p.z = z; p.x = i === 0 ? 0 : 3.6; p.speed = RUN_SPEED; p.action = 'run'; });
  return match;
}
function steer(target: number, x: number): number { return Math.max(-1, Math.min(1, (target - x) * 2)); }
function powerPunish(first: CharacterId, second: CharacterId, attacker: Slot, reaction: number, gap: number, wall: boolean) {
  const m = fight([first, second]), defender: Slot = attacker === 0 ? 1 : 0;
  m.players[0].x = -gap / 2; m.players[1].x = gap / 2;
  if (wall) { m.players[defender].x = attacker === 0 ? 4.4 : -4.4; m.players[attacker].x = m.players[defender].x + (attacker === 0 ? -gap : gap); }
  let dodged = false, struck = false, last = 0, recovery = false;
  for (let frame = 0; frame < 240; frame++) {
    const input = idle(), a = m.players[attacker], d = m.players[defender];
    if (frame === 0) input[attacker].special = true;
    if (!dodged && a.actionTime >= reaction) { input[defender].jump = true; dodged = true; }
    if (dodged && !input[defender].jump && d.action !== 'evade') {
      if (Math.abs(a.x - d.x) > 1.82) input[defender].move = Math.sign(a.x - d.x);
      else if (!struck) { input[defender].attack = true; struck = true; }
    }
    const before = strikePhase(a); stepMatch(m, input, FIXED_DT);
    for (const e of m.events.filter(e => e.id > last)) { if (e.type === 'hit' && e.slot === attacker) recovery = before === 'recovery'; last = e.id; }
    if (a.hp < 100) break;
  }
  return { m, defender, recovery };
}
type RaceAuthority = Pick<typeof authority, 'createMatch' | 'stepMatch' | 'neutralInput' | 'FIXED_DT' | 'OBSTACLES'>;
type RacePolicy = 'clean' | 'crash' | 'firstCrash' | 'weave' | 'edge' | 'coast';
function raceControl(s: RaceAuthority, m: Match, slot: Slot, kind: RacePolicy): Input {
  const p = m.players[slot], input = s.neutralInput();
  if (kind === 'coast') return input;
  const next = s.OBSTACLES.find(o => o.z > p.z && o.z - p.z < 18), lane = slot === 0 ? -.8 : .8;
  let target = lane;
  if (next?.kind === 'arch') target = (next.x < 0 ? 2.4 : -2.4) + lane;
  if (kind === 'edge') target = slot === 0 ? -4.3 : 4.3;
  if (kind === 'weave') target = Math.sin(m.raceTime * 4) * 3.2;
  if (next && (kind === 'crash' || kind === 'firstCrash' && next.id === 0)) target = next.x;
  input.move = steer(target, p.x);
  if (next && next.kind !== 'arch' && kind !== 'crash' && !(kind === 'firstCrash' && next.id === 0)) {
    input.jump = Math.abs(p.x - next.x) < next.width / 2 + .45 && next.z - p.z < p.speed * .42 && next.z - p.z > p.speed * .20;
  }
  return input;
}
function policyRace(s: RaceAuthority, kind: RacePolicy, slot: Slot, seed = 47) {
  const m = s.createMatch(['lion', 'wolf'], seed);
  for (let frame = 0; frame < 6000 && (m.phase === 'countdown' || m.phase === 'race'); frame++) {
    s.stepMatch(m, [raceControl(s, m, 0, slot === 0 ? kind : 'clean'), raceControl(s, m, 1, slot === 1 ? kind : 'clean')], s.FIXED_DT);
  }
  return m;
}
function historicalAuthority(): RaceAuthority {
  const source = readFileSync(new URL('../../scripts/qa/fixtures/simulation-d8067d2.ts', import.meta.url), 'utf8');
  const course = readFileSync(new URL('../../scripts/qa/fixtures/course.ts', import.meta.url), 'utf8');
  expect(createHash('sha256').update(source).digest('hex')).toBe('ed96a791128e7dc74e0ca39de20034a247b6baccfff167fea9c2bfac7e083537');
  expect(createHash('sha256').update(course).digest('hex')).toBe('ac632814a1222cb2b44374d173bddb0a2d2054b50d03006e29b77737a74ffef7');
  const compile = (code: string, imported: object = {}) => {
    const compiled = { exports: {} };
    new Function('module', 'exports', 'require', ts.transpileModule(code, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText)(compiled, compiled.exports, () => imported);
    return compiled.exports;
  };
  return compile(source, compile(course)) as RaceAuthority;
}

describe('earned race', () => {
  it('rejects the frozen crash-beneficial baseline with the same full-race clean/opponent controller', () => {
    const old = historicalAuthority();
    for (const slot of [0, 1] as const) {
      const m = policyRace(old, 'crash', slot), other: Slot = slot === 0 ? 1 : 0;
      expect(m.players[slot].hitObstacles.length).toBeGreaterThan(m.players[other].hitObstacles.length);
      expect(m.players[slot].finishTime).toBeLessThan(m.players[other].finishTime ?? -Infinity);
    }
  });
  it('rewards clean play over deliberate crashes, a lone early error, weave, edge and coast across both roles', () => {
    for (const kind of ['crash', 'firstCrash', 'weave', 'edge', 'coast'] as const)
      for (const slot of [0, 1] as const) for (const seed of [1, 47, 2026]) {
        const m = policyRace(authority, kind, slot, seed), other: Slot = slot === 0 ? 1 : 0;
        const label = `${kind}/${slot}/${seed}`;
        expect(m.players.every(p => p.raceStatus === 'finished'), label).toBe(true);
        expect(m.players[slot].finishTime, label).toBeGreaterThan((m.players[other].finishTime ?? Infinity) + .04);
        expect(m.players[other].hitObstacles.length, label).toBeLessThanOrEqual(1);
      }
    const clean = policyRace(authority, 'clean', 0);
    expect(clean.players.every(p => p.hitObstacles.length === 0)).toBe(true);
    expect(clean.players[0].finishTime).toBeLessThan(66);
  });
  it('bounds following aid and cannot turn a clear straight pursuit into an automatic pass or stored burst', () => {
    for (const slot of [0, 1] as const) {
      const m = race(320), other: Slot = slot === 0 ? 1 : 0;
      Object.assign(m.players[slot], { x: -2.8, z: 320 }); Object.assign(m.players[other], { x: -2.8, z: 326 });
      let maxSpeed = 0, minGap = Infinity, charged = false;
      // Both steer the same clear lane until before the next wagon.
      for (let frame = 0; frame < 100; frame++) {
        const input = idle(); input[slot].move = steer(-2.8, m.players[slot].x); input[other].move = steer(-2.8, m.players[other].x);
        stepMatch(m, input, FIXED_DT); maxSpeed = Math.max(maxSpeed, m.players[slot].speed);
        minGap = Math.min(minGap, m.players[other].z - m.players[slot].z); charged ||= m.players[slot].draft > .8;
      }
      expect(charged).toBe(true); expect(maxSpeed).toBeGreaterThan(RUN_SPEED);
      expect(maxSpeed).toBeLessThanOrEqual(RUN_SPEED + .35 + 1e-8); expect(minGap).toBeGreaterThan(3);
      const input = idle(); input[slot].move = 1;
      for (let frame = 0; frame < 35; frame++) stepMatch(m, input, FIXED_DT);
      expect(m.players[slot].drafting).toBe(false); expect(m.players[slot].draft).toBe(0);
      expect(m.events.some(e => e.type === 'pass')).toBe(false);
    }
  });
  it('recovers a single miss promptly while preserving its distance cost', () => {
    const start = OBSTACLES[0].z - 4, missed = race(start), cleared = race(start); let hitAt = -1, recoveredAt = -1;
    for (let frame = 0; frame < 180; frame++) {
      const a = idle(), b = idle(); a[0].move = steer(0, missed.players[0].x); b[0].move = steer(0, cleared.players[0].x);
      b[0].jump = frame === 0; stepMatch(missed, a, FIXED_DT); stepMatch(cleared, b, FIXED_DT);
      if (hitAt < 0 && missed.players[0].hitObstacles.length) hitAt = frame;
      if (hitAt >= 0 && recoveredAt < 0 && missed.players[0].speed >= RUN_SPEED - .01) recoveredAt = frame;
    }
    expect(missed.players[0].hitObstacles).toEqual([0]); expect(cleared.players[0].hitObstacles).toEqual([]);
    expect((recoveredAt - hitAt) / 60).toBeLessThan(.85);
    expect(cleared.players[0].z - missed.players[0].z).toBeGreaterThan(.8);
    expect(cleared.players[0].z - missed.players[0].z).toBeLessThan(1.7);
  });
  it('uses regular readable choices, shared geometry, fixed seconds and bounded input', () => {
    const rows = [...new Set(OBSTACLES.map(o => o.z))]; expect(rows.length).toBe(12);
    rows.slice(1).forEach((z, i) => { expect(z - rows[i]).toBeGreaterThanOrEqual(30); expect(z - rows[i]).toBeLessThanOrEqual(45); });
    for (const z of [30, 100, 210, 350, 460]) {
      expect((courseCenter(z + .01) - courseCenter(z - .01)) / .02).toBeCloseTo(courseSlope(z), 7);
      expect(Math.abs((courseSlope(z + .01) - courseSlope(z - .01)) / .02)).toBeLessThanOrEqual(COURSE_MAX_SECOND_DERIVATIVE);
    }
    const m = createMatch(['lion', 'wolf']); ticks(m, 180); expect(m.phase).toBe('race'); expect(m.phaseTime).toBe(0);
    for (const dt of [0, -1, 1 / 30, NaN, Infinity]) expect(() => stepMatch(m, idle(), dt)).toThrow('1/60');
    ticks(m, 60); expect(m.raceTime).toBe(1); expect(m.players[0].speed).toBeCloseTo(6.5, 8);
  });
  it('adjudicates actual corrected and interpolated hazard crossings', () => {
    const z = OBSTACLES[0].z, m = race(z - .155);
    Object.assign(m.players[0], { x: 0, speed: 8.35, draft: 1 }); Object.assign(m.players[1], { x: 0, z: z + 2.845, speed: 8 });
    ticks(m, 1); expect(m.players[0].z).toBeLessThan(z); expect(m.players[0].hitObstacles).toEqual([]);
    ticks(m, 1); expect(m.players[0].hitObstacles).toEqual([0]);
    const lateral = race(z - .005); lateral.players[0].x = 2.50; lateral.players[1].z += 20;
    const input = idle(); input[0].move = 1; ticks(lateral, 1, input);
    expect(lateral.players[0].x).toBeGreaterThan(2.52); expect(lateral.players[0].hitObstacles).toEqual([0]);
  });
  it('never announces a pass over a finished rival or a projected overtake beyond the finish, in either role', () => {
    for (const slot of [0, 1] as const) for (const finished of [false, true]) {
      const m = race(499.9465), other: Slot = slot === 0 ? 1 : 0;
      Object.assign(m.players[slot], { x: -2, speed: RUN_SPEED + authority.RACE.draftSpeed, draft: 1 });
      Object.assign(m.players[other], { x: 2, z: finished ? COURSE_LENGTH : 499.95, speed: finished ? 0 : RUN_SPEED,
        raceStatus: finished ? 'finished' : 'running', finishTime: finished ? 59 : null });
      m.raceTicks = 60 * 60; ticks(m, 1);
      expect(m.players.every(p => p.raceStatus === 'finished')).toBe(true);
      expect(m.events.some(e => e.type === 'pass')).toBe(false);
      expect(m.players[slot].finishTime).toBeGreaterThan(m.players[other].finishTime ?? Infinity);
      expect(m.players.map(p => p.z)).toEqual([COURSE_LENGTH, COURSE_LENGTH]);
    }
  });
  it('preserves real overtakes before the line, including a tick where both racers finish, in either role', () => {
    for (const slot of [0, 1] as const) for (const z of [100, 499.89]) {
      const m = race(z), other: Slot = slot === 0 ? 1 : 0;
      Object.assign(m.players[slot], { x: -2, speed: RUN_SPEED + authority.RACE.draftSpeed, draft: 1 });
      Object.assign(m.players[other], { x: 2, z: z + .002, speed: RUN_SPEED });
      ticks(m, 1);
      const passes = m.events.filter(e => e.type === 'pass');
      expect(passes).toHaveLength(1); expect(passes[0].slot).toBe(slot);
      expect(passes[0].z).toBeGreaterThan(z + .002); expect(passes[0].z).toBeLessThan(COURSE_LENGTH);
      if (z > 499) {
        expect(m.players.every(p => p.raceStatus === 'finished')).toBe(true);
        expect(m.players[slot].finishTime).toBeLessThan(m.players[other].finishTime ?? -Infinity);
      } else expect(m.players[slot].z).toBeGreaterThan(m.players[other].z);
      ticks(m, 1); expect(m.events.filter(e => e.type === 'pass')).toHaveLength(1);
    }
  });
  it('settles finishers and preserves DNF progress and terminal results', () => {
    const m = race(499.95); Object.assign(m.players[0], { y: .8, vy: -1 }); m.players[1].z = 460;
    ticks(m, 1); expect(m.players[0].raceStatus).toBe('finished'); const finish = m.players[0].finishTime;
    ticks(m, 40); expect(m.players[0].y).toBe(0); expect(m.players[0].finishTime).toBe(finish);
    const dnf = race(100); dnf.raceTicks = RACE_DURATION * 60 - 1; ticks(dnf, 1);
    expect(dnf.phase).toBe('transition'); expect(dnf.players[0].raceStatus).toBe('dnf'); const progress = dnf.players[0].raceProgress;
    ticks(dnf, TRANSITION_DURATION * 60); expect(dnf.players[0].raceProgress).toBe(progress); expect(dnf.players[0].z).toBe(0);
    ticks(dnf, FIGHT_DURATION * 60); expect(dnf.phase).toBe('results'); const final = JSON.stringify(dnf); ticks(dnf, 60); expect(JSON.stringify(dnf)).toBe(final);
  });
});

describe('quick, power, guard and evade', () => {
  it('starts quick on press, preserves its windup and never repeats from a held button', () => {
    for (const character of species) {
      const m = fight([character, 'lion']), input = idle(); input[0].attack = true;
      ticks(m, 1, input); expect(m.players[0].action).toBe('attack'); expect(m.players[0].strikeKind).toBe('quick');
      ticks(m, Math.floor(QUICK_ATTACKS[character].windup * 60) - 1, input); expect(m.players[1].hp).toBe(100);
      ticks(m, 130, input); expect(m.players[1].hp).toBe(100 - QUICK_ATTACKS[character].damage); expect(m.players[0].strikeId).toBe(1);
    }
  });
  it('links exactly two authored contacts from a fresh post-contact press across all species and both walls', () => {
    for (const first of species) for (const second of species) for (const slot of [0, 1] as const) for (const wall of [false, true]) {
      const m = fight([first, second]), other: Slot = slot === 0 ? 1 : 0;
      if (wall) { m.players[other].x = slot === 0 ? 4.4 : -4.4; m.players[slot].x = m.players[other].x + (slot === 0 ? -1.75 : 1.75); }
      let linked = false;
      for (let frame = 0; frame < 150; frame++) {
        const input = idle(); input[slot].attack = frame === 0 || !linked && m.players[slot].comboWindow > 0;
        if (frame > 0 && input[slot].attack) linked = true;
        stepMatch(m, input, FIXED_DT);
      }
      const character = m.players[slot].character;
      expect(m.players[other].hp, `${first}/${second}/${slot}/${wall}`).toBe(100 - QUICK_ATTACKS[character].damage - COMBO_ATTACKS[character].damage);
      expect(m.players[slot].strikeId).toBe(2); expect(m.players[slot].comboStep).toBe(1);
      expect(m.players.every(p => Math.abs(p.x) <= 4.4)).toBe(true);
    }
  });
  it('does not chain a whiff, an early mash or a held attack; cancellation consumes pending links', () => {
    for (const cancel of [false, true]) {
      const m = fight(); if (!cancel) { m.players[0].x = -3; m.players[1].x = 3; }
      let pressed = false;
      for (let frame = 0; frame < 100; frame++) {
        const input = idle(); input[0].attack = frame === 0 || (!cancel && frame === 3);
        if (cancel && !pressed && m.players[0].comboWindow > 0) { input[0].attack = true; input[0].cancelAttack = true; pressed = true; }
        stepMatch(m, input, FIXED_DT);
      }
      expect(m.players[0].strikeId).toBe(1); expect(m.players[0].comboPending).toBe(false);
      if (!cancel) expect(m.players[1].hp).toBe(100);
    }
    const m = fight(), input = idle(); input[0].attack = true; input[0].special = true; input[0].jump = true; input[0].cancelAttack = true;
    ticks(m, 1, input); ticks(m, 60); expect(m.players[0].strikeId).toBe(0); expect(m.players[0].action).toBe('fight_idle');
  });
  it('lets guard or an early evade answer the second hit after taking the first', () => {
    for (const character of species) for (const response of ['guard', 'evade'] as const) {
      const m = fight([character, 'lion']); let linked = false, evaded = false;
      for (let frame = 0; frame < 130; frame++) {
        const input = idle(), a = m.players[0], d = m.players[1]; input[0].attack = frame === 0 || !linked && a.comboWindow > 0;
        if (frame > 0 && input[0].attack) linked = true;
        if (d.hp < 100) {
          if (response === 'guard') input[1].guard = true;
          else if (d.stun === 0 && !evaded) { input[1].jump = true; evaded = true; }
        }
        stepMatch(m, input, FIXED_DT);
      }
      expect(m.players[1].hp).toBe(100 - QUICK_ATTACKS[character].damage);
      expect(m.events.some(e => e.type === (response === 'guard' ? 'block' : 'evade-success'))).toBe(true);
    }
  });
  it('a late wall evade can be caught by the second contact instead of granting instant invulnerability', () => {
    for (const character of species) {
      const m = fight([character, 'lion']); m.players[1].x = 4.4; m.players[0].x = 2.65;
      let linked = false, evaded = false;
      for (let frame = 0; frame < 120; frame++) {
        const input = idle(), a = m.players[0]; input[0].attack = frame === 0 || !linked && a.comboWindow > 0;
        if (frame > 0 && input[0].attack) linked = true;
        if (!evaded && a.comboStep === 1 && a.actionTime >= a.strikeWindup - FIXED_DT * 1.1) { input[1].jump = true; evaded = true; }
        stepMatch(m, input, FIXED_DT);
      }
      expect(evaded).toBe(true); expect(m.players[1].hp).toBe(100 - QUICK_ATTACKS[character].damage - COMBO_ATTACKS[character].damage);
    }
  });
  it('guard blocks quick damage, pays meter, and cannot regenerate a fractional defense while held after a break', () => {
    const m = fight(['lion', 'unicorn']); let broke = false;
    for (let frame = 0; frame < 900 && !broke; frame++) {
      const input = idle(), a = m.players[0], d = m.players[1]; input[1].guard = true;
      if (a.action !== 'attack' && a.stun === 0) { input[0].move = Math.sign(d.x - a.x); input[0].special = frame % 2 === 0; }
      stepMatch(m, input, FIXED_DT); broke = d.guardBroken;
    }
    expect(broke).toBe(true); expect(m.players[1].hp).toBeLessThan(100 - GUARD.powerChip);
    const held = idle(); held[1].guard = true; ticks(m, 90, held); expect(m.players[1].guard).toBe(0); expect(m.players[1].guardBroken).toBe(true);
    ticks(m, 200); expect(m.players[1].guard).toBeGreaterThanOrEqual(GUARD.resume); expect(m.players[1].guardBroken).toBe(false);
    for (const kind of ['quick', 'power'] as const) {
      const trial = fight(), input = idle(); input[1].guard = true; input[0][kind === 'quick' ? 'attack' : 'special'] = true;
      ticks(trial, 60, input); expect(trial.players[1].hp).toBe(kind === 'quick' ? 100 : 100 - GUARD.powerChip);
      expect(trial.players[1].guard).toBeCloseTo(100 - (kind === 'quick' ? QUICK_ATTACKS.lion.damage * GUARD.quickDamageFactor : POWER_RULES.lion.guardDamage));
    }
  });
  it('pays finite guard for one unicorn ward and allows a rival power to interrupt through it', () => {
    const m = fight(['wolf', 'unicorn']), input = idle(); input[1].special = true; ticks(m, 1, input);
    expect(m.players[1].guard).toBe(100 - POWER_RULES.unicorn.wardCost); expect(m.players[1].ward).toBe(true);
    input[1].special = false; input[0].attack = true; ticks(m, 12, input);
    expect(m.players[1].hp).toBe(100); expect(m.players[1].ward).toBe(false); expect(m.events.some(e => e.type === 'ward-block')).toBe(true);
    const heavy = fight(['wolf', 'unicorn']), both = idle(); both[0].special = true; both[1].special = true; ticks(heavy, 48, both);
    expect(heavy.players[1].hp).toBe(100 - ATTACKS.wolf.damage); expect(heavy.players[1].ward).toBe(false); expect(heavy.players[0].hp).toBe(100);
  });
  it('keeps Lion step-in at the end of commitment and makes an early wall evade punishable', () => {
    const m = fight(['lion', 'wolf']); m.players[0].x = -1.5; m.players[1].x = 1.5;
    let firstMovement = Infinity;
    for (let frame = 0; frame < 55; frame++) {
      const input = idle(); input[0].special = frame === 0;
      const before = m.players[0].x, time = m.players[0].actionTime;
      stepMatch(m, input, FIXED_DT);
      if (m.players[0].x !== before) firstMovement = Math.min(firstMovement, time + FIXED_DT);
    }
    expect(firstMovement).toBeGreaterThanOrEqual(ATTACKS.lion.windup - POWER_RULES.lion.stepWindow - 1e-9);
    expect(firstMovement).toBeLessThan(ATTACKS.lion.windup);
    expect(m.players[0].x + 1.5).toBeCloseTo(POWER_RULES.lion.stepSpeed * POWER_RULES.lion.stepWindow, 8);
    for (const character of species) {
      const early = fight([character, 'lion']); early.players[0].x = 2.65; early.players[1].x = 4.4;
      for (let frame = 0; frame < 70; frame++) {
        const input = idle(); input[0].special = frame === 0; input[1].jump = frame === 12;
        stepMatch(early, input, FIXED_DT);
      }
      expect(early.players[1].hp, character).toBe(100 - ATTACKS[character].damage);
      expect(early.events.some(e => e.type === 'evade-success')).toBe(false);
    }
  });
  it('uses the paid Unicorn ward during late commitment, then expires without absorbing recovery hits', () => {
    for (const lateRecovery of [false, true]) {
      const m = fight(['wolf', 'unicorn']);
      if (lateRecovery) { m.players[0].x = -1.2; m.players[1].x = 1.2; }
      let pressed = false;
      for (let frame = 0; frame < 90; frame++) {
        const input = idle(), unicorn = m.players[1]; input[1].special = frame === 0;
        if (!lateRecovery && !pressed && unicorn.actionTime >= .48) { input[0].attack = true; pressed = true; }
        if (lateRecovery && unicorn.actionTime >= .74 && !pressed) {
          if (Math.abs(m.players[0].x - unicorn.x) > 1.82) input[0].move = 1;
          else { input[0].attack = true; pressed = true; }
        }
        stepMatch(m, input, FIXED_DT);
      }
      expect(pressed).toBe(true);
      expect(m.players[1].hp).toBe(lateRecovery ? 100 - QUICK_ATTACKS.wolf.damage : 100);
      expect(m.events.some(e => e.type === 'ward-block')).toBe(!lateRecovery);
      expect(m.players[1].guard).toBeLessThan(100);
    }
    expect(POWER_RULES.unicorn.wardEnd).toBeCloseTo(ATTACKS.unicorn.windup + .06, 8);
  });
  it('wolf power slows ordinary movement briefly without extending hitstun or disabling evade', () => {
    const m = fight(['wolf', 'lion']), input = idle(); input[0].special = true;
    while (m.players[1].hp === 100) ticks(m, 1, input);
    expect(m.players[1].slow).toBe(POWER_RULES.wolf.slowDuration);
    while (m.players[1].stun > 0 || m.hitPause > 0) ticks(m, 1);
    const before = m.players[1].x, move = idle(); move[1].move = 1; ticks(m, 1, move);
    expect(m.players[1].x - before).toBeCloseTo(FIGHT_SPEED.lion * POWER_RULES.wolf.slowFactor * FIXED_DT, 8);
    move[1].jump = true; ticks(m, 1, move); expect(m.players[1].action).toBe('evade');
    while (m.players[1].slow > 0 || m.players[1].action === 'evade') ticks(m, 1);
    const restored = m.players[1].x, left = idle(); left[1].move = -1; ticks(m, 1, left);
    expect(restored - m.players[1].x).toBeCloseTo(FIGHT_SPEED.lion * FIXED_DT, 8);
  });
  it('freezes both fighters for exact contact pause ticks while the match clock and cancellation continue', () => {
    for (const kind of ['quick', 'power'] as const) {
      const m = fight(), input = idle(); input[0][kind === 'quick' ? 'attack' : 'special'] = true;
      while (m.players[1].hp === 100) ticks(m, 1, input);
      expect(m.hitPause).toBe(HIT_PAUSE[kind]);
      const snapshot = m.players.map(p => [p.x, p.actionTime, p.stun, p.invulnerable]), time = m.fightTime;
      const cancel = idle(); cancel[0].attack = true; cancel[0].cancelAttack = true;
      ticks(m, HIT_PAUSE[kind], cancel);
      expect(m.players.map(p => [p.x, p.actionTime, p.stun, p.invulnerable])).toEqual(snapshot);
      expect(m.fightTime).toBeCloseTo(time + HIT_PAUSE[kind] * FIXED_DT, 8); expect(m.hitPause).toBe(0); expect(m.players[0].comboPending).toBe(false);
    }
  });
  it('preserves contact-time strike kind after a later action and JSON snapshot', () => {
    const m = fight(), input = idle(); input[0].attack = true; input[1].guard = true; ticks(m, 50, input);
    const quickBlock = m.events.find(e => e.type === 'block'); expect(quickBlock?.strikeKind).toBe('quick');
    input[0].attack = false; input[0].special = true; ticks(m, 90, input);
    expect(m.players[0].strikeKind).toBe('power'); expect(m.events.some(e => e.type === 'block' && e.strikeKind === 'power')).toBe(true);
    input[0].special = false;
    for (let frame = 0; frame < 120 && m.players[0].action === 'attack'; frame++) ticks(m, 1, input);
    expect(m.players[0].action).not.toBe('attack');
    input[0].special = true; ticks(m, 60, input);
    expect(m.events.some(e => e.type === 'guard-break' && e.strikeKind === 'power')).toBe(true);
    expect(m.events.some(e => e.type === 'hit' && e.strikeKind === 'power')).toBe(true);
    const copy: Match = JSON.parse(JSON.stringify(m)); expect(copy.events.find(e => e.id === quickBlock?.id)?.strikeKind).toBe('quick');
  });
  it('supports delayed evade/approach/punish of every power in both roles, ordinary gaps and walls', () => {
    for (const a of species) for (const b of species) for (const slot of [0, 1] as const)
      for (const reaction of [.42, .50]) for (const gap of [1.75, 1.83]) for (const wall of [false, true]) {
        const r = powerPunish(a, b, slot, reaction, gap, wall), label = `${a}/${b}/${slot}/${reaction}/${gap}/${wall}`;
        expect(r.m.players[r.defender].hp, label).toBe(100); expect(r.m.players[slot].hp, label).toBeLessThan(100);
        expect(r.recovery, label).toBe(true); expect(r.m.players[r.defender].strikeWindup).toBe(COUNTER_WINDUP);
      }
  });
  it('gathers simultaneous contacts before mutation and preserves role-reflected power counters', () => {
    const m = fight(['lion', 'wolf']);
    m.players.forEach(p => { p.hp = QUICK_ATTACKS[p.character === 'lion' ? 'wolf' : 'lion'].damage; p.action = 'attack'; p.actionTime = p.strikeWindup = QUICK_ATTACKS[p.character].windup; });
    ticks(m, 1); expect(m.players.map(p => p.hp)).toEqual([0, 0]); expect(m.fightEnd).toBe('double-knockout'); expect(m.result?.winner).toBeNull();
    for (const a of species) for (const b of species) {
      const left = powerPunish(a, b, 0, .45, 1.8, false), right = powerPunish(b, a, 1, .45, 1.8, false);
      expect(left.m.players.map(p => p.hp)).toEqual(right.m.players.map(p => p.hp).reverse());
      expect(left.m.fightTime).toBe(right.m.fightTime); expect(left.m.players[0].x).toBeCloseTo(-right.m.players[1].x, 8);
    }
  });
});

describe('fair CPU, replay and bounded state', () => {
  it('shows imperfect CPU evades only after visible power windup, using ordinary cooldown and input', () => {
    let attempts = 0;
    for (let seed = 1; seed <= 24; seed++) {
      const m = fight(['lion', 'wolf']); m.seed = seed;
      let attempted = false;
      for (let frame = 0; frame < 36; frame++) {
        const input = idle(); input[0].special = frame === 0; input[1] = cpuInput(m, 1);
        if (input[1].jump) { expect(m.players[0].actionTime).toBeGreaterThanOrEqual(.16); attempted = true; }
        stepMatch(m, input, FIXED_DT);
      }
      if (attempted) attempts++;
    }
    expect(attempts).toBeGreaterThan(0); expect(attempts).toBeLessThan(24);
  });
  it('runs public Duel Practice through its real intro and fight with no fabricated race points', () => {
    const m = createDuelMatch(['lion', 'wolf'], 47);
    expect(m.format).toBe('duel'); expect(m.phase).toBe('transition');
    ticks(m, TRANSITION_DURATION * 60 - 1); expect(m.phase).toBe('transition');
    ticks(m, 1); expect(m.phase).toBe('fight'); expect(m.players.map(p => p.hp)).toEqual([100, 100]);
    for (let frame = 0; frame < FIGHT_DURATION * 60 + 1 && m.phase !== 'results'; frame++) {
      stepMatch(m, [cpuInput(m, 0), cpuInput(m, 1)], FIXED_DT);
    }
    expect(m.phase).toBe('results'); expect(m.raceTime).toBe(0);
    expect(m.players.every(p => p.finishTime === null)).toBe(true);
    expect(m.result?.race).toEqual([0, 0]); expect(m.result?.total).toEqual(m.result?.fight);
    if (!m.result) throw new Error('Missing practice result');
    expect(m.result.fight[0] + m.result.fight[1]).toBe(100);
    expect(m.result?.reason).toContain('Duel Practice');
    const again = createDuelMatch(['lion', 'wolf'], 47); forfeitMatch(again, 0);
    expect(again.result?.race).toEqual([0, 0]); expect(again.result?.fight).toEqual([0, 100]);
    expect(createMatch(['lion', 'wolf']).format).toBe('championship');
  });
  it('rejects the old guard-as-evade semantics against a real held defense', () => {
    for (const old of [false, true]) {
      const s = old ? historicalAuthority() : authority, m = s.createMatch(['lion', 'wolf']); m.phase = 'fight';
      m.players.forEach((p, i) => { p.x = i === 0 ? 2.65 : 4.4; p.action = 'fight_idle'; });
      const input: [Input, Input] = [s.neutralInput(), s.neutralInput()]; input[0].attack = true; input[1].guard = true;
      for (let frame = 0; frame < 90; frame++) s.stepMatch(m, input, s.FIXED_DT);
      if (old) expect(m.players[1].hp).toBeLessThan(100); else expect(m.players[1].hp).toBe(100);
    }
  });

  it('completes all nine championships across three seeds with the shared physics and no DNF', () => {
    for (const a of species) for (const b of species) for (const seed of [1, 47, 2026]) {
      const m = fullCpu([a, b], seed); expect(m.phase, `${a}/${b}/${seed}`).toBe('results');
      expect(m.players.every(p => p.raceStatus === 'finished')).toBe(true); expect(m.raceTime).toBeLessThan(80);
      expect(m.players.some(p => p.hp < 100)).toBe(true); expect(m.events.length).toBeLessThanOrEqual(48);
      if (!m.result) throw new Error("Missing championship result");
      expect(m.result.total[0] + m.result.total[1]).toBe(100);
    }
  });
  it('keeps a readable CPU opening and only evades after observing sufficient windup', () => {
    const m = fight(['lion', 'wolf']); m.players[0].x = -1.75; m.players[1].x = 1.75; m.seed = 47;
    let firstAttack = Infinity;
    for (let frame = 0; frame < 1200 && m.phase === 'fight'; frame++) {
      const input = idle(); input[1] = cpuInput(m, 1);
      if (input[1].attack) firstAttack = Math.min(firstAttack, m.fightTime);
      expect(Math.abs(input[1].move)).toBeLessThanOrEqual(1); stepMatch(m, input, FIXED_DT);
    }
    expect(firstAttack).toBeGreaterThanOrEqual(1.8); expect(firstAttack).toBeLessThan(5);
    const seen = fight(['lion', 'wolf']); const input = idle(); input[0].attack = true;
    for (let frame = 0; frame < 15; frame++) { input[1] = cpuInput(seen, 1); expect(input[1].jump).toBe(false); stepMatch(seen, input, FIXED_DT); }
  });
  it('replays new serializable drafting, evade and counter state exactly after JSON transfer', () => {
    let m = createMatch(['wolf', 'unicorn'], 2026); ticks(m, 200);
    const copy: Match = JSON.parse(JSON.stringify(m));
    for (let frame = 0; frame < 7000 && m.phase !== 'results'; frame++) {
      stepMatch(m, [cpuInput(m, 0), cpuInput(m, 1)], FIXED_DT); stepMatch(copy, [cpuInput(copy, 0), cpuInput(copy, 1)], FIXED_DT);
    }
    expect(copy).toEqual(m); expect(m.phase).toBe('results');
    m = fight(); const input = idle(); input[0].move = NaN; input[1].move = 1000; ticks(m, 120, input);
    expect(m.players.every(p => Number.isFinite(p.x) && Math.abs(p.x) <= 4.4)).toBe(true);
    expect(FIGHT_SPEED.wolf).toBeGreaterThan(FIGHT_SPEED.lion); expect(DODGE.unicorn.invulnerableEnd).toBeGreaterThan(DODGE.lion.invulnerableEnd);
    expect(Math.abs(m.players[0].x - m.players[1].x)).toBeGreaterThanOrEqual(FIGHT_BODY_GAP - 1e-9);
  });
});
