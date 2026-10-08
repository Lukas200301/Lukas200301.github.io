/* Stats page: GitHub contributions, streaks, calendar, languages and repositories.
   Data: GitHub REST API (unauthenticated, 60 req/h) + github-contributions-api (jogruber).
   Everything is cached in localStorage so repeat visits cost no API calls. Charts are plain SVG. */
(function () {
  'use strict';
  const USER = 'Lukas200301';
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (n) => Number(n).toLocaleString('en');
  const compact = (n) => n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : n >= 1e4 ? (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K' : fmt(n);
  const bytes = (b) => b >= 1e6 ? (b / 1e6).toFixed(1) + ' MB' : b >= 1e3 ? Math.round(b / 1e3) + ' KB' : b + ' B';
  const pct = (x) => x >= 0.1 ? Math.round(x * 100) + '%' : x >= 0.001 ? (x * 100).toFixed(1) + '%' : '<0.1%';
  const plural = (n, w) => `${fmt(n)} ${w}${n === 1 ? '' : 's'}`;
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const WD = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const DAYS3 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const shortDate = (s) => { const d = parse(s); return `${d.getDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]} ${d.getFullYear()}`; };
  const longDate = (s) => `${DAYS3[parse(s).getDay()]}, ${shortDate(s)}`;
  const mondayIdx = (d) => (d.getDay() + 6) % 7;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TODAY = ymd(new Date());

  // categorical slots (validated on the panel surface), "Other" is neutral gray
  const SLOTS = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)'];
  const OTHER = 'var(--s-other)';

  // ---------- cache ----------
  const cache = {
    read(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } },
    get(k, ttl) { const v = this.read(k); return v && Date.now() - v.t < ttl ? v : null; },
    set(k, data) { const v = { t: Date.now(), data }; try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} return v; }
  };
  async function getJSON(u) {
    const r = await fetch(u);
    if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
    return r.json();
  }
  async function cached(key, ttl, load) {
    const fresh = cache.get(key, ttl);
    if (fresh) return fresh;
    try { return cache.set(key, await load()); }
    catch (e) { const stale = cache.read(key); if (stale) { stale.stale = true; return stale; } throw e; }
  }

  // ---------- state ----------
  const S = { days: null, total: null, repos: null, user: null, langs: null, langsApprox: false, range: null, tables: {}, drawn: {}, sort: { key: 'pushed', dir: -1 }, times: [] };
  const params = new URLSearchParams(location.search);
  S.range = params.get('r') || 'last12';

  // ---------- data loading ----------
  async function loadContrib() {
    const v = await cached('st-contrib-v1', 3 * 3600e3, async () => {
      const j = await getJSON(`https://github-contributions-api.jogruber.de/v4/${USER}?y=all`);
      return { total: j.total || {}, days: (j.contributions || []).map(c => [c.date, c.count]) };
    });
    S.times.push(v.t);
    // the API returns the whole current year (future days included) newest first; keep up to today, oldest first
    S.days = v.data.days.filter(d => d[0] <= TODAY).sort((a, b) => a[0] < b[0] ? -1 : 1);
    S.total = v.data.total;
  }
  async function loadRepos() {
    const [r, u] = await Promise.all([
      cached('st-repos-v1', 30 * 60e3, async () => (await getJSON(`https://api.github.com/users/${USER}/repos?per_page=100&type=owner`)).map(x => ({
        name: x.name, url: x.html_url, desc: x.description, lang: x.language, created: x.created_at, pushed: x.pushed_at,
        size: x.size, stars: x.stargazers_count, forks: x.forks_count, fork: x.fork, archived: x.archived
      }))),
      cached('st-user-v1', 60 * 60e3, async () => { const x = await getJSON(`https://api.github.com/users/${USER}`); return { followers: x.followers, created: x.created_at, public_repos: x.public_repos }; }).catch(() => null)
    ]);
    S.times.push(r.t);
    S.repos = r.data.filter(x => !x.fork);
    S.user = u && u.data;
  }
  // bytes per language for every repo; only repos pushed since the last fetch are re-requested
  async function loadLangs() {
    const store = cache.read('st-langs-v1') || { t: 0, data: {} };
    const map = store.data || {};
    const todo = S.repos.filter(r => !map[r.name] || map[r.name].pushed !== r.pushed);
    let limited = false;
    const queue = todo.slice();
    async function worker() {
      while (queue.length && !limited) {
        const r = queue.shift();
        try { map[r.name] = { pushed: r.pushed, langs: await getJSON(`https://api.github.com/repos/${USER}/${encodeURIComponent(r.name)}/languages`) }; }
        catch (e) { if (e.status === 403 || e.status === 429) limited = true; }
      }
    }
    await Promise.all([worker(), worker(), worker()]);
    if (todo.length) cache.set('st-langs-v1', map);
    // anything still unknown falls back to the repo's main language weighted by its size
    S.langsApprox = false;
    S.langs = S.repos.map(r => {
      if (map[r.name] && map[r.name].langs) return { repo: r, langs: map[r.name].langs };
      if (r.lang) { S.langsApprox = true; return { repo: r, langs: { [r.lang]: Math.max(1, r.size) * 1024 } }; }
      return { repo: r, langs: {} };
    });
  }

  // ---------- derived numbers ----------
  function streaks(days) {
    let longest = 0, lStart = null, lEnd = null, run = 0, runStart = null;
    for (const [d, c] of days) {
      if (c > 0) { if (!run) runStart = d; run++; if (run > longest) { longest = run; lStart = runStart; lEnd = d; } }
      else run = 0;
    }
    // current streak: today only counts once you've contributed, so start from yesterday if today is still 0
    let i = days.length - 1;
    if (i >= 0 && days[i][0] === TODAY && days[i][1] === 0) i--;
    let cur = 0, cStart = null;
    while (i >= 0 && days[i][1] > 0) { cur++; cStart = days[i][0]; i--; }
    return { cur, cStart, longest, lStart, lEnd };
  }
  function rangeDays() {
    const r = S.range;
    if (r === 'all') return S.days;
    if (r === 'last12') { const from = ymd(addDays(new Date(), -364)); return S.days.filter(d => d[0] >= from); }
    return S.days.filter(d => d[0].startsWith(r));
  }
  const rangeName = () => S.range === 'all' ? 'all time' : S.range === 'last12' ? 'the last 12 months' : S.range;
  // heat levels from quartiles of all non-zero days, so colours mean the same in every range
  let LEVELS = [1, 2, 3];
  function computeLevels() {
    const nz = S.days.map(d => d[1]).filter(Boolean).sort((a, b) => a - b);
    if (!nz.length) return;
    const q = (p) => nz[Math.min(nz.length - 1, Math.floor(p * nz.length))];
    LEVELS = [q(0.25), q(0.5), q(0.75)];
  }
  const level = (c) => c <= 0 ? 0 : c <= LEVELS[0] ? 1 : c <= LEVELS[1] ? 2 : c <= LEVELS[2] ? 3 : 4;

  // ---------- small svg helpers ----------
  function niceTicks(max, count = 4) {
    if (max <= 0) return [0, 1];
    const raw = max / count, mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) || 10 * mag;
    const stepI = Math.max(1, Math.round(step));    // counts are integers
    const out = []; for (let v = 0; v <= max + stepI * 0.001 || out.length < 2; v += stepI) { out.push(v); if (v >= max) break; }
    if (out[out.length - 1] < max) out.push(out[out.length - 1] + stepI);
    return out;
  }
  // column with 4px rounded data end and a square baseline
  function colPath(x, y, w, h, r = 4) {
    r = Math.min(r, w / 2, h);
    if (h <= 0) return '';
    return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
  }
  function barPath(x, y, w, h, r = 4) {   // horizontal: rounded right end
    r = Math.min(r, h / 2, w);
    if (w <= 0) return '';
    return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`;
  }
  const tipAttr = (html) => `data-tip="${esc(html)}"`;
  function firstDraw(id) { if (S.drawn[id] || reduce) return ''; S.drawn[id] = true; return ' grow'; }
  function tableHTML(cols, rows) {
    return `<div class="table-wrap"><table class="table"><thead><tr>${cols.map((c, i) => `<th${i ? ' class="num"' : ''}>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((v, i) => `<td${i ? ' class="num"' : ''}>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }

  // ---------- KPI tiles ----------
  function kpiShell() {
    const t = (id, icon, label, hero) => `<div class="kpi is-loading${hero ? ' kpi--hero' : ''}" id="k-${id}"><div><span class="kpi__label"><i class="${icon}"></i>${label}</span><span class="kpi__value">0</span><span class="kpi__sub">loading</span></div>${hero ? '<svg class="kpi__spark" id="spark" aria-hidden="true"></svg>' : ''}</div>`;
    $('#kpis').innerHTML = t('total', 'fas fa-code-commit', 'Contributions, all time', true) + t('year', 'fas fa-calendar', `Contributions in ${new Date().getFullYear()}`) +
      t('streak', 'fas fa-fire', 'Current streak') + t('longest', 'fas fa-trophy', 'Longest streak') +
      t('repos', 'fas fa-box-archive', 'Repositories') + t('stars', 'fas fa-star', 'Stars earned') + t('langcount', 'fas fa-code', 'Languages');
  }
  function setKpi(id, value, sub, unit) {
    const el = $('#k-' + id); if (!el) return;
    el.classList.remove('is-loading');
    const v = $('.kpi__value', el);
    v.innerHTML = `<span>0</span>${unit ? `<small>${esc(unit)}</small>` : ''}`;
    const num = v.firstChild;
    if (typeof value === 'number' && window.Site && Site.countUp) Site.countUp(num, value, 1100); else num.textContent = typeof value === 'number' ? fmt(value) : value;
    $('.kpi__sub', el).innerHTML = sub;
  }
  function kpisActivity() {
    const sum = S.days.reduce((a, d) => a + d[1], 0);
    const active = S.days.filter(d => d[1] > 0).length;
    const firstYear = Object.keys(S.total).filter(y => S.total[y] > 0).sort()[0] || S.days[0][0].slice(0, 4);
    setKpi('total', sum, `since ${firstYear} · ${plural(active, 'active day')}`);
    const y = String(new Date().getFullYear());
    const last30 = S.days.filter(d => d[0] >= ymd(addDays(new Date(), -29))).reduce((a, d) => a + d[1], 0);
    setKpi('year', S.total[y] != null ? S.total[y] : S.days.filter(d => d[0].startsWith(y)).reduce((a, d) => a + d[1], 0), `${fmt(last30)} in the last 30 days`);
    const st = streaks(S.days);
    setKpi('streak', st.cur, st.cur ? `since ${shortDate(st.cStart)}` : 'nothing yesterday, a new one starts today', st.cur === 1 ? 'day' : 'days');
    setKpi('longest', st.longest, st.longest ? `${shortDate(st.lStart)} – ${shortDate(st.lEnd)}` : '–', st.longest === 1 ? 'day' : 'days');
    drawSpark();
  }
  // sparkline: last 12 months, current month in the accent
  function drawSpark() {
    const now = new Date(), months = [];
    for (let k = 11; k >= 0; k--) { const d = new Date(now.getFullYear(), now.getMonth() - k, 1); months.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`); }
    const vals = months.map(m => S.days.filter(d => d[0].startsWith(m)).reduce((a, d) => a + d[1], 0));
    const sp = $('#spark'); const w = sp.clientWidth || 300, h = 56, mx = Math.max(1, ...vals);
    const bw = Math.min(24, w / 12 - 4);
    sp.setAttribute('viewBox', `0 0 ${w} ${h}`);
    sp.innerHTML = vals.map((v, i) => { const bh = Math.max(v ? 3 : 0, v / mx * (h - 4)); const x = i * (w / 12) + (w / 12 - bw) / 2; return `<path d="${colPath(x, h - bh, bw, bh, 3)}" fill="${i === 11 ? 'var(--amber)' : 'var(--bar-dim)'}"/>`; }).join('');
  }
  function kpisRepos() {
    const y = String(new Date().getFullYear());
    const n = S.repos.length, thisYear = S.repos.filter(r => (r.created || '').startsWith(y)).length;
    setKpi('repos', n, `${thisYear} created this year${S.user ? ` · ${plural(S.user.followers, 'follower')}` : ''}`);
    const stars = S.repos.reduce((a, r) => a + r.stars, 0), forks = S.repos.reduce((a, r) => a + r.forks, 0);
    setKpi('stars', stars, `and ${plural(forks, 'fork')} by others`);
  }
  function kpisLangs(agg) {
    const total = agg.reduce((a, l) => a + l.bytes, 0);
    setKpi('langcount', agg.length, `${bytes(total)} of code${S.langsApprox ? ' (estimated)' : ''}`);
  }

  // ---------- range filter ----------
  function buildRange() {
    const years = Object.keys(S.total).filter(y => S.total[y] > 0 || S.days.some(d => d[0].startsWith(y))).sort().reverse();
    const opts = [['last12', 'Last 12 months'], ...years.map(y => [y, y]), ['all', 'All time']];
    if (!opts.some(o => o[0] === S.range)) S.range = 'last12';
    $('#range').innerHTML = opts.map(([v, t]) => `<button type="button" class="filter" data-r="${v}" aria-pressed="${v === S.range}">${t}</button>`).join('');
  }
  $('#range').addEventListener('click', e => {
    const b = e.target.closest('[data-r]'); if (!b || !S.days) return;
    S.range = b.dataset.r;
    $('#range').querySelectorAll('[data-r]').forEach(x => x.setAttribute('aria-pressed', x === b));
    const u = new URL(location.href); S.range === 'last12' ? u.searchParams.delete('r') : u.searchParams.set('r', S.range);
    history.replaceState(null, '', u);
    S.drawn.calendar = false; S.drawn.weekdays = false;
    renderActivity();
  });

  // ---------- charts: activity ----------
  function renderActivity() {
    const days = rangeDays();
    const sum = days.reduce((a, d) => a + d[1], 0), active = days.filter(d => d[1] > 0).length;
    $('#rangeSum').innerHTML = `<b>${fmt(sum)}</b> contributions · <b>${fmt(active)}</b> active days${active ? ` · <b>${(sum / active).toFixed(1)}</b> per active day` : ''}`;
    renderMonths(); renderCalendar(days); renderWeekdays(days); renderTopDays(days);
  }

  function renderMonths() {
    const host = $('#months'); host.classList.remove('is-loading');
    const firstYear = +(Object.keys(S.total).filter(y => S.total[y] > 0).sort()[0] || S.days[0][0].slice(0, 4));
    const now = new Date(), months = [];
    for (let d = new Date(firstYear, 0, 1); d <= now; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) months.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
    const by = {}; S.days.forEach(([d, c]) => { const m = d.slice(0, 7); by[m] = (by[m] || 0) + c; });
    const vals = months.map(m => by[m] || 0);
    const inRange = (m) => S.range === 'all' || (S.range === 'last12' ? m >= ymd(addDays(now, -364)).slice(0, 7) : m.startsWith(S.range));
    if (S.tables.months) { host.innerHTML = tableHTML(['Month', 'Contributions'], months.map((m, i) => [`${MON[+m.slice(5) - 1]} ${m.slice(0, 4)}`, fmt(vals[i])]).reverse()); return; }
    const W = host.clientWidth || 800, H = 250, L = 40, R = 8, T = 22, B = 26, pw = W - L - R, ph = H - T - B;
    const ticks = niceTicks(Math.max(...vals)), top = ticks[ticks.length - 1];
    const band = pw / months.length, cw = Math.max(2, Math.min(24, band - 2));
    const y = (v) => T + ph - v / top * ph;
    // label only the peak inside the selected range
    let peak = -1; months.forEach((m, i) => { if (inRange(m) && vals[i] > 0 && (peak < 0 || vals[i] > vals[peak])) peak = i; });
    let s = `<g class="grid">${ticks.map(t => `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}"/>`).join('')}</g>`;
    s += ticks.map(t => `<text x="${L - 8}" y="${y(t) + 4}" text-anchor="end">${compact(t)}</text>`).join('');
    months.forEach((m, i) => {
      const x0 = L + i * band, v = vals[i], h = v / top * ph;
      const name = `${MON[+m.slice(5) - 1]} ${m.slice(0, 4)}`;
      s += `<g class="col" ${tipAttr(`<b>${fmt(v)}</b> contributions<br><span class="tip__m">${name}</span>`)}><rect class="hit" x="${x0}" y="${T}" width="${band}" height="${ph}"/>${v ? `<path class="mark mark--v${inRange(m) ? '' : ' is-dim'}" style="--i:${i}" fill="var(--bar)" d="${colPath(x0 + (band - cw) / 2, y(v), cw, h)}"/>` : ''}</g>`;
      if (m.endsWith('-01')) s += `<text x="${x0 + (band - cw) / 2}" y="${H - 6}">${m.slice(0, 4)}</text>`;
    });
    if (peak >= 0) s += `<text class="val" x="${L + peak * band + band / 2}" y="${y(vals[peak]) - 7}" text-anchor="middle">${fmt(vals[peak])}</text>`;
    s += `<line class="base" x1="${L}" x2="${W - R}" y1="${T + ph + 0.5}" y2="${T + ph + 0.5}"/>`;
    host.innerHTML = `<svg class="viz${firstDraw('months')}" viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="Contributions per month since ${firstYear}">${s}</svg>`;
  }

  function calBlock(start, end, W, labelW, title) {
    const gap = 3;
    const gStart = addDays(start, -mondayIdx(start));
    const weeks = Math.floor((end - gStart) / 864e5 / 7) + 1;
    const cs = Math.max(8, Math.min(15, Math.floor((W - labelW) / weeks) - gap));
    const step = cs + gap, top = 18;
    const w = labelW + weeks * step, h = top + 7 * step;
    const map = new Map(S.days);
    let s = '', lastMonth = -1, lastCol = -9;
    if (title) s += `<text class="lbl" x="0" y="${top + 3.5 * step + 4}" style="font-weight:600">${title}</text>`;
    ['Mon', '', 'Wed', '', 'Fri', '', ''].forEach((d, i) => { if (d && !title) s += `<text x="0" y="${top + i * step + cs - 2}">${d}</text>`; });
    for (let d = new Date(gStart), k = 0; d <= end; d = addDays(d, 1), k++) {
      if (d < start) continue;
      const col = Math.floor(k / 7), row = mondayIdx(d), key = ymd(d);
      if ((d.getDate() === 1 || lastMonth < 0) && d.getMonth() !== lastMonth) {
        if (col - lastCol >= 3) { s += `<text x="${labelW + col * step}" y="11">${MON[d.getMonth()]}</text>`; lastCol = col; }
        lastMonth = d.getMonth();
      }
      if (key > TODAY) { s += `<rect class="cell future" x="${labelW + col * step + 0.5}" y="${top + row * step + 0.5}" width="${cs - 1}" height="${cs - 1}"/>`; continue; }
      const c = map.get(key) || 0;
      s += `<rect class="cell" data-l="${level(c)}" style="--w:${col}" x="${labelW + col * step}" y="${top + row * step}" width="${cs}" height="${cs}" ${tipAttr(`<b>${c ? plural(c, 'contribution') : 'No contributions'}</b><br><span class="tip__m">${longDate(key)}</span>`)}/>`;
    }
    return { s, w, h };
  }
  function renderCalendar(days) {
    const host = $('#calendar'); host.classList.remove('is-loading');
    const W = host.clientWidth || 800;
    const active = days.filter(d => d[1] > 0).length;
    $('#calSub').textContent = `${fmt(active)} of ${fmt(days.length)} days with at least one contribution in ${rangeName()}.`;
    const grow = firstDraw('calendar');
    let html = '';
    if (S.range === 'all') {
      const years = [...new Set(S.days.map(d => d[0].slice(0, 4)))].filter(y => S.days.some(d => d[0].startsWith(y) && d[1] > 0) || y === TODAY.slice(0, 4)).sort().reverse();
      html = years.map(y => {
        const b = calBlock(new Date(+y, 0, 1, 12), new Date(+y, 11, 31, 12), W, 48, y);
        return `<svg class="heat${grow}" viewBox="0 0 ${b.w} ${b.h}" width="${b.w}" height="${b.h}" style="margin-bottom:6px" role="img" aria-label="Contribution calendar ${y}">${b.s}</svg>`;
      }).join('');
    } else {
      let start, end;
      if (S.range === 'last12') { end = parse(TODAY); start = addDays(end, -364); }
      else { start = new Date(+S.range, 0, 1, 12); end = new Date(+S.range, 11, 31, 12); }
      const b = calBlock(start, end, W, 32);
      html = `<svg class="heat${grow}" viewBox="0 0 ${b.w} ${b.h}" width="${b.w}" height="${b.h}" role="img" aria-label="Contribution calendar for ${rangeName()}">${b.s}</svg>`;
    }
    host.innerHTML = `<div class="cal-scroll">${html}</div>`;
    const sc = host.firstChild; sc.scrollLeft = sc.scrollWidth;   // newest weeks first on small screens
  }

  function renderWeekdays(days) {
    const host = $('#weekdays'); host.classList.remove('is-loading');
    const tot = Array(7).fill(0), n = Array(7).fill(0);
    days.forEach(([d, c]) => { const i = mondayIdx(parse(d)); tot[i] += c; n[i]++; });
    const avg = tot.map((t, i) => n[i] ? t / n[i] : 0);
    const best = avg.indexOf(Math.max(...avg)), worst = avg.indexOf(Math.min(...avg));
    $('#weekSub').textContent = Math.max(...avg) > 0 ? `Most active on ${WD[best]}s, quietest on ${WD[worst]}s.` : 'No contributions in this range.';
    if (S.tables.weekdays) { host.innerHTML = tableHTML(['Day', 'Total', 'Average'], WD.map((d, i) => [d, fmt(tot[i]), avg[i].toFixed(2)])); return; }
    const W = host.clientWidth || 400, L = 44, R = 46, rowH = 32, bh = 16, H = 7 * rowH;
    const mx = Math.max(...avg) || 1, pw = W - L - R;
    let s = '';
    avg.forEach((v, i) => {
      const yy = i * rowH, w = v / mx * pw;
      s += `<g class="row" ${tipAttr(`<b>${v.toFixed(2)}</b> per ${WD[i]} on average<br><span class="tip__m">${plural(tot[i], 'contribution')} over ${n[i]} ${WD[i]}s</span>`)}><rect class="hit" x="0" y="${yy}" width="${W}" height="${rowH}"/>`;
      s += `<text class="lbl" x="0" y="${yy + rowH / 2 + 4}">${WD[i].slice(0, 3)}</text>`;
      if (w > 0) s += `<path class="mark mark--h" style="--i:${i}" fill="var(--bar)" d="${barPath(L, yy + (rowH - bh) / 2, Math.max(2, w), bh)}"/>`;
      s += `<text class="${i === best ? 'val' : ''}" x="${L + w + 8}" y="${yy + rowH / 2 + 4}">${v.toFixed(1)}</text></g>`;
    });
    s += `<line class="base" x1="${L - 0.5}" x2="${L - 0.5}" y1="2" y2="${H - 2}"/>`;
    host.innerHTML = `<svg class="viz${firstDraw('weekdays')}" viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="Average contributions per weekday">${s}</svg>`;
  }

  function renderTopDays(days) {
    const host = $('#topdays'); host.classList.remove('is-loading');
    const top = days.filter(d => d[1] > 0).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? 1 : -1)).slice(0, 5);
    if (!top.length) { host.innerHTML = '<p class="viz__empty">No contributions in this range.</p>'; return; }
    const mx = top[0][1];
    host.innerHTML = `<ol class="topdays">${top.map(([d, c], i) => `<li style="--i:${i}"><span class="td__name">${longDate(d)}</span><span class="td__val">${fmt(c)} <small>contributions</small></span><span class="td__bar" style="width:${Math.max(3, c / mx * 100)}%"></span></li>`).join('')}</ol>`;
  }

  // ---------- charts: languages + repos ----------
  let LANG_COLOR = {};
  function langAgg() {
    const agg = {};
    S.langs.forEach(({ langs }) => Object.entries(langs).forEach(([l, b]) => { agg[l] = agg[l] || { name: l, bytes: 0, repos: 0 }; agg[l].bytes += b; agg[l].repos++; }));
    const list = Object.values(agg).sort((a, b) => b.bytes - a.bytes);
    LANG_COLOR = {}; list.slice(0, SLOTS.length).forEach((l, i) => { LANG_COLOR[l.name] = SLOTS[i]; });
    return list;
  }
  const colorOf = (l) => LANG_COLOR[l] || OTHER;

  function renderLangs(list) {
    const host = $('#langs'); host.classList.remove('is-loading');
    const total = list.reduce((a, l) => a + l.bytes, 0);
    $('#langSub').textContent = `Share of code across ${(S.repos.length === 1 ? '1 repository' : fmt(S.repos.length) + ' repositories')}${S.langsApprox ? ' (partly estimated: GitHub\'s hourly API limit was reached, so some repos count their main language only)' : ''}.`;
    if (!list.length) { host.innerHTML = '<p class="viz__empty">No language data yet.</p>'; return; }
    const top = list.slice(0, SLOTS.length), rest = list.slice(SLOTS.length);
    const rows = top.map(l => ({ ...l, c: colorOf(l.name) }));
    if (rest.length) rows.push({ name: `Other (${rest.length})`, bytes: rest.reduce((a, l) => a + l.bytes, 0), repos: null, c: OTHER, others: rest });
    if (S.tables.langs) { host.innerHTML = tableHTML(['Language', 'Code', 'Share'], list.map(l => [l.name, bytes(l.bytes), pct(l.bytes / total)])); return; }
    const W = host.clientWidth || 400, L = 112, R = 52, rowH = 32, bh = 16, H = rows.length * rowH;
    const mx = rows.reduce((a, r) => Math.max(a, r.bytes), 0), pw = W - L - R;
    let s = '';
    rows.forEach((r, i) => {
      const yy = i * rowH, w = Math.max(2, r.bytes / mx * pw);
      const extra = r.others ? `<br><span class="tip__m">${r.others.slice(0, 6).map(o => esc(o.name)).join(', ')}${r.others.length > 6 ? '…' : ''}</span>` : `<br><span class="tip__m">used in ${plural(r.repos, 'repo')}</span>`;
      s += `<g class="row" ${tipAttr(`<span class="tip__sw" style="--c:${r.c}"></span><b>${esc(r.name)}</b> · ${pct(r.bytes / total)}<br>${bytes(r.bytes)}${extra}`)}><rect class="hit" x="0" y="${yy}" width="${W}" height="${rowH}"/>`;
      s += `<circle cx="5" cy="${yy + rowH / 2}" r="4.5" fill="${r.c}"/><text class="lbl" x="16" y="${yy + rowH / 2 + 4}">${esc(r.name.length > 13 ? r.name.slice(0, 12) + '…' : r.name)}</text>`;
      s += `<path class="mark mark--h" style="--i:${i}" fill="${r.c}" d="${barPath(L, yy + (rowH - bh) / 2, w, bh)}"/>`;
      s += `<text class="${i === 0 ? 'val' : ''}" x="${L + w + 8}" y="${yy + rowH / 2 + 4}">${pct(r.bytes / total)}</text></g>`;
    });
    s += `<line class="base" x1="${L - 0.5}" x2="${L - 0.5}" y1="2" y2="${H - 2}"/>`;
    host.innerHTML = `<svg class="viz${firstDraw('langs')}" viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="Share of code by language">${s}</svg>`;
  }

  function renderYears() {
    const host = $('#years'); host.classList.remove('is-loading');
    const repos = S.repos.filter(r => r.created);
    if (!repos.length) { host.innerHTML = '<p class="viz__empty">No repositories yet.</p>'; $('#yearsLegend').innerHTML = ''; return; }
    const y0 = Math.min(...repos.map(r => +r.created.slice(0, 4))), y1 = new Date().getFullYear();
    const years = []; for (let y = y0; y <= y1; y++) years.push(String(y));
    const keyOf = (r) => r.lang && LANG_COLOR[r.lang] ? r.lang : 'Other';
    const order = [...Object.keys(LANG_COLOR), 'Other'];
    const by = {}; years.forEach(y => { by[y] = {}; });
    repos.forEach(r => { const y = r.created.slice(0, 4), k = keyOf(r); (by[y][k] = by[y][k] || []).push(r); });
    const used = order.filter(k => years.some(y => by[y][k]));
    $('#yearsLegend').innerHTML = used.map(k => `<span><i style="--c:${k === 'Other' ? OTHER : LANG_COLOR[k]}"></i>${esc(k === 'Other' ? 'Other / none' : k)}</span>`).join('');
    if (S.tables.years) { const rows = []; years.forEach(y => used.forEach(k => { if (by[y][k]) rows.push([y, k, String(by[y][k].length)]); })); host.innerHTML = tableHTML(['Year', 'Language', 'Repositories'], rows); return; }
    const totals = years.map(y => Object.values(by[y]).reduce((a, l) => a + l.length, 0));
    const W = host.clientWidth || 400, H = 230, L = 30, R = 6, T = 22, B = 26, pw = W - L - R, ph = H - T - B;
    const ticks = niceTicks(Math.max(...totals), 3), topV = ticks[ticks.length - 1];
    const band = pw / years.length, cw = Math.min(24, band - 8), unit = ph / topV, GAP = 2;
    let s = `<g class="grid">${ticks.map(t => `<line x1="${L}" x2="${W - R}" y1="${T + ph - t * unit}" y2="${T + ph - t * unit}"/>`).join('')}</g>`;
    s += ticks.map(t => `<text x="${L - 8}" y="${T + ph - t * unit + 4}" text-anchor="end">${t}</text>`).join('');
    years.forEach((y, i) => {
      const x = L + i * band + (band - cw) / 2;
      let base = T + ph;
      const segs = used.filter(k => by[y][k]);
      s += `<g class="col">`;
      segs.forEach((k, j) => {
        const list = by[y][k], h = list.length * unit, isTop = j === segs.length - 1;
        const yy = base - h, hh = h - (isTop ? 0 : GAP);      // 2px surface gap between segments
        const c = k === 'Other' ? OTHER : LANG_COLOR[k];
        s += `<path class="mark mark--v" style="--i:${i * 4 + j}" fill="${c}" d="${isTop ? colPath(x, yy, cw, hh) : `M${x},${yy + GAP}h${cw}v${hh - GAP}h${-cw}Z`}" ${tipAttr(`<span class="tip__sw" style="--c:${c}"></span><b>${esc(k === 'Other' ? 'Other / none' : k)}</b> · ${plural(list.length, 'repo')} in ${y}<br><span class="tip__m">${list.slice(0, 5).map(r => esc(r.name)).join(', ')}${list.length > 5 ? '…' : ''}</span>`)}/>`;
        base = yy;
      });
      s += `</g><text x="${L + i * band + band / 2}" y="${H - 6}" text-anchor="middle">${y.slice(2) === y.slice(-2) && band < 34 ? "'" + y.slice(2) : y}</text>`;
      if (totals[i]) s += `<text class="val" x="${L + i * band + band / 2}" y="${T + ph - totals[i] * unit - 7}" text-anchor="middle">${totals[i]}</text>`;
    });
    s += `<line class="base" x1="${L}" x2="${W - R}" y1="${T + ph + 0.5}" y2="${T + ph + 0.5}"/>`;
    host.innerHTML = `<svg class="viz${firstDraw('years')}" viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="New repositories per year by main language">${s}</svg>`;
  }

  const COLS = [
    ['name', 'Repository', (a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })],
    ['lang', 'Language', (a, b) => (a.lang || '~').localeCompare(b.lang || '~')],
    ['created', 'Created', (a, b) => a.created < b.created ? -1 : 1],
    ['pushed', 'Last push', (a, b) => a.pushed < b.pushed ? -1 : 1],
    ['size', 'Size', (a, b) => a.size - b.size],
    ['stars', 'Stars', (a, b) => a.stars - b.stars]
  ];
  function renderRepos() {
    const host = $('#repos');
    const col = COLS.find(c => c[0] === S.sort.key);
    const list = S.repos.slice().sort((a, b) => col[2](a, b) * S.sort.dir);
    const d = (s) => s ? shortDate(s.slice(0, 10)) : '–';
    host.innerHTML = `<table class="table"><thead><tr>${COLS.map(([k, t], i) => `<th class="${i >= 4 ? 'num' : ''}" data-k="${k}"${k === S.sort.key ? ` aria-sort="${S.sort.dir > 0 ? 'ascending' : 'descending'}"` : ''} tabindex="0">${t}</th>`).join('')}</tr></thead><tbody>${list.map(r => `<tr>
      <td><a href="${esc(r.url)}" target="_blank" rel="noopener" title="${esc(r.desc || '')}">${esc(r.name)}</a>${r.archived ? ' <span class="muted">· archived</span>' : ''}</td>
      <td>${r.lang ? `<span class="dot" style="--c:${colorOf(r.lang)}"></span>${esc(r.lang)}` : '<span class="muted">–</span>'}</td>
      <td>${d(r.created)}</td><td>${d(r.pushed)}</td><td class="num">${bytes(r.size * 1024)}</td><td class="num">${fmt(r.stars)}</td></tr>`).join('')}</tbody></table>`;
  }
  $('#repos').addEventListener('click', e => {
    const th = e.target.closest('th[data-k]'); if (!th || !S.repos) return;
    S.sort = th.dataset.k === S.sort.key ? { key: th.dataset.k, dir: -S.sort.dir } : { key: th.dataset.k, dir: th.dataset.k === 'name' || th.dataset.k === 'lang' ? 1 : -1 };
    renderRepos();
  });
  $('#repos').addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('th[data-k]')) { e.preventDefault(); e.target.click(); } });

  // ---------- repository timeline: created → last push ----------
  S.tlSort = 'created';
  function span(a, b) {   // "2 years 3 months", "5 months", "12 days"
    const d = Math.max(0, (Date.parse(b) - Date.parse(a)) / 864e5);
    if (d < 45) return plural(Math.max(1, Math.round(d)), 'day');
    const m = Math.round(d / 30.44), y = Math.floor(m / 12), r = m % 12;
    return y ? `${plural(y, 'year')}${r ? ' ' + plural(r, 'month') : ''}` : plural(m, 'month');
  }
  function renderTimeline() {
    const host = $('#timeline'); host.classList.remove('is-loading');
    const repos = S.repos.filter(r => r.created && r.pushed).slice()
      .sort((a, b) => S.tlSort === 'created' ? (a.created < b.created ? -1 : 1) : (a.pushed < b.pushed ? 1 : -1));
    if (!repos.length) { host.innerHTML = '<p class="viz__empty">No repositories yet.</p>'; $('#tlLegend').innerHTML = ''; return; }
    const ACTIVE_DAYS = 60, now = Date.now();
    const isActive = (r) => now - Date.parse(r.pushed) < ACTIVE_DAYS * 864e5;
    const active = repos.filter(isActive).length;
    const keyOf = (r) => r.lang && LANG_COLOR[r.lang] ? r.lang : 'Other';
    const used = [...Object.keys(LANG_COLOR), 'Other'].filter(k => repos.some(r => keyOf(r) === k));
    $('#tlLegend').innerHTML = used.map(k => `<span><i style="--c:${k === 'Other' ? OTHER : LANG_COLOR[k]}"></i>${esc(k === 'Other' ? 'Other / none' : k)}</span>`).join('') +
      `<span><i class="tl-dot"></i>Pushed in the last ${ACTIVE_DAYS} days</span>`;
    $('#tlSub').textContent = `Each bar runs from when a repository was created to its last push. ${active ? `${plural(active, 'repository')} active in the last ${ACTIVE_DAYS} days`.replace('repositorys', 'repositories') + '. ' : ''}Click one to open it on GitHub.`;
    if (S.tables.timeline) {
      host.innerHTML = tableHTML(['Repository', 'Started', 'Last push', 'Active for'], repos.map(r => [r.name, shortDate(r.created.slice(0, 10)), shortDate(r.pushed.slice(0, 10)), span(r.created, r.pushed)]));
      return;
    }
    const W = host.clientWidth || 900, L = Math.min(170, Math.max(110, W * 0.18)), R = 14, T = 26, rowH = 24, bh = 10;
    const H = T + repos.length * rowH + 6, pw = W - L - R;
    const y0 = new Date(Math.min(...repos.map(r => Date.parse(r.created)))).getFullYear();
    const t0 = new Date(y0, 0, 1).getTime(), t1 = Math.max(now, ...repos.map(r => Date.parse(r.pushed)));
    const X = (t) => L + (t - t0) / (t1 - t0) * pw;
    let s = '<g class="grid">';
    for (let y = y0; new Date(y, 0, 1).getTime() <= t1; y++) {
      const x = X(new Date(y, 0, 1).getTime());
      s += `<line x1="${x}" x2="${x}" y1="${T - 6}" y2="${H}"/>`;
    }
    s += '</g>';
    const tx = X(now);
    for (let y = y0; new Date(y, 0, 1).getTime() <= t1; y++) {
      const x = X(new Date(y, 0, 1).getTime()), next = X(Math.min(t1, new Date(y + 1, 0, 1).getTime()));
      if (next - x > 36) s += `<text x="${x + 6}" y="${T - 12}">${y}</text>`;
      else if (next - x > 20 && tx - next > 0) s += `<text x="${x + 3}" y="${T - 12}">'${String(y).slice(2)}</text>`;
    }
    s += `<line class="tl-today" x1="${tx}" x2="${tx}" y1="${T - 6}" y2="${H}"/><text class="tl-today-l" x="${tx - 4}" y="${T - 12}" text-anchor="end">today</text>`;
    repos.forEach((r, i) => {
      const yy = T + i * rowH, a = Date.parse(r.created), b = Date.parse(r.pushed);
      const x1 = X(a), x2 = Math.max(x1 + 4, X(b)), c = colorOf(r.lang), act = isActive(r);
      const maxC = Math.max(6, Math.floor((L - 16) / 6.7));
      const label = r.name.length > maxC ? r.name.slice(0, maxC - 1) + '…' : r.name;
      const tip = `<span class="tip__sw" style="--c:${c}"></span><b>${esc(r.name)}</b>${r.lang ? ` · ${esc(r.lang)}` : ''}<br>${shortDate(r.created.slice(0, 10))} → ${shortDate(r.pushed.slice(0, 10))}<br><span class="tip__m">${span(r.created, r.pushed)}${act ? ' · still active' : ''}${r.stars ? ` · ★ ${r.stars}` : ''}</span>`;
      s += `<a href="${esc(r.url)}" target="_blank" rel="noopener" aria-label="${esc(r.name)} on GitHub"><g class="row" ${tipAttr(tip)}>`;
      s += `<rect class="hit" x="0" y="${yy}" width="${W}" height="${rowH}"/>`;
      s += `<text class="lbl" x="${L - 12}" y="${yy + rowH / 2 + 4}" text-anchor="end">${esc(label)}</text>`;
      s += `<rect class="mark mark--t" style="--i:${i}" x="${x1}" y="${yy + (rowH - bh) / 2}" width="${x2 - x1}" height="${bh}" rx="${Math.min(4, (x2 - x1) / 2)}" fill="${c}"/>`;
      if (act) s += `<circle class="tl-end" cx="${x2}" cy="${yy + rowH / 2}" r="5"/>`;
      s += `</g></a>`;
    });
    host.innerHTML = `<svg class="viz tl${firstDraw('timeline')}" viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="Repository timeline from ${y0} to today">${s}</svg>`;
  }
  $('#tlSort').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !S.repos) return;
    $('#tlSort').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
    S.tlSort = b.dataset.v; S.drawn.timeline = false; renderTimeline();
  });

  function renderRepoParts() {
    const agg = langAgg();
    kpisLangs(agg); renderLangs(agg); renderYears(); renderTimeline(); renderRepos();
  }

  // ---------- table toggles ----------
  document.querySelectorAll('[data-table]').forEach(b => {
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => {
      const id = b.dataset.table; S.tables[id] = !S.tables[id]; b.setAttribute('aria-pressed', S.tables[id]);
      b.innerHTML = S.tables[id] ? '<i class="fas fa-chart-column"></i>Chart' : '<i class="fas fa-table"></i>Table';
      S.drawn[id] = true;
      if (id === 'months') S.days && renderMonths();
      if (id === 'weekdays') S.days && renderWeekdays(rangeDays());
      if (id === 'langs') S.langs && renderLangs(langAgg());
      if (id === 'years') S.langs && renderYears();
      if (id === 'timeline') S.langs && renderTimeline();
    });
  });

  // ---------- tooltip ----------
  const tip = $('#tip');
  let hoverEl = null;
  document.addEventListener('pointermove', e => {
    const t = e.target.closest && e.target.closest('[data-tip]');
    const g = t && (t.closest('g.col, g.row') || t);
    if (hoverEl && hoverEl !== g) hoverEl.classList.remove('hover');
    if (!t) { tip.hidden = true; hoverEl = null; return; }
    if (g !== hoverEl) { g.classList.add('hover'); hoverEl = g; tip.innerHTML = t.getAttribute('data-tip'); }
    tip.hidden = false;
    const r = tip.getBoundingClientRect();
    let x = e.clientX + 14, y = e.clientY - r.height - 12;
    if (x + r.width > innerWidth - 8) x = e.clientX - r.width - 14;
    if (y < 8) y = e.clientY + 18;
    tip.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }, { passive: true });
  document.addEventListener('pointerleave', () => { tip.hidden = true; });
  window.addEventListener('scroll', () => { tip.hidden = true; }, { passive: true });

  // ---------- errors + freshness ----------
  function showError(where, msg) {
    const host = $(where); host.classList.remove('is-loading');
    host.innerHTML = `<div class="stats-error"><span><i class="fas fa-triangle-exclamation"></i>${msg}</span><button class="btn btn--sm" type="button" data-retry><i class="fas fa-rotate"></i>Try again</button></div>`;
    $('[data-retry]', host).addEventListener('click', () => location.reload());
  }
  function updated() {
    if (!S.times.length) { $('#updated').textContent = 'Not loaded'; return; }
    const age = (Date.now() - Math.min(...S.times)) / 60000;
    $('#updated').textContent = age < 1 ? 'Updated just now' : age < 60 ? `Updated ${Math.round(age)} min ago` : `Updated ${Math.round(age / 60)} h ago`;
  }

  // the range bar gets its glass background only while it's stuck under the header (same as the list pages)
  (function stickyBar() {
    const bar = $('.stats-bar');
    if (!bar || !('IntersectionObserver' in window)) return;
    const sentinel = document.createElement('div');
    sentinel.style.cssText = 'height:1px;margin-bottom:-1px';
    bar.before(sentinel);
    const hh = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 64;
    new IntersectionObserver(([e]) => bar.classList.toggle('is-stuck', !e.isIntersecting && e.boundingClientRect.top < hh + 1),
      { rootMargin: `-${hh + 1}px 0px 0px 0px` }).observe(sentinel);
  })();

  // ---------- go ----------
  kpiShell();
  ['#months', '#calendar', '#weekdays', '#topdays', '#langs', '#years', '#timeline'].forEach(s => $(s).classList.add('is-loading'));
  $('#repos').innerHTML = '<p class="viz__empty">Loading repositories…</p>';

  loadContrib().then(() => {
    if (!S.days.length) throw new Error('empty');
    computeLevels(); buildRange(); kpisActivity(); renderActivity(); updated();
  }).catch(() => {
    ['#k-total', '#k-year', '#k-streak', '#k-longest'].forEach(s => setKpi(s.slice(3), '–', 'unavailable'));
    showError('#months', 'Couldn\'t load contributions right now.');
    ['#calendar', '#weekdays', '#topdays'].forEach(s => { $(s).classList.remove('is-loading'); $(s).innerHTML = '<p class="viz__empty">Unavailable</p>'; });
  });

  loadRepos().then(() => {
    kpisRepos(); updated();
    return loadLangs().then(renderRepoParts);
  }).catch(() => {
    ['repos', 'stars', 'langcount'].forEach(id => setKpi(id, '–', 'unavailable'));
    showError('#langs', 'GitHub didn\'t answer. Its API allows 60 requests per hour per visitor.');
    ['#years', '#timeline'].forEach(s => { $(s).classList.remove('is-loading'); $(s).innerHTML = '<p class="viz__empty">Unavailable</p>'; });
    $('#repos').innerHTML = '<p class="viz__empty">Unavailable</p>';
  });

  // redraw charts at the new width (no grow animation the second time)
  let rz, lastW = innerWidth;
  window.addEventListener('resize', () => {
    if (innerWidth === lastW) return; lastW = innerWidth;
    clearTimeout(rz); rz = setTimeout(() => {
      if (S.days) { renderMonths(); renderCalendar(rangeDays()); renderWeekdays(rangeDays()); drawSpark(); }
      if (S.langs) { renderLangs(langAgg()); renderYears(); renderTimeline(); }
    }, 150);
  });
  setInterval(updated, 60000);
})();
