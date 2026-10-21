/* Site-wide command line (loaded by js/script.js).
   Open with the key left of 1 (` on US, ^ on German keyboards), the >_ button in the header or Ctrl+K → "command line".
   The site is a file system: ~/projects, ~/tools/<name>, ~/games/<name>, ~/stats. `cd` navigates and the
   terminal stays open on the next page, with its scrollback and history, so you can browse without a mouse.
   It also hosts a small capture-the-flag game (`ctf`) in a virtual folder, ~/ctf, that only exists in this shell. */
(function () {
  'use strict';
  if (window.CLI) return;
  const Site = window.Site;
  if (!Site) return;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const KEY = 'cli-state';
  const HOST = 'lukas200301';
  const R = Site.REGISTRY || [];

  // ---------- the site as a file system ----------
  const slugOf = (href) => href.replace(/\/$/, '').split('/').pop();
  const DIRS = { projects: 'Projects', tools: 'Tools', games: 'Games' };
  const nodes = {};   // path → { path, title, sub, href, kind, children }
  nodes[''] = { path: '', title: 'Home', sub: 'Start page', href: '', kind: 'dir', children: [] };
  Object.keys(DIRS).forEach(d => { nodes[d] = { path: d, title: DIRS[d], sub: (R.find(r => r.href === d + '/') || {}).sub || '', href: d + '/', kind: 'dir', children: [] }; nodes[''].children.push(d); });
  nodes.stats = { path: 'stats', title: 'Stats', sub: 'GitHub activity in charts', href: 'stats/', kind: 'page', children: [] };
  nodes[''].children.push('stats');
  R.forEach(r => {
    if (!r.href || !/^(projects|tools|games)\/.+/.test(r.href)) return;
    const dir = r.href.split('/')[0], p = dir + '/' + slugOf(r.href);
    nodes[p] = { path: p, title: r.title, sub: r.sub, href: r.href, kind: 'page', group: r.group, keys: r.keys || '', children: [] };
    nodes[dir].children.push(p);
  });
  const here = (() => {
    let p = (Site.rel || '').replace(/index\.html$/, '').replace(/\/$/, '');
    while (p && !nodes[p]) p = p.split('/').slice(0, -1).join('/');
    return p;
  })();
  const disp = (p) => '~' + (p ? '/' + p : '');
  function resolve(arg, from = here) {
    if (arg == null || arg === '' || arg === '~' || arg === '~/') return '';
    let parts = arg.startsWith('~') ? arg.slice(1).split('/') : arg.startsWith('/') ? arg.split('/') : (from ? from.split('/') : []).concat(arg.split('/'));
    const out = [];
    for (const s of parts) { if (!s || s === '.') continue; if (s === '..') out.pop(); else out.push(s.toLowerCase()); }
    const p = out.join('/');
    if (nodes[p]) return p;
    // tolerate typos in the last part: unique prefix match among siblings
    const parent = out.slice(0, -1).join('/'), last = out[out.length - 1];
    if (nodes[parent]) { const hits = nodes[parent].children.filter(c => c.split('/').pop().startsWith(last)); if (hits.length === 1) return hits[0]; }
    return null;
  }
  function fuzzy(q) {
    q = q.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (!q) return [];
    const flat = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ');
    return Object.values(nodes).filter(n => n.path).map(n => {
      const name = n.path.split('/').pop().replace(/-/g, ' '), t = flat(n.title), hay = `${t} ${name} ${flat(n.sub || '')} ${n.keys || ''}`;
      const score = name === q || t === q ? 100 : name.startsWith(q) || t.startsWith(q) ? 60 : hay.includes(q) ? 30 : q.split(' ').every(w => hay.includes(w)) ? 15 : 0;
      return { n, score };
    }).filter(x => x.score).sort((a, b) => b.score - a.score || a.n.path.length - b.n.path.length).map(x => x.n);
  }

  // ---------- state (survives page changes in this tab) ----------
  let st = { open: false, lines: [], hist: [], booted: false, vcwd: '' };
  try { st = Object.assign(st, JSON.parse(sessionStorage.getItem(KEY) || '{}')); } catch (e) {}
  st.lines = (st.lines || []).map(([c, h]) => [c, String(h).replace(/lukas@lukas200301/g, 'guest@lukas200301')]);
  const save = () => { try { st.lines = st.lines.slice(-300); st.hist = st.hist.slice(-100); sessionStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} };
  // the working directory: a site page (here) or, inside the CTF, a virtual folder under ~/ctf (only valid on the page it was entered on)
  if (st.vcwd && st.vpage !== Site.rel) st.vcwd = '';
  const cwd = () => st.vcwd || here;

  // ---------- DOM ----------
  // One session, up to two windows: the full-screen overlay (every page) and, where a page has a [data-cli-embed]
  // block (the home page), the same shell embedded in the page. Both show the same scrollback and history.
  // if we arrived from a cd, the inline <head> script already drew the overlay (with scrollback) before the first paint
  const pre = document.querySelector('.cli[data-pre]');
  const root = pre || document.createElement('div');
  if (!pre) {
  root.className = 'cli';
  root.hidden = true;
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Command line');
  root.innerHTML = `
    <div class="cli__win">
      <div class="cli__bar"><span class="cli__dots"><i></i><i></i><i></i></span><span class="cli__title"></span><button class="cli__close" type="button" aria-label="Close command line"><i class="fas fa-xmark"></i></button></div>
      <div class="cli__body" tabindex="-1">
        <div class="cli__out" aria-live="polite"></div>
        <form class="cli__line" autocomplete="off"><label class="cli__ps"></label><input class="cli__in" type="text" spellcheck="false" autocapitalize="off" autocorrect="off" aria-label="Command"><span class="cli__ghost" aria-hidden="true"></span></form>
      </div>
      <div class="cli__hint"><span><kbd>Tab</kbd> complete</span><span><kbd>↑</kbd><kbd>↓</kbd> history</span><span><kbd>Ctrl</kbd><kbd>L</kbd> clear</span><span><kbd>Esc</kbd> close</span></div>
    </div>`;
  }
  const viewOf = (el, embedded) => ({ root: el, embedded, out: el.querySelector('.cli__out'), input: el.querySelector('.cli__in'), body: el.querySelector('.cli__body'), ghost: el.querySelector('.cli__ghost'), psEl: el.querySelector('.cli__ps'), titleEl: el.querySelector('.cli__title'), hIdx: -1, draft: '' });
  const ov = viewOf(root, false);
  const emEl = document.querySelector('[data-cli-embed]');
  const em = emEl ? viewOf(emEl, true) : null;
  const views = em ? [ov, em] : [ov];
  let V = ov;   // the window the current command was typed in
  const { input, body } = ov;
  const psFor = (p) => `<span class="u">guest@${HOST}</span>:<span class="p">${esc(disp(p))}</span>$`;
  const titleFor = (p) => `guest@${HOST}: ${disp(p)} — lsh`;
  const ps = () => psFor(cwd());
  views.forEach(v => { v.psEl.innerHTML = ps(); if (v.titleEl) v.titleEl.textContent = titleFor(cwd()); });
  // the prompt's width, so the completion ghost lines up behind the typed text
  const measure = (v) => v.root.style.setProperty('--ps-w', v.psEl.offsetWidth + 'px');

  function print(html, cls = '') {
    views.forEach(v => {
      const d = document.createElement('div'); d.className = 'cli__ln ' + cls; d.innerHTML = html;
      if (v === ov ? shown : true) { d.classList.add('new'); d.addEventListener('animationend', () => d.classList.remove('new'), { once: true }); }
      v.out.appendChild(d);
      v.body.scrollTop = v.body.scrollHeight;
    });
    st.lines.push([cls, html]); save();
  }
  const link = (p, label) => `<a href="${esc(Site.url(nodes[p].href))}" data-cd="${esc(p)}">${esc(label || p.split('/').pop() || '~')}</a>`;

  // ---------- commands ----------
  const BANNER = String.raw`
 _       _             ____   ___   ___ _____  ___  _
| |_   _| | ____ _ ___|___ \ / _ \ / _ \___ / / _ \/ |
| | | | | |/ / _' / __| __) | | | | | | ||_ \| | | | |
| | |_| |   < (_| \__ \/ __/| |_| | |_| |__) | |_| | |
|_|\__,_|_|\_\__,_|___/_____|\___/ \___/____/ \___/|_|`;
  // keep the window on screen while the page transition plays behind it
  function leaveWith(p, fn) {
    // the embedded window just navigates; the session is waiting in the full-screen one on the next page
    if (V.embedded) { V.input.blur(); setTimeout(fn, 220); return; }
    st.open = true; st.ps = p == null ? '' : psFor(p); st.title = p == null ? '' : titleFor(p); save();
    try { sessionStorage.setItem('cli-nav', '1'); } catch (e) {}
    root.classList.remove('instant');
    root.classList.add('cli--nav');
    if (p != null) { ov.psEl.innerHTML = psFor(p); ov.titleEl.textContent = titleFor(p); measure(ov); }
    input.blur();
    setTimeout(fn, 220);
  }
  function go(p, msg) {
    if (p === here) { if (st.vcwd) { setV(''); return ''; } return `<span class="m">already in ${esc(disp(p))}</span>`; }
    if (st.vcwd) { st.vcwd = ''; save(); }
    leaveWith(p, () => Site.navigate(Site.url(nodes[p].href)));
    return `<span class="m">${msg || '→'} ${esc(disp(p))}</span>`;
  }
  // extra entries in ~: the CTF folder (once the game was started, or with -a) and the old .secret easter egg (-a)
  function homeExtras(all) {
    const x = [];
    if (all) x.push({ name: '.secret', html: '.secret', dir: false, sub: '' });
    if (all || ctfP().started) x.push({ name: 'ctf', html: `<span class="d">${vlink('ctf', 'ctf/')}</span>`, dir: true, sub: 'capture the flag (type ctf)' });
    return x;
  }
  function lsOf(p, long, all, plain) {
    const n = nodes[p];
    const ex = p === '' && !plain ? homeExtras(all) : [];
    if (ex.length) {
      const base = lsOf(p, long, false, true);
      if (!long) return base + '  ' + ex.map(e => e.html).join('  ');
      const w = Math.max(...n.children.map(c => c.split('/').pop().length)) + 2;
      return base + '\n' + ex.map(e => `${e.dir ? 'drwxr-xr-x' : '-rw-r--r--'}  ${e.html}${' '.repeat(Math.max(1, w - e.name.length - (e.dir ? 1 : 0)))}<span class="m">${esc(e.sub)}</span>`).join('\n');
    }
    if (!n.children.length) return `<span class="m">${esc(n.title)}: ${esc(n.sub || 'a page')}. Type <span class="a">cd ${esc(p.split('/').pop())}</span> to open it.</span>`;
    if (!long) return n.children.map(c => nodes[c].children.length || nodes[c].kind === 'dir' ? `<span class="d">${link(c, c.split('/').pop() + '/')}</span>` : link(c)).join('  ');
    const w = Math.max(...n.children.map(c => c.split('/').pop().length)) + 2;
    return n.children.map(c => { const name = c.split('/').pop(), isDir = nodes[c].kind === 'dir'; return `${isDir ? 'drwxr-xr-x' : '-rw-r--r--'}  ${isDir ? `<span class="d">${link(c, name + '/')}</span>` : link(c, name)}${' '.repeat(Math.max(1, w - name.length - (isDir ? 1 : 0)))}<span class="m">${esc(nodes[c].sub || '')}</span>`; }).join('\n');
  }
  function treeOf(p = '', pre = '') {
    const kids = nodes[p].children;
    return kids.map((c, i) => { const last = i === kids.length - 1, name = c.split('/').pop(); return `${pre}${last ? '└── ' : '├── '}${nodes[c].kind === 'dir' ? `<span class="d">${link(c, name + '/')}</span>` : link(c, name)}${nodes[c].children.length ? '\n' + treeOf(c, pre + (last ? '    ' : '│   ')) : ''}`; }).join('\n');
  }
  function readCache(k) { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v && v.data; } catch (e) { return null; } }
  function statsText() {
    const c = readCache('st-contrib-v1'), home = readCache('gh-contrib-v1');
    const repos = readCache('st-repos-v1') || readCache('gh-repos-v2');
    const lines = [];
    if (c && c.days) {
      const today = new Date(), ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, T = ymd(today);
      const days = c.days.filter(d => d[0] <= T).sort((a, b) => a[0] < b[0] ? -1 : 1);
      const total = days.reduce((a, d) => a + d[1], 0);
      let i = days.length - 1; if (i >= 0 && days[i][0] === T && !days[i][1]) i--; let cur = 0; while (i >= 0 && days[i][1] > 0) { cur++; i--; }
      let run = 0, best = 0; days.forEach(d => { run = d[1] ? run + 1 : 0; best = Math.max(best, run); });
      const y = String(today.getFullYear());
      lines.push(`contributions   <b>${total.toLocaleString('en')}</b> all time · <b>${(c.total[y] || 0).toLocaleString('en')}</b> in ${y}`);
      lines.push(`streak          <b>${cur}</b> days now · longest <b>${best}</b> days`);
      // tiny sparkline of the last 12 months
      const bars = '▁▂▃▄▅▆▇█', m = [];
      for (let k = 11; k >= 0; k--) { const d = new Date(today.getFullYear(), today.getMonth() - k, 1); const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; m.push(days.filter(x => x[0].startsWith(key)).reduce((a, x) => a + x[1], 0)); }
      const mx = Math.max(1, ...m);
      lines.push(`last 12 months  <span class="a">${m.map(v => bars[Math.min(7, Math.round(v / mx * 7))]).join('')}</span>`);
    } else if (home && home.total) lines.push(`contributions   <b>${(home.total.lastYear || 0).toLocaleString('en')}</b> in the last year`);
    if (repos && repos.length) lines.push(`repositories    <b>${repos.filter(r => !r.fork).length}</b> · <b>${repos.reduce((a, r) => a + (r.stars != null ? r.stars : r.stargazers_count || 0), 0)}</b> stars`);
    if (!lines.length) return `<span class="m">No stats cached yet. Run <span class="a">cd ~/stats</span> once to load them.</span>`;
    return lines.join('\n') + `\n<span class="m">charts and more:</span> ${link('stats', '~/stats')}`;
  }
  function neofetch() {
    const count = (g) => R.filter(r => r.group === g).length;
    const now = window.Live && Live.describe ? Live.describe() : null;
    const logo = ['   ▄▄▄▄▄▄▄▄▄▄▄   ', '  █ ▀▄       █   ', '  █   ▀▄     █   ', '  █   ▄▀ ▄▄▄ █   ', '  █ ▄▀       █   ', '   ▀▀▀▀▀▀▀▀▀▀▀   ', '                 ', '                 '];
    const info = [`<span class="u">guest</span>@<span class="u">${HOST}</span>`, '──────────────────', `<span class="a">os</span>       GitHub Pages`, `<span class="a">shell</span>    lsh 1.0 (made for this site)`, `<span class="a">packages</span> ${count('Tools')} tools, ${count('Games')} games, ${count('Projects')} projects`, `<span class="a">theme</span>    Ink navy · periwinkle · amber`, `<span class="a">font</span>     JetBrains Mono`, `<span class="a">status</span>   ${esc(now || 'unknown')}`];
    const sw = '<span class="sw" style="background:#8ea2ff"></span><span class="sw" style="background:#ffb86b"></span><span class="sw" style="background:#5ee6b5"></span><span class="sw" style="background:#ff7a90"></span><span class="sw" style="background:#b39bff"></span><span class="sw" style="background:#6fd8ff"></span>';
    return logo.map((l, i) => `<span class="a">${l}</span>${info[i] || ''}`).join('\n') + `\n${' '.repeat(17)}${sw}`;
  }

  // ---------- CTF: capture-the-flag puzzles in a small virtual folder, ~/ctf ----------
  // The files only exist in this shell. Their contents are obfuscated below and flags are checked by hash,
  // so the answers are not sitting in the page source. Progress lives in localStorage ('ctf-progress').
  const CTF_KEY = 'ctf-progress';
  const CTF_BLOB = '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';
  const CTF_H = ["11mfp0653bz", "1eljrsth8py", "h8ol4luha2", "1sqo1b6uuk5", "295fhq0lszv", "jvctlktiva", "mlgiootpoe", "1nr2wr6ee2m"], CTF_DECOY = ["1uxbbd3xrwg", "ewr619zxp0", "4wbe51x883"];
  const CTF_TITLES = ["Hidden in plain sight", "Not encryption", "Julius' note", "Who got in?", "Memory dump", "Git never forgets", "Who can write?", "The vault"];
  const CTF_N = CTF_H.length;
  const cyrb53 = (str, seed = 0) => {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i = 0, ch; i < str.length; i++) { ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507); h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507); h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  };
  let VD = null;   // decoded { f: {path: [type, mode, owner, group, content, mtime, binary?]}, git, hints }
  function vfs() {
    if (VD) return VD;
    const k = 'lsh~ctf/2026', bin = atob(CTF_BLOB), u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i) ^ k.charCodeAt(i % k.length) ^ (i * 31 & 255);
    VD = JSON.parse(new TextDecoder().decode(u));
    VD.kids = {};
    Object.keys(VD.f).forEach(p => { VD.kids[p] = VD.kids[p] || []; const par = p.split('/').slice(0, -1).join('/'); if (par) (VD.kids[par] = VD.kids[par] || []).push(p); });
    Object.values(VD.kids).forEach(l => l.sort((a, b) => a.localeCompare(b)));
    return VD;
  }
  const ctfFresh = () => ({ v: 1, started: false, solved: [], at: {}, hints: {} });
  function ctfP() { try { return Object.assign(ctfFresh(), JSON.parse(localStorage.getItem(CTF_KEY) || '{}')); } catch (e) { return ctfFresh(); } }
  function ctfSave(P) { try { localStorage.setItem(CTF_KEY, JSON.stringify(P)); } catch (e) {} try { window.dispatchEvent(new CustomEvent('ctf:progress', { detail: P })); } catch (e) {} }
  const ctfCur = (P) => { for (let n = 1; n <= CTF_N; n++) if (!P.solved.includes(n)) return n; return 0; };
  // ~/ctf/levelN is locked until level N-1 is solved
  function lockOf(p, P = ctfP()) { const m = /^ctf\/level(\d+)(\/|$)/.exec(p); if (!m) return 0; const n = +m[1]; return n > 1 && !P.solved.includes(n - 1) ? n : 0; }
  function vmeta(p) {
    const e = vfs().f[p];
    if (e[0] === 'd' && /^ctf\/level\d+$/.test(p) && lockOf(p)) return { t: 'd', m: 'drwx------', o: 'root', g: 'root' };
    return { t: e[0], m: e[1], o: e[2], g: e[3], c: e[4], mt: e[5], bin: !!e[6] };
  }
  // absolute virtual path for an argument, or null when it is not inside ~/ctf
  function vres(arg, base = cwd()) {
    if (arg == null) return null;
    arg = String(arg).replace(/^\/home\/guest(?=\/|$)/, '~');
    const parts = arg.startsWith('~') ? arg.slice(1).split('/') : arg.startsWith('/') ? [null] : (base ? base.split('/') : []).concat(arg.split('/'));
    if (parts[0] === null) return null;
    const out = [];
    for (const s of parts) { if (!s || s === '.') continue; if (s === '..') out.pop(); else out.push(s); }
    const p = out.join('/');
    if (p !== 'ctf' && !p.startsWith('ctf/')) return null;
    const F = vfs().f;
    if (F[p]) return p;
    const lo = p.toLowerCase(), hit = Object.keys(F).find(k => k.toLowerCase() === lo);
    return hit || null;
  }
  function setV(p) {
    st.vcwd = p || ''; st.vpage = Site.rel; save();
    views.forEach(v => { v.psEl.innerHTML = ps(); if (v.titleEl) v.titleEl.textContent = titleFor(cwd()); measure(v); });
  }
  const vname = (p) => p.split('/').pop();
  const vlink = (p, label) => `<a href="#" data-cd="${esc(p)}">${esc(label)}</a>`;
  function vfmt(p, label) {   // colored name for listings
    const m = vmeta(p), n = label || vname(p);
    if (m.t === 'd') return `<span class="d">${vlink(p, n + '/')}</span>`;
    if (m.m[3] === 'x') return `<span class="u">${esc(n)}</span>`;
    return esc(n);
  }
  function vls(p, long, all) {
    const m = vmeta(p);
    if (m.t === 'f') return long ? vlong(p) : esc(vname(p));
    if (lockOf(p)) return `ls: cannot open directory '${esc(disp(p))}': Permission denied <span class="m">(solve level ${lockOf(p) - 1} first)</span>`;
    let kids = vfs().kids[p].filter(k => all || !vname(k).startsWith('.'));
    const dots = all ? [[p, '.'], [p.split('/').slice(0, -1).join('/'), '..']] : [];
    if (!long) return dots.map(([q, l]) => q === '' ? `<span class="d">${link('', '../')}</span>` : vfmt(q, l)).concat(kids.map(k => vfmt(k))).join('  ') || '<span class="m">(empty)</span>';
    const rows = dots.map(([q, l]) => q === '' ? ['drwxr-xr-x', 'guest', 'guest', 4096, 'Oct 14 08:00', `<span class="d">${link('', '../')}</span>`] : vrow(q, l)).concat(kids.map(k => vrow(k)));
    const sw = Math.max(...rows.map(r => String(r[3]).length));
    return `total ${rows.length * 4}\n` + rows.map(r => `${r[0]}  ${r[1].padEnd(5)} ${r[2].padEnd(5)} ${String(r[3]).padStart(sw)}  ${r[4].padEnd(12)}  ${r[5]}`).join('\n');
  }
  function vrow(p, label) { const m = vmeta(p); return [m.m, m.o, m.g, m.t === 'd' ? 4096 : bytesOf(m.c || '').length, m.mt || 'Oct 14 08:00', vfmt(p, label)]; }
  const vlong = (p) => { const r = vrow(p); return `${r[0]}  ${r[1]} ${r[2]} ${r[3]}  ${r[4]}  ${r[5]}`; };
  function vtree(p, all, pre = '') {
    if (lockOf(p)) return `${pre}└── <span class="m">(locked)</span>`;
    const kids = vfs().kids[p].filter(k => all || !vname(k).startsWith('.'));
    return kids.map((c, i) => { const last = i === kids.length - 1, d = vfs().f[c][0] === 'd'; return `${pre}${last ? '└── ' : '├── '}${vfmt(c)}${d && vfs().kids[c].length ? '\n' + vtree(c, all, pre + (last ? '    ' : '│   ')) : ''}`; }).filter(Boolean).join('\n');
  }
  // may guest read it? (others bits, or owner bits when guest owns it)
  const canRead = (m) => (m.o === 'guest' ? m.m[1] : m.g === 'guest' ? m.m[4] : m.m[7]) === 'r';
  function readV(arg, cmd) {
    const p = vres(arg);
    if (p == null) throw `${cmd}: ${arg}: No such file or directory`;
    const m = vmeta(p);
    if (lockOf(p)) throw `${cmd}: ${arg}: Permission denied (locked level)`;
    if (m.t === 'd') throw `${cmd}: ${arg}: Is a directory`;
    if (!canRead(m)) throw `${cmd}: ${arg}: Permission denied`;
    return { p, m, c: m.c };
  }
  const bytesOf = (s) => /[^\x00-\xff]/.test(s) ? Array.from(new TextEncoder().encode(s), b => String.fromCharCode(b)).join('') : s;
  const rot = (s, n) => s.replace(/[a-z]/gi, c => { const b = c <= 'Z' ? 65 : 97; return String.fromCharCode((c.charCodeAt(0) - b + ((n % 26) + 26)) % 26 + b); });
  const nonFlag = (a) => a.filter(x => !/^-/.test(x));
  const src = (a, inp, cmd, usage) => { const f = nonFlag(a)[0]; if (f != null) return readV(f, cmd).c; if (inp != null) return inp; throw `usage: ${usage}`; };
  const numOpt = (a, d) => { for (let i = 0; i < a.length; i++) { if (/^-\d+$/.test(a[i])) return +a[i].slice(1); if (a[i] === '-n' && /^\d+$/.test(a[i + 1] || '')) { const v = +a[i + 1]; a.splice(i, 2); return v; } } return d; };
  function gitRepo() { const c = st.vcwd || ''; if (!/^ctf\/level6\/webapp(\/|$)/.test(c)) throw 'fatal: not a git repository (or any of the parent directories): .git'; return vfs().git; }
  function gitFind(ref) {
    const G = gitRepo();
    if (!ref || /^head$/i.test(ref)) return G[0];
    const m = /^head~(\d+)$/i.exec(ref); if (m) { if (G[+m[1]]) return G[+m[1]]; throw `fatal: ambiguous argument '${ref}': unknown revision`; }
    const hits = ref.length >= 4 ? G.filter(c => c.h.startsWith(ref.toLowerCase())) : [];
    if (hits.length !== 1) throw `fatal: ambiguous argument '${ref}': unknown revision or path not in the working tree.`;
    return hits[0];
  }
  // text commands: (args, stdin) → plain text. They can be chained with |, errors are thrown as strings.
  const TXT = {
    cat: (a, inp) => { const f = nonFlag(a); if (!f.length) { if (inp != null) return inp; throw 'usage: cat <file>'; } return f.map(x => { const r = readV(x, 'cat'); if (r.m.bin) throw `cat: ${x}: binary file (try xxd ${x})`; return r.c; }).join(''); },
    echo: (a) => a.join(' ') + '\n',
    base64: (a, inp) => {
      const dec = a.some(x => /^(-d|-D|--decode)$/.test(x)), s = src(a, inp, 'base64', 'base64 [-d] <file>');
      if (!dec) return btoa(bytesOf(s)).replace(/.{1,76}/g, '$&\n');
      try { return atob(s.replace(/\s+/g, '')); } catch (e) { throw 'base64: invalid input'; }
    },
    rot13: (a, inp) => rot(src(a, inp, 'rot13', 'rot13 <file>'), 13),
    caesar: (a, inp) => {
      const n = /^-?\d+$/.test(a[0] || '') ? +a.shift() : null;
      const s = src(a, inp, 'caesar', 'caesar [shift] <file>   (no shift: try all 25)');
      if (n != null) return rot(s, n);
      return Array.from({ length: 25 }, (_, i) => `ROT${String(i + 1).padStart(2, '0')}  ${rot(s, i + 1).replace(/\n+$/, '').replace(/\n/g, ' ⏎ ')}`).join('\n') + '\n';
    },
    xxd: (a, inp) => {
      const s = src(a, inp, 'xxd', 'xxd [-r] [-p] <file>');
      if (a.includes('-r')) {
        let hex = '';
        s.split('\n').forEach(l => { if (a.includes('-p') || !l.includes(':')) hex += l; else hex += l.slice(l.indexOf(':') + 1).split(/\s{2,}/).filter(Boolean)[0] || ''; });
        hex = hex.replace(/[^0-9a-f]/gi, '');
        let out = ''; for (let i = 0; i + 1 < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
        return out;
      }
      const b = bytesOf(s);
      if (a.includes('-p')) return Array.from(b, c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('').replace(/.{1,60}/g, '$&\n');
      let out = '';
      for (let o = 0; o < b.length; o += 16) {
        const ch = b.slice(o, o + 16); let hx = '';
        for (let i = 0; i < 16; i += 2) hx += (i < ch.length ? ch.charCodeAt(i).toString(16).padStart(2, '0') : '  ') + (i + 1 < ch.length ? ch.charCodeAt(i + 1).toString(16).padStart(2, '0') : '  ') + ' ';
        out += `${o.toString(16).padStart(8, '0')}: ${hx} ${ch.replace(/[^\x20-\x7e]/g, '.')}\n`;
      }
      return out;
    },
    strings: (a, inp) => (bytesOf(src(a, inp, 'strings', 'strings <file>')).match(/[\x20-\x7e\t]{4,}/g) || []).join('\n') + '\n',
    grep: (a, inp) => {
      const fl = a.filter(x => /^-[a-z]+$/i.test(x)).join(''), rest = a.filter(x => !/^-[a-z]+$/i.test(x));
      const pat = rest.shift(); if (pat == null) throw 'usage: grep [-i] [-v] [-c] [-n] <pattern> [file]';
      let re; try { re = new RegExp(pat, fl.includes('i') ? 'i' : ''); } catch (e) { re = new RegExp(pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), fl.includes('i') ? 'i' : ''); }
      const run = (txt, name) => { const ls = txt.replace(/\n$/, '').split('\n'); const hit = ls.map((l, i) => [l, i + 1]).filter(([l]) => re.test(l) !== fl.includes('v')); return fl.includes('c') ? [(name ? name + ':' : '') + hit.length] : hit.map(([l, i]) => (name ? name + ':' : '') + (fl.includes('n') ? i + ':' : '') + l); };
      let lines;
      if (rest.length) lines = rest.flatMap(f => run(readV(f, 'grep').c, rest.length > 1 ? f : ''));
      else if (inp != null) lines = run(inp, '');
      else throw 'usage: grep <pattern> <file>';
      return lines.length ? lines.join('\n') + '\n' : '';
    },
    head: (a, inp) => { const n = numOpt(a, 10); return src(a, inp, 'head', 'head [-n N] <file>').replace(/\n$/, '').split('\n').slice(0, n).join('\n') + '\n'; },
    tail: (a, inp) => { const n = numOpt(a, 10); return src(a, inp, 'tail', 'tail [-n N] <file>').replace(/\n$/, '').split('\n').slice(-n).join('\n') + '\n'; },
    wc: (a, inp) => { const f = nonFlag(a)[0], s = src(a, inp, 'wc', 'wc [-l] <file>'); const l = (s.match(/\n/g) || []).length, w = (s.match(/\S+/g) || []).length, c = bytesOf(s).length; return (a.includes('-l') ? `${l}` : a.includes('-w') ? `${w}` : a.includes('-c') ? `${c}` : `${String(l).padStart(4)} ${String(w).padStart(5)} ${String(c).padStart(6)}`) + (f ? ' ' + f : '') + '\n'; },
    sort: (a, inp) => { const l = src(a, inp, 'sort', 'sort <file>').replace(/\n$/, '').split('\n').sort((x, y) => a.includes('-n') ? parseFloat(x) - parseFloat(y) : x.localeCompare(y)); if (a.includes('-r')) l.reverse(); return l.join('\n') + '\n'; },
    uniq: (a, inp) => { const out = []; src(a, inp, 'uniq', 'uniq [-c] <file>').replace(/\n$/, '').split('\n').forEach(l => { const t = out[out.length - 1]; if (t && t[0] === l) t[1]++; else out.push([l, 1]); }); return out.map(([l, n]) => a.includes('-c') ? `${String(n).padStart(7)} ${l}` : l).join('\n') + '\n'; },
    cut: (a, inp) => {
      let d = '\t', f = null; const rest = [];
      for (let i = 0; i < a.length; i++) { const x = a[i]; if (x.startsWith('-d')) d = x.length > 2 ? x.slice(2) : a[++i]; else if (x.startsWith('-f')) f = x.length > 2 ? x.slice(2) : a[++i]; else rest.push(x); }
      if (!f) throw 'usage: cut -d " " -f 1,3 <file>';
      const want = String(f).split(',').map(Number);
      return src(rest, inp, 'cut', 'cut -d <c> -f <n> <file>').replace(/\n$/, '').split('\n').map(l => { const p = l.split(d || ' '); return want.map(i => p[i - 1] || '').join(d); }).join('\n') + '\n';
    },
    stat: (a) => {
      const f = nonFlag(a)[0]; if (!f) throw 'usage: stat <file>';
      const p = vres(f); if (p == null) throw `stat: cannot stat '${f}': No such file or directory`;
      const m = vmeta(p), oct = [1, 4, 7].map(i => (m.m[i] === 'r' ? 4 : 0) + (m.m[i + 1] === 'w' ? 2 : 0) + (/[xs]/.test(m.m[i + 2]) ? 1 : 0)).join('');
      const id = (u) => ({ root: 0, guest: 1000, adm: 4, ops: 1010 }[u] ?? 1000);
      return `  File: ${vname(p)}\n  Size: ${m.t === 'd' ? 4096 : bytesOf(m.c || '').length}\t${m.t === 'd' ? 'directory' : 'regular file'}\nAccess: (0${oct}/${m.m})  Uid: (${String(id(m.o)).padStart(5)}/${m.o.padStart(8)})   Gid: (${String(id(m.g)).padStart(5)}/${m.g.padStart(8)})\nModify: 2026 ${m.mt || 'Oct 14 08:00'}\n`;
    },
    file: (a) => nonFlag(a).map(f => { const p = vres(f); if (p == null) return `${f}: cannot open (No such file or directory)`; const m = vmeta(p); const c = m.c || ''; return `${f}: ${m.t === 'd' ? 'directory' : m.bin ? 'data' : c.startsWith('#!') ? 'POSIX shell script, ASCII text executable' : /^[A-Za-z0-9+/=\n]+$/.test(c) && c.length > 40 ? 'ASCII text (looks like base64)' : /^[0-9a-f]{8}: /.test(c) ? 'ASCII text (hex dump)' : 'ASCII text'}`; }).join('\n') + '\n',
    id: () => 'uid=1000(guest) gid=1000(guest) groups=1000(guest)\n',
    git: (a) => {
      const sub = (a[0] || '').toLowerCase(), G = gitRepo();
      if (sub === 'log') return a.includes('--oneline') ? G.map((c, i) => `${c.h.slice(0, 7)} ${i ? '' : '(HEAD -> main) '}${c.m}`).join('\n') + '\n' : G.map((c, i) => `commit ${c.h}${i ? '' : ' (HEAD -> main)'}\nAuthor: ${c.a}\nDate:   ${c.d}\n\n    ${c.m}\n`).join('\n');
      if (sub === 'show') { const c = gitFind(nonFlag(a.slice(1))[0]); return `commit ${c.h}\nAuthor: ${c.a}\nDate:   ${c.d}\n\n    ${c.m}\n\n${c.diff}`; }
      if (sub === 'status') return 'On branch main\nnothing to commit, working tree clean\n';
      if (sub === 'branch') return '* main\n';
      if (sub === 'diff') return '';
      throw `git: '${a[0] || ''}' is not supported here. Try git log, git log --oneline, git show <hash>, git status.`;
    }
  };
  // plain text → terminal HTML (control bytes shown as dots, diff lines colored)
  function showText(s, cmd) {
    s = String(s).replace(/\n$/, '').replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, '.');
    if (!s) return '';
    if (cmd === 'git') return s.split('\n').map(l => /^commit /.test(l) ? `<span class="a">${esc(l)}</span>` : /^\+(?!\+\+)/.test(l) ? `<span class="u">${esc(l)}</span>` : /^-(?!--)/.test(l) ? `<span style="color:var(--rose)">${esc(l)}</span>` : /^@@/.test(l) ? `<span class="d">${esc(l)}</span>` : esc(l)).join('\n');
    return esc(s);
  }
  function tokens(s) { const out = []; s.replace(/"([^"]*)"|'([^']*)'|(\S+)/g, (m, a, b, c) => { out.push(a != null ? a : b != null ? b : c); return ''; }); return out; }
  function runPipe(stages) {
    let data = null, last = '';
    try {
      for (const toks of stages) {
        if (!toks.length) throw 'lsh: syntax error near |';
        const c = toks[0].toLowerCase(), f = TXT[c];
        if (!f) throw `lsh: ${toks[0]}: does not read from a pipe here (try cat, grep, base64, rot13, caesar, xxd, strings, head, tail, sort, uniq, wc, cut)`;
        data = f(toks.slice(1), data); last = c;
      }
    } catch (e) { if (typeof e !== 'string') throw e; print(esc(e), 'err'); return null; }
    const h = showText(data, last); if (h) print(h);
    return null;
  }
  const T = (name) => (a) => runPipe([[name].concat(a)]);

  // ---------- the game ----------
  const HINT_TIERS = 3;
  function ctfTable(P) {
    const cur = ctfCur(P), n = P.solved.length;
    const bar = Array.from({ length: CTF_N }, (_, i) => i < n ? '■' : '□').join('');
    const rows = CTF_TITLES.map((t, i) => {
      const lv = i + 1, done = P.solved.includes(lv), p = 'ctf/level' + lv, locked = lockOf(p, P);
      const mark = done ? '<span class="u">✓</span>' : lv === cur ? '<span class="a">▸</span>' : '<span class="m">·</span>';
      const where = done ? '<span class="m">solved</span>' : locked ? '<span class="m">locked</span>' : vlink(p, disp(p));
      return `  ${mark} ${lv}  ${(lv === cur ? `<b>${esc(t)}</b>` : esc(t))}${' '.repeat(Math.max(2, 24 - t.length))}${where}`;
    });
    return `<span class="d">Terminal CTF</span>  <b>${n}/${CTF_N}</b> flags  <span class="${n === CTF_N ? 'u' : 'a'}">${bar}</span>\n${rows.join('\n')}`;
  }
  function ctfNext(P) {
    const cur = ctfCur(P);
    if (!cur) return `<span class="u">All ${CTF_N} flags captured.</span> Nicely done. <span class="m">ctf reset starts over.</span>`;
    return `<span class="m">next:</span> <span class="a">cd ~/ctf/level${cur}</span> <span class="m">and</span> <span class="a">cat README</span><span class="m">  ·  stuck?</span> <span class="a">ctf hint</span><span class="m">  ·  hand in:</span> <span class="a">submit flag{...}</span>`;
  }
  const CTF_CMDS = {
    ctf: (a) => {
      const sub = (a[0] || '').toLowerCase(), P = ctfP();
      if (sub === 'reset') {
        ctfSave(ctfFresh());
        if (st.vcwd && /^ctf\/level([2-9]|\d\d)/.test(st.vcwd)) setV('ctf');
        return '<span class="m">CTF progress wiped. All levels except level 1 are locked again. Type</span> <span class="a">ctf</span> <span class="m">to start.</span>';
      }
      if (sub === 'hint' || sub === 'hints') {
        const cur = ctfCur(P);
        if (!cur) return '<span class="m">Nothing left to hint at: every flag is captured.</span>';
        const k = Math.min(HINT_TIERS, (P.hints[cur] || 0) + 1); P.hints[cur] = k; P.started = true; ctfSave(P);
        const H = vfs().hints[cur - 1];
        return `<span class="d">Level ${cur} · ${esc(CTF_TITLES[cur - 1])}</span>\n` + H.slice(0, k).map((h, i) => `  <span class="a">hint ${i + 1}/${HINT_TIERS}</span>  ${esc(h)}`).join('\n') + (k < HINT_TIERS ? `\n<span class="m">ctf hint again for a more direct one.</span>` : '');
      }
      if (sub && !/^(status|progress|levels|ls)$/.test(sub)) return `usage: <span class="a">ctf</span> (progress) · <span class="a">ctf hint</span> · <span class="a">ctf reset</span>`;
      let intro = '';
      if (!P.started) {
        P.started = true; ctfSave(P);
        intro = `Welcome to the <b>Terminal CTF</b>. Eight puzzles are hidden in ${vlink('ctf', '~/ctf')}, each guarding a flag that looks like <span class="a">flag{...}</span>.
Find them with this shell's own tools (ls, cat, grep, base64, xxd, git, ...) and hand them in with <span class="a">submit</span>.
Real sysadmin tricks, no guessing needed. Your progress is saved in this browser.\n\n`;
      }
      return intro + ctfTable(P) + '\n' + ctfNext(P);
    },
    submit: (a) => {
      let f = a.join(' ').trim();
      if (!f) return 'usage: <span class="a">submit flag{...}</span>';
      if (!/^flag\{.*\}$/i.test(f)) f = 'flag{' + f.replace(/^\{|\}$/g, '') + '}';
      const h = cyrb53('lsh-ctf:' + f.toLowerCase()), n = CTF_H.indexOf(h) + 1, P = ctfP();
      P.started = true;
      if (!n) {
        ctfSave(P);
        if (CTF_DECOY.includes(h)) { print('<span class="a">Decoy.</span> That token is real, but it belongs to a script you could not have changed. Check the permissions again (ls -l, id).', 'err'); return null; }
        print(`✗ <b>${esc(f)}</b> is not a flag. <span class="m">Flags look like flag{...}; ctf hint helps.</span>`, 'err'); return null;
      }
      if (P.solved.includes(n)) return `<span class="m">Level ${n} (${esc(CTF_TITLES[n - 1])}) is already captured.</span>`;
      P.solved.push(n); P.solved.sort((x, y) => x - y); P.at[n] = Date.now(); ctfSave(P);
      const all = P.solved.length === CTF_N;
      setTimeout(() => { if (all) Site.party && Site.party('All CTF flags captured'); else Site.toast && Site.toast(`Flag ${P.solved.length}/${CTF_N} captured`, 'fas fa-flag'); }, 150);
      const nx = ctfCur(P);
      return `<span class="u">✓ Correct!</span> Level ${n} · <b>${esc(CTF_TITLES[n - 1])}</b> captured  <span class="m">(${P.solved.length}/${CTF_N})</span>` +
        (all ? `\n<span class="u">That was the last one. You cleared the Terminal CTF.</span> 🎉` : nx ? `\n<span class="m">level ${nx} is open:</span> ${vlink('ctf/level' + nx, 'cd ~/ctf/level' + nx)}` : '');
    },
    base64: T('base64'), rot13: T('rot13'), caesar: T('caesar'), xxd: T('xxd'), strings: T('strings'), head: T('head'), tail: T('tail'),
    wc: T('wc'), sort: T('sort'), uniq: T('uniq'), cut: T('cut'), stat: T('stat'), file: T('file'), id: T('id'), git: T('git')
  };

  const HELP = [
    ['ls [dir]', 'list a directory (-l details, -a hidden files)'], ['cd &lt;dir&gt;', 'go to a page: cd tools, cd ../games/snake, cd ~'],
    ['open &lt;name&gt;', 'open anything by name: open hash, open snake'], ['find &lt;text&gt;', 'search pages'], ['tree', 'the whole site'],
    ['pwd', 'where am I'], ['back / forward', 'browser history'], ['cat &lt;name&gt;', 'cat README.md, cat stats, cat tools/cron'],
    ['now', 'what Lukas is listening to or coding right now'], ['np on|off', 'show or hide the now-playing pill'],
    ['stats', 'GitHub numbers in the terminal'], ['neofetch', 'system info, terminal style'],
    ['whoami / socials', 'about me and where to find me'], ['stack', 'what I build with'], ['github / discord', 'open GitHub / copy my Discord name'],
    ['ctf', 'capture the flag: 8 puzzles in ~/ctf (ctf hint, ctf reset)'], ['submit &lt;flag&gt;', 'hand in a flag{...} you found'],
    ['grep base64 xxd git', 'tools for the CTF, and | pipes between them'],
    ['history / clear', 'command history / clear the screen'], ['exit', 'close the terminal (or press Esc)']
  ];
  const CMDS = {
    help: () => `<span class="d">Commands</span>\n` + HELP.map(([c, d]) => `  <span class="a">${c.padEnd(22 + (c.length - c.replace(/&[lg]t;/g, 'x').length))}</span><span class="m">${d}</span>`).join('\n') + `\n<span class="m">Tip: the key left of 1 opens this anywhere. Links in the output are clickable too.</span>`,
    ls: (a) => {
      const fl = a.filter(x => x.startsWith('-')).join(''), long = fl.includes('l'), all = /[aA]/.test(fl);
      const t = a.find(x => !x.startsWith('-'));
      const vp = t == null ? (st.vcwd || null) : vres(t);
      if (vp != null) return vls(vp, long, all);
      const p = t == null ? here : resolve(t, cwd()); if (p == null) return `ls: cannot access '${esc(t)}': No such file or directory`; return lsOf(p, long, all);
    },
    ll: (a) => CMDS.ls(['-l', ...a]),
    dir: (a) => CMDS.ls(a),
    cd: (a) => {
      if (a[0] === '-') return CMDS.back();
      const vp = vres(a[0]);
      if (vp != null) {
        if (vmeta(vp).t !== 'd') return `cd: not a directory: ${esc(a[0])}`;
        const L = lockOf(vp); if (L) return `cd: permission denied: ${esc(a[0])} <span class="m">(locked: solve level ${L - 1} first)</span>`;
        setV(vp); return null;
      }
      const p = resolve(a[0], cwd()) ?? (st.vcwd ? resolve(a[0], '') : null);
      if (p == null) { const f = fuzzy(a.join(' ')); return f.length ? `cd: no such directory: ${esc(a[0])}. Did you mean ${link(f[0].path, disp(f[0].path))}?` : `cd: no such directory: ${esc(a[0])}`; }
      return go(p);
    },
    open: (a) => {
      if (!a.length) return 'usage: open &lt;name&gt;   e.g. <span class="a">open snake</span>';
      const p = resolve(a.join('-')); if (p != null && p !== '') return go(p, 'opening');
      const f = fuzzy(a.join(' ')); if (!f.length) return `open: nothing called “${esc(a.join(' '))}”. Try <span class="a">find ${esc(a[0])}</span>.`;
      return go(f[0].path, 'opening');
    },
    run: (a) => CMDS.open(a), start: (a) => CMDS.open(a), play: (a) => CMDS.open(a),
    find: (a) => { const f = fuzzy(a.join(' ')); if (!a.length) return 'usage: find &lt;text&gt;'; return f.length ? f.slice(0, 12).map(n => `${link(n.path, disp(n.path))}  <span class="m">${esc(n.sub || '')}</span>`).join('\n') : `<span class="m">no matches for “${esc(a.join(' '))}”</span>`; },
    search: (a) => CMDS.find(a),
    // grep in CTF files (grep Accepted auth.log), otherwise search the site's pages
    grep: (a) => { const nf = a.filter(x => !x.startsWith('-')); if (nf.length >= 2 && nf.slice(1).every(f => vres(f) != null)) return T('grep')(a); return CMDS.find(nf); },
    tree: (a = []) => {
      const all = a.some(x => /^-.*a/.test(x)), t = a.find(x => !x.startsWith('-'));
      const vp = t == null ? (st.vcwd || null) : vres(t);
      if (vp != null) return vmeta(vp).t === 'd' ? `<span class="d">${esc(disp(vp))}</span>\n` + vtree(vp, all) : esc(vname(vp));
      if (t != null && resolve(t, cwd()) == null) return `tree: ${esc(t)}: No such directory`;
      const p = t == null ? '' : resolve(t, cwd());
      return `<span class="d">${esc(disp(p))}</span>\n` + (nodes[p].children.length ? treeOf(p) : '');
    },
    pwd: () => esc('/home/guest' + (cwd() ? '/' + cwd() : '')),
    back: () => { leaveWith(null, () => history.back()); return '<span class="m">← back</span>'; },
    forward: () => { leaveWith(null, () => history.forward()); return '<span class="m">→ forward</span>'; },
    home: () => go(''),
    cat: (a) => {
      const t = (a[0] || '').toLowerCase();
      if (!t) return 'usage: cat &lt;file&gt;';
      if (st.vcwd || a.some(x => vres(x) != null)) return T('cat')(a);
      if (t === 'readme.md' || t === 'readme' || t === 'about') return CMDS.whoami();
      if (t === 'stats' || t === 'stats.txt') return statsText();
      if (t === '.secret' || t === 'secret') { setTimeout(() => Site.party && Site.party('You found the secret file'), 200); return '<span class="a">🎉</span>'; }
      const p = resolve(t, cwd()); if (p != null) { const n = nodes[p]; return `<b>${esc(n.title)}</b>\n${esc(n.sub || '')}\n<span class="m">${esc(Site.url(n.href).replace(/index\.html$/, ''))}</span>`; }
      return `cat: ${esc(a[0])}: No such file`;
    },
    stats: () => statsText(),
    now: () => { if (!window.Live) return '<span class="m">live status is still loading…</span>'; const d = Live.describe(); return d ? esc(d) : '<span class="m">still connecting to Discord… try again in a second</span>'; },
    np: (a) => { if (!window.Live || !Live.setHidden) return 'np: not available'; if (a[0] === 'off') { Live.setHidden(true); return 'now-playing pill hidden'; } if (a[0] === 'on') { Live.setHidden(false); return 'now-playing pill shown (when something is playing)'; } return CMDS.now(); },
    whoami: () => `lukas200301: IT system integration apprentice who builds the tools he wants to use.
A Raspberry Pi controller, a network monitor, and ${R.filter(r => r.group === 'Tools').length} tools plus ${R.filter(r => r.group === 'Games').length} games that live on this site.`,
    socials: () => `github     <a href="${Site.LINKS.github}" target="_blank" rel="noopener">${Site.LINKS.github.replace('https://', '')}</a>\ndiscord    ${esc(Site.LINKS.discord)}  <span class="m">(type <span class="a">discord</span> to copy)</span>`,
    github: () => { window.open(Site.LINKS.github, '_blank', 'noopener'); return '<span class="m">opening GitHub in a new tab…</span>'; },
    discord: () => { Site.copy(Site.LINKS.discord, 'Discord username copied'); return `copied <b>${esc(Site.LINKS.discord)}</b> to the clipboard`; },
    neofetch: () => neofetch(),
    stack: () => `<span class="d">frontend</span>  HTML, CSS, JavaScript, TypeScript, Vue, Nuxt
<span class="d">backend</span>   Node.js, Python, Java, C#, Go, Dart/Flutter
<span class="d">ops</span>       Linux, Docker, Grafana, MySQL, GitHub`,
    date: () => esc(new Date().toString()),
    echo: (a) => esc(a.join(' ')),
    history: () => st.hist.map((h, i) => `${String(i + 1).padStart(4)}  ${esc(h)}`).join('\n') || '<span class="m">no history yet</span>',
    clear: () => { views.forEach(v => { v.out.innerHTML = ''; }); st.lines = []; save(); return null; },
    cls: () => CMDS.clear(),
    exit: () => { if (V.embedded) { V.input.blur(); return '<span class="m">this one lives on the page. The full-screen one closes with exit or Esc.</span>'; } close(); return null; }, quit: () => CMDS.exit(), q: () => CMDS.exit(), ':q': () => CMDS.exit(),
    sudo: () => 'lukas is not in the sudoers file. This incident will be reported. 🙂',
    rm: () => 'rm: nice try. This site is read-only.',
    vim: () => 'vim opened. Just kidding: you would never get out. Type <span class="a">exit</span>.',
    party: () => { Site.party && Site.party(false); return '🎉'; },
    hello: () => 'hi! 👋 type <span class="a">help</span> to see what I can do', hi: () => CMDS.hello(),
    shortcuts: () => `<span class="a">${/Mac/.test(navigator.platform) ? '⌘' : 'Ctrl'}+K</span> jump anywhere · <span class="a">G</span> then <span class="a">H/P/T/G/S</span> go to a section · <span class="a">?</span> all shortcuts · key left of <span class="a">1</span> this terminal`
  };
  Object.assign(CMDS, CTF_CMDS);
  const NAMES = Object.keys(CMDS).filter(n => !/^(dir|cls|q|:q|hi|run|start|play|search|grep|ll)$/.test(n));

  function run(line) {
    const raw = line.trim();
    print(`${ps()} ${esc(raw)}`, 'cmd');
    if (!raw) return;
    st.hist.push(raw); save();
    // allow a few chained commands: "cd tools; ls"
    if (raw.includes(';')) { raw.split(';').map(s => s.trim()).filter(Boolean).forEach((c, i) => i ? setTimeout(() => runOne(c), 0) : runOne(c)); return; }
    runOne(raw);
  }
  function runOne(raw) {
    // pipes between the text commands: base64 -d orders.enc | rot13
    if (/\|/.test(raw)) { runPipe(raw.split('|').map(s => tokens(s.trim()))); return; }
    const [cmd, ...args] = tokens(raw);
    const fn = CMDS[cmd.toLowerCase()];
    if (fn) { const r = fn(args); if (r != null && r !== '') print(r); return; }
    // a bare path or page name also works: "tools", "snake", "../games"
    if (!args.length && vres(cmd) != null && vmeta(vres(cmd)).t === 'd') { const r = CMDS.cd([cmd]); if (r) print(r); return; }
    const p = resolve(cmd, cwd()); if (p != null && !args.length) { const r = go(p); if (r) print(r); return; }
    const f = fuzzy(raw);
    print(`lsh: command not found: ${esc(cmd)}${f.length ? `. Did you mean <span class="a">open ${esc(f[0].path.split('/').pop())}</span>?` : '. Type <span class="a">help</span>.'}`, 'err');
  }

  // ---------- tab completion ----------
  function candidates(v) {
    const parts = v.split(/\s+/);
    if (parts.length === 1) return NAMES.filter(n => n.startsWith(parts[0].toLowerCase())).map(n => n + ' ');
    const cmd = parts[0].toLowerCase(), arg = parts[parts.length - 1], head = v.slice(0, v.length - arg.length);
    if (cmd === 'ctf' && parts.length === 2) return ['hint', 'reset'].filter(x => x.startsWith(arg)).map(x => head + x);
    if (cmd === 'git' && parts.length === 2) return ['log', 'show', 'status'].filter(x => x.startsWith(arg)).map(x => head + x + ' ');
    if (cmd === 'submit' && parts.length === 2 && 'flag{'.startsWith(arg.toLowerCase())) return [head + 'flag{'];
    const FILE_CMDS = ['cd', 'ls', 'll', 'cat', 'tree', 'base64', 'rot13', 'caesar', 'xxd', 'strings', 'head', 'tail', 'wc', 'grep', 'stat', 'file', 'sort', 'uniq', 'cut'];
    if (FILE_CMDS.includes(cmd) && !arg.startsWith('-')) {
      const slash = arg.lastIndexOf('/'), dirPart = slash >= 0 ? arg.slice(0, slash + 1) : '', namePart = (slash >= 0 ? arg.slice(slash + 1) : arg).toLowerCase();
      const vd = dirPart ? vres(dirPart) : (st.vcwd || null);
      if (vd != null && vmeta(vd).t === 'd' && !lockOf(vd)) {
        const kids = vfs().kids[vd].filter(k => { const n = vname(k).toLowerCase(); return n.startsWith(namePart) && (namePart.startsWith('.') || !n.startsWith('.')) && (cmd !== 'cd' || vfs().f[k][0] === 'd'); });
        return kids.map(k => head + dirPart + vname(k) + (vfs().f[k][0] === 'd' ? '/' : ' ')).concat(!dirPart && '..'.startsWith(namePart) && namePart ? [head + '../'] : []);
      }
    }
    // ~/ctf is not a site page: offer it next to the real folders in ~ once the game was started
    const ctfExtra = !st.vcwd && here === '' && !arg.includes('/') && arg && 'ctf'.startsWith(arg.toLowerCase()) && ['cd', 'ls', 'll', 'tree'].includes(cmd) && ctfP().started ? [head + 'ctf/'] : [];
    if (cmd === 'tree' && ctfExtra.length) return ctfExtra;
    if (['cd', 'ls', 'll', 'cat', 'open', 'run', 'play', 'start'].includes(cmd)) {
      const slash = arg.lastIndexOf('/');
      const dirPart = slash >= 0 ? arg.slice(0, slash + 1) : '', namePart = (slash >= 0 ? arg.slice(slash + 1) : arg).toLowerCase();
      const dir = dirPart ? resolve(dirPart, cwd()) : (cmd === 'open' || cmd === 'run' || cmd === 'play' || cmd === 'start' ? null : here);
      if (dir == null) {   // open: any page name
        return Object.values(nodes).filter(n => n.path && n.path.split('/').pop().startsWith(namePart)).map(n => head + n.path.split('/').pop() + ' ');
      }
      const kids = nodes[dir].children.concat(dirPart ? [] : (here ? ['..'] : []));
      return kids.filter(c => (c === '..' ? '..' : c.split('/').pop()).startsWith(namePart))
        .map(c => head + dirPart + (c === '..' ? '../' : c.split('/').pop() + (nodes[c].children.length ? '/' : ' '))).concat(ctfExtra);
    }
    if (cmd === 'np') return ['on', 'off'].filter(x => x.startsWith(arg)).map(x => head + x);
    return [];
  }
  function common(list) { if (!list.length) return ''; let p = list[0]; list.forEach(s => { while (!s.startsWith(p)) p = p.slice(0, -1); }); return p; }
  function complete(v) {
    const val = v.input.value, c = candidates(val);
    if (!c.length) return;
    if (c.length === 1) { v.input.value = c[0]; updGhost(v); return; }
    const pre = common(c);
    if (pre.length > val.length) { v.input.value = pre; updGhost(v); return; }
    print(`${ps()} ${esc(val)}\n` + c.map(x => esc(x.trim().split(/\s+/).pop())).join('  '), 'cmd');
  }
  function updGhost(v) {
    const val = v.input.value;
    const c = val ? candidates(val) : [];
    v.ghost.textContent = c.length === 1 && c[0].startsWith(val) ? c[0].slice(val.length) : '';
    v.ghost.style.left = `calc(var(--ps-w, 0px) + 0.6ch + ${val.length}ch)`;
  }

  // ---------- input (both windows) ----------
  function bindView(v) {
    const inp = v.input;
    v.root.querySelector('.cli__line').addEventListener('submit', e => { e.preventDefault(); V = v; const val = inp.value; inp.value = ''; v.hIdx = -1; updGhost(v); run(val); });
    inp.addEventListener('focus', () => { V = v; measure(v); });
    inp.addEventListener('input', () => updGhost(v));
    inp.addEventListener('keydown', e => {
      if (e.key === 'Tab') { e.preventDefault(); complete(v); return; }
      if (e.key === 'ArrowRight' && v.ghost.textContent && inp.selectionStart === inp.value.length) { e.preventDefault(); inp.value += v.ghost.textContent; updGhost(v); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); if (!st.hist.length) return; if (v.hIdx < 0) { v.draft = inp.value; v.hIdx = st.hist.length; } v.hIdx = Math.max(0, v.hIdx - 1); inp.value = st.hist[v.hIdx]; updGhost(v); requestAnimationFrame(() => inp.setSelectionRange(inp.value.length, inp.value.length)); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); if (v.hIdx < 0) return; v.hIdx++; if (v.hIdx >= st.hist.length) { v.hIdx = -1; inp.value = v.draft; } else inp.value = st.hist[v.hIdx]; updGhost(v); return; }
      if (e.ctrlKey && e.key.toLowerCase() === 'l') { e.preventDefault(); CMDS.clear(); return; }
      if (e.ctrlKey && e.key.toLowerCase() === 'c' && !window.getSelection().toString()) { e.preventDefault(); print(`${ps()} ${esc(inp.value)}^C`, 'cmd'); inp.value = ''; updGhost(v); return; }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (v.embedded) inp.blur(); else close(); }
    });
    v.out.addEventListener('click', e => {
      const a = e.target.closest('a[data-cd]'); if (!a) return;
      e.preventDefault(); e.stopPropagation(); V = v; run('cd ' + disp(a.dataset.cd));
    });
    v.body.addEventListener('mouseup', e => { if (!window.getSelection().toString() && !e.target.closest('a, button')) inp.focus({ preventScroll: true }); });
  }
  views.forEach(bindView);
  // overlay only: close on a click on the dimmed backdrop, but not when a text selection started inside the window and ended out there
  let downOnBackdrop = false;
  root.addEventListener('pointerdown', e => { downOnBackdrop = e.target === root; });
  root.addEventListener('click', e => { if (e.target === root && downOnBackdrop) close(); downOnBackdrop = false; });
  // while open, the overlay owns the keyboard: keys don't reach the page behind it (game controls, G-shortcuts, ?)
  root.addEventListener('keydown', e => { if (!((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) e.stopPropagation(); });
  root.querySelector('.cli__close').addEventListener('click', close);

  // ---------- open / close (the overlay) ----------
  let lastFocus = null, shown = false;
  function boot() {
    if (st.booted) return;
    st.booted = true;
    print(`<span class="a banner">${esc(BANNER)}</span>`, 'banner');
    print(`Welcome to <b>lsh</b>, the shell of this site. The whole site is a folder you can <span class="a">cd</span> around in.\nType <span class="a">help</span> to see the commands, or try <span class="a">ls</span>, <span class="a">tree</span>, <span class="a">open snake</span>, <span class="a">now</span>.`);
  }
  function open(instant) {
    V = ov;
    if (shown) { input.focus(); return; }
    shown = true;
    lastFocus = document.activeElement;
    // the terminal's own copy of JetBrains Mono (already loaded in <head> when the page starts with it open)
    if (!window.__jbmInline) { const f = document.createElement('script'); f.src = Site.url('js/terminal-font.js'); document.head.appendChild(f); }
    const pal = document.querySelector('.palette.open'); if (pal) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    root.hidden = false;
    document.documentElement.classList.add('cli-open');
    if (instant) root.classList.add('in', 'instant'); else requestAnimationFrame(() => root.classList.add('in'));
    st.open = true; save();
    boot();
    requestAnimationFrame(() => { measure(ov); input.focus({ preventScroll: true }); body.scrollTop = body.scrollHeight; });
  }
  function close() {
    shown = false;
    root.classList.remove('in', 'instant', 'cli--nav');
    document.documentElement.classList.remove('cli-open');
    st.open = false; save();
    setTimeout(() => { if (!root.classList.contains('in')) root.hidden = true; }, 260);
    if (lastFocus && lastFocus.focus) try { lastFocus.focus({ preventScroll: true }); } catch (e) {}
  }
  window.CLI = { open: () => open(false), close, toggle: () => (shown ? close() : open(false)), run: (c) => { open(true); V = ov; run(c); } };

  // the key left of "1": ` on US/UK layouts, ^ on German ones (both report code "Backquote")
  document.addEventListener('keydown', e => {
    if (e.code !== 'Backquote' || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t !== input && (t.closest && t.closest('input, textarea, select, [contenteditable="true"]'))) return;
    e.preventDefault();
    if (shown) { if (t !== input || !input.value) close(); } else open(false);
  }, true);
  // focus left the prompt (e.g. after selecting text): typing goes back into it instead of to the page behind
  document.addEventListener('keydown', e => {
    if (!shown || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t === input || (t.closest && t.closest('input, textarea, select, [contenteditable="true"], .palette'))) return;
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key.length === 1) input.focus({ preventScroll: true });
  }, true);

  function drawLines() {
    views.forEach(v => {
      v.out.innerHTML = '';
      st.lines.forEach(([cls, html]) => { const d = document.createElement('div'); d.className = 'cli__ln ' + cls; d.innerHTML = html; v.out.appendChild(d); });
      v.body.scrollTop = v.body.scrollHeight;
    });
  }

  // embedded window: greet, and the first time it scrolls into view in a fresh session, type "help" by itself
  function mountEmbed() {
    boot();
    measure(em);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => measure(em));
    if (Site.reduceMotion || st.hist.length || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(entries => {
      if (!entries.some(x => x.isIntersecting)) return;
      io.disconnect();
      if (st.hist.length || em.input.value) return;
      const word = 'help'; let i = 0;
      const t = setInterval(() => {
        if (document.activeElement === em.input || shown) { clearInterval(t); if (em.input.value === word.slice(0, i)) em.input.value = ''; updGhost(em); return; }
        em.input.value = word.slice(0, ++i); updGhost(em);
        if (i === word.length) { clearInterval(t); setTimeout(() => { if (em.input.value !== word) return; em.input.value = ''; updGhost(em); V = em; run(word); }, 380); }
      }, 110);
    }, { threshold: 0.6 });
    io.observe(em.root);
  }

  function mount() {
    if (!pre) document.body.appendChild(root);
    drawLines();   // restore scrollback from the previous page
    views.forEach(v => { v.psEl.innerHTML = ps(); });
    try { sessionStorage.removeItem('cli-nav'); } catch (e) {}
    if (em) mountEmbed();
    if (st.open) open(true);
    // once the page transition behind the window has finished, bring the dimmed backdrop back
    if (root.classList.contains('cli--nav')) {
      const t0 = Date.now();
      (function wait() {
        if (document.querySelector('.pt-ov') && Date.now() - t0 < 3000) return setTimeout(wait, 60);
        root.classList.remove('instant');
        requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('cli--nav')));
      })();
    }
    // back/forward from the browser cache restores this page as it was when we left it: drop the "leaving" state
    // and catch up with the terminal from the later pages (open or closed, scrollback, history)
    addEventListener('pageshow', e => {
      if (!e.persisted) return;
      root.classList.remove('cli--nav'); try { sessionStorage.removeItem('cli-nav'); } catch (er) {}
      let s; try { s = JSON.parse(sessionStorage.getItem(KEY) || '{}'); } catch (er) { return; }
      st.lines = s.lines || []; st.hist = s.hist || []; st.booted = !!s.booted; st.vcwd = s.vpage === Site.rel ? s.vcwd || '' : '';
      drawLines();
      views.forEach(v => { v.psEl.innerHTML = ps(); if (v.titleEl) v.titleEl.textContent = titleFor(cwd()); });
      if (s.open) { open(true); requestAnimationFrame(() => { body.scrollTop = body.scrollHeight; }); } else if (shown) close();
    });
    document.querySelectorAll('[data-open-cli]').forEach(b => b.addEventListener('click', () => window.CLI.toggle()));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
