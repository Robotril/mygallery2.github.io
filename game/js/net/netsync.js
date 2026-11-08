// In-match synchronization. Host = authoritative simulation (damage, deaths, loot, zone, bots, mode rules).
// Clients simulate their own movement, send state + fire intents, and render interpolated snapshots of everyone else.
import * as THREE from 'three';
import { WEAPON_MAP, WEAPONS, buildStats, LETHALS } from '../data/weapons.js';
import { resolveLook } from '../data/characters.js';
import { ClayFigure } from '../entities/clay.js';
import { audio } from '../engine/audio.js';
import { jitter, scavenge } from '../game/match.js';
import { F_BULLET, F_WATER } from '../world/collision.js';

const WIDX = Object.fromEntries(WEAPONS.map((w, i) => [w.id, i]));
const SNAP_RATE = 1 / 15, STATE_RATE = 1 / 20, INTERP_DELAY = 0.11;
const V = new THREE.Vector3();

export class NetSync {
  constructor(match, room) {
    this.m = match; this.room = room; this.isHost = room.isHost; this.acc = 0; this.modeAcc = 0; this.buffer = []; this.ready = new Set(); this.statsCache = new Map();
    this.off = room.on('game', (from, msg) => this.onMsg(from, msg));
    this.offLeave = room.on('leave', (peer) => { const c = this.byPeer(peer); if (c) { c.alive = false; c.hp = 0; this.m.events.emit('notify', { text: `${c.name} left the match`, kind: 'info' }); this.m.removeCombatant(c); } });
    match.sync = this;
  }
  byPeer(p) { return this.m.combatants.find((c) => c.peerId === p); }
  send(peer, msg) { if (this.isHost) { if (peer) this.room.send(peer, msg); } else this.room.send(null, msg); }
  broadcast(msg, except) { if (!this.isHost) return; if (!except) this.room.send(null, msg); else for (const c of this.m.combatants) if (c.kind === 'remote' && c.peerId !== except) this.room.send(c.peerId, msg); }

  // ---------- host ----------
  initPayload() {
    const m = this.m;
    return { t: 'init', roster: m.combatants.map((c) => ({ id: c.id, name: c.name, charId: c.charId, custom: c.custom, team: c.team, peerId: c.kind === 'local' ? 'host' : c.peerId, bot: c.isBot, x: c.pos.x, y: c.pos.y, z: c.pos.z, gg: c.ggLevel })),
      loot: m.loot.serialize(), crates: m.loot.crates.map((k) => ({ x: k.x, y: k.y, z: k.z, kind: k.kind, opened: k.opened })), mode: m.mode.netInit ? m.mode.netInit() : null, time: m.time };
  }
  snapshot() {
    const m = this.m; const e = [];
    for (const c of m.combatants) {
      const f = (c.alive ? 1 : 0) | (c.crouching ? 2 : 0) | (c.sprinting ? 4 : 0) | (c.sliding ? 8 : 0) | (c.onGround ? 16 : 0) | (c.dropping ? 32 : 0) | (c.dropping?.chute ? 64 : 0) | (c.fire.reload > 0 ? 128 : 0) | (c.dropping?.inPlane ? 256 : 0);
      const w = c.weapon; e.push([c.id, r2(c.pos.x), r2(c.pos.y), r2(c.pos.z), r3(c.yaw), r3(c.pitch), f, Math.round(c.hp), Math.round(c.armor), w ? WIDX[w.id] : -1, r2(c.vel.x), r2(c.vel.z), c.stats.kills, c.stats.deaths, c.ggLevel, c.stats.score]);
    }
    return { t: 'snap', T: m.time, e };
  }
  hostMsg(from, msg) {
    const m = this.m; const c = this.byPeer(from);
    if (msg.t === 'ready') { if (this.ready.has(from) && this.sentInit?.has(from)) return; this.ready.add(from); (this.sentInit ||= new Set()).add(from); this.send(from, this.initPayload()); return; }
    if (!c) return;
    switch (msg.t) {
      case 'st': {
        if (!c.alive && !(msg.f & 1)) return;
        c.pos.set(msg.p[0], msg.p[1], msg.p[2]); c.vel.set(msg.v[0], msg.v[1], msg.v[2]); c.yaw = msg.y; c.pitch = msg.pi;
        c.crouching = !!(msg.f & 2); c.sprinting = !!(msg.f & 4); c.sliding = !!(msg.f & 8); c.onGround = !!(msg.f & 16); c.crouchT = c.crouching ? 1 : 0;
        if (msg.w && WEAPON_MAP[msg.w]) { const key = msg.w + JSON.stringify(msg.b || {}) + (msg.r || 0); if (!c.weapon || c.weapon._key !== key) { c.slots[0] = { id: msg.w, build: msg.b || {}, rarity: msg.r || 0, stats: this.stats(msg.w, msg.b, msg.r), mag: 1, reserve: 1, _key: key }; c.slot = 0; } }
        else if (!msg.w) { c.slots = [null, null]; }
        c.fire.reload = msg.f & 128 ? 1 : 0;
        if (c.dropping) { if (!(msg.f & 32)) c.dropping = null; else { c.dropping.inPlane = !!(msg.f & 256); c.dropping.chute = !!(msg.f & 64); } }
        break;
      }
      case 'fire': {
        if (!c.alive || !c.weapon) return; const s = c.weapon.stats; const o = V.set(msg.o[0], msg.o[1], msg.o[2]).clone(); const mz = msg.mz ? new THREE.Vector3(...msg.mz) : o;
        if (o.distanceTo(c.pos) > 6) return; c.stats.shots++; c.firingVisual = 0.12;
        const ends = []; const restore = this.rewind(msg.rt != null ? Math.min(1, Math.max(0, m.time - msg.rt)) : INTERP_DELAY + SNAP_RATE * 0.5, c);
        if (s.explosive) { const d = new THREE.Vector3(msg.d[0], msg.d[1], msg.d[2]).normalize(); m.spawnProjectile(c, s.id === 'rocket' ? 'rocket' : 'launcher', mz, d.multiplyScalar(s.explosive.speed), s.explosive); }
        else for (let i = 0; i < msg.d.length; i += 3) { const d = new THREE.Vector3(msg.d[i], msg.d[i + 1], msg.d[i + 2]).normalize(); m.traceShot(c, o, d, s, mz); ends.push(...(m._lastEnd || [])); }
        restore();
        audio.gunshot(s.snd, mz, { suppressed: s.suppressed }); if (!s.suppressed) m.noise(o.x, o.z, 90 * s.loud, c, true);
        m.effects.muzzle(mz.x, mz.y, mz.z, msg.d[0], msg.d[1], msg.d[2]);
        this.broadcast({ t: 'fx', s: c.id, w: s.id, o: [r2(mz.x), r2(mz.y), r2(mz.z)], e: m._fxEnds.splice(0) }, from);
        break;
      }
      case 'melee': m.melee(c, msg.k && c.weapon?.id === 'knife' ? c.weapon.stats.dmg : 55); break;
      case 'throw': { const def = LETHALS.find((l) => l.id === msg.k); m.spawnProjectile(c, msg.k, new THREE.Vector3(...msg.o), new THREE.Vector3(...msg.v), def ? { radius: def.radius, dmg: def.dmg, fuse: def.fuse, gravity: 14 } : { fuse: 1.6, gravity: 14 }); this.broadcast({ t: 'throwfx', k: msg.k, o: msg.o, v: msg.v }, from); break; }
      case 'pick': { const it = m.loot.items.get(msg.i); if (it && Math.hypot(it.x - c.pos.x, it.z - c.pos.z) < 4) m.pickup(c, it); break; }
      case 'crate': { const k = m.loot.crates[msg.i]; if (k && !k.opened && Math.hypot(k.x - c.pos.x, k.z - c.pos.z) < 4) m.openCrate(c, k); break; }
      case 'heal': { const k = msg.k; if (c.heals[k] > 0) { c.channel = { kind: k, t: 99, dur: 0 }; m.updateChannel(c, 0); } break; }
      case 'medkit': if (c.alive) c.hp = Math.min(c.maxHp, c.hp + 60); break;
      case 'jump': if (c.dropping) c.dropping.jumpNow = true; break;
    }
  }
  // Lag compensation: temporarily move everyone (except the shooter) back to where the shooter saw them.
  recordHistory() {
    const h = this.hist ||= []; const snap = new Map(); for (const c of this.m.combatants) snap.set(c, [c.pos.x, c.pos.y, c.pos.z, c.crouchT]);
    h.push({ t: this.m.time, snap }); while (h.length && this.m.time - h[0].t > 1) h.shift();
  }
  rewind(dt, except) {
    const h = this.hist; if (!h || !h.length) return () => {}; const target = this.m.time - dt; let best = h[0];
    for (const e of h) if (Math.abs(e.t - target) < Math.abs(best.t - target)) best = e;
    const saved = [];
    for (const [c, p] of best.snap) { if (c === except || !this.m.byId.has(c.id)) continue; saved.push([c, c.pos.x, c.pos.y, c.pos.z, c.crouchT]); c.pos.set(p[0], p[1], p[2]); c.crouchT = p[3]; }
    return () => { for (const [c, x, y, z, ct] of saved) { c.pos.set(x, y, z); c.crouchT = ct; } };
  }
  stats(id, b, r) { const k = id + JSON.stringify(b || {}) + (r || 0); if (!this.statsCache.has(k)) this.statsCache.set(k, buildStats(id, b || {}, r || 0)); return this.statsCache.get(k); }

  // ---------- client ----------
  clientInit(msg) {
    const m = this.m; const myId = this.room.t.id;
    for (const r of msg.roster) {
      const look = resolveLook(r.charId, r.custom); const local = r.peerId === myId;
      const c = m.addCombatant({ id: r.id, name: r.name, kind: local ? 'local' : 'puppet', look, team: r.team, peerId: r.peerId });
      c.charId = r.charId; c.isBot = r.bot; c.pos.set(r.x, r.y, r.z); c.ggLevel = r.gg || 0;
      if (local) { c.ctrl = this.makeCtrl(c); m.mode.clientEquip?.(c); }
    }
    for (const it of msg.loot) m.loot.add(it);
    for (const k of msg.crates) { const cr = m.loot.addCrate(k.x, k.y, k.z, k.kind); if (k.opened) { cr.opened = true; cr.glow.visible = false; } }
    if (msg.mode && m.mode.clientInit) m.mode.clientInit(msg.mode);
    m.time = msg.time; this.inited = true; m.events.emit('netready');
  }
  clientMsg(msg) {
    const m = this.m; const L = m.local;
    switch (msg.t) {
      case 'init': if (!this.inited) this.clientInit(msg); break;
      case 'snap': this.buffer.push({ T: msg.T, at: performance.now() / 1000, e: msg.e }); if (this.buffer.length > 30) this.buffer.shift(); this.applyOwn(msg); if (msg.ms) m.mode.applyState(msg.ms); break;
      case 'ms': m.mode.applyState(msg.s); break;
      case 'fx': { const c = m.byId.get(msg.s); const w = WEAPON_MAP[msg.w]; if (!w) break; const o = V.set(msg.o[0], msg.o[1], msg.o[2]); audio.gunshot(w.snd, o.clone(), {}); if (c) c.firingVisual = 0.12; for (const e of msg.e) { m.effects.tracer(o.x, o.y, o.z, e[0], e[1], e[2]); if (e[3]) m.effects.claySplat(e[0], e[1], e[2], 0, 1, 0, '#c33', false); else m.effects.impact(e[0], e[1], e[2], 0, 1, 0, 'concrete'); } break; }
      case 'kf': m.events.emit('killfeed', msg); if (L && msg.killerId === L.id && msg.victimId !== L.id) { m.events.emit('kill', { victim: m.byId.get(msg.victimId), head: msg.head, streak: 0 }); audio.killConfirm(); L.stats.kills++; if (L.perks.has('scavenger')) scavenge(L); if (msg.head) L.stats.headshots++; const cls = WEAPON_MAP[msg.weapon]?.cls; if (cls) L.stats.classKills[cls] = (L.stats.classKills[cls] || 0) + 1; L.stats.weaponXp[msg.weapon] = (L.stats.weaponXp[msg.weapon] || 0) + (msg.head ? 150 : 100); if (msg.explosive) L.stats.explosiveKills++; }
        if (L && msg.victimId === L.id) { L.alive = false; L.deadAt = m.time; L.stats.deaths++; L.lastAttacker = m.byId.get(msg.killerId) || null; m.events.emit('died', { killer: L.lastAttacker, weapon: msg.weapon }); }
        { const v = m.byId.get(msg.victimId); if (v && v !== L) { v.alive = false; m.effects.claySplat(v.pos.x, v.pos.y + 1, v.pos.z, 0, 1, 0, v.look.outfit, true); } } break;
      case 'hurt': if (L) { m.events.emit('damaged', { amount: msg.a, from: { pos: new THREE.Vector3(msg.fx, 0, msg.fz) } }); audio.hurt(); L.lastDamage = m.time; } break;
      case 'hm': m.events.emit('hitmarker', { head: !!msg.h, kill: !!msg.k, dmg: msg.d }); audio.hitmarker(!!msg.h); if (L) { L.stats.hits++; L.stats.damage += msg.d; } break;
      case 'boom': if (msg.stun) { m.effects.flashBurst(msg.x, msg.y, msg.z); audio.explosion(V.set(msg.x, msg.y, msg.z)); } else m.explode(msg.x, msg.y, msg.z, msg.r, 0, null, 'frag'); break;
      case 'smoke': m.effects.smokeCloud(msg.x, msg.y, msg.z, m.world); audio.smoke(V.set(msg.x, msg.y, msg.z)); break;
      case 'stun': if (L) { L.stun = msg.s; m.events.emit('stunned', msg.s); } break;
      case 'glass': { const g = m.map.glass[msg.i]; if (g && !g.dead) { g.dead = true; g.data.hide?.(); m.effects.impact((g.x0 + g.x1) / 2, (g.y0 + g.y1) / 2, (g.z0 + g.z1) / 2, 0, 0, 0, 'glass'); audio.glass(V.set(g.x0, g.y0, g.z0)); } break; }
      case 'barrel': { const b = m.map.interactives[msg.i]; if (b && !b.dead) { b.dead = true; b.mesh.visible = false; b.box.dead = true; } break; }
      case 'loot+': m.loot.add(msg.it); break;
      case 'loot-': m.loot.remove(msg.i); break;
      case 'give': if (L) { m.applyItem(L, msg.it); audio.pickup(); } break;
      case 'crateOpen': { const k = m.loot.crates[msg.i]; if (k && !k.opened) { k.opened = true; k.glow.visible = false; k.lid.rotation.x = -1.2; k.lid.position.z = -0.35; } for (const it of msg.items) m.loot.add(it); if (k && L && Math.hypot(k.x - L.pos.x, k.z - L.pos.z) < 4) { audio.crate(); L.stats.crates++; } break; }
      case 'airdrop': { const c = m.loot.addCrate(msg.x, 120, msg.z, 'airdrop'); c.falling = 1; m.world.boxes[m.world.boxes.length - 1].dead = true; m.events.emit('notify', { text: 'Supply drop incoming!', kind: 'drop' }); m.events.emit('airdrop', { x: msg.x, z: msg.z }); break; }
      case 'spawn': if (L) { L.resetForSpawn(); L.pos.set(msg.x, msg.y, msg.z); L.yaw = msg.yaw; L.pitch = 0; m.mode.clientEquip?.(L); m.events.emit('respawned'); } break;
      case 'gg': if (L) { L.ggLevel = msg.l; m.mode.clientEquip?.(L); m.events.emit('notify', { text: `Weapon ${msg.l + 1}/${m.mode.order.length}: ${WEAPON_MAP[m.mode.order[msg.l]].name}`, kind: 'level' }); } break;
      case 'place': if (L) L.place = msg.p; break;
      case 'stat': if (L) { L.hp = msg.hp; L.armor = msg.ar; if (msg.heals) L.heals = msg.heals; } break;
      case 'throwfx': { const p = m.spawnProjectile(null, msg.k, new THREE.Vector3(...msg.o), new THREE.Vector3(...msg.v), { fuse: 99 }); p.ghost = true; setTimeout(() => { const i = m.projectiles.indexOf(p); if (i >= 0) { m.scene.remove(p.mesh); m.projectiles.splice(i, 1); } }, 2400); break; }
      case 'end': { const res = msg.res; const Lc = m.local; if (Lc) res.won = res.winnerId === Lc.id || (res.winnerTeam != null && res.winnerTeam === Lc.team); m.ended = true; m.events.emit('end', res); audio.stinger(res.won ? 'victory' : 'defeat'); break; }
    }
  }
  applyOwn(msg) {
    const L = this.m.local; if (!L) return;
    for (const e of msg.e) { if (e[0] !== L.id) continue; L.hp = e[7]; L.armor = e[8]; L.ggLevel = e[14]; L.stats.score = e[15]; if (!(e[6] & 1)) L.alive = false; if (L.dropping && !(e[6] & 256) && L.dropping.inPlane) { L.dropping.inPlane = false; L.vel.set(0, 0, 0); } }
  }
  interpolate() {
    const m = this.m; const B = this.buffer; if (B.length < 1) return;
    const now = performance.now() / 1000 - INTERP_DELAY;
    let a = B[0], b = B[B.length - 1];
    for (let i = B.length - 1; i > 0; i--) if (B[i - 1].at <= now) { a = B[i - 1]; b = B[i]; break; }
    const k = b.at > a.at ? Math.min(1, Math.max(0, (now - a.at) / (b.at - a.at))) : 1;
    this.renderT = a.T + (b.T - a.T) * k; // host time the player is currently seeing (for lag compensation)
    const ia = new Map(a.e.map((e) => [e[0], e]));
    for (const eb of b.e) {
      const c = m.byId.get(eb[0]); if (!c || c.kind === 'local') continue; const ea = ia.get(eb[0]) || eb;
      c.pos.set(ea[1] + (eb[1] - ea[1]) * k, ea[2] + (eb[2] - ea[2]) * k, ea[3] + (eb[3] - ea[3]) * k);
      let dy = eb[4] - ea[4]; if (dy > Math.PI) dy -= Math.PI * 2; if (dy < -Math.PI) dy += Math.PI * 2; c.yaw = ea[4] + dy * k; c.pitch = eb[5];
      const f = eb[6]; c.alive = !!(f & 1); c.crouching = !!(f & 2); c.crouchT = c.crouching ? 1 : 0; c.sprinting = !!(f & 4); c.sliding = !!(f & 8); c.onGround = !!(f & 16);
      c.dropping = f & 32 ? { inPlane: !!(f & 256), chute: !!(f & 64) } : null; c.fire.reload = f & 128 ? 1 : 0; c.fire.reloadTotal = 2;
      c.hp = eb[7]; c.armor = eb[8]; c.vel.set(eb[10], 0, eb[11]); c.stats.kills = eb[12]; c.stats.deaths = eb[13]; c.ggLevel = eb[14]; c.stats.score = eb[15];
      const wid = eb[9] >= 0 ? WEAPONS[eb[9]].id : null; if ((c.weapon?.id || null) !== wid) c.slots = [wid ? { id: wid, build: {}, rarity: 0, stats: this.stats(wid), mag: 1, reserve: 1 } : null, null];
      if (c.dropping && m.mode.chuteVisual) m.mode.chuteVisual(c);
    }
  }
  clientFire(c, ws, origin, dir, spread, muzzle) {
    const m = this.m; const s = ws.stats; const dirs = [];
    if (s.explosive) dirs.push(dir.x, dir.y, dir.z);
    else for (let p = 0; p < s.pellets; p++) {
      const d = dir.clone(); if (spread > 0) jitter(d, spread, Math.random); dirs.push(r4(d.x), r4(d.y), r4(d.z));
      const h = m.world.raycast(origin.x, origin.y, origin.z, d.x, d.y, d.z, 400, F_BULLET | F_WATER); const t = h ? h.t : 400;
      m.effects.tracer(muzzle.x, muzzle.y, muzzle.z, origin.x + d.x * t, origin.y + d.y * t, origin.z + d.z * t);
      if (h) m.effects.impact(origin.x + d.x * t, origin.y + d.y * t, origin.z + d.z * t, h.nx, h.ny, h.nz, h.water ? 'water' : 'concrete');
    }
    c.stats.shots++; audio.gunshot(s.snd, muzzle, { local: true, suppressed: s.suppressed });
    this.send(null, { t: 'fire', o: [r2(origin.x), r2(origin.y), r2(origin.z)], mz: [r2(muzzle.x), r2(muzzle.y), r2(muzzle.z)], d: dirs, rt: this.renderT != null ? r3(this.renderT) : null });
  }

  onMsg(from, msg) { if (this.isHost) this.hostMsg(from, msg); else this.clientMsg(msg); }

  update(dt) {
    const m = this.m; this.acc += dt;
    if (this.isHost) {
      this.recordHistory();
      if (this.acc >= SNAP_RATE) { this.acc = 0; const s = this.snapshot(); this.modeAcc += SNAP_RATE; if (this.modeAcc > 0.5) { this.modeAcc = 0; s.ms = m.mode.hudState(); } this.room.send(null, s); }
    } else {
      this.interpolate();
      const L = m.local; if (L && this.acc >= STATE_RATE) {
        this.acc = 0; const w = L.weapon;
        const f = (L.alive ? 1 : 0) | (L.crouching ? 2 : 0) | (L.sprinting ? 4 : 0) | (L.sliding ? 8 : 0) | (L.onGround ? 16 : 0) | (L.dropping ? 32 : 0) | (L.dropping?.chute ? 64 : 0) | (L.fire.reload > 0 ? 128 : 0) | (L.dropping?.inPlane ? 256 : 0);
        this.send(null, { t: 'st', p: [r2(L.pos.x), r2(L.pos.y), r2(L.pos.z)], v: [r2(L.vel.x), r2(L.vel.y), r2(L.vel.z)], y: r3(L.yaw), pi: r3(L.pitch), f, w: w ? w.id : null, b: w ? w.build : null, r: w ? w.rarity : 0 });
      }
    }
  }
  dispose() { this.off?.(); this.offLeave?.(); }
}
const r2 = (v) => Math.round(v * 100) / 100, r3 = (v) => Math.round(v * 1000) / 1000, r4 = (v) => Math.round(v * 10000) / 10000;
