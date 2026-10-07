/* Persocal inquiry drawer: inquiry links open the inquiry page in a panel from the right instead of leaving the page. */
(function () {
  'use strict';
  if (window.top !== window.self) return; // never inside the drawer itself
  var css = '\
.pc-drawer{position:fixed;top:0;left:0;right:0;bottom:0;inset:0;z-index:2147483000;display:none}\
.pc-drawer.is-open{display:block}\
.pc-drawer:not(.is-open){display:none!important;visibility:hidden!important;pointer-events:none!important}\
.pc-drawer__backdrop{position:absolute;inset:0;background:rgba(0,0,0,.55);opacity:0;transition:opacity .3s ease}\
.pc-drawer.is-in .pc-drawer__backdrop{opacity:1}\
.pc-drawer__panel{position:absolute;top:0;right:0;bottom:0;width:50vw;min-width:560px;max-width:100vw;background:rgba(255,255,255,.84);-webkit-backdrop-filter:blur(28px) saturate(1.5);backdrop-filter:blur(28px) saturate(1.5);border-left:1px solid rgba(255,255,255,.5);box-shadow:-24px 0 60px rgba(0,0,0,.35);transform:translateX(100%);transition:transform .38s cubic-bezier(.2,.7,.2,1);display:flex;flex-direction:column}\
.pc-drawer.is-in .pc-drawer__panel{transform:none}\
.pc-drawer__close{position:absolute;top:14px;right:14px;z-index:2;width:44px;height:44px;border:0;background:#111;color:#fff;font:400 26px/44px sans-serif;cursor:pointer;padding:0}\
.pc-drawer__close:hover{background:#333}\
.pc-drawer__frame{flex:1;width:100%;border:0;background:transparent}\
.pc-drawer__loading{position:absolute;left:0;right:0;top:0;height:3px;background:linear-gradient(90deg,transparent,#111,transparent);background-size:200% 100%;animation:pcDrawerLoad 1.2s linear infinite}\
@keyframes pcDrawerLoad{from{background-position:200% 0}to{background-position:-200% 0}}\
@media (max-width:760px){.pc-drawer__panel{width:100vw;min-width:0}}\
html.pc-drawer-lock,html.pc-drawer-lock body{overflow:hidden!important}';
  var style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

  var drawer, frame, loading, lastFocus, opened = false;
  function build() {
    drawer = document.createElement('div');
    drawer.className = 'pc-drawer';
    drawer.setAttribute('role', 'dialog'); drawer.setAttribute('aria-modal', 'true'); drawer.setAttribute('aria-label', 'Inquiry');
    drawer.innerHTML = '<div class="pc-drawer__backdrop"></div><div class="pc-drawer__panel"><button type="button" class="pc-drawer__close" aria-label="Close">&times;</button><div class="pc-drawer__loading"></div><iframe class="pc-drawer__frame" title="Inquiry" allowtransparency="true"></iframe></div>';
    document.body.appendChild(drawer);
    frame = drawer.querySelector('iframe'); loading = drawer.querySelector('.pc-drawer__loading');
    drawer.querySelector('.pc-drawer__backdrop').addEventListener('click', close);
    drawer.querySelector('.pc-drawer__close').addEventListener('click', close);
    frame.addEventListener('load', function () { loading.style.display = 'none'; });
  }
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && opened) close(); });
  window.addEventListener('popstate', function () { if (opened && !(history.state && history.state.pcDrawer)) hide(); });
  var ctxMeta = document.querySelector('meta[name="persocal-inquiry"]');
  var CONTEXT = ctxMeta ? new URL(ctxMeta.getAttribute('content'), location.href).href : '';
  function isInquiry(url) {
    try { var u = new URL(url, location.href); if (u.origin !== location.origin) return false; return /(^|\/)(inquiry(\/[a-z0-9-]+)?|start)\/?(index\.html)?$/.test(u.pathname); } catch (e) { return false; }
  }
  function isGeneric(url) {
    var u = new URL(url, location.href);
    return /(^|\/)(inquiry|start)\/?(index\.html)?$/.test(u.pathname) && !u.searchParams.get('to');
  }
  function resolve(url) {
    // a generic inquiry link (header button, "start planning") on a country or interest page opens that page's own form
    if (CONTEXT && isGeneric(url)) return CONTEXT;
    // with no page context (home, about, ...) the "start" links go to the Start page itself, as on the original site
    if (/\/start\/?(index\.html)?$/.test(new URL(url, location.href).pathname)) return null;
    return url;
  }
  function open(url) {
    if (!drawer) build();
    var u = new URL(url, location.href);
    u.searchParams.set('embed', '1');
    lastFocus = document.activeElement;
    loading.style.display = '';
    if (frame.src !== u.href) frame.src = u.href;
    drawer.classList.add('is-open');
    document.documentElement.classList.add('pc-drawer-lock');
    requestAnimationFrame(function () { requestAnimationFrame(function () { drawer.classList.add('is-in'); }); });
    try { history.pushState({ pcDrawer: 1 }, ''); } catch (e) {}
    opened = true;
    drawer.querySelector('.pc-drawer__close').focus();
  }
  function hide() {
    if (!opened || !drawer) return;
    opened = false;
    drawer.classList.remove('is-in');
    document.documentElement.classList.remove('pc-drawer-lock');
    setTimeout(function () { if (!opened) destroy(); }, 400);
    if (lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch (e) {}
  }
  function destroy() {
    if (!drawer) return;
    drawer.classList.remove('is-open', 'is-in');
    try { frame.src = 'about:blank'; } catch (e) {}
    if (drawer.parentNode) drawer.parentNode.removeChild(drawer);
    drawer = frame = loading = null;
    document.documentElement.classList.remove('pc-drawer-lock');
  }
  window.addEventListener('pageshow', function (ev) { if (ev.persisted) { opened = false; destroy(); } });
  window.addEventListener('pagehide', function () { opened = false; destroy(); });
  function close() {
    if (history.state && history.state.pcDrawer) history.back(); else hide();
  }
  document.addEventListener('click', function (ev) {
    if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    var a = ev.target.closest && ev.target.closest('a[href]');
    if (!a || a.hasAttribute('download')) return;
    if (!isInquiry(a.href)) return;
    var target = resolve(a.href);
    if (!target) return; // plain navigation
    ev.preventDefault();
    open(target);
  }, true);
  window.addEventListener('message', function (ev) { if (ev.origin === location.origin && ev.data === 'persocal:close-inquiry') close(); });
  window.PersocalInquiry = { open: open, close: close };
})();
