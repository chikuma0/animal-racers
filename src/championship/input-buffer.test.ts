import { describe, it, expect } from "vitest";
import { InputSender, InputReceiver, isInputPacket } from "./input-buffer";
import { neutralInput } from "./simulation";
describe("network input intent", () => {
  it("preserves a tap fully between sends and does not replay duplicate packets", () => {
    const s = new InputSender(),
      r = new InputReceiver();
    s.update({ ...neutralInput(), attack: true });
    s.update(neutralInput());
    r.accept(s.packet());
    expect(r.tick().attack).toBe(true);
    r.accept(s.packet());
    expect(r.tick().attack).toBe(false);
    expect(r.tick().attack).toBe(false);
  });
  it("recovers a lost edge packet from later cumulative counters", () => {
    const s = new InputSender(),
      r = new InputReceiver();
    s.update({ ...neutralInput(), jump: true });
    s.packet();
    s.update(neutralInput());
    r.accept(s.packet());
    expect(r.tick().jump).toBe(true);
    expect(r.tick().jump).toBe(false);
  });
  it("preserves held attacks continuously rather than converting them into pulse/release pairs", () => {
    const s = new InputSender(),
      r = new InputReceiver();
    for (let i = 0; i < 30; i++) {
      s.update({ ...neutralInput(), attack: true, move: -1, guard: true });
      r.accept(s.packet());
      const v = r.tick();
      expect(v.attack).toBe(true);
      expect(v.move).toBe(-1);
      expect(v.guard).toBe(true);
    }
  });
  it("caps bursts and requires a release between queued actions", () => {
    const s = new InputSender(),
      r = new InputReceiver();
    for (let i = 0; i < 100; i++) {
      s.update({ ...neutralInput(), special: true });
      s.update(neutralInput());
    }
    r.accept(s.packet());
    expect([
      r.tick().special,
      r.tick().special,
      r.tick().special,
      r.tick().special,
      r.tick().special,
    ]).toEqual([true, false, true, false, false]);
  });
  it("rejects malformed and nonfinite controls", () => {
    const s = new InputSender();
    expect(isInputPacket(s.packet())).toBe(true);
    for (const v of [
      null,
      {},
      { held: neutralInput(), edges: { jump: NaN, attack: 0, special: 0 } },
      {
        held: { ...neutralInput(), move: 2 },
        edges: { jump: 0, attack: 0, special: 0 },
      },
    ])
      expect(isInputPacket(v)).toBe(false);
  });
  it("expires an old tap after loss without renewing it in repeated packets", () => {
    const s = new InputSender(), r = new InputReceiver();
    s.update({ ...neutralInput(), attack: true }, 100);
    s.update(neutralInput(), 101);
    r.accept(s.packet(160), 160);
    expect(r.tick(160).attack).toBe(false);
    r.accept(s.packet(161), 161);
    expect(r.tick(161).attack).toBe(false);
    s.update({ ...neutralInput(), attack: true }, 162);
    s.update(neutralInput(), 163);
    r.accept(s.packet(163), 164);
    expect(r.tick(164).attack).toBe(true);
    expect(r.tick(165).attack).toBe(false);
    expect(r.tick(166).attack).toBe(false);
  });
  it("includes transit time and expires queued intent and held movement", () => {
    const s = new InputSender(), r = new InputReceiver();
    s.update({ ...neutralInput(), jump: true, move: 1, guard: true }, 100);
    const sent = s.packet(100);
    r.accept(sent, 130);
    expect(r.tick(130).jump).toBe(true);
    expect(r.tick(131)).toEqual({ ...neutralInput(), cancelAttack: true });
    expect(r.tick(132)).toEqual(neutralInput());
    const late = new InputReceiver();late.accept(sent, 131);
    expect(late.tick(131)).toEqual(neutralInput());
    const queued = new InputReceiver();queued.accept(sent, 130);
    expect(queued.tick(131).jump).toBe(false);
  });
  it("rejects malformed press history and future match clocks", () => {
    const s = new InputSender();s.update({ ...neutralInput(), attack: true }, 5);
    const p = s.packet(6);expect(isInputPacket(p)).toBe(true);
    for (const bad of [
      { ...p, tick: NaN },
      { ...p, presses: { ...p.presses, attack: [{ id: 1, tick: 7, end: null }] } },
      { ...p, presses: { ...p.presses, attack: [null] } },
      { ...p, presses: { ...p.presses, attack: Array(3).fill({ id: 1, tick: 5 }) } },
      { ...p, presses: { ...p.presses, attack: [{ id: 2, tick: 5 }] } },
    ]) expect(isInputPacket(bad)).toBe(false);
    const r = new InputReceiver();r.accept(p, 5);expect(r.tick(5).attack).toBe(false);
    r.accept(p, 6);expect(r.tick(6).attack).toBe(true);
  });
  it("keeps Quick, Power, Evade and held Guard independent", () => {
    const s = new InputSender(), r = new InputReceiver();
    s.update({ ...neutralInput(), attack: true }, 1); r.accept(s.packet(1), 1);
    expect(r.tick(1).attack).toBe(true);
    s.update({ ...neutralInput(), special: true, guard: true, jump: true }, 2); r.accept(s.packet(2), 2);
    expect(r.tick(2)).toMatchObject({ attack: false, special: true, guard: true, jump: true, cancelAttack: false });
    expect(s.packet(2).presses.attack).toHaveLength(1);
    expect(s.packet(2).presses.special).toHaveLength(1);
    s.update(neutralInput(), 3); r.accept(s.packet(3), 3);
    expect(r.tick(3)).toMatchObject({ attack: false, cancelAttack: false });
    expect(r.tick(4).attack).toBe(false);
  });
  it("repeats a cancellation generation after its original packet is lost, without firing release", () => {
    const s = new InputSender(), r = new InputReceiver();
    s.update({ ...neutralInput(), attack: true }, 1); r.accept(s.packet(1), 1); r.tick(1);
    s.update({ ...neutralInput(), cancelAttack: true }, 2); s.packet(2); // Lost.
    s.update(neutralInput(), 3); r.accept(s.packet(3), 3);
    expect(r.tick(3)).toMatchObject({ attack: false, cancelAttack: true });
    r.accept(s.packet(4), 4); expect(r.tick(4)).toMatchObject({ attack: false, cancelAttack: false });
    expect(r.tick(5).attack).toBe(false);
  });
  it("does not turn loss, stale held state or resumed heartbeats into a release attack or restarted charge", () => {
    const s = new InputSender(), r = new InputReceiver();
    s.update({ ...neutralInput(), attack: true }, 1); r.accept(s.packet(1), 1);
    expect(r.tick(1).attack).toBe(true);
    expect(r.tick(32)).toMatchObject({ attack: false, cancelAttack: true });
    r.accept(s.packet(33), 33); expect(r.tick(33).attack).toBe(false);
    s.update(neutralInput(), 34); r.accept(s.packet(34), 34);
    expect(r.tick(34)).toMatchObject({ attack: false, cancelAttack: false });
  });
  it("rejects reordered holds and duplicated short sessions after release or cancellation", () => {
    const s = new InputSender(), r = new InputReceiver();
    s.update({ ...neutralInput(), attack: true }, 1); const held = s.packet(1);
    s.update(neutralInput(), 2); const release = s.packet(2);
    r.accept(release, 2); expect(r.tick(2).attack).toBe(true);
    r.accept(held, 3); expect(r.tick(3).attack).toBe(false);
    r.accept(release, 4); expect(r.tick(4).attack).toBe(false);
  });
  it("cancels earlier intent but preserves a newer fresh press when both arrive after loss", () => {
    const s = new InputSender(), r = new InputReceiver();
    s.update({ ...neutralInput(), attack: true }, 1); r.accept(s.packet(1), 1); r.tick(1);
    s.update({ ...neutralInput(), cancelAttack: true }, 2);
    s.update(neutralInput(), 3); s.update({ ...neutralInput(), attack: true }, 4);
    r.accept(s.packet(4), 4);
    expect(r.tick(4)).toMatchObject({ attack: false, cancelAttack: true });
    expect(r.tick(5)).toMatchObject({ attack: true, cancelAttack: false });
  });
  it("preserves a completed tap whose down packet was lost as one held tick, without duration reconstruction", () => {
    const s = new InputSender(), r = new InputReceiver();
    s.update({ ...neutralInput(), attack: true }, 1); s.update(neutralInput(), 20);
    r.accept(s.packet(25), 25);
    expect(r.tick(25)).toMatchObject({ attack: true, cancelAttack: false });
    expect(r.tick(26)).toMatchObject({ attack: false, cancelAttack: false });
  });
  it("a delayed release never fabricates a second Quick/Power edge", () => {
    const s = new InputSender(), r = new InputReceiver();
    s.update({ ...neutralInput(), attack: true }, 1);
    // Delayed stale-but-admissible heartbeats can extend an observed hold.
    for (let t = 1; t <= 40; t++) {
      r.accept(s.packet(Math.min(t, 20)), t); expect(r.tick(t).attack).toBe(true);
    }
    s.update(neutralInput(), 21); r.accept(s.packet(21), 41);
    expect(r.tick(41)).toMatchObject({ attack: false, cancelAttack: false });
    expect(r.tick(42).attack).toBe(false);
  });
  it("preserves long held input without auto-fire, then releases normally", () => {
    const s = new InputSender(), r = new InputReceiver();
    for (let t = 1; t <= 45; t++) {
      s.update({ ...neutralInput(), attack: true }, t); r.accept(s.packet(t), t);
      expect(r.tick(t).attack).toBe(true);
    }
    s.update(neutralInput(), 46); r.accept(s.packet(46), 46);
    expect(r.tick(46)).toMatchObject({ attack: false, cancelAttack: false });
  });
  it("cancels an active session whose release fell outside the bounded retained history", () => {
    const s = new InputSender(), r = new InputReceiver();
    s.update({ ...neutralInput(), attack: true }, 1); r.accept(s.packet(1), 1); r.tick(1);
    for (let t = 2; t < 8; t += 2) { s.update(neutralInput(), t); s.update({ ...neutralInput(), attack: true }, t + 1); }
    r.accept(s.packet(8), 8);
    expect(r.tick(8)).toMatchObject({ attack: false, cancelAttack: true });
    expect(s.packet(8).presses.attack).toHaveLength(2);
  });
  it("requires release and fresh press after sender/receiver reset while physically held", () => {
    const s = new InputSender(), r = new InputReceiver();
    s.update({ ...neutralInput(), attack: true }, 1); r.accept(s.packet(1), 1); r.tick(1);
    s.reset(); r.reset(); s.reset(); r.reset(); // Repeated cuts must not release the physical latch.
    s.update({ ...neutralInput(), attack: true }, 0); r.accept(s.packet(0), 0);
    expect(r.tick(0).attack).toBe(false);
    s.update(neutralInput(), 1); s.update({ ...neutralInput(), attack: true }, 2); r.accept(s.packet(2), 2);
    expect(r.tick(2).attack).toBe(true);
  });
  it("rejects malformed session/cancel metadata at the receiver boundary", () => {
    const s = new InputSender(); s.update({ ...neutralInput(), attack: true }, 2); const p = s.packet(3);
    for (const bad of [
      { ...p, sequence: 0 }, { ...p, sequence: NaN },
      { ...p, held: { ...p.held, cancelAttack: 'yes' } },
      { ...p, presses: { ...p.presses, attack: [null] } },
      { ...p, presses: { ...p.presses, attack: Array(3).fill(p.presses.attack[0]) } },
      { ...p, presses: { ...p.presses, attack: [{ ...p.presses.attack[0], tick: 4 }] } },
      { ...p, presses: { ...p.presses, attack: [{ ...p.presses.attack[0], end: 1 }] } },
      { ...p, cancellation: { id: 1, through: { jump: 0, attack: 2, special: 0 }, tick: 2 } },
    ]) { expect(isInputPacket(bad)).toBe(false); const r = new InputReceiver(); r.accept(bad as typeof p, 3); expect(r.tick(3).attack).toBe(false); }
  });
  it("delivers lost cancellation even after a tap ended, so an authoritative pending chain can clear", () => {
    const s = new InputSender(), r = new InputReceiver();
    s.update({ ...neutralInput(), attack: true }, 1); s.update(neutralInput(), 2); r.accept(s.packet(2), 2);
    expect(r.tick(2).attack).toBe(true); expect(r.tick(3).attack).toBe(false);
    s.update({ ...neutralInput(), cancelAttack: true }, 4); s.packet(4); // Lost cancellation.
    s.update(neutralInput(), 5); r.accept(s.packet(5), 5);
    expect(r.tick(5).cancelAttack).toBe(true);
    r.accept(s.packet(6), 6); expect(r.tick(6).cancelAttack).toBe(false);
  });
  it("recovers independent simultaneous Quick and Power taps without aliasing or duplicates", () => {
    const s = new InputSender(), r = new InputReceiver();
    s.update({ ...neutralInput(), attack: true, special: true }, 1); s.update(neutralInput(), 2);
    r.accept(s.packet(2), 2);
    expect(r.tick(2)).toMatchObject({ attack: true, special: true });
    expect(r.tick(3)).toMatchObject({ attack: false, special: false });
    r.accept(s.packet(4), 4); expect(r.tick(4)).toMatchObject({ attack: false, special: false });
  });
  it("never re-arms another held button when a missing history forces cancellation", () => {
    const s = new InputSender(), r = new InputReceiver();
    s.update({ ...neutralInput(), attack: true, special: true }, 1); r.accept(s.packet(1), 1); r.tick(1);
    for (let t = 2; t < 8; t += 2) {
      s.update({ ...neutralInput(), special: true }, t);
      s.update({ ...neutralInput(), attack: true, special: true }, t + 1);
    }
    r.accept(s.packet(8), 8); expect(r.tick(8).cancelAttack).toBe(true);
    expect(r.tick(9).special).toBe(false);
    r.accept(s.packet(10), 10); expect(r.tick(10).special).toBe(false);
  });
  it("explicit cancellation clears lost pending Evade/Quick/Power taps while preserving held guard", () => {
    const s = new InputSender(), r = new InputReceiver();
    s.update({ ...neutralInput(), jump: true, attack: true, special: true, guard: true }, 1);
    s.update({ ...neutralInput(), guard: true, cancelAttack: true }, 2);
    s.update({ ...neutralInput(), guard: true }, 3); r.accept(s.packet(3), 3);
    expect(r.tick(3)).toMatchObject({ attack: false, special: false, jump: false, guard: true, cancelAttack: true });
    expect(r.tick(4)).toMatchObject({ attack: false, special: false, jump: false, guard: true, cancelAttack: false });
  });
});
