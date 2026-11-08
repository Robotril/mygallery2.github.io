// Shared math / random helpers. Kept dependency-free so they can run on a future headless server.

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const TAU = Math.PI * 2;

export function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

export function dampAngle(a, b, lambda, dt) {
  return a + angleDiff(a, b) * (1 - Math.exp(-lambda * dt));
}

// Deterministic PRNG so every peer builds identical maps from the same seed.
export function mulberry32(seed) {
  let a = seed >>> 0;
  const f = () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.range = (lo, hi) => lo + f() * (hi - lo);
  f.int = (lo, hi) => Math.floor(lo + f() * (hi - lo + 1));
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  f.chance = (p) => f() < p;
  return f;
}

export const rng = mulberry32((Math.random() * 2 ** 32) >>> 0);

export function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// Smooth value noise used by terrain + procedural textures.
export function makeNoise2D(seed = 1) {
  const r = mulberry32(seed);
  const perm = new Uint8Array(512);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const grad = new Float32Array(256 * 2);
  for (let i = 0; i < 256; i++) { const a = r() * TAU; grad[i * 2] = Math.cos(a); grad[i * 2 + 1] = Math.sin(a); }
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  function n(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const X = xi & 255, Y = yi & 255;
    const g = (ix, iy, dx, dy) => { const h = perm[ix + perm[iy]] * 2; return grad[h] * dx + grad[h + 1] * dy; };
    const u = fade(xf), v = fade(yf);
    const a = g(X, Y, xf, yf), b = g(X + 1, Y, xf - 1, yf);
    const c = g(X, Y + 1, xf, yf - 1), d = g(X + 1, Y + 1, xf - 1, yf - 1);
    return lerp(lerp(a, b, u), lerp(c, d, u), v) * 1.4;
  }
  n.fbm = (x, y, oct = 4) => { let s = 0, amp = 0.5, f = 1; for (let i = 0; i < oct; i++) { s += n(x * f, y * f) * amp; f *= 2; amp *= 0.5; } return s; };
  return n;
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function makeRoomCode(len = 6) {
  let s = '';
  const buf = new Uint32Array(len);
  (globalThis.crypto || { getRandomValues: (b) => b.map(() => Math.random() * 1e9) }).getRandomValues(buf);
  for (let i = 0; i < len; i++) s += CODE_CHARS[buf[i] % CODE_CHARS.length];
  return s;
}
export const isValidRoomCode = (c) => /^[A-HJ-NP-Z2-9]{6}$/.test(c);

const FIRST = ['Rex', 'Moss', 'Blaze', 'Pixel', 'Nova', 'Grit', 'Echo', 'Fizz', 'Kilo', 'Sable', 'Dusty', 'Viper', 'Mango', 'Tank', 'Juno', 'Ozzy', 'Raven', 'Pebble', 'Ziggy', 'Bolt', 'Cobra', 'Lumen', 'Sarge', 'Taffy', 'Brick', 'Nimbus', 'Rook', 'Coco', 'Flint', 'Hex', 'Ivy', 'Jinx', 'Kona', 'Lynx', 'Mocha', 'Nacho', 'Onyx', 'Puddle', 'Quill', 'Rumble', 'Sprout', 'Tofu', 'Umbra', 'Vex', 'Waffle', 'Yeti', 'Zest', 'Bongo', 'Crumb', 'Doodle'];
const SUFFIX = ['', '', '', 'X', '99', '_TTV', 'Jr', '7', 'Prime', 'GG', '42', 'Zero', 'Pro', '3000', '_ok', 'Mk2'];
export function botName(r = rng) { return r.pick(FIRST) + r.pick(SUFFIX); }

export function formatTime(s) {
  s = Math.max(0, Math.ceil(s));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export class Pool {
  constructor(create, size = 0) { this.create = create; this.items = []; for (let i = 0; i < size; i++) this.items.push(create()); }
  get() { return this.items.length ? this.items.pop() : this.create(); }
  release(o) { this.items.push(o); }
}

export class Emitter {
  constructor() { this.l = {}; }
  on(e, f) { (this.l[e] ||= []).push(f); return () => this.off(e, f); }
  off(e, f) { const a = this.l[e]; if (a) { const i = a.indexOf(f); if (i >= 0) a.splice(i, 1); } }
  emit(e, ...args) { const a = this.l[e]; if (a) for (const f of a.slice()) f(...args); }
}

export const isTouchDevice = () => ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
export const isMobileUA = () => /Android|iPhone|iPad|iPod|Mobile|Silk/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
