/* Encoder (Base64, Base64URL, URL, HTML, Hex, Binary) and JWT decoder */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const te = new TextEncoder(), td = new TextDecoder('utf-8', { fatal: true });

  // ---------- codecs ----------
  const bytesToB64 = (b) => { let s = ''; b.forEach(x => { s += String.fromCharCode(x); }); return btoa(s); };
  const b64ToBytes = (s) => {
    const clean = s.replace(/\s+/g, '');
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean) || clean.length % 4 === 1) throw new Error('Not valid Base64');
    const bin = atob(clean); return Uint8Array.from(bin, c => c.charCodeAt(0));
  };
  const toB64url = (b) => bytesToB64(b).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const fromB64url = (s) => {
    const t = s.replace(/\s+/g, '');
    if (!/^[A-Za-z0-9_-]*$/.test(t)) throw new Error('Not valid Base64URL');
    return b64ToBytes(t.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((t.length + 3) % 4));
  };
  const HTML_NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', copy: '©', reg: '®', euro: '€', auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü', szlig: 'ß' };
  const CODECS = {
    b64: { enc: s => bytesToB64(te.encode(s)), dec: s => td.decode(b64ToBytes(s)) },
    b64url: { enc: s => toB64url(te.encode(s)), dec: s => td.decode(fromB64url(s)) },
    url: { enc: s => encodeURIComponent(s), dec: s => decodeURIComponent(s.replace(/\+/g, ' ')) },
    html: {
      enc: s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])).replace(/[^\x00-\x7e]/gu, c => `&#${c.codePointAt(0)};`),
      dec: s => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
        if (e[0] === '#') { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return String.fromCodePoint(n); }
        return HTML_NAMED[e] !== undefined ? HTML_NAMED[e] : m;
      })
    },
    hex: {
      enc: s => Array.from(te.encode(s), b => b.toString(16).padStart(2, '0')).join(' '),
      dec: s => { const t = s.replace(/0x/gi, '').replace(/[\s:,-]/g, ''); if (!/^([0-9a-f]{2})*$/i.test(t)) throw new Error('Hex needs pairs of 0-9 / a-f'); return td.decode(Uint8Array.from(t.match(/../g) || [], h => parseInt(h, 16))); }
    },
    bin: {
      enc: s => Array.from(te.encode(s), b => b.toString(2).padStart(8, '0')).join(' '),
      dec: s => { const t = s.replace(/\s+/g, ''); if (!/^([01]{8})*$/.test(t)) throw new Error('Binary needs groups of 8 bits'); return td.decode(Uint8Array.from(t.match(/.{8}/g) || [], b => parseInt(b, 2))); }
    }
  };
  let codec = 'b64';
  const plain = $('#plain'), enc = $('#enc'), encState = $('#encState');
  function encode() {
    try { enc.value = CODECS[codec].enc(plain.value); enc.classList.remove('is-bad'); encState.innerHTML = `<span class="ok-text">${plain.value.length} characters → ${enc.value.length} characters</span>`; }
    catch (e) { encState.innerHTML = `<span class="err-text">${esc(e.message)}</span>`; }
  }
  function decode() {
    try { plain.value = CODECS[codec].dec(enc.value); enc.classList.remove('is-bad'); encState.innerHTML = `<span class="ok-text">Decoded ${enc.value.length} → ${plain.value.length} characters</span>`; }
    catch (e) { enc.classList.add('is-bad'); encState.innerHTML = `<span class="err-text">${esc(e.message === 'The encoded data was not valid for encoding utf-8' ? 'Decodes to bytes that are not valid UTF-8 text' : e.message)}</span>`; }
  }
  plain.addEventListener('input', encode);
  enc.addEventListener('input', decode);
  $('#codec').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    $('#codec').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
    codec = b.dataset.c; encode();
  });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-copy-from]'); if (!b) return;
    const v = $('#' + b.dataset.copyFrom).value; if (v && window.Site) Site.copy(v, 'Copied');
  });

  // ---------- tabs ----------
  $('#tabs').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    $('#tabs').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
    $('#tab-codec').hidden = b.dataset.tab !== 'codec';
    $('#tab-jwt').hidden = b.dataset.tab !== 'jwt';
    history.replaceState(null, '', b.dataset.tab === 'jwt' ? '#jwt' : location.pathname + location.search);
  });
  if (location.hash === '#jwt') $('#tabs [data-tab="jwt"]').click();

  // ---------- JWT ----------
  const jwtEl = $('#jwt');
  const pretty = (o) => esc(JSON.stringify(o, null, 2))
    .replace(/(&quot;[^&]*?&quot;)(\s*:)/g, '<span class="j-key">$1</span>$2');
  function rel(sec) {
    const d = sec * 1000 - Date.now(), a = Math.abs(d) / 1000;
    const u = a < 60 ? [a, 's'] : a < 3600 ? [a / 60, 'min'] : a < 86400 ? [a / 3600, 'h'] : [a / 86400, 'd'];
    const t = `${Math.round(u[0])} ${u[1]}`;
    return d >= 0 ? `in ${t}` : `${t} ago`;
  }
  function claim(label, value, extra = '') {
    return `<div><dt>${label}</dt><dd>${esc(value)}${extra}</dd><span></span></div>`;
  }
  function decodeJwt() {
    const t = jwtEl.value.trim().replace(/^Bearer\s+/i, '');
    const st = $('#jwtState');
    $('#jwtHead').textContent = ''; $('#jwtBody').textContent = ''; $('#claims').innerHTML = ''; $('#jwtParts').innerHTML = '';
    if (!t) { st.className = 'status'; st.textContent = 'Paste a token'; return; }
    const parts = t.split('.');
    $('#jwtParts').innerHTML = parts.map((p, i) => `<span class="${['jp-h', 'jp-p', 'jp-s'][i] || 'jp-s'}">${esc(p)}</span>`).join('<span class="jp-dot">.</span>');
    if (parts.length !== 3) { st.className = 'status err'; st.innerHTML = `<i class="fas fa-triangle-exclamation"></i>A JWT has 3 parts separated by dots; this has ${parts.length}`; return; }
    let head, body;
    try { head = JSON.parse(td.decode(fromB64url(parts[0]))); } catch (e) { st.className = 'status err'; st.innerHTML = '<i class="fas fa-triangle-exclamation"></i>Header is not valid Base64URL JSON'; return; }
    try { body = JSON.parse(td.decode(fromB64url(parts[1]))); } catch (e) { st.className = 'status err'; st.innerHTML = '<i class="fas fa-triangle-exclamation"></i>Payload is not valid Base64URL JSON'; return; }
    $('#jwtHead').innerHTML = pretty(head);
    $('#jwtBody').innerHTML = pretty(body);
    const now = Date.now() / 1000;
    let ok = true, msg = `Decoded · ${esc(head.alg || 'no alg')}`;
    if (typeof body.exp === 'number' && body.exp < now) { ok = false; msg = `Expired ${rel(body.exp)}`; }
    if (typeof body.nbf === 'number' && body.nbf > now) { ok = false; msg = `Not valid yet (starts ${rel(body.nbf)})`; }
    if (head.alg === 'none') { ok = false; msg = 'alg is "none": this token is unsigned'; }
    st.className = 'status ' + (ok ? 'ok' : 'warn');
    st.innerHTML = `<i class="fas fa-${ok ? 'circle-check' : 'triangle-exclamation'}"></i>${msg}`;
    const dt = (s) => new Date(s * 1000).toLocaleString();
    const rows = [];
    rows.push(claim('Algorithm (alg)', head.alg || '—'));
    if (head.typ) rows.push(claim('Type (typ)', head.typ));
    if (head.kid) rows.push(claim('Key ID (kid)', head.kid));
    if (body.iss) rows.push(claim('Issuer (iss)', body.iss));
    if (body.sub) rows.push(claim('Subject (sub)', body.sub));
    if (body.aud) rows.push(claim('Audience (aud)', Array.isArray(body.aud) ? body.aud.join(', ') : body.aud));
    if (typeof body.iat === 'number') rows.push(claim('Issued (iat)', dt(body.iat), ` <span class="muted">· ${rel(body.iat)}</span>`));
    if (typeof body.nbf === 'number') rows.push(claim('Not before (nbf)', dt(body.nbf), ` <span class="muted">· ${rel(body.nbf)}</span>`));
    if (typeof body.exp === 'number') rows.push(claim('Expires (exp)', dt(body.exp), ` <span class="${body.exp < now ? 'err-text' : 'ok-text'}">· ${body.exp < now ? 'expired ' : 'expires '}${rel(body.exp)}</span>`));
    rows.push(claim('Signature', parts[2] ? `${parts[2].length} chars (not verified)` : 'none'));
    $('#claims').innerHTML = rows.join('');
  }
  jwtEl.addEventListener('input', decodeJwt);
  $('#jwtSample').addEventListener('click', () => {
    const now = Math.floor(Date.now() / 1000);
    const h = toB64url(te.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
    const p = toB64url(te.encode(JSON.stringify({ iss: 'https://lukas200301.github.io', sub: 'guest', name: 'Demo User', roles: ['viewer'], iat: now - 600, exp: now + 3 * 3600 })));
    jwtEl.value = `${h}.${p}.${toB64url(te.encode('demo-signature-not-real'))}`;
    decodeJwt();
  });
  encode();
})();
