/* Site-wide command line (loaded by js/script.js).
   Open with the key left of 1 (` on US, ^ on German keyboards), the >_ button in the header or Ctrl+K → "command line".
   The site is a file system: ~/projects, ~/tools/<name>, ~/games/<name>, ~/stats. `cd` navigates and the
   terminal stays open on the next page, with its scrollback and history, so you can browse without a mouse. */
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
  let st = { open: false, lines: [], hist: [], booted: false };
  try { st = Object.assign(st, JSON.parse(sessionStorage.getItem(KEY) || '{}')); } catch (e) {}
  st.lines = (st.lines || []).map(([c, h]) => [c, String(h).replace(/lukas@lukas200301/g, 'guest@lukas200301')]);
  const save = () => { try { st.lines = st.lines.slice(-300); st.hist = st.hist.slice(-100); sessionStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} };

  // ---------- DOM ----------
  // if we arrived from a cd, the inline <head> script already drew the terminal (with scrollback) before the first paint
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
  const out = root.querySelector('.cli__out'), input = root.querySelector('.cli__in'), body = root.querySelector('.cli__body'), ghost = root.querySelector('.cli__ghost');
  const psFor = (p) => `<span class="u">guest@${HOST}</span>:<span class="p">${esc(disp(p))}</span>$`;
  const titleFor = (p) => `guest@${HOST}: ${disp(p)} — lsh`;
  const ps = () => psFor(here);
  root.querySelector('.cli__ps').innerHTML = ps();
  root.querySelector('.cli__title').textContent = titleFor(here);

  function print(html, cls = '') {
    const d = document.createElement('div'); d.className = 'cli__ln new ' + cls; d.innerHTML = html; out.appendChild(d);
    d.addEventListener('animationend', () => d.classList.remove('new'), { once: true });
    st.lines.push([cls, html]); save();
    body.scrollTop = body.scrollHeight;
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
    st.open = true; st.ps = p == null ? '' : psFor(p); st.title = p == null ? '' : titleFor(p); save();
    try { sessionStorage.setItem('cli-nav', '1'); } catch (e) {}
    root.classList.remove('instant');
    root.classList.add('cli--nav');
    if (p != null) { root.querySelector('.cli__ps').innerHTML = psFor(p); root.querySelector('.cli__title').textContent = titleFor(p); root.style.setProperty('--ps-w', root.querySelector('.cli__ps').offsetWidth + 'px'); }
    input.blur();
    setTimeout(fn, 220);
  }
  function go(p, msg) {
    if (p === here) return `<span class="m">already in ${esc(disp(p))}</span>`;
    leaveWith(p, () => Site.navigate(Site.url(nodes[p].href)));
    return `<span class="m">${msg || '→'} ${esc(disp(p))}</span>`;
  }
  function lsOf(p, long) {
    const n = nodes[p];
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

  const HELP = [
    ['ls [dir]', 'list a directory (ls -l for details)'], ['cd &lt;dir&gt;', 'go to a page: cd tools, cd ../games/snake, cd ~'],
    ['open &lt;name&gt;', 'open anything by name: open hash, open snake'], ['find &lt;text&gt;', 'search pages'], ['tree', 'the whole site'],
    ['pwd', 'where am I'], ['back / forward', 'browser history'], ['cat &lt;name&gt;', 'cat README.md, cat stats, cat tools/cron'],
    ['now', 'what Lukas is listening to or coding right now'], ['np on|off', 'show or hide the now-playing pill'],
    ['stats', 'GitHub numbers in the terminal'], ['neofetch', 'system info, terminal style'],
    ['whoami / socials', 'about me and where to find me'], ['github / discord', 'open GitHub / copy my Discord name'],
    ['history / clear', 'command history / clear the screen'], ['exit', 'close the terminal (or press Esc)']
  ];
  const CMDS = {
    help: () => `<span class="d">Commands</span>\n` + HELP.map(([c, d]) => `  <span class="a">${c.padEnd(22 + (c.length - c.replace(/&[lg]t;/g, 'x').length))}</span><span class="m">${d}</span>`).join('\n') + `\n<span class="m">Tip: the key left of 1 opens this anywhere. Links in the output are clickable too.</span>`,
    ls: (a) => { const long = a.includes('-l') || a.includes('-la'); const t = a.find(x => !x.startsWith('-')); const p = t == null ? here : resolve(t); if (p == null) return `ls: cannot access '${esc(t)}': No such file or directory`; return lsOf(p, long); },
    ll: (a) => CMDS.ls(['-l', ...a]),
    dir: (a) => CMDS.ls(a),
    cd: (a) => {
      if (a[0] === '-') return CMDS.back();
      const p = resolve(a[0]);
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
    search: (a) => CMDS.find(a), grep: (a) => CMDS.find(a.filter(x => !x.startsWith('-'))),
    tree: () => `<span class="d">~</span>\n` + treeOf(),
    pwd: () => esc('/home/guest' + (here ? '/' + here : '')),
    back: () => { leaveWith(null, () => history.back()); return '<span class="m">← back</span>'; },
    forward: () => { leaveWith(null, () => history.forward()); return '<span class="m">→ forward</span>'; },
    home: () => go(''),
    cat: (a) => {
      const t = (a[0] || '').toLowerCase();
      if (!t) return 'usage: cat &lt;file&gt;';
      if (t === 'readme.md' || t === 'readme' || t === 'about') return CMDS.whoami();
      if (t === 'stats' || t === 'stats.txt') return statsText();
      if (t === '.secret' || t === 'secret') { setTimeout(() => Site.party && Site.party('You found the secret file'), 200); return '<span class="a">🎉</span>'; }
      const p = resolve(t); if (p != null) { const n = nodes[p]; return `<b>${esc(n.title)}</b>\n${esc(n.sub || '')}\n<span class="m">${esc(Site.url(n.href).replace(/index\.html$/, ''))}</span>`; }
      return `cat: ${esc(a[0])}: No such file`;
    },
    stats: () => statsText(),
    now: () => { if (!window.Live) return '<span class="m">live status is still loading…</span>'; const d = Live.describe(); return d ? esc(d) : '<span class="m">still connecting to Discord… try again in a second</span>'; },
    np: (a) => { if (!window.Live || !Live.setHidden) return 'np: not available'; if (a[0] === 'off') { Live.setHidden(true); return 'now-playing pill hidden'; } if (a[0] === 'on') { Live.setHidden(false); return 'now-playing pill shown (when something is playing)'; } return CMDS.now(); },
    whoami: () => `lukas200301: IT system integration apprentice who builds the tools he wants to use.
A Raspberry Pi controller, a network monitor, and ${R.filter(r => r.group === 'Tools').length} tools plus ${R.filter(r => r.group === 'Games').length} games that live on this site.`,
    socials: () => `github     <a href="${Site.LINKS.github}" target="_blank" rel="noopener">${Site.LINKS.github.replace('https://', '')}</a>\ninstagram  <a href="${Site.LINKS.instagram}" target="_blank" rel="noopener">${Site.LINKS.instagram.replace('https://', '')}</a>\ndiscord    ${esc(Site.LINKS.discord)}  <span class="m">(type <span class="a">discord</span> to copy)</span>`,
    github: () => { window.open(Site.LINKS.github, '_blank', 'noopener'); return '<span class="m">opening GitHub in a new tab…</span>'; },
    discord: () => { Site.copy(Site.LINKS.discord, 'Discord username copied'); return `copied <b>${esc(Site.LINKS.discord)}</b> to the clipboard`; },
    neofetch: () => neofetch(),
    date: () => esc(new Date().toString()),
    echo: (a) => esc(a.join(' ')),
    history: () => st.hist.map((h, i) => `${String(i + 1).padStart(4)}  ${esc(h)}`).join('\n') || '<span class="m">no history yet</span>',
    clear: () => { out.innerHTML = ''; st.lines = []; save(); return null; },
    cls: () => CMDS.clear(),
    exit: () => { close(); return null; }, quit: () => CMDS.exit(), q: () => CMDS.exit(), ':q': () => CMDS.exit(),
    sudo: () => 'lukas is not in the sudoers file. This incident will be reported. 🙂',
    rm: () => 'rm: nice try. This site is read-only.',
    vim: () => 'vim opened. Just kidding: you would never get out. Type <span class="a">exit</span>.',
    party: () => { Site.party && Site.party(false); return '🎉'; },
    hello: () => 'hi! 👋 type <span class="a">help</span> to see what I can do', hi: () => CMDS.hello(),
    shortcuts: () => `<span class="a">${/Mac/.test(navigator.platform) ? '⌘' : 'Ctrl'}+K</span> jump anywhere · <span class="a">G</span> then <span class="a">H/P/T/G/S</span> go to a section · <span class="a">?</span> all shortcuts · key left of <span class="a">1</span> this terminal`
  };
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
    const [cmd, ...args] = raw.split(/\s+/);
    const fn = CMDS[cmd.toLowerCase()];
    if (fn) { const r = fn(args); if (r != null && r !== '') print(r); return; }
    // a bare path or page name also works: "tools", "snake", "../games"
    const p = resolve(cmd); if (p != null && !args.length) { print(go(p)); return; }
    const f = fuzzy(raw);
    print(`lsh: command not found: ${esc(cmd)}${f.length ? `. Did you mean <span class="a">open ${esc(f[0].path.split('/').pop())}</span>?` : '. Type <span class="a">help</span>.'}`, 'err');
  }

  // ---------- tab completion ----------
  function candidates(v) {
    const parts = v.split(/\s+/);
    if (parts.length === 1) return NAMES.filter(n => n.startsWith(parts[0].toLowerCase())).map(n => n + ' ');
    const cmd = parts[0].toLowerCase(), arg = parts[parts.length - 1], head = v.slice(0, v.length - arg.length);
    if (['cd', 'ls', 'll', 'cat', 'open', 'run', 'play', 'start'].includes(cmd)) {
      const slash = arg.lastIndexOf('/');
      const dirPart = slash >= 0 ? arg.slice(0, slash + 1) : '', namePart = (slash >= 0 ? arg.slice(slash + 1) : arg).toLowerCase();
      const dir = dirPart ? resolve(dirPart) : (cmd === 'open' || cmd === 'run' || cmd === 'play' || cmd === 'start' ? null : here);
      if (dir == null) {   // open: any page name
        return Object.values(nodes).filter(n => n.path && n.path.split('/').pop().startsWith(namePart)).map(n => head + n.path.split('/').pop() + ' ');
      }
      const kids = nodes[dir].children.concat(dirPart ? [] : (here ? ['..'] : []));
      return kids.filter(c => (c === '..' ? '..' : c.split('/').pop()).startsWith(namePart))
        .map(c => head + dirPart + (c === '..' ? '../' : c.split('/').pop() + (nodes[c].children.length ? '/' : ' ')));
    }
    if (cmd === 'np') return ['on', 'off'].filter(x => x.startsWith(arg)).map(x => head + x);
    if (cmd === 'cat') return [];
    return [];
  }
  function common(list) { if (!list.length) return ''; let p = list[0]; list.forEach(s => { while (!s.startsWith(p)) p = p.slice(0, -1); }); return p; }
  let tabLast = 0;
  function complete() {
    const v = input.value, c = candidates(v);
    if (!c.length) return;
    if (c.length === 1) { input.value = c[0]; updGhost(); return; }
    const pre = common(c);
    if (pre.length > v.length) { input.value = pre; updGhost(); return; }
    print(`${ps()} ${esc(v)}\n` + c.map(x => esc(x.trim().split(/\s+/).pop())).join('  '), 'cmd');
    tabLast = Date.now();
  }
  function updGhost() {
    const v = input.value;
    const c = v ? candidates(v) : [];
    ghost.textContent = c.length === 1 && c[0].startsWith(v) ? c[0].slice(v.length) : '';
    ghost.style.left = `calc(var(--ps-w, 0px) + 0.6ch + ${v.length}ch)`;
  }

  // ---------- input ----------
  let hIdx = -1, draft = '';
  root.querySelector('.cli__line').addEventListener('submit', e => { e.preventDefault(); const v = input.value; input.value = ''; hIdx = -1; updGhost(); run(v); });
  input.addEventListener('input', updGhost);
  input.addEventListener('keydown', e => {
    if (e.key === 'Tab') { e.preventDefault(); complete(); return; }
    if (e.key === 'ArrowRight' && ghost.textContent && input.selectionStart === input.value.length) { e.preventDefault(); input.value += ghost.textContent; updGhost(); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); if (!st.hist.length) return; if (hIdx < 0) { draft = input.value; hIdx = st.hist.length; } hIdx = Math.max(0, hIdx - 1); input.value = st.hist[hIdx]; updGhost(); requestAnimationFrame(() => input.setSelectionRange(input.value.length, input.value.length)); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); if (hIdx < 0) return; hIdx++; if (hIdx >= st.hist.length) { hIdx = -1; input.value = draft; } else input.value = st.hist[hIdx]; updGhost(); return; }
    if (e.ctrlKey && e.key.toLowerCase() === 'l') { e.preventDefault(); CMDS.clear(); return; }
    if (e.ctrlKey && e.key.toLowerCase() === 'c' && !window.getSelection().toString()) { e.preventDefault(); print(`${ps()} ${esc(input.value)}^C`, 'cmd'); input.value = ''; updGhost(); return; }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
  });
  out.addEventListener('click', e => {
    const a = e.target.closest('a[data-cd]'); if (!a) return;
    e.preventDefault(); e.stopPropagation(); run('cd ' + disp(a.dataset.cd));
  });
  // close on a click on the dimmed backdrop, but not when a text selection started inside the window and ended out there
  let downOnBackdrop = false;
  root.addEventListener('pointerdown', e => { downOnBackdrop = e.target === root; });
  root.addEventListener('click', e => { if (e.target === root && downOnBackdrop) close(); downOnBackdrop = false; });
  // while open, the terminal owns the keyboard: keys don't reach the page behind it (game controls, G-shortcuts, ?)
  root.addEventListener('keydown', e => { if (!((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) e.stopPropagation(); });
  root.querySelector('.cli__close').addEventListener('click', close);
  body.addEventListener('mouseup', () => { if (!window.getSelection().toString()) input.focus(); });

  // ---------- open / close ----------
  let lastFocus = null, shown = false;
  function open(instant) {
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
    if (!st.booted) {
      st.booted = true;
      print(`<span class="a banner">${esc(BANNER)}</span>`, 'banner');
      print(`Welcome to <b>lsh</b>, the shell of this site. The whole site is a folder you can <span class="a">cd</span> around in.\nType <span class="a">help</span> to see the commands, or try <span class="a">ls</span>, <span class="a">tree</span>, <span class="a">open snake</span>, <span class="a">now</span>.`);
    }
    // measure the prompt so the completion ghost lines up
    requestAnimationFrame(() => { root.style.setProperty('--ps-w', root.querySelector('.cli__ps').offsetWidth + 'px'); input.focus({ preventScroll: true }); body.scrollTop = body.scrollHeight; });
  }
  function close() {
    shown = false;
    root.classList.remove('in', 'instant', 'cli--nav');
    document.documentElement.classList.remove('cli-open');
    st.open = false; save();
    setTimeout(() => { if (!root.classList.contains('in')) root.hidden = true; }, 260);
    if (lastFocus && lastFocus.focus) try { lastFocus.focus({ preventScroll: true }); } catch (e) {}
  }
  window.CLI = { open: () => open(false), close, toggle: () => (shown ? close() : open(false)), run: (c) => { open(true); run(c); } };

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
    out.innerHTML = '';
    st.lines.forEach(([cls, html]) => { const d = document.createElement('div'); d.className = 'cli__ln ' + cls; d.innerHTML = html; out.appendChild(d); });
  }

  function mount() {
    if (!pre) {
      document.body.appendChild(root);
      drawLines();   // restore scrollback from the previous page
    }
    root.querySelector('.cli__ps').innerHTML = ps();
    try { sessionStorage.removeItem('cli-nav'); } catch (e) {}
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
      st.lines = s.lines || []; st.hist = s.hist || []; st.booted = !!s.booted;
      drawLines();
      root.querySelector('.cli__ps').innerHTML = ps(); root.querySelector('.cli__title').textContent = titleFor(here);
      if (s.open) { open(true); requestAnimationFrame(() => { body.scrollTop = body.scrollHeight; }); } else if (shown) close();
    });
    document.querySelectorAll('[data-open-cli]').forEach(b => b.addEventListener('click', () => window.CLI.toggle()));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
