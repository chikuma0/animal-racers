import { describe, expect, it } from 'vitest';
import {
  ATTACKS, DODGE, RACE, FIGHT_SPEED, FIGHT_BODY_GAP, COUNTER_WINDUP, COURSE_LENGTH, COUNTDOWN_DURATION, FIGHT_DURATION, FIXED_DT, OBSTACLES,
  courseCenter, courseSlope, courseCurvature, COURSE_MAX_SECOND_DERIVATIVE, strikePhase, strikeTiming,
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
function punish(first: CharacterId, second: CharacterId, attacker: Slot, reaction: number, gap: number) {
  const match = fight([first, second]), defender: Slot = attacker === 0 ? 1 : 0;
  match.players[0].x = -gap / 2; match.players[1].x = gap / 2;
  let dodged = false, struck = false, last = 0, hitDuringRecovery = false, firstHitTime = 0;
  for (let frame = 0; frame < 240; frame++) {
    const input = idle(), a = match.players[attacker], d = match.players[defender];
    if (frame === 0) input[attacker].attack = true;
    if (!dodged && match.fightTime >= reaction) { input[defender].jump = true; dodged = true; }
    if (dodged && !input[defender].jump && d.action !== 'evade') {
      if (Math.abs(a.x - d.x) > 1.82) input[defender].move = Math.sign(a.x - d.x);
      else if (!struck) { input[defender].attack = true; struck = true; }
    }
    const oldPhase = strikePhase(a);
    stepMatch(match, input, FIXED_DT);
    for (const e of match.events.filter(e => e.id > last)) {
      if (e.type === 'hit' && e.slot === attacker) { hitDuringRecovery = oldPhase === 'recovery'; firstHitTime = match.fightTime; }
      last = e.id;
    }
    if (a.hp < 100) break;
  }
  return { match, hitDuringRecovery, firstHitTime, attacker, defender };
}
function repeatedPressure(first: CharacterId, second: CharacterId, attacker: Slot, reaction: number, gap: number, wall: boolean) {
  const match = fight([first, second]), defender: Slot = attacker === 0 ? 1 : 0;
  match.players[0].x = -gap / 2; match.players[1].x = gap / 2;
  if (wall) {
    match.players[defender].x = attacker === 0 ? 4.4 : -4.4;
    match.players[attacker].x = match.players[defender].x + (attacker === 0 ? -gap : gap);
  }
  let seenStrike = 0, successes = 0, lastEvent = 0;
  for (let frame = 0; frame < 1800 && match.phase === 'fight'; frame++) {
    const input = idle(), a = match.players[attacker], d = match.players[defender];
    const distance = Math.abs(a.x - d.x), toward = Math.sign(d.x - a.x);
    if (a.action !== 'attack' && a.action !== 'evade' && a.stun === 0) {
      input[attacker].move = distance > 1.81 ? toward : 0;
      input[attacker].attack = distance <= 1.83;
    }
    if (d.action !== 'attack' && d.action !== 'evade' && d.stun === 0) {
      if (a.strikeId !== seenStrike && strikePhase(a) === 'windup' && a.actionTime >= reaction && d.dodgeCooldown === 0) {
        input[defender].jump = true; seenStrike = a.strikeId;
      } else if (d.counterWindow > 0) {
        input[defender].move = distance > 1.81 ? -toward : 0; input[defender].attack = distance <= 1.83;
      }
    }
    stepMatch(match, input, FIXED_DT);
    expect(match.players.every(p => Math.abs(p.x) <= 4.4)).toBe(true);
    expect(Math.abs(a.x - d.x)).toBeGreaterThanOrEqual(FIGHT_BODY_GAP - 1e-8);
    for (const e of match.events.filter(e => e.id > lastEvent)) {
      if (e.type === 'evade-success' && e.slot === defender) successes++;
      lastEvent = e.id;
    }
  }
  return { match, defender, successes };
}

describe('steer, leap and visible race rivalry', () => {
  it('keeps fixed seconds, bounded phases and rejects other timesteps', () => {
    const m = createMatch(['lion', 'unicorn']); ticks(m, 179); expect(m.phase).toBe('countdown');
    ticks(m, 1); expect(m.phase).toBe('race'); expect(m.phaseTime).toBe(0);
    for (const dt of [0, -1, 1 / 30, NaN, Infinity]) expect(() => stepMatch(m, idle(), dt)).toThrow('1/60');
    ticks(m, 60); expect(m.raceTime).toBe(1); expect(m.players[0].speed).toBeCloseTo(6.5, 8);
    expect(m.players[0].z).toBeCloseTo(3.25, 8);
  });
  it('uses one differentiable course for scenery and actual outward steering influence', () => {
    for (const z of [30, 100, 210, 350, 460]) {
      expect((courseCenter(z + .01) - courseCenter(z - .01)) / .02).toBeCloseTo(courseSlope(z), 7);
      expect(Math.abs((courseSlope(z + .01) - courseSlope(z - .01)) / .02)).toBeLessThanOrEqual(COURSE_MAX_SECOND_DERIVATIVE);
    }
    const m = race(100), x = m.players[0].x; ticks(m, 1);
    expect(Math.sign(m.players[0].x - x)).toBe(-Math.sign(courseCurvature(100)));
  });
  it('rewards a clean line over coasting or wall-riding, and promptly recovers from the rough shoulder', () => {
    const outcomes = ['line', 'neutral', 'edge'].map(policy => {
      const m = race(25); Object.assign(m.players[1], { raceStatus: 'finished', finishTime: 0, z: COURSE_LENGTH });
      for (let frame = 0; frame < 480; frame++) {
        const input = idle(), p = m.players[0];
        input[0].move = policy === 'line' ? steer(0, p.x) : policy === 'edge' ? 1 : 0;
        input[0].jump = p.z > 78.5 && p.z < 79;
        stepMatch(m, input, FIXED_DT);
      }
      expect(m.players[0].hitObstacles).toEqual([]); return m;
    });
    expect(outcomes[0].players[0].z - outcomes[1].players[0].z).toBeGreaterThan(3);
    expect(outcomes[0].players[0].z - outcomes[2].players[0].z).toBeGreaterThan(6);
    expect(outcomes[2].players[0].speed).toBeCloseTo(RUN_SPEED * RACE.shoulderSpeed, 8);
    const edge = outcomes[2], input = idle(); input[0].move = -1; ticks(edge, 20, input);
    expect(edge.players[0].x).toBeLessThan(RACE.shoulderStart); expect(edge.players[0].speed).toBe(RUN_SPEED);
    expect(edge.players[0].stun).toBe(0);
  });
  it('recovers a missed obstacle within .8s and loses under1.6m against a legal leap', () => {
    const missed = race(78), cleared = race(78); let hitAt = -1, recoveredAt = -1;
    for (let frame = 0; frame < 180; frame++) {
      const a = idle(), b = idle(); a[0].move = steer(0, missed.players[0].x); b[0].move = steer(0, cleared.players[0].x);
      b[0].jump = frame === 0; stepMatch(missed, a, FIXED_DT); stepMatch(cleared, b, FIXED_DT);
      if (hitAt < 0 && missed.players[0].hitObstacles.length) hitAt = frame;
      if (hitAt >= 0 && recoveredAt < 0 && missed.players[0].speed >= RUN_SPEED - 1e-8) recoveredAt = frame;
    }
    expect(missed.players[0].hitObstacles).toEqual([0]); expect(cleared.players[0].hitObstacles).toEqual([]);
    expect((recoveredAt - hitAt) / 60).toBeLessThan(.8);
    expect(cleared.players[0].z - missed.players[0].z).toBeGreaterThan(.5);
    expect(cleared.players[0].z - missed.players[0].z).toBeLessThan(1.6);
  });
  it('never adjudicates a projected obstacle crossing that queued-body correction removes', () => {
    const m = race(81.845); Object.assign(m.players[0], { x: 0, speed: 9.8, draft: 1 });
    Object.assign(m.players[1], { x: 0, z: 84.845, speed: 8 });
    ticks(m, 1); expect(m.players[0].z).toBeLessThan(82); expect(m.players[0].hitObstacles).toEqual([]);
    ticks(m, 1); expect(m.players[0].hitObstacles).toEqual([0]);
  });
  it('uses interpolated lateral position at a hazard crossing', () => {
    const m = race(81.995); m.players[0].x = 2.50; m.players[1].z += 20;
    const input = idle(); input[0].move = 1; ticks(m, 1, input);
    expect(m.players[0].x).toBeGreaterThan(2.52); expect(m.players[0].hitObstacles).toEqual([0]);
  });
  it('charges behind a rival, queues without passing through, then passes by steering out in either role', () => {
    for (const slot of [0, 1] as const) {
      const m = race(100), rival: Slot = slot === 0 ? 1 : 0;
      Object.assign(m.players[slot], { x: 0, z: 100 }); Object.assign(m.players[rival], { x: 0, z: 107 });
      let swing = false, ready = false, passed = false;
      for (let frame = 0; frame < 390; frame++) {
        const p = m.players[slot], o = m.players[rival], input = idle();
        if (p.draft >= .99) ready = true;
        if (ready && o.z - p.z < 3.6) swing = true;
        input[slot].move = steer(swing ? 2 : 0, p.x); input[rival].move = steer(0, o.x);
        stepMatch(m, input, FIXED_DT);
        expect(p.speed).toBeLessThanOrEqual(RUN_SPEED + RACE.draftSpeed + 1e-9);
        if (Math.abs(p.x - o.x) < RACE.bodyWidth - 1e-9) expect(Math.abs(p.z - o.z)).toBeGreaterThanOrEqual(RACE.bodyGap - 1e-8);
        if (p.z > o.z) { passed = true; break; }
      }
      expect(ready).toBe(true); expect(swing).toBe(true); expect(passed).toBe(true);
      expect(m.events.some(e => e.type === 'pass' && e.slot === slot)).toBe(true);
    }
  });
  it('has no hidden draft bonus out of position and ignores the retired burst button', () => {
    const a = race(100), b = structuredClone(a);
    Object.assign(a.players[1], { z: 107 }); Object.assign(b.players[1], { z: 107 });
    for (let frame = 0; frame < 120; frame++) { const input = idle(); input[0].special = true; stepMatch(a, input, FIXED_DT); ticks(b, 1); }
    expect(a.players[0].draft).toBe(0); expect(a.players[0].speed).toBe(RUN_SPEED);
    expect(a.players[0].z).toBe(b.players[0].z); expect(a.players[0].energy).toBe(100);
  });
  it('never announces a pass over a finished rival or a projected overtake beyond the finish, in either role', () => {
    for (const slot of [0, 1] as const) for (const finished of [false, true]) {
      const m = race(499.93), other: Slot = slot === 0 ? 1 : 0;
      Object.assign(m.players[slot], { x: -2, speed: 9.8, draft: 1 });
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
      Object.assign(m.players[slot], { x: -2, speed: 9.8, draft: 1 });
      Object.assign(m.players[other], { x: 2, z: z + .01, speed: RUN_SPEED });
      ticks(m, 1);
      const passes = m.events.filter(e => e.type === 'pass');
      expect(passes).toHaveLength(1); expect(passes[0].slot).toBe(slot);
      expect(passes[0].z).toBeGreaterThan(z + .01); expect(passes[0].z).toBeLessThan(COURSE_LENGTH);
      if (z > 499) {
        expect(m.players.every(p => p.raceStatus === 'finished')).toBe(true);
        expect(m.players[slot].finishTime).toBeLessThan(m.players[other].finishTime ?? -Infinity);
      } else expect(m.players[slot].z).toBeGreaterThan(m.players[other].z);
      ticks(m, 1); expect(m.events.filter(e => e.type === 'pass')).toHaveLength(1);
    }
  });
  it('lets a single-mistake shallow gap enter the rear-quarter trail and pass without body overlap', () => {
    for (const slot of [0, 1] as const) {
      const m = race(100), other: Slot = slot === 0 ? 1 : 0;
      Object.assign(m.players[slot], { x: -2.5, z: 100 }); Object.assign(m.players[other], { x: 0, z: 101 });
      let entered = false, passed = false;
      for (let frame = 0; frame < 240; frame++) {
        const p = m.players[slot], o = m.players[other], input = idle();
        input[slot].move = steer(-1.6, p.x); input[other].move = steer(0, o.x); stepMatch(m, input, FIXED_DT);
        entered ||= p.drafting;
        if (Math.abs(p.z - o.z) < RACE.bodyGap) expect(Math.abs(p.x - o.x)).toBeGreaterThanOrEqual(RACE.bodyWidth - 1e-9);
        if (p.z > o.z) { passed = true; break; }
      }
      expect(entered).toBe(true); expect(passed).toBe(true);
    }
  });
  it('requires steering around wagons and leaping over the full-width timber moment', () => {
    const wagon = race(234), leap = race(305), input = idle();
    wagon.players[0].x = -2; input[0].jump = true; ticks(wagon, 12, input);
    expect(wagon.players[0].hitObstacles).toContain(3);
    ticks(leap, 35, input); expect(leap.players[0].hitObstacles).not.toContain(4);
    const missed = race(308); ticks(missed, 15); expect(missed.players[0].hitObstacles).toContain(4);
    expect(new Set(OBSTACLES.map(o => o.z)).size).toBe(6);
  });
  it('settles an airborne finisher, preserves DNF progress and bounds a passive championship', () => {
    const m = race(499.95); Object.assign(m.players[0], { y: .8, vy: -1 }); m.players[1].z = 460;
    ticks(m, 1); expect(m.players[0].raceStatus).toBe('finished'); const finish = m.players[0].finishTime;
    ticks(m, 40); expect(m.players[0].y).toBe(0); expect(m.players[0].finishTime).toBe(finish);
    const dnf = race(100); dnf.raceTicks = RACE_DURATION * 60 - 1; ticks(dnf, 1);
    expect(dnf.phase).toBe('transition'); expect(dnf.players[0].raceStatus).toBe('dnf'); const progress = dnf.players[0].raceProgress;
    ticks(dnf, TRANSITION_DURATION * 60); expect(dnf.players[0].raceProgress).toBe(progress); expect(dnf.players[0].z).toBe(0);
    ticks(dnf, FIGHT_DURATION * 60); expect(dnf.phase).toBe('results'); const final = JSON.stringify(dnf); ticks(dnf, 60); expect(JSON.stringify(dnf)).toBe(final);
  });
});

describe('move, committed strike and evade', () => {
  it('shows the whole species windup before damage and holds direction through recovery', () => {
    for (const character of species) {
      const m = fight([character, 'lion']), input = idle(); input[0].attack = true;
      ticks(m, Math.floor(ATTACKS[character].windup * 60), input); expect(m.players[1].hp).toBe(100);
      ticks(m, 2, input); expect(m.players[1].hp).toBe(100 - ATTACKS[character].damage);
      expect(m.players[0].facing).toBe(1); expect(strikeTiming(m.players[0]).windup).toBe(ATTACKS[character].windup);
      expect(ATTACKS[character].windup).toBeGreaterThanOrEqual(.55);
    }
  });
  it('supports default-away evade, approach and recovery punish in all nine matchups and both roles', () => {
    for (const first of species) for (const second of species) for (const slot of [0, 1] as const) for (const reaction of [.40, .45, .50]) for (const gap of [1.75, 1.83]) {
      const r = punish(first, second, slot, reaction, gap), label = `${first}/${second}/${slot}/${reaction}/${gap}`;
      expect(r.match.players[r.defender].hp, label).toBe(100);
      expect(r.match.players[r.attacker].hp, label).toBe(100 - ATTACKS[r.match.players[r.defender].character].damage);
      expect(r.hitDuringRecovery, label).toBe(true);
      expect(r.match.players[r.defender].strikeWindup).toBe(COUNTER_WINDUP);
      expect(r.match.players[r.defender].strikeCounter).toBe(true);
    }
  });
  it('never grants a counter for an evade far outside the incoming threat', () => {
    const m = fight(['lion', 'unicorn']); m.players[0].x = -4; m.players[1].x = 4;
    const a = idle(); a[0].attack = true; ticks(m, 15, a); a[0].attack = false; a[1].jump = true; ticks(m, 30, a);
    expect(m.players[1].counterWindow).toBe(0); expect(m.events.some(e => e.type === 'evade-success')).toBe(false);
  });
  it('answers fastest-available repeated strikes with delayed evades and punishes across species, roles, gaps and walls', () => {
    for (const first of species) for (const second of species) for (const slot of [0, 1] as const)
      for (const reaction of [.40, .45]) for (const gap of [1.75, 1.83, 2.8]) for (const wall of [false, true]) {
        const r = repeatedPressure(first, second, slot, reaction, gap, wall), label = `${first}/${second}/${slot}/${reaction}/${gap}/${wall}`;
        expect(r.match.players[slot].hp, label).toBe(0); expect(r.match.players[r.defender].hp, label).toBeGreaterThan(0);
        expect(r.successes, label).toBeGreaterThanOrEqual(2);
      }
  });
  it('holding evade or the old guard button cannot create permanent defense', () => {
    for (const key of ['jump', 'guard'] as const) {
      const m = fight(['lion', 'unicorn']); let last = 0, evades = 0;
      for (let frame = 0; frame < 900 && m.phase === 'fight'; frame++) {
        const input = idle(), p = m.players[0], d = m.players[1]; input[1][key] = true;
        input[0].move = Math.sign(d.x - p.x); input[0].attack = frame % 108 === 0;
        stepMatch(m, input, FIXED_DT);
        for (const e of m.events.filter(e => e.id > last)) { if (e.slot === 1 && e.type === 'evade') evades++; last = e.id; }
      }
      expect(evades).toBe(1); expect(m.players[1].hp).toBeLessThan(50);
    }
  });
  it('maps legacy buttons to the same actions and prevents alias alternation from bypassing held-input edges', () => {
    const a = fight(), b = fight(), input = idle(), alias = idle(); input[0].attack = true; alias[0].special = true;
    ticks(a, 40, input); ticks(b, 40, alias); expect(a.players.map(p => p.hp)).toEqual(b.players.map(p => p.hp));
    expect(a.players[0].strikeId).toBe(b.players[0].strikeId);
    input[0].special = true; ticks(a, 120, input); expect(a.players[0].strikeId).toBe(1);
    const dodge = fight(); const held = idle(); held[0].guard = true; ticks(dodge, 1, held); held[0].jump = true; ticks(dodge, 150, held);
    expect(dodge.events.filter(e => e.type === 'evade')).toHaveLength(1); expect(dodge.players[0].y).toBe(0);
  });
  it('gives a missed strike full recovery and buffers only a late deliberate follow-up', () => {
    const m = fight(['wolf', 'lion']); m.players[0].x = -3; m.players[1].x = 3;
    const input = idle(); input[0].attack = true; ticks(m, 1, input); input[0].attack = false;
    const total = ATTACKS.wolf.windup + ATTACKS.wolf.active + ATTACKS.wolf.recovery;
    ticks(m, Math.floor((total - .1) * 60), input); expect(strikePhase(m.players[0])).toBe('recovery');
    input[0].attack = true; ticks(m, 12, input); expect(m.players[0].strikeId).toBe(2); expect(strikePhase(m.players[0])).toBe('windup');
    expect(m.players[1].hp).toBe(100);
  });
  it('creates breathing space at either wall and a protected actionable hit-recovery interval', () => {
    for (const slot of [0, 1] as const) {
      const m = fight(['lion', 'lion']), defender: Slot = slot === 0 ? 1 : 0, input = idle();
      m.players[defender].x = slot === 0 ? 4.4 : -4.4; m.players[slot].x = m.players[defender].x + (slot === 0 ? -1.75 : 1.75);
      input[slot].attack = true; ticks(m, 43, input);
      expect(Math.abs(m.players[0].x - m.players[1].x)).toBeGreaterThanOrEqual(2.8);
      ticks(m, 16); expect(m.players[defender].stun).toBe(0); expect(m.players[defender].invulnerable).toBeGreaterThan(0);
      expect(m.players.every(p => Math.abs(p.x) <= 4.4)).toBe(true);
    }
  });
  it('gathers simultaneous contacts before damage, including double knockout', () => {
    const m = fight(['lion', 'wolf']);
    m.players.forEach(p => { p.hp = ATTACKS[p.character === 'lion' ? 'wolf' : 'lion'].damage; p.action = 'attack'; p.actionTime = p.strikeWindup = ATTACKS[p.character].windup; });
    ticks(m, 1); expect(m.players.map(p => p.hp)).toEqual([0, 0]); expect(m.fightEnd).toBe('double-knockout'); expect(m.result?.winner).toBeNull();
  });
  it('has mirrored outcomes for every species pairing and both evade/punish roles', () => {
    for (const first of species) for (const second of species) {
      const a = punish(first, second, 0, .30, 1.8), b = punish(second, first, 1, .30, 1.8);
      expect(a.match.players.map(p => p.hp)).toEqual(b.match.players.map(p => p.hp).reverse());
      expect(a.firstHitTime).toBe(b.firstHitTime);
      expect(a.match.players[0].x).toBeCloseTo(-b.match.players[1].x, 9);
    }
  });
});

describe('fair CPU, replay and bounded state', () => {
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
