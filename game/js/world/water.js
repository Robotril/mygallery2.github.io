// Stylized water: gerstner-ish waves, fresnel sky reflection, sun glint, depth-based shallow tint and shoreline foam.
import * as THREE from 'three';

const vert = /* glsl */`
uniform float uTime; uniform float uWave;
varying vec3 vWorld; varying float vWaveH;
#include <fog_pars_vertex>
float waveH(vec2 p, float t){
  float h = 0.0;
  h += sin(dot(p, vec2(0.12, 0.05)) + t*1.1) * 0.22;
  h += sin(dot(p, vec2(-0.07, 0.11)) + t*0.9) * 0.16;
  h += sin(dot(p, vec2(0.21, -0.17)) + t*1.7) * 0.06;
  return h * uWave;
}
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  float h = waveH(wp.xz, uTime);
  wp.y += h; vWaveH = h; vWorld = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const frag = /* glsl */`
uniform float uTime; uniform float uWave; uniform vec3 uSunDir; uniform vec3 uSunColor; uniform vec3 uSkyTop; uniform vec3 uSkyHorizon;
uniform vec3 uDeep; uniform vec3 uShallow; uniform sampler2D uDepthMap; uniform vec4 uDepthRect; uniform float uHasDepth; uniform float uOpacity; uniform float uDetail;
varying vec3 vWorld; varying float vWaveH;
#include <fog_pars_fragment>
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
vec3 waveN(vec2 p, float t){
  float e = 0.6;
  float dx = 0.0, dz = 0.0;
  dx += cos(dot(p, vec2(0.12,0.05)) + t*1.1) * 0.22 * 0.12; dz += cos(dot(p, vec2(0.12,0.05)) + t*1.1) * 0.22 * 0.05;
  dx += cos(dot(p, vec2(-0.07,0.11)) + t*0.9) * 0.16 * -0.07; dz += cos(dot(p, vec2(-0.07,0.11)) + t*0.9) * 0.16 * 0.11;
  dx += cos(dot(p, vec2(0.21,-0.17)) + t*1.7) * 0.06 * 0.21; dz += cos(dot(p, vec2(0.21,-0.17)) + t*1.7) * 0.06 * -0.17;
  dx *= uWave; dz *= uWave;
  // detail ripples
  vec2 q = p * 0.9 + vec2(t*0.35, t*0.2);
  float n1 = vnoise(q) - vnoise(q + vec2(0.3, 0.0));
  float n2 = vnoise(q) - vnoise(q + vec2(0.0, 0.3));
  vec2 q2 = p * 2.7 - vec2(t*0.5, -t*0.3);
  n1 += (vnoise(q2) - vnoise(q2 + vec2(0.3,0.0))) * 0.5; n2 += (vnoise(q2) - vnoise(q2 + vec2(0.0,0.3))) * 0.5;
  return normalize(vec3(-dx - n1*0.35*uDetail, 1.0, -dz - n2*0.35*uDetail));
}
void main(){
  vec3 n = waveN(vWorld.xz, uTime);
  vec3 V = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - max(dot(n, V), 0.0), 4.0) * 0.85 + 0.08;
  vec3 R = reflect(-V, n);
  vec3 sky = mix(uSkyHorizon, uSkyTop, clamp(R.y * 1.6, 0.0, 1.0));
  float depth = 3.0;
  if (uHasDepth > 0.5) {
    vec2 uv = (vWorld.xz - uDepthRect.xy) / uDepthRect.zw;
    if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) depth = max(0.0, -texture2D(uDepthMap, uv).r);
    else depth = 8.0;
  }
  float shallowT = exp(-depth * 0.55);
  vec3 body = mix(uDeep, uShallow, shallowT);
  // caustic shimmer in shallows
  float c = vnoise(vWorld.xz * 1.3 + uTime * 0.6) * vnoise(vWorld.xz * 1.7 - uTime * 0.4);
  body += vec3(0.35, 0.45, 0.4) * c * shallowT * 0.6;
  vec3 col = mix(body, sky, fres);
  vec3 H = normalize(uSunDir + V);
  float spec = pow(max(dot(n, H), 0.0), 220.0) * 3.0 + pow(max(dot(n, H), 0.0), 30.0) * 0.15;
  col += uSunColor * spec;
  // foam: shoreline + crests
  float shore = smoothstep(0.55, 0.0, depth) * (0.55 + 0.45 * sin(uTime * 1.6 - depth * 9.0 + vnoise(vWorld.xz * 0.5) * 6.0));
  float crest = smoothstep(0.28 * uWave, 0.42 * uWave, vWaveH) * vnoise(vWorld.xz * 0.8 + uTime * 0.3);
  float foam = clamp(shore + crest, 0.0, 1.0) * step(0.001, uWave + 0.001);
  col = mix(col, vec3(0.95, 0.97, 1.0), foam * 0.85 * (uHasDepth > 0.5 ? 1.0 : 0.3));
  float alpha = mix(uOpacity, 1.0, clamp(fres + (1.0 - shallowT) + foam, 0.0, 1.0));
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

export function makeWaterMaterial(o = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: frag, transparent: true, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uTime: { value: 0 }, uWave: { value: o.wave ?? 1 }, uSunDir: { value: (o.sunDir || new THREE.Vector3(0.3, 0.8, 0.2)).clone().normalize() },
      uSunColor: { value: new THREE.Color(o.sunColor || '#fff4d6') }, uSkyTop: { value: new THREE.Color(o.skyTop || '#4f8fd6') }, uSkyHorizon: { value: new THREE.Color(o.skyHorizon || '#cfe8ff') },
      uDeep: { value: new THREE.Color(o.deep || '#0a5a7a') }, uShallow: { value: new THREE.Color(o.shallow || '#3ad6c8') },
      uDepthMap: { value: o.depthMap || null }, uDepthRect: { value: o.depthRect || new THREE.Vector4(0, 0, 1, 1) }, uHasDepth: { value: o.depthMap ? 1 : 0 },
      uOpacity: { value: o.opacity ?? 0.75 }, uDetail: { value: o.detail ?? 1 },
    }]),
  });
}

// Build a depth texture from the collision heightmap (heights below water are negative).
export function depthTextureFromWorld(world, waterLevel = 0) {
  const w = world.hmW, h = world.hmH; const data = new Uint16Array(w * h);
  for (let i = 0; i < w * h; i++) data[i] = THREE.DataUtils.toHalfFloat(Math.max(-60, Math.min(60, world.hm[i] - waterLevel)));
  const t = new THREE.DataTexture(data, w, h, THREE.RedFormat, THREE.HalfFloatType);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
  return { tex: t, rect: new THREE.Vector4(world.hmMinX, world.hmMinZ, w, h) };
}
