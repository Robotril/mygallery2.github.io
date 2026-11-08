// Procedural canvas textures (no external art). Resolution follows the active graphics preset.
import * as THREE from 'three';
import { makeNoise2D, mulberry32 } from '../core/util.js';

let TEX_SIZE = 512;
let anisotropy = 4;
export function setTextureQuality(size, aniso) { TEX_SIZE = size; anisotropy = aniso; cache.clear(); }
const cache = new Map();
const noise = makeNoise2D(7);

function canvas(size = TEX_SIZE) { const c = document.createElement('canvas'); c.width = c.height = size; return c; }
function toTex(c, { repeat = true, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = anisotropy;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}
function cached(key, fn) { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); }

// Fill pixels with a function returning [r,g,b] 0..255. Tileable noise via wrapped sampling.
function pixels(c, fn) {
  const ctx = c.getContext('2d'); const s = c.width; const img = ctx.createImageData(s, s); const d = img.data;
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const [r, g, b] = fn(x / s, y / s); const i = (y * s + x) * 4;
    d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0); return ctx;
}
// Periodic noise: blend 4 samples so textures tile seamlessly.
function tnoise(u, v, f, oct = 4) {
  const a = noise.fbm(u * f, v * f, oct), b = noise.fbm((u - 1) * f, v * f, oct);
  const c = noise.fbm(u * f, (v - 1) * f, oct), d = noise.fbm((u - 1) * f, (v - 1) * f, oct);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

export const clayBump = () => cached('clayBump', () => {
  const c = canvas(Math.min(512, TEX_SIZE)); const r = mulberry32(3);
  const ctx = pixels(c, (u, v) => { const n = 128 + tnoise(u, v, 6, 5) * 70 + tnoise(u, v, 24, 2) * 25; return [n, n, n]; });
  // thumbprint swirls give a hand-sculpted feel
  ctx.globalAlpha = 0.08; ctx.strokeStyle = '#000'; ctx.lineWidth = Math.max(1, c.width / 256);
  for (let i = 0; i < 22; i++) {
    const x = r() * c.width, y = r() * c.width, rad = 6 + r() * 18;
    for (let k = 0; k < 6; k++) { const rr = rad - k * 2.5; if (rr <= 1) break; ctx.beginPath(); ctx.ellipse(x, y, rr, rr * 0.7, r() * 3, 0, Math.PI * 2); ctx.stroke(); }
  }
  return toTex(c, { srgb: false });
});

export const sand = () => cached('sand', () => {
  const c = canvas(); pixels(c, (u, v) => {
    const n = tnoise(u, v, 8, 5), g = (Math.random() - 0.5) * 30, rip = Math.sin((v + tnoise(u, v, 3, 2) * 0.15) * 90) * 6;
    return [222 + n * 30 + g + rip, 200 + n * 28 + g + rip, 158 + n * 22 + g];
  }); return toTex(c);
});
export const wetSand = () => cached('wetSand', () => {
  const c = canvas(); pixels(c, (u, v) => { const n = tnoise(u, v, 8, 5), g = (Math.random() - 0.5) * 18; return [176 + n * 25 + g, 150 + n * 22 + g, 112 + n * 18 + g]; }); return toTex(c);
});
export const grass = () => cached('grass', () => {
  const c = canvas(); pixels(c, (u, v) => { const n = tnoise(u, v, 10, 5), g = (Math.random() - 0.5) * 40; return [88 + n * 30 + g * 0.5, 148 + n * 40 + g, 62 + n * 20]; }); return toTex(c);
});
export const asphalt = () => cached('asphalt', () => {
  const c = canvas(); pixels(c, (u, v) => { const n = tnoise(u, v, 12, 4), g = (Math.random() - 0.5) * 50; const s = Math.random() < 0.02 ? 40 : 0; const k = 70 + n * 18 + g * 0.4 + s; return [k, k, k + 4]; }); return toTex(c);
});
export const concrete = () => cached('concrete', () => {
  const c = canvas(); const ctx = pixels(c, (u, v) => { const n = tnoise(u, v, 5, 5), g = (Math.random() - 0.5) * 22; const k = 196 + n * 34 + g; return [k, k - 2, k - 6]; });
  ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 2; ctx.strokeRect(0, 0, c.width, c.width);
  return toTex(c);
});
export const plaster = () => cached('plaster', () => {
  const c = canvas(); pixels(c, (u, v) => { const n = tnoise(u, v, 9, 5), g = (Math.random() - 0.5) * 14; const k = 232 + n * 22 + g; return [k, k, k]; }); return toTex(c);
});
export const rock = () => cached('rock', () => {
  const c = canvas(); pixels(c, (u, v) => { const n = tnoise(u, v, 4, 6), cr = Math.abs(tnoise(u, v, 9, 3)) < 0.03 ? -40 : 0; const k = 140 + n * 60 + cr; return [k + 6, k, k - 8]; }); return toTex(c);
});
export const brick = () => cached('brick', () => {
  const c = canvas(); const ctx = c.getContext('2d'); const s = c.width; const r = mulberry32(5);
  ctx.fillStyle = '#c9c2b8'; ctx.fillRect(0, 0, s, s);
  const rows = 8, cols = 4, bh = s / rows, bw = s / cols;
  for (let y = 0; y < rows; y++) for (let x = -1; x < cols; x++) {
    const off = (y % 2) * bw / 2; const h = 10 + r() * 14, l = 38 + r() * 14;
    ctx.fillStyle = `hsl(${h},${45 + r() * 15}%,${l}%)`; ctx.fillRect(x * bw + off + 2, y * bh + 2, bw - 4, bh - 4);
  }
  return toTex(c);
});
export const wood = () => cached('wood', () => {
  const c = canvas(); const s = c.width; const ctx = pixels(c, (u, v) => { const n = tnoise(u * 0.25, v * 3, 6, 4); const gr = Math.sin((u * 40 + n * 6)) * 12; return [150 + gr + n * 30, 104 + gr * 0.8 + n * 22, 66 + gr * 0.5 + n * 12]; });
  ctx.fillStyle = 'rgba(40,20,5,0.55)'; for (let i = 0; i <= 4; i++) ctx.fillRect(i * s / 4 - 1, 0, 2, s);
  return toTex(c);
});
export const metal = () => cached('metal', () => {
  const c = canvas(); pixels(c, (u, v) => { const n = tnoise(u * 0.1, v * 8, 8, 3), g = (Math.random() - 0.5) * 10; const k = 175 + n * 25 + g; return [k, k + 2, k + 6]; }); return toTex(c);
});
export const tiles = () => cached('tiles', () => {
  const c = canvas(); const ctx = c.getContext('2d'); const s = c.width; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = Math.max(1, s / 200);
  for (let i = 0; i <= 8; i++) { ctx.beginPath(); ctx.moveTo(i * s / 8, 0); ctx.lineTo(i * s / 8, s); ctx.moveTo(0, i * s / 8); ctx.lineTo(s, i * s / 8); ctx.stroke(); }
  return toTex(c);
});
export const fabricStripes = () => cached('stripes', () => {
  const c = canvas(256); const ctx = c.getContext('2d'); for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? '#ffffff' : '#bbbbbb'; ctx.fillRect(i * 32, 0, 32, 256); } return toTex(c);
});
export const leaf = () => cached('leaf', () => {
  const c = canvas(); pixels(c, (u, v) => { const n = tnoise(u, v, 14, 4); return [70 + n * 40, 140 + n * 60, 50 + n * 25]; }); return toTex(c);
});

// Building facades: diffuse window grid + emissive lit windows.
export function facade(kind = 'office') {
  return cached('facade_' + kind, () => {
    const s = TEX_SIZE; const c = canvas(s), e = canvas(s); const ctx = c.getContext('2d'), ex = e.getContext('2d');
    const r = mulberry32(kind.length * 31 + 7);
    const cols = kind === 'apartment' ? 4 : 6, rows = 4;
    ctx.fillStyle = kind === 'apartment' ? '#d8cfc2' : '#8d98a3'; ctx.fillRect(0, 0, s, s);
    ex.fillStyle = '#000'; ex.fillRect(0, 0, s, s);
    const cw = s / cols, rh = s / rows;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const mx = kind === 'apartment' ? cw * 0.22 : cw * 0.08, my = rh * (kind === 'apartment' ? 0.25 : 0.12);
      const gx = x * cw + mx, gy = y * rh + my, gw = cw - mx * 2, gh = rh - my * 2;
      const lit = r() < (kind === 'tower' ? 0.45 : 0.32);
      const grd = ctx.createLinearGradient(gx, gy, gx + gw, gy + gh);
      grd.addColorStop(0, '#2d4a66'); grd.addColorStop(0.5, '#6f93b3'); grd.addColorStop(1, '#22384d');
      ctx.fillStyle = grd; ctx.fillRect(gx, gy, gw, gh);
      if (lit) { const warm = r() < 0.7; ex.fillStyle = warm ? `rgba(255,${190 + r() * 40},${110 + r() * 40},${0.55 + r() * 0.4})` : `rgba(160,210,255,${0.5 + r() * 0.4})`; ex.fillRect(gx, gy, gw, gh); }
      if (kind === 'apartment') { ctx.fillStyle = '#6b4a35'; ctx.fillRect(gx - 4, gy + gh, gw + 8, 6); }
    }
    return { map: toTex(c), emissive: toTex(e) };
  });
}

// Weapon skin patterns
export function skinTexture(skin) {
  if (!skin || skin.pattern === 'none') return null;
  return cached('skin_' + skin.id, () => {
    const c = canvas(256); const ctx = c.getContext('2d'); const r = mulberry32(skin.id.length * 13); const [a, b, d] = skin.colors;
    ctx.fillStyle = a; ctx.fillRect(0, 0, 256, 256);
    if (skin.pattern === 'camo') { for (let i = 0; i < 40; i++) { ctx.fillStyle = r() < 0.5 ? b : d; ctx.beginPath(); ctx.ellipse(r() * 256, r() * 256, 10 + r() * 30, 6 + r() * 18, r() * 3, 0, 7); ctx.fill(); } }
    else if (skin.pattern === 'digital') { for (let i = 0; i < 260; i++) { ctx.fillStyle = r() < 0.5 ? b : d; const sz = 8 * (1 + Math.floor(r() * 3)); ctx.fillRect(Math.floor(r() * 32) * 8, Math.floor(r() * 32) * 8, sz, sz); } }
    else if (skin.pattern === 'tiger') { ctx.fillStyle = b; for (let i = 0; i < 18; i++) { const y = r() * 256; ctx.beginPath(); ctx.moveTo(0, y); for (let x = 0; x <= 256; x += 16) ctx.lineTo(x, y + Math.sin(x * 0.05 + i) * 10 + (r() - 0.5) * 8); ctx.lineTo(256, y + 8 + r() * 6); ctx.lineTo(0, y + 6); ctx.fill(); } }
    else if (skin.pattern === 'swirl') { for (let i = 0; i < 30; i++) { ctx.strokeStyle = [b, d][i % 2]; ctx.lineWidth = 6 + r() * 8; ctx.beginPath(); ctx.arc(r() * 256, r() * 256, 10 + r() * 50, r() * 6, r() * 6 + 3); ctx.stroke(); } }
    else if (skin.pattern === 'neon') { ctx.lineWidth = 3; for (let i = 0; i < 26; i++) { ctx.strokeStyle = [b, d][i % 2]; ctx.beginPath(); let x = r() * 256, y = r() * 256; ctx.moveTo(x, y); for (let k = 0; k < 4; k++) { if (r() < 0.5) x += (r() - 0.5) * 120; else y += (r() - 0.5) * 120; ctx.lineTo(x, y); } ctx.stroke(); } }
    else if (skin.pattern === 'hex') { ctx.strokeStyle = b; ctx.lineWidth = 3; for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) { const cx = x * 28 + (y % 2) * 14, cy = y * 25; ctx.beginPath(); for (let k = 0; k < 6; k++) { const ang = k * Math.PI / 3; ctx.lineTo(cx + Math.cos(ang) * 13, cy + Math.sin(ang) * 13); } ctx.closePath(); ctx.stroke(); if (r() < 0.12) { ctx.fillStyle = d; ctx.fill(); } } }
    else if (skin.pattern === 'gold') { const g = ctx.createLinearGradient(0, 0, 256, 256); g.addColorStop(0, d); g.addColorStop(0.5, a); g.addColorStop(1, b); ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256); }
    return toTex(c);
  });
}

// Neon sign / billboard text
export function signTexture(text, fg = '#ff2bd6', bg = 'rgba(0,0,0,0)', w = 512, h = 128, font = 'bold 84px "Arial Black", Arial, sans-serif') {
  return cached(`sign_${text}_${fg}_${bg}_${w}`, () => {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const ctx = c.getContext('2d');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = fg; ctx.shadowBlur = 18; ctx.fillStyle = fg; ctx.fillText(text, w / 2, h / 2 + 4, w * 0.92);
    ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.6; ctx.fillText(text, w / 2, h / 2 + 4, w * 0.92);
    const t = toTex(c, { repeat: false }); return t;
  });
}
// Pack many signs into one atlas texture so they render in a single draw call.
export function signAtlas(list) {
  const cw = TEX_SIZE >= 1024 ? 512 : 256, ch = cw / 4, cols = 4, rows = Math.ceil(list.length / cols);
  const c = document.createElement('canvas'); c.width = cw * cols; c.height = Math.max(ch, rows * ch); const x = c.getContext('2d');
  const scale = cw / 512; const uvs = [];
  list.forEach((s, i) => {
    const ox = (i % cols) * cw, oy = Math.floor(i / cols) * ch;
    x.save(); x.beginPath(); x.rect(ox, oy, cw, ch); x.clip(); x.translate(ox, oy); x.scale(scale, scale);
    x.fillStyle = s.bg || 'rgba(0,0,0,0)'; x.fillRect(0, 0, 512, 128); x.font = 'bold 84px "Arial Black", Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.shadowColor = s.color; x.shadowBlur = 18; x.fillStyle = s.color; x.fillText(s.text, 256, 68, 470); x.shadowBlur = 0; x.fillStyle = '#fff'; x.globalAlpha = 0.6; x.fillText(s.text, 256, 68, 470);
    x.restore();
    uvs.push([ox / c.width, 1 - (oy + ch) / c.height, (ox + cw) / c.width, 1 - oy / c.height]);
  });
  const t = toTex(c, { repeat: false }); t.anisotropy = 1; return { tex: t, uvs };
}

export function billboardTexture(title, sub, c1, c2) {
  return cached(`bb_${title}`, () => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 256; const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 512, 256); g.addColorStop(0, c1); g.addColorStop(1, c2); ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(80 + i * 80, 200 - i * 20, 40 + i * 6, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#fff'; ctx.font = 'bold 64px "Arial Black", Arial'; ctx.textAlign = 'center'; ctx.fillText(title, 256, 120);
    ctx.font = 'bold 28px Arial'; ctx.fillText(sub, 256, 180);
    return toTex(c, { repeat: false });
  });
}

export function radialGlow() {
  return cached('glow', () => {
    const c = document.createElement('canvas'); c.width = c.height = 64; const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64); return toTex(c, { repeat: false });
  });
}
