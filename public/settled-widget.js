/* =========================================================
   Settled drop-in negotiation widget
   Usage:
     <script src="/settled-widget.js"
             data-merchant="m1"
             data-product="p1"
             data-label="Negotiate with AI"
             data-position="bottom-right"
             data-theme="dark"
             data-inline="true"></script>

   Vanilla JS. No framework, no external assets, no network calls.
   It only builds links to /negotiate.html?merchant=...&product=...
   ========================================================= */
(function () {
  'use strict';

  var STYLE_ID = 'settled-widget-styles';
  var SHIELD_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.4 20 7.8v8.4L12 20.6 4 16.2V7.8L12 3.4Z"/><path d="m8.6 12.1 2.2 2.2 4.7-4.9"/></svg>';
  var ARROW_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7"/><path d="M9 7h8v8"/></svg>';

  var CSS = [
    '.settled-widget-float{position:fixed;z-index:2147483000;display:block;margin:0;padding:0;line-height:1;pointer-events:none}',
    '.settled-widget-bottom-right{right:20px;bottom:20px}',
    '.settled-widget-bottom-left{left:20px;bottom:20px}',
    '.settled-widget-float>.settled-widget-btn{pointer-events:auto}',
    '.settled-widget-inline{display:inline-flex;align-items:center;vertical-align:middle;margin:10px 0 0;padding:0;line-height:1;max-width:100%}',
    '.settled-widget-theme-dark{--sw-bg:#0B1220;--sw-ink:#F3F8FF;--sw-sub:#9CB1CD;--sw-border:rgba(43,217,160,.46);--sw-shadow:0 16px 40px rgba(0,0,0,.45),0 0 0 1px rgba(43,217,160,.06);--sw-icon:#042018;--sw-icon-bg:linear-gradient(145deg,#7CF3CE,#2BD9A0);--sw-arrow:#8CA5C3}',
    '.settled-widget-theme-light{--sw-bg:#FFFFFF;--sw-ink:#0B1220;--sw-sub:#5B6C83;--sw-border:rgba(11,18,32,.14);--sw-shadow:0 14px 34px rgba(11,18,32,.16),0 0 0 1px rgba(11,18,32,.04);--sw-icon:#042018;--sw-icon-bg:linear-gradient(145deg,#7CF3CE,#2BD9A0);--sw-arrow:#6D7E93}',
    '.settled-widget-btn{box-sizing:border-box;display:inline-flex;align-items:center;gap:10px;max-width:min(340px,calc(100vw - 32px));margin:0;padding:9px 14px 9px 9px;border:1px solid var(--sw-border);border-radius:999px;background:var(--sw-bg);color:var(--sw-ink);text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;font-size:13px;font-weight:650;line-height:1.1;letter-spacing:-.01em;box-shadow:var(--sw-shadow);cursor:pointer;transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease;-webkit-font-smoothing:antialiased;text-align:left;user-select:none}',
    '.settled-widget-btn:hover{transform:translateY(-1px);border-color:rgba(43,217,160,.8);box-shadow:0 20px 46px rgba(0,0,0,.4),0 0 0 1px rgba(43,217,160,.14)}',
    '.settled-widget-btn:active{transform:translateY(0)}',
    '.settled-widget-btn:focus-visible{outline:2px solid #2BD9A0;outline-offset:3px}',
    '.settled-widget-icon{width:28px;height:28px;border-radius:8px;background:var(--sw-icon-bg);color:var(--sw-icon);display:grid;place-items:center;flex:none}',
    '.settled-widget-icon svg{width:16px;height:16px;display:block}',
    '.settled-widget-copy{display:flex;flex-direction:column;gap:2px;min-width:0}',
    '.settled-widget-label{display:block;font-size:13px;font-weight:700;color:var(--sw-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.settled-widget-sub{display:block;font-size:8.5px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--sw-sub);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.settled-widget-arrow{width:15px;height:15px;display:grid;place-items:center;flex:none;color:var(--sw-arrow);margin-left:1px}',
    '.settled-widget-arrow svg{width:15px;height:15px;display:block}',
    '.settled-widget-inline .settled-widget-btn{max-width:100%;padding:10px 15px 10px 10px}',
    '@media (max-width:520px){.settled-widget-bottom-right{right:12px;bottom:12px}.settled-widget-bottom-left{left:12px;bottom:12px}.settled-widget-btn{max-width:calc(100vw - 24px);gap:8px;padding:8px 12px 8px 8px}.settled-widget-label{font-size:12px}.settled-widget-sub{font-size:7.5px}.settled-widget-arrow{display:none}}',
    '@media (prefers-reduced-motion:reduce){.settled-widget-btn{transition:none}.settled-widget-btn:hover{transform:none}}'
  ].join('');

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    (document.head || document.documentElement).appendChild(style);
  }

  function buildButton(label, href, variant) {
    var a = document.createElement('a');
    a.className = 'settled-widget-btn';
    a.setAttribute('data-settled-widget', variant);
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.setAttribute('aria-label', label + ' — opens in a new tab');
    a.title = label;

    var icon = document.createElement('span');
    icon.className = 'settled-widget-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = SHIELD_SVG;

    var copy = document.createElement('span');
    copy.className = 'settled-widget-copy';
    var labelEl = document.createElement('span');
    labelEl.className = 'settled-widget-label';
    labelEl.textContent = label;
    var sub = document.createElement('span');
    sub.className = 'settled-widget-sub';
    sub.textContent = 'agent-to-agent · PayPal';
    copy.appendChild(labelEl);
    copy.appendChild(sub);

    var arrow = document.createElement('span');
    arrow.className = 'settled-widget-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.innerHTML = ARROW_SVG;

    a.appendChild(icon);
    a.appendChild(copy);
    a.appendChild(arrow);
    return a;
  }

  var script = document.currentScript;
  if (!script || !script.dataset || script.dataset.merchant === undefined) {
    var all = document.querySelectorAll('script[src*="settled-widget.js"][data-merchant]');
    script = all.length ? all[all.length - 1] : null;
  }
  if (!script) return;

  var data = script.dataset || {};
  var merchant = (data.merchant || '').trim();
  if (!merchant) {
    if (window.console && console.warn) console.warn('[Settled widget] data-merchant is required; widget not rendered.');
    return;
  }
  var product = (data.product || '').trim();
  var label = (data.label || 'Negotiate with AI').trim().slice(0, 80) || 'Negotiate with AI';
  var position = (data.position || '').toLowerCase() === 'bottom-left' ? 'bottom-left' : 'bottom-right';
  var theme = (data.theme || '').toLowerCase() === 'light' ? 'light' : 'dark';
  var inline = String(data.inline || '').toLowerCase() === 'true';
  var href = '/negotiate.html?merchant=' + encodeURIComponent(merchant) + (product ? '&product=' + encodeURIComponent(product) : '');

  function mount() {
    injectStyles();

    var floating = document.createElement('div');
    floating.className = 'settled-widget-float settled-widget-' + position + ' settled-widget-theme-' + theme;
    floating.setAttribute('data-settled-widget-host', 'floating');
    floating.appendChild(buildButton(label, href, 'floating'));
    (document.body || document.documentElement).appendChild(floating);

    if (inline) {
      var wrap = document.createElement('span');
      wrap.className = 'settled-widget-inline settled-widget-theme-' + theme;
      wrap.setAttribute('data-settled-widget-host', 'inline');
      wrap.appendChild(buildButton(label, href, 'inline'));
      var parent = script.parentNode;
      if (parent && parent.tagName !== 'HEAD' && parent.insertBefore && document.body && document.body.contains(script)) {
        parent.insertBefore(wrap, script.nextSibling);
      } else {
        (document.body || document.documentElement).appendChild(wrap);
      }
    }
  }

  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
