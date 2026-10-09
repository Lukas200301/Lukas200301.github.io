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

  // ---------- check cards ----------
  const PILL = { ok: ['fa-check', 'Pass'], warn: ['fa-exclamation', 'Warning'], bad: ['fa-xmark', 'Fail'], '': ['fa-minus', 'None'] };
  // head, text and body are HTML (callers escape); raw is plain text
  function card({ cls = '', icon, key, pill, head, text = '', body = '', raw = '', foot = '' }, i = 0) {
    const pl = PILL[cls];
    return `<article class="mc ${cls}" style="--i:${i}"><header><span class="mc__k"><i class="fas ${icon}"></i>${key}</span><span class="pill ${cls}"><i class="fas ${pl[0]}"></i>${pill || pl[1]}</span></header>`
      + `<b class="mc__h">${head}</b>${text ? `<p class="mc__p">${text}</p>` : ''}${body}`
      + (raw ? `<details class="mc__raw"><summary><i class="fas fa-chevron-right"></i>Raw record</summary><code>${esc(raw)}</code></details>` : '')
      + foot + '</article>';
  }
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const listing = (a) => a.length > 1 ? a.slice(0, -1).join(', ') + ' or ' + a[a.length - 1] : a.join('');

  // ---------- email checks ----------
  const PROVIDERS = [
    [/\.protection\.outlook\.com$/, 'Microsoft 365'], [/(^|\.)(google|googlemail)\.com$/, 'Google Workspace'], [/\.pphosted\.com$/, 'Proofpoint'],
    [/\.mimecast\.com$/, 'Mimecast'], [/\.zoho\.(com|eu|in)$/, 'Zoho Mail'], [/\.protonmail\.ch$/, 'Proton Mail'], [/\.icloud\.com$/, 'iCloud Mail'],
    [/\.messagingengine\.com$/, 'Fastmail'], [/\.mx\.cloudflare\.net$/, 'Cloudflare Email Routing'], [/\.secureserver\.net$/, 'GoDaddy'],
    [/\.improvmx\.com$/, 'ImprovMX'], [/\.ovh\.net$/, 'OVHcloud'], [/\.(ionos\.\w+|kundenserver\.de)$/, 'IONOS'], [/\.yandex\.(net|ru)$/, 'Yandex Mail'],
    [/\.amazonaws\.com$/, 'Amazon SES'], [/\.mailgun\.org$/, 'Mailgun'], [/\.mail\.ru$/, 'Mail.ru'], [/\.qq\.com$/, 'Tencent'], [/\.barracudanetworks\.com$/, 'Barracuda']
  ];
  const provider = (hosts) => { for (const h of hosts) for (const [re, n] of PROVIDERS) if (re.test(h)) return n; return null; };

  function mxCard(recs, name) {
    const mx = recs.filter(r => r.type === 'MX' && r.name === name).map(r => { const p = r.data.trim().split(/\s+/); return { pref: +p[0], host: strip(p[1] || '.') }; }).sort((a, b) => a.pref - b.pref);
    const c = { icon: 'fa-inbox', key: 'MX' };
    if (mx.length === 1 && !mx[0].host) return { ...c, cls: 'warn', pill: 'Null MX', head: "Doesn't accept mail", text: 'A null MX (RFC 7505) says this domain never receives email.' };
    if (!mx.length) return { ...c, cls: 'warn', pill: 'Missing', head: 'No mail servers', text: "Mail would fall back to the A record. Most domains without MX don't receive email." };
    const prov = provider(mx.map(m => m.host));
    return {
      ...c, cls: 'ok', head: prov ? esc(prov) : plural(mx.length, 'mail server'),
      text: (prov ? plural(mx.length, 'mail server') + '. ' : '') + (mx.length > 1 ? 'The lowest number is tried first.' : 'All incoming mail goes here.'),
      body: `<ul class="mc__list">${mx.map(m => `<li><span class="mc__n" title="Preference">${m.pref}</span>${host(m.host)}</li>`).join('')}</ul>`
    };
  }

  function spfCard(recs, name) {
    const spf = recs.filter(r => r.type === 'TXT' && r.name === name && /^v=spf1(\s|$)/i.test(r.data));
    const c = { icon: 'fa-paper-plane', key: 'SPF' };
    if (spf.length > 1) return { ...c, cls: 'bad', pill: 'Broken', head: `${spf.length} SPF records`, text: 'Only one is allowed: receivers treat this as a permanent error. Merge them into one.', raw: spf.map(r => r.data).join('\n\n') };
    if (!spf.length) return { ...c, cls: 'warn', pill: 'Missing', head: 'No SPF record', text: "Nothing says which servers may send as this domain, so it's easier to spoof." };
    const d = spf[0].data, terms = d.split(/\s+/).slice(1);
    const allT = terms.find(t => /^[-~?+]?all$/i.test(t)), redirect = terms.find(t => /^redirect=/i.test(t));
    const POL = {
      '-': ['ok', 'Hard fail <span class="muted">-all</span>', 'Mail from servers not listed is rejected.'],
      '~': ['ok', 'Soft fail <span class="muted">~all</span>', 'Mail from servers not listed is marked as suspicious.'],
      '?': ['warn', 'Neutral <span class="muted">?all</span>', "Doesn't protect against spoofing."],
      '+': ['bad', 'Pass all <span class="muted">+all</span>', 'Anyone may send mail as this domain!']
    };
    let [cls, head, text] = allT ? POL[/^[-~?+]/.test(allT) ? allT[0] : '+']
      : redirect ? ['ok', 'Redirect', `Uses the policy of ${host(redirect.slice(9))}.`]
      : ['warn', 'No <span class="muted">all</span> rule', 'Mail from unlisted servers gets a neutral result.'];
    // each of these costs a DNS lookup; more than 10 (counting nested includes) is a permanent error
    const lookups = terms.filter(t => /^[-~?+]?(include:|exists:|ptr\b|a(?=$|[:/])|mx(?=$|[:/]))/i.test(t) || /^redirect=/i.test(t)).length;
    const inc = terms.filter(t => /^[-~?+]?include:/i.test(t)).map(t => t.replace(/^[-~?+]?include:/i, ''));
    const ips = terms.filter(t => /^[-~?+]?ip[46]:/i.test(t)).length;
    if (lookups > 10) { cls = 'bad'; text += ' It also needs more than 10 DNS lookups, which breaks SPF.'; }
    const lvl = lookups > 10 ? 'bad' : lookups >= 8 ? 'warn' : '';
    const body = `<div class="mc__meter ${lvl}" title="Counted from this record only; includes inside includes count too"><span>DNS lookups</span><b>${lookups} / 10</b><i style="--p:${Math.min(lookups / 10, 1)}"></i></div>`
      + (inc.length ? `<div class="mc__lbl">Allowed senders${ips ? ` · ${plural(ips, 'IP range')}` : ''}</div><div class="mc__tags">${inc.map(h => `<span class="chip" data-q="${esc(h)}" title="Look up ${esc(h)}">${esc(h)}</span>`).join('')}</div>`
        : ips ? `<div class="mc__lbl">Allowed senders · ${plural(ips, 'IP range')}</div>` : '');
    return { ...c, cls, head, text, body, raw: d };
  }

  function dmarcCard(dmarcRes, name) {
    const c = { icon: 'fa-shield-halved', key: 'DMARC' };
    if (!dmarcRes || dmarcRes.error) return { ...c, cls: 'warn', pill: 'Unknown', head: "Couldn't check", text: `The lookup of <code>_dmarc.${esc(name)}</code> failed.` };
    const dm = (dmarcRes.j.Answer || []).filter(a => a.type === 16).map(a => txt(a.data)).find(d => /^v=DMARC1/i.test(d));
    if (!dm) return { ...c, cls: 'warn', pill: 'Missing', head: 'No DMARC policy', text: `Nothing at <code>_dmarc.${esc(name)}</code>, so receivers decide on their own what to do with spoofed mail.` };
    const tag = {};
    dm.split(';').forEach(s => { const i = s.indexOf('='); if (i > 0) tag[s.slice(0, i).trim().toLowerCase()] = s.slice(i + 1).trim(); });
    const P = { reject: ['ok', 'Reject', 'Mail that fails SPF and DKIM checks is refused.'], quarantine: ['ok', 'Quarantine', 'Mail that fails SPF and DKIM checks goes to spam.'], none: ['warn', 'Monitor only', 'Failing mail is only reported, nothing is blocked (p=none).'] };
    const p = (tag.p || '').toLowerCase(), pol = P[p] || ['warn', 'No valid policy', 'The record has no valid <code>p=</code> tag.'];
    let text = pol[2];
    const pct = tag.pct != null ? +tag.pct : 100;
    if (pct < 100 && p !== 'none') text += ` Only applies to ${pct}% of it.`;
    const sp = (tag.sp || p).toLowerCase();
    const mails = (v) => v ? v.split(',').map(x => esc(x.trim().replace(/^mailto:/i, ''))).join('<br>') : '<span class="muted">none</span>';
    const align = (v) => (v || 'r').toLowerCase() === 's' ? 'strict' : 'relaxed';
    const body = `<dl class="mc__kv"><dt>Subdomains</dt><dd>${esc(sp || '-')}${tag.sp ? '' : ' <span class="muted">(inherited)</span>'}</dd><dt>Applies to</dt><dd>${pct}%</dd>`
      + `<dt>Reports</dt><dd>${mails(tag.rua)}</dd>${tag.ruf ? `<dt>Failures</dt><dd>${mails(tag.ruf)}</dd>` : ''}<dt>Alignment</dt><dd>SPF ${align(tag.aspf)} · DKIM ${align(tag.adkim)}</dd></dl>`;
    return { ...c, cls: pol[0], head: pol[1], text, body, raw: dm };
  }

  function dkimCard(name) {
    return {
      icon: 'fa-key', key: 'DKIM', pill: 'Not checked', head: 'Needs a selector',
      text: 'Enter the selector from the <code>s=</code> tag of a DKIM-Signature mail header, or try the usual ones.',
      body: '<div class="mc__out" id="dkimOut"></div>',
      foot: `<div class="mc__foot"><form class="mc__form" id="dkimForm"><input class="input" id="dkimSel" placeholder="selector" spellcheck="false" autocapitalize="off" aria-label="DKIM selector"><button class="btn btn--sm" type="submit">Check</button></form><button class="mc__link" type="button" id="dkimTry"><i class="fas fa-wand-magic-sparkles"></i>&nbsp; Try common selectors</button></div>`
    };
  }

  function mailChecks(recs, dmarcRes, name) {
    const cards = [mxCard(recs, name), spfCard(recs, name), dmarcCard(dmarcRes, name)];
    const ok = cards.filter(c => c.cls === 'ok').length, bad = cards.some(c => c.cls === 'bad');
    const score = ok === 3 ? '<span class="pill ok"><i class="fas fa-check"></i>All set</span>'
      : `<span class="pill ${bad ? 'bad' : 'warn'}"><i class="fas fa-${bad ? 'xmark' : 'exclamation'}"></i>${ok} of 3 pass</span>`;
    return { html: cards.concat(dkimCard(name)).map(card).join(''), score };
  }

  // ---------- DKIM ----------
  const SELECTORS = ['default', 'google', 'selector1', 'selector2', 'k1', 'k2', 's1', 's2', 'dkim', 'mail', 'smtp', 'sig1', 'fm1', 'protonmail', 'zoho', 'mandrill', 'mxvault', 'everlytic', 'krs', 'pm'];
  let mailCtx = null;   // { name, resolver } of the email card on screen
  function dkimKey(d) {
    const tag = {};
    d.split(';').forEach(s => { const i = s.indexOf('='); if (i > 0) tag[s.slice(0, i).trim().toLowerCase()] = s.slice(i + 1).replace(/\s+/g, ''); });
    if (!tag.p) return { cls: 'bad', desc: 'revoked (empty key)' };
    const k = (tag.k || 'rsa').toLowerCase();
    if (k !== 'rsa') return { cls: 'ok', desc: k === 'ed25519' ? 'Ed25519' : k.toUpperCase() };
    // an RSA public key in SubjectPublicKeyInfo DER is ~38 bytes of wrapping around the modulus
    const bits = Math.round(((tag.p.length * 3 / 4 - 38) * 8) / 1024) * 1024;
    return { cls: bits < 2048 ? 'warn' : 'ok', desc: `RSA ${bits || '?'}-bit${bits && bits < 2048 ? ' (weak)' : ''}` };
  }
  async function dkimCheck(sels) {
    if (!mailCtx) return;
    const { name, resolver: r } = mailCtx, out = $('#dkimOut'), card = out.closest('.mc');
    const btns = card.querySelectorAll('button'); btns.forEach(b => { b.disabled = true; });
    out.innerHTML = `<p class="mc__p muted"><i class="fas fa-spinner fa-spin"></i>&nbsp; Checking ${sels.length > 1 ? plural(sels.length, 'selector') : esc(sels[0])}…</p>`;
    const res = await Promise.all(sels.map(s => query(r, `${s}._domainkey.${name}`, 'TXT').then(x => ({ s, x }))));
    if (!mailCtx || mailCtx.name !== name || !out.isConnected) return;
    btns.forEach(b => { b.disabled = false; });
    const found = res.map(({ s, x }) => {
      const d = x.j && (x.j.Answer || []).filter(a => a.type === 16).map(a => txt(a.data)).find(v => /(^|;)\s*(v=DKIM1|k=|p=)/i.test(v));
      return d ? { s, d, ...dkimKey(d) } : null;
    }).filter(Boolean);
    const failed = res.every(({ x }) => x.error);
    const cls = found.length ? (found.some(f => f.cls === 'ok') ? 'ok' : found[0].cls) : failed ? 'warn' : '';
    card.className = 'mc ' + cls;
    card.querySelector('.pill').className = 'pill ' + cls;
    card.querySelector('.pill').innerHTML = `<i class="fas ${PILL[cls][0]}"></i>${found.length ? plural(found.length, 'key') : failed ? 'Error' : 'Not found'}`;
    card.querySelector('.mc__h').innerHTML = found.length ? 'Key found' : failed ? "Couldn't check" : 'No key found';
    out.innerHTML = found.length
      ? `<ul class="mc__list">${found.map(f => `<li><span class="mc__n">${esc(f.s)}</span><span class="${{ warn: 'amber', bad: 'err-text' }[f.cls] || ''}">${esc(f.desc)}</span></li>`).join('')}</ul>`
      : `<p class="mc__p muted">${failed ? 'The resolver could not be reached.' : sels.length > 1 ? `None of ${sels.length} common selectors answered. Find the real one in a mail header.` : `Nothing at <code>${esc(sels[0])}._domainkey.${esc(name)}</code>.`}</p>`;
  }

  // ---------- resolver comparison ----------
  function compare(a, b, types) {
    const set = (rs, t) => rs.filter(x => x.type === t).map(x => x.data.toLowerCase()).sort();
    let same = 0;
    const html = types.map((t, i) => {
      const x = set(a, t), y = set(b, t), c = { icon: 'fa-server', key: t };
      if (!x.length && !y.length) { same++; return card({ ...c, pill: 'Empty', head: 'No records', text: 'Neither resolver has any.' }, i); }
      const onlyA = x.filter(v => !y.includes(v)), onlyB = y.filter(v => !x.includes(v));
      if (!onlyA.length && !onlyB.length) { same++; return card({ ...c, cls: 'ok', pill: 'Match', head: 'Same answer', text: `${plural(x.length, 'record')} from both.` }, i); }
      const li = (tag, v) => `<li><span class="mc__n ${tag}">${tag === 'cf' ? 'CF' : 'G'}</span><span>${esc(v)}</span></li>`;
      return card({ ...c, cls: 'warn', pill: 'Differs', head: 'Answers differ', text: `Cloudflare returned ${x.length}, Google ${y.length}. Only in one:`, body: `<ul class="mc__list">${onlyA.map(v => li('cf', v)).join('')}${onlyB.map(v => li('g', v)).join('')}</ul>` }, i);
    }).join('');
    const score = `<span class="pill ${same === types.length ? 'ok' : 'warn'}"><i class="fas fa-${same === types.length ? 'check' : 'exclamation'}"></i>${same} of ${types.length} match</span>`;
    return { html, score };
  }

  // ---------- run ----------
  let type = 'ALL', resolver = 'cloudflare', job = 0;
  try { const s = JSON.parse(localStorage.getItem('dns-opts') || '{}'); if (RES[s.r] || s.r === 'both') resolver = s.r; } catch (e) {}
  $('#types').innerHTML = TABS.map(t => `<button type="button" data-t="${t}" aria-pressed="${t === type}">${t === 'ALL' ? 'All' : t}</button>`).join('');
  const press = (sel, attr, v) => $(sel).querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset[attr] === v)));

  async function lookup(push = true) {
    const n = normalize($('#q').value), my = ++job;
    $('#q').classList.toggle('is-bad', !!n.err);
    if (n.err) {
      $('#stats').innerHTML = stat('Error', esc(n.err), 'err');
      $('#recs').innerHTML = $('#tfilter').innerHTML = $('#recInfo').textContent = '';
      $('#recEmpty').hidden = $('#mailPanel').hidden = $('#cmpPanel').hidden = true;
      mailCtx = null;
      return;
    }
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

    // why each asked type came back empty: plain "no records" goes on one line under the table, errors are spelled out
    const empty = types.filter(t => !recs.some(r => r.type === t)).map(t => {
      const x = main.find(m => m.type === t);
      const why = x.error ? `couldn't reach ${RES[x.r].name} (offline, or blocked by an ad blocker?)` : x.j.Status === 3 ? (n.ip ? 'this IP has no reverse DNS entry (NXDOMAIN)' : "the name doesn't exist (NXDOMAIN)") : x.j.Status ? RCODE[x.j.Status] || 'error' : '';
      return { type: t, why };
    });
    if (recs.length) {
      $('#recs').innerHTML = recs.map((r, i) => `<tr class="fresh" data-type="${esc(r.type)}" style="--i:${i}"><td><span class="rt t-${esc(r.type)}">${esc(r.type)}</span></td><td>${esc(r.name)}</td><td title="${r.ttl} seconds">${ttl(r.ttl)}</td><td>${value(r)}</td><td><button class="copy" type="button" data-copy-val="${esc(r.data)}" aria-label="Copy value"><i class="far fa-copy"></i></button></td></tr>`).join('');
    } else {
      const whys = [...new Set(empty.map(e => e.why))];
      const msg = whys.length === 1 && !whys[0] ? `No ${listing(types)} records for ${name}.` : whys.filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join('. ') + '.';
      $('#recs').innerHTML = `<tr class="empty"><td colspan="5"><i class="fas fa-${whys.every(w => !w || /NXDOMAIN|no reverse/.test(w)) ? 'inbox' : 'triangle-exclamation'}"></i>${esc(msg)}</td></tr>`;
    }
    const quiet = empty.filter(e => !e.why).map(e => e.type), loud = empty.filter(e => e.why);
    $('#recEmpty').hidden = !recs.length || !empty.length;
    $('#recEmpty').innerHTML = (quiet.length ? `No ${listing(quiet.map(t => `<b>${t}</b>`))} records.` : '') + loud.map(e => ` <b>${e.type}</b>: ${esc(e.why)}.`).join('');
    $('#recInfo').textContent = `${name} · ${types.length === 1 ? types[0] : types.length + ' record types'}`;

    // type filter over the rows already on screen (only useful when several types came back)
    const counts = {};
    recs.forEach(r => { counts[r.type] = (counts[r.type] || 0) + 1; });
    const kinds = Object.keys(counts);
    $('#tfilter').innerHTML = kinds.length > 1
      ? [['ALL', 'All', recs.length]].concat(kinds.map(k => [k, k, counts[k]])).map(([k, l, c]) => `<button type="button" data-f="${esc(k)}" aria-pressed="${k === 'ALL'}">${esc(l)} <em>${c}</em></button>`).join('')
      : '';

    // email checks for domains that look like they handle mail (skip hosts like www.example.com)
    const mailish = wantMail && status !== 3 && (name.split('.').length <= 2 || recs.some(r => r.name === name && (r.type === 'MX' || (r.type === 'TXT' && /^v=spf1/i.test(r.data)))) || (dmarc && dmarc.j && dmarc.j.Answer));
    $('#mailPanel').hidden = !mailish;
    mailCtx = mailish ? { name, resolver: which[0] } : null;
    if (mailish) { const m = mailChecks(recs, dmarc, name); $('#mail').innerHTML = m.html; $('#mailScore').innerHTML = m.score; $('#mailDom').textContent = name; }
    $('#cmpPanel').hidden = which.length < 2;
    if (which.length > 1) { const c = compare(recs, records(sets[1]), types); $('#cmp').innerHTML = c.html; $('#cmpScore').innerHTML = c.score; }
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
  $('#tfilter').addEventListener('click', e => {
    const b = e.target.closest('[data-f]'); if (!b) return;
    press('#tfilter', 'f', b.dataset.f);
    $('#recs').querySelectorAll('tr[data-type]').forEach(tr => { tr.hidden = b.dataset.f !== 'ALL' && tr.dataset.type !== b.dataset.f; });
  });
  document.addEventListener('submit', e => {
    if (e.target.id !== 'dkimForm') return;
    e.preventDefault();
    const s = $('#dkimSel').value.trim().replace(/\._domainkey.*$/i, '');
    $('#dkimSel').classList.toggle('is-bad', !/^[a-z0-9_-]+(\.[a-z0-9_-]+)*$/i.test(s));
    if (!$('#dkimSel').classList.contains('is-bad')) dkimCheck([s]);
  });
  document.addEventListener('click', e => {
    if (e.target.closest('#dkimTry')) { dkimCheck(SELECTORS); return; }
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
