/* Cron expression helper: parse, explain in English, list next runs */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const exprEl = $('#expr'), say = $('#say'), state = $('#state');
  let useUtc = false;

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MON_N = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
  const DOW_N = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };
  const MACROS = { '@yearly': '0 0 1 1 *', '@annually': '0 0 1 1 *', '@monthly': '0 0 1 * *', '@weekly': '0 0 * * 0', '@daily': '0 0 * * *', '@midnight': '0 0 * * *', '@hourly': '0 * * * *' };
  const SPEC = [
    { name: 'minute', min: 0, max: 59 },
    { name: 'hour', min: 0, max: 23 },
    { name: 'day of month', min: 1, max: 31 },
    { name: 'month', min: 1, max: 12, names: MON_N },
    { name: 'day of week', min: 0, max: 7, names: DOW_N }
  ];

  function num(tok, f) {
    const up = tok.toUpperCase();
    if (f.names && up in f.names) return f.names[up];
    if (!/^\d+$/.test(tok)) throw new Error(`"${tok}" is not a valid ${f.name}`);
    const n = +tok;
    if (n < f.min || n > f.max) throw new Error(`${f.name} must be ${f.min}–${f.max} (got ${n})`);
    return n;
  }
  // returns { set:Set, any:boolean, parts:[{type,a,b,step}] }
  function parseField(str, f) {
    if (/[LW#?]/i.test(str)) throw new Error(`"${str}": L, W, # and ? are Quartz extensions and aren't supported`);
    const set = new Set(), parts = [];
    for (const piece of str.split(',')) {
      if (!piece) throw new Error(`Empty value in ${f.name}`);
      let [rng, step] = piece.split('/');
      if (step !== undefined && !/^\d+$/.test(step)) throw new Error(`Step "${step}" in ${f.name} must be a number`);
      step = step === undefined ? 1 : +step;
      if (step < 1) throw new Error(`Step in ${f.name} must be at least 1`);
      let a, b, type;
      if (rng === '*') { a = f.min; b = f.max === 7 ? 6 : f.max; type = step > 1 ? 'every' : 'any'; }
      else if (rng.includes('-')) { const [x, y] = rng.split('-'); a = num(x, f); b = num(y, f); type = 'range'; if (a > b) throw new Error(`Range ${rng} in ${f.name} goes backwards`); }
      else { a = num(rng, f); b = step > 1 ? (f.max === 7 ? 6 : f.max) : a; type = step > 1 ? 'from' : 'single'; }
      for (let v = a; v <= b; v += step) set.add(f.max === 7 && v === 7 ? 0 : v);
      parts.push({ type, a, b, step });
    }
    return { set, any: str === '*', parts };
  }
  function parse(expr) {
    let e = expr.trim().replace(/\s+/g, ' ');
    if (MACROS[e.toLowerCase()]) e = MACROS[e.toLowerCase()];
    if (e.startsWith('@')) throw new Error(`Unknown shortcut ${e} (try @hourly, @daily, @weekly, @monthly, @yearly)`);
    const f = e.split(' ');
    if (f.length !== 5) throw new Error(`Expected 5 fields (minute hour day month weekday), found ${f.length}`);
    return { raw: f, fields: f.map((s, i) => parseField(s, SPEC[i])) };
  }

  // ---------- English ----------
  const pad = (n) => String(n).padStart(2, '0');
  const ordinal = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
  const listJoin = (a) => a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
  function partText(p, f, fmt) {
    if (p.type === 'any') return null;
    if (p.type === 'every') return `every ${p.step === 1 ? '' : p.step + ' '}${f.unit}${p.step === 1 ? '' : 's'}`;
    if (p.type === 'range') return p.step > 1 ? `every ${p.step} ${f.unit}s from ${fmt(p.a)} through ${fmt(p.b)}` : `${fmt(p.a)} through ${fmt(p.b)}`;
    if (p.type === 'from') return `every ${p.step} ${f.unit}s starting at ${fmt(p.a)}`;
    return fmt(p.a);
  }
  function describe(r) {
    const [mi, ho, dom, mon, dow] = r.fields;
    const one = (x) => x.parts.length === 1 && x.parts[0].type === 'single';
    let time;
    if (one(mi) && one(ho)) time = `At <em>${pad(ho.parts[0].a)}:${pad(mi.parts[0].a)}</em>`;
    else if (one(mi) && ho.parts.every(p => p.type === 'single')) time = `At <em>${listJoin(ho.parts.map(p => pad(p.a) + ':' + pad(mi.parts[0].a)))}</em>`;
    else {
      const mt = mi.any ? 'every minute' : mi.parts.length === 1 && mi.parts[0].type === 'every' ? `every <em>${mi.parts[0].step} minutes</em>`
        : `at minute <em>${listJoin(mi.parts.map(p => partText(p, { unit: 'minute' }, String)))}</em>`;
      let ht = '';
      if (!ho.any && ho.parts.length === 1 && ho.parts[0].type === 'every') ht = ` past every <em>${ho.parts[0].step} hours</em>`;
      else if (!ho.any) ht = ho.parts.length === 1 && ho.parts[0].type === 'range' && ho.parts[0].step === 1
        ? ` between <em>${pad(ho.parts[0].a)}:00 and ${pad(ho.parts[0].b)}:59</em>`
        : ` during hour <em>${listJoin(ho.parts.map(p => partText(p, { unit: 'hour' }, v => pad(v) + ':00')))}</em>`;
      else if (!mi.any && !(mi.parts.length === 1 && mi.parts[0].type === 'every')) ht = ' past every hour';
      time = mt.charAt(0).toUpperCase() + mt.slice(1) + ht;
    }
    const dayName = (v) => DAYS[v % 7];
    let days = '';
    const domT = dom.any ? '' : `on the <em>${listJoin(dom.parts.map(p => partText(p, { unit: 'day' }, ordinal)))}</em> of the month`;
    const dowT = dow.any ? '' : `on <em>${listJoin(dow.parts.map(p => partText(p, { unit: 'day' }, dayName)))}</em>`;
    if (domT && dowT) days = `${domT} or ${dowT}`; else days = domT || dowT || '';
    const monT = mon.any ? '' : `in <em>${listJoin(mon.parts.map(p => partText(p, { unit: 'month' }, v => MONTHS[v - 1])))}</em>`;
    return [time, days, monT].filter(Boolean).join(', ') + '.';
  }

  // ---------- next runs ----------
  function nextRuns(r, count) {
    const [mi, ho, dom, mon, dow] = r.fields.map(x => x.set);
    const domAny = r.fields[2].any, dowAny = r.fields[4].any;
    const G = useUtc ? { y: 'getUTCFullYear', mo: 'getUTCMonth', d: 'getUTCDate', h: 'getUTCHours', m: 'getUTCMinutes', w: 'getUTCDay' }
      : { y: 'getFullYear', mo: 'getMonth', d: 'getDate', h: 'getHours', m: 'getMinutes', w: 'getDay' };
    const mk = (y, mo, d, h, m) => useUtc ? new Date(Date.UTC(y, mo, d, h, m)) : new Date(y, mo, d, h, m);
    let t = new Date(Date.now() + 60000); t = mk(t[G.y](), t[G.mo](), t[G.d](), t[G.h](), t[G.m]());
    const out = []; let guard = 0;
    while (out.length < count && guard++ < 200000) {
      const y = t[G.y](), mo = t[G.mo](), d = t[G.d](), h = t[G.h](), m = t[G.m]();
      if (!mon.has(mo + 1)) { t = mk(y, mo + 1, 1, 0, 0); continue; }
      const dm = dom.has(d), dw = dow.has(t[G.w]());
      const dayOk = domAny && dowAny ? true : domAny ? dw : dowAny ? dm : (dm || dw);
      if (!dayOk) { t = mk(y, mo, d + 1, 0, 0); continue; }
      if (!ho.has(h)) { t = mk(y, mo, d, h + 1, 0); continue; }
      if (!mi.has(m)) { t = mk(y, mo, d, h, m + 1); continue; }
      out.push(t); t = mk(y, mo, d, h, m + 1);
    }
    return out;
  }
  function relTime(d) {
    const s = Math.round((d - Date.now()) / 1000);
    const D = Math.floor(s / 86400), H = Math.floor(s % 86400 / 3600), M = Math.floor(s % 3600 / 60);
    if (D > 0) return `in ${D}d ${H}h`;
    if (H > 0) return `in ${H}h ${M}m`;
    return `in ${Math.max(1, M)}m`;
  }

  function highlightField() {
    const v = exprEl.value, pos = exprEl.selectionStart || 0;
    const before = v.slice(0, pos).trimStart();
    const idx = before.length ? before.split(/\s+/).length - 1 : 0;
    document.querySelectorAll('#fields span').forEach((s, i) => s.classList.toggle('on', i === idx && !v.trim().startsWith('@')));
  }

  function render() {
    let r;
    try { r = parse(exprEl.value); }
    catch (e) {
      exprEl.classList.add('is-bad'); state.className = 'status err'; state.innerHTML = `<i class="fas fa-triangle-exclamation"></i>${e.message}`;
      say.textContent = ''; $('#runs').innerHTML = ''; $('#breakdown').innerHTML = ''; return;
    }
    exprEl.classList.remove('is-bad'); state.className = 'status ok'; state.innerHTML = '<i class="fas fa-circle-check"></i>Valid cron expression';
    say.innerHTML = describe(r);
    document.querySelectorAll('#fields span').forEach((s, i) => { s.innerHTML = `<b>${r.raw[i]}</b>${['minute', 'hour', 'day (month)', 'month', 'day (week)'][i]}`; });
    const fmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: useUtc ? 'UTC' : undefined });
    const runs = nextRuns(r, 10);
    $('#runs').innerHTML = runs.length ? runs.map((d, i) => `<li style="--i:${i}">${fmt.format(d)}<span>${relTime(d)}</span></li>`).join('')
      : '<li style="--i:0">No run in the next few years (e.g. 31 February)<span></span></li>';
    const names = ['Minute', 'Hour', 'Day of month', 'Month', 'Day of week'];
    $('#breakdown').innerHTML = r.fields.map((f, i) => {
      const vals = [...f.set].sort((a, b) => a - b);
      const shown = f.any ? 'every' : (i === 3 ? vals.map(v => MONTHS[v - 1].slice(0, 3)) : i === 4 ? vals.map(v => DAYS[v].slice(0, 3)) : vals).join(', ');
      return `<div><dt>${names[i]}</dt><dd>${shown}</dd><span></span></div>`;
    }).join('');
    highlightField();
  }

  exprEl.addEventListener('input', render);
  ['keyup', 'click', 'focus'].forEach(ev => exprEl.addEventListener(ev, highlightField));
  exprEl.addEventListener('blur', () => document.querySelectorAll('#fields span').forEach(s => s.classList.remove('on')));
  $('#presets').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b) { exprEl.value = b.dataset.v; render(); } });
  $('#tz').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    $('#tz').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
    useUtc = b.dataset.tz === 'utc'; render();
  });
  setInterval(() => { if (!document.hidden) render(); }, 30000);
  render();
})();
