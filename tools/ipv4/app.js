/* IPv4 tools: 32-bit maths with plain numbers, kept unsigned with >>> 0 (every value up to 2^32 is exact in a double) */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const KEY = 'ipv4-tools';
  const TWO32 = 4294967296;
  const ipEl = $('#ip'), prefixEl = $('#prefix'), prefixLabel = $('#prefixLabel'), state = $('#state');

  const toInt = (o) => ((o[0] << 24) | (o[1] << 16) | (o[2] << 8) | o[3]) >>> 0;
  const octets = (n) => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  const toIp = (n) => octets(n).join('.');
  const maskOf = (p) => (p === 0 ? 0 : (0xffffffff << (32 - p)) >>> 0);
  const sizeOf = (p) => Math.pow(2, 32 - p);
  const bin = (n) => n.toString(2).padStart(32, '0');
  const fmt = (n) => n.toLocaleString('en');
  const hosts = (p) => (p === 32 ? 1 : p === 31 ? 2 : sizeOf(p) - 2);

  /* ---------- parsing ---------- */
  function parseDotted(s) {
    const m = s.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!m) return null;
    const o = m.slice(1).map(Number);
    if (o.some(x => x > 255)) return null;
    return { n: toInt(o), lead: m.slice(1).some(x => x.length > 1 && x[0] === '0') };
  }
  // one address in any notation: dotted quad, ::ffff:a.b.c.d, integer or hex
  function parseOne(s) {
    s = s.trim();
    let r = parseDotted(s);
    if (r) return r;
    const m = s.match(/^\[?::ffff:([\d.]+)\]?$/i);
    if (m && (r = parseDotted(m[1]))) return { ...r, how: 'IPv4-mapped IPv6 address' };
    if (/^\d{1,10}$/.test(s) && +s < TWO32) return { n: +s, how: 'Read as a 32-bit integer' };
    if (/^0x[0-9a-f]{1,8}$/i.test(s)) return { n: parseInt(s, 16), how: 'Read as hex' };
    return null;
  }
  // netmask (255.255.240.0) or wildcard (0.0.15.255) → { p, wild }
  function maskToPrefix(n) {
    const inv = (~n) >>> 0;
    return ((inv + 1) & inv) === 0 ? 32 - Math.log2(inv + 1) : null;
  }
  function parseMask(s) {
    const d = parseDotted(s);
    if (!d) return null;
    let p = maskToPrefix(d.n);
    if (p != null) return { p, wild: false };
    p = maskToPrefix((~d.n) >>> 0);
    return p != null ? { p, wild: true } : null;
  }
  // smallest list of CIDR blocks covering [a, b]
  function rangeToCidrs(a, b, max = 4096) {
    const out = [];
    while (a <= b && out.length < max) {
      let k = 32;
      while (k > 0 && (a % Math.pow(2, k) !== 0 || a + Math.pow(2, k) - 1 > b)) k--;
      out.push({ n: a, p: 32 - k });
      a += Math.pow(2, k);
    }
    return out;
  }

  // the main input: address with prefix / mask / wildcard, a range or an in-addr.arpa name
  function parseInput(input) {
    const s = input.trim();
    if (!s) return { err: 'Enter an IPv4 address' };
    let m = s.match(/^([\d.]+?)\.in-addr\.arpa\.?$/i);
    if (m) {
      const parts = m[1].split('.');
      if (parts.length > 4 || parts.some(x => !/^\d{1,3}$/.test(x) || +x > 255)) return { err: 'Not a valid in-addr.arpa name' };
      const o = parts.slice().reverse().map(Number);
      while (o.length < 4) o.push(0);
      return { n: toInt(o), p: parts.length < 4 ? parts.length * 8 : null, how: 'Read from an in-addr.arpa name' };
    }
    m = s.match(/^(\S+)\s*-\s*(\S+)$/);
    if (m) {
      const a = parseOne(m[1]), b = parseOne(m[2]);
      if (!a || !b) return { err: 'Range needs two valid addresses: 10.0.0.0 - 10.0.0.255' };
      if (a.n > b.n) return { err: 'Range start is after its end' };
      const c = rangeToCidrs(a.n, b.n);
      if (c.length !== 1) return { err: `That range is ${c.length} CIDR blocks, not one. Paste it into "Merge, exclude & convert" below.` };
      return { n: a.n, p: c[0].p, how: 'Range converted to one CIDR block' };
    }
    m = s.match(/^(\S+?)\s*\/\s*(\S+)$/) || s.match(/^(\S+)\s+(\S+)$/);
    if (m) {
      const a = parseOne(m[1]);
      if (!a) return { err: 'Not a valid IPv4 address' };
      if (/^\d{1,2}$/.test(m[2])) return +m[2] > 32 ? { err: 'Prefix must be 0–32' } : { ...a, p: +m[2] };
      const mk = parseMask(m[2]);
      if (!mk) return { err: 'Netmask is not valid: its one-bits must be contiguous (e.g. 255.255.240.0)' };
      return { ...a, p: mk.p, how: mk.wild ? `Wildcard mask ${m[2]} = /${mk.p}` : a.how };
    }
    const a = parseOne(s);
    return a ? { ...a, p: null } : { err: 'Not a valid IPv4 address' };
  }

  /* ---------- classification (IANA IPv4 special-purpose registry) ---------- */
  const SPECIAL = [
    ['0.0.0.0/8', '"This" network', 'warn', 'RFC 791, only valid as a source address while a host boots'],
    ['0.0.0.0/32', 'Unspecified', 'warn', '"This host": in a listening socket 0.0.0.0 means every interface'],
    ['10.0.0.0/8', 'Private', 'ok', 'RFC 1918, not routed on the internet'],
    ['100.64.0.0/10', 'Carrier-grade NAT', 'warn', 'RFC 6598, shared space between an ISP and its customers\' routers'],
    ['127.0.0.0/8', 'Loopback', 'warn', 'RFC 1122, this host (the whole /8, not only 127.0.0.1)'],
    ['169.254.0.0/16', 'Link-local (APIPA)', 'warn', 'RFC 3927, self-assigned when DHCP fails; never routed'],
    ['172.16.0.0/12', 'Private', 'ok', 'RFC 1918, not routed on the internet'],
    ['192.0.0.0/24', 'IETF protocol assignments', 'warn', 'RFC 6890'],
    ['192.0.0.0/29', 'DS-Lite', 'warn', 'RFC 7335, IPv4 service continuity prefix between B4 and AFTR'],
    ['192.0.0.8/32', 'IPv4 dummy address', 'warn', 'RFC 7600'],
    ['192.0.0.9/32', 'PCP anycast', 'warn', 'RFC 7723, Port Control Protocol'],
    ['192.0.0.10/32', 'TURN anycast', 'warn', 'RFC 8155'],
    ['192.0.0.170/31', 'NAT64 discovery', 'warn', 'RFC 7050, what ipv4only.arpa resolves to'],
    ['192.0.2.0/24', 'Documentation (TEST-NET-1)', 'warn', 'RFC 5737, for examples only, never routed'],
    ['192.31.196.0/24', 'AS112', 'warn', 'RFC 7535, sinks stray reverse DNS queries for private space'],
    ['192.52.193.0/24', 'AMT', 'warn', 'RFC 7450, automatic multicast tunneling'],
    ['192.88.99.0/24', '6to4 relay anycast (deprecated)', 'warn', 'RFC 7526'],
    ['192.168.0.0/16', 'Private', 'ok', 'RFC 1918, not routed on the internet'],
    ['192.175.48.0/24', 'AS112 direct delegation', 'warn', 'RFC 7534'],
    ['198.18.0.0/15', 'Benchmarking', 'warn', 'RFC 2544, for testing network devices only'],
    ['198.51.100.0/24', 'Documentation (TEST-NET-2)', 'warn', 'RFC 5737, for examples only, never routed'],
    ['203.0.113.0/24', 'Documentation (TEST-NET-3)', 'warn', 'RFC 5737, for examples only, never routed'],
    ['224.0.0.0/4', 'Multicast', 'ok', 'RFC 5771, one-to-many groups'],
    ['224.0.0.0/24', 'Multicast (local network control)', 'ok', 'Stays on the link, never forwarded by routers'],
    ['224.0.1.0/24', 'Multicast (internetwork control)', 'ok', 'Routable control traffic such as NTP'],
    ['232.0.0.0/8', 'Multicast (source-specific)', 'ok', 'RFC 4607, SSM'],
    ['233.0.0.0/8', 'Multicast (GLOP)', 'ok', 'RFC 3180, 233.<AS number>.x.x for each AS'],
    ['239.0.0.0/8', 'Multicast (administratively scoped)', 'ok', 'RFC 2365, the "private" multicast range'],
    ['240.0.0.0/4', 'Reserved (class E)', 'warn', 'Reserved for future use; most systems refuse to use it'],
    ['255.255.255.255/32', 'Limited broadcast', 'warn', 'RFC 919, every host on this link'],
  ].map(([c, name, cls, note]) => { const [a, p] = c.split('/'); return { n: parseDotted(a).n, p: +p, name, cls, note }; });
  const MC_GROUPS = { '224.0.0.1': 'All hosts', '224.0.0.2': 'All routers', '224.0.0.5': 'OSPF routers', '224.0.0.6': 'OSPF designated routers', '224.0.0.9': 'RIPv2 routers', '224.0.0.10': 'EIGRP routers', '224.0.0.13': 'PIM routers', '224.0.0.18': 'VRRP', '224.0.0.22': 'IGMPv3 reports', '224.0.0.102': 'HSRPv2 / GLBP', '224.0.0.251': 'mDNS', '224.0.0.252': 'LLMNR', '224.0.1.1': 'NTP', '239.255.255.250': 'SSDP / UPnP', '239.255.255.253': 'SLP' };
  const inNet = (n, net, p) => ((n ^ net) & maskOf(p)) === 0;
  function classify(n) {
    let best = null;
    for (const s of SPECIAL) if (inNet(n, s.n, s.p) && (!best || s.p > best.p)) best = s;
    if (!best) return { name: 'Public', cls: 'ok', note: 'Globally routable unicast address' };
    const g = MC_GROUPS[toIp(n)];
    return g ? { ...best, note: `${g} · ${best.note}` } : best;
  }
  const klass = (n) => { const a = n >>> 24; return a < 128 ? 'A' : a < 192 ? 'B' : a < 224 ? 'C' : a < 240 ? 'D (multicast)' : 'E (reserved)'; };

  /* ---------- 32 bit cells ---------- */
  const bitsEl = $('#bits');
  for (let o = 0; o < 4; o++) {
    const oc = document.createElement('div'); oc.className = 'octet';
    for (let k = 0; k < 8; k++) { const b = document.createElement('span'); b.className = 'bit'; b.style.setProperty('--b', o * 8 + k); oc.appendChild(b); }
    const v = document.createElement('span'); v.className = 'octet__val'; oc.appendChild(v);
    bitsEl.appendChild(oc);
  }
  const bitCells = Array.from(bitsEl.querySelectorAll('.bit')), octVals = Array.from(bitsEl.querySelectorAll('.octet__val'));
  let lastBits = '';

  function row(label, value, sub, opts = {}) {
    return `<div><dt>${label}</dt><dd>${esc(value)}${sub ? `<small>${sub}</small>` : ''}</dd>${opts.noCopy ? '<span></span>' : `<button class="copy" type="button" data-copy-val="${esc(value)}" aria-label="Copy ${esc(label)}"><i class="far fa-copy"></i></button>`}</div>`;
  }
  function reverseZone(net, p) {
    const o = octets(net);
    if (p === 0) return ['in-addr.arpa', 'The whole IPv4 reverse tree'];
    if (p % 8 === 0) return [o.slice(0, p / 8).reverse().join('.') + '.in-addr.arpa', 'Delegation name for this network'];
    if (p > 24) return [`${o[3]}-${p}.${o[2]}.${o[1]}.${o[0]}.in-addr.arpa`, `Classless delegation (RFC 2317) inside ${o[2]}.${o[1]}.${o[0]}.in-addr.arpa`];
    const q = Math.floor(p / 8), cnt = Math.pow(2, 8 - (p % 8)), first = o[q], last = first + cnt - 1;
    const tail = o.slice(0, q).reverse().join('.');
    const t = tail ? '.' + tail : '';
    return [`${first}${t}.in-addr.arpa`, `/${p} is not on an octet boundary: it needs ${cnt} zones, ${first}${t} … ${last}${t}.in-addr.arpa`];
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
    save();
    const n = r.n, p = r.p == null ? +prefixEl.value : r.p;
    prefixEl.value = p; prefixLabel.textContent = '/' + p;
    const mask = maskOf(p), net = (n & mask) >>> 0, wc = (~mask) >>> 0, bc = (net | wc) >>> 0;
    const first = p >= 31 ? net : net + 1, last = p >= 31 ? bc : bc - 1;
    const t = classify(n);
    state.className = 'status ok'; state.innerHTML = '<i class="fas fa-circle-check"></i>Valid IPv4';
    $('#typeChip').innerHTML = `<span class="tchip ${t.cls}">${esc(t.name)}</span>`;

    const zone = reverseZone(net, p);
    const nrows = [
      row('Network', `${toIp(net)}/${p}`, p === 32 ? 'A single host route' : p === 31 ? 'Point-to-point link (RFC 3021): both addresses are usable' : ''),
      row('Netmask', toIp(mask)),
      row('Wildcard', toIp(wc), 'Inverse mask, as used in Cisco ACLs and OSPF'),
      p >= 31 ? row('Broadcast', 'None', p === 31 ? 'A /31 has no broadcast address' : '', { noCopy: true }) : row('Broadcast', toIp(bc)),
      row('First host', toIp(first)),
      row('Last host', toIp(last)),
      row('Usable hosts', fmt(hosts(p))),
      row('Total addresses', fmt(sizeOf(p)), `2^${32 - p}`),
      row('Address position', `${fmt(n - net + 1)} of ${fmt(sizeOf(p))}`, n === net && p < 31 ? 'This is the network address itself' : n === bc && p < 31 ? 'This is the broadcast address' : '', { noCopy: true }),
      row('Reverse zone', zone[0], zone[1])
    ];
    $('#kvNet').innerHTML = nrows.join('');

    const o = octets(n), hx = n.toString(16).padStart(8, '0');
    const v6 = `${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`;
    const arows = [
      row('Address', toIp(n), r.how || (r.lead ? 'Leading zeros were read as decimal; some tools (ping, inet_aton) read 010 as octal 8' : '')),
      row('Type', t.name, t.note),
      row('Class', klass(n), 'Historic classful network, only meaningful for old protocols'),
      row('Integer', String(n)),
      row('Hex', '0x' + hx.toUpperCase(), o.map(x => x.toString(16).padStart(2, '0').toUpperCase()).join(':')),
      row('Binary', bin(n).replace(/(.{8})(?!$)/g, '$1.')),
      row('Octal', o.map(x => '0' + x.toString(8)).join('.'), 'Dotted octal, as inet_aton() reads it'),
      row('Reverse DNS', o.slice().reverse().join('.') + '.in-addr.arpa', 'PTR record name'),
      row('IPv4-mapped IPv6', '::ffff:' + toIp(n), '::ffff:' + v6),
      row('NAT64', '64:ff9b::' + v6, 'Well-known prefix 64:ff9b::/96 (RFC 6052), as DNS64 would synthesize it'),
      row('6to4 prefix', `2002:${hx.slice(0, 4).replace(/^0+(?=.)/, '')}:${hx.slice(4).replace(/^0+(?=.)/, '')}::/48`, 'Deprecated (RFC 7526), only worked for public addresses')
    ];
    if (o[0] >= 224 && o[0] < 240) arows.push(row('Multicast MAC', ['01', '00', '5e', o[1] & 0x7f, o[2], o[3]].map(x => typeof x === 'number' ? x.toString(16).padStart(2, '0') : x).join(':'), 'Ethernet group address: 01:00:5e + the low 23 bits'));
    $('#kvAddr').innerHTML = arows.join('');

    // bits
    const b = bin(n);
    bitCells.forEach((c, i) => {
      const bit = b[i];
      if (lastBits && lastBits[i] !== bit) { c.classList.add('flip'); setTimeout(() => c.classList.remove('flip'), 380); }
      c.textContent = bit;
      c.classList.toggle('net', i < p); c.classList.toggle('host', i >= p); c.classList.toggle('on', bit === '1');
    });
    octVals.forEach((v, i) => { v.textContent = o[i]; });
    lastBits = b;

    // split options
    cur = { net, p };
    const sel = $('#split'), want = +sel.dataset.prefix || 0, opts = [];
    for (let q = p + 1; q <= Math.min(32, p + 16); q++) opts.push(q);
    sel.innerHTML = opts.length ? opts.map(q => `<option value="${q}">/${q} (${fmt(Math.pow(2, q - p))} subnets)</option>`).join('') : '<option>Cannot split a /32</option>';
    sel.disabled = !opts.length;
    if (opts.includes(want) && want - p <= 8) sel.value = want; else if (opts.length) sel.value = opts[Math.min(1, opts.length - 1)];
    renderSplit();
    $$('#prefixBody tr').forEach(tr => tr.classList.toggle('cur', +tr.dataset.p === p));
  }

  let splitText = '';
  function renderSplit() {
    const sel = $('#split'), body = $('#splitBody'), info = $('#splitInfo');
    if (!cur) return;
    if (sel.disabled) { body.innerHTML = ''; info.textContent = 'A /32 is a single address and can\'t be split.'; splitText = ''; return; }
    const q = +sel.value, { net, p } = cur; sel.dataset.prefix = q;
    const count = Math.pow(2, q - p), size = sizeOf(q), show = Math.min(count, 256), txt = [];
    let html = '';
    for (let i = 0; i < show; i++) {
      const sn = net + i * size, bc = sn + size - 1, s = `${toIp(sn)}/${q}`;
      txt.push(s);
      html += `<tr><td>${i + 1}</td><td>${s}</td><td>${toIp(q >= 31 ? sn : sn + 1)}</td><td>${toIp(q >= 31 ? bc : bc - 1)}</td><td>${q >= 31 ? '—' : toIp(bc)}</td><td>${fmt(hosts(q))}</td></tr>`;
    }
    body.innerHTML = html;
    splitText = txt.join('\n');
    info.textContent = `${fmt(count)} subnets of /${q}, ${fmt(hosts(q))} usable hosts each.` + (count > show ? ` Showing the first ${show}.` : '');
  }

  /* ---------- lists: networks, ranges and addresses ---------- */
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  // one entry → [start, end] or { err }
  function parseSpan(s) {
    const m = s.match(/^(\S+)\s*-\s*(\S+)$/);
    if (m) {
      const a = parseOne(m[1]), b = parseOne(m[2]);
      if (!a || !b) return { err: 'invalid range' };
      return a.n <= b.n ? [a.n, b.n] : [b.n, a.n];
    }
    const r = parseInput(s);
    if (r.err) return { err: 'not an address, network or range' };
    if (r.p == null) return [r.n, r.n];
    const net = (r.n & maskOf(r.p)) >>> 0;
    return [net, net + sizeOf(r.p) - 1];
  }
  function mergeSpans(list) {
    const s = list.slice().sort((a, b) => a[0] - b[0]), out = [];
    for (const x of s) {
      const l = out[out.length - 1];
      if (l && x[0] <= l[1] + 1) l[1] = Math.max(l[1], x[1]); else out.push([x[0], x[1]]);
    }
    return out;
  }
  function subtract(inc, exc) {
    const out = [];
    for (const [a0, b] of inc) {
      let a = a0;
      for (const [c, d] of exc) {
        if (d < a || c > b) continue;
        if (c > a) out.push([a, c - 1]);
        a = d + 1;
        if (a > b) break;
      }
      if (a <= b) out.push([a, b]);
    }
    return out;
  }

  const MERGE_PRESETS = {
    wg: '# WireGuard AllowedIPs: route everything except local networks\n0.0.0.0/0\n!10.0.0.0/8\n!172.16.0.0/12\n!192.168.0.0/16\n!169.254.0.0/16\n!127.0.0.0/8',
    sum: '# Overlapping and adjacent networks collapse into the fewest blocks\n192.168.0.0/24\n192.168.1.0/24\n192.168.2.0/23\n192.168.1.128/25\n10.0.0.0/25, 10.0.0.128/25\n10.0.1.7',
    range: '# Any start - end range becomes the smallest CIDR list\n10.0.0.5 - 10.0.0.200\n172.16.0.0 - 172.31.255.255'
  };
  let mergeFmt = 'cidr', mergeText = '';
  function renderMerge() {
    const inc = [], exc = [], errs = [];
    let entries = 0;
    $('#mergeIn').value.split('\n').forEach((line, li) => {
      line.replace(/#.*/, '').split(',').forEach(raw => {
        let s = raw.trim();
        if (!s) return;
        const ex = s[0] === '!';
        if (ex) s = s.slice(1).trim();
        const r = parseSpan(s);
        if (r.err) { errs.push(`line ${li + 1}: "${s}" is ${r.err}`); return; }
        entries++;
        (ex ? exc : inc).push(r);
      });
    });
    const res = subtract(mergeSpans(inc), mergeSpans(exc));
    let blocks = [], total = 0;
    res.forEach(([a, b]) => { total += b - a + 1; blocks = blocks.concat(rangeToCidrs(a, b)); });
    const cidrs = blocks.map(c => `${toIp(c.n)}/${c.p}`);
    mergeText = mergeFmt === 'range' ? res.map(([a, b]) => a === b ? toIp(a) : `${toIp(a)} - ${toIp(b)}`).join('\n') : mergeFmt === 'comma' ? cidrs.join(', ') : cidrs.join('\n');
    $('#mergeOut').textContent = mergeText;
    $('#mergeIn').classList.toggle('is-bad', errs.length > 0);
    $('#mergeInfo').innerHTML = (entries ? `${entries} entr${entries === 1 ? 'y' : 'ies'}${exc.length ? ` (${exc.length} excluded)` : ''} → ${fmt(blocks.length)} CIDR block${blocks.length === 1 ? '' : 's'} in ${fmt(res.length)} range${res.length === 1 ? '' : 's'}, ${fmt(total)} addresses.` : 'Paste networks to merge them.')
      + (errs.length ? `<br><span style="color:var(--rose)">Skipped ${esc(errs.slice(0, 4).join('; '))}${errs.length > 4 ? ` and ${errs.length - 4} more` : ''}</span>` : '');
    save();
  }

  /* ---------- longest-prefix match ---------- */
  function renderLpm() {
    const nets = [];
    $('#lpmNets').value.split('\n').forEach(line => {
      const m = line.replace(/#.*/, '').trim().match(/^(\S+)\s*(.*)$/);
      if (!m) return;
      const r = parseInput(m[1]);
      if (r.err) return;
      const p = r.p == null ? 32 : r.p;
      nets.push({ net: (r.n & maskOf(p)) >>> 0, p, label: m[2].trim() });
    });
    const rows = [];
    $('#lpmAddrs').value.split(/[\n,]/).map(s => s.trim()).filter(Boolean).forEach(s => {
      const a = parseOne(s);
      if (!a) { rows.push(`<tr><td class="bad">${esc(s)}</td><td class="bad" colspan="3">Not a valid IPv4 address</td></tr>`); return; }
      const hits = nets.filter(x => inNet(a.n, x.net, x.p)).sort((x, y) => y.p - x.p);
      if (!hits.length) { rows.push(`<tr><td>${toIp(a.n)}</td><td class="dim" colspan="3">No match</td></tr>`); return; }
      const h = hits[0];
      rows.push(`<tr><td>${toIp(a.n)}</td><td>${toIp(h.net)}/${h.p}</td><td>${esc(h.label || '—')}</td><td class="dim">${hits.slice(1).map(x => `${toIp(x.net)}/${x.p}`).join(', ') || '—'}</td></tr>`);
    });
    $('#lpmBody').innerHTML = rows.join('');
    save();
  }

  /* ---------- VLSM planner ---------- */
  let vlsmText = '';
  function renderVlsm() {
    const body = $('#vlsmBody'), info = $('#vlsmInfo'), r = parseInput($('#vlsmNet').value);
    const base = r.err ? null : { net: (r.n & maskOf(r.p == null ? 32 : r.p)) >>> 0, p: r.p == null ? 32 : r.p };
    $('#vlsmNet').classList.toggle('is-bad', !base);
    save();
    if (!base) { body.innerHTML = ''; info.textContent = 'Enter the network to divide, e.g. 10.0.0.0/24.'; vlsmText = ''; return; }
    const use31 = $('#vlsm31').checked, reqs = [];
    $('#vlsmReq').value.split('\n').forEach((line, i) => {
      const m = line.trim().match(/^(.*?)[\s:=,]*(\d+)$/);
      if (!m) return;
      const h = +m[2];
      let p = 30;
      if (use31 && h <= 2) p = 31;
      else while (p > 0 && hosts(p) < h) p--;
      reqs.push({ name: m[1].trim() || `Subnet ${i + 1}`, h, p, i });
    });
    if (!reqs.length) { body.innerHTML = ''; info.textContent = 'Add one line per subnet: a name and how many hosts it needs.'; vlsmText = ''; return; }
    reqs.sort((a, b) => a.p - b.p || a.i - b.i);
    const end = base.net + sizeOf(base.p) - 1;
    let at = base.net, used = 0, html = '';
    const txt = ['Name\tHosts\tNetwork\tFirst\tLast\tBroadcast\tNetmask'];
    for (const q of reqs) {
      const size = sizeOf(q.p);
      if (at + size - 1 > end) {
        html += `<tr><td>${esc(q.name)}</td><td>${fmt(q.h)}</td><td class="bad" colspan="5">Does not fit: needs a /${q.p} (${fmt(size)} addresses), ${fmt(Math.max(0, end - at + 1))} left</td></tr>`;
        continue;
      }
      const bc = at + size - 1, f = q.p >= 31 ? at : at + 1, l = q.p >= 31 ? bc : bc - 1;
      html += `<tr><td>${esc(q.name)}</td><td>${fmt(q.h)}</td><td>${toIp(at)}/${q.p}</td><td>${toIp(f)} – ${toIp(l)}</td><td>${q.p >= 31 ? '—' : toIp(bc)}</td><td>${toIp(maskOf(q.p))}</td><td class="dim">${fmt(hosts(q.p) - q.h)}</td></tr>`;
      txt.push([q.name, q.h, `${toIp(at)}/${q.p}`, toIp(f), toIp(l), q.p >= 31 ? '-' : toIp(bc), toIp(maskOf(q.p))].join('\t'));
      used += size; at += size;
    }
    body.innerHTML = html;
    const free = at <= end ? rangeToCidrs(at, end).map(c => `${toIp(c.n)}/${c.p}`) : [];
    info.textContent = `${toIp(base.net)}/${base.p}: ${fmt(used)} of ${fmt(sizeOf(base.p))} addresses allocated (${Math.round(used / sizeOf(base.p) * 100)}%).` + (free.length ? ` Still free: ${free.slice(0, 6).join(', ')}${free.length > 6 ? ' …' : ''}` : '');
    vlsmText = txt.join('\n');
  }

  /* ---------- prefix cheat sheet ---------- */
  const SIZE_NOTE = { 8: 'old class A', 16: 'old class B', 24: 'old class C, typical LAN', 30: 'point-to-point (classic)', 31: 'point-to-point (RFC 3021)', 32: 'single host' };
  $('#prefixBody').innerHTML = Array.from({ length: 33 }, (_, p) => `<tr data-p="${p}"><td>/${p}</td><td>${toIp(maskOf(p))}</td><td>${toIp((~maskOf(p)) >>> 0)}</td><td>${fmt(sizeOf(p))}</td><td>${fmt(hosts(p))}</td><td class="dim">${p >= 8 && p < 24 ? fmt(Math.pow(2, 24 - p)) + ' × /24' : p > 24 ? `1/${Math.pow(2, p - 24)} of a /24` : ''}${SIZE_NOTE[p] ? (p >= 8 && p < 24 || p > 24 ? ' · ' : '') + SIZE_NOTE[p] : ''}</td></tr>`).join('');

  /* ---------- storage ---------- */
  let loaded = false;
  function save() {
    if (!loaded) return;
    try { localStorage.setItem(KEY, JSON.stringify({ ip: ipEl.value, merge: $('#mergeIn').value, fmt: mergeFmt, nets: $('#lpmNets').value, addrs: $('#lpmAddrs').value, vnet: $('#vlsmNet').value, vreq: $('#vlsmReq').value, v31: $('#vlsm31').checked })); } catch (e) {}
  }

  /* ---------- events ---------- */
  const copy = (text, msg) => { if (text && window.Site) Site.copy(text, msg); };
  ipEl.addEventListener('input', render);
  prefixEl.addEventListener('input', () => {
    const r = parseInput(ipEl.value);
    ipEl.value = `${r.err ? ipEl.value.trim().split(/[\s/]/)[0] : toIp(r.n)}/${prefixEl.value}`; render();
  });
  $('#split').addEventListener('change', renderSplit);
  $('#copySplit').addEventListener('click', () => copy(splitText, `Copied ${splitText.split('\n').length} subnets`));
  $('#presets').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b) { ipEl.value = b.dataset.v; render(); } });
  $('#prefixBody').addEventListener('click', e => {
    const tr = e.target.closest('tr[data-p]');
    if (!tr) return;
    const r = parseInput(ipEl.value);
    ipEl.value = `${r.err ? '192.168.1.10' : toIp(r.n)}/${tr.dataset.p}`; render();
    $('#overview').scrollIntoView({ behavior: window.Site && Site.reduceMotion ? 'auto' : 'smooth' });
  });
  $('#mergeIn').addEventListener('input', renderMerge);
  $('#mergePresets').addEventListener('click', e => { const b = e.target.closest('[data-merge]'); if (b) { $('#mergeIn').value = MERGE_PRESETS[b.dataset.merge]; if (b.dataset.merge === 'wg') setFmt('comma'); renderMerge(); } });
  function setFmt(f) { mergeFmt = f; $$('#mergeFmt button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.fmt === f))); }
  $('#mergeFmt').addEventListener('click', e => { const b = e.target.closest('[data-fmt]'); if (b) { setFmt(b.dataset.fmt); renderMerge(); } });
  $('#copyMerge').addEventListener('click', () => copy(mergeText, 'Copied result'));
  ['#lpmNets', '#lpmAddrs'].forEach(s => $(s).addEventListener('input', renderLpm));
  ['#vlsmNet', '#vlsmReq'].forEach(s => $(s).addEventListener('input', renderVlsm));
  $('#vlsm31').addEventListener('change', renderVlsm);
  $('#copyVlsm').addEventListener('click', () => copy(vlsmText, 'Copied subnet plan'));
  document.addEventListener('click', e => { const c = e.target.closest('[data-copy-val]'); if (c) copy(c.dataset.copyVal, 'Copied ' + (c.dataset.copyVal.length > 48 ? c.dataset.copyVal.slice(0, 45) + '…' : c.dataset.copyVal)); });

  $('#mergeIn').value = MERGE_PRESETS.sum;
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s) {
      if (s.ip) ipEl.value = s.ip;
      if (s.merge != null) $('#mergeIn').value = s.merge;
      if (s.fmt) setFmt(s.fmt);
      if (s.nets != null) $('#lpmNets').value = s.nets;
      if (s.addrs != null) $('#lpmAddrs').value = s.addrs;
      if (s.vnet) $('#vlsmNet').value = s.vnet;
      if (s.vreq != null) $('#vlsmReq').value = s.vreq;
      $('#vlsm31').checked = !!s.v31;
    }
  } catch (e) {}
  // links from the old subnet calculator can carry the address in the hash: tools/ipv4/#10.0.0.0/8
  if (location.hash.length > 1) { try { const h = decodeURIComponent(location.hash.slice(1)); if (!parseInput(h).err) ipEl.value = h; } catch (e) {} }
  render(); renderMerge(); renderLpm(); renderVlsm();
  loaded = true;
})();
