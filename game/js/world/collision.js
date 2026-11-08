// Collision world: axis-aligned boxes in a spatial hash + a terrain heightmap.
// Pure math (no THREE) so a future authoritative server can run identical physics.

export const F_SOLID = 1, F_BULLET = 2, F_SIGHT = 4, F_GLASS = 8, F_WATER = 16;
export const F_ALL = F_SOLID | F_BULLET | F_SIGHT;

export class CollisionWorld {
  constructor({ minX, maxX, minZ, maxZ, terrain, water = -999, cell = 8 }) {
    this.bounds = { minX, maxX, minZ, maxZ };
    this.boxes = [];
    this.cell = cell;
    this.grid = new Map();
    this.q = 1;
    this.water = water;
    this.smokes = []; // {x,y,z,r,until}
    // Heightmap covering bounds + margin at 1m resolution
    this.hmMinX = Math.floor(minX) - 40; this.hmMinZ = Math.floor(minZ) - 40;
    this.hmW = Math.ceil(maxX - minX) + 81; this.hmH = Math.ceil(maxZ - minZ) + 81;
    this.hm = new Float32Array(this.hmW * this.hmH);
    this.terrainFn = terrain || (() => 0);
    for (let j = 0; j < this.hmH; j++) for (let i = 0; i < this.hmW; i++) this.hm[j * this.hmW + i] = this.terrainFn(this.hmMinX + i, this.hmMinZ + j);
    this.flat = !terrain;
    this.hmMax = -Infinity; for (let i = 0; i < this.hm.length; i++) if (this.hm[i] > this.hmMax) this.hmMax = this.hm[i];
  }

  terrain(x, z) {
    if (this.flat) return 0;
    let fx = x - this.hmMinX, fz = z - this.hmMinZ;
    if (fx < 0) fx = 0; if (fz < 0) fz = 0;
    if (fx > this.hmW - 1.001) fx = this.hmW - 1.001; if (fz > this.hmH - 1.001) fz = this.hmH - 1.001;
    const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, w = this.hmW, h = this.hm;
    const a = h[j * w + i], b = h[j * w + i + 1], c = h[(j + 1) * w + i], d = h[(j + 1) * w + i + 1];
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  }

  addBox(x0, y0, z0, x1, y1, z1, flags = F_ALL, data = null) {
    const b = { x0: Math.min(x0, x1), y0: Math.min(y0, y1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), y1: Math.max(y0, y1), z1: Math.max(z0, z1), flags, data, q: 0, dead: false, id: this.boxes.length };
    this.boxes.push(b);
    const c = this.cell;
    for (let ix = Math.floor(b.x0 / c); ix <= Math.floor(b.x1 / c); ix++)
      for (let iz = Math.floor(b.z0 / c); iz <= Math.floor(b.z1 / c); iz++) {
        const k = this.key(ix, iz); let arr = this.grid.get(k); if (!arr) this.grid.set(k, (arr = [])); arr.push(b);
      }
    return b;
  }
  key(ix, iz) { return (ix + 2048) * 4096 + (iz + 2048); }

  query(x0, z0, x1, z1, out, mask = F_SOLID) {
    out.length = 0; const q = ++this.q, c = this.cell;
    for (let ix = Math.floor(x0 / c); ix <= Math.floor(x1 / c); ix++)
      for (let iz = Math.floor(z0 / c); iz <= Math.floor(z1 / c); iz++) {
        const arr = this.grid.get(this.key(ix, iz)); if (!arr) continue;
        for (let n = 0; n < arr.length; n++) {
          const b = arr[n]; if (b.q === q || b.dead || !(b.flags & mask)) continue; b.q = q;
          if (b.x1 < x0 || b.x0 > x1 || b.z1 < z0 || b.z0 > z1) continue; out.push(b);
        }
      }
    return out;
  }

  // Highest walkable surface under (x,z) that is no higher than maxY.
  groundAt(x, z, r, maxY) {
    let h = this.terrain(x, z);
    const list = this.query(x - r, z - r, x + r, z + r, _tmp);
    for (let i = 0; i < list.length; i++) { const b = list[i]; if (b.y1 <= maxY && b.y1 > h) h = b.y1; }
    return h;
  }
  ceilingAt(x, z, r, fromY) {
    let c = Infinity; const list = this.query(x - r, z - r, x + r, z + r, _tmp);
    for (let i = 0; i < list.length; i++) { const b = list[i]; if (b.y0 >= fromY && b.y0 < c) c = b.y0; }
    return c;
  }

  // Push a vertical cylinder (feet at pos.y) out of solid boxes. Returns true if any collision.
  resolveCylinder(pos, r, height, stepUp) {
    let hit = false;
    for (let pass = 0; pass < 3; pass++) {
      const list = this.query(pos.x - r, pos.z - r, pos.x + r, pos.z + r, _tmp);
      let moved = false;
      for (let i = 0; i < list.length; i++) {
        const b = list[i];
        if (b.y1 <= pos.y + stepUp || b.y0 >= pos.y + height) continue;
        const cx = Math.max(b.x0, Math.min(pos.x, b.x1)), cz = Math.max(b.z0, Math.min(pos.z, b.z1));
        let dx = pos.x - cx, dz = pos.z - cz; const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-8) { const d = Math.sqrt(d2), push = r - d; pos.x += (dx / d) * push; pos.z += (dz / d) * push; }
        else { // center inside box: shortest exit
          const ex = [pos.x - b.x0 + r, b.x1 - pos.x + r, pos.z - b.z0 + r, b.z1 - pos.z + r];
          const m = Math.min(...ex);
          if (m === ex[0]) pos.x = b.x0 - r; else if (m === ex[1]) pos.x = b.x1 + r; else if (m === ex[2]) pos.z = b.z0 - r; else pos.z = b.z1 + r;
        }
        hit = moved = true;
      }
      if (!moved) break;
    }
    const B = this.bounds;
    if (pos.x < B.minX + r) { pos.x = B.minX + r; hit = true; } if (pos.x > B.maxX - r) { pos.x = B.maxX - r; hit = true; }
    if (pos.z < B.minZ + r) { pos.z = B.minZ + r; hit = true; } if (pos.z > B.maxZ - r) { pos.z = B.maxZ - r; hit = true; }
    return hit;
  }

  // Ray cast against boxes + terrain + water. Returns {t, nx,ny,nz, box, water, terrain} or null.
  raycast(ox, oy, oz, dx, dy, dz, maxT, mask = F_BULLET, out = _hit) {
    let best = maxT, bn = 0, bb = null;
    const c = this.cell; const q = ++this.q;
    // 2D DDA over XZ grid
    let ix = Math.floor(ox / c), iz = Math.floor(oz / c);
    const stepX = dx > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
    const tdx = Math.abs(dx) > 1e-9 ? Math.abs(c / dx) : Infinity, tdz = Math.abs(dz) > 1e-9 ? Math.abs(c / dz) : Infinity;
    let tmx = Math.abs(dx) > 1e-9 ? ((dx > 0 ? (ix + 1) * c - ox : ox - ix * c) / Math.abs(dx)) : Infinity;
    let tmz = Math.abs(dz) > 1e-9 ? ((dz > 0 ? (iz + 1) * c - oz : oz - iz * c) / Math.abs(dz)) : Infinity;
    let tCell = 0;
    for (let guard = 0; guard < 400; guard++) {
      const arr = this.grid.get(this.key(ix, iz));
      if (arr) for (let n = 0; n < arr.length; n++) {
        const b = arr[n]; if (b.q === q || b.dead || !(b.flags & mask)) continue; b.q = q;
        // slab test
        let t0 = 0, t1 = best, nAxis = 0;
        if (Math.abs(dx) < 1e-9) { if (ox < b.x0 || ox > b.x1) continue; } else {
          let a = (b.x0 - ox) / dx, bb2 = (b.x1 - ox) / dx; if (a > bb2) { const s = a; a = bb2; bb2 = s; }
          if (a > t0) { t0 = a; nAxis = dx > 0 ? -1 : 1; } if (bb2 < t1) t1 = bb2; if (t0 > t1) continue;
        }
        if (Math.abs(dy) < 1e-9) { if (oy < b.y0 || oy > b.y1) continue; } else {
          let a = (b.y0 - oy) / dy, bb2 = (b.y1 - oy) / dy; if (a > bb2) { const s = a; a = bb2; bb2 = s; }
          if (a > t0) { t0 = a; nAxis = dy > 0 ? -2 : 2; } if (bb2 < t1) t1 = bb2; if (t0 > t1) continue;
        }
        if (Math.abs(dz) < 1e-9) { if (oz < b.z0 || oz > b.z1) continue; } else {
          let a = (b.z0 - oz) / dz, bb2 = (b.z1 - oz) / dz; if (a > bb2) { const s = a; a = bb2; bb2 = s; }
          if (a > t0) { t0 = a; nAxis = dz > 0 ? -3 : 3; } if (bb2 < t1) t1 = bb2; if (t0 > t1) continue;
        }
        if (t0 < best && t0 >= 0) { best = t0; bn = nAxis; bb = b; }
      }
      const tNext = Math.min(tmx, tmz);
      if (best <= tNext || tNext > maxT) break;
      tCell = tNext;
      if (tmx < tmz) { tmx += tdx; ix += stepX; } else { tmz += tdz; iz += stepZ; }
    }
    out.box = bb; out.water = false; out.terrain = false;
    out.nx = bn === 1 ? 1 : bn === -1 ? -1 : 0; out.ny = bn === 2 ? 1 : bn === -2 ? -1 : 0; out.nz = bn === 3 ? 1 : bn === -3 ? -1 : 0;
    // terrain march
    if (!(dy >= 0 && oy > this.hmMax)) {
      const step = 1.25; let prevT = 0, prevAbove = oy - this.terrain(ox, oz);
      if (prevAbove > 0) for (let t = step; t < best + step; t += step) {
        const tt = Math.min(t, best); const y = oy + dy * tt, x = ox + dx * tt, z = oz + dz * tt;
        const above = y - this.terrain(x, z);
        if (above < 0) { // refine
          let lo = prevT, hi = tt; for (let k = 0; k < 6; k++) { const m = (lo + hi) / 2; if (oy + dy * m - this.terrain(ox + dx * m, oz + dz * m) < 0) hi = m; else lo = m; }
          best = hi; out.box = null; out.terrain = true; out.nx = 0; out.ny = 1; out.nz = 0; break;
        }
        prevT = tt; prevAbove = above; if (tt >= best) break;
        if (dy >= 0 && y > this.hmMax) break;
      }
    }
    // water plane
    if (mask & F_WATER && dy < 0 && oy > this.water) {
      const tw = (this.water - oy) / dy;
      if (tw < best && this.terrain(ox + dx * tw, oz + dz * tw) < this.water) { best = tw; out.water = true; out.box = null; out.terrain = false; out.nx = 0; out.ny = 1; out.nz = 0; }
    }
    if (best >= maxT) return null;
    out.t = best; return out;
  }

  lineOfSight(ax, ay, az, bx, by, bz) {
    const dx = bx - ax, dy = by - ay, dz = bz - az; const d = Math.hypot(dx, dy, dz); if (d < 1e-4) return true;
    if (this.raycast(ax, ay, az, dx / d, dy / d, dz / d, d - 0.3, F_SIGHT)) return false;
    // smoke volumes block sight
    const now = performance.now() / 1000;
    for (const s of this.smokes) {
      if (s.until < now) continue;
      // distance from sphere center to segment
      const t = Math.max(0, Math.min(1, ((s.x - ax) * dx + (s.y - ay) * dy + (s.z - az) * dz) / (d * d)));
      const px = ax + dx * t - s.x, py = ay + dy * t - s.y, pz = az + dz * t - s.z;
      if (px * px + py * py + pz * pz < s.r * s.r) return false;
    }
    return true;
  }
  inBounds(x, z, m = 0) { const B = this.bounds; return x > B.minX + m && x < B.maxX - m && z > B.minZ + m && z < B.maxZ - m; }
}

const _tmp = [];
const _hit = {};

// Ray vs vertical capsule (segment from y0 to y1 at x,z with radius r). Returns t or -1.
export function rayCapsule(ox, oy, oz, dx, dy, dz, cx, y0, y1, cz, r, maxT) {
  // closest approach between ray and vertical segment, solved in 2D first (infinite cylinder) then capped by spheres
  const fx = ox - cx, fz = oz - cz;
  const a = dx * dx + dz * dz, b = 2 * (fx * dx + fz * dz), c = fx * fx + fz * fz - r * r;
  let best = -1;
  if (a > 1e-9) {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const sq = Math.sqrt(disc); const t = (-b - sq) / (2 * a);
      if (t >= 0 && t <= maxT) { const y = oy + dy * t; if (y >= y0 && y <= y1) best = t; }
      else if (c < 0) { /* origin inside cylinder */ const y = oy; if (y >= y0 && y <= y1) best = 0; }
    }
  }
  if (best < 0) {
    for (const sy of [y0, y1]) {
      const t = raySphere(ox, oy, oz, dx, dy, dz, cx, sy, cz, r, maxT);
      if (t >= 0 && (best < 0 || t < best)) best = t;
    }
  }
  return best;
}
export function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r, maxT) {
  const fx = ox - cx, fy = oy - cy, fz = oz - cz;
  const b = fx * dx + fy * dy + fz * dz, c = fx * fx + fy * fy + fz * fz - r * r;
  if (c > 0 && b > 0) return -1;
  const disc = b * b - c; if (disc < 0) return -1;
  let t = -b - Math.sqrt(disc); if (t < 0) t = 0;
  return t <= maxT ? t : -1;
}
