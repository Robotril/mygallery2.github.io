// MAP 1: CORAL COVE — tropical resort island turned combat zone.
import * as THREE from 'three';
import { CollisionWorld, F_SOLID, F_BULLET, F_ALL } from './collision.js';
import { WorldBuilder } from './builder.js';
import * as P from './props.js';
import { makeNoise2D, mulberry32, smoothstep, clamp } from '../core/util.js';
import { makeWaterMaterial, depthTextureFromWorld } from './water.js';
import { signTexture, signAtlas } from '../engine/textures.js';

const n2 = makeNoise2D(11);
const shoreZ = (x) => 72 + 6 * Math.sin(x * 0.02) + 3 * Math.sin(x * 0.06 + 1);
const PLATEAU = 1.6;
// rects flattened to PLATEAU for building pads [x0,z0,x1,z1]
const PADS = [[-100, -36, -48, 36], [-48, 18, 55, 46], [90, -26, 175, 46], [75, -175, 175, -60], [-40, -110, 70, -25]];
const POOLS = [[-92, 10, -72, 22, 1.4], [-66, 12, -56, 20, 0.7]];

export function beachTerrain(x, z) {
  const s = shoreZ(x); const d = s - z;
  let h = d > 0 ? Math.min(PLATEAU, d * 0.055) : Math.max(-2.3, d * 0.07);
  const inland = smoothstep(20, 40, d);
  h += inland * n2.fbm(x * 0.02, z * 0.02, 3) * 0.8;
  // NW hills
  const r = Math.hypot(x + 125, z + 125); h += Math.pow(Math.max(0, 1 - r / 75), 2) * (16 + n2(x * 0.05, z * 0.05) * 5);
  const r2 = Math.hypot(x + 165, z + 40); h += Math.pow(Math.max(0, 1 - r2 / 40), 2) * 7;
  // north ridge
  h += smoothstep(-150, -185, z) * 6 * (0.7 + 0.3 * n2(x * 0.03, 3));
  for (const [x0, z0, x1, z1] of PADS) {
    const dx = Math.max(x0 - x, 0, x - x1), dz = Math.max(z0 - z, 0, z - z1); const dd = Math.hypot(dx, dz);
    if (dd < 10) h = h + (PLATEAU - h) * (1 - smoothstep(0, 10, dd));
  }
  for (const [x0, z0, x1, z1, dep] of POOLS) if (x > x0 && x < x1 && z > z0 && z < z1) h = PLATEAU - dep - 0.2;
  return h;
}

export function buildBeach(scene, quality, seed = 1) {
  const r = mulberry32(seed * 977 + 13);
  const world = new CollisionWorld({ minX: -180, maxX: 180, minZ: -180, maxZ: 135, terrain: beachTerrain, water: 0 });
  const B = new WorldBuilder(world, scene, quality);
  const info = { id: 'beach', name: 'Coral Cove', world, builder: B, lootSpots: [], crateSpots: [], interactives: [], glass: [], cars: [], neon: [], lights: [], animated: [] };
  const T = (x, z) => world.terrain(x, z);
  const Y = PLATEAU;
  const loot = (x, y, z, tier = 0) => info.lootSpots.push({ x, y, z, tier });

  // ---------- Ground mesh ----------
  const seg = quality.terrainSeg;
  const gw = world.hmW - 2, gh = world.hmH - 2;
  const g = new THREE.PlaneGeometry(gw, gh, Math.floor(gw / seg), Math.floor(gh / seg)); g.rotateX(-Math.PI / 2);
  g.translate(world.hmMinX + gw / 2 + 1, 0, world.hmMinZ + gh / 2 + 1);
  const pos = g.attributes.position; const cols = []; const c = new THREE.Color();
  const sandC = new THREE.Color('#f3dfb2'), wetC = new THREE.Color('#c9a77a'), grassC = new THREE.Color('#76b544'), rockC = new THREE.Color('#9a9086'), jungleC = new THREE.Color('#5d8f3a');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i); const h = beachTerrain(x, z); pos.setY(i, h);
    const d = shoreZ(x) - z; const slope = Math.abs(beachTerrain(x + 1, z) - h) + Math.abs(beachTerrain(x, z + 1) - h);
    c.copy(sandC);
    if (d < 6) c.lerp(wetC, smoothstep(6, -2, d));
    const g2 = smoothstep(28, 48, d) * (0.6 + 0.4 * n2(x * 0.05, z * 0.05 + 4));
    c.lerp(x < -105 ? jungleC : grassC, clamp(g2 * 1.5, 0, 1));
    if (h > 5) c.lerp(rockC, smoothstep(5, 9, h) * 0.8);
    if (slope > 1.2) c.lerp(rockC, 0.7);
    // paths
    const path = Math.min(Math.abs(z + 40 + Math.sin(x * 0.03) * 6), Math.abs(x - 20 + Math.sin(z * 0.04) * 5));
    if (d > 30 && path < 3) c.lerp(new THREE.Color('#d8c08f'), 0.75);
    cols.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); g.computeVertexNormals();
  const ground = new THREE.Mesh(g, B.materials.sand.m); ground.receiveShadow = quality.shadows;
  // world-space sand uvs
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / 8, pos.getZ(i) / 8);
  scene.add(ground);

  // ---------- Ocean ----------
  const depth = depthTextureFromWorld(world, 0);
  const waterMat = makeWaterMaterial({ depthMap: depth.tex, depthRect: depth.rect, wave: 1, sunDir: quality.sunDir, detail: quality.waterDetail });
  const wseg = quality.waterSeg;
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(900, 700, wseg, wseg), waterMat); ocean.rotation.x = -Math.PI / 2; ocean.position.set(0, 0, 180); scene.add(ocean);
  const farOcean = new THREE.Mesh(new THREE.RingGeometry(380, 4000, 48, 1), waterMat); farOcean.rotation.x = -Math.PI / 2; farOcean.position.set(0, -0.15, 120); scene.add(farOcean);
  info.waterMats = [waterMat];
  const poolMat = makeWaterMaterial({ wave: 0.05, deep: '#1f8fd0', shallow: '#6fe3ff', opacity: 0.7, detail: 0.6, sunDir: quality.sunDir }); info.waterMats.push(poolMat);

  // ---------- Resort hotel (4 floors + roof) ----------
  const hotel = B.building({ x0: -95, z0: -30, x1: -55, z1: 0, y: Y, floors: 4, fh: 3.6, roof: true, mat: 'plaster', color: '#f4e1c6', trim: '#2fa8a0', floorMat: 'tiles', floorColor: '#e9e4d8',
    doors: [{ side: 's', at: 0.5, w: 3 }, { side: 'e', at: 0.6, w: 2 }, { side: 'w', at: 0.5, w: 2 }], winSpacing: 3.4, roofColor: '#d6c7ae' });
  addBuildingLoot(hotel, loot, r, 3);
  // balconies on south face
  for (let f = 1; f < 4; f++) for (let i = 0; i < 5; i++) {
    const bx = -91 + i * 8.2; const by = Y + f * 3.6;
    B.box(bx - 1.6, by - 0.2, 0, bx + 1.6, by, 1.6, 'concrete', '#efe6d6'); B.box(bx - 1.6, by, 1.5, bx + 1.6, by + 1.0, 1.6, 'glass', '#bfe6f0', { flags: F_SOLID });
  }
  sign(info, B, 'PALMERA RESORT', '#2fffe0', -75, Y + 15.4, 0.3, 14, 0, '#004d47');
  // pool deck
  B.box(-100, Y, 4, -50, Y + 0.08, 30, 'tiles', '#f2efe6', { collide: false });
  for (const [x0, z0, x1, z1, dep] of POOLS) {
    const fy = Y - dep; // pool floor
    B.box(x0, fy - 0.3, z0, x1, fy, z1, 'tiles', '#7fd3f0', { collide: false });
    B.box(x0 - 0.4, fy, z0 - 0.4, x0, Y + 0.25, z1 + 0.4, 'tiles', '#e6f4f8'); B.box(x1, fy, z0 - 0.4, x1 + 0.4, Y + 0.25, z1 + 0.4, 'tiles', '#e6f4f8');
    B.box(x0, fy, z0 - 0.4, x1, Y + 0.25, z0, 'tiles', '#e6f4f8'); B.box(x0, fy, z1, x1, Y + 0.25, z1 + 0.4, 'tiles', '#e6f4f8');
    world.addBox(x0, fy - 1, z0, x1, fy, z1, F_SOLID);
    const pm = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0, 8, 8), poolMat); pm.rotation.x = -Math.PI / 2; pm.position.set((x0 + x1) / 2, Y - 0.15, (z0 + z1) / 2); scene.add(pm);
  }
  // pool ladders steps are internal: add an exit ramp on the far side
  for (const [x0, z0, x1, z1, dep] of POOLS) { const n = Math.ceil((dep + 0.25) / 0.28); B.stairs(x1 - 2.1, Y - dep, z1 - n * 0.4, '+z', 2, dep + 0.25, n, 0.4, 'tiles', '#d8eef4'); }
  const umbCols = ['#ff5d5d', '#2fa8a0', '#ffd23f', '#ff8c42', '#7b6cff', '#ffffff'];
  for (let i = 0; i < 10; i++) { const x = -97 + i * 4.5; P.lounger(B, x, 27, true, '#ffffff', Y); if (i % 2 === 0) P.umbrella(B, x + 2.2, 27, umbCols[i % 6], Y); }
  for (let i = 0; i < 4; i++) { P.lounger(B, -52, 8 + i * 4, false, '#f1f1f1', Y); }
  // pool bar
  B.box(-58, Y, 24, -50, Y + 1.1, 25, 'wood', '#8b5a2b'); B.box(-50.5, Y, 24, -50, Y + 1.1, 31, 'wood', '#8b5a2b');
  for (const [px, pz] of [[-58, 24], [-50, 24], [-58, 31], [-50, 31]]) B.box(px - 0.12, Y, pz - 0.12, px + 0.12, Y + 3.2, pz + 0.12, 'wood', '#6b4a2e', { flags: F_SOLID | F_BULLET });
  thatch(B, -54, Y + 3.2, 27.5, 6, 5);
  loot(-54, Y, 27, 1); loot(-74, Y, 6, 0); loot(-88, Y, 28, 0);
  // hedges around resort
  for (let i = 0; i < 12; i++) { B.box(-101, Y, -30 + i * 5, -99.5, Y + 1.2, -26 + i * 5, 'clay', '#4e8a3a'); }

  // ---------- Boardwalk + shops ----------
  const BW = { x0: -110, x1: 100, z0: 36, z1: 44 };
  B.box(BW.x0, Y - 1, BW.z0, BW.x1, Y + 0.4, BW.z1, 'wood', '#b8895a');
  for (let x = BW.x0 + 4; x < BW.x1; x += 8) { P.streetLamp(B, x, BW.z1 - 0.3, Y + 0.4, info.lights); }
  for (let x = BW.x0; x < BW.x1; x += 2) if (![-80, -40, 0, 40, 80].some((sx) => Math.abs(x - sx) < 2.5)) B.box(x, Y + 0.4, BW.z1 - 0.08, x + 0.08, Y + 1.2, BW.z1, 'wood', '#f2efe6', { collide: false });
  for (const sx of [-80, -40, 0, 40, 80]) {
    const fy = T(sx, BW.z1 + 3), rise = Y + 0.4 - fy; const n = Math.max(1, Math.ceil(rise / 0.3));
    if (rise > 0.3) B.stairs(sx - 1.5, fy, BW.z1 + n * 0.5, '-z', 3, rise, n, 0.5, 'wood', '#c99a6a');
  }
  const shops = [['SURF SHACK', '#3ad6ff'], ['GELATO', '#ff6fa5'], ['SEASHELLS', '#ffd23f'], ['DIVE CO.', '#5bffb0'], ['TACO LOCO', '#ff8c42'], ['SUNSHADE', '#b28cff']];
  shops.forEach(([name, col], i) => {
    const x0 = -42 + i * 15, b = B.building({ x0, z0: 21, x1: x0 + 12, z1: 33, y: Y, floors: 1, mat: 'plaster', color: ['#ffd9c2', '#c2f0e8', '#fff1b8', '#d9e8ff', '#ffe0b8', '#ead9ff'][i], doors: [{ side: 's', at: 0.5, w: 2.2 }, { side: 'n', at: 0.3, w: 1.6 }], shopfront: true, capColor: col, interior: false });
    sign(info, B, name, col, x0 + 6, Y + 3.2, 33.35, 9, 0);
    B.box(x0 + 1, Y + 0.12, 25, x0 + 7, Y + 1.1, 26, 'wood', '#a0724a'); // counter
    loot(x0 + 4, Y + 0.12, 29, 0); if (i % 2) loot(x0 + 9, Y + 0.12, 24, 1);
  });
  // Tiki bar on the sand
  tikiBar(B, info, -20, 53, T(-20, 53), loot);

  // ---------- Beach ----------
  for (const lx of [-70, 5, 75]) { P.lifeguardTower(B, lx, 60, T(lx, 60)); loot(lx, T(lx, 60) + 3.2, 60, 1); }
  for (let i = 0; i < 26; i++) {
    const x = -105 + r() * 200, z = 48 + r() * 16; if (Math.abs(x + 20) < 8 || Math.abs(x - 58) < 6) continue; const y = T(x, z); if (y < 0.15) continue;
    P.umbrella(B, x, z, umbCols[i % 6], y); B.box(x - 0.6, y, z + 1, x + 0.6, y + 0.02, z + 2.8, 'fabric', umbCols[(i + 2) % 6], { collide: false });
    if (i % 4 === 0) loot(x + 1.5, y, z, 0);
  }
  // volleyball
  B.box(29.9, T(30, 56), 50, 30.1, T(30, 56) + 2.5, 50.2, 'metal', '#ddd', { flags: F_SOLID }); B.box(29.9, T(30, 62), 62, 30.1, T(30, 62) + 2.5, 62.2, 'metal', '#ddd', { flags: F_SOLID });
  B.box(29.97, T(30, 56) + 1.5, 50.2, 30.03, T(30, 56) + 2.4, 62, 'fabric', '#ffffff', { collide: false });

  // ---------- Pier + boats ----------
  const pierY = 1.6;
  B.box(56, pierY - 0.3, 44, 62, pierY, 116, 'wood', '#a87b52');
  B.box(48, pierY - 0.3, 116, 70, pierY, 128, 'wood', '#a87b52');
  for (let z = 48; z < 128; z += 6) for (const x of [56.2, 61.8]) B.box(x - 0.2, -3, z - 0.2, x + 0.2, pierY - 0.3, z + 0.2, 'wood', '#6b4a2e', { flags: F_SOLID | F_BULLET });
  for (let z = 44; z < 116; z += 2) { B.box(55.9, pierY, z, 56, pierY + 0.9, z + 0.08, 'wood', '#f2efe6', { collide: false }); B.box(62, pierY, z, 62.1, pierY + 0.9, z + 0.08, 'wood', '#f2efe6', { collide: false }); }
  P.crate(B, 52, pierY, 120, 1.3); P.crate(B, 53.5, pierY, 120, 1.3); P.crate(B, 52.7, pierY + 1.3, 120, 1.2); loot(66, pierY, 124, 2);
  info.crateSpots.push({ x: 60, y: pierY, z: 125 });
  P.boat(B, 49, 98, false, '#2fa8a0', 0); P.boat(B, 69, 106, false, '#e8463c', 0); P.boat(B, 40, 120, true, '#ffd23f', 0);
  loot(49, 0.9, 99, 2); loot(69, 0.9, 104, 1);
  // buoys
  for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(P.G.sphereLo, new THREE.MeshStandardMaterial({ color: i % 2 ? '#ff5d2e' : '#ffffff', roughness: 0.5 })); m.scale.setScalar(0.45); m.position.set(-150 + i * 38, 0.1, 128); scene.add(m); info.animated.push({ m, bob: i }); }

  // ---------- Beach houses (east) ----------
  const houseCols = ['#9fd8ff', '#ffc2d1', '#fff1a8', '#b8f0c8', '#e3d0ff', '#ffd8a8'];
  const houses = [[98, -20], [122, -20], [146, -20], [98, 14], [122, 14], [146, 14]];
  houses.forEach(([x, z], i) => {
    const h = B.building({ x0: x, z0: z, x1: x + 14, z1: z + 12, y: Y, floors: 2, fh: 3.4, roof: i % 2 === 0, mat: 'wood', color: houseCols[i], trim: '#ffffff', floorMat: 'wood', floorColor: '#d1a77a',
      doors: [{ side: 's', at: 0.65, w: 1.8 }, { side: 'n', at: 0.75, w: 1.6 }], capColor: '#5a7fa8', winSpacing: 3.2 });
    addBuildingLoot(h, loot, r, 2);
    // porch
    B.box(x, Y, z + 12, x + 14, Y + 0.3, z + 15, 'wood', '#c99a6a'); P.lounger(B, x + 3, z + 13.5, false, '#fff', Y + 0.3);
    if (i % 3 === 1) P.car(B, x + 7, z + 19, true, ['#e8463c', '#2fa8a0', '#f2b134'][i % 3], 'jeep', Y, info.cars);
  });
  for (let i = 0; i < 18; i++) P.palm(B, 92 + r() * 80, -28 + r() * 70, r);

  // ---------- Military outpost (NE) ----------
  const mY = Y;
  for (const [x, z, len, ax] of [[95, -150, 24, 'x'], [95, -90, 24, 'x'], [83, -120, 50, 'z'], [140, -66, 40, 'x'], [170, -120, 50, 'z'], [120, -172, 40, 'x']]) P.sandbags(B, x, z, len, ax, mY);
  P.watchtower(B, 88, -160, mY); P.watchtower(B, 165, -75, mY); loot(88, mY + 7.2, -160, 3); loot(165, mY + 7.2, -75, 3);
  for (const [x, z] of [[105, -135], [118, -135], [131, -135], [105, -108]]) { P.tent(B, x, z, mY, '#5b6b3a'); loot(x, mY, z, 1); }
  P.tank(B, 140, -110, mY); P.car(B, 118, -95, true, '#4b5320', 'jeep', mY, info.cars); P.car(B, 150, -150, false, '#4b5320', 'truck', mY, info.cars);
  for (let i = 0; i < 8; i++) { const x = 100 + (i % 4) * 3, z = -160 + Math.floor(i / 4) * 3; P.crate(B, x, mY, z, 1.4, '#4b5a32'); if (i % 3 === 0) P.crate(B, x, mY + 1.4, z, 1.2, '#55653a'); }
  info.crateSpots.push({ x: 108, y: mY, z: -150 }, { x: 150, y: mY, z: -130 });
  // helipad + crashed heli
  B.box(135, mY, -165, 160, mY + 0.1, -140, 'concrete', '#6e6e6e', { collide: false }); B.box(146, mY + 0.11, -153, 149, mY + 0.12, -152, 'paint', '#ffd23f', { collide: false });
  heli(B, 147, -152, mY);
  // bunker
  const bunker = B.building({ x0: 120, z0: -100, x1: 136, z1: -84, y: mY, floors: 1, fh: 3, mat: 'concrete', color: '#9a9a8e', doors: [{ side: 's', at: 0.5, w: 2 }, { side: 'w', at: 0.5, w: 1.6 }], winW: 1.2, winSpacing: 4, capColor: '#7d7d72', floorMat: 'concrete', floorColor: '#888', interior: false });
  loot(128, mY + 0.12, -92, 3); loot(124, mY + 0.12, -88, 2);
  // radar
  B.box(160, mY, -100, 161, mY + 6, -99, 'metal', '#888'); B.geom(P.G.sphere, P.mat(160.5, mY + 7, -99.5, 0.6, 0.3, 0, 2.4, 0.6, 2.4), 'metal', '#ccc');
  for (let i = 0; i < 6; i++) { P.explosiveBarrel(B, 112 + i * 1.1, -118, mY, info.interactives); }

  // ---------- Village market (center) ----------
  const vCols = ['#f4c2a1', '#d9f0c2', '#c2e0f4', '#f4e7a1', '#f4b8c8'];
  const vh = [[-30, -100, 14, 12, 2], [-10, -100, 12, 12, 1], [8, -100, 14, 12, 2], [30, -98, 12, 10, 1], [48, -100, 16, 14, 3], [-30, -60, 12, 10, 1], [-12, -64, 14, 12, 2], [36, -62, 14, 12, 2], [54, -64, 12, 12, 1]];
  vh.forEach(([x, z, w, d, f], i) => {
    const b = B.building({ x0: x, z0: z, x1: x + w, z1: z + d, y: Y, floors: f, fh: 3.4, roof: f >= 2, mat: i % 3 ? 'plaster' : 'brick', color: vCols[i % 5], doors: [{ side: 's', at: 0.5, w: 1.8 }, { side: 'n', at: 0.3, w: 1.6 }, { side: 'e', at: 0.5 }], capColor: ['#c76a4a', '#4a8ac7', '#5aa060'][i % 3] });
    addBuildingLoot(b, loot, r, f > 1 ? 2 : 1);
  });
  // market stalls in plaza
  for (let i = 0; i < 8; i++) { const x = -20 + (i % 4) * 12, z = -80 + Math.floor(i / 4) * 9; stall(B, x, z, Y, umbCols[i % 6]); if (i % 2) loot(x, Y, z + 1.6, 0); }
  // water tower
  for (const [dx, dz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) B.box(18 + dx - 0.15, Y, -40 + dz - 0.15, 18 + dx + 0.15, Y + 10, -40 + dz + 0.15, 'metal', '#7a6f62', { flags: F_SOLID | F_BULLET });
  B.geom(P.G.cyl, P.mat(18, Y + 12, -40, 0, 0, 0, 3.4, 4, 3.4), 'wood', '#8b5a2b'); B.geom(P.G.cone, P.mat(18, Y + 14.8, -40, 0, 0, 0, 3.8, 1.6, 3.8), 'paint', '#c76a4a');
  info.crateSpots.push({ x: 5, y: Y, z: -78 }, { x: 18, y: Y, z: -46 });

  // ---------- NW hills: lighthouse, rocks & smuggler's path ----------
  const lhY = T(-125, -125);
  B.geom(P.G.cyl, P.mat(-125, lhY + 9, -125, 0, 0, 0, 2.6, 18, 2.6), 'plaster', '#ffffff'); B.collider(-127, lhY, -127, -123, lhY + 18, -123);
  for (let i = 0; i < 3; i++) B.geom(P.G.cyl, P.mat(-125, lhY + 3 + i * 5.5, -125, 0, 0, 0, 2.62, 1.6, 2.62), 'paint', '#e8463c');
  B.geom(P.G.cyl, P.mat(-125, lhY + 19, -125, 0, 0, 0, 1.6, 2.2, 1.6), 'glass', '#fff6b0');
  const beacon = new THREE.Mesh(P.G.sphereLo, new THREE.MeshBasicMaterial({ color: '#fff4a0', toneMapped: false })); beacon.position.set(-125, lhY + 19.2, -125); beacon.scale.setScalar(0.8); scene.add(beacon); info.animated.push({ m: beacon, blink: true });
  B.geom(P.G.cone, P.mat(-125, lhY + 21, -125, 0, 0, 0, 2, 1.8, 2), 'paint', '#e8463c');
  for (let i = 0; i < 70; i++) {
    const a = r() * Math.PI * 2, d = 18 + r() * 60; const x = -125 + Math.cos(a) * d, z = -125 + Math.sin(a) * d;
    if (x < -178 || z < -178) continue; P.rock(B, x, T(x, z) - 0.5, z, 1.5 + r() * 3.5, r);
  }
  // Smuggler's path: a rock-roofed corridor cutting through the hill
  for (let i = 0; i < 9; i++) {
    const x = -95 - i * 5, z = -70 - i * 4.2, y = T(x, z);
    P.rock(B, x - 3.2, y - 0.3, z + 3, 2.6, r, '#7d7468'); P.rock(B, x + 3.2, y - 0.3, z - 3, 2.6, r, '#7d7468');
    if (i % 2 === 0) B.box(x - 3, y + 3.2, z - 3, x + 3, y + 4.2, z + 3, 'rock', '#7d7468');
    if (i === 4) { loot(x, y, z, 3); info.crateSpots.push({ x: x + 1, y, z: z + 1 }); }
  }
  // western jungle ruins
  for (let i = 0; i < 40; i++) { const x = -175 + r() * 70, z = -55 + r() * 110; if (r() < 0.6) P.palm(B, x, z, r); else P.tree(B, x, z, r); }
  for (let i = 0; i < 10; i++) { const x = -160 + (i % 5) * 9, z = 10 + Math.floor(i / 5) * 14, y = T(x, z); B.box(x - 1.5, y - 0.5, z - 1.5, x + 1.5, y + 1.2 + (i % 3), z + 1.5, 'rock', '#9b9283'); if (i % 3 === 0) loot(x + 2, y, z, 1); }
  B.box(-150, T(-150, 20), 16, -142, T(-150, 20) + 4, 18, 'rock', '#8e8577'); B.box(-150, T(-150, 20) + 4, 16, -132, T(-150, 20) + 5, 26, 'rock', '#8e8577');
  info.crateSpots.push({ x: -146, y: T(-146, 22), z: 22 });

  // scattered palms along beach & resort
  for (let i = 0; i < 40; i++) { const x = -110 + r() * 200, z = 30 + r() * 30; if (z > 35 && z < 46) continue; const y = T(x, z); if (y > 0.3 && !inAny(x, z, [[-46, 18, 55, 34], [52, 40, 66, 70]])) P.palm(B, x, z, r); }
  for (let i = 0; i < 30; i++) { const x = -40 + r() * 120, z = -25 + r() * 40; if (!inAny(x, z, [[-46, 18, 55, 34]])) P.palm(B, x, z, r); }
  // military scrap near beach
  P.tank(B, -110, 62, T(-110, 62) - 0.3); P.sandbags(B, -100, 56, 10, 'x', T(-100, 56));
  // scattered crates/cover across open ground
  for (let i = 0; i < 26; i++) { const x = -60 + r() * 140, z = -25 + r() * 50; if (inAny(x, z, [[-46, 18, 55, 34], [-100, -36, -48, 36], [90, -26, 175, 46]])) continue; P.crate(B, x, T(x, z), z, 1.2 + r() * 0.4); if (i % 3 === 0) loot(x + 1.5, T(x, z), z, 0); }
  // random outdoor loot
  for (let i = 0; i < 40; i++) { const x = -170 + r() * 340, z = -170 + r() * 230; const y = T(x, z); if (y > 0.2 && y < 12) loot(x, y, z, r() < 0.15 ? 2 : 0); }

  B.finalize(); finalizeSigns(info, B);

  info.env = {
    sky: { turbidity: 1.4, rayleigh: 2.2, mie: 0.0025, mieG: 0.8, elevation: 38, azimuth: 160 },
    sunColor: '#fff0d2', sunIntensity: 2.7, hemiSky: '#9fcff5', hemiGround: '#c9b089', hemiIntensity: 0.75, fog: '#bcd9ee', fogDensity: 0.0032, exposure: 0.82,
    ambience: 'beach', clouds: true,
  };
  info.bounds = world.bounds;
  info.brCenter = { x: 0, z: -40, r: 190 };
  info.arena = { minX: -100, maxX: 45, minZ: -2, maxZ: 60 };
  info.arenaCustomLarge = { minX: -110, maxX: 175, minZ: -110, maxZ: 60 };
  info.menuCam = { pos: [-30, 4.5, 62], look: [-20, 3.2, 52] };
  info.greenAt = beachGreen;
  return info;
}

// Grass density for the nature layer: lush inland, sparse dune grass on the upper beach, none on paths or pads.
export function beachGreen(x, z) {
  const d = shoreZ(x) - z; if (d < 9) return null;
  const path = Math.min(Math.abs(z + 40 + Math.sin(x * 0.03) * 6), Math.abs(x - 20 + Math.sin(z * 0.04) * 5));
  if (d > 30 && path < 3.4) return null;
  if (PADS.some(([x0, z0, x1, z1]) => x > x0 - 1 && x < x1 + 1 && z > z0 - 1 && z < z1 + 1)) return null;
  const g = smoothstep(26, 46, d) * (0.6 + 0.4 * n2(x * 0.05, z * 0.05 + 4));
  if (g > 0.32) return { dens: Math.min(1, g * 1.3), kind: x < -105 ? 'jungle' : 'lawn' };
  const dune = n2(x * 0.09 + 7, z * 0.09);
  if (d < 30 && dune > 0.25) return { dens: 0.18 * (dune - 0.25) / 0.75 + 0.05, kind: 'dune' };
  return null;
}

function inAny(x, z, rects) { return rects.some(([a, b, c, d]) => x > a && x < c && z > b && z < d); }

export function addBuildingLoot(b, loot, r, perFloor = 2) {
  for (let f = 0; f < b.floors; f++) for (let i = 0; i < perFloor; i++) {
    const x = b.x0 + 2 + r() * (b.x1 - b.x0 - 4), z = b.z0 + 4 + r() * (b.z1 - b.z0 - 6);
    loot(x, b.gy + f * b.fh + (f === 0 ? 0.12 : 0), z, f > 1 ? 2 : r() < 0.3 ? 1 : 0);
  }
}

function thatch(B, x, y, z, w, d) {
  for (let i = 0; i < 4; i++) B.box(x - w / 2 - 0.5 + i * 0.1, y + i * 0.25, z - d / 2 - 0.5 + i * 0.1, x + w / 2 + 0.5 - i * 0.1, y + 0.3 + i * 0.25, z + d / 2 + 0.5 - i * 0.1, 'leaf', i % 2 ? '#c9a45a' : '#b8913f', { flags: F_SOLID | F_BULLET });
}
function tikiBar(B, info, x, z, y, loot) {
  B.box(x - 4, y - 0.5, z - 4, x + 4, y + 0.3, z + 4, 'wood', '#a0724a');
  B.box(x - 3, y + 0.3, z - 3, x + 3, y + 1.4, z - 2.4, 'wood', '#7a5232'); B.box(x - 3, y + 0.3, z - 2.4, x - 2.4, y + 1.4, z + 2, 'wood', '#7a5232');
  for (const [px, pz] of [[-3.8, -3.8], [3.8, -3.8], [-3.8, 3.8], [3.8, 3.8]]) B.box(x + px - 0.15, y + 0.3, z + pz - 0.15, x + px + 0.15, y + 3.6, z + pz + 0.15, 'wood', '#6b4a2e', { flags: F_SOLID | F_BULLET });
  thatch(B, x, y + 3.6, z, 8, 8);
  for (let i = 0; i < 4; i++) B.box(x - 1.5 + i, y + 0.3, z - 1.6, x - 1.2 + i, y + 1.0, z - 1.3, 'wood', '#c99a6a', { flags: F_SOLID });
  sign(info, B, 'TIKI TIKI', '#ffb02e', x, y + 3.2, z + 4.05, 6, 0);
  loot(x + 1.5, y + 0.3, z + 1.5, 1);
}
function stall(B, x, z, y, color) {
  B.box(x - 2.2, y, z - 1, x + 2.2, y + 1, z + 1, 'wood', '#a0724a');
  for (const [dx, dz] of [[-2.1, -0.9], [2.1, -0.9], [-2.1, 0.9], [2.1, 0.9]]) B.box(x + dx - 0.05, y + 1, z + dz - 0.05, x + dx + 0.05, y + 2.6, z + dz + 0.05, 'wood', '#6b4a2e', { collide: false });
  B.box(x - 2.4, y + 2.6, z - 1.3, x + 2.4, y + 2.75, z + 1.3, 'fabric', color, { collide: false });
}
function heli(B, x, z, y) {
  B.geom(P.G.sphere, P.mat(x, y + 1.4, z, 0.2, 0.4, 0.35, 3, 1.5, 1.6), 'clay', '#4b5a32'); B.collider(x - 2.5, y, z - 1.5, x + 2.5, y + 2.6, z + 1.5);
  B.geom(P.G.cyl, P.mat(x - 4, y + 1.2, z + 1.4, Math.PI / 2 - 0.2, 0.4, 0.1, 0.35, 5, 0.35), 'clay', '#4b5a32');
  B.box(x - 4.5, y + 2.9, z - 0.15, x + 3.5, y + 3.0, z + 0.15, 'metal', '#333', { collide: false }); B.box(x - 0.2, y + 2.9, z - 3.5, x + 0.1, y + 3.0, z + 3.2, 'metal', '#333', { collide: false });
}

// Signs are queued and merged into one atlas mesh (finalizeSigns); a few flickering ones stay separate.
export function sign(info, B, text, color, x, y, z, w, rotY, bg) {
  if (Math.random() >= 0.1) { (info.signQueue ||= []).push({ text, color, x, y, z, w, rotY, bg }); return null; }
  const tex = signTexture(text, color, bg || 'rgba(0,0,0,0)');
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), new THREE.MeshBasicMaterial({ map: tex, transparent: !bg, toneMapped: false, side: THREE.DoubleSide, depthWrite: !!bg }));
  m.position.set(x, y, z); m.rotation.y = rotY; const base = bg ? 1.6 : 3; m.material.color.setScalar(base); B.dynamic.add(m); info.neon.push({ m, flicker: true, base, t: Math.random() * 10 });
  return m;
}
export function finalizeSigns(info, B) {
  const q = info.signQueue; if (!q || !q.length) return;
  const { tex, uvs } = signAtlas(q); const pos = [], uv = [], col = [], idx = [];
  q.forEach((s, i) => {
    const hw = s.w / 2, hh = s.w / 8, c = Math.cos(s.rotY), sn = Math.sin(s.rotY); const base = pos.length / 3; const k = s.bg ? 1.6 : 3; const [u0, v0, u1, v1] = uvs[i];
    for (const [lx, ly, uu, vv] of [[-hw, -hh, u0, v0], [hw, -hh, u1, v0], [hw, hh, u1, v1], [-hw, hh, u0, v1]]) { pos.push(s.x + lx * c, s.y + ly, s.z - lx * sn); uv.push(uu, vv); col.push(k, k, k); }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeBoundingSphere();
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, vertexColors: true, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide })); m.renderOrder = 2; B.dynamic.add(m);
}
