// Match: owns the world, combatants, combat resolution, projectiles and the active game mode.
// role: 'solo' (all local), 'host' (authoritative + network), 'client' (mirrors host state).
import * as THREE from 'three';
import { buildBeach } from '../world/beach.js';
import { buildCity } from '../world/city.js';
import { NavGrid } from '../world/nav.js';
import { F_BULLET, F_WATER, F_ALL, F_SOLID } from '../world/collision.js';
import { Effects } from './effects.js';
import { LootSystem, HEALS, ARMOR_TIERS } from './loot.js';
import { Combatant } from '../entities/combatant.js';
import { ClayFigure } from '../entities/clay.js';
import { resolveLook, CHARACTERS, CHAR_MAP } from '../data/characters.js';
import { WEAPON_MAP, damageAt, LETHALS, AMMO } from '../data/weapons.js';
import { audio } from '../engine/audio.js';
import { Emitter, mulberry32, botName, clamp } from '../core/util.js';
import { Ambient } from '../world/ambient.js';

const V1 = new THREE.Vector3(), V2 = new THREE.Vector3();
export const SKILLS = {
  easy: { wobble: 0.05, name: 'Easy', reaction: 0.95, turn: 2.6, err: 1.4, spread: 2.6, view: 65, fov: 0.55, burst: 0.35, dmgMul: 0.6 },
  normal: { wobble: 0.03, name: 'Normal', reaction: 0.6, turn: 4.2, err: 0.95, spread: 1.8, view: 95, fov: 0.45, burst: 0.55, dmgMul: 0.8 },
  hard: { wobble: 0.017, name: 'Hard', reaction: 0.38, turn: 6.5, err: 0.6, spread: 1.3, view: 125, fov: 0.35, burst: 0.75, dmgMul: 0.95 },
  expert: { wobble: 0.009, name: 'Expert', reaction: 0.22, turn: 9, err: 0.38, spread: 1.0, view: 165, fov: 0.25, burst: 0.9, dmgMul: 1.05 },
};

export class Match {
  constructor(o) {
    this.o = o; this.gfx = o.gfx; this.settings = o.settings; this.role = o.role || 'solo'; this.net = o.net || null;
    this.seed = o.seed ?? Math.floor(Math.random() * 1e9); this.rng = mulberry32(this.seed);
    this.events = new Emitter(); this.combatants = []; this.byId = new Map(); this.projectiles = []; this.noises = []; this.time = 0; this.ended = false;
    this.scene = new THREE.Scene(); this.localId = null; this.paused = false; this.shake = 0; this.netEvents = []; this._fxEnds = []; this.pathBudget = 4;
  }
  get authority() { return this.role !== 'client'; }
  get local() { return this.byId.get(this.localId); }

  async load(progress = () => {}) {
    const q = this.gfx.q; const tick = () => new Promise((r) => setTimeout(r, 0));
    progress(0.05, 'Sculpting terrain…'); await tick();
    const mapSeed = this.settings.mapSeed ?? 7;
    this.map = (this.settings.map === 'city' ? buildCity : buildBeach)(this.scene, { ...q, sunDir: new THREE.Vector3(0.4, 0.7, 0.3) }, mapSeed);
    this.world = this.map.world;
    progress(0.4, 'Lighting the scene…'); await tick();
    this.gfx.setupScene(this.scene, this.map.env);
    for (const wm of this.map.waterMats || []) wm.uniforms.uSunDir.value.copy(this.gfx.sunDir);
    progress(0.55, 'Teaching bots to walk…'); await tick();
    this.nav = new NavGrid(this.world, this.map.navBase);
    progress(0.75, 'Placing loot…'); await tick();
    this.effects = new Effects(this.scene, q); this.loot = new LootSystem(this);
    this.ambient = new Ambient(this, q);
    for (const s of this.map.statues || []) {
      const look = { ...resolveLook(s.char) }; for (const k of ['skin', 'outfit', 'outfit2', 'vest', 'accent', 'boots', 'gloves']) look[k] = '#b48a52'; look.eye = '#6b4a22';
      const f = new ClayFigure(look); f.root.position.set(s.x, s.y, s.z); f.root.scale.setScalar(s.scale); f.root.rotation.y = s.rot; f.setWeapon('sentinel', {});
      f.animate(0.016, { speed: 0, crouch: 0, pitch: 0.1 }); this.scene.add(f.root);
    }
    progress(0.85, 'Deploying combatants…'); await tick();
    const ModeClass = this.o.ModeClass; this.mode = new ModeClass(this, this.settings);
    if (this.role !== 'client') this.mode.setup();
    progress(1, 'Ready'); await tick();
  }

  // ---------- combatants ----------
  addCombatant(o) {
    const c = new Combatant(o); this.combatants.push(c); this.byId.set(c.id, c);
    c.figure = new ClayFigure(o.look); this.scene.add(c.figure.root);
    if (o.kind === 'local') { this.localId = c.id; c.figure.root.visible = false; }
    return c;
  }
  removeCombatant(c) { const i = this.combatants.indexOf(c); if (i >= 0) this.combatants.splice(i, 1); this.byId.delete(c.id); c.figure?.dispose(); }
  makeBotLook(r) {
    const ch = CHARACTERS[Math.floor(r() * CHARACTERS.length)]; const pal = ['#2b3442', '#3f4a3c', '#6b5b3e', '#c2a26b', '#7a2e2e', '#3a6ea5', '#6b4fa0', '#2f8f83', '#4a4a4a', '#e86fa8'];
    const custom = r() < 0.5 ? { outfit: pal[Math.floor(r() * pal.length)], accent: ['#e07b2a', '#ffd23f', '#28e7ff', '#ff2bd6', '#5bbf6a'][Math.floor(r() * 5)] } : {};
    return { charId: ch.id, custom, look: resolveLook(ch.id, custom) };
  }
  enemiesOf(c) { return this.combatants.filter((o) => o !== c && o.alive && (c.team < 0 || o.team !== c.team)); }
  isEnemy(a, b) { return a !== b && (a.team < 0 || a.team !== b.team); }

  spawnPoint(c, area) {
    const A = area || this.mode.spawnArea || this.map.arena; let best = null, bestScore = -1;
    for (let i = 0; i < 24; i++) {
      const p = this.nav.randomWalkable(this.rng, (A.minX + A.maxX) / 2, (A.minZ + A.maxZ) / 2, Math.max(A.maxX - A.minX, A.maxZ - A.minZ) / 2);
      if (!p || p.x < A.minX || p.x > A.maxX || p.z < A.minZ || p.z > A.maxZ) continue;
      if (this.world.water > -100 && p.y < this.world.water + 0.2) continue;
      let md = 999; for (const e of this.combatants) if (e !== c && e.alive && this.isEnemy(c, e)) md = Math.min(md, Math.hypot(e.pos.x - p.x, e.pos.z - p.z));
      if (md > bestScore) { bestScore = md; best = p; }
    }
    return best || { x: (A.minX + A.maxX) / 2, y: 2, z: (A.minZ + A.maxZ) / 2 };
  }
  respawn(c, p) {
    p = p || this.spawnPoint(c); c.resetForSpawn(); c.pos.set(p.x, this.world.groundAt(p.x, p.z, 0.3, (p.y ?? 0) + 1.5), p.z);
    c.yaw = Math.atan2(p.x - (this.map.arena.minX + this.map.arena.maxX) / 2, p.z - (this.map.arena.minZ + this.map.arena.maxZ) / 2);
    c.pitch = 0; c.figure.deathT = -1; c.figure.root.rotation.x = 0; c.figure.root.scale.set(1, 1, 1);
    this.mode.equip?.(c); if (c.brain) c.brain.reset();
    if (c.kind === 'remote') this.netSend(c.peerId, { t: 'spawn', x: c.pos.x, y: c.pos.y, z: c.pos.z, yaw: c.yaw });
  }

  // ---------- combat ----------
  // Fire the current weapon of c. dir must be normalized. Returns array of hit results.
  fireWeapon(c, ws, origin, dir, spread, muzzle, opts = {}) {
    const s = ws.stats; const hits = []; const now = this.time;
    c.stats.shots++; c.firingVisual = 0.12;
    if (s.explosive) {
      this.spawnProjectile(c, s.id === 'rocket' ? 'rocket' : 'launcher', muzzle || origin, V1.copy(dir).multiplyScalar(s.explosive.speed), s.explosive);
    } else {
      for (let p = 0; p < s.pellets; p++) {
        const d = V1.copy(dir); if (spread > 0) jitter(d, spread, this.rng);
        const res = this.traceShot(c, origin, d, s, muzzle || origin);
        if (res) hits.push(res);
      }
    }
    audio.gunshot(s.snd, muzzle || origin, { local: c.kind === 'local' && !opts.spectated, suppressed: s.suppressed });
    if (!s.suppressed) this.noise(origin.x, origin.z, 90 * s.loud, c, true);
    else this.noise(origin.x, origin.z, 25, c, false);
    if (c.kind !== 'local' && muzzle) this.effects.muzzle(muzzle.x, muzzle.y, muzzle.z, dir.x, dir.y, dir.z);
    if (c.figure) c.figure.recoil = 1;
    if (this.role === 'host') { const mz = muzzle || origin; this.netBroadcast({ t: 'fx', s: c.id, w: s.id, o: [Math.round(mz.x * 100) / 100, Math.round(mz.y * 100) / 100, Math.round(mz.z * 100) / 100], e: this._fxEnds.splice(0) }); }
    return hits;
  }

  traceShot(c, o, d, s, muzzle) {
    const maxT = 400; let wh = this.world.raycast(o.x, o.y, o.z, d.x, d.y, d.z, maxT, F_BULLET | F_WATER);
    let tWorld = wh ? wh.t : maxT; const whCopy = wh ? { ...wh } : null;
    // glass: shatter and continue
    if (whCopy && whCopy.box && whCopy.box.data && whCopy.box.data.type === 'glass') {
      this.breakGlass(whCopy.box); const ox = o.x + d.x * (tWorld + 0.05), oy = o.y + d.y * (tWorld + 0.05), oz = o.z + d.z * (tWorld + 0.05);
      const w2 = this.world.raycast(ox, oy, oz, d.x, d.y, d.z, maxT - tWorld, F_BULLET | F_WATER); tWorld = w2 ? tWorld + 0.05 + w2.t : maxT; if (w2) Object.assign(whCopy, w2, { t: tWorld }); else whCopy.box = null;
    }
    let best = null, bt = tWorld;
    for (const e of this.combatants) { if (e === c || !e.alive) continue; const h = e.hitTest(o.x, o.y, o.z, d.x, d.y, d.z, bt); if (h && h.t < bt) { bt = h.t; best = { e, head: h.head }; } }
    const ex = o.x + d.x * bt, ey = o.y + d.y * bt, ez = o.z + d.z * bt;
    if (this.role === 'host' && this._fxEnds.length < 12) this._fxEnds.push([Math.round(ex * 100) / 100, Math.round(ey * 100) / 100, Math.round(ez * 100) / 100, best ? 1 : 0]);
    if (this.gfx.q.particles > 0 && (c.kind === 'local' || this.rng() < 0.6)) this.effects.tracer(muzzle.x, muzzle.y, muzzle.z, ex, ey, ez);
    if (best) {
      const e = best.e; let dmg = damageAt(s, bt) * (best.head ? s.head : 1);
      if (c.isBot && c.brain) dmg *= c.brain.skill.dmgMul;
      this.effects.claySplat(ex, ey, ez, d.x, d.y, d.z, e.look.outfit, false);
      audio.impact('flesh', V2.set(ex, ey, ez));
      const r = this.damage(e, dmg, c, { head: best.head, weaponId: s.id, dir: d, cls: s.cls });
      return { target: e, head: best.head, ...r };
    }
    if (whCopy) {
      const nx = whCopy.nx, ny = whCopy.ny, nz = whCopy.nz;
      if (whCopy.water) { this.effects.impact(ex, 0.05, ez, 0, 1, 0, 'water'); if (this.rng() < 0.5) audio.impact('water', V2.set(ex, ey, ez)); }
      else {
        const data = whCopy.box?.data; let kind = 'concrete', col = null;
        if (data?.type === 'car') { kind = 'metal'; this.carHit(data); } else if (data?.type === 'barrel') { kind = 'metal'; this.barrelHit(data, s.dmg, c); }
        else if (whCopy.terrain) { col = this.map.id === 'beach' ? '#e3cc9a' : '#777'; }
        this.effects.impact(ex, ey, ez, nx, ny, nz, kind, col); if (this.rng() < 0.4) audio.impact(kind, V2.set(ex, ey, ez));
      }
    }
    // bullet whiz near local player
    const L = this.local; if (L && L.alive && c !== L) { const t = (L.pos.x - o.x) * d.x + (L.eyeY - o.y) * d.y + (L.pos.z - o.z) * d.z; if (t > 0 && t < bt) { const px = o.x + d.x * t - L.pos.x, py = o.y + d.y * t - L.eyeY, pz = o.z + d.z * t - L.pos.z; if (px * px + py * py + pz * pz < 4) audio.whiz(V2.set(o.x + d.x * t, o.y + d.y * t, o.z + d.z * t)); } }
    return null;
  }

  melee(c, dmg = 55) {
    const fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw); let best = null, bd = 2.6;
    for (const e of this.combatants) {
      if (e === c || !e.alive || !this.isEnemy(c, e)) continue; const dx = e.pos.x - c.pos.x, dz = e.pos.z - c.pos.z, dy = e.pos.y - c.pos.y; const d = Math.hypot(dx, dz);
      if (d > bd || Math.abs(dy) > 1.6) continue; if ((dx * fx + dz * fz) / (d || 1) < 0.55) continue; best = e; bd = d;
    }
    audio.melee(c.pos);
    if (best) {
      const back = Math.cos(best.yaw - c.yaw) > 0.5; const amount = back ? Math.max(dmg, 150) : dmg;
      this.effects.claySplat(best.pos.x, best.pos.y + 1.2, best.pos.z, fx, 0.2, fz, best.look.outfit, true);
      return this.damage(best, amount, c, { weaponId: 'knife', melee: true, dir: new THREE.Vector3(fx, 0, fz), cls: 'melee' });
    }
    return null;
  }

  // Authoritative damage. info: {head, weaponId, explosive, melee, dir, cls}
  damage(victim, amount, attacker, info = {}) {
    if (!this.authority || this.ended || !victim.alive) return { dealt: 0, killed: false };
    if (attacker && attacker !== victim && !this.isEnemy(attacker, victim)) return { dealt: 0, killed: false };
    if (attacker === victim) amount *= 0.5;
    if (attacker?.isBot && victim.isBot && this.mode.botVsBotMul) amount *= this.mode.botVsBotMul; // keeps simulated lobbies from wiping out too fast
    const r = victim.applyDamage(amount, this.time);
    if (r.dealt <= 0) return r;
    victim.figure?.hit();
    if (attacker) { attacker.stats.damage += r.dealt; attacker.stats.hits++; victim.damagers.set(attacker.id, (victim.damagers.get(attacker.id) || 0) + r.dealt); victim.lastAttacker = attacker; }
    victim.brain?.onDamaged(attacker, info);
    if (victim.kind === 'local') { this.events.emit('damaged', { amount: r.dealt, from: attacker, dir: info.dir }); audio.hurt(); }
    if (victim.kind === 'remote') this.netSend(victim.peerId, { t: 'hurt', a: r.dealt, fx: attacker ? attacker.pos.x : 0, fz: attacker ? attacker.pos.z : 0 });
    if (attacker?.kind === 'local' && attacker !== victim) { this.events.emit('hitmarker', { head: info.head, kill: r.killed, dmg: r.dealt }); audio.hitmarker(info.head); }
    if (attacker?.kind === 'remote' && attacker !== victim) this.netSend(attacker.peerId, { t: 'hm', h: info.head ? 1 : 0, k: r.killed ? 1 : 0, d: Math.round(r.dealt) });
    if (r.killed) this.kill(victim, attacker, info);
    return r;
  }

  kill(victim, attacker, info) {
    victim.stats.deaths++; victim.stats.streak = 0; victim.respawnAt = this.time + (this.mode.respawnDelay ?? 3);
    victim.sliding = false; victim.channel = null;
    if (attacker && attacker !== victim) {
      attacker.stats.kills++; attacker.stats.streak++; attacker.stats.bestStreak = Math.max(attacker.stats.bestStreak, attacker.stats.streak);
      if (info.head) attacker.stats.headshots++;
      const cls = info.cls || WEAPON_MAP[info.weaponId]?.cls; if (cls) attacker.stats.classKills[cls] = (attacker.stats.classKills[cls] || 0) + 1;
      if (info.explosive) attacker.stats.explosiveKills++;
      attacker.stats.weaponXp[info.weaponId] = (attacker.stats.weaponXp[info.weaponId] || 0) + (info.head ? 150 : 100);
      if (attacker.perks.has('scavenger')) scavenge(attacker);
      for (const [id, d] of victim.damagers) if (id !== attacker.id && d >= 30) { const a = this.byId.get(id); if (a) { a.stats.assists++; a.stats.score += 25; } }
    }
    this.effects.claySplat(victim.pos.x, victim.pos.y + 1, victim.pos.z, 0, 1, 0, victim.look.outfit, true);
    const feed = { killer: attacker ? attacker.name : null, killerId: attacker?.id, victim: victim.name, victimId: victim.id, weapon: info.weaponId, head: !!info.head, kBot: !!attacker?.isBot, vBot: victim.isBot, explosive: !!info.explosive };
    this.events.emit('killfeed', feed); this.netBroadcast({ t: 'kf', ...feed });
    if (attacker?.kind === 'local' && attacker !== victim) { this.events.emit('kill', { victim, head: info.head, streak: attacker.stats.streak }); audio.killConfirm(); }
    if (victim.kind === 'local') this.events.emit('died', { killer: attacker, weapon: info.weaponId });
    for (const b of this.combatants) if (b.brain && b.brain.target === victim) b.brain.target = null;
    if (this.mode.usePool && this.authority) this.dropInventory(victim);
    this.mode.onKill(attacker, victim, info);
  }

  dropInventory(c) {
    const p = c.pos; let k = 0; const place = (it) => { const a = k++ * 1.3; it.x = p.x + Math.cos(a) * 1.1; it.z = p.z + Math.sin(a) * 1.1; it.y = this.world.groundAt(it.x, it.z, 0.2, p.y + 1); this.netBroadcast({ t: 'loot+', it: this.loot.add(it) }); };
    for (const w of c.slots) if (w && w.id !== 'knife') place({ type: 'weapon', weaponId: w.id, rarity: w.rarity, build: w.build });
    for (const [am, n] of Object.entries(c.ammo)) if (n > 0) place({ type: 'ammo', ammoType: am, amount: n });
    for (const [h, n] of Object.entries(c.heals)) for (let i = 0; i < Math.min(n, 2); i++) place({ type: 'heal', heal: h, amount: 1 });
    if (c.armor > 0) place({ type: 'armor', tier: c.armor > 75 ? 3 : c.armor > 50 ? 2 : 1 });
    c.slots = [null, null]; c.ammo = { light: 0, rifle: 0, shell: 0, sniper: 0, rocket: 0 }; c.heals = { bandage: 0, medkit: 0, cell: 0 };
  }

  // ---------- projectiles & explosions ----------
  spawnProjectile(owner, kind, pos, vel, ex = {}) {
    const color = { rocket: '#c1272d', launcher: '#f4d35e', frag: '#556b2f', sticky: '#ff5d8f', smoke: '#bbbbbb', stun: '#ffd166' }[kind];
    const m = new THREE.Mesh(kind === 'rocket' ? new THREE.CylinderGeometry(0.06, 0.06, 0.5, 8).rotateX(Math.PI / 2) : new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshStandardMaterial({ color, roughness: 0.5, emissive: kind === 'rocket' ? '#ff6020' : '#000', emissiveIntensity: 0.6 }));
    m.position.copy(pos); this.scene.add(m);
    const p = { owner, kind, pos: pos.clone(), vel: vel.clone(), g: ex.gravity ?? 14, radius: ex.radius ?? 6, dmg: ex.dmg ?? 120, fuse: ex.fuse ?? 2.5, sticky: kind === 'sticky' || kind === 'launcher', impact: kind === 'rocket', mesh: m, stuck: null, t: 0 };
    this.projectiles.push(p); if (kind !== 'rocket' && kind !== 'launcher') audio.grenadePin(pos);
    return p;
  }
  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i]; p.t += dt; p.fuse -= dt;
      if (!p.stuck) {
        p.vel.y -= p.g * dt; const sp = p.vel.length(); const d = V1.copy(p.vel).divideScalar(sp || 1); const step = sp * dt;
        const h = this.world.raycast(p.pos.x, p.pos.y, p.pos.z, d.x, d.y, d.z, step + 0.1, F_BULLET | F_WATER);
        let hitC = null; if (p.impact || p.sticky) for (const e of this.combatants) { if (e === p.owner && p.t < 0.3 || !e.alive) continue; const hh = e.hitTest(p.pos.x, p.pos.y, p.pos.z, d.x, d.y, d.z, step + 0.1); if (hh) { hitC = e; break; } }
        if (hitC) { if (p.impact) { p.fuse = 0; } else { p.stuck = hitC; p.stuckOff = new THREE.Vector3().subVectors(p.pos, hitC.pos); p.fuse = Math.min(p.fuse, 1.0); } }
        else if (h) {
          p.pos.addScaledVector(d, Math.max(0, h.t - 0.05));
          if (h.box?.data?.type === 'glass') { this.breakGlass(h.box); }
          else if (p.impact || h.water) p.fuse = 0;
          else if (p.sticky) { p.stuck = 'world'; p.vel.set(0, 0, 0); }
          else { // bounce
            if (h.nx) p.vel.x *= -0.4; if (h.ny) p.vel.y *= -0.35; if (h.nz) p.vel.z *= -0.4; p.vel.multiplyScalar(0.7); if (sp > 3) audio.bounce(p.pos);
            if (h.ny > 0 && Math.abs(p.vel.y) < 1) { p.vel.y = 0; p.vel.x *= 0.85; p.vel.z *= 0.85; }
          }
        } else p.pos.addScaledVector(d, step);
        if (p.kind === 'rocket') { this.effects.alpha.spawn(p.pos.x, p.pos.y, p.pos.z, 0, 0.3, 0, 0.8, 0.5, 0.6, 0.6, 0.6, { grow: 1, alpha: 0.4 }); this.effects.add.spawn(p.pos.x, p.pos.y, p.pos.z, -d.x * 3, -d.y * 3, -d.z * 3, 0.1, 0.4, 1, 0.6, 0.2); }
        if (p.t > 8) p.fuse = 0;
      } else if (p.stuck !== 'world') { if (p.stuck.alive) p.pos.copy(p.stuck.pos).add(p.stuckOff); }
      p.mesh.position.copy(p.pos); if (p.kind === 'rocket') p.mesh.lookAt(V2.copy(p.pos).add(p.vel));
      if (p.fuse <= 0) { this.scene.remove(p.mesh); this.projectiles.splice(i, 1); this.detonate(p); }
    }
  }
  detonate(p) {
    if (p.kind === 'smoke') { this.effects.smokeCloud(p.pos.x, p.pos.y, p.pos.z, this.world); audio.smoke(p.pos); this.netBroadcast({ t: 'smoke', x: p.pos.x, y: p.pos.y, z: p.pos.z }); return; }
    if (p.kind === 'stun') { this.effects.flashBurst(p.pos.x, p.pos.y, p.pos.z); audio.explosion(p.pos); for (const e of this.combatants) { if (!e.alive) continue; const d = e.pos.distanceTo(p.pos); if (d < 11 && this.world.lineOfSight(p.pos.x, p.pos.y + 0.3, p.pos.z, e.pos.x, e.eyeY, e.pos.z)) { e.stun = Math.max(e.stun, 3.5 * (1 - d / 14)); if (e.kind === 'local') this.events.emit('stunned', e.stun); if (e.kind === 'remote') this.netSend(e.peerId, { t: 'stun', s: e.stun }); } } this.netBroadcast({ t: 'boom', x: p.pos.x, y: p.pos.y, z: p.pos.z, r: 3, stun: 1 }); return; }
    this.explode(p.pos.x, p.pos.y, p.pos.z, p.radius, p.dmg, p.owner, p.kind === 'rocket' || p.kind === 'launcher' ? (p.kind === 'rocket' ? 'rocket' : 'splat') : p.kind);
  }
  explode(x, y, z, radius, dmg, owner, weaponId) {
    this.effects.explosion(x, y, z, radius); audio.explosion(V2.set(x, y, z)); this.noise(x, z, 140, owner, true);
    this.netBroadcast({ t: 'boom', x, y, z, r: radius });
    const L = this.local; if (L) { const d = Math.hypot(L.pos.x - x, L.pos.z - z); this.shake = Math.max(this.shake, clamp(1 - d / (radius * 5), 0, 1)); }
    if (!this.authority) return;
    for (const e of this.combatants) {
      if (!e.alive) continue; const d = Math.hypot(e.pos.x - x, e.pos.y + 0.9 - y, e.pos.z - z); if (d > radius) continue;
      const los = this.world.lineOfSight(x, y + 0.4, z, e.pos.x, e.pos.y + 1.0, e.pos.z);
      const amt = dmg * Math.pow(1 - d / radius, 0.7) * (los ? 1 : 0.35);
      if (amt > 1) this.damage(e, amt, owner, { weaponId: WEAPON_MAP[weaponId] ? weaponId : (weaponId === 'sticky' ? 'sticky' : 'frag'), explosive: true, dir: new THREE.Vector3(e.pos.x - x, 0, e.pos.z - z).normalize(), cls: 'explosive' });
    }
    for (const it of this.map.interactives) if (it.type === 'barrel' && !it.dead && Math.hypot(it.x - x, it.z - z) < radius) setTimeout(() => this.barrelHit(it, 999, owner), 120);
    for (const g of this.map.glass) if (!g.dead && Math.hypot((g.x0 + g.x1) / 2 - x, (g.z0 + g.z1) / 2 - z) < radius * 1.2) this.breakGlass(g);
  }
  barrelHit(b, dmg, owner) {
    if (b.dead) return; b.hp -= dmg; if (b.hp > 0) return;
    b.dead = true; b.mesh.visible = false; b.box.dead = true; this.netBroadcast({ t: 'barrel', i: this.map.interactives.indexOf(b) });
    this.explode(b.x, b.y, b.z, 6.5, 140, owner, 'frag');
  }
  breakGlass(box) {
    if (box.dead) return; box.dead = true; box.data?.hide?.();
    const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2, cz = (box.z0 + box.z1) / 2;
    this.effects.impact(cx, cy, cz, 0, 0, 0, 'glass'); audio.glass(V2.set(cx, cy, cz)); this.netBroadcast({ t: 'glass', i: this.map.glass.indexOf(box) });
  }
  carHit(data) { if (this.time - (data.alarm || -99) < 8) return; data.alarm = this.time; audio.carAlarm(V2.set(data.x, 1, data.z)); }
  throwEquip(c, kind) {
    const fx = -Math.sin(c.yaw) * Math.cos(c.pitch), fy = Math.sin(c.pitch), fz = -Math.cos(c.yaw) * Math.cos(c.pitch);
    const o = V1.set(c.pos.x + fx * 0.6, c.eyeY - 0.1, c.pos.z + fz * 0.6); const v = new THREE.Vector3(fx * 17, fy * 17 + 4, fz * 17).add(c.vel.clone().multiplyScalar(0.5));
    const def = LETHALS.find((l) => l.id === kind);
    if (!this.authority) { this.netSend(null, { t: 'throw', k: kind, o: [o.x, o.y, o.z], v: [v.x, v.y, v.z] }); }
    const p = this.spawnProjectile(c, kind, o, v, def ? { radius: def.radius, dmg: def.dmg, fuse: def.fuse, gravity: 14 } : { fuse: 1.6, gravity: 14 });
    if (!this.authority) p.ghost = true; // visual only on client
    return p;
  }

  noise(x, z, radius, src, ping) {
    this.noises.push({ x, z, r: radius, src, t: this.time });
    if (ping && src && src.kind !== 'local') this.events.emit('ping', { x, z, t: this.time, id: src.id });
  }

  // ---------- items ----------
  tryInteract(c) {
    const fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw);
    const crate = this.loot.nearestCrate(c.pos.x, c.eyeY, c.pos.z);
    if (crate) { if (!this.authority) { this.netSend(null, { t: 'crate', i: crate.id }); return true; } this.openCrate(c, crate); return true; }
    const it = this.loot.nearest(c.pos.x, c.pos.y + 0.6, c.pos.z, 2.6, fx, fz);
    if (it) { if (!this.authority) { this.netSend(null, { t: 'pick', i: it.id }); return true; } this.pickup(c, it); return true; }
    return false;
  }
  openCrate(c, crate) {
    const items = this.loot.openCrate(crate, this.rng); c.stats.crates++;
    if (c.kind === 'local') audio.crate();
    this.netBroadcast({ t: 'crateOpen', i: crate.id, items });
  }
  pickup(c, it) {
    if (!this.loot.items.has(it.id)) return false;
    const taken = this.applyItem(c, it); if (!taken) return false;
    this.loot.remove(it.id); this.netBroadcast({ t: 'loot-', i: it.id });
    if (c.kind === 'remote') this.netSend(c.peerId, { t: 'give', it });
    if (c.kind === 'local') audio.pickup();
    return true;
  }
  // Apply an item to a combatant's inventory (also used client-side on 'give'). Returns false if not useful.
  applyItem(c, it) {
    const drop = (o) => { if (!this.authority) return; o.x = c.pos.x + (this.rng() - 0.5); o.z = c.pos.z + (this.rng() - 0.5); o.y = c.pos.y; this.netBroadcast({ t: 'loot+', it: this.loot.add(o) }); };
    if (it.type === 'weapon') {
      const same = c.slots.findIndex((w) => w && w.id === it.weaponId);
      if (same >= 0 && (c.slots[same].rarity >= it.rarity)) { const am = WEAPON_MAP[it.weaponId].ammo; if (am && c.usePool) c.ammo[am] += Math.ceil(AMMO[am].pickup / 2); else return false; return true; }
      const empty = c.slots.findIndex((w) => !w || w.id === 'knife');
      const slot = same >= 0 ? same : empty >= 0 ? empty : c.slot;
      const old = c.slots[slot]; c.giveWeapon(it.weaponId, it.build || {}, it.rarity, slot);
      if (old && old.id !== 'knife' && this.authority) drop({ type: 'weapon', weaponId: old.id, rarity: old.rarity, build: old.build });
      return true;
    }
    if (it.type === 'ammo') { if (c.ammo[it.ammoType] >= 400) return false; c.ammo[it.ammoType] += it.amount; return true; }
    if (it.type === 'heal') { const H = HEALS[it.heal]; if (c.heals[it.heal] >= H.max) return false; c.heals[it.heal]++; return true; }
    if (it.type === 'armor') { const v = ARMOR_TIERS[it.tier]; if (c.armor >= v) return false; c.armor = v; return true; }
    if (it.type === 'lethal' || it.type === 'tactical') { const slot = it.type === 'lethal' ? c.lethal : c.tactical; if (slot.id === it.eq && slot.n >= 3) return false; if (slot.id !== it.eq) { slot.id = it.eq; slot.n = 1; } else slot.n++; return true; }
    return false;
  }
  startHeal(c, kind) {
    if (c.channel || !c.alive) return false;
    if (!this.mode.usePool) return false;
    const order = kind ? [kind] : (c.hp < 60 && c.heals.medkit ? ['medkit', 'bandage', 'cell'] : c.armor < 100 && c.heals.cell ? ['cell', 'bandage', 'medkit'] : ['bandage', 'medkit', 'cell']);
    for (const h of order) {
      const H = HEALS[h]; if (!c.heals[h]) continue;
      if (H.hp && c.hp >= H.cap) continue; if (H.armor && c.armor >= 100) continue;
      c.channel = { kind: h, t: 0, dur: H.time }; return true;
    }
    return false;
  }
  updateChannel(c, dt) {
    const ch = c.channel; if (!ch) return; if (!c.alive) { c.channel = null; return; }
    ch.t += dt; if (ch.t < ch.dur) return; const H = HEALS[ch.kind];
    if (c.heals[ch.kind] > 0) { c.heals[ch.kind]--; if (H.hp) c.hp = Math.min(Math.max(c.hp, Math.min(H.cap, c.hp + H.hp)), c.maxHp); if (H.armor) c.armor = Math.min(100, c.armor + H.armor); this.effects.heal(c.pos.x, c.pos.y, c.pos.z); audio.heal(c.pos); }
    c.channel = null;
    if (c.kind === 'remote') this.netSend(c.peerId, { t: 'stat', hp: c.hp, ar: c.armor, heals: c.heals });
  }

  // ---------- network glue (implemented by NetSync) ----------
  netBroadcast(msg) { if (this.role === 'host' && this.sync) this.sync.broadcast(msg); }
  netSend(peer, msg) { if (this.sync) this.sync.send(peer, msg); }

  // ---------- main loop ----------
  update(dt) {
    this.time += dt;
    this.pathBudget = 4;
    const live = !this.ended;
    if (live) {
      if (this.authority) this.mode.update(dt); else this.mode.clientUpdate?.(dt);
      for (const c of this.combatants) {
        if (c.kind === 'local') continue; // player controller ticks first (from main)
        if (c.brain && this.authority) c.brain.update(dt);
        if (c.alive) this.updateChannel(c, dt);
        if (c.spawnProtect > 0) c.spawnProtect -= dt; if (c.stun > 0) c.stun -= dt;
      }
      if (this.sync) this.sync.update(dt);
      this.updateProjectiles(dt);
    } else for (const c of this.combatants) if (c.brain) { c.vel.x *= 0.8; c.vel.z *= 0.8; }
    // prune noises
    while (this.noises.length && this.time - this.noises[0].t > 2) this.noises.shift();
    this.effects.update(dt); this.ambient.update(dt);
    const cam = this.gfx.camera.position; this.loot.update(dt, cam);
    // animate figures
    for (const c of this.combatants) {
      const f = c.figure; if (!f) continue;
      const dx = c.pos.x - cam.x, dz = c.pos.z - cam.z; const dist = Math.sqrt(dx * dx + dz * dz);
      const vis = c.kind !== 'local' || this.spectating === c.id || this.thirdPerson;
      f.root.visible = vis && dist < this.gfx.q.drawDist && !(c.dropping && c.dropping.inPlane);
      if (!f.root.visible) continue;
      f.root.position.copy(c.pos); f.root.rotation.y = c.yaw;
      const w = c.weapon; f.setWeapon(w ? w.id : null, w ? w.build : null);
      const speed = Math.hypot(c.vel.x, c.vel.z);
      f.animate(dt, { speed, crouch: c.crouchT, pitch: c.pitch, air: !c.onGround && !c.dropping, slide: c.sliding, sprint: c.sprinting, firing: c.firingVisual > 0, reloading: c.fire.reload > 0, reloadTime: c.fire.reloadTotal, dead: !c.alive, emote: c.emote }, dist);
      if (c.dropping && c.dropping.chute) { f.root.rotation.x = 0; }
      c.firingVisual -= dt;
    }
    // world dynamic details
    this.animateWorld(dt);
  }

  animateWorld(dt) {
    const t = this.time; const m = this.map;
    for (const wm of m.waterMats || []) wm.uniforms.uTime.value = t;
    for (const n of m.neon) { if (n.flicker) { n.t += dt; const on = Math.sin(n.t * 23) > -0.85 || Math.sin(n.t * 3.1) > 0; n.m.material.color.setScalar(on ? n.base : n.base * 0.2); } }
    for (const a of m.animated) { if (a.bob !== undefined) a.m.position.y = 0.1 + Math.sin(t * 1.3 + a.bob) * 0.15; if (a.blink) a.m.visible = Math.sin(t * 3) > 0; }
    if (m.bulbs) { // traffic light cycle: 0 red,1 yellow,2 green per axis
      const cyc = (t % 20); const phaseA = cyc < 8 ? 2 : cyc < 10 ? 1 : 0; const phaseB = cyc < 10 ? 0 : cyc < 18 ? 2 : 1; const C = new THREE.Color();
      if (Math.floor(t * 2) !== this._tlStep) { this._tlStep = Math.floor(t * 2); for (const im of m.bulbs) { let n = 0; for (let k = 0; k < im.count / 2; k++) for (let s = 0; s < 2; s++) { const ph = s ? phaseB : phaseA; im.setColorAt(n++, C.copy(im.userData.col).multiplyScalar(ph === im.userData.ci ? 5 : 0.12)); } im.instanceColor.needsUpdate = true; } }
    }
  }

  dispose() {
    this.ambient?.dispose?.(); audio.stopAmbience();
    this.scene.traverse((o) => { if (o.geometry && !o.geometry.userData?.shared) o.geometry.dispose?.(); });
    this.gfx.composer?.dispose?.(); this.gfx.composer = null; this.gfx.scene = null; this.sync?.dispose();
    if (this.gfx.envRT) { this.gfx.envRT.dispose(); this.gfx.envRT = null; }
  }
}

export function scavenge(c) {
  for (const w of c.slots) { if (!w || !w.stats.ammo) continue; if (c.usePool) c.ammo[w.stats.ammo] += Math.ceil(AMMO[w.stats.ammo].pickup / 2); else w.reserve += w.stats.mag; }
}
function jitter(d, spread, r) {
  // random direction within cone of half-angle `spread` (radians), gaussian-ish center weighting
  const a = r() * Math.PI * 2, m = spread * Math.sqrt(r()) ;
  let ux = -d.z, uy = 0, uz = d.x; let ul = Math.hypot(ux, uz); if (ul < 1e-5) { ux = 1; uz = 0; ul = 1; } ux /= ul; uz /= ul;
  const vx = d.y * uz - d.z * uy, vy = d.z * ux - d.x * uz, vz = d.x * uy - d.y * ux;
  d.x += (ux * Math.cos(a) + vx * Math.sin(a)) * m; d.y += (uy * Math.cos(a) + vy * Math.sin(a)) * m; d.z += (uz * Math.cos(a) + vz * Math.sin(a)) * m; d.normalize();
}
export { jitter };
