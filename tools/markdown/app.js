/* Markdown live preview (marked + DOMPurify) */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const src = $('#src'), out = $('#out');
  const KEY = 'md-draft';
  const SAMPLE = `# Hello, Markdown 👋

Write on the left, see it on the right. **Bold**, *italic*, ~~strike~~ and \`inline code\` all work.

## Lists

- Plain bullet
- Nested
  - like this
1. Numbered
2. Lists

### Tasks

- [x] Build the site
- [ ] Add more tools
- [ ] Touch grass

## Code

\`\`\`js
const greet = (name) => \`Hi, \${name}!\`;
console.log(greet('world'));
\`\`\`

## Table

| Tool      | Runs in browser | Fun |
|-----------|:---------------:|----:|
| Hash      | yes             | 7/10 |
| Diff      | yes             | 8/10 |
| Markdown  | yes             | 9/10 |

> Tip: Ctrl+B, Ctrl+I and Ctrl+K work in the editor.

---

[Visit my GitHub](https://github.com/Lukas200301)
`;

  const ready = typeof marked !== 'undefined' && typeof DOMPurify !== 'undefined';
  if (ready) marked.setOptions({ gfm: true, breaks: false });

  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  src.value = saved != null && saved.trim() ? saved : SAMPLE;

  let html = '';
  function render() {
    const md = src.value;
    if (!ready) { out.innerHTML = '<p class="err-text">The Markdown library failed to load. Check your connection and reload.</p>'; return; }
    html = DOMPurify.sanitize(marked.parse(md));
    // morph only changed top-level blocks, so the preview doesn't flash on every keystroke
    const tmp = document.createElement('div'); tmp.innerHTML = html;
    const next = Array.from(tmp.childNodes), cur = Array.from(out.childNodes);
    let firstChanged = null;
    for (let i = 0; i < Math.max(next.length, cur.length); i++) {
      const n = next[i], c = cur[i];
      if (!n) { c.remove(); continue; }
      if (!c) { out.appendChild(n); if (!firstChanged && n.nodeType === 1) firstChanged = n; continue; }
      if (!c.isEqualNode(n)) { out.replaceChild(n, c); if (!firstChanged && n.nodeType === 1) firstChanged = n; }
    }
    out.querySelectorAll('a[href^="http"]').forEach(a => { a.target = '_blank'; a.rel = 'noopener'; });
    out.querySelectorAll('input[type=checkbox]').forEach(c => c.disabled = true);
    if (firstChanged && document.activeElement === src && rendered) { firstChanged.classList.add('flash'); }
    rendered = true;
    const words = (md.match(/[\p{L}\p{N}']+/gu) || []).length;
    $('#mdStats').textContent = `${words} words · ${md.split('\n').length} lines · ${Math.max(1, Math.round(words / 230))} min read`;
    const heads = out.querySelectorAll('h1,h2,h3').length;
    $('#toc').textContent = heads ? `${heads} heading${heads === 1 ? '' : 's'}` : '';
  }
  let rendered = false;
  let t, st;
  src.addEventListener('input', () => {
    clearTimeout(t); t = setTimeout(render, 60);
    clearTimeout(st); st = setTimeout(() => { try { localStorage.setItem(KEY, src.value); } catch (e) {} }, 400);
  });

  // scroll sync: editor → preview by proportion
  src.addEventListener('scroll', () => {
    const p = src.scrollTop / Math.max(1, src.scrollHeight - src.clientHeight);
    out.scrollTop = p * (out.scrollHeight - out.clientHeight);
  });

  // ---------- formatting helpers ----------
  function wrap(before, after = before, placeholder = 'text') {
    const s = src.selectionStart, e = src.selectionEnd, v = src.value;
    const sel = v.slice(s, e) || placeholder;
    src.setRangeText(before + sel + after, s, e, 'end');
    src.setSelectionRange(s + before.length, s + before.length + sel.length);
    src.focus(); src.dispatchEvent(new Event('input'));
  }
  function prefixLines(p) {
    const v = src.value, s = v.lastIndexOf('\n', src.selectionStart - 1) + 1;
    let e = v.indexOf('\n', src.selectionEnd); if (e < 0) e = v.length;
    const block = v.slice(s, e).split('\n').map(l => p + l).join('\n');
    src.setRangeText(block, s, e, 'end'); src.focus(); src.dispatchEvent(new Event('input'));
  }
  const FMT = {
    bold: () => wrap('**'), italic: () => wrap('*'), code: () => {
      const v = src.value.slice(src.selectionStart, src.selectionEnd);
      v.includes('\n') ? wrap('```\n', '\n```', 'code') : wrap('`', '`', 'code');
    },
    link: () => wrap('[', '](https://)', 'link text'), h: () => prefixLines('## '), ul: () => prefixLines('- '),
    task: () => prefixLines('- [ ] '), quote: () => prefixLines('> '),
    table: () => wrap('\n| Column | Column |\n|--------|--------|\n| ', ' | value |\n', 'value')
  };
  $('#fmt').addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (b) FMT[b.dataset.f](); });
  src.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
      const k = e.key.toLowerCase();
      if (k === 'b' || k === 'i' || k === 'k') { e.preventDefault(); e.stopPropagation(); FMT[{ b: 'bold', i: 'italic', k: 'link' }[k]](); }
    }
    if (e.key === 'Tab') { e.preventDefault(); src.setRangeText('  ', src.selectionStart, src.selectionEnd, 'end'); src.dispatchEvent(new Event('input')); }
  });

  // ---------- layout + export ----------
  $('#view').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    $('#view').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
    $('#grid').dataset.v = b.dataset.v;
  });
  const copy = (txt, msg) => window.Site ? Site.copy(txt, msg) : navigator.clipboard.writeText(txt);
  $('#copyMd').addEventListener('click', () => copy(src.value, 'Markdown copied'));
  $('#copyHtml').addEventListener('click', () => copy(html, 'HTML copied'));
  $('#dlHtml').addEventListener('click', () => {
    const title = (src.value.match(/^#\s+(.+)$/m) || [, 'Document'])[1].replace(/[<>&]/g, '');
    const doc = `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${title}</title>\n<style>body{max-width:760px;margin:40px auto;padding:0 20px;font:16px/1.7 system-ui,sans-serif;color:#1f2330}pre{background:#f4f5f8;padding:14px;border-radius:8px;overflow:auto}code{font-family:ui-monospace,monospace}table{border-collapse:collapse}th,td{border:1px solid #ccd;padding:6px 12px}blockquote{border-left:3px solid #ccd;margin:0;padding-left:1em;color:#556}img{max-width:100%}</style>\n</head>\n<body>\n${html}\n</body>\n</html>\n`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([doc], { type: 'text/html' }));
    a.download = (title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'document') + '.html';
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    window.Site && Site.toast('HTML downloaded');
  });

  render();
})();
