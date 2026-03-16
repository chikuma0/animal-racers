import { CHARACTER_ART, ENV_ART, getAssetImage } from '../assets';
import { CharacterId, FightState, TRACK } from '../types';

type RaceArtState = 'idle' | 'stride' | 'boost';
type FightArtState = 'idle' | 'punch' | 'special' | 'hit';

function drawRepeatedStrip(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  offsetX: number,
  alpha = 1
) {
  const tileWidth = (image.naturalWidth / image.naturalHeight) * height;
  const startX = x - ((offsetX % tileWidth) + tileWidth);
  ctx.save();
  ctx.globalAlpha = alpha;
  for (let currentX = startX; currentX < x + width + tileWidth; currentX += tileWidth) {
    ctx.drawImage(image, currentX, y, tileWidth, height);
  }
  ctx.restore();
}

function getFightArtState(fight: FightState): FightArtState {
  if (fight.dead || fight.freezeTimer > 0 || fight.hitStunTimer > 0) {
    return 'hit';
  }

  if (fight.specialActive || fight.blockTimer > 0 || fight.dashActive) {
    return 'special';
  }

  if (fight.punching) {
    return 'punch';
  }

  return 'idle';
}

function getRaceArtState(boosting: boolean, speed: number): RaceArtState {
  if (boosting) {
    return 'boost';
  }

  if (speed > TRACK.BASE_SPEED * 0.86) {
    return Math.floor(Date.now() / 110) % 2 === 0 ? 'stride' : 'idle';
  }

  return 'idle';
}

function drawCenteredSprite(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
  glowColor: string,
  emphasis: number
) {
  ctx.save();
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 18 + emphasis * 18;
  ctx.drawImage(image, -width / 2, -height / 2, width, height);
  ctx.restore();
}

export function drawRaceBackdropArt(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  cameraY: number
) {
  const canopy = getAssetImage(ENV_ART.jungleCanopy);
  if (canopy) {
    drawRepeatedStrip(ctx, canopy, 0, 0, W, H * 0.28, cameraY * 0.08, 0.72);
    drawRepeatedStrip(ctx, canopy, 0, H * 0.05, W, H * 0.18, cameraY * 0.14, 0.32);
  }

  const totem = getAssetImage(ENV_ART.stoneTotem);
  if (!totem) {
    return;
  }

  const propHeight = Math.max(86, H * 0.16);
  const propWidth = (totem.naturalWidth / totem.naturalHeight) * propHeight;
  const stride = propHeight * 1.35;
  const offset = (cameraY * 0.55) % stride;

  ctx.save();
  ctx.globalAlpha = 0.55;
  for (let y = -stride + offset; y < H + stride; y += stride) {
    ctx.drawImage(totem, 14, y, propWidth, propHeight);
    ctx.drawImage(totem, W - propWidth - 14, y + stride * 0.3, propWidth, propHeight);
  }
  ctx.restore();
}

export function drawArenaBackdropArt(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number
) {
  const crowd = getAssetImage(ENV_ART.arenaCrowd);
  if (!crowd) {
    return;
  }

  const artHeight = H * 0.44;
  const artWidth = (crowd.naturalWidth / crowd.naturalHeight) * artHeight;
  const x = (W - artWidth) / 2;
  const y = H * 0.22;

  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.drawImage(crowd, x, y, artWidth, artHeight);
  ctx.restore();
}

export function drawRaceCharacterSprite(
  ctx: CanvasRenderingContext2D,
  charId: CharacterId,
  size: number,
  boosting: boolean,
  speed: number,
  isHit: boolean
): boolean {
  const art = CHARACTER_ART[charId];
  const spriteState = getRaceArtState(boosting, speed);
  const sprite = getAssetImage(art.race[spriteState]);
  if (!sprite) {
    return false;
  }

  const emphasis = spriteState === 'boost' ? 1 : spriteState === 'stride' ? 0.35 : 0;
  const width = size * 1.52;
  const height = size * 1.34;

  if (boosting) {
    ctx.save();
    ctx.globalAlpha = 0.38;
    ctx.fillStyle = art.accent;
    ctx.beginPath();
    ctx.ellipse(-size * 0.15, size * 0.28, size * 0.92, size * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawCenteredSprite(ctx, sprite, width, height, art.glow, emphasis);

  if (isHit) {
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#FF4D4D';
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.6, size * 0.56, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  return true;
}

export function drawFighterSprite(
  ctx: CanvasRenderingContext2D,
  charId: CharacterId,
  pw: number,
  ph: number,
  fight: FightState,
  isHit: boolean
): boolean {
  const art = CHARACTER_ART[charId];
  const spriteState = getFightArtState(fight);
  const sprite = getAssetImage(art.fight[spriteState]);
  if (!sprite) {
    return false;
  }

  const width = pw * 1.48;
  const height = ph * 1.3;
  const emphasis = spriteState === 'special' ? 1 : 0.2;
  const bob = spriteState === 'idle' ? Math.sin(Date.now() * 0.006) * 1.5 : 0;
  const airborneTilt = !fight.grounded ? (-fight.facing * 0.16) : 0;
  const moveTilt = Math.abs(fight.fvx) > 1 ? fight.facing * 0.05 : 0;
  const hitTilt = spriteState === 'hit' ? -fight.facing * 0.12 : 0;

  ctx.save();
  ctx.translate(0, -ph * 0.08 + bob);
  ctx.rotate(airborneTilt + moveTilt + hitTilt);
  if (spriteState === 'punch') {
    ctx.translate(fight.facing * pw * 0.08, 0);
  }
  if (spriteState === 'special') {
    ctx.translate(fight.facing * pw * 0.04, -ph * 0.04);
  }
  drawCenteredSprite(ctx, sprite, width, height, art.glow, emphasis);
  ctx.restore();

  if (fight.specialActive || fight.blockTimer > 0) {
    ctx.save();
    ctx.globalAlpha = 0.24;
    ctx.strokeStyle = art.accent;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(0, -ph * 0.24, pw * 0.56, ph * 0.42, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  if (isHit) {
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#FF5D67';
    ctx.beginPath();
    ctx.ellipse(0, -ph * 0.18, pw * 0.54, ph * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  return true;
}

export function drawPortraitChip(
  ctx: CanvasRenderingContext2D,
  charId: CharacterId,
  x: number,
  y: number,
  size: number
): boolean {
  const art = CHARACTER_ART[charId];
  const sprite = getAssetImage(art.portrait ?? art.racer);
  if (!sprite) {
    return false;
  }

  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#091018';
  ctx.beginPath();
  ctx.roundRect(-size / 2, -size / 2, size, size, 12);
  ctx.fill();
  ctx.strokeStyle = art.accent;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(-size / 2 + 3, -size / 2 + 3, size - 6, size - 6);
  ctx.clip();
  drawCenteredSprite(ctx, sprite, size * 0.95, size * 0.95, art.glow, 0.2);
  ctx.restore();
  return true;
}
