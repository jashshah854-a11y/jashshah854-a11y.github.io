/* Reveals a [data-late] hall pill once the visitor has scrolled past the page's own header link. */
(function () {
  var p = document.querySelector('.hall-pill[data-late]');
  if (!p) return;
  // While hidden it is also out of the Tab order: the page's own header link already does its job there.
  function f() { var on = (window.scrollY || document.documentElement.scrollTop) > 140; p.classList.toggle('on', on); p.tabIndex = on ? 0 : -1; p.toggleAttribute('aria-hidden', !on); }
  addEventListener('scroll', f, { passive: true });
  f();
})();
