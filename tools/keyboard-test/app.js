/* Keyboard test: on-screen ISO/ANSI keyboard keyed by event.code, rollover, chatter detection, event log */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const LS = 'keyboard-test:';
  const load = (k, d) => { try { const v = localStorage.getItem(LS + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) {} };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- Geometry (units = 1 key width) ----------
  function geometry(iso, full) {
    const K = [];
    const add = (c, x, y, w = 1, h = 1) => K.push({ c, x, y, w, h });
    const seq = (codes, x, y) => codes.forEach((c, i) => add(c, x + i, y));
    add('Escape', 0, 0);
    seq(['F1', 'F2', 'F3', 'F4'], 2, 0); seq(['F5', 'F6', 'F7', 'F8'], 6.5, 0); seq(['F9', 'F10', 'F11', 'F12'], 11, 0);
    seq(['Backquote', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal'], 0, 1.5);
    add('Backspace', 13, 1.5, 2);
    add('Tab', 0, 2.5, 1.5);
    seq(['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP', 'BracketLeft', 'BracketRight'], 1.5, 2.5);
    add('CapsLock', 0, 3.5, 1.75);
    seq(['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote'], 1.75, 3.5);
    if (iso) {
      add('Enter', 13.75, 2.5, 1.25, 2);
      add('Backslash', 12.75, 3.5);
      add('ShiftLeft', 0, 4.5, 1.25); add('IntlBackslash', 1.25, 4.5);
    } else {
      add('Backslash', 13.5, 2.5, 1.5);
      add('Enter', 12.75, 3.5, 2.25);
      add('ShiftLeft', 0, 4.5, 2.25);
    }
    seq(['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period', 'Slash'], 2.25, 4.5);
    add('ShiftRight', 12.25, 4.5, 2.75);
    [['ControlLeft', 0], ['MetaLeft', 1.25], ['AltLeft', 2.5]].forEach(([c, x]) => add(c, x, 5.5, 1.25));
    add('Space', 3.75, 5.5, 6.25);
    [['AltRight', 10], ['MetaRight', 11.25], ['ContextMenu', 12.5], ['ControlRight', 13.75]].forEach(([c, x]) => add(c, x, 5.5, 1.25));
    seq(['PrintScreen', 'ScrollLock', 'Pause'], 15.25, 0);
    seq(['Insert', 'Home', 'PageUp'], 15.25, 1.5);
    seq(['Delete', 'End', 'PageDown'], 15.25, 2.5);
    add('ArrowUp', 16.25, 4.5);
    seq(['ArrowLeft', 'ArrowDown', 'ArrowRight'], 15.25, 5.5);
    if (full) {
      seq(['NumLock', 'NumpadDivide', 'NumpadMultiply', 'NumpadSubtract'], 18.5, 1.5);
      seq(['Numpad7', 'Numpad8', 'Numpad9'], 18.5, 2.5); add('NumpadAdd', 21.5, 2.5, 1, 2);
      seq(['Numpad4', 'Numpad5', 'Numpad6'], 18.5, 3.5);
      seq(['Numpad1', 'Numpad2', 'Numpad3'], 18.5, 4.5); add('NumpadEnter', 21.5, 4.5, 1, 2);
      add('Numpad0', 18.5, 5.5, 2); add('NumpadDecimal', 20.5, 5.5);
    }
    return { keys: K, W: full ? 22.5 : 18.25 };
  }

  // ---------- Labels: [main, shifted] ----------
  const COMMON = {
    Escape: 'Esc', Space: '', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Pause: 'Pause',
    NumpadDivide: '/', NumpadMultiply: '*', NumpadSubtract: '−', NumpadAdd: '+',
  };
  for (let i = 1; i <= 12; i++) COMMON['F' + i] = 'F' + i;
  for (let i = 0; i <= 9; i++) COMMON['Numpad' + i] = String(i);
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach((l) => { COMMON['Key' + l] = l; });
  const US = Object.assign({}, COMMON, {
    Backquote: ['`', '~'], Digit1: ['1', '!'], Digit2: ['2', '@'], Digit3: ['3', '#'], Digit4: ['4', '$'], Digit5: ['5', '%'], Digit6: ['6', '^'], Digit7: ['7', '&'], Digit8: ['8', '*'], Digit9: ['9', '('], Digit0: ['0', ')'],
    Minus: ['-', '_'], Equal: ['=', '+'], BracketLeft: ['[', '{'], BracketRight: [']', '}'], Backslash: ['\\', '|'], Semicolon: [';', ':'], Quote: ["'", '"'],
    Comma: [',', '<'], Period: ['.', '>'], Slash: ['/', '?'], IntlBackslash: ['\\', '|'],
    Backspace: 'Backspace', Tab: 'Tab', CapsLock: 'Caps Lock', Enter: 'Enter', ShiftLeft: 'Shift', ShiftRight: 'Shift',
    ControlLeft: 'Ctrl', ControlRight: 'Ctrl', MetaLeft: 'Win', MetaRight: 'Win', AltLeft: 'Alt', AltRight: 'Alt', ContextMenu: 'Menu',
    PrintScreen: 'PrtSc', ScrollLock: 'ScrLk', Insert: 'Ins', Home: 'Home', PageUp: 'PgUp', Delete: 'Del', End: 'End', PageDown: 'PgDn',
    NumLock: 'Num', NumpadEnter: 'Enter', NumpadDecimal: '.',
  });
  const DE = Object.assign({}, COMMON, {
    Backquote: ['^', '°'], Digit1: ['1', '!'], Digit2: ['2', '"'], Digit3: ['3', '§'], Digit4: ['4', '$'], Digit5: ['5', '%'], Digit6: ['6', '&'], Digit7: ['7', '/'], Digit8: ['8', '('], Digit9: ['9', ')'], Digit0: ['0', '='],
    Minus: ['ß', '?'], Equal: ['´', '`'], KeyY: 'Z', KeyZ: 'Y', BracketLeft: 'Ü', BracketRight: ['+', '*'], Backslash: ['#', "'"], Semicolon: 'Ö', Quote: 'Ä',
    IntlBackslash: ['<', '>'], Comma: [',', ';'], Period: ['.', ':'], Slash: ['-', '_'],
    Backspace: '⟵', Tab: 'Tab ⇥', CapsLock: '⇪ Feststell', Enter: '↵', ShiftLeft: '⇧', ShiftRight: '⇧',
    ControlLeft: 'Strg', ControlRight: 'Strg', MetaLeft: 'Win', MetaRight: 'Win', AltLeft: 'Alt', AltRight: 'Alt Gr', ContextMenu: 'Menü',
    PrintScreen: 'Druck', ScrollLock: 'Rollen', Insert: 'Einfg', Home: 'Pos1', PageUp: 'Bild ↑', Delete: 'Entf', End: 'Ende', PageDown: 'Bild ↓',
    NumLock: 'Num', NumpadEnter: '↵', NumpadDecimal: ',',
  });
  const LOCS = ['Standard', 'Left', 'Right', 'Numpad'];

  // ---------- State ----------
  let layout = load('layout', 'de'), size = load('size', 'full'), thr = +load('thr', 30) || 30;
  if (!['de', 'us'].includes(layout)) layout = 'de';
  if (!['full', 'tkl'].includes(size)) size = 'full';
  const done = new Set(), chattered = new Map(), held = new Map(), lastUp = new Map(), extra = new Set();
  let presses = 0, maxHeld = 0, chatterN = 0, lastT = 0, rows = 0, layoutCodes = new Set(), escTimer = 0;
  const stage = $('#stage'), kb = $('#kb'), keyEls = new Map();

  function render() {
    const g = geometry(layout === 'de', size === 'full'), L = layout === 'de' ? DE : US;
    kb.style.setProperty('--W', g.W);
    stage.classList.toggle('tkl', size !== 'full');
    kb.innerHTML = ''; keyEls.clear(); layoutCodes = new Set();
    g.keys.forEach((k) => {
      const lab = L[k.c] != null ? L[k.c] : k.c;
      const [m, s] = Array.isArray(lab) ? lab : [lab, ''];
      const el = document.createElement('div');
      el.className = 'key' + (m.length > 2 || k.w > 1.2 ? ' mod' : '');
      el.dataset.code = k.c;
      el.style.cssText = `--x:${k.x};--y:${k.y};--w:${k.w};--h:${k.h}`;
      el.title = k.c;
      el.innerHTML = `<div><span class="k-s">${esc(s)}</span><span class="k-m">${esc(m)}</span></div>`;
      kb.appendChild(el); keyEls.set(k.c, el); layoutCodes.add(k.c);
    });
    paintAll(); stats(); renderExtra();
  }
  function paintAll() {
    keyEls.forEach((el, c) => {
      el.classList.toggle('done', done.has(c));
      el.classList.toggle('chatter', chattered.has(c));
      el.classList.toggle('down', held.has(c));
    });
  }
  function bump(id, v, cls) {
    const b = $(id); if (b.textContent === String(v)) return;
    b.textContent = v; if (cls !== undefined) b.className = cls;
    const s = b.parentElement; s.classList.remove('pop'); void s.offsetWidth; s.classList.add('pop');
  }
  function stats() {
    let tested = 0; layoutCodes.forEach((c) => { if (done.has(c)) tested++; });
    bump('#sTested', `${tested}/${layoutCodes.size}`);
    bump('#sPresses', presses);
    $('#sHeld').textContent = held.size;
    bump('#sMax', maxHeld, maxHeld >= 6 ? 'good' : '');
    bump('#sChatter', chatterN, chatterN ? 'bad' : '');
    $('#held').innerHTML = Array.from(held.keys()).map((c) => `<span class="chip">${esc(c)}</span>`).join('');
    if (tested === layoutCodes.size && layoutCodes.size && !stats.cheered) { stats.cheered = true; window.Site && Site.toast('Every key works', 'fas fa-circle-check'); window.Site && Site.party(false); }
  }
  function renderExtra() {
    const list = Array.from(extra).filter((c) => !layoutCodes.has(c));
    $('#extraWrap').hidden = !list.length;
    $('#extra').innerHTML = list.map((c) => `<span class="chip">${esc(c)}</span>`).join('');
  }
  function renderChat() {
    $('#chatList').innerHTML = Array.from(chattered.entries()).map(([c, n]) => `<span class="chip" title="${n}×">${esc(c)} ×${n}</span>`).join('');
  }

  // ---------- Event details ----------
  function mods(e) {
    const m = [];
    if (e.ctrlKey) m.push('Ctrl'); if (e.shiftKey) m.push('Shift'); if (e.altKey) m.push('Alt'); if (e.metaKey) m.push('Meta');
    try { if (e.getModifierState('AltGraph')) m.push('AltGr'); if (e.getModifierState('CapsLock')) m.push('CapsLock on'); if (e.getModifierState('NumLock')) m.push('NumLock on'); } catch (x) {}
    return m.join(' + ') || 'none';
  }
  const keyName = (k) => (k === ' ' ? 'Space' : k);
  function showLast(e, extraNote) {
    const big = $('#lastBig');
    big.innerHTML = `<kbd>${esc(keyName(e.key) || e.code || '?')}</kbd>`;
    big.classList.remove('pop'); void big.offsetWidth; big.classList.add('pop');
    const rowsKv = [['key', JSON.stringify(e.key)], ['code', e.code || '(empty)'], ['keyCode', String(e.keyCode)], ['location', `${e.location} · ${LOCS[e.location] || '?'}`], ['modifiers', mods(e)], ['repeat', String(e.repeat)], ['event', e.type + (extraNote ? ' · ' + extraNote : '')]];
    $('#last').innerHTML = rowsKv.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('');
  }
  function log(e, note, cls) {
    if (e.type === 'keyup' && !$('#logUp').checked) return;
    const tb = $('#log');
    if (!rows) tb.innerHTML = '';
    const t = e.timeStamp, d = lastT ? Math.round(t - lastT) : 0; lastT = t;
    const tr = document.createElement('tr');
    tr.className = 'fresh ' + (cls || '') + (e.type === 'keyup' ? ' up' : '');
    tr.innerHTML = `<td>${d ? '+' + d : '–'}</td><td>${e.type === 'keyup' ? 'up' : 'down'}</td><td>${esc(JSON.stringify(e.key))}</td><td>${esc(e.code || '(empty)')}</td><td>${e.keyCode}</td><td>${LOCS[e.location] || e.location}</td><td>${esc(note || '')}</td>`;
    tb.prepend(tr); rows++;
    while (tb.children.length > 60) tb.lastElementChild.remove();
  }

  // ---------- Capture ----------
  // not while the site's palette or command line is open on top (they own the keyboard then)
  const active = () => document.activeElement === stage && !document.querySelector('.palette.open, .cli.in');
  function release() {
    clearTimeout(escTimer); escTimer = 0;
    try { $('#toggle').focus({ preventScroll: true }); } catch (e) {}
    window.Site && Site.toast('Keyboard released', 'fas fa-keyboard');
  }
  function onDown(e) {
    if (!active()) return;
    const code = e.code || ('key:' + e.key);
    // let the site's palette shortcut through (it moves focus away, which releases the keyboard)
    const pass = (e.ctrlKey || e.metaKey) && e.code === 'KeyK';
    if (!pass) { e.preventDefault(); e.stopPropagation(); }
    if (e.repeat) { log(e, 'repeat', 'rep'); showLast(e); return; }
    let note = '', cls = '';
    const lu = lastUp.get(code);
    if (lu != null && e.timeStamp - lu < thr) {
      chatterN++; chattered.set(code, (chattered.get(code) || 0) + 1);
      note = `chatter: ${Math.round(e.timeStamp - lu)} ms after release`; cls = 'chat';
      const el = keyEls.get(code); if (el) el.classList.add('chatter');
      renderChat();
    }
    presses++;
    done.add(code);
    held.set(code, e.timeStamp);
    maxHeld = Math.max(maxHeld, held.size);
    if (!layoutCodes.has(code)) { extra.add(code); renderExtra(); }
    const el = keyEls.get(code); if (el) el.classList.add('down', 'done');
    showLast(e); log(e, note, cls); stats();
    if (e.key === 'Escape' && !escTimer) escTimer = setTimeout(() => { escTimer = 0; if (held.has('Escape')) { held.clear(); paintAll(); stats(); release(); } }, 800);
  }
  function onUp(e) {
    if (!active()) return;
    const code = e.code || ('key:' + e.key);
    e.preventDefault(); e.stopPropagation();
    if (e.key === 'Escape') { clearTimeout(escTimer); escTimer = 0; }
    const t0 = held.get(code);
    held.delete(code); lastUp.set(code, e.timeStamp);
    // PrintScreen and some media keys only ever send keyup
    if (!done.has(code)) { done.add(code); presses++; if (!layoutCodes.has(code)) { extra.add(code); renderExtra(); } }
    // Windows: releasing a key while Meta is down can skip keyups, so clear everything when no modifier remains
    if (e.key === 'Meta') { held.clear(); }
    const el = keyEls.get(code); if (el) { el.classList.remove('down'); el.classList.add('done'); }
    const note = t0 != null ? `held ${Math.round(e.timeStamp - t0)} ms` : 'keyup only';
    showLast(e, note); log(e, note); paintAll(); stats();
  }
  addEventListener('keydown', onDown, true);
  addEventListener('keyup', onUp, true);
  stage.addEventListener('contextmenu', (e) => { if (active()) e.preventDefault(); });
  stage.addEventListener('mousedown', () => { if (!active()) { stage.focus({ preventScroll: true }); } });

  function setUi() {
    const on = active();
    $('#bar').classList.toggle('on', on);
    $('#state b').textContent = on ? 'Capturing keys' : 'Not capturing';
    $('#tip').innerHTML = on
      ? 'Hold <kbd>Esc</kbd>, click outside or use “Release keyboard” to get your keyboard back (<kbd>Tab</kbd> is tested too).'
      : 'Click the keyboard or “Start test”, then press keys. Site shortcuts are paused while testing.';
    $('#toggle').innerHTML = on ? '<i class="fas fa-arrow-right-from-bracket"></i>&nbsp; Release keyboard' : '<i class="fas fa-keyboard"></i>&nbsp; Start test';
  }
  stage.addEventListener('focus', setUi);
  stage.addEventListener('blur', () => { held.clear(); clearTimeout(escTimer); escTimer = 0; paintAll(); stats(); setUi(); });
  // pressing the button while capturing: mousedown would blur the stage first, so decide on mousedown
  let wasOn = false;
  $('#toggle').addEventListener('mousedown', () => { wasOn = active(); });
  $('#toggle').addEventListener('click', () => {
    if (wasOn) { wasOn = false; return; }   // focus already left the stage
    stage.focus({ preventScroll: true });
  });
  addEventListener('blur', () => { held.clear(); paintAll(); stats(); });

  // ---------- Controls ----------
  function segInit(id, cur, attr, cb) {
    const seg = $(id);
    seg.querySelectorAll('button').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset[attr] === cur));
      b.addEventListener('click', () => { seg.querySelectorAll('button').forEach((o) => o.setAttribute('aria-pressed', String(o === b))); cb(b.dataset[attr]); });
    });
  }
  segInit('#layout', layout, 'l', (v) => { layout = v; save('layout', v); render(); });
  segInit('#size', size, 's', (v) => { size = v; save('size', v); render(); });
  const thrEl = $('#thr'); thrEl.value = thr;
  thrEl.addEventListener('input', () => { const v = Math.round(+thrEl.value); if (v >= 5 && v <= 200) { thr = v; save('thr', v); thrEl.classList.remove('is-bad'); } else thrEl.classList.add('is-bad'); });
  $('#logUp').checked = !!load('logUp', false);
  $('#logUp').addEventListener('change', (e) => save('logUp', e.target.checked));
  $('#reset').addEventListener('click', () => {
    done.clear(); chattered.clear(); held.clear(); lastUp.clear(); extra.clear();
    presses = 0; maxHeld = 0; chatterN = 0; lastT = 0; rows = 0; stats.cheered = false;
    $('#log').innerHTML = '<tr class="empty"><td colspan="7">Press a key on the keyboard above.</td></tr>';
    $('#lastBig').innerHTML = '<kbd>–</kbd>'; $('#last').innerHTML = '';
    keyEls.forEach((el) => el.classList.remove('chatter'));
    renderChat(); render();
    window.Site && Site.toast('Test reset', 'fas fa-rotate-left');
  });

  render(); setUi();
  // start capturing right away on devices with a real keyboard
  if (matchMedia('(pointer: fine)').matches) setTimeout(() => { if (!document.activeElement || document.activeElement === document.body) stage.focus({ preventScroll: true }); }, 300);
})();
