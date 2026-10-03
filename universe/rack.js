/* The line that leaves the vitrine: brass gear teeth that, as they travel,
   grow into city blocks. One InstancedMesh, one spine tube. The conveyor
   speed is Perpetua's spin, so when the machine turns the city is pushed out. */
import * as THREE from 'three';
import { LINE_DIR, LINE_P0, LINE_LEN, PY } from './layout.js';

const PITCH = 0.95;
const TOOTH = {x:0.36, y:0.62, z:0.72};

function rng(seed){ let s = seed >>> 0; return () => { s = (s*1664525 + 1013904223) >>> 0; return s/4294967296; }; }

/* Brass-toned blocks whose side faces carry a grid of lit windows. Needs aMorph and
   aSeed instance attributes (aMorph above 0.5 shows the windows). */
export function makeCityMaterial(){
  const mat = new THREE.MeshStandardMaterial({color:'#ffffff', metalness:0.55, roughness:0.46});
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aMorph; attribute float aSeed;
        varying float vMorph; varying float vSeed; varying vec3 vLoc; varying vec3 vNLoc;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vMorph = aMorph; vSeed = aSeed;
        vec3 isc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
        vLoc = position*isc; vNLoc = normal;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying float vMorph; varying float vSeed; varying vec3 vLoc; varying vec3 vNLoc;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        { vec3 n = abs(vNLoc);
          if (n.y < 0.5 && vMorph > 0.5) {
            float u = n.x > 0.5 ? vLoc.z : vLoc.x;
            vec2 g = vec2(u, vLoc.y) / vec2(0.3, 0.46);
            vec2 id = floor(g); vec2 f = fract(g);
            float win = step(0.2, f.x)*step(f.x, 0.8)*step(0.28, f.y)*step(f.y, 0.78);
            float h = fract(sin(dot(id + vSeed*37.0, vec2(12.9898, 78.233)))*43758.5453);
            float lit = step(0.6, h);
            totalEmissiveRadiance += vec3(1.0, 0.70, 0.36)*win*lit*mix(0.6, 1.0, fract(h*7.0))*1.25*smoothstep(0.5, 0.9, vMorph);
          } }`);
  };
  mat.customProgramCacheKey = () => 'rackwin';
  return mat;
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

  // Spine: the rack bar the teeth sit on.
  const spineMat = new THREE.MeshStandardMaterial({color:'#b58b4b', metalness:0.85, roughness:0.34});
  const spine = new THREE.Mesh(new THREE.TubeGeometry(curve, 700, 0.1, 6, false), spineMat);

  const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0);
  const seeds = new Float32Array(N), morph = new Float32Array(N);
  const rand = rng(20241003);
  const bw = new Float32Array(N*3);
  for (let i = 0; i < N; i++) {
    seeds[i] = rand();
    const spire = rand() < 0.035;
    bw[i*3]   = PITCH*(0.62 + rand()*0.34);
    bw[i*3+1] = spire ? 6.5 + rand()*6 : 1.2 + Math.pow(rand(), 2.2)*6.4;
    bw[i*3+2] = 0.75 + rand()*0.8;
  }
  box.setAttribute('aMorph', new THREE.InstancedBufferAttribute(morph, 1));
  box.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));

  const mat = makeCityMaterial();
  const inst = new THREE.InstancedMesh(box, mat, N);
  inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  inst.frustumCulled = false;
  inst.setColorAt(0, new THREE.Color());
  inst.instanceColor.setUsage(THREE.DynamicDrawUsage);

  const group = new THREE.Group(); group.add(spine, inst);
  const brassC = new THREE.Color('#d7b773'), tmpC = new THREE.Color(), bldA = new THREE.Color('#5a5042'), bldB = new THREE.Color('#a48d62');
  const P = new THREE.Vector3(), T = new THREE.Vector3(), S = new THREE.Vector3(), U = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  const basis = new THREE.Matrix4(), scl = new THREE.Matrix4(), mtx = new THREE.Matrix4();
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a)/(b - a))); return t*t*(3 - 2*t); };

  /* Quality knob: stride 2 or 3 draws every 2nd or 3rd tooth, each block that much wider,
     so the skyline keeps its outline but the per-frame work and instance count shrink. */
  let stride = 1;
  function setDensity(k){ stride = k; inst.count = Math.ceil(N/k); }
  function update(spin){
    const step = stride*PITCH, n = inst.count;
    const shift = ((spin*6*PITCH/(2*Math.PI)) % step + step) % step;
    for (let i = 0; i < n; i++) {
      const a = (i*step + shift) % wrapLen;
      const m = sm(9, 36, a);
      morph[i] = m;
      const fade = sm(0, 2.5, a) * (1 - sm(wrapLen - 26, wrapLen - 2, a));
      const u = Math.min(0.9999, a/total);
      curve.getPointAt(u, P); curve.getTangentAt(u, T);
      S.crossVectors(T, UP);
      if (S.lengthSq() < 0.04) S.set(1, 0, 0); else S.normalize();
      U.crossVectors(S, T).normalize();
      basis.makeBasis(T, U, S);
      const bi = Math.min(N - 1, i*stride)*3;
      const sx = (TOOTH.x + (bw[bi]*stride - TOOTH.x)*m)*fade;
      const sy = (TOOTH.y + (bw[bi+1] - TOOTH.y)*m)*fade;
      const sz = (TOOTH.z + (bw[bi+2] - TOOTH.z)*m)*fade;
      scl.makeScale(Math.max(sx, 1e-4), Math.max(sy, 1e-4), Math.max(sz, 1e-4));
      mtx.multiplyMatrices(basis, scl);
      mtx.setPosition(P.x + S.x*(seeds[i] - 0.5)*0.9*m, P.y + 0.06, P.z + S.z*(seeds[i] - 0.5)*0.9*m);
      inst.setMatrixAt(i, mtx);
      tmpC.copy(bldA).lerp(bldB, seeds[i]);
      tmpC.lerpColors(brassC, tmpC, m);
      inst.setColorAt(i, tmpC);
    }
    inst.instanceMatrix.needsUpdate = true; inst.instanceColor.needsUpdate = true;
    box.attributes.aMorph.needsUpdate = true;
  }
  update(0);
  return {group, update, curve, total, setDensity, count:() => inst.count};
}
