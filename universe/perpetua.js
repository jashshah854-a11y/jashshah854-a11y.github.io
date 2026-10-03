/* Perpetua, ported into three.js.
   The original is a dependency-free WebGL2 studio renderer; its procedural
   geometry (roundedBox, ring, extrudedRing, sphere, gearOutline) and the
   buildMachine assembly are kept as written. Only the output changes: each
   rigid part becomes one THREE.Group whose meshes are merged per material. */
import * as THREE from 'three';
import { Mechanics } from './mechanics.js';

/* ---- geometry helpers (from geometry.js) ---- */
const V = {
  add:(a,b)=>a.map((v,i)=>v+b[i]), sub:(a,b)=>a.map((v,i)=>v-b[i]),
  mul:(a,s)=>a.map(v=>v*s), norm:a=>{const d=Math.hypot(...a)||1; return a.map(v=>v/d);}
};
class Geometry {
  constructor(){ this.data = []; }
  vertex(p, n){ this.data.push(...p, ...n); }
  tri(a,b,c,na,nb=na,nc=na){ this.vertex(a,na); this.vertex(b,nb); this.vertex(c,nc); }
  quad(a,b,c,d,n1,n2=n1,n3=n1,n4=n1){ this.tri(a,b,c,n1,n2,n3); this.tri(a,c,d,n1,n3,n4); }
}
function roundedBox(w,h,d,r=0.04,detail=3){
  const g = new Geometry(), half = [w/2,h/2,d/2]; r = Math.min(r,...half);
  const coords = half.map(v=>{const a=[]; for(let i=0;i<=detail;i++)a.push(-v+r*i/detail); for(let i=0;i<=detail;i++)a.push(v-r+r*i/detail); return a;});
  for (let axis=0; axis<3; axis++) for (const sign of [-1,1]) {
    const u=(axis+1)%3, v=(axis+2)%3, us=coords[u], vs=coords[v];
    const sample=(i,j)=>{
      const p=[0,0,0]; p[axis]=half[axis]*sign; p[u]=us[i]; p[v]=vs[j];
      const q=p.map((x,k)=>Math.max(-half[k]+r,Math.min(half[k]-r,x)));
      const n=V.norm(V.sub(p,q)); return [V.add(q,V.mul(n,r)),n];
    };
    for (let i=0;i<us.length-1;i++) for (let j=0;j<vs.length-1;j++) {
      const a=sample(i,j), b=sample(i+1,j), c=sample(i+1,j+1), e=sample(i,j+1);
      if (sign>0) g.quad(a[0],b[0],c[0],e[0],a[1],b[1],c[1],e[1]);
      else g.quad(a[0],e[0],c[0],b[0],a[1],e[1],c[1],b[1]);
    }
  }
  return g;
}
function extrudedRing(points, inner, depth, bevel=0.01){
  const g = new Geometry(), z = depth/2, b = Math.min(bevel, depth/3), n = points.length;
  const p3=(p,zv,offset=0)=>{const r=Math.hypot(...p); return [p[0]*(r+offset)/r, p[1]*(r+offset)/r, zv];};
  for (let i=0;i<n;i++) {
    const a=points[i], c=points[(i+1)%n], na=V.norm([a[0],a[1],0]), nc=V.norm([c[0],c[1],0]);
    const edge=V.norm([c[1]-a[1],a[0]-c[0],0]);
    const ia=V.mul(na,inner), ic=V.mul(nc,inner), ifa=V.mul(na,inner>0?inner+b:0), ifc=V.mul(nc,inner>0?inner+b:0);
    g.quad(p3(a,-z+b),p3(c,-z+b),p3(c,z-b),p3(a,z-b),edge);
    for (const sign of [-1,1]) {
      const nn=[0,0,sign], oz=sign*z, sz=sign*(z-b), ba=V.norm([edge[0],edge[1],sign]);
      const aa=p3(a,oz,-b), cc=p3(c,oz,-b), ii=[ifa[0],ifa[1],oz], jj=[ifc[0],ifc[1],oz];
      if (sign>0) { g.quad(ii,aa,cc,jj,nn); g.quad(p3(a,sz),p3(c,sz),cc,aa,ba); }
      else { g.quad(jj,cc,aa,ii,nn); g.quad(aa,cc,p3(c,sz),p3(a,sz),ba); }
      if (inner>0) {
        const nna=V.norm([-na[0],-na[1],sign]), nnc=V.norm([-nc[0],-nc[1],sign]);
        if (sign>0) g.quad([ia[0],ia[1],sz],ii,jj,[ic[0],ic[1],sz],nna,nna,nnc,nnc);
        else g.quad([ic[0],ic[1],sz],jj,ii,[ia[0],ia[1],sz],nnc,nnc,nna,nna);
      }
    }
    if (inner>0) g.quad([ic[0],ic[1],-z+b],[ia[0],ia[1],-z+b],[ia[0],ia[1],z-b],[ic[0],ic[1],z-b],V.mul(nc,-1),V.mul(na,-1),V.mul(na,-1),V.mul(nc,-1));
  }
  return g;
}
function ring(ro, ri, depth, bevel=0.01, segments=80){
  const pts = Array.from({length:segments},(_,i)=>[ro*Math.cos(2*Math.PI*i/segments), ro*Math.sin(2*Math.PI*i/segments)]);
  return extrudedRing(pts, ri, depth, bevel);
}

/* ---- Part: a rigid assembly, merged per material into a THREE.Group ---- */
const _m = new THREE.Matrix4(), _e = new THREE.Euler();
function transform(p=[0,0,0], r=[0,0,0]){
  _e.set(r[0]||0, r[1]||0, r[2]||0, 'ZYX');
  return new THREE.Matrix4().makeRotationFromEuler(_e).setPosition(p[0], p[1], p[2]);
}
class Part {
  constructor(name){ this.name = name; this.items = []; }
  add(geometry, material, p=[0,0,0], r=[0,0,0]){ this.items.push({geometry, material, matrix:transform(p,r)}); return this; }
}
function finish(part, materials, stats){
  const group = new THREE.Group(); group.name = part.name;
  const buckets = new Map();
  for (const item of part.items) {
    if (!buckets.has(item.material)) buckets.set(item.material, []);
    const buf = buckets.get(item.material), d = item.geometry.data, m = item.matrix.elements;
    for (let i=0;i<d.length;i+=6) {
      const x=d[i], y=d[i+1], z=d[i+2], nx=d[i+3], ny=d[i+4], nz=d[i+5];
      const px = m[0]*x+m[4]*y+m[8]*z+m[12], py = m[1]*x+m[5]*y+m[9]*z+m[13], pz = m[2]*x+m[6]*y+m[10]*z+m[14];
      let qx = m[0]*nx+m[4]*ny+m[8]*nz, qy = m[1]*nx+m[5]*ny+m[9]*nz, qz = m[2]*nx+m[6]*ny+m[10]*nz;
      const l = Math.hypot(qx,qy,qz)||1;
      buf.push(px,py,pz,qx/l,qy/l,qz/l);
    }
  }
  for (const [key, data] of buckets) {
    const n = data.length/6, pos = new Float32Array(n*3), nor = new Float32Array(n*3);
    for (let i=0;i<n;i++) { pos[i*3]=data[i*6]; pos[i*3+1]=data[i*6+1]; pos[i*3+2]=data[i*6+2]; nor[i*3]=data[i*6+3]; nor[i*3+1]=data[i*6+4]; nor[i*3+2]=data[i*6+5]; }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor,3));
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, materials[key]);
    mesh.castShadow = true; mesh.receiveShadow = true;
    group.add(mesh); stats.triangles += n/3; stats.drawCalls++;
  }
  return group;
}

/* ---- materials: the original MAT palette, as real PBR ---- */
const PALETTE = {
  green:       {color:'#213e37', metal:0.52, rough:0.32},
  brass:       {color:'#b58b4b', metal:0.86, rough:0.29},
  brightBrass: {color:'#d7b773', metal:0.9,  rough:0.24},
  steel:       {color:'#9aa3a5', metal:0.92, rough:0.25},
  charcoal:    {color:'#303838', metal:0.65, rough:0.32},
  rubber:      {color:'#202724', metal:0.0,  rough:0.76},
  ceramic:     {color:'#d5d5c8', metal:0.20, rough:0.43},
  marker:      {color:'#da693e', metal:0.15, rough:0.42}
};
/* Fine tooling marks, ported from the original fragment shader's "brush" term.
   Faded by screen-space derivative so it never shimmers at distance. */
function addBrush(mat, amount){
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObj;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObj;')
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        { float a1 = vObj.x*920.0 + vObj.y*23.0 + vObj.z*13.0;
          float a2 = vObj.y*351.0 + vObj.z*172.0;
          float fw = max(fwidth(a1), fwidth(a2));
          float br = sin(a1)*sin(a2) / (1.0 + fw*fw*0.35);
          roughnessFactor = clamp(roughnessFactor + br*${amount.toFixed(3)}, 0.1, 1.0);
          diffuseColor.rgb *= 1.0 + br*0.035; }`);
  };
  mat.customProgramCacheKey = () => 'brush' + amount;
}
function makeMaterials(lite){
  const out = {};
  for (const [key, p] of Object.entries(PALETTE)) {
    const base = {color:new THREE.Color(p.color), metalness:p.metal, roughness:p.rough, side:THREE.DoubleSide};
    let m;
    if (key === 'green') {
      // Enamel: a clear lacquer over dark green, like the storyboard frame.
      m = lite ? new THREE.MeshStandardMaterial({...base, metalness:0.18, roughness:0.3})
               : new THREE.MeshPhysicalMaterial({...base, metalness:0.22, roughness:0.36, clearcoat:1, clearcoatRoughness:0.07});
    } else if (key === 'brass' || key === 'brightBrass') {
      m = lite ? new THREE.MeshStandardMaterial(base)
               : new THREE.MeshPhysicalMaterial({...base, clearcoat:0.18, clearcoatRoughness:0.35});
    } else {
      m = lite ? new THREE.MeshStandardMaterial(base) : new THREE.MeshPhysicalMaterial(base);
    }
    if (p.metal > 0.5) addBrush(m, key === 'steel' ? 0.05 : 0.08);
    m.name = key;
    out[key] = m;
  }
  return out;
}

/* ---- buildMachine: same assembly as the original, same coordinates ---- */
export function buildPerpetua({lite=false} = {}){
  const materials = makeMaterials(lite);
  const stats = {triangles:0, drawCalls:0};
  const MAT = Object.fromEntries(Object.keys(PALETTE).map(k => [k, k]));
  const fixed = new Part('frame'), a = new Part('flywheel'), b = new Part('counterwheel'),
        crank = new Part('crank'), rod = new Part('linkage'), slider = new Part('slider');
  const cache = new Map(), geo = (key, fn) => { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); };
  const segs = lite ? 36 : 64;
  function box(p,w,h,d,m,at,r=0.03,rot=[0,0,0]){ p.add(roundedBox(w,h,d,r,lite?2:3), m, at, rot); }
  function cyl(p,ro,ri,d,m,at,rot=[0,0,0],seg=segs){
    const s = Math.min(seg, segs);
    p.add(geo(`r${ro},${ri},${d},${s}`, () => ring(ro,ri,d,Math.min(.01,d*.2),s)), m, at, rot);
  }
  function bolt(p,at,axis='z',size=.046){
    const r = axis==='y' ? [-Math.PI/2,0,0] : [0,0,0], off = axis==='y' ? [0,.016,0] : [0,0,.016];
    cyl(p,size*1.30,size*.42,.016,MAT.charcoal,at,r,24);
    cyl(p,size,0,.035,MAT.steel,V.add(at,off),r,6);
  }
  const C = Mechanics.C;
  // Four foot, two layer machine bed.
  for (const x of [-4.24,4.12]) for (const z of [-.80,2.02]) {
    cyl(fixed,.27,0,.14,MAT.rubber,[x,.04,z],[Math.PI/2,0,0]);
    cyl(fixed,.30,0,.045,MAT.steel,[x,.125,z],[Math.PI/2,0,0]);
  }
  box(fixed,9.5,.34,3.75,MAT.green,[-.05,.30,.62],.11);
  box(fixed,9.36,.045,3.60,MAT.ceramic,[-.05,.4925,.62],.025);
  box(fixed,9.32,.045,3.57,MAT.brass,[-.05,.159,.62],.018);
  for (const x of [-4.44,4.32]) for (const z of [-.94,2.19]) bolt(fixed,[x,.525,z],'y',.057);
  // Nameplate and the engraved-looking index.
  box(fixed,1.42,.20,.019,MAT.brass,[2.90,.32,2.501],.025);
  for (const x of [2.28,3.52]) bolt(fixed,[x,.32,2.519],'z',.026);
  const glyphs = {P:[[0,0,0,1],[0,1,1,1],[1,1,1,.5],[1,.5,0,.5]],E:[[0,0,0,1],[0,1,1,1],[0,.5,.85,.5],[0,0,1,0]],R:[[0,0,0,1],[0,1,1,1],[1,1,1,.5],[1,.5,0,.5],[.45,.5,1,0]],T:[[0,1,1,1],[.5,1,.5,0]],U:[[0,1,0,0],[0,0,1,0],[1,0,1,1]],A:[[0,0,0,1],[0,1,1,1],[1,1,1,0],[0,.5,1,.5]]};
  Array.from('PERPETUA').forEach((ch,i)=>{ for (const [x1,y1,x2,y2] of glyphs[ch]) {
    const ax=2.515+i*.101+x1*.058, bx=2.515+i*.101+x2*.058, ay=.272+y1*.094, by=.272+y2*.094;
    box(fixed,Math.hypot(bx-ax,by-ay)+.006,.008,.004,MAT.charcoal,[(ax+bx)/2,(ay+by)/2,2.514],.002,[0,0,Math.atan2(by-ay,bx-ax)]);
  }});
  for (let i=0;i<12;i++) box(fixed,.019,.007,i%3===0?.21:.10,MAT.charcoal,[1.36+i*.158,.519,2.02],.002);
  function stand(x,z,r=.335,shaft=.15){
    box(fixed,.82,.15,.62,MAT.green,[x,.59,z],.045);
    const top=C.cy-r*.54, bottom=.66;
    box(fixed,.35,top-bottom,.29,MAT.green,[x,(top+bottom)/2,z],.045);
    box(fixed,.49,.44,.35,MAT.green,[x,.84,z],.07);
    cyl(fixed,r,shaft+.036,.32,MAT.green,[x,C.cy,z]);
    cyl(fixed,shaft+.038,shaft,.345,MAT.brass,[x,C.cy,z]);
    cyl(fixed,r+.016,r-.045,.036,MAT.steel,[x,C.cy,z+.164]);
    for (const dx of [-.285,.285]) for (const dz of [-.20,.20]) bolt(fixed,[x+dx,.675,z+dz],'y',.036);
    for (const q of [Math.PI/4,Math.PI*3/4,Math.PI*5/4,Math.PI*7/4]) bolt(fixed,[x+Math.cos(q)*(r-.046),C.cy+Math.sin(q)*(r-.046),z+.185],'z',.025);
  }
  stand(C.cx,-.60); stand(C.cx,1.25);
  const bx = C.cx + Mechanics.distance;
  stand(bx,-.43,.267,.108); stand(bx,.43,.267,.108);
  cyl(fixed,.148,0,2.70,MAT.steel,[C.cx,C.cy,.46]);
  cyl(fixed,.106,0,1.34,MAT.steel,[bx,C.cy,0]);
  // Two true involute outlines at their pitch centre distance, with backlash.
  function wheel(part,n,inner,spokes){
    const rp = n*C.module/2;
    part.add(extrudedRing(Mechanics.gearOutline(n),inner,.25,.008),MAT.brass);
    cyl(part,rp-.105,inner+.014,.022,MAT.green,[0,0,.136]);
    cyl(part,rp-.102,rp-.127,.023,MAT.brightBrass,[0,0,.150]);
    const hub = n===56?.36:.25, shaft = n===56?.15:.108;
    cyl(part,hub,shaft,.34,MAT.brass,[0,0,0]);
    cyl(part,hub-.045,shaft+.006,.027,MAT.charcoal,[0,0,.186]);
    for (let i=0;i<spokes;i++) {
      const t=i*Math.PI*2/spokes, start=hub-.045, end=inner+.035, len=end-start, center=(start+end)/2;
      box(part,len,.14,.185,MAT.green,[center*Math.cos(t),center*Math.sin(t),0],.035,[0,0,t]);
      if (n===56) box(part,len*.70,.032,.012,MAT.brass,[center*Math.cos(t),center*Math.sin(t),.102],.006,[0,0,t]);
      const r = inner+.085; bolt(part,[r*Math.cos(t),r*Math.sin(t),.16],'z',n===56?.043:.031);
    }
    const rr = rp-.195;
    cyl(part,n===56?.050:.037,0,.015,MAT.marker,[rr,0,.166],[],32);
  }
  wheel(a,56,1.315,8); wheel(b,28,.445,5);
  // Crank keyed to the main axle; its pin and the linkage share a bore.
  box(crank,1.42,.27,.16,MAT.brass,[.235,0,1.72],.12);
  cyl(crank,.29,0,.18,MAT.charcoal,[-.39,0,1.72]);
  cyl(crank,.245,.150,.16,MAT.brass,[0,0,1.72]);
  cyl(crank,.190,0,.035,MAT.steel,[0,0,1.827]);
  cyl(crank,.066,0,.032,MAT.charcoal,[0,0,1.848],[],6);
  cyl(crank,.087,0,.42,MAT.steel,[C.crank,0,1.99]);
  cyl(crank,.129,.089,.025,MAT.brass,[C.crank,0,2.090]);
  cyl(crank,.112,0,.06,MAT.charcoal,[C.crank,0,2.137],[],6);
  // Connecting rod: two bored eyes exactly 4.60 units apart.
  box(rod,C.rod-.28,.15,.115,MAT.steel,[C.rod/2,0,0],.045);
  box(rod,C.rod-.64,.043,.009,MAT.charcoal,[C.rod/2,0,.062],.011);
  for (const x of [0,C.rod]) { cyl(rod,.180,.09,.16,MAT.steel,[x,0,0]); cyl(rod,.135,.091,.018,MAT.brass,[x,0,.089]); }
  // Guide frame, two supported rails and a bored sliding yoke.
  for (const x of [.80,3.80]) {
    box(fixed,.51,.125,1.18,MAT.green,[x,.5775,1.35],.035);
    for (const z of [1.0,1.70]) {
      box(fixed,.18,1.99,.20,MAT.green,[x,1.625,z],.03);
      cyl(fixed,.161,.077,.23,MAT.green,[x,C.cy,z],[0,Math.PI/2,0]);
      cyl(fixed,.13,.077,.022,MAT.brass,[x+.129,C.cy,z],[0,Math.PI/2,0]);
    }
    for (const z of [.90,1.80]) bolt(fixed,[x,.651,z],'y',.039);
  }
  for (const z of [1.0,1.70]) {
    cyl(fixed,.075,0,3.40,MAT.steel,[2.30,C.cy,z],[0,Math.PI/2,0]);
    for (const x of [.59,4.01]) cyl(fixed,.103,0,.04,MAT.charcoal,[x,C.cy,z],[0,Math.PI/2,0]);
    cyl(slider,.160,.079,.59,MAT.brass,[0,0,z],[0,Math.PI/2,0]);
    for (const x of [-.299,.299]) cyl(slider,.164,.077,.016,MAT.charcoal,[x,0,z],[0,Math.PI/2,0]);
  }
  box(slider,.56,.225,.42,MAT.green,[0,0,1.35],.034);
  box(slider,.40,.31,.11,MAT.brass,[0,0,1.845],.04);
  cyl(slider,.087,0,.40,MAT.steel,[0,0,1.99]);
  cyl(slider,.129,.089,.025,MAT.brass,[0,0,2.090]);
  cyl(slider,.112,0,.06,MAT.charcoal,[0,0,2.137],[],6);
  for (const x of [-.18,.18]) bolt(slider,[x,.128,1.35],'y',.034);

  const g = {fixed:finish(fixed,materials,stats), a:finish(a,materials,stats), b:finish(b,materials,stats),
             crank:finish(crank,materials,stats), rod:finish(rod,materials,stats), slider:finish(slider,materials,stats)};
  const root = new THREE.Group(); root.name = 'perpetua';
  Object.values(g).forEach(p => { p.matrixAutoUpdate = true; root.add(p); });
  const parts = {frame:g.fixed, flywheel:g.a, counterwheel:g.b, crank:g.crank, linkage:g.rod, slider:g.slider};
  g.a.position.set(C.cx, C.cy, 0); g.b.position.set(bx, C.cy, 0); g.crank.position.set(C.cx, C.cy, 0);

  /* One shared phase. Every moving joint stays connected. */
  function update(theta){
    const p = Mechanics.pose(theta);
    g.a.rotation.z = theta;
    g.b.rotation.z = p.secondAngle;
    g.crank.rotation.z = theta;
    g.rod.position.set(p.pin[0], p.pin[1], p.pin[2]);
    g.rod.rotation.z = Math.atan2(p.slider[1]-p.pin[1], p.slider[0]-p.pin[0]);
    g.slider.position.set(p.slider[0], C.cy, 0);
    return p;
  }
  update(0);
  return {root, parts, update, materials, stats, bounds:{min:[-4.8,-.03,-1.255], max:[4.7,4.49,2.50]}};
}
