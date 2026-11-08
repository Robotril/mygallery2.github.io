// Network transports. All share one interface so a dedicated authoritative server (WebSocket) can be dropped in later:
//   id, isHost, send(to|null, data), on('message', (from, data)), on('join', id), on('leave', id), close()
// Topology is a star: clients talk to the host; the host relays/broadcasts.
import { Emitter, makeRoomCode } from '../core/util.js';

const PREFIX = 'clayfront-v1-';

// Same-device play across browser tabs/windows (no network needed).
export class LocalTabTransport extends Emitter {
  constructor(code, isHost) { super(); this.code = code; this.isHost = isHost; this.id = isHost ? 'host' : 'tab-' + makeRoomCode(5); this.kind = 'local'; this.peers = new Set(); }
  async connect() {
    if (!('BroadcastChannel' in window)) throw new Error('This browser does not support same-device rooms.');
    this.ch = new BroadcastChannel(PREFIX + this.code);
    this.ch.onmessage = (e) => {
      const m = e.data; if (!m || m.from === this.id) return; if (m.to && m.to !== this.id) return;
      if (m.sys === 'hello' && this.isHost) { const fresh = !this.peers.has(m.from); this.peers.add(m.from); this.raw(m.from, { sys: 'welcome' }); if (fresh) this.emit('join', m.from); return; }
      if (m.sys === 'welcome' && !this.isHost) { this._welcomed?.(); return; }
      if (m.sys === 'bye') { if (this.isHost) { this.peers.delete(m.from); this.emit('leave', m.from); } else if (m.from === 'host') this.emit('leave', 'host'); return; }
      if (m.sys === 'ping' && this.isHost && !this.peers.has(m.from)) return;
      if (m.data !== undefined) this.emit('message', m.from, m.data);
    };
    window.addEventListener('beforeunload', this._bye = () => this.raw(null, { sys: 'bye' }));
    if (!this.isHost) await new Promise((res, rej) => {
      const iv = setInterval(() => this.raw('host', { sys: 'hello' }), 700);
      const to = setTimeout(() => { clearInterval(iv); this._welcomed = null; rej(new Error(`No room ${this.code} is open on this device. The host must keep their tab open.`)); }, 4000);
      this._welcomed = () => { clearInterval(iv); clearTimeout(to); this._welcomed = null; res(); };
      this.raw('host', { sys: 'hello' });
    });
  }
  raw(to, o) { this.ch?.postMessage({ from: this.id, to, ...o }); }
  send(to, data) { if (this.isHost) this.raw(to, { data }); else this.raw('host', { data }); }
  close() { this.raw(null, { sys: 'bye' }); window.removeEventListener('beforeunload', this._bye); this.ch?.close(); this.ch = null; }
}

// Cross-device play over WebRTC data channels (PeerJS public signaling broker; gameplay traffic is peer-to-peer).
export class PeerTransport extends Emitter {
  constructor(code, isHost) { super(); this.code = code; this.isHost = isHost; this.kind = 'online'; this.conns = new Map(); this.id = null; }
  async connect() {
    if (!window.Peer) throw new Error('Peer-to-peer library failed to load. Check your connection.');
    const hostId = PREFIX + this.code.toLowerCase();
    const opts = peerServerOptions();
    const peer = this.peer = this.isHost ? new window.Peer(hostId, opts) : new window.Peer(undefined, opts);
    await new Promise((res, rej) => {
      const to = setTimeout(() => rej(new Error('Could not reach the matchmaking broker. Check your internet connection.')), 12000);
      peer.on('open', (id) => { clearTimeout(to); this.id = this.isHost ? 'host' : id; res(); });
      peer.on('error', (e) => { clearTimeout(to); rej(new Error(e.type === 'unavailable-id' ? 'That room code is already in use. Try again.' : e.type === 'peer-unavailable' ? 'Room not found.' : (e.message || 'Network error'))); });
    });
    peer.on('error', (e) => this.emit('error', e));
    if (this.isHost) {
      peer.on('connection', (conn) => {
        conn.on('open', () => { this.conns.set(conn.peer, conn); this.emit('join', conn.peer); });
        conn.on('data', (d) => this.emit('message', conn.peer, d));
        conn.on('close', () => { this.conns.delete(conn.peer); this.emit('leave', conn.peer); });
      });
    } else {
      const conn = peer.connect(hostId, { reliable: true, serialization: 'json' });
      await new Promise((res, rej) => {
        const to = setTimeout(() => rej(new Error(`Room ${this.code} not found or host unreachable.`)), 12000);
        conn.on('open', () => { clearTimeout(to); res(); });
        peer.on('error', (e) => { if (e.type === 'peer-unavailable') { clearTimeout(to); rej(new Error(`Room ${this.code} not found.`)); } });
      });
      this.hostConn = conn; conn.on('data', (d) => this.emit('message', 'host', d)); conn.on('close', () => this.emit('leave', 'host'));
    }
  }
  send(to, data) {
    if (!this.isHost) { if (this.hostConn?.open) this.hostConn.send(data); return; }
    if (to) { const c = this.conns.get(to); if (c?.open) c.send(data); }
    else for (const c of this.conns.values()) if (c.open) c.send(data);
  }
  close() { try { this.peer?.destroy(); } catch (e) { /* ignore */ } this.conns.clear(); }
}

// Placeholder for the future dedicated authoritative server (same interface, WebSocket based).
export class ServerTransport extends Emitter {
  constructor(url, code) { super(); this.url = url; this.code = code; this.isHost = false; this.kind = 'server'; }
  async connect() { throw new Error('Dedicated servers are not available yet.'); }
}

// Optional self-hosted signaling server: ?peer=host:port[/path] (kept for the session). Default: PeerJS public cloud broker.
export function peerServerOptions() {
  let v = new URLSearchParams(location.search).get('peer'); try { if (v) sessionStorage.setItem('clayfront.peer', v); else v = sessionStorage.getItem('clayfront.peer'); } catch (e) { /* storage blocked */ }
  if (!v) return { debug: 0 };
  const m = v.match(/^([^:/]+)(?::(\d+))?(\/.*)?$/); if (!m) return { debug: 0 };
  const local = /^(localhost|127\.|192\.168\.|10\.)/.test(m[1]);
  return { debug: 0, host: m[1], port: Number(m[2] || (local ? 9000 : 443)), path: m[3] || '/myapp', secure: !local && location.protocol === 'https:' };
}

export function makeTransport(kind, code, isHost) { return kind === 'online' ? new PeerTransport(code, isHost) : new LocalTabTransport(code, isHost); }
