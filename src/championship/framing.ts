/** Fit both combatants while leaving room for limbs, jumps and the overlay HUD. */
export function combatFraming(
  first: { x: number; y: number },
  second: { x: number; y: number },
  aspect: number,
) {
  const x = (first.x + second.x) / 2;
  const airborne = Math.max(first.y, second.y, 0);
  const fov = 46;
  const halfAngle = Math.tan((fov * Math.PI) / 360);
  const width = Math.abs(first.x - second.x) + 2.4;
  const z = Math.max(
    8.2 + airborne * 1.1,
    width / (2 * halfAngle * Math.max(0.3, aspect) * 0.78),
  );
  const lookY = 1.7 + airborne * 0.45;
  return { x, y: lookY + 0.9, z, lookY, fov };
}

export function sceneForPhase(phase: string) {
  if (phase === "race" || phase === "countdown") return "course";
  if (phase === "fight" || phase === "transition") return "saloon";
  return "awards";
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
