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
  function track(name, params, done) {
    var p = {}; Object.keys(params || {}).forEach(function (k) { if (params[k] !== undefined && params[k] !== '') p[k] = String(params[k]).slice(0, 100); });
    var called = false; function once() { if (!called) { called = true; if (done) done(); } }
    p.event_callback = once; p.event_timeout = 1500;
    try { gtag('event', name, p); } catch (e) { once(); }
    setTimeout(once, 1500);
  }
  window.persocalTrack = track;
  window.persocalPagePath = pagePath;

  function isWhatsApp(href) { return /(^|\/\/)(wa\.me|api\.whatsapp\.com|web\.whatsapp\.com|chat\.whatsapp\.com)\b|^whatsapp:/i.test(href); }
  document.addEventListener('click', function (ev) {
    var a = ev.target.closest && ev.target.closest('a[href]');
    if (!a || !isWhatsApp(a.getAttribute('href') || '')) return;
    var label = a.getAttribute('data-track-location') || a.getAttribute('aria-label') || (a.textContent || '').replace(/\s+/g, ' ').trim() || 'whatsapp link';
    track('whatsapp_click', { link_location: pagePath() + ' | ' + label.slice(0, 60), link_url: a.href.split('?')[0] });
  }, true);
})();
