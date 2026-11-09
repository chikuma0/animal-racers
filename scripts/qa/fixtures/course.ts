/** One centreline for scenery, road frames and equal-rule race steering. */
export const COURSE_MAX_SECOND_DERIVATIVE = .007128 + .00722;
export const courseCenter = (z: number): number => Math.sin(z * .018) * 22 + Math.sin(z * .038) * 5;
export const courseSlope = (z: number): number => Math.cos(z * .018) * .396 + Math.cos(z * .038) * .19;
export function courseCurvature(z: number): number {
  const slope = courseSlope(z);
  return (-Math.sin(z * .018) * .007128 - Math.sin(z * .038) * .00722) / Math.pow(1 + slope * slope, 1.5);
}
