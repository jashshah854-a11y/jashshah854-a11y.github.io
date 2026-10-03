/* Where everything sits. One place, so the camera journey (data) and the hall
   (geometry) can never disagree. Units: 1 = one unit of Perpetua's own model. */
import * as THREE from 'three';

export const PY = 8.05;                         // Perpetua's base sits on top of the plinth
export const LINE_DIR = new THREE.Vector3(0.86, 0, -0.51).normalize();
export const LINE_P0 = new THREE.Vector3(9.4, 0.5, 8.4);   // where the teeth reach the floor
export const LINE_LEN = 205;
export const FLOOR_GEAR_R = 17;
export const RC = LINE_P0.clone().addScaledVector(LINE_DIR, LINE_LEN + FLOOR_GEAR_R + 3); // rotunda centre
export const RING_R = 78;

// Hall-local frame: +z points from the rotunda centre back towards Perpetua (the entrance).
export const zL = LINE_DIR.clone().negate();
export const yL = new THREE.Vector3(0, 1, 0);
export const xL = new THREE.Vector3(zL.z, 0, -zL.x);
export function hallToWorld(x, y, z){
  return new THREE.Vector3().copy(RC).addScaledVector(xL, x).addScaledVector(yL, y).addScaledVector(zL, z);
}

// Vitrine and deck sizes
export const VIT = {w:17, h:11, d:9};
export const DECK = {w:21, h:3.4, d:11};
export const PORTAL = {w:15.2, h:8.55};         // 16:9

/* Slots round the rotunda, in visiting order. ext = angular footprint (deg),
   deck = height of the deck top, dr = radial offset (depth). */
export const SLOTS = [
  {id:'cyber',       ext:26, deck:14, dr:0},
  {id:'launchboard', ext:26, deck:26, dr:-6},
  {id:'mgmtio',      ext:26, deck:9,  dr:5},
  {id:'round',       ext:26, deck:21, dr:-4},
  {id:'fieldfold',   ext:26, deck:30, dr:4},
  {id:'workbench',   ext:26, deck:12, dr:-5},
  {id:'jev',         ext:26, deck:24, dr:3},
  {id:'decks',       ext:48, deck:10, dr:0},
  {id:'deadend',     ext:28, deck:22, dr:-3},
  {id:'singular',    ext:28, deck:15, dr:2}
];

const START_DEG = 38;
let a = START_DEG;
export const SLOT = {};
for (const s of SLOTS) {
  const alpha = (a + s.ext/2) * Math.PI/180;
  a += s.ext;
  const r = RING_R + s.dr;
  const local = new THREE.Vector3(r*Math.sin(alpha), s.deck, r*Math.cos(alpha));
  const pos = hallToWorld(local.x, local.y, local.z);                  // centre of the deck top
  const inward = new THREE.Vector3(RC.x - pos.x, 0, RC.z - pos.z).normalize(); // front normal
  const right = new THREE.Vector3(inward.z, 0, -inward.x);            // viewer's right while facing the vitrine
  SLOT[s.id] = {...s, alpha, pos, inward, right, yaw:Math.atan2(inward.x, inward.z),
    portal: pos.clone().add(new THREE.Vector3(0, VIT.h/2, 0))};
}

/* Resolve a data position spec into a world-space Vector3. */
export function resolve(spec){
  switch (spec.at) {
    case 'perp': return new THREE.Vector3(spec.p[0], spec.p[1] + PY, spec.p[2]);
    case 'world': return new THREE.Vector3(...spec.p);
    case 'hall': return hallToWorld(...spec.p);
    case 'line': return LINE_P0.clone().addScaledVector(LINE_DIR, spec.along)
        .addScaledVector(new THREE.Vector3(LINE_DIR.z, 0, -LINE_DIR.x), spec.side || 0).add(new THREE.Vector3(0, spec.up || 0, 0));
    case 'slot': {
      const s = SLOT[spec.id], d = spec.d ?? 24, up = spec.up ?? 0, shift = spec.shift ?? 0;
      if (spec.role === 'look') {
        return s.portal.clone().addScaledVector(s.right, shift).add(new THREE.Vector3(0, up, 0));
      }
      return s.portal.clone().addScaledVector(s.inward, d).add(new THREE.Vector3(0, up, 0));
    }
  }
  throw new Error('bad spec ' + JSON.stringify(spec));
}
