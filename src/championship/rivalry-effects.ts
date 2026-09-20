import * as THREE from "three";
import { ATTACKS, RACE, draftWidthAtGap, type Match } from "./simulation";

/** World-space signals for the two decisions: follow a trail, read a wind-up. */
export class RivalryEffects {
  readonly group = new THREE.Group();
  private trails: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>[] = [];
  private tells: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>[] = [];

  constructor() {
    for (let slot = 0; slot < 2; slot++) {
      const geometry = new THREE.BufferGeometry();
      // Two tapered wind ribbons, not an opaque racing line covering hazards.
      const positions: number[] = [], indices: number[] = [];
      for (const side of [-1, 1]) {
        const base = positions.length / 3;
        for (let step = 0; step <= 16; step++) {
          const t = step / 16, spread = draftWidthAtGap(RACE.draftMinGap + t * (RACE.draftMaxGap - RACE.draftMinGap));
          positions.push(side * spread - .026, .07, -RACE.draftMinGap - t * (RACE.draftMaxGap - RACE.draftMinGap),
                         side * spread + .026, .07, -RACE.draftMinGap - t * (RACE.draftMaxGap - RACE.draftMinGap));
          if (step < 16) {
            const a = base + step * 2;
            indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
          }
        }
      }
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geometry.setIndex(indices);
      const trail = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
        color: slot === 0 ? 0xffe2a7 : 0xbde6ec, transparent: true,
        opacity: .24, depthWrite: false, side: THREE.DoubleSide,
      }));
      trail.frustumCulled = false;
      this.trails.push(trail);
      this.group.add(trail);
      const tell = new THREE.Mesh(new THREE.RingGeometry(.74, .80, 40), new THREE.MeshBasicMaterial({
        color: 0xffc576, transparent: true, opacity: .5, depthWrite: false,
        side: THREE.DoubleSide,
      }));
      tell.rotation.x = -Math.PI / 2;
      this.tells.push(tell);
      this.group.add(tell);
    }
  }

  update(match: Match | null, curve: (z: number) => number, time: number) {
    this.group.visible = Boolean(match && (match.phase === "race" || match.phase === "fight"));
    if (!match || !this.group.visible) return;
    for (const slot of [0, 1] as const) {
      const p = match.players[slot], follower = match.players[slot === 0 ? 1 : 0];
      const trail = this.trails[slot], tell = this.tells[slot];
      const gap = p.z - follower.z;
      trail.visible = match.phase === "race" && p.raceStatus === "running" && gap >= RACE.draftMinGap && gap <= RACE.draftMaxGap + 4;
      if (trail.visible) {
        trail.position.set(curve(p.z) + p.x, 0, p.z);
        const positions = trail.geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
          const behind = positions.getZ(i);
          const side = i < 34 ? -1 : 1;
          positions.setX(i, curve(p.z + behind) - curve(p.z)
            + side * draftWidthAtGap(-behind) + (i % 2 ? .026 : -.026));
        }
        positions.needsUpdate = true;
        const linedUp = Math.abs(p.x - follower.x) <= draftWidthAtGap(gap);
        trail.material.opacity = linedUp ? .42 : .17;
      }
      const strike = p.action === "attack" || p.action === "special";
      const timing = ATTACKS[p.character];
      const winding = strike && p.actionTime < p.strikeWindup;
      const active = strike && p.actionTime >= p.strikeWindup && p.actionTime < p.strikeWindup + timing.active;
      tell.visible = match.phase === "fight" && (winding || active || p.action === "evade");
      if (tell.visible) {
        tell.position.set(p.x, .035, 0);
        const charge = Math.min(1, p.actionTime / p.strikeWindup);
        tell.scale.setScalar(p.action === "evade" ? 1 : 1.18 - charge * .2);
        tell.material.color.set(p.action === "evade" ? 0xb5e9e7 : active ? 0xfff3d1 : 0xffbc69);
        tell.material.opacity = active ? .8 : p.action === "evade" ? .38 : .25 + charge * .35 + Math.sin(time * 14) * .04;
      }
    }
  }
}
