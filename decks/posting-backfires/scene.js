import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as M from './model.js';

// A microphone, a mixer, a PA stack and an oscilloscope on a road case.
// One law: the loop gain. The scope trace is the model in model.js drawn live.

const GREEN = '#78e08f';
const AMBER = '#f2c14e';
const SCREEN_BG = 'rgb(5,16,9)';

const STAGES = {
  urge:     { text: 'the urge' },
  post:     { text: 'the post' },
  audience: { text: 'the audience' },
  echo:     { text: 'the echo' },
  enough:   { text: 'enough?' },
  wrist:    { text: 'the post' },
  sOnly:    { text: 'searched only' },
  sPost:    { text: 'searched and posted' },
};

function mat(color, rough = 0.7, metal = 0.1, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
}
function box(w, h, d, m) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); }
function cyl(rt, rb, h, m, seg = 24) { return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); }

// ------------------------------------------------------------------ the scope screen
// The graticule is painted once. The trace is a ribbon mesh whose vertices come from
// model.js every frame, with two older copies behind it as phosphor afterglow.
const CW = 1024, CH = 640;

function canvasTex(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  return { c, ctx: c.getContext('2d'), tex };
}

function paintGraticule(ctx, x0, y0, pw, ph) {
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(120,224,143,0.15)';
  ctx.beginPath();
  for (let i = 0; i <= 10; i++) { const x = Math.round(x0 + (pw * i) / 10) + 0.5; ctx.moveTo(x, y0); ctx.lineTo(x, y0 + ph); }
  for (let j = 0; j <= 4; j++) { const y = Math.round(y0 + (ph * j) / 4) + 0.5; ctx.moveTo(x0, y); ctx.lineTo(x0 + pw, y); }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(120,224,143,0.32)';
  ctx.beginPath();
  const my = Math.round(y0 + ph / 2) + 0.5, mx = Math.round(x0 + pw / 2) + 0.5;
  ctx.moveTo(x0, my); ctx.lineTo(x0 + pw, my);
  ctx.moveTo(mx, y0); ctx.lineTo(mx, y0 + ph);
  for (let i = 0; i <= 50; i++) { const x = x0 + (pw * i) / 50; ctx.moveTo(x, my - 4); ctx.lineTo(x, my + 4); }
  ctx.stroke();
  // the rails the clipper hits
  ctx.save();
  ctx.setLineDash([6, 10]);
  ctx.strokeStyle = 'rgba(242,193,78,0.36)';
  ctx.beginPath();
  const amp = (ph / 2) * 0.92;
  ctx.moveTo(x0, my - amp); ctx.lineTo(x0 + pw, my - amp);
  ctx.moveTo(x0, my + amp); ctx.lineTo(x0 + pw, my + amp);
  ctx.stroke();
  ctx.restore();
}

// Rows of the plot, in canvas pixels
const X0 = 44, PW = CW - 88;
const ROWS = {
  single: [{ y0: 72, ph: 440 }],
  dual: [{ y0: 72, ph: 210 }, { y0: 342, ph: 210 }],
};

function makeScope(face, SW, SH) {
  const k = SW / CW;
  const X = (px) => (px - CW / 2) * k;
  const Y = (py) => (CH / 2 - py) * k;
  const layer = (w, h, z, order, mapOrColor, extra = {}) => {
    const m = new THREE.MeshBasicMaterial({ toneMapped: false, fog: false, ...extra });
    if (mapOrColor && mapOrColor.isTexture) m.map = mapOrColor; else if (mapOrColor != null) m.color.set(mapOrColor);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    mesh.position.z = z; mesh.renderOrder = order;
    face.add(mesh);
    return mesh;
  };
  const overlay = { transparent: true, depthTest: false, depthWrite: false };

  // static grids, one per mode
  const grids = {};
  for (const mode of ['single', 'dual']) {
    const g = canvasTex(CW, CH);
    g.ctx.fillStyle = SCREEN_BG; g.ctx.fillRect(0, 0, CW, CH);
    for (const r of ROWS[mode]) paintGraticule(g.ctx, X0, r.y0, PW, r.ph);
    if (mode === 'single') {
      const y = 568, ux = X0 + PW / 2;
      g.ctx.fillStyle = AMBER; g.ctx.font = '600 32px "Archivo Narrow", sans-serif';
      g.ctx.textAlign = 'left'; g.ctx.textBaseline = 'alphabetic';
      g.ctx.fillText('unity', ux + 10, y - 14);
    }
    g.tex.needsUpdate = true;
    grids[mode] = g.tex;
  }
  const grid = layer(SW, SH, 0, 1, grids.single);

  // tube vignette, painted once
  const v = canvasTex(256, 160);
  const vg = v.ctx.createRadialGradient(128, 80, 50, 128, 80, 150);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  v.ctx.fillStyle = vg; v.ctx.fillRect(0, 0, 256, 160); v.tex.needsUpdate = true;
  layer(SW, SH, 0.009, 9, v.tex, overlay);

  // gain bar (single mode): track, fill from the left, tick at unity
  const barY = Y(568);
  const track = layer(PW * k, 0.006, 0.002, 2, 0x2f5c3a, overlay); track.position.y = barY;
  const fillMat = new THREE.MeshBasicMaterial({ color: GREEN, toneMapped: false, fog: false, transparent: true, depthTest: false, depthWrite: false });
  const fillGeo = new THREE.PlaneGeometry(PW * k, 0.02); fillGeo.translate(PW * k / 2, 0, 0);
  const fill = new THREE.Mesh(fillGeo, fillMat); fill.position.set(X(X0), barY, 0.003); fill.renderOrder = 3; face.add(fill);
  const tick = layer(0.005, 0.05, 0.004, 4, AMBER, overlay); tick.position.set(X(X0 + PW / 2), barY, 0.004);
  const bar = [track, fill, tick];

  // header text strips, redrawn only when their words change
  const heads = [0, 1].map(() => {
    const t = canvasTex(CW, 64);
    const m = layer(CW * k, 64 * k, 0.006, 6, t.tex, overlay);
    return { ...t, mesh: m, key: '' };
  });
  function paintHead(h, left, right, rightColor) {
    const key = left + '|' + right + '|' + rightColor;
    if (h.key === key) return;
    h.key = key;
    const x = h.ctx;
    x.clearRect(0, 0, CW, 64);
    x.font = '600 36px "Archivo Narrow", sans-serif'; x.textBaseline = 'alphabetic';
    x.textAlign = 'left'; x.fillStyle = 'rgba(120,224,143,0.92)'; x.fillText(left, X0, 46);
    x.textAlign = 'right'; x.fillStyle = rightColor; x.fillText(right, X0 + PW, 46);
    h.tex.needsUpdate = true;
  }

  // trace ribbons: 2 rows x 3 afterglow copies
  const N = 512;
  const idx = new Uint16Array((N - 1) * 6);
  for (let i = 0; i < N - 1; i++) { const a = 2 * i; idx.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], i * 6); }
  const GLOW = [1, 0.34, 0.15];
  function ribbon(opacity, order) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 2 * 3), col = new Float32Array(N * 2 * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 10);
    const m = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity, side: THREE.DoubleSide, depthTest: false, depthWrite: false, toneMapped: false, fog: false });
    const mesh = new THREE.Mesh(geo, m); mesh.renderOrder = order; mesh.position.z = 0.005; mesh.frustumCulled = false;
    face.add(mesh);
    return { mesh, pos, col, geo };
  }
  const rows = [0, 1].map((r) => ({
    rib: GLOW.map((o, i) => ribbon(o, 5 - i)),
    hist: [new Float32Array(M.WINDOW), new Float32Array(M.WINDOW), new Float32Array(M.WINDOW)],
    head: 0, seen: 0, buf: new Float32Array(M.WINDOW),
  }));
  const xs = new Float32Array(N), ys = new Float32Array(N);
  const GC = new THREE.Color(GREEN), AC = new THREE.Color(AMBER);
  const HW = 0.0058;

  function fillRibbon(rb, samples, geom) {
    const { pos, col } = rb;
    const mid = geom.y0 + geom.ph / 2, amp = (geom.ph / 2) * 0.92;
    for (let i = 0; i < N; i++) {
      const s = samples[Math.min(M.WINDOW - 1, Math.round((i / (N - 1)) * (M.WINDOW - 1)))];
      xs[i] = X(X0 + (i / (N - 1)) * PW);
      ys[i] = Y(mid - s * amp);
    }
    for (let i = 0; i < N; i++) {
      const a = Math.max(0, i - 1), b = Math.min(N - 1, i + 1);
      let tx = xs[b] - xs[a], ty = ys[b] - ys[a];
      const l = Math.hypot(tx, ty) || 1;
      const nx = -ty / l * HW, ny = tx / l * HW;
      const j = i * 6;
      pos[j] = xs[i] + nx; pos[j + 1] = ys[i] + ny; pos[j + 2] = 0;
      pos[j + 3] = xs[i] - nx; pos[j + 4] = ys[i] - ny; pos[j + 5] = 0;
      const clipped = Math.abs(samples[Math.min(M.WINDOW - 1, Math.round((i / (N - 1)) * (M.WINDOW - 1)))]) > 0.93;
      const c = clipped ? AC : GC;
      col[j] = c.r; col[j + 1] = c.g; col[j + 2] = c.b; col[j + 3] = c.r; col[j + 4] = c.g; col[j + 5] = c.b;
    }
    rb.geo.attributes.position.needsUpdate = true;
    rb.geo.attributes.color.needsUpdate = true;
  }

  let mode = 'single';
  function setMode(m) {
    if (m === mode) return;
    mode = m;
    grid.material.map = grids[m]; grid.material.needsUpdate = true;
    bar.forEach((b) => { b.visible = m === 'single'; });
    rows[1].rib.forEach((rb) => { rb.mesh.visible = m === 'dual'; });
    heads[1].mesh.visible = m === 'dual';
    heads[0].mesh.position.y = Y(m === 'single' ? 32 : 52);
    heads[1].mesh.position.y = Y(322);
  }
  setMode('dual'); setMode('single');
  heads[0].mesh.position.y = Y(32);

  return {
    update(a, reduced) {
      setMode(a.dual ? 'dual' : 'single');
      const geoms = ROWS[mode];
      const loops = [a.L1, a.L2];
      for (let r = 0; r < geoms.length; r++) {
        const row = rows[r];
        M.triggered(loops[r], row.buf);
        row.hist[row.head % 3].set(row.buf);
        row.head++;
        for (let g = 0; g < 3; g++) {
          const rb = row.rib[g];
          rb.mesh.visible = !(reduced && g > 0);
          if (!rb.mesh.visible) continue;
          const src = row.hist[((row.head - 1 - g) % 3 + 3) % 3];
          fillRibbon(rb, g < row.seen ? src : row.buf, geoms[r]);
        }
        if (row.seen < 3) row.seen++;
      }
      if (mode === 'single') {
        if (a.title) paintHead(heads[0], a.title, 'gain ' + a.G.toFixed(2) + (a.G >= 1 ? ', above unity' : ', below unity'), a.G >= 1 ? AMBER : GREEN);
        else paintHead(heads[0], 'loop gain ' + a.G.toFixed(2), a.G >= 1 ? 'above unity' : 'below unity', a.G >= 1 ? AMBER : GREEN);
        fill.scale.x = Math.max(0.0001, Math.min(1, a.G / 2));
        fillMat.color.set(a.G >= 1 ? AMBER : GREEN);
      } else {
        paintHead(heads[0], a.nameA, 'gain ' + a.G.toFixed(2) + (a.G >= 1 ? ', above unity' : ', below unity'), a.G >= 1 ? AMBER : GREEN);
        paintHead(heads[1], a.nameB, 'gain ' + a.G2.toFixed(2) + (a.G2 >= 1 ? ', above unity' : ', below unity'), a.G2 >= 1 ? AMBER : GREEN);
      }
      this.last = rows[0].buf;
    },
    last: null,
  };
}

// ------------------------------------------------------------------ tape labels
function tapeTexture(text, lit) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 160;
  const x = c.getContext('2d');
  x.fillStyle = lit ? AMBER : '#cdc3a4';
  x.fillRect(0, 0, 512, 160);
  // torn ends
  x.fillStyle = lit ? '#b98a1c' : '#9d9478';
  for (let i = 0; i < 8; i++) { x.fillRect(0, i * 20 + (i % 2) * 6, 7, 10); x.fillRect(505, i * 20 + ((i + 1) % 2) * 6, 7, 10); }
  x.fillStyle = '#0b0b0a';
  let size = 84;
  x.font = `600 ${size}px "Archivo Narrow", sans-serif`;
  while (size > 40 && x.measureText(text).width > 460) { size -= 4; x.font = `600 ${size}px "Archivo Narrow", sans-serif`; }
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(text, 256, 84);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

function makeLabel(key, w = 1.15) {
  const text = STAGES[key].text;
  const dim = tapeTexture(text, false), lit = tapeTexture(text, true);
  const m = new THREE.MeshBasicMaterial({ map: dim, toneMapped: false, color: 0xb8b8b0 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 160 / 512), m);
  mesh.userData = { dim, lit, key, text };
  return mesh;
}

// ------------------------------------------------------------------ the rig
export function createRig(host, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setClearColor(0x0b0b0a, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-hidden', 'true');

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0b0b0a, 0.035);
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 60);

  // ---- light
  const hemi = new THREE.HemisphereLight(0x55665a, 0x14130f, 1.0);
  scene.add(hemi);
  const spot = new THREE.SpotLight(0xffb25a, 520, 40, 0.5, 0.85, 1.4);
  spot.position.set(5.0, 8.5, 3.5); spot.target.position.set(2.2, 1.6, -0.6);
  scene.add(spot, spot.target);
  const key = new THREE.DirectionalLight(0x9aa6ae, 1.25);
  key.position.set(-3, 5, 8); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffc27a, 0.5);
  rim.position.set(6, 3, -2); scene.add(rim);
  // from the stage toward the crowd: edges the heads in the wide shot
  const backlight = new THREE.DirectionalLight(0xffe2b0, 0);
  backlight.position.set(0, 5, -10); scene.add(backlight);
  // a wash behind the stage that lights the curtain and the stack in the wide shot
  const wash = new THREE.PointLight(0xffc27a, 0, 18, 1.2);
  wash.position.set(0.8, 3.4, -3.8); scene.add(wash);
  // a worklamp for the printed setlist
  const lamp = new THREE.PointLight(0xffe2b8, 0, 6, 1.5);
  lamp.position.set(-2.2, 1.6, 3.2); scene.add(lamp);
  const scopeGlow = new THREE.PointLight(0x78e08f, 4, 8, 1.5);
  scopeGlow.position.set(-2.4, 2.2, 3.2); scene.add(scopeGlow);
  const paGlow = new THREE.PointLight(0xf2c14e, 0, 7, 1.6);
  paGlow.position.set(2.6, 1.7, 0.4); scene.add(paGlow);

  // ---- floor and back of stage
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 30), mat(0x141412, 0.4, 0.25));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const curtain = new THREE.Mesh(new THREE.PlaneGeometry(40, 16), mat(0x0f0f0d, 1, 0));
  curtain.position.set(0, 7, -7); scene.add(curtain);
  for (let i = -8; i <= 8; i++) {
    const fold = box(0.5, 16, 0.25, mat(0x13130f, 1, 0));
    fold.position.set(i * 1.5 + (i % 2) * 0.2, 7, -6.9); scene.add(fold);
  }
  for (const [x, z, s] of [[-0.6, -4.2, 1.1], [1.0, -4.0, 0.8], [-3.4, -4.6, 1.2]]) {
    const b = box(1.4 * s, 1.0 * s, 1.0 * s, mat(0x1f1f1c, 0.6, 0.35));
    b.position.set(x, 0.5 * s, z); scene.add(b);
  }
  const edgeM = mat(0x77776f, 0.35, 0.85);

  // ---- road case + scope, near the camera
  const ZS = 1.0;
  const caseM = mat(0x191917, 0.55, 0.35);
  function buildCase(cx, cw, gaffer) {
    const g = new THREE.Group(); scene.add(g);
    const rc = box(cw, 1.1, 2.1, caseM); rc.position.set(cx, 0.55, ZS); g.add(rc);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const post = box(0.1, 1.12, 0.1, edgeM); post.position.set(cx + sx * cw / 2, 0.56, ZS + sz * 1.05); g.add(post);
    }
    for (const sz of [-1, 1]) {
      const rail = box(cw + 0.1, 0.08, 0.1, edgeM); rail.position.set(cx, 1.1, ZS + sz * 1.05); g.add(rail);
      const rail2 = box(cw + 0.1, 0.06, 0.1, edgeM); rail2.position.set(cx, 0.06, ZS + sz * 1.05); g.add(rail2);
    }
    for (const sx of [-1, 1]) { const rail = box(0.1, 0.08, 2.1, edgeM); rail.position.set(cx + sx * cw / 2, 1.1, ZS); g.add(rail); }
    if (gaffer) { const gp = box(0.8, 0.7, 0.012, mat(0x2a2a27, 0.95, 0)); gp.position.set(-1.4, 0.6, ZS + 1.06); gp.rotation.z = 0.05; g.add(gp); }
    return g;
  }
  buildCase(-1.95, 6.0, true);

  const bodyM = mat(0x44543f, 0.6, 0.3), panelM = mat(0x8c8c76, 0.7, 0.25), darkM = mat(0x0a0a09, 0.8, 0.1);
  const SW = 2.9, SH = SW / 1.6;
  function buildScopeUnit(x) {
    const g = new THREE.Group(); g.position.set(x, 1.1, ZS); scene.add(g);
    const body = box(4.1, 2.4, 1.7, bodyM); body.position.set(0, 1.2, 0); g.add(body);
    const bezel = box(3.15, 2.08, 0.12, mat(0x232c22, 0.6, 0.3)); bezel.position.set(-0.4, 1.2, 0.9); g.add(bezel);
    const face = new THREE.Group(); face.position.set(-0.4, 1.2, 0.97); g.add(face);
    const sc = makeScope(face, SW, SH);
    // a dark film over the tube, used to dim the scope that is not being looked at
    const dim = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false, fog: false }));
    dim.position.z = 0.02; dim.renderOrder = 12; face.add(dim);
    const panel = box(0.8, 2.2, 0.08, panelM); panel.position.set(1.6, 1.2, 0.88); g.add(panel);
    for (let i = 0; i < 5; i++) {
      const big = i % 2 === 0;
      const k = cyl(big ? 0.15 : 0.09, big ? 0.17 : 0.11, 0.14, darkM, 20);
      k.rotation.x = Math.PI / 2;
      k.position.set(1.6, 1.95 - i * 0.42, 0.97);
      const ptr = box(0.02, 0.1, 0.02, mat(0xe8e2cf, 0.6, 0)); ptr.position.set(0, 0.08, 0.075); k.add(ptr);
      k.rotation.z = (i * 1.7) % 6;
      g.add(k);
    }
    for (let i = 0; i < 8; i++) { const v = box(0.04, 1.4, 0.02, darkM); v.position.set(-1.98 + i * 0.1, 1.2, 0.86); g.add(v); }  // vent slits
    return { g, scope: sc, dim };
  }
  const unitA = buildScopeUnit(-2.35);
  const scope = unitA.scope;

  // ---- mixer on the case, tilted toward the room
  const mixG = new THREE.Group(); mixG.position.set(0.4, 1.28, ZS - 0.1); mixG.rotation.x = 0.55; scene.add(mixG);
  const mixBody = box(1.3, 0.34, 0.9, mat(0x20201d, 0.55, 0.4)); mixG.add(mixBody);
  const knob = new THREE.Group(); knob.position.set(0, 0.2, 0.0);
  const kcap = cyl(0.25, 0.28, 0.16, mat(0x0c0c0b, 0.5, 0.3), 32); knob.add(kcap);
  const kptr = box(0.04, 0.02, 0.22, mat(0xf4f1ea, 0.5, 0)); kptr.position.set(0, 0.09, -0.11); knob.add(kptr);
  mixG.add(knob);
  for (let i = 0; i < 4; i++) {
    const slot = box(0.045, 0.012, 0.3, mat(0x050504, 1, 0)); slot.position.set(-0.52 + i * 0.1, 0.176, 0.27); mixG.add(slot);
    const cap = box(0.07, 0.03, 0.05, mat(0xcfc9ba, 0.6, 0.2)); cap.position.set(-0.52 + i * 0.1, 0.19, 0.25 - (i % 3) * 0.06); mixG.add(cap);
  }
  const ledM = new THREE.MeshBasicMaterial({ color: 0x3a2d0c, toneMapped: false });
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.1), ledM); led.position.set(0.5, 0.18, -0.32); mixG.add(led);
  const ledOk = new THREE.MeshBasicMaterial({ color: 0x1d4a29, toneMapped: false });
  const led2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.1), ledOk); led2.position.set(0.36, 0.18, -0.32); mixG.add(led2);

  // ---- mic on a stand
  const MX = 1.05, MZ = -0.3;
  const micG = new THREE.Group(); micG.position.set(MX, 0, MZ); micG.rotation.y = 0.35; scene.add(micG);
  const steel = mat(0x1d1d1b, 0.4, 0.7);
  const base = cyl(0.36, 0.4, 0.06, steel, 32); base.position.y = 0.03; micG.add(base);
  const pole = cyl(0.03, 0.036, 1.8, steel, 12); pole.position.y = 0.95; micG.add(pole);
  const clutch = cyl(0.065, 0.065, 0.14, steel, 12); clutch.position.y = 1.78; micG.add(clutch);
  const boom = cyl(0.02, 0.02, 1.1, steel, 10); boom.position.set(0.4, 1.9, 0); boom.rotation.z = -1.25; micG.add(boom);
  const micBody = cyl(0.065, 0.08, 0.5, mat(0x2a2a28, 0.45, 0.6), 20); micBody.position.set(1.02, 1.97, 0); micBody.rotation.z = -Math.PI / 2 + 0.2; micG.add(micBody);
  const grilleM = new THREE.MeshStandardMaterial({ color: 0xaaaaa2, roughness: 0.35, metalness: 0.9, wireframe: true });
  const grille = new THREE.Mesh(new THREE.IcosahedronGeometry(0.125, 2), grilleM); grille.position.set(1.33, 2.03, 0); micG.add(grille);
  const grilleCore = new THREE.Mesh(new THREE.SphereGeometry(0.108, 16, 12), mat(0x070707, 0.9, 0)); grilleCore.position.copy(grille.position); micG.add(grilleCore);
  const micTip = new THREE.Vector3();
  grille.getWorldPosition(micTip);

  // ---- PA stack: four cabinets, front toward the room
  const paG = new THREE.Group(); paG.position.set(3.95, 0, -1.7); paG.rotation.y = -0.62; scene.add(paG);
  const cabM = mat(0x121211, 0.7, 0.3), grillM = mat(0x060606, 0.85, 0.5);
  const cones = [];
  for (let i = 0; i < 4; i++) {
    const cab = new THREE.Group(); cab.position.y = 0.5 + i * 1.02; paG.add(cab);
    cab.add(box(1.7, 1.0, 1.2, cabM));
    const front = box(1.56, 0.88, 0.04, grillM); front.position.z = 0.61; cab.add(front);
    const cone = new THREE.Group(); cone.position.set(0, 0, 0.63);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.035, 8, 32), mat(0x33332f, 0.6, 0.3)); cone.add(ring);
    const disc = cyl(0.31, 0.31, 0.04, mat(0x1a1a18, 0.8, 0.2), 32); disc.rotation.x = Math.PI / 2; cone.add(disc);
    const dust = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x3b3b36, 0.5, 0.4)); dust.rotation.x = Math.PI / 2; dust.position.z = 0.02; cone.add(dust);
    cab.add(cone); cones.push(cone);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      const cp = box(0.14, 0.14, 0.14, edgeM); cp.position.set(sx * 0.85, sy * 0.5, 0.6); cab.add(cp);
    }
    const hand = box(0.3, 0.07, 0.04, edgeM); hand.position.set(0, 0.36, 0.62); cab.add(hand);
  }

  // ---- cables with dashes that carry the signal
  function cable(points) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.024, 6, false), mat(0x080808, 0.5, 0.2));
    scene.add(tube);
    const dashes = [];
    for (let i = 0; i < 7; i++) {
      const d = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.05), new THREE.MeshBasicMaterial({ color: 0x78e08f, toneMapped: false }));
      d.visible = false; scene.add(d); dashes.push(d);
    }
    return { curve, dashes };
  }
  const cabA = cable([[1.05, 1.74, -0.3], [1.12, 1.1, -0.15], [1.0, 0.7, 0.35], [0.9, 0.9, 0.8], [0.95, 1.15, 1.05], [0.95, 1.38, ZS - 0.05]]);
  const cabB = cable([[0.95, 1.4, ZS - 0.25], [1.4, 1.1, 0.2], [2.0, 0.6, -0.2], [2.7, 0.3, -0.8], [3.2, 0.3, -1.3], [3.35, 0.45, -1.4]]);

  // ---- the air between the PA and the mic: rings that travel and fade
  const paFront = new THREE.Vector3();
  paG.updateMatrixWorld(true);
  paFront.set(0, 1.52, 0.9); paG.localToWorld(paFront);
  const airDir = micTip.clone().sub(paFront);
  const airLen = airDir.length();
  airDir.normalize();
  const rings = [];
  const ringGeo = new THREE.RingGeometry(0.94, 1, 56);
  for (let i = 0; i < 5; i++) {
    const r = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0x78e08f, transparent: true, opacity: 0, side: THREE.DoubleSide, toneMapped: false, depthWrite: false }));
    r.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), airDir);
    scene.add(r); rings.push(r);
  }

  // ---- tape labels
  const labels = {};
  function addLabel(k, pos, rot = [0, 0, 0], w = 1.15) {
    const l = makeLabel(k, w); l.position.set(...pos); l.rotation.set(...rot); scene.add(l); labels[k] = l;
  }
  addLabel('urge', [MX - 0.02, 1.3, MZ + 0.08], [0, 0.35, 0], 0.95);
  addLabel('post', [0.4, 2.15, ZS + 0.1], [0, 0, 0], 0.95);
  addLabel('audience', [3.15, 3.15, -1.0], [0, -0.55, 0], 1.1);
  addLabel('echo', [2.45, 2.7, -0.45], [0, -0.2, 0], 0.95);
  addLabel('enough', [-2.75, 1.2, ZS + 1.0], [0, 0, 0], 0.8);

  // ================================================================ props that one shot each needs
  // Real geometry, parked out of sight until the camera is pointed at it.
  const glowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  let seed = 90210;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const dummy = new THREE.Object3D();
  const UP = new THREE.Vector3(0, 1, 0);

  // ---- the split: a second scope on its own case, a light strip standing between
  const splitG = new THREE.Group(); splitG.visible = false; scene.add(splitG);
  const caseB = buildCase(-7.4, 4.4, false);
  const unitB = buildScopeUnit(-7.4);
  splitG.add(caseB, unitB.g);
  {
    const pole = cyl(0.03, 0.03, 4.4, mat(0x1d1d1b, 0.4, 0.7), 10); pole.position.set(-5.1, 2.2, 2.35);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 3.9, 0.05), new THREE.MeshBasicMaterial({ color: 0xf4ecd6, toneMapped: false }));
    strip.position.set(-5.1, 2.35, 2.38);
    const foot = box(0.6, 0.05, 0.6, mat(0x1d1d1b, 0.4, 0.7)); foot.position.set(-5.1, 0.03, 2.35);
    splitG.add(pole, strip, foot);
  }
  addLabel('sOnly', [-7.8, 0.78, ZS + 1.07], [0, 0, 0], 1.7);
  addLabel('sPost', [-2.75, 0.78, ZS + 1.07], [0, 0, 0], 1.9);

  // ---- the crowd: dark heads and shoulders, raised phones that glow and flicker
  const crowd = (() => {
    const g = new THREE.Group(); g.visible = false; g.scale.y = 0.001; scene.add(g);
    const people = [];
    for (let row = 0; row < 12; row++) {
      const z = 7.4 + row * 0.62;
      const half = (18.5 - z) * 0.56 + 1.2;
      for (let x = -half; x <= half; x += 0.46 + rnd() * 0.12) {
        people.push({ x: 0.8 + x + (rnd() - 0.5) * 0.14, z: z + (rnd() - 0.5) * 0.2, y: 1.62 + rnd() * 0.22 + row * 0.01, phone: rnd() < 0.34, side: rnd() < 0.5 ? -1 : 1, tw: rnd() * 6.28, sp: 2 + rnd() * 3, k: rnd() });
      }
    }
    const dark = mat(0x0a0a09, 0.85, 0.05);
    const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.15, 10, 8), dark, people.length);
    const torsos = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), dark, people.length);
    const ph = people.filter((p) => p.phone);
    const arms = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.035, 0.04, 1, 6), dark, ph.length);
    const phones = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ toneMapped: false, fog: false }), ph.length);
    const pts = new Float32Array(ph.length * 3), cols = new Float32Array(ph.length * 3);
    const base = ph.map((p) => (p.k < 0.7 ? [0.86, 0.93, 1.0] : p.k < 0.9 ? [0.47, 0.88, 0.56] : [0.95, 0.76, 0.3]));
    people.forEach((p, i) => {
      dummy.quaternion.identity();
      dummy.position.set(p.x, p.y, p.z); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); heads.setMatrixAt(i, dummy.matrix);
      dummy.position.set(p.x, p.y - 0.34, p.z); dummy.scale.set(0.34, 0.24, 0.2); dummy.updateMatrix(); torsos.setMatrixAt(i, dummy.matrix);
    });
    ph.forEach((p, i) => {
      const S = new THREE.Vector3(p.x + p.side * 0.22, p.y - 0.28, p.z);
      const H = new THREE.Vector3(p.x + p.side * 0.3 - p.side * 0.05 * p.k, p.y + 0.38 + p.k * 0.12, p.z + 0.02);
      const dir = H.clone().sub(S); const len = dir.length(); dir.normalize();
      dummy.position.copy(S).addScaledVector(dir, len / 2); dummy.quaternion.setFromUnitVectors(UP, dir); dummy.scale.set(1, len, 1); dummy.updateMatrix(); arms.setMatrixAt(i, dummy.matrix);
      dummy.quaternion.identity(); dummy.rotation.set(-0.25, 0, p.side * 0.12);
      dummy.position.set(H.x, H.y + 0.1, H.z); dummy.scale.set(0.075, 0.145, 0.012); dummy.updateMatrix(); phones.setMatrixAt(i, dummy.matrix);
      pts[i * 3] = H.x; pts[i * 3 + 1] = H.y + 0.12; pts[i * 3 + 2] = H.z + 0.05;
      phones.setColorAt(i, new THREE.Color(1, 1, 1));
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const halo = new THREE.Points(geo, new THREE.PointsMaterial({ map: glowTex, size: 0.4, sizeAttenuation: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, vertexColors: true, toneMapped: false, fog: false }));
    halo.frustumCulled = false;
    heads.frustumCulled = torsos.frustumCulled = arms.frustumCulled = phones.frustumCulled = false;
    g.add(heads, torsos, arms, phones, halo);
    const col = new THREE.Color();
    return {
      g,
      flicker(t, level, still) {
        for (let i = 0; i < ph.length; i++) {
          const f = (still ? 0.8 : 0.55 + 0.45 * Math.sin(t * ph[i].sp + ph[i].tw)) * level;
          col.setRGB(base[i][0] * f, base[i][1] * f, base[i][2] * f);
          phones.setColorAt(i, col);
          cols[i * 3] = col.r * 0.9; cols[i * 3 + 1] = col.g * 0.9; cols[i * 3 + 2] = col.b * 0.9;
        }
        phones.instanceColor.needsUpdate = true; geo.attributes.color.needsUpdate = true;
      },
    };
  })();

  // ---- a lighting truss over the stage, with beams: buzz made into light
  const truss = (() => {
    const g = new THREE.Group(); g.visible = false; scene.add(g);
    const barM = mat(0x2a2a27, 0.45, 0.7);
    const y = 6.3, z = -3.2;
    for (const dy of [0, -0.55]) { const b = box(16, 0.1, 0.1, barM); b.position.set(0.5, y + dy, z); g.add(b); }
    for (let i = 0; i < 24; i++) { const c = box(0.06, 0.62, 0.06, barM); c.position.set(-7 + i * 0.64, y - 0.275, z); c.rotation.z = (i % 2 ? 1 : -1) * 0.6; g.add(c); }
    const beamMats = [];
    for (let i = 0; i < 7; i++) {
      const x = -5.4 + i * 2.0;
      const lp = new THREE.Vector3(x, y - 0.95, z + 0.1);
      const house = box(0.34, 0.36, 0.42, mat(0x151513, 0.5, 0.5)); house.position.copy(lp).add(new THREE.Vector3(0, 0.2, 0)); g.add(house);
      const lens = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.04, 0.3), new THREE.MeshBasicMaterial({ color: i % 3 === 1 ? 0x78e08f : 0xfff0cf, toneMapped: false, fog: false })); lens.position.copy(lp); g.add(lens);
      const target = new THREE.Vector3(x * 0.4 + 0.5, 0, -0.5 + (i % 2) * 0.8);
      const dirV = target.clone().sub(lp); const H = dirV.length(); dirV.normalize();
      const cone = new THREE.ConeGeometry(1.15, H, 28, 1, true);
      const cc = new THREE.Color(i % 3 === 1 ? 0x78e08f : 0xffe2b0);
      const colors = new Float32Array(cone.attributes.position.count * 3);
      for (let v = 0; v < cone.attributes.position.count; v++) { const k = cone.attributes.position.getY(v) > 0 ? 1 : 0.1; colors[v * 3] = cc.r * k; colors[v * 3 + 1] = cc.g * k; colors[v * 3 + 2] = cc.b * k; }
      cone.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const bm = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false });
      const beam = new THREE.Mesh(cone, bm);
      beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dirV);
      beam.position.copy(lp).addScaledVector(dirV, H / 2);
      g.add(beam); beamMats.push(bm);
    }
    return { g, beamMats };
  })();

  // ---- the setlist: the paper's citation, printed and taped to the road case
  const setlist = (() => {
    const g = new THREE.Group(); g.visible = false; scene.add(g);
    const W = 900, H = 1248;
    const cv = canvasTex(W, H); cv.tex.anisotropy = 8;
    function wrap(x, text, maxW) {
      const words = text.split(' '); const lines = []; let cur = '';
      for (const w of words) { const t = cur ? cur + ' ' + w : w; if (x.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
      lines.push(cur); return lines;
    }
    function paint() {
      const x = cv.ctx; const M0 = 72;
      x.fillStyle = '#e9e4d4'; x.fillRect(0, 0, W, H);
      for (let i = 0; i < 3200; i++) { x.fillStyle = `rgba(${80 + (Math.random() * 60 | 0)},${70 + (Math.random() * 50 | 0)},50,${Math.random() * 0.06})`; x.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
      x.fillStyle = 'rgba(70,60,40,0.10)'; x.fillRect(0, H / 2 - 1, W, 3);
      x.fillStyle = '#171512'; x.textBaseline = 'alphabetic'; x.textAlign = 'left';
      let y = 168;
      x.font = '400 62px "Archivo Black", sans-serif';
      for (const ln of wrap(x, 'WHEN POSTING ABOUT PRODUCTS ON SOCIAL MEDIA BACKFIRES', W - M0 * 2)) { x.fillText(ln, M0, y); y += 70; }
      y += 6; x.fillRect(M0, y, W - M0 * 2, 9); y += 70;
      x.font = '600 50px "Archivo Narrow", sans-serif'; x.fillText('Grewal, Stephen, Coleman', M0, y); y += 54;
      x.font = '500 44px "Archivo Narrow", sans-serif'; x.fillText('Journal of Marketing Research', M0, y); y += 50;
      x.fillText('2019, volume 56, issue 2, pages 197 to 210', M0, y); y += 40;
      x.fillRect(M0, y, W - M0 * 2, 4); y += 86;
      const tracks = ['The basic effect', 'Two conditions', 'Identity strength', 'Category specificity', 'Salience'];
      tracks.forEach((t, i) => {
        x.font = '400 46px "Archivo Black", sans-serif'; x.fillText(String(i + 1), M0, y);
        x.font = '600 52px "Archivo Narrow", sans-serif'; x.fillText(t, M0 + 80, y);
        x.fillStyle = 'rgba(23,21,18,0.35)'; for (let d = M0 + 80; d < W - M0; d += 14) x.fillRect(d, y + 16, 5, 2.5);
        x.fillStyle = '#171512'; y += 84;
      });
      x.font = '500 34px "Archivo Narrow", sans-serif'; x.fillStyle = 'rgba(23,21,18,0.75)';
      x.fillText('doi.org/10.1177/0022243718821960', M0, H - 64);
      cv.tex.needsUpdate = true;
    }
    paint();
    Promise.all([document.fonts.load('400 40px "Archivo Black"'), document.fonts.load('600 40px "Archivo Narrow"'), document.fonts.load('500 40px "Archivo Narrow"')]).then(paint).catch(() => {});
    const PW = 0.62, PH = 0.86;
    const geo = new THREE.PlaneGeometry(PW, PH, 10, 14);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i), py = pos.getY(i);
      const low = Math.max(0, (-py / PH - 0.18) / 0.32);
      pos.setZ(i, 0.006 * Math.sin((py / PH + 0.5) * Math.PI) + 0.004 * (px / PW) + 0.022 * low * low);
    }
    geo.computeVertexNormals();
    const paper = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: cv.tex, roughness: 0.92, metalness: 0, emissive: 0xffffff, emissiveMap: cv.tex, emissiveIntensity: 0.16, side: THREE.DoubleSide }));
    paper.position.set(-2.5, 0.56, ZS + 1.07);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(PW + 0.02, PH + 0.02), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4, fog: false }));
    shadow.position.set(-2.485, 0.545, ZS + 1.065);
    g.add(shadow, paper);
    const tapeM = new THREE.MeshStandardMaterial({ color: 0xd9c99b, roughness: 0.8, transparent: true, opacity: 0.86, side: THREE.DoubleSide });
    for (const sx of [-1, 1]) {
      const t = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.052), tapeM);
      t.position.set(-2.5 + sx * 0.27, 0.56 + PH / 2 - 0.035, ZS + 1.086); t.rotation.z = sx * 0.55; g.add(t);
    }
    return { g };
  })();

  // ---- the post, as a hand reaching for the mic: a clay mannequin hand on a taped wrist
  const hand = (() => {
    const g = new THREE.Group(); g.visible = false; g.scale.setScalar(1.35); scene.add(g);
    const skin = mat(0x4f4b44, 0.5, 0.08);
    const capsule = (len, r) => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.001, len - 2 * r), 4, 10), skin); m.rotation.x = Math.PI / 2; m.position.z = len / 2; return m; };
    const palm = new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.07, 0.24, 4, 0.03), skin); palm.position.z = 0.12; g.add(palm);
    const heel = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10), skin); heel.scale.set(1.45, 0.8, 1); heel.position.set(0, 0, 0.03); g.add(heel);
    const fingers = [];
    const defs = [[-0.085, 0.17], [-0.03, 0.2], [0.03, 0.19], [0.085, 0.15]];
    for (const [fx, L] of defs) {
      const lens = [L * 0.42, L * 0.32, L * 0.26];
      const j1 = new THREE.Group(); j1.position.set(fx, 0, 0.245); g.add(j1);
      j1.add(capsule(lens[0], 0.022));
      const j2 = new THREE.Group(); j2.position.z = lens[0]; j1.add(j2); j2.add(capsule(lens[1], 0.02));
      const j3 = new THREE.Group(); j3.position.z = lens[1]; j2.add(j3); j3.add(capsule(lens[2], 0.018));
      fingers.push([j1, j2, j3]);
    }
    const t1 = new THREE.Group(); t1.position.set(0.1, 0, 0.08); t1.rotation.y = 0.75; g.add(t1);
    t1.add(capsule(0.09, 0.03));
    const t2 = new THREE.Group(); t2.position.z = 0.09; t1.add(t2); t2.add(capsule(0.075, 0.025));
    const arm = capsule(0.7, 0.06); arm.position.z = -0.35; g.add(arm);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.09, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0xcdc3a4, roughness: 0.8, side: THREE.DoubleSide }));
    band.rotation.x = Math.PI / 2; band.position.z = -0.1; g.add(band);
    return { g, fingers, t1, t2 };
  })();
  addLabel('wrist', [0, 0, 0], [0, 0, 0], 0.17);
  hand.g.add(labels.wrist);
  labels.wrist.position.set(0, 0.078, -0.1); labels.wrist.rotation.set(-Math.PI / 2, 0, Math.PI);

  // ---- the echo across the room: ripples on the floor, aisle lights for scale
  const hall = (() => {
    const g = new THREE.Group(); g.visible = false; scene.add(g);
    const lineM = new THREE.MeshBasicMaterial({ color: 0x4d3f19, toneMapped: false, fog: false });
    for (const x of [-7, 9]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.02, 40), lineM); b.position.set(x, 0.02, 12); g.add(b); }
    for (const z of [6, 12, 18, 24]) { const b = new THREE.Mesh(new THREE.BoxGeometry(16, 0.02, 0.05), lineM); b.position.set(1, 0.02, z); g.add(b); }
    const ripples = [];
    const rg = new THREE.RingGeometry(0.975, 1, 96);
    for (let i = 0; i < 6; i++) {
      const r = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0x78e08f, transparent: true, opacity: 0, side: THREE.DoubleSide, toneMapped: false, depthWrite: false, fog: false }));
      r.rotation.x = -Math.PI / 2; r.position.set(3.1, 0.04, -0.4); g.add(r); ripples.push(r);
    }
    return { g, ripples };
  })();

  // ---- state
  const L1 = M.createLoop(7), L2 = M.createLoop(11, 0.01);
  const st = {
    G: 0, G2: 0, gShown: 0, g2Shown: 0, dual: false, nameA: '', nameB: '',
    hl: [], flash: null, pulseT: -1, active: false, reduced: false,
    layout: 'desk', cam: { px: 0, py: 0, pz: 0, tx: 0, ty: 0, tz: 0, fov: 30 }, camGoal: null,
    knobAng: 0, last: performance.now(), squeal: 0, clip: 0, raf: 0, shake: 0,
    shot: 'desk', prevShot: '', prevT: 0, focus: 2, days: 0, posts: 0, pullT: 0, reach: 0,
    bright: 0, fog: 0.035, crowdS: 0, dimA: 0, dimB: 0, quiet: 1, lampI: 0,
  };

  // The camera rhythm. Each slide asks for a shot: p is the eye, t the target, fov in degrees.
  const SHOTS = {
    desk:    { p: [-1.0, 3.2, 10.0], t: [-0.8, 2.83, 0], fov: 30 },
    // wide, from behind the crowd: the buzz is the stage lit up
    crowd:   { p: [0.8, 3.2, 18.5], t: [0.8, 2.15, -1.0], fov: 34, bright: 1, fog: 0.007, labels: false },
    // close on the road case, the citation printed and taped to it
    setlist: { p: [-1.45, 0.92, 5.0], t: [-3.15, 0.58, 2.05], fov: 28, labels: false },
    // tight on the mic, the post reaching for it
    mic:     { p: [1.55, 2.3, 1.2], t: [2.3, 2.0, -0.756], fov: 26 },
    three:   { p: [3.4, 3.0, 9.0], t: [-0.8, 2.6, 0], fov: 30 },
    // two scopes side by side: the trace that only searched, the trace that posted
    split:   { p: [-5.1, 3.0, 13.4], t: [-5.3, 2.7, 0], fov: 30, labels: false,
               left: { p: [-7.6, 3.0, 8.6], t: [-7.6, 2.8, 0] }, right: { p: [-2.8, 3.0, 8.6], t: [-2.8, 2.8, 0] } },
    left:    { p: [-5.6, 1.9, 10.6], t: [0.2, 2.5, 0], fov: 30 },
    high:    { p: [-1.0, 6.4, 8.6], t: [-0.8, 2.0, 0], fov: 30 },
    // a slow pull back: from the PA out across the room while the echo thins
    pull:    { p: [3.2, 2.5, 3.6], t: [3.2, 2.0, -1.3], fov: 30, p2: [-0.5, 8.0, 30], t2: [0.8, 0.8, -1], fov2: 36, fog: 0.016, labels: false },
    wide:    { p: [-0.5, 3.4, 13.0], t: [0.3, 2.2, 0], fov: 30 },
    hero:    { p: [-1.4, 1.0, 10.0], t: [-0.6, 2.6, 0], fov: 34 },
  };
  const lerp3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

  function goalPose() {
    const sh = SHOTS[st.shot] || SHOTS.desk;
    let p = sh.p, t = sh.t, fov = sh.fov;
    if (st.shot === 'pull') {
      const auto = st.reduced ? 0.7 : 0.7 * (1 - Math.exp(-st.pullT / 3.5));
      const k = Math.min(1, auto + 0.3 * Math.min(1, st.days / 21));
      p = lerp3(sh.p, sh.p2, k); t = lerp3(sh.t, sh.t2, k); fov = sh.fov + (sh.fov2 - sh.fov) * k;
    } else if (st.shot === 'split' && st.focus !== 2) {
      const f = st.focus === 0 ? sh.left : sh.right;
      p = f.p; t = f.t;
    }
    if (st.layout === 'phone') {
      const a = camera.aspect;
      if (st.shot === 'desk') {
        // fit the scope and the mixer in a narrow slot
        return { p: [-2.1, 2.5, 2.0 + 4.7 / (2 * Math.tan((34 * Math.PI) / 360) * Math.min(a, 2.2))], t: [-2.1, 2.3, 0], fov: 34 };
      }
      const k = Math.pow(Math.max(1, 16 / 9 / a), st.shot === 'split' ? 0.7 : 0.95);
      p = lerp3(t, p, k);
    }
    return { p, t, fov };
  }

  function applyPose(snap) {
    const P = goalPose();
    st.camGoal = P;
    if (snap || !st.cam.init) {
      st.cam = { px: P.p[0], py: P.p[1], pz: P.p[2], tx: P.t[0], ty: P.t[1], tz: P.t[2], fov: P.fov, init: true };
    }
  }

  function setLabelState(now) {
    const lit = new Set(st.hl);
    if (st.flash) lit.add(st.flash);
    for (const k of Object.keys(labels)) {
      const l = labels[k], on = lit.has(k === 'wrist' ? 'post' : k);
      const want = on ? l.userData.lit : l.userData.dim;
      if (l.material.map !== want) { l.material.map = want; l.material.needsUpdate = true; }
      l.material.color.setHex(on ? 0xffffff : 0x9c9c94);
    }
  }

  // dash flow
  function flow(cb, t, speed, level, hot) {
    cb.dashes.forEach((d, i) => {
      const u = st.reduced ? (i + 0.5) / cb.dashes.length : ((t * speed + i / cb.dashes.length) % 1 + 1) % 1;
      d.visible = level > 0.02;
      if (!d.visible) return;
      d.position.copy(cb.curve.getPointAt(u));
      const tan = cb.curve.getTangentAt(u);
      d.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), tan);
      d.material.color.set(hot ? AMBER : GREEN);
      d.scale.setScalar(0.7 + level * 0.9);
    });
  }

  const PULSE = [['urge', 0, 0.45], ['post', 0.45, 1.0], ['audience', 1.0, 1.5], ['echo', 1.5, 2.3]];

  function frame(now) {
    const dt = Math.max(0, Math.min(0.05, (now - st.last) / 1000)); st.last = now;
    update(dt, now / 1000);
    renderer.render(scene, camera);
  }

  const APPROACH = new THREE.Vector3(-0.335, -0.94, -0.016).normalize();
  const smooth01 = (a, b, x) => { const u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u); };

  // Which props are in view, what the room is doing, and the small animations the shots own.
  function updateShots(dt, t) {
    const sh = SHOTS[st.shot] || SHOTS.desk;
    const kk = st.reduced ? 1 : 1 - Math.exp(-dt * 4);
    st.prevT = Math.max(0, st.prevT - dt);
    const show = (name) => st.shot === name || (st.prevT > 0 && st.prevShot === name);
    splitG.visible = show('split'); setlist.g.visible = show('setlist'); hand.g.visible = show('mic'); hall.g.visible = show('pull');
    if (st.shot === 'pull' && !st.reduced) st.pullT += dt;

    // stage light and fog follow the shot: bright for the crowd, thinning for the echo
    st.bright += ((sh.bright || 0) - st.bright) * kk;
    st.fog += ((sh.fog || 0.035) - st.fog) * kk;
    scene.fog.density = st.fog;
    const quietGoal = st.shot === 'pull' ? 0.5 + 0.5 * Math.min(1, st.gShown) : 1;
    st.quiet += (quietGoal - st.quiet) * kk;
    hemi.intensity = (1.0 + 2.2 * st.bright) * st.quiet;
    key.intensity = 1.25 * (1 + 1.2 * st.bright) * (0.6 + 0.4 * st.quiet);
    truss.g.visible = st.bright > 0.02;
    truss.beamMats.forEach((m, i) => { m.opacity = 0.085 * st.bright * (0.82 + 0.18 * Math.sin(t * 1.7 + i * 1.3)); });

    // the crowd stands up once the camera is behind it
    const cz = camera.position.z;
    const crowdGoal = st.shot === 'crowd' ? smooth01(15.5, 17.5, cz) : 0;
    st.crowdS += (crowdGoal - st.crowdS) * kk;
    crowd.g.visible = st.crowdS > 0.01;
    crowd.g.scale.set(1, Math.max(0.001, st.crowdS), 1);
    backlight.intensity = 1.1 * st.crowdS;
    if (crowd.g.visible) crowd.flicker(t, 0.55 + 0.6 * st.bright, st.reduced);

    // the worklamp on the setlist
    st.lampI += ((st.shot === 'setlist' ? 6 : 0) - st.lampI) * kk;
    lamp.intensity = st.lampI;
    wash.intensity = 90 * st.bright;

    // the tape labels: the stage ones hide in shots that are about something else
    const stageLabels = sh.labels !== false;
    for (const k of Object.keys(labels)) {
      if (k === 'wrist') continue;
      if (k === 'sOnly' || k === 'sPost') labels[k].visible = splitG.visible;
      else labels[k].visible = stageLabels;
    }

    // scopes dim when the other one is being looked at
    const dA = st.shot === 'split' && st.focus === 0 ? 0.6 : 0;
    const dB = st.shot === 'split' && st.focus === 1 ? 0.6 : 0;
    st.dimA += (dA - st.dimA) * kk; st.dimB += (dB - st.dimB) * kk;
    unitA.dim.material.opacity = st.dimA; unitB.dim.material.opacity = st.dimB;

    // the hand: hovers while the loop is quiet, takes the mic as posts pile up
    if (hand.g.visible) {
      const goal = st.flash === 'post' ? 1 : Math.min(1, 0.12 + 0.17 * st.posts);
      st.reach += (goal - st.reach) * (st.reduced ? 1 : 1 - Math.exp(-dt * 5));
      const r = st.reach;
      const tremor = st.reduced ? 0 : st.squeal * 0.012;
      hand.g.position.copy(micTip).addScaledVector(APPROACH, 0.72 - 0.45 * r);
      hand.g.position.x += (Math.random() - 0.5) * tremor; hand.g.position.y += (Math.random() - 0.5) * tremor;
      hand.g.lookAt(micTip);
      const curl = 0.04 + 0.85 * r * r;
      hand.fingers.forEach((f, i) => {
        f[0].rotation.x = curl * (0.9 + i * 0.06); f[1].rotation.x = curl * 1.25; f[2].rotation.x = curl * 0.8;
      });
      hand.t1.rotation.y = 0.75 - 0.35 * r; hand.t2.rotation.y = -0.4 * r; hand.t1.rotation.x = 0.4 * r;
    }

    // the echo across the room
    if (hall.g.visible) {
      const strength = Math.min(1, 0.12 + 0.55 * Math.min(1.3, st.gShown) + 0.5 * st.squeal);
      hall.ripples.forEach((r, i) => {
        const u = st.reduced ? (i + 0.5) / hall.ripples.length : (((t * 0.13 + i / hall.ripples.length) % 1) + 1) % 1;
        const rad = 0.6 + u * 21;
        r.scale.set(rad, rad, 1);
        r.material.opacity = strength * Math.pow(1 - u, 1.4) * Math.min(1, u * 10) * 0.9;
        r.material.color.set(st.clip > 0.04 ? AMBER : GREEN);
      });
    }
  }

  function update(dt, t) {
    // approach the target gains (a post nudges the knob up over a moment)
    const k = st.reduced ? 1 : 1 - Math.exp(-dt * 5);
    st.gShown += (st.G - st.gShown) * k;
    st.g2Shown += (st.G2 - st.g2Shown) * k;
    if (Math.abs(st.G - st.gShown) < 0.002) st.gShown = st.G;
    if (Math.abs(st.G2 - st.g2Shown) < 0.002) st.g2Shown = st.G2;

    const n = st.reduced ? 0 : Math.max(1, Math.min(500, Math.round(dt * M.FS)));
    const splitOn = st.shot === 'split';
    M.step(L1, n, st.gShown, 1);
    if (st.dual || splitOn) M.step(L2, n, st.g2Shown, 1);
    const rms = M.rms(L1, 256), clip = M.clipFraction(L1, 256);
    st.clip += (clip - st.clip) * 0.2;
    const squeal = Math.max(0, Math.min(1, (rms - 0.36) / 0.5));
    st.squeal += (squeal - st.squeal) * 0.15;

    // pulse timeline
    st.flash = null;
    if (st.pulseT >= 0) {
      st.pulseT += dt;
      for (const [key, a, b] of PULSE) if (st.pulseT >= a && st.pulseT < b) st.flash = key;
      if (st.pulseT > 2.3) st.pulseT = -1;
    }
    setLabelState();
    updateShots(dt, t);

    // knob, LED, cones, lights
    const target = -2.4 + (Math.min(2, st.gShown) / 2) * 4.8;
    st.knobAng += (target - st.knobAng) * (st.reduced ? 1 : 1 - Math.exp(-dt * 10));
    knob.rotation.y = -st.knobAng;
    const clipping = st.clip > 0.04;
    ledM.color.setHex(clipping ? 0xf2c14e : 0x3a2d0c);
    ledOk.color.setHex(st.gShown > 0.02 ? 0x49d36d : 0x1d4a29);
    const last = L1.outBuf[((L1.t - 1) % L1.ring + L1.ring) % L1.ring];
    for (const c of cones) c.position.z = 0.63 + last * 0.07;
    paGlow.intensity = st.squeal * 14 + (st.flash === 'audience' ? 6 : 0);
    scopeGlow.intensity = 4 + st.squeal * 2;
    spot.intensity = 520 * (1 + 2.6 * st.bright) * (0.55 + 0.45 * st.quiet) * (1 - 0.18 * st.squeal * (0.5 + 0.5 * Math.sin(t * 61)));
    scopeGlow.color.set(st.squeal > 0.4 ? 0xcfd47a : 0x78e08f);

    // dashes and air rings
    const lvl = Math.min(1, 0.25 + rms * 1.2);
    const hot = clipping;
    const sp = 0.25 + rms * 0.9;
    flow(cabA, t, 0.25 + 0.2 * Math.min(1, st.gShown), lvl, false);
    flow(cabB, t, sp, lvl, hot);
    const ringLevel = Math.min(1, 0.1 + st.squeal * 1.0 + (st.flash === 'echo' ? 0.7 : 0) + (st.flash === 'audience' ? 0.5 : 0));
    rings.forEach((r, i) => {
      const u = st.reduced ? (i + 0.5) / rings.length : ((t * (0.35 + st.squeal * 0.55) + i / rings.length) % 1 + 1) % 1;
      r.position.copy(paFront).addScaledVector(airDir, airLen * u);
      const s = 0.12 + 0.42 * u;
      r.scale.set(s, s, 1);
      r.material.opacity = ringLevel * (1 - u) * (st.reduced ? 0.55 : 0.8) * Math.min(1, u * 8);
      r.material.color.set(hot ? AMBER : GREEN);
    });

    // scope
    scope.update({ dual: st.dual, L1, L2, G: st.gShown, G2: st.g2Shown, nameA: st.nameA, nameB: st.nameB, title: splitOn ? 'searched and posted' : null }, st.reduced);
    if (splitOn) unitB.scope.update({ dual: false, L1: L2, L2, G: st.g2Shown, G2: 0, title: 'searched only' }, st.reduced);

    // camera: settles to its pose, leans in past unity, shakes with the squeal
    const P = goalPose(); st.camGoal = P; const c = st.cam;
    const ck = st.reduced ? 1 : 1 - Math.exp(-dt * 3.2);
    c.px += (P.p[0] - c.px) * ck; c.py += (P.p[1] - c.py) * ck; c.pz += (P.p[2] - c.pz) * ck;
    c.tx += (P.t[0] - c.tx) * ck; c.ty += (P.t[1] - c.ty) * ck; c.tz += (P.t[2] - c.tz) * ck;
    c.fov += (P.fov - c.fov) * ck;
    const lean = st.reduced ? 0 : Math.min(1, st.squeal) * 0.25;
    const sh = st.reduced ? 0 : st.squeal * 0.012;
    const vx = c.tx - c.px, vy = c.ty - c.py, vz = c.tz - c.pz, vl = Math.hypot(vx, vy, vz) || 1;
    camera.position.set(c.px + (Math.random() - 0.5) * sh + (vx / vl) * lean, c.py + (Math.random() - 0.5) * sh + (vy / vl) * lean, c.pz + (vz / vl) * lean);
    camera.lookAt(c.tx, c.ty, c.tz);
    if (Math.abs(camera.fov - c.fov) > 0.005) { camera.fov = c.fov; camera.updateProjectionMatrix(); }
    if (api.onFrame) api.onFrame();
  }

  function loop(now) {
    st.raf = 0;
    if (!st.active || document.hidden) return;
    frame(now);
    st.raf = requestAnimationFrame(loop);
  }

  function reset(L, G) { M.settle(L, G, 9000, 1); }

  const api = {
    // set the gains the scene should reach. snap = jump there (reduced motion, slide change)
    set(o, snap = false) {
      if ('G' in o) st.G = o.G;
      if ('G2' in o) st.G2 = o.G2;
      if ('dual' in o) st.dual = o.dual;
      if ('nameA' in o) st.nameA = o.nameA;
      if ('nameB' in o) st.nameB = o.nameB;
      if ('hl' in o) st.hl = o.hl || [];
      if ('focus' in o) st.focus = o.focus;
      if ('days' in o) st.days = o.days;
      if ('posts' in o) st.posts = o.posts;
      if ('shot' in o && o.shot !== st.shot) {
        st.prevShot = st.shot; st.prevT = 1.0; st.shot = o.shot; st.pullT = 0;
        if (o.shot === 'split') M.settle(L2, 0, 9000, 1);
      }
      if (snap || st.reduced) {
        st.gShown = st.G; st.g2Shown = st.G2;
        reset(L1, st.G); if (st.dual || st.shot === 'split') reset(L2, st.G2);
        st.prevT = 0; applyPose(true);
        st.knobAng = -2.4 + (Math.min(2, st.G) / 2) * 4.8;
      }
      api.renderOnce();
    },
    post() { st.pulseT = 0; if (!st.active || st.reduced) api.kick(); },
    setReduced(v) { st.reduced = v; },
    setLayout(l) { st.layout = l; applyPose(true); api.resize(host.clientWidth, host.clientHeight, st.dpr || 1); },
    setActive(v) {
      st.active = v;
      if (v && !st.raf && !document.hidden) { st.last = performance.now(); st.raf = requestAnimationFrame(loop); }
      if (!v && st.raf) { cancelAnimationFrame(st.raf); st.raf = 0; }
    },
    // reduced motion: draw once, and step through a pulse by hand
    renderOnce() {
      if (!st.reduced && st.active) return;
      st.last = performance.now();
      update(0.016, performance.now() / 1000);
      renderer.render(scene, camera);
    },
    kick() {
      if (st.raf) return;
      const run = (now) => {
        st.raf = 0;
        frame(now);
        if (st.pulseT >= 0) st.raf = requestAnimationFrame(run);
      };
      st.last = performance.now();
      st.raf = requestAnimationFrame(run);
    },
    resize(w, h, dpr) {
      if (!w || !h) return;
      st.dpr = dpr;
      const ratio = Math.min(1.5, (window.devicePixelRatio || 1) * dpr);
      renderer.setPixelRatio(ratio);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (st.layout === 'phone') applyPose(true);
      api.renderOnce();
    },
    read() { return { G: st.gShown, target: st.G, squeal: st.squeal, clip: st.clip, rms: M.rms(L1, 256) }; },
    canvas: renderer.domElement,
    dispose() { renderer.dispose(); },
    // for the tests: the samples the scope is showing
    trace: () => scope.last,
    stages: STAGES,
    debug: () => ({ cam: { ...st.cam }, shot: st.shot, pullT: st.pullT, reach: st.reach, crowdS: st.crowdS, bright: st.bright }),
  };
  applyPose(true);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && st.active && !st.raf) { st.last = performance.now(); st.raf = requestAnimationFrame(loop); } });
  // warm the loop so the first frame already has a trace
  reset(L1, 0); reset(L2, 0);
  return api;
}
