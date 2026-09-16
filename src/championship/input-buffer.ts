import { neutralInput, type Input } from "./simulation";
const BUTTONS = ["jump", "attack", "special"] as const;
type Button = (typeof BUTTONS)[number];
export interface InputPacket {
  held: Input;
  edges: Record<Button, number>;
}
/** Cumulative edges survive taps between sends, lost packets and duplicate snapshots. */
export class InputSender {
  private previous = neutralInput();
  private edges = { jump: 0, attack: 0, special: 0 };
  update(input: Input) {
    for (const key of BUTTONS)
      if (input[key] && !this.previous[key]) this.edges[key]++;
    this.previous = { ...input };
  }
  packet(): InputPacket {
    return { held: { ...this.previous }, edges: { ...this.edges } };
  }
  reset() {
    this.previous = neutralInput();
    this.edges = { jump: 0, attack: 0, special: 0 };
  }
}
export function isInputPacket(value: unknown): value is InputPacket {
  if (!value || typeof value !== "object") return false;
  const p = value as InputPacket;
  return (
    Boolean(p.held && p.edges) &&
    Number.isFinite(p.held.move) &&
    Math.abs(p.held.move) <= 1 &&
    ["jump", "attack", "special", "guard"].every(
      (k) => typeof p.held[k as keyof Input] === "boolean",
    ) &&
    BUTTONS.every(
      (k) =>
        Number.isSafeInteger(p.edges[k]) && p.edges[k] >= 0 && p.edges[k] < 1e7,
    )
  );
}
export class InputReceiver {
  private seen = { jump: 0, attack: 0, special: 0 };
  private pending = { jump: 0, attack: 0, special: 0 };
  private previous = neutralInput();
  private held = neutralInput();
  accept(packet: InputPacket) {
    this.held = { ...packet.held };
    for (const k of BUTTONS) {
      const diff = Math.max(0, packet.edges[k] - this.seen[k]);
      this.pending[k] = Math.min(2, this.pending[k] + diff);
      this.seen[k] = Math.max(this.seen[k], packet.edges[k]);
    }
  }
  tick(): Input {
    const next = { ...this.held };
    for (const k of BUTTONS) {
      next[k] = !this.previous[k] && this.pending[k] > 0;
      if (next[k]) this.pending[k]--;
    }
    this.previous = next;
    return next;
  }
  reset() {
    this.seen = { jump: 0, attack: 0, special: 0 };
    this.pending = { jump: 0, attack: 0, special: 0 };
    this.previous = neutralInput();
    this.held = neutralInput();
  }
}
