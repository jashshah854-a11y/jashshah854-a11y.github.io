/* The universe as data: the worlds, the copy, and the camera journey.
   Nothing here touches three.js. layout.js turns the position specs into
   world coordinates; path.js turns the keyframes into one continuous take. */

export const WORLDS = [
  {id:'cyber', pin:'Cyberpunk City', title:['Cyberpunk','City'],
   line:'One block at 2:14 AM in the rain. Walk in, drag it around, summon the dragon.',
   href:'cyberpunk/', actions:[{label:'See the renders', kind:'renders'}],
   still:'media/cb-04-district.jpg'},
  {id:'launchboard', pin:'Launchboard', title:['Launchboard'],
   line:'Tells a marketing team what needs a decision today.', href:'launchboard/', still:'media/lb-today.jpg'},
  {id:'mgmtio', pin:'MGMTIO', title:['MGMTIO'],
   line:'Release and marketing work in one view. Sample data.', href:'mgmtio/index.html', still:'media/mgmtio-rows.jpg'},
  {id:'round', pin:'Round & Round', title:['Round','& Round'],
   line:'Twelve marbles finding their way home.', href:'round-and-round/', still:'media/round.jpg'},
  {id:'fieldfold', pin:'Fieldfold', title:['Fieldfold'],
   line:'A folding instrument for looking closer.', href:'fieldfold/', still:'media/fieldfold.jpg'},
  {id:'workbench', pin:'Robot Workbench', title:['Robot','Workbench'],
   line:'A small arm that picks, lifts and places, one clear job at a time.', href:'workbench/', still:'media/workbench.jpg'},
  {id:'jev', pin:'Jev in Motion', title:['Jev in','Motion'],
   line:'Jev suggests. Your app acts. Follow one message and see who does what.', href:'jev/', still:'media/jev.jpg'},
  {id:'decks', pin:'The decks wing', title:['The decks','wing'],
   line:'Seven decks. Each one is its own small machine.', still:'assets/d4.jpg', deckList:true},
  {id:'deadend', pin:'Dead End Shop', title:['Dead End','Shop'],
   line:'Music video. My song.', still:'media/deadend-kf20.jpg'},
  {id:'singular', pin:'Singular', title:['Singular'],
   line:'A new design every day for 24 days.', still:'media/sing-museum.jpg'}
];

export const DECKS = [
  {slug:'russia-free-hand',      cover:'assets/d1.jpg', title:'Russia has a free hand. In the air.'},
  {slug:'houthis-saudi-pipeline',cover:'assets/d2.jpg', title:'The bypass is under fire at both ends.'},
  {slug:'pakistan-india',        cover:'assets/d3.jpg', title:'Two gates. One river.'},
  {slug:'right-question',        cover:'assets/d4.jpg', title:'Ask better. The answer gets simple.'},
  {slug:'agents-internet',       cover:'assets/d5.jpg', title:'The internet is getting a second user.'},
  {slug:'over-engineering',      cover:'assets/d6.jpg', title:'Everything is possible. That is the problem.'},
  {slug:'posting-backfires',     cover:'assets/d7.jpg', title:'Posting about it can kill the sale.'}
];

export const LINKEDIN = 'https://www.linkedin.com/in/jashshah-analytics';

/* Look presets. Every keyframe names one; the path blends them with the move,
   so light, fog and exposure change in-camera, never as a cut. */
export const LOOK = {
  macro:   {env:0.6,  key:6.0, cam:0.0, hemi:0.10, rim:0.55, expo:1.0,  fogC:'#2a241b', fogD:0.0004, vig:0.55},
  vitrine: {env:0.30, key:4.2, cam:0.25,hemi:0.10, rim:0.0,  expo:1.12, fogC:'#17140f', fogD:0.0042, vig:0.30},
  run:     {env:0.26, key:0.0, cam:1.5, hemi:0.10, rim:0.0,  expo:1.15, fogC:'#14120e', fogD:0.0050, vig:0.30},
  hall:    {env:0.30, key:0.0, cam:1.9, hemi:0.16, rim:0.0,  expo:1.12, fogC:'#14120e', fogD:0.0034, vig:0.25},
  world:   {env:0.28, key:0.0, cam:1.4, hemi:0.12, rim:0.0,  expo:1.10, fogC:'#110f0c', fogD:0.0030, vig:0.40},
  far:     {env:0.30, key:0.0, cam:1.0, hemi:0.20, rim:0.0,  expo:1.18, fogC:'#14120e', fogD:0.0016, vig:0.35}
};

const slot = (id, extra = {}) => ({
  id: 'world:' + id, world: id, look: 'world', hold: extra.hold ?? 3,
  pos: {at:'slot', id, d: extra.d ?? 38, up: extra.up ?? 5.0},
  target: {at:'slot', role:'look', id, shift: extra.shift ?? 6.2, up: extra.lookUp ?? -0.2},
  pins: id === 'decks' ? 'decks' : 'none'
});

/* Transit between two worlds: the camera backs off to where both vitrines fit in frame and looks at the
   gap between them. Cutting straight from one close-up to the next crossed bare wall (the gap between
   vitrines is wider than the frame at close-up distance) with the pair of vitrines cropped at both edges. */
const link = (a, b, extra = {}) => ({
  id: 'link:' + a + '-' + b, look: 'world', hold: 0, fov: extra.fov ?? 36,
  pos: {at:'between', a, b, d: extra.d ?? 62, up: extra.up ?? 9},
  target: {at:'between', a, b, role:'look', up: extra.lookUp ?? -0.2}
});

/* hold = dwell weight (the camera is still, the viewer reads).
   Keyframes with hold 0 are in-camera waypoints between stops. */
export const JOURNEY = [
  {id:'inside',  copy:'inside',  look:'macro', hold:3.2, label:'Inside Perpetua',
   pos:{at:'perp', p:[-0.9, 6.2, 3.1]}, target:{at:'perp', p:[-0.5, 2.7, 0.2]}},
  {id:'draw',    look:'macro',   hold:0,
   pos:{at:'perp', p:[-1.6, 4.6, 9.2]}, target:{at:'perp', p:[-0.20, 2.8, 0.5]}},
  {id:'through', look:'vitrine', hold:0,
   pos:{at:'perp', p:[-3.0, 5.4, 25]}, target:{at:'perp', p:[0.0, 3.0, 0.6]}},
  {id:'vitrine', copy:'vitrine', look:'vitrine', hold:3.2, label:'The vitrine', pins:'perp',
   pos:{at:'world', p:[-4, 12.5, 95]}, target:{at:'world', p:[24, 9, -2]}},
  {id:'skim',    look:'run',
   pos:{at:'line', along:-6, side:-12, up:2.6}, target:{at:'line', along:70, side:0, up:1.4}},
  {id:'run',     look:'run',
   pos:{at:'line', along:90, side:-9, up:3.0}, target:{at:'line', along:150, side:0, up:1.6}},
  {id:'rise',    look:'hall',
   pos:{at:'hall', p:[30, 20, 188]}, target:{at:'hall', p:[0, 10, 30]}, pscale:1.4},
  {id:'hall',    copy:'hall', look:'hall', hold:3.4, label:'The hall of worlds', pins:'hall',
   pos:{at:'hall', p:[-30, 25, 108]}, target:{at:'hall', p:[14, 15, 6]}, pscale:1.3},
  slot('cyber'),
  link('cyber', 'launchboard'),
  slot('launchboard'),
  link('launchboard', 'mgmtio'),
  slot('mgmtio'),
  link('mgmtio', 'round'),
  slot('round'),
  link('round', 'fieldfold'),
  slot('fieldfold'),
  link('fieldfold', 'workbench'),
  slot('workbench'),
  link('workbench', 'jev'),
  slot('jev'),
  slot('decks', {d:112, up:5.0, shift:14.0, lookUp:-2.5, hold:3.6}),
  slot('deadend'),
  slot('singular', {d:54, up:3.4, shift:8.5}),
  {id:'all',     look:'far', hold:1.2, copy:'hall2',
   pos:{at:'hall', p:[0, 120, 215]}, target:{at:'hall', p:[0, 8, -8]}, fov:36, pscale:1.0},
  {id:'end',     copy:'end', look:'far', hold:2.6, label:'Built by Jash Shah', still:true,
   pos:{at:'hall', p:[-120, 175, 120]}, target:{at:'hall', p:[0, 0, -6]}, fov:36, pscale:1.0}
];

/* Share of the whole scroll that is dwell (vs. travel). */
export const DWELL_SHARE = 0.40;
/* Total scroll height in viewport heights. */
export const JOURNEY_VH = 1700;
