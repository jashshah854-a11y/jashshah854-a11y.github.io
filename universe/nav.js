/* Navigation memory: the page address and sessionStorage always say which stop the visitor is at,
   so Back, a reload, an iOS tab kill and a deep link all land on the same camera position.
   Camera = f(scroll), so restoring is one immediate scroll write (no Lenis smoothing, no animation).
   The address gets replaceState only, never pushState: chapters are not history entries. */

const KEY = 'universe.nav.v2';
const MAX_AGE = 6*3600e3;

/* One slug per stop: the world id for a world, else the beat id. The opening beat is "start". */
export const slugOf = s => s.world || (s.id === 'inside' ? 'start' : s.id);

export function stopFromHash(stops, hash = location.hash){
  let h = hash.replace(/^#/, '');
  try { h = decodeURIComponent(h); } catch (e) {}
  return h ? stops.find(s => slugOf(s) === h) || null : null;
}

export function readSnapshot(){
  try {
    const o = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    return o && typeof o.t === 'number' && Date.now() - o.ts < MAX_AGE ? o : null;
  } catch (e) { return null; }
}

export function writeSnapshot(stop, t){
  try { sessionStorage.setItem(KEY, JSON.stringify({stop:slugOf(stop), t, y:Math.round(scrollY), ts:Date.now()})); } catch (e) {}
}

let shownSlug = null;
export function writeHash(stop){
  const slug = slugOf(stop);
  if (slug === shownSlug) return;
  shownSlug = slug;
  try { history.replaceState(history.state, '', slug === 'start' ? location.pathname + location.search : '#' + slug); } catch (e) {}
}

/* Where should this page load land? Returns a scroll fraction (0..1) or null for the normal opening.
   - A hash names a stop. If the saved position is inside that same stop (a reload, Back, an iOS
     restore) the saved fraction wins, so even a position between two stops comes back exactly.
   - No hash: only a reload or Back uses the saved position; a plain visit starts at the opening. */
export function landingT(stops){
  const hs = stopFromHash(stops), snap = readSnapshot();
  const type = (performance.getEntriesByType('navigation')[0] || {}).type || 'navigate';
  if (hs) return snap && snap.stop === slugOf(hs) ? snap.t : hs.sc;
  if (snap && (type === 'back_forward' || type === 'reload')) return snap.t;
  return null;
}
