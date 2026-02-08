import { TRACK, ARENA, PlayerState, CHARACTERS, FightState, createDefaultFightState } from './types';

// Obstacle types
export interface Obstacle {
  type: 'rock' | 'river' | 'log' | 'mud' | 'bush';
  x: number;       // center x position (0-1 across track)
  y: number;       // distance along track
  width: number;   // 0-1 of track width
}

// Generate obstacles for the track (deterministic based on seed)
export function generateObstacles(seed: number): Obstacle[] {
  const obstacles: Obstacle[] = [];
  const rng = mulberry32(seed);

  const types: Obstacle['type'][] = ['rock', 'river', 'log', 'mud', 'bush'];

  for (let i = 0; i < TRACK.LAP_LENGTH; i += TRACK.OBSTACLE_INTERVAL) {
    const offset = i + rng() * TRACK.OBSTACLE_INTERVAL * 0.5;
    const typeIdx = Math.floor(rng() * types.length);
    const type = types[typeIdx];
    const x = 0.15 + rng() * 0.7;
    const width = type === 'river' ? 0.2 + rng() * 0.25 : 0.12 + rng() * 0.18;
    obstacles.push({ type, x, y: offset, width });

    if (rng() > 0.65) {
      const x2 = 0.15 + rng() * 0.7;
      const type2 = types[Math.floor(rng() * types.length)];
      obstacles.push({ type: type2, x: x2, y: offset + 80 + rng() * 60, width: 0.10 + rng() * 0.15 });
    }
  }

  return obstacles;
}

// Simple seeded RNG
function mulberry32(a: number) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  type?: 'spark' | 'trail' | 'ring' | 'speed' | 'fight';
}

// Simple synth sound system
export class SoundFX {
  private ctx: AudioContext | null = null;
  private enabled = true;

  private getCtx(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        this.enabled = false;
        return null;
      }
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  playTone(freq: number, duration: number, type: OscillatorType = 'square', volume = 0.12) {
    const ctx = this.getCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  }

  boost() {
    this.playTone(220, 0.08, 'sawtooth', 0.10);
    setTimeout(() => this.playTone(440, 0.12, 'sawtooth', 0.08), 50);
    setTimeout(() => this.playTone(660, 0.15, 'square', 0.06), 100);
  }

  jump() {
    this.playTone(300, 0.06, 'sine', 0.10);
    setTimeout(() => this.playTone(500, 0.06, 'sine', 0.08), 40);
    setTimeout(() => this.playTone(700, 0.08, 'sine', 0.06), 80);
  }

  hit() {
    this.playTone(120, 0.15, 'sawtooth', 0.15);
    this.playTone(80, 0.2, 'square', 0.10);
  }

  lap() {
    this.playTone(523, 0.1, 'square', 0.10);
    setTimeout(() => this.playTone(659, 0.1, 'square', 0.10), 100);
    setTimeout(() => this.playTone(784, 0.15, 'square', 0.08), 200);
  }

  attack() {
    this.playTone(180, 0.08, 'sawtooth', 0.12);
    setTimeout(() => this.playTone(360, 0.1, 'square', 0.10), 60);
  }

  countdown() {
    this.playTone(440, 0.15, 'square', 0.08);
  }

  go() {
    this.playTone(523, 0.1, 'square', 0.10);
    setTimeout(() => this.playTone(784, 0.2, 'square', 0.10), 120);
  }

  punch() {
    this.playTone(200, 0.06, 'sawtooth', 0.15);
    this.playTone(100, 0.1, 'square', 0.12);
  }

  special() {
    this.playTone(300, 0.1, 'sawtooth', 0.12);
    setTimeout(() => this.playTone(600, 0.15, 'square', 0.10), 80);
    setTimeout(() => this.playTone(900, 0.2, 'sine', 0.08), 160);
  }

  ko() {
    this.playTone(400, 0.15, 'square', 0.15);
    setTimeout(() => this.playTone(300, 0.15, 'square', 0.12), 150);
    setTimeout(() => this.playTone(200, 0.2, 'sawtooth', 0.10), 300);
    setTimeout(() => this.playTone(100, 0.3, 'sawtooth', 0.08), 450);
  }

  block() {
    this.playTone(800, 0.05, 'sine', 0.10);
    this.playTone(1000, 0.08, 'sine', 0.08);
  }

  freeze() {
    this.playTone(1200, 0.1, 'sine', 0.08);
    setTimeout(() => this.playTone(1400, 0.15, 'sine', 0.06), 80);
  }
}

export class GameEngine {
  obstacles: Obstacle[];
  particles: Particle[] = [];
  screenShake = 0;
  trackSeed = 42;
  soundFX = new SoundFX();

  constructor() {
    this.obstacles = generateObstacles(this.trackSeed);
  }

  resetTrack(seed: number) {
    this.trackSeed = seed;
    this.obstacles = generateObstacles(seed);
    this.particles = [];
    this.screenShake = 0;
  }

  // Update local player physics (racing)
  updatePlayer(
    player: PlayerState,
    dt: number,
    tiltX: number,
    isBoosting: boolean,
    isJumping: boolean,
    isBattle: boolean,
    now: number
  ): PlayerState {
    const p = { ...player };

    // Frozen? Can't move
    if (p.frozen) {
      return p;
    }

    // Calculate speed
    let speed = TRACK.BASE_SPEED;
    if (p.hitStun > 0) {
      speed *= TRACK.HIT_SLOW_FACTOR;
      p.hitStun -= dt;
      if (p.hitStun < 0) p.hitStun = 0;
    }
    if (p.boosting) {
      speed = TRACK.BOOST_SPEED;
    }

    // Move forward
    p.progress += speed * dt * 0.06;
    p.speed = speed;

    // Lateral movement from tilt
    const lateralSpeed = 0.002 * dt;
    p.x += tiltX * lateralSpeed;
    p.x = Math.max(0.05, Math.min(0.95, p.x));

    // Check lap completion
    const lapLength = TRACK.LAP_LENGTH;
    const totalLaps = isBattle ? TRACK.BATTLE_LAPS : TRACK.RACE_LAPS;
    if (p.progress >= lapLength) {
      p.progress -= lapLength;
      p.lap += 1;
      this.soundFX.lap();
      if (p.lap >= totalLaps) {
        if (isBattle) {
          p.battleFinished = true;
          p.battleFinishTime = now;
        } else {
          p.finished = true;
          p.finishTime = now;
        }
      }
    }

    // Obstacle collision (only if not jumping)
    if (!p.jumping) {
      const playerTrackY = p.progress % lapLength;
      for (const obs of this.obstacles) {
        const dy = Math.abs(playerTrackY - obs.y);
        if (dy < 30) {
          const dx = Math.abs(p.x - obs.x);
          if (dx < obs.width / 2 + 0.05) {
            if (obs.type === 'rock' || obs.type === 'log') {
              p.x += (p.x > obs.x ? 0.08 : -0.08);
              p.speed *= 0.5;
              p.hitStun = 300;
              this.addShake(6);
              this.soundFX.hit();
            } else if (obs.type === 'river' || obs.type === 'mud') {
              p.speed *= 0.3;
              p.hitStun = 400;
            } else if (obs.type === 'bush') {
              p.speed *= 0.6;
              p.hitStun = 200;
            }
          }
        }
      }
    }

    return p;
  }

  // ===== FIGHTING GAME ENGINE =====

  initFightState(playerIndex: number, totalPlayers: number): FightState {
    const state = createDefaultFightState();
    // Space players across arena
    const spacing = ARENA.WIDTH / (totalPlayers + 1);
    state.fx = spacing * (playerIndex + 1);
    state.fy = ARENA.GROUND_Y;
    state.grounded = true;
    state.facing = playerIndex === 0 ? 1 : -1;
    return state;
  }

  updateFighter(
    fight: FightState,
    dt: number,
    moveX: number,      // -1 left, 0 none, 1 right
    jumpPressed: boolean,
    punchPressed: boolean,
    specialPressed: boolean,
    character: string,
  ): FightState {
    const f = { ...fight };
    if (f.dead) return f;

    // Decrease timers
    f.punchCooldown = Math.max(0, f.punchCooldown - dt);
    f.specialCooldown = Math.max(0, f.specialCooldown - dt);
    f.punchTimer = Math.max(0, f.punchTimer - dt);
    f.specialTimer = Math.max(0, f.specialTimer - dt);
    f.blockTimer = Math.max(0, f.blockTimer - dt);
    f.freezeTimer = Math.max(0, f.freezeTimer - dt);
    f.hitStunTimer = Math.max(0, f.hitStunTimer - dt);
    f.dashTimer = Math.max(0, f.dashTimer - dt);
    f.invulnTimer = Math.max(0, f.invulnTimer - dt);

    if (f.punchTimer <= 0) f.punching = false;
    if (f.specialTimer <= 0) f.specialActive = false;
    if (f.dashTimer <= 0) f.dashActive = false;

    // Frozen: can't act
    if (f.freezeTimer > 0) return f;

    // Hit stun: can't act but physics still apply
    if (f.hitStunTimer > 0) {
      // Apply knockback
      f.fx += f.knockbackVx * (dt / 16);
      f.knockbackVx *= 0.9;

      // Apply gravity
      if (!f.grounded) {
        f.fvy += ARENA.GRAVITY * (dt / 16);
        f.fy += f.fvy * (dt / 16);
        if (f.fy >= ARENA.GROUND_Y) {
          f.fy = ARENA.GROUND_Y;
          f.fvy = 0;
          f.grounded = true;
        }
      }

      // Clamp position
      f.fx = Math.max(ARENA.PLAYER_WIDTH / 2, Math.min(ARENA.WIDTH - ARENA.PLAYER_WIDTH / 2, f.fx));
      return f;
    }

    // Movement
    if (moveX !== 0 && !f.dashActive) {
      f.fvx = moveX * ARENA.MOVE_SPEED;
      f.facing = moveX > 0 ? 1 : -1;
    } else if (!f.dashActive) {
      f.fvx *= 0.8; // friction
      if (Math.abs(f.fvx) < 0.1) f.fvx = 0;
    }

    // Fire dash movement
    if (f.dashActive) {
      f.fvx = f.facing * 8;
    }

    f.fx += f.fvx * (dt / 16);

    // Jump
    if (jumpPressed && f.grounded && !f.dashActive) {
      f.fvy = ARENA.JUMP_FORCE;
      f.grounded = false;
      this.soundFX.jump();
    }

    // Gravity
    if (!f.grounded) {
      f.fvy += ARENA.GRAVITY * (dt / 16);
      f.fy += f.fvy * (dt / 16);
      if (f.fy >= ARENA.GROUND_Y) {
        f.fy = ARENA.GROUND_Y;
        f.fvy = 0;
        f.grounded = true;
      }
    }

    // Clamp position
    f.fx = Math.max(ARENA.PLAYER_WIDTH / 2, Math.min(ARENA.WIDTH - ARENA.PLAYER_WIDTH / 2, f.fx));

    // Punch
    if (punchPressed && f.punchCooldown <= 0 && !f.punching && !f.dashActive) {
      const charDef = CHARACTERS[character as keyof typeof CHARACTERS];
      f.punching = true;
      f.punchTimer = 200; // punch animation duration
      f.punchCooldown = charDef?.punchSpeed || 400;
      this.soundFX.punch();
    }

    // Special
    if (specialPressed && f.specialCooldown <= 0 && !f.specialActive) {
      const charDef = CHARACTERS[character as keyof typeof CHARACTERS];
      f.specialActive = true;
      f.specialTimer = 500;
      f.specialCooldown = charDef?.specialCooldown || 4000;
      this.soundFX.special();

      if (character === 'lion') {
        // Fire dash: charge across screen
        f.dashActive = true;
        f.dashTimer = 400;
        this.addShake(10);
      } else if (character === 'unicorn') {
        // Rainbow shield
        f.blockTimer = 3000;
      }
      // Wolf ice howl is handled by hit detection
    }

    return f;
  }

  // Check if attacker's punch/special hits defender
  checkFightHit(
    attacker: FightState,
    attackerChar: string,
    defender: FightState,
  ): { hit: boolean; damage: number; type: 'punch' | 'special'; freeze?: boolean } | null {
    if (defender.dead || defender.invulnTimer > 0) return null;

    const charDef = CHARACTERS[attackerChar as keyof typeof CHARACTERS];
    if (!charDef) return null;

    const dx = defender.fx - attacker.fx;
    const dy = Math.abs(defender.fy - attacker.fy);

    // Punch hit detection
    if (attacker.punching && attacker.punchTimer > 100) { // only first half of animation
      const inFront = (attacker.facing === 1 && dx > 0) || (attacker.facing === -1 && dx < 0);
      const dist = Math.abs(dx);
      if (inFront && dist < charDef.punchRange && dy < 50) {
        return { hit: true, damage: charDef.punchDamage, type: 'punch' };
      }
    }

    // Special hit detection
    if (attacker.specialActive && attacker.specialTimer > 200) {
      if (attackerChar === 'lion' && attacker.dashActive) {
        // Fire dash: wider hitbox during dash
        const dist = Math.abs(dx);
        if (dist < 70 && dy < 50) {
          return { hit: true, damage: charDef.specialDamage, type: 'special' };
        }
      } else if (attackerChar === 'wolf') {
        // Ice howl: medium range, freezes
        const dist = Math.abs(dx);
        if (dist < 120 && dy < 60) {
          return { hit: true, damage: 0, type: 'special', freeze: true };
        }
      }
      // Unicorn special is a shield, doesn't deal damage
    }

    return null;
  }

  // Apply damage to defender
  applyFightDamage(
    defender: FightState,
    damage: number,
    attackerX: number,
    freeze: boolean,
  ): FightState {
    const d = { ...defender };

    // Unicorn shield blocks
    if (d.blockTimer > 0 && damage > 0) {
      d.blockTimer = 0; // shield consumed
      this.soundFX.block();
      this.addShake(3);
      return d;
    }

    if (freeze) {
      d.freezeTimer = 2000; // 2 seconds frozen
      this.soundFX.freeze();
      this.addShake(5);
      return d;
    }

    d.hp = Math.max(0, d.hp - damage);
    d.hitStunTimer = 300;
    d.invulnTimer = 500; // brief invulnerability
    d.knockbackVx = attackerX < d.fx ? 6 : -6;
    d.fvy = -4; // slight upward pop

    if (d.hp <= 0) {
      d.dead = true;
      this.soundFX.ko();
    } else {
      this.soundFX.hit();
    }
    this.addShake(8);

    return d;
  }

  addShake(amount: number) {
    this.screenShake = Math.max(this.screenShake, amount);
  }

  addParticles(x: number, y: number, color: string, count: number, type: Particle['type'] = 'spark') {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * (type === 'speed' ? 1 : 5),
        vy: type === 'speed' ? (Math.random() * 3 + 2) : (Math.random() - 0.5) * 5 - 2,
        life: 1,
        maxLife: type === 'speed' ? 0.3 + Math.random() * 0.2 : 0.5 + Math.random() * 0.5,
        color,
        size: type === 'speed' ? 2 + Math.random() * 2 : 3 + Math.random() * 6,
        type,
      });
    }
  }

  addFightParticles(x: number, y: number, color: string, count: number) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8 - 3,
        life: 1,
        maxLife: 0.3 + Math.random() * 0.4,
        color,
        size: 4 + Math.random() * 8,
        type: 'fight',
      });
    }
  }

  addTrailParticle(x: number, y: number, color: string) {
    this.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 2,
      vy: Math.random() * 3 + 1,
      life: 1,
      maxLife: 0.3 + Math.random() * 0.2,
      color,
      size: 4 + Math.random() * 4,
      type: 'trail',
    });
  }

  updateParticles(dt: number) {
    const dtSec = dt / 1000;
    this.particles = this.particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.type === 'fight') {
        p.vy += 0.2; // gravity for fight particles
      }
      p.life -= dtSec / p.maxLife;
      p.size *= 0.97;
      return p.life > 0;
    });
    // Decay screen shake
    this.screenShake *= 0.88;
    if (this.screenShake < 0.5) this.screenShake = 0;
  }
}
