import * as THREE from 'three';

/* ------------------------------------------------------------------
   The block that turns. One law: a parcel moves only when an agent
   passes it. Every parcel hop in this file goes through pass() (belt)
   or sweepPass() (lattice), which swing an agent arm first.
------------------------------------------------------------------- */

const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MOBILE = matchMedia('(max-width: 760px)');
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const eIO = t => (t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const eO = t => 1 - Math.pow(1 - t, 3);
const eI = t => t * t;
const V = THREE.Vector3;
const TOTAL = 10;

const PAPER = 0xf3f0e8, INK = 0x191a1c, BLUE = 0x2b4aa0;
const FD = "'Big Shoulders Stencil Display', sans-serif";
const FM = "'IBM Plex Mono', monospace";

/* ---------------- data ---------------- */
const SOURCES = [
  { t: 'Introducing the Model Context Protocol', p: 'Anthropic', d: '25 Nov 2024', u: 'https://www.anthropic.com/news/model-context-protocol' },
  { t: 'Announcing the Agent2Agent Protocol (A2A)', p: 'Google Developers Blog', d: '9 Apr 2025', u: 'https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/' },
  { t: 'Linux Foundation Launches the Agent2Agent Protocol Project', p: 'Linux Foundation', d: '23 Jun 2025', u: 'https://www.linuxfoundation.org/press/linux-foundation-launches-the-agent2agent-protocol-project-to-enable-secure-intelligent-communication-between-ai-agents' },
  { t: 'A2A Protocol Surpasses 150 Organizations, Lands in Major Cloud Platforms, and Sees Enterprise Production Use in First Year (v1.0, Signed Agent Cards)', p: 'Linux Foundation', d: '9 Apr 2026', u: 'https://linuxfoundation.org/press/a2a-protocol-surpasses-150-organizations-lands-in-major-cloud-platforms-and-sees-enterprise-production-use-in-first-year' },
  { t: 'Linux Foundation Announces the Formation of the Agentic AI Foundation (MCP, goose, AGENTS.md)', p: 'Linux Foundation', d: '9 Dec 2025', u: 'https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation' },
  { t: 'Stripe and OpenAI announce the Agentic Commerce Protocol', p: 'Stripe', d: '29 Sep 2025', u: 'https://stripe.com/newsroom/news/stripe-openai-instant-checkout' },
  { t: 'Powering AI commerce with the new Agent Payments Protocol (AP2)', p: 'Google Cloud Blog', d: '16 Sep 2025', u: 'https://cloud.google.com/blog/products/ai-machine-learning/announcing-agents-to-payments-ap2-protocol' },
  { t: 'The Future is Here: Visa Announces New Era of Commerce Featuring AI (Visa Intelligent Commerce)', p: 'Visa', d: '30 Apr 2025', u: 'https://investor.visa.com/news/news-details/2025/The-Future-is-Here-Visa-Announces-New-Era-of-Commerce-Featuring-AI/default.aspx' },
  { t: 'Mastercard unveils Agent Pay, pioneering agentic payments technology', p: 'Mastercard', d: '29 Apr 2025', u: 'https://newsroom.mastercard.com/news/press/2025/april/mastercard-unveils-agent-pay-pioneering-agentic-payments-technology-to-power-commerce-in-the-age-of-ai' },
  { t: 'The agentic commerce platform: Shopify connects any merchant to every AI conversation (Universal Commerce Protocol, with Google)', p: 'Shopify', d: '11 Jan 2026', u: 'https://www.shopify.com/news/ai-commerce-at-scale' },
  { t: 'First-hand: the author runs this setup (Codex and Claude handing work to each other, a messaging agent routing to coding agents, an agent deploying this portfolio through another company\'s agent tools)', p: 'Jash Shah', d: 'Stated by the author, Oct 2026', u: '' },
];

const LEDGER = [
  [['25 Nov 2024', 'Anthropic introduces MCP, an open standard for connecting AI to tools and data', 1],
   ['9 Dec 2025', 'MCP joins the Linux Foundation\'s Agentic AI Foundation', 5]],
  [['9 Apr 2025', 'Google announces Agent2Agent (A2A)', 2],
   ['23 Jun 2025', 'A2A becomes a Linux Foundation project', 3],
   ['9 Apr 2026', 'A2A v1.0 is stable, 150+ organizations back it', 4, true]],
  [['29 Apr 2025', 'Mastercard Agent Pay, with agentic tokens', 9],
   ['30 Apr 2025', 'Visa Intelligent Commerce', 8],
   ['16 Sep 2025', 'Google AP2, payments with signed mandates', 7],
   ['29 Sep 2025', 'Stripe and OpenAI: Agentic Commerce Protocol', 6],
   ['11 Jan 2026', 'Shopify and Google: Universal Commerce Protocol', 10, true]],
];

const SL = [
  { r: 'HUMAN → AGENT', act: 'Send the first request', side: 'f' },
  { r: 'HUMAN → PAGE', act: 'Next parcel', side: 'f' },
  { r: 'COMPANY → AGENT', act: 'Next parcel', side: 'f' },
  { r: 'AGENT → AGENT', act: 'Send the request', side: 'b' },
  { r: 'TOOLS → TALK → PAY', act: 'Next parcel', side: 'b' },
  { r: 'PAGE → NOTHING', act: 'Fold the next page', side: 'f', steps: 3 },
  { r: 'ASK → CHECK → TRUST', act: 'Show the next station', side: 'b', steps: 3 },
  { r: 'NODE → NODE', act: 'Next parcel', side: 'b' },
  { r: 'AGENT → GATE', act: 'Run the gate', side: 'b' },
  { r: 'YOU → YOUR AGENT', act: 'Build my agent', side: 'b' },
];

const CAMS = [
  null,
  { p: [3, 9, 22.8], t: [0, 2.3, 1.0], s: 0.05 },
  { p: [3, 9, 22.8], t: [0, 2.3, 1.0], s: 0.05 },
  { p: [3, 8.8, 22.8], t: [0, 2.3, 1.2], s: 0.05 },
  { p: [1, 10.5, 24.5], t: [0, 2.4, 0.9], s: 0.17 },
  { p: [0, 11, 25], t: [0, 2.5, 0.8], s: 0.2 },
  { p: [2.5, 8.4, 23], t: [0, 2.6, 2], s: 0.13 },
  { p: [0.5, 10.4, 23.5], t: [0, 2.6, 0.8], s: 0.15 },
  { p: [0, 54, 34], t: [0, 0, 2], s: 0 },
  { p: [1.0, 6.6, 19.5], t: [1.0, 3.0, 1.0], s: 0.06 },
  { p: [0, 10.5, 24], t: [-0.3, 2.6, 0.9], s: 0.1 },
];

const MSG = [
  { from: 'A', tag: '01 REQUEST', who: 'my agent to their agent', stamp: 'MCP', sub: 'TOOLS',
    lines: ['01 REQUEST', 'from  my agent', 'to    their agent', '', 'need  one pallet of', '      cotton totes', 'by    Friday'],
    note: 'MCP: my agent reads their catalog through a tool.' },
  { from: 'B', tag: '02 OFFER', who: 'their agent to my agent', stamp: 'A2A', sub: 'AGENT TO AGENT',
    lines: ['02 OFFER', 'in stock  yes', 'ships     Thursday', 'price     list price', 'terms     on delivery'],
    note: 'A2A: one agent answers another across companies.' },
  { from: 'A', tag: '03 COUNTER', who: 'my agent to their agent', stamp: 'A2A', sub: 'AGENT TO AGENT',
    lines: ['03 COUNTER', 'price    better for a', '         full pallet', 'freight  split', 'terms    pay on delivery'],
    note: 'A2A: terms go back and forth.' },
  { from: 'B', tag: '04 CONFIRM', who: 'their agent to my agent', stamp: 'AP2', sub: 'CHECKOUT',
    lines: ['04 CONFIRM', 'agreed', 'order sealed', 'mandate signed', 'pay on delivery'],
    note: 'A payment protocol such as AP2 carries the signed checkout.' },
];

/* ---------------- tweens (token-bound, so leaving a slide cancels its scenario) ---------------- */
const CANCEL = Symbol('cancel');
const run = { tok: 0 };
const tws = [];
function tween(dur, fn, ease = eIO, bound = true) {
  const tok = run.tok;
  const p = new Promise((res, rej) => {
    if (bound && tok !== run.tok) { rej(CANCEL); return; }
    if (RM || dur <= 0) { fn(1); res(); return; }
    tws.push({ t: 0, dur, fn, ease, res, rej, tok, bound });
  });
  p.catch(() => {});
  return p;
}
const T = (d, f, e) => tween(d, f, e, true);
const TA = (d, f, e) => tween(d, f, e, false);
const W = d => T(d, () => {});
function stepTweens(dt) {
  for (let i = tws.length - 1; i >= 0; i--) {
    const w = tws[i];
    if (w.bound && w.tok !== run.tok) { tws.splice(i, 1); w.rej(CANCEL); continue; }
    w.t += dt;
    const k = clamp(w.t / w.dur);
    w.fn(w.ease(k));
    if (k >= 1) { tws.splice(i, 1); w.res(); }
  }
}
const safe = fn => async (...a) => { try { await fn(...a); } catch (e) { if (e !== CANCEL) console.error(e); } };

/* ---------------- renderer, scene, lights ---------------- */
const viz = $('#viz'), glc = $('#gl'), stage = $('#stage');
const renderer = new THREE.WebGLRenderer({ canvas: glc, antialias: true, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(PAPER);
const camera = new THREE.PerspectiveCamera(32, 1.14, 0.5, 300);

scene.add(new THREE.HemisphereLight(0xffffff, 0xcfc8b6, 1.55));
const sun = new THREE.DirectionalLight(0xfff5e6, 2.7);
sun.position.set(8, 17, 13);
sun.castShadow = true;
sun.shadow.mapSize.set(MOBILE.matches ? 1024 : 2048, MOBILE.matches ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 12, bottom: -12, near: 1, far: 60 });
sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
scene.add(sun);
const fill = new THREE.DirectionalLight(0xe8eefc, 0.7);
fill.position.set(-10, 7, -6);
scene.add(fill);

const turn = new THREE.Group();
scene.add(turn);
// the freight side lives in view space: with the turntable at 180 degrees this group is unrotated, so x runs left to right on screen
const rear = new THREE.Group();
rear.rotation.y = Math.PI;
turn.add(rear);
for (const x of [-3, 3]) {
  const pl = new THREE.PointLight(0xffffff, 9, 9, 2);
  pl.position.set(x, 3.2, -0.6);
  turn.add(pl);
}

/* ---------------- helpers ---------------- */
function ctex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
const mat = (color, rough = .85, metal = 0) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
const M = {
  ink: mat(INK, .7, .1), ink2: mat(0x2b2c2f, .7, .1), paper: mat(0xf6f4ec, .95), conc: mat(0xd9d4c8, .95),
  blue: mat(BLUE, .6), black: mat(0x0c0d0e, .8),
};
function box(w, h, d, m, x = 0, y = 0, z = 0, parent = turn, shadow = true) {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  o.position.set(x, y, z);
  if (shadow) { o.castShadow = true; o.receiveShadow = true; }
  parent.add(o);
  return o;
}
function lampMat() {
  return new THREE.MeshStandardMaterial({ color: 0x1a2a66, emissive: BLUE, emissiveIntensity: .25, roughness: .4 });
}
const setLamp = (m, v) => { m.emissiveIntensity = v; };

async function loadFonts() {
  const job = Promise.all([
    document.fonts.load("900 48px 'Big Shoulders Stencil Display'"),
    document.fonts.load("700 48px 'Big Shoulders Stencil Display'"),
    document.fonts.load("500 14px 'IBM Plex Mono'"),
    document.fonts.load("400 14px 'IBM Plex Mono'"),
  ]).catch(() => {});
  await Promise.race([job, new Promise(r => setTimeout(r, 2500))]);
}

/* ---------------- main build (after fonts, so textures carry the right face) ---------------- */
const actors = new Set();
const belts = [];
const towers = [];
let yoursSign, printerA, printerB, gate, board, streetPrinters = [], posters = [], humans = [], banners = [], dist, hubNodes = [];
const BELT_Y = [0.3, 2.3, 4.5];
const TIER_X = [-5.2, -3.6, 0, 3.2, 5.2];

function build() {
  /* turntable */
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(8.4, 8.4, .2, 96), mat(0xfbfaf4, .95));
  disc.position.y = -.1; disc.receiveShadow = true;
  turn.add(disc);
  const ring = new THREE.InstancedMesh(new THREE.BoxGeometry(.36, .03, .07), M.blue, 72);
  const dm = new THREE.Object3D();
  for (let i = 0; i < 72; i++) {
    const a = i / 72 * Math.PI * 2;
    dm.position.set(Math.cos(a) * 8.05, .016, Math.sin(a) * 8.05);
    dm.rotation.set(0, -(a + Math.PI / 2), 0);
    dm.updateMatrix();
    ring.setMatrixAt(i, dm.matrix);
  }
  turn.add(ring);
  const rimText = (txt, z, rot) => {
    const t = ctex(512, 96, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.fillStyle = '#191a1c'; g.font = `900 70px ${FD}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(txt, w / 2, h / 2 + 4);
    });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(4.2, .79), new THREE.MeshBasicMaterial({ map: t, transparent: true }));
    p.rotation.x = -Math.PI / 2; p.rotation.z = rot; p.position.set(0, .02, z);
    turn.add(p);
  };
  rimText('HUMAN SIDE', 7.2, 0);
  rimText('FREIGHT SIDE', -7.2, Math.PI);
  box(13.6, .15, 5.2, mat(0xe8e4d8, .95), 0, .075, 0);

  /* ground shadow catcher + faint ledger grid */
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), new THREE.ShadowMaterial({ opacity: .16 }));
  sh.rotation.x = -Math.PI / 2; sh.position.y = -.015; sh.receiveShadow = true;
  scene.add(sh);
  const grid = new THREE.GridHelper(220, 110, 0xcfc9b8, 0xdedacc);
  grid.position.y = -.03; grid.material.transparent = true; grid.material.opacity = .55;
  scene.add(grid);

  buildBlock();
  buildCorridor();
  buildStreet();
  buildDistrict();
  decor();
}

/* ---- the block ---- */
const BX = [-6.8, -3.6, 0, 3.2], BWd = [3.2, 3.6, 3.2, 3.6], HF = [4.9, 5.5, 4.7, 5.2];
const SHOP = ['TAILOR', 'HARDWARE', 'COFFEE', 'BOOKS'];
const WALL = [0xe9e5da, 0xdcd7ca, 0xece8de, 0xe0dbce];
const DOORX = [];

function winTex(kind) {
  return ctex(256, 192, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#ffeec6'); gr.addColorStop(1, '#ffc977');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(25,26,28,.78)';
    if (kind === 0) { // tailor: mannequins
      for (const x of [50, 118, 186]) { g.beginPath(); g.arc(x, 56, 12, 0, 7); g.fill(); g.beginPath(); g.moveTo(x - 20, 74); g.lineTo(x + 20, 74); g.lineTo(x + 14, 150); g.lineTo(x - 14, 150); g.fill(); g.fillRect(x - 2, 150, 4, 36); }
      g.fillStyle = 'rgba(43,74,160,.8)'; g.fillRect(36, 92, 28, 40);
    } else if (kind === 1) { // hardware: shelves
      for (const y of [60, 112, 164]) { g.fillRect(14, y, 228, 5); for (let i = 0; i < 9; i++) g.fillRect(20 + i * 25, y - 26 - (i * 7 % 13), 18, 26 + (i * 7 % 13)); }
      g.fillStyle = 'rgba(43,74,160,.8)'; g.fillRect(100, 34, 24, 26);
    } else if (kind === 2) { // coffee: lamps + tables
      for (const x of [50, 128, 206]) { g.fillRect(x - 1, 0, 2, 40); g.beginPath(); g.arc(x, 48, 14, 0, 7); g.fill(); g.fillRect(x - 24, 130, 48, 6); g.fillRect(x - 3, 136, 6, 44); }
    } else { // books
      for (let r = 0; r < 3; r++) for (let i = 0; i < 16; i++) { g.fillStyle = i % 5 === 0 ? 'rgba(43,74,160,.85)' : 'rgba(25,26,28,.78)'; g.fillRect(12 + i * 14, 20 + r * 54 + (i * 5 % 9), 10, 42 - (i * 5 % 9)); }
    }
  });
}
function signTex(txt) {
  return ctex(512, 96, (g, w, h) => {
    g.fillStyle = '#191a1c'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2b4aa0'; g.fillRect(0, h - 10, w, 10);
    g.fillStyle = '#f3f0e8'; g.font = `900 64px ${FD}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(txt, w / 2, h / 2 - 2);
  });
}
const PAGES = [
  { w: 1.5, h: 1.6, draw: (g, w, h) => { // a form
    chrome(g, w, h, 'contact-us');
    g.fillStyle = '#191a1c'; g.font = `900 46px ${FD}`; g.textAlign = 'left'; g.fillText('CONTACT US', 28, 128);
    g.font = `400 17px ${FM}`;
    ['Name', 'Email', 'Company', 'How can we help?'].forEach((l, i) => { g.fillStyle = '#3a3b3e'; g.fillText(l, 28, 180 + i * 78); g.strokeStyle = '#191a1c'; g.lineWidth = 2; g.strokeRect(28, 190 + i * 78, w - 56, 38); });
    g.fillStyle = '#2b4aa0'; g.fillRect(28, h - 74, 150, 44); g.fillStyle = '#f3f0e8'; g.font = `500 18px ${FM}`; g.fillText('Submit', 66, h - 46);
  } },
  { w: 2.4, h: 1.25, draw: (g, w, h) => { // search results
    chrome(g, w, h, 'search?q=totes+pallet');
    g.fillStyle = '#fff'; g.strokeStyle = '#191a1c'; g.lineWidth = 2; g.strokeRect(24, 74, w - 48, 34);
    g.fillStyle = '#3a3b3e'; g.font = `400 16px ${FM}`; g.fillText('cotton totes pallet supplier', 36, 97);
    for (let i = 0; i < 4; i++) { const y = 138 + i * 62; g.fillStyle = '#2b4aa0'; g.fillRect(24, y, 250 + (i * 53 % 90), 12); g.fillStyle = '#8a8b8e'; g.fillRect(24, y + 22, w - 90, 7); g.fillRect(24, y + 36, w - 160 - (i * 37 % 60), 7); }
  } },
  { w: 1.6, h: 1.45, draw: (g, w, h) => { // contact sales
    chrome(g, w, h, 'pricing');
    g.fillStyle = '#191a1c'; g.font = `900 56px ${FD}`; g.textAlign = 'left'; g.fillText('TALK TO', 28, 150); g.fillText('SALES', 28, 204);
    g.fillStyle = '#8a8b8e'; g.fillRect(28, 236, w - 80, 8); g.fillRect(28, 254, w - 140, 8);
    g.fillStyle = '#191a1c'; g.fillRect(28, 302, 210, 56); g.fillStyle = '#f3f0e8'; g.font = `500 19px ${FM}`; g.fillText('Contact sales', 48, 337);
    g.fillStyle = '#8a8b8e'; g.font = `400 14px ${FM}`; g.fillText('A rep will be in touch.', 28, 394);
  } },
];
function chrome(g, w, h, url) {
  g.fillStyle = '#fbfaf5'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#191a1c'; g.fillRect(0, 0, w, 52);
  g.fillStyle = '#f3f0e8'; for (let i = 0; i < 3; i++) g.fillRect(16 + i * 20, 20, 11, 11);
  g.fillStyle = '#3a3b3e'; g.fillRect(90, 12, w - 106, 28);
  g.fillStyle = '#f3f0e8'; g.font = `400 14px ${FM}`; g.textAlign = 'left'; g.fillText('https://shop.example/' + url, 100, 31);
  g.strokeStyle = '#191a1c'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
}

function buildBlock() {
  for (let i = 0; i < 4; i++) {
    const w = BWd[i], cx = BX[i] + w / 2;
    const wallM = mat(WALL[i], .95), wall2 = mat(WALL[i] - 0x050505, .95);
    box(w - .04, 4.4, 2.2, wallM, cx, 2.2, 1.5);
    box(w, HF[i], .14, wall2, cx, HF[i] / 2, 2.62);
    // rear bay: slabs at L1 and roof (L2), open to the freight side
    box(w - .02, .14, 3.0, mat(0xcfcabd, .95), cx, 2.13, -1.1);
    box(w - .02, .14, 3.0, mat(0xcfcabd, .95), cx, 4.33, -1.1);
    // hatches on the rear face of the shop mass
    for (const y of [1.0, 3.2]) box(.9, 1.1, .05, M.ink, cx - w * .25 + (i % 2) * .5, y + .12, .41);
    // shopfront
    const wx = cx - w * .17, wwid = w * .58;
    const win = new THREE.Mesh(new THREE.PlaneGeometry(wwid, 1.55), new THREE.MeshBasicMaterial({ map: winTex(i) }));
    win.position.set(wx, 1.15, 2.705); turn.add(win);
    for (const [bw, bh, bx2, by] of [[wwid + .12, .07, 0, .79], [wwid + .12, .07, 0, -.79], [.07, 1.65, -wwid / 2 - .03, 0], [.07, 1.65, wwid / 2 + .03, 0], [.04, 1.55, 0, 0]])
      box(bw, bh, .05, M.ink, wx + bx2, 1.15 + by, 2.72, turn, false);
    const dx = cx + w * .3; DOORX[i] = dx;
    box(.84, 1.78, .06, M.ink, dx, 1.04, 2.72, turn, false);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(.66, 1.56), new THREE.MeshBasicMaterial({ color: 0xffe2a0 }));
    glass.position.set(dx, 1.04, 2.76); turn.add(glass);
    box(.05, .5, .04, M.ink, dx + .22, 1.0, 2.8, turn, false);
    const aw = box(w * .66, .06, .6, i % 2 ? M.blue : M.ink, wx + (i % 2 ? .0 : .0), 2.04, 2.98);
    aw.rotation.x = .26;
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(w * .86, .32), new THREE.MeshBasicMaterial({ map: signTex(SHOP[i]) }));
    sg.position.set(cx, 2.4, 2.705); turn.add(sg);
    if (i === 3) { // OPEN flag
      const f = new THREE.Mesh(new THREE.PlaneGeometry(.9, .42), new THREE.MeshBasicMaterial({ map: ctex(256, 120, (g, w2, h2) => { g.fillStyle = '#2b4aa0'; g.fillRect(0, 0, w2, h2); g.fillStyle = '#f3f0e8'; g.font = `900 78px ${FD}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('OPEN', w2 / 2, h2 / 2 + 4); }) }));
      f.position.set(cx, 3.6, 2.705); turn.add(f);
    }
  }
  // columns on the rear edge
  for (let i = 0; i <= 4; i++) box(.22, 4.4, .22, M.ink, i === 4 ? 6.7 : (i === 0 ? -6.7 : BX[i]), 2.2, -2.5);
  // posters: pages hung on the facade, they fold up and fall in slide 6
  [[0, 3.5], [1, 3.46], [2, 3.5]].forEach(([bi, y], k) => {
    const pg = PAGES[k];
    const cx = BX[bi] + BWd[bi] / 2;
    const tex = ctex(512, Math.round(512 * pg.h / pg.w), pg.draw);
    const grp = new THREE.Group();
    grp.position.set(cx, y, 2.7);
    turn.add(grp);
    const pivot = new THREE.Group();
    pivot.position.y = 0;
    grp.add(pivot);
    const mkHalf = (top) => {
      const t = tex.clone(); t.needsUpdate = true;
      t.repeat.set(1, .5); t.offset.set(0, top ? .5 : 0);
      const front = new THREE.MeshBasicMaterial({ map: t });
      const back = mat(0xf6f4ec, .95);
      const side = mat(0x191a1c, .8);
      const m = new THREE.Mesh(new THREE.BoxGeometry(pg.w, pg.h / 2, .03), [side, side, side, side, front, back]);
      m.castShadow = true;
      return m;
    };
    const topH = mkHalf(true); topH.position.y = pg.h / 4; grp.add(topH);
    const botH = mkHalf(false); botH.position.y = -pg.h / 4; pivot.add(botH);
    posters.push({ grp, pivot, pg, home: grp.position.clone(), state: 0, cx, y, bi });
  });
}

/* ---- corridor: belts, towers, printers, gate, board ---- */
const beltTexture = (() => {
  const t = ctex(128, 64, (g, w, h) => {
    g.fillStyle = '#26272a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#4a4b50'; for (let i = 0; i < 4; i++) g.fillRect(i * 32 + 4, 4, 14, h - 8);
    g.fillStyle = '#f3f0e8'; g.fillRect(0, 0, w, 3); g.fillRect(0, h - 3, w, 3);
  });
  t.wrapping = THREE.RepeatWrapping;
  return t;
})();
function makeBelt(len, wid, parent, x, y, z, vertical = false) {
  const t = beltTexture.clone(); t.needsUpdate = true;
  t.wrapping = THREE.RepeatWrapping; t.repeat.set(len / .5, 1);
  const top = new THREE.MeshStandardMaterial({ map: t, roughness: .8 });
  const b = new THREE.Mesh(new THREE.BoxGeometry(len, .12, wid), [M.ink, M.ink, top, M.ink, M.ink, M.ink]);
  b.position.set(x, y - .06, z); b.castShadow = true; b.receiveShadow = true;
  parent.add(b);
  return { mesh: b, tex: t };
}
function buildCorridor() {
  BELT_Y.forEach((y) => {
    const bl = makeBelt(11.8, .9, rear, 0, y, 1.0);
    belts.push(bl);
    box(11.8, .07, .06, M.paper, 0, y + .035, 1.48, rear, false);
    box(11.8, .07, .06, M.paper, 0, y + .035, .52, rear, false);
    for (const lx of [-5.4, -1.8, 1.6, 5.0]) box(.14, y - .06 - (y > 1 ? 0 : .12), .14, M.ink, lx, (y - .06) / 2 + .06, 1.0, rear, false).visible = y < 1;
  });
  // towers: one post, three arms (tools, agent to agent, checkout)
  TIER_X.forEach((x, idx) => {
    const g = new THREE.Group(); rear.add(g);
    box(.26, 5.65, .26, M.ink, x, 2.98, 1.95, g);
    box(.42, .14, .42, M.ink2, x, .22, 1.95, g);
    const arms = [], lamps = [];
    BELT_Y.forEach((by, ti) => {
      const piv = new THREE.Group(); piv.position.set(x, by + .42, 1.95); g.add(piv);
      const arm = box(1.0, .12, .14, M.ink, .5, 0, 0, piv);
      box(.16, .16, .16, M.blue, 1.0, 0, 0, piv, false);
      piv.rotation.y = REST;
      arms.push(piv);
      const lm = lampMat(); lamps.push(lm);
      const l = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, .1, 16), lm);
      l.rotation.x = Math.PI / 2; l.position.set(x, by + .95, 2.1); g.add(l);
    });
    towers.push({ x, arms, lamps, idx, g });
  });
  // belt banners for slide 5
  const names = [['TOOLS', 'MCP'], ['AGENT TO AGENT', 'A2A'], ['CHECKOUT', 'PAYMENTS']];
  BELT_Y.forEach((by, i) => {
    const mk = (on) => ctex(512, 100, (g, w, h) => {
      g.fillStyle = on ? '#2b4aa0' : '#fbfaf5'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#2b4aa0'; g.lineWidth = 6; g.setLineDash([16, 10]); g.strokeRect(5, 5, w - 10, h - 10);
      g.setLineDash([]); g.fillStyle = on ? '#f3f0e8' : '#191a1c'; g.font = `900 50px ${FD}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(names[i][0] + ' · ' + names[i][1], w / 2, h / 2 + 3);
    });
    const tOff = mk(false), tOn = mk(true);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.7, .53), new THREE.MeshBasicMaterial({ map: tOff }));
    m.position.set(-1.8, by + .95, 2.35);
    m.visible = false; rear.add(m);
    const l1 = box(.06, .7, .06, M.ink, -3.1, by + .35, 2.35, rear, false), l2 = box(.06, .7, .06, M.ink, -.5, by + .35, 2.35, rear, false);
    l1.visible = l2.visible = false;
    banners.push({ m, tOff, tOn, legs: [l1, l2] });
  });
  // printers at each end of the agent-to-agent tier
  printerA = makePrinter('MY CO.', 1.15); printerA.g.position.set(-6.45, 2.2, 1.0); rear.add(printerA.g);
  printerB = makePrinter('THEIR CO.', 1.15); printerB.g.position.set(6.45, 2.2, 1.0); rear.add(printerB.g);
  const mkS = (on) => ctex(512, 100, (g, w, h) => {
    g.fillStyle = on ? '#2b4aa0' : '#fbfaf5'; g.fillRect(0, 0, w, h);
    g.strokeStyle = on ? '#f3f0e8' : '#2b4aa0'; g.lineWidth = 6; g.setLineDash(on ? [] : [16, 10]); g.strokeRect(5, 5, w - 10, h - 10);
    g.setLineDash([]); g.fillStyle = on ? '#f3f0e8' : '#191a1c'; g.font = `900 52px ${FD}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(on ? 'YOUR AGENT · ONLINE' : 'YOUR AGENT · OFFLINE', w / 2, h / 2 + 3);
  });
  const sm = new THREE.Mesh(new THREE.PlaneGeometry(2.3, .45), new THREE.MeshBasicMaterial({ map: mkS(false) }));
  sm.position.set(-5.55, 4.0, 2.66); sm.visible = false; rear.add(sm);
  yoursSign = { m: sm, tOff: sm.material.map, tOn: mkS(true) };
  buildGate();
  buildBoard();
  buildChutes();
}
function paintSign() {
  if (!yoursSign) return;
  yoursSign.m.visible = cur === 10;
  yoursSign.m.material.map = built ? yoursSign.tOn : yoursSign.tOff; yoursSign.m.material.needsUpdate = true;
}
function buildChutes() {
  for (const [x0, x1] of [[-1.7, -.3], [3.7, 5.1]]) {
    const len = Math.hypot(x1 - x0, 1.9), ang = Math.atan2(-1.9, x1 - x0);
    const g = new THREE.Group(); g.position.set((x0 + x1) / 2, 1.25, .18); g.rotation.z = ang; rear.add(g);
    box(len, .06, .62, M.ink2, 0, 0, 0, g);
    box(len, .16, .05, M.ink, 0, .08, .3, g, false); box(len, .16, .05, M.ink, 0, .08, -.3, g, false);
  }
}

function makePrinter(label, sc) {
  const g = new THREE.Group();
  box(.84, .5, .64, M.ink, 0, .25, 0, g);
  box(.78, .1, .56, M.ink2, 0, .55, 0, g);
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(.2, .2, .5, 24), M.paper);
  roll.rotation.z = Math.PI / 2; roll.position.set(0, .8, -.2); roll.castShadow = true; g.add(roll);
  box(.6, .03, .06, M.black, 0, .61, .12, g, false);
  const lm = lampMat();
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, .06, 16), lm);
  lamp.rotation.x = Math.PI / 2; lamp.position.set(.3, .4, .33); g.add(lamp);
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(.52, .17), new THREE.MeshBasicMaterial({ map: ctex(256, 84, (c, w, h) => { c.fillStyle = '#f3f0e8'; c.fillRect(0, 0, w, h); c.fillStyle = '#191a1c'; c.font = `900 56px ${FD}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(label, w / 2, h / 2 + 3); }) }));
  plate.position.set(-.08, .27, .325); g.add(plate);
  const pm = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true });
  const pg = new THREE.PlaneGeometry(.62, 1); pg.translate(0, .5, 0);
  const paper = new THREE.Mesh(pg, pm);
  paper.position.set(0, .62, .14); paper.rotation.x = .2; paper.visible = false;
  g.add(paper);
  const slot = new THREE.Object3D(); slot.position.set(0, .64, .14); g.add(slot);
  g.scale.setScalar(sc);
  return { g, paper, lamp: lm, slot, label };
}
function receiptTex(lines, stamp) {
  return ctex(256, 400, (g, w, h) => {
    g.fillStyle = '#fbfaf5'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#191a1c'; g.font = `900 34px ${FD}`; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.fillText(lines[0].toUpperCase(), 16, 46);
    g.fillStyle = '#2b4aa0'; g.fillRect(16, 56, w - 32, 3);
    g.fillStyle = '#191a1c'; g.font = `500 15px ${FM}`;
    lines.slice(1).forEach((l, i) => g.fillText(l, 16, 92 + i * 24));
    if (stamp) {
      g.save(); g.translate(w - 70, h - 70); g.rotate(-.12);
      g.strokeStyle = '#2b4aa0'; g.lineWidth = 5; g.strokeRect(-52, -32, 104, 64);
      g.fillStyle = '#2b4aa0'; g.font = `900 46px ${FD}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(stamp, 0, 3);
      g.restore();
    }
    g.strokeStyle = '#d8d4c8'; g.setLineDash([6, 6]); g.lineWidth = 2; g.beginPath(); g.moveTo(0, h - 3); g.lineTo(w, h - 3); g.stroke();
  });
}
async function printReceipt(p, lines, stamp) {
  const t = receiptTex(lines, stamp);
  p.paper.material.map = t; p.paper.material.opacity = 1; p.paper.material.needsUpdate = true;
  p.paper.visible = true; p.paper.scale.set(1, .001, 1);
  setLamp(p.lamp, 1.8);
  await T(.7, k => { const kk = Math.max(k, .001); p.paper.scale.y = kk; t.repeat.y = kk; t.offset.y = 1 - kk; }, eIO);
  setLamp(p.lamp, .25);
}
function showPrinted(p, lines, stamp) {
  const t = receiptTex(lines, stamp);
  p.paper.material.map = t; p.paper.material.opacity = 1; p.paper.material.needsUpdate = true;
  t.repeat.y = 1; t.offset.y = 0; p.paper.scale.set(1, 1, 1); p.paper.visible = true;
}

/* gate (customs) */
function buildGate() {
  const g = new THREE.Group(); g.visible = false; rear.add(g);
  box(.24, 2.2, .24, M.ink, 1.0, 3.3, 1.95, g);
  const sgn = new THREE.Mesh(new THREE.PlaneGeometry(1.8, .5), new THREE.MeshBasicMaterial({ map: ctex(512, 142, (c, w, h) => { c.fillStyle = '#191a1c'; c.fillRect(0, 0, w, h); c.fillStyle = '#2b4aa0'; c.fillRect(0, h - 14, w, 14); c.fillStyle = '#f3f0e8'; c.font = `900 96px ${FD}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('CUSTOMS', w / 2, h / 2 - 6); }) }));
  sgn.position.set(1.25, 3.85, 2.1); g.add(sgn);
  const lm = lampMat(); const gl = new THREE.Mesh(new THREE.SphereGeometry(.09, 16, 16), lm); gl.position.set(.35, 3.85, 2.12); g.add(gl);
  box(.08, 2.0, .08, M.ink, 1.75, 3.3, 1.62, g, false); box(.08, 2.0, .08, M.ink, 1.75, 3.3, .4, g, false);
  box(.1, .1, 1.3, M.ink, 1.75, 4.25, 1.0, g, false);
  const stripe = ctex(64, 64, (c, w, h) => { c.fillStyle = '#f6f4ec'; c.fillRect(0, 0, w, h); c.fillStyle = '#191a1c'; for (let i = -2; i < 6; i++) { c.beginPath(); c.moveTo(i * 16, 0); c.lineTo(i * 16 + 8, 0); c.lineTo(i * 16 + 8 + 64, 64); c.lineTo(i * 16 + 64, 64); c.fill(); } });
  const sm = new THREE.MeshStandardMaterial({ map: stripe, roughness: .8 });
  const shutter = new THREE.Mesh(new THREE.BoxGeometry(.16, .9, 1.0), sm); shutter.position.set(1.75, 2.78, 1.0); shutter.castShadow = true; g.add(shutter);
  const pusher = box(1.2, .5, .1, M.ink2, .95, 2.65, 1.7, g);
  const pad = new THREE.Mesh(new THREE.BoxGeometry(1.5, .1, .85), new THREE.MeshStandardMaterial({ map: stripe, roughness: .9 }));
  pad.position.set(.95, 2.25, .07); pad.receiveShadow = true; g.add(pad);
  const hl = new THREE.Mesh(new THREE.PlaneGeometry(.9, .26), new THREE.MeshBasicMaterial({ map: ctex(256, 74, (c, w, h) => { c.fillStyle = '#f3f0e8'; c.fillRect(0, 0, w, h); c.fillStyle = '#191a1c'; c.font = `900 56px ${FD}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('HELD', w / 2, h / 2 + 3); }) }));
  hl.position.set(.95, 2.31, -.2); hl.rotation.x = -Math.PI / 2; g.add(hl);
  const beam = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.1), new THREE.MeshBasicMaterial({ color: BLUE, transparent: true, opacity: .32, side: THREE.DoubleSide }));
  beam.rotation.y = Math.PI / 2; beam.position.set(1.0, 2.85, 1.0); beam.visible = false; g.add(beam);
  gate = { g, shutter, pusher, lamp: lm, beam, shutY: [2.78, 3.78] };
}
const ledgerGrid = [];
function buildBoard() {
  const g = new THREE.Group(); g.position.set(4.7, 3.4, -.33); g.visible = false; rear.add(g);
  box(2.3, 1.3, .06, M.ink, 0, 0, 0, g, false);
  const lbl = new THREE.Mesh(new THREE.PlaneGeometry(2.1, .3), new THREE.MeshBasicMaterial({ map: ctex(512, 74, (c, w, h) => { c.fillStyle = '#191a1c'; c.fillRect(0, 0, w, h); c.fillStyle = '#f3f0e8'; c.font = `900 52px ${FD}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('KEPT PROMISES', w / 2, h / 2 + 3); }) }));
  lbl.position.set(0, .48, .035); g.add(lbl);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) {
    box(.26, .26, .02, mat(0x2b2c2f, .8), -.85 + c * .34, .14 - r * .34, .035, g, false);
    const mk = new THREE.Mesh(new THREE.BoxGeometry(.22, .22, .03), M.blue);
    mk.position.set(-.85 + c * .34, .14 - r * .34, .05); mk.scale.setScalar(.001); mk.visible = false; g.add(mk);
    ledgerGrid.push(mk);
  }
  board = { g, marks: 0 };
}
function setMarks(n, animate = false) {
  ledgerGrid.forEach((m, i) => {
    const on = i < n;
    if (on && !m.visible) { m.visible = true; if (animate) TA(.4, k => m.scale.setScalar(Math.max(.001, k < .7 ? k / .7 * 1.2 : 1.2 - (k - .7) / .3 * .2)), eO); else m.scale.setScalar(1); }
    if (!on) { m.visible = false; m.scale.setScalar(.001); }
  });
  board.marks = n;
}


/* static freight: parcels parked where an agent has not passed them yet, and the yard behind the block */
function crate(parent, x, y, z, sc, k, ry = 0) {
  const m = new THREE.Mesh(parcelGeo, sideMat(k));
  m.scale.setScalar(sc); m.position.set(x, y + .31 * sc, z); m.rotation.y = ry; m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}
function decor() {
  const spots = [
    [-5.6, .15, .05, 1, 0], [-2.2, .15, .05, 1, 1], [-2.2, .77, .05, .8, 2], [2.4, .15, .05, 1, 3], [5.8, .15, .05, 1, 4], [5.8, .77, .05, .85, 5],
    [-4.2, 2.2, .05, .9, 6], [2.9, 2.2, .05, 1, 7],
    [-4.5, 4.4, .05, 1, 8], [.4, 4.4, .05, .9, 9], [5.1, 4.4, .05, 1, 10],
  ];
  spots.forEach(([x, y, z, sc, k]) => crate(rear, x, y, z, sc, k, (k % 3 - 1) * .12));
  // yard behind the block (turn space, negative z is the freight side)
  const yard = [[-6.2, -4.6], [-5.2, -4.7], [-5.7, -5.5], [5.3, -4.6], [6.1, -5.2], [4.4, -5.6], [-1.6, -6.0], [-.7, -6.1]];
  yard.forEach(([x, z], i) => {
    box(1.0, .12, 1.0, M.ink2, x, .06, z, turn);
    crate(turn, x, .12, z, .9 + (i % 3) * .08, 11 + i, (i % 4) * .2);
    if (i % 3 === 0) crate(turn, x + .05, .12 + .62 * (.9 + (i % 3) * .08), z, .75, 20 + i, .3);
  });
  for (let i = 0; i < 9; i++) box(.5, .02, .09, M.ink, -6.4 + i * 1.6, .012, -3.6, turn, false);
  for (const x of [-7, 7]) { box(.14, .6, .14, M.ink, x, .3, -3.3, turn); box(.15, .12, .15, M.blue, x, .5, -3.3, turn, false); }
}

/* ---- street: humans and terminals ---- */
function buildStreet() {
  const hm = [mat(0x191a1c, .8), mat(0x2b4aa0, .7), mat(0xf6f4ec, .9), mat(0x3a3b3e, .8)];
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(.17, .55, 4, 10), hm[i % 4]); body.position.y = .62; body.castShadow = true; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.14, 14, 12), mat(0xe9d8be, .9)); head.position.y = 1.2; head.castShadow = true; g.add(head);
    g.position.set(-6 + i * 2.4, 0, 4.1 + (i % 3) * .5);
    turn.add(g);
    humans.push({ g, state: 'walk', door: i % 4, speed: .55 + (i % 3) * .18, timer: 0 });
  }
  // little terminals by each shop window (slide 3)
  for (let i = 0; i < 4; i++) {
    const w = BWd[i], cx = BX[i] + w / 2;
    const grp = new THREE.Group(); grp.position.set(cx - w * .17, 0, 3.45);
    box(.62, .62, .5, M.ink, 0, .31, 0, grp);
    const pr = makePrinter('', 0.82); pr.g.position.y = .62; grp.add(pr.g);
    grp.scale.setScalar(.001); turn.add(grp);
    streetPrinters.push({ grp, pr, i });
  }
  // ripple for clicks
  rip.m = new THREE.Mesh(new THREE.RingGeometry(.12, .16, 28), new THREE.MeshBasicMaterial({ color: BLUE, transparent: true, opacity: 0, side: THREE.DoubleSide }));
  turn.add(rip.m);
}
const rip = { m: null, t: 9 };
function clickRipple(x, y, z) { rip.m.position.set(x, y, z); rip.t = 0; }
const doorHuman = { };
function updateHumans(dt) {
  for (const h of humans) {
    const g = h.g;
    if (h.state === 'walk') {
      const tx = DOORX[h.door];
      const dx = tx - g.position.x;
      g.position.x += Math.sign(dx) * Math.min(Math.abs(dx), h.speed * dt);
      g.position.z += (4.0 - g.position.z) * Math.min(1, dt * 1.5);
      g.position.y = Math.abs(Math.sin(performance.now() / 180 * h.speed * 2)) * .05;
      if (Math.abs(dx) < .04) h.state = 'in';
    } else if (h.state === 'in') {
      g.position.z -= .65 * dt;
      if (g.position.z <= 2.95) {
        const bi = h.door;
        const pk = posters.find(p => p.bi === bi && p.state === 0 && p.grp.visible);
        if (cur === 2) clickRipple(pk ? pk.cx : DOORX[bi], pk ? pk.y : 1.1, pk ? 2.78 : 2.82);
        h.state = 'gone'; h.timer = 1.2 + Math.random() * 1.6; g.visible = false;
      }
    } else if (h.state === 'gone') {
      h.timer -= dt;
      if (h.timer <= 0) { h.door = (h.door + 1 + (Math.random() * 3 | 0)) % 4; g.position.set(DOORX[h.door], 0, 3.0); g.visible = true; h.state = 'out'; h.timer = 1.1; }
    } else if (h.state === 'out') {
      g.position.z += .8 * dt; h.timer -= dt;
      if (h.timer <= 0) { h.door = (h.door + 1 + (Math.random() * 3 | 0)) % 4; h.state = 'walk'; }
    }
  }
  if (rip.t < .8) {
    rip.t += dt;
    const k = clamp(rip.t / .8);
    rip.m.scale.setScalar(1 + k * 4); rip.m.material.opacity = (1 - k) * .9;
  } else rip.m.material.opacity = 0;
}

/* ---- district for the lattice (slide 8) ---- */
const NX = [-24.9, -8.3, 8.3, 24.9], NZ = [-17.25, -5.75, 5.75, 17.25];
const LAT = { nodes: [], edges: [] };
const LS = 1.7; // the lattice is drawn bigger so parcels read from far away
function ghostBlock(cx, cz) {
  const g = new THREE.Group(); g.position.set(cx, 0, cz); g.rotation.y = Math.PI; dist.add(g);
  const hh = [4.4, 4.9, 4.4, 4.7];
  for (let i = 0; i < 4; i++) {
    const w = BWd[i], x = BX[i] + w / 2;
    box(w - .04, hh[i], 2.2, mat(WALL[i], .95), x, hh[i] / 2, 1.5, g);
    box(w - .02, .14, 3.0, mat(0xcfcabd, .95), x, 2.13, -1.1, g);
    box(w - .02, .14, 3.0, mat(0xcfcabd, .95), x, 4.33, -1.1, g);
  }
  for (let i = 0; i <= 4; i++) box(.22, 4.4, .22, M.ink, i === 4 ? 6.7 : (i === 0 ? -6.7 : BX[i]), 2.2, -2.5, g);
  for (const y of [.3, 2.3, 4.5]) box(12.4, .1, .8, M.ink2, 0, y - .05, -1.0, g, false);
  return g;
}
function buildDistrict() {
  dist = new THREE.Group(); dist.visible = false; scene.add(dist);
  for (const cx of [-16.6, 0, 16.6]) for (const cz of [-11.5, 0, 11.5]) if (cx !== 0 || cz !== 0) ghostBlock(cx, cz);
  NX.forEach((x, i) => NZ.forEach((z, j) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(LS); dist.add(g);
    box(.34, 1.2, .34, M.ink, 0, .6, 0, g);
    box(.7, .08, .7, M.ink2, 0, .04, 0, g, false);
    const lm = lampMat();
    const l = new THREE.Mesh(new THREE.SphereGeometry(.12, 16, 16), lm); l.position.y = 1.3; g.add(l);
    const piv = new THREE.Group(); piv.position.y = .5; g.add(piv);
    box(.72, .1, .12, M.ink, .36, 0, 0, piv); box(.14, .14, .14, M.blue, .72, 0, 0, piv, false);
    LAT.nodes.push({ i, j, x, z, arm: piv, lamp: lm, busy: false, nb: [] });
  }));
  const node = (i, j) => LAT.nodes[i * 4 + j];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const n = node(i, j);
    if (i < 3) link(n, node(i + 1, j));
    if (j < 3) link(n, node(i, j + 1));
  }
  function link(a, b) {
    a.nb.push(b); b.nb.push(a);
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const bl = makeBelt(len, 1.3, dist, (a.x + b.x) / 2, .06, (a.z + b.z) / 2);
    if (a.z !== b.z) bl.mesh.rotation.y = Math.PI / 2;
    bl.mesh.castShadow = false;
    LAT.edges.push(bl);
  }
}

/* ---------------- parcels ---------------- */
const parcelGeo = new THREE.BoxGeometry(.62, .62, .62);
const sideCache = [];
function sideMat(k) {
  if (!sideCache[k]) {
    const t = ctex(128, 128, (g, w, h) => {
      g.fillStyle = '#f6f4ec'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#2b4aa0'; g.fillRect(0, 58, w, 18);
      g.fillStyle = '#191a1c';
      if (k % 4 === 0) g.fillRect(48, 14, 30, 30);
      else if (k % 4 === 1) { g.beginPath(); g.moveTo(63, 12); g.lineTo(82, 46); g.lineTo(44, 46); g.fill(); }
      else if (k % 4 === 2) { g.beginPath(); g.moveTo(63, 10); g.lineTo(82, 28); g.lineTo(63, 46); g.lineTo(44, 28); g.fill(); }
      else { g.beginPath(); g.arc(63, 28, 16, 0, 7); g.fill(); }
      g.fillStyle = '#6a6b6e'; g.font = `400 11px ${FM}`; g.fillText('RECEIPT', 8, 108);
    });
    sideCache[k] = new THREE.MeshStandardMaterial({ map: t, roughness: .9 });
  }
  return sideCache[k];
}
const stampCache = {};
function stampMat(name, sub) {
  const key = name + sub;
  if (!stampCache[key]) {
    const t = ctex(256, 256, (g, w, h) => {
      g.fillStyle = '#f6f4ec'; g.fillRect(0, 0, w, h);
      g.save(); g.translate(w / 2, h / 2 - 6); g.rotate(-.1);
      g.strokeStyle = '#2b4aa0'; g.lineWidth = 9; g.strokeRect(-100, -62, 200, 124);
      g.fillStyle = '#2b4aa0'; g.font = `900 ${name.length > 3 ? 80 : 104}px ${FD}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(name, 0, -8);
      g.font = `500 17px ${FM}`; g.fillText(sub, 0, 40);
      g.restore();
    });
    stampCache[key] = new THREE.MeshStandardMaterial({ map: t, roughness: .9 });
  }
  return stampCache[key];
}
let parcelN = 0;
function makeParcel(stamp, sub, tag) {
  const g = new THREE.Group();
  const k = parcelN++;
  const s = sideMat(k);
  const m = new THREE.Mesh(parcelGeo, [s, s, stampMat(stamp, sub), s, s, s]);
  m.position.y = .31; m.castShadow = true; m.receiveShadow = true; g.add(m);
  if (tag) {
    const tg = new THREE.Mesh(new THREE.PlaneGeometry(.38, .24), new THREE.MeshBasicMaterial({ map: ctex(152, 96, (c, w, h) => { c.fillStyle = '#2b4aa0'; c.fillRect(0, 0, w, h); c.fillStyle = '#f3f0e8'; c.font = `900 50px ${FD}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('ID ' + tag, w / 2, h / 2 + 3); }) }));
    tg.position.set(0, .4, .32); g.add(tg);
  }
  rear.add(g); actors.add(g);
  return g;
}
function clearActors() {
  for (const a of actors) a.parent && a.parent.remove(a);
  actors.clear();
}
function moveTo(obj, v, dur, ease = eIO) {
  const a = obj.position.clone();
  return T(dur, k => obj.position.lerpVectors(a, v, k), ease);
}
function scroll(tier, dx) { if (belts[tier]) belts[tier].tex.offset.x -= dx / .5; }
function slideTo(parcel, x, tier) {
  const x0 = parcel.position.x, d = Math.abs(x - x0);
  if (d < .01) return Promise.resolve();
  return T(d / 4.6, k => { const nx = lerp(x0, x, k); scroll(tier, nx - parcel.position.x); parcel.position.x = nx; }, k => k);
}

/* the law, belt version: the parcel waits; the agent winds up, sweeps, and only then does it move */
const REST = Math.PI / 2;
async function pass(parcel, ti, tier, dir, toX) {
  const st = towers[ti], arm = st.arms[tier], xs = st.x;
  const a0 = REST + .65 * dir, a1 = REST - .65 * dir;
  const cur0 = arm.rotation.y;
  setLamp(st.lamps[tier], 1.8);
  await T(.2, k => { arm.rotation.y = lerp(cur0, a0, k); }, eO);
  await T(.4, k => {
    const th = lerp(a0, a1, k); arm.rotation.y = th;
    const px = xs + Math.cos(th) - dir * .36;
    if ((px - parcel.position.x) * dir > 0) { scroll(tier, px - parcel.position.x); parcel.position.x = px; }
  }, eIO);
  const back = T(.36, k => { arm.rotation.y = lerp(a1, REST, k); }, eO);
  const slide = slideTo(parcel, toX, tier);
  await Promise.all([back, slide]);
  setLamp(st.lamps[tier], .25);
}
const waitX = (ti, dir) => towers[ti].x - dir * .85;

/* the law, lattice version: arm sweeps around the hub carrying the parcel to the next belt */
const angOf = (dx, dz) => Math.atan2(-dz, dx);
async function sweepPass(node, parcel, inD, outD) {
  const a0 = angOf(-inD.x, -inD.z), a1 = angOf(outD.x, outD.z);
  let d = a1 - a0; while (d > Math.PI) d -= Math.PI * 2; while (d <= -Math.PI) d += Math.PI * 2;
  if (Math.abs(Math.abs(d) - Math.PI) < .01) d = Math.PI;
  const cur0 = node.arm.rotation.y;
  setLamp(node.lamp, 1.8);
  await T(.22, k => { node.arm.rotation.y = lerp(cur0, a0 - Math.sign(d) * .35, k); }, eO);
  await T(.8, k => {
    const th = lerp(a0 - Math.sign(d) * .35, a0 + d, k);
    node.arm.rotation.y = th;
    if (k > .18) { const kk = clamp((th - (a0 - Math.sign(d) * .35)) / (d + Math.sign(d) * .35)); const tt = a0 + d * kk; parcel.position.set(node.x + 1.03 * LS * Math.cos(tt), parcel.position.y, node.z - 1.03 * LS * Math.sin(tt)); }
  }, eIO);
  setLamp(node.lamp, .25);
}

/* ---------------- camera, resize ---------------- */
const camPos = new V(5, 8.5, 21.5), camTgt = new V(0, 2.3, 1), goal = { p: new V(5, 8.5, 21.5), t: new V(0, 2.3, 1), s: 0 };
let camShift = 0, stageScale = 1;
function setCam(n) {
  const c = CAMS[n]; if (!c) return;
  const aspect = viz.clientWidth / Math.max(1, viz.clientHeight);
  const f = Math.max(1, 1.14 / aspect);
  const tgt = new V(...c.t), pos = new V(...c.p);
  goal.t.copy(tgt); goal.p.copy(tgt).add(pos.sub(tgt).multiplyScalar(f)); goal.s = MOBILE.matches ? 0 : c.s;
}
function fit() {
  const mob = MOBILE.matches;
  if (mob) { stage.style.transform = 'none'; stageScale = 1; }
  else { stageScale = Math.min(innerWidth / 1440, innerHeight / 810); stage.style.transform = `translate(-50%,-50%) scale(${stageScale})`; }
  const w = viz.clientWidth, h = viz.clientHeight;
  if (!w || !h) return;
  const px = Math.min(Math.min(devicePixelRatio, 1.5) * stageScale, 2);
  renderer.setPixelRatio(1);
  renderer.setSize(Math.round(w * px), Math.round(h * px), false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  setCam(cur);
}

/* ---------------- state ---------------- */
let cur = 1, step = 0, prev = 1, yawTok = 0, built = false;
let sending = false, selTier = 0, clickResolver = null;
const hold = { until: 0 };

function wantYaw(n, dir) {
  const back = SL[n - 1].side === 'b';
  const c = turn.rotation.y;
  const base = back ? Math.PI : 0;
  let k = Math.round((c - base) / (Math.PI * 2));
  const cands = [k - 1, k, k + 1].map(i => base + i * Math.PI * 2);
  if (dir >= 0) return cands.filter(v => v >= c - .01).sort((a, b) => a - b)[0];
  return cands.filter(v => v <= c + .01).sort((a, b) => b - a)[0];
}
function turnTo(y) {
  const my = ++yawTok, y0 = turn.rotation.y;
  if (Math.abs(y - y0) < .001) return;
  TA(Math.abs(y - y0) / Math.PI * 1.9, k => { if (my === yawTok) turn.rotation.y = lerp(y0, y, k); }, eIO);
}

/* posters: 0 hung, 1 folding/falling, 2 down */
function posterTo(p, want, animate) {
  if (want === 0) {
    p.state = 0; p.fall = false;
    p.grp.visible = true; p.grp.position.copy(p.home); p.grp.rotation.set(0, 0, 0); p.pivot.rotation.x = 0;
    return;
  }
  if (p.state === 2) return;
  if (!animate) { landPoster(p); return; }
  if (p.state === 1) return;
  p.state = 1;
  const pg = p.pg;
  (async () => {
    try {
      await TA(.7, k => { p.pivot.rotation.x = -Math.PI * k * .985; }, eIO);
      const g0 = p.grp.position.clone(), z0 = g0.z;
      const gy = .24 + pg.h / 4 * .1;
      const y1 = .22 + .02;
      const dist1 = g0.y - y1;
      const tf = Math.sqrt(2 * dist1 / 16);
      await TA(tf, k => {
        p.grp.position.y = g0.y - dist1 * k * k;
        p.grp.position.z = z0 + 1.0 * k;
        p.grp.rotation.z = .5 * k * (p.bi % 2 ? -1 : 1);
        p.grp.rotation.x = .5 * k;
      }, k => k);
      await TA(.3, k => { p.grp.rotation.x = lerp(.5, Math.PI / 2, k); p.grp.rotation.z *= .85; p.grp.position.y = y1 + (1 - k) * .0; }, eO);
      p.state = 2;
    } catch (e) { /* ignore */ }
  })();
}
function landPoster(p) {
  p.state = 2; p.grp.visible = true; p.pivot.rotation.x = -Math.PI * .985;
  p.grp.position.set(p.home.x + (p.bi - 1) * .25, .245, p.home.z + 1.0);
  p.grp.rotation.set(Math.PI / 2, 0, (p.bi % 2 ? -1 : 1) * .35);
}
function syncPosters(n, st, animate) {
  const gone = n > 6 ? 3 : (n === 6 ? st : 0);
  posters.forEach((p, i) => { posterTo(p, i < gone ? 2 : 0, animate && n === 6); });
}

/* printers on the street, slide 3+ */
const STREET_LINES = ['PRICES', 'POLICY', 'IN STOCK'];
function streetLines(i) { return ['AGENT: ' + SHOP[i], '', 'prices   on file', 'policy   on file', 'in stock today', '', 'ask me']; }
function syncStreet(n, animateFrom) {
  streetPrinters.forEach((s, i) => {
    if (n >= 3) {
      if (animateFrom) {
        s.grp.scale.setScalar(.001);
        TA(.45, k => s.grp.scale.setScalar(Math.max(.001, k)), eO).then(async () => { await printStreet(s, i); }).catch(() => {});
      } else {
        s.grp.scale.setScalar(1); showPrinted(s.pr, streetLines(i), 'AGENT');
      }
    } else { s.grp.scale.setScalar(.001); s.pr.paper.visible = false; }
  });
}
async function printStreet(s, i) {
  const t = receiptTex(streetLines(i), 'AGENT');
  s.pr.paper.material.map = t; s.pr.paper.material.opacity = 1; s.pr.paper.material.needsUpdate = true;
  s.pr.paper.visible = true; s.pr.paper.scale.set(1, .001, 1);
  await TA(.9, k => { const kk = Math.max(k, .001); s.pr.paper.scale.y = kk; t.repeat.y = kk; t.offset.y = 1 - kk; }, eIO);
}

/* ---------------- corridor reset (idempotent) ---------------- */
function resetCorridor() {
  towers.forEach(t => { t.arms.forEach(a => { a.rotation.y = REST; }); t.lamps.forEach(l => setLamp(l, .25)); });
  [printerA, printerB].forEach(p => { p.paper.visible = false; setLamp(p.lamp, .25); });
  belts.forEach(b => { b.tex.offset.x = 0; });
  gate.shutter.position.y = gate.shutY[0]; gate.pusher.position.z = 1.7; gate.beam.visible = false; setLamp(gate.lamp, .25);
  LAT.nodes.forEach(n => { n.busy = false; n.arm.rotation.y = 0; setLamp(n.lamp, .25); });
  banners.forEach((b, i) => { b.m.material.map = (cur === 5 && i === selTier) ? b.tOn : b.tOff; b.m.material.needsUpdate = true; });
  paintSign();
}

/* ---------------- scenarios ---------------- */
const tape = $('#tape');
function addCard(i) {
  const m = MSG[i];
  const d = document.createElement('div');
  d.className = 'rc';
  d.innerHTML = `<span class="stp">${m.stamp}</span><b>${m.tag}</b><i>${m.who}</i><p>${m.lines.slice(1).join('\n')}</p>`;
  const hint = tape.querySelector('.hint'); if (hint) hint.remove();
  tape.appendChild(d);
  requestAnimationFrame(() => d.classList.add('in'));
  setStatus(m.note);
}
function resetTape() {
  tape.innerHTML = '<div class="hint">Receipts print here, one per message.</div>';
}
function printerSlotPos(p) {
  const v = new V(); p.slot.getWorldPosition(v); return rear.worldToLocal(v);
}
async function intake(parcel, dir, tier) {
  await slideTo(parcel, parcel.position.x + dir * .3, tier);
  await T(.35, k => { parcel.scale.set(1 - k * .3, 1 - k, 1 - k * .3); parcel.position.x += dir * .004; }, eI);
  actors.delete(parcel); parcel.parent && parcel.parent.remove(parcel);
}
async function exchange() {
  resetCorridor(); clearActors(); resetTape();
  for (let i = 0; i < 4; i++) {
    const m = MSG[i], fromA = m.from === 'A', P = fromA ? printerA : printerB, dir = fromA ? 1 : -1;
    if (RM && i > 0) { setAct('Next message'); await new Promise(r => { clickResolver = r; }); }
    setAct('Printing…', true);
    await printReceipt(P, m.lines, m.stamp);
    addCard(i);
    const parcel = makeParcel(m.stamp, m.sub);
    const sp = printerSlotPos(P);
    parcel.position.copy(sp); parcel.scale.setScalar(.01);
    await T(.4, k => { P.paper.scale.y = lerp(1, .3, k); P.paper.material.opacity = 1 - k; parcel.scale.setScalar(Math.max(.01, k)); }, eO);
    P.paper.visible = false;
    const sx = fromA ? -5.95 : 5.95;
    await moveTo(parcel, new V(sx, BELT_Y[1], 1.0), .5, eO);
    const order = fromA ? [0, 1, 2, 3, 4] : [4, 3, 2, 1, 0];
    for (let j = 0; j < 5; j++) {
      const ti = order[j];
      await slideTo(parcel, waitX(ti, dir), 1);
      const nextX = j < 4 ? waitX(order[j + 1], dir) : (fromA ? 5.95 : -5.95);
      await pass(parcel, ti, 1, dir, nextX);
    }
    await intake(parcel, dir, 1);
    await W(.25);
  }
  setStatus('Four messages, four stamps, no website. Scripted example.');
}
const doExchange = safe(async () => {
  if (sending) return;
  sending = true;
  try { await exchange(); setAct('Send again'); } finally { sending = false; }
});

/* slide 5: tiers */
function selectTier(i, play) {
  selTier = i;
  $$('.chip').forEach(c => c.setAttribute('aria-pressed', String(+c.dataset.tier === i)));
  const rows = $('#rows'); rows.innerHTML = '';
  LEDGER[i].forEach(([d, t, s, y]) => {
    const li = document.createElement('li');
    li.innerHTML = `<time>${d}</time><span>${t}${y ? '<span class="y26">2026</span>' : ''}</span><button class="ref" data-src="${s}" aria-label="Source ${s}">${s}</button>`;
    rows.appendChild(li);
  });
  banners.forEach((b, k) => { b.m.material.map = k === i ? b.tOn : b.tOff; b.m.material.needsUpdate = true; });
  setStatus('');
  if (play) restart(() => tierRun(i));
}
const tierRun = safe(async (i) => {
  const dir = 1, stamp = ['MCP', 'A2A', 'PAY'][i], sub = ['TOOLS', 'AGENT TO AGENT', 'CHECKOUT'][i];
  const parcel = makeParcel(stamp, sub);
  parcel.position.set(waitX(0, 1), BELT_Y[i], 1.0); parcel.scale.setScalar(.01);
  await T(.4, k => parcel.scale.setScalar(Math.max(.01, k)), eO);
  for (let j = 0; j < 5; j++) {
    const nextX = j < 4 ? waitX(j + 1, dir) : 5.95;
    if (j > 0) await slideTo(parcel, waitX(j, dir), i);
    await pass(parcel, j, i, dir, nextX);
  }
  await intake(parcel, 1, i);
});

/* slide 6: pages fold away */
const LOG6 = [
  ['Forms', 'Replaced by a request an agent can send.'],
  ['Search results', 'Replaced by one answer from the agent that knows.'],
  ['Contact sales', 'Replaced by an agent that answers now.'],
];
function syncLog6() {
  const el = $('#log6'); el.innerHTML = '';
  LOG6.forEach(([a, b], i) => {
    if (cur === 6 ? i >= step : false) return;
    const d = document.createElement('div'); d.className = 'rc in';
    d.innerHTML = `<span class="stp">GONE</span><b>${a}</b><p>${b}</p>`; el.appendChild(d);
  });
}

/* slide 7: stations */
const LOG7 = [
  ['Negotiation', 'Two agents trade a parcel until the terms agree.'],
  ['Verification', 'A gate checks who is sending and what it may do.'],
  ['Reputation', 'Each kept promise leaves a mark that others can read.'],
];
function syncLog7() {
  const el = $('#log7'); el.innerHTML = '';
  LOG7.forEach(([a, b], i) => {
    if (i >= step) return;
    const d = document.createElement('div'); d.className = 'rc in';
    d.innerHTML = `<b>${a}</b><p>${b}</p>`; el.appendChild(d);
  });
}
function syncStations(n, st) {
  const gateOn = n === 9 || (n === 7 && st >= 2);
  gate.g.visible = gateOn;
  const boardOn = n === 7 ? st >= 3 : (n >= 8 && n !== 8);
  board.g.visible = boardOn;
  if (boardOn) setMarks(n === 7 ? (st >= 3 ? 0 : 0) : 3);
  else setMarks(0);
  banners.forEach(b => { b.m.visible = n === 5; b.legs.forEach(l => { l.visible = n === 5; }); });
}
const runStep7 = safe(async (s) => {
  resetCorridor(); clearActors();
  const mk = (tag) => { const p = makeParcel('A2A', 'AGENT TO AGENT', tag); return p; };
  if (s === 1) {
    const p = mk(); p.position.set(waitX(1, 1), BELT_Y[1], 1.0); p.scale.setScalar(.01);
    await T(.4, k => p.scale.setScalar(Math.max(.01, k)), eO);
    await pass(p, 1, 1, 1, waitX(2, 1));
    await pass(p, 2, 1, 1, waitX(2, -1));
    await pass(p, 2, 1, -1, waitX(1, -1));
    await pass(p, 1, 1, -1, waitX(1, 1));
    await pass(p, 1, 1, 1, waitX(2, 1));
    await T(.5, k => { setLamp(towers[1].lamps[1], .25 + 1.6 * Math.sin(k * Math.PI)); setLamp(towers[2].lamps[1], .25 + 1.6 * Math.sin(k * Math.PI)); });
  } else if (s === 2) {
    const p = mk('A'); p.position.set(waitX(2, 1), BELT_Y[1], 1.0); p.scale.setScalar(.01);
    await T(.4, k => p.scale.setScalar(Math.max(.01, k)), eO);
    await pass(p, 2, 1, 1, 1.25);
    gate.beam.visible = true;
    await T(.7, k => { gate.beam.position.x = lerp(.7, 1.6, k); setLamp(gate.lamp, 1.8); }, eIO);
    gate.beam.visible = false; setLamp(gate.lamp, .25);
    await T(.45, k => { gate.shutter.position.y = lerp(gate.shutY[0], gate.shutY[1], k); }, eO);
    await slideTo(p, waitX(3, 1), 1);
    await pass(p, 3, 1, 1, 4.4);
    await T(.4, k => { gate.shutter.position.y = lerp(gate.shutY[1], gate.shutY[0], k); }, eI);
    await intake(p, 1, 1);
  } else if (s === 3) {
    for (let n = 0; n < 3; n++) {
      const p = mk(); p.position.set(waitX(3, 1), BELT_Y[1], 1.0); p.scale.setScalar(.01);
      await T(.3, k => p.scale.setScalar(Math.max(.01, k)), eO);
      await pass(p, 3, 1, 1, waitX(4, 1));
      await pass(p, 4, 1, 1, 4.6);
      await T(.25, k => p.position.x = lerp(4.6, 4.5, k));
      actors.delete(p); p.parent.remove(p);
      setMarks(n + 1, true);
      await W(.3);
    }
  }
});

/* slide 8: lattice */
const runLattice = safe(async () => {
  resetCorridor(); clearActors();
  const walkers = [];
  const spawn = async (idx) => {
    const n0 = LAT.nodes[(idx * 5) % 16];
    let prev = null, node = n0;
    const p = makeParcel(['MCP', 'A2A', 'AP2'][idx % 3], ['TOOLS', 'AGENT TO AGENT', 'CHECKOUT'][idx % 3]);
    p.parent.remove(p); dist.add(p);
    let inD = new V(1, 0, 0);
    { const o = node.nb[(idx) % node.nb.length]; inD = new V(node.x - o.x, 0, node.z - o.z).normalize(); prev = o; }
    p.position.set(node.x - inD.x * 1.03 * LS, .1, node.z - inD.z * 1.03 * LS); p.scale.setScalar(.01);
    await T(.35, k => p.scale.setScalar(Math.max(.01, k) * LS), eO);
    while (true) {
      while (node.busy) await W(.15);
      node.busy = true;
      const opts = node.nb.filter(o => o !== prev);
      const nxt = opts[(Math.random() * opts.length) | 0] || node.nb[0];
      const outD = new V(nxt.x - node.x, 0, nxt.z - node.z).normalize();
      await sweepPass(node, p, inD, outD);
      node.busy = false;
      const len = Math.hypot(nxt.x - node.x, nxt.z - node.z) - 2.06 * LS;
      const sx = p.position.x, sz = p.position.z;
      await T(len / 4.6, k => { p.position.x = sx + outD.x * len * k; p.position.z = sz + outD.z * len * k; }, k => k);
      prev = node; node = nxt; inD = outD;
    }
  };
  const guarded = safe(spawn);
  for (let i = 0; i < 9; i++) { walkers.push(guarded(i)); await W(.55); }
  await Promise.all(walkers);
});

/* slide 9: the gate */
const stk = $('#stk9');
function resetStk() { stk.innerHTML = ''; }
function ticket(i, bad, head, why, stamp) {
  const el = document.createElement('div');
  el.className = 'rc' + (bad ? ' bad' : '');
  el.innerHTML = `<span class="stp">${stamp}</span><b>${head}</b><i>parcel ${i + 1}</i><p>${why}</p>`;
  stk.appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));
}
const runGate = safe(async () => {
  if (sending) return; sending = true;
  try {
    resetCorridor(); clearActors(); resetStk();
    setAct('Running…', true);
    const specs = [
      { job: 'READ', tag: 'READ', ok: true, wx: 0.9, head: 'Passed', why: 'Signed identity, and the credential covers the job.', stamp: 'OK' },
      { job: 'READ', tag: null, ok: false, wx: 0.55, head: 'Held', why: 'No credential. The agent could be anyone.', stamp: 'STOP' },
      { job: 'PAY', tag: 'READ', ok: false, wx: 1.25, head: 'Held', why: 'Valid identity, but its credential allows READ, not PAY.', stamp: 'STOP' },
    ];
    for (let i = 0; i < 3; i++) {
      const s = specs[i];
      const p = makeParcel(s.job, 'JOB', s.tag);
      p.position.set(waitX(2, 1), BELT_Y[1], 1.0); p.scale.setScalar(.01);
      await T(.35, k => p.scale.setScalar(Math.max(.01, k)), eO);
      await pass(p, 2, 1, 1, s.wx);
      gate.beam.visible = true;
      await T(.6, k => { gate.beam.position.x = lerp(.45, 1.5, k); setLamp(gate.lamp, 1.8); }, eIO);
      gate.beam.visible = false; setLamp(gate.lamp, .25);
      if (s.ok) {
        ticket(i, false, s.head, s.why, s.stamp);
        await T(.4, k => { gate.shutter.position.y = lerp(gate.shutY[0], gate.shutY[1], k); }, eO);
        await slideTo(p, waitX(3, 1), 1);
        await pass(p, 3, 1, 1, 4.4);
        await T(.35, k => { gate.shutter.position.y = lerp(gate.shutY[1], gate.shutY[0], k); }, eI);
        await intake(p, 1, 1);
      } else {
        ticket(i, true, s.head, s.why, s.stamp);
        for (let b = 0; b < 3; b++) { setLamp(gate.lamp, b % 2 ? .2 : 2); await W(.14); }
        setLamp(gate.lamp, .25);
        gate.pusher.position.x = s.wx;
        await T(.5, k => { gate.pusher.position.z = lerp(1.7, .36, k); p.position.z = Math.min(p.position.z, gate.pusher.position.z - .36); }, eIO);
        p.position.y = BELT_Y[1] - .0;
        const stop = new THREE.Mesh(new THREE.PlaneGeometry(.5, .22), new THREE.MeshBasicMaterial({ map: ctex(256, 112, (c, w, h) => { c.fillStyle = '#2b4aa0'; c.fillRect(0, 0, w, h); c.strokeStyle = '#f3f0e8'; c.lineWidth = 6; c.strokeRect(8, 8, w - 16, h - 16); c.fillStyle = '#f3f0e8'; c.font = `900 80px ${FD}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('STOP', w / 2, h / 2 + 4); }) }));
        stop.position.set(s.wx < 1 ? -.16 : .16, .8, .34); p.add(stop);
        await T(.4, k => { gate.pusher.position.z = lerp(.36, 1.7, k); }, eO);
      }
      await W(.25);
    }
    setStatus('One parcel crossed. Two stopped at the gate.');
    setAct('Run it again');
  } finally { sending = false; }
});

/* slide 10: unattended, then built */
const runS10 = safe(async () => {
  resetCorridor(); clearActors();
  const log = $('#log10');
  const say = (h, t) => { log.innerHTML = `<div class="rc in"><b>${h}</b><p>${t}</p></div>`; };
  setLamp(towers[0].lamps[1], built ? 1.2 : 0);
  say(built ? 'Your agent is online' : 'No agent at your door', built ? 'Parcels for you now stop here and a receipt prints.' : 'Parcels for you arrive. Nobody of yours passes them on.');
  let n = 0;
  while (true) {
    n++;
    const p = makeParcel(built ? 'A2A' : 'A2A', 'AGENT TO AGENT');
    const sp = printerSlotPos(printerB);
    p.position.copy(sp); p.scale.setScalar(.01);
    await T(.35, k => p.scale.setScalar(Math.max(.01, k)), eO);
    await moveTo(p, new V(5.95, BELT_Y[1], 1.0), .5, eO);
    const order = [4, 3, 2, 1];
    for (let j = 0; j < 4; j++) {
      await slideTo(p, waitX(order[j], -1), 1);
      const nx = j < 3 ? waitX(order[j + 1], -1) : towers[0].x + .85;
      await pass(p, order[j], 1, -1, nx);
    }
    if (built) {
      setLamp(towers[0].lamps[1], 1.8);
      await slideTo(p, towers[0].x + .85, 1);
      await pass(p, 0, 1, -1, -6.0);
      await intake(p, -1, 1);
      await printReceipt(printerA, ['05 RECEIVED', 'order accepted', 'by    my agent', 'decided by  me'], 'MINE');
      await W(.9); printerA.paper.visible = false;
    } else {
      await W(.9);
      say('Their agent decides', 'The parcel sits at your door, so someone else\'s agent sends it elsewhere.');
      await slideTo(p, waitX(1, 1), 1);
      await pass(p, 1, 1, 1, 5.9);
      await intake(p, 1, 1);
      await W(.4);
    }
  }
});

/* ---------------- UI ---------------- */
const slides = $$('.slide');
const act = $('#act'), actl = $('#actl'), statusEl = $('#status');
function setAct(txt, dis = false) { actl.textContent = txt; act.disabled = !!dis; }
function setStatus(t) { statusEl.textContent = t || ''; }
const pad2 = n => String(n).padStart(2, '0');

function restart(fn) { run.tok++; clearActors(); resetCorridor(); fn(); }

function applySlide(n, dir = 1, fromHash = false) {
  prev = cur; cur = n;
  const meta = SL[n - 1];
  step = meta.steps ? (dir < 0 && prev > n ? meta.steps : 0) : 0;
  run.tok++; sending = false; clickResolver = null; clearActors(); resetCorridor();
  hold.until = performance.now() + 2500;
  // text
  slides.forEach(s => s.classList.toggle('on', +s.dataset.n === n));
  $$('.ov').forEach(o => o.classList.toggle('on', +o.dataset.s === n));
  $('#cover').classList.toggle('off', n > 1);
  const c = `PARCEL ${pad2(n)} OF ${TOTAL}`;
  $('#ctr').textContent = c; $('#nvc').textContent = c;
  $('#route').textContent = 'ROUTE: ' + meta.r;
  $('#nb-prev').disabled = n === 1; $('#nb-next').disabled = n === TOTAL;
  setAct(n === 6 && step >= 3 ? 'Next parcel' : n === 7 && step >= 3 ? 'Next parcel' : meta.act);
  setStatus('');
  if (location.hash !== '#' + n) history.replaceState(null, '', '#' + n);
  document.title = n === 1 ? 'The internet is getting a second user' : $('.slide.on .hd').textContent.trim() + ' | Parcel ' + n;
  // 3D state
  turnTo(wantYaw(n, dir));
  setCam(n);
  syncPosters(n, step, false);
  syncStreet(n, n === 3 && prev < 3);
  syncStations(n, step);
  humansOn = n <= 3 || n === 6;
  dist.visible = n === 8;
  if (n === 4) { resetTape(); setStatus('Press Send. Message 1 of 4 waits at my printer.'); }
  if (n === 5) { selectTier(selTier, false); }
  if (n === 6) syncLog6();
  if (n === 7) { syncLog7(); if (step >= 3) setMarks(3); }
  if (n === 8) runLattice();
  if (n === 9) { resetStk(); }
  if (n === 10) { built = false; paintSign(); $('#log10').innerHTML = ''; runS10(); }
  if (n === 4 || n === 5 || n === 9) { /* idle until the viewer acts */ }
  syncRun();
}
let humansOn = true;

function next() {
  const meta = SL[cur - 1];
  if (meta.steps && step < meta.steps) { stepTo(step + 1); return; }
  if (cur < TOTAL) applySlide(cur + 1, 1);
}
function prevSlide() {
  const meta = SL[cur - 1];
  if (meta.steps && step > 0) { stepTo(step - 1); return; }
  if (cur > 1) applySlide(cur - 1, -1);
}
function stepTo(s) {
  const forward = s > step;
  step = s;
  const meta = SL[cur - 1];
  setAct(step >= meta.steps ? 'Next parcel' : meta.act);
  if (cur === 6) { syncPosters(6, step, forward); syncLog6(); setStatus(forward ? '' : ''); }
  if (cur === 7) {
    run.tok++; clearActors(); resetCorridor();
    syncStations(7, step); syncLog7();
    if (forward) runStep7(step);
    else if (step >= 3) setMarks(0);
  }
}
function goto(n) { n = clamp(n, 1, TOTAL); if (n !== cur) applySlide(n, n > cur ? 1 : -1); }

function onAct() {
  if (clickResolver) { const r = clickResolver; clickResolver = null; r(); return; }
  if (cur === 4) { if (!sending) doExchange(); return; }
  if (cur === 9) { runGate(); return; }
  if (cur === 10) {
    if (!built) { built = true; run.tok++; clearActors(); resetCorridor(); runS10(); setAct('Start over'); } else goto(1);
    return;
  }
  next();
}
act.addEventListener('click', onAct);
$('#nb-next').addEventListener('click', next);
$('#nb-prev').addEventListener('click', prevSlide);
addEventListener('keydown', e => {
  if (e.target.closest && e.target.closest('#src') && e.key !== 'Escape') return;
  if (e.key === 'Escape') { closeSrc(); return; }
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') { e.preventDefault(); next(); }
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); prevSlide(); }
  else if (e.key === 'PageDown') { e.preventDefault(); goto(cur + 1); }
  else if (e.key === 'PageUp') { e.preventDefault(); goto(cur - 1); }
  else if (e.key === 'Home') goto(1);
  else if (e.key === 'End') goto(TOTAL);
});
addEventListener('hashchange', () => { const n = parseInt(location.hash.slice(1), 10); if (n && n !== cur) goto(n); });
// swipe
let sx0 = null, sy0 = 0;
document.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') { sx0 = e.clientX; sy0 = e.clientY; } });
document.addEventListener('pointerup', e => {
  if (sx0 === null) return;
  const dx = e.clientX - sx0, dy = e.clientY - sy0; sx0 = null;
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) { dx < 0 ? next() : prevSlide(); }
});
// chips
$$('.chip').forEach(c => c.addEventListener('click', () => selectTier(+c.dataset.tier, true)));

// sources
const srcPanel = $('#src');
(function buildSources() {
  const ol = $('#srclist');
  SOURCES.forEach((s, i) => {
    const li = document.createElement('li'); li.id = 'src-' + (i + 1);
    li.innerHTML = `<b>${i + 1}. ${s.t}</b><span>${s.p}, ${s.d}</span>${s.u ? `<br><a href="${s.u}" target="_blank" rel="noopener">${s.u}</a>` : ''}`;
    ol.appendChild(li);
  });
})();
function openSrc(n) {
  srcPanel.classList.add('on');
  $$('#srclist li').forEach(l => l.classList.remove('hl'));
  if (n) { const li = $('#src-' + n); if (li) { li.classList.add('hl'); li.scrollIntoView({ block: 'center' }); } }
  $('#src-x').focus();
}
function closeSrc() { srcPanel.classList.remove('on'); }
$('#nb-src').addEventListener('click', () => openSrc());
$('#src-x').addEventListener('click', closeSrc);
document.addEventListener('click', e => {
  const r = e.target.closest && e.target.closest('.ref'); if (r) openSrc(+r.dataset.src);
});

/* printer A is a hotspot on slide 4 */
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
function hot(e) {
  if (cur !== 4 || sending) return false;
  const r = glc.getBoundingClientRect();
  mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(mouse, camera);
  return ray.intersectObject(printerA.g, true).length > 0;
}
glc.addEventListener('pointerdown', e => { if (e.pointerType !== 'touch' && hot(e)) doExchange(); });
glc.addEventListener('pointermove', e => { glc.style.cursor = hot(e) ? 'pointer' : ''; });

/* ---------------- loop ---------------- */
let running = false, last = 0, rid = 0;
function shouldRun() { return !document.hidden && (cur > 1 || performance.now() < hold.until); }
function syncRun() {
  if (shouldRun() && !running) { running = true; last = performance.now(); rid = requestAnimationFrame(frame); }
}
function frame(now) {
  if (!shouldRun()) { running = false; return; }
  rid = requestAnimationFrame(frame);
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  stepTweens(dt);
  const k = 1 - Math.exp(-dt * 3.2);
  camPos.lerp(goal.p, k); camTgt.lerp(goal.t, k); camShift += (goal.s - camShift) * k;
  camera.position.copy(camPos); camera.lookAt(camTgt);
  const H = Math.max(1, viz.clientHeight), Wd = Math.max(1, viz.clientWidth);
  if (Math.abs(camShift) > .0005) camera.setViewOffset(Wd, H, 0, camShift * H, Wd, H); else camera.clearViewOffset();
  rear.visible = Math.cos(turn.rotation.y) < .85; // the freight side stays out of sight while the shopfronts face you
  if (humansOn) updateHumans(dt);
  renderer.render(scene, camera);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) syncRun(); });
addEventListener('resize', fit);
MOBILE.addEventListener('change', fit);
new ResizeObserver(() => fit()).observe(viz);

/* ---------------- boot ---------------- */
(async () => {
  await loadFonts();
  build();
  fit();
  resetCorridor();
  const start = parseInt(location.hash.slice(1), 10);
  camPos.copy(goal.p); camTgt.copy(goal.t);
  const first = start >= 1 && start <= TOTAL ? start : 1;
  if (first > 1) {
    // jump straight in: set the turntable to its resting yaw for that slide
    turn.rotation.y = SL[first - 1].side === 'b' ? Math.PI : 0;
  }
  setCam(first); camPos.copy(goal.p); camTgt.copy(goal.t); camShift = goal.s;
  applySlide(first, 1, true);
  camPos.copy(goal.p); camTgt.copy(goal.t); camShift = goal.s;
  hold.until = performance.now() + 1500;
  syncRun();
  window.__deck = {
    go: goto, next, prev: prevSlide, get cur() { return cur; }, get step() { return step; },
    sample() {
      renderer.render(scene, camera);
      const gl = renderer.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
      const px = new Uint8Array(4); const seen = new Set(); let lum = 0, n = 0;
      for (let y = 1; y < 9; y++) for (let x = 1; x < 9; x++) {
        gl.readPixels(Math.floor(w * x / 9), Math.floor(h * y / 9), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        seen.add((px[0] >> 3) + ',' + (px[1] >> 3) + ',' + (px[2] >> 3)); lum += px[0] + px[1] + px[2]; n++;
      }
      return { distinct: seen.size, avg: lum / n / 3, w, h };
    },
    send: doExchange, tier: i => selectTier(i, true), act: onAct, reduced: RM,
    tw: () => tws.length, scene, rear, turn, dist, actors,
  };
})();
