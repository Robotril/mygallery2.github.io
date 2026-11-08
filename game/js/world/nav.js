// Ground-level navigation grid built from the collision world, with budgeted A* and line-of-walk smoothing.
import { F_SOLID } from './collision.js';

export class NavGrid {
  constructor(world, navBase, cell = 1) {
    this.world = world; this.cell = cell; const B = world.bounds;
    this.x0 = B.minX; this.z0 = B.minZ; this.w = Math.ceil((B.maxX - B.minX) / cell); this.h = Math.ceil((B.maxZ - B.minZ) / cell);
    const N = this.w * this.h; this.floor = new Float32Array(N); this.ok = new Uint8Array(N);
    const tmp = []; const R = 0.42;
    for (let j = 0; j < this.h; j++) for (let i = 0; i < this.w; i++) {
      const x = this.x0 + (i + 0.5) * cell, z = this.z0 + (j + 0.5) * cell; const k = j * this.w + i;
      const t = world.terrain(x, z); const base = navBase ? Math.max(t, navBase(x, z)) : t;
      const list = world.query(x - R, z - R, x + R, z + R, tmp, F_SOLID);
      let f = t; for (const b of list) if (b.y1 <= base + 2.2 && b.y1 > f) f = b.y1;
      let blocked = false; for (const b of list) if (b.y1 > f + 0.45 && b.y0 < f + 1.8) { blocked = true; break; }
      if (world.water > -100 && f < world.water - 1.3) blocked = true;
      if (i < 2 || j < 2 || i >= this.w - 2 || j >= this.h - 2) blocked = true;
      this.floor[k] = f; this.ok[k] = blocked ? 0 : 1;
    }
    // drop isolated walkable islands that are unreachable via neighbors
    this.g = new Float32Array(N); this.f = new Float32Array(N); this.came = new Int32Array(N); this.stamp = new Uint32Array(N); this.closed = new Uint32Array(N); this.run = 1;
    this.heap = new Int32Array(N); this.heapN = 0;
  }
  idx(x, z) { const i = Math.floor((x - this.x0) / this.cell), j = Math.floor((z - this.z0) / this.cell); if (i < 0 || j < 0 || i >= this.w || j >= this.h) return -1; return j * this.w + i; }
  center(k) { return { x: this.x0 + ((k % this.w) + 0.5) * this.cell, z: this.z0 + (Math.floor(k / this.w) + 0.5) * this.cell, y: this.floor[k] }; }
  walkable(x, z) { const k = this.idx(x, z); return k >= 0 && this.ok[k] === 1; }
  nearestWalkable(x, z, maxR = 6) {
    const k = this.idx(x, z); if (k >= 0 && this.ok[k]) return k;
    const ci = Math.floor((x - this.x0) / this.cell), cj = Math.floor((z - this.z0) / this.cell);
    for (let r = 1; r <= maxR; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      if (Math.abs(di) !== r && Math.abs(dj) !== r) continue; const i = ci + di, j = cj + dj;
      if (i < 0 || j < 0 || i >= this.w || j >= this.h) continue; const q = j * this.w + i; if (this.ok[q]) return q;
    }
    return -1;
  }
  canStep(a, b) { return this.ok[b] && Math.abs(this.floor[a] - this.floor[b]) <= 0.6; }

  // A* returning array of {x,y,z} waypoints (smoothed) or null.
  findPath(sx, sz, gx, gz, budget = 9000) {
    const s = this.nearestWalkable(sx, sz), g = this.nearestWalkable(gx, gz); if (s < 0 || g < 0) return null;
    if (s === g) return [this.center(g)];
    const run = ++this.run; const W = this.w; const gxI = g % W, gzI = Math.floor(g / W);
    const H = (k) => { const dx = Math.abs((k % W) - gxI), dz = Math.abs(Math.floor(k / W) - gzI); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
    this.heapN = 0; this.stamp[s] = run; this.g[s] = 0; this.f[s] = H(s); this.came[s] = -1; this.push(s);
    let it = 0, best = s, bestH = H(s);
    while (this.heapN && it++ < budget) {
      const cur = this.pop(); if (cur === g) { best = g; break; }
      if (this.closed[cur] === run) continue; this.closed[cur] = run;
      const ci = cur % W, cj = Math.floor(cur / W);
      for (let d = 0; d < 8; d++) {
        const di = DX[d], dj = DZ[d]; const ni = ci + di, nj = cj + dj; if (ni < 0 || nj < 0 || ni >= W || nj >= this.h) continue;
        const nk = nj * W + ni; if (!this.canStep(cur, nk)) continue;
        if (di && dj && (!this.ok[cj * W + ni] || !this.ok[nj * W + ci])) continue; // no corner cutting
        const ng = this.g[cur] + (di && dj ? 1.414 : 1);
        if (this.stamp[nk] !== run || ng < this.g[nk]) {
          this.stamp[nk] = run; this.g[nk] = ng; const h = H(nk); this.f[nk] = ng + h; this.came[nk] = cur; this.push(nk);
          if (h < bestH) { bestH = h; best = nk; }
        }
      }
    }
    // reconstruct (to goal or closest reached)
    const raw = []; let k = best; let guard = 0; while (k !== -1 && guard++ < 20000) { raw.push(k); k = this.came[k]; }
    raw.reverse();
    return this.smooth(raw);
  }
  smooth(raw) {
    if (raw.length <= 2) return raw.map((k) => this.center(k));
    const out = [this.center(raw[0])]; let anchor = 0;
    for (let i = 2; i < raw.length; i++) { if (!this.lineWalk(raw[anchor], raw[i])) { out.push(this.center(raw[i - 1])); anchor = i - 1; } }
    out.push(this.center(raw[raw.length - 1])); return out;
  }
  lineWalk(a, b) {
    const W = this.w; let x0 = a % W, z0 = Math.floor(a / W); const x1 = b % W, z1 = Math.floor(b / W);
    const dx = Math.abs(x1 - x0), dz = Math.abs(z1 - z0), sx = x0 < x1 ? 1 : -1, sz = z0 < z1 ? 1 : -1; let err = dx - dz; let prev = a;
    for (let n = 0; n < 400; n++) {
      if (x0 === x1 && z0 === z1) return true;
      const e2 = 2 * err; if (e2 > -dz) { err -= dz; x0 += sx; } if (e2 < dx) { err += dx; z0 += sz; }
      const k = z0 * W + x0; if (!this.canStep(prev, k)) return false; prev = k;
    }
    return false;
  }
  push(k) { const h = this.heap, f = this.f; let i = this.heapN++; h[i] = k; while (i > 0) { const p = (i - 1) >> 1; if (f[h[p]] <= f[h[i]]) break; const t = h[p]; h[p] = h[i]; h[i] = t; i = p; } }
  pop() { const h = this.heap, f = this.f; const top = h[0]; const last = h[--this.heapN]; if (this.heapN > 0) { h[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < this.heapN && f[h[l]] < f[h[m]]) m = l; if (r < this.heapN && f[h[r]] < f[h[m]]) m = r; if (m === i) break; const t = h[m]; h[m] = h[i]; h[i] = t; i = m; } } return top; }
  randomWalkable(r, cx, cz, rad) {
    for (let n = 0; n < 60; n++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * rad; const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d; const k = this.idx(x, z); if (k >= 0 && this.ok[k]) return this.center(k); }
    return null;
  }
}
const DX = [1, -1, 0, 0, 1, 1, -1, -1], DZ = [0, 0, 1, -1, 1, -1, 1, -1];
