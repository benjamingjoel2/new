/* Persocal analytics helpers.
   - Reuses the site's GA4 tag (G-Y7M6VQ2LF0). On pages that do not carry the Squarespace snippet
     (the inquiry forms) it loads the same tag with the same cookie-consent rule, never a second property.
   - window.persocalTrack(name, params): sends a GA4 event.
   - Every click on a WhatsApp link anywhere on the site sends "whatsapp_click" with link_location. */
(function () {
  'use strict';
  var GA_ID = 'G-Y7M6VQ2LF0';
  var embedded = /[?&]embed=1\b/.test(location.search);
  function cookie(name) { return ('; ' + document.cookie).split('; ' + name + '=').pop().split(';')[0]; }
  function consentGranted() { return cookie('ss_performanceCookiesAllowed') === 'true'; }

  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== 'function') {
    window.gtag = function () { window.dataLayer.push(arguments); };
    if (!document.querySelector('script[src*="googletagmanager.com/gtag/js"]')) {
      var s = document.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID; document.head.appendChild(s);
      gtag('js', new Date());
      gtag('consent', 'default', { analytics_storage: consentGranted() ? 'granted' : 'denied' });
      gtag('config', GA_ID, { send_page_view: !embedded });
    }
  }
  // consent given later on the same page (cookie banner) -> tell GA
  document.addEventListener('click', function () { setTimeout(function () { if (consentGranted()) gtag('consent', 'update', { analytics_storage: 'granted' }); }, 300); }, true);

  function pagePath() {
    if (embedded) { try { return window.parent.location.pathname; } catch (e) {} }
    return location.pathname;
  }
  function pageUrl() {
    if (embedded) { try { return window.parent.location.href.split('#')[0]; } catch (e) {} }
    return location.href.split('#')[0];
  }
  // gtag batches hits for up to 5 seconds. A lead is followed by a jump to WhatsApp (a new tab, or the
  // app on phones), so that batch can be lost. Conversion events are therefore sent straight away with
  // navigator.sendBeacon, using the same client and session ids gtag stores in its cookies.
  function gaIds() {
    var cid = (cookie('_ga').match(/^GA1\.\d\.(.+)$/) || [])[1] || '';
    var sc = cookie('_ga_' + GA_ID.replace(/^G-/, '')), sid = '', sct = '';
    if (sc.indexOf('GS2.') === 0) { sid = (sc.match(/\.s(\d+)/) || [])[1] || ''; sct = (sc.match(/\$o(\d+)/) || [])[1] || ''; }
    else if (sc) { var a = sc.split('.'); sid = a[2] || ''; sct = a[3] || ''; }
    return { cid: cid, sid: sid, sct: sct };
  }
  var hitCount = 0;
  function sendNow(name, params) {
    var ids = gaIds(), granted = consentGranted();
    var cid = ids.cid || (Math.floor(Math.random() * 2147483647) + '.' + Math.floor(Date.now() / 1000));
    var q = [['v', '2'], ['tid', GA_ID], ['_p', String(Math.floor(Math.random() * 2147483647))], ['cid', cid],
             ['ul', (navigator.language || '').toLowerCase()], ['sr', screen.width + 'x' + screen.height],
             ['dl', pageUrl()], ['dt', document.title], ['sid', ids.sid || String(Math.floor(Date.now() / 1000))],
             ['sct', ids.sct || '1'], ['seg', '1'], ['_s', String(++hitCount)], ['_et', '1000'],
             ['gcs', granted ? 'G111' : 'G100'], ['dma', '0'], ['npa', granted ? '0' : '1'], ['en', name]];
    if (/[?&]ga_debug=1\b/.test(location.search) || /[?&]ga_debug=1\b/.test(pageUrl())) q.push(['_dbg', '1']);
    Object.keys(params || {}).forEach(function (k) { if (params[k] !== undefined && params[k] !== '') q.push(['ep.' + k, String(params[k]).slice(0, 100)]); });
    var url = 'https://www.google-analytics.com/g/collect?' + q.map(function (kv) { return encodeURIComponent(kv[0]) + '=' + encodeURIComponent(kv[1]); }).join('&');
    var sent = false;
    try { sent = navigator.sendBeacon(url); } catch (e) {}
    if (!sent) { try { fetch(url, { method: 'POST', keepalive: true, mode: 'no-cors', credentials: 'omit' }).catch(function () {}); } catch (e) { (new Image()).src = url; } }
    try { window.dataLayer.push({ event: 'persocal_' + name, persocal_params: params || {} }); } catch (e) {}
  }
  function track(name, params, done) { sendNow(name, params); if (done) setTimeout(done, 0); }
  window.persocalTrack = track;
  window.persocalPagePath = pagePath;
  // consent given in the parent page after this panel opened: pick it up (the cookie is shared)
  if (embedded) { var tries = 0; var ct = setInterval(function () { if (consentGranted()) { gtag('consent', 'update', { analytics_storage: 'granted' }); clearInterval(ct); } else if (++tries > 120) clearInterval(ct); }, 1000); }

  function isWhatsApp(href) { return /(^|\/\/)(wa\.me|api\.whatsapp\.com|web\.whatsapp\.com|chat\.whatsapp\.com)\b|^whatsapp:/i.test(href); }
  document.addEventListener('click', function (ev) {
    var a = ev.target.closest && ev.target.closest('a[href]');
    if (!a || !isWhatsApp(a.getAttribute('href') || '')) return;
    var label = a.getAttribute('data-track-location') || a.getAttribute('aria-label') || (a.textContent || '').replace(/\s+/g, ' ').trim() || 'whatsapp link';
    track('whatsapp_click', { link_location: pagePath() + ' | ' + label.slice(0, 60), link_url: a.href.split('?')[0] });
  }, true);
})();
