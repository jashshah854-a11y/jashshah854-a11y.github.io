// Pure model for the movement: gear teeth, layout, mesh phase, play and drift.
// No three.js in here so it can be checked under node.

export const MODULE = 0.1;
export const PLAY_FRAC = 0.2; // play at each mesh, as a fraction of one tooth pitch (drawn teeth are 0.40 pitch wide)
export const BEAT = 2.0; // escapement beat in Hz, drives the play flips
export const HAND_SPEED = 0.5; // rad/s, true time

// [teeth on the input gear that meshes the previous stage, teeth on the output gear that meshes the next]
const STAGE_TEETH = [
  [0, 44], [30, 38], [46, 34], [24, 40], [47, 32], [22, 42],
  [50, 36], [26, 40], [48, 34], [24, 44], [52, 38], [27, 40],
];

export function teethFor(id) {
  if (id === 0) return STAGE_TEETH[0];
  return STAGE_TEETH[1 + ((id - 1) % 11)];
}

export const rad = (z) => (MODULE * z) / 2;

/**
 * Greedy compact layout. Stage 0 sits at the origin and carries the hand.
 * Stage j sits where its input gear (depth j-1) meshes stage j-1's output gear (depth j-1).
 * Its own output gear sits one level lower (depth j). So every level holds exactly one meshing pair,
 * and the stack steps downward from the hand.
 * Rules: no gear may cover another stage's post, and the contact point of a new mesh must stay
 * uncovered by the gears above it, so every mesh can be seen.
 */
export function layout(ids) {
  const out = [];
  const gears = []; // {x,y,r,depth,stage,kind}
  const posts = [];
  const covered = (x, y, depth, skip) => {
    for (const h of gears) {
      if (h.depth >= depth || (skip && skip(h))) continue;
      if (Math.hypot(x - h.x, y - h.y) < h.r) return true;
    }
    return false;
  };
  for (let j = 0; j < ids.length; j++) {
    const [zA, zB] = teethFor(ids[j]);
    if (j === 0) {
      out.push({ x: 0, y: 0, phi: 0 });
      gears.push({ x: 0, y: 0, r: rad(zB), depth: 0, stage: 0, kind: 'B' });
      posts.push({ x: 0, y: 0 });
      continue;
    }
    const prev = out[j - 1];
    const prevR = rad(teethFor(ids[j - 1])[1]);
    const d = prevR + rad(zA);
    let best = null;
    for (let pass = 0; pass < 3 && !best; pass++) {
      for (let a = 0; a < 360; a += 10) {
        const phi = (a * Math.PI) / 180;
        const x = prev.x + d * Math.cos(phi);
        const y = prev.y + d * Math.sin(phi);
        if (pass < 2) {
          let ok = true;
          for (const g of [rad(zA), rad(zB)]) {
            for (let k = 0; k < posts.length; k++) {
              if (k === j - 1 && g === rad(zA)) continue;
              if (Math.hypot(x - posts[k].x, y - posts[k].y) < g + 0.3) { ok = false; break; }
            }
            if (!ok) break;
          }
          if (ok) {
            for (const h of gears) {
              if (h.stage === j - 1 && h.kind === 'B') continue;
              if (Math.hypot(x - h.x, y - h.y) < h.r + 0.3) { ok = false; break; }
            }
          }
          if (ok && pass === 0) {
            const cx = prev.x + prevR * Math.cos(phi), cy = prev.y + prevR * Math.sin(phi);
            if (covered(cx, cy, j - 1)) ok = false;
          }
          if (!ok) continue;
        }
        // tight packing around the hand, a small nudge against dead straight runs, and a penalty for hiding the new gears
        let score = Math.hypot(x, y);
        if (j >= 2) {
          const turn = Math.abs(((phi - out[j - 1].phi + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
          score += turn < 0.15 ? 0.8 : 0;
        }
        let hidden = 0;
        for (const [gr, dep] of [[rad(zA), j - 1], [rad(zB), j]]) {
          for (let s = 0; s < 8; s++) {
            const sx = x + Math.cos((s / 8) * Math.PI * 2) * gr * 0.7, sy = y + Math.sin((s / 8) * Math.PI * 2) * gr * 0.7;
            if (covered(sx, sy, dep)) hidden++;
          }
        }
        score += hidden * 0.7;
        if (!best || score < best.score) best = { x, y, phi, score };
      }
    }
    out.push({ x: best.x, y: best.y, phi: best.phi });
    gears.push({ x: best.x, y: best.y, r: rad(zA), depth: j - 1, stage: j, kind: 'A' });
    gears.push({ x: best.x, y: best.y, r: rad(zB), depth: j, stage: j, kind: 'B' });
    posts.push({ x: best.x, y: best.y });
  }
  return out;
}

export function bounds(pos, ids) {
  let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
  pos.forEach((p, j) => {
    const r = Math.max(rad(teethFor(ids[j])[1]), j ? rad(teethFor(ids[j])[0]) : 0) + 0.5;
    minx = Math.min(minx, p.x - r); maxx = Math.max(maxx, p.x + r);
    miny = Math.min(miny, p.y - r); maxy = Math.max(maxy, p.y + r);
  });
  return { cx: (minx + maxx) / 2, cy: (miny + maxy) / 2, w: maxx - minx, h: maxy - miny };
}

// Phase of a gear with zb teeth meshing a gear with za teeth at angle thA, when the
// second gear's centre lies in direction phi from the first. Teeth sit at k*2pi/z.
export function meshForward(za, thA, phi, zb) {
  return phi + Math.PI - Math.PI / zb + (za * (phi - thA)) / zb;
}

/** Ideal angles of the output gear (B) of each stage, given the hand's angle. */
export function idealAngles(ids, pos, handAngle) {
  const th = [handAngle]; // arbor angle, shared by A and B of one stage
  for (let j = 1; j < ids.length; j++) {
    const zB = teethFor(ids[j - 1])[1];
    const zA = teethFor(ids[j])[0];
    const dx = pos[j].x - pos[j - 1].x, dy = pos[j].y - pos[j - 1].y;
    th.push(meshForward(zB, th[j - 1], Math.atan2(dy, dx), zA));
  }
  return th;
}

/** Play state of mesh j (between stage j-1 and j): -0.5..0.5, a flip per escapement beat that travels outward. */
export function playU(j, T) {
  const s = Math.sin(2 * Math.PI * BEAT * T - j * 0.42);
  return (0.5 * Math.tanh(5 * s)) / Math.tanh(5);
}

/** Error of every arbor, propagated back from the driver (last stage) to the hand. */
export function errors(ids, T) {
  const n = ids.length;
  const e = new Array(n).fill(0);
  for (let k = n - 2; k >= 0; k--) {
    const zB = teethFor(ids[k])[1];
    const zA = teethFor(ids[k + 1])[0];
    const b = (PLAY_FRAC * 2 * Math.PI) / zB;
    // play always lags against the direction of rotation, and neighbouring arbors turn opposite ways
    const dir = k % 2 === 0 ? 1 : -1;
    e[k] = -(zA / zB) * e[k + 1] + dir * b * playU(k + 1, T);
  }
  return e;
}

/** Peak to peak hand play in radians: every mesh's play, scaled by speed ratio down to the hand. */
export function handPlay(ids) {
  let sum = 0;
  for (let k = 1; k < ids.length; k++) {
    const zB = teethFor(ids[k - 1])[1];
    const b = (PLAY_FRAC * 2 * Math.PI) / zB;
    // error injected at arbor k-1 by mesh k, carried to the hand
    let rho = 1;
    for (let i = 1; i <= k - 1; i++) rho *= teethFor(ids[i])[0] / teethFor(ids[i - 1])[1];
    sum += b * rho;
  }
  return sum;
}

/** Fraction of true time the hand loses: friction per extra part plus 15 percent of the hand play. */
export function lossRate(ids) {
  const n = ids.length;
  return 0.004 * Math.max(0, n - 2) + 0.15 * handPlay(ids);
}

/** Reserve drains faster with every extra part: fraction of a full wind per second. */
export function drainRate(n) {
  return 0.0125 * (1 + 0.32 * Math.max(0, n - 2));
}

export const TOLERANCE = 1 / 30; // keeps time = loses less than two minutes an hour (model)
