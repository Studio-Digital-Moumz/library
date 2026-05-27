// Moumz Library | Cookie Consent v1.5
// Rétrocompatible : supporte data-mz-cc (legacy) ET data-mz-notice (v1.4+)
// Détecte automatiquement le namespace utilisé sur chaque site

function gtag() { dataLayer.push(arguments); }

window.dataLayer = window.dataLayer || [];

// === PARTIE 1 : Consent default (exécution immédiate pour GTM) ===
(function() {
  var existing = null;
  try {
    var raw = localStorage.getItem('mz-notice-consent');
    if (!raw) {
      var legacy = localStorage.getItem('mz-cc-consent');
      if (legacy) {
        localStorage.setItem('mz-notice-consent', legacy);
        localStorage.removeItem('mz-cc-consent');
        raw = legacy;
      }
    }
    if (raw) {
      var parsed = JSON.parse(raw);
      if (new Date(parsed.expiry) >= new Date()) {
        existing = parsed.consent;
      } else {
        localStorage.removeItem('mz-notice-consent');
      }
    }
  } catch (e) {}

  if (existing) {
    gtag('consent', 'default', {
      'analytics_storage': existing.analytics ? 'granted' : 'denied',
      'ad_storage': existing.marketing ? 'granted' : 'denied',
      'ad_user_data': existing.marketing ? 'granted' : 'denied',
      'ad_personalization': existing.marketing ? 'granted' : 'denied',
      'functionality_storage': 'granted',
      'security_storage': 'granted',
      'wait_for_update': 500
    });
  } else {
    gtag('consent', 'default', {
      'analytics_storage': 'denied',
      'ad_storage': 'denied',
      'ad_user_data': 'denied',
      'ad_personalization': 'denied',
      'functionality_storage': 'granted',
      'security_storage': 'granted',
      'wait_for_update': 500
    });
  }
})();

// === PARTIE 2 : Gestion UI ===
function mzNoticeInit() {

  var STORAGE_KEY = 'mz-notice-consent';
  var EXPIRY_MONTHS = 13;

  var NS = document.querySelector('[data-mz-notice="banner"]') ? 'notice' : 'cc';
  var ATTR = 'data-mz-' + NS;
  var ATTR_SCROLL = 'data-mz-' + NS + '-scroll';
  var ATTR_VISIBLE = 'data-mz-' + NS + '-visible';
  var ATTR_CATEGORY = 'data-mz-' + NS + '-category';
  var SCRIPT_TYPE = 'mz-' + NS;

  var styles = document.createElement('style');
  styles.textContent = '[data-mz-notice="banner"], [data-mz-cc="banner"] { transition: opacity 0.3s ease, transform 0.3s ease; } [data-mz-notice-visible="false"], [data-mz-cc-visible="false"] { opacity: 0; transform: translateY(20px); pointer-events: none; display: none !important; } [data-mz-notice-visible="true"], [data-mz-cc-visible="true"] { opacity: 1; transform: translateY(0); pointer-events: auto; display: block !important; }';
  document.head.appendChild(styles);

  function getConsent() {
    try {
      var data = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!data) return null;
      if (new Date(data.expiry) < new Date()) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return data;
    } catch (e) {
      return null;
    }
  }

  function setConsent(consent) {
    var now = new Date();
    var expiry = new Date(now);
    expiry.setMonth(expiry.getMonth() + EXPIRY_MONTHS);
    var data = {
      timestamp: now.toISOString(),
      expiry: expiry.toISOString(),
      consent: consent,
      version: '1.5'
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return data;
  }

  function updateGoogleConsent(consent) {
    gtag('consent', 'update', {
      'analytics_storage': consent.analytics ? 'granted' : 'denied',
      'ad_storage': consent.marketing ? 'granted' : 'denied',
      'ad_user_data': consent.marketing ? 'granted' : 'denied',
      'ad_personalization': consent.marketing ? 'granted' : 'denied'
    });
  }

  function runScripts(consent) {
    document.querySelectorAll('script[type="' + SCRIPT_TYPE + '"]').forEach(function(script) {
      var category = script.getAttribute(ATTR_CATEGORY);
      if (consent[category]) {
        var newScript = document.createElement('script');
        Array.from(script.attributes).forEach(function(attr) {
          if (attr.name !== 'type' && attr.name !== ATTR_CATEGORY) {
            newScript.setAttribute(attr.name, attr.value);
          }
        });
        newScript.type = 'text/javascript';
        if (script.src) {
          newScript.src = script.src;
        } else {
          newScript.textContent = script.textContent;
        }
        script.parentNode.replaceChild(newScript, script);
      }
    });
  }

  function showBanner() {
    var banner = document.querySelector('[' + ATTR + '="banner"]');
    if (banner) banner.setAttribute(ATTR_VISIBLE, 'true');
  }

  function hideBanner() {
    var banner = document.querySelector('[' + ATTR + '="banner"]');
    if (banner) banner.setAttribute(ATTR_VISIBLE, 'false');
  }

  function showOpenButton() {
    document.querySelectorAll('[' + ATTR + '="open"]').forEach(function(btn) {
      btn.setAttribute(ATTR_VISIBLE, 'true');
    });
  }

  function hideOpenButton() {
    document.querySelectorAll('[' + ATTR + '="open"]').forEach(function(btn) {
      btn.setAttribute(ATTR_VISIBLE, 'false');
    });
  }

  var banner = document.querySelector('[' + ATTR + '="banner"]');
  if (!banner) return;

  var scrollTrigger = banner.getAttribute(ATTR_SCROLL);
  var existingConsent = getConsent();

  if (existingConsent) {
    hideBanner();
    showOpenButton();
    runScripts(existingConsent.consent);
  } else {
    hideOpenButton();
    if (scrollTrigger) {
      hideBanner();
      var scrollValue = parseInt(scrollTrigger);
      var scrollHandler = function() {
        if (window.scrollY >= scrollValue) {
          showBanner();
          window.removeEventListener('scroll', scrollHandler);
        }
      };
      window.addEventListener('scroll', scrollHandler);
    } else {
      showBanner();
    }
  }

  document.addEventListener('click', function(e) {
    if (e.target.closest('[' + ATTR + '="accept"]')) {
      e.preventDefault();
      var consent = { necessary: true, analytics: true, marketing: true };
      setConsent(consent);
      updateGoogleConsent(consent);
      runScripts(consent);
      hideBanner();
      showOpenButton();
      window.dataLayer.push({ event: 'page_view_after_consent' });
      window.dataLayer.push({ event: 'cookie_consent_accepted' });
    }
  });

  document.addEventListener('click', function(e) {
    if (e.target.closest('[' + ATTR + '="deny"]')) {
      e.preventDefault();
      var consent = { necessary: true, analytics: false, marketing: false };
      setConsent(consent);
      updateGoogleConsent(consent);
      hideBanner();
      showOpenButton();
      window.dataLayer.push({ event: 'cookie_consent_denied' });
    }
  });

  document.addEventListener('click', function(e) {
    if (e.target.closest('[' + ATTR + '="open"]')) {
      e.preventDefault();
      showBanner();
      hideOpenButton();
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mzNoticeInit);
} else {
  mzNoticeInit();
}
