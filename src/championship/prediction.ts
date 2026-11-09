import { ATTACKS, QUICK_ATTACKS, COUNTER_WINDUP, DODGE, GUARD, POWER_RULES, FIGHT_BODY_GAP, FIGHT_BOUND, FIGHT_SPEED, RACE, neutralInput, type Input, type Match, type Racer, type Slot } from "./simulation";

/** Cosmetic limits, in milliseconds/metres. This module never calls stepMatch. */
export const PREDICTION_LIMITS = Object.freeze({
  horizonMs: 250,
  correctionMs: 100,
  maxStepMs: 50,
  maxLateralOffset: 0.65,
  maxStrikePreviewSeconds: 0.18,
});

type LocalAuthority = Pick<Racer,
  "character" | "x" | "y" | "hp" | "action" | "actionTime" | "stun" |
  "connected" | "raceStatus" | "facing" | "dodgeCooldown" | "strikeId" |
  "strikeWindup" | "counterWindow" | "guard" | "guardBroken" | "slow"
>;
type Authority = { tick: number; phase: Match["phase"]; hitPause: number; at: number; local: LocalAuthority; rivalX: number };
type Pose = { kind: "jump" | "evade" | "attack" | "guard" | "guard-release"; at: number; clockAt: number; elapsed: number; direction: number; baseStrikeId: number; windup: number; strikeKind: "quick" | "power"; counter: boolean };
type Motion = { x: number; at: number; error: number; remaining: number; settleAt: number | null };
const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));
const actionable = (phase: Match["phase"]) => phase === "race" || phase === "fight";
const interrupted = (p: LocalAuthority) => !p.connected || p.hp <= 0 || p.stun > 0 || ["hit", "stumble", "defeat"].includes(p.action);
const busy = (p: LocalAuthority) => ["attack", "special", "evade"].includes(p.action);
const clean = (input: Input): Input => ({
  move: Number.isFinite(input.move) ? clamp(input.move, -1, 1) : 0,
  jump: input.jump === true, attack: input.attack === true,
  special: input.special === true, guard: input.guard === true, cancelAttack: input.cancelAttack === true,
});

/**
 * Guest-only visual feedback. Pass world-space inputs, including every release.
 * observe() receives accepted canonical snapshots; sample() receives the existing
 * PresentationBuffer output. No callbacks, timers, network, replay queue or physics.
 */
export class GuestPrediction {
  private epoch: string | null = null;
  private authority: Authority | null = null;
  private previous = neutralInput();
  private input = neutralInput();
  private pose: Pose | null = null;
  private motion: Motion | null = null;
  private verticalCorrection: { from: number; at: number } | null = null;
  private now = -Infinity;
  private enabled = false;

  constructor(private readonly slot: Slot = 1) {
    if (slot !== 0 && slot !== 1) throw new RangeError("Prediction slot must be 0 or 1");
  }

  reset(epoch: string) {
    this.epoch = epoch;
    this.authority = null;
    this.cancel();
    this.now = -Infinity;
    this.enabled = true;
    // Keep the edge latch: a held button from an old match must first release.
  }

  disconnect() {
    this.enabled = false;
    this.authority = null;
    this.cancel();
  }

  private cancel() {
    this.input = neutralInput();
    this.pose = null;
    this.motion = null;
    this.verticalCorrection = null;
  }

  private acceptTime(now: number) {
    if (!Number.isFinite(now) || now < 0 || now < this.now) return false;
    this.now = now;
    return true;
  }

  /** False for a wrong epoch, duplicate/reordered tick or invalid local clock. */
  observe(epoch: string, match: Match, receivedAtMs: number): boolean {
    if (!this.enabled || epoch !== this.epoch || !Number.isSafeInteger(match.tick) || match.tick < 0 ||
      (this.authority && match.tick <= this.authority.tick) || !this.acceptTime(receivedAtMs)) return false;
    this.advance(receivedAtMs);
    const p = match.players[this.slot], previous = this.authority;
    const local: LocalAuthority = {
      character: p.character, x: p.x, y: p.y, hp: p.hp, action: p.action, actionTime: p.actionTime,
      stun: p.stun, connected: p.connected, raceStatus: p.raceStatus, facing: p.facing,
      dodgeCooldown: p.dodgeCooldown, strikeId: p.strikeId, strikeWindup: p.strikeWindup, counterWindow: p.counterWindow,
      guard: p.guard, guardBroken: p.guardBroken, slow: p.slow,
    };
    if (!Number.isFinite(local.x) || !Number.isFinite(local.y)) return false;
    this.authority = { tick: match.tick, phase: match.phase, hitPause: match.hitPause, at: receivedAtMs, local, rivalX: match.players[this.slot === 0 ? 1 : 0].x };
    const cut = previous && (previous.phase !== match.phase || previous.local.character !== local.character || local.hp < previous.local.hp);
    if (cut || !actionable(match.phase) || interrupted(local) || (match.phase === "race" && local.raceStatus !== "running")) {
      this.cancel();
      return true;
    }
    if (this.pose) {
      const expected = this.pose.kind;
      const acceptedStrike = expected === "attack" && local.strikeId > this.pose.baseStrikeId;
      // An accepted action already over by the time it arrives must not replay.
      if (acceptedStrike ||
        (expected === "evade" && local.dodgeCooldown > 0 && local.action !== "evade") ||
        (busy(local) && local.action !== expected) ||
        (expected === "guard" && (local.guardBroken || local.guard <= 0)) ||
        (expected === "guard-release" && local.action !== "guard") ||
        (expected === "jump" && local.action === "land")) this.endPose(receivedAtMs, true);
    }
    if (this.motion) {
      this.motion.error = this.motion.x - local.x;
      this.motion.remaining = this.motion.settleAt === null ? PREDICTION_LIMITS.correctionMs : Math.max(0, this.motion.settleAt - receivedAtMs);
    }
    return true;
  }

  /** Call on changes and/or each frame. Identical inputs do not refresh any edge. */
  updateInput(raw: Input, nowMs: number) {
    if (!this.acceptTime(nowMs)) return;
    const next = clean(raw), prior = this.previous;
    this.advance(nowMs);
    this.previous = next;
    // Releases are effective even while snapshots are stale or disconnected.
    if (next.move === 0 && this.input.move !== 0) {
      this.input.move = 0;
      this.settleMotion(nowMs);
    }
    if (!next.guard) {
      this.input.guard = false;
      if (this.pose?.kind === "guard") this.endPose(nowMs, true);
    }
    const a = this.authority;
    if (!this.enabled || !a || !actionable(a.phase) || interrupted(a.local) || nowMs - a.at > PREDICTION_LIMITS.horizonMs ||
      (a.phase === "race" && a.local.raceStatus !== "running")) return;
    // A phase cut consumes held input. Only a real direction change re-arms it.
    if (next.move !== prior.move) {
      this.input.move = next.move;
      if (next.move !== 0) this.startMotion(nowMs);
      else this.settleMotion(nowMs);
    }
    if (next.guard !== prior.guard) this.input.guard = next.guard;
    if (next.cancelAttack) {
      if (this.pose?.kind !== "guard") this.endPose(nowMs, true);
      return; // Consume all button edges without queuing another cosmetic action.
    }
    const leap = next.jump && !prior.jump;
    const evade = leap;
    const quick = next.attack && !prior.attack;
    const power = next.special && !prior.special;
    const raiseGuard = next.guard && !prior.guard;
    const releaseGuard = !next.guard && prior.guard && a.local.action === "guard";
    if (a.hitPause > 0) return; // Authority buffers intent; visual prediction never advances the pause.
    if (this.pose && ["guard", "guard-release"].includes(this.pose.kind) && (evade || quick || power)) this.endPose(nowMs, true);
    if (this.pose || busy(a.local)) return; // No deferred visual attack queue.
    let kind: Pose["kind"] | null = null;
    if (a.phase === "race" && leap && a.local.y <= 0.001) kind = "jump";
    if (a.phase === "fight") {
      if (evade && a.local.dodgeCooldown <= 0) kind = "evade";
      else if (power || quick) kind = "attack";
      else if (raiseGuard && !a.local.guardBroken && a.local.guard > 0) kind = "guard";
      else if (releaseGuard) kind = "guard-release";
    }
    if (!kind) return;
    const direction = Math.abs(next.move) > 0.2 ? Math.sign(next.move) : Math.sign(a.local.x - a.rivalX) || -a.local.facing;
    const strikeKind = power ? "power" : "quick";
    const counter = strikeKind === "quick" && a.local.counterWindow > 0;
    const windup = counter ? COUNTER_WINDUP : (power ? ATTACKS : QUICK_ATTACKS)[a.local.character].windup;
    this.pose = { kind, at: nowMs, clockAt: nowMs, elapsed: 0, direction, baseStrikeId: a.local.strikeId, windup, strikeKind, counter };
    this.verticalCorrection = null;
    if (kind === "evade") this.startMotion(nowMs);
  }

  private startMotion(now: number) {
    if (!this.authority) return;
    this.motion ??= { x: this.authority.local.x, at: now, error: 0, remaining: 0, settleAt: null };
    this.motion.settleAt = null;
  }

  private settleMotion(now: number) {
    if (!this.motion || !this.authority) return;
    this.motion.error = this.motion.x - this.authority.local.x;
    this.motion.remaining = PREDICTION_LIMITS.correctionMs;
    this.motion.settleAt = now + PREDICTION_LIMITS.correctionMs;
  }

  private endPose(now: number, immediately = false) {
    if (immediately) this.verticalCorrection = null;
    if (this.pose?.kind === "jump" && !immediately) {
      const t = Math.min(PREDICTION_LIMITS.horizonMs, now - this.pose.at) / 1000;
      this.verticalCorrection = { from: Math.max(0, RACE.leapVelocity * t - RACE.gravity * t * t / 2), at: this.pose.at + PREDICTION_LIMITS.horizonMs };
    }
    const wasEvade = this.pose?.kind === "evade";
    this.pose = null;
    if (wasEvade && this.input.move === 0) this.settleMotion(now);
  }

  private advance(now: number) {
    const a = this.authority;
    if (!a) return;
    if (this.pose) {
      if (a.hitPause <= 0) this.pose.elapsed += clamp(now - this.pose.clockAt, 0, PREDICTION_LIMITS.maxStepMs);
      this.pose.clockAt = now;
    }
    if (this.pose && now - this.pose.at >= PREDICTION_LIMITS.horizonMs) this.endPose(now);
    const m = this.motion;
    if (m) {
      const until = Math.min(now, a.at + PREDICTION_LIMITS.horizonMs);
      const elapsed = a.hitPause > 0 ? 0 : clamp(until - m.at, 0, PREDICTION_LIMITS.maxStepMs);
      let velocity = this.input.move * (a.phase === "race" ? RACE.lateralSpeed : FIGHT_SPEED[a.local.character]);
      if (a.phase === "fight") {
        if ((this.pose?.kind === "guard" || this.input.guard) && !a.local.guardBroken && a.local.guard > 0) velocity *= GUARD.moveFactor;
        if (a.local.slow > 0) velocity *= POWER_RULES.wolf.slowFactor;
      }
      if (this.pose?.kind === "evade") velocity = this.pose.direction * DODGE[a.local.character].speed;
      else if (this.pose?.kind === "attack" || busy(a.local)) velocity = 0;
      m.x += velocity * elapsed / 1000;
      const portion = m.remaining > 0 ? Math.min(1, elapsed / m.remaining) : 1;
      m.x -= m.error * portion;
      m.error *= 1 - portion;
      m.remaining = Math.max(0, m.remaining - elapsed);
      m.at = now;
      m.x = clamp(m.x, a.local.x - PREDICTION_LIMITS.maxLateralOffset, a.local.x + PREDICTION_LIMITS.maxLateralOffset);
      const edge = a.phase === "race" ? 4.3 : FIGHT_BOUND;
      m.x = clamp(m.x, -edge, edge);
      // Presentation must not visually cross a grounded rival before authority.
      if (a.phase === "fight" && Math.abs(a.local.x - a.rivalX) >= FIGHT_BODY_GAP) {
        m.x = a.local.x < a.rivalX ? Math.min(m.x, a.rivalX - FIGHT_BODY_GAP) : Math.max(m.x, a.rivalX + FIGHT_BODY_GAP);
      }
      if (m.settleAt !== null && now >= m.settleAt) this.motion = null;
      if (now - a.at >= PREDICTION_LIMITS.horizonMs + PREDICTION_LIMITS.correctionMs) this.motion = null;
    }
    if (this.verticalCorrection && now >= this.verticalCorrection.at + PREDICTION_LIMITS.correctionMs) this.verticalCorrection = null;
  }

  /** Read-only render copy. Canonical fields and the rival are never predicted. */
  sample(presented: Match, nowMs: number): Match {
    if (!this.acceptTime(nowMs) || !this.enabled || !this.authority) return presented;
    this.advance(nowMs);
    const a = this.authority;
    if (presented.tick !== a.tick || presented.phase !== a.phase || !actionable(a.phase) || interrupted(a.local) ||
      (a.phase === "race" && a.local.raceStatus !== "running")) return presented;
    if (a.hitPause > 0 || presented.hitPause > 0) return presented;
    const source = presented.players[this.slot];
    // The local player uses newest authoritative coordinates; rivals retain the
    // existing interpolation. This avoids returning to a delayed local pose.
    const local = { ...source, x: a.local.x, y: a.local.y };
    if (this.motion) {
      const staleFade = clamp(1 - (nowMs - a.at - PREDICTION_LIMITS.horizonMs) / PREDICTION_LIMITS.correctionMs, 0, 1);
      local.x += (this.motion.x - a.local.x) * staleFade;
    }
    if (this.verticalCorrection) {
      const fade = clamp(1 - (nowMs - this.verticalCorrection.at) / PREDICTION_LIMITS.correctionMs, 0, 1);
      local.y += (this.verticalCorrection.from - local.y) * fade;
    }
    if (this.pose && nowMs - a.at <= PREDICTION_LIMITS.horizonMs) {
      const age = this.pose.elapsed / 1000;
      local.action = this.pose.kind === "guard-release" ? (this.input.move ? "fight_move" : "fight_idle") : this.pose.kind;
      if (this.pose.kind === "attack") {
        local.strikeKind = this.pose.strikeKind;
        local.strikeWindup = this.pose.windup;
        local.strikeCounter = this.pose.counter;
        local.comboStep = 0; // Never invent a linked hit from an unconfirmed press.
        // A preview cannot reach the active/contact part of a strike.
        const preview = Math.min(age, this.pose.windup * 0.45, PREDICTION_LIMITS.maxStrikePreviewSeconds);
        local.actionTime = source.action === "attack" ? Math.max(source.actionTime, preview) : preview;
      } else {
        local.actionTime = source.action === this.pose.kind ? Math.max(source.actionTime, age) : age;
        if (this.pose.kind === "jump") local.y = Math.max(local.y, RACE.leapVelocity * age - RACE.gravity * age * age / 2);
      }
    }
    if (local.x === source.x && local.y === source.y && local.action === source.action && local.actionTime === source.actionTime &&
      local.strikeKind === source.strikeKind && local.strikeWindup === source.strikeWindup && local.strikeCounter === source.strikeCounter && local.comboStep === source.comboStep) return presented;
    const players: Match["players"] = [...presented.players];
    players[this.slot] = local;
    return { ...presented, players };
  }
}
