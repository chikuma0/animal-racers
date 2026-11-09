import { describe, it, expect, vi, afterEach } from 'vitest';
import { writeFileSync } from 'node:fs';
import { CPU_DIFFICULTIES, CPU_DIFFICULTY_STORAGE_KEY, CPU_DIFFICULTY_SETTINGS, parseCpuDifficulty, loadCpuDifficulty, saveCpuDifficulty, type CpuDifficulty } from './difficulty';
import { createMatch, createDuelMatch, cpuInput, stepMatch, neutralInput, FIXED_DT, type CharacterId, type Match, type Input } from './simulation';
import { cpuInput as originalCpu } from './__fixtures__/cpu-preview-ecb5169';

const species: CharacterId[] = ['lion', 'wolf', 'unicorn'];
function noviceInput(match: Match): Input {
  const input = neutralInput(), player = match.players[0], rival = match.players[1];
  if (match.phase === 'race') {
    // Keep a loose center lane and miss every jump: simple, reproducible novice controls.
    input.move = Math.max(-1, Math.min(1, -player.x * .5));
  } else if (match.phase === 'fight') {
    input.move = Math.abs(rival.x - player.x) > 1.8 ? Math.sign(rival.x - player.x) * .7 : 0;
    // A single quick strike every 1.2 seconds; no combos, guards, evades or powers.
    input.attack = match.fightTicks % 72 === 0;
  }
  return input;
}
function play(mode: CpuDifficulty, characters: [CharacterId, CharacterId], seed: number, duel = false) {
  const match = (duel ? createDuelMatch : createMatch)(characters, seed);
  match.soloCpu = { slot: 1, difficulty: mode };
  for (let frame = 0; frame < 10000 && match.phase !== 'results'; frame++) {
    stepMatch(match, [noviceInput(match), cpuInput(match, 1)], FIXED_DT);
  }
  expect(match.phase).toBe('results');
  if (!duel) {
    expect(match.players.every(player => player.raceStatus === 'finished' && player.finishTime !== null && Number.isFinite(player.finishTime))).toBe(true);
    expect(match.raceTime).toBeLessThan(95);
  }
  return match;
}

afterEach(() => vi.unstubAllGlobals());

describe('CPU difficulty preferences', () => {
  it('uses Easy for absent or invalid settings', () => {
    for (const value of [undefined, null, '', 'HARD', 'extreme', {}, '__proto__']) expect(parseCpuDifficulty(value)).toBe('easy');
    for (const mode of CPU_DIFFICULTIES) expect(parseCpuDifficulty(mode)).toBe(mode);
  });
  it('roundtrips every selection across a fresh read and tolerates blocked storage', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('window', { localStorage: { getItem: (key: string) => values.get(key), setItem: (key: string, value: string) => values.set(key, value) } });
    expect(loadCpuDifficulty()).toBe('easy');
    for (const mode of CPU_DIFFICULTIES) { saveCpuDifficulty(mode); expect(loadCpuDifficulty()).toBe(mode); }
    values.set(CPU_DIFFICULTY_STORAGE_KEY, 'broken'); expect(loadCpuDifficulty()).toBe('easy');
    vi.stubGlobal('window', { get localStorage() { throw new Error('blocked'); } });
    expect(loadCpuDifficulty()).toBe('easy'); expect(() => saveCpuDifficulty('normal')).not.toThrow();
    vi.stubGlobal('window', undefined); expect(loadCpuDifficulty()).toBe('easy');
  });
});

describe('deterministic solo difficulty', () => {
  it('preserves original Hard decisions and resulting authority across all pairings', () => {
    for (const first of species) for (const second of species) {
      const match = createMatch([first, second], 6827), old = structuredClone(match);
      for (let frame = 0; frame < 10000 && match.phase !== 'results'; frame++) {
        const next: [Input, Input] = [cpuInput(match, 0), cpuInput(match, 1)];
        const previous: [Input, Input] = [originalCpu(old, 0), originalCpu(old, 1)];
        stepMatch(match, next, FIXED_DT); stepMatch(old, previous, FIXED_DT);
      }
      expect(match).toEqual(old); expect(match.phase).toBe('results');
    }
  });
  it('keeps difficulty and CPU decisions through JSON replay in both formats', () => {
    for (const difficulty of CPU_DIFFICULTIES) for (const duel of [false, true]) {
      const match = (duel ? createDuelMatch : createMatch)(['unicorn', 'wolf'], 47);
      match.soloCpu = { slot: 1, difficulty };
      for (let frame = 0; frame < 350; frame++) stepMatch(match, [noviceInput(match), cpuInput(match, 1)], FIXED_DT);
      const copy: Match = JSON.parse(JSON.stringify(match));
      for (let frame = 0; frame < 9000 && match.phase !== 'results'; frame++) {
        stepMatch(match, [noviceInput(match), cpuInput(match, 1)], FIXED_DT);
        stepMatch(copy, [noviceInput(copy), cpuInput(copy, 1)], FIXED_DT);
      }
      expect(copy).toEqual(match); expect(match.phase).toBe('results');
    }
  });
  it('keeps shared human race physics and every online match free of CPU settings', () => {
    const online = createMatch(['lion', 'wolf']), solo = structuredClone(online);
    solo.soloCpu = { slot: 1, difficulty: 'easy' };
    expect(online.soloCpu).toBeUndefined();
    for (const match of [online, solo]) {
      match.phase = 'race'; match.players[0].x = -3; match.players[1].x = 3;
    }
    for (let frame = 0; frame < 120; frame++) {
      stepMatch(online, [neutralInput(), neutralInput()], FIXED_DT);
      stepMatch(solo, [neutralInput(), neutralInput()], FIXED_DT);
    }
    expect(solo.players[0]).toEqual(online.players[0]);
    expect(solo.players[1].z).toBeLessThan(online.players[1].z);
  });
  it('makes Easy single strikes and respects its minimum attack interval', () => {
    for (const character of species) {
      const match = createDuelMatch(['lion', character], 47); match.soloCpu = { slot: 1, difficulty: 'easy' };
      let previousStrike = 0, lastTick = -Infinity;
      for (let frame = 0; frame < 4000 && match.phase !== 'results'; frame++) {
        stepMatch(match, [neutralInput(), cpuInput(match, 1)], FIXED_DT);
        const cpu = match.players[1]; expect(cpu.comboStep).toBe(0);
        if (cpu.strikeId > previousStrike) {
          expect(match.tick - lastTick).toBeGreaterThanOrEqual(CPU_DIFFICULTY_SETTINGS.easy.attackTicks);
          lastTick = match.tick; previousStrike = cpu.strikeId;
        }
      }
      expect(previousStrike).toBeGreaterThan(0);
    }
  });
  it('does not reroll a missed incoming strike on a later decision', () => {
    let missed = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const match = createDuelMatch(['lion', 'wolf'], seed); match.phase = 'fight'; match.soloCpu = { slot: 1, difficulty: 'easy' };
      const [human, cpu] = match.players; human.x = 0; cpu.x = 1.8;
      human.action = 'attack'; human.actionTime = .2; human.strikeKind = 'quick'; human.strikeWindup = .3; human.strikeId = 9;
      const first = cpuInput(match, 1);
      if (!first.guard) {
        missed++;
        match.tick = cpu.ai.nextTick;
        expect(cpuInput(match, 1).guard).toBe(false);
      }
    }
    expect(missed).toBeGreaterThan(10); expect(missed).toBeLessThan(30);
  });
});

describe('fixed-control beginner balance', () => {
  it('makes Easy winnable for every character and records tier differences', () => {
    const results = CPU_DIFFICULTIES.map(difficulty => {
      const seeds = [1, 7, 47, 2026, 6827];
      const runs = species.flatMap(character => species.map(rival => {
        const matches = seeds.map(seed => play(difficulty, [character, rival], seed));
        const duels = seeds.map(seed => play(difficulty, [character, rival], seed, true));
        return { character, rival, trials: seeds.length, championshipWins: matches.filter(m => m.result?.winner === 0).length, duelWins: duels.filter(m => m.result?.winner === 0).length,
          raceWins: matches.filter(m => m.players[0].finishTime! < m.players[1].finishTime!).length,
          humanRace: matches.reduce((sum, m) => sum + m.players[0].finishTime!, 0) / matches.length,
          cpuRace: matches.reduce((sum, m) => sum + m.players[1].finishTime!, 0) / matches.length,
          humanHp: duels.reduce((sum, m) => sum + m.players[0].hp, 0) / duels.length,
          cpuHp: duels.reduce((sum, m) => sum + m.players[1].hp, 0) / duels.length };
      }));
      return { difficulty, runs };
    });
    if (process.env.CPU_BALANCE_REPORT) writeFileSync(process.env.CPU_BALANCE_REPORT, JSON.stringify(results, null, 2));
    for (const run of results[0].runs) {
      expect(run.championshipWins).toBeGreaterThanOrEqual(3);
      expect(run.duelWins).toBeGreaterThanOrEqual(3);
      expect(run.raceWins).toBeGreaterThanOrEqual(3);
    }
    const hp = results.map(row => row.runs.reduce((sum, run) => sum + run.humanHp - run.cpuHp, 0));
    expect(hp[0]).toBeGreaterThan(hp[1]); expect(hp[1]).toBeGreaterThan(hp[2]);
  }, 15000);
});
