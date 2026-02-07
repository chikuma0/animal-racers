import { TRACK, PlayerState } from './types';

// Obstacle types
export interface Obstacle {
  type: 'rock' | 'river';
  x: number;       // center x position (0-1 across track)
  y: number;       // distance along track
  width: number;   // 0-1 of track width
}

// Generate obstacles for the track (deterministic based on seed)
export function generateObstacles(seed: number): Obstacle[] {
  const obstacles: Obstacle[] = [];
  const rng = mulberry32(seed);

  for (let i = 0; i < TRACK.LAP_LENGTH; i += TRACK.OBSTACLE_INTERVAL) {
    const offset = i + rng() * TRACK.OBSTACLE_INTERVAL * 0.5;
    const type = rng() > 0.5 ? 'rock' : 'river';
    const x = 0.15 + rng() * 0.7; // Don't place at very edges
    const width = 0.15 + rng() * 0.2;
    obstacles.push({ type, x, y: offset, width });
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
}

export class GameEngine {
  obstacles: Obstacle[];
  particles: Particle[] = [];
  screenShake = 0;
  trackSeed = 42;

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
    const lateralSpeed = 0.0015 * dt;
    p.x += tiltX * lateralSpeed;
    p.x = Math.max(0.05, Math.min(0.95, p.x));

    // Check lap completion
    const lapLength = TRACK.LAP_LENGTH;
    const totalLaps = isBattle ? TRACK.BATTLE_LAPS : TRACK.RACE_LAPS;
    if (p.progress >= lapLength) {
      p.progress -= lapLength;
      p.lap += 1;
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
            if (obs.type === 'rock') {
              // Bounce off rock
              p.x += (p.x > obs.x ? 0.08 : -0.08);
              p.speed *= 0.5;
              p.hitStun = 300;
              this.addShake(5);
            } else if (obs.type === 'river') {
              // Slow down in river
              p.speed *= 0.3;
              p.hitStun = 500;
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

  addParticles(x: number, y: number, color: string, count: number) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4 - 2,
        life: 1,
        maxLife: 0.5 + Math.random() * 0.5,
        color,
        size: 3 + Math.random() * 5,
      });
    }
  }

  updateParticles(dt: number) {
    const dtSec = dt / 1000;
    this.particles = this.particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= dtSec / p.maxLife;
      p.size *= 0.98;
      return p.life > 0;
    });
    // Decay screen shake
    this.screenShake *= 0.9;
    if (this.screenShake < 0.5) this.screenShake = 0;
  }
}
