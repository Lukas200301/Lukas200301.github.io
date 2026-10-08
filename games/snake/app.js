/* Snake: fixed-step logic, interpolated rendering so movement is smooth at any frame rate */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const cv = $('#cv'), ctx = cv.getContext('2d'), wrap = $('#wrap');
  const N = 21;                                   // cells per side
  const SPEEDS = { slow: [170, 1.2, 95], normal: [130, 1.8, 70], fast: [95, 1.4, 52] };   // start ms, ms faster per food, floor
  const store = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };

  let speed = store.get('snake-speed', 'normal');
  let best = store.get('snake-best', 0);
  let snake, prev, dir, queue, food, score, state = 'idle', acc = 0, last = 0, interval, particles = [], eatPulse = 0, deathT = 0;
  let size = 0, cell = 0, dpr = 1;

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    size = cv.clientWidth; cell = size / N;
    cv.width = Math.round(size * dpr); cv.height = Math.round(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(1);
  }

  function reset() {
    const m = Math.floor(N / 2);
    snake = [{ x: m, y: m }, { x: m - 1, y: m }, { x: m - 2, y: m }];
    prev = snake.map(p => ({ ...p }));
    dir = { x: 1, y: 0 }; queue = [];
    score = 0; interval = SPEEDS[speed][0]; particles = [];
    placeFood(); updateStats();
  }
  function placeFood() {
    const free = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!snake.some(s => s.x === x && s.y === y)) free.push({ x, y });
    food = free[(Math.random() * free.length) | 0]; food.born = performance.now();
  }
  function setStat(id, v, pop) {
    const el = $(id), b = el.querySelector('b');
    if (b.textContent !== String(v)) { b.textContent = v; if (pop) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); } }
  }
  function updateStats(pop) { setStat('#sScore', score, pop); setStat('#sBest', best, false); setStat('#sLen', snake.length, pop); }

  function step() {
    if (queue.length) dir = queue.shift();
    prev = snake.map(p => ({ ...p }));
    let h = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
    const walls = $('#walls').checked;
    if (!walls) { h.x = (h.x + N) % N; h.y = (h.y + N) % N; }
    const eating = h.x === food.x && h.y === food.y;
    const body = eating ? snake : snake.slice(0, -1);   // the tail moves away unless we grow
    if (h.x < 0 || h.y < 0 || h.x >= N || h.y >= N || body.some(s => s.x === h.x && s.y === h.y)) return die();
    snake.unshift(h);
    if (eating) {
      prev.push({ ...prev[prev.length - 1] });     // new tail segment appears where the old tail was
      score++; eatPulse = 1;
      burst(food.x, food.y);
      interval = Math.max(SPEEDS[speed][2], interval - SPEEDS[speed][1]);
      if (score > best) { best = score; store.set('snake-best', best); }
      updateStats(true);
      if (snake.length === N * N) return win();
      placeFood();
    } else snake.pop();
  }

  function burst(cx, cy) {
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2, v = 0.04 + Math.random() * 0.1;
      particles.push({ x: cx + 0.5, y: cy + 0.5, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1 });
    }
  }

  function die() {
    state = 'over'; deathT = performance.now();
    wrap.classList.remove('shake'); void wrap.offsetWidth; wrap.classList.add('shake');
    const record = score > 0 && score === best;
    showMsg(record ? 'New high score!' : 'Game over', `You scored ${score}${record ? '. Nice!' : `. Best is ${best}.`}`, 'Play again');
    if (record && window.Site && score >= 5) Site.party(false);
  }
  function win() { state = 'over'; showMsg('You filled the board!', 'That is every single cell. Impressive.', 'Play again'); window.Site && Site.party(false); }

  function showMsg(t, p, btn) { $('#msgTitle').textContent = t; $('#msgText').textContent = p; $('#startBtn').innerHTML = `<i class="fas fa-play"></i>${btn}`; $('#msg').hidden = false; }
  function start() {
    if (state === 'paused') { state = 'run'; $('#msg').hidden = true; last = performance.now(); return; }
    reset(); state = 'run'; acc = 0; $('#msg').hidden = true; last = performance.now();
  }
  function pause() { if (state !== 'run') return; state = 'paused'; showMsg('Paused', `Score ${score}. Take a breath.`, 'Resume'); }

  // ---------- drawing ----------
  const lerp = (a, b, t) => a + (b - a) * t;
  function draw(t) {
    if (!cell) return;
    ctx.clearRect(0, 0, size, size);
    // dot grid
    ctx.fillStyle = 'rgba(142,162,255,0.13)';
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) ctx.fillRect((x + 0.5) * cell - 1, (y + 0.5) * cell - 1, 2, 2);
    if (!$('#walls').checked) { ctx.strokeStyle = 'rgba(142,162,255,0.18)'; ctx.setLineDash([4, 6]); ctx.strokeRect(1, 1, size - 2, size - 2); ctx.setLineDash([]); }
    if (!snake) return;
    const now = performance.now();

    // food: pulsing amber signal with rings
    if (food) {
      const fx = (food.x + 0.5) * cell, fy = (food.y + 0.5) * cell;
      const age = Math.min(1, (now - food.born) / 300), pulse = 0.5 + 0.5 * Math.sin(now / 220);
      ctx.save();
      ctx.strokeStyle = `rgba(255,184,107,${0.35 * (1 - ((now / 1200) % 1))})`; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(fx, fy, cell * (0.3 + 0.7 * ((now / 1200) % 1)), 0, Math.PI * 2); ctx.stroke();
      ctx.shadowColor = '#ffb86b'; ctx.shadowBlur = 14 + pulse * 10;
      ctx.fillStyle = '#ffb86b';
      ctx.beginPath(); ctx.arc(fx, fy, cell * (0.24 + pulse * 0.05) * age, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // snake: interpolate each segment between its previous and current cell
    const pts = snake.map((s, i) => {
      const p = prev[i] || s;
      if (Math.abs(p.x - s.x) > 1 || Math.abs(p.y - s.y) > 1) return { x: s.x, y: s.y, jump: true };  // wrapped through an edge
      return { x: lerp(p.x, s.x, t), y: lerp(p.y, s.y, t) };
    });
    const L = pts.length;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const dead = state === 'over' ? Math.min(1, (now - deathT) / 500) : 0;
    for (let i = L - 1; i > 0; i--) {
      const a = pts[i], b = pts[i - 1];
      if (b.jump || Math.abs(a.x - b.x) > 1.5 || Math.abs(a.y - b.y) > 1.5) continue;
      const k = i / L;
      ctx.strokeStyle = dead ? `rgba(255,122,144,${0.9 - k * 0.5})` : `hsl(${230 - k * 40}, ${90 - k * 30}%, ${76 - k * 26}%)`;
      ctx.lineWidth = cell * (0.66 - k * 0.22);
      ctx.beginPath(); ctx.moveTo((a.x + 0.5) * cell, (a.y + 0.5) * cell); ctx.lineTo((b.x + 0.5) * cell, (b.y + 0.5) * cell); ctx.stroke();
    }
    // head with glow + eyes
    const h = pts[0], hx = (h.x + 0.5) * cell, hy = (h.y + 0.5) * cell;
    ctx.save();
    ctx.shadowColor = dead ? '#ff7a90' : '#8ea2ff'; ctx.shadowBlur = 18 + eatPulse * 20;
    ctx.fillStyle = dead ? '#ff7a90' : '#c9d3ff';
    ctx.beginPath(); ctx.arc(hx, hy, cell * (0.38 + eatPulse * 0.08), 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    const ex = dir.y !== 0 ? 1 : 0, ey = dir.x !== 0 ? 1 : 0;
    ctx.fillStyle = '#070b16';
    [-1, 1].forEach(s => { ctx.beginPath(); ctx.arc(hx + dir.x * cell * 0.12 + ex * s * cell * 0.15, hy + dir.y * cell * 0.12 + ey * s * cell * 0.15, cell * 0.065, 0, Math.PI * 2); ctx.fill(); });

    // particles
    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.vx *= 0.94; p.vy *= 0.94; p.life -= 0.03;
      ctx.fillStyle = `rgba(255,184,107,${p.life})`;
      ctx.beginPath(); ctx.arc(p.x * cell, p.y * cell, 2.2 * p.life + 0.5, 0, Math.PI * 2); ctx.fill();
    });
    eatPulse *= 0.88;
  }

  function frame(now) {
    const dt = Math.min(250, now - last); last = now;
    if (state === 'run') {
      acc += dt;
      while (acc >= interval && state === 'run') { acc -= interval; step(); }
    }
    draw(state === 'run' ? Math.min(1, acc / interval) : 1);
    requestAnimationFrame(frame);
  }

  // ---------- input ----------
  const DIRS = { ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0] };
  function turn(x, y) {
    const lastDir = queue.length ? queue[queue.length - 1] : dir;
    if ((x === -lastDir.x && y === -lastDir.y) || (x === lastDir.x && y === lastDir.y)) return;
    if (queue.length < 3) queue.push({ x, y });
  }
  document.addEventListener('keydown', e => {
    if (e.target.closest('input, textarea, select, .palette') || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (DIRS[k]) {
      e.preventDefault();
      if (state === 'idle' || state === 'over') { start(); }
      if (state === 'paused') start();
      turn(...DIRS[k]);
    } else if (k === ' ' || k === 'Enter' || k === 'p' || k === 'Escape') {
      if (e.target.closest('button') && k !== 'p' && k !== 'Escape') return;
      e.preventDefault();
      if (state === 'run') pause(); else if (k !== 'Escape') start();
    }
  });
  let touch = null;
  wrap.addEventListener('touchstart', e => { touch = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }, { passive: true });
  wrap.addEventListener('touchmove', e => {
    if (!touch) return;
    const dx = e.touches[0].clientX - touch.x, dy = e.touches[0].clientY - touch.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    if (state !== 'run') start();
    Math.abs(dx) > Math.abs(dy) ? turn(Math.sign(dx), 0) : turn(0, Math.sign(dy));
    touch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });
  wrap.addEventListener('touchend', () => { touch = null; });
  $('#startBtn').addEventListener('click', start);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

  $('#speed').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.s === speed));
  $('#speed').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    $('#speed').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
    speed = b.dataset.s; store.set('snake-speed', speed); b.blur();
    if (state === 'run') interval = Math.max(SPEEDS[speed][2], SPEEDS[speed][0] - score * SPEEDS[speed][1]);
  });
  $('#walls').checked = store.get('snake-walls', true);
  $('#walls').addEventListener('change', e => { store.set('snake-walls', e.target.checked); e.target.blur(); });

  reset();
  new ResizeObserver(resize).observe(cv);
  resize();
  requestAnimationFrame(t => { last = t; frame(t); });
})();
