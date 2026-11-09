export const CPU_DIFFICULTIES = ['easy', 'normal', 'hard'] as const;
export type CpuDifficulty = typeof CPU_DIFFICULTIES[number];
export const DEFAULT_CPU_DIFFICULTY: CpuDifficulty = 'easy';
export const CPU_DIFFICULTY_STORAGE_KEY = 'animal-racers.3d-cpu-difficulty';

export const CPU_DIFFICULTY_SETTINGS = {
  easy: { label: 'やさしい', description: 'ゆっくりした あいて。はじめてなら これ。',
    racePace: .94, noticeObstacle: .55, decisionTicks: 30, decisionJitter: 12,
    attackTicks: 150, attackJitter: 60, openingSeconds: 3,
    comboChance: 0, evadeChance: .12, threatGuardChance: .15, idleGuardChance: .02, powerChance: .15 },
  normal: { label: 'ふつう', description: 'なれてきたら ためしてみよう。',
    racePace: .98, noticeObstacle: .8, decisionTicks: 18, decisionJitter: 6,
    attackTicks: 120, attackJitter: 36, openingSeconds: 2.4,
    comboChance: .3, evadeChance: .4, threatGuardChance: .45, idleGuardChance: .12, powerChance: .25 },
  hard: { label: 'つよい', description: 'はやくて つよい あいて。',
    racePace: 1, noticeObstacle: 1, decisionTicks: 12, decisionJitter: 0,
    attackTicks: 96, attackJitter: 36, openingSeconds: 1.8,
    comboChance: .65, evadeChance: .75, threatGuardChance: .75, idleGuardChance: .32, powerChance: .35 },
} as const;

export function parseCpuDifficulty(value: unknown): CpuDifficulty {
  return CPU_DIFFICULTIES.find(mode => mode === value) ?? DEFAULT_CPU_DIFFICULTY;
}
export function loadCpuDifficulty(): CpuDifficulty {
  try { return parseCpuDifficulty(window.localStorage.getItem(CPU_DIFFICULTY_STORAGE_KEY)); }
  catch { return DEFAULT_CPU_DIFFICULTY; }
}
export function saveCpuDifficulty(value: CpuDifficulty): void {
  try { window.localStorage.setItem(CPU_DIFFICULTY_STORAGE_KEY, value); }
  catch { /* Keep the in-memory choice for this session and its rematches. */ }
}
