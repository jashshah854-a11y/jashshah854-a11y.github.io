import * as THREE from 'three';

/* ================= helpers ================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const easeIO = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const pad2 = n => String(n).padStart(2, '0');
const DATA = JSON.parse($('#data').textContent);
/* FRED marks missing days; never plot a zero or non-finite price */
DATA.brent = DATA.brent.filter(r => Number.isFinite(r[1]) && r[1] > 0);
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.documentElement;
const stage = $('#stage'), glwrap = $('#glwrap'), canvas = $('#gl'), labelsEl = $('#labels'), poster = $('#glposter');
const N = 11;

/* geography: x east, z south. Lon/lat are real; routes are schematic */
const KX = 0.934, LAND_Y = 0.5, SEA_Y = 0.2;
const P = (lon, lat, y = 0) => new THREE.Vector3((lon - 46.5) * KX, y, -(lat - 21));
const COL = { paper: 0xe9e7e1, enamel: 0xf4f2ec, ink: 0x1d2226, steel: 0x3b4247, steel2: 0x7d878d, red: 0xc8321c, redDeep: 0x8f2314, land: 0xf1eee6, pier: 0xbdbab1 };

/* ================= data for the plates ================= */
const BASE_H = DATA.hormuz['2026-02'], BASE_B = DATA.bab['2026-02'];
const HZ = [
  { k: '2026-02', lab: 'February 2026' }, { k: '2026-03', lab: 'March 2026' },
  { k: '2026-06', lab: 'June 2026' }, { k: '2026-09', lab: 'September 2026' }
];
const PERIODS5 = [
  { lab: 'Q2 2025', y: 0.86, txt: 'million barrels a day loaded at Yanbu, Q2 2025 (0.75 to 0.97)', hz: BASE_H, bab: BASE_B },
  { lab: 'June 2026', y: 4.1, txt: 'million barrels a day loaded at Yanbu, June 2026', hz: DATA.hormuz['2026-06'], bab: DATA.bab['2026-06'] },
  { lab: 'July 2026', y: 3.75, txt: 'million barrels a day loaded at Yanbu, July 2026', hz: DATA.hormuz['2026-07'], bab: DATA.bab['2026-07'] },
  { lab: 'August 2026', y: 1.9, txt: 'million barrels a day loaded at Yanbu, August 2026 (about half of July)', hz: DATA.hormuz['2026-08'], bab: DATA.bab['2026-08'] }
];
const PERIODS8 = [
  { lab: 'Before the attack', pipe: 5.5, hits: false, txt: 'million barrels a day through the pipe, before the attack' },
  { lab: '10 Sep: shut', pipe: 0, hits: true, txt: 'million barrels a day: pipe shut after the 10 September attack' },
  { lab: '29 Sep: restarted', pipe: 2.65, hits: true, txt: 'million barrels a day through the pipe, 29 September (range 2.0 to 3.5)' }
];
const BAB_WEEKS = [
  { lab: 'June average week', t: 256, k: 97, n: 256, hud: 'ships a week, June average' },
  { lab: 'Week of 20 July', t: 198, k: 59, hud: 'ships a week, blockade week of 20 July' },
  { lab: 'Week of 14 September', t: 173, k: 46, hud: 'ships a week, week of 14 September' }
];
/* check the June average against the pulled weeks */
(() => {
  const jw = DATA.weeks.filter(w => w[0] >= '2026-06-01' && w[0] <= '2026-06-22');
  BAB_WEEKS[0].t = Math.round(jw.reduce((a, w) => a + w[1], 0) / jw.length);
  BAB_WEEKS[0].k = Math.round(jw.reduce((a, w) => a + w[2], 0) / jw.length);
  const f = d => DATA.weeks.find(w => w[0] === d);
  BAB_WEEKS[1].t = f('2026-07-20')[1]; BAB_WEEKS[1].k = f('2026-07-20')[2];
  BAB_WEEKS[2].t = f('2026-09-14')[1]; BAB_WEEKS[2].k = f('2026-09-14')[2];
})();

/* attack ledger: S struck, I intercepted, C claimed or unconfirmed */
const LEDGER = [
  { d: '2 Mar', where: 'Ras Tanura refinery', items: [{ lon: 50.16, lat: 26.64, m: 'SII', from: [52.2, 27.6] }] },
  { d: '13 Jul', where: 'Saudi south, after Sanaa airport strike', items: [{ lon: 42.66, lat: 18.22, m: 'C', from: [44.21, 15.35], flip: 1 }] },
  { d: '22 Jul', where: 'Red Sea tankers Encelia, Layla', items: [{ sea: 1, lon: 39.9, lat: 17.9, m: 'SC', from: [42.95, 14.8], flip: 1 }] },
  { d: '26 Jul', where: 'Yanbu, Jizan', items: [{ lon: 38.06, lat: 24.09, m: 'II', from: [44.21, 15.35], flip: 1 }, { lon: 42.55, lat: 16.89, m: 'C', from: [44.21, 15.35], flip: 1 }] },
  { d: '5 Aug', where: 'Tanker NCC Wafa off Yanbu', items: [{ sea: 1, lon: 37.3, lat: 24.2, m: 'C', from: [42.95, 14.8], flip: 1 }] },
  { d: '11 Aug', where: 'Ship Tihamah, Bab el-Mandeb', items: [{ sea: 1, lon: 43.2, lat: 12.9, m: 'S', from: [42.95, 14.8], flip: 1 }] },
  { d: '10 Sep', where: 'Pump stations, drones from Iraq', items: [{ lon: 46.7, lat: 24.7, m: 'S', from: [44.6, 31.0] }, { lon: 40.9, lat: 23.7, m: 'S', from: [44.6, 31.0] }, { lon: 43.8, lat: 24.4, m: 'C', from: [44.6, 31.0] }] },
  { d: '15 Sep', where: 'Abha, Khamis Mushait, Taif', items: [{ lon: 42.66, lat: 18.22, m: 'S', from: [44.21, 15.35], flip: 1 }, { lon: 42.73, lat: 18.4, m: 'S', from: [44.21, 15.35], flip: 1 }, { lon: 40.42, lat: 21.27, m: 'S', from: [44.21, 15.35], flip: 1 }] },
  { d: '24 Sep', where: 'Taif and Yanbu area, Riyadh', items: [{ lon: 39.24, lat: 22.68, m: 'IIIIII', from: [44.21, 15.35], flip: 1 }, { lon: 46.7, lat: 24.7, m: 'C', from: [44.21, 15.35], flip: 1 }, { lon: 38.06, lat: 24.09, m: 'C', from: [44.21, 15.35], flip: 1 }] }
];
const TALLY = LEDGER.map((_, k) => {
  const t = { S: 0, I: 0, C: 0 };
  LEDGER.slice(0, k + 1).forEach(g => g.items.forEach(it => [...it.m].forEach(c => t[c]++)));
  return t;
});
const BRENT_PINS = [
  { iso: '2026-02-27', ev: 'Before the war' },
  { iso: '2026-03-02', ev: 'Hormuz declared closed; Ras Tanura struck' },
  { iso: '2026-04-07', ev: '2026 peak' },
  { iso: '2026-04-17', ev: 'Iran says the strait is open' },
  { iso: '2026-06-17', ev: 'US-Iran memorandum' },
  { iso: '2026-07-02', ev: '2026 low' },
  { iso: '2026-07-13', ev: 'Sanaa airport strike' },
  { iso: '2026-07-23', ev: 'Saudi tankers hit' },
  { iso: '2026-09-03', ev: 'Houthi offensive begins' },
  { iso: '2026-09-10', ev: 'Pipeline attack' },
  { iso: '2026-09-15', ev: 'September high' },
  { iso: '2026-09-22', ev: 'Pipeline restarts' }
];
const DAY = iso => Date.parse(iso + 'T00:00:00Z') / 864e5;
const BR0 = DAY(DATA.brent[0][0]), BR1 = DAY(DATA.brent[DATA.brent.length - 1][0]);
const BRENT_STEPS = [DAY('2026-04-17'), DAY('2026-07-28'), BR1];
const CASES = { A: { hz: 3.7, bab: 26.2, pipe: 5.5 }, B: { hz: 3.7, bab: 33, pipe: 6 }, C: { hz: 3.7, bab: 3, pipe: 0 }, D: { hz: 70, bab: 26.2, pipe: 5.5 } };

/* ================= slide meta ================= */
const META = [
  null,
  { steps: 1 },
  { steps: 4, iv: 2800, st: HZ.map(h => [h.lab, ''] ) },
  { steps: 1 },
  { steps: 4, iv: 3000, st: PERIODS5.map(p => [p.lab, '']) },
  { steps: 10, iv: 1150, d0: 1400 },
  { steps: 3, iv: 3200, st: BAB_WEEKS.map(w => [w.lab, '']) },
  { steps: 3, iv: 3200, st: PERIODS8.map(p => [p.lab, '']) },
  { steps: 2, iv: 3200, st: [['Earlier readings', ''], ['Latest readings', '']] },
  { steps: 3, iv: 3600, st: [['Hormuz closed, to 17 Apr', ''], ['Houthis join, to 28 Jul', ''], ['Pipeline cut, to 29 Sep', '']] },
  { steps: 1 }
];

/* ================= state ================= */
let cur = 0, step = 0, MOBILE = false, W = 1440, H = 810, three = null;
const auto = { on: false, next: 0 };
const T = { hz: BASE_H, bab: BASE_B, pipe: 7, yan: null, hits: false, nums: true, size: 1, ledger: -1, brent: 0, units: null };
const V = { hz: BASE_H, bab: BASE_B, pipe: 7, yan: 0, size: 1 };

/* ================= 3D ================= */
function build3D() {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (e) { root.classList.add('nogl'); return null; }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.setClearColor(COL.paper, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 400);
  const AZ = 32 * Math.PI / 180, EL = 38 * Math.PI / 180;
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb9b5ab, 1.05));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5); sun.position.set(-12, 20, 16); scene.add(sun);

  const edgeMat = new THREE.LineBasicMaterial({ color: COL.ink });
  const lam = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
  const edges = (m, a = 30, mat = edgeMat) => { const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, a), mat); m.add(e); return e; };
  const canvasTex = (w, h, draw, rep) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (rep) t.repeat.set(rep[0], rep[1]); t.anisotropy = 4; return t;
  };

  const world = new THREE.Group(); scene.add(world);
  const mapG = new THREE.Group(), unitG = new THREE.Group(), dialG = new THREE.Group(), brentG = new THREE.Group();
  unitG.position.set(52, 0, 0); brentG.position.set(52, 0, -40); dialG.position.set(0, 0, -40);
  world.add(mapG, unitG, dialG, brentG);

  /* ---------- map: sea slab, land plates ---------- */
  const lonlat = pts => pts.map(([lo, la]) => new THREE.Vector2((lo - 46.5) * KX, la - 21));
  const ARABIA = [[32.35, 31], [48, 31], [48, 30], [48.1, 29.4], [48.5, 28.4], [49.1, 27.6], [49.65, 27], [50.2, 26.7], [50.15, 26.2], [50.2, 25.7], [50.55, 25], [50.85, 24.7], [50.78, 25.2], [50.85, 25.7], [51.2, 26.15], [51.55, 25.6], [51.6, 25], [51.45, 24.65], [51.6, 24.25], [52.5, 24.1], [53.7, 24.2], [54.4, 24.45], [55, 25], [55.3, 25.3], [55.9, 25.75], [56.05, 26.1], [56.35, 26.38], [56.45, 26.15], [56.3, 25.6], [56.35, 25.1], [56.6, 24.6], [56.75, 24.35], [57.4, 23.9], [58.6, 23.6], [59.5, 22.9], [59.85, 22.5], [59.3, 21.6], [58.6, 20.6], [57.7, 18.9], [55.9, 17.8], [54.1, 17], [52.2, 15.7], [49.1, 14.5], [47, 13.4], [45, 12.8], [44, 12.7], [43.4, 12.65], [43.3, 13], [43.25, 13.32], [42.95, 14.8], [42.7, 15.7], [42.55, 16.89], [41.08, 19.13], [40.3, 20.1], [39.2, 21.5], [38.9, 22.6], [38.06, 24.09], [37.2, 25.2], [36.5, 26.2], [35.7, 27.3], [35, 28], [34.25, 27.75], [34, 27.9], [33.5, 28.3], [33.05, 29], [32.7, 29.7], [32.55, 29.95], [32.35, 30]];
  const AFRICA = [[32, 31], [32.25, 31], [32.25, 30], [32.5, 29.9], [32.4, 29.6], [32.65, 29.1], [33.1, 28.4], [33.8, 27.25], [34, 26.75], [34.9, 25.1], [35.8, 23.9], [36.6, 22.2], [37.2, 19.6], [37.4, 18.5], [38.3, 17.4], [38.8, 16.5], [39.3, 15.9], [39.5, 15.6], [40.2, 15], [41, 14.3], [41.8, 13.6], [42.7, 13], [43.15, 12.7], [43.1, 12.2], [43.15, 11.6], [43, 11], [32, 11]];
  const IRAN = [[48, 31], [61, 31], [61, 25.3], [60.6, 25.3], [59.6, 25.4], [57.77, 25.64], [57.1, 26.5], [56.7, 27], [56.28, 26.95], [55.6, 26.9], [54.9, 26.55], [53.6, 26.65], [52.6, 27.5], [51.5, 27.9], [50.8, 28.9], [50.1, 29.9], [49.2, 30.3], [48, 30]];
  function contourTex(seed, base, line) {
    const S = 512, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
    const hash = (i, j, o) => { let h = (i * 374761393 + j * 668265263 + o * 2147483647 + seed * 1274126177) | 0; h = (h ^ (h >>> 13)) * 1274126177; h ^= h >>> 16; return (h >>> 0) / 4294967295; };
    const lat = (x, y, n, o) => { const fx = x / S * n, fy = y / S * n; const i = Math.floor(fx), j = Math.floor(fy); const tx = fx - i, ty = fy - j; const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty); const a = hash(i % n, j % n, o), b = hash((i + 1) % n, j % n, o), c2 = hash(i % n, (j + 1) % n, o), d = hash((i + 1) % n, (j + 1) % n, o); return lerp(lerp(a, b, sx), lerp(c2, d, sx), sy); };
    const f = new Float32Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) f[y * S + x] = lat(x, y, 4, 1) * .55 + lat(x, y, 8, 2) * .28 + lat(x, y, 16, 3) * .12 + lat(x, y, 32, 4) * .05;
    g.fillStyle = base; g.fillRect(0, 0, S, S);
    const img = g.getImageData(0, 0, S, S), d = img.data; const lv = v => Math.floor(v * 16);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const k = y * S + x, l = lv(f[k]); const r = lv(f[y * S + (x + 1) % S]), dn = lv(f[((y + 1) % S) * S + x]);
      if (l !== r || l !== dn) { const bold = l % 4 === 0 ? 1 : .55; d[k * 4] = lerp(d[k * 4], line[0], bold); d[k * 4 + 1] = lerp(d[k * 4 + 1], line[1], bold); d[k * 4 + 2] = lerp(d[k * 4 + 2], line[2], bold); }
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / 13.5, 1 / 13.5); t.anisotropy = 4; return t;
  }
  const landCap = new THREE.MeshBasicMaterial({ map: contourTex(3, '#f6f4ee', [95, 105, 110]) });
  const landCap2 = new THREE.MeshBasicMaterial({ map: contourTex(11, '#ebe8df', [120, 128, 132]) });
  const landSide = lam(0x8d979c);
  const landMeshes = [];
  [ARABIA, AFRICA, IRAN].forEach(poly => {
    const geo = new THREE.ExtrudeGeometry(new THREE.Shape(lonlat(poly)), { depth: LAND_Y + .6, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2); geo.translate(0, -.6, 0);
    const m = new THREE.Mesh(geo, [poly === ARABIA ? landCap : landCap2, landSide]); mapG.add(m); landMeshes.push(m);
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), edgeMat); mapG.add(e);
  });
  const seaTex = canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = '#cad3d6'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(50,70,80,.38)'; g.lineWidth = 1.4;
    for (let y = 4; y < h; y += 8) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  }, [7.5, 5.6]);
  const slabGeo = new THREE.BoxGeometry(27.1, .9, 20);
  const sideMat = lam(0x59636a), topMat = new THREE.MeshBasicMaterial({ map: seaTex });
  const slab = new THREE.Mesh(slabGeo, [sideMat, sideMat, topMat, sideMat, sideMat, sideMat]);
  slab.position.set(0, SEA_Y - .45, 0); mapG.add(slab); edges(slab);

  /* ---------- lanes and moving transits ---------- */
  const LANE_H = [[50.8, 26.9], [52, 26.6], [53.4, 26.3], [54.8, 26.3], [55.8, 26.5], [56.3, 26.67], [57, 26.2], [57.6, 25.2], [58.8, 24.3], [60.5, 23], [61, 22.6]];
  const LANE_B = [[32.85, 29.4], [33.3, 28.4], [34, 27.55], [35, 26.2], [36.8, 24.2], [37.9, 22.5], [38.8, 20], [40, 17.9], [41.2, 15.4], [42.4, 13.8], [43.1, 12.9], [43.27, 12.65], [43.9, 12.2], [45.5, 11.9], [48, 11.6]];
  const mkLane = pts => new THREE.CatmullRomCurve3(pts.map(([lo, la]) => P(lo, la, SEA_Y + .01)), false, 'centripetal');
  const laneH = mkLane(LANE_H), laneB = mkLane(LANE_B);
  [laneH, laneB].forEach(c => {
    const g = new THREE.BufferGeometry().setFromPoints(c.getSpacedPoints(160));
    const l = new THREE.Line(g, new THREE.LineDashedMaterial({ color: COL.steel2, dashSize: .28, gapSize: .2 }));
    l.computeLineDistances(); mapG.add(l);
  });
  function hullGeo(len, wid, h) {
    const s = new THREE.Shape();
    s.moveTo(-len / 2, -wid / 2); s.lineTo(len * .22, -wid / 2); s.lineTo(len / 2, 0); s.lineTo(len * .22, wid / 2); s.lineTo(-len / 2, wid / 2); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false }); g.rotateX(-Math.PI / 2); return g;
  }
  const dummy = new THREE.Object3D();
  const NSH = 80, NSB = 40;
  const shipsH = new THREE.InstancedMesh(hullGeo(.3, .15, .1), lam(COL.steel), NSH);
  const shipsB = new THREE.InstancedMesh(hullGeo(.3, .15, .1), lam(COL.steel), NSB);
  [shipsH, shipsB].forEach(m => { m.frustumCulled = false; mapG.add(m); });
  const laneSamp = c => { const p = c.getSpacedPoints(300); return p; };
  const spH = laneSamp(laneH), spB = laneSamp(laneB);
  function placeShips(mesh, sp, count, total, time, dir) {
    for (let i = 0; i < total; i++) {
      if (i >= count) { dummy.scale.setScalar(0); dummy.position.set(0, -9, 0); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix); continue; }
      const u = ((i + .5) / Math.max(count, 1) + time * .012 * dir) % 1;
      const f = u * 299, a = Math.floor(f), b = Math.min(a + 1, 299), k = f - a;
      const p = sp[a], q = sp[b];
      dummy.position.set(lerp(p.x, q.x, k), SEA_Y + .02, lerp(p.z, q.z, k));
      dummy.rotation.set(0, Math.atan2(-(q.z - p.z), q.x - p.x), 0);
      dummy.scale.setScalar(1); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  /* ---------- terminals ---------- */
  function tankCluster(lon, lat, n, tall) {
    const g = new THREE.Group(); const c = P(lon, lat, LAND_Y);
    const pos = [[0, 0], [.34, .08], [-.3, .16], [.1, -.32], [-.12, .4]];
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(.14, .14, .2, 16), lam(COL.enamel)); m.position.set(pos[i][0], .1, pos[i][1]); edges(m); g.add(m);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(.145, .145, .03, 16), lam(COL.red)); cap.position.set(pos[i][0], .215, pos[i][1]); g.add(cap);
    }
    if (tall) { const t = new THREE.Mesh(new THREE.CylinderGeometry(.04, .05, .7, 8), lam(COL.enamel)); t.position.set(.5, .35, -.1); edges(t); g.add(t); const tc = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, .08, 8), lam(COL.red)); tc.position.set(.5, .72, -.1); g.add(tc); }
    g.position.copy(c); mapG.add(g); return g;
  }
  function pier(a, b) {
    const A = P(a[0], a[1], SEA_Y + .06), B = P(b[0], b[1], SEA_Y + .06); const d = B.clone().sub(A); const L = d.length();
    const m = new THREE.Mesh(new THREE.BoxGeometry(L, .05, .07), lam(COL.pier)); m.position.copy(A.clone().add(B).multiplyScalar(.5)); m.rotation.y = Math.atan2(-d.z, d.x); edges(m); mapG.add(m);
  }
  tankCluster(49.95, 26.4, 4); pier([50.1, 26.62], [50.62, 26.82]);
  tankCluster(49.55, 25.8, 3, true);
  tankCluster(38.35, 24.15, 4); pier([38.1, 24.1], [37.75, 24.12]);
  tankCluster(56.15, 25.1, 3); tankCluster(56.55, 24.3, 3);

  /* ---------- pipeline ---------- */
  const PIPE_PTS = [[49.68, 25.93], [47.9, 25.3], [46.7, 24.7], [44, 24.3], [41.8, 23.9], [40.9, 23.7], [39.6, 24.5], [38.06, 24.09]];
  const pipeBase = new THREE.CatmullRomCurve3(PIPE_PTS.map(([lo, la]) => P(lo, la, LAND_Y + .13)), false, 'centripetal');
  const offs = [-.085, .085];
  const pipes = offs.map(o => new THREE.CatmullRomCurve3(PIPE_PTS.map(([lo, la]) => P(lo, la + o, LAND_Y + .13)), false, 'centripetal'));
  const casingMat = lam(COL.enamel, { transparent: true, opacity: .42, depthWrite: false });
  const outlineMat = new THREE.MeshBasicMaterial({ color: COL.ink, side: THREE.BackSide });
  const coreMat = lam(0x59636a);
  pipes.forEach(c => {
    mapG.add(new THREE.Mesh(new THREE.TubeGeometry(c, 160, .075, 8, false), outlineMat));
    mapG.add(new THREE.Mesh(new THREE.TubeGeometry(c, 160, .058, 8, false), coreMat));
    const cas = new THREE.Mesh(new THREE.TubeGeometry(c, 160, .062, 10, false), casingMat); cas.renderOrder = 2; mapG.add(cas);
  });
  const pipeSamp = pipes.map(c => c.getSpacedPoints(400));
  const NB = 300;
  const beadMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(.036, 8, 6), new THREE.MeshBasicMaterial({ color: COL.red }), NB);
  beadMesh.frustumCulled = false; mapG.add(beadMesh);
  const eastCurve = new THREE.CatmullRomCurve3([P(49.68, 25.93, LAND_Y + .13), P(49.95, 26.3, LAND_Y + .13), P(50.12, 26.6, LAND_Y + .13)]);
  mapG.add(new THREE.Mesh(new THREE.TubeGeometry(eastCurve, 12, .075, 8, false), outlineMat));
  mapG.add(new THREE.Mesh(new THREE.TubeGeometry(eastCurve, 12, .055, 8, false), lam(COL.enamel)));
  const eastSamp = eastCurve.getSpacedPoints(60);
  const NE = 40;
  const eastBeads = new THREE.InstancedMesh(new THREE.SphereGeometry(.034, 8, 6), new THREE.MeshBasicMaterial({ color: COL.red }), NE);
  eastBeads.frustumCulled = false; mapG.add(eastBeads);

  /* 13 pump stations, three flagged by the 10 Sep attack */
  const stations = [];
  for (let i = 0; i < 13; i++) {
    const u = .04 + i * (.92 / 12); const p = pipeBase.getPointAt(u);
    const g = new THREE.Group();
    const bx = new THREE.Mesh(new THREE.BoxGeometry(.2, .12, .2), lam(COL.enamel)); bx.position.y = .06 - .13; edges(bx); g.add(bx);
    const capMat = lam(COL.red); const cap = new THREE.Mesh(new THREE.BoxGeometry(.2, .04, .2), capMat); cap.position.y = .14 - .13; g.add(cap);
    g.position.set(p.x, p.y, p.z + .0); mapG.add(g); stations.push({ g, capMat, pos: p });
  }
  const nearest = (lon, lat) => { const q = P(lon, lat); let b = 0, d = 1e9; stations.forEach((s, i) => { const dd = (s.pos.x - q.x) ** 2 + (s.pos.z - q.z) ** 2; if (dd < d) { d = dd; b = i; } }); return b; };
  const hitIdx = { S1: nearest(46.7, 24.7), S2: nearest(40.9, 23.7), C1: nearest(43.8, 24.4) };
  const hitMarks = [];
  const mkRing = (r, tube, color, arc = Math.PI * 2) => new THREE.Mesh(new THREE.TorusGeometry(r, tube, 6, 24, arc), new THREE.MeshBasicMaterial({ color }));

  [['S1', 'S'], ['S2', 'S'], ['C1', 'C']].forEach(([k, c]) => {
    const g = new THREE.Group(); const sp = stations[hitIdx[k]].pos; g.position.set(sp.x, LAND_Y + .02, sp.z);
    if (c === 'S') { const cone = new THREE.Mesh(new THREE.ConeGeometry(.17, .6, 5), new THREE.MeshBasicMaterial({ color: COL.red })); cone.rotation.x = Math.PI; cone.position.y = .75; g.add(cone); const rg = mkRing(.3, .035, COL.ink); rg.rotation.x = Math.PI / 2; rg.position.y = .06; g.add(rg); }
    else { const rg = mkRing(.3, .035, COL.red, Math.PI * 1.55); rg.rotation.x = Math.PI / 2; rg.position.y = .3; g.add(rg); const st = new THREE.Mesh(new THREE.BoxGeometry(.02, .3, .02), new THREE.MeshBasicMaterial({ color: COL.red })); st.position.y = .15; g.add(st); }
    g.visible = false; mapG.add(g); hitMarks.push(g);
  });
  const arcs8 = ['S1', 'S2', 'C1'].map(k => {
    const A = P(44.6, 31.0, .6), B = stations[hitIdx[k]].pos.clone(); B.y += .4; const mid = A.clone().add(B).multiplyScalar(.5); mid.y += 1.6;
    const pts = new THREE.QuadraticBezierCurve3(A, mid, B).getPoints(30); const lg = new THREE.BufferGeometry().setFromPoints(pts);
    const ln = new THREE.Line(lg, new THREE.LineDashedMaterial({ color: COL.red, dashSize: .16, gapSize: .1 })); ln.computeLineDistances(); ln.visible = false; lg.setDrawRange(0, 0); mapG.add(ln); return ln;
  });
  let arcT = 0;
  /* ---------- gates (valves) ---------- */
  function makeGate(L = 1.5, ts = 1) {
    const g = new THREE.Group();
    const pierM = lam(COL.pier);
    [-1, 1].forEach(s => { const p = new THREE.Mesh(new THREE.BoxGeometry(.24 * ts, .55 * ts, .26 * ts), pierM); p.position.set(s * L / 2, .27 * ts, 0); edges(p); g.add(p); });
    const beam = new THREE.Mesh(new THREE.BoxGeometry(L, .07 * ts, .12 * ts), lam(COL.red)); beam.position.y = .6 * ts; edges(beam); g.add(beam);
    const ll = L / 2 - .12 * ts; const leaves = [];
    [-1, 1].forEach(s => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(ll, .42 * ts, .05 * ts), lam(COL.red)); m.position.y = .36 * ts; edges(m); g.add(m); leaves.push({ m, s, ll });
    });
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(.02 * ts, .02 * ts, .4 * ts, 8), lam(COL.steel)); stem.position.set(L / 2 + .02 * ts, .9 * ts, 0); g.add(stem);
    const wheel = new THREE.Group(); wheel.position.set(L / 2 + .02 * ts, 1.1 * ts, 0);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(.2 * ts, .028 * ts, 6, 24), lam(COL.red)); rim.rotation.x = Math.PI / 2; wheel.add(rim);
    for (let i = 0; i < 3; i++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(.4 * ts, .025 * ts, .025 * ts), lam(COL.red)); sp.rotation.y = i * Math.PI / 3; wheel.add(sp); }
    g.add(wheel);
    g.userData = { leaves, wheel, L, ll };
    g.set = c => {
      leaves.forEach(({ m, s, ll }) => { m.position.x = s * (ll * (1 - c) + ll / 2); });
      wheel.rotation.y = -c * Math.PI * 4;
    };
    return g;
  }
  const gateH = makeGate(), gateB = makeGate();
  gateH.position.copy(P(56.3, 26.67, SEA_Y)); gateH.rotation.y = Math.PI / 2;
  gateB.position.copy(P(43.27, 12.65, SEA_Y));
  mapG.add(gateH, gateB);

  /* ---------- dials ---------- */
  const dials = {};
  function dialFace(o) {
    const S = 512, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
    g.fillStyle = '#f4f2ec'; g.beginPath(); g.arc(256, 256, 254, 0, 7); g.fill();
    const pt = (r, f) => { const th = (225 - 270 * f) * Math.PI / 180; return [256 + r * Math.cos(th), 256 - r * Math.sin(th)]; };
    const fr = v => clamp((v - o.min) / (o.max - o.min), 0, 1);
    g.strokeStyle = '#1d2226'; g.fillStyle = '#1d2226'; g.lineCap = 'butt';
    const minor = o.minor || (o.majors[1] - o.majors[0]) / 5;
    for (let v = o.min; v <= o.max + 1e-6; v += minor) { const a = pt(222, fr(v)), b = pt(238, fr(v)); g.lineWidth = 3; g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.stroke(); }
    g.font = '700 46px "Barlow Condensed", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    o.majors.forEach(v => { const a = pt(204, fr(v)), b = pt(240, fr(v)); g.lineWidth = 7; g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.stroke(); const t = pt(166, fr(v)); g.fillText(String(v), t[0], t[1]); });
    (o.marks || []).forEach(m => {
      g.strokeStyle = '#c8321c'; g.fillStyle = '#c8321c'; g.lineWidth = 11; const a = pt(190, fr(m.v)), b = pt(250, fr(m.v)); g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.stroke();
      g.font = '700 30px "Barlow Condensed", sans-serif'; const t = pt(128, fr(m.v)); g.fillText(m.t, t[0], t[1]);
    });
    g.fillStyle = '#1d2226'; g.font = '700 40px "Barlow Condensed", sans-serif'; g.fillText(o.title, 256, 326); g.font = '400 26px "B612 Mono", monospace'; g.fillText(o.unit, 256, 362);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }
  function makeDial(key, o, parent, pos, standH = .55) {
    const r = o.r || .62;
    const rootG = new THREE.Group(); rootG.position.copy(pos);
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(.035, .045, standH, 8), lam(COL.steel)); stand.position.y = standH / 2; rootG.add(stand);
    const tilt = new THREE.Group(); tilt.position.y = standH + r; tilt.rotation.order = 'XYZ'; tilt.rotation.x = -EL; rootG.add(tilt);
    const bez = new THREE.Mesh(new THREE.TorusGeometry(r, r * .075, 8, 40), lam(COL.steel)); tilt.add(bez);
    const face = new THREE.Mesh(new THREE.CircleGeometry(r * .99, 48), new THREE.MeshBasicMaterial({ map: dialFace(o) })); face.position.z = -.002; tilt.add(face);
    const mkNeedle = (color, w, z) => {
      const piv = new THREE.Group(); piv.position.z = z;
      const nd = new THREE.Mesh(new THREE.BoxGeometry(r * .86, r * w, r * .02), new THREE.MeshBasicMaterial({ color })); nd.position.x = r * .33; piv.add(nd);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(r * .16, r * w, r * .02), new THREE.MeshBasicMaterial({ color })); tail.position.x = -r * .1; piv.add(tail);
      tilt.add(piv); return piv;
    };
    const ghost = mkNeedle(0x7d878d, .028, .01), live = mkNeedle(COL.red, .045, .02);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * .07, r * .07, r * .06, 12), lam(COL.ink)); hub.rotation.x = Math.PI / 2; hub.position.z = .03; tilt.add(hub);
    const d = { key, root: rootG, o, ghost, live, cur: o.min, curG: o.min, tgt: o.min, tgtG: o.min, r, size: 1, standH };
    d.angle = v => (225 - 270 * clamp((v - o.min) / (o.max - o.min), 0, 1)) * Math.PI / 180;
    live.rotation.z = d.angle(o.min); ghost.rotation.z = d.angle(o.min); ghost.visible = false;
    parent.add(rootG); dials[key] = d; return d;
  }
  makeDial('hz', { title: 'HORMUZ', unit: 'ships a day', min: 0, max: 100, majors: [0, 25, 50, 75, 100], minor: 5, r: .66 }, mapG, P(55.55, 25.25, LAND_Y));
  makeDial('bab', { title: 'BAB EL-MANDEB', unit: 'ships a day', min: 0, max: 50, majors: [0, 10, 20, 30, 40, 50], minor: 2, r: .66 }, mapG, P(44.3, 13.5, LAND_Y));
  makeDial('pipe', { title: 'PIPELINE', unit: 'mb/d', min: 0, max: 8, majors: [0, 2, 4, 6, 8], minor: .5, r: .72, marks: [{ v: 5, t: '5' }, { v: 7, t: '7' }] }, mapG, P(48.7, 26.35, LAND_Y));
  makeDial('yan', { title: 'YANBU LOADINGS', unit: 'mb/d', min: 0, max: 6, majors: [0, 1, 2, 3, 4, 5, 6], minor: .5, r: .72 }, mapG, P(39.35, 23.2, LAND_Y));
  /* dial board */
  const board = (w, d, parent) => {
    const t = canvasTex(256, 256, (g, ww, hh) => {
      g.fillStyle = '#f4f2ec'; g.fillRect(0, 0, ww, hh); g.strokeStyle = 'rgba(29,34,38,.13)'; g.lineWidth = 1;
      for (let i = 0; i <= ww; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, hh); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(ww, i); g.stroke(); }
      g.strokeStyle = 'rgba(29,34,38,.3)'; g.lineWidth = 1.5;
      for (let i = 0; i <= ww; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, hh); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(ww, i); g.stroke(); }
    }, [w / 4, d / 4]);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, .6, d), [lam(0x59636a), lam(0x59636a), new THREE.MeshLambertMaterial({ map: t }), lam(0x59636a), lam(0x59636a), lam(0x59636a)]);
    m.position.y = -.3; parent.add(m); edges(m); return m;
  };
  board(31, 19, unitG); board(31, 19, dialG); board(31, 19, brentG);
  const DB = [
    ['risk', { title: 'WAR-RISK COVER', unit: '% of hull', min: 0, max: 10, majors: [0, 2, 4, 6, 8, 10], minor: .5, r: 2.3, marks: [{ v: 7, t: '7' }] }, -10.6, [0.1, 3]],
    ['rate', { title: 'VLCC RATE', unit: '$k a day', min: 0, max: 1500, majors: [0, 300, 600, 900, 1200, 1500], minor: 50, r: 2.3 }, -3.55, [678, 1290]],
    ['days', { title: 'EXTRA DAYS', unit: 'to Asia', min: 0, max: 30, majors: [0, 5, 10, 15, 20, 25, 30], minor: 1, r: 2.3 }, 3.55, [0, 22]],
    ['shut', { title: 'OUTPUT SHUT IN', unit: 'mb/d', min: 0, max: 4, majors: [0, 1, 2, 3, 4], minor: .25, r: 2.3, marks: [{ v: 2.9, t: '2.9' }] }, 10.6, [1.95, 3.55]]
  ];
  DB.forEach(([k, o, x, vals]) => { const d = makeDial(k, o, dialG, new THREE.Vector3(x, 0, 0), .9); d.vals = vals; d.ghost.visible = true; });

  /* ---------- unit chart tokens ---------- */
  const NT = 256;
  const tokGeo = hullGeo(.62, .4, .22);
  const tokens = new THREE.InstancedMesh(tokGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), NT);
  tokens.frustumCulled = false; unitG.add(tokens);
  const tk = Array.from({ length: NT }, () => ({ c: [0, 0, 0, 0, .5, .5, .5], f: [0, 0, 0, 0, .5, .5, .5], t: [0, 0, 0, 0, .5, .5, .5], t0: 0, dl: 0, du: .9 }));
  const colObj = new THREE.Color();
  for (let i = 0; i < NT; i++) { colObj.setRGB(.5, .5, .5); tokens.setColorAt(i, colObj); }
  tokens.instanceColor.needsUpdate = true;
  const rgb = hex => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
  const CS = { tank: rgb(COL.steel), oth: rgb(0x99a2a7), lost: rgb(COL.red), lostT: rgb(COL.redDeep) };
  const slotGeo = new THREE.BufferGeometry();
  const slotLines = new THREE.LineSegments(slotGeo, new THREE.LineBasicMaterial({ color: COL.steel2, transparent: true, opacity: .55 }));
  unitG.add(slotLines);
  let ds = null; // active dataset
  function makeDataset(kind) {
    if (kind === 'hz') {
      const n = Math.round(BASE_H), slots = [], tray = [];
      for (let i = 0; i < n; i++) { slots.push([-9.8 + (i % 13) * .98, -4.2 + Math.floor(i / 13) * .8]); tray.push([-9.8 + (i % 13) * .98, 3.2 + Math.floor(i / 13) * .8]); }
      return { kind, n, slots, tray, kinds: Array(n).fill('o') };
    }
    const n = BAB_WEEKS[0].t, nt = BAB_WEEKS[0].k, slots = [], tray = [], kinds = [];
    for (let i = 0; i < n; i++) { slots.push([-12.9 + (i % 32) * .82, -7.6 + Math.floor(i / 32) * .62]); tray.push([-12.9 + (i % 32) * .82, 1.6 + Math.floor(i / 32) * .62]); kinds.push(i < nt ? 't' : 'o'); }
    return { kind, n, slots, tray, kinds };
  }
  function setDataset(kind) {
    if (ds && ds.kind === kind) return;
    ds = makeDataset(kind);
    const pts = [];
    ds.slots.forEach(([x, z]) => { const a = .31, b = .2; pts.push(x - a, .01, z - b, x + a, .01, z - b, x + a, .01, z - b, x + a, .01, z + b, x + a, .01, z + b, x - a, .01, z + b, x - a, .01, z + b, x - a, .01, z - b); });
    slotGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    for (let i = 0; i < NT; i++) {
      const tkn = tk[i];
      if (i < ds.n) { const [x, z] = ds.slots[i]; const col = ds.kinds[i] === 't' ? CS.tank : (ds.kind === 'hz' ? CS.tank : CS.oth); tkn.c = [x, .0, z, 1, ...col]; tkn.t = tkn.c.slice(); tkn.f = tkn.c.slice(); }
      else { tkn.c = [0, -9, 0, 0, .5, .5, .5]; tkn.t = tkn.c.slice(); tkn.f = tkn.c.slice(); }
      tkn.t0 = -9;
    }
    writeTokens();
  }
  function setUnits(live, instant) {
    // live: Hormuz -> number; Bab -> [tankersLive, othersLive]
    const now = performance.now() / 1000;
    let li = 0, lo = 0, mi = 0;
    for (let i = 0; i < ds.n; i++) {
      const tkn = tk[i]; const isT = ds.kinds[i] === 't';
      let alive;
      if (ds.kind === 'hz') alive = i < live; else alive = isT ? (li++ < live[0]) : (lo++ < live[1]);
      let tgt;
      if (alive) { const [x, z] = ds.slots[i]; const col = isT ? CS.tank : (ds.kind === 'hz' ? CS.tank : CS.oth); tgt = [x, 0, z, 1, ...col]; }
      else { const [x, z] = ds.tray[mi++]; tgt = [x, 0, z, .35, ...(isT ? CS.lostT : CS.lost)]; }
      tkn.f = tkn.c.slice(); tkn.t = tgt; tkn.t0 = instant || REDUCED ? -9 : now; tkn.dl = alive ? 0 : (i % 40) * .012; tkn.du = .9;
    }
    unitLive = ds.kind === 'hz' ? live : live[0] + live[1];
  }
  let unitLive = 0;
  function writeTokens() {
    for (let i = 0; i < NT; i++) {
      const t = tk[i]; const c = t.c;
      dummy.position.set(c[0], c[1], c[2]); dummy.rotation.set(0, 0, 0); dummy.scale.set(c[3] ? 1 : 0, c[3] || 1e-4, c[3] ? 1 : 0); dummy.scale.set(1, Math.max(c[3], 1e-4), 1);
      if (c[1] < -5) dummy.scale.set(0, 0, 0);
      dummy.updateMatrix(); tokens.setMatrixAt(i, dummy.matrix); colObj.setRGB(c[4], c[5], c[6]); tokens.setColorAt(i, colObj);
    }
    tokens.instanceMatrix.needsUpdate = true; tokens.instanceColor.needsUpdate = true;
  }
  function stepTokens(now) {
    let busy = false;
    for (let i = 0; i < NT; i++) {
      const t = tk[i]; const k = clamp((now - t.t0 - t.dl) / t.du, 0, 1); if (k < 1) busy = true;
      const e = easeIO(k); for (let j = 0; j < 7; j++) t.c[j] = t.f[j] + (t.t[j] - t.f[j]) * e;
      if (k > 0 && k < 1 && t.t[3] < 1) t.c[1] = Math.sin(k * Math.PI) * .9; else if (k > 0 && k < 1) t.c[1] = 0;
    }
    if (busy || unitDirty) { writeTokens(); unitDirty = false; }
  }
  let unitDirty = true;
  const gateUH = makeGate(13.4, 1.9), gateUB = makeGate(27.4, 1.9); gateUH.position.set(-3.6, 0, 1.9); gateUB.position.set(0, 0, -.9); unitG.add(gateUH, gateUB);

  /* ---------- Brent chart ---------- */
  const BX0 = -10.2, BX1 = 10.2, BY0 = .9, BY1 = 7.0, BZ = -2.6, PH = 11.6;
  const bx = d => lerp(BX0, BX1, (d - BR0) / (BR1 - BR0));
  const by = p => BY0 + (p - 60) / 85 * (BY1 - BY0);
  const panelTex = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#f4f2ec'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(29,34,38,.12)'; for (let i = 0; i <= w; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); } }, [5, 3]);
  const panel = new THREE.Mesh(new THREE.BoxGeometry(24, PH, .3), [lam(0x59636a), lam(0x59636a), lam(0x59636a), lam(0x59636a), new THREE.MeshLambertMaterial({ map: panelTex }), lam(0x59636a)]);
  panel.position.set(0, PH / 2, BZ); brentG.add(panel); edges(panel);
  const gl = [];
  [60, 80, 100, 120, 140].forEach(p => { gl.push(BX0 - .6, by(p), BZ + .16, BX1 + .4, by(p), BZ + .16); });
  const glg = new THREE.BufferGeometry(); glg.setAttribute('position', new THREE.Float32BufferAttribute(gl, 3));
  brentG.add(new THREE.LineSegments(glg, new THREE.LineBasicMaterial({ color: COL.steel2, transparent: true, opacity: .8 })));
  const bPts = DATA.brent.map(([d, p]) => new THREE.Vector3(bx(DAY(d)), by(p), BZ + .2));
  const bCurve = new THREE.CatmullRomCurve3(bPts, false, 'centripetal');
  const SEG = 400, RAD = 6;
  const bGeo = new THREE.TubeGeometry(bCurve, SEG, .07, RAD, false);
  const bLine = new THREE.Mesh(bGeo, new THREE.MeshBasicMaterial({ color: COL.red })); brentG.add(bLine);
  const bTot = bGeo.index.count;
  bGeo.setDrawRange(0, 0);
  const bHead = new THREE.Mesh(new THREE.SphereGeometry(.18, 12, 10), new THREE.MeshBasicMaterial({ color: COL.ink })); brentG.add(bHead);
  const priceAt = d => { const arr = DATA.brent; let lo = 0; while (lo < arr.length - 2 && DAY(arr[lo + 1][0]) < d) lo++; const a = arr[lo], b = arr[lo + 1]; const k = clamp((d - DAY(a[0])) / (DAY(b[0]) - DAY(a[0])), 0, 1); return lerp(a[1], b[1], k); };
  const pinInfo = BRENT_PINS.map((pn, i) => { const d = DAY(pn.iso); return { pn, d, x: bx(d), y: by(priceAt(d)), row: i % 3 }; });
  const pinObjs = pinInfo.map(q => {
    const top = 7.8 + q.row * .8; const len = top - q.y;
    const g = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.BoxGeometry(.035, len, .035), new THREE.MeshBasicMaterial({ color: COL.ink })); stem.position.set(q.x, q.y + len / 2, BZ + .22); g.add(stem);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(.13, 10, 8), new THREE.MeshBasicMaterial({ color: COL.ink })); dot.position.set(q.x, q.y, BZ + .22); g.add(dot);
    brentG.add(g); g.visible = false;
    return { g, d: q.d, anchor: new THREE.Vector3(q.x, top, BZ + .22), pn: q.pn };
  });
  makeDial('brent', { title: 'BRENT SPOT', unit: '$ a barrel', min: 60, max: 145, majors: [60, 80, 100, 120, 140], minor: 5, r: 1.9 }, brentG, new THREE.Vector3(-4.5, 0, 5.2), .7);
  dials.brent.ghost.visible = false;

  /* ---------- ledger markers ---------- */
  const ledgerG = new THREE.Group(); mapG.add(ledgerG);
  const ledgerObjs = []; // per group
  LEDGER.forEach((grp, gi) => {
    const items = grp.items.map(it => {
      const site = P(it.lon, it.lat, it.sea ? SEA_Y : LAND_Y);
      const marks = [...it.m].map((c, mi) => {
        const n = it.m.length; const ang = mi / Math.max(n, 1) * Math.PI * 2 + .5; const rr = n > 1 ? .2 + n * .02 : 0;
        const g = new THREE.Group(); g.position.set(site.x + Math.cos(ang) * rr, site.y, site.z + Math.sin(ang) * rr);
        let body;
        if (c === 'S') { body = new THREE.Mesh(new THREE.ConeGeometry(.15, .5, 5), new THREE.MeshBasicMaterial({ color: COL.red })); body.rotation.x = Math.PI; body.position.y = .3; const rg = mkRing(.19, .025, COL.ink); rg.rotation.x = Math.PI / 2; rg.position.y = .02; g.add(rg); }
        else if (c === 'I') { body = mkRing(.15, .035, COL.steel); body.rotation.x = Math.PI / 2; body.position.y = .42; const st = new THREE.Mesh(new THREE.BoxGeometry(.02, .4, .02), new THREE.MeshBasicMaterial({ color: COL.steel })); st.position.y = .2; g.add(st); }
        else { body = mkRing(.15, .028, COL.red, Math.PI * 1.55); body.rotation.x = Math.PI / 2; body.position.y = .3; const st = new THREE.Mesh(new THREE.BoxGeometry(.015, .3, .015), new THREE.MeshBasicMaterial({ color: COL.red })); st.position.y = .15; g.add(st); }
        body.scale.setScalar(1.7); g.children.forEach(ch => { if (ch !== body) ch.scale.setScalar(1.7); }); g.add(body); g.visible = false; g.userData = { c }; ledgerG.add(g); return g;
      });
      let arc = null;
      if (it.from) {
        const A = P(it.from[0], it.from[1], .6), B = site.clone(); B.y += .35;
        const mid = A.clone().add(B).multiplyScalar(.5); mid.y += 1.2 + A.distanceTo(B) * .16;
        const cv = new THREE.QuadraticBezierCurve3(A, mid, B); const pts = cv.getPoints(30);
        const lg = new THREE.BufferGeometry().setFromPoints(pts);
        const mat = new THREE.LineDashedMaterial({ color: it.m.includes('S') ? COL.red : COL.steel, dashSize: .16, gapSize: .1, transparent: true, opacity: .9 });
        arc = new THREE.Line(lg, mat); arc.computeLineDistances(); arc.visible = false; lg.setDrawRange(0, 0); ledgerG.add(arc);
      }
      return { marks, arc, site };
    });
    ledgerObjs.push({ items, t0: 0, shown: false });
  });
  function setLedger(n, instant) {
    // n groups revealed (0..9)
    ledgerObjs.forEach((go, gi) => {
      const show = gi < n;
      if (show && !go.shown) { go.t0 = instant || REDUCED ? -9 : performance.now() / 1000; }
      go.shown = show;
      if (!show) go.items.forEach(it => { it.marks.forEach(m => { m.visible = false; }); if (it.arc) { it.arc.visible = false; it.arc.geometry.setDrawRange(0, 0); } });
    });
  }
  function stepLedger(now, S) {
    ledgerObjs.forEach((go, gi) => {
      if (!go.shown) return;
      const age = now - go.t0;
      go.items.forEach((it, ii) => {
        const k = clamp(age / .7, 0, 1);
        if (it.arc) { it.arc.visible = true; it.arc.geometry.setDrawRange(0, Math.floor(k * 31)); it.arc.material.opacity = gi === Math.min(ledgerCurTop, 99) - 1 ? .95 : .22; }
        it.marks.forEach((m, mi) => {
          const kk = clamp((age - .55 - mi * .07) / .35, 0, 1);
          m.visible = kk > 0; const s = (kk < 1 ? 1.25 - .25 * kk : 1) * kk; m.scale.setScalar(Math.max(s, .001) * S);
        });
      });
    });
  }
  let ledgerCurTop = 0;

  /* ---------- watch rings (case table) ---------- */
  const rings = [];
  [['pipe', P(44, 24.3, LAND_Y)], ['yan', P(38.06, 24.09, LAND_Y)], ['bab', P(43.27, 12.65, SEA_Y)], ['hz', P(56.3, 26.67, SEA_Y)]].forEach(([k, p]) => {
    const r = mkRing(.55, .035, COL.red); r.rotation.x = Math.PI / 2; r.position.copy(p).add(new THREE.Vector3(0, .06, 0)); r.visible = false; mapG.add(r); rings.push({ k, r });
  });

  /* ---------- labels ---------- */
  const LB = [];
  const tmp = new THREE.Vector3();
  function label(o) {
    const el = document.createElement('div'); el.className = 'lb ' + (o.cls || ''); if (o.m === 0) el.dataset.m = '0'; labelsEl.appendChild(el);
    const l = { el, ...o, last: null, vis: false }; LB.push(l); return l;
  }
  const lbPlace = (id, slides, txt, lon, lat, y, cls, dx = 0, dy = -14, m) => label({ id, slides, txt, anchor: P(lon, lat, y), cls, dx, dy, m });
  lbPlace('ras', [2, 4, 6, 8], 'Ras Tanura', 50.16, 26.64, LAND_Y + .3, '', -8, -22);
  lbPlace('abq', [2, 4, 8], 'Abqaiq', 49.68, 25.93, LAND_Y + .5, '', 0, -2);
  lbPlace('yanl', [2, 4, 5, 6, 8, 11], 'Yanbu', 38.06, 24.09, LAND_Y + .3, '', -34, 0);
  lbPlace('hzl', [2, 5, 11], 'Strait of Hormuz', 56.3, 26.67, SEA_Y, '', 0, 30);
  lbPlace('babl', [2, 5, 6, 11], 'Bab el-Mandeb', 43.27, 12.65, SEA_Y, '', 0, 30);
  lbPlace('suez', [2], 'Suez and SUMED', 32.55, 29.95, LAND_Y, 'dim', 30, 10);
  lbPlace('fuj', [2], 'Fujairah, Sohar', 56.4, 24.7, LAND_Y, 'dim', 4, 46, 0);
  lbPlace('riy', [6], 'Riyadh', 46.7, 24.7, LAND_Y, 'dim', 26, -6);
  lbPlace('sana', [6], 'Sanaa', 44.21, 15.35, LAND_Y, 'dim', 26, 4);
  lbPlace('jiz', [6], 'Jizan', 42.55, 16.89, LAND_Y, 'dim', -26, 0);
  lbPlace('taif', [6], 'Taif', 40.42, 21.27, LAND_Y, 'dim', -20, 0);
  lbPlace('iraq', [6], 'from Iraq', 44.6, 30.7, LAND_Y, 'dim', 0, -2);
  label({ id: 'cap4', slides: [4], cls: 'dim', anchor: () => dialTop('pipe', 1.2), txt: 'Red ticks: 5 (EIA capacity), 7 (Aramco maximum)', dx: -96, dy: -8, al: 'r' });
  lbPlace('pmp', [4], '13 pump stations', 44, 24.3, LAND_Y + .3, '', 0, -16);
  lbPlace('iraq8', [8], 'from Iraq', 44.6, 31.0, .6, 'red edge', 0, -6);
  lbPlace('pmp8', [8], 'Pump stations hit 10 Sep', 44, 24.3, LAND_Y + .3, 'red', 0, -16);
  lbPlace('ae', [4], 'Two pipes, 56 and 48 inch', 41.4, 24, LAND_Y, 'dim', 0, 36, 0);
  const geo = (id, slides, txt, lon, lat, dx = 0, dy = 0) => label({ id, slides, txt, anchor: P(lon, lat, LAND_Y), cls: 'geo', dx, dy, m: 0 });
  [[2, 5, 6]].forEach(sl => {
    geo('g1', sl, 'Saudi Arabia', 45.2, 22.6); geo('g2', [2, 5], 'Red Sea', 38.6, 20.2, -18, 0); 
    geo('g4', [2], 'Iran', 52.2, 30.2); geo('g5', [2], 'Gulf of Aden', 46.8, 11.8, 0, 8); 
     geo('g8', [5, 6], 'Yemen', 46.8, 15.0);
  });
  /* dial value labels */
  const dialTop = (key, mult) => { const d = dials[key]; const v = new THREE.Vector3(); d.root.updateWorldMatrix(true, false); d.root.getWorldPosition(v); v.y += (d.standH + d.r * mult) * d.root.scale.x; return v; };
  const valLab = (id, slides, key, fmt, dx, dy) => label({ id, slides, cls: 'ink', anchor: () => dialTop(key, 2.25), txt: () => (T.nums === false ? null : fmt()), dx, dy });
  valLab('vpipe', [4, 8, 11], 'pipe', () => (T.pipe == null ? 'Pipeline: no reading' : `Pipeline ${V.pipe.toFixed(V.pipe < 1 && V.pipe > 0 ? 2 : 1)} mb/d`), 0, -20);
  valLab('vyan', [5], 'yan', () => (T.yan == null ? null : `Yanbu ${V.yan.toFixed(2)} mb/d`), 0, -20);
  valLab('vhz', [2, 5], 'hz', () => `Hormuz ${V.hz.toFixed(1)} a day`, 0, -20);
  valLab('vbab', [2, 5], 'bab', () => `Bab el-Mandeb ${V.bab.toFixed(1)} a day`, 0, -20);
  /* unit board labels */
  label({ id: 'ue', slides: [3, 7], cls: 'dim', m: 0, anchor: () => unitG.position.clone().add(new THREE.Vector3(ds && ds.kind === 'hz' ? -4 : -6, 0, ds && ds.kind === 'hz' ? -5.3 : -8.7)), txt: () => (ds && ds.kind === 'hz' ? 'Expected: one slot for each February transit' : 'Expected: one slot for each ship in the June average week'), dx: 0, dy: 0, al: 'l' });
  label({ id: 'ut', slides: [3, 7], cls: 'red', anchor: () => unitG.position.clone().add(new THREE.Vector3(ds && ds.kind === 'hz' ? -5 : -5.5, 0, ds && ds.kind === 'hz' ? 2.3 : 0.8)), txt: () => { const lost = ds ? ds.n - unitLive : 0; return ds && ds.kind === 'hz' ? `Did not cross, against February: ${lost}` : `Missing against June: ${lost}`; }, dx: 0, dy: 0, al: 'l' });
  label({ id: 'ug', slides: [3, 7], cls: '', m: 0, anchor: () => unitG.position.clone().add(ds && ds.kind === 'hz' ? new THREE.Vector3(3.5, 3.4, 1.9) : new THREE.Vector3(13.9, 3.4, -.9)), txt: () => { const f = ds ? 1 - unitLive / ds.n : 0; return `Valve ${Math.round(f * 100)}% closed`; }, dx: 0, dy: -4 });
  /* dial board labels */
  [['risk', 'War-risk cover, % of hull', () => (T.units ? '3% at Yanbu, 30 Sep' : '0.1%, 23 Jul')], ['rate', 'Supertanker, $ thousand a day', () => (T.units ? '1,290 on 24 Sep' : '678 in Aug')], ['days', 'Added to the trip to Asia', () => (T.units ? '+22 days' : 'direct route')], ['shut', 'Saudi output shut in, mb/d', () => (T.units ? '3.55 in Aug' : '1.95 in Jul')]].forEach(([k, cap, val]) => {
    label({ id: 'dv' + k, slides: [9], cls: 'ink', anchor: () => dialTop(k, 2.2), txt: val, dx: 0, dy: -14 });
    label({ id: 'dc' + k, slides: [9], cls: 'dim', anchor: () => dialTop(k, -.2), txt: cap, dx: 0, dy: 44 });
  });
  /* brent labels */
  [60, 80, 100, 120, 140].forEach(p => label({ id: 'ay' + p, slides: [10], cls: 'dim', anchor: () => brentG.position.clone().add(new THREE.Vector3(BX0 - .9, by(p), BZ + .2)), txt: '$' + p, dx: -10, dy: 0, al: 'r', m: 0 }));
  ['2026-03-01', '2026-04-01', '2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01', '2026-09-01'].forEach((d, i) => label({ id: 'ax' + i, slides: [10], cls: 'dim', anchor: () => brentG.position.clone().add(new THREE.Vector3(bx(DAY(d)), 0.45, BZ + .2)), txt: ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'][i], dx: 0, dy: 4, m: 0 }));
  pinObjs.forEach((po, i) => label({ id: 'pin' + i, slides: [10], cls: 'num', anchor: () => brentG.position.clone().add(po.anchor), txt: () => (po.g.visible ? String(i + 1) : null), dx: 0, dy: -2, al: 'c' }));
  label({ id: 'bnow', slides: [10], cls: 'ink', anchor: () => dialTop('brent', 2.2), txt: () => `$${priceAt(bProg).toFixed(2)}`, dx: 0, dy: -14 });

  /* ---------- camera ---------- */
  const cs = { x: 0, y: .3, z: 0, zoom: 1, sx: .15 }, ct = { x: 0, y: .3, z: 0, zoom: 1, sx: .15 };
  let camZ = 1;
  const mc = (lon, lat, zoom, sx) => { const p = P(lon, lat); return { x: p.x, y: .3, z: p.z, zoom, sx }; };
  const SC = {
    2: { cam: mc(46.5, 20.2, .86, .04), show: ['hz', 'bab'], lanes: true, size: { hz: 1.25, bab: 1.25 } },
    3: { cam: { x: 53.5, z: 0.5, zoom: 1.12, sx: .12 }, show: [] },
    4: { cam: mc(44.4, 25.2, 1.62, .12), show: ['pipe'], lanes: false, size: { pipe: 2.7 } },
    5: { cam: mc(43.5, 19.6, .95, .08), show: ['yan', 'bab', 'hz'], lanes: true, size: { yan: 2.1, bab: 1.5, hz: 1.4 } },
    6: { cam: mc(46.2, 20.6, .9, .05), show: [], ledger: true, lanes: false },
    7: { cam: { x: 52, z: -.6, zoom: 1.05, sx: .1 }, show: [] },
    8: { cam: mc(43.9, 27.2, 1.56, .19), show: ['pipe'], size: { pipe: 2.4 } },
    9: { cam: { x: 0, y: 2.4, z: -40, zoom: .95, sx: .15 }, show: ['risk', 'rate', 'days', 'shut'] },
    10: { cam: { x: 53.2, y: 5.0, z: -39, zoom: .9, sx: .12 }, show: ['brent'] },
    11: { cam: mc(49.0, 13.6, .54, .08), show: ['hz', 'bab', 'pipe'], lanes: true, rings: true }
  };
  let curSC = SC[2], bProg = BR0, bProgT = BR0, scene3 = 2;

  function resize(w, h) {
    W = w; H = h; renderer.setSize(w, h, false); camera.aspect = w / h;
  }
  function camApply(dt, instant) {
    const k = instant || REDUCED ? 1 : 1 - Math.exp(-dt * 3.4);
    cs.x = lerp(cs.x, ct.x, k); cs.y = lerp(cs.y, ct.y, k); cs.z = lerp(cs.z, ct.z, k); cs.sx = lerp(cs.sx, MOBILE ? 0 : ct.sx, k);
    cs.zoom = Math.exp(lerp(Math.log(cs.zoom), Math.log(ct.zoom * (MOBILE ? .86 : 1)), k)); camZ = cs.zoom;
    const asp = W / H, Hv = (21 / cs.zoom) * Math.max(1, 1.45 / asp);
    camera.left = -Hv * asp / 2; camera.right = Hv * asp / 2; camera.top = Hv / 2; camera.bottom = -Hv / 2;
    camera.setViewOffset(W, H, -cs.sx * W, 0, W, H);
    camera.position.set(cs.x + Math.sin(AZ) * Math.cos(EL) * 70, Math.sin(EL) * 70 + cs.y, cs.z + Math.cos(AZ) * Math.cos(EL) * 70);
    camera.lookAt(cs.x, cs.y, cs.z); camera.updateProjectionMatrix();
  }

  /* ---------- slide scene control ---------- */
  const STN = { 2: 'map', 3: 'unit', 4: 'map', 5: 'map', 6: 'map', 7: 'unit', 8: 'map', 9: 'dial', 10: 'brent', 11: 'map' };
  const stnGroups = { map: mapG, unit: unitG, dial: dialG, brent: brentG };
  let stnWant = 'map', stnPrev = null, stnUntil = 0;
  function goScene(i, instant) {
    const nw = STN[i]; if (nw !== stnWant) { stnPrev = instant ? null : stnWant; stnUntil = performance.now() / 1000 + 1.9; stnWant = nw; }
    scene3 = i; curSC = SC[i]; if (!curSC) return;
    Object.assign(ct, { y: .3 }, curSC.cam);
    if (instant) { Object.assign(cs, ct); }
    Object.keys(dials).forEach(k => { dials[k].root.visible = (curSC.show || []).includes(k); });
    shipsH.visible = shipsB.visible = !!curSC.lanes;
    ledgerG.visible = !!curSC.ledger;
    rings.forEach(r => { r.r.visible = !!curSC.rings; });
    if (i === 3) setDataset('hz'); if (i === 7) setDataset('bab');
    unitDirty = true;
  }
  function dialSizes() {
    Object.keys(dials).forEach(k => { const d = dials[k]; const want = (curSC.size && curSC.size[k]) || 1; d.size = damp(d.size, want, 6, .016); });
  }
  function frame(dt, now) {
    camApply(dt, false);
    const S = 1 / camZ;
    for (const k in stnGroups) stnGroups[k].visible = k === stnWant || (k === stnPrev && now < stnUntil);
    V.hz = damp(V.hz, T.hz, 4, dt); V.bab = damp(V.bab, T.bab, 4, dt);
    V.pipe = damp(V.pipe, T.pipe == null ? 0 : T.pipe, 3.2, dt);
    V.yan = damp(V.yan, T.yan == null ? 0 : T.yan, 3.5, dt);
    if (REDUCED) { V.hz = T.hz; V.bab = T.bab; V.pipe = T.pipe == null ? 0 : T.pipe; V.yan = T.yan == null ? 0 : T.yan; }
    const ch = clamp(1 - V.hz / BASE_H, 0, 1), cb = clamp(1 - V.bab / BASE_B, 0, 1);
    gateH.set(ch); gateB.set(cb); gateH.scale.setScalar(S); gateB.scale.setScalar(S);
    const uf = ds ? 1 - unitLive / ds.n : 0; const gU = ds && ds.kind === 'hz' ? gateUH : gateUB; gateUH.visible = gU === gateUH; gateUB.visible = gU === gateUB; gU.userData.c = REDUCED ? uf : damp(gU.userData.c || 0, uf, 4, dt); gU.set(gU.userData.c);
    /* dials */
    Object.keys(dials).forEach(k => {
      const d = dials[k]; if (!d.root.visible) return;
      let live = d.tgt, gh = d.tgtG;
      if (k === 'hz') live = V.hz; else if (k === 'bab') live = V.bab; else if (k === 'pipe') live = V.pipe; else if (k === 'yan') live = V.yan; else if (k === 'brent') live = priceAt(bProg);
      else if (d.vals) { live = d.vals[T.units ? 1 : 0]; gh = d.vals[0]; }
      d.cur = d.vals ? damp(d.cur, live, 5, dt) : live; d.curG = d.vals ? damp(d.curG, gh, 5, dt) : gh;
      if (REDUCED && d.vals) { d.cur = live; d.curG = gh; }
      d.live.rotation.z = d.angle(d.cur); if (d.vals) d.ghost.rotation.z = d.angle(d.curG);
      const sz = (d.root.parent === mapG ? S : 1) * (d.key === 'brent' ? 1 : 1);
      d.size = damp(d.size, (curSC.size && curSC.size[k]) || 1, 6, dt);
      d.root.scale.setScalar(sz * d.size * (d.root.parent === mapG ? 1 : 1));
      d.root.rotation.y = AZ;
    });
    V.size = 1;
    /* ships */
    const tt = now;
    if (curSC.lanes) { placeShips(shipsH, spH, Math.round(V.hz), NSH, REDUCED ? 0 : tt, 1); placeShips(shipsB, spB, Math.round(V.bab), NSB, REDUCED ? 0 : tt, 1); }
    /* pipeline beads */
    const f = clamp(V.pipe / 7, 0, 1.05); const nb = Math.round(NB * Math.min(f, 1));
    const spd = REDUCED ? 0 : tt * .1 * (.35 + f * .65);
    for (let i = 0; i < NB; i++) {
      if (i >= nb) { dummy.scale.setScalar(0); dummy.position.set(0, -9, 0); }
      else { const pi = i % 2, u = ((Math.floor(i / 2) + .5) / (nb / 2) + spd) % 1; const sp = pipeSamp[pi][Math.floor(u * 399)]; dummy.position.copy(sp); dummy.scale.setScalar(1); }
      dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); beadMesh.setMatrixAt(i, dummy.matrix);
    }
    beadMesh.instanceMatrix.needsUpdate = true;
    coreMat.color.setRGB(lerp(.35, .78, Math.min(f, 1)), lerp(.39, .2, Math.min(f, 1)), lerp(.42, .11, Math.min(f, 1)));
    const ne = Math.round(NE * clamp(1 - ch, 0, 1));
    for (let i = 0; i < NE; i++) {
      if (i >= ne) { dummy.scale.setScalar(0); dummy.position.set(0, -9, 0); } else { const u = ((i + .5) / Math.max(ne, 1) + (REDUCED ? 0 : tt * .1)) % 1; dummy.position.copy(eastSamp[Math.floor(u * 59)]); dummy.scale.setScalar(1); }
      dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); eastBeads.setMatrixAt(i, dummy.matrix);
    }
    eastBeads.instanceMatrix.needsUpdate = true;
    /* pump station hits */
    stations.forEach((s, i) => {
      let c = COL.red; if (T.hits && (i === hitIdx.S1 || i === hitIdx.S2)) c = 0x1d2226; if (T.hits && i === hitIdx.C1) c = 0x7d878d;
      s.capMat.color.setHex(T.hits && (i === hitIdx.S1 || i === hitIdx.S2) ? 0xff3b1e : c);
    });
    arcT = REDUCED ? (T.hits ? 1 : 0) : clamp(arcT + (T.hits ? dt / .9 : -dt / .3), 0, 1);
    arcs8.forEach(a => { a.visible = arcT > 0 && scene3 === 8; a.geometry.setDrawRange(0, Math.floor(arcT * 31)); });
    hitMarks.forEach(m => { m.visible = T.hits && arcT > .98; m.scale.setScalar(S * 1.8); });
    /* tokens, ledger, brent, rings */
    if (ds) stepTokens(now);
    if (curSC.ledger) stepLedger(now, S);
    bProg = REDUCED ? bProgT : damp(bProg, bProgT, 1.6, dt);
    const bk = clamp((bProg - BR0) / (BR1 - BR0), 0, 1); const cnt = Math.floor(bTot * bk / 3) * 3; bGeo.setDrawRange(0, cnt);
    const hp = bCurve.getPointAt(Math.max(bk, .0001)); bHead.position.set(hp.x, hp.y, BZ + .22); bHead.visible = bk > .002;
    pinObjs.forEach(po => { po.g.visible = bProg >= po.d - .2 || (REDUCED && bProgT >= po.d); });
    rings.forEach(r => { const on = curSC.rings && ((caseSel === 'A' && (r.k === 'yan')) || (caseSel === 'B' && (r.k === 'bab' || r.k === 'yan')) || (caseSel === 'C' && (r.k === 'bab' || r.k === 'pipe')) || (caseSel === 'D' && r.k === 'hz')); r.r.visible = !!on; r.r.scale.setScalar(S * (1 + (REDUCED ? 0 : .06 * Math.sin(tt * 2.4)))); });
    /* labels */
    for (const l of LB) {
      const vis = l.slides.includes(cur + 1);
      let txt = typeof l.txt === 'function' ? l.txt() : l.txt;
      if (!vis || txt == null) { if (l.vis) { l.el.style.visibility = 'hidden'; l.vis = false; } continue; }
      const a = typeof l.anchor === 'function' ? l.anchor() : l.anchor;
      tmp.copy(a).project(camera);
      if (Math.abs(tmp.x) > 1.05 || Math.abs(tmp.y) > 1.05) { if (l.vis) { l.el.style.visibility = 'hidden'; l.vis = false; } continue; }
      if (txt !== l.last) { l.el.textContent = txt; l.last = txt; }
      const x = (tmp.x * .5 + .5) * W + (l.dx || 0), y = (-tmp.y * .5 + .5) * H + (l.dy || 0);
      const tr = l.al === 'l' ? 'translate(0,-50%)' : l.al === 'r' ? 'translate(-100%,-50%)' : 'translate(-50%,-100%)';
      l.el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) ` + tr;
      if (!l.vis) { l.el.style.visibility = 'visible'; l.vis = true; }
    }
    renderer.render(scene, camera);
  }
  let caseSel = 'A';
  return {
    renderer, resize, frame, goScene,
    snap: () => { try { renderer.render(scene, camera); return renderer.domElement.toDataURL('image/jpeg', .72); } catch (e) { return ''; } },
    setCase: c => { caseSel = c; },
    setUnits, setLedger: (n, ins) => { ledgerCurTop = n; setLedger(n, ins); },
    setBrent: (d, reset) => { bProgT = d; if (reset) bProg = BR0; },
    priceAt: d => priceAt(d),
    hitMarks, instantCam: () => { camApply(.016, true); }
  };
}

/* ================= slide logic ================= */
const slides = $$('.slide');
const ledgerBody = $('#ledger-tbl tbody');
LEDGER.forEach((g, i) => {
  const tr = document.createElement('tr'); tr.dataset.i = i;
  const m = { S: 0, I: 0, C: 0 }; g.items.forEach(it => [...it.m].forEach(c => m[c]++));
  tr.innerHTML = `<td>${g.d}</td><td>${g.where}</td><td>${m.S ? `<i class="k s"></i>${m.S} ` : ''}${m.I ? `<i class="k i"></i>${m.I} ` : ''}${m.C ? `<i class="k c"></i>${m.C}` : ''}</td>`;
  ledgerBody.appendChild(tr);
});

const keyBody = $('#bkey tbody');
BRENT_PINS.forEach((pn, k) => {
  const row = DATA.brent.find(r => r[0] === pn.iso); const dt = new Date(pn.iso + 'T00:00:00Z');
  const tr = document.createElement('tr');
  tr.innerHTML = `<td>${k + 1}</td><td>${dt.getUTCDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][dt.getUTCMonth()]}</td><td>$${Math.round(row[1])}</td><td>${pn.ev}</td>`;
  keyBody.appendChild(tr);
});
function setHud(id, num, txt) { const n = $('#h' + id + 'n'), t = $('#h' + id + 't'); if (n) n.textContent = num; if (t) t.textContent = txt; }
function stepperText(i) {
  const m = META[i]; const b = $(`.stepper[data-for="${i + 1}"]`); if (!b) return;
  const lab = i === 5 ? (step === 0 ? 'Press to reveal each strike' : `${LEDGER[step - 1].d}: ${LEDGER[step - 1].where}`) : m.st[step][0];
  const head = i === 5 ? `Entry ${step} of 9` : `Valve ${step + 1} of ${m.steps}`;
  b.innerHTML = `<svg viewBox="0 0 52 52" aria-hidden="true" style="transform:rotate(${step * 90}deg)"><circle cx="26" cy="26" r="21" fill="none" stroke="#c8321c" stroke-width="5"/><path d="M26 5v42M5 26h42" stroke="#c8321c" stroke-width="4"/><circle cx="26" cy="26" r="5" fill="#1d2226"/></svg><span class="st"><b>${head}</b><span>${lab}</span></span>`;
  b.classList.add('show');
}

function applyStep(i, instant) {
  const idx = i + 1;
  if (idx === 2) { Object.assign(T, { hz: BASE_H, bab: BASE_B, pipe: 7, yan: null, hits: false, nums: true, units: null }); }
  if (idx === 3) {
    const h = HZ[step], v = DATA.hormuz[h.k];
    Object.assign(T, { hz: v, hits: false, nums: true });
    three && three.setUnits(Math.round(v), instant);
    setHud(3, Math.round(v), `transits a day, ${h.lab}`);
  }
  if (idx === 4) { Object.assign(T, { hz: DATA.hormuz['2026-03'], bab: DATA.bab['2026-03'], pipe: 7, yan: null, hits: false, nums: true }); }
  if (idx === 5) {
    const p = PERIODS5[step]; Object.assign(T, { hz: p.hz, bab: p.bab, yan: p.y, pipe: null, hits: false, nums: true });
    setHud(5, ['0.86', '4.1', '3.75', '1.9'][step], p.txt);
  }
  if (idx === 6) {
    Object.assign(T, { hz: DATA.hormuz['2026-09'], bab: DATA.bab['2026-09'], pipe: 5.5, yan: null, hits: false, nums: false });
    three && three.setLedger(step, instant);
    const t = step ? TALLY[step - 1] : { S: 0, I: 0, C: 0 };
    $('#t-s').textContent = t.S; $('#t-i').textContent = t.I; $('#t-c').textContent = t.C;
    $$('#ledger-tbl tbody tr').forEach((tr, k) => { tr.classList.toggle('dim', k >= step); tr.classList.toggle('hit', k === step - 1); });
  }
  if (idx === 7) {
    const w = BAB_WEEKS[step]; Object.assign(T, { nums: true });
    three && three.setUnits([w.k, w.t - w.k], instant);
    setHud(7, w.t, w.hud);
  }
  if (idx === 8) {
    const p = PERIODS8[step]; Object.assign(T, { hz: DATA.hormuz['2026-09'], bab: DATA.bab['2026-09'], pipe: p.pipe, yan: null, hits: p.hits, nums: true });
    setHud(8, p.pipe === 0 ? '0' : String(p.pipe), p.txt);
  }
  if (idx === 9) { T.units = step === 1 ? 1 : null; T.nums = true; }
  if (idx === 10) { three && three.setBrent(BRENT_STEPS[step], instant); $$('#bkey tbody tr').forEach((tr, k) => tr.classList.toggle('dim', DAY(BRENT_PINS[k].iso) > BRENT_STEPS[step] + .5)); }
  if (idx === 11) { Object.assign(T, { nums: false, yan: null, hits: false }); applyCase(selCase); }
  if (META[i].st || i === 5) stepperText(i);
}
let selCase = 'A';
function applyCase(c) {
  selCase = c; const k = CASES[c]; Object.assign(T, { hz: k.hz, bab: k.bab, pipe: k.pipe, nums: false });
  three && three.setCase(c);
  $$('#scen tbody tr').forEach(tr => { const on = tr.dataset.case === c; tr.classList.toggle('sel', on); tr.setAttribute('aria-selected', on); });
}
$$('#scen tbody tr').forEach(tr => {
  tr.addEventListener('click', () => applyCase(tr.dataset.case));
  tr.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); applyCase(tr.dataset.case); } });
});

function go(i, opt = {}) {
  i = clamp(i, 0, N - 1);
  const prev = cur; const instant = !!opt.instant;
  if (MOBILE && three && prev !== i && !opt.fromScroll) {
    /* handled by scrolling */
  }
  if (MOBILE && three && prev !== i) { const d = three.snap(); const pv = slides[prev] && $('.vis', slides[prev]); if (d && pv && prev > 0) pv.style.backgroundImage = `url(${d})`; }
  cur = i; step = 0;
  slides.forEach((s, k) => s.classList.toggle('on', k === i));
  stage.classList.toggle('content', i > 0); stage.classList.toggle('cover-on', i === 0);
  $('#count').innerHTML = `PLATE ${pad2(i + 1)} OF ${N} &middot; DATA TO 3 OCT 2026`;
  history.replaceState(null, '', '#' + (i + 1));
  if (MOBILE) {
    if (i === 0 || !three) { glwrap.style.display = 'none'; }
    else { glwrap.style.display = ''; const vis = $('.vis', slides[i]); vis.style.backgroundImage = ''; vis.appendChild(glwrap); fit(); }
  }
  $$('.stepper').forEach(b => b.classList.remove('show'));
  if (three && i > 0) { three.goScene(i + 1, instant || prev === 0); }
  if (i > 0) { applyStep(i, true); }
  const m = META[i];
  auto.on = !!(m && m.steps > 1 && !REDUCED && !opt.noauto); auto.next = performance.now() + ((m && m.d0) || 2200);
  if (i === 0 && three) { /* paused by loop */ }
  if (opt.fromNav && !MOBILE) { /* nothing */ }
}
function next() { go(cur + 1, { fromNav: 1 }); }
function prev() { go(cur - 1, { fromNav: 1 }); }
function doStep() {
  const m = META[cur]; if (!m || m.steps < 2) return;
  auto.on = false; step = (step + 1) % m.steps; applyStep(cur, false);
}
$$('.stepper').forEach(b => b.addEventListener('click', doStep));

/* nav */
$('#b-next').addEventListener('click', () => (MOBILE ? scrollToSlide(cur + 1) : next()));
$('#b-prev').addEventListener('click', () => (MOBILE ? scrollToSlide(cur - 1) : prev()));
function scrollToSlide(i) { i = clamp(i, 0, N - 1); slides[i].scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' }); }
addEventListener('keydown', e => {
  if ($('#src').classList.contains('open')) { if (e.key === 'Escape') closeSrc(); return; }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const tag = (e.target.tagName || '').toLowerCase();
  const onBtn = tag === 'button' || tag === 'a' || tag === 'tr';
  if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === 'ArrowDown' || (e.key === ' ' && !onBtn)) { e.preventDefault(); MOBILE ? scrollToSlide(cur + 1) : next(); }
  else if (e.key === 'ArrowLeft' || e.key === 'PageUp' || e.key === 'ArrowUp') { e.preventDefault(); MOBILE ? scrollToSlide(cur - 1) : prev(); }
  else if (e.key === 'Home') { e.preventDefault(); go(0); }
  else if (e.key === 'End') { e.preventDefault(); go(N - 1); }
  else if ((e.key === 'Enter' || e.key === '.') && !onBtn) { e.preventDefault(); doStep(); }
  else if (e.key === 's' || e.key === 'S') openSrc();
});
let tx = 0, ty = 0;
stage.addEventListener('touchstart', e => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
stage.addEventListener('touchend', e => { if (MOBILE) return; const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty; if (Math.abs(dx) > 50 && Math.abs(dy) < 60) (dx < 0 ? next() : prev()); }, { passive: true });
addEventListener('hashchange', () => { const n = parseInt(location.hash.slice(1), 10); if (n >= 1 && n <= N && n - 1 !== cur) { MOBILE ? scrollToSlide(n - 1) : go(n - 1); } });

/* sources */
const srcEl = $('#src'); let lastFocus = null;
function openSrc(refs) {
  lastFocus = document.activeElement; srcEl.classList.add('open'); srcEl.setAttribute('aria-hidden', 'false');
  $$('#src li').forEach(li => li.classList.remove('hl'));
  if (refs) { const ids = refs.split(/\s+/); ids.forEach(id => { const li = $('#' + id); if (li) li.classList.add('hl'); }); const f = $('#' + ids[0]); if (f) f.scrollIntoView({ block: 'center' }); }
  $('#src .panel').focus();
}
function closeSrc() { srcEl.classList.remove('open'); srcEl.setAttribute('aria-hidden', 'true'); if (lastFocus) lastFocus.focus(); }
$('#b-src').addEventListener('click', () => openSrc());
$('#src-x').addEventListener('click', closeSrc);
$('#src .scrim').addEventListener('click', closeSrc);
$$('a[data-ref]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); openSrc(a.dataset.ref); }));

/* layout */
function fit() {
  MOBILE = innerWidth < 760 || innerWidth / innerHeight < .9;
  root.classList.toggle('m', MOBILE);
  if (!MOBILE && glwrap.parentElement !== stage) { stage.insertBefore(glwrap, stage.firstChild); glwrap.style.display = ''; $$('.vis').forEach(v => { v.style.backgroundImage = ''; }); }
  else if (MOBILE && glwrap.parentElement === stage && typeof cur === 'number') { queueMicrotask(() => go(cur, { instant: true })); }
  if (MOBILE) {
    stage.style.width = ''; stage.style.height = '';
    stage.style.setProperty('--u', '.5');
    if (three) { const r = glwrap.getBoundingClientRect(); const w = Math.max(200, Math.round(r.width) || 360), h = Math.max(200, Math.round(r.height) || 340); three.resize(w, h); }
  } else {
    const aw = innerWidth, ah = innerHeight; let w, h;
    if (aw / ah > 16 / 9) { h = ah; w = Math.round(ah * 16 / 9); } else { w = aw; h = Math.round(aw * 9 / 16); }
    stage.style.width = w + 'px'; stage.style.height = h + 'px'; stage.style.setProperty('--u', (w / 1440).toFixed(4));
    if (three) three.resize(w, h);
  }
}
addEventListener('resize', () => { fit(); });

/* boot */
(async function boot() {
  try { await Promise.race([document.fonts.load('700 38px "Barlow Condensed"').then(() => document.fonts.load('400 25px "B612 Mono"')), new Promise(r => setTimeout(r, 2500))]); } catch (e) { }
  three = build3D();
  fit();
  const h0 = parseInt(location.hash.slice(1), 10);
  go(h0 >= 1 && h0 <= N ? h0 - 1 : 0, { instant: true });
  window.__deck = { go, doStep, setStep: k => { auto.on = false; step = k; applyStep(cur, false); }, get cur() { return cur; }, get step() { return step; }, three, T, V };
  if (three && h0 > 1) { three.instantCam(); }
  /* render loop */
  let last = performance.now(), visible = true;
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => { es.forEach(en => { if (en.target === glwrap) visible = en.isIntersecting; }); }, { threshold: 0 }) : null;
  if (io) io.observe(glwrap);
  function tick(nowMs) {
    requestAnimationFrame(tick);
    const dt = Math.min(.05, (nowMs - last) / 1000); last = nowMs;
    if (auto.on && nowMs >= auto.next) {
      const m = META[cur];
      if (step < m.steps - 1) { step++; applyStep(cur, false); auto.next = nowMs + (m.iv || 3000); } else auto.on = false;
    }
    if (!three || document.hidden || cur === 0 || !visible) return;
    three.frame(dt, nowMs / 1000);
  }
  requestAnimationFrame(tick);
  /* phone: the visible plate drives the 3D state */
  if ('IntersectionObserver' in window) {
    const so = new IntersectionObserver(es => {
      if (!MOBILE) return;
      es.forEach(en => { if (en.isIntersecting && en.intersectionRatio > .55) { const k = slides.indexOf(en.target); if (k !== cur) go(k, { fromScroll: 1, instant: true }); } });
    }, { threshold: [.55] });
    slides.forEach(s => so.observe(s));
  }
})();
