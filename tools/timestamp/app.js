/* Timestamp converter + world clock (all time-zone maths via Intl) */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LOCAL = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const ZONES = (Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone') : ['UTC', 'Europe/Berlin', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'Asia/Tokyo', 'Australia/Sydney']);
  if (!ZONES.includes('UTC')) ZONES.unshift('UTC');
  let unit = 'auto';

  const row = (label, value) => `<div><dt>${label}</dt><dd>${esc(value)}</dd><button class="copy" type="button" data-copy-val="${esc(value)}" aria-label="Copy ${label}"><i class="far fa-copy"></i></button></div>`;
  function rel(ms) {
    const d = ms - Date.now(), a = Math.abs(d) / 1000;
    const units = [[31536000, 'year'], [2592000, 'month'], [604800, 'week'], [86400, 'day'], [3600, 'hour'], [60, 'minute'], [1, 'second']];
    for (const [s, n] of units) if (a >= s || s === 1) { const v = Math.round(a / s); return d >= 0 ? `in ${v} ${n}${v === 1 ? '' : 's'}` : `${v} ${n}${v === 1 ? '' : 's'} ago`; }
  }
  const fmtIn = (ms, tz, opts = {}) => new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: 'short', day: '2-digit', weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, ...opts }).format(ms);
  function offsetOf(ms, tz) {   // minutes east of UTC for tz at instant ms
    const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(ms);
    const g = (t) => +p.find(x => x.type === t).value;
    return Math.round((Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second')) - Math.floor(ms / 1000) * 1000) / 60000);
  }
  const offStr = (m) => `UTC${m >= 0 ? '+' : '−'}${String(Math.floor(Math.abs(m) / 60)).padStart(2, '0')}:${String(Math.abs(m) % 60).padStart(2, '0')}`;

  // ---------- live now ----------
  let lastSec = '';
  function tickNow() {
    const ms = Date.now(), s = String(Math.floor(ms / 1000));
    if (s !== lastSec) {
      // animate only the digits that changed
      const el = $('#nowSec');
      el.innerHTML = s.split('').map((c, i) => c !== lastSec[i] && lastSec ? `<span class="tickd">${c}</span>` : c).join('');
      lastSec = s;
      $('#nowMs').textContent = `${ms} ms · ${new Date(ms).toISOString()}`;
      if (!$('#ts').value.trim()) renderClocks(ms);
    }
  }
  $('#copyNow').addEventListener('click', () => window.Site && Site.copy(String(Math.floor(Date.now() / 1000)), 'Timestamp copied'));
  $('#useNow').addEventListener('click', () => { $('#ts').value = Math.floor(Date.now() / 1000); fromTs(); });

  // ---------- timestamp → date ----------
  function fromTs() {
    const raw = $('#ts').value.trim().replace(/[_\s,]/g, '');
    const out = $('#tsOut'), hint = $('#tsHint');
    $('#ts').classList.remove('is-bad');
    if (!raw) { out.innerHTML = ''; hint.textContent = 'Paste a Unix timestamp in seconds or milliseconds.'; renderClocks(Date.now()); return; }
    if (!/^-?\d+(\.\d+)?$/.test(raw)) { $('#ts').classList.add('is-bad'); out.innerHTML = ''; hint.innerHTML = '<span class="err-text">Only digits, please (an optional minus and decimals are fine).</span>'; return; }
    const n = parseFloat(raw);
    let isMs = unit === 'ms' || (unit === 'auto' && Math.abs(n) >= 1e11);
    const ms = isMs ? n : n * 1000;
    if (!isFinite(ms) || Math.abs(ms) > 8.64e15) { $('#ts').classList.add('is-bad'); hint.innerHTML = '<span class="err-text">That is outside the range JavaScript dates can show.</span>'; out.innerHTML = ''; return; }
    hint.textContent = unit === 'auto' ? `Read as ${isMs ? 'milliseconds' : 'seconds'} (switch above if that's wrong).` : '';
    const d = new Date(ms);
    out.innerHTML = [
      row('Your time zone', `${fmtIn(ms, LOCAL)} (${offStr(offsetOf(ms, LOCAL))})`),
      row('UTC', fmtIn(ms, 'UTC')),
      row('ISO 8601', d.toISOString()),
      row('RFC 2822', d.toUTCString()),
      row('Relative', rel(ms)),
      row('Seconds', String(Math.floor(ms / 1000))),
      row('Milliseconds', String(Math.round(ms))),
      row('Day of year', `${Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 0)) / 864e5)} · ISO week ${isoWeek(d)}`)
    ].join('');
    renderClocks(ms);
  }
  function isoWeek(d) {
    const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
    return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7);
  }
  $('#ts').addEventListener('input', fromTs);
  $('#unit').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    $('#unit').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); unit = b.dataset.u; fromTs();
  });

  // ---------- date → timestamp ----------
  const zoneOpts = (sel) => ZONES.map(z => `<option value="${z}"${z === sel ? ' selected' : ''}>${z.replace(/_/g, ' ')}</option>`).join('');
  $('#dtZone').innerHTML = zoneOpts(LOCAL);
  function wallToUtc(y, mo, d, h, mi, s, tz) {
    // find the UTC instant whose wall-clock time in tz equals the given fields (two passes handle DST)
    let guess = Date.UTC(y, mo, d, h, mi, s);
    for (let i = 0; i < 2; i++) guess = Date.UTC(y, mo, d, h, mi, s) - offsetOf(guess, tz) * 60000;
    return guess;
  }
  function showDt(ms) {
    $('#dtOut').innerHTML = [row('Seconds', String(Math.floor(ms / 1000))), row('Milliseconds', String(ms)), row('ISO 8601 (UTC)', new Date(ms).toISOString()), row('Relative', rel(ms))].join('');
  }
  function fromDt() {
    const v = $('#dt').value; if (!v) return;
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/); if (!m) return;
    const ms = wallToUtc(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0), $('#dtZone').value);
    $('#free').value = ''; showDt(ms);
  }
  function fromFree() {
    const v = $('#free').value.trim(); if (!v) return;
    let s = v.replace(/^(\d{4}-\d{2}-\d{2}) (\d)/, '$1T$2');
    let ms = Date.parse(s);
    // a date without zone info is read in the selected zone, not the browser's
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    if (m) ms = wallToUtc(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0), $('#dtZone').value);
    if (isNaN(ms)) { $('#free').classList.add('is-bad'); $('#dtOut').innerHTML = '<div><dt>Error</dt><dd class="err-text">Couldn\'t read that date.</dd><span></span></div>'; return; }
    $('#free').classList.remove('is-bad'); showDt(ms);
  }
  $('#dt').addEventListener('input', fromDt);
  $('#dtZone').addEventListener('change', () => { $('#free').value ? fromFree() : fromDt(); });
  $('#free').addEventListener('input', fromFree);
  { // default: now, rounded to the minute, in local time
    const d = new Date(); d.setSeconds(0, 0);
    const p = (n) => String(n).padStart(2, '0');
    $('#dt').value = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00`;
    fromDt();
  }

  // ---------- world clock ----------
  let zones;
  try { zones = JSON.parse(localStorage.getItem('ts-zones') || 'null'); } catch (e) {}
  if (!Array.isArray(zones) || !zones.length) zones = [...new Set([LOCAL, 'UTC', 'America/New_York', 'America/Los_Angeles', 'Asia/Tokyo', 'Australia/Sydney'])];
  const save = () => { try { localStorage.setItem('ts-zones', JSON.stringify(zones)); } catch (e) {} };
  $('#addZone').innerHTML = zoneOpts('Asia/Kolkata');
  function renderClocks(ms) {
    const localOff = offsetOf(ms, LOCAL);
    $('#clocks').innerHTML = zones.map((z, i) => {
      const off = offsetOf(ms, z), diff = off - localOff;
      const h = +new Intl.DateTimeFormat('en-GB', { timeZone: z, hour: '2-digit', hourCycle: 'h23' }).format(ms);
      const dstr = new Intl.DateTimeFormat('en-GB', { timeZone: z, weekday: 'short', day: '2-digit', month: 'short' }).format(ms);
      const rel = diff === 0 ? 'same as you' : `${diff > 0 ? '+' : '−'}${Math.floor(Math.abs(diff) / 60)}h${Math.abs(diff) % 60 ? Math.abs(diff) % 60 + 'm' : ''} from you`;
      return `<div class="clock${h < 6 || h >= 21 ? ' night' : ''}" style="animation-delay:${i * 30}ms;animation-name:${clocksDrawn ? 'none' : 'run-in'}">
        <span>${esc(z.split('/').pop().replace(/_/g, ' '))}${z === LOCAL ? ' · you' : ''}</span>
        <b>${new Intl.DateTimeFormat('en-GB', { timeZone: z, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(ms)}</b>
        <span>${dstr} · ${offStr(off)} · <span class="off">${rel}</span></span>
        ${zones.length > 1 ? `<button class="copy" type="button" data-rm="${i}" aria-label="Remove ${esc(z)}"><i class="fas fa-xmark"></i></button>` : ''}
      </div>`;
    }).join('');
    clocksDrawn = true;
  }
  let clocksDrawn = false;
  $('#addBtn').addEventListener('click', () => { const z = $('#addZone').value; if (!zones.includes(z)) { zones.push(z); save(); clocksDrawn = false; fromTs(); } });
  $('#clocks').addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (b) { zones.splice(+b.dataset.rm, 1); save(); fromTs(); } });
  document.addEventListener('click', e => { const c = e.target.closest('[data-copy-val]'); if (c && window.Site) Site.copy(c.dataset.copyVal, 'Copied'); });

  $('#ts').value = Math.floor(Date.now() / 1000);
  fromTs();
  setInterval(tickNow, 200); tickNow();
})();
