// CLAYFRONT: app bootstrap, state machine (menu → loading → match → results) and main loop.
import * as THREE from 'three';
import { loadProfile, getProfile, saveProfile, recordMatch, levelInfo } from './core/save.js';
import { Graphics, PRESETS, PRESET_ORDER } from './engine/graphics.js';
import { Input } from './engine/input.js';
import { audio } from './engine/audio.js';
import { Showcase } from './ui/showcase.js';
import { Menu } from './ui/menu.js';
import { HUD } from './ui/hud.js';
import { Match } from './game/match.js';
import { MODE_CLASSES } from './game/modes.js';
import { PlayerController } from './entities/player.js';
import { resolveLook, CHAR_MAP } from './data/characters.js';
import { Room } from './net/room.js';
import { NetSync } from './net/netsync.js';
import { isTouchDevice, isMobileUA } from './core/util.js';
import { itemLabel } from './game/loot.js';
import { TrainingMode } from './game/training.js';
MODE_CLASSES.training = TrainingMode;

class App {
  constructor() {
    this.profile = loadProfile();
    this.canvas = document.getElementById('gl');
    this.gfx = new Graphics(this.canvas);
    this.applyGraphics(true);
    this.input = new Input(this.canvas);
    this.touch = isTouchDevice() && (isMobileUA() || !matchMedia('(pointer: fine)').matches);
    this.menu = new Menu(document.getElementById('ui'), this);
    this.match = null; this.hud = null; this.room = null; this.last = performance.now(); this.state = 'menu'; this.lastSettings = null;
    audio.setVolumes(getProfile().settings); audio.lowQuality = this.gfx.presetId === 'low';
    const unlock = () => { audio.init(); if (this.state === 'menu') audio.startMenuMusic(); };
    addEventListener('pointerdown', unlock); addEventListener('keydown', unlock); addEventListener('touchstart', unlock, { passive: true });
    this.input.onPointerLockLost = () => this.openPause();
    addEventListener('blur', () => { if (this.state === 'match' && this.match && this.match.role === 'solo' && !this.pauseEl) this.openPause(); });
    addEventListener('resize', () => this.checkOrientation()); this.checkOrientation();
    document.body.classList.toggle('is-touch', this.touch);
    this.applyUiScale(); addEventListener('resize', () => this.applyUiScale());
    makeClayGrain();
  }

  async boot() {
    const fill = document.getElementById('boot-fill'), txt = document.getElementById('boot-text');
    fill.style.width = '40%'; txt.textContent = 'Building the showcase…'; await new Promise((r) => setTimeout(r, 30));
    this.showcase = new Showcase(this.gfx); this.previewCharacter(getProfile().character, getProfile().custom[getProfile().character] || {});
    fill.style.width = '100%'; await new Promise((r) => setTimeout(r, 120));
    if (this.state !== 'menu') { requestAnimationFrame((t) => this.loop(t)); return; }
    document.getElementById('boot').classList.add('hidden');
    this.menu.show('main', false);
    if (!getProfile().tutorialOffered && !new URLSearchParams(location.search).get('join')) this.menu.welcome();
    const qp = new URLSearchParams(location.search); const code = qp.get('join');
    if (code) { this.menu.custom.net = qp.get('net') === 'local' ? 'local' : 'online'; this.menu.show('custom'); const i = document.querySelector('#join-code'); if (i) i.value = code; this.joinRoom(code, this.menu.custom.net).catch((e) => { const err = document.querySelector('#join-err'); if (err) err.textContent = e.message; }); history.replaceState(null, '', location.pathname + (qp.get('peer') ? '?peer=' + encodeURIComponent(qp.get('peer')) : '')); }
    requestAnimationFrame((t) => this.loop(t));
  }

  applyGraphics(initial = false) {
    const s = getProfile().settings; const pid = this.gfx.applyPreset(s.graphics, s);
    if (!initial && this.showcase) this.gfx.setupComposer(this.showcase.scene);
    audio.lowQuality = pid === 'low';
  }
  // Interface/text size. Auto = larger on desktop screens so text is comfortable to read.
  applyUiScale() {
    // The interface is designed on a 1280x760 canvas and scaled to the real screen, so a big monitor gets big text too.
    const v = getProfile().settings.uiScale; const mul = Number(v) > 0 && Number(v) < 2 ? Number(v) : 1;
    const fit = Math.min(innerWidth / 1280, innerHeight / 760);
    let z = this.touch ? Math.max(1, Math.min(1.5, fit)) : Math.max(1, Math.min(3.2, fit * 1.12));
    if (innerHeight < 560) z = Math.min(z, 1); // short landscape phones keep their own compact layout
    z *= mul;
    document.documentElement.style.setProperty('--uiz', z.toFixed(3)); this.uiZoom = z;
  }
  startTraining() { this.startMatch({ mode: 'training', map: 'beach', bots: 3, difficulty: 'easy' }); }
  showcaseMode(m) { this.showcase?.setMode(m); }
  previewCharacter(id, custom) { this.showcase?.setCharacter(resolveLook(id, custom)); }
  previewWeapon(id, build) { this.showcase?.setWeapon(id, build); }
  checkOrientation() { document.body.classList.toggle('portrait', innerHeight > innerWidth); document.body.classList.toggle('standalone', !!(navigator.standalone || matchMedia('(display-mode: standalone)').matches)); }

  me() { const p = getProfile(); return { name: p.name, charId: p.character, custom: p.custom[p.character] || {}, loadout: p.loadouts[p.activeLoadout] }; }

  // ---------------- match lifecycle ----------------
  async startMatch(settings, net = null) {
    if (this.state === 'loading') return;
    this.state = 'loading';
    if (getProfile().settings.fullscreen || this.touch) this.enterFullscreen(); // must run inside the click that started the match
    audio.init(); audio.stopMenuMusic();
    const boot = document.getElementById('boot'), fill = document.getElementById('boot-fill'), txt = document.getElementById('boot-text');
    boot.classList.remove('hidden'); fill.style.width = '0%'; this.menu.hide();
    const me = this.me(); const role = net?.role || 'solo';
    const s = { ...settings, loadout: me.loadout, mapSeed: 7 };
    if (role === 'solo') s.roster = [{ local: true, name: me.name, charId: me.charId, custom: me.custom, look: resolveLook(me.charId, me.custom), loadout: me.loadout }];
    else if (role === 'host') s.roster = this.room.players.map((p) => ({ local: p.peerId === 'host', name: p.name, charId: p.charId, custom: p.custom, look: resolveLook(p.charId, p.custom), peerId: p.peerId === 'host' ? null : p.peerId, loadout: p.loadout }));
    const ModeClass = MODE_CLASSES[s.mode] || MODE_CLASSES.ffa;
    const match = new Match({ gfx: this.gfx, settings: s, role, seed: net?.seed, ModeClass });
    match.itemLabel = itemLabel;
    try { await match.load((p, t) => { fill.style.width = (p * 100).toFixed(0) + '%'; txt.textContent = t; }); }
    catch (e) { console.error(e); txt.textContent = 'Failed to load match: ' + e.message; this.state = 'menu'; setTimeout(() => { boot.classList.add('hidden'); this.menu.show('main', false); this.gfx.setupScene && this.gfx.setupComposer(this.showcase.scene); }, 2500); return; }
    this.match = match;
    if (role !== 'solo') {
      const sync = new NetSync(match, this.room); sync.makeCtrl = (c) => this.attachCtrl(c, me.loadout);
      if (role === 'client') {
        txt.textContent = 'Syncing with host…'; this.room.send(null, { t: 'ready' });
        const resend = setInterval(() => this.room.send(null, { t: 'ready' }), 1000); // host may still be loading
        const ok = await new Promise((res) => { const off = match.events.on('netready', () => { off(); res(true); }); setTimeout(() => res(false), 30000); });
        clearInterval(resend);
        if (!ok) { txt.textContent = 'Host did not respond.'; setTimeout(() => this.leaveMatch(false), 1500); return; }
      } else {
        txt.textContent = 'Waiting for players to load…';
        const need = this.room.players.filter((p) => p.peerId !== 'host').map((p) => p.peerId);
        const t0 = performance.now(); while (need.some((p) => !sync.ready.has(p)) && performance.now() - t0 < 20000) await new Promise((r) => setTimeout(r, 200));
        for (const p of need) if (!sync.ready.has(p)) { const c = match.combatants.find((x) => x.peerId === p); if (c) match.removeCombatant(c); }
      }
    }
    const L = match.local; if (L && L.ctrl) this.attachCtrl(L, me.loadout, L.ctrl);
    boot.classList.add('hidden');
    this.hud = new HUD(document.getElementById('hud'), match, { touch: this.touch, onDeathAction: (a) => this.deathAction(a), locked: () => this.touch || this.input.locked || this.input.lockFailed, skipStep: () => this.input.pressed.add('skip') });
    match.events.on('end', (res) => this.onMatchEnd(res));
    match.events.on('died', () => { if (match.mode.respawnDelay < 0) { this.input.exitLock(); } });
    this.input.enabled = true;
    if (this.touch) {
      const t = document.getElementById('touch'); t.classList.remove('hidden'); this.input.setupTouch(t); this.input.setButtonVisible('fire2', true);
      if (s.mode === 'training') { const b = document.createElement('div'); b.className = 'tbtn tb-skip'; b.textContent = 'Skip'; b.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); this.input.pressed.add('skip'); }, { passive: false }); t.append(b); }
    }
    else this.input.requestLock();
    audio.startAmbience(match.map.env.ambience);
    this.state = 'match'; this.matchStart = performance.now();
    this.statsT = 0;
  }
  attachCtrl(c, loadout, existing) {
    const ctrl = existing || new PlayerController(this.match, c, loadout); c.ctrl = ctrl; ctrl.onPause = () => this.openPause(); return ctrl;
  }
  enterFullscreen() {
    const el = document.documentElement; if (document.fullscreenElement || !el.requestFullscreen) return;
    el.requestFullscreen({ navigationUI: 'hide' }).then(() => { navigator.keyboard?.lock?.(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ControlLeft', 'Escape']).catch(() => {}); }).catch(() => {});
  }
  openPause() {
    if (this.state !== 'match' || this.pauseEl || !this.match || this.match.ended) return;
    if (this.match.local && !this.match.local.alive && this.match.mode.respawnDelay < 0) return; // BR death screen handles itself
    this.input.enabled = false; this.input.exitLock(); if (this.match.role === 'solo') this.match.paused = true;
    this.pauseEl = this.menu.pause(() => { this.pauseEl = null; this.match.paused = false; this.input.enabled = true; if (!this.touch) this.input.requestLock(); }, () => { this.pauseEl = null; this.leaveMatch(true); });
  }
  deathAction(a) {
    const m = this.match; if (!m) return; const L = m.local;
    if (a === 'leave') { this.leaveMatch(true); return; }
    if (a === 'spectate' || a === 'next') {
      const alive = m.combatants.filter((c) => c.alive && c !== L); if (!alive.length) return;
      const cur = alive.findIndex((c) => c.id === L.ctrl.spectate); let next = a === 'spectate' && L.lastAttacker?.alive ? L.lastAttacker : alive[(cur + 1) % alive.length];
      L.ctrl.spectate = next.id; L.ctrl.spectating = true; m.spectating = next.id; this.hud.setSpectating(next);
    }
  }

  onMatchEnd(res) {
    const m = this.match; if (!m || this.endHandled) return; this.endHandled = true;
    const L = m.local;
    const winners = m.combatants.filter((c) => c.alive !== false && (res.winnerId === c.id || (res.winnerTeam != null && c.team === res.winnerTeam)));
    for (const c of winners) { c.emote = true; c.alive = true; }
    const star = winners.find((c) => c === L) || winners[0];
    if (star && L?.ctrl) { L.ctrl.winnerId = star.id; m.spectating = star.id; this.hud?.hideDeath(); }
    this.input.exitLock();
    setTimeout(() => this.finishToResults(res), res.won ? 4500 : 3500);
  }
  finishToResults(res) {
    const m = this.match; if (!m) return; const L = m.local; const st = L.stats;
    if (!res) { const alive = m.combatants.filter((c) => c.alive).length; L.place = L.place || (m.mode.id === 'br' ? alive + (L.alive ? 0 : 1) : 0); res = { mode: m.mode.id, won: false, winnerName: '—', reason: 'Left the match', scoreboard: m.mode.scoreboard() }; }
    const br = res.mode === 'br'; const mins = (performance.now() - this.matchStart) / 60000;
    if (res.mode === 'training') return this.finishTraining(res, L, mins);
    const xpLines = [['Match completed', 200], ['Eliminations', st.kills * 100], ['Headshots', st.headshots * 25], ['Assists', st.assists * 25]];
    if (res.won) xpLines.push([br ? 'Last one standing' : 'Win', br ? 1500 : 1000]);
    if (br && L.place) xpLines.push([`Placement #${L.place}`, Math.max(0, 51 - L.place) * 15]);
    xpLines.push(['Time played', Math.round(mins * 40)]);
    const lines = xpLines.filter((l) => l[1] > 0); const xp = lines.reduce((a, l) => a + l[1], 0);
    const summary = recordMatch({ mode: res.mode === 'ffa' || res.mode === 'tdm' ? 'custom' : res.mode, map: m.map.id, won: res.won, place: br ? (L.place || 1) : 0, kills: st.kills, deaths: st.deaths, headshots: st.headshots, damage: st.damage, shots: st.shots, hits: st.hits, time: Math.round(mins * 60), xp, crates: st.crates, classKills: st.classKills, explosiveKills: st.explosiveKills, weaponXp: st.weaponXp });
    if (summary.levelAfter > summary.levelBefore) audio.levelUp();
    this.lastResults = { res, summary, xpLines: lines, me: { id: L.id, kills: st.kills, deaths: st.deaths, assists: st.assists, headshots: st.headshots, damage: st.damage, shots: st.shots, hits: st.hits, place: L.place, score: st.score, time: mins * 60 } };
    this.lastPlayed = { settings: { ...m.settings, roster: undefined, loadout: undefined }, role: m.role };
    this.teardownMatch();
    this.menu.stack = []; this.menu.show('results', false);
  }
  finishTraining(res, L, mins) {
    const p = getProfile(); const done = res.won; const before = levelInfo(p.xp).level; const xp = done ? (p.tutorialDone ? 100 : 500) : 0;
    p.xp += xp; if (done) p.tutorialDone = true; saveProfile(true);
    const summary = { xp, challengeXp: 0, challengesDone: [], achievements: [], levelBefore: before, levelAfter: levelInfo(p.xp).level };
    if (summary.levelAfter > before) audio.levelUp();
    this.lastResults = { res: { ...res, reason: done ? 'Training complete. You are ready to play!' : 'Training ended early' }, summary, xpLines: xp ? [['Training completed', xp]] : [], me: { id: L.id, kills: L.stats.kills, deaths: L.stats.deaths, assists: 0, headshots: L.stats.headshots, damage: L.stats.damage, shots: L.stats.shots, hits: L.stats.hits, place: 0, score: L.stats.score, time: mins * 60 } };
    this.lastPlayed = { settings: { mode: 'training', map: 'beach' }, role: 'solo' };
    this.teardownMatch(); this.menu.stack = []; this.menu.show('results', false);
  }
  leaveMatch(record) {
    if (!this.match) return;
    if (this.match.role !== 'solo') { this.leaveRoom(); }
    if (record && !this.endHandled) { this.finishToResults(null); return; }
    this.teardownMatch(); this.menu.show('main', false);
  }
  teardownMatch() {
    const m = this.match; if (!m) return;
    this.input.enabled = false; this.input.exitLock(); this.input.teardownTouch(); document.getElementById('touch').classList.add('hidden');
    this.hud?.dispose(); this.hud = null; m.local?.ctrl?.dispose(); m.dispose(); this.match = null; this.endHandled = false;
    if (this.pauseEl) { this.pauseEl.remove(); this.pauseEl = null; }
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    this.state = 'menu'; this.gfx.setupComposer(this.showcase.scene); this.gfx.renderer.toneMappingExposure = 0.95; this.gfx.resize();
    audio.stopAmbience(); audio.startMenuMusic();
    if (this.room && this.room.closed) this.room = null;
  }
  playAgain() {
    const lp = this.lastPlayed; if (!lp) { this.menu.show('main', false); return; }
    if (lp.role !== 'solo') { this.menu.show('custom', false); return; }
    const s = { ...lp.settings }; delete s.roster; this.startMatch(s);
  }

  // ---------------- rooms ----------------
  async createRoom(settings, net) {
    try {
      this.room = await Room.host(settings, net, this.me()); this.bindRoom(); this.menu.show('lobby');
    } catch (e) { alert('Could not create room: ' + e.message); }
  }
  async joinRoom(code, net) {
    if (this.room) this.leaveRoom();
    this.room = await Room.join(code, net, this.me()); this.bindRoom(); this.menu.show('lobby');
  }
  bindRoom() {
    const r = this.room;
    r.on('update', () => { if (this.menu.screen === 'lobby' && this.state === 'menu') this.menu.show('lobby', false); });
    r.on('start', (msg) => { if (!r.isHost) this.startMatch({ ...msg.settings }, { role: 'client', seed: msg.seed }); });
    r.on('closed', (why) => { if (this.state === 'match') { this.hud?.toast(why, 'bad'); setTimeout(() => this.leaveMatch(true), 1500); } else { alert(why); this.room = null; this.menu.show('custom', false); } });
  }
  hostStart() { const seed = Math.floor(Math.random() * 1e9); this.room.start(seed); this.startMatch({ ...this.room.settings }, { role: 'host', seed }); }
  leaveRoom() { this.room?.leave(); this.room = null; }

  // ---------------- main loop ----------------
  loop(t) {
    requestAnimationFrame((tt) => this.loop(tt));
    const now = performance.now(); let dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    if (this.state === 'match' && this.match) {
      const m = this.match; const inp = this.input.poll();
      if (!m.paused) {
        const L = m.local;
        if (L && L.ctrl) L.ctrl.update(dt, inp);
        m.update(dt);
        if (m.mode.tutorialTick) m.mode.tutorialTick(dt, inp);
        this.hud?.update(dt, inp);
        const cam = this.gfx.camera; this.gfx.followShadow(cam.position); m.map.builder.cull(cam.position, this.gfx.q.drawDist);
        const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion); audio.setListener(cam.position, fwd);
        // automatic quality adaptation
        const r = this.gfx.trackFrame(dt, now / 1000);
        if (r && r !== 'res') { this.gfx.downgradeTo(r, m.scene); this.hud?.toast(`Graphics lowered to ${PRESETS[r].name} for smoother play`, 'info'); }
      }
      this.gfx.render(m.scene, !!(m.local && m.local.alive && !m.local.dropping));
    } else if (this.showcase) {
      this.showcase.update(dt); this.showcase.render();
    }
  }
}

// Fine thumbprint grain for every clay surface: a small tile painted once and shared through a CSS variable.
function makeClayGrain() {
  try {
    const c = document.createElement('canvas'); c.width = c.height = 160; const x = c.getContext('2d');
    for (let i = 0; i < 900; i++) { x.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(29,34,66,0.05)'; x.beginPath(); x.arc(Math.random() * 160, Math.random() * 160, 0.6 + Math.random() * 1.6, 0, 7); x.fill(); }
    x.lineWidth = 1.2;
    for (let k = 0; k < 5; k++) { const cx = Math.random() * 160, cy = Math.random() * 160; for (let r = 4; r < 22; r += 3.2) { x.strokeStyle = 'rgba(29,34,66,0.035)'; x.beginPath(); x.ellipse(cx, cy, r, r * 0.72, k, 0, 7); x.stroke(); } }
    document.documentElement.style.setProperty('--grain', `url(${c.toDataURL('image/png')})`);
  } catch (e) { /* plain color fallback */ }
}

const app = new App(); window.CLAYFRONT = app;
app.boot().catch((e) => { console.error(e); document.getElementById('boot-text').textContent = 'Failed to start: ' + e.message; });
