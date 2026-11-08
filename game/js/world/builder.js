// World builder: accumulates static geometry per (chunk, material) and merges it into few draw calls.
// Every solid visual box can also register a collision box, so what you see is what you collide with.
import * as THREE from 'three';
import * as TX from '../engine/textures.js';
import { F_ALL, F_SOLID, F_SIGHT, F_BULLET } from './collision.js';

const CHUNK = 120;

export class WorldBuilder {
  constructor(world, scene, quality) {
    this.world = world; this.scene = scene; this.q = quality;
    this.acc = new Map();
    this.materials = this.makeMaterials();
    this.chunks = []; // meshes with cull info
    this.dynamic = new THREE.Group(); scene.add(this.dynamic);
    this.color = new THREE.Color();
  }

  makeMaterials() {
    const q = this.q; const bump = q.bump ? TX.clayBump() : null;
    const std = (o) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, ...o });
    const fac = (k) => { const f = TX.facade(k); return std({ map: f.map, emissiveMap: f.emissive, emissive: new THREE.Color(1, 1, 1), emissiveIntensity: 1.1, roughness: 0.35, metalness: 0.35 }); };
    const M = {
      sand: { m: std({ map: TX.sand(), roughness: 0.95 }), s: 8 },
      wetsand: { m: std({ map: TX.wetSand(), roughness: 0.6 }), s: 8 },
      grass: { m: std({ map: TX.grass(), roughness: 0.95 }), s: 6 },
      asphalt: { m: std({ map: TX.asphalt(), roughness: 0.9 }), s: 6 },
      concrete: { m: std({ map: TX.concrete(), roughness: 0.9 }), s: 4 },
      plaster: { m: std({ map: TX.plaster(), roughness: 0.9 }), s: 3 },
      rock: { m: std({ map: TX.rock(), roughness: 0.95 }), s: 5 },
      brick: { m: std({ map: TX.brick(), roughness: 0.9 }), s: 2.4 },
      wood: { m: std({ map: TX.wood(), roughness: 0.8 }), s: 2 },
      metal: { m: std({ map: TX.metal(), roughness: 0.45, metalness: 0.6 }), s: 2 },
      tiles: { m: std({ map: TX.tiles(), roughness: 0.3 }), s: 2 },
      fabric: { m: std({ map: TX.fabricStripes(), roughness: 0.9, side: THREE.DoubleSide }), s: 1.5 },
      leaf: { m: std({ map: TX.leaf(), roughness: 0.8, side: THREE.DoubleSide }), s: 2 },
      clay: { m: std({ bumpMap: bump, bumpScale: 1.2, roughness: 0.62 }), s: 1.5 },
      paint: { m: std({ roughness: 0.5, metalness: 0.1 }), s: 2 },
      glass: { m: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.05, metalness: 0.8, transparent: true, opacity: 0.45, depthWrite: false }), s: 3, noShadow: true },
      glow: { m: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, color: new THREE.Color(3.2, 3.2, 3.2) }), s: 1, noShadow: true },
      office: { m: fac('office'), s: 18, sv: 14 },
      tower: { m: fac('tower'), s: 18, sv: 14 },
      apartment: { m: fac('apartment'), s: 12, sv: 12 },
    };
    return M;
  }

  bucket(mat, x, z) {
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
    const key = `${cx},${cz},${mat}`;
    let b = this.acc.get(key);
    if (!b) { b = { mat, cx, cz, pos: [], nrm: [], uv: [], col: [], idx: [] }; this.acc.set(key, b); }
    return b;
  }

  // ---- primitive emitters ----
  // Visual box (axis aligned). opts: {collide=true, flags, noBottom, noTop, uvScale}
  box(x0, y0, z0, x1, y1, z1, mat, color = '#ffffff', opts = {}) {
    if (opts.collide !== false) this.world.addBox(x0, y0, z0, x1, y1, z1, opts.flags ?? F_ALL, opts.data);
    if (opts.visible === false) return;
    const md = this.materials[mat]; const su = (opts.s || md.s), sv = (opts.sv || md.sv || su);
    const b = this.bucket(mat, (x0 + x1) / 2, (z0 + z1) / 2);
    const c = this.color.set(color); const shade = opts.shade ?? 1;
    const faces = [
      // normal, 4 corners
      [1, 0, 0, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], 'zy'],
      [-1, 0, 0, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], 'zy'],
      [0, 1, 0, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], 'xz'],
      [0, -1, 0, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], 'xz'],
      [0, 0, 1, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], 'xy'],
      [0, 0, -1, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], 'xy'],
    ];
    for (let f = 0; f < 6; f++) {
      if (opts.noBottom && f === 3) continue; if (opts.noTop && f === 2) continue;
      const [nx, ny, nz, a, bb, cc, d, plane] = faces[f];
      const base = b.pos.length / 3;
      const fshade = shade * (ny < 0 ? 0.7 : 1);
      for (const p of [a, bb, cc, d]) {
        b.pos.push(p[0], p[1], p[2]); b.nrm.push(nx, ny, nz);
        let u, v;
        if (plane === 'zy') { u = p[2] * (nx > 0 ? -1 : 1); v = p[1]; } else if (plane === 'xz') { u = p[0]; v = p[2]; } else { u = p[0] * (nz > 0 ? 1 : -1); v = p[1]; }
        b.uv.push(u / su, v / sv); b.col.push(c.r * fshade, c.g * fshade, c.b * fshade);
      }
      b.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  // Box from center/size convenience
  cbox(cx, y0, cz, w, h, d, mat, color, opts) { this.box(cx - w / 2, y0, cz - d / 2, cx + w / 2, y0 + h, cz + d / 2, mat, color, opts); }
  collider(x0, y0, z0, x1, y1, z1, flags = F_ALL) { this.world.addBox(x0, y0, z0, x1, y1, z1, flags); }

  // Merge arbitrary geometry (transformed) into the static batch.
  geom(g, matrix, mat, color = '#ffffff', uvScale = 1) {
    const pos = g.attributes.position, nrm = g.attributes.normal, uv = g.attributes.uv; const idx = g.index;
    const v = new THREE.Vector3(), n = new THREE.Vector3(); const nm = new THREE.Matrix3().getNormalMatrix(matrix);
    v.set(0, 0, 0).applyMatrix4(matrix);
    const b = this.bucket(mat, v.x, v.z); const base = b.pos.length / 3; const c = this.color.set(color);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(matrix); b.pos.push(v.x, v.y, v.z);
      n.fromBufferAttribute(nrm, i).applyMatrix3(nm).normalize(); b.nrm.push(n.x, n.y, n.z);
      if (uv) b.uv.push(uv.getX(i) * uvScale, uv.getY(i) * uvScale); else b.uv.push(0, 0);
      b.col.push(c.r, c.g, c.b);
    }
    if (idx) for (let i = 0; i < idx.count; i++) b.idx.push(base + idx.getX(i));
    else for (let i = 0; i < pos.count; i++) b.idx.push(base + i);
  }

  finalize() {
    for (const b of this.acc.values()) {
      if (!b.idx.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nrm, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
      g.setIndex(b.pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(b.idx, 1) : new THREE.Uint16BufferAttribute(b.idx, 1));
      g.computeBoundingSphere();
      const md = this.materials[b.mat];
      const mesh = new THREE.Mesh(g, md.m);
      mesh.matrixAutoUpdate = false; mesh.updateMatrix();
      mesh.castShadow = !md.noShadow && this.q.shadows; mesh.receiveShadow = !md.noShadow && this.q.shadows;
      if (b.mat === 'glass') mesh.renderOrder = 2;
      this.scene.add(mesh);
      mesh.userData.cullR = g.boundingSphere.radius;
      this.chunks.push(mesh);
    }
    this.acc.clear();
  }

  // Distance-based chunk culling (complements frustum culling).
  cull(camPos, dist) {
    for (const m of this.chunks) {
      const s = m.geometry.boundingSphere; const dx = s.center.x - camPos.x, dz = s.center.z - camPos.z;
      const d = Math.sqrt(dx * dx + dz * dz) - s.radius; m.visible = d < dist;
    }
  }

  // ---------- Compound structures ----------
  // Wall along X (z fixed) or Z (x fixed) with rectangular openings. openings: [{a,b,y0,y1}] along-wall coords.
  wall(axis, fixed, a0, a1, y0, y1, thick, mat, color, openings = [], opts = {}) {
    const cuts = new Set([a0, a1]);
    for (const o of openings) { if (o.a > a0 && o.a < a1) cuts.add(o.a); if (o.b > a0 && o.b < a1) cuts.add(o.b); }
    const pts = [...cuts].sort((p, q) => p - q);
    for (let i = 0; i < pts.length - 1; i++) {
      const s = pts[i], e = pts[i + 1], m = (s + e) / 2; if (e - s < 0.01) continue;
      const ops = openings.filter((o) => m > o.a && m < o.b).sort((p, q) => p.y0 - q.y0);
      let cy = y0;
      for (const o of ops) { if (o.y0 > cy + 0.01) this._wseg(axis, fixed, s, e, cy, Math.min(o.y0, y1), thick, mat, color, opts); cy = Math.max(cy, o.y1); }
      if (cy < y1 - 0.01) this._wseg(axis, fixed, s, e, cy, y1, thick, mat, color, opts);
    }
  }
  _wseg(axis, fixed, s, e, y0, y1, t, mat, color, opts) {
    if (axis === 'x') this.box(s, y0, fixed - t / 2, e, y1, fixed + t / 2, mat, color, opts);
    else this.box(fixed - t / 2, y0, s, fixed + t / 2, y1, e, mat, color, opts);
  }

  // Straight flight of stairs. dir: '+x','-x','+z','-z'. Starts at (x,z) bottom edge, lane spans `w` in the other axis from `lane0`.
  stairs(x, y, z, dir, w, rise, steps, depth, mat = 'concrete', color = '#bdb6aa') {
    const r = rise / steps;
    for (let i = 0; i < steps; i++) {
      const top = y + r * (i + 1);
      const a = i * depth, b = (i + 1) * depth;
      if (dir === '+x') this.box(x + a, top - 0.3, z, x + b, top, z + w, mat, color);
      else if (dir === '-x') this.box(x - b, top - 0.3, z, x - a, top, z + w, mat, color);
      else if (dir === '+z') this.box(x, top - 0.3, z + a, x + w, top, z + b, mat, color);
      else this.box(x, top - 0.3, z - b, x + w, top, z - a, mat, color);
    }
  }

  // Enterable multi-floor building with doors, windows, switchback stairwell and optional roof access.
  building(o) {
    const { x0, z0, x1, z1 } = o; const gy = o.y ?? 0; const floors = o.floors || 1; const fh = o.fh || 3.5; const t = 0.3;
    const mat = o.mat || 'plaster', col = o.color || '#e8dccb', inMat = o.inMat || 'plaster', inCol = o.inColor || '#f1ebe1';
    const floorMat = o.floorMat || 'wood', floorCol = o.floorColor || '#c8a27a';
    const W = x1 - x0, D = z1 - z0;
    // stairwell along x near the north wall (z0 side) unless specified
    const steps = Math.round(fh / 0.29), depth = 0.38, run = steps * depth, lane = 1.3, land = 1.4;
    const hasStairs = floors > 1 || o.roof;
    const sx = x0 + t / 2 + land + (o.stairOffset || 0), sz = z0 + t / 2 + 0.05; // lane A z: [sz, sz+lane], lane B: [sz+lane, sz+2*lane]
    const well = { x0: sx, x1: sx + run, z0: sz, z1: sz + lane * 2 };
    const totalLevels = floors + (o.roof ? 1 : 0);
    // floors / slabs
    this.box(x0, gy, z0, x1, gy + 0.12, z1, floorMat, floorCol);
    for (let f = 1; f <= floors; f++) {
      const y = gy + f * fh; const isRoof = f === floors;
      const sm = isRoof ? (o.roofMat || 'concrete') : floorMat, sc = isRoof ? (o.roofColor || '#8f8a83') : floorCol;
      if (hasStairs && (f < floors || o.roof)) {
        // slab with stairwell hole
        this.box(x0, y - 0.25, z0, x1, y, well.z0, sm, sc, { noBottom: false });
        this.box(x0, y - 0.25, well.z1, x1, y, z1, sm, sc);
        this.box(x0, y - 0.25, well.z0, well.x0, y, well.z1, sm, sc);
        this.box(well.x1, y - 0.25, well.z0, x1, y, well.z1, sm, sc);
        // railing along open side of well
        const rx0 = well.x0 + 0.6, rx1 = well.x1 - 0.2;
        this.box(rx0, y, well.z1 - 0.06, rx1, y + 1.0, well.z1 + 0.06, 'metal', '#555', { flags: F_SOLID });
      } else this.box(x0, y - 0.25, z0, x1, y, z1, sm, sc);
    }
    if (hasStairs) for (let f = 0; f < totalLevels - 1 + (o.roof ? 0 : 0) && f < floors; f++) {
      if (f === floors - 1 && !o.roof) break;
      const y = gy + f * fh;
      if (f % 2 === 0) this.stairs(well.x0, y, well.z0, '+x', lane, fh, steps, depth);
      else this.stairs(well.x1, y, well.z0 + lane, '-x', lane, fh, steps, depth);
    }
    // exterior walls with openings
    const doorH = 2.4, wy0 = 1.0, wy1 = 2.3;
    const sides = [
      { s: 'n', axis: 'x', fixed: z0, a0: x0, a1: x1, len: W },
      { s: 's', axis: 'x', fixed: z1, a0: x0, a1: x1, len: W },
      { s: 'w', axis: 'z', fixed: x0, a0: z0, a1: z1, len: D },
      { s: 'e', axis: 'z', fixed: x1, a0: z0, a1: z1, len: D },
    ];
    for (const sd of sides) {
      const ops = [];
      for (const d of (o.doors || [])) if (d.side === sd.s) { const c = sd.a0 + sd.len * d.at, w = d.w || 1.8; ops.push({ a: c - w / 2, b: c + w / 2, y0: gy - 1, y1: gy + doorH, door: true }); }
      if (o.windows !== false) {
        const spacing = o.winSpacing || 3.6; const n = Math.floor((sd.len - 1.5) / spacing);
        const start = sd.a0 + (sd.len - (n - 1) * spacing) / 2;
        for (let f = 0; f < floors; f++) for (let i = 0; i < n; i++) {
          const c = start + i * spacing, ww = o.winW || 1.4;
          if (f === 0 && ops.some((p) => p.door && c + ww / 2 > p.a - 0.3 && c - ww / 2 < p.b + 0.3)) continue;
          if (sd.s === 'n' && hasStairs && c > well.x0 - 1 && c < well.x1 + 1) continue;
          if (f === 0 && o.groundWindows === false) continue;
          const op = { a: c - ww / 2, b: c + ww / 2, y0: gy + f * fh + (f === 0 && o.shopfront ? 0.4 : wy0), y1: gy + f * fh + (f === 0 && o.shopfront ? 2.8 : wy1) };
          ops.push(op);
          if (o.glassList && f === 0 && o.shopfront && (!o.glassSides || o.glassSides.includes(sd.s)) && this.glassPane) {
            const fx = sd.axis === 'x' ? (sd.s === 'n' ? z0 + t / 2 : z1 - t / 2) : (sd.s === 'w' ? x0 + t / 2 : x1 - t / 2);
            if (sd.axis === 'x') this.glassPane(this, op.a, op.y0, fx - 0.04, op.b, op.y1, fx + 0.04, o.glassList);
            else this.glassPane(this, fx - 0.04, op.y0, op.a, fx + 0.04, op.y1, op.b, o.glassList);
          }
        }
      }
      const top = gy + floors * fh + (o.roof ? (o.parapet ?? 1.0) : 0);
      this.wall(sd.axis, sd.axis === 'x' ? (sd.s === 'n' ? z0 + t / 2 : z1 - t / 2) : (sd.s === 'w' ? x0 + t / 2 : x1 - t / 2), sd.a0, sd.a1, gy, top, t, mat, col, ops);
      // trim band per floor
      for (let f = 1; f < floors; f++) {
        const y = gy + f * fh; const off = 0.12;
        if (sd.axis === 'x') { const z = sd.s === 'n' ? z0 - off : z1 + off; this.box(x0 - off, y - 0.3, Math.min(z, sd.fixed), x1 + off, y - 0.05, Math.max(z, sd.fixed), 'paint', o.trim || '#ffffff', { collide: false }); }
        else { const x = sd.s === 'w' ? x0 - off : x1 + off; this.box(Math.min(x, sd.fixed), y - 0.3, z0 - off, Math.max(x, sd.fixed), y - 0.05, z1 + off, 'paint', o.trim || '#ffffff', { collide: false }); }
      }
    }
    // roof overhang / cap for non-roof-access buildings
    if (!o.roof && o.cap !== false) this.box(x0 - 0.4, gy + floors * fh, z0 - 0.4, x1 + 0.4, gy + floors * fh + 0.35, z1 + 0.4, o.capMat || 'paint', o.capColor || '#c76a4a');
    // interior divider walls (one per floor) for cover
    if (o.interior !== false && W > 9 && D > 9) {
      for (let f = 0; f < floors; f++) {
        const y = gy + f * fh + (f === 0 ? 0.12 : 0); const mx = (x0 + x1) / 2 + (f % 2 ? 2 : -2);
        this.wall('z', mx, z0 + D * 0.45, z1 - 0.3, y, gy + (f + 1) * fh - 0.25, 0.2, inMat, inCol, [{ a: z0 + D * 0.62, b: z0 + D * 0.62 + 1.4, y0: y - 1, y1: y + 2.3 }]);
      }
    }
    return { well, fh, floors, gy, x0, z0, x1, z1 };
  }
}

export { CHUNK, F_ALL, F_SOLID, F_SIGHT, F_BULLET };
