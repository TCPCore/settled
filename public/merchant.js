/* =========================================================
   Settled — merchant console behavior (catalog + seller policy)
   Plain ES2017, no dependencies. Uses the shared `Settled` client.
   ========================================================= */
(function () {
  'use strict';
  var S = window.Settled;
  if (!S) return;

  var merchantId = S.qs('merchant') || 'm1';
  var catalogPath = '/merchants/' + encodeURIComponent(merchantId) + '/catalog';
  var agentPath = '/merchants/' + encodeURIComponent(merchantId) + '/agent';
  var importPath = '/merchants/' + encodeURIComponent(merchantId) + '/catalog/import';
  var AGENT_TONES = ['consultative', 'concise', 'warm', 'formal'];
  var ADAPTER_INFO = {
    csv: { label: 'CSV upload', kind: 'csv', hint: 'Paste CSV text or choose a .csv file. Headers: sku/name/price/category/description.', placeholder: 'sku,name,price,category,description\nAURORA-ONE,Aurora One headphones,249,Audio,Reference-grade headphones.' },
    json: { label: 'JSON payload', kind: 'json', hint: 'Paste a JSON object like {"products":[...]} or choose a .json file.', placeholder: '{"products":[{"sku":"AURORA-ONE","name":"Aurora One headphones","price":249,"category":"Audio","description":"..."}]}' },
    shopify: { label: 'Shopify product payload', kind: 'json', hint: 'Payload adapter — paste a Shopify products export; no OAuth connection.', placeholder: '{"products":[{"id":1,"title":"Aurora One headphones","variants":[{"price":"249.00","sku":"AURORA-ONE"}],"product_type":"Audio","body_html":"..."}]}' },
    woocommerce: { label: 'WooCommerce product payload', kind: 'json', hint: 'Payload adapter — paste a WooCommerce products export; no OAuth connection.', placeholder: '{"products":[{"id":1,"name":"Aurora One headphones","price":"249","sku":"AURORA-ONE","categories":[{"name":"Audio"}],"description":"..."}]}' },
    feed: { label: 'Remote JSON feed', kind: 'feed', hint: 'Fetch a remote JSON catalog (array or {"products":[...]}) with a 5s server timeout.', placeholder: '' }
  };
  var IMPORT_SAMPLES = {
    csv: 'sku,name,price,category,description\nAURORA-ONE,Aurora One headphones,249,Audio,Reference-grade over-ear headphones.\nAURORA-BUDS,Aurora Buds,129,Audio,Compact wireless earbuds with 32-hour case life.',
    json: { products: [{ sku: 'AURORA-ONE', name: 'Aurora One headphones', price: 249, category: 'Audio', description: 'Reference-grade over-ear headphones.' }] },
    shopify: { products: [{ id: 1, title: 'Aurora One headphones', variants: [{ price: '249.00', sku: 'AURORA-ONE' }], product_type: 'Audio', body_html: 'Reference-grade over-ear headphones.' }] },
    woocommerce: { products: [{ id: 1, name: 'Aurora One headphones', price: '249', sku: 'AURORA-ONE', categories: [{ name: 'Audio' }], description: 'Reference-grade over-ear headphones.' }] }
  };
  var DEFAULT_GREETING = 'Hi — I’m Northwind’s seller agent. Happy to help with product questions and the published price range.';

  var state = {
    merchant: null,
    products: [],
    catalog: null,
    health: null,
    loading: false,
    agent: null,
    agentChanged: false,
    adapters: null
  };

  var el = {
    apiError: document.getElementById('apiError'),
    body: document.getElementById('merchantBody'),
    subtitle: document.getElementById('merchantSubtitle'),
    catalogList: document.getElementById('catalogList'),
    catalogCount: document.getElementById('catalogCount'),
    catalogSub: document.getElementById('catalogSub'),
    catalogFoot: document.getElementById('catalogFoot'),
    catalogMerchantId: document.getElementById('catalogMerchantId'),
    refresh: document.getElementById('refreshCatalogBtn'),
    openIndex: document.getElementById('openIndexLink'),
    preview: document.getElementById('previewLink'),
    sideIndex: document.getElementById('sideIndexLink'),
    sidePreview: document.getElementById('sidePreviewLink'),
    agentOperator: document.getElementById('agentOperator'),
    agentSettlement: document.getElementById('agentSettlement'),
    agentSettingsPanel: document.getElementById('agentSettingsPanel'),
    agentCardBadge: document.getElementById('agentCardBadge'),
    agentProfile: document.getElementById('agentProfile'),
    agentProfileAvatar: document.getElementById('agentProfileAvatar'),
    agentProfileName: document.getElementById('agentProfileName'),
    agentProfileOperator: document.getElementById('agentProfileOperator'),
    agentProfileTone: document.getElementById('agentProfileTone'),
    agentForm: document.getElementById('agentForm'),
    agentName: document.getElementById('agentName'),
    agentTone: document.getElementById('agentTone'),
    agentGreeting: document.getElementById('agentGreeting'),
    agentGreetingCount: document.getElementById('agentGreetingCount'),
    agentEnabled: document.getElementById('agentEnabled'),
    agentSaveBtn: document.getElementById('agentSaveBtn'),
    agentSaveStatus: document.getElementById('agentSaveStatus'),
    agentFormError: document.getElementById('agentFormError'),
    importForm: document.getElementById('importForm'),
    importAdapter: document.getElementById('importAdapter'),
    importAdapterBadge: document.getElementById('importAdapterBadge'),
    importHint: document.getElementById('importHint'),
    importDataField: document.getElementById('importDataField'),
    importData: document.getElementById('importData'),
    importDataHint: document.getElementById('importDataHint'),
    importFileWrap: document.getElementById('importFileWrap'),
    importFile: document.getElementById('importFile'),
    importFileName: document.getElementById('importFileName'),
    importUrlField: document.getElementById('importUrlField'),
    importUrl: document.getElementById('importUrl'),
    importSampleBtn: document.getElementById('importSampleBtn'),
    importBtn: document.getElementById('importBtn'),
    importError: document.getElementById('importError'),
    importResult: document.getElementById('importResult'),
    importResultAdapter: document.getElementById('importResultAdapter'),
    importedCount: document.getElementById('importedCount'),
    updatedCount: document.getElementById('updatedCount'),
    skippedCount: document.getElementById('skippedCount'),
    importErrors: document.getElementById('importErrors'),
    importResultFoot: document.getElementById('importResultFoot'),
    adapterList: document.getElementById('adapterList'),
    adapterCount: document.getElementById('adapterCount'),
    addForm: document.getElementById('addForm'),
    addName: document.getElementById('addName'),
    addPrice: document.getElementById('addPrice'),
    addCategory: document.getElementById('addCategory'),
    addDescription: document.getElementById('addDescription'),
    addSubmit: document.getElementById('addSubmit'),
    addError: document.getElementById('addError')
  };

  S.mountNav('merchant');
  wire();
  initAgentDefaults();
  updateImportMode();
  loadAll();

  /* --------------------------------------------------------- utils -- */
  function num(value) {
    if (value === null || value === undefined || value === '') return null;
    var n = Number(value);
    return isFinite(n) ? n : null;
  }
  function round(n) { return Math.round(Number(n) || 0); }
  function moneyShort(n) {
    if (n === null || n === undefined || n === '') return '—';
    var v = Number(n);
    if (!isFinite(v)) return '—';
    return Math.round(v) === v ? S.money0(v) : S.money(v);
  }
  function initials(name) {
    var p = String(name || '').trim().split(/\s+/);
    return ((p[0] || '')[0] || '') + ((p[1] || '')[0] || '');
  }
  function termsOf(product) {
    var n = (product && product.negotiation) || {};
    return n.terms || { delivery_days: 3, returns_days: 30, warranty_months: 12 };
  }
  function termsText(product) {
    var t = termsOf(product);
    var parts = [];
    if (t.delivery_days !== undefined) parts.push(t.delivery_days + 'd delivery');
    if (t.returns_days !== undefined) parts.push(t.returns_days + 'd returns');
    if (t.warranty_months !== undefined) parts.push(t.warranty_months + 'mo warranty');
    return parts.join(' · ');
  }

  function negotiationOf(product) {
    var price = Number(product && product.price) || 0;
    var n = (product && product.negotiation) || {};
    var floor = n.sell_min !== undefined && n.sell_min !== null ? Number(n.sell_min) : round(price * 0.82);
    var auto = n.auto_accept !== undefined && n.auto_accept !== null ? Number(n.auto_accept) : round(price * 0.95);
    return {
      negotiable: n.negotiable !== false,
      listed: n.listed !== false,
      sell_min: floor,
      sell_max: n.sell_max !== undefined && n.sell_max !== null ? Number(n.sell_max) : round(price),
      publish_min: n.publish_min !== undefined && n.publish_min !== null ? Number(n.publish_min) : round(floor * 1.05),
      publish_max: n.publish_max !== undefined ? (n.publish_max === null ? null : Number(n.publish_max)) : round(price),
      auto_accept: auto,
      max_discount_pct: n.max_discount_pct !== undefined && n.max_discount_pct !== null ? Number(n.max_discount_pct) : 18,
      terms: n.terms || { delivery_days: 3, returns_days: 30, warranty_months: 12 }
    };
  }

  /* ---------------------------------------------------------- boot -- */
  async function loadAll() {
    state.loading = true;
    setBusy(el.refresh, true);
    el.apiError.hidden = true;
    try {
      var results = await Promise.all([
        S.api(catalogPath).catch(function (err) { return { __error: err }; }),
        S.api('/health').catch(function () { return null; }),
        S.api('/adapters').catch(function () { return null; })
      ]);
      state.health = results[1] || null;
      state.adapters = results[2] || null;
      if (state.health) S.setEnv(state.health.mode);
      renderAdapterList();
      if (results[0] && results[0].__error) throw results[0].__error;
      var catalog = results[0] && (results[0].catalog || results[0]);
      applyCatalog(catalog, null, false);
      setBusy(el.refresh, false);
    } catch (err) {
      state.loading = false;
      setBusy(el.refresh, false);
      S.showApiError(el.apiError, err, function () { el.apiError.hidden = true; loadAll(); });
      el.catalogList.innerHTML = '<div class="catalog-empty"><strong>Catalog unavailable</strong>' + S.esc((err && err.message) || 'The catalog API did not respond.') + '</div>';
      S.toast((err && err.message) || 'Could not load catalog.', 'err');
    }
  }

  async function refreshCatalog(highlightId) {
    if (state.loading) return;
    state.loading = true;
    setBusy(el.refresh, true);
    try {
      var res = await S.api(catalogPath);
      applyCatalog(res && (res.catalog || res), highlightId, false);
      setBusy(el.refresh, false);
    } catch (err) {
      state.loading = false;
      setBusy(el.refresh, false);
      S.toast((err && err.message) || 'Could not refresh catalog.', 'err');
    }
  }

  function applyCatalog(catalog, highlightId, announce) {
    state.loading = false;
    if (!catalog) return;
    if (catalog.products) {
      state.catalog = catalog;
      state.merchant = catalog.merchant || state.merchant;
      state.products = catalog.products.slice();
    } else if (catalog.product) {
      var idx = state.products.map(function (p) { return p.id; }).indexOf(catalog.product.id);
      if (idx >= 0) state.products[idx] = catalog.product;
      else state.products.push(catalog.product);
    }
    var incomingAgent = catalog.agent || (catalog.merchant && catalog.merchant.agent) || null;
    if (incomingAgent) {
      var normalized = normalizeAgent(incomingAgent);
      if (!state.agent || JSON.stringify(normalized) !== JSON.stringify(state.agent)) {
        state.agent = normalized;
        state.agentChanged = true;
      }
    } else if (!state.agent) {
      state.agent = normalizeAgent(null);
      state.agentChanged = true;
    }
    if (state.merchant && state.agent) state.merchant.agent = state.agent;
    renderAll();
    if (highlightId) highlightProduct(highlightId);
    if (announce) S.toast(announce, 'ok');
  }

  function renderAll() {
    renderMerchant();
    renderAgentProfile();
    if (state.agentChanged) {
      renderAgentForm();
      state.agentChanged = false;
    }
    renderCatalog();
    updateLinks();
    if (state.merchant) S.setNavMerchant(state.merchant);
  }

  function renderMerchant() {
    var m = state.merchant || {};
    var tier = S.tierInfo(m.tier);
    var mode = S.modeInfo(m.mode);
    var count = state.products.length;
    el.subtitle.textContent = (m.name || 'This merchant') + ' · tier ' + (m.tier || '—') + ' · ' + count + ' product' + (count === 1 ? '' : 's') +
      '. Set the private sell range and the published range buyers see; the seller agent can negotiate only inside them.';
    el.catalogSub.textContent = 'Products, published ranges and seller-agent policy. Private sell ranges stay in this console.';
    el.catalogMerchantId.textContent = m.id || merchantId;
    el.agentOperator.textContent = m.name || 'Northwind Audio';
    el.agentSettlement.textContent = (mode.short || 'Instant') + ' capture · tier ' + (m.tier || '—');
    el.catalogFoot.textContent = 'Saves update the in-memory catalog instantly; the public index reflects published ranges only.';
  }

  /* ------------------------------------------------ seller agent -- */
  function normalizeAgent(raw) {
    var a = raw || {};
    var name = typeof a.name === 'string' && a.name.trim() ? a.name.trim() : 'Northwind Seller Agent';
    var tone = AGENT_TONES.indexOf(String(a.tone || '').toLowerCase()) >= 0 ? String(a.tone).toLowerCase() : 'consultative';
    var greeting = typeof a.greeting === 'string' ? a.greeting : DEFAULT_GREETING;
    return { name: name, tone: tone, greeting: greeting, enabled: a.enabled !== false };
  }

  function extractAgent(res) {
    if (!res) return null;
    var candidates = [
      res.agent,
      res.merchant && res.merchant.agent,
      res.catalog && res.catalog.agent,
      res.catalog && res.catalog.merchant && res.catalog.merchant.agent
    ];
    for (var i = 0; i < candidates.length; i++) {
      var c = candidates[i];
      if (c && typeof c === 'object' && (c.name !== undefined || c.tone !== undefined || c.greeting !== undefined || c.enabled !== undefined)) return c;
    }
    if (res.name !== undefined || res.tone !== undefined || res.greeting !== undefined || res.enabled !== undefined) return res;
    return null;
  }

  function initAgentDefaults() {
    state.agent = normalizeAgent(null);
    state.agentChanged = false;
    renderAgentProfile();
    renderAgentForm();
  }

  function renderAgentProfile() {
    var a = state.agent || normalizeAgent(null);
    var merchantName = (state.merchant && state.merchant.name) || 'Northwind Audio';
    var paused = a.enabled === false;
    if (el.agentProfileAvatar) el.agentProfileAvatar.textContent = initials(a.name) || 'NS';
    if (el.agentProfileName) el.agentProfileName.textContent = a.name;
    if (el.agentProfileOperator) el.agentProfileOperator.textContent = merchantName + ' · seller agent';
    if (el.agentProfileTone) el.agentProfileTone.textContent = a.tone;
    if (el.agentProfile) el.agentProfile.classList.toggle('is-paused', paused);
    if (el.agentCardBadge) {
      el.agentCardBadge.textContent = paused ? 'paused' : 'active';
      el.agentCardBadge.className = 'badge ' + (paused ? 'gold' : 'emerald');
    }
  }

  function renderAgentForm() {
    var a = state.agent || normalizeAgent(null);
    el.agentName.value = a.name;
    el.agentTone.value = a.tone;
    el.agentGreeting.value = a.greeting;
    el.agentEnabled.checked = a.enabled !== false;
    el.agentFormError.textContent = '';
    updateAgentGreetingCount();
    setAgentStatus('All changes saved', 'saved');
  }

  function readAgentForm() {
    return {
      name: (el.agentName.value || '').trim(),
      tone: el.agentTone.value,
      greeting: el.agentGreeting.value || '',
      enabled: !!el.agentEnabled.checked
    };
  }

  function updateAgentGreetingCount() {
    if (!el.agentGreetingCount) return;
    var len = (el.agentGreeting.value || '').length;
    el.agentGreetingCount.textContent = len + ' / 200';
    el.agentGreetingCount.classList.toggle('near', len >= 180);
  }

  function setAgentStatus(text, cls) {
    if (!el.agentSaveStatus) return;
    el.agentSaveStatus.textContent = text;
    el.agentSaveStatus.className = 'agent-save-status' + (cls ? ' ' + cls : '');
  }

  function isAgentDirty() {
    var a = state.agent || normalizeAgent(null);
    var f = readAgentForm();
    return f.name !== a.name || f.tone !== a.tone || f.greeting !== a.greeting || f.enabled !== a.enabled;
  }

  function markAgentDirty() {
    el.agentFormError.textContent = '';
    updateAgentGreetingCount();
    if (isAgentDirty()) setAgentStatus('Unsaved changes', 'dirty');
    else setAgentStatus('All changes saved', 'saved');
  }

  function validateAgentForm(f) {
    var errors = [];
    if (!f.name) errors.push('Agent name is required.');
    else if (f.name.length > 60) errors.push('Agent name must be 60 characters or fewer.');
    if (AGENT_TONES.indexOf(f.tone) < 0) errors.push('Tone must be consultative, concise, warm or formal.');
    if (f.greeting.length > 200) errors.push('Greeting must be 200 characters or fewer.');
    return errors;
  }

  async function saveAgent(event) {
    if (event) event.preventDefault();
    if (el.agentSaveBtn.disabled) return;
    var form = readAgentForm();
    var errors = validateAgentForm(form);
    if (errors.length) {
      el.agentFormError.textContent = errors[0];
      setAgentStatus('Not saved', 'err');
      S.toast(errors[0], 'err');
      return;
    }
    var saved = state.agent || normalizeAgent(null);
    var diff = {};
    ['name', 'tone', 'greeting', 'enabled'].forEach(function (key) {
      if (form[key] !== saved[key]) diff[key] = form[key];
    });
    if (!Object.keys(diff).length) {
      el.agentFormError.textContent = '';
      setAgentStatus('No changes to save', 'saved');
      return;
    }
    el.agentFormError.textContent = '';
    el.agentSaveBtn.disabled = true;
    el.agentSaveBtn.classList.add('is-busy');
    setAgentStatus('Saving…', 'saving');
    try {
      var res = await S.api(agentPath, { method: 'PATCH', body: diff });
      var returned = extractAgent(res);
      var merged = normalizeAgent(Object.assign({}, saved, diff, returned || {}));
      state.agent = merged;
      state.agentChanged = false;
      if (state.merchant) state.merchant.agent = merged;
      renderAgentProfile();
      renderAgentForm();
      setAgentStatus('Saved just now', 'saved');
      S.toast('Agent settings saved.', 'ok');
    } catch (err) {
      setAgentStatus('Save failed', 'err');
      el.agentFormError.textContent = (err && err.message) || 'Could not save agent settings.';
      S.toast((err && err.message) || 'Could not save agent settings.', 'err');
    } finally {
      el.agentSaveBtn.disabled = false;
      el.agentSaveBtn.classList.remove('is-busy');
    }
  }

  /* ------------------------------------------------- import catalog -- */
  function renderAdapterList() {
    var data = state.adapters;
    var inventory = data && Array.isArray(data.inventory) ? data.inventory : [];
    if (el.adapterCount) el.adapterCount.textContent = inventory.length ? String(inventory.length) : '—';
    if (!inventory.length) {
      el.adapterList.innerHTML = '<div class="import-loading">Registry unavailable — reload after the adapter API deploys.</div>';
      return;
    }
    el.adapterList.innerHTML = inventory.map(function (a) {
      var status = String(a.status || 'roadmap').toLowerCase();
      var ready = status === 'ready';
      var payload = String(a.mode || '').toLowerCase() === 'payload';
      return '<div class="adapter-row">' +
        '<div class="adapter-row-body">' +
          '<div class="adapter-row-name">' + S.esc(a.name || a.id || 'adapter') + '</div>' +
          '<div class="adapter-row-mode">' + S.esc(a.mode || 'push') + ' · ' + S.esc(a.id || '') + '</div>' +
          (payload ? '<div class="adapter-payload">payload adapter · no OAuth yet</div>' : '') +
        '</div>' +
        '<span class="badge ' + (ready ? 'emerald' : 'gold') + '">' + S.esc(status) + '</span>' +
      '</div>';
    }).join('');
  }

  function currentAdapter() {
    return el.importAdapter.value || 'csv';
  }

  function updateImportMode() {
    var adapter = currentAdapter();
    var info = ADAPTER_INFO[adapter] || ADAPTER_INFO.csv;
    var feed = adapter === 'feed';
    el.importHint.textContent = info.hint;
    el.importDataField.hidden = feed;
    el.importFileWrap.hidden = feed;
    el.importUrlField.hidden = !feed;
    el.importSampleBtn.hidden = feed;
    el.importAdapterBadge.textContent = adapter;
    el.importDataHint.textContent = adapter === 'csv' ? 'CSV text' : 'JSON payload';
    el.importData.placeholder = info.placeholder || '';
    el.importFile.setAttribute('accept', adapter === 'csv' ? '.csv,text/csv' : '.json,application/json');
    el.importError.textContent = '';
  }

  function loadImportFile() {
    var file = el.importFile.files && el.importFile.files[0];
    if (!file) {
      el.importFileName.textContent = 'No file selected';
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      el.importError.textContent = 'File is larger than 2 MB.';
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      el.importData.value = String(reader.result || '');
      el.importFileName.textContent = file.name;
      el.importError.textContent = '';
    };
    reader.onerror = function () {
      el.importError.textContent = 'Could not read that file.';
    };
    reader.readAsText(file);
  }

  function loadImportSample() {
    var adapter = currentAdapter();
    if (adapter === 'feed') return;
    var sample = IMPORT_SAMPLES[adapter];
    if (sample === undefined) return;
    el.importData.value = typeof sample === 'string' ? sample : JSON.stringify(sample, null, 2);
    el.importFileName.textContent = 'Sample payload';
    el.importError.textContent = '';
  }

  function importErrorText(e) {
    if (typeof e === 'string') return e;
    if (e && typeof e === 'object') {
      var bits = [];
      if (e.row !== undefined) bits.push('row ' + e.row);
      if (e.sku) bits.push('sku ' + e.sku);
      if (e.id !== undefined && e.id !== null) bits.push('id ' + e.id);
      if (e.message) bits.push(e.message);
      else if (e.error) bits.push(e.error);
      else bits.push(JSON.stringify(e));
      return bits.join(': ');
    }
    return String(e);
  }

  function renderImportResult(res, adapter) {
    var data = res || {};
    el.importedCount.textContent = String(Number(data.imported) || 0);
    el.updatedCount.textContent = String(Number(data.updated) || 0);
    el.skippedCount.textContent = String(Number(data.skipped) || 0);
    el.importResultAdapter.textContent = adapter;
    el.importResult.hidden = false;
    var errors = Array.isArray(data.errors) ? data.errors : (data.errors ? [data.errors] : []);
    if (errors.length) {
      el.importErrors.hidden = false;
      el.importErrors.innerHTML = errors.map(function (e) {
        return '<li>' + S.esc(importErrorText(e)) + '</li>';
      }).join('');
    } else {
      el.importErrors.hidden = true;
      el.importErrors.innerHTML = '';
    }
    el.importResultFoot.textContent = 'Catalog refreshing…';
  }

  function importFail(message) {
    el.importError.textContent = message;
    S.toast(message, 'err');
  }

  async function runImport(event) {
    if (event) event.preventDefault();
    if (el.importBtn.disabled) return;
    var adapter = currentAdapter();
    el.importError.textContent = '';
    el.importResult.hidden = true;
    var body;
    if (adapter === 'feed') {
      var url = (el.importUrl.value || '').trim();
      if (!url) return importFail('Enter a feed URL.');
      try {
        var parsedUrl = new URL(url);
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') throw new Error('bad protocol');
      } catch (e) {
        return importFail('Feed URL must be a valid http(s) URL.');
      }
      body = { adapter: 'feed', url: url };
    } else {
      var raw = el.importData.value || '';
      if (!raw.trim()) return importFail('Paste a payload or choose a file.');
      if (adapter === 'csv') {
        body = { adapter: 'csv', data: raw };
      } else {
        var parsed;
        try {
          parsed = JSON.parse(raw);
        } catch (e) {
          return importFail('Payload is not valid JSON: ' + e.message);
        }
        if (!parsed || typeof parsed !== 'object') return importFail('Payload must be a JSON object.');
        body = { adapter: adapter, data: parsed };
      }
    }
    var before = {};
    state.products.forEach(function (p) { if (p && p.id) before[p.id] = JSON.stringify(p); });
    el.importBtn.disabled = true;
    el.importBtn.classList.add('is-busy');
    try {
      var res = await S.api(importPath, { method: 'POST', body: body });
      renderImportResult(res, adapter);
      var products = res && Array.isArray(res.products) ? res.products : [];
      var changed = products.filter(function (p) { return p && p.id && (!before[p.id] || JSON.stringify(p) !== before[p.id]); });
      var highlightId = changed.length ? changed[0].id : null;
      await refreshCatalog(highlightId);
      el.importResultFoot.textContent = highlightId ? 'Catalog refreshed — imported/updated items highlighted below.' : 'Catalog refreshed.';
      var counts = [];
      if (res && res.imported !== undefined) counts.push(res.imported + ' imported');
      if (res && res.updated !== undefined) counts.push(res.updated + ' updated');
      if (res && res.skipped !== undefined) counts.push(res.skipped + ' skipped');
      var hasErrors = res && Array.isArray(res.errors) && res.errors.length > 0;
      S.toast('Import complete' + (counts.length ? ' · ' + counts.join(' · ') : '') + '.', hasErrors ? 'warn' : 'ok');
    } catch (err) {
      el.importError.textContent = (err && err.message) || 'Import failed.';
      S.toast((err && err.message) || 'Import failed.', 'err');
    } finally {
      el.importBtn.disabled = false;
      el.importBtn.classList.remove('is-busy');
    }
  }

  function updateLinks() {
    var m = state.merchant || {};
    var id = m.id || merchantId;
    var productId = (state.products[0] && state.products[0].id) || 'p1';
    var negotiate = 'negotiate.html?merchant=' + encodeURIComponent(id) + '&product=' + encodeURIComponent(productId);
    el.preview.href = negotiate;
    el.sidePreview.href = negotiate;
    el.openIndex.href = 'market.html';
    el.sideIndex.href = 'market.html';
  }

  /* ------------------------------------------------------- catalog -- */
  function renderCatalog() {
    var products = state.products;
    el.catalogCount.textContent = String(products.length);
    if (!products.length) {
      el.catalogList.innerHTML = '<div class="catalog-empty"><strong>No products yet</strong>Add the first product below; its default ranges will be derived from the list price.</div>';
      return;
    }
    el.catalogList.innerHTML = products.map(function (product) {
      return productCard(product);
    }).join('');
    Array.prototype.forEach.call(el.catalogList.querySelectorAll('.product-row'), function (row) {
      updatePreview(row);
    });
  }

  function productCard(product) {
    var n = negotiationOf(product);
    var price = Number(product.price) || 0;
    var category = product.category || 'Uncategorized';
    var thumb = initials(category.replace(/[^A-Za-z ]/g, '')) || initials(product.name) || 'PR';
    var categorySafe = S.esc(category);
    return '<article class="product-row" data-product="' + S.esc(product.id) + '">' +
      '<div class="pr-head">' +
        '<span class="pr-thumb">' + S.esc(thumb) + '</span>' +
        '<div class="pr-id">' +
          '<div class="pr-name" title="' + S.esc(product.name) + '">' + S.esc(product.name) + '</div>' +
          '<div class="pr-meta"><span>#' + S.esc(product.id) + '</span><span class="cat">' + categorySafe + '</span><span>' + S.esc(S.money0(price)) + '</span><span>' + S.esc(termsText(product)) + '</span></div>' +
        '</div>' +
        '<div class="pr-head-right">' +
          '<label class="switch"><input type="checkbox" data-field="negotiable"' + (n.negotiable ? ' checked' : '') + '><span class="switch-track"></span><span>Negotiable</span></label>' +
          '<label class="switch"><input type="checkbox" data-field="listed"' + (n.listed ? ' checked' : '') + '><span class="switch-track"></span><span>Listed</span></label>' +
          '<button class="pr-save" type="button" data-save>Save</button>' +
        '</div>' +
      '</div>' +
      '<div class="pr-fields">' +
        '<div class="pr-group private">' +
          '<div class="pr-group-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>Private range (never public)</div>' +
          '<div class="pr-inputs">' +
            field('sell_min', 'sell_min', n.sell_min, 'Private floor') +
            field('sell_max', 'sell_max', n.sell_max, 'Private ceiling') +
          '</div>' +
        '</div>' +
        '<div class="pr-group public">' +
          '<div class="pr-group-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></svg>Published range (public)</div>' +
          '<div class="pr-inputs">' +
            field('publish_min', 'publish_min', n.publish_min, 'Public “from”') +
            field('publish_max', 'publish_max', n.publish_max, 'Public ceiling (blank = from)') +
          '</div>' +
        '</div>' +
        '<div class="pr-group policy">' +
          '<div class="pr-group-label">Agent policy</div>' +
          '<div class="pr-inputs">' +
            field('auto_accept', 'auto_accept', n.auto_accept, 'Standing accept price') +
            field('max_discount_pct', 'max_discount_pct', n.max_discount_pct, 'Max discount %') +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="pr-foot">' +
        '<div class="pr-preview" data-preview></div>' +
        '<div class="pr-actions"><span class="pr-status" data-status>Saved</span></div>' +
      '</div>' +
    '</article>';
  }

  function field(name, label, value, hint) {
    var v = value === null || value === undefined ? '' : value;
    return '<label class="pr-field" title="' + S.esc(hint) + '"><span class="pf-label">' + S.esc(label) + '</span>' +
      '<input class="m-input" type="number" step="1" min="0" data-field="' + S.esc(name) + '" value="' + S.esc(v) + '" aria-label="' + S.esc(label) + '"></label>';
  }

  function rowFor(productId) {
    return el.catalogList.querySelector('.product-row[data-product="' + cssEscape(productId) + '"]');
  }
  function cssEscape(value) {
    if (window.CSS && window.CSS.escape) return window.CSS.escape(String(value));
    return String(value).replace(/["\\]/g, '\\$&');
  }

  function readFields(row) {
    function input(name) { return row.querySelector('[data-field="' + name + '"]'); }
    var publishMax = input('publish_max').value.trim();
    return {
      negotiable: input('negotiable').checked,
      listed: input('listed').checked,
      sell_min: num(input('sell_min').value),
      sell_max: num(input('sell_max').value),
      publish_min: num(input('publish_min').value),
      publish_max: publishMax === '' ? null : num(publishMax),
      auto_accept: num(input('auto_accept').value),
      max_discount_pct: num(input('max_discount_pct').value)
    };
  }

  function validateProduct(product, fields) {
    var price = Number(product.price) || 0;
    var errors = [];
    function requirePositive(key) {
      if (fields[key] === null || fields[key] <= 0) errors.push(key + ' must be greater than 0');
    }
    ['sell_min', 'sell_max', 'publish_min', 'auto_accept'].forEach(requirePositive);
    if (fields.sell_min !== null && fields.sell_max !== null && fields.sell_min > fields.sell_max) errors.push('sell_min must be ≤ sell_max');
    if (fields.sell_max !== null && fields.sell_max > price) errors.push('sell_max must be ≤ list price (' + S.money0(price) + ')');
    if (fields.publish_min !== null && fields.sell_min !== null && fields.publish_min < fields.sell_min) errors.push('publish_min must be ≥ sell_min');
    if (fields.publish_max !== null && fields.publish_max !== undefined) {
      if (fields.publish_min !== null && fields.publish_max < fields.publish_min) errors.push('publish_max must be ≥ publish_min');
      if (fields.sell_max !== null && fields.publish_max > fields.sell_max) errors.push('publish_max must be ≤ sell_max');
    }
    if (fields.auto_accept !== null) {
      if (fields.sell_min !== null && fields.auto_accept < fields.sell_min) errors.push('auto_accept must be ≥ sell_min');
      if (fields.sell_max !== null && fields.auto_accept > fields.sell_max) errors.push('auto_accept must be ≤ sell_max');
    }
    if (fields.max_discount_pct === null || fields.max_discount_pct < 0 || fields.max_discount_pct > 50) errors.push('max_discount_pct must be 0–50');
    return errors;
  }

  function setStatus(row, text, cls) {
    var status = row.querySelector('[data-status]');
    if (!status) return;
    status.textContent = text;
    status.className = 'pr-status' + (cls ? ' ' + cls : '');
  }

  function markDirty(row) {
    row.classList.remove('is-saved');
    row.classList.add('is-dirty');
    setStatus(row, 'Unsaved changes', 'dirty');
    updatePreview(row);
  }

  function updatePreview(row) {
    var productId = row.getAttribute('data-product');
    var product = state.products.filter(function (p) { return p.id === productId; })[0];
    if (!product) return;
    var fields;
    try { fields = readFields(row); } catch (e) { return; }
    var preview = row.querySelector('[data-preview]');
    if (!preview) return;
    var parts = [];
    if (!fields.negotiable) {
      parts.push('<span class="off">Fixed price</span>');
    } else {
      if (fields.publish_max === null || fields.publish_max === undefined) {
        parts.push('Buyers see <b>from ' + S.esc(moneyShort(fields.publish_min)) + '</b> <span class="off">(open ceiling)</span>');
      } else {
        parts.push('Buyers see <b>from ' + S.esc(moneyShort(fields.publish_min)) + '</b> to <b>' + S.esc(moneyShort(fields.publish_max)) + '</b>');
      }
      parts.push('auto-accept <b class="pub">' + S.esc(moneyShort(fields.auto_accept)) + '</b>');
      parts.push('max <b class="off">' + S.esc(fields.max_discount_pct === null ? '—' : fields.max_discount_pct + '%') + '</b> off');
    }
    if (!fields.listed) parts.push('<span class="off">hidden from index</span>');
    preview.innerHTML = parts.join(' · ');
  }

  async function saveRow(row) {
    var productId = row.getAttribute('data-product');
    var product = state.products.filter(function (p) { return p.id === productId; })[0];
    if (!product) return;
    var fields = readFields(row);
    var errors = validateProduct(product, fields);
    Array.prototype.forEach.call(row.querySelectorAll('.m-input'), function (input) { input.removeAttribute('aria-invalid'); });
    if (errors.length) {
      setStatus(row, errors[0], 'err');
      S.toast(errors[0], 'err');
      return;
    }
    var btn = row.querySelector('[data-save]');
    if (!btn) return;
    btn.disabled = true;
    btn.classList.add('is-busy');
    setStatus(row, 'Saving…', 'saving');
    try {
      var res = await S.api(catalogPath + '/' + encodeURIComponent(productId), {
        method: 'PATCH',
        body: patchBody(fields)
      });
      var catalog = res && (res.catalog || res);
      applyCatalog(catalog && catalog.products ? catalog : { product: (res && res.product) || product }, productId, false);
      var savedRow = rowFor(productId);
      if (savedRow) {
        savedRow.classList.add('is-saved');
        setStatus(savedRow, 'Saved just now', 'saved');
        updatePreview(savedRow);
      }
      S.toast('Policy saved · ' + (product.name || productId), 'ok');
    } catch (err) {
      btn.disabled = false;
      btn.classList.remove('is-busy');
      setStatus(row, (err && err.message) || 'Save failed', 'err');
      S.toast((err && err.message) || 'Save failed.', 'err');
    }
  }

  function patchBody(fields) {
    return {
      negotiation: {
        negotiable: !!fields.negotiable,
        listed: !!fields.listed,
        sell_min: fields.sell_min,
        sell_max: fields.sell_max,
        publish_min: fields.publish_min,
        publish_max: fields.publish_max,
        auto_accept: fields.auto_accept,
        max_discount_pct: fields.max_discount_pct
      }
    };
  }

  function highlightProduct(productId) {
    var row = rowFor(productId);
    if (!row) return;
    row.classList.add('is-new', 'is-saved');
    setStatus(row, 'Saved just now', 'saved');
    try { row.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) {}
    setTimeout(function () { row.classList.remove('is-new'); }, 2400);
  }

  /* ---------------------------------------------------- add product -- */
  async function addProduct(event) {
    event.preventDefault();
    if (state.loading) return;
    var name = (el.addName.value || '').trim();
    var price = num(el.addPrice.value);
    var category = (el.addCategory.value || '').trim();
    var description = (el.addDescription.value || '').trim();
    var errors = [];
    if (!name) errors.push('Product name is required.');
    if (price === null || price <= 0) errors.push('Enter a price greater than 0.');
    if (!category) errors.push('Category is required.');
    if (errors.length) {
      el.addError.textContent = errors[0];
      S.toast(errors[0], 'err');
      return;
    }
    el.addError.textContent = '';
    el.addSubmit.disabled = true;
    el.addSubmit.classList.add('is-busy');
    try {
      var res = await S.api(catalogPath, {
        method: 'POST',
        body: {
          name: name,
          price: price,
          category: category,
          description: description
        }
      });
      var product = res && res.product;
      var catalog = res && res.catalog;
      applyCatalog(catalog && catalog.products ? catalog : { products: state.products.concat(product ? [product] : []) }, product ? product.id : null, false);
      el.addName.value = '';
      el.addPrice.value = '';
      el.addCategory.value = '';
      el.addDescription.value = '';
      el.addError.textContent = '';
      if (product) {
        highlightProduct(product.id);
        S.toast('Product added · ' + product.name, 'ok');
      } else {
        await refreshCatalog();
        S.toast('Product added.', 'ok');
      }
    } catch (err) {
      el.addError.textContent = (err && err.message) || 'Could not add product.';
      S.toast((err && err.message) || 'Could not add product.', 'err');
    } finally {
      el.addSubmit.disabled = false;
      el.addSubmit.classList.remove('is-busy');
    }
  }

  /* --------------------------------------------------------- events -- */
  function wire() {
    el.refresh.addEventListener('click', function () { refreshCatalog(null); });
    el.addForm.addEventListener('submit', addProduct);
    if (el.agentForm) el.agentForm.addEventListener('submit', saveAgent);
    [el.agentName, el.agentTone, el.agentEnabled].forEach(function (node) {
      if (!node) return;
      node.addEventListener('input', markAgentDirty);
      node.addEventListener('change', markAgentDirty);
    });
    if (el.agentGreeting) {
      el.agentGreeting.addEventListener('input', markAgentDirty);
      el.agentGreeting.addEventListener('change', markAgentDirty);
    }
    if (el.importAdapter) {
      el.importAdapter.addEventListener('change', function () {
        el.importFile.value = '';
        el.importFileName.textContent = 'No file selected';
        el.importResult.hidden = true;
        updateImportMode();
      });
    }
    if (el.importFile) el.importFile.addEventListener('change', loadImportFile);
    if (el.importSampleBtn) el.importSampleBtn.addEventListener('click', loadImportSample);
    if (el.importForm) el.importForm.addEventListener('submit', runImport);

    el.catalogList.addEventListener('input', function (e) {
      var row = e.target && e.target.closest ? e.target.closest('.product-row') : null;
      if (!row || !e.target.hasAttribute('data-field')) return;
      if (e.target.getAttribute('data-field') === 'negotiable' || e.target.getAttribute('data-field') === 'listed') return;
      markDirty(row);
    });
    el.catalogList.addEventListener('change', function (e) {
      var row = e.target && e.target.closest ? e.target.closest('.product-row') : null;
      if (!row || !e.target.hasAttribute('data-field')) return;
      markDirty(row);
    });
    el.catalogList.addEventListener('click', function (e) {
      var save = e.target && e.target.closest ? e.target.closest('[data-save]') : null;
      if (!save) return;
      var row = save.closest('.product-row');
      if (row) saveRow(row);
    });
  }

  function setBusy(btn, busy) {
    if (!btn) return;
    if (busy) {
      if (btn.dataset.original === undefined) btn.dataset.original = btn.innerHTML;
      btn.disabled = true;
      btn.classList.add('is-busy');
      btn.innerHTML = '<span class="spinner"></span><span class="btn-label">Refreshing…</span>';
    } else {
      btn.disabled = false;
      btn.classList.remove('is-busy');
      if (btn.dataset.original !== undefined) {
        btn.innerHTML = btn.dataset.original;
        delete btn.dataset.original;
      }
    }
  }
})();
