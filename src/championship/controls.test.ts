import { describe, expect, it } from "vitest";
import { InputControls } from "./controls";
import { InputSender, InputReceiver } from "./input-buffer";

describe("physical input ownership", () => {
  it("opposing directions cancel and releasing either restores the still-held direction", () => {
    const c = new InputControls();
    c.pointerDown(1, "move", -1); c.pointerDown(2, "move", 1);
    expect(c.value().move).toBe(0);
    c.pointerUp(1); expect(c.value().move).toBe(1);
    c.pointerDown(1, "move", -1); c.pointerUp(2);
    expect(c.value().move).toBe(-1);
  });
  it("release is bound to the original jump even after its button becomes Strike", () => {
    const c = new InputControls();
    c.pointerDown(7, "jump", true);
    c.pointerUp(7);
    expect(c.value()).toMatchObject({ jump: false, attack: false });
    c.pointerDown(7, "attack", true);
    expect(c.value()).toMatchObject({ jump: false, attack: true });
  });
  it("keeps multiple owners of the same action and keyboard/touch combinations", () => {
    const c = new InputControls();
    c.pointerDown(1, "guard", true); c.pointerDown(2, "guard", true);
    c.keyDown("J"); c.keyDown("Shift");
    c.pointerUp(1); c.keyUp("j");
    expect(c.value()).toMatchObject({ guard: true, attack: false });
    c.pointerUp(2); expect(c.value().guard).toBe(true);
    c.keyUp("Shift"); expect(c.value().guard).toBe(false);
    c.pointerDown(4, "move", -1); c.keyDown("d");
    expect(c.value().move).toBe(0);
    c.keyUp("D"); expect(c.value().move).toBe(-1);
  });
  it("clear/cancel and duplicate late releases cannot latch or regenerate presses", () => {
    const c = new InputControls(), sender = new InputSender(), receiver = new InputReceiver();
    c.pointerDown(1, "jump", true); sender.update(c.value(), 1);
    receiver.accept(sender.packet(1), 1); expect(receiver.tick(1).jump).toBe(true);
    c.clear(); c.pointerUp(1); c.pointerUp(1); sender.update(c.value(), 2);
    receiver.accept(sender.packet(2), 2); expect(receiver.tick(2).jump).toBe(false);
    c.pointerDown(1, "jump", true); sender.update(c.value(), 3);
    receiver.accept(sender.packet(3), 3); expect(receiver.tick(3).jump).toBe(true);
  });
  it("ignores unrelated keys and bounds simultaneous pointer storage", () => {
    const c = new InputControls();
    for (let i = 0; i < 1000; i++) { c.keyDown(`unknown-${i}`); c.pointerDown(i, "guard", true); }
    for (let i = 0; i < 16; i++) c.pointerUp(i);
    expect(c.value()).toEqual({ move: 0, jump: false, attack: false, special: false, guard: false });
  });
});
