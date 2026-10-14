/* Terminal CTF: the game itself lives in the command line (js/cli.js, command `ctf`). This page explains it and shows progress. */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const KEY = 'ctf-progress';
  const TITLES = ['Hidden in plain sight', 'Not encryption', "Julius' note", 'Who got in?', 'Memory dump', 'Git never forgets', 'Who can write?', 'The vault'];
  const N = TITLES.length;
  const fresh = () => ({ v: 1, started: false, solved: [], at: {}, hints: {} });
  const read = () => { try { return Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { return fresh(); } };
  const cur = (P) => { for (let n = 1; n <= N; n++) if (!P.solved.includes(n)) return n; return 0; };
  const cli = (cmd) => { if (window.CLI) window.CLI.run(cmd); else Site.toast('The command line is still loading…', 'fas fa-terminal'); };
  let last = null;

  function render() {
    const P = read(), c = cur(P), done = P.solved.length;
    const hints = Object.values(P.hints || {}).reduce((a, b) => a + (+b || 0), 0);
    const pop = (id, v) => { const el = $(id), b = el.querySelector('b'); if (b.textContent !== String(v)) { b.textContent = v; if (last) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); } } };
    pop('#sFlags', `${done}/${N}`); pop('#sHints', hints);
    $('#bar').style.width = (done / N * 100) + '%';
    $('#levels').innerHTML = TITLES.map((t, i) => {
      const n = i + 1, ok = P.solved.includes(n), open = n === 1 || P.solved.includes(n - 1);
      const cls = ok ? 'done' : n === c ? 'cur' : '';
      const s = ok ? '<i class="fas fa-check"></i>' : n === c ? 'current' : open ? 'open' : '<i class="fas fa-lock"></i>';
      return `<li><button type="button" class="${cls}" data-n="${n}" ${open ? '' : 'disabled'} aria-label="Level ${n}: ${t}${ok ? ', solved' : open ? '' : ', locked'}"><span class="n">${n}</span><span class="t">${t}</span><span class="s">${s}</span></button></li>`;
    }).join('');
    $('#playLabel').textContent = !P.started ? 'Open the command line' : c ? `Continue at level ${c}` : 'Open the command line';
    $('#ctaTitle').textContent = !P.started ? 'Ready when you are' : c ? `${done} of ${N} flags captured` : 'All flags captured';
    $('#ctaText').innerHTML = !P.started ? 'The command line opens over this page and starts the game. Type <code>ctf</code> any time to see where you are.'
      : c ? `Next up: <b>${TITLES[c - 1]}</b>. The button opens the terminal and shows your progress.` : 'You cleared every level. <code>ctf reset</code> (or the button on the right) starts over.';
    $('#resetBtn').disabled = !P.started && !done;
    if (last === null) demo(P);
    last = done;
  }

  // a small, static sample session (no spoilers beyond the first README)
  function demo(P) {
    const n = P.solved.length;
    const ps = (p) => `<span class="u">guest@lukas200301</span>:<span class="p">${p}</span>$ `;
    const lines = [
      ps('~') + 'ctf',
      `<span class="d">Terminal CTF</span>  <b>${n}/${N}</b> flags  <span class="a">${'■'.repeat(n)}${'□'.repeat(N - n)}</span>`,
      ps('~') + 'cd ~/ctf/level1',
      ps('~/ctf/level1') + 'cat README',
      'LEVEL 1 · Hidden in plain sight',
      '<span class="m">The intern swears this folder only holds this README and a todo list…</span>',
      ps('~/ctf/level1') + '<span class="caret"></span>'
    ];
    const body = $('#demo');
    if (Site.reduceMotion) { body.innerHTML = lines.map(l => `<div>${l}</div>`).join(''); return; }
    lines.forEach((l, i) => setTimeout(() => { const d = document.createElement('div'); d.className = 'ln'; d.innerHTML = l; body.appendChild(d); }, 250 + i * 380));
  }

  $('#playBtn').addEventListener('click', () => cli('ctf'));
  $('#levels').addEventListener('click', e => {
    const b = e.target.closest('button[data-n]'); if (!b || b.disabled) return;
    cli(`cd ~/ctf/level${b.dataset.n}; cat README`);
  });
  $('#resetBtn').addEventListener('click', () => {
    if (!confirm('Reset your Terminal CTF progress? All levels except the first will be locked again.')) return;
    try { localStorage.setItem(KEY, JSON.stringify(fresh())); } catch (e) {}
    render();
    Site.toast('CTF progress reset', 'fas fa-rotate-left');
  });
  // the terminal tells us when a flag was submitted on this page; other tabs via the storage event
  window.addEventListener('ctf:progress', render);
  window.addEventListener('storage', e => { if (e.key === KEY) render(); });
  window.addEventListener('pageshow', e => { if (e.persisted) render(); });
  render();
})();
