// In-match HUD (DOM + 2 canvases): crosshair, health/armor, ammo, killfeed, minimap, compass, notifications, scoreboard, map.
import * as THREE from 'three';
import { WEAPON_MAP, RARITY, GUN_GAME_ORDER, LETHALS, TACTICALS, GEAR } from '../data/weapons.js';
import { HEALS, itemLabel } from '../game/loot.js';
import { formatTime, clamp } from '../core/util.js';
import { getProfile } from '../core/save.js';
import { currentSpread } from '../entities/weaponLogic.js';

const V = new THREE.Vector3();
const h = (tag, cls, html = '') => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class HUD {
  constructor(root, match, handlers) {
    this.root = root; this.m = match; this.H = handlers; root.innerHTML = ''; root.classList.remove('hidden');
    root.innerHTML = `
      <canvas class="hud-overlay"></canvas>
      <div class="vignette dmg"></div><div class="vignette low"></div><div class="vignette zone"></div><div class="flashbang"></div>
      <div class="scope"><div class="scope-ring"></div><div class="scope-h"></div><div class="scope-v"></div></div>
      <div class="xhair"><i class="t"></i><i class="b"></i><i class="l"></i><i class="r"></i><b></b></div>
      <div class="hitmark"><i></i><i></i><i></i><i></i></div>
      <div class="dmgdirs"></div>
      <div class="compass"><div class="compass-strip"></div><div class="compass-tick"></div></div>
      <div class="minimap"><canvas width="180" height="180"></canvas></div>
      <div class="modebox"></div>
      <div class="killfeed"></div>
      <div class="medals"></div>
      <div class="notify"></div>
      <div class="prompt"></div>
      <div class="channel"><div class="ch-label"></div><div class="ch-bar"><i></i></div></div>
      <div class="vitals"><div class="v-name"></div><div class="bar armor"><i></i><span></span></div><div class="bar hp"><i></i><span></span></div><div class="inv"></div></div>
      <div class="weaponbox"><div class="w-name"></div><div class="w-ammo"><b class="mag"></b><span class="res"></span></div><div class="w-slots"></div><div class="w-equip"></div></div>
      <div class="ggbar"></div>
      <div class="countdown"></div>
      <div class="fps"></div>
      <div class="death hidden"></div>
      <div class="scores hidden"></div>
      <div class="bigmap hidden"><canvas></canvas><div class="bm-legend"></div></div>
      <div class="spec hidden"></div>
      <div class="clickplay hidden">Click to play<small>Left Click shoots · Right Click aims · Esc pauses</small></div>
      <div class="tutorial hidden"></div>`;
    const q = (s) => root.querySelector(s); this.q = q;
    this.el = { xh: q('.xhair'), hit: q('.hitmark'), dmgV: q('.vignette.dmg'), lowV: q('.vignette.low'), zoneV: q('.vignette.zone'), flash: q('.flashbang'), scope: q('.scope'), dirs: q('.dmgdirs'), compass: q('.compass-strip'), mini: q('.minimap canvas'), mode: q('.modebox'), feed: q('.killfeed'), medals: q('.medals'), notify: q('.notify'), prompt: q('.prompt'), ch: q('.channel'), name: q('.v-name'), armor: q('.bar.armor'), hp: q('.bar.hp'), inv: q('.inv'), wname: q('.w-name'), mag: q('.mag'), res: q('.res'), slots: q('.w-slots'), equip: q('.w-equip'), gg: q('.ggbar'), cd: q('.countdown'), fps: q('.fps'), death: q('.death'), scores: q('.scores'), big: q('.bigmap'), bigC: q('.bigmap canvas'), spec: q('.spec'), overlay: q('.hud-overlay') };
    this.ctx = this.el.mini.getContext('2d'); this.octx = this.el.overlay.getContext('2d');
    this.hitT = 0; this.dmgT = 0; this.flashT = 0; this.pings = []; this.airdrops = []; this.uiT = 0; this.mapOpen = false;
    this.buildCompass(); this.buildMapImage();
    const ev = match.events;
    this.offs = [
      ev.on('hitmarker', (e) => { this.hitT = 0.25; this.el.hit.classList.toggle('head', !!e.head); this.el.hit.classList.toggle('kill', !!e.kill); }),
      ev.on('damaged', (e) => { this.dmgT = Math.min(1, this.dmgT + e.amount / 40); if (e.from && e.from.pos) this.addDir(e.from.pos); }),
      ev.on('killfeed', (e) => this.addFeed(e)),
      ev.on('kill', (e) => this.medal(e)),
      ev.on('notify', (e) => this.toast(e.text, e.kind)),
      ev.on('ping', (p) => this.pings.push(p)),
      ev.on('airdrop', (p) => this.airdrops.push(p)),
      ev.on('stunned', (s) => { this.flashT = Math.max(this.flashT, s * 0.6); }),
      ev.on('died', (e) => this.showDeath(e)),
      ev.on('respawned', () => this.hideDeath()),
    ];
    this.resize = () => { this.el.overlay.width = innerWidth; this.el.overlay.height = innerHeight; }; this.resize(); addEventListener('resize', this.resize);
    root.classList.toggle('touch', !!handlers.touch);
  }

  buildCompass() {
    const s = this.el.compass; const marks = [];
    for (let k = -1; k <= 1; k++) for (let d = 0; d < 360; d += 15) { const lbl = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' }[d]; marks.push(`<span style="left:${(d + k * 360) * 4}px" class="${lbl ? 'card' : ''}">${lbl || d}</span>`); }
    s.innerHTML = marks.join('');
  }
  buildMapImage() {
    const w = this.m.world; const B = w.bounds; const W = Math.ceil(B.maxX - B.minX), H = Math.ceil(B.maxZ - B.minZ);
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    const beach = this.m.map.id === 'beach';
    const img = x.createImageData(W, H);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const t = w.terrain(B.minX + i, B.minZ + j); const k = (j * W + i) * 4; let r, g, b;
      if (beach) { if (t < 0) { r = 40; g = 140 + t * 20; b = 190 + t * 10; } else if (t < 1.2) { r = 230; g = 210; b = 160; } else if (t > 5) { r = 120 + t * 2; g = 120; b = 110; } else { r = 120; g = 165; b = 90; } }
      else { r = g = b = t < -1 ? 60 : 72; }
      img.data[k] = r; img.data[k + 1] = g; img.data[k + 2] = b; img.data[k + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    for (const bx of w.boxes) {
      if (bx.y1 - bx.y0 < 1.0 && !(bx.y1 < 0.3 && !beach)) continue; const tall = bx.y1 - w.terrain((bx.x0 + bx.x1) / 2, (bx.z0 + bx.z1) / 2);
      if (!beach && bx.y1 <= 0.2) { x.fillStyle = '#9a958d'; x.fillRect(bx.x0 - B.minX, bx.z0 - B.minZ, bx.x1 - bx.x0, bx.z1 - bx.z0); continue; }
      if (tall < 1.0) continue; x.fillStyle = tall > 12 ? '#3c4250' : tall > 4 ? '#5d6472' : '#7d8492'; x.fillRect(bx.x0 - B.minX, bx.z0 - B.minZ, Math.max(1, bx.x1 - bx.x0), Math.max(1, bx.z1 - bx.z0));
    }
    this.mapImg = c; this.mapW = W; this.mapH = H;
  }

  addDir(from) {
    const L = this.m.local; if (!L) return; const ang = Math.atan2(from.x - L.pos.x, from.z - L.pos.z); const rel = ang - Math.atan2(-Math.sin(L.yaw), -Math.cos(L.yaw));
    const d = h('div', 'dmgdir'); d.style.transform = `translate(-50%,-50%) rotate(${-rel}rad) translateY(-110px)`; this.el.dirs.append(d); setTimeout(() => d.remove(), 1200);
  }
  addFeed(e) {
    const wn = WEAPON_MAP[e.weapon]?.name || (e.weapon === 'zone' ? 'the storm' : e.weapon === 'fall' ? 'gravity' : e.explosive ? 'explosive' : '');
    const L = this.m.local; const mine = L && (e.killerId === L.id || e.victimId === L.id);
    const d = h('div', 'kf' + (mine ? ' mine' : ''), `${e.killer ? `<b>${esc(e.killer)}</b>${e.kBot ? '<i class="bot">BOT</i>' : ''}` : ''} <span class="kf-w">${e.head ? '🎯 ' : ''}${esc(wn)}</span> <b class="v">${esc(e.victim)}</b>${e.vBot ? '<i class="bot">BOT</i>' : ''}`);
    this.el.feed.prepend(d); while (this.el.feed.children.length > 6) this.el.feed.lastChild.remove(); setTimeout(() => d.classList.add('fade'), 5000); setTimeout(() => d.remove(), 5600);
  }
  medal(e) {
    const names = { 2: 'DOUBLE KILL', 3: 'TRIPLE KILL', 5: 'RAMPAGE', 7: 'UNSTOPPABLE', 10: 'CLAY LEGEND' };
    const lines = [`<div class="md-main">ELIMINATED <b>${esc(e.victim?.name)}</b></div>`, `<div class="md-xp">+${e.head ? 125 : 100} XP${e.head ? ' · HEADSHOT' : ''}</div>`];
    if (names[e.streak]) lines.push(`<div class="md-streak">${names[e.streak]}</div>`);
    const d = h('div', 'medal', lines.join('')); this.el.medals.prepend(d); while (this.el.medals.children.length > 3) this.el.medals.lastChild.remove(); setTimeout(() => d.remove(), 2600);
  }
  toast(text, kind = 'info') { const d = h('div', 'toast ' + kind, esc(text)); this.el.notify.append(d); while (this.el.notify.children.length > 3) this.el.notify.firstChild.remove(); setTimeout(() => d.classList.add('fade'), 2600); setTimeout(() => d.remove(), 3200); }

  showDeath(e) {
    const m = this.m; const br = m.mode.id === 'br'; const k = e.killer;
    this.deathShown = true; const el = this.el.death; el.classList.remove('hidden');
    const place = br ? `<div class="place">#${m.local.place || m.mode.state.alive + 1}<small> / ${m.mode.state.total || m.combatants.length}</small></div>` : '';
    el.innerHTML = `<div class="d-title">ELIMINATED</div>${place}<div class="d-by">${k ? `by <b>${esc(k.name)}</b>${k.isBot ? ' <i class="bot">BOT</i>' : ''}${WEAPON_MAP[e.weapon] ? ` with ${esc(WEAPON_MAP[e.weapon].name)}` : ''}` : e.weapon === 'zone' ? 'by the storm' : ''}</div>
      ${br ? `<div class="d-btns"><button class="btn" data-a="spectate">Spectate</button><button class="btn primary" data-a="leave">Leave Match</button></div>` : `<div class="d-timer">Respawning…</div>`}`;
    el.querySelectorAll('button').forEach((b) => b.onclick = () => this.H.onDeathAction(b.dataset.a));
  }
  hideDeath() { this.deathShown = false; this.el.death.classList.add('hidden'); this.el.spec.classList.add('hidden'); }
  setSpectating(c) { const s = this.el.spec; if (!c) { s.classList.add('hidden'); return; } this.el.death.classList.add('hidden'); s.classList.remove('hidden'); s.innerHTML = `Spectating <b>${esc(c.name)}</b>${c.isBot ? ' <i class="bot">BOT</i>' : ''} <button class="btn small" data-a="next">Next ▸</button><button class="btn small primary" data-a="leave">Leave</button>`; s.querySelectorAll('button').forEach((b) => b.onclick = () => this.H.onDeathAction(b.dataset.a)); }

  update(dt, inp) {
    const m = this.m, L = m.local, E = this.el; if (!L) return;
    const ctrl = L.ctrl; const w = L.weapon; const st = m.mode.hudState(); const s = getProfile().settings;
    // crosshair spread (px)
    const cam = m.gfx.camera; const spread = w ? currentSpread(L) : 0.02; const px = Math.max(3, Math.tan(spread) / Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) * innerHeight / 2);
    E.xh.style.setProperty('--gap', px.toFixed(1) + 'px'); E.xh.style.setProperty('--xc', s.crosshairColor);
    E.xh.style.opacity = m.ended || !L.alive || L.dropping || ctrl?.scoped || (L.fire.ads > 0.6 && w && w.stats.optic !== 'iron') || L.sprinting ? 0 : 1;
    E.scope.classList.toggle('on', !!ctrl?.scoped);
    this.hitT -= dt; E.hit.style.opacity = this.hitT > 0 ? 1 : 0;
    this.dmgT = Math.max(0, this.dmgT - dt * 0.8); E.dmgV.style.opacity = this.dmgT;
    E.lowV.style.opacity = L.alive && L.hp < 35 ? 0.4 + Math.sin(m.time * 6) * 0.2 : 0;
    this.flashT = Math.max(0, this.flashT - dt * 0.5); E.flash.style.opacity = Math.min(0.9, this.flashT);
    // compass
    const deg = ((-L.yaw * 180 / Math.PI) % 360 + 360) % 360; E.compass.style.transform = `translateX(${-(deg + 360) * 4}px)`;
    this.drawMinimap(L, st); if (this.mapOpen) this.drawBigMap(L, st);
    this.drawOverlay(L, st);
    this.uiT -= dt; if (this.uiT > 0) return; this.uiT = 0.08;
    this.q('.clickplay').classList.toggle('hidden', !!this.H.locked?.() || !L.alive || m.ended);
    // vitals
    E.name.textContent = L.name;
    E.hp.querySelector('i').style.width = clamp(L.hp, 0, 100) + '%'; E.hp.querySelector('span').textContent = Math.ceil(L.hp);
    E.armor.style.display = L.armor > 0 || m.mode.usePool ? '' : 'none'; E.armor.querySelector('i').style.width = clamp(L.armor, 0, 100) + '%'; E.armor.querySelector('span').textContent = Math.ceil(L.armor);
    E.inv.innerHTML = m.mode.usePool ? Object.entries(L.heals).map(([k, n]) => `<span class="${n ? '' : 'dim'}">${k === 'cell' ? '🛡' : k === 'medkit' ? '✚' : '🩹'} ${n}</span>`).join('') + Object.entries(L.ammo).filter(([, n]) => n > 0).map(([k, n]) => `<span class="am am-${k}">${n}</span>`).join('') : '';
    // weapon
    if (w) { E.wname.innerHTML = `<span style="color:${RARITY[w.rarity].color}">${esc(WEAPON_MAP[w.id].name)}</span>`; const res = L.reserveFor(w); E.mag.textContent = w.stats.ammo ? w.mag : '∞'; E.mag.classList.toggle('low', w.stats.ammo && w.mag <= Math.ceil(w.stats.mag * 0.25)); E.res.textContent = w.stats.ammo ? (res === Infinity || res > 9000 ? ' / ∞' : ' / ' + res) : ''; }
    else { E.wname.textContent = 'Fists'; E.mag.textContent = '—'; E.res.textContent = ''; }
    E.slots.innerHTML = L.slots.map((sw, i) => `<span class="${i === L.slot ? 'on' : ''}">${i + 1} ${sw ? esc(WEAPON_MAP[sw.id].name.split(' ')[0]) : '—'}</span>`).join('');
    const gear = GEAR.find((g) => g.id === L.gear);
    E.equip.innerHTML = `<span title="Lethal (G)">💣 ${L.lethal.n}</span><span title="Tactical (Q)">☁ ${L.tactical.n}</span>${gear && gear.cooldown ? `<span title="${esc(gear.name)}">${gear.id === 'pulse' ? '◉' : '✚'} ${L.gearCd > 0 ? Math.ceil(L.gearCd) + 's' : 'READY'}</span>` : ''}`;
    if (L.fire.reload > 0 && w) { E.res.textContent += ' · RELOADING'; }
    // prompt + channel
    const pr = ctrl?.prompt || ''; const dh = ctrl?.dropHint || ''; E.prompt.textContent = pr ? (this.H.touch ? '✋ ' : '[E] ') + pr : dh ? (this.H.touch ? dh.replace('Press JUMP', 'Tap ⤒') : dh.replace('JUMP', 'SPACE')) : ''; E.prompt.style.opacity = pr || dh ? 1 : 0;
    if (pr && ctrl.promptItem) E.prompt.style.color = ctrl.promptItem.type === 'weapon' ? RARITY[ctrl.promptItem.rarity].color : ''; else E.prompt.style.color = '';
    if (L.channel) { E.ch.classList.add('on'); E.ch.querySelector('.ch-label').textContent = 'Using ' + HEALS[L.channel.kind].name; E.ch.querySelector('i').style.width = (L.channel.t / L.channel.dur * 100) + '%'; } else E.ch.classList.remove('on');
    // mode box
    this.modeBox(L, st);
    const tu = st.tutorial; const tel = this.q('.tutorial'); tel.classList.toggle('hidden', !tu || m.ended);
    if (tu) { const key = tu.i + '|' + this.H.touch; if (this._tuKey !== key) { this._tuKey = key; tel.innerHTML = `<div class="tu-step">TRAINING · STEP ${tu.i + 1} OF ${tu.n}</div><div class="tu-title">${esc(tu.title)}</div><div class="tu-text">${tu.text}</div><div class="tu-bar"><i style="width:${(tu.i / tu.n * 100).toFixed(0)}%"></i></div><div class="tu-skip">${this.H.touch ? 'Tap <b>Skip ▸</b> to skip this step' : 'Press <kbd>Enter</kbd> to skip this step'}</div>`; tel.classList.remove('done'); void tel.offsetWidth; tel.classList.add('done'); } }
    E.cd.textContent = st.countdown > 0 ? st.countdown : ''; E.cd.style.display = st.countdown > 0 ? '' : 'none';
    E.fps.style.display = s.showFps ? '' : 'none'; if (s.showFps) E.fps.textContent = `${Math.round(m.gfx.fps)} FPS · ${m.gfx.q.name}${m.gfx.dynScale < 1 ? ` · ${Math.round(m.gfx.dynScale * 100)}%` : ''}`;
    // zone vignette
    const z = st.zone; E.zoneV.style.opacity = z && L.alive && Math.hypot(L.pos.x - z.x, L.pos.z - z.z) > z.r ? 0.6 : 0;
    // scoreboard / map
    const showScores = inp?.scores || this.m.ended; E.scores.classList.toggle('hidden', !inp?.scores); if (inp?.scores) this.drawScores();
    if (inp?.map) { this.mapOpen = !this.mapOpen; E.big.classList.toggle('hidden', !this.mapOpen); }
    if (this.deathShown && m.mode.respawnDelay >= 0) { const t = Math.max(0, L.respawnAt - m.time); const dt2 = this.el.death.querySelector('.d-timer'); if (dt2) dt2.textContent = `Respawning in ${t.toFixed(1)}s`; }
  }
  modeBox(L, st) {
    const m = this.m; const id = m.mode.id; let html = '';
    if (id === 'br') {
      const z = st.zone; const out = z && Math.hypot(L.pos.x - z.x, L.pos.z - z.z) > z.r;
      html = `<div class="mb-row"><span class="mb-big">👥 ${st.alive ?? '-'}</span><span>ALIVE</span><span class="mb-big">☠ ${L.stats.kills}</span><span>KILLS</span></div>` +
        (st.phase >= 0 ? `<div class="mb-zone ${st.zoneShrinking ? 'shrink' : ''} ${out ? 'out' : ''}">${st.zoneShrinking ? 'ZONE CLOSING' : 'ZONE SHRINKS IN'} ${formatTime(st.zoneTimer || 0)}${out ? ' · OUTSIDE ZONE!' : ''}</div>` : `<div class="mb-zone">${L.dropping?.inPlane ? 'Choose your drop: press JUMP' : 'Storm forming…'}</div>`);
    } else if (id === 'gg') {
      const total = GUN_GAME_ORDER.length; const lvl = Math.min(L.ggLevel, total - 1);
      html = `<div class="mb-row"><span class="mb-big">${lvl + 1}/${total}</span><span>WEAPON</span><span class="mb-big">${formatTime(st.time || 0)}</span></div><div class="mb-sub">Leader: ${(st.lead ?? 0) + 1}/${total}</div>`;
      const next = GUN_GAME_ORDER[lvl + 1]; this.el.gg.innerHTML = GUN_GAME_ORDER.map((wid, i) => `<i class="${i < lvl ? 'done' : i === lvl ? 'cur' : ''}" title="${esc(WEAPON_MAP[wid].name)}"></i>`).join('') + `<span>${next ? 'NEXT: ' + esc(WEAPON_MAP[next].name) : 'FINAL WEAPON — GET A KNIFE KILL!'}</span>`;
    } else if (id === 'training') {
      html = `<div class="mb-row"><span class="mb-big">${L.stats.kills}</span><span>DUMMIES DOWN</span></div><div class="mb-sub">Training mode · dummies don't shoot back</div>`;
    } else if (id === 'tdm') {
      const ts = st.teamScore || [0, 0]; const my = L.team;
      html = `<div class="mb-row"><span class="mb-big team0 ${my === 0 ? 'mine' : ''}">${ts[0]}</span><span>CORAL vs NEON</span><span class="mb-big team1 ${my === 1 ? 'mine' : ''}">${ts[1]}</span></div><div class="mb-sub">First to ${st.limit} · ${formatTime(st.time || 0)}</div>`;
    } else {
      html = `<div class="mb-row"><span class="mb-big">${L.stats.kills}</span><span>KILLS</span><span class="mb-big">${formatTime(st.time || 0)}</span></div><div class="mb-sub">Leader: ${esc(st.leader || '-')} (${st.leaderKills ?? 0}/${st.limit})</div>`;
    }
    this.el.mode.innerHTML = html; this.el.gg.style.display = id === 'gg' ? '' : 'none';
  }
  drawScores() {
    const m = this.m; const rows = m.mode.scoreboard(); const id = m.mode.id;
    const head = id === 'gg' ? '<th>Weapon</th>' : id === 'br' ? '<th>Status</th>' : '';
    this.el.scores.innerHTML = `<div class="sb-title">${esc(m.mode.name)} · ${esc(m.map.name)}</div><table><tr><th>#</th><th>Player</th>${head}<th>K</th><th>D</th><th>A</th><th>Score</th></tr>${rows.slice(0, 20).map((r, i) => `<tr class="${r.local ? 'me' : ''} ${r.alive ? '' : 'dead'} ${r.team >= 0 ? 'team' + r.team : ''}"><td>${i + 1}</td><td>${esc(r.name)}${r.bot ? ' <i class="bot">BOT</i>' : ''}</td>${id === 'gg' ? `<td>${Math.min(r.level + 1, GUN_GAME_ORDER.length)}</td>` : id === 'br' ? `<td>${r.alive ? 'Alive' : '#' + r.place}</td>` : ''}<td>${r.kills}</td><td>${r.deaths}</td><td>${r.assists}</td><td>${r.score}</td></tr>`).join('')}</table>${rows.length > 20 ? `<div class="sb-more">+${rows.length - 20} more</div>` : ''}`;
  }
  drawMinimap(L, st) {
    const x = this.ctx; const S = 180, R = S / 2, scale = 1.4; const m = this.m; const B = m.world.bounds;
    x.save(); x.clearRect(0, 0, S, S); x.beginPath(); x.arc(R, R, R - 2, 0, Math.PI * 2); x.clip();
    x.fillStyle = '#10141c'; x.fillRect(0, 0, S, S);
    x.translate(R, R); x.rotate(L.yaw); x.scale(scale, scale); x.translate(-(L.pos.x - B.minX), -(L.pos.z - B.minZ));
    x.globalAlpha = 0.85; x.drawImage(this.mapImg, 0, 0); x.globalAlpha = 1;
    const wx = (p) => p.x - B.minX, wz = (p) => p.z - B.minZ;
    if (st.zone) { x.lineWidth = 2 / scale; x.strokeStyle = '#ffffff'; x.beginPath(); x.arc(st.zone.x - B.minX, st.zone.z - B.minZ, st.zone.r, 0, Math.PI * 2); x.stroke(); x.strokeStyle = '#4fd1ff'; x.setLineDash([4, 3]); x.beginPath(); x.arc(st.zone.tx - B.minX, st.zone.tz - B.minZ, st.zone.tr, 0, Math.PI * 2); x.stroke(); x.setLineDash([]); }
    const now = m.time; this.pings = this.pings.filter((p) => now - p.t < 1.6);
    for (const p of this.pings) { x.fillStyle = `rgba(255,70,70,${1 - (now - p.t) / 1.6})`; x.beginPath(); x.arc(wx(p), wz(p), 2.6 / scale * 1.6, 0, 7); x.fill(); }
    for (const c of m.combatants) { if (c === L || !c.alive) continue; const ally = L.team >= 0 && c.team === L.team; if (!ally && !(c.revealUntil > now)) continue; x.fillStyle = ally ? '#4fd1ff' : '#ff3b3b'; x.beginPath(); x.arc(wx(c.pos), wz(c.pos), 3 / scale * 1.4, 0, 7); x.fill(); }
    for (const d of this.airdrops) { x.fillStyle = '#ffd23f'; x.fillRect(wx(d) - 3, wz(d) - 3, 6, 6); }
    x.restore();
    // player arrow
    x.fillStyle = '#ffd23f'; x.beginPath(); x.moveTo(R, R - 8); x.lineTo(R + 5.5, R + 6); x.lineTo(R, R + 3); x.lineTo(R - 5.5, R + 6); x.closePath(); x.fill();
    x.strokeStyle = 'rgba(255,255,255,0.35)'; x.lineWidth = 2; x.beginPath(); x.arc(R, R, R - 2, 0, Math.PI * 2); x.stroke();
    x.fillStyle = '#fff'; x.font = 'bold 12px sans-serif'; x.textAlign = 'center'; const nA = L.yaw; x.fillText('N', R + Math.sin(nA) * (R - 12) * -1 * -1, R - Math.cos(nA) * (R - 12));
  }
  drawBigMap(L, st) {
    const c = this.el.bigC; const S = Math.min(innerWidth, innerHeight) * 0.86; if (c.width !== Math.round(S)) { c.width = c.height = Math.round(S); }
    const x = c.getContext('2d'); const m = this.m; const B = m.world.bounds; const k = S / Math.max(this.mapW, this.mapH);
    x.clearRect(0, 0, S, S); x.save(); x.scale(k, k); x.drawImage(this.mapImg, 0, 0);
    if (st.zone) { x.lineWidth = 2 / k; x.strokeStyle = '#fff'; x.beginPath(); x.arc(st.zone.x - B.minX, st.zone.z - B.minZ, st.zone.r, 0, 7); x.stroke(); x.strokeStyle = '#4fd1ff'; x.setLineDash([6, 4]); x.beginPath(); x.arc(st.zone.tx - B.minX, st.zone.tz - B.minZ, st.zone.tr, 0, 7); x.stroke(); x.setLineDash([]); }
    if (st.planeStart && L.dropping) { x.strokeStyle = '#ffd23f'; x.lineWidth = 2 / k; x.beginPath(); x.moveTo(st.planeStart.x - B.minX, st.planeStart.z - B.minZ); x.lineTo(st.planeStart.x + st.planeDir.x * st.planeLen - B.minX, st.planeStart.z + st.planeDir.z * st.planeLen - B.minZ); x.stroke(); }
    for (const d of this.airdrops) { x.fillStyle = '#ffd23f'; x.fillRect(d.x - B.minX - 4, d.z - B.minZ - 4, 8, 8); }
    for (const cc of m.combatants) if (cc !== L && cc.alive && L.team >= 0 && cc.team === L.team) { x.fillStyle = '#4fd1ff'; x.beginPath(); x.arc(cc.pos.x - B.minX, cc.pos.z - B.minZ, 4, 0, 7); x.fill(); }
    x.translate(L.pos.x - B.minX, L.pos.z - B.minZ); x.rotate(-L.yaw); x.fillStyle = '#ffd23f'; x.beginPath(); x.moveTo(0, -9); x.lineTo(6, 7); x.lineTo(0, 3); x.lineTo(-6, 7); x.closePath(); x.fill();
    x.restore();
    this.q('.bm-legend').innerHTML = `${esc(m.map.name)} · <span style="color:#fff">◯ zone</span> · <span style="color:#4fd1ff">◌ next zone</span> · <span style="color:#ffd23f">■ supply drop</span> · press M to close`;
  }
  drawOverlay(L, st) {
    const x = this.octx; const W = this.el.overlay.width, H = this.el.overlay.height; const m = this.m; const cam = m.gfx.camera; const now = m.time;
    const need = this.airdrops.length || m.combatants.some((c) => c.alive && c !== L && (c.revealUntil > now || (L.team >= 0 && c.team === L.team)));
    if (!need && !this.overlayDirty) return; x.clearRect(0, 0, W, H); this.overlayDirty = need;
    const mark = (p, y, color, label, size = 8) => { V.set(p.x, y, p.z).project(cam); if (V.z > 1) return; const sx = (V.x * 0.5 + 0.5) * W, sy = (-V.y * 0.5 + 0.5) * H; x.fillStyle = color; x.beginPath(); x.moveTo(sx, sy - size); x.lineTo(sx + size, sy); x.lineTo(sx, sy + size); x.lineTo(sx - size, sy); x.closePath(); x.fill(); if (label) { x.font = 'bold 12px sans-serif'; x.textAlign = 'center'; x.fillText(label, sx, sy - size - 4); } };
    for (const c of m.combatants) {
      if (c === L || !c.alive) continue; const ally = L.team >= 0 && c.team === L.team;
      if (c.revealUntil > now && !ally) mark(c.pos, c.pos.y + 2.2, 'rgba(255,60,60,0.9)', '', 7);
      if (ally || (c.kind === 'remote' || c.kind === 'puppet') && !c.isBot && L.team >= 0 && c.team === L.team) mark(c.pos, c.pos.y + 2.3, '#4fd1ff', c.name, 5);
    }
    for (const d of this.airdrops) { const dist = Math.hypot(d.x - L.pos.x, d.z - L.pos.z); mark(d, (m.world.terrain(d.x, d.z) || 0) + 3, '#ffd23f', `SUPPLY ${Math.round(dist)}m`, 6); }
  }
  dispose() { this.offs.forEach((f) => f()); removeEventListener('resize', this.resize); this.root.innerHTML = ''; this.root.classList.add('hidden'); }
}
