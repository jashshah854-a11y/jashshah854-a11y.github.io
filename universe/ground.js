/* The ground of the hall, made to belong to the machine.
   1. The floor is dark polished stone with a brass inlay and warm pools of light, all in the floor's own
      shader (no extra draw, and nothing coplanar with the floor, so nothing can z-fight): rings that echo
      the clockwork overhead, and a radial line from the centre to every pillar, echoing the drive shafts.
   2. On the phone tier the planar mirror is off, so the floor is made slightly see-through and a cheap
      stand-in for the reflection sits under it: the city's instances (rack.js) and one merged mesh of the
      pillars, decks and screens, both flipped below the floor and faded with depth.
   3. A carpet of low roofs and a string of street lights fill the city's gaps (phone tier). */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as L from './layout.js';

function rng(seed){ let s = seed >>> 0; return () => { s = (s*1664525 + 1013904223) >>> 0; return s/4294967296; }; }
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a)/(b - a))); return t*t*(3 - 2*t); };

/* ---------------- floor inlay ---------------- */
export function floorUniforms(){
  const slots = L.SLOTS.map(s => {
    const p = L.SLOT[s.id].pos, dx = p.x - L.RC.x, dz = p.z - L.RC.z, len = Math.hypot(dx, dz);
    return new THREE.Vector3(dx/len, dz/len, len);
  });
  return {uRC:{value:new THREE.Vector2(L.RC.x, L.RC.z)}, uSlots:{value:slots}};
}
/* hallFloor(worldPos) -> (ink, pool, seam, 0). Line widths are filtered with fwidth, so a far-off line
   fades to its average instead of shimmering. Radii echo the clockwork's rings (30, 39, 54). */
export const FLOOR_GLSL = `
uniform vec2 uRC; uniform vec3 uSlots[${L.SLOTS.length}];
float fCov(float d, float hw, float w){ return clamp((hw - d)/w + 0.5, 0.0, 1.0)*min(1.0, 2.0*hw/w); }
vec4 hallFloor(vec3 wp){
  vec2 p = wp.xz - uRC;
  float r = length(p), wr = max(fwidth(r), 1e-3);
  float ink = 0.0;
  ink = max(ink, fCov(abs(r - 21.5), 0.34, wr));
  ink = max(ink, fCov(abs(r - 30.0), 0.20, wr));
  ink = max(ink, fCov(abs(r - 39.0), 0.20, wr));
  ink = max(ink, fCov(abs(r - 54.0), 0.30, wr));
  ink = max(ink, fCov(abs(r - 78.0), 0.42, wr));
  ink = max(ink, fCov(abs(r - 79.7), 0.14, wr));
  ink = max(ink, fCov(abs(r - 104.0), 0.22, wr));
  float pool = 0.8*exp(-dot(p, p)/(2.0*40.0*40.0));
  for (int i = 0; i < ${L.SLOTS.length}; i++) {
    vec3 s = uSlots[i];
    float sp = p.x*s.y - p.y*s.x, al = dot(p, s.xy), wl = max(fwidth(sp), 1e-3);
    float c = fCov(abs(sp), 0.24, wl)*smoothstep(23.0, 26.0, al)*(1.0 - smoothstep(s.z - 16.0, s.z - 10.0, al));
    ink = max(ink, c);
    vec2 q = p - s.xy*s.z;
    pool += exp(-dot(q, q)/(2.0*15.0*15.0));
  }
  vec2 g = abs(fract(wp.xz/40.0 - 0.5) - 0.5)*40.0;
  float seam = fCov(min(g.x, g.y), 0.07, max(fwidth(wp.x) + fwidth(wp.z), 1e-3));
  return vec4(ink, pool, seam, 0.0);
}`;
const BRASS = 'vec3(0.46, 0.27, 0.075)';

/* A MeshStandardMaterial floor (phone tier, and the plain fallback floor). */
export function dressFloorMaterial(mat, U){
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFW;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFW = (modelMatrix*vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vFW; float gHP = 0.0; float gInk = 0.0;
        ${FLOOR_GLSL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec4 hf = hallFloor(vFW);
          diffuseColor.rgb = mix(diffuseColor.rgb*(1.0 - 0.4*hf.z), ${BRASS}, hf.x);
          diffuseColor.a = mix(diffuseColor.a, 1.0, hf.x);
          gHP = hf.y; gInk = hf.x;
        }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.26, gInk);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 0.75, gInk);')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(1.0, 0.66, 0.34)*(gHP*0.035 + gInk*(0.06 + 0.2*gHP));`);
  };
  mat.customProgramCacheKey = () => 'hallfloor1';
}

/* The desktop mirror's own shader: add the inlay to its base colour. */
export function dressFloorShader(shader, U){
  Object.assign(shader.uniforms, U);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\n${FLOOR_GLSL}`)
    .replace('vec3 base = color*(1.0 - 0.45*seam);', `vec4 hf = hallFloor(vW);
          vec3 base = color*(1.0 - 0.45*seam)*(1.0 - 0.3*hf.z);
          base += vec3(1.0, 0.66, 0.34)*hf.y*0.03;
          base = mix(base, ${BRASS}*(0.45 + 0.9*hf.y), hf.x);`)
    .replace('float k = uStrength*smoothstep(520.0, 30.0, d)*(1.0 - 0.5*seam);', 'float k = uStrength*smoothstep(520.0, 30.0, d)*(1.0 - 0.5*seam)*(1.0 - 0.6*hf.x);');
}

/* ---------------- phone tier: a stand-in for the mirror ---------------- */
/* items: {pos, yaw, deckH, kind:'std'|'small'|'wall', tint:Color, ...}. Everything is built flipped about the
   floor (y -> -y), double sided, with its brightness faded by depth below the floor in the vertex colours.
   One merged mesh, one draw. */
export function buildVitrineMirror(items){
  const parts = [];
  const part = (item, geo, lx, ly, lz, color, gain = 1) => {
    geo.translate(lx, ly + item.pos.y, lz);
    geo.scale(1, -1, 1);
    geo.rotateY(item.yaw);
    geo.translate(item.pos.x, 0, item.pos.z);
    const g = geo.index ? geo.toNonIndexed() : geo;
    const pos = g.attributes.position, col = new Float32Array(pos.count*3);
    for (let i = 0; i < pos.count; i++) {
      const depth = Math.max(0, -pos.getY(i));
      const k = gain*Math.exp(-depth/26);
      col[i*3] = color.r*k; col[i*3 + 1] = color.g*k; col[i*3 + 2] = color.b*k;
    }
    for (const n of Object.keys(g.attributes)) if (n !== 'position') g.deleteAttribute(n);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    parts.push(g);
  };
  const marble = new THREE.Color('#d6d0c0'), deckC = new THREE.Color('#5a4a30'), screenC = new THREE.Color();
  for (const it of items) {
    if (it.kind === 'wall') {
      for (const x of [-9, 9]) part(it, new THREE.CylinderGeometry(1.5, 1.8, it.pos.y - it.deckH, 10), x, -it.deckH - (it.pos.y - it.deckH)/2, 0, marble, 0.7);
      part(it, new THREE.BoxGeometry(30, it.deckH, 8), 0, -it.deckH/2, 0, deckC, 0.8);
      part(it, new THREE.PlaneGeometry(29, 15.5, 1, 8), 0, 7.75, -2.2, screenC.set('#cdb78a'), 0.85);
    } else {
      const small = it.kind === 'small';
      part(it, new THREE.CylinderGeometry(small ? 0.9 : 1.5, small ? 1.1 : 1.8, it.pos.y - it.deckH, 10), 0, -it.deckH - (it.pos.y - it.deckH)/2, 0, marble, 0.7);
      part(it, new THREE.BoxGeometry(small ? 7.6 : 21, it.deckH, small ? 5.4 : 11), 0, -it.deckH/2, 0, deckC, 0.8);
      part(it, new THREE.PlaneGeometry(it.pw, it.ph, 1, 6), 0, it.cy, it.cz, screenC.copy(it.tint), 1.0);
    }
  }
  const geo = mergeGeometries(parts); parts.forEach(g => g.dispose());
  geo.computeBoundingSphere();
  const mat = new THREE.MeshBasicMaterial({vertexColors:true, side:THREE.DoubleSide});
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.keep = true; mesh.name = 'vitrineMirror';
  return mesh;
}

/* ---------------- the city's carpet of low roofs ---------------- */
const SIDE = new THREE.Vector3(-L.LINE_DIR.z, 0, L.LINE_DIR.x);          // the same side as the rack's lateral axis
const UP = new THREE.Vector3(0, 1, 0);

export function buildCarpet({count = 380} = {}){
  const rand = rng(4242);
  /* A street grid: blocks snap to a 3.6 x 3.4 lattice so the gaps between them read as streets. Lateral
     range (positive = camera side of the line), tallest roof, share of the blocks. The strip between the
     rack's two rows is filled; the camera side is kept low because the run flies over it. */
  const bands = [
    {a:-5.6, b:-1.9, hmax:2.0, w:1.3},
    {a:7, b:15, hmax:0.9, w:1.4},
    {a:15, b:32, hmax:2.1, w:3.0},
    {a:-36, b:-15, hmax:4.0, w:3.2}
  ];
  const total = bands.reduce((s, b) => s + b.w, 0);
  const cells = [], taken = new Set();
  const AL = 3.6, LA = 3.4;
  for (const b of bands) {
    const n = Math.round(count*b.w/total);
    for (let i = 0, tries = 0; i < n && tries < n*6; tries++) {
      const ia = Math.round((26 + rand()*120)/AL), il = Math.round((b.a + rand()*(b.b - b.a))/LA);
      const key = ia*997 + il;
      if (taken.has(key)) continue; taken.add(key); i++;
      const along = ia*AL, lat = il*LA;
      const far = Math.min(1, Math.abs(lat)/30);
      const ramp = sm(26, 62, along)*(1 - sm(96, 142, along));
      const h = (0.4 + Math.pow(rand(), 1.5)*(b.hmax - 0.4))*(1 - 0.4*far)*ramp;
      if (h < 0.25) continue;
      cells.push({along:along + (rand() - 0.5)*0.4, lat:lat + (rand() - 0.5)*0.3, h, w:AL*(0.55 + rand()*0.3), d:LA*(0.55 + rand()*0.3), yaw:0, tone:rand()});
    }
  }
  const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
  const mat = new THREE.MeshStandardMaterial({color:'#ffffff', metalness:0.2, roughness:0.75});
  mat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLoc; varying vec3 vNW; varying float vSd;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 isc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
        vLoc = position*isc; vNW = normalize(mat3(instanceMatrix)*normal);
        vSd = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233)))*43758.5453);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vLoc; varying vec3 vNW; varying float vSd;
        float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x*p.y); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float cWall = step(abs(vNW.y), 0.3);
        float cU = abs(vNW.x) > 0.5 ? vLoc.z : vLoc.x;
        vec2 cUV = vec2(cU/0.5, vLoc.y/0.55);
        vec2 cId = floor(cUV) + vSd*91.0;
        vec2 cF = fract(cUV);
        float cMask = step(0.2, cF.x)*step(cF.x, 0.8)*step(0.22, cF.y)*step(cF.y, 0.78);
        float cFw = max(fwidth(cUV.x), fwidth(cUV.y));
        float cLit = mix(step(0.74, h21(cId))*cMask, 0.06, smoothstep(0.3, 0.75, cFw))*cWall;
        float cTop = step(0.7, vNW.y);
        vec2 rUV = vLoc.xz/0.9;
        vec2 rId = floor(rUV) + vSd*57.0;
        float rDot = (1.0 - smoothstep(0.05, 0.12, length(fract(rUV) - 0.5)))*step(0.82, h21(rId + 3.7))*cTop;
        rDot = max(rDot, step(0.5, vSd)*cTop*(1.0 - smoothstep(0.08, 0.15, length(fract(rUV + 0.31) - 0.5)))*step(0.5, h21(rId + 9.1)));
        rDot *= 1.0 - smoothstep(0.3, 0.9, cFw);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(1.0, 0.7, 0.36)*cLit*0.9 + vec3(1.0, 0.8, 0.5)*rDot*1.1 + diffuseColor.rgb*vec3(0.9, 0.55, 0.26)*0.06;`);
  };
  mat.customProgramCacheKey = () => 'carpet2';
  const mesh = new THREE.InstancedMesh(geo, mat, cells.length);
  const pal = ['#4a3c2b', '#34322e', '#5e5244', '#3c3226', '#6e5836', '#262422'].map(c => new THREE.Color(c));
  const basis = new THREE.Matrix4(), scl = new THREE.Matrix4(), rot = new THREE.Matrix4(), m = new THREE.Matrix4(), c = new THREE.Color();
  const lineBasis = new THREE.Matrix4().makeBasis(L.LINE_DIR, UP, SIDE);
  cells.forEach((q, i) => {
    rot.makeRotationY(q.yaw);
    scl.makeScale(q.w, q.h, q.d);
    m.multiplyMatrices(lineBasis, rot).multiply(scl);
    const p = L.LINE_P0.clone().addScaledVector(L.LINE_DIR, q.along).addScaledVector(SIDE, q.lat);
    m.setPosition(p.x, 0.3, p.z);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, c.copy(pal[Math.floor(q.tone*pal.length)]).multiplyScalar(0.7 + 0.4*((q.tone*7.3) % 1)));
  });
  mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();          // static: culled when the camera is elsewhere in the hall
  mesh.name = 'carpet';

  /* street lights: one Points draw, static */
  const lamps = [];
  const lr = rng(909);
  for (const lat of [2.4, 5.0, -3.9, -5.5, 13, 20, -16.5, -24]) {
    for (let along = 40 + lr()*5; along < 150; along += 6.5 + lr()*1.5) {
      if (lr() < sm(96, 146, along)) continue;
      const p = L.LINE_P0.clone().addScaledVector(L.LINE_DIR, along).addScaledVector(SIDE, lat + (lr() - 0.5)*0.6);
      lamps.push(p.x, 0.9 + lr()*0.5, p.z);
    }
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(lamps, 3));
  lg.boundingSphere = new THREE.Sphere(L.LINE_P0.clone().addScaledVector(L.LINE_DIR, 95), 80);
  const lm = new THREE.ShaderMaterial({
    transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
    uniforms:{uRes:{value:900}},
    vertexShader:`uniform float uRes; varying float vA;
      void main(){
        vec4 mv = viewMatrix*vec4(position, 1.0);
        gl_Position = projectionMatrix*mv;
        float px = uRes/900.0;
        gl_PointSize = clamp(0.5*projectionMatrix[1][1]*uRes*0.5/max(-mv.z, 0.1), 1.8*px, 7.0*px);
        vA = smoothstep(2.0, 9.0, -mv.z)*(1.0 - smoothstep(150.0, 320.0, -mv.z));
      }`,
    fragmentShader:`varying float vA;
      void main(){
        float a = smoothstep(1.0, 0.1, length(gl_PointCoord - 0.5)*2.0)*vA;
        gl_FragColor = vec4(vec3(1.0, 0.72, 0.38)*a*1.2, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const lights = new THREE.Points(lg, lm);
  lights.onBeforeRender = r => { const rt = r.getRenderTarget(); lm.uniforms.uRes.value = rt ? rt.height : r.getDrawingBufferSize(new THREE.Vector2()).y; };
  lights.name = 'streetlights';
  return {mesh, lights, count:cells.length, lamps:lamps.length/3};
}
