/**
 * Project showcase pages: live repository numbers from GitHub, copy buttons
 * on code blocks, count-up facts and the simulated app previews in the hero.
 */
(function () {
  'use strict';

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const countUp = (el, n, ms) => { if (window.Site && Site.countUp) Site.countUp(el, n, ms); else el.textContent = n; };
  const ago = (iso) => {
    if (!iso) return '';
    const s = (Date.now() - new Date(iso)) / 1000;
    for (const [sec, l] of [[31536000, 'y'], [2592000, 'mo'], [604800, 'w'], [86400, 'd'], [3600, 'h']]) if (s >= sec) return Math.floor(s / sec) + l + ' ago';
    return 'just now';
  };

  // ---------- Live repository numbers (cached 10 min, same as the projects page) ----------
  async function cached(url, key) {
    try {
      const c = JSON.parse(localStorage.getItem(key) || 'null');
      if (c && Date.now() - c.t < 10 * 60e3) return c.data;
    } catch (e) {}
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), data })); } catch (e) {}
    return data;
  }

  function repoStats() {
    const host = $('[data-repo]');
    if (!host) return;
    const repo = host.dataset.repo;
    const each = (k, fn) => $$(`[data-gh="${k}"]`).forEach(fn);
    const show = (k) => $$(`[data-gh-show="${k}"]`).forEach(el => { el.hidden = false; });
    cached(`https://api.github.com/repos/${repo}`, 'gh-repo:' + repo).then(r => {
      each('stars', el => countUp(el, r.stargazers_count || 0, 900));
      if (r.stargazers_count > 0) show('stars');   // a "0 stars" pill isn't worth showing
      each('pushed', el => { el.textContent = ago(r.pushed_at); });
      show('repo');
    }).catch(() => {});
    cached(`https://api.github.com/repos/${repo}/releases/latest`, 'gh-rel:' + repo).then(rel => {
      if (!rel || !rel.tag_name) return;
      each('release', el => { el.textContent = /^\d/.test(rel.tag_name) ? 'v' + rel.tag_name : rel.tag_name; });
      each('released', el => { el.textContent = ago(rel.published_at); });
      show('release');
    }).catch(() => {});
  }

  // ---------- Code blocks: copy ----------
  function copyButtons() {
    document.addEventListener('click', e => {
      const b = e.target.closest && e.target.closest('.copy-btn');
      if (!b) return;
      const code = b.closest('.code-block').querySelector('code');
      if (window.Site) Site.copy(code.textContent, 'Copied to clipboard');
      const i = b.querySelector('i');
      i.className = 'fas fa-check';
      setTimeout(() => { i.className = 'fas fa-copy'; }, 1600);
    });
  }

  // ---------- Key numbers count up when they come into view ----------
  function facts() {
    const els = $$('[data-count]');
    if (!els.length || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(es => es.forEach(en => {
      if (!en.isIntersecting) return;
      io.unobserve(en.target);
      countUp(en.target, +en.target.dataset.count, 1100);
    }), { threshold: 0.5 });
    els.forEach(el => io.observe(el));
  }

  // Runs fn every ms while the element is on screen and the tab is visible.
  function ticker(el, ms, fn) {
    let id = 0, vis = true;
    const sync = () => {
      const on = vis && !document.hidden;
      if (on && !id) id = setInterval(fn, ms);
      else if (!on && id) { clearInterval(id); id = 0; }
    };
    if ('IntersectionObserver' in window) new IntersectionObserver(es => { vis = es[es.length - 1].isIntersecting; sync(); }).observe(el);
    document.addEventListener('visibilitychange', sync);
    sync();
  }

  // ---------- Raspberry Pi Control: dashboard preview ----------
  function piDemo(root) {
    const R = 50, C = 2 * Math.PI * R, ARC = C * 0.75;   // gauges are 270° arcs
    const g = {};
    $$('.pg', root).forEach(el => {
      const val = $('.pg__val', el);
      val.style.strokeDasharray = `${ARC} ${C}`;
      val.style.strokeDashoffset = ARC;
      g[el.dataset.k] = { el, val, txt: $('b', el) };
    });
    const set = (k, v, p) => {
      g[k].val.style.strokeDashoffset = (ARC * (1 - clamp(p, 0, 1))).toFixed(1);
      g[k].txt.textContent = Math.round(v);
    };

    const ctrs = [
      { name: 'pihole', img: 'pihole/pihole', on: true, cpu: 4, ram: 4 },
      { name: 'nginx', img: 'nginx:alpine', on: true, cpu: 2, ram: 2 },
      { name: 'homeassistant', img: 'home-assistant', on: false, cpu: 12, ram: 9 }
    ];
    const list = $('.pi-ctrs', root);
    const count = $('[data-running]', root);
    list.insertAdjacentHTML('beforeend', ctrs.map((c, i) => `
      <li class="pi-ctr" data-i="${i}">
        <i class="fab fa-docker" aria-hidden="true"></i>
        <span class="pi-ctr__name">${esc(c.name)} <small>${esc(c.img)}</small></span>
        <span class="pi-ctr__state"></span>
        <button type="button"></button>
      </li>`).join(''));
    const paintCtr = (li) => {
      const c = ctrs[li.dataset.i];
      li.classList.toggle('is-off', !c.on);
      $('.pi-ctr__state', li).textContent = c.on ? 'running' : 'exited';
      const b = $('button', li);
      b.innerHTML = `<i class="fas fa-${c.on ? 'stop' : 'play'}"></i>`;
      b.setAttribute('aria-label', `${c.on ? 'Stop' : 'Start'} ${c.name}`);
      b.title = c.on ? 'Stop' : 'Start';
      count.textContent = `${ctrs.filter(x => x.on).length}/${ctrs.length} running`;
    };
    $$('.pi-ctr', list).forEach(paintCtr);
    list.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      const li = b.closest('.pi-ctr');
      const c = ctrs[li.dataset.i];
      c.on = !c.on;
      if (c.on) s.cpu += 25;          // starting a container is a short burst of work
      paintCtr(li);
    });

    // CPU history: 60 s at one sample per 500 ms
    const N = 120, hist = new Array(N).fill(12);
    const line = $('.spark__line', root), fill = $('.spark__fill', root);
    const s = { cpu: 12, ram: 38, temp: 47 };
    const draw = () => {
      const pts = hist.map((v, i) => `${(i / (N - 1) * 240).toFixed(1)},${(58 - v / 100 * 54).toFixed(1)}`);
      line.setAttribute('d', 'M' + pts.join('L'));
      fill.setAttribute('d', 'M0,60L' + pts.join('L') + 'L240,60Z');
    };
    const step = () => {
      const on = ctrs.filter(c => c.on);
      const base = 6 + on.reduce((a, c) => a + c.cpu, 0);
      s.cpu += (base - s.cpu) * 0.35 + (Math.random() - 0.5) * 9;
      if (Math.random() < 0.05) s.cpu += 20 + Math.random() * 25;
      s.cpu = clamp(s.cpu, 2, 98);
      const ramBase = 27 + on.reduce((a, c) => a + c.ram, 0);
      s.ram = clamp(s.ram + (ramBase - s.ram) * 0.15 + (Math.random() - 0.5) * 1.2, 10, 95);
      s.temp += (41 + s.cpu * 0.32 - s.temp) * 0.08;
      hist.push(s.cpu); hist.shift();
      set('cpu', s.cpu, s.cpu / 100);
      set('ram', s.ram, s.ram / 100);
      set('temp', s.temp, (s.temp - 30) / 55);
      g.temp.el.style.setProperty('--c', s.temp < 55 ? 'var(--mint)' : s.temp < 68 ? 'var(--amber)' : 'var(--rose)');
      draw();
    };
    for (let i = 0; i < N; i++) { step(); }   // start with a full minute of history
    ticker(root, 500, step);
  }

  // ---------- NetW1re: device list preview ----------
  function netDemo(root) {
    const devs = [
      { ic: 'fa-tv', name: 'Living-room TV', ip: '192.168.1.12', ven: 'Samsung', base: 4.8, s: 'online' },
      { ic: 'fa-laptop', name: 'Work laptop', ip: '192.168.1.31', ven: 'Dell', base: 1.6, s: 'online' },
      { ic: 'fa-mobile-screen-button', name: 'Phone', ip: '192.168.1.23', ven: 'Google', base: 2.2, s: 'limited' },
      { ic: 'fa-gamepad', name: 'Game console', ip: '192.168.1.40', ven: 'Sony', base: 7.4, s: 'blocked' },
      { ic: 'fa-volume-high', name: 'Smart speaker', ip: '192.168.1.52', ven: 'Amazon', base: 0.4, s: 'redirected' }
    ];
    const ACTS = [['blocked', 'fa-ban', 'Block'], ['redirected', 'fa-shuffle', 'Redirect'], ['limited', 'fa-gauge-high', 'Limit']];
    const LABEL = { blocked: 'Blocked', redirected: 'Redirected', limited: 'Limited' };
    const LIMIT = 0.25;   // MB/s cap for limited devices
    const list = $('.nd-list', root);
    list.innerHTML = devs.map((d, i) => `
      <li class="nd-row" data-i="${i}" data-s="${d.s}">
        <span class="nd-ic"><i class="fas ${d.ic}" aria-hidden="true"></i></span>
        <span class="nd-name"><b><span>${esc(d.name)}</span><em></em></b><span>${d.ip} · ${esc(d.ven)}</span></span>
        <span class="nd-rate"><span>0 KB/s</span><i><b></b></i></span>
        <span class="nd-acts">${ACTS.map(([a, ic, l]) => `<button type="button" data-a="${a}" title="${l}" aria-label="${l} ${esc(d.name)}" aria-pressed="false"><i class="fas ${ic}"></i></button>`).join('')}</span>
      </li>`).join('');
    const rows = $$('.nd-row', list);
    const paint = (li) => {
      const d = devs[li.dataset.i];
      li.dataset.s = d.s;
      $('em', li).textContent = LABEL[d.s] || '';
      $$('button', li).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.a === d.s)));
    };
    rows.forEach(paint);
    list.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      const li = b.closest('.nd-row');
      const d = devs[li.dataset.i];
      d.s = d.s === b.dataset.a ? 'online' : b.dataset.a;
      paint(li);
      step();
    });

    const fmt = (mb) => mb >= 1 ? mb.toFixed(1) + ' MB/s' : Math.round(mb * 1024) + ' KB/s';
    const total = $('[data-total]', root);
    devs.forEach(d => { d.rate = d.s === 'blocked' ? 0 : d.base; });
    const step = () => {
      let sum = 0;
      devs.forEach((d, i) => {
        const want = d.base * (0.45 + Math.random() * 1.1);
        if (d.s === 'blocked') d.rate *= 0.25;
        else d.rate += (want - d.rate) * 0.45;
        const rate = d.s === 'limited' ? Math.min(d.rate, LIMIT * (0.85 + Math.random() * 0.15)) : d.rate;
        sum += rate;
        const li = rows[i];
        $('.nd-rate > span', li).textContent = d.s === 'blocked' && rate < 0.01 ? '0 KB/s' : fmt(rate);
        $('.nd-rate b', li).style.width = clamp(rate / 9 * 100, rate > 0.005 ? 3 : 0, 100).toFixed(1) + '%';
      });
      total.textContent = fmt(sum);
    };
    step();
    ticker(root, 700, step);
  }

  function boot() {
    repoStats();
    copyButtons();
    facts();
    const pi = $('#piDemo'); if (pi) piDemo(pi);
    const net = $('#netDemo'); if (net) netDemo(net);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
