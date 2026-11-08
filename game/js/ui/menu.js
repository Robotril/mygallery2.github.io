// Menu UI: main menu, mode setup, custom rooms/lobby, characters, loadouts, armory, profile, stats, settings, results, pause.
import { CHARACTERS, CHAR_MAP, HELMETS, MASKS, HAIR, ACCESSORIES, PALETTE, resolveLook } from '../data/characters.js';
import { WEAPONS, WEAPON_MAP, CLASS_NAMES, PRIMARY_CLASSES, ATTACHMENTS, allowedAttachments, SKINS, weaponLevel, WEAPON_XP_PER_LEVEL, LETHALS, TACTICALS, PERKS, GEAR, GUN_GAME_ORDER, buildStats } from '../data/weapons.js';
import { getProfile, saveProfile, levelInfo, challengeDefs, ACHIEVEMENTS, resetProfile, DEFAULT_SETTINGS } from '../core/save.js';
import { PRESETS } from '../engine/graphics.js';
import { SKILLS } from '../game/match.js';
import { audio } from '../engine/audio.js';
import { openLayoutEditor } from '../engine/input.js';
import { formatTime, isValidRoomCode } from '../core/util.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MAPS = [{ id: 'beach', name: 'Coral Cove', sub: 'Tropical resort island', img: 'linear-gradient(135deg,#3ad6c8,#f3dfb2 60%,#ff8c42)' }, { id: 'city', name: 'Neon Harbor', sub: 'Downtown at golden hour', img: 'linear-gradient(135deg,#2b3442,#ff2bd6 55%,#ffb27a)' }];
const MODES = [{ id: 'ffa', name: 'Free-for-All' }, { id: 'tdm', name: 'Team Deathmatch' }, { id: 'gg', name: 'Gun Game' }, { id: 'br', name: 'Battle Royale' }];

export class Menu {
  constructor(root, app) { this.root = root; this.app = app; this.screen = null; this.stack = []; this.custom = { name: 'My Clay Room', mode: 'ffa', map: 'beach', bots: 7, difficulty: 'normal', timeLimit: 8, scoreLimit: 25, maxPlayers: 8, allowed: [], net: 'online', largeArena: false, brPlayers: 50 }; this.sel = { mode: 'br', map: 'beach', difficulty: 'normal', ggBots: 9, ggTime: 10 }; this.editLoadout = getProfile().activeLoadout; this.armory = 'sentinel'; this.charSel = getProfile().character; }
  get P() { return getProfile(); }

  show(name, push = true) {
    if (push && this.screen && this.screen !== name) this.stack.push(this.screen);
    this.screen = name; this.root.classList.remove('hidden'); const fn = this['s_' + name];
    this.root.innerHTML = `<div class="menu screen-${name}">${this.topbar()}<div class="m-body">${fn.call(this)}</div></div>`;
    this.bind(); this.app.showcaseMode(name === 'characters' ? 'character' : name === 'weapons' ? 'weapons' : name === 'loadouts' ? 'loadout' : 'main');
    if (name === 'characters') this.app.previewCharacter(this.charSel, this.P.custom[this.charSel] || {});
    else this.app.previewCharacter(this.P.character, this.P.custom[this.P.character] || {});
    if (name === 'weapons') this.app.previewWeapon(this.armory, this.buildFor(this.armory));
    this.after?.(); this.after = null;
  }
  back() { const prev = this.stack.pop() || 'main'; this.show(prev, false); }
  hide() { this.root.classList.add('hidden'); this.root.innerHTML = ''; }
  topbar() {
    const L = levelInfo(); const p = this.P;
    return `<div class="topbar"><div class="logo" data-go="main">CLAY<span>FRONT</span></div>
      <div class="tb-player" data-go="profile"><div class="tb-lvl">${L.level}</div><div><div class="tb-name">${esc(p.name)}</div><div class="xpbar"><i style="width:${(L.pct * 100).toFixed(1)}%"></i></div></div></div>
      ${this.screen !== 'main' ? '<button class="btn ghost back" data-act="back">◂ Back</button>' : ''}</div>`;
  }
  bind() {
    const r = this.root;
    r.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => { audio.click(); this.show(b.dataset.go); }));
    r.querySelectorAll('[data-act]').forEach((b) => { const ev = b.tagName === 'SELECT' || b.type === 'checkbox' ? 'change' : 'click'; b.addEventListener(ev, (e) => { audio.click(); this.act(b.dataset.act, b, e); }); });
    r.querySelectorAll('button, .card, .tile').forEach((b) => b.addEventListener('mouseenter', () => audio.hover()));
    r.querySelectorAll('input[data-set]').forEach((i) => i.addEventListener('input', () => this.setSetting(i)));
    r.querySelectorAll('select[data-set]').forEach((i) => i.addEventListener('change', () => this.setSetting(i)));
    r.querySelectorAll('[data-custom]').forEach((i) => i.addEventListener(i.tagName === 'SELECT' || i.type === 'checkbox' ? 'change' : 'input', () => { const k = i.dataset.custom; this.custom[k] = i.type === 'checkbox' ? i.checked : i.type === 'number' || i.type === 'range' ? Number(i.value) : i.value; const out = r.querySelector(`[data-out="${k}"]`); if (out) out.textContent = i.value; if (k === 'mode') this.show('custom', false); }));
    r.querySelectorAll('[data-sel]').forEach((i) => i.addEventListener('input', () => { this.sel[i.dataset.sel] = Number(i.value); const out = r.querySelector(`[data-out="${i.dataset.sel}"]`); if (out) out.textContent = i.value; }));
    const drag = r.querySelector('.drag-zone'); if (drag) { let lx = null; drag.addEventListener('pointerdown', (e) => { lx = e.clientX; drag.setPointerCapture(e.pointerId); }); drag.addEventListener('pointermove', (e) => { if (lx !== null) { this.app.showcase.drag(e.clientX - lx); lx = e.clientX; } }); drag.addEventListener('pointerup', () => { lx = null; }); }
  }
  setSetting(i) {
    const s = this.P.settings; const k = i.dataset.set; const v = i.type === 'checkbox' ? i.checked : i.type === 'range' ? Number(i.value) : i.value;
    s[k] = v; saveProfile(); const out = this.root.querySelector(`[data-out="${k}"]`); if (out) out.textContent = typeof v === 'number' ? (Math.round(v * 100) / 100) : v;
    if (['master', 'sfx', 'music', 'ambience'].includes(k)) audio.setVolumes(s);
    if (k === 'graphics' || k === 'renderScale') { this.app.applyGraphics(); if (k === 'graphics') this.show(this.screen, false); }
  }

  // ---------------- screens ----------------
  s_main() {
    const ch = challengeDefs();
    return `<div class="main-left">
      <button class="btn huge primary" data-act="play-br"><b>BATTLE ROYALE</b><small>50 combatants · 1 player + 49 AI</small></button>
      <button class="btn huge" data-act="play-gg"><b>GUN GAME</b><small>20 weapons · first to the knife wins</small></button>
      <button class="btn huge" data-go="custom"><b>CUSTOM MATCH</b><small>Rooms, join codes, invite links, bots</small></button>
      <div class="nav-grid">
        <button class="btn tile" data-go="characters">🧑‍🎤<span>Characters</span></button><button class="btn tile" data-go="loadouts">🎒<span>Loadouts</span></button>
        <button class="btn tile" data-go="weapons">🔫<span>Armory</span></button><button class="btn tile" data-go="profile">🪪<span>Profile</span></button>
        <button class="btn tile" data-go="stats">📊<span>Statistics</span></button><button class="btn tile" data-go="settings">⚙️<span>Settings</span></button>
      </div></div>
      <div class="main-right"><div class="panel"><h3>Daily Challenges</h3>${ch.map((c) => `<div class="chal ${c.done ? 'done' : ''}"><div>${esc(c.text)}</div><div class="cbar"><i style="width:${(c.progress / c.goal * 100).toFixed(0)}%"></i></div><small>${c.progress}/${c.goal} · ${c.xp} XP${c.done ? ' ✓' : ''}</small></div>`).join('')}</div>
      <div class="panel hint">${this.app.touch ? 'Touch controls: left stick to move, drag right side to look. Customize buttons in Settings → Touch.' : 'WASD move · Mouse look · LMB fire · RMB aim · R reload · Space jump · Shift sprint · Ctrl/C crouch & slide · E interact · G grenade · Q tactical · V melee · H heal · X gear · Tab scores · M map · Esc pause'}</div></div>`;
  }
  s_br() {
    return `<h2>Battle Royale</h2><p class="sub">Drop from the plane, loot, survive the storm. You vs 49 AI-controlled opponents (offline, single-player).</p>
      ${this.mapPicker('map')}${this.diffPicker()}
      <div class="row"><button class="btn primary big" data-act="start-br">Deploy ▸</button><button class="btn" data-act="br-friends">Play with friends (room)</button></div>`;
  }
  s_gg() {
    return `<h2>Gun Game</h2><p class="sub">Every elimination upgrades your weapon through ${GUN_GAME_ORDER.length} guns. Melee kills demote your victim. Final weapon: the knife.</p>
      ${this.mapPicker('map')}${this.diffPicker()}
      <div class="form"><label>AI opponents <b data-out="ggBots">${this.sel.ggBots}</b><input type="range" min="3" max="15" value="${this.sel.ggBots}" data-act="noop" data-sel="ggBots"></label>
      <label>Time limit (min) <b data-out="ggTime">${this.sel.ggTime}</b><input type="range" min="3" max="20" value="${this.sel.ggTime}" data-sel="ggTime"></label></div>
      <div class="ladder">${GUN_GAME_ORDER.map((w, i) => `<span>${i + 1}. ${esc(WEAPON_MAP[w].name)}</span>`).join('')}</div>
      <div class="row"><button class="btn primary big" data-act="start-gg">Start ▸</button><button class="btn" data-act="gg-friends">Play with friends (room)</button></div>`;
  }
  mapPicker() { return `<div class="maps">${MAPS.map((m) => `<div class="card map ${this.sel.map === m.id ? 'sel' : ''}" data-act="sel-map" data-v="${m.id}"><div class="map-img" style="background:${m.img}"></div><b>${m.name}</b><small>${m.sub}</small></div>`).join('')}</div>`; }
  diffPicker(key = 'difficulty', obj = this.sel) { return `<div class="seg">${Object.entries(SKILLS).map(([k, v]) => `<button class="btn ${obj[key] === k ? 'on' : ''}" data-act="sel-diff" data-k="${key}" data-v="${k}">${v.name}</button>`).join('')}</div>`; }

  s_custom() {
    const c = this.custom; const br = c.mode === 'br';
    return `<h2>Custom Match</h2><div class="cols"><div class="panel">
      <h3>Create</h3><div class="form">
      <label>Match name<input data-custom="name" maxlength="28" value="${esc(c.name)}"></label>
      <label>Mode<select data-custom="mode">${MODES.map((m) => `<option value="${m.id}" ${c.mode === m.id ? 'selected' : ''}>${m.name}</option>`).join('')}</select></label>
      <label>Map<select data-custom="map">${MAPS.map((m) => `<option value="${m.id}" ${c.map === m.id ? 'selected' : ''}>${m.name}</option>`).join('')}</select></label>
      ${br ? `<label>Total combatants <b data-out="brPlayers">${c.brPlayers}</b><input type="range" min="10" max="50" value="${c.brPlayers}" data-custom="brPlayers"></label>` : `<label>AI opponents <b data-out="bots">${c.bots}</b><input type="range" min="0" max="15" value="${c.bots}" data-custom="bots"></label>`}
      <label>AI difficulty<select data-custom="difficulty">${Object.entries(SKILLS).map(([k, v]) => `<option value="${k}" ${c.difficulty === k ? 'selected' : ''}>${v.name}</option>`).join('')}</select></label>
      ${br ? '' : `<label>Match duration (min) <b data-out="timeLimit">${c.timeLimit}</b><input type="range" min="2" max="20" value="${c.timeLimit}" data-custom="timeLimit"></label>`}
      ${c.mode === 'ffa' || c.mode === 'tdm' ? `<label>Score limit <b data-out="scoreLimit">${c.scoreLimit}</b><input type="range" min="5" max="100" step="5" value="${c.scoreLimit}" data-custom="scoreLimit"></label>
      <label class="chk"><input type="checkbox" data-custom="largeArena" ${c.largeArena ? 'checked' : ''}> Use full map (instead of compact arena)</label>` : ''}
      <label>Max human players <b data-out="maxPlayers">${c.maxPlayers}</b><input type="range" min="2" max="8" value="${c.maxPlayers}" data-custom="maxPlayers"></label>
      ${c.mode !== 'gg' ? `<div class="lbl">Allowed weapon classes <small>(none checked = all)</small></div><div class="chips">${['pistol', ...PRIMARY_CLASSES].map((k) => `<label class="chip"><input type="checkbox" data-act="allow" data-v="${k}" ${c.allowed.includes(k) ? 'checked' : ''}>${CLASS_NAMES[k]}</label>`).join('')}</div>` : ''}
      <div class="lbl">Connection for rooms</div><div class="seg"><button class="btn ${c.net === 'online' ? 'on' : ''}" data-act="net" data-v="online">Online (peer-to-peer)</button><button class="btn ${c.net === 'local' ? 'on' : ''}" data-act="net" data-v="local">Same device (tabs)</button></div>
      <small class="note">${c.net === 'online' ? 'Players on other devices join with the room code or invite link. Uses WebRTC; a public signaling broker connects peers.' : 'Opens a room other tabs/windows of this browser can join — no network needed.'}</small>
      </div><div class="row"><button class="btn primary" data-act="create-room">Create Private Room</button><button class="btn" data-act="custom-solo">Play Solo vs AI</button></div></div>
      <div class="panel"><h3>Join</h3><div class="form"><label>Room code<input id="join-code" maxlength="6" placeholder="ABC123" style="text-transform:uppercase;letter-spacing:4px;font-size:22px"></label>
      <div class="seg"><button class="btn ${c.net === 'online' ? 'on' : ''}" data-act="net" data-v="online">Online</button><button class="btn ${c.net === 'local' ? 'on' : ''}" data-act="net" data-v="local">Same device</button></div></div>
      <div class="row"><button class="btn primary" data-act="join-room">Join Room</button></div><p class="note" id="join-err"></p>
      <h3>How rooms work</h3><p class="note">The host's game runs the authoritative simulation (bots, damage, loot, zone). Everyone else streams their movement and shots to the host. AI bots fill empty slots and are always labeled BOT.</p></div></div>`;
  }
  s_lobby() {
    const room = this.app.room; if (!room) return '<p>No room.</p>';
    const s = room.settings || {}; const link = room.inviteLink(); const host = room.isHost;
    return `<h2>${esc(s.name || 'Room')}</h2><div class="cols"><div class="panel"><div class="code-box"><small>ROOM CODE</small><div class="code">${room.code}</div><small>${room.kind === 'online' ? 'Online · peer-to-peer' : 'Same device · tabs'}</small></div>
      <div class="form"><label>Invite link<input readonly value="${esc(link)}" id="invite"></label></div>
      <div class="row"><button class="btn" data-act="copy-link">Copy invite link</button><button class="btn" data-act="copy-code">Copy code</button>${navigator.share ? '<button class="btn" data-act="share">Share…</button>' : ''}</div>
      <h3>Settings</h3><div class="kv"><span>Mode</span><b>${MODES.find((m) => m.id === s.mode)?.name}</b><span>Map</span><b>${MAPS.find((m) => m.id === s.map)?.name}</b><span>AI</span><b>${s.mode === 'br' ? `fills to ${s.brPlayers}` : s.bots} · ${SKILLS[s.difficulty]?.name}</b><span>Duration</span><b>${s.mode === 'br' ? 'Until last standing' : s.timeLimit + ' min'}</b></div></div>
      <div class="panel"><h3>Players (${room.players.length}/${s.maxPlayers})</h3><div class="plist">${room.players.map((p) => `<div class="pl"><span class="dot ${p.host || p.ready ? 'ok' : ''}"></span><b>${esc(p.name)}</b> <small>${esc(CHAR_MAP[p.charId]?.name || '')}</small> ${p.host ? '<i class="tag">HOST</i>' : p.ready ? '<i class="tag ok">READY</i>' : '<i class="tag">waiting</i>'}</div>`).join('')}</div>
      <p class="note">${host ? 'Start whenever you like — AI bots fill the remaining slots.' : 'Waiting for the host to start the match…'}</p>
      <div class="row">${host ? '<button class="btn primary big" data-act="room-start">Start Match ▸</button>' : `<button class="btn primary" data-act="room-ready">${room.players.find((p) => p.peerId === room.t.id)?.ready ? 'Not ready' : 'Ready'}</button>`}<button class="btn" data-act="room-leave">Leave Room</button></div></div></div>`;
  }

  s_characters() {
    const p = this.P; const lvl = levelInfo().level; const sel = CHAR_MAP[this.charSel]; const cu = p.custom[sel.id] || {}; const look = resolveLook(sel.id, cu);
    const opt = (list, key) => `<select data-act="cust" data-k="${key}">${list.map((o) => `<option value="${o.id}" ${look[key] === o.id ? 'selected' : ''}>${o.name}</option>`).join('')}</select>`;
    const sw = (key) => `<div class="swatches">${PALETTE.map((c) => `<i style="background:${c}" class="${look[key] === c ? 'on' : ''}" data-act="cust" data-k="${key}" data-v="${c}"></i>`).join('')}</div>`;
    const locked = sel.unlock > lvl;
    return `<div class="char-layout"><div class="char-grid">${CHARACTERS.map((c) => `<div class="card char ${c.id === this.charSel ? 'sel' : ''} ${c.unlock > lvl ? 'locked' : ''} ${p.character === c.id ? 'equipped' : ''}" data-act="char" data-v="${c.id}"><div class="cface" style="background:radial-gradient(circle at 50% 40%, ${c.skin} 0 32%, ${c.outfit} 33% 60%, ${c.accent} 61%)"></div><b>${esc(c.name)}</b><small>${c.unlock > lvl ? '🔒 Level ' + c.unlock : esc(c.role)}</small></div>`).join('')}</div>
      <div class="drag-zone"></div>
      <div class="panel char-panel"><h3>${esc(sel.name)}</h3><p class="note">${esc(sel.role)} — ${esc(sel.bio)}</p>
      <div class="form"><div class="lbl">Outfit</div>${sw('outfit')}<div class="lbl">Secondary</div>${sw('outfit2')}<div class="lbl">Armor / vest</div>${sw('vest')}<div class="lbl">Accent</div>${sw('accent')}
      <label>Headgear${opt(HELMETS, 'helmet')}</label><label>Mask${opt(MASKS, 'mask')}</label><label>Hair${opt(HAIR, 'hair')}</label><label>Accessory${opt(ACCESSORIES, 'acc')}</label></div>
      <div class="row">${locked ? `<button class="btn" disabled>Unlocks at level ${sel.unlock}</button>` : `<button class="btn primary" data-act="equip-char">${p.character === sel.id ? 'Equipped ✓' : 'Equip'}</button>`}<button class="btn" data-act="reset-char">Reset look</button></div></div></div>`;
  }

  buildFor(id) { const lo = this.P.loadouts[this.editLoadout]; return lo.builds?.[id] || {}; }
  s_loadouts() {
    const p = this.P; const lo = p.loadouts[this.editLoadout]; const wsel = this.loWeapon || lo.primary;
    const w = WEAPON_MAP[wsel]; const b = lo.builds[wsel] || {}; const wl = weaponLevel(p.weaponXp[wsel]);
    const wpick = (slot, list) => `<div class="wlist">${list.map((x) => `<div class="tile wt ${lo[slot] === x.id ? 'on' : ''}" data-act="lo-w" data-slot="${slot}" data-v="${x.id}"><b>${esc(x.name)}</b><small>${CLASS_NAMES[x.cls]}</small></div>`).join('')}</div>`;
    const att = (slot) => { const list = allowedAttachments(w, slot); const cur = b[slot] || (slot === 'optic' ? w.defOptic || 'iron' : list[0].id); return `<label>${slot[0].toUpperCase() + slot.slice(1)}<select data-act="lo-att" data-k="${slot}">${list.map((a) => `<option value="${a.id}" ${cur === a.id ? 'selected' : ''} title="${esc(a.desc)}">${esc(a.name)}</option>`).join('')}</select><small>${esc(list.find((a) => a.id === cur)?.desc || '')}</small></label>`; };
    return `<div class="tabs">${p.loadouts.map((l, i) => `<button class="btn ${i === this.editLoadout ? 'on' : ''}" data-act="lo-tab" data-v="${i}">${esc(l.name)}${i === p.activeLoadout ? ' ★' : ''}</button>`).join('')}</div>
      <div class="cols lo"><div class="panel"><div class="form"><label>Loadout name<input data-act="noop" id="lo-name" maxlength="18" value="${esc(lo.name)}"></label></div>
        <div class="lbl">Primary</div>${wpick('primary', WEAPONS.filter((x) => PRIMARY_CLASSES.includes(x.cls)))}
        <div class="lbl">Secondary</div>${wpick('secondary', WEAPONS.filter((x) => x.cls === 'pistol' || x.cls === 'melee' || x.cls === 'special'))}</div>
      <div class="panel"><h3>${esc(w.name)} <small>Lv ${wl}</small></h3><div class="seg">${['primary', 'secondary'].map((s) => `<button class="btn ${wsel === lo[s] ? 'on' : ''}" data-act="lo-edit" data-v="${lo[s]}">${s}</button>`).join('')}</div>
        <div class="form">${['optic', 'barrel', 'grip', 'mag'].map(att).join('')}
        <div class="lbl">Weapon skin</div><div class="skins">${SKINS.map((s) => `<div class="skin ${(b.skin || 'factory') === s.id ? 'on' : ''} ${s.level > wl ? 'locked' : ''}" data-act="lo-skin" data-v="${s.id}" title="${esc(s.name)}${s.level > wl ? ' (weapon level ' + s.level + ')' : ''}" style="background:${s.colors ? `linear-gradient(135deg,${s.colors.join(',')})` : '#555'}">${s.level > wl ? '🔒' : ''}</div>`).join('')}</div>
        ${statBars(buildStats(wsel, b))}</div></div>
      <div class="panel"><div class="form"><label>Lethal<select data-act="lo-eq" data-k="lethal">${LETHALS.map((l) => `<option value="${l.id}" ${lo.lethal === l.id ? 'selected' : ''}>${l.name}</option>`).join('')}</select></label>
        <label>Tactical<select data-act="lo-eq" data-k="tactical">${TACTICALS.map((l) => `<option value="${l.id}" ${lo.tactical === l.id ? 'selected' : ''}>${l.name}</option>`).join('')}</select></label>
        <label>Field gear<select data-act="lo-eq" data-k="gear">${GEAR.map((l) => `<option value="${l.id}" ${lo.gear === l.id ? 'selected' : ''}>${l.name}</option>`).join('')}</select></label><small class="note">${esc(GEAR.find((g) => g.id === lo.gear)?.desc)}</small>
        <div class="lbl">Perks (pick 3)</div><div class="perks">${PERKS.map((k) => `<div class="tile perk ${lo.perks.includes(k.id) ? 'on' : ''}" data-act="lo-perk" data-v="${k.id}"><b>${k.icon} ${esc(k.name)}</b><small>${esc(k.desc)}</small></div>`).join('')}</div></div>
        <div class="row"><button class="btn primary" data-act="lo-active">${this.editLoadout === p.activeLoadout ? 'Active loadout ✓' : 'Set as active'}</button></div></div></div>`;
  }
  s_weapons() {
    const p = this.P; const w = WEAPON_MAP[this.armory]; const xp = p.weaponXp[w.id] || 0; const lvl = weaponLevel(xp);
    return `<div class="armory"><div class="wlist tall">${Object.keys(CLASS_NAMES).map((cls) => `<div class="lbl">${CLASS_NAMES[cls]}</div>` + WEAPONS.filter((x) => x.cls === cls).map((x) => `<div class="tile wt ${x.id === w.id ? 'on' : ''}" data-act="armory" data-v="${x.id}"><b>${esc(x.name)}</b><small>Lv ${weaponLevel(p.weaponXp[x.id])}</small></div>`).join('')).join('')}</div>
      <div class="drag-zone"></div>
      <div class="panel"><h3>${esc(w.name)}</h3><p class="note">${esc(w.desc)}</p><div class="kv"><span>Class</span><b>${CLASS_NAMES[w.cls]}</b><span>Fire mode</span><b>${w.mode}${w.burst > 1 ? ' ×' + w.burst : ''}</b><span>Magazine</span><b>${w.mag || '—'}</b><span>Rate</span><b>${w.rpm} rpm</b></div>
      ${statBars(buildStats(w.id, {}))}<div class="lbl">Weapon level ${lvl} · ${xp % WEAPON_XP_PER_LEVEL}/${WEAPON_XP_PER_LEVEL} XP</div><div class="xpbar"><i style="width:${(xp % WEAPON_XP_PER_LEVEL) / WEAPON_XP_PER_LEVEL * 100}%"></i></div>
      <div class="lbl">Skins</div><div class="skins">${SKINS.map((s) => `<div class="skin ${s.level > lvl ? 'locked' : ''}" title="${esc(s.name)} — weapon level ${s.level}" style="background:${s.colors ? `linear-gradient(135deg,${s.colors.join(',')})` : '#555'}">${s.level > lvl ? '🔒' : ''}</div>`).join('')}</div>
      <p class="note">Drag the weapon to rotate. Earn weapon XP with eliminations to unlock skins.</p></div></div>`;
  }
  s_profile() {
    const p = this.P; const L = levelInfo();
    return `<h2>Profile</h2><div class="cols"><div class="panel"><div class="form"><label>Callsign<input id="pname" maxlength="18" value="${esc(p.name)}"></label></div><div class="row"><button class="btn primary" data-act="save-name">Save</button></div>
      <div class="biglvl">Level ${L.level}</div><div class="xpbar big"><i style="width:${L.pct * 100}%"></i></div><small>${L.into} / ${L.need} XP · Total ${p.xp} XP</small>
      <h3>Unlocks</h3><div class="unl">${CHARACTERS.filter((c) => c.unlock > 1).map((c) => `<span class="${c.unlock <= L.level ? 'ok' : ''}">${esc(c.name)} · Lv ${c.unlock}</span>`).join('')}</div></div>
      <div class="panel"><h3>Achievements</h3>${ACHIEVEMENTS.map((a) => `<div class="ach ${p.achievements[a.id] ? 'ok' : ''}"><b>${p.achievements[a.id] ? '🏆' : '🔒'} ${esc(a.name)}</b><small>${esc(a.desc)}</small></div>`).join('')}
      <h3>Recent matches</h3>${p.history.length ? p.history.map((h) => `<div class="hist ${h.won ? 'won' : ''}"><b>${h.mode.toUpperCase()}</b> ${esc(MAPS.find((m) => m.id === h.map)?.name || '')} · ${h.won ? 'WIN' : h.place ? '#' + h.place : 'Loss'} · ${h.kills} kills · +${h.xp} XP</div>`).join('') : '<p class="note">No matches yet.</p>'}</div></div>`;
  }
  s_stats() {
    const s = this.P.stats; const kd = (s.kills / Math.max(1, s.deaths)).toFixed(2); const acc = (s.hits / Math.max(1, s.shots) * 100).toFixed(1);
    const card = (k, v) => `<div class="stat"><small>${k}</small><b>${v}</b></div>`;
    return `<h2>Statistics</h2><div class="stats">${card('Matches', s.matches)}${card('Wins', s.wins)}${card('Losses', s.losses)}${card('Eliminations', s.kills)}${card('Deaths', s.deaths)}${card('K/D', kd)}${card('Headshots', s.headshots)}${card('Accuracy', acc + '%')}${card('Damage', s.damage)}${card('Play time', formatTime(s.playTime))}${card('Crates opened', s.crates)}</div>
      <h3>Battle Royale</h3><div class="stats">${card('Matches', s.br.matches)}${card('Wins', s.br.wins)}${card('Top 10', s.br.top10)}${card('Best placement', s.br.bestPlace ? '#' + s.br.bestPlace : '—')}${card('Kills', s.br.kills)}</div>
      <h3>Gun Game</h3><div class="stats">${card('Matches', s.gg.matches)}${card('Wins', s.gg.wins)}${card('Kills', s.gg.kills)}</div>
      <h3>Custom</h3><div class="stats">${card('Matches', s.custom.matches)}${card('Wins', s.custom.wins)}${card('Kills', s.custom.kills)}</div>`;
  }
  s_settings() {
    const s = this.P.settings; const tab = this.setTab || 'graphics'; const g = this.app.gfx;
    const rng = (k, min, max, step, label) => `<label>${label} <b data-out="${k}">${s[k]}</b><input type="range" min="${min}" max="${max}" step="${step}" value="${s[k]}" data-set="${k}"></label>`;
    const chk = (k, label) => `<label class="chk"><input type="checkbox" data-set="${k}" ${s[k] ? 'checked' : ''}> ${label}</label>`;
    let body = '';
    if (tab === 'graphics') body = `<label>Quality preset<select data-set="graphics">${['auto', 'low', 'medium', 'high', 'ultra'].map((k) => `<option value="${k}" ${s.graphics === k ? 'selected' : ''}>${k === 'auto' ? `Auto (detected: ${PRESETS[g.detected.preset].name})` : PRESETS[k].name}</option>`).join('')}</select></label>
      <small class="note">Detected: ${esc(g.detected.reason)} · GPU: ${esc(g.detected.gpu)}. Auto mode lowers resolution and quality if frame rate drops.</small>
      <div class="kv">${(() => { const q = PRESETS[g.presetId]; return `<span>Active</span><b>${q.name}</b><span>Shadows</span><b>${q.shadows ? q.shadowSize : 'Off'}</b><span>Bloom</span><b>${q.bloom ? 'On' : 'Off'}</b><span>Ambient occlusion</span><b>${q.ao ? 'On' : 'Off'}</b><span>Textures</span><b>${q.texSize}px</b><span>View distance</span><b>${q.drawDist}m</b>`; })()}</div>
      ${rng('renderScale', 0.5, 1, 0.05, 'Render scale')}${rng('fov', 60, 105, 1, 'Field of view')}${chk('showFps', 'Show FPS counter')}<small class="note">Graphics changes apply fully to the next match.</small>`;
    if (tab === 'controls') body = `${rng('sensitivity', 0.2, 3, 0.05, 'Mouse sensitivity')}${rng('adsSensitivity', 0.2, 1.5, 0.05, 'Aim-down-sight multiplier')}${chk('invertY', 'Invert Y axis')}${chk('holdToCrouch', 'Hold to crouch (instead of toggle)')}${chk('fullscreen', 'Fullscreen when a match starts')}
      <label>Crosshair color<input type="color" value="${s.crosshairColor}" data-set="crosshairColor"></label>
      <div class="keys">${[['WASD', 'Move'], ['Mouse', 'Look'], ['LMB', 'Fire'], ['RMB', 'Aim'], ['R', 'Reload'], ['Space', 'Jump'], ['Shift', 'Sprint'], ['Ctrl / C', 'Crouch · Slide while sprinting'], ['E / F', 'Interact / loot'], ['1 · 2 · Wheel', 'Switch weapon'], ['G', 'Lethal grenade'], ['Q', 'Tactical'], ['V / MMB', 'Melee'], ['H / 4', 'Heal / Medkit'], ['X', 'Field gear'], ['I', 'Inspect weapon'], ['Tab', 'Scoreboard'], ['M', 'Map'], ['Esc / P', 'Pause']].map(([k, v]) => `<span><kbd>${k}</kbd>${v}</span>`).join('')}</div>`;
    if (tab === 'touch') body = `${rng('touchSensitivity', 0.3, 3, 0.05, 'Touch look sensitivity')}${rng('buttonScale', 0.7, 1.5, 0.05, 'Button size')}${chk('aimAssist', 'Aim assist (touch)')}<div class="row"><button class="btn" data-act="edit-layout">Edit button layout</button></div><small class="note">Play in landscape. Pushing the stick fully forward sprints.</small>`;
    if (tab === 'audio') body = `${rng('master', 0, 1, 0.05, 'Master volume')}${rng('sfx', 0, 1, 0.05, 'Effects')}${rng('music', 0, 1, 0.05, 'Music')}${rng('ambience', 0, 1, 0.05, 'Ambience')}`;
    if (tab === 'data') body = `<p class="note">Progress, loadouts and settings are saved automatically on this device.</p><div class="row"><button class="btn danger" data-act="reset-all">Reset all progress</button></div>`;
    return `<h2>Settings</h2><div class="tabs">${['graphics', 'controls', 'touch', 'audio', 'data'].map((t) => `<button class="btn ${tab === t ? 'on' : ''}" data-act="set-tab" data-v="${t}">${t}</button>`).join('')}</div><div class="panel form settings">${body}</div>`;
  }
  s_results() {
    const r = this.app.lastResults; if (!r) return '';
    const res = r.res, sum = r.summary, me = r.me; const br = res.mode === 'br';
    return `<div class="results ${res.won ? 'win' : 'loss'}"><div class="res-banner">${res.won ? (br ? 'VICTORY ROYALE' : 'VICTORY') : br ? `#${me.place || '?'} PLACE` : 'DEFEAT'}</div><div class="res-sub">${esc(res.reason || '')} · Winner: ${esc(res.winnerName)}</div>
      <div class="cols"><div class="panel"><div class="stats">${[['Eliminations', me.kills], ['Deaths', me.deaths], ['Assists', me.assists], ['Headshots', me.headshots], ['Damage', Math.round(me.damage)], ['Accuracy', (me.hits / Math.max(1, me.shots) * 100).toFixed(0) + '%'], br ? ['Placement', '#' + (me.place || '?')] : ['Score', me.score], ['Time', formatTime(me.time)]].map(([k, v]) => `<div class="stat"><small>${k}</small><b>${v}</b></div>`).join('')}</div>
        <h3>+${sum.xp} XP</h3>${r.xpLines.map((l) => `<div class="xpl"><span>${esc(l[0])}</span><b>+${l[1]}</b></div>`).join('')}
        ${sum.levelAfter > sum.levelBefore ? `<div class="lvlup">LEVEL UP! ${sum.levelBefore} → ${sum.levelAfter}</div>` : ''}
        ${sum.challengesDone.map((c) => `<div class="xpl ok"><span>✓ ${esc(c.text)}</span><b>+${c.xp}</b></div>`).join('')}
        ${sum.achievements.map((a) => `<div class="xpl ok"><span>🏆 ${esc(a.name)}</span></div>`).join('')}</div>
      <div class="panel"><h3>Scoreboard</h3><table class="sb">${res.scoreboard.slice(0, 12).map((s, i) => `<tr class="${s.id === me.id ? 'me' : ''}"><td>${br ? (s.alive ? '#1' : '#' + s.place) : i + 1}</td><td>${esc(s.name)}${s.bot ? ' <i class="bot">BOT</i>' : ''}</td><td>${s.kills} K</td><td>${s.deaths} D</td></tr>`).join('')}</table></div></div>
      <div class="row center"><button class="btn primary big" data-act="again">Play Again</button><button class="btn big" data-act="to-main">Main Menu</button></div></div>`;
  }

  // ---------------- actions ----------------
  act(a, el) {
    const p = this.P; const v = el.dataset.v;
    switch (a) {
      case 'back': this.back(); break;
      case 'noop': break;
      case 'play-br': this.sel.map = this.sel.map || 'beach'; this.show('br'); break;
      case 'play-gg': this.show('gg'); break;
      case 'sel-map': this.sel.map = v; this.show(this.screen, false); break;
      case 'sel-diff': this.sel[el.dataset.k] = v; this.show(this.screen, false); break;
      case 'start-br': this.app.startMatch({ mode: 'br', map: this.sel.map, difficulty: this.sel.difficulty, players: 50 }); break;
      case 'start-gg': this.app.startMatch({ mode: 'gg', map: this.sel.map, difficulty: this.sel.difficulty, bots: this.sel.ggBots, timeLimit: this.sel.ggTime }); break;
      case 'br-friends': Object.assign(this.custom, { mode: 'br', map: this.sel.map, difficulty: this.sel.difficulty }); this.show('custom'); break;
      case 'gg-friends': Object.assign(this.custom, { mode: 'gg', map: this.sel.map, difficulty: this.sel.difficulty, bots: Math.min(15, this.sel.ggBots) }); this.show('custom'); break;
      case 'allow': { const set = new Set(this.custom.allowed); el.checked ? set.add(v) : set.delete(v); this.custom.allowed = [...set]; break; }
      case 'net': this.custom.net = v; this.show('custom', false); break;
      case 'custom-solo': this.app.startMatch(this.customSettings()); break;
      case 'create-room': this.app.createRoom(this.customSettings(), this.custom.net); break;
      case 'join-room': { const code = this.root.querySelector('#join-code').value.toUpperCase().trim(); const err = this.root.querySelector('#join-err'); if (!isValidRoomCode(code)) { err.textContent = 'Enter the 6-character room code.'; return; } err.textContent = 'Connecting…'; this.app.joinRoom(code, this.custom.net).catch((e) => { err.textContent = e.message; }); break; }
      case 'copy-link': copy(this.root.querySelector('#invite').value, el); break;
      case 'copy-code': copy(this.app.room.code, el); break;
      case 'share': navigator.share({ title: 'Join my CLAYFRONT match', text: `Room code ${this.app.room.code}`, url: this.app.room.inviteLink() }).catch(() => {}); break;
      case 'room-start': this.app.hostStart(); break;
      case 'room-ready': { const me = this.app.room.players.find((x) => x.peerId === this.app.room.t.id); this.app.room.setReady(!(me && me.ready)); break; }
      case 'room-leave': this.app.leaveRoom(); this.show('custom', false); break;
      case 'char': this.charSel = v; this.show('characters', false); break;
      case 'cust': { const k = el.dataset.k; const val = el.tagName === 'SELECT' ? el.value : v; (p.custom[this.charSel] ||= {})[k] = val; saveProfile(); this.show('characters', false); break; }
      case 'equip-char': p.character = this.charSel; saveProfile(); this.show('characters', false); break;
      case 'reset-char': delete p.custom[this.charSel]; saveProfile(); this.show('characters', false); break;
      case 'lo-tab': this.saveLoName(); this.editLoadout = Number(v); this.loWeapon = null; this.show('loadouts', false); break;
      case 'lo-w': { this.saveLoName(); const lo = p.loadouts[this.editLoadout]; lo[el.dataset.slot] = v; this.loWeapon = v; saveProfile(); this.show('loadouts', false); break; }
      case 'lo-edit': this.saveLoName(); this.loWeapon = v; this.show('loadouts', false); break;
      case 'lo-att': { const lo = p.loadouts[this.editLoadout]; const wid = this.loWeapon || lo.primary; (lo.builds[wid] ||= {})[el.dataset.k] = el.value; saveProfile(); this.show('loadouts', false); break; }
      case 'lo-skin': { const lo = p.loadouts[this.editLoadout]; const wid = this.loWeapon || lo.primary; const s = SKINS.find((x) => x.id === v); if (s.level > weaponLevel(p.weaponXp[wid])) { this.flash(el, `Reach weapon level ${s.level}`); return; } (lo.builds[wid] ||= {}).skin = v; saveProfile(); this.show('loadouts', false); break; }
      case 'lo-eq': { const lo = p.loadouts[this.editLoadout]; lo[el.dataset.k] = el.value; saveProfile(); this.show('loadouts', false); break; }
      case 'lo-perk': { const lo = p.loadouts[this.editLoadout]; const i = lo.perks.indexOf(v); if (i >= 0) lo.perks.splice(i, 1); else { if (lo.perks.length >= 3) lo.perks.shift(); lo.perks.push(v); } saveProfile(); this.show('loadouts', false); break; }
      case 'lo-active': this.saveLoName(); p.activeLoadout = this.editLoadout; saveProfile(); this.show('loadouts', false); break;
      case 'armory': this.armory = v; this.show('weapons', false); break;
      case 'save-name': { const n = this.root.querySelector('#pname').value.trim().slice(0, 18); if (n) { p.name = n; saveProfile(); } this.show('profile', false); break; }
      case 'set-tab': this.setTab = v; this.show('settings', false); break;
      case 'edit-layout': openLayoutEditor(document.body, () => this.show('settings', false)); break;
      case 'reset-all': if (confirm('Reset ALL progress, loadouts and settings? This cannot be undone.')) { resetProfile(); this.show('main', false); } break;
      case 'again': this.app.playAgain(); break;
      case 'to-main': this.stack = []; this.show('main', false); break;
    }
    // range inputs bound to this.sel
  }
  saveLoName() { const i = this.root.querySelector('#lo-name'); if (i) { const lo = this.P.loadouts[this.editLoadout]; lo.name = i.value.trim().slice(0, 18) || lo.name; saveProfile(); } }
  customSettings() { const c = this.custom; return { mode: c.mode, rule: c.mode, map: c.map, bots: c.bots, difficulty: c.difficulty, timeLimit: c.timeLimit, scoreLimit: c.scoreLimit, maxPlayers: c.maxPlayers, allowed: c.allowed, name: c.name, largeArena: c.largeArena, players: c.brPlayers, brPlayers: c.brPlayers, custom: true }; }
  flash(el, text) { const t = document.createElement('div'); t.className = 'mini-toast'; t.textContent = text; el.append(t); setTimeout(() => t.remove(), 1500); }

  // ---------------- overlays ----------------
  pause(onResume, onLeave, onSettings) {
    const d = document.createElement('div'); d.className = 'pause';
    d.innerHTML = `<div class="panel"><h2>Paused</h2><button class="btn primary big" data-a="resume">Resume</button><button class="btn" data-a="settings">Settings</button><button class="btn" data-a="controls">Controls</button><button class="btn danger" data-a="leave">Leave Match</button><div class="pause-extra"></div></div>`;
    d.querySelector('[data-a=resume]').onclick = () => { audio.click(); d.remove(); onResume(); };
    d.querySelector('[data-a=leave]').onclick = () => { audio.click(); d.remove(); onLeave(); };
    d.querySelector('[data-a=controls]').onclick = () => { this.setTab = 'controls'; d.querySelector('.pause-extra').innerHTML = this.s_settings(); this.bindIn(d); };
    d.querySelector('[data-a=settings]').onclick = () => { this.setTab = 'audio'; d.querySelector('.pause-extra').innerHTML = this.s_settings(); this.bindIn(d); };
    document.body.append(d); return d;
  }
  bindIn(d) {
    d.querySelectorAll('input[data-set]').forEach((i) => i.addEventListener('input', () => { const s = this.P.settings; const k = i.dataset.set; s[k] = i.type === 'checkbox' ? i.checked : i.type === 'range' ? Number(i.value) : i.value; saveProfile(); const out = d.querySelector(`[data-out="${k}"]`); if (out) out.textContent = s[k]; audio.setVolumes(s); }));
    d.querySelectorAll('[data-act=set-tab]').forEach((b) => b.onclick = () => { this.setTab = b.dataset.v; d.querySelector('.pause-extra').innerHTML = this.s_settings(); this.bindIn(d); });
    d.querySelectorAll('select[data-set]').forEach((i) => i.addEventListener('change', () => { const s = this.P.settings; s[i.dataset.set] = i.value; saveProfile(); }));
    d.querySelectorAll('[data-act=edit-layout]').forEach((b) => b.onclick = () => openLayoutEditor(document.body, () => {}));
    d.querySelectorAll('[data-act=reset-all]').forEach((b) => b.remove());
  }
}

function statBars(s) {
  const bar = (k, v) => `<div class="sbar"><span>${k}</span><div><i style="width:${Math.max(3, Math.min(100, v)).toFixed(0)}%"></i></div></div>`;
  const dps = s.dmg * s.pellets * (s.explosive ? 0 : 1) / s.interval; const dmg = s.explosive ? 100 : s.dmg * s.pellets;
  return `<div class="sbars">${bar('Damage', dmg / 1.2)}${bar('Fire rate', s.rpm / 11)}${bar('Range', s.far / 2.6)}${bar('Accuracy', 100 - s.spreadAds * 1400 - s.recoilV * 700)}${bar('Mobility', (s.move - 0.8) * 350)}${bar('Handling', 100 - s.adsTime * 200)}</div>`;
}
function copy(text, el) { (navigator.clipboard?.writeText(text) || Promise.reject()).then(() => { el.textContent = 'Copied ✓'; }).catch(() => { const i = document.createElement('textarea'); i.value = text; document.body.append(i); i.select(); try { document.execCommand('copy'); el.textContent = 'Copied ✓'; } catch (e) { el.textContent = 'Copy failed'; } i.remove(); }); }
