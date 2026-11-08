// Shared weapon state machine for players and bots: cooldowns, burst, reload (incl. tube-fed), spread.
import { audio } from '../engine/audio.js';

export function startReload(c, local = false) {
  const w = c.weapon; const f = c.fire; if (!w || !w.stats.ammo || f.reload > 0 || f.switchT > 0) return false;
  if (w.mag >= w.stats.mag || c.reserveFor(w) <= 0) return false;
  const qh = c.perks.has('quickhands') ? 0.75 : 1;
  f.reloadTotal = w.stats.tube ? w.stats.reload * qh : w.stats.reload * qh; f.reload = f.reloadTotal + (w.stats.tube ? 0.25 : 0); f.reloadStage = 0; f.burst = 0;
  c.sprinting = false;
  return true;
}

// Returns number of shots to fire this frame (0/1). Handles reload completion.
export function weaponTick(c, dt, wantFire, local = false, pos = null) {
  const f = c.fire; const w = c.weapon;
  f.cd -= dt; f.bloom = Math.max(0, f.bloom - dt * 3.5); if (f.switchT > 0) f.switchT -= dt; if (f.meleeT > 0) f.meleeT -= dt;
  if (!w) return 0;
  const s = w.stats;
  if (f.reload > 0) {
    f.reload -= dt; const prog = 1 - f.reload / (f.reloadTotal || 1);
    if (local && !s.tube) { if (f.reloadStage === 0 && prog > 0.2) { f.reloadStage = 1; audio.reload('out'); } if (f.reloadStage === 1 && prog > 0.62) { f.reloadStage = 2; audio.reload('in'); } if (f.reloadStage === 2 && prog > 0.88 && (s.mode === 'bolt' || s.cls === 'lmg' || s.cls === 'ar')) { f.reloadStage = 3; audio.reload('rack'); } }
    if (f.reload <= 0) {
      if (s.tube) { const got = c.takeReserve(w, 1); w.mag += got; if (local) audio.reload('shell'); if (w.mag < s.mag && c.reserveFor(w) > 0 && !wantFire) { f.reload = f.reloadTotal; } else { f.reload = 0; if (local) audio.reload('rack'); } }
      else { const need = s.mag - w.mag; w.mag += c.takeReserve(w, need); f.reload = 0; }
    }
    if (f.reload > 0 && !(s.tube && wantFire && w.mag > 0)) return 0;
    if (s.tube && wantFire && w.mag > 0) f.reload = 0;
  }
  if (f.switchT > 0 || f.meleeT > 0) return 0;
  if (s.mode === 'melee') { if (wantFire && f.cd <= 0) { f.cd = s.interval; return 1; } return 0; }
  // burst continuation
  if (f.burst > 0) { if (f.cd <= 0) { if (w.mag <= 0) { f.burst = 0; return 0; } f.burst--; f.cd = f.burst > 0 ? s.interval : s.burstDelay; return consume(c, w); } return 0; }
  if (!wantFire) { f.latch = false; return 0; }
  if (w.mag <= 0) {
    if (!f.latch) { f.latch = true; if (c.reserveFor(w) > 0) startReload(c, local); else if (local) audio.dryFire(); }
    return 0;
  }
  if (f.cd > 0) return 0;
  if (s.mode === 'auto') { f.cd = s.interval; return consume(c, w); }
  if (f.latch) return 0;
  f.latch = true;
  if (s.mode === 'burst') { f.burst = s.burst - 1; f.cd = s.interval; return consume(c, w); }
  f.cd = s.interval; // semi / pump / bolt
  if (s.mode === 'pump' || s.mode === 'bolt') f.pumpT = s.interval;
  return consume(c, w);
}
function consume(c, w) { w.mag--; c.fire.bloom = Math.min(1.5, c.fire.bloom + (w.stats.recoilV * 6 + 0.05)); c.fire.lastShot = performance.now() / 1000; if (w.mag <= 0 && c.reserveFor(w) > 0 && !w.stats.tube) setTimeout(() => { if (c.weapon === w && w.mag <= 0) startReload(c); }, 250); return 1; }

export function currentSpread(c) {
  const w = c.weapon; if (!w) return 0; const s = w.stats; const ads = c.fire.ads;
  let hip = s.spreadHip * (c.perks.has('steady') ? 0.7 : 1);
  let base = hip + (s.spreadAds - hip) * ads;
  const sp = Math.hypot(c.vel.x, c.vel.z); base *= 1 + Math.min(1, sp / 6) * (s.spreadMove - 1) * (1 - ads * 0.5);
  if (!c.onGround) base *= 2.2; if (c.crouching && c.onGround) base *= 0.8; if (c.sliding) base *= 1.4;
  base += c.fire.bloom * (s.recoilV * 0.6) * (1 - ads * 0.6);
  if (c.stun > 0) base *= 2;
  return base;
}
