/* The gallery: Perpetua's vitrine, the floor, the rotunda of worlds, and every
   gear, shaft and rack that turns because Perpetua turns. */
import * as THREE from 'three';
import * as L from './layout.js';
import { DECKS } from './data.js';
import { Portal } from './portal.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterials, glowTexture, washTexture, beamTexture, gearGeometry, makeShaft, makeVitrine, roundedBox } from './parts.js';
import { buildRack } from './rack.js';

const PORTALS = {
  cyber:       {zoom:1.34, pan0:[-0.55,-0.6], images:['media/diorama-district.jpg', 'media/diorama-cinema.jpg', 'media/diorama-junction.jpg'], cycle:9, tint:'#d9953f', gain:1.05},
  launchboard: {images:['media/lb-today.jpg', 'media/lb-signals.jpg'], video:'media/loops/launchboard.mp4', cycle:10, tint:'#9bb08f'},
  mgmtio:      {images:['media/mgmtio-rows.jpg'], tint:'#8fa6b3'},
  round:       {images:['media/round.jpg'], video:'media/loops/round.mp4', tint:'#c9b88f'},
  fieldfold:   {images:['media/fieldfold.jpg'], video:'media/loops/fieldfold.mp4', tint:'#b9c4a8'},
  workbench:   {images:['media/workbench.jpg'], video:'media/loops/workbench.mp4', tint:'#d9a46a'},
  jev:         {images:['media/jev.jpg'], video:'media/loops/jev.mp4', tint:'#a8b3c9'},
  deadend:     {images:['media/deadend-kf01.jpg', 'media/deadend-kf20.jpg', 'media/deadend-kf40.jpg'], cycle:7, flicker:1, tint:'#e0a45a', gain:1.05}
};

export function buildHall({scene, lite, perpetua}){
  const M = makeMaterials(lite);
  const glow = glowTexture(), wash = washTexture();
  const root = new THREE.Group(); root.name = 'hall'; scene.add(root);
  const drivers = [];        // fns(spin)
  const portals = [];        // Portal objects
  const anchors = [];        // hotspot anchors
  const additive = (map, color = '#ffffff', opacity = 1) => new THREE.MeshBasicMaterial({map, color, transparent:true, opacity, blending:THREE.AdditiveBlending, depthWrite:false});

  /* ---------- floor ---------- */
  // Polished floor. On desktop it is a planar reflector (half resolution) so the
  // lit wall, the vitrines and the skyline are mirrored like in a real gallery.
  let floor, reflector = null, reflFade = 0, reflWant = false;
  const proxy = new THREE.Group(); proxy.visible = false; root.add(proxy);
  const FLOOR_BASE = '#25231e';
  if (!lite) {
    const FloorShader = {
      name:'FloorReflector',
      uniforms:{color:{value:null}, tDiffuse:{value:null}, textureMatrix:{value:null}, uStrength:{value:0}, ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog)},
      vertexShader:`uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vW;
        #include <fog_pars_vertex>
        void main(){ vUv = textureMatrix*vec4(position, 1.0); vW = (modelMatrix*vec4(position, 1.0)).xyz;
          vec4 mvPosition = modelViewMatrix*vec4(position, 1.0); gl_Position = projectionMatrix*mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader:`uniform vec3 color; uniform sampler2D tDiffuse; uniform float uStrength; varying vec4 vUv; varying vec3 vW;
        #include <common>
        #include <fog_pars_fragment>
        void main(){
          vec3 refl = texture2DProj(tDiffuse, vUv).rgb;
          float d = length(vW - cameraPosition);
          vec2 g = abs(fract(vW.xz/52.0 - 0.5) - 0.5)*52.0;
          float seam = 1.0 - smoothstep(0.0, 0.12 + d*0.0015, min(g.x, g.y));
          vec3 base = color*(1.0 - 0.45*seam);
          float k = uStrength*smoothstep(520.0, 30.0, d)*(1.0 - 0.5*seam);
          gl_FragColor = vec4(base + refl*k, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`
    };
    reflector = new Reflector(new THREE.PlaneGeometry(3000, 3000), {shader:FloorShader, textureWidth:Math.round(innerWidth*0.42), textureHeight:Math.round(innerHeight*0.42), clipBias:0.003, color:new THREE.Color(FLOOR_BASE)});
    reflector.material.fog = true; reflector.material.transparent = false;
    reflector.rotation.x = -Math.PI/2; root.add(reflector);
    const orig = reflector.onBeforeRender;
    // The mirror sees a cheap stand-in for Perpetua (the real machine is 160k triangles).
    let reflTick = 0;
    reflector.onBeforeRender = function (...a) {
      if (!reflWant) return;
      if (reflFade > 0.95 && (++reflTick & 1)) return;     // the mirror refreshes at half rate once settled
      proxy.visible = true; perpetua.root.visible = false;
      orig.apply(this, a);
      proxy.visible = false; perpetua.root.visible = true;
    };
    floor = reflector;
  } else {
    floor = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshStandardMaterial({color:FLOOR_BASE, metalness:0, roughness:0.5}));
    floor.rotation.x = -Math.PI/2; root.add(floor);
  }
  // Quality fallback for weak GPUs/CPUs: a plain glossy floor that replaces the planar mirror.
  // It is drawn once during the warm-up so switching to it never compiles anything.
  let plainFloor = null, mirrorOn = !!reflector;
  if (reflector) {
    plainFloor = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshStandardMaterial({color:FLOOR_BASE, metalness:0, roughness:0.3}));
    plainFloor.rotation.x = -Math.PI/2; plainFloor.visible = false; plainFloor.userData.keep = true; root.add(plainFloor);
  }
  function setMirror(on){
    if (!reflector || on === mirrorOn) return;
    mirrorOn = on; reflWant = false; reflFade = 0;
    reflector.visible = on; plainFloor.visible = !on;
  }

  /* ---------- Perpetua: plinth, vitrine, lamps ---------- */
  const shell = new THREE.Group(); root.add(shell);
  perpetua.root.position.y = L.PY; shell.add(perpetua.root);
  {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.5, 3.75), M.enamel); bed.position.set(-0.05, L.PY + 0.3, 0.62); proxy.add(bed);
    const gA = new THREE.Mesh(new THREE.CylinderGeometry(1.68, 1.68, 0.25, 24), M.enamel); gA.rotation.x = Math.PI/2; gA.position.set(-2.3, L.PY + 2.75, 0); proxy.add(gA);
    const gB = new THREE.Mesh(new THREE.CylinderGeometry(0.84, 0.84, 0.25, 16), M.enamel); gB.rotation.x = Math.PI/2; gB.position.set(0.22, L.PY + 2.75, 0); proxy.add(gB);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.2, 0.2), M.steel); rail.position.set(2.3, L.PY + 2.75, 1.35); proxy.add(rail);
  }
  const plinth = roundedBox(14.4, L.PY - 0.02, 10.8, 0.14, M.plaster);
  plinth.position.set(-0.05, (L.PY - 0.02)/2, 0.62); plinth.receiveShadow = true; shell.add(plinth);
  const plinthBase = roundedBox(14.9, 0.7, 11.3, 0.12, M.dark); plinthBase.position.set(-0.05, 0.35, 0.62); shell.add(plinthBase);
  const pv = makeVitrine(13.6, 14, 10, M, {back:true, t:0.1, edge:true});
  pv.position.set(-0.05, L.PY - 0.02, 0.62); shell.add(pv);
  // Frame 1 is a studio shot: a paper cyclorama just inside the glass, faded out as the camera leaves.
  const paperMat = new THREE.MeshStandardMaterial({color:'#ebe8dd', roughness:0.95, metalness:0, emissive:'#cdc6b0', emissiveIntensity:0.3, transparent:true, side:THREE.DoubleSide});
  const backdrop = new THREE.Group();
  for (const [w, x, z, ry] of [[13.3, -0.05, 0.62 - 4.85, 0], [9.6, -6.55, 0.62, Math.PI/2], [9.6, 6.45, 0.62, -Math.PI/2]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 13.6), paperMat); m.position.set(x, L.PY + 6.8, z); m.rotation.y = ry; backdrop.add(m);
  }
  shell.add(backdrop);
  const setBackdrop = v => { paperMat.opacity = v; backdrop.visible = v > 0.01; };
  const lampMat = new THREE.MeshBasicMaterial({color:'#fff2d6'});
  for (const x of [-3.6, 3.2]) { const l = new THREE.Mesh(new THREE.CircleGeometry(0.34, 20), lampMat); l.rotation.x = Math.PI/2; l.position.set(x, L.PY + 13.9, 0.8); shell.add(l); }
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), additive(glow, '#ffcf90', 0.5));
  pad.rotation.x = -Math.PI/2; pad.position.set(-0.05, 0.05, 0.62 + 2); root.add(pad);
  anchors.push({id:'perp', label:'Perpetua', kind:'perp', pos:new THREE.Vector3(-0.05, L.PY + 8, 0.62), normal:new THREE.Vector3(0, 0, 1)});

  /* ---------- the gallery shell: wall, piers, washes ---------- */
  const side = new THREE.Vector3(L.LINE_DIR.z, 0, -L.LINE_DIR.x);
  const WALL_END = 118;                         // the back wall stops before the rotunda
  const pierGeo = new THREE.BoxGeometry(9, 80, 5); pierGeo.translate(0, 40, 0);
  const pierMat = new THREE.MeshStandardMaterial({color:'#7b7465', metalness:0, roughness:0.9, emissive:'#6d5a3c', emissiveIntensity:0.12});
  const washGeo = new THREE.PlaneGeometry(1, 1); washGeo.translate(0, 0.5, 0);
  const washMat = additive(wash, '#ffffff', 0.9);
  const floorWashGeo = new THREE.PlaneGeometry(1, 1); floorWashGeo.translate(0, 0.5, 0); floorWashGeo.rotateX(Math.PI/2);
  const floorWashMat = additive(wash, '#ffd9a0', 0.32); floorWashMat.side = THREE.DoubleSide;
  const piers = [];
  for (let a = -52; a <= WALL_END; a += 44) piers.push({p:L.LINE_P0.clone().addScaledVector(L.LINE_DIR, a).addScaledVector(side, 58), yaw:Math.atan2(-side.x, -side.z)});
  for (let a = -10; a <= WALL_END - 20; a += 70) piers.push({p:L.LINE_P0.clone().addScaledVector(L.LINE_DIR, a).addScaledVector(side, -100), yaw:Math.atan2(side.x, side.z), dim:true});
  const COL_R = 156, COLS = 30;
  for (let k = 0; k < COLS; k++) {
    const al = k/COLS*Math.PI*2;
    if (Math.cos(al) > 0.3) continue;            // the entrance arc stays open
    const p = L.hallToWorld(COL_R*Math.sin(al), 0, COL_R*Math.cos(al));
    piers.push({p, yaw:Math.atan2(L.RC.x - p.x, L.RC.z - p.z), dim:Math.cos(al) > 0.0});
  }
  const pierMesh = new THREE.InstancedMesh(pierGeo, pierMat, piers.length);
  const washes = new THREE.InstancedMesh(washGeo, washMat, piers.length);
  const fwashes = new THREE.InstancedMesh(floorWashGeo, floorWashMat, piers.length);
  const dm = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1), yAxis = new THREE.Vector3(0, 1, 0);
  piers.forEach((c, i) => {
    q.setFromAxisAngle(yAxis, c.yaw);
    dm.compose(c.p, q, sc); pierMesh.setMatrixAt(i, dm);
    const inward = new THREE.Vector3(Math.sin(c.yaw), 0, Math.cos(c.yaw));
    const wp = c.p.clone().addScaledVector(inward, 2.7);
    dm.compose(wp, q, new THREE.Vector3(c.dim ? 20 : 38, c.dim ? 22 : 34, 1)); washes.setMatrixAt(i, dm);
    const fp = c.p.clone().addScaledVector(inward, 2.6); fp.y = 0.07;
    dm.compose(fp, q, new THREE.Vector3(c.dim ? 20 : 38, 1, c.dim ? 12 : 22)); fwashes.setMatrixAt(i, dm);
  });
  root.add(pierMesh, washes, fwashes);
  // the long back wall: a paper-warm plane that falls to shadow. Its far end used to stop dead at
  // WALL_END, a hard vertical edge that swept across the frame as the camera ran along the city
  // (bright wall one side, black the other, and the same cut in the mirror). Both layers now
  // darken with distance along the line, so the wall reaches the end already fully in shadow.
  const wallLen = WALL_END + 60;
  const WALL_FADE0 = 30;
  const wallFade = (shader, wash) => {
    const d = L.LINE_DIR, p = L.LINE_P0, NL = '\n';
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>' + NL + 'varying vec3 vWallP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>' + NL + 'vWallP = (modelMatrix*vec4(transformed, 1.0)).xyz;');
    const fade = `float wallK = 1.0 - smoothstep(${WALL_FADE0.toFixed(1)}, ${WALL_END.toFixed(1)}, dot(vWallP - vec3(${p.x.toFixed(4)}, ${p.y.toFixed(4)}, ${p.z.toFixed(4)}), vec3(${d.x.toFixed(5)}, ${d.y.toFixed(5)}, ${d.z.toFixed(5)})));`;
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>' + NL + 'varying vec3 vWallP;');
    shader.fragmentShader = wash
      ? shader.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>' + NL + fade + NL + 'diffuseColor.a *= wallK;')
      : shader.fragmentShader.replace('#include <opaque_fragment>', fade + NL + 'outgoingLight *= wallK;' + NL + '#include <opaque_fragment>');
  };
  const wallMat = new THREE.MeshStandardMaterial({color:'#6f6552', roughness:0.95, metalness:0, emissive:'#3a2f1c', emissiveIntensity:0.5});
  wallMat.onBeforeCompile = sh => wallFade(sh, false); wallMat.customProgramCacheKey = () => 'wallfade';
  const wallBody = new THREE.Mesh(new THREE.PlaneGeometry(wallLen, 90), wallMat);
  wallBody.position.copy(L.LINE_P0).addScaledVector(L.LINE_DIR, WALL_END/2 - 30).addScaledVector(side, 60.5); wallBody.position.y = 45;
  wallBody.rotation.y = Math.atan2(-side.x, -side.z); root.add(wallBody);
  const wallWashGeo = new THREE.PlaneGeometry(wallLen, 50); wallWashGeo.translate(0, 25, 0);
  const wallWashMat = new THREE.MeshBasicMaterial({map:wash, color:'#fff0d2', transparent:true, opacity:0.55, blending:THREE.AdditiveBlending, depthWrite:false});
  wallWashMat.onBeforeCompile = sh => wallFade(sh, true); wallWashMat.customProgramCacheKey = () => 'wallwashfade';
  const wallWash = new THREE.Mesh(wallWashGeo, wallWashMat);
  wallWash.userData.keep = true;       // own material: stays out of the shared glow batch
  wallWash.position.copy(wallBody.position).addScaledVector(side, -0.2); wallWash.position.y = 0;
  wallWash.rotation.y = wallBody.rotation.y; root.add(wallWash);

  /* ---------- the rack that becomes a city ---------- */
  const rack = buildRack({lite}); root.add(rack.group);
  let rackActive = true;
  drivers.push(spin => { if (rackActive) rack.update(spin); });

  /* ---------- rotunda centre: a floor gear the rack feeds ---------- */
  const fg = new THREE.Mesh(gearGeometry(48, 0.7, 1.4, false), M.brassDk);
  fg.rotation.x = -Math.PI/2; fg.position.copy(L.RC); fg.position.y = 0.7; root.add(fg);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.6, 3, 28), M.brass); hub.position.copy(L.RC); hub.position.y = 2.2; root.add(hub);
  drivers.push(spin => { fg.rotation.z = spin*0.25; });
  const centreGlow = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), additive(glow, '#ffcf8a', 0.38));
  centreGlow.rotation.x = -Math.PI/2; centreGlow.position.copy(L.RC); centreGlow.position.y = 0.08; root.add(centreGlow);

  /* ---------- stations ---------- */
  const texLoader = new THREE.TextureLoader();
  let singularLoad = () => {};
  const GEAR_M = 0.16;
  /* Gears are instanced (one draw per gear type). Each gear keeps its base matrix in
     the world and only its angle changes per frame. */
  const gearBatches = new Map();
  function addGear(geo, mat, parent, pos, angleFn){
    const key = geo.uuid + mat.uuid;
    if (!gearBatches.has(key)) gearBatches.set(key, {geo, mat, items:[]});
    gearBatches.get(key).items.push({parent, pos, angleFn});
  }
  function addTrain(parent, x, y, z, bigN, smallN, phiDeg, speedFn){
    const rp1 = bigN*GEAR_M/2, rp2 = smallN*GEAR_M/2, phi = phiDeg*Math.PI/180;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.9, 16), M.steel); cap.rotation.x = Math.PI/2; cap.position.set(x, y, z + 0.4); parent.add(cap);
    addGear(gearGeometry(bigN, GEAR_M, 0.5), M.brass, parent, [x, y, z], speedFn);
    addGear(gearGeometry(smallN, GEAR_M, 0.5), M.brassHi, parent, [x + (rp1 + rp2)*Math.cos(phi), y + (rp1 + rp2)*Math.sin(phi), z],
      s => phi + Math.PI - Math.PI/smallN - (speedFn(s) - phi)*bigN/smallN);
  }

  const shaftRatios = [1, -1.5, 2, -1, 1.5, -2, 1, -1.5, 1, -2];
  const axles = [];     // {L:Vector3, R:Vector3} world, per standard station in order
  function standardStation(slot, i){
    const g = new THREE.Group(); g.position.copy(slot.pos); g.rotation.y = slot.yaw; root.add(g);
    // deck
    const deck = roundedBox(L.DECK.w, L.DECK.h, L.DECK.d, 0.25, M.enamel); deck.position.y = -L.DECK.h/2; g.add(deck);
    const trim = roundedBox(L.DECK.w + 0.5, 0.34, L.DECK.d + 0.5, 0.12, M.brass); trim.position.y = -0.17; g.add(trim);
    const trim2 = roundedBox(L.DECK.w + 0.3, 0.26, L.DECK.d + 0.3, 0.1, M.brass); trim2.position.y = -L.DECK.h + 0.13; g.add(trim2);
    // pillar to the floor
    const ph = slot.pos.y - L.DECK.h;
    const pil = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.8, ph, 24), M.marble); pil.position.set(0, -L.DECK.h - ph/2, 0); g.add(pil);
    for (const y of [-L.DECK.h - 0.5, -slot.pos.y + 0.5]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.9, 24), M.brass); c.position.y = y; g.add(c); }
    // vitrine
    const vit = makeVitrine(L.VIT.w, L.VIT.h, L.VIT.d, M, {back:false});
    g.add(vit);
    // portal
    const cfg = PORTALS[slot.id];
    const cy = L.VIT.h/2 - 0.2;
    const pz = -L.VIT.d/2 + 0.9;
    if (cfg) {
      const portal = new Portal({...cfg, plane:L.PORTAL.w/L.PORTAL.h, phase:i*1.7});
      const pm = new THREE.Mesh(new THREE.PlaneGeometry(L.PORTAL.w, L.PORTAL.h), portal.material);
      pm.position.set(0, cy, pz); g.add(pm);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(L.PORTAL.w + 0.7, L.PORTAL.h + 0.7, 0.4), M.brassDk); frame.position.set(0, cy, pz - 0.28); g.add(frame);
      const halo = new THREE.Mesh(new THREE.PlaneGeometry(L.PORTAL.w*1.7, L.PORTAL.h*2.1), additive(glow, cfg.tint || '#ffd9a0', 0.32));
      halo.position.set(0, cy, pz - 0.05); g.add(halo);
      const stage = new THREE.Mesh(new THREE.PlaneGeometry(L.VIT.w - 0.6, L.VIT.d - 0.6), additive(glow, cfg.tint || '#ffd9a0', 0.26));
      stage.rotation.x = -Math.PI/2; stage.position.set(0, 0.05, 0); g.add(stage);
      const rf = new THREE.Mesh(new THREE.PlaneGeometry(L.PORTAL.w, 4.2).rotateX(Math.PI/2), portal.reflectionMaterial);
      rf.position.set(0, 0.07, pz + 2.1); g.add(rf);
      portal.worldPos = slot.portal.clone(); portal.slot = slot.id; portals.push(portal);
    }
    // gear trains on the deck face
    const zf = L.DECK.d/2 + 0.45;
    const rL = i === 0 ? 1 : shaftRatios[i-1], rR = shaftRatios[i];
    const bigL = addTrain(g, -(L.DECK.w/2 - 3.1), -1.7, zf, 32, 18, -38, s => s*rL);
    const bigR = addTrain(g, (L.DECK.w/2 - 3.1), -1.7, zf, 32, 20, -142, s => s*rR);
    g.updateMatrixWorld(true);
    const wL = new THREE.Vector3(-(L.DECK.w/2 - 3.1), -1.7, zf + 0.85).applyMatrix4(g.matrixWorld);
    const wR = new THREE.Vector3((L.DECK.w/2 - 3.1), -1.7, zf + 0.85).applyMatrix4(g.matrixWorld);
    axles.push({L:wL, R:wR, group:g});
    anchors.push({id:slot.id, label:null, kind:'world', pos:slot.pos.clone().add(new THREE.Vector3(0, L.VIT.h + 2.2, 0)), normal:slot.inward.clone()});
    return g;
  }

  /* Dead End Shop: a projector beam inside the vitrine */
  function addProjector(slot){
    const g = axles[SLOT_INDEX.deadend].group;
    const px = -4.4, py = 2.3, pz = L.VIT.d/2 - 1.6;
    const prj = new THREE.Group(); prj.position.set(px, 0, pz); g.add(prj);
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.5, py, 12), M.steel); stand.position.y = py/2; prj.add(stand);
    const body = roundedBox(1.7, 1.25, 2.5, 0.2, M.enamel); body.position.y = py + 0.2; prj.add(body);
    for (const dz of [-0.55, 0.55]) { const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.22, 28), M.brass); reel.rotation.z = Math.PI/2; reel.position.set(0, py + 1.25, dz); reel.userData.keep = true; prj.add(reel); drivers.push(spin => { reel.rotation.x = spin*2; }); }
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.5, 0.7, 20), M.steel); lens.rotation.x = Math.PI/2; lens.position.set(0, py + 0.2, -1.55); prj.add(lens);
    // the beam: a cone from the lens to the portal
    const lensW = new THREE.Vector3(0, py + 0.2, -1.9);
    const target = new THREE.Vector3(2.0 - px, L.VIT.h/2 - 0.2, (-L.VIT.d/2 + 0.9) - pz);
    const dist = target.length() - 1.0;
    const half = Math.atan((L.PORTAL.w*0.5 + 0.5)/dist);
    const coneGeo = new THREE.ConeGeometry(Math.tan(half)*dist, dist, 32, 1, true); coneGeo.translate(0, -dist/2, 0); coneGeo.rotateX(Math.PI/2);
    const beamTex = beamTexture();
    const beam = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({color:'#ffe2b0', alphaMap:beamTex, transparent:true, opacity:0.085, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide}));
    beam.position.copy(lensW).add(new THREE.Vector3(0, 0, 0)); beam.renderOrder = 4; beam.userData.keep = true;
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), target.clone().sub(lensW).normalize());
    prj.add(beam);
  }

  /* Singular: 24 tiny frames on a wall */
  function singularWall(slot, i){
    const g = new THREE.Group(); g.position.copy(slot.pos); g.rotation.y = slot.yaw; root.add(g);
    const W = 30;
    const deck = roundedBox(W, L.DECK.h, 8, 0.25, M.enamel); deck.position.y = -L.DECK.h/2; g.add(deck);
    const trim = roundedBox(W + 0.5, 0.34, 8.5, 0.12, M.brass); trim.position.y = -0.17; g.add(trim);
    const ph = slot.pos.y - L.DECK.h;
    for (const x of [-9, 9]) { const pil = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.8, ph, 24), M.marble); pil.position.set(x, -L.DECK.h - ph/2, 0); g.add(pil); }
    const wallH = 15.5;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(W - 1, wallH, 0.6), new THREE.MeshStandardMaterial({color:'#1a1915', roughness:0.9})); panel.position.set(0, wallH/2, -2.6); g.add(panel);
    const wallGlow = new THREE.Mesh(new THREE.PlaneGeometry(W + 12, wallH + 8), additive(glow, '#ffd9a0', 0.22)); wallGlow.position.set(0, wallH/2, -2.2); g.add(wallGlow);
    const frameGeo = new THREE.BoxGeometry(1, 1, 0.18);
    const picGeo = new THREE.PlaneGeometry(1, 1);
    // 3 images x 2 crops = 6 instanced meshes, 4 frames each
    const variants = [];
    // A white 1x1 map from the start: the program (with USE_MAP) is the final one, so the warm-up
    // compiles it and the real photo swapping in later never triggers a compile mid-scroll.
    const blank = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); blank.colorSpace = THREE.SRGBColorSpace; blank.needsUpdate = true;
    for (let k = 0; k < 6; k++) {
      const m = new THREE.MeshBasicMaterial({color:'#ffffff', toneMapped:false, map:blank});
      variants.push({mesh:new THREE.InstancedMesh(picGeo, m, 4), n:0, mat:m});
      g.add(variants[k].mesh);
    }
    singularLoad = () => ['media/sing-cabinet.jpg', 'media/sing-museum.jpg', 'media/sing-weather.jpg'].forEach((u, j) => {
      texLoader.load(u, t => {
        t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
        for (const k of [j, j + 3]) {
          const c = t.clone(); c.needsUpdate = true;
          c.repeat.set(0.62, 0.9); c.offset.set(k < 3 ? 0.02 : 0.36, 0.05);
          variants[k].mat.map = c; variants[k].mat.needsUpdate = true;
        }
      });
    });
    const frames = new THREE.InstancedMesh(frameGeo, M.brass, 24); g.add(frames);
    const mtx = new THREE.Matrix4(), qq = new THREE.Quaternion(), e = new THREE.Euler();
    let idx = 0;
    for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) {
      const jx = Math.sin(idx*12.9898)*0.28, jy = Math.cos(idx*7.233)*0.22, rot = Math.sin(idx*3.1)*0.025;
      const fw = 3.5 + (idx % 3)*0.2, fh = 2.2 + (idx % 2)*0.15;
      const x = -12.5 + c*5.0 + jx, y = 2.2 + r*3.55 + jy;
      e.set(0, 0, rot); qq.setFromEuler(e);
      mtx.compose(new THREE.Vector3(x, y, -2.2), qq, new THREE.Vector3(fw + 0.28, fh + 0.28, 1)); frames.setMatrixAt(idx, mtx);
      const v = variants[idx % 6];
      mtx.compose(new THREE.Vector3(x, y, -2.09), qq, new THREE.Vector3(fw, fh, 1)); v.mesh.setMatrixAt(v.n, mtx);
      v.mesh.setColorAt(v.n, new THREE.Color().setHSL(0.08 + ((idx*37)%11)/110, 0.2 + ((idx*13)%7)/30, 0.78 + ((idx*5)%5)/22)); v.n++;
      idx++;
    }
    variants.forEach(v => { v.mesh.count = v.n; v.mesh.instanceMatrix.needsUpdate = true; if (v.mesh.instanceColor) v.mesh.instanceColor.needsUpdate = true; });
    const zf = 4 + 0.45;
    addTrain(g, -11.2, -1.7, zf, 32, 18, -38, s => s*(i === 0 ? 1 : shaftRatios[i-1]));
    addTrain(g, 11.2, -1.7, zf, 32, 20, -142, s => s*shaftRatios[i]);
    g.updateMatrixWorld(true);
    axles.push({L:new THREE.Vector3(-11.2, -1.7, zf + 0.85).applyMatrix4(g.matrixWorld), R:new THREE.Vector3(11.2, -1.7, zf + 0.85).applyMatrix4(g.matrixWorld), group:g});
    anchors.push({id:slot.id, kind:'world', pos:slot.pos.clone().add(new THREE.Vector3(0, 18.5, 0)), normal:slot.inward.clone()});
  }

  /* The decks wing: seven small vitrines on the ring */
  function decksWing(slot, i){
    const spanDeg = slot.ext*0.9, n = DECKS.length;
    const smallDeck = {w:7.6, h:1.9, d:5.4}, V = {w:6.6, h:4.8, d:4.4}, PW = 5.6, PH = 3.15;
    const centres = [];
    const wing = new THREE.Group(); root.add(wing);
    DECKS.forEach((deck, k) => {
      const a = slot.alpha + ((k - (n-1)/2)/(n-1))*spanDeg*Math.PI/180;
      const r = L.RING_R + slot.dr;
      const lp = new THREE.Vector3(r*Math.sin(a), slot.deck, r*Math.cos(a));
      const pos = L.hallToWorld(lp.x, lp.y + (k % 2 ? 1.6 : 0), lp.z);
      const inward = new THREE.Vector3(L.RC.x - pos.x, 0, L.RC.z - pos.z).normalize();
      const yaw = Math.atan2(inward.x, inward.z);
      const g = new THREE.Group(); g.position.copy(pos); g.rotation.y = yaw; wing.add(g);
      const d = roundedBox(smallDeck.w, smallDeck.h, smallDeck.d, 0.18, M.enamel); d.position.y = -smallDeck.h/2; g.add(d);
      const tr = roundedBox(smallDeck.w + 0.3, 0.24, smallDeck.d + 0.3, 0.08, M.brass); tr.position.y = -0.12; g.add(tr);
      const ph = pos.y - smallDeck.h;
      const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, ph, 18), M.marble); pil.position.y = -smallDeck.h - ph/2; g.add(pil);
      const vit = makeVitrine(V.w, V.h, V.d, M, {back:false, t:0.2}); g.add(vit);
      const portal = new Portal({images:[deck.cover], plane:PW/PH, phase:k*0.9, tint:'#ffffff'});
      const pm = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), portal.material); pm.position.set(0, 2.3, -V.d/2 + 0.6); g.add(pm);
      const fr = new THREE.Mesh(new THREE.BoxGeometry(PW + 0.4, PH + 0.4, 0.24), M.brassDk); fr.position.set(0, 2.3, -V.d/2 + 0.36); g.add(fr);
      const hl = new THREE.Mesh(new THREE.PlaneGeometry(PW*1.8, PH*2.1), additive(glow, '#ffd9a0', 0.22)); hl.position.set(0, 2.3, -V.d/2 + 0.5); g.add(hl);
      const dir = k % 2 ? -1 : 1;
      addGear(gearGeometry(20, 0.12, 0.34, false), k % 2 ? M.brassHi : M.brass, g, [0, -smallDeck.h/2, smallDeck.d/2 + 0.3], s => dir*s*1.5 + k);
      portal.slot = 'deck-' + deck.slug; portal.worldPos = pos.clone().add(new THREE.Vector3(0, 2.3, 0)); portals.push(portal);
      centres.push({pos, inward, yaw, g});
      anchors.push({id:'deck-' + deck.slug, kind:'deck', deck, pos:pos.clone().add(new THREE.Vector3(0, V.h + 0.8, 0)), normal:inward.clone()});
    });
    // link bars between the small decks
    for (let k = 0; k < n - 1; k++) {
      const a = centres[k], b = centres[k+1];
      const A = a.pos.clone().addScaledVector(new THREE.Vector3(a.inward.z, 0, -a.inward.x), 3.4).add(new THREE.Vector3(0, -1.0, 0)).addScaledVector(a.inward, 2.9);
      const B = b.pos.clone().addScaledVector(new THREE.Vector3(b.inward.z, 0, -b.inward.x), -3.4).add(new THREE.Vector3(0, -1.0, 0)).addScaledVector(b.inward, 2.9);
      const sh = makeShaft(A, B, M, {r:0.22}); root.add(sh.group);
      const dirS = k % 2 ? -1 : 1;
      drivers.push(spin => { sh.spin.rotation.y = dirS*spin*1.5; });
    }
    // the wing's end axles (for the shafts to the neighbouring stations)
    const first = centres[0], last = centres[n-1];
    const wA = first.pos.clone().addScaledVector(new THREE.Vector3(first.inward.z, 0, -first.inward.x), -3.4).add(new THREE.Vector3(0, -1.0, 0)).addScaledVector(first.inward, 2.9);
    const wB = last.pos.clone().addScaledVector(new THREE.Vector3(last.inward.z, 0, -last.inward.x), 3.4).add(new THREE.Vector3(0, -1.0, 0)).addScaledVector(last.inward, 2.9);
    axles.push({L:wA, R:wB, group:wing, small:true});
  }

  const SLOT_INDEX = {};
  L.SLOTS.forEach((s, i) => {
    SLOT_INDEX[s.id] = i;
    const slot = L.SLOT[s.id];
    if (s.id === 'decks') decksWing(slot, i);
    else if (s.id === 'singular') singularWall(slot, i);
    else standardStation(slot, i);
  });
  addProjector();

  /* shafts between neighbouring stations: one drive line, Perpetua at its root */
  const linkShafts = [];
  for (let i = 0; i < axles.length - 1; i++) {
    const sh = makeShaft(axles[i].R, axles[i+1].L, M, {r:0.55}); root.add(sh.group); linkShafts.push(sh.group);
    const ratio = shaftRatios[i];
    drivers.push(spin => { sh.spin.rotation.y = spin*ratio; });
  }

  /* pools of light under each pillar */
  const poolGeo = new THREE.PlaneGeometry(1, 1); poolGeo.rotateX(-Math.PI/2);
  const pools = new THREE.InstancedMesh(poolGeo, additive(glow, '#ffc27a', 0.3), L.SLOTS.length);
  L.SLOTS.forEach((s, i) => { const sl = L.SLOT[s.id]; dm.compose(new THREE.Vector3(sl.pos.x, 0.06, sl.pos.z), new THREE.Quaternion(), new THREE.Vector3(34, 1, 34)); pools.setMatrixAt(i, dm); });
  root.add(pools);

  /* ---------- instanced gears ---------- */
  root.updateMatrixWorld(true);
  const gearMeshes = [];
  const _t = new THREE.Matrix4(), _r = new THREE.Matrix4(), _m = new THREE.Matrix4();
  for (const b of gearBatches.values()) {
    const mesh = new THREE.InstancedMesh(b.geo, b.mat, b.items.length);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false;
    b.items.forEach(it => { it.base = new THREE.Matrix4().multiplyMatrices(it.parent.matrixWorld, _t.makeTranslation(it.pos[0], it.pos[1], it.pos[2])); });
    b.mesh = mesh; root.add(mesh); gearMeshes.push(b);
  }
  drivers.push(spin => {
    for (const b of gearMeshes) {
      b.items.forEach((it, i) => { _r.makeRotationZ(it.angleFn(spin)); _m.multiplyMatrices(it.base, _r); b.mesh.setMatrixAt(i, _m); });
      b.mesh.instanceMatrix.needsUpdate = true;
    }
  });

  /* ---------- static batching: every fixed mesh sharing a material becomes one draw ---------- */
  {
    const skip = new Set([shell, proxy, reflector, perpetua.root]);
    const hasSkipAncestor = o => { for (let p = o; p; p = p.parent) if (skip.has(p)) return true; return false; };
    const groups = new Map();
    const eligible = [];
    root.traverse(o => {
      if (!o.isMesh || o.isInstancedMesh || o.userData.keep || hasSkipAncestor(o)) return;
      const mat = o.material;
      if (Array.isArray(mat) || mat.isShaderMaterial || !o.geometry.index || mat.alphaMap) return;
      eligible.push(o);
    });
    const keep = ['position', 'normal', 'uv'];
    for (const o of eligible) {
      const mat = o.material;
      const additiveGlow = mat.isMeshBasicMaterial && mat.blending === THREE.AdditiveBlending && mat.map;
      const key = additiveGlow ? 'add:' + mat.map.uuid : mat.uuid + ':' + o.renderOrder;
      if (!groups.has(key)) groups.set(key, {mat, glow:!!additiveGlow, order:o.renderOrder, list:[]});
      groups.get(key).list.push(o);
    }
    for (const g of groups.values()) {
      const geos = g.list.map(o => {
        const geo = o.geometry.clone();
        for (const name of Object.keys(geo.attributes)) if (!keep.includes(name)) geo.deleteAttribute(name);
        if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count*2), 2));
        if (g.glow) {
          const col = new Float32Array(geo.attributes.position.count*3), c = o.material.color, k = o.material.opacity;
          for (let i = 0; i < col.length; i += 3) { col[i] = c.r*k; col[i+1] = c.g*k; col[i+2] = c.b*k; }
          geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        }
        o.updateWorldMatrix(true, false);
        geo.applyMatrix4(o.matrixWorld);
        return geo;
      });
      const merged = mergeGeometries(geos);
      geos.forEach(geo => geo.dispose());
      let mat = g.mat;
      if (g.glow) { mat = new THREE.MeshBasicMaterial({map:g.mat.map, vertexColors:true, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, side:g.mat.side}); }
      const mesh = new THREE.Mesh(merged, mat); mesh.renderOrder = g.order;
      mesh.castShadow = false; mesh.receiveShadow = false;
      g.list.forEach(o => o.parent && o.parent.remove(o));
      root.add(mesh);
    }
  }

  /* ---------- per-frame ---------- */
  function update({spin, time, dt, reflect, rackOn = true, rackLive = true, camPos = null}){
    if (camPos) applyShafts(camPos);
    reflWant = !!reflect && mirrorOn;
    if (reflector) { reflFade += ((reflWant ? 1 : 0) - reflFade)*Math.min(1, dt*3); reflector.material.uniforms.uStrength.value = reflFade*0.4; }
    rackActive = rackOn; rack.setLive(rackLive);
    for (const d of drivers) d(spin);
    for (const p of portals) p.update(time, dt);
  }
  /* The drive shafts that reach the world the camera rests on, or the two worlds it is travelling
     between, are hidden: slanting from deck to deck they run in front of the vitrines and cut across
     the screen and the title. Any shaft that comes within CLEAR units of the lens is hidden too. */
  const CLEAR = 8;
  const shaftHide = new Set(), shaftSeg = [];
  for (let i = 0; i < axles.length - 1; i++) shaftSeg.push(new THREE.Line3(axles[i].R, axles[i+1].L));
  const _cp = new THREE.Vector3(), _near = new THREE.Vector3();
  let focused = '';
  function focusWorld(a, b = null){
    const key = (a || '') + '|' + (b || '');
    if (key === focused) return;
    focused = key; shaftHide.clear();
    for (const id of [a, b]) {
      if (!id) continue;
      const k = SLOT_INDEX[id];
      shaftHide.add(k); shaftHide.add(k - 1);
    }
    applyShafts(null);
  }
  function applyShafts(camPos){
    linkShafts.forEach((g, i) => {
      let vis = !shaftHide.has(i);
      if (vis && camPos) { shaftSeg[i].closestPointToPoint(camPos, true, _near); vis = _near.distanceTo(camPos) > CLEAR; }
      g.visible = vis;
    });
  }
  /* Everything except Perpetua's own vitrine lives in `far`, so the first frame
     can be shown before the rest of the gallery's shaders are linked. */
  const far = new THREE.Group(); far.name = 'far';
  for (const c of [...root.children]) if (c !== shell && c !== pad && c !== plainFloor) far.add(c);
  root.add(far);
  // Staged reveal: each child is hidden until revealNext() draws it for the first
  // time, so shader links are spread over many frames instead of one long freeze.
  const stages = [...far.children].sort((a, b) => (b === reflector) - (a === reflector));
  stages.forEach(c => { c.visible = false; });
  let stageIdx = 0;
  const pending = () => stageIdx < stages.length;
  const revealNext = () => { const c = stages[stageIdx++]; c.visible = true; return c; };
  const revealAll = () => { while (pending()) revealNext(); };
  /* Images are fetched a few at a time once the visitor starts to leave the machine. */
  let loadingStarted = false;
  function startLoading(){
    if (loadingStarted) return; loadingStarted = true;
    singularLoad();
    portals.forEach((p, i) => setTimeout(() => p.ensureLoaded(), 60 + i*140));
  }
  /* One clip at a time, behind the loading veil: starting a decoder costs a 50 to 150 ms stall. */
  const prewarmVideos = async () => { for (const p of portals) await p.prewarmVideo(); };
  return {root, update, portals, prewarmVideos, axles, gearMeshes, linkShafts, anchors, M, shell, rack, SLOT_INDEX, pending, revealNext, revealAll, startLoading, setBackdrop, focusWorld, setMirror, plainFloor, hasMirror:() => !!reflector, mirrorIsOn:() => mirrorOn};
}
