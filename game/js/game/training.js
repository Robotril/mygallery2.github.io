// Interactive training: a guided, step-by-step tutorial on the beach against passive target dummies.
import { DeathmatchMode } from './modes.js';
import { audio } from '../engine/audio.js';

const k = (s) => `<kbd>${s}</kbd>`;
// Each step: title, PC text, touch text, check(t, L, m) -> true when complete.
export const STEPS = [
  { title: 'Look around', pc: `Move the ${k('Mouse')} or press the ${k('Arrow keys')} to look around.`, touch: 'Drag on the right side of the screen to look around.', check: (t) => t.look > 2.5 },
  { title: 'Walk', pc: `Walk with ${k('W')} ${k('A')} ${k('S')} ${k('D')}.`, touch: 'Push the left stick to walk.', check: (t) => t.dist > 7 },
  { title: 'Run', pc: `Keep holding ${k('W')}. After a moment you start running on your own.`, touch: 'Push the stick all the way forward to run.', check: (t) => t.sprint > 1.2 },
  { title: 'Jump', pc: `Press ${k('Space')} to jump.`, touch: 'Tap the jump button.', check: (t) => t.jumps > 0 },
  { title: 'Crouch', pc: `Press ${k('C')} to crouch. Press it again to stand up.`, touch: 'Tap the crouch button.', check: (t) => t.crouched },
  { title: 'Slide', pc: `While you are running, press ${k('C')} to slide.`, touch: 'Run, then tap the crouch button to slide.', check: (t) => t.slid },
  { title: 'Shoot', pc: `${k('Left Click')} or press ${k('F')} to shoot a practice dummy.`, touch: 'Hold the orange fire button. Hit a practice dummy.', check: (t, L) => L.stats.hits >= 1 },
  { title: 'Zoom in', pc: `Hold ${k('Right Click')} or ${k('Z')} to zoom, then shoot. Zoomed shots are more accurate.`, touch: 'Tap the aim button to zoom, then shoot.', check: (t) => t.adsShot },
  { title: 'Reload', pc: `Press ${k('R')} to reload.`, touch: 'Tap the reload button.', check: (t) => t.reloaded },
  { title: 'Switch weapons', pc: `Press ${k('1')} or ${k('2')}, or scroll the mouse wheel.`, touch: 'Tap the swap button.', check: (t) => t.swapped },
  { title: 'Pick up loot', pc: 'Walk over the glowing shotgun on the sand. You pick it up by touching it.', touch: 'Walk over the glowing shotgun to pick it up.', check: (t) => t.looted },
  { title: 'Grenade', pc: `Press ${k('G')} to throw a grenade at the dummies.`, touch: 'Tap the grenade button.', check: (t) => t.threw },
  { title: 'Melee', pc: `Press ${k('V')} to swing your knife.`, touch: 'Tap the knife button.', check: (t) => t.meleed },
  { title: 'Final test', pc: 'Knock out 3 practice dummies. Headshots count for more!', touch: 'Knock out 3 practice dummies. Headshots count for more!', check: (t, L) => L.stats.kills >= 3 },
];

export class TrainingMode extends DeathmatchMode {
  constructor(m, s) {
    super(m, { ...s, bots: 3, timeLimit: 999, scoreLimit: 999, difficulty: 'easy' });
    this.id = 'training'; this.name = 'Training'; this.countdown = 0; this.started = true; this.respawnDelay = 2;
    this.step = 0; this.t = { look: 0, dist: 0, sprint: 0, jumps: 0, crouched: false, slid: false, adsShot: false, reloaded: false, swapped: false, looted: false, threw: false, meleed: false };
    this.flash = 0;
  }
  setup() {
    const m = this.m; this.populate(3);
    const y = (x, z) => m.world.groundAt(x, z, 0.3, m.world.terrain(x, z) + 1.2); // ground level only (never on roofs)
    const L = m.local; const px = -2, pz = 52;
    m.respawn(L, { x: px, y: y(px, pz), z: pz }); L.yaw = -Math.PI / 2; this.applyLoadout(L, TRAIN_LOADOUT); L.lethal.n = 3;
    const homes = [[12, 50], [16, 55], [20, 48]];
    m.combatants.filter((c) => c.isBot).forEach((c, i) => { c.home = { x: homes[i][0], y: y(homes[i][0], homes[i][1]), z: homes[i][1] }; c.brain.passive = true; c.name = `Dummy ${i + 1}`; m.respawn(c, c.home); });
    this.lootItem = m.loot.add({ type: 'weapon', weaponId: 'breacher', rarity: 3, build: {}, x: 3, y: y(3, 49), z: 49 });
    this.prevYaw = L.yaw; this.prevPitch = L.pitch; this.prevPos = L.pos.clone(); this.prevSlot = L.slot; this.prevShots = 0; this.prevLethal = L.lethal.n;
  }
  equip(c) { if (c.kind === 'local') { this.applyLoadout(c, TRAIN_LOADOUT); c.lethal.n = 3; } else { c.usePool = false; c.slots = [null, null]; c.giveWeapon('sentinel', {}, 0, 0); c.perks = new Set(); c.armor = 0; } }
  update(dt) {
    const m = this.m;
    for (const c of m.combatants) if (!c.alive && m.time >= c.respawnAt) m.respawn(c, c.home || null);
    for (const c of m.combatants) if (c.alive && c.hp < c.maxHp && m.time - c.lastDamage > 3) c.hp = Math.min(c.maxHp, c.hp + dt * 40);
    const S = STEPS[this.step]; const touch = !!this.touch;
    this.state.tutorial = S ? { i: this.step, n: STEPS.length, title: S.title, text: touch ? S.touch : S.pc, flash: this.flash > 0 } : null;
    this.state.time = 0; this.flash = Math.max(0, this.flash - dt);
  }
  // called every frame by the app with the player's input snapshot
  tutorialTick(dt, inp) {
    const m = this.m, L = m.local, t = this.t; if (!L || m.ended) return;
    this.touch = !!inp.touch;
    t.look += Math.abs(L.yaw - this.prevYaw) + Math.abs(L.pitch - this.prevPitch); this.prevYaw = L.yaw; this.prevPitch = L.pitch;
    t.dist += Math.hypot(L.pos.x - this.prevPos.x, L.pos.z - this.prevPos.z); this.prevPos.copy(L.pos);
    if (L.sprinting) t.sprint += dt; if (!L.onGround && L.vel.y > 2) t.jumps++; if (L.crouching && !L.sliding) t.crouched = true; if (L.sliding) t.slid = true;
    if (L.stats.shots > this.prevShots && L.fire.ads > 0.7) t.adsShot = true; this.prevShots = L.stats.shots;
    if (L.fire.reload > 0) t.reloaded = true; if (L.slot !== this.prevSlot) t.swapped = true; this.prevSlot = L.slot;
    if (!m.loot.items.has(this.lootItem.id)) t.looted = true;
    if (L.lethal.n < this.prevLethal) t.threw = true; this.prevLethal = L.lethal.n; if (L.lethal.n === 0) { L.lethal.n = 2; this.prevLethal = 2; }
    if (L.fire.meleeT > 0) t.meleed = true;
    const S = STEPS[this.step]; if (!S) return;
    if (S.check(t, L, m) || inp.skip) {
      this.step++; this.flash = 0.6; audio.levelUp();
      if (this.step >= STEPS.length) { this.finish(L, 'Training complete. You are ready to play!'); return; }
      m.events.emit('notify', { text: `${S.title}: done!`, kind: 'level' });
      if (STEPS[this.step].title === 'Final test') L.stats.kills = 0;
    }
  }
  onKill(att) { if (att) att.stats.score += 100; }
  onTimeUp() {}
  scoreboard() { return super.scoreboard(); }
}

const TRAIN_LOADOUT = { name: 'Training', primary: 'sentinel', secondary: 'sidekick', builds: { sentinel: { optic: 'reddot' } }, lethal: 'frag', tactical: 'smoke', perks: [], gear: 'medkit' };
