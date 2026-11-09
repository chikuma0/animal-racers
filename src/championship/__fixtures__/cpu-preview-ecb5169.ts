// Frozen original CPU from preview ecb5169e9917 for Hard parity checks.
import { neutralInput, strikePhase, OBSTACLES, RACE, type Match, type Slot, type Input } from '../simulation';
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
function noise(seed: number, decision: number, slot: Slot): number {
  let n = (seed ^ Math.imul(decision + 1, 0x45d9f3b) ^ Math.imul(slot + 1, 0x9e3779b9)) >>> 0;
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
/** Open beginner behavior: 200ms decisions, delayed imperfect reads, ordinary inputs. */
export function cpuInput(match: Match, slot: Slot): Input {
  const player = match.players[slot], rival = match.players[slot === 0 ? 1 : 0];
  if (match.tick < player.ai.nextTick) return { ...player.ai.input };
  player.ai.nextTick = match.tick + 12;
  const decision = Math.floor(match.tick / 12), roll = noise(match.seed, decision, slot), input = neutralInput();
  if (match.phase === 'race' && player.raceStatus === 'running') {
    const gap = rival.z - player.z;
    let target = gap > RACE.draftMinGap && gap < 14 ? rival.x : slot === 0 ? -1.3 : 1.3;
    if (gap > 0 && gap < 3.4) target = clamp(rival.x + (rival.x > 0 ? -1 : 1) * 1.8, -3.5, 3.5);
    const upcoming = OBSTACLES.filter(obstacle => obstacle.z > player.z && obstacle.z - player.z < 16);
    const nearest = upcoming[0];
    if (nearest) {
      const row = upcoming.filter(obstacle => obstacle.z === nearest.z);
      const inPath = row.find(obstacle => Math.abs(player.x - obstacle.x) < obstacle.width / 2 + .5);
      if (inPath && inPath.kind !== 'arch') input.jump = inPath.z - player.z < player.speed * .43 && inPath.z - player.z > player.speed * .16;
      else if (inPath) {
        const lanes = [-3, 0, 3].filter(x => row.every(obstacle => Math.abs(x - obstacle.x) > obstacle.width / 2 + .55));
        target = lanes.sort((a, b) => Math.abs(a - player.x) - Math.abs(b - player.x))[0] ?? -Math.sign(inPath.x || 1) * 3.3;
      }
    }
    input.move = clamp((target - player.x) * 1.6, -1, 1);
  } else if (match.phase === 'fight') {
    const distance = Math.abs(rival.x - player.x), toward = Math.sign(rival.x - player.x), rivalPhase = strikePhase(rival);
    const powerThreat = rival.strikeKind === 'power' && rivalPhase === 'windup' && rival.actionTime >= .16 && distance < 2.4;
    const quickThreat = rival.strikeKind === 'quick' && rival.action === 'attack' && distance < 2.4
      && (rivalPhase === 'windup' || rivalPhase === 'active' || rival.comboStep === 0 && rival.comboWindow > 0);
    const free = player.stun === 0 && player.action !== 'attack' && player.action !== 'evade';
    if (player.action === 'attack' && player.strikeKind === 'quick' && player.comboStep === 0 && player.comboWindow > 0 && !player.ai.input.attack && roll < .65) input.attack = true;
    else if (free && powerThreat && player.dodgeCooldown === 0 && roll < .75) { input.jump = true; input.move = -toward; }
    else if (free && !player.guardBroken && player.guard > 20 && distance < 2.2 && roll < (quickThreat ? .75 : .32)) input.guard = true;
    else if (free) {
      const ready = match.tick >= player.ai.nextAttackTick;
      input.move = distance > 1.81 && (ready || rivalPhase === 'recovery') ? toward * .78 : 0;
      if (player.counterWindow > 0) input.move = distance > 1.81 ? toward : 0;
      if (match.fightTime >= 1.8 && distance <= 1.83 && (ready || player.counterWindow > 0)) {
        input.special = player.counterWindow === 0 && (rival.action === 'guard' || roll < .35); input.attack = !input.special;
        player.ai.nextAttackTick = match.tick + 96 + Math.floor(roll * 36);
      }
    }
  }
  player.ai.input = input; return { ...input };
}
