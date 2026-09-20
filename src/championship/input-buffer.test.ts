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
  it("does not turn held attacks into auto fire and preserves movement/guard", () => {
    const s = new InputSender(),
      r = new InputReceiver();
    for (let i = 0; i < 30; i++) {
      s.update({ ...neutralInput(), attack: true, move: -1, guard: true });
      r.accept(s.packet());
      const v = r.tick();
      expect(v.attack).toBe(i === 0);
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
    expect(r.tick(131)).toEqual(neutralInput());
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
      { ...p, presses: { ...p.presses, attack: [{ id: 1, tick: 7 }] } },
      { ...p, presses: { ...p.presses, attack: [null] } },
      { ...p, presses: { ...p.presses, attack: Array(3).fill({ id: 1, tick: 5 }) } },
      { ...p, presses: { ...p.presses, attack: [{ id: 2, tick: 5 }] } },
    ]) expect(isInputPacket(bad)).toBe(false);
    const r = new InputReceiver();r.accept(p, 5);expect(r.tick(5).attack).toBe(false);
    r.accept(p, 6);expect(r.tick(6).attack).toBe(true);
  });
});
