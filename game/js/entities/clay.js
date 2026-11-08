// Clay-figure character builder + procedural animator. Characters face -Z in local space.
import * as THREE from 'three';
import { clayBump } from '../engine/textures.js';
import { buildGunModel } from './gunModel.js';

const geo = {
  sphere: new THREE.SphereGeometry(1, 20, 14), sphereLo: new THREE.SphereGeometry(1, 10, 8),
  capsule: new THREE.CapsuleGeometry(0.5, 1, 6, 14), capsuleLo: new THREE.CapsuleGeometry(0.5, 1, 3, 8),
  box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(1, 1, 1, 16), cone: new THREE.ConeGeometry(1, 1, 14),
  torus: new THREE.TorusGeometry(1, 0.3, 8, 18), halfSphere: new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
};
let quality = { bump: true, lowMat: false };
export function setClayQuality(q) { quality = q; matCache.clear(); }
const matCache = new Map();
export function clayMat(color, o = {}) {
  const key = color + (o.emissive || '') + (o.rough || '') + (o.metal || '') + (o.transparent ? 't' : '');
  let m = matCache.get(key);
  if (!m) {
    if (quality.lowMat && !o.emissive && !o.transparent) m = new THREE.MeshLambertMaterial({ color });
    else {
      m = new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? 0.62, metalness: o.metal ?? 0.0, emissive: o.emissive || '#000000', emissiveIntensity: o.emissive ? 1.4 : 0, transparent: !!o.transparent, opacity: o.opacity ?? 1 });
      if (quality.bump && !o.smooth) { m.bumpMap = clayBump(); m.bumpScale = 1.4; }
      if (o.emissive) m.toneMapped = false;
    }
    matCache.set(key, m);
  }
  return m;
}
function mesh(g, color, sx, sy, sz, x, y, z, parent, o = {}) {
  const m = new THREE.Mesh(g, typeof color === 'string' ? clayMat(color, o) : color);
  m.scale.set(sx, sy, sz); m.position.set(x, y, z); if (o.rx || o.ry || o.rz) m.rotation.set(o.rx || 0, o.ry || 0, o.rz || 0);
  m.castShadow = o.shadow !== false; m.receiveShadow = false; parent.add(m); return m;
}
const darken = (hex, f) => '#' + new THREE.Color(hex).multiplyScalar(f).getHexString();

export class ClayFigure {
  constructor(look, opts = {}) {
    this.look = look; this.root = new THREE.Group(); this.opts = opts;
    this.build(look);
    this.phase = Math.random() * 10; this.squash = 0; this.squashV = 0; this.deathT = -1; this.crouch = 0; this.aimPitch = 0;
    this.weaponId = null; this.recoil = 0; this.reloadT = 0; this.lodLevel = 0; this.emote = 0;
  }

  build(L) {
    const r = this.root; const b = L.build || 1;
    const hi = new THREE.Group(); this.hi = hi; r.add(hi);
    const lo = new THREE.Group(); this.lo = lo; lo.visible = false; r.add(lo);
    // ---- low LOD ----
    mesh(geo.capsuleLo, L.outfit, 0.6 * b, 0.95, 0.42 * b, 0, 0.95, 0, lo);
    mesh(geo.sphereLo, L.skin, 0.24, 0.24, 0.24, 0, 1.62, 0, lo);
    if (L.helmet !== 'none') mesh(geo.sphereLo, helmetColor(L), 0.27, 0.18, 0.27, 0, 1.72, 0, lo);
    // ---- high LOD ----
    const hips = new THREE.Group(); hips.position.y = 0.92; hi.add(hips); this.hips = hips;
    mesh(geo.capsule, L.outfit2, 0.42 * b, 0.22, 0.3, 0, 0.0, 0, hips); // pelvis
    mesh(geo.box, darken(L.outfit2, 0.7), 0.44 * b, 0.06, 0.32, 0, 0.08, 0, hips, { smooth: true }); // belt
    mesh(geo.box, L.accent, 0.06, 0.05, 0.02, 0, 0.08, -0.165, hips, { smooth: true, rough: 0.3, metal: 0.6 }); // buckle
    const torso = new THREE.Group(); torso.position.y = 0.06; hips.add(torso); this.torso = torso;
    mesh(geo.capsule, L.outfit, 0.5 * b, 0.42, 0.34, 0, 0.3, 0, torso);
    // vest / armor
    mesh(geo.capsule, L.vest, 0.54 * b, 0.32, 0.38, 0, 0.33, -0.005, torso);
    for (let i = -1; i <= 1; i++) mesh(geo.box, darken(L.vest, 0.8), 0.1, 0.11, 0.06, i * 0.12 * b, 0.2, -0.2, torso);
    if (L.patch) { const p = mesh(geo.box, L.accent, 0.12, 0.05, 0.015, 0.1 * b, 0.46, -0.195, torso, { smooth: true }); }
    mesh(geo.box, L.accent, 0.03, 0.18, 0.02, -0.15 * b, 0.42, -0.19, torso, { smooth: true }); // accent stripe
    // neck + head
    mesh(geo.cyl, L.skin, 0.09, 0.12, 0.09, 0, 0.58, 0, torso);
    const head = new THREE.Group(); head.position.y = 0.62; torso.add(head); this.head = head;
    this.buildHead(head, L);
    // arms
    this.arms = [];
    for (const s of [-1, 1]) {
      const sh = new THREE.Group(); sh.position.set(s * 0.29 * b, 0.47, 0); torso.add(sh);
      mesh(geo.sphere, L.outfit, 0.12 * b, 0.12, 0.12, 0, 0, 0, sh);
      const up = mesh(geo.capsule, L.outfit, 0.16 * b, 0.22, 0.16 * b, 0, -0.15, 0, sh);
      const el = new THREE.Group(); el.position.y = -0.3; sh.add(el);
      mesh(geo.capsule, L.outfit, 0.14 * b, 0.2, 0.14 * b, 0, -0.13, 0, el);
      mesh(geo.cyl, L.gloves, 0.075 * b, 0.06, 0.075 * b, 0, -0.24, 0, el);
      const hand = mesh(geo.sphere, L.gloves, 0.075, 0.085, 0.08, 0, -0.3, 0, el);
      if (L.acc === 'pads') mesh(geo.halfSphere, L.vest, 0.16 * b, 0.12, 0.16, 0, 0.02, 0, sh, { rz: s * 0.4 });
      this.arms.push({ sh, el, hand, s });
    }
    // legs
    this.legs = [];
    for (const s of [-1, 1]) {
      const th = new THREE.Group(); th.position.set(s * 0.12 * b, -0.04, 0); hips.add(th);
      mesh(geo.capsule, L.outfit2, 0.19 * b, 0.28, 0.2 * b, 0, -0.2, 0, th);
      if (s === 1) mesh(geo.box, darken(L.outfit2, 0.85), 0.06, 0.12, 0.1, 0.1 * b, -0.18, -0.02, th); // thigh pocket
      const kn = new THREE.Group(); kn.position.y = -0.42; th.add(kn);
      mesh(geo.sphere, darken(L.outfit2, 0.8), 0.1 * b, 0.09, 0.1, 0, 0.02, -0.04, kn);
      mesh(geo.capsule, L.outfit2, 0.17 * b, 0.26, 0.18 * b, 0, -0.18, 0, kn);
      const boot = mesh(geo.capsule, L.boots, 0.17 * b, 0.12, 0.3, 0, -0.42, -0.05, kn, { rx: Math.PI / 2 });
      mesh(geo.box, darken(L.boots, 0.6), 0.17 * b, 0.04, 0.3, 0, -0.5, -0.05, kn, { smooth: true });
      this.legs.push({ th, kn, s });
    }
    // accessories
    if (L.acc === 'backpack') { mesh(geo.capsule, darken(L.vest, 0.9), 0.4 * b, 0.22, 0.2, 0, 0.32, 0.25, torso); mesh(geo.box, darken(L.vest, 0.7), 0.3 * b, 0.1, 0.06, 0, 0.18, 0.36, torso); }
    if (L.acc === 'radio') { mesh(geo.box, '#3a3d42', 0.22, 0.28, 0.12, 0.05, 0.35, 0.24, torso); mesh(geo.cyl, '#222', 0.008, 0.7, 0.008, 0.13, 0.75, 0.25, torso); }
    if (L.acc === 'pouches') { for (const x of [-0.17, 0.17]) mesh(geo.box, darken(L.vest, 0.75), 0.1, 0.1, 0.08, x * b, 0.06, -0.16, hips); }
    if (L.acc === 'scarf') { mesh(geo.torus, L.accent, 0.14, 0.14, 0.2, 0, 0.56, 0, torso, { rx: Math.PI / 2 }); mesh(geo.capsule, L.accent, 0.08, 0.2, 0.05, 0.07, 0.42, 0.18, torso, { rz: 0.2 }); }
    if (L.acc === 'necklace') { mesh(geo.torus, '#f2efe6', 0.13, 0.13, 0.15, 0, 0.52, -0.02, torso, { rx: Math.PI / 2 + 0.3 }); for (let i = -2; i <= 2; i++) mesh(geo.cone, '#fff8e6', 0.015, 0.05, 0.015, i * 0.04, 0.47, -0.16 + Math.abs(i) * 0.01, torso, { rx: Math.PI }); }
    if (L.acc === 'cape') { const c = mesh(geo.box, L.accent, 0.5 * b, 0.6, 0.03, 0, 0.18, 0.22, torso, { rx: 0.15 }); this.cape = c; }
    // weapon mount
    this.gunMount = new THREE.Group(); this.gunMount.position.set(0.12, 0.38, -0.2); torso.add(this.gunMount);
    this.hi.traverse((o) => { if (o.isMesh) o.userData.fig = true; });
  }

  buildHead(h, L) {
    const sk = L.skin;
    mesh(geo.sphere, sk, 0.21, 0.22, 0.2, 0, 0.2, 0, h); // skull
    mesh(geo.sphere, sk, 0.16, 0.12, 0.13, 0, 0.12, -0.06, h); // jaw / cheeks
    mesh(geo.sphere, darken(sk, 0.92), 0.045, 0.05, 0.045, 0, 0.17, -0.205, h); // nose
    const ears = [-1, 1].map((s) => mesh(geo.sphere, darken(sk, 0.95), 0.04, 0.06, 0.03, s * 0.205, 0.2, 0, h));
    const visorFace = ['visorGlow', 'led', 'gasmask'].includes(L.mask) || L.helmet === 'visor' || L.helmet === 'bubble' && false;
    if (!visorFace && L.mask !== 'goggles' && L.mask !== 'shades') {
      for (const s of [-1, 1]) {
        mesh(geo.sphere, '#fbfbf7', 0.045, 0.052, 0.03, s * 0.075, 0.25, -0.175, h, { smooth: true, rough: 0.3 });
        mesh(geo.sphere, L.eye, 0.022, 0.026, 0.015, s * 0.075, 0.25, -0.2, h, { smooth: true, rough: 0.2 });
        mesh(geo.box, darken(L.hair === 'none' ? sk : '#3a2a1e', 0.6), 0.07, 0.016, 0.02, s * 0.075, 0.31, -0.19, h, { rz: s * -0.15 });
      }
    }
    if (L.mask === 'none' || L.mask === 'shades' || L.mask === 'goggles') mesh(geo.capsule, darken(sk, 0.7), 0.03, 0.06, 0.02, 0, 0.09, -0.185, h, { rz: Math.PI / 2 }); // mouth
    // hair
    const hairC = L.hairColor || '#3a2a1e';
    if (L.hair === 'short') mesh(geo.halfSphere, hairC, 0.215, 0.2, 0.205, 0, 0.24, 0.01, h);
    if (L.hair === 'mohawk') for (let i = 0; i < 6; i++) mesh(geo.cone, L.accent, 0.04, 0.16, 0.06, 0, 0.42 - Math.abs(i - 2.5) * 0.015, -0.12 + i * 0.05, h, { rx: -0.2 + i * 0.12 });
    if (L.hair === 'spiky') for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; mesh(geo.cone, L.accent, 0.04, 0.14, 0.04, Math.cos(a) * 0.1, 0.4, Math.sin(a) * 0.1, h, { rx: Math.sin(a) * 0.6, rz: -Math.cos(a) * 0.6 }); }
    if (L.hair === 'wild') for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; mesh(geo.sphere, '#f2f2f2', 0.08, 0.08, 0.08, Math.cos(a) * 0.17, 0.3 + Math.sin(i * 1.7) * 0.06, Math.sin(a) * 0.15 + 0.03, h); }
    if (L.hair === 'ponytail') { mesh(geo.halfSphere, '#5a3a22', 0.215, 0.2, 0.205, 0, 0.24, 0.01, h); mesh(geo.capsule, '#5a3a22', 0.08, 0.22, 0.08, 0, 0.12, 0.24, h, { rx: 0.4 }); }
    if (L.hair === 'beard') { mesh(geo.sphere, '#5a3a22', 0.17, 0.13, 0.12, 0, 0.06, -0.08, h); mesh(geo.halfSphere, '#5a3a22', 0.21, 0.18, 0.2, 0, 0.25, 0.01, h); }
    // masks
    const m = L.mask;
    if (m === 'balaclava') { mesh(geo.sphere, darken(L.outfit, 0.9), 0.215, 0.2, 0.205, 0, 0.13, 0, h); }
    if (m === 'shemagh') { mesh(geo.sphere, L.outfit, 0.22, 0.14, 0.21, 0, 0.1, 0, h); mesh(geo.torus, darken(L.outfit, 0.85), 0.16, 0.16, 0.25, 0, 0.0, 0, h, { rx: Math.PI / 2 }); }
    if (m === 'bandanaMask') { mesh(geo.sphere, L.accent, 0.215, 0.12, 0.21, 0, 0.1, -0.005, h); mesh(geo.cone, L.accent, 0.1, 0.14, 0.05, 0, 0.0, -0.17, h, { rx: Math.PI }); }
    if (m === 'gasmask') { mesh(geo.sphere, '#2b2b2b', 0.19, 0.17, 0.12, 0, 0.17, -0.11, h); for (const s of [-1, 1]) mesh(geo.cyl, '#6fd8ff', 0.05, 0.02, 0.05, s * 0.075, 0.24, -0.215, h, { rx: Math.PI / 2, smooth: true, rough: 0.1, metal: 0.6 }); mesh(geo.cyl, '#444', 0.06, 0.1, 0.06, 0, 0.07, -0.23, h, { rx: Math.PI / 2 }); mesh(geo.cyl, L.accent, 0.065, 0.02, 0.065, 0, 0.07, -0.28, h, { rx: Math.PI / 2 }); }
    if (m === 'visorGlow') { mesh(geo.sphere, '#151518', 0.212, 0.21, 0.205, 0, 0.18, 0, h); mesh(geo.box, L.accent, 0.26, 0.03, 0.05, 0, 0.24, -0.18, h, { emissive: L.accent }); }
    if (m === 'shades') { for (const s of [-1, 1]) mesh(geo.sphere, '#111', 0.06, 0.04, 0.02, s * 0.075, 0.25, -0.195, h, { smooth: true, rough: 0.1, metal: 0.8 }); mesh(geo.box, '#111', 0.2, 0.012, 0.02, 0, 0.27, -0.195, h); }
    if (m === 'goggles') { for (const s of [-1, 1]) mesh(geo.cyl, '#ffb02e', 0.055, 0.04, 0.055, s * 0.075, 0.25, -0.19, h, { rx: Math.PI / 2, smooth: true, rough: 0.1, metal: 0.5 }); mesh(geo.torus, '#333', 0.21, 0.21, 0.15, 0, 0.25, 0, h, { rx: Math.PI / 2 }); }
    if (m === 'led') { mesh(geo.sphere, '#111', 0.2, 0.13, 0.2, 0, 0.11, -0.01, h); for (let i = 0; i < 5; i++) mesh(geo.box, L.accent, 0.035, 0.02, 0.01, -0.08 + i * 0.04, 0.1 + (i % 2) * 0.03, -0.205, h, { emissive: L.accent }); }
    // helmets
    const hc = helmetColor(L); const hl = L.helmet;
    if (hl === 'tactical') {
      mesh(geo.halfSphere, hc, 0.235, 0.22, 0.24, 0, 0.27, 0, h); mesh(geo.box, darken(hc, 0.8), 0.48, 0.05, 0.06, 0, 0.29, 0, h);
      mesh(geo.box, '#222', 0.08, 0.05, 0.08, 0, 0.42, -0.18, h); for (const s of [-1, 1]) mesh(geo.cyl, '#1a1a1a', 0.028, 0.08, 0.028, s * 0.035, 0.42, -0.24, h, { rx: Math.PI / 2 });
      mesh(geo.box, L.accent, 0.04, 0.04, 0.06, 0.2, 0.33, 0.05, h);
    }
    if (hl === 'boonie') { mesh(geo.cyl, hc, 0.33, 0.02, 0.33, 0, 0.3, 0, h); mesh(geo.halfSphere, hc, 0.22, 0.16, 0.22, 0, 0.3, 0, h); }
    if (hl === 'beanie') { mesh(geo.halfSphere, hc, 0.225, 0.24, 0.215, 0, 0.25, 0.01, h); mesh(geo.torus, darken(hc, 0.85), 0.215, 0.215, 0.12, 0, 0.27, 0.01, h, { rx: Math.PI / 2 }); mesh(geo.sphere, L.accent, 0.05, 0.05, 0.05, 0, 0.5, 0, h); }
    if (hl === 'cap') { mesh(geo.halfSphere, hc, 0.22, 0.17, 0.215, 0, 0.27, 0.01, h); mesh(geo.box, hc, 0.2, 0.02, 0.14, 0, 0.29, 0.25, h); mesh(geo.box, '#f5f5f5', 0.3, 0.015, 0.012, 0, 0.17, -0.06, h, { ry: 0 }); for (const s of [-1, 1]) mesh(geo.cyl, '#222', 0.07, 0.04, 0.07, s * 0.22, 0.2, 0, h, { rz: Math.PI / 2 }); }
    if (hl === 'hood' || hl === 'parka') { mesh(geo.sphere, hc, 0.25, 0.26, 0.24, 0, 0.2, 0.03, h); mesh(geo.torus, hl === 'parka' ? '#f2efe6' : darken(hc, 0.75), 0.17, 0.2, hl === 'parka' ? 0.35 : 0.12, 0, 0.19, -0.16, h, { smooth: hl !== 'parka' }); }
    if (hl === 'bubble') { mesh(geo.sphere, '#bff3ff', 0.3, 0.3, 0.3, 0, 0.2, 0, h, { transparent: true, opacity: 0.35, smooth: true, rough: 0.05 }); mesh(geo.cyl, L.vest, 0.24, 0.05, 0.24, 0, -0.06, 0, h); mesh(geo.cyl, '#333', 0.01, 0.25, 0.01, 0.12, 0.55, 0, h); mesh(geo.sphere, L.accent, 0.04, 0.04, 0.04, 0.12, 0.68, 0, h, { emissive: L.accent }); }
    if (hl === 'visor') { mesh(geo.sphere, hc, 0.24, 0.25, 0.24, 0, 0.2, 0.01, h, { rough: 0.3, metal: 0.4 }); mesh(geo.sphere, L.accent, 0.2, 0.08, 0.1, 0, 0.23, -0.17, h, { emissive: L.accent }); mesh(geo.box, darken(hc, 0.7), 0.04, 0.2, 0.04, 0.235, 0.22, 0, h); }
    if (hl === 'beret') { mesh(geo.cyl, hc, 0.24, 0.07, 0.23, -0.03, 0.38, 0, h, { rz: 0.25 }); mesh(geo.box, L.accent, 0.05, 0.05, 0.01, 0.1, 0.38, -0.2, h, { emissive: L.accent }); }
    if (hl === 'bandana') { mesh(geo.halfSphere, hc, 0.218, 0.17, 0.212, 0, 0.27, 0, h); mesh(geo.capsule, hc, 0.05, 0.12, 0.04, 0.05, 0.25, 0.22, h, { rz: 0.5 }); }
    if (hl === 'crown') { mesh(geo.cyl, hc, 0.19, 0.08, 0.19, 0, 0.42, 0, h, { rough: 0.25, metal: 0.8 }); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; mesh(geo.cone, hc, 0.035, 0.1, 0.035, Math.cos(a) * 0.17, 0.5, Math.sin(a) * 0.17, h, { rough: 0.25, metal: 0.8 }); } mesh(geo.sphere, '#e8463c', 0.03, 0.03, 0.02, 0, 0.42, -0.19, h, { emissive: '#e8463c' }); }
  }

  setWeapon(id, build) {
    if (this.weaponId === id && this.weaponBuild === build) return;
    this.weaponId = id; this.weaponBuild = build;
    while (this.gunMount.children.length) this.gunMount.remove(this.gunMount.children[0]);
    if (!id) return;
    const g = buildGunModel(id, build || {}); this.gun = g; this.gunMount.add(g.group);
  }

  hit() { this.squashV += 7; }

  // state: {speed, crouch, pitch, air, slide, sprint, firing, reloading, dead, aiming}
  animate(dt, s, camDist = 0) {
    // LOD switch
    const lod = camDist > 55 ? 1 : 0;
    if (lod !== this.lodLevel) { this.lodLevel = lod; this.hi.visible = lod === 0; this.lo.visible = lod === 1; }
    // clay squash spring
    this.squashV += (-this.squash * 90 - this.squashV * 9) * dt; this.squash += this.squashV * dt;
    const sq = Math.max(-0.25, Math.min(0.25, this.squash * 0.04));
    if (s.dead) {
      if (this.deathT < 0) this.deathT = 0; this.deathT += dt;
      const t = Math.min(1, this.deathT / 0.55); const e = 1 - Math.pow(1 - t, 3);
      this.root.rotation.x = -e * Math.PI / 2 * 0.96; this.root.position.y += 0;
      const melt = Math.max(0, this.deathT - 2.2) * 0.5;
      this.root.scale.set(1 + melt * 0.6, Math.max(0.05, 1 - melt), 1 + melt * 0.6);
      return;
    }
    this.deathT = -1; this.root.rotation.x = 0;
    this.root.scale.set(1 - sq * 0.5, 1 + sq, 1 - sq * 0.5);
    if (lod === 1) { this.lo.position.y = -s.crouch * 0.4; return; }
    const sp = Math.min(s.speed, 9); const moving = sp > 0.4;
    this.phase += dt * (2 + sp * 1.25) * (moving ? 1 : 0);
    const amp = moving ? Math.min(1, sp / 5) * (s.sprint ? 1.2 : 0.8) : 0;
    const c = this.crouch += ((s.crouch || 0) - this.crouch) * Math.min(1, dt * 12);
    const ph = this.phase;
    // hips height + bob
    this.hips.position.y = 0.92 - c * 0.38 - (s.slide ? 0.3 : 0) + Math.abs(Math.sin(ph)) * 0.05 * amp;
    this.hips.rotation.y = Math.sin(ph) * 0.12 * amp;
    this.torso.rotation.x = -c * 0.25 - (s.sprint ? 0.22 : 0) + (s.slide ? 0.4 : 0);
    this.torso.rotation.y = -this.hips.rotation.y * 0.8;
    // legs (positive x-rotation swings a limb forward, toward -Z)
    for (const L of this.legs) {
      const p = ph + (L.s > 0 ? Math.PI : 0);
      let thigh = Math.sin(p) * 0.75 * amp, knee = -Math.max(0, Math.cos(p)) * 1.1 * amp;
      if (s.air) { thigh = 0.5 + L.s * 0.2; knee = -0.9; }
      if (s.slide) { thigh = 1.4; knee = -0.3; }
      thigh += c * 1.0; knee -= c * 1.7;
      L.th.rotation.x = thigh; L.kn.rotation.x = knee;
    }
    // arms: hold weapon, aim pitch, recoil, reload dip
    this.recoil = Math.max(0, this.recoil - dt * 8);
    const pitch = s.pitch || 0; const rl = s.reloading ? Math.sin(Math.min(1, this.reloadT += dt / Math.max(0.5, s.reloadTime || 2)) * Math.PI) : (this.reloadT = 0);
    const melee = this.weaponId === 'knife';
    const R = this.arms[1], Lf = this.arms[0];
    if (s.sprint && !s.firing) { R.sh.rotation.set(0.5, 0, -0.1); R.el.rotation.set(1.2, 0, 0); Lf.sh.rotation.set(0.8, 0, 0.5); Lf.el.rotation.set(1.0, 0, 0); this.gunMount.rotation.set(-0.6, 0.8, 0.3); this.gunMount.position.set(0.1, 0.25, -0.22); }
    else if (melee) { R.sh.rotation.set(1.0 + pitch + this.recoil * 1.5, 0, -0.1); R.el.rotation.set(0.6, 0, 0); Lf.sh.rotation.set(0.3, 0, 0.2); Lf.el.rotation.set(0.8, 0, 0); this.gunMount.rotation.set(pitch - this.recoil, 0, 0); this.gunMount.position.set(0.2, 0.3 - this.recoil * 0.1, -0.35); }
    else {
      const p = pitch + this.recoil * 0.25;
      R.sh.rotation.set(1.25 + p * 0.9 - rl * 0.6, 0.0, -0.25); R.el.rotation.set(0.55, 0, 0.0);
      Lf.sh.rotation.set(1.35 + p * 0.9 - rl * 0.9, 0.0, 0.75); Lf.el.rotation.set(0.35 + rl * 0.8, 0, 0);
      this.gunMount.rotation.set(p - rl * 0.7, 0, 0); this.gunMount.position.set(0.11, 0.37 - rl * 0.06, -0.3 + this.recoil * 0.05);
    }
    this.head.rotation.x = pitch * 0.6;
    if (this.cape) this.cape.rotation.x = -0.15 - amp * 0.5 + Math.sin(ph * 2) * 0.05 * amp;
    // emote (victory dance)
    if (s.emote) { const t = performance.now() / 1000; this.hips.rotation.y = Math.sin(t * 6) * 0.4; R.sh.rotation.set(2.8 + Math.sin(t * 8) * 0.3, 0, -0.3); Lf.sh.rotation.set(2.8 - Math.sin(t * 8) * 0.3, 0, 0.3); this.hips.position.y = 0.92 + Math.abs(Math.sin(t * 6)) * 0.12; }
  }

  dispose() { this.root.parent && this.root.parent.remove(this.root); }
}

function helmetColor(L) {
  return { tactical: L.vest, boonie: L.outfit, beanie: L.accent, cap: L.accent, hood: L.outfit, parka: L.outfit2, bubble: L.vest, visor: L.outfit, beret: L.accent, bandana: L.accent, crown: '#d4a62a' }[L.helmet] || L.outfit;
}

// Simple clay civilian for ambient crowds (cheap).
export function makePedestrian(r) {
  const g = new THREE.Group();
  const shirt = ['#e8463c', '#2f6fd6', '#f2b134', '#5bbf6a', '#e86fa8', '#f5f5f5', '#6b4fa0'][Math.floor(r() * 7)];
  const pants = ['#2b3442', '#4a4a4a', '#6b5b3e', '#1d1d22'][Math.floor(r() * 4)];
  const skin = ['#f0c9a8', '#d9a07a', '#a8714f', '#7b4b33'][Math.floor(r() * 4)];
  const body = mesh(geo.capsuleLo, shirt, 0.42, 0.5, 0.3, 0, 1.2, 0, g);
  const head = mesh(geo.sphereLo, skin, 0.17, 0.18, 0.17, 0, 1.68, 0, g);
  const legs = [-1, 1].map((s) => { const p = new THREE.Group(); p.position.set(s * 0.1, 0.85, 0); g.add(p); mesh(geo.capsuleLo, pants, 0.15, 0.6, 0.15, 0, -0.42, 0, p); return p; });
  if (r() < 0.4) mesh(geo.halfSphere, ['#222', '#f2b134', '#e8463c'][Math.floor(r() * 3)], 0.19, 0.12, 0.19, 0, 1.76, 0, g);
  g.userData.legs = legs; return g;
}

export { geo as clayGeo };
