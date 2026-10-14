/* Reaction & Aim: reaction time test (5 rounds) and a 30-target aim trainer */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const store = { get: (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const now = () => performance.now();
  const ROUNDS = 5, TARGETS = 30, TYPICAL = 250;
  const DIFFS = {
    easy: { size: 74, life: 2200, label: 'Easy', hint: 'Big targets that live 2.2 s.' },
    medium: { size: 58, life: 1500, label: 'Medium', hint: 'Medium targets that live 1.5 s.' },
    hard: { size: 44, life: 1000, label: 'Hard', hint: 'Small targets that vanish after 1 s.' }
  };

  const stage = $('#stage'), center = $('#center'), field = $('#field'), hud = $('#hud'), msg = $('#msg');
  let mode = store.get('rx-mode', 'reaction'); if (mode !== 'aim') mode = 'reaction';
  let diff = store.get('aim-diff', 'medium'); if (!DIFFS[diff]) diff = 'medium';

  // ---------------- shared ----------------
  function setState(s) { stage.dataset.state = s; }
  function centerHTML(icon, title, text, big) {
    center.innerHTML = (icon ? `<i class="ic fas ${icon}"></i>` : '') + (big != null ? `<div class="big">${big}<small>ms</small></div>` : '') + (title ? `<h3>${title}</h3>` : '') + (text ? `<p>${text}</p>` : '');
  }
  function stat(id, label, value, pop) {
    return `<div class="stat${pop ? ' pop' : ''}" id="${id}"><b>${value}</b><span>${label}</span></div>`;
  }
  function showMsg(title, body) {
    $('#msgTitle').textContent = title; $('#msgBody').innerHTML = body; msg.hidden = false;
    setTimeout(() => $('#againBtn').focus({ preventScroll: true }), 50);
  }

  // ---------------- reaction ----------------
  let rx = { state: 'idle', times: [], fouls: 0, timer: 0, t0: 0, last: null };
  const rxBest = () => store.get('rx-best', null);          // best single reaction (ms)
  const rxBestAvg = () => store.get('rx-best-avg', null);   // best 5-round average (ms)
  const rxHist = () => store.get('rx-history', []);

  function rxIdle() {
    clearTimeout(rx.timer);
    rx = { state: 'idle', times: [], fouls: 0, timer: 0, t0: 0, last: null };
    setState('idle'); msg.hidden = true;
    centerHTML('fa-bolt', 'Reaction time', 'Click, tap or press <kbd>Space</kbd> to start. Wait until the panel turns <b>green</b>, then react as fast as you can. Five rounds.');
    rxDots(); rxStats();
  }
  function rxWait() {
    rx.state = 'wait'; setState('wait');
    centerHTML('fa-hourglass-half', 'Wait for green…', `Round ${rx.times.length + 1} of ${ROUNDS}`);
    rxDots();
    clearTimeout(rx.timer);
    rx.timer = setTimeout(rxGo, 1500 + Math.random() * 3500);
  }
  function rxGo() {
    rx.state = 'go'; setState('go');
    centerHTML('fa-bolt', 'Click!', '');
    rx.t0 = now();
    requestAnimationFrame(() => { if (rx.state === 'go') rx.t0 = now(); });   // closer to when the colour is actually painted
  }
  function rxInput() {
    if (rx.state === 'idle' || rx.state === 'result' || rx.state === 'foul') return rxWait();
    if (rx.state === 'wait') {
      clearTimeout(rx.timer);
      rx.fouls++; rx.state = 'foul'; setState('foul');
      centerHTML('fa-hand', 'Too soon!', 'That was a false start. Click or press <kbd>Space</kbd> to retry this round.');
      return;
    }
    if (rx.state === 'go') {
      const t = Math.max(1, Math.round(now() - rx.t0));
      rx.times.push(t); rx.last = t;
      if (rx.times.length >= ROUNDS) return rxDone();
      rx.state = 'result'; setState('result');
      centerHTML('', '', `${rateShort(t)} · click or press <kbd>Space</kbd> for round ${rx.times.length + 1}`, t);
      rxDots(); rxStats(true);
    }
  }
  function rxDone() {
    rx.state = 'done'; setState('done');
    const avg = Math.round(rx.times.reduce((a, x) => a + x, 0) / rx.times.length), best = Math.min(...rx.times);
    const prevBest = rxBest(), prevAvg = rxBestAvg();
    const newBest = prevBest == null || best < prevBest, newAvg = prevAvg == null || avg < prevAvg;
    if (newBest) store.set('rx-best', best);
    if (newAvg) store.set('rx-best-avg', avg);
    const h = rxHist(); h.push({ avg, best, rounds: rx.times.slice(), fouls: rx.fouls, t: Date.now() }); store.set('rx-history', h.slice(-20));
    centerHTML('', '', '');
    rxDots(); rxStats(true); rxRating(avg); chart();
    showMsg(newAvg && prevAvg != null ? 'New best average!' : 'Results', `
      ${stat('', 'Average', avg + ' ms')}${stat('', 'Best round', best + ' ms')}
      <div class="wide">${rx.times.map(x => x + ' ms').join(' · ')}${rx.fouls ? ` &nbsp;·&nbsp; ${rx.fouls} false start${rx.fouls > 1 ? 's' : ''}` : ''}</div>
      <div class="wide">${rateLong(avg)}</div>`);
    if (newAvg && prevAvg != null && window.Site) Site.party(false);
  }
  function rxDots() {
    $('#dots').innerHTML = Array.from({ length: ROUNDS }, (_, i) => `<i class="${i < rx.times.length ? 'done' : i === rx.times.length && rx.state !== 'idle' ? 'now' : ''}"></i>`).join('');
  }
  function rxStats(pop) {
    const avg = rx.times.length ? Math.round(rx.times.reduce((a, x) => a + x, 0) / rx.times.length) : null;
    $('#stats').innerHTML = stat('sLast', 'Last', rx.last != null ? rx.last + ' ms' : '–', pop) + stat('sAvg', 'Run average', avg != null ? avg + ' ms' : '–')
      + stat('sBestAvg', 'Best average', rxBestAvg() != null ? rxBestAvg() + ' ms' : '–') + stat('sBest', 'Best single', rxBest() != null ? rxBest() + ' ms' : '–');
  }
  function rateShort(t) {
    if (t < 160) return 'Suspiciously fast';
    if (t < 200) return 'Lightning';
    if (t < 230) return 'Excellent';
    if (t < 270) return 'Typical';
    if (t < 330) return 'A bit slow';
    return 'Sleepy';
  }
  function rateLong(avg) {
    const d = TYPICAL - avg;
    return d >= 0 ? `${rateShort(avg)}: ${d} ms faster than the typical ${TYPICAL} ms.` : `${rateShort(avg)}: ${-d} ms slower than the typical ${TYPICAL} ms.`;
  }
  function rxRating(avg) {
    const ref = avg != null ? avg : rxBestAvg();
    const mark = $('#scaleMark');
    if (ref == null) { $('#rating').innerHTML = '<span>Finish a run of five rounds to see how you compare.</span>'; mark.hidden = true; return; }
    $('#rating').innerHTML = `<b>${rateShort(ref)}</b><span>${avg != null ? 'This run' : 'Your best average'}: ${ref} ms. ${rateLong(ref).split(': ')[1]}</span>`;
    mark.hidden = false;
    mark.style.left = Math.max(0, Math.min(100, (ref - 150) / 250 * 100)) + '%';
  }

  // ---------------- aim ----------------
  let aim = null, raf = 0;
  const aimBest = (d) => store.get('aim-best-' + d, null);
  function aimIdle() {
    stopAim();
    setState('idle'); msg.hidden = true; hud.hidden = true; field.innerHTML = '';
    centerHTML('fa-bullseye', 'Aim trainer', `Hit ${TARGETS} targets as they appear. They shrink and vanish, so be quick. Clicking empty space counts as a miss. Click or press <kbd>Space</kbd> to start.`);
    $('#dots').innerHTML = '';
    aimStats(); aimBestUI();
  }
  function stopAim() { cancelAnimationFrame(raf); if (aim) clearTimeout(aim.next); aim = null; }
  function aimStart() {
    stopAim();
    msg.hidden = true; centerHTML('', '', ''); setState('aim');
    const sc = Math.max(.72, Math.min(1, stage.clientWidth / 760));
    aim = { d: DIFFS[diff], size: Math.round(DIFFS[diff].size * sc), n: 0, hits: 0, clicks: 0, expired: 0, times: [], score: 0, target: null, next: 0 };
    hud.hidden = false; field.innerHTML = '';
    aimHud(); aimStats();
    aim.next = setTimeout(spawn, 450);
  }
  function spawn() {
    if (!aim) return;
    if (aim.n >= TARGETS) return aimDone();
    const w = stage.clientWidth, h = stage.clientHeight, r = aim.size / 2 + 6;
    const x = r + Math.random() * Math.max(1, w - 2 * r), y = Math.max(r + 34, r) + Math.random() * Math.max(1, h - 2 * r - 34);
    const t = document.createElement('button');
    t.type = 'button'; t.className = 'rx-target'; t.setAttribute('aria-label', 'Target');
    t.style.cssText = `left:${x}px;top:${y}px;--s:${aim.size}px`;
    field.appendChild(t);
    aim.n++;
    aim.target = { el: t, t0: now(), x, y };
    aimHud();
    tick();
  }
  function tick() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(function loop() {
      if (!aim || !aim.target) return;
      const k = (now() - aim.target.t0) / aim.d.life;
      if (k >= 1) { expire(); return; }
      aim.target.el.style.transform = `scale(${1 - .9 * k})`;
      raf = requestAnimationFrame(loop);
    });
  }
  function fx(x, y, text, cls) {
    const e = document.createElement('div'); e.className = 'rx-fx ' + cls; e.textContent = text; e.style.left = x + 'px'; e.style.top = y + 'px';
    field.appendChild(e); setTimeout(() => e.remove(), 750);
  }
  function clearTarget() { if (aim.target) { aim.target.el.remove(); aim.target = null; } cancelAnimationFrame(raf); }
  function expire() {
    const { x, y } = aim.target;
    clearTarget(); aim.expired++;
    fx(x, y, 'too slow', 'miss');
    aimHud(); aimStats();
    aim.next = setTimeout(spawn, 160);
  }
  function hit() {
    const el = aim.target.el, t = now() - aim.target.t0, { x, y } = aim.target;
    const pts = 100 + Math.round(100 * Math.max(0, 1 - t / aim.d.life));
    clearTarget();
    aim.hits++; aim.clicks++; aim.times.push(t); aim.score += pts;
    fx(x, y, '+' + pts, 'hit');
    const ring = document.createElement('div'); ring.className = 'rx-ring'; ring.style.left = x + 'px'; ring.style.top = y + 'px'; field.appendChild(ring); setTimeout(() => ring.remove(), 500);
    aimHud(); aimStats(true);
    aim.next = setTimeout(spawn, 140);
    return el;
  }
  function miss(x, y) {
    aim.clicks++; aim.score = Math.max(0, aim.score - 20);
    fx(x, y, '× −20', 'miss');
    aimHud(); aimStats();
  }
  function aimNums(a) {
    const misses = (a.clicks - a.hits) + a.expired;
    const acc = a.clicks ? Math.round(a.hits / a.clicks * 100) : 0;
    const avg = a.times.length ? Math.round(a.times.reduce((s, x) => s + x, 0) / a.times.length) : null;
    return { misses, acc, avg };
  }
  function aimHud() {
    if (!aim) return;
    const n = aimNums(aim);
    hud.innerHTML = `<span>Target <b>${Math.min(aim.n, TARGETS)}</b>/${TARGETS}</span><span>Score <b>${aim.score}</b></span><span>Hits <b>${aim.hits}</b></span><span>Misses <b>${n.misses}</b></span>`;
  }
  function aimStats(pop) {
    const a = aim || { hits: 0, clicks: 0, expired: 0, times: [] }, n = aimNums(a);
    $('#stats').innerHTML = stat('sHits', 'Hits', a.hits, pop) + stat('sMiss', 'Misses', n.misses) + stat('sAcc', 'Accuracy', a.clicks ? n.acc + '%' : '–') + stat('sTime', 'Avg time', n.avg != null ? n.avg + ' ms' : '–');
  }
  function aimDone() {
    const a = aim, n = aimNums(a);
    stopAim(); hud.hidden = true;
    setState('done');
    const prev = aimBest(diff);
    const res = { score: a.score, hits: a.hits, misses: n.misses, acc: n.acc, avg: n.avg, t: Date.now() };
    const isBest = !prev || a.score > prev.score;
    if (isBest) store.set('aim-best-' + diff, res);
    const h = store.get('aim-history', []); h.push(Object.assign({ diff }, res)); store.set('aim-history', h.slice(-20));
    $('#stats').innerHTML = stat('sHits', 'Hits', a.hits) + stat('sMiss', 'Misses', n.misses) + stat('sAcc', 'Accuracy', a.clicks ? n.acc + '%' : '–') + stat('sTime', 'Avg time', n.avg != null ? n.avg + ' ms' : '–');
    aimBestUI(); chart();
    showMsg(isBest && prev ? 'New best score!' : 'Round complete', `
      ${stat('', 'Score', a.score)}${stat('', 'Hits', a.hits + ' / ' + TARGETS)}
      ${stat('', 'Accuracy', (a.clicks ? n.acc : 0) + '%')}${stat('', 'Avg time', n.avg != null ? n.avg + ' ms' : '–')}
      <div class="wide">${n.misses} miss${n.misses === 1 ? '' : 'es'} (${a.clicks - a.hits} off-target click${a.clicks - a.hits === 1 ? '' : 's'}, ${a.expired} too slow) · ${DIFFS[diff].label}</div>`);
    if (isBest && prev && window.Site) Site.party(false);
  }
  function aimBestUI() {
    $('#aimBest').innerHTML = Object.keys(DIFFS).map(d => {
      const b = aimBest(d);
      return `<div class="${d === diff ? 'cur' : ''}"><span>Best · ${DIFFS[d].label}</span><b>${b ? `${b.score} pts · ${b.acc}%` : '–'}</b></div>`;
    }).join('');
    $('#diffHint').textContent = DIFFS[diff].hint + ' Score: 100 per hit plus a speed bonus of up to 100, minus 20 per off-target click.';
  }

  // ---------------- chart (history of runs, single series) ----------------
  const tip = document.createElement('div'); tip.className = 'rx-tip'; $('#chart').appendChild(tip);
  function chart() {
    const box = $('#chart');
    const isRx = mode === 'reaction';
    const data = isRx ? rxHist().map(r => ({ v: r.avg, tip: `<b>${r.avg} ms</b> <span>avg · best ${r.best} ms</span>`, t: r.t }))
      : store.get('aim-history', []).map(r => ({ v: r.score, tip: `<b>${r.score} pts</b> <span>${DIFFS[r.diff] ? DIFFS[r.diff].label : ''} · ${r.acc}% · ${r.avg != null ? r.avg + ' ms' : '–'}</span>`, t: r.t }));
    $('#chartTitle').textContent = isRx ? 'Average reaction, last runs' : 'Aim score, last runs';
    $('#chartHint').textContent = isRx ? `Each bar is one 5-round run (lower is better). The dashed line marks the typical ${TYPICAL} ms.` : 'Each bar is one 30-target round (higher is better).';
    const W = Math.max(260, box.clientWidth || 600), H = 200, padL = 40, padR = 10, padT = 14, padB = 22;
    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${isRx ? 'Average reaction time of recent runs' : 'Aim score of recent rounds'}">`;
    if (!data.length) {
      svg += `<text class="empty" x="${W / 2}" y="${H / 2}" text-anchor="middle">No runs yet. Finish one to start your history.</text></svg>`;
      box.innerHTML = svg; box.appendChild(tip); return;
    }
    const maxV = Math.max(...data.map(d => d.v), isRx ? TYPICAL : 0, 1);
    const step = niceStep(maxV / 4), top = Math.ceil(maxV / step) * step;
    const y = (v) => padT + (H - padT - padB) * (1 - v / top);
    svg += '<g class="grid axis">';
    for (let v = 0; v <= top + 1e-9; v += step) svg += `<line x1="${padL}" x2="${W - padR}" y1="${y(v)}" y2="${y(v)}"/><text x="${padL - 8}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
    svg += '</g>';
    const slots = Math.max(data.length, 8), sw = (W - padL - padR) / slots, bw = Math.min(28, sw * .62);
    svg += '<g class="bars">';
    data.forEach((d, i) => {
      const x = padL + sw * i + (sw - bw) / 2, yy = y(d.v), hgt = Math.max(2, y(0) - yy), r = Math.min(4, bw / 2, hgt);
      svg += `<path class="bar" data-i="${i}" d="M${x},${y(0)} V${yy + r} Q${x},${yy} ${x + r},${yy} H${x + bw - r} Q${x + bw},${yy} ${x + bw},${yy + r} V${y(0)} Z"/>`;
      svg += `<rect class="hit" data-i="${i}" x="${padL + sw * i}" y="${padT}" width="${sw}" height="${H - padT - padB}"/>`;
    });
    svg += '</g>';
    if (isRx) svg += `<line class="ref" x1="${padL}" x2="${W - padR}" y1="${y(TYPICAL)}" y2="${y(TYPICAL)}"/><text class="ref-l" x="${W - padR}" y="${y(TYPICAL) - 5}" text-anchor="end">typical ${TYPICAL} ms</text>`;
    svg += `<text class="axis" x="${padL}" y="${H - 4}" style="fill:var(--fg-3);font-family:var(--font-code);font-size:11px">oldest</text><text x="${padL + sw * (data.length - 1) + sw / 2}" y="${H - 4}" text-anchor="middle" style="fill:var(--fg-3);font-family:var(--font-code);font-size:11px">latest</text>`;
    svg += '</svg>';
    box.innerHTML = svg; box.appendChild(tip);
    const s = box.querySelector('svg');
    const show = (e) => {
      const h = e.target.closest('.hit'); if (!h) return hide();
      const i = +h.dataset.i, d = data[i], bar = s.querySelector(`.bar[data-i="${i}"]`);
      s.querySelectorAll('.bar').forEach(b => b.classList.toggle('on', b === bar));
      s.querySelector('.bars').style.setProperty('--dim', 1);
      const br = bar.getBoundingClientRect(), cr = box.getBoundingClientRect();
      tip.innerHTML = `${d.tip}<br><span>${new Date(d.t).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</span>`;
      tip.style.left = Math.max(70, Math.min(cr.width - 70, br.left - cr.left + br.width / 2)) + 'px'; tip.style.top = (br.top - cr.top) + 'px';
      tip.classList.add('on');
    };
    const hide = () => { tip.classList.remove('on'); s.querySelectorAll('.bar.on').forEach(b => b.classList.remove('on')); };
    s.addEventListener('pointermove', show); s.addEventListener('pointerdown', show); s.addEventListener('pointerleave', hide);
  }
  function niceStep(x) { const p = Math.pow(10, Math.floor(Math.log10(x))); const m = x / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p; }
  let rsT = 0; window.addEventListener('resize', () => { clearTimeout(rsT); rsT = setTimeout(chart, 150); });

  // ---------------- mode / input ----------------
  function applyMode() {
    stage.dataset.mode = mode;
    $('#rxSide').hidden = mode !== 'reaction'; $('#aimSide').hidden = mode !== 'aim';
    $('#kbd').innerHTML = mode === 'reaction'
      ? '<span><kbd>Space</kbd> or click / tap: start and react</span><span><kbd>Esc</kbd> reset</span>'
      : '<span><kbd>Space</kbd> start</span><span>click / tap targets</span><span><kbd>Esc</kbd> quit round</span>';
    if (mode === 'reaction') { stopAim(); hud.hidden = true; field.innerHTML = ''; rxIdle(); rxRating(null); }
    else { clearTimeout(rx.timer); rx.state = 'idle'; aimIdle(); }
    chart();
  }
  function primary(e) {     // a press on the stage
    if (!msg.hidden) return;
    if (mode === 'reaction') return rxInput();
    if (!aim) return aimStart();
    if (e && e.clientX != null) {
      const r = stage.getBoundingClientRect();
      if (e.target.closest('.rx-target')) return hit();
      miss(e.clientX - r.left, e.clientY - r.top);
    }
  }
  stage.addEventListener('pointerdown', e => {
    if (e.button !== 0 || e.target.closest('.overlay-msg')) return;
    e.preventDefault();
    if (mode === 'aim' && aim && e.target.closest('.rx-target')) { e.stopPropagation(); return hit(); }
    primary(e);
  });
  document.addEventListener('keydown', e => {
    if (e.target.closest('input, textarea, select, .palette, .cli') || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === ' ' || e.key === 'Spacebar') {
      if (e.repeat) { e.preventDefault(); return; }
      e.preventDefault();
      if (!msg.hidden) { msg.hidden = true; return mode === 'reaction' ? (rxIdle(), rxInput()) : aimStart(); }
      if (mode === 'reaction') rxInput(); else if (!aim) aimStart();
    } else if (e.key === 'Escape') {
      if (mode === 'reaction') { rxIdle(); rxRating(null); } else aimIdle();
    }
  });
  $('#againBtn').addEventListener('click', () => { msg.hidden = true; if (mode === 'reaction') { rxIdle(); rxInput(); } else aimStart(); });
  $('#clearHist').addEventListener('click', () => {
    if (mode === 'reaction') { store.set('rx-history', []); store.set('rx-best', null); store.set('rx-best-avg', null); rxStats(); rxRating(null); }
    else { store.set('aim-history', []); Object.keys(DIFFS).forEach(d => store.set('aim-best-' + d, null)); aimBestUI(); }
    chart(); window.Site && Site.toast('History cleared', 'fas fa-trash-can');
  });
  function seg(id, get, set) {
    const el = $(id);
    el.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x.dataset.v === get()));
    el.addEventListener('click', e => {
      const btn = e.target.closest('button'); if (!btn) return;
      el.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === btn));
      set(btn.dataset.v); btn.blur();
    });
  }
  seg('#mode', () => mode, v => { mode = v; store.set('rx-mode', v); applyMode(); });
  seg('#diff', () => diff, v => { diff = v; store.set('aim-diff', v); aimIdle(); });
  document.addEventListener('visibilitychange', () => {   // don't let a hidden tab ruin a round
    if (!document.hidden) return;
    if (mode === 'reaction' && (rx.state === 'wait' || rx.state === 'go')) { clearTimeout(rx.timer); rx.state = 'foul'; setState('foul'); centerHTML('fa-pause', 'Paused', 'The tab was hidden, so this round is repeated. Click or press <kbd>Space</kbd>.'); }
    if (mode === 'aim' && aim) aimIdle();
  });

  applyMode();
})();
