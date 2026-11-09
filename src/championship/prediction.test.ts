import { describe, expect, it } from "vitest";
import { GuestPrediction, PREDICTION_LIMITS } from "./prediction";
import { ATTACKS, QUICK_ATTACKS, COUNTER_WINDUP, GUARD, FIGHT_BODY_GAP, createMatch, neutralInput, type Input, type Match } from "./simulation";

const input = (patch: Partial<Input> = {}): Input => ({ ...neutralInput(), ...patch });
function fixture(phase: Match["phase"] = "fight") {
  const match = createMatch(["lion", "wolf"]);
  match.phase = phase; match.tick = 120;
  match.players[0].x = -1.75; match.players[1].x = 1.75;
  for (const player of match.players) player.action = phase === "race" ? "run" : "fight_idle";
  const p = new GuestPrediction(); p.reset("match-a"); p.observe("match-a", match, 0);
  return { p, match };
}
function next(match: Match, ticks = 6) { const n = structuredClone(match); n.tick += ticks; return n; }
function unchangedGameplay(before: Match, rendered: Match, slot = 1) {
  const copy = structuredClone(rendered);
  for (const field of ["x", "y", "action", "actionTime", "strikeKind", "strikeWindup", "strikeCounter", "comboStep"] as const) {
    // Render-only pose metadata is copied; health/resources/contact/history are not.
    Object.assign(copy.players[slot], { [field]: before.players[slot][field] });
  }
  expect(copy).toEqual(before);
}

describe("bounded guest visual prediction", () => {
  it("shows strike windup on the first sample without inventing damage, hit events or resources", () => {
    const { p, match } = fixture();
    const before = structuredClone(match);
    p.updateInput(input({ attack: true }), 5);
    const view = p.sample(match, 5);
    expect(view.players[1].action).toBe("attack");
    expect(view.players[1].actionTime).toBe(0);
    expect(view.players[0]).toBe(match.players[0]);
    expect(view.events).toBe(match.events);
    unchangedGameplay(match, view);
    expect(match).toEqual(before);
    expect(p.sample(match, 200).players[1].actionTime).toBeLessThan(QUICK_ATTACKS.wolf.windup);
  });

  it("previews a counter without extending into its shorter active window", () => {
    const { p, match } = fixture(); const fresh = next(match); fresh.players[1].counterWindow = 0.8;
    p.observe("match-a", fresh, 1); p.updateInput(input({ attack: true }), 2);
    const view = p.sample(fresh, 200);
    expect(view.players[1].actionTime).toBeLessThan(COUNTER_WINDUP);
    unchangedGameplay(fresh, view);
  });

  it("responds to steering and leap before any authority packet arrives", () => {
    const { p, match } = fixture("race");
    p.updateInput(input({ move: -1, jump: true }), 1);
    const view = p.sample(match, 17);
    expect(view.players[1].x).toBeLessThan(match.players[1].x);
    expect(view.players[1].y).toBeGreaterThan(0);
    expect(view.players[1].action).toBe("jump");
    expect(view.players[1].z).toBe(match.players[1].z);
    unchangedGameplay(match, view);
  });

  it("shows a grounded evade and never predicts invulnerability or crosses a rival", () => {
    const { p, match } = fixture();
    p.updateInput(input({ jump: true, move: -1 }), 1);
    let view = match;
    for (let at = 17; at <= 241; at += 16) view = p.sample(match, at);
    expect(view.players[1].action).toBe("evade");
    expect(view.players[1].y).toBe(0);
    expect(view.players[1].x).toBeGreaterThanOrEqual(match.players[0].x + FIGHT_BODY_GAP);
    expect(view.players[1].invulnerable).toBe(0);
    expect(view.players[1].dodgeCooldown).toBe(0);
    unchangedGameplay(match, view);
  });

  it("does not preview an evade whose authoritative cooldown is active", () => {
    const { p, match } = fixture(); const fresh = next(match); fresh.players[1].dodgeCooldown = 0.5;
    p.observe("match-a", fresh, 1); p.updateInput(input({ jump: true }), 2);
    expect(p.sample(fresh, 17).players[1].action).toBe("fight_idle");
  });

  it("keeps a short tap but never renews or repeats it from stable held samples", () => {
    const { p, match } = fixture();
    p.updateInput(input({ attack: true }), 1); p.updateInput(input(), 2);
    expect(p.sample(match, 17).players[1].action).toBe("attack");
    for (let at = 20; at <= 400; at += 10) { p.updateInput(input(), at); p.sample(match, at); }
    expect(p.sample(match, 401).players[1].action).toBe("fight_idle");
    const fresh = next(match); p.observe("match-a", fresh, 410);
    p.updateInput(input({ attack: true }), 411);
    for (let at = 420; at <= 680; at += 10) p.updateInput(input({ attack: true }), at);
    expect(p.sample(fresh, 680).players[1].action).toBe("fight_idle");
  });

  it("consumes busy-period presses instead of queueing a stale second strike", () => {
    const { p, match } = fixture();
    p.updateInput(input({ attack: true }), 1); p.updateInput(input(), 2);
    p.updateInput(input({ attack: true }), 30); p.updateInput(input(), 31);
    const fresh = next(match); p.observe("match-a", fresh, 220);
    expect(p.sample(fresh, 252).players[1].action).toBe("fight_idle");
    p.updateInput(input(), 253);
    expect(p.sample(fresh, 300).players[1].action).toBe("fight_idle");
    p.updateInput(input({ attack: true }), 301);
    expect(p.sample(fresh, 301).players[1].action).toBe("attack");
  });

  it("keeps Power independent from a held Quick and previews its own timing without a ward or damage", () => {
    const { p, match } = fixture();
    p.updateInput(input({ attack: true }), 1);
    const fresh = next(match); p.observe("match-a", fresh, 240); p.sample(fresh, 260);
    p.updateInput(input({ attack: true, special: true }), 270);
    const power = p.sample(fresh, 270);
    expect(power.players[1].action).toBe("attack");
    expect(power.players[1].strikeKind).toBe("power");
    expect(power.players[1].strikeWindup).toBe(ATTACKS.wolf.windup);
    expect(power.players[1].ward).toBe(false);
    unchangedGameplay(fresh, power);
    p.updateInput(input({ special: true }), 280);
    expect(p.sample(fresh, 280).players[1].strikeKind).toBe("power");
    p.updateInput(input({ special: true }), 520);
    expect(p.sample(fresh, 520).players[1].action).toBe("fight_idle");
  });

  it("drops an unconfirmed pose at the horizon even with fresh idle packets", () => {
    const { p, match } = fixture(); p.updateInput(input({ attack: true }), 1);
    const fresh = next(match, 12); p.observe("match-a", fresh, 200);
    expect(p.sample(fresh, 240).players[1].action).toBe("attack");
    expect(p.sample(fresh, 251).players[1].action).toBe("fight_idle");
    p.updateInput(input({ attack: true }), 300);
    expect(p.sample(fresh, 300).players[1].action).toBe("fight_idle");
  });

  it("cancels on authority hit/health correction, retaining the exact authoritative outcome", () => {
    const { p, match } = fixture(); p.updateInput(input({ jump: true }), 1); p.sample(match, 30);
    const hit = next(match); Object.assign(hit.players[1], { hp: 74, stun: 0.2, action: "hit", x: 2.2 });
    p.observe("match-a", hit, 40);
    expect(p.sample(hit, 40)).toBe(hit);
    p.updateInput(input({ jump: true }), 50);
    expect(p.sample(hit, 50)).toBe(hit);
  });

  it("does not replay an acknowledged strike that already ended before arrival", () => {
    const { p, match } = fixture(); p.updateInput(input({ attack: true }), 1);
    const finished = next(match, 90); finished.players[1].strikeId = 1;
    p.observe("match-a", finished, 200);
    expect(p.sample(finished, 200).players[1].action).toBe("fight_idle");
  });

  it("does not replay a finished evade identified by its new authority cooldown", () => {
    const { p, match } = fixture(); p.updateInput(input({ jump: true }), 1);
    const finished = next(match, 30); finished.players[1].dodgeCooldown = 0.7;
    p.observe("match-a", finished, 200);
    expect(p.sample(finished, 200).players[1].action).toBe("fight_idle");
    p.updateInput(input({ jump: true }), 210);
    expect(p.sample(finished, 210).players[1].action).toBe("fight_idle");
  });

  it("does not rebase or renew freshness on duplicate, reordered or wrong-epoch packets", () => {
    const { p, match } = fixture("race"); p.updateInput(input({ move: 1, jump: true }), 1);
    const newer = next(match); p.observe("match-a", newer, 50);
    expect(p.observe("match-a", match, 180)).toBe(false);
    expect(p.observe("match-a", newer, 280)).toBe(false);
    expect(p.observe("old-match", next(newer), 290)).toBe(false);
    const view = p.sample(newer, 401);
    expect(view.players[1].x).toBe(newer.players[1].x);
    expect(view.players[1].y).toBe(newer.players[1].y);
    expect(view.players[1].action).toBe("run");
  });

  it("caps motion under loss and corrects it fully within the horizon plus correction window", () => {
    const { p, match } = fixture("race"); p.updateInput(input({ move: 1, jump: true }), 1);
    for (let at = 17; at <= 249; at += 16) {
      const view = p.sample(match, at);
      expect(Math.abs(view.players[1].x - match.players[1].x)).toBeLessThanOrEqual(PREDICTION_LIMITS.maxLateralOffset + 1e-9);
      unchangedGameplay(match, view);
    }
    const view = p.sample(match, 351);
    expect(view.players[1].x).toBe(match.players[1].x);
    expect(view.players[1].y).toBe(match.players[1].y);
    expect(view.players[1].action).toBe(match.players[1].action);
  });

  it("a release during stale delivery cannot revive steering when packets recover", () => {
    const { p, match } = fixture("race"); p.updateInput(input({ move: 1 }), 1); p.sample(match, 240);
    p.updateInput(input(), 270);
    const fresh = next(match, 18); p.observe("match-a", fresh, 280);
    for (let at = 290; at <= 400; at += 10) { p.updateInput(input(), at); p.sample(fresh, at); }
    expect(p.sample(fresh, 401).players[1].x).toBe(fresh.players[1].x);
  });

  it("does not bounce a held leap into evade across a phase cut", () => {
    const { p, match } = fixture("race"); p.updateInput(input({ jump: true, move: 1 }), 1);
    const fight = next(match); fight.phase = "fight"; fight.players[1].action = "fight_idle";
    p.observe("match-a", fight, 60); p.updateInput(input({ jump: true, move: 1 }), 60);
    expect(p.sample(fight, 100).players[1].action).toBe("fight_idle");
    expect(p.sample(fight, 101).players[1].x).toBe(fight.players[1].x);
    p.updateInput(input(), 110); p.updateInput(input({ jump: true }), 120);
    expect(p.sample(fight, 120).players[1].action).toBe("evade");
  });

  it("clears old-match input and ignores late old-epoch authority after reset", () => {
    const { p, match } = fixture(); p.updateInput(input({ attack: true }), 1);
    p.reset("match-b");
    expect(p.observe("match-a", next(match), 2)).toBe(false);
    expect(p.observe("match-b", match, 2)).toBe(true);
    p.updateInput(input({ attack: true }), 3);
    expect(p.sample(match, 3).players[1].action).toBe("fight_idle");
    p.updateInput(input(), 4); p.updateInput(input({ attack: true }), 5);
    expect(p.sample(match, 5).players[1].action).toBe("attack");
  });

  it("disconnect never resumes from late packets and does not manufacture terminal results", () => {
    const { p, match } = fixture(); p.updateInput(input({ attack: true }), 1); p.disconnect();
    expect(p.observe("match-a", next(match), 2)).toBe(false);
    p.updateInput(input({ attack: true }), 3);
    expect(p.sample(match, 4)).toBe(match);
    expect(match.result).toBeNull();
    const terminal = next(match); terminal.phase = "results"; terminal.result = { race: [25, 25], fight: [30, 20], total: [55, 45], winner: 0, reason: "authority" };
    expect(p.sample(terminal, 5)).toBe(terminal);
  });

  it("does not preview during countdown, transition, results, finished race, airborne leap or known recovery", () => {
    for (const phase of ["countdown", "transition", "results"] as const) {
      const { p, match } = fixture(phase); p.updateInput(input({ move: 1, jump: true, attack: true }), 1);
      expect(p.sample(match, 17)).toBe(match);
    }
    const { p, match } = fixture("race"); const finished = next(match); finished.players[1].raceStatus = "finished";
    p.observe("match-a", finished, 1); p.updateInput(input({ jump: true }), 2);
    expect(p.sample(finished, 17)).toBe(finished);
    const airborne = fixture("race"); const flying = next(airborne.match); flying.players[1].y = 1.2; flying.players[1].action = "jump"; flying.players[1].actionTime = 0.3;
    airborne.p.observe("match-a", flying, 1); airborne.p.updateInput(input({ jump: true }), 2);
    expect(airborne.p.sample(flying, 17).players[1].actionTime).toBe(0.3);
    expect(airborne.p.sample(flying, 18).players[1].y).toBe(1.2);
    const fight = fixture(); const recovering = next(fight.match); recovering.players[1].action = "attack"; recovering.players[1].actionTime = 0.8;
    fight.p.observe("match-a", recovering, 1); fight.p.updateInput(input({ jump: true, attack: true }), 2);
    expect(fight.p.sample(recovering, 17).players[1].actionTime).toBe(0.8);
  });

  it("uses only constant-size state through repeated input/snapshot updates and supports the other slot", () => {
    const match = createMatch(["lion", "unicorn"]); match.phase = "race";
    const p = new GuestPrediction(0); p.reset("a");
    for (let i = 0; i < 2_000; i++) {
      match.tick = i; p.observe("a", match, i * 10);
      p.updateInput(input({ move: i % 2 ? -1 : 1, jump: i % 40 === 0 }), i * 10);
      unchangedGameplay(match, p.sample(match, i * 10 + 1), 0);
    }
    const state = JSON.stringify(p);
    expect(state.length).toBeLessThan(1600);
    p.disconnect(); expect(p.sample(match, 30_000)).toBe(match);
  });

  it("rejects invalid/regressing clock values without infinite movement or a repeated edge", () => {
    const { p, match } = fixture("race"); p.updateInput(input({ move: 1 }), 10);
    for (const bad of [NaN, Infinity, -1, 5]) expect(p.sample(match, bad)).toBe(match);
    p.updateInput(input({ move: NaN }), 20);
    const view = p.sample(match, 100);
    expect(Number.isFinite(view.players[1].x)).toBe(true);
    expect(p.sample(match, 100_000).players[1].x).toBe(match.players[1].x);
  });

  it("raises and releases held Guard without evading or consuming guard resources", () => {
    const { p, match } = fixture(); p.updateInput(input({ guard: true }), 1);
    const raised = p.sample(match, 10); expect(raised.players[1].action).toBe("guard");
    unchangedGameplay(match, raised);
    p.updateInput(input(), 11); expect(p.sample(match, 12).players[1].action).toBe("fight_idle");
    const confirmed = next(match); confirmed.players[1].action = "guard";
    p.observe("match-a", confirmed, 20); p.updateInput(input({ guard: true }), 21); p.updateInput(input(), 22);
    const released = p.sample(confirmed, 23); expect(released.players[1].action).toBe("fight_idle");
    unchangedGameplay(confirmed, released);
  });

  it("does not preview broken Guard and applies the shared guarded movement factor", () => {
    const broken = fixture(); const snap = next(broken.match); snap.players[1].guardBroken = true; snap.players[1].guard = 0;
    broken.p.observe("match-a", snap, 1); broken.p.updateInput(input({ guard: true }), 2);
    expect(broken.p.sample(snap, 10).players[1].action).toBe("fight_idle");
    const normal = fixture(), guarding = fixture();
    normal.p.updateInput(input({ move: 1 }), 1); guarding.p.updateInput(input({ move: 1, guard: true }), 1);
    const dx = normal.p.sample(normal.match, 31).players[1].x - normal.match.players[1].x;
    const guardedDx = guarding.p.sample(guarding.match, 31).players[1].x - guarding.match.players[1].x;
    expect(guardedDx).toBeCloseTo(dx * GUARD.moveFactor, 8);
  });

  it("explicit cancellation consumes an unconfirmed attack but never cancels a committed authority strike", () => {
    const { p, match } = fixture(); p.updateInput(input({ special: true }), 1);
    p.updateInput(input({ special: true, cancelAttack: true }), 2);
    expect(p.sample(match, 3)).toBe(match);
    p.updateInput(input({ special: true }), 4); expect(p.sample(match, 5)).toBe(match);
    const committed = next(match); Object.assign(committed.players[1], { action: "attack", strikeKind: "power", strikeId: 1, actionTime: .2 });
    p.observe("match-a", committed, 6); p.updateInput(input({ cancelAttack: true }), 7);
    expect(p.sample(committed, 8)).toBe(committed);
  });

  it("freezes existing cosmetic action and motion during observed hit pause without extending the horizon", () => {
    const { p, match } = fixture(); p.updateInput(input({ attack: true }), 1);
    p.sample(match, 11);
    const paused = next(match); paused.hitPause = 4; p.observe("match-a", paused, 21);
    for (const now of [30, 60, 100, 140]) expect(p.sample(paused, now)).toBe(paused);
    const resumed = next(paused); resumed.hitPause = 0; p.observe("match-a", resumed, 150);
    const pose = p.sample(resumed, 151);
    expect(pose.players[1].actionTime).toBeCloseTo(.021, 6); // 20ms before known pause +1ms after.
    unchangedGameplay(resumed, pose);
    expect(p.sample(resumed, 251).players[1].action).toBe("fight_idle");
    const moving = fixture(); moving.p.updateInput(input({ move: 1 }), 1);
    const stopped = next(moving.match); stopped.hitPause = 2; moving.p.observe("match-a", stopped, 10);
    expect(moving.p.sample(stopped, 100)).toBe(stopped);
  });

  it("does not invent a new action or a linked hit while authority is paused or busy", () => {
    const { p, match } = fixture(); const paused = next(match); paused.hitPause = 4;
    p.observe("match-a", paused, 1); p.updateInput(input({ attack: true, move: 1 }), 2);
    expect(p.sample(paused, 40)).toBe(paused);
    const resumed = next(paused); resumed.hitPause = 0; p.observe("match-a", resumed, 50);
    p.updateInput(input({ attack: true, move: 1 }), 51);
    expect(p.sample(resumed, 52).players[1].action).toBe("fight_idle");
    const busy = next(resumed); Object.assign(busy.players[1], { action: "attack", actionTime: .3, comboWindow: .4, attackConnected: true });
    p.observe("match-a", busy, 60); p.updateInput(input(), 61); p.updateInput(input({ attack: true }), 62);
    const view = p.sample(busy, 70);
    expect(view.players[1].actionTime).toBe(.3); expect(view.players[1].comboPending).toBe(false);
    unchangedGameplay(busy, view);
  });
  it("preserves solo duel format and authoritative power-contact metadata in the render copy", () => {
    const { p, match } = fixture(); const duel = next(match); duel.format = "duel";
    duel.events.push({ id: 1, type: "ward-block", slot: 0, x: 0, z: 0, strikeKind: "power" });
    p.observe("match-a", duel, 1); p.updateInput(input({ special: true }), 2);
    const view = p.sample(duel, 10);
    expect(view.players[1].strikeKind).toBe("power");
    expect(view.format).toBe("duel"); expect(view.events[0].strikeKind).toBe("power");
    unchangedGameplay(duel, view);
  });

  it("cancellation clears an expired leap's remaining visual correction without replay", () => {
    const { p, match } = fixture("race"); p.updateInput(input({ jump: true }), 1);
    const fresh = next(match); p.observe("match-a", fresh, 240);
    expect(p.sample(fresh, 260).players[1].y).toBeGreaterThan(0);
    p.updateInput(input({ cancelAttack: true }), 261);
    expect(p.sample(fresh, 262).players[1].y).toBe(0);
    p.updateInput(input(), 263); expect(p.sample(fresh, 264).players[1].action).toBe("run");
    unchangedGameplay(fresh, p.sample(fresh, 265));
  });

});
