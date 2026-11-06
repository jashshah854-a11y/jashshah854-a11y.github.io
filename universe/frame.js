/* Shared frame. One script tag on a world page gives it:
   - a Contact pill beside the "Back to the hall" pill (LinkedIn, Email, Resume),
   - data-footer on the script tag adds the one shared footer, for pages that scroll to an end,
   - data-hall="<stop id>" makes the hall pill when a page has none yet.
   Links live in LINKS below and nowhere else. The base URL comes from this script's own path (/universe/frame.js). */
(function () {
  var s = document.currentScript;
  if (!s) return;
  var base = new URL('../', s.src).href;
  var LINKS = [
    ['LinkedIn', 'https://www.linkedin.com/in/jashshah-analytics', ''],
    ['Email', 'mailto:jashshah854@gmail.com', ''],
    ['Resume', base + 'resume.pdf', 'PDF']
  ];
  var ARROW = '<svg width="16" height="12" viewBox="0 0 16 12" aria-hidden="true"><path d="M15 6H2M6 1L1 6l5 5"/></svg>';
  var MAIL = '<svg width="18" height="14" viewBox="0 0 18 14" aria-hidden="true"><rect x="1" y="1" width="16" height="12" rx="2"/><path d="M1.5 2.5L9 8l7.5-5.5"/></svg>';
  function rel(u) { return u.indexOf('http') === 0 ? ' rel="noopener noreferrer"' : ''; }

  function init() {
    var pill = document.querySelector('.hall-pill');
    if (!pill && s.dataset.hall && !s.hasAttribute('data-strip')) {
      pill = document.createElement('a');
      pill.className = 'hall-pill';
      pill.href = base + 'index.html#' + s.dataset.hall;
      pill.setAttribute('data-at', s.dataset.at || 'bl');
      pill.innerHTML = ARROW + 'Back to the hall';
      document.body.appendChild(pill);
      if (!document.querySelector('link[href$="hallpill.css"]')) {
        var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = base + 'universe/hallpill.css'; document.head.appendChild(l);
      }
    }
    if (s.hasAttribute('data-strip')) {
      // App pages (Launchboard, MGMTIO) have their own chrome edge to edge, so nothing floats over them:
      // one slim strip at the very top, back link left, the three contact links right.
      var strip = document.querySelector('.back-strip') || document.createElement('div');
      if (!strip.parentNode) {
        strip.className = 'back-strip site-strip';
        strip.innerHTML = '<a href="' + base + 'index.html#' + (s.dataset.hall || 'hall') + '">' + ARROW + 'Jash Shah</a>';
        document.body.insertBefore(strip, document.body.firstChild);
      }
      strip.classList.add('site-strip');
      var links = document.createElement('nav');
      links.className = 'strip-links';
      links.setAttribute('aria-label', 'Contact');
      links.innerHTML = LINKS.map(function (k) { return '<a href="' + k[1] + '"' + rel(k[1]) + '>' + k[0] + '</a>'; }).join('');
      strip.appendChild(links);
      return;
    }
    if (s.hasAttribute('data-footer')) {
      var f = document.createElement('footer');
      f.className = 'site-foot';
      f.innerHTML = '<span><b>Jash Shah</b>. Growth marketer who builds working tools, not just reports.</span><nav aria-label="Contact">' +
        LINKS.map(function (k) { return '<a href="' + k[1] + '"' + rel(k[1]) + '>' + k[0] + (k[2] ? ' (' + k[2] + ')' : '') + '</a>'; }).join('') +
        '<a href="' + base + 'index.html#hall">Back to the hall</a></nav>';
      document.body.appendChild(f);
      // The footer carries the same links and a way back, so the floating pills step aside while it is on screen.
      if (pill && 'IntersectionObserver' in window) {
        new IntersectionObserver(function (en) {
          var on = en[0].isIntersecting;
          [pill, document.querySelector('.contact-pill')].forEach(function (e) { if (e) e.classList.toggle('frame-hide', on); });
        }).observe(f);
      }
    }
    if (!pill || s.hasAttribute('data-nocontact')) return;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'contact-pill';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-haspopup', 'true');
    btn.setAttribute('aria-label', 'Contact');
    btn.innerHTML = MAIL + 'Contact';
    var late = pill.hasAttribute('data-late');
    if (late) btn.setAttribute('data-late', '');
    var panel = document.createElement('div');
    panel.className = 'contact-panel';
    panel.hidden = true;
    panel.id = 'contact-panel';
    btn.setAttribute('aria-controls', panel.id);
    panel.innerHTML = LINKS.map(function (k) { return '<a href="' + k[1] + '"' + rel(k[1]) + '>' + k[0] + (k[2] ? '<span>' + k[2] + '</span>' : '') + '</a>'; }).join('');
    document.body.appendChild(btn);
    document.body.appendChild(panel);

    function place() {
      var r = pill.getBoundingClientRect();
      if (!r.width) return;
      btn.style.left = (r.right + 8) + 'px';
      btn.style.top = r.top + 'px';
      var b = btn.getBoundingClientRect();
      var below = r.top < innerHeight / 2;
      panel.style.left = Math.max(8, Math.min(b.left, innerWidth - 216)) + 'px';
      panel.style.top = below ? (b.bottom + 8) + 'px' : 'auto';
      panel.style.bottom = below ? 'auto' : (innerHeight - b.top + 8) + 'px';
    }
    function close() { panel.hidden = true; btn.setAttribute('aria-expanded', 'false'); }
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = panel.hidden;
      panel.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
      if (open) { place(); panel.querySelector('a').focus(); }
    });
    document.addEventListener('click', function (e) { if (!panel.hidden && !panel.contains(e.target)) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) { close(); btn.focus(); } });
    addEventListener('resize', place);
    place();
    // The pill's box can change after fonts load or the page's own CSS variables apply.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(place);
    setTimeout(place, 600);
    if (late) {
      var f2 = function () { var on = (window.scrollY || document.documentElement.scrollTop) > 140; btn.classList.toggle('on', on); btn.tabIndex = on ? 0 : -1; if (!on) close(); };
      addEventListener('scroll', f2, { passive: true }); f2();
    }
  }
  // data-defer: pages built by a framework that hydrates the body (Launchboard) get the frame after load, so hydration is not disturbed.
  if (s.hasAttribute('data-defer')) { addEventListener('load', function () { setTimeout(init, 1500); }); }
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
