import { neutralInput, type Input } from "./simulation";

const KEYS = new Set(["a", "d", "w", "arrowleft", "arrowright", "arrowup", " ", "j", "k", "l", "shift"]);

/** Each physical press owns its original action until release or cancellation. */
export class InputControls {
  private keys = new Set<string>();
  private pointers = new Map<number, { key: keyof Input; value: number | boolean }>();
  private cancelled = false;
  keyDown(key: string) {
    const normalized = key.toLowerCase();
    if (KEYS.has(normalized)) { this.cancelled = false; this.keys.add(normalized); }
  }
  keyUp(key: string) { this.keys.delete(key.toLowerCase()); }
  pointerDown(id: number, key: keyof Input, value: number | boolean) {
    if (!Number.isFinite(id) || (!this.pointers.has(id) && this.pointers.size >= 16)) return;
    this.cancelled = false;
    this.pointers.set(id, { key, value });
  }
  pointerUp(id: number) { this.pointers.delete(id); }
  pointerCancel(id: number) {
    const owner = this.pointers.get(id);
    if (!owner) return; // Lost capture after a normal release is not a cancellation.
    this.pointers.delete(id);
    if ((owner.key === "attack" || owner.key === "special" || owner.key === "jump") && !this.value()[owner.key]) this.cancelled = true;
  }
  clear() { this.keys.clear(); this.pointers.clear(); this.cancelled = true; }
  value(): Input {
    const has = (...keys: string[]) => keys.some(key => this.keys.has(key));
    const value = neutralInput();
    let left = has("a", "arrowleft"), right = has("d", "arrowright");
    value.jump = has(" ", "w", "arrowup");
    value.attack = has("j");
    value.special = has("k");
    value.guard = has("l", "shift");
    for (const pointer of this.pointers.values()) {
      if (pointer.key === "move") {
        left ||= pointer.value === -1;
        right ||= pointer.value === 1;
      } else if (pointer.value === true) value[pointer.key] = true;
    }
    value.move = Number(right) - Number(left);
    value.cancelAttack = this.cancelled;
    return value;
  }
}
