/* The line that leaves the vitrine: brass gear teeth that, as they travel,
   grow into a night skyline. Two rows of buildings share one conveyor (Perpetua's spin),
   so when the machine turns the city is pushed out.

   Every building is a fixed identity that rides the conveyor, so its shape and windows never
   change as it moves. Seven shared silhouettes are drawn as seven InstancedMeshes, and the
   windows are drawn in the shader (no textures, no extra downloads). */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LINE_DIR, LINE_P0, LINE_LEN, PY } from './layout.js';

const PITCH = 0.95;
const TOOTH = {x:0.36, y:0.62, z:0.72};
const BACK_PITCH = 2.05;

function rng(seed){ let s = seed >>> 0; return () => { s = (s*1664525 + 1013904223) >>> 0; return s/4294967296; }; }
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a)/(b - a))); return t*t*(3 - 2*t); };

/* ---------- silhouettes ----------
   Unit space: footprint +-0.5, height 0..1 (the instance scale gives metres). Body tiers carry
   aTier = (base, top, half-width) so the window grid can start at each tier's own base.
   Rooftop details carry aRoof = (flag, cx, cz, baseY) and are sized in absolute metres, so a water
   tank stays a water tank whether the tower under it is 2 or 12 metres tall. */
function silhouette(build){
  const P = [], N = [], T = [], R = [], I = [];
  const vtx = (p, n, t, r) => { P.push(p[0], p[1], p[2]); N.push(n[0], n[1], n[2]); T.push(t[0], t[1], t[2]); R.push(r[0], r[1], r[2], r[3]); return P.length/3 - 1; };
  const quad = (a, b, c, d, n, t, r) => { const i = vtx(a, n, t, r); vtx(b, n, t, r); vtx(c, n, t, r); vtx(d, n, t, r); I.push(i, i + 1, i + 2, i, i + 2, i + 3); };
  const NO = [0, 0, 0, 0], NT = [0, 0, 0];
  const v3 = {
    sub:(a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    cross:(a, b) => [a[1]*b[2] - a[2]*b[1], a[2]*b[0] - a[0]*b[2], a[0]*b[1] - a[1]*b[0]],
    norm:a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0]/l, a[1]/l, a[2]/l]; }
  };
  // a box with four walls and a roof (no floor: it always stands on something)
  function slab(x0, x1, y0, y1, z0, z1, n, t, r, ox = 0, oy = 0, oz = 0){
    const q = (a, b, c, d, nn) => quad([a[0] + ox, a[1] + oy, a[2] + oz], [b[0] + ox, b[1] + oy, b[2] + oz], [c[0] + ox, c[1] + oy, c[2] + oz], [d[0] + ox, d[1] + oy, d[2] + oz], nn, t, r);
    q([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]);
    q([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]);
    q([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0]);
    q([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]);
    q([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0]);
  }
  const tier = (y0, y1, f) => { const h = 0.5*f; slab(-h, h, y0, y1, -h, h, null, [y0, y1, h], NO); };
  function frustum(y0, y1, f0, f1){
    const h0 = 0.5*f0, h1 = 0.5*f1, t = [y0, y0, h0];
    const side = (a, b, c, d) => quad(a, b, c, d, v3.norm(v3.cross(v3.sub(b, a), v3.sub(d, a))), t, NO);
    side([-h0, y0, h0], [h0, y0, h0], [h1, y1, h1], [-h1, y1, h1]);
    side([h0, y0, -h0], [-h0, y0, -h0], [-h1, y1, -h1], [h1, y1, -h1]);
    side([h0, y0, h0], [h0, y0, -h0], [h1, y1, -h1], [h1, y1, h1]);
    side([-h0, y0, -h0], [-h0, y0, h0], [-h1, y1, h1], [-h1, y1, -h1]);
    quad([-h1, y1, h1], [h1, y1, h1], [h1, y1, -h1], [-h1, y1, -h1], [0, 1, 0], t, NO);
  }
  // rooftop pieces in metres, hung off a point on the roof at (cx, baseY, cz)
  const dbox = (cx, cz, base, x0, x1, y0, y1, z0, z1, flag = 1) => slab(x0, x1, y0, y1, z0, z1, null, NT, [flag, cx, cz, base], cx, base, cz);
  function dcyl(cx, cz, base, ox, oz, rad, y0, y1, segs = 10){
    const r = [1, cx, cz, base];
    for (let i = 0; i < segs; i++) {
      const a0 = i/segs*Math.PI*2, a1 = (i + 1)/segs*Math.PI*2, am = (a0 + a1)/2;
      const c0 = [cx + ox + Math.cos(a0)*rad, base + y0, cz + oz + Math.sin(a0)*rad], c1 = [cx + ox + Math.cos(a1)*rad, base + y0, cz + oz + Math.sin(a1)*rad];
      const d0 = [c0[0], base + y1, c0[2]], d1 = [c1[0], base + y1, c1[2]];
      quad(c1, c0, d0, d1, [Math.cos(am), 0, Math.sin(am)], NT, r);
      quad([cx + ox, base + y1, cz + oz], d1, d0, d0, [0, 1, 0], NT, r);       // cap wedge (triangle as a degenerate quad)
    }
  }
  build({tier, frustum, dbox, dcyl});
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('aTier', new THREE.Float32BufferAttribute(T, 3));
  g.setAttribute('aRoof', new THREE.Float32BufferAttribute(R, 4));
  g.setIndex(I);
  return g;
}

const V_SLAB = 0, V_SETB2 = 1, V_SETB3 = 2, V_CROWN = 3, V_SPIRE = 4, V_TANK = 5, V_ROOF = 6, NV = 7;
const VARIANTS = [
  ({tier}) => tier(0, 1, 1),
  ({tier}) => { tier(0, 0.64, 1); tier(0.64, 1, 0.66); },
  ({tier}) => { tier(0, 0.5, 1); tier(0.5, 0.78, 0.78); tier(0.78, 1, 0.52); },
  ({tier, frustum}) => { tier(0, 0.78, 1); tier(0.78, 0.88, 0.7); frustum(0.88, 1, 0.7, 0.2); },
  ({tier, dbox}) => {
    tier(0, 0.88, 1); tier(0.88, 0.95, 0.6);
    dbox(0, 0, 0.95, -0.07, 0.07, 0, 0.5, -0.07, 0.07);
    dbox(0, 0, 0.95, -0.025, 0.025, 0.5, 2.3, -0.025, 0.025);
    dbox(0, 0, 0.95, -0.06, 0.06, 2.3, 2.46, -0.06, 0.06, 2);          // aviation beacon
  },
  ({tier, dbox, dcyl}) => {
    tier(0, 1, 1);
    dbox(0.16, -0.12, 1, -0.1, 0.1, 0, 0.14, -0.1, 0.1);
    dcyl(0.16, -0.12, 1, 0, 0, 0.19, 0.14, 0.58);
    dbox(-0.22, 0.2, 1, -0.13, 0.13, 0, 0.16, -0.1, 0.1);
  },
  ({tier, dbox}) => {
    tier(0, 0.62, 1); tier(0.62, 1, 0.66);
    dbox(0, 0, 1, -0.13, 0.13, 0, 0.28, -0.13, 0.13);
    dbox(0.15, 0.1, 1, -0.11, 0.11, 0, 0.15, -0.09, 0.09);
    dbox(-0.13, -0.12, 1, -0.09, 0.09, 0, 0.13, -0.08, 0.08);
  }
];

/* Facade tones: brass, gold, cream and bronze over smoked glass, so no two neighbours read as one beige box. */
const PALETTE = [
  ['#8a6f45', 3], ['#b79c68', 2], ['#d9c9a0', 1], ['#5b4a36', 3], ['#3d3a36', 2], ['#7a6a58', 2], ['#a07a4a', 2], ['#2e2c2a', 2]
];
const PAL_TOTAL = PALETTE.reduce((s, p) => s + p[1], 0);

const HASH = `
uint hu(uint v){ v = v*747796405u + 2891336453u; uint w = ((v >> ((v >> 28u) + 4u)) ^ v)*277803737u; return (w >> 22u) ^ w; }
float hash3(ivec3 p){ uvec3 q = uvec3(p); return float(hu(q.x + hu(q.y + hu(q.z))))*(1.0/4294967295.0); }`;

/* Brass-toned blocks whose faces carry a crisp grid of windows. Needs aMorph, aSeed, aTier and aRoof
   attributes (aMorph above 0.5 shows the windows). The window grid is anti-aliased with fwidth and
   fades to its average brightness when a cell is smaller than a pixel, so it never shimmers.
   uTime drives the slow window switching and the roof beacons. */
export function makeCityMaterial(){
  const U = {
    uTime:{value:0},
    uHaze:{value:new THREE.Vector3(1/110, 0.28, 0.7)},     // 1/range, extra along the run, dimming
    uP0:{value:LINE_P0.clone()},
    uDir:{value:LINE_DIR.clone()}
  };
  const mat = new THREE.MeshStandardMaterial({color:'#ffffff', metalness:0.3, roughness:0.5});
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aMorph; attribute float aSeed; attribute vec3 aTier; attribute vec4 aRoof;
        varying float vMorph; varying float vSeed; varying float vRoof; varying float vY;
        varying vec3 vLoc; varying vec3 vNLoc; varying vec3 vTier; varying vec4 vTM; varying vec4 vWin; varying float vP; varying vec3 vWP;
        ${HASH}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vMorph = aMorph; vSeed = aSeed; vRoof = aRoof.x; vTier = aTier;
        vec3 isc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
        vec3 lp = position;
        if (aRoof.x > 0.5) {
          vec3 o = (position - vec3(aRoof.y, aRoof.w, aRoof.z))*smoothstep(0.6, 1.0, aMorph);
          lp = vec3(aRoof.y + o.x/isc.x, aRoof.w + o.y/isc.y, aRoof.z + o.z/isc.z);
        }
        transformed = lp;
        vY = lp.y; vLoc = lp*isc; vNLoc = normal;
        float fhalf = abs(normal.x) > 0.5 ? aTier.z*isc.z : aTier.z*isc.x;
        vTM = vec4(aTier.x*isc.y, aTier.y*isc.y, fhalf, 0.0);
        int sdv = int(aSeed*65535.0);
        float h3 = hash3(ivec3(sdv, 3, 5));
        float fwf = 0.58, fhf = 0.56;
        if (h3 < 0.18) { fwf = 0.9; fhf = 0.42; } else if (h3 < 0.34) { fwf = 0.42; fhf = 0.8; }
        vWin = vec4(mix(0.22, 0.32, hash3(ivec3(sdv, 1, 5))), mix(0.34, 0.5, hash3(ivec3(sdv, 2, 5))), fwf, fhf);
        vP = mix(0.35, 0.55, hash3(ivec3(sdv, 4, 5)));
        vWP = (modelMatrix*instanceMatrix*vec4(lp, 1.0)).xyz;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uTime; uniform vec3 uHaze; uniform vec3 uP0; uniform vec3 uDir;
        varying float vMorph; varying float vSeed; varying float vRoof; varying float vY;
        varying vec3 vLoc; varying vec3 vNLoc; varying vec3 vTier; varying vec4 vTM; varying vec4 vWin; varying float vP; varying vec3 vWP;
        float gCov = 0.0; vec3 gEmit = vec3(0.0); float gWall = 0.0; float gGate = 0.0;
        ${HASH}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          int sd = int(vSeed*65535.0);
          gGate = smoothstep(0.35, 0.75, vMorph);
          vec3 nn = vNLoc;
          float wall = (abs(nn.y) < 0.3 && vRoof < 0.5) ? 1.0 : 0.0;
          gWall = wall;
          float fx = abs(nn.x) > 0.5 ? 1.0 : 0.0;
          float u = fx > 0.5 ? vLoc.z : vLoc.x;
          float cw = vWin.x, fh = vWin.y;
          float ncol = floor((2.0*vTM.z - 0.12)/cw);
          float nrow = floor((vTM.y - vTM.x - 0.34)/fh);
          float valid = wall*step(1.0, ncol)*step(1.0, nrow);
          ncol = max(ncol, 1.0); nrow = max(nrow, 1.0);
          float wu = max(fwidth(u), 1e-4), wv = max(fwidth(vLoc.y), 1e-4);
          float ub = ncol*cw, vb = nrow*fh;
          float uu = u + 0.5*ub, vv = vLoc.y - vTM.x - 0.17;
          float cxn = uu/cw, cyn = vv/fh;
          float col = floor(cxn), row = floor(cyn);
          vec2 fr = vec2(cxn - col, cyn - row);
          float covX = clamp((0.5*vWin.z - abs(fr.x - 0.5))*cw/wu + 0.5, 0.0, 1.0);
          float covY = clamp((0.5*vWin.w - abs(fr.y - 0.5))*fh/wv + 0.5, 0.0, 1.0);
          float mx = smoothstep(0.28, 0.7, wu/cw), my = smoothstep(0.28, 0.7, wv/fh);
          covX = mix(covX, vWin.z, mx); covY = mix(covY, vWin.w, my);
          float bx = clamp(min(uu, ub - uu)/wu + 0.5, 0.0, 1.0), by = clamp(min(vv, vb - vv)/wv + 0.5, 0.0, 1.0);
          float blk = bx*by*valid*gGate;
          float cov = covX*covY*blk;
          int fi = fx > 0.5 ? (nn.x > 0.0 ? 0 : 1) : (nn.z > 0.0 ? 2 : 3);
          int ti = int(vTier.x*8.0 + 0.5);
          ivec3 ck = ivec3(int(col) + 977*fi, int(row) + 1319*ti, sd);
          float p = vP;
          float ha = hash3(ck + ivec3(0, 0, 7919));
          float tcl = uTime*(1.0/200.0) + ha*61.0;
          float kk = floor(tcl);
          float fd = smoothstep(0.0, 0.025, tcl - kk);
          float sOld = step(hash3(ivec3(ck.x, ck.y, sd + 104729*(int(kk) + 3))), p);
          float sNew = step(hash3(ivec3(ck.x, ck.y, sd + 104729*(int(kk) + 4))), p);
          float litCell = mix(step(hash3(ck), p), mix(sOld, sNew, fd), step(0.8, ha));
          float hRow = hash3(ivec3(int(row) + 1319*ti, fi, sd + 17));
          float hCol = hash3(ivec3(int(col) + 977*fi, ti, sd + 29));
          float litRow = clamp(p + (hRow - 0.5)*0.5, 0.0, 1.0), litCol = clamp(p + (hCol - 0.5)*0.5, 0.0, 1.0);
          float lit = mix(mix(litCell, litRow, mx), mix(litCol, p, mx), my);
          float hc = hash3(ck + ivec3(0, 0, 3571));
          vec3 warm = mix(vec3(1.0, 0.58, 0.22), vec3(1.0, 0.86, 0.58), clamp(hc*1.25, 0.0, 1.0));
          if (hc > 0.93) warm = vec3(0.74, 0.88, 1.0);
          float inten = mix(0.55, 1.15, hash3(ck + ivec3(0, 0, 6151)));
          vec3 wcol = mix(warm*inten, vec3(1.0, 0.72, 0.40)*0.85, max(mx, my));
          gCov = cov;
          gEmit = wcol*lit*cov*1.5;
          // facade: light falls off toward the street, the camera-facing wall reads a touch brighter, dark piers between windows
          float tone = mix(0.55, 1.1, smoothstep(0.0, 1.0, vY));
          vec3 facade = diffuseColor.rgb*tone*(fx > 0.5 ? 0.8 : 1.0)*mix(1.0, 0.62, blk);
          float k = vRoof > 0.5 ? 0.62 : (wall < 0.5 ? 0.55 : 1.0);
          diffuseColor.rgb = mix(facade*k, vec3(0.018, 0.022, 0.028), cov*0.92);
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.16, gCov*0.9);`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        metalnessFactor = mix(metalnessFactor, 0.65, gCov);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += gEmit;
        totalEmissiveRadiance += diffuseColor.rgb*vec3(0.95, 0.58, 0.28)*exp(-vLoc.y*1.15)*gWall*gGate*0.5;
        if (vRoof > 1.5) totalEmissiveRadiance += vec3(1.0, 0.12, 0.06)*step(0.86, fract(uTime*0.42 + vSeed*9.0))*3.0*gGate;`)
      .replace('#include <opaque_fragment>', `
        {
          float dist = length(vViewPosition);
          float hz = 1.0 - exp(-pow(dist*uHaze.x, 1.35));
          hz = clamp(hz + uHaze.y*smoothstep(70.0, 205.0, dot(vWP - uP0, uDir)), 0.0, 1.0);
          float lum = dot(outgoingLight, vec3(0.299, 0.587, 0.114));
          outgoingLight = mix(outgoingLight, vec3(lum)*vec3(1.0, 0.94, 0.86), 0.6*hz)*(1.0 - uHaze.z*hz);
        }
        #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => 'rackwin2';
  mat.userData.uniforms = U;
  return mat;
}

/* Tiny moving lights along the avenues at street level: one Points draw, positions computed in the
   vertex shader from the clock, so the CPU does nothing per frame. */
function makeCars(U, lite, start, length){
  const lanes = [
    {s:3.3,  v:5.5,  n:46, tail:1}, {s:4.2,  v:-4.5, n:46, tail:0},
    {s:-6.2, v:4.0,  n:30, tail:1}, {s:-7.0, v:-5.0, n:30, tail:0}
  ];
  const rand = rng(777);
  const car = [];
  for (const l of lanes) for (let i = 0; i < Math.round(l.n*(lite ? 0.4 : 1)); i++) car.push(l.s + (rand() - 0.5)*0.35, rand(), l.v*(0.8 + rand()*0.4), l.tail);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(car.length/4*3), 3));
  g.setAttribute('aCar', new THREE.Float32BufferAttribute(car, 4));
  const side = new THREE.Vector3(LINE_DIR.z, 0, -LINE_DIR.x).negate();     // toward the camera's side of the line
  const m = new THREE.ShaderMaterial({
    transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
    uniforms:{uTime:U.uTime, uRes:{value:900}, uSize:{value:0.15}, uP0:{value:LINE_P0.clone()}, uDir:{value:LINE_DIR.clone()}, uSide:{value:side}, uSpan:{value:new THREE.Vector2(start, length)}},
    vertexShader:`attribute vec4 aCar; uniform float uTime, uRes, uSize; uniform vec3 uP0, uDir, uSide; uniform vec2 uSpan;
      varying vec3 vCol; varying float vA;
      void main(){
        float s = fract(aCar.y + uTime*aCar.z/uSpan.y);
        vec3 wp = uP0 + uDir*(uSpan.x + s*uSpan.y) + uSide*aCar.x + vec3(0.0, 0.16, 0.0);
        vec4 mv = viewMatrix*vec4(wp, 1.0);
        gl_Position = projectionMatrix*mv;
        float px = uRes/900.0; gl_PointSize = clamp(uSize*projectionMatrix[1][1]*uRes*0.5/max(-mv.z, 0.1), 1.6*px, 6.0*px);
        vCol = aCar.w > 0.5 ? vec3(1.0, 0.22, 0.1) : vec3(1.0, 0.86, 0.58);
        float far = 1.0 - exp(-pow(-mv.z*0.009, 1.35));
        vA = smoothstep(0.0, 0.05, s)*(1.0 - smoothstep(0.95, 1.0, s))*(1.0 - 0.85*far)*smoothstep(3.0, 12.0, -mv.z);
      }`,
    fragmentShader:`varying vec3 vCol; varying float vA;
      void main(){
        float a = smoothstep(1.0, 0.15, length(gl_PointCoord - 0.5)*2.0)*vA;
        gl_FragColor = vec4(vCol*a*1.6, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  pts.onBeforeRender = (r) => { const rt = r.getRenderTarget(); m.uniforms.uRes.value = rt ? rt.height : r.getDrawingBufferSize(new THREE.Vector2()).y; };
  return pts;
}


/* Phone tier only: a cheap stand-in for the mirror floor. The city is drawn again, flipped below the floor,
   as ONE instanced draw: the seven silhouettes are merged into a single geometry (a per-vertex variant id)
   and each instance collapses every silhouette but its own in the vertex shader. It shares nothing with the
   lit city material: it has no lighting, only a dark facade tone, a faint window pattern, and a fade with
   depth and distance, because the floor above it is only partly opaque (see ground.js). */
function makeMirror(geoms, capacity){
  const parts = geoms.map((g, v) => {
    const q = new THREE.BufferGeometry();
    q.setAttribute('position', g.attributes.position);
    q.setAttribute('normal', g.attributes.normal);
    q.setAttribute('aRoof', g.attributes.aRoof);
    q.setAttribute('aV', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count).fill(v), 1));
    q.setIndex(g.index);
    return q;
  });
  const geo = mergeGeometries(parts);
  const morph = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1).setUsage(THREE.DynamicDrawUsage);
  const vari = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aMorph', morph); geo.setAttribute('aVar', vari);
  const mat = new THREE.ShaderMaterial({
    fog:true,
    uniforms:{...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uP0:{value:LINE_P0.clone()}, uDir:{value:LINE_DIR.clone()}},
    vertexShader:`attribute float aMorph; attribute float aVar; attribute float aV; attribute vec4 aRoof;
      varying vec3 vCol; varying vec3 vWP; varying vec3 vN; varying vec2 vUH; varying float vSd;
      #include <fog_pars_vertex>
      void main(){
        if (abs(aV - aVar) > 0.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
        vec3 isc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
        vec3 lp = position;
        if (aRoof.x > 0.5) {
          vec3 o = (position - vec3(aRoof.y, aRoof.w, aRoof.z))*smoothstep(0.6, 1.0, aMorph);
          lp = vec3(aRoof.y + o.x/isc.x, aRoof.w + o.y/isc.y, aRoof.z + o.z/isc.z);
        }
        vec3 loc = lp*isc;
        vUH = vec2(abs(normal.x) > 0.5 ? loc.z : loc.x, loc.y);
        vN = normal;
        vSd = aMorph;
        vCol = instanceColor;
        vec4 wp = modelMatrix*instanceMatrix*vec4(lp, 1.0);
        vWP = wp.xyz;
        vec4 mvPosition = viewMatrix*wp;
        gl_Position = projectionMatrix*mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader:`uniform vec3 uP0; uniform vec3 uDir; varying vec3 vCol; varying vec3 vWP; varying vec3 vN; varying vec2 vUH; varying float vSd;
      #include <common>
      #include <fog_pars_fragment>
      float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x*p.y); }
      void main(){
        float wall = step(abs(vN.y), 0.3);
        vec2 uv = vec2(vUH.x/0.34, vUH.y/0.5);
        vec2 id = floor(uv) + floor(vWP.x*0.37 + vWP.z*0.53)*7.0;
        vec2 f = fract(uv);
        float mask = step(0.15, f.x)*step(f.x, 0.85)*step(0.2, f.y)*step(f.y, 0.8);
        float fw = max(fwidth(uv.x), fwidth(uv.y));
        float win = mix(step(0.55, h21(id))*mask, 0.22, smoothstep(0.3, 0.8, fw))*wall*step(0.5, vSd);
        float depth = max(0.0, -vWP.y);
        float dist = length(vWP - cameraPosition);
        float hz = 1.0 - exp(-pow(dist/120.0, 1.35));
        hz = clamp(hz + 0.5*smoothstep(70.0, 205.0, dot(vWP - uP0, uDir)), 0.0, 1.0);
        vec3 col = vCol*0.5 + vec3(1.0, 0.64, 0.3)*win*1.5;
        col *= exp(-depth/17.0)*(1.0 - 0.85*hz);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`
  });
  const mesh = new THREE.InstancedMesh(geo, mat, capacity);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.setColorAt(0, new THREE.Color()); mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  mesh.scale.y = -1; mesh.name = 'cityMirror'; mesh.count = 0;
  // instances move every frame, so a fixed sphere over the whole run (culled when the camera is elsewhere)
  mesh.boundingSphere = new THREE.Sphere(LINE_P0.clone().addScaledVector(LINE_DIR, LINE_LEN*0.5), LINE_LEN*0.62);
  return {mesh, morph, vari};
}

export function buildRack({lite = false} = {}){
  const pts = [
    new THREE.Vector3(5.2, PY + 0.55, 1.9),
    new THREE.Vector3(7.9, PY + 0.4, 3.9),
    new THREE.Vector3(8.2, PY - 1.0, 6.7),
    new THREE.Vector3(8.8, 3.6, 7.6),
    LINE_P0.clone()
  ];
  for (let a = 20; a <= LINE_LEN; a += 20) pts.push(LINE_P0.clone().addScaledVector(LINE_DIR, a));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  curve.arcLengthDivisions = 2000; curve.updateArcLengths();
  const total = curve.getLength();
  const N = Math.ceil(total/PITCH) - (lite ? 40 : 0);
  const wrapLen = N*PITCH;
  // arc length at which the curve reaches the line's own origin: the straight run starts there
  let a0 = 0, best = 1e9;
  for (let i = 0; i <= 600; i++) { const d = curve.getPointAt(i/600*0.2).distanceTo(LINE_P0); if (d < best) { best = d; a0 = i/600*0.2*total; } }

  // Spine: the rack bar the teeth sit on.
  const spineMat = new THREE.MeshStandardMaterial({color:'#b58b4b', metalness:0.85, roughness:0.34});
  const spine = new THREE.Mesh(new THREE.TubeGeometry(curve, 700, 0.1, 6, false), spineMat);

  /* ---- the buildings: identity is fixed, only the position rides the conveyor ---- */
  const NB = Math.floor(wrapLen/BACK_PITCH), backPitch = wrapLen/NB;
  const B = N + NB;
  const rand = rng(20241003);
  const row = new Uint8Array(B), jr = new Int32Array(B), variant = new Uint8Array(B);
  const bw = new Float32Array(B*3), lat = new Float32Array(B), seeds = new Float32Array(B), rgb = new Float32Array(B*3);
  const pal = PALETTE.map(p => new THREE.Color(p[0])), tmpC = new THREE.Color();
  const pickColor = () => {
    let r = rand()*PAL_TOTAL, k = 0;
    while (k < PALETTE.length - 1 && r >= PALETTE[k][1]) r -= PALETTE[k++][1];
    return tmpC.copy(pal[k]).multiplyScalar(0.8 + rand()*0.4);
  };
  const pickVariant = (h, r) => {
    if (h < 2.2) return r < 0.3 ? V_TANK : r < 0.5 ? V_ROOF : V_SLAB;
    if (h < 4.0) return r < 0.2 ? V_SLAB : r < 0.45 ? V_SETB2 : r < 0.6 ? V_TANK : r < 0.75 ? V_ROOF : V_SETB3;
    return r < 0.12 ? V_SLAB : r < 0.38 ? V_SETB2 : r < 0.62 ? V_SETB3 : r < 0.88 ? V_CROWN : V_ROOF;
  };
  for (let i = 0; i < B; i++) {
    const front = i < N, j = front ? i : i - N;
    row[i] = front ? 0 : 1; jr[i] = j; seeds[i] = rand();
    let w, h, d, l, v;
    if (front) {
      const hero = rand() < 0.06, spire = !hero && rand() < 0.04;
      if (hero) { h = 8.5 + rand()*5.5; w = PITCH*(1.05 + rand()*0.4); d = 1.3 + rand()*0.45; l = 0.9 + rand()*0.6; v = [V_CROWN, V_SPIRE, V_SETB3][Math.floor(rand()*3)]; }
      else if (spire) { h = 6.5 + rand()*6; w = PITCH*(0.5 + rand()*0.2); d = 0.7 + rand()*0.25; l = (rand() - 0.5)*0.9; v = V_SPIRE; }
      else { h = 1.2 + Math.pow(rand(), 2.2)*6.4; w = PITCH*(0.62 + rand()*0.34); d = 0.75 + rand()*0.8; l = (rand() - 0.5)*0.9; v = pickVariant(h, rand()); }
    } else {
      // the far row stands back from the camera side and rises behind the near one
      h = 5 + Math.pow(rand(), 1.4)*11; w = 1.2 + rand()*0.7; d = 1.6 + rand()*1.0; l = -(8 + rand()*4);
      v = rand() < 0.1 ? V_SPIRE : [V_SLAB, V_SETB2, V_SETB3, V_CROWN, V_CROWN][Math.floor(rand()*5)];
    }
    bw[i*3] = w; bw[i*3 + 1] = h; bw[i*3 + 2] = d; lat[i] = l; variant[i] = v;
    const c = pickColor(); rgb[i*3] = c.r; rgb[i*3 + 1] = c.g; rgb[i*3 + 2] = c.b;
  }

  const mat = makeCityMaterial();
  const U = mat.userData.uniforms;
  const cap = new Int32Array(NV); for (let i = 0; i < B; i++) cap[variant[i]]++;
  const meshes = [], geos = [];
  for (let v = 0; v < NV; v++) {
    const geo = silhouette(VARIANTS[v]);
    geo.setAttribute('aMorph', new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, cap[v])), 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, cap[v])), 1).setUsage(THREE.DynamicDrawUsage));
    const inst = new THREE.InstancedMesh(geo, mat, Math.max(1, cap[v]));
    inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    inst.frustumCulled = false;
    inst.setColorAt(0, new THREE.Color());
    inst.instanceColor.setUsage(THREE.DynamicDrawUsage);
    meshes.push(inst); geos.push(geo);
  }

  const mir = lite ? makeMirror(geos, B) : null;
  const cars = makeCars(U, lite, 34, 150);
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const group = new THREE.Group(); group.add(spine, ...meshes, cars);
  const brassC = new THREE.Color('#d7b773');
  const P = new THREE.Vector3(), T = new THREE.Vector3(), S = new THREE.Vector3(), Um = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  const SIDE = new THREE.Vector3().crossVectors(LINE_DIR, UP).normalize();      // toward the camera's side
  const basis = new THREE.Matrix4(), scl = new THREE.Matrix4(), mtx = new THREE.Matrix4(), lineBasis = new THREE.Matrix4().makeBasis(LINE_DIR, UP, SIDE);
  const cnt = new Int32Array(NV);

  /* Quality knob: stride 2 or 3 keeps every 2nd or 3rd building of each row, each that much wider,
     so the skyline keeps its outline but the per-frame work and instance count shrink. */
  let stride = 1, lastNow = performance.now()*0.001;
  function setDensity(k){ stride = k; }
  function setLive(on){ cars.visible = on && !reduced; }
  function update(spin){
    const now = performance.now()*0.001;
    if (!reduced) U.uTime.value += Math.min(0.2, Math.max(0, now - lastNow));
    lastNow = now;
    const D = spin*6*PITCH/(2*Math.PI);
    cnt.fill(0);
    let mc = 0;
    for (let i = 0; i < B; i++) {
      const r = row[i];
      if (stride > 1 && jr[i] % stride) continue;
      const a = (((jr[i]*(r ? backPitch : PITCH) + D) % wrapLen) + wrapLen) % wrapLen;
      const fade = r ? 1 - sm(wrapLen - 26, wrapLen - 2, a) : sm(0, 2.5, a)*(1 - sm(wrapLen - 26, wrapLen - 2, a));
      const m = r ? sm(40, 70, a) : sm(9, 36, a);
      const v = variant[i], inst = meshes[v], slot = cnt[v]++;
      let sx, sy, sz;
      if (r) {
        sx = bw[i*3]*stride*m*fade; sy = bw[i*3 + 1]*m*fade; sz = bw[i*3 + 2]*m*fade;
        scl.makeScale(Math.max(sx, 1e-4), Math.max(sy, 1e-4), Math.max(sz, 1e-4));
        mtx.multiplyMatrices(lineBasis, scl);
        P.copy(LINE_P0).addScaledVector(LINE_DIR, a - a0).addScaledVector(SIDE, lat[i]);
        mtx.setPosition(P.x, LINE_P0.y + 0.06, P.z);
      } else {
        const u = Math.min(0.9999, a/total);
        curve.getPointAt(u, P); curve.getTangentAt(u, T);
        S.crossVectors(T, UP);
        if (S.lengthSq() < 0.04) S.set(1, 0, 0); else S.normalize();
        Um.crossVectors(S, T).normalize();
        basis.makeBasis(T, Um, S);
        sx = (TOOTH.x + (bw[i*3]*stride - TOOTH.x)*m)*fade;
        sy = (TOOTH.y + (bw[i*3 + 1] - TOOTH.y)*m)*fade;
        sz = (TOOTH.z + (bw[i*3 + 2] - TOOTH.z)*m)*fade;
        scl.makeScale(Math.max(sx, 1e-4), Math.max(sy, 1e-4), Math.max(sz, 1e-4));
        mtx.multiplyMatrices(basis, scl);
        mtx.setPosition(P.x + S.x*lat[i]*m, P.y + 0.06, P.z + S.z*lat[i]*m);
      }
      inst.setMatrixAt(slot, mtx);
      const ca = inst.instanceColor.array, k = slot*3;
      if (r) { ca[k] = rgb[i*3]; ca[k + 1] = rgb[i*3 + 1]; ca[k + 2] = rgb[i*3 + 2]; }
      else {
        ca[k] = brassC.r + (rgb[i*3] - brassC.r)*m; ca[k + 1] = brassC.g + (rgb[i*3 + 1] - brassC.g)*m; ca[k + 2] = brassC.b + (rgb[i*3 + 2] - brassC.b)*m;
      }
      geos[v].attributes.aMorph.array[slot] = m;
      geos[v].attributes.aSeed.array[slot] = seeds[i];
      if (mir) {
        mir.mesh.setMatrixAt(mc, mtx);
        const mca = mir.mesh.instanceColor.array, mk = mc*3;
        mca[mk] = ca[k]; mca[mk + 1] = ca[k + 1]; mca[mk + 2] = ca[k + 2];
        mir.morph.array[mc] = m; mir.vari.array[mc] = v; mc++;
      }
    }
    if (mir) {
      mir.mesh.count = mc; mir.mesh.instanceMatrix.needsUpdate = true; mir.mesh.instanceColor.needsUpdate = true;
      mir.morph.needsUpdate = true; mir.vari.needsUpdate = true;
    }
    for (let v = 0; v < NV; v++) {
      const inst = meshes[v];
      inst.count = cnt[v]; inst.visible = cnt[v] > 0;
      inst.instanceMatrix.needsUpdate = true; inst.instanceColor.needsUpdate = true;
      geos[v].attributes.aMorph.needsUpdate = true; geos[v].attributes.aSeed.needsUpdate = true;
    }
  }
  update(0);
  return {group, update, curve, total, setDensity, setLive, cityMirror:mir ? mir.mesh : null, count:() => meshes.reduce((s, m) => s + m.count, 0)};
}
