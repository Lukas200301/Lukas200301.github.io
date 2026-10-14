/* IPv6 tools: 128-bit maths with BigInt */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ALL = (1n << 128n) - 1n;
  const KEY = 'ipv6-tools';
  const ipEl = $('#ip'), prefixEl = $('#prefix'), prefixLabel = $('#prefixLabel'), state = $('#state');

  /* ---------- parsing ---------- */
  function parseV4(s) {
    const m = s.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!m) return null;
    const o = m.slice(1).map(Number);
    if (o.some(x => x > 255) || m.slice(1).some(x => x.length > 1 && x[0] === '0')) return null;
    return ((o[0] << 24) | (o[1] << 16) | (o[2] << 8) | o[3]) >>> 0;
  }
  const v4str = (n) => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');

  // returns { v: BigInt } or { err }
  function parseAddr(s) {
    s = s.trim();
    if (!s) return { err: 'Enter an IPv6 address' };
    if (/^[0-9a-f.]+\.ip6\.arpa\.?$/i.test(s)) {
      const n = s.replace(/\.ip6\.arpa\.?$/i, '').split('.');
      if (n.length > 32 || n.some(x => !/^[0-9a-f]$/i.test(x))) return { err: 'Not a valid ip6.arpa name (needs single hex nibbles)' };
      const hex = n.reverse().join('').padEnd(32, '0');
      return { v: BigInt('0x' + hex), arpaLen: n.length * 4 };
    }
    if (!/^[0-9a-f:.]+$/i.test(s)) return { err: 'Only hex digits, ":" and "." are allowed' };
    let groups = [];
    // embedded IPv4 in the last 32 bits
    const lastColon = s.lastIndexOf(':');
    let tail = [];
    if (s.indexOf('.') !== -1) {
      const v4 = parseV4(s.slice(lastColon + 1));
      if (v4 == null || lastColon === -1) return { err: 'The embedded IPv4 part is not valid' };
      tail = [v4 >>> 16, v4 & 0xffff];
      s = s.slice(0, lastColon + 1);
      if (!s.endsWith('::')) s = s.slice(0, -1); // "1:2:3:4:5:6:" -> "1:2:3:4:5:6", "::ffff:" -> "::ffff"
    }
    const dbl = s.split('::');
    if (dbl.length > 2) return { err: '"::" may appear only once' };
    const part = (x) => (x === '' ? [] : x.split(':'));
    const head = part(dbl[0]), rest = dbl.length === 2 ? part(dbl[1]) : [];
    for (const g of head.concat(rest)) if (!/^[0-9a-f]{1,4}$/i.test(g)) return { err: g === '' ? 'Empty group (single ":" at the start or end?)' : `"${g}" is not a valid group (1–4 hex digits)` };
    const have = head.length + rest.length + tail.length;
    if (dbl.length === 2) {
      if (have > 7) return { err: '"::" must stand for at least one group' };
      groups = head.map(h => parseInt(h, 16)).concat(new Array(8 - have).fill(0), rest.map(h => parseInt(h, 16)), tail);
    } else {
      if (have !== 8) return { err: `Needs 8 groups, found ${have}` };
      groups = head.map(h => parseInt(h, 16)).concat(tail);
    }
    let v = 0n;
    for (const g of groups) v = (v << 16n) | BigInt(g);
    return { v };
  }

  // full input: brackets, port, zone id, prefix
  function parseInput(input) {
    let s = input.trim(), zone = '', prefix = null;
    let m = s.match(/^\[([^\]]+)\](?::(\d+))?$/);
    if (m) s = m[1];
    m = s.match(/^(.*)\/(\d{1,3})$/);
    if (m) { s = m[1]; prefix = +m[2]; if (prefix > 128) return { err: 'Prefix must be 0–128' }; }
    const z = s.indexOf('%');
    if (z !== -1) { zone = s.slice(z + 1); s = s.slice(0, z); if (!zone || /[\s/]/.test(zone)) return { err: 'Zone id after "%" is empty or invalid' }; }
    const r = parseAddr(s);
    if (r.err) return r;
    if (prefix == null && r.arpaLen && r.arpaLen < 128) prefix = r.arpaLen;
    return { v: r.v, zone, prefix };
  }

  /* ---------- formatting ---------- */
  const hextets = (v) => { const g = []; for (let i = 7; i >= 0; i--) g.push(Number((v >> BigInt(i * 16)) & 0xffffn)); return g; };
  const expand = (v) => hextets(v).map(g => g.toString(16).padStart(4, '0')).join(':');
  function compress(v, { v4 = true } = {}) {
    const g = hextets(v);
    // RFC 5952 §5: IPv4-mapped and the NAT64 well-known prefix keep the dotted quad
    if (v4 && ((v >> 32n) === 0xffffn || (v >> 32n) === 0x0064ff9b0000000000000000n)) {
      const pre = (v >> 32n) === 0xffffn ? '::ffff:' : '64:ff9b::';
      return pre + v4str(Number(v & 0xffffffffn));
    }
    let best = -1, bestLen = 1, i = 0;
    while (i < 8) {
      if (g[i] === 0) { let j = i; while (j < 8 && g[j] === 0) j++; if (j - i > bestLen) { best = i; bestLen = j - i; } i = j; } else i++;
    }
    const hx = g.map(x => x.toString(16));
    if (best === -1) return hx.join(':');
    return hx.slice(0, best).join(':') + '::' + hx.slice(best + bestLen).join(':');
  }
  const bin = (v) => v.toString(2).padStart(128, '0');
  const fmtBig = (n) => n.toLocaleString('en');
  const pow2 = (k) => 1n << BigInt(k);
  const maskOf = (p) => (p === 0 ? 0n : (ALL << BigInt(128 - p)) & ALL);
  function nice(n) { // 2^k with readable size
    const s = fmtBig(n);
    if (n < 10n ** 15n) return s;
    const e = n.toString().length - 1, lead = n.toString().slice(0, 4);
    return `${lead[0]}.${lead.slice(1)} × 10^${e}`;
  }
  const arpa = (v, nibbles = 32) => expand(v).replace(/:/g, '').slice(0, nibbles).split('').reverse().join('.') + '.ip6.arpa';

  /* ---------- classification ---------- */
  const inNet = (v, net, p) => ((v ^ net) & maskOf(p)) === 0n;
  const P = (s) => parseAddr(s).v;
  const MC_SCOPE = { 0: 'Reserved', 1: 'Interface-local', 2: 'Link-local', 3: 'Realm-local', 4: 'Admin-local', 5: 'Site-local', 8: 'Organization-local', 14: 'Global', 15: 'Reserved' };
  const MC_GROUPS = { 'ff02::1': 'All nodes', 'ff02::2': 'All routers', 'ff02::5': 'OSPF routers', 'ff02::6': 'OSPF designated routers', 'ff02::9': 'RIP routers', 'ff02::a': 'EIGRP routers', 'ff02::d': 'PIM routers', 'ff02::16': 'MLDv2 reports', 'ff02::1a': 'RPL nodes', 'ff02::fb': 'mDNS', 'ff02::1:2': 'DHCPv6 relay agents and servers', 'ff05::1:3': 'DHCPv6 servers (site)', 'ff02::1:3': 'LLMNR', 'ff01::1': 'All nodes (interface-local)', 'ff01::2': 'All routers (interface-local)', 'ff05::2': 'All routers (site)', 'ff0e::101': 'NTP', 'ff02::101': 'NTP (link)' };
  function classify(v) {
    const t = { name: 'Reserved', scope: 'Global', cls: 'warn', notes: [] };
    if (v === 0n) return { ...t, name: 'Unspecified', scope: '—', note: 'The "any" address (::), like 0.0.0.0 in IPv4' };
    if (v === 1n) return { ...t, name: 'Loopback', scope: 'Host', note: 'This host (::1), like 127.0.0.1' };
    if ((v >> 32n) === 0xffffn) return { ...t, name: 'IPv4-mapped', scope: 'IPv4', cls: 'ok', v4: Number(v & 0xffffffffn), note: 'An IPv4 address seen through an IPv6 socket (::ffff:0:0/96)' };
    if ((v >> 32n) === 0n) return { ...t, name: 'IPv4-compatible (deprecated)', scope: 'IPv4', v4: Number(v & 0xffffffffn), note: '::/96, deprecated by RFC 4291' };
    if (inNet(v, P('64:ff9b::'), 96)) return { ...t, name: 'NAT64 (well-known prefix)', scope: 'Global', cls: 'ok', v4: Number(v & 0xffffffffn), note: '64:ff9b::/96 (RFC 6052), maps to an IPv4 host' };
    if (inNet(v, P('64:ff9b:1::'), 48)) return { ...t, name: 'NAT64 (local-use)', scope: 'Site', note: '64:ff9b:1::/48 (RFC 8215)' };
    if (inNet(v, P('100::'), 64)) return { ...t, name: 'Discard-only', scope: 'Global', note: '100::/64 (RFC 6666), traffic is dropped' };
    if (inNet(v, P('2001::'), 32)) {
      const srv = Number((v >> 64n) & 0xffffffffn), flags = Number((v >> 48n) & 0xffffn);
      const port = Number((v >> 32n) & 0xffffn) ^ 0xffff, cli = (Number(v & 0xffffffffn) ^ 0xffffffff) >>> 0;
      return { ...t, name: 'Teredo', scope: 'Global', cls: 'ok', note: '2001::/32 (RFC 4380), IPv6 tunnelled over UDP/IPv4', teredo: { srv, flags, port, cli } };
    }
    if (inNet(v, P('2001:2::'), 48)) return { ...t, name: 'Benchmarking', scope: 'Global', note: '2001:2::/48 (RFC 5180), lab use only' };
    if (inNet(v, P('2001:db8::'), 32)) return { ...t, name: 'Documentation', scope: 'Global', note: '2001:db8::/32 (RFC 3849), for examples only, never routed' };
    if (inNet(v, P('3fff::'), 20)) return { ...t, name: 'Documentation', scope: 'Global', note: '3fff::/20 (RFC 9637), for examples only, never routed' };
    if (inNet(v, P('2001:10::'), 28)) return { ...t, name: 'ORCHID (deprecated)', scope: 'Global', note: '2001:10::/28 (RFC 4843)' };
    if (inNet(v, P('2001:20::'), 28)) return { ...t, name: 'ORCHIDv2', scope: 'Global', note: '2001:20::/28 (RFC 7343), cryptographic hash identifiers' };
    if (inNet(v, P('2002::'), 16)) return { ...t, name: '6to4', scope: 'Global', cls: 'ok', v4: Number((v >> 80n) & 0xffffffffn), note: '2002::/16 (RFC 3056), embeds the router\'s IPv4 address' };
    if (inNet(v, P('fc00::'), 7)) {
      const local = inNet(v, P('fd00::'), 8);
      return { ...t, name: 'Unique local (ULA)', scope: 'Site', cls: 'ok', note: local ? 'fd00::/8, private like 10.0.0.0/8; Global ID ' + expand(v).slice(2, 14).replace(/:/g, '').replace(/(.{2})(.{4})(.{4})/, '$1:$2:$3') : 'fc00::/8, reserved (no assignment authority yet)' };
    }
    if (inNet(v, P('fe80::'), 10)) return { ...t, name: 'Link-local', scope: 'Link', cls: 'ok', note: 'fe80::/10, valid only on one link, never routed (needs a zone id)' };
    if (inNet(v, P('fec0::'), 10)) return { ...t, name: 'Site-local (deprecated)', scope: 'Site', note: 'fec0::/10, deprecated by RFC 3879' };
    if (inNet(v, P('ff00::'), 8)) {
      const flags = Number((v >> 116n) & 0xfn), sc = Number((v >> 112n) & 0xfn);
      const short = compress(v);
      let group = MC_GROUPS[short] || '';
      if (inNet(v, P('ff02::1:ff00:0'), 104)) group = 'Solicited-node (for neighbour discovery of addresses ending in ' + (Number(v & 0xffffffn)).toString(16).padStart(6, '0').replace(/(..)(....)/, '$1:$2') + ')';
      const fl = [flags & 1 ? 'T: dynamic (transient)' : 'T: well-known', flags & 2 ? 'P: prefix-based' : '', flags & 4 ? 'R: embedded RP' : ''].filter(Boolean).join(', ');
      return { ...t, name: 'Multicast', scope: (MC_SCOPE[sc] || 'Unassigned') + ` (${sc.toString(16)})`, cls: 'ok', note: group || 'ff00::/8', mcFlags: fl };
    }
    if (inNet(v, P('2000::'), 3)) return { ...t, name: 'Global unicast', scope: 'Global', cls: 'ok', note: '2000::/3, publicly routable' };
    return { ...t, note: 'Not assigned for unicast or multicast use by IANA' };
  }

  /* ---------- 128 bit cells ---------- */
  const bitsEl = $('#bits');
  for (let h = 0; h < 8; h++) {
    const hx = document.createElement('div'); hx.className = 'hextet';
    for (let n = 0; n < 4; n++) {
      const nb = document.createElement('div'); nb.className = 'nib';
      for (let k = 0; k < 4; k++) { const b = document.createElement('span'); b.className = 'bit'; b.style.setProperty('--b', h * 16 + n * 4 + k); nb.appendChild(b); }
      hx.appendChild(nb);
    }
    const v = document.createElement('span'); v.className = 'hextet__val'; hx.appendChild(v);
    bitsEl.appendChild(hx);
  }
  const bitCells = Array.from(bitsEl.querySelectorAll('.bit')), hexVals = Array.from(bitsEl.querySelectorAll('.hextet__val'));
  let lastBits = '';

  function row(label, value, sub, opts = {}) {
    const val = opts.html || esc(value);
    return `<div><dt>${label}</dt><dd>${val}${sub ? `<small>${sub}</small>` : ''}</dd>${opts.noCopy ? '<span></span>' : `<button class="copy" type="button" data-copy-val="${esc(value)}" aria-label="Copy ${esc(label)}"><i class="far fa-copy"></i></button>`}</div>`;
  }

  let cur = null; // { net, p }
  function render() {
    const r = parseInput(ipEl.value);
    if (r.err) {
      ipEl.classList.add('is-bad'); state.className = 'status err'; state.innerHTML = `<i class="fas fa-circle-xmark"></i>${esc(r.err)}`;
      $('#typeChip').innerHTML = '';
      return;
    }
    ipEl.classList.remove('is-bad');
    try { localStorage.setItem(KEY, JSON.stringify({ ip: ipEl.value, mac: $('#mac').value, slaac: $('#slaacPrefix').value, rev: $('#rev').value })); } catch (e) {}
    const v = r.v, p = r.prefix == null ? +prefixEl.value : r.prefix;
    prefixEl.value = p; prefixLabel.textContent = '/' + p;
    const t = classify(v);
    state.className = 'status ok'; state.innerHTML = '<i class="fas fa-circle-check"></i>Valid IPv6';
    $('#typeChip').innerHTML = `<span class="tchip ${t.cls}">${esc(t.name)}</span>`;

    const short = compress(v), full = expand(v);
    const rows = [
      row('Compressed', short + (r.zone ? '%' + r.zone : ''), 'RFC 5952 canonical form'),
      row('Expanded', full),
      row('Type', t.name, t.note),
      row('Scope', t.scope, t.mcFlags || '')
    ];
    if (r.zone) rows.push(row('Zone id', r.zone, 'Interface the link-local address belongs to'));
    if (t.v4 != null) rows.push(row('Embedded IPv4', v4str(t.v4)));
    if (t.teredo) {
      rows.push(row('Teredo server', v4str(t.teredo.srv)));
      rows.push(row('Teredo client', `${v4str(t.teredo.cli)}:${t.teredo.port}`, 'Public IPv4 and UDP port of the NAT (de-obfuscated)'));
    }
    rows.push(row('Interface ID', compress(v & 0xffffffffffffffffn).replace(/^::/, '::'), 'Last 64 bits'));
    rows.push(row('Reverse DNS', arpa(v), 'PTR name in ip6.arpa nibble format'));
    rows.push(row('Integer', v.toString()));
    rows.push(row('Hex', '0x' + v.toString(16).padStart(32, '0')));
    $('#kvAddr').innerHTML = rows.join('');

    const mask = maskOf(p), net = v & mask, last = net | (~mask & ALL), total = pow2(128 - p);
    const zoneN = Math.floor(p / 4);
    const nrows = [
      row('Network', `${compress(net, { v4: false })}/${p}`),
      row('First address', compress(net, { v4: false })),
      row('Last address', compress(last, { v4: false })),
      row('Addresses', fmtBig(total), `2^${128 - p}` + (total >= 10n ** 15n ? ` ≈ ${nice(total)}` : '')),
    ];
    if (p <= 64) nrows.push(row('/64 subnets', fmtBig(pow2(64 - p)), 'Standard LAN size'));
    if (p <= 48) nrows.push(row('/56 subnets', fmtBig(pow2(56 - p)), 'Typical home / small site delegation'));
    if (p > 64) nrows.push(row('Note', 'Longer than /64', 'SLAAC needs exactly a /64 on a LAN', { noCopy: true }));
    nrows.push(row('Netmask', compress(mask, { v4: false }) || '::'));
    nrows.push(row('Reverse zone', zoneN ? arpa(net, zoneN) : 'ip6.arpa', p % 4 ? `/${p} is not on a nibble boundary; zone shown for /${zoneN * 4}` : 'Delegation name for this prefix'));
    $('#kvNet').innerHTML = nrows.join('');

    // bits
    const b = bin(v);
    bitCells.forEach((c, i) => {
      const bit = b[i];
      if (lastBits && lastBits[i] !== bit) { c.classList.add('flip'); setTimeout(() => c.classList.remove('flip'), 380); }
      c.textContent = bit;
      c.classList.toggle('net', i < p); c.classList.toggle('host', i >= p); c.classList.toggle('on', bit === '1');
    });
    const hs = hextets(v);
    hexVals.forEach((el, i) => { el.innerHTML = `<b>${i * 16}</b>${hs[i].toString(16).padStart(4, '0')}`; });
    lastBits = b;

    // split options
    cur = { net, p };
    const sel = $('#split'), want = +sel.dataset.prefix || 0, opts = [];
    for (let q = p + 1; q <= Math.min(128, p + 24); q++) opts.push(q);
    // add the classic boundaries if further away
    [48, 56, 64].forEach(q => { if (q > p + 24 && !opts.includes(q)) opts.push(q); });
    sel.innerHTML = opts.length ? opts.map(q => `<option value="${q}">/${q} (${nice(pow2(q - p))} subnets)</option>`).join('') : '<option>Cannot split a /128</option>';
    sel.disabled = !opts.length;
    const def = opts.includes(64) && p < 64 && p >= 48 ? 64 : opts.includes(p + 4) ? p + 4 : opts[0];
    if (opts.includes(want)) sel.value = want; else if (opts.length) sel.value = def;
    renderSplit();
  }

  let splitText = '';
  function renderSplit() {
    const sel = $('#split'), body = $('#splitBody'), info = $('#splitInfo');
    if (!cur) return;
    if (sel.disabled) { body.innerHTML = ''; info.textContent = 'A /128 is a single address and can\'t be split.'; splitText = ''; return; }
    const q = +sel.value, { net, p } = cur; sel.dataset.prefix = q;
    const count = pow2(q - p), size = pow2(128 - q), show = count < 256n ? Number(count) : 256;
    let html = '', txt = [];
    for (let i = 0; i < show; i++) {
      const sn = net + BigInt(i) * size, ln = sn + size - 1n, s = `${compress(sn, { v4: false })}/${q}`;
      txt.push(s);
      html += `<tr class="fresh" style="--i:${i}"><td>${i + 1}</td><td>${s}</td><td>${compress(sn, { v4: false })}</td><td>${compress(ln, { v4: false })}</td><td><button class="copy" type="button" data-copy-val="${s}" aria-label="Copy ${s}"><i class="far fa-copy"></i></button></td></tr>`;
    }
    body.innerHTML = html;
    splitText = txt.join('\n');
    info.textContent = `${fmtBig(count)} subnets of /${q}, ${nice(size)} addresses each.` + (count > BigInt(show) ? ` Showing the first ${show}.` : '');
  }

  /* ---------- EUI-64 ---------- */
  function parseMac(s) {
    const h = s.trim().replace(/[\s:.\-]/g, '');
    if (!/^[0-9a-f]{12}$/i.test(h)) return null;
    return h.match(/../g).map(x => parseInt(x, 16));
  }
  const macStr = (b) => b.map(x => x.toString(16).padStart(2, '0')).join(':');
  function renderEui() {
    const mac = parseMac($('#mac').value), out = $('#kvEui');
    $('#mac').classList.toggle('is-bad', !mac);
    if (!mac) { out.innerHTML = row('Error', 'Enter a MAC like 00:1A:2B:3C:4D:5E', '', { noCopy: true }); return; }
    const e = [mac[0] ^ 0x02, mac[1], mac[2], 0xff, 0xfe, mac[3], mac[4], mac[5]];
    let iid = 0n; e.forEach(x => { iid = (iid << 8n) | BigInt(x); });
    const iidStr = [0, 2, 4, 6].map(i => ((e[i] << 8) | e[i + 1]).toString(16)).join(':');
    const rows = [
      row('EUI-64', e.map(x => x.toString(16).padStart(2, '0')).join(':'), `U/L bit flipped: ${mac[0].toString(16).padStart(2, '0')} → ${e[0].toString(16).padStart(2, '0')}` + (mac[0] & 2 ? ' (locally administered MAC)' : '')),
      row('Interface ID', iidStr),
      row('Link-local', compress((P('fe80::')) | iid))
    ];
    const pr = parseInput($('#slaacPrefix').value);
    $('#slaacPrefix').classList.toggle('is-bad', !!pr.err);
    if (!pr.err) {
      const net = pr.v & maskOf(64);
      rows.push(row('SLAAC address', compress(net | iid), pr.prefix != null && pr.prefix !== 64 ? `SLAAC needs a /64, used the first 64 bits of your /${pr.prefix}` : 'Prefix + interface ID'));
    } else rows.push(row('SLAAC address', pr.err, '', { noCopy: true }));
    out.innerHTML = rows.join('');
  }
  function renderRev() {
    const out = $('#kvRev'), raw = $('#rev').value.trim();
    let v;
    const r = parseInput(raw.includes('::') || raw.split(':').length >= 8 ? raw : '::' + raw);
    $('#rev').classList.toggle('is-bad', !!r.err);
    if (r.err) { out.innerHTML = row('Error', r.err, '', { noCopy: true }); return; }
    v = r.v & 0xffffffffffffffffn;
    const by = []; for (let i = 7; i >= 0; i--) by.push(Number((v >> BigInt(i * 8)) & 0xffn));
    if (by[3] !== 0xff || by[4] !== 0xfe) {
      out.innerHTML = row('Interface ID', compress(v)) + row('Result', 'Not EUI-64 based', 'No ff:fe in the middle: probably a random privacy or stable-opaque address', { noCopy: true });
      return;
    }
    const mac = [by[0] ^ 0x02, by[1], by[2], by[5], by[6], by[7]];
    out.innerHTML = row('Interface ID', compress(v)) + row('MAC address', macStr(mac).toUpperCase(), (mac[0] & 1 ? 'Multicast bit set, ' : '') + (mac[0] & 2 ? 'locally administered' : 'globally unique (OUI ' + macStr(mac.slice(0, 3)).toUpperCase() + ')')) + row('MAC (Cisco)', macStr(mac).replace(/:/g, '').replace(/(.{4})(?!$)/g, '$1.'));
  }

  /* ---------- events ---------- */
  ipEl.addEventListener('input', render);
  prefixEl.addEventListener('input', () => {
    const base = ipEl.value.trim().replace(/\/\d*$/, '');
    ipEl.value = `${base}/${prefixEl.value}`; render();
  });
  $('#split').addEventListener('change', renderSplit);
  $('#copySplit').addEventListener('click', () => { if (splitText && window.Site) Site.copy(splitText, `Copied ${splitText.split('\n').length} subnets`); });
  $('#presets').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b) { ipEl.value = b.dataset.v; render(); } });
  ['#mac', '#slaacPrefix'].forEach(s => $(s).addEventListener('input', () => { renderEui(); render(); }));
  $('#rev').addEventListener('input', () => { renderRev(); render(); });
  document.addEventListener('click', e => { const c = e.target.closest('[data-copy-val]'); if (c && window.Site) Site.copy(c.dataset.copyVal, 'Copied ' + (c.dataset.copyVal.length > 48 ? c.dataset.copyVal.slice(0, 45) + '…' : c.dataset.copyVal)); });

  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s) { if (s.ip) ipEl.value = s.ip; if (s.mac) $('#mac').value = s.mac; if (s.slaac) $('#slaacPrefix').value = s.slaac; if (s.rev) $('#rev').value = s.rev; }
  } catch (e) {}
  render(); renderEui(); renderRev();
})();
