/* Shared pieces for the gallery: materials, canvas textures, gears, shafts, vitrines. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export function makeMaterials(lite){
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const M = {
    brass:   std({color:'#b58b4b', metalness:0.88, roughness:0.34}),
    brassHi: std({color:'#d7b773', metalness:0.9,  roughness:0.24}),
    brassDk: std({color:'#7d6034', metalness:0.85, roughness:0.42}),
    steel:   std({color:'#9aa3a5', metalness:0.92, roughness:0.28}),
    enamel:  std({color:'#1b2924', metalness:0.25, roughness:0.38}),
    marble:  std({color:'#d6d0c0', metalness:0.0,  roughness:0.52}),
    plaster: std({color:'#e4dfd0', metalness:0.0,  roughness:0.85, emissive:'#c9b894', emissiveIntensity:0.05}),
    dark:    std({color:'#0e0d0b', metalness:0.2, roughness:0.7}),
    glass: new THREE.MeshStandardMaterial({color:'#cfe8de', transparent:true, opacity:0.11, roughness:0.04, metalness:0, side:THREE.DoubleSide, depthWrite:false, envMapIntensity:4.2}),
    glassEdge: new THREE.MeshStandardMaterial({color:'#7fb7a1', metalness:0.2, roughness:0.15, transparent:true, opacity:0.7, emissive:'#2f6a58', emissiveIntensity:0.5})
  };
  return M;
}

/* ---- canvas textures ---- */
function canvasTex(w, h, draw, srgb = true){
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
export function glowTexture(){
  return canvasTex(256, 256, (g, w, h) => {
    const r = g.createRadialGradient(w/2, h/2, 0, w/2, h/2, w/2);
    r.addColorStop(0, 'rgba(255,226,170,1)'); r.addColorStop(0.35, 'rgba(255,205,130,0.35)'); r.addColorStop(1, 'rgba(255,190,110,0)');
    g.fillStyle = r; g.fillRect(0, 0, w, h);
  });
}
export function washTexture(){
  // bright warm at the bottom edge, falling to nothing: an up-light on a wall
  return canvasTex(8, 256, (g, w, h) => {
    const l = g.createLinearGradient(0, h, 0, 0);
    l.addColorStop(0, 'rgba(255,214,150,0.95)'); l.addColorStop(0.18, 'rgba(238,196,132,0.42)'); l.addColorStop(0.6, 'rgba(200,160,100,0.08)'); l.addColorStop(1, 'rgba(200,160,100,0)');
    g.fillStyle = l; g.fillRect(0, 0, w, h);
  });
}
export function beamTexture(){
  return canvasTex(8, 128, (g, w, h) => {
    const l = g.createLinearGradient(0, 0, 0, h);        // v=1 (apex) at the canvas top
    l.addColorStop(0, 'rgba(255,255,255,1)'); l.addColorStop(0.5, 'rgba(255,255,255,0.35)'); l.addColorStop(1, 'rgba(255,255,255,0.05)');
    g.fillStyle = l; g.fillRect(0, 0, w, h);
  }, false);
}
/* ---- gears: trapezoid teeth, lightening holes, bevel. One geometry per size. ---- */
const gearCache = new Map();
export function gearGeometry(n, m, depth, holes = true){
  const key = `${n}|${m}|${depth}|${holes}`;
  if (gearCache.has(key)) return gearCache.get(key);
  const rp = n*m/2, ra = rp + m, rr = rp - 1.25*m;
  const shape = new THREE.Shape();
  for (let t = 0; t < n; t++) {
    const c = t*2*Math.PI/n, wr = Math.PI/n*0.56, wt = Math.PI/n*0.26;
    const pts = [[rr, c - wr], [ra, c - wt], [ra, c + wt], [rr, c + wr]];
    pts.forEach(([r, a], j) => { const x = r*Math.cos(a), y = r*Math.sin(a); if (t === 0 && j === 0) shape.moveTo(x, y); else shape.lineTo(x, y); });
  }
  shape.closePath();
  const bore = new THREE.Path(); bore.absarc(0, 0, rp*0.13, 0, Math.PI*2, true); shape.holes.push(bore);
  if (holes && n >= 16) {
    const k = n >= 28 ? 6 : 5;
    for (let i = 0; i < k; i++) {
      const a = i*2*Math.PI/k, h = new THREE.Path();
      h.absarc(rp*0.56*Math.cos(a), rp*0.56*Math.sin(a), rp*0.2, 0, Math.PI*2, true);
      shape.holes.push(h);
    }
  }
  const g = new THREE.ExtrudeGeometry(shape, {depth, bevelEnabled:true, bevelThickness:m*0.12, bevelSize:m*0.1, bevelSegments:1, curveSegments:10});
  g.translate(0, 0, -depth/2);
  g.computeVertexNormals();
  gearCache.set(key, g);
  return g;
}

/* ---- a hex drive shaft with keys, so its rotation can be read ---- */
const _y = new THREE.Vector3(0, 1, 0);
export function makeShaft(A, B, M, {r = 0.5} = {}){
  const dir = new THREE.Vector3().subVectors(B, A), len = dir.length();
  const group = new THREE.Group();
  group.position.copy(A).addScaledVector(dir, 0.5);
  group.quaternion.setFromUnitVectors(_y, dir.clone().normalize());
  const spin = new THREE.Group(); group.add(spin);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 6), M.brass); spin.add(body);
  body.userData.keep = true;                       // rotates: not batched
  const n = Math.max(2, Math.floor(len/9)), keyParts = [];
  for (let i = 0; i < n; i++) {
    const kg = new THREE.BoxGeometry(r*0.7, 1.3, r*0.7);
    kg.translate(r*1.05, -len/2 + (i + 0.5)*len/n, 0); keyParts.push(kg);
  }
  const keys = new THREE.Mesh(mergeGeometries(keyParts), M.brassHi); keys.userData.keep = true; spin.add(keys);
  keyParts.forEach(g => g.dispose());
  const collarGeo = new THREE.CylinderGeometry(r*1.6, r*1.6, 0.5, 20);
  for (const y of [-len/2 + 0.6, len/2 - 0.6]) { const c = new THREE.Mesh(collarGeo, M.steel); c.userData.keep = true; c.position.y = y; group.add(c); }   // kept out of static batching so the whole shaft can be hidden
  return {group, spin};
}

/* ---- vitrines ---- */
const frameCache = new Map();
export function frameGeometry(w, h, d, t){
  const key = [w, h, d, t].join('|');
  if (frameCache.has(key)) return frameCache.get(key);
  const parts = [];
  const bar = (sx, sy, sz, x, y, z) => { const g = new THREE.BoxGeometry(sx, sy, sz); g.translate(x, y, z); parts.push(g); };
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) bar(t, h, t, sx*w/2, h/2, sz*d/2);
  for (const y of [0, h]) {
    for (const sz of [-1, 1]) bar(w + t, t, t, 0, y, sz*d/2);
    for (const sx of [-1, 1]) bar(t, t, d + t, sx*w/2, y, 0);
  }
  const g = mergeGeometries(parts); parts.forEach(p => p.dispose());
  frameCache.set(key, g); return g;
}
const glassCache = new Map();
export function glassGeometry(w, h, d, back){
  const key = [w, h, d, back].join('|');
  if (glassCache.has(key)) return glassCache.get(key);
  const parts = [];
  const add = (g, x, y, z, ry = 0, rx = 0) => { g.rotateY(ry); g.rotateX(rx); g.translate(x, y, z); parts.push(g); };
  add(new THREE.PlaneGeometry(w, h), 0, h/2, d/2);
  if (back) add(new THREE.PlaneGeometry(w, h), 0, h/2, -d/2, Math.PI);
  add(new THREE.PlaneGeometry(d, h), -w/2, h/2, 0, -Math.PI/2);
  add(new THREE.PlaneGeometry(d, h), w/2, h/2, 0, Math.PI/2);
  add(new THREE.PlaneGeometry(w, d), 0, h, 0, 0, -Math.PI/2);
  const g = mergeGeometries(parts); parts.forEach(p => p.dispose());
  glassCache.set(key, g); return g;
}
export function makeVitrine(w, h, d, M, {back = false, t = 0.28, edge = false} = {}){
  const g = new THREE.Group();
  const frame = new THREE.Mesh(frameGeometry(w, h, d, t), edge ? M.glassEdge : M.brass);
  const glass = new THREE.Mesh(glassGeometry(w, h, d, back), M.glass);
  glass.renderOrder = 5; glass.castShadow = false;
  g.add(frame, glass);
  return g;
}

export function roundedBox(w, h, d, r, mat){
  return new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), mat);
}
