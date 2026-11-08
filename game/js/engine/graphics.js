// Renderer, graphics presets, automatic device detection, post-processing, sky + lighting rig.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { isMobileUA, isTouchDevice } from '../core/util.js';
import { setTextureQuality } from './textures.js';
import { setClayQuality } from '../entities/clay.js';

export const PRESETS = {
  low: { name: 'Low', pixelRatio: 0.7, shadows: false, shadowSize: 512, bloom: false, ao: false, drawDist: 150, fogMul: 1.5, texSize: 256, aniso: 1, bump: false, lowMat: true, terrainSeg: 4, waterSeg: 60, waterDetail: 0.4, particles: 0.4, pedestrians: 6, traffic: 6, clouds: 6, antialias: false },
  medium: { name: 'Medium', pixelRatio: 1, shadows: true, shadowSize: 1024, bloom: false, ao: false, drawDist: 210, fogMul: 1.15, texSize: 512, aniso: 2, bump: true, lowMat: false, terrainSeg: 3, waterSeg: 110, waterDetail: 0.7, particles: 0.7, pedestrians: 14, traffic: 10, clouds: 10, antialias: false },
  high: { name: 'High', pixelRatio: 1.5, shadows: true, shadowSize: 2048, bloom: true, ao: false, drawDist: 290, fogMul: 1, texSize: 1024, aniso: 4, bump: true, lowMat: false, terrainSeg: 2, waterSeg: 180, waterDetail: 1, particles: 1, pedestrians: 22, traffic: 16, clouds: 16, antialias: true },
  ultra: { name: 'Ultra', pixelRatio: 2, shadows: true, shadowSize: 4096, bloom: true, ao: true, drawDist: 400, fogMul: 0.85, texSize: 1024, aniso: 8, bump: true, lowMat: false, terrainSeg: 1.5, waterSeg: 240, waterDetail: 1.2, particles: 1.3, pedestrians: 30, traffic: 22, clouds: 22, antialias: true },
};
export const PRESET_ORDER = ['low', 'medium', 'high', 'ultra'];

// Probe the device and choose a preset. Returns {preset, reason, gpu}.
export function detectPreset(renderer) {
  const gl = renderer.getContext();
  let gpu = 'unknown';
  try { const ext = gl.getExtension('WEBGL_debug_renderer_info'); if (ext) gpu = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || gpu; } catch (e) { /* blocked */ }
  const g = gpu.toLowerCase(); const mobile = isMobileUA() || (isTouchDevice() && Math.min(screen.width, screen.height) < 820);
  const cores = navigator.hardwareConcurrency || 4; const mem = navigator.deviceMemory || 4;
  const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  let score = 0;
  if (/swiftshader|llvmpipe|software|basic render/.test(g)) return { preset: 'low', reason: 'Software renderer detected', gpu };
  if (/rtx|radeon rx|rx [5-9]\d{3}|geforce gtx 1[06-9]|gtx 2|rtx|arc a7|apple m[1-4] (pro|max|ultra)/.test(g)) score += 3;
  else if (/apple m[1-4]|geforce|radeon|nvidia|arc/.test(g)) score += 2;
  else if (/intel.*(iris|xe)|apple gpu|adreno \(tm\) 7[3-9]\d|adreno.*7[3-9]\d|mali-g7[1-9]|immortalis/.test(g)) score += 1;
  else if (/intel|mali|adreno|powervr/.test(g)) score += 0;
  if (cores >= 8) score += 1; if (mem >= 8) score += 1; if (mem <= 2 || cores <= 2) score -= 2;
  if (maxTex < 8192) score -= 1;
  if (mobile) score -= 2;
  const preset = score >= 4 ? 'ultra' : score >= 2 ? 'high' : score >= 0 ? 'medium' : 'low';
  return { preset, reason: `${mobile ? 'Mobile' : 'Desktop'} · ${cores} cores · ${mem}GB · score ${score}`, gpu };
}

export class Graphics {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobileUA(), powerPreference: 'high-performance', stencil: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.detected = detectPreset(this.renderer);
    this.presetId = 'medium'; this.q = { ...PRESETS.medium };
    this.renderScale = 1; this.dynScale = 1;
    this.fpsSamples = []; this.fps = 60; this.autoMode = true; this.autoChecked = false; this.lastAdjust = 0;
    this.camera = new THREE.PerspectiveCamera(78, 1, 0.08, 6000);
    this.vmScene = new THREE.Scene(); this.vmCamera = new THREE.PerspectiveCamera(60, 1, 0.01, 10);
    this.vmScene.add(new THREE.HemisphereLight('#ffffff', '#6a5a4a', 2.2));
    this.vmSun = new THREE.DirectionalLight('#ffffff', 2.2); this.vmSun.position.set(0.5, 1, 0.3); this.vmScene.add(this.vmSun);
    this.onResize = () => this.resize(); window.addEventListener('resize', this.onResize);
    this.resize();
  }

  applyPreset(id, settings) {
    const auto = id === 'auto'; this.autoMode = auto;
    const pid = auto ? this.detected.preset : id;
    this.presetId = pid; this.q = { ...PRESETS[pid] };
    this.renderScale = settings?.renderScale ?? 1; this.dynScale = 1;
    setTextureQuality(this.q.texSize, Math.min(this.q.aniso, this.renderer.capabilities.getMaxAnisotropy()));
    setClayQuality({ bump: this.q.bump, lowMat: this.q.lowMat });
    this.renderer.shadowMap.enabled = this.q.shadows;
    this.resize();
    return pid;
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const pr = Math.min(window.devicePixelRatio || 1, this.q.pixelRatio) * this.renderScale * this.dynScale;
    this.renderer.setPixelRatio(Math.max(0.4, pr)); this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.vmCamera.aspect = w / h; this.vmCamera.updateProjectionMatrix();
    if (this.composer) { this.composer.setPixelRatio(this.renderer.getPixelRatio()); this.composer.setSize(w, h); }
  }

  // Build the scene environment for a map.
  setupScene(scene, env) {
    this.scene = scene; const q = this.q;
    const gainSky = (sk) => { sk.material.fragmentShader = sk.material.fragmentShader.replace('gl_FragColor = vec4( retColor, 1.0 );', 'gl_FragColor = vec4( retColor * ' + (env.skyGain ?? 0.62).toFixed(2) + ', 1.0 );'); sk.material.needsUpdate = true; };
    const sky = new Sky(); sky.scale.setScalar(4500); gainSky(sky); scene.add(sky); this.sky = sky;
    const u = sky.material.uniforms; u.turbidity.value = env.sky.turbidity; u.rayleigh.value = env.sky.rayleigh; u.mieCoefficient.value = env.sky.mie; u.mieDirectionalG.value = env.sky.mieG;
    const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - env.sky.elevation), THREE.MathUtils.degToRad(env.sky.azimuth));
    u.sunPosition.value.copy(sunDir); this.sunDir = sunDir;
    // environment map from sky for reflections
    const pmrem = new THREE.PMREMGenerator(this.renderer); const envScene = new THREE.Scene(); const sky2 = new Sky(); sky2.scale.setScalar(4500); gainSky(sky2);
    for (const k in u) if (sky2.material.uniforms[k]) sky2.material.uniforms[k].value = u[k].value; envScene.add(sky2);
    const rt = pmrem.fromScene(envScene, 0.04); scene.environment = rt.texture; scene.environmentIntensity = 0.4; pmrem.dispose(); this.vmScene.environment = rt.texture; this.vmScene.environmentIntensity = 0.8;
    this.envRT = rt;
    scene.fog = new THREE.FogExp2(env.fog, env.fogDensity * q.fogMul);
    this.renderer.toneMappingExposure = env.exposure;
    const hemi = new THREE.HemisphereLight(env.hemiSky, env.hemiGround, env.hemiIntensity); scene.add(hemi);
    const sun = new THREE.DirectionalLight(env.sunColor, env.sunIntensity); sun.position.copy(sunDir).multiplyScalar(150); scene.add(sun); scene.add(sun.target);
    sun.castShadow = q.shadows;
    if (q.shadows) {
      sun.shadow.mapSize.set(q.shadowSize, q.shadowSize); const s = q.shadowSize >= 4096 ? 70 : q.shadowSize >= 2048 ? 60 : 45;
      Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 400 }); sun.shadow.camera.updateProjectionMatrix();
      sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
    }
    this.sun = sun; this.hemi = hemi;
    this.vmSun.color.set(env.sunColor);
    this.setupComposer(scene);
  }

  setupComposer(scene) {
    if (this.composer) { this.composer.dispose?.(); this.composer = null; }
    if (!this.q.bloom && !this.q.ao) return;
    const w = window.innerWidth, h = window.innerHeight;
    const composer = new EffectComposer(this.renderer); composer.setPixelRatio(this.renderer.getPixelRatio()); composer.setSize(w, h);
    composer.addPass(new RenderPass(scene, this.camera));
    if (this.q.ao) { const ao = new GTAOPass(scene, this.camera, w, h); ao.output = GTAOPass.OUTPUT.Default; ao.blendIntensity = 0.85; ao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1, thickness: 1, scale: 1 }); composer.addPass(ao); this.aoPass = ao; }
    if (this.q.bloom) { const bloom = new UnrealBloomPass(new THREE.Vector2(w / 2, h / 2), 0.55, 0.45, 2.4); composer.addPass(bloom); this.bloom = bloom; }
    composer.addPass(new OutputPass());
    this.composer = composer;
  }

  followShadow(pos) {
    if (!this.sun) return;
    // snap to texel grid to avoid shimmering
    const step = 2; const x = Math.round(pos.x / step) * step, z = Math.round(pos.z / step) * step;
    this.sun.target.position.set(x, 0, z); this.sun.position.set(x + this.sunDir.x * 150, this.sunDir.y * 150, z + this.sunDir.z * 150);
  }

  render(scene, viewmodel = true) {
    const r = this.renderer;
    if (this.composer) { r.autoClear = true; this.composer.render(); }
    else { r.autoClear = true; r.render(scene, this.camera); }
    if (viewmodel && this.vmScene.children.length > 2) { r.autoClear = false; r.clearDepth(); r.render(this.vmScene, this.vmCamera); r.autoClear = true; }
  }

  // FPS tracking with automatic quality adaptation (auto mode only)
  trackFrame(dt, now) {
    if (dt <= 0) return;
    this.fpsSamples.push(1 / dt); if (this.fpsSamples.length > 90) this.fpsSamples.shift();
    if (this.fpsSamples.length >= 60) this.fps = this.fpsSamples.reduce((a, b) => a + b, 0) / this.fpsSamples.length;
    if (now - this.lastAdjust < 4 || this.fpsSamples.length < 90) return null;
    // dynamic resolution first, then preset drop
    if (this.fps < 45 && this.dynScale > 0.65) { this.dynScale = Math.max(0.65, this.dynScale - 0.1); this.resize(); this.lastAdjust = now; this.fpsSamples.length = 0; return 'res'; }
    if (this.fps > 58 && this.dynScale < 1) { this.dynScale = Math.min(1, this.dynScale + 0.05); this.resize(); this.lastAdjust = now; this.fpsSamples.length = 0; return 'res'; }
    if (this.autoMode && this.fps < 32 && this.dynScale <= 0.66) {
      const i = PRESET_ORDER.indexOf(this.presetId);
      if (i > 0) { this.lastAdjust = now; this.fpsSamples.length = 0; return PRESET_ORDER[i - 1]; }
    }
    return null;
  }
}
