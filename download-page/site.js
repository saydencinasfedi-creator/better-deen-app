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

  /* Theme: automatic (the system), light or dark; remembered in this
     browser only. Works without it: the page then follows the system. */
  var themeBtn = document.querySelector('.theme-toggle');
  if (themeBtn) {
    var order = ['auto', 'light', 'dark'];
    var current = function () {
      try { var m = localStorage.getItem('bd-theme'); if (m === 'light' || m === 'dark') return m; } catch (e) {}
      return 'auto';
    };
    var apply = function (mode) {
      if (mode === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', mode);
      try { if (mode === 'auto') localStorage.removeItem('bd-theme'); else localStorage.setItem('bd-theme', mode); } catch (e) {}
      var label = themeBtn.getAttribute('data-' + mode);
      themeBtn.setAttribute('aria-label', label);
      themeBtn.setAttribute('title', label);
      var bg = { light: '#fbf8f1', dark: '#06151a' }[mode];
      document.querySelectorAll('meta[name="theme-color"]').forEach(function (m) {
        if (!m.dataset.content) { m.dataset.content = m.getAttribute('content'); m.dataset.media = m.getAttribute('media') || ''; }
        if (bg) { m.removeAttribute('media'); m.setAttribute('content', bg); }
        else { m.setAttribute('media', m.dataset.media); m.setAttribute('content', m.dataset.content); }
      });
    };
    apply(current());
    themeBtn.addEventListener('click', function () {
      apply(order[(order.indexOf(current()) + 1) % order.length]);
    });
  }

  reviews();

  /* Reviews approved in the admin panel (site_reviews_public) and the form
     that sends new ones (submit_site_review). Text from the database is only
     ever set with textContent. */
  function reviews() {
    var box = document.querySelector('.review-box');
    if (!box || !window.fetch) return;
    var api = box.dataset.api + '/rest/v1/rpc/';
    var headers = { apikey: box.dataset.key, 'Content-Type': 'application/json' };
    var lang = box.dataset.lang;
    var form = box.querySelector('.review-form');
    var done = box.querySelector('.review-done');
    var msg = JSON.parse(form.dataset.messages);
    var list = document.querySelector('[data-reviews]');
    var empty = document.querySelector('.reviews-empty');
    var more = document.querySelector('.reviews-more');
    var starPath = box.querySelector('.stars svg').innerHTML;
    var SHOWN = 6;
    box.hidden = false;
    // The reveal observer ran before the box was visible.
    box.classList.add('in');

    function star(on) {
      var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      s.setAttribute('viewBox', '0 0 24 24');
      s.setAttribute('aria-hidden', 'true');
      if (!on) s.setAttribute('class', 'off');
      s.innerHTML = starPath;
      return s;
    }

    function card(r) {
      var fig = document.createElement('figure');
      fig.className = 'review';
      var rated = document.createElement('div');
      rated.className = 'rated';
      rated.setAttribute('role', 'img');
      rated.setAttribute('aria-label', msg.review_stars.replace('{n}', r.rating));
      for (var i = 1; i <= 5; i++) rated.appendChild(star(i <= r.rating));
      var quote = document.createElement('blockquote');
      quote.textContent = r.body;
      // A review keeps its own direction (Spanish on the Arabic page…).
      if (r.lang !== lang) quote.setAttribute('lang', r.lang);
      quote.setAttribute('dir', 'auto');
      var cap = document.createElement('figcaption');
      cap.setAttribute('dir', 'auto');
      var name = document.createElement('b');
      name.textContent = r.name;
      cap.appendChild(name);
      if (r.place) cap.appendChild(document.createTextNode(' · ' + r.place));
      fig.appendChild(rated);
      fig.appendChild(quote);
      fig.appendChild(cap);
      return fig;
    }

    fetch(api + 'site_reviews_public', { method: 'POST', headers: headers, body: '{}' })
      .then(function (res) { return res.ok ? res.json() : []; })
      .then(function (rows) {
        if (!rows.length) return;
        // The page's language first, newest first within each group.
        rows.sort(function (a, b) { return (b.lang === lang) - (a.lang === lang); });
        rows.forEach(function (r, i) {
          var c = card(r);
          if (list.children.length >= SHOWN) c.hidden = true;
          list.appendChild(c);
        });
        empty.hidden = true;
        if (list.querySelector('.review[hidden]')) more.hidden = false;
      })
      .catch(function () {});

    more.addEventListener('click', function () {
      list.querySelectorAll('.review[hidden]').forEach(function (c) { c.hidden = false; });
      more.hidden = true;
    });

    var body = form.elements.body;
    var count = form.querySelector('.count');
    body.addEventListener('input', function () {
      var n = body.value.trim().length;
      count.textContent = n + ' / 600';
      count.classList.toggle('near', n > 540);
    });

    var error = form.querySelector('.form-error');
    var send = form.querySelector('button[type="submit"]');
    var sendLabel = send.textContent;

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      error.textContent = '';
      var f = form.elements;
      var rating = form.querySelector('input[name="rating"]:checked');
      var name = f.name.value.trim();
      var text = body.value.trim();
      if (!rating || name.length < 2 || text.length < 20 || text.length > 600) {
        error.textContent = msg.review_invalid;
        return;
      }
      if (!f.consent.checked) {
        f.consent.focus();
        f.consent.reportValidity && f.consent.reportValidity();
        return;
      }
      // Bots fill the hidden field: pretend it worked.
      if (f.website.value) return finish();
      send.disabled = true;
      send.textContent = msg.review_sending;
      fetch(api + 'submit_site_review', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          p_name: name,
          p_place: f.place.value.trim() || null,
          p_rating: Number(rating.value),
          p_body: text,
          p_lang: lang,
        }),
      })
        .then(function (res) {
          if (res.ok) return finish();
          return res.json().then(function (e) {
            var m = String((e && e.message) || '');
            error.textContent = /too_many|queue_full/.test(m) ? msg.review_limit
              : /invalid_review/.test(m) ? msg.review_invalid : msg.review_error;
          });
        })
        .catch(function () { error.textContent = msg.review_error; })
        .then(function () {
          send.disabled = false;
          send.textContent = sendLabel;
        });
    });

    function finish() {
      form.hidden = true;
      done.hidden = false;
      done.focus();
    }

    done.querySelector('button').addEventListener('click', function () {
      form.reset();
      count.textContent = '0 / 600';
      done.hidden = true;
      form.hidden = false;
    });
  }
})();

/* Videos: do not autoplay when the visitor asks for reduced motion. */
(function () {
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.querySelectorAll('video').forEach(function (v) { v.removeAttribute('autoplay'); v.pause(); });
})();

/* Night sky: a fixed canvas of slowly drifting, twinkling stars that stays
   put while the page scrolls. Only in dark mode; still when motion is reduced. */
(function () {
  var cv = document.createElement('canvas');
  cv.id = 'sky';
  cv.setAttribute('aria-hidden', 'true');
  document.body.insertBefore(cv, document.body.firstChild);
  var ctx = cv.getContext('2d');
  if (!ctx) return;
  var root = document.documentElement;
  var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var light = window.matchMedia('(prefers-color-scheme: light)');
  var stars = [], w = 0, h = 0, dpr = 1;
  function isLight() {
    var m = root.dataset.theme;
    return m === 'light' || (m !== 'dark' && light.matches);
  }
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth; h = window.innerHeight;
    cv.width = w * dpr; cv.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var n = Math.round(Math.min(160, Math.max(50, w * h / 9000)));
    stars = [];
    for (var i = 0; i < n; i++) {
      stars.push({ x: Math.random() * w, y: Math.random() * h, r: .5 + Math.random() * 1.3,
        a: .25 + Math.random() * .6, p: Math.random() * 6.28, s: .6 + Math.random() * 1.6,
        v: 2 + Math.random() * 5 });
    }
  }
  var last = 0;
  function draw(now) {
    var dt = Math.min(.05, (now - last) / 1000 || 0); last = now;
    ctx.clearRect(0, 0, w, h);
    if (!isLight()) {
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        if (!still) {
          s.x += s.v * dt * .8; s.y -= s.v * dt * .35;
          if (s.x > w + 4) s.x = -4;
          if (s.y < -4) s.y = h + 4;
        }
        var tw = still ? 1 : .55 + .45 * Math.sin(now / 1000 * s.s + s.p);
        ctx.globalAlpha = s.a * tw;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.2832); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    if (!still) requestAnimationFrame(draw);
  }
  resize();
  window.addEventListener('resize', function () { resize(); if (still) draw(0); });
  if (still) {
    draw(0);
    new MutationObserver(function () { draw(0); }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  } else {
    requestAnimationFrame(draw);
  }
})();
