// Moumz Library | Cookie Consent v2.0.0
// Fichier indépendant de consent/consent.js (v1.5), qui reste inchangé pour les sites déjà en ligne.
//
// Chargement : dans le <head>, AVANT Google Tag Manager, sans async ni defer.
//   <script src=".../consent/v2/consent.js"></script>
// Réglages facultatifs, sur la balise script :
//   data-days="180"                         durée de mémorisation du choix, en jours
//   data-categories="analytics,behavior,ads" catégories proposées
//   data-reload-on-revoke="false"           ne pas recharger la page quand un accord est retiré
//
// Ce que reçoit GTM (dataLayer) :
//   consent default / update   Consent Mode v2 (analytics -> analytics_storage, ads -> ad_*)
//   mz_consent_init            à chaque page : état dans mz_consent, mz_consent_pending si aucun choix
//   mz_consent_update          à chaque choix : état dans mz_consent
//   mz_consent_<catégorie>     à chaque page et à chaque choix, pour chaque catégorie acceptée
//
// Balisage attendu dans la page :
//   [data-cc-root]                                   conteneur du bandeau et du panneau
//   [data-cc="banner"] [data-cc="overlay"] [data-cc="panel"]
//   [data-cc-action="accept|reject|customize|save|close"]
//   [data-cc-category="analytics"]                   interrupteur (role="switch"), curseur en premier enfant
//   [data-cc-open]                                   n'importe où : rouvre le panneau
//   <script type="text/plain" data-cc-script="analytics">  script lancé seulement si la catégorie est acceptée
// Affichage : la classe is-open est posée sur le bandeau et sur l'overlay, is-on sur l'interrupteur et son curseur.

(function () {
  'use strict';
  if (window.mzConsent && window.mzConsent.version) return;

  var VERSION = '2.0.0';
  var KEY = 'mz-consent';
  var tag = document.currentScript;

  function option(name, fallback) {
    var v = tag && tag.getAttribute('data-' + name);
    return v === null || v === undefined || v === '' ? fallback : v;
  }

  var DAYS = parseInt(option('days', '180'), 10) || 180;
  var CATS = option('categories', 'analytics,behavior,ads').split(',')
    .map(function (s) { return s.trim(); }).filter(Boolean);
  var RELOAD = option('reload-on-revoke', 'true') !== 'false';

  /* Cookies et stockages effacés quand un accord est retiré */
  var COOKIES = { analytics: /^(_ga|_gid|_gat)/, behavior: /^_hj/, ads: /^(_gcl_|_gac_)/ };

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  if (typeof window.gtag !== 'function') window.gtag = gtag;

  // === PARTIE 1 : état du consentement, exécutée tout de suite (avant GTM) ===

  function normalize(c) {
    var out = {};
    CATS.forEach(function (k) { out[k] = !!(c && c[k]); });
    return out;
  }

  var memory = null;

  function read() {
    try {
      var d = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!d || d.v !== 2 || !d.t || !d.c) return null;
      if (Date.now() - d.t > DAYS * 864e5) { localStorage.removeItem(KEY); return null; }
      return { v: 2, t: d.t, c: normalize(d.c) };
    } catch (_) { return null; }
  }

  function write(c) {
    var d = { v: 2, t: Date.now(), c: normalize(c) };
    memory = d;
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (_) {}
    return d;
  }

  function current() { return read() || memory; }

  function google(c) {
    var a = c.analytics ? 'granted' : 'denied', m = c.ads ? 'granted' : 'denied';
    return { analytics_storage: a, ad_storage: m, ad_user_data: m, ad_personalization: m };
  }

  function signal(name, c, pending) {
    var push = { event: name, mz_consent: c };
    if (name === 'mz_consent_init') push.mz_consent_pending = !!pending;
    window.dataLayer.push(push);
    CATS.forEach(function (k) { if (c[k]) window.dataLayer.push({ event: 'mz_consent_' + k }); });
    try { window.dispatchEvent(new CustomEvent('mz-consent', { detail: c })); } catch (_) {}
  }

  var saved = read();
  var initial = saved ? saved.c : normalize(null);
  var base = google(initial);
  base.functionality_storage = 'granted';
  base.security_storage = 'granted';
  gtag('consent', 'default', base);
  signal('mz_consent_init', initial, !saved);

  // === PARTIE 2 : scripts conditionnés et retrait d'un accord ===

  function runScripts(c) {
    document.querySelectorAll('script[type="text/plain"][data-cc-script]').forEach(function (old) {
      if (!c[old.getAttribute('data-cc-script')]) return;
      var s = document.createElement('script');
      Array.prototype.forEach.call(old.attributes, function (a) {
        if (a.name !== 'type' && a.name !== 'data-cc-script') s.setAttribute(a.name, a.value);
      });
      if (!old.src) s.textContent = old.textContent;
      old.parentNode.replaceChild(s, old);
    });
  }

  function clean(cats) {
    var hosts = [''], parts = location.hostname.split('.');
    for (var i = 0; i < parts.length - 1; i++) hosts.push('; domain=.' + parts.slice(i).join('.'));
    cats.forEach(function (k) {
      var re = COOKIES[k]; if (!re) return;
      document.cookie.split(';').forEach(function (pair) {
        var name = pair.split('=')[0].trim();
        if (!name || !re.test(name)) return;
        hosts.forEach(function (h) { document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' + h; });
      });
      [window.localStorage, window.sessionStorage].forEach(function (store) {
        try { Object.keys(store).forEach(function (n) { if (n !== KEY && re.test(n)) store.removeItem(n); }); } catch (_) {}
      });
    });
  }

  function apply(c) {
    var before = current(), next = normalize(c);
    var revoked = CATS.filter(function (k) { return before && before.c[k] && !next[k]; });
    write(next);
    gtag('consent', 'update', google(next));
    signal('mz_consent_update', next);
    runScripts(next);
    if (revoked.length) {
      clean(revoked);
      if (RELOAD) { try { window.location.reload(); } catch (_) {} }
    }
    return next;
  }

  var api = window.mzConsent = {
    version: VERSION,
    categories: CATS.slice(),
    get: function () { var d = current(); return d ? normalize(d.c) : null; },
    set: function (c) { return apply(c); },
    open: function () {}
  };

  // === PARTIE 3 : bandeau et panneau, une fois la page prête ===

  function ui() {
    if (saved) runScripts(saved.c);

    var root = document.querySelector('[data-cc-root]'); if (!root) return;
    var banner = root.querySelector('[data-cc="banner"]'), overlay = root.querySelector('[data-cc="overlay"]'),
      panel = root.querySelector('[data-cc="panel"]');
    if (!banner) return;

    document.body.insertBefore(root, document.body.firstChild);
    root.querySelectorAll('button').forEach(function (b) { b.setAttribute('type', 'button'); });

    var switches = {};
    if (panel) panel.querySelectorAll('[data-cc-category]').forEach(function (s) { switches[s.getAttribute('data-cc-category')] = s; });

    function setSwitch(k, on) {
      var s = switches[k]; if (!s) return;
      s.setAttribute('aria-checked', on ? 'true' : 'false');
      s.classList.toggle('is-on', on);
      if (s.firstElementChild) s.firstElementChild.classList.toggle('is-on', on);
    }
    function sync() { var d = current(); CATS.forEach(function (k) { setSwitch(k, !!(d && d.c[k])); }); }
    function all(v) { var c = {}; CATS.forEach(function (k) { c[k] = v; }); return c; }

    var opener = null;
    function isOpen() { return !!overlay && overlay.classList.contains('is-open'); }
    function focusables() {
      return Array.prototype.filter.call(panel.querySelectorAll('button, a[href]'), function (e) { return e.offsetParent !== null; });
    }
    function openPanel(from) {
      if (!overlay || !panel) { banner.classList.add('is-open'); return; }
      opener = from || document.activeElement; sync();
      banner.classList.remove('is-open'); overlay.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      var f = focusables(); if (f.length) f[0].focus();
    }
    function closePanel(silent) {
      if (!isOpen()) return;
      overlay.classList.remove('is-open'); document.body.style.overflow = '';
      if (!current()) banner.classList.add('is-open');
      if (opener && opener.focus && (!silent || (document.contains(opener) && opener.offsetParent !== null))) opener.focus();
    }
    function choose(c) { apply(c); banner.classList.remove('is-open'); closePanel(true); }

    root.addEventListener('click', function (e) {
      var s = e.target.closest('[data-cc-category]'), a = e.target.closest('[data-cc-action]');
      if (s) { setSwitch(s.getAttribute('data-cc-category'), s.getAttribute('aria-checked') !== 'true'); return; }
      if (overlay && e.target === overlay) { closePanel(); return; }
      if (!a) return;
      var act = a.getAttribute('data-cc-action');
      if (act === 'accept') choose(all(true));
      else if (act === 'reject') choose(all(false));
      else if (act === 'customize') openPanel(a);
      else if (act === 'close') closePanel();
      else if (act === 'save') {
        var c = {};
        CATS.forEach(function (k) { c[k] = !!switches[k] && switches[k].getAttribute('aria-checked') === 'true'; });
        choose(c);
      }
    });

    document.addEventListener('click', function (e) {
      var o = e.target.closest('[data-cc-open]'); if (!o) return;
      e.preventDefault(); openPanel(o);
    });

    document.addEventListener('keydown', function (e) {
      if (!isOpen()) return;
      if (e.key === 'Escape') { e.preventDefault(); closePanel(); return; }
      if (e.key !== 'Tab') return;
      var f = focusables(); if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (!panel.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    api.open = function () { openPanel(document.activeElement); };
    if (!current()) banner.classList.add('is-open');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ui);
  else ui();
})();
