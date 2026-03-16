import { describe, expect, it } from 'vitest';

import { GameEngine } from './engine';
import { createDefaultFightState } from './types';

describe('fight damage rules', () => {
  it('consumes shield and blocks freeze specials', () => {
    const engine = new GameEngine();
    const defender = createDefaultFightState();
    defender.blockTimer = 3000;

    const updated = engine.applyFightDamage(defender, 0, 100, true);

    expect(updated.blockTimer).toBe(0);
    expect(updated.freezeTimer).toBe(0);
    expect(updated.hp).toBe(100);
  });

  it('applies knockback away from the attacker', () => {
    const engine = new GameEngine();
    const defender = createDefaultFightState();
    defender.fx = 200;

    const fromLeft = engine.applyFightDamage(defender, 10, 100, false);
    const fromRight = engine.applyFightDamage(defender, 10, 260, false);

    expect(fromLeft.knockbackVx).toBe(6);
    expect(fromRight.knockbackVx).toBe(-6);
  });
});
