/* Flag quiz using the bundled country data (flags from flagcdn) */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const store = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  // territories that simply fly another country's flag
  const SAME_FLAG = new Set(['BV', 'SJ', 'UM', 'MF', 'HM', 'GP', 'RE', 'YT', 'GF', 'BL', 'PM', 'WF', 'MQ']);
  const ALL = (window.COUNTRIES_DATA || []).filter(c => c.flags && c.flags.svg && !SAME_FLAG.has(c.cca2) && c.region !== 'Antarctic');
  const fmt = (n) => n >= 1e9 ? (n / 1e9).toFixed(2) + ' billion' : n >= 1e6 ? (n / 1e6).toFixed(1) + ' million' : n.toLocaleString('en-US');
  const flagUrl = (c) => c.flags.png && c.flags.png.includes('/w320/') ? c.flags.png.replace('/w320/', '/w640/') : c.flags.svg;

  let opts = { mode: store.get('fq-mode', 'ten'), kind: store.get('fq-kind', 'flag'), region: store.get('fq-region', 'all'), terr: store.get('fq-terr', false) };
  let pool, deck, round, score, streak, best = store.get('fq-best', 0), answer, choices, locked, misses, results, autoNext;

  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }

  function start() {
    pool = ALL.filter(c => (opts.terr || c.independent !== false) && (opts.region === 'all' || c.region === opts.region));
    deck = shuffle(pool.slice());
    round = 0; score = 0; streak = 0; misses = []; results = [];
    $('#msg').hidden = true;
    $('#progress').classList.toggle('streak', opts.mode === 'streak');
    $('#progress').innerHTML = opts.mode === 'ten' ? '<i></i>'.repeat(10) : '';
    next();
  }

  function next() {
    clearTimeout(autoNext);
    if (opts.mode === 'ten' && round >= 10) return end();
    if (!deck.length) deck = shuffle(pool.slice());
    answer = deck.pop();
    // distractors: prefer the same subregion, then same region, then anything
    const others = pool.filter(c => c !== answer);
    const near = shuffle(others.filter(c => c.subregion === answer.subregion));
    const mid = shuffle(others.filter(c => c.region === answer.region && c.subregion !== answer.subregion));
    const far = shuffle(others.filter(c => c.region !== answer.region));
    const picks = [];
    for (const c of [...near.slice(0, 2), ...mid, ...far]) { if (picks.length >= 3) break; if (!picks.includes(c)) picks.push(c); }
    choices = shuffle([answer, ...picks]);
    locked = false;
    round++;
    render();
    // warm the cache for the following flag
    if (deck.length) { const im = new Image(); im.src = flagUrl(deck[deck.length - 1]); }
  }

  function render() {
    const q = $('#question'), o = $('#opts');
    if (opts.kind === 'flag') {
      q.innerHTML = `<div class="fq-flag"><img src="${flagUrl(answer)}" alt="Flag to guess" decoding="async"></div>`;
      o.className = 'fq-opts';
      o.innerHTML = choices.map((c, i) => `<button class="fq-opt" type="button" data-i="${i}" style="animation-delay:${80 + i * 50}ms"><kbd>${i + 1}</kbd><span>${esc(c.name.common)}</span></button>`).join('');
    } else {
      q.innerHTML = `<div class="fq-name">${esc(answer.name.common)}<small>Which flag is it?</small></div>`;
      o.className = 'fq-opts flags';
      o.innerHTML = choices.map((c, i) => `<button class="fq-opt" type="button" data-i="${i}" aria-label="Option ${i + 1}" style="animation-delay:${80 + i * 50}ms"><kbd>${i + 1}</kbd><img src="${flagUrl(c)}" alt="" decoding="async"></button>`).join('');
    }
    $('#info').innerHTML = '';
    $('#roundLbl').textContent = opts.mode === 'ten' ? `Round ${round} / 10` : `Round ${round}`;
    $('#progress').querySelectorAll('i').forEach((el, i) => el.classList.toggle('now', i === round - 1));
    stats();
  }

  function pick(i) {
    if (locked || !choices[i]) return;
    locked = true;
    const ok = choices[i] === answer;
    const btns = $('#opts').querySelectorAll('.fq-opt');
    btns.forEach((b, k) => { b.disabled = true; if (choices[k] === answer) b.classList.add('ok'); });
    if (!ok) { btns[i].classList.add('bad'); misses.push(answer); }
    results.push(ok);
    const bar = $('#progress').querySelectorAll('i')[round - 1];
    if (bar) { bar.classList.remove('now'); bar.classList.add(ok ? 'ok' : 'bad'); }
    if (ok) { score++; streak++; if (streak > best) { best = streak; store.set('fq-best', best); } }
    else streak = 0;
    stats(true);
    const cap = answer.capital && answer.capital[0] ? `Capital ${esc(answer.capital[0])} · ` : '';
    $('#info').innerHTML = `<span>${ok ? '<b class="ok-text">Correct!</b>' : `<b class="err-text">It's ${esc(answer.name.common)}.</b>`} <span class="muted">${cap}${fmt(answer.population || 0)} people · ${esc(answer.subregion || answer.region)}</span></span>
      <button class="btn btn--sm" id="nextBtn">${opts.mode === 'streak' && !ok ? 'See result' : 'Next'} <i class="fas fa-arrow-right"></i></button>`;
    $('#nextBtn').addEventListener('click', advance);
    if (ok) autoNext = setTimeout(advance, 1400);
  }
  function advance() {
    clearTimeout(autoNext);
    if (opts.mode === 'streak' && results[results.length - 1] === false) return end();
    next();
  }

  function end() {
    clearTimeout(autoNext);
    const ten = opts.mode === 'ten';
    const title = ten ? (score === 10 ? 'Perfect 10!' : score >= 7 ? 'Great job!' : score >= 4 ? 'Not bad' : 'Keep practising') : `Streak of ${score}`;
    $('#msgTitle').textContent = title;
    $('#msgText').textContent = ten ? `You got ${score} of 10 right. Best streak ever: ${best}.` : `${score === best && score > 0 ? 'That is your new best!' : `Your best streak is ${best}.`}`;
    $('#review').innerHTML = misses.length ? misses.map(c => `<span><img src="${c.flags.png || c.flags.svg}" alt="">${esc(c.name.common)}</span>`).join('') : '';
    $('#msg').hidden = false;
    if ((ten && score === 10) || (!ten && score >= 10 && score === best)) window.Site && Site.party(false);
  }

  function stats(pop) {
    const set = (id, v) => { const el = $(id), b = el.querySelector('b'); if (b.textContent !== String(v)) { b.textContent = v; if (pop) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); } } };
    set('#sScore', score); set('#sStreak', streak); set('#sBest', best);
  }

  // ---------- input + settings ----------
  $('#opts').addEventListener('click', e => { const b = e.target.closest('.fq-opt'); if (b) pick(+b.dataset.i); });
  document.addEventListener('keydown', e => {
    if (e.target.closest('input, textarea, select, .palette') || e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^[1-4]$/.test(e.key) && $('#msg').hidden) { e.preventDefault(); pick(+e.key - 1); }
    else if (e.key === 'Enter') {
      if (!$('#msg').hidden) { e.preventDefault(); start(); }
      else if (locked) { e.preventDefault(); advance(); }
    }
  });
  function seg(id, key) {
    const el = $(id);
    el.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === opts[key]));
    el.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      el.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
      opts[key] = b.dataset.v; store.set('fq-' + key, opts[key]); start();
    });
  }
  seg('#mode', 'mode'); seg('#kind', 'kind');
  $('#region').value = opts.region;
  $('#region').addEventListener('change', e => { opts.region = e.target.value; store.set('fq-region', opts.region); start(); });
  $('#terr').checked = opts.terr;
  $('#terr').addEventListener('change', e => { opts.terr = e.target.checked; store.set('fq-terr', opts.terr); start(); });
  $('#restart').addEventListener('click', start);
  $('#againBtn').addEventListener('click', start);

  if (!ALL.length) { $('#question').innerHTML = '<p class="err-text">Country data failed to load.</p>'; return; }
  start();
})();
