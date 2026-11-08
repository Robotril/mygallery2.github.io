// Procedural weapon models built from weapon data + attachment build. Barrel points toward -Z.
import * as THREE from 'three';
import { WEAPON_MAP, SKIN_MAP } from '../data/weapons.js';
import { skinTexture, clayBump } from '../engine/textures.js';

const box = new THREE.BoxGeometry(1, 1, 1);
const cyl = new THREE.CylinderGeometry(1, 1, 1, 14);
const cylLo = new THREE.CylinderGeometry(1, 1, 1, 8);
const matCache = new Map();
function M(color, o = {}) {
  const key = color + JSON.stringify(o);
  if (!matCache.has(key)) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? 0.45, metalness: (o.metal ?? 0.35) * 0.6, map: o.map || null, emissive: o.emissive || '#000000', emissiveIntensity: o.ei ?? 1, toneMapped: o.toneMapped ?? true });
    if (o.bump) { m.bumpMap = clayBump(); m.bumpScale = 0.6; }
    matCache.set(key, m);
  }
  return matCache.get(key);
}
function part(g, mat, sx, sy, sz, x, y, z, parent, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(g, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
  m.castShadow = true; parent.add(m); return m;
}

// Collapse all parts into one mesh per material (third-person + loot). Keeps the muzzle/eject anchors.
const _gm = new THREE.Matrix4(), _gn = new THREE.Matrix3(), _gv = new THREE.Vector3();
let bakedGunMat = null;
function mergeByMaterial(root, single = false) {
  if (single) { // one vertex-colored mesh for the whole gun (loot): 1 draw call
    root.traverse((o) => { if (o.isMesh) { const c = o.material.color; const g = o.geometry.clone(); const n = g.attributes.position.count; const col = new Float32Array(n * 3); for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); o.geometry = g; o.material = bakedGunMat ||= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.25 }); } });
  }
  root.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(); const buckets = new Map();
  root.traverse((o) => { if (o.isMesh) { if (!buckets.has(o.material)) buckets.set(o.material, []); buckets.get(o.material).push(o); } });
  for (const [mat, list] of buckets) {
    let nv = 0, ni = 0; for (const m of list) { nv += m.geometry.attributes.position.count; ni += m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count; }
    const pos = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), idx = new Uint32Array(ni); let v = 0, i = 0;
    for (const m of list) {
      _gm.multiplyMatrices(inv, m.matrixWorld); _gn.getNormalMatrix(_gm); const g = m.geometry, P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
      for (let k = 0; k < P.count; k++) { _gv.fromBufferAttribute(P, k).applyMatrix4(_gm); pos[(v + k) * 3] = _gv.x; pos[(v + k) * 3 + 1] = _gv.y; pos[(v + k) * 3 + 2] = _gv.z; _gv.fromBufferAttribute(N, k).applyMatrix3(_gn).normalize(); nrm[(v + k) * 3] = _gv.x; nrm[(v + k) * 3 + 1] = _gv.y; nrm[(v + k) * 3 + 2] = _gv.z; if (U) { uv[(v + k) * 2] = U.getX(k); uv[(v + k) * 2 + 1] = U.getY(k); } }
      if (g.index) for (let k = 0; k < g.index.count; k++) idx[i++] = g.index.getX(k) + v; else for (let k = 0; k < P.count; k++) idx[i++] = v + k;
      v += P.count; m.parent.remove(m);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(new THREE.BufferAttribute(idx, 1)); geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true; root.add(mesh);
  }
  const empty = []; root.traverse((o) => { if (o.isGroup && o !== root && !o.children.length) empty.push(o); }); for (const o of empty) o.parent?.remove(o);
}

export function buildGunModel(weaponId, build = {}, opts = {}) {
  const out = buildGunModelRaw(weaponId, build);
  if (opts.merge) { mergeByMaterial(out.group, !!opts.single); out.mag = null; out.pump = null; out.bolt = null; out.dot = null; out.blade = null; }
  return out;
}
function buildGunModelRaw(weaponId, build = {}) {
  const w = WEAPON_MAP[weaponId]; const md = w.model; const root = new THREE.Group(); root.name = weaponId;
  const skin = SKIN_MAP[build.skin || 'factory'];
  const skinTex = skin && skin.pattern !== 'none' ? skinTexture(skin) : null;
  const body = skinTex ? M('#ffffff', { map: skinTex, rough: skin.pattern === 'gold' ? 0.25 : 0.5, metal: skin.pattern === 'gold' ? 0.9 : 0.3, emissive: skin.pattern === 'neon' ? '#ffffff' : '#000', ei: skin.pattern === 'neon' ? 0.25 : 1 }) : M(md.color, { bump: true, rough: 0.5 });
  const accent = M(md.accent || '#333', { rough: 0.55, metal: 0.2, bump: true });
  const dark = M('#33363b', { rough: 0.38, metal: 0.6 });
  const out = { group: root, muzzle: new THREE.Object3D(), mag: null, pump: null, bolt: null, sightY: 0.06, sightZ: -0.1, eject: new THREE.Object3D() };

  if (md.knife) {
    const blade = part(box, M('#c9ced6', { rough: 0.2, metal: 0.95 }), 0.012, 0.035, 0.2, 0, 0.0, -0.14, root);
    part(box, M('#c9ced6', { rough: 0.2, metal: 0.95 }), 0.012, 0.02, 0.04, 0, 0.012, -0.255, root, 0.5, 0, 0);
    part(box, dark, 0.03, 0.05, 0.02, 0, -0.005, -0.035, root);
    part(cylLo, M(md.accent, { rough: 0.8, metal: 0, bump: true }), 0.017, 0.11, 0.017, 0, -0.005, 0.03, root, Math.PI / 2, 0, 0);
    out.muzzle.position.set(0, 0, -0.3); root.add(out.muzzle); out.length = 0.3; out.blade = blade;
    return out;
  }
  const L = md.len, H = md.h; const isPistol = w.cls === 'pistol';
  const recZ = -L * 0.35;
  // receiver
  part(box, body, 0.055, H * 0.55, L, 0, 0.02, recZ, root);
  if (isPistol) part(box, body, 0.05, H * 0.35, L * 1.02, 0, 0.02 + H * 0.42, recZ - 0.005, root); // slide
  else part(box, accent, 0.05, H * 0.4, L * 0.45, 0, 0.02 + H * 0.05, recZ - L * 0.42, root); // handguard
  // barrel
  let bLen = md.barrel + L * 0.25; if (build.barrel === 'long') bLen += 0.12;
  const frontZ = recZ - L / 2;
  if (md.stock === 'tubeL') { // rocket launcher tube
    part(cyl, body, md.br, 1.0, md.br, 0, 0.05, -0.15, root, Math.PI / 2, 0, 0);
    part(cyl, accent, md.br * 1.15, 0.08, md.br * 1.15, 0, 0.05, -0.66, root, Math.PI / 2, 0, 0);
    part(cyl, accent, md.br * 1.1, 0.06, md.br * 1.1, 0, 0.05, 0.34, root, Math.PI / 2, 0, 0);
    const war = part(new THREE.ConeGeometry(1, 1, 12), M('#556b2f', { bump: true, rough: 0.7, metal: 0 }), 0.05, 0.16, 0.05, 0, 0.05, -0.74, root, -Math.PI / 2, 0, 0);
    out.mag = war; out.muzzle.position.set(0, 0.05, -0.7); out.sightY = 0.13; out.sightZ = -0.2;
    part(box, dark, 0.02, 0.06, 0.02, 0, 0.13, -0.3, root);
  } else {
    part(cyl, dark, md.br, bLen, md.br, 0, 0.03 + (isPistol ? H * 0.3 : 0), frontZ - bLen / 2 + 0.03, root, Math.PI / 2, 0, 0);
    let mz = frontZ - bLen + 0.03;
    if (build.barrel === 'suppressor') { part(cyl, M('#2a2c30', { rough: 0.6 }), md.br * 2.1, 0.17, md.br * 2.1, 0, 0.03 + (isPistol ? H * 0.3 : 0), mz - 0.08, root, Math.PI / 2, 0, 0); mz -= 0.17; }
    else if (build.barrel === 'comp' || md.brake) { part(box, dark, md.br * 3, md.br * 2.4, 0.06, 0, 0.03 + (isPistol ? H * 0.3 : 0), mz - 0.03, root); mz -= 0.06; }
    else if (build.barrel === 'choke') { part(cyl, accent, md.br * 1.4, 0.05, md.br * 1.4, 0, 0.03, mz - 0.02, root, Math.PI / 2, 0, 0); mz -= 0.05; }
    out.muzzle.position.set(0, 0.03 + (isPistol ? H * 0.3 : 0), mz);
  }
  // stock
  if (md.stock === 'full') { part(box, accent, 0.045, H * 0.55, 0.22, 0, 0.0, 0.13 + L * 0.15 - 0.05, root, 0.08, 0, 0); part(box, dark, 0.05, H * 0.6, 0.02, 0, -0.005, 0.24 + L * 0.15 - 0.05, root); }
  else if (md.stock === 'skeleton') { part(box, dark, 0.012, 0.012, 0.2, 0.018, 0.04, 0.1, root); part(box, dark, 0.012, 0.012, 0.2, -0.018, 0.04, 0.1, root); part(box, dark, 0.05, 0.08, 0.015, 0, 0.01, 0.2, root); }
  else if (md.stock === 'bullpup') { part(box, body, 0.056, H * 0.6, 0.2, 0, 0.0, 0.1, root); }
  // grip
  if (md.grip === 'pistol') part(box, accent, 0.04, 0.1, 0.045, 0, -H * 0.3 - 0.03, isPistol ? -0.0 : 0.0, root, 0.25, 0, 0);
  else part(box, accent, 0.04, 0.07, 0.05, 0, -H * 0.25, 0.02, root, 0.5, 0, 0);
  // magazine
  const magExt = build.mag === 'ext' ? 1.5 : build.mag === 'drum' ? 0 : 1;
  const magZ = isPistol ? 0 : recZ + L * 0.12;
  const magMat = M('#26282b', { rough: 0.5, metal: 0.4 });
  const magGroup = new THREE.Group(); magGroup.position.set(0, -H * 0.2, magZ); root.add(magGroup);
  let mt = md.magT; if (build.mag === 'drum' && !['tube', 'cyl', 'none', 'pistol', 'pistolLong'].includes(mt)) mt = 'drum';
  if (mt === 'box') part(box, magMat, 0.035, 0.12 * magExt, 0.06, 0, -0.06 * magExt, 0, magGroup);
  else if (mt === 'boxBig') part(box, magMat, 0.07, 0.11, 0.11, 0.02, -0.05, 0, magGroup);
  else if (mt === 'curved' || mt === 'curvedBig') { const s = mt === 'curvedBig' ? 1.2 : 1; part(box, magMat, 0.035, 0.09 * s * magExt, 0.055, 0, -0.04 * s * magExt, 0, magGroup, -0.15); part(box, magMat, 0.035, 0.07 * s * magExt, 0.055, 0, -0.11 * s * magExt, -0.018, magGroup, -0.45); }
  else if (mt === 'drum') part(cyl, magMat, 0.085, 0.06, 0.085, 0, -0.08, 0, magGroup, 0, 0, Math.PI / 2);
  else if (mt === 'drumSmall') part(cyl, magMat, 0.06, 0.05, 0.06, 0, -0.06, 0, magGroup, 0, 0, Math.PI / 2);
  else if (mt === 'pistol') part(box, magMat, 0.032, 0.03, 0.04, 0, -0.13, 0.01, magGroup);
  else if (mt === 'pistolLong') part(box, magMat, 0.032, 0.14 * magExt, 0.04, 0, -0.16, 0.01, magGroup);
  else if (mt === 'cyl') { magGroup.position.set(0, 0.03, recZ + 0.03); part(cyl, magMat, 0.04, 0.06, 0.04, 0, 0, 0, magGroup, Math.PI / 2, 0, 0); }
  else if (mt === 'tube') { magGroup.position.set(0, -0.02, frontZ - 0.02); part(cyl, magMat, md.br * 0.9, md.barrel * 0.8, md.br * 0.9, 0, 0, -md.barrel * 0.35, magGroup, Math.PI / 2, 0, 0); }
  if (build.mag === 'fast' && ['box', 'curved', 'curvedBig'].includes(mt)) part(box, magMat, 0.035, 0.11, 0.055, 0.04, -0.06, 0, magGroup);
  out.mag = out.mag || magGroup;
  if (md.pump) { out.pump = part(box, accent, 0.06, 0.05, 0.14, 0, -0.03, frontZ - 0.08, root); }
  if (md.bolt) { out.bolt = new THREE.Group(); out.bolt.position.set(0.035, 0.04, recZ + L * 0.3); root.add(out.bolt); part(cylLo, dark, 0.008, 0.05, 0.008, 0.02, 0, 0, out.bolt, 0, 0, Math.PI / 2); part(new THREE.SphereGeometry(1, 8, 6), dark, 0.014, 0.014, 0.014, 0.045, 0, 0, out.bolt); }
  if (md.bipod) { part(box, dark, 0.008, 0.008, 0.18, 0.02, -0.02, frontZ - 0.05, root); part(box, dark, 0.008, 0.008, 0.18, -0.02, -0.02, frontZ - 0.05, root); }
  // rail
  const topY = 0.02 + H * (isPistol ? 0.6 : 0.28);
  if (md.rail) part(box, dark, 0.025, 0.012, L * 0.6, 0, topY + 0.006, recZ, root);
  // optic
  const optic = build.optic || w.defOptic || 'iron';
  const oz = recZ + L * 0.05; let sightY = topY + 0.025;
  const lensMat = M('#7fd8ff', { rough: 0.05, metal: 0.9 });
  if (optic === 'iron' || md.stock === 'tubeL') { part(box, dark, 0.006, 0.03, 0.006, 0, topY + 0.015, frontZ - 0.01, root); part(box, dark, 0.03, 0.02, 0.008, 0, topY + 0.01, recZ + L * 0.35, root); sightY = topY + 0.027; }
  else if (optic === 'reddot') { part(box, dark, 0.03, 0.035, 0.045, 0, topY + 0.02, oz, root); part(cyl, dark, 0.02, 0.05, 0.02, 0, topY + 0.04, oz, root, Math.PI / 2, 0, 0); sightY = topY + 0.04; out.dot = part(new THREE.SphereGeometry(1, 6, 4), M('#ff2020', { emissive: '#ff2020', toneMapped: false }), 0.0015, 0.0015, 0.0015, 0, sightY, oz - 0.02, root); }
  else if (optic === 'holo') { part(box, dark, 0.04, 0.012, 0.07, 0, topY + 0.01, oz, root); part(box, dark, 0.006, 0.045, 0.07, 0.022, topY + 0.035, oz, root); part(box, dark, 0.006, 0.045, 0.07, -0.022, topY + 0.035, oz, root); part(box, dark, 0.05, 0.006, 0.07, 0, topY + 0.06, oz, root); sightY = topY + 0.035; out.dot = part(new THREE.TorusGeometry(1, 0.15, 4, 16), M('#ff3b3b', { emissive: '#ff3b3b', toneMapped: false }), 0.006, 0.006, 0.006, 0, sightY, oz - 0.03, root); }
  else if (optic === 'acog' || optic === 'scope8') {
    const len = optic === 'acog' ? 0.13 : 0.26, rad = optic === 'acog' ? 0.022 : 0.024;
    part(box, dark, 0.02, 0.03, 0.04, 0, topY + 0.015, oz + len * 0.25, root); part(box, dark, 0.02, 0.03, 0.04, 0, topY + 0.015, oz - len * 0.25, root);
    part(cyl, dark, rad, len, rad, 0, topY + 0.05, oz, root, Math.PI / 2, 0, 0);
    part(cyl, dark, rad * 1.5, 0.05, rad * 1.5, 0, topY + 0.05, oz - len / 2, root, Math.PI / 2, 0, 0); part(cyl, dark, rad * 1.3, 0.04, rad * 1.3, 0, topY + 0.05, oz + len / 2, root, Math.PI / 2, 0, 0);
    part(cyl, lensMat, rad * 1.35, 0.005, rad * 1.35, 0, topY + 0.05, oz - len / 2 - 0.026, root, Math.PI / 2, 0, 0);
    if (optic === 'scope8') part(cylLo, dark, 0.012, 0.03, 0.012, 0, topY + 0.08, oz, root);
    sightY = topY + 0.05;
  }
  out.sightY = sightY; out.sightZ = oz;
  // underbarrel grip
  if (!isPistol && md.stock !== 'tubeL') {
    const gz = frontZ + L * 0.18;
    if (build.grip === 'vertical') part(box, accent, 0.03, 0.08, 0.03, 0, -0.06, gz, root);
    else if (build.grip === 'angled') part(box, accent, 0.03, 0.04, 0.07, 0, -0.035, gz, root, -0.5, 0, 0);
    else if (build.grip === 'laser') { part(box, dark, 0.025, 0.025, 0.06, 0.035, 0.02, gz, root); part(new THREE.SphereGeometry(1, 6, 4), M('#ff2020', { emissive: '#ff2020', toneMapped: false }), 0.006, 0.006, 0.006, 0.035, 0.02, gz - 0.032, root); }
  }
  out.eject.position.set(0.04, 0.04, recZ + 0.03); root.add(out.eject);
  root.add(out.muzzle); out.length = L + bLen;
  return out;
}
