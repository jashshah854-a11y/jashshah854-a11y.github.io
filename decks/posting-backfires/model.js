// The loop model. Pure math, no DOM: a voice, a delayed return path, a clipper.
// mic[n] = voice[n] + roomNoise + G * K * filter(out[n - D])
// out[n] = softClip(mic[n])
// Below unity the return path dies away. Past unity the room noise grows
// round by round until the clipper holds it at the rails.

export const FS = 8000;       // virtual sample rate
export const D = 128;         // acoustic delay in samples: 16 ms, a 62 Hz loop
export const WINDOW = 1024;   // samples on the scope screen (128 ms)
export const VOICE_HZ = 16;
export const VOICE_AMP = 0.42;

// One-pole high-pass (about 25 Hz) and low-pass (about 150 Hz) in the return
// path: the speaker and the room do not carry every pitch equally.
const HP_A = Math.exp(-2 * Math.PI * 25 / FS);
const LP_A = Math.exp(-2 * Math.PI * 150 / FS);

// K normalises the return path so the loop gain G = 1 is where the strongest
// resonance stops dying and starts growing (checked in test-model.mjs).
export const K = 1.19;

export function softClip(x) {
  const s = Math.abs(x);
  const y = s < 0.7 ? s : 0.7 + 0.3 * Math.tanh((s - 0.7) / 0.3);
  return x < 0 ? -y : y;
}

// Small deterministic noise so every run, and every test, is repeatable.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createLoop(seed = 7, noise = 0.02) {
  const RING = 8192;
  return {
    t: 0,
    outBuf: new Float32Array(RING),   // what the PA plays
    ring: RING,
    hp: 0, hpPrev: 0, lp: 0,
    rand: rng(seed),
    noise,
  };
}

// Advance n samples with loop gain G and a voice level (0..1).
export function step(L, n, G, voiceLevel = 1) {
  const { outBuf, ring } = L;
  for (let i = 0; i < n; i++) {
    const t = L.t;
    const w = 0.92 + 0.08 * Math.sin(2 * Math.PI * 0.9 * t / FS);
    const voice = VOICE_AMP * voiceLevel * w * Math.sin(2 * Math.PI * VOICE_HZ * t / FS);
    const delayed = outBuf[(t - D + ring * 4) % ring];
    // high-pass then low-pass of the delayed output
    const hpOut = HP_A * (L.hp + delayed - L.hpPrev);
    L.hp = hpOut; L.hpPrev = delayed;
    L.lp = LP_A * L.lp + (1 - LP_A) * hpOut;
    const fb = G * K * L.lp;
    const room = (L.rand() - 0.5) * 2 * L.noise;
    outBuf[t % ring] = softClip(voice + room + fb);
    L.t = t + 1;
  }
}

// Run the loop long enough to reach its steady behaviour (reduced motion and tests).
export function settle(L, G, samples = 8000, voiceLevel = 1) {
  step(L, samples, G, voiceLevel);
}

// Last WINDOW samples, triggered on a confirmed rising zero crossing (the average
// just before is negative, the average just after is positive) so noise cannot
// flip the trace by half a cycle.
export function triggered(L, out) {
  const { outBuf, ring } = L;
  const at = (i) => outBuf[((i % ring) + ring) % ring];
  const end = L.t;
  const span = WINDOW + 700;
  const H = 20;
  let start = end - WINDOW;
  for (let i = end - WINDOW - H - 1; i > end - span; i--) {
    if (!(at(i) < 0 && at(i + 1) >= 0)) continue;
    let before = 0, after = 0;
    for (let k = 1; k <= H; k++) { before += at(i - k); after += at(i + 1 + k); }
    if (before / H < -0.03 && after / H > 0.03) { start = i + 1; break; }
  }
  for (let j = 0; j < WINDOW; j++) out[j] = at(start + j);
  return out;
}

export function rms(L, n = 512) {
  let s = 0;
  for (let i = 0; i < n; i++) {
    const v = L.outBuf[(((L.t - 1 - i) % L.ring) + L.ring) % L.ring];
    s += v * v;
  }
  return Math.sqrt(s / n);
}

export function clipFraction(L, n = 512) {
  let c = 0;
  for (let i = 0; i < n; i++) {
    const v = Math.abs(L.outBuf[(((L.t - 1 - i) % L.ring) + L.ring) % L.ring]);
    if (v > 0.93) c++;
  }
  return c / n;
}

// ------------------------------------------------------------------ the knobs the deck turns
// Each post raises the raw gain. These numbers are the toy's, not the research's.
export const POST_STEP = 0.19;
export const POST_BASE = 0.2;
export const MAX_POSTS = 8;

export function rawGain(posts) { return posts <= 0 ? 0 : POST_BASE + POST_STEP * posts; }

// Days since the post: strong for a few days, fading around a week. The research
// reports the effect diminishing once the ask waited a week; the curve is a model.
export function salience(days) { return 1 / (1 + Math.pow(days / 10, 3)); }

// c: { posts, idRelevant, pub, pre, days, central, frame, reward }
export function loopGain(c) {
  let g = rawGain(c.posts);
  g *= c.idRelevant ? 1 : 0.12;   // a functional product has no identity to return
  g *= c.pub ? 1 : 0.12;          // nobody heard it, so nothing comes back
  g *= c.pre ? 1 : 0.12;          // the urge was already spent on the purchase
  g *= salience(c.days || 0);
  g *= c.central ? 0.6 : 1;       // a central identity needs more than one post to feel answered
  g *= c.frame ? 0.45 : 1;        // framing the function takes the self-expression out of the post
  g *= c.reward ? 0.5 : 1;        // a paid-for post is less of a statement about you
  return g;
}
