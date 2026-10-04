/* What drives the shafts: a clockwork that hangs above the hall's centre on the same column as the
   floor gear. Three planetary trains stack up the column (sun on the column, planets on a fixed
   carrier, an internal ring gear that the planets drive), so the three rings turn at Ns/NR of the column
   and against each other's tooth counts, never for decoration (clockwork.js holds the arithmetic;
   meshtest checked every tooth).

   The whole machine is ONE draw call: every rotating part carries its pivot, rate and phase as vertex
   attributes and the vertex shader turns it from the shared spin. It fades up into darkness and is
   lit from below by the hall (no extra light sources: the lights' count is part of every shader's cache key). Beside it, sparse warm dust drifts in the light over each pillar (one
   Points draw, a few hundred motes, culled when it is off screen). */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { gearGeometry } from './parts.js';
import * as L from './layout.js';
import { planetary, TWO_PI, RING } from './clockwork.js';

/* Heights of the three trains above the floor. The tallest vitrine top is 41; the rings stay inside
   the radius of the vitrine ring (78), so they never overlap a vitrine in plan. */
export const MECH = {y:[62, 72, 82], top:108, m:1.15, depth:2.1};
const LAYERS = [
  {Ns:24, Np:24, P:3, phi0:0.35},
  {Ns:20, Np:16, P:3, phi0:1.1},
  {Ns:16, Np:12, P:4, phi0:0.2}
];
export const COLUMN_RATE = 0.25;      // the floor gear's rate in hall.js (fg.rotation.z = spin*0.25)

const COL = {ring:new THREE.Color('#b58b4b'), hi:new THREE.Color('#d7b773'), dk:new THREE.Color('#8a6a38'), steel:new THREE.Color('#9aa3a5')};

function ringGeometry(N, m, depth, rim){
  const Rp = N*m/2, tip = Rp - m, root = Rp + 1.25*m;
  const shape = new THREE.Shape();
  shape.absarc(0, 0, root + rim, 0, TWO_PI, false);
  const hole = new THREE.Path();
  let first = true;
  for (let t = 0; t < N; t++) {
    const c = t*TWO_PI/N, wr = Math.PI/N*RING.wr, wt = Math.PI/N*RING.wt;
    for (const [r, a] of [[root, c - wr], [tip, c - wt], [tip, c + wt], [root, c + wr]]) {
      const x = r*Math.cos(a), y = r*Math.sin(a);
      if (first) { hole.moveTo(x, y); first = false; } else hole.lineTo(x, y);
    }
  }
  hole.closePath();
  shape.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(shape, {depth, bevelEnabled:true, bevelThickness:m*0.12, bevelSize:m*0.05, bevelSegments:1, curveSegments:72});
  g.translate(0, 0, -depth/2);
  g.computeVertexNormals();
  return g;
}

export function buildOverhead(){
  const U = {uSpin:{value:0}, uFade:{value:new THREE.Vector2(MECH.y[2] + 6, MECH.top + 14)}};
  const cx = L.RC.x, cz = L.RC.z;
  const parts = [];
  /* A part is a geometry lying in the XZ plane (thickness along y), placed at (x, y, z), turning about the
     vertical through its pivot. Gear plane angle a is world rotateY(a): shape (cos a, sin a) -> (cos a, 0, -sin a). */
  function put(geo, {x = 0, y = 0, z = 0, px = x, pz = z, rate = 0, phase = 0, color, plane = true}){
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (plane) g.rotateX(-Math.PI/2);
    g.translate(x, y, z);
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    const n = g.attributes.position.count;
    const pv = new Float32Array(n*2), rp = new Float32Array(n*2), col = new Float32Array(n*3);
    for (let i = 0; i < n; i++) { pv[i*2] = px; pv[i*2 + 1] = pz; rp[i*2] = rate; rp[i*2 + 1] = phase; col[i*3] = color.r; col[i*3 + 1] = color.g; col[i*3 + 2] = color.b; }
    g.setAttribute('aPivot', new THREE.BufferAttribute(pv, 2));
    g.setAttribute('aRot', new THREE.BufferAttribute(rp, 2));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    parts.push(g);
  }
  const bar = (len, h, w, ang, {x0 = 0, y, ...o}) => {     // a bar from (cx, cz) outward along plane angle ang
    const g = new THREE.BoxGeometry(len, h, w); g.translate(x0 + len/2, 0, 0); g.rotateY(ang);
    put(g, {x:cx, y, z:cz, plane:false, ...o});
  };

  // the main column: a hex shaft with keys so its turning can be read, from the floor hub up into the dark
  {
    const y0 = 3.2, h = MECH.top - y0;
    put(new THREE.CylinderGeometry(1.15, 1.15, h, 6), {x:cx, y:y0 + h/2, z:cz, rate:COLUMN_RATE, color:COL.hi, plane:false});
    const keyN = 9;
    for (let i = 0; i < keyN; i++) put(new THREE.BoxGeometry(1.0, 2.0, 1.0), {x:cx + 1.5, y:y0 + (i + 0.5)*h/keyN, z:cz, px:cx, pz:cz, rate:COLUMN_RATE, color:COL.steel, plane:false});
    put(new THREE.CylinderGeometry(3.4, 4.2, 1.6, 20), {x:cx, y:4.2, z:cz, color:COL.dk, plane:false});          // bearing on the floor hub
  }

  LAYERS.forEach((cfg, li) => {
    const y = MECH.y[li], m = MECH.m, T = MECH.depth;
    const t = planetary({...cfg, m, sunRate:COLUMN_RATE, ringPhase:li*0.9});
    // sun on the column, with a hub that covers its bore
    put(gearGeometry(t.Ns, m, T, false), {x:cx, y, z:cz, rate:t.sunRate, phase:t.sunPhase, color:COL.hi});
    put(new THREE.CylinderGeometry(t.rs*0.2, t.rs*0.2, T + 1.6, 16), {x:cx, y, z:cz, rate:t.sunRate, color:COL.ring, plane:false});
    // internal ring gear
    const rim = 2.8;
    put(ringGeometry(t.NR, m, T, rim), {x:cx, y, z:cz, rate:t.ringRate, phase:t.ringPhase, color:COL.ring});
    // planets, their pins and the fixed carrier star below them
    const armY = y - T/2 - 2.1;
    for (const p of t.planets) {
      const px = cx + p.x, pz = cz + p.z;
      put(gearGeometry(t.Np, m, T, false), {x:px, y, z:pz, rate:p.rate, phase:p.phase, color:li % 2 ? COL.ring : COL.hi});
      put(new THREE.CylinderGeometry(1.15, 1.15, T + 3.5, 10), {x:px, y:y - 1.05, z:pz, color:COL.steel, plane:false});
      bar(t.d, 1.0, 3.2, Math.atan2(-p.z, p.x), {y:armY, color:COL.dk});
    }
    put(new THREE.CylinderGeometry(3.6, 3.6, 1.4, 18), {x:cx, y:armY, z:cz, color:COL.dk, plane:false});
    // ring spokes ride above the planets and turn with the ring: bars to a sleeve on the column
    const spokeY = y + T/2 + 1.7, reach = t.Rp + 1.25*m + 1.4;
    for (let k = 0; k < 3; k++) {
      const a = k*TWO_PI/3 + t.ringPhase + 0.5;
      bar(reach - 2.4, 0.9, 2.2, a, {x0:2.4, y:spokeY, rate:t.ringRate, color:COL.ring});
      const post = new THREE.BoxGeometry(2.2, spokeY - y + 0.2, 2.2);        // a post down to the ring's top face
      post.translate(reach, (spokeY - y)/2 - 0.5, 0); post.rotateY(a);
      put(post, {x:cx, y, z:cz, rate:t.ringRate, color:COL.ring, plane:false});
    }
    put(new THREE.CylinderGeometry(3.0, 3.0, 1.5, 16), {x:cx, y:spokeY, z:cz, rate:t.ringRate, color:COL.ring, plane:false});
  });

  const geo = mergeGeometries(parts);
  parts.forEach(g => g.dispose());
  geo.computeBoundingSphere();

  const mat = new THREE.MeshStandardMaterial({vertexColors:true, metalness:0.86, roughness:0.36});
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec2 aPivot; attribute vec2 aRot; uniform float uSpin; varying vec3 vWN; varying float vWY; varying vec3 vWP;`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        float gAng = aRot.y + uSpin*aRot.x; float gC = cos(gAng), gS = sin(gAng);
        objectNormal = vec3(objectNormal.x*gC + objectNormal.z*gS, objectNormal.y, -objectNormal.x*gS + objectNormal.z*gC);
        vWN = normalize(mat3(modelMatrix)*objectNormal);`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec2 gRel = transformed.xz - aPivot;
        transformed.x = aPivot.x + gRel.x*gC + gRel.y*gS;
        transformed.z = aPivot.y - gRel.x*gS + gRel.y*gC;
        vWY = transformed.y;
        vWP = (modelMatrix*vec4(transformed, 1.0)).xyz;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform vec2 uFade; varying vec3 vWN; varying float vWY; varying vec3 vWP;`)
      /* The clockwork dissolves (screen-door, no blending) as the camera comes within reach of it, so a camera
         that stands in the rotunda, as the decks beat does, is never behind the column. */
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        {
          float near = smoothstep(36.0, 52.0, length(vWP - cameraPosition));
          if (near < fract(52.9829189*fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))))) discard;
        }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          float up = smoothstep(uFade.x, uFade.y, vWY);
          float under = smoothstep(0.15, -0.85, vWN.y);
          totalEmissiveRadiance += diffuseColor.rgb*vec3(1.0, 0.6, 0.27)*(0.3*under + 0.05)*(1.0 - up);
        }`)
      .replace('#include <opaque_fragment>', `
        outgoingLight *= 0.8*(1.0 - 0.9*smoothstep(uFade.x, uFade.y, vWY));
        #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => 'overheadgear';
  const mech = new THREE.Mesh(geo, mat);
  mech.userData.keep = true;            // custom attributes: never statically batched
  mech.castShadow = false; mech.receiveShadow = false;

  const group = new THREE.Group(); group.name = 'overhead';
  group.add(mech);

  /* ---- dust in the pillar light ---- */
  const dust = buildDust();
  group.add(dust.points);

  return {
    group, mech, mat, tris:geo.attributes.position.count/3,
    update(spin, time){ U.uSpin.value = spin; dust.time = time; }
  };
}

function rng(seed){ let s = seed >>> 0; return () => { s = (s*1664525 + 1013904223) >>> 0; return s/4294967296; }; }

function buildDust(){
  const rand = rng(31337);
  const pos = [], aD = [];
  // over every pillar: a column of motes from the pool of light up past the vitrine
  for (const s of L.SLOTS) {
    const sl = L.SLOT[s.id];
    for (let i = 0; i < 20; i++) {
      const a = rand()*TWO_PI, r = 3 + rand()*14;
      pos.push(sl.pos.x + Math.cos(a)*r, 0.4, sl.pos.z + Math.sin(a)*r);
      aD.push(rand(), 0.55 + rand()*0.9, 0.5 + rand()*0.7, s.deck + 12 + rand()*8);
    }
  }
  // round the column and under the clockwork
  for (let i = 0; i < 70; i++) {
    const a = rand()*TWO_PI, r = 6 + Math.pow(rand(), 0.7)*46;
    pos.push(L.RC.x + Math.cos(a)*r, 3, L.RC.z + Math.sin(a)*r);
    aD.push(rand(), 0.4 + rand()*0.7, 0.5 + rand()*0.7, MECH.y[1] + rand()*10);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aD', new THREE.Float32BufferAttribute(aD, 4));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(L.RC.x, 30, L.RC.z), 130);
  const state = {time:0, points:null};
  const m = new THREE.ShaderMaterial({
    transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
    uniforms:{uTime:{value:0}, uRes:{value:900}, uSize:{value:0.2}},
    vertexShader:`attribute vec4 aD; uniform float uTime, uRes, uSize; varying float vA;
      void main(){
        float f = fract(aD.x + uTime*aD.y/aD.w);
        vec3 p = position + vec3(sin(uTime*0.11 + aD.x*20.0)*1.8, f*aD.w, cos(uTime*0.09 + aD.x*13.0)*1.8);
        vec4 mv = viewMatrix*vec4(p, 1.0);
        gl_Position = projectionMatrix*mv;
        float px = uRes/900.0;
        gl_PointSize = clamp(uSize*aD.z*projectionMatrix[1][1]*uRes*0.5/max(-mv.z, 0.1), 1.6*px, 5.0*px);
        float tw = 0.75 + 0.25*sin(uTime*1.3 + aD.x*50.0);
        vA = smoothstep(0.0, 0.1, f)*(1.0 - smoothstep(0.78, 1.0, f))*tw*(1.0 - smoothstep(180.0, 330.0, -mv.z));
      }`,
    fragmentShader:`varying float vA;
      void main(){
        float a = smoothstep(1.0, 0.1, length(gl_PointCoord - 0.5)*2.0)*vA*0.62;
        gl_FragColor = vec4(vec3(1.0, 0.8, 0.5)*a, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const pts = new THREE.Points(g, m);
  // runs only when the points are drawn, so a culled (off screen) cloud costs nothing
  pts.onBeforeRender = (r) => { m.uniforms.uTime.value = state.time; const rt = r.getRenderTarget(); m.uniforms.uRes.value = rt ? rt.height : r.getDrawingBufferSize(new THREE.Vector2()).y; };
  state.points = pts;
  return state;
}
