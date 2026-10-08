/**
 * Lukas200301 — site shell
 * Shared on every page: header, command palette (Ctrl/⌘+K), shortcuts,
 * scroll progress, reveal-on-scroll, spotlight cards, toasts, back-to-top,
 * footer and a small easter egg.
 */
(function () {
  'use strict';

  document.documentElement.classList.add('js');

  // ---------- Paths ----------
  const scriptEl = document.currentScript || document.querySelector('script[src$="js/script.js"]');
  const ROOT = scriptEl ? new URL('..', scriptEl.src).href : new URL('/', location.href).href;
  // Opened straight from disk (file://) the browser won't resolve "folder/" to
  // "folder/index.html", so add it there. On GitHub Pages clean URLs are kept.
  const IS_FILE = location.protocol === 'file:';
  const fixDir = (href) => {
    if (!IS_FILE) return href;
    const u = new URL(href, location.href);
    if (u.protocol === 'file:' && u.pathname.endsWith('/')) u.pathname += 'index.html';
    return u.href;
  };
  const url = (p) => fixDir(new URL(p, ROOT).href);
  const here = location.href.split('#')[0].replace(/index\.html$/, '');
  const rel = here.startsWith(ROOT) ? here.slice(ROOT.length) : '';
  const section = rel.split('/')[0] || 'home';
  const isGamePlay = section === 'games' && rel.split('/').filter(Boolean).length > 1;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const LINKS = {
    github: 'https://github.com/Lukas200301',
    instagram: 'https://instagram.com/Lukas200103',
    discord: 'iamlukas.'
  };

  // ---------- Registry (palette + nav) ----------
  const REGISTRY = [
    { group: 'Pages', title: 'Home', sub: 'Start page', icon: 'fas fa-house', href: '' , keys: 'start index main' },
    { group: 'Pages', title: 'Projects', sub: 'All GitHub repositories', icon: 'fas fa-code', href: 'projects/', keys: 'repos repositories work' },
    { group: 'Pages', title: 'Tools', sub: 'Small web utilities', icon: 'fas fa-screwdriver-wrench', href: 'tools/', keys: 'utilities apps' },
    { group: 'Pages', title: 'Games', sub: 'Browser games', icon: 'fas fa-gamepad', href: 'games/', keys: 'play fun' },
    { group: 'Pages', title: 'Stats', sub: 'GitHub activity, streaks and languages', icon: 'fas fa-chart-column', href: 'stats/', keys: 'statistics github contributions commits streak languages charts' },

    { group: 'Projects', title: 'Raspberry Pi Control', sub: 'Monitor and control a Pi from Android & Windows', icon: 'fab fa-raspberry-pi', href: 'projects/raspberrypicontrol/', keys: 'rpi grpc go flutter docker' },
    { group: 'Projects', title: 'NetW1re', sub: 'Network monitoring and traffic control', icon: 'fas fa-network-wired', href: 'projects/netw1re/', keys: 'network c# avalonia packets' },

    { group: 'Tools', title: 'JS/TS Playground', sub: 'Run JavaScript & TypeScript in the browser', icon: 'fab fa-js', href: 'tools/tjs-playground/', keys: 'javascript typescript editor code' },
    { group: 'Tools', title: 'Globedata', sub: 'Country facts on a 3D globe', icon: 'fas fa-earth-europe', href: 'tools/globedata/', keys: 'globe countries geography' },
    { group: 'Tools', title: 'Password Generator', sub: 'Secure passwords with entropy check', icon: 'fas fa-key', href: 'tools/pwgenerator/', keys: 'security crypto' },
    { group: 'Tools', title: 'Browser Fingerprint', sub: 'See what your browser gives away', icon: 'fas fa-fingerprint', href: 'tools/fingerprint/', keys: 'privacy canvas webgl' },
    { group: 'Tools', title: 'Color Palette Generator', sub: 'Build and export color palettes', icon: 'fas fa-palette', href: 'tools/color-generator/', keys: 'colors design' },
    { group: 'Tools', title: 'QR Code Generator', sub: 'QR codes for links, text and Wi-Fi', icon: 'fas fa-qrcode', href: 'tools/qr-code/', keys: 'qr wifi url' },
    { group: 'Tools', title: 'YouTube Tag Generator', sub: 'Tags and keywords for videos', icon: 'fab fa-youtube', href: 'tools/youtube-tag-generator/', keys: 'seo youtube tags' },
    { group: 'Tools', title: 'Regex Tester', sub: 'Test regular expressions live', icon: 'fas fa-asterisk', href: 'tools/regex-tester/', keys: 'regex pattern match' },
    { group: 'Tools', title: 'Subnet Calculator', sub: 'IPv4 CIDR, masks and host ranges', icon: 'fas fa-network-wired', href: 'tools/subnet-calculator/', keys: 'ip ipv4 cidr netmask network' },
    { group: 'Tools', title: 'JSON & YAML Formatter', sub: 'Validate, format and convert', icon: 'fas fa-code', href: 'tools/json-yaml/', keys: 'json yaml prettify minify validate' },
    { group: 'Tools', title: 'Base64, URL & JWT Decoder', sub: 'Encode and decode, inspect tokens', icon: 'fas fa-right-left', href: 'tools/encoder/', keys: 'base64 url encode decode jwt token hex' },
    { group: 'Tools', title: 'Cron Expression Helper', sub: 'Cron in plain English + next runs', icon: 'fas fa-clock-rotate-left', href: 'tools/cron/', keys: 'cron crontab schedule' },
    { group: 'Tools', title: 'Hash & Checksum', sub: 'MD5, SHA-256, CRC32 for text and files', icon: 'fas fa-hashtag', href: 'tools/hash/', keys: 'hash sha md5 checksum crc verify' },
    { group: 'Tools', title: 'Timestamp Converter', sub: 'Unix time, dates and time zones', icon: 'fas fa-clock', href: 'tools/timestamp/', keys: 'unix epoch time zone date clock' },
    { group: 'Tools', title: 'Markdown Preview', sub: 'Live Markdown editor and HTML export', icon: 'fab fa-markdown', href: 'tools/markdown/', keys: 'markdown md editor preview' },
    { group: 'Tools', title: 'Text Diff Checker', sub: 'Compare two texts', icon: 'fas fa-code-compare', href: 'tools/diff/', keys: 'diff compare text changes' },
    { group: 'Tools', title: 'DNS Lookup', sub: 'Records, reverse lookups, SPF & DMARC', icon: 'fas fa-globe', href: 'tools/dns-lookup/', keys: 'dns dig nslookup mx txt ptr spf dmarc resolver domain' },
    { group: 'Tools', title: 'MAC Address Lookup', sub: 'Vendor, type and notations of a MAC', icon: 'fas fa-ethernet', href: 'tools/mac-lookup/', keys: 'mac oui vendor manufacturer ethernet arp nic' },
    { group: 'Tools', title: 'Unit Converter', sub: 'GB vs GiB, Mbit/s vs MB/s, transfer times', icon: 'fas fa-scale-balanced', href: 'tools/unit-converter/', keys: 'units convert bytes gib mbit bandwidth download time temperature length' },

    { group: 'Games', title: '2048', sub: 'Slide and merge to 2048', icon: 'fas fa-table-cells-large', href: 'games/2048/', keys: 'puzzle numbers' },
    { group: 'Games', title: 'Globle', sub: 'Guess the country on a globe', icon: 'fas fa-earth-americas', href: 'games/globle/', keys: 'geography guess' },
    { group: 'Games', title: 'Tetris', sub: 'Falling blocks, clear lines', icon: 'fas fa-shapes', href: 'games/tetris/', keys: 'blocks tetromino' },
    { group: 'Games', title: 'Snake', sub: 'Eat, grow, don\'t bite yourself', icon: 'fas fa-wave-square', href: 'games/snake/', keys: 'snake arcade classic' },
    { group: 'Games', title: 'Minesweeper', sub: 'Clear the field, avoid the mines', icon: 'fas fa-bomb', href: 'games/minesweeper/', keys: 'mines puzzle flags' },
    { group: 'Games', title: 'Flag Quiz', sub: 'Guess the country from its flag', icon: 'fas fa-flag', href: 'games/flag-quiz/', keys: 'flags countries geography quiz' },
    { group: 'Games', title: 'Code Typing Test', sub: 'WPM with real code snippets', icon: 'fas fa-keyboard', href: 'games/typing-test/', keys: 'typing wpm speed keyboard' },
    { group: 'Games', title: 'Tech Memory', sub: 'Match pairs of tech logos', icon: 'fas fa-clone', href: 'games/memory/', keys: 'memory pairs cards' },
    { group: 'Games', title: 'Tic Tac Toe', sub: 'vs CPU or a friend', icon: 'fas fa-hashtag', href: 'games/tic-tac-toe/', keys: 'tictactoe noughts crosses xo minimax' },

    { group: 'Actions', title: 'Open GitHub profile', sub: 'github.com/Lukas200301', icon: 'fab fa-github', action: () => window.open(LINKS.github, '_blank', 'noopener') },
    { group: 'Actions', title: 'Copy Discord username', sub: LINKS.discord, icon: 'fab fa-discord', action: () => copy(LINKS.discord, 'Discord username copied') },
    { group: 'Actions', title: 'Open Instagram', sub: '@Lukas200103', icon: 'fab fa-instagram', action: () => window.open(LINKS.instagram, '_blank', 'noopener') },
    { group: 'Actions', title: 'Open a random tool or game', sub: 'Feeling lucky', icon: 'fas fa-dice', action: () => {
      const pool = REGISTRY.filter(r => r.group === 'Tools' || r.group === 'Games');
      go(url(pool[Math.floor(Math.random() * pool.length)].href));
    } },
    { group: 'Actions', title: 'Back to top', sub: 'Scroll to the start of this page', icon: 'fas fa-arrow-up', action: () => window.scrollTo({ top: 0, behavior: 'smooth' }) },
    { group: 'Actions', title: 'Keyboard shortcuts', sub: 'Show all shortcuts', icon: 'fas fa-keyboard', action: () => openShortcuts() },
    { group: 'Actions', title: 'Open command line', sub: 'Browse the site from a terminal', icon: 'fas fa-terminal', keys: 'terminal shell cli console bash', action: () => window.CLI && window.CLI.open() },
    { group: 'Actions', title: 'Party mode', sub: 'You know you want to', icon: 'fas fa-champagne-glasses', action: () => party() }
  ];

  // ---------- Small helpers ----------
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isTyping = (e) => {
    const t = e.target;
    return t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.closest('.CodeMirror'));
  };
  function go(href) { navigate(fixDir(href)); }

  // Patch every folder link (including ones rendered later) right before it's used
  function setupLocalLinks() {
    if (!IS_FILE) return;
    const patch = (e) => {
      const a = e.target.closest && e.target.closest('a[href]');
      if (!a) return;
      const raw = a.getAttribute('href');
      if (!raw || raw.startsWith('#') || /^[a-z]+:/i.test(raw)) return;
      const fixed = fixDir(a.href);
      if (fixed !== a.href) a.href = fixed;
    };
    ['pointerover', 'focusin', 'mousedown', 'click', 'touchstart'].forEach(t => document.addEventListener(t, patch, { capture: true, passive: true }));
  }

  function toast(msg, icon = 'fas fa-check') {
    let box = $('.toasts');
    if (!box) { box = h('<div class="toasts" role="status" aria-live="polite"></div>'); document.body.appendChild(box); }
    const t = h(`<div class="toast"><i class="${icon}"></i><span>${esc(msg)}</span></div>`);
    box.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 2400);
  }

  function copy(text, msg = 'Copied') {
    const done = () => toast(msg);
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done).catch(fallback);
    } else fallback();
    function fallback() {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { toast('Copy failed — select it manually', 'fas fa-triangle-exclamation'); }
      ta.remove();
    }
  }

  // ---------- Header ----------
  function buildHeader() {
    if ($('.site-header') || document.body.hasAttribute('data-no-shell')) return;
    const nav = [
      ['Projects', 'projects/', 'projects'],
      ['Tools', 'tools/', 'tools'],
      ['Games', 'games/', 'games'],
      ['Stats', 'stats/', 'stats']
    ];
    const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    const header = h(`
      <header class="site-header">
        <div class="wrap site-header__inner">
          <a class="brand" href="${url('')}" aria-label="Lukas200301 — home">
            <img src="https://github.com/Lukas200301.png?size=64" alt="" width="30" height="30">
            <span>Lukas200301</span>
            <span class="brand__live" aria-hidden="true"></span>
          </a>
          <nav class="site-nav" aria-label="Main">
            <span class="nav-pill" aria-hidden="true"></span>
            ${nav.map(([t, p, key]) => `<a href="${url(p)}"${section === key ? ' aria-current="page"' : ''}>${t}</a>`).join('')}
          </nav>
          <div class="site-header__tools">
            <button class="search-trigger" type="button" data-open-palette aria-label="Search the site">
              <i class="fas fa-magnifying-glass"></i><span>Jump to…</span><kbd>${isMac ? '⌘' : 'Ctrl'} K</kbd>
            </button>
            <button class="icon-btn cli-btn" type="button" data-open-cli aria-label="Open the command line" title="Command line (key left of 1)"><i class="fas fa-terminal"></i></button>
            <a class="icon-btn" href="${LINKS.github}" target="_blank" rel="noopener" aria-label="GitHub"><i class="fab fa-github"></i></a>
            <button class="icon-btn menu-btn" type="button" aria-label="Open menu" aria-expanded="false"><i class="fas fa-bars"></i></button>
          </div>
        </div>
      </header>`);
    document.body.prepend(header);
    try { if (!sessionStorage.getItem('intro-seen')) { document.documentElement.classList.add('intro'); sessionStorage.setItem('intro-seen', '1'); } } catch (e) {}

    const mobile = h(`<nav class="mobile-nav" aria-label="Mobile">
      <a href="${url('')}">Home <i class="fas fa-arrow-right"></i></a>
      ${nav.map(([t, p]) => `<a href="${url(p)}">${t} <i class="fas fa-arrow-right"></i></a>`).join('')}
    </nav>`);
    header.after(mobile);
    const menuBtn = $('.menu-btn', header);
    menuBtn.addEventListener('click', () => {
      const open = mobile.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', open);
      menuBtn.innerHTML = open ? '<i class="fas fa-xmark"></i>' : '<i class="fas fa-bars"></i>';
    });

    // Hover pill that glides between nav links
    const pill = $('.nav-pill', header);
    $$('.site-nav a', header).forEach(a => {
      a.addEventListener('mouseenter', () => {
        pill.style.width = a.offsetWidth + 'px';
        pill.style.transform = `translateX(${a.offsetLeft}px)`;
        pill.style.opacity = '1';
      });
    });
    $('.site-nav', header).addEventListener('mouseleave', () => { pill.style.opacity = '0'; });

    const progress = h('<div class="scroll-progress" aria-hidden="true"></div>');
    document.body.appendChild(progress);
  }

  // smooth sine path, drawn twice as wide so it can slide seamlessly
  function wavePath(w, hgt, waves, amp) {
    let d = '';
    const total = w * 2, step = 8;
    for (let x = 0; x <= total; x += step) {
      const y = hgt / 2 + Math.sin((x / w) * waves * Math.PI * 2) * amp * (0.6 + 0.4 * Math.sin((x / w) * Math.PI * 2 * 2));
      d += (x ? 'L' : 'M') + x + ' ' + y.toFixed(1);
    }
    return d;
  }

  // ---------- Footer ----------
  function buildFooter() {
    if ($('.site-footer') || document.body.hasAttribute('data-no-footer') || document.body.hasAttribute('data-no-shell')) return;
    const f = h(`
      <footer class="site-footer">
        <div class="signal-wave" aria-hidden="true">
          <svg viewBox="0 0 2400 60" preserveAspectRatio="none"><defs><linearGradient id="sw-g" gradientUnits="userSpaceOnUse" x1="0" x2="1200" spreadMethod="reflect"><stop offset="0" stop-color="#8ea2ff"/><stop offset=".5" stop-color="#b39bff"/><stop offset="1" stop-color="#ffb86b"/></linearGradient></defs>
          <path class="sw-a" d="${wavePath(1200, 60, 9, 14)}"/><path class="sw-b" d="${wavePath(1200, 60, 6, 9)}"/></svg>
        </div>
        <div class="wrap site-footer__inner">
          <span>© ${new Date().getFullYear()} Lukas200301</span>
          <nav aria-label="Footer">
            <a href="${url('projects/')}">Projects</a>
            <a href="${url('tools/')}">Tools</a>
            <a href="${url('games/')}">Games</a>
            <a href="${url('stats/')}">Stats</a>
            <a href="${LINKS.github}" target="_blank" rel="noopener">GitHub</a>
          </nav>
          <span class="foot-hint">Press <kbd>?</kbd> for shortcuts · <button type="button" class="foot-cli" data-open-cli><i class="fas fa-terminal"></i> command line</button></span>
        </div>
      </footer>`);
    const main = $('main');
    (main ? main : document.body.lastElementChild).after(f);
  }

  // ---------- Scroll: header state, progress, back to top ----------
  function setupScroll() {
    let btn = $('#backToTop') || $('.to-top');
    if (!btn) {
      btn = h('<button class="to-top" aria-label="Back to top"><i class="fas fa-arrow-up"></i></button>');
      document.body.appendChild(btn);
    }
    btn.innerHTML = '<svg class="to-top__ring" viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="tt-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8ea2ff"/><stop offset="1" stop-color="#ffb86b"/></linearGradient></defs><circle class="to-top__track" cx="24" cy="24" r="22.75"/><circle class="to-top__bar" cx="24" cy="24" r="22.75"/></svg><i class="fas fa-arrow-up"></i>';
    const bar = btn.querySelector('.to-top__bar');
    const CIRC = 2 * Math.PI * 22.75;
    bar.style.strokeDasharray = CIRC;
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

    const header = $('.site-header');
    const progress = $('.scroll-progress');
    let ticking = false;
    const update = () => {
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - innerHeight;
      if (header) header.classList.toggle('is-scrolled', y > 8);
      if (progress) progress.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
      btn.classList.toggle('visible', y > 600);
      bar.style.strokeDashoffset = (CIRC * (1 - (max > 0 ? Math.min(1, y / max) : 0))).toFixed(1);
      ticking = false;
    };
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    addEventListener('resize', update);
    update();
  }

  // ---------- Section rail (old nav dots) ----------
  function setupDots() {
    const dots = $$('.nav-dot');
    if (!dots.length) return;
    dots.forEach(d => {
      d.setAttribute('role', 'link');
      d.tabIndex = 0;
      const jump = () => {
        const s = document.getElementById(d.dataset.section);
        if (s) s.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      };
      d.addEventListener('keydown', e => { if (e.key === 'Enter') jump(); });
      if (!d.dataset.bound) d.addEventListener('click', jump);
    });
    const targets = dots.map(d => document.getElementById(d.dataset.section)).filter(Boolean);
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (en.isIntersecting) dots.forEach(d => d.classList.toggle('active', d.dataset.section === en.target.id));
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    targets.forEach(t => io.observe(t));
  }

  // ---------- Reveal on scroll ----------
  function setupReveal() {
    if (document.body.dataset.autoReveal !== undefined) {
      $$('.feature-card, .tech-card, .tech-category, .about-card, .usage-card, .prerequisites, .installation, .project-section .section-title, .project-cta .section-container > div')
        .forEach(el => { if (!el.hasAttribute('data-reveal')) el.setAttribute('data-reveal', ''); });
      // stagger siblings in grids
      $$('.features-grid, .about-grid, .usage-grid, .tech-details, .tech-stack').forEach(g => {
        Array.from(g.children).forEach((c, i) => c.style.setProperty('--i', i % 6));
      });
    }
    const els = $$('[data-reveal], [data-split]');
    if (!('IntersectionObserver' in window) || reduceMotion) { els.forEach(e => e.classList.add('is-in')); return; }
    const io = new IntersectionObserver(entries => {
      let any = false;
      entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); any = true; } });
      // after a long jump (anchor link, End key) also show everything already scrolled past
      if (any) els.forEach(e => { if (!e.classList.contains('is-in') && e.getBoundingClientRect().top < innerHeight) { e.classList.add('is-in'); io.unobserve(e); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    els.forEach(e => io.observe(e));
    window.Site.observeReveal = (el) => io.observe(el);
  }

  // ---------- Spotlight + tilt ----------
  function setupSpotlight() {
    document.addEventListener('pointermove', e => {
      const el = e.target.closest && e.target.closest('.spot');
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      el.style.setProperty('--my', (e.clientY - r.top) + 'px');
      if (el.hasAttribute('data-tilt') && !reduceMotion && e.pointerType === 'mouse') {
        const rx = ((e.clientY - r.top) / r.height - 0.5) * -5;
        const ry = ((e.clientX - r.left) / r.width - 0.5) * 7;
        el.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-3px)`;
      }
    }, { passive: true });
    document.addEventListener('pointerout', e => {
      const el = e.target.closest && e.target.closest('[data-tilt]');
      if (el && !el.contains(e.relatedTarget)) el.style.transform = '';
    });
  }

  // ---------- Prefetch on hover (makes page transitions instant) ----------
  function setupPrefetch() {
    const done = new Set();
    document.addEventListener('pointerover', e => {
      const a = e.target.closest && e.target.closest('a[href]');
      if (!a || a.target === '_blank') return;
      const u = new URL(a.href, location.href);
      if (u.origin !== location.origin || done.has(u.pathname)) return;
      done.add(u.pathname);
      const l = document.createElement('link');
      l.rel = 'prefetch'; l.href = u.pathname;
      document.head.appendChild(l);
    }, { passive: true });
  }

  // ---------- Command palette ----------
  let palette, input, list, items = [], active = 0, mode = 'search';

  function extraRepos() {
    try {
      const c = JSON.parse(localStorage.getItem('gh-repos-v2') || 'null');
      if (!c || !Array.isArray(c.data)) return [];
      return c.data.slice(0, 40).map(r => ({
        group: 'Repositories', title: r.name, sub: r.description || 'GitHub repository',
        icon: 'fab fa-github', href: r.html_url, external: true, keys: (r.language || '') + ' ' + (r.topics || []).join(' ')
      }));
    } catch (e) { return []; }
  }

  function score(q, it) {
    if (!q) return 1;
    const hay = (it.title + ' ' + (it.sub || '') + ' ' + (it.keys || '') + ' ' + it.group).toLowerCase();
    const t = it.title.toLowerCase();
    if (t.startsWith(q)) return 100 - t.length / 100;
    if (t.includes(q)) return 80;
    if (hay.includes(q)) return 50;
    // every word of the query appears somewhere
    const words = q.split(/\s+/).filter(Boolean);
    return words.length > 1 && words.every(w => hay.includes(w)) ? 30 : 0;
  }

  function highlight(text, q) {
    if (!q) return esc(text);
    const i = text.toLowerCase().indexOf(q);
    if (i < 0) return esc(text);
    return esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + q.length)) + '</mark>' + esc(text.slice(i + q.length));
  }

  function buildPalette() {
    palette = h(`
      <div class="palette" role="dialog" aria-modal="true" aria-label="Jump to">
        <div class="palette__box">
          <label class="palette__field">
            <i class="fas fa-magnifying-glass"></i>
            <input type="text" placeholder="Search pages, tools, games, repos…" autocomplete="off" spellcheck="false" aria-controls="paletteList">
            <kbd>Esc</kbd>
          </label>
          <div class="palette__list" id="paletteList" role="listbox"></div>
          <div class="palette__foot">
            <span><kbd>↑</kbd><kbd>↓</kbd> move</span>
            <span><kbd>↵</kbd> open</span>
            <span><kbd>?</kbd> shortcuts</span>
          </div>
        </div>
      </div>`);
    document.body.appendChild(palette);
    input = $('input', palette);
    list = $('.palette__list', palette);

    palette.addEventListener('mousedown', e => { if (e.target === palette) closePalette(); });
    input.addEventListener('input', () => { active = 0; renderPalette(); });
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); run(items[active], e); }
      else if (e.key === 'Escape') { closePalette(); }
      else if (e.key === '?' && !input.value) { e.preventDefault(); openShortcuts(); }
    });
    list.addEventListener('mousemove', e => {
      const b = e.target.closest('.palette__item');
      if (b && +b.dataset.i !== active) { active = +b.dataset.i; paintActive(); }
    });
    list.addEventListener('click', e => {
      const b = e.target.closest('.palette__item');
      if (b) run(items[+b.dataset.i], e);
    });
  }

  function renderPalette() {
    mode = 'search';
    const q = input.value.trim().toLowerCase();
    const all = REGISTRY.concat(extraRepos());
    items = all.map(it => ({ it, s: score(q, it) })).filter(x => x.s > 0);
    if (q) items.sort((a, b) => b.s - a.s);
    items = items.map(x => x.it).slice(0, q ? 30 : all.length);
    if (!q) items = items.filter(it => it.group !== 'Repositories');

    if (!items.length) {
      list.innerHTML = `<div class="palette__empty">Nothing matches “${esc(q)}”. Try a tool name like <b>regex</b> or <b>qr</b>.</div>`;
      return;
    }
    let html = '', last = '';
    items.forEach((it, i) => {
      if (it.group !== last && !q) { html += `<div class="palette__group">${it.group}</div>`; last = it.group; }
      html += `<button class="palette__item" role="option" data-i="${i}" type="button">
        <span class="pi-icon"><i class="${it.icon}"></i></span>
        <span class="pi-text"><span class="pi-title">${highlight(it.title, q)}</span><span class="pi-sub">${esc(it.sub || '')}</span></span>
        <span class="pi-enter">${it.external ? '<i class="fas fa-arrow-up-right-from-square"></i>' : '↵'}</span>
      </button>`;
    });
    list.innerHTML = html;
    paintActive();
  }

  function paintActive() {
    $$('.palette__item', list).forEach(b => {
      const on = +b.dataset.i === active;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', on);
      if (on) b.scrollIntoView({ block: 'nearest' });
    });
  }
  function move(d) { if (!items.length) return; active = (active + d + items.length) % items.length; paintActive(); }
  function run(it, e) {
    if (!it) return;
    closePalette();
    if (it.action) return it.action();
    const href = it.external ? it.href : url(it.href);
    if (it.external || (e && (e.metaKey || e.ctrlKey))) window.open(href, '_blank', 'noopener');
    else go(href);
  }

  function openPalette() {
    if (!palette) buildPalette();
    input.value = '';
    active = 0;
    renderPalette();
    palette.classList.add('open');
    document.documentElement.style.overflow = 'hidden';
    setTimeout(() => input.focus(), 10);
  }
  function closePalette() {
    if (!palette) return;
    palette.classList.remove('open');
    document.documentElement.style.overflow = '';
  }

  function openShortcuts() {
    if (!palette) buildPalette();
    if (!palette.classList.contains('open')) openPalette();
    mode = 'help';
    const mod = /Mac|iPhone|iPad/.test(navigator.platform || '') ? '⌘' : 'Ctrl';
    list.innerHTML = `
      <div class="palette__group">Keyboard shortcuts</div>
      <ul class="shortcuts">
        <li><span>Jump anywhere</span><span><kbd>${mod}</kbd><kbd>K</kbd></span></li>
        <li><span>Go home</span><span><kbd>G</kbd><kbd>H</kbd></span></li>
        <li><span>Go to projects</span><span><kbd>G</kbd><kbd>P</kbd></span></li>
        <li><span>Go to tools</span><span><kbd>G</kbd><kbd>T</kbd></span></li>
        <li><span>Go to games</span><span><kbd>G</kbd><kbd>G</kbd></span></li>
        <li><span>Go to stats</span><span><kbd>G</kbd><kbd>S</kbd></span></li>
        <li><span>Command line</span><span><kbd>${'`'}</kbd> / <kbd>^</kbd> <small style="opacity:.6">(key left of 1)</small></span></li>
        <li><span>Search this list (on list pages)</span><span><kbd>/</kbd></span></li>
        <li><span>Back to top</span><span><kbd>Shift</kbd><kbd>↑</kbd></span></li>
        <li><span>Show this sheet</span><span><kbd>?</kbd></span></li>
      </ul>`;
    items = [];
  }

  // ---------- Keyboard ----------
  function setupKeys() {
    let gAt = 0;
    const konami = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
    let kIdx = 0;
    document.addEventListener('keydown', e => {
      // Konami (works everywhere, even while typing is not needed)
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      kIdx = k === konami[kIdx] ? kIdx + 1 : (k === konami[0] ? 1 : 0);
      if (kIdx === konami.length) { kIdx = 0; party(); }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        palette && palette.classList.contains('open') ? closePalette() : openPalette();
        return;
      }
      if (e.key === 'Escape') {
        closePalette();
        const m = $('.mobile-nav.open'); if (m) $('.menu-btn').click();
        return;
      }
      if (isTyping(e) || e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === '?') { e.preventDefault(); openShortcuts(); return; }
      if (e.key === '/') {
        const s = $('[data-list-search]');
        if (s) { e.preventDefault(); s.focus(); s.select(); }
        else if (!isGamePlay) { e.preventDefault(); openPalette(); }
        return;
      }
      if (e.shiftKey && e.key === 'ArrowUp' && !isGamePlay) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
      if (isGamePlay) return; // games own the keyboard
      const key = e.key.toLowerCase();
      if (gAt && Date.now() - gAt < 900) {
        const map = { h: '', p: 'projects/', t: 'tools/', g: 'games/', s: 'stats/' };
        gAt = 0;
        if (key in map) { e.preventDefault(); go(url(map[key])); }
        return;
      }
      if (key === 'g') gAt = Date.now();
    });
    $$('[data-open-palette]').forEach(b => b.addEventListener('click', openPalette));
  }

  // ---------- Party mode (confetti) ----------
  function party(msg) {   // msg: custom toast text, or false for none
    if (reduceMotion) { if (msg !== false) toast(msg || 'Party mode on (quietly)', 'fas fa-champagne-glasses'); return; }
    const c = document.createElement('canvas');
    c.className = 'egg-canvas';
    document.body.appendChild(c);
    const ctx = c.getContext('2d');
    const dpr = Math.min(2, devicePixelRatio || 1);
    c.width = innerWidth * dpr; c.height = innerHeight * dpr;
    ctx.scale(dpr, dpr);
    const colors = ['#8ea2ff', '#ffb86b', '#5ee6b5', '#b39bff', '#ff7a90', '#6fd8ff'];
    const parts = Array.from({ length: 180 }, () => ({
      x: innerWidth / 2 + (Math.random() - 0.5) * 120,
      y: innerHeight * 0.65,
      vx: (Math.random() - 0.5) * 16,
      vy: -Math.random() * 18 - 8,
      w: 5 + Math.random() * 6, h: 8 + Math.random() * 8,
      r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
      c: colors[(Math.random() * colors.length) | 0]
    }));
    let t0 = performance.now();
    (function frame(t) {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      parts.forEach(p => {
        p.vy += 0.45; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)));
        ctx.restore();
      });
      if (t - t0 < 3500) requestAnimationFrame(frame); else c.remove();
    })(t0);
    if (msg !== false) toast(msg || 'Party mode unlocked', 'fas fa-champagne-glasses');
  }

  // ---------- Live background: signal grid ----------
  // Every frame: breathing dot grid, a diagonal scan wave, automatic pings, data packets
  // running along grid lines, and a smooth cursor lens that lights up and pushes dots aside.
  function setupBackground() {
    if (document.body.hasAttribute('data-no-bg')) return;
    const c = document.createElement('canvas');
    c.className = 'bg-field';
    c.setAttribute('aria-hidden', 'true');
    document.body.prepend(c);
    document.documentElement.classList.add('has-bg-field');
    const ctx = c.getContext('2d');
    const G = 28;
    const calm = isGamePlay;                 // quieter behind games
    let W = 0, H = 0, cols = 0, rows = 0, dpr = 1, N = 0;
    let phase, speed, fade, A, T;            // per-dot arrays
    let packets = [], pings = [];
    const mouse = { x: -1e4, y: -1e4, tx: -1e4, ty: -1e4, on: 0, ton: 0 };
    const RGB = ['163,174,208', '142,162,255', '255,184,107', '111,216,255'];

    function resize() {
      dpr = Math.min(1.5, window.devicePixelRatio || 1);
      W = innerWidth; H = innerHeight;
      c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(W / G) + 1; rows = Math.ceil(H / G) + 1; N = cols * rows;
      phase = new Float32Array(N); speed = new Float32Array(N); fade = new Float32Array(N);
      A = new Float32Array(N); T = new Uint8Array(N);
      for (let k = 0; k < N; k++) {
        phase[k] = Math.random() * Math.PI * 2;
        speed[k] = 0.4 + Math.random() * 1.1;
        const y = Math.floor(k / cols) * G;
        fade[k] = 1 - 0.55 * Math.min(1, y / H);
      }
      const want = calm ? 5 : Math.max(8, Math.min(20, Math.round(W * H / 70000)));
      while (packets.length < want) packets.push(spawn());
      packets.length = want;
    }

    function spawn() {
      const horiz = Math.random() < 0.5, dir = Math.random() < 0.5 ? 1 : -1;
      return {
        x: horiz ? (dir > 0 ? -G : cols * G) : Math.floor(Math.random() * cols) * G,
        y: horiz ? Math.floor(Math.random() * rows) * G : (dir > 0 ? -G : rows * G),
        dx: horiz ? dir : 0, dy: horiz ? 0 : dir,
        v: 70 + Math.random() * 110,       // px per second
        col: Math.random() < 0.2 ? 2 : (Math.random() < 0.5 ? 1 : 3),
        trail: [], len: 12 + Math.floor(Math.random() * 20)
      };
    }

    function stepPacket(p, dt) {
      const px = p.x, py = p.y;
      p.x += p.dx * p.v * dt; p.y += p.dy * p.v * dt;
      const crossed = p.dx ? Math.floor(px / G) !== Math.floor(p.x / G) : Math.floor(py / G) !== Math.floor(p.y / G);
      if (crossed && Math.random() < 0.18) {
        p.x = Math.round(p.x / G) * G; p.y = Math.round(p.y / G) * G;
        if (p.dx) { p.dy = Math.random() < 0.5 ? 1 : -1; p.dx = 0; } else { p.dx = Math.random() < 0.5 ? 1 : -1; p.dy = 0; }
      }
      p.trail.push(p.x, p.y);
      if (p.trail.length > p.len * 2) p.trail.splice(0, 2);
      return p.x > -G * 4 && p.x < W + G * 4 && p.y > -G * 4 && p.y < H + G * 4;
    }

    // aurora: soft drifting light, rendered at 1/10 size (it's blurry anyway) and scaled up
    const aur = document.createElement('canvas'), actx = aur.getContext('2d');
    const BLOBS = [
      { c: '142,162,255', a: 0.17, x: 0.18, y: 0.12, r: 0.55, sx: 0.10, sy: 0.07, p: 0 },
      { c: '179,155,255', a: 0.12, x: 0.85, y: 0.10, r: 0.45, sx: 0.08, sy: 0.08, p: 2 },
      { c: '111,216,255', a: 0.08, x: 0.70, y: 0.85, r: 0.42, sx: 0.10, sy: 0.06, p: 4 },
      { c: '255,184,107', a: 0.05, x: 0.08, y: 0.80, r: 0.35, sx: 0.06, sy: 0.08, p: 1 }
    ];
    let aurFrame = 0;
    function drawAurora(t) {
      const w = Math.max(16, Math.round(W / 10)), h = Math.max(16, Math.round(H / 10));
      if (aur.width !== w || aur.height !== h) { aur.width = w; aur.height = h; aurFrame = 0; }
      if (aurFrame++ % 3 === 0) {
        actx.clearRect(0, 0, w, h);
        const s = t / 1000;
        for (const b of BLOBS) {
          const cx = (b.x + Math.sin(s * 0.13 + b.p) * b.sx) * w;
          const cy = (b.y + Math.cos(s * 0.11 + b.p) * b.sy) * h;
          const r = b.r * Math.max(w, h) * (1 + Math.sin(s * 0.09 + b.p) * 0.1);
          const g = actx.createRadialGradient(cx, cy, 0, cx, cy, r);
          g.addColorStop(0, `rgba(${b.c},${b.a})`); g.addColorStop(1, `rgba(${b.c},0)`);
          actx.fillStyle = g; actx.fillRect(0, 0, w, h);
        }
      }
      ctx.drawImage(aur, 0, 0, W, H);
    }

    let nextAutoPing = 2500;
    function draw(t, dt) {
      ctx.clearRect(0, 0, W, H);
      drawAurora(t);
      // frame-rate independent easing toward the real cursor
      const e = 1 - Math.exp(-dt * 16);
      mouse.x += (mouse.tx - mouse.x) * e;
      mouse.y += (mouse.ty - mouse.y) * e;
      mouse.on += (mouse.ton - mouse.on) * (1 - Math.exp(-dt * 6));

      // automatic pings so the grid lives without the mouse
      if (!calm && t > nextAutoPing) {
        pings.push({ x: Math.random() * W, y: Math.random() * H * 0.8, r: 0, life: 0.55, v: 260 });
        nextAutoPing = t + 2600 + Math.random() * 3200;
      }

      const period = 7000, BAND = 190;
      const wavePos = ((t % period) / period) * (W + H + 800) - 400;
      const s = t / 1000;
      const R = 180, R2 = R * R, lens = mouse.on;

      // pings advance
      for (let n = pings.length - 1; n >= 0; n--) {
        const pg = pings[n];
        pg.r += pg.v * dt; pg.life -= dt * 0.55;
        if (pg.life <= 0) pings.splice(n, 1);
      }

      // 1) compute alpha + tint per dot
      for (let k = 0; k < N; k++) {
        const i = k % cols, j = (k / cols) | 0, x = i * G, y = j * G;
        let a = (0.17 + 0.09 * Math.sin(s * speed[k] + phase[k])) * fade[k];
        let tint = 0;
        const d = x + y - wavePos;
        if (d > -BAND && d < BAND) { const q = 1 - Math.abs(d) / BAND; a += q * q * 0.5; if (q > 0.45) tint = 1; }
        if (lens > 0.01) {
          const mx = x - mouse.x, my = y - mouse.y, m2 = mx * mx + my * my;
          if (m2 < R2) { const q = 1 - Math.sqrt(m2) / R; a += q * q * 0.85 * lens; tint = 1; }
        }
        for (let n = 0; n < pings.length; n++) {
          const pg = pings[n], px = x - pg.x, py = y - pg.y;
          const ring = Math.abs(Math.sqrt(px * px + py * py) - pg.r);
          if (ring < 30) { a += (1 - ring / 30) * pg.life * 0.8; tint = 2; }
        }
        A[k] = a > 1 ? 1 : a; T[k] = tint;
      }

      // 2) draw dots grouped by colour (one fillStyle per group, alpha via globalAlpha)
      for (let tint = 0; tint < 3; tint++) {
        ctx.fillStyle = `rgb(${RGB[tint]})`;
        for (let k = 0; k < N; k++) {
          if (T[k] !== tint) continue;
          const a = A[k];
          if (a < 0.03) continue;
          let x = (k % cols) * G, y = ((k / cols) | 0) * G;
          if (lens > 0.01) {
            const mx = x - mouse.x, my = y - mouse.y, m2 = mx * mx + my * my;
            if (m2 < R2 && m2 > 0.01) {
              const m = Math.sqrt(m2), q = 1 - m / R, push = q * q * 14 * lens;
              x += mx / m * push; y += my / m * push;
            }
          }
          const size = 1.3 + a * 1.9;
          ctx.globalAlpha = a;
          ctx.fillRect(x - size / 2, y - size / 2, size, size);
        }
      }
      ctx.globalAlpha = 1;

      // 3) ping rings
      ctx.lineWidth = 1.2;
      for (const pg of pings) {
        ctx.strokeStyle = `rgba(255,184,107,${pg.life * 0.32})`;
        ctx.beginPath(); ctx.arc(pg.x, pg.y, pg.r, 0, Math.PI * 2); ctx.stroke();
      }

      // 4) packets with fading trails
      ctx.lineCap = 'round';
      for (let n = 0; n < packets.length; n++) {
        const p = packets[n];
        if (!stepPacket(p, dt)) { packets[n] = spawn(); continue; }
        const tr = p.trail, L = tr.length / 2, rgb = RGB[p.col];
        ctx.strokeStyle = `rgb(${rgb})`;
        for (let k = 1; k < L; k++) {
          const f = k / L;
          ctx.globalAlpha = f * f * 0.7;
          ctx.lineWidth = 1 + f;
          ctx.beginPath(); ctx.moveTo(tr[(k - 1) * 2], tr[(k - 1) * 2 + 1]); ctx.lineTo(tr[k * 2], tr[k * 2 + 1]); ctx.stroke();
        }
        ctx.fillStyle = `rgb(${rgb})`;
        ctx.globalAlpha = 0.25; ctx.fillRect(p.x - 5, p.y - 5, 10, 10);
        ctx.globalAlpha = 1; ctx.fillRect(p.x - 1.75, p.y - 1.75, 3.5, 3.5);
      }
      ctx.globalAlpha = 1;
    }

    let raf = 0, last = 0, running = false;
    function loop(t) {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, last ? (t - last) / 1000 : 0.016);
      last = t;
      draw(t, dt);
    }
    function start() { if (!running && !reduceMotion) { running = true; last = 0; raf = requestAnimationFrame(loop); } }
    function stop() { running = false; cancelAnimationFrame(raf); }

    resize();
    if (reduceMotion) { packets = []; draw(0, 0); } else start();
    let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { resize(); if (reduceMotion) draw(0, 0); }, 120); });
    document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());
    if (!calm) {
      addEventListener('pointermove', e => {
        if (e.pointerType !== 'mouse') return;
        if (mouse.ton === 0 && mouse.on < 0.05) { mouse.x = e.clientX; mouse.y = e.clientY; } // no swoop-in from far away
        mouse.tx = e.clientX; mouse.ty = e.clientY; mouse.ton = 1;
      }, { passive: true });
      document.documentElement.addEventListener('pointerleave', () => { mouse.ton = 0; });
      addEventListener('blur', () => { mouse.ton = 0; });
    }
    document.addEventListener('pointerdown', e => {
      if (reduceMotion || e.button !== 0) return;
      if (e.target.closest('a, button, input, textarea, select, label, canvas, [role=button], .CodeMirror, p, h1, h2, h3, li, code, pre')) return;
      pings.push({ x: e.clientX, y: e.clientY, r: 0, life: 1, v: 420 });
      if (pings.length > 6) pings.shift();
    });
    window.Site.ping = (x, y) => pings.push({ x, y, r: 0, life: 1, v: 420 });
  }

  // ---------- Motion: scroll reveals, split headings, parallax, cursor ring, ripple, decode ----------
  function setupMotion() {
    const tag = (sel, variant = '', stagger = false) => $$(sel).forEach((el, i) => {
      if (el.hasAttribute('data-reveal') || el.closest('[data-reveal]') && !stagger) return;
      el.setAttribute('data-reveal', variant);
      if (stagger) el.style.setProperty('--i', el.dataset.i || (Array.prototype.indexOf.call(el.parentElement.children, el) % 10));
    });

    // 1. split headings into words that slide up out of a mask
    $$('.block__title, .page-title, .tool-title, .game-title, .project-hero .project-title, .section-title, .project-cta h2, .nf h1').forEach(h => {
      if (h.dataset.split !== undefined || h.closest('.palette')) return;
      h.setAttribute('data-split', '');
      let wi = 0;
      Array.from(h.childNodes).forEach(n => {
        if (n.nodeType === 3 && n.textContent.trim()) {
          const wrap = document.createElement('span');
          wrap.className = 'sw';
          n.textContent.trim().split(/\s+/).forEach((word, k, arr) => {
            const w = document.createElement('span'); w.className = 'w';
            const inner = document.createElement('span'); inner.textContent = word;
            inner.style.setProperty('--wi', wi++);
            w.appendChild(inner); wrap.appendChild(w);
            if (k < arr.length - 1) wrap.appendChild(document.createTextNode(' '));
          });
          n.replaceWith(wrap);
        }
      });
    });

    // 2. tag things to reveal (variants: '' up, left, scale, blur, pop)
    tag('.crumbs, .tool-breadcrumb, .game-breadcrumb, .project-breadcrumb', 'left');
    tag('.page-lede, .tool-description, .game-description, .project-hero .project-description, .block__lede, .section-subtitle, .section-description', 'blur');
    tag('.page-meta > *, .tool-meta > *, .game-meta > *, .project-meta > *', 'pop', true);
    tag('.list-bar, .list-count', '');
    tag('.tool-section .section-container > *, .game-section .section-container > *', 'scale', true);
    tag('.features-grid > *, .about-grid > *, .usage-grid > *, .tech-details > *, .tech-stack > *, .tech-items > *', 'scale', true);
    tag('.feature-list > *, .contact-list > *, .gh-stats > *', 'left', true);
    tag('.link-cloud > *', 'pop', true);
    tag('.stack__col li', '', true);
    tag('.prerequisites, .installation, .code-block, .project-cta .section-container > div', 'scale');
    tag('.site-footer .site-footer__inner > *', '', true);
    $$('.feature-card, .about-card, .usage-card, .tech-card, .tech-category, .tile, .gh-panel').forEach(el => el.classList.add('spot'));
    $$('.feature-card, .tech-category, .tile').forEach(el => el.setAttribute('data-tilt', ''));

    if (reduceMotion) return;

    // 3. parallax + fade on scroll
    const par = [];
    const addPar = (sel, speed, fadeOut) => $$(sel).forEach(el => par.push({ el, speed, fadeOut }));
    addPar('.hero__stage', 0.35, true);
    addPar('.hero__row', 0.12, true);
    addPar('.presence', -0.06, false);
    addPar('.list-hero, .tool-hero .tool-header, .game-hero .game-header, .project-hero .project-header', 0.22, true);
    if (par.length) {
      let ticking = false;
      const run = () => {
        const y = scrollY, vh = innerHeight;
        par.forEach(p => {
          if (y > vh * 1.5) return;
          const t = y * p.speed;
          p.el.style.transform = `translate3d(0, ${t.toFixed(1)}px, 0)`;
          if (p.fadeOut) p.el.style.opacity = Math.max(0, 1 - y / (vh * 0.9)).toFixed(3);
        });
        ticking = false;
      };
      addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(run); } }, { passive: true });
      run();
    }

    const fine = window.matchMedia('(pointer: fine)').matches;
    if (!fine) return;

    // 4. trailing cursor ring (the real cursor stays; this just follows it)
    const ring = h('<div class="cursor-ring" aria-hidden="true"><span></span></div>');
    document.body.appendChild(ring);
    const cur = { x: -100, y: -100, tx: -100, ty: -100, s: 1, ts: 1, seen: false };
    const HOT = 'a, button, [role=button], input, textarea, select, label, [data-tilt], .nav-dot, .palette__item, summary';
    addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      cur.tx = e.clientX; cur.ty = e.clientY;
      if (!cur.seen) { cur.x = cur.tx; cur.y = cur.ty; cur.seen = true; ring.classList.add('on'); }
      const hot = e.target.closest && e.target.closest(HOT);
      cur.ts = hot ? (hot.matches('input, textarea') ? 0.6 : 1.9) : 1;
      ring.classList.toggle('hot', !!hot);
      ring.classList.toggle('hide', !!(e.target.closest && e.target.closest('.to-top, .back-to-top')));
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', () => ring.classList.remove('on'));
    document.documentElement.addEventListener('pointerenter', () => cur.seen && ring.classList.add('on'));
    addEventListener('pointerdown', () => { cur.s *= 0.75; ring.classList.add('down'); });
    addEventListener('pointerup', () => ring.classList.remove('down'));
    let lastT = 0;
    (function follow(t) {
      const dt = Math.min(0.05, lastT ? (t - lastT) / 1000 : 0.016); lastT = t;
      const e = 1 - Math.exp(-dt * 22), es = 1 - Math.exp(-dt * 12);
      cur.x += (cur.tx - cur.x) * e; cur.y += (cur.ty - cur.y) * e; cur.s += (cur.ts - cur.s) * es;
      // size changes via width/height (not scale) so the ring is re-drawn sharp at every size
      const d = Math.round(34 * cur.s * 2) / 2;
      if (d !== cur.d) { cur.d = d; ring.style.width = ring.style.height = d + 'px'; }
      ring.style.transform = `translate3d(${(cur.x - d / 2).toFixed(2)}px, ${(cur.y - d / 2).toFixed(2)}px, 0)`;
      requestAnimationFrame(follow);
    })(0);

    // 6. click ripple
    const RIP = '.btn, .cta-button, .filter, .contact-row, .feature-row, .card, .tile, .action-btn, .game-btn, .globe-btn, .control-btn, .generate-btn, .download-btn, .guess-btn, .retry-btn, .palette__item, .search-trigger, .link-cloud a, .icon-btn';
    document.addEventListener('pointerdown', e => {
      const el = e.target.closest && e.target.closest(RIP);
      if (!el || e.button !== 0) return;
      const cs = getComputedStyle(el);
      if (cs.position === 'static') el.style.position = 'relative';
      el.classList.add('has-ripple');
      const r = el.getBoundingClientRect(), size = Math.max(r.width, r.height) * 2.2;
      const dot = document.createElement('span');
      dot.className = 'ripple';
      dot.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
      el.appendChild(dot);
      dot.addEventListener('animationend', () => dot.remove());
    });

    // 7. letter roll on hover: the text slides up letter by letter while a copy rolls in from below
    $$('.site-nav a, .brand > span:not(.brand__live), .text-link, .site-footer nav a, .mobile-nav a, .tile__title, .btn, .cta-button').forEach(el => {
      const node = Array.from(el.childNodes).find(n => n.nodeType === 3 && n.textContent.trim());
      if (!node || el.querySelector('.roll')) return;
      const text = node.textContent.trim();
      const lead = /^\s/.test(node.textContent) ? ' ' : '', trail = /\s$/.test(node.textContent) ? ' ' : '';
      const letters = (cls) => Array.from(text).map((ch, k) => `<span class="${cls}" style="--k:${k}">${ch === ' ' ? '&nbsp;' : ch.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</span>`).join('');
      const wrap = document.createElement('span');
      wrap.className = 'roll';
      wrap.innerHTML = `<span class="sr-only">${text.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</span><span class="roll__a" aria-hidden="true">${letters('rl')}</span><span class="roll__b" aria-hidden="true">${letters('rl')}</span>`;
      node.replaceWith(document.createTextNode(lead), wrap, document.createTextNode(trail));
      el.classList.add('has-roll');
    });
  }

  // ---------- Extra motion: count-ups, code typing, list stagger, anchor flash, page wipe origin ----------
  function countUp(el, to, dur = 1300) {
    if (reduceMotion || !isFinite(to)) { el.textContent = Number(to).toLocaleString('en'); return; }
    const t0 = performance.now();
    (function f(t) {
      const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 4);
      el.textContent = Math.round(to * e).toLocaleString('en');
      if (p < 1) requestAnimationFrame(f);
    })(t0);
  }

  function setupExtras() {
    // numbers in page meta chips count up
    $$('.page-meta span[id], .tool-meta span[id], .game-meta span[id]').forEach(el => {
      const n = parseInt(el.textContent, 10);
      if (!isNaN(n) && n > 0) countUp(el, n, 900);
    });

    // code blocks type in line by line once visible (text content stays identical for copy buttons)
    $$('.code-block code').forEach(code => {
      const lines = code.textContent.split('\n');
      if (lines.length > 60) return;
      code.textContent = '';
      lines.forEach((ln, i) => {
        const sp = document.createElement('span');
        sp.className = 'cl'; sp.style.setProperty('--l', Math.min(i, 30));
        sp.textContent = ln;
        code.appendChild(sp);
        if (i < lines.length - 1) code.appendChild(document.createTextNode('\n'));
      });
    });

    // list items inside cards slide in after their card
    $$('.feature-card, .about-card, .usage-card, .tech-card, .prerequisites').forEach(card => {
      $$('li', card).forEach((li, i) => li.style.setProperty('--li', Math.min(i, 10)));
    });

    // jumping to an anchor makes its heading flash
    const flash = (id) => {
      const t = id && document.getElementById(id);
      const hd = t && (t.matches('h1,h2,h3') ? t : t.querySelector('h1, h2, h3'));
      if (!hd) return;
      hd.classList.remove('flash'); void hd.offsetWidth; hd.classList.add('flash');
    };
    document.addEventListener('click', e => {
      const a = e.target.closest && e.target.closest('a[href^="#"]');
      if (a && a.getAttribute('href').length > 1) setTimeout(() => flash(a.getAttribute('href').slice(1)), 450);
    });
    addEventListener('hashchange', () => flash(location.hash.slice(1)));

  }

  // ---------- Page transitions (work everywhere, also when opened from disk) ----------
  // Leaving: a panel rises over the page with a glowing edge, then we navigate.
  // Arriving: an inline <head> script marks the page as covered before first paint; here we lift it off.
  // label for where we're going, shown as a terminal command on the cover
  function destLabel(href) {
    try {
      const u = new URL(href, location.href);
      let rel = u.href.startsWith(ROOT) ? u.href.slice(ROOT.length) : u.pathname;
      rel = rel.split('#')[0].split('?')[0].replace(/index\.html$/, '').replace(/\/$/, '');
      return 'cd ~' + (rel ? '/' + rel : '');
    } catch (e) { return 'cd ~'; }
  }
  function buildOverlay(mode, dest) {
    const name = 'Lukas200301';
    const letters = Array.from(name).map((c, k) => `<span class="pl" style="--k:${k}">${c}</span>`).join('');
    const ov = h(`<div class="pt-ov pt-ov--${mode}" aria-hidden="true">
        <div class="pt-ov__panel"><div class="pt-ov__grid"></div></div>
        <div class="pt-ov__edge"></div>
        <div class="pt-ov__hud"><div class="pt-ov__frame">
          <i class="c c1"></i><i class="c c2"></i><i class="c c3"></i><i class="c c4"></i>
          <span class="pt-ov__ring"></span><span class="pt-ov__ring r2"></span>
          <div class="pt-ov__name">${letters}</div>
          <div class="pt-ov__bar"><b></b></div>
          <div class="pt-ov__dest"><span style="--n:${dest.length}">${esc(dest)}</span><i class="pt-ov__caret"></i></div>
        </div></div>
      </div>`);
    document.body.appendChild(ov);
    void ov.offsetWidth;          // commit the start state so the transitions run
    return ov;
  }
  function navigate(href) {
    const root = document.documentElement;
    if (reduceMotion || root.classList.contains('pt-leave')) { location.href = href; return; }
    const dest = destLabel(href);
    try { sessionStorage.setItem('pt', dest); } catch (e) {}
    root.classList.add('pt-leave');
    const ov = buildOverlay('leave', dest);
    ov.classList.add('go');
    setTimeout(() => { location.href = href; }, 640);
  }
  function setupPageTransitions() {
    const root = document.documentElement;
    if (root.classList.contains('pt-enter')) {
      // the inline <head> script already put the finished overlay on screen before the first paint
      let ov = $('.pt-ov--enter');
      if (!ov) ov = buildOverlay('enter', root.dataset.ptDest || 'cd ~');
      requestAnimationFrame(() => {
        setTimeout(() => ov.classList.add('out'), 90);                                         // bar completes, letters lift away
        setTimeout(() => { root.classList.add('pt-go'); ov.classList.add('slide'); }, 300);   // panel slides off
        setTimeout(() => { ov.remove(); root.classList.remove('pt-enter', 'pt-go'); }, 300 + 720);
      });
    }
    // coming back via the back button restores the old page from cache: drop the cover
    addEventListener('pageshow', e => { if (e.persisted) { root.classList.remove('pt-leave', 'pt-enter', 'pt-go'); $$('.pt-ov').forEach(o => o.remove()); } });
    document.addEventListener('click', e => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest && e.target.closest('a[href]');
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      const raw = a.getAttribute('href');
      if (!raw || raw.startsWith('#') || /^(mailto|tel|javascript):/i.test(raw)) return;
      const u = new URL(a.href, location.href);
      if (u.origin !== location.origin && !(u.protocol === 'file:' && location.protocol === 'file:')) return;
      if (u.pathname === location.pathname && u.search === location.search && u.hash) return; // same-page anchor
      e.preventDefault();
      navigate(fixDir(a.href));
    });
  }

  // ---------- Public API ----------
  window.Site = { toast, copy, openPalette, party, url, LINKS, REGISTRY, reduceMotion, countUp, rel, section, isGamePlay, navigate: (h) => navigate(fixDir(new URL(h, location.href).href)), observeReveal: () => {} };

  // ---------- Boot ----------
  function boot() {
    setupPageTransitions();
    setupBackground();
    buildHeader();
    buildFooter();
    setupScroll();
    setupDots();
    setupExtras();
    setupMotion();
    setupReveal();
    setupSpotlight();
    setupPrefetch();
    setupLocalLinks();
    setupKeys();
    loadExtras();
    $$('[data-copy]').forEach(b => b.addEventListener('click', () => copy(b.dataset.copy, b.dataset.copyMsg || 'Copied')));
  }
  // extra site-wide modules: now-playing pill and the command line
  function loadExtras() {
    const v = scriptEl && scriptEl.src.includes('?') ? scriptEl.src.slice(scriptEl.src.indexOf('?')) : '';
    ['js/live.js', 'js/cli.js'].forEach(f => {
      if (document.body.hasAttribute('data-no-shell')) return;
      const s = document.createElement('script'); s.src = new URL(f, ROOT).href + v; s.async = false; document.body.appendChild(s);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
