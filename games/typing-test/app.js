/* Code typing test: real snippets, auto-indent, live WPM + accuracy */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const store = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };

  const SNIPPETS = {
    js: { ext: 'js', list: [
`const debounce = (fn, ms = 200) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
};`,
`async function getRepos(user) {
  const res = await fetch(\`https://api.github.com/users/\${user}/repos\`);
  if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
  const repos = await res.json();
  return repos.filter(r => !r.fork).map(r => r.name);
}`,
`const counts = {};
for (const word of text.toLowerCase().split(/\\W+/)) {
  if (!word) continue;
  counts[word] = (counts[word] || 0) + 1;
}
const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);`,
`document.querySelectorAll('[data-reveal]').forEach((el, i) => {
  el.style.transitionDelay = \`\${i * 60}ms\`;
  observer.observe(el);
});`
    ] },
    py: { ext: 'py', list: [
`def fizzbuzz(n):
    for i in range(1, n + 1):
        out = ""
        if i % 3 == 0:
            out += "Fizz"
        if i % 5 == 0:
            out += "Buzz"
        print(out or i)`,
`from collections import Counter

with open("access.log") as f:
    ips = [line.split()[0] for line in f if line.strip()]

for ip, hits in Counter(ips).most_common(5):
    print(f"{ip:<16} {hits}")`,
`class Stack:
    def __init__(self):
        self._items = []

    def push(self, item):
        self._items.append(item)

    def pop(self):
        return self._items.pop() if self._items else None`,
`squares = {n: n ** 2 for n in range(10) if n % 2 == 0}
names = sorted(users, key=lambda u: (u["age"], u["name"]))
total = sum(x for x in values if x > 0)`
    ] },
    sh: { ext: 'sh', list: [
`#!/usr/bin/env bash
set -euo pipefail

for f in *.jpg; do
  convert "$f" -resize 50% "small_\${f}"
  echo "resized $f"
done`,
`du -sh /var/log/* 2>/dev/null | sort -rh | head -n 10`,
`if ! command -v docker >/dev/null; then
  echo "docker is not installed" >&2
  exit 1
fi
docker compose pull && docker compose up -d`,
`tail -f /var/log/nginx/access.log | grep --line-buffered " 500 " | awk '{print $1, $7}'`
    ] },
    cs: { ext: 'cs', list: [
`public static int Fibonacci(int n)
{
    if (n < 2) return n;
    int a = 0, b = 1;
    for (int i = 2; i <= n; i++)
    {
        (a, b) = (b, a + b);
    }
    return b;
}`,
`var adults = people
    .Where(p => p.Age >= 18)
    .OrderBy(p => p.LastName)
    .Select(p => $"{p.FirstName} {p.LastName}")
    .ToList();`,
`using var client = new HttpClient();
var json = await client.GetStringAsync("https://api.example.com/items");
var items = JsonSerializer.Deserialize<List<Item>>(json);
Console.WriteLine($"Loaded {items?.Count ?? 0} items");`
    ] },
    go: { ext: 'go', list: [
`func reverse(s string) string {
	r := []rune(s)
	for i, j := 0, len(r)-1; i < j; i, j = i+1, j-1 {
		r[i], r[j] = r[j], r[i]
	}
	return string(r)
}`,
`http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	fmt.Fprintln(w, \`{"status":"ok"}\`)
})
log.Fatal(http.ListenAndServe(":8080", nil))`,
`var wg sync.WaitGroup
for _, url := range urls {
	wg.Add(1)
	go func(u string) {
		defer wg.Done()
		fetch(u)
	}(url)
}
wg.Wait()`
    ] }
  };

  const code = $('#code'), input = $('#input'), caret = $('#caret'), stage = $('#stage');
  let lang = store.get('tt-lang', 'any');
  let target = '', curLang = 'js', spans = [], typed = '', autoIdx = new Set();
  let t0 = 0, done = false, keystrokes = 0, errors = 0, samples = [], tick, lastPick = null;

  function pickSnippet() {
    const langs = lang === 'any' ? Object.keys(SNIPPETS) : [lang];
    let l, s, guard = 0;
    do { l = langs[(Math.random() * langs.length) | 0]; s = SNIPPETS[l].list[(Math.random() * SNIPPETS[l].list.length) | 0]; } while (s === lastPick && guard++ < 10);
    lastPick = s; curLang = l;
    load(s);
  }
  function load(s) {
    target = s.replace(/\t/g, '    ');
    $('#fname').textContent = `snippet.${SNIPPETS[curLang].ext}`;
    code.innerHTML = '';
    spans = Array.from(target, ch => {
      const sp = document.createElement('span');
      if (ch === '\n') { sp.className = 'nl'; sp.textContent = '↵\n'; } else sp.textContent = ch;
      code.appendChild(sp);
      return sp;
    });
    reset();
  }
  function reset() {
    typed = ''; input.value = ''; autoIdx.clear();
    t0 = 0; done = false; keystrokes = 0; errors = 0; samples = []; clearInterval(tick);
    spans.forEach(s => s.classList.remove('ok', 'bad', 'auto'));
    stage.classList.remove('typing');
    $('#msg').hidden = true;
    paint(0); stats();
    code.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 400, easing: 'cubic-bezier(.16,1,.3,1)' });
    best();
  }

  // indentation that follows a newline at position i in the target
  const indentAt = (i) => (target.slice(i).match(/^[ ]*/) || [''])[0];

  function onInput() {
    if (done) { input.value = typed; return; }
    let v = input.value;
    if (v.length > target.length) v = v.slice(0, target.length);
    // count new keystrokes / errors only for added characters
    if (v.length > typed.length) {
      if (!t0) { t0 = performance.now(); tick = setInterval(stats, 100); stage.classList.add('typing'); }
      for (let i = typed.length; i < v.length; i++) {
        keystrokes++;
        if (v[i] !== target[i]) errors++;
      }
      // auto-indent after a correct newline
      if (v[v.length - 1] === '\n' && target[v.length - 1] === '\n') {
        const ind = indentAt(v.length);
        for (let k = 0; k < ind.length; k++) autoIdx.add(v.length + k);
        v += ind;
      }
    } else {
      // deleting: also drop auto-typed indentation in one go
      while (v.length && autoIdx.has(v.length - 1)) v = v.slice(0, -1);
      [...autoIdx].forEach(i => { if (i >= v.length) autoIdx.delete(i); });
    }
    const from = Math.min(typed.length, v.length), to = Math.max(typed.length, v.length);
    typed = v; input.value = v;
    paint(from, to);
    stats();
    if (typed.length === target.length && !spans.some(s => s.classList.contains('bad'))) finish();
  }

  function paint(from, to = spans.length) {
    for (let i = from; i < Math.min(to, spans.length); i++) {
      const s = spans[i];
      if (i >= typed.length) { s.classList.remove('ok', 'bad', 'auto'); continue; }
      const good = typed[i] === target[i];
      s.classList.toggle('ok', good); s.classList.toggle('bad', !good); s.classList.toggle('auto', autoIdx.has(i));
    }
    moveCaret();
    $('#bar').style.width = (typed.length / target.length * 100) + '%';
  }
  function moveCaret() {
    const i = typed.length, base = stage.getBoundingClientRect();
    let r, x;
    if (i < spans.length) { r = spans[i].getClientRects()[0]; x = r.left; }
    else { r = spans[i - 1].getClientRects()[0]; x = r.right; }
    if (!r) return;
    caret.style.left = (x - base.left - 1) + 'px';
    caret.style.top = (r.top - base.top + 3) + 'px';
    caret.style.height = (r.height - 6) + 'px';
  }

  function correctCount() { let c = 0; for (let i = 0; i < typed.length; i++) if (typed[i] === target[i] && !autoIdx.has(i)) c++; return c; }
  function stats() {
    const sec = t0 ? ((done ? doneAt : performance.now()) - t0) / 1000 : 0;
    const wpm = sec > 0.5 ? Math.round(correctCount() / 5 / (sec / 60)) : 0;
    const acc = keystrokes ? Math.max(0, Math.round((keystrokes - errors) / keystrokes * 100)) : 100;
    $('#sWpm b').textContent = wpm; $('#sAcc b').textContent = acc + '%'; $('#sTime b').textContent = sec.toFixed(1);
    if (t0 && !done && (!samples.length || sec - samples[samples.length - 1][0] >= 0.5)) samples.push([sec, wpm]);
    return { sec, wpm, acc };
  }
  let doneAt = 0;
  function finish() {
    doneAt = performance.now(); const r = stats(); done = true; clearInterval(tick);
    stage.classList.remove('typing');
    const raw = Math.round(keystrokes / 5 / (r.sec / 60));
    const key = 'tt-best-' + curLang, prev = store.get(key, 0), record = r.wpm > prev;
    if (record) store.set(key, r.wpm);
    $('#msgTitle').textContent = record ? (prev ? 'New personal best!' : 'First run done!') : 'Done!';
    $('#res').innerHTML = [[r.wpm, 'WPM'], [r.acc + '%', 'Accuracy'], [raw, 'Raw WPM'], [r.sec.toFixed(1) + 's', 'Time'], [errors, 'Typos']].map(([v, l]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join('');
    $('#msg').hidden = false;
    drawChart();
    input.blur();
    best();
    if (record && prev) window.Site && Site.party(false);
  }
  function best() { const b = store.get('tt-best-' + curLang, 0); $('#sBest b').textContent = b || '–'; $('#sBest span').textContent = `Best ${SNIPPETS[curLang].ext.toUpperCase()}`; }

  function drawChart() {
    const c = $('#chart'), dpr = Math.min(2, devicePixelRatio || 1), w = c.clientWidth, h = c.clientHeight;
    c.width = w * dpr; c.height = h * dpr;
    const x = c.getContext('2d'); x.scale(dpr, dpr);
    const pts = samples.filter(p => p[0] >= 1);
    if (pts.length < 2) return;
    const maxT = pts[pts.length - 1][0], maxW = Math.max(20, ...pts.map(p => p[1])) * 1.15;
    const X = (t) => 8 + (t - pts[0][0]) / (maxT - pts[0][0] || 1) * (w - 16), Y = (v) => h - 10 - v / maxW * (h - 24);
    const grad = x.createLinearGradient(0, 0, 0, h); grad.addColorStop(0, 'rgba(142,162,255,.35)'); grad.addColorStop(1, 'rgba(142,162,255,0)');
    x.beginPath(); pts.forEach((p, i) => i ? x.lineTo(X(p[0]), Y(p[1])) : x.moveTo(X(p[0]), Y(p[1])));
    x.lineTo(X(maxT), h); x.lineTo(X(pts[0][0]), h); x.closePath(); x.fillStyle = grad; x.fill();
    x.beginPath(); pts.forEach((p, i) => i ? x.lineTo(X(p[0]), Y(p[1])) : x.moveTo(X(p[0]), Y(p[1])));
    x.strokeStyle = '#8ea2ff'; x.lineWidth = 2; x.lineJoin = 'round'; x.stroke();
    x.fillStyle = '#6c789c'; x.font = '11px JetBrains Mono, monospace'; x.fillText('WPM over time', 10, 14);
  }

  // ---------- events ----------
  input.addEventListener('input', onInput);
  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); reset(); input.focus(); return; }
    if (e.key === 'Tab') {
      e.preventDefault();
      if (done) return;
      // jump over expected spaces (handy when a line has alignment)
      let i = typed.length, add = '';
      while (target[i] === ' ') { add += ' '; i++; }
      if (add) { input.value = typed + add; onInput(); }
    }
    if (e.key === 'Enter' && !done && target[typed.length] !== '\n' && typed.length < target.length) { /* still let them mistype */ }
  });
  stage.addEventListener('mousedown', e => { if (!e.target.closest('button, .overlay-msg')) { e.preventDefault(); input.focus(); } });
  document.addEventListener('keydown', e => {
    if (document.activeElement === input || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest('input, textarea, select, .palette, button')) return;
    if (!$('#msg').hidden) { if (e.key === 'Enter') { e.preventDefault(); pickSnippet(); input.focus(); } return; }
    if (e.key.length === 1 && e.key !== '/' && e.key !== '?') { input.focus(); }
  });
  $('#restart').addEventListener('click', () => { reset(); input.focus(); });
  $('#nextBtn').addEventListener('click', () => { pickSnippet(); input.focus(); });
  $('#again').addEventListener('click', () => { reset(); input.focus(); });
  $('#newOne').addEventListener('click', () => { pickSnippet(); input.focus(); });
  $('#lang').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === lang));
  $('#lang').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    $('#lang').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
    lang = b.dataset.v; store.set('tt-lang', lang); pickSnippet(); input.focus();
  });
  window.addEventListener('resize', moveCaret);
  document.fonts && document.fonts.ready.then(moveCaret);

  pickSnippet();
})();
