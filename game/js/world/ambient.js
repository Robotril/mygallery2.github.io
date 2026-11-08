// Ambient life kept outside combat space: traffic + pedestrians beyond the city boundary, gulls, clouds, helicopter.
import * as THREE from 'three';
import { makePedestrian, clayMat, bakeHierarchy } from '../entities/clay.js';
import { mulberry32 } from '../core/util.js';

export class Ambient {
  constructor(match, q) {
    this.match = match; this.scene = match.scene; this.items = []; this.peds = []; this.cars = []; this.birds = []; this.t = 0; const r = mulberry32(42);
    const map = match.map;
    if (map.id === 'city') {
      const R = map.ambientRing; // ring road outside the playable area
      for (let i = 0; i < q.traffic; i++) {
        const car = makeCar(r); bakeHierarchy(car, false); car.userData = { s: r() * 8 * R, lane: r() < 0.5 ? -2.5 : 2.5, speed: 9 + r() * 7, R }; this.scene.add(car); this.cars.push(car);
      }
      for (let i = 0; i < q.pedestrians; i++) {
        const p = makePedestrian(r); bakeHierarchy(p, false); p.userData.s = r() * 8 * R; p.userData.speed = 1.1 + r() * 0.6; p.userData.side = r() < 0.5 ? -8 : 8; p.userData.dir = r() < 0.5 ? 1 : -1; p.userData.R = R; p.userData.flee = 0; p.userData.ph = r() * 6;
        this.scene.add(p); this.peds.push(p);
      }
      // news helicopter
      const heli = new THREE.Group(); const body = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), clayMat('#2f6fd6')); body.scale.set(2.2, 1.1, 1.2); heli.add(body);
      const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 4, 8), clayMat('#2f6fd6')); tail.rotation.z = Math.PI / 2; tail.position.x = -3; heli.add(tail);
      const rotor = new THREE.Mesh(new THREE.BoxGeometry(7, 0.05, 0.3), clayMat('#222')); rotor.position.y = 1.2; heli.add(rotor); this.rotor = rotor;
      const light = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 4), new THREE.MeshBasicMaterial({ color: '#ff3030', toneMapped: false })); light.position.set(0, -1, 0); heli.add(light); this.heliLight = light;
      this.scene.add(heli); this.heli = heli;
    } else {
      for (let i = 0; i < 10; i++) { const b = makeGull(); b.userData = { a: r() * 6.28, r: 30 + r() * 80, h: 18 + r() * 20, sp: 0.15 + r() * 0.15, cx: (r() - 0.5) * 200, cz: 20 + r() * 80 }; this.scene.add(b); this.birds.push(b); }
    }
    if (map.env.clouds) for (let i = 0; i < q.clouds; i++) { const c = makeCloud(r); bakeHierarchy(c, false); c.position.set((r() - 0.5) * 1600, 120 + r() * 80, (r() - 0.5) * 1600); this.scene.add(c); this.items.push(c); }
  }
  update(dt) {
    this.t += dt; const t = this.t;
    for (const car of this.cars) { const u = car.userData; u.s = (u.s + u.speed * dt * (u.lane > 0 ? 1 : -1) + 8 * u.R) % (8 * u.R); ringPos(u.s, u.R, u.lane, car.position, car.rotation, u.lane < 0); }
    const noises = this.match.noises; const now = this.match.time;
    for (const p of this.peds) {
      const u = p.userData; let speed = u.speed;
      for (const n of noises) if (now - n.t < 0.2 && Math.hypot(n.x - p.position.x, n.z - p.position.z) < 120) u.flee = 6;
      if (u.flee > 0) { u.flee -= dt; speed *= 3.2; }
      u.s = (u.s + speed * dt * u.dir + 8 * u.R) % (8 * u.R); ringPos(u.s, u.R, u.side, p.position, p.rotation, u.dir < 0);
      u.ph += dt * speed * 4; const [a, b] = p.userData.legs; a.rotation.x = Math.sin(u.ph) * 0.6; b.rotation.x = -Math.sin(u.ph) * 0.6; p.position.y = Math.abs(Math.sin(u.ph)) * 0.05;
    }
    for (const b of this.birds) { const u = b.userData; u.a += u.sp * dt; b.position.set(u.cx + Math.cos(u.a) * u.r, u.h + Math.sin(t * 0.7 + u.r) * 3, u.cz + Math.sin(u.a) * u.r); b.rotation.y = -u.a; b.children[1].rotation.z = Math.sin(t * 8 + u.r) * 0.5; b.children[2].rotation.z = -Math.sin(t * 8 + u.r) * 0.5; }
    if (this.heli) { const a = t * 0.06; this.heli.position.set(Math.cos(a) * 230, 85 + Math.sin(t * 0.3) * 6, Math.sin(a) * 230); this.heli.rotation.y = -a - Math.PI / 2; this.rotor.rotation.y = t * 30; this.heliLight.visible = Math.sin(t * 4) > 0; }
    for (const c of this.items) c.position.x += dt * 1.5;
  }
  dispose() {}
}

function ringPos(s, R, off, pos, rot, rev) {
  const side = Math.floor(s / (2 * R)); const u = s % (2 * R) - R; const o = R + off;
  if (side === 0) { pos.set(u, 0, -o); rot.y = rev ? Math.PI / 2 : -Math.PI / 2; }
  else if (side === 1) { pos.set(o, 0, u); rot.y = rev ? 0 : Math.PI; }
  else if (side === 2) { pos.set(-u, 0, o); rot.y = rev ? -Math.PI / 2 : Math.PI / 2; }
  else { pos.set(-o, 0, -u); rot.y = rev ? Math.PI : 0; }
}
function makeCar(r) {
  const g = new THREE.Group(); const col = ['#e8463c', '#2f6fd6', '#f2f2f2', '#2b2b2b', '#ffd23f', '#2fa8a0'][Math.floor(r() * 6)];
  const b = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.8, 4.3), clayMat(col)); b.position.y = 0.75; g.add(b);
  const c = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 2.2), clayMat('#2a3644')); c.position.y = 1.45; c.position.z = 0.2; g.add(c);
  const hl = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.15, 0.05), new THREE.MeshBasicMaterial({ color: '#fff6d0', toneMapped: false })); hl.position.set(0, 0.8, -2.17); g.add(hl);
  const tl = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.15, 0.05), new THREE.MeshBasicMaterial({ color: '#ff3030', toneMapped: false })); tl.position.set(0, 0.8, 2.17); g.add(tl);
  for (const x of [-0.9, 0.9]) for (const z of [-1.4, 1.4]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.25, 10), clayMat('#1c1c1c')); w.rotation.z = Math.PI / 2; w.position.set(x, 0.36, z); g.add(w); }
  return g;
}
function makeGull() {
  const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.5, 3, 6), clayMat('#f5f5f5')); b.rotation.x = Math.PI / 2; g.add(b);
  for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.03, 0.3), clayMat('#e0e0e0')); w.geometry.translate(s * 0.45, 0, 0); g.add(w); }
  return g;
}
function makeCloud(r) {
  const g = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ color: '#f4f7fb', roughness: 1 });
  for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), m); const k = 14 + r() * 16; s.scale.set(k * 1.3, k * 0.7, k); s.position.set((r() - 0.5) * 60, (r() - 0.5) * 6, (r() - 0.5) * 30); g.add(s); }
  return g;
}
