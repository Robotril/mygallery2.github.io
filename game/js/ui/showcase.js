// Animated 3D menu backdrop: tropical diorama with the selected character on a turntable + weapon inspect stage.
import * as THREE from 'three';
import { CollisionWorld } from '../world/collision.js';
import { WorldBuilder } from '../world/builder.js';
import * as P from '../world/props.js';
import { makeWaterMaterial } from '../world/water.js';
import { ClayFigure } from '../entities/clay.js';
import { buildGunModel } from '../entities/gunModel.js';
import { mulberry32, damp } from '../core/util.js';

export class Showcase {
  constructor(gfx) {
    this.gfx = gfx; this.scene = new THREE.Scene(); this.t = 0; this.mode = 'main'; this.spin = 0; this.dragV = 0;
    const r = mulberry32(5);
    const terrain = (x, z) => { const d = Math.hypot(x, z); return d < 14 ? 0.6 - d * d * 0.002 : Math.max(-2, 0.6 - 0.39 - (d - 14) * 0.25); };
    const world = new CollisionWorld({ minX: -40, maxX: 40, minZ: -40, maxZ: 40, terrain });
    const B = new WorldBuilder(world, this.scene, gfx.q);
    const g = new THREE.CircleGeometry(30, 64); g.rotateX(-Math.PI / 2); const pos = g.attributes.position; const cols = [];
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i); pos.setY(i, terrain(x, z)); const d = Math.hypot(x, z); cols.push(...(d > 12 ? [0.78, 0.66, 0.5] : [0.97, 0.88, 0.7])); }
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); g.computeVertexNormals();
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / 6, pos.getZ(i) / 6);
    const ground = new THREE.Mesh(g, B.materials.sand.m); ground.receiveShadow = true; this.scene.add(ground);
    for (const [x, z] of [[-6, -5], [7, -7], [-9, 3], [10, 1], [-3, -10]]) P.palm(B, x, z, r);
    P.crate(B, 3.2, terrain(3.2, -2), -2, 1.2, '#4b5a32'); P.crate(B, 4.5, terrain(4.5, -2.6), -2.6, 1.2, '#4b5a32'); P.crate(B, 3.8, terrain(3.8, -2.3) + 1.2, -2.3, 1.1, '#55653a');
    P.sandbags(B, -3, -2.5, 4, 'x', terrain(-3, -2.5)); P.umbrella(B, -4.5, 3, '#ff5d5d', terrain(-4.5, 3)); P.lounger(B, -4.5, 4.5, false, '#fff', terrain(-4.5, 4.5));
    for (let i = 0; i < 6; i++) P.rock(B, Math.cos(i) * 13, -0.4, Math.sin(i) * 13, 1 + r() * 1.5, r);
    P.boat(B, 15, 9, true, '#2fa8a0', -0.1);
    B.finalize();
    // platform
    const plat = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.25, 0.25, 40), new THREE.MeshStandardMaterial({ color: '#2b3442', roughness: 0.4, metalness: 0.4 })); plat.position.set(0, 0.62, 0); plat.receiveShadow = true; plat.castShadow = true; this.scene.add(plat);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.18, 0.03, 8, 60), new THREE.MeshBasicMaterial({ color: '#e07b2a', toneMapped: false })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.75; this.scene.add(ring); this.ring = ring;
    this.water = makeWaterMaterial({ wave: 0.6, detail: gfx.q.waterDetail });
    const wm = new THREE.Mesh(new THREE.PlaneGeometry(600, 600, 120, 120), this.water); wm.rotation.x = -Math.PI / 2; wm.position.y = -0.05; this.scene.add(wm);
    gfx.setupScene(this.scene, { sky: { turbidity: 5, rayleigh: 1.6, mie: 0.004, mieG: 0.86, elevation: 22, azimuth: 200 }, sunColor: '#ffe6c4', sunIntensity: 3.0, hemiSky: '#bfe3ff', hemiGround: '#d8c39a', hemiIntensity: 1.1, fog: '#d9e9f2', fogDensity: 0.006, exposure: 0.95 });
    this.water.uniforms.uSunDir.value.copy(gfx.sunDir);
    gfx.followShadow(new THREE.Vector3(0, 0, 0));
    this.figure = null; this.gun = null; this.gunGroup = new THREE.Group(); this.gunGroup.position.set(0, 1.55, 0); this.scene.add(this.gunGroup);
    this.camPos = new THREE.Vector3(4.2, 2.2, 6); this.camLook = new THREE.Vector3(0, 1.4, 0);
  }
  setCharacter(look) {
    if (this.figure) this.scene.remove(this.figure.root);
    this.figure = new ClayFigure(look); this.figure.root.position.set(0, 0.75, 0); this.figure.setWeapon('sentinel', { optic: 'reddot', grip: 'vertical' }); this.scene.add(this.figure.root);
    this.figure.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  }
  setWeapon(id, build) {
    this.gunGroup.clear(); if (!id) return; const g = buildGunModel(id, build || {}); g.group.scale.setScalar(2.4); this.gunGroup.add(g.group); this.gun = g;
    if (this.figure) this.figure.setWeapon(id, build);
  }
  setMode(mode) { this.mode = mode; }
  // results screen: show a character on the pedestal in a pose that matches how the match went
  setResults(look, pose) { if (look) this.setCharacter(look); this.pose = pose; this.mode = 'results'; }
  drag(dx) { this.dragV += dx * 0.01; }
  update(dt) {
    this.t += dt; const cam = this.gfx.camera; const m = this.mode;
    let target = { main: [[3.4, 2.3, 6.4], [-0.9, 1.75, 0]], character: [[0.25, 2.0, 5.2], [0, 1.7, 0]], results: [[-2.7, 1.9, 6.4], [-2.15, 1.45, 0]], weapons: [[0, 1.7, 2.2], [0, 1.55, 0]], loadout: [[2.6, 2.1, 5.6], [-0.4, 1.7, 0]] }[m] || [[3.4, 2.3, 6.4], [-0.9, 1.75, 0]];
    if (cam.aspect < 1 && (m === 'main' || !m)) target = [[1.4, 1.5, 13], [0.1, -0.5, 0]]; // upright phone: character sits in the top half
    this.camPos.lerp(new THREE.Vector3(...target[0]), 1 - Math.exp(-dt * 3)); this.camLook.lerp(new THREE.Vector3(...target[1]), 1 - Math.exp(-dt * 3));
    const sway = Math.sin(this.t * 0.25) * 0.25; cam.position.set(this.camPos.x + sway, this.camPos.y + Math.sin(this.t * 0.4) * 0.05, this.camPos.z); cam.lookAt(this.camLook);
    cam.fov = 40; cam.updateProjectionMatrix();
    this.spin += (this.dragV + (m === 'weapons' ? 0.4 : 0.15)) * dt; this.dragV = damp(this.dragV, 0, 3, dt);
    if (this.figure) { this.figure.root.visible = m !== 'weapons'; this.figure.root.rotation.y = m === 'main' ? Math.PI - 0.45 + Math.sin(this.t * 0.3) * 0.3 : m === 'results' ? Math.PI - 0.35 : this.spin + Math.PI;
      const pose = m === 'results' ? this.pose : null;
      this.figure.animate(dt, { speed: 0, crouch: 0, pitch: pose === 'sad' ? -0.5 : Math.sin(this.t * 0.8) * 0.05, emote: pose === 'victory' });
      if (pose !== 'victory') this.figure.hips.position.y = 0.92 + Math.sin(this.t * 1.6) * 0.012;
      if (pose === 'sad') { this.figure.head.rotation.x = 0.5; this.figure.torso.rotation.x = 0.18; }
      if (pose === 'cheer') { const a = this.figure.arms[1]; a.sh.rotation.set(2.9 + Math.sin(this.t * 5) * 0.25, 0, -0.35); a.el.rotation.set(0.2, 0, 0); this.figure.hips.position.y = 0.92 + Math.abs(Math.sin(this.t * 3)) * 0.05; }
    }
    this.gunGroup.visible = m === 'weapons'; this.gunGroup.rotation.y = this.spin + Math.PI / 2; this.gunGroup.rotation.z = Math.sin(this.t * 0.6) * 0.08;
    this.water.uniforms.uTime.value = this.t; this.ring.material.color.setHSL(0.07, 0.8, 0.45 + Math.sin(this.t * 2) * 0.08);
  }
  render() { this.gfx.render(this.scene, false); }
}
