/* The HTML layer: copy, hotspot pills, the world card, the Worlds list.
   3D carries character; stable HTML carries content. */
import * as THREE from 'three';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const v3 = new THREE.Vector3();

export function createUI({worlds, decks, stops, anchors, actions, contact}){
  const byId = Object.fromEntries(worlds.map(w => [w.id, w]));
  const cards = {el:$('#card'), title:$('#cardTitle'), line:$('#cardLine'), status:$('#cardStatus'), decks:$('#cardDecks'),
    walk:$('#walkIn'), renders:$('#seeRenders'), next:$('#nextWorld'), deckToggle:$('#deckToggle')};
  const worldStops = stops.filter(s => s.world);
  let activeIdx = -2, mode = 'inside', pinMode = 'none', currentWorld = null;

  /* ---- Worlds nav: a real <nav> of links. On a phone it is a full-screen list: Start, every world
     (tapping flies there), the seven decks (tapping opens one) and Contact. ---- */
  const list = $('#worldsList');
  const li = (html) => { const e = document.createElement('li'); e.innerHTML = html; return e; };
  const fullSheet = () => matchMedia('(max-width: 700px)').matches;
  list.append(li('<a href="#start" data-start>Start</a>'));
  list.append(li('<a href="perpetua/" data-walk>Perpetua</a>'));
  for (const w of worlds) {
    const href = w.href || ('#world-' + w.id);
    const item = li(`<a href="${href}" data-world="${w.id}" ${w.href ? 'data-walk' : ''}>${w.pin}</a>`);
    if (w.deckList) {
      const sub = document.createElement('ul');
      for (const d of decks) sub.append(li(`<a href="decks/${d.slug}/index.html" data-walk>${d.title}</a>`));
      item.append(sub);
    }
    list.append(item);
  }

  /* ---- Contact: one list of links, drawn into the sheet, the Worlds sheet and the end beat ---- */
  const mailto = 'mailto:' + contact.email;
  const resumeEls = [];
  for (const host of $$('[data-contact]')) {
    const pills = !!host.closest('.copy');
    const mk = (label, sub, href, extra = '') => `<a class="${pills ? 'pill ' + (extra || 'ghost') : 'clink'}" href="${href}" ${/^https?:/.test(href) ? 'target="_blank" rel="noopener noreferrer"' : ''}>${pills ? label : `<span>${label}</span><small>${sub}</small>`}</a>`;
    host.innerHTML = mk('LinkedIn', 'linkedin.com/in/jashshah-analytics', contact.linkedin, 'solid') + mk('Email', contact.email, mailto) + mk('Resume (PDF)', 'Opens in a new tab', contact.resume);
    const r = host.lastElementChild; r.hidden = true; r.dataset.resume = ''; r.target = '_blank'; r.rel = 'noopener noreferrer'; resumeEls.push(r);
  }
  // The resume is only offered when the file exists, so there is never a dead link.
  fetch(contact.resume, {method:'HEAD', cache:'no-cache'}).then(res => { if (res.ok) resumeEls.forEach(el => { el.hidden = false; }); }).catch(() => {});

  /* ---- sheets: Worlds and Contact. One open at a time; the page behind stops scrolling. ---- */
  const nav = $('#worlds'), btn = $('#worldsBtn'), cNav = $('#contact'), cBtn = $('#contactBtn');
  const sheetEls = [[nav, btn], [cNav, cBtn]];
  function openSheet(el, trigger, open){
    for (const [e, t] of sheetEls) { const on = open && e === el; e.hidden = !on; t.setAttribute('aria-expanded', String(on)); }
    document.body.classList.toggle('sheet-open', open);
    actions.sheet(open);
    if (open) $('a', el).focus({preventScroll:true});
  }
  const openNav = open => openSheet(nav, btn, open);
  const openContact = open => openSheet(cNav, cBtn, open);
  const anySheet = () => !nav.hidden || !cNav.hidden;
  const closeSheets = () => { if (anySheet()) openSheet(nav, btn, false); };
  btn.addEventListener('click', () => openNav(nav.hidden));
  cBtn.addEventListener('click', () => openContact(cNav.hidden));
  $('#worldsClose').addEventListener('click', () => { openNav(false); btn.focus(); });
  $('#contactClose').addEventListener('click', () => { openContact(false); cBtn.focus(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && anySheet()) { const t = !nav.hidden ? btn : cBtn; closeSheets(); t.focus(); } });
  document.addEventListener('pointerdown', e => {
    if (!anySheet()) return;
    if (nav.contains(e.target) || cNav.contains(e.target) || e.target.closest('#worldsBtn, #contactBtn')) return;
    closeSheets();
  });
  nav.addEventListener('click', e => {
    const a = e.target.closest('a'); if (!a) return;
    if (a.dataset.start !== undefined) { e.preventDefault(); openNav(false); actions.toStart(); }
    else if (a.dataset.world && (fullSheet() || a.dataset.walk === undefined)) { e.preventDefault(); openNav(false); actions.goWorld(a.dataset.world); }
    else if (a.dataset.walk !== undefined) { if (actions.walkIn(a.getAttribute('href'), e)) e.preventDefault(); openNav(false); }
  });
  $('.skip').addEventListener('click', e => { e.preventDefault(); openNav(true); });

  /* ---- hotspot pills ---- */
  const pinsEl = $('#pins');
  const pins = anchors.map(a => {
    const el = document.createElement('a');
    el.className = 'pin ' + (a.kind === 'perp' ? 'perp' : a.kind === 'deck' ? 'deck' : '');
    let label, href;
    if (a.kind === 'perp') { label = 'Perpetua'; href = 'perpetua/'; }
    else if (a.kind === 'deck') { label = a.deck.title; href = `decks/${a.deck.slug}/index.html`; }
    else { const w = byId[a.id]; label = w.pin; href = w.href || '#world-' + a.id; }
    el.href = href; el.tabIndex = -1;
    el.innerHTML = `<span class="d"></span>${label}`;
    el.addEventListener('click', e => {
      if (a.kind === 'world') { e.preventDefault(); actions.goWorld(a.id); }
      else if (actions.walkIn(href, e)) e.preventDefault();
    });
    pinsEl.append(el);
    return {a, el, shown:false};
  });
  const pinKind = {perp:['perp'], hall:['world'], decks:['deck'], none:[]};

  /* A pin never sits under text. The blockers are the world card's whole column (the card is a
     right-hand column, so anything in its x-range is under the scrim, whatever its y) and the
     visible copy block. Pin boxes are measured, not guessed. */
  const copyEls = $$('.copy');
  function blockers(vw){
    const out = [];
    if (cards.el.classList.contains('on')) {
      const r = cards.el.getBoundingClientRect();
      out.push(vw > 700 ? {l:r.left - 48, r:vw, t:0, b:9999} : {l:r.left, r:r.right, t:r.top, b:r.bottom});
    }
    const c = copyEls.find(e => e.classList.contains('on'));
    if (c) { const r = c.getBoundingClientRect(); out.push({l:r.left - 16, r:r.right + 16, t:r.top - 16, b:r.bottom + 16}); }
    return out;
  }
  const boxes = [];
  function updatePins(camera, vw, vh, enabled){
    const block = blockers(vw);
    const kinds = enabled ? pinKind[pinMode] : [];
    boxes.length = 0;
    for (const p of pins) {
      p.want = false;
      if (!kinds.includes(p.a.kind)) continue;
      v3.copy(p.a.pos).project(camera);
      const toCam = new THREE.Vector3().subVectors(camera.position, p.a.pos).normalize();
      const facing = p.a.normal.dot(toCam) > 0.08;
      const x = (v3.x*0.5 + 0.5)*vw, y = (-v3.y*0.5 + 0.5)*vh;
      if (!(v3.z < 1 && v3.z > -1 && facing && y > 90 && y < vh - 20)) continue;
      p.hw = p.el.offsetWidth/2 || 60; p.x = x; p.y = y;
      if (x - p.hw < 12 || x + p.hw > vw - 12) continue;      // a label is shown whole or not at all
      if (block.some(b => x + p.hw > b.l && x - p.hw < b.r && y + 22 > b.t && y - 22 < b.b)) continue;
      boxes.push(p);
    }
    // Neighbouring labels never overlap: left to right, a label that would sit on an accepted one is skipped.
    boxes.sort((a, b) => a.x - b.x);
    let lastRight = -1e9, lastY = 0;
    for (const p of boxes) {
      if (p.x - p.hw < lastRight + 8 && Math.abs(p.y - lastY) < 40) continue;
      p.want = true; lastRight = p.x + p.hw; lastY = p.y;
    }
    for (const p of pins) {
      if (p.want) p.el.style.transform = `translate3d(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px,0) translate(-50%,-50%)`;
      if (p.want !== p.shown) {
        p.shown = p.want; p.el.classList.toggle('show', p.want); p.el.tabIndex = p.want ? 0 : -1;
      }
    }
  }

  /* ---- card ---- */
  function renderCard(w){
    currentWorld = w;
    cards.title.innerHTML = w.title.length > 1 ? `${w.title[0]} <em>${w.title[1]}</em>` : w.title[0];
    cards.line.textContent = w.line;
    cards.status.hidden = !w.status;
    cards.decks.hidden = !w.deckList;
    // Phones: the seven deck links stay folded until asked for, so the card does not cover the vitrines.
    cards.deckToggle.hidden = !w.deckList; cards.el.classList.remove('decks-open'); cards.deckToggle.setAttribute('aria-expanded', 'false');
    cards.decks.innerHTML = w.deckList ? decks.map(d => `<li><a href="decks/${d.slug}/index.html" data-walk>${d.title}</a></li>`).join('') : '';
    cards.walk.hidden = !w.href;
    if (w.href) cards.walk.href = w.href;
    cards.renders.hidden = !(w.actions || []).some(a => a.kind === 'renders');
    const idx = worldStops.findIndex(s => s.world === w.id);
    cards.next.textContent = idx === worldStops.length - 1 ? 'See the whole hall' : 'Next world';
  }
  cards.walk.addEventListener('click', e => { if (currentWorld?.href && actions.walkIn(currentWorld.href, e)) e.preventDefault(); });
  cards.decks.addEventListener('click', e => { const a = e.target.closest('a'); if (a && actions.walkIn(a.getAttribute('href'), e)) e.preventDefault(); });
  cards.renders.addEventListener('click', () => actions.openRenders());
  cards.next.addEventListener('click', () => actions.nextWorld(currentWorld?.id));
  cards.deckToggle.addEventListener('click', () => {
    const open = cards.el.classList.toggle('decks-open');
    cards.deckToggle.setAttribute('aria-expanded', String(open));
  });

  /* ---- copy blocks and body mode ---- */
  const copies = Object.fromEntries($$('.copy').map(e => [e.dataset.copy, e]));
  const stepback = $('#stepback');
  function setActive(i){
    if (i === activeIdx) return;
    activeIdx = i;
    const s = stops[i];
    for (const [k, el] of Object.entries(copies)) el.classList.toggle('on', !!s && s.copy === k);
    stepback.classList.toggle('on', !!s && s.copy === 'inside');
    stepback.tabIndex = (!!s && s.copy === 'inside') ? 0 : -1;
    let m = 'travel';
    if (s) m = s.world ? 'world' : (s.copy === 'inside' ? 'inside' : s.copy === 'vitrine' ? 'vitrine' : s.copy === 'end' ? 'end' : 'hall');
    mode = m; document.body.dataset.mode = m; document.body.dataset.world = (s && s.world) || '';
    pinMode = s && s.pins ? s.pins : 'none';
    if (s && s.world) { renderCard(byId[s.world]); cards.el.classList.add('on'); }
    else cards.el.classList.remove('on');
    const showCard = !!(s && s.world);
    cards.el.setAttribute('aria-hidden', String(!showCard));
    $('#back').tabIndex = showCard ? 0 : -1;
  }

  stepback.addEventListener('click', () => actions.next());
  $('#back').addEventListener('click', () => actions.toHall());
  $('#toStart').addEventListener('click', () => actions.toStart());

  let toastT;
  function toast(msg){ const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600); }

  const rend = $('#renders');
  $('#rendersClose').addEventListener('click', e => { e.preventDefault(); rend.close(); });
  rend.addEventListener('click', e => { if (e.target === rend) rend.close(); });

  /* ---- bottom bar (phones, touch, and the stills mode): previous, current stop, next ---- */
  const bar = {el:$('#stopbar'), name:$('#stopName'), count:$('#stopCount'), prev:$('#prevStop'), next:$('#nextStop')};
  function setBar(i, n, name){
    bar.name.textContent = name; bar.count.textContent = `${i + 1} of ${n}`;
    bar.prev.disabled = i <= 0; bar.next.disabled = i >= n - 1;
  }
  bar.prev.addEventListener('click', () => actions.step(-1));
  bar.next.addEventListener('click', () => actions.step(1));

  return {setBar, showBar:on => { bar.el.hidden = !on; document.body.classList.toggle('hasbar', on); }, closeSheets, sheetOpen:anySheet, setActive, updatePins, toast, getMode:() => mode, getActive:() => activeIdx, pinMode:() => pinMode, openRenders:() => rend.showModal(), byId};
}
