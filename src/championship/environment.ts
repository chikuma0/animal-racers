import * as THREE from "three";

/** Original, deterministic surface authoring. No external textures or asset packs. */
function random(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  };
}

export function trailMaterial() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1024;
  const c = canvas.getContext("2d")!,
    rand = random(452);
  c.fillStyle = "#a77a50";
  c.fillRect(0, 0, 1024, 1024);
  // Broad mottled pigment first, then fine grains and travelling wheel ruts.
  for (let n = 0; n < 1800; n++) {
    const x = rand() * 1024,
      y = rand() * 1024,
      r = 8 + rand() * 60;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(
      0,
      rand() > 0.5 ? "rgba(245,210,153,.06)" : "rgba(82,48,29,.06)",
    );
    g.addColorStop(1, "transparent");
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (const center of [260, 760]) {
    for (let k = 0; k < 22; k++) {
      c.strokeStyle = `rgba(78,49,30,${0.01 + rand() * 0.035})`;
      c.lineWidth = 2 + rand() * 8;
      c.beginPath();
      for (let y = 0; y <= 1024; y += 16) {
        const x = center + Math.sin((y * Math.PI) / 512) * 12 + (k - 11) * 2.4;
        if (y === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.stroke();
    }
  }
  for (let n = 0; n < 50000; n++) {
    c.fillStyle =
      rand() > 0.48 ? "rgba(244,222,178,.15)" : "rgba(60,39,24,.12)";
    const r = 0.3 + rand() * 1.8;
    c.fillRect(rand() * 1024, rand() * 1024, r, r);
  }
  for (let n = 0; n < 380; n++) {
    const x = rand() * 1024,
      y = rand() * 1024,
      r = 1 + rand() * 3;
    c.fillStyle = "#846644";
    c.beginPath();
    c.ellipse(x, y, r, r * 0.6, rand() * 3, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "rgba(232,201,144,.3)";
    c.fillRect(x - r, y - r * 0.5, r * 1.6, 0.8);
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 4;
  return new THREE.MeshStandardMaterial({
    map,
    bumpMap: map,
    bumpScale: 0.028,
    roughness: 1,
    color: 0xf4e3c3,
  });
}

export function cliffGeometry(radius: number, height: number, seed: number) {
  const rand = random(seed),
    rings = 18,
    segments = 20,
    positions: number[] = [],
    colors: number[] = [],
    uv: number[] = [],
    indices: number[] = [];
  const indent = Array.from({ length: segments }, () => 0.84 + rand() * 0.23);
  const ridge = new THREE.Color(),
    lower = new THREE.Color("#824b39"),
    upper = new THREE.Color("#c78156");
  for (let row = 0; row <= rings; row++) {
    const t = row / rings;
    // A broad talus foot, stepped sedimentary ledges, and irregular eroded crown.
    const profile =
      1.16 - 0.52 * t + 0.13 * Math.sin(t * 4.5) + 0.035 * Math.sin(t * 68);
    for (let j = 0; j < segments; j++) {
      const a = (j / segments) * Math.PI * 2,
        r =
          radius *
          profile *
          indent[j] *
          (1 + 0.027 * Math.sin(j * 3.1 + row * 0.7));
      const crown = row === rings ? 0.96 + 0.035 * Math.sin(j * 2.6 + seed) : 1;
      positions.push(Math.cos(a) * r, height * t * crown, Math.sin(a) * r);
      const band =
        0.12 * Math.sin(t * 64 + seed * 0.05) + 0.08 * Math.sin(t * 19);
      ridge
        .copy(lower)
        .lerp(upper, THREE.MathUtils.clamp(0.25 + 0.55 * t + band, 0, 1));
      ridge.multiplyScalar(0.94 + rand() * 0.09);
      colors.push(ridge.r, ridge.g, ridge.b);
      uv.push(j / segments, t);
    }
  }
  for (let row = 0; row < rings; row++)
    for (let j = 0; j < segments; j++) {
      const a = row * segments + j,
        b = row * segments + ((j + 1) % segments);
      indices.push(a, a + segments, b, b, a + segments, b + segments);
    }
  const center = positions.length / 3;
  positions.push(0, height * 0.976, 0);
  colors.push(upper.r, upper.g, upper.b);
  uv.push(0.5, 0.5);
  const bottom = center + 1;
  positions.push(0, 0, 0);
  colors.push(lower.r, lower.g, lower.b);
  uv.push(0.5, 0.5);
  for (let j = 0; j < segments; j++) {
    indices.push(
      center,
      rings * segments + ((j + 1) % segments),
      rings * segments + j,
    );
    indices.push(bottom, j, (j + 1) % segments);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

export function canyonGround(curve: (z: number) => number, length: number) {
  const positions: number[] = [],
    colors: number[] = [],
    uv: number[] = [],
    indices: number[] = [],
    across = 40,
    along = 155;
  const sand = new THREE.Color("#bd8d5d"),
    shade = new THREE.Color("#96603f"),
    color = new THREE.Color();
  for (let j = 0; j <= along; j++)
    for (let i = 0; i <= across; i++) {
      const z = -50 + (j * (length + 120)) / along,
        x = (i / across - 0.5) * 220,
        distance = Math.abs(x);
      const rise = Math.max(0, (distance - 8) / 100);
      const h =
        -0.095 +
        rise *
          (1.4 +
            Math.sin(x * 0.06 + z * 0.014) * 1.3 +
            Math.sin(z * 0.09 + x * 0.031) * 0.6);
      positions.push(x + curve(z), h, z);
      uv.push(x / 12, z / 12);
      color
        .copy(sand)
        .lerp(
          shade,
          Math.max(
            0,
            Math.min(0.7, rise * 0.4 + Math.sin(z * 0.14 + x * 0.22) * 0.09),
          ),
        );
      colors.push(color.r, color.g, color.b);
      if (j < along && i < across) {
        const a = j * (across + 1) + i;
        indices.push(
          a,
          a + across + 1,
          a + 1,
          a + 1,
          a + across + 1,
          a + across + 2,
        );
      }
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  const material = trailMaterial();
  material.vertexColors = true;
  material.color.set(0xffffff);
  const mesh = new THREE.Mesh(g, material);
  mesh.receiveShadow = true;
  return mesh;
}

export function desertDress(curve: (z: number) => number, length: number) {
  const group = new THREE.Group(),
    rand = random(953);
  const grass = new THREE.MeshStandardMaterial({
    color: 0x88724a,
    roughness: 1,
    side: THREE.DoubleSide,
  });
  const stone = new THREE.MeshStandardMaterial({
    color: 0xa47550,
    roughness: 1,
  });
  for (let i = 0; i < 220; i++) {
    const z = rand() * (length + 30) - 10,
      side = rand() > 0.5 ? 1 : -1,
      x = curve(z) + side * (5.9 + rand() * 12);
    if (i % 3 === 0) {
      const rock = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.16 + rand() * 0.3, 1),
        stone,
      );
      rock.position.set(x, 0.06, z);
      rock.scale.set(1.5, 0.6, 1);
      rock.rotation.y = rand() * 6;
      rock.castShadow = true;
      group.add(rock);
    } else {
      const v: number[] = [];
      for (let blade = 0; blade < 9; blade++) {
        const a = rand() * Math.PI * 2,
          h = 0.18 + rand() * 0.32,
          dx = Math.cos(a),
          dz = Math.sin(a);
        v.push(
          x + dx * 0.04,
          0,
          z + dz * 0.04,
          x + dx * 0.24,
          h,
          z + dz * 0.24,
          x - dz * 0.045,
          0,
          z + dx * 0.045,
        );
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
      g.computeVertexNormals();
      group.add(new THREE.Mesh(g, grass));
    }
  }
  return group;
}

/** Landmark silhouette: riveted timber water tower with real legs and cross bracing. */
export function waterTower() {
  const group = new THREE.Group(),
    wood = new THREE.MeshStandardMaterial({ color: 0x76563b, roughness: 0.95 }),
    iron = new THREE.MeshStandardMaterial({
      color: 0x413b31,
      roughness: 0.65,
      metalness: 0.6,
    });
  const beam = (a: THREE.Vector3, b: THREE.Vector3, width: number) => {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(width, a.distanceTo(b), width),
      wood,
    );
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      b.clone().sub(a).normalize(),
    );
    m.castShadow = true;
    group.add(m);
  };
  for (const x of [-1.2, 1.2])
    for (const z of [-1.2, 1.2])
      beam(
        new THREE.Vector3(x * 1.2, 0, z * 1.2),
        new THREE.Vector3(x, 5, z),
        0.25,
      );
  for (const s of [-1, 1]) {
    beam(
      new THREE.Vector3(-1.4, 0.7, s * 1.4),
      new THREE.Vector3(1.2, 4.7, s * 1.2),
      0.13,
    );
    beam(
      new THREE.Vector3(1.4, 0.7, s * 1.4),
      new THREE.Vector3(-1.2, 4.7, s * 1.2),
      0.13,
    );
  }
  const tank = new THREE.Mesh(
    new THREE.CylinderGeometry(1.7, 1.6, 2.5, 24),
    wood,
  );
  tank.position.y = 6.15;
  tank.castShadow = true;
  group.add(tank);
  for (const y of [5.1, 6.2, 7.25]) {
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(1.67, 0.06, 5, 24),
      iron,
    );
    band.rotation.x = Math.PI / 2;
    band.position.y = y;
    group.add(band);
  }
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.86, 0.7, 24), iron);
  roof.position.y = 7.7;
  group.add(roof);
  return group;
}
