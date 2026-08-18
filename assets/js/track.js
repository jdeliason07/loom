/* ============================================================
   vates — attribution and conversion tracking

   Answers one question: which ad, or which creator, produced this
   sale. Everything here is client side and every platform is
   optional — an empty ID in config.js means that script is never
   fetched, so an unused pixel costs nothing.

   The chain is:
     1. Someone arrives on a tagged link  (?ref=janedoe, ?utm_source=…)
     2. That is captured here and kept, first touch and last touch
     3. Purchase carries it to Stripe as client_reference_id, where it
        shows up on the payment itself in the dashboard
     4. thanks.html fires the Purchase event back to the ad platforms

   Step 3 is the part that matters for paying creators: the attribution
   is attached to the money, in Stripe, not only to a page view in an
   analytics tool.
   ============================================================ */
(function () {
  "use strict";

  var CONFIG = window.VATES || {};
  var PIXELS = CONFIG.pixels || {};
  var PRODUCT = CONFIG.product || {};

  /* localStorage for first touch — the ad that originally found them,
     which is what deserves the credit weeks later. sessionStorage for
     last touch — the link they actually arrived on today. Both are
     wrapped: Safari in private mode throws on write rather than
     failing quietly, and a storage error must never take the page or
     the Purchase button down with it. */
  var FIRST_KEY = "vates.attr.first";
  var LAST_KEY = "vates.attr.last";

  function readStore(store, key) {
    try {
      var raw = window[store].getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function writeStore(store, key, value) {
    try { window[store].setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  /* ── capture ─────────────────────────────────────────────── */

  var FIELDS = [
    "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
    /* The short forms a creator will actually be given. `ref` is the one
       to put on a link in a bio; the rest are here so that whatever a
       partner improvises still lands somewhere. */
    "ref", "creator", "via", "aff",
    /* Platform click IDs. The pixels match conversions on their own
       cookies, so these are not needed for that — they are kept for a
       later server-side Conversions API, which needs them. */
    "fbclid", "ttclid", "gclid", "twclid", "epik", "li_fat_id"
  ];

  function params() {
    var out = {};
    var search = window.location.search;
    if (!search || search.length < 2) return out;
    search.slice(1).split("&").forEach(function (pair) {
      var eq = pair.indexOf("=");
      var key = decodeURIComponent(eq < 0 ? pair : pair.slice(0, eq)).toLowerCase();
      var val = eq < 0 ? "" : decodeURIComponent(pair.slice(eq + 1).replace(/\+/g, " "));
      if (FIELDS.indexOf(key) >= 0 && val) out[key] = val.slice(0, 120);
    });
    return out;
  }

  function capture() {
    var found = params();
    var landed = Object.keys(found).length > 0;

    /* A visit with no tags at all still records the referrer, so organic
       and dark-social traffic is not simply invisible. */
    var touch = {
      at: Date.now(),
      landing: window.location.pathname,
      referrer: document.referrer ? document.referrer.slice(0, 200) : "",
      params: found
    };

    var first = readStore("localStorage", FIRST_KEY);
    /* First touch is only written once, and only by a visit that was
       actually tagged — an untagged visit must never overwrite the
       creator who found this customer in the first place. */
    if (!first && landed) writeStore("localStorage", FIRST_KEY, touch);
    if (landed || !readStore("sessionStorage", LAST_KEY)) {
      writeStore("sessionStorage", LAST_KEY, touch);
    }

    return {
      first: readStore("localStorage", FIRST_KEY),
      last: readStore("sessionStorage", LAST_KEY) || touch
    };
  }

  var attribution = capture();

  /* ── the token that rides along to Stripe ────────────────── */

  /* Stripe allows up to 200 characters on client_reference_id and is
     strict about the alphabet, so each value is flattened to
     [a-z0-9-]. The shape is chosen to be read by a person scanning
     the payments list, not parsed by a machine:

       src_tiktok__med_paidsocial__cmp_launch__ref_janedoe__t_1755512345

     Whoever is cutting the cheques can sort on it directly. */
  function clean(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
  }

  function reference() {
    var touch = attribution.first || attribution.last;
    if (!touch) return "";
    var p = touch.params || {};
    var creator = p.ref || p.creator || p.via || p.aff || "";
    var bits = [];

    if (p.utm_source) bits.push("src_" + clean(p.utm_source));
    if (p.utm_medium) bits.push("med_" + clean(p.utm_medium));
    if (p.utm_campaign) bits.push("cmp_" + clean(p.utm_campaign));
    if (p.utm_content) bits.push("cnt_" + clean(p.utm_content));
    if (creator) bits.push("ref_" + clean(creator));
    /* An untagged sale is still worth telling apart from a broken one. */
    if (!bits.length) bits.push(touch.referrer ? "src_referral" : "src_direct");
    bits.push("t_" + Math.floor((touch.at || Date.now()) / 1000));

    return bits.join("__").slice(0, 200);
  }

  /* ── the pixels ──────────────────────────────────────────── */

  function inject(src) {
    var s = document.createElement("script");
    s.async = true;
    s.src = src;
    document.head.appendChild(s);
    return s;
  }

  var loaded = { meta: false, tiktok: false, ga4: false };

  if (PIXELS.meta) {
    /* Meta's own snippet, with its document.write path removed. */
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n;
      n.push = n; n.loaded = true; n.version = "2.0"; n.queue = [];
      t = b.createElement(e); t.async = true; t.src = v;
      s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    window.fbq("init", String(PIXELS.meta));
    loaded.meta = true;
  }

  if (PIXELS.tiktok) {
    !function (w, d, t) {
      w.TiktokAnalyticsObject = t;
      var ttq = w[t] = w[t] || [];
      ttq.methods = ["page", "track", "identify", "instances", "debug", "on", "off",
                     "once", "ready", "alias", "group", "enableCookie", "disableCookie"];
      ttq.setAndDefer = function (obj, method) {
        obj[method] = function () { obj.push([method].concat([].slice.call(arguments, 0))); };
      };
      for (var i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
      ttq.instance = function (id) {
        var inst = ttq._i[id] || [];
        for (var j = 0; j < ttq.methods.length; j++) ttq.setAndDefer(inst, ttq.methods[j]);
        return inst;
      };
      ttq.load = function (id, opts) {
        var url = "https://analytics.tiktok.com/i18n/pixel/events.js";
        ttq._i = ttq._i || {}; ttq._i[id] = []; ttq._i[id]._u = url;
        ttq._t = ttq._t || {}; ttq._t[id] = +new Date();
        ttq._o = ttq._o || {}; ttq._o[id] = opts || {};
        var s = d.createElement("script");
        s.type = "text/javascript"; s.async = true; s.src = url + "?sdkid=" + id + "&lib=" + t;
        var first = d.getElementsByTagName("script")[0];
        first.parentNode.insertBefore(s, first);
      };
      ttq.load(String(PIXELS.tiktok));
    }(window, document, "ttq");
    loaded.tiktok = true;
  }

  if (PIXELS.ga4) {
    inject("https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(PIXELS.ga4));
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", PIXELS.ga4);
    loaded.ga4 = true;
  }

  /* ── one call, every platform ────────────────────────────── */

  /* Each platform names the same three moments differently, so the
     mapping lives here and callers use one vocabulary: "view",
     "checkout", "purchase". */
  var NAMES = {
    view:     { meta: "ViewContent",      tiktok: "ViewContent",      ga4: "view_item" },
    checkout: { meta: "InitiateCheckout", tiktok: "InitiateCheckout", ga4: "begin_checkout" },
    purchase: { meta: "Purchase",         tiktok: "CompletePayment",  ga4: "purchase" }
  };

  function track(moment, extra) {
    var name = NAMES[moment];
    if (!name) return;
    var value = (extra && extra.value) || PRODUCT.price || 0;
    var currency = PRODUCT.currency || "USD";
    var id = PRODUCT.sku || PRODUCT.id || "";

    try {
      if (loaded.meta && window.fbq) {
        window.fbq("track", name.meta, {
          content_ids: [id], content_type: "product",
          content_name: PRODUCT.name, value: value, currency: currency
        });
      }
      if (loaded.tiktok && window.ttq) {
        window.ttq.track(name.tiktok, {
          contents: [{ content_id: id, content_name: PRODUCT.name, quantity: 1, price: value }],
          value: value, currency: currency
        });
      }
      if (loaded.ga4 && window.gtag) {
        window.gtag("event", name.ga4, {
          currency: currency, value: value,
          items: [{ item_id: id, item_name: PRODUCT.name, price: PRODUCT.price, quantity: 1 }]
        });
      }
    } catch (e) {
      /* A blocked or broken pixel must never stop someone buying. */
    }
  }

  /* Stripe forwards any utm_* it is given on the payment link URL to the
     redirect URL after payment. client_reference_id does NOT come back
     that way, so these are what let thanks.html know which campaign it
     is reporting a conversion for. */
  function campaign() {
    var touch = attribution.first || attribution.last;
    var p = (touch && touch.params) || {};
    var out = {};
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach(function (k) {
      if (p[k]) out[k] = p[k];
    });
    /* A creator link carries no utm_source of its own, so it is given
       one — otherwise the sale comes back from Stripe unattributed. */
    var creator = p.ref || p.creator || p.via || p.aff;
    if (creator && !out.utm_source) {
      out.utm_source = clean(creator);
      out.utm_medium = out.utm_medium || "creator";
    }
    return out;
  }

  window.VATES_TRACK = {
    track: track,
    reference: reference,
    campaign: campaign,
    attribution: attribution,
    /* Exposed so the tagging on a link can be checked from the console
       on the live site: VATES_TRACK.reference() */
    fields: FIELDS
  };
})();
