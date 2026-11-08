// Living nature layer: wind-blown grass that parts around players, flowers, bushes, pebbles and boulders,
// swaying foliage, drifting pollen and dynamic weather. Everything here is decoration: no colliders,
// so gameplay, bots and netcode are unchanged. Density scales with the graphics preset.
import * as THREE from 'three';
import { mulberry32, makeNoise2D } from '../core/util.js';

const CELL = 24; // grass is chunked so the camera frustum culls it and far chunks are skipped
const shared = { uTime: { value: 0 }, uWind: { value: new THREE.Vector2(0.8, 0.45) }, uGust: { value: 0.6 } };

// ---------- wind shader injection (works on any MeshStandardMaterial) ----------
// amp: sway in metres at height `ref` above `base`; foliage that is merged into world space sways by its world height.
export function addWind(mat, { amp = 0.12, base = 1.2, ref = 6, freq = 1.3 } = {}) {
  if (mat.userData.wind) return mat; mat.userData.wind = true;
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    prev?.call(mat, sh, r);
    sh.uniforms.uTime = shared.uTime; sh.uniforms.uWind = shared.uWind; sh.uniforms.uGust = shared.uGust;
    sh.vertexShader = 'uniform float uTime; uniform vec2 uWind; uniform float uGust;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      { vec4 wp0 = modelMatrix * vec4(transformed, 1.0);
        float k = clamp((wp0.y - ${base.toFixed(2)}) / ${ref.toFixed(2)}, 0.0, 1.0); k *= k;
        float ph = uTime * ${freq.toFixed(2)} + wp0.x * 0.21 + wp0.z * 0.17;
        float s = sin(ph) * 0.6 + sin(ph * 2.3 + 1.7) * 0.25 + uGust * 0.5;
        transformed.xz += uWind * s * ${amp.toFixed(3)} * k;
        transformed.y += cos(ph * 1.7) * ${(amp * 0.25).toFixed(3)} * k; }`);
  };
  mat.customProgramCacheKey = () => 'wind' + amp + base + ref;
  mat.needsUpdate = true; return mat;
}

// ---------- geometry builders ----------
function grassTuft(r, blades = 7, h = 0.4) {
  const pos = [], col = [], nrm = [], idx = []; let v = 0;
  for (let b = 0; b < blades; b++) {
    const a = r() * Math.PI * 2, ox = (r() - 0.5) * 0.55, oz = (r() - 0.5) * 0.55, hh = h * (0.6 + r() * 0.6), w = 0.035 + r() * 0.025, lean = 0.12 + r() * 0.22;
    const ca = Math.cos(a), sa = Math.sin(a); const segs = 3;
    for (let s = 0; s <= segs; s++) {
      const t = s / segs, ww = w * (1 - t * 0.92), bend = lean * t * t;
      const cx = ox + ca * bend, cz = oz + sa * bend, y = hh * t;
      pos.push(cx - sa * ww, y, cz + ca * ww, cx + sa * ww, y, cz - ca * ww);
      const g = 0.45 + t * 0.55; col.push(g, g, g, g, g, g);
      nrm.push(0, 1, 0, 0, 1, 0);
      if (s < segs) idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
      v += 2;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); return g;
}
function flowerGeom() {
  const stem = new THREE.CylinderGeometry(0.012, 0.016, 0.42, 4, 1); stem.translate(0, 0.21, 0);
  const head = new THREE.IcosahedronGeometry(0.07, 0); head.scale(1, 0.55, 1); head.translate(0, 0.44, 0);
  const petals = new THREE.TorusGeometry(0.075, 0.03, 4, 7); petals.rotateX(Math.PI / 2); petals.translate(0, 0.43, 0);
  const parts = [[stem, 0.32], [petals, 1], [head, 1.5]];
  return mergeColored(parts);
}
function bushGeom(r) {
  const parts = [];
  for (let i = 0; i < 6; i++) { const s = new THREE.IcosahedronGeometry(0.42 + r() * 0.22, 1); deform(s, r, 0.09); s.scale(1, 0.82, 1); s.translate((r() - 0.5) * 0.75, 0.32 + r() * 0.3, (r() - 0.5) * 0.75); parts.push([s, 0.75 + r() * 0.35]); }
  return mergeColored(parts);
}
function rockGeom(r, detail = 1) {
  const g = new THREE.IcosahedronGeometry(1, detail); deform(g, r, 0.28); g.scale(1, 0.62, 0.9); g.translate(0, 0.25, 0);
  return mergeColored([[g, 1]]);
}
function deform(g, r, k) {
  const p = g.attributes.position; const seen = new Map();
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    if (!seen.has(key)) seen.set(key, 1 + (r() - 0.5) * 2 * k);
    const f = seen.get(key); p.setXYZ(i, p.getX(i) * f, p.getY(i) * f, p.getZ(i) * f);
  }
  g.computeVertexNormals();
}
// merge non-indexed geometries, baking a brightness into vertex colors (shade)
function mergeColored(parts) {
  const pos = [], nrm = [], col = [];
  for (const [g0, shade] of parts) {
    const g = g0.index ? g0.toNonIndexed() : g0; g.computeVertexNormals();
    const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nrm.push(n.getX(i), n.getY(i), n.getZ(i)); const y = p.getY(i); const s = shade * (0.8 + Math.min(0.35, y * 0.25)); col.push(s, s, s); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

// ---------- grass material: wind, distance fade, parts around nearby players ----------
const MAX_PUSH = 6;
function grassMaterial(fadeFar) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
  const pushers = Array.from({ length: MAX_PUSH }, () => new THREE.Vector3(0, -999, 0));
  m.userData.pushers = pushers;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = shared.uTime; sh.uniforms.uWind = shared.uWind; sh.uniforms.uGust = shared.uGust;
    sh.uniforms.uPush = { value: pushers }; sh.uniforms.uFar = { value: fadeFar };
    sh.vertexShader = `uniform float uTime; uniform vec2 uWind; uniform float uGust; uniform vec3 uPush[${MAX_PUSH}]; uniform float uFar;\n` + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      { vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        vec4 wp = modelMatrix * vec4(ip, 1.0);
        float dist = distance(wp.xyz, cameraPosition);
        float fade = 1.0 - smoothstep(uFar * 0.62, uFar, dist);
        transformed *= fade;
        float h = clamp(position.y / 0.6, 0.0, 1.4); float hh = h * h;
        float ph = uTime * 1.9 + wp.x * 0.35 + wp.z * 0.28;
        float s = sin(ph) * 0.55 + sin(ph * 2.7 + wp.x) * 0.2 + uGust * 0.6;
        vec3 off = vec3(uWind.x, 0.0, uWind.y) * s * 0.16 * hh;
        for (int i = 0; i < ${MAX_PUSH}; i++) {
          vec3 d = wp.xyz - uPush[i]; d.y = 0.0; float l = length(d);
          float k = (1.0 - smoothstep(0.25, 1.25, l)) * step(abs(wp.y - uPush[i].y), 1.6);
          off += normalize(d + vec3(0.001, 0.0, 0.0)) * k * 0.42 * hh; off.y -= k * 0.22 * hh;
        }
        vec3 lo = (inverse(mat3(instanceMatrix)) * off);
        transformed += lo; }`);
  };
  m.customProgramCacheKey = () => 'grass' + fadeFar;
  return m;
}

// ---------- scatter ----------
const PALETTES = {
  lawn: ['#6fbf48', '#83cc4f', '#5aa83e', '#97d65a', '#78b84a'],
  jungle: ['#3f8f3a', '#4c9f42', '#2f7a34', '#5fae4a'],
  dune: ['#b9c06a', '#a7b45c', '#cfc77e', '#9aa957'],
};
const FLOWERS = ['#ff6f9e', '#ffd23f', '#ffffff', '#b98cff', '#ff8a3d', '#5aaeff'];

export class Nature {
  constructor(match, q) {
    this.match = match; this.scene = match.scene; this.q = q; this.group = new THREE.Group(); this.scene.add(this.group);
    this.cells = []; this.t = 0; this.gust = 0; this.gustT = 0; this.windAng = 0.5;
    const map = match.map, world = match.world; const seed = match.settings.mapSeed ?? 7; const r = mulberry32(seed * 31 + 7);
    this.noise = makeNoise2D(seed + 3);
    const dens = q.grass ?? 0.6; this.far = q.grassFar ?? 55;
    // sway the merged tree and palm foliage
    const leaf = map.builder?.materials?.leaf?.m; if (leaf && q.windFx !== false) addWind(leaf, { amp: 0.16, base: 1.5, ref: 7 });
    if (map.greenAt && dens > 0) this.scatter(map, world, r, dens);
    this.rocks(map, world, r);
    if (map.planterSpots) this.planters(map, world, r);
    this.motes(map, q);
    this.weather = new Weather(match, q, seed);
  }

  ground(world, x, z, g) {
    if (g && g.y != null) { const top = world.groundAt(x, z, 0.35, g.y + 6); return top > g.y + 0.25 ? null : g.y; }
    const h = world.terrain(x, z); if (h < 0.15) return null; // keep out of the sea
    const top = world.groundAt(x, z, 0.35, h + 30); if (top > h + 0.25) return null; // covered by a building, road or prop
    return h;
  }

  scatter(map, world, r, dens) {
    const B = world.bounds || { minX: -180, maxX: 180, minZ: -180, maxZ: 180 };
    const tuftGeo = grassTuft(r, (this.q.grassBlades ?? 7) + 3); const mat = grassMaterial(this.far);
    const flowerGeo = flowerGeom(); const flowerMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }); addWind(flowerMat, { amp: 0.05, base: 0, ref: 0.5, freq: 2.1 });
    const bushGeo = bushGeom(r); const bushMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }); addWind(bushMat, { amp: 0.035, base: 0, ref: 1.2, freq: 1.6 });
    const cells = new Map(); const key = (x, z) => `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
    const add = (kind, x, y, z, rot, s, color) => { const k = key(x, z); if (!cells.has(k)) cells.set(k, { grass: [], flower: [], bush: [], cx: (Math.floor(x / CELL) + 0.5) * CELL, cz: (Math.floor(z / CELL) + 0.5) * CELL }); cells.get(k)[kind].push([x, y, z, rot, s, color]); };
    const step = 1 / Math.sqrt(Math.max(0.05, dens * 2.4)); // spacing of the sample grid in metres
    const cap = this.q.grassMax ?? 60000; let n = 0; const c = new THREE.Color();
    for (let x = B.minX; x < B.maxX && n < cap; x += step) {
      for (let z = B.minZ; z < B.maxZ && n < cap; z += step) {
        const jx = x + (r() - 0.5) * step, jz = z + (r() - 0.5) * step;
        const g = map.greenAt(jx, jz); if (!g) continue;
        const patch = 0.55 + 0.45 * this.noise(jx * 0.11, jz * 0.11);
        if (r() > g.dens * patch) continue;
        const y = this.ground(world, jx, jz, g); if (y == null) continue;
        const pal = PALETTES[g.kind] || PALETTES.lawn; c.set(pal[Math.floor(r() * pal.length)]).multiplyScalar(0.85 + r() * 0.3);
        const tall = g.kind === 'jungle' ? 1.35 : g.kind === 'dune' ? 1.2 : 0.9;
        add('grass', jx, y, jz, r() * 6.28, (0.75 + r() * 0.6) * tall, c.getHex()); n++;
        if (g.kind !== 'dune' && r() < 0.035) add('flower', jx + (r() - 0.5), y, jz + (r() - 0.5), r() * 6.28, 0.8 + r() * 0.5, new THREE.Color(FLOWERS[Math.floor(r() * FLOWERS.length)]).getHex());
        if (g.kind !== 'dune' && r() < 0.006 * (g.kind === 'jungle' ? 3 : 1)) add('bush', jx, y - 0.05, jz, r() * 6.28, 0.8 + r() * 0.7, c.clone().multiplyScalar(0.8).getHex());
      }
    }
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const build = (list, geo, m, shadow) => {
      if (!list.length) return null;
      const im = new THREE.InstancedMesh(geo, m, list.length); im.receiveShadow = !!this.q.shadows; im.castShadow = shadow && !!this.q.shadows;
      list.forEach(([x, y, z, rot, s, col], i) => { Q.setFromAxisAngle(up, rot); S.setScalar(s); P.set(x, y, z); M.compose(P, Q, S); im.setMatrixAt(i, M); im.setColorAt(i, c.setHex(col)); });
      im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.matrixAutoUpdate = false; im.updateMatrix(); this.group.add(im); return im;
    };
    for (const cell of cells.values()) {
      const meshes = [build(cell.grass, tuftGeo, mat, false), build(cell.flower, flowerGeo, flowerMat, false), build(cell.bush, bushGeo, bushMat, true)].filter(Boolean);
      this.cells.push({ cx: cell.cx, cz: cell.cz, meshes });
    }
    this.grassMat = mat; this.count = n;
  }

  rocks(map, world, r) {
    const B = world.bounds || { minX: -180, maxX: 180, minZ: -180, maxZ: 180 }; const want = Math.round((this.q.rocks ?? 1) * (map.id === 'city' ? 0 : 520));
    if (!want) return;
    const geos = [rockGeom(r, 1), rockGeom(r, 1), rockGeom(r, 0)]; const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: true });
    const lists = [[], [], []]; const c = new THREE.Color(); let tries = 0, placed = 0;
    while (placed < want && tries++ < want * 30) {
      const x = B.minX + r() * (B.maxX - B.minX), z = B.minZ + r() * (B.maxZ - B.minZ);
      const h = world.terrain(x, z); if (h < -0.4) continue;
      const hill = h > 4; const near = this.noise(x * 0.04 + 9, z * 0.04) > 0.35;
      if (!hill && !near && r() > 0.1) continue;
      if (world.groundAt(x, z, 0.8, h + 30) > h + 0.25) continue;
      const big = hill && r() < 0.3; const s = big ? 1.1 + r() * 1.4 : 0.15 + r() * 0.4;
      c.set(h < 0.6 ? '#b7a58c' : hill ? '#9a9086' : '#a89f92').offsetHSL(0, 0, (r() - 0.5) * 0.12);
      lists[Math.floor(r() * 3)].push([x, h - s * 0.15, z, r() * 6.28, s, c.getHex()]); placed++;
    }
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), E = new THREE.Euler();
    lists.forEach((list, i) => {
      if (!list.length) return; const im = new THREE.InstancedMesh(geos[i], mat, list.length); im.castShadow = !!this.q.shadows; im.receiveShadow = !!this.q.shadows;
      list.forEach(([x, y, z, rot, s, col], k) => { E.set((r() - 0.5) * 0.3, rot, (r() - 0.5) * 0.3); Q.setFromEuler(E); S.set(s, s * (0.7 + r() * 0.5), s); P.set(x, y, z); M.compose(P, Q, S); im.setMatrixAt(k, M); im.setColorAt(k, c.setHex(col)); });
      im.computeBoundingSphere(); this.group.add(im);
    });
  }

  // city street planters: a clay box, a round bush and a few flowers, all instanced
  planters(map, world, r) {
    const y0 = map.sidewalkY ?? 0.15; const spots = map.planterSpots.filter(([x, z]) => world.groundAt(x, z, 0.9, y0 + 3) <= y0 + 0.2);
    if (!spots.length) return;
    const box = new THREE.BoxGeometry(2.2, 0.5, 0.9); box.translate(0, 0.25, 0);
    const soil = new THREE.BoxGeometry(2.0, 0.06, 0.72); soil.translate(0, 0.5, 0);
    const boxMat = new THREE.MeshStandardMaterial({ roughness: 0.6, color: '#ffffff' });
    const bushGeo = bushGeom(r); const bushMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }); addWind(bushMat, { amp: 0.03, base: 0, ref: 1.5, freq: 1.6 });
    const flowerGeo = flowerGeom(); const flowerMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }); addWind(flowerMat, { amp: 0.04, base: 0, ref: 1, freq: 2.1 });
    const boxCols = ['#ff8a3d', '#33c7b8', '#5aaeff', '#ffd23f', '#ff6f9e'];
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(1, 1, 1), P = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), c = new THREE.Color();
    const mk = (geo, mat, n, shadow) => { const im = new THREE.InstancedMesh(geo, mat, n); im.castShadow = shadow && !!this.q.shadows; im.receiveShadow = !!this.q.shadows; this.group.add(im); return im; };
    const boxes = mk(box, boxMat, spots.length, true), soils = mk(soil, new THREE.MeshStandardMaterial({ color: '#5a3d2b', roughness: 1 }), spots.length, false);
    const bushes = mk(bushGeo, bushMat, spots.length * 2, true), flowers = mk(flowerGeo, flowerMat, spots.length * 6, false);
    spots.forEach(([x, z, rot], i) => {
      Q.setFromAxisAngle(up, rot); P.set(x, y0, z); S.set(1, 1, 1); M.compose(P, Q, S); boxes.setMatrixAt(i, M); soils.setMatrixAt(i, M); boxes.setColorAt(i, c.set(boxCols[i % boxCols.length]));
      for (let k = 0; k < 2; k++) { const off = (k - 0.5) * 1.0; P.set(x + Math.cos(rot) * off, y0 + 0.45, z - Math.sin(rot) * off); S.setScalar(0.62 + r() * 0.2); M.compose(P, Q, S); bushes.setMatrixAt(i * 2 + k, M); bushes.setColorAt(i * 2 + k, c.set(['#4f9f45', '#5fae4a', '#3f8f3a'][Math.floor(r() * 3)])); }
      for (let k = 0; k < 6; k++) { const off = (r() - 0.5) * 1.8, side = (r() - 0.5) * 0.5; P.set(x + Math.cos(rot) * off + Math.sin(rot) * side, y0 + 0.5, z - Math.sin(rot) * off + Math.cos(rot) * side); S.setScalar(0.8 + r() * 0.5); M.compose(P, Q, S); flowers.setMatrixAt(i * 6 + k, M); flowers.setColorAt(i * 6 + k, c.set(FLOWERS[Math.floor(r() * FLOWERS.length)])); }
    });
    for (const im of [boxes, soils, bushes, flowers]) im.computeBoundingSphere();
  }

  // drifting pollen (beach) or dust (city) around the camera
  motes(map, q) {
    const n = Math.round(260 * (q.particles ?? 1)); if (!n) return;
    const g = new THREE.BufferGeometry(); const p = new Float32Array(n * 3); const seed = new Float32Array(n);
    for (let i = 0; i < n; i++) { p[i * 3] = (Math.random() - 0.5) * 60; p[i * 3 + 1] = Math.random() * 14; p[i * 3 + 2] = (Math.random() - 0.5) * 60; seed[i] = Math.random() * 100; }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    const col = map.id === 'city' ? new THREE.Color('#ffd9b0') : new THREE.Color('#fffbe6');
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: shared.uTime, uCam: { value: new THREE.Vector3() }, uCol: { value: col }, uScale: { value: 300 } },
      vertexShader: `attribute float seed; uniform float uTime; uniform vec3 uCam; uniform float uScale; varying float vA;
        void main() { vec3 p = position; p.x += sin(uTime * 0.3 + seed) * 2.0 + uTime * 0.6; p.z += cos(uTime * 0.25 + seed * 1.3) * 2.0 + uTime * 0.35; p.y += sin(uTime * 0.5 + seed * 2.0) * 0.8;
          p.xz = mod(p.xz - uCam.xz + 30.0, 60.0) - 30.0 + uCam.xz; p.y = mod(p.y - uCam.y + 4.0, 14.0) - 4.0 + uCam.y;
          vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; float d = -mv.z;
          vA = (1.0 - smoothstep(18.0, 30.0, d)) * (0.55 + 0.45 * sin(uTime * 2.0 + seed * 7.0));
          gl_PointSize = uScale * 0.05 / max(d, 0.5); }`,
      fragmentShader: `uniform vec3 uCol; varying float vA; void main() { vec2 c = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.1, length(c)) * vA * 0.7; gl_FragColor = vec4(uCol, a); }`,
    });
    this.motesPts = new THREE.Points(g, m); this.motesPts.frustumCulled = false; this.group.add(this.motesPts);
  }

  update(dt) {
    this.t += dt; shared.uTime.value = this.t;
    // gusts come and go; the wind slowly turns
    this.gustT -= dt; if (this.gustT <= 0) { this.gustTarget = Math.random() < 0.35 ? 0.6 + Math.random() * 0.8 : Math.random() * 0.3; this.gustT = 2 + Math.random() * 5; }
    this.gust += ((this.gustTarget || 0) - this.gust) * Math.min(1, dt * 0.8); shared.uGust.value = this.gust * (1 + (this.weather?.rain || 0));
    this.windAng += dt * 0.01; const ws = 0.8 + this.gust * 0.4 + (this.weather?.rain || 0) * 0.6; shared.uWind.value.set(Math.cos(this.windAng) * ws, Math.sin(this.windAng) * ws);
    const cam = this.match.gfx.camera.position;
    const far2 = (this.far + CELL) ** 2;
    for (const c of this.cells) { const dx = c.cx - cam.x, dz = c.cz - cam.z; const vis = dx * dx + dz * dz < far2; for (const m of c.meshes) m.visible = vis; }
    if (this.grassMat) { // nearby players push the grass aside
      const P = this.grassMat.userData.pushers; let i = 0;
      for (const c of this.match.combatants) { if (!c.alive || i >= P.length) continue; const dx = c.pos.x - cam.x, dz = c.pos.z - cam.z; if (dx * dx + dz * dz > 900) continue; P[i++].copy(c.pos); }
      for (; i < P.length; i++) P[i].set(0, -999, 0);
    }
    if (this.motesPts) { this.motesPts.material.uniforms.uCam.value.copy(cam); this.motesPts.material.uniforms.uScale.value = innerHeight * 0.55; this.motesPts.material.opacity = 1 - (this.weather?.rain || 0); }
    this.weather?.update(dt, cam);
  }
  dispose() { this.weather?.dispose(); this.scene.remove(this.group); this.group.traverse((o) => { if (o.isInstancedMesh) o.dispose(); }); }
}

// ---------- weather: clear, breezy or passing showers, changing during the match ----------
// The pattern comes from the map seed so everyone in a room sees the same sky.
export class Weather {
  constructor(match, q, seed) {
    this.match = match; this.q = q; this.rain = 0; this.target = 0; this.t = 0;
    const r = mulberry32(seed * 7 + 99); const map = match.map;
    // a schedule of [startTime, intensity]; most matches stay dry
    const forced = match.settings.weather; const wet = forced ? forced === 'rain' : r() < (map.id === 'city' ? 0.4 : 0.3);
    this.schedule = forced === 'rain' ? [[0, 0.9]] : wet ? [[40 + r() * 80, 0.55 + r() * 0.45], [200 + r() * 120, 0], [420 + r() * 120, 0.4 + r() * 0.5], [620 + r() * 100, 0]] : [];
    this.kind = wet ? 'showers' : 'clear';
    const n = Math.round(1800 * (q.particles ?? 1)); this.base = null;
    if (wet && n > 0) {
      const g = new THREE.BufferGeometry(); const p = new Float32Array(n * 6);
      for (let i = 0; i < n; i++) { const x = (Math.random() - 0.5) * 50, y = Math.random() * 30, z = (Math.random() - 0.5) * 50; p.set([x, y, z, x, y - 0.55, z], i * 6); }
      g.setAttribute('position', new THREE.BufferAttribute(p, 3));
      this.rainMat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false,
        uniforms: { uTime: shared.uTime, uCam: { value: new THREE.Vector3() }, uA: { value: 0 }, uWind: shared.uWind },
        vertexShader: `uniform float uTime; uniform vec3 uCam; uniform vec2 uWind; varying float vA;
          void main() { vec3 p = position; float fall = mod(uTime * 22.0 + p.x * 3.1 + p.z * 1.7, 30.0); p.y = mod(p.y - fall, 30.0) - 6.0 + uCam.y;
            p.x += uWind.x * (p.y - uCam.y) * 0.06; p.z += uWind.y * (p.y - uCam.y) * 0.06;
            p.xz = mod(p.xz - uCam.xz + 25.0, 50.0) - 25.0 + uCam.xz;
            vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; vA = 1.0 - smoothstep(14.0, 25.0, -mv.z); }`,
        fragmentShader: `uniform float uA; varying float vA; void main() { gl_FragColor = vec4(0.82, 0.88, 0.97, 0.38 * uA * vA); }`,
      });
      this.rainLines = new THREE.LineSegments(g, this.rainMat); this.rainLines.frustumCulled = false; this.rainLines.visible = false; match.scene.add(this.rainLines);
    }
  }
  update(dt, cam) {
    if (!this.schedule.length) return;
    const gfx = this.match.gfx; const time = this.match.time || 0;
    if (!this.base && gfx.sun && this.match.scene.fog) this.base = { sun: gfx.sun.intensity, hemi: gfx.hemi.intensity, fog: this.match.scene.fog.density, fogCol: this.match.scene.fog.color.clone(), exp: gfx.renderer.toneMappingExposure };
    let target = 0; for (const [t0, v] of this.schedule) if (time >= t0) target = v;
    this.rain += (target - this.rain) * Math.min(1, dt * 0.12);
    const k = this.rain;
    if (this.base) {
      gfx.sun.intensity = this.base.sun * (1 - 0.6 * k); gfx.hemi.intensity = this.base.hemi * (1 - 0.15 * k);
      this.match.scene.fog.density = this.base.fog * (1 + 1.6 * k);
      this.match.scene.fog.color.copy(this.base.fogCol).lerp(_grey, 0.55 * k);
    }
    if (this.rainLines) { this.rainLines.visible = k > 0.02; this.rainMat.uniforms.uA.value = k; this.rainMat.uniforms.uCam.value.copy(cam); }
    this.match.audioRain?.(k);
  }
  dispose() { if (this.rainLines) this.match.scene.remove(this.rainLines); }
}
const _grey = new THREE.Color('#9aa6b4');
