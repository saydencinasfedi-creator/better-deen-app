/* Better Deen website: scroll reveal, menus that close on outside click and
   the sticky download bar. Everything works without it. */
(function () {
  var root = document.documentElement;
  root.classList.add('js');

  var items = document.querySelectorAll('.reveal');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduced && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    items.forEach(function (el) { io.observe(el); });
  } else {
    items.forEach(function (el) { el.classList.add('in'); });
  }

  document.addEventListener('click', function (ev) {
    document.querySelectorAll('details.lang[open], details.menu[open]').forEach(function (d) {
      if (!d.contains(ev.target)) d.removeAttribute('open');
    });
  });

  var bar = document.querySelector('.sticky-cta');
  var hero = document.querySelector('.hero');
  if (bar && hero && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      bar.classList.toggle('show', !entries[0].isIntersecting);
    }).observe(hero);
  }
})();
