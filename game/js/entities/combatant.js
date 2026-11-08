// Shared combatant state (player, bots, remote players). Pure data + small helpers; behaviour lives in player.js / bot.js.
import * as THREE from 'three';
import { buildStats, WEAPON_MAP } from '../data/weapons.js';
import { rayCapsule, raySphere } from '../world/collision.js';

let NEXT_ID = 1;
export const STAND_H = 1.8, CROUCH_H = 1.2, RADIUS = 0.38;

export class Combatant {
  constructor(o) {
    this.id = o.id ?? NEXT_ID++; this.name = o.name; this.kind = o.kind; // 'local' | 'bot' | 'remote' | 'puppet'
    this.isBot = o.kind === 'bot'; this.team = o.team ?? -1; this.look = o.look; this.peerId = o.peerId || null;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.yaw = 0; this.pitch = 0;
    this.onGround = true; this.crouching = false; this.crouchT = 0; this.sliding = false; this.sprinting = false; this.airborne = false;
    this.hp = 100; this.maxHp = 100; this.armor = 0; this.maxArmor = 100; this.alive = true; this.deadAt = 0; this.respawnAt = 0; this.spawnProtect = 0;
    this.slots = [null, null]; this.slot = 0; this.ammo = { light: 0, rifle: 0, shell: 0, sniper: 0, rocket: 0 }; this.usePool = false;
    this.lethal = { id: 'frag', n: 1 }; this.tactical = { id: 'smoke', n: 1 }; this.perks = new Set(); this.gear = null; this.gearCd = 0;
    this.heals = { bandage: 0, medkit: 0, cell: 0 }; this.channel = null;
    this.fire = { cd: 0, burst: 0, reload: 0, reloadTotal: 0, switchT: 0, ads: 0, bloom: 0, latch: false, lastShot: 0, inspect: 0, meleeT: 0, pumpT: 0 };
    this.stats = { kills: 0, deaths: 0, damage: 0, headshots: 0, shots: 0, hits: 0, score: 0, assists: 0, crates: 0, classKills: {}, explosiveKills: 0, weaponXp: {}, streak: 0, bestStreak: 0 };
    this.ggLevel = 0; this.place = 0; this.lastDamage = -99; this.lastAttacker = null; this.damagers = new Map(); this.stun = 0; this.revealUntil = 0;
    this.figure = null; this.netState = null; this.interp = []; this.firingVisual = 0;
  }

  get weapon() { return this.slots[this.slot]; }
  get eyeY() { return this.pos.y + (this.sliding ? 0.95 : 1.62 - this.crouchT * 0.55); }
  get height() { return this.crouching || this.sliding ? CROUCH_H : STAND_H; }

  makeWeapon(id, build = {}, rarity = 0) {
    const s = buildStats(id, build, rarity); const w = WEAPON_MAP[id];
    return { id, build, rarity, stats: s, mag: s.mag, reserve: this.usePool ? 0 : s.mag * (w.reserve || 4) };
  }
  giveWeapon(id, build, rarity = 0, slot = null) {
    const ws = this.makeWeapon(id, build, rarity);
    let idx = slot ?? this.slots.findIndex((x) => !x); if (idx < 0) idx = this.slot;
    const old = this.slots[idx]; this.slots[idx] = ws; this.slot = idx; this.fire.switchT = 0.3; this.fire.reload = 0;
    return old;
  }
  reserveFor(w) { if (!w) return 0; if (!w.stats.ammo) return Infinity; return this.usePool ? this.ammo[w.stats.ammo] : w.reserve; }
  takeReserve(w, n) {
    if (!w.stats.ammo) return n;
    if (this.usePool) { const t = Math.min(n, this.ammo[w.stats.ammo]); this.ammo[w.stats.ammo] -= t; return t; }
    const t = Math.min(n, w.reserve); w.reserve -= t; return t;
  }

  // Ray hit test against head sphere + body capsule. Returns {t, head} or null.
  hitTest(ox, oy, oz, dx, dy, dz, maxT) {
    if (!this.alive) return null;
    const p = this.pos; const crouch = this.crouchT; const slide = this.sliding;
    const headY = p.y + (slide ? 0.95 : 1.62 - crouch * 0.52); const bodyTop = headY - 0.3;
    // broad phase
    const cx = p.x - ox, cy = headY - 0.6 - oy, cz = p.z - oz; const along = cx * dx + cy * dy + cz * dz;
    if (along < -1 || along > maxT + 1) return null;
    const px = cx - dx * along, py = cy - dy * along, pz = cz - dz * along; if (px * px + py * py + pz * pz > 2.2) return null;
    const th = raySphere(ox, oy, oz, dx, dy, dz, p.x, headY, p.z, 0.24, maxT);
    const tb = rayCapsule(ox, oy, oz, dx, dy, dz, p.x, p.y + 0.35, bodyTop, p.z, 0.36, maxT);
    if (th >= 0 && (tb < 0 || th <= tb + 0.05)) return { t: th, head: true };
    if (tb >= 0) return { t: tb, head: false };
    return null;
  }

  // Apply damage; armor soaks first. Returns {dealt, killed}.
  applyDamage(amount, now) {
    if (!this.alive || this.spawnProtect > 0) return { dealt: 0, killed: false };
    let rem = amount, dealt = 0;
    if (this.armor > 0) { const a = Math.min(this.armor, rem); this.armor -= a; rem -= a; dealt += a; }
    const h = Math.min(this.hp, rem); this.hp -= h; dealt += h; this.lastDamage = now;
    if (this.channel) this.channel = null;
    if (this.hp <= 0.001) { this.hp = 0; this.alive = false; this.deadAt = now; return { dealt, killed: true }; }
    return { dealt, killed: false };
  }

  resetForSpawn() {
    this.hp = this.maxHp; this.alive = true; this.vel.set(0, 0, 0); this.crouching = false; this.crouchT = 0; this.sliding = false; this.channel = null; this.stun = 0;
    Object.assign(this.fire, { cd: 0, burst: 0, reload: 0, switchT: 0.2, ads: 0, bloom: 0, latch: false, inspect: 0, meleeT: 0 }); this.damagers.clear(); this.spawnProtect = 1.5;
  }
}
