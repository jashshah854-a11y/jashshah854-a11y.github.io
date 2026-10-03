/* The right question: deck logic and the sieve bench.
   One law: the mesh size decides what a pour keeps. */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

const N = 10;
const stage = $('#stage');
const viz = $('#viz');
const slides = $$('.slide');
const counter = $('#counter');
const liveRegion = $('#live');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const phoneMQ = matchMedia('(max-width: 720px)');
let phone = phoneMQ.matches;
let stageScale = 1;

/* ------------------------------------------------------------------ */
/* Mesh sizes. Opening is the largest diameter that still falls through. */
const OPEN = { W: 0.32, A: 0.15, B: 0.09, C: 0.05 };
const WIDE = [OPEN.W, OPEN.W, OPEN.W];
const SHARP = [OPEN.A, OPEN.B, OPEN.C];

/* Beats per slide (index is zero-based). A beat is one mesh setting. */
const DEF = {
  1: { beats: [{ open: WIDE, q: 'How do we automate support?', m: 'wide', lost: true }] },
  2: { beats: [{ open: SHARP, az: 12, shot: 'top', q: 'Which team should get this message?', m: 'fine',
      flake: { t: 'Returns', s: 'These shoes are too small. Can I exchange them?' } }] },
  /* Slide 4: four optimizer winners lie on the top mesh. Tighten it and each keeps only its front half. */
  3: { beats: [
      { open: WIDE, cands: 0, shot: 'cands', q: 'Four wins on paper.', m: 'wide' },
      { open: [OPEN.A, OPEN.W, OPEN.W], cands: 1, shot: 'cands', q: 'Tighten the mesh.', m: 'fine' },
      { keep: true, q: 'Is the model bad?', m: 'wide' } ] },
  4: { core: true, beats: [
      { open: SHARP, q: 'What did it actually see?', m: 'fine', cap: true,
        flake: { t: '3,000 characters', s: 'That was all it saw.' } },
      { keep: true, q: 'Lift the cap.', m: 'cap off', cap: false,
        flake: { t: 'The whole skill', s: 'Lifting that one cap fixed the loop.' } } ] },
  5: { beats: [
      { open: WIDE, az: 14, q: 'Is the math wrong?', m: 'wide', lost: true, lostText: 'Reads 99%. Looks fine.' },
      { open: SHARP, az: 14, focus: 1, fEl: 0.5, fAz: 0.72, fD: 3.3, q: 'Is anything cancelling out?', m: 'fine',
        flake: { t: '+15.7% and -27.0%', s: 'Two flights offsetting. The total still read 99%.' } } ] },
  8: { beats: [
      { open: WIDE, shot: 'low', q: 'Tell me everything.', m: 'wide', amount: 2, lost: true, lostText: 'A bigger pile, faster.' },
      { open: SHARP, shot: 'low', flakeAt: [0.05, -0.5], q: 'What changed?', m: 'fine', amount: 2,
        flake: { t: 'Same flood.', s: 'Still one thing worth keeping.' } } ] },
  9: { beats: [{ open: SHARP, focus: 1 }] },
};

/* Slide 7: three scripted narrowing paths. Not live AI. */
const PAIRS = [
  { steps: ['How do we automate support?', 'What do people actually write in?', 'What does each message need?', 'Which team should get this message?'],
    flake: { t: 'Returns', s: 'One answer per message.' } },
  { steps: ['Is the model bad?', 'Where do the scores and the judges disagree?', 'What goes into the optimizer?', 'What did it actually see?'],
    flake: { t: '3,000 characters', s: 'That was all it saw.' } },
  { steps: ['Is the math wrong?', 'Which numbers feed the total?', 'Do any of them pull opposite ways?', 'Is anything cancelling out?'],
    flake: { t: '+15.7% and -27.0%', s: 'Two flights offsetting.' } },
];
const NARROW_OPEN = [WIDE, [OPEN.A, OPEN.W, OPEN.W], [OPEN.A, OPEN.B, OPEN.W], SHARP];

/* Slide 8: the three questions to carry, each one a mesh for one sieve. */
const CARRY = ['What changed?', 'What can it actually see?', 'What would make this obvious?'];

/* ------------------------------------------------------------------ */
/* 3D bench. Built once, driven by S.run(). */
let S = null;

async function initScene() {
  const msg = $('#viz-msg');
  let THREE;
  try {
    THREE = await import('three');
  } catch (e) {
    msg.textContent = '3D could not load. The slides still read as text.';
    return null;
  }
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: $('#gl'), antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch (e) {
    msg.textContent = 'This browser cannot draw the 3D bench. The slides still read as text.';
    return null;
  }
  return build(THREE, renderer);
}

/* A dark room with one warm window and one cool strip light, so steel gets long streaks instead of a flat sheen. */
function studioEnv(THREE) {
  const env = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(24, 18, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.05, 0.05, 0.055), side: THREE.BackSide }));
  env.add(room);
  const panel = (w, h, pos, rgb) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(rgb[0], rgb[1], rgb[2]), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(0, 1.5, 0); env.add(m);
  };
  panel(9, 6, [-8, 5, 7], [9, 6.6, 3.8]);
  panel(12, 3, [0, 1.0, 10], [1.1, 1.05, 1.0]);          // low front fill so the walls are not black       // warm window, front left
  panel(1.6, 9, [9, 3, -2], [1.4, 1.9, 3.2]);        // cool strip, right
  panel(14, 10, [0, 8.8, 2], [3.2, 3.1, 2.9]);        // soft ceiling
  panel(5, 2.5, [2, 1.2, -9], [3.4, 2.5, 1.7]);       // warm back kicker
  const gc = document.createElement('canvas'); gc.width = 256; gc.height = 256;
  const g2 = gc.getContext('2d');
  const gr = g2.createLinearGradient(0, 0, 256, 0);
  gr.addColorStop(0, '#f0eee9'); gr.addColorStop(0.42, '#a3a3a6'); gr.addColorStop(0.72, '#4b4b4f'); gr.addColorStop(1, '#1b1b1e');
  g2.fillStyle = gr; g2.fillRect(0, 0, 256, 256);
  g2.fillStyle = 'rgba(0,0,0,0.5)'; for (let i = 0; i < 4; i++) g2.fillRect(0, 36 + i * 62, 256, 14);   // dark bands so steel shows streaks
  const gt = new THREE.CanvasTexture(gc); gt.colorSpace = THREE.SRGBColorSpace;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ map: gt, color: new THREE.Color(1.5, 1.5, 1.5) }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -6; env.add(floor);   // the bench seen in the steel
  return env;
}

function build(THREE, renderer) {
  const V3 = THREE.Vector3, Q4 = THREE.Quaternion;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e0f10);
  scene.fog = new THREE.Fog(0x0e0f10, 15, 30);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(studioEnv(THREE), 0.03).texture;
  scene.environmentIntensity = 0.85;
  const camera = new THREE.PerspectiveCamera(28, 16 / 9, 0.1, 60);

  /* geometry constants (world units) */
  const LV = [2.28, 1.53, 0.78];       // mesh heights, A (coarsest) to C (finest)
  const MESH_R = 0.975, RI = 0.94, TRAY_RI = 1.22, TRAY_FLOOR = 0.045;
  const LIP = new V3(0.12, 3.62, 0);   // where the scoop pours from
  const G = -6.0;
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  /* seeded random so a replay of a slide looks like the last one */
  let seed = 7;
  const rnd = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const rr = (a, b) => a + (b - a) * rnd();

  /* ---------------- textures ---------------- */
  function canvasTex(w, h, draw, srgb, rep) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (rep) t.repeat.set(rep[0], rep[1]);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
    return t;
  }
  const brushed = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#6a6a6a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      const y = rnd() * h, x = rnd() * w, len = 40 + rnd() * 260, v = 70 + rnd() * 70 | 0;
      g.fillStyle = `rgba(${v},${v},${v},${0.12 + rnd() * 0.3})`;
      g.fillRect(x, y, len, 1 + (rnd() < 0.2 ? 1 : 0));
      if (x + len > w) g.fillRect(x - w, y, len, 1);
    }
  }, false, [1, 1]);
  const benchRough = canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#707070'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 5000; i++) {
      const v = 60 + rnd() * 90 | 0;
      g.fillStyle = `rgba(${v},${v},${v},${0.35})`;
      g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 3, 1 + rnd() * 3);
    }
    for (let i = 0; i < 160; i++) {          // wet drops: low roughness
      const x = rnd() * w, y = rnd() * h, r = 2 + rnd() * 9;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(10,10,10,0.95)'); gr.addColorStop(1, 'rgba(10,10,10,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill();
    }
  }, false, [5, 5]);

  /* ---------------- materials ---------------- */
  const steel = new THREE.MeshPhysicalMaterial({
    color: 0xb4b9c0, metalness: 1, roughness: 0.78, roughnessMap: brushed,
    anisotropy: 0.75, anisotropyRotation: 0, envMapIntensity: 1.15, side: THREE.DoubleSide,
  });
  const steelDark = steel.clone(); steelDark.color = new THREE.Color(0x777b81);
  const benchMat = new THREE.MeshPhysicalMaterial({
    color: 0x0f1011, metalness: 0.15, roughness: 1, roughnessMap: benchRough,
    clearcoat: 0.15, clearcoatRoughness: 0.4, envMapIntensity: 0.55,
  });
  const white1 = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  white1.needsUpdate = true; white1.colorSpace = THREE.SRGBColorSpace;

  /* The mesh: a woven wire cloth evaluated per pixel, so its pitch can tighten smoothly. */
  function meshMaterial(cells) {
    const u = { uCells: { value: cells }, uWf: { value: 0.14 } };
    const m = new THREE.MeshStandardMaterial({
      map: white1, metalness: 1, roughness: 0.4, envMapIntensity: 1.2,
      side: THREE.DoubleSide, transparent: true, alphaTest: 0.03,
    });
    m.userData.u = u;
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uCells = u.uCells; sh.uniforms.uWf = u.uWf;
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
uniform float uCells; uniform float uWf;`)
        .replace('#include <map_fragment>', `
vec2 mf = (vMapUv - 0.5) * uCells;
vec2 wd = abs(fract(mf + 0.5) - 0.5);
vec2 aw = fwidth(mf) * 1.05 + 1e-4;
float hw = uWf * 0.5;
vec2 cov = 1.0 - smoothstep(vec2(hw) - aw, vec2(hw) + aw, wd);
vec2 wid = floor(mf + 0.5);
float hOver = 1.0 - mod(wid.x + wid.y, 2.0);
float pv = sqrt(max(1.0 - (wd.x / hw) * (wd.x / hw), 0.0));
float ph = sqrt(max(1.0 - (wd.y / hw) * (wd.y / hw), 0.0));
float prof = (cov.x > 0.5 && cov.y > 0.5) ? mix(pv, ph, hOver) : (cov.x > cov.y ? pv : ph);
vec3 wireCol = (vec3(0.1) + vec3(0.42) * prof) * vec3(0.93, 0.96, 1.0);
diffuseColor.rgb *= wireCol;
diffuseColor.a *= max(cov.x, cov.y);`);
    };
    return m;
  }
  const pitchOf = (open) => open / 0.86;
  const cellsOf = (open) => (2 * MESH_R) / pitchOf(open);

  /* ---------------- bench, tray, sieves, stand ---------------- */
  const bench = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), benchMat);
  bench.rotation.x = -Math.PI / 2; bench.receiveShadow = true;
  scene.add(bench);

  const lathe = (pts, seg = 128) => new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p[0], p[1])), seg);
  const torus = (r, t, y, mat) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, t, 14, 160), mat);
    m.rotation.x = Math.PI / 2; m.position.y = y; m.castShadow = m.receiveShadow = true; return m;
  };
  const wallGeo = lathe([[0.992, -0.055], [1.0, -0.045], [1.0, 0.215]]);

  const sv = [];                       // per-sieve state
  const stack = new THREE.Group();
  scene.add(stack);
  for (let k = 0; k < 3; k++) {
    const g = new THREE.Group(); g.position.y = LV[k]; stack.add(g);
    const wall = new THREE.Mesh(wallGeo, steel); wall.castShadow = wall.receiveShadow = true; g.add(wall);
    g.add(torus(1.0, 0.017, 0.225, steel));
    g.add(torus(0.996, 0.012, -0.05, steel));
    const hold = torus(0.972, 0.011, 0.0, steelDark); g.add(hold);
    const mm = meshMaterial(cellsOf(OPEN.W));
    const disc = new THREE.Mesh(new THREE.CircleGeometry(MESH_R, 96), mm);
    disc.rotation.x = -Math.PI / 2; disc.receiveShadow = true; g.add(disc);
    sv.push({ g, mm, cells: cellsOf(OPEN.W), open: OPEN.W, hold });
  }
  const tray = new THREE.Group(); scene.add(tray);
  {
    const trayMat = steelDark.clone(); trayMat.anisotropy = 0;   // anisotropy bands visibly across the wide floor triangles
    const body = new THREE.Mesh(lathe([[0, 0.045], [1.2, 0.045], [1.265, 0.075], [1.285, 0.17]]), trayMat);
    body.castShadow = body.receiveShadow = true; tray.add(body);
    tray.add(torus(1.292, 0.016, 0.172, steel));
    tray.add(torus(1.2, 0.012, 0.047, steel));
  }
  /* ring stand holding the sieves */
  const stand = new THREE.Group(); scene.add(stand);
  {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 3.1, 24), steelDark);
    rod.position.set(-1.56, 1.55, 0); rod.castShadow = true; stand.add(rod);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.39, 0.05, 48), steelDark);
    base.position.set(-1.56, 0.025, 0); base.castShadow = base.receiveShadow = true; stand.add(base);
    LV.forEach((y) => {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.58, 14), steel);
      arm.rotation.z = Math.PI / 2; arm.position.set(-1.27, y + 0.14, 0); arm.castShadow = true; stand.add(arm);
      const clamp1 = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.07, 20), steelDark);
      clamp1.rotation.x = Math.PI / 2; clamp1.position.set(-1.56, y + 0.14, 0); clamp1.castShadow = true; stand.add(clamp1);
    });
  }

  /* ---------------- scoop ---------------- */
  function jitterGeo(geo, amp, hashSeed) {
    const pos = geo.attributes.position, seen = new Map();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const key = `${Math.round(x * 500)},${Math.round(y * 500)},${Math.round(z * 500)}`;
      let f = seen.get(key);
      if (f === undefined) {
        const h = Math.sin((x * 12.9898 + y * 78.233 + z * 37.719 + hashSeed) * 43758.5453);
        f = 1 + (h - Math.floor(h) - 0.5) * 2 * amp; seen.set(key, f);
      }
      pos.setXYZ(i, x * f, y * f, z * f);
    }
    geo.computeVertexNormals();
    return geo;
  }
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, metalness: 0.12, flatShading: true, envMapIntensity: 0.7 });
  const scoop = new THREE.Group(); scoop.position.copy(LIP); scene.add(scoop);
  let scoopLoad;
  {
    const bowlGeo = new THREE.SphereGeometry(0.3, 48, 20, 0, Math.PI * 2, 0, Math.PI / 2); bowlGeo.rotateX(Math.PI);
    const bowl = new THREE.Mesh(bowlGeo, steel); bowl.scale.set(1, 0.72, 1.0); bowl.position.set(-0.3, 0, 0);
    bowl.castShadow = true; scoop.add(bowl);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.012, 10, 64), steel);
    rim.rotation.x = Math.PI / 2; rim.position.set(-0.3, 0, 0); scoop.add(rim);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.02, 1.25, 16), steelDark);
    handle.rotation.z = Math.PI / 2 - 0.16; handle.position.set(-1.22, 0.1, 0); handle.castShadow = true; scoop.add(handle);
    scoopLoad = new THREE.Mesh(jitterGeo(new THREE.IcosahedronGeometry(0.27, 2), 0.18, 3), stoneMat);
    scoopLoad.scale.set(1, 0.5, 0.95); scoopLoad.position.set(-0.3, -0.02, 0); scoopLoad.castShadow = true;
    scoopLoad.material = stoneMat.clone(); scoopLoad.material.color.set(0x4b4a48);
    scoop.add(scoopLoad);
  }

  /* ---------------- document strip (slide 5) ---------------- */
  const core = new THREE.Group(); core.position.set(0.5, 0, 1.98); core.visible = false; scene.add(core);
  const CORE_N = 30, CORE_SEEN = 5;
  const coreMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.7, roughness: 0.4, envMapIntensity: 1.1 });
  const coreMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.064, 0.024, 0.36), coreMat, CORE_N);
  coreMesh.castShadow = coreMesh.receiveShadow = true; coreMesh.frustumCulled = false;
  const coreX = (i) => -1.1 + i * 0.074;
  { const m = new THREE.Matrix4();
    for (let i = 0; i < CORE_N; i++) { m.makeTranslation(coreX(i), 0.012, 0); coreMesh.setMatrixAt(i, m); coreMesh.setColorAt(i, new THREE.Color(0x222324)); }
    core.add(coreMesh); }
  const capMat = steelDark.clone(); capMat.transparent = true;
  const capBar = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.26, 0.4), capMat);
  capBar.position.set((coreX(CORE_SEEN - 1) + coreX(CORE_SEEN)) / 2, 0.14, 0); capBar.castShadow = true; core.add(capBar);
  const coreState = { lit: CORE_SEEN, lift: 0 };
  const tmpC = new THREE.Color(), cDark = new THREE.Color(0x232425), cLit = new THREE.Color(0xdfe3e7);
  function paintCore() {
    for (let i = 0; i < CORE_N; i++) { tmpC.copy(cDark).lerp(cLit, clamp(coreState.lit - i, 0, 1)); coreMesh.setColorAt(i, tmpC); }
    coreMesh.instanceColor.needsUpdate = true;
    capBar.position.y = 0.14 + coreState.lift * 1.3; capMat.opacity = 1 - coreState.lift;
    capBar.visible = coreState.lift < 0.98;
  }
  paintCore();

  /* ---------------- rejected candidates (slide 4) ----------------
     Four gold bars lie on the top mesh. Each is a row of blocks, one block per slice of the skill.
     When the mesh tightens the back six blocks of every bar drop to the tray and go dull. */
  const CAND_N = 4, CAND_B = 12, CAND_KEEP = 6, CAND_T = 2.7;
  const CAND_Z = [-0.62, -0.21, 0.21, 0.62];
  const CAND_Y = LV[0] + 0.06, CAND_FLOOR = TRAY_FLOOR + 0.02;
  const cand = { on: false, fall: 0, landed: [false, false, false, false] };
  const candGold = new THREE.Color(0xf2c24a), candDull = new THREE.Color(0x77694f), candTmp = new THREE.Color();
  const candMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.28, emissive: 0x5c3f0a, flatShading: true, envMapIntensity: 1.6 });
  const candMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.094, 0.05, 0.09), candMat, CAND_N * CAND_B);
  candMesh.castShadow = candMesh.receiveShadow = true; candMesh.frustumCulled = false; candMesh.visible = false;
  scene.add(candMesh);
  const candBlocks = [];
  {
    let s = 41; const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    const tf = Math.sqrt(2 * (CAND_Y - CAND_FLOOR) / -G);
    for (let j = 0; j < CAND_N; j++) for (let i = 0; i < CAND_B; i++) {
      const back = i >= CAND_KEEP, hx = -0.6 + (i + 0.5) * 0.1;
      candBlocks.push({
        j, back, hx, hz: CAND_Z[j], tf,
        delay: back ? j * 0.4 + (i - CAND_KEEP) * 0.05 : 0,
        dx: hx * 0.9 + (r() - 0.5) * 0.3, dz: CAND_Z[j] * 0.9 + (r() - 0.5) * 0.3,
        axis: new V3(r() - 0.5, r() - 0.5, r() - 0.5).normalize(), rate: 5 + r() * 7, yaw: r() * Math.PI,
      });
    }
  }
  const candLast = (j) => candBlocks[j * CAND_B + CAND_B - 1];
  const candQ = new Q4(), candQf = new Q4(), candP = new V3(), candS = new V3(1, 1, 1), candM = new THREE.Matrix4(), Y_AXIS = new V3(0, 1, 0);
  function writeCands() {
    candMesh.visible = cand.on;
    if (!cand.on) return;
    for (let n = 0; n < candBlocks.length; n++) {
      const b = candBlocks[n];
      if (!b.back) {
        candP.set(b.hx, CAND_Y, b.hz); candQ.identity(); candTmp.copy(candGold);
      } else {
        const tt = clamp(cand.fall - b.delay, 0, b.tf), u = tt / b.tf, k = easeInOut(u);
        candP.set(lerp(b.hx, b.dx, k), Math.max(CAND_FLOOR, CAND_Y + 0.5 * G * tt * tt), lerp(b.hz, b.dz, k));
        candQ.setFromAxisAngle(b.axis, b.rate * tt);
        candQf.setFromAxisAngle(Y_AXIS, b.yaw);
        candQ.slerp(candQf, easeInOut(clamp((u - 0.7) / 0.3, 0, 1)));
        candTmp.copy(candGold).lerp(candDull, easeInOut(clamp((u - 0.05) / 0.75, 0, 1)));
      }
      candM.compose(candP, candQ, candS); candMesh.setMatrixAt(n, candM); candMesh.setColorAt(n, candTmp);
    }
    candMesh.instanceMatrix.needsUpdate = true; candMesh.instanceColor.needsUpdate = true;
    for (let j = 0; j < CAND_N; j++) { const l = candLast(j); cand.landed[j] = cand.fall >= l.delay + l.tf; }
  }
  let candTok = 0;
  function setCands(state) {
    const tok = ++candTok; cand.on = true; dirty = 4;
    if (state === 0) { cand.fall = 0; return; }
    tweens.add(cand.fall, CAND_T, CAND_T - cand.fall, (v) => { if (tok === candTok) { cand.fall = v; dirty = 2; } }, (t) => t);
  }

  /* ---------------- lights ---------------- */
  const veilDeep = $('.veil-deep');
  const key = new THREE.SpotLight(0xffe4c2, 110, 0, 0.44, 1.0, 1.4);
  key.position.set(-4.4, 10, 5.2); key.target.position.set(0.0, 0.9, 0.2);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0003; key.shadow.normalBias = 0.02;
  key.shadow.camera.near = 4; key.shadow.camera.far = 24;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(0xaec3ff, 0.55); fill.position.set(5, 3.5, -2.5); scene.add(fill);
  const rim = new THREE.SpotLight(0xfff0dd, 90, 0, 0.5, 0.8, 1.5); rim.position.set(3.2, 5.5, -4.2); rim.target.position.set(0, 1.4, 0);
  scene.add(rim, rim.target);
  const flakeSpot = new THREE.SpotLight(0xffe2a0, 0, 0, 0.35, 0.6, 1.2); scene.add(flakeSpot, flakeSpot.target);
  const KEY0 = key.intensity;

  /* ---------------- stones ---------------- */
  const CLS = {
    xl: { n: 14, max: 28, rMin: 0.085, rMax: 0.11, detail: 1, geo: null },
    l: { n: 56, max: 112, rMin: 0.053, rMax: 0.068, detail: 1, geo: null },
    g: { n: 170, max: 340, rMin: 0.011, rMax: 0.0225, detail: 0, geo: null },
  };
  CLS.xl.geo = jitterGeo(new THREE.IcosahedronGeometry(1, 1), 0.2, 1);
  CLS.l.geo = jitterGeo(new THREE.IcosahedronGeometry(1, 1), 0.22, 2);
  CLS.g.geo = jitterGeo(new THREE.IcosahedronGeometry(1, 0), 0.25, 5);
  const inst = {};
  for (const k of ['xl', 'l', 'g']) {
    const im = new THREE.InstancedMesh(CLS[k].geo, stoneMat, CLS[k].max);
    im.castShadow = im.receiveShadow = true; im.frustumCulled = false; scene.add(im); inst[k] = im;
  }
  const FLAKE_R = 0.042;
  const flakeGeo = (() => {
    const g = new THREE.CylinderGeometry(1, 1, 0.3, 7, 1);
    const pos = g.attributes.position, seen = new Map();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), key2 = Math.round(Math.atan2(z, x) * 200);
      let f = seen.get(key2); if (f === undefined) { f = 0.72 + rnd() * 0.55; seen.set(key2, f); }
      pos.setX(i, x * f); pos.setZ(i, z * f);
    }
    g.computeVertexNormals(); return g;
  })();
  const flakeMat = new THREE.MeshStandardMaterial({ color: 0xe9bb4e, metalness: 1, roughness: 0.22, emissive: 0x5c3f0a, flatShading: true, envMapIntensity: 1.6 });
  const flakeMesh = new THREE.Mesh(flakeGeo, flakeMat); flakeMesh.castShadow = true; flakeMesh.visible = false; scene.add(flakeMesh);
  const FLAKE_VIS = 1.45;                 // drawn a little larger than its collision size so it reads
  const halfT = 0.15 * FLAKE_R * FLAKE_VIS;

  /* particle pool */
  const pool = [];
  let pid = 0;
  const tint = new THREE.Color();
  for (const k of ['xl', 'l', 'g']) {
    for (let i = 0; i < CLS[k].max; i++) {
      const r = rr(CLS[k].rMin, CLS[k].rMax);
      pool.push(mk(k, i, r));
      const lightness = rnd() < 0.1 ? rr(0.46, 0.58) : rr(0.15, 0.4);
      tint.setHSL(rr(0.06, 0.12), rr(0.03, 0.1), lightness * 0.62);
      inst[k].setColorAt(i, tint);
    }
    inst[k].instanceColor.needsUpdate = true;
  }
  const flake = mk('f', 0, FLAKE_R, 3.2); pool.push(flake);
  function mk(cls, idx, r, dens = 1) {
    return {
      id: pid++, cls, idx, r, d: 2 * r, im: 1 / (r * r * r * 1000 * dens),
      sx: rr(0.82, 1.15), sy: rr(0.75, 1.1), sz: rr(0.82, 1.15),
      x: 0, y: -9, z: 0, vx: 0, vy: 0, vz: 0, q: new Q4(), av: new V3(),
      st: 0, sl: 0, lvl: 0, ghost: false, gr: false, play: false, flatT: 0,
    };
  }
  for (const p of pool) { p.q.set(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize(); }
  const flakeFlat = new Q4();

  /* ---------------- physics ---------------- */
  const CS = 0.24, GX = 14, GY = 22;
  const grid = new Array(GX * GX * GY);
  for (let i = 0; i < grid.length; i++) grid[i] = [];
  const cellOf = (x, y, z) => {
    const cx = clamp(Math.floor(x / CS) + 7, 0, GX - 1), cz = clamp(Math.floor(z / CS) + 7, 0, GX - 1), cy = clamp(Math.floor(y / CS) + 1, 0, GY - 1);
    return [cx, cy, cz];
  };
  let open = WIDE.slice();
  let live = [];
  function limitR(y) {
    for (let k = 0; k < 3; k++) if (y > LV[k] - 0.06 && y < LV[k] + 0.235) return RI;
    if (y < 0.2) return TRAY_RI;
    return 9;
  }
  function confine(p) {
    const lim = limitR(p.y) - p.r;
    const rad = Math.hypot(p.x, p.z);
    if (rad > lim && rad > 1e-6) {
      const nx = p.x / rad, nz = p.z / rad;
      p.x = nx * lim; p.z = nz * lim;
      const vr = p.vx * nx + p.vz * nz;
      if (vr > 0) { p.vx -= 1.25 * vr * nx; p.vz -= 1.25 * vr * nz; }
    }
  }
  function support(p) {
    while (p.lvl < 3) {
      const yk = LV[p.lvl];
      if (p.d < open[p.lvl]) {
        if (p.y < yk - 0.03) { p.lvl++; continue; }
        break;
      }
      const fl = yk + p.r;
      if (p.y < fl) { landOn(p, fl); }
      return;
    }
    if (p.lvl >= 3) { const fl = TRAY_FLOOR + p.r; if (p.y < fl) landOn(p, fl); }
  }
  function landOn(p, fl) {
    const imp = -p.vy;
    p.y = fl;
    if (imp > 0.25) { p.vy = imp * 0.2; p.vx += (rnd() - 0.5) * imp * 0.07; p.vz += (rnd() - 0.5) * imp * 0.07; } else p.vy = 0;
    p.vx *= 0.9; p.vz *= 0.9; p.av.multiplyScalar(0.85); p.gr = true;
  }
  function collide(p) {
    const [cx, cy, cz] = cellOf(p.x, p.y, p.z);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const ix = cx + dx, iy = cy + dy, iz = cz + dz;
      if (ix < 0 || iz < 0 || iy < 0 || ix >= GX || iz >= GX || iy >= GY) continue;
      const bucket = grid[(ix * GX + iz) * GY + iy];
      for (let b = 0; b < bucket.length; b++) {
        const q = bucket[b];
        if (q === p || q.ghost) continue;
        if (q.st === 1 && q.id < p.id) continue;
        const ddx = q.x - p.x, ddy = q.y - p.y, ddz = q.z - p.z;
        const rs = p.r + q.r, d2 = ddx * ddx + ddy * ddy + ddz * ddz;
        if (d2 >= rs * rs || d2 < 1e-10) continue;
        const d = Math.sqrt(d2), nx = ddx / d, ny = ddy / d, nz = ddz / d, ov = rs - d;
        const wp = p.im, wq = q.st === 2 ? 0 : q.im, tot = wp + wq;
        p.x -= nx * ov * (wp / tot); p.y -= ny * ov * (wp / tot); p.z -= nz * ov * (wp / tot);
        if (wq > 0) { q.x += nx * ov * (wq / tot); q.y += ny * ov * (wq / tot); q.z += nz * ov * (wq / tot); }
        const rel = (q.vx - p.vx) * nx + (q.vy - p.vy) * ny + (q.vz - p.vz) * nz;
        if (rel < 0) {
          const j = -(1.1) * rel / tot;
          p.vx -= nx * j * wp; p.vy -= ny * j * wp; p.vz -= nz * j * wp;
          if (wq > 0) { q.vx += nx * j * wq; q.vy += ny * j * wq; q.vz += nz * j * wq; }
        }
        p.vx *= 0.992; p.vz *= 0.992;
        if (ny < -0.2) p.gr = true;
        if (q.st === 1 && ny > 0.2) q.gr = true;
      }
    }
  }
  const dq = new Q4(), ax = new V3();
  function stepPhysics(dt) {
    let awake = 0;
    for (const p of live) {
      if (p.st !== 1) continue;
      p.vy += G * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.gr = false; awake++;
    }
    if (!awake) return 0;
    for (const p of live) if (p.st === 1) { confine(p); support(p); }
    for (const b of grid) if (b.length) b.length = 0;
    for (const p of live) if (p.st !== 0) { const [cx, cy, cz] = cellOf(p.x, p.y, p.z); grid[(cx * GX + cz) * GY + cy].push(p); }
    for (let it = 0; it < 2; it++) for (const p of live) if (p.st === 1 && !p.ghost) collide(p);
    for (const p of live) if (p.st === 1) { confine(p); if (p.lvl < 3 && p.y < LV[p.lvl] + p.r && p.d >= open[p.lvl]) support(p); }
    for (const p of live) {
      if (p.st !== 1) continue;
      const al = p.av.length();
      if (al > 1e-4) { ax.copy(p.av).divideScalar(al); dq.setFromAxisAngle(ax, al * dt); p.q.premultiply(dq).normalize(); }
      if (p.gr) { p.av.multiplyScalar(0.9); p.vx *= 0.985; p.vz *= 0.985; }
      const v2 = p.vx * p.vx + p.vy * p.vy + p.vz * p.vz;
      if (p.gr && v2 < 0.0049) p.sl += dt; else if (v2 < 0.0016) p.sl += dt * 0.5; else p.sl = 0;
      if (p.sl > 0.3) { p.st = 2; p.vx = p.vy = p.vz = 0; if (p.cls === 'f') p.ghost = false; }
    }
    return awake;
  }

  /* ---------------- pours ---------------- */
  const pour = { active: false, t: 0, events: [], amount: 1, dur: 2.2, done: false, settledFor: 0, flakeSpot: new V3() };
  let scoopTilt = 0, scoopTiltTarget = 0, loadFrac = 1;
  const fade = { k: 1, dir: 0 };

  function flakeTarget(op) {
    return op[2] <= OPEN.C + 1e-6 ? new V3(-0.3, 0, 0.36) : new V3(0.06, 0, 0.12);
  }
  function preparePour(cfg) {
    open = cfg.open.slice();
    const amount = cfg.amount || 1;
    pour.amount = amount; pour.dur = amount > 1 ? 2.5 : 2.2; pour.t = 0; pour.done = false; pour.settledFor = 0; pour.active = true;
    live = []; seed = 11 + (cfg.seed || 0);
    const list = [];
    for (const k of ['xl', 'l', 'g']) {
      const n = Math.round(CLS[k].n * amount);
      for (let i = 0; i < n; i++) list.push(pool.find((p) => p.cls === k && p.idx === i));
    }
    for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
    for (const p of pool) { p.st = 0; p.play = false; p.lvl = 0; p.sl = 0; p.gr = false; p.ghost = false; p.flatT = 0; p.x = 0; p.y = -9; p.z = 0; p.vx = p.vy = p.vz = 0; }
    pour.events = [];
    flake.play = true; flake.ghost = true; live.push(flake);
    pour.events.push({ t: 0.05, p: flake });
    list.forEach((p, i) => { p.play = true; live.push(p); pour.events.push({ t: 0.4 + (i / list.length) * pour.dur + rr(-0.02, 0.02), p }); });
    pour.events.sort((a, b) => a.t - b.t);
    const tg = cfg.flakeAt ? new V3(cfg.flakeAt[0], 0, cfg.flakeAt[1]) : flakeTarget(open); pour.flakeSpot.copy(tg);
    scoopTiltTarget = 0.88; tweens.add(scoopTilt, 0.88, 0.5, (v) => { scoopTilt = v; });
    flakeMesh.visible = true;
    loadFrac = 1;
  }
  function spawn(p) {
    p.st = 1; p.lvl = 0;
    p.x = LIP.x + rr(-0.05, 0.05); p.y = LIP.y + rr(-0.02, 0.06); p.z = rr(-0.13, 0.13);
    if (p === flake) {
      const yl = (open[2] <= OPEN.C + 1e-6 ? LV[2] : TRAY_FLOOR) + p.r;
      const t = Math.sqrt(2 * (LIP.y - yl) / -G);
      p.x = LIP.x; p.z = 0;
      p.vx = (pour.flakeSpot.x - p.x) / t; p.vz = (pour.flakeSpot.z - p.z) / t; p.vy = 0;
      p.av.set(rr(-5, 5), rr(-4, 4), rr(-5, 5));
    } else {
      p.vx = rr(0.04, 0.3); p.vy = rr(-0.5, -0.1); p.vz = rr(-0.08, 0.08);
      p.av.set(rr(-6, 6), rr(-6, 6), rr(-6, 6));
    }
  }
  function pourUpdate(dt) {
    if (!pour.active) return 0;
    pour.t += dt;
    let n = 0;
    while (pour.events.length && pour.events[0].t <= pour.t) { spawn(pour.events.shift().p); n++; }
    if (pour.done && pour.t > pour.dur + 4.5) for (const p of live) if (p.st === 1) { p.st = 2; p.vx = p.vy = p.vz = 0; if (p === flake) p.ghost = false; }
    if (!pour.events.length && !pour.done) {
      pour.done = true; scoopTiltTarget = 0; tweens.add(scoopTilt, 0, 0.7, (v) => { scoopTilt = v; });
    }
    return n;
  }

  /* ---------------- tween + scheduler (frame driven, no timers) ---------------- */
  const tweens = {
    list: [],
    add(from, to, dur, fn, ease = easeInOut, done) {
      if (reduced || dur <= 0) { fn(to); if (done) done(); return; }
      this.list.push({ from, to, dur, fn, ease, t: 0, done });
    },
    step(dt) {
      for (let i = this.list.length - 1; i >= 0; i--) {
        const tw = this.list[i]; tw.t = Math.min(tw.dur, tw.t + dt);
        tw.fn(lerp(tw.from, tw.to, tw.ease(tw.t / tw.dur)));
        if (tw.t >= tw.dur) { this.list.splice(i, 1); if (tw.done) tw.done(); }
      }
    },
  };
  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function easeIn(t) { return t * t * t; }
  const sched = { list: [], clock: 0 };
  function later(sec, fn, tag = 'seq') { if (reduced) { fn(); return; } sched.list.push({ at: sched.clock + sec, fn, tag }); }
  function cancel(tag) { sched.list = sched.list.filter((s) => s.tag !== tag); }
  function schedStep(dt) {
    sched.clock += dt;
    for (let i = 0; i < sched.list.length; i++) {
      const s = sched.list[i];
      if (s.at <= sched.clock) { sched.list.splice(i, 1); i--; s.fn(); }
    }
  }

  /* ---------------- labels ---------------- */
  const lbl = {
    flake: $('#lbl-flake'), lost: $('#lbl-lost'), tags: $$('.lab.tag'), seen: $('#lbl-seen'), unseen: $('#lbl-unseen'),
    ldFlake: $('#ld-flake'), ldDot: $('#ld-flake-dot'), ldLost: $('#ld-lost'), cands: $$('.lab.cand'),
  };
  const lead = $('#lead');
  const tagLines = lbl.tags.map(() => { const l = document.createElementNS('http://www.w3.org/2000/svg', 'line'); l.setAttribute('class', ''); lead.appendChild(l); return l; });
  const candLines = lbl.cands.map(() => { const l = document.createElementNS('http://www.w3.org/2000/svg', 'line'); lead.appendChild(l); return l; });
  for (const l of candLines) { l.style.stroke = '#6a6b6b'; l.style.strokeWidth = '1'; l.style.opacity = '0'; l.style.transition = 'opacity .35s'; }
  for (const l of tagLines) { l.style.stroke = '#6a6b6b'; l.style.strokeWidth = '1'; l.style.opacity = '0'; l.style.transition = 'opacity .35s'; }
  const want = { flake: null, lost: false, tags: [null, null, null], core: false };
  let VW = 1440, VH = 810, tagBottomC = 0;
  const pv = new V3();
  function toScreen(x, y, z) { pv.set(x, y, z).project(camera); return [(pv.x * 0.5 + 0.5) * VW, (-pv.y * 0.5 + 0.5) * VH]; }
  function placeAt(el, x, y) { el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`; }
  function maxRight() { return phone ? VW - 8 : 836; }
  function updateLabels() {
    const settled = pour.settledFor > 0.45;
    // flake label
    const fOn = !!(want.flake && settled && flake.st === 2);
    lbl.flake.classList.toggle('on', fOn); lbl.ldFlake.classList.toggle('on', fOn); lbl.ldDot.classList.toggle('on', fOn);
    const lostOn = !!(want.lost && settled);
    lbl.lost.classList.toggle('on', lostOn); lbl.ldLost.classList.toggle('on', lostOn);
    if (fOn || lbl.flake.classList.contains('on')) {
      const fy = flake.y - (flake.r - halfT);
      const [fx, sy] = toScreen(flake.x, fy, flake.z);
      const w = lbl.flake.offsetWidth || 160, h = lbl.flake.offsetHeight || 50;
      let lx, ly;
      if (phone) { lx = VW - w - 8; ly = VH - h - 8; }
      else {
        lx = toScreen(1.42, LV[2], 0)[0] + 24; ly = clamp(sy - h / 2, 6, VH - h - 6);
        if (want.tags[2] && tagBottomC > 0) ly = Math.max(ly, tagBottomC + 10);
        lx = Math.min(lx, maxRight() - 175);
        // in the macro the stack fills the frame, so the label moves onto the clear dark wall above the flake
        const f = cam.focus;
        if (f > 0.001) { lx = lerp(lx, Math.min(fx + 70, maxRight() - 250), f); ly = lerp(ly, clamp(sy - 250, 6, VH - h - 6), f); }
        lbl.flake.style.maxWidth = Math.max(150, maxRight() - lx) + 'px';
      }
      placeAt(lbl.flake, lx, ly);
      lbl.ldFlake.setAttribute('x1', fx + 13); lbl.ldFlake.setAttribute('y1', sy - 1);
      lbl.ldFlake.setAttribute('x2', lx - 8); lbl.ldFlake.setAttribute('y2', phone ? ly + 6 : ly + 14);
      lbl.ldDot.setAttribute('cx', fx); lbl.ldDot.setAttribute('cy', sy);
    }
    if (lostOn || lbl.lost.classList.contains('on')) {
      const [px, py] = toScreen(0.12, 0.14, 0.15);
      const w = lbl.lost.offsetWidth || 120;
      let lx = phone ? VW - w - 8 : toScreen(1.42, 0.1, 0)[0] + 24, ly = phone ? VH - 34 : py + 4;
      ly = clamp(ly, 6, VH - 24);
      placeAt(lbl.lost, lx, ly);
      lbl.ldLost.setAttribute('x1', px + 6); lbl.ldLost.setAttribute('y1', py);
      lbl.ldLost.setAttribute('x2', lx - 6); lbl.ldLost.setAttribute('y2', ly + 8);
    }
    // sieve tags
    for (let k = 0; k < 3; k++) {
      const el = lbl.tags[k], t = want.tags[k];
      if (k === 2 && !t) tagBottomC = 0;
      const on = !!t && !phone;   // on a phone the step list below carries these
      el.classList.toggle('on', on);
      tagLines[k].style.opacity = on ? '0.9' : '0';
      if (on) {
        if (el.dataset.txt !== t) { el.textContent = t; el.dataset.txt = t; }
        const [sx, sy] = toScreen(1.0, LV[k] + 0.03, 0.05);
        const w = el.offsetWidth || 140, h = el.offsetHeight || 28;
        let lx = sx + (phone ? 12 : 34); lx = Math.min(lx, maxRight() - w);
        const ly = sy - h / 2 - (phone ? 6 : 0);
        placeAt(el, lx, ly);
        if (k === 2) tagBottomC = ly + h;
        tagLines[k].setAttribute('x1', sx); tagLines[k].setAttribute('y1', sy);
        tagLines[k].setAttribute('x2', lx); tagLines[k].setAttribute('y2', ly + h / 2);
      }
    }
    // candidate labels: one per gold bar, stamped once its back half has landed
    for (let j = 0; j < CAND_N; j++) {
      const el = lbl.cands[j], on = cand.on;
      el.classList.toggle('on', on); candLines[j].style.opacity = on ? '0.8' : '0';
      if (!on) continue;
      el.classList.toggle('rej', cand.landed[j]);
      const [bx, by] = toScreen(0.6, CAND_Y, CAND_Z[j]);
      const w = el.offsetWidth || 150, h = el.offsetHeight || 34;
      let lx = phone ? VW - w - 6 : toScreen(1.12, LV[0], 0)[0] + 22;
      lx = Math.min(lx, maxRight() - w);
      const ly = by - h / 2;
      placeAt(el, lx, ly);
      candLines[j].setAttribute('x1', bx + 6); candLines[j].setAttribute('y1', by);
      candLines[j].setAttribute('x2', lx); candLines[j].setAttribute('y2', ly + h / 2);
    }
    // document strip labels
    const cOn = want.core && core.visible;
    lbl.seen.classList.toggle('on', cOn); lbl.unseen.classList.toggle('on', cOn && coreState.lit < CORE_N - 1);
    if (cOn) {
      const [a, ay] = toScreen(core.position.x + coreX((CORE_SEEN - 1) / 2), 0.2, core.position.z);
      const [b, by] = toScreen(core.position.x + coreX(CORE_SEEN + (CORE_N - CORE_SEEN) / 2), 0.2, core.position.z);
      placeAt(lbl.seen, a - lbl.seen.offsetWidth / 2, ay - 38);
      placeAt(lbl.unseen, b - lbl.unseen.offsetWidth / 2, by - 38);
    }
  }
  function setFlakeText(f) {
    if (!f) return;
    $('b', lbl.flake).textContent = f.t; $('i', lbl.flake).textContent = f.s;
  }

  /* ---------------- camera ---------------- */
  const EL = 37 * Math.PI / 180;
  /* Camera shots. k is the weight of the shot's own azimuth; hide drops the scoop out of frame. */
  const SHOT0 = { k: 0, el: EL, az: 0, d: 1, tx: 0, ty: 0, tz: 0, hide: 0 };
  const SHOTS = {
    cands: { k: 1, el: 1.15, az: 0, d: 0.92, tx: 0, ty: -0.6, tz: 0, hide: 1 },                 // slide 4: raised, four lanes read apart
    top: { k: 1, el: 1.5, az: 0, d: 0.86, tx: 0, ty: -0.62, tz: 0, hide: 1, after: true },       // slide 3: look straight down through the meshes
    low: { k: 1, el: 0.3, az: 0, d: 0.8, tx: 0, ty: -0.85, tz: 0, hide: 0 },                    // slide 9: tray level, the pile is the subject
  };
  const cam = { focus: 0, out: 0, az: 0, s: { ...SHOT0 }, shotAfter: null, fEl: 0.62, fAz: 0, fD: 0 };
  const T0 = new V3(0.1, 1.82, 0);
  let baseDist = 9.6;
  const camPos = new V3(), camTarget = new V3();
  function placeCamera() {
    const f = cam.focus;
    const fp = new V3(flake.x, (flake.st ? flake.y : LV[2]) , flake.z);
    const sh = cam.s;
    camTarget.copy(T0); camTarget.y -= 0.9 * cam.out; camTarget.x += sh.tx; camTarget.y += sh.ty; camTarget.z += sh.tz;
    camTarget.lerp(fp, f);
    const dist = lerp(baseDist * (1 + 0.2 * cam.out) * sh.d, cam.fD || (phone ? 5.6 : 4.2), f);
    const el = lerp(sh.el, cam.fEl, f);
    const az = lerp(lerp(cam.az, sh.az, sh.k), cam.fAz, f);
    camPos.set(camTarget.x + Math.sin(az) * Math.cos(el) * dist, camTarget.y + Math.sin(el) * dist, camTarget.z + Math.cos(az) * Math.cos(el) * dist);
    camera.position.copy(camPos); camera.lookAt(camTarget);
    key.intensity = lerp(KEY0, KEY0 * 0.4, f);
    scene.environmentIntensity = lerp(0.85, 0.6, f);
    rim.intensity = lerp(90, 8, f);
    flakeSpot.intensity = f * 140; flakeMat.emissiveIntensity = 1 + 2.4 * f;
    veilDeep.style.opacity = f.toFixed(3);
    flakeSpot.position.set(flake.x + 0.5, flake.y + 1.6, flake.z + 0.9);
    flakeSpot.target.position.set(flake.x, flake.y, flake.z);
  }

  /* ---------------- sizing ---------------- */
  function resize() {
    const w = Math.max(2, viz.clientWidth), h = Math.max(2, viz.clientHeight);
    VW = w; VH = h;
    const pr = Math.max(0.75, Math.min(1.5, window.devicePixelRatio || 1) * (phone ? 1 : stageScale));
    renderer.setPixelRatio(pr); renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const vf = 28 * Math.PI / 180;
    const needV = 5.0, needH = phone ? 3.9 : 3.6;
    const distV = needV / (2 * Math.tan(vf / 2));
    const hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
    const distH = needH / (2 * Math.tan(hf / 2));
    baseDist = phone ? Math.max(distV, distH) : 9.6;
    if (!phone) camera.setViewOffset(w, h, 300 * (w / 1440), 0, w, h); else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    dirty = 4;
  }

  /* ---------------- instance matrices ---------------- */
  const mtx = new THREE.Matrix4(), pos = new V3(), scl = new V3(), qq = new Q4();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  function writeMatrices() {
      for (const p of pool) {
      if (p.cls === 'f') continue;
      const im = inst[p.cls];
      if (!p.play || p.st === 0) { im.setMatrixAt(p.idx, zero); continue; }
      const s = p.r * fade.k;
      pos.set(p.x, p.y, p.z); scl.set(s * p.sx, s * p.sy, s * p.sz);
      mtx.compose(pos, p.q, scl); im.setMatrixAt(p.idx, mtx);
    }
    for (const k of ['xl', 'l', 'g']) inst[k].instanceMatrix.needsUpdate = true;
    // flake
    if (flake.play && flake.st !== 0) {
      if (flake.st === 2) flake.flatT = Math.min(1, flake.flatT + 0.12);
      qq.copy(flake.q).slerp(flakeFlat, easeInOut(flake.flatT));
      const fy = flake.y - (flake.r - halfT) * easeInOut(flake.flatT);
      flakeMesh.position.set(flake.x, fy, flake.z); flakeMesh.quaternion.copy(qq);
      const s = FLAKE_R * FLAKE_VIS * fade.k; flakeMesh.scale.set(s, s, s);
      flakeMesh.visible = true;
    } else flakeMesh.visible = false;
    scoop.rotation.z = -scoopTilt; scoop.visible = cam.s.hide < 0.5;
    writeCands();
    scoopLoad.scale.set(1, 0.5 * Math.max(0.02, loadFrac), 0.95);
    scoopLoad.visible = loadFrac > 0.03;
  }

  /* ---------------- sequencing ---------------- */
  let dirty = 4, active = false, hold = 0;
  const cur = { open: WIDE.slice(), key: '' };
  let dropper = null;

  function clearStones(then) {
    pour.active = false; cancel('pour');
    if (!live.length) { fade.k = 1; then(); return; }
    tweens.add(1, 0, 0.28, (v) => { fade.k = v; }, easeInOut, () => {
      for (const p of pool) { p.st = 0; p.play = false; }
      live = []; fade.k = 1; flakeMesh.visible = false; then();
    });
  }
  function setMeshes(op, dur, doneAll) {
    let left = 0;
    for (let k = 0; k < 3; k++) {
      const to = cellsOf(op[k]);
      if (Math.abs(sv[k].cells - to) < 1e-3) { sv[k].open = op[k]; continue; }
      left++; sv[k].open = op[k];
      tweens.add(sv[k].cells, to, dur, (v) => { sv[k].cells = v; sv[k].mm.userData.u.uCells.value = v; }, easeInOut, () => { if (--left === 0 && doneAll) doneAll(); });
    }
    if (left === 0 && doneAll) doneAll();
    for (let k = 0; k < 3; k++) sv[k].hold.material = op[k] < OPEN.W ? steel : steelDark;
  }
  function applyCosmetics(cfg) {
    want.flake = cfg.flake || null; want.lost = !!cfg.lost; want.tags = cfg.tags || [null, null, null];
    lbl.lost.textContent = cfg.lostText || 'Somewhere in there.';
    if (cfg.core !== undefined) {
      core.visible = !!cfg.core; want.core = !!cfg.core;
      tweens.add(cam.out, cfg.core ? 1 : 0, 0.9, (v) => { cam.out = v; dirty = 2; });
    }
    if (cfg.cap !== undefined) {
      const lit = cfg.cap ? CORE_SEEN : CORE_N, lift = cfg.cap ? 0 : 1;
      const l0 = coreState.lit, f0 = coreState.lift;
      tweens.add(0, 1, 1.4, (t) => { coreState.lit = lerp(l0, lit, t); coreState.lift = lerp(f0, lift, t); paintCore(); dirty = 2; });
    }
    if (cfg.flake) { lbl.flake.classList.remove('on'); setFlakeText(cfg.flake); }
    else if (!cfg.keep) lbl.flake.classList.remove('on');
  }
  let shotTok = 0;
  function moveShot(to, dur) {
    const tok = ++shotTok, s0 = { ...cam.s };
    tweens.add(0, 1, dur, (t) => { if (tok !== shotTok) return; for (const k in SHOT0) cam.s[k] = lerp(s0[k], to[k], t); dirty = 2; });
  }
  function describe(op, cfg) {
    if (cfg && cfg.cands !== undefined) {
      $('#gl').setAttribute('aria-label', cfg.cands === 0
        ? 'Four gold bars lie on the top sieve, each one a candidate the optimizer scored as better.'
        : 'The mesh tightens. The back half of each of the four gold bars falls through to the tray and goes dull, and each one is marked rejected.');
      return;
    }
    const n = op.filter((o) => o < OPEN.W).length;
    const text = n === 0 ? 'Wide mesh. The whole pour falls through to the pan and the gold flake is lost in the pile.'
      : n === 3 ? 'Fine mesh. The gravel is sorted by size and one gold flake rests alone on the finest sieve.'
      : 'Some of the meshes are tightened. The pour is partly sorted.';
    $('#gl').setAttribute('aria-label', text);
  }
  function run(cfg, o = {}) {
    if (cfg.keep) { applyCosmetics(cfg); dirty = 4; return; }
    const token = ++run.n;
    cancel('seq'); cancel('pour');
    want.flake = null; want.lost = false;
    lbl.flake.classList.remove('on'); lbl.lost.classList.remove('on');
    pour.settledFor = 0;
    if (cfg.cands === undefined) { cand.on = false; candTok++; }
    if (dropper) { stack.remove(dropper.g); dropper = null; }
    describe(cfg.open, cfg);
    const sameMesh = cur.open.every((v, i) => v === cfg.open[i]);
    const begin = () => {
      if (token !== run.n) return;
      applyCosmetics(cfg);
      want.flake = cfg.flake || null; want.lost = !!cfg.lost;
      cam.focusTarget = cfg.focus || 0;
      tweens.add(cam.focus, 0, 0.9, (v) => { cam.focus = v; dirty = 2; }, easeInOut, () => {
        if (token !== run.n) return;
        cam.fEl = cfg.fEl || 0.62; cam.fAz = cfg.fAz || 0; cam.fD = phone ? 0 : (cfg.fD || 0);
      });
      const shot = cfg.shot ? SHOTS[cfg.shot] : null;
      cam.shotAfter = shot && shot.after ? shot : null;
      moveShot(shot && !shot.after ? shot : SHOT0, 1.1);
      { const a0 = cam.az, a1 = (cfg.az || 0) * Math.PI / 180; tweens.add(a0, a1, 1.1, (v) => { cam.az = v; dirty = 2; }); }
      if (cfg.cands !== undefined) {
        pour.active = false; pour.settledFor = 0; live = [];
        for (const p of pool) { p.st = 0; p.play = false; }
        flakeMesh.visible = false; loadFrac = 0; scoopTilt = 0;
        setCands(cfg.cands);
        dirty = 4;
        return;
      }
      loadFrac = 1;
      preparePour(cfg);
      if (reduced) simulateInstant();
      dirty = 4;
    };
    const afterClear = () => {
      if (token !== run.n) return;
      cur.open = cfg.open.slice();
      const tail = () => later(sameMesh && !o.force ? 0.1 : 0.12, begin, 'seq');
      if (o.drop !== undefined && !sameMesh) {
        dropMesh(o.drop, cfg.open[o.drop], () => { setMeshes(cfg.open, 0.6, tail); });
      } else if (sameMesh) tail(); else setMeshes(cfg.open, 0.85, tail);
    };
    clearStones(afterClear);
    dirty = 4;
  }
  run.n = 0;

  function dropMesh(k, targetOpen, done) {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(MESH_R + 0.012, 0.02, 14, 140), steel); ring.rotation.x = Math.PI / 2; g.add(ring);
    const mm = meshMaterial(cellsOf(targetOpen));
    const disc = new THREE.Mesh(new THREE.CircleGeometry(MESH_R, 96), mm); disc.rotation.x = -Math.PI / 2; g.add(disc);
    g.position.y = LV[k] + 1.15; stack.add(g); dropper = { g };
    const y1 = LV[k] + 0.03;
    tweens.add(0, 1, 0.6, (t) => { g.position.y = lerp(LV[k] + 1.15, y1, t); dirty = 2; }, easeIn, () => {
      stack.remove(g); if (dropper && dropper.g === g) dropper = null; done();
    });
  }

  function simulateInstant() {
    const dt = 1 / 120;
    for (let i = 0; i < 2400; i++) {
      pourUpdate(dt); stepPhysics(dt);
      if (pour.done && !live.some((p) => p.st === 1)) break;
    }
    for (const p of live) if (p.st === 1) { p.st = 2; }
    pour.settledFor = 1; scoopTilt = 0; loadFrac = 0; dirty = 4;
    cam.focus = cam.focusTarget || 0;
  }

  /* ---------------- main update ---------------- */
  let acc = 0;
  function update(dt) {
    schedStep(dt);
    tweens.step(dt);
    let busy = tweens.list.length > 0 || sched.list.length > 0;
    if (active) {
      acc += Math.min(dt, 0.05);
      let guard = 0;
      while (acc >= 1 / 120 && guard++ < 4) {
        pourUpdate(1 / 120);
        const a = stepPhysics(1 / 120);
        acc -= 1 / 120;
        if (a) busy = true;
      }
      if (pour.active) {
        const awake = live.some((p) => p.st === 1);
        const wasSettled = pour.settledFor > 0;
        if (pour.done && !awake) pour.settledFor += dt; else pour.settledFor = 0;
        if (pour.t > 0.2 && !pour.done) loadFrac = Math.max(0, 1 - pour.t / (pour.dur + 0.5));
        if (pour.done) loadFrac = 0;
        if (awake || !pour.done) busy = true;
        if (!wasSettled && pour.settledFor > 0 && cam.focusTarget) {
          later(0.5, () => tweens.add(cam.focus, 1, 2.2, (v) => { cam.focus = v; dirty = 2; }), 'pour');
        }
        if (!wasSettled && pour.settledFor > 0 && cam.shotAfter) {
          const sh = cam.shotAfter; later(1.1, () => moveShot(sh, 2.6), 'pour');
        }
      }
      if (cam.focus > 0.001 || cam.focusTarget) busy = busy || cam.focus < 0.999;
    }
    return busy;
  }
  const clockObj = { t: performance.now() };
  function tick(now) {
    const dt = Math.min(0.05, (now - clockObj.t) / 1000); clockObj.t = now;
    const busy = update(dt);
    if (active && !document.hidden) {
      if (busy || dirty > 0 || pour.settledFor > 0 && pour.settledFor < 1.2) {
        placeCamera(); writeMatrices();
        for (const s of sv) s.mm.userData.u.uCells.value = s.cells;
        renderer.render(scene, camera);
        updateLabels();
        if (!busy && dirty > 0) dirty--;
      }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  /* initial look: a finished wide pour is not shown, the scoop waits full */
  placeCamera(); writeMatrices(); resize();
  new ResizeObserver(() => resize()).observe(viz);

  return {
    run, resize, setActive(v) { active = v; if (v) { dirty = 4; clockObj.t = performance.now(); } },
    refit() { resize(); },
    stats() {
      const kept = { A: 0, B: 0, C: 0, tray: 0 };
      for (const p of live) if (p.st === 2 && p.cls !== 'f') { const k = ['A', 'B', 'C', 'tray'][Math.min(3, p.lvl)]; kept[k]++; }
      return { settled: pour.settledFor > 0.45, awake: live.filter((p) => p.st === 1).length, total: live.length, kept,
        flake: { st: flake.st, lvl: flake.lvl, x: +flake.x.toFixed(2), y: +flake.y.toFixed(2), z: +flake.z.toFixed(2) },
        open: open.slice(), focus: +cam.focus.toFixed(2), flakeLabelOn: lbl.flake.classList.contains('on'), lostOn: lbl.lost.classList.contains('on') };
    },
    fast() { simulateInstant(); },
    sample() {
      placeCamera(); writeMatrices(); renderer.render(scene, camera);
      const c = document.createElement('canvas'); c.width = 96; c.height = 54;
      const g = c.getContext('2d'); g.drawImage(renderer.domElement, 0, 0, 96, 54);
      const d = g.getImageData(0, 0, 96, 54).data; let sum = 0, sum2 = 0, lit = 0; const n = d.length / 4; const bins = new Set();
      for (let i = 0; i < d.length; i += 4) { const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; sum += l; sum2 += l * l; if (l > 24) lit++; bins.add((d[i] >> 4) * 256 + (d[i + 1] >> 4) * 16 + (d[i + 2] >> 4)); }
      const mean = sum / n;
      return { mean: +mean.toFixed(1), std: +Math.sqrt(sum2 / n - mean * mean).toFixed(1), litFrac: +(lit / n).toFixed(3), colors: bins.size };
    },
    canvas: $('#gl'),
  };
}

/* ------------------------------------------------------------------ */
/* Deck */
let cur = 0, beat = 0;
const narrow = { pair: 0, step: 0 };
const placed = [false, false, false];

function setQ(i, cfg) {
  const el = $('.qline', slides[i]);
  if (!el) return;
  el.innerHTML = '';
  const a = document.createElement('span'); a.className = 'qt'; a.textContent = cfg.q;
  const b = document.createElement('span'); b.className = 'mt'; b.textContent = cfg.m;
  el.append(a, b); el.dataset.m = cfg.m === 'wide' ? 'wide' : 'fine';
  el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
}

function applyBeat(i, b, opts = {}) {
  const cfg = DEF[i].beats[b];
  setQ(i, cfg);
  const full = { ...cfg, core: DEF[i].core ? true : undefined };
  if (!DEF[i].core) full.core = false;
  if (S) S.run(full, opts);
}

function renderNarrow() {
  const s7 = slides[6];
  $$('.chip', s7).forEach((c, k) => {
    c.setAttribute('aria-pressed', String(k === narrow.pair));
    $('.st', c).textContent = k === narrow.pair ? 'asking' : '';
  });
  const ol = $('.steps', s7); ol.innerHTML = '';
  const P = PAIRS[narrow.pair];
  P.steps.forEach((txt, k) => {
    if (k > narrow.step) return;
    const li = document.createElement('li');
    li.className = (k === narrow.step ? 'now' : 'past') + (k === 3 ? ' last' : '');
    const b = document.createElement('button'); b.type = 'button'; b.textContent = txt;
    b.setAttribute('aria-label', `Step ${k + 1} of 4: ${txt}`);
    b.addEventListener('click', () => setStep(k));
    li.appendChild(b); ol.appendChild(li);
  });
}
function setStep(k) {
  narrow.step = clamp(k, 0, 3);
  renderNarrow();
  const P = PAIRS[narrow.pair];
  const tags = [null, null, null];
  for (let j = 0; j < 3; j++) if (j < narrow.step) tags[j] = P.steps[j + 1];
  if (S) S.run({ open: NARROW_OPEN[narrow.step], tags, flake: narrow.step === 3 ? P.flake : null, lost: narrow.step < 3, core: false, seed: narrow.pair }, {});
}
function pickPair(k) { narrow.pair = k; setStep(0); }

function renderCarry() {
  $$('.row', slides[7]).forEach((r, k) => {
    r.setAttribute('aria-pressed', String(placed[k]));
    $('.st', r).textContent = placed[k] ? 'on the stack' : 'drop it';
  });
}
function togglePlace(k) {
  placed[k] = !placed[k];
  renderCarry();
  const open = placed.map((on, j) => (on ? SHARP[j] : OPEN.W));
  const tags = placed.map((on, j) => (on ? CARRY[j] : null));
  const all = placed.every(Boolean);
  if (S) S.run({ open, tags, flake: all ? { t: "Now it's obvious.", s: 'Three meshes. One thing kept.' } : null, lost: !all, core: false, seed: 3 }, placed[k] ? { drop: k } : {});
}

function enter(i) {
  cur = i; beat = 0;
  const showViz = i > 0;
  if (S) S.setActive(showViz);
  if (i === 6) { narrow.pair = 0; narrow.step = 0; setStep(0); }
  else if (i === 7) { placed.fill(false); renderCarry(); if (S) S.run({ open: WIDE, tags: [null, null, null], flake: null, lost: true, core: false, seed: 3 }); }
  else if (DEF[i]) applyBeat(i, 0);
}

function mountViz(i) {
  if (!phone) { if (viz.parentElement !== stage) stage.insertBefore(viz, slides[0]); viz.style.display = ''; return; }
  if (i === 0) { viz.style.display = 'none'; return; }
  viz.style.display = '';
  const slot = $('.slot', slides[i]);
  if (slot && viz.parentElement !== slot) slot.appendChild(viz);
}

function go(i, opts = {}) {
  i = clamp(i, 0, N - 1);
  if (i === cur && !opts.force) return;
  slides.forEach((s, k) => { s.classList.toggle('on', k === i); s.setAttribute('aria-hidden', String(k !== i)); if (k === i) s.removeAttribute('inert'); else s.setAttribute('inert', ''); });
  stage.classList.toggle('is-cover', i === 0);
  counter.textContent = `Pour ${i + 1} of ${N}`;
  $('#prev').disabled = i === 0; $('#next').disabled = i === N - 1;
  liveRegion.textContent = `Pour ${i + 1} of ${N}. ${$('h1', slides[i]).textContent}`;
  if (!opts.fromHash) { try { history.replaceState(null, '', `#${i + 1}`); } catch (e) { /* file or sandboxed frame */ } }
  mountViz(i);
  if (phone) { slides[i].scrollTop = 0; }
  enter(i);
  if (S) S.refit();
}

function primary() {
  if (cur === 0) return go(1);
  if (cur === 6) { if (narrow.step < 3) return setStep(narrow.step + 1); return go(7); }
  if (cur === 7) { const k = placed.indexOf(false); if (k >= 0) return togglePlace(k); return go(8); }
  const d = DEF[cur];
  if (d && beat < d.beats.length - 1) { beat++; return applyBeat(cur, beat); }
  if (cur === N - 1) { return applyBeat(cur, 0, { force: true }); }
  go(cur + 1);
}

function fitStage() {
  if (phone) { stage.style.removeProperty('--s'); stageScale = 1; return; }
  stageScale = Math.min(innerWidth / 1440, innerHeight / 810);
  stage.style.setProperty('--s', stageScale.toFixed(4));
}

/* sources panel */
const src = $('#sources'), srcBtn = $('#srcbtn');
function openSources(on) {
  src.classList.toggle('open', on); srcBtn.setAttribute('aria-expanded', String(on));
  if (on) { src.removeAttribute('inert'); $('#srcclose').focus(); } else { src.setAttribute('inert', ''); srcBtn.focus(); }
}
src.setAttribute('inert', '');

/* wiring */
$('#prev').addEventListener('click', () => go(cur - 1));
$('#next').addEventListener('click', () => go(cur + 1));
$('#primary').addEventListener('click', primary);
srcBtn.addEventListener('click', () => openSources(!src.classList.contains('open')));
$('#srcclose').addEventListener('click', () => openSources(false));
$$('.chip', slides[6]).forEach((c) => c.addEventListener('click', () => pickPair(+c.dataset.pair)));
$$('.row', slides[7]).forEach((r) => r.addEventListener('click', () => togglePlace(+r.dataset.k)));

addEventListener('keydown', (e) => {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  if (src.classList.contains('open')) { if (e.key === 'Escape') { openSources(false); e.preventDefault(); } return; }
  const onBtn = e.target.closest && e.target.closest('button,a');
  switch (e.key) {
    case 'ArrowRight': case 'PageDown': go(cur + 1); e.preventDefault(); break;
    case 'ArrowLeft': case 'PageUp': go(cur - 1); e.preventDefault(); break;
    case ' ': case 'Enter': if (onBtn) return; primary(); e.preventDefault(); break;
    case 'Home': go(0); e.preventDefault(); break;
    case 'End': go(N - 1); e.preventDefault(); break;
    default:
  }
});
let tx = 0, ty = 0, tt = 0;
stage.addEventListener('touchstart', (e) => { const t = e.changedTouches[0]; tx = t.clientX; ty = t.clientY; tt = Date.now(); }, { passive: true });
stage.addEventListener('touchend', (e) => {
  const t = e.changedTouches[0], dx = t.clientX - tx, dy = t.clientY - ty;
  if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.4 && Date.now() - tt < 700) go(cur + (dx < 0 ? 1 : -1));
}, { passive: true });
addEventListener('hashchange', () => { const n = parseInt(location.hash.slice(1), 10); if (n >= 1 && n <= N) go(n - 1, { fromHash: true }); });
addEventListener('resize', () => { fitStage(); if (S) S.refit(); });
phoneMQ.addEventListener('change', () => { phone = phoneMQ.matches; fitStage(); mountViz(cur); if (S) S.refit(); });
document.addEventListener('visibilitychange', () => { if (S) S.setActive(!document.hidden && cur > 0); });

/* boot */
fitStage();
const start = (() => { const n = parseInt(location.hash.slice(1), 10); return n >= 1 && n <= N ? n - 1 : 0; })();
cur = -1;
go(start, { force: true, fromHash: true });
if (start === 0) { try { history.replaceState(null, '', '#1'); } catch (e) { /* ignore */ } }

initScene().then((scene) => {
  S = scene;
  const msg = $('#viz-msg');
  if (S) {
    msg.hidden = true;
    window.__deck = { S, go, primary, get cur() { return cur; }, get beat() { return beat; }, stats: () => S.stats(), fast: () => S.fast() };
    S.setActive(cur > 0);
    mountViz(cur);
    S.refit();
    enter(cur);
  } else {
    window.__deck = { go, primary, get cur() { return cur; } };
  }
});
