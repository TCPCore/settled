'use strict';
/**
 * market.js — negotiation index (/market.html).
 *
 * Reads only public data:
 *   GET /api/categories
 *   GET /api/index?category=&q=&budget=&merchant=&limit=50
 *
 * Renders merchant trust, list price, the merchant's PUBLISHED RANGE,
 * priced protection and terms, and a "Negotiate with agent" link.
 * The private floor (sell_min/sell_max/auto_accept) is never requested,
 * read or rendered here.
 */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var DEBOUNCE_SEARCH = 220;
  var DEBOUNCE_BUDGET = 180;
  var DEFAULT_SLIDER_MAX = 500;

  var state = {
    q: '',
    category: '',
    budget: '',           // '' = no cap; otherwise positive integer USD
    items: [],
    total: 0,
    merchantCount: 0,
    categories: [],
    categoriesTotal: 0,
    priceCeiling: DEFAULT_SLIDER_MAX,
    loading: false,
    error: '',
    requestSeq: 0
  };

  var el = {};

  // ---------------------------------------------------------------- helpers
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function num(value) {
    var n = Number(value);
    return isFinite(n) ? n : null;
  }

  function money(value) {
    var n = num(value);
    if (n == null) return '—';
    var fraction = Math.abs(n % 1) > 0.004 ? 2 : 0;
    try {
      return n.toLocaleString('en-US', {
        style: 'currency', currency: 'USD',
        minimumFractionDigits: fraction, maximumFractionDigits: fraction
      });
    } catch (e) {
      return '$' + n.toFixed(fraction);
    }
  }

  function debounce(fn, wait) {
    var timer = null;
    return function () {
      var args = arguments, self = this;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(self, args); }, wait);
    };
  }

  function fetchJson(url) {
    return fetch(url, {
      headers: { accept: 'application/json' },
      credentials: 'same-origin'
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url);
      return res.json();
    });
  }

  function merchantCountOf(items) {
    var seen = {};
    var n = 0;
    items.forEach(function (item) {
      var id = item && item.merchant && item.merchant.id;
      if (id && !seen[id]) { seen[id] = true; n += 1; }
    });
    return n;
  }

  // ------------------------------------------------------------- URL state
  function readInitialState() {
    var params;
    try {
      params = new URLSearchParams(window.location.search);
    } catch (e) {
      return;
    }
    state.q = (params.get('q') || '').slice(0, 120);
    state.category = (params.get('category') || '').toLowerCase().slice(0, 64);
    var budget = parseInt(params.get('budget'), 10);
    state.budget = isFinite(budget) && budget > 0 ? String(budget) : '';
  }

  function syncUrl() {
    if (!window.history || !window.history.replaceState) return;
    try {
      var params = new URLSearchParams();
      if (state.q) params.set('q', state.q);
      if (state.category) params.set('category', state.category);
      if (state.budget) params.set('budget', state.budget);
      var qs = params.toString();
      window.history.replaceState(null, '', window.location.pathname + (qs ? '?' + qs : ''));
    } catch (e) { /* sandboxed/file context — ignore */ }
  }

  function indexUrl() {
    var params = new URLSearchParams();
    if (state.category) params.set('category', state.category);
    if (state.q) params.set('q', state.q);
    if (state.budget) params.set('budget', state.budget);
    params.set('limit', '50');
    return '/api/index?' + params.toString();
  }

  // ------------------------------------------------------------- rendering
  function protectionOf(item) {
    var m = item.merchant || {};
    var p = item.protection || {};
    return {
      feeBps: num(p.fee_bps != null ? p.fee_bps : m.fee_bps),
      cap: num(p.cap != null ? p.cap : m.cap),
      mode: String(p.mode || m.mode || '').toLowerCase()
    };
  }

  function modeChip(mode) {
    var allowed = { instant: 1, reserve: 1, escrow: 1, blocked: 1 };
    var key = allowed[mode] ? mode : '';
    if (!key) return '';
    return '<span class="mode mode-' + key + '">' + esc(key) + '</span>';
  }

  function rangeOf(item) {
    var product = item.product || {};
    var pr = item.published_range || item.publishedRange || {};
    var min = num(pr.min);
    var max = num(pr.max);
    if (min == null) min = num(product.price);
    if (max == null || (min != null && max < min)) max = min;
    return { min: min, max: max };
  }

  function rangeText(range) {
    if (range.min == null) return '—';
    if (range.max == null || range.max <= range.min) return 'from ' + money(range.min);
    return money(range.min) + '–' + money(range.max);
  }

  function termsText(terms) {
    var t = terms || {};
    var parts = [];
    var delivery = num(t.delivery_days);
    var returns = num(t.returns_days);
    var warranty = num(t.warranty_months);
    if (delivery != null) parts.push(delivery + '-day delivery');
    if (returns != null) parts.push(returns + '-day returns');
    if (warranty != null) parts.push(warranty + '-mo warranty');
    return parts.length ? parts.join(' · ') : 'Standard merchant terms';
  }

  function timeOf(value) {
    if (value == null || value === '') return null;
    var t = new Date(value).getTime();
    return isFinite(t) ? t : null;
  }

  // Public negotiation window (never the private floor): {from,to} ISO/null.
  function windowOf(item) {
    if (!item || typeof item !== 'object') return null;
    var w = item.negotiation_window;
    if (!w && item.product) {
      w = item.product.negotiation_window ||
        (item.product.negotiation && item.product.negotiation.window);
    }
    if (!w || typeof w !== 'object') return null;
    var from = timeOf(w.from);
    var to = timeOf(w.to);
    if (from == null && to == null) return null;
    return { from: from, to: to };
  }

  function formatWhen(ts, withTime) {
    if (ts == null) return '';
    var d = new Date(ts);
    var opts = { month: 'short', day: 'numeric' };
    if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
    if (withTime) { opts.hour = 'numeric'; opts.minute = '2-digit'; }
    try {
      return d.toLocaleString('en-US', opts);
    } catch (e) {
      return d.toISOString().slice(0, withTime ? 16 : 10).replace('T', ' ');
    }
  }

  function windowInfo(item) {
    var w = windowOf(item);
    if (!w) return null;
    var now = Date.now();
    if (w.from != null && w.from > now) {
      return {
        cls: 'is-upcoming',
        text: 'Opens ' + formatWhen(w.from, false),
        title: 'Negotiation opens ' + formatWhen(w.from, true) +
          (w.to != null ? ' and closes ' + formatWhen(w.to, true) : '')
      };
    }
    if (w.to != null) {
      return {
        cls: 'is-open',
        text: 'Open until ' + formatWhen(w.to, true),
        title: 'Negotiation open through ' + formatWhen(w.to, true)
      };
    }
    return { cls: 'is-open', text: 'Open now', title: 'Negotiation window has no closing time' };
  }

  function negotiateUrl(item) {
    if (item.negotiate_url) return String(item.negotiate_url);
    var m = item.merchant || {};
    var p = item.product || {};
    return 'negotiate.html?merchant=' + encodeURIComponent(m.id || '') +
      '&product=' + encodeURIComponent(p.id || '');
  }

  function initials(name) {
    var words = String(name || '?').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return '?';
    var first = words[0].charAt(0);
    var second = words.length > 1 ? words[words.length - 1].charAt(0) : '';
    return (first + second).toUpperCase();
  }

  function boardSlug(name) {
    return String(name || 'other').toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'other';
  }

  function groupBoards(items) {
    var order = [];
    var map = {};
    items.forEach(function (item) {
      var p = item.product || {};
      var m = item.merchant || {};
      var slug = boardSlug(p.category || m.category || 'other');
      if (!map[slug]) { map[slug] = { slug: slug, items: [] }; order.push(map[slug]); }
      map[slug].items.push(item);
    });
    order.sort(function (a, b) { return a.slug.localeCompare(b.slug); });
    return order;
  }

  function boardLabel(slug) { return 'r/' + slug; }

  function cardHtml(item) {
    var m = item.merchant || {};
    var p = item.product || {};
    var tier = String(m.tier || '').toLowerCase();
    var tierClass = /^[abcd]$/.test(tier) ? 'tier-' + tier : 'tier-c';
    var score = num(m.score);
    var coverage = num(m.coverage);
    var protection = protectionOf(item);
    var range = rangeOf(item);
    var win = windowInfo(item);
    var category = p.category || m.category || '';
    var coverageText = coverage != null
      ? (coverage <= 1 ? Math.round(coverage * 100) + '% coverage' : Math.round(coverage) + '% coverage')
      : (m.country ? String(m.country) : 'verified merchant');
    var protBits = [];
    if (protection.feeBps != null) protBits.push(protection.feeBps + ' bps');
    if (protection.cap != null) protBits.push('cap ' + money(protection.cap));
    var protText = protBits.join(' · ') || 'priced per merchant';

    return '' +
      '<article class="mkt-card" data-merchant="' + esc(m.id || '') + '" data-product="' + esc(p.id || '') + '" data-testid="market-card">' +
        '<div class="mkt-card-top">' +
          '<div class="mkt-merchant">' +
            '<span class="mkt-avatar" aria-hidden="true">' + esc(initials(m.name)) + '</span>' +
            '<div style="min-width:0">' +
              '<div class="mkt-mname" title="' + esc(m.name || 'Merchant') + '">' + esc(m.name || 'Merchant') + '</div>' +
              '<div class="mkt-mmeta">' + esc(coverageText) + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="mkt-trust" aria-label="Merchant trust">' +
            '<span class="tier ' + tierClass + '" title="Trust tier">' + esc((tier || 'c').toUpperCase()) + '</span>' +
            '<span class="mkt-score" title="Risk score">' + (score != null ? esc(score) : '—') + '<small>/100</small></span>' +
          '</div>' +
        '</div>' +
        '<div class="mkt-prow">' +
          '<h2 class="mkt-pname">' + esc(p.name || 'Product') + '</h2>' +
          (category ? '<span class="badge mkt-pcat" title="Board ' + esc(category) + '">' + esc(boardLabel(boardSlug(category))) + '</span>' : '') +
        '</div>' +
        (p.description ? '<p class="mkt-desc">' + esc(p.description) + '</p>' : '') +
        '<div class="mkt-price-row">' +
          '<div>' +
            '<span class="mkt-lbl">List price</span>' +
            '<span class="mkt-price">' + money(p.price != null ? p.price : range.max) + '</span>' +
          '</div>' +
          '<div>' +
            '<span class="mkt-lbl">Published range</span>' +
            '<span class="mkt-pub-range">' + rangeText(range) + '</span>' +
            '<span class="mkt-pub-note">negotiable · floor private</span>' +
          '</div>' +
        '</div>' +
        '<div class="mkt-meta">' +
          (win ? '<div class="mkt-meta-row mkt-window-row">' +
            '<span class="mkt-k">Window</span>' +
            '<span class="mkt-v">' +
              '<span class="mkt-window ' + win.cls + '" data-window="' + (win.cls === 'is-upcoming' ? 'opens' : 'open-until') + '" title="' + esc(win.title) + '">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v4.2l2.7 1.6"/></svg>' +
                esc(win.text) +
              '</span>' +
            '</span>' +
          '</div>' : '') +
          '<div class="mkt-meta-row"><span class="mkt-k">Protection</span>' +
            '<span class="mkt-v">' + modeChip(protection.mode) + '<span class="mono">' + esc(protText) + '</span></span></div>' +
          '<div class="mkt-meta-row"><span class="mkt-k">Terms</span>' +
            '<span class="mkt-v">' + esc(termsText(item.terms)) + '</span></div>' +
        '</div>' +
        '<div class="mkt-card-foot">' +
                    '<a class="btn btn-primary mkt-cta" href="' + esc(negotiateUrl(item)) + '" data-action="negotiate">' +
            'Negotiate with agent' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>' +
          '</a>' +
        '</div>' +
      '</article>';
  }

  function skeletonHtml(n) {
    var out = '';
    for (var i = 0; i < n; i += 1) {
      out += '<div class="mkt-skel-card" aria-hidden="true">' +
        '<div style="display:flex;justify-content:space-between;gap:10px"><div class="skeleton" style="width:60%;height:30px"></div><div class="skeleton" style="width:52px;height:22px"></div></div>' +
        '<div class="skeleton sk-line" style="width:80%"></div>' +
        '<div class="skeleton sk-line" style="width:55%"></div>' +
        '<div class="skeleton" style="width:100%;height:52px;margin-top:2px"></div>' +
        '<div class="skeleton sk-line" style="width:70%"></div>' +
        '<div class="skeleton" style="width:100%;height:34px;margin-top:auto"></div>' +
      '</div>';
    }
    return '<div class="mkt-grid" aria-hidden="true">' + out + '</div>';
  }

  function renderCount() {
    var parts = [];
    var noun = state.total === 1 ? 'product' : 'products';
    parts.push('<b>' + state.total + '</b> ' + noun);
    if (state.merchantCount) {
      parts.push(state.merchantCount + ' merchant' + (state.merchantCount === 1 ? '' : 's'));
    }
    if (!state.category && state.items.length) {
      var boardCount = groupBoards(state.items).length;
      parts.push(boardCount + ' board' + (boardCount === 1 ? '' : 's'));
    }
    if (state.budget) {
      parts.push('<span class="budget-tag">under ' + money(Number(state.budget)) + '</span>');
    }
    el.count.innerHTML = parts.join('<span class="sep">·</span>');
  }

  function renderEmpty() {
    var hasFilters = Boolean(state.q || state.category || state.budget);
    el.results.innerHTML =
      '<div class="panel mkt-state" role="status">' +
        '<div class="mkt-state-icon" aria-hidden="true">' +
          '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/></svg>' +
        '</div>' +
        '<div class="mkt-state-title">' + (hasFilters ? 'No negotiable products match those filters' : 'No negotiable products yet') + '</div>' +
        '<div class="mkt-state-sub">' + (hasFilters
          ? 'Try a broader search, a higher budget, or another category. Only products the merchant marked as listed and negotiable, and that are inside their negotiation window, appear here.'
          : 'Merchants publish negotiable inventory here. Once one lists a product with a published range, it will show up in this index.') + '</div>' +
        (hasFilters ? '<button class="btn btn-ghost btn-sm" type="button" data-action="clear-filters">Clear filters</button>' : '') +
      '</div>';
    el.results.setAttribute('aria-busy', 'false');
  }

  function renderError(message) {
    el.results.innerHTML =
      '<div class="panel mkt-state is-error" role="alert">' +
        '<div class="mkt-state-icon" aria-hidden="true">' +
          '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8v5M12 16.5v.5"/><path d="M10.3 3.9 2.6 17.2A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg>' +
        '</div>' +
        '<div class="mkt-state-title">Could not load the negotiation index</div>' +
        '<div class="mkt-state-sub">' + esc(message || 'The index API did not respond.') + '</div>' +
        '<button class="btn btn-ghost btn-sm" type="button" data-action="retry">Try again</button>' +
      '</div>';
    el.results.setAttribute('aria-busy', 'false');
  }

  function renderItems() {
    if (state.loading) {
      el.results.innerHTML = skeletonHtml(6);
      el.results.setAttribute('aria-busy', 'true');
      return;
    }
    if (state.error) { renderError(state.error); return; }
    if (!state.items.length) { renderEmpty(); return; }
    if (state.category) {
      el.results.innerHTML =
        '<section class="mkt-board" aria-label="Board ' + esc(boardLabel(boardSlug(state.category))) + '">' +
          '<div class="mkt-board-head">' +
            '<span class="mkt-board-name"><i>r/</i>' + esc(boardSlug(state.category)) + '</span>' +
            '<span class="mkt-board-count">' + state.items.length + ' offer' + (state.items.length === 1 ? '' : 's') + '</span>' +
            '<span class="mkt-board-line" aria-hidden="true"></span>' +
          '</div>' +
          '<div class="mkt-grid">' + state.items.map(cardHtml).join('') + '</div>' +
        '</section>';
    } else {
      el.results.innerHTML = groupBoards(state.items).map(function (board) {
        return '<section class="mkt-board" aria-label="Board ' + esc(boardLabel(board.slug)) + '">' +
          '<div class="mkt-board-head">' +
            '<span class="mkt-board-name"><i>r/</i>' + esc(board.slug) + '</span>' +
            '<span class="mkt-board-count">' + board.items.length + ' offer' + (board.items.length === 1 ? '' : 's') + '</span>' +
            '<span class="mkt-board-line" aria-hidden="true"></span>' +
          '</div>' +
          '<div class="mkt-grid">' + board.items.map(cardHtml).join('') + '</div>' +
        '</section>';
      }).join('');
    }
    el.results.setAttribute('aria-busy', 'false');
  }

  function renderChips() {
    var html = '<span class="mkt-chips-label">Boards</span>' +
      '<button class="mkt-chip' + (state.category ? '' : ' is-active') + '" type="button" data-category="" aria-pressed="' + (state.category ? 'false' : 'true') + '">' +
        '<span class="nm">All boards</span><span class="n">' + (state.categoriesTotal || 0) + '</span>' +
      '</button>';
    state.categories.forEach(function (cat) {
      var id = String(cat.id || '').toLowerCase();
      if (!id) return;
      var active = state.category === id;
      html += '<button class="mkt-chip' + (active ? ' is-active' : '') + '" type="button" data-category="' + esc(id) + '" aria-pressed="' + (active ? 'true' : 'false') + '" title="' + esc(cat.name || id) + '">' +
        '<span class="nm">' + esc(boardLabel(id)) + '</span>' +
        '<span class="n">' + (num(cat.count) != null ? num(cat.count) : 0) + '</span>' +
      '</button>';
    });
    el.chips.innerHTML = html;
  }

  function updateSearchClear() {
    if (!el.searchClear) return;
    el.searchClear.classList.toggle('is-visible', Boolean(el.search.value));
  }

  function sliderMax() {
    return Math.max(DEFAULT_SLIDER_MAX, Math.ceil((state.priceCeiling || DEFAULT_SLIDER_MAX) / 50) * 50);
  }

  function updateBudgetUi() {
    var max = sliderMax();
    var budget = state.budget ? Number(state.budget) : 0;
    el.range.max = String(max);
    if (!state.budget) {
      el.range.value = String(max);
      el.budget.value = '';
      el.budget.placeholder = 'No cap';
      el.hint.innerHTML = 'No budget cap — showing every published range';
      return;
    }
    var clamped = Math.min(budget, max);
    el.range.value = String(clamped);
    if (document.activeElement !== el.budget) el.budget.value = String(clamped);
    el.hint.innerHTML = 'Showing products negotiable from ' + esc(money(clamped)) + ' or less ' +
      '<button class="mkt-budget-reset" type="button" data-action="reset-budget">Reset</button>';
  }

  // ------------------------------------------------- indexer / copy helper
  function resolveUrl(value) {
    try { return new URL(value, window.location.href).href; } catch (e) { return String(value || ''); }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    var ok = false;
    try { ta.select(); ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(function () {
        if (fallbackCopy(text)) return undefined;
        throw new Error('copy failed');
      });
    }
    if (fallbackCopy(text)) return Promise.resolve();
    return Promise.reject(new Error('copy failed'));
  }

  function flashCopied(btn, ok) {
    var label = btn.querySelector('span');
    var original = label ? label.textContent : '';
    btn.classList.toggle('is-copied', ok);
    if (label) label.textContent = ok ? 'Copied' : 'Try again';
    var live = $('mktCopyStatus');
    if (live) live.textContent = (btn.getAttribute('aria-label') || 'Value') + (ok ? ' copied to clipboard' : ' could not be copied');
    clearTimeout(btn._copyTimer);
    btn._copyTimer = setTimeout(function () {
      btn.classList.remove('is-copied');
      if (label) label.textContent = original;
    }, 1500);
  }

  function handleCopy(btn) {
    var targetSelector = btn.getAttribute('data-copy-target');
    var text = '';
    if (targetSelector) {
      var target = document.querySelector(targetSelector);
      text = target ? target.textContent : '';
    } else {
      text = resolveUrl(btn.getAttribute('data-copy') || '');
    }
    if (!text) return;
    copyText(text).then(function () { flashCopied(btn, true); })
      .catch(function () { flashCopied(btn, false); });
  }

  function setText(id, value) {
    var node = $(id);
    if (node && value) node.textContent = value;
  }

  function loadManifest() {
    fetchJson('/api/index/manifest').then(function (manifest) {
      if (!manifest) return;
      var schema = manifest.schema_version || 'settled-index/1.0';
      setText('mktSchemaBadge', schema);
      var totals = manifest.totals || {};
      var bits = [];
      if (num(totals.offers) != null) bits.push(totals.offers + ' offers');
      if (num(totals.merchants) != null) bits.push(totals.merchants + ' merchants');
      if (num(totals.categories) != null) bits.push(totals.categories + ' boards');
      if (bits.length) setText('mktManifestTotals', schema + ' · ' + bits.join(' · '));
      var endpoints = manifest.endpoints || {};
      var byKey = { manifest: '/api/index/manifest', feed: endpoints.feed, openapi: endpoints.openapi };
      Array.prototype.forEach.call(document.querySelectorAll('[data-endpoint]'), function (code) {
        var url = byKey[code.getAttribute('data-endpoint')];
        if (!url) return;
        code.textContent = url;
        var btn = code.parentNode ? code.parentNode.querySelector('[data-copy]') : null;
        if (btn) btn.setAttribute('data-copy', url);
      });
    }).catch(function () { /* static panel URLs stay as the fallback */ });
  }

  // ---------------------------------------------------------------- loading
  function loadIndex() {
    var seq = ++state.requestSeq;
    state.loading = true;
    state.error = '';
    renderItems();
    fetchJson(indexUrl()).then(function (data) {
      if (seq !== state.requestSeq) return;
      var items = Array.isArray(data) ? data : (Array.isArray(data.items) ? data.items : []);
      state.items = items;
      state.total = data && num(data.total) != null ? num(data.total) : items.length;
      state.merchantCount = merchantCountOf(items);
      state.loading = false;
      renderCount();
      renderItems();
    }).catch(function (err) {
      if (seq !== state.requestSeq) return;
      state.items = [];
      state.total = 0;
      state.merchantCount = 0;
      state.loading = false;
      state.error = (err && err.message) ? String(err.message) : 'Network error';
      renderCount();
      renderItems();
    });
  }

  function applyPriceCeiling() {
    var ceiling = 0;
    state.categories.forEach(function (cat) {
      var max = num(cat.max);
      if (max != null && max > ceiling) ceiling = max;
    });
    state.priceCeiling = ceiling || DEFAULT_SLIDER_MAX;
    if (state.budget && Number(state.budget) >= state.priceCeiling) {
      state.budget = '';
    }
    updateBudgetUi();
  }

  function loadCategories() {
    return fetchJson('/api/categories').then(function (data) {
      var cats = Array.isArray(data) ? data : (Array.isArray(data.categories) ? data.categories : []);
      state.categories = cats.filter(function (c) { return c && c.id; });
      var productTotal = num(data && data.product_total);
      state.categoriesTotal = productTotal != null
        ? productTotal
        : state.categories.reduce(function (sum, c) { return sum + (num(c.count) || 0); }, 0);
      el.allCount.textContent = String(state.categoriesTotal || 0);
      applyPriceCeiling();
      renderChips();
    }).catch(function () {
      state.categories = [];
      state.categoriesTotal = 0;
      el.allCount.textContent = '0';
      renderChips();
    });
  }

  // ------------------------------------------------------------------ events
  function setCategory(category) {
    state.category = (category || '').toLowerCase();
    Array.prototype.forEach.call(el.chips.querySelectorAll('[data-category]'), function (chip) {
      var id = chip.getAttribute('data-category') || '';
      var active = id === state.category;
      chip.classList.toggle('is-active', active);
      chip.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    syncUrl();
    loadIndex();
  }

  function clearFilters() {
    state.q = '';
    state.category = '';
    state.budget = '';
    el.search.value = '';
    updateSearchClear();
    updateBudgetUi();
    renderChips();
    syncUrl();
    loadIndex();
  }

  function bind() {
    var onSearch = debounce(function () {
      state.q = el.search.value.trim().slice(0, 120);
      updateSearchClear();
      syncUrl();
      loadIndex();
    }, DEBOUNCE_SEARCH);
    el.search.addEventListener('input', onSearch);
    el.search.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { el.search.value = ''; state.q = ''; updateSearchClear(); syncUrl(); loadIndex(); }
    });
    el.searchClear.addEventListener('click', function () {
      el.search.value = '';
      state.q = '';
      updateSearchClear();
      el.search.focus();
      syncUrl();
      loadIndex();
    });

    var onBudgetInput = debounce(function () {
      var value = parseInt(el.budget.value, 10);
      if (!isFinite(value) || value <= 0) {
        state.budget = '';
      } else if (value >= state.priceCeiling) {
        state.budget = '';
      } else {
        state.budget = String(value);
      }
      updateBudgetUi();
      syncUrl();
      loadIndex();
    }, DEBOUNCE_BUDGET);
    el.budget.addEventListener('input', onBudgetInput);

    el.range.addEventListener('input', function () {
      var value = parseInt(el.range.value, 10);
      var max = sliderMax();
      if (!isFinite(value) || value >= max) {
        state.budget = '';
      } else {
        state.budget = String(value);
      }
      updateBudgetUi();
      syncUrl();
      loadIndex();
    });

    el.hint.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action="reset-budget"]');
      if (!btn) return;
      state.budget = '';
      updateBudgetUi();
      syncUrl();
      loadIndex();
    });

    el.chips.addEventListener('click', function (e) {
      var chip = e.target.closest('[data-category]');
      if (!chip) return;
      setCategory(chip.getAttribute('data-category'));
    });

    el.results.addEventListener('click', function (e) {
      var action = e.target.closest('[data-action]');
      if (!action) return;
      var name = action.getAttribute('data-action');
      if (name === 'clear-filters') clearFilters();
      else if (name === 'retry') loadIndex();
    });

    el.budget.addEventListener('blur', function () { updateBudgetUi(); });

    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-copy],[data-copy-target]');
      if (!btn) return;
      e.preventDefault();
      handleCopy(btn);
    });
  }

  function loadConfig() {
    fetchJson('/api/config').then(function (cfg) {
      var label = cfg && cfg.mode === 'live' ? 'LIVE' : 'SIM';
      if (el.envLabel) el.envLabel.textContent = label;
    }).catch(function () { /* keep static SIM label */ });
  }

  function init() {
    el.search = $('mktSearch');
    el.searchClear = $('mktSearchClear');
    el.budget = $('mktBudget');
    el.range = $('mktBudgetRange');
    el.hint = $('mktBudgetHint');
    el.chips = $('mktChips');
    el.allCount = $('mktAllCount');
    el.count = $('mktCount');
    el.results = $('mktResults');
    el.envLabel = $('envLabel');
    if (!el.search || !el.results) return;

    readInitialState();
    el.search.value = state.q;
    updateSearchClear();
    bind();
    updateBudgetUi();
    renderChips();
    loadConfig();
    loadManifest();
    loadCategories();
    loadIndex();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());
