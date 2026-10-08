/**
 * Home page: particle name, role ticker, live GitHub data,
 * contribution grid, Discord presence and the terminal.
 */
(function () {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const USER = 'Lukas200301';
  const DISCORD_ID = '364118506460938250';

  const cache = {
    get(k, ttl) {
      try { const v = JSON.parse(localStorage.getItem(k) || 'null'); if (v && Date.now() - v.t < ttl) return v.data; } catch (e) {}
      return null;
    },
    stale(k) { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v ? v.data : null; } catch (e) { return null; } },
    set(k, data) { try { localStorage.setItem(k, JSON.stringify({ t: Date.now(), data })); } catch (e) {} }
  };

  /* =======================================================
     1. Particle name
     ======================================================= */
  function particles() {
    const stage = $('.hero__stage');
    const nameEl = $('.hero__name');
    if (!stage || !nameEl || reduce) return;
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    stage.prepend(canvas);
    const ctx = canvas.getContext('2d');
    let W, H, dpr, P = null, count = 0, running = true, visible = true, raf;
    const mouse = { x: -9999, y: -9999, down: false };
    const COLORS = [[142, 162, 255], [179, 155, 255], [111, 216, 255]];

    function build() {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = r.width; H = r.height;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Draw the text off-screen exactly where the fallback text sits
      const cs = getComputedStyle(nameEl);
      const nr = nameEl.getBoundingClientRect();
      const ox = nr.left - r.left, oy = nr.top - r.top;
      const off = document.createElement('canvas');
      off.width = Math.ceil(W); off.height = Math.ceil(H);
      const o = off.getContext('2d');
      o.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      o.letterSpacing = cs.letterSpacing;
      o.textBaseline = 'alphabetic';
      o.fillStyle = '#fff';
      // place baseline: measure ascent
      const m = o.measureText(nameEl.textContent);
      const ascent = m.fontBoundingBoxAscent || parseFloat(cs.fontSize) * 0.8;
      const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize);
      const half = (lh - (ascent + (m.fontBoundingBoxDescent || 0))) / 2;
      o.fillText(nameEl.textContent, ox, oy + half + ascent);

      const fs = parseFloat(cs.fontSize);
      const gap = Math.max(3, Math.round(fs / 26));
      const data = o.getImageData(0, 0, off.width, off.height).data;
      const pts = [];
      // A cell becomes a particle when the glyph covers enough of it (not just its corner pixel),
      // so thin strokes like the slash in "0" never fall between sample points.
      const W0 = off.width, cellArea = gap * gap * 255;
      for (let y = 0; y + gap <= off.height; y += gap) {
        for (let x = 0; x + gap <= W0; x += gap) {
          let sum = 0;
          for (let yy = y; yy < y + gap; yy++) {
            let i = (yy * W0 + x) * 4 + 3;
            for (let xx = 0; xx < gap; xx++, i += 4) sum += data[i];
          }
          if (sum / cellArea > 0.3) pts.push(x, y);
        }
      }
      count = pts.length / 2;
      const prev = P;
      P = {
        hx: new Float32Array(count), hy: new Float32Array(count),
        x: new Float32Array(count), y: new Float32Array(count),
        vx: new Float32Array(count), vy: new Float32Array(count),
        c: new Uint8Array(count), s: gap * 0.62
      };
      let minX = Infinity, maxX = -Infinity;
      for (let i = 0; i < count; i++) { const x = pts[i * 2]; if (x < minX) minX = x; if (x > maxX) maxX = x; }
      for (let i = 0; i < count; i++) {
        const hx = pts[i * 2], hy = pts[i * 2 + 1];
        P.hx[i] = hx; P.hy[i] = hy;
        if (prev) { P.x[i] = hx; P.y[i] = hy; }
        else {
          // intro: particles stream in from a wide band below and left
          const a = Math.random() * Math.PI * 2, d = 200 + Math.random() * 500;
          P.x[i] = hx + Math.cos(a) * d; P.y[i] = hy + Math.sin(a) * d * 0.6;
        }
        const t = (hx - minX) / Math.max(1, maxX - minX);
        P.c[i] = Math.random() < 0.025 ? 3 : (t < 0.5 ? 0 : (t < 0.82 ? 1 : 2));
      }
      document.documentElement.classList.add('has-particles');
    }

    function frame() {
      if (!running) return;
      ctx.clearRect(0, 0, W, H);
      const s = P.s, R = Math.max(70, W / 14), R2 = R * R;
      const buckets = [[], [], [], []];
      for (let i = 0; i < count; i++) {
        let x = P.x[i], y = P.y[i];
        const dx = x - mouse.x, dy = y - mouse.y, d2 = dx * dx + dy * dy;
        if (d2 < R2) {
          const d = Math.sqrt(d2) || 1, f = (1 - d / R) * 5.5;
          P.vx[i] += (dx / d) * f; P.vy[i] += (dy / d) * f;
        }
        P.vx[i] += (P.hx[i] - x) * 0.055; P.vy[i] += (P.hy[i] - y) * 0.055;
        P.vx[i] *= 0.82; P.vy[i] *= 0.82;
        x += P.vx[i]; y += P.vy[i];
        P.x[i] = x; P.y[i] = y;
        buckets[P.c[i]].push(i);
      }
      const fills = ['rgb(142,162,255)', 'rgb(179,155,255)', 'rgb(111,216,255)', 'rgb(255,184,107)'];
      for (let b = 0; b < 4; b++) {
        ctx.fillStyle = fills[b];
        const arr = buckets[b];
        for (let k = 0; k < arr.length; k++) { const i = arr[k]; ctx.fillRect(P.x[i], P.y[i], s, s); }
      }
      raf = requestAnimationFrame(frame);
    }

    function burst(cx, cy) {
      for (let i = 0; i < count; i++) {
        const dx = P.x[i] - cx, dy = P.y[i] - cy, d = Math.hypot(dx, dy) || 1;
        const f = Math.max(0, 1 - d / 420) * 38;
        P.vx[i] += (dx / d) * f + (Math.random() - 0.5) * 4;
        P.vy[i] += (dy / d) * f + (Math.random() - 0.5) * 4;
      }
    }

    function local(e) { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
    canvas.addEventListener('pointermove', e => { [mouse.x, mouse.y] = local(e); });
    canvas.addEventListener('pointerleave', () => { mouse.x = mouse.y = -9999; });
    canvas.addEventListener('pointerdown', e => { const [x, y] = local(e); burst(x, y); });

    const start = () => { if (!running) { running = true; raf = requestAnimationFrame(frame); } };
    const stop = () => { running = false; cancelAnimationFrame(raf); };
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; visible && !document.hidden ? start() : stop(); }).observe(stage);
    document.addEventListener('visibilitychange', () => (document.hidden || !visible) ? stop() : start());
    let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(build, 150); });

    const go = () => { build(); running = true; raf = requestAnimationFrame(frame); };
    const fontSpec = `800 64px "Martian Mono"`;
    if (document.fonts && document.fonts.load) {
      Promise.race([document.fonts.load(fontSpec), new Promise(r => setTimeout(r, 1500))]).then(go);
    } else go();
  }

  /* =======================================================
     2. Role ticker
     ======================================================= */
  function roles() {
    const el = $('[data-roles]');
    if (!el) return;
    const list = ['full-stack developer', 'Raspberry Pi tinkerer', 'network nerd', 'builder of small tools', 'occasional game maker'];
    if (reduce) { el.textContent = list[0]; return; }
    let i = 0, n = 0, del = false;
    (function tick() {
      const w = list[i];
      n += del ? -1 : 1;
      el.textContent = w.slice(0, n);
      let t = del ? 28 : 55;
      if (!del && n === w.length) { del = true; t = 2200; }
      else if (del && n === 0) { del = false; i = (i + 1) % list.length; t = 350; }
      setTimeout(tick, t);
    })();
  }

  /* =======================================================
     3. GitHub
     ======================================================= */
  const LANG = { JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5', Java: '#b07219', 'C#': '#178600', 'C++': '#f34b7d', Go: '#00ADD8', Dart: '#00B4AB', HTML: '#e34c26', CSS: '#663399', Vue: '#41b883', Shell: '#89e051', PowerShell: '#012456', Kotlin: '#A97BFF', Rust: '#dea584', PHP: '#4F5D95', Lua: '#000080' };
  function ago(iso) {
    const s = (Date.now() - new Date(iso)) / 1000;
    const u = [[31536000, 'y'], [2592000, 'mo'], [604800, 'w'], [86400, 'd'], [3600, 'h'], [60, 'm']];
    for (const [sec, l] of u) if (s >= sec) return Math.floor(s / sec) + l + ' ago';
    return 'just now';
  }
  function countUp(el, to) {
    if (reduce || !isFinite(to)) { el.textContent = to.toLocaleString('en'); return; }
    const t0 = performance.now(), dur = 1400;
    (function f(t) {
      const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 4);
      el.textContent = Math.round(to * e).toLocaleString('en');
      if (p < 1) requestAnimationFrame(f);
    })(t0);
  }
  function whenVisible(el, fn) {
    if (!el) return;
    const io = new IntersectionObserver(([en]) => { if (en.isIntersecting) { io.disconnect(); fn(); } }, { threshold: 0.3 });
    io.observe(el);
  }

  async function getJSON(u) { const r = await fetch(u); if (!r.ok) throw new Error(r.status); return r.json(); }

  async function github() {
    const statsEl = $('#ghStats');
    if (!statsEl && !$('#repoList')) return;
    let repos = cache.get('gh-repos-v2', 10 * 60e3), user = cache.get('gh-user-v2', 10 * 60e3);
    try {
      if (!repos) { repos = (await getJSON(`https://api.github.com/users/${USER}/repos?per_page=100&sort=pushed`)).filter(r => !r.fork); cache.set('gh-repos-v2', repos.map(slim)); }
      if (!user) { user = await getJSON(`https://api.github.com/users/${USER}`); cache.set('gh-user-v2', { public_repos: user.public_repos, followers: user.followers, created_at: user.created_at }); }
    } catch (e) {
      repos = repos || cache.stale('gh-repos-v2');
      user = user || cache.stale('gh-user-v2');
    }
    function slim(r) { return { name: r.name, description: r.description, html_url: r.html_url, language: r.language, stargazers_count: r.stargazers_count, forks_count: r.forks_count, pushed_at: r.pushed_at, topics: r.topics || [], archived: r.archived }; }

    const stars = repos ? repos.reduce((a, r) => a + (r.stargazers_count || 0), 0) : null;
    const vals = {
      repos: repos ? repos.length : null,
      stars,
      followers: user ? user.followers : null
    };
    whenVisible(statsEl, () => {
      for (const k in vals) {
        const el = $(`[data-stat="${k}"]`);
        if (!el) continue;
        if (vals[k] == null) el.textContent = '—'; else countUp(el, vals[k]);
      }
    });

    const list = $('#repoList');
    if (!list) return;
    if (!repos || !repos.length) {
      list.innerHTML = `<p style="color:var(--fg-3)">GitHub didn't answer just now (rate limit). <a class="text-link" href="https://github.com/${USER}?tab=repositories" target="_blank" rel="noopener">See repositories on GitHub</a></p>`;
      return;
    }
    const recent = repos.slice().sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at)).slice(0, 6);
    list.innerHTML = recent.map(r => `
      <a class="repo" href="${esc(r.html_url)}" target="_blank" rel="noopener">
        <span class="repo__name">${esc(r.name)}</span>
        <span class="repo__meta">
          ${r.language ? `<span><i class="lang-dot" style="background:${LANG[r.language] || '#8ea2ff'}"></i>${esc(r.language)}</span>` : ''}
          ${r.stargazers_count ? `<span><i class="fas fa-star"></i> ${r.stargazers_count}</span>` : ''}
          <span>${ago(r.pushed_at)}</span>
        </span>
        <span class="repo__desc">${esc(r.description || 'No description')}</span>
      </a>`).join('');
    Array.from(list.children).forEach((row, i) => {
      row.setAttribute('data-reveal', 'left'); row.style.setProperty('--i', i);
      if (window.Site && window.Site.observeReveal) window.Site.observeReveal(row);
    });
  }

  async function visitors() {
    const el = $('[data-stat="visitors"]');
    if (!el) return;
    try {
      const d = await getJSON('https://lukas200301-counter.vercel.app/api/counter');
      whenVisible(el, () => countUp(el, Number(d.count) || 0));
    } catch (e) { el.textContent = '—'; }
  }

  /* Contribution grid, drawn in the site's own colours */
  async function contributions() {
    const box = $('#contrib');
    if (!box) return;
    let data = cache.get('gh-contrib-v1', 6 * 3600e3);
    try {
      if (!data) {
        const j = await getJSON(`https://github-contributions-api.jogruber.de/v4/${USER}?y=last`);
        data = { total: j.total && (j.total.lastYear ?? Object.values(j.total)[0]), days: j.contributions.map(d => [d.date, d.count, d.level]) };
        cache.set('gh-contrib-v1', data);
      }
    } catch (e) { data = cache.stale('gh-contrib-v1'); }
    if (!data || !data.days || !data.days.length) {
      box.closest('.gh-panel').querySelector('h3 span').textContent = '';
      box.innerHTML = `<img src="https://ghchart.rshah.org/8ea2ff/${USER}" alt="GitHub contribution chart" loading="lazy" style="filter:invert(.92) hue-rotate(180deg)">`;
      return;
    }
    const days = data.days;
    const first = new Date(days[0][0]).getDay();
    const cols = Math.ceil((days.length + first) / 7);
    const cell = 11, g = 3;
    const W = cols * (cell + g), H = 7 * (cell + g);
    const shades = ['rgba(142,162,255,0.08)', 'rgba(142,162,255,0.32)', 'rgba(142,162,255,0.55)', 'rgba(142,162,255,0.8)', '#ffb86b'];
    let rects = '';
    days.forEach((d, i) => {
      const idx = i + first, c = Math.floor(idx / 7), r = idx % 7;
      rects += `<rect x="${c * (cell + g)}" y="${r * (cell + g)}" width="${cell}" height="${cell}" rx="2.5" fill="${shades[d[2]] || shades[0]}" style="--d:${c * 14}ms"><title>${d[1]} contribution${d[1] === 1 ? '' : 's'} on ${d[0]}</title></rect>`;
    });
    box.innerHTML = `<svg class="contrib-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Contribution calendar for the last year">${rects}</svg>`;
    const lbl = box.closest('.gh-panel').querySelector('h3 span');
    if (lbl && data.total != null) lbl.textContent = `${Number(data.total).toLocaleString('en')} in the last year`;
    whenVisible(box, () => box.classList.add('is-in'));
  }

  /* =======================================================
     4. Discord presence (Lanyard)
     ======================================================= */
  async function presence() {
    const card = $('#presence');
    if (!card) return;
    const dot = $('.presence__dot', card), status = $('.presence__status', card), act = $('.presence__activity', card), avatar = $('.presence__avatar img', card), name = $('.presence__name', card);
    const labels = { online: 'Online on Discord', idle: 'Away on Discord', dnd: 'Do not disturb', offline: 'Offline on Discord' };
    let timer;
    async function load() {
      try {
        const { data } = await getJSON(`https://api.lanyard.rest/v1/users/${DISCORD_ID}`);
        const u = data.discord_user;
        if (u.avatar) avatar.src = `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=96`;
        name.textContent = u.global_name || u.display_name || u.username;
        dot.dataset.s = data.discord_status;
        const custom = (data.activities || []).find(a => a.type === 4);
        status.textContent = custom && custom.state ? custom.state : labels[data.discord_status] || 'Discord';
        clearInterval(timer);
        if (data.listening_to_spotify && data.spotify) {
          const s = data.spotify;
          act.innerHTML = `<img src="${esc(s.album_art_url)}" alt=""><div><b>${esc(s.song)}</b><span>${esc(s.artist)}</span><div class="presence__bar"><i></i></div></div>`;
          const bar = $('.presence__bar i', act);
          const upd = () => { const p = (Date.now() - s.timestamps.start) / (s.timestamps.end - s.timestamps.start); bar.style.width = Math.max(0, Math.min(100, p * 100)) + '%'; };
          upd(); timer = setInterval(upd, 1000);
        } else {
          const a = (data.activities || []).find(a => a.type !== 4);
          if (a) {
            let img = '';
            const li = a.assets && a.assets.large_image;
            if (li) img = li.startsWith('mp:') ? `https://media.discordapp.net/${li.slice(3)}` : `https://cdn.discordapp.com/app-assets/${a.application_id}/${li}.png`;
            const verb = ['Playing', 'Streaming', 'Listening to', 'Watching', '', 'Competing in'][a.type] || 'Using';
            act.innerHTML = `${img ? `<img src="${esc(img)}" alt="">` : '<span class="pa-icon"><i class="fas fa-gamepad"></i></span>'}<div><b>${esc(verb)} ${esc(a.name)}</b><span>${esc(a.details || a.state || '')}</span></div>`;
          } else {
            act.innerHTML = `<span class="pa-icon"><i class="fas fa-mug-hot"></i></span><div><b>Nothing running right now</b><span>Say hi: iamlukas.</span></div>`;
          }
        }
      } catch (e) {
        status.textContent = 'Discord: iamlukas.';
        act.innerHTML = `<span class="pa-icon"><i class="fab fa-discord"></i></span><div><b>Live status unavailable</b><span>Add me on Discord: iamlukas.</span></div>`;
      }
    }
    load();
    setInterval(() => { if (!document.hidden) load(); }, 30000);
  }

  /* =======================================================
     5. Terminal
     ======================================================= */
  function terminal() {
    const body = $('#termBody');
    const input = $('#termInput');
    if (!body || !input) return;
    const out = $('#termOut');
    const R = window.Site ? window.Site.REGISTRY : [];
    const url = (p) => (window.Site ? window.Site.url(p) : p);
    const hist = []; let hi = 0;

    const print = (html, cls = '') => { const d = document.createElement('div'); d.className = 'term__line ' + cls; d.innerHTML = html; out.appendChild(d); body.scrollTop = body.scrollHeight; };
    const list = (group) => R.filter(r => r.group === group).map(r => `  <a href="${url(r.href)}">${esc(r.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}</a>  <span class="m">${esc(r.sub)}</span>`).join('\n');
    const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const cmds = {
      help: () => `<span class="d">Available commands</span>
  <span class="a">whoami</span>      who is this
  <span class="a">projects</span>    things I've shipped
  <span class="a">tools</span>       browser utilities
  <span class="a">games</span>       play something
  <span class="a">stats</span>       GitHub activity in charts
  <span class="a">cli</span>         full-screen terminal for the whole site
  <span class="a">open</span> &lt;name&gt; open a project, tool or game
  <span class="a">stack</span>       what I build with
  <span class="a">socials</span>     where to find me
  <span class="a">discord</span>     copy my Discord username
  <span class="a">clear</span>       clear the screen
<span class="m">Tip: Tab completes, ↑ ↓ walk history.</span>`,
      whoami: () => `lukas200301 — developer who builds the tools he wants to use:
a Raspberry Pi controller, a network monitor, and a bunch of small
web tools and games that live on this site.`,
      about: () => cmds.whoami(),
      projects: () => list('Projects') + `\n  <a href="${url('projects/')}">all-projects</a>  <span class="m">every GitHub repo</span>`,
      tools: () => list('Tools'),
      games: () => list('Games'),
      cli: () => { setTimeout(() => window.CLI && window.CLI.open(), 150); return '<span class="m">opening the full-screen terminal… (works on every page: key left of 1)</span>'; },
      fullscreen: () => cmds.cli(),
      stats: () => { setTimeout(() => window.Site ? Site.navigate(url('stats/')) : (location.href = url('stats/')), 350); return '<span class="m">→ stats/</span>'; },
      ls: () => '<span class="d">projects/  tools/  games/  stats/</span>  README.md',
      'cat': (a) => a[0] && a[0].toLowerCase() === 'readme.md' ? cmds.whoami() : `cat: ${esc(a[0] || '')}: No such file`,
      cd: (a) => {
        const t = (a[0] || '').replace(/\/$/, '');
        if (['projects', 'tools', 'games', 'stats'].includes(t)) { setTimeout(() => window.Site ? Site.navigate(url(t + '/')) : (location.href = url(t + '/')), 350); return `<span class="m">→ ${t}/</span>`; }
        if (!t || t === '~' || t === '..') return '';
        return `cd: ${esc(t)}: No such directory`;
      },
      open: (a) => {
        const q = slug(a.join(' '));
        if (!q) return 'usage: open &lt;name&gt; — try <span class="a">open tetris</span>';
        const hit = R.find(r => r.href && slug(r.title) === q) || R.find(r => r.href && slug(r.title).includes(q));
        if (!hit) return `open: nothing called “${esc(a.join(' '))}”. Try <span class="a">tools</span> or <span class="a">games</span>.`;
        setTimeout(() => window.Site ? Site.navigate(url(hit.href)) : (location.href = url(hit.href)), 350);
        return `<span class="m">opening ${esc(hit.title)}…</span>`;
      },
      stack: () => `<span class="d">frontend</span>  HTML, CSS, JavaScript, TypeScript, Vue, Nuxt
<span class="d">backend</span>   Node.js, Python, Java, C#, Go, Dart/Flutter
<span class="d">ops</span>       Linux, Docker, Grafana, MySQL, GitHub`,
      socials: () => `github     <a href="https://github.com/Lukas200301" target="_blank" rel="noopener">github.com/Lukas200301</a>
instagram  <a href="https://instagram.com/Lukas200103" target="_blank" rel="noopener">@Lukas200103</a>
discord    iamlukas.  <span class="m">(type “discord” to copy)</span>`,
      github: () => { window.open('https://github.com/Lukas200301', '_blank', 'noopener'); return '<span class="m">opening GitHub…</span>'; },
      discord: () => { window.Site && window.Site.copy('iamlukas.', 'Discord username copied'); return 'copied <span class="a">iamlukas.</span> to your clipboard'; },
      date: () => new Date().toString(),
      echo: (a) => esc(a.join(' ')),
      sudo: () => `<span class="a">lukas200301 is not in the sudoers file. This incident will be reported.</span>`,
      party: () => { window.Site && window.Site.party(); return '🎉'; },
      exit: () => 'There is no escape. Try <span class="a">games</span> instead.',
      clear: () => { out.innerHTML = ''; return null; }
    };
    const names = Object.keys(cmds);

    function run(raw) {
      const line = raw.trim();
      print(`<span class="p">guest@lukas200301</span>:<span class="d">~</span>$ ${esc(line)}`);
      if (!line) return;
      hist.push(line); hi = hist.length;
      const [c, ...args] = line.split(/\s+/);
      const fn = cmds[c.toLowerCase()];
      const res = fn ? fn(args) : `command not found: ${esc(c)} — type <span class="a">help</span>`;
      if (res) print(res);
    }

    print(`<span class="d">lukas200301 shell</span> <span class="m">v2 — type</span> <span class="a">help</span> <span class="m">to look around</span>`);

    body.addEventListener('click', e => { if (!e.target.closest('a') && !getSelection().toString()) input.focus({ preventScroll: true }); });
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { run(input.value); input.value = ''; }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (hi > 0) input.value = hist[--hi]; }
      else if (e.key === 'ArrowDown') { e.preventDefault(); hi = Math.min(hist.length, hi + 1); input.value = hist[hi] || ''; }
      else if (e.key === 'Tab') {
        e.preventDefault();
        const v = input.value.trim().toLowerCase();
        const parts = v.split(/\s+/);
        if (parts.length === 1) {
          const m = names.filter(n => n.startsWith(v));
          if (m.length === 1) input.value = m[0] + ' ';
          else if (m.length) print(m.join('  '), 'm');
        } else if (parts[0] === 'open') {
          const q = parts.slice(1).join('-');
          const m = R.filter(r => r.href && slug(r.title).startsWith(q)).map(r => slug(r.title));
          if (m.length === 1) input.value = 'open ' + m[0];
          else if (m.length) print(m.join('  '), 'm');
        }
      } else if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); out.innerHTML = ''; }
    });

    // Demo: type “help” once the terminal scrolls into view (only once)
    whenVisible(body, () => {
      if (reduce || input.value) return;
      const word = 'help'; let i = 0;
      const t = setInterval(() => {
        if (document.activeElement === input && input.value && i === 0) { clearInterval(t); return; }
        input.value = word.slice(0, ++i);
        if (i === word.length) { clearInterval(t); setTimeout(() => { run(input.value); input.value = ''; }, 380); }
      }, 110);
    });

    document.querySelectorAll('[data-focus-term]').forEach(b => b.addEventListener('click', () => {
      document.getElementById('connect').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
      setTimeout(() => input.focus({ preventScroll: true }), 500);
    }));
  }


  /* =======================================================
     6. Live monitor: real measurements of this browser, refreshed every 500 ms
     ======================================================= */
  function monitor() {
    const root = $('#mon');
    if (!root) return;
    const T0 = performance.now();
    const R = 50, C = 2 * Math.PI * R, ARC = 0.75;           // gauges use 3/4 of a circle
    const setGauge = (el, frac) => {
      el.style.strokeDasharray = `${C * ARC} ${C}`;
      el.style.strokeDashoffset = (C * ARC * (1 - Math.max(0, Math.min(1, frac)))).toFixed(1);
    };
    ['#gFps', '#gLag', '#gScroll'].forEach(id => { const g = $(id); g.style.strokeDasharray = `${C * ARC} ${C}`; g.style.strokeDashoffset = (C * ARC).toFixed(1); });
    $$('.gauge__track', root).forEach(t => { t.style.strokeDasharray = `${C * ARC} ${C}`; });

    // host label from the browser itself
    const ua = navigator.userAgent;
    const browser = /Edg\//.test(ua) ? 'edge' : /OPR\//.test(ua) ? 'opera' : /Firefox\//.test(ua) ? 'firefox' : /Chrome\//.test(ua) ? 'chrome' : /Safari\//.test(ua) ? 'safari' : 'browser';
    const os = /Windows/.test(ua) ? 'windows' : /Android/.test(ua) ? 'android' : /iPhone|iPad/.test(ua) ? 'ios' : /Mac OS/.test(ua) ? 'macos' : /Linux/.test(ua) ? 'linux' : 'device';
    $('#monHost').textContent = `${browser}@${os}`;

    // frame rate (rAF) and main-thread delay (how late a 50 ms timer fires)
    let frames = 0, fps = 0, lastFpsT = performance.now();
    (function rafLoop(t) { frames++; requestAnimationFrame(rafLoop); })(0);
    let lagSamples = [], expect = performance.now() + 50;
    setInterval(() => { const now = performance.now(); lagSamples.push(Math.max(0, now - expect)); expect = now + 50; if (lagSamples.length > 20) lagSamples.shift(); }, 50);

    // interaction counters
    let clicks = 0, keys = 0, scrolled = 0, lastY = scrollY;
    addEventListener('click', () => clicks++, true);
    addEventListener('keydown', () => keys++, true);
    addEventListener('scroll', () => { scrolled += Math.abs(scrollY - lastY); lastY = scrollY; }, { passive: true });

    // optional browser APIs (only shown where the browser supports them)
    let battery = null;
    if (navigator.getBattery) navigator.getBattery().then(b => { battery = b; }).catch(() => {});
    const conn = navigator.connection;

    const history = [];
    const chart = $('#monChart'), cx = chart.getContext('2d');
    function drawChart() {
      const dpr = Math.min(2, devicePixelRatio || 1);
      const w = chart.clientWidth, h = chart.clientHeight;
      if (chart.width !== Math.round(w * dpr)) { chart.width = Math.round(w * dpr); chart.height = Math.round(h * dpr); }
      cx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx.clearRect(0, 0, w, h);
      const max = Math.max(60, ...history, 1), N = 120;
      // grid lines
      cx.strokeStyle = 'rgba(142,162,255,0.08)'; cx.lineWidth = 1;
      for (let k = 1; k < 4; k++) { const y = Math.round(h * k / 4) + 0.5; cx.beginPath(); cx.moveTo(0, y); cx.lineTo(w, y); cx.stroke(); }
      if (history.length < 2) return;
      const step = w / (N - 1), x0 = w - (history.length - 1) * step;
      const pts = history.map((v, k) => [x0 + k * step, h - 6 - (v / max) * (h - 14)]);
      const g = cx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, 'rgba(142,162,255,0.35)'); g.addColorStop(1, 'rgba(142,162,255,0)');
      cx.beginPath(); cx.moveTo(pts[0][0], h);
      pts.forEach(p => cx.lineTo(p[0], p[1]));
      cx.lineTo(pts[pts.length - 1][0], h); cx.closePath(); cx.fillStyle = g; cx.fill();
      cx.beginPath(); pts.forEach((p, k) => k ? cx.lineTo(p[0], p[1]) : cx.moveTo(p[0], p[1]));
      const lg = cx.createLinearGradient(0, 0, w, 0); lg.addColorStop(0, '#8ea2ff'); lg.addColorStop(1, '#ffb86b');
      cx.strokeStyle = lg; cx.lineWidth = 2; cx.lineJoin = 'round'; cx.stroke();
      const last = pts[pts.length - 1];
      cx.fillStyle = '#ffb86b'; cx.beginPath(); cx.arc(last[0], last[1], 3.5, 0, Math.PI * 2); cx.fill();
      cx.fillStyle = 'rgba(255,184,107,0.25)'; cx.beginPath(); cx.arc(last[0], last[1], 8, 0, Math.PI * 2); cx.fill();
    }

    const stats = $('#monStats');
    const fmtTime = s => { const m = Math.floor(s / 60), h = Math.floor(m / 60); return h ? `${h}:${String(m % 60).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}` : `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`; };
    const prev = {};
    function row(key, icon, label, value) {
      return `<div><dt><i class="${icon}"></i>${label}</dt><dd data-k="${key}">${value}</dd></div>`;
    }
    function renderStats() {
      const rows = [
        ['cpu', 'fas fa-microchip', 'CPU threads', navigator.hardwareConcurrency || '—'],
        ['scr', 'fas fa-display', 'Screen', `${screen.width}×${screen.height} @${(devicePixelRatio || 1).toFixed(2).replace(/\.?0+$/, '')}x`],
        ['vp', 'fas fa-expand', 'Viewport', `${innerWidth}×${innerHeight}`],
      ];
      if (performance.memory) rows.push(['mem', 'fas fa-memory', 'JS memory', `${(performance.memory.usedJSHeapSize / 1048576).toFixed(1)} MB`]);
      else if (navigator.deviceMemory) rows.push(['mem', 'fas fa-memory', 'Device memory', `≈${navigator.deviceMemory} GB`]);
      if (conn && conn.effectiveType) rows.push(['net', 'fas fa-wifi', 'Network', `${conn.effectiveType}${conn.downlink ? ' · ' + conn.downlink + ' Mb/s' : ''}`]);
      if (battery) rows.push(['bat', battery.charging ? 'fas fa-plug' : 'fas fa-battery-half', 'Battery', `${Math.round(battery.level * 100)}%${battery.charging ? ' charging' : ''}`]);
      rows.push(['dist', 'fas fa-arrows-up-down', 'Scrolled', scrolled > 26458 ? `${(scrolled / 3780).toFixed(1)} m` : `${(scrolled / 37.8).toFixed(0)} cm`]);
      rows.push(['clk', 'fas fa-computer-mouse', 'Clicks · keys', `${clicks} · ${keys}`]);
      if (!stats.childElementCount || stats.childElementCount !== rows.length) {
        stats.innerHTML = rows.map(r => row(...r)).join('');
      } else {
        rows.forEach(([k, , , v]) => {
          const dd = stats.querySelector(`dd[data-k="${k}"]`);
          if (dd && dd.textContent !== String(v)) { dd.textContent = v; if (prev[k] !== undefined) { dd.classList.add('tick'); requestAnimationFrame(() => requestAnimationFrame(() => dd.classList.remove('tick'))); } }
        });
      }
      rows.forEach(([k, , , v]) => { prev[k] = v; });
    }

    let visible = false;
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(root);
    const shown = { fps: 0, lag: 0, sc: 0 };
    const animNum = (el, from, to, fmt) => {
      if (reduce) { el.textContent = fmt(to); return; }
      const t0 = performance.now();
      (function f(t) { const p = Math.min(1, (t - t0) / 450), v = from + (to - from) * (1 - Math.pow(1 - p, 3)); el.textContent = fmt(v); if (p < 1) requestAnimationFrame(f); })(t0);
    };

    function tick() {
      const now = performance.now();
      fps = frames * 1000 / (now - lastFpsT); frames = 0; lastFpsT = now;
      history.push(Math.round(fps)); if (history.length > 120) history.shift();
      $('#monUptime').textContent = fmtTime((now - T0) / 1000);
      if (!visible) return;                   // measure always, draw only when on screen
      const lag = lagSamples.length ? lagSamples.reduce((a, b) => a + b, 0) / lagSamples.length : 0;
      const max = document.documentElement.scrollHeight - innerHeight;
      const sc = max > 0 ? Math.round(scrollY / max * 100) : 0;
      animNum($('#vFps'), shown.fps, Math.round(fps), v => Math.round(v)); shown.fps = Math.round(fps);
      animNum($('#vLag'), shown.lag, lag, v => v < 10 ? v.toFixed(1) : Math.round(v)); shown.lag = lag;
      animNum($('#vScroll'), shown.sc, sc, v => Math.round(v)); shown.sc = sc;
      setGauge($('#gFps'), fps / Math.max(60, Math.max(...history)));
      setGauge($('#gLag'), lag / 50);
      setGauge($('#gScroll'), sc / 100);
      const lo = Math.min(...history), hi = Math.max(...history);
      $('#monFpsRange').textContent = `min ${lo} · max ${hi} fps`;
      drawChart();
      renderStats();
    }
    setInterval(tick, 500);
    addEventListener('resize', drawChart);
    setTimeout(tick, 200);
  }

  /* ======================================================= */
  function boot() {
    particles();
    roles();
    github();
    visitors();
    contributions();
    presence();
    terminal();
    monitor();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
