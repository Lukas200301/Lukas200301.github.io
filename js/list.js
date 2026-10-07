/**
 * Shared listing logic for /projects, /tools and /games:
 * search, filter chips, sorting, URL state and animated cards.
 */
window.List = (function () {
  'use strict';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function init(cfg) {
    const grid = document.getElementById('grid');
    const search = document.querySelector('[data-list-search]');
    const filtersEl = document.getElementById('filters');
    const sortEl = document.getElementById('sort');
    const countEl = document.getElementById('count');
    const noun = cfg.noun || ['item', 'items'];
    const params = new URLSearchParams(location.search);
    let items = cfg.items || [];
    let q = params.get('q') || '';
    let filter = params.get('f') || 'All';
    let sort = params.get('s') || (cfg.sorters ? Object.keys(cfg.sorters)[0] : '');
    let first = true;

    if (search) search.value = q;

    // the filter bar gets its glass background only while it's stuck under the header
    const bar = document.querySelector('.list-bar');
    if (bar && 'IntersectionObserver' in window) {
      const sentinel = document.createElement('div');
      sentinel.style.cssText = 'height:1px;margin-bottom:-1px';
      bar.before(sentinel);
      const hh = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 64;
      new IntersectionObserver(([e]) => bar.classList.toggle('is-stuck', !e.isIntersecting && e.boundingClientRect.top < hh + 1),
        { rootMargin: `-${hh + 1}px 0px 0px 0px` }).observe(sentinel);
    }

    function buildFilters() {
      if (!filtersEl || !cfg.filterKeys) return;
      const counts = {};
      items.forEach(it => cfg.filterKeys(it).forEach(k => { counts[k] = (counts[k] || 0) + 1; }));
      const keys = Object.keys(counts).sort((a, b) => counts[b] - counts[a] || a.localeCompare(b)).slice(0, cfg.maxFilters || 8);
      if (filter !== 'All' && !keys.includes(filter)) filter = 'All';
      filtersEl.innerHTML = ['All'].concat(keys).map(k =>
        `<button class="filter" type="button" aria-pressed="${k === filter}" data-f="${esc(k)}">${esc(k)}</button>`).join('');
    }

    if (sortEl && cfg.sorters) {
      sortEl.innerHTML = Object.keys(cfg.sorters).map(k => `<option value="${esc(k)}"${k === sort ? ' selected' : ''}>${esc(k)}</option>`).join('');
      sortEl.addEventListener('change', () => { sort = sortEl.value; render(); sync(); });
    }

    function sync() {
      const p = new URLSearchParams();
      if (q) p.set('q', q);
      if (filter !== 'All') p.set('f', filter);
      if (cfg.sorters && sort !== Object.keys(cfg.sorters)[0]) p.set('s', sort);
      const s = p.toString();
      history.replaceState(null, '', location.pathname + (s ? '?' + s : '') + location.hash);
    }

    function render() {
      const term = q.trim().toLowerCase();
      let list = items.filter(it =>
        (filter === 'All' || (cfg.filterKeys && cfg.filterKeys(it).includes(filter))) &&
        (!term || cfg.searchText(it).toLowerCase().includes(term)));
      if (cfg.sorters && cfg.sorters[sort]) list = list.slice().sort(cfg.sorters[sort]);

      if (countEl) countEl.textContent = `${list.length} ${list.length === 1 ? noun[0] : noun[1]}${term ? ` matching “${q.trim()}”` : ''}${filter !== 'All' ? ` in ${filter}` : ''}`;

      if (!list.length) {
        grid.innerHTML = `<div class="list-empty"><b>No ${noun[1]} match that.</b>Try a shorter search or another filter.<br><button type="button" data-reset>Clear search and filters</button></div>`;
        return;
      }
      grid.innerHTML = list.map((it, i) => cfg.render(it, i)).join('');
      // cards reveal as they scroll into view, staggered across each row
      const perRow = Math.max(1, getComputedStyle(grid).gridTemplateColumns.split(' ').length);
      Array.from(grid.children).forEach((c, i) => {
        c.style.setProperty('--i', i % perRow);
        c.setAttribute('data-reveal', 'scale');
        if (window.Site && window.Site.observeReveal) window.Site.observeReveal(c);
      });
      first = false;
    }

    if (search) {
      search.addEventListener('input', () => { q = search.value; render(); sync(); });
      search.addEventListener('keydown', e => {
        if (e.key === 'Escape') { search.value = ''; q = ''; render(); sync(); search.blur(); }
        if (e.key === 'Enter') { const a = grid.querySelector('a.card, .card a.card__link'); if (a) a.click(); }
      });
    }
    if (filtersEl) filtersEl.addEventListener('click', e => {
      const b = e.target.closest('[data-f]');
      if (!b) return;
      filter = b.dataset.f;
      filtersEl.querySelectorAll('[data-f]').forEach(x => x.setAttribute('aria-pressed', x === b));
      render(); sync();
    });
    grid.addEventListener('click', e => {
      if (e.target.closest('[data-reset]')) {
        q = ''; filter = 'All'; if (search) search.value = '';
        buildFilters(); render(); sync();
      }
    });

    function setItems(next) { items = next; buildFilters(); render(); }
    setItems(items);
    return { setItems };
  }

  return { init, esc };
})();
