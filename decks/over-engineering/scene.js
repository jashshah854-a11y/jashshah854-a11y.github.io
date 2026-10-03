import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import * as M from './model.js';

const TAU = Math.PI * 2;
const BRASS = 0xc9a35b;
const CREAM = 0xf1e6cc;
const GEAR_T = 0.2;
const DSTEP = 0.36;
let curN = 2;
// Every level holds one meshing pair; the stack steps down from the hand and grows upward as parts are added.
const lvl = (depth) => 0.5 + (curN - 1 - depth) * DSTEP;
const smooth = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
const damp = (dt, rate) => 1 - Math.exp(-dt * rate);

const geomCache = new Map();
function gearGeometry(z) {
  if (geomCache.has(z)) return geomCache.get(z);
  const m = M.MODULE, r = M.rad(z), p = TAU / z;
  const rRoot = r - 1.25 * m, rTip = r + m;
  const shape = new THREE.Shape();
  for (let k = 0; k < z; k++) {
    const a = k * p;
    const pts = [[a - 0.30 * p, rRoot], [a - 0.12 * p, rTip], [a + 0.12 * p, rTip], [a + 0.30 * p, rRoot]];
    pts.forEach(([ang, rr], i) => {
      const x = Math.cos(ang) * rr, y = Math.sin(ang) * rr;
      if (k === 0 && i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
    });
  }
  shape.closePath();
  const hub = new THREE.Path();
  hub.absarc(0, 0, 0.13, 0, TAU, true);
  shape.holes.push(hub);
  const hubR = 0.42, rimR = rRoot - 0.2;
  if (rimR - hubR > 0.7) {
    const cr = (rimR - hubR) / 2 - 0.09, mid = (rimR + hubR) / 2;
    for (let i = 0; i < 5; i++) {
      const w = new THREE.Path();
      w.absarc(Math.cos((i / 5) * TAU) * mid, Math.sin((i / 5) * TAU) * mid, cr, 0, TAU, true);
      shape.holes.push(w);
    }
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth: GEAR_T, bevelEnabled: false, curveSegments: 8 });
  geomCache.set(z, g);
  return g;
}

function velvetTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const x = c.getContext('2d');
  x.fillStyle = '#080808';
  x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    const a = Math.random() * 0.05;
    x.strokeStyle = `rgba(255,248,230,${a})`;
    x.lineWidth = 1;
    const px = Math.random() * 512, py = Math.random() * 512, ang = Math.random() * TAU, l = 2 + Math.random() * 5;
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(ang) * l, py + Math.sin(ang) * l); x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(7, 7);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function perlageTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const x = c.getContext('2d');
  x.fillStyle = '#2b2a28';
  x.fillRect(0, 0, 512, 512);
  for (let gy = 0; gy < 32; gy++) {
    for (let gx = 0; gx < 32; gx++) {
      const bx = gx * 16 + (gy % 2) * 8, by = gy * 16;
      for (const ox of [-512, 0, 512]) {
        for (const oy of [-512, 0, 512]) {
          const cx = bx + ox, cy = by + oy;
          if (cx < -12 || cx > 524 || cy < -12 || cy > 524) continue;
          const g = x.createRadialGradient(cx, cy, 1, cx, cy, 9);
          g.addColorStop(0, 'rgba(120,114,104,0.38)');
          g.addColorStop(1, 'rgba(20,19,18,0)');
          x.fillStyle = g;
          x.beginPath(); x.arc(cx, cy, 9, 0, TAU); x.fill();
        }
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 3);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function handGeometry() {
  const s = new THREE.Shape();
  s.moveTo(-0.9, -0.05); s.lineTo(0, -0.15); s.lineTo(3.9, -0.035); s.lineTo(4.15, 0);
  s.lineTo(3.9, 0.035); s.lineTo(0, 0.15); s.lineTo(-0.9, 0.05); s.closePath();
  const hub = new THREE.Path(); hub.absarc(0, 0, 0.05, 0, TAU, true); s.holes.push(hub);
  return new THREE.ExtrudeGeometry(s, { depth: 0.07, bevelEnabled: false });
}

export function createRig({ canvas, reduced }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setClearColor(0x060606, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.42;

  const camera = new THREE.PerspectiveCamera(28, 1, 0.5, 400);

  // ---- lights
  const key = new THREE.DirectionalLight(0xffe6bd, 2.6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -17; key.shadow.camera.right = 17; key.shadow.camera.top = 17; key.shadow.camera.bottom = -17;
  key.shadow.camera.near = 1; key.shadow.camera.far = 80;
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xc9a35b, 0.9);
  scene.add(rim, rim.target);
  const sun = new THREE.DirectionalLight(0xfff0cf, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -9; sun.shadow.camera.right = 9; sun.shadow.camera.top = 9; sun.shadow.camera.bottom = -9;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 60;
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);

  // ---- velvet
  const velvet = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 220),
    new THREE.MeshStandardMaterial({ color: 0x0b0b0b, map: velvetTexture(), roughness: 1, metalness: 0, envMapIntensity: 0.1 })
  );
  velvet.rotation.x = -Math.PI / 2;
  velvet.position.y = -0.42;
  velvet.receiveShadow = true;
  scene.add(velvet);

  const mats = [
    new THREE.MeshStandardMaterial({ color: BRASS, metalness: 1, roughness: 0.32 }),
    new THREE.MeshStandardMaterial({ color: 0xa9a59c, metalness: 1, roughness: 0.38 }),
    new THREE.MeshStandardMaterial({ color: 0xdcbf80, metalness: 1, roughness: 0.28 }),
  ];
  const postMat = new THREE.MeshStandardMaterial({ color: 0x77736a, metalness: 1, roughness: 0.35 });
  const handMat = new THREE.MeshStandardMaterial({ color: 0xe9ddc0, metalness: 0.5, roughness: 0.34 });
  const creamMat = new THREE.MeshStandardMaterial({ color: CREAM, metalness: 0.35, roughness: 0.45 });
  const darkSteel = new THREE.MeshStandardMaterial({ color: 0x57554f, metalness: 0.9, roughness: 0.75 });

  // =================================================================== MOVEMENT
  const movement = new THREE.Group();
  scene.add(movement);

  const plateMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: perlageTexture(), metalness: 0.85, roughness: 0.5 });
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.4, 96), plateMat);
  plate.position.y = -0.2;
  plate.receiveShadow = true;
  const bezel = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.34, 96), new THREE.MeshStandardMaterial({ color: 0x8c6d33, metalness: 1, roughness: 0.4 }));
  bezel.position.y = -0.27;
  bezel.receiveShadow = true;
  movement.add(bezel, plate);

  // minute track fixed to the plate, true-time pip outside it
  const ticks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.035, 0.02, 1), new THREE.MeshStandardMaterial({ color: 0x9d8a5a, metalness: 0.8, roughness: 0.5 }), 60);
  const tm = new THREE.Object3D();
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * TAU, long = i % 5 === 0;
    tm.position.set(Math.sin(a) * (long ? 4.5 : 4.52), 0.03, -Math.cos(a) * (long ? 4.5 : 4.52));
    tm.rotation.set(0, -a, 0);
    tm.scale.set(long ? 1.8 : 1, 1, long ? 0.42 : 0.24);
    tm.updateMatrix();
    ticks.setMatrixAt(i, tm.matrix);
  }
  ticks.receiveShadow = true;
  movement.add(ticks);

  const pipGroup = new THREE.Group();
  {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.03, 0.055), mats[0]);
    arm.position.set(2.05, 0, 0);
    arm.castShadow = true;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.34, 4), mats[0]);
    tip.rotation.z = -Math.PI / 2;
    tip.position.set(4.72, 0, 0);
    tip.castShadow = true;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.08, 20), mats[0]);
    hub.castShadow = true;
    pipGroup.add(arm, tip, hub);
  }
  movement.add(pipGroup);
  const handPost = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1, 12), postMat);
  handPost.castShadow = true;
  movement.add(handPost);

  const ringHi = new THREE.Mesh(new THREE.RingGeometry(1, 1.07, 72), new THREE.MeshBasicMaterial({ color: CREAM, transparent: true, opacity: 0.95, side: THREE.DoubleSide, toneMapped: false }));
  ringHi.rotation.x = -Math.PI / 2;
  ringHi.visible = false;
  movement.add(ringHi);

  const crown = new THREE.Group();
  {
    const s = new THREE.Shape();
    const z = 18, p = TAU / z;
    for (let k = 0; k < z; k++) {
      const a = k * p;
      [[a - 0.3 * p, 0.62], [a - 0.15 * p, 0.74], [a + 0.15 * p, 0.74], [a + 0.3 * p, 0.62]].forEach(([ang, r], i) => {
        const x = Math.cos(ang) * r, y = Math.sin(ang) * r;
        if (k === 0 && i === 0) s.moveTo(x, y); else s.lineTo(x, y);
      });
    }
    s.closePath();
    const cm = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.26, bevelEnabled: false }), mats[2]);
    cm.castShadow = true;
    cm.rotation.x = -Math.PI / 2;
    crown.add(cm);
  }
  movement.add(crown);

  const handHolder = new THREE.Group();
  handHolder.rotation.x = -Math.PI / 2;
  const handSpin = new THREE.Group();
  const handMesh = new THREE.Mesh(handGeometry(), handMat);
  handMesh.castShadow = true;
  const handHub = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.16, 24), mats[0]);
  handHub.rotation.x = Math.PI / 2;
  handHub.position.z = 0.04;
  handHub.castShadow = true;
  handSpin.add(handMesh, handHub);
  handHolder.add(handSpin);
  movement.add(handHolder);

  let stages = [];
  let nextExtra = 12;
  const stageMap = () => stages.filter((s) => s.state !== 'out');
  const active = stageMap;

  function makeStage(id) {
    const [zA, zB] = M.teethFor(id);
    const g = new THREE.Group();
    const st = { id, group: g, zA, zB, pos: { x: 0, y: 0 }, target: { x: 0, y: 0 }, state: 'on', lift: 0, t: 0, scale: 1, yA: 0, yB: 0, th: 0 };
    const mk = (z) => {
      const holder = new THREE.Group();
      holder.rotation.x = -Math.PI / 2;
      const spin = new THREE.Group();
      const mesh = new THREE.Mesh(gearGeometry(z), mats[0]);
      mesh.castShadow = true; mesh.receiveShadow = true;
      spin.add(mesh); holder.add(spin); g.add(holder);
      return { holder, spin, mesh };
    };
    const B = mk(zB);
    st.holderB = B.holder; st.spinB = B.spin; st.meshB = B.mesh;
    if (zA) {
      const A = mk(zA);
      st.holderA = A.holder; st.spinA = A.spin; st.meshA = A.mesh;
    }
    const arbor = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1, 12), postMat);
    arbor.castShadow = true;
    g.add(arbor);
    st.arbor = arbor;
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.1, 20), mats[0]);
    seat.position.y = 0.05;
    seat.castShadow = true; seat.receiveShadow = true;
    g.add(seat);
    movement.add(g);
    return st;
  }

  function freeId() {
    const used = new Set(stages.filter((s) => s.state !== 'out').map((s) => s.id));
    for (let i = 0; i < 12; i++) if (!used.has(i)) return i;
    return nextExtra++;
  }

  let camTarget = { x: 0, z: 0, dist: 20 };
  let plateTarget = { x: 0, y: 0, r: 5 };
  const plateCur = { x: 0, y: 0, r: 5 };

  function relayout() {
    const act = active();
    const ids = act.map((s) => s.id);
    const pos = M.layout(ids);
    curN = act.length;
    act.forEach((s, i) => {
      s.target.x = pos[i].x; s.target.y = pos[i].y;
      s.depthA = i - 1; s.depthB = i;
      s.index = i;
      if (s.meshA) s.meshA.material = mats[((s.depthA % 3) + 3) % 3];
      s.meshB.material = mats[s.depthB % 3];
    });
    const b0 = M.bounds(pos, ids);
    const minx = Math.min(b0.cx - b0.w / 2, -5.3), maxx = Math.max(b0.cx + b0.w / 2, 5.3);
    const miny = Math.min(b0.cy - b0.h / 2, -5.3), maxy = Math.max(b0.cy + b0.h / 2, 5.3);
    const c = { x: (minx + maxx) / 2, y: (miny + maxy) / 2 };
    let r = Math.hypot(c.x, c.y) + 6.2;
    act.forEach((s, i) => {
      const rr = Math.max(M.rad(s.zB), s.zA ? M.rad(s.zA) : 0) + 1.0;
      r = Math.max(r, Math.hypot(pos[i].x - c.x, pos[i].y - c.y) + rr);
    });
    plateTarget = { x: c.x, y: c.y, r };
    viewBounds.movement = { cx: c.x, cy: c.y, w: 2 * r + 1.2, h: 2 * r + 1.2 };
    // crown rides on the last stage (the driver)
    const last = act[act.length - 1];
    crownStage = last;
    notify();
  }
  let crownStage = null;

  function addStage(instant, fresh) {
    const id = fresh ? nextExtra++ : freeId();
    const st = makeStage(id);
    stages.push(st);
    st.state = instant || reduced ? 'on' : 'in';
    st.lift = instant || reduced ? 0 : 6;
    relayout();
    st.pos.x = st.target.x; st.pos.y = st.target.y;
    st.yA = lvl(st.depthA); st.yB = lvl(st.depthB);
    return st;
  }

  function disposeStage(st) {
    movement.remove(st.group);
    stages = stages.filter((s) => s !== st);
  }

  function chuck(st, instant) {
    if (!st || st.id === 0 || st.state === 'out') return;
    st.state = 'out';
    st.t = 0;
    if (instant || reduced) disposeStage(st);
    relayout();
  }

  // ---- ops queue
  const queue = [];
  let qT = 0;
  const GAP = 0.13;
  function run(op) {
    if (op.t === 'add') addStage(false);
    else if (op.t === 'chuckLast') { const a = active(); if (a.length > 2) chuck(a[a.length - 1]); }
    else if (op.t === 'chuckId') chuck(active().find((s) => s.id === op.id));
    else if (op.t === 'swap') {
      chuck(active().find((s) => s.id === op.id));
      addStage(false, true);
    }
  }

  // ---- energy, time
  let E = 1, runTime = 0, handBase = 0, trueBase = 0, tickAcc = 0, windAnim = 0, windSpin = 0;
  let lastState = null;
  const listeners = new Set();
  function snapshot() {
    const act = active();
    const ids = act.map((s) => s.id);
    return {
      n: act.length,
      ids,
      play: M.handPlay(ids) * 180 / Math.PI,
      behind: M.lossRate(ids) * 60,
      reserve: E,
      reserveSec: E / M.drainRate(act.length),
      running: E > 0,
      keeps: M.lossRate(ids) <= M.TOLERANCE,
      pawl: ratchet.pawlUp,
    };
  }
  let notifyDirty = true;
  function notify() { notifyDirty = true; }

  // ---- smell objects (slide 7)
  const smells = {};
  let smellsOn = false;
  function buildSmells() {
    const mk = (z, mat) => {
      const holder = new THREE.Group();
      holder.rotation.x = -Math.PI / 2;
      const spin = new THREE.Group();
      const mesh = new THREE.Mesh(gearGeometry(z), mat);
      mesh.castShadow = true; mesh.receiveShadow = true;
      spin.add(mesh); holder.add(spin);
      return { holder, spin, mesh };
    };
    const post = (h) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, h, 12), postMat); m.position.y = h / 2; m.castShadow = true; return m; };
    const stubMat = creamMat.clone(), spareMat = darkSteel.clone(), watchMat = creamMat.clone();
    // 1: one caller, a gear that only passes motion to a dead end
    const stub = new THREE.Group(); const sg = mk(18, stubMat); const stubPost = post(1); stub.add(sg.holder, stubPost);
    // 2: might need it later, a spare wheel on a post, meshed to nothing
    const spare = new THREE.Group(); const pg = mk(30, spareMat); const sparePost = post(1); spare.add(pg.holder, sparePost);
    // 3: a system watching a system, a small gear that only drives a needle
    const watch = new THREE.Group(); const wg = mk(16, watchMat); const watchPost = post(1); watch.add(wg.holder, watchPost);
    const dial = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.05, 40), watchMat);
    dial.position.y = 1.9; dial.castShadow = true; dial.receiveShadow = true;
    const needleHolder = new THREE.Group(); needleHolder.rotation.x = -Math.PI / 2; needleHolder.position.y = 1.97;
    const needleSpin = new THREE.Group();
    const needle = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.06, 0.03), mats[0]);
    needle.position.set(0.5, 0, 0.02); needle.castShadow = true;
    needleSpin.add(needle); needleHolder.add(needleSpin);
    watch.add(dial, needleHolder);
    for (const [k, o] of Object.entries({ stub, spare, watch })) { o.visible = false; smells[k] = { group: o, base: o === stub ? 3 : o === spare ? 5 : 6 }; }
    smells.stub.post = stubPost; smells.spare.post = sparePost; smells.watch.post = watchPost; smells.watch.dial = dial; smells.watch.needleHolder = needleHolder;
    smells.stub.g = sg; smells.stub.mat = stubMat; smells.stub.z = 18;
    smells.spare.g = pg; smells.spare.mat = spareMat; smells.spare.z = 30;
    smells.watch.g = wg; smells.watch.mat = watchMat; smells.watch.z = 16; smells.watch.needle = needleSpin;
  }
  buildSmells();

  function placeSmells() {
    const act = active();
    const gearsAll = [];
    act.forEach((s) => {
      gearsAll.push({ x: s.target.x, y: s.target.y, r: M.rad(s.zB) });
      if (s.zA) gearsAll.push({ x: s.target.x, y: s.target.y, r: M.rad(s.zA) });
    });
    const b = viewBounds.movement;
    for (const [key, sm] of Object.entries(smells)) {
      const host = act[sm.base];
      if (!host) { sm.group.visible = false; continue; }
      const rNew = M.rad(sm.z);
      const dist = M.rad(host.zB) + rNew + (key === 'spare' ? 0.75 : 0);
      let bestA = 0, bestS = -1e9;
      for (let a = 0; a < 360; a += 10) {
        const ar = (a * Math.PI) / 180;
        const x = host.target.x + Math.cos(ar) * dist, y = host.target.y + Math.sin(ar) * dist;
        let clear = 1e9;
        for (const g of gearsAll) {
          if (g.x === host.target.x && g.y === host.target.y) continue;
          clear = Math.min(clear, Math.hypot(x - g.x, y - g.y) - g.r - rNew);
        }
        for (const o of Object.values(smells)) {
          if (o === sm || !o.placed) continue;
          clear = Math.min(clear, Math.hypot(x - o.placed.x, y - o.placed.y) - rNew - M.rad(o.z) - 0.2);
        }
        const outward = Math.hypot(x - b.cx, y - b.cy);
        const score = Math.min(clear, 1.2) * 4 + outward * 0.1;
        if (score > bestS) { bestS = score; bestA = ar; }
      }
      sm.phi = bestA;
      sm.placed = { x: host.target.x + Math.cos(bestA) * dist, y: host.target.y + Math.sin(bestA) * dist };
      sm.hostStage = host;
      sm.local = { x: Math.cos(bestA) * dist, y: Math.sin(bestA) * dist };
      if (sm.group.parent !== host.group) host.group.add(sm.group);
      sm.group.position.set(sm.local.x, 0, -sm.local.y);
      sm.group.visible = smellsOn;
    }
    if (smellsOn) {
      let r = plateTarget.r;
      for (const sm of Object.values(smells)) {
        if (!sm.placed) continue;
        r = Math.max(r, Math.hypot(sm.placed.x - plateTarget.x, sm.placed.y - plateTarget.y) + M.rad(sm.z) + 1.2);
      }
      plateTarget = { x: plateTarget.x, y: plateTarget.y, r };
      viewBounds.movement = { cx: plateTarget.x, cy: plateTarget.y, w: 2 * r + 1.2, h: 2 * r + 1.2 };
    }
  }

  // =================================================================== RATCHET
  const ratchetGroup = new THREE.Group();
  scene.add(ratchetGroup);
  const RZ = 14, RP = TAU / RZ, R_ROOT = 2.0, R_TIP = 2.45, WHEEL = { x: -3.0, y: 0.0 };
  const ratchet = { pawlUp: false, off: 0, vel: 0, th: 0, pawlLift: 0, nShown: 0, discs: [], springH: 1 };
  {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(7.0, 7.0, 0.4, 96), plateMat);
    base.position.y = -0.2; base.receiveShadow = true;
    const bz = new THREE.Mesh(new THREE.CylinderGeometry(7.25, 7.25, 0.34, 96), bezel.material);
    bz.position.y = -0.27; bz.receiveShadow = true;
    ratchetGroup.add(bz, base);
    const s = new THREE.Shape();
    for (let k = 0; k < RZ; k++) {
      const a = k * RP;
      [[a, R_ROOT], [a + 0.85 * RP, R_TIP], [a + 0.88 * RP, R_ROOT]].forEach(([ang, r], i) => {
        const x = Math.cos(ang) * r, y = Math.sin(ang) * r;
        if (k === 0 && i === 0) s.moveTo(x, y); else s.lineTo(x, y);
      });
    }
    s.closePath();
    const hubh = new THREE.Path(); hubh.absarc(0, 0, 0.22, 0, TAU, true); s.holes.push(hubh);
    for (let i = 0; i < 5; i++) { const w = new THREE.Path(); w.absarc(Math.cos((i / 5) * TAU) * 1.2, Math.sin((i / 5) * TAU) * 1.2, 0.5, 0, TAU, true); s.holes.push(w); }
    const wheel = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: false }), mats[0]);
    wheel.castShadow = true; wheel.receiveShadow = true;
    ratchet.wheelHolder = new THREE.Group();
    ratchet.wheelHolder.rotation.x = -Math.PI / 2;
    ratchet.wheelHolder.position.set(WHEEL.x, 0.55, -WHEEL.y);
    ratchet.wheelSpin = new THREE.Group();
    ratchet.wheelSpin.add(wheel);
    ratchet.wheelHolder.add(ratchet.wheelSpin);
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.4, 16), postMat);
    axle.position.set(WHEEL.x, 0.7, -WHEEL.y); axle.castShadow = true;
    ratchetGroup.add(ratchet.wheelHolder, axle);
    // pawl: a bar from a fixed pivot to the rim
    ratchet.pivot = { x: WHEEL.x - 2.5, y: 3.8 };
    const pivotPost = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.2, 16), postMat);
    pivotPost.position.set(ratchet.pivot.x, 0.6, -ratchet.pivot.y); pivotPost.castShadow = true;
    // hooked pawl: a tapered lever whose end turns toward the wheel. u runs 0 to 1 along the lever
    // (stretched to the pivot-to-rim span each frame), v is the lateral offset in world units.
    const pawlPts = [[0, -0.27], [0.6, -0.19], [0.86, -0.17], [0.95, 0.08], [1, 0.5], [0.975, 0.5], [0.9, 0.2], [0.78, 0.17], [0.6, 0.19], [0, 0.27]];
    const pawlShape = new THREE.Shape();
    pawlPts.forEach(([u, v], i) => { if (i) pawlShape.lineTo(u - 0.5, v); else pawlShape.moveTo(u - 0.5, v); });
    pawlShape.closePath();
    const pawlGeo = new THREE.ExtrudeGeometry(pawlShape, { depth: 0.3, bevelEnabled: false });
    pawlGeo.rotateX(Math.PI / 2); pawlGeo.translate(0, 0.15, 0);
    ratchet.bar = new THREE.Mesh(pawlGeo, mats[2]);
    ratchet.bar.castShadow = true;
    const pivotCap = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.16, 24), mats[0]);
    pivotCap.position.set(ratchet.pivot.x, 1.22, -ratchet.pivot.y); pivotCap.castShadow = true;
    ratchetGroup.add(pivotPost, ratchet.bar, pivotCap);
    // load stack: spring and discs
    const sx = 3.6;
    ratchet.stackX = sx;
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.3, 48), mats[1]);
    pad.position.set(sx, 0.15, 0); pad.castShadow = true; pad.receiveShadow = true;
    ratchetGroup.add(pad);
    class Helix extends THREE.Curve {
      getPoint(t, target = new THREE.Vector3()) { const a = t * 7 * TAU; return target.set(Math.cos(a) * 0.95, t * 1, Math.sin(a) * 0.95); }
    }
    const spring = new THREE.Mesh(new THREE.TubeGeometry(new Helix(), 220, 0.085, 8, false), postMat);
    spring.castShadow = true;
    ratchet.spring = spring; spring.position.set(sx, 0.3, 0);
    ratchetGroup.add(spring);
    ratchet.discTop = 0.3;
  }
  ratchetGroup.visible = false;
  const SPRING_FREE = 3.2, DISC_H = 0.2, DISC_GAP = 0.03;
  function syncDiscs(n, instant) {
    const want = Math.max(0, n - 1);
    while (ratchet.discs.length < want) {
      const i = ratchet.discs.length;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, DISC_H, 40), mats[i % 3 === 1 ? 1 : i % 3 === 2 ? 2 : 0]);
      m.castShadow = true; m.receiveShadow = true;
      ratchet.discs.push({ mesh: m, drop: !(instant || reduced) });
      m.position.set(ratchet.stackX, 8, 0);
      ratchetGroup.add(m);
    }
    while (ratchet.discs.length > want) {
      const d = ratchet.discs.pop();
      if (instant || reduced) ratchetGroup.remove(d.mesh); else ratchet.gone = (ratchet.gone || []).concat(d);
    }
  }

  // =================================================================== SUNDIAL
  const sundial = new THREE.Group();
  scene.add(sundial);
  let sunTime = 0;
  {
    const brassEdge = new THREE.Mesh(new THREE.CylinderGeometry(6.6, 6.6, 0.42, 96), mats[0]);
    brassEdge.position.y = -0.04; brassEdge.receiveShadow = true; brassEdge.castShadow = true;
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(6.25, 6.25, 0.5, 96), new THREE.MeshStandardMaterial({ color: 0xcbbf9f, roughness: 0.9, metalness: 0 }));
    disc.position.y = 0.0; disc.receiveShadow = true; disc.castShadow = true;
    sundial.add(brassEdge, disc);
    const mk = new THREE.MeshStandardMaterial({ color: 0x8c6d33, metalness: 0.9, roughness: 0.4 });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, i % 3 === 0 ? 1.5 : 1.0), mk);
      m.position.set(Math.sin(a) * 5.2, 0.265, -Math.cos(a) * 5.2);
      m.rotation.y = -a;
      m.receiveShadow = true;
      sundial.add(m);
    }
    const s = new THREE.Shape();
    s.moveTo(-1.5, 0); s.lineTo(1.5, 0); s.lineTo(-1.5, 2.5); s.closePath();
    const gn = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.16, bevelEnabled: false }), mats[0]);
    gn.geometry.translate(0, 0, -0.08);
    gn.rotation.y = Math.PI / 2; // fin stands along north-south
    gn.position.y = 0.25;
    gn.castShadow = true;
    sundial.add(gn);
  }
  sundial.visible = false;

  // =================================================================== VIEWS
  const viewBounds = {
    movement: { cx: 0, cy: 0, w: 9, h: 6 },
    ratchet: { cx: -0.3, cy: -0.5, w: 12.2, h: 7.6 },
    sundial: { cx: 0, cy: 0, w: 14, h: 12 },
  };
  let view = null;
  const vf = { movement: 0, ratchet: 0, sundial: 0 };
  const groups = { movement, ratchet: ratchetGroup, sundial };
  const camState = { x: 0, z: 0, dist: 22, init: false };
  const EL = (55 * Math.PI) / 180;
  let aspect = 1;

  function fitDist(b) {
    const vh = (camera.fov / 2) * Math.PI / 180;
    const hh = Math.atan(Math.tan(vh) * aspect);
    return Math.max(((b.h / 2) * Math.sin(EL) + 1.3) / Math.tan(vh), (b.w / 2 + 1.0) / Math.tan(hh)) * 1.1;
  }

  // ---- public control
  const api = {
    setView(v) { view = v; if (reduced) for (const k of Object.keys(vf)) vf[k] = k === v ? 1 : 0; },
    setActive(a) { api.running = a; },
    running: false,
    state: snapshot,
    onState(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    add() { if (active().length >= 12 + 4) return; queue.push({ t: 'add' }); },
    chuckLast() { queue.push({ t: 'chuckLast' }); },
    chuckId(id) { queue.push({ t: 'chuckId', id }); },
    swap(id) { queue.push({ t: 'swap', id }); },
    setCount(n) {
      n = Math.max(2, Math.min(12, n));
      let cur = active().length + queue.filter((q) => q.t === 'add').length - queue.filter((q) => q.t === 'chuckLast').length;
      while (cur < n) { queue.push({ t: 'add' }); cur++; }
      while (cur > n) { queue.push({ t: 'chuckLast' }); cur--; }
    },
    pending() { return queue.length; },
    clearQueue() { queue.length = 0; },
    reset(n, instant = true) {
      queue.length = 0;
      [...stages].forEach((s) => disposeStage(s));
      for (let i = 0; i < n; i++) addStage(instant);
      ratchet.th = ratchetTarget();
      syncDiscs(n, true);
      placeSmells();
    },
    isCanonical(n) { const a = active(); return a.length === n && a.every((s, i) => s.id === i) && !queue.length; },
    wind() { E = 1; windAnim = 1; windSpin = 0; notify(); },
    drain() { E = 0; notify(); },
    setSmells(on) { smellsOn = on; for (const sm of Object.values(smells)) sm.group.visible = on && !!sm.hostStage; if (on) { relayout(); placeSmells(); } else relayout(); },
    highlightStage(id) { api._hiStage = id; api._hiSmell = null; },
    highlightSmell(key) { api._hiSmell = key; api._hiStage = null; },
    setPawl(up) { ratchet.pawlUp = up; notify(); },
    tryChuck() {
      if (active().length <= 2) return 'min';
      if (!ratchet.pawlUp) { ratchet.vel = 2.4; return 'blocked'; }
      ratchet.pawlUp = false;
      queue.push({ t: 'chuckLast' });
      return 'ok';
    },
    resize(w, h, scale) {
      const dpr = Math.min(1.5, window.devicePixelRatio || 1) * (scale || 1);
      renderer.setPixelRatio(Math.min(2.5, dpr));
      renderer.setSize(w, h, false);
      aspect = w / Math.max(1, h);
      camera.aspect = aspect; camera.updateProjectionMatrix();
    },
    stepTo(dt) { step(dt); renderer.render(scene, camera); },
    debugHand() { const a = active(); const ids = a.map((x) => x.id); return { err: M.errors(ids, runTime)[0], n: a.length, runTime }; },
    info() { return { dist: camState.dist, aspect, cw: canvas.width, ch: canvas.height, frames, rendered, view, plate: plateCur.r, vb: viewBounds.movement }; },
    dispose() { renderer.dispose(); },
    get canvas() { return canvas; },
  };

  function ratchetTarget() { return Math.PI / 2 - 0.94 * RP - Math.max(0, active().length - 2) * RP; }

  function profileR(th) {
    // radius of the rim under the pawl at angle 90 degrees, for wheel angle th
    const t = ((((Math.PI / 2 - th) / RP) % 1) + 1) % 1;
    if (t < 0.85) return R_ROOT + (R_TIP - R_ROOT) * (t / 0.85);
    if (t < 0.88) return R_TIP + (R_ROOT - R_TIP) * ((t - 0.85) / 0.03);
    return R_ROOT;
  }

  let lastN = -1;
  function step(dt) {
    dt = Math.min(dt, 0.05);
    // views
    for (const k of Object.keys(vf)) {
      const tgt = k === view ? 1 : 0;
      vf[k] += (tgt - vf[k]) * (reduced ? 1 : damp(dt, tgt ? 5 : 9));
      if (Math.abs(vf[k] - tgt) < 0.004) vf[k] = tgt;
      const g = groups[k];
      g.visible = vf[k] > 0.01;
      g.scale.setScalar(Math.max(vf[k], 0.001));
    }
    key.intensity = 2.6 * (1 - vf.sundial);
    rim.intensity = 0.9 * (1 - vf.sundial);
    sun.intensity = 3.4 * vf.sundial;
    scene.environmentIntensity = 0.42 - 0.3 * vf.sundial;

    // queue
    qT -= dt;
    if (qT <= 0 && queue.length && view !== 'sundial') {
      run(queue.shift());
      qT = reduced ? 0 : GAP;
    }
    if (reduced && queue.length) { while (queue.length) run(queue.shift()); }

    const act = active();
    const n = act.length;
    if (n !== lastN) { lastN = n; syncDiscs(n); notify(); }

    if (view === 'movement' || vf.movement > 0.01) {
      let sdt = dt;
      if (reduced) { tickAcc += dt; if (tickAcc >= 1) { sdt = 1; tickAcc -= 1; } else sdt = 0; }
      const mul = E > 0 ? smooth(E / 0.1) : 0;
      if (E > 0) { E = Math.max(0, E - M.drainRate(n) * dt); notify(); }
      const ids = act.map((s) => s.id);
      const lam = M.lossRate(ids);
      runTime += sdt * mul;
      handBase += M.HAND_SPEED * (1 - lam) * sdt * mul;
      trueBase += M.HAND_SPEED * sdt * mul;

      // stage positions, heights, drop and lift animations
      const kp = reduced ? 1 : damp(dt, 5.5);
      for (const s of stages) {
        s.pos.x += (s.target.x - s.pos.x) * kp;
        s.pos.y += (s.target.y - s.pos.y) * kp;
        if (s.state === 'in') {
          s.lift += (0 - s.lift) * (reduced ? 1 : damp(dt, 7));
          if (s.lift < 0.015) { s.lift = 0; s.state = 'on'; }
        } else if (s.state === 'out') {
          s.t += dt;
          s.lift += (7 - s.lift) * damp(dt, 3.2);
          s.scale = Math.max(0.02, 1 - smooth(s.t / 0.8));
          if (s.t > 0.85) { disposeStage(s); continue; }
        }
        if (s.depthB !== undefined) {
          s.yB += (lvl(s.depthB) - s.yB) * kp;
          s.yA += (lvl(s.depthA) - s.yA) * kp;
          s.holderB.position.y = s.yB;
          if (s.holderA) s.holderA.position.y = s.yA;
          const top = (s.holderA ? s.yA : s.yB) + 0.34;
          s.arbor.scale.y = top; s.arbor.position.y = top / 2;
        }
        s.group.position.set(s.pos.x, s.lift, -s.pos.y);
        s.group.scale.setScalar(s.scale);
      }

      const live = active();
      const ids2 = live.map((s) => s.id);
      const pos = live.map((s) => s.pos);
      const ideal = M.idealAngles(ids2, pos, -handBase);
      const err = M.errors(ids2, runTime);
      live.forEach((s, i) => {
        const th = ideal[i] + err[i];
        s.th = th;
        s.spinB.rotation.z = th;
        if (s.spinA) s.spinA.rotation.z = th;
      });
      handSpin.rotation.z = live[0] ? live[0].th : 0;
      pipGroup.rotation.y = -trueBase;
      if (live[0]) {
        const y0 = live[0].yB;
        handHolder.position.y = y0 + 0.34;
        pipGroup.position.y = y0 + 0.62;
        handPost.scale.y = y0 + 0.75; handPost.position.y = (y0 + 0.75) / 2;
      }

      // crown on driver
      if (crownStage) {
        const cs = crownStage;
        crown.visible = cs.state !== 'out';
        crown.position.set(cs.pos.x, cs.lift + (cs.holderA ? cs.yA : cs.yB) + 0.22, -cs.pos.y);
        crown.scale.setScalar(cs.scale);
        if (windAnim > 0) { windAnim = Math.max(0, windAnim - dt / 0.9); windSpin = smooth(1 - windAnim) * TAU * 3; }
        crown.rotation.y = windSpin;
      }

      // smell objects follow their host
      if (smellsOn) {
        for (const sm of Object.values(smells)) {
          if (!sm.hostStage || sm.hostStage.state === 'out') continue;
          const host = sm.hostStage;
          if (sm.hostStage.group !== sm.group.parent) continue;
          const phi = Math.atan2(sm.local.y, sm.local.x);
          const hy = host.yB;
          sm.g.holder.position.y = hy;
          const pt = hy + (sm === smells.watch ? 1.5 : 0.3);
          sm.post.scale.y = pt; sm.post.position.y = pt / 2;
          if (sm.dial) { sm.dial.position.y = hy + 1.3; sm.needleHolder.position.y = hy + 1.37; }
          if (sm === smells.spare) { sm.g.spin.rotation.z = 0; continue; }
          const b = (M.PLAY_FRAC * TAU) / sm.z * M.playU(7, runTime);
          const th = M.meshForward(host.zB, host.th, phi, sm.z) + b;
          sm.g.spin.rotation.z = th;
          if (sm.needle) sm.needle.rotation.z = th;
        }
        const hi = api._hiSmell;
        for (const [k, sm] of Object.entries(smells)) {
          const on = hi === k;
          sm.mat.emissive = sm.mat.emissive || new THREE.Color(0);
          sm.mat.emissive.setHex(on ? 0x7a5a1c : 0x000000);
          sm.mat.emissiveIntensity = on ? 0.9 : 0;
        }
      }

      // highlight ring
      let ringOn = false;
      if (api._hiStage != null) {
        const s = live.find((x) => x.id === api._hiStage);
        if (s) { ringOn = true; const r = M.rad(s.zB) + 0.18; ringHi.scale.set(r, r, 1); ringHi.position.set(s.pos.x, s.lift + s.yB + 0.3, -s.pos.y); }
      } else if (api._hiSmell && smellsOn) {
        const sm = smells[api._hiSmell];
        if (sm && sm.hostStage && sm.hostStage.group === sm.group.parent) {
          ringOn = true; const r = M.rad(sm.z) + 0.2; ringHi.scale.set(r, r, 1);
          ringHi.position.set(sm.hostStage.pos.x + sm.local.x, sm.hostStage.yB + (api._hiSmell === 'watch' ? 1.6 : 0.3), -(sm.hostStage.pos.y + sm.local.y));
        }
      }
      ringHi.visible = ringOn;

      // plate follows the layout
      const kk = reduced ? 1 : damp(dt, 4);
      plateCur.x += (plateTarget.x - plateCur.x) * kk;
      plateCur.y += (plateTarget.y - plateCur.y) * kk;
      plateCur.r += (plateTarget.r - plateCur.r) * kk;
      plate.scale.set(plateCur.r, 1, plateCur.r);
      bezel.scale.set(plateCur.r + 0.28, 1, plateCur.r + 0.28);
      plate.position.set(plateCur.x, -0.2, -plateCur.y);
      bezel.position.set(plateCur.x, -0.27, -plateCur.y);
    }

    if (view === 'ratchet' || vf.ratchet > 0.01) {
      const target = ratchetTarget();
      ratchet.th += (target - ratchet.th) * (reduced ? 1 : damp(dt, 9));
      // blocked attempt: spring bounce
      ratchet.off += ratchet.vel * dt;
      ratchet.vel -= (ratchet.off * 220 + ratchet.vel * 14) * dt;
      ratchet.off = Math.min(Math.max(ratchet.off, 0), 0.16 * RP);
      const th = ratchet.th + ratchet.off;
      ratchet.wheelSpin.rotation.z = th;
      ratchet.pawlLift += ((ratchet.pawlUp ? 1 : 0) - ratchet.pawlLift) * (reduced ? 1 : damp(dt, 12));
      const rr = profileR(th) + ratchet.pawlLift * 1.1;
      // the beak touches the rim at tip; the lever ends one beak-length out along its left normal
      const tip = { x: WHEEL.x, y: WHEEL.y + rr };
      const l0 = Math.hypot(tip.x - ratchet.pivot.x, tip.y - ratchet.pivot.y);
      const ux = (tip.x - ratchet.pivot.x) / l0, uy = (tip.y - ratchet.pivot.y) / l0;
      const ex = tip.x - uy * 0.5, ey = tip.y + ux * 0.5;
      const dx = ex - ratchet.pivot.x, dy = ey - ratchet.pivot.y;
      ratchet.bar.scale.set(Math.hypot(dx, dy), 1, 1);
      ratchet.bar.position.set((ex + ratchet.pivot.x) / 2, 0.7, -(ey + ratchet.pivot.y) / 2);
      ratchet.bar.rotation.set(0, Math.atan2(dy, dx), 0);
      // load stack
      const sh = SPRING_FREE / (1 + 0.075 * Math.max(0, n - 2));
      ratchet.springH += (sh - ratchet.springH) * (reduced ? 1 : damp(dt, 6));
      ratchet.spring.scale.y = ratchet.springH;
      let top = 0.3 + ratchet.springH;
      ratchet.discs.forEach((d, i) => {
        const ty = top + DISC_H / 2 + i * (DISC_H + DISC_GAP);
        if (d.cur === undefined) d.cur = ty + (d.drop ? 7 : 0);
        d.cur += (ty - d.cur) * (reduced ? 1 : damp(dt, 8));
        d.mesh.position.y = d.cur;
      });
      if (ratchet.gone) {
        ratchet.gone.forEach((d) => { d.cur = (d.cur ?? 0) + dt * 14; d.mesh.position.y = d.cur; });
        ratchet.gone = ratchet.gone.filter((d) => { if (d.cur > 9) { ratchetGroup.remove(d.mesh); return false; } return true; });
      }
    }

    if (view === 'sundial' || vf.sundial > 0.01) {
      let sdt = dt;
      if (reduced) { tickAcc += dt; if (tickAcc >= 1) { sdt = 1; tickAcc -= 1; } else sdt = 0; }
      sunTime += sdt;
      const az = 0.35 + sunTime * 0.1;
      const el = (36 * Math.PI) / 180;
      sun.position.set(Math.sin(az) * Math.cos(el) * 26, Math.sin(el) * 26, -Math.cos(az) * Math.cos(el) * 26);
      sun.target.position.set(0, 0, 0);
    }

    // key light follows the framed object
    const vb = viewBounds[view || 'movement'];
    const cx = view === 'movement' || !view ? plateCur.x : 0;
    const cz = view === 'movement' || !view ? -plateCur.y : 0;
    key.position.set(cx - 10, 24, cz + 12);
    key.target.position.set(cx, 0, cz);
    rim.position.set(cx + 14, 8, cz - 6);
    rim.target.position.set(cx, 0, cz);
    key.shadow.camera.left = -Math.max(14, plateCur.r + 4); key.shadow.camera.right = Math.max(14, plateCur.r + 4);
    key.shadow.camera.top = Math.max(14, plateCur.r + 4); key.shadow.camera.bottom = -Math.max(14, plateCur.r + 4);
    key.shadow.camera.updateProjectionMatrix();

    // camera
    const b = vb;
    const tx = view === 'movement' || !view ? b.cx : 0;
    const tz = view === 'movement' || !view ? -b.cy : view === 'ratchet' ? -b.cy : 0;
    const td = fitDist(b);
    const kc = reduced || !camState.init ? 1 : damp(dt, 3.2);
    camState.x += (tx - camState.x) * kc;
    camState.z += (tz - camState.z) * kc;
    camState.dist += (td - camState.dist) * kc;
    camState.init = true;
    camera.position.set(camState.x, Math.sin(EL) * camState.dist, camState.z + Math.cos(EL) * camState.dist);
    camera.lookAt(camState.x, 0, camState.z);

    if (notifyDirty) {
      notifyDirty = false;
      const sn = snapshot();
      listeners.forEach((fn) => fn(sn));
    }
    // reserve bar changes continuously while running
    if (E > 0 || windAnim > 0) { const sn = snapshot(); listeners.forEach((fn) => fn(sn)); }
  }

  // ---- loop
  let last = performance.now();
  let frames = 0, rendered = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    frames++;
    const dt = (now - last) / 1000;
    last = now;
    if (!api.running || document.visibilityState !== 'visible') return;
    rendered++;
    step(dt);
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);

  // initial state
  for (let i = 0; i < 2; i++) addStage(true);
  ratchet.th = ratchetTarget();
  syncDiscs(2, true);
  api.reduced = reduced;
  // build every shader program now, while the title slide is showing, so the first slide change does not stall
  for (const g of Object.values(groups)) g.visible = true;
  renderer.compile(scene, camera);
  for (const g of Object.values(groups)) g.visible = false;
  return api;
}
