import { neutralInput, type Input } from "./simulation";
const BUTTONS = ["jump", "attack", "special"] as const;
type Button = (typeof BUTTONS)[number];
/** Includes snapshot age and upstream transit on the authority's 60Hz clock. */
export const INPUT_MAX_AGE_TICKS = 30;
type Press = { id: number; tick: number; end: number | null };
export interface InputPacket {
  sequence: number;
  tick: number;
  held: Input;
  edges: Record<Button, number>;
  presses: Record<Button, Press[]>;
  cancellation: { id: number; through: Record<Button, number>; tick: number };
}
const emptyEdges = () => ({ jump: 0, attack: 0, special: 0 });
const emptyHistory = (): Record<Button, Press[]> => ({ jump: [], attack: [], special: [] });
/** Independent bounded histories preserve true taps without merging quick/Power. */
export class InputSender {
  private previous = neutralInput();
  private edges = emptyEdges();
  private presses = emptyHistory();
  private sequence = 0;
  private cancellation = { id: 0, through: emptyEdges(), tick: 0 };
  private blocked = { jump: false, attack: false, special: false };
  update(input: Input, tick = 0) {
    if (input.cancelAttack && !this.previous.cancelAttack) {
      this.cancellation = { id: this.cancellation.id + 1, through: { ...this.edges }, tick };
      for (const key of BUTTONS) {
        const current = this.presses[key].at(-1);
        if (current && current.end === null) current.end = tick;
        this.blocked[key] ||= input[key];
      }
    }
    for (const key of BUTTONS) {
      if (input[key] && !this.previous[key] && !this.blocked[key] && !input.cancelAttack) {
        this.presses[key].push({ id: ++this.edges[key], tick, end: null });
        if (this.presses[key].length > 2) this.presses[key].shift();
      } else if (!input[key] && this.previous[key]) {
        const current = this.presses[key].at(-1);
        if (current && current.end === null) current.end = tick;
      }
      if (!input[key]) this.blocked[key] = false;
    }
    this.previous = { ...input };
  }
  packet(tick = 0): InputPacket {
    return { sequence: ++this.sequence, tick, held: { ...this.previous }, edges: { ...this.edges }, presses: structuredClone(this.presses), cancellation: structuredClone(this.cancellation) };
  }
  reset() {
    for (const key of BUTTONS) this.blocked[key] ||= this.previous[key];
    this.previous = neutralInput(); this.sequence = 0; this.edges = emptyEdges(); this.presses = emptyHistory();
    this.cancellation = { id: 0, through: emptyEdges(), tick: 0 };
  }
}
const validTick = (tick: unknown): tick is number => Number.isSafeInteger(tick) && (tick as number) >= 0 && (tick as number) < 1e7;
export function isInputPacket(value: unknown): value is InputPacket {
  if (!value || typeof value !== "object") return false;
  const p = value as InputPacket;
  return (
    validTick(p.sequence) && p.sequence > 0 && validTick(p.tick) && Boolean(p.held && p.edges && p.presses && p.cancellation?.through) &&
    Number.isFinite(p.held.move) && Math.abs(p.held.move) <= 1 &&
    ["jump", "attack", "special", "guard"].every(k => typeof p.held[k as keyof Input] === "boolean") &&
    (p.held.cancelAttack === undefined || typeof p.held.cancelAttack === "boolean") &&
    validTick(p.cancellation.id) && validTick(p.cancellation.tick) && p.cancellation.tick <= p.tick &&
    BUTTONS.every(k => validTick(p.edges[k]) && validTick(p.cancellation.through[k]) && p.cancellation.through[k] <= p.edges[k] &&
      Array.isArray(p.presses[k]) && p.presses[k].length <= 2 &&
      p.presses[k].every((press, i, list) => press !== null && typeof press === "object" && validTick(press.id) && press.id > 0 && press.id <= p.edges[k] &&
        validTick(press.tick) && press.tick <= p.tick &&
        (press.end === null ? i === list.length - 1 : validTick(press.end) && press.end >= press.tick && press.end <= p.tick) &&
        (i === 0 || press.id > list[i - 1].id && press.tick >= (list[i - 1].end ?? Infinity))))
  );
}
export class InputReceiver {
  private seen = emptyEdges();
  private pending = emptyHistory();
  private previous = neutralInput();
  private held = neutralInput();
  private receivedTick = -Infinity;
  private lastTick = 0;
  private sequence = 0;
  private cancellation = 0;
  private cancelNext = false;
  private active: Record<Button, Press | null> = { jump: null, attack: null, special: null };
  accept(packet: InputPacket, authorityTick = packet.tick) {
    if (!isInputPacket(packet) || !validTick(authorityTick) || packet.tick > authorityTick ||
      packet.sequence <= this.sequence || packet.tick < this.receivedTick) return;
    this.sequence = packet.sequence; this.lastTick = authorityTick; this.receivedTick = packet.tick;
    this.held = { ...packet.held };
    if (packet.cancellation.id > this.cancellation) {
      this.cancellation = packet.cancellation.id;
      // Deliver even without an active physical hold: the simulation may have a
      // pending combo link from an earlier released tap that cancellation clears.
      this.cancelNext = true;
      for (const k of BUTTONS) {
        const cutoff = packet.cancellation.through[k];
        this.pending[k] = this.pending[k].filter(s => s.id > cutoff);
        if (this.active[k] && this.active[k]!.id <= cutoff) this.active[k] = null;
        this.seen[k] = Math.max(this.seen[k], cutoff);
      }
    }
    for (const k of BUTTONS) {
      const active = this.active[k];
      if (active && active.end === null && packet.edges[k] > active.id && !packet.presses[k].some(s => s.id === active.id)) {
        this.active[k] = null; this.cancelNext = true; // A missing end is never replay authority.
      }
      for (const press of packet.presses[k]) {
        const known = this.active[k]?.id === press.id ? this.active[k] : this.pending[k].find(s => s.id === press.id);
        if (known) { if (known.end === null && press.end !== null) known.end = press.end; }
        else if (press.id > this.seen[k] && authorityTick - press.tick <= INPUT_MAX_AGE_TICKS) this.pending[k].push({ ...press });
      }
      this.pending[k] = this.pending[k].slice(-2);
      this.seen[k] = Math.max(this.seen[k], packet.edges[k]);
    }
  }
  tick(authorityTick = this.lastTick): Input {
    this.lastTick = authorityTick;
    const fresh = authorityTick - this.receivedTick <= INPUT_MAX_AGE_TICKS;
    const next = fresh ? { ...this.held } : neutralInput();
    next.attack = false; next.special = false; next.jump = false; next.cancelAttack = false;
    for (const k of BUTTONS) {
      const active = this.active[k];
      if (active && (!fresh || active.end === null && !this.held[k])) { this.active[k] = null; this.cancelNext = true; }
      this.pending[k] = this.pending[k].filter(s => authorityTick - s.tick <= INPUT_MAX_AGE_TICKS);
    }
    if (this.cancelNext) {
      next.cancelAttack = true; this.cancelNext = false;
      // A canceled logical hold must not resume as a fresh rising edge merely
      // because its physical button remains down in the next heartbeat.
      this.active = { jump: null, attack: null, special: null };
    }
    else for (const k of BUTTONS) {
      if (this.active[k]) {
        if (this.active[k]!.end !== null) this.active[k] = null;
        else next[k] = true;
      } else if (!this.previous[k] && fresh) {
        const press = this.pending[k].shift();
        if (press) { this.active[k] = press; next[k] = true; }
      }
    }
    this.previous = next;
    return next;
  }
  reset() {
    this.seen = emptyEdges(); this.pending = emptyHistory();
    this.previous = neutralInput(); this.held = neutralInput(); this.receivedTick = -Infinity; this.lastTick = 0;
    this.sequence = 0; this.cancellation = 0; this.cancelNext = false; this.active = { jump: null, attack: null, special: null };
  }
}
