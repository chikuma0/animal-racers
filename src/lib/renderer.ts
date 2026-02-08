import { TRACK, PlayerState, CHARACTERS, CharacterId } from './types';
import { GameEngine, Obstacle } from './engine';

const JUNGLE_GREEN_DARK = '#0f3f0f';
const TRACK_COLOR = '#c4a060';
const TRACK_BORDER = '#8B7355';
const TRACK_MARKING = '#ffffff55';

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
  drawJungleBackground(ctx, W, H, cameraY, scale);

  // Draw speed lines on edges when going fast
  drawSpeedLines(ctx, W, H, localPlayer.speed, scale);

  // Draw track
  drawTrack(ctx, W, H, cameraY, scale);

  // Draw obstacles
  drawObstacles(ctx, engine.obstacles, W, H, cameraY, scale);

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

  // Boost flash overlay
  if (localPlayer.boosting) {
    ctx.fillStyle = 'rgba(255, 200, 50, 0.06)';
    ctx.fillRect(0, 0, W, H);
  }

  // HUD
  drawHUD(ctx, W, H, localPlayer, isBattle);

  // Countdown overlay
  if (countdownText) {
    drawCountdown(ctx, W, H, countdownText);
  }

  ctx.restore();
}

function drawSpeedLines(ctx: CanvasRenderingContext2D, W: number, H: number, speed: number, scale: number) {
  const intensity = Math.max(0, (speed - TRACK.BASE_SPEED * 0.8) / (TRACK.BOOST_SPEED - TRACK.BASE_SPEED * 0.8));
  if (intensity <= 0) return;

  const lineCount = Math.floor(intensity * 12);
  const trackLeft = TRACK.TRACK_LEFT * scale;
  const trackRight = TRACK.TRACK_RIGHT * scale;

  ctx.save();
  ctx.globalAlpha = intensity * 0.5;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;

  const t = Date.now() * 0.01;
  for (let i = 0; i < lineCount; i++) {
    const side = i % 2 === 0 ? 'left' : 'right';
    const baseX = side === 'left' ? trackLeft - 5 - Math.random() * 15 : trackRight + 5 + Math.random() * 15;
    const y = ((t * 50 + i * (H / lineCount)) % (H + 60)) - 30;
    const len = 30 + Math.random() * 50 * intensity;

    ctx.beginPath();
    ctx.moveTo(baseX, y);
    ctx.lineTo(baseX, y + len);
    ctx.stroke();
  }
  ctx.restore();
}

function drawJungleBackground(ctx: CanvasRenderingContext2D, W: number, H: number, cameraY: number, scale: number) {
  // Gradient sky/jungle
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#0a2f0a');
  grad.addColorStop(0.5, JUNGLE_GREEN_DARK);
  grad.addColorStop(1, '#1a4f1a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Scrolling trees/bushes on sides
  const treeSpacing = 100;
  const startY = Math.floor(cameraY / treeSpacing) * treeSpacing - treeSpacing;

  for (let y = startY; y < cameraY + H / scale + treeSpacing; y += treeSpacing) {
    const screenY = H - (y - cameraY) * scale - H * 0.3;

    // Left side trees
    drawTree(ctx, 15 * scale, screenY, scale, y);
    // Right side trees
    drawTree(ctx, (TRACK.WIDTH - 15) * scale, screenY, scale, y + 50);

    // Decorative bushes & flowers between trees
    const midY = screenY + treeSpacing * scale * 0.5;
    drawBush(ctx, 8 * scale, midY, scale * 0.6);
    drawBush(ctx, (TRACK.WIDTH - 8) * scale, midY, scale * 0.6);

    // Occasional flowers
    if (Math.sin(y * 0.1) > 0.3) {
      drawFlower(ctx, 20 * scale, screenY + 30 * scale, scale);
    }
    if (Math.cos(y * 0.13) > 0.3) {
      drawFlower(ctx, (TRACK.WIDTH - 20) * scale, screenY - 20 * scale, scale);
    }
  }
}

function drawFlower(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  const colors = ['#FF6B9D', '#FFD93D', '#6BCB77', '#FF8C42'];
  const c = colors[Math.floor(Math.abs(Math.sin(x * y)) * colors.length)];
  ctx.fillStyle = c;
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(x + Math.cos(angle) * 3 * scale, y + Math.sin(angle) * 3 * scale, 2.5 * scale, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#FFE66D';
  ctx.beginPath();
  ctx.arc(x, y, 2 * scale, 0, Math.PI * 2);
  ctx.fill();
}

function drawTree(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, seed: number) {
  // Trunk
  ctx.fillStyle = '#4A2E0A';
  ctx.fillRect(x - 4 * scale, y - 5 * scale, 8 * scale, 22 * scale);
  // Foliage layers
  const hue = 100 + Math.sin(seed) * 20;
  ctx.fillStyle = `hsl(${hue}, 60%, 28%)`;
  ctx.beginPath();
  ctx.arc(x, y - 10 * scale, 16 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `hsl(${hue + 10}, 65%, 35%)`;
  ctx.beginPath();
  ctx.arc(x - 5 * scale, y - 6 * scale, 11 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `hsl(${hue + 20}, 60%, 40%)`;
  ctx.beginPath();
  ctx.arc(x + 4 * scale, y - 12 * scale, 9 * scale, 0, Math.PI * 2);
  ctx.fill();
}

function drawBush(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  ctx.fillStyle = '#1E6F1E';
  ctx.beginPath();
  ctx.arc(x, y, 9 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2DA02D';
  ctx.beginPath();
  ctx.arc(x + 4 * scale, y - 2 * scale, 6 * scale, 0, Math.PI * 2);
  ctx.fill();
}

function drawTrack(ctx: CanvasRenderingContext2D, W: number, H: number, cameraY: number, scale: number) {
  const trackLeft = TRACK.TRACK_LEFT * scale;
  const trackRight = TRACK.TRACK_RIGHT * scale;
  const trackWidth = trackRight - trackLeft;

  // Track border (wider, darker)
  ctx.fillStyle = TRACK_BORDER;
  ctx.fillRect(trackLeft - 5 * scale, 0, trackWidth + 10 * scale, H);

  // Track surface
  ctx.fillStyle = TRACK_COLOR;
  ctx.fillRect(trackLeft, 0, trackWidth, H);

  // Subtle texture stripes
  ctx.globalAlpha = 0.06;
  for (let i = 0; i < 8; i++) {
    const sx = trackLeft + (trackWidth / 8) * i;
    ctx.fillStyle = i % 2 === 0 ? '#000000' : '#ffffff';
    ctx.fillRect(sx, 0, trackWidth / 8, H);
  }
  ctx.globalAlpha = 1;

  // Lane markings (dashed lines, brighter)
  ctx.strokeStyle = TRACK_MARKING;
  ctx.lineWidth = 2.5;
  ctx.setLineDash([18, 12]);

  const lanes = TRACK.LANE_COUNT;
  for (let i = 1; i < lanes; i++) {
    const lx = trackLeft + (trackWidth / lanes) * i;
    const offset = (cameraY * scale) % 30;
    ctx.beginPath();
    for (let y = -30 + offset; y < H + 30; y += 30) {
      ctx.moveTo(lx, y);
      ctx.lineTo(lx, y + 18);
    }
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Track edges (bright white lines)
  ctx.strokeStyle = '#ffffffaa';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(trackLeft, 0);
  ctx.lineTo(trackLeft, H);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(trackRight, 0);
  ctx.lineTo(trackRight, H);
  ctx.stroke();

  // Alternating edge chevrons for extra visibility
  ctx.fillStyle = '#ff000044';
  const chevronSize = 12 * scale;
  const chevronOffset = (cameraY * scale) % (chevronSize * 2);
  for (let y = -chevronSize * 2 + chevronOffset; y < H + chevronSize * 2; y += chevronSize * 2) {
    // Left
    ctx.fillStyle = '#ff000033';
    ctx.fillRect(trackLeft - 5 * scale, y, 5 * scale, chevronSize);
    ctx.fillStyle = '#ffffff33';
    ctx.fillRect(trackLeft - 5 * scale, y + chevronSize, 5 * scale, chevronSize);
    // Right
    ctx.fillStyle = '#ff000033';
    ctx.fillRect(trackRight, y, 5 * scale, chevronSize);
    ctx.fillStyle = '#ffffff33';
    ctx.fillRect(trackRight, y + chevronSize, 5 * scale, chevronSize);
  }

  // Lap/start line (draws when visible)
  const lapLineY = H - (0 - (cameraY % TRACK.LAP_LENGTH)) * scale - H * 0.3;
  if (lapLineY > -20 && lapLineY < H + 20) {
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 12; i++) {
      const bx = trackLeft + (trackWidth / 12) * i;
      const bw = trackWidth / 12;
      ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#222222';
      ctx.fillRect(bx, lapLineY - 5, bw, 10);
    }
  }
}

function drawObstacles(
  ctx: CanvasRenderingContext2D,
  obstacles: Obstacle[],
  W: number,
  H: number,
  cameraY: number,
  scale: number
) {
  const trackLeft = TRACK.TRACK_LEFT * scale;
  const trackWidth = (TRACK.TRACK_RIGHT - TRACK.TRACK_LEFT) * scale;

  for (const obs of obstacles) {
    const screenY = H - (obs.y - (cameraY % TRACK.LAP_LENGTH)) * scale - H * 0.3;
    if (screenY < -50 || screenY > H + 50) continue;

    const screenX = trackLeft + obs.x * trackWidth;
    const obsWidth = obs.width * trackWidth;

    if (obs.type === 'rock') {
      // Rock with shadow
      ctx.fillStyle = '#55555544';
      ctx.beginPath();
      ctx.ellipse(screenX + 3, screenY + 3, obsWidth / 2, obsWidth / 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#666666';
      ctx.beginPath();
      ctx.ellipse(screenX, screenY, obsWidth / 2, obsWidth / 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#888888';
      ctx.beginPath();
      ctx.ellipse(screenX - obsWidth * 0.1, screenY - obsWidth * 0.08, obsWidth / 3, obsWidth / 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#aaaaaa44';
      ctx.beginPath();
      ctx.ellipse(screenX - obsWidth * 0.15, screenY - obsWidth * 0.12, obsWidth / 5, obsWidth / 6, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (obs.type === 'river') {
      ctx.fillStyle = '#3377BB88';
      ctx.fillRect(screenX - obsWidth / 2, screenY - 12, obsWidth, 24);
      // Wave pattern
      ctx.strokeStyle = '#66CCFF88';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let wx = screenX - obsWidth / 2; wx < screenX + obsWidth / 2; wx += 6) {
        const wy = screenY + Math.sin((wx + Date.now() * 0.004) * 0.35) * 4;
        if (wx === screenX - obsWidth / 2) ctx.moveTo(wx, wy);
        else ctx.lineTo(wx, wy);
      }
      ctx.stroke();
      // Sparkle
      ctx.fillStyle = '#ffffff44';
      const sparkT = Date.now() * 0.003;
      ctx.beginPath();
      ctx.arc(screenX + Math.sin(sparkT) * obsWidth * 0.3, screenY + Math.cos(sparkT * 1.3) * 5, 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (obs.type === 'log') {
      // Fallen log
      ctx.fillStyle = '#5D3E1A';
      const logH = 10;
      ctx.fillRect(screenX - obsWidth / 2, screenY - logH / 2, obsWidth, logH);
      // Log rings
      ctx.strokeStyle = '#4A2E0A';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(screenX - obsWidth / 2, screenY, logH / 2, logH / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#6B4A1A';
      ctx.beginPath();
      ctx.ellipse(screenX - obsWidth / 2, screenY, logH / 2, logH / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (obs.type === 'mud') {
      // Mud puddle
      ctx.fillStyle = '#6B4A1A88';
      ctx.beginPath();
      ctx.ellipse(screenX, screenY, obsWidth / 2, obsWidth / 4, 0, 0, Math.PI * 2);
      ctx.fill();
      // Mud bubbles
      ctx.fillStyle = '#5D3E1A66';
      const bubT = Date.now() * 0.002;
      ctx.beginPath();
      ctx.arc(screenX + Math.sin(bubT) * 8, screenY + Math.cos(bubT * 0.7) * 4, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (obs.type === 'bush') {
      // Small bush obstacle
      ctx.fillStyle = '#2E7D2E';
      ctx.beginPath();
      ctx.arc(screenX, screenY, obsWidth / 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3DA03D';
      ctx.beginPath();
      ctx.arc(screenX + 4, screenY - 3, obsWidth / 3.5, 0, Math.PI * 2);
      ctx.fill();
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

  const finalY = isLocal ? H * 0.65 : screenY;
  const finalX = isLocal ? (trackLeft + player.x * trackWidth) : screenX;

  if (!isLocal && (finalY < -60 || finalY > H + 60)) return;

  const charDef = player.character ? CHARACTERS[player.character] : null;
  if (!charDef) return;

  const size = TRACK.PLAYER_SIZE * scale;
  const t = Date.now() * 0.001;

  // Boost size pulse
  const boostPulse = player.boosting ? 1 + Math.sin(t * 20) * 0.08 : 1;

  ctx.save();
  ctx.translate(finalX, finalY);
  ctx.scale(boostPulse, boostPulse);

  // Jump effect
  if (player.jumping) {
    ctx.translate(0, -20 * scale);
    // Shadow below
    ctx.fillStyle = '#00000033';
    ctx.beginPath();
    ctx.ellipse(0, 20 * scale, size / 2, size / 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Local player ground glow
  if (isLocal && !player.jumping) {
    const glowGrad = ctx.createRadialGradient(0, size * 0.3, 0, 0, size * 0.3, size * 0.8);
    glowGrad.addColorStop(0, charDef.color + '44');
    glowGrad.addColorStop(1, charDef.color + '00');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.ellipse(0, size * 0.3, size * 0.8, size * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Frozen effect
  if (player.frozen) {
    ctx.fillStyle = '#88CCFF55';
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.85, 0, Math.PI * 2);
    ctx.fill();
    // Ice crystals
    ctx.strokeStyle = '#aaddff88';
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + t;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(angle) * size * 0.7, Math.sin(angle) * size * 0.7);
      ctx.stroke();
    }
  }

  // Shield effect
  if (player.shielded) {
    const hue = (Date.now() * 0.5) % 360;
    ctx.strokeStyle = `hsla(${hue}, 100%, 70%, 0.6)`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `hsla(${hue + 60}, 100%, 80%, 0.4)`;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.9, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Boost trail
  if (player.boosting) {
    drawBoostTrail(ctx, player.character!, size, t);
  }

  // Draw character body
  drawCharacterBody(ctx, player.character!, size, t, player.speed, player.boosting);

  // Hit stun flash
  if (player.hitStun > 0) {
    ctx.fillStyle = '#FF000055';
    ctx.beginPath();
    ctx.arc(0, 0, size / 2 + 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Name tag (for remote players)
  if (!isLocal) {
    ctx.fillStyle = '#000000aa';
    const tw = ctx.measureText(player.name).width;
    ctx.fillRect(-tw / 2 - 4, -size / 2 - 22 * scale, tw + 8, 16 * scale);
    ctx.fillStyle = '#ffffffee';
    ctx.font = `bold ${12 * scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(player.name, 0, -size / 2 - 14 * scale);
  }

  // Direction indicator (arrow) for local player
  if (isLocal) {
    ctx.fillStyle = '#ffffffbb';
    ctx.beginPath();
    ctx.moveTo(0, -size / 2 - 8);
    ctx.lineTo(-8, -size / 2 - 18);
    ctx.lineTo(8, -size / 2 - 18);
    ctx.closePath();
    ctx.fill();
    // "YOU" label
    ctx.fillStyle = '#ffffffaa';
    ctx.font = `bold ${9 * scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('YOU', 0, -size / 2 - 22);
  }

  ctx.restore();
}

function drawBoostTrail(ctx: CanvasRenderingContext2D, charId: CharacterId, size: number, t: number) {
  if (charId === 'lion') {
    // Flame trail
    for (let i = 0; i < 8; i++) {
      const phase = t * 15 + i * 0.8;
      const flameX = Math.sin(phase) * 6;
      const flameY = size / 2 + i * 7;
      const flameSize = size / 3 - i * 1.5;
      if (flameSize <= 0) continue;
      const alpha = 1 - i / 8;
      const r = 255;
      const g = Math.floor(100 + (1 - i / 8) * 100);
      ctx.fillStyle = `rgba(${r}, ${g}, 0, ${alpha * 0.7})`;
      ctx.beginPath();
      ctx.arc(flameX, flameY, flameSize, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (charId === 'wolf') {
    // Ice particle trail
    for (let i = 0; i < 6; i++) {
      const phase = t * 12 + i * 1.2;
      const ix = Math.sin(phase) * 8;
      const iy = size / 2 + i * 8;
      const iSize = 3 - i * 0.3;
      if (iSize <= 0) continue;
      ctx.fillStyle = `rgba(150, 220, 255, ${0.8 - i * 0.12})`;
      ctx.beginPath();
      // Diamond shape for ice
      ctx.moveTo(ix, iy - iSize);
      ctx.lineTo(ix + iSize, iy);
      ctx.lineTo(ix, iy + iSize);
      ctx.lineTo(ix - iSize, iy);
      ctx.closePath();
      ctx.fill();
    }
  } else if (charId === 'unicorn') {
    // Rainbow trail
    const rainbowColors = ['#FF0000', '#FF8800', '#FFFF00', '#00FF00', '#0088FF', '#8800FF'];
    for (let i = 0; i < 6; i++) {
      const phase = t * 10 + i * 0.7;
      const rx = Math.sin(phase) * 5;
      const ry = size / 2 + i * 7;
      const rSize = size / 4 - i * 1;
      if (rSize <= 0) continue;
      ctx.fillStyle = rainbowColors[i] + 'aa';
      ctx.beginPath();
      ctx.arc(rx, ry, rSize, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawCharacterBody(ctx: CanvasRenderingContext2D, charId: CharacterId, size: number, t: number, speed: number, boosting: boolean) {
  const charDef = CHARACTERS[charId];
  const bodyRadius = size / 2;
  const legSpeed = speed * 2;
  const legAngle = Math.sin(t * legSpeed) * 0.5;

  // --- Running legs ---
  const legLength = size * 0.35;
  const legWidth = size * 0.12;
  ctx.fillStyle = charDef.color;

  // Left leg
  ctx.save();
  ctx.translate(-bodyRadius * 0.3, bodyRadius * 0.5);
  ctx.rotate(legAngle);
  ctx.fillRect(-legWidth / 2, 0, legWidth, legLength);
  ctx.restore();

  // Right leg
  ctx.save();
  ctx.translate(bodyRadius * 0.3, bodyRadius * 0.5);
  ctx.rotate(-legAngle);
  ctx.fillRect(-legWidth / 2, 0, legWidth, legLength);
  ctx.restore();

  // --- Body ---
  const gradient = ctx.createRadialGradient(0, -size * 0.08, size * 0.1, 0, 0, bodyRadius);
  gradient.addColorStop(0, charDef.secondaryColor);
  gradient.addColorStop(1, charDef.color);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, bodyRadius, 0, Math.PI * 2);
  ctx.fill();

  // Body border
  ctx.strokeStyle = '#ffffff55';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Boost glow ring
  if (boosting) {
    ctx.strokeStyle = charDef.secondaryColor + '88';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, bodyRadius + 3, 0, Math.PI * 2);
    ctx.stroke();
  }

  // --- Character-specific details ---
  if (charId === 'lion') {
    drawLionDetails(ctx, bodyRadius);
  } else if (charId === 'wolf') {
    drawWolfDetails(ctx, bodyRadius);
  } else if (charId === 'unicorn') {
    drawUnicornDetails(ctx, bodyRadius, t);
  }
}

function drawLionDetails(ctx: CanvasRenderingContext2D, r: number) {
  // Mane (spikes around head)
  ctx.fillStyle = '#CC5500';
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const mx = Math.cos(angle) * r * 0.85;
    const my = Math.sin(angle) * r * 0.85;
    ctx.beginPath();
    ctx.arc(mx, my, r * 0.28, 0, Math.PI * 2);
    ctx.fill();
  }

  // Face circle
  ctx.fillStyle = '#FFBB44';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(-r * 0.2, -r * 0.12, r * 0.09, 0, Math.PI * 2);
  ctx.arc(r * 0.2, -r * 0.12, r * 0.09, 0, Math.PI * 2);
  ctx.fill();
  // Eye highlights
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(-r * 0.18, -r * 0.15, r * 0.035, 0, Math.PI * 2);
  ctx.arc(r * 0.22, -r * 0.15, r * 0.035, 0, Math.PI * 2);
  ctx.fill();

  // Nose
  ctx.fillStyle = '#884422';
  ctx.beginPath();
  ctx.arc(0, r * 0.1, r * 0.08, 0, Math.PI * 2);
  ctx.fill();

  // Mouth
  ctx.strokeStyle = '#884422';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(-r * 0.08, r * 0.18, r * 0.08, 0, Math.PI);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(r * 0.08, r * 0.18, r * 0.08, 0, Math.PI);
  ctx.stroke();
}

function drawWolfDetails(ctx: CanvasRenderingContext2D, r: number) {
  // Ears (pointed triangles)
  ctx.fillStyle = '#3366CC';
  ctx.beginPath();
  ctx.moveTo(-r * 0.45, -r * 0.35);
  ctx.lineTo(-r * 0.65, -r * 1.0);
  ctx.lineTo(-r * 0.1, -r * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(r * 0.45, -r * 0.35);
  ctx.lineTo(r * 0.65, -r * 1.0);
  ctx.lineTo(r * 0.1, -r * 0.55);
  ctx.closePath();
  ctx.fill();

  // Inner ears
  ctx.fillStyle = '#99BBFF';
  ctx.beginPath();
  ctx.moveTo(-r * 0.4, -r * 0.4);
  ctx.lineTo(-r * 0.55, -r * 0.85);
  ctx.lineTo(-r * 0.2, -r * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(r * 0.4, -r * 0.4);
  ctx.lineTo(r * 0.55, -r * 0.85);
  ctx.lineTo(r * 0.2, -r * 0.55);
  ctx.closePath();
  ctx.fill();

  // Snout
  ctx.fillStyle = '#88BBFF';
  ctx.beginPath();
  ctx.ellipse(0, r * 0.15, r * 0.3, r * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eyes (fierce)
  ctx.fillStyle = '#FFDD00';
  ctx.beginPath();
  ctx.ellipse(-r * 0.22, -r * 0.1, r * 0.11, r * 0.08, -0.2, 0, Math.PI * 2);
  ctx.ellipse(r * 0.22, -r * 0.1, r * 0.11, r * 0.08, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(-r * 0.22, -r * 0.1, r * 0.05, 0, Math.PI * 2);
  ctx.arc(r * 0.22, -r * 0.1, r * 0.05, 0, Math.PI * 2);
  ctx.fill();

  // Nose
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(0, r * 0.08, r * 0.06, 0, Math.PI * 2);
  ctx.fill();
}

function drawUnicornDetails(ctx: CanvasRenderingContext2D, r: number, t: number) {
  // Horn
  const hornGrad = ctx.createLinearGradient(0, -r * 1.3, 0, -r * 0.5);
  hornGrad.addColorStop(0, '#FFD700');
  hornGrad.addColorStop(1, '#FFAA00');
  ctx.fillStyle = hornGrad;
  ctx.beginPath();
  ctx.moveTo(0, -r * 1.3);
  ctx.lineTo(-r * 0.1, -r * 0.5);
  ctx.lineTo(r * 0.1, -r * 0.5);
  ctx.closePath();
  ctx.fill();
  // Horn spiral
  ctx.strokeStyle = '#FFE066';
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const hy = -r * 0.6 - i * r * 0.15;
    ctx.beginPath();
    ctx.moveTo(-r * 0.08 + i * 0.02 * r, hy);
    ctx.lineTo(r * 0.08 - i * 0.02 * r, hy);
    ctx.stroke();
  }

  // Ears (small rounded)
  ctx.fillStyle = '#CC44FF';
  ctx.beginPath();
  ctx.ellipse(-r * 0.35, -r * 0.55, r * 0.12, r * 0.18, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(r * 0.35, -r * 0.55, r * 0.12, r * 0.18, 0.3, 0, Math.PI * 2);
  ctx.fill();

  // Face
  ctx.fillStyle = '#EECCFF';
  ctx.beginPath();
  ctx.arc(0, r * 0.05, r * 0.45, 0, Math.PI * 2);
  ctx.fill();

  // Big sparkly eyes
  ctx.fillStyle = '#8833CC';
  ctx.beginPath();
  ctx.ellipse(-r * 0.18, -r * 0.05, r * 0.1, r * 0.12, 0, 0, Math.PI * 2);
  ctx.ellipse(r * 0.18, -r * 0.05, r * 0.1, r * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  // Eye highlights
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(-r * 0.15, -r * 0.1, r * 0.04, 0, Math.PI * 2);
  ctx.arc(r * 0.21, -r * 0.1, r * 0.04, 0, Math.PI * 2);
  ctx.fill();

  // Cute nose
  ctx.fillStyle = '#CC88FF';
  ctx.beginPath();
  ctx.arc(0, r * 0.15, r * 0.04, 0, Math.PI * 2);
  ctx.fill();

  // Star sparkles around
  const sparkleHue = (t * 120) % 360;
  ctx.fillStyle = `hsla(${sparkleHue}, 100%, 80%, 0.7)`;
  for (let i = 0; i < 4; i++) {
    const angle = t * 3 + (i / 4) * Math.PI * 2;
    const dist = r * 0.9;
    const sx = Math.cos(angle) * dist;
    const sy = Math.sin(angle) * dist;
    drawStar(ctx, sx, sy, r * 0.08);
  }
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
    const px = x + Math.cos(angle) * size;
    const py = y + Math.sin(angle) * size;
    const ix = x + Math.cos(angle + Math.PI / 5) * size * 0.4;
    const iy = y + Math.sin(angle + Math.PI / 5) * size * 0.4;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
    ctx.lineTo(ix, iy);
  }
  ctx.closePath();
  ctx.fill();
}

function drawParticles(
  ctx: CanvasRenderingContext2D,
  particles: { x: number; y: number; life: number; color: string; size: number }[],
  W: number,
  H: number,
  _cameraY: number,
  scale: number
) {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life);
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
  const hudGrad = ctx.createLinearGradient(0, 0, 0, 55);
  hudGrad.addColorStop(0, '#000000cc');
  hudGrad.addColorStop(1, '#00000044');
  ctx.fillStyle = hudGrad;
  ctx.fillRect(0, 0, W, 55);

  // Lap counter
  const totalLaps = isBattle ? TRACK.BATTLE_LAPS : TRACK.RACE_LAPS;
  const lapText = isBattle
    ? `⚔️ BATTLE ${Math.min(player.lap + 1, totalLaps)}/${totalLaps}`
    : `🏁 Lap ${Math.min(player.lap + 1, totalLaps)}/${totalLaps}`;

  ctx.fillStyle = isBattle ? '#FF4444' : '#ffffff';
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(lapText, padding, 28);

  // Speed display
  const speedPct = Math.round((player.speed / TRACK.BOOST_SPEED) * 100);
  ctx.textAlign = 'right';

  // Speed bar
  const barW = 70;
  const barH = 8;
  const barX = W - padding - barW;
  const barY = 14;

  // Background
  ctx.fillStyle = '#333333';
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW, barH, 4);
  ctx.fill();

  // Fill
  const speedColor = player.boosting ? '#FFaa00' : speedPct > 70 ? '#44FF44' : '#88CC88';
  ctx.fillStyle = speedColor;
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW * Math.min(1, speedPct / 100), barH, 4);
  ctx.fill();

  // Speed text
  ctx.fillStyle = '#ffffffcc';
  ctx.font = `bold 13px sans-serif`;
  ctx.fillText(`${speedPct}%`, W - padding, 36);

  // Boost ready indicator
  if (!player.boosting) {
    ctx.fillStyle = '#ffffff55';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🔥 W/↑', W / 2 - 30, 48);
    ctx.fillText('⬆️ SPACE', W / 2 + 30, 48);
  }
}

function drawCountdown(ctx: CanvasRenderingContext2D, W: number, H: number, text: string) {
  ctx.fillStyle = '#00000077';
  ctx.fillRect(0, 0, W, H);

  // Pulsing effect
  const pulse = 1 + Math.sin(Date.now() * 0.012) * 0.12;

  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(pulse, pulse);

  // Text shadow
  ctx.fillStyle = '#000000';
  ctx.font = `bold 80px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 3, 3);

  // Main text
  const isGo = text.includes('GO');
  ctx.fillStyle = isGo ? '#FFD700' : '#ffffff';
  ctx.fillText(text, 0, 0);

  ctx.restore();
}
