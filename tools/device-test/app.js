/* Mic, webcam & gamepad test: getUserMedia + Web Audio level/scope + MediaRecorder, webcam preview/snapshots, Gamepad API */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const LS = 'device-test:';
  const load = (k, d) => { try { const v = localStorage.getItem(LS + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) {} };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (m, i) => window.Site && Site.toast && Site.toast(m, i);
  const MD = navigator.mediaDevices;
  const MONO = '"JetBrains Mono", Consolas, monospace';

  function setStatus(el, kind, icon, text) {
    el.className = 'status ' + (kind || '');
    el.innerHTML = `<i class="fas fa-${icon}"></i>${esc(text)}`;
    el.dataset.state = kind || 'idle';
  }
  function kv(el, rows) {
    el.innerHTML = rows.filter((r) => r && r[1] != null && r[1] !== '').map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');
  }
  // map getUserMedia errors to something a person can act on
  function mediaError(e, what) {
    const n = e && e.name;
    if (n === 'NotAllowedError' || n === 'SecurityError' || n === 'PermissionDeniedError') return ['Permission denied', `Access was blocked. Click the camera/lock icon in the address bar, allow the ${what} and press Start again.`];
    if (n === 'NotFoundError' || n === 'DevicesNotFoundError') return [`No ${what} found`, `No ${what} is connected, or the system has turned it off.`];
    if (n === 'NotReadableError' || n === 'TrackStartError') return [`${what[0].toUpperCase() + what.slice(1)} is busy`, `Another app (Teams, Zoom, OBS…) may be using the ${what}, or the driver failed. Close it and try again.`];
    if (n === 'OverconstrainedError') return ['Not supported', `The selected ${what} can't deliver these settings. Pick another device or resolution.`];
    if (n === 'AbortError') return ['Start failed', `The ${what} could not be started.`];
    return ['Error', (e && e.message) || String(e)];
  }
  const noMedia = () => !MD || !MD.getUserMedia;

  // ---------- Device lists ----------
  async function fillDevices(kind, sel, defLabel, current) {
    if (!MD || !MD.enumerateDevices) return;
    let list = [];
    try { list = (await MD.enumerateDevices()).filter((d) => d.kind === kind); } catch (e) { return; }
    const keep = current != null ? current : sel.value;
    sel.innerHTML = `<option value="">${esc(defLabel)}</option>` + list.filter((d) => d.deviceId && d.deviceId !== 'default' && d.deviceId !== 'communications')
      .map((d, i) => `<option value="${esc(d.deviceId)}">${esc(d.label || `${kind === 'audioinput' ? 'Microphone' : 'Camera'} ${i + 1}`)}</option>`).join('');
    if (Array.from(sel.options).some((o) => o.value === keep)) sel.value = keep;
  }
  const refreshDevices = () => {
    fillDevices('audioinput', $('#micSel'), 'Default microphone');
    fillDevices('videoinput', $('#camSel'), 'Default camera');
  };
  if (MD && MD.addEventListener) MD.addEventListener('devicechange', refreshDevices);
  refreshDevices();

  // permission hints before anything is started
  function permHint(name, el) {
    if (!navigator.permissions || !navigator.permissions.query) return;
    navigator.permissions.query({ name }).then((p) => {
      const show = () => {
        if (el.dataset.state && el.dataset.state !== 'idle' && el.dataset.state !== 'warn') return;
        if (p.state === 'denied') setStatus(el, 'warn', 'ban', 'Blocked in browser settings');
        else if (p.state === 'granted') setStatus(el, '', 'check', 'Allowed, not started');
        else setStatus(el, '', 'circle-info', 'Not started');
      };
      show(); p.onchange = show;
    }).catch(() => {});
  }

  // ================= Microphone =================
  const mic = { stream: null, ctx: null, an: null, raf: 0, peak: -Infinity, peakAt: 0, clipAt: 0, rec: null };
  const micStatus = $('#micStatus'), scope = $('#scope'), sx = scope.getContext('2d');
  const opts = { echo: load('echo', false), noise: load('noise', false), agc: load('agc', false) };
  [['#optEcho', 'echo'], ['#optNoise', 'noise'], ['#optAgc', 'agc']].forEach(([id, k]) => {
    const el = $(id); el.checked = opts[k];
    el.addEventListener('change', () => { opts[k] = el.checked; save(k, el.checked); if (mic.stream) startMic(); });
  });
  let view = load('view', 'wave');
  $$('#view button').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.v === view));
    b.addEventListener('click', () => { view = b.dataset.v; save('view', view); $$('#view button').forEach((o) => o.setAttribute('aria-pressed', String(o === b))); });
  });
  if (noMedia()) {
    setStatus(micStatus, 'err', 'triangle-exclamation', 'Not available');
    $('#scopeEmpty').innerHTML = '<i class="fas fa-triangle-exclamation"></i><span>This browser does not allow microphone access here. Open the page over HTTPS in a current browser.</span>';
  } else permHint('microphone', micStatus);

  function micBtn(on) { $('#micGo').innerHTML = on ? '<i class="fas fa-stop"></i>&nbsp; Stop' : '<i class="fas fa-play"></i>&nbsp; Start'; }
  async function startMic() {
    if (noMedia()) return;
    stopMic(true);
    setStatus(micStatus, 'warn', 'hourglass-half', 'Waiting for permission…');
    const dev = $('#micSel').value;
    const c = { echoCancellation: opts.echo, noiseSuppression: opts.noise, autoGainControl: opts.agc };
    if (dev) c.deviceId = { exact: dev };
    let stream;
    try { stream = await MD.getUserMedia({ audio: c }); }
    catch (e) {
      const [t, m] = mediaError(e, 'microphone');
      setStatus(micStatus, 'err', 'triangle-exclamation', t);
      const em = $('#scopeEmpty'); em.hidden = false; em.classList.add('err');
      em.innerHTML = `<i class="fas fa-microphone-slash"></i><span>${esc(m)}</span>`;
      kv($('#micInfo'), [['Status', t]]);
      return;
    }
    if (activeTab !== 'mic') { stream.getTracks().forEach((t) => t.stop()); return; }
    mic.stream = stream;
    const AC = window.AudioContext || window.webkitAudioContext;
    mic.ctx = new AC();
    if (mic.ctx.state === 'suspended') try { await mic.ctx.resume(); } catch (e) {}
    const src = mic.ctx.createMediaStreamSource(stream);
    mic.an = mic.ctx.createAnalyser(); mic.an.fftSize = 2048; mic.an.smoothingTimeConstant = 0.65;
    src.connect(mic.an);
    mic.peak = -Infinity; mic.peakAt = 0;
    const tr = stream.getAudioTracks()[0], st = tr.getSettings ? tr.getSettings() : {};
    setStatus(micStatus, 'live', 'circle', 'Live');
    $('#dotMic').classList.add('live'); micBtn(true);
    $('#scopeEmpty').hidden = true; $('#meter').classList.add('on');
    $('#recBtn').disabled = typeof MediaRecorder === 'undefined';
    kv($('#micInfo'), [
      ['Device', tr.label || 'Microphone'],
      ['Sample rate', st.sampleRate ? st.sampleRate + ' Hz' : mic.ctx.sampleRate + ' Hz'],
      ['Channels', st.channelCount ? String(st.channelCount) : null],
      ['Sample size', st.sampleSize ? st.sampleSize + ' bit' : null],
      ['Latency', st.latency != null ? Math.round(st.latency * 1000) + ' ms' : null],
      ['Echo cancel.', st.echoCancellation != null ? (st.echoCancellation ? 'on' : 'off') : null],
      ['Noise supp.', st.noiseSuppression != null ? (st.noiseSuppression ? 'on' : 'off') : null],
      ['Auto gain', st.autoGainControl != null ? (st.autoGainControl ? 'on' : 'off') : null],
    ]);
    tr.addEventListener('ended', () => { stopMic(); setStatus(micStatus, 'err', 'plug-circle-xmark', 'Device disconnected'); });
    fillDevices('audioinput', $('#micSel'), 'Default microphone', dev);
    micLoop();
  }
  function stopMic(silent) {
    cancelAnimationFrame(mic.raf);
    if (mic.rec && mic.rec.state !== 'inactive') try { mic.rec.stop(); } catch (e) {}
    if (mic.stream) mic.stream.getTracks().forEach((t) => t.stop());
    if (mic.ctx) try { mic.ctx.close(); } catch (e) {}
    const was = !!mic.stream;
    mic.stream = mic.ctx = mic.an = null;
    $('#dotMic').classList.remove('live'); micBtn(false);
    $('#meter').classList.remove('on'); $('#mFill').style.setProperty('--l', 0);
    $('#recBtn').disabled = true;
    if (was && !silent) {
      setStatus(micStatus, '', 'stop', 'Stopped');
      const em = $('#scopeEmpty'); em.hidden = false; em.classList.remove('err');
      em.innerHTML = '<i class="fas fa-microphone-slash"></i><span>Stopped. Press <b>Start</b> to listen again.</span>';
      ['#sLevel', '#sPeak', '#sFreq'].forEach((s) => { $(s).textContent = '--'; });
      clearScope();
    }
  }
  $('#micGo').addEventListener('click', () => (mic.stream ? stopMic() : startMic()));
  $('#micSel').addEventListener('change', () => { if (mic.stream) startMic(); });

  function sizeCanvas(c) {
    const d = devicePixelRatio || 1, w = c.clientWidth, h = c.clientHeight;
    if (c.width !== Math.round(w * d) || c.height !== Math.round(h * d)) { c.width = Math.round(w * d); c.height = Math.round(h * d); }
    return [w, h, d];
  }
  function clearScope() { const [w, h, d] = sizeCanvas(scope); sx.setTransform(d, 0, 0, d, 0, 0); sx.clearRect(0, 0, w, h); }
  const td = new Float32Array(2048);
  let fd = null, lastNum = 0;
  const dB = (v) => (v > 0 ? 20 * Math.log10(v) : -Infinity);
  function micLoop() {
    mic.raf = requestAnimationFrame(micLoop);
    const an = mic.an; if (!an) return;
    an.getFloatTimeDomainData(td);
    let sum = 0, pk = 0;
    for (let i = 0; i < td.length; i++) { const v = td[i]; sum += v * v; const a = v < 0 ? -v : v; if (a > pk) pk = a; }
    const rms = dB(Math.sqrt(sum / td.length)), pkDb = dB(pk), now = performance.now();
    if (pkDb >= mic.peak || now - mic.peakAt > 1500) {
      if (pkDb >= mic.peak) { mic.peak = pkDb; mic.peakAt = now; }
      else mic.peak = Math.max(pkDb, mic.peak - 0.6);      // falls back slowly after the hold time
    }
    if (pk >= 0.99) mic.clipAt = now;
    const n = (v) => Math.max(0, Math.min(1, (v + 60) / 60));
    $('#mFill').style.setProperty('--l', n(rms).toFixed(3));
    $('#mPeak').style.setProperty('--p', n(mic.peak).toFixed(3));
    $('#meter').setAttribute('aria-valuenow', Math.max(-60, Math.round(rms)));
    // frequency data (also used for the loudest-frequency readout)
    if (!fd || fd.length !== an.frequencyBinCount) fd = new Float32Array(an.frequencyBinCount);
    an.getFloatFrequencyData(fd);
    if (now - lastNum > 120) {
      lastNum = now;
      $('#sLevel').textContent = isFinite(rms) ? rms.toFixed(1) : '-∞';
      $('#sPeak').textContent = isFinite(mic.peak) ? mic.peak.toFixed(1) : '-∞';
      const i0 = Math.max(1, Math.ceil(40 / (mic.ctx.sampleRate / an.fftSize)));
      let bi = i0; for (let i = i0 + 1; i < fd.length; i++) if (fd[i] > fd[bi]) bi = i;
      const hz = bi * mic.ctx.sampleRate / an.fftSize;
      $('#sFreq').textContent = fd[bi] > -75 ? (hz >= 1000 ? (hz / 1000).toFixed(2) + ' kHz' : Math.round(hz) + ' Hz') : '--';
      $('#sFreq').dataset.hz = Math.round(hz);
      const hit = now - mic.clipAt < 1000;
      $('#sClipT').classList.toggle('hit', hit); $('#sClip').textContent = hit ? 'yes' : 'no';
    }
    drawScope();
  }
  function drawScope() {
    const [w, h, d] = sizeCanvas(scope);
    sx.setTransform(d, 0, 0, d, 0, 0); sx.clearRect(0, 0, w, h);
    sx.strokeStyle = 'rgba(35,48,86,.8)'; sx.lineWidth = 1;
    sx.beginPath(); sx.moveTo(0, h / 2 + .5); sx.lineTo(w, h / 2 + .5); sx.stroke();
    if (view === 'wave') {
      sx.strokeStyle = '#8ea2ff'; sx.lineWidth = 1.6; sx.beginPath();
      const N = td.length;
      for (let i = 0; i < N; i++) { const x = i / (N - 1) * w, y = h / 2 - td[i] * h * 0.46; i ? sx.lineTo(x, y) : sx.moveTo(x, y); }
      sx.stroke();
    } else {
      // log-frequency bars 30 Hz … 16 kHz
      const sr = mic.ctx.sampleRate, bins = fd.length, bars = Math.max(24, Math.floor(w / 7)), f0 = 30, f1 = Math.min(16000, sr / 2);
      const g = sx.createLinearGradient(0, h, 0, 0); g.addColorStop(0, '#5ee6b5'); g.addColorStop(.7, '#8ea2ff'); g.addColorStop(1, '#ffb86b');
      sx.fillStyle = g;
      for (let b = 0; b < bars; b++) {
        const fa = f0 * Math.pow(f1 / f0, b / bars), fb = f0 * Math.pow(f1 / f0, (b + 1) / bars);
        let ia = Math.floor(fa / (sr / 2) * bins), ib = Math.max(ia + 1, Math.ceil(fb / (sr / 2) * bins)), m = -Infinity;
        for (let i = ia; i < ib && i < bins; i++) if (fd[i] > m) m = fd[i];
        const v = Math.max(0, Math.min(1, (m + 100) / 80)), bw = w / bars;
        sx.fillRect(b * bw + 1, h - v * (h - 6), Math.max(1, bw - 2), v * (h - 6));
      }
      sx.fillStyle = '#6c789c'; sx.font = `10px ${MONO}`; sx.textBaseline = 'bottom';
      [100, 1000, 10000].forEach((f) => { const x = Math.log(f / f0) / Math.log(f1 / f0) * w; if (x > 0 && x < w - 30) sx.fillText(f >= 1000 ? f / 1000 + 'k' : String(f), x + 3, h - 3); });
    }
  }

  // ---- 5 s recording ----
  let recUrl = '';
  $('#recBtn').addEventListener('click', () => {
    if (!mic.stream || (mic.rec && mic.rec.state === 'recording')) return;
    let rec;
    try { rec = new MediaRecorder(mic.stream); } catch (e) { toast('Recording is not supported here', 'fas fa-triangle-exclamation'); return; }
    const chunks = [], btn = $('#recBtn'), prog = $('#recProg'), bar = $('#recBar');
    mic.rec = rec;
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      btn.classList.remove('rec'); btn.innerHTML = '<i class="fas fa-circle"></i>&nbsp; Record 5 s'; prog.hidden = true;
      btn.disabled = !mic.stream;
      if (!chunks.length) return;
      const type = rec.mimeType || chunks[0].type || 'audio/webm';
      const blob = new Blob(chunks, { type });
      if (recUrl) URL.revokeObjectURL(recUrl);
      recUrl = URL.createObjectURL(blob);
      const ext = /ogg/.test(type) ? 'ogg' : /mp4|aac/.test(type) ? 'm4a' : 'webm';
      $('#recAudio').src = recUrl; $('#recDl').href = recUrl; $('#recDl').download = 'mic-test.' + ext;
      $('#recOut').hidden = false; $('#recOut').dataset.size = blob.size;
      toast('Recording ready, press play', 'fas fa-circle-play');
    };
    rec.start(250);
    btn.disabled = true; btn.classList.add('rec'); prog.hidden = false;
    const t0 = performance.now();
    (function tick() {
      if (rec.state !== 'recording') return;
      const p = Math.min(1, (performance.now() - t0) / 5000);
      bar.style.width = (p * 100).toFixed(1) + '%';
      btn.innerHTML = `<i class="fas fa-circle"></i>&nbsp; Recording… ${Math.ceil(5 - p * 5)} s`;
      if (p >= 1) { try { rec.stop(); } catch (e) {} return; }
      requestAnimationFrame(tick);
    })();
  });

  // ================= Webcam =================
  const cam = { stream: null, vfc: 0, frames: 0, fpsT: 0, fpsTimer: 0, snaps: [] };
  const video = $('#video'), camBox = $('#camBox'), camStatus = $('#camStatus');
  const mirror = $('#mirror');
  mirror.checked = load('mirror', true);
  camBox.classList.toggle('mirror', mirror.checked);
  mirror.addEventListener('change', () => { save('mirror', mirror.checked); camBox.classList.toggle('mirror', mirror.checked); });
  $('#camRes').value = load('res', '');
  if (noMedia()) {
    setStatus(camStatus, 'err', 'triangle-exclamation', 'Not available');
    $('#camEmpty').innerHTML = '<i class="fas fa-triangle-exclamation"></i><span>This browser does not allow camera access here. Open the page over HTTPS in a current browser.</span>';
  } else permHint('camera', camStatus);

  function camBtn(on) { $('#camGo').innerHTML = on ? '<i class="fas fa-stop"></i>&nbsp; Stop' : '<i class="fas fa-play"></i>&nbsp; Start'; }
  async function startCam() {
    if (noMedia()) return;
    stopCam(true);
    setStatus(camStatus, 'warn', 'hourglass-half', 'Waiting for permission…');
    const dev = $('#camSel').value, res = $('#camRes').value, c = {};
    if (dev) c.deviceId = { exact: dev };
    if (res) { const [w, h] = res.split('x').map(Number); c.width = { ideal: w }; c.height = { ideal: h }; }
    c.frameRate = { ideal: 60 };
    let stream;
    try { stream = await MD.getUserMedia({ video: c }); }
    catch (e) {
      const [t, m] = mediaError(e, 'camera');
      setStatus(camStatus, 'err', 'triangle-exclamation', t);
      const em = $('#camEmpty'); em.hidden = false; em.classList.add('err');
      em.innerHTML = `<i class="fas fa-video-slash"></i><span>${esc(m)}</span>`;
      kv($('#camInfo'), [['Status', t]]);
      return;
    }
    if (activeTab !== 'cam') { stream.getTracks().forEach((t) => t.stop()); return; }
    cam.stream = stream;
    video.srcObject = stream;
    try { await video.play(); } catch (e) {}
    camBox.classList.add('live'); $('#camEmpty').hidden = true;
    setStatus(camStatus, 'live', 'circle', 'Live'); $('#dotCam').classList.add('live'); camBtn(true);
    $('#snap').disabled = false;
    const tr = stream.getVideoTracks()[0];
    tr.addEventListener('ended', () => { stopCam(); setStatus(camStatus, 'err', 'plug-circle-xmark', 'Camera disconnected'); });
    camInfo();
    fillDevices('videoinput', $('#camSel'), 'Default camera', dev);
    // measured frame rate
    cam.frames = 0; cam.fpsT = performance.now();
    if (video.requestVideoFrameCallback) {
      const cb = () => { cam.frames++; if (cam.stream) cam.vfc = video.requestVideoFrameCallback(cb); };
      cam.vfc = video.requestVideoFrameCallback(cb);
    }
    cam.fpsTimer = setInterval(() => {
      const now = performance.now(), dt = (now - cam.fpsT) / 1000;
      let fps;
      if (video.requestVideoFrameCallback) { fps = cam.frames / dt; cam.frames = 0; cam.fpsT = now; }
      else fps = (tr.getSettings().frameRate || 0);
      $('#sFps').textContent = fps ? fps.toFixed(fps < 10 ? 1 : 0) : '--';
      $('#sFps').dataset.fps = fps.toFixed(1);
      camInfo();
    }, 1000);
  }
  function camInfo() {
    if (!cam.stream) return;
    const tr = cam.stream.getVideoTracks()[0], st = tr.getSettings ? tr.getSettings() : {};
    let cap = {}; try { cap = tr.getCapabilities ? tr.getCapabilities() : {}; } catch (e) {}
    const w = video.videoWidth || st.width, h = video.videoHeight || st.height;
    const g = (a, b) => (b ? g(b, a % b) : a);
    const ar = w && h ? `${w / g(w, h)}:${h / g(w, h)}` : '';
    $('#sRes').textContent = w && h ? `${w}×${h}` : '--';
    $('#camBadge').hidden = !(w && h); $('#camBadge').textContent = w && h ? `${w}×${h}` : '';
    kv($('#camInfo'), [
      ['Device', tr.label || 'Camera'],
      ['Resolution', w && h ? `${w} × ${h}` : null],
      ['Aspect ratio', ar.length < 8 ? ar : (w / h).toFixed(2) + ':1'],
      ['Frame rate', st.frameRate ? `${Math.round(st.frameRate * 10) / 10} fps (setting)` : null],
      ['Facing', st.facingMode || null],
      ['Max resolution', cap.width && cap.height && cap.width.max ? `${cap.width.max} × ${cap.height.max}` : null],
      ['Max frame rate', cap.frameRate && cap.frameRate.max ? `${Math.round(cap.frameRate.max)} fps` : null],
    ]);
  }
  function stopCam(silent) {
    clearInterval(cam.fpsTimer);
    if (cam.vfc && video.cancelVideoFrameCallback) try { video.cancelVideoFrameCallback(cam.vfc); } catch (e) {}
    const was = !!cam.stream;
    if (cam.stream) cam.stream.getTracks().forEach((t) => t.stop());
    cam.stream = null; video.srcObject = null;
    camBox.classList.remove('live'); $('#dotCam').classList.remove('live'); camBtn(false);
    $('#snap').disabled = true; $('#camBadge').hidden = true;
    if (was && !silent) {
      setStatus(camStatus, '', 'stop', 'Stopped');
      const em = $('#camEmpty'); em.hidden = false; em.classList.remove('err');
      em.innerHTML = '<i class="fas fa-video-slash"></i><span>Stopped. Press <b>Start</b> to turn the camera on again.</span>';
      $('#sFps').textContent = '--';
    }
  }
  $('#camGo').addEventListener('click', () => (cam.stream ? stopCam() : startCam()));
  $('#camSel').addEventListener('change', () => { if (cam.stream) startCam(); });
  $('#camRes').addEventListener('change', () => { save('res', $('#camRes').value); if (cam.stream) startCam(); });
  video.addEventListener('resize', camInfo);
  $('#snap').addEventListener('click', () => {
    if (!cam.stream || !video.videoWidth) return;
    const c = document.createElement('canvas'); c.width = video.videoWidth; c.height = video.videoHeight;
    const x = c.getContext('2d');
    if (mirror.checked) { x.translate(c.width, 0); x.scale(-1, 1); }
    x.drawImage(video, 0, 0);
    camBox.classList.remove('flash'); void camBox.offsetWidth; camBox.classList.add('flash');
    c.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob), stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      cam.snaps.unshift(url);
      while (cam.snaps.length > 6) URL.revokeObjectURL(cam.snaps.pop());
      const a = document.createElement('a');
      a.href = url; a.download = `webcam-${stamp}.png`; a.title = `Download ${c.width}×${c.height} PNG`;
      a.innerHTML = `<img src="${url}" alt="Snapshot ${c.width}×${c.height}">`;
      const box = $('#snaps'); box.prepend(a);
      while (box.children.length > 6) box.lastElementChild.remove();
      $('#snapPanel').hidden = false;
      // also save it right away
      const dl = document.createElement('a'); dl.href = url; dl.download = a.download; document.body.appendChild(dl); dl.click(); dl.remove();
      toast('Snapshot saved', 'fas fa-camera');
    }, 'image/png');
  });

  // ================= Gamepad =================
  const PAD = { raf: 0, sel: load('pad', 0), ids: '' };
  const hasPads = typeof navigator.getGamepads === 'function';
  const getPads = () => { try { return Array.from(navigator.getGamepads() || []).filter(Boolean); } catch (e) { return []; } };
  const padEls = { btn: new Map(), stick: $$('.stick'), trig: $$('.trig') };
  $$('#pad [data-b]').forEach((el) => padEls.btn.set(+el.dataset.b, (padEls.btn.get(+el.dataset.b) || []).concat(el)));
  let rawBuilt = '';
  function vendorLabels(id) {
    const xb = /xbox|xinput|045e/i.test(id);
    const ps = !xb && /054c|playstation|dualsense|dualshock|wireless controller/i.test(id);
    const nin = !xb && /057e|nintendo|pro controller|joy-con/i.test(id);
    const L = ps ? ['✕', '○', '□', '△', 'L1', 'R1', 'L2', 'R2', 'Share', 'Options'] : nin ? ['B', 'A', 'Y', 'X', 'L', 'R', 'ZL', 'ZR', '−', '+'] : ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Back', 'Start'];
    [0, 1, 2, 3].forEach((i) => { const e = $(`.face [data-b="${i}"]`); if (e) e.textContent = L[i]; });
    $('.bump[data-b="4"]').textContent = L[4]; $('.bump[data-b="5"]').textContent = L[5];
    $('.trig[data-b="6"] span').textContent = L[6]; $('.trig[data-b="7"] span').textContent = L[7];
    $('.pb[data-b="8"]').textContent = L[8]; $('.pb[data-b="9"]').textContent = L[9];
  }
  function listPads(pads) {
    const box = $('#pads');
    $('#padCount').textContent = pads.length ? `${pads.length} connected` : '0';
    $('#dotPad').classList.toggle('live', pads.length > 0);
    if (!pads.length) { box.innerHTML = '<p class="hint">Nothing connected. Press a button on your controller.</p>'; return; }
    if (!pads.some((p) => p.index === PAD.sel)) PAD.sel = pads[0].index;
    box.innerHTML = pads.map((p) => {
      const vib = p.vibrationActuator || (p.hapticActuators && p.hapticActuators[0]);
      return `<button type="button" class="padc" data-i="${p.index}" aria-pressed="${p.index === PAD.sel}"><b>${esc(cleanId(p.id))}</b><span>#${p.index} · ${p.mapping || 'no'} mapping · ${p.buttons.length} buttons · ${p.axes.length} axes${vib ? ' · rumble' : ''}</span></button>`;
    }).join('');
    box.querySelectorAll('.padc').forEach((b) => b.addEventListener('click', () => { PAD.sel = +b.dataset.i; save('pad', PAD.sel); PAD.ids = ''; }));
  }
  const cleanId = (id) => String(id).replace(/\s*\((STANDARD GAMEPAD\s*)?Vendor: (\w+) Product: (\w+)\)/i, ' ($2:$3)').trim() || 'Gamepad';
  function buildRaw(p) {
    const key = p.index + ':' + p.buttons.length + ':' + p.axes.length;
    if (rawBuilt === key) return;
    rawBuilt = key;
    $('#rawBtns').innerHTML = p.buttons.map((_, i) => `<span class="rb" data-i="${i}"><span>${i}</span></span>`).join('');
    $('#rawAxes').innerHTML = p.axes.map((_, i) => `<div class="ax" data-i="${i}"><span>A${i}</span><i></i><b>0.00</b></div>`).join('');
  }
  function padFrame() {
    PAD.raf = requestAnimationFrame(padFrame);
    const pads = getPads();
    const ids = pads.map((p) => p.index + p.id + p.mapping).join('|');
    if (ids !== PAD.ids) { PAD.ids = ids; listPads(pads); rawBuilt = ''; }
    const p = pads.find((q) => q.index === PAD.sel) || pads[0];
    $('#padEmpty').hidden = !!p; $('#pad').hidden = !p;
    if (!p) { $('#rumble').hidden = true; $('#padTitle').textContent = 'Gamepad'; return; }
    if ($('#pad').dataset.id !== p.id) {
      $('#pad').dataset.id = p.id; vendorLabels(p.id);
      $('#padTitle').textContent = cleanId(p.id);
      $('#rumble').hidden = !(p.vibrationActuator || (p.hapticActuators && p.hapticActuators.length));
      $('#padNonStd').hidden = p.mapping === 'standard';
    }
    buildRaw(p);
    const bv = (i) => { const b = p.buttons[i]; return b ? (typeof b === 'object' ? b.value || (b.pressed ? 1 : 0) : b) : 0; };
    const bp = (i) => { const b = p.buttons[i]; return !!(b && (typeof b === 'object' ? b.pressed || b.value > 0.5 : b > 0.5)); };
    padEls.btn.forEach((els, i) => els.forEach((el) => {
      if (el.classList.contains('trig')) {
        const v = bv(i); el.style.setProperty('--v', v.toFixed(3)); el.querySelector('b').textContent = Math.round(v * 100) + '%'; el.classList.toggle('on', v > 0.05);
      } else el.classList.toggle('on', bp(i));
    }));
    padEls.stick.forEach((s) => {
      const k = +s.dataset.s, x = p.axes[k * 2] || 0, y = p.axes[k * 2 + 1] || 0;
      s.style.setProperty('--x', x.toFixed(3)); s.style.setProperty('--y', y.toFixed(3));
      s.querySelector('.stick__v').textContent = `${x.toFixed(2)}, ${y.toFixed(2)}`;
    });
    $$('#rawBtns .rb').forEach((el, i) => { el.style.setProperty('--v', bv(i).toFixed(3)); el.classList.toggle('on', bp(i)); });
    $$('#rawAxes .ax').forEach((el, i) => {
      const v = p.axes[i] || 0, bar = el.querySelector('i');
      bar.style.setProperty('--a', (0.5 + Math.min(0, v) / 2).toFixed(4)); bar.style.setProperty('--w', (Math.abs(v) / 2).toFixed(4));
      el.querySelector('b').textContent = (v >= 0 ? '+' : '') + v.toFixed(2);
    });
  }
  function padStart() { if (!hasPads) return noPadApi(); cancelAnimationFrame(PAD.raf); PAD.ids = ''; padFrame(); }
  function padStop() { cancelAnimationFrame(PAD.raf); PAD.raf = 0; }
  function noPadApi() { $('#padEmpty').innerHTML = '<i class="fas fa-triangle-exclamation"></i><b>Gamepad API not available</b><span class="hint">This browser does not support controllers on web pages (or only over HTTPS).</span>'; }
  addEventListener('gamepadconnected', (e) => { toast('Controller connected' + (e.gamepad ? ': ' + cleanId(e.gamepad.id).slice(0, 40) : ''), 'fas fa-gamepad'); if (activeTab !== 'pad') listPads(getPads()); });
  addEventListener('gamepaddisconnected', (e) => { toast('Controller disconnected', 'fas fa-plug-circle-xmark'); if (activeTab !== 'pad') listPads(getPads()); });
  $$('#rumble button').forEach((b) => b.addEventListener('click', () => {
    const p = getPads().find((q) => q.index === PAD.sel); if (!p) return;
    const m = b.dataset.r, weak = m === 'strong' ? 0 : 1, strong = m === 'weak' ? 0 : 1;
    const a = p.vibrationActuator;
    try {
      if (a && a.playEffect) a.playEffect(a.effects && !a.effects.includes('dual-rumble') && a.effects.includes('trigger-rumble') ? 'trigger-rumble' : 'dual-rumble', { startDelay: 0, duration: 600, weakMagnitude: weak, strongMagnitude: strong }).catch(() => toast('Vibration not supported by this controller', 'fas fa-circle-info'));
      else if (p.hapticActuators && p.hapticActuators[0]) p.hapticActuators[0].pulse(Math.max(weak, strong), 600);
    } catch (e) { toast('Vibration not supported by this controller', 'fas fa-circle-info'); }
  }));

  // ================= Tabs =================
  let activeTab = null;
  function setTab(t, focus) {
    if (t === activeTab) return;
    // leaving a tab releases its device
    if (activeTab === 'mic') stopMic();
    if (activeTab === 'cam') stopCam();
    if (activeTab === 'pad') padStop();
    activeTab = t; save('tab', t);
    $$('#tabs [role=tab]').forEach((b) => { const on = b.dataset.tab === t; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); });
    ['mic', 'cam', 'pad'].forEach((k) => { $('#pane-' + k).hidden = k !== t; });
    if (t === 'pad') padStart();
    if (t === 'mic' && !mic.stream) clearScope();
  }
  $$('#tabs [role=tab]').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
  $('#tabs').addEventListener('keydown', (e) => {
    const order = ['mic', 'cam', 'pad'], i = order.indexOf(activeTab);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); setTab(order[(i + (e.key === 'ArrowRight' ? 1 : 2)) % 3], true); }
  });
  const t0 = load('tab', 'mic');
  setTab(['mic', 'cam', 'pad'].includes(t0) ? t0 : 'mic');
  if (hasPads) listPads(getPads()); else noPadApi();

  // leaving the page always turns the camera and microphone off
  const stopAll = () => { stopMic(true); stopCam(true); padStop(); };
  addEventListener('pagehide', stopAll);
  addEventListener('beforeunload', stopAll);
  addEventListener('resize', () => { if (!mic.stream) clearScope(); });
})();
