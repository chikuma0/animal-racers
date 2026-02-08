import { TRACK, PlayerState } from './types';

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
    const x = 0.15 + rng() * 0.7; // Don't place at very edges
    const width = type === 'river' ? 0.2 + rng() * 0.25 : 0.12 + rng() * 0.18;
    obstacles.push({ type, x, y: offset, width });

    // Sometimes add a second obstacle in a row for variety
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
  type?: 'spark' | 'trail' | 'ring' | 'speed';
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

  // Update local player physics
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
              // Bounce off solid objects
              p.x += (p.x > obs.x ? 0.08 : -0.08);
              p.speed *= 0.5;
              p.hitStun = 300;
              this.addShake(6);
              this.soundFX.hit();
            } else if (obs.type === 'river' || obs.type === 'mud') {
              // Slow down
              p.speed *= 0.3;
              p.hitStun = 400;
            } else if (obs.type === 'bush') {
              // Minor slow
              p.speed *= 0.6;
              p.hitStun = 200;
            }
          }
        }
      }
    }

    return p;
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

  // Continuous trail particles for boosting
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
      p.life -= dtSec / p.maxLife;
      p.size *= 0.97;
      return p.life > 0;
    });
    // Decay screen shake
    this.screenShake *= 0.88;
    if (this.screenShake < 0.5) this.screenShake = 0;
  }
}
