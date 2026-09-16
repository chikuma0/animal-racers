import { describe, expect, it } from 'vitest';
import {
  ATTACKS, COURSE_LENGTH, COUNTDOWN_DURATION, FIGHT_DURATION, FIXED_DT, OBSTACLES,
  RACE_DURATION, RUN_SPEED, TRANSITION_DURATION, createMatch, cpuInput, forfeitMatch, neutralInput,
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
    player.x = i === 0 ? -.65 : .65; player.action = 'fight_idle';
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
    const result = scoreMatch(scored([69, 70], [0, 80]));
    expect(result.race).toEqual([26.6, 23.4]);
    expect(result.fight).toEqual([5, 45]);
    expect(result.total).toEqual([31.6, 68.4]);
    expect(result.winner).toBe(1);
  });
  it('preserves a strong race win against a close fight loss', () => {
    const result = scoreMatch(scored([64, 76], [0, 10]));
    expect(result.race).toEqual([43.8, 6.2]);
    expect(result.fight).toEqual([22.5, 27.5]);
    expect(result.winner).toBe(0);
  });
  it('has an exact tie when equal normalized split wins cancel', () => {
    const result = scoreMatch(scored([68, 76], [0, 50]));
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
    expect(scoreMatch(near).race[0]).toBeLessThan(26);
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

describe('race and phase rules', () => {
  it('uses exact fixed ticks, seconds and a bounded countdown', () => {
    const match = createMatch(['lion', 'unicorn']);
    ticks(match, 179); expect(match.phaseTime).toBeCloseTo(179 / 60); expect(match.phase).toBe('countdown');
    ticks(match, 1); expect(match.phase).toBe('race'); expect(match.phaseTime).toBe(0);
    for (const invalid of [0, -1, 1 / 30, NaN, Infinity]) expect(() => stepMatch(match, idle(), invalid)).toThrow('1/60');
    ticks(match, 60); expect(match.raceTime).toBe(1);
    expect(match.players[0].z).toBeCloseTo(1.75, 8); expect(match.players[0].speed).toBeCloseTo(3.5, 8);
  });
  it('requires genuine obstacle clearance and only hits each crossed obstacle once', () => {
    for (const [y, hit] of [[0, true], [1.1, false]] as const) {
      const match = createMatch(['lion', 'wolf']); match.phase = 'race';
      Object.assign(match.players[0], { z: 44, x: 0, speed: RUN_SPEED, y });
      ticks(match, 10);
      expect(match.players[0].hitObstacles.includes(0)).toBe(hit);
      expect(match.events.filter(e => e.type === 'obstacle' && e.slot === 0)).toHaveLength(hit ? 1 : 0);
    }
    const arch = createMatch(['lion', 'wolf']); arch.phase = 'race';
    Object.assign(arch.players[0], { z: 137, x: 0, speed: RUN_SPEED, y: 2 }); ticks(arch, 8);
    expect(arch.players[0].hitObstacles).toContain(3);
  });
  it('recovers from hazards and prevents held-jump auto-hopping', () => {
    const match = createMatch(['lion', 'wolf']); match.phase = 'race';
    Object.assign(match.players[0], { z: 44, x: 0, speed: RUN_SPEED }); ticks(match, 8);
    expect(match.players[0].stun).toBeGreaterThan(0);
    match.players[0].x = 4.3; ticks(match, 180);
    expect(match.players[0].speed).toBeCloseTo(RUN_SPEED); expect(match.players[0].stun).toBe(0);
    const input = idle(); input[0].jump = true; ticks(match, 150, input);
    expect(match.events.filter(e => e.type === 'jump' && e.slot === 0)).toHaveLength(1);
    expect(match.players[0].y).toBe(0);
  });
  it('interpolates finish time and enters combat with equal fresh stats', () => {
    const match = createMatch(['lion', 'wolf']); match.phase = 'race';
    match.players.forEach(player => Object.assign(player, { z: COURSE_LENGTH - .1, speed: RUN_SPEED, hp: 40, energy: 0 }));
    ticks(match, 1); expect(match.phase).toBe('transition');
    expect(match.players[0].finishTime).toBeGreaterThan(0); expect(match.players[0].finishTime).toBeLessThan(FIXED_DT);
    ticks(match, TRANSITION_DURATION * 60); expect(match.phase).toBe('fight');
    for (const player of match.players) {
      expect(player.hp).toBe(100); expect(player.energy).toBe(100); expect(player.guard).toBe(100); expect(player.z).toBe(0);
    }
  });
  it('forces race DNF at the deadline and preserves progress through arena reset', () => {
    const match = createMatch(['lion', 'wolf']); match.phase = 'race';
    match.raceTicks = RACE_DURATION * 60 - 1;
    Object.assign(match.players[0], { z: 400, speed: RUN_SPEED }); Object.assign(match.players[1], { z: 200, speed: RUN_SPEED });
    ticks(match, 1); expect(match.phase).toBe('transition');
    const result = scoreMatch(match); ticks(match, TRANSITION_DURATION * 60);
    expect(match.players.map(p => p.raceStatus)).toEqual(['dnf', 'dnf']);
    expect(scoreMatch(match).race).toEqual(result.race);
  });
  it('lets an early airborne finisher land without changing recorded time or progress', () => {
    const match = createMatch(['lion', 'wolf']); match.phase = 'race';
    Object.assign(match.players[0], { z: COURSE_LENGTH - .1, speed: RUN_SPEED, y: 1.1, vy: 1 });
    ticks(match, 1);
    const player = match.players[0], finishedAt = player.finishTime;
    expect(player.raceStatus).toBe('finished'); expect(player.y).toBeGreaterThan(0);
    ticks(match, 90);
    expect(match.phase).toBe('race'); expect(player.y).toBe(0); expect(player.vy).toBe(0);
    expect(player.action).toBe('race_idle'); expect(player.finishTime).toBe(finishedAt);
    expect(player.z).toBe(COURSE_LENGTH); expect(player.raceProgress).toBe(COURSE_LENGTH);
  });
  it('bounds lateral motion and sanitizes hostile numerical input', () => {
    const match = createMatch(['wolf', 'unicorn']); match.phase = 'race';
    const input = idle(); input[0].move = 10000; input[1].move = NaN; ticks(match, 180, input);
    expect(match.players[0].x).toBe(4.3); expect(Number.isFinite(match.players[1].x)).toBe(true);
    expect(OBSTACLES.every(o => o.z > 30 && o.z < COURSE_LENGTH)).toBe(true);
  });
  it('requires steering at both course edges while retaining the intended race duration', () => {
    const match = createMatch(['lion', 'wolf']); match.phase = 'race';
    const input = idle(); input[0].move = -1; input[1].move = 1;
    for (let i = 0; i < RACE_DURATION * 60 && match.phase === 'race'; i++) ticks(match, 1, input);
    expect(match.players[0].hitObstacles).toContain(13);
    expect(match.players[1].hitObstacles).toContain(12);
    expect(match.players.every(p => p.raceStatus === 'finished')).toBe(true);
    expect(match.raceTime).toBeGreaterThan(60); expect(match.raceTime).toBeLessThan(80);
  });
});

describe('combat contact, defense and recovery', () => {
  it('telegraphs attacks before contact and cannot hit a distant opponent', () => {
    const match = fight(); const input = idle(); input[0].attack = true;
    ticks(match, 10, input); expect(match.players[1].hp).toBe(100);
    ticks(match, 3, input); expect(match.players[1].hp).toBe(89);
    ticks(match, 60, input); expect(match.players[1].hp).toBe(89);
    const far = fight(); far.players[1].x = 4; ticks(far, 60, input);
    expect(far.players[1].hp).toBe(100);
  });
  it('resolves simultaneous contact symmetrically, including double knockout', () => {
    const match = fight(); match.players.forEach(player => { player.hp = 11; });
    const input = idle(); input.forEach(p => { p.attack = true; }); ticks(match, 14, input);
    expect(match.players.map(p => p.hp)).toEqual([0, 0]); expect(match.fightEnd).toBe('double-knockout');
    expect(match.result?.winner).toBeNull(); expect(match.result?.fight).toEqual([25, 25]);
  });
  it('requires forward and vertical hit volumes', () => {
    const match = fight(); const player = match.players[0];
    Object.assign(player, { action: 'attack', actionTime: ATTACKS.attack.windup, facing: -1 }); ticks(match, 1);
    expect(match.players[1].hp).toBe(100);
    player.actionTime = ATTACKS.attack.windup; player.facing = 1;
    Object.assign(match.players[1], { y: 1.5, vy: 0 }); ticks(match, 1);
    expect(match.players[1].hp).toBe(100);
  });
  it('guard reduces damage, consumes a finite meter and can break', () => {
    const match = fight(); match.players[1].guard = 15;
    const input = idle(); input[0].attack = true; input[1].guard = true; ticks(match, 14, input);
    expect(match.players[1].hp).toBe(99); expect(match.players[1].guard).toBe(0);
    expect(match.events.some(e => e.type === 'guard-break')).toBe(true);
    expect(match.players[1].stun).toBeLessThanOrEqual(.38);
    ticks(match, 75); expect(match.players[1].guard).toBeGreaterThan(0);
  });
  it('a broken held guard takes full pressure damage before recovering, then re-arms without another press', () => {
    const match = fight(); match.players[1].guard = 15;
    const pressure = idle(); pressure[0].attack = true; pressure[1].guard = true;
    ticks(match, 14, pressure);
    const defender = match.players[1];
    expect(defender.hp).toBe(99); expect(defender.guardBroken).toBe(true);
    pressure[0].attack = false; ticks(match, 28, pressure);
    pressure[0].attack = true; ticks(match, 14, pressure);
    expect(defender.hp).toBe(88);
    expect(defender.guardBroken).toBe(true); expect(defender.action).not.toBe('guard');
    pressure[0].attack = false; ticks(match, 120, pressure);
    expect(defender.guardBroken).toBe(false); expect(defender.guard).toBeGreaterThanOrEqual(25);
    expect(defender.action).toBe('guard');
  });
  it('sustained legal strikes cannot farm fractional guard into permanent one-damage blocks', () => {
    const match = fight();
    let breaks = 0, fullHits = 0, lastSequence = 0;
    for (let frame = 0; frame < 600 && match.phase === 'fight'; frame++) {
      const pressure = idle();
      pressure[0].move = Math.sign(match.players[1].x - match.players[0].x);
      pressure[0].attack = frame % 36 === 0 && Math.abs(match.players[1].x - match.players[0].x) <= 1.45;
      pressure[1].guard = true;
      stepMatch(match, pressure, FIXED_DT);
      for (const event of match.events.filter(event => event.id > lastSequence)) {
        if (event.type === 'guard-break' && event.slot === 1) breaks++;
        if (event.type === 'hit' && event.slot === 1) fullHits++;
        lastSequence = event.id;
      }
    }
    expect(breaks).toBeGreaterThan(0); expect(fullHits).toBeGreaterThanOrEqual(3);
    expect(match.players[1].hp).toBeLessThan(60);
  });
  it('allows action after hitstun while protected against immediate repeat hits', () => {
    const match = fight(); const input = idle(); input[0].attack = true; ticks(match, 13, input);
    const defender = match.players[1]; expect(defender.hp).toBe(89);
    ticks(match, 14); expect(defender.stun).toBe(0); expect(defender.invulnerable).toBeGreaterThan(0);
    const position = defender.x; const escape = idle(); escape[1].move = 1; ticks(match, 2, escape);
    expect(defender.x).toBeGreaterThan(position);
    Object.assign(match.players[0], { x: defender.x - 1, action: 'attack', actionTime: ATTACKS.attack.windup, attackConnected: false });
    ticks(match, 1); expect(defender.hp).toBe(89);
  });
  it('buffers a deliberate press through the final 140ms of recovery without repeating held attacks', () => {
    const match = fight();
    Object.assign(match.players[0], { action: 'attack', actionTime: .47, attackConnected: true });
    const input = idle(); input[0].attack = true; ticks(match, 8, input);
    expect(match.players[0].action).toBe('attack'); expect(match.players[0].actionTime).toBeLessThan(.1);
    expect(match.events.filter(e => e.type === 'attack' && e.slot === 0)).toHaveLength(1);
    ticks(match, 100, input);
    expect(match.events.filter(e => e.type === 'attack' && e.slot === 0)).toHaveLength(1);
  });
  it('expires an early buffered press rather than firing an unexpected delayed attack', () => {
    const match = fight(); Object.assign(match.players[0], { action: 'special', actionTime: .1 });
    const input = idle(); input[0].attack = true; ticks(match, 1, input); ticks(match, 80);
    expect(match.events.filter(e => e.type === 'attack' && e.slot === 0)).toHaveLength(0);
  });
  it('has three distinct specials with shared cost and no hidden character health buffs', () => {
    for (const character of ['lion', 'wolf', 'unicorn'] as const) {
      const match = fight([character, 'wolf']); const input = idle(); input[0].special = true;
      ticks(match, 1, input); expect(match.players[0].energy).toBe(60); expect(match.players[0].cooldown).toBe(3.2);
      ticks(match, 35, input); expect(match.players[1].hp).toBe(100 - ATTACKS[character].damage);
    }
    expect(ATTACKS.wolf.reach).toBeGreaterThan(ATTACKS.lion.reach);
    const ward = fight(['lion', 'unicorn']); const input = idle(); input[0].attack = true; input[1].special = true;
    ticks(ward, 14, input); expect(ward.players[1].hp).toBe(100);
    expect(ward.events.some(e => e.type === 'ward')).toBe(true);
  });
  it('punishes a missed special during its recovery', () => {
    const match = fight(['wolf', 'lion']);
    Object.assign(match.players[0], { action: 'special', actionTime: .68, cooldown: 2, attackConnected: false });
    const input = idle(); input[1].attack = true; ticks(match, 14, input);
    expect(match.players[0].hp).toBe(89); expect(match.players[0].action).toBe('hit');
  });
  it('always bounds passive combat and preserves the final result', () => {
    const match = fight(); ticks(match, FIGHT_DURATION * 60);
    expect(match.phase).toBe('results'); expect(match.fightTime).toBe(FIGHT_DURATION);
    expect(match.fightEnd).toBe('timeout'); expect(match.result?.total).toEqual([50, 50]);
    const terminal = JSON.stringify(match); ticks(match, 300); expect(JSON.stringify(match)).toBe(terminal);
  });
});

describe('determinism, CPU and replay', () => {
  it('gives the first-time player an opening before ordinary CPU pressure and reproduces the idle KO fixture', () => {
    const match = createMatch(['unicorn', 'lion'], 6827);
    let firstCpuAttack: number | null = null;
    const cpuStarts: number[] = []; let lastEvent = 0;
    for (let tick = 0; tick < 10000 && match.phase !== 'results'; tick++) {
      stepMatch(match, [neutralInput(), cpuInput(match, 1)], FIXED_DT);
      if (match.phase === 'fight' && firstCpuAttack === null && ['attack', 'special'].includes(match.players[1].action)) firstCpuAttack = match.fightTime;
      for (const event of match.events.filter(event => event.id > lastEvent)) {
        if (event.slot === 1 && ['attack', 'special'].includes(event.type)) cpuStarts.push(match.fightTime);
        lastEvent = event.id;
      }
    }
    if (firstCpuAttack === null) throw new Error('The CPU never began an attack');
    expect(firstCpuAttack).toBeGreaterThanOrEqual(1.5);
    expect(cpuStarts.length).toBeGreaterThan(1);
    for (let index = 1; index < cpuStarts.length; index++) expect(cpuStarts[index] - cpuStarts[index - 1]).toBeGreaterThanOrEqual(1.2 - FIXED_DT / 2);
    expect(match.phase).toBe('results'); expect(match.fightTime).toBeCloseTo(10.2, 6);
    expect(match.players.map(player => player.hp)).toEqual([0, 100]);
  });
  it('allows ordinary repeated strikes to punish the beginner CPU without any player stat assist', () => {
    const match = createMatch(['unicorn', 'lion'], 6827);
    for (let tick = 0; tick < 10000 && match.phase !== 'results'; tick++) {
      const player = neutralInput();
      if (match.phase === 'fight') player.attack = match.fightTicks % 36 === 0;
      stepMatch(match, [player, cpuInput(match, 1)], FIXED_DT);
    }
    expect(match.phase).toBe('results'); expect(match.fightEnd).toBe('knockout');
    expect(match.players[0].hp).toBeGreaterThan(0); expect(match.players[1].hp).toBe(0);
    expect(match.players[0].hp).toBeLessThan(100);
    expect(match.events.some(event => event.slot === 1 && ['attack', 'special'].includes(event.type))).toBe(true);
    expect(match.fightTime).toBeLessThan(15);
  });
  it('completes every ordered character matchup across three seeds with visible combat and no DNFs', () => {
    for (const first of ['lion', 'wolf', 'unicorn'] as const) {
      for (const second of ['lion', 'wolf', 'unicorn'] as const) {
        for (const seed of [1, 47, 2026]) {
          const match = fullCpu([first, second], seed);
          expect(match.phase, `${first}/${second}/${seed}`).toBe('results');
          expect(match.players.every(p => p.raceStatus === 'finished')).toBe(true);
          expect(match.raceTime).toBeLessThan(80);
          expect(match.players.some(p => p.hp < 100)).toBe(true);
          expect(match.events.length).toBeLessThanOrEqual(48);
          if (match.result === null) throw new Error(`Missing championship result for ${first}/${second}/${seed}`);
          expect(match.result.total[0] + match.result.total[1]).toBe(100);
        }
      }
    }
  });
  it('reproduces an entire CPU championship exactly from the same seed', () => {
    expect(fullCpu(['unicorn', 'wolf'], 817)).toEqual(fullCpu(['unicorn', 'wolf'], 817));
  });
  it('resumes from a plain JSON snapshot without changing decisions or results', () => {
    const original = createMatch(['wolf', 'lion'], 892);
    for (let i = 0; i < 4300; i++) stepMatch(original, [cpuInput(original, 0), cpuInput(original, 1)], FIXED_DT);
    const restored: Match = JSON.parse(JSON.stringify(original));
    for (let i = 0; i < 5000 && original.phase !== 'results'; i++) {
      for (const match of [original, restored]) stepMatch(match, [cpuInput(match, 0), cpuInput(match, 1)], FIXED_DT);
    }
    expect(original.phase).toBe('results'); expect(restored).toEqual(original);
  });
  it('makes CPU decisions at 200ms intervals through ordinary legal inputs', () => {
    const match = fight(); const first = cpuInput(match, 0);
    match.players[1].x = 4;
    for (let i = 1; i < 12; i++) { match.tick = i; expect(cpuInput(match, 0)).toEqual(first); }
    match.tick = 12; const next = cpuInput(match, 0); expect(next.move).toBe(1);
    for (const slot of [0, 1] as Slot[]) {
      const input = cpuInput(match, slot); expect(Math.abs(input.move)).toBeLessThanOrEqual(1);
      expect(match.players[slot].hp).toBe(100); expect(match.players[slot].energy).toBe(100);
    }
  });
});
