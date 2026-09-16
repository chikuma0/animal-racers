import * as THREE from "three";
import { FrameMeasurements } from "./measurements";
import { WorkMeasurements } from "./work-measurements";
import { ContactEffects } from "./impacts";
import { combatFraming, resultsFraming, sceneForPhase, type ScreenRect } from "./framing";
import {
  trailMaterial,
  cliffGeometry,
  canyonGround,
  desertDress,
  waterTower,
} from "./environment";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import {
  COURSE_LENGTH,
  OBSTACLES,
  RUN_SPEED,
  ATTACKS,
  createMatch,
  type Match,
  type CharacterId,
} from "./simulation";

const PALETTE = { lion: 0xff7735, wolf: 0x67c9e8, unicorn: 0xdba2ef };
const curve = (z: number) => Math.sin(z * 0.01) * 9 + Math.sin(z * 0.022) * 2;
const materials = new Map<string, THREE.MeshStandardMaterial>();
function mat(color: number, roughness = 0.8, metalness = 0) {
  const key = `${color}-${roughness}-${metalness}`;
  if (!materials.has(key))
    materials.set(
      key,
      new THREE.MeshStandardMaterial({ color, roughness, metalness }),
    );
  return materials.get(key)!;
}
function mesh(g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
}
function box(
  w: number,
  h: number,
  d: number,
  m: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
) {
  return mesh(new THREE.BoxGeometry(w, h, d), m, x, y, z);
}
function timberBox(w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) {
  const object = box(w, h, d, m, x, y, z);
  const { position, normal, uv } = object.geometry.attributes;
  // World-sized boards keep the floor and building walls from stretching the
  // same four planks over an entire room. Vertical faces retain vertical grain.
  for (let i = 0; i < position.count; i++) {
    const horizontal = Math.abs(normal.getY(i)) > 0.5;
    const side = Math.abs(normal.getX(i)) > 0.5;
    uv.setXY(i, (side ? position.getZ(i) : position.getX(i)) / 1.6,
      (horizontal ? position.getZ(i) : position.getY(i)) / 1.6);
  }
  return object;
}
function cylinder(
  r1: number,
  r2: number,
  h: number,
  m: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
  n = 12,
) {
  return mesh(new THREE.CylinderGeometry(r1, r2, h, n), m, x, y, z);
}
function rng(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  };
}
function sign(
  text: string,
  width: number,
  height: number,
  bg = "#392719",
  fg = "#f2d496",
) {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1024, 256);
  ctx.strokeStyle = fg;
  ctx.lineWidth = 5;
  ctx.strokeRect(14, 14, 996, 228);
  ctx.strokeRect(23, 23, 978, 210);
  ctx.fillStyle = fg;
  ctx.font = "bold 100px Georgia";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 512, 134, 940);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9 }),
  );
}
function woodTexture() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const a = c.getContext("2d")!;
  const rand = rng(86);
  a.fillStyle = "#91603e";
  a.fillRect(0, 0, 512, 512);
  for (let x = 0; x < 512; x += 64) {
    a.fillStyle = x % 128 ? "#845b3c" : "#976849";
    a.fillRect(x + 1, 0, 62, 512);
    for (let i = 0; i < 100; i++) {
      a.strokeStyle = `rgba(${rand() > 0.4 ? "35,22,14" : "227,174,104"},${0.03 + rand() * 0.18})`;
      a.beginPath();
      const px = x + rand() * 60;
      a.moveTo(px, 0);
      a.bezierCurveTo(px + rand() * 12, 180, px - rand() * 8, 350, px, 512);
      a.stroke();
    }
    a.fillStyle = "#33261e";
    a.fillRect(x, 0, 2, 512);
    for (const y of [20, 240, 490]) {
      a.beginPath();
      a.arc(x + 8, y, 2, 0, 7);
      a.arc(x + 55, y, 2, 0, 7);
      a.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function dustTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const a = c.getContext("2d")!;
  const g = a.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, "rgba(255,255,255,.8)");
  g.addColorStop(0.35, "rgba(255,255,255,.4)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  a.fillStyle = g;
  a.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}
function cactus() {
  const group = new THREE.Group(),
    m = mat(0x56634a);
  group.add(cylinder(0.18, 0.24, 2.6, m, 0, 1.3));
  for (const side of [-1, 1]) {
    const branch = cylinder(0.11, 0.14, 0.9, m, side * 0.35, 1.3 + side * 0.28);
    branch.rotation.z = (side * Math.PI) / 2;
    group.add(
      branch,
      cylinder(0.13, 0.14, 0.8, m, side * 0.72, 1.65 + side * 0.28),
    );
  }
  return group;
}
function barrel() {
  const group = new THREE.Group(),
    wood = mat(0x6e4127),
    iron = mat(0x302e2b, 0.6, 0.4);
  const profile = [
    new THREE.Vector2(0.35, 0),
    new THREE.Vector2(0.44, 0.2),
    new THREE.Vector2(0.48, 0.55),
    new THREE.Vector2(0.44, 0.95),
    new THREE.Vector2(0.35, 1.1),
  ];
  group.add(
    mesh(new THREE.LatheGeometry(profile, 12), wood),
    cylinder(0.35, 0.35, 0.05, wood, 0, 1.1),
  );
  for (const y of [0.15, 0.9])
    group.add(cylinder(0.452, 0.452, 0.08, iron, 0, y));
  return group;
}
function createTrophy() {
  const group = new THREE.Group(),
    gold = mat(0xdba746, 0.2, 0.85),
    edge = mat(0xffd984, 0.24, 0.72),
    dark = mat(0x292923, 0.5, 0.35);
  group.add(
    box(1.25, 0.28, 0.95, dark, 0, 0.14),
    box(1.06, 0.12, 0.82, gold, 0, 0.33),
  );
  group.add(
    cylinder(0.36, 0.46, 0.18, gold, 0, 0.47),
    cylinder(0.13, 0.24, 0.62, gold, 0, 0.85),
  );
  const bowl = [
    new THREE.Vector2(0.13, 0),
    new THREE.Vector2(0.27, 0.09),
    new THREE.Vector2(0.5, 0.31),
    new THREE.Vector2(0.65, 0.7),
    new THREE.Vector2(0.68, 0.83),
    new THREE.Vector2(0.62, 0.83),
    new THREE.Vector2(0.6, 0.69),
    new THREE.Vector2(0.44, 0.34),
    new THREE.Vector2(0.22, 0.17),
  ];
  group.add(mesh(new THREE.LatheGeometry(bowl, 40), gold, 0, 1.12));
  for (const side of [-1, 1]) {
    const handle = mesh(
      new THREE.TorusGeometry(0.39, 0.074, 10, 28, Math.PI * 1.75),
      edge,
      side * 0.63,
      1.61,
    );
    handle.scale.set(0.75, 1.07, 1);
    handle.rotation.z = side < 0 ? 0.4 : 2.73;
    group.add(handle);
  }
  const engraving = sign("DUST & GLORY", 0.92, 0.21, "#b68b40", "#332310");
  engraving.position.set(0, 0.17, 0.48);
  group.add(engraving);
  return group;
}

export type FrameReport = {
  samples: number;
  p50: number;
  p95: number;
  p99: number;
  over33: number;
  drawCalls: number;
  triangles: number;
  pixelRatio: number;
  loaded: boolean;
};
type CharacterForm = "race" | "upright";
type Avatar = {
  group: THREE.Group;
  model: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  clips: Map<string, THREE.AnimationAction>;
  active: string;
  character: CharacterId;
  form: CharacterForm;
};
export class ChampionshipRenderer {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(48, 1, 0.1, 250);
  private race = new THREE.Group();
  private saloon = new THREE.Group();
  private awards = new THREE.Group();
  private actors = new THREE.Group();
  private avatars: Avatar[] = [];
  private loader = new GLTFLoader();
  private cache = new Map<string, GLTF>();
  private timberMap: THREE.Texture = woodTexture();
  private timberMaterials = new Set<THREE.MeshStandardMaterial>();
  private buildingTimbers = new Map<number, THREE.MeshStandardMaterial>();
  private selection: CharacterId = "lion";
  private disposed = false;
  private preparing = true;
  private assetRequest = 0;
  private sun = new THREE.DirectionalLight(0xffe2ae, 3.2);
  private target = new THREE.Vector3();
  private cameraTarget = new THREE.Vector3();
  private trophy = createTrophy();
  private sparks: THREE.Points;
  private contacts = new ContactEffects(dustTexture());
  private particlePositions = new Float32Array(90 * 3);
  private frameTimes: number[] = [];
  private measurements = new FrameMeasurements();
  private work = new WorkMeasurements();
  private preparation = { elapsedMs: 0, frames: [] as { phase: string; z: number; submissionMs: number }[] };
  private environmentTarget: THREE.WebGLRenderTarget;
  private frameIndex = 0;
  private framesSeen = 0;
  private previousPhase = "";
  private viewport = { width: 1, height: 1 };
  private resultsPanel: ScreenRect | null = null;
  private phaseAge = 0;
  private captures: ((blob: Blob | null) => void)[] = [];
  private lastEvent = 0;
  private previousTick = -1;
  private impact = 0;
  private reduced =
    typeof matchMedia !== "undefined" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;
  private resizeObserver: ResizeObserver;
  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.scene.background = new THREE.Color(0xe9bc86);
    this.scene.fog = new THREE.FogExp2(0xe9bc86, 0.01);
    this.scene.add(new THREE.HemisphereLight(0xffeac7, 0x685743, 1.25));
    const environment = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.environmentTarget = pmrem.fromScene(environment, 0.04);
    this.scene.environment = this.environmentTarget.texture;
    this.scene.environmentIntensity = 0.36;
    environment.dispose();
    pmrem.dispose();
    this.sun.position.set(-15, 28, 14);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sun.shadow.camera, {
      left: -22,
      right: 22,
      top: 22,
      bottom: -22,
      near: 1,
      far: 85,
    });
    this.sun.shadow.bias = -0.001;
    this.sun.shadow.normalBias = 0.04;
    this.scene.add(
      this.sun,
      this.sun.target,
      this.race,
      this.saloon,
      this.awards,
      this.actors,
    );
    this.buildRace();
    this.buildSaloon();
    this.buildAwards();
    this.batchStatic(this.race, 40);
    this.batchStatic(this.saloon, 1000);
    this.batchStatic(this.awards, 1000);
    this.awards.add(this.trophy);
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(this.particlePositions, 3),
    );
    this.sparks = new THREE.Points(
      g,
      new THREE.PointsMaterial({
        color: 0xd8b783,
        size: 0.07,
        map: dustTexture(),
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      }),
    );
    this.scene.add(this.sparks, this.contacts.points);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
  }
  private resize() {
    const { width, height } = this.canvas.getBoundingClientRect();
    this.viewport = { width: Math.max(1, width), height: Math.max(1, height) };
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
  }
  setResultsPanel(bounds: ScreenRect | null) {
    this.resultsPanel = bounds;
  }
  async load() {
    const timber = new THREE.TextureLoader().loadAsync("/assets/environment/weathered-timber-v1.webp").then((texture) => {
      if (this.disposed) { texture.dispose(); return; }
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
      this.timberMap.dispose();
      this.timberMap = texture;
      this.timberMaterials.forEach((material) => { material.map = texture; });
    });
    await Promise.all([
      timber,
      ...(["lion", "wolf", "unicorn"] as CharacterId[]).flatMap((id) =>
        (["race", "upright"] as CharacterForm[]).map(async (form) => {
          const suffix = form === "upright" ? "-upright" : "";
          const gltf = await this.loader.loadAsync(`/assets/western/${id}${suffix}.glb`);
          if (!this.disposed) this.cache.set(`${id}:${form}`, gltf);
        }),
      ),
    ]);
    if (this.disposed) return;
    // Freeze the loading canvas while preparing both lighting configurations.
    // The saloon's two extra lights require different programs from the canyon;
    // preparing only the visible menu still left a first-fight compilation stall.
    for (const gltf of this.cache.values()) {
      gltf.scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.castShadow = true;
          object.receiveShadow = true;
        }
      });
    }
    for (const indoors of [false, true]) {
      this.saloon.visible = indoors;
      await this.renderer.compileAsync(this.scene, this.camera);
      for (const [key, gltf] of this.cache) {
        if (this.disposed) return;
        if (indoors && key.endsWith(":race")) continue;
        await this.renderer.compileAsync(gltf.scene, this.camera, this.scene);
      }
    }
    if (this.disposed) return;
    // compileAsync prepares programs, but geometry/texture uploads and shadow
    // draws still happen on first use. Pay representative first-draw costs
    // before enabling play. Keep these timings separate from active gameplay.
    const visibility = this.canvas.style.visibility;
    this.canvas.style.visibility = "hidden";
    const preparationStart = performance.now();
    try {
      for (const pair of [["lion", "wolf"], ["unicorn", "lion"]] as [CharacterId, CharacterId][]) {
        const sample = createMatch(pair, 71);
        for (const phase of ["countdown", "fight", "results"] as const) {
          sample.phase = phase;
          sample.players.forEach(p => { p.action = phase === "countdown" ? "race_idle" : "idle"; });
          if (phase === "results") {
            sample.result = { race: [25, 25], fight: [30, 20], total: [55, 45], winner: 0, reason: "Loading preview" };
            this.previousPhase = phase;
            this.phaseAge = 3;
          }
          await this.setCharacters(pair, phase === "countdown" ? "race" : "upright");
          for (const z of phase === "countdown" && pair[0] === "lion" ? [0, 250, 480] : [0]) {
            if (this.disposed) return;
            sample.players.forEach(p => { p.z = z; });
            this.framesSeen = 0;
            const start = performance.now();
            this.render(sample, 0, 1 / 60, 0, 0, true);
            this.preparation.frames.push({ phase, z, submissionMs: performance.now() - start });
            await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
          }
        }
      }
      if (this.disposed) return;
      await this.setCharacters([this.selection, this.selection === "wolf" ? "unicorn" : "wolf"]);
      this.previousPhase = "";
      this.previousTick = -1;
      this.framesSeen = 0;
      this.phaseAge = 0;
      const menuStart = performance.now();
      this.render(null, 0, 0, 0, 0, true);
      this.preparation.frames.push({ phase: "select", z: 0, submissionMs: performance.now() - menuStart });
      this.framesSeen = 0;
      this.preparing = false;
    } finally {
      this.preparation.elapsedMs = performance.now() - preparationStart;
      this.canvas.style.visibility = visibility;
    }
  }
  private releaseAvatar(avatar: Avatar) {
    avatar.mixer.stopAllAction();
    avatar.mixer.uncacheRoot(avatar.model);
    // Models share cached mesh/material resources, while cloned skeletons and
    // the marker/element geometry belong to this competitor instance.
    const skeletons = new Set<THREE.Skeleton>();
    avatar.model.traverse((object) => {
      if (object instanceof THREE.SkinnedMesh) skeletons.add(object.skeleton);
    });
    skeletons.forEach((skeleton) => skeleton.dispose());
    for (const child of avatar.group.children) {
      if (child === avatar.model) continue;
      child.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      });
    }
    this.actors.remove(avatar.group);
  }
  async setCharacters(ids: [CharacterId, CharacterId], form: CharacterForm = "upright") {
    const request = ++this.assetRequest;
    if (!ids.every((id) => this.cache.has(`${id}:${form}`))) return;
    if (
      this.avatars.length === 2 &&
      this.avatars.every((a, i) => a.character === ids[i] && a.form === form)
    )
      return;
    for (const a of this.avatars) this.releaseAvatar(a);
    this.avatars = [];
    if (request !== this.assetRequest || this.disposed) return;
    ids.forEach((id, i) => {
      const gltf = this.cache.get(`${id}:${form}`)!;
      const model = clone(gltf.scene);
      model.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      const group = new THREE.Group();
      group.add(model);
      const effect = this.makeElement(id);
      group.add(effect);
      const mixer = new THREE.AnimationMixer(model),
        clips = new Map<string, THREE.AnimationAction>();
      for (const clip of gltf.animations)
        clips.set(clip.name, mixer.clipAction(clip));
      const marker = mesh(
        i === 0
          ? new THREE.ConeGeometry(0.16, 0.22, 4)
          : new THREE.TorusGeometry(0.12, 0.035, 6, 12),
        new THREE.MeshBasicMaterial({ color: i === 0 ? 0xffe5ad : 0xd9f1ff }),
        0,
        3.2,
      );
      marker.name = "marker";
      group.add(marker);
      this.actors.add(group);
      this.avatars.push({
        group,
        model,
        mixer,
        clips,
        active: "",
        character: id,
        form,
      });
    });
  }
  setSelection(id: CharacterId) {
    this.selection = id;
    void this.setCharacters([id, id === "wolf" ? "unicorn" : "wolf"]);
  }
  private makeElement(id: CharacterId) {
    const group = new THREE.Group();
    group.name = "element";
    const color = PALETTE[id];
    const m = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    if (id === "lion") {
      for (let i = 0; i < 7; i++) {
        const flame = mesh(
          new THREE.ConeGeometry(0.14, 0.7 + (i % 3) * 0.12, 5),
          m,
          Math.sin(i * 9) * 0.4,
          0.7 + Math.cos(i * 3) * 0.4,
          0.3 + i * 0.18,
        );
        flame.rotation.x = Math.PI / 2;
        flame.name = "flame";
        group.add(flame);
      }
    } else if (id === "wolf") {
      for (let i = 0; i < 3; i++) {
        const ring = mesh(
          new THREE.TorusGeometry(0.42 + i * 0.12, 0.026, 5, 24),
          m,
          0,
          1.55,
          0.6 + i * 0.5,
        );
        ring.name = "wave";
        group.add(ring);
      }
    } else {
      const ward = new THREE.Group();
      ward.name = "ward";
      const shell = mesh(new THREE.CircleGeometry(0.9, 6), m, 0, 1.3, 0.65);
      ward.add(shell);
      const rim = mesh(
        new THREE.TorusGeometry(0.91, 0.045, 4, 6),
        new THREE.MeshBasicMaterial({ color: 0xffdf9e, transparent: true, depthWrite: false }),
        0,
        1.3,
        0.66,
      );
      ward.add(rim);
      group.add(ward);

      // The braced hooves launch an elemental pulse; they do not pretend to
      // physically reach the far edge of the special's contact volume.
      const pulse = new THREE.Group();
      pulse.name = "prism-pulse";
      pulse.position.set(0, 1.4, 0.65);
      const flare = new THREE.CylinderGeometry(0.72, 0.3, 1, 24, 1, true);
      flare.rotateX(Math.PI / 2); flare.translate(0, 0, 0.5);
      const colors = new Float32Array(flare.attributes.position.count * 3);
      const hue = new THREE.Color();
      for (let i = 0; i < flare.attributes.position.count; i++) {
        const angle = Math.atan2(flare.attributes.position.getY(i), flare.attributes.position.getX(i));
        hue.setHSL((angle / (2 * Math.PI) + 1) % 1, 0.65, 0.7);
        hue.toArray(colors, i * 3);
      }
      flare.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      pulse.add(mesh(flare, new THREE.MeshBasicMaterial({
        vertexColors: true, transparent: true, opacity: 0.3,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      })));
      pulse.add(mesh(new THREE.TorusGeometry(0.72, 0.035, 5, 24), new THREE.MeshBasicMaterial({
        color: 0xe6bcff, transparent: true, opacity: 0.8, depthWrite: false,
        blending: THREE.AdditiveBlending,
      }), 0, 0, 1));
      pulse.visible = false;
      group.add(pulse);
    }
    group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = false;
        object.receiveShadow = false;
      }
    });
    group.visible = false;
    return group;
  }
  private clip(
    a: Avatar,
    name: string,
    dt: number,
    speed = 1,
    elapsed?: number,
  ) {
    if (!a.clips.has(name))
      name = a.clips.has("fight_idle")
        ? "fight_idle"
        : (Array.from(a.clips.keys())[0] ?? "");
    const oneShot = [
      "jump",
      "land",
      "stumble",
      "transform",
      "attack",
      "special",
      "guard",
      "hit",
      "defeat",
      "celebrate",
    ].includes(name);
    if (name !== a.active) {
      const old = a.clips.get(a.active),
        action = a.clips.get(name);
      if (action) {
        action.reset().setEffectiveTimeScale(speed).fadeIn(0.1).play();
        action.setLoop(
          oneShot ? THREE.LoopOnce : THREE.LoopRepeat,
          oneShot ? 1 : Infinity,
        );
        action.clampWhenFinished = oneShot;
      }
      old?.fadeOut(0.1);
      a.active = name;
    }
    const action = a.clips.get(name);
    action?.setEffectiveTimeScale(speed);
    a.mixer.update(dt);
    if (oneShot && action && elapsed !== undefined) {
      action.enabled = true;
      action.paused = false;
      action.time = Math.min(
        Math.max(0, elapsed),
        action.getClip().duration - 0.0001,
      );
      a.mixer.update(0);
    }
  }
  private batchStatic(root: THREE.Group, chunkSize: number) {
    root.updateMatrixWorld(true);
    const groups = new Map<
        string,
        { material: THREE.Material; geometries: THREE.BufferGeometry[] }
      >(),
      originals: THREE.Mesh[] = [];
    root.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || Array.isArray(o.material)) return;
      const key =
        o.material.uuid +
        ":" +
        Math.floor(o.getWorldPosition(new THREE.Vector3()).z / chunkSize);
      const g = o.geometry.index
        ? o.geometry.toNonIndexed()
        : o.geometry.clone();
      g.applyMatrix4(o.matrixWorld);
      if (!g.getAttribute("uv"))
        g.setAttribute(
          "uv",
          new THREE.Float32BufferAttribute(
            new Float32Array(g.getAttribute("position").count * 2),
            2,
          ),
        );
      g.clearGroups();
      let entry = groups.get(key);
      if (!entry) {
        entry = { material: o.material, geometries: [] };
        groups.set(key, entry);
      }
      entry.geometries.push(g);
      originals.push(o);
    });
    for (const o of originals) {
      o.removeFromParent();
      o.geometry.dispose();
    }
    for (const entry of groups.values()) {
      const g = mergeGeometries(entry.geometries, false);
      if (g) {
        g.computeBoundingSphere();
        root.add(mesh(g, entry.material));
      }
      entry.geometries.forEach((a) => a.dispose());
    }
  }

  private buildRace() {
    this.race.add(
      canyonGround(curve, COURSE_LENGTH),
      desertDress(curve, COURSE_LENGTH),
    );
    for (const [z, side] of [
      [32, -1],
      [198, 1],
      [476, -1],
    ]) {
      const tower = waterTower();
      tower.position.set(curve(z) + side * 18, 0, z);
      this.race.add(tower);
    }
    const points: number[] = [],
      uv: number[] = [],
      idx: number[] = [];
    for (let k = 0; k <= 550; k++) {
      const z = k * 2 * (COURSE_LENGTH / 1000);
      points.push(curve(z) - 5.5, 0.01, z, curve(z) + 5.5, 0.01, z);
      uv.push(0, k / 6, 1, k / 6);
      if (k < 550) {
        const a = k * 2;
        idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    geom.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geom.setIndex(idx);
    geom.computeVertexNormals();
    this.race.add(mesh(geom, trailMaterial()));
    const random = rng(3729),
      rockMats = [
        new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: 1,
          flatShading: true,
        }),
      ];
    for (let i = 0; i < 100; i++) {
      const z = -35 + i * 11 * (COURSE_LENGTH / 1000);
      for (const side of [-1, 1]) {
        const r = 4 + random() * 8;
        const rock = mesh(
          cliffGeometry(r, 7 + random() * 23, i * 19 + (side + 2)),
          rockMats[0],
          curve(z) + side * (26 + random() * 42),
          -1,
          z,
        );
        rock.rotation.y = random() * 7;
        this.race.add(rock);
        if (i % 2 === 0) {
          const c = cactus();
          c.position.set(
            curve(z) + side * (7 + random() * 10),
            0,
            z + random() * 8,
          );
          c.scale.setScalar(0.6 + random() * 0.6);
          this.race.add(c);
        }
      }
    }
    const fenceMat = mat(0x765039);
    for (let i = 0; i < 130; i++) {
      const z = i * 8 * (COURSE_LENGTH / 1000);
      for (const side of [-1, 1]) {
        const post = box(
          0.16,
          1.1,
          0.16,
          fenceMat,
          curve(z) + side * 6.6,
          0.55,
          z,
        );
        this.race.add(post);
        if (i % 6 < 4) {
          const rail = box(
            0.09,
            0.1,
            7.8 * (COURSE_LENGTH / 1000),
            fenceMat,
            curve(z + 4 * (COURSE_LENGTH / 1000)) + side * 6.6,
            0.78,
            z + 4 * (COURSE_LENGTH / 1000),
          );
          rail.rotation.y = Math.atan2(
            curve(z + 8 * (COURSE_LENGTH / 1000)) - curve(z),
            8 * (COURSE_LENGTH / 1000),
          );
          this.race.add(rail);
        }
      }
    }
    for (const z of [15, 48, 82, 350, 384, 700, 735, 980].map(
      (z) => (z * COURSE_LENGTH) / 1000,
    ))
      for (const side of [-1, 1]) {
        const b = this.buildBuilding(
          z % 3 === 0
            ? "CANYON SUPPLY"
            : z % 2 === 0
              ? "COLD CREEK"
              : "SILVER SPUR",
          z === (15 * COURSE_LENGTH) / 1000,
        );
        b.position.set(curve(z) + side * 13, 0, z);
        b.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
        this.race.add(b);
      }
    for (const o of OBSTACLES) {
      const g = new THREE.Group();
      if (o.kind === "barrel") {
        const b = barrel();
        b.scale.set(o.width / 1.1, 1, o.width / 1.1);
        g.add(b);
      } else if (o.kind === "hurdle") {
        g.add(
          box(o.width, 0.6, 0.45, mat(0x85502b), 0, 0.3),
          box(o.width, 0.13, 0.55, mat(0xf3d6a1), 0, 0.68),
        );
        for (const side of [-1, 1])
          g.add(
            box(0.16, 0.92, 0.25, mat(0x47342a), (side * o.width) / 2, 0.46),
          );
      } else {
        g.add(
          box(o.width, 1.8, 0.55, mat(0x9a6439), 0, 0.9),
          box(o.width, 0.25, 0.6, mat(0x563c2b), 0, 1.9),
          box(0.3, 2.2, 0.6, mat(0x754b2c), -o.width / 2, 1.1),
          box(0.3, 2.2, 0.6, mat(0x754b2c), o.width / 2, 1.1),
        );
        const s = sign("← PASS →", o.width * 0.85, 0.5);
        s.position.set(0, 1.4, -0.31);
        s.rotation.y = Math.PI;
        g.add(s);
      }
      g.position.set(curve(o.z) + o.x, 0, o.z);
      this.race.add(g);
    }
    for (const z of [0, COURSE_LENGTH]) {
      const gate = new THREE.Group();
      gate.add(
        box(0.5, 5, 0.5, mat(0x543522), -5.5, 2.5),
        box(0.5, 5, 0.5, mat(0x543522), 5.5, 2.5),
        box(12, 0.45, 0.7, mat(0x543522), 0, 5),
      );
      const s = sign(z === 0 ? "THE CANYON RUN" : "FINISH", 9, 1.15);
      s.position.set(0, 4.1, -0.42);
      s.rotation.y = Math.PI;
      gate.add(s);
      gate.position.set(curve(z), 0, z);
      this.race.add(gate);
    }
  }
  private buildBuilding(label: string, saloon = false) {
    // Shared timber variants let the static batch combine repeated storefronts.
    const timber = (color: number) => {
      let material = this.buildingTimbers.get(color);
      if (!material) {
        material = new THREE.MeshStandardMaterial({ map: this.timberMap, color, roughness: .94 });
        this.buildingTimbers.set(color, material);
        this.timberMaterials.add(material);
      }
      return material;
    };
    const group = new THREE.Group();
    const style = saloon ? 0 : label === "CANYON SUPPLY" ? 1 : label === "COLD CREEK" ? 2 : 3;
    const wall = timber([0xd8b68a, 0x8eada5, 0xc0a497, 0xb78974][style]);
    const trim = timber(0xe3c997), darkWood = timber(0x73604a);
    const iron = mat(0x302e29, .62, .35), recess = mat(0x181d1b);
    const glass = mat(0x476d70, .27, .2);
    const board = (w: number, h: number, d: number, material: THREE.Material, x: number, y: number, z: number) => {
      const item = timberBox(w, h, d, material, x, y, z);
      group.add(item); return item;
    };
    const brace = (x1: number, y1: number, x2: number, y2: number, z: number) => {
      const item = board(.13, Math.hypot(x2 - x1, y2 - y1), .17, darkWood, (x1 + x2) / 2, (y1 + y2) / 2, z);
      item.rotation.z = -Math.atan2(x2 - x1, y2 - y1);
    };

    // A hollow shell and front wall segments create real reveal depth around
    // openings, instead of placing opaque coloured rectangles over a solid box.
    board(.22, 4.6, 6, wall, -3.9, 2.5, 0);
    board(.22, 4.6, 6, wall, 3.9, 2.5, 0);
    board(8, 4.6, .22, wall, 0, 2.5, -2.9);
    board(8, 1.8, .25, wall, 0, 3.85, 3);
    for (const [left, right] of [[-4, -3.4], [-1.7, -.85], [.85, 1.7], [3.4, 4]])
      board(right - left, 2.8, .25, wall, (left + right) / 2, 1.6, 3);
    for (const x of [-2.55, 2.55]) board(1.7, .8, .25, wall, x, .6, 3);
    board(8.1, .18, .35, trim, 0, 4.65, 3.1);
    for (const x of [-3.9, 3.9]) board(.2, 4.65, .35, trim, x, 2.5, 3.08);

    // Pitched roof behind a stepped western false front.
    for (const side of [-1, 1]) {
      const roof = board(8.4, .17, 3.3, darkWood, 0, 5.05, side * 1.5);
      roof.rotation.x = side * .19;
    }
    const profile = new THREE.Shape();
    const crown = style === 2 ? 5.95 : saloon ? 6.6 : 6.2;
    const outline = [[-4.15,4.65],[-4.15,5.65],[-3.15,5.65],[-3.15,crown-.25],[-1.8,crown-.25],[-1.8,crown],[1.8,crown],[1.8,crown-.25],[3.15,crown-.25],[3.15,5.65],[4.15,5.65],[4.15,4.65]];
    outline.forEach(([x,y],i) => i ? profile.lineTo(x,y) : profile.moveTo(x,y));
    profile.closePath();
    const front = new THREE.ExtrudeGeometry(profile,{depth:.24,bevelEnabled:false});
    const frontPositions=front.attributes.position, frontUv=front.attributes.uv;
    for(let i=0;i<frontPositions.count;i++) frontUv.setXY(i,frontPositions.getX(i)/1.6,frontPositions.getY(i)/1.6);
    group.add(mesh(front,wall,0,0,3.04));
    for(let i=1;i<outline.length-1;i++) {
      const [x1,y1]=outline[i-1], [x2,y2]=outline[i];
      if(y1===4.65 && y2===4.65) continue;
      const cap=board(Math.max(.13,Math.abs(x2-x1)+.13),Math.max(.13,Math.abs(y2-y1)+.13),.36,trim,(x1+x2)/2,(y1+y2)/2,3.14);
      cap.castShadow=true;
    }
    const fascia = saloon ? "DUST & GLORY" : label;
    board(7.35,1.05,.2,darkWood,0,5.3,3.34);
    const title=sign(fascia,7,.79,"#283a36","#ead4a5");
    title.position.set(0,5.3,3.46); group.add(title);

    // Deep window frames, divided panes, sill and short slatted shutters.
    for (const x of [-2.55,2.55]) {
      group.add(box(1.72,1.88,.08,recess,x,1.95,2.67),box(1.42,1.62,.06,glass,x,1.96,2.78));
      for (const side of [-1,1]) {
        board(.13,1.88,.37,trim,x+side*.8,1.95,3.02);
        board(.39,1.73,.1,darkWood,x+side*1.04,1.98,3.14);
        for(let slat=0;slat<8;slat++) {
          const blade=board(.34,.12,.09,wall,x+side*1.04,1.23+slat*.205,3.22);
          blade.rotation.x=-.18;
        }
      }
      board(1.72,.13,.36,trim,x,2.85,3.05);
      board(1.93,.16,.54,trim,x,1.05,3.1);
      board(.06,1.65,.12,trim,x,1.95,2.97);
      board(1.48,.07,.12,trim,x,1.96,2.98);
    }
    group.add(box(1.7,2.75,.08,recess,0,1.6,2.65));
    for(const side of [-1,1]) {
      board(.15,2.8,.38,trim,side*.87,1.6,3.06);
      const door=board(.76,saloon?1.35:2.42,.1,darkWood,side*.405,saloon?1.48:1.46,2.95);
      if(saloon) door.rotation.y=side*.12;
      board(.6,.12,.14,trim,side*.405,saloon?2.13:2.62,3.03);
      for(let slat=0;slat<(saloon?6:10);slat++) board(.6,.07,.1,wall,side*.405,.93+slat*.19,3.04);
      group.add(box(.065,.19,.055,iron,side*.12,1.47,3.12));
    }
    board(1.92,.2,.42,trim,0,3,3.1);
    board(1.48,.17,.1,trim,0,2.76,2.95);

    // Joined porch: visible boardwalk, layered steps and knee braces carrying
    // the awning. Posts/rails stay outside the central approach.
    board(9,.26,3.65,darkWood,0,.2,4.25);
    board(9.1,.065,3.72,wall,0,.36,4.25);
    for(const [depth,y,z] of [[.45,.09,6.4],[.4,.19,6.12]]) board(3.3,.14,depth,darkWood,0,y,z);
    const awning=board(9.15,.15,3.35,darkWood,0,3.27,4.4); awning.rotation.x=.075;
    board(9.25,.23,.19,trim,0,3.14,6.02);
    for(const x of [-4.1,-1.55,1.55,4.1]) {
      board(.18,2.75,.18,darkWood,x,1.71,5.93);
      board(.28,.17,.28,trim,x,.53,5.93);
      board(.28,.13,.28,trim,x,2.92,5.93);
      if(x!==-4.1) brace(x,2.55,x-.44,3.09,5.93);
      if(x!==4.1) brace(x,2.55,x+.44,3.09,5.93);
    }
    for(const side of [-1,1]) {
      board(2.2,.12,.16,trim,side*2.93,1.35,5.93);
      board(2.2,.09,.12,darkWood,side*2.93,.73,5.93);
      for(let i=0;i<6;i++) board(.065,.58,.07,wall,side*(1.96+i*.39),1.04,5.93);
    }
    return group;
  }
  private buildSaloon() {
    const wood = new THREE.MeshStandardMaterial({
      map: this.timberMap,
      roughness: 0.92,
      color: 0xd9c3a9,
    });
    this.timberMaterials.add(wood);
    const floor = timberBox(24, 0.2, 18, wood, 0, -0.12);
    this.saloon.add(
      floor,
      timberBox(24, 8, 0.3, wood, 0, 4, -6),
      timberBox(0.3, 8, 18, wood, -12, 4),
      timberBox(0.3, 8, 18, wood, 12, 4),
    );
    for (const x of [-10, -5, 0, 5, 10])
      this.saloon.add(
        box(0.25, 8, 0.5, mat(0x3b291e), x, 4, -5.6),
        box(0.24, 0.4, 18, mat(0x3b291e), x, 7.6),
      );
    this.saloon.add(
      box(17, 1.4, 1.5, mat(0x573421), 0, 0.7, -4),
      box(17.3, 0.18, 1.8, mat(0xa57448), 0, 1.45, -4),
    );
    const welcome = sign("THE LAST CHANCE", 8, 1.1);
    welcome.position.set(0, 5.3, -5.75);
    this.saloon.add(welcome);
    for (const x of [-8, -5, 5, 8]) {
      const shelf = box(2.6, 2.4, 0.2, mat(0x392921), x, 3.2, -5.72);
      this.saloon.add(shelf);
      for (let j = 0; j < 4; j++) {
        this.saloon.add(
          cylinder(
            0.075,
            0.1,
            0.45,
            mat(j % 2 ? 0x346c53 : 0x896333, 0.3),
            x - 1 + j * 0.6,
            2.7,
            -5.45,
          ),
          cylinder(
            0.04,
            0.05,
            0.13,
            mat(j % 2 ? 0x346c53 : 0x896333, 0.3),
            x - 1 + j * 0.6,
            3,
            -5.45,
          ),
        );
      }
    }
    const rug = box(11, 0.014, 3.7, mat(0x734831), 0, 0.01, 0);
    this.saloon.add(rug);
    for (const z of [-1.8, 1.8])
      this.saloon.add(box(11, 0.02, 0.08, mat(0xe1b971), 0, 0.03, z));
    for (const x of [-8, 8]) {
      this.saloon.add(
        cylinder(1.1, 1.1, 0.16, mat(0x664328), x, 1.3, 1.5),
        cylinder(0.13, 0.25, 1.3, mat(0x443221), x, 0.65, 1.5),
      );
      for (const z of [0, 3]) {
        this.saloon.add(cylinder(0.45, 0.45, 0.12, mat(0x513825), x, 0.65, z));
        for (const side of [-1, 1])
          this.saloon.add(
            box(0.09, 0.65, 0.09, mat(0x33251b), x + side * 0.3, 0.32, z),
          );
      }
    }
    for (const x of [-8, 8]) {
      const window = box(
        2,
        3,
        0.1,
        new THREE.MeshStandardMaterial({
          color: 0xffd391,
          emissive: 0xffba65,
          emissiveIntensity: 0.7,
        }),
        x,
        4,
        -5.8,
      );
      this.saloon.add(
        window,
        box(0.1, 3, 0.15, mat(0x382519), x, 4, -5.66),
        box(2, 0.1, 0.15, mat(0x382519), x, 4, -5.66),
      );
    }
    for (const x of [-5, 5]) {
      const light = new THREE.PointLight(0xffbf71, 12, 14, 2);
      light.position.set(x, 4, 1);
      this.saloon.add(light);
      const lantern = cylinder(0.22, 0.3, 0.65, mat(0x422e1f), x, 4.8, 0);
      this.saloon.add(
        lantern,
        cylinder(
          0.16,
          0.16,
          0.38,
          new THREE.MeshStandardMaterial({
            color: 0xffd397,
            emissive: 0xffa945,
            emissiveIntensity: 2,
          }),
          x,
          4.8,
          0,
        ),
      );
    }
  }
  private buildAwards() {
    const ground = mesh(new THREE.CircleGeometry(30, 64), mat(0xc5915f));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.1;
    this.awards.add(ground);
    const building = this.buildBuilding("DUST & GLORY", true);
    building.position.set(0, 0, -8);
    this.awards.add(building);
    for (const x of [-7, 7]) {
      const c = cactus();
      c.position.set(x, 0, -4);
      this.awards.add(c);
    }
    this.awards.add(
      cylinder(2.6, 2.8, 0.35, mat(0x805131), 0, 0.05),
      cylinder(2.63, 2.63, 0.04, mat(0xc8a260), 0, 0.24),
    );
  }
  render(
    match: Match | null,
    local: 0 | 1,
    delta: number,
    time: number,
    frameMs = delta * 1000,
    preparation = false,
  ) {
    if (this.disposed || (this.preparing && !preparation)) return;
    const workStart = performance.now();
    const phase = match?.phase ?? "select";
    if (phase !== "results" && this.camera.view?.enabled) this.camera.clearViewOffset();
    const sceneCut = sceneForPhase(phase) !== sceneForPhase(this.previousPhase);
    if (!match || match.tick < this.previousTick) this.lastEvent = 0;
    this.previousTick = match?.tick ?? -1;
    if (phase !== this.previousPhase) {
      this.previousPhase = phase;
      this.phaseAge = 0;
      this.contacts.clear();
      this.impact = 0;
    } else this.phaseAge += delta;
    const isRace = phase === "race" || phase === "countdown";
    const isFight = phase === "fight" || phase === "transition";
    this.race.visible = isRace;
    this.saloon.visible = isFight;
    this.awards.visible = !isRace && !isFight;
    this.trophy.visible =
      phase === "results" &&
      this.phaseAge > 2.5 &&
      Boolean(match?.players.some((p) => p.connected));
    this.scene.background = new THREE.Color(isFight ? 0x211c19 : 0xe9bc86);
    (this.scene.fog as THREE.FogExp2).color.set(isFight ? 0x32271f : 0xe9bc86);
    (this.scene.fog as THREE.FogExp2).density = isFight ? 0.019 : 0.008;
    this.sun.intensity = isFight ? 1.5 : 3.2;
    this.renderer.toneMappingExposure = isFight ? 1.2 : 1.05;
    if (match)
      void this.setCharacters(
        [match.players[0].character, match.players[1].character],
        isFight || phase === "results" ? "upright" : "race",
      );
    this.avatars.forEach((a, i) => {
      a.group.visible = true;
      const p = match?.players[i];
      if (isRace && p) {
        const lateral =
          (curve(p.z) + p.x - a.group.position.x) / Math.max(delta, 0.001);
        a.group.position.set(curve(p.z) + p.x, p.y, p.z);
        a.group.rotation.set(
          0,
          Math.atan2(curve(p.z + 1) - curve(p.z), 1),
          THREE.MathUtils.clamp(-lateral * 0.035, -0.14, 0.14),
        );
        this.clip(
          a,
          p.stun > 0
            ? "stumble"
            : p.y > 0.1
              ? "jump"
              : p.action === "land"
                ? "land"
                : p.speed > 0.1
                  ? "run"
                  : "race_idle",
          delta,
          p.action === "run" ? Math.max(0.25, p.speed / RUN_SPEED) : 1,
          p.actionTime,
        );
      } else if (isFight && p) {
        const lateralSpeed = delta > 0 ? (p.x - a.group.position.x) / delta : 0;
        a.group.position.set(p.x, p.y, 0);
        a.group.rotation.set(0, (p.facing * Math.PI) / 2, 0);
        let action = p.action;
        if (phase === "transition") action = "transform";
        else if (p.hp <= 0) action = "defeat";
        else if (p.stun > 0) action = "hit";
        else if (action === "idle") action = "fight_idle";
        else if (action === "move") action = "fight_move";
        this.clip(
          a,
          action,
          delta,
          action === "fight_move"
            ? Math.max(-1.5, Math.min(1.5, (lateralSpeed * p.facing) / 3.6))
            : 1,
          phase === "transition" ? match!.phaseTime : p.actionTime,
        );
      } else {
        const winner = match?.result?.winner;
        const win = phase === "results" && (winner === i || winner === null);
        a.group.position.set(
          phase === "select"
            ? i === 0
              ? 0
              : 3.2
            : winner === null
              ? i === 0
                ? -1.35
                : 1.35
              : win
                ? -0.5
                : 3.5,
          phase === "select" || (phase === "results" && win) ? 0.27 : 0,
          phase === "select" ? (i === 0 ? 0 : -1.2) : win ? 0 : -1,
        );
        a.group.rotation.set(
          0,
          phase === "select" ? 0.23 : win ? -0.12 : -0.3,
          0,
        );
        a.group.visible = phase === "select" ? i === 0 : true;
        this.clip(
          a,
          win
            ? this.phaseAge > 2.5
              ? "celebrate"
              : "fight_idle"
            : phase === "results"
              ? "defeat"
              : "fight_idle",
          delta,
          1,
          phase === "results"
            ? win
              ? Math.max(0, this.phaseAge - 2.5)
              : this.phaseAge
            : p?.actionTime,
        );
      }
      const element = a.group.getObjectByName("element");
      if (element) {
        const special = p?.action === "special",
          timing = ATTACKS[a.character];
        element.visible =
          Boolean(p) &&
          ((isRace && p!.boost > 0) ||
            (isFight &&
              special &&
              p!.actionTime < timing.windup + timing.active + 0.2));
        if (element.visible) {
          const power = isRace ? 1 : Math.min(1, p!.actionTime / timing.windup);
          element.scale.setScalar(0.6 + power * 0.4);
          element.rotation.z =
            a.character === "unicorn" ? Math.sin(time * 2) * 0.1 : 0;
          element.children.forEach((part, j) => {
            if (part.name === "wave") {
              // The howl occupies its full adjudicated reach on the active
              // frame. The small muzzle rings beforehand read as anticipation.
              const active = isRace || p!.actionTime + 1e-8 >= timing.windup;
              part.position.z = active
                ? 0.7 + (timing.reach - 0.7) * (j / 2)
                : 0.45 + j * 0.12;
              part.scale.setScalar(active ? 0.7 + j * 0.22 : 0.35 + power * 0.25);
            } else if (part.name === "flame") {
              part.scale.y = 0.7 + Math.sin(time * 35 + j) * 0.3;
            } else if (part.name === "prism-pulse") {
              part.visible = isFight && p!.actionTime + 1e-8 >= timing.windup && p!.actionTime < timing.windup + timing.active;
              part.scale.z = timing.reach - 1;
            } else if (part.name === "ward") {
              const elapsed = p!.actionTime;
              // .08–.52 s is the simulation's frontal protection window.
              const strength = isRace ? 1 : elapsed < 0.08 ? 0.2 : elapsed <= 0.52 ? 1 : Math.max(0, 1 - (elapsed - 0.52) / 0.12);
              part.children.forEach((piece, index) => {
                if (piece instanceof THREE.Mesh) (piece.material as THREE.MeshBasicMaterial).opacity = strength * (index === 0 ? 0.28 : 0.85);
              });
            }
          });
        }
      }
      const mark = a.group.getObjectByName("marker");
      if (mark) {
        mark.visible = Boolean(match) && phase !== "results";
        mark.position.y = isRace ? 2.15 : 3;
        mark.rotation.y = time * 0.6;
      }
    });
    if (isRace && match) {
      const p = match.players[local],
        z = p.z;
      this.cameraTarget.set(curve(z) + p.x * 0.35, 3.6, z - 7.3);
      this.target.set(curve(z + 16) + p.x * 0.15, 1.2, z + 16);
      this.camera.fov = 51 + (p.boost > 0 ? 3 : 0);
      this.sun.position.set(curve(z) - 17, 28, z + 10);
      this.sun.target.position.set(curve(z), 0, z + 5);
    } else if (isFight && match) {
      const frame = combatFraming(match.players[0], match.players[1], this.camera.aspect);
      this.cameraTarget.set(frame.x, frame.y, frame.z);
      this.target.set(frame.x, frame.lookY, 0);
      this.camera.fov = frame.fov;
      this.sun.position.set(-7, 10, 5);
      this.sun.target.position.set(0, 0, -2);
    } else {
      this.cameraTarget.set(
        phase === "results" ? 5.2 : 4.7,
        phase === "results" ? 3.2 : 2.8,
        phase === "results" ? 8.5 : 7.7,
      );
      this.target.set(0, 1.3, 0);
      this.camera.fov = 40;
      if (phase === "results") {
        const { width, height } = this.viewport;
        const frame = resultsFraming(width, height, this.resultsPanel, match?.result?.winner === null);
        this.cameraTarget.set(frame.position.x, frame.position.y, frame.position.z);
        this.target.set(frame.focus.x, frame.focus.y, frame.focus.z);
        this.camera.setViewOffset(width, height, frame.offsetX, frame.offsetY, width, height);
      }
      this.sun.position.set(-8, 16, 8);
      this.sun.target.position.set(0, 1, 0);
      const progress = Math.min(1, Math.max(0, (this.phaseAge - 2.5) / 0.35));
      const lift = progress * progress * (3 - 2 * progress),
        tie = match?.result?.winner === null;
      this.trophy.position.set(
        tie ? 0 : -0.5 + Math.sin(-0.12) * 0.52,
        tie ? 0.27 : 0.7 + lift * 1.008,
        tie ? 1.5 : Math.cos(-0.12) * 0.52,
      );
      this.trophy.scale.setScalar(0.66);
      this.trophy.rotation.y = tie ? 0 : -0.12;
    }
    this.camera.position.lerp(this.cameraTarget, 1 - Math.exp(-delta * 5));
    // These stages occupy separate worlds. Easing from the finish line at500m
    // showed empty space before the saloon; only movement within a stage eases.
    if (!this.framesSeen || sceneCut) this.camera.position.copy(this.cameraTarget);
    this.camera.lookAt(this.target);
    this.camera.updateProjectionMatrix();
    const events = match?.events ?? [];
    for (const e of events) {
      if (e.id > this.lastEvent) {
        if (phase === "fight" && ["hit", "block", "guard-break", "ward"].includes(e.type)) {
          const defender = match!.players[e.slot === 1 ? 1 : 0];
          this.contacts.emit(e.type, e.x + defender.facing * 0.35, 1.45 + defender.y, defender.facing, e.id);
          if (e.type === "hit" || e.type === "guard-break") this.impact = 0.18;
        }
        this.lastEvent = e.id;
      }
    }
    this.impact = Math.max(0, this.impact - delta);
    this.contacts.update(delta);
    if (this.impact > 0 && !this.reduced)
      this.camera.position.x += Math.sin(time * 90) * this.impact * 0.11;
    const anchor =
      isRace && match
        ? new THREE.Vector3(
            curve(match.players[local].z) + match.players[local].x,
            0,
            match.players[local].z,
          )
        : new THREE.Vector3(0, 0, 0);
    for (let i = 0; i < 90; i++) {
      const age = (time * (isRace ? 0.8 : 0.25) + i * 0.037) % 1;
      this.particlePositions[i * 3] = anchor.x + Math.sin(i * 34.21) * 6;
      this.particlePositions[i * 3 + 1] = isRace
        ? 0.12 + age * 0.6
        : 0.2 + age * 4;
      this.particlePositions[i * 3 + 2] =
        anchor.z + (isRace ? -2 - age * 13 : Math.cos(i * 2.8) * 5);
    }
    this.sparks.geometry.attributes.position.needsUpdate = true;
    this.sparks.visible = !this.reduced;
    const sceneUpdated = performance.now();
    this.renderer.render(this.scene, this.camera);
    const drawSubmitted = performance.now();
    if (!preparation) this.work.add(phase, document.hidden, {
      sceneUpdate: sceneUpdated - workStart,
      drawSubmission: drawSubmitted - sceneUpdated,
    });
    if (this.captures.length) {
      const requests = this.captures.splice(0);
      this.canvas.toBlob(
        (blob) => requests.forEach((resolve) => resolve(blob)),
        "image/png",
      );
    }
    if (!preparation) {
      this.frameTimes[this.frameIndex++ % 1800] = frameMs;
      this.measurements.add(phase, frameMs);
    }
    this.framesSeen++;
  }
  capture(): Promise<Blob | null> {
    return new Promise((resolve) => this.captures.push(resolve));
  }
  sessionMeasurements() {
    return this.measurements.report();
  }
  workMeasurements() {
    return { ...this.work.report(), preparation: this.preparation };
  }
  resetMeasurements() {
    this.measurements = new FrameMeasurements();
    this.work = new WorkMeasurements();
    this.frameTimes = [];
    this.frameIndex = 0;
  }
  report(): FrameReport {
    const samples = this.frameTimes.filter((n) => n > 0).sort((a, b) => a - b);
    const percentile = (p: number) =>
      Math.round((samples[Math.floor((samples.length - 1) * p)] ?? 0) * 100) /
      100;
    return {
      samples: samples.length,
      p50: percentile(0.5),
      p95: percentile(0.95),
      p99: percentile(0.99),
      over33: samples.filter((n) => n > 33.34).length,
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      pixelRatio: this.renderer.getPixelRatio(),
      loaded: this.cache.size === 6 && !this.preparing,
    };
  }
  dispose() {
    this.disposed = true;
    this.resizeObserver.disconnect();
    for (const a of this.avatars) this.releaseAvatar(a);
    const geometries = new Set<THREE.BufferGeometry>();
    const usedMaterials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    const collect = (o: THREE.Object3D) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Points) {
        geometries.add(o.geometry);
        const list = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of list) {
          usedMaterials.add(m);
          for (const value of Object.values(m)) {
            if (value instanceof THREE.Texture) textures.add(value);
          }
        }
      }
    };
    this.scene.traverse(collect);
    for (const gltf of this.cache.values()) gltf.scene.traverse(collect);
    geometries.forEach((g) => g.dispose());
    textures.forEach((t) => t.dispose());
    usedMaterials.forEach((m) => m.dispose());
    this.cache.clear();
    materials.clear();
    this.environmentTarget.dispose();
    this.renderer.dispose();
  }
}
