/* Unit converter: data sizes (SI vs IEC), data rates, transfer times, time, temperature, length, mass */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const KEY = 'uc-v1';

  // every unit is [symbol, name, factor to the base unit]; temperature uses functions instead
  const CATS = {
    data: {
      title: 'Data size', icon: 'fas fa-hard-drive', start: ['TB', '1'],
      groups: [
        ['Decimal (SI) · drive makers, macOS', [['B', 'byte', 1], ['kB', 'kilobyte', 1e3], ['MB', 'megabyte', 1e6], ['GB', 'gigabyte', 1e9], ['TB', 'terabyte', 1e12], ['PB', 'petabyte', 1e15]]],
        ['Binary (IEC) · Windows, RAM', [['KiB', 'kibibyte', 1024], ['MiB', 'mebibyte', 1024 ** 2], ['GiB', 'gibibyte', 1024 ** 3], ['TiB', 'tebibyte', 1024 ** 4], ['PiB', 'pebibyte', 1024 ** 5]]],
        ['Bits', [['bit', 'bit', 1 / 8], ['kbit', 'kilobit', 1e3 / 8], ['Mbit', 'megabit', 1e6 / 8], ['Gbit', 'gigabit', 1e9 / 8]]]
      ],
      presets: [['4.7 GB DVD', 'GB', '4.7'], ['1 TB drive', 'TB', '1'], ['16 GiB RAM', 'GiB', '16'], ['1.44 MB floppy', 'KiB', '1440']]
    },
    rate: {
      title: 'Data rate', icon: 'fas fa-gauge-high', start: ['Mbit/s', '100'],
      groups: [
        ['Bits per second · ISPs, network cards', [['bit/s', 'bits per second', 1 / 8], ['kbit/s', 'kilobits/s', 1e3 / 8], ['Mbit/s', 'megabits/s', 1e6 / 8], ['Gbit/s', 'gigabits/s', 1e9 / 8], ['Tbit/s', 'terabits/s', 1e12 / 8]]],
        ['Bytes per second · download dialogs', [['B/s', 'bytes/s', 1], ['kB/s', 'kilobytes/s', 1e3], ['MB/s', 'megabytes/s', 1e6], ['GB/s', 'gigabytes/s', 1e9]]],
        ['Binary bytes per second', [['KiB/s', 'kibibytes/s', 1024], ['MiB/s', 'mebibytes/s', 1024 ** 2], ['GiB/s', 'gibibytes/s', 1024 ** 3]]]
      ],
      presets: [['DSL 16', 'Mbit/s', '16'], ['Gigabit LAN', 'Gbit/s', '1'], ['USB 2.0', 'Mbit/s', '480'], ['USB 3.0', 'Gbit/s', '5'], ['SATA III', 'Gbit/s', '6']]
    },
    transfer: { title: 'Transfer time', icon: 'fas fa-download' },
    time: {
      title: 'Time', icon: 'fas fa-hourglass-half', start: ['h', '1'],
      groups: [
        ['Short', [['ns', 'nanosecond', 1e-9], ['µs', 'microsecond', 1e-6], ['ms', 'millisecond', 1e-3], ['s', 'second', 1]]],
        ['Long', [['min', 'minute', 60], ['h', 'hour', 3600], ['d', 'day', 86400], ['wk', 'week', 604800], ['mo', 'month (avg)', 2629746], ['yr', 'year (avg)', 31556952]]]
      ],
      presets: [['1 day', 'd', '1'], ['1 year', 'yr', '1'], ['2³¹ s (Y2038)', 's', '2147483648'], ['1 million s', 's', '1e6']]
    },
    temp: {
      title: 'Temperature', icon: 'fas fa-temperature-half', start: ['°C', '21'],
      groups: [['Scales', [
        ['°C', 'Celsius', { to: v => v, from: v => v }],
        ['°F', 'Fahrenheit', { to: v => (v - 32) * 5 / 9, from: v => v * 9 / 5 + 32 }],
        ['K', 'Kelvin', { to: v => v - 273.15, from: v => v + 273.15 }]
      ]]],
      presets: [['Room', '°C', '21'], ['Body', '°C', '37'], ['CPU throttles', '°C', '100'], ['Server room max', '°F', '80.6']]
    },
    length: {
      title: 'Length', icon: 'fas fa-ruler', start: ['m', '1'],
      groups: [
        ['Metric', [['mm', 'millimetre', 1e-3], ['cm', 'centimetre', 1e-2], ['m', 'metre', 1], ['km', 'kilometre', 1e3]]],
        ['Imperial & other', [['in', 'inch', 0.0254], ['ft', 'foot', 0.3048], ['yd', 'yard', 0.9144], ['mi', 'mile', 1609.344], ['nmi', 'nautical mile', 1852], ['U', 'rack unit', 0.04445]]]
      ],
      presets: [['Rack width 19″', 'in', '19'], ['42U rack', 'U', '42'], ['Cat6 max run', 'm', '100'], ['27″ screen', 'in', '27']]
    },
    mass: {
      title: 'Mass', icon: 'fas fa-weight-hanging', start: ['kg', '1'],
      groups: [
        ['Metric', [['mg', 'milligram', 1e-3], ['g', 'gram', 1], ['kg', 'kilogram', 1e3], ['t', 'tonne', 1e6]]],
        ['Imperial', [['oz', 'ounce', 28.349523125], ['lb', 'pound', 453.59237], ['st', 'stone', 6350.29318]]]
      ],
      presets: [['1 lb', 'lb', '1'], ['Laptop 2 kg', 'kg', '2'], ['1U server 15 kg', 'kg', '15']]
    }
  };
  const ORDER = ['data', 'rate', 'transfer', 'time', 'temp', 'length', 'mass'];
  const unitsOf = (c) => CATS[c].groups.flatMap(g => g[1]);
  const toBase = (u, v) => typeof u[2] === 'number' ? v * u[2] : u[2].to(v);
  const fromBase = (u, v) => typeof u[2] === 'number' ? v / u[2] : u[2].from(v);

  // ---------- numbers ----------
  function num(s) {
    s = String(s).trim().replace(/[\s_']/g, '');
    if (!s) return NaN;
    if (s.includes(',') && !s.includes('.')) s = s.replace(/,/g, '.'); else s = s.replace(/,/g, '');
    if (/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return parseFloat(s);
    // small maths: digits, operators, brackets and exponents only, so this can't run anything else
    if (!/^[\d.+\-*/()e^]+$/i.test(s) || /[a-df-z]/i.test(s)) return NaN;
    try { const v = Function('"use strict";return (' + s.replace(/\^/g, '**') + ')')(); return typeof v === 'number' ? v : NaN; } catch (e) { return NaN; }
  }
  function fmt(v) {
    if (!isFinite(v)) return '';
    if (v === 0) return '0';
    const a = Math.abs(v);
    if (a >= 1e15 || a < 1e-6) return v.toExponential(6).replace(/\.?0+e/, 'e');
    return String(Number(v.toPrecision(10)));
  }
  const nice = (v, d = 2) => isFinite(v) ? Number(v.toFixed(d)).toLocaleString('en', { maximumFractionDigits: d }) : '–';
  function duration(sec) {
    if (!isFinite(sec) || sec < 0) return '–';
    if (sec < 1) return `${nice(sec * 1000, sec < 0.01 ? 3 : 0)} ms`;
    // the three biggest units from the first non-zero one: "1 d 5 min", "2 h 3 min 4 s"
    const out = [];
    let r = Math.round(sec);
    for (const [n, l] of [[31556952, 'y'], [86400, 'd'], [3600, 'h'], [60, 'min'], [1, 's']]) { const k = Math.floor(r / n); r -= k * n; if (k || out.length) out.push([k, l]); }
    return out.slice(0, 3).filter(x => x[0]).map(x => x[0].toLocaleString('en') + ' ' + x[1]).join(' ');
  }

  // ---------- state ----------
  let st = { cat: 'data', vals: {}, t: { size: '50', sizeU: 'GB', speed: '100', speedU: 'Mbit/s', oh: 6 } };
  try { st = Object.assign(st, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} };
  const fromHash = location.hash.slice(1);
  if (CATS[fromHash]) st.cat = fromHash;

  // ---------- category tabs ----------
  $('#cats').innerHTML = ORDER.map(c => `<button type="button" data-c="${c}" aria-pressed="false"><i class="${CATS[c].icon}"></i>${CATS[c].title}</button>`).join('');
  $('#cats').addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (b) show(b.dataset.c); });

  function show(c) {
    st.cat = c; save();
    history.replaceState(history.state, '', '#' + c);
    $('#cats').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.c === c)));
    const isT = c === 'transfer';
    $('#unitView').hidden = isT; $('#transferView').hidden = !isT;
    if (isT) return transfer();
    const C = CATS[c];
    $('#catTitle').innerHTML = `<i class="${C.icon}"></i>${C.title}`;
    $('#presets').innerHTML = C.presets.map(([l, u, v]) => `<button class="btn btn--sm btn--ghost" type="button" data-u="${esc(u)}" data-v="${esc(v)}">${esc(l)}</button>`).join('');
    $('#groups').innerHTML = C.groups.map(([title, units]) => `<div class="ugroup"><h3>${esc(title)}</h3><div class="ugrid">${units.map(u =>
      `<label class="u" data-u="${esc(u[0])}"><span class="u__name"><b>${esc(u[0])}</b><small>${esc(u[1])}</small></span><input class="input mono" inputmode="decimal" spellcheck="false" autocomplete="off" aria-label="${esc(u[1])}"><button class="copy" type="button" aria-label="Copy ${esc(u[0])}"><i class="far fa-copy"></i></button></label>`).join('')}</div></div>`).join('');
    const saved = st.vals[c], [u, v] = saved && isFinite(num(saved[1])) && unitsOf(c).some(x => x[0] === saved[0]) ? saved : C.start;
    update(u, v, false);
  }

  // one field changed: recompute all the others from it
  let cur = null;   // { unit, base }
  function update(unit, text, fromUser = true) {
    const c = st.cat, units = unitsOf(c), src = units.find(x => x[0] === unit);
    if (!src) return;
    const v = num(text), base = isFinite(v) ? toBase(src, v) : NaN;
    cur = { unit, base };
    $('#groups').querySelectorAll('.u').forEach(el => {
      const u = units.find(x => x[0] === el.dataset.u), inp = el.querySelector('input');
      el.classList.toggle('src', u[0] === unit);
      inp.classList.toggle('is-bad', u[0] === unit && text.trim() !== '' && !isFinite(v));
      if (u[0] === unit) { if (!fromUser) inp.value = text; return; }
      const out = isFinite(base) ? fmt(fromBase(u, base)) : '';
      if (inp.value !== out) { inp.value = out; if (fromUser) { inp.classList.remove('uc-flash'); void inp.offsetWidth; inp.classList.add('uc-flash'); } }
    });
    st.vals[c] = [unit, text]; save();
    notes(c, base);
  }
  $('#groups').addEventListener('input', e => { const l = e.target.closest('.u'); if (l) update(l.dataset.u, e.target.value); });
  $('#groups').addEventListener('click', e => {
    const b = e.target.closest('.copy'); if (!b) return;
    e.preventDefault();
    const l = b.closest('.u'), v = l.querySelector('input').value;
    if (v && window.Site) Site.copy(v, `Copied ${v} ${l.dataset.u}`);
  });
  $('#presets').addEventListener('click', e => { const b = e.target.closest('[data-u]'); if (b) update(b.dataset.u, b.dataset.v, false); });

  // ---------- side notes ----------
  function notes(c, base) {
    const el = $('#notes'), ok = isFinite(base);
    let h = '';
    if (c === 'data') {
      const gb = base / 1e9, gib = base / 1024 ** 3, tb = base / 1e12, tib = base / 1024 ** 4;
      h += `<p><b>Why does a new drive look smaller?</b> Manufacturers count in powers of 1000, Windows in powers of 1024 but still writes "GB".</p>`;
      if (ok) h += tib >= 1
        ? `<p><span class="big">${nice(tb)} TB</span> on the box shows as <span class="big">${nice(tib)} TB</span> in Windows (really TiB), <b>${nice((1 - tib / tb) * 100, 1)} %</b> "missing".</p>`
        : `<p><span class="big">${nice(gb)} GB</span> on the box shows as <span class="big">${nice(gib)} GB</span> in Windows (really GiB).</p>`;
      h += `<table><tr><th>Prefix</th><th>SI</th><th>IEC</th><th>Gap</th></tr>${[['k / Ki', 1], ['M / Mi', 2], ['G / Gi', 3], ['T / Ti', 4]].map(([p, n]) => `<tr><td>${p}</td><td>1000^${n}</td><td>1024^${n}</td><td>${nice((1024 ** n / 1000 ** n - 1) * 100, 1)} %</td></tr>`).join('')}</table>`;
      if (ok && base >= 1) h += `<p>That's <b>${Math.round(base * 8).toLocaleString('en')}</b> bits.</p>`;
    } else if (c === 'rate') {
      const mbit = base * 8 / 1e6, mbs = base / 1e6;
      h += `<p><b>Rule of thumb:</b> divide Mbit/s by 8 for MB/s. Real downloads land around 6 % lower because of TCP/IP headers.</p>`;
      if (ok) h += `<p><span class="big">${nice(mbit)} Mbit/s</span> = <span class="big">${nice(mbs)} MB/s</span> in theory, about <b>${nice(mbs * 0.94)} MB/s</b> (${nice(base * 0.94 / 1024 ** 2)} MiB/s, what most download dialogs show) in practice.</p>`;
      if (ok && base > 0) h += `<p>1 GB takes <b>${duration(1e9 / (base * 0.94))}</b> at this speed. For more, use <a href="#transfer" data-go="transfer">Transfer time</a>.</p>`;
    } else if (c === 'time') {
      if (ok) h += `<p><span class="big">${duration(base)}</span>${base >= 60 ? ` · ${Math.round(base).toLocaleString('en')} s` : ''}</p>`;
      h += `<p><b>Uptime vs downtime</b> (SLA)</p><table><tr><th>Uptime</th><th>per year</th><th>per month</th></tr>${[99, 99.5, 99.9, 99.95, 99.99, 99.999].map(p => `<tr><td>${p} %</td><td>${duration(31556952 * (100 - p) / 100)}</td><td>${duration(2629746 * (100 - p) / 100)}</td></tr>`).join('')}</table>`;
    } else if (c === 'temp') {
      h += `<p><b>°F</b> = °C × 9/5 + 32<br><b>K</b> = °C + 273.15</p><p>-40 is the same in °C and °F.</p>`;
      if (ok) h += base < -273.15 ? `<p class="err-text">Below absolute zero (-273.15 °C). That doesn't exist.</p>` : base >= 85 ? `<p class="amber">Hotter than most CPUs and SSDs like to run (throttling usually starts between 85 and 105 °C).</p>` : '';
    } else if (c === 'length') {
      h += `<p><b>Server racks</b>: a 19″ rack panel is 482.6 mm wide, 1U is 1.75″ (44.45 mm) tall.</p><p><b>Twisted pair</b> Ethernet (Cat5e/6/6A) runs up to 100 m per segment.</p>`;
      if (ok) h += `<p><span class="big">${nice(base / 0.04445, 1)} U</span> of rack space, or ${nice(base / 0.0254, 1)} inches.</p>`;
    } else if (c === 'mass') {
      h += `<p>1 kg ≈ 2.2 lb · 1 lb = 453.59237 g exactly · 1 stone = 14 lb.</p>`;
    }
    el.innerHTML = h;
  }
  $('#notes').addEventListener('click', e => { const a = e.target.closest('[data-go]'); if (a) { e.preventDefault(); show(a.dataset.go); } });

  // ---------- transfer time ----------
  const SIZE_U = unitsOf('data').filter(u => !/bit/.test(u[0])), SPEED_U = unitsOf('rate');
  $('#tSizeU').innerHTML = SIZE_U.map(u => `<option>${u[0]}</option>`).join('');
  $('#tSpeedU').innerHTML = SPEED_U.map(u => `<option>${u[0]}</option>`).join('');
  const LINKS = [['DSL 16', 16e6], ['Cable 50', 50e6], ['Fast Ethernet', 100e6], ['Fibre 250', 250e6], ['Gigabit Ethernet', 1e9], ['2.5G Ethernet', 2.5e9], ['10G Ethernet', 10e9], ['USB 2.0', 480e6], ['USB 3.0', 5e9]];
  let lastT = '';
  function transfer() {
    const t = st.t;
    $('#tSize').value = t.size; $('#tSizeU').value = t.sizeU; $('#tSpeed').value = t.speed; $('#tSpeedU').value = t.speedU; $('#tOh').value = t.oh; $('#tOhL').textContent = t.oh + ' %';
    const size = num(t.size), speed = num(t.speed);
    $('#tSize').classList.toggle('is-bad', !isFinite(size) || size < 0);
    $('#tSpeed').classList.toggle('is-bad', !isFinite(speed) || speed <= 0);
    const bytes = size * SIZE_U.find(u => u[0] === t.sizeU)[2], bps = speed * SPEED_U.find(u => u[0] === t.speedU)[2], eff = bps * (1 - t.oh / 100);
    const ok = isFinite(bytes) && bytes >= 0 && isFinite(eff) && eff > 0;
    const big = $('#tTime'), txt = ok ? duration(bytes / eff) : '–';
    big.textContent = txt;
    if (txt !== lastT) { big.classList.remove('pop'); void big.offsetWidth; big.classList.add('pop'); lastT = txt; }
    $('#tSub').innerHTML = ok ? `${nice(bytes / 1e9, 3)} GB at an effective ${nice(eff / 1e6)} MB/s (${nice(eff * 8 / 1e6)} Mbit/s)${t.oh ? `. Without overhead: ${duration(bytes / bps)}` : ''}.` : 'Enter a size and a speed above 0.';
    // comparison bars on a log scale, the typed speed highlighted
    const rows = LINKS.map(([l, b]) => ({ l, b, me: false }));
    if (ok) rows.push({ l: 'Your speed', b: bps * 8, me: true });   // rows are in bits/s
    rows.sort((a, b) => a.b - b.b);
    const times = rows.map(r => bytes / (r.b / 8 * (1 - t.oh / 100)));
    const lo = Math.log10(Math.max(1e-3, Math.min(...times))), hi = Math.log10(Math.max(...times, 1e-3));
    $('#tBars').innerHTML = ok ? rows.map((r, i) => {
      const w = hi > lo ? 8 + 92 * (Math.log10(Math.max(1e-3, times[i])) - lo) / (hi - lo) : 50;
      return `<div class="bar${r.me ? ' me' : ''}"><span class="bar__l">${esc(r.l)}<small>${r.b >= 1e9 ? nice(r.b / 1e9) + ' Gbit/s' : nice(r.b / 1e6) + ' Mbit/s'}</small></span><span class="bar__t"><i style="width:${w}%"></i></span><span class="bar__v">${duration(times[i])}</span></div>`;
    }).join('') : '';
    save();
  }
  [['#tSize', 'size'], ['#tSpeed', 'speed'], ['#tSizeU', 'sizeU'], ['#tSpeedU', 'speedU'], ['#tOh', 'oh']].forEach(([id, k]) =>
    $(id).addEventListener('input', e => { st.t[k] = k === 'oh' ? +e.target.value : e.target.value; transfer(); }));
  $('#tPresets').addEventListener('click', e => { const b = e.target.closest('[data-s]'); if (b) { st.t.size = b.dataset.s; st.t.sizeU = b.dataset.su; transfer(); } });

  addEventListener('hashchange', () => { const c = location.hash.slice(1); if (CATS[c] && c !== st.cat) show(c); });
  show(st.cat);
})();
