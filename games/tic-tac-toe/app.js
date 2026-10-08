/* Tic Tac Toe: minimax CPU (easy / medium / hard) or 2 players */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const store = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  const X_SVG = '<svg viewBox="0 0 100 100" class="mx"><path pathLength="100" d="M18 18 L82 82"/><path pathLength="100" d="M82 18 L18 82"/></svg>';
  const O_SVG = '<svg viewBox="0 0 100 100" class="mo"><circle pathLength="100" cx="50" cy="50" r="33"/></svg>';
  const GHOST = (p) => `<svg viewBox="0 0 100 100" class="ghost ${p === 'X' ? 'mx' : 'mo'}" style="filter:none">${p === 'X' ? '<path d="M18 18 L82 82" style="stroke:var(--signal);stroke-dasharray:none;animation:none"/><path d="M82 18 L18 82" style="stroke:var(--signal);stroke-dasharray:none;animation:none"/>' : '<circle cx="50" cy="50" r="33" style="stroke:var(--amber);stroke-dasharray:none;animation:none"/>'}</svg>`;
  const HINTS = { easy: 'Mostly random. Good for warming up.', medium: 'Wins and blocks when it can, but makes mistakes.', hard: 'Plays perfectly with minimax. The best you can do is a draw.' };

  const boardEl = $('#board');
  let mode = store.get('ttt-mode', 'cpu'), diff = store.get('ttt-diff', 'medium');
  let score = store.get('ttt-score-' + mode, { X: 0, O: 0, D: 0 });
  let b, turn, over, starter = 'X', busy = false, round = 0;

  function winner(s) {
    for (const l of LINES) if (s[l[0]] && s[l[0]] === s[l[1]] && s[l[0]] === s[l[2]]) return { p: s[l[0]], line: l };
    return s.every(Boolean) ? { p: 'D' } : null;
  }
  // minimax with depth so it wins fast and loses slow
  function minimax(s, player, depth) {
    const w = winner(s);
    if (w) return { score: w.p === 'O' ? 10 - depth : w.p === 'X' ? depth - 10 : 0 };
    let best = { score: player === 'O' ? -Infinity : Infinity, move: -1 };
    for (let i = 0; i < 9; i++) {
      if (s[i]) continue;
      s[i] = player;
      const r = minimax(s, player === 'O' ? 'X' : 'O', depth + 1);
      s[i] = null;
      if (player === 'O' ? r.score > best.score : r.score < best.score) best = { score: r.score, move: i };
    }
    return best;
  }
  function bestMoves(s) {   // all optimal moves, so hard mode isn't predictable
    const free = s.map((v, i) => v ? -1 : i).filter(i => i >= 0);
    const scored = free.map(i => { s[i] = 'O'; const r = minimax(s, 'X', 1).score; s[i] = null; return [i, r]; });
    const top = Math.max(...scored.map(x => x[1]));
    return scored.filter(x => x[1] === top).map(x => x[0]);
  }
  function finding(s, p) {   // a move that completes a line for p
    for (const l of LINES) { const v = l.map(i => s[i]); if (v.filter(x => x === p).length === 2 && v.includes(null)) return l[v.indexOf(null)]; }
    return -1;
  }
  const rand = (a) => a[(Math.random() * a.length) | 0];
  function cpuMove() {
    const free = b.map((v, i) => v ? -1 : i).filter(i => i >= 0);
    if (diff === 'hard') return rand(bestMoves(b.slice()));
    if (diff === 'medium') {
      const win = finding(b, 'O'); if (win >= 0) return win;
      const block = finding(b, 'X'); if (block >= 0 && Math.random() < 0.85) return block;
      if (Math.random() < 0.5) return rand(bestMoves(b.slice()));
      return rand(free);
    }
    const win = finding(b, 'O'); if (win >= 0 && Math.random() < 0.5) return win;
    return rand(free);
  }

  function newRound() {
    b = Array(9).fill(null); over = false; busy = false;
    turn = starter; round++;
    boardEl.className = 'ttt';
    $('#line').classList.remove('show');
    boardEl.innerHTML = b.map((_, i) => `<button type="button" data-i="${i}" style="--i:${i}" aria-label="Square ${i + 1}, empty"></button>`).join('');
    ghosts(); status();
    if (mode === 'cpu' && turn === 'O') cpuTurn();
  }
  function ghosts() {
    boardEl.querySelectorAll('button').forEach((el, i) => { if (!b[i]) el.innerHTML = over ? '' : GHOST(turn); el.disabled = over || !!b[i]; });
  }

  function play(i) {
    if (over || b[i] || busy) return;
    if (mode === 'cpu' && turn === 'O') return;
    place(i);
    if (!over && mode === 'cpu') cpuTurn();
  }
  function place(i) {
    b[i] = turn;
    const el = boardEl.children[i];
    el.innerHTML = turn === 'X' ? X_SVG : O_SVG; el.disabled = true;
    el.setAttribute('aria-label', `Square ${i + 1}, ${turn}`);
    const w = winner(b);
    if (w) return end(w);
    turn = turn === 'X' ? 'O' : 'X';
    ghosts(); status();
  }
  function cpuTurn() {
    busy = true; boardEl.classList.add('thinking'); status();
    setTimeout(() => { busy = false; boardEl.classList.remove('thinking'); if (!over) place(cpuMove()); }, 380 + Math.random() * 300);
  }

  function end(w) {
    over = true; boardEl.classList.add('over');
    ghosts();
    if (w.p === 'D') score.D++; else score[w.p]++;
    store.set('ttt-score-' + mode, score);
    if (w.line) {
      w.line.forEach(i => boardEl.children[i].classList.add('win', w.p.toLowerCase()));
      const c = (i) => [50 + (i % 3) * 100, 50 + Math.floor(i / 3) * 100];
      const [x1, y1] = c(w.line[0]), [x2, y2] = c(w.line[2]);
      // extend a bit past the outer squares
      const dx = (x2 - x1) * 0.18, dy = (y2 - y1) * 0.18;
      const ln = $('#lineEl');
      ln.setAttribute('x1', x1 - dx); ln.setAttribute('y1', y1 - dy); ln.setAttribute('x2', x2 + dx); ln.setAttribute('y2', y2 + dy);
      ln.style.stroke = w.p === 'X' ? '#c9d3ff' : '#ffd6a8';
      setTimeout(() => $('#line').classList.add('show'), 250);
    }
    status(w);
    scoreUI(w.p);
    if (w.p === 'X' && mode === 'cpu' && diff !== 'easy') window.Site && Site.party(false);
    starter = starter === 'X' ? 'O' : 'X';   // alternate who opens
  }

  function status(w) {
    const t = $('#turn');
    const name = (p) => mode === 'cpu' ? (p === 'X' ? 'You' : 'CPU') : `Player ${p}`;
    let html, cls;
    if (w) {
      cls = w.p === 'D' ? 'd' : w.p.toLowerCase();
      html = w.p === 'D' ? '<i class="fas fa-handshake"></i><span>Draw!</span>' : `<i class="fas fa-trophy"></i><span>${mode === 'cpu' ? (w.p === 'X' ? 'You win!' : 'CPU wins') : `Player ${w.p} wins!`}</span>`;
    } else {
      cls = turn.toLowerCase();
      html = `<i class="dot"></i><span>${busy ? 'CPU is thinking…' : mode === 'cpu' && turn === 'X' ? 'Your turn' : `${name(turn)}'s turn`} (${turn})</span>`;
    }
    t.className = 'ttt-turn ' + cls; t.innerHTML = html;
  }
  function scoreUI(changed) {
    $('#scX b').textContent = score.X; $('#scO b').textContent = score.O; $('#scD b').textContent = score.D;
    $('#lblX').textContent = mode === 'cpu' ? 'You (X)' : 'Player X';
    $('#lblO').textContent = mode === 'cpu' ? 'CPU (O)' : 'Player O';
    if (changed) { const el = $(changed === 'D' ? '#scD' : changed === 'X' ? '#scX' : '#scO'); el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
  }

  // ---------- input ----------
  boardEl.addEventListener('click', e => { const el = e.target.closest('button'); if (el) play(+el.dataset.i); });
  const NUMPAD = { 7: 0, 8: 1, 9: 2, 4: 3, 5: 4, 6: 5, 1: 6, 2: 7, 3: 8 };
  document.addEventListener('keydown', e => {
    if (e.target.closest('input, textarea, select, .palette') || e.ctrlKey || e.metaKey || e.altKey) return;
    if (NUMPAD[e.key] != null) { e.preventDefault(); play(NUMPAD[e.key]); }
    else if (e.key === 'n' || e.key === 'N' || (e.key === 'Enter' && over && !e.target.closest('button'))) newRound();
  });
  $('#nextBtn').addEventListener('click', newRound);
  $('#resetScore').addEventListener('click', () => { score = { X: 0, O: 0, D: 0 }; store.set('ttt-score-' + mode, score); scoreUI(); });
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
    $('#diffField').style.display = mode === 'cpu' ? '' : 'none'; $('#diffHint').style.display = mode === 'cpu' ? '' : 'none';
    $('#diffHint').textContent = HINTS[diff];
  }
  seg('#mode', () => mode, v => { mode = v; store.set('ttt-mode', v); score = store.get('ttt-score-' + mode, { X: 0, O: 0, D: 0 }); starter = 'X'; applyMode(); scoreUI(); newRound(); });
  seg('#diff', () => diff, v => { diff = v; store.set('ttt-diff', v); applyMode(); if (!b.some(Boolean) || over) newRound(); });

  applyMode(); scoreUI(); newRound();
})();
