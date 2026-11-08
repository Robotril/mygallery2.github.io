// Loot items, supply crates & airdrops. Visuals are streamed in only near the camera.
import * as THREE from 'three';
import { WEAPONS, WEAPON_MAP, RARITY, AMMO, PRIMARY_CLASSES, ATTACHMENTS, allowedAttachments } from '../data/weapons.js';
import { buildGunModel } from '../entities/gunModel.js';

export const HEALS = { bandage: { name: 'Bandage', time: 2.2, hp: 15, cap: 75, max: 10 }, medkit: { name: 'Medkit', time: 5, hp: 100, cap: 100, max: 3 }, cell: { name: 'Shield Cell', time: 3, armor: 25, max: 6 } };
export const ARMOR_TIERS = [0, 50, 75, 100];

let LID = 1;
const crossTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#f2f2f2'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#e63946'; x.fillRect(24, 10, 16, 44); x.fillRect(10, 24, 44, 16); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();

export class LootSystem {
  constructor(match) {
    this.match = match; this.items = new Map(); this.crates = []; this.group = new THREE.Group(); match.scene.add(this.group);
    this.boxGeo = new THREE.BoxGeometry(1, 1, 1); this.beamGeo = new THREE.CylinderGeometry(0.06, 0.06, 6, 6, 1, true);
    this.beamMats = RARITY.map((r) => new THREE.MeshBasicMaterial({ color: r.color, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    this.ringMats = RARITY.map((r) => new THREE.MeshBasicMaterial({ color: r.color, transparent: true, opacity: 0.6, toneMapped: false, side: THREE.DoubleSide }));
    this.ringGeo = new THREE.RingGeometry(0.35, 0.45, 20); this.ringGeo.rotateX(-Math.PI / 2);
    this.t = 0;
  }

  add(item) { item.id = item.id ?? LID++; LID = Math.max(LID, item.id + 1); this.items.set(item.id, item); return item; }
  remove(id) { const it = this.items.get(id); if (!it) return null; if (it.mesh) this.group.remove(it.mesh); this.items.delete(id); return it; }

  randomWeaponItem(r, x, y, z, tierBias = 0, allowed = null) {
    const pool = WEAPONS.filter((w) => w.cls !== 'melee' && (!allowed || allowed.includes(w.cls)));
    const w = pool[Math.floor(r() * pool.length)];
    let rar = 0; const roll = r() + tierBias * 0.22; rar = roll > 1.05 ? 4 : roll > 0.9 ? 3 : roll > 0.7 ? 2 : roll > 0.42 ? 1 : 0;
    if (w.cls === 'special' && rar < 2) rar = 2;
    // rarer weapons come with attachments
    const build = {};
    if (rar >= 2) for (const slot of ['optic', 'barrel', 'grip', 'mag']) { const opts = allowedAttachments(w, slot); if (opts.length > 1 && r() < 0.35 + rar * 0.12) build[slot] = opts[1 + Math.floor(r() * (opts.length - 1))].id; }
    return { type: 'weapon', weaponId: w.id, rarity: rar, build, x, y, z, ammoIn: null };
  }

  // Populate battle-royale style loot across spots.
  populate(spots, r, opts = {}) {
    for (const s of spots) {
      if (r() < 0.12) continue;
      const x = s.x + (r() - 0.5) * 1.2, z = s.z + (r() - 0.5) * 1.2; const y = s.y;
      const roll = r();
      if (roll < 0.42) { const it = this.randomWeaponItem(r, x, y, z, s.tier, opts.allowed); this.add(it); const am = WEAPON_MAP[it.weaponId].ammo; if (am) this.add({ type: 'ammo', ammoType: am, amount: AMMO[am].pickup, x: x + 0.7, y, z: z + 0.3 }); }
      else if (roll < 0.62) { const keys = Object.keys(AMMO); const am = keys[Math.floor(r() * (keys.length - (r() < 0.8 ? 1 : 0)))]; this.add({ type: 'ammo', ammoType: am, amount: AMMO[am].pickup, x, y, z }); }
      else if (roll < 0.76) this.add({ type: 'heal', heal: r() < 0.55 ? 'bandage' : r() < 0.6 ? 'cell' : 'medkit', amount: 1, x, y, z });
      else if (roll < 0.88) this.add({ type: 'armor', tier: 1 + (r() < 0.25 + s.tier * 0.2 ? 1 : 0) + (r() < 0.08 + s.tier * 0.1 ? 1 : 0), x, y, z });
      else this.add({ type: r() < 0.6 ? 'lethal' : 'tactical', eq: r() < 0.5 ? (r() < 0.5 ? 'frag' : 'sticky') : (r() < 0.5 ? 'smoke' : 'stun'), x, y, z });
    }
  }

  addCrate(x, y, z, kind = 'chest') {
    const g = new THREE.Group(); g.position.set(x, y, z);
    const gold = kind === 'airdrop';
    const body = new THREE.Mesh(this.boxGeo, new THREE.MeshStandardMaterial({ color: gold ? '#2f6fd6' : '#7a5232', roughness: 0.6 })); body.scale.set(1.3, 0.7, 0.8); body.position.y = 0.35; body.castShadow = true; g.add(body);
    const lid = new THREE.Mesh(this.boxGeo, new THREE.MeshStandardMaterial({ color: gold ? '#ffd23f' : '#c99a3a', roughness: 0.4, metalness: 0.5 })); lid.scale.set(1.36, 0.18, 0.86); lid.position.y = 0.78; g.add(lid);
    const glow = new THREE.Mesh(this.beamGeo, this.beamMats[gold ? 4 : 3]); glow.position.y = 3; glow.scale.set(gold ? 3 : 1.5, 1, gold ? 3 : 1.5); g.add(glow);
    this.group.add(g);
    const crate = { x, y, z, opened: false, mesh: g, lid, glow, kind, id: this.crates.length, falling: 0 };
    this.crates.push(crate); this.match.world.addBox(x - 0.65, y, z - 0.4, x + 0.65, y + 0.85, z + 0.4, 1 | 2);
    return crate;
  }
  openCrate(crate, r) {
    if (crate.opened) return []; crate.opened = true; crate.glow.visible = false; crate.lid.rotation.x = -1.2; crate.lid.position.z = -0.35; crate.lid.position.y = 0.95;
    const out = []; const n = crate.kind === 'airdrop' ? 4 : 3; const bias = crate.kind === 'airdrop' ? 3 : 1.6;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2; const x = crate.x + Math.cos(a) * 1.3, z = crate.z + Math.sin(a) * 1.3; const y = crate.y;
      let it;
      if (i === 0) it = this.randomWeaponItem(r, x, y, z, bias, crate.kind === 'airdrop' ? ['sniper', 'lmg', 'special', 'ar'] : null);
      else if (i === 1) it = { type: 'armor', tier: crate.kind === 'airdrop' ? 3 : 2 + (r() < 0.3 ? 1 : 0), x, y, z };
      else if (i === 2) it = { type: 'heal', heal: 'medkit', amount: 1, x, y, z };
      else it = { type: 'ammo', ammoType: 'rocket', amount: 3, x, y, z };
      out.push(this.add(it));
      if (i === 0) { const am = WEAPON_MAP[it.weaponId].ammo; if (am) out.push(this.add({ type: 'ammo', ammoType: am, amount: AMMO[am].pickup * 2, x: x + 0.5, y, z })); }
    }
    return out;
  }

  makeMesh(it) {
    const g = new THREE.Group(); g.position.set(it.x, it.y + 0.45, it.z);
    if (it.type === 'weapon') {
      const m = buildGunModel(it.weaponId, it.build || {}); m.group.scale.setScalar(1.25); m.group.rotation.y = Math.PI / 2; g.add(m.group);
      const ring = new THREE.Mesh(this.ringGeo, this.ringMats[it.rarity]); ring.position.y = -0.42; g.add(ring);
      if (it.rarity >= 2) { const b = new THREE.Mesh(this.beamGeo, this.beamMats[it.rarity]); b.position.y = 2.6; g.add(b); }
    } else if (it.type === 'ammo') {
      const m = new THREE.Mesh(this.boxGeo, new THREE.MeshStandardMaterial({ color: AMMO[it.ammoType].color, roughness: 0.5 })); m.scale.set(0.34, 0.22, 0.24); g.add(m);
      const lid = new THREE.Mesh(this.boxGeo, new THREE.MeshStandardMaterial({ color: '#333', roughness: 0.5 })); lid.scale.set(0.36, 0.05, 0.26); lid.position.y = 0.12; g.add(lid);
    } else if (it.type === 'heal') {
      const m = new THREE.Mesh(this.boxGeo, new THREE.MeshStandardMaterial({ map: crossTex, roughness: 0.6, color: it.heal === 'cell' ? '#5aa8ff' : '#ffffff' })); m.scale.set(it.heal === 'medkit' ? 0.42 : 0.26, 0.26, 0.18); g.add(m);
    } else if (it.type === 'armor') {
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.18, 4, 8), new THREE.MeshStandardMaterial({ color: RARITY[it.tier].color, roughness: 0.5, metalness: 0.3 })); m.scale.set(1.2, 1, 0.6); g.add(m);
      const ring = new THREE.Mesh(this.ringGeo, this.ringMats[it.tier]); ring.position.y = -0.42; g.add(ring);
    } else {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), new THREE.MeshStandardMaterial({ color: it.eq === 'sticky' ? '#ff5d8f' : it.eq === 'smoke' ? '#bbbbbb' : it.eq === 'stun' ? '#ffd166' : '#556b2f', roughness: 0.6 })); g.add(m);
    }
    g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    return g;
  }

  update(dt, cam) {
    this.t += dt; const R2 = 42 * 42;
    for (const it of this.items.values()) {
      const dx = it.x - cam.x, dz = it.z - cam.z; const near = dx * dx + dz * dz < R2 && Math.abs(it.y - cam.y) < 25;
      if (near && !it.mesh) { it.mesh = this.makeMesh(it); this.group.add(it.mesh); }
      else if (!near && it.mesh) { this.group.remove(it.mesh); it.mesh = null; }
      if (it.mesh) { it.mesh.rotation.y += dt * 1.2; it.mesh.position.y = it.y + 0.45 + Math.sin(this.t * 2 + it.id) * 0.06; }
    }
    for (const c of this.crates) {
      if (c.falling > 0) { const g = this.match.world.groundAt(c.x, c.z, 0.5, 400); c.y = Math.max(g, c.y - dt * 7); c.mesh.position.y = c.y; if (c.y <= g + 0.01) { c.falling = 0; c.y = g; this.match.world.addBox(c.x - 0.65, c.y, c.z - 0.4, c.x + 0.65, c.y + 0.85, c.z + 0.4, 3); if (c.chute) c.mesh.remove(c.chute); this.match.onAirdropLanded?.(c); } }
      if (!c.opened && c.glow) c.glow.material.opacity = 0.25 + Math.sin(this.t * 3) * 0.1;
    }
  }

  nearest(x, y, z, maxD = 2.6, dirX = 0, dirZ = 0) {
    let best = null, bs = Infinity;
    for (const it of this.items.values()) {
      const dx = it.x - x, dy = it.y + 0.4 - y, dz = it.z - z; const d = Math.hypot(dx, dz); if (d > maxD || Math.abs(dy) > 1.8) continue;
      const facing = d > 0.01 ? (dx * dirX + dz * dirZ) / d : 1; const score = d - facing * 0.9;
      if (score < bs) { bs = score; best = it; }
    }
    return best;
  }
  nearestCrate(x, y, z, maxD = 2.4) { return this.crates.find((c) => !c.opened && !c.falling && Math.hypot(c.x - x, c.z - z) < maxD && Math.abs(c.y - (y - 1)) < 2.2) || null; }
  clear() { for (const it of this.items.values()) if (it.mesh) this.group.remove(it.mesh); this.items.clear(); for (const c of this.crates) this.group.remove(c.mesh); this.crates = []; }
  serialize() { return [...this.items.values()].map(({ mesh, ...rest }) => rest); }
}

export function itemLabel(it) {
  if (it.type === 'weapon') return `${RARITY[it.rarity].name} ${WEAPON_MAP[it.weaponId].name}`;
  if (it.type === 'ammo') return `${AMMO[it.ammoType].name} ×${it.amount}`;
  if (it.type === 'heal') return HEALS[it.heal].name;
  if (it.type === 'armor') return `Armor Vest Lv.${it.tier}`;
  return { frag: 'Frag Grenade', sticky: 'Sticky Clay Bomb', smoke: 'Smoke Canister', stun: 'Stun Charge' }[it.eq];
}
export function itemColor(it) { return it.type === 'weapon' ? RARITY[it.rarity].color : it.type === 'armor' ? RARITY[it.tier].color : '#ffffff'; }
