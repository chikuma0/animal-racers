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
});
