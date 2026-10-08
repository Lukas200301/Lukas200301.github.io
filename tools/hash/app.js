/* Hash & checksum generator: MD5 + CRC32 implemented here, SHA via Web Crypto */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);

  // ---------- MD5 (RFC 1321) on a Uint8Array ----------
  function md5(bytes) {
    const K = new Int32Array(64), S = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
    for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) | 0;
    const len = bytes.length, total = ((len + 8) >>> 6) + 1, words = new Int32Array(total * 16);
    for (let i = 0; i < len; i++) words[i >> 2] |= bytes[i] << ((i % 4) * 8);
    words[len >> 2] |= 0x80 << ((len % 4) * 8);
    const bitLen = len * 8;
    words[total * 16 - 2] = bitLen >>> 0;
    words[total * 16 - 1] = Math.floor(bitLen / 4294967296);
    let a0 = 0x67452301, b0 = 0xefcdab89 | 0, c0 = 0x98badcfe | 0, d0 = 0x10325476;
    for (let blk = 0; blk < total * 16; blk += 16) {
      let A = a0, B = b0, C = c0, D = d0;
      for (let i = 0; i < 64; i++) {
        let F, g;
        if (i < 16) { F = (B & C) | (~B & D); g = i; }
        else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
        else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
        else { F = C ^ (B | ~D); g = (7 * i) % 16; }
        F = (F + A + K[i] + words[blk + g]) | 0;
        A = D; D = C; C = B;
        B = (B + ((F << S[i]) | (F >>> (32 - S[i])))) | 0;
      }
      a0 = (a0 + A) | 0; b0 = (b0 + B) | 0; c0 = (c0 + C) | 0; d0 = (d0 + D) | 0;
    }
    return [a0, b0, c0, d0].map(w => [0, 8, 16, 24].map(s => ((w >>> s) & 255).toString(16).padStart(2, '0')).join('')).join('');
  }
  // ---------- CRC32 ----------
  const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(bytes) { let c = 0xffffffff; for (let i = 0; i < bytes.length; i++) c = CRC_T[(c ^ bytes[i]) & 255] ^ (c >>> 8); return ((c ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0'); }
  const hex = (buf) => Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');

  const ALGOS = [
    { id: 'md5', name: 'MD5', note: 'not for security', fn: async b => md5(b) },
    { id: 'sha1', name: 'SHA-1', note: 'legacy', fn: async b => hex(await crypto.subtle.digest('SHA-1', b)) },
    { id: 'sha256', name: 'SHA-256', fn: async b => hex(await crypto.subtle.digest('SHA-256', b)) },
    { id: 'sha384', name: 'SHA-384', fn: async b => hex(await crypto.subtle.digest('SHA-384', b)) },
    { id: 'sha512', name: 'SHA-512', fn: async b => hex(await crypto.subtle.digest('SHA-512', b)) },
    { id: 'crc32', name: 'CRC32', note: 'checksum', fn: async b => crc32(b) }
  ];
  const results = {};
  const hashesEl = $('#hashes');
  hashesEl.innerHTML = ALGOS.map(a => `<div data-a="${a.id}"><dt>${a.name}${a.note ? ` <span class="muted">· ${a.note}</span>` : ''}</dt><dd class="busy">…</dd><button class="copy" type="button" aria-label="Copy ${a.name}"><i class="far fa-copy"></i></button></div>`).join('');

  let job = 0;
  async function run(bytes, label) {
    const my = ++job, t0 = performance.now();
    hashesEl.querySelectorAll('dd').forEach(d => d.classList.add('busy'));
    for (const a of ALGOS) {
      let v;
      try { v = await a.fn(bytes); }
      catch (e) { v = a.id.startsWith('sha') ? 'Web Crypto unavailable here (needs https)' : 'error'; }
      if (my !== job) return;                       // a newer input arrived
      results[a.id] = v;
      const dd = hashesEl.querySelector(`[data-a="${a.id}"] dd`);
      dd.textContent = $('#upper').checked ? v.toUpperCase() : v; dd.classList.remove('busy');
    }
    const ms = performance.now() - t0;
    $('#timing').textContent = `${label} · ${fmtSize(bytes.length)} hashed in ${ms < 1000 ? Math.round(ms) + ' ms' : (ms / 1000).toFixed(2) + ' s'}`;
    verify();
  }
  const fmtSize = (n) => n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : n < 1073741824 ? `${(n / 1048576).toFixed(1)} MB` : `${(n / 1073741824).toFixed(2)} GB`;

  function verify() {
    const want = $('#expect').value.replace(/\s+/g, '').toLowerCase();
    const box = $('#verify');
    hashesEl.querySelectorAll('[data-a]').forEach(r => r.classList.remove('match'));
    if (!want) { box.className = 'verify'; box.innerHTML = '<i class="fas fa-shield-halved"></i><span>Paste a checksum to compare it with all hashes on the left.</span>'; return; }
    const hit = ALGOS.find(a => results[a.id] && results[a.id].toLowerCase() === want);
    if (hit) {
      hashesEl.querySelector(`[data-a="${hit.id}"]`).classList.add('match');
      box.className = 'verify ok'; box.innerHTML = `<i class="fas fa-circle-check"></i><span><b>Match.</b> It's the ${hit.name} of this input, so the file is intact.</span>`;
    } else {
      const lens = { 32: 'MD5', 40: 'SHA-1', 64: 'SHA-256', 96: 'SHA-384', 128: 'SHA-512', 8: 'CRC32' };
      box.className = 'verify bad'; box.innerHTML = `<i class="fas fa-circle-xmark"></i><span><b>No match.</b> ${lens[want.length] ? `It looks like a ${lens[want.length]}, but the value differs. ` : ''}The file may be corrupted or different from the one the checksum is for.</span>`;
    }
  }

  // ---------- inputs ----------
  const te = new TextEncoder();
  let t;
  const textEl = $('#text');
  textEl.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => run(te.encode(textEl.value), `Text (${textEl.value.length} chars)`), 120); });
  $('#upper').addEventListener('change', () => { ALGOS.forEach(a => { const dd = hashesEl.querySelector(`[data-a="${a.id}"] dd`); if (results[a.id]) dd.textContent = $('#upper').checked ? results[a.id].toUpperCase() : results[a.id]; }); });
  $('#expect').addEventListener('input', verify);
  hashesEl.addEventListener('click', e => { const b = e.target.closest('.copy'); if (b && window.Site) Site.copy(b.parentElement.querySelector('dd').textContent, 'Hash copied'); });
  $('#tabs').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    $('#tabs').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
    $('#pane-text').hidden = b.dataset.t !== 'text'; $('#pane-file').hidden = b.dataset.t !== 'file';
    if (b.dataset.t === 'text') textEl.dispatchEvent(new Event('input'));
  });
  async function useFile(f) {
    if (!f) return;
    $('#fileInfo').textContent = `${f.name} · ${fmtSize(f.size)}`;
    if (f.size > 1024 * 1024 * 1024) { $('#timing').textContent = 'Files over 1 GB are too large to hash in the browser.'; return; }
    $('#timing').textContent = 'Reading file…';
    const buf = new Uint8Array(await f.arrayBuffer());
    run(buf, f.name);
  }
  const drop = $('#drop');
  $('#file').addEventListener('change', e => useFile(e.target.files[0]));
  drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#file').click(); } });
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => useFile(e.dataTransfer.files[0]));
  // dropping a file anywhere on the page switches to the file tab
  document.addEventListener('dragover', e => e.preventDefault());
  document.addEventListener('drop', e => { if (!drop.contains(e.target) && e.dataTransfer.files[0]) { e.preventDefault(); $('#tabs [data-t="file"]').click(); useFile(e.dataTransfer.files[0]); } });

  textEl.dispatchEvent(new Event('input'));
})();
