import { neutralInput, type Input } from "./simulation";
const BUTTONS = ["jump", "attack", "special"] as const;
type Button = (typeof BUTTONS)[number];
// Half a second on the authoritative 60 Hz match clock. A guest stamps the
// latest received tick, so this includes downstream snapshot delay as well as
// input transit. It intentionally favors dropping stale intent over replay.
export const INPUT_MAX_AGE_TICKS = 30;
type Press = { id: number; tick: number };
export interface InputPacket {
  tick: number;
  held: Input;
  edges: Record<Button, number>;
  presses: Record<Button, Press[]>;
}
/** Bounded cumulative edges survive short loss; their original time never renews. */
export class InputSender {
  private previous = neutralInput();
  private edges = { jump: 0, attack: 0, special: 0 };
  private presses: Record<Button, Press[]> = { jump: [], attack: [], special: [] };
  update(input: Input, tick = 0) {
    for (const key of BUTTONS) {
      if (input[key] && !this.previous[key]) {
        this.presses[key].push({ id: ++this.edges[key], tick });
        if (this.presses[key].length > 2) this.presses[key].shift();
      }
    }
    this.previous = { ...input };
  }
  packet(tick = 0): InputPacket {
    return { tick, held: { ...this.previous }, edges: { ...this.edges }, presses: structuredClone(this.presses) };
  }
  reset() {
    this.previous = neutralInput();
    this.edges = { jump: 0, attack: 0, special: 0 };
    this.presses = { jump: [], attack: [], special: [] };
  }
}
const validTick = (tick: unknown): tick is number => Number.isSafeInteger(tick) && (tick as number) >= 0 && (tick as number) < 1e7;
export function isInputPacket(value: unknown): value is InputPacket {
  if (!value || typeof value !== "object") return false;
  const p = value as InputPacket;
  return (
    validTick(p.tick) && Boolean(p.held && p.edges && p.presses) &&
    Number.isFinite(p.held.move) && Math.abs(p.held.move) <= 1 &&
    ["jump", "attack", "special", "guard"].every(k => typeof p.held[k as keyof Input] === "boolean") &&
    BUTTONS.every(k =>
      validTick(p.edges[k]) && Array.isArray(p.presses[k]) && p.presses[k].length <= 2 &&
      p.presses[k].every((press, i, list) =>
        press !== null && typeof press === "object" && validTick(press.id) && press.id > 0 && press.id <= p.edges[k] &&
        validTick(press.tick) && press.tick <= p.tick &&
        (i === 0 || (press.id > list[i - 1].id && press.tick >= list[i - 1].tick)),
      ),
    )
  );
}
export class InputReceiver {
  private seen = { jump: 0, attack: 0, special: 0 };
  private pending: Record<Button, number[]> = { jump: [], attack: [], special: [] };
  private previous = neutralInput();
  private held = neutralInput();
  private receivedTick = -Infinity;
  private lastTick = 0;
  accept(packet: InputPacket, authorityTick = packet.tick) {
    if (packet.tick > authorityTick) return;
    this.lastTick = authorityTick;
    this.receivedTick = packet.tick;
    this.held = { ...packet.held };
    for (const k of BUTTONS) {
      for (const press of packet.presses[k]) {
        if (press.id > this.seen[k] && authorityTick - press.tick <= INPUT_MAX_AGE_TICKS) {
          this.pending[k].push(press.tick);
        }
      }
      this.pending[k] = this.pending[k].slice(-2);
      // Even expired presses are acknowledged, so later packets cannot revive them.
      this.seen[k] = Math.max(this.seen[k], packet.edges[k]);
    }
  }
  tick(authorityTick = this.lastTick): Input {
    this.lastTick = authorityTick;
    const next = authorityTick - this.receivedTick <= INPUT_MAX_AGE_TICKS ? { ...this.held } : neutralInput();
    for (const k of BUTTONS) {
      this.pending[k] = this.pending[k].filter(tick => authorityTick - tick <= INPUT_MAX_AGE_TICKS);
      next[k] = !this.previous[k] && this.pending[k].length > 0;
      if (next[k]) this.pending[k].shift();
    }
    this.previous = next;
    return next;
  }
  reset() {
    this.seen = { jump: 0, attack: 0, special: 0 };
    this.pending = { jump: [], attack: [], special: [] };
    this.previous = neutralInput();
    this.held = neutralInput();
    this.receivedTick = -Infinity;
    this.lastTick = 0;
  }
}
