/* ============================================================
   paulasilva-ms multi-page playbook engine
   v1.7.0
   Theme, i18n, lang switcher, scrollspy, search modal,
   chapter grid renderer, monday list renderer, references
   renderer, checklist renderer, keyboard nav.
   ============================================================ */

(function () {
  'use strict';

  var SUPPORTED = ['en', 'pt-br', 'es'];
  var DEFAULT_LANG = 'en';
  var LANG_KEY = 'cps-lang';
  var THEME_KEY = 'cps-theme';

  /* ========================= helpers ========================= */

  function escapeHTML(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
    });
  }
  function resolvePath(root, path) {
    if (!root || !path) return undefined;
    var parts = path.split('.');
    var cur = root;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  /* ========================= i18n core ========================= */

  function detectLang() {
    var p = new URLSearchParams(window.location.search);
    var u = (p.get('lang') || '').toLowerCase();
    if (SUPPORTED.indexOf(u) >= 0) return u;
    try {
      var s = (localStorage.getItem(LANG_KEY) || '').toLowerCase();
      if (SUPPORTED.indexOf(s) >= 0) return s;
    } catch (e) {}
    var n = (navigator.language || '').toLowerCase();
    if (n.indexOf('pt') === 0) return 'pt-br';
    if (n.indexOf('es') === 0) return 'es';
    return DEFAULT_LANG;
  }

  function buildContext(lang) {
    return {
      lang: lang,
      ui:        (window.PLAYBOOK_UI         && window.PLAYBOOK_UI[lang])         || {},
      landing:   (window.PLAYBOOK_LANDING    && window.PLAYBOOK_LANDING[lang])    || null,
      chapter01: (window.PLAYBOOK_CHAPTER_01 && window.PLAYBOOK_CHAPTER_01[lang]) || null
    };
  }

  function renderI18N(ctx) {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var v = resolvePath(ctx, el.getAttribute('data-i18n'));
      if (typeof v === 'string') el.textContent = v;
    });
    document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      var v = resolvePath(ctx, el.getAttribute('data-i18n-html'));
      if (typeof v === 'string') el.innerHTML = v;
    });
    document.querySelectorAll('[data-i18n-attr]').forEach(function (el) {
      var spec = el.getAttribute('data-i18n-attr');
      spec.split(';').forEach(function (pair) {
        var bits = pair.split(':');
        if (bits.length !== 2) return;
        var attr = bits[0].trim();
        var path = bits[1].trim();
        var v = resolvePath(ctx, path);
        if (typeof v === 'string') el.setAttribute(attr, v);
      });
    });
    var htmlLang = ctx.lang === 'pt-br' ? 'pt-BR' : ctx.lang;
    document.documentElement.setAttribute('lang', htmlLang);

    var page = document.body.getAttribute('data-page');
    var pc = page === 'index' ? ctx.landing : (page === 'chapter-01' ? ctx.chapter01 : null);
    if (pc) {
      if (pc.pageTitle) document.title = pc.pageTitle;
      var dm = document.querySelector('meta[name="description"]');
      if (dm && pc.metaDescription) dm.setAttribute('content', pc.metaDescription);
    }
  }

  function renderLangPills(lang) {
    document.querySelectorAll('[data-lang-switch]').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-lang-switch') === lang ? 'true' : 'false');
    });
  }

  /* ========================= dynamic renderers ========================= */

  var HREF_MAP = {
    '00': 'chapter-00-introduction.html',
    '01': 'chapter-01-foundation.html',
    '02': 'chapter-02-platform.html',
    '03': 'chapter-03-context.html',
    '04': 'chapter-04-intent.html',
    '05': 'chapter-05-integration.html'
  };

  function renderChapterGrid(ctx) {
    var host = document.querySelector('[data-chapter-grid]');
    if (!host || !ctx.landing) return;
    var lang = ctx.lang;
    host.innerHTML = ctx.landing.chapters.map(function (c, i) {
      var href = (HREF_MAP[c.num] || '#') + '?lang=' + lang;
      return '<a href="' + href + '" class="chapter-card acc-' + escapeHTML(c.accent) + '" style="--stagger-i:' + i + ';">' +
        '<span class="chapter-card__num">Chapter ' + escapeHTML(c.num) + '</span>' +
        '<h3 class="chapter-card__title">' + escapeHTML(c.title) + '</h3>' +
        '<p class="chapter-card__lead">' + escapeHTML(c.lead) + '</p>' +
        '<div class="chapter-card__foot">' +
          '<span>' + escapeHTML(c.tag) + '</span>' +
          '<span class="chapter-card__foot-arrow"><svg viewBox="0 0 24 24"><path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span>' +
        '</div>' +
      '</a>';
    }).join('');
  }

  function renderChecklist(ctx) {
    var host = document.getElementById('prod-checklist');
    if (!host || !ctx.chapter01) return;
    var s = ctx.chapter01.sections;
    if (!s || !s.checklist || !s.checklist.items) return;
    host.innerHTML = s.checklist.items.map(function (it, i) {
      var n = String(i + 1).padStart(2, '0');
      return '<div class="checklist__item"><span class="checklist__num">' + n + '</span><span>' + escapeHTML(it) + '</span></div>';
    }).join('');
  }

  function renderMondayList(ctx) {
    var host = document.querySelector('[data-monday-list]');
    if (!host || !ctx.chapter01) return;
    var s = ctx.chapter01.sections;
    if (!s || !s.mondayMorning || !s.mondayMorning.items) return;
    host.innerHTML = s.mondayMorning.items.map(function (it) {
      return '<li>' + escapeHTML(it) + '</li>';
    }).join('');
  }

  function renderReferences(ctx) {
    var host = document.querySelector('[data-references-list]');
    if (!host || !ctx.chapter01) return;
    var s = ctx.chapter01.sections;
    if (!s || !s.references || !s.references.items) return;
    host.innerHTML = s.references.items.map(function (it) {
      return '<li><a href="' + it.url + '" target="_blank" rel="noopener noreferrer">' + escapeHTML(it.linkText) + '</a>' + escapeHTML(it.tail || '') + '</li>';
    }).join('');
  }

  function renderOnpage(ctx) {
    var host = document.querySelector('[data-onpage-list]');
    if (!host) return;
    var content = document.querySelector('.chapter-body');
    if (!content) return;
    var h2s = content.querySelectorAll('h2[id]');
    var html = '';
    h2s.forEach(function (h) {
      html += '<li><a href="#' + h.id + '">' + escapeHTML(h.textContent.trim()) + '</a></li>';
    });
    host.innerHTML = html;
  }

  function renderPagenav(ctx) {
    if (!ctx.chapter01 || !ctx.chapter01.pagenav) return;
    var ui = ctx.ui;
    var prevLabel = (ui.pagenav && ui.pagenav.previous) || 'Previous';
    var nextLabel = (ui.pagenav && ui.pagenav.next) || 'Next';
    var lang = ctx.lang;

    var prev = document.querySelector('.pagenav__item--prev');
    if (prev && ctx.chapter01.pagenav.prev) {
      var p = ctx.chapter01.pagenav.prev;
      prev.setAttribute('href', p.href + '?lang=' + lang);
      prev.innerHTML =
        '<div class="pagenav__dir"><svg width="14" height="14"><use href="#i-arrow-left"/></svg> ' + escapeHTML(prevLabel) + '</div>' +
        '<div class="pagenav__title">' + escapeHTML(p.title) + '</div>';
    }
    var next = document.querySelector('.pagenav__item--next');
    if (next && ctx.chapter01.pagenav.next) {
      var n = ctx.chapter01.pagenav.next;
      next.setAttribute('href', n.href + '?lang=' + lang);
      next.innerHTML =
        '<div class="pagenav__dir">' + escapeHTML(nextLabel) + ' <svg width="14" height="14"><use href="#i-arrow-right"/></svg></div>' +
        '<div class="pagenav__title">' + escapeHTML(n.title) + '</div>';
    }
  }

  function appendLangToInternalLinks(lang) {
    document.querySelectorAll('a[href]').forEach(function (a) {
      var href = a.getAttribute('href');
      if (!href) return;
      if (href.charAt(0) === '#' || /^https?:\/\//i.test(href) || href.indexOf('mailto:') === 0) return;
      // Strip existing ?lang=
      href = href.replace(/([?&])lang=[^&#]*&?/, '$1').replace(/[?&]$/, '');
      var sep = href.indexOf('?') >= 0 ? '&' : '?';
      a.setAttribute('href', href + sep + 'lang=' + lang);
    });
  }

  function setActiveTOC() {
    var current = document.body.getAttribute('data-page');
    if (!current) return;
    document.querySelectorAll('.toc__list a[data-page]').forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('data-page') === current);
    });
  }

  /* ========================= apply lang ========================= */

  function applyLang(lang, opts) {
    opts = opts || {};
    if (SUPPORTED.indexOf(lang) < 0) lang = DEFAULT_LANG;
    var ctx = buildContext(lang);

    renderI18N(ctx);
    renderLangPills(lang);
    renderChapterGrid(ctx);
    renderChecklist(ctx);
    renderMondayList(ctx);
    renderReferences(ctx);
    renderOnpage(ctx);
    renderPagenav(ctx);
    appendLangToInternalLinks(lang);
    setActiveTOC();

    if (opts.persist !== false) {
      try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
    }
    if (opts.updateUrl !== false) {
      try {
        var u = new URL(window.location.href);
        u.searchParams.set('lang', lang);
        window.history.replaceState({}, '', u.toString());
      } catch (e) {}
    }
    document.dispatchEvent(new CustomEvent('lang:change', { detail: { lang: lang, ctx: ctx } }));
  }

  /* ========================= theme ========================= */

  var root = document.documentElement;

  function updateThemeIcon(t) {
    var btn = document.querySelector('[data-action="toggle-theme"]');
    if (!btn) return;
    var svg = btn.querySelector('use');
    if (svg) svg.setAttribute('href', t === 'dark' ? '#i-sun' : '#i-moon');
    btn.setAttribute('aria-pressed', t === 'dark' ? 'true' : 'false');
  }
  function applyTheme(t) {
    root.setAttribute('data-theme', t);
    try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
    updateThemeIcon(t);
  }
  function getInitialTheme() {
    try {
      var s = localStorage.getItem(THEME_KEY);
      if (s === 'light' || s === 'dark') return s;
    } catch (e) {}
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    return 'light';
  }

  /* ========================= scrollspy ========================= */

  function setupOnpageScrollspy() {
    function bind() {
      var list = document.querySelector('.onpage__list');
      if (!list) return;
      var anchors = list.querySelectorAll('a[href^="#"]');
      if (!anchors.length) return;
      var targets = [];
      anchors.forEach(function (a) {
        var el = document.getElementById(a.getAttribute('href').slice(1));
        if (el) targets.push({ a: a, el: el });
      });
      function update() {
        var y = window.scrollY + 140;
        var active = null;
        targets.forEach(function (t) { if (t.el.offsetTop <= y) active = t; });
        anchors.forEach(function (a) { a.classList.remove('active'); });
        if (active) active.a.classList.add('active');
      }
      window.removeEventListener('scroll', window.__cps_scroll || function(){});
      window.__cps_scroll = update;
      window.addEventListener('scroll', update, { passive: true });
      update();
    }
    bind();
    document.addEventListener('lang:change', function () { setTimeout(bind, 60); });
  }

  /* ========================= progress bar ========================= */

  function setupProgress() {
    var bar = document.getElementById('progress');
    if (!bar) return;
    var chapter = document.querySelector('.chapter');
    function update() {
      var total, scrolled;
      if (chapter) {
        var rect = chapter.getBoundingClientRect();
        total = chapter.offsetHeight - window.innerHeight;
        scrolled = Math.max(0, -rect.top);
      } else {
        total = document.documentElement.scrollHeight - window.innerHeight;
        scrolled = window.scrollY;
      }
      var pct = total > 0 ? Math.min(100, Math.max(0, (scrolled / total) * 100)) : 0;
      bar.style.width = pct + '%';
      var accent = chapter ? getComputedStyle(chapter).getPropertyValue('--accent').trim() : '';
      if (accent) bar.style.background = accent;
    }
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  /* ========================= search modal ========================= */

  function setupSearch() {
    var overlay = document.getElementById('search-overlay');
    var input = overlay && overlay.querySelector('.search-modal__input');
    var results = overlay && overlay.querySelector('.search-modal__results');
    var trigger = document.querySelector('[data-action="open-search"]');
    if (!overlay || !input || !results || !trigger) return;

    var indexAll = window.PLAYBOOK_INDEX || {};
    var current = (indexAll[detectLang()] || indexAll[DEFAULT_LANG] || []).slice();
    var selected = -1;
    var rendered = [];

    document.addEventListener('lang:change', function (e) {
      current = (indexAll[e.detail.lang] || indexAll[DEFAULT_LANG] || []).slice();
    });

    function open() {
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
      setTimeout(function () { input.focus(); }, 30);
    }
    function close() {
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');
      input.value = '';
      results.innerHTML = '';
      selected = -1;
      rendered = [];
    }

    function score(e, q) {
      var ql = q.toLowerCase();
      var t = (e.title || '').toLowerCase();
      var b = (e.text || '').toLowerCase();
      var c = (e.chapter || '').toLowerCase();
      if (t.indexOf(ql) === 0) return 100;
      if (t.indexOf(ql) >= 0) return 70;
      if (c.indexOf(ql) >= 0) return 50;
      if (b.indexOf(ql) >= 0) return 30;
      return 0;
    }
    function highlight() {
      results.querySelectorAll('.search-modal__result').forEach(function (el, i) {
        el.classList.toggle('is-selected', i === selected);
      });
    }
    function render(q) {
      var ui = (window.PLAYBOOK_UI && window.PLAYBOOK_UI[detectLang()]) || {};
      if (!q || q.length < 2) {
        var noRes = (ui.search && ui.search.noResults) || 'No results.';
        results.innerHTML = '';
        rendered = [];
        return;
      }
      rendered = current
        .map(function (e) { return { e: e, s: score(e, q) }; })
        .filter(function (m) { return m.s > 0; })
        .sort(function (a, b) { return b.s - a.s; })
        .slice(0, 12)
        .map(function (m) { return m.e; });
      if (!rendered.length) {
        results.innerHTML = '<div class="search-modal__empty">' + escapeHTML((ui.search && ui.search.noResults) || 'No results.') + '</div>';
        return;
      }
      results.innerHTML = rendered.map(function (m) {
        return '<a class="search-modal__result" href="' + m.url + '">' +
          '<div class="search-modal__result-chapter">' + escapeHTML(m.chapter || '') + '</div>' +
          '<div class="search-modal__result-title">' + escapeHTML(m.title) + '</div>' +
        '</a>';
      }).join('');
      selected = 0;
      highlight();
    }

    trigger.addEventListener('click', open);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    input.addEventListener('input', function () { render(input.value.trim()); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { close(); }
      else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (rendered.length === 0) return;
        selected = (selected + 1) % rendered.length;
        highlight();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (rendered.length === 0) return;
        selected = (selected - 1 + rendered.length) % rendered.length;
        highlight();
      } else if (e.key === 'Enter') {
        if (selected >= 0 && rendered[selected]) {
          window.location.href = rendered[selected].url;
        }
      }
    });
  }

  /* ========================= keyboard ========================= */

  function setupKeyboard() {
    document.addEventListener('keydown', function (e) {
      var tag = (document.activeElement && document.activeElement.tagName) || '';
      var typing = tag === 'INPUT' || tag === 'TEXTAREA' || (document.activeElement && document.activeElement.isContentEditable);
      if (e.key === '/' && !typing) {
        e.preventDefault();
        var btn = document.querySelector('[data-action="open-search"]');
        if (btn) btn.click();
        return;
      }
      if (typing) return;
      if (e.key === 'h' || e.key === 'H') {
        var lang = detectLang();
        window.location.href = 'index.html?lang=' + lang;
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        var cur = root.getAttribute('data-theme') || 'light';
        applyTheme(cur === 'dark' ? 'light' : 'dark');
      } else if (e.key === 'g' || e.key === 'G') {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (e.key === 'j' || e.key === 'J') {
        var n = document.querySelector('.pagenav__item--next');
        if (n) window.location.href = n.getAttribute('href');
      } else if (e.key === 'k' || e.key === 'K') {
        var p = document.querySelector('.pagenav__item--prev');
        if (p) window.location.href = p.getAttribute('href');
      }
    });
  }

  /* ========================= reveal observer ========================= */

  function setupReveal() {
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('.reveal, .stagger').forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('is-visible');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -10% 0px' });
    document.querySelectorAll('.reveal, .stagger').forEach(function (el) { io.observe(el); });
  }

  /* ========================= init ========================= */

  function init() {
    applyTheme(getInitialTheme());
    var tt = document.querySelector('[data-action="toggle-theme"]');
    if (tt) tt.addEventListener('click', function () {
      var cur = root.getAttribute('data-theme') || 'light';
      applyTheme(cur === 'dark' ? 'light' : 'dark');
    });

    document.querySelectorAll('[data-lang-switch]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.preventDefault();
        applyLang(b.getAttribute('data-lang-switch'));
      });
    });

    var lang = detectLang();
    applyLang(lang, { persist: true, updateUrl: true });

    setupProgress();
    setupOnpageScrollspy();
    setupSearch();
    setupKeyboard();
    // Reveal observer runs after lang has rendered chapter-grid, etc.
    setTimeout(setupReveal, 50);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.PLAYBOOK = window.PLAYBOOK || {};
  window.PLAYBOOK.applyLang = applyLang;
  window.PLAYBOOK.applyTheme = applyTheme;
  window.PLAYBOOK.detectLang = detectLang;
})();
