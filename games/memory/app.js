/* Tech memory: match pairs of devicon logos */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const store = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  // [devicon class, label, colour that reads well on a dark card]
  const ICONS = [
    ['javascript-plain', 'JavaScript', '#f7df1e'], ['typescript-plain', 'TypeScript', '#4a8fe0'], ['python-plain', 'Python', '#ffd845'],
    ['java-plain', 'Java', '#f89820'], ['csharp-plain', 'C#', '#b46fd8'], ['cplusplus-plain', 'C++', '#659ad2'],
    ['go-plain', 'Go', '#00add8'], ['rust-plain', 'Rust', '#f74c00'], ['php-plain', 'PHP', '#8892bf'],
    ['ruby-plain', 'Ruby', '#e0322b'], ['swift-plain', 'Swift', '#f05138'], ['kotlin-plain', 'Kotlin', '#a97bff'],
    ['html5-plain', 'HTML', '#e34f26'], ['css3-plain', 'CSS', '#2a8fe6'], ['react-original', 'React', '#61dafb'],
    ['vuejs-plain', 'Vue', '#41b883'], ['docker-plain', 'Docker', '#2496ed'], ['git-plain', 'Git', '#f05032'],
    ['nodejs-plain', 'Node.js', '#83cd29'], ['raspberrypi-plain', 'Raspberry Pi', '#e0306a'], ['svelte-plain', 'Svelte', '#ff3e00'],
    ['tailwindcss-plain', 'Tailwind', '#38bdf8'], ['postgresql-plain', 'PostgreSQL', '#6d9eeb'], ['bash-plain', 'Bash', '#4eaa25'],
    ['dart-plain', 'Dart', '#2cb7f6'], ['lua-plain', 'Lua', '#7b8cff'], ['redis-plain', 'Redis', '#ff4438']
  ];
  const board = $('#board');
  let n = +store.get('mm-size', 4), cards, first, second, lock, moves, pairs, t0, timer;

  const fmtT = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }

  function newGame() {
    const need = n * n / 2;
    const set = shuffle(ICONS.slice()).slice(0, need);
    cards = shuffle([...set, ...set].map((ic, i) => ({ ic, id: i })));
    first = second = null; lock = false; moves = 0; pairs = 0; t0 = 0; clearInterval(timer);
    board.style.cssText = `--n: ${n}`;
    board.innerHTML = cards.map((c, i) => `<button class="mm-card" type="button" data-i="${i}" aria-label="Hidden card" style="--d:${i * 22}ms">
      <span class="mm-back"></span>
      <span class="mm-face" style="--ic:${c.ic[2]}"><i class="devicon-${c.ic[0]}"></i><small>${c.ic[1]}</small></span>
    </button>`).join('');
    $('#msg').hidden = true;
    stats();
  }

  function flip(i) {
    const el = board.children[i];
    if (lock || el.classList.contains('up') || el.classList.contains('done')) return;
    if (!t0) { t0 = performance.now(); timer = setInterval(stats, 500); }
    el.classList.add('up'); el.setAttribute('aria-label', cards[i].ic[1]);
    if (first == null) { first = i; return; }
    second = i; moves++;
    const a = board.children[first], b = el;
    if (cards[first].ic === cards[second].ic) {
      lock = true;
      setTimeout(() => {
        [a, b].forEach(x => { x.classList.add('done', 'match'); x.classList.remove('up'); });
        pairs++; first = second = null; lock = false; stats(true);
        if (pairs === n * n / 2) win();
      }, 380);
    } else {
      lock = true;
      setTimeout(() => { a.classList.add('miss'); b.classList.add('miss'); }, 420);
      setTimeout(() => {
        [a, b].forEach(x => { x.classList.remove('up', 'miss'); x.setAttribute('aria-label', 'Hidden card'); });
        first = second = null; lock = false;
      }, 1000);
    }
    stats(true);
  }

  function win() {
    clearInterval(timer);
    const secs = (performance.now() - t0) / 1000;
    const key = 'mm-best-' + n, best = store.get(key, null);
    const record = !best || moves < best.moves || (moves === best.moves && secs < best.secs);
    if (record) store.set(key, { moves, secs: +secs.toFixed(1) });
    stats();
    // victory wave across the board
    Array.from(board.children).forEach((c, i) => c.animate([{ transform: 'rotateY(180deg)' }, { transform: 'rotateY(180deg) translateY(-10px)' }, { transform: 'rotateY(180deg)' }], { duration: 500, delay: i * 25, easing: 'cubic-bezier(.34,1.56,.64,1)' }));
    setTimeout(() => {
      $('#msgTitle').textContent = record ? 'New best!' : 'All pairs found!';
      $('#msgText').textContent = `${moves} moves in ${fmtT(secs)}. A perfect game is ${n * n / 2} moves.${!record ? ` Your best: ${best.moves} moves.` : ''}`;
      $('#msg').hidden = false;
      window.Site && Site.party(false);
    }, 600 + n * n * 25);
  }

  function stats(pop) {
    const set = (id, v) => { const el = $(id), b = el.querySelector('b'); if (b.textContent !== String(v)) { b.textContent = v; if (pop) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); } } };
    set('#sMoves', moves); set('#sPairs', `${pairs}/${n * n / 2}`);
    set('#sTime', fmtT(t0 ? (performance.now() - t0) / 1000 : 0));
    const best = store.get('mm-best-' + n, null);
    set('#sBest', best ? `${best.moves} mv` : '–');
  }

  board.addEventListener('click', e => { const b = e.target.closest('.mm-card'); if (b) flip(+b.dataset.i); });
  $('#newBtn').addEventListener('click', newGame);
  $('#againBtn').addEventListener('click', newGame);
  $('#size').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', +b.dataset.v === n));
  $('#size').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    $('#size').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
    n = +b.dataset.v; store.set('mm-size', n); newGame();
  });
  newGame();
})();
