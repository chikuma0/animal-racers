import { courseCenter, courseSlope } from "./course";
/** Fit both combatants while leaving room for limbs, jumps and the overlay HUD. */
export function combatFraming(
  first: { x: number; y: number },
  second: { x: number; y: number },
  aspect: number,
) {
  const x = (first.x + second.x) / 2;
  const airborne = Math.max(first.y, second.y, 0);
  const fov = 43;
  const halfAngle = Math.tan((fov * Math.PI) / 360);
  const width = Math.abs(first.x - second.x) + 2.4;
  const z = Math.max(
    7.25 + airborne * 1.1,
    width / (2 * halfAngle * Math.max(0.3, aspect) * 0.78),
  );
  const lookY = 1.6 + airborne * 0.45;
  return { x, y: lookY + 0.65, z, lookY, fov };
}

export function sceneForPhase(phase: string) {
  if (phase === "race" || phase === "countdown") return "course";
  if (phase === "fight" || phase === "transition") return "saloon";
  return "awards";
}

/** The saloon introduction has its own blocking, independent of race lanes. */
export function saloonPose(player: { x: number; y: number; facing: number }, slot: number, phase: string) {
  return phase === "transition"
    ? { x: slot === 0 ? -1.75 : 1.75, y: 0, facing: slot === 0 ? 1 : -1 }
    : { x: player.x, y: player.y, facing: player.facing };
}

export interface ScreenRect { left: number; top: number; width: number; height: number }

/** Compose the cup ceremony in the space actually left by the score card. */
export function resultsFraming(width: number, height: number, panel: ScreenRect | null, tie: boolean) {
  const card = panel ?? (width >= 750
    ? { left: width * .47, top: 64, width: width * .48, height: height - 88 }
    : { left: 16, top: height * .55, width: width - 32, height: height * .45 });
  const spaces = [
    { left: 16, top: 64, width: Math.max(1, card.left - 32), height: Math.max(1, height - 88) },
    { left: 16, top: 64, width: Math.max(1, width - 32), height: Math.max(1, card.top - 80) },
  ];
  const subjectWidth = tie ? 5.8 : 3.5, subjectHeight = 3.6;
  const fit = (space: ScreenRect) => Math.min(space.width / subjectWidth, space.height / subjectHeight);
  const area = fit(spaces[0]) >= fit(spaces[1]) ? spaces[0] : spaces[1];
  const tangent = Math.tan(20 * Math.PI / 180);
  const distance = Math.max(8,
    subjectHeight / (2 * tangent * (area.height / height) * .8),
    subjectWidth / (2 * tangent * (area.width / height) * .8));
  const focus = { x: tie ? 0 : -.5, y: 1.65, z: .1 };
  const scale = distance / Math.hypot(5.2, 1.5, 8.5);
  return {
    area, focus, fov: 40,
    position: { x: focus.x + 5.2 * scale, y: focus.y + 1.5 * scale, z: focus.z + 8.5 * scale },
    offsetX: width / 2 - (area.left + area.width / 2),
    offsetY: height / 2 - (area.top + area.height / 2),
  };
}

/** Follow the local animal along the road tangent; leave room below for thumbs. */
export function raceFraming(player: { x: number; z: number; speed: number }, aspect: number) {
  const x = courseCenter(player.z) + player.x;
  const slope = courseSlope(player.z), norm = Math.hypot(slope, 1);
  const distance = Math.max(9.6, 5.6 / Math.max(.3, aspect));
  const backX = slope / norm * distance, backZ = distance / norm;
  return {
    position: { x: x - backX, y: 5.4 + Math.max(0, distance - 9.6) * .3, z: player.z - backZ },
    target: { x: x + slope / norm * 3, y: .9, z: player.z + 3 / norm },
    fov: 51 + Math.min(3, Math.max(0, player.speed - 14) * 1.65),
  };
}
