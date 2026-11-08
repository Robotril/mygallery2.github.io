// GPU-friendly effects: two point-sprite particle buffers (additive + alpha), tracers, decals, flashes, shockwaves.
import * as THREE from 'three';

const pVert = /* glsl */`
attribute float aSize; attribute float aAlpha; attribute vec3 aColor; attribute float aKind;
varying float vAlpha; varying vec3 vColor; varying float vKind;
uniform float uScale;
void main(){ vAlpha = aAlpha; vColor = aColor; vKind = aKind;
  vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uScale / max(0.1, -mv.z); }`;
const pFrag = /* glsl */`
varying float vAlpha; varying vec3 vColor; varying float vKind;
void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c);
  if (vKind > 0.5) { // solid clay chunk / shell casing
    if (d > 0.5) discard; float shade = 0.65 + 0.35 * (0.5 - c.y);
    gl_FragColor = vec4(vColor * shade, vAlpha); }
  else { float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vColor, a * vAlpha); }
  #include <colorspace_fragment>
}`;

class ParticleBuffer {
  constructor(scene, cap, additive) {
    this.cap = cap; this.n = 0;
    this.pos = new Float32Array(cap * 3); this.col = new Float32Array(cap * 3); this.size = new Float32Array(cap); this.alpha = new Float32Array(cap); this.kind = new Float32Array(cap);
    this.vel = new Float32Array(cap * 3); this.life = new Float32Array(cap); this.max = new Float32Array(cap); this.grav = new Float32Array(cap); this.drag = new Float32Array(cap); this.grow = new Float32Array(cap); this.a0 = new Float32Array(cap); this.floor = new Float32Array(cap);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aKind', new THREE.BufferAttribute(this.kind, 1).setUsage(THREE.DynamicDrawUsage));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    this.mat = new THREE.ShaderMaterial({ vertexShader: pVert, fragmentShader: pFrag, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, uniforms: { uScale: { value: 400 } } });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = additive ? 5 : 4; scene.add(this.points); this.geo = g;
  }
  spawn(x, y, z, vx, vy, vz, life, size, r, gr, b, o = {}) {
    if (this.n >= this.cap) return; const i = this.n++;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z; this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.col[i * 3] = r; this.col[i * 3 + 1] = gr; this.col[i * 3 + 2] = b; this.size[i] = size; this.life[i] = 0; this.max[i] = life;
    this.grav[i] = o.g ?? 0; this.drag[i] = o.drag ?? 0; this.grow[i] = o.grow ?? 0; this.a0[i] = o.alpha ?? 1; this.alpha[i] = this.a0[i]; this.kind[i] = o.solid ? 1 : 0; this.floor[i] = o.floor ?? -1e9;
  }
  update(dt) {
    let i = 0;
    while (i < this.n) {
      this.life[i] += dt;
      if (this.life[i] >= this.max[i]) { this.kill(i); continue; }
      const k = i * 3; const d = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[k] *= d; this.vel[k + 1] = this.vel[k + 1] * d - this.grav[i] * dt; this.vel[k + 2] *= d;
      this.pos[k] += this.vel[k] * dt; this.pos[k + 1] += this.vel[k + 1] * dt; this.pos[k + 2] += this.vel[k + 2] * dt;
      if (this.pos[k + 1] < this.floor[i]) { this.pos[k + 1] = this.floor[i]; this.vel[k + 1] *= -0.3; this.vel[k] *= 0.6; this.vel[k + 2] *= 0.6; }
      this.size[i] += this.grow[i] * dt;
      const t = this.life[i] / this.max[i]; this.alpha[i] = this.a0[i] * (this.kind[i] > 0.5 ? (t > 0.8 ? (1 - t) * 5 : 1) : (1 - t) * (t < 0.1 ? t * 10 : 1));
      i++;
    }
    const g = this.geo; for (const a of ['position', 'aColor', 'aSize', 'aAlpha', 'aKind']) g.attributes[a].needsUpdate = true;
    g.setDrawRange(0, this.n);
  }
  kill(i) {
    const j = --this.n; if (i === j) return;
    for (const [arr, w] of [[this.pos, 3], [this.col, 3], [this.vel, 3]]) for (let c = 0; c < w; c++) arr[i * w + c] = arr[j * w + c];
    for (const arr of [this.size, this.alpha, this.kind, this.life, this.max, this.grav, this.drag, this.grow, this.a0, this.floor]) arr[i] = arr[j];
  }
  clear() { this.n = 0; this.geo.setDrawRange(0, 0); }
}

const C = new THREE.Color();
export class Effects {
  constructor(scene, quality) {
    this.scene = scene; this.q = quality; const mul = quality.particles;
    this.add = new ParticleBuffer(scene, Math.floor(2500 * mul), true);
    this.alpha = new ParticleBuffer(scene, Math.floor(3500 * mul), false);
    // tracers
    this.tracers = []; const tg = new THREE.CylinderGeometry(0.012, 0.012, 1, 4, 1, true); tg.rotateX(Math.PI / 2);
    const tm = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.4, 1.2), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    for (let i = 0; i < 48; i++) { const m = new THREE.Mesh(tg, tm); m.visible = false; m.frustumCulled = false; scene.add(m); this.tracers.push({ m, t: 0, dur: 0, sx: 0, sy: 0, sz: 0, ex: 0, ey: 0, ez: 0, len: 0 }); }
    // decals
    const dc = document.createElement('canvas'); dc.width = dc.height = 64; const x = dc.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 30); g.addColorStop(0, 'rgba(10,8,6,1)'); g.addColorStop(0.25, 'rgba(25,20,15,0.95)'); g.addColorStop(0.5, 'rgba(60,50,40,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64); const dt = new THREE.CanvasTexture(dc); dt.colorSpace = THREE.SRGBColorSpace;
    this.decalMat = new THREE.MeshBasicMaterial({ map: dt, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
    this.decals = []; this.decalIdx = 0; const pg = new THREE.PlaneGeometry(0.16, 0.16);
    for (let i = 0; i < 90; i++) { const m = new THREE.Mesh(pg, this.decalMat); m.visible = false; scene.add(m); this.decals.push(m); }
    // flash light pool
    this.lights = []; for (let i = 0; i < 3; i++) { const l = new THREE.PointLight('#ffb060', 0, 18, 2); l.visible = false; scene.add(l); this.lights.push({ l, t: 0, dur: 0, i0: 0 }); }
    // shockwaves
    this.waves = []; const wg = new THREE.RingGeometry(0.8, 1, 32); wg.rotateX(-Math.PI / 2);
    for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(wg, new THREE.MeshBasicMaterial({ color: '#fff3d0', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); m.visible = false; scene.add(m); this.waves.push({ m, t: 1 }); }
    this.smokes = []; this.shake = 0;
  }
  setScale(h, fov) { const s = h / (2 * Math.tan(THREE.MathUtils.degToRad(fov) / 2)); this.add.mat.uniforms.uScale.value = s; this.alpha.mat.uniforms.uScale.value = s; }

  tracer(sx, sy, sz, ex, ey, ez) {
    const t = this.tracers.find((o) => o.t >= o.dur) || this.tracers[0];
    const len = Math.hypot(ex - sx, ey - sy, ez - sz); if (len < 2) return;
    Object.assign(t, { t: 0, dur: Math.min(0.25, len / 380), sx, sy, sz, ex, ey, ez, len }); t.m.visible = true;
    t.m.lookAt(ex, ey, ez); t.m.position.set(sx, sy, sz); t.m.lookAt(ex, ey, ez);
  }
  muzzle(x, y, z, dx, dy, dz) {
    for (let i = 0; i < 5; i++) { const s = 2 + Math.random() * 4; this.add.spawn(x + dx * 0.1 * i, y + dy * 0.1 * i, z + dz * 0.1 * i, dx * s, dy * s, dz * s, 0.05, 0.35 - i * 0.04, 1, 0.75, 0.35); }
    this.alpha.spawn(x, y, z, dx * 0.8, dy * 0.8 + 0.4, dz * 0.8, 0.6, 0.3, 0.7, 0.7, 0.7, { grow: 1.2, alpha: 0.25, drag: 2 });
  }
  casing(x, y, z, vx, vy, vz, floorY) { this.alpha.spawn(x, y, z, vx, vy, vz, 1.4, 0.05, 0.85, 0.62, 0.25, { solid: true, g: 9.8, floor: floorY, drag: 0.5 }); }

  impact(x, y, z, nx, ny, nz, kind = 'concrete', color = null) {
    const m = this.q.particles;
    if (kind === 'metal') for (let i = 0; i < 8 * m; i++) this.add.spawn(x, y, z, nx * 3 + (Math.random() - 0.5) * 6, ny * 3 + Math.random() * 4, nz * 3 + (Math.random() - 0.5) * 6, 0.3 + Math.random() * 0.2, 0.06, 1, 0.8, 0.4, { g: 12 });
    else if (kind === 'water') { for (let i = 0; i < 14 * m; i++) this.alpha.spawn(x, y, z, (Math.random() - 0.5) * 2, 3 + Math.random() * 4, (Math.random() - 0.5) * 2, 0.7, 0.18, 0.9, 0.95, 1, { g: 12, alpha: 0.8 }); return; }
    else if (kind === 'glass') { for (let i = 0; i < 20 * m; i++) this.alpha.spawn(x, y, z, (Math.random() - 0.5) * 5, Math.random() * 3, (Math.random() - 0.5) * 5, 1.2, 0.07, 0.75, 0.9, 1, { solid: true, g: 9.8, floor: y - 3 }); return; }
    const c = color ? C.set(color) : C.setRGB(0.75, 0.7, 0.62);
    for (let i = 0; i < 6 * m; i++) this.alpha.spawn(x, y, z, nx * 1.5 + (Math.random() - 0.5) * 1.5, ny * 1.5 + Math.random() * 1.2, nz * 1.5 + (Math.random() - 0.5) * 1.5, 0.6 + Math.random() * 0.4, 0.18, c.r, c.g, c.b, { grow: 0.6, drag: 3, alpha: 0.55, g: 1 });
    for (let i = 0; i < 3 * m; i++) this.alpha.spawn(x, y, z, nx * 3 + (Math.random() - 0.5) * 3, ny * 3 + Math.random() * 3, nz * 3 + (Math.random() - 0.5) * 3, 0.8, 0.06, c.r * 0.7, c.g * 0.7, c.b * 0.7, { solid: true, g: 12, floor: y - 2 });
    this.decal(x, y, z, nx, ny, nz);
  }
  decal(x, y, z, nx, ny, nz) {
    const d = this.decals[this.decalIdx++ % this.decals.length]; d.visible = true;
    d.position.set(x + nx * 0.01, y + ny * 0.01, z + nz * 0.01); d.lookAt(x + nx, y + ny, z + nz); d.rotateZ(Math.random() * 6); d.scale.setScalar(0.7 + Math.random() * 0.6);
  }
  claySplat(x, y, z, dx, dy, dz, color, big = false) {
    const c = C.set(color); const n = (big ? 22 : 8) * this.q.particles;
    for (let i = 0; i < n; i++) { const s = 2 + Math.random() * 3; this.alpha.spawn(x, y, z, dx * s + (Math.random() - 0.5) * 3, dy * s + Math.random() * 3, dz * s + (Math.random() - 0.5) * 3, 1 + Math.random(), 0.08 + Math.random() * 0.08, c.r, c.g, c.b, { solid: true, g: 14, floor: y - 1.8, drag: 0.4 }); }
  }
  explosion(x, y, z, radius = 6) {
    const m = this.q.particles;
    for (let i = 0; i < 40 * m; i++) { const a = Math.random() * 6.28, e = Math.random() * 1.4, s = 4 + Math.random() * 10; this.add.spawn(x, y + 0.5, z, Math.cos(a) * Math.cos(e) * s, Math.sin(e) * s + 2, Math.sin(a) * Math.cos(e) * s, 0.4 + Math.random() * 0.4, 1.2 + Math.random() * 1.2, 1, 0.55 + Math.random() * 0.3, 0.15, { drag: 3.5, grow: 2 }); }
    for (let i = 0; i < 30 * m; i++) { const a = Math.random() * 6.28, s = 1 + Math.random() * 5; const g = 0.15 + Math.random() * 0.2; this.alpha.spawn(x, y + 1, z, Math.cos(a) * s, 1 + Math.random() * 4, Math.sin(a) * s, 2.5 + Math.random() * 2, 2 + Math.random() * 2, g, g, g, { drag: 1.5, grow: 2.5, alpha: 0.7, g: -0.5 }); }
    for (let i = 0; i < 20 * m; i++) this.add.spawn(x, y + 0.5, z, (Math.random() - 0.5) * 22, Math.random() * 16, (Math.random() - 0.5) * 22, 1 + Math.random(), 0.12, 1, 0.7, 0.3, { g: 15 });
    const L = this.lights.find((o) => o.t >= o.dur) || this.lights[0]; Object.assign(L, { t: 0, dur: 0.45, i0: 60 }); L.l.position.set(x, y + 1.5, z); L.l.visible = true; L.l.distance = radius * 4;
    const w = this.waves.find((o) => o.t >= 1) || this.waves[0]; w.t = 0; w.r = radius * 1.6; w.m.position.set(x, y + 0.2, z); w.m.visible = true;
  }
  smokeCloud(x, y, z, world, dur = 13) {
    const s = { x, y: y + 1.5, z, r: 0.5, until: performance.now() / 1000 + dur, t: 0, dur }; this.smokes.push(s); world.smokes.push(s);
  }
  flashBurst(x, y, z) { for (let i = 0; i < 30; i++) this.add.spawn(x, y + 0.5, z, (Math.random() - 0.5) * 14, Math.random() * 8, (Math.random() - 0.5) * 14, 0.4, 0.5, 1, 1, 0.8, { drag: 4 }); const L = this.lights[0]; Object.assign(L, { t: 0, dur: 0.25, i0: 120 }); L.l.position.set(x, y + 1, z); L.l.visible = true; }
  heal(x, y, z) { for (let i = 0; i < 12; i++) this.add.spawn(x + (Math.random() - 0.5), y + Math.random() * 1.6, z + (Math.random() - 0.5), 0, 1.2, 0, 0.8, 0.15, 0.3, 1, 0.5); }
  ring(x, y, z, color) { const c = C.set(color); for (let i = 0; i < 24; i++) { const a = i / 24 * 6.28; this.add.spawn(x, y, z, Math.cos(a) * 3, 1.5, Math.sin(a) * 3, 0.6, 0.2, c.r, c.g, c.b, { drag: 2 }); } }

  update(dt) {
    this.add.update(dt); this.alpha.update(dt);
    for (const t of this.tracers) if (t.t < t.dur) {
      t.t += dt; const k = Math.min(1, t.t / t.dur); const head = k * t.len, L = Math.min(5, t.len * 0.35);
      const dx = (t.ex - t.sx) / t.len, dy = (t.ey - t.sy) / t.len, dz = (t.ez - t.sz) / t.len; const mid = Math.max(L / 2, head - L / 2);
      t.m.position.set(t.sx + dx * mid, t.sy + dy * mid, t.sz + dz * mid); t.m.scale.set(1, 1, L);
      if (t.t >= t.dur) t.m.visible = false;
    }
    for (const L of this.lights) if (L.t < L.dur) { L.t += dt; L.l.intensity = L.i0 * Math.max(0, 1 - L.t / L.dur); if (L.t >= L.dur) L.l.visible = false; }
    for (const w of this.waves) if (w.t < 1) { w.t += dt * 2.2; const s = 0.5 + w.t * w.r; w.m.scale.set(s, 1, s); w.m.material.opacity = Math.max(0, 0.7 * (1 - w.t)); if (w.t >= 1) w.m.visible = false; }
    const now = performance.now() / 1000;
    for (let i = this.smokes.length - 1; i >= 0; i--) {
      const s = this.smokes[i]; s.t += dt; s.r = Math.min(7, 1 + s.t * 2.5);
      if (s.t < s.dur - 2 && Math.random() < dt * 30 * this.q.particles) { const a = Math.random() * 6.28, d = Math.random() * s.r * 0.8; const g = 0.78 + Math.random() * 0.12; this.alpha.spawn(s.x + Math.cos(a) * d, s.y - 1.2 + Math.random() * 2, s.z + Math.sin(a) * d, (Math.random() - 0.5) * 0.6, 0.15, (Math.random() - 0.5) * 0.6, 4, 3.5 + Math.random() * 2, g, g, g + 0.02, { grow: 0.8, alpha: 0.55, drag: 0.5 }); }
      if (s.until < now) this.smokes.splice(i, 1);
    }
  }
  clear() { this.add.clear(); this.alpha.clear(); this.smokes.length = 0; for (const d of this.decals) d.visible = false; for (const t of this.tracers) { t.t = t.dur = 0; t.m.visible = false; } }
}
