/* Text diff checker (jsdiff for the line + word diffs, own rendering) */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const esc = (s) => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const A = $('#a'), B = $('#b'), OUT = $('#out');
  let mode = 'split';
  const expanded = new Set();

  const SAMPLE_A = `function greet(name) {
  // say hello
  const msg = "Hello, " + name;
  console.log(msg);
  return msg;
}

const users = ["Ada", "Linus", "Grace"];
for (let i = 0; i < users.length; i++) {
  greet(users[i]);
}

module.exports = greet;
`;
  const SAMPLE_B = `function greet(name, punctuation = "!") {
  // say hello
  const msg = \`Hello, \${name}\${punctuation}\`;
  console.log(msg);
  return msg;
}

const users = ["Ada", "Linus", "Grace", "Margaret"];
users.forEach((u) => greet(u));

export default greet;
`;

  const lines = (t) => { if (!t) return []; const l = t.replace(/\r\n?/g, '\n').split('\n'); if (l[l.length - 1] === '') l.pop(); return l; };

  function compute() {
    const a = lines(A.value), b = lines(B.value);
    const ws = $('#ws').checked, ic = $('#ic').checked;
    const norm = (s) => { if (ws) s = s.replace(/\s+/g, ' ').trim(); if (ic) s = s.toLowerCase(); return s; };
    const parts = Diff.diffArrays(a, b, { comparator: (x, y) => norm(x) === norm(y) });
    // flatten into ops with indices into the original arrays
    const ops = []; let i = 0, j = 0;
    for (const p of parts) {
      const n = p.count != null ? p.count : p.value.length;
      for (let k = 0; k < n; k++) {
        if (p.added) ops.push({ t: 'add', b: j++ });
        else if (p.removed) ops.push({ t: 'del', a: i++ });
        else ops.push({ t: 'eq', a: i++, b: j++ });
      }
    }
    // pair runs of deletions with the following additions → modified lines
    const rows = [];
    for (let k = 0; k < ops.length;) {
      if (ops[k].t === 'eq') { rows.push(ops[k++]); continue; }
      const dels = [], adds = [];
      while (k < ops.length && ops[k].t !== 'eq') (ops[k].t === 'del' ? dels : adds).push(ops[k++]);
      const m = Math.max(dels.length, adds.length);
      for (let x = 0; x < m; x++) {
        if (dels[x] && adds[x]) rows.push({ t: 'mod', a: dels[x].a, b: adds[x].b });
        else if (dels[x]) rows.push(dels[x]); else rows.push(adds[x]);
      }
    }
    return { a, b, rows };
  }

  // word-level highlight for a modified pair; falls back to whole-line when they share little
  function words(x, y) {
    const parts = Diff.diffWordsWithSpace(x, y, { ignoreCase: $('#ic').checked });
    let same = 0; parts.forEach(p => { if (!p.added && !p.removed) same += p.value.length; });
    if (same < Math.max(x.length, y.length) * 0.35) return [esc(x), esc(y)];
    let L = '', R = '';
    for (const p of parts) {
      const v = esc(p.value);
      if (p.added) R += `<ins>${v}</ins>`; else if (p.removed) L += `<del>${v}</del>`; else { L += v; R += v; }
    }
    return [L, R];
  }

  function render() {
    if (typeof Diff === 'undefined') { OUT.innerHTML = '<div class="diff-empty err-text">The diff library failed to load. Check your connection and reload.</div>'; return; }
    const { a, b, rows } = compute();
    let add = 0, del = 0, mod = 0;
    rows.forEach(r => { if (r.t === 'add') add++; else if (r.t === 'del') del++; else if (r.t === 'mod') mod++; });
    const same = rows.length - add - del - mod;
    const total = Math.max(1, rows.length);
    $('#sum').innerHTML = `<div class="stat add"><b>+${add + mod}</b><span>added</span></div><div class="stat del"><b>−${del + mod}</b><span>removed</span></div><div class="stat"><b>${Math.round(same / total * 100)}%</b><span>unchanged</span></div>`;
    if (!a.length && !b.length) { OUT.innerHTML = '<div class="diff-empty"><i class="fas fa-code-compare" style="color:var(--fg-3)"></i>Paste two texts above to compare them.</div>'; return; }
    if (!add && !del && !mod) { OUT.innerHTML = `<div class="diff-empty"><i class="fas fa-circle-check"></i>No differences${$('#ws').checked || $('#ic').checked ? ' (with the current ignore options)' : ''}. The texts are identical.</div>`; return; }

    // fold long unchanged runs, keeping some context around changes
    const CTX = $('#only').checked ? 0 : 3;
    const vis = []; let run = [];
    const flush = (atEnd) => {
      if (!run.length) return;
      const first = vis.length === 0, keepHead = first ? 0 : CTX, keepTail = atEnd ? 0 : CTX;
      const id = run[0].a + ':' + run[0].b;
      if (run.length > keepHead + keepTail + 1 && !expanded.has(id)) {
        vis.push(...run.slice(0, keepHead));
        vis.push({ t: 'fold', n: run.length - keepHead - keepTail, id });
        vis.push(...run.slice(run.length - keepTail));
      } else vis.push(...run);
      run = [];
    };
    rows.forEach(r => { if (r.t === 'eq') run.push(r); else { flush(false); vis.push(r); } });
    flush(true);

    const n = (x) => x == null ? '' : x + 1;
    let h = '';
    if (mode === 'split') {
      h = '<table class="diff"><colgroup><col style="width:52px"><col style="width:22px"><col><col style="width:52px"><col style="width:22px"><col></colgroup><tbody>';
      for (const r of vis) {
        if (r.t === 'fold') { h += `<tr class="fold" data-id="${r.id}"><td colspan="6"><i class="fas fa-up-down"></i>&nbsp; ${r.n} unchanged line${r.n === 1 ? '' : 's'}</td></tr>`; continue; }
        if (r.t === 'eq') h += `<tr><td class="n">${n(r.a)}</td><td class="s"></td><td class="c">${esc(a[r.a])}</td><td class="n">${n(r.b)}</td><td class="s"></td><td class="c">${esc(b[r.b])}</td></tr>`;
        else if (r.t === 'del') h += `<tr><td class="n">${n(r.a)}</td><td class="s del">−</td><td class="c del">${esc(a[r.a])}</td><td class="n"></td><td class="s"></td><td class="c empty"></td></tr>`;
        else if (r.t === 'add') h += `<tr><td class="n"></td><td class="s"></td><td class="c empty"></td><td class="n">${n(r.b)}</td><td class="s add">+</td><td class="c add">${esc(b[r.b])}</td></tr>`;
        else { const [L, R] = words(a[r.a], b[r.b]); h += `<tr><td class="n">${n(r.a)}</td><td class="s del">−</td><td class="c del">${L}</td><td class="n">${n(r.b)}</td><td class="s add">+</td><td class="c add">${R}</td></tr>`; }
      }
    } else {
      h = '<table class="diff"><colgroup><col style="width:52px"><col style="width:52px"><col style="width:22px"><col></colgroup><tbody>';
      const delRow = (i, html) => `<tr class="del"><td class="n">${n(i)}</td><td class="n"></td><td class="s">−</td><td class="c">${html}</td></tr>`;
      const addRow = (j, html) => `<tr class="add"><td class="n"></td><td class="n">${n(j)}</td><td class="s">+</td><td class="c">${html}</td></tr>`;
      // in unified view, show a block's removals before its additions (like git)
      for (let k = 0; k < vis.length;) {
        const r = vis[k];
        if (r.t === 'fold') { h += `<tr class="fold" data-id="${r.id}"><td colspan="4"><i class="fas fa-up-down"></i>&nbsp; ${r.n} unchanged line${r.n === 1 ? '' : 's'}</td></tr>`; k++; continue; }
        if (r.t === 'eq') { h += `<tr><td class="n">${n(r.a)}</td><td class="n">${n(r.b)}</td><td class="s"></td><td class="c">${esc(a[r.a])}</td></tr>`; k++; continue; }
        let D = '', I = '';
        while (k < vis.length && vis[k].t !== 'eq' && vis[k].t !== 'fold') {
          const x = vis[k++];
          if (x.t === 'del') D += delRow(x.a, esc(a[x.a]));
          else if (x.t === 'add') I += addRow(x.b, esc(b[x.b]));
          else { const [L, R] = words(a[x.a], b[x.b]); D += delRow(x.a, L); I += addRow(x.b, R); }
        }
        h += D + I;
      }
    }
    OUT.innerHTML = h + '</tbody></table>';
  }

  let t;
  const later = () => { clearTimeout(t); t = setTimeout(render, 150); };
  [A, B].forEach(el => el.addEventListener('input', () => { expanded.clear(); later(); }));
  ['#ws', '#ic', '#only'].forEach(s => $(s).addEventListener('change', render));
  $('#mode').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    $('#mode').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
    mode = b.dataset.m; render();
  });
  OUT.addEventListener('click', e => { const f = e.target.closest('tr.fold'); if (f) { expanded.add(f.dataset.id); render(); } });
  $('#swap').addEventListener('click', () => { const v = A.value; A.value = B.value; B.value = v; expanded.clear(); render(); });
  $('#sample').addEventListener('click', () => { A.value = SAMPLE_A; B.value = SAMPLE_B; expanded.clear(); render(); });
  $('#copyPatch').addEventListener('click', () => {
    if (typeof Diff === 'undefined') return;
    const p = Diff.createTwoFilesPatch('original', 'changed', A.value, B.value);
    window.Site ? Site.copy(p, 'Unified patch copied') : navigator.clipboard.writeText(p);
  });

  // files: picker or drop onto a textarea
  const load = (f, el) => { if (!f) return; if (f.size > 5 * 1024 * 1024) { window.Site && Site.toast('That file is over 5 MB'); return; } f.text().then(v => { el.value = v; expanded.clear(); render(); }); };
  document.querySelectorAll('input[type=file][data-for]').forEach(inp => inp.addEventListener('change', () => load(inp.files[0], $('#' + inp.dataset.for))));
  [A, B].forEach(el => {
    ['dragenter', 'dragover'].forEach(ev => el.addEventListener(ev, e => { e.preventDefault(); el.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev => el.addEventListener(ev, () => el.classList.remove('over')));
    el.addEventListener('drop', e => { if (e.dataTransfer.files[0]) { e.preventDefault(); load(e.dataTransfer.files[0], el); } });
  });

  A.value = SAMPLE_A; B.value = SAMPLE_B;
  render();
})();
