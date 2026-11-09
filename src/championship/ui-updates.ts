import { scoreMatch, strikePhase, type GameEvent, type Match, type Racer } from './simulation';

function playerView(p: Racer) {
  return {
    character: p.character, x: p.x, z: p.z, speed: p.speed, hp: p.hp,
    guard: p.guard, guardBroken: p.guardBroken, action: p.action,
    strikeKind: p.strikeKind, strikePhase: strikePhase(p), comboStep: p.comboStep,
    comboWindow: p.comboWindow, finishTime: p.finishTime, raceStatus: p.raceStatus,
    stun: p.stun, draft: p.draft, drafting: p.drafting, slow: p.slow,
    counterWindow: p.counterWindow, attackConnected: p.attackConnected,
  };
}
/** Independent UI values; simulation/AI input buffers and event history never enter React state. */
export function hudSnapshot(m: Match) {
  let contact: GameEvent | undefined;
  if (m.phase === 'fight') for (let i = m.events.length - 1; i >= 0; i--) {
    if (['hit', 'block', 'guard-break', 'ward-block'].includes(m.events[i].type)) { contact = m.events[i]; break; }
  }
  return {
    format: m.format, phase: m.phase, tick: m.tick, phaseTime: m.phaseTime,
    raceTime: m.raceTime, fightTime: m.fightTime, hitPause: m.hitPause,
    players: [playerView(m.players[0]), playerView(m.players[1])] as const,
    latestContact: contact ? { type: contact.type, slot: contact.slot } : undefined,
    racePoints: ['transition', 'fight', 'results'].includes(m.phase) ? scoreMatch(m).race : null,
    result: m.result ? { ...m.result, race: [...m.result.race], fight: [...m.result.fight], total: [...m.result.total] } : null,
  };
}
export type HudSnapshot = ReturnType<typeof hudSnapshot>;

export class UiUpdates {
  private lastHud = -Infinity;
  private lastTick = -1;
  private lastPhase: Match['phase'] | null = null;
  private lastMatch: Match | null = null;
  private lastReport = -Infinity;
  hudDue(now: number, m: Match) {
    const changedPhase = m !== this.lastMatch || m.phase !== this.lastPhase;
    if (!changedPhase && (m.tick === this.lastTick || now - this.lastHud <= 50)) return false;
    this.lastHud = now; this.lastTick = m.tick; this.lastPhase = m.phase; this.lastMatch = m;
    return true;
  }
  reportDue(now: number, visible: boolean) {
    if (!visible) { this.lastReport = -Infinity; return false; }
    if (now - this.lastReport < 1000) return false;
    this.lastReport = now;
    return true;
  }
}
