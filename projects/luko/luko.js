/**
 * Luko showcase page. Everything below the hero is read from the bot's own
 * repository when the page loads: README.md, package.json, .env.example and
 * every file in src/commands. Nothing about the bot is written into the page,
 * so a new command, panel page or dependency shows up here on its own.
 *
 * GitHub API calls (repo, file list, commits, languages) are cached for 10 min
 * like the rest of the site; file contents come from raw.githubusercontent.com,
 * which isn't rate-limited the same way.
 */
(function () {
  'use strict';

  const REPO = 'Lukas200301/Luko';
  const API = `https://api.github.com/repos/${REPO}`;
  const RAW = `https://raw.githubusercontent.com/${REPO}/HEAD/`;
  const BLOB = `https://github.com/${REPO}/blob/HEAD/`;
  const CACHE = 'luko-bundle-v1', TTL = 10 * 60e3;

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const countUp = (el, n, ms) => { if (window.Site && Site.countUp) Site.countUp(el, n, ms); else el.textContent = n; };
  const reveal = (el) => { if (window.Site && Site.observeReveal) Site.observeReveal(el); };
  const plural = (n, one, many) => `${n} ${n === 1 ? one : (many || one + 's')}`;
  const ago = (iso) => {
    if (!iso) return '';
    const s = (Date.now() - new Date(iso)) / 1000;
    for (const [sec, l] of [[31536000, 'y'], [2592000, 'mo'], [604800, 'w'], [86400, 'd'], [3600, 'h'], [60, 'min']]) if (s >= sec) return Math.floor(s / sec) + l + ' ago';
    return 'just now';
  };
  const noEmoji = (s) => s.replace(/[\p{Extended_Pictographic}️‍]/gu, '').replace(/\s+/g, ' ').trim();
  const keyOf = (s) => noEmoji(s).toLowerCase().replace(/[^a-z0-9 ]+/g, '').replace(/\s+/g, ' ').trim();
  const title = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  // ================= Fetching =================
  async function raw(path) {
    const res = await fetch(RAW + path);
    if (!res.ok) throw new Error(res.status + ' ' + path);
    return res.text();
  }
  async function api(url, key) {
    try {
      const c = JSON.parse(localStorage.getItem(key) || 'null');
      if (c && Date.now() - c.t < TTL) return c.data;
    } catch (e) {}
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), data })); } catch (e) {}
    return data;
  }

  // Every file in the repository. The API tree is one request; jsDelivr is the fallback when GitHub rate-limits.
  async function listFiles(branch) {
    try {
      const res = await fetch(`${API}/git/trees/HEAD?recursive=1`);
      if (!res.ok) throw new Error(res.status);
      return (await res.json()).tree.filter(x => x.type === 'blob').map(x => x.path);
    } catch (e) {
      const res = await fetch(`https://data.jsdelivr.com/v1/packages/gh/${REPO}@${branch}?structure=flat`);
      if (!res.ok) throw new Error(res.status);
      return (await res.json()).files.map(f => f.name.replace(/^\//, ''));
    }
  }

  async function bundle() {
    let stale = null;
    try {
      const c = JSON.parse(localStorage.getItem(CACHE) || 'null');
      if (c && Date.now() - c.t < TTL) return c;
      stale = c;
    } catch (e) {}
    try {
      const repo = await api(API, 'gh-repo:' + REPO).catch(() => null);
      const files = await listFiles((repo && repo.default_branch) || 'main');
      const cmdPaths = files.filter(p => /^src\/commands\/.+\.ts$/.test(p) && !/\.d\.ts$/.test(p));
      const [readme, pkg, env, sources] = await Promise.all([
        raw('README.md').catch(() => ''),
        raw('package.json').then(JSON.parse).catch(() => null),
        raw('.env.example').catch(() => ''),
        Promise.all(cmdPaths.map(p => raw(p).then(s => [p, s]).catch(() => null)))
      ]);
      const cmdFiles = sources.filter(Boolean);
      // modules the commands take constants from (choice lists, limits)
      const mods = {};
      const need = new Set();
      cmdFiles.forEach(([p, s]) => usedImports(p, s).forEach(m => { if (files.includes(m)) need.add(m); }));
      await Promise.all([...need].map(m => raw(m).then(s => { mods[m] = s; }).catch(() => {})));
      const commands = cmdFiles.map(([p, s]) => { try { return parseCommand(p, s, mods); } catch (e) { return null; } }).filter(Boolean);
      if (!commands.length && !readme) throw new Error('empty');
      const data = {
        t: Date.now(),
        commands, readme, pkg, env,
        pages: files.filter(p => /^panel\/src\/pages\/[^/]+\.tsx$/.test(p)).map(p => p.split('/').pop().replace(/\.tsx$/, '')),
        modules: files.filter(p => /^src\/utils\/[^/]+\.ts$/.test(p)).map(p => p.split('/').pop().replace(/\.ts$/, '')),
        files: files.length
      };
      try { localStorage.setItem(CACHE, JSON.stringify(data)); } catch (e) {}
      return data;
    } catch (e) {
      if (stale) { stale.stale = true; return stale; }
      throw e;
    }
  }

  // ================= Reading slash commands out of TypeScript =================
  // Not a TypeScript parser: it follows the SlashCommandBuilder chain (".setName(...).addStringOption(o => o...)")
  // with bracket matching, and looks up constants in the file or the modules it imports.

  function skipStr(s, k) {
    const q = s[k];
    for (k++; k < s.length; k++) {
      if (s[k] === '\\') { k++; continue; }
      if (s[k] === q) return k;
      if (q === '`' && s[k] === '$' && s[k + 1] === '{') { k = close(s, k + 1); if (k < 0) return s.length; }
    }
    return s.length;
  }
  // index of the bracket that closes the one at s[i]
  function close(s, i) {
    let depth = 0;
    for (let k = i; k < s.length; k++) {
      const c = s[k];
      if (c === '"' || c === "'" || c === '`') { k = skipStr(s, k); continue; }
      if (c === '/' && s[k + 1] === '/') { k = s.indexOf('\n', k); if (k < 0) return -1; continue; }
      if (c === '/' && s[k + 1] === '*') { k = s.indexOf('*/', k + 2) + 1; if (k <= 0) return -1; continue; }
      if (c === '(' || c === '[' || c === '{') depth++;
      else if (c === ')' || c === ']' || c === '}') { depth--; if (depth === 0) return k; }
    }
    return -1;
  }
  // top-level comma-separated parts
  function split(s) {
    const out = [];
    let depth = 0, start = 0;
    for (let k = 0; k < s.length; k++) {
      const c = s[k];
      if (c === '"' || c === "'" || c === '`') { k = skipStr(s, k); continue; }
      if (c === '(' || c === '[' || c === '{') depth++;
      else if (c === ')' || c === ']' || c === '}') depth--;
      else if (c === ',' && depth === 0) { out.push(s.slice(start, k)); start = k + 1; }
    }
    out.push(s.slice(start));
    return out.map(x => x.trim()).filter(Boolean);
  }
  // `.method(args)` calls from s[i] on
  function calls(s, i) {
    const out = [];
    const re = /^\s*(?:(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)\s*)*\.\s*(\w+)\s*(?:<[^>()]*>)?\s*\(/;
    for (;;) {
      const m = re.exec(s.slice(i));
      if (!m) return out;
      const open = i + m[0].length - 1, end = close(s, open);
      if (end < 0) return out;
      out.push({ m: m[1], a: s.slice(open + 1, end) });
      i = end + 1;
    }
  }
  // end of the expression starting at s[i]: a top-level ";" or a line break that ends the statement
  function exprEnd(s, i) {
    let depth = 0;
    for (let k = i; k < s.length; k++) {
      const c = s[k];
      if (c === '"' || c === "'" || c === '`') { k = skipStr(s, k); continue; }
      if (c === '/' && s[k + 1] === '/') { const n = s.indexOf('\n', k); if (n < 0) return s.length; k = n - 1; continue; }
      if (c === '(' || c === '[' || c === '{') depth++;
      else if (c === ')' || c === ']' || c === '}') { depth--; if (depth < 0) return k; }
      else if (depth === 0 && c === ';') return k;
      else if (depth === 0 && c === '\n') {
        const before = s.slice(i, k).replace(/\/\/[^\n]*$/, '').trimEnd();
        const after = s.slice(k).trimStart();
        if (!/(=>|[,=+\-*/?:|&(])$/.test(before) && !/^[.?:+\-*/|&]/.test(after)) return k;
      }
    }
    return s.length;
  }
  // `(a: T, b) => body` or `a => body`
  function arrow(a) {
    a = a.trim();
    let i, params;
    if (a[0] === '(') {
      const e = close(a, 0);
      if (e < 0) return null;
      params = split(a.slice(1, e)).map(p => (/^\w+/.exec(p) || [''])[0]);
      i = e + 1;
    } else {
      const m = /^(?:async\s+)?(\w+)\s*/.exec(a);
      if (!m) return null;
      params = [m[1]];
      i = m[0].length;
    }
    const m = /^\s*(?::[^=]*?)?=>\s*/.exec(a.slice(i));
    if (!m) return null;
    return { params, body: a.slice(i + m[0].length) };
  }

  const resolvePath = (from, rel) => {
    const parts = from.split('/').slice(0, -1);
    rel.split('/').forEach(p => { if (p === '..') parts.pop(); else if (p !== '.') parts.push(p); });
    const p = parts.join('/');
    return /\.\w+$/.test(p) ? p : p + '.ts';
  };
  function importsOf(path, src) {
    const map = {};
    const re = /import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"](\.{1,2}\/[^'"]+)['"]/g;
    let m;
    while ((m = re.exec(src))) {
      const file = resolvePath(path, m[2]);
      m[1].split(',').forEach(n => {
        const parts = n.trim().replace(/^type\s+/, '').split(/\s+as\s+/);
        if (parts[0]) map[(parts[1] || parts[0]).trim()] = { file, name: parts[0].trim() };
      });
    }
    return map;
  }
  function dataRegion(src) {
    const d = /\bdata\s*:\s*new\s+SlashCommandBuilder\s*\(\s*\)/.exec(src);
    if (!d) return null;
    const list = calls(src, d.index + d[0].length);
    return { start: d.index + d[0].length, list };
  }
  // modules whose exports appear inside the builder chain
  function usedImports(path, src) {
    const d = /\bdata\s*:\s*new\s+SlashCommandBuilder/.exec(src);
    if (!d) return [];
    const region = src.slice(d.index, d.index + 12000);
    const imp = importsOf(path, src);
    return [...new Set(Object.keys(imp).filter(n => new RegExp('\\b' + n + '\\b').test(region)).map(n => imp[n].file))];
  }

  function moduleCtx(path, src, mods, env) {
    return { path, src, mods, env: env || {}, imports: importsOf(path, src) };
  }
  // the text of `const NAME = ...` here, or in the module it was imported from
  function findConst(name, ctx, depth = 0) {
    const re = new RegExp('(?:^|\\n)\\s*(?:export\\s+)?(?:const|let|var)\\s+' + name + '\\b\\s*(?::[^=\\n]+)?=\\s*');
    const m = re.exec(ctx.src);
    if (m) {
      const start = m.index + m[0].length;
      return { text: ctx.src.slice(start, exprEnd(ctx.src, start)).trim(), ctx: moduleCtx(ctx.path, ctx.src, ctx.mods) };
    }
    const fn = new RegExp('(?:^|\\n)\\s*(?:export\\s+)?function\\s+' + name + '\\s*\\(').exec(ctx.src);
    if (fn) {
      const open = fn.index + fn[0].length - 1, end = close(ctx.src, open);
      const body = /^[^{]*\{\s*return\s+/.exec(ctx.src.slice(end + 1));
      if (body) {
        const start = end + 1 + body[0].length;
        return { text: ctx.src.slice(open, end + 1) + ' => ' + ctx.src.slice(start, exprEnd(ctx.src, start)), ctx: moduleCtx(ctx.path, ctx.src, ctx.mods) };
      }
    }
    const imp = ctx.imports[name];
    if (imp && depth < 3 && ctx.mods[imp.file]) return findConst(imp.name, moduleCtx(imp.file, ctx.mods[imp.file], ctx.mods), depth + 1);
    return null;
  }
  // value of a literal, a constant or a template string; null when it can't be known without running the code
  function lit(a, ctx, depth = 0) {
    a = String(a).trim().replace(/\s+as\s+const$/, '');
    let m;
    if ((m = /^(['"])([\s\S]*)\1$/.exec(a))) return m[2].replace(/\\(.)/g, (_, c) => ({ n: '\n', t: '\t' }[c] || c));
    if (a[0] === '`' && a[a.length - 1] === '`') {
      return a.slice(1, -1).replace(/\$\{([^}]*)\}/g, (_, e) => { const v = lit(e, ctx, depth + 1); return v == null ? '…' : String(v); });
    }
    if (/^-?\d+(\.\d+)?$/.test(a)) return +a;
    if (a === 'true' || a === 'false') return a === 'true';
    if (/^\w+$/.test(a)) {
      if (Object.prototype.hasOwnProperty.call(ctx.env, a)) return ctx.env[a];
      if (depth < 4) { const d = findConst(a, ctx); if (d) return lit(d.text, d.ctx, depth + 1); }
    }
    return null;
  }
  // list of choice names from `{ name, value }` objects, `...CONST` or `...CONST.map(...)`
  function choiceNames(a, ctx, depth = 0) {
    const out = [];
    split(a).forEach(part => {
      if (part.startsWith('...')) {
        const m = /^\.\.\.\s*(\w+)/.exec(part);
        const d = m && depth < 3 && findConst(m[1], ctx);
        if (d && d.text[0] === '[') out.push(...choiceNames(d.text.slice(1, close(d.text, 0)), d.ctx, depth + 1));
      } else if (part[0] === '{') {
        const name = split(part.slice(1, close(part, 0))).map(kv => /^name\s*:\s*([\s\S]+)$/.exec(kv)).find(Boolean);
        const v = name && lit(name[1], ctx);
        if (v != null) out.push(String(v));
      } else {
        const v = lit(part, ctx);
        if (v != null) out.push(String(v));
      }
    });
    return out;
  }
  // the calls on an option/subcommand builder: `o => o.setName(...)`, `sub => { return sub... }` or `helper('x')`
  function builder(a, ctx, depth = 0) {
    a = a.trim();
    if (depth > 4) return null;
    const f = arrow(a);
    if (f) {
      let body = f.body.trim();
      if (body[0] === '{') { const r = /\breturn\s+/.exec(body); if (!r) return null; body = body.slice(r.index + r[0].length); }
      if (body[0] === '(') body = body.slice(1);
      const m = new RegExp('^' + f.params[0] + '\\b').exec(body);
      return m ? { list: calls(body, m[0].length), ctx } : null;
    }
    const m = /^(\w+)\s*\(/.exec(a);
    if (!m) return null;
    const def = findConst(m[1], ctx);
    const outer = def && arrow(def.text);
    if (!outer) return null;
    const vals = split(a.slice(m[0].length, close(a, m[0].length - 1)));
    const env = {};
    outer.params.forEach((p, i) => { env[p] = vals[i] != null ? lit(vals[i], ctx) : null; });
    return builder(outer.body, Object.assign({}, def.ctx, { env }), depth + 1);
  }
  const spaced = (s) => s.replace(/([a-z])([A-Z])/g, '$1 $2');
  function apply(list, ctx, node) {
    list.forEach(({ m, a }) => {
      let o;
      if (m === 'setName') node.name = lit(a, ctx);
      else if (m === 'setDescription') node.desc = lit(a, ctx);
      else if (m === 'setRequired') node.required = a.trim() !== 'false';
      else if (m === 'setAutocomplete') node.auto = a.trim() !== 'false';
      else if (m === 'setMinValue') node.min = lit(a, ctx);
      else if (m === 'setMaxValue') node.max = lit(a, ctx);
      else if (m === 'setMaxLength') node.maxLen = lit(a, ctx);
      else if (m === 'addChoices') node.choices = (node.choices || []).concat(choiceNames(a, ctx));
      else if (m === 'addChannelTypes') node.channels = (a.match(/ChannelType\.(\w+)/g) || []).map(x => spaced(x.split('.')[1]).replace(/^Guild /, ''));
      else if (m === 'setDefaultMemberPermissions') {
        const p = (a.match(/PermissionFlagsBits\.(\w+)/g) || []).map(x => spaced(x.split('.')[1]));
        node.perms = p.length ? p : (/^\s*['"`]?0['"`]?\s*$/.test(a) ? ['Administrator'] : []);
      } else if (m === 'setContexts') node.contexts = (a.match(/InteractionContextType\.(\w+)/g) || []).map(x => x.split('.')[1]);
      else if (m === 'setNSFW') node.nsfw = a.trim() !== 'false';
      else if (m === 'addSubcommand') {
        const b = builder(a, ctx);
        if (b) node.subs.push(apply(b.list, b.ctx, { options: [] }));
      } else if (m === 'addSubcommandGroup') {
        const b = builder(a, ctx);
        if (b) {
          const g = apply(b.list, b.ctx, { options: [], subs: [] });
          g.subs.forEach(s => { s.name = `${g.name} ${s.name}`; node.subs.push(s); });
        }
      } else if ((o = /^add(\w+)Option$/.exec(m))) {
        const b = builder(a, ctx);
        if (b) node.options.push(apply(b.list, b.ctx, { type: o[1] }));
      }
    });
    return node;
  }
  function parseCommand(path, src, mods) {
    const d = dataRegion(src);
    if (!d) return null;
    const cmd = apply(d.list, moduleCtx(path, src, mods), { options: [], subs: [] });
    if (!cmd.name) return null;
    const rel = path.replace(/^src\/commands\//, '').split('/');
    cmd.path = path;
    cmd.cat = rel.length > 1 ? rel[0].toLowerCase() : 'general';
    cmd.desc = cmd.desc || '';
    const dev = /^\s*\[(dev|owner|admin)\]\s*/i.exec(cmd.desc);
    if (dev) cmd.desc = cmd.desc.slice(dev[0].length);
    cmd.owner = /\bprivate\s*:\s*true\b/.test(src) || !!dev;
    if (cmd.owner) cmd.cat = 'owner';
    cmd.guild = !!(cmd.contexts && cmd.contexts.length && cmd.contexts.every(c => c === 'Guild'));
    return cmd;
  }

  // ================= README =================
  function sections(md, level) {
    const out = [];
    let cur = { title: '', lines: [] }, fence = false;
    const re = new RegExp('^#{' + level + '}\\s+(.+?)\\s*#*\\s*$');
    md.split(/\r?\n/).forEach(line => {
      if (/^\s*(```|~~~)/.test(line)) fence = !fence;
      const m = !fence && re.exec(line);
      if (m) { out.push(cur); cur = { title: m[1], lines: [] }; } else cur.lines.push(line);
    });
    out.push(cur);
    return out.map(s => ({ title: noEmoji(s.title), key: keyOf(s.title), body: s.lines.join('\n').trim() }));
  }
  const find = (list, ...words) => list.find(s => words.some(w => s.key === w)) || list.find(s => words.some(w => s.key.includes(w)));
  // top-level list items; indented lines continue the item before them
  function bullets(body) {
    const out = [];
    let fence = false;
    body.split(/\r?\n/).forEach(l => {
      if (/^\s*(```|~~~)/.test(l)) fence = !fence;
      if (fence) return;
      const m = /^[-*+]\s+(.*)$/.exec(l);
      if (m) out.push(m[1].trim());
      else if (out.length && /^\s+\S/.test(l)) out[out.length - 1] += ' ' + l.trim();
      else if (out.length && l.trim() && !/^\s/.test(l)) out.push(null);   // a paragraph ends the list
    });
    const end = out.indexOf(null);
    return end < 0 ? out : out.slice(0, end);
  }
  const intro = (body) => body.split(/\n\s*\n/)[0].split(/\r?\n/).every(l => !/^[-*+#`|]/.test(l.trim())) ? body.split(/\n\s*\n/)[0] : '';
  // "**Name** - text" → [name, text]
  const labelled = (b) => { const m = /^\*\*(.+?)\*\*\s*(?:[-–—:]\s*)?([\s\S]*)$/.exec(b); return m ? [m[1], m[2]] : null; };

  // ================= Markdown =================
  const hasMd = () => window.marked && typeof window.marked.parse === 'function';
  const clean = (html) => window.DOMPurify ? DOMPurify.sanitize(html) : html;
  function inlineFallback(s) {
    return esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
  }
  const mdi = (s) => clean(hasMd() ? marked.parseInline(s, { gfm: true }) : inlineFallback(s));
  function md(s) {
    if (hasMd()) return clean(marked.parse(s, { gfm: true }));
    return s.split(/\n\s*\n/).map(p => /^```/.test(p) ? `<pre><code>${esc(p.replace(/^```\w*\n?|```$/g, ''))}</code></pre>` : `<p>${inlineFallback(p)}</p>`).join('');
  }
  // links into the repo, site code blocks with a copy button
  function polish(root) {
    $$('a[href]', root).forEach(a => {
      const h = a.getAttribute('href');
      if (h.startsWith('#')) a.href = `https://github.com/${REPO}#${h.slice(1)}`;
      else if (!/^[a-z]+:/i.test(h)) a.href = BLOB + h.replace(/^\.?\//, '');
      a.target = '_blank';
      a.rel = 'noopener';
    });
    $$('img[src]', root).forEach(img => { const s = img.getAttribute('src'); if (!/^[a-z]+:/i.test(s)) img.src = RAW + s.replace(/^\.?\//, ''); });
    $$('pre > code', root).forEach(code => {
      const pre = code.parentElement;
      const lang = ((code.className.match(/language-(\S+)/) || [])[1] || '').replace(/^(sh|shell)$/, 'bash');
      const box = document.createElement('div');
      box.className = 'code-block';
      box.innerHTML = `<div class="code-header"><span>${esc(lang || 'text')}</span><button class="copy-btn" type="button" aria-label="Copy"><i class="fas fa-copy"></i></button></div>`;
      pre.replaceWith(box);
      box.appendChild(pre);
    });
    return root;
  }
  const mdInto = (el, s) => { el.innerHTML = md(s); return polish(el); };

  // ================= Icons =================
  const pick = (table, text, dflt) => { const t = text.toLowerCase(); const hit = table.find(([re]) => re.test(t)); return hit ? hit[1] : dflt; };
  const CAT = {
    music: ['fa-music', 'Music'], community: ['fa-people-group', 'Community'], utility: ['fa-screwdriver-wrench', 'Utility'],
    general: ['fa-terminal', 'General'], moderation: ['fa-gavel', 'Moderation'], fun: ['fa-dice', 'Fun'], owner: ['fa-user-shield', 'Owner']
  };
  const catInfo = (c) => CAT[c] || ['fa-folder', title(c)];
  const FEATURE_ICONS = [[/music|play|audio|song/, 'fa-music'], [/community|social|fun/, 'fa-people-group'], [/utility|tool/, 'fa-screwdriver-wrench'], [/admin|panel|dashboard/, 'fa-gauge-high'], [/moderat/, 'fa-gavel'], [/command/, 'fa-terminal']];
  const PAGE_ICONS = [
    [/dashboard|overview|home/, 'fa-gauge-high'], [/stat|analytic|insight/, 'fa-chart-simple'], [/playlist/, 'fa-list-ol'], [/music|player/, 'fa-music'],
    [/pinboard|starboard|pin/, 'fa-thumbtack'], [/emoji/, 'fa-face-smile'], [/reminder/, 'fa-bell'], [/birthday/, 'fa-cake-candles'], [/poll|vote/, 'fa-square-poll-vertical'],
    [/server|guild/, 'fa-server'], [/command/, 'fa-terminal'], [/message|embed/, 'fa-message'], [/presence|status|activit/, 'fa-signal'], [/lavalink|node|audio/, 'fa-wave-square'],
    [/log|activity|audit/, 'fa-scroll'], [/maint|update|backup/, 'fa-toolbox'], [/setting|config/, 'fa-gear'], [/user|member/, 'fa-users'], [/welcome/, 'fa-door-open'], [/ticket/, 'fa-ticket']
  ];
  const FAQ_ICONS = [[/respond|command/, 'fa-terminal'], [/music|play|sound|audio/, 'fa-volume-xmark'], [/login|log in|auth|lock/, 'fa-key'], [/panel|web/, 'fa-window-maximize'], [/lavalink|connect/, 'fa-plug-circle-xmark']];
  const GUIDE_ICONS = [[/log in|login|who can/, 'fa-key'], [/local|network/, 'fa-house-signal'], [/domain|proxy/, 'fa-globe'], [/update/, 'fa-arrows-rotate'], [/backup/, 'fa-box-archive'], [/locked|reset/, 'fa-lock-open'], [/member/, 'fa-users'], [/develop/, 'fa-code']];
  const OPT_ICONS = { String: 'fa-font', Integer: 'fa-hashtag', Number: 'fa-hashtag', Boolean: 'fa-toggle-on', User: 'fa-user', Channel: 'fa-comment', Role: 'fa-at', Mentionable: 'fa-at', Attachment: 'fa-paperclip' };
  const PKG = {
    'discord.js': ['fab fa-discord', '#5865f2'], shoukaku: ['fas fa-wave-square', '#ff6b9d'], fastify: ['fas fa-bolt', '#e8edff'], pm2: ['fas fa-arrows-rotate', '#5ee6b5'],
    dotenv: ['fas fa-key', '#ffd166'], yaml: ['fas fa-file-code', '#ff7a90'], react: ['devicon-react-original', '#61dafb'], 'react-dom': ['devicon-react-original', '#61dafb'],
    vite: ['devicon-vitejs-plain', '#a78bfa'], tailwindcss: ['devicon-tailwindcss-original', '#38bdf8'], typescript: ['devicon-typescript-plain', '#3178c6'],
    recharts: ['fas fa-chart-line', '#8ea2ff'], 'react-router': ['fas fa-route', '#f44250'], 'lucide-react': ['fas fa-icons', '#f56565'], tsx: ['fas fa-play', '#5ee6b5'],
    '@tanstack': ['fas fa-arrows-spin', '#ff4154'], '@dnd-kit': ['fas fa-grip', '#c77dff'], '@fastify': ['fas fa-plug', '#e8edff'], '@resvg': ['fas fa-image', '#ffb86b'],
    '@vitejs': ['devicon-vitejs-plain', '#a78bfa'], '@tailwindcss': ['devicon-tailwindcss-original', '#38bdf8'], clsx: ['fas fa-wand-magic-sparkles', '#8ea2ff'],
    'tailwind-merge': ['fas fa-wand-magic-sparkles', '#38bdf8'], 'node:sqlite': ['fas fa-database', '#6fd8ff'], 'better-sqlite3': ['fas fa-database', '#6fd8ff'],
    express: ['devicon-express-original', '#e8edff'], mongoose: ['devicon-mongodb-plain', '#47a248'], prisma: ['devicon-prisma-original', '#e8edff']
  };
  const LANG = { TypeScript: '#3178c6', JavaScript: '#f1e05a', CSS: '#663399', HTML: '#e34c26', Shell: '#89e051', PowerShell: '#012456', Python: '#3572A5' };

  // ================= Rendering =================
  const set = (k, v) => $$(`[data-lk="${k}"]`).forEach(el => { el.textContent = v; });
  const show = (k) => $$(`[data-lk-show="${k}"]`).forEach(el => { el.hidden = false; });
  const ver = (v) => String(v || '').replace(/^[\^~>=<\s]+/, '');
  const shortVer = (v) => ver(v).split('.').slice(0, 2).join('.');
  const optSig = (o) => o.required ? `&lt;${esc(o.name)}&gt;` : `[${esc(o.name)}]`;

  function hero(d) {
    const pkg = d.pkg || {};
    const deps = Object.assign({}, pkg.devDependencies, pkg.dependencies);
    if (pkg.version) { set('version', pkg.version); show('version'); }
    if (deps['discord.js']) set('djs', 'discord.js ' + shortVer(deps['discord.js']).split('.')[0]);
    if (pkg.engines && pkg.engines.node) { set('node', pkg.engines.node.replace(/\s+/g, '').replace(/^>=/, '≥ ').replace(/^\^/, '')); show('node'); }
  }

  function facts(d) {
    const pub = d.commands.filter(c => !c.owner);
    const subs = pub.reduce((a, c) => a + c.subs.length, 0);
    const panel = panelPages(d).length;
    const src = d.commands.flatMap(c => c.options.concat(c.subs.flatMap(s => s.options))).filter(o => /source|platform|provider/i.test(o.name || '') && o.choices)
      .map(o => o.choices.filter(n => !/^auto/i.test(n))).sort((a, b) => b.length - a.length)[0];
    const filters = (d.commands.find(c => c.name === 'filter') || { options: [] }).options.find(o => o.choices);
    const out = [
      [pub.length, 'commands', subs ? `plus ${plural(subs, 'subcommand')}` : `in ${plural(new Set(pub.map(c => c.cat)).size, 'category', 'categories')}`],
      panel ? [panel, 'panel pages', 'in the web admin panel'] : null,
      src ? [src.length, 'sources', src.slice(0, 3).join(', ') + (src.length > 3 ? ' and more' : '')] : null,
      filters ? [filters.choices.filter(n => !/^none/i.test(n)).length, 'audio filters', 'from nightcore to 8D'] : null,
      [d.modules.length, 'modules', 'in src/utils']
    ].filter(Boolean).slice(0, 4);
    const host = $('#lkFacts');
    host.innerHTML = out.map(([n, l, s]) => `<div class="pj-fact"><b><span data-n="${n}">0</span><small>${esc(l)}</small></b><span>${esc(s)}</span></div>`).join('');
    $$('[data-n]', host).forEach(el => {
      if (!('IntersectionObserver' in window)) { el.textContent = el.dataset.n; return; }
      const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { io.disconnect(); countUp(el, +el.dataset.n, 1100); } }), { threshold: 0.5 });
      io.observe(el);
    });
  }

  function features(readme) {
    const host = $('#lkFeatures');
    const top = sections(readme, 2);
    const sec = find(top, 'features');
    const subs = sec ? sections(sec.body, 3).filter(s => s.title && bullets(s.body).length) : [];
    if (!subs.length) { host.closest('.block').hidden = true; return; }
    // two columns when three would leave a single card on the last row
    host.style.setProperty('--n', subs.length > 1 && subs.length % 3 === 1 ? 2 : Math.min(subs.length, 3));
    host.innerHTML = subs.map((s, i) => {
      const items = bullets(s.body);
      const cmds = items.filter(b => /^`\//.test(b)).length > items.length / 2;
      return `<article class="pj-feat spot${cmds ? ' lk-feat--cmds' : ''}" data-tilt data-reveal="scale" style="--i:${i % 6}">
        <span class="pj-feat__icon"><i class="fas ${pick(FEATURE_ICONS, s.title, 'fa-star')}"></i></span>
        <h3>${esc(s.title)}</h3>
        <ul>${items.map(b => `<li>${mdi(b)}</li>`).join('')}</ul>
      </article>`;
    }).join('');
    $$('.pj-feat', host).forEach(reveal);
  }

  // ---------- Commands ----------
  function optHtml(o) {
    const bits = [];
    if (o.min != null && o.max != null) bits.push(`${o.min}–${o.max}`);
    else if (o.min != null) bits.push(`≥ ${o.min}`);
    else if (o.max != null) bits.push(`≤ ${o.max}`);
    if (o.maxLen != null) bits.push(`max ${o.maxLen} chars`);
    if (o.channels) bits.push(o.channels.join(', '));
    const ch = (o.choices || []).map(n => { const short = n.split(/\s+[-–—]\s+/)[0]; return `<span class="chip" title="${esc(n)}">${esc(short)}</span>`; });
    const MAX = 6;
    return `<li class="lk-opt">
      <span class="lk-opt__name"><i class="fas ${OPT_ICONS[o.type] || 'fa-circle'}" title="${esc(o.type)}" aria-label="${esc(o.type)}"></i><code>${esc(o.name)}</code>${o.required ? '<em>required</em>' : ''}${o.auto ? '<i class="fas fa-wand-magic-sparkles lk-auto" title="Suggestions while you type" aria-label="autocomplete"></i>' : ''}</span>
      <span class="lk-opt__desc">${esc(o.desc || '')}${bits.length ? ` <small>${esc(bits.join(' · '))}</small>` : ''}</span>
      ${ch.length ? `<span class="lk-choices">${ch.slice(0, MAX).join('')}${ch.length > MAX ? `<button type="button" class="chip lk-choices__more" data-more='${esc(JSON.stringify(ch.slice(MAX)))}'>+${ch.length - MAX}</button>` : ''}</span>` : ''}
    </li>`;
  }
  function cmdHtml(c) {
    const badges = [];
    if (c.owner) badges.push('<span class="badge"><i class="fas fa-user-shield"></i>Owner only</span>');
    if (c.perms && c.perms.length) badges.push(`<span class="badge" title="Needs the ${esc(c.perms.join(', '))} permission"><i class="fas fa-lock"></i>${esc(c.perms.join(', '))}</span>`);
    if (c.guild) badges.push('<span class="badge" title="Works in servers, not in DMs"><i class="fas fa-server"></i>Server</span>');
    if (c.nsfw) badges.push('<span class="badge">NSFW</span>');
    const sig = c.subs.length ? ` <span class="lk-sig">${esc(c.subs.map(s => s.name).join(' | '))}</span>` : (c.options.length ? ` <span class="lk-sig">${c.options.map(optSig).join(' ')}</span>` : '');
    const [ic] = catInfo(c.cat);
    return `<article class="lk-cmd" data-cat="${esc(c.cat)}" data-name="${esc(c.name)}">
      <header class="lk-cmd__head">
        <span class="lk-cmd__ic"><i class="fas ${ic}"></i></span>
        <h3><code>/${esc(c.name)}</code>${sig}</h3>
        <a class="lk-cmd__src" href="${BLOB}${esc(c.path)}" target="_blank" rel="noopener" title="Source: ${esc(c.path)}" aria-label="Source of /${esc(c.name)}"><i class="fas fa-code"></i></a>
      </header>
      ${badges.length ? `<div class="lk-badges">${badges.join('')}</div>` : ''}
      <p class="lk-cmd__desc">${esc(c.desc)}</p>
      ${c.options.length ? `<ul class="lk-opts">${c.options.map(optHtml).join('')}</ul>` : ''}
      ${c.subs.length ? `<ul class="lk-subs">${c.subs.map(s => `<li>
          <div class="lk-sub"><code>/${esc(c.name)} ${esc(s.name)}</code>${s.options.length ? ` <span class="lk-sig">${s.options.map(optSig).join(' ')}</span>` : ''}<span>${esc(s.desc || '')}</span></div>
          ${s.options.length ? `<ul class="lk-opts">${s.options.map(optHtml).join('')}</ul>` : ''}
        </li>`).join('')}</ul>` : ''}
    </article>`;
  }
  const CAT_ORDER = ['music', 'community', 'utility', 'moderation', 'fun', 'general'];
  const catRank = (c) => c === 'owner' ? 99 : (CAT_ORDER.indexOf(c) + 1 || 50);

  function commands(list) {
    const grid = $('#lkCmds'), filtersEl = $('#lkCmdFilters'), input = $('#lkCmdSearch'), count = $('#lkCmdCount');
    const cmds = list.slice().sort((a, b) => (catRank(a.cat) - catRank(b.cat)) || a.cat.localeCompare(b.cat) || a.name.localeCompare(b.name));
    const cats = [...new Set(cmds.map(c => c.cat))];
    let cat = 'all';
    filtersEl.innerHTML = [['all', 'All', cmds.length]].concat(cats.map(c => [c, catInfo(c)[1], cmds.filter(x => x.cat === c).length]))
      .map(([k, l, n]) => `<button class="filter" type="button" data-f="${esc(k)}" aria-pressed="${k === cat}">${esc(l)} <small>${n}</small></button>`).join('');
    grid.innerHTML = cmds.map(cmdHtml).join('');
    const cards = $$('.lk-cmd', grid);
    const hay = cmds.map(c => [c.name, c.desc, c.cat, ...c.options.map(o => o.name + ' ' + (o.desc || '')), ...c.subs.map(s => s.name + ' ' + (s.desc || '') + ' ' + s.options.map(o => o.name).join(' '))].join(' ').toLowerCase());
    const apply = () => {
      const q = input.value.trim().toLowerCase().replace(/^\//, '');
      let n = 0;
      cards.forEach((el, i) => {
        const on = (cat === 'all' || cmds[i].cat === cat) && (!q || q.split(/\s+/).every(w => hay[i].includes(w)));
        el.hidden = !on;
        if (on) n++;
      });
      count.textContent = n === cmds.length ? `${plural(n, 'command')}, read from src/commands` : `${n} of ${plural(cmds.length, 'command')}`;
      $('#lkCmdEmpty').hidden = n > 0;
    };
    filtersEl.addEventListener('click', e => {
      const b = e.target.closest('[data-f]');
      if (!b) return;
      cat = b.dataset.f;
      $$('[data-f]', filtersEl).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      apply();
    });
    input.addEventListener('input', apply);
    grid.addEventListener('click', e => {
      const b = e.target.closest('.lk-choices__more');
      if (!b) return;
      b.insertAdjacentHTML('beforebegin', JSON.parse(b.dataset.more).join(''));
      b.remove();
    });
    apply();
  }

  // ---------- Admin panel ----------
  function panelSection(readme) {
    const top = sections(readme, 2);
    return find(top, 'admin panel', 'web panel', 'dashboard', 'panel');
  }
  function panelPages(d) {
    const sec = panelSection(d.readme || '');
    const items = sec ? bullets(sections(sec.body, 3)[0].body).map(labelled).filter(Boolean) : [];
    if (items.length) return items.map(([name, text]) => ({ name, text }));
    return d.pages.filter(p => !/login/i.test(p)).map(p => ({ name: spaced(p), text: '' }));
  }
  function panel(d) {
    const host = $('#lkPanel');
    const pages = panelPages(d);
    if (!pages.length) { host.closest('.block').hidden = true; return; }
    const sec = panelSection(d.readme || '');
    const lead = sec ? intro(sections(sec.body, 3)[0].body) : '';
    // "… It has:" introduces the list below, which reads oddly on its own
    const leadText = lead.replace(/\s*\n\s*/g, ' ').replace(/\s*[^.!?]*:\s*$/, '');
    if (leadText) $('#lkPanelIntro').innerHTML = mdi(leadText);
    host.innerHTML = pages.map((p, i) => `<article class="lk-page spot" data-reveal="scale" style="--i:${i % 6}">
        <span class="pj-feat__icon"><i class="fas ${pick(PAGE_ICONS, p.name, 'fa-window-maximize')}"></i></span>
        <h3>${esc(p.name)}</h3>
        ${p.text ? `<p class="lk-clamp">${mdi(p.text)}</p><button class="lk-more" type="button" hidden>Read more <i class="fas fa-chevron-down"></i></button>` : ''}
      </article>`).join('');
    polish(host);
    const fit = () => $$('.lk-page', host).forEach(card => {
      const p = $('.lk-clamp', card), b = $('.lk-more', card);
      if (p && b && !card.classList.contains('is-open')) b.hidden = p.scrollHeight <= p.clientHeight + 2;
    });
    host.addEventListener('click', e => {
      const b = e.target.closest('.lk-more');
      if (!b) return;
      const card = b.closest('.lk-page');
      const open = card.classList.toggle('is-open');
      b.innerHTML = open ? 'Show less <i class="fas fa-chevron-up"></i>' : 'Read more <i class="fas fa-chevron-down"></i>';
    });
    requestAnimationFrame(fit);
    addEventListener('resize', fit, { passive: true });
    $$('.lk-page', host).forEach(reveal);

    // the ### guides under the panel section (logins, domains, updates, backups …)
    const guides = sec ? sections(sec.body, 3).filter(s => s.title && s.body) : [];
    const g = $('#lkGuides');
    if (!guides.length) { g.hidden = true; return; }
    g.innerHTML = `<h3 class="lk-subhead"><i class="fas fa-book-open"></i>Panel guide</h3>` + guides.map(s => `<details>
        <summary><i class="fas ${pick(GUIDE_ICONS, s.title, 'fa-circle-info')}"></i>${esc(s.title)}</summary>
        <div class="pj-faq__body lk-md">${md(s.body)}</div>
      </details>`).join('');
    polish(g);
  }

  // ---------- Get started ----------
  function envGroups(src) {
    const groups = [];
    let g = null, notes = [];
    const group = (t) => { g = { title: t, vars: [], legacy: [] }; groups.push(g); };
    src.split(/\r?\n/).forEach(rawLine => {
      const l = rawLine.trim();
      let m;
      if (!l) { notes = []; return; }
      if ((m = /^#+\s*-{2,}\s*(.+?)\s*-*\s*$/.exec(l))) { group(m[1]); notes = []; return; }
      if ((m = /^(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/.exec(l))) {
        if (!g) group('');
        g.vars.push({ key: m[1], value: m[2].replace(/\s+#.*$/, '').replace(/^["']|["']$/g, ''), note: notes.join(' ') });
        notes = [];
        return;
      }
      if ((m = /^#\s?(.*)$/.exec(l))) {
        const k = /^([A-Z][A-Z0-9_]*)\s*=/.exec(m[1]);
        if (k) { if (!g) group(''); g.legacy.push(k[1]); } else notes.push(m[1]);
      }
    });
    return groups.filter(x => x.vars.length || x.legacy.length);
  }
  function start(d) {
    const top = sections(d.readme || '', 2);
    const setup = find(top, 'setup', 'installation', 'getting started', 'install', 'quick start');
    const steps = $('#lkSetup');
    if (setup) mdInto(steps, setup.body);
    else steps.innerHTML = `<p>See the <a href="https://github.com/${REPO}#readme" target="_blank" rel="noopener">README</a> on GitHub.</p>`;

    // upgrade notes, if the README has them
    const up = find(top, 'upgrading', 'migration', 'upgrade');
    if (up) {
      const box = $('#lkUpgrade');
      box.hidden = false;
      $('summary span', box).textContent = up.title;
      mdInto($('.lk-md', box), up.body);
    }

    // configuration: .env.example
    const groups = envGroups(d.env || '');
    const env = $('#lkEnv');
    if (groups.length) {
      env.innerHTML = groups.map(gr => `<div class="lk-env__group">
          ${gr.title ? `<h4>${esc(gr.title)}</h4>` : ''}
          ${gr.vars.length ? `<dl class="lk-env">${gr.vars.map(v => `<div><dt><code>${esc(v.key)}</code>${v.value && !/^your_|_here$|^changeme$/i.test(v.value) ? `<small>${esc(v.value)}</small>` : ''}</dt>${v.note ? `<dd>${esc(v.note)}</dd>` : ''}</div>`).join('')}</dl>` : ''}
          ${gr.legacy.length ? `<p class="lk-legacy">${gr.legacy.map(k => `<code>${esc(k)}</code>`).join(' ')}</p>` : ''}
        </div>`).join('');
      polish(env);
    } else env.closest('.pj-panel').hidden = true;

    // npm scripts, described by the README where it mentions them
    const pkg = d.pkg || {};
    const scripts = Object.keys(pkg.scripts || {}).filter(k => !/^(pre|post)/.test(k));
    const descr = {};
    (d.readme || '').split(/\r?\n/).forEach(l => {
      const m = /^\s*[-*]\s+`npm\s+(?:run\s+)?([\w:.-]+)`\s*[-–—:]\s*(.+)$/.exec(l);
      if (m && !descr[m[1]]) descr[m[1]] = m[2];
    });
    const sc = $('#lkScripts');
    if (scripts.length) {
      sc.innerHTML = scripts.map(k => {
        const cmd = /^(start|test|stop|restart)$/.test(k) ? `npm ${k}` : `npm run ${k}`;
        return `<li><code>${esc(cmd)}</code><span>${descr[k] ? mdi(descr[k]) : `<code class="lk-dim">${esc(pkg.scripts[k])}</code>`}</span></li>`;
      }).join('');
    } else sc.closest('.lk-scripts').hidden = true;

    // permissions the bot needs, if listed
    const conf = find(top, 'configuration', 'permissions');
    const perm = conf && find(sections(conf.body, 3), 'bot permissions', 'permissions');
    const permList = perm ? bullets(perm.body) : [];
    const pl = $('#lkPerms');
    if (permList.length) pl.innerHTML = permList.map(p => `<li><i class="fas fa-check"></i><span>${mdi(p)}</span></li>`).join('');
    else pl.closest('.lk-perms').hidden = true;

    const kv = $('#lkKv');
    const rows = [];
    if (pkg.version) rows.push(['Version', 'v' + pkg.version]);
    if (pkg.engines && pkg.engines.node) rows.push(['Node.js', pkg.engines.node]);
    const deps = Object.assign({}, pkg.devDependencies, pkg.dependencies);
    if (deps['discord.js']) rows.push(['discord.js', ver(deps['discord.js'])]);
    if (deps.shoukaku) rows.push(['Audio', 'Lavalink via Shoukaku ' + shortVer(deps.shoukaku)]);
    kv.innerHTML = rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');
    kv.hidden = !rows.length;
  }

  // ---------- Built with ----------
  function stack(d) {
    const pkg = d.pkg || {};
    const fam = (name) => name.startsWith('@') ? name.split('/')[0] : name;
    const group = (deps) => {
      const out = new Map();
      Object.keys(deps || {}).filter(n => !n.startsWith('@types/')).forEach(n => {
        const f = fam(n);
        const k = (f.startsWith('@') && !PKG[n]) ? f : n;
        if (n === 'react-dom' && deps.react) return;
        if (!out.has(k)) out.set(k, { name: k, v: deps[n], n: 0 });
        out.get(k).n++;
      });
      return [...out.values()];
    };
    const tooling = /^(typescript|tsx|ts-node|eslint|prettier|nodemon|vitest|jest)$/;
    const dev = group(pkg.devDependencies);
    const cols = [
      ['Bot', 'fa-robot', group(pkg.dependencies)],
      ['Admin panel', 'fa-window-maximize', dev.filter(x => !tooling.test(x.name))],
      ['Tooling', 'fa-wrench', dev.filter(x => tooling.test(x.name)).concat(pkg.engines && pkg.engines.node ? [{ name: 'Node.js', v: pkg.engines.node, icon: ['devicon-nodejs-plain', '#5fa04e'] }] : [])]
    ].filter(c => c[2].length);
    const host = $('#lkStack');
    if (!cols.length) { host.closest('.block').hidden = true; return; }
    host.style.setProperty('--n', cols.length);
    host.innerHTML = cols.map(([t, ic, list]) => `<div class="pj-stack__col">
        <h3><i class="fas ${ic}"></i>${esc(t)}</h3>
        <ul>${list.map(x => { const [cls, c] = x.icon || PKG[x.name] || ['fas fa-cube', '#8ea2ff']; return `<li style="--c:${c}"><i class="${cls}"></i>${x.name.startsWith('@') || x.name === 'Node.js' ? esc(x.name) : `<a href="https://www.npmjs.com/package/${esc(x.name)}" target="_blank" rel="noopener">${esc(x.name)}</a>`}${x.n > 1 ? ` <span class="lk-dim">×${x.n}</span>` : ''}<small>${esc(ver(x.v))}</small></li>`; }).join('')}</ul>
      </div>`).join('');

    const mods = $('#lkModules');
    if (d.modules.length) {
      mods.hidden = false;
      mods.innerHTML = `<span><i class="fas fa-cubes"></i>${plural(d.modules.length, 'module')} in <code>src/utils</code></span>` + d.modules.map(m => `<a class="chip" href="${BLOB}src/utils/${esc(m)}.ts" target="_blank" rel="noopener">${esc(m)}</a>`).join('');
    }
  }
  function languages(langs) {
    const host = $('#lkLangs');
    const total = Object.values(langs || {}).reduce((a, b) => a + b, 0);
    if (!total) return;
    const list = Object.entries(langs).map(([k, v]) => [k, v / total * 100]).filter(([, p]) => p >= 0.1);
    host.hidden = false;
    host.innerHTML = `<div class="lk-langs__bar">${list.map(([k, p]) => `<i style="width:${p.toFixed(2)}%;background:${LANG[k] || '#8ea2ff'}" title="${esc(k)} ${p.toFixed(1)}%"></i>`).join('')}</div>
      <ul>${list.map(([k, p]) => `<li><i style="background:${LANG[k] || '#8ea2ff'}"></i>${esc(k)}<small>${p.toFixed(1)}%</small></li>`).join('')}</ul>`;
  }

  // ---------- Recent changes ----------
  function changes(list) {
    const host = $('#lkLog');
    if (!Array.isArray(list) || !list.length) { host.closest('.block').hidden = true; return; }
    host.innerHTML = list.map((c, i) => {
      const [head, ...rest] = c.commit.message.split('\n');
      const body = rest.map(l => l.trim().replace(/^[-*]\s+/, '')).filter(Boolean).join(' · ');
      return `<li data-reveal style="--i:${i % 8}"><a href="${esc(c.html_url)}" target="_blank" rel="noopener">
          <code>${esc(c.sha.slice(0, 7))}</code>
          <span><b>${esc(head)}</b>${body ? `<small>${esc(body.length > 160 ? body.slice(0, 157) + '…' : body)}</small>` : ''}</span>
          <time datetime="${esc(c.commit.author.date)}" title="${esc(new Date(c.commit.author.date).toLocaleString())}">${ago(c.commit.author.date)}</time>
        </a></li>`;
    }).join('');
    $$('li', host).forEach(reveal);
  }

  // ---------- Troubleshooting ----------
  function help(readme) {
    const top = sections(readme, 2);
    const sec = find(top, 'troubleshooting', 'faq', 'common problems', 'known issues');
    const host = $('#lkHelp');
    const list = sec ? sections(sec.body, 3).filter(s => s.title && s.body) : [];
    if (!list.length) { host.closest('.block').hidden = true; $('.nav-dot[data-section="help"]').remove(); return; }
    host.innerHTML = list.map((s, i) => `<details${i ? '' : ' open'}>
        <summary><i class="fas ${pick(FAQ_ICONS, s.title, 'fa-circle-question')}"></i>${esc(s.title)}</summary>
        <div class="pj-faq__body lk-md">${md(s.body)}</div>
      </details>`).join('');
    polish(host);
  }

  // ================= Hero preview: a Discord channel =================
  const TRACKS = [
    ['Midnight Drive', 'Neon Coast', 204], ['Paper Planes', 'The Lowlands', 187], ['Static Bloom', 'Aurora Kid', 232], ['Northern Lines', 'Glasshouse', 198]
  ];
  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  function demo(root) {
    const chat = $('.dc-chat', root), form = $('.dc-compose', root), input = $('input', form), menu = $('.dc-menu', root);
    const np = { i: 0, pos: 37, paused: false, loop: false, title: TRACKS[0][0], by: TRACKS[0][1], dur: TRACKS[0][2] };
    let cmds = [], sel = 0, shown = [];

    const paintNp = () => {
      $('[data-t]', root).textContent = np.title;
      $('[data-a]', root).textContent = np.by;
      $('[data-pos]', root).textContent = mmss(np.pos);
      $('[data-dur]', root).textContent = mmss(np.dur);
      $('.dc-prog b', root).style.width = (np.pos / np.dur * 100).toFixed(2) + '%';
      const pb = $('[data-act="pause"]', root);
      pb.innerHTML = `<i class="fas fa-${np.paused ? 'play' : 'pause'}"></i>`;
      pb.setAttribute('aria-label', np.paused ? 'Resume' : 'Pause');
      $('[data-act="loop"]', root).setAttribute('aria-pressed', String(np.loop));
      $('.dc-embed', root).classList.toggle('is-paused', np.paused);
    };
    const next = (dir = 1) => {
      np.i = (np.i + dir + TRACKS.length) % TRACKS.length;
      [np.title, np.by, np.dur] = TRACKS[np.i];
      np.pos = 0; np.paused = false;
      paintNp();
    };
    const tick = () => {
      if (np.paused) return;
      np.pos += 1;
      if (np.pos >= np.dur) { if (np.loop) np.pos = 0; else next(); }
      paintNp();
    };
    root.addEventListener('click', e => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const a = b.dataset.act;
      if (a === 'pause') np.paused = !np.paused;
      else if (a === 'skip') next(1);
      else if (a === 'prev') { if (np.pos > 3) np.pos = 0; else next(-1); }
      else if (a === 'loop') np.loop = !np.loop;
      paintNp();
    });

    // ----- chat -----
    const embed = $('.dc-embed', root);
    const say = (html, bot) => {
      const m = document.createElement('div');
      m.className = 'dc-msg dc-msg--new' + (bot ? ' dc-msg--bot' : '');
      m.innerHTML = bot
        ? `<span class="dc-av dc-av--bot" aria-hidden="true">L</span><div><span class="dc-who">Luko <em>BOT</em></span>${html}</div>`
        : `<span class="dc-av" aria-hidden="true"><i class="fas fa-user"></i></span><div><span class="dc-who">you</span>${html}</div>`;
      chat.appendChild(m);
      // music replies carry the player along, like the real bot's now-playing message
      const slot = $('[data-np]', m);
      if (slot) {
        const old = embed.closest('.dc-msg');
        slot.replaceWith(embed);
        if (old && !old.querySelector('p, .dc-card, .dc-embed')) old.remove();
      }
      $$('.dc-msg', chat).filter(x => !x.contains(embed)).slice(0, -5).forEach(x => x.remove());
      chat.scrollTop = chat.scrollHeight;
    };
    const run = (text) => {
      const m = /^\/(\S+)\s*([\s\S]*)$/.exec(text.trim());
      if (!m) { say(`<p>${esc(text.trim())}</p>`); return; }
      const c = cmds.find(x => x.name === m[1].toLowerCase());
      const arg = m[2].trim();
      say(`<p><span class="dc-cmd">/${esc(m[1])}</span>${arg ? ` <span class="dc-opt">${esc(arg)}</span>` : ''}</p>`);
      let reply;
      const np$ = (line) => `<p>${line}</p><div data-np></div>`;
      if (!c) reply = `<p class="dc-eph"><i class="fas fa-circle-exclamation"></i>Unknown command. Type <b>/</b> to see what Luko can do.</p>`;
      else if (c.name === 'play' && arg) {
        np.title = arg.replace(/^\w+:\s*/, '').slice(0, 60) || 'Something nice'; np.by = 'requested by you';
        np.pos = 0; np.paused = false; np.dur = 180 + Math.floor(Math.random() * 90);
        paintNp();
        reply = np$(`🎵 Added <b>${esc(np.title)}</b>`);
      }
      else if (c.name === 'pause') { np.paused = !np.paused; paintNp(); reply = `<p>${np.paused ? '⏸️ Paused' : '▶️ Resumed'}</p>`; }
      else if (c.name === 'skip') { next(1); reply = np$('⏭️ Skipped'); }
      else if (c.name === 'previous') { next(-1); reply = np$('⏮️ Back one song'); }
      else if (c.name === 'nowplaying') reply = np$('');
      else if (c.name === 'loop') { np.loop = !np.loop; paintNp(); reply = `<p>🔁 Loop ${np.loop ? 'on' : 'off'}</p>`; }
      else {
        const opts = c.subs.length ? c.subs.map(s => `<code>${esc(s.name)}</code>`).join(' ') : c.options.map(o => `<code>${esc(o.name)}${o.required ? '' : '?'}</code>`).join(' ');
        reply = `<div class="dc-card"><b>/${esc(c.name)}</b><p>${esc(c.desc)}</p>${opts ? `<p class="dc-card__opts">${opts}</p>` : ''}</div><p class="dc-eph"><i class="fas fa-eye"></i>Only you can see this · a preview, not the real bot</p>`;
      }
      setTimeout(() => say(reply, true), 380);
    };

    // ----- slash menu -----
    const close = () => { menu.hidden = true; input.setAttribute('aria-expanded', 'false'); };
    const paintMenu = () => {
      const v = input.value;
      if (!v.startsWith('/') || /\s/.test(v)) { close(); return; }
      const q = v.slice(1).toLowerCase();
      shown = cmds.filter(c => !c.owner && c.name.startsWith(q)).concat(cmds.filter(c => !c.owner && !c.name.startsWith(q) && c.name.includes(q)));
      if (!cmds.length) { menu.innerHTML = '<p class="dc-menu__empty"><i class="fas fa-spinner fa-spin"></i>Reading commands from GitHub…</p>'; menu.hidden = false; return; }
      if (!shown.length) { menu.innerHTML = '<p class="dc-menu__empty">No command starts with that.</p>'; menu.hidden = false; return; }
      sel = clamp(sel, 0, shown.length - 1);
      menu.innerHTML = `<p class="dc-menu__head">Luko · ${plural(shown.length, 'command')}</p>` + shown.map((c, i) => `<button type="button" role="option" data-i="${i}" aria-selected="${i === sel}">
          <span class="dc-av dc-av--bot" aria-hidden="true">L</span>
          <span><b>/${esc(c.name)}</b>${c.subs.length ? ` <small>${esc(c.subs.map(s => s.name).join(' · '))}</small>` : c.options.map(o => ` <small${o.required ? ' class="is-req"' : ''}>${esc(o.name)}</small>`).join('')}<em>${esc(c.desc)}</em></span>
        </button>`).join('');
      menu.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      const cur = $(`[data-i="${sel}"]`, menu);
      if (cur) cur.scrollIntoView({ block: 'nearest' });
    };
    const choose = (i) => {
      const c = shown[i];
      if (!c) return;
      const first = c.subs.length ? c.subs[0].name + ' ' : (c.options.find(o => o.required) ? c.options.find(o => o.required).name + ': ' : '');
      input.value = `/${c.name} ${first}`;
      close();
      input.focus();
    };
    input.addEventListener('input', () => { sel = 0; paintMenu(); });
    input.addEventListener('focus', () => { if (!input.value) { input.value = '/'; } paintMenu(); });
    input.addEventListener('blur', () => setTimeout(() => { close(); if (input.value === '/') input.value = ''; }, 150));
    input.addEventListener('keydown', e => {
      if (menu.hidden || !shown.length || /\s/.test(input.value)) { if (e.key === 'Escape') input.blur(); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + shown.length) % shown.length; paintMenu(); }
      // Enter on a command without options sends it; otherwise it fills the command in, like Discord
      else if (e.key === 'Tab' || (e.key === 'Enter' && (input.value.slice(1) !== shown[sel].name || shown[sel].options.length || shown[sel].subs.length))) { e.preventDefault(); choose(sel); }
      else if (e.key === 'Escape') { e.preventDefault(); close(); }
    });
    menu.addEventListener('mousedown', e => e.preventDefault());
    menu.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) choose(+b.dataset.i); });
    form.addEventListener('submit', e => {
      e.preventDefault();
      const v = input.value.trim();
      if (!v || v === '/') return;
      close();
      run(v);
      input.value = '';
    });

    paintNp();
    ticker(root, 1000, tick);
    return { setCommands(list) { cmds = list.slice().sort((a, b) => a.name.localeCompare(b.name)); if (!menu.hidden) paintMenu(); } };
  }
  // runs fn every ms while the element is on screen and the tab is visible
  function ticker(el, ms, fn) {
    let id = 0, vis = true;
    const sync = () => {
      const on = vis && !document.hidden;
      if (on && !id) id = setInterval(fn, ms);
      else if (!on && id) { clearInterval(id); id = 0; }
    };
    if ('IntersectionObserver' in window) new IntersectionObserver(es => { vis = es[es.length - 1].isIntersecting; sync(); }).observe(el);
    document.addEventListener('visibilitychange', sync);
    sync();
  }

  // ================= Boot =================
  async function load(preview) {
    const notice = $('#lkNotice');
    $('#main').classList.add('is-loading');
    let d;
    try {
      d = await bundle();
    } catch (e) {
      notice.hidden = false;
      $('#main').classList.remove('is-loading');
      $$('[data-lk-dynamic]').forEach(el => { el.innerHTML = '<p class="lk-fail">Couldn\'t read this from GitHub right now.</p>'; });
      return;
    }
    notice.hidden = !d.stale;
    $('#main').classList.remove('is-loading');
    const step = (fn) => { try { fn(); } catch (e) { console.error('[luko]', e); } };
    step(() => hero(d));
    step(() => facts(d));
    step(() => features(d.readme || ''));
    step(() => commands(d.commands));
    step(() => panel(d));
    step(() => start(d));
    step(() => stack(d));
    step(() => help(d.readme || ''));
    if (preview) preview.setCommands(d.commands);
    $('[data-lk="synced"]').textContent = ago(new Date(d.t).toISOString());

    api(`${API}/commits?per_page=8`, 'gh-commits:' + REPO).then(changes).catch(() => { $('#lkLog').closest('.block').hidden = true; });
    api(`${API}/languages`, 'gh-langs:' + REPO).then(languages).catch(() => {});
    api(API, 'gh-repo:' + REPO).then(r => {
      if (r.license && r.license.spdx_id && r.license.spdx_id !== 'NOASSERTION') { set('license', r.license.spdx_id); show('license'); }
    }).catch(() => {});
  }

  function boot() {
    const root = $('#lukoDemo');
    const preview = root ? demo(root) : null;
    $('#lkRetry').addEventListener('click', () => { try { localStorage.removeItem(CACHE); } catch (e) {} load(preview); });
    load(preview);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
