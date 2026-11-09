import { neutralInput, QUICK_ATTACKS, type Input, type Match } from './simulation';

/** One tap requests one approach-and-strike, never an autonomous fight. */
export class ChildControls {
  private wasPressed = false;
  private until = 0;
  private phase = '';
  get approaching() { return this.until > 0; }
  clear() { this.until = 0; this.wasPressed = false; this.phase = ''; }
  update(raw: Input, match: Match | null, slot: 0 | 1, now: number): Input {
    if (match?.phase !== 'fight') {
      this.until = 0; this.wasPressed = raw.attack; this.phase = match?.phase ?? '';
      return raw;
    }
    if (this.phase !== 'fight') { this.until = 0; this.wasPressed = raw.attack; this.phase = 'fight'; }
    const tap = raw.attack && !this.wasPressed;
    this.wasPressed = raw.attack;
    const out = neutralInput(); out.move = raw.move;
    if (raw.cancelAttack) { this.until = 0; out.cancelAttack = true; return out; }
    if (raw.move !== 0) {
      this.until = 0;
      // Steering cancels automatic approach, but a fresh punch still responds.
      if (tap) {
        const rival = match.players[slot === 0 ? 1 : 0];
        if (rival.action === 'guard' || rival.ward) out.special = true;
        else out.attack = true;
      }
      return out;
    }
    if (tap) this.until = now + 2600;
    if (!this.until || now > this.until) { this.until = 0; return out; }
    const player = match.players[slot], rival = match.players[slot === 0 ? 1 : 0];
    if (player.hp <= 0 || rival.hp <= 0) { this.until = 0; return out; }
    const distance = Math.abs(rival.x - player.x);
    if (distance > QUICK_ATTACKS[player.character].reach - .04) {
      out.move = Math.sign(rival.x - player.x); return out;
    }
    // Wait for recovery, or use the existing deliberate second-hit window.
    if (player.stun > 0 || (player.action === 'attack' && player.comboWindow <= 0)) return out;
    if (player.comboWindow > 0) out.attack = true;
    else if (rival.action === 'guard' || rival.ward) out.special = true;
    else out.attack = true;
    this.until = 0;
    return out;
  }
}
