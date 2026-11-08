// Reusable static props, all emitted into the WorldBuilder batches.
import * as THREE from 'three';
import { F_ALL, F_SOLID, F_BULLET, F_GLASS } from './collision.js';
import { makeNoise2D } from '../core/util.js';

const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(), E = new THREE.Euler();
const mat = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => M4.compose(V.set(x, y, z), Q.setFromEuler(E.set(rx, ry, rz)), S.set(sx, sy, sz));

const G = {
  cyl: new THREE.CylinderGeometry(1, 1, 1, 10, 1), cylLo: new THREE.CylinderGeometry(1, 1, 1, 7, 1), cone: new THREE.ConeGeometry(1, 1, 10),
  sphere: new THREE.SphereGeometry(1, 12, 9), sphereLo: new THREE.SphereGeometry(1, 8, 6), torus: new THREE.TorusGeometry(1, 0.25, 6, 14),
  box: new THREE.BoxGeometry(1, 1, 1), ico: null,
};
const rockNoise = makeNoise2D(99);
function rockGeom(seed) {
  const g = new THREE.IcosahedronGeometry(1, 2); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    V.fromBufferAttribute(p, i); const n = 1 + rockNoise(V.x * 1.3 + seed, V.z * 1.3 + V.y) * 0.28 + rockNoise(V.y * 3 + seed, V.x * 3) * 0.08;
    V.multiplyScalar(n); p.setXYZ(i, V.x, V.y * 0.8, V.z);
  }
  g.computeVertexNormals(); return g;
}
const rockGeoms = [rockGeom(1), rockGeom(7), rockGeom(13)];

// Drooping palm frond strip geometry
const frond = (() => {
  const segs = 8, pos = [], idx = [], uv = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, len = 3.6 * t, w = Math.sin(t * Math.PI) * 0.55 + 0.05, droop = -t * t * 1.6;
    pos.push(len, droop, -w, len, droop + 0.12, 0, len, droop, w); uv.push(t, 0, t, 0.5, t, 1);
    if (i < segs) { const b = i * 3; idx.push(b, b + 3, b + 1, b + 1, b + 3, b + 4, b + 1, b + 4, b + 2, b + 2, b + 4, b + 5); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
})();

export function palm(B, x, z, r, y = B.world.terrain(x, z)) {
  const h = 6 + r() * 4, lean = (r() - 0.5) * 0.5, leanDir = r() * Math.PI * 2;
  const segs = 7; let px = x, pz = z, py = y;
  for (let i = 0; i < segs; i++) {
    const t = (i + 1) / segs; const nx = x + Math.cos(leanDir) * Math.sin(lean) * h * t * t, nz = z + Math.sin(leanDir) * Math.sin(lean) * h * t * t, ny = y + h * t;
    const dx = nx - px, dy = ny - py, dz = nz - pz, len = Math.hypot(dx, dy, dz);
    Q.setFromUnitVectors(V.set(0, 1, 0), S.set(dx / len, dy / len, dz / len));
    const rad = 0.28 - t * 0.1;
    M4.compose(V.set((px + nx) / 2, (py + ny) / 2, (pz + nz) / 2), Q, S.set(rad, len * 1.02, rad));
    B.geom(G.cylLo, M4, 'wood', i % 2 ? '#8a6a48' : '#7a5c3c');
    M4.compose(V.set(nx, ny - 0.05, nz), Q, S.set(rad * 1.25, 0.12, rad * 1.25)); B.geom(G.cylLo, M4, 'wood', '#6b4f33');
    px = nx; py = ny; pz = nz;
  }
  const n = 8 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.3; const tilt = 0.25 + r() * 0.35; const sc = 0.85 + r() * 0.35;
    B.geom(frond, mat(px, py, pz, 0, -a, tilt, sc, sc, sc), 'leaf', i % 2 ? '#4f9a3a' : '#3f8a32');
  }
  for (let i = 0; i < 3; i++) B.geom(G.sphereLo, mat(px + Math.cos(i * 2.1) * 0.3, py - 0.35, pz + Math.sin(i * 2.1) * 0.3, 0, 0, 0, 0.2, 0.22, 0.2), 'clay', '#5a3e1f');
  B.collider(x - 0.3, y, z - 0.3, x + 0.3, y + 4, z + 0.3);
}

export function rock(B, x, y, z, s, r, color = '#8d8478') {
  const g = rockGeoms[Math.floor(r() * 3)]; const sx = s * (0.8 + r() * 0.5), sy = s * (0.6 + r() * 0.5), sz = s * (0.8 + r() * 0.5);
  B.geom(g, mat(x, y + sy * 0.3, z, 0, r() * 6, 0, sx, sy, sz), 'rock', color, 1);
  B.collider(x - sx * 0.75, y - 2, z - sz * 0.75, x + sx * 0.75, y + sy * 0.3 + sy * 0.7, z + sz * 0.75);
}

export function tree(B, x, z, r, y = B.world.terrain(x, z), scale = 1) {
  const h = (3 + r() * 1.5) * scale;
  B.geom(G.cylLo, mat(x, y + h / 2, z, 0, 0, 0, 0.22 * scale, h, 0.22 * scale), 'wood', '#6b4a2e');
  const greens = ['#4f8f3a', '#5ea442', '#3f7a33', '#6fae4a'];
  for (let i = 0; i < 4; i++) {
    const a = r() * 6.28, d = i === 0 ? 0 : 0.9 * scale; const s = (1.3 + r() * 0.6) * scale;
    B.geom(G.sphere, mat(x + Math.cos(a) * d, y + h + (i === 0 ? 0.6 : 0) * scale, z + Math.sin(a) * d, 0, 0, 0, s, s * 0.85, s), 'clay', greens[i]);
  }
  B.collider(x - 0.3, y, z - 0.3, x + 0.3, y + h, z + 0.3);
}

export function umbrella(B, x, z, color, y = B.world.terrain(x, z)) {
  B.geom(G.cylLo, mat(x, y + 1.2, z, 0, 0, 0, 0.04, 2.4, 0.04), 'metal', '#ddd');
  B.geom(G.cone, mat(x, y + 2.45, z, 0, 0, 0, 1.4, 0.55, 1.4), 'fabric', color);
}
export function lounger(B, x, z, rot, color, y = B.world.terrain(x, z)) {
  const along = rot ? 'z' : 'x'; const L = 1.9, W = 0.7;
  if (along === 'x') { B.box(x - L / 2, y + 0.25, z - W / 2, x + L / 2, y + 0.35, z + W / 2, 'paint', color, { flags: F_SOLID }); B.box(x + L / 2 - 0.5, y + 0.35, z - W / 2, x + L / 2 - 0.1, y + 0.8, z + W / 2, 'paint', color, { collide: false }); }
  else { B.box(x - W / 2, y + 0.25, z - L / 2, x + W / 2, y + 0.35, z + L / 2, 'paint', color, { flags: F_SOLID }); B.box(x - W / 2, y + 0.35, z + L / 2 - 0.5, x + W / 2, y + 0.8, z + L / 2 - 0.1, 'paint', color, { collide: false }); }
  for (const dx of [-0.8, 0.8]) for (const dz of [-0.28, 0.28]) { const ox = along === 'x' ? dx : dz, oz = along === 'x' ? dz : dx; B.box(x + ox - 0.03, y, z + oz - 0.03, x + ox + 0.03, y + 0.25, z + oz + 0.03, 'metal', '#ccc', { collide: false }); }
}

export function crate(B, x, y, z, s = 1.2, color = '#6b5a3a', mat2 = 'wood') {
  B.box(x - s / 2, y, z - s / 2, x + s / 2, y + s, z + s / 2, mat2, color);
  // reinforcing bands
  B.box(x - s / 2 - 0.02, y + s * 0.15, z - s / 2 - 0.02, x + s / 2 + 0.02, y + s * 0.25, z + s / 2 + 0.02, 'metal', '#444', { collide: false });
  B.box(x - s / 2 - 0.02, y + s * 0.75, z - s / 2 - 0.02, x + s / 2 + 0.02, y + s * 0.85, z + s / 2 + 0.02, 'metal', '#444', { collide: false });
}

export function sandbags(B, x, z, len, axis = 'x', y = B.world.terrain(x, z)) {
  const n = Math.max(1, Math.round(len / 0.7));
  for (let row = 0; row < 3; row++) for (let i = 0; i < n - (row % 2); i++) {
    const off = -len / 2 + 0.35 + i * 0.7 + (row % 2) * 0.35; const px = axis === 'x' ? x + off : x, pz = axis === 'x' ? z : z + off;
    B.geom(G.sphereLo, mat(px, y + 0.17 + row * 0.3, pz, 0, axis === 'x' ? 0 : Math.PI / 2, 0, 0.36, 0.17, 0.26), 'clay', row % 2 ? '#a89470' : '#b8a37c');
  }
  if (axis === 'x') B.collider(x - len / 2, y, z - 0.3, x + len / 2, y + 1.0, z + 0.3); else B.collider(x - 0.3, y, z - len / 2, x + 0.3, y + 1.0, z + len / 2);
}

// Vehicles. dirX true => long axis along x.
export function car(B, x, z, dirX, color, kind = 'sedan', y = 0, out = null) {
  const dims = { sedan: [4.4, 1.8, 0.75, 0.65], taxi: [4.5, 1.85, 0.75, 0.65], van: [5, 2.0, 1.0, 1.0], jeep: [4.2, 1.9, 0.9, 0.0], bus: [11, 2.6, 1.0, 1.9], truck: [7, 2.4, 1.2, 1.2] }[kind];
  const [L, W, bodyH, cabH] = dims; const hx = dirX ? L / 2 : W / 2, hz = dirX ? W / 2 : L / 2;
  const base = y + 0.35;
  const data = { type: 'car', id: Math.random(), x, z, alarm: 0, kind };
  B.box(x - hx, base, z - hz, x + hx, base + bodyH, z + hz, 'paint', color, { data });
  if (cabH > 0) {
    const cl = kind === 'bus' ? L * 0.98 : kind === 'van' ? L * 0.75 : L * 0.5; const off = kind === 'bus' ? 0 : kind === 'van' ? -L * 0.1 : -L * 0.05;
    const cx = dirX ? x + off : x, cz = dirX ? z : z + off; const chx = dirX ? cl / 2 : W / 2 - 0.08, chz = dirX ? W / 2 - 0.08 : cl / 2;
    B.box(cx - chx, base + bodyH, cz - chz, cx + chx, base + bodyH + cabH, cz + chz, 'paint', '#2a3644', { data, shade: 1 });
    // window band (glow-ish glass) + roof
    B.box(cx - chx - 0.01, base + bodyH + 0.12, cz - chz - 0.01, cx + chx + 0.01, base + bodyH + cabH - 0.12, cz + chz + 0.01, 'glass', '#9fc6e0', { collide: false });
    B.box(cx - chx, base + bodyH + cabH - 0.1, cz - chz, cx + chx, base + bodyH + cabH, cz + chz, 'paint', color, { collide: false });
  } else { // jeep roll bar
    B.box(x - hx * 0.2 - 0.05, base + bodyH, z - hz, x - hx * 0.2 + 0.05, base + bodyH + 0.9, z + hz, 'metal', '#333', { collide: false });
  }
  if (kind === 'taxi') B.box(x - 0.3, base + bodyH + cabH, z - 0.15, x + 0.3, base + bodyH + cabH + 0.25, z + 0.15, 'glow', '#ffe14d', { collide: false });
  // wheels
  const wx = L / 2 - (kind === 'bus' ? 1.6 : 0.85);
  for (const s of [-1, 1]) for (const t of [-1, 1]) {
    const px = dirX ? x + s * wx : x + t * (W / 2), pz = dirX ? z + t * (W / 2) : z + s * wx;
    B.geom(G.cyl, mat(px, y + 0.38, pz, dirX ? Math.PI / 2 : 0, 0, dirX ? 0 : Math.PI / 2, 0.38, 0.28, 0.38), 'clay', '#1c1c1c');
  }
  // lights
  for (const t of [-1, 1]) {
    const fx = dirX ? x + hx + 0.01 : x + t * (W / 2 - 0.3), fz = dirX ? z + t * (W / 2 - 0.3) : z + hz + 0.01;
    B.box(fx - 0.08, base + bodyH - 0.3, fz - 0.08, fx + 0.08, base + bodyH - 0.12, fz + 0.08, 'glow', '#fff6d0', { collide: false });
    const bx = dirX ? x - hx - 0.01 : fx, bz = dirX ? fz : z - hz - 0.01;
    B.box(bx - 0.08, base + bodyH - 0.3, bz - 0.08, bx + 0.08, base + bodyH - 0.12, bz + 0.08, 'glow', '#ff3030', { collide: false });
  }
  if (out) out.push(data);
  return data;
}

export function tank(B, x, z, y) {
  B.box(x - 3.4, y + 0.3, z - 1.7, x + 3.4, y + 1.6, z + 1.7, 'clay', '#5a6340');
  B.box(x - 3.5, y, z - 1.9, x + 3.5, y + 1.0, z - 1.2, 'clay', '#2a2a2a', { collide: false }); B.box(x - 3.5, y, z + 1.2, x + 3.5, y + 1.0, z + 1.9, 'clay', '#2a2a2a', { collide: false });
  B.geom(G.cyl, mat(x - 0.3, y + 2.1, z, 0, 0, 0, 1.4, 0.9, 1.4), 'clay', '#646e48'); B.collider(x - 1.6, y + 1.6, z - 1.4, x + 1.1, y + 2.6, z + 1.4);
  B.geom(G.cyl, mat(x + 2.6, y + 2.15, z, 0, 0, Math.PI / 2 - 0.08, 0.14, 4, 0.14), 'metal', '#4a523a');
}

export function lifeguardTower(B, x, z, y) {
  for (const dx of [-1.2, 1.2]) for (const dz of [-1.2, 1.2]) B.box(x + dx - 0.1, y, z + dz - 0.1, x + dx + 0.1, y + 3, z + dz + 0.1, 'wood', '#f1ece0', { flags: F_SOLID | F_BULLET });
  B.box(x - 1.6, y + 3, z - 1.6, x + 1.6, y + 3.2, z + 1.6, 'wood', '#e9e3d6');
  B.box(x - 1.4, y + 3.2, z - 1.4, x + 1.4, y + 3.9, z - 1.25, 'paint', '#e8463c'); B.box(x - 1.4, y + 3.2, z + 1.25, x + 1.4, y + 3.9, z + 1.4, 'paint', '#e8463c');
  B.box(x + 1.25, y + 3.2, z - 1.4, x + 1.4, y + 3.9, z + 1.4, 'paint', '#e8463c');
  for (const dx of [-1.4, 1.4]) for (const dz of [-1.4, 1.4]) B.box(x + dx - 0.06, y + 3.2, z + dz - 0.06, x + dx + 0.06, y + 5.2, z + dz + 0.06, 'wood', '#fff', { collide: false });
  B.box(x - 1.9, y + 5.2, z - 1.9, x + 1.9, y + 5.45, z + 1.9, 'paint', '#e8463c');
  B.stairs(x - 1.6 - 10 * 0.42, y, z - 0.6, '+x', 1.2, 3.2, 10, 0.42, 'wood', '#e9e3d6');
}

export function watchtower(B, x, z, y, h = 7) {
  for (const dx of [-1.5, 1.5]) for (const dz of [-1.5, 1.5]) B.box(x + dx - 0.15, y, z + dz - 0.15, x + dx + 0.15, y + h, z + dz + 0.15, 'wood', '#6b543a', { flags: F_SOLID | F_BULLET });
  B.box(x - 2, y + h, z - 2, x + 2, y + h + 0.2, z + 2, 'wood', '#7a6142');
  B.box(x - 2, y + h + 0.2, z - 2, x + 2, y + h + 1.1, z - 1.85, 'wood', '#7a6142'); B.box(x - 2, y + h + 0.2, z + 1.85, x + 2, y + h + 1.1, z + 2, 'wood', '#7a6142');
  B.box(x + 1.85, y + h + 0.2, z - 2, x + 2, y + h + 1.1, z + 2, 'wood', '#7a6142');
  B.box(x - 2.3, y + h + 2.6, z - 2.3, x + 2.3, y + h + 2.8, z + 2.3, 'metal', '#5a5f4a', { flags: F_SOLID | F_BULLET });
  for (const dx of [-1.9, 1.9]) for (const dz of [-1.9, 1.9]) B.box(x + dx - 0.06, y + h, z + dz - 0.06, x + dx + 0.06, y + h + 2.6, z + dz + 0.06, 'wood', '#5a4632', { collide: false });
  // ladder-steps on west side
  { const n = Math.ceil((h + 0.2) / 0.32); B.stairs(x - 2.0 - n * 0.3, y, z - 0.6, '+x', 1.2, h + 0.2, n, 0.3, 'wood', '#7a6142'); }
}

export function tent(B, x, z, y, color = '#5b6b3a') {
    const g = new THREE.CylinderGeometry(1, 1, 1, 3, 1); B.geom(g, mat(x, y + 1.0, z, Math.PI / 2, 0, Math.PI / 2, 2.2, 5, 2.2), 'fabric', color);
}

export function boat(B, x, z, dirX, color, y = 0) {
  const L = 7, W = 2.6; const hx = dirX ? L / 2 : W / 2, hz = dirX ? W / 2 : L / 2;
  B.box(x - hx, y - 0.4, z - hz, x + hx, y + 0.9, z + hz, 'paint', '#f2f2f2', { noTop: true });
  B.box(x - hx + 0.15, y + 0.2, z - hz + 0.15, x + hx - 0.15, y + 0.35, z + hz - 0.15, 'wood', '#b88a5c');
  B.box(x - hx - 0.02, y + 0.5, z - hz - 0.02, x + hx + 0.02, y + 0.75, z + hz + 0.02, 'paint', color, { collide: false });
  const cx = dirX ? x - 1 : x, cz = dirX ? z : z - 1;
  B.box(cx - (dirX ? 1 : 0.9), y + 0.35, cz - (dirX ? 0.9 : 1), cx + (dirX ? 1 : 0.9), y + 1.9, cz + (dirX ? 0.9 : 1), 'paint', '#e9eef2');
  B.box(cx - (dirX ? 1.02 : 0.92), y + 1.2, cz - (dirX ? 0.92 : 1.02), cx + (dirX ? 1.02 : 0.92), y + 1.7, cz + (dirX ? 0.92 : 1.02), 'glass', '#7fb2d6', { collide: false });
}

export function streetLamp(B, x, z, y = 0, lights) {
  B.box(x - 0.08, y, z - 0.08, x + 0.08, y + 6, z + 0.08, 'metal', '#3a3d42', { flags: F_SOLID | F_BULLET });
  B.box(x - 0.08, y + 5.9, z - 0.08, x + 1.2, y + 6.05, z + 0.08, 'metal', '#3a3d42', { collide: false });
  B.box(x + 0.8, y + 5.75, z - 0.18, x + 1.3, y + 5.9, z + 0.18, 'glow', '#ffe9b0', { collide: false });
  if (lights) lights.push([x + 1, y + 5.6, z]);
}

export function bench(B, x, z, dirX, y = 0) {
  const hx = dirX ? 0.9 : 0.25, hz = dirX ? 0.25 : 0.9;
  B.box(x - hx, y + 0.4, z - hz, x + hx, y + 0.5, z + hz, 'wood', '#8b5a2b', { flags: F_SOLID });
  B.box(x - (dirX ? hx : 0.05) + (dirX ? 0 : hx - 0.05), y + 0.5, z - (dirX ? 0.05 : hz) + (dirX ? hz - 0.05 : 0), x + hx, y + 0.95, z + hz, 'wood', '#8b5a2b', { collide: false });
  B.box(x - hx + 0.05, y, z - hz + 0.05, x - hx + 0.15, y + 0.4, z + hz - 0.05, 'metal', '#333', { collide: false });
  B.box(x + hx - 0.15, y, z - hz + 0.05, x + hx - 0.05, y + 0.4, z + hz - 0.05, 'metal', '#333', { collide: false });
}

export function trafficLight(B, x, z, y, out) {
  B.box(x - 0.1, y, z - 0.1, x + 0.1, y + 4.2, z + 0.1, 'metal', '#2b2e33', { flags: F_SOLID | F_BULLET });
  B.box(x - 0.25, y + 3.2, z - 0.25, x + 0.25, y + 4.3, z + 0.25, 'paint', '#1e2024', { collide: false });
  out.push({ x, y: y + 3.75, z });
}

// Breakable glass pane (dynamic mesh so it can shatter)
const glassMat = new THREE.MeshStandardMaterial({ color: '#a9d4ee', roughness: 0.05, metalness: 0.6, transparent: true, opacity: 0.35, depthWrite: false });
export function glassPane(B, x0, y0, z0, x1, y1, z1, list) {
  const box = B.world.addBox(x0, y0, z0, x1, y1, z1, F_SOLID | F_BULLET | F_GLASS);
  const q = (B.glassQueue ||= []); const idx = q.length;
  q.push(M4.compose(V.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), Q.identity(), S.set(Math.max(0.03, x1 - x0), y1 - y0, Math.max(0.03, z1 - z0))).clone());
  box.data = { type: 'glass', hide: () => { const im = B.glassInst; if (!im) return; im.setMatrixAt(idx, new THREE.Matrix4().makeScale(0, 0, 0)); im.instanceMatrix.needsUpdate = true; } };
  list.push(box);
}
// All panes render as ONE instanced draw call; broken panes are scaled to zero.
export function finalizeGlass(B) {
  const q = B.glassQueue; if (!q || !q.length) return;
  const im = new THREE.InstancedMesh(G.box, glassMat, q.length); q.forEach((m, i) => im.setMatrixAt(i, m)); im.renderOrder = 3; im.computeBoundingSphere(); B.dynamic.add(im); B.glassInst = im;
}

// Explosive barrel (dynamic)
const barrelGeo = new THREE.CylinderGeometry(0.42, 0.42, 1.2, 14);
export function explosiveBarrel(B, x, z, y, list, clayMat) {
  const m = new THREE.Mesh(barrelGeo, new THREE.MeshStandardMaterial({ color: '#c8352b', roughness: 0.5, metalness: 0.3 }));
  m.position.set(x, y + 0.6, z); m.castShadow = true; B.dynamic.add(m);
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.18, 14), new THREE.MeshStandardMaterial({ color: '#f2d64b', roughness: 0.6 })); stripe.position.y = 0.2; m.add(stripe);
  const box = B.world.addBox(x - 0.4, y, z - 0.4, x + 0.4, y + 1.2, z + 0.4, F_ALL);
  const data = { type: 'barrel', mesh: m, hp: 35, x, y: y + 0.6, z, box, dead: false }; box.data = data; list.push(data);
}

export { G, mat };
