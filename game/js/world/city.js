// MAP 2: NEON HARBOR DOWNTOWN — dense city grid at golden hour with enterable buildings and rooftops.
import * as THREE from 'three';
import { CollisionWorld, F_SOLID, F_BULLET, F_ALL, F_SIGHT } from './collision.js';
import { WorldBuilder } from './builder.js';
import * as P from './props.js';
import { mulberry32 } from '../core/util.js';
import { makeWaterMaterial } from './water.js';
import { billboardTexture } from '../engine/textures.js';
import { sign, addBuildingLoot } from './beach.js';

const ROADS = [-120, -40, 40, 120];
const RW = 5; // asphalt half width
const BLOCKS = [[-170, -125], [-115, -45], [-35, 35], [45, 115], [125, 170]];
const TUN = { x0: -58, x1: 58, z0: -44.5, z1: -35.5, y: -4.5 };
const SW = 0.15; // sidewalk height

export function cityTerrain(x, z) { return (x > TUN.x0 && x < TUN.x1 && z > TUN.z0 && z < TUN.z1) ? TUN.y : 0; }

const TYPES = [
  ['apart', 'sky', 'office', 'constr', 'park'],
  ['garage', 'shops', 'tower', 'apart', 'sky'],
  ['park', 'office', 'plaza', 'shops', 'garage'],
  ['constr', 'apart', 'tower', 'sky', 'shops'],
  ['shops', 'sky', 'park', 'office', 'apart'],
];

export function buildCity(scene, quality, seed = 1) {
  const r = mulberry32(seed * 1291 + 5);
  const world = new CollisionWorld({ minX: -170, maxX: 170, minZ: -170, maxZ: 170, terrain: cityTerrain, water: -999 });
  const B = new WorldBuilder(world, scene, quality); B.glassPane = P.glassPane;
  const info = { id: 'city', name: 'Neon Harbor', world, builder: B, lootSpots: [], crateSpots: [], interactives: [], glass: [], cars: [], neon: [], lights: [], animated: [], trafficLights: [], statues: [], waterMats: [] };
  const loot = (x, y, z, tier = 0) => info.lootSpots.push({ x, y, z, tier });
  info.navBase = () => 0;

  // ---------- Ground: asphalt (split around tunnel) ----------
  const G0 = -400, G1 = 400;
  const asphaltRects = [[G0, G0, G1, TUN.z0], [G0, TUN.z1, G1, G1], [G0, TUN.z0, TUN.x0, TUN.z1], [TUN.x1, TUN.z0, G1, TUN.z1]];
  for (const [a, b, c, d] of asphaltRects) B.box(a, -0.3, b, c, 0, d, 'asphalt', '#ffffff', { collide: false, noBottom: true });
  // lane markings + crosswalks
  for (const c of [...ROADS, -182, 182]) {
    for (let t = -175; t < 175; t += 6) {
      if (ROADS.some((q) => Math.abs(t + 1.5 - q) < RW + 3)) continue;
      B.box(c - 0.1, 0.005, t, c + 0.1, 0.02, t + 3, 'paint', '#f2c94c', { collide: false });
      B.box(t, 0.005, c - 0.1, t + 3, 0.02, c + 0.1, 'paint', '#f2c94c', { collide: false });
    }
    for (const q of ROADS) for (let k = -4; k <= 4; k += 1.2) {
      B.box(c + k - 0.35, 0.006, q - RW - 3, c + k + 0.35, 0.02, q - RW - 0.6, 'paint', '#eeeeee', { collide: false });
      B.box(c + k - 0.35, 0.006, q + RW + 0.6, c + k + 0.35, 0.02, q + RW + 3, 'paint', '#eeeeee', { collide: false });
    }
  }

  // ---------- Tunnel / underground passage ----------
  const ty = TUN.y;
  const pitW = [-58, -52], pitE = [52, 58], lane = [-42, -38];
  // ceiling slabs (street surface above the tunnel) leaving stair pits open
  B.box(pitW[1], -0.4, TUN.z0, pitE[0], 0, TUN.z1, 'asphalt', '#ffffff');
  for (const [a, b] of [pitW, pitE]) { B.box(a, -0.4, TUN.z0, b, 0, lane[0], 'asphalt', '#ffffff'); B.box(a, -0.4, lane[1], b, 0, TUN.z1, 'asphalt', '#ffffff'); }
  B.box(TUN.x0, ty - 0.2, TUN.z0, TUN.x1, ty, TUN.z1, 'tiles', '#cfd6dc', { collide: false });
  B.box(pitW[1], -0.5, TUN.z0, pitE[0], -0.42, TUN.z1, 'tiles', '#d8dde2', { collide: false, shade: 1.2 });
  B.box(TUN.x0 - 0.3, ty, TUN.z0 - 0.3, TUN.x1 + 0.3, -0.4, TUN.z0, 'tiles', '#e8e4dc'); B.box(TUN.x0 - 0.3, ty, TUN.z1, TUN.x1 + 0.3, -0.4, TUN.z1 + 0.3, 'tiles', '#e8e4dc');
  B.box(TUN.x0 - 0.3, ty, TUN.z0, TUN.x0, 0, TUN.z1, 'tiles', '#e8e4dc'); B.box(TUN.x1, ty, TUN.z0, TUN.x1 + 0.3, 0, TUN.z1, 'tiles', '#e8e4dc');
  const nst = 15; B.stairs(pitW[1], ty, lane[0], '-x', 4, -ty, nst, 0.4, 'concrete', '#a9a39a'); B.stairs(pitE[0], ty, lane[0], '+x', 4, -ty, nst, 0.4, 'concrete', '#a9a39a');
  for (const [a, b] of [pitW, pitE]) for (const z of lane) B.box(a, 0, z - 0.05, b, 1.0, z + 0.05, 'metal', '#3a6a3a', { flags: F_SOLID });
  B.box(pitW[1] - 0.05, 0, lane[0], pitW[1] + 0.05, 1, lane[1], 'metal', '#3a6a3a', { flags: F_SOLID }); B.box(pitE[0] - 0.05, 0, lane[0], pitE[0] + 0.05, 1, lane[1], 'metal', '#3a6a3a', { flags: F_SOLID });
  for (let x = -46; x <= 46; x += 8) { B.box(x - 0.35, ty, -40.35, x + 0.35, -0.4, -39.65, 'tiles', '#3a7fbf'); B.box(x - 2.5, -0.62, -43.8, x + 2.5, -0.5, -43.4, 'glow', '#dff3ff', { collide: false }); B.box(x - 2.5, -0.62, -36.6, x + 2.5, -0.5, -36.2, 'glow', '#dff3ff', { collide: false }); }
  for (let x = -40; x <= 40; x += 20) { sign(info, B, 'METRO ↔', '#4fd1ff', x, ty + 2.6, TUN.z0 + 0.02, 4, 0, '#0b2a3a'); }
  B.box(-20, ty, -44, -18.8, ty + 1.9, -43.2, 'paint', '#d63a3a'); B.box(18, ty, -44, 19.2, ty + 1.9, -43.2, 'paint', '#3a8ad6'); // vending
  for (const x of [-30, -6, 14, 34]) { P.crate(B, x, ty, -37, 1.2, '#7a6a4a'); loot(x + 1.6, ty, -38, 1); }
  info.crateSpots.push({ x: 0, y: ty, z: -40 });

  // ---------- Blocks ----------
  for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) {
    const [bx0, bx1] = BLOCKS[i], [bz0, bz1] = BLOCKS[j];
    B.box(bx0, 0, bz0, bx1, SW, bz1, 'concrete', '#b9b4ab');
    const L = { x0: bx0 + 3, x1: bx1 - 3, z0: bz0 + 3, z1: bz1 - 3, i, j };
    // street furniture on sidewalks
    for (let t = bx0 + 6; t < bx1 - 4; t += 16) { P.streetLamp(B, t, bz0 + 0.8, SW, info.lights); P.streetLamp(B, t, bz1 - 0.8, SW, null); }
    if (r() < 0.5) B.box(bx0 + 4, SW, bz0 + 1, bx0 + 4.6, SW + 0.9, bz0 + 1.6, 'paint', '#2f6f4f');
    const t = TYPES[j][i];
    ({ apart, sky, office, constr, park, garage, shops, tower, plaza })[t](B, L, r, info, loot);
    // traffic lights at block corners
    for (const [cx, cz] of [[bx0 + 0.6, bz0 + 0.6], [bx1 - 0.6, bz1 - 0.6]]) P.trafficLight(B, cx, cz, SW, info.trafficLights);
  }

  // ---------- Parked vehicles ----------
  const carCols = ['#e8463c', '#2f6fd6', '#f2f2f2', '#2b2b2b', '#8a8f99', '#2fa8a0', '#6b4fa0', '#d98c2e'];
  for (const c of ROADS) for (let s = -1; s <= 1; s += 2) for (let t = -165; t < 165; t += 9) {
    if (ROADS.some((q) => Math.abs(t - q) < RW + 8)) continue;
    if (Math.abs(c + 40) < 1 && t > TUN.x0 - 6 && t < TUN.x1 + 6 && false) continue;
    if (r() < 0.45) continue;
    const kind = r() < 0.18 ? 'taxi' : r() < 0.12 ? 'van' : 'sedan'; const col = kind === 'taxi' ? '#ffd23f' : carCols[Math.floor(r() * carCols.length)];
    // along roads running in z (x = c) and in x (z = c)
    if (!(c === -40 && Math.abs(t) < 62 && s === 0)) P.car(B, c + s * 3.4, t, false, col, kind, 0, info.cars);
    if (r() < 0.6 && !(c === -40 && t > TUN.x0 - 3 && t < TUN.x1 + 3 && Math.abs(s * 3.4) < 5)) P.car(B, t, c + s * 3.4, true, carCols[Math.floor(r() * carCols.length)], 'sedan', 0, info.cars);
  }
  // buses at stops
  for (const [x, z, dx] of [[-80, 120 + 3.2, true], [80, -120 - 3.2, true], [40 + 3.2, 80, false], [-120 - 3.2, -80, false]]) P.car(B, x, z, dx, '#2f8f83', 'bus', 0, info.cars);
  for (let i = 0; i < 6; i++) { const c = info.cars[Math.floor(r() * info.cars.length)]; if (c) loot(c.x + 3, SW, c.z + 3, 1); }

  // ---------- Skyline outside the play area (visual only) ----------
  for (let k = 0; k < 64; k++) {
    const a = (k / 64) * Math.PI * 2, d = 215 + r() * 120; const x = Math.cos(a) * d, z = Math.sin(a) * d;
    const w = 18 + r() * 18, h = 40 + r() * 120;
    B.box(x - w / 2, 0, z - w / 2, x + w / 2, h, z + w / 2, r() < 0.5 ? 'tower' : 'office', '#ffffff', { collide: false, noBottom: true });
    B.box(x - w / 2 + 2, h, z - w / 2 + 2, x + w / 2 - 2, h + 3, z + w / 2 - 2, 'concrete', '#555b63', { collide: false });
    if (r() < 0.4) { const m = new THREE.Mesh(P.G.sphereLo, new THREE.MeshBasicMaterial({ color: '#ff3030', toneMapped: false })); m.position.set(x, h + 4, z); m.scale.setScalar(0.6); scene.add(m); info.animated.push({ m, blink: true }); }
  }
  // boundary barricades
  for (let t = -170; t < 170; t += 4) for (const e of [-170, 170]) {
    B.box(e - 0.3, 0, t, e + 0.3, 1.1, t + 3.6, 'paint', (t / 4) % 2 ? '#f2f2f2' : '#e8463c', { collide: false }); B.box(t, 0, e - 0.3, t + 3.6, 1.1, e + 0.3, 'paint', (t / 4) % 2 ? '#e8463c' : '#f2f2f2', { collide: false });
  }
  B.finalize();

  // dynamic traffic light bulbs
  const bulbGeo = new THREE.SphereGeometry(0.13, 8, 6); info.bulbs = [];
  for (const [ci, col] of [[0, '#ff2a2a'], [1, '#ffcc22'], [2, '#33ff66']]) {
    const im = new THREE.InstancedMesh(bulbGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), info.trafficLights.length * 2);
    const m4 = new THREE.Matrix4(); let n = 0;
    for (const tl of info.trafficLights) for (const s of [-1, 1]) { m4.makeTranslation(tl.x + s * 0.26, tl.y + 0.35 - ci * 0.35, tl.z); im.setMatrixAt(n, m4); im.setColorAt(n, new THREE.Color(col).multiplyScalar(0.15)); n++; }
    im.userData = { ci, col: new THREE.Color(col) }; scene.add(im); info.bulbs.push(im);
  }

  info.env = {
    sky: { turbidity: 9, rayleigh: 2.6, mie: 0.006, mieG: 0.9, elevation: 9, azimuth: 235 },
    sunColor: '#ffb27a', sunIntensity: 2.4, hemiSky: '#8fa6d6', hemiGround: '#5a4a46', hemiIntensity: 1.0, fog: '#d7a98e', fogDensity: 0.0052, exposure: 0.85,
    ambience: 'city', clouds: false,
  };
  info.bounds = world.bounds;
  info.brCenter = { x: 0, z: 0, r: 185 };
  info.arena = { minX: -60, maxX: 60, minZ: -60, maxZ: 60 };
  info.arenaCustomLarge = { minX: -170, maxX: 170, minZ: -170, maxZ: 170 };
  info.menuCam = { pos: [12, 3.0, 22], look: [0, 2.5, 8] };
  info.ambientRing = 182;
  return info;
}

// ---------- block fillers ----------
const Y = SW;
function sky(B, L, r, info, loot) {
  const mx = (L.x0 + L.x1) / 2, mz = (L.z0 + L.z1) / 2; const W = L.x1 - L.x0, D = L.z1 - L.z0;
  const parts = W > 50 ? [[L.x0, L.z0, mx - 3, mz - 3], [mx + 3, L.z0, L.x1, mz - 3], [L.x0, mz + 3, mx - 3, L.z1], [mx + 3, mz + 3, L.x1, L.z1]] : [[L.x0, L.z0, L.x1, mz - 2], [L.x0, mz + 2, L.x1, L.z1]];
  parts.forEach(([a, b, c, d], k) => {
    if (W > 50 && k === 3) { // small plaza with cover
      for (let q = 0; q < 6; q++) { const x = a + 4 + r() * (c - a - 8), z = b + 4 + r() * (d - b - 8); B.box(x - 1.5, Y, z - 1.5, x + 1.5, Y + 0.9, z + 1.5, 'concrete', '#a8a29a'); B.geom(P.G.sphere, P.mat(x, Y + 1.4, z, 0, 0, 0, 1.3, 1, 1.3), 'clay', '#5ea442'); }
      loot((a + c) / 2, Y, (b + d) / 2, 1); info.crateSpots.push({ x: (a + c) / 2 + 3, y: Y, z: (b + d) / 2 }); return;
    }
    const inset = 3; const h = 45 + r() * 75;
    B.box(a + inset, Y, b + inset, c - inset, Y + h, d - inset, r() < 0.5 ? 'tower' : 'office', '#ffffff', { noBottom: true });
    B.box(a + inset - 0.5, Y, b + inset - 0.5, c - inset + 0.5, Y + 4.5, d - inset + 0.5, 'concrete', '#3f454d');
    B.box(a + inset + 2, Y + h, b + inset + 2, c - inset - 2, Y + h + 4, d - inset - 2, 'concrete', '#4f555d', { collide: false });
    // entrance canopy
    B.box((a + c) / 2 - 4, Y + 4, d - inset, (a + c) / 2 + 4, Y + 4.3, d - inset + 3, 'metal', '#2b2e33', { collide: false });
    if (r() < 0.6) { const bb = billboard(B, info, (a + c) / 2, Y + 12 + r() * 10, d - inset + 0.1, 0, r); }
    for (let q = 0; q < 3; q++) { const x = a + 2 + r() * (c - a - 4); B.box(x - 0.9, Y, d - 1.5, x + 0.9, Y + 0.8, d - 0.6, 'concrete', '#9c968e'); }
  });
}
function billboard(B, info, x, y, z, rot, r) {
  const ads = [['CLAY COLA', 'Taste the squish', '#e8463c', '#ffb02e'], ['PUTTY PHONE 9', 'Now 18% more moldable', '#2f6fd6', '#28e7ff'], ['NEON NOODLES', 'Open 24/7', '#ff2bd6', '#6b4fa0'], ['SUNNY AIR', 'Fly to Coral Cove', '#2fa8a0', '#ffd23f'], ['AGENT 18594', 'Coming to theaters', '#1d1d22', '#e07b2a']];
  const [t, s, c1, c2] = ads[Math.floor(r() * ads.length)];
  const m = new THREE.Mesh(new THREE.PlaneGeometry(12, 6), new THREE.MeshBasicMaterial({ map: billboardTexture(t, s, c1, c2), toneMapped: false, color: new THREE.Color(1.3, 1.3, 1.3) }));
  m.position.set(x, y, z); m.rotation.y = rot; B.dynamic.add(m); info.neon.push({ m, flicker: false, base: 1.3, t: 0 });
}
function office(B, L, r, info, loot) {
  const mx = (L.x0 + L.x1) / 2; const W = L.x1 - L.x0;
  const halves = W > 50 ? [[L.x0 + 2, L.z0 + 4, mx - 4, L.z1 - 4], [mx + 4, L.z0 + 4, L.x1 - 2, L.z1 - 4]] : [[L.x0 + 2, L.z0 + 4, L.x1 - 2, L.z1 - 4]];
  halves.forEach(([a, b, c, d], k) => {
    const floors = 4 + Math.floor(r() * 2);
    const bl = B.building({ x0: a, z0: b, x1: c, z1: d, y: Y, floors, fh: 3.6, roof: true, mat: r() < 0.5 ? 'concrete' : 'brick', color: ['#d8d2c8', '#c9c2b8', '#e0dcd2'][k % 3], trim: '#3f454d',
      doors: [{ side: 's', at: 0.5, w: 3 }, { side: 'n', at: 0.6, w: 2 }, { side: 'e', at: 0.4, w: 1.8 }, { side: 'w', at: 0.7, w: 1.8 }], floorMat: 'tiles', floorColor: '#d9d6cf', winW: 1.8, winSpacing: 3.4, roofColor: '#6e6a64' });
    addBuildingLoot(bl, loot, r, 2);
    // desks per floor
    for (let f = 0; f < floors; f++) for (let q = 0; q < 3; q++) { const x = a + 4 + q * ((c - a - 8) / 2), z = d - 5; const y = Y + f * 3.6 + (f === 0 ? 0.12 : 0); B.box(x - 1, y, z - 0.5, x + 1, y + 0.8, z + 0.5, 'wood', '#8b6a4a'); }
    // rooftop AC units
    B.box(a + 3, Y + floors * 3.6, d - 6, a + 6, Y + floors * 3.6 + 1.6, d - 3, 'metal', '#9aa0a6');
    info.crateSpots.push({ x: c - 4, y: Y + floors * 3.6, z: d - 4 });
    sign(info, B, ['CLAYCORP', 'MOLDWORKS', 'SCULPT & CO', 'KILN BANK'][Math.floor(r() * 4)], '#7fd8ff', (a + c) / 2, Y + 3.0, d + 0.06, 9, 0, '#0b1a2a');
  });
}
function tower(B, L, r, info, loot) {
  const mz = (L.z0 + L.z1) / 2;
  const h = 80 + r() * 50; B.box(L.x0 + 3, Y, L.z0 + 3, L.x1 - 3, Y + h, mz - 6, 'tower', '#ffffff', { noBottom: true });
  B.box(L.x0 + 2.5, Y, L.z0 + 2.5, L.x1 - 2.5, Y + 5, mz - 5.5, 'concrete', '#2f343a');
  B.box(L.x0 + 10, Y + h, L.z0 + 10, L.x1 - 10, Y + h + 8, mz - 14, 'concrete', '#4f555d', { collide: false });
  B.geom(P.G.cyl, P.mat((L.x0 + L.x1) / 2, Y + h + 20, (L.z0 + mz) / 2, 0, 0, 0, 0.4, 24, 0.4), 'metal', '#ccc');
  const bl = B.building({ x0: L.x0 + 6, z0: mz + 2, x1: L.x1 - 6, z1: L.z1 - 3, y: Y, floors: 6, fh: 3.6, roof: true, mat: 'concrete', color: '#cfc9bf', trim: '#e07b2a', doors: [{ side: 's', at: 0.5, w: 3 }, { side: 'n', at: 0.5, w: 2 }, { side: 'w', at: 0.5 }], floorMat: 'tiles', floorColor: '#ddd8cf', winW: 2, winSpacing: 3.6 });
  addBuildingLoot(bl, loot, r, 2); loot((L.x0 + L.x1) / 2, Y + 6 * 3.6, L.z1 - 8, 3);
  info.crateSpots.push({ x: (L.x0 + L.x1) / 2 + 4, y: Y + 6 * 3.6, z: L.z1 - 10 });
  billboard(B, info, (L.x0 + L.x1) / 2, Y + 30, mz - 5.9, 0, r);
}
function apart(B, L, r, info, loot) {
  const W = L.x1 - L.x0, D = L.z1 - L.z0; const nx = W > 50 ? 2 : 1, nz = 2;
  const cw = W / nx, cd = D / nz;
  for (let a = 0; a < nx; a++) for (let b = 0; b < nz; b++) {
    const x0 = L.x0 + a * cw + 2.5, z0 = L.z0 + b * cd + 2.5, x1 = x0 + cw - 6, z1 = z0 + cd - 6;
    const floors = 3 + Math.floor(r() * 2);
    const bl = B.building({ x0, z0, x1, z1, y: Y, floors, fh: 3.3, roof: true, mat: r() < 0.6 ? 'brick' : 'plaster', color: ['#ffffff', '#f2e3d0', '#e8d2c0', '#d8e3ea'][(a + b) % 4], trim: '#f2efe6',
      doors: [{ side: b ? 's' : 'n', at: 0.5, w: 2 }, { side: a ? 'e' : 'w', at: 0.5 }, { side: b ? 'n' : 's', at: 0.7 }], floorMat: 'wood', floorColor: '#b88a5c', winSpacing: 3.2 });
    addBuildingLoot(bl, loot, r, 2);
    // fire escape balconies on the alley side
    const fx = a ? x0 - 0.1 : x1 + 0.1; const dir = a ? -1 : 1;
    for (let f = 1; f < floors; f++) { const y = Y + f * 3.3; B.box(Math.min(fx, fx + dir * 1.5), y - 0.12, z0 + 3, Math.max(fx, fx + dir * 1.5), y, z0 + 8, 'metal', '#3a3d42'); B.box(Math.min(fx + dir * 1.45, fx + dir * 1.5), y, z0 + 3, Math.max(fx + dir * 1.45, fx + dir * 1.5), y + 1, z0 + 8, 'metal', '#3a3d42', { flags: F_SOLID }); }
    // dumpster in alley
    const dx = a ? x0 - 2.5 : x1 + 2.5; B.box(dx - 0.9, Y, z1 - 3, dx + 0.9, Y + 1.4, z1, 'paint', '#2f6f4f'); loot(dx, Y, z1 - 4.5, 0);
  }
}
function shops(B, L, r, info, loot) {
  const names = [['CAFE ARGILLA', '#ffb27a'], ['PIZZA PRESS', '#ff5d5d'], ['BOOKS & BEANS', '#7fd8ff'], ['NOODLE BAR', '#ff2bd6'], ['MINI MART', '#5bffb0'], ['DINER 24', '#ffe066'], ['RECORDS', '#b28cff'], ['FLORIST', '#ff8cc6'], ['GYM', '#28e7ff'], ['SUSHI', '#ff6f3c']];
  const W = L.x1 - L.x0, D = L.z1 - L.z0; const depth = 12;
  const rows = [['s', L.z1 - depth, L.z1], ['n', L.z0, L.z0 + depth]];
  let k = Math.floor(r() * 10);
  for (const [side, z0, z1] of rows) {
    const n = Math.max(2, Math.floor(W / 13)); const sw = W / n;
    for (let q = 0; q < n; q++) {
      const x0 = L.x0 + q * sw + 0.5, x1 = x0 + sw - 1; const [name, col] = names[k++ % names.length];
      B.building({ x0, z0, x1, z1, y: Y, floors: 1, fh: 4, mat: 'plaster', color: ['#f4e1c6', '#e3d6f0', '#d6f0e3', '#f0d6d6', '#f0ecd6'][q % 5], shopfront: true, glassList: info.glass, glassSides: [side],
        doors: [{ side, at: 0.5, w: 2 }, { side: side === 's' ? 'n' : 's', at: 0.25, w: 1.4 }], capColor: col, winW: 2.2, winSpacing: 3.6, floorMat: 'tiles', floorColor: '#e6e0d6', interior: false });
      const fz = side === 's' ? z1 + 0.06 : z0 - 0.06; sign(info, B, name, col, (x0 + x1) / 2, Y + 3.5, fz, Math.min(9, sw - 2), side === 's' ? 0 : Math.PI);
      // awning
      const az0 = side === 's' ? z1 : z0 - 1.6, az1 = side === 's' ? z1 + 1.6 : z0;
      B.box(x0 + 0.5, Y + 2.9, az0, x1 - 0.5, Y + 3.05, az1, 'fabric', col, { collide: false });
      // interior: counter + tables
      const cz = side === 's' ? z0 + 3 : z1 - 3; B.box(x0 + 1, Y + 0.12, cz - 0.5, x1 - 3, Y + 1.1, cz + 0.5, 'wood', '#7a5232');
      const tz = side === 's' ? z1 - 4 : z0 + 4; for (let tx = x0 + 2.5; tx < x1 - 1.5; tx += 3.5) { B.box(tx - 0.6, Y + 0.12, tz - 0.6, tx + 0.6, Y + 0.85, tz + 0.6, 'wood', '#c99a6a', { flags: F_SOLID }); }
      loot((x0 + x1) / 2, Y + 0.12, (z0 + z1) / 2, r() < 0.3 ? 1 : 0);
      // outdoor cafe seating
      if (side === 's' && q % 2 === 0) for (let tx = x0 + 2; tx < x1 - 1; tx += 3) { B.geom(P.G.cyl, P.mat(tx, Y + 0.4, z1 + 2.2, 0, 0, 0, 0.45, 0.06, 0.45), 'metal', '#ddd'); B.box(tx - 0.04, Y, z1 + 2.16, tx + 0.04, Y + 0.4, z1 + 2.24, 'metal', '#888', { collide: false }); P.umbrella(B, tx, z1 + 2.2, col, Y); }
    }
  }
  // back alley with clutter
  const mz = (L.z0 + L.z1) / 2;
  for (let x = L.x0 + 4; x < L.x1 - 4; x += 9) { if (r() < 0.6) B.box(x - 0.9, Y, mz - 0.7, x + 0.9, Y + 1.4, mz + 0.7, 'paint', r() < 0.5 ? '#2f6f4f' : '#3a5a9a'); else P.crate(B, x, Y, mz, 1.2); }
  for (let q = 0; q < 2; q++) P.explosiveBarrel(B, L.x0 + 8 + q * 20 + r() * 6, mz + 3, Y, info.interactives);
  loot((L.x0 + L.x1) / 2, Y, mz + 2, 1); info.crateSpots.push({ x: L.x0 + 6, y: Y, z: mz - 3 });
}
function garage(B, L, r, info, loot) {
  const x0 = L.x0 + 2, x1 = L.x1 - 2, z0 = L.z0 + 2, z1 = L.z1 - 2; const lh = 3.2, levels = 3;
  const rampW = 6, rampL = 16, nSteps = 16;
  const rx0 = x1 - rampW - 1; // ramp lane along +z/-z on east side
  for (let k = 1; k <= levels; k++) {
    const y = Y + k * lh;
    // deck with ramp hole
    B.box(x0, y - 0.3, z0, rx0, y, z1, 'concrete', '#9a958d');
    B.box(rx0, y - 0.3, z0, x1, y, z1 - rampL - 2, 'concrete', '#9a958d'); B.box(rx0, y - 0.3, z1 - 2, x1, y, z1, 'concrete', '#9a958d');
    // parapets with gaps
    for (const [a, b] of [[x0, x0 + (x1 - x0) * 0.4], [x0 + (x1 - x0) * 0.55, x1]]) { B.box(a, y, z0, b, y + 1.0, z0 + 0.25, 'concrete', '#b0aaa0'); B.box(a, y, z1 - 0.25, b, y + 1.0, z1, 'concrete', '#b0aaa0'); }
    B.box(x0, y, z0, x0 + 0.25, y + 1.0, z1, 'concrete', '#b0aaa0');
    // parked cars
    for (let q = 0; q < 4; q++) if (r() < 0.6) P.car(B, x0 + 4 + q * 6, z0 + 5, false, ['#e8463c', '#2f6fd6', '#f2f2f2', '#2b2b2b'][q], 'sedan', y, info.cars);
    loot(x0 + 6 + r() * 20, y, z1 - 6, k === levels ? 2 : 1);
    sign(info, B, `LEVEL ${k}`, '#ffe066', x0 + 0.3, y + 2, (z0 + z1) / 2, 4, Math.PI / 2, '#222');
  }
  // pillars
  for (let x = x0 + 6; x < rx0; x += 9) for (let z = z0 + 10; z < z1 - 4; z += 10) B.box(x - 0.4, Y, z - 0.4, x + 0.4, Y + levels * lh - 0.3, z + 0.4, 'concrete', '#a8a29a');
  // ramps (stepped collision, sloped visual)
  for (let k = 0; k < levels; k++) {
    const y = Y + k * lh;
    const zS = z1 - 2 - rampL; // ramp from zS (low) to z1-2 (high)
    for (let s = 0; s < nSteps; s++) { const top = y + lh * (s + 1) / nSteps; B.box(rx0, top - 0.3, zS + s * (rampL / nSteps), x1, top, zS + (s + 1) * (rampL / nSteps), 'concrete', '#8f8a83', { visible: false }); }
    const len = Math.hypot(rampL, lh); const ang = Math.atan2(lh, rampL);
    B.geom(P.G.box, P.mat((rx0 + x1) / 2, y + lh / 2 - 0.1, zS + rampL / 2, -ang, 0, 0, x1 - rx0, 0.25, len), 'concrete', '#8f8a83');
  }
  B.box(x0, Y, z0, x1, Y + 0.05, z1, 'concrete', '#8a857d', { collide: false });
  sign(info, B, 'P  PARKING', '#4fd1ff', (x0 + x1) / 2, Y + lh - 0.8, z1 + 0.1, 8, 0, '#0b2a5a');
  info.crateSpots.push({ x: x0 + 10, y: Y + levels * lh, z: (z0 + z1) / 2 });
}
function constr(B, L, r, info, loot) {
  const x0 = L.x0 + 4, x1 = L.x1 - 4, z0 = L.z0 + 4, z1 = L.z1 - 4; const fh = 4, floors = 3;
  B.box(L.x0, Y, L.z0, L.x1, Y + 0.05, L.z1, 'sand', '#b8916a', { collide: false });
  // fence with gaps
  for (let x = L.x0; x < L.x1; x += 4) if (Math.abs(x - (L.x0 + L.x1) / 2) > 4) { B.box(x, Y, L.z0 - 0.05, x + 3.9, Y + 2.2, L.z0 + 0.05, 'fabric', '#2f6f8f', { flags: F_SOLID | F_SIGHT }); B.box(x, Y, L.z1 - 0.05, x + 3.9, Y + 2.2, L.z1 + 0.05, 'fabric', '#2f6f8f', { flags: F_SOLID | F_SIGHT }); }
  // open structure: slabs + columns + stairs
  const W = x1 - x0; const sx = x0 + 2, sz = z0 + 2; const steps = 14, depth = 0.38, run = steps * depth;
  for (let f = 1; f <= floors; f++) {
    const y = Y + f * fh;
    B.box(x0, y - 0.3, z0, x1, y, sz, 'concrete', '#a9a39a'); B.box(x0, y - 0.3, sz + 2.8, x1, y, z1, 'concrete', '#a9a39a');
    B.box(x0, y - 0.3, sz, sx, y, sz + 2.8, 'concrete', '#a9a39a'); B.box(sx + run, y - 0.3, sz, x1, y, sz + 2.8, 'concrete', '#a9a39a');
    if (f < floors) { for (let x = x0 + 3; x < x1; x += 8) B.box(x, y, z1 - 0.1, x + 3, y + 1, z1, 'metal', '#ffd23f', { flags: F_SOLID }); }
    loot(x0 + 6 + r() * (W - 12), y, z1 - 5, f === floors ? 2 : 1);
  }
  for (let f = 0; f < floors; f++) { const y = Y + f * fh; if (f % 2 === 0) B.stairs(sx, y, sz, '+x', 1.4, fh, steps, depth); else B.stairs(sx + run, y, sz + 1.4, '-x', 1.4, fh, steps, depth); }
  for (let x = x0; x <= x1; x += 8) for (let z = z0; z <= z1; z += 8) if (!(z < sz + 3 && x > sx - 1 && x < sx + run + 1)) B.box(x - 0.25, Y, z - 0.25, x + 0.25, Y + floors * fh + 3, z + 0.25, 'metal', '#c76a2a', { flags: F_SOLID | F_BULLET });
  // crane
  const cx = x1 - 3, cz = z1 - 3; B.box(cx - 1, Y, cz - 1, cx + 1, Y + 45, cz + 1, 'metal', '#f2b134', { flags: F_SOLID | F_BULLET });
  B.box(cx - 30, Y + 44, cz - 0.8, cx + 10, Y + 45.5, cz + 0.8, 'metal', '#f2b134', { collide: false }); B.box(cx - 25, Y + 30, cz - 0.04, cx - 24.9, Y + 44, cz + 0.04, 'metal', '#333', { collide: false });
  // clutter
  for (let q = 0; q < 6; q++) { const x = L.x0 + 6 + r() * (L.x1 - L.x0 - 12), z = (L.z0 + L.z1) / 2 + (r() - 0.5) * 8; B.geom(P.G.cyl, P.mat(x, Y + 0.9, z, 0, 0, Math.PI / 2, 0.9, 3, 0.9), 'concrete', '#9a958d'); B.collider(x - 1.5, Y, z - 0.9, x + 1.5, Y + 1.8, z + 0.9); }
  for (let q = 0; q < 10; q++) B.geom(P.G.cone, P.mat(L.x0 + r() * (L.x1 - L.x0), Y + 0.35, L.z0 + 1 + r() * 2, 0, 0, 0, 0.25, 0.7, 0.25), 'paint', '#ff7a1a');
  P.explosiveBarrel(B, x0 + 2, z1 - 2, Y, info.interactives);
  info.crateSpots.push({ x: (x0 + x1) / 2, y: Y + floors * fh, z: (z0 + z1) / 2 });
}
function park(B, L, r, info, loot, wm) {
  B.box(L.x0 - 1, Y, L.z0 - 1, L.x1 + 1, Y + 0.08, L.z1 + 1, 'grass', '#ffffff', { collide: false });
  const mx = (L.x0 + L.x1) / 2, mz = (L.z0 + L.z1) / 2;
  B.box(mx - 1.5, Y + 0.081, L.z0 - 1, mx + 1.5, Y + 0.09, L.z1 + 1, 'concrete', '#d8cfbe', { collide: false }); B.box(L.x0 - 1, Y + 0.081, mz - 1.5, L.x1 + 1, Y + 0.09, mz + 1.5, 'concrete', '#d8cfbe', { collide: false });
  for (let q = 0; q < 18; q++) { const x = L.x0 + 3 + r() * (L.x1 - L.x0 - 6), z = L.z0 + 3 + r() * (L.z1 - L.z0 - 6); if (Math.abs(x - mx) < 4 || Math.abs(z - mz) < 4) continue; P.tree(B, x, z, r, Y); }
  // pond
  const px = mx + (L.x1 - mx) / 2, pz = mz + (L.z1 - mz) / 2; const pond = new THREE.Mesh(new THREE.CircleGeometry(6, 28), makeWaterMaterial({ wave: 0.05, deep: '#2f6f6a', shallow: '#5fb3a0', opacity: 0.85, detail: 0.5 }));
  pond.rotation.x = -Math.PI / 2; pond.position.set(px, Y + 0.12, pz); B.dynamic.add(pond); info.waterMats.push(pond.material);
  for (let q = 0; q < 14; q++) { const a = q / 14 * Math.PI * 2; P.rock(B, px + Math.cos(a) * 6.3, Y - 0.3, pz + Math.sin(a) * 6.3, 0.7, r, '#8d8478'); }
  // gazebo
  const gx = mx - (mx - L.x0) / 2, gz = mz - (mz - L.z0) / 2;
  B.geom(P.G.cyl, P.mat(gx, Y + 0.3, gz, 0, 0, 0, 4, 0.6, 4), 'wood', '#c99a6a'); B.collider(gx - 3.5, Y, gz - 3.5, gx + 3.5, Y + 0.6, gz + 3.5);
  for (let q = 0; q < 6; q++) { const a = q / 6 * Math.PI * 2; B.box(gx + Math.cos(a) * 3.6 - 0.12, Y + 0.6, gz + Math.sin(a) * 3.6 - 0.12, gx + Math.cos(a) * 3.6 + 0.12, Y + 3.6, gz + Math.sin(a) * 3.6 + 0.12, 'wood', '#f2efe6', { flags: F_SOLID | F_BULLET }); }
  B.geom(P.G.cone, P.mat(gx, Y + 4.4, gz, 0, 0, 0, 4.6, 1.8, 4.6), 'paint', '#3f8a5a');
  loot(gx, Y + 0.6, gz, 2);
  // playground
  const kx = mx - (mx - L.x0) / 2, kz = mz + (L.z1 - mz) / 2;
  B.box(kx - 1, Y, kz - 1, kx + 1, Y + 2.2, kz + 1, 'paint', '#ff5d5d'); B.geom(P.G.box, P.mat(kx + 2.6, Y + 1.1, kz, 0, 0, -0.62, 3.6, 0.15, 1), 'paint', '#ffd23f');
  B.box(kx - 6, Y, kz - 2, kx - 5.8, Y + 2.5, kz - 1.8, 'metal', '#2f6fd6'); B.box(kx - 6, Y, kz + 1.8, kx - 5.8, Y + 2.5, kz + 2, 'metal', '#2f6fd6'); B.box(kx - 6, Y + 2.4, kz - 2, kx - 5.8, Y + 2.6, kz + 2, 'metal', '#2f6fd6', { collide: false });
  for (let q = 0; q < 6; q++) P.bench(B, mx + (q < 3 ? -3 : 3), L.z0 + 8 + (q % 3) * 14, false, Y);
  info.crateSpots.push({ x: mx + 6, y: Y, z: mz - 6 });
}
function plaza(B, L, r, info, loot) {
  const mx = (L.x0 + L.x1) / 2, mz = (L.z0 + L.z1) / 2;
  B.box(L.x0, Y, L.z0, L.x1, Y + 0.05, L.z1, 'tiles', '#d9cdb8', { collide: false, s: 3 });
  // fountain
  B.geom(P.G.cyl, P.mat(mx, Y + 0.4, mz, 0, 0, 0, 8, 0.8, 8), 'concrete', '#c9c2b8'); B.collider(mx - 7.2, Y, mz - 7.2, mx + 7.2, Y + 0.8, mz + 7.2);
  const fw = new THREE.Mesh(new THREE.CircleGeometry(7.4, 32), makeWaterMaterial({ wave: 0.08, deep: '#1f7fb0', shallow: '#6fd8f0', opacity: 0.8, detail: 0.8 }));
  fw.rotation.x = -Math.PI / 2; fw.position.set(mx, Y + 0.82, mz); B.dynamic.add(fw); info.waterMats.push(fw.material);
  // statue plinth for Agent 18594
  B.box(mx - 1.6, Y + 0.8, mz - 1.6, mx + 1.6, Y + 3.2, mz + 1.6, 'concrete', '#8a857d');
  info.statues.push({ x: mx, y: Y + 3.2, z: mz, scale: 2.4, char: 'agent', rot: Math.PI });
  sign(info, B, 'AGENT 18594', '#ffd27a', mx, Y + 2.0, mz + 1.62, 3, 0, '#3a2a1a');
  // planters + benches ring
  for (let q = 0; q < 8; q++) {
    const a = q / 8 * Math.PI * 2 + 0.39, d = 17; const x = mx + Math.cos(a) * d, z = mz + Math.sin(a) * d;
    B.box(x - 1.6, Y, z - 1.6, x + 1.6, Y + 1, z + 1.6, 'concrete', '#a8a29a'); P.tree(B, x, z, r, Y + 1, 0.7);
    if (q % 2) P.bench(B, mx + Math.cos(a + 0.35) * 11, mz + Math.sin(a + 0.35) * 11, Math.abs(Math.cos(a)) < 0.7, Y);
  }
  // kiosks + food truck
  for (const [x, z, n, c] of [[mx - 24, mz - 20, 'NEWS', '#7fd8ff'], [mx + 22, mz + 22, 'COFFEE', '#ffb27a'], [mx + 24, mz - 22, 'HOT DOGS', '#ff5d5d']]) {
    B.box(x - 2, Y, z - 1.5, x + 2, Y + 2.6, z + 1.5, 'paint', '#f2efe6'); B.box(x - 2.3, Y + 2.6, z - 1.8, x + 2.3, Y + 2.8, z + 1.8, 'paint', c); sign(info, B, n, c, x, Y + 3.3, z + 1.82, 3.6, 0); loot(x, Y, z + 2.5, 1);
  }
  P.car(B, mx - 22, mz + 20, true, '#ff8c42', 'van', Y, info.cars);
  for (let q = 0; q < 4; q++) { const a = q / 4 * Math.PI * 2; loot(mx + Math.cos(a) * 12, Y, mz + Math.sin(a) * 12, q % 2); }
  info.crateSpots.push({ x: mx + 10, y: Y, z: mz + 10 }, { x: mx - 10, y: Y, z: mz - 10 });
  billboard(B, info, mx, Y + 14, L.z0 - 0.5, 0, r);
}
