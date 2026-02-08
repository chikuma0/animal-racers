import { TRACK, ARENA, PlayerState, CHARACTERS, CharacterId, FightState } from './types';
import { GameEngine } from './engine';

const JUNGLE_GREEN_DARK = '#0f3f0f';
const TRACK_COLOR = '#c4a060';
const TRACK_BORDER = '#8B7355';
const TRACK_MARKING = '#ffffff55';

// ===================== RACING RENDERER =====================

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
  const scale = W / TRACK.WIDTH;  // scale to fit width (track fills screen)

  // Screen shake offset
  const shakeX = engine.screenShake * (Math.random() - 0.5) * 2;
  const shakeY = engine.screenShake * (Math.random() - 0.5) * 2;

  ctx.save();
  ctx.translate(shakeX, shakeY);

  const cameraY = localPlayer.progress;

  drawJungleBackground(ctx, W, H, cameraY, scale);
  drawSpeedLines(ctx, W, H, localPlayer.speed, scale);
  drawTrack(ctx, W, H, cameraY, scale);
  drawObstacles(ctx, engine.obstacles, W, H, cameraY, scale);

  for (const p of otherPlayers) {
    if (p.character) {
      drawPlayer(ctx, p, W, H, cameraY, scale, false);
    }
  }

  if (localPlayer.character) {
    drawPlayer(ctx, localPlayer, W, H, cameraY, scale, true);
  }

  drawParticles(ctx, engine.particles, scale, false);

  if (localPlayer.boosting) {
    ctx.fillStyle = 'rgba(255, 200, 50, 0.06)';
    ctx.fillRect(0, 0, W, H);
  }

  drawHUD(ctx, W, H, localPlayer, false);

  if (countdownText) {
    drawCountdown(ctx, W, H, countdownText);
  }

  ctx.restore();
}

// ===================== FIGHTING GAME RENDERER =====================

export function renderFightGame(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  engine: GameEngine,
  localPlayer: PlayerState,
  otherPlayers: PlayerState[],
  fightTimer: number,
  countdownText: string | null
) {
  const W = canvas.width;
  const H = canvas.height;
  const scale = W / ARENA.WIDTH;

  // Screen shake
  const shakeX = engine.screenShake * (Math.random() - 0.5) * 2;
  const shakeY = engine.screenShake * (Math.random() - 0.5) * 2;

  ctx.save();
  ctx.translate(shakeX, shakeY);

  // Draw arena background
  drawArenaBackground(ctx, W, H, scale);

  // Draw arena ground
  drawArenaGround(ctx, W, H, scale);

  // Draw all fighters
  const allFighters = [localPlayer, ...otherPlayers].filter(p => p.character);

  for (const player of allFighters) {
    drawFighter(ctx, player, W, H, scale);
  }

  // Draw particles (fight mode)
  drawParticles(ctx, engine.particles, scale, true);

  // Draw health bars at top
  drawFightHUD(ctx, W, H, localPlayer, otherPlayers, fightTimer, scale);

  if (countdownText) {
    drawCountdown(ctx, W, H, countdownText);
  }

  ctx.restore();
}

function drawArenaBackground(ctx: CanvasRenderingContext2D, W: number, H: number, _scale: number) {
  // Dark arena backdrop with gradient
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#1a0a2e');
  grad.addColorStop(0.4, '#16213e');
  grad.addColorStop(0.7, '#0f3460');
  grad.addColorStop(1, '#1a1a2e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Stars
  const t = Date.now() * 0.001;
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 30; i++) {
    const sx = (Math.sin(i * 7.3) * 0.5 + 0.5) * W;
    const sy = (Math.cos(i * 11.7) * 0.3 + 0.15) * H;
    const twinkle = Math.sin(t * 2 + i) * 0.5 + 0.5;
    ctx.globalAlpha = twinkle * 0.6;
    ctx.beginPath();
    ctx.arc(sx, sy, 1 + Math.sin(i) * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Torches/flames on sides
  const flameColors = ['#ff6600', '#ff4400', '#ff8800', '#ffaa00'];
  for (let side = 0; side < 2; side++) {
    const baseX = side === 0 ? W * 0.05 : W * 0.95;
    const baseY = H * 0.45;

    // Torch post
    ctx.fillStyle = '#4a3728';
    ctx.fillRect(baseX - 4, baseY, 8, H * 0.4);

    // Flame
    for (let i = 0; i < 4; i++) {
      const flameY = baseY - 5 - i * 6 + Math.sin(t * 8 + i + side * 3) * 3;
      const flameSize = 8 - i * 1.5;
      ctx.fillStyle = flameColors[i] + 'cc';
      ctx.beginPath();
      ctx.arc(baseX + Math.sin(t * 10 + i) * 2, flameY, flameSize, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawArenaGround(ctx: CanvasRenderingContext2D, W: number, H: number, scale: number) {
  const groundY = ARENA.GROUND_Y * scale;

  // Ground platform
  const grad = ctx.createLinearGradient(0, groundY, 0, H);
  grad.addColorStop(0, '#5a4a3a');
  grad.addColorStop(0.3, '#3a2a1a');
  grad.addColorStop(1, '#1a0a00');
  ctx.fillStyle = grad;
  ctx.fillRect(0, groundY + 30 * scale, W, H - groundY);

  // Platform edge
  ctx.fillStyle = '#7a6a5a';
  ctx.fillRect(10, groundY + 20 * scale, W - 20, 12 * scale);
  ctx.fillStyle = '#8a7a6a';
  ctx.fillRect(10, groundY + 20 * scale, W - 20, 4 * scale);

  // Edge markings
  ctx.strokeStyle = '#ffaa0044';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(20, groundY + 26 * scale);
  ctx.lineTo(W - 20, groundY + 26 * scale);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawFighter(ctx: CanvasRenderingContext2D, player: PlayerState, W: number, H: number, scale: number) {
  const fight = player.fight;
  if (!fight || !player.character) return;

  const charDef = CHARACTERS[player.character];
  const x = fight.fx * scale;
  const y = fight.fy * scale;
  const pw = ARENA.PLAYER_WIDTH * scale;
  const ph = ARENA.PLAYER_HEIGHT * scale;
  const t = Date.now() * 0.001;

  ctx.save();
  ctx.translate(x, y);

  // Shadow on ground
  const groundY = (ARENA.GROUND_Y - fight.fy) * scale;
  const shadowScale = 1 + (ARENA.GROUND_Y - fight.fy) / 200;
  ctx.fillStyle = '#00000044';
  ctx.beginPath();
  ctx.ellipse(0, groundY + 25 * scale, pw * 0.4 * shadowScale, 6 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Frozen effect
  if (fight.freezeTimer > 0) {
    ctx.fillStyle = '#88CCFF55';
    ctx.beginPath();
    ctx.arc(0, -ph * 0.3, pw * 0.7, 0, Math.PI * 2);
    ctx.fill();
    // Ice crystals
    ctx.strokeStyle = '#aaddff88';
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + t;
      ctx.beginPath();
      ctx.moveTo(0, -ph * 0.3);
      ctx.lineTo(Math.cos(angle) * pw * 0.6, -ph * 0.3 + Math.sin(angle) * pw * 0.6);
      ctx.stroke();
    }
  }

  // Shield effect (unicorn)
  if (fight.blockTimer > 0) {
    const hue = (Date.now() * 0.5) % 360;
    ctx.strokeStyle = `hsla(${hue}, 100%, 70%, 0.7)`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, -ph * 0.3, pw * 0.7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `hsla(${hue + 120}, 100%, 80%, 0.5)`;
    ctx.beginPath();
    ctx.arc(0, -ph * 0.3, pw * 0.8, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Hit flash
  const isHit = fight.hitStunTimer > 0;
  const invuln = fight.invulnTimer > 0;

  // Flash/blink when invulnerable
  if (invuln && Math.floor(Date.now() / 80) % 2 === 0) {
    ctx.globalAlpha = 0.4;
  }

  // Scale for facing direction
  ctx.scale(fight.facing, 1);

  // Draw the fighter body
  drawFighterBody(ctx, player.character, pw, ph, t, fight, isHit);

  ctx.restore();

  // Punch effect
  if (fight.punching && fight.punchTimer > 100) {
    const punchX = x + fight.facing * pw * 0.7;
    const punchY = y - ph * 0.3;
    ctx.fillStyle = charDef.color + 'aa';
    ctx.beginPath();
    ctx.arc(punchX, punchY, 12 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffffaa';
    ctx.beginPath();
    ctx.arc(punchX, punchY, 6 * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  // Fire dash trail
  if (fight.dashActive) {
    for (let i = 1; i <= 5; i++) {
      const trailX = x - fight.facing * i * 12;
      ctx.fillStyle = `rgba(255, ${100 + i * 30}, 0, ${0.5 - i * 0.08})`;
      ctx.beginPath();
      ctx.arc(trailX, y - ph * 0.3, (12 - i * 1.5) * scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Wolf howl effect
  if (player.character === 'wolf' && fight.specialActive && fight.specialTimer > 200) {
    const radius = (500 - fight.specialTimer) * 0.3 * scale;
    ctx.strokeStyle = '#88CCFF66';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y - ph * 0.3, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#aaddff44';
    ctx.beginPath();
    ctx.arc(x, y - ph * 0.3, radius * 0.7, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Name tag
  ctx.fillStyle = '#000000aa';
  ctx.font = `bold ${11 * scale}px sans-serif`;
  ctx.textAlign = 'center';
  const nameW = ctx.measureText(player.name).width;
  ctx.fillRect(x - nameW / 2 - 4, y - ph - 18 * scale, nameW + 8, 14 * scale);
  ctx.fillStyle = '#ffffffee';
  ctx.fillText(player.name, x, y - ph - 8 * scale);
}

function drawFighterBody(
  ctx: CanvasRenderingContext2D,
  charId: CharacterId,
  pw: number,
  ph: number,
  t: number,
  fight: FightState,
  isHit: boolean
) {
  const charDef = CHARACTERS[charId];
  const moving = Math.abs(fight.fvx) > 0.5;
  const bobPhase = moving ? Math.sin(t * 12) * 3 : Math.sin(t * 2) * 1;
  const bodyY = -ph * 0.5 + bobPhase;

  // Legs
  const legLength = ph * 0.35;
  const legWidth = pw * 0.14;
  const legSwing = moving ? Math.sin(t * 14) * 0.6 : 0;

  ctx.fillStyle = charDef.color;

  // Back leg
  ctx.save();
  ctx.translate(-pw * 0.12, bodyY + ph * 0.25);
  ctx.rotate(-legSwing);
  ctx.fillRect(-legWidth / 2, 0, legWidth, legLength);
  // Foot
  ctx.fillStyle = isHit ? '#ff4444' : darkenColor(charDef.color, 0.7);
  ctx.fillRect(-legWidth / 2 - 2, legLength - 4, legWidth + 4, 6);
  ctx.restore();

  // Front leg
  ctx.fillStyle = charDef.color;
  ctx.save();
  ctx.translate(pw * 0.12, bodyY + ph * 0.25);
  ctx.rotate(legSwing);
  ctx.fillRect(-legWidth / 2, 0, legWidth, legLength);
  ctx.fillStyle = isHit ? '#ff4444' : darkenColor(charDef.color, 0.7);
  ctx.fillRect(-legWidth / 2 - 2, legLength - 4, legWidth + 4, 6);
  ctx.restore();

  // Body (torso)
  const bodyWidth = pw * 0.55;
  const bodyHeight = ph * 0.4;
  const leanAngle = fight.dashActive ? 0.3 : (moving ? 0.08 : 0);

  ctx.save();
  ctx.translate(0, bodyY);
  ctx.rotate(leanAngle);

  // Hit flash
  if (isHit) {
    ctx.fillStyle = '#FF000088';
    ctx.beginPath();
    ctx.ellipse(0, 0, bodyWidth * 0.7, bodyHeight * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Main body
  const bodyGrad = ctx.createRadialGradient(0, -bodyHeight * 0.2, bodyWidth * 0.1, 0, 0, bodyWidth * 0.7);
  bodyGrad.addColorStop(0, charDef.secondaryColor);
  bodyGrad.addColorStop(1, charDef.color);
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.ellipse(0, 0, bodyWidth * 0.55, bodyHeight * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#ffffff33';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Arms
  const armLength = ph * 0.25;
  const armWidth = pw * 0.1;
  const punchExtend = fight.punching ? pw * 0.4 : 0;

  // Front arm (punching arm)
  ctx.fillStyle = charDef.color;
  ctx.save();
  ctx.translate(bodyWidth * 0.35, -bodyHeight * 0.1);
  if (fight.punching) {
    ctx.rotate(-0.3);
    ctx.fillRect(0, -armWidth / 2, armLength + punchExtend, armWidth);
    // Fist
    ctx.fillStyle = charDef.secondaryColor;
    ctx.beginPath();
    ctx.arc(armLength + punchExtend, 0, armWidth * 0.8, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.rotate(Math.sin(t * 4) * 0.2);
    ctx.fillRect(0, -armWidth / 2, armLength, armWidth);
  }
  ctx.restore();

  // Back arm
  ctx.fillStyle = darkenColor(charDef.color, 0.8);
  ctx.save();
  ctx.translate(-bodyWidth * 0.35, -bodyHeight * 0.1);
  ctx.rotate(-Math.sin(t * 4) * 0.15 - 0.2);
  ctx.fillRect(-armLength, -armWidth / 2, armLength, armWidth);
  ctx.restore();

  ctx.restore();

  // Head
  const headRadius = pw * 0.3;
  const headY = bodyY - bodyHeight * 0.5 - headRadius * 0.6;
  const headBob = bobPhase * 0.5;

  ctx.save();
  ctx.translate(0, headY + headBob);

  // Head base
  const headGrad = ctx.createRadialGradient(-headRadius * 0.2, -headRadius * 0.2, headRadius * 0.1, 0, 0, headRadius);
  headGrad.addColorStop(0, charDef.secondaryColor);
  headGrad.addColorStop(1, charDef.color);
  ctx.fillStyle = headGrad;
  ctx.beginPath();
  ctx.arc(0, 0, headRadius, 0, Math.PI * 2);
  ctx.fill();

  // Character-specific head details
  if (charId === 'lion') {
    drawFighterLionHead(ctx, headRadius, t);
  } else if (charId === 'wolf') {
    drawFighterWolfHead(ctx, headRadius, t);
  } else if (charId === 'unicorn') {
    drawFighterUnicornHead(ctx, headRadius, t);
  }

  ctx.restore();

  // Tail
  const tailBaseY = bodyY + bodyHeight * 0.1;
  drawFighterTail(ctx, charId, -pw * 0.3, tailBaseY, pw, t, charDef.color);
}

function drawFighterLionHead(ctx: CanvasRenderingContext2D, r: number, t: number) {
  // Mane
  ctx.fillStyle = '#CC5500';
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const wobble = Math.sin(t * 3 + i * 0.7) * 1.5;
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * r * 0.8 + wobble, Math.sin(angle) * r * 0.8, r * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }

  // Face
  ctx.fillStyle = '#FFBB44';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(-r * 0.2, -r * 0.1, r * 0.09, 0, Math.PI * 2);
  ctx.arc(r * 0.2, -r * 0.1, r * 0.09, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(-r * 0.18, -r * 0.13, r * 0.035, 0, Math.PI * 2);
  ctx.arc(r * 0.22, -r * 0.13, r * 0.035, 0, Math.PI * 2);
  ctx.fill();

  // Nose & mouth
  ctx.fillStyle = '#884422';
  ctx.beginPath();
  ctx.arc(0, r * 0.1, r * 0.07, 0, Math.PI * 2);
  ctx.fill();
}

function drawFighterWolfHead(ctx: CanvasRenderingContext2D, r: number, _t: number) {
  // Ears
  ctx.fillStyle = '#3366CC';
  ctx.beginPath();
  ctx.moveTo(-r * 0.4, -r * 0.3);
  ctx.lineTo(-r * 0.6, -r * 1.0);
  ctx.lineTo(-r * 0.1, -r * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(r * 0.4, -r * 0.3);
  ctx.lineTo(r * 0.6, -r * 1.0);
  ctx.lineTo(r * 0.1, -r * 0.5);
  ctx.closePath();
  ctx.fill();

  // Inner ears
  ctx.fillStyle = '#99BBFF';
  ctx.beginPath();
  ctx.moveTo(-r * 0.38, -r * 0.35);
  ctx.lineTo(-r * 0.52, -r * 0.85);
  ctx.lineTo(-r * 0.18, -r * 0.48);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(r * 0.38, -r * 0.35);
  ctx.lineTo(r * 0.52, -r * 0.85);
  ctx.lineTo(r * 0.18, -r * 0.48);
  ctx.closePath();
  ctx.fill();

  // Snout
  ctx.fillStyle = '#88BBFF';
  ctx.beginPath();
  ctx.ellipse(0, r * 0.15, r * 0.3, r * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  ctx.fillStyle = '#FFDD00';
  ctx.beginPath();
  ctx.ellipse(-r * 0.2, -r * 0.08, r * 0.1, r * 0.07, -0.2, 0, Math.PI * 2);
  ctx.ellipse(r * 0.2, -r * 0.08, r * 0.1, r * 0.07, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(-r * 0.2, -r * 0.08, r * 0.045, 0, Math.PI * 2);
  ctx.arc(r * 0.2, -r * 0.08, r * 0.045, 0, Math.PI * 2);
  ctx.fill();

  // Nose
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(0, r * 0.08, r * 0.05, 0, Math.PI * 2);
  ctx.fill();
}

function drawFighterUnicornHead(ctx: CanvasRenderingContext2D, r: number, t: number) {
  // Horn
  const hornGrad = ctx.createLinearGradient(0, -r * 1.4, 0, -r * 0.5);
  hornGrad.addColorStop(0, '#FFD700');
  hornGrad.addColorStop(1, '#FFAA00');
  ctx.fillStyle = hornGrad;
  ctx.beginPath();
  ctx.moveTo(0, -r * 1.4);
  ctx.lineTo(-r * 0.1, -r * 0.5);
  ctx.lineTo(r * 0.1, -r * 0.5);
  ctx.closePath();
  ctx.fill();

  // Ears
  ctx.fillStyle = '#CC44FF';
  ctx.beginPath();
  ctx.ellipse(-r * 0.35, -r * 0.5, r * 0.1, r * 0.16, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(r * 0.35, -r * 0.5, r * 0.1, r * 0.16, 0.3, 0, Math.PI * 2);
  ctx.fill();

  // Face
  ctx.fillStyle = '#EECCFF';
  ctx.beginPath();
  ctx.arc(0, r * 0.05, r * 0.45, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  ctx.fillStyle = '#8833CC';
  ctx.beginPath();
  ctx.ellipse(-r * 0.16, -r * 0.04, r * 0.09, r * 0.11, 0, 0, Math.PI * 2);
  ctx.ellipse(r * 0.16, -r * 0.04, r * 0.09, r * 0.11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(-r * 0.14, -r * 0.08, r * 0.035, 0, Math.PI * 2);
  ctx.arc(r * 0.19, -r * 0.08, r * 0.035, 0, Math.PI * 2);
  ctx.fill();

  // Sparkles
  const sparkleHue = (t * 120) % 360;
  ctx.fillStyle = `hsla(${sparkleHue}, 100%, 80%, 0.6)`;
  for (let i = 0; i < 3; i++) {
    const angle = t * 3 + (i / 3) * Math.PI * 2;
    const dist = r * 0.85;
    drawStar(ctx, Math.cos(angle) * dist, Math.sin(angle) * dist, r * 0.06);
  }
}

function drawFighterTail(ctx: CanvasRenderingContext2D, charId: CharacterId, baseX: number, baseY: number, pw: number, t: number, color: string) {
  const tailWag = Math.sin(t * 6) * 0.4;
  const segments = 5;

  ctx.strokeStyle = color;
  ctx.lineWidth = pw * 0.08;
  ctx.lineCap = 'round';
  ctx.beginPath();

  let tx = baseX;
  let ty = baseY;
  ctx.moveTo(tx, ty);

  for (let i = 0; i < segments; i++) {
    tx -= pw * 0.08;
    ty += Math.sin(tailWag + i * 0.8) * 4;
    ctx.lineTo(tx, ty);
  }

  ctx.stroke();

  // Tail tip
  if (charId === 'lion') {
    ctx.fillStyle = '#CC5500';
    ctx.beginPath();
    ctx.arc(tx, ty, pw * 0.06, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFightHUD(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  localPlayer: PlayerState,
  otherPlayers: PlayerState[],
  fightTimer: number,
  scale: number
) {
  const allPlayers = [localPlayer, ...otherPlayers].filter(p => p.character);
  const barHeight = 16 * scale;
  const barPadding = 8;
  const barY = 12;

  // Top bar background
  const hudGrad = ctx.createLinearGradient(0, 0, 0, 70);
  hudGrad.addColorStop(0, '#000000dd');
  hudGrad.addColorStop(1, '#00000044');
  ctx.fillStyle = hudGrad;
  ctx.fillRect(0, 0, W, 70);

  // Timer
  const seconds = Math.max(0, Math.ceil(fightTimer / 1000));
  ctx.fillStyle = seconds <= 10 ? '#FF4444' : '#ffffff';
  ctx.font = `bold ${20 * scale}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${seconds}`, W / 2, 20);

  // "FIGHT!" label
  ctx.fillStyle = '#FF4444';
  ctx.font = `bold ${10 * scale}px sans-serif`;
  ctx.fillText('⚔️ FIGHT', W / 2, 38);

  // Health bars
  const maxBarWidth = (W - 80) / 2;

  allPlayers.forEach((player, i) => {
    if (!player.character) return;
    const charDef = CHARACTERS[player.character];
    const fight = player.fight;
    const hp = fight?.hp ?? 100;
    const maxHp = fight?.maxHp ?? 100;
    const hpPct = hp / maxHp;

    const isLeft = i === 0;
    const barX = isLeft ? barPadding + 30 : W - barPadding - maxBarWidth - 30;

    // Player emoji
    ctx.font = `${16 * scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(charDef.emoji, isLeft ? barPadding + 14 : W - barPadding - 14, barY + barHeight / 2 + 2);

    // HP bar background
    ctx.fillStyle = '#333333';
    ctx.beginPath();
    ctx.roundRect(barX, barY, maxBarWidth, barHeight, 4);
    ctx.fill();

    // HP bar fill
    const hpColor = hpPct > 0.5 ? '#44FF44' : hpPct > 0.25 ? '#FFAA00' : '#FF4444';
    const fillWidth = maxBarWidth * hpPct;

    if (isLeft) {
      ctx.fillStyle = hpColor;
      ctx.beginPath();
      ctx.roundRect(barX, barY, fillWidth, barHeight, 4);
      ctx.fill();
    } else {
      ctx.fillStyle = hpColor;
      ctx.beginPath();
      ctx.roundRect(barX + maxBarWidth - fillWidth, barY, fillWidth, barHeight, 4);
      ctx.fill();
    }

    // HP text
    ctx.fillStyle = '#ffffffcc';
    ctx.font = `bold ${10 * scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`${hp} HP`, barX + maxBarWidth / 2, barY + barHeight / 2 + 1);

    // Name
    ctx.fillStyle = '#ffffffaa';
    ctx.font = `bold ${9 * scale}px sans-serif`;
    ctx.textAlign = isLeft ? 'left' : 'right';
    ctx.fillText(player.name, isLeft ? barX : barX + maxBarWidth, barY + barHeight + 12);

    // Special cooldown indicator
    const specCd = fight?.specialCooldown ?? 0;
    const charSpec = CHARACTERS[player.character];
    if (specCd > 0) {
      ctx.fillStyle = '#ffffff44';
      ctx.font = `${8 * scale}px sans-serif`;
      ctx.textAlign = isLeft ? 'left' : 'right';
      ctx.fillText(`${charSpec.specialName}: ${Math.ceil(specCd / 1000)}s`, isLeft ? barX : barX + maxBarWidth, barY + barHeight + 24);
    } else {
      ctx.fillStyle = '#FFD700aa';
      ctx.font = `bold ${8 * scale}px sans-serif`;
      ctx.textAlign = isLeft ? 'left' : 'right';
      ctx.fillText(`${charSpec.specialName}: READY!`, isLeft ? barX : barX + maxBarWidth, barY + barHeight + 24);
    }
  });
}

// ===================== SHARED RENDERING FUNCTIONS =====================

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
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#0a2f0a');
  grad.addColorStop(0.5, JUNGLE_GREEN_DARK);
  grad.addColorStop(1, '#1a4f1a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  const treeSpacing = 100;
  const startY = Math.floor(cameraY / treeSpacing) * treeSpacing - treeSpacing;

  for (let y = startY; y < cameraY + H / scale + treeSpacing; y += treeSpacing) {
    const screenY = H - (y - cameraY) * scale - H * 0.3;

    drawTree(ctx, 15 * scale, screenY, scale, y);
    drawTree(ctx, (TRACK.WIDTH - 15) * scale, screenY, scale, y + 50);

    const midY = screenY + treeSpacing * scale * 0.5;
    drawBush(ctx, 8 * scale, midY, scale * 0.6);
    drawBush(ctx, (TRACK.WIDTH - 8) * scale, midY, scale * 0.6);

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
  ctx.fillStyle = '#4A2E0A';
  ctx.fillRect(x - 4 * scale, y - 5 * scale, 8 * scale, 22 * scale);
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
  // Pseudo-3D perspective: track narrows toward top
  const perspectiveAmount = 0.15; // How much narrower at top
  const trackLeftBase = TRACK.TRACK_LEFT * scale;
  const trackRightBase = TRACK.TRACK_RIGHT * scale;
  const trackWidthBase = trackRightBase - trackLeftBase;

  // Draw track with perspective - gradient from bottom (wider) to top (narrower)
  const segments = 20;
  const segmentH = H / segments;

  for (let i = 0; i < segments; i++) {
    const yTop = i * segmentH;
    const yBot = (i + 1) * segmentH;
    const tTop = i / segments; // 0 at top, 1 at bottom
    const tBot = (i + 1) / segments;

    const narrowTop = perspectiveAmount * (1 - tTop);
    const narrowBot = perspectiveAmount * (1 - tBot);

    const leftTop = trackLeftBase + trackWidthBase * narrowTop * 0.5;
    const rightTop = trackRightBase - trackWidthBase * narrowTop * 0.5;
    const leftBot = trackLeftBase + trackWidthBase * narrowBot * 0.5;
    const rightBot = trackRightBase - trackWidthBase * narrowBot * 0.5;

    // Track border
    ctx.fillStyle = TRACK_BORDER;
    ctx.beginPath();
    ctx.moveTo(leftTop - 5 * scale, yTop);
    ctx.lineTo(rightTop + 5 * scale, yTop);
    ctx.lineTo(rightBot + 5 * scale, yBot);
    ctx.lineTo(leftBot - 5 * scale, yBot);
    ctx.closePath();
    ctx.fill();

    // Track surface
    ctx.fillStyle = TRACK_COLOR;
    ctx.beginPath();
    ctx.moveTo(leftTop, yTop);
    ctx.lineTo(rightTop, yTop);
    ctx.lineTo(rightBot, yBot);
    ctx.lineTo(leftBot, yBot);
    ctx.closePath();
    ctx.fill();
  }

  // Lane markings with perspective
  ctx.strokeStyle = TRACK_MARKING;
  ctx.lineWidth = 2.5;
  ctx.setLineDash([18, 12]);

  const lanes = TRACK.LANE_COUNT;
  for (let l = 1; l < lanes; l++) {
    const laneFrac = l / lanes;
    ctx.beginPath();
    for (let y = 0; y <= H; y += 4) {
      const t = y / H;
      const narrow = perspectiveAmount * (1 - t);
      const left = trackLeftBase + trackWidthBase * narrow * 0.5;
      const right = trackRightBase - trackWidthBase * narrow * 0.5;
      const lx = left + (right - left) * laneFrac;
      const offset = (cameraY * scale) % 30;
      if (y === 0) ctx.moveTo(lx, y + offset);
      else ctx.lineTo(lx, y + offset);
    }
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Track edges with perspective
  ctx.strokeStyle = '#ffffffaa';
  ctx.lineWidth = 3;

  // Left edge
  ctx.beginPath();
  for (let y = 0; y <= H; y += 4) {
    const t = y / H;
    const narrow = perspectiveAmount * (1 - t);
    const left = trackLeftBase + trackWidthBase * narrow * 0.5;
    if (y === 0) ctx.moveTo(left, y);
    else ctx.lineTo(left, y);
  }
  ctx.stroke();

  // Right edge
  ctx.beginPath();
  for (let y = 0; y <= H; y += 4) {
    const t = y / H;
    const narrow = perspectiveAmount * (1 - t);
    const right = trackRightBase - trackWidthBase * narrow * 0.5;
    if (y === 0) ctx.moveTo(right, y);
    else ctx.lineTo(right, y);
  }
  ctx.stroke();

  // Lap/start line
  const lapLineY = H - (0 - (cameraY % TRACK.LAP_LENGTH)) * scale - H * 0.3;
  if (lapLineY > -20 && lapLineY < H + 20) {
    const t = lapLineY / H;
    const narrow = perspectiveAmount * (1 - t);
    const left = trackLeftBase + trackWidthBase * narrow * 0.5;
    const right = trackRightBase - trackWidthBase * narrow * 0.5;
    const lineWidth = right - left;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 12; i++) {
      const bx = left + (lineWidth / 12) * i;
      const bw = lineWidth / 12;
      ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#222222';
      ctx.fillRect(bx, lapLineY - 5, bw, 10);
    }
  }

  // Alternating edge chevrons
  const chevronSize = 12 * scale;
  const chevronOffset = (cameraY * scale) % (chevronSize * 2);
  for (let y = -chevronSize * 2 + chevronOffset; y < H + chevronSize * 2; y += chevronSize * 2) {
    const t = y / H;
    const narrow = perspectiveAmount * (1 - Math.max(0, Math.min(1, t)));
    const left = trackLeftBase + trackWidthBase * narrow * 0.5;
    const right = trackRightBase - trackWidthBase * narrow * 0.5;

    ctx.fillStyle = '#ff000033';
    ctx.fillRect(left - 5 * scale, y, 5 * scale, chevronSize);
    ctx.fillStyle = '#ffffff33';
    ctx.fillRect(left - 5 * scale, y + chevronSize, 5 * scale, chevronSize);
    ctx.fillStyle = '#ff000033';
    ctx.fillRect(right, y, 5 * scale, chevronSize);
    ctx.fillStyle = '#ffffff33';
    ctx.fillRect(right, y + chevronSize, 5 * scale, chevronSize);
  }
}

function drawObstacles(
  ctx: CanvasRenderingContext2D,
  obstacles: { type: string; x: number; y: number; width: number }[],
  W: number,
  H: number,
  cameraY: number,
  scale: number
) {
  const trackLeft = TRACK.TRACK_LEFT * scale;
  const trackWidth = (TRACK.TRACK_RIGHT - TRACK.TRACK_LEFT) * scale;
  const perspectiveAmount = 0.15;

  for (const obs of obstacles) {
    const screenY = H - (obs.y - (cameraY % TRACK.LAP_LENGTH)) * scale - H * 0.3;
    if (screenY < -50 || screenY > H + 50) continue;

    // Pseudo-3D: scale based on Y position
    const t = screenY / H;
    const depthScale = 0.7 + 0.3 * Math.max(0, Math.min(1, t));
    const narrow = perspectiveAmount * (1 - Math.max(0, Math.min(1, t)));
    const left = trackLeft + trackWidth * narrow * 0.5;
    const right = trackLeft + trackWidth - trackWidth * narrow * 0.5;
    const adjTrackWidth = right - left;

    const screenX = left + obs.x * adjTrackWidth;
    const obsWidth = obs.width * adjTrackWidth * depthScale;

    ctx.save();

    if (obs.type === 'rock') {
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
    } else if (obs.type === 'river') {
      ctx.fillStyle = '#3377BB88';
      ctx.fillRect(screenX - obsWidth / 2, screenY - 12 * depthScale, obsWidth, 24 * depthScale);
      ctx.strokeStyle = '#66CCFF88';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let wx = screenX - obsWidth / 2; wx < screenX + obsWidth / 2; wx += 6) {
        const wy = screenY + Math.sin((wx + Date.now() * 0.004) * 0.35) * 4;
        if (wx === screenX - obsWidth / 2) ctx.moveTo(wx, wy);
        else ctx.lineTo(wx, wy);
      }
      ctx.stroke();
    } else if (obs.type === 'log') {
      ctx.fillStyle = '#5D3E1A';
      const logH = 10 * depthScale;
      ctx.fillRect(screenX - obsWidth / 2, screenY - logH / 2, obsWidth, logH);
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
      ctx.fillStyle = '#6B4A1A88';
      ctx.beginPath();
      ctx.ellipse(screenX, screenY, obsWidth / 2, obsWidth / 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5D3E1A66';
      const bubT = Date.now() * 0.002;
      ctx.beginPath();
      ctx.arc(screenX + Math.sin(bubT) * 8, screenY + Math.cos(bubT * 0.7) * 4, 3 * depthScale, 0, Math.PI * 2);
      ctx.fill();
    } else if (obs.type === 'bush') {
      ctx.fillStyle = '#2E7D2E';
      ctx.beginPath();
      ctx.arc(screenX, screenY, obsWidth / 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3DA03D';
      ctx.beginPath();
      ctx.arc(screenX + 4 * depthScale, screenY - 3 * depthScale, obsWidth / 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
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
) {
  const trackLeft = TRACK.TRACK_LEFT * scale;
  const trackWidth = (TRACK.TRACK_RIGHT - TRACK.TRACK_LEFT) * scale;
  const perspectiveAmount = 0.15;

  const screenX = trackLeft + player.x * trackWidth;
  const relProgress = player.progress - (cameraY % TRACK.LAP_LENGTH);
  const screenY = H - relProgress * scale - H * 0.3;

  const rawY = isLocal ? H * 0.65 : screenY;
  const rawX = isLocal ? (trackLeft + player.x * trackWidth) : screenX;

  if (!isLocal && (rawY < -60 || rawY > H + 60)) return;

  const charDef = player.character ? CHARACTERS[player.character] : null;
  if (!charDef) return;

  // Pseudo-3D scaling based on vertical position
  const depthT = rawY / H;
  const depthScale = isLocal ? 1 : (0.65 + 0.35 * Math.max(0, Math.min(1, depthT)));

  // Adjust X for perspective
  const narrow = perspectiveAmount * (1 - Math.max(0, Math.min(1, depthT)));
  const adjLeft = trackLeft + trackWidth * narrow * 0.5;
  const adjRight = trackLeft + trackWidth - trackWidth * narrow * 0.5;
  const adjWidth = adjRight - adjLeft;
  const finalX = isLocal ? rawX : adjLeft + player.x * adjWidth;
  const finalY = rawY;

  const size = TRACK.PLAYER_SIZE * scale * depthScale;
  const t = Date.now() * 0.001;

  // Animation: bobbing motion when moving
  const moving = player.speed > TRACK.BASE_SPEED * 0.5;
  const bobAmount = moving ? Math.sin(t * 12) * 3 * depthScale : Math.sin(t * 3) * 1 * depthScale;

  // Boost pulse
  const boostPulse = player.boosting ? 1 + Math.sin(t * 20) * 0.08 : 1;

  ctx.save();
  ctx.translate(finalX, finalY + bobAmount);
  ctx.scale(boostPulse * depthScale, boostPulse * depthScale);

  // Boosting lean forward
  if (player.boosting) {
    ctx.rotate(-0.15);
  }

  // Jump effect: stretch vertically, add shadow
  if (player.jumping) {
    const jumpProgress = (Date.now() % TRACK.JUMP_DURATION) / TRACK.JUMP_DURATION;
    const jumpArc = Math.sin(jumpProgress * Math.PI);
    const jumpHeight = 25 * scale * jumpArc;

    // Shadow below grows with height
    ctx.fillStyle = `rgba(0, 0, 0, ${0.15 + jumpArc * 0.15})`;
    ctx.beginPath();
    ctx.ellipse(0, 5 * scale, (size / 2 + jumpArc * 8) / depthScale, (size / 5 + jumpArc * 3) / depthScale, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(0, -jumpHeight);
    // Stretch vertically when jumping
    ctx.scale(1 - jumpArc * 0.1, 1 + jumpArc * 0.15);
  } else {
    // Ground shadow (always present)
    ctx.fillStyle = '#00000022';
    ctx.beginPath();
    ctx.ellipse(0, size * 0.35 / depthScale, size / 2 / depthScale, size / 6 / depthScale, 0, 0, Math.PI * 2);
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
  }

  // Boost trail
  if (player.boosting) {
    drawBoostTrail(ctx, player.character!, size, t);
  }

  // Draw character body with animation
  drawCharacterBody(ctx, player.character!, size, t, player.speed, player.boosting, player.hitStun > 0);

  // Tail wagging
  drawTail(ctx, player.character!, size, t, charDef.color);

  // Hit stun flash
  if (player.hitStun > 0) {
    ctx.fillStyle = '#FF000055';
    ctx.beginPath();
    ctx.arc(0, 0, size / 2 + 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Name tag for remote players
  if (!isLocal) {
    ctx.fillStyle = '#000000aa';
    ctx.font = `bold ${12 * scale}px sans-serif`;
    const tw = ctx.measureText(player.name).width;
    ctx.fillRect(-tw / 2 - 4, -size / 2 - 22 * scale, tw + 8, 16 * scale);
    ctx.fillStyle = '#ffffffee';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(player.name, 0, -size / 2 - 14 * scale);
  }

  // Direction indicator for local
  if (isLocal) {
    ctx.fillStyle = '#ffffffbb';
    ctx.beginPath();
    ctx.moveTo(0, -size / 2 - 8);
    ctx.lineTo(-8, -size / 2 - 18);
    ctx.lineTo(8, -size / 2 - 18);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffffaa';
    ctx.font = `bold ${9 * scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('YOU', 0, -size / 2 - 22);
  }

  ctx.restore();
}

function drawTail(ctx: CanvasRenderingContext2D, charId: CharacterId, size: number, t: number, color: string) {
  const tailWag = Math.sin(t * 8) * 0.5;
  const tailX = -size * 0.1;
  const tailY = size * 0.2;

  ctx.strokeStyle = color;
  ctx.lineWidth = size * 0.08;
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(tailX, tailY);
  const cx1 = tailX - size * 0.2;
  const cy1 = tailY + size * 0.15 + Math.sin(tailWag) * size * 0.1;
  const cx2 = tailX - size * 0.35 + Math.sin(tailWag + 1) * size * 0.1;
  const cy2 = tailY + Math.sin(tailWag + 0.5) * size * 0.15;
  ctx.bezierCurveTo(cx1, cy1, cx2, cy2, tailX - size * 0.4, tailY - size * 0.05 + Math.sin(tailWag) * size * 0.1);
  ctx.stroke();

  // Lion tail tuft
  if (charId === 'lion') {
    ctx.fillStyle = '#CC5500';
    ctx.beginPath();
    ctx.arc(tailX - size * 0.4, tailY - size * 0.05 + Math.sin(tailWag) * size * 0.1, size * 0.06, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBoostTrail(ctx: CanvasRenderingContext2D, charId: CharacterId, size: number, t: number) {
  if (charId === 'lion') {
    for (let i = 0; i < 8; i++) {
      const phase = t * 15 + i * 0.8;
      const flameX = Math.sin(phase) * 6;
      const flameY = size / 2 + i * 7;
      const flameSize = size / 3 - i * 1.5;
      if (flameSize <= 0) continue;
      const alpha = 1 - i / 8;
      const g = Math.floor(100 + (1 - i / 8) * 100);
      ctx.fillStyle = `rgba(255, ${g}, 0, ${alpha * 0.7})`;
      ctx.beginPath();
      ctx.arc(flameX, flameY, flameSize, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (charId === 'wolf') {
    for (let i = 0; i < 6; i++) {
      const phase = t * 12 + i * 1.2;
      const ix = Math.sin(phase) * 8;
      const iy = size / 2 + i * 8;
      const iSize = 3 - i * 0.3;
      if (iSize <= 0) continue;
      ctx.fillStyle = `rgba(150, 220, 255, ${0.8 - i * 0.12})`;
      ctx.beginPath();
      ctx.moveTo(ix, iy - iSize);
      ctx.lineTo(ix + iSize, iy);
      ctx.lineTo(ix, iy + iSize);
      ctx.lineTo(ix - iSize, iy);
      ctx.closePath();
      ctx.fill();
    }
  } else if (charId === 'unicorn') {
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

function drawCharacterBody(ctx: CanvasRenderingContext2D, charId: CharacterId, size: number, t: number, speed: number, boosting: boolean, isHit: boolean) {
  const charDef = CHARACTERS[charId];
  const bodyRadius = size / 2;
  const legSpeed = speed * 2.5;
  const legAngle = Math.sin(t * legSpeed) * 0.6;

  // --- Running legs (alternating front/back) ---
  const legLength = size * 0.35;
  const legWidth = size * 0.12;

  // Back left leg
  ctx.fillStyle = darkenColor(charDef.color, 0.7);
  ctx.save();
  ctx.translate(-bodyRadius * 0.25, bodyRadius * 0.4);
  ctx.rotate(legAngle);
  ctx.fillRect(-legWidth / 2, 0, legWidth, legLength);
  // Foot
  ctx.fillRect(-legWidth / 2 - 1, legLength - 3, legWidth + 2, 5);
  ctx.restore();

  // Back right leg
  ctx.save();
  ctx.translate(bodyRadius * 0.25, bodyRadius * 0.4);
  ctx.rotate(-legAngle);
  ctx.fillRect(-legWidth / 2, 0, legWidth, legLength);
  ctx.fillRect(-legWidth / 2 - 1, legLength - 3, legWidth + 2, 5);
  ctx.restore();

  // Front left leg
  ctx.fillStyle = charDef.color;
  ctx.save();
  ctx.translate(-bodyRadius * 0.35, bodyRadius * 0.45);
  ctx.rotate(-legAngle * 0.8);
  ctx.fillRect(-legWidth / 2, 0, legWidth, legLength * 0.9);
  ctx.fillRect(-legWidth / 2 - 1, legLength * 0.9 - 3, legWidth + 2, 5);
  ctx.restore();

  // Front right leg
  ctx.save();
  ctx.translate(bodyRadius * 0.35, bodyRadius * 0.45);
  ctx.rotate(legAngle * 0.8);
  ctx.fillRect(-legWidth / 2, 0, legWidth, legLength * 0.9);
  ctx.fillRect(-legWidth / 2 - 1, legLength * 0.9 - 3, legWidth + 2, 5);
  ctx.restore();

  // --- Body --- 
  const gradient = ctx.createRadialGradient(0, -size * 0.08, size * 0.1, 0, 0, bodyRadius);
  gradient.addColorStop(0, charDef.secondaryColor);
  gradient.addColorStop(1, charDef.color);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, bodyRadius, 0, Math.PI * 2);
  ctx.fill();

  // Hit flash overlay
  if (isHit) {
    ctx.fillStyle = '#FF000066';
    ctx.beginPath();
    ctx.arc(0, 0, bodyRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = '#ffffff55';
  ctx.lineWidth = 2;
  ctx.stroke();

  if (boosting) {
    ctx.strokeStyle = charDef.secondaryColor + '88';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, bodyRadius + 3, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Character details
  if (charId === 'lion') {
    drawLionDetails(ctx, bodyRadius);
  } else if (charId === 'wolf') {
    drawWolfDetails(ctx, bodyRadius);
  } else if (charId === 'unicorn') {
    drawUnicornDetails(ctx, bodyRadius, t);
  }
}

function drawLionDetails(ctx: CanvasRenderingContext2D, r: number) {
  ctx.fillStyle = '#CC5500';
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * r * 0.85, Math.sin(angle) * r * 0.85, r * 0.28, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#FFBB44';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(-r * 0.2, -r * 0.12, r * 0.09, 0, Math.PI * 2);
  ctx.arc(r * 0.2, -r * 0.12, r * 0.09, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(-r * 0.18, -r * 0.15, r * 0.035, 0, Math.PI * 2);
  ctx.arc(r * 0.22, -r * 0.15, r * 0.035, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#884422';
  ctx.beginPath();
  ctx.arc(0, r * 0.1, r * 0.08, 0, Math.PI * 2);
  ctx.fill();
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
  ctx.fillStyle = '#88BBFF';
  ctx.beginPath();
  ctx.ellipse(0, r * 0.15, r * 0.3, r * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
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
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(0, r * 0.08, r * 0.06, 0, Math.PI * 2);
  ctx.fill();
}

function drawUnicornDetails(ctx: CanvasRenderingContext2D, r: number, t: number) {
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
  ctx.strokeStyle = '#FFE066';
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const hy = -r * 0.6 - i * r * 0.15;
    ctx.beginPath();
    ctx.moveTo(-r * 0.08 + i * 0.02 * r, hy);
    ctx.lineTo(r * 0.08 - i * 0.02 * r, hy);
    ctx.stroke();
  }
  ctx.fillStyle = '#CC44FF';
  ctx.beginPath();
  ctx.ellipse(-r * 0.35, -r * 0.55, r * 0.12, r * 0.18, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(r * 0.35, -r * 0.55, r * 0.12, r * 0.18, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#EECCFF';
  ctx.beginPath();
  ctx.arc(0, r * 0.05, r * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#8833CC';
  ctx.beginPath();
  ctx.ellipse(-r * 0.18, -r * 0.05, r * 0.1, r * 0.12, 0, 0, Math.PI * 2);
  ctx.ellipse(r * 0.18, -r * 0.05, r * 0.1, r * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(-r * 0.15, -r * 0.1, r * 0.04, 0, Math.PI * 2);
  ctx.arc(r * 0.21, -r * 0.1, r * 0.04, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#CC88FF';
  ctx.beginPath();
  ctx.arc(0, r * 0.15, r * 0.04, 0, Math.PI * 2);
  ctx.fill();
  const sparkleHue = (t * 120) % 360;
  ctx.fillStyle = `hsla(${sparkleHue}, 100%, 80%, 0.7)`;
  for (let i = 0; i < 4; i++) {
    const angle = t * 3 + (i / 4) * Math.PI * 2;
    const dist = r * 0.9;
    drawStar(ctx, Math.cos(angle) * dist, Math.sin(angle) * dist, r * 0.08);
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
  particles: { x: number; y: number; life: number; color: string; size: number; type?: string }[],
  scale: number,
  isFight: boolean
) {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    if (isFight) {
      // In fight mode, particles are in screen coords
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    } else {
      ctx.arc(p.x * scale, p.y * scale, p.size * scale, 0, Math.PI * 2);
    }
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawHUD(ctx: CanvasRenderingContext2D, W: number, H: number, player: PlayerState, _isBattle: boolean) {
  const padding = 12;
  const fontSize = 18;

  const hudGrad = ctx.createLinearGradient(0, 0, 0, 55);
  hudGrad.addColorStop(0, '#000000cc');
  hudGrad.addColorStop(1, '#00000044');
  ctx.fillStyle = hudGrad;
  ctx.fillRect(0, 0, W, 55);

  const totalLaps = TRACK.RACE_LAPS;
  const lapText = `🏁 Lap ${Math.min(player.lap + 1, totalLaps)}/${totalLaps}`;

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(lapText, padding, 28);

  const speedPct = Math.round((player.speed / TRACK.BOOST_SPEED) * 100);
  ctx.textAlign = 'right';

  const barW = 70;
  const barH = 8;
  const barX = W - padding - barW;
  const barY = 14;

  ctx.fillStyle = '#333333';
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW, barH, 4);
  ctx.fill();

  const speedColor = player.boosting ? '#FFaa00' : speedPct > 70 ? '#44FF44' : '#88CC88';
  ctx.fillStyle = speedColor;
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW * Math.min(1, speedPct / 100), barH, 4);
  ctx.fill();

  ctx.fillStyle = '#ffffffcc';
  ctx.font = `bold 13px sans-serif`;
  ctx.fillText(`${speedPct}%`, W - padding, 36);

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

  const pulse = 1 + Math.sin(Date.now() * 0.012) * 0.12;

  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(pulse, pulse);

  ctx.fillStyle = '#000000';
  ctx.font = `bold 80px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 3, 3);

  const isGo = text.includes('GO');
  const isFight = text.includes('FIGHT');
  ctx.fillStyle = isGo ? '#FFD700' : isFight ? '#FF4444' : '#ffffff';
  ctx.fillText(text, 0, 0);

  ctx.restore();
}

function darkenColor(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.floor(r * factor)}, ${Math.floor(g * factor)}, ${Math.floor(b * factor)})`;
}
