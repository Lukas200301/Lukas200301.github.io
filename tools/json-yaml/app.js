/* JSON & YAML formatter / validator / converter (YAML via js-yaml) */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const src = $('#src'), out = $('#out'), state = $('#state'), detected = $('#detected'), stats = $('#stats');
  let mode = 'json', indent = 2, lastText = '';
  const esc = (s) => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  const SAMPLE = `{
  "name": "lukas200301.github.io",
  "version": 2,
  "private": true,
  "tools": ["subnet-calculator", "json-yaml", "cron"],
  "server": { "host": "raspberrypi.local", "port": 8443, "tls": true },
  "maintainer": null
}`;

  function sortKeys(v) {
    if (Array.isArray(v)) return v.map(sortKeys);
    if (v && typeof v === 'object') return Object.keys(v).sort((a, b) => a.localeCompare(b)).reduce((o, k) => (o[k] = sortKeys(v[k]), o), {});
    return v;
  }
  function lineCol(text, pos) {
    const before = text.slice(0, pos).split('\n');
    return { line: before.length, col: before[before.length - 1].length + 1 };
  }
  function jsonError(text, e) {
    const msg = e.message;
    let m = msg.match(/line (\d+) column (\d+)/);
    if (m) return { line: +m[1], col: +m[2], msg };
    m = msg.match(/position (\d+)/);
    if (m) { const lc = lineCol(text, +m[1]); return { ...lc, msg }; }
    return { line: null, col: null, msg };
  }
  function parse(text) {
    const t = text.trim();
    if (!t) return { empty: true };
    const looksJson = /^[\[{"]/.test(t) || /^(-?\d|true|false|null)\b/.test(t) && !/:\s/.test(t);
    if (looksJson) {
      try { return { data: JSON.parse(t), kind: 'JSON' }; }
      catch (e) {
        // valid YAML is a superset of JSON-ish text; only fall back if it clearly isn't JSON
        if (/^[\[{]/.test(t)) return { err: jsonError(t, e), kind: 'JSON' };
      }
    }
    if (!window.jsyaml) return { err: { msg: 'YAML support could not load (no internet?). JSON still works.' }, kind: 'YAML' };
    try { return { data: jsyaml.load(t), kind: 'YAML' }; }
    catch (e) { return { err: { line: e.mark ? e.mark.line + 1 : null, col: e.mark ? e.mark.column + 1 : null, msg: e.reason || e.message }, kind: 'YAML' }; }
  }
  function highlightJson(s) {
    return esc(s).replace(/("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false)\b|\bnull\b|-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/g, (m, str, colon, bool) => {
      if (str) return colon ? `<span class="j-key">${str}</span>${colon}` : `<span class="j-str">${str}</span>`;
      if (bool) return `<span class="j-bool">${m}</span>`;
      if (m === 'null') return `<span class="j-null">${m}</span>`;
      return `<span class="j-num">${m}</span>`;
    });
  }
  function highlightYaml(s) {
    return esc(s).split('\n').map(l => l.replace(/^(\s*-?\s*)([^:#\n][^:\n]*?)(:)(\s|$)/, '$1<span class="j-key">$2</span>$3$4')).join('\n');
  }
  function measure(v, d = 0) {
    if (Array.isArray(v)) return v.reduce((a, x) => { const r = measure(x, d + 1); return { keys: a.keys + r.keys, depth: Math.max(a.depth, r.depth) }; }, { keys: 0, depth: d + 1 });
    if (v && typeof v === 'object') return Object.values(v).reduce((a, x) => { const r = measure(x, d + 1); return { keys: a.keys + r.keys, depth: Math.max(a.depth, r.depth) }; }, { keys: Object.keys(v).length, depth: d + 1 });
    return { keys: 0, depth: d };
  }

  function render() {
    const text = src.value;
    const r = parse(text);
    src.classList.remove('is-bad');
    if (r.empty) { out.textContent = ''; lastText = ''; state.className = 'status'; state.textContent = 'Waiting for input'; detected.textContent = ''; stats.textContent = ''; return; }
    if (r.err) {
      src.classList.add('is-bad');
      state.className = 'status err';
      state.innerHTML = `<i class="fas fa-triangle-exclamation"></i>Invalid ${r.kind}${r.err.line ? ` at line ${r.err.line}, column ${r.err.col}` : ''}`;
      detected.textContent = '';
      // show the input with the broken line marked
      out.innerHTML = esc(r.err.msg) + '\n\n' + text.split('\n').map((l, i) => {
        const n = String(i + 1).padStart(4, ' ') + '  ';
        return i + 1 === r.err.line ? `<span class="err-line">${esc(n + l)}</span>` : esc(n + l);
      }).join('\n');
      lastText = ''; stats.textContent = '';
      return;
    }
    let data = r.data;
    if ($('#sort').checked) data = sortKeys(data);
    const ind = indent === 'tab' ? '\t' : indent;
    let txt;
    if (mode === 'json') { txt = JSON.stringify(data, null, ind); out.innerHTML = highlightJson(txt); }
    else if (mode === 'min') { txt = JSON.stringify(data); out.innerHTML = highlightJson(txt); }
    else {
      if (!window.jsyaml) { out.textContent = 'YAML support could not load.'; return; }
      txt = jsyaml.dump(data, { indent: indent === 'tab' ? 2 : indent, lineWidth: 100, noRefs: true, sortKeys: $('#sort').checked });
      out.innerHTML = highlightYaml(txt);
    }
    lastText = txt;
    state.className = 'status ok'; state.innerHTML = `<i class="fas fa-circle-check"></i>Valid ${r.kind}`;
    detected.textContent = `Detected ${r.kind}`;
    const m = measure(data);
    stats.textContent = `${m.keys.toLocaleString('en')} keys · depth ${m.depth} · input ${new Blob([text]).size.toLocaleString('en')} B → output ${new Blob([txt]).size.toLocaleString('en')} B`;
  }

  let t;
  src.addEventListener('input', () => { clearTimeout(t); t = setTimeout(render, 120); });
  src.addEventListener('keydown', e => {                 // Tab inserts spaces instead of leaving the field
    if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); const s = src.selectionStart; src.setRangeText('  ', s, src.selectionEnd, 'end'); render(); }
  });
  const seg = (id, attr, set) => $(id).addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    $(id).querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); set(b.dataset[attr]); render();
  });
  seg('#mode', 'm', v => { mode = v; });
  seg('#indent', 'i', v => { indent = v === 'tab' ? 'tab' : +v; });
  $('#sort').addEventListener('change', render);
  $('#sample').addEventListener('click', () => { src.value = SAMPLE; render(); });
  $('#clear').addEventListener('click', () => { src.value = ''; render(); src.focus(); });
  $('#copyOut').addEventListener('click', () => { if (lastText && window.Site) Site.copy(lastText, 'Output copied'); });
  $('#dlOut').addEventListener('click', () => {
    if (!lastText) return;
    const ext = mode === 'yaml' ? 'yaml' : 'json';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lastText], { type: ext === 'json' ? 'application/json' : 'text/yaml' }));
    a.download = 'formatted.' + ext; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  src.value = SAMPLE; render();
})();
