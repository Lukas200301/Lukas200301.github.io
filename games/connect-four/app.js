/* Connect Four: alpha-beta minimax CPU (easy / medium / hard) or 2 players on one screen */
(function () {
  'use strict';
  const COLS = 7, ROWS = 6, N = COLS * ROWS;
  const ORDER = [3, 2, 4, 1, 5, 0, 6];          // centre first: best move ordering for alpha-beta
  const WIN = 1000000;

  // ---------- engine (board: Int8Array, index c*6+r, r = 0 is the bottom; 1 / -1 / 0) ----------
  const WINDOWS = [];
  (function () {
    const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) for (const [dc, dr] of dirs) {
      const ec = c + dc * 3, er = r + dr * 3;
      if (ec < 0 || ec >= COLS || er < 0 || er >= ROWS) continue;
      WINDOWS.push([0, 1, 2, 3].map(k => (c + dc * k) * ROWS + (r + dr * k)));
    }
  })();   // 69 windows
  const W0 = new Int8Array(WINDOWS.length * 4);
  WINDOWS.forEach((w, i) => w.forEach((x, k) => { W0[i * 4 + k] = x; }));

  function lineAt(b, c, r, side) {      // would a disc of `side` at (c,r) connect four? returns the cells or null
    const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
    for (const [dc, dr] of dirs) {
      const cells = [[c, r]];
      for (const s of [1, -1]) {
        let x = c + dc * s, y = r + dr * s;
        while (x >= 0 && x < COLS && y >= 0 && y < ROWS && b[x * ROWS + y] === side) { cells.push([x, y]); x += dc * s; y += dr * s; }
      }
      if (cells.length >= 4) return cells;
    }
    return null;
  }
  function wins(b, c, r, side) {        // fast boolean version used inside the search
    for (let d = 0; d < 4; d++) {
      const dc = d === 1 ? 0 : 1, dr = d === 0 ? 0 : d === 3 ? -1 : 1;
      let n = 1, x = c + dc, y = r + dr;
      while (x < COLS && y >= 0 && y < ROWS && b[x * ROWS + y] === side) { n++; x += dc; y += dr; }
      x = c - dc; y = r - dr;
      while (x >= 0 && y >= 0 && y < ROWS && b[x * ROWS + y] === side) { n++; x -= dc; y -= dr; }
      if (n >= 4) return true;
    }
    return false;
  }

  // heuristic from the view of `side`: open windows, centre control and threat parity (row of the empty square)
  function evaluate(b, h, side, firstSide) {
    let s = 0;
    for (let r = 0; r < ROWS; r++) { s += b[3 * ROWS + r] * 4; s += (b[2 * ROWS + r] + b[4 * ROWS + r]) * 2; s += b[1 * ROWS + r] + b[5 * ROWS + r]; }
    for (let i = 0; i < W0.length; i += 4) {
      let p = 0, o = 0, e = -1;
      for (let k = 0; k < 4; k++) { const v = b[W0[i + k]]; if (v === 1) p++; else if (v === -1) o++; else e = W0[i + k]; }
      if (p && o) continue;
      if (p === 3) {
        const er = e % ROWS, ec = (e - er) / ROWS;
        s += 22 + (h[ec] === er ? 6 : 0) + (((er & 1) === 0) === (firstSide === 1) ? 10 : 0);
      } else if (o === 3) {
        const er = e % ROWS, ec = (e - er) / ROWS;
        s -= 24 + (h[ec] === er ? 6 : 0) + (((er & 1) === 0) === (firstSide === -1) ? 10 : 0);
      } else if (p === 2) s += 5;
      else if (o === 2) s -= 5;
    }
    return side === 1 ? s : -s;
  }

  // Zobrist keys (two 32-bit halves) for the transposition table
  const Z = [new Uint32Array(N * 2), new Uint32Array(N * 2)];
  for (let i = 0; i < N * 2; i++) { Z[0][i] = (Math.random() * 4294967296) >>> 0; Z[1][i] = (Math.random() * 4294967296) >>> 0; }

  const ABORT = {};
  function search(board, heights, side, opts) {
    // opts: { maxDepth, timeMs, firstSide }
    const b = Int8Array.from(board), h = Int8Array.from(heights);
    const now = typeof performance !== 'undefined' ? () => performance.now() : () => Date.now();
    const deadline = now() + (opts.timeMs || 1e9);
    const firstSide = opts.firstSide || 1;
    let moves = 0; for (let c = 0; c < COLS; c++) moves += h[c];
    let k1 = 0, k2 = 0;
    for (let i = 0; i < N; i++) if (b[i]) { const z = i * 2 + (b[i] === 1 ? 0 : 1); k1 ^= Z[0][z]; k2 ^= Z[1][z]; }
    const tt = new Map();
    let nodes = 0;

    function neg(depth, alpha, beta, s, ply) {
      if ((++nodes & 1023) === 0 && now() > deadline) throw ABORT;
      if (moves === N) return 0;
      for (let c = 0; c < COLS; c++) if (h[c] < ROWS && wins(b, c, h[c], s)) return WIN - ply;
      // opponent threats: two = lost, one = forced block
      let forced = -1, threats = 0;
      for (let c = 0; c < COLS; c++) if (h[c] < ROWS && wins(b, c, h[c], -s)) { threats++; forced = c; }
      if (threats > 1) return -(WIN - ply - 1);
      if (depth <= 0) return evaluate(b, h, s, firstSide);
      const key = (k1 ^ (s === 1 ? 0x9e3779b9 : 0)) >>> 0;
      const e = tt.get(key);
      let ttMove = -1;
      if (e && e.k2 === k2) {
        ttMove = e.m;
        if (e.d >= depth && Math.abs(e.v) < WIN - 100) {
          if (e.f === 0) return e.v;
          if (e.f === 1 && e.v >= beta) return e.v;
          if (e.f === 2 && e.v <= alpha) return e.v;
        }
      }
      const list = forced >= 0 ? [forced] : (ttMove >= 0 ? [ttMove].concat(ORDER.filter(c => c !== ttMove)) : ORDER);
      const a0 = alpha;
      let best = -Infinity, bm = -1;
      for (const c of list) {
        if (h[c] >= ROWS) continue;
        const i = c * ROWS + h[c], z = i * 2 + (s === 1 ? 0 : 1);
        b[i] = s; h[c]++; moves++; k1 ^= Z[0][z]; k2 ^= Z[1][z];
        // the square above a move the opponent could use: avoid playing under their threat (checked by the search itself)
        const v = -neg(depth - 1, -beta, -alpha, -s, ply + 1);
        b[i] = 0; h[c]--; moves--; k1 ^= Z[0][z]; k2 ^= Z[1][z];
        if (v > best) { best = v; bm = c; }
        if (v > alpha) alpha = v;
        if (alpha >= beta) break;
      }
      tt.set(key, { k2, d: depth, v: best, m: bm, f: best <= a0 ? 2 : best >= beta ? 1 : 0 });
      return best;
    }

    function root(depth, prefer) {
      let alpha = -Infinity, best = -Infinity, scores = [];
      const list = prefer >= 0 ? [prefer].concat(ORDER.filter(c => c !== prefer)) : ORDER;
      for (const c of list) {
        if (h[c] >= ROWS) continue;
        if (wins(b, c, h[c], side)) return { move: c, score: WIN, scores: [[c, WIN]] };
        const i = c * ROWS + h[c], z = i * 2 + (side === 1 ? 0 : 1);
        b[i] = side; h[c]++; moves++; k1 ^= Z[0][z]; k2 ^= Z[1][z];
        let v;
        try { v = -neg(depth - 1, -Infinity, -alpha + 1, -side, 1); }   // +1 window keeps equal moves exact for tie-breaks
        finally { b[i] = 0; h[c]--; moves--; k1 ^= Z[0][z]; k2 ^= Z[1][z]; }
        scores.push([c, v]);
        if (v > best) best = v;
        if (v > alpha) alpha = v;
      }
      return { move: scores.filter(x => x[1] === best)[0][0], score: best, scores };
    }

    const maxDepth = Math.min(opts.maxDepth || 42, N - moves);
    let result = null, reached = 0, prefer = -1;
    for (let d = 1; d <= maxDepth; d++) {
      try { result = root(d, prefer); reached = d; prefer = result.move; }
      catch (err) { if (err !== ABORT) throw err; break; }
      if (Math.abs(result.score) >= WIN - 100) break;   // forced result found
    }
    if (!result) { for (const c of ORDER) if (h[c] < ROWS) { result = { move: c, score: 0, scores: [] }; break; } }
    result.depth = reached; result.nodes = nodes;
    return result;
  }

  const ENGINE = { search, wins, lineAt, evaluate, COLS, ROWS, WIN };
  if (typeof module !== 'undefined' && module.exports) { module.exports = ENGINE; return; }
  if (typeof document === 'undefined') return;

  // ---------- UI ----------
  const $ = (s) => document.querySelector(s);
  const store = { get: (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const HINTS = {
    easy: 'Plays mostly at random, but grabs a win now and then.',
    medium: 'Looks four moves ahead and blocks your threats, with the occasional slip.',
    hard: 'Alpha-beta minimax with move ordering, a transposition table and a threat-parity heuristic, searching 8+ moves deep in under 0.3 s.'
  };
  const boardEl = $('#board'), previewEl = $('#preview');
  let mode = store.get('c4-mode', 'cpu'); if (mode !== 'cpu' && mode !== 'pvp') mode = 'cpu';
  let diff = store.get('c4-diff', 'medium'); if (!HINTS[diff]) diff = 'medium';
  const scoreKey = () => mode === 'pvp' ? 'c4-score-pvp' : 'c4-score-cpu-' + diff;
  let score = store.get(scoreKey(), { 1: 0, 2: 0, D: 0 });
  let grid, heights, history, turn, over, busy, starter = 1, cursor = 3, hover = -1, game = 0;

  // players: 1 = You / Player 1 (periwinkle, ring), 2 = CPU / Player 2 (amber, diamond); in the engine 1 -> 1, 2 -> -1
  const val = (p) => p === 1 ? 1 : -1;
  const name = (p) => mode === 'cpu' ? (p === 1 ? 'You' : 'CPU') : 'Player ' + p;

  function build() {
    boardEl.innerHTML = '';
    previewEl.innerHTML = '';
    for (let c = 0; c < COLS; c++) {
      const col = document.createElement('button');
      col.type = 'button'; col.className = 'c4-col'; col.dataset.c = c;
      for (let r = ROWS - 1; r >= 0; r--) { const cell = document.createElement('div'); cell.className = 'c4-cell'; cell.dataset.r = r; col.appendChild(cell); }
      boardEl.appendChild(col);
      const p = document.createElement('i'); p.innerHTML = '<span class="disc"></span>'; previewEl.appendChild(p);
    }
  }
  const cellEl = (c, r) => boardEl.children[c].children[ROWS - 1 - r];

  function newGame() {
    game++;
    queued = -1; grid = new Int8Array(N); heights = new Int8Array(COLS); history = []; over = false; busy = false;
    turn = starter;
    build();
    boardEl.className = 'c4-board';
    $('#line').classList.remove('show');
    refresh();
    if (mode === 'cpu' && turn === 2) cpuTurn();
  }

  function refresh() {
    boardEl.classList.toggle('turn-2', turn === 2);
    boardEl.classList.toggle('busy', busy);
    const humanTurn = !over && !busy && !(mode === 'cpu' && turn === 2);
    [...boardEl.children].forEach((col, c) => {
      const free = ROWS - heights[c];
      col.disabled = over || free === 0;
      col.setAttribute('aria-label', `Column ${c + 1}, ${free ? free + ' free' : 'full'}`);
      col.classList.toggle('hot', humanTurn && c === hover && free > 0);
    });
    [...previewEl.children].forEach((p, c) => {
      const on = humanTurn && c === hover && heights[c] < ROWS;
      p.classList.toggle('on', on);
      p.firstChild.className = 'disc ghost p' + turn;
    });
    // faint landing ghost
    boardEl.querySelectorAll('.disc.ghost').forEach(x => x.remove());
    if (humanTurn && hover >= 0 && heights[hover] < ROWS) {
      const g = document.createElement('span'); g.className = 'disc ghost p' + turn; g.style.opacity = '.14';
      cellEl(hover, heights[hover]).appendChild(g);
    }
    $('#undoBtn').disabled = !history.length || over || busy;
    status();
  }

  function status(winP) {
    const t = $('#turn');
    let html, cls;
    if (over) {
      cls = winP ? 'p' + winP : 'd';
      html = winP ? `<i class="fas fa-trophy"></i><span>${mode === 'cpu' ? (winP === 1 ? 'You win!' : 'CPU wins') : name(winP) + ' wins!'}</span>` : '<i class="fas fa-handshake"></i><span>Board full: draw!</span>';
    } else {
      cls = 'p' + turn;
      const who = mode === 'cpu' ? (turn === 1 ? 'Your turn' : 'CPU is thinking…') : name(turn) + '\'s turn';
      html = `<i class="dot"></i><span>${who}</span>`;
    }
    if (t.dataset.h !== html + cls) { t.className = 'c4-turn ' + cls; t.innerHTML = html; t.dataset.h = html + cls; }
  }

  function drop(c, p) {        // returns a promise that resolves after the animation
    const r = heights[c];
    grid[c * ROWS + r] = val(p); heights[c]++;
    history.push(c);
    boardEl.querySelectorAll('.disc.last').forEach(x => x.classList.remove('last'));
    boardEl.querySelectorAll('.disc.ghost').forEach(x => x.remove());
    previewEl.querySelectorAll('i.on').forEach(x => x.classList.remove('on'));
    const cell = cellEl(c, r);
    const d = document.createElement('span'); d.className = 'disc p' + p + ' last';
    cell.appendChild(d);
    if (reduce || !d.animate) return Promise.resolve({ c, r });
    const from = previewEl.children[c].getBoundingClientRect(), to = cell.getBoundingClientRect();
    const dist = to.top - from.top;
    const dur = Math.max(220, Math.sqrt(Math.max(dist, 1)) * 26);
    const a = d.animate([
      { transform: `translateY(${-dist}px)`, easing: 'cubic-bezier(.5,0,1,.6)' },
      { transform: 'translateY(0)', offset: .72, easing: 'cubic-bezier(0,.4,.6,1)' },
      { transform: `translateY(${-Math.min(18, dist * .07)}px)`, offset: .86, easing: 'cubic-bezier(.4,0,1,1)' },
      { transform: 'translateY(0)' }
    ], { duration: dur });
    return a.finished.then(() => ({ c, r }), () => ({ c, r }));
  }

  let queued = -1;   // a key pressed while a disc is still falling (2-player) is played right after
  async function play(c, byCpu) {
    if (busy && !byCpu && mode === 'pvp' && !over) { queued = c; return; }
    if (over || busy || c < 0 || c >= COLS || heights[c] >= ROWS) return;
    if (!byCpu && mode === 'cpu' && turn === 2) return;
    busy = true; refresh();
    const g = game, p = turn;
    const { r } = await drop(c, p);
    if (g !== game) return;
    busy = false;
    const line = lineAt(grid, c, r, val(p));
    if (line) return end(p, line);
    if (history.length === N) return end(0);
    turn = p === 1 ? 2 : 1;
    refresh();
    if (mode === 'cpu' && turn === 2) cpuTurn();
    else if (queued >= 0) { const q = queued; queued = -1; play(q); }
  }

  function cpuMove() {
    const side = -1;
    const free = [0, 1, 2, 3, 4, 5, 6].filter(c => heights[c] < ROWS);
    const winning = (s) => free.filter(c => wins(grid, c, heights[c], s));
    if (diff === 'easy') {
      const w = winning(side); if (w.length && Math.random() < 0.6) return w[0];
      const bl = winning(1); if (bl.length && Math.random() < 0.35) return bl[0];
      const weights = free.map(c => 4 - Math.abs(3 - c));
      let t = Math.random() * weights.reduce((a, x) => a + x, 0);
      for (let i = 0; i < free.length; i++) { t -= weights[i]; if (t <= 0) return free[i]; }
      return free[free.length - 1];
    }
    if (diff === 'medium') {
      const w = winning(side); if (w.length) return w[0];
      const bl = winning(1); if (bl.length && Math.random() < 0.9) return bl[0];
      if (Math.random() < 0.22) {   // a "human" slip: any move that doesn't hand over an instant win
        const safe = free.filter(c => { if (heights[c] + 1 >= ROWS) return true; grid[c * ROWS + heights[c]] = side; const bad = wins(grid, c, heights[c] + 1, 1); grid[c * ROWS + heights[c]] = 0; return !bad; });
        if (safe.length) return safe[(Math.random() * safe.length) | 0];
      }
      return search(grid, heights, side, { maxDepth: 4, firstSide: val(starter) }).move;
    }
    const res = search(grid, heights, side, { maxDepth: 20, timeMs: 260, firstSide: val(starter) });
    lastInfo = res;
    // break ties between equally good moves so hard mode isn't fully predictable
    const top = res.scores.filter(x => x[1] === res.score).map(x => x[0]);
    return top.length > 1 && res.depth > 2 ? top[(Math.random() * top.length) | 0] : res.move;
  }
  let lastInfo = null;

  function cpuTurn() {
    busy = true; refresh();
    const g = game;
    setTimeout(() => {
      if (g !== game || over) return;
      const t0 = performance.now();
      const m = cpuMove();
      const took = performance.now() - t0;
      if (diff === 'hard' && lastInfo) $('#cpuInfo').textContent = lastInfo.nodes < 50 ? 'Last move: a winning or forced move, found instantly.' : `Last move: searched ${lastInfo.depth} plies deep (${lastInfo.nodes.toLocaleString('en')} positions) in ${Math.round(took)} ms.`;
      setTimeout(() => { if (g !== game) return; busy = false; play(m, true); }, Math.max(0, (diff === 'hard' ? 120 : 380) - took));
    }, 60);
  }

  function end(p, line) {
    over = true; busy = false; hover = -1;
    boardEl.classList.add('over');
    if (p) score[p]++; else score.D++;
    store.set(scoreKey(), score);
    if (line) {
      line.forEach(([c, r]) => cellEl(c, r).querySelector('.disc:not(.ghost)').classList.add('win'));
      drawLine(line);
    }
    refresh(); status(p); scoreUI(p || 'D');
    if (p === 1 && mode === 'cpu' && diff !== 'easy' && window.Site) Site.party(false);
    starter = starter === 1 ? 2 : 1;   // alternate who opens
    $('#scoreHint').textContent = nextHint();
  }
  let lastLine = null;
  function drawLine(line) {
    lastLine = line;
    const sorted = line.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const box = $('#wrap').getBoundingClientRect();
    const ctr = ([c, r]) => { const rc = cellEl(c, r).getBoundingClientRect(); return [rc.left - box.left + rc.width / 2, rc.top - box.top + rc.height / 2]; };
    const [x1, y1] = ctr(sorted[0]), [x2, y2] = ctr(sorted[sorted.length - 1]);
    const ln = $('#lineEl');
    ln.setAttribute('x1', x1); ln.setAttribute('y1', y1); ln.setAttribute('x2', x2); ln.setAttribute('y2', y2);
    const len = Math.hypot(x2 - x1, y2 - y1) + 1;
    ln.style.strokeDasharray = len; ln.style.setProperty('--len', len);
    ln.style.stroke = grid[sorted[0][0] * ROWS + sorted[0][1]] === 1 ? '#dfe5ff' : '#ffe2c2';
    const svg = $('#line'); svg.classList.remove('show'); void svg.getBoundingClientRect();
    setTimeout(() => svg.classList.add('show'), reduce ? 0 : 200);
  }
  window.addEventListener('resize', () => { if (over && lastLine && $('#line').classList.contains('show')) drawLine(lastLine); });

  function undo() {
    if (mode !== 'pvp' || over || busy || !history.length) return;
    const c = history.pop();
    heights[c]--; grid[c * ROWS + heights[c]] = 0;
    const d = cellEl(c, heights[c]).querySelector('.disc:not(.ghost)'); if (d) d.remove();
    if (history.length) { const lc = history[history.length - 1]; const ld = cellEl(lc, heights[lc] - 1).querySelector('.disc'); if (ld) ld.classList.add('last'); }
    turn = turn === 1 ? 2 : 1;
    refresh();
  }

  function nextHint() {
    const who = mode === 'cpu' ? (starter === 1 ? 'You open' : 'The CPU opens') : name(starter) + ' opens';
    return `${who} the next game. The opener alternates every game.`;
  }
  function scoreUI(changed) {
    $('#sc1 b').textContent = score[1]; $('#sc2 b').textContent = score[2]; $('#scD b').textContent = score.D;
    $('#lbl1').textContent = mode === 'cpu' ? 'You' : 'Player 1';
    $('#lbl2').textContent = mode === 'cpu' ? 'CPU' : 'Player 2';
    if (changed) { const el = $(changed === 'D' ? '#scD' : '#sc' + changed); el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
  }

  // ---------- input ----------
  boardEl.addEventListener('click', e => { const col = e.target.closest('.c4-col'); if (col) { cursor = +col.dataset.c; play(cursor); } });
  boardEl.addEventListener('pointermove', e => { if (e.pointerType === 'touch') return; const col = e.target.closest('.c4-col'); const c = col ? +col.dataset.c : -1; if (c !== hover) { hover = c; if (c >= 0) cursor = c; refresh(); } });
  boardEl.addEventListener('pointerleave', () => { hover = -1; refresh(); });
  document.addEventListener('keydown', e => {
    if (e.target.closest('input, textarea, select, .palette, .cli') || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    if (k >= '1' && k <= '7') { e.preventDefault(); cursor = +k - 1; play(cursor); }
    else if (k === 'ArrowLeft' || k === 'ArrowRight') {
      e.preventDefault();
      cursor = Math.max(0, Math.min(COLS - 1, (hover < 0 ? cursor : hover) + (k === 'ArrowLeft' ? -1 : 1)));
      hover = cursor; refresh();
    }
    else if ((k === 'Enter' || k === ' ') && !e.target.closest('button, a')) { e.preventDefault(); if (over) newGame(); else play(hover >= 0 ? hover : cursor); }
    else if (k === 'n' || k === 'N') newGame();
    else if (k === 'u' || k === 'U') undo();
  });
  $('#newBtn').addEventListener('click', newGame);
  $('#undoBtn').addEventListener('click', undo);
  $('#resetScore').addEventListener('click', () => { score = { 1: 0, 2: 0, D: 0 }; store.set(scoreKey(), score); scoreUI(); window.Site && Site.toast('Score reset', 'fas fa-eraser'); });
  function seg(id, get, set) {
    const el = $(id);
    el.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x.dataset.v === get()));
    el.addEventListener('click', e => {
      const btn = e.target.closest('button'); if (!btn) return;
      el.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === btn));
      set(btn.dataset.v);
    });
  }
  function applyMode() {
    const cpu = mode === 'cpu';
    $('#diffField').style.display = cpu ? '' : 'none'; $('#diffHint').style.display = cpu ? '' : 'none';
    $('#cpuInfo').style.display = cpu && diff === 'hard' ? '' : 'none';
    $('#undoBtn').style.display = cpu ? 'none' : ''; $('#kbdUndo').style.display = cpu ? 'none' : '';
    $('#diffHint').textContent = HINTS[diff];
    $('#scoreHint').textContent = nextHint();
  }
  seg('#mode', () => mode, v => { mode = v; store.set('c4-mode', v); score = store.get(scoreKey(), { 1: 0, 2: 0, D: 0 }); starter = 1; applyMode(); scoreUI(); newGame(); });
  seg('#diff', () => diff, v => { diff = v; store.set('c4-diff', v); score = store.get(scoreKey(), { 1: 0, 2: 0, D: 0 }); applyMode(); scoreUI(); newGame(); });

  newGame(); applyMode(); scoreUI();
})();
