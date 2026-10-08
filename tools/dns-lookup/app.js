/* DNS lookup over HTTPS (Cloudflare / Google JSON APIs): records, reverse lookups, email checks and a resolver comparison */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const TYPES = { A: 1, NS: 2, CNAME: 5, SOA: 6, PTR: 12, MX: 15, TXT: 16, AAAA: 28, SRV: 33, DS: 43, DNSKEY: 48, HTTPS: 65, CAA: 257 };
  const NAME = Object.fromEntries(Object.entries(TYPES).map(([k, v]) => [v, k]));
  const ALL = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SOA', 'CAA'];
  const TABS = ['ALL', 'A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SOA', 'CAA', 'SRV', 'PTR'];
  const RES = {
    cloudflare: { name: 'Cloudflare', url: (n, t) => `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(n)}&type=${t}`, headers: { accept: 'application/dns-json' } },
    google: { name: 'Google', url: (n, t) => `https://dns.google/resolve?name=${encodeURIComponent(n)}&type=${t}`, headers: {} }
  };
  const RCODE = { 0: 'NOERROR', 1: 'FORMERR', 2: 'SERVFAIL', 3: 'NXDOMAIN', 4: 'NOTIMP', 5: 'REFUSED' };
  const KEY = 'dns-recent';

  // ---------- input ----------
  const isV4 = (s) => /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.test(s) && s.split('.').every(x => +x <= 255);
  function expand6(ip) {
    const halves = ip.split('::');
    if (halves.length > 2 || !/^[0-9a-f:]+$/i.test(ip)) return null;
    const h = halves[0] ? halves[0].split(':') : [], t = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
    const fill = halves.length === 2 ? 8 - h.length - t.length : 0;
    if (fill < 0 || (halves.length === 2 && fill < 1)) return null;
    const g = h.concat(Array(fill).fill('0'), t);
    return g.length === 8 && g.every(x => /^[0-9a-f]{1,4}$/i.test(x)) ? g.map(x => x.padStart(4, '0')).join('').toLowerCase() : null;
  }
  function arpa(s) {
    if (isV4(s)) return s.split('.').reverse().join('.') + '.in-addr.arpa';
    const h = s.includes(':') && expand6(s);
    return h ? h.split('').reverse().join('.') + '.ip6.arpa' : null;
  }
  function normalize(raw) {
    let s = raw.trim();
    if (!s) return { err: 'Type a domain name or an IP address' };
    if (/^[^\s/@]+@[^\s/@]+$/.test(s)) s = s.split('@').pop();           // an email address → its domain
    s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').split(/[/?#]/)[0];      // a URL → its host
    if (/^\[.+\](:\d+)?$/.test(s)) s = s.replace(/^\[|\](:\d+)?$/g, '');   // [IPv6]:port
    else if (!s.includes('::') && (s.match(/:/g) || []).length === 1) s = s.replace(/:\d+$/, '');
    s = s.replace(/\.$/, '');
    if (isV4(s) || (s.includes(':') && expand6(s))) return { ip: s.toLowerCase() };
    if (/[^\x00-\x7f]/.test(s)) { try { s = new URL('http://' + s).hostname; } catch (e) { return { err: 'Not a valid domain name' }; } }   // IDN → punycode
    s = s.toLowerCase();
    if (!/^(?=.{1,253}$)(?:[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?\.)*[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?$/.test(s)) return { err: 'Not a valid domain name' };
    return { name: s };
  }

  // ---------- queries ----------
  async function query(r, name, type) {
    const t0 = performance.now();
    try {
      const res = await fetch(RES[r].url(name, type), { headers: RES[r].headers, cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const j = await res.json();
      return { r, type, j, ms: performance.now() - t0 };
    } catch (e) {
      return { r, type, error: e.message || 'failed', ms: performance.now() - t0 };
    }
  }
  const strip = (n) => String(n).replace(/\.$/, '');
  // TXT: Cloudflare quotes every string ("a" "b"), Google doesn't; long records come split in 255-byte pieces
  function txt(d) {
    if (!/^"/.test(d)) return d;
    const parts = d.match(/"((?:[^"\\]|\\.)*)"/g);
    return parts ? parts.map(p => p.slice(1, -1).replace(/\\(.)/g, '$1')).join('') : d;
  }
  const clean = (type, d) => type === 'TXT' ? txt(d) : type === 'CAA' || type === 'HTTPS' ? d : strip(d);
  function records(results) {
    const seen = new Set(), out = [];
    results.forEach(x => (x.j && x.j.Answer || []).forEach(a => {
      const type = NAME[a.type] || 'TYPE' + a.type, data = clean(type, a.data), k = type + '|' + strip(a.name) + '|' + data;
      if (seen.has(k)) return;
      seen.add(k); out.push({ type, name: strip(a.name), ttl: a.TTL, data });
    }));
    const order = (t) => { const i = TABS.indexOf(t); return i < 0 ? 99 : i; };
    return out.sort((a, b) => order(a.type) - order(b.type) || (a.type === 'MX' ? parseInt(a.data) - parseInt(b.data) : 0));
  }

  // ---------- rendering ----------
  function ttl(s) {
    if (s < 60) return s + 's';
    if (s < 3600) return Math.round(s / 60) + 'm';
    if (s < 86400) return +(s / 3600).toFixed(1) + 'h';
    return +(s / 86400).toFixed(1) + 'd';
  }
  const host = (h) => h && h !== '.' ? `<a class="h" data-q="${esc(h)}">${esc(h)}</a>` : esc(h || '.');
  const ipLink = (ip) => `<a class="h" data-q="${esc(ip)}" title="Reverse lookup">${esc(ip)}</a>`;
  function value(r) {
    const d = r.data, p = d.split(/\s+/);
    switch (r.type) {
      case 'A': case 'AAAA': return ipLink(d);
      case 'CNAME': case 'NS': case 'PTR': return host(strip(d));
      case 'MX': return `<span class="muted">${esc(p[0])}</span> ${host(strip(p[1] || '.'))}`;
      case 'SRV': return `<span class="muted">prio ${esc(p[0])} · weight ${esc(p[1])} · port</span> ${esc(p[2])} ${host(strip(p[3] || ''))}`;
      case 'SOA': {
        const mail = strip(p[1] || '').replace(/^([^.]*?)(?<!\\)\./, '$1@').replace(/\\\./g, '.');
        return `<span class="soa"><span>primary</span><span>${host(strip(p[0]))}</span><span>admin</span><span>${esc(mail)}</span><span>serial</span><span>${esc(p[2])}</span><span>refresh · retry</span><span>${ttl(+p[3])} · ${ttl(+p[4])}</span><span>expire · min TTL</span><span>${ttl(+p[5])} · ${ttl(+p[6])}</span></span>`;
      }
      default: return esc(d);
    }
  }
  function stat(label, val, cls = '') { return `<div class="stat pop"><b class="${cls}">${val}</b><span>${label}</span></div>`; }

  // ---------- email checks ----------
  function ck(cls, icon, title, text, code) { return `<div class="ck ${cls}"><i class="fas ${icon}"></i><div><b>${title}</b><span>${text}</span>${code ? `<code>${esc(code)}</code>` : ''}</div></div>`; }
  function mailChecks(recs, dmarcRes, name) {
    const out = [], mx = recs.filter(r => r.type === 'MX' && r.name === name);
    if (mx.length === 1 && /^0\s+\.?$/.test(mx[0].data.trim())) out.push(ck('warn', 'fa-ban', 'Null MX', 'The domain says it never accepts email (RFC 7505).'));
    else if (mx.length) out.push(ck('ok', 'fa-circle-check', `${mx.length} mail server${mx.length > 1 ? 's' : ''} (MX)`, 'Receives mail via ' + mx.map(r => esc(strip(r.data.split(/\s+/)[1] || ''))).join(', ') + '.'));
    else out.push(ck('warn', 'fa-triangle-exclamation', 'No MX records', 'Mail would fall back to the A record. Most domains without MX don\'t receive email.'));
    const spf = recs.filter(r => r.type === 'TXT' && r.name === name && /^v=spf1\b/i.test(r.data));
    if (spf.length > 1) out.push(ck('bad', 'fa-circle-xmark', 'More than one SPF record', 'That\'s invalid: receivers treat SPF as broken (permerror). Merge them into one.', spf.map(r => r.data).join('\n')));
    else if (spf.length) {
      const all = (spf[0].data.match(/([-~?+])?all\b/i) || [])[1];
      const pol = { '-': ['ok', 'Hard fail (-all): mail from other servers is rejected.'], '~': ['ok', 'Soft fail (~all): mail from other servers is marked as suspicious.'], '?': ['warn', 'Neutral (?all): doesn\'t protect against spoofing.'], '+': ['bad', 'Pass all (+all): anyone may send as this domain!'] }[all || '+'] || ['warn', 'No "all" rule at the end.'];
      out.push(ck(pol[0], pol[0] === 'ok' ? 'fa-circle-check' : pol[0] === 'bad' ? 'fa-circle-xmark' : 'fa-triangle-exclamation', 'SPF', all ? pol[1] : 'No "all" rule at the end, so the policy is neutral.', spf[0].data));
    } else out.push(ck('warn', 'fa-triangle-exclamation', 'No SPF record', 'Without SPF it\'s easier to send mail that pretends to come from this domain.'));
    const dm = dmarcRes && dmarcRes.j ? (dmarcRes.j.Answer || []).filter(a => a.type === 16).map(a => txt(a.data)).find(d => /^v=DMARC1/i.test(d)) : null;
    if (dmarcRes && dmarcRes.error) out.push(ck('warn', 'fa-triangle-exclamation', 'DMARC', 'Couldn\'t check _dmarc.' + esc(name) + '.'));
    else if (dm) {
      const p = ((dm.match(/;\s*p=(\w+)/i) || [])[1] || '').toLowerCase();
      const m = { reject: ['ok', 'Policy reject: failing mail is refused.'], quarantine: ['ok', 'Policy quarantine: failing mail goes to spam.'], none: ['warn', 'Policy none: only reports, nothing is blocked.'] }[p] || ['warn', 'Policy missing or unknown.'];
      out.push(ck(m[0], m[0] === 'ok' ? 'fa-circle-check' : 'fa-triangle-exclamation', 'DMARC', m[1], dm));
    } else out.push(ck('warn', 'fa-triangle-exclamation', 'No DMARC record', `Nothing at _dmarc.${esc(name)}. Receivers get no policy for mail that fails SPF/DKIM.`));
    return out.join('');
  }

  // ---------- resolver comparison ----------
  function compare(a, b, types) {
    const set = (rs, t) => rs.filter(x => x.type === t).map(x => x.data.toLowerCase()).sort();
    return types.map(t => {
      const x = set(a, t), y = set(b, t);
      if (!x.length && !y.length) return ck('', 'fa-minus', t, 'No records from either.');
      const onlyA = x.filter(v => !y.includes(v)), onlyB = y.filter(v => !x.includes(v));
      if (!onlyA.length && !onlyB.length) return ck('ok', 'fa-circle-check', t, `Same answer (${x.length} record${x.length > 1 ? 's' : ''}).`);
      return ck('warn', 'fa-triangle-exclamation', t, `Different answers: Cloudflare ${x.length}, Google ${y.length}.`, [...onlyA.map(v => 'only Cloudflare: ' + v), ...onlyB.map(v => 'only Google: ' + v)].join('\n'));
    }).join('');
  }

  // ---------- run ----------
  let type = 'ALL', resolver = 'cloudflare', job = 0;
  try { const s = JSON.parse(localStorage.getItem('dns-opts') || '{}'); if (RES[s.r] || s.r === 'both') resolver = s.r; } catch (e) {}
  $('#types').innerHTML = TABS.map(t => `<button type="button" data-t="${t}" aria-pressed="${t === type}">${t === 'ALL' ? 'All' : t}</button>`).join('');
  const press = (sel, attr, v) => $(sel).querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset[attr] === v)));

  async function lookup(push = true) {
    const n = normalize($('#q').value), my = ++job;
    $('#q').classList.toggle('is-bad', !!n.err);
    if (n.err) { $('#stats').innerHTML = stat('Error', esc(n.err), 'err'); $('#recs').innerHTML = ''; $('#mailPanel').hidden = $('#cmpPanel').hidden = true; return; }
    const name = n.ip ? arpa(n.ip) : n.name;
    const types = n.ip ? ['PTR'] : type === 'ALL' ? ALL : [type];
    if (n.ip && type !== 'PTR' && type !== 'ALL') { type = 'PTR'; press('#types', 't', 'PTR'); }
    const which = resolver === 'both' ? ['cloudflare', 'google'] : [resolver];
    const shown = n.ip || n.name;
    if (push) remember(shown);
    syncUrl(shown);
    $('#go').disabled = true; $('#go').innerHTML = '<i class="fas fa-spinner fa-spin"></i>&nbsp; Looking up';
    $('#recInfo').textContent = `${types.join(', ')} for ${name}…`;
    const t0 = performance.now();
    const wantMail = !n.ip && type === 'ALL';
    const [sets, dmarc] = await Promise.all([
      Promise.all(which.map(r => Promise.all(types.map(t => query(r, name, t))))),
      wantMail ? query(which[0], '_dmarc.' + name, 'TXT') : null
    ]);
    if (my !== job) return;   // a newer lookup started
    const ms = performance.now() - t0;
    $('#go').disabled = false; $('#go').innerHTML = '<i class="fas fa-magnifying-glass"></i>&nbsp; Look up';
    const main = sets[0], recs = records(main);
    const errs = main.filter(x => x.error);
    const status = main.map(x => x.j && x.j.Status).find(s => s && s !== 0) || (main.some(x => x.j) ? 0 : null);
    const ad = main.some(x => x.j && x.j.AD);

    $('#stats').innerHTML = [
      errs.length === main.length ? stat('Status', 'Unreachable', 'err') : stat('Status', RCODE[status] || 'RCODE ' + status, status === 0 ? 'ok' : 'err'),
      stat('Records', recs.length),
      stat('Time', Math.round(ms) + ' ms'),
      stat('DNSSEC', ad ? 'Validated' : 'Not signed', ad ? 'ok' : 'warn'),
      stat('Resolver', which.map(r => RES[r].name).join(' + '))
    ].join('');

    // records, plus a muted row (in type order) for each asked type that came back empty
    const empty = types.filter(t => !recs.some(r => r.type === t)).map(t => {
      const x = main.find(m => m.type === t);
      const why = x.error ? `couldn't reach ${RES[x.r].name} (offline, or blocked by an ad blocker?)` : x.j.Status === 3 ? (n.ip ? 'this IP has no reverse DNS entry (NXDOMAIN)' : "the name doesn't exist (NXDOMAIN)") : x.j.Status ? RCODE[x.j.Status] || 'error' : 'no records';
      return { type: t, none: why };
    });
    const order = (t) => { const k = TABS.indexOf(t); return k < 0 ? 99 : k; };
    $('#recs').innerHTML = recs.concat(empty).sort((a, b) => order(a.type) - order(b.type)).map((r, i) => r.none
      ? `<tr class="none fresh" style="--i:${i}"><td><span class="rt t-${r.type}">${r.type}</span></td><td>${esc(name)}</td><td></td><td>${esc(r.none)}</td><td></td></tr>`
      : `<tr class="fresh" style="--i:${i}"><td><span class="rt t-${esc(r.type)}">${esc(r.type)}</span></td><td>${esc(r.name)}</td><td title="${r.ttl} seconds">${ttl(r.ttl)}</td><td>${value(r)}</td><td><button class="copy" type="button" data-copy-val="${esc(r.data)}" aria-label="Copy value"><i class="far fa-copy"></i></button></td></tr>`).join('');
    $('#recInfo').textContent = `${name} · ${types.length === 1 ? types[0] : types.length + ' record types'}`;

    // email checks for domains that look like they handle mail (skip hosts like www.example.com)
    const mailish = wantMail && status !== 3 && (name.split('.').length <= 2 || recs.some(r => r.name === name && (r.type === 'MX' || (r.type === 'TXT' && /^v=spf1/i.test(r.data)))) || (dmarc && dmarc.j && dmarc.j.Answer));
    $('#mailPanel').hidden = !mailish;
    if (mailish) { $('#mail').innerHTML = mailChecks(recs, dmarc, name); $('#dkimDom').textContent = name; }
    $('#cmpPanel').hidden = which.length < 2;
    if (which.length > 1) $('#cmp').innerHTML = compare(recs, records(sets[1]), types);
  }

  // ---------- recent lookups + URL ----------
  function recent() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } }
  function remember(q) {
    const list = [q].concat(recent().filter(x => x !== q)).slice(0, 8);
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {}
    drawRecent();
  }
  function drawRecent() {
    const list = recent();
    $('#recent').innerHTML = list.length ? `<span class="hint">Recent:</span>` + list.map(q => `<span class="chip" data-q="${esc(q)}">${esc(q)}</span>`).join('') : '';
  }
  function syncUrl(q) {
    const u = new URL(location.href);
    u.searchParams.set('q', q);
    if (type !== 'ALL') u.searchParams.set('type', type); else u.searchParams.delete('type');
    if (resolver !== 'cloudflare') u.searchParams.set('r', resolver); else u.searchParams.delete('r');
    history.replaceState(history.state, '', u.pathname + u.search + u.hash);
  }

  // ---------- events ----------
  $('#form').addEventListener('submit', e => { e.preventDefault(); lookup(); });
  $('#types').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (!b) return; type = b.dataset.t; press('#types', 't', type); if ($('#q').value.trim()) lookup(); });
  $('#resolvers').addEventListener('click', e => {
    const b = e.target.closest('[data-r]'); if (!b) return;
    resolver = b.dataset.r; press('#resolvers', 'r', resolver);
    try { localStorage.setItem('dns-opts', JSON.stringify({ r: resolver })); } catch (er) {}
    if ($('#q').value.trim()) lookup();
  });
  document.addEventListener('click', e => {
    const q = e.target.closest('[data-q]');
    if (q) {
      e.preventDefault();
      $('#q').value = q.dataset.q;
      if (type === 'PTR' && !arpa(q.dataset.q)) { type = 'ALL'; press('#types', 't', type); }
      lookup();
      window.scrollTo({ top: $('#q').getBoundingClientRect().top + scrollY - 120, behavior: 'smooth' });
      return;
    }
    const c = e.target.closest('[data-copy-val]'); if (c && window.Site) Site.copy(c.dataset.copyVal, 'Copied');
  });

  const p = new URL(location.href).searchParams;
  if (p.get('q')) $('#q').value = p.get('q');
  if (TABS.includes((p.get('type') || '').toUpperCase())) type = p.get('type').toUpperCase();
  if (RES[p.get('r')] || p.get('r') === 'both') resolver = p.get('r');
  press('#types', 't', type); press('#resolvers', 'r', resolver);
  drawRecent();
  lookup(false);
})();
