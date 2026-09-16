import * as THREE from "three";

/** A bounded, single-draw contact accent. Only authoritative contact events emit. */
export class ContactEffects {
  readonly points: THREE.Points;
  private readonly capacity = 96;
  private positions = new Float32Array(this.capacity * 3);
  private colors = new Float32Array(this.capacity * 4);
  private velocities = new Float32Array(this.capacity * 3);
  private remaining = new Float32Array(this.capacity);
  private lifetimes = new Float32Array(this.capacity);
  private cursor = 0;

  constructor(texture: THREE.Texture) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute("color", new THREE.BufferAttribute(this.colors, 4).setUsage(THREE.DynamicDrawUsage));
    this.points = new THREE.Points(geometry, new THREE.PointsMaterial({
      map: texture, size: 0.12, vertexColors: true,
      transparent: true, depthWrite: false, toneMapped: false,
    }));
    this.points.frustumCulled = false;
    this.points.visible = false;
  }

  emit(type: string, x: number, y: number, facing: number, seed: number) {
    const count = type === "guard-break" ? 12 : type === "hit" ? 8 : 5;
    const lifetime = type === "guard-break" ? 0.28 : 0.18;
    const color = new THREE.Color(type === "guard-break" ? 0xffb24d : type === "hit" ? 0xffe1a2 : type === "ward" ? 0xcceee7 : 0xe1ecff);
    for (let j = 0; j < count; j++) {
      const i = this.cursor++ % this.capacity;
      const angle = j / count * Math.PI * 2 + seed * 0.63;
      const speed = 1.2 + (j % 3) * 0.35;
      this.positions.set([x, y, 0.38], i * 3);
      this.velocities.set([Math.cos(angle) * speed - facing * 0.45, Math.sin(angle) * speed, (j % 2 ? 1 : -1) * 0.25], i * 3);
      this.colors.set([color.r, color.g, color.b, 1], i * 4);
      this.remaining[i] = this.lifetimes[i] = lifetime;
    }
  }

  clear() {
    this.remaining.fill(0);
    this.colors.fill(0);
    this.points.visible = false;
  }

  update(dt: number) {
    let active = false;
    for (let i = 0; i < this.capacity; i++) {
      if (this.remaining[i] <= 0) continue;
      this.remaining[i] = Math.max(0, this.remaining[i] - dt);
      const fade = this.remaining[i] / this.lifetimes[i];
      this.colors[i * 4 + 3] = fade * fade;
      for (let axis = 0; axis < 3; axis++) this.positions[i * 3 + axis] += this.velocities[i * 3 + axis] * dt;
      active ||= fade > 0;
    }
    this.points.visible = active;
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}
