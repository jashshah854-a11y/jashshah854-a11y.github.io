/* Portals: the picture of each world inside its vitrine.
   A portal shows a still (or a slow crossfade of stills) with a camera-like
   drift. At most two portals also play a looping video: the two nearest the
   camera. Everything is one shader so a portal costs one draw call. */
import * as THREE from 'three';

const VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uA, uB, uV;
uniform float uMix, uVideo, uTime, uPlane, uAspA, uAspB, uAspV, uPhase, uGain, uFlicker, uZoom0;
uniform vec2 uPan0;
vec2 cover(vec2 uv, float asp, vec2 pan, float zoom){
  vec2 s = vec2(1.0);
  if (asp > uPlane) s.x = uPlane/asp; else s.y = asp/uPlane;
  vec2 vs = s/zoom;
  vec2 c = 0.5 + pan*(1.0 - vs)*0.5;
  return c + (uv - 0.5)*vs;
}
void main(){
  vec2 uv0 = vUv;
  #ifdef REFLECT
  uv0 = vec2(vUv.x, vUv.y*0.5);
  float rf = pow(1.0 - vUv.y, 2.0)*0.3;
  #endif
  float t = uTime*0.11 + uPhase;
  vec2 panA = uPan0 + vec2(sin(t), cos(t*0.7))*0.35;
  vec2 panB = uPan0 + vec2(sin(t + 2.1), cos(t*0.7 + 1.3))*0.35;
  float zoom = uZoom0 + 0.05*sin(t*0.8);
  vec3 a = texture2D(uA, cover(uv0, uAspA, panA, zoom)).rgb;
  vec3 b = texture2D(uB, cover(uv0, uAspB, panB, zoom)).rgb;
  vec3 col = mix(a, b, uMix);
  if (uVideo > 0.001) {
    vec3 v = texture2D(uV, cover(uv0, uAspV, vec2(0.0), 1.0)).rgb;
    col = mix(col, v, uVideo);
  }
  vec2 q = vUv - 0.5;
  col *= 1.0 - 0.32*dot(q, q)*2.2;
  col *= uGain*(1.0 + uFlicker*(sin(uTime*47.0)*0.5 + sin(uTime*13.0 + 1.7)*0.5)*0.03);
  #ifdef REFLECT
  gl_FragColor = vec4(col*rf, 1.0);
  #else
  gl_FragColor = vec4(col, 1.0);
  #endif
  #include <colorspace_fragment>
}`;

const loader = new THREE.TextureLoader();
let gpu = null, maxSize = 0, aniso = 4;
/* Textures are uploaded the moment they arrive, not when they first come into view.
   On phones every picture is capped at maxSize px wide (1024): 26 pictures at 1600 px with mipmaps are
   about 190 MB of GPU memory, at 1024 about 80 MB, and a portal never covers more than ~1000 device px. */
export function setRenderer(r, opts = {}){ gpu = r; maxSize = opts.maxSize || 0; aniso = opts.aniso || 4; }
export const texAniso = () => aniso;
export function capTexture(t){
  const img = t.image;
  if (!maxSize || !img || Math.max(img.width, img.height) <= maxSize) return t;
  const k = maxSize/Math.max(img.width, img.height), c = document.createElement('canvas');
  c.width = Math.round(img.width*k); c.height = Math.round(img.height*k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  t.image = c; t.needsUpdate = true;
  return t;
}
const texCache = new Map();
const placeholder = new THREE.DataTexture(new Uint8Array([20, 19, 15, 255]), 1, 1);
placeholder.needsUpdate = true;
/* At most three images are in flight at once, so a simple static server is never hit with a burst.
   Jobs still waiting can be moved to the front (bump), so the world the visitor is at never waits behind
   the rest of the gallery on a slow phone connection. */
const queue = []; let inFlight = 0;
function pump(){ while (inFlight < 3 && queue.length) { inFlight++; queue.shift().run(() => { inFlight--; pump(); }); } }
export function bump(url){
  const i = queue.findIndex(j => j.url === url);
  if (i > 0) queue.unshift(queue.splice(i, 1)[0]);
}
export function loadTexture(url){
  if (texCache.has(url)) return texCache.get(url);
  const entry = {tex:placeholder, aspect:16/9, ready:false};
  texCache.set(url, entry);
  queue.push({url, run:done => loader.load(url, t => {
    capTexture(t);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; t.generateMipmaps = true;
    entry.tex = t; entry.aspect = t.image.width / t.image.height; entry.ready = true; entry.onload?.();
    if (gpu) gpu.initTexture(t);
    done();
  }, undefined, () => { entry.failed = true; done(); })});
  pump();
  return entry;
}

export class Portal {
  /** images: urls for the crossfade, video: optional mp4 url */
  constructor({images, video, plane = 16/9, phase = 0, gain = 1, flicker = 0, cycle = 6.5, zoom = 1.1, pan0 = [0, 0]}){
    this.urls = images;
    this.entries = images.map(() => ({tex:placeholder, aspect:16/9}));   // real textures load lazily, see ensureLoaded()
    this.loadedN = 0;
    this.video = null; this.videoUrl = video; this.cycle = cycle;
    this.videoTex = null;
    this.material = new THREE.ShaderMaterial({
      vertexShader:VERT, fragmentShader:FRAG, toneMapped:false, fog:false,
      // the screen sits 8 cm in front of its brass frame; the bias keeps it in front on a coarse depth buffer
      polygonOffset:true, polygonOffsetFactor:-1, polygonOffsetUnits:-6,
      uniforms:{uA:{value:placeholder}, uB:{value:placeholder}, uV:{value:placeholder}, uMix:{value:0}, uVideo:{value:0},
        uTime:{value:0}, uPlane:{value:plane}, uAspA:{value:16/9}, uAspB:{value:16/9}, uAspV:{value:16/9},
        uPhase:{value:phase}, uGain:{value:gain}, uFlicker:{value:flicker}, uZoom0:{value:zoom}, uPan0:{value:new THREE.Vector2(pan0[0], pan0[1])}}
    });
    this.reflectionMaterial = new THREE.ShaderMaterial({vertexShader:VERT, fragmentShader:FRAG, uniforms:this.material.uniforms, defines:{REFLECT:1}, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide, toneMapped:false, fog:false, polygonOffset:true, polygonOffsetFactor:-1, polygonOffsetUnits:-4});
    this.playing = false; this.mixTarget = 0; this.t0 = Math.random()*10;
  }
  /* The lead picture first (all = false), the rest of a crossfade later: every vitrine gets a picture
     before any vitrine gets its second one. */
  ensureLoaded(all = true){
    const n = all ? this.urls.length : 1;
    for (let i = this.loadedN; i < n; i++) this.entries[i] = loadTexture(this.urls[i]);
    this.loadedN = Math.max(this.loadedN, n);
  }
  /* The camera is at (or flying between) this world: its lead picture goes to the front of the queue,
     the rest of its pictures queue behind whatever is already waiting. */
  prioritize(){
    this.ensureLoaded(false);
    bump(this.urls[0]);
    this.ensureLoaded(true);
  }
  /* The element, its decoder and its GPU texture are created the first time a video is wanted.
     Doing that mid-scroll cost a 50 to 90 ms frame, so prewarmVideo() does it behind the loading veil: the
     clip plays for one decoded frame, is uploaded once, then rests paused until it is needed. */
  _makeVideo(){
    if (this.video || !this.videoUrl) return;
    const v = document.createElement('video');
    v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto'; v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
    v.crossOrigin = 'anonymous'; v.src = this.videoUrl;
    this.video = v;
    this.videoTex = new THREE.VideoTexture(v); this.videoTex.colorSpace = THREE.SRGBColorSpace;
    v.addEventListener('loadedmetadata', () => { this.material.uniforms.uAspV.value = v.videoWidth / v.videoHeight; });
  }
  prewarmVideo(){
    if (!this.videoUrl || this.video) return Promise.resolve();
    this._makeVideo();
    const v = this.video;
    return new Promise(done => {
      const give = setTimeout(done, 2500);              // a slow connection never holds the veil
      const finish = () => { clearTimeout(give); done(); };
      const warm = () => {
        if (this.playing) return finish();               // the camera got here first: nothing to warm
        v.play().then(() => {
          const settle = () => {
            if (!this.playing) { v.pause(); v.currentTime = 0; }
            if (gpu && v.readyState >= 2) gpu.initTexture(this.videoTex);
            finish();
          };
          if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(settle); else setTimeout(settle, 200);
        }).catch(finish);
      };
      if (v.readyState >= 2) warm(); else v.addEventListener('loadeddata', warm, {once:true});
    });
  }
  setVideoPlaying(on){
    if (!this.videoUrl) return;
    if (on && !this.video) this._makeVideo();
    if (on && !this.playing && this.video) { this.video.play().catch(() => {}); this.playing = true; this.material.uniforms.uV.value = this.videoTex; }
    if (!on && this.playing) { this.video.pause(); this.playing = false; }
  }
  update(time, dt){
    const u = this.material.uniforms;
    u.uTime.value = time + this.t0;
    /* Only pictures that have arrived take part. Cycling through a still that is not here yet (slow phone
       connection) would fade the screen to the dark placeholder, so the vitrine looked empty. */
    const have = this.entries.filter(e => e.ready), n = have.length;
    if (n <= 1) { const a = have[0] || this.entries[0]; u.uA.value = a.tex; u.uB.value = a.tex; u.uAspA.value = u.uAspB.value = a.aspect; u.uMix.value = 0; }
    else {
      // cycle through the images: hold, then a 1.4 s crossfade
      const phase = ((time + this.t0)/this.cycle);
      const idx = Math.floor(phase) % n, nxt = (idx + 1) % n, k = phase - Math.floor(phase);
      const x = Math.min(1, Math.max(0, (k - (1 - 1.4/this.cycle)) / (1.4/this.cycle)));
      const e1 = have[idx], e2 = have[nxt];
      u.uA.value = e1.tex; u.uB.value = e2.tex; u.uAspA.value = e1.aspect; u.uAspB.value = e2.aspect;
      u.uMix.value = x*x*(3 - 2*x);
    }
    const ready = this.playing && this.video && this.video.readyState >= 2;
    this.mixTarget = ready ? 1 : 0;
    u.uVideo.value += (this.mixTarget - u.uVideo.value)*Math.min(1, dt*3);
  }
}

/* Keep at most two videos playing: those nearest the camera. */
export function chooseVideos(portals, camPos, maxPlaying = 2, maxDist = 260){
  const live = portals.filter(p => p.videoUrl && p.worldPos);
  for (const p of live) p._d = p.worldPos.distanceTo(camPos);
  live.sort((a, b) => a._d - b._d);
  live.forEach((p, i) => p.setVideoPlaying(i < maxPlaying && p._d < maxDist));
}
