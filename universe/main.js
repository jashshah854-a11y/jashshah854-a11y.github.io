/* One scene, one WebGL context, one render loop, one RAF (the GSAP ticker).
   Scroll writes targetT. A proxy chases it with gsap.quickTo. The loop reads
   only the smoothed value and places the camera on the journey curve. */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { gsap } from 'gsap';
import Lenis from 'lenis';
import { WORLDS, DECKS, JOURNEY, JOURNEY_VH } from './data.js';
import { Mechanics } from './mechanics.js';
import { buildPerpetua } from './perpetua.js';
import { buildHall } from './hall.js';
import { buildJourney } from './path.js';
import { chooseVideos, setRenderer } from './portal.js';
import { createUI } from './ui.js';
import * as L from './layout.js';

const $ = s => document.querySelector(s);
const params = new URLSearchParams(location.search);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || params.has('stills');
const phone = params.has('phone') || matchMedia('(max-width: 700px)').matches;
const lite = phone || params.has('lite');
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = x => { x = clamp(x, 0, 1); return x*x*(3 - 2*x); };
history.scrollRestoration = 'manual';

const journey = buildJourney(JOURNEY);
const stops = journey.stops;
const dwellStops = stops.filter(s => s.hold > 0);
const stillStops = stops.filter(s => s.hold > 0 && s.id !== 'all');
document.documentElement.style.setProperty('--journey', JOURNEY_VH);

/* ---------------- renderer, or the still fallback ---------------- */
const canvas = $('#gl');
let renderer = null, mode = reduced ? 'stills' : 'gl';
try {
  renderer = new THREE.WebGLRenderer({canvas, antialias:true, powerPreference:'high-performance', alpha:false});
} catch (err) { console.warn('WebGL unavailable', err); mode = 'nogl'; }

let dprCap = phone ? 1.25 : 1.5, pixelScale = 1, shadowEvery = 4;   // pixelScale is the quality ladder's second rung
window.__booting = true;                           // tells the watchdog in index.html the module graph did start
const camera = new THREE.PerspectiveCamera(32, innerWidth/innerHeight, 0.1, 1000);
const scene = new THREE.Scene();
scene.add(camera);
let perpetua = null, hall = null, key = null, camLight = null, hemi = null, rim = null;
const state = Mechanics.initial();
const baseEnergy = state.energy;
if (reduced) state.paused = true;
let spin = 0;

if (renderer) {
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, dprCap)*pixelScale);
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0).texture;
  scene.fog = new THREE.FogExp2('#14120e', 0.003);

  setRenderer(renderer);
  perpetua = buildPerpetua({lite});
  hall = buildHall({scene, lite, perpetua});

  key = new THREE.SpotLight('#fff0d4', 5, 0, 0.5, 0.92, 0);
  key.position.set(-6.5, L.PY + 17.5, 11);
  key.target.position.set(-0.4, L.PY + 2.2, 0.6);
  key.castShadow = true;
  key.shadow.mapSize.set(lite ? 1024 : 2048, lite ? 1024 : 2048);
  key.shadow.camera.near = 6; key.shadow.camera.far = 60;
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.025; key.shadow.radius = 3.5;
  scene.add(key, key.target);
  rim = new THREE.DirectionalLight('#cfe0ff', 0.5);
  rim.position.set(9, L.PY + 5, -7); rim.target.position.set(0, L.PY + 2, 0.6);
  scene.add(rim, rim.target);
  hemi = new THREE.HemisphereLight('#efe2c4', '#2a2418', 0.1);
  scene.add(hemi);
  camLight = new THREE.PointLight('#ffe4bd', 0, 170, 1);
  camLight.position.set(1.5, 2, 0); camera.add(camLight);
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); ui.toast('The graphics context paused. Reload to restore the scene.'); });
}

/* ---------------- scroll: Lenis on the GSAP ticker ---------------- */
const proxy = {t:0};
let targetT = 0, lenis = null;
const chase = gsap.quickTo(proxy, 't', {duration:0.9, ease:'power3.out'});
gsap.ticker.lagSmoothing(0);
if (mode === 'gl') {
  lenis = new Lenis({lerp:0.12, wheelMultiplier:0.9, touchMultiplier:1.2, smoothWheel:true});
  lenis.stop();                                // scroll is held behind the loading veil until the gallery is warm (see boot)
  lenis.on('scroll', e => { targetT = e.limit > 0 ? clamp(e.scroll/e.limit, 0, 1) : 0; chase(targetT); });
  gsap.ticker.add(time => lenis.raf(time*1000));
} else {
  document.body.classList.add('stills');
}
const scrollLimit = () => Math.max(1, document.documentElement.scrollHeight - innerHeight);

/* ---------------- navigation between stops ---------------- */
let stillIdx = 0;
function goT(sc, instant = false){
  sc = clamp(sc, 0, 1);
  if (mode === 'gl') {
    const dist = Math.abs(sc - targetT);
    lenis.scrollTo(sc*scrollLimit(), instant ? {immediate:true, force:true} : {duration:clamp(1.3 + dist*14, 1.3, 4.4), easing:x => x < 0.5 ? 4*x*x*x : 1 - Math.pow(-2*x + 2, 3)/2, force:true});
    if (instant) { targetT = sc; gsap.set(proxy, {t:sc}); chase(sc); }
  }
}
function goStopIndex(i){
  const s = stops[i]; if (!s) return;
  if (mode === 'gl') goT(s.sc);
  else showStill(dwellStops.indexOf(s));
}
const stopIdxById = id => stops.findIndex(s => s.id === id);
function currentDwellIdx(){
  const sc = proxy.t; let best = 0, bd = 9;
  dwellStops.forEach((s, i) => { const d = Math.abs(s.sc - sc); if (d < bd) { bd = d; best = i; } });
  return best;
}
function stepBy(n){
  if (mode !== 'gl') { showStill(clamp(stillIdx + n, 0, stillStops.length - 1)); return; }
  const cur = proxy.t; let idx = currentDwellIdx();
  if (n > 0) { while (idx < dwellStops.length - 1 && dwellStops[idx].sc <= cur + 0.003) idx++; }
  else { while (idx > 0 && dwellStops[idx].sc >= cur - 0.003) idx--; }
  goT(dwellStops[clamp(idx, 0, dwellStops.length - 1)].sc);
}

/* ---------------- ink-mask transition and scroll memory ---------------- */
const KEY = 'universe.scroll.v1';
function remember(){
  try { sessionStorage.setItem(KEY, JSON.stringify({y:window.scrollY, t:proxy.t, stop:stillIdx, mode, ts:Date.now()})); } catch (e) {}
}
function walkIn(href, ev){
  if (!href || href.startsWith('#')) return false;
  if (ev && (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button > 0)) return false;
  remember();
  const x = ev && ev.clientX ? ev.clientX : innerWidth*0.5, y = ev && ev.clientY ? ev.clientY : innerHeight*0.62;
  if (reduced) { location.href = href; return true; }
  const ink = $('#ink'), ink2 = $('#ink2'), o = {a:0, b:0};
  const R = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 40;
  ink.style.visibility = ink2.style.visibility = 'visible';
  const set = () => { ink.style.clipPath = `circle(${o.a}px at ${x}px ${y}px)`; ink2.style.clipPath = `circle(${o.b}px at ${x}px ${y}px)`; };
  gsap.to(o, {a:R, duration:0.7, ease:'power3.in', onUpdate:set});
  gsap.to(o, {b:R, duration:0.7, delay:0.16, ease:'power3.in', onUpdate:set, onComplete:() => { location.href = href; }});
  return true;
}
function coverInk(){
  const ink = $('#ink'), ink2 = $('#ink2'), R = Math.hypot(innerWidth, innerHeight)*1.2, c = `circle(${R}px at 50% 62%)`;
  ink.style.visibility = ink2.style.visibility = 'visible'; ink.style.clipPath = ink2.style.clipPath = c;
}
function reveal(){
  const ink = $('#ink'), ink2 = $('#ink2'), x = innerWidth*0.5, y = innerHeight*0.62;
  const R = Math.hypot(innerWidth, innerHeight), o = {a:R, b:R};
  ink.style.visibility = ink2.style.visibility = 'visible';
  const set = () => { ink.style.clipPath = `circle(${o.a}px at ${x}px ${y}px)`; ink2.style.clipPath = `circle(${o.b}px at ${x}px ${y}px)`; };
  set();
  gsap.to(o, {b:0, duration:0.7, ease:'power3.out', onUpdate:set});
  gsap.to(o, {a:0, duration:0.7, delay:0.14, ease:'power3.out', onUpdate:set, onComplete:() => { ink.style.visibility = ink2.style.visibility = 'hidden'; }});
}
addEventListener('pagehide', remember);
addEventListener('pageshow', e => { if (e.persisted) reveal(); });
let restoredFromWorld = false;
function restore(){
  let saved = null;
  try { saved = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (e) {}
  const nav = performance.getEntriesByType('navigation')[0];
  const type = nav ? nav.type : 'navigate';
  if (!saved || Date.now() - saved.ts > 3600e3 || (type !== 'back_forward' && type !== 'reload')) return false;
  if (mode === 'gl') { goT(saved.t, true); } else { stillIdx = clamp(saved.stop || 0, 0, stillStops.length - 1); }
  if (!reduced) { coverInk(); restoredFromWorld = true; }   // the ink that closed over the hall now draws back
  return true;
}

/* ---------------- UI wiring ---------------- */
const actions = {
  walkIn,
  goWorld: id => goStopIndex(stopIdxById('world:' + id)),
  next: () => stepBy(1),
  toHall: () => goStopIndex(stopIdxById('hall')),
  toStart: () => (mode === 'gl' ? goT(0) : showStill(0)),
  openRenders: () => ui.openRenders(),
  nextWorld: id => {
    const i = stopIdxById('world:' + id), nxt = stops.slice(i + 1).find(s => s.hold > 0);
    goStopIndex(nxt ? stops.indexOf(nxt) : stops.length - 1);
  }
};
const ui = createUI({worlds:WORLDS, decks:DECKS, stops, anchors:hall ? hall.anchors : [], actions});

addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target;
  if (t.closest && t.closest('dialog, #worlds, input, textarea')) return;
  const onControl = t.matches && t.matches('a, button, [tabindex]');
  if (e.key === 'ArrowDown' || e.key === 'PageDown' || (e.key === ' ' && !onControl)) { e.preventDefault(); stepBy(1); }
  else if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); stepBy(-1); }
  else if (e.key === 'Home') { e.preventDefault(); goT(0); }
  else if (e.key === 'End') { e.preventDefault(); goT(1); }
});

/* ---------------- Perpetua: drag to orbit, tap to give it a push ---------------- */
const orbit = {yaw:0, pitch:0, ty:0, tp:0};
let down = null, dragged = false;
canvas.addEventListener('pointerdown', e => { down = {x:e.clientX, y:e.clientY, t:performance.now(), id:e.pointerId}; dragged = false; });
addEventListener('pointermove', e => {
  if (!down || e.pointerId !== down.id) return;
  const dx = e.clientX - down.x, dy = e.clientY - down.y;
  if (!dragged && Math.hypot(dx, dy) > 6) { dragged = true; canvas.classList.add('drag'); }
  if (dragged) {
    orbit.ty = clamp(orbit.ty - (e.clientX - (down.lx ?? down.x))*0.005, -0.7, 0.7);
    orbit.tp = clamp(orbit.tp + (e.clientY - (down.ly ?? down.y))*0.004, -0.35, 0.4);
  }
  down.lx = e.clientX; down.ly = e.clientY;
});
const endDrag = e => {
  if (!down || (e.pointerId !== down.id)) return;
  const quick = performance.now() - down.t < 420;
  if (!dragged && quick && e.type === 'pointerup' && perpetua && proxy.t < 0.1) tryPush(e.clientX, e.clientY);
  down = null; canvas.classList.remove('drag');
};
addEventListener('pointerup', endDrag); addEventListener('pointercancel', endDrag);
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), sph = new THREE.Sphere();
function tryPush(x, y){
  ndc.set(x/innerWidth*2 - 1, -(y/innerHeight)*2 + 1);
  ray.setFromCamera(ndc, camera);
  let hit = false;
  perpetua.root.traverse(o => {
    if (hit || !o.isMesh) return;
    sph.copy(o.geometry.boundingSphere).applyMatrix4(o.matrixWorld);
    if (ray.ray.intersectsSphere(sph)) hit = true;
  });
  if (hit) {
    const added = Mechanics.push(state);
    state.paused = false;
    ui.toast(added > 0 ? 'A little energy from you. Every part responds.' : 'Already at the safe viewing speed.');
  }
}

/* ---------------- resize and quality ---------------- */
function resize(){
  const w = innerWidth, h = innerHeight;
  camera.aspect = w/h;
  if (renderer) { renderer.setPixelRatio(Math.min(devicePixelRatio || 1, dprCap)*pixelScale); renderer.setSize(w, h, false); }
}
addEventListener('resize', () => { resize(); stillSettle = 1.5; });
resize();
/* Adaptive quality. Budget 22 ms (about 45 fps). Frames over budget are counted, and after
   OVER_N of them the next rung comes off, one rung at a time, cheapest visual loss first:
   1. the planar mirror floor becomes a plain glossy floor (it renders the scene a second time),
   2. the pixel ratio drops (two steps), 3. the instanced city thins out (every 2nd, then 3rd tooth),
   4. the shadow map refreshes a quarter as often.
   Stalls over 120 ms are shader links or a hidden tab, not the hardware, so they are ignored. */
const BUDGET = 22, OVER_N = 30, COOLDOWN = 1000;
const quality = {rung:0, over:0, cool:0, log:[]};
const rungs = [];
function buildRungs(){
  if (hall.hasMirror()) rungs.push(['mirror off', () => hall.setMirror(false)]);
  rungs.push(['pixel ratio x0.85', () => { pixelScale = 0.85; resize(); }]);
  rungs.push(['pixel ratio x0.7', () => { pixelScale = 0.7; resize(); }]);
  rungs.push(['city density 1/2', () => hall.rack.setDensity(2)]);
  rungs.push(['city density 1/3', () => hall.rack.setDensity(3)]);
  rungs.push(['shadow refresh 1/16', () => { shadowEvery = 16; }]);   // the shadow pass re-draws the whole machine
}
function adaptQuality(ms){
  if (ms > 120 || frameN < 90 || quality.rung >= rungs.length) return;
  quality.cool = Math.max(0, quality.cool - ms);
  if (ms > BUDGET) quality.over++; else quality.over = Math.max(0, quality.over - 2);
  if (quality.over >= OVER_N && quality.cool <= 0) {
    const [name, apply] = rungs[quality.rung++];
    apply(); quality.over = 0; quality.cool = COOLDOWN; quality.log.push(name + ' @' + clock.toFixed(1) + 's');
  }
}

/* ---------------- the frame ---------------- */
const _off = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _right = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
let clock = 0, frameN = 0, stillSettle = 2, lastSc = -1;
function place(sample, sc){
  const aspect = camera.aspect;
  const portrait = aspect < 1.2;
  let fov = sample.fov, distScale = 1;
  if (portrait) {
    const t = clamp((1.2 - aspect)/0.8, 0, 1);
    fov = fov + (52 - fov)*t;
    const want = Math.tan(16*Math.PI/180)*1.6;
    distScale = clamp(want/(Math.tan(fov*Math.PI/360)*aspect), 1, sample.pscale);
  }
  camera.fov = fov;
  _off.subVectors(sample.pos, sample.look).multiplyScalar(distScale);
  const w = 1 - smooth(sc/0.03);
  orbit.yaw += (orbit.ty - orbit.yaw)*0.12; orbit.pitch += (orbit.tp - orbit.pitch)*0.12;
  if (sc > 0.03) { orbit.ty *= 0.96; orbit.tp *= 0.96; }
  if (w > 0.001 && (orbit.yaw || orbit.pitch)) {
    _q.setFromAxisAngle(_up, orbit.yaw*w);
    _right.crossVectors(_off, _up).normalize();
    _q2.setFromAxisAngle(_right, orbit.pitch*w);
    _off.applyQuaternion(_q).applyQuaternion(_q2);
  }
  camera.position.copy(sample.look).add(_off);
  const target = sample.look.clone();
  if (portrait && sample.dwelling) target.y -= (distScale - 1)*1.8;
  camera.lookAt(target);
  const fd = _off.length();
  camera.near = clamp(fd*0.02, 0.05, 4);
  camera.far = clamp(fd*30 + 400, 700, 2800);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
}
function applyLook(s, sc){
  scene.environmentIntensity = s.env;
  key.intensity = s.key;      // lights are never toggled: the light count is part of every shader's cache key
  rim.intensity = s.rim;
  hemi.intensity = s.hemi;
  camLight.intensity = s.cam*25;
  renderer.toneMappingExposure = s.expo;
  scene.fog.color.copy(s.fogC); scene.fog.density = s.fogD;
  scene.background = scene.fog.color;
  $('#shade').style.opacity = s.vig;
}
/* The paper cyclorama of the first beat is the one light surface behind the header. The same
   amount drives --paper, which gives the wordmark a dark pill only while paper is behind it. */
let lastPaper = -1;
function paintBackdrop(v){
  hall.setBackdrop(v);
  if (Math.abs(v - lastPaper) > 0.01) { lastPaper = v; document.documentElement.style.setProperty('--paper', v.toFixed(2)); }
}
function activeStop(sc){
  const m = 0.006;
  for (let i = 0; i < stops.length; i++) { const s = stops[i]; if (s.hold > 0 && sc >= s.s0 - m && sc <= s.s1 + m) return i; }
  return -1;
}
/* Resting on a world: its own shafts are hidden. Travelling: the shafts of the world just left and
   of the one being approached, so no drive line crosses the transit shot. */
function focusShafts(sample){
  const fr = journey.frames;
  if (sample.dwelling) { hall.focusWorld(fr[sample.i].world || null); return; }
  let a = null, b = null;
  for (let k = sample.i; k >= 0 && !a; k--) a = fr[k].world || null;
  for (let k = sample.i + 1; k < fr.length && !b; k++) b = fr[k].world || null;
  hall.focusWorld(a, b);
}
let firstFrames = 0;
let cpuEma = 0;
function frame(time, deltaMs){
  if (document.hidden || !renderer) return;
  const cpu0 = performance.now();
  const dt = clamp(deltaMs/1000, 0.0005, 0.1);
  clock += dt; frameN++;
  if (mode === 'gl' && !params.has('noadapt')) adaptQuality(deltaMs);
  // machine: real kinematics. A push decays back to the nominal speed.
  if (!state.paused && state.energy > baseEnergy) state.energy = baseEnergy + (state.energy - baseEnergy)*Math.exp(-dt*0.5);
  Mechanics.step(state, dt);
  spin = state.turns*2*Math.PI;
  perpetua.update(state.theta);

  const sc = proxy.t;
  if (sc > 0.012) hall.startLoading();
  if (hall.pending()) {
    if (sc > 0.02) hall.revealAll();
    else if (performance.now() - lastWarm > 160) { lastWarm = performance.now(); warmDraw(hall.revealNext()); }
  }
  const sample = journey.sample(sc);
  place(sample, sc);
  applyLook(sample, sc);
  paintBackdrop(sample.i === 0 ? 1 - smooth((sample.f - 0.15)/0.7) : 0);
  focusShafts(sample);
  hall.update({spin, time:clock, dt, camPos:camera.position, rackOn:sc > 0.02 && sc < 0.33 && frameN % 2 === 0, reflect:sc > 0.045 && !(sample.dwelling && stops[sample.i].world) && camera.position.distanceTo(sample.look) < 150});
  if (frameN % 20 === 0) chooseVideos(hall.portals, camera.position, 2, 230);
  // shadows: every frame inside the machine, every third once it is small
  if (key.intensity > 0.02 && sc < 0.3 && frameN % (sc < 0.05 ? shadowEvery/2 : shadowEvery) === 0) renderer.shadowMap.needsUpdate = true;
  const ai = activeStop(sc);
  ui.setActive(ai);
  ui.updatePins(camera, innerWidth, innerHeight, ai >= 0);
  renderer.render(scene, camera);
  cpuEma = cpuEma*0.9 + (performance.now() - cpu0)*0.1;
  if (++firstFrames === 3) { $('#veil').classList.add('done'); if (restoredFromWorld) setTimeout(reveal, 500); setTimeout(() => hall.startLoading(), 2500); }
}

/* reduced motion: still stops, rendered on demand */
function showStill(i){
  stillIdx = clamp(i, 0, stillStops.length - 1);
  const s = stillStops[stillIdx];
  stillSettle = 2;
  stillSample = journey.sample(s.sc); stillSc = s.sc;
  $('#stopCount').textContent = `${stillIdx + 1} of ${stillStops.length}`;
  $('#prevStop').disabled = stillIdx === 0; $('#nextStop').disabled = stillIdx === stillStops.length - 1;
  ui.setActive(stops.indexOf(s));
  const w = s.world && ui.byId[s.world];
  if (mode === 'nogl') {
    const src = s.world ? w.still : ['assets/u1.jpg', 'assets/u2.jpg', 'assets/u3.jpg', 'assets/u4.jpg'][Math.min(3, stillIdx)];
    const img = $('#still'); img.src = src; img.hidden = false; img.alt = s.label || (w && w.pin) || '';
  }
}
let stillSample = null, stillSc = 0, stillAcc = 0;
function stillsFrame(time, deltaMs){
  if (!renderer || !stillSample || stillSettle <= 0) return;
  stillAcc += deltaMs;
  if (stillAcc < 100) return; stillAcc = 0;
  stillSettle -= 0.1;
  const dt = 0.1; clock += dt;
  perpetua.update(state.theta);
  place(stillSample, stillSc); applyLook(stillSample, stillSc);
  paintBackdrop(stillSample.i === 0 ? 1 - smooth((stillSample.f - 0.15)/0.7) : 0);
  hall.focusWorld(journey.frames[stillSample.near].world || null);
  hall.update({spin:0, time:clock, dt, camPos:camera.position});
  if (key.intensity > 0.02) renderer.shadowMap.needsUpdate = true;
  ui.updatePins(camera, innerWidth, innerHeight, true);
  renderer.render(scene, camera);
  if (++firstFrames >= 2) $('#veil').classList.add('done');
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && hall) hall.portals.forEach(p => p.setVideoPlaying(false));
});

/* ---------------- go ---------------- */
/* Shaders link lazily on first draw. Perpetua's own are linked behind the loading
   veil. The rest of the gallery is revealed one piece at a time while the visitor
   is still inside the machine, each piece drawn once into a tiny viewport (with
   culling off) so its shaders link now, not when the camera first arrives. */
let lastWarm = 0, warming = false;
function warmDraw(child){
  const saved = [];
  child.traverse(o => { saved.push([o, o.frustumCulled]); o.frustumCulled = false; });
  warming = true;
  hall.update({spin:0, time:0, dt:0.016, reflect:!lite});
  renderer.setViewport(0, 0, 8, 8);
  renderer.render(scene, camera);
  renderer.setViewport(0, 0, innerWidth, innerHeight);
  warming = false;
  saved.forEach(([o, f]) => { o.frustumCulled = f; });
}
function warmFirst(){
  const smp = journey.sample(0);
  place(smp, 0); applyLook(smp, 0); perpetua.update(state.theta);
  renderer.shadowMap.needsUpdate = true;
  renderer.render(scene, camera);
  renderer.getContext().finish();
  if (mode !== 'gl') { hall.startLoading(); while (hall.pending()) warmDraw(hall.revealNext()); }
}
/* The first drawing of each piece costs 100 to 2300 ms on ANGLE/D3D11 even after compileAsync
   (the mirror alone is a second full render with its own program variants). So the whole gallery
   is drawn once behind the veil, one piece per task so the browser stays responsive, and the visitor
   never meets those stalls while scrolling. A cap keeps a very slow machine from waiting forever: the
   rest then falls back to the staged reveal in frame(). */
async function warmHall(){
  const t0 = performance.now(), nap = () => new Promise(r => setTimeout(r, 0));
  while (hall.pending() && performance.now() - t0 < 14000) { warmDraw(hall.revealNext()); await nap(); }
  if (hall.plainFloor) { hall.plainFloor.visible = true; warmDraw(hall.plainFloor); hall.plainFloor.visible = false; }
  await Promise.race([hall.prewarmVideos(), new Promise(r => setTimeout(r, 7000))]);
  hall.startLoading();      // images are fetched after the blocking draws, so their staggered timers do not fire in one burst
}
const bootTimes = {};
async function boot(){
  bootTimes.start = performance.now();
  // Compile every shader before the first frame, behind the loading veil: no hitch later.
  if (renderer) { try { place(journey.sample(0), 0); applyLook(journey.sample(0), 0); await Promise.race([renderer.compileAsync(scene, camera), new Promise(r => setTimeout(r, 6000))]); bootTimes.compiled = performance.now(); warmFirst(); bootTimes.warmFirst = performance.now(); if (mode === 'gl') { await warmHall(); bootTimes.warmHall = performance.now(); } buildRungs(); } catch (e) { console.warn('compile', e); } }
  if (mode === 'gl') {
    if (lenis) lenis.start();
    gsap.ticker.add(frame);
    restore();
  } else {
    $('#stills').hidden = false;
    $('#prevStop').addEventListener('click', () => stepBy(-1));
    $('#nextStop').addEventListener('click', () => stepBy(1));
    $('#stepback').addEventListener('click', () => stepBy(1));
    if (mode === 'nogl') { $('#veil').classList.add('done', 'fail'); $('#gl').hidden = true; $('#veil').classList.remove('done'); setTimeout(() => $('#veil').classList.add('done'), 1800); }
    gsap.ticker.add(stillsFrame);
    restore();
    showStill(stillIdx);
    if (mode === 'stills') document.fonts?.ready?.then(() => { stillSettle = 2; });
  }
  window.__universe = {cpu:() => +cpuEma.toFixed(2), bootTimes, quality:() => ({rung:quality.rung, log:quality.log, mirror:hall.hasMirror() ? hall.mirrorIsOn() : null, pixelRatio:renderer.getPixelRatio(), teeth:hall.rack.count()}), key, rim, hemi, camLight, perpetua, camera, scene, proxy, journey, stops, state, get lenis(){ return lenis; }, goT, goStopIndex, stepBy, renderer,
    stats:() => ({calls:renderer.info.render.calls, tris:renderer.info.render.triangles, geos:renderer.info.memory.geometries, tex:renderer.info.memory.textures, dpr:renderer.getPixelRatio()}),
    perpTris:() => perpetua.stats, hall, mode};
  const s0 = parseFloat(params.get('s'));
  if (!isNaN(s0) && mode === 'gl') goT(s0, true);
}
boot();
document.fonts?.ready?.then(() => { if (!renderer) $('#veil').classList.add('done'); });
