// The acetate table: one three.js scene, five states.
//  front       stack of month sheets over the Donetsk front (device 1)
//  cityLedger  strike ledger over the Kyiv sheet (device 2)
//  cityBridges the eight Dnipro bridges
//  chain       the step-through coercion chain (device 3)
//  pressure    the stack separates as the indicator panel's pressure rises (device 4)
import * as THREE from 'three';

/* ---------------------------------------------------------------- geography */
const LON0 = 23, LON1 = 39, LAT0 = 45.9, LAT1 = 51.3, KX = 0.66;
const MW = (LON1 - LON0) * KX, MH = LAT1 - LAT0;
const X = lon => (lon - LON0) * KX - MW / 2;
const Z = lat => -((lat - LAT0) - MH / 2);
const MAP_W = 3072, MAP_H = Math.round(3072 * MH / MW);

const PLACES = [
  { n: 'Kyiv', lon: 30.523, lat: 50.45, big: 1 },
  { n: 'Kharkiv', lon: 36.23, lat: 49.99 },
  { n: 'Lviv', lon: 24.03, lat: 49.84 },
  { n: 'Odesa', lon: 30.72, lat: 46.48 },
  { n: 'Kupiansk', lon: 37.62, lat: 49.71, side: 'l' },
  { n: 'Lyman', lon: 37.81, lat: 48.99 },
  { n: 'Sloviansk', lon: 37.62, lat: 48.85, side: 'l' },
  { n: 'Kostiantynivka', lon: 37.70, lat: 48.53 },
  { n: 'Pokrovsk', lon: 37.18, lat: 48.28, side: 'l' },
  { n: 'Huliaipole', lon: 36.26, lat: 47.66 },
  { n: 'Orikhiv', lon: 35.78, lat: 47.57, side: 'l' }
];
const DNIPRO = [[30.1, 51.35], [30.52, 50.45], [31.47, 49.75], [32.06, 49.44], [33.42, 49.07], [35.04, 48.46], [35.14, 47.84], [34.4, 47.57], [32.62, 46.64], [32.3, 46.45]];
const DONETS = [[36.2, 50.1], [36.7, 49.84], [37.25, 49.2], [37.81, 49.0], [38.4, 48.9], [39, 48.7]];
const BLACKSEA = [[29.5, 45.9], [30.2, 46.0], [30.74, 46.48], [31.55, 46.62], [32.0, 46.45], [33.0, 46.1], [33.5, 46.05], [33.6, 45.9]];
const AZOV = [[35.0, 45.9], [35.3, 46.2], [35.9, 46.55], [36.8, 46.75], [37.55, 47.1], [38.3, 47.1], [38.9, 47.2], [39, 45.9]];
// schematic contact line threaded through the named sectors
const BASE = [[36.0, 50.7], [37.35, 49.95], [37.78, 49.45], [37.95, 49.0], [37.72, 48.5], [37.3, 48.28], [36.7, 47.9], [36.26, 47.66], [35.75, 47.5], [35.2, 47.45], [34.7, 47.45]];

/* ---------------------------------------------------------------- helpers */
const INK = '#2a241a', RED = '#e2493d', BLUE = '#5f8be0';
function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash2(ix, iy, seed) { let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 1442695041); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967295; }
function vnoise(x, y, seed = 1) { const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, s = t => t * t * (3 - 2 * t), u = s(fx), v = s(fy); const a = hash2(ix, iy, seed), b = hash2(ix + 1, iy, seed), c = hash2(ix, iy + 1, seed), d = hash2(ix + 1, iy + 1, seed); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
function fbm(x, y, seed = 1, o = 4) { let s = 0, a = .5, f = 1; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, y * f, seed + i); f *= 2; a *= .5; } return s; }
function catmull(pts, seg = 10) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let s = 0; s < seg; s++) {
      const t = s / seg, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(k => .5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)));
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const easeIO = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// grease-pencil stroke: several offset passes of varying weight and alpha
function pencil(g, pts, o = {}) {
  const { color = RED, w = 6, passes = 3, jit = 2.2, alpha = .85, seed = 1, dash = null } = o;
  const r = mulberry(seed);
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = color;
  if (dash) g.setLineDash(dash);
  for (let p = 0; p < passes; p++) {
    g.globalAlpha = alpha * (.5 + r() * .5); g.lineWidth = w * (.55 + r() * .6);
    g.beginPath();
    let ox = (r() - .5) * jit, oy = (r() - .5) * jit;
    pts.forEach((q, i) => {
      if (i % 5 === 0) { ox += (r() - .5) * jit * .45; oy += (r() - .5) * jit * .45; ox *= .92; oy *= .92; }
      const x = q[0] + ox, y = q[1] + oy;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    });
    g.stroke();
  }
  g.restore();
}
// ticks along a line, pointing to one side (front-line symbol)
function ticks(g, pts, o = {}) {
  const { color = RED, len = 15, gap = 30, dirx = -1, w = 4, seed = 2 } = o;
  const r = mulberry(seed);
  let acc = gap * .5;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
    if (!L) continue;
    acc += L;
    if (acc >= gap) {
      acc = 0;
      let nx = -dy / L, ny = dx / L;
      if (nx * dirx < 0) { nx = -nx; ny = -ny; }
      const l = len * (.85 + r() * .3);
      pencil(g, [[b[0], b[1]], [b[0] + nx * l, b[1] + ny * l]], { color, w, passes: 2, jit: 1.2, alpha: .85, seed: Math.floor(r() * 1e6) });
    }
  }
}
const GRAIN = (() => { const a = new Uint8Array(65536); const r = mulberry(99); for (let i = 0; i < a.length; i++) a[i] = r() * 255; return a; })();
function grainify(c, amount = .5) {
  const g = c.getContext('2d'), id = g.getImageData(0, 0, c.width, c.height), d = id.data;
  for (let i = 3, k = 0; i < d.length; i += 4, k++) {
    const a = d[i];
    if (a > 60) d[i] = a * (1 - amount * GRAIN[(k * 977) & 65535] / 255);
  }
  g.putImageData(id, 0, 0);
}

/* ---------------------------------------------------------------- textures */
const px = (lon, lat) => [(lon - LON0) / (LON1 - LON0) * MAP_W, (LAT1 - lat) / MH * MAP_H];

function contourLines(g, f, gw, gh, W, H, levels, o) {
  const sx = W / (gw - 1), sy = H / (gh - 1);
  levels.forEach((L, li) => {
    g.beginPath();
    for (let j = 0; j < gh - 1; j++) for (let i = 0; i < gw - 1; i++) {
      const a = f[j * gw + i], b = f[j * gw + i + 1], c = f[(j + 1) * gw + i + 1], d = f[(j + 1) * gw + i];
      const idx = (a > L ? 8 : 0) | (b > L ? 4 : 0) | (c > L ? 2 : 0) | (d > L ? 1 : 0);
      if (idx === 0 || idx === 15) continue;
      const t = (p, q) => (L - p) / (q - p);
      const T = [i + t(a, b), j], R = [i + 1, j + t(b, c)], B = [i + t(d, c), j + 1], Lf = [i, j + t(a, d)];
      const seg = { 1: [Lf, B], 2: [B, R], 3: [Lf, R], 4: [T, R], 5: [T, Lf, B, R], 6: [T, B], 7: [T, Lf], 8: [T, Lf], 9: [T, B], 10: [T, R, Lf, B], 11: [T, R], 12: [Lf, R], 13: [B, R], 14: [Lf, B] }[idx];
      for (let k = 0; k < seg.length; k += 2) { g.moveTo(seg[k][0] * sx, seg[k][1] * sy); g.lineTo(seg[k + 1][0] * sx, seg[k + 1][1] * sy); }
    }
    g.strokeStyle = o.color; g.lineWidth = li % 5 === 0 ? o.wMajor : o.w; g.globalAlpha = li % 5 === 0 ? o.aMajor : o.a;
    g.stroke();
  });
  g.globalAlpha = 1;
}
function paperBase(g, W, H, seed) {
  g.fillStyle = '#cdbd91'; g.fillRect(0, 0, W, H);
  const gw = 256, gh = Math.round(256 * H / W);
  const low = mkCanvas(gw, gh), lg = low.getContext('2d'), img = lg.createImageData(gw, gh);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    const n = fbm(x / gw * 5, y / gw * 5, seed, 4);
    const green = clamp((n - .5) * 3.2, 0, 1), dry = clamp((.42 - n) * 3, 0, 1);
    const i = (y * gw + x) * 4;
    img.data[i] = 205 - green * 26 - dry * 4; img.data[i + 1] = 189 + green * 4 - dry * 14; img.data[i + 2] = 145 - green * 28 - dry * 20; img.data[i + 3] = 255;
  }
  lg.putImageData(img, 0, 0);
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(low, 0, 0, W, H);
  // fibre
  const r = mulberry(seed + 5);
  for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${r() < .5 ? '90,70,40' : '255,248,225'},${.03 + r() * .05})`; g.fillRect(r() * W, r() * H, 1 + r() * 3, 1 + r() * 1.5); }
}
function terrainContours(g, W, H, seed, scale) {
  const gw = 420, gh = Math.round(420 * H / W), f = new Float32Array(gw * gh);
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) f[j * gw + i] = fbm(i / gw * scale, j / gw * scale, seed, 5);
  const levels = []; for (let L = .28; L < .78; L += .026) levels.push(L);
  contourLines(g, f, gw, gh, W, H, levels, { color: '#7a5a34', w: 1.1 * W / 3072, wMajor: 2 * W / 3072, a: .34, aMajor: .55 });
}

function makeMapCanvas() {
  const W = MAP_W, H = MAP_H, c = mkCanvas(W, H), g = c.getContext('2d');
  paperBase(g, W, H, 11);
  terrainContours(g, W, H, 3, 7);
  // sea
  const poly = (pts, fill, stroke) => { g.beginPath(); pts.forEach(([lo, la], i) => { const [x, y] = px(lo, la); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); g.fillStyle = fill; g.fill(); if (stroke) { g.strokeStyle = stroke; g.lineWidth = 4; g.stroke(); } };
  poly(BLACKSEA, '#8fb2b9', '#5d8791'); poly(AZOV, '#8fb2b9', '#5d8791');
  // rivers
  const river = (pts, w) => { const d = catmull(pts.map(p => px(p[0], p[1])), 12); g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#6f98a3'; g.lineWidth = w + 3; g.beginPath(); d.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); g.strokeStyle = '#9ec0c6'; g.lineWidth = w; g.stroke(); };
  river(DNIPRO, 7); river(DONETS, 4);
  // graticule
  g.strokeStyle = 'rgba(70,50,28,.38)'; g.lineWidth = 1.5; g.fillStyle = 'rgba(60,44,24,.8)'; g.font = '17px "PT Mono", monospace';
  for (let lo = LON0 + 1; lo < LON1; lo++) { const [x] = px(lo, 0); g.beginPath(); g.moveTo(x, 34); g.lineTo(x, H - 34); g.stroke(); g.fillText(lo + '°E', x + 6, 56); }
  for (let la = Math.ceil(LAT0); la < LAT1; la++) { const [, y] = px(0, la); g.beginPath(); g.moveTo(34, y); g.lineTo(W - 34, y); g.stroke(); g.fillText(la + '°N', 46, y - 6); }
  // places
  PLACES.forEach(p => {
    const [x, y] = px(p.lon, p.lat);
    g.fillStyle = INK; g.strokeStyle = INK;
    if (p.big) { g.lineWidth = 4; g.beginPath(); g.arc(x, y, 15, 0, 7); g.stroke(); g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill(); }
    else { g.beginPath(); g.arc(x, y, 6.5, 0, 7); g.fill(); }
    g.font = `italic 700 ${p.big ? 44 : 29}px "PT Serif", serif`;
    g.textAlign = p.side === 'l' ? 'right' : 'left';
    g.fillText(p.n, x + (p.side === 'l' ? -14 : 14) * (p.big ? 1.5 : 1), y + (p.big ? 14 : 9));
  });
  g.textAlign = 'left';
  // water labels
  g.fillStyle = 'rgba(35,70,82,.85)'; g.font = 'italic 400 34px "PT Serif", serif';
  let [bx, by] = px(31.6, 46.0); g.fillText('Black Sea', bx - 90, by + 10);
  [bx, by] = px(37.1, 46.3); g.fillText('Sea of Azov', bx, by);
  const dn = px(33.0, 49.2); g.save(); g.translate(dn[0] + 30, dn[1] - 24); g.rotate(.22); g.fillText('Dnipro', 0, 0); g.restore();
  // frame
  g.strokeStyle = 'rgba(40,30,16,.85)'; g.lineWidth = 7; g.strokeRect(18, 18, W - 36, H - 36); g.lineWidth = 2; g.strokeRect(30, 30, W - 60, H - 60);
  g.fillStyle = 'rgba(50,38,20,.85)'; g.font = '19px "PT Mono", monospace';
  g.fillText('Schematic sheet. Place positions approximate. Contours and coastlines are drawn for orientation only.', 52, H - 46);
  return c;
}

/* ---- month sheets (acetate) ---- */
const SL0 = 34.1, SL1 = 39.0, SA0 = 46.45, SA1 = 50.9;
const SW_U = (SL1 - SL0) * KX, SH_U = SA1 - SA0;
const SPX = 1024, SPY = Math.round(1024 * SH_U / SW_U);
const spx = (lon, lat) => [(lon - SL0) / (SL1 - SL0) * SPX, (SA1 - lat) / (SA1 - SA0) * SPY];
const KM_TO_U = 0.0012; // scene units per km2 of one month's change
const SHEETS = [
  { label: 'June 2025', fig: '+481.25 km²', km: 481.25 },
  { label: 'June 2026', fig: '+30.42 km²', km: 30.42 },
  { label: 'September 2026', fig: '−80.81 km² net', km: -80.81, arrow: true },
  { label: 'Putin\'s claim, Sept 2026', fig: '+1,301 km²', km: 1301, ghost: true }
];
const JIT = (() => { const r = mulberry(21); return BASE.map(() => [(r() - .5) * .05, (r() - .5) * .05]); })();
function shifted(d) { return BASE.map(([lo, la], i) => [lo + (-.93 * d) / KX + JIT[i][0], la + .37 * d + JIT[i][1]]); }
function drawSheet(spec, idx) {
  const c = mkCanvas(SPX, SPY), g = c.getContext('2d');
  // acetate body
  g.fillStyle = 'rgba(236,246,250,.075)'; g.fillRect(0, 0, SPX, SPY);
  const sheen = g.createLinearGradient(0, 0, SPX, SPY);
  sheen.addColorStop(0, 'rgba(255,255,255,.12)'); sheen.addColorStop(.4, 'rgba(255,255,255,0)'); sheen.addColorStop(.7, 'rgba(255,255,255,.05)'); sheen.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = sheen; g.fillRect(0, 0, SPX, SPY);
  g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 5; g.strokeRect(2.5, 2.5, SPX - 5, SPY - 5);
  // registration crosses
  [[28, 28], [SPX - 28, 28], [28, SPY - 28], [SPX - 28, SPY - 28]].forEach(([x, y]) => { g.strokeStyle = 'rgba(40,30,20,.55)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 9, y); g.lineTo(x + 9, y); g.moveTo(x, y - 9); g.lineTo(x, y + 9); g.stroke(); });
  const d = spec.km * KM_TO_U;
  const basePx = catmull(shifted(0).map(p => spx(p[0], p[1])), 12);
  pencil(g, basePx, { color: '#1c1710', w: 5, passes: 2, alpha: .7, seed: 12, dash: [2, 15] });
  const red = catmull(shifted(d).map(p => spx(p[0], p[1])), 12);
  const blue = catmull(shifted(d + .1).map(p => spx(p[0], p[1])), 12);
  if (spec.ghost) {
    pencil(g, red, { color: RED, w: 7, passes: 3, seed: 30 + idx, alpha: .8, dash: [22, 16] });
    ticks(g, red, { color: RED, dirx: -1, gap: 34, len: 14, seed: 5 });
  } else {
    pencil(g, blue, { color: BLUE, w: 7, passes: 3, seed: 40 + idx, alpha: .9 });
    ticks(g, blue, { color: BLUE, dirx: 1, gap: 30, len: 15, seed: 6 + idx });
    pencil(g, red, { color: RED, w: 8, passes: 3, seed: 50 + idx, alpha: .92 });
    ticks(g, red, { color: RED, dirx: -1, gap: 28, len: 16, seed: 9 + idx });
  }
  { // measuring bar between the start line and this month's line
    const i = 4, a = spx(...shifted(0)[i]), b = spx(...shifted(d)[i]);
    pencil(g, [a, b], { color: '#f6efdd', w: 4, passes: 2, alpha: .9, seed: 14, jit: .8 });
    [a, b].forEach(q => pencil(g, [[q[0], q[1] - 14], [q[0], q[1] + 14]], { color: '#f6efdd', w: 4, passes: 2, alpha: .9, seed: 15, jit: .8 }));
  }
  if (spec.arrow) {
    const a = spx(37.74, 48.93), b = spx(38.12, 49.22);
    pencil(g, [a, [a[0] + (b[0] - a[0]) * .5, a[1] + (b[1] - a[1]) * .5], b], { color: BLUE, w: 9, passes: 3, seed: 77, jit: 3 });
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    pencil(g, [[b[0] - Math.cos(ang - .5) * 30, b[1] - Math.sin(ang - .5) * 30], b, [b[0] - Math.cos(ang + .5) * 30, b[1] - Math.sin(ang + .5) * 30]], { color: BLUE, w: 8, passes: 3, seed: 78, jit: 2 });
    g.fillStyle = BLUE; g.font = 'italic 400 34px "PT Serif", serif'; g.fillText('Vivaldi', b[0] + 12, b[1] - 8);
  }
  // hand lettering, one line in the clear margin below the front
  g.fillStyle = RED;
  g.font = 'italic 700 44px "PT Serif", serif'; g.fillText(spec.label, 44, SPY - 44);
  const lw = g.measureText(spec.label).width;
  g.font = '32px "PT Mono", monospace'; g.fillText(spec.fig, 44 + lw + 26, SPY - 44);
  grainify(c, .55);
  return c;
}
function shadowCanvas() {
  const c = mkCanvas(256, 320), g = c.getContext('2d');
  g.shadowColor = 'rgba(0,0,0,.9)'; g.shadowBlur = 34; g.fillStyle = '#000'; g.fillRect(78, 98, 100, 124);
  return c;
}

/* ---- city sheet ---- */
const CW = 6.4, CH = 3.6, CPX = 2048, CPY = 1152, CU = CPX / CW;
const cp = (x, z) => [(x + CW / 2) * CU, (z + CH / 2) * CU];
const RIVER_PTS = [[-.35, -1.8], [-.2, -1.1], [.15, -.55], [.1, 0], [.3, .6], [.55, 1.2], [.75, 1.8]];
const RIVER = catmull(RIVER_PTS, 16);
const RIVER_W = .46;
function riverAt(t) { // t 0 north .. 1 south
  const i = clamp(t, 0, 1) * (RIVER.length - 1), a = Math.floor(i), b = Math.min(RIVER.length - 1, a + 1), f = i - a;
  const p = [RIVER[a][0] + (RIVER[b][0] - RIVER[a][0]) * f, RIVER[a][1] + (RIVER[b][1] - RIVER[a][1]) * f];
  const dx = RIVER[b][0] - RIVER[a][0], dz = RIVER[b][1] - RIVER[a][1], L = Math.hypot(dx, dz) || 1;
  return { x: p[0], z: p[1], tx: dx / L, tz: dz / L };
}
const BRIDGES = [
  { t: .08 }, { t: .22 }, { t: .35 }, { t: .45 },
  { t: .56, name: 'Paton Bridge', st: 'lim' },
  { t: .68 }, { t: .79 },
  { t: .91, name: 'Southern Bridge', st: 'hit' }
];
function makeCityCanvas() {
  const c = mkCanvas(CPX, CPY), g = c.getContext('2d');
  paperBase(g, CPX, CPY, 31);
  terrainContours(g, CPX, CPY, 8, 5);
  // river
  const pts = RIVER.map(p => cp(p[0], p[1]));
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = '#6f98a3'; g.lineWidth = RIVER_W * CU + 8; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke();
  g.strokeStyle = '#9ec0c6'; g.lineWidth = RIVER_W * CU; g.stroke();
  // blocks: dense west bank, lighter east bank
  const r = mulberry(5);
  const kc = [-.75, .1];
  for (let y = 40; y < CPY - 40; y += 15) for (let x = 40; x < CPX - 40; x += 15) {
    const wx = x / CU - CW / 2, wz = y / CU - CH / 2;
    // distance to river centre line
    let md = 9, side = 0;
    for (let k = 0; k < RIVER.length; k += 4) { const dd = Math.hypot(wx - RIVER[k][0], wz - RIVER[k][1]); if (dd < md) { md = dd; side = wx < RIVER[k][0] ? -1 : 1; } }
    if (md < RIVER_W / 2 + .06) continue;
    const dist = Math.hypot(wx - kc[0], (wz - kc[1]) * 1.15);
    const dens = side < 0 ? 1.55 - dist * .62 : 1.0 - Math.hypot(wx - 1.5, wz - .2) * .75;
    if (dens + (fbm(x / 140, y / 140, 6) - .5) * .8 < .38 || r() > .8) continue;
    g.fillStyle = `rgba(78,66,50,${.5 + r() * .3})`;
    g.fillRect(x, y, 6 + r() * 7, 6 + r() * 6);
  }
  // parks
  g.fillStyle = 'rgba(120,140,86,.42)';
  for (let i = 0; i < 9; i++) { const x = (r() * .6 + .1) * CPX, y = (r() * .7 + .15) * CPY; g.beginPath(); g.ellipse(x, y, 40 + r() * 70, 22 + r() * 40, r() * 3, 0, 7); g.fill(); }
  // graticule ticks
  g.strokeStyle = 'rgba(70,50,28,.3)'; g.lineWidth = 1.5;
  for (let i = 1; i < 8; i++) { g.beginPath(); g.moveTo(i * CPX / 8, 30); g.lineTo(i * CPX / 8, CPY - 30); g.stroke(); }
  for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(30, i * CPY / 5); g.lineTo(CPX - 30, i * CPY / 5); g.stroke(); }
  // labels
  g.fillStyle = INK; g.font = 'italic 700 56px "PT Serif", serif';
  const k = cp(-1.05, .55); g.fillText('Kyiv', k[0], k[1]);
  g.font = 'italic 400 34px "PT Serif", serif'; g.fillStyle = 'rgba(35,70,82,.9)';
  const dn = cp(.25, -1.35); g.save(); g.translate(dn[0], dn[1]); g.rotate(1.2); g.fillText('Dnipro', 0, 0); g.restore();
  g.fillStyle = INK; g.font = 'italic 700 30px "PT Serif", serif';
  BRIDGES.filter(b => b.name).forEach(b => {
    const a = riverAt(b.t), [x, y] = cp(a.x, a.z);
    g.fillText(b.name, x + RIVER_W * CU * .5 + 22, y + 10);
  });
  g.strokeStyle = 'rgba(40,30,16,.85)'; g.lineWidth = 7; g.strokeRect(14, 14, CPX - 28, CPY - 28);
  g.fillStyle = 'rgba(50,38,20,.85)'; g.font = '17px "PT Mono", monospace';
  g.fillText('Schematic city sheet. Bridge positions along the river are approximate.', 36, CPY - 34);
  return c;
}

/* ---- ledger acetate ---- */
const NIGHTS = [
  { date: '24 May', d: 600, m: 90, l1: '600 drones', l2: '90 missiles' },
  { date: '2 Jun', d: 656, m: 73, l1: '656 drones', l2: '73 missiles' },
  { date: '2 Jul', d: 496, m: 74, l1: '496 drones', l2: '74 missiles' },
  { date: '1 Sep', d: 0, m: 0, l1: 'no count', l2: 'in sources' },
  { date: '1-2 Oct', d: 0, m: 0, l1: 'no count', l2: 'in sources' }
];
const SLOTW = [1.0, 1.0, 1.0, .78, .78], SLOTGAP = .3;
const slotX = (() => { const tot = SLOTW.reduce((a, b) => a + b, 0) + SLOTGAP * 4; let x = -tot / 2; return SLOTW.map(w => { const c = x + w / 2; x += w + SLOTGAP; return c; }); })();
const DOT_Z0 = -.85, PITCH = .05;
function dotLayout() {
  const drones = [], missiles = [];
  NIGHTS.forEach((n, ni) => {
    const dl = [], ml = [];
    const x0 = slotX[ni] - 9.5 * PITCH;
    for (let k = 0; k < n.d; k++) { const row = Math.floor(k / 20), col = k % 20; dl.push([x0 + col * PITCH, DOT_Z0 + row * PITCH + Math.floor(row / 5) * .045]); }
    const rows = Math.ceil(n.d / 20), zm = DOT_Z0 + rows * PITCH + Math.floor(rows / 5) * .045 + .1;
    for (let k = 0; k < n.m; k++) { const row = Math.floor(k / 20), col = k % 20; ml.push([x0 + col * PITCH, zm + row * PITCH]); }
    drones.push(dl); missiles.push(ml);
  });
  return { drones, missiles };
}
function drawLedger(c, count) {
  const g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  g.fillStyle = 'rgba(236,246,250,.085)'; g.fillRect(0, 0, c.width, c.height);
  const sheen = g.createLinearGradient(0, 0, c.width, c.height);
  sheen.addColorStop(0, 'rgba(255,255,255,.12)'); sheen.addColorStop(.45, 'rgba(255,255,255,0)'); sheen.addColorStop(.75, 'rgba(255,255,255,.05)'); sheen.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = sheen; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 5; g.strokeRect(2.5, 2.5, c.width - 5, c.height - 5);
  // ruling
  NIGHTS.forEach((n, i) => {
    const w = SLOTW[i], [x, y0] = cp(slotX[i] - w / 2, -1.62), [x1, y1] = cp(slotX[i] + w / 2, 1.5);
    const on = i < count;
    g.strokeStyle = on ? 'rgba(40,30,20,.55)' : 'rgba(40,30,20,.28)'; g.lineWidth = 2; g.setLineDash(on && (n.d || n.m) ? [] : [10, 9]);
    g.strokeRect(x, y0, x1 - x, y1 - y0); g.setLineDash([]);
    if (on) {
      const cx = (x + x1) / 2;
      g.textAlign = 'center'; g.lineJoin = 'round'; g.strokeStyle = 'rgba(18,14,9,.9)';
      const put = (t, y, font, fill, lw) => { g.font = font; g.lineWidth = lw; g.strokeText(t, cx, y); g.fillStyle = fill; g.fillText(t, cx, y); };
      put(n.date, y0 + 66, '700 60px "PT Mono", monospace', '#f6efdd', 8);
      put(n.l1, y0 + 108, '31px "PT Mono", monospace', '#e8dfc8', 6);
      put(n.l2, y0 + 142, '31px "PT Mono", monospace', '#e8dfc8', 6);
    }
  });
  g.textAlign = 'left';
  // legend
  const [lx, ly] = cp(-3.0, 1.62);
  g.fillStyle = 'rgba(18,14,9,.72)'; g.fillRect(lx - 16, ly - 26, 1130, 52);
  g.fillStyle = '#e2493d'; g.beginPath(); g.arc(lx, ly, 6, 0, 7); g.fill();
  g.fillStyle = '#f1e9d6'; g.font = '26px "PT Mono", monospace'; g.fillText('one drone', lx + 16, ly + 9);
  g.strokeStyle = '#e2493d'; g.lineWidth = 4; g.beginPath(); g.arc(lx + 230, ly, 10, 0, 7); g.stroke();
  g.fillText('one missile', lx + 252, ly + 9);
  g.fillText('Five rows make 100.', lx + 560, ly + 9);
  return c;
}

/* ---- chain textures ---- */
const GL0 = 24, GL1 = 38, GA0 = 46.2, GA1 = 51.0;
const GW_U = (GL1 - GL0) * KX, GH_U = GA1 - GA0;
const GPX = 2048, GPY = Math.round(2048 * GH_U / GW_U);
function gridCanvas(damaged) {
  const c = mkCanvas(GPX, GPY), g = c.getContext('2d');
  const r = mulberry(61);
  const cols = 15, rows = 9, nodes = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) nodes.push([(i + .5 + (r() - .5) * .5) / cols * GPX, (j + .5 + (r() - .5) * .5) / rows * GPY]);
  const edges = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const a = j * cols + i;
    if (i < cols - 1) edges.push([a, a + 1, r() < .62]);
    if (j < rows - 1) edges.push([a, a + cols, r() < .62]);
  }
  edges.forEach(([a, b, cut]) => {
    const A = nodes[a], B = nodes[b];
    if (damaged && cut) {
      const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2;
      pencil(g, [A, [A[0] + (mx - A[0]) * .35, A[1] + (my - A[1]) * .35]], { color: '#d9a441', w: 5, passes: 2, alpha: .35, seed: a });
      pencil(g, [[mx - 9, my - 9], [mx + 9, my + 9]], { color: RED, w: 5, passes: 2, alpha: .9, seed: a + 1 });
      pencil(g, [[mx + 9, my - 9], [mx - 9, my + 9]], { color: RED, w: 5, passes: 2, alpha: .9, seed: a + 2 });
    } else {
      pencil(g, [A, B], { color: '#d9a441', w: 5, passes: 2, alpha: damaged ? .6 : .85, seed: a * 3 });
    }
  });
  nodes.forEach((n, i) => { g.fillStyle = damaged && r() < .4 ? 'rgba(217,164,65,.25)' : 'rgba(217,164,65,.95)'; g.fillRect(n[0] - 7, n[1] - 7, 14, 14); });
  grainify(c, .35);
  return c;
}
function frostCanvas() {
  const c = mkCanvas(1536, Math.round(1536 * MH / MW)), g = c.getContext('2d');
  const W = c.width, H = c.height, r = mulberry(88);
  const grd = g.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, 'rgba(170,205,235,.26)'); grd.addColorStop(1, 'rgba(200,225,245,.18)');
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(225,240,252,.55)'; g.lineCap = 'round';
  for (let x = -H; x < W; x += 26) { g.globalAlpha = .25 + r() * .3; g.lineWidth = 1.5 + r() * 2; g.beginPath(); g.moveTo(x + (r() - .5) * 6, 0); g.lineTo(x + H + (r() - .5) * 6, H); g.stroke(); }
  g.globalAlpha = 1;
  for (let i = 0; i < 1400; i++) {
    const e = r(), x = r() * W, y = r() * H, d = Math.min(x, W - x, y, H - y) / 260;
    if (r() > .55 - d * .5) continue;
    g.strokeStyle = `rgba(235,246,255,${.3 + r() * .5})`; g.lineWidth = 1 + r() * 2.2;
    const a = r() * 6.28, l = 8 + r() * 22; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  g.strokeStyle = 'rgba(240,250,255,.7)'; g.lineWidth = 6; g.strokeRect(3, 3, W - 6, H - 6);
  return c;
}
function stampCanvas() {
  const c = mkCanvas(1024, 900), g = c.getContext('2d');
  g.save(); g.beginPath(); g.ellipse(512, 450, 440, 380, 0, 0, 7); g.clip();
  g.strokeStyle = 'rgba(226,73,61,.9)'; g.lineWidth = 7; g.lineCap = 'round';
  for (let x = -900; x < 1100; x += 30) { g.globalAlpha = .55; g.beginPath(); g.moveTo(x, 900); g.lineTo(x + 900, 0); g.stroke(); }
  g.restore(); g.globalAlpha = 1;
  pencil(g, Array.from({ length: 80 }, (_, i) => [512 + Math.cos(i / 79 * 6.4) * 440, 450 + Math.sin(i / 79 * 6.4) * 380]), { color: RED, w: 10, passes: 3, seed: 3, dash: [30, 18] });
  g.fillStyle = 'rgba(22,19,14,.78)'; g.fillRect(190, 350, 644, 190);
  g.fillStyle = '#f6efdd'; g.textAlign = 'center'; g.font = 'italic 700 74px "PT Serif", serif'; g.fillText('Donetsk Oblast', 512, 440);
  g.fillStyle = '#ddd3bc'; g.font = '34px "PT Mono", monospace'; g.fillText('Russia\'s stated demand', 512, 498);
  grainify(c, .4);
  return c;
}

/* ---------------------------------------------------------------- scene */
export async function createViz({ reduced }) {
  try { await Promise.race([document.fonts.load('italic 700 40px "PT Serif"'), document.fonts.load('34px "PT Mono"'), new Promise(r => setTimeout(r, 2500))]); await new Promise(r => setTimeout(r, 30)); } catch (e) { /* fonts optional */ }

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, .1, 200);
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const tex = (c, srgb = true) => { const t = new THREE.CanvasTexture(c); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = maxAniso; return t; };
  const flat = g => { g.rotateX(-Math.PI / 2); return g; };

  const frontG = new THREE.Group(), cityG = new THREE.Group();
  cityG.position.x = 14;
  scene.add(frontG, cityG);

  /* front map */
  const mapTex = tex(makeMapCanvas());
  const mapMesh = new THREE.Mesh(flat(new THREE.PlaneGeometry(MW, MH)), new THREE.MeshBasicMaterial({ map: mapTex, transparent: true }));
  const under = new THREE.Mesh(flat(new THREE.PlaneGeometry(MW + .25, MH + .25)), new THREE.MeshBasicMaterial({ color: 0x0b0906, transparent: true, opacity: .55 }));
  under.position.y = -.02; under.renderOrder = -11; mapMesh.renderOrder = -10;
  frontG.add(under, mapMesh);

  /* dotted start line (ribbon on the map) */
  const dash = mkCanvas(32, 16); { const g = dash.getContext('2d'); g.fillStyle = '#2a241a'; g.beginPath(); g.arc(16, 8, 5.5, 0, 7); g.fill(); }
  const dashTex = tex(dash); dashTex.wrapS = THREE.RepeatWrapping; dashTex.repeat.set(1, 1);
  function ribbon(pts, w, mat, tile) {
    const pos = [], uv = [], idx = []; let len = 0;
    pts.forEach((p, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      let dx = b[0] - a[0], dz = b[1] - a[1]; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
      if (i) len += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]);
      pos.push(p[0] - dz * w / 2, 0, p[1] + dx * w / 2, p[0] + dz * w / 2, 0, p[1] - dx * w / 2);
      uv.push(len / tile, 0, len / tile, 1);
      if (i < pts.length - 1) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    return new THREE.Mesh(g, mat);
  }
  const baseLine = (() => {
    const pts = catmull(BASE.map(([lo, la]) => [X(lo), Z(la)]), 14);
    const m = ribbon(pts, .05, new THREE.MeshBasicMaterial({ map: dashTex, transparent: true, depthWrite: false, opacity: 0 }), .1);
    m.position.y = .012; frontG.add(m); return m;
  })();

  /* month sheets */
  const sx = X((SL0 + SL1) / 2), sz = Z((SA0 + SA1) / 2);
  const shadowTex = tex(shadowCanvas());
  const sheets = SHEETS.map((spec, i) => {
    const t = tex(drawSheet(spec, i));
    const mat = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0 });
    const mesh = new THREE.Mesh(flat(new THREE.PlaneGeometry(SW_U, SH_U)), mat);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(SW_U, SH_U)), new THREE.LineBasicMaterial({ color: 0xf1e9d6, transparent: true, opacity: 0 }));
    edges.rotation.x = -Math.PI / 2;
    const grp = new THREE.Group(); grp.add(mesh, edges); grp.position.set(sx, .02, sz); grp.visible = false;
    const sh = new THREE.Mesh(flat(new THREE.PlaneGeometry(SW_U * 1.12, SH_U * 1.12)), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0 }));
    sh.position.set(sx, .018, sz); sh.visible = false;
    frontG.add(grp, sh);
    return { grp, mat, edges, sh, spec };
  });

  /* chain devices on the front map */
  const GX = X((GL0 + GL1) / 2), GZ = Z((GA0 + GA1) / 2);
  const gridIntactTex = tex(gridCanvas(false)), gridDamagedTex = tex(gridCanvas(true));
  const mkSheet = (t, w, h, y, x, z) => { const m = new THREE.Mesh(flat(new THREE.PlaneGeometry(w, h)), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, opacity: 0, side: THREE.DoubleSide })); m.position.set(x, y, z); m.visible = false; frontG.add(m); return m; };
  const gridA = mkSheet(gridIntactTex, GW_U, GH_U, .5, GX, GZ), gridB = mkSheet(gridDamagedTex, GW_U, GH_U, .505, GX, GZ);
  const frost = mkSheet(tex(frostCanvas()), MW, MH, 1.4, 0, 0);
  const stamp = mkSheet(tex(stampCanvas()), 2.1, 1.84, .3, X(37.75), Z(48.45));
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xe2493d, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const TARGETS = [['Kyiv', 30.523, 50.45], ['Kharkiv', 36.23, 49.99], ['Lviv', 24.03, 49.84], ['Odesa', 30.72, 46.48]];
  const rings = TARGETS.map(([, lo, la]) => {
    const m = new THREE.Mesh(flat(new THREE.RingGeometry(.2, .245, 48)), ringMat); m.position.set(X(lo), .03, Z(la)); m.visible = false; frontG.add(m);
    const m2 = new THREE.Mesh(flat(new THREE.RingGeometry(.34, .365, 48)), ringMat); m2.position.set(X(lo), .03, Z(la)); m2.visible = false; frontG.add(m2);
    return [m, m2];
  });
  const arcMat = new THREE.MeshBasicMaterial({ color: 0xe2493d, transparent: true, opacity: 0, depthWrite: false });
  const darts = [];
  const arcs = TARGETS.map(([, lo, la], k) => {
    const src = new THREE.Vector3(X(39.0) + .3, .15, Z([51.0, 50.4, 50.8, 47.2][k]));
    const dst = new THREE.Vector3(X(lo), .08, Z(la));
    const mid = src.clone().lerp(dst, .5); mid.y = 1.5 + k * .1;
    const curve = new THREE.QuadraticBezierCurve3(src, mid, dst);
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 72, .009, 4), arcMat); m.visible = false; frontG.add(m);
    for (let q = 0; q < 3; q++) {
      const d = new THREE.Mesh(new THREE.ConeGeometry(.045, .17, 6), new THREE.MeshBasicMaterial({ color: 0xf6efdd, transparent: true, opacity: 0, depthWrite: false }));
      d.visible = false; frontG.add(d); darts.push({ m: d, curve, off: q / 3 + k * .13 });
    }
    return m;
  });

  /* city */
  const cityTex = tex(makeCityCanvas());
  const cityMesh = new THREE.Mesh(flat(new THREE.PlaneGeometry(CW, CH)), new THREE.MeshBasicMaterial({ map: cityTex }));
  const cityUnder = new THREE.Mesh(flat(new THREE.PlaneGeometry(CW + .25, CH + .25)), new THREE.MeshBasicMaterial({ color: 0x0b0906, transparent: true, opacity: .55 }));
  cityUnder.position.y = -.02;
  cityG.add(cityUnder, cityMesh);
  const stCol = { hit: 0xe2493d, lim: 0xd9a441, none: 0x4b4538 };
  const bridgeMeshes = BRIDGES.map(b => {
    const a = riverAt(b.t), len = RIVER_W + .18;
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, .03, .05), new THREE.MeshBasicMaterial({ color: stCol.none }));
    m.position.set(a.x, .035, a.z); m.rotation.y = Math.atan2(-a.tx, -a.tz); // long axis across the river
    cityG.add(m);
    const ring = new THREE.Mesh(flat(new THREE.RingGeometry(.2, .24, 40)), new THREE.MeshBasicMaterial({ color: b.st === 'hit' ? 0xe2493d : 0xd9a441, transparent: true, opacity: 0, depthWrite: false }));
    ring.position.set(a.x, .06, a.z); ring.visible = false; cityG.add(ring);
    return { m, ring, b, a };
  });

  const ledgerG = new THREE.Group(); cityG.add(ledgerG);
  const ledgerCanvas = mkCanvas(CPX, CPY); drawLedger(ledgerCanvas, 0);
  const ledgerTex = tex(ledgerCanvas);
  const ledgerMat = new THREE.MeshBasicMaterial({ map: ledgerTex, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 1 });
  const ledgerMesh = new THREE.Mesh(flat(new THREE.PlaneGeometry(CW, CH)), ledgerMat);
  const ledgerEdges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(CW, CH)), new THREE.LineBasicMaterial({ color: 0xf1e9d6, transparent: true, opacity: .6 }));
  ledgerEdges.rotation.x = -Math.PI / 2;
  ledgerG.add(ledgerMesh, ledgerEdges);
  const ledgerShadow = new THREE.Mesh(flat(new THREE.PlaneGeometry(CW * 1.08, CH * 1.12)), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: .4 }));
  ledgerShadow.position.y = .018; cityG.add(ledgerShadow);

  const lay = dotLayout();
  const totD = lay.drones.reduce((a, l) => a + l.length, 0), totM = lay.missiles.reduce((a, l) => a + l.length, 0);
  const dotMat = new THREE.MeshBasicMaterial({ color: 0xb3281f, transparent: true, opacity: 1 });
  const ringDotMat = new THREE.MeshBasicMaterial({ color: 0x7a1d16, transparent: true, opacity: 1, side: THREE.DoubleSide });
  const dotsD = new THREE.InstancedMesh(flat(new THREE.CircleGeometry(.0185, 10)), dotMat, totD);
  const dotsM = new THREE.InstancedMesh(flat(new THREE.RingGeometry(.012, .026, 14)), ringDotMat, totM);
  dotsD.frustumCulled = false; dotsM.frustumCulled = false;
  ledgerG.add(dotsD, dotsM);
  const mtx = new THREE.Matrix4(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < totD; i++) dotsD.setMatrixAt(i, zero);
  for (let i = 0; i < totM; i++) dotsM.setMatrixAt(i, zero);
  const offD = [], offM = []; { let a = 0, b = 0; lay.drones.forEach((l, i) => { offD[i] = a; a += l.length; offM[i] = b; b += lay.missiles[i].length; }); }
  function updateNight(ni, p) {
    const dl = lay.drones[ni], ml = lay.missiles[ni], tot = dl.length + ml.length, c = p * tot;
    for (let k = 0; k < dl.length; k++) { const s = clamp((c - k) / 6, 0, 1); mtx.makeScale(s, s, s); mtx.setPosition(dl[k][0], .012, dl[k][1]); dotsD.setMatrixAt(offD[ni] + k, s ? mtx : zero); }
    for (let k = 0; k < ml.length; k++) { const s = clamp((c - dl.length - k) / 4, 0, 1); mtx.makeScale(s, s, s); mtx.setPosition(ml[k][0], .012, ml[k][1]); dotsM.setMatrixAt(offM[ni] + k, s ? mtx : zero); }
    dotsD.instanceMatrix.needsUpdate = true; dotsM.instanceMatrix.needsUpdate = true;
  }

  /* ---------------------------------------------------------- state + tweening */
  const S = { mapA: 1, tx: 3.7, ty: .3, tz: -.2, az: 0, el: .8, halfW: 3.9, shift: .13, front: 1, city: 0, s0: 0, s1: 0, s2: 0, s3: 0, spread: 1, l0: 0, l1: 0, l2: 0, l3: 0, l4: 0, ledgerY: .9, ledgerA: 1, hiS: 0, hiP: 0, base: 0, arcs: 0, grid: 0, damage: 0, frost: 0, stamp: 0, rings: 0 };
  const CAMS = {
    front: { shift: .2, tx: sx - .1, ty: .55, tz: sz + .15, az: 0, el: .86, halfW: 4.7 },
    chain: { shift: .12, tx: 1.3, ty: .1, tz: -.1, az: 0, el: .95, halfW: 5.6 },
    cityLedger: { shift: .14, tx: 14, ty: .3, tz: .15, az: 0, el: .98, halfW: 5.35 },
    cityBridges: { shift: .13, tx: 14.2, ty: 0, tz: .05, az: 0, el: 1.15, halfW: 3.6 },
    pressure: { shift: -.1, tx: sx, ty: .7, tz: sz, az: 0, el: .8, halfW: 6.4 }
  };
  const tweens = [];
  function tweenTo(tg, dur = 1.1) {
    for (const k in tg) {
      if (S[k] === tg[k]) { for (let i = tweens.length - 1; i >= 0; i--) if (tweens[i].k === k) tweens.splice(i, 1); continue; }
      for (let i = tweens.length - 1; i >= 0; i--) if (tweens[i].k === k) tweens.splice(i, 1);
      if (reduced || !active) { S[k] = tg[k]; continue; }
      tweens.push({ k, s: S[k], e: tg[k], t0: performance.now(), d: dur * 1000 });
    }
    wake();
  }
  function stepTweens(now) {
    for (let i = tweens.length - 1; i >= 0; i--) {
      const t = tweens[i], p = clamp((now - t.t0) / t.d, 0, 1);
      S[t.k] = t.s + (t.e - t.s) * easeIO(p);
      if (p >= 1) { S[t.k] = t.e; tweens.splice(i, 1); }
    }
  }

  const drag = { az: 0, el: 0 };
  let name = null, stp = 0, ledgerCount = -1;
  const lastL = [-1, -1, -1, -1, -1];

  function scenes(key, s) {
    const T = {};
    const cam = CAMS[key]; Object.assign(T, cam);
    if (isReader) T.halfW = cam.halfW * ({ front: .56, cityLedger: .62, cityBridges: .66, chain: .74, pressure: .5 }[key] || 1);
    T.front = 0; T.city = 0; T.mapA = 1;
    if (key === 'front') {
      Object.assign(T, { front: 1, base: 1, s0: s > 0 ? 1 : 0, s1: s > 1 ? 1 : 0, s2: s > 2 ? 1 : 0, s3: s > 3 ? 1 : 0, spread: 1, arcs: 0, grid: 0, damage: 0, frost: 0, stamp: 0, rings: 0 });
      
    } else if (key === 'chain') {
      Object.assign(T, { front: 1, base: 0, s0: 0, s1: 0, s2: 0, s3: 0, rings: 1, arcs: s >= 1 ? 1 : 0, grid: s >= 1 ? 1 : 0, damage: s >= 1 ? 1 : 0, frost: s >= 2 ? 1 : 0, stamp: s >= 3 ? 1 : 0 });
    } else if (key === 'pressure') {
      Object.assign(T, { mapA: 0, front: 1, base: 0, s0: 1, s1: 0, s2: 1, s3: 0, arcs: 0, grid: 0, damage: 0, frost: 0, stamp: 0, rings: 0 });
    } else if (key === 'cityLedger') {
      Object.assign(T, { city: 1, l0: s > 0 ? 1 : 0, l1: s > 1 ? 1 : 0, l2: s > 2 ? 1 : 0, l3: s > 3 ? 1 : 0, l4: s > 4 ? 1 : 0, ledgerY: .9, ledgerA: 1, hiS: 0, hiP: 0 });
    } else if (key === 'cityBridges') {
      Object.assign(T, { city: 1, ledgerY: 3.2, ledgerA: 0, hiS: s >= 1 ? 1 : 0, hiP: s >= 2 ? 1 : 0, l0: 1, l1: 1, l2: 1, l3: 1, l4: 1 });
    }
    return T;
  }

  /* ---------------------------------------------------------- application of S to objects */
  function applyScene(now) {
    frontG.visible = S.front > .01 || (name === 'front' || name === 'chain' || name === 'pressure');
    cityG.visible = S.city > .01 || (name === 'cityLedger' || name === 'cityBridges');
    mapMesh.material.opacity = S.mapA; under.material.opacity = .55 * S.mapA;
    baseLine.material.opacity = S.base; baseLine.visible = S.base > .01;
    sheets.forEach((sh, i) => {
      const a = S['s' + i];
      const lift = .02 + a * (.2 + i * .5 * S.spread) + (i === 3 ? .06 * S.spread : 0);
      sh.grp.position.y = lift; sh.grp.visible = a > .005;
      const older = name === 'pressure' && i === 0 ? .5 : 1;
      sh.mat.opacity = a * (sh.spec.ghost ? .85 : older); sh.edges.material.opacity = a * .55;
      sh.sh.visible = a > .005; sh.sh.material.opacity = a * .1;
      sh.sh.position.set(sx + .14 * lift, .018, sz + .12 * lift);
    });
    gridA.visible = S.grid > .01; gridB.visible = S.damage > .01;
    gridA.material.opacity = S.grid * (1 - S.damage * .9) * .9; gridB.material.opacity = S.damage * .95;
    frost.visible = S.frost > .01; frost.material.opacity = S.frost * .9; frost.position.y = 1.4 - .75 * easeOut(S.frost);
    stamp.visible = S.stamp > .01; stamp.material.opacity = S.stamp; stamp.position.y = .3 + .25 * easeOut(S.stamp);
    ringMat.opacity = S.rings; rings.forEach(r => r.forEach(m => { m.visible = S.rings > .01; }));
    arcMat.opacity = S.arcs * .55; arcs.forEach(m => { m.visible = S.arcs > .01; });
    darts.forEach(d => {
      d.m.visible = S.arcs > .05; d.m.material.opacity = S.arcs;
      if (S.arcs > .05) {
        const t = reduced ? .8 : ((now / 5200 + d.off) % 1);
        const p = d.curve.getPointAt(t), tg = d.curve.getTangentAt(t);
        d.m.position.copy(p); d.m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tg);
      }
    });
    // ledger
    ledgerG.position.y = S.ledgerY; ledgerMat.opacity = S.ledgerA; ledgerEdges.material.opacity = S.ledgerA * .6;
    dotMat.opacity = S.ledgerA; ringDotMat.opacity = S.ledgerA; ledgerMesh.visible = S.ledgerA > .01; ledgerG.visible = S.ledgerA > .01;
    ledgerShadow.visible = S.ledgerA > .01; ledgerShadow.material.opacity = .22 * S.ledgerA;
    ledgerShadow.position.set(.1 * S.ledgerY, .018, .1 * S.ledgerY);
    const cnt = [0, 1, 2, 3, 4].filter(i => S['l' + i] > .5).length;
    if (cnt !== ledgerCount) { ledgerCount = cnt; drawLedger(ledgerCanvas, cnt); ledgerTex.needsUpdate = true; }
    for (let i = 0; i < 5; i++) { const v = S['l' + i]; if (v !== lastL[i]) { lastL[i] = v; if (lay.drones[i].length + lay.missiles[i].length) updateNight(i, v); } }
    // bridges
    bridgeMeshes.forEach(b => {
      const hi = b.b.st === 'hit' ? S.hiS : b.b.st === 'lim' ? S.hiP : 0;
      b.m.material.color.setHex(hi > .5 ? stCol[b.b.st] : stCol.none);
      b.ring.visible = hi > .01;
      if (hi > .01) { const ph = reduced ? 0 : ((now / 1600) % 1); const sc = 1 + ph * 1.1; b.ring.scale.set(sc, 1, sc); b.ring.material.opacity = hi * (1 - ph) * .9; }
    });
  }

  /* ---------------------------------------------------------- camera + render loop */
  let host = null, isReader = false, W = 1440, H = 810, stageScale = 1, active = false, hidden = false, running = false;
  function placeCamera() {
    const aspect = W / H, vfov = THREE.MathUtils.degToRad(camera.fov);
    const dist = S.halfW / (Math.tan(vfov / 2) * aspect);
    const az = S.az + drag.az, el = clamp(S.el + drag.el, .25, 1.45);
    camera.position.set(S.tx + dist * Math.cos(el) * Math.sin(az), S.ty + dist * Math.sin(el), S.tz + dist * Math.cos(el) * Math.cos(az));
    camera.lookAt(S.tx, S.ty, S.tz);
    camera.aspect = aspect;
    const sh = isReader ? 0 : S.shift;
    camera.setViewOffset(W, H, -W * sh, 0, W, H);
    camera.updateProjectionMatrix();
  }
  function render(now = performance.now()) {
    stepTweens(now); applyScene(now); placeCamera();
    renderer.render(scene, camera);
  }
  function frame(now) {
    if (!active || hidden) { running = false; return; }
    render(now);
    const busy = tweens.length || S.arcs > .05 || S.hiS > .01 || S.hiP > .01 || dr;
    if (busy) requestAnimationFrame(frame); else running = false;
  }
  function wake() { if (!running && active && !hidden) { running = true; requestAnimationFrame(frame); } }

  function size() {
    if (!host) return;
    const pr = Math.min(1.5, Math.max(.75, (window.devicePixelRatio || 1) * (isReader ? 1 : stageScale)));
    W = isReader ? Math.max(200, host.clientWidth) : 1440; H = isReader ? Math.max(160, host.clientHeight) : 810;
    renderer.setPixelRatio(pr); renderer.setSize(W, H, false);
    renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%';
  }
  let ro = null;
  const api = {
    mount(el, rd) {
      if (el === host && rd === isReader) return;
      host = el; isReader = rd;
      el.appendChild(renderer.domElement);
      if (ro) ro.disconnect();
      if (rd) { ro = new ResizeObserver(() => { size(); wake(); }); ro.observe(el); }
      size(); wake();
    },
    set(key, s) {
      if (key !== name) { drag.az = 0; drag.el = 0; }
      const first = name === null;
      name = key; stp = s;
      const T = scenes(key, s);
      if (first) { Object.assign(S, T); }
      else tweenTo(T, key === 'chain' || key === 'cityLedger' ? 1.2 : 1.0);
      wake();
    },
    setPressure(p) { if (name === 'pressure') tweenTo({ spread: .3 + p / 100 * 1.5 }, .5); else S.spread = .3 + p / 100 * 1.5; wake(); },
    setActive(a) { active = a; if (a) wake(); },
    setHidden(h) { hidden = h; if (!h) wake(); },
    setStageScale(s) { stageScale = s; size(); wake(); },
    resize() { size(); wake(); },
    forceRender() { stepTweens(1e12); render(); },
    renderer, S
  };

  // drag to tilt (mouse and pen only, so phone scrolling stays intact)
  const layer = document.getElementById('viz-layer');
  let dr = null;
  layer.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') return; dr = { x: e.clientX, y: e.clientY, az: drag.az, el: drag.el }; layer.setPointerCapture(e.pointerId); });
  layer.addEventListener('pointermove', e => { if (!dr) return; drag.az = clamp(dr.az - (e.clientX - dr.x) * .0035, -.6, .6); drag.el = clamp(dr.el + (e.clientY - dr.y) * .0028, -.4, .35); wake(); });
  const end = () => { dr = null; };
  layer.addEventListener('pointerup', end); layer.addEventListener('pointercancel', end);
  layer.addEventListener('dblclick', () => { drag.az = 0; drag.el = 0; wake(); });
  layer.style.pointerEvents = 'auto';
  layer.style.cursor = 'grab';

  renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); active = false; });
  renderer.domElement.addEventListener('webglcontextrestored', () => { active = true; wake(); });
  return api;
}
