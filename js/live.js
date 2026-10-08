/* Live "now playing" widget, shown on every page (loaded by js/script.js).
   Source: Lanyard (Discord presence). Spotify first, then coding (VS Code etc.), then games.
   Live via Lanyard's WebSocket; falls back to polling the REST API every 30 s. */
(function () {
  'use strict';
  if (window.Live) return;
  const ID = '364118506460938250';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const subs = [];
  const Live = window.Live = { data: null, current: null, on(fn) { subs.push(fn); if (Live.data) fn(Live.current, Live.data); }, describe };

  // ---------- what is Lukas doing? ----------
  const CODE_APPS = /visual studio|vs ?code|^code$|intellij|pycharm|webstorm|rider|android studio|neovim|vim|sublime|jetbrains|zed|cursor/i;
  function pick(d) {
    if (!d) return null;
    if (d.listening_to_spotify && d.spotify) {
      const s = d.spotify;
      return { kind: 'spotify', title: s.song, sub: s.artist, extra: s.album, art: s.album_art_url, start: s.timestamps && s.timestamps.start, end: s.timestamps && s.timestamps.end, link: s.track_id ? `https://open.spotify.com/track/${s.track_id}` : null };
    }
    const acts = (d.activities || []).filter(a => a.type !== 4 && a.name !== 'Spotify');
    const a = acts.find(x => CODE_APPS.test(x.name)) || acts.find(x => x.type === 0) || acts[0];
    if (!a) return null;
    const li = a.assets && a.assets.large_image;
    const art = li ? (li.startsWith('mp:') ? `https://media.discordapp.net/${li.slice(3)}` : a.application_id ? `https://cdn.discordapp.com/app-assets/${a.application_id}/${li}.png` : null) : null;
    const coding = CODE_APPS.test(a.name);
    const verb = coding ? 'Coding in' : (['Playing', 'Streaming', 'Listening to', 'Watching', '', 'Competing in'][a.type] || 'Using');
    return { kind: coding ? 'code' : 'activity', verb, title: a.name, sub: a.details || '', extra: a.state || '', art, start: a.timestamps && a.timestamps.start };
  }
  const mmss = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const since = (t) => { const m = Math.max(0, Math.round((Date.now() - t) / 60000)); return m < 1 ? 'just started' : m < 60 ? `for ${m} min` : `for ${Math.floor(m / 60)} h ${m % 60} min`; };
  function describe() {   // plain text for the command line
    const c = Live.current, d = Live.data;
    if (!d) return null;
    if (!c) return d.discord_status === 'offline' ? 'Offline right now.' : 'Online, but nothing playing right now.';
    if (c.kind === 'spotify') return `♪ ${c.title} — ${c.sub}${c.end ? `  [${mmss(Date.now() - c.start)} / ${mmss(c.end - c.start)}]` : ''}`;
    return `${c.verb} ${c.title}${c.sub ? ': ' + c.sub : ''}${c.extra ? ' (' + c.extra + ')' : ''}${c.start ? ', ' + since(c.start) : ''}`;
  }
  function update(d) {
    Live.data = d; Live.current = pick(d);
    subs.forEach(fn => { try { fn(Live.current, d); } catch (e) {} });
  }

  // ---------- data: WebSocket with REST fallback ----------
  let polling = null;
  async function poll() {
    if (document.hidden) return;
    try { const r = await fetch(`https://api.lanyard.rest/v1/users/${ID}`); if (r.ok) { const j = await r.json(); if (j && j.data) update(j.data); } } catch (e) {}
  }
  function startPolling() { if (polling) return; poll(); polling = setInterval(poll, 30000); }
  function connect(tries = 0) {
    if (!('WebSocket' in window)) return startPolling();
    let ws, beat, opened = false;
    try { ws = new WebSocket('wss://api.lanyard.rest/socket'); } catch (e) { return startPolling(); }
    const fail = setTimeout(() => { if (!opened) { try { ws.close(); } catch (e) {} startPolling(); } }, 6000);
    ws.onmessage = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.op === 1) {
        opened = true; clearTimeout(fail);
        ws.send(JSON.stringify({ op: 2, d: { subscribe_to_id: ID } }));
        beat = setInterval(() => { try { ws.send(JSON.stringify({ op: 3 })); } catch (e) {} }, m.d.heartbeat_interval || 30000);
      } else if (m.op === 0 && (m.t === 'INIT_STATE' || m.t === 'PRESENCE_UPDATE')) {
        if (polling) { clearInterval(polling); polling = null; }
        update(m.d);
      }
    };
    ws.onclose = () => {
      clearInterval(beat); clearTimeout(fail);
      if (!opened) return startPolling();
      if (tries < 5) setTimeout(() => connect(tries + 1), 2000 * (tries + 1)); else startPolling();
    };
    ws.onerror = () => {};
  }

  // ---------- widget ----------
  const Site = window.Site || {};
  const offKey = 'np-off';
  const isOff = () => { try { return sessionStorage.getItem(offKey) === '1'; } catch (e) { return false; } };
  const el = document.createElement('div');
  el.className = 'np';
  el.hidden = true;
  el.innerHTML = `
    <div class="np__card" id="npCard" role="dialog" aria-label="Now playing" hidden></div>
    <button class="np__pill" type="button" aria-expanded="false" aria-controls="npCard"></button>
    <button class="np__x" type="button" aria-label="Hide now playing"><i class="fas fa-xmark"></i></button>`;
  const pill = el.querySelector('.np__pill'), card = el.querySelector('.np__card');
  let tick = null, homeCardVisible = false, lastKey = '';

  function artHTML(c, cls) {
    if (c.art) return `<img class="${cls}" src="${esc(c.art)}" alt="" referrerpolicy="no-referrer">`;
    const ic = c.kind === 'spotify' ? 'fab fa-spotify' : c.kind === 'code' ? 'fas fa-code' : 'fas fa-gamepad';
    return `<span class="${cls} np__ic"><i class="${ic}"></i></span>`;
  }
  function render(c) {
    const show = !!c && !isOff() && !Site.isGamePlay && !homeCardVisible;
    if (!show) { el.classList.remove('in'); clearInterval(tick); setTimeout(() => { if (!el.classList.contains('in')) el.hidden = true; }, 350); if (!c) close(); return; }
    const key = c.kind + c.title + c.sub;
    const changed = key !== lastKey; lastKey = key;
    const label = c.kind === 'spotify' ? 'Listening on Spotify' : c.kind === 'code' ? `Coding in ${c.title}` : `${c.verb} ${c.title}`;
    const line = c.kind === 'spotify' ? `${c.title} · ${c.sub}` : (c.sub || c.title);
    pill.className = `np__pill np--${c.kind}`;
    pill.innerHTML = `${artHTML(c, 'np__art')}${c.kind === 'spotify' ? '<span class="np__eq" aria-hidden="true"><i></i><i></i><i></i></span>' : '<span class="np__live" aria-hidden="true"></span>'}<span class="np__txt"><small>${esc(label)}</small><b>${esc(line)}</b></span>`;
    pill.setAttribute('aria-label', `${label}: ${line}. Show details`);
    pill.title = line;
    card.innerHTML = `
      <div class="np__head"><span class="np__dot"></span>${c.kind === 'spotify' ? 'Lukas is listening to' : c.kind === 'code' ? 'Lukas is coding' : 'Lukas is ' + esc(c.verb.toLowerCase())}</div>
      <div class="np__main">${artHTML(c, 'np__big')}<div class="np__meta"><b>${esc(c.kind === 'spotify' ? c.title : c.sub || c.title)}</b><span>${esc(c.kind === 'spotify' ? c.sub : c.kind === 'code' ? c.title : c.title)}</span>${c.extra ? `<span class="np__muted">${esc(c.extra)}</span>` : ''}</div></div>
      ${c.kind === 'spotify' && c.end ? '<div class="np__bar"><i></i></div><div class="np__times"><span class="np__el">0:00</span><span>' + mmss(c.end - c.start) + '</span></div>' : c.start ? '<div class="np__times"><span class="np__since"></span></div>' : ''}
      ${c.link ? `<a class="np__link" href="${esc(c.link)}" target="_blank" rel="noopener"><i class="fab fa-spotify"></i>Open in Spotify</a>` : ''}`;
    // album art / app icon that fails to load falls back to an icon
    el.querySelectorAll('img.np__art, img.np__big').forEach(img => img.addEventListener('error', () => {
      const ic = c.kind === 'spotify' ? 'fab fa-spotify' : c.kind === 'code' ? 'fas fa-code' : 'fas fa-gamepad';
      const sp = document.createElement('span'); sp.className = img.className + ' np__ic'; sp.innerHTML = `<i class="${ic}"></i>`; img.replaceWith(sp);
    }, { once: true }));
    if (changed) { pill.classList.remove('swap'); void pill.offsetWidth; pill.classList.add('swap'); }
    el.hidden = false; requestAnimationFrame(() => el.classList.add('in'));
    clearInterval(tick);
    const upd = () => {
      if (c.kind === 'spotify' && c.end) {
        const p = Math.max(0, Math.min(1, (Date.now() - c.start) / (c.end - c.start)));
        const bar = card.querySelector('.np__bar i'); if (bar) bar.style.width = (p * 100) + '%';
        const e = card.querySelector('.np__el'); if (e) e.textContent = mmss(Math.min(Date.now() - c.start, c.end - c.start));
        pill.style.setProperty('--p', p);
      } else if (c.start) { const s = card.querySelector('.np__since'); if (s) s.textContent = since(c.start); }
    };
    upd(); tick = setInterval(upd, 1000);
  }
  function open() { card.hidden = false; requestAnimationFrame(() => card.classList.add('open')); pill.setAttribute('aria-expanded', 'true'); }
  function close() { card.classList.remove('open'); pill.setAttribute('aria-expanded', 'false'); setTimeout(() => { if (!card.classList.contains('open')) card.hidden = true; }, 250); }
  pill.addEventListener('click', () => card.classList.contains('open') ? close() : open());
  el.querySelector('.np__x').addEventListener('click', () => { try { sessionStorage.setItem(offKey, '1'); } catch (e) {} close(); render(Live.current); window.Site && Site.toast && Site.toast('Now playing hidden. Type "np on" in the command line to bring it back', 'fas fa-music'); });
  document.addEventListener('click', e => { if (card.classList.contains('open') && !el.contains(e.target)) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && card.classList.contains('open')) close(); });
  Live.setHidden = (v) => { try { v ? sessionStorage.setItem(offKey, '1') : sessionStorage.removeItem(offKey); } catch (e) {} render(Live.current); };

  function mount() {
    document.body.appendChild(el);
    // on the home page the hero already shows the presence card: only show the pill once it's scrolled away
    const home = document.getElementById('presence');
    if (home && 'IntersectionObserver' in window) {
      homeCardVisible = true;
      new IntersectionObserver(([en]) => { homeCardVisible = en.isIntersecting; render(Live.current); }).observe(home);
    }
    Live.on(render);
    connect();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
