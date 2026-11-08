// Local player: FPS movement physics, camera, actions, aim assist and the first-person viewmodel.
import * as THREE from 'three';
import { getProfile } from '../core/save.js';
import { weaponTick, startReload, currentSpread } from './weaponLogic.js';
import { buildGunModel } from './gunModel.js';
import { clayMat, clayGeo } from './clay.js';
import { audio } from '../engine/audio.js';
import { clamp, damp, angleDiff } from '../core/util.js';
import { F_SOLID } from '../world/collision.js';
import { CROUCH_H, STAND_H, RADIUS } from './combatant.js';
import { radialGlow } from '../engine/textures.js';

const GRAV = 21, JUMP = 7.4, WALK = 5.3, SPRINT_MUL = 1.42, CROUCH_MUL = 0.52, ADS_MUL = 0.68, STEP = 0.46;
const V = new THREE.Vector3(), V2 = new THREE.Vector3(), Q = new THREE.Quaternion(), E = new THREE.Euler(0, 0, 0, 'YXZ');

export class PlayerController {
  constructor(match, c, loadout) {
    this.m = match; this.c = c; this.loadout = loadout; this.vm = new Viewmodel(match.gfx, c.look);
    this.bobT = 0; this.camY = 1.62; this.kick = new THREE.Vector2(); this.recoilPend = new THREE.Vector2(); this.recovered = 0; this.lastStepPh = 0;
    this.landDip = 0; this.wantRespawn = true; this.prompt = ''; this.assistTarget = null; this.assistCheck = 0; this.meleeAnim = 0; this.throwAnim = 0;
    this.slideT = 0; this.prevOnGround = true; this.spectate = null; this.fovCur = 70; this.wasAds = false; this.scoped = false; this.inspectT = 0;
    this.muzzleLight = new THREE.PointLight('#ffb060', 0, 12, 2); match.scene.add(this.muzzleLight);
  }

  update(dt, inp) {
    const c = this.c, m = this.m, s = getProfile().settings, cam = m.gfx.camera;
    if (inp.pause) this.onPause?.();
    // ---- look ----
    const zoom = c.weapon ? 1 + (c.weapon.stats.adsFov - 1) * c.fire.ads : 1;
    let sens = 0.0022 * (inp.sens || 1) * (c.fire.ads > 0.5 ? s.adsSensitivity / Math.sqrt(zoom) : 1);
    if (inp.touch) sens *= 0.55;
    if (this.assistTarget && inp.touch && s.aimAssist) sens *= 0.6;
    if (c.stun > 0) sens *= 0.5;
    c.yaw -= inp.lookX * sens; c.pitch -= inp.lookY * sens * (s.invertY ? -1 : 1);
    c.pitch = clamp(c.pitch, -1.5, 1.5);

    if (m.ended && this.winnerId != null) { this.victoryCam(dt); this.vm.group.visible = false; return; }
    if (!c.alive) { this.deadCam(dt); this.vm.group.visible = false; return; }
    if (c.dropping) { this.dropUpdate(dt, inp); this.vm.group.visible = false; this.camera(dt, 0); return; }
    this.vm.group.visible = true;
    if (inp.touch && s.aimAssist) this.aimAssist(dt, inp);

    // ---- movement ----
    const w = c.weapon; const ws = w ? w.stats : null;
    if (inp.crouchPressed) {
      if (c.sprinting && c.onGround && Math.hypot(c.vel.x, c.vel.z) > 6.5 && !c.sliding) { c.sliding = true; this.slideT = 0.8; const sp = Math.max(Math.hypot(c.vel.x, c.vel.z), 10.5); const fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw); c.vel.x = fx * sp; c.vel.z = fz * sp; c.crouching = true; audio.footstep('sand', c.pos, true); }
      else if (!s.holdToCrouch) c.crouching = !c.crouching;
    }
    if (s.holdToCrouch && !c.sliding) c.crouching = inp.crouchHeld;
    if (c.sliding) { this.slideT -= dt; if (this.slideT <= 0 || Math.hypot(c.vel.x, c.vel.z) < 3.5 || !c.onGround) c.sliding = false; }
    if (!c.crouching && c.crouchT > 0.01) { const ceil = m.world.ceilingAt(c.pos.x, c.pos.z, 0.3, c.pos.y + CROUCH_H - 0.05); if (ceil < c.pos.y + STAND_H) c.crouching = true; }
    c.crouchT = damp(c.crouchT, c.crouching ? 1 : 0, 14, dt);
    const fwdIn = inp.my, sideIn = inp.mx; const inLen = Math.min(1, Math.hypot(fwdIn, sideIn));
    const reloading = c.fire.reload > 0;
    c.sprinting = inp.sprint && fwdIn > 0.3 && !c.crouching && c.fire.ads < 0.3 && !(inp.fire && ws && ws.mode !== 'melee') && !c.channel;
    if (c.sprinting && c.crouching && !c.sliding) c.crouching = false;
    let speed = WALK * (ws ? ws.move : 1) * (c.perks.has('lightweight') ? 1.08 : 1);
    if (c.sprinting) speed *= SPRINT_MUL; if (c.crouching) speed *= CROUCH_MUL; speed *= 1 - c.fire.ads * (1 - ADS_MUL);
    if (c.channel) speed *= 0.5; if (c.stun > 0) speed *= 0.55;
    const water = m.world.water > -100 && m.world.terrain(c.pos.x, c.pos.z) < m.world.water - 0.6 && c.pos.y < m.world.water + 0.1;
    if (water) speed *= 0.62;
    const sy = Math.sin(c.yaw), cy = Math.cos(c.yaw);
    const wx = (-sy * fwdIn + cy * sideIn) / (inLen > 1 ? inLen : 1), wz = (-cy * fwdIn - sy * sideIn) / (inLen > 1 ? inLen : 1);
    if (c.sliding) { const k = Math.exp(-dt * 1.6); c.vel.x *= k; c.vel.z *= k; }
    else if (c.onGround) { const acc = 1 - Math.exp(-dt * 14); c.vel.x += (wx * speed - c.vel.x) * acc; c.vel.z += (wz * speed - c.vel.z) * acc; }
    else { const acc = 1 - Math.exp(-dt * 2.5); c.vel.x += (wx * speed - c.vel.x) * acc * (inLen > 0.1 ? 1 : 0.15); c.vel.z += (wz * speed - c.vel.z) * acc * (inLen > 0.1 ? 1 : 0.15); }
    if (inp.jump && c.onGround) { if (c.crouching && !c.sliding) c.crouching = false; else { c.vel.y = JUMP; c.onGround = false; c.sliding = false; } }
    this.physics(c, dt);

    // ---- actions ----
    this.updateWeapon(dt, inp, s);
    // interact prompt + use
    this.prompt = ''; this.dropHint = ''; const crate = m.loot.nearestCrate(c.pos.x, c.eyeY, c.pos.z);
    const item = crate ? null : m.loot.nearest(c.pos.x, c.pos.y + 0.6, c.pos.z, 2.6, -sy, -cy);
    if (crate) this.prompt = 'Open Supply Crate'; else if (item) this.prompt = 'Pick up ' + (this.m.itemLabel ? this.m.itemLabel(item) : 'item');
    this.promptItem = item; this.promptCrate = crate;
    if (inp.interact && (crate || item)) m.tryInteract(c);
    if (inp.heal) {
      if (m.mode.usePool) { if (!m.startHeal(c)) m.events.emit('notify', { text: c.hp >= 100 && c.armor >= 100 ? 'Already at full health' : 'No usable healing items', kind: 'bad' }); }
      else if (c.gear === 'medkit') { if (c.gearCd <= 0 && c.hp < c.maxHp) { c.hp = Math.min(c.maxHp, c.hp + 60); c.gearCd = 45; audio.heal(c.pos); m.effects.heal(c.pos.x, c.pos.y, c.pos.z); if (m.role === 'client') m.netSend(null, { t: 'medkit' }); } else m.events.emit('notify', { text: c.gearCd > 0 ? `Medkit recharging (${Math.ceil(c.gearCd)}s)` : 'Health full', kind: 'bad' }); }
      else m.events.emit('notify', { text: 'No healing available (equip Field Medkit gear)', kind: 'bad' });
    }
    if (inp.gear && c.gear === 'pulse') {
      if (c.gearCd <= 0) { c.gearCd = 40; let n = 0; for (const e of m.combatants) if (e !== c && e.alive && m.isEnemy(c, e) && e.pos.distanceTo(c.pos) < 45) { e.revealUntil = m.time + 5; n++; } m.effects.ring(c.pos.x, c.pos.y + 0.2, c.pos.z, '#28e7ff'); audio.beep(true); m.events.emit('notify', { text: `Recon pulse: ${n} enemies revealed`, kind: 'info' }); }
      else m.events.emit('notify', { text: `Recon pulse recharging (${Math.ceil(c.gearCd)}s)`, kind: 'bad' });
    }
    if (c.gearCd > 0) c.gearCd -= dt;
    if (inp.grenade || inp.tactical) {
      const slot = inp.grenade ? c.lethal : c.tactical;
      if (slot.n > 0 && this.throwAnim <= 0) { slot.n--; this.throwAnim = 0.5; m.throwEquip(c, slot.id); }
      else if (slot.n <= 0) m.events.emit('notify', { text: inp.grenade ? 'No lethal equipment' : 'No tactical equipment', kind: 'bad' });
    }
    if (this.throwAnim > 0) this.throwAnim -= dt;
    if (m.role !== 'client') m.updateChannel(c, dt);
    else if (c.channel) { c.channel.t += dt; if (c.channel.t >= c.channel.dur) { m.netSend(null, { t: 'heal', k: c.channel.kind }); c.channel = null; } }
    if (c.spawnProtect > 0) c.spawnProtect -= dt; if (c.stun > 0) c.stun -= dt;
    // footsteps + noise
    const hsp = Math.hypot(c.vel.x, c.vel.z);
    if (c.onGround && hsp > 0.5) {
      this.bobT += dt * (hsp * 1.35 + 2);
      const ph = Math.floor(this.bobT / Math.PI);
      if (ph !== this.lastStepPh) { this.lastStepPh = ph; const surf = water ? 'water' : this.surface(); if (!c.crouching || hsp > 3) audio.footstep(surf, c.pos, true); if (!c.perks.has('quiet') && hsp > 3.5) m.noise(c.pos.x, c.pos.z, c.sprinting ? 22 : 12, c, false); }
    }
    this.camera(dt, hsp);
  }

  surface() { const c = this.c; const t = this.m.world.terrain(c.pos.x, c.pos.z); if (Math.abs(c.pos.y - t) < 0.05) return this.m.map.id === 'beach' ? 'sand' : 'concrete'; return this.m.map.id === 'beach' ? 'wood' : 'concrete'; }

  physics(c, dt) {
    const w = this.m.world; const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      c.vel.y -= GRAV * h;
      c.pos.x += c.vel.x * h; c.pos.z += c.vel.z * h; c.pos.y += c.vel.y * h;
      const hgt = c.crouching || c.sliding ? CROUCH_H : STAND_H;
      w.resolveCylinder(c.pos, RADIUS, hgt, c.onGround ? STEP : 0.2);
      if (c.vel.y > 0) { const ceil = w.ceilingAt(c.pos.x, c.pos.z, RADIUS * 0.7, c.pos.y + 0.5); if (c.pos.y + hgt > ceil) { c.pos.y = ceil - hgt; c.vel.y = 0; } }
      const g = w.groundAt(c.pos.x, c.pos.z, RADIUS * 0.7, c.pos.y + STEP);
      if (c.pos.y <= g + 0.001 || (c.onGround && c.vel.y <= 0 && c.pos.y - g < 0.5)) {
        if (!this.prevOnGround && c.vel.y < -7) { this.landDip = Math.min(0.25, -c.vel.y * 0.018); audio.footstep(this.surface(), c.pos, true); }
        if (!this.prevOnGround && c.vel.y < -16 && this.m.authority) this.m.damage(c, (-c.vel.y - 16) * 6, null, { weaponId: 'fall' });
        c.pos.y = g; c.vel.y = 0; c.onGround = true;
      } else c.onGround = false;
      this.prevOnGround = c.onGround;
    }
  }

  updateWeapon(dt, inp, s) {
    const c = this.c, m = this.m, f = c.fire; const w = c.weapon;
    // slot switching
    const sw = (i) => { if (i !== c.slot && c.slots[i]) { c.slot = i; f.switchT = 0.35 * (c.perks.has('quickhands') ? 0.75 : 1); f.reload = 0; f.burst = 0; f.ads = Math.min(f.ads, 0.3); this.inspectT = 0; audio.reload('out'); } };
    if (inp.slot1) sw(0); if (inp.slot2) sw(1); if (inp.nextSlot) { const n = c.slots.length; for (let k = 1; k < n; k++) { const i = (c.slot + k) % n; if (c.slots[i]) { sw(i); break; } } }
    if (inp.reload) startReload(c, true);
    if (inp.inspect && w && f.reload <= 0) this.inspectT = 2.4;
    if (this.inspectT > 0) this.inspectT -= dt;
    // quick melee
    if (inp.melee && f.meleeT <= 0 && c.fire.switchT <= 0) { f.meleeT = 0.7; this.meleeAnim = 0.45; if (m.authority) m.melee(c, 55); else { m.netSend(null, { t: 'melee' }); audio.melee(c.pos); } }
    if (this.meleeAnim > 0) this.meleeAnim -= dt;
    // ADS
    const canAds = w && w.stats.mode !== 'melee' && !c.sprinting && f.switchT <= 0 && (f.reload <= 0 || w.stats.tube) && this.meleeAnim <= 0;
    const ads = inp.aim && canAds; const at = w ? w.stats.adsTime : 0.2;
    f.ads = clamp(f.ads + (ads ? dt / at : -dt / (at * 0.8)), 0, 1);
    if (ads) this.inspectT = 0;
    const wantFire = inp.fire && !c.channel && this.throwAnim <= 0.2;
    if (wantFire) { c.sprinting = false; this.inspectT = 0; }
    if (!w) { if (wantFire && f.meleeT <= 0) { f.meleeT = 0.6; this.meleeAnim = 0.45; if (m.authority) m.melee(c, 25); else m.netSend(null, { t: 'melee' }); } return; }
    const shots = weaponTick(c, dt, wantFire, true);
    if (shots > 0) {
      const st = w.stats;
      if (st.mode === 'melee') { this.meleeAnim = 0.45; if (m.authority) m.melee(c, st.dmg); else { m.netSend(null, { t: 'melee', k: 1 }); audio.melee(c.pos); } return; }
      const cam = m.gfx.camera; const dir = V.set(0, 0, -1).applyQuaternion(cam.quaternion).normalize();
      const origin = V2.copy(cam.position);
      const muzzle = this.vm.muzzleWorld(cam);
      const spread = currentSpread(c);
      if (m.role === 'client') m.sync.clientFire(c, w, origin, dir, spread, muzzle);
      else m.fireWeapon(c, w, origin, dir, spread, muzzle);
      // recoil
      const adsK = 1 - f.ads * 0.35; this.recoilPend.y += st.recoilV * adsK * (c.crouching ? 0.85 : 1); this.recoilPend.x += (Math.random() - 0.5) * 2 * st.recoilH * adsK;
      this.vm.fireKick(st); this.muzzleLight.intensity = st.suppressed ? 0 : 8; this.muzzleLight.position.copy(muzzle);
      if (st.mode !== 'pump' && st.mode !== 'bolt' && st.ammo && !st.explosive) { const r = V.set(0.12, -0.05, -0.2).applyQuaternion(cam.quaternion).add(cam.position); const right = V2.set(1, 0, 0).applyQuaternion(cam.quaternion); m.effects.casing(r.x, r.y, r.z, right.x * 2.5, 2, right.z * 2.5, c.pos.y + 0.02); }
      if (st.mode === 'pump' || st.mode === 'bolt') setTimeout(() => audio.reload(st.mode === 'pump' ? 'rack' : 'bolt'), st.interval * 400);
    }
    this.muzzleLight.intensity = Math.max(0, this.muzzleLight.intensity - dt * 120);
    // apply recoil gradually; recover after firing stops
    const ap = 1 - Math.exp(-dt * 25); const ry = this.recoilPend.y * ap, rx = this.recoilPend.x * ap;
    c.pitch += ry; c.yaw += rx; this.recoilPend.y -= ry; this.recoilPend.x -= rx; this.recovered += ry;
    if (performance.now() / 1000 - f.lastShot > 0.12 && this.recovered > 0) { const k = this.recovered * (1 - Math.exp(-dt * 6)) * 0.85; c.pitch -= k; this.recovered -= k / 0.85; if (this.recovered < 0.0005) this.recovered = 0; }
  }

  aimAssist(dt, inp) {
    const c = this.c, m = this.m; this.assistCheck -= dt;
    if (this.assistCheck <= 0) {
      this.assistCheck = 0.1; this.assistTarget = null; let best = 0.11;
      const fx = -Math.sin(c.yaw) * Math.cos(c.pitch), fy = Math.sin(c.pitch), fz = -Math.cos(c.yaw) * Math.cos(c.pitch);
      for (const e of m.combatants) {
        if (e === c || !e.alive || !m.isEnemy(c, e)) continue; const dx = e.pos.x - c.pos.x, dy = e.pos.y + 1.3 - c.eyeY, dz = e.pos.z - c.pos.z; const d = Math.hypot(dx, dy, dz); if (d > 80) continue;
        const ang = Math.acos(clamp((dx * fx + dy * fy + dz * fz) / d, -1, 1)); if (ang < best && m.world.lineOfSight(c.pos.x, c.eyeY, c.pos.z, e.pos.x, e.pos.y + 1.3, e.pos.z)) { best = ang; this.assistTarget = e; }
      }
    }
    const t = this.assistTarget; if (!t || !t.alive) return;
    if (!(inp.fire || c.fire.ads > 0.5 || Math.hypot(inp.mx, inp.my) > 0.2)) return;
    const dx = t.pos.x - c.pos.x, dz = t.pos.z - c.pos.z, dy = t.pos.y + 1.25 - c.eyeY; const ty = Math.atan2(-dx, -dz), tp = Math.atan2(dy, Math.hypot(dx, dz));
    const k = 1 - Math.exp(-dt * (c.fire.ads > 0.5 ? 6 : 3)); c.yaw += angleDiff(c.yaw, ty) * k * 0.5; c.pitch += (tp - c.pitch) * k * 0.35;
  }

  dropUpdate(dt, inp) {
    const c = this.c, m = this.m, D = c.dropping;
    if (D.inPlane) { this.prompt = ''; this.dropHint = 'Press JUMP to drop'; if (inp.jump) { D.jumpNow = true; if (m.role === 'client') m.netSend(null, { t: 'jump' }); } return; }
    this.prompt = ''; this.dropHint = D.chute ? '' : 'Press JUMP to deploy parachute';
    const g = m.world.groundAt(c.pos.x, c.pos.z, 0.3, c.pos.y + 0.5); const h = c.pos.y - g;
    if (!D.chute && (h < 50 || (inp.jump && h < 130))) { D.chute = true; audio.smoke(c.pos); }
    const sy = Math.sin(c.yaw), cy = Math.cos(c.yaw); const hs = D.chute ? 10 : 24;
    const wx = (-sy * inp.my + cy * inp.mx) * hs, wz = (-cy * inp.my - sy * inp.mx) * hs;
    const k = 1 - Math.exp(-dt * 2); c.vel.x += (wx - c.vel.x) * k; c.vel.z += (wz - c.vel.z) * k;
    const targetVy = D.chute ? -6.5 : -30 - Math.max(0, inp.my) * 12 * (c.pitch < -0.5 ? 1 : 0); c.vel.y += (targetVy - c.vel.y) * k;
    c.pos.addScaledVector(c.vel, dt); m.world.resolveCylinder(c.pos, RADIUS, STAND_H, 0.45);
    const B = m.map.bounds; c.pos.x = clamp(c.pos.x, B.minX + 2, B.maxX - 2); c.pos.z = clamp(c.pos.z, B.minZ + 2, B.maxZ - 2);
    if (c.pos.y <= g + 0.02) { c.pos.y = g; c.dropping = null; c.vel.set(0, 0, 0); c.onGround = true; this.landDip = 0.2; audio.footstep(this.surface(), c.pos, true); }
  }

  victoryCam(dt) {
    const m = this.m, cam = m.gfx.camera; const w = m.byId.get(this.winnerId); if (!w) return;
    this.vT = (this.vT || 0) + dt; const a = w.yaw + Math.sin(this.vT * 0.4) * 0.6; const d = 3.6;
    const want = V.set(w.pos.x - Math.sin(a) * d, w.pos.y + 1.8, w.pos.z - Math.cos(a) * d);
    if (this.vT < 0.05) cam.position.copy(want); else cam.position.lerp(want, 1 - Math.exp(-dt * 3));
    cam.lookAt(w.pos.x, w.pos.y + 1.2, w.pos.z); this.setFov(60, 1, dt);
  }
  deadCam(dt) {
    const c = this.c, cam = this.m.gfx.camera; const m = this.m;
    let target = this.spectate ? m.byId.get(this.spectate) : null;
    if (target && target.alive && this.spectating) {
      // over-the-shoulder chase camera, pulled in when a wall is in the way
      const hx = target.pos.x, hy = target.pos.y + 1.7, hz = target.pos.z; const bx = Math.sin(target.yaw), bz = Math.cos(target.yaw);
      const dx = bx * 3.2 + Math.cos(target.yaw) * 0.6, dy = 0.9, dz = bz * 3.2 - Math.sin(target.yaw) * 0.6; const len = Math.hypot(dx, dy, dz);
      const hit = this.m.world.raycast(hx, hy, hz, dx / len, dy / len, dz / len, len, 4); const k = hit ? Math.max(0.15, (hit.t - 0.3) / len) : 1;
      const want = V2.set(hx + dx * k, hy + dy * k, hz + dz * k); cam.position.lerp(want, 1 - Math.exp(-dt * 8));
      cam.lookAt(target.pos.x, target.pos.y + 1.5, target.pos.z); return;
    }
    const t = m.time - c.deadAt; const k = Math.min(1, t / 1.2);
    const want = V.set(c.pos.x + 2, c.pos.y + 1.6 + k * 5, c.pos.z + 4); cam.position.lerp(want, 1 - Math.exp(-dt * 3));
    const kl = c.lastAttacker && c.lastAttacker.alive ? c.lastAttacker.pos : c.pos; cam.lookAt(kl.x, kl.y + 1, kl.z);
  }

  camera(dt, hsp) {
    const c = this.c, m = this.m, cam = m.gfx.camera, s = getProfile().settings;
    if (c.dropping) {
      if (c.dropping.inPlane) { const P = m.mode.plane; const back = V.copy(P.dir).multiplyScalar(-26); cam.position.set(P.pos.x + back.x, P.pos.y + 8, P.pos.z + back.z); E.set(c.pitch - 0.25, c.yaw, 0); cam.quaternion.setFromEuler(E); }
      else { cam.position.set(c.pos.x, c.pos.y + 1.7, c.pos.z); E.set(c.pitch, c.yaw, 0); cam.quaternion.setFromEuler(E); }
      this.setFov(s.fov, 1, dt); return;
    }
    const eye = c.sliding ? 0.95 : 1.62 - c.crouchT * 0.55; this.camY = damp(this.camY, eye, 18, dt);
    this.landDip = damp(this.landDip, 0, 8, dt);
    const bobAmt = c.onGround ? Math.min(1, hsp / 6) * (1 - c.fire.ads * 0.85) : 0;
    const bobY = Math.abs(Math.sin(this.bobT)) * 0.045 * bobAmt, bobX = Math.sin(this.bobT) * 0.025 * bobAmt;
    const shake = m.shake; m.shake = Math.max(0, m.shake - dt * 1.5);
    const sx = (Math.random() - 0.5) * shake * 0.08, sy2 = (Math.random() - 0.5) * shake * 0.08;
    E.set(c.pitch + sy2, c.yaw + sx, bobX * 0.4 + (c.sliding ? 0.06 : 0)); cam.quaternion.setFromEuler(E);
    cam.position.set(c.pos.x, c.pos.y + this.camY + bobY - this.landDip, c.pos.z);
    cam.position.x += Math.cos(c.yaw) * bobX; cam.position.z -= Math.sin(c.yaw) * bobX;
    const w = c.weapon; const zoom = w ? 1 + (w.stats.adsFov - 1) * smooth(c.fire.ads) : 1;
    this.setFov(s.fov + (c.sprinting ? 6 : 0) + (c.sliding ? 10 : 0), zoom, dt);
    this.scoped = !!(w && w.stats.scope && c.fire.ads > 0.92);
    this.vm.update(dt, c, this, cam);
  }
  setFov(hfov, zoom, dt) {
    const cam = this.m.gfx.camera; const asp = cam.aspect; const v = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(hfov) / 2) / Math.max(1, asp)) ;
    const vf = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(v / 2) / zoom));
    this.fovCur = damp(this.fovCur, vf, 20, dt); cam.fov = this.fovCur; cam.updateProjectionMatrix();
    this.m.effects.setScale(window.innerHeight * this.m.gfx.renderer.getPixelRatio(), cam.fov);
  }
  dispose() { this.vm.dispose(); this.m.scene.remove(this.muzzleLight); }
}
const smooth = (t) => t * t * (3 - 2 * t);

// ---------------- Viewmodel ----------------
class Viewmodel {
  constructor(gfx, look) {
    this.gfx = gfx; this.look = look; this.group = new THREE.Group(); gfx.vmScene.add(this.group);
    this.holder = new THREE.Group(); this.group.add(this.holder);
    this.weaponId = null; this.kickZ = 0; this.kickR = 0; this.kickV = 0; this.swayX = 0; this.swayY = 0; this.lastYaw = 0; this.lastPitch = 0;
    const fm = new THREE.SpriteMaterial({ map: radialGlow(), color: '#ffcc66', blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, transparent: true });
    this.flash = new THREE.Sprite(fm); this.flash.visible = false; this.flash.renderOrder = 10; this.flashT = 0;
    this.flashCore = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialGlow(), color: '#ffffff', blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); this.flash.add(this.flashCore); this.flashCore.scale.setScalar(0.5);
    this.tmp = new THREE.Vector3();
  }
  setWeapon(ws) {
    if (!ws) { this.holder.clear(); this.weaponId = null; this.gun = null; return; }
    const key = ws.id + JSON.stringify(ws.build) + ws.rarity; if (key === this.weaponId) return; this.weaponId = key;
    this.holder.clear(); const g = buildGunModel(ws.id, ws.build || {}); this.gun = g; this.holder.add(g.group);
    g.group.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    // clay arms attached to the gun
    const L = this.look; const glove = clayMat(L.gloves), sleeve = clayMat(L.outfit), cuff = clayMat(L.accent);
    const limb = (from, to, r, mat) => { const d = new THREE.Vector3().subVectors(to, from); const len = d.length(); const m = new THREE.Mesh(clayGeo.capsule, mat); m.scale.set(r * 2, len, r * 2); m.position.copy(from).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); g.group.add(m); return m; };
    const knife = ws.id === 'knife'; const len = g.length || 0.5; const front = knife ? -0.02 : -Math.min(0.42, len * 0.55);
    const grip = new THREE.Vector3(0.0, -0.07, 0.03); const fore = new THREE.Vector3(0, -0.06, front);
    limb(new THREE.Vector3(0.07, -0.2, 0.2), grip, 0.038, sleeve); limb(new THREE.Vector3(0.1, -0.3, 0.3), new THREE.Vector3(0.07, -0.2, 0.2), 0.045, sleeve);
    const hr = new THREE.Mesh(clayGeo.sphere, glove); hr.scale.set(0.04, 0.045, 0.055); hr.position.copy(grip); g.group.add(hr);
    const cr = new THREE.Mesh(clayGeo.cyl, cuff); cr.scale.set(0.042, 0.025, 0.042); cr.position.set(0.035, -0.14, 0.11); cr.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0.07, -0.13, 0.17).normalize()); g.group.add(cr);
    if (!knife) {
      limb(new THREE.Vector3(-0.14, -0.26, 0.12), fore, 0.036, sleeve);
      const hl = new THREE.Mesh(clayGeo.sphere, glove); hl.scale.set(0.045, 0.04, 0.06); hl.position.copy(fore); g.group.add(hl);
    }
    this.flash.parent?.remove(this.flash); g.muzzle.add(this.flash);
    this.isKnife = knife;
  }
  muzzleWorld(cam) {
    // project the viewmodel muzzle into world space near the camera so tracers start at the barrel
    if (!this.gun) return cam.position.clone();
    this.gun.muzzle.getWorldPosition(this.tmp); // in vm space (camera at origin)
    const v = this.tmp.clone().applyQuaternion(cam.quaternion).add(cam.position);
    return v;
  }
  fireKick(st) {
    this.kickV += 0.4 + st.recoilV * 30; this.kickR += st.recoilV * 6 + 0.03; this.flashT = st.suppressed ? 0 : 0.045;
    this.flash.material.rotation = Math.random() * 6; const s = (st.cls === 'shotgun' || st.cls === 'sniper' ? 0.35 : 0.22) * (0.8 + Math.random() * 0.4); this.flash.scale.setScalar(s);
  }
  update(dt, c, ctrl, cam) {
    const w = c.weapon; this.setWeapon(w); if (!this.gun) return;
    const f = c.fire; const ads = smooth(f.ads);
    // sway from look motion
    const dyaw = angleDiff(this.lastYaw, c.yaw), dp = c.pitch - this.lastPitch; this.lastYaw = c.yaw; this.lastPitch = c.pitch;
    this.swayX = damp(this.swayX, clamp(-dyaw * 3, -0.06, 0.06), 10, dt); this.swayY = damp(this.swayY, clamp(dp * 3, -0.05, 0.05), 10, dt);
    // spring kick
    this.kickZ += this.kickV * dt; this.kickV -= (this.kickZ * 220 + this.kickV * 22) * dt; this.kickR = damp(this.kickR, 0, 14, dt);
    const g = this.gun; const hsp = Math.hypot(c.vel.x, c.vel.z); const bob = c.onGround ? Math.min(1, hsp / 6) : 0;
    const bx = Math.sin(ctrl.bobT) * 0.012 * bob * (1 - ads * 0.9), by = -Math.abs(Math.cos(ctrl.bobT)) * 0.012 * bob * (1 - ads * 0.9);
    const pist = w.stats.cls === 'pistol'; const hip = this.isKnife ? new THREE.Vector3(0.2, -0.22, -0.38) : pist ? new THREE.Vector3(0.15, -0.16, -0.46) : new THREE.Vector3(0.15, -0.17, -0.4);
    const aimDist = w.stats.optic === 'acog' || w.stats.optic === 'scope8' ? 0.2 : 0.26;
    const aimP = new THREE.Vector3(0, -g.sightY, -aimDist - g.sightZ * 1);
    const p = hip.lerp(aimP, ads);
    let rx = 0, ry = this.isKnife ? 0.3 : 0.07 * (1 - ads), rz = 0;
    // sprint pose
    const spr = c.sprinting ? 1 : 0; this.sprintT = damp(this.sprintT || 0, spr, 10, dt);
    rx -= this.sprintT * 0.35; ry += this.sprintT * 0.7; p.x -= this.sprintT * 0.05; p.y -= this.sprintT * 0.05;
    // reload animation
    if (f.reload > 0 && !w.stats.tube) {
      const t = 1 - f.reload / (f.reloadTotal || 1); const tilt = Math.sin(Math.min(1, t * 1.2) * Math.PI);
      rz += tilt * 0.55; rx += tilt * 0.25; p.y -= tilt * 0.05;
      if (g.mag && g.mag.userData.base === undefined) g.mag.userData.base = g.mag.position.y;
      if (g.mag) { const md = t < 0.25 ? 0 : t < 0.45 ? (t - 0.25) / 0.2 : t < 0.62 ? 1 : t < 0.8 ? 1 - (t - 0.62) / 0.18 : 0; g.mag.position.y = g.mag.userData.base - md * 0.25; g.mag.visible = !(t > 0.45 && t < 0.55); }
    } else if (f.reload > 0) { const t = (performance.now() / 300) % 1; rz += 0.3; rx += 0.15 + Math.sin(t * Math.PI * 2) * 0.05; }
    else if (g.mag && g.mag.userData.base !== undefined) { g.mag.position.y = g.mag.userData.base; g.mag.visible = true; }
    // switch lower/raise
    if (f.switchT > 0) { p.y -= f.switchT * 0.6; rx -= f.switchT * 1.2; }
    // pump / bolt cycling
    if (f.pumpT > 0) { f.pumpT -= dt; const k = Math.sin(clamp(1 - f.pumpT / (w.stats.interval || 1), 0, 1) * Math.PI); if (g.pump) g.pump.position.z = (g.pump.userData.z ??= g.pump.position.z) + k * 0.08; if (g.bolt) { g.bolt.rotation.z = -k * 1.2; g.bolt.position.z = (g.bolt.userData.z ??= g.bolt.position.z) + k * 0.05; } rz += k * 0.08 * (1 - ads); }
    // melee / throw
    if (ctrl.meleeAnim > 0) { const k = Math.sin((1 - ctrl.meleeAnim / 0.45) * Math.PI); if (this.isKnife) { p.z -= k * 0.25; p.x -= k * 0.12; ry -= k * 0.6; rx -= k * 0.2; } else { p.z -= k * 0.15; ry += k * 0.5; rz -= k * 0.5; } }
    if (ctrl.throwAnim > 0) { const k = Math.sin((1 - ctrl.throwAnim / 0.5) * Math.PI); p.y -= k * 0.25; rx -= k * 0.6; }
    // inspect
    if (ctrl.inspectT > 0) { const t = 1 - ctrl.inspectT / 2.4; const k = Math.sin(Math.min(1, t * 1.1) * Math.PI); ry += k * -1.1; rz += k * 0.45; rx += Math.sin(t * Math.PI * 2) * 0.15 * k; p.x -= k * 0.05; p.z += k * 0.06; }
    // channel (healing)
    if (c.channel) { p.y -= 0.25; rx -= 0.5; }
    p.x += bx + this.swayX * (1 - ads * 0.8); p.y += by + this.swayY * (1 - ads * 0.8); p.z += this.kickZ * 0.06;
    this.holder.position.copy(p); this.holder.rotation.set(rx + this.kickR * (1 - ads * 0.6) + this.swayY, ry + this.swayX, rz);
    this.group.visible = !ctrl.scoped;
    if (this.flashT > 0) { this.flashT -= dt; this.flash.visible = true; } else this.flash.visible = false;
    this.gfx.vmCamera.fov = 60; this.gfx.vmCamera.updateProjectionMatrix();
  }
  dispose() { this.gfx.vmScene.remove(this.group); }
}
