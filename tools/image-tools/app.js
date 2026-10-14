/* Image tools: resize/convert, favicon generator, EXIF viewer/remover. All local. */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const toast = (m, i) => { if (window.Site) Site.toast(m, i); };
  const KEY = 'image-tools';
  let S = {};
  try { S = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { S = {}; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };

  function fmtBytes(n) {
    if (n == null) return '–';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(n < 10240 ? 1 : 0) + ' kB';
    return (n / 1048576).toFixed(n < 10485760 ? 2 : 1) + ' MB';
  }
  function download(blob, name) {
    const a = document.createElement('a'), url = URL.createObjectURL(blob);
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  function setSeg(seg, attr, val) { $$('button', seg).forEach(b => b.setAttribute('aria-pressed', String(b.dataset[attr] === val))); }
  function segVal(seg, attr) { const b = $('button[aria-pressed="true"]', seg); return b ? b.dataset[attr] : null; }
  function onSeg(seg, attr, fn) { seg.addEventListener('click', e => { const b = e.target.closest('button'); if (!b || b.disabled) return; setSeg(seg, attr, b.dataset[attr]); fn(b.dataset[attr]); }); }
  function wireDrop(drop, input, fn) {
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); if (e.dataTransfer.files.length) fn(Array.from(e.dataTransfer.files)); });
    drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
    input.addEventListener('change', () => { if (input.files.length) fn(Array.from(input.files)); input.value = ''; });
  }
  const baseName = (n) => n.replace(/\.[^.]+$/, '') || 'image';
  const EXT = { 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/png': 'png', 'image/avif': 'avif' };

  /* ---------- CRC32 + ZIP (stored) ---------- */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8) { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  async function makeZip(files) { // [{name, blob}]
    const enc = new TextEncoder(), parts = [], central = [];
    let off = 0;
    const d = new Date(), dt = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xffff, dd = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff;
    for (const f of files) {
      const data = new Uint8Array(await f.blob.arrayBuffer()), name = enc.encode(f.name), crc = crc32(data);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, dt, true); h.setUint16(12, dd, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true);
      h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
      parts.push(h.buffer, name, data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
      c.setUint16(12, dt, true); c.setUint16(14, dd, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
      c.setUint16(28, name.length, true); c.setUint32(42, off, true);
      central.push(c.buffer, name);
      off += 30 + name.length + data.length;
    }
    const csize = central.reduce((a, b) => a + b.byteLength, 0);
    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, csize, true); e.setUint32(16, off, true);
    return new Blob([...parts, ...central, e.buffer], { type: 'application/zip' });
  }
  function uniqueNames(list) { const seen = {}; return list.map(f => { let n = f.name, i = 1; while (seen[n.toLowerCase()]) { n = f.name.replace(/(\.[^.]+)?$/, `-${++i}$1`); } seen[n.toLowerCase()] = 1; return { ...f, name: n }; }); }

  /* ---------- canvas helpers ---------- */
  const canEncode = {};
  ['image/webp', 'image/avif'].forEach(t => { try { const c = document.createElement('canvas'); c.width = c.height = 2; canEncode[t] = c.toDataURL(t).indexOf('data:' + t) === 0; } catch (e) { canEncode[t] = false; } });
  canEncode['image/jpeg'] = canEncode['image/png'] = true;
  function toBlob(canvas, type, q) { return new Promise((res, rej) => canvas.toBlob(b => (b ? res(b) : rej(new Error('Encoding failed'))), type, q)); }
  async function decode(file) {
    if (window.createImageBitmap) {
      try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { /* fall back to <img> */ }
    }
    return new Promise((res, rej) => { const u = URL.createObjectURL(file), im = new Image(); im.onload = () => res(im); im.onerror = () => { URL.revokeObjectURL(u); rej(new Error('Not an image the browser can read')); }; im.src = u; });
  }
  const dims = (src) => ({ w: src.naturalWidth || src.width, h: src.naturalHeight || src.height });
  // high-quality downscale: halve step by step, then draw the final size
  function drawScaled(src, w, h, bg) {
    let cur = src, { w: cw, h: ch } = dims(src);
    while (cw / 2 >= w && ch / 2 >= h && cw > 2) {
      const c = document.createElement('canvas'); c.width = Math.round(cw / 2); c.height = Math.round(ch / 2);
      const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(cur, 0, 0, c.width, c.height);
      cur = c; cw = c.width; ch = c.height;
    }
    const out = document.createElement('canvas'); out.width = w; out.height = h;
    const ctx = out.getContext('2d');
    if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h); }
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(cur, 0, 0, w, h);
    return out;
  }

  /* ---------- tabs ---------- */
  const tabs = $('#tabs');
  function showTab(t) {
    setSeg(tabs, 't', t);
    ['resize', 'favicon', 'exif'].forEach(n => { $('#pane-' + n).hidden = n !== t; });
    S.tab = t; save();
    if (t === 'favicon') renderFavicon();
  }
  onSeg(tabs, 't', showTab);

  /* =========================================================
     1. Resize & convert
     ========================================================= */
  const R = { items: [], sel: null, seq: 0 };
  const fmtSeg = $('#rsFormat'), modeSeg = $('#rsMode');
  const rsSet = Object.assign({ fmt: 'image/webp', q: 80, mode: 'max', w: 1920, h: 1920, pct: 50, keep: true, noUp: true, bg: '#ffffff' }, S.rs || {});
  $$('button', fmtSeg).forEach(b => { if (!canEncode[b.dataset.f]) { b.disabled = true; b.title = 'Your browser cannot encode this format'; } });
  if (!canEncode[rsSet.fmt]) rsSet.fmt = 'image/jpeg';
  function applySettingsUI() {
    setSeg(fmtSeg, 'f', rsSet.fmt); setSeg(modeSeg, 'm', rsSet.mode);
    $('#rsQuality').value = rsSet.q; $('#qLabel').textContent = rsSet.q;
    $('#rsW').value = rsSet.w || ''; $('#rsH').value = rsSet.h || '';
    $('#rsPct').value = rsSet.pct; $('#pctLabel').textContent = rsSet.pct + '%';
    $('#rsKeep').checked = rsSet.keep; $('#rsNoUp').checked = rsSet.noUp; $('#rsBg').value = rsSet.bg;
    $('#qualityField').style.opacity = rsSet.fmt === 'image/png' ? .45 : 1;
    $('#rsQuality').disabled = rsSet.fmt === 'image/png';
    $('#bgField').hidden = rsSet.fmt !== 'image/jpeg';
    $('#modeMax').hidden = rsSet.mode !== 'max'; $('#modePct').hidden = rsSet.mode !== 'pct';
    $('#upWrap').hidden = rsSet.mode === 'none';
    $$('#rsPresets .chip').forEach(c => c.classList.toggle('on', +c.dataset.w === rsSet.w && +c.dataset.h === rsSet.h));
    const av = canEncode['image/avif'];
    $('#fmtHint').textContent = rsSet.fmt === 'image/png' ? 'PNG is lossless: great for screenshots and graphics, large for photos.' : rsSet.fmt === 'image/webp' ? 'WebP: ~25–35% smaller than JPEG at the same quality.' + (av ? '' : ' (AVIF encoding is not supported by this browser.)') : rsSet.fmt === 'image/avif' ? 'AVIF: the smallest files, slower to encode.' : 'JPEG: works everywhere.' + (av ? '' : ' (AVIF encoding is not supported by this browser.)');
  }
  let rsTimer;
  function settingsChanged() { S.rs = rsSet; save(); applySettingsUI(); clearTimeout(rsTimer); rsTimer = setTimeout(processAll, 220); }
  onSeg(fmtSeg, 'f', v => { rsSet.fmt = v; settingsChanged(); });
  onSeg(modeSeg, 'm', v => { rsSet.mode = v; settingsChanged(); });
  $('#rsQuality').addEventListener('input', e => { rsSet.q = +e.target.value; $('#qLabel').textContent = rsSet.q; clearTimeout(rsTimer); rsTimer = setTimeout(settingsChanged, 120); });
  $('#rsPct').addEventListener('input', e => { rsSet.pct = +e.target.value; $('#pctLabel').textContent = rsSet.pct + '%'; clearTimeout(rsTimer); rsTimer = setTimeout(settingsChanged, 120); });
  $('#rsW').addEventListener('input', e => { rsSet.w = Math.max(0, parseInt(e.target.value, 10) || 0); clearTimeout(rsTimer); rsTimer = setTimeout(settingsChanged, 300); });
  $('#rsH').addEventListener('input', e => { rsSet.h = Math.max(0, parseInt(e.target.value, 10) || 0); clearTimeout(rsTimer); rsTimer = setTimeout(settingsChanged, 300); });
  $('#rsKeep').addEventListener('change', e => { rsSet.keep = e.target.checked; settingsChanged(); });
  $('#rsNoUp').addEventListener('change', e => { rsSet.noUp = e.target.checked; settingsChanged(); });
  $('#rsBg').addEventListener('input', e => { rsSet.bg = e.target.value; settingsChanged(); });
  $('#rsPresets').addEventListener('click', e => { const c = e.target.closest('[data-w]'); if (!c) return; rsSet.w = +c.dataset.w; rsSet.h = +c.dataset.h; rsSet.mode = 'max'; settingsChanged(); });

  function targetSize(w, h) {
    let tw = w, th = h;
    if (rsSet.mode === 'pct') { tw = w * rsSet.pct / 100; th = h * rsSet.pct / 100; }
    else if (rsSet.mode === 'max') {
      const mw = rsSet.w || Infinity, mh = rsSet.h || Infinity;
      if (rsSet.keep) { const s = Math.min(mw / w, mh / h); tw = w * s; th = h * s; }
      else { tw = rsSet.w || w; th = rsSet.h || h; }
    }
    if (rsSet.mode !== 'none' && rsSet.noUp && (tw > w || th > h)) {
      if (rsSet.mode === 'max' && !rsSet.keep) { tw = Math.min(tw, w); th = Math.min(th, h); } else { tw = w; th = h; }
    }
    return { w: Math.max(1, Math.round(tw)), h: Math.max(1, Math.round(th)) };
  }

  async function addFiles(files) {
    const imgs = files.filter(f => /^image\//.test(f.type) || /\.(jpe?g|png|webp|avif|gif|bmp|ico|svg)$/i.test(f.name));
    if (!imgs.length) { toast('Those files are not images', 'fa-triangle-exclamation'); return; }
    for (const f of imgs) {
      const it = { id: ++R.seq, file: f, name: f.name, size: f.size, origUrl: URL.createObjectURL(f), busy: true };
      try { it.src = await decode(f); const d = dims(it.src); it.w = d.w; it.h = d.h; }
      catch (e) { it.err = 'Could not read this image'; it.busy = false; }
      R.items.push(it);
      if (!R.sel) R.sel = it.id;
    }
    renderList(); processAll();
  }
  let procRun = 0;
  async function processAll() {
    const run = ++procRun;
    R.items.forEach(it => { if (!it.err) it.busy = true; });
    renderList();
    for (const it of R.items) {
      if (run !== procRun) return;
      if (it.err) continue;
      try {
        const t = targetSize(it.w, it.h), fmt = rsSet.fmt;
        const c = drawScaled(it.src, t.w, t.h, fmt === 'image/jpeg' ? rsSet.bg : null);
        const blob = await toBlob(c, fmt, fmt === 'image/png' ? undefined : rsSet.q / 100);
        if (run !== procRun) return;
        if (it.outUrl) URL.revokeObjectURL(it.outUrl);
        const resized = t.w !== it.w || t.h !== it.h;
        it.out = { blob, w: t.w, h: t.h, name: baseName(it.name) + (resized ? `-${t.w}x${t.h}` : '') + '.' + EXT[fmt] };
        it.outUrl = URL.createObjectURL(blob);
      } catch (e) { it.err = e.message || 'Failed'; }
      it.busy = false;
      renderList();
      await new Promise(r => setTimeout(r, 0));
    }
    renderCompare();
  }
  function renderList() {
    const list = $('#rsList');
    if (!R.items.length) {
      list.innerHTML = '<p class="empty-msg"><i class="far fa-image"></i>No images yet. Drop some above to get started.</p>';
    } else {
      list.innerHTML = R.items.map((it, i) => {
        let meta;
        if (it.err) meta = `<span class="err-text">${esc(it.err)}</span>`;
        else if (it.out && !it.busy) {
          const pct = Math.round((1 - it.out.blob.size / it.size) * 100);
          meta = `<span>${it.w}×${it.h} <span class="arr">→</span> <b>${it.out.w}×${it.out.h}</b></span><span>${fmtBytes(it.size)} <span class="arr">→</span> <b>${fmtBytes(it.out.blob.size)}</b></span><span class="sv ${pct >= 0 ? 'good' : 'bad'}">${pct >= 0 ? '−' + pct : '+' + (-pct)}%</span>`;
        } else meta = `<span>${it.w}×${it.h}</span><span>${fmtBytes(it.size)}</span><span>processing…</span>`;
        return `<div class="file${it.id === R.sel ? ' sel' : ''}" data-id="${it.id}" style="animation-delay:${Math.min(i, 10) * 30}ms">
          <img class="file__img" src="${it.outUrl || it.origUrl}" alt="">
          <div style="min-width:0"><div class="file__name" title="${esc(it.name)}">${esc(it.out && !it.busy ? it.out.name : it.name)}</div><div class="file__meta">${meta}</div></div>
          <div class="file__act">
            <button class="btn btn--sm btn--ghost" type="button" data-act="dl" ${it.out && !it.busy ? '' : 'disabled'} aria-label="Download ${esc(it.name)}"><i class="fas fa-download"></i></button>
            <button class="btn btn--sm btn--ghost btn--danger" type="button" data-act="rm" aria-label="Remove ${esc(it.name)}"><i class="fas fa-xmark"></i></button>
          </div>
          ${it.busy ? '<div class="file__bar"><i></i></div>' : ''}
        </div>`;
      }).join('');
      list.querySelectorAll('.file').forEach(el => { el.style.animation = R.rendered && R.rendered.has(+el.dataset.id) ? 'none' : ''; });
    }
    R.rendered = new Set(R.items.map(i => i.id));
    const done = R.items.filter(i => i.out && !i.busy && !i.err);
    const before = done.reduce((a, i) => a + i.size, 0), after = done.reduce((a, i) => a + i.out.blob.size, 0);
    $('#stFiles').textContent = R.items.length;
    $('#stBefore').textContent = done.length ? fmtBytes(before) : '–';
    $('#stAfter').textContent = done.length ? fmtBytes(after) : '–';
    const sv = $('#stSaved');
    sv.textContent = done.length ? (before >= after ? '−' : '+') + Math.abs(Math.round((1 - after / before) * 100)) + '%' : '–';
    sv.className = done.length ? (before >= after ? 'good' : 'bad') : '';
    $('#rsZip').disabled = !done.length; $('#rsClear').disabled = !R.items.length;
  }
  $('#rsList').addEventListener('click', e => {
    const row = e.target.closest('.file'); if (!row) return;
    const it = R.items.find(i => i.id === +row.dataset.id); if (!it) return;
    const act = e.target.closest('[data-act]');
    if (act && act.dataset.act === 'dl') { if (it.out) download(it.out.blob, it.out.name); return; }
    if (act && act.dataset.act === 'rm') {
      R.items = R.items.filter(i => i !== it);
      [it.origUrl, it.outUrl].forEach(u => u && URL.revokeObjectURL(u));
      if (it.src && it.src.close) it.src.close();
      if (R.sel === it.id) R.sel = R.items[0] ? R.items[0].id : null;
      renderList(); renderCompare(); return;
    }
    R.sel = it.id; renderList(); renderCompare();
    $('#cmpPanel').scrollIntoView({ behavior: window.Site && Site.reduceMotion ? 'auto' : 'smooth', block: 'nearest' });
  });
  $('#rsClear').addEventListener('click', () => {
    R.items.forEach(it => { [it.origUrl, it.outUrl].forEach(u => u && URL.revokeObjectURL(u)); });
    R.items = []; R.sel = null; procRun++; renderList(); renderCompare();
  });
  $('#rsZip').addEventListener('click', async () => {
    const done = R.items.filter(i => i.out && !i.busy && !i.err);
    if (!done.length) return;
    if (done.length === 1) { download(done[0].out.blob, done[0].out.name); return; }
    const zip = await makeZip(uniqueNames(done.map(i => ({ name: i.out.name, blob: i.out.blob }))));
    download(zip, 'images.zip'); toast(`Zipped ${done.length} images (${fmtBytes(zip.size)})`, 'fa-file-zipper');
  });
  wireDrop($('#rsDrop'), $('#rsFile'), addFiles);

  // compare slider
  const cmp = $('#cmp');
  function renderCompare() {
    const it = R.items.find(i => i.id === R.sel && i.out && !i.err);
    $('#cmpPanel').hidden = !it;
    if (!it) return;
    $('#cmpBefore').src = it.origUrl; $('#cmpAfter').src = it.outUrl;
    $('#cmpName').textContent = it.out.name;
    $('#cmpTagL').textContent = `Before · ${fmtBytes(it.size)}`;
    $('#cmpTagR').textContent = `After · ${fmtBytes(it.out.blob.size)}`;
    // fit: whole image visible (at most ~560px tall); 100%: real output pixels, scroll to pan
    cmp.style.width = segVal($('#cmpZoom'), 'z') === '1' ? it.out.w + 'px' : `min(100%, ${Math.round(560 * it.out.w / it.out.h)}px)`;
    cmp.classList.toggle('zoom1', segVal($('#cmpZoom'), 'z') === '1');
  }
  const setX = (v) => cmp.style.setProperty('--x', v + '%');
  $('#cmpRange').addEventListener('input', e => setX(e.target.value));
  onSeg($('#cmpZoom'), 'z', renderCompare);
  setX(50);

  /* =========================================================
     2. Favicon
     ========================================================= */
  const SIZES = [16, 32, 48, 180, 192, 512];
  const FILES = { 16: 'favicon-16x16.png', 32: 'favicon-32x32.png', 48: 'favicon-48x48.png', 180: 'apple-touch-icon.png', 192: 'android-chrome-192x192.png', 512: 'android-chrome-512x512.png' };
  const F = Object.assign({ src: 'text', chars: 'L', font: "'Martian Mono', monospace", fg: '#0a0f22', size: 62, bold: true, bgOn: true, bg: '#8ea2ff', shape: 'rounded', fit: 'contain', pad: 0, name: 'My Site', theme: '#070b16' }, S.fv || {});
  let fvImg = null;
  const fvCanvases = {};
  $('#fvSizes').innerHTML = SIZES.map(s => `<div class="fvs"><canvas width="${s}" height="${s}" data-s="${s}" style="width:${Math.min(s, 96)}px;height:${Math.min(s, 96)}px"></canvas><span>${s}×${s}</span></div>`).join('');
  $$('#fvSizes canvas').forEach(c => { fvCanvases[c.dataset.s] = c; });
  function fvUI() {
    setSeg($('#fvSrc'), 's', F.src); setSeg($('#fvShape'), 'sh', F.shape); setSeg($('#fvFit'), 'fit', F.fit);
    $('#fvText').hidden = F.src !== 'text'; $('#fvImage').hidden = F.src !== 'image';
    $('#fvChars').value = F.chars; $('#fvFont').value = F.font; $('#fvFg').value = F.fg; $('#fvSize').value = F.size; $('#fvSizeL').textContent = F.size + '%';
    $('#fvBold').checked = F.bold; $('#fvBgOn').checked = F.bgOn; $('#fvBg').value = F.bg; $('#fvBg').disabled = !F.bgOn; $('#fvShape').style.opacity = F.bgOn ? 1 : .5;
    $('#fvPad').value = F.pad; $('#fvPadL').textContent = F.pad + '%'; $('#fvName').value = F.name; $('#fvTheme').value = F.theme;
  }
  function shapePath(ctx, s) {
    ctx.beginPath();
    if (F.shape === 'circle') ctx.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2);
    else if (F.shape === 'rounded') { const r = s * 0.22; if (ctx.roundRect) ctx.roundRect(0, 0, s, s, r); else ctx.rect(0, 0, s, s); }
    else ctx.rect(0, 0, s, s);
  }
  function drawIcon(c) {
    const s = c.width, ctx = c.getContext('2d');
    ctx.clearRect(0, 0, s, s);
    ctx.save();
    if (F.bgOn) { shapePath(ctx, s); ctx.fillStyle = F.bg; ctx.fill(); shapePath(ctx, s); ctx.clip(); }
    if (F.src === 'image') {
      if (fvImg) {
        const { w, h } = dims(fvImg), pad = s * F.pad / 100, box = s - pad * 2;
        const sc = F.fit === 'cover' ? Math.max(box / w, box / h) : Math.min(box / w, box / h);
        const dw = Math.max(1, Math.round(w * sc)), dh = Math.max(1, Math.round(h * sc));
        const scaled = drawScaled(fvImg, dw, dh, null);
        if (F.fit === 'cover') { ctx.beginPath(); ctx.rect(pad, pad, box, box); ctx.clip(); }
        ctx.drawImage(scaled, Math.round((s - dw) / 2), Math.round((s - dh) / 2));
      }
    } else {
      const txt = F.chars.trim() || '?';
      const fs = s * F.size / 100;
      ctx.font = `${F.bold ? 700 : 400} ${fs}px ${F.font}`;
      ctx.fillStyle = F.fg; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      let m = ctx.measureText(txt);
      const maxW = s * 0.9;
      if (m.width > maxW) { ctx.font = `${F.bold ? 700 : 400} ${fs * maxW / m.width}px ${F.font}`; m = ctx.measureText(txt); }
      const asc = m.actualBoundingBoxAscent || fs * .7, desc = m.actualBoundingBoxDescent || 0;
      const l = m.actualBoundingBoxLeft, r = m.actualBoundingBoxRight;
      const dx = (l != null && r != null) ? (l - r) / 2 : 0; // optical centring of the glyph box
      ctx.fillText(txt, s / 2 + dx, s / 2 + (asc - desc) / 2);
    }
    ctx.restore();
  }
  function snippets() {
    const html = `<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="${F.theme}">`;
    const name = F.name || 'My Site';
    const man = JSON.stringify({ name, short_name: name.length > 12 ? name.slice(0, 12) : name, icons: [{ src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' }, { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' }], theme_color: F.theme, background_color: F.bgOn ? F.bg : F.theme, display: 'standalone', start_url: '/' }, null, 2);
    return { html, man };
  }
  let fvFrame = 0;
  function renderFavicon() {
    cancelAnimationFrame(fvFrame);
    fvFrame = requestAnimationFrame(() => {
      SIZES.forEach(s => drawIcon(fvCanvases[s]));
      ['#mockTab', '#mockTab2'].forEach(id => { const c = $(id); c.width = c.height = 32; drawIcon(c); });
      drawIcon($('#mockHome'));
      $('#mockTitle').textContent = F.name || 'My Website'; $('#mockHomeName').textContent = F.name || 'My Site';
      const sn = snippets(); $('#fvHtml').textContent = sn.html; $('#fvMan').textContent = sn.man;
      $('#fvFiles').innerHTML = SIZES.map(s => `<button type="button" data-s="${s}">${FILES[s]}<span>${s}×${s}<i class="fas fa-download"></i></span></button>`).join('') + '<button type="button" data-s="man">site.webmanifest<span>JSON<i class="fas fa-download"></i></span></button>';
    });
  }
  function fvChanged() { S.fv = F; save(); fvUI(); renderFavicon(); }
  onSeg($('#fvSrc'), 's', v => { F.src = v; fvChanged(); });
  onSeg($('#fvShape'), 'sh', v => { F.shape = v; fvChanged(); });
  onSeg($('#fvFit'), 'fit', v => { F.fit = v; fvChanged(); });
  [['#fvChars', 'chars'], ['#fvFont', 'font'], ['#fvFg', 'fg'], ['#fvBg', 'bg'], ['#fvName', 'name'], ['#fvTheme', 'theme']].forEach(([id, k]) => $(id).addEventListener('input', e => { F[k] = e.target.value; S.fv = F; save(); renderFavicon(); }));
  $('#fvSize').addEventListener('input', e => { F.size = +e.target.value; $('#fvSizeL').textContent = F.size + '%'; S.fv = F; save(); renderFavicon(); });
  $('#fvPad').addEventListener('input', e => { F.pad = +e.target.value; $('#fvPadL').textContent = F.pad + '%'; S.fv = F; save(); renderFavicon(); });
  $('#fvBold').addEventListener('change', e => { F.bold = e.target.checked; fvChanged(); });
  $('#fvBgOn').addEventListener('change', e => { F.bgOn = e.target.checked; fvChanged(); });
  $('#fvEmoji').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { F.chars = b.textContent; F.src = 'text'; fvChanged(); } });
  async function fvUse(files, label) {
    const f = files.find(x => /^image\//.test(x.type)) || files[0];
    try { fvImg = await decode(f); const d = dims(fvImg); $('#fvFileInfo').textContent = `${label || f.name} · ${d.w}×${d.h}` + (d.w !== d.h ? ' · not square' : ''); F.src = 'image'; fvChanged(); }
    catch (e) { toast('Could not read that image', 'fa-triangle-exclamation'); }
  }
  wireDrop($('#fvDrop'), $('#fvFile'), (files) => fvUse(files));
  async function pngOf(s) { const c = document.createElement('canvas'); c.width = c.height = s; drawIcon(c); return toBlob(c, 'image/png'); }
  // ICO: 16/32/48 as 32-bit BMP (DIB) entries, the most compatible kind
  function bmpEntry(s) {
    const c = document.createElement('canvas'); c.width = c.height = s; drawIcon(c);
    const px = c.getContext('2d').getImageData(0, 0, s, s).data;
    const maskRow = Math.ceil(s / 32) * 4, size = 40 + s * s * 4 + maskRow * s;
    const buf = new ArrayBuffer(size), v = new DataView(buf);
    v.setUint32(0, 40, true); v.setInt32(4, s, true); v.setInt32(8, s * 2, true); v.setUint16(12, 1, true); v.setUint16(14, 32, true);
    v.setUint32(20, s * s * 4 + maskRow * s, true);
    let o = 40;
    for (let y = s - 1; y >= 0; y--) for (let x = 0; x < s; x++) { const i = (y * s + x) * 4; v.setUint8(o++, px[i + 2]); v.setUint8(o++, px[i + 1]); v.setUint8(o++, px[i]); v.setUint8(o++, px[i + 3]); }
    // AND mask stays all zero: the alpha channel decides transparency
    return new Uint8Array(buf);
  }
  function makeIco(sizes = [16, 32, 48]) {
    const imgs = sizes.map(bmpEntry), head = new DataView(new ArrayBuffer(6 + 16 * sizes.length));
    head.setUint16(2, 1, true); head.setUint16(4, sizes.length, true);
    let off = 6 + 16 * sizes.length;
    sizes.forEach((s, i) => {
      const e = 6 + i * 16;
      head.setUint8(e, s >= 256 ? 0 : s); head.setUint8(e + 1, s >= 256 ? 0 : s); head.setUint16(e + 4, 1, true); head.setUint16(e + 6, 32, true);
      head.setUint32(e + 8, imgs[i].length, true); head.setUint32(e + 12, off, true); off += imgs[i].length;
    });
    return new Blob([head.buffer, ...imgs], { type: 'image/x-icon' });
  }
  $('#fvIco').addEventListener('click', () => download(makeIco(), 'favicon.ico'));
  $('#fvFiles').addEventListener('click', async e => {
    const b = e.target.closest('[data-s]'); if (!b) return;
    if (b.dataset.s === 'man') { download(new Blob([snippets().man], { type: 'application/manifest+json' }), 'site.webmanifest'); return; }
    download(await pngOf(+b.dataset.s), FILES[b.dataset.s]);
  });
  $('#fvZip').addEventListener('click', async () => {
    const sn = snippets(), files = [{ name: 'favicon.ico', blob: makeIco() }];
    for (const s of SIZES) files.push({ name: FILES[s], blob: await pngOf(s) });
    files.push({ name: 'site.webmanifest', blob: new Blob([sn.man]) }, { name: 'favicon-snippet.html', blob: new Blob([sn.html + '\n']) });
    download(await makeZip(files), 'favicon.zip'); toast('Favicon package downloaded', 'fa-file-zipper');
  });
  $('#cpHtml').addEventListener('click', () => window.Site && Site.copy(snippets().html, 'HTML copied'));
  $('#cpMan').addEventListener('click', () => window.Site && Site.copy(snippets().man, 'Manifest copied'));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!$('#pane-favicon').hidden) renderFavicon(); });
  // Web fonts load lazily: ask for the ones the favicon may use, then redraw
  if (document.fonts && document.fonts.load) Promise.all(["700 40px 'Martian Mono'", "700 40px 'Instrument Sans'", "700 40px 'JetBrains Mono'", "400 40px 'Martian Mono'"].map(f => document.fonts.load(f).catch(() => {}))).then(() => renderFavicon());

  /* =========================================================
     3. EXIF
     ========================================================= */
  const TAGS = {
    0x010e: 'ImageDescription', 0x010f: 'Make', 0x0110: 'Model', 0x0112: 'Orientation', 0x011a: 'XResolution', 0x011b: 'YResolution', 0x0128: 'ResolutionUnit',
    0x0131: 'Software', 0x0132: 'DateTime', 0x013b: 'Artist', 0x0213: 'YCbCrPositioning', 0x8298: 'Copyright', 0x8769: 'ExifIFDPointer', 0x8825: 'GPSInfoIFDPointer',
    0x0201: 'JPEGInterchangeFormat', 0x0202: 'JPEGInterchangeFormatLength', 0x0103: 'Compression',
    0x829a: 'ExposureTime', 0x829d: 'FNumber', 0x8822: 'ExposureProgram', 0x8827: 'ISOSpeedRatings', 0x8830: 'SensitivityType', 0x9000: 'ExifVersion',
    0x9003: 'DateTimeOriginal', 0x9004: 'DateTimeDigitized', 0x9010: 'OffsetTime', 0x9011: 'OffsetTimeOriginal', 0x9012: 'OffsetTimeDigitized',
    0x9101: 'ComponentsConfiguration', 0x9201: 'ShutterSpeedValue', 0x9202: 'ApertureValue', 0x9203: 'BrightnessValue', 0x9204: 'ExposureBiasValue',
    0x9205: 'MaxApertureValue', 0x9207: 'MeteringMode', 0x9208: 'LightSource', 0x9209: 'Flash', 0x920a: 'FocalLength', 0x927c: 'MakerNote', 0x9286: 'UserComment',
    0x9290: 'SubSecTime', 0x9291: 'SubSecTimeOriginal', 0x9292: 'SubSecTimeDigitized', 0xa000: 'FlashpixVersion', 0xa001: 'ColorSpace',
    0xa002: 'PixelXDimension', 0xa003: 'PixelYDimension', 0xa005: 'InteroperabilityIFDPointer', 0xa217: 'SensingMethod', 0xa300: 'FileSource', 0xa301: 'SceneType',
    0xa401: 'CustomRendered', 0xa402: 'ExposureMode', 0xa403: 'WhiteBalance', 0xa404: 'DigitalZoomRatio', 0xa405: 'FocalLengthIn35mmFilm', 0xa406: 'SceneCaptureType',
    0xa420: 'ImageUniqueID', 0xa430: 'CameraOwnerName', 0xa431: 'BodySerialNumber', 0xa432: 'LensSpecification', 0xa433: 'LensMake', 0xa434: 'LensModel', 0xa435: 'LensSerialNumber'
  };
  const GPSTAGS = { 0: 'GPSVersionID', 1: 'GPSLatitudeRef', 2: 'GPSLatitude', 3: 'GPSLongitudeRef', 4: 'GPSLongitude', 5: 'GPSAltitudeRef', 6: 'GPSAltitude', 7: 'GPSTimeStamp', 12: 'GPSSpeedRef', 13: 'GPSSpeed', 16: 'GPSImgDirectionRef', 17: 'GPSImgDirection', 18: 'GPSMapDatum', 27: 'GPSProcessingMethod', 29: 'GPSDateStamp', 31: 'GPSHPositioningError' };
  const TSIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };

  // Parse the JPEG marker list; returns { exif, segments: [...names], error }
  function parseJpeg(buf) {
    const v = new DataView(buf), res = { segs: [], exif: null };
    if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) { res.notJpeg = true; return res; }
    let o = 2;
    while (o + 4 <= v.byteLength) {
      if (v.getUint8(o) !== 0xff) break;
      const m = v.getUint8(o + 1);
      if (m === 0xff) { o++; continue; }
      if (m === 0xd9 || m === 0xda) break; // EOI / start of scan: no more metadata
      if (m >= 0xd0 && m <= 0xd7) { o += 2; continue; }
      const len = v.getUint16(o + 2), start = o + 4, end = o + 2 + len;
      if (end > v.byteLength) break;
      const sig = (n) => String.fromCharCode(...new Uint8Array(buf, start, Math.min(n, len - 2)));
      if (m === 0xe1 && sig(6) === 'Exif\0\0') { res.segs.push('EXIF'); try { res.exif = parseTiff(buf, start + 6, end); } catch (e) { res.exifErr = e.message; } }
      else if (m === 0xe1 && sig(28).indexOf('http://ns.adobe.com/xap/1.0/') === 0) res.segs.push('XMP');
      else if (m === 0xe2 && sig(11) === 'ICC_PROFILE') { if (res.segs.indexOf('ICC profile') === -1) res.segs.push('ICC profile'); }
      else if (m === 0xed && sig(13) === 'Photoshop 3.0') res.segs.push('IPTC / Photoshop');
      else if (m === 0xfe) res.segs.push('Comment');
      else if (m === 0xe0 && sig(5) === 'JFIF\0') res.segs.push('JFIF');
      else if (m >= 0xe2 && m <= 0xef) res.segs.push('APP' + (m - 0xe0));
      o = end;
    }
    return res;
  }
  function parseTiff(buf, t0, tEnd) {
    const v = new DataView(buf), bo = v.getUint16(t0);
    if (bo !== 0x4949 && bo !== 0x4d4d) throw new Error('Bad TIFF header');
    const le = bo === 0x4949;
    const u16 = (o) => v.getUint16(t0 + o, le), u32 = (o) => v.getUint32(t0 + o, le), i32 = (o) => v.getInt32(t0 + o, le);
    if (u16(2) !== 42) throw new Error('Bad TIFF magic');
    const len = tEnd - t0, out = { ifd0: {}, exif: {}, gps: {}, ifd1: {}, list: [] };
    function readIfd(off, dict, names, label) {
      if (!off || off + 2 > len) return 0;
      const n = u16(off);
      if (n > 1000) throw new Error('Corrupt IFD');
      for (let i = 0; i < n; i++) {
        const e = off + 2 + i * 12;
        if (e + 12 > len) break;
        const tag = u16(e), type = u16(e + 2), count = u32(e + 4), sz = (TSIZE[type] || 1) * count;
        const vo = sz <= 4 ? e + 8 : u32(e + 8);
        if (vo + sz > len) continue;
        let val;
        const read = (k) => {
          const p = vo + k * (TSIZE[type] || 1);
          switch (type) {
            case 1: case 7: return v.getUint8(t0 + p);
            case 6: return v.getInt8(t0 + p);
            case 3: return u16(p); case 8: return v.getInt16(t0 + p, le);
            case 4: return u32(p); case 9: return i32(p);
            case 5: return [u32(p), u32(p + 4)]; case 10: return [i32(p), i32(p + 4)];
            default: return null;
          }
        };
        if (type === 2) { val = ''; for (let k = 0; k < count; k++) { const c = v.getUint8(t0 + vo + k); if (!c) break; val += String.fromCharCode(c); } val = val.trim(); }
        else if (type === 7 && count > 4) { val = { bytes: count, ascii: tag === 0x9286 || tag === 27 ? Array.from(new Uint8Array(buf, t0 + vo, Math.min(count, 200))).slice(8).map(c => (c >= 32 && c < 127 ? String.fromCharCode(c) : '')).join('').trim() : null }; }
        else if (count === 1) val = read(0);
        else { val = []; for (let k = 0; k < Math.min(count, 64); k++) val.push(read(k)); }
        const name = names[tag] || ('0x' + tag.toString(16).padStart(4, '0'));
        dict[name] = val;
        out.list.push({ ifd: label, tag, name, val, type });
      }
      return off + 2 + n * 12 + 4 <= len ? u32(off + 2 + n * 12) : 0;
    }
    const next = readIfd(u32(4), out.ifd0, TAGS, 'IFD0');
    if (out.ifd0.ExifIFDPointer) readIfd(out.ifd0.ExifIFDPointer, out.exif, TAGS, 'Exif');
    if (out.ifd0.GPSInfoIFDPointer) readIfd(out.ifd0.GPSInfoIFDPointer, out.gps, GPSTAGS, 'GPS');
    if (next) { try { readIfd(next, out.ifd1, TAGS, 'IFD1'); } catch (e) {} }
    return out;
  }
  const rat = (r) => (Array.isArray(r) ? (r[1] ? r[0] / r[1] : 0) : r);
  function dms(arr, ref) {
    if (!Array.isArray(arr) || arr.length < 3) return null;
    let d = rat(arr[0]) + rat(arr[1]) / 60 + rat(arr[2]) / 3600;
    if (ref === 'S' || ref === 'W') d = -d;
    return isFinite(d) ? d : null;
  }
  const ORIENT = { 1: 'Normal', 2: 'Mirrored horizontally', 3: 'Rotated 180°', 4: 'Mirrored vertically', 5: 'Mirrored + rotated 90° CCW', 6: 'Rotated 90° CW', 7: 'Mirrored + rotated 90° CW', 8: 'Rotated 90° CCW' };
  const FLASH = (f) => (f & 1 ? 'Fired' : 'Did not fire') + ((f & 0x18) === 0x18 ? ', auto' : (f & 0x18) === 0x10 ? ', off' : (f & 0x18) === 0x08 ? ', on' : '');
  const PROG = { 0: 'Not defined', 1: 'Manual', 2: 'Program', 3: 'Aperture priority', 4: 'Shutter priority', 5: 'Creative', 6: 'Action', 7: 'Portrait', 8: 'Landscape' };
  function exposure(t) { const x = rat(t); if (!x) return null; return x >= 1 ? x + ' s' : '1/' + Math.round(1 / x) + ' s'; }
  function fmtVal(item) {
    const v = item.val;
    if (v && typeof v === 'object' && !Array.isArray(v)) return v.ascii ? `"${v.ascii}"` : `(${v.bytes} bytes)`;
    const one = (x) => (Array.isArray(x) ? (x[1] === 1 ? String(x[0]) : `${x[0]}/${x[1]}`) : String(x));
    if (Array.isArray(v) && !(v.length === 2 && typeof v[0] === 'number' && (item.type === 5 || item.type === 10))) {
      if (item.type === 7 || item.type === 1) return v.length <= 8 ? v.join(' ') : v.slice(0, 8).join(' ') + ' …';
      return v.map(one).join(', ');
    }
    return one(v);
  }
  function exDate(s) { return s ? s.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3') : null; }

  let exCur = null;
  async function readExif(files) {
    const f = files[0];
    if (!f) return;
    exCur = { file: f };
    $('#exResult').hidden = false; $('#exCleanRes').hidden = true;
    $('#exName').textContent = f.name;
    const buf = await f.arrayBuffer();
    const j = parseJpeg(buf);
    let url = URL.createObjectURL(f);
    if (exCur.url) URL.revokeObjectURL(exCur.url);
    exCur.url = url; $('#exImg').src = url;
    try { exCur.img = await decode(f); } catch (e) { exCur.img = null; }
    const d = exCur.img ? dims(exCur.img) : null;
    $('#exInfo').textContent = `${f.type || 'unknown type'} · ${fmtBytes(f.size)}` + (d ? ` · ${d.w}×${d.h}` : '');
    const kv = [], add = (k, v, sub, html) => { if (v != null && v !== '') kv.push({ k, v: String(v), sub, html }); };
    const chips = [];
    let gps = null;
    if (j.notJpeg) chips.push('<span class="chip">Not a JPEG: EXIF is only read from JPEG files</span>');
    else if (!j.exif) chips.push('<span class="chip ok"><i class="fas fa-circle-check"></i>&nbsp; No EXIF found</span>');
    j.segs.filter(x => x !== 'JFIF').forEach(sg => chips.push(`<span class="chip${sg === 'EXIF' || sg === 'XMP' || sg === 'IPTC / Photoshop' ? ' warn' : ''}">${esc(sg)}</span>`));
    const x = j.exif;
    if (x) {
      const i0 = x.ifd0, e = x.exif, g = x.gps;
      add('Camera', [i0.Make, i0.Model && i0.Make && i0.Model.indexOf(i0.Make) === 0 ? i0.Model.slice(i0.Make.length).trim() : i0.Model].filter(Boolean).join(' '));
      add('Lens', e.LensModel || (e.LensMake || ''));
      add('Taken', exDate(e.DateTimeOriginal || i0.DateTime), e.OffsetTimeOriginal ? 'Time zone ' + e.OffsetTimeOriginal : (e.DateTimeOriginal ? '' : 'File modified'));
      add('Exposure', exposure(e.ExposureTime), PROG[e.ExposureProgram] ? PROG[e.ExposureProgram] + ' mode' : '');
      add('Aperture', e.FNumber ? 'f/' + (+rat(e.FNumber).toFixed(1)) : null);
      add('ISO', Array.isArray(e.ISOSpeedRatings) ? e.ISOSpeedRatings[0] : e.ISOSpeedRatings);
      add('Focal length', e.FocalLength ? (+rat(e.FocalLength).toFixed(1)) + ' mm' : null, e.FocalLengthIn35mmFilm ? e.FocalLengthIn35mmFilm + ' mm in 35 mm terms' : '');
      if (e.ExposureBiasValue != null) add('Exposure bias', (rat(e.ExposureBiasValue) > 0 ? '+' : '') + (+rat(e.ExposureBiasValue).toFixed(2)) + ' EV');
      if (e.Flash != null) add('Flash', FLASH(e.Flash));
      if (i0.Orientation) add('Orientation', `${i0.Orientation} · ${ORIENT[i0.Orientation] || 'Unknown'}`, i0.Orientation !== 1 ? 'Applied when displaying and when cleaning' : '');
      if (e.PixelXDimension) add('Dimensions', `${e.PixelXDimension}×${e.PixelYDimension}`);
      add('Software', i0.Software);
      add('Artist', i0.Artist || e.CameraOwnerName);
      add('Copyright', i0.Copyright);
      add('Serial number', e.BodySerialNumber || e.LensSerialNumber);
      add('Description', i0.ImageDescription);
      const lat = dms(g.GPSLatitude, g.GPSLatitudeRef), lon = dms(g.GPSLongitude, g.GPSLongitudeRef);
      if (lat != null && lon != null && !(lat === 0 && lon === 0)) {
        gps = { lat, lon };
        const osm = `https://www.openstreetmap.org/?mlat=${lat.toFixed(6)}&mlon=${lon.toFixed(6)}#map=16/${lat.toFixed(5)}/${lon.toFixed(5)}`;
        const ll = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
        add('GPS position', ll, '', `<a href="${osm}" target="_blank" rel="noopener">${ll} <i class="fas fa-arrow-up-right-from-square" style="font-size:.7em"></i></a>`);
        gps.osm = osm;
        if (g.GPSAltitude != null) add('Altitude', (g.GPSAltitudeRef === 1 ? '−' : '') + (+rat(g.GPSAltitude).toFixed(1)) + ' m');
        if (g.GPSDateStamp) add('GPS time', exDate(g.GPSDateStamp) + (Array.isArray(g.GPSTimeStamp) ? ' ' + g.GPSTimeStamp.map(t => String(Math.floor(rat(t))).padStart(2, '0')).join(':') + ' UTC' : ''));
      }
      if (x.ifd1.JPEGInterchangeFormatLength) add('Thumbnail', fmtBytes(x.ifd1.JPEGInterchangeFormatLength), 'Embedded preview, can show the uncropped original');
    }
    if (j.exifErr) add('EXIF error', j.exifErr);
    $('#exKv').innerHTML = kv.length ? kv.map(r => `<div><dt>${esc(r.k)}</dt><dd>${r.html || esc(r.v)}${r.sub ? `<small>${esc(r.sub)}</small>` : ''}</dd><button class="copy" type="button" data-copy-val="${esc(r.v)}" aria-label="Copy ${esc(r.k)}"><i class="far fa-copy"></i></button></div>`).join('') : '<p class="hint">No readable camera metadata in this file.</p>';
    $('#exCount').textContent = x ? `${x.list.length} tags` : '';
    const all = x ? x.list.filter(t => !/Pointer$/.test(t.name)) : [];
    $('#exAllN').textContent = all.length; $('#exAllWrap').hidden = !all.length;
    $('#exAll').innerHTML = all.map(t => `<tr><td>${t.ifd}</td><td>0x${t.tag.toString(16).padStart(4, '0')}</td><td>${esc(t.name)}</td><td>${esc(fmtVal(t))}</td></tr>`).join('');
    if (gps) chips.unshift('<span class="chip warn"><i class="fas fa-location-dot"></i>&nbsp; GPS location</span>');
    $('#exChips').innerHTML = chips.join('');
    const gw = $('#exGps');
    gw.hidden = !gps;
    if (gps) gw.innerHTML = `<i class="fas fa-location-dot"></i><div><b>This photo contains its GPS location.</b><p>Anyone who gets the original file can see where it was taken: <a href="${gps.osm}" target="_blank" rel="noopener">open ${gps.lat.toFixed(5)}, ${gps.lon.toFixed(5)} on OpenStreetMap</a>. Remove the metadata before sharing it.</p></div>`;
    $('#exClean').disabled = !exCur.img;
    $('#exQField').hidden = !/jpe?g|webp/i.test(f.type || f.name);
  }
  async function cleanExif() {
    if (!exCur || !exCur.img) return;
    const f = exCur.file, type = /png$/i.test(f.type) ? 'image/png' : /webp$/i.test(f.type) && canEncode['image/webp'] ? 'image/webp' : 'image/jpeg';
    const d = dims(exCur.img);
    const c = document.createElement('canvas'); c.width = d.w; c.height = d.h;
    const ctx = c.getContext('2d');
    if (type === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, d.w, d.h); }
    ctx.drawImage(exCur.img, 0, 0); // bitmap already has EXIF orientation applied
    const blob = await toBlob(c, type, type === 'image/png' ? undefined : +$('#exQ').value / 100);
    const name = baseName(f.name) + '-clean.' + EXT[type];
    download(blob, name);
    const check = type === 'image/jpeg' ? parseJpeg(await blob.arrayBuffer()) : null;
    const leftover = check ? check.segs.filter(s => s !== 'JFIF' && s !== 'ICC profile') : [];  // the browser adds a standard sRGB colour profile, which says nothing about you
    const r = $('#exCleanRes'); r.hidden = false;
    r.innerHTML = `<b><i class="fas fa-circle-check"></i> Saved ${esc(name)}</b><br>${d.w}×${d.h} · ${fmtBytes(f.size)} → ${fmtBytes(blob.size)}<br>` + (leftover.length ? `<span class="amber">Still found: ${esc(leftover.join(', '))}</span>` : 'Checked: the new file has no EXIF, GPS or other metadata.');
    exCur.clean = { blob, leftover };
    toast('Clean copy downloaded', 'fa-user-shield');
  }
  wireDrop($('#exDrop'), $('#exFile'), readExif);
  $('#exClean').addEventListener('click', cleanExif);
  $('#exQ').addEventListener('input', e => { $('#exQL').textContent = e.target.value; });

  /* ---------- global: paste + drops outside the zones ---------- */
  document.addEventListener('paste', e => {
    const t = e.target; if (t && /^(INPUT|TEXTAREA)$/.test(t.tagName) && t.type !== 'file' && t.type !== 'range' && t.type !== 'color') return;
    const files = Array.from((e.clipboardData && e.clipboardData.files) || []).filter(f => /^image\//.test(f.type));
    if (!files.length) return;
    e.preventDefault();
    const tab = S.tab || 'resize';
    if (tab === 'exif') readExif(files); else if (tab === 'favicon') fvUse(files, 'Pasted image'); else addFiles(files);
  });
  document.addEventListener('dragover', e => { if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) e.preventDefault(); });
  document.addEventListener('drop', e => {
    if (e.target.closest && e.target.closest('.drop')) return;
    if (!e.dataTransfer || !e.dataTransfer.files.length) return;
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files), tab = S.tab || 'resize';
    if (tab === 'exif') readExif(files); else if (tab === 'favicon') fvUse(files); else addFiles(files);
  });
  document.addEventListener('click', e => { const c = e.target.closest('[data-copy-val]'); if (c && window.Site) Site.copy(c.dataset.copyVal, 'Copied'); });

  applySettingsUI(); fvUI(); renderList();
  showTab(['resize', 'favicon', 'exif'].includes(S.tab) ? S.tab : 'resize');
  // tab from the URL hash (#favicon, #exif)
  const h = location.hash.replace('#', '');
  if (['resize', 'favicon', 'exif'].includes(h)) showTab(h);
})();
