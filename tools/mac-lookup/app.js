/* MAC address lookup: vendor from the IEEE registries (oui.js, loaded on demand), address type, notations, bulk + reverse search */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const macEl = $('#mac'), state = $('#state');
  const VER = (document.currentScript && document.currentScript.src.split('?')[1]) || '';

  // ---------- vendor database ----------
  let db = null;   // { maps: {6, 7, 9: Map(prefix → vendor index)}, v: [names], date }
  function index(d) {
    const maps = {};
    [['l', 6], ['m', 7], ['s', 9]].forEach(([k, n]) => {
      const m = new Map();
      d[k].split(',').forEach(e => m.set(e.slice(0, n), parseInt(e.slice(n), 36)));
      maps[n] = m;
    });
    // 24-bit prefixes the IEEE hands out in smaller pieces (MA-M / MA-S) to many companies
    const split = new Set([...maps[7].keys(), ...maps[9].keys()].map(k => k.slice(0, 6)));
    return { maps, split, v: d.v, date: d.date };
  }
  function loadDb() {
    return new Promise((res, rej) => {
      if (window.OUI_DATA) return res(index(window.OUI_DATA));
      const s = document.createElement('script');
      s.src = 'oui.js' + (VER ? '?' + VER : '');
      s.onload = () => (window.OUI_DATA ? res(index(window.OUI_DATA)) : rej());
      s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  // longest registered block wins: MA-S (36 bit) → MA-M (28 bit) → MA-L (24 bit)
  function vendorOf(hex) {
    if (!db) return null;
    for (const n of [9, 7, 6]) {
      if (hex.length < n) continue;
      const i = db.maps[n].get(hex.slice(0, n));
      if (i != null) return { name: db.v[i], digits: n };
    }
    return null;
  }
  const BLOCK = { 6: ['/24', 'MA-L', '16.7 million addresses'], 7: ['/28', 'MA-M', '1 million addresses'], 9: ['/36', 'MA-S', '4,096 addresses'] };

  // ---------- parsing and notations ----------
  function parse(s) {
    const raw = s.trim();
    if (!raw) return { err: 'Type a MAC address' };
    const hex = raw.replace(/[\s:.\-]/g, '').toUpperCase();
    if (!/^[0-9A-F]+$/.test(hex)) return { err: 'Only hex digits (0–9, A–F) and : - . separators' };
    if (hex.length < 6) return { err: 'Need at least 6 hex digits (the vendor prefix)' };
    if (hex.length > 12) return { err: 'Too long: a MAC address has 12 hex digits' };
    return { hex, full: hex.length === 12 };
  }
  const pairs = (hex) => hex.match(/.{1,2}/g);
  const prefixText = (hex, digits) => pairs(hex.slice(0, digits)).join(':') + BLOCK[digits][0];
  function eui64(hex) {
    const b = pairs(hex).map(x => parseInt(x, 16));
    b[0] ^= 2;   // flip the universal/local bit
    const e = [b[0], b[1], b[2], 0xff, 0xfe, b[3], b[4], b[5]].map(x => x.toString(16).padStart(2, '0'));
    return e;
  }
  function linkLocal(hex) {
    const e = eui64(hex), g = [];
    for (let i = 0; i < 8; i += 2) g.push(parseInt(e[i] + e[i + 1], 16).toString(16));
    return 'fe80::' + g.join(':');
  }

  // well-known and protocol addresses (checked before the vendor list)
  function special(hex) {
    const b = (i) => parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (hex.length < 12) return null;
    if (hex === 'FFFFFFFFFFFF') return 'Broadcast: every device on the network segment receives it';
    if (hex === '000000000000') return 'Null address: unset or placeholder';
    if (/^01005E/.test(hex) && b(3) < 128) return `IPv4 multicast for 224.${b(3)}.${b(4)}.${b(5)}${hex === '01005E0000FB' ? ' (mDNS / Bonjour)' : ''} (and 31 other groups sharing the low 23 bits)`;
    if (/^3333/.test(hex)) { const hi = (b(2) << 8 | b(3)).toString(16), lo = (b(4) << 8 | b(5)).toString(16); return `IPv6 multicast for ff02::${hi === '0' ? lo : hi + ':' + lo}${hex === '333300000001' ? ' (all nodes)' : ''} (last 32 bits of the group address)`; }
    if (hex === '0180C2000000') return 'Spanning Tree (STP / RSTP) bridge group address';
    if (hex === '0180C200000E') return 'LLDP (Link Layer Discovery Protocol)';
    if (hex === '0180C2000002') return 'Slow protocols: LACP link aggregation, OAM';
    if (hex === '0180C2000003') return '802.1X port authentication (EAPOL)';
    if (/^0180C200000/.test(hex)) return 'IEEE 802.1 reserved link-local address: switches don\'t forward it';
    if (hex === '01000CCCCCCC') return 'Cisco CDP / VTP / DTP / PAgP';
    if (hex === '01000CCCCCCD') return 'Cisco PVST+ (per-VLAN spanning tree)';
    if (/^00005E0001/.test(hex)) return `VRRP virtual router (IPv4), router ID ${b(5)}`;
    if (/^00005E0002/.test(hex)) return `VRRP virtual router (IPv6), router ID ${b(5)}`;
    if (/^00000C07AC/.test(hex)) return `Cisco HSRP v1 virtual router, group ${b(5)}`;
    if (/^00000C9FF/.test(hex)) return `Cisco HSRP v2 virtual router, group ${parseInt(hex.slice(9), 16)}`;
    if (/^0242/.test(hex)) return `Docker container (older Docker derives it from the IP: ${b(2)}.${b(3)}.${b(4)}.${b(5)})`;
    if (/^525400/.test(hex)) return 'QEMU / KVM virtual network card (libvirt default)';
    return null;
  }

  // ---------- main lookup ----------
  function row(label, value, copy = true) {
    return `<div><dt>${label}</dt><dd>${value}</dd>${copy ? `<button class="copy" type="button" data-copy-val="${esc(String(value).replace(/<[^>]+>/g, ''))}" aria-label="Copy ${label}"><i class="far fa-copy"></i></button>` : '<span></span>'}</div>`;
  }
  let lastName = '';
  function render() {
    const r = parse(macEl.value);
    syncUrl(r.err ? '' : macEl.value.trim());
    if (r.err) {
      macEl.classList.add('is-bad'); state.className = 'status err'; state.textContent = r.err;
      $('#vName').textContent = '–'; $('#vSub').textContent = ''; $('#vIcon').className = 'vend__icon muted'; lastName = '';
      $('#hex').querySelectorAll('.hx').forEach(c => { c.className = 'hx'; c.textContent = '·'; });
      return;
    }
    macEl.classList.remove('is-bad');
    const { hex, full } = r;
    const o1 = parseInt(hex.slice(0, 2), 16), multicast = !!(o1 & 1), local = !!(o1 & 2);
    const sp = special(hex), v = vendorOf(hex);
    const bcast = hex === 'FFFFFFFFFFFF';

    // headline
    let name, sub, icon = '', ic = 'fas fa-industry';
    if (!db && !sp) { name = 'Loading vendor list…'; sub = ''; ic = 'fas fa-spinner fa-spin'; icon = 'muted'; }
    else if (sp) { name = sp.split(/: | \(/)[0]; sub = sp + (v ? ` · prefix registered to ${v.name}` : ''); ic = 'fas fa-tower-broadcast'; icon = 'warn'; }
    else if (v) { name = v.name; sub = `${BLOCK[v.digits][1]} block ${prefixText(hex, v.digits)} · ${BLOCK[v.digits][2]}` + (local ? ' · a registered Company ID (CID) in the locally administered range' : ''); }
    else if (local) { name = 'Randomized / locally administered'; sub = 'Set by software, not burned in at the factory, so it has no vendor. Typical for phones and laptops with private Wi-Fi addresses, VMs and containers.'; ic = 'fas fa-dice'; icon = 'warn'; }
    else if (db.split.has(hex.slice(0, 6)) && hex.length < 9) { name = 'Shared prefix'; sub = 'The IEEE splits this prefix into smaller MA-M / MA-S blocks for many companies. Type more digits to find the owner.'; ic = 'fas fa-layer-group'; icon = 'muted'; }
    else { name = 'Unknown vendor'; sub = `This prefix isn't in the IEEE registries (unassigned, or assigned after ${db.date}).`; ic = 'fas fa-circle-question'; icon = 'muted'; }
    if (v && !sp && db.split.has(hex.slice(0, 6)) && hex.length < 9) sub = 'This prefix is split into smaller MA-M / MA-S blocks. Type more digits to find the owner.';
    const nameEl = $('#vName');
    nameEl.textContent = name; $('#vSub').textContent = sub;
    $('#vIcon').className = 'vend__icon ' + icon; $('#vIcon').innerHTML = `<i class="${ic}"></i>`;
    if (name !== lastName && db) { nameEl.classList.remove('pop'); void nameEl.offsetWidth; nameEl.classList.add('pop'); }
    lastName = name;

    state.className = 'status ' + (multicast || (local && !v) ? 'warn' : v ? 'ok' : '');
    state.innerHTML = bcast ? '<i class="fas fa-tower-broadcast"></i>Broadcast' : multicast ? '<i class="fas fa-tower-broadcast"></i>Multicast' : local && !v ? '<i class="fas fa-dice"></i>Locally administered' : `<i class="fas fa-circle-check"></i>${full ? 'Unicast' : 'Prefix only'}`;

    // hex cells: vendor part in blue, device part in amber
    const pre = v ? v.digits : 6;
    let cells = '';
    for (let o = 0; o < 6; o++) {
      cells += '<span class="oc">';
      for (let k = 0; k < 2; k++) { const i = o * 2 + k, c = hex[i]; cells += `<span class="hx ${c == null ? '' : i < pre ? 'net' : 'host'}" style="--i:${i}">${c || '·'}</span>`; }
      cells += '</span>';
    }
    $('#hex').innerHTML = cells;

    // first octet: the two flag bits
    const bits = o1.toString(2).padStart(8, '0');
    $('#oct1').innerHTML = `<div class="oct1__bits">${bits.split('').map((x, i) => `<span class="ob${i >= 6 ? ' flag' + (x === '1' ? ' on' : '') : ''}">${x}${i === 6 ? '<b>U/L</b>' : i === 7 ? '<b>I/G</b>' : ''}</span>`).join('')}</div>
      <div class="oct1__txt"><span>First byte <b>${hex.slice(0, 2)}</b> in binary.</span>
      <span><b>I/G</b> = ${multicast ? '1: group address (multicast/broadcast)' : '0: individual address (unicast)'}</span>
      <span><b>U/L</b> = ${local ? '1: locally administered (set by software)' : '0: universally administered (assigned by the vendor)'}</span></div>`;

    // details
    const info = [];
    info.push(row('Vendor', esc(v ? v.name : local ? 'none (locally administered)' : db ? 'unknown' : '…')));
    if (v) info.push(row('Vendor prefix', esc(prefixText(hex, v.digits) + ' (' + BLOCK[v.digits][1] + ')')));
    if (full && v) info.push(row('Device part', esc(pairs(hex).join(':').slice(v.digits + Math.floor(v.digits / 2)))));
    info.push(row('Type', bcast ? 'Broadcast' : multicast ? 'Multicast (group)' : 'Unicast (one device)', false));
    info.push(row('Administered', local ? 'Locally (software)' : 'Universally (vendor)', false));
    if (sp) info.push(row('Special', esc(sp), false));
    if (db) info.push(row('Data', `IEEE registries, ${esc(db.date)}`, false));
    $('#kvInfo').innerHTML = info.join('');

    // notations
    if (full) {
      const p = pairs(hex), lo = hex.toLowerCase();
      $('#kvFmt').innerHTML = [
        row('Linux / macOS', p.join(':').toLowerCase()), row('Windows', p.join('-')), row('Cisco', lo.match(/.{4}/g).join('.')),
        row('Plain', hex), row('EUI-64', eui64(hex).join(':')), row('IPv6 link-local', linkLocal(hex))
      ].join('');
    } else {
      $('#kvFmt').innerHTML = `<p class="hint">Type all 12 hex digits to see the address in every notation, as EUI-64 and as an IPv6 link-local address.</p>`;
    }
  }

  function syncUrl(v) {
    const u = new URL(location.href);
    if (v) u.searchParams.set('mac', v); else u.searchParams.delete('mac');
    history.replaceState(history.state, '', u.pathname + u.search + u.hash);
  }

  // ---------- bulk lookup ----------
  const MAC_RE = /(?<![0-9a-f:.-])([0-9a-f]{1,2}(?::[0-9a-f]{1,2}){5}|[0-9a-f]{2}(?:-[0-9a-f]{2}){5}|[0-9a-f]{4}\.[0-9a-f]{4}\.[0-9a-f]{4})(?![0-9a-f:.-])/gi;
  const IP_RE = /\b(?:\d{1,3}\.){3}\d{1,3}\b/;
  let bulkRows = [];
  function bulk() {
    const text = $('#bulk').value, seen = new Set();
    bulkRows = [];
    text.split('\n').forEach(line => {
      const ip = (line.match(IP_RE) || [''])[0];
      for (const m of line.matchAll(MAC_RE)) {
        // macOS arp drops leading zeros (0:1b:...): pad every part
        const hex = (m[1].includes('.') ? m[1].replace(/\./g, '') : m[1].split(/[:-]/).map(x => x.padStart(2, '0')).join('')).toUpperCase();
        if (seen.has(hex)) continue;
        seen.add(hex);
        const o1 = parseInt(hex.slice(0, 2), 16), local = !!(o1 & 2), sp = special(hex), v = vendorOf(hex);
        bulkRows.push({ ip, mac: pairs(hex).join(':'), vendor: v ? v.name : '', note: sp || (local && !v ? 'Randomized / locally administered' : o1 & 1 ? 'Multicast' : v ? '' : 'Unknown prefix') });
      }
    });
    $('#bulkWrap').hidden = !bulkRows.length; $('#csv').disabled = !bulkRows.length;
    $('#bulkBody').innerHTML = bulkRows.map(r => `<tr data-mac="${r.mac}"><td>${esc(r.ip || '–')}</td><td>${r.mac}</td><td>${esc(r.vendor || '–')}</td><td>${esc(r.note)}</td></tr>`).join('');
    const vendors = new Set(bulkRows.map(r => r.vendor).filter(Boolean)).size, rnd = bulkRows.filter(r => /Randomized/.test(r.note)).length;
    $('#bulkInfo').textContent = bulkRows.length ? `${bulkRows.length} address${bulkRows.length === 1 ? '' : 'es'} · ${vendors} vendor${vendors === 1 ? '' : 's'}${rnd ? ` · ${rnd} randomized` : ''}` : text.trim() ? 'No MAC addresses found' : '';
  }
  $('#bulk').addEventListener('input', bulk);
  $('#csv').addEventListener('click', () => {
    const q = (s) => /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    const csv = ['IP,MAC,Vendor,Note'].concat(bulkRows.map(r => [r.ip, r.mac, r.vendor, r.note].map(q).join(','))).join('\n');
    window.Site && Site.copy(csv, `Copied ${bulkRows.length} rows as CSV`);
  });

  // ---------- vendor → prefixes ----------
  function find() {
    const q = $('#find').value.trim().toLowerCase(), body = $('#findBody'), info = $('#findInfo');
    if (q.length < 2 || !db) { $('#findWrap').hidden = true; info.textContent = q.length && !db ? 'Loading…' : ''; return; }
    const hit = new Set();
    db.v.forEach((n, i) => { if (n.toLowerCase().includes(q)) hit.add(i); });
    const rows = [];
    [6, 7, 9].forEach(n => db.maps[n].forEach((i, p) => { if (hit.has(i)) rows.push([p, n, db.v[i]]); }));
    rows.sort((a, b) => a[2].localeCompare(b[2]) || (a[0] < b[0] ? -1 : 1));
    const show = rows.slice(0, 300);
    body.innerHTML = show.map(([p, n, name]) => `<tr data-mac="${p}"><td>${pairs(p).join(':')}</td><td>${BLOCK[n][0]} ${BLOCK[n][1]}</td><td>${esc(name)}</td></tr>`).join('');
    $('#findWrap').hidden = !rows.length;
    info.textContent = rows.length ? `${rows.length.toLocaleString('en')} prefix${rows.length === 1 ? '' : 'es'} from ${hit.size} vendor name${hit.size === 1 ? '' : 's'}${rows.length > show.length ? ` · showing ${show.length}` : ''}` : 'No vendor matches';
  }
  let findT = 0;
  $('#find').addEventListener('input', () => { clearTimeout(findT); findT = setTimeout(find, 120); });

  // a row in either table fills the main lookup
  document.addEventListener('click', e => {
    const tr = e.target.closest('tr[data-mac]');
    if (tr) { macEl.value = tr.dataset.mac.length === 12 ? pairs(tr.dataset.mac).join(':') : tr.dataset.mac.replace(/:/g, '').match(/.{1,2}/g).join(':'); render(); window.scrollTo({ top: macEl.getBoundingClientRect().top + scrollY - 120, behavior: 'smooth' }); return; }
    const c = e.target.closest('[data-copy-val]'); if (c && window.Site) Site.copy(c.dataset.copyVal, 'Copied ' + c.dataset.copyVal);
  });
  macEl.addEventListener('input', render);
  $('#presets').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b) { macEl.value = b.dataset.v; render(); } });

  const fromUrl = new URL(location.href).searchParams.get('mac');
  if (fromUrl) macEl.value = fromUrl;
  render();
  loadDb().then(d => { db = d; render(); bulk(); find(); })
    .catch(() => { state.className = 'status err'; state.textContent = 'Couldn\'t load the vendor list'; });
})();
