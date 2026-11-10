// Clay surface look for every lit material in the game (characters, guns, buildings, props, ground).
// Adds, in the material's own space so the pattern sticks to moving objects:
//   - soft lumps and thumb dents, like a surface pressed by hand
//   - patches of fine fingerprint ridges, seen only up close
//   - hand-mixed color: each surface varies a little in tone
//   - a soft rim glow at the edges, so shapes read as squishy plasticine instead of hard plastic
// Hooked into MeshStandardMaterial (and MeshPhysicalMaterial) and MeshLambertMaterial through their
// prototypes, so materials created anywhere pick it up without code changes. Off on the Low preset.
import * as THREE from 'three';

export const CLAY = { on: false, fine: false };

const VERT_DECL = 'varying vec3 vClayP;\n';
const VERT_BODY = `
  { vec4 clayP = vec4(transformed, 1.0);
    #ifdef USE_INSTANCING
      clayP = instanceMatrix * clayP;
    #endif
    // object space, but in real-world size: many parts are unit shapes scaled down, so apply the object's scale
    vec3 clayS = vec3(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz), length(modelMatrix[2].xyz));
    vClayP = clayP.xyz * clayS; }
`;

const FRAG_DECL = `varying vec3 vClayP;
float clayHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float clayNoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(clayHash(i), clayHash(i + vec3(1.0, 0.0, 0.0)), f.x), mix(clayHash(i + vec3(0.0, 1.0, 0.0)), clayHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
             mix(mix(clayHash(i + vec3(0.0, 0.0, 1.0)), clayHash(i + vec3(1.0, 0.0, 1.0)), f.x), mix(clayHash(i + vec3(0.0, 1.0, 1.0)), clayHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}
// Height of the pressed clay surface (metres), faded out with distance so it never shimmers.
// The detail layers are skipped entirely where they would be invisible, which keeps the cost low.
float clayHeight(vec3 p, float lump, float dist) {
  float h = (lump - 0.5) * 0.022 * (1.0 - smoothstep(18.0, 55.0, dist));    // broad lumps
  if (dist < 55.0) {
    float dent = clayNoise(p * 9.0 + 7.3);                                   // thumb dents
    h -= smoothstep(0.55, 0.9, dent) * 0.0045 * (1.0 - smoothstep(18.0, 55.0, dist));
    #ifdef CLAY_FINE
    if (dist < 14.0) {                                                       // fingerprint patches, close up only
      float patchMask = smoothstep(0.58, 0.78, clayNoise(p * 4.1 + 3.1));
      float ridge = sin(dot(p, vec3(0.8, 0.45, 0.4)) * 170.0 + dent * 9.0);
      h += ridge * 0.00045 * patchMask * (1.0 - smoothstep(3.0, 14.0, dist));
    }
    #endif
  }
  return h;
}
// Mikkelsen's surface-gradient bump with unnormalised screen derivatives: the same strength at any distance.
vec3 clayPerturb(vec3 pos, vec3 n, float h, float faceDir) {
  vec3 dpx = dFdx(pos); vec3 dpy = dFdy(pos);
  vec3 r1 = cross(dpy, n); vec3 r2 = cross(n, dpx);
  float det = dot(dpx, r1) * faceDir;
  vec3 grad = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
  return normalize(abs(det) * n - grad);
}
`;

const FRAG_COLOR = `
  float clayLump = clayNoise(vClayP * 2.7); // shared by the hand-mixed color and the lumps
  diffuseColor.rgb *= 0.93 + 0.13 * clayLump;
`;
const FRAG_NORMAL = `
  { float clayDist = length(vViewPosition);
    float clayH = clayHeight(vClayP, clayLump, clayDist);
    normal = clayPerturb(-vViewPosition, normal, clayH, faceDirection); }
`;
const FRAG_RIM = `
  { float clayDist = length(vViewPosition);
    float clayRim = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 2.6);
    clayRim *= 1.0 - smoothstep(25.0, 70.0, clayDist);
    vec3 clayGlow = mix(diffuseColor.rgb, vec3(1.0, 0.86, 0.76), 0.35);
    outgoingLight += clayGlow * clayRim * 0.32; }
`;

function inject(shader) {
  if (!CLAY.on) return;
  let v = shader.vertexShader, f = shader.fragmentShader;
  if (!v.includes('#include <project_vertex>') || !f.includes('#include <normal_fragment_maps>') || !f.includes('#include <opaque_fragment>')) return;
  v = VERT_DECL + v.replace('#include <project_vertex>', '#include <project_vertex>' + VERT_BODY);
  f = (CLAY.fine ? '#define CLAY_FINE\n' : '') + FRAG_DECL + f
    .replace('#include <color_fragment>', '#include <color_fragment>' + FRAG_COLOR)
    .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>' + FRAG_NORMAL)
    .replace('#include <opaque_fragment>', FRAG_RIM + '#include <opaque_fragment>');
  shader.vertexShader = v; shader.fragmentShader = f;
}

let installed = false;
export function installClayLook() {
  if (installed) return; installed = true;
  for (const Mat of [THREE.MeshStandardMaterial, THREE.MeshLambertMaterial]) {
    const proto = Mat.prototype;
    proto.onBeforeCompile = function (shader) { if (!this?.userData?.noClay && !this?.transparent) inject(shader); };
    proto.customProgramCacheKey = function () { return CLAY.on && !this?.userData?.noClay && !this?.transparent ? (CLAY.fine ? 'clay2' : 'clay1') : 'clay0'; };
  }
}

// Switch the look on or off and make already-compiled materials pick up the change.
export function setClayLook(on, scenes = [], fine = CLAY.fine) {
  installClayLook();
  if (CLAY.on === on && CLAY.fine === fine) return;
  CLAY.on = on; CLAY.fine = fine;
  const seen = new Set();
  for (const s of scenes) s?.traverse?.((o) => {
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of ms) if (m && !seen.has(m) && (m.isMeshStandardMaterial || m.isMeshLambertMaterial)) { seen.add(m); m.needsUpdate = true; }
  });
}
