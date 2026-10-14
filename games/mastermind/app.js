/* Mastermind (4-peg code, 10 tries, 6/8 colours, duplicates on/off) and Simon (lights + WebAudio tones) */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const store = { get: (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const COLORS = [
    { name: 'Red', icon: 'fa-heart' }, { name: 'Orange', icon: 'fa-sun' }, { name: 'Yellow', icon: 'fa-bolt' }, { name: 'Green', icon: 'fa-leaf' },
    { name: 'Cyan', icon: 'fa-droplet' }, { name: 'Blue', icon: 'fa-moon' }, { name: 'Purple', icon: 'fa-gem' }, { name: 'White', icon: 'fa-snowflake' }
  ];
  const PEGS = 4, TRIES = 10;

  let mode = store.get('mm-mode', 'mastermind'); if (mode !== 'simon') mode = 'mastermind';
  if (location.hash === '#simon') mode = 'simon'; else if (location.hash === '#mastermind') mode = 'mastermind';

  function setStatus(html, cls) { const s = $('#status'); s.className = 'mm-status' + (cls ? ' ' + cls : ''); s.innerHTML = `<span>${html}</span>`; }
  const stat = (label, value, pop) => `<div class="stat${pop ? ' pop' : ''}"><b>${value}</b><span>${label}</span></div>`;

  // ================= Mastermind =================
  let nColors = store.get('mm-colors', 6); if (nColors !== 8) nColors = 6;
  let dups = !!store.get('mm-dups', false);
  let secret, guesses, cur, sel, mmOver;
  const statsKey = () => `mm-stats-${nColors}-${dups ? 'dup' : 'nodup'}`;
  const mmStats = () => store.get(statsKey(), { played: 0, wins: 0, best: null, streak: 0 });
  const pegHTML = (c, extra) => c == null ? `<span class="peg hole ${extra || ''}"></span>` : `<span class="peg has c${c} ${extra || ''}" title="${COLORS[c].name}"><i class="fas ${COLORS[c].icon}"></i></span>`;

  function makeSecret() {
    const pool = [...Array(nColors).keys()];
    const out = [];
    for (let i = 0; i < PEGS; i++) {
      if (dups) out.push((Math.random() * nColors) | 0);
      else out.push(pool.splice((Math.random() * pool.length) | 0, 1)[0]);
    }
    return out;
  }
  function score(guess, code) {   // -> [black, white]
    let k = 0; const gc = Array(8).fill(0), cc = Array(8).fill(0);
    for (let i = 0; i < PEGS; i++) { if (guess[i] === code[i]) k++; else { gc[guess[i]]++; cc[code[i]]++; } }
    let w = 0; for (let c = 0; c < 8; c++) w += Math.min(gc[c], cc[c]);
    return [k, w];
  }
  function mmNew() {
    secret = makeSecret(); guesses = []; cur = Array(PEGS).fill(null); sel = 0; mmOver = false;
    renderPicker(); renderBoard(); mmStatsUI();
    setStatus(`<i class="fas fa-key"></i> Guess the code: ${PEGS} pegs, ${nColors} colors, ${dups ? 'duplicates allowed' : 'no duplicates'}`);
  }
  function renderPicker() {
    $('#picker').innerHTML = COLORS.slice(0, nColors).map((c, i) => `<button type="button" class="peg has c${i}" data-c="${i}" aria-label="${c.name}, key ${i + 1}" title="${c.name} (${i + 1})"><i class="fas ${c.icon}"></i><kbd>${i + 1}</kbd></button>`).join('');
  }
  function renderBoard(anim) {
    const rows = [];
    const reveal = mmOver;
    rows.push(`<div class="mm-row secret"><span class="n"><i class="fas fa-lock${reveal ? '-open' : ''}"></i></span><div class="slots">${secret.map(c => reveal ? pegHTML(c, 'reveal') : '<span class="peg masked">?</span>').join('')}</div><span class="fb" style="visibility:hidden"><i></i><i></i><i></i><i></i></span></div>`);
    for (let r = 0; r < TRIES; r++) {
      const g = guesses[r];
      let cls = 'mm-row', slots, fb;
      if (g) {
        slots = g.guess.map(c => pegHTML(c)).join('');
        const pins = Array(g.k).fill('k').concat(Array(g.w).fill('w'));
        while (pins.length < PEGS) pins.push('');
        fb = `<span class="fb${anim === r ? ' show' : ''}" aria-label="${g.k} right spot, ${g.w} wrong spot">${pins.map(p => `<i class="${p}"></i>`).join('')}</span>`;
      } else if (r === guesses.length && !mmOver) {
        cls += ' cur';
        slots = cur.map((c, i) => pegHTML(c, (i === sel ? 'sel ' : '') + (anim === 'pop' + i ? 'pop' : '')).replace('<span class="peg', `<span data-s="${i}" role="button" tabindex="-1" aria-label="Slot ${i + 1}${c != null ? ', ' + COLORS[c].name : ', empty'}" class="peg`)).join('');
        fb = '<span class="fb" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';
      } else {
        cls += ' future';
        slots = Array(PEGS).fill(pegHTML(null)).join('');
        fb = '<span class="fb" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';
      }
      rows.push(`<div class="${cls}"><span class="n">${r + 1}</span><div class="slots">${slots}</div>${fb}</div>`);
    }
    $('#mmBoard').innerHTML = rows.join('');
    $('#checkBtn').disabled = mmOver || cur.some(c => c == null);
    $('#delBtn').disabled = mmOver || cur.every(c => c == null);
    $('#picker').querySelectorAll('button').forEach(b => { b.disabled = mmOver; });
  }
  function pick(c) {
    if (mmOver || c >= nColors) return;
    const i = sel;
    cur[i] = c;
    const next = cur.indexOf(null, i + 1) >= 0 ? cur.indexOf(null, i + 1) : cur.indexOf(null);
    sel = next >= 0 ? next : i;
    renderBoard('pop' + i);
  }
  function removePeg() {
    if (mmOver) return;
    let i = cur[sel] != null ? sel : -1;
    if (i < 0) for (let k = PEGS - 1; k >= 0; k--) if (cur[k] != null) { i = k; break; }
    if (i < 0) return;
    cur[i] = null; sel = i;
    renderBoard();
  }
  function check() {
    if (mmOver || cur.some(c => c == null)) return;
    const [k, w] = score(cur, secret);
    guesses.push({ guess: cur.slice(), k, w });
    const row = guesses.length - 1;
    cur = Array(PEGS).fill(null); sel = 0;
    if (k === PEGS) return mmEnd(true, row);
    if (guesses.length >= TRIES) return mmEnd(false, row);
    renderBoard(row);
    const left = TRIES - guesses.length;
    setStatus(`<i class="fas fa-magnifying-glass"></i> ${k} right spot, ${w} wrong spot · ${left} ${left === 1 ? 'try' : 'tries'} left`, left <= 2 ? 'amber' : '');
  }
  function mmEnd(won, row) {
    mmOver = true;
    const s = mmStats();
    s.played++;
    if (won) { s.wins++; s.streak++; if (s.best == null || guesses.length < s.best) s.best = guesses.length; } else s.streak = 0;
    store.set(statsKey(), s);
    renderBoard(row); mmStatsUI(true);
    if (won) {
      setStatus(`<i class="fas fa-trophy"></i> Cracked in ${guesses.length} ${guesses.length === 1 ? 'try' : 'tries'}! Press <kbd>N</kbd> for a new code`, 'ok');
      window.Site && Site.party(false);
    } else setStatus('<i class="fas fa-lock"></i> Out of tries. The code is revealed above. Press <kbd>N</kbd> to try again', 'err');
  }
  function mmStatsUI(pop) {
    const s = mmStats();
    $('#stats').innerHTML = stat('Wins', s.wins, pop) + stat('Played', s.played) + stat('Best (tries)', s.best == null ? '–' : s.best) + stat('Win streak', s.streak);
  }
  $('#mmBoard').addEventListener('click', e => {
    const p = e.target.closest('.mm-row.cur .peg'); if (!p) return;
    const i = +p.dataset.s;
    if (sel === i && cur[i] != null) cur[i] = null;   // tap a selected peg again to clear it
    sel = i; renderBoard();
  });
  $('#picker').addEventListener('click', e => { const b = e.target.closest('button'); if (b) pick(+b.dataset.c); });
  $('#delBtn').addEventListener('click', removePeg);
  $('#checkBtn').addEventListener('click', check);
  $('#newBtn').addEventListener('click', mmNew);
  $('#dups').checked = dups;
  $('#dups').addEventListener('change', e => { dups = e.target.checked; store.set('mm-dups', dups); mmNew(); });

  // ================= Simon =================
  const FREQ = [329.63, 261.63, 220.0, 164.81];   // E4 C4 A3 E3, like the original toy
  let muted = !!store.get('simon-muted', false);
  let actx = null;
  function audio() {
    if (muted) return null;
    try {
      if (!actx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; actx = new AC(); }
      if (actx.state === 'suspended') actx.resume();
      return actx;
    } catch (e) { return null; }
  }
  function tone(freq, dur, type, vol) {
    const ctx = audio(); if (!ctx) return;
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = type || 'sine'; o.frequency.value = freq;
    f.type = 'lowpass'; f.frequency.value = 2400;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.12, t + 0.015);
    g.gain.setValueAtTime(vol || 0.12, t + Math.max(0.02, dur / 1000 - 0.08));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur / 1000 + 0.12);
    o.connect(f); f.connect(g); g.connect(ctx.destination);
    o.start(t); o.stop(t + dur / 1000 + 0.15);
  }
  const pads = [...document.querySelectorAll('#simon .pad')];
  let seq = [], step = 0, accepting = false, sGame = 0, sRunning = false, sRound = 0, startBest = 0;
  const sBest = () => store.get('simon-best', 0);

  function light(i, dur) {
    const p = pads[i];
    p.classList.add('lit'); tone(FREQ[i], dur);
    clearTimeout(p._t); p._t = setTimeout(() => p.classList.remove('lit'), dur);
  }
  const speed = () => { const d = Math.max(200, 520 - sRound * 22); return { on: d, gap: Math.max(90, d * 0.45) }; };
  async function playSeq() {
    const g = sGame;
    accepting = false; $('#simon').classList.remove('input');
    setStatus(`<i class="fas fa-eye"></i> Watch… round ${sRound}`, 'amber');
    await sleep(650);
    const { on, gap } = speed();
    for (const i of seq) {
      if (g !== sGame) return;
      light(i, on);
      await sleep(on + gap);
    }
    if (g !== sGame) return;
    step = 0; accepting = true; $('#simon').classList.add('input');
    setStatus(`<i class="fas fa-hand-pointer"></i> Your turn: repeat ${seq.length} step${seq.length > 1 ? 's' : ''}`);
  }
  function simonStart() {
    audio();   // unlock audio on this user gesture
    sGame++; sRunning = true; seq = []; sRound = 0; startBest = sBest();
    $('#simonStart').hidden = true;
    nextRound();
  }
  function nextRound() {
    sRound++; seq.push((Math.random() * 4) | 0);
    $('#simonRound').textContent = sRound; $('#simonLbl').textContent = 'Round';
    simonStats(true);
    playSeq();
  }
  function press(i) {
    if (!sRunning || !accepting) return;
    light(i, 220);
    if (seq[step] !== i) return simonFail(i);
    step++;
    if (step === seq.length) {
      accepting = false; $('#simon').classList.remove('input');
      const best = sBest();
      if (sRound > best) store.set('simon-best', sRound);
      setStatus(`<i class="fas fa-check"></i> Round ${sRound} cleared${sRound > startBest && startBest > 0 ? ' · new best!' : ''}`, 'ok');
      simonStats();
      const g = sGame; setTimeout(() => { if (g === sGame) nextRound(); }, 750);
    }
  }
  function simonFail(i) {
    accepting = false; sRunning = false; sGame++;
    $('#simon').classList.remove('input');
    setTimeout(() => tone(110, 420, 'triangle', 0.09), 60);
    const s = $('#simon'); if (!reduce) { s.classList.remove('shake'); void s.offsetWidth; s.classList.add('shake'); }
    // show which pad was right
    const right = seq[step];
    setTimeout(() => pads[right].classList.add('lit'), 500); setTimeout(() => pads[right].classList.remove('lit'), 1100);
    const reached = sRound - 1, isBest = reached > startBest;
    setStatus(`<i class="fas fa-xmark"></i> Wrong pad. You completed ${reached} round${reached === 1 ? '' : 's'}.${isBest ? ' New best!' : ''}`, 'err');
    if (isBest && startBest > 0 && window.Site) Site.party(false);
    $('#simonRound').textContent = reached; $('#simonLbl').textContent = 'Final';
    $('#simonStart').hidden = false; $('#simonStart').innerHTML = '<i class="fas fa-rotate"></i>Again';
    simonStats();
  }
  function simonStop() {
    sGame++; sRunning = false; accepting = false; seq = []; sRound = 0;
    pads.forEach(p => p.classList.remove('lit'));
    $('#simon').classList.remove('input');
    $('#simonRound').textContent = '–'; $('#simonLbl').textContent = 'Round';
    $('#simonStart').hidden = false; $('#simonStart').innerHTML = '<i class="fas fa-play"></i>Start';
  }
  function simonIdle() {
    simonStop();
    setStatus('<i class="fas fa-circle-play"></i> Press Start, then repeat the pattern');
    simonStats();
  }
  function simonStats(pop) {
    $('#stats').innerHTML = stat('Round', sRound || '–', pop) + stat('Best round', sBest() || '–') + stat('Steps', seq.length || '–') + stat('Sound', muted ? 'Off' : 'On');
  }
  $('#simon').addEventListener('pointerdown', e => {
    const p = e.target.closest('.pad'); if (!p || e.button > 0) return;
    e.preventDefault(); press(+p.dataset.i);
  });
  $('#simon').addEventListener('click', e => { const p = e.target.closest('.pad'); if (p && e.detail === 0) press(+p.dataset.i); });   // keyboard activation of a focused pad
  $('#simonStart').addEventListener('click', simonStart);
  $('#sound').checked = !muted;
  $('#sound').addEventListener('change', e => { muted = !e.target.checked; store.set('simon-muted', muted); simonStats(); });

  // ================= mode + keys =================
  function applyMode() {
    const mm = mode === 'mastermind';
    $('#mmView').hidden = !mm; $('#simonView').hidden = mm;
    $('#mmSide').hidden = !mm; $('#mmHelp').hidden = !mm; $('#simonSide').hidden = mm;
    $('#kbd').innerHTML = mm
      ? `<span><kbd>1</kbd>–<kbd>${nColors}</kbd> place a color</span><span><kbd>←</kbd><kbd>→</kbd> pick slot</span><span><kbd>Backspace</kbd> remove</span><span><kbd>Enter</kbd> check</span><span><kbd>N</kbd> new code</span>`
      : '<span><kbd>Q</kbd><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd> or <kbd>1</kbd>–<kbd>4</kbd> pads</span><span><kbd>Space</kbd> start</span><span><kbd>M</kbd> mute</span>';
    if (mm) { simonStop(); mmNew(); } else simonIdle();
  }
  document.addEventListener('keydown', e => {
    if (e.target.closest('input, textarea, select, .palette, .cli') || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    if (mode === 'mastermind') {
      if (/^[1-8]$/.test(k)) { e.preventDefault(); pick(+k - 1); }
      else if (k === 'Backspace' || k === 'Delete') { e.preventDefault(); removePeg(); }
      else if (k === 'Enter' && !e.target.closest('button, a')) { e.preventDefault(); if (mmOver) mmNew(); else check(); }
      else if (k === 'ArrowLeft' || k === 'ArrowRight') { e.preventDefault(); if (!mmOver) { sel = (sel + (k === 'ArrowLeft' ? PEGS - 1 : 1)) % PEGS; renderBoard(); } }
      else if (k === 'n' || k === 'N') mmNew();
    } else {
      const map = { q: 0, w: 1, a: 2, s: 3, 1: 0, 2: 1, 3: 2, 4: 3 };
      const lk = k.toLowerCase();
      if (lk in map) { e.preventDefault(); if (!e.repeat) press(map[lk]); }
      else if (k === ' ' || (k === 'Enter' && !e.target.closest('button, a'))) { e.preventDefault(); if (!sRunning) simonStart(); }
      else if (lk === 'm') { muted = !muted; store.set('simon-muted', muted); $('#sound').checked = !muted; simonStats(); window.Site && Site.toast(muted ? 'Sound off' : 'Sound on', muted ? 'fas fa-volume-xmark' : 'fas fa-volume-high'); }
    }
  });
  function seg(id, get, set) {
    const el = $(id);
    el.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x.dataset.v === String(get())));
    el.addEventListener('click', e => {
      const btn = e.target.closest('button'); if (!btn) return;
      el.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === btn));
      set(btn.dataset.v); btn.blur();
    });
  }
  seg('#mode', () => mode, v => { mode = v; store.set('mm-mode', v); try { history.replaceState(null, '', '#' + v); } catch (e) {} applyMode(); });
  seg('#colors', () => nColors, v => { nColors = +v; store.set('mm-colors', nColors); applyMode(); });

  window.addEventListener('hashchange', () => {
    const v = location.hash.slice(1);
    if ((v === 'simon' || v === 'mastermind') && v !== mode) {
      mode = v; store.set('mm-mode', v);
      document.querySelectorAll('#mode button').forEach(x => x.setAttribute('aria-pressed', x.dataset.v === v));
      applyMode();
    }
  });

  applyMode();
})();
