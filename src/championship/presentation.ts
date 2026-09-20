import type { Match, Racer } from "./simulation";

/** Read-only presentation: never advances combat, phase, health, scores or inputs. */
export class PresentationBuffer {
  private frames: { state: Match; arrival: number }[] = [];
  private cursor: { phase: Match["phase"]; tick: number } | null = null;
  private actionClocks: ({ phase: Match["phase"]; action: Racer["action"]; start: number; time: number } | null)[] = [null, null];

  push(state: Match, arrival: number) {
    const last = this.frames.at(-1);
    if (last && state.tick <= last.state.tick) return;
    this.frames.push({ state: structuredClone(state), arrival });
    if (this.frames.length > 8) this.frames.shift();
  }

  clear() {
    this.frames = [];
    this.cursor = null;
    this.actionClocks = [null, null];
  }

  sample(now: number, delayMs = 65): Match | null {
    const latest = this.frames.at(-1);
    if (!latest) return null;
    const sinceArrival = now - latest.arrival;
    const desiredTick = latest.state.tick
      + Math.min(100, Math.max(0, sinceArrival - delayMs)) * 0.06
      - Math.max(0, delayMs - sinceArrival) * 0.06;
    // Jitter can move the arrival-based estimate backward. Hold the playout
    // cursor until authority catches up instead of replaying earlier motion.
    // A phase cut starts at its received pose, never at the old world's clock.
    const phaseChanged = this.cursor && this.cursor.phase !== latest.state.phase;
    const targetTick = Math.max(
      desiredTick,
      this.frames[0].state.tick,
      phaseChanged ? latest.state.tick : (this.cursor?.tick ?? -Infinity),
    );
    this.cursor = { phase: latest.state.phase, tick: targetTick };
    let first = this.frames[0], second = latest;
    for (let i = 1; i < this.frames.length; i++) {
      if (this.frames[i].state.tick >= targetTick) {
        first = this.frames[i - 1];
        second = this.frames[i];
        break;
      }
      first = this.frames[i];
    }
    const result = structuredClone(latest.state);
    // Phase and result always come from received authority. Never blend a race into an arena.
    const canBlend = first.state.phase === latest.state.phase && second.state.phase === latest.state.phase && result.phase !== "results";
    // Returning a phase-cut pose also advances the cursor to that pose.
    if (!canBlend) this.cursor.tick = Math.max(this.cursor.tick, latest.state.tick);
    const span = second.state.tick - first.state.tick;
    const t = span > 0 ? Math.min(1, Math.max(0, (targetTick - first.state.tick) / span)) : 1;
    for (const slot of [0, 1] as const) {
      const a = first.state.players[slot], b = second.state.players[slot], p = result.players[slot];
      if (canBlend) for (const key of ["x", "y", "z", "speed"] as const) p[key] = a[key] + (b[key] - a[key]) * t;
      // Positions may be delayed, but a newly received hit/attack must never use
      // the clock from a different action (or an earlier repeat of the same one).
      const live = latest.state.players[slot];
      const sameActionInstance = (player: Racer, tick: number) =>
        player.action === live.action
        && Math.abs((latest.state.tick - tick) / 60 - (live.actionTime - player.actionTime)) < 1 / 120;
      if (canBlend && sameActionInstance(a, first.state.tick) && sameActionInstance(b, second.state.tick)) {
        p.actionTime = a.actionTime + (b.actionTime - a.actionTime) * t;
      }
      // Smooth in-place action progression only; never extrapolate collision/HP/phase state.
      if (canBlend && first === second) p.actionTime += Math.min(0.10, Math.max(0, (sinceArrival - delayMs) / 1000));
      const start = latest.state.tick - live.actionTime * 60;
      const prior = this.actionClocks[slot];
      if (prior && prior.phase === result.phase && prior.action === live.action && Math.abs(prior.start - start) < .5) {
        p.actionTime = Math.max(p.actionTime, prior.time);
      }
      this.actionClocks[slot] = { phase: result.phase, action: live.action, start, time: p.actionTime };
    }
    return result;
  }
}
