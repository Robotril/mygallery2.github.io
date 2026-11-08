// Bot AI: perception (vision cone + LOS + hearing), state machine (roam/loot/combat/hunt/cover/zone),
// navigation via NavGrid, human-like aim with reaction delay and tracking error.
import * as THREE from 'three';
import { weaponTick, startReload, currentSpread } from './weaponLogic.js';
import { WEAPON_MAP, RARITY } from '../data/weapons.js';
import { clamp, angleDiff } from '../core/util.js';
import { RADIUS, STAND_H, CROUCH_H } from './combatant.js';

export const PERSONALITIES = [
  { id: 'rusher', aggression: 0.95, range: 9, prefer: ['smg', 'shotgun'], loot: 0.3, camp: 0, crouch: 0.1 },
  { id: 'tactician', aggression: 0.6, range: 22, prefer: ['ar', 'lmg'], loot: 0.5, camp: 0.2, crouch: 0.35 },
  { id: 'sniper', aggression: 0.3, range: 55, prefer: ['sniper', 'marksman'], loot: 0.5, camp: 0.6, crouch: 0.6 },
  { id: 'looter', aggression: 0.45, range: 18, prefer: ['ar', 'smg'], loot: 0.9, camp: 0.1, crouch: 0.2 },
  { id: 'camper', aggression: 0.25, range: 25, prefer: ['shotgun', 'ar', 'lmg'], loot: 0.4, camp: 0.9, crouch: 0.6 },
];

const V = new THREE.Vector3(), D = new THREE.Vector3();
const GRAV = 21;

export class BotBrain {
  constructor(match, c, skill, pers) {
    this.m = match; this.c = c; this.skill = skill; this.pers = pers; this.reset();
    this.thinkT = Math.random() * 0.3; this.perceiveT = Math.random() * 0.3;
  }
  reset() {
    this.state = 'roam'; this.target = null; this.lastSeen = null; this.lastSeenT = -99; this.seenSince = -1; this.path = null; this.pi = 0; this.goal = null;
    this.repathT = 0; this.strafe = Math.random() < 0.5 ? 1 : -1; this.strafeT = 0; this.aimErr = new THREE.Vector3(); this.aimYaw = this.c.yaw; this.aimPitch = 0;
    this.stuckT = 0; this.lastPos = this.c.pos.clone(); this.coverT = 0; this.lootTarget = null; this.wantCrouch = false; this.jumpCd = 0; this.burstT = 0; this.holdT = 0; this.grenadeCd = 6 + Math.random() * 10;
    this.homeGoal = null; this.investigate = null;
  }
  onDamaged(att) {
    if (!att || att === this.c) return;
    if (!this.c.weapon && att.pos.distanceTo(this.c.pos) > 5) { this.cover = null; if (this.goal) this.goal.sprint = true; return; }
    if (!this.target || !this.target.alive || this.state !== 'combat') { this.target = att; this.lastSeen = att.pos.clone(); this.lastSeenT = this.m.time; this.seenSince = this.m.time - this.skill.reaction * 0.5; this.state = 'combat'; }
  }

  update(dt) {
    const c = this.c, m = this.m;
    if (!c.alive || c.dropping) return;
    if (!m.mode.started) { this.move(dt, 0, 0, false); return; }
    if (this.passive) { // training dummy: sways around its home spot, faces the player, never attacks
      const h = c.home; let mx = 0, mz = 0; if (h) { const tx = h.x + Math.sin(m.time * 0.6 + c.id) * 2.5; mx = clamp((tx - c.pos.x) * 0.3, -0.4, 0.4); mz = clamp((h.z - c.pos.z) * 0.3, -0.4, 0.4); }
      const L = m.local; if (L) { c.yaw = Math.atan2(-(L.pos.x - c.pos.x), -(L.pos.z - c.pos.z)); c.pitch = 0; }
      weaponTick(c, dt, false, false); this.move(dt, mx, mz, false); return;
    }
    this.perceiveT -= dt; if (this.perceiveT <= 0) { this.perceiveT = 0.22 + Math.random() * 0.12; this.perceive(); }
    this.thinkT -= dt; if (this.thinkT <= 0) { this.thinkT = 0.4 + Math.random() * 0.3; this.think(); }
    let mx = 0, mz = 0, sprint = false, wantFire = false;
    const w = c.weapon;
    // ----- combat -----
    if (this.state === 'combat' && this.target && !w && this.target.pos.distanceTo(c.pos) > 6) { this.state = 'roam'; this.target = null; }
    if (this.state === 'combat' && this.target && this.target.alive) {
      const t = this.target; const visible = m.time - this.lastSeenT < 0.3;
      const dx = t.pos.x - c.pos.x, dz = t.pos.z - c.pos.z; const dist = Math.hypot(dx, dz) || 1;
      // aim point with tracking error that shrinks while target stays visible
      const decay = Math.exp(-dt * (1.2 / this.skill.err));
      this.aimErr.multiplyScalar(decay); if (this.aimErr.lengthSq() < 0.0004) this.aimErr.set((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.3).multiplyScalar(this.skill.err);
      const tsp = Math.hypot(t.vel.x, t.vel.z); if (tsp > 3) this.aimErr.x += (Math.random() - 0.5) * tsp * 0.02 * this.skill.err;
      const head = this.skill.reaction < 0.3 && Math.random() < 0.002 ? 0.25 : 0; let aimY = t.pos.y + (t.crouchT > 0.5 ? 0.95 : 1.3) + head;
      const ex = w && w.stats.explosive; if (ex) aimY = t.pos.y + 0.25 + (ex.gravity ? dist * dist * ex.gravity / (2 * ex.speed * ex.speed) : 0);
      // aim down sights at range (tightens spread like a player would)
      const wantAds = visible && w && !['shotgun', 'melee'].includes(w.stats.cls) && dist > 9;
      c.fire.ads = clamp(c.fire.ads + (wantAds ? dt / w.stats.adsTime : -dt * 4), 0, 1);
      const ax = t.pos.x + this.aimErr.x, ay = aimY + this.aimErr.y, az = t.pos.z + this.aimErr.z;
      const ey = c.eyeY; const wantYaw = Math.atan2(-(ax - c.pos.x), -(az - c.pos.z)); const wantPitch = Math.atan2(ay - ey, Math.hypot(ax - c.pos.x, az - c.pos.z));
      const turn = this.skill.turn * dt * (c.stun > 0 ? 0.3 : 1);
      this.aimYaw += clamp(angleDiff(this.aimYaw, wantYaw), -turn, turn); this.aimPitch += clamp(wantPitch - this.aimPitch, -turn, turn);
      c.yaw = this.aimYaw; c.pitch = this.aimPitch;
      const off = Math.abs(angleDiff(this.aimYaw, wantYaw)) + Math.abs(wantPitch - this.aimPitch);
      const reacted = m.time - this.seenSince > this.skill.reaction;
      const inRange = w && (w.stats.cls === 'melee' ? dist < 2.4 : dist < Math.max(w.stats.far * 1.6, 25));
      if (visible && reacted && inRange && off < 0.12 + 2 / dist) {
        // burst discipline: fire in bursts with short pauses depending on skill
        this.burstT -= dt; if (this.burstT < -0.15 - (1 - this.skill.burst) * 0.6) this.burstT = 0.25 + this.skill.burst * 0.9;
        if (!w || w.stats.mode === 'auto') wantFire = this.burstT > 0;
        else { // semi/burst/pump/bolt: pulse the trigger with a human-like cadence
          this.semiT = (this.semiT || 0) - dt;
          if (this.semiT <= 0 && c.fire.cd <= 0) { wantFire = true; this.semiT = w.stats.interval + 0.05 + (1 - this.skill.burst) * 0.3 * Math.random(); }
          else wantFire = false;
        }
      }
      if (!w) { wantFire = dist < 2.2; }
      if (w && w.stats.cls === 'melee') wantFire = visible && dist < 2.4;
      // movement: keep preferred range, strafe, cover, crouch
      const pref = w ? (w.stats.cls === 'melee' ? 1 : w.stats.cls === 'shotgun' ? 5 : w.stats.cls === 'sniper' ? 45 : w.stats.cls === 'marksman' ? 35 : w.stats.cls === 'smg' ? 11 : this.pers.range) : 2;
      const lowHp = c.hp + c.armor < 40;
      if (lowHp && this.pers.aggression < 0.8 && !this.cover && this.coverT <= 0) { this.findCover(); }
      if (this.cover) { const r = this.steerTo(this.cover.x, this.cover.z); mx = r.x; mz = r.z; sprint = true; wantFire = wantFire && Math.random() < 0.3; if (r.arrived) { this.cover = null; this.coverT = 4; this.wantCrouch = true; if (m.mode.usePool) m.startHeal(c); else if (w && w.mag < w.stats.mag * 0.5) startReload(c); } }
      else if (visible || m.time - this.lastSeenT < 1.5) {
        const nx = dx / dist, nz = dz / dist; this.strafeT -= dt; if (this.strafeT <= 0) { this.strafeT = 0.6 + Math.random() * 1.4; if (Math.random() < 0.55) this.strafe *= -1; this.wantCrouch = Math.random() < this.pers.crouch && w && w.stats.cls !== 'shotgun'; }
        const radial = dist > pref * 1.3 ? 1 : dist < pref * 0.6 ? -1 : 0; const k = this.pers.aggression > 0.8 && t.hp < 50 ? 1 : radial;
        mx = nx * k + -nz * this.strafe * 0.8; mz = nz * k + nx * this.strafe * 0.8;
        if (w && w.stats.cls === 'melee') { mx = nx; mz = nz; this.wantCrouch = false; sprint = dist > 3; }
        if (this.wantCrouch && visible) { mx *= 0.2; mz *= 0.2; }
        if (Math.random() < dt * 0.25 && c.onGround && this.pers.aggression > 0.7) this.jump = true;
        // throw grenade at clustered/hidden targets occasionally
        this.grenadeCd -= dt; if (this.grenadeCd <= 0 && dist > 8 && dist < 26 && c.lethal.n > 0 && Math.random() < 0.5) { this.grenadeCd = 15 + Math.random() * 15; c.lethal.n--; c.pitch = 0.35; m.throwEquip(c, c.lethal.id); c.pitch = this.aimPitch; }
      } else {
        // target lost: hunt last known position
        if (this.lastSeen) { const r = this.followPath(this.lastSeen.x, this.lastSeen.z, dt); mx = r.x; mz = r.z; if (r.arrived || m.time - this.lastSeenT > 8) { this.state = 'roam'; this.target = null; } }
      }
      if (w && w.mag === 0 && !wantFire) startReload(c);
      if (w && !visible && w.mag < w.stats.mag * 0.6 && m.time - this.lastSeenT > 1) startReload(c);
    } else {
      if (this.state === 'combat') this.state = 'roam';
      this.wantCrouch = false; c.fire.ads = Math.max(0, c.fire.ads - dt * 4);
      // ----- non combat: goal-driven navigation -----
      const g = this.goal;
      if (g) { const r = this.followPath(g.x, g.z, dt); mx = r.x; mz = r.z; sprint = g.sprint; if (r.arrived) this.arrive(); }
      // look where we're going, scan occasionally
      if (Math.hypot(mx, mz) > 0.1) { const want = Math.atan2(-mx, -mz); this.aimYaw += clamp(angleDiff(this.aimYaw, want), -dt * 4, dt * 4); }
      else this.aimYaw += Math.sin(m.time * 0.7 + c.id) * dt * 0.8;
      this.aimPitch *= 0.95; c.yaw = this.aimYaw; c.pitch = this.aimPitch;
      if (w && w.mag < w.stats.mag && c.reserveFor(w) > 0) startReload(c);
      if (m.mode.usePool && !c.channel && (c.hp < 70 || c.armor < 50)) m.startHeal(c);
    }
    if (this.coverT > 0) this.coverT -= dt;
    // fire
    const shots = weaponTick(c, dt, wantFire && !c.channel, false);
    if (shots > 0 && w) {
      if (w.stats.mode === 'melee') m.melee(c, w.stats.dmg);
      else {
        const dir = D.set(-Math.sin(c.yaw) * Math.cos(c.pitch), Math.sin(c.pitch), -Math.cos(c.yaw) * Math.cos(c.pitch));
        const origin = V.set(c.pos.x, c.eyeY, c.pos.z);
        const muzzle = new THREE.Vector3(origin.x + dir.x * 0.8 - Math.cos(c.yaw) * 0.15 * -1, origin.y - 0.25, origin.z + dir.z * 0.8 + Math.sin(c.yaw) * 0.15);
        m.fireWeapon(c, w, origin, dir, currentSpread(c) * this.skill.spread + this.skill.wobble, muzzle);
      }
    } else if (!w && wantFire && c.fire.meleeT <= 0) { c.fire.meleeT = 0.8; m.melee(c, 25); }
    c.crouching = this.wantCrouch && this.state === 'combat';
    this.move(dt, mx, mz, sprint && !wantFire);
  }

  perceive() {
    const c = this.c, m = this.m; const ey = c.eyeY; const fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw);
    let best = null, bestScore = Infinity; let view = this.skill.view * (c.stun > 0 ? 0.3 : 1) * (m.mode.botViewMul ?? 1);
    if (c.landedAt !== undefined && m.time - c.landedAt < 60) view = Math.min(view, 30); // early-game looting phase
    for (const e of m.combatants) {
      if (e === c || !e.alive || e.dropping || !m.isEnemy(c, e)) continue;
      const dx = e.pos.x - c.pos.x, dz = e.pos.z - c.pos.z, dy = e.pos.y - c.pos.y; const d = Math.hypot(dx, dz); if (d > view) continue;
      const cos = (dx * fx + dz * fz) / (d || 1); const inCone = cos > this.skill.fov - 0.2 || d < 7 || e === this.target;
      if (!c.weapon && d > 4.5 && e !== this.target) continue; // unarmed: avoid fights, go loot
      if (!inCone) continue;
      // crouched + still targets are harder to notice at range
      const stealth = (e.crouching ? 0.6 : 1) * (Math.hypot(e.vel.x, e.vel.z) < 0.5 ? 0.8 : 1); if (d > view * stealth && e !== this.target) continue;
      if (m.mode.botViewMul && this.seenSince < 0 && Math.random() < 0.35 && e !== this.target) continue; // slower noticing in BR
      if (!m.world.lineOfSight(c.pos.x, ey, c.pos.z, e.pos.x, e.eyeY - 0.1, e.pos.z) && !m.world.lineOfSight(c.pos.x, ey, c.pos.z, e.pos.x, e.pos.y + 1.0, e.pos.z)) continue;
      const score = d * (e === this.target ? 0.6 : 1) * (e.kind === 'local' ? 0.95 : 1);
      if (score < bestScore) { bestScore = score; best = e; }
    }
    if (best) {
      if (best !== this.target || this.m.time - this.lastSeenT > 1.2) { this.seenSince = m.time; const e = this.skill.err * (1 + Math.min(2, best.pos.distanceTo(c.pos) / 40)); this.aimErr.set((Math.random() - 0.5) * 2 * e, (Math.random() - 0.3) * e, (Math.random() - 0.5) * 2 * e); }
      this.target = best; this.lastSeen = best.pos.clone(); this.lastSeenT = m.time; this.state = 'combat'; this.goal = null;
      return;
    }
    // hearing
    if (this.state !== 'combat') for (const n of m.noises) {
      if (!n.src || n.src === c || m.time - n.t > 0.5 || !m.isEnemy(c, n.src)) continue; const d = Math.hypot(n.x - c.pos.x, n.z - c.pos.z);
      if (d < n.r * (this.pers.camp > 0.7 ? 0.6 : 1) && d > 4) { if (this.pers.aggression > 0.4 || d < 30) { this.goal = { x: n.x + (Math.random() - 0.5) * 6, z: n.z + (Math.random() - 0.5) * 6, sprint: this.pers.aggression > 0.6, kind: 'investigate' }; this.path = null; } this.aimYaw = Math.atan2(-(n.x - c.pos.x), -(n.z - c.pos.z)); break; }
    }
  }

  think() {
    const c = this.c, m = this.m; if (this.state === 'combat') return;
    const zone = m.mode.zone;
    // zone awareness (BR)
    if (zone) {
      const tz = m.mode.state.zoneShrinking ? { x: zone.tx, z: zone.tz, r: zone.tr } : { x: zone.x, z: zone.z, r: zone.r };
      const tr = Math.max(tz.r, 8); const d = Math.hypot(c.pos.x - tz.x, c.pos.z - tz.z);
      if (d > tr * 0.85 && (!this.goal || this.goal.kind !== 'zone' || Math.hypot(this.goal.x - tz.x, this.goal.z - tz.z) > tr)) { const p = m.nav.randomWalkable(m.rng, tz.x, tz.z, tr * 0.6); if (p) { this.goal = { x: p.x, z: p.z, sprint: true, kind: 'zone' }; this.path = null; } return; }
    }
    // loot when under-equipped
    if (m.mode.usePool && (!this.goal || this.goal.kind !== 'loot')) {
      const needWeapon = !c.slots[0] || !c.slots[1]; const needArmor = c.armor < 50; const needAmmo = c.weapon && c.reserveFor(c.weapon) < c.weapon.stats.mag;
      if (needWeapon || needArmor || needAmmo || Math.random() < this.pers.loot * 0.3) {
        let best = null, bd = needWeapon ? 70 : 40;
        for (const it of m.loot.items.values()) {
          if (it.claimed && it.claimed !== c.id) continue; const d = Math.hypot(it.x - c.pos.x, it.z - c.pos.z); if (d > bd || Math.abs(it.y - c.pos.y) > 3) continue;
          const useful = (it.type === 'weapon' && (needWeapon || it.rarity >= 2)) || (it.type === 'armor' && needArmor) || (it.type === 'ammo' && c.weapon && it.ammoType === c.weapon.stats.ammo) || (it.type === 'heal' && c.heals[it.heal] < 2);
          if (useful && (!zone || Math.hypot(it.x - zone.x, it.z - zone.z) < zone.r)) { bd = d; best = it; }
        }
        if (best) { best.claimed = c.id; this.goal = { x: best.x, z: best.z, sprint: false, kind: 'loot', item: best.id }; this.path = null; return; }
      }
      const crate = m.loot.crates.find((k) => !k.opened && !k.falling && Math.hypot(k.x - c.pos.x, k.z - c.pos.z) < 45);
      if (crate && Math.random() < 0.5) { this.goal = { x: crate.x + 1, z: crate.z + 1, sprint: true, kind: 'crate', crate }; this.path = null; return; }
    }
    if (!this.goal) {
      // roam / patrol
      const A = m.mode.spawnArea || m.map.arena;
      let p;
      if (this.pers.camp > 0.5 && this.homeGoal && Math.random() < 0.7) p = m.nav.randomWalkable(m.rng, this.homeGoal.x, this.homeGoal.z, 10);
      else if (zone) p = m.nav.randomWalkable(m.rng, zone.x, zone.z, zone.r * 0.7);
      else p = m.nav.randomWalkable(m.rng, (A.minX + A.maxX) / 2, (A.minZ + A.maxZ) / 2, Math.max(A.maxX - A.minX, A.maxZ - A.minZ) / 2);
      if (p) { if (!this.homeGoal) this.homeGoal = p; this.goal = { x: p.x, z: p.z, sprint: Math.random() < 0.4, kind: 'roam' }; this.path = null; this.holdT = this.pers.camp * 6 * Math.random(); }
    }
  }

  arrive() {
    const c = this.c, m = this.m; const g = this.goal;
    if (g.kind === 'loot') { const it = m.loot.items.get(g.item); if (it && Math.hypot(it.x - c.pos.x, it.z - c.pos.z) < 2.8) m.pickup(c, it); else if (it) it.claimed = null; }
    if (g.kind === 'crate' && g.crate && !g.crate.opened) m.openCrate(c, g.crate);
    // equip best weapon after looting
    if (c.slots[0] && c.slots[1]) { const sc = (w) => w.stats.dmg * (60 / w.stats.interval) * (1 + w.rarity * 0.1) * (c.reserveFor(w) + w.mag > 0 ? 1 : 0.01) * (this.pers.prefer.includes(w.stats.cls) ? 1.3 : 1); c.slot = sc(c.slots[0]) >= sc(c.slots[1]) ? 0 : 1; }
    else if (!c.slots[c.slot]) c.slot = c.slots[0] ? 0 : 1;
    this.goal = null; this.path = null;
  }

  findCover() {
    const c = this.c, m = this.m, t = this.target; if (!t) return;
    let best = null, bd = 1e9;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2, r = 4 + Math.random() * 8; const x = c.pos.x + Math.cos(a) * r, z = c.pos.z + Math.sin(a) * r;
      if (!m.nav.walkable(x, z)) continue; const y = m.world.groundAt(x, z, 0.3, c.pos.y + 1.5);
      if (m.world.lineOfSight(t.pos.x, t.eyeY, t.pos.z, x, y + 1.1, z)) continue;
      const d = Math.hypot(x - c.pos.x, z - c.pos.z) + Math.hypot(x - t.pos.x, z - t.pos.z) * -0.2; if (d < bd) { bd = d; best = { x, z }; }
    }
    this.cover = best; this.coverT = best ? 0 : 3;
  }

  steerTo(x, z) { const dx = x - this.c.pos.x, dz = z - this.c.pos.z; const d = Math.hypot(dx, dz); if (d < 0.8) return { x: 0, z: 0, arrived: true }; return { x: dx / d, z: dz / d, arrived: false }; }

  followPath(x, z, dt) {
    const c = this.c, m = this.m; this.repathT -= dt;
    if (!this.path || this.repathT <= 0 || (this.pathGoal && Math.hypot(this.pathGoal.x - x, this.pathGoal.z - z) > 3)) {
      if (m.pathBudget > 0) { m.pathBudget--; this.path = m.nav.findPath(c.pos.x, c.pos.z, x, z) || [{ x, z }]; this.pi = 0; this.repathT = 6 + Math.random() * 3; this.pathGoal = { x, z }; }
      else if (!this.path) return this.steerTo(x, z);
    }
    if (this.holdT > 0 && this.goal && this.goal.kind === 'roam') { this.holdT -= dt; }
    while (this.pi < this.path.length) { const p = this.path[this.pi]; if (Math.hypot(p.x - c.pos.x, p.z - c.pos.z) < 1.1) this.pi++; else break; }
    if (this.pi >= this.path.length) { const r = this.steerTo(x, z); if (Math.hypot(x - c.pos.x, z - c.pos.z) < 2.2) return { x: r.x, z: r.z, arrived: true }; return r; }
    const p = this.path[this.pi]; const r = this.steerTo(p.x, p.z); return { x: r.x, z: r.z, arrived: false };
  }

  move(dt, mx, mz, sprint) {
    const c = this.c, m = this.m; const w = c.weapon;
    // separation from nearby combatants
    for (const o of m.combatants) { if (o === c || !o.alive) continue; const dx = c.pos.x - o.pos.x, dz = c.pos.z - o.pos.z; const d2 = dx * dx + dz * dz; if (d2 < 1.2 && d2 > 1e-4) { const d = Math.sqrt(d2); mx += dx / d * 0.6; mz += dz / d * 0.6; } }
    const len = Math.hypot(mx, mz); if (len > 1) { mx /= len; mz /= len; }
    let speed = 5.2 * (w ? w.stats.move : 1) * (sprint ? 1.38 : 1) * (c.crouching ? 0.5 : 1) * (c.channel ? 0.5 : 1) * (c.stun > 0 ? 0.5 : 1);
    const water = m.world.water > -100 && m.world.terrain(c.pos.x, c.pos.z) < m.world.water - 0.6; if (water) speed *= 0.62;
    c.sprinting = sprint && len > 0.5;
    const acc = 1 - Math.exp(-dt * (c.onGround ? 10 : 2)); c.vel.x += (mx * speed - c.vel.x) * acc; c.vel.z += (mz * speed - c.vel.z) * acc;
    // stuck detection
    this.stuckT += dt;
    if (this.stuckT > 1.2) { const moved = Math.hypot(c.pos.x - this.lastPos.x, c.pos.z - this.lastPos.z); if (len > 0.5 && moved < 0.6) { this.jump = true; this.path = null; this.repathT = 0; this.stuckCount = (this.stuckCount || 0) + 1; if (this.stuckCount > 2) { this.goal = null; this.stuckCount = 0; } } else this.stuckCount = 0; this.lastPos.copy(c.pos); this.stuckT = 0; }
    if (this.jump && c.onGround) { c.vel.y = 7.2; c.onGround = false; } this.jump = false;
    // physics (lighter than player's but same collision)
    c.vel.y -= GRAV * dt; c.pos.x += c.vel.x * dt; c.pos.z += c.vel.z * dt; c.pos.y += c.vel.y * dt;
    const hgt = c.crouching ? CROUCH_H : STAND_H; m.world.resolveCylinder(c.pos, RADIUS, hgt, 0.46);
    const g = m.world.groundAt(c.pos.x, c.pos.z, RADIUS * 0.7, c.pos.y + 0.46);
    if (c.pos.y <= g || (c.onGround && c.vel.y <= 0 && c.pos.y - g < 0.5)) { c.pos.y = g; c.vel.y = 0; c.onGround = true; } else c.onGround = false;
    c.crouchT += ((c.crouching ? 1 : 0) - c.crouchT) * Math.min(1, dt * 10);
  }
}
