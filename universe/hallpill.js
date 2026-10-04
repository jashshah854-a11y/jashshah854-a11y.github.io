/* Reveals a [data-late] hall pill once the visitor has scrolled past the page's own header link. */
(function () {
  var p = document.querySelector('.hall-pill[data-late]');
  if (!p) return;
  function f() { p.classList.toggle('on', (window.scrollY || document.documentElement.scrollTop) > 140); }
  addEventListener('scroll', f, { passive: true });
  f();
})();
