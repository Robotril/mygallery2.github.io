// Game modes: Battle Royale, Gun Game, Deathmatch/Team Deathmatch. Each mode owns spawn rules, scoring and win conditions.
import * as THREE from 'three';
import { GUN_GAME_ORDER, WEAPON_MAP, DEFAULT_LOADOUTS, WEAPONS, PRIMARY_CLASSES, allowedAttachments } from '../data/weapons.js';
import { botName, clamp } from '../core/util.js';
import { BotBrain, PERSONALITIES } from '../entities/bot.js';
import { PlayerController } from '../entities/player.js';
import { SKILLS } from './match.js';
import { audio } from '../engine/audio.js';
import { clayMat } from '../entities/clay.js';

class BaseMode {
  constructor(match, s) { this.m = match; this.s = s; this.usePool = false; this.respawnDelay = 3; this.state = {}; this.endTime = (s.timeLimit || 10) * 60; this.started = false; this.countdown = s.countdown ?? 3; }
  get timeLeft() { return Math.max(0, this.endTime - this.m.time); }

  // Create humans + bots. Host/solo only.
  populate(totalBots, teams = 0) {
    const m = this.m; const r = m.rng; const humans = this.s.roster || [];
    humans.forEach((h, i) => {
      const c = m.addCombatant({ name: h.name, kind: h.local ? 'local' : 'remote', look: h.look, team: teams ? i % teams : -1, peerId: h.peerId });
      c.charId = h.charId; c.custom = h.custom;
      if (h.local) c.ctrl = new PlayerController(m, c, this.s.loadout);
      else c.loadout = h.loadout;
    });
    const skill = SKILLS[this.s.difficulty || 'normal']; const used = new Set(humans.map((h) => h.name));
    for (let i = 0; i < totalBots; i++) {
      let name = botName(r); while (used.has(name)) name = botName(r) + Math.floor(r() * 9); used.add(name);
      const bl = m.makeBotLook(r);
      const c = m.addCombatant({ name, kind: 'bot', look: bl.look, team: teams ? (humans.length + i) % teams : -1 }); c.charId = bl.charId; c.custom = bl.custom;
      // individual variation around the chosen difficulty
      const v = 0.8 + r() * 0.4; const sk = { ...skill, reaction: skill.reaction * v, err: skill.err * v, turn: skill.turn / v };
      c.brain = new BotBrain(m, c, sk, PERSONALITIES[Math.floor(r() * PERSONALITIES.length)]);
    }
  }
  randomLoadout(c) {
    const r = this.m.rng; const allowed = this.s.allowed;
    let lo = DEFAULT_LOADOUTS[Math.floor(r() * DEFAULT_LOADOUTS.length)];
    if (c.brain && c.brain.pers.prefer) { const pool = WEAPONS.filter((w) => c.brain.pers.prefer.includes(w.cls)); lo = { ...lo, primary: pool[Math.floor(r() * pool.length)].id, builds: {} }; }
    return lo;
  }
  applyLoadout(c, lo) {
    const allowed = this.s.allowed && this.s.allowed.length ? this.s.allowed : null;
    const fix = (id, sec) => { if (!allowed || allowed.includes(WEAPON_MAP[id].cls)) return id; const alt = WEAPONS.find((w) => allowed.includes(w.cls) && (sec ? w.cls === 'pistol' : w.cls !== 'pistol' && w.cls !== 'melee')) || WEAPONS.find((w) => allowed.includes(w.cls)); return alt ? alt.id : 'knife'; };
    c.usePool = false; c.slots = [null, null];
    c.giveWeapon(fix(lo.primary, false), lo.builds?.[lo.primary] || {}, 0, 0); c.giveWeapon(fix(lo.secondary, true), lo.builds?.[lo.secondary] || {}, 0, 1); c.slot = 0;
    c.perks = new Set(lo.perks || []); c.gear = lo.gear; c.gearCd = 0;
    const extra = c.perks.has('hardline') ? 1 : 0;
    c.lethal = { id: lo.lethal || 'frag', n: 1 + extra }; c.tactical = { id: lo.tactical || 'smoke', n: 1 + extra };
    c.armor = (c.perks.has('tough') ? 25 : 0) + (c.gear === 'plates' ? 50 : 0);
  }
  hudState() { return this.state; }
  applyState(st) { this.state = st; }
  scoreboard() {
    return this.m.combatants.map((c) => ({ id: c.id, name: c.name, bot: c.isBot, local: c.kind === 'local', kills: c.stats.kills, deaths: c.stats.deaths, score: c.stats.score, alive: c.alive, team: c.team, level: c.ggLevel, place: c.place, assists: c.stats.assists }))
      .sort((a, b) => b.score - a.score || b.kills - a.kills);
  }
  finish(winner, reason) {
    if (this.m.ended) return; this.m.ended = true; this.winner = winner;
    const L = this.m.local; const won = !!L && (winner === L || (typeof winner === 'number' && L.team === winner));
    const isTeam = typeof winner === 'number';
    const res = { mode: this.id, won, winnerName: winner == null ? 'Nobody' : isTeam ? `Team ${['Coral', 'Neon'][winner]}` : winner.name, winnerId: !isTeam && winner ? winner.id : null, winnerTeam: isTeam ? winner : null, reason, scoreboard: this.scoreboard() };
    this.m.events.emit('end', res); this.m.netBroadcast({ t: 'end', res });
    audio.stinger(won ? 'victory' : 'defeat');
  }
  onKill(att, vic) { if (att && att !== vic) att.stats.score += 100; }
  update(dt) {
    const m = this.m;
    if (!this.started) { this.countdown -= dt; this.state.countdown = Math.ceil(this.countdown); if (this.countdown <= 0) { this.started = true; this.state.countdown = 0; this.startTime = m.time; this.endTime = m.time + (this.s.timeLimit || 10) * 60; } }
    // respawns
    for (const c of m.combatants) if (!c.alive && this.respawnDelay >= 0 && m.time >= c.respawnAt && !m.ended && c.kind !== 'remote-pending') { if (c.kind === 'local' && c.ctrl && !c.ctrl.wantRespawn) continue; m.respawn(c); }
    // health regen outside BR
    if (!this.usePool) for (const c of m.combatants) if (c.alive && c.hp < c.maxHp && m.time - c.lastDamage > (c.perks.has('tough') ? 3 : 4)) c.hp = Math.min(c.maxHp, c.hp + dt * 30);
    if (this.started && m.time >= this.endTime && !m.ended) this.onTimeUp();
    this.state.time = this.timeLeft;
  }
  get spawnArea() { return this.s.largeArena ? this.m.map.arenaCustomLarge : this.m.map.arena; }
}

// ---------------- Gun Game ----------------
export class GunGameMode extends BaseMode {
  constructor(m, s) { super(m, s); this.id = 'gg'; this.name = 'Gun Game'; this.respawnDelay = 2; this.order = GUN_GAME_ORDER; }
  setup() { this.populate(this.s.bots ?? 9); for (const c of this.m.combatants) { c.ggLevel = 0; this.m.respawn(c); } }
  equip(c) {
    c.usePool = false; c.slots = [null, null]; const id = this.order[Math.min(c.ggLevel, this.order.length - 1)];
    const lo = c.kind === 'local' ? this.s.loadout : null; const build = lo?.builds?.[id] || {};
    c.giveWeapon(id, build, 0, 0); c.slots[0].reserve = 9999; c.slot = 0;
    const lo2 = lo || (c.loadout) || null; c.perks = new Set(lo2?.perks || []); c.lethal = { id: 'frag', n: 0 }; c.tactical = { id: 'smoke', n: 0 }; c.armor = 0; c.gear = null;
  }
  clientEquip(c) { this.equip(c); }
  setLevel(c, lvl) {
    c.ggLevel = clamp(lvl, 0, this.order.length - 1);
    if (c.alive) { this.equip(c); c.fire.switchT = 0.4; }
    if (c.kind === 'remote') this.m.netSend(c.peerId, { t: 'gg', l: c.ggLevel });
    if (c.kind === 'local') this.m.events.emit('notify', { text: `Weapon ${c.ggLevel + 1}/${this.order.length}: ${WEAPON_MAP[this.order[c.ggLevel]].name}`, kind: 'level' });
  }
  onKill(att, vic, info) {
    if (!att || att === vic) { this.setLevel(vic, vic.ggLevel - 1); return; }
    att.stats.score += 100;
    if (info.melee && this.order[att.ggLevel] !== 'knife') { this.setLevel(vic, vic.ggLevel - 1); if (vic.kind === 'local') this.m.events.emit('notify', { text: 'Humiliated! Demoted one weapon', kind: 'bad' }); return; }
    if (att.ggLevel >= this.order.length - 1) { att.ggLevel = this.order.length; this.finish(att, `${att.name} completed the arsenal`); return; }
    this.setLevel(att, att.ggLevel + 1);
  }
  onTimeUp() { const best = [...this.m.combatants].sort((a, b) => b.ggLevel - a.ggLevel || b.stats.kills - a.stats.kills)[0]; this.finish(best, 'Time limit reached'); }
  update(dt) {
    super.update(dt);
    const lead = Math.max(...this.m.combatants.map((c) => c.ggLevel)); this.state.lead = lead; this.state.total = this.order.length;
  }
  scoreboard() { return super.scoreboard().sort((a, b) => b.level - a.level || b.kills - a.kills); }
}

// ---------------- Deathmatch / TDM ----------------
export class DeathmatchMode extends BaseMode {
  constructor(m, s) { super(m, s); this.teams = s.rule === 'tdm' ? 2 : 0; this.id = this.teams ? 'tdm' : 'ffa'; this.name = this.teams ? 'Team Deathmatch' : 'Free-for-All'; this.scoreLimit = s.scoreLimit || (this.teams ? 50 : 25); this.teamScore = [0, 0]; this.respawnDelay = 3; }
  setup() { this.populate(this.s.bots ?? 9, this.teams); for (const c of this.m.combatants) this.m.respawn(c); }
  clientEquip(c) { this.applyLoadout(c, this.s.loadout); }
  equip(c) { const lo = c.kind === 'local' ? this.s.loadout : c.kind === 'remote' && c.loadout ? c.loadout : this.randomLoadout(c); this.applyLoadout(c, lo); }
  onKill(att, vic) {
    if (!att || att === vic) return; att.stats.score += 100;
    if (this.teams) { this.teamScore[att.team]++; if (this.teamScore[att.team] >= this.scoreLimit) this.finish(att.team, `Team reached ${this.scoreLimit} eliminations`); }
    else if (att.stats.kills >= this.scoreLimit) this.finish(att, `${att.name} reached ${this.scoreLimit} eliminations`);
  }
  onTimeUp() {
    if (this.teams) { const w = this.teamScore[0] === this.teamScore[1] ? null : this.teamScore[0] > this.teamScore[1] ? 0 : 1; this.finish(w, 'Time limit reached'); }
    else this.finish([...this.m.combatants].sort((a, b) => b.stats.kills - a.stats.kills)[0], 'Time limit reached');
  }
  update(dt) { super.update(dt); this.state.teamScore = this.teamScore; this.state.limit = this.scoreLimit; const lead = [...this.m.combatants].sort((a, b) => b.stats.kills - a.stats.kills)[0]; this.state.leader = lead ? lead.name : ''; this.state.leaderKills = lead ? lead.stats.kills : 0; }
}

// ---------------- Battle Royale ----------------
const PHASES = [{ wait: 55, shrink: 40, k: 0.55, dps: 1 }, { wait: 45, shrink: 35, k: 0.5, dps: 2 }, { wait: 40, shrink: 30, k: 0.5, dps: 4 }, { wait: 30, shrink: 25, k: 0.45, dps: 6 }, { wait: 25, shrink: 20, k: 0.4, dps: 9 }, { wait: 20, shrink: 25, k: 0, dps: 14 }];

export class BattleRoyaleMode extends BaseMode {
  constructor(m, s) { super(m, s); this.id = 'br'; this.name = 'Battle Royale'; this.usePool = true; this.botViewMul = 0.6; this.botVsBotMul = 0.5; this.respawnDelay = -1; this.phase = -1; this.zone = null; this.countdown = 0; this.started = true; this.dropT = 0; }
  setup() {
    const m = this.m; const total = clamp(this.s.players || 50, 2, 50); const humans = (this.s.roster || []).length;
    this.populate(Math.max(0, total - humans));
    const C = m.map.brCenter; this.zone = { x: C.x, z: C.z, r: C.r, tx: C.x, tz: C.z, tr: C.r, sx: C.x, sz: C.z, sr: C.r, t: 0 };
    this.makeZoneMesh(); this.makePlane();
    m.loot.populate(m.map.lootSpots, m.rng, { allowed: this.s.allowed?.length ? this.s.allowed : null });
    for (const s of m.map.crateSpots) m.loot.addCrate(s.x, s.y, s.z);
    for (const c of m.combatants) {
      c.usePool = true; c.slots = [null, null]; c.slot = 0; c.armor = 0; c.hp = 100; c.alive = true; c.lethal = { id: 'frag', n: 0 }; c.tactical = { id: 'smoke', n: 0 }; c.heals = { bandage: 0, medkit: 0, cell: 0 };
      const lo = c.kind === 'local' ? this.s.loadout : c.loadout; c.perks = new Set(lo?.perks || []); c.gear = lo?.gear || null;
      c.dropping = { inPlane: true, chute: false, target: null, jumpAt: 0 }; c.pos.copy(this.plane.start); c.yaw = this.plane.yaw;
      if (c.brain) { const t = this.pickDropTarget(); c.dropping.target = t; const along = (t.x - this.plane.start.x) * this.plane.dir.x + (t.z - this.plane.start.z) * this.plane.dir.z; c.dropping.jumpAt = clamp(along / this.plane.speed - 1.5 + m.rng() * 3, 2, this.plane.len / this.plane.speed - 1); }
    }
    this.state.alive = m.combatants.length; this.state.total = m.combatants.length;
  }
  netInit() { const P = this.plane; return { start: P.start.toArray(), dir: P.dir.toArray(), len: P.len, t: P.t }; }
  clientInit(d) {
    this.makeZoneMesh(); this.makePlane(d);
    for (const c of this.m.combatants) { c.dropping = { inPlane: true, chute: false }; if (c.kind === 'local') this.clientEquip(c); }
  }
  clientEquip(c) { c.usePool = true; c.slots = [null, null]; c.slot = 0; c.armor = 0; c.lethal = { id: 'frag', n: 0 }; c.tactical = { id: 'smoke', n: 0 }; c.heals = { bandage: 0, medkit: 0, cell: 0 }; const lo = this.s.loadout; c.perks = new Set(lo?.perks || []); c.gear = lo?.gear || null; c.dropping = { inPlane: true, chute: false }; }
  clientUpdate(dt) {
    const P = this.plane; if (!P) return; P.t += dt; P.pos.copy(P.start).addScaledVector(P.dir, Math.min(P.len, P.t * P.speed)); P.mesh.position.copy(P.pos).addScaledVector(P.dir, Math.max(0, P.t * P.speed - P.len)); if (P.t * P.speed > P.len + 200) P.mesh.visible = false;
    const L = this.m.local; if (L && L.dropping && L.dropping.inPlane && P.t * P.speed >= P.len) L.dropping.jumpNow = true;
    if (L && L.dropping && L.dropping.inPlane && L.dropping.jumpNow) { L.dropping.inPlane = false; L.vel.copy(P.dir).multiplyScalar(20); L.pos.copy(P.pos); L.pos.y -= 4; }
    const z = this.state.zone; if (z && this.zoneMesh) { this.zoneMesh.material.uniforms.uTime.value = this.m.time; this.zoneMesh.scale.set(Math.max(0.5, z.r), 1, Math.max(0.5, z.r)); this.zoneMesh.position.x = z.x; this.zoneMesh.position.z = z.z; this.zone = { ...z }; }
    if (this.state.drop && this.state.drop !== this._lastDrop) this._lastDrop = this.state.drop;
  }
  pickDropTarget() {
    const m = this.m; const spots = m.map.lootSpots; const s = spots[Math.floor(m.rng() * spots.length)];
    const near = (s.x - this.plane.start.x) * this.plane.dir.z - (s.z - this.plane.start.z) * this.plane.dir.x; // lateral distance
    if (Math.abs(near) > 210 && (this._tries = (this._tries || 0) + 1) < 40) return this.pickDropTarget(); this._tries = 0;
    return { x: s.x + (m.rng() - 0.5) * 20, z: s.z + (m.rng() - 0.5) * 20 };
  }
  makePlane(net) {
    const m = this.m; const a = m.rng() * Math.PI * 2; const C = m.map.brCenter; const off = (m.rng() - 0.5) * 80; const L = net ? net.len : 520;
    const dir = net ? new THREE.Vector3().fromArray(net.dir) : new THREE.Vector3(Math.cos(a), 0, Math.sin(a)); const perp = new THREE.Vector3(-dir.z, 0, dir.x);
    const start = net ? new THREE.Vector3().fromArray(net.start) : new THREE.Vector3(C.x, 150, C.z).addScaledVector(dir, -L / 2).addScaledVector(perp, off);
    this.plane = { start, dir, speed: 42, len: L, yaw: Math.atan2(-dir.x, -dir.z), pos: start.clone(), t: net ? net.t : 0 };
    const g = new THREE.Group(); const body = new THREE.Mesh(new THREE.CapsuleGeometry(2.2, 14, 6, 14), clayMat('#e9e3d6')); body.rotation.x = Math.PI / 2; g.add(body);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(26, 0.5, 4), clayMat('#d9502e')); g.add(wing); const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 4, 3), clayMat('#d9502e')); tail.position.set(0, 2.5, 8); g.add(tail);
    const tw = new THREE.Mesh(new THREE.BoxGeometry(9, 0.4, 2.4), clayMat('#d9502e')); tw.position.set(0, 0.8, 8); g.add(tw);
    for (const x of [-7, 7]) { const e = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 3, 12), clayMat('#555')); e.rotation.x = Math.PI / 2; e.position.set(x, -0.8, -1); g.add(e); }
    g.rotation.y = this.plane.yaw; g.position.copy(start); m.scene.add(g); this.plane.mesh = g;
    this.chuteGeo = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.5);
  }
  makeZoneMesh() {
    const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uTime: { value: 0 } },
      vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: 'uniform float uTime; varying vec2 vUv; varying vec3 vW; void main(){ float s = 0.5 + 0.5*sin(vUv.x*600.0 + uTime*2.0 + vW.y*0.3); float f = smoothstep(0.0, 0.12, vUv.y) * (1.0 - smoothstep(0.55, 1.0, vUv.y)); float d = distance(cameraPosition.xz, vW.xz); float near = clamp(1.0 - (d - 30.0) / 160.0, 0.18, 1.0); gl_FragColor = vec4(mix(vec3(0.45,0.2,0.95), vec3(0.95,0.3,0.8), s), (0.13 + 0.1*s) * f * near); }' });
    this.zoneMesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 220, 96, 1, true), mat); this.zoneMesh.position.y = 60; this.zoneMesh.renderOrder = 6; this.m.scene.add(this.zoneMesh);
  }
  nextPhase() {
    const m = this.m; this.phase++; const P = PHASES[this.phase]; if (!P) return;
    const z = this.zone; z.sx = z.x; z.sz = z.z; z.sr = z.r;
    const nr = z.r * P.k; const maxOff = Math.max(0, z.r - nr) * 0.8; const a = m.rng() * Math.PI * 2, d = Math.sqrt(m.rng()) * maxOff;
    let tx = z.x + Math.cos(a) * d, tz = z.z + Math.sin(a) * d;
    const B = m.map.bounds; tx = clamp(tx, B.minX + nr + 5, B.maxX - nr - 5); tz = clamp(tz, B.minZ + nr + 5, B.maxZ - nr - 5);
    if (nr < 1) { const alive = m.combatants.filter((c) => c.alive); if (alive.length) { tx = alive.reduce((s, c) => s + c.pos.x, 0) / alive.length; tz = alive.reduce((s, c) => s + c.pos.z, 0) / alive.length; } }
    z.tx = tx; z.tz = tz; z.tr = nr; this.phaseStart = m.time; this.dps = P.dps;
    m.events.emit('notify', { text: this.phase === 0 ? 'The storm is forming. Find the safe zone!' : `Zone phase ${this.phase + 1}: move to the safe area`, kind: 'zone' }); audio.zoneWarn();
    if (this.phase === 1 || this.phase === 3) this.airdrop();
  }
  airdrop() {
    const m = this.m; const z = this.zone; const a = m.rng() * Math.PI * 2, d = m.rng() * z.tr * 0.7; const x = z.tx + Math.cos(a) * d, zz = z.tz + Math.sin(a) * d;
    const c = m.loot.addCrate(x, 120, zz, 'airdrop'); c.falling = 1;
    // remove the collision box added at spawn height (it is re-added on landing)
    m.world.boxes[m.world.boxes.length - 1].dead = true;
    const chute = new THREE.Mesh(this.chuteGeo, clayMat('#e8463c')); chute.scale.set(3, 2, 3); chute.position.y = 6; c.mesh.add(chute); c.chute = chute;
    m.events.emit('notify', { text: 'Supply drop incoming!', kind: 'drop' }); m.events.emit('airdrop', { x, z: zz });
    m.netBroadcast({ t: 'airdrop', x, z: zz, id: c.id });
    this.state.drop = { x, z: zz };
  }
  update(dt) {
    const m = this.m;
    // plane + drop
    const P = this.plane; P.t += dt; P.pos.copy(P.start).addScaledVector(P.dir, Math.min(P.len, P.t * P.speed)); P.mesh.position.copy(P.pos);
    if (P.t * P.speed > P.len + 200) P.mesh.visible = false; else P.mesh.position.addScaledVector(P.dir, Math.max(0, P.t * P.speed - P.len));
    for (const c of m.combatants) if (c.dropping) this.updateDrop(c, dt);
    // zone
    const z = this.zone; this.zoneMesh.material.uniforms.uTime.value = m.time;
    if (this.phase < 0 && P.t > 12) this.nextPhase();
    if (this.phase >= 0) {
      const ph = PHASES[this.phase]; const el = m.time - this.phaseStart;
      if (el > ph.wait) { const k = clamp((el - ph.wait) / ph.shrink, 0, 1); z.x = z.sx + (z.tx - z.sx) * k; z.z = z.sz + (z.tz - z.sz) * k; z.r = z.sr + (z.tr - z.sr) * k; if (k >= 1 && this.phase < PHASES.length - 1) this.nextPhase(); }
      this.state.zoneTimer = el < ph.wait ? ph.wait - el : ph.wait + ph.shrink - el; this.state.zoneShrinking = el >= ph.wait;
      // damage outside
      this.zoneTick = (this.zoneTick || 0) + dt;
      if (this.zoneTick >= 1) { this.zoneTick = 0; for (const c of m.combatants) if (c.alive && !c.dropping && Math.hypot(c.pos.x - z.x, c.pos.z - z.z) > z.r) { c.armor = c.armor; const hp = c.hp; m.damage(c, Math.min(this.dps, 50), null, { weaponId: 'zone' }); } }
    }
    this.zoneMesh.scale.set(Math.max(0.5, z.r), 1, Math.max(0.5, z.r)); this.zoneMesh.position.x = z.x; this.zoneMesh.position.z = z.z;
    Object.assign(this.state, { zone: { x: z.x, z: z.z, r: z.r, tx: z.tx, tz: z.tz, tr: z.tr }, phase: this.phase, plane: this.plane.t * this.plane.speed < this.plane.len ? { x: P.pos.x, z: P.pos.z } : null, planeDir: { x: P.dir.x, z: P.dir.z }, planeStart: { x: P.start.x, z: P.start.z }, planeLen: P.len });
    const alive = m.combatants.filter((c) => c.alive); this.state.alive = alive.length;
    if (!m.ended && alive.length <= 1 && P.t > 3) { const w = alive[0] || null; if (w) w.place = 1; this.finish(w, w ? `${w.name} is the last clay standing` : 'No survivors'); }
    // remote players waiting for respawn don't exist in BR
  }
  updateDrop(c, dt) {
    const m = this.m; const D = c.dropping; const P = this.plane;
    if (D.inPlane) {
      c.pos.copy(P.pos); c.pos.y -= 3; c.vel.set(0, 0, 0);
      const forced = P.t * P.speed >= P.len;
      if ((c.brain && P.t >= D.jumpAt) || forced || D.jumpNow) { D.inPlane = false; c.vel.copy(P.dir).multiplyScalar(20); c.pos.y = P.pos.y - 4; }
      return;
    }
    if (c.kind === 'local' || c.kind === 'remote') return; // players steer themselves (PlayerController)
    const g = m.world.groundAt(c.pos.x, c.pos.z, 0.3, c.pos.y + 0.5);
    const h = c.pos.y - g; if (!D.chute && h < 55) D.chute = true;
    const t = D.target; const dx = t.x - c.pos.x, dz = t.z - c.pos.z; const dist = Math.hypot(dx, dz) || 1;
    const hs = D.chute ? 9 : 22; c.vel.x += ((dx / dist) * Math.min(hs, dist) - c.vel.x) * Math.min(1, dt * 2); c.vel.z += ((dz / dist) * Math.min(hs, dist) - c.vel.z) * Math.min(1, dt * 2);
    c.vel.y = D.chute ? -6 : -32; c.yaw = Math.atan2(-c.vel.x, -c.vel.z);
    c.pos.addScaledVector(c.vel, dt); m.world.resolveCylinder(c.pos, 0.38, 1.8, 0.45);
    if (c.pos.y <= g + 0.05) { c.pos.y = g; c.dropping = null; c.onGround = true; c.vel.set(0, 0, 0); c.landedAt = m.time; if (c.figure) c.figure.root.rotation.x = 0; }
    this.chuteVisual(c);
  }
  chuteVisual(c) {
    const f = c.figure; if (!f) return; const D = c.dropping;
    if (D && D.chute && !f.chute) { f.chute = new THREE.Mesh(this.chuteGeo, clayMat(c.look.accent)); f.chute.scale.set(2.6, 1.6, 2.6); f.chute.position.y = 4.2; f.root.add(f.chute); }
    if ((!D || !D.chute) && f.chute) { f.root.remove(f.chute); f.chute = null; }
  }
  onKill(att, vic) {
    if (att && att !== vic) att.stats.score += 100;
    const alive = this.m.combatants.filter((c) => c.alive).length; vic.place = alive + 1; vic.stats.score += Math.max(0, 50 - vic.place) * 4;
    if (vic.kind === 'remote') this.m.netSend(vic.peerId, { t: 'place', p: vic.place });
  }
  scoreboard() { return super.scoreboard().sort((a, b) => (a.alive === b.alive ? b.kills - a.kills : a.alive ? -1 : 1)); }
  onTimeUp() {}
  get spawnArea() { return this.m.map.arenaCustomLarge; }
}

export const MODE_CLASSES = { br: BattleRoyaleMode, gg: GunGameMode, ffa: DeathmatchMode, tdm: DeathmatchMode };
