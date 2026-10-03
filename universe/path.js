/* The continuous take. Keyframes (data) -> two CatmullRomCurve3 (camera, look).
   Scroll maps to the curve through a table of *apparent motion*: the integral
   of |dP|/distance plus turn rate. Equal scroll then gives equal on-screen
   speed whether the camera is 4 units from a gear or 200 from the hall, which
   is dollying in log-distance space. Dwell beats hold the camera still. */
import * as THREE from 'three';
import { resolve } from './layout.js';
import { LOOK, DWELL_SHARE } from './data.js';

const smoother = x => x*x*x*(x*(x*6 - 15) + 10);
const LOOKC = Object.fromEntries(Object.entries(LOOK).map(([k, v]) => [k, {...v, fogC:new THREE.Color(v.fogC)}]));

export function buildJourney(keyframes){
  const N = keyframes.length;
  const frames = keyframes.map(k => ({...k, P:resolve(k.pos), T:resolve(k.target), L:LOOKC[k.look]}));
  const posCurve = new THREE.CatmullRomCurve3(frames.map(f => f.P), false, 'centripetal');
  const lookCurve = new THREE.CatmullRomCurve3(frames.map(f => f.T), false, 'centripetal');
  const DIV = 6000;
  posCurve.arcLengthDivisions = DIV; posCurve.updateArcLengths();
  const lengths = posCurve.getLengths(DIV), total = lengths[DIV];
  // u (arc-length fraction) of each keyframe
  frames.forEach((f, i) => { f.u = lengths[Math.round(i/(N-1)*DIV)] / total; });

  // Apparent-motion table over u.
  const K = 4000, M = new Float32Array(K + 1);
  const P0 = new THREE.Vector3(), P1 = new THREE.Vector3(), L0 = new THREE.Vector3(), L1 = new THREE.Vector3();
  const d0 = new THREE.Vector3(), d1 = new THREE.Vector3();
  const at = (u, P, L) => { posCurve.getPointAt(u, P); lookCurve.getPoint(posCurve.getUtoTmapping(u), L); };
  at(0, P0, L0);
  for (let j = 1; j <= K; j++) {
    at(j/K, P1, L1);
    const dist = 0.5*(P0.distanceTo(L0) + P1.distanceTo(L1));
    d0.subVectors(L0, P0).normalize(); d1.subVectors(L1, P1).normalize();
    const turn = Math.acos(Math.min(1, Math.max(-1, d0.dot(d1))));
    M[j] = M[j-1] + P0.distanceTo(P1)/Math.max(dist, 0.5) + 0.9*turn;
    P0.copy(P1); L0.copy(L1);
  }
  frames.forEach(f => { f.m = M[Math.round(f.u*K)]; });

  // Scroll layout: dwell spans by weight, travel spans by apparent motion.
  const holdSum = frames.reduce((s, f) => s + (f.hold || 0), 0);
  const trav = [];
  for (let i = 0; i < N-1; i++) trav.push(frames[i+1].m - frames[i].m + 0.35);
  const travSum = trav.reduce((a, b) => a + b, 0);
  let s = 0;
  frames.forEach((f, i) => {
    f.dwell = (f.hold || 0) / holdSum * DWELL_SHARE;
    f.s0 = s; f.s1 = s + f.dwell; s = f.s1;
    if (i < N-1) { f.travel = trav[i] / travSum * (1 - DWELL_SHARE); s += f.travel; }
  });
  frames[N-1].s1 = 1; frames[N-1].dwell = 1 - frames[N-1].s0;

  const stops = frames.map((f, i) => ({i, id:f.id, world:f.world, copy:f.copy, pins:f.pins, label:f.label, still:f.still,
    s0:f.s0, s1:f.s1, sc:(f.s0 + f.s1)/2, hold:f.hold || 0}));

  function invert(mTarget, uA, uB){
    let lo = Math.floor(uA*K), hi = Math.ceil(uB*K);
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (M[mid] < mTarget) lo = mid; else hi = mid; }
    const a = M[lo], b = M[hi], w = b > a ? (mTarget - a)/(b - a) : 0;
    return (lo + w*(hi - lo))/K;
  }

  const out = {
    pos:new THREE.Vector3(), look:new THREE.Vector3(), fov:32, i:0, f:0, dwelling:true, u:0,
    env:1, key:1, cam:0, hemi:0, rim:0, expo:1, fogD:0.001, vig:0.5, fogC:new THREE.Color()
  };
  const SC = ['env','key','cam','hemi','rim','expo','fogD','vig'];

  function sample(sc){
    sc = Math.min(1, Math.max(0, sc));
    let i = 0;
    while (i < N-1 && sc >= frames[i].s1 + (frames[i].travel || 0)) i++;
    const A = frames[i];
    let uu, f = 0, B = A;
    if (i >= N-1 || sc <= A.s1) { uu = A.u; B = A; }
    else {
      B = frames[i+1];
      f = (sc - A.s1) / A.travel;
      const e = f + 0.6*(smoother(f) - f);           // ease into and out of the dwells, mostly linear between
      uu = invert(A.m + e*(B.m - A.m), A.u, B.u);
      f = e;
    }
    at(uu, out.pos, out.look);
    out.u = uu; out.i = i; out.f = f; out.dwelling = (sc <= A.s1);
    const a = A.L, b = B.L;
    for (const k of SC) out[k] = a[k] + (b[k] - a[k])*f;
    out.fogC.copy(a.fogC).lerp(b.fogC, f);
    out.fov = (A.fov || 32) + ((B.fov || 32) - (A.fov || 32))*f;
    out.pscale = (A.pscale || 2.3) + ((B.pscale || 2.3) - (A.pscale || 2.3))*f;     // how far a portrait phone may pull the camera back
    out.near = i + (f > 0.5 ? 1 : 0);
    return out;
  }
  return {frames, stops, sample, total};
}
