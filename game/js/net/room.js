// Lobby / room management: create rooms with join codes, invite links, player list, start handshake.
import { Emitter, makeRoomCode, isValidRoomCode } from '../core/util.js';
import { makeTransport } from './transport.js';

export class Room extends Emitter {
  constructor(transport, isHost, me) { super(); this.t = transport; this.isHost = isHost; this.me = me; this.players = []; this.settings = null; this.code = transport.code; this.kind = transport.kind; this.started = false; this.closed = false; }

  static async host(settings, kind, me) {
    let lastErr;
    for (let i = 0; i < 3; i++) {
      const code = makeRoomCode(); const t = makeTransport(kind, code, true);
      try { await t.connect(); const r = new Room(t, true, me); r.settings = settings; r.players = [{ ...me, peerId: 'host', host: true }]; r.bind(); return r; } catch (e) { lastErr = e; t.close(); }
    }
    throw lastErr;
  }
  static async join(code, kind, me) {
    code = (code || '').toUpperCase().trim(); if (!isValidRoomCode(code)) throw new Error('Room codes are 6 characters (letters and numbers).');
    const t = makeTransport(kind, code, false); await t.connect();
    const r = new Room(t, false, me); r.bind();
    await new Promise((res, rej) => {
      const to = setTimeout(() => rej(new Error('The host did not respond.')), 8000);
      r.once('lobby', () => { clearTimeout(to); res(); }); r.once('rejected', (why) => { clearTimeout(to); rej(new Error(why)); });
      t.send(null, { t: 'hello', p: me });
    });
    return r;
  }
  once(e, f) { const off = this.on(e, (...a) => { off(); f(...a); }); }

  bind() {
    this.t.on('message', (from, m) => this.onMsg(from, m));
    this.t.on('leave', (id) => {
      if (this.isHost) { this.players = this.players.filter((p) => p.peerId !== id); this.broadcastLobby(); this.emit('leave', id); }
      else if (id === 'host') { this.emit('closed', 'The host closed the room.'); this.closed = true; }
    });
  }
  onMsg(from, m) {
    if (!m || typeof m !== 'object') return;
    if (this.isHost) {
      if (m.t === 'hello') {
        if (this.started) { this.t.send(from, { t: 'reject', why: 'Match already in progress.' }); return; }
        if (this.players.length >= (this.settings.maxPlayers || 8)) { this.t.send(from, { t: 'reject', why: 'Room is full.' }); return; }
        const p = sanitizePlayer(m.p); p.peerId = from; const others = this.players.filter((x) => x.peerId !== from);
        let n = p.name, k = 2; while (others.some((x) => x.name === n)) n = `${p.name.slice(0, 17)} ${k++}`; p.name = n;
        this.players = others.concat(p); this.broadcastLobby(); this.emit('update');
        return;
      }
      if (m.t === 'ready-toggle') { const p = this.players.find((x) => x.peerId === from); if (p) { p.ready = !!m.v; this.broadcastLobby(); this.emit('update'); } return; }
      if (m.t === 'update-me') { const p = this.players.find((x) => x.peerId === from); if (p) { Object.assign(p, sanitizePlayer(m.p), { peerId: from }); this.broadcastLobby(); this.emit('update'); } return; }
    } else {
      if (m.t === 'lobby') { this.players = m.players; this.settings = m.settings; this.myPeer = this.t.id; this.emit('lobby'); this.emit('update'); return; }
      if (m.t === 'reject') { this.emit('rejected', m.why); return; }
      if (m.t === 'start') { this.started = true; this.emit('start', m); return; }
    }
    this.emit('game', from, m); // in-match traffic handled by NetSync
  }
  broadcastLobby() { if (this.isHost) this.t.send(null, { t: 'lobby', players: this.players, settings: this.settings }); }
  updateSettings(s) { this.settings = { ...this.settings, ...s }; this.broadcastLobby(); this.emit('update'); }
  setReady(v) { if (!this.isHost) this.t.send(null, { t: 'ready-toggle', v }); }
  start(seed) {
    if (!this.isHost) return; this.started = true;
    const msg = { t: 'start', seed, settings: this.settings, players: this.players };
    this.t.send(null, msg); return msg;
  }
  inviteLink() { const u = new URL(location.href); u.search = ''; u.hash = ''; u.searchParams.set('join', this.code); u.searchParams.set('net', this.kind); let ps = null; try { ps = sessionStorage.getItem('clayfront.peer'); } catch (e) { /* ignore */ } if (ps && this.kind === 'online') u.searchParams.set('peer', ps); return u.toString(); }
  send(to, m) { this.t.send(to, m); }
  leave() { this.closed = true; this.t.close(); }
}

function sanitizePlayer(p = {}) {
  const s = (v, n = 24) => String(v ?? '').replace(/[<>]/g, '').slice(0, n);
  return { name: s(p.name, 20) || 'Player', charId: s(p.charId, 20), custom: p.custom && typeof p.custom === 'object' ? Object.fromEntries(Object.entries(p.custom).slice(0, 10).map(([k, v]) => [s(k, 12), s(v, 12)])) : {}, loadout: p.loadout && typeof p.loadout === 'object' ? p.loadout : null, ready: !!p.ready };
}
