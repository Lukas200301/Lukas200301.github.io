/* Speed test against Cloudflare's public speed test endpoints (speed.cloudflare.com, CORS enabled) */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const BASE = 'https://speed.cloudflare.com';
  const HKEY = 'speedtest-history';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const now = () => performance.now();
  const rnd = () => Math.random().toString(36).slice(2, 10);

  const LAT_COUNT = 20;
  const DOWN_SETS = [[1e5, 1, true], [1e5, 9], [1e6, 8], [1e7, 6], [2.5e7, 4]]; // [bytes, count, warm-up]
  const UP_SETS = [[1e5, 8], [1e6, 6], [1e7, 4], [2.5e7, 4]];
  const FINISH_MS = 1000;      // stop growing the file size once a transfer takes about this long
  const MIN_MS = 10;           // transfers faster than this are too short to measure
  const PHASE_LIMIT = 14000;   // safety cap per phase

  /* ---------- helpers ---------- */
  const median = (a) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const pct = (a, p) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y), i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
  const jitterOf = (a) => { if (a.length < 2) return 0; let d = 0; for (let i = 1; i < a.length; i++) d += Math.abs(a[i] - a[i - 1]); return d / (a.length - 1); };
  const fmtSpeed = (v) => (v == null || !isFinite(v) ? '–' : v >= 100 ? Math.round(v).toString() : v >= 10 ? v.toFixed(1) : v.toFixed(2));
  const fmtMs = (v) => (v == null || !isFinite(v) ? '–' : v >= 100 ? Math.round(v).toString() : v.toFixed(1));
  const fmtBytes = (n) => (n >= 1e9 ? (n / 1e9).toFixed(2) + ' GB' : n >= 1e6 ? (n / 1e6).toFixed(1) + ' MB' : Math.round(n / 1e3) + ' kB');
  try { performance.setResourceTimingBufferSize && performance.setResourceTimingBufferSize(600); } catch (e) {}
  function timing(url) {
    try {
      const e = performance.getEntriesByName(url);
      const t = e[e.length - 1];
      if (t && t.requestStart > 0 && t.responseStart > 0) {
        let server = 0;
        (t.serverTiming || []).forEach(s => { if (/cfRequestDuration/i.test(s.name)) server = s.duration || 0; });
        return { req: t.requestStart, resStart: t.responseStart, resEnd: t.responseEnd, server };
      }
    } catch (e) {}
    return null;
  }

  /* ---------- gauge ---------- */
  const CX = 160, CY = 160, RAD = 118, A0 = -135, A1 = 135;
  const SCALES = {
    speed: { ticks: [0, 1, 5, 10, 20, 50, 100, 250, 500, 1000], unit: 'Mbit/s', lbl: (v) => (v >= 1000 ? '1000+' : String(v)) },
    latency: { ticks: [0, 5, 10, 20, 30, 50, 75, 100, 200, 500], unit: 'ms', lbl: (v) => String(v) }
  };
  let scale = SCALES.speed;
  const pt = (a, r) => [CX + r * Math.sin(a * Math.PI / 180), CY - r * Math.cos(a * Math.PI / 180)];
  function arc(a, b, r) {
    const [x0, y0] = pt(a, r), [x1, y1] = pt(b, r);
    return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${b - a > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  }
  function posOf(v) {
    const t = scale.ticks, n = t.length - 1;
    if (!(v > 0)) return 0;
    if (v >= t[n]) return 1;
    for (let i = 0; i < n; i++) if (v < t[i + 1]) return (i + (v - t[i]) / (t[i + 1] - t[i])) / n;
    return 1;
  }
  const gauge = $('#gauge'), gVal = $('#gVal'), gNeedle = $('#gNeedle'), gNum = $('#gNum'), gTicks = $('#gTicks');
  $('#gTrack').setAttribute('d', arc(A0, A1, RAD));
  function drawTicks() {
    const n = scale.ticks.length - 1;
    gTicks.innerHTML = scale.ticks.map((v, i) => {
      const a = A0 + (A1 - A0) * i / n, [x0, y0] = pt(a, RAD - 14), [x1, y1] = pt(a, RAD - 21), [lx, ly] = pt(a, RAD + 22);
      return `<line class="g-tick" data-i="${i}" x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}"/><text class="g-lbl" x="${lx.toFixed(1)}" y="${ly.toFixed(1)}">${scale.lbl(v)}</text>`;
    }).join('');
  }
  let shown = 0, target = 0, raf = 0, numMode = 'idle';
  function paint() {
    const p = posOf(shown), a = A0 + (A1 - A0) * p;
    gVal.setAttribute('d', p > 0.002 ? arc(A0, a, RAD) : '');
    gNeedle.setAttribute('transform', `rotate(${a.toFixed(2)} ${CX} ${CY})`);
    gNeedle.style.opacity = numMode === 'idle' && shown < 0.01 ? .35 : 1;
    if (numMode !== 'idle') gNum.textContent = scale === SCALES.latency ? fmtMs(shown) : fmtSpeed(shown);
    const k = scale.ticks.length - 1;
    $$('.g-tick', gTicks).forEach((t, i) => t.classList.toggle('on', i / k <= p + 1e-6 && p > 0));
  }
  function loop() {
    const d = target - shown;
    shown = Math.abs(d) < 0.005 ? target : shown + d * (reduce ? 1 : 0.14);
    paint();
    raf = Math.abs(target - shown) > 0.004 ? requestAnimationFrame(loop) : 0;
  }
  function setGauge(v) { target = Math.max(0, v || 0); if (!raf) raf = requestAnimationFrame(loop); }
  function setMode(m) { // idle | latency | download | upload
    gauge.dataset.mode = m; $('.gauge-panel').dataset.mode = m;
    const ns = m === 'latency' ? SCALES.latency : SCALES.speed;
    if (ns !== scale) { scale = ns; drawTicks(); }
    $('#gUnit').textContent = scale.unit;
    numMode = m;
  }

  /* ---------- UI state ---------- */
  const phaseEls = $$('#phases .ph'), lines = $$('#phases .ph__line');
  function setPhase(name) {
    const order = ['latency', 'download', 'upload'], i = order.indexOf(name);
    phaseEls.forEach((el, k) => { el.classList.toggle('active', k === i); el.classList.toggle('done', i === -1 ? name === 'done' : k < i); });
    lines.forEach((l, k) => l.classList.toggle('done', name === 'done' || k < i));
  }
  const phaseText = (t) => { $('#phaseText').textContent = t; };
  function status(kind, html) { const s = $('#state'); if (!kind) { s.hidden = true; return; } s.hidden = false; s.className = 'status ' + kind; s.innerHTML = html; }
  function setRes(id, v, live, fmt = fmtSpeed) {
    const el = $(id), card = el.closest('.res');
    el.textContent = v == null ? '–' : fmt(v);
    card.classList.toggle('live', !!live);
    if (!live && v != null) { card.classList.remove('pop'); void card.offsetWidth; card.classList.add('pop'); }
  }

  /* ---------- chart ---------- */
  const chart = { d: [], u: [] };
  const svg = $('#chartSvg');
  function drawChart() {
    const all = chart.d.concat(chart.u);
    $('#chartEmpty').hidden = all.length > 0;
    $$('.c-axis', $('#chart')).forEach(e => e.remove());
    if (!all.length) { svg.innerHTML = ''; return; }
    const W = 600, H = 220, pad = 14;
    const max = niceMax(Math.max(...all) * 1.1);
    const n = Math.max(chart.d.length, chart.u.length, 2);
    const X = (i) => (i / (n - 1)) * W, Y = (v) => H - pad - (v / max) * (H - pad * 2);
    let g = '';
    [0, .5, 1].forEach(f => { const y = Y(max * f); g += `<line class="c-grid" x1="0" x2="${W}" y1="${y}" y2="${y}"/>`; });
    const series = (arr, c) => {
      if (!arr.length) return '';
      const pts = arr.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`);
      if (arr.length === 1) pts.push(`${X(0.02 * n).toFixed(1)},${Y(arr[0]).toFixed(1)}`);
      return `<polygon class="c-area c-a${c}" points="${X(0)},${H - pad} ${pts.join(' ')} ${pts[pts.length - 1].split(',')[0]},${H - pad}"/><polyline class="c-line c-${c}" points="${pts.join(' ')}"/>`;
    };
    svg.innerHTML = g + series(chart.d, 'd') + series(chart.u, 'u');
    [0, .5, 1].forEach(f => { const s = document.createElement('span'); s.className = 'c-axis'; s.style.top = (Y(max * f) / H * 100) + '%'; s.textContent = (f ? fmtSpeed(max * f) : '0') + (f === 1 ? ' Mbit/s' : ''); $('#chart').appendChild(s); });
  }
  function niceMax(v) { if (!(v > 0)) return 1; const e = Math.pow(10, Math.floor(Math.log10(v))), m = v / e; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * e; }

  /* ---------- measurements ---------- */
  let ctrl = null, running = false, bytesUsed = 0;
  class Cancel extends Error {}
  function checkAbort() { if (!ctrl || ctrl.signal.aborted) throw new Cancel('stopped'); }
  // watchdog: abort when nothing arrives for 20 s (a stalled connection would otherwise hang forever)
  let stallTimer = 0, stalled = false;
  function alive() { clearTimeout(stallTimer); stallTimer = setTimeout(() => { if (ctrl) { stalled = true; ctrl.abort(); } }, 20000); }

  async function ping() {
    const url = `${BASE}/__down?bytes=0&r=${rnd()}`;
    alive();
    const t0 = now();
    const r = await fetch(url, { cache: 'no-store', signal: ctrl.signal, credentials: 'omit' });
    await r.arrayBuffer();
    const t1 = now(), tm = timing(url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    let ms = tm ? tm.resStart - tm.req - tm.server : t1 - t0;
    if (!(ms > 0)) ms = t1 - t0;
    return ms;
  }
  async function download(bytes, latency, onProgress) {
    const url = `${BASE}/__down?bytes=${bytes}&r=${rnd()}`;
    alive();
    const t0 = now();
    const r = await fetch(url, { cache: 'no-store', signal: ctrl.signal, credentials: 'omit' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    let got = 0;
    if (r.body && r.body.getReader) {
      const rd = r.body.getReader();
      let tFirst = 0, lastUi = 0;
      for (;;) {
        const { done, value } = await rd.read();
        if (done) break;
        const t = now();
        alive();
        if (!tFirst) tFirst = t;
        got += value.length;
        if (onProgress && t - lastUi > 60 && t - tFirst > 40) { lastUi = t; onProgress(got * 8 / ((t - t0 - latency / 2) || 1) / 1000); }
      }
    } else got = (await r.arrayBuffer()).byteLength;
    const t1 = now(), tm = timing(url);
    bytesUsed += got;
    let dur = tm && tm.resEnd > 0 ? tm.resEnd - tm.req : t1 - t0;
    const transferOnly = tm && tm.resEnd > 0 ? tm.resEnd - tm.resStart : 0;
    dur = Math.max(dur - latency, transferOnly, 1);
    return { bytes: got || bytes, ms: dur, mbps: (got || bytes) * 8 / dur / 1000 };
  }
  async function upload(bytes, latency) {
    const url = `${BASE}/__up?r=${rnd()}`;
    const body = new Uint8Array(bytes); // no Content-Type header: a "simple" CORS request without preflight
    alive();
    const t0 = now();
    const r = await fetch(url, { method: 'POST', body, cache: 'no-store', signal: ctrl.signal, credentials: 'omit' });
    await r.text();
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const t1 = now(), tm = timing(url);
    bytesUsed += bytes;
    let dur = (tm ? tm.resStart - tm.req : t1 - t0) - latency;
    if (tm && tm.server > dur) dur = tm.server;
    dur = Math.max(dur, 1);
    return { bytes, ms: dur, mbps: bytes * 8 / dur / 1000 };
  }

  async function runBandwidth(kind, sets, latency) {
    const res = [], t0 = now(), arr = kind === 'download' ? chart.d : chart.u;
    for (const [bytes, count, warm] of sets) {
      const durs = [];
      for (let i = 0; i < count; i++) {
        checkAbort();
        phaseText(`${kind === 'download' ? 'Downloading' : 'Uploading'} ${fmtBytes(bytes)} (${i + 1}/${count})`);
        const m = kind === 'download'
          ? await download(bytes, latency, v => { setGauge(v); })
          : await upload(bytes, latency);
        durs.push(m.ms);
        if (!warm) { res.push(m); arr.push(m.mbps); drawChart(); }
        setGauge(m.mbps);
        const ok = res.filter(x => x.ms >= MIN_MS).map(x => x.mbps);
        if (ok.length || res.length) setRes(kind === 'download' ? '#rDown' : '#rUp', pct(ok.length ? ok : res.map(x => x.mbps), 0.9), true);
        $('#cData').textContent = fmtBytes(bytesUsed);
        if (now() - t0 > PHASE_LIMIT) return res;
      }
      if (median(durs) >= FINISH_MS) break;
    }
    return res;
  }

  async function run() {
    if (running) { stop(); return; }
    if (navigator.onLine === false) { status('err', '<i class="fas fa-plug-circle-xmark"></i>You are offline. Connect to the internet and try again.'); return; }
    running = true; ctrl = new AbortController(); bytesUsed = 0; stalled = false;
    chart.d = []; chart.u = []; drawChart();
    ['#rDown', '#rUp', '#rLat', '#rJit'].forEach(id => setRes(id, null, false));
    $('#means').innerHTML = '<p class="hint">Measuring…</p>'; $('#verdict').innerHTML = '';
    status(null);
    const btn = $('#go'); btn.classList.add('stop'); btn.innerHTML = '<i class="fas fa-stop"></i>&nbsp; Stop';
    getMeta();
    const out = { t: Date.now() };
    try {
      // latency
      setMode('latency'); setPhase('latency'); setGauge(0);
      const pings = [];
      for (let i = 0; i < LAT_COUNT + 1; i++) {
        checkAbort();
        phaseText(`Measuring latency (${Math.min(i + 1, LAT_COUNT)}/${LAT_COUNT})`);
        const ms = await ping();
        if (i === 0) continue; // the first request also sets up the connection
        pings.push(ms); setGauge(ms);
        setRes('#rLat', median(pings), true, fmtMs); setRes('#rJit', jitterOf(pings), true, fmtMs);
      }
      out.ping = median(pings); out.jitter = jitterOf(pings);
      setRes('#rLat', out.ping, false, fmtMs); setRes('#rJit', out.jitter, false, fmtMs);
      // download
      setMode('download'); setPhase('download'); shown = 0; setGauge(0);
      const d = await runBandwidth('download', DOWN_SETS, out.ping);
      const dOk = d.filter(x => x.ms >= MIN_MS).map(x => x.mbps);
      out.down = pct(dOk.length ? dOk : d.map(x => x.mbps), 0.9);
      setRes('#rDown', out.down, false);
      // upload
      setMode('upload'); setPhase('upload'); shown = 0; setGauge(0);
      const u = await runBandwidth('upload', UP_SETS, out.ping);
      const uOk = u.filter(x => x.ms >= MIN_MS).map(x => x.mbps);
      out.up = pct(uOk.length ? uOk : u.map(x => x.mbps), 0.9);
      setRes('#rUp', out.up, false);
      // done
      setPhase('done'); setMode('download'); setGauge(out.down); numMode = 'download';
      phaseText(`Done: ${fmtSpeed(out.down)} down, ${fmtSpeed(out.up)} up, ${fmtMs(out.ping)} ms latency`);
      out.colo = meta && meta.colo ? meta.colo : '';
      out.data = bytesUsed;
      saveHist(out); renderMeans(out);
      if (window.Site) Site.toast('Speed test finished', 'fa-gauge-high');
    } catch (e) {
      if (stalled) {
        phaseText('The test could not finish.');
        status('err', '<i class="fas fa-hourglass-end"></i>The connection stalled: no data arrived for 20 seconds. Check your network and try again.');
      } else if (e instanceof Cancel || (e && e.name === 'AbortError')) {
        phaseText('Test stopped.'); status('warn', '<i class="fas fa-circle-pause"></i>Stopped before the end, the partial results are not saved.');
      } else {
        const fileHint = location.protocol === 'file:' ? ' Opened from disk: some browsers block requests from file:// pages, try the online version.' : '';
        phaseText('The test could not finish.');
        status('err', `<i class="fas fa-triangle-exclamation"></i>Could not reach speed.cloudflare.com${navigator.onLine === false ? ' (you went offline)' : ''}. An ad-blocker, firewall or proxy may block it.${esc(fileHint)}`);
      }
      setPhase('none'); setMode('idle'); setGauge(0); gNum.textContent = '–';
      $('#means').innerHTML = '<p class="hint">Run a test to see what your connection handles well.</p>';
    } finally {
      running = false; ctrl = null; clearTimeout(stallTimer);
      btn.classList.remove('stop'); btn.innerHTML = '<i class="fas fa-rotate-right"></i>&nbsp; Test again';
      try { performance.clearResourceTimings(); } catch (e) {}
    }
  }
  function stop() { if (ctrl) ctrl.abort(); }
  window.addEventListener('offline', () => { if (running) stop(); });

  // speed.cloudflare.com/meta no longer allows cross-origin reads, so use the CORS-enabled trace endpoint
  // for the server location and IP, and ipapi.co for the provider name
  let meta = null;
  async function getMeta() {
    if (meta) return;
    try {
      const r = await fetch(`${BASE}/cdn-cgi/trace`, { cache: 'no-store', credentials: 'omit' });
      if (!r.ok) return;
      const kv = Object.fromEntries((await r.text()).trim().split('\n').map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; }));
      meta = { colo: kv.colo || '', clientIp: kv.ip || '', country: kv.loc || '' };
      $('#cServer').textContent = meta.colo ? `Cloudflare ${meta.colo}` : '–';
      $('#cIp').textContent = meta.clientIp || '–';
    } catch (e) { /* optional */ }
    try {
      const r = await fetch('https://ipapi.co/json/', { cache: 'no-store', credentials: 'omit' });
      if (!r.ok) return;
      const j = await r.json();
      if (j.org) $('#cIsp').textContent = `${j.org}${j.asn ? ' (' + j.asn + ')' : ''}`;
    } catch (e) { /* optional */ }
  }

  /* ---------- what it means ---------- */
  function renderMeans(r) {
    const L = (c, t) => `<span class="pill ${c}"><i class="fas fa-${c === 'ok' ? 'circle-check' : c === 'warn' ? 'circle-exclamation' : 'circle-xmark'}"></i>${t}</span>`;
    const g = (ok, warn) => (ok ? 'ok' : warn ? 'warn' : 'bad');
    const T = { ok: 'Great', warn: 'Okay', bad: 'Poor' };
    const gameTime = r.down > 0 ? (50e9 * 8 / (r.down * 1e6)) : Infinity;
    const dur = (s) => (s < 90 ? Math.round(s) + ' s' : s < 5400 ? Math.round(s / 60) + ' min' : (s / 3600).toFixed(1) + ' h');
    const items = [
      ['globe', 'Browsing & e-mail', 'Needs about 2 Mbit/s', g(r.down >= 5, r.down >= 2)],
      ['tv', 'HD streaming (1080p)', '5 Mbit/s per stream', g(r.down >= 10, r.down >= 5)],
      ['film', '4K streaming', '25 Mbit/s per stream' + (r.down >= 25 ? `, ${Math.floor(r.down / 25)} at once` : ''), g(r.down >= 25, r.down >= 15)],
      ['video', 'Video calls', 'About 3 Mbit/s each way, latency under 150 ms', g(r.down >= 3 && r.up >= 3 && r.ping <= 150, r.down >= 1.5 && r.up >= 1 && r.ping <= 300)],
      ['gamepad', 'Online gaming', `Latency ${fmtMs(r.ping)} ms, jitter ${fmtMs(r.jitter)} ms (best under 40 / 10)`, g(r.ping <= 40 && r.jitter <= 10 && r.down >= 3, r.ping <= 80 && r.jitter <= 30)],
      ['cloud-arrow-up', 'Cloud backup & uploads', `A 1 GB upload takes ~${dur(8e9 / (Math.max(r.up, 0.01) * 1e6))}`, g(r.up >= 20, r.up >= 5)],
      ['download', 'Big downloads', `A 50 GB game takes ~${dur(gameTime)}`, g(r.down >= 100, r.down >= 25)]
    ];
    $('#means').innerHTML = items.map(([ic, t, s, c], i) => `<div class="mean" style="--i:${i}"><i class="fas fa-${ic}"></i><div><b>${t}</b><small>${esc(s)}</small></div>${L(c, T[c])}</div>`).join('');
    const bad = items.filter(x => x[3] === 'bad').length, warn = items.filter(x => x[3] === 'warn').length;
    $('#verdict').innerHTML = bad ? L('bad', 'Limited') : warn ? L('warn', 'Good') : L('ok', 'Excellent');
  }

  /* ---------- history ---------- */
  function loadHist() {
    try {
      const h = JSON.parse(localStorage.getItem(HKEY) || '[]');
      if (!Array.isArray(h)) return [];
      // drop malformed entries (e.g. from older versions) so a bad timestamp cannot break the table
      return h.filter(x => x && typeof x === 'object').map(x => ({ ...x, t: typeof x.t === 'string' ? Date.parse(x.t) : +x.t }))
        .filter(x => Number.isFinite(x.t) && Number.isFinite(+x.down) && Number.isFinite(+x.up));
    } catch (e) { return []; }
  }
  function saveHist(r) {
    const h = loadHist(); h.unshift({ t: r.t, down: +r.down.toFixed(2), up: +r.up.toFixed(2), ping: +r.ping.toFixed(1), jitter: +r.jitter.toFixed(1), colo: r.colo || '' });
    try { localStorage.setItem(HKEY, JSON.stringify(h.slice(0, 30))); } catch (e) {}
    renderHist(true);
  }
  function renderHist(fresh) {
    const h = loadHist(), body = $('#hist');
    if (!h.length) { body.innerHTML = '<tr class="empty"><td colspan="7">No runs yet. Your results will be listed here.</td></tr>'; $('#clearHist').disabled = true; return; }
    $('#clearHist').disabled = false;
    const best = h.reduce((b, x, i) => (x.down > h[b].down ? i : b), 0);
    const df = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    body.innerHTML = h.map((x, i) => `<tr class="${i === best && h.length > 1 ? 'best' : ''}"><td>${esc(df.format(new Date(x.t)))}</td><td class="d">${fmtSpeed(x.down)} Mbit/s</td><td class="u">${fmtSpeed(x.up)} Mbit/s</td><td>${fmtMs(x.ping)} ms</td><td>${fmtMs(x.jitter)} ms</td><td>${esc(x.colo || '–')}</td><td><button class="copy" type="button" data-del="${x.t}" aria-label="Delete this run"><i class="fas fa-xmark"></i></button></td></tr>`).join('');
    if (fresh && body.firstElementChild) body.firstElementChild.animate && !reduce && body.firstElementChild.animate([{ opacity: 0, transform: 'translateY(-4px)' }, { opacity: 1, transform: 'none' }], { duration: 450, easing: 'cubic-bezier(.16,1,.3,1)' });
  }
  $('#hist').addEventListener('click', e => {
    const b = e.target.closest('[data-del]'); if (!b) return;
    const h = loadHist().filter(x => String(x.t) !== b.dataset.del);
    try { localStorage.setItem(HKEY, JSON.stringify(h)); } catch (err) {}
    renderHist();
  });
  $('#clearHist').addEventListener('click', () => { try { localStorage.removeItem(HKEY); } catch (e) {} renderHist(); if (window.Site) Site.toast('History cleared', 'fa-trash-can'); });

  $('#go').addEventListener('click', run);
  drawTicks(); setMode('idle'); paint(); renderHist(); drawChart();
  // show the last result while idle
  const last = loadHist()[0];
  if (last) {
    setRes('#rDown', last.down, false); setRes('#rUp', last.up, false); setRes('#rLat', last.ping, false, fmtMs); setRes('#rJit', last.jitter, false, fmtMs);
    $$('.res').forEach(c => c.classList.remove('pop'));
    renderMeans(last);
    phaseText('Showing your last result. Press start to measure again.');
  }
})();
