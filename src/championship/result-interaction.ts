/** A ceremony requires a quiet pause and a fresh, complete intentional gesture. */
export class ResultInteraction {
  private held = new Set<string>();
  private eligible = new Set<string>();
  private gestures = new Map<string, string>();
  private enteredAt: number | null = null;
  private lastActivity = 0;
  enter(now: number) { this.enteredAt = now; this.lastActivity = now; this.eligible.clear(); this.gestures.clear(); }
  leave() { this.enteredAt = null; this.eligible.clear(); this.gestures.clear(); }
  ready(now: number) {
    return this.enteredAt !== null && now - this.enteredAt >= 4000 &&
      this.held.size === 0 && now - this.lastActivity >= 600;
  }
  status(now: number): "inactive" | "ceremony" | "release" | "pause" | "ready" {
    if (this.enteredAt === null) return "inactive";
    if (this.remainingSeconds(now) > 0) return "ceremony";
    // A valid press remains visually enabled until its release. Updating the
    // notice mid-gesture can move a small-screen button away from the finger.
    if (this.gestures.size > 0) return "ready";
    if (this.held.size > 0) return "release";
    return now - this.lastActivity < 600 ? "pause" : "ready";
  }
  remainingSeconds(now: number) {
    return this.enteredAt === null ? 0 : Math.max(0, Math.ceil((4000 - (now - this.enteredAt)) / 1000));
  }
  down(source: string, now: number) {
    if (this.held.has(source)) return; // Key repeat never creates a fresh gesture.
    this.eligible.delete(source); this.gestures.delete(source);
    if (this.ready(now)) this.eligible.add(source);
    this.held.add(source); this.lastActivity = now;
  }
  up(source: string, now: number) { this.held.delete(source); this.lastActivity = now; }
  cancel(source: string, now: number) { this.up(source, now); this.eligible.delete(source); this.gestures.delete(source); }
  clear(now: number) { this.held.clear(); this.eligible.clear(); this.gestures.clear(); this.lastActivity = now; }
  start(source: string, target: string) {
    if (this.eligible.has(source) && this.held.has(source)) this.gestures.set(source, target);
  }
  finish(source: string, target: string, inside: boolean) {
    const allowed = inside && this.gestures.get(source) === target && !this.held.has(source);
    this.eligible.delete(source); this.gestures.delete(source);
    return allowed;
  }
}

/** Keep ceremony bookkeeping aligned with game controls when the browser interrupts input. */
export function bindResultInteraction(gate: ResultInteraction, win: Window, doc: Document) {
  const down = (e: PointerEvent) => gate.down(`p${e.pointerId}`, performance.now());
  const up = (e: PointerEvent) => gate.up(`p${e.pointerId}`, performance.now());
  const cancel = (e: PointerEvent) => gate.cancel(`p${e.pointerId}`, performance.now());
  const kd = (e: KeyboardEvent) => gate.down(`k${e.key}`, performance.now());
  const ku = (e: KeyboardEvent) => gate.up(`k${e.key}`, performance.now());
  const clear = () => gate.clear(performance.now());
  win.addEventListener("pointerdown", down, true);
  win.addEventListener("pointerup", up, true);
  win.addEventListener("pointercancel", cancel, true);
  // A captured control can disappear at the fight/results boundary. A missing up
  // must not leave that pointer held forever, nor turn cancellation into a click.
  win.addEventListener("lostpointercapture", cancel, true);
  win.addEventListener("keydown", kd, true);
  win.addEventListener("keyup", ku, true);
  win.addEventListener("blur", clear);
  doc.addEventListener("visibilitychange", clear);
  return () => {
    win.removeEventListener("pointerdown", down, true);
    win.removeEventListener("pointerup", up, true);
    win.removeEventListener("pointercancel", cancel, true);
    win.removeEventListener("lostpointercapture", cancel, true);
    win.removeEventListener("keydown", kd, true);
    win.removeEventListener("keyup", ku, true);
    win.removeEventListener("blur", clear);
    doc.removeEventListener("visibilitychange", clear);
  };
}
