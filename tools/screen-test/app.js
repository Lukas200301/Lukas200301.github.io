/* Screen test: full-screen patterns (dead pixels, banding, sharpness, uniformity), refresh-rate measurement, UFO motion test, screen info */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const LS = 'screen-test:';
  const load = (k, d) => { try { const v = localStorage.getItem(LS + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) {} };
  const toast = (m, i) => window.Site && Site.toast ? Site.toast(m, i) : null;
  const FONT = '"Instrument Sans", system-ui, "Segoe UI", sans-serif';
  const MONO = '"JetBrains Mono", Consolas, monospace';

  // ---------- Scene painters (device pixels) ----------
  const solid = (c) => (x, W, H) => { x.fillStyle = c; x.fillRect(0, 0, W, H); };
  function ramp(x, X0, Y0, W, H, to) {
    const g = x.createLinearGradient(X0, 0, X0 + W, 0);
    g.addColorStop(0, '#000'); g.addColorStop(1, to);
    x.fillStyle = g; x.fillRect(X0, Y0, W, H);
  }
  function steps(x, W, H, from, n, label, dpr) {
    // n boxes from value `from`, one grey level apart, in a grid
    const cols = 8, rows = Math.ceil(n / cols), bw = W / cols, bh = H / rows;
    for (let i = 0; i < n; i++) {
      const v = from + i, cx = (i % cols) * bw, cy = Math.floor(i / cols) * bh;
      x.fillStyle = `rgb(${v},${v},${v})`;
      x.fillRect(Math.round(cx), Math.round(cy), Math.ceil(bw), Math.ceil(bh));
      if (label) {
        x.fillStyle = v < 128 ? `rgb(${v + 22},${v + 22},${v + 22})` : `rgb(${v - 22},${v - 22},${v - 22})`;
        x.font = `${Math.round(13 * dpr)}px ${MONO}`; x.textBaseline = 'top';
        x.fillText(String(v), cx + 12 * dpr, cy + 10 * dpr);
      }
    }
  }
  function lines(x, X0, Y0, w, h, kind, size) {
    x.fillStyle = '#000'; x.fillRect(X0, Y0, w, h);
    x.fillStyle = '#fff';
    if (kind === 'v') for (let i = 0; i < w; i += size * 2) x.fillRect(X0 + i, Y0, size, h);
    else if (kind === 'h') for (let j = 0; j < h; j += size * 2) x.fillRect(X0, Y0 + j, w, size);
    else for (let j = 0; j < h; j += size) for (let i = ((j / size) % 2) * size; i < w; i += size * 2) x.fillRect(X0 + i, Y0 + j, size, size);
  }
  function star(x, cx, cy, r, spokes) {
    x.fillStyle = '#fff'; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#000';
    for (let i = 0; i < spokes; i++) {
      const a0 = (i * 2) * Math.PI / spokes, a1 = (i * 2 + 1) * Math.PI / spokes;
      x.beginPath(); x.moveTo(cx, cy); x.arc(cx, cy, r, a0, a1); x.closePath(); x.fill();
    }
  }
  const SAMPLE = 'The quick brown fox jumps over the lazy dog. 0123456789 Il1| O0 rn m';
  function textPage(x, W, H, dpr, bg, fg) {
    x.fillStyle = bg; x.fillRect(0, 0, W, H);
    x.fillStyle = fg; x.textBaseline = 'alphabetic';
    let y = 48 * dpr;
    const pad = 40 * dpr;
    [8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 24, 30].forEach((s) => {
      x.font = `${s * dpr}px ${FONT}`; y += (s + 12) * dpr;
      if (y > H - 20 * dpr) return;
      x.fillText(`${s}px  ${SAMPLE}`, pad, y);
    });
    y += 20 * dpr;
    [10, 12, 14].forEach((s) => {
      x.font = `${s * dpr}px ${MONO}`; y += (s + 12) * dpr;
      if (y > H - 20 * dpr) return;
      x.fillText(`${s}px mono  {} [] () <=> != 0O oO 1lI |`, pad, y);
    });
  }
  function patterns(x, W, H, dpr) {
    x.fillStyle = '#808080'; x.fillRect(0, 0, W, H);
    const pad = Math.round(24 * dpr), cols = W > H ? 4 : 2, rows = 2;
    const cw = Math.floor((W - pad * (cols + 1)) / cols), ch = Math.floor((H - pad * (rows + 1)) / rows);
    const cells = [['v', 1, '1 px vertical'], ['h', 1, '1 px horizontal'], ['c', 1, '1 px checker'], ['star', 0, 'Siemens star'], ['v', 2, '2 px vertical'], ['h', 2, '2 px horizontal'], ['c', 2, '2 px checker'], ['c', 4, '4 px checker']];
    cells.slice(0, cols * rows).forEach(([k, s, name], i) => {
      const X0 = pad + (i % cols) * (cw + pad), Y0 = pad + Math.floor(i / cols) * (ch + pad);
      if (k === 'star') { x.fillStyle = '#000'; x.fillRect(X0, Y0, cw, ch); star(x, X0 + cw / 2, Y0 + ch / 2, Math.min(cw, ch) / 2 - 6 * dpr, 36); }
      else lines(x, X0, Y0, cw, ch, k, s);
      x.font = `600 ${12 * dpr}px ${FONT}`; x.textBaseline = 'top';
      const tw = x.measureText(name).width + 14 * dpr;
      x.fillStyle = 'rgba(0,0,0,.75)'; x.fillRect(X0, Y0, tw, 22 * dpr);
      x.fillStyle = '#fff'; x.fillText(name, X0 + 7 * dpr, Y0 + 5 * dpr);
    });
  }

  const TESTS = [
    {
      id: 'pixels', name: 'Dead & stuck pixels', icon: 'fa-braille', pv: 'pv-pixels',
      desc: 'Solid colours that make a dead (always dark) or stuck (always lit) pixel stand out.',
      scenes: [
        ['Black', '#000', 'Look for lit dots: stuck pixels or a bright sub-pixel.'],
        ['White', '#fff', 'Look for black dots: dead pixels. Dust looks soft, a dead pixel is sharp.'],
        ['Red', '#f00', 'A dot in another colour is a stuck sub-pixel.'],
        ['Green', '#0f0', 'A dot in another colour is a stuck sub-pixel.'],
        ['Blue', '#00f', 'A dot in another colour is a stuck sub-pixel.'],
        ['Cyan', '#0ff', 'Red sub-pixels should be off everywhere.'],
        ['Magenta', '#f0f', 'Green sub-pixels should be off everywhere.'],
        ['Yellow', '#ff0', 'Blue sub-pixels should be off everywhere.'],
        ['Grey 50%', '#808080', 'Mid grey shows dark or bright pixels equally well.'],
      ].map(([n, c, t]) => ({ name: n, tip: t, draw: solid(c) })),
    },
    {
      id: 'gradient', name: 'Gradients & banding', icon: 'fa-swatchbook', pv: 'pv-grad',
      desc: 'Smooth ramps and near-black / near-white steps to spot banding and crushed shadows.',
      scenes: [
        { name: 'Grey ramp', tip: 'Should be a smooth fade. Visible stripes are banding (6-bit panel, dithering or a bad colour profile).', draw: (x, W, H) => ramp(x, 0, 0, W, H, '#fff') },
        { name: 'Colour ramps', tip: 'Red, green, blue and grey ramps: look for steps or a colour tint in the grey one.', draw: (x, W, H) => { const h = H / 4; ['#fff', '#f00', '#0f0', '#00f'].forEach((c, i) => ramp(x, 0, Math.round(i * h), W, Math.ceil(h), c)); } },
        { name: '32 steps', tip: 'Every step should be distinct and evenly spaced from black to white.', draw: (x, W, H) => { for (let i = 0; i < 32; i++) { const v = Math.round(i * 255 / 31); x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(Math.round(i * W / 32), 0, Math.ceil(W / 32), H); } } },
        { name: 'Near black 0–31', tip: 'Count how many boxes you can tell apart from black. Good screens show 3–4 and up; if many look the same, shadows are crushed.', draw: (x, W, H, d) => steps(x, W, H, 0, 32, true, d) },
        { name: 'Near white 224–255', tip: 'The brightest boxes should still be distinguishable; merged ones mean clipped highlights.', draw: (x, W, H, d) => steps(x, W, H, 224, 32, true, d) },
      ],
    },
    {
      id: 'sharp', name: 'Sharpness & text', icon: 'fa-font', pv: 'pv-sharp',
      desc: 'One-pixel lines, checkerboards and small text at native resolution.',
      scenes: [
        { name: 'Pixel patterns', tip: 'At 100% scaling the 1 px patterns look like an even grey with fine lines. Moiré, colour fringes or blur mean scaling or a non-native resolution.', draw: patterns },
        { name: 'Black on white', tip: 'Small text should be crisp without colour fringes. Fringes may come from ClearType or sub-pixel layout.', draw: (x, W, H, d) => textPage(x, W, H, d, '#fff', '#000') },
        { name: 'White on black', tip: 'Light text on dark: look for blooming or smearing on OLED and VA panels.', draw: (x, W, H, d) => textPage(x, W, H, d, '#000', '#fff') },
      ],
    },
    {
      id: 'uniform', name: 'Uniformity & bleed', icon: 'fa-circle-half-stroke', pv: 'pv-uni',
      desc: 'Black and greys to reveal backlight bleed, IPS glow, clouding and dirty-screen effect.',
      scenes: [
        { name: 'Black', tip: 'Dim the room and look at the edges and corners for light leaking in (backlight bleed) or a glow that moves with your head (IPS glow).', draw: solid('#000') },
        { name: 'Dark grey 10%', tip: 'Patchy, cloudy areas show uneven backlighting.', draw: solid('#1a1a1a') },
        { name: 'Grey 50%', tip: 'Look for darker bands, vignetting or a dirty-screen effect.', draw: solid('#808080') },
        { name: 'White', tip: 'Corners should be as bright as the centre, without a colour tint.', draw: solid('#fff') },
      ],
    },
  ];

  // ---------- Test cards ----------
  const testsEl = $('#tests');
  TESTS.forEach((t, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'st-card'; b.style.setProperty('--i', i); b.dataset.t = t.id;
    b.innerHTML = `<div class="st-prev ${t.pv}"><i class="fas fa-expand"></i></div><h3><i class="fas ${t.icon}"></i>${t.name}</h3><p>${t.desc}</p><small>${t.scenes.length} patterns</small>`;
    b.addEventListener('click', () => openFull(i, b));
    testsEl.appendChild(b);
  });

  // ---------- Full-screen viewer ----------
  const full = $('#full'), fc = $('#fullCanvas'), fx = fc.getContext('2d');
  let cur = null, sIdx = 0, opener = null, uiTimer = 0, wentFull = false;
  function sizeFull() {
    const d = devicePixelRatio || 1, r = full.getBoundingClientRect();
    fc.width = Math.max(1, Math.round(r.width * d)); fc.height = Math.max(1, Math.round(r.height * d));
  }
  function drawFull() {
    if (!cur) return;
    const sc = cur.scenes[sIdx], d = devicePixelRatio || 1;
    fx.setTransform(1, 0, 0, 1, 0, 0);
    sc.draw(fx, fc.width, fc.height, d);
    $('#hudName').textContent = sc.name;
    $('#hudPos').textContent = `${sIdx + 1} / ${cur.scenes.length}`;
    $('#hudTip').textContent = sc.tip;
    full.dataset.scene = sc.name;
  }
  function showUI(ms = 2600) {
    full.classList.add('show-ui');
    clearTimeout(uiTimer);
    uiTimer = setTimeout(() => full.classList.remove('show-ui'), ms);
  }
  function openFull(i, from) {
    cur = TESTS[i]; sIdx = 0; opener = from || null; wentFull = false;
    full.hidden = false; full.dataset.test = cur.id;
    sizeFull(); drawFull(); showUI(3200);
    full.focus && full.setAttribute('tabindex', '-1');
    try { full.focus({ preventScroll: true }); } catch (e) {}
    const req = full.requestFullscreen || full.webkitRequestFullscreen;
    if (req) {
      try {
        const p = req.call(full);
        if (p && p.then) p.then(() => { wentFull = true; }).catch(() => {});
        else wentFull = true;
      } catch (e) {}
    }
  }
  function closeFull() {
    if (!cur) return;
    cur = null; clearTimeout(uiTimer);
    full.hidden = true; full.classList.remove('show-ui');
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    if (fsEl === full) { try { (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch (e) {} }
    if (opener) try { opener.focus({ preventScroll: true }); } catch (e) {}
  }
  function step(n) {
    if (!cur) return;
    sIdx = (sIdx + n + cur.scenes.length) % cur.scenes.length;
    drawFull(); showUI();
  }
  ['fullscreenchange', 'webkitfullscreenchange'].forEach((ev) => document.addEventListener(ev, () => {
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    if (fsEl === full) { wentFull = true; requestAnimationFrame(() => { sizeFull(); drawFull(); }); }
    else if (cur && wentFull) closeFull();          // Esc pressed while in browser full screen
  }));
  full.addEventListener('click', (e) => {
    if (e.target.closest('#fullClose')) return;
    const back = e.pointerType === 'touch' && e.clientX < full.clientWidth * 0.3;
    step(back ? -1 : 1);
  });
  full.addEventListener('contextmenu', (e) => { e.preventDefault(); step(-1); });
  full.addEventListener('mousemove', () => showUI(1800));
  $('#fullClose').addEventListener('click', closeFull);
  addEventListener('resize', () => { if (cur) { sizeFull(); drawFull(); } });
  // full-screen viewer owns the keyboard (capture phase, before the site's palette / command line shortcuts)
  addEventListener('keydown', (e) => {
    if (!cur) return;
    e.stopPropagation();
    const k = e.key;
    if (k === 'Escape') { e.preventDefault(); closeFull(); }
    else if (k === 'ArrowRight' || k === ' ' || k === 'Enter' || k === 'PageDown' || k === 'ArrowDown') { e.preventDefault(); step(1); }
    else if (k === 'ArrowLeft' || k === 'Backspace' || k === 'PageUp' || k === 'ArrowUp') { e.preventDefault(); step(-1); }
    else if (k === 'Tab') { e.preventDefault(); showUI(); $('#fullClose').focus(); }
  }, true);

  // ---------- Refresh rate ----------
  const STD = [24, 30, 48, 50, 60, 72, 75, 85, 90, 100, 120, 144, 160, 165, 170, 175, 180, 200, 240, 280, 300, 360, 480, 500, 540];
  const gEl = $('#ftGraph'), gx = gEl.getContext('2d');
  let mRun = false, lastIntervals = [], measuredHz = 0;
  let dur = load('dur', 3);
  const durSeg = $('#dur');
  durSeg.querySelectorAll('button').forEach((b) => {
    b.setAttribute('aria-pressed', String(+b.dataset.d === dur));
    b.addEventListener('click', () => { dur = +b.dataset.d; save('dur', dur); durSeg.querySelectorAll('button').forEach((o) => o.setAttribute('aria-pressed', String(o === b))); });
  });
  function analyse(d) {
    if (d.length < 5) return null;
    const s = d.slice().sort((a, b) => a - b), med = s[s.length >> 1];
    const ok = d.filter((v) => v < med * 1.5);
    const mean = ok.reduce((a, b) => a + b, 0) / ok.length;
    const sd = Math.sqrt(ok.reduce((a, b) => a + (b - mean) ** 2, 0) / ok.length);
    let missed = 0; d.forEach((v) => { if (v >= med * 1.5) missed += Math.max(1, Math.round(v / med) - 1); });
    const hz = 1000 / mean;
    const near = STD.reduce((a, b) => (Math.abs(b - hz) < Math.abs(a - hz) ? b : a), STD[0]);
    return { med, mean, sd, missed, hz, near, nearOk: Math.abs(near - hz) / near < 0.03, n: d.length };
  }
  function showStats(r, live) {
    if (!r) return;
    $('#hzVal').textContent = r.hz >= 100 ? r.hz.toFixed(1) : r.hz.toFixed(2);
    $('#sNear').textContent = r.nearOk ? r.near + ' Hz' : '~' + Math.round(r.hz) + ' Hz';
    $('#sFt').textContent = r.mean.toFixed(2) + ' ms';
    $('#sJit').textContent = '±' + r.sd.toFixed(2) + ' ms';
    $('#sDrop').textContent = String(r.missed);
    $('#sDrop').className = r.missed ? 'amber' : '';
    if (!live) document.querySelectorAll('#hzStats .stat').forEach((s) => { s.classList.remove('pop'); void s.offsetWidth; s.classList.add('pop'); });
  }
  function sizeGraph() {
    const d = devicePixelRatio || 1, w = gEl.clientWidth, h = gEl.clientHeight;
    if (gEl.width !== Math.round(w * d)) { gEl.width = Math.round(w * d); gEl.height = Math.round(h * d); }
    gx.setTransform(d, 0, 0, d, 0, 0);
    return [w, h];
  }
  function drawGraph(d, r) {
    const [w, h] = sizeGraph();
    gx.clearRect(0, 0, w, h);
    gx.font = `11px ${MONO}`; gx.textBaseline = 'middle';
    if (!d.length || !r) { gx.fillStyle = '#6c789c'; gx.fillText('Frame times appear here', 12, h / 2); return; }
    const pts = d.slice(-Math.floor(w - 8));
    const top = Math.max(r.med * 2.4, 4), Y = (v) => h - 8 - Math.min(v, top) / top * (h - 20);
    // median line
    gx.strokeStyle = 'rgba(142,162,255,.35)'; gx.setLineDash([4, 4]); gx.beginPath(); gx.moveTo(0, Y(r.med)); gx.lineTo(w, Y(r.med)); gx.stroke(); gx.setLineDash([]);
    gx.fillStyle = '#6c789c'; gx.fillText(r.med.toFixed(2) + ' ms', 8, Y(r.med) - 9);
    const sx = pts.length > 1 ? (w - 8) / (pts.length - 1) : 1, X = (i) => 4 + i * sx;
    gx.strokeStyle = '#8ea2ff'; gx.lineWidth = 1.5; gx.beginPath();
    pts.forEach((v, i) => { i ? gx.lineTo(X(i), Y(v)) : gx.moveTo(X(i), Y(v)); });
    gx.stroke();
    gx.fillStyle = '#ffb86b';
    pts.forEach((v, i) => { if (v >= r.med * 1.5) { gx.beginPath(); gx.arc(X(i), Y(v), 2.5, 0, Math.PI * 2); gx.fill(); } });
  }
  function measure(quiet) {
    if (mRun) return;
    mRun = true;
    const btn = $('#measure'), st = $('#hzStatus'), hz = document.querySelector('.hz');
    btn.disabled = true; hz.classList.add('live');
    st.className = 'status warn'; st.innerHTML = '<i class="fas fa-wave-square"></i>Measuring…';
    const times = []; let warm = 0, start = 0, lastUi = 0, aborted = false;
    const onHide = () => { if (document.hidden) aborted = true; };
    document.addEventListener('visibilitychange', onHide);
    const tick = (t) => {
      if (warm < 8) { warm++; requestAnimationFrame(tick); return; }
      if (!start) start = t;
      times.push(t);
      const d = []; for (let i = 1; i < times.length; i++) d.push(times[i] - times[i - 1]);
      if (t - lastUi > 200) { lastUi = t; const r = analyse(d); showStats(r, true); drawGraph(d, r); }
      if (aborted) return finish(d, true);
      if (t - start < dur * 1000) requestAnimationFrame(tick);
      else finish(d, false);
    };
    function finish(d, ab) {
      mRun = false; btn.disabled = false; hz.classList.remove('live');
      document.removeEventListener('visibilitychange', onHide);
      if (ab) { st.className = 'status err'; st.innerHTML = '<i class="fas fa-triangle-exclamation"></i>Tab was hidden, measure again'; return; }
      const r = analyse(d); lastIntervals = d;
      if (!r) return;
      measuredHz = r.hz; save('lastHz', Math.round(r.hz * 10) / 10);
      showStats(r, false); drawGraph(d, r);
      const shaky = r.sd > r.mean * 0.15 || r.missed > r.n * 0.05;
      st.className = 'status ' + (shaky ? 'warn' : 'ok');
      st.innerHTML = `<i class="fas fa-${shaky ? 'triangle-exclamation' : 'check'}"></i>${r.n} frames in ${dur} s${shaky ? ', unsteady' : ''}`;
      st.dataset.hz = r.hz.toFixed(2);
      renderInfo();
      if (!uRun) drawUfo(uPaused, true);
      if (!quiet) toast(`Refresh rate: ${r.nearOk ? r.near : Math.round(r.hz)} Hz`, 'fas fa-gauge-high');
    }
    requestAnimationFrame(tick);
  }
  $('#measure').addEventListener('click', () => measure(false));
  addEventListener('resize', () => { const r = analyse(lastIntervals); drawGraph(lastIntervals, r); });
  drawGraph([], null);

  // ---------- Screen info ----------
  const mq = (q) => { try { return matchMedia(q).matches; } catch (e) { return false; } };
  function infoRows() {
    const s = screen, d = devicePixelRatio || 1;
    const gamut = mq('(color-gamut: rec2020)') ? 'Rec. 2020' : mq('(color-gamut: p3)') ? 'Display P3' : mq('(color-gamut: srgb)') ? 'sRGB' : 'unknown';
    const hdr = mq('(dynamic-range: high)');
    const o = s.orientation ? `${s.orientation.type.replace('-primary', '').replace('-secondary', ' (flipped)')}, ${s.orientation.angle}°` : (innerWidth >= innerHeight ? 'landscape' : 'portrait');
    const rows = [
      ['Resolution', `${s.width} × ${s.height}`, 'res'],
      ['Physical pixels', `${Math.round(s.width * d)} × ${Math.round(s.height * d)}`, 'phys'],
      ['Pixel ratio', `${+d.toFixed(3)} (${Math.round(d * 100)}% scaling)`, 'dpr'],
      ['Window', `${innerWidth} × ${innerHeight}`, 'win'],
      ['Available area', `${s.availWidth} × ${s.availHeight}`, 'avail'],
      ['Colour depth', `${s.colorDepth}-bit`, 'depth'],
      ['Colour gamut', gamut, 'gamut', gamut !== 'sRGB' && gamut !== 'unknown'],
      ['HDR', hdr ? 'Yes, HDR is active' : 'No (SDR)', 'hdr', hdr],
      ['Orientation', o, 'orient'],
      ['Refresh rate', measuredHz ? `${measuredHz.toFixed(1)} Hz (measured)` : 'measure on the left', 'hz'],
    ];
    if (typeof s.isExtended === 'boolean') rows.push(['Multiple screens', s.isExtended ? 'Yes' : 'No', 'ext']);
    rows.push(['Touch points', String(navigator.maxTouchPoints || 0), 'touch']);
    return rows;
  }
  function renderInfo() {
    const dl = $('#info');
    dl.innerHTML = '';
    infoRows().forEach(([k, v, id, good]) => {
      const div = document.createElement('div');
      div.dataset.k = id;
      div.innerHTML = `<dt></dt><dd${good ? ' class="yes"' : ''}></dd><button class="copy" type="button" aria-label="Copy ${k}"><i class="fas fa-copy"></i></button>`;
      div.querySelector('dt').textContent = k; div.querySelector('dd').textContent = v;
      div.querySelector('.copy').addEventListener('click', () => window.Site && Site.copy(v, k + ' copied'));
      dl.appendChild(div);
    });
  }
  $('#copyInfo').addEventListener('click', () => {
    const t = infoRows().map(([k, v]) => `${k}: ${v}`).join('\n');
    window.Site && Site.copy(t, 'Screen info copied');
  });
  renderInfo();
  let rTimer = 0;
  addEventListener('resize', () => { clearTimeout(rTimer); rTimer = setTimeout(renderInfo, 150); });
  (function watchDpr() {
    try { matchMedia(`(resolution: ${devicePixelRatio}dppx)`).addEventListener('change', () => { renderInfo(); watchDpr(); }, { once: true }); } catch (e) {}
  })();
  ['(dynamic-range: high)', '(color-gamut: p3)'].forEach((q) => { try { matchMedia(q).addEventListener('change', renderInfo); } catch (e) {} });
  if (screen.orientation) screen.orientation.addEventListener('change', renderInfo);

  // ---------- Motion (UFO) test ----------
  const uc = $('#ufo'), ux = uc.getContext('2d'), wrap = $('#ufoWrap');
  let speed = load('speed', 960), uRun = false, uFrame = 0, uStart = 0, uPaused = 0.35, bg = null, uW = 0, uH = 0;
  const spSeg = $('#speeds');
  if (!spSeg.querySelector(`[data-s="${speed}"]`)) speed = 960;
  spSeg.querySelectorAll('button').forEach((b) => {
    b.setAttribute('aria-pressed', String(+b.dataset.s === speed));
    b.addEventListener('click', () => {
      // keep the UFOs where they are when the speed changes
      const now = performance.now(), el = uRun ? (now - uStart) / 1000 : uPaused;
      const pos = el * speed; speed = +b.dataset.s; save('speed', speed);
      if (uRun) uStart = now - (pos / speed) * 1000; else uPaused = pos / speed;
      spSeg.querySelectorAll('button').forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
      if (!uRun) drawUfo(uPaused, true);
    });
  });
  function sizeUfo() {
    const d = devicePixelRatio || 1, w = uc.clientWidth, h = uc.clientHeight;
    if (!w || !h) return;
    uW = w; uH = h;
    uc.width = Math.round(w * d); uc.height = Math.round(h * d);
    // starfield background, pre-rendered once per size
    bg = document.createElement('canvas'); bg.width = uc.width; bg.height = uc.height;
    const b = bg.getContext('2d'); b.setTransform(d, 0, 0, d, 0, 0);
    b.fillStyle = '#05080f'; b.fillRect(0, 0, w, h);
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < w * h / 900; i++) { b.fillStyle = `rgba(232,237,255,${0.15 + rnd() * 0.5})`; b.fillRect(Math.round(rnd() * w), Math.round(rnd() * h), 1, 1); }
    const lh = h / 3;
    b.strokeStyle = 'rgba(35,48,86,.9)'; b.lineWidth = 1;
    for (let i = 1; i < 3; i++) { b.beginPath(); b.moveTo(0, Math.round(i * lh) + .5); b.lineTo(w, Math.round(i * lh) + .5); b.stroke(); }
  }
  function ufo(x, cx, cy, s) {
    // body
    x.fillStyle = '#7ef0c8'; x.beginPath(); x.ellipse(cx, cy - s * 0.18, s * 0.32, s * 0.3, 0, Math.PI, 0); x.fill();
    x.fillStyle = '#c9d3ff'; x.beginPath(); x.ellipse(cx, cy, s * 0.62, s * 0.2, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#8ea2ff'; x.beginPath(); x.ellipse(cx, cy + s * 0.04, s * 0.62, s * 0.11, 0, 0, Math.PI); x.fill();
    ['#ffb86b', '#ff7a90', '#ffb86b'].forEach((c, i) => { x.fillStyle = c; x.beginPath(); x.arc(cx + (i - 1) * s * 0.3, cy + s * 0.02, s * 0.06, 0, Math.PI * 2); x.fill(); });
  }
  const lanePos = [0, 0, 0];
  function drawUfo(sec, all) {
    if (!bg) sizeUfo();
    if (!bg) return;
    const d = devicePixelRatio || 1;
    ux.setTransform(1, 0, 0, 1, 0, 0); ux.drawImage(bg, 0, 0);
    ux.setTransform(d, 0, 0, d, 0, 0);
    const lh = uH / 3, s = Math.min(lh * 0.55, 72), span = uW + s * 1.4;
    const hz = measuredHz || 0;
    for (let i = 0; i < 3; i++) {
      const stepN = 1 << i;
      if (all || uFrame % stepN === 0) lanePos[i] = ((sec * speed) % span) - s * 0.7;
      ufo(ux, lanePos[i], lh * i + lh * 0.58, s);
      ux.font = `600 12px ${FONT}`; ux.textBaseline = 'top'; ux.fillStyle = i ? '#a3aed0' : '#e8edff';
      const fps = hz ? `${Math.round(hz / stepN)} fps` : ['full frame rate', '½ frame rate', '¼ frame rate'][i];
      ux.fillText(fps, 12, lh * i + 10);
      ux.fillStyle = '#6c789c'; ux.font = `11px ${MONO}`;
      ux.fillText(`${speed} px/s`, 12, lh * i + 28);
    }
  }
  function uTick(t) {
    if (!uRun) return;
    uFrame++;
    drawUfo((t - uStart) / 1000, false);
    requestAnimationFrame(uTick);
  }
  function setMotion(on) {
    const b = $('#motionGo');
    if (on === uRun) return;
    uRun = on;
    wrap.dataset.running = on ? '1' : '';
    b.innerHTML = on ? '<i class="fas fa-pause"></i>&nbsp; Pause' : '<i class="fas fa-play"></i>&nbsp; Start';
    if (on) { uStart = performance.now() - uPaused * 1000; uFrame = 0; requestAnimationFrame(uTick); }
    else uPaused = (performance.now() - uStart) / 1000;
  }
  $('#motionGo').addEventListener('click', () => setMotion(!uRun));
  $('#motionFull').addEventListener('click', () => {
    const req = wrap.requestFullscreen || wrap.webkitRequestFullscreen;
    if (!req) { toast('Full screen is not available here', 'fas fa-circle-info'); return; }
    try { const p = req.call(wrap); if (p && p.catch) p.catch(() => {}); } catch (e) {}
    setMotion(true);
  });
  document.addEventListener('fullscreenchange', () => requestAnimationFrame(() => { sizeUfo(); drawUfo(uRun ? (performance.now() - uStart) / 1000 : uPaused, true); }));
  addEventListener('resize', () => { sizeUfo(); if (!uRun) drawUfo(uPaused, true); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) setMotion(false); });
  sizeUfo(); drawUfo(uPaused, true);

  // quick automatic measurement once the page has settled (labels the motion lanes too)
  const prev = load('lastHz', 0);
  if (prev) { measuredHz = prev; renderInfo(); drawUfo(uPaused, true); }
  setTimeout(() => { if (!document.hidden) measure(true); }, 900);

})();
