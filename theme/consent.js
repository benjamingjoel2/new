/* Persocal consent gate. Loaded first, synchronously, on every page.

   Nothing that talks to another domain runs before the visitor clicks "Accept all":
   - A <script> or <iframe> whose src points at another origin is held back however it is created
     (src property, setAttribute, innerHTML, insertAdjacentHTML). Its address is kept in
     data-consent-src and the real src is set on Accept. This covers Google Analytics, reCAPTCHA,
     and anything the Squarespace runtime or the inquiry bundle adds later.
   - A held embed (YouTube, Vimeo, Spotify, maps...) shows a short note in its own box with a button
     that loads just that one player.
   - Embeds written in the page markup carry data-consent-src instead of src, so the browser never
     fetches them while parsing.

   Underneath all of that, until Accept the page carries a Content-Security-Policy that lets the browser
   itself refuse every other domain: scripts, images, video posters, fetch/XHR/beacons, and the same calls
   made from hidden helper iframes (Squarespace's Sentry reporter takes fetch from one). The policy cannot
   be lifted from a page once set, so Accept reloads the page and the reloaded page carries none. The only
   frames it allows are the embed players, and those stay behind their placeholder until clicked.

   The answer is the cookie Squarespace's own banner writes (ss_performanceCookiesAllowed), so that
   banner, this gate, theme/analytics.js and the inquiry iframe all read the same value. Pages without
   the Squarespace banner (the inquiry forms) get a small banner with the same Accept/Decline choice.

   window.persocalConsent.granted()  -> true once the visitor accepted
   window.persocalConsent.onGrant(fn) -> runs fn if the page opened with consent (Accept reloads it) */
(function () {
  'use strict';
  var PERF = 'ss_performanceCookiesAllowed', MKT = 'ss_marketingCookiesAllowed';
  var embedded = /[?&]embed=1\b/.test(location.search);

  function cookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? m[1] : null;
  }
  function granted() { return cookie(PERF) === 'true'; }
  function decided() { return cookie(PERF) !== null || cookie(MKT) !== null; }

  var wasGranted = granted();
  var held = new Set();

  // Written while the parser sits on this script, so it applies to everything after it in the page.
  if (!wasGranted && document.readyState === 'loading') {
    document.write('<meta http-equiv="Content-Security-Policy" content="' +
      "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; " +
      "connect-src 'self' https://formspree.io; " +
      "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com https://open.spotify.com https://www.google.com" +
      '">');
  }

  // ---- holding back cross-origin scripts and iframes ----------------------------------------------
  function isForeign(url) {
    try {
      var u = new URL(url, location.href);
      return /^https?:$/.test(u.protocol) && u.origin !== location.origin;
    } catch (e) { return false; }
  }

  var setAttr = Element.prototype.setAttribute;
  var getAttr = Element.prototype.getAttribute;

  var PROVIDERS = [
    [/youtube(-nocookie)?\.com|youtu\.be/, 'YouTube', 'video'],
    [/vimeo\.com/, 'Vimeo', 'video'],
    [/spotify\.com/, 'Spotify', 'playlist'],
    [/google\.[a-z.]+\/maps|maps\.google/, 'Google Maps', 'map']
  ];
  function describe(url) {
    for (var i = 0; i < PROVIDERS.length; i++) if (PROVIDERS[i][0].test(url)) return PROVIDERS[i];
    var host = ''; try { host = new URL(url, location.href).hostname.replace(/^www\./, ''); } catch (e) {}
    return [null, host || 'another site', 'content'];
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // The note lives in the iframe's own box (srcdoc), so the page layout does not change.
  function placeholder(frame, url) {
    var d = describe(url);
    setAttr.call(frame, 'srcdoc',
      '<!doctype html><meta charset="utf-8"><style>' +
      'html,body{height:100%;margin:0}body{display:flex;align-items:center;justify-content:center;' +
      'background:#f2efe9;color:#222;font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;text-align:center}' +
      'div{max-width:340px;padding:16px}button{margin-top:10px;padding:9px 16px;border:0;border-radius:4px;background:#222;color:#fff;font:inherit;cursor:pointer}' +
      '</style><div><p style="margin:0">This ' + esc(d[2]) + ' is hosted by ' + esc(d[1]) + ', which may set cookies and track your visit.</p>' +
      '<button type="button" onclick="parent.persocalConsent.load(frameElement)">Load ' + esc(d[2]) + '</button></div>');
  }

  function hold(el, value) {
    if (granted() || !isForeign(value)) return false;
    setAttr.call(el, 'data-consent-src', new URL(value, location.href).href);
    held.add(el);
    if (el instanceof HTMLIFrameElement) placeholder(el, value);
    return true;
  }

  function release(el) {
    var url = getAttr.call(el, 'data-consent-src');
    held.delete(el);
    if (!url) return;
    el.removeAttribute('data-consent-src');
    setAttr.call(el, 'src', url);
    if (el instanceof HTMLIFrameElement) el.removeAttribute('srcdoc');
  }

  [HTMLScriptElement, HTMLIFrameElement].forEach(function (C) {
    var d = Object.getOwnPropertyDescriptor(C.prototype, 'src');
    Object.defineProperty(C.prototype, 'src', {
      configurable: true, enumerable: d.enumerable,
      get: function () { var h = getAttr.call(this, 'data-consent-src'); return h !== null ? h : d.get.call(this); },
      set: function (v) { if (!hold(this, v)) d.set.call(this, v); }
    });
  });
  Element.prototype.setAttribute = function (name, value) {
    if ((this instanceof HTMLScriptElement || this instanceof HTMLIFrameElement) &&
        String(name).toLowerCase() === 'src' && hold(this, value)) return;
    return setAttr.apply(this, arguments);
  };

  // HTML strings (Squarespace video blocks, embeds): rewrite foreign src before the browser sees it.
  var TAG_SRC = /(<(?:iframe|script)\b[^>]*?\s)src\s*=\s*(["'])([^"']*)\2/gi;
  function rewrite(html) {
    if (granted() || typeof html !== 'string' || !/<(iframe|script)/i.test(html)) return html;
    return html.replace(TAG_SRC, function (all, head, q, url) {
      return isForeign(url) ? head + 'data-consent-src=' + q + url + q : all;
    });
  }
  ['innerHTML', 'outerHTML'].forEach(function (prop) {
    var d = Object.getOwnPropertyDescriptor(Element.prototype, prop);
    Object.defineProperty(Element.prototype, prop, {
      configurable: true, enumerable: d.enumerable, get: d.get,
      set: function (v) { d.set.call(this, rewrite(v)); }
    });
  });
  var insertHTML = Element.prototype.insertAdjacentHTML;
  Element.prototype.insertAdjacentHTML = function (pos, html) { return insertHTML.call(this, pos, rewrite(html)); };
  var fragment = Range.prototype.createContextualFragment;
  Range.prototype.createContextualFragment = function (html) { return fragment.call(this, rewrite(html)); };

  // fetch, XHR and beacons to other domains (Squarespace's bundled Sentry error reporter, Datadog,
  // analytics hits) are dropped until Accept. Requests the visitor asks for themselves are allowed:
  // the inquiry form posts to Formspree when they press Send.
  var ALLOWED = /^https:\/\/formspree\.io\//;
  function blocked(url) { return !granted() && isForeign(url) && !ALLOWED.test(new URL(url, location.href).href); }
  var nativeFetch = window.fetch;
  if (nativeFetch) window.fetch = function (input) {
    var url = input && typeof input === 'object' && 'url' in input ? input.url : String(input);
    return blocked(url) ? Promise.reject(new TypeError('Blocked until cookie consent: ' + url)) : nativeFetch.apply(this, arguments);
  };
  var beacon = navigator.sendBeacon;
  if (beacon) navigator.sendBeacon = function (url) { return blocked(url) ? false : beacon.apply(navigator, arguments); };
  var xhrOpen = XMLHttpRequest.prototype.open, xhrSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) { this.__consentBlocked = blocked(url); return xhrOpen.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function () {
    if (!this.__consentBlocked) return xhrSend.apply(this, arguments);
    var x = this; setTimeout(function () { x.dispatchEvent(new ProgressEvent('error')); });
  };

  // Datadog (inside the inquiry bundle) keeps a session cookie even with no token to send to.
  var cookieProp = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
  Object.defineProperty(Document.prototype, 'cookie', {
    configurable: true, enumerable: cookieProp.enumerable, get: cookieProp.get,
    set: function (v) { if (!(/^\s*_dd_s=/.test(v) && !granted())) cookieProp.set.call(this, v); }
  });

  // Held iframes that arrive from markup or HTML strings need their note. Squarespace also moves embeds
  // into a wrapper, and a moved iframe starts blank, so the note is set again on every insertion.
  function adopt(root) {
    var list = root.querySelectorAll ? [].slice.call(root.querySelectorAll('iframe[data-consent-src]')) : [];
    if (root.matches && root.matches('iframe[data-consent-src]')) list.push(root);
    list.forEach(function (f) { held.add(f); placeholder(f, getAttr.call(f, 'data-consent-src')); });
  }
  // A held iframe that still shows about:blank after the page moved it gets its note again.
  var sweepQueued = false;
  function sweep() {
    sweepQueued = false;
    if (granted()) return;
    var list = document.querySelectorAll('iframe[data-consent-src]');
    for (var i = 0; i < list.length; i++) {
      try { if (list[i].contentWindow.location.href === 'about:blank') placeholder(list[i], getAttr.call(list[i], 'data-consent-src')); } catch (e) {}
    }
  }
  // Embeds in the markup (and ones Squarespace renders later) carry data-consent-src on every visit,
  // so a visitor who accepted earlier needs them released as they appear.
  function releaseWithin(root) {
    var list = root.querySelectorAll ? [].slice.call(root.querySelectorAll('[data-consent-src]')) : [];
    if (root.hasAttribute && root.hasAttribute('data-consent-src')) list.push(root);
    list.forEach(release);
  }
  new MutationObserver(function (records) {
    var ok = granted();
    records.forEach(function (r) { r.addedNodes.forEach(function (n) { if (n.nodeType === 1) (ok ? releaseWithin : adopt)(n); }); });
    if (!ok && !sweepQueued) { sweepQueued = true; setTimeout(sweep, 50); }
  }).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('load', function () { if (granted()) releaseWithin(document); else setTimeout(sweep, 50); });

  // ---- reacting to the visitor's choice ------------------------------------------------------------
  // Analytics cookies left from an earlier "Accept" are removed once the visitor declines.
  function clearAnalyticsCookies() {
    var host = location.hostname.split('.');
    document.cookie.split('; ').forEach(function (c) {
      var name = c.split('=')[0];
      if (!/^(_ga|_gid|_gat|_gcl_|_fbp|_fbc)/.test(name)) return;
      for (var i = 0; i < host.length; i++) {
        var domain = host.slice(i).join('.');
        document.cookie = name + '=; Max-Age=0; path=/; domain=' + domain;
      }
      document.cookie = name + '=; Max-Age=0; path=/';
    });
  }

  function check() {
    var now = granted();
    // This page still carries the pre-consent policy, so start it again without one.
    if (now && !wasGranted) { wasGranted = true; location.reload(); }
    else if (!now && wasGranted) {
      // Consent withdrawn: scripts that already ran cannot be unloaded, so start the page again.
      clearAnalyticsCookies();
      location.reload();
    }
  }
  if (!wasGranted && decided()) clearAnalyticsCookies();
  ['click', 'keyup'].forEach(function (t) { document.addEventListener(t, function () { setTimeout(check, 300); }, true); });
  // Picks up a choice made in another tab or in the parent page of the inquiry panel.
  setInterval(check, 1000);

  // ---- banner for pages without the Squarespace one -------------------------------------------------
  function setChoice(accept) {
    var v = accept ? 'true' : 'false', age = 60 * 60 * 24 * 182;
    document.cookie = PERF + '=' + v + '; Max-Age=' + age + '; path=/; SameSite=Lax';
    document.cookie = MKT + '=' + v + '; Max-Age=' + age + '; path=/; SameSite=Lax';
    check();
  }
  function banner() {
    if (embedded || decided() || (window.Static && window.Static.SQUARESPACE_CONTEXT)) return;
    var bar = document.createElement('div');
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Cookie consent');
    bar.style.cssText = 'position:fixed;left:16px;right:16px;bottom:16px;z-index:2147483000;max-width:640px;margin:0 auto;' +
      'padding:16px 18px;background:#fff;color:#222;border-radius:6px;box-shadow:0 6px 30px rgba(0,0,0,.18);' +
      'font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif';
    bar.innerHTML = '<p style="margin:0 0 12px">We use cookies to understand how our site is used. ' +
      'Nothing is loaded from Google or other third parties until you accept.</p>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">' +
      '<button type="button" data-choice="0" style="padding:9px 16px;border:1px solid #222;border-radius:4px;background:#222;color:#fff;font:inherit;cursor:pointer">Decline all</button>' +
      '<button type="button" data-choice="1" style="padding:9px 16px;border:1px solid #222;border-radius:4px;background:#222;color:#fff;font:inherit;cursor:pointer">Accept all</button></div>';
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-choice]');
      if (!b) return;
      setChoice(b.getAttribute('data-choice') === '1');
      bar.remove();
    });
    document.body.appendChild(bar);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', banner);
  else banner();

  window.persocalConsent = {
    granted: granted,
    // Accept reloads the page, so this only ever runs on a page that opened with consent.
    onGrant: function (fn) { if (wasGranted) fn(); },
    // One embed, loaded because the visitor pressed its button. Consent for everything else is unchanged.
    load: function (frame) { if (frame) release(frame); }
  };
})();
