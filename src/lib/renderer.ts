import { TRACK, PlayerState, CHARACTERS } from './types';
import { GameEngine, Obstacle } from './engine';

const JUNGLE_GREEN_DARK = '#1a5c1a';
// const JUNGLE_GREEN = '#2d8c2d';
const TRACK_COLOR = '#c4a060';
const TRACK_BORDER = '#8B7355';
const TRACK_MARKING = '#ffffff44';

export function renderGame(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  engine: GameEngine,
  localPlayer: PlayerState,
  otherPlayers: PlayerState[],
  isBattle: boolean,
  countdownText: string | null
) {
  const W = canvas.width;
  const H = canvas.height;
  const scale = W / TRACK.WIDTH;

  // Screen shake offset
  const shakeX = engine.screenShake * (Math.random() - 0.5) * 2;
  const shakeY = engine.screenShake * (Math.random() - 0.5) * 2;

  ctx.save();
  ctx.translate(shakeX, shakeY);

  // Camera follows local player progress
  const cameraY = localPlayer.progress;

  // Draw background (jungle)
  ctx.fillStyle = JUNGLE_GREEN_DARK;
  ctx.fillRect(0, 0, W, H);

  // Scrolling jungle pattern
  drawJungleBackground(ctx, W, H, cameraY, scale);

  // Draw track
  drawTrack(ctx, W, H, cameraY, scale);

  // Draw obstacles
  drawObstacles(ctx, engine.obstacles, W, H, cameraY, scale, localPlayer);

  // Draw other players
  for (const p of otherPlayers) {
    if (p.character) {
      drawPlayer(ctx, p, W, H, cameraY, scale, false, isBattle);
    }
  }

  // Draw local player
  if (localPlayer.character) {
    drawPlayer(ctx, localPlayer, W, H, cameraY, scale, true, isBattle);
  }

  // Draw particles
  drawParticles(ctx, engine.particles, W, H, cameraY, scale);

  // HUD
  drawHUD(ctx, W, H, localPlayer, isBattle);

  // Countdown overlay
  if (countdownText) {
    drawCountdown(ctx, W, H, countdownText);
  }

  ctx.restore();
}

function drawJungleBackground(ctx: CanvasRenderingContext2D, W: number, H: number, cameraY: number, scale: number) {
  // Scrolling trees/bushes on sides
  const treeSpacing = 120;
  const startY = Math.floor(cameraY / treeSpacing) * treeSpacing - treeSpacing;
  
  for (let y = startY; y < cameraY + H / scale + treeSpacing; y += treeSpacing) {
    const screenY = H - (y - cameraY) * scale - H * 0.3;
    
    // Left side trees
    drawTree(ctx, 15 * scale, screenY, scale);
    // Right side trees
    drawTree(ctx, (TRACK.WIDTH - 15) * scale, screenY, scale);
    
    // Some middle decorative elements between trees
    const midY = screenY + treeSpacing * scale * 0.5;
    drawBush(ctx, 10 * scale, midY, scale * 0.6);
    drawBush(ctx, (TRACK.WIDTH - 10) * scale, midY, scale * 0.6);
  }
}

function drawTree(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  // Trunk
  ctx.fillStyle = '#5D3E1A';
  ctx.fillRect(x - 4 * scale, y - 5 * scale, 8 * scale, 20 * scale);
  // Foliage
  ctx.fillStyle = '#2E8B2E';
  ctx.beginPath();
  ctx.arc(x, y - 8 * scale, 14 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3DA03D';
  ctx.beginPath();
  ctx.arc(x - 4 * scale, y - 5 * scale, 10 * scale, 0, Math.PI * 2);
  ctx.fill();
}

function drawBush(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  ctx.fillStyle = '#228B22';
  ctx.beginPath();
  ctx.arc(x, y, 8 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#32CD32';
  ctx.beginPath();
  ctx.arc(x + 3 * scale, y - 2 * scale, 5 * scale, 0, Math.PI * 2);
  ctx.fill();
}

function drawTrack(ctx: CanvasRenderingContext2D, W: number, H: number, cameraY: number, scale: number) {
  const trackLeft = TRACK.TRACK_LEFT * scale;
  const trackRight = TRACK.TRACK_RIGHT * scale;
  const trackWidth = trackRight - trackLeft;

  // Track border
  ctx.fillStyle = TRACK_BORDER;
  ctx.fillRect(trackLeft - 4 * scale, 0, trackWidth + 8 * scale, H);

  // Track surface
  ctx.fillStyle = TRACK_COLOR;
  ctx.fillRect(trackLeft, 0, trackWidth, H);

  // Lane markings (dashed lines)
  ctx.strokeStyle = TRACK_MARKING;
  ctx.lineWidth = 2;
  ctx.setLineDash([15, 15]);
  
  const lanes = TRACK.LANE_COUNT;
  for (let i = 1; i < lanes; i++) {
    const lx = trackLeft + (trackWidth / lanes) * i;
    const offset = (cameraY * scale) % 30;
    ctx.beginPath();
    for (let y = -30 + offset; y < H + 30; y += 30) {
      ctx.moveTo(lx, y);
      ctx.lineTo(lx, y + 15);
    }
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Track edges (white lines)
  ctx.strokeStyle = '#ffffff88';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(trackLeft, 0);
  ctx.lineTo(trackLeft, H);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(trackRight, 0);
  ctx.lineTo(trackRight, H);
  ctx.stroke();

  // Lap/start line (draws when visible)
  const lapLineY = H - (0 - (cameraY % TRACK.LAP_LENGTH)) * scale - H * 0.3;
  if (lapLineY > -20 && lapLineY < H + 20) {
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 10; i++) {
      const bx = trackLeft + (trackWidth / 10) * i;
      const bw = trackWidth / 10;
      ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#333333';
      ctx.fillRect(bx, lapLineY - 4, bw, 8);
    }
  }
}

function drawObstacles(
  ctx: CanvasRenderingContext2D,
  obstacles: Obstacle[],
  W: number,
  H: number,
  cameraY: number,
  scale: number,
  _localPlayer: PlayerState
) {
  const trackLeft = TRACK.TRACK_LEFT * scale;
  const trackWidth = (TRACK.TRACK_RIGHT - TRACK.TRACK_LEFT) * scale;

  for (const obs of obstacles) {
    const screenY = H - (obs.y - (cameraY % TRACK.LAP_LENGTH)) * scale - H * 0.3;
    if (screenY < -50 || screenY > H + 50) continue;

    const screenX = trackLeft + obs.x * trackWidth;
    const obsWidth = obs.width * trackWidth;

    if (obs.type === 'rock') {
      // Draw rock
      ctx.fillStyle = '#666666';
      ctx.beginPath();
      ctx.ellipse(screenX, screenY, obsWidth / 2, obsWidth / 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#888888';
      ctx.beginPath();
      ctx.ellipse(screenX - obsWidth * 0.1, screenY - obsWidth * 0.1, obsWidth / 3, obsWidth / 4, 0, 0, Math.PI * 2);
      ctx.fill();
      // Rock highlight
      ctx.fillStyle = '#aaaaaa44';
      ctx.beginPath();
      ctx.ellipse(screenX - obsWidth * 0.15, screenY - obsWidth * 0.15, obsWidth / 5, obsWidth / 6, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Draw river
      ctx.fillStyle = '#4488CC88';
      ctx.fillRect(screenX - obsWidth / 2, screenY - 10, obsWidth, 20);
      // Wave pattern
      ctx.strokeStyle = '#66BBFF88';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let wx = screenX - obsWidth / 2; wx < screenX + obsWidth / 2; wx += 8) {
        const wy = screenY + Math.sin((wx + Date.now() * 0.003) * 0.3) * 3;
        if (wx === screenX - obsWidth / 2) ctx.moveTo(wx, wy);
        else ctx.lineTo(wx, wy);
      }
      ctx.stroke();
    }
  }
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
  W: number,
  H: number,
  cameraY: number,
  scale: number,
  isLocal: boolean,
  _isBattle: boolean
) {
  const trackLeft = TRACK.TRACK_LEFT * scale;
  const trackWidth = (TRACK.TRACK_RIGHT - TRACK.TRACK_LEFT) * scale;
  
  const screenX = trackLeft + player.x * trackWidth;
  const relProgress = player.progress - (cameraY % TRACK.LAP_LENGTH);
  const screenY = H - relProgress * scale - H * 0.3;

  // For local player, they're always at a fixed position on screen
  const finalY = isLocal ? H * 0.65 : screenY;
  const finalX = isLocal ? (trackLeft + player.x * trackWidth) : screenX;

  if (!isLocal && (finalY < -50 || finalY > H + 50)) return;

  const charDef = player.character ? CHARACTERS[player.character] : null;
  if (!charDef) return;

  const size = TRACK.PLAYER_SIZE * scale;

  ctx.save();
  ctx.translate(finalX, finalY);

  // Jump effect
  if (player.jumping) {
    ctx.translate(0, -15 * scale);
    // Shadow
    ctx.fillStyle = '#00000033';
    ctx.beginPath();
    ctx.ellipse(0, 15 * scale, size / 2, size / 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Frozen effect
  if (player.frozen) {
    ctx.fillStyle = '#88CCFF44';
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Shield effect
  if (player.shielded) {
    ctx.strokeStyle = '#FF88FF88';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.8, 0, Math.PI * 2);
    ctx.stroke();
    // Rainbow shimmer
    const hue = (Date.now() * 0.5) % 360;
    ctx.strokeStyle = `hsla(${hue}, 100%, 70%, 0.5)`;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.85, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Boost trail
  if (player.boosting) {
    const trailColor = charDef.color;
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = trailColor + Math.floor(40 - i * 8).toString(16).padStart(2, '0');
      ctx.beginPath();
      ctx.arc(
        (Math.random() - 0.5) * 10,
        size / 2 + i * 8,
        size / 3 - i * 2,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  }

  // Character body (circle with color)
  const gradient = ctx.createRadialGradient(0, -size * 0.1, size * 0.1, 0, 0, size / 2);
  gradient.addColorStop(0, charDef.secondaryColor);
  gradient.addColorStop(1, charDef.color);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
  ctx.fill();

  // Character border
  ctx.strokeStyle = '#ffffff88';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Character emoji
  ctx.font = `${size * 0.7}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(charDef.emoji, 0, 0);

  // Hit stun flash
  if (player.hitStun > 0) {
    ctx.fillStyle = '#FF000044';
    ctx.beginPath();
    ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Name tag (for remote players)
  if (!isLocal) {
    ctx.fillStyle = '#ffffffcc';
    ctx.font = `bold ${12 * scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(player.name, 0, -size / 2 - 8 * scale);
  }

  // Direction indicator for local player
  if (isLocal) {
    ctx.fillStyle = '#ffffff44';
    ctx.beginPath();
    ctx.moveTo(0, -size / 2 - 5);
    ctx.lineTo(-6, -size / 2 - 12);
    ctx.lineTo(6, -size / 2 - 12);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

function drawParticles(
  ctx: CanvasRenderingContext2D,
  particles: { x: number; y: number; life: number; color: string; size: number }[],
  W: number,
  H: number,
  cameraY: number,
  scale: number
) {
  for (const p of particles) {
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x * scale, p.y * scale, p.size * scale, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawHUD(ctx: CanvasRenderingContext2D, W: number, H: number, player: PlayerState, isBattle: boolean) {
  const padding = 12;
  const fontSize = 18;

  // Top bar background
  ctx.fillStyle = '#00000088';
  ctx.fillRect(0, 0, W, 50);

  // Lap counter
  const totalLaps = isBattle ? TRACK.BATTLE_LAPS : TRACK.RACE_LAPS;
  const lapText = isBattle
    ? `⚔️ BATTLE LAP ${Math.min(player.lap + 1, totalLaps)}/${totalLaps}`
    : `🏁 Lap ${Math.min(player.lap + 1, totalLaps)}/${totalLaps}`;

  ctx.fillStyle = isBattle ? '#FF4444' : '#ffffff';
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText(lapText, padding, 32);

  // Speed indicator
  const speedPct = Math.round((player.speed / TRACK.BOOST_SPEED) * 100);
  ctx.fillStyle = '#ffffff';
  ctx.font = `${14}px sans-serif`;
  ctx.textAlign = 'right';
  ctx.fillText(`${speedPct}%`, W - padding, 32);

  // Speed bar
  const barW = 60;
  const barH = 6;
  const barX = W - padding - barW;
  const barY = 12;
  ctx.fillStyle = '#333333';
  ctx.fillRect(barX, barY, barW, barH);
  ctx.fillStyle = player.boosting ? '#FFAA00' : '#44FF44';
  ctx.fillRect(barX, barY, barW * (speedPct / 100), barH);
}

function drawCountdown(ctx: CanvasRenderingContext2D, W: number, H: number, text: string) {
  ctx.fillStyle = '#00000066';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 72px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Pulsing effect
  const pulse = 1 + Math.sin(Date.now() * 0.01) * 0.1;
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(pulse, pulse);
  ctx.fillText(text, 0, 0);
  ctx.restore();
}
