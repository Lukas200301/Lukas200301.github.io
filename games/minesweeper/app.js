/* Minesweeper: safe first click, flags, chording, cascade reveal animation */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const LEVELS = { easy: [9, 9, 10], medium: [16, 16, 40], hard: [30, 16, 99] };
  const board = $('#board');
  const store = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  let level = store.get('ms-level', 'easy');
  let W, H, M, cells, state, opened, flags, t0, timer, flagMode = false;

  const idx = (x, y) => y * W + x;
  function around(i) {
    const x = i % W, y = (i / W) | 0, out = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < W && ny < H) out.push(idx(nx, ny));
    }
    return out;
  }

  function fit() {
    // cell size so the board fits the panel width (min 26px; hard scrolls on phones)
    const avail = board.parentElement.clientWidth - 12;
    const c = Math.max(26, Math.min(W <= 9 ? 46 : 38, Math.floor((avail - 8) / W) - 3));
    board.style.setProperty('--c', c + 'px');
  }

  function newGame() {
    [W, H, M] = LEVELS[level];
    // on narrow screens play hard rotated (16 wide) so it fits better
    if (level === 'hard' && board.parentElement.clientWidth < 700) [W, H] = [16, 30];
    cells = Array.from({ length: W * H }, () => ({ mine: false, n: 0, open: false, flag: false }));
    state = 'ready'; opened = 0; flags = 0; clearInterval(timer); t0 = 0;
    board.className = 'ms';
    board.style.gridTemplateColumns = `repeat(${W}, var(--c))`;
    board.innerHTML = cells.map((_, i) => `<button type="button" data-i="${i}" aria-label="Hidden square" style="--d:${(i % W + ((i / W) | 0)) * 8}ms"></button>`).join('');
    // little entrance wave
    board.querySelectorAll('button').forEach(b => { b.animate([{ opacity: 0, transform: 'scale(.7)' }, { opacity: 1, transform: 'none' }], { duration: 380, delay: parseInt(b.style.getPropertyValue('--d')), easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' }); });
    $('#msg').hidden = true;
    fit(); stats();
  }

  function plant(safe) {
    const banned = new Set([safe, ...around(safe)]);
    const pool = cells.map((_, i) => i).filter(i => !banned.has(i));
    for (let k = 0; k < M; k++) { const j = k + ((Math.random() * (pool.length - k)) | 0); [pool[k], pool[j]] = [pool[j], pool[k]]; cells[pool[k]].mine = true; }
    cells.forEach((c, i) => { c.n = around(i).filter(j => cells[j].mine).length; });
    state = 'play'; t0 = performance.now();
    timer = setInterval(stats, 250);
  }

  function btn(i) { return board.children[i]; }
  function paint(i, delay = 0) {
    const c = cells[i], b = btn(i);
    b.className = ''; b.innerHTML = '';
    if (c.open) {
      b.classList.add('open'); b.style.setProperty('--d', delay + 'ms');
      if (c.mine) { b.classList.add('mine'); b.innerHTML = '<i class="fas fa-bomb"></i>'; }
      else if (c.n) { b.classList.add('n' + c.n); b.textContent = c.n; }
      b.setAttribute('aria-label', c.mine ? 'Mine' : c.n ? `${c.n} adjacent mines` : 'Empty');
    } else if (c.flag) { b.classList.add('flag'); b.innerHTML = '<i class="fas fa-flag"></i>'; b.setAttribute('aria-label', 'Flagged'); }
    else b.setAttribute('aria-label', 'Hidden square');
  }

  function reveal(start) {
    // breadth-first so the cascade ripples outward from the click
    const q = [[start, 0]], seen = new Set([start]);
    while (q.length) {
      const [i, d] = q.shift(), c = cells[i];
      if (c.open || c.flag) continue;
      c.open = true; opened++;
      paint(i, Math.min(d * 28, 700));
      if (c.mine) return lose(i);
      if (c.n === 0) around(i).forEach(j => { if (!seen.has(j) && !cells[j].open && !cells[j].flag) { seen.add(j); q.push([j, d + 1]); } });
    }
  }

  function clickCell(i) {
    if (state === 'over') return;
    const c = cells[i];
    if (flagMode && !c.open) return toggleFlag(i);
    if (c.flag) return;
    if (state === 'ready') plant(i);
    if (c.open) { chord(i); }
    else reveal(i);
    if (state === 'play' && opened === W * H - M) winGame();
    stats();
  }
  function chord(i) {
    const c = cells[i]; if (!c.n) return;
    const nb = around(i), f = nb.filter(j => cells[j].flag).length;
    if (f !== c.n) { // not enough flags: briefly highlight the neighbours
      nb.forEach(j => { if (!cells[j].open) btn(j).classList.add('hl'); });
      setTimeout(() => nb.forEach(j => btn(j).classList.remove('hl')), 220);
      return;
    }
    nb.forEach(j => { if (state === 'play' && !cells[j].open && !cells[j].flag) reveal(j); });
  }
  function toggleFlag(i) {
    const c = cells[i];
    if (c.open || state === 'over') return;
    c.flag = !c.flag; flags += c.flag ? 1 : -1;
    paint(i); stats();
    if (navigator.vibrate) navigator.vibrate(15);
  }

  function lose(i) {
    state = 'over'; clearInterval(timer);
    btn(i).classList.add('boom');
    // reveal remaining mines with a stagger, mark wrong flags
    const mines = cells.map((c, j) => j).filter(j => j !== i && cells[j].mine && !cells[j].flag);
    mines.sort((a, b) => dist(a, i) - dist(b, i)).forEach((j, k) => setTimeout(() => { cells[j].open = true; paint(j); }, 80 + k * 35));
    cells.forEach((c, j) => { if (c.flag && !c.mine) { btn(j).classList.add('wrong'); btn(j).innerHTML = '<i class="fas fa-xmark"></i>'; } });
    setTimeout(() => msg('Boom.', 'You hit a mine. The first click is always safe, the rest is up to you.'), 500 + Math.min(mines.length * 35, 1200));
  }
  const dist = (a, b) => Math.hypot(a % W - b % W, ((a / W) | 0) - ((b / W) | 0));
  function winGame() {
    state = 'over'; clearInterval(timer);
    const t = (performance.now() - t0) / 1000;
    cells.forEach((c, i) => { if (c.mine && !c.flag) { c.flag = true; paint(i); } });
    flags = M; board.classList.add('won');
    const key = 'ms-best-' + level, best = store.get(key, null);
    const record = best == null || t < best;
    if (record) store.set(key, +t.toFixed(1));
    stats();
    window.Site && Site.party(false);
    setTimeout(() => msg(record ? 'New best time!' : 'Cleared!', `${t.toFixed(1)} seconds on ${level}.${!record ? ` Your best is ${best}s.` : ''}`), 700);
  }
  function msg(t, p) { $('#msgTitle').textContent = t; $('#msgText').textContent = p; $('#msg').hidden = false; }

  function stats() {
    const left = M - flags;
    const set = (id, v) => { const b = $(id + ' b'); if (b.textContent !== String(v)) b.textContent = v; };
    set('#sMines', left);
    set('#sTime', state === 'play' ? Math.floor((performance.now() - t0) / 1000) : state === 'ready' ? 0 : $('#sTime b').textContent);
    const best = store.get('ms-best-' + level, null);
    set('#sBest', best == null ? '–' : best + 's');
  }

  // ---------- input ----------
  board.addEventListener('click', e => { const b = e.target.closest('button'); if (b) clickCell(+b.dataset.i); });
  board.addEventListener('contextmenu', e => { const b = e.target.closest('button'); if (!b) return; e.preventDefault(); const i = +b.dataset.i; cells[i].open ? clickCell(i) : toggleFlag(i); });
  // long-press to flag on touch
  let lp, lpFired = false;
  board.addEventListener('touchstart', e => {
    const b = e.target.closest('button'); if (!b) return;
    lpFired = false;
    lp = setTimeout(() => { lpFired = true; toggleFlag(+b.dataset.i); }, 380);
  }, { passive: true });
  ['touchend', 'touchmove', 'touchcancel'].forEach(ev => board.addEventListener(ev, e => { clearTimeout(lp); if (lpFired && ev === 'touchend') e.preventDefault(); }));
  // middle-click chord
  board.addEventListener('mousedown', e => { if (e.button === 1) { const b = e.target.closest('button'); if (b) { e.preventDefault(); const i = +b.dataset.i; if (cells[i].open) { chord(i); if (state === 'play' && opened === W * H - M) winGame(); stats(); } } } });

  function setFlagMode(v) { flagMode = v; $('#flagMode').setAttribute('aria-pressed', v); }
  $('#flagMode').addEventListener('click', () => setFlagMode(!flagMode));
  $('#newBtn').addEventListener('click', newGame);
  $('#againBtn').addEventListener('click', newGame);
  document.addEventListener('keydown', e => {
    if (e.target.closest('input, textarea, .palette') || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'f' || e.key === 'F') setFlagMode(!flagMode);
    if (e.key === 'n' || e.key === 'N') newGame();
  });
  $('#level').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.l === level));
  $('#level').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    $('#level').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
    level = b.dataset.l; store.set('ms-level', level); newGame();
  });
  let rw; window.addEventListener('resize', () => { clearTimeout(rw); rw = setTimeout(fit, 120); });

  newGame();
})();
