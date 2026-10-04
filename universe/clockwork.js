/* The arithmetic of the overhead clockwork, with no three.js in it so a node script can check the
   meshing. Every layer is a planetary train on the main column: a sun on the column, planets on a
   fixed carrier, and an internal ring gear that the planets drive. The ring turns against the sun by
   Ns/NR, so the tooth counts alone set every speed. Angles are in the gear plane; a gear at angle a
   is drawn rotated by a. */

export const TWO_PI = Math.PI*2;

/* Tooth profile numbers shared with parts.js gearGeometry: root and tip half-widths as a fraction of
   half a pitch. The ring's teeth are cut slimmer (RING_*), so each planet tooth has room in a ring gap. */
export const EXT = {wr:0.56, wt:0.26};
export const RING = {wr:0.40, wt:0.20};

export function planetary({Ns, Np, P, m, sunRate, ringPhase = 0, phi0 = 0}){
  const NR = Ns + 2*Np;
  if ((Ns + NR) % P) throw new Error(`planetary ${Ns}/${Np}/${P} cannot be assembled`);
  const d = (Ns + Np)*m/2;                            // sun to planet centre distance
  const ringRate = -sunRate*Ns/NR;
  const planetRate = -sunRate*Ns/Np;
  const planets = [];
  for (let j = 0; j < P; j++) {
    const phi = phi0 + j*TWO_PI/P;
    // planet inside the ring: ring tooth against planet gap (same direction of contact)
    const phase = phi + Math.PI/Np - (phi - ringPhase)*NR/Np;
    planets.push({phi, x:d*Math.cos(phi), z:-d*Math.sin(phi), phase, rate:planetRate});
  }
  // sun against planet 0: opposite directions of contact, tooth against gap
  const p0 = planets[0];
  const sunPhase = p0.phi + (p0.phi + Math.PI - Math.PI/Np - p0.phase)*Np/Ns;
  return {Ns, Np, P, NR, m, d, sunRate, sunPhase, ringRate, ringPhase, planets, rs:Ns*m/2, rp:Np*m/2, Rp:NR*m/2};
}

/* Every planet must agree with the sun on one phase (mod one sun pitch). Returns the worst mismatch in
   sun-pitch fractions: 0 is perfect. */
export function sunMismatch(t){
  let worst = 0;
  const pitch = TWO_PI/t.Ns;
  for (const p of t.planets) {
    const need = p.phi + (p.phi + Math.PI - Math.PI/t.Np - p.phase)*t.Np/t.Ns;
    let e = ((need - t.sunPhase) % pitch + pitch) % pitch;
    if (e > pitch/2) e -= pitch;
    worst = Math.max(worst, Math.abs(e)/pitch);
  }
  return worst;
}
