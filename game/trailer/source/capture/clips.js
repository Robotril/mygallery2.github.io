// Trailer clips. setup/ready/pre/direct run inside the game page; direct(i) runs before frame i is stepped.
const skipCountdown = () => { const m = window.CLAYFRONT.match; if (m && !m.mode.started) m.mode.countdown = Math.min(m.mode.countdown, 0.02); };
// face the longest open direction and put three bots in the line of fire
const stageFight = () => {
  const a = window.CLAYFRONT, m = a.match, L = m.local; let best = 0, by = L.yaw;
  for (let k = 0; k < 16; k++) { const y = k / 16 * Math.PI * 2; const dx = -Math.sin(y), dz = -Math.cos(y); const h = m.world.raycast(L.pos.x, L.eyeY, L.pos.z, dx, 0, dz, 40, 4); const d = h ? h.t : 40; if (d > best) { best = d; by = y; } }
  L.yaw = by; L.pitch = -0.04; const bots = m.combatants.filter((c) => c !== L && c.alive).slice(0, 3);
  const dist = [8, 12.5, 16], off = [0.1, -0.16, 0.05];
  bots.forEach((b, i) => { const y = by + off[i]; const d = Math.min(dist[i], best - 2); b.pos.set(L.pos.x - Math.sin(y) * d, L.pos.y, L.pos.z - Math.cos(y) * d); b.vel.set(0, 0, 0); b.yaw = y + Math.PI; b.hp = 60; });
};
module.exports = {
  showcase: { frames: 112, profile: { character: 'agent' },
    setup: () => { document.getElementById('ui').style.display = 'none'; },
    direct: (i) => { const s = window.CLAYFRONT.showcase; if (!window.__cp0) window.__cp0 = s.camPos.clone(); const k = Math.min(1, i / 111); const e = k * k * (3 - 2 * k);
      s.camPos.copy(window.__cp0).lerp(s.camLook, 0.34 * e); s.camPos.y = window.__cp0.y - 0.35 * e; } },
  intro: { frames: 112, setup: () => { window.CLAYFRONT.startMatch({ mode: 'gg', map: 'beach', difficulty: 'easy', bots: 7, timeLimit: 5 }); }, ready: () => window.CLAYFRONT.state === 'match' },
  fight: { frames: 210, preroll: 24,
    setup: () => { window.CLAYFRONT.startMatch({ mode: 'gg', map: 'city', difficulty: 'easy', bots: 5, timeLimit: 5 }); }, ready: () => window.CLAYFRONT.state === 'match',
    pre: (i) => { const m = window.CLAYFRONT.match; if (!m.mode.started) m.mode.countdown = Math.min(m.mode.countdown, 0.02); },
    direct: (i) => { const a = window.CLAYFRONT, inp = a.input, m = a.match, L = m.local;
      if (i === 0) { // face the longest open line of sight and put three bots out in the open along it
        let best = 0, by = L.yaw;
        for (let k = 0; k < 24; k++) { const y = k / 24 * Math.PI * 2; const h = m.world.raycast(L.pos.x, L.eyeY, L.pos.z, -Math.sin(y), 0, -Math.cos(y), 60, 4); const d = h ? h.t : 60; if (d > best) { best = d; by = y; } }
        L.yaw = by; L.pitch = -0.03; window.__fightYaw = by; const bots = m.combatants.filter((c) => c !== L && c.alive).slice(0, 4); const dist = [9, 13, 17, 21], off = [0.08, -0.12, 0.15, -0.05];
        bots.forEach((b, j) => { const y = by + off[j]; const d = Math.min(dist[j], best - 3); b.pos.set(L.pos.x - Math.sin(y) * d, L.pos.y, L.pos.z - Math.cos(y) * d); b.vel.set(0, 0, 0); b.yaw = y + Math.PI; b.hp = 55; }); }
      L.hp = L.maxHp || 100; // trailer staging: stay up for the whole shot
      // a good player: track the nearest visible bot in front, tap the trigger
      let tgt = null, bd = 1e9; const fy = window.__fightYaw;
      for (const e of m.combatants) { if (e === L || !e.alive) continue; const dx = e.pos.x - L.pos.x, dz = e.pos.z - L.pos.z; const d = Math.hypot(dx, dz); const ya = Math.atan2(-dx, -dz);
        let off = ya - fy; off = Math.atan2(Math.sin(off), Math.cos(off)); if (Math.abs(off) > 1.0 || d > 45) continue;
        if (!m.world.lineOfSight(L.pos.x, L.eyeY, L.pos.z, e.pos.x, e.pos.y + 1.3, e.pos.z)) continue; if (d < bd) { bd = d; tgt = e; } }
      if (tgt) { const dx = tgt.pos.x - L.pos.x, dz = tgt.pos.z - L.pos.z, dy = tgt.pos.y + 1.2 - L.eyeY; const ty = Math.atan2(-dx, -dz), tp = Math.atan2(dy, Math.hypot(dx, dz));
        let dyaw = ty - L.yaw; dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw)); L.yaw += dyaw * 0.22; L.pitch += (tp - L.pitch) * 0.22; }
      inp.mouseFire = !!tgt && i > 6 && (i % 4 < 2);
      if (i > 60 && i < 100) inp.held.add('right'); else inp.held.delete('right'); // a short strafe
    } },
  brdrop: { frames: 140, query: '',
    setup: () => { window.CLAYFRONT.startMatch({ mode: 'br', map: 'beach', difficulty: 'easy', players: 50 }); }, ready: () => window.CLAYFRONT.state === 'match',
    direct: (i) => { if (i === 0) { const st = document.createElement('style'); st.textContent = '#hud .minimap { visibility: hidden; }'; document.head.appendChild(st); } /* the minimap is a dark disc over the sea while in the plane */ const a = window.CLAYFRONT, L = a.match.local; if (i === 34) a.input.pressed.add('jump'); if (i > 34) L.pitch = Math.max(-1.05, L.pitch - 0.02); } },
  characters: { frames: 104, profile: { xp: 9000000 },
    setup: async () => { const { CHARACTERS } = await import('/game/js/data/characters.js'); window.__chars = CHARACTERS.map((c) => c.id); const mn = window.CLAYFRONT.menu; mn.charSel = window.__chars[0]; mn.show('characters', false); },
    direct: (i) => { const mn = window.CLAYFRONT.menu, ids = window.__chars; const pick = [0, 3, 6, 9, 12]; if (i % 26 === 0) { mn.charSel = ids[pick[(i / 26) % pick.length] % ids.length]; mn.show('characters', false); } } },
  room: { frames: 96,
    // online room: this capture machine cannot reach the public matchmaking (PeerJS) server, so its "connected"
    // reply is simulated; everything on screen is the game's real online-room screen
    setup: () => { const a = window.CLAYFRONT;
      window.Peer = class { constructor(id) { this.id = id; this.h = {}; Promise.resolve().then(() => this.h.open && this.h.open(id)); } on(e, cb) { this.h[e] = cb; return this; } connect() { return { on() {}, send() {}, close() {} }; } destroy() {} disconnect() {} };
      a.menu.custom.net = 'online'; a.menu.show('custom', false); a.createRoom(a.menu.customSettings(), 'online'); },
    direct: () => { const real = 'https://robotril.github.io/mygallery2.github.io'; const fix = (s) => s.replaceAll('http://localhost:8765', real);
      document.querySelectorAll('#ui input').forEach((el) => { if (el.value.includes('localhost')) el.value = fix(el.value); });
      const w = document.createTreeWalker(document.getElementById('ui'), NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) if (n.nodeValue.includes('localhost')) n.nodeValue = fix(n.nodeValue); } },
  victory: { frames: 130, preroll: 24,
    setup: () => { window.CLAYFRONT.startMatch({ mode: 'gg', map: 'beach', difficulty: 'easy', bots: 5, timeLimit: 5 }); }, ready: () => window.CLAYFRONT.state === 'match',
    pre: (i) => { const m = window.CLAYFRONT.match; if (!m.mode.started) m.mode.countdown = Math.min(m.mode.countdown, 0.02); },
    direct: (i) => { const m = window.CLAYFRONT.match; if (i === 0) { const st = document.createElement('style'); st.textContent = '#hud > :not(.kin-stage) { visibility: hidden !important; }'; document.head.appendChild(st); } // staged win: show only the camera and the Victory moment
      if (i === 6) m.mode.finish(m.local, 'score'); } },
};
