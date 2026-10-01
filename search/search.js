/* Persocal site search: searches every page of the site from a static index. */
(function () {
  'use strict';
  var script = document.currentScript;
  var ROOT = (script && script.getAttribute('data-root')) || '';
  var ASSETS = (script && script.getAttribute('data-assets')) || '_assets';
  var LINK_STYLE = (script && script.getAttribute('data-links')) || 'dir';
  var INDEX_URL = ROOT + 'search/index.json';
  var indexPromise = null;

  function loadIndex() {
    if (!indexPromise) {
      indexPromise = fetch(INDEX_URL).then(function (r) { return r.json(); }).then(function (rows) {
        rows.forEach(function (e) {
          e._n = norm(e.n); e._t = norm(e.t); e._d = norm(e.d); e._h = norm(e.h || ''); e._x = norm(e.x || ''); e._s = norm(e.s); e._k = (e.k || []).map(norm);
        });
        return rows;
      }).catch(function () { return []; });
    }
    return indexPromise;
  }
  function norm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’'"]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  }
  var ALIASES = { interest: 'interest', interests: 'interest', hobby: 'interest', passion: 'interest', country: 'destination', countries: 'destination', destination: 'destination', destinations: 'destination', park: 'safari park', parks: 'safari park', article: 'newsroom', articles: 'newsroom', blog: 'newsroom', news: 'newsroom', story: 'newsroom', stories: 'newsroom', guide: 'newsroom', region: 'region', continent: 'region' };

  function search(rows, query, filter) {
    var q = norm(query);
    if (!q) return [];
    var words = q.split(' ').filter(Boolean);
    var sectionWanted = null;
    var contentWords = words.filter(function (w) {
      if (ALIASES[w]) { sectionWanted = ALIASES[w]; return false; }
      return true;
    });
    var cq = contentWords.join(' ');
    var strong = [], weak = [];
    for (var i = 0; i < rows.length; i++) {
      var e = rows[i];
      if (filter && !filter(e)) continue;
      if (sectionWanted && e._s !== sectionWanted && !contentWords.length) continue;
      e._km = '';
      var score = 0;
      var isStrong = false;
      if (cq) {
        // the whole query against the page's own name, title and known places
        if (e._n === cq || e._t === cq) { score += 100; isStrong = true; }
        if (e._n.indexOf(cq) === 0 || e._t.indexOf(cq) === 0) { score += 60; isStrong = true; }
        else if (e._n.indexOf(cq) >= 0 || e._t.indexOf(cq) >= 0) { score += 40; isStrong = true; }
        for (var ki = 0; ki < e._k.length; ki++) {
          var kw = e._k[ki];
          var hitK = kw === cq ? 90 : (cq.length >= 2 && kw.indexOf(cq) === 0) ? 55 : (cq.length >= 3 && kw.indexOf(cq) >= 0) ? 30 : 0;
          if (hitK) { score += hitK; isStrong = true; if (!e._km && e._n.indexOf(cq) < 0) e._km = e.k[ki]; if (kw === cq) break; }
        }
        // every word must appear somewhere; a name, title or place hit keeps the result strong
        var all = true, weakOnly = false;
        for (var j = 0; j < contentWords.length; j++) {
          var w = contentWords[j], hit = 0;
          if (e._n.indexOf(w) >= 0) hit = 18;
          else if (e._t.indexOf(w) >= 0) hit = 14;
          else { for (var kj = 0; kj < e._k.length; kj++) if (e._k[kj].indexOf(w) >= 0) { hit = 16; break; } }
          if (!hit) {
            if (e._d.indexOf(w) >= 0) hit = 7;
            else if (e._h.indexOf(w) >= 0) hit = 5;
            else if (e._x.indexOf(w) >= 0) hit = 3;
            if (hit) weakOnly = true;
          }
          if (!hit) { all = false; break; }
          score += hit;
        }
        if (!all) continue;
        if (!isStrong && weakOnly) isStrong = false; else if (!weakOnly) isStrong = true;
      } else {
        isStrong = true; score = 1;
      }
      if (sectionWanted && e._s === sectionWanted) score += 25;
      if (score <= 0) continue;
      score -= Math.min(e._n.length, 40) / 40; // shorter, more exact names first
      (isStrong ? strong : weak).push({ e: e, score: score });
    }
    // only fall back to body-text matches when nothing is named after the query
    var out = strong.length ? strong : weak;
    out.sort(function (a, b) { return b.score - a.score; });
    return out.slice(0, 12).map(function (r) { return r.e; });
  }

  function href(e) {
    if (!e.u) return ROOT + (LINK_STYLE === 'file' ? 'home/index.html' : (ROOT ? '' : './'));
    return ROOT + e.u + (LINK_STYLE === 'file' ? 'index.html' : '');
  }
  function esc(s) { return String(s || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function kindLabel(e) {
    if (e.s !== 'Destination') return e.s;
    if (/^destinations\/[^\/]+\/$/.test(e.u)) return 'Country';
    return /\/experiences\//.test(e.u) ? 'Experience' : 'Place';
  }
  function resultHTML(e, cls) {
    var desc = e._km ? e._km + ' \u00b7 ' + e.n : (e.d || e.t);
    return '<a class="' + cls + '" href="' + esc(href(e)) + '"><span><span class="persocal-search__kind">' + esc(kindLabel(e)) + '</span><span class="persocal-search__name">' + esc(e.n && e.s !== 'Page' && e.s !== 'Home' ? e.n : e.t) + '</span><span class="persocal-search__desc">' + esc(desc) + '</span></span></a>';
  }
  /* Destinations page: countries and regions only */
  function isCountry(e) { return e.s === 'Destination' && /^destinations\/[^\/]+\/$/.test(e.u); }
  function isRegion(e) { return e.s === 'Region' && e.u !== 'destination/'; }
  var SCOPES = {
    destinations: { filter: function (e) { return isCountry(e) || isRegion(e); }, empty: 'No country or region matches “%s”. Try a country, a city or a continent.' }
  };

  /* ---- Home page search band ---- */
  function initHomeSearch(root) {
    var scope = SCOPES[root.getAttribute('data-scope')] || {};
    var input = root.querySelector('.persocal-search__input');
    var list = root.querySelector('.persocal-search__results');
    var button = root.querySelector('.persocal-search__button');
    var active = -1, current = [];
    function render(results, query) {
      current = results; active = -1;
      if (!query) { list.hidden = true; list.innerHTML = ''; return; }
      if (!results.length) { list.innerHTML = '<li class="persocal-search__empty">' + (scope.empty ? esc(scope.empty).replace('%s', esc(query)) : 'Nothing found for “' + esc(query) + '”. Try a country, a park, an interest like golf or safari, or a story from the newsroom.') + '</li>'; list.hidden = false; return; }
      list.innerHTML = results.map(function (e) { return '<li class="persocal-search__result">' + resultHTML(e, '') + '</li>'; }).join('');
      list.hidden = false;
    }
    function run() {
      var q = input.value.trim();
      loadIndex().then(function (rows) { if (input.value.trim() === q) render(search(rows, q, scope.filter), q); });
    }
    var timer;
    input.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(run, 120); });
    input.addEventListener('focus', function () { loadIndex(); });
    button.addEventListener('click', function () { run(); input.focus(); });
    input.addEventListener('keydown', function (ev) {
      var items = list.querySelectorAll('.persocal-search__result');
      if (ev.key === 'ArrowDown' && items.length) { ev.preventDefault(); active = (active + 1) % items.length; }
      else if (ev.key === 'ArrowUp' && items.length) { ev.preventDefault(); active = (active - 1 + items.length) % items.length; }
      else if (ev.key === 'Enter') { ev.preventDefault(); if (items.length) { var target = items[active >= 0 ? active : 0].querySelector('a'); if (target) window.location.href = target.href; } else run(); return; }
      else if (ev.key === 'Escape') { input.value = ''; render([], ''); return; }
      else return;
      for (var i = 0; i < items.length; i++) items[i].classList.toggle('is-active', i === active);
      if (active >= 0) items[active].scrollIntoView({ block: 'nearest' });
    });
    root.querySelectorAll('.persocal-search__hint button').forEach(function (b) {
      b.addEventListener('click', function () { input.value = b.textContent.replace(/[“”]/g, ''); input.focus(); run(); });
    });
  }

  /* ---- Squarespace search blocks (Search All page, Safari coverage box) ---- */
  function initSqsBlock(wrapper) {
    var box = wrapper.querySelector('.sqs-search-ui-text-input');
    var oldInput = wrapper.querySelector('input.search-input');
    if (!box || !oldInput) return;
    var input = oldInput.cloneNode(true); // drops Squarespace's own listeners
    oldInput.parentNode.replaceChild(input, oldInput);
    var filter = null;
    if (box.getAttribute('data-collectionfilter') === 'true') {
      var page = window.location.pathname;
      if (/\/safari/.test(page) || /safari/.test(document.title.toLowerCase())) {
        filter = function (e) { return e.u.indexOf('safari/') === 0; };
      }
    }
    var preview = document.createElement('div');
    preview.className = 'sqs-search-preview-ui persocal-preview hide';
    preview.innerHTML = '<div class="search-result-notice hide"></div><div class="sqs-search-ui-list"></div>';
    document.body.appendChild(preview); // portal: sits above every section
    function place() {
      if (preview.classList.contains('hide')) return;
      var r = box.getBoundingClientRect();
      preview.style.top = (r.bottom + window.pageYOffset) + 'px';
      preview.style.left = (r.left + window.pageXOffset) + 'px';
      preview.style.width = r.width + 'px';
    }
    window.addEventListener('scroll', place, { passive: true });
    window.addEventListener('resize', place);
    var list = preview.querySelector('.sqs-search-ui-list');
    var notice = preview.querySelector('.search-result-notice');
    function render(results, q) {
      if (!q) { preview.classList.add('hide'); list.innerHTML = ''; return; }
      preview.classList.remove('hide'); place();
      if (!results.length) { list.innerHTML = ''; notice.textContent = 'No results found'; notice.classList.remove('hide'); return; }
      notice.classList.add('hide');
      list.innerHTML = results.map(function (e) { return resultHTML(e, 'search-result'); }).join('');
    }
    var timer;
    function run() {
      var q = input.value.trim();
      loadIndex().then(function (rows) { if (input.value.trim() === q) render(search(rows, q, filter), q); });
    }
    input.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(run, 120); });
    input.addEventListener('focus', function () { loadIndex(); if (input.value.trim()) run(); });
    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') { ev.preventDefault(); var first = list.querySelector('.search-result'); if (first) window.location.href = first.href; }
      if (ev.key === 'Escape') { preview.classList.add('hide'); }
    });
    document.addEventListener('click', function (ev) { if (!wrapper.contains(ev.target) && !preview.contains(ev.target)) preview.classList.add('hide'); });
  }

  function init() {
    document.querySelectorAll('.persocal-search').forEach(initHomeSearch);
    document.querySelectorAll('.sqs-search-wrapper').forEach(initSqsBlock);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
