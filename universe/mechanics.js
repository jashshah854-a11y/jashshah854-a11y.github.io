/* Perpetua mechanics, ported verbatim from perpetua/index.html (mechanics.js).
   Analytic crank-slider linkage plus a deliberately reduced energy model.
   One shared phase theta drives every moving part in the universe. */
export const Mechanics = (() => {
  const C = Object.freeze({cx:-2.30, cy:2.75, crank:0.90, rod:4.60,
    teethA:56, teethB:28, module:0.06, pressure:20*Math.PI/180,
    backlash:0.006, mainInertia:3.80, secondInertia:0.22, sliderMass:0.90,
    viscous:0.20, dryFriction:0.30, nominalOmega:1.12});
  const ratio = C.teethA / C.teethB;
  const distance = (C.teethA + C.teethB) * C.module / 2;
  function pose(theta) {
    const s = Math.sin(theta), c = Math.cos(theta), root = Math.sqrt(C.rod*C.rod - C.crank*C.crank*s*s);
    return {pin:[C.cx + C.crank*c, C.cy + C.crank*s, 1.99],
      slider:[C.cx + C.crank*c + root, C.cy, 1.99],
      dx:-C.crank*s - C.crank*C.crank*s*c/root,
      secondAngle:-ratio*theta + Math.PI/C.teethB};
  }
  function inertia(theta){const d = pose(theta).dx; return C.mainInertia + ratio*ratio*C.secondInertia + C.sliderMass*d*d;}
  function omega(theta, energy){return Math.sqrt(Math.max(0, 2*energy/inertia(theta)));}
  function initial(theta = 0.62){
    const energy = 0.5*inertia(theta)*C.nominalOmega*C.nominalOmega;
    return {theta, energy, friction:false, paused:false, turns:0, heat:0, supplied:energy};
  }
  function step(s, dt) {
    if (s.paused || s.energy <= 0 || dt <= 0) return s;
    const count = Math.max(1, Math.ceil(dt/(1/180))), h = dt/count;
    for (let i = 0; i < count; i++) {
      let w = omega(s.theta, s.energy);
      if (s.friction) {
        const loss = Math.min(s.energy, (C.viscous*w*w + C.dryFriction*w)*h);
        s.energy -= loss; s.heat += loss;
      }
      w = omega(s.theta, s.energy);
      const mid = s.theta + 0.5*h*w;
      const delta = h*omega(mid, s.energy);
      s.theta = (s.theta + delta) % (2*Math.PI); s.turns += delta/(2*Math.PI);
    }
    return s;
  }
  function push(s){
    const cap = 0.5*inertia(s.theta)*(C.nominalOmega*1.65)**2;
    const amount = Math.max(0, Math.min(cap - s.energy, 0.5*inertia(s.theta)*C.nominalOmega**2));
    s.energy += amount; s.supplied += amount; return amount;
  }
  function gearOutline(n){
    const rp = n*C.module/2, rb = rp*Math.cos(C.pressure), rr = rp - 1.25*C.module, ra = rp + C.module;
    const inv = a => Math.tan(a) - a;
    const half = r => Math.PI/(2*n) - C.backlash/(2*rp) + inv(C.pressure) - inv(Math.acos(Math.min(1, rb/r)));
    const start = Math.max(rr, rb), out = [];
    const point = (r, a) => out.push([r*Math.cos(a), r*Math.sin(a)]);
    for (let t = 0; t < n; t++) {
      const c = 2*Math.PI*t/n;
      point(rr, c - Math.PI/n); point(rr, c - half(start));
      for (let j = 0; j <= 7; j++) { let r = start + (ra - start)*j/7; point(r, c - half(r)); }
      const a = half(ra); for (let j = 1; j <= 3; j++) point(ra, c - a + 2*a*j/3);
      for (let j = 1; j <= 7; j++) { let r = ra - (ra - start)*j/7; point(r, c + half(r)); }
      point(rr, c + half(start));
    }
    return out.filter((p, i) => i === 0 || Math.hypot(p[0] - out[i-1][0], p[1] - out[i-1][1]) > 1e-9);
  }
  return {C, ratio, distance, pose, inertia, omega, initial, step, push, gearOutline};
})();
