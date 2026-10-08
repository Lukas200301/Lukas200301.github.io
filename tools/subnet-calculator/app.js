/* Subnet calculator: IPv4 maths with unsigned 32-bit integers */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const ipEl = $('#ip'), prefixEl = $('#prefix'), prefixLabel = $('#prefixLabel'), state = $('#state');
  const toInt = (o) => ((o[0] << 24) | (o[1] << 16) | (o[2] << 8) | o[3]) >>> 0;
  const toIp = (n) => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
  const maskOf = (p) => (p === 0 ? 0 : (0xffffffff << (32 - p)) >>> 0);
  const bin = (n) => n.toString(2).padStart(32, '0');
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function parseIp(s) {
    const m = s.trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!m) return null;
    const o = m.slice(1).map(Number);
    return o.every(x => x >= 0 && x <= 255) ? o : null;
  }
  function maskToPrefix(o) {
    const n = toInt(o), b = bin(n);
    if (!/^1*0*$/.test(b)) return null;            // must be contiguous ones
    return b.indexOf('0') === -1 ? 32 : b.indexOf('0');
  }
  function parse(input) {
    const s = input.trim();
    let m = s.match(/^(\S+)\s*\/\s*(\d{1,2})$/);
    if (m) { const ip = parseIp(m[1]), p = +m[2]; return ip && p <= 32 ? { ip, p } : { err: p > 32 ? 'Prefix must be 0–32' : 'Not a valid IPv4 address' }; }
    m = s.match(/^(\S+)\s+(\S+)$/);
    if (m) {
      const ip = parseIp(m[1]), mk = parseIp(m[2]);
      if (!ip) return { err: 'Not a valid IPv4 address' };
      if (!mk) return { err: 'Netmask is not valid' };
      const p = maskToPrefix(mk);
      return p == null ? { err: 'Netmask bits must be contiguous (e.g. 255.255.240.0)' } : { ip, p };
    }
    const ip = parseIp(s);
    return ip ? { ip, p: +prefixEl.value } : { err: 'Not a valid IPv4 address' };
  }

  function kind(n) {
    const a = n >>> 24, b = (n >>> 16) & 255;
    if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return ['Private (RFC 1918)', 'ok'];
    if (a === 127) return ['Loopback', 'warn'];
    if (a === 169 && b === 254) return ['Link-local (APIPA)', 'warn'];
    if (a === 100 && b >= 64 && b <= 127) return ['Carrier-grade NAT (RFC 6598)', 'warn'];
    if (a >= 224 && a <= 239) return ['Multicast', 'warn'];
    if (a >= 240) return ['Reserved', 'warn'];
    if (a === 0) return ['"This" network', 'warn'];
    return ['Public', 'ok'];
  }
  const cls = (n) => { const a = n >>> 24; return a < 128 ? 'A' : a < 192 ? 'B' : a < 224 ? 'C' : a < 240 ? 'D (multicast)' : 'E (reserved)'; };

  function hosts(p) { return p === 32 ? 1 : p === 31 ? 2 : Math.pow(2, 32 - p) - 2; }
  function range(net, p) {
    const size = Math.pow(2, 32 - p), bc = (net + size - 1) >>> 0;
    if (p >= 31) return { first: net, last: bc, bc };
    return { first: (net + 1) >>> 0, last: (bc - 1) >>> 0, bc };
  }

  // 32 animated bit cells
  const bitsEl = $('#bits');
  for (let o = 0; o < 4; o++) {
    const oc = document.createElement('div'); oc.className = 'octet';
    for (let k = 0; k < 8; k++) { const b = document.createElement('span'); b.className = 'bit'; b.style.setProperty('--b', o * 8 + k); oc.appendChild(b); }
    const v = document.createElement('span'); v.className = 'octet__val'; oc.appendChild(v);
    bitsEl.appendChild(oc);
  }
  const bitCells = Array.from(bitsEl.querySelectorAll('.bit')), octVals = Array.from(bitsEl.querySelectorAll('.octet__val'));
  let lastBits = '';

  function row(label, value) {
    return `<div><dt>${label}</dt><dd>${esc(value)}</dd><button class="copy" type="button" data-copy-val="${esc(value)}" aria-label="Copy ${label}"><i class="far fa-copy"></i></button></div>`;
  }

  function render() {
    const r = parse(ipEl.value);
    if (r.err) {
      ipEl.classList.add('is-bad'); state.className = 'status err'; state.textContent = r.err; return;
    }
    ipEl.classList.remove('is-bad');
    const { ip, p } = r;
    prefixEl.value = p; prefixLabel.textContent = '/' + p;
    const n = toInt(ip), mask = maskOf(p), net = (n & mask) >>> 0, wc = (~mask) >>> 0;
    const { first, last, bc } = range(net, p);
    const [k, kc] = kind(n);
    state.className = 'status ' + kc; state.innerHTML = `<i class="fas fa-circle-check"></i>${esc(k)}`;

    $('#kvNet').innerHTML = [
      row('Address', toIp(n)), row('Network', `${toIp(net)}/${p}`), row('Broadcast', toIp(bc)),
      row('First host', toIp(first)), row('Last host', toIp(last)),
      row('Usable hosts', hosts(p).toLocaleString('en')), row('Total addresses', Math.pow(2, 32 - p).toLocaleString('en')),
      row('Class', cls(n)), row('Type', k)
    ].join('');
    const rev = toIp(n).split('.').reverse().join('.') + '.in-addr.arpa';
    $('#kvMask').innerHTML = [
      row('Netmask', toIp(mask)), row('Wildcard', toIp(wc)), row('CIDR', '/' + p),
      row('Binary address', bin(n).replace(/(.{8})(?!$)/g, '$1.')), row('Binary mask', bin(mask).replace(/(.{8})(?!$)/g, '$1.')),
      row('Hex', '0x' + n.toString(16).padStart(8, '0').toUpperCase()), row('Integer', String(n)), row('Reverse DNS', rev)
    ].join('');

    // bits
    const b = bin(n);
    bitCells.forEach((c, i) => {
      const bit = b[i];
      if (lastBits && lastBits[i] !== bit) { c.classList.add('flip'); setTimeout(() => c.classList.remove('flip'), 380); }
      c.textContent = bit;
      c.classList.toggle('net', i < p); c.classList.toggle('host', i >= p); c.classList.toggle('on', bit === '1');
    });
    octVals.forEach((v, i) => { v.textContent = ip[i]; });
    lastBits = b;

    // split options
    const sel = $('#split'), cur = +sel.dataset.prefix || 0;
    const opts = [];
    for (let q = p + 1; q <= Math.min(32, p + 10); q++) opts.push(q);
    sel.innerHTML = opts.length ? opts.map(q => `<option value="${q}">/${q} (${Math.pow(2, q - p).toLocaleString('en')} subnets)</option>`).join('') : '<option>Cannot split a /32</option>';
    sel.disabled = !opts.length;
    if (opts.includes(cur)) sel.value = cur; else if (opts.length) sel.value = opts[Math.min(1, opts.length - 1)];
    renderSplit(net, p);
  }

  function renderSplit(net, p) {
    const sel = $('#split'), body = $('#splitBody'), info = $('#splitInfo');
    if (sel.disabled) { body.innerHTML = ''; info.textContent = 'A /32 is a single address and can\'t be split.'; return; }
    const q = +sel.value; sel.dataset.prefix = q;
    const count = Math.pow(2, q - p), size = Math.pow(2, 32 - q), show = Math.min(count, 256);
    let html = '';
    for (let i = 0; i < show; i++) {
      const sn = (net + i * size) >>> 0, rg = range(sn, q);
      html += `<tr><td>${i + 1}</td><td>${toIp(sn)}/${q}</td><td>${toIp(rg.first)}</td><td>${toIp(rg.last)}</td><td>${toIp(rg.bc)}</td><td>${hosts(q).toLocaleString('en')}</td></tr>`;
    }
    body.innerHTML = html;
    info.textContent = `${count.toLocaleString('en')} subnets of /${q}, ${hosts(q).toLocaleString('en')} usable hosts each.` + (count > show ? ` Showing the first ${show}.` : '');
  }

  ipEl.addEventListener('input', render);
  prefixEl.addEventListener('input', () => {
    const v = ipEl.value.trim().split(/[\s/]/)[0];
    ipEl.value = `${v}/${prefixEl.value}`; render();
  });
  $('#split').addEventListener('change', () => { const r = parse(ipEl.value); if (!r.err) renderSplit((toInt(r.ip) & maskOf(r.p)) >>> 0, r.p); });
  $('#presets').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b) { ipEl.value = b.dataset.v; render(); } });
  document.addEventListener('click', e => { const c = e.target.closest('[data-copy-val]'); if (c && window.Site) Site.copy(c.dataset.copyVal, 'Copied ' + c.dataset.copyVal); });
  render();
})();
