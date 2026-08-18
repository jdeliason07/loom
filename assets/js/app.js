/* ============================================================
   vates — storefront behaviour
   Client-side state only. Nothing is persisted, nothing is sent.
   ============================================================ */
(function () {
  "use strict";

  var PRODUCT = {
    id: "no-01",
    name: "No. 01",
    meta: "Borosilicate · 1 L",
    price: 49,
    /* The drawer shows the bottle on its own, not the desk scene the
       product section uses — at 4.5rem a whole room is a smudge. */
    image: "assets/img/no-01-thumb.webp",
    max: 10
  };

  /** @type {{id:string,qty:number}[]} — in-memory only, cleared on reload. */
  var cart = [];

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  var el = {
    year: document.getElementById("year"),
    form: document.getElementById("purchase-form"),
    drawer: document.getElementById("order-drawer"),
    backdrop: document.getElementById("drawer-backdrop"),
    close: document.getElementById("drawer-close"),
    items: document.getElementById("line-items"),
    empty: document.getElementById("drawer-empty"),
    box: document.getElementById("box-contents"),
    total: document.getElementById("drawer-total"),
    checkout: document.getElementById("checkout"),
    notice: document.getElementById("drawer-notice")
  };

  /* ── helpers ─────────────────────────────────────────────── */

  function money(value) {
    return "$" + value.toLocaleString("en-US");
  }

  function clamp(value, min, max) {
    if (isNaN(value)) return min;
    return Math.min(max, Math.max(min, value));
  }

  function totalPrice() {
    return cart.reduce(function (sum, line) { return sum + line.qty * PRODUCT.price; }, 0);
  }

  /* ── cart ────────────────────────────────────────────────── */

  function addToCart(qty) {
    var line = cart.filter(function (l) { return l.id === PRODUCT.id; })[0];
    if (line) {
      line.qty = clamp(line.qty + qty, 1, PRODUCT.max);
    } else {
      cart.push({ id: PRODUCT.id, qty: clamp(qty, 1, PRODUCT.max) });
    }
    render();
  }

  function setLineQty(id, qty) {
    cart = cart
      .map(function (line) {
        return line.id === id ? { id: id, qty: clamp(qty, 0, PRODUCT.max) } : line;
      })
      .filter(function (line) { return line.qty > 0; });
    render();
  }

  function removeLine(id) {
    cart = cart.filter(function (line) { return line.id !== id; });
    render();
  }

  /* ── rendering ───────────────────────────────────────────── */

  function lineItemNode(line) {
    var li = document.createElement("li");
    li.className = "line-item";
    li.dataset.id = line.id;

    li.innerHTML =
      '<div class="line-item__thumb">' +
        '<img src="' + PRODUCT.image + '" alt="">' +
      "</div>" +
      "<div>" +
        '<div class="line-item__head">' +
          '<span class="line-item__name">' + PRODUCT.name + "</span>" +
          '<span class="line-item__price">' + money(line.qty * PRODUCT.price) + "</span>" +
        "</div>" +
        '<p class="line-item__meta">' + PRODUCT.meta + " · " + money(PRODUCT.price) + " each</p>" +
        '<div class="line-item__controls">' +
          '<div class="stepper" role="group" aria-label="Quantity, ' + PRODUCT.name + '">' +
            '<button type="button" class="stepper__btn" data-line-step="-1" aria-label="Decrease quantity">−</button>' +
            '<input class="stepper__input" type="number" min="1" max="' + PRODUCT.max + '" step="1" ' +
              'inputmode="numeric" value="' + line.qty + '" aria-label="Quantity, ' + PRODUCT.name + '">' +
            '<button type="button" class="stepper__btn" data-line-step="1" aria-label="Increase quantity">+</button>' +
          "</div>" +
          '<button type="button" class="line-item__remove" data-remove>Remove</button>' +
        "</div>" +
      "</div>";

    return li;
  }

  /* The drawer list is rebuilt wholesale on every change, so remember which
     control the user was on and hand focus back to its replacement. */
  function focusToken() {
    var active = document.activeElement;
    if (!active || !el.items.contains(active)) return null;

    var item = active.closest(".line-item");
    if (!item) return null;

    var selector = active.dataset.lineStep
      ? '[data-line-step="' + active.dataset.lineStep + '"]'
      : active.hasAttribute("data-remove")
        ? "[data-remove]"
        : ".stepper__input";

    return { id: item.dataset.id, selector: selector };
  }

  function restoreFocus(token) {
    if (!token) return;
    var item = el.items.querySelector('.line-item[data-id="' + token.id + '"]');
    var node = item && item.querySelector(token.selector);
    if (node) node.focus();
    else el.close.focus();
  }

  function render() {
    var token = focusToken();

    el.items.innerHTML = "";
    cart.forEach(function (line) { el.items.appendChild(lineItemNode(line)); });

    el.empty.hidden = cart.length > 0;
    /* The box list is the mirror of the empty state: it describes what
       is being bought, so it belongs only when there is something in
       the cart. */
    if (el.box) el.box.hidden = cart.length === 0;
    el.total.textContent = money(totalPrice());
    el.checkout.disabled = cart.length === 0;

    if (cart.length === 0) hideNotice();
    if (isOpen()) restoreFocus(token);
  }

  function showNotice(message) {
    el.notice.textContent = message;
    el.notice.hidden = false;
  }

  function hideNotice() {
    el.notice.hidden = true;
    el.notice.textContent = "";
  }

  /* ── drawer ──────────────────────────────────────────────── */

  var lastFocused = null;
  var closeTimer = null;

  function isOpen() {
    return !el.drawer.hidden;
  }

  function focusableInDrawer() {
    return Array.prototype.filter.call(
      el.drawer.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
      function (node) { return !node.disabled && node.getClientRects().length > 0; }
    );
  }

  function openDrawer() {
    if (isOpen()) return;
    window.clearTimeout(closeTimer);
    lastFocused = document.activeElement;

    el.drawer.hidden = false;
    el.backdrop.hidden = false;
    document.body.classList.add("is-locked");

    // force a reflow so the transform transition actually runs
    void el.drawer.offsetWidth;
    el.drawer.classList.add("is-open");
    el.backdrop.classList.add("is-open");

    el.close.focus();
  }

  function closeDrawer() {
    if (!isOpen()) return;

    el.drawer.classList.remove("is-open");
    el.backdrop.classList.remove("is-open");
    document.body.classList.remove("is-locked");

    closeTimer = window.setTimeout(function () {
      el.drawer.hidden = true;
      el.backdrop.hidden = true;
    }, reduceMotion.matches ? 0 : 380);

    if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
  }

  function trapTab(event) {
    var nodes = focusableInDrawer();
    if (nodes.length === 0) return;

    var first = nodes[0];
    var last = nodes[nodes.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /* ── wiring ──────────────────────────────────────────────── */

  if (el.year) el.year.textContent = String(new Date().getFullYear());

  /* Fires once on load. It is what the ad platforms build their
     retargeting audiences from — everyone who saw the bottle and did
     not buy it yet. */
  if (window.VATES_TRACK) window.VATES_TRACK.track("view");

  /* The shortest path there is from the advert to the receipt. With a
     Payment Link configured, Purchase leaves for Stripe on the click —
     no cart, no account, no page of ours in between — and Stripe's own
     receipt email is the confirmation. The attribution token rides
     along as client_reference_id, so the sale lands in the dashboard
     already credited to whoever sent them.

     With no link configured it falls back to the demonstration drawer,
     so the button is never dead while the storefront is being set up. */
  function checkoutUrl() {
    var checkout = (window.VATES && window.VATES.checkout) || {};
    var link = checkout.paymentLink || "";
    if (!link) return "";
    var ref = "";
    try {
      ref = (window.VATES_TRACK && window.VATES_TRACK.reference()) || "";
    } catch (e) {}
    if (!ref) return link;
    return link + (link.indexOf("?") < 0 ? "?" : "&") +
      "client_reference_id=" + encodeURIComponent(ref);
  }

  function goToCheckout() {
    var url = checkoutUrl();
    if (!url) return false;
    if (window.VATES_TRACK) window.VATES_TRACK.track("checkout");
    /* The pixels queue their beacons synchronously but send them a tick
       later; a sixtieth of a second is under the threshold of noticing
       and is the difference between a counted click and a lost one. */
    window.setTimeout(function () { window.location.href = url; }, 60);
    return true;
  }

  el.form.addEventListener("submit", function (event) {
    event.preventDefault();
    hideNotice();
    if (goToCheckout()) return;
    addToCart(1);
    openDrawer();
  });

  // drawer line-item controls
  el.items.addEventListener("click", function (event) {
    var item = event.target.closest(".line-item");
    if (!item) return;

    if (event.target.closest("[data-remove]")) {
      removeLine(item.dataset.id);
      if (cart.length === 0) el.close.focus();
      return;
    }

    var step = event.target.closest("[data-line-step]");
    if (!step) return;

    var input = item.querySelector(".stepper__input");
    setLineQty(item.dataset.id, parseInt(input.value, 10) + Number(step.dataset.lineStep));
  });

  el.items.addEventListener("change", function (event) {
    var input = event.target.closest(".stepper__input");
    if (!input) return;
    var item = input.closest(".line-item");
    setLineQty(item.dataset.id, parseInt(input.value, 10));
  });

  // checkout is inert by design
  el.checkout.addEventListener("click", function () {
    if (goToCheckout()) return;
    showNotice("This is a demonstration only — no payment is taken and no order is placed.");
  });

  el.close.addEventListener("click", closeDrawer);
  el.backdrop.addEventListener("click", closeDrawer);

  document.addEventListener("keydown", function (event) {
    if (!isOpen()) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeDrawer();
    } else if (event.key === "Tab") {
      trapTab(event);
    }
  });

  /* ── The reel, from hero to page ground ──────────────────────
     At rest the reel is the hero. Scrolling zooms it out to full
     bleed, dims and blurs it back, and — once it has settled —
     stops it: one still picture behind the rest of the site.
     Scroll back to the top and it picks up where it left off. --- */

  var backdrop = document.getElementById("backdrop");
  var film = document.getElementById("backdrop-video");
  var reelEl = document.getElementById("reel");

  if (backdrop && film && reelEl) {
    var root = document.documentElement;
    var progress = -1;
    var queued = false;
    var handedOver = false;
    var settled = false;
    var timer = null;

    /* Half a second a picture: fast cutting, not a slideshow. The
       dissolve between them is --reel-fade in the stylesheet and has to
       stay well inside this. Reduced motion gets a slow reel instead —
       at this cadence the cuts are the motion. */
    var FRAME_MS = reduceMotion.matches ? 4000 : 500;
    var OVERSCAN = 1.06;   // keeps the background blur off the viewport edge

    /* The film is laid out contained — a panel on wide screens, the
       viewport on narrow ones — so the scale that takes it to full bleed
       has to be measured. The reel is full bleed already: the overscan
       is the whole of its cover. */
    var coverScale = function () {
      if (handedOver) return OVERSCAN;
      var width = film.offsetWidth;
      var height = film.offsetHeight;
      if (!width || !height) return 1;
      return Math.max(window.innerWidth / width, window.innerHeight / height) * OVERSCAN;
    };

    var measure = function () {
      root.style.setProperty("--bg-cover", coverScale().toFixed(4));
    };

    /* Autoplay is a request, not a guarantee: iOS refuses it outright in
       Low Power Mode, Low Data Mode does the same, and a per-site setting
       can too. The film is pointer-events: none, so the play button iOS
       paints over the poster is not tappable either — left alone, a
       refused hero stays one still frame for the whole visit. Ask again
       on the first gesture anywhere on the page, and whenever the tab
       comes back to the foreground. */
    var start = function () {
      if (handedOver || progress >= 1 || !film.paused) return;
      film.muted = true;   // unattended playback is only ever allowed muted
      var playing = film.play();
      if (playing && typeof playing.catch === "function") playing.catch(function () {});
    };

    /* These stay bound for the life of the page rather than being torn
       down on first play: start() is a no-op once the film is running,
       and leaving them means a film stalled or paused later — coming
       back from the background, a mid-visit refusal — heals on the next
       touch instead of staying stuck. */
    ["touchstart", "pointerdown", "click", "keydown"].forEach(function (type) {
      document.addEventListener(type, start, { passive: true });
    });

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        window.clearTimeout(timer);   // a backgrounded tab holds its picture
      } else {
        start();
        hold();
      }
    });

    /* ── The reel of stills ──────────────────────────────────────
       The pictures are named in the markup, not here: data-frame-src
       is the path with {n} standing in for a two-digit number,
       counted from 01 up to data-frame-count. ------------------- */
    var frames = (function () {
      var list = [];
      var template = reelEl.getAttribute("data-frame-src");
      var count = parseInt(reelEl.getAttribute("data-frame-count"), 10);
      if (!template || !(count > 0)) return list;
      for (var i = 1; i <= count; i++) {
        list.push(template.replace("{n}", (i < 10 ? "0" : "") + i));
      }
      return list;
    })();

    var slots = reelEl.querySelectorAll(".reel__frame");
    var idle = 1;      // the slot the next picture is decoded into
    var cursor = -1;   // how far through `frames` the reel has got
    var warmed = 0;    // how many have been pulled into cache so far

    /* Settled once the picture is loaded and decoded, so it is never
       faded up half-drawn. decode() only smooths the paint; load and
       error are what decide whether the picture is there at all. An
       image already in cache is complete before either can fire. */
    var ready = function (img) {
      return new Promise(function (resolve, reject) {
        if (img.complete) {
          if (img.naturalWidth) resolve(); else reject();
          return;
        }
        img.onload = resolve;
        img.onerror = reject;
      }).then(function () {
        return img.decode ? img.decode().catch(function () {}) : null;
      });
    };

    /* At two pictures a second there is no room to fetch one between
       cuts, so the whole reel is pulled into cache up front and the film
       plays over the top of it, buying the time. Detached Images are
       enough — the cache is what the slots actually read from, and a
       picture that fails here fails again in turn(), where it is
       dropped from the reel. */
    var warm = function () {
      /* Warming all 32 is right on a desk and wrong on a phone on
         cellular: it is roughly 2.5 MB before anyone has decided to buy
         anything. Where the browser will say — Data Saver on, or a
         connection it reports as 2g/3g — only the opening handful are
         fetched, and the rest arrive as the reel reaches them. The reel
         degrades to a slower first pass rather than to nothing. */
      var link = navigator.connection || {};
      var thrifty = link.saveData === true ||
        /^(slow-)?2g$/.test(link.effectiveType || "") ||
        link.effectiveType === "3g";
      var take = thrifty ? Math.min(6, frames.length) : frames.length;
      frames.slice(0, take).forEach(function (src) {
        var img = new Image();
        img.src = src;
      });
      warmed = take;
    };

    /* Whatever warm() left behind is picked up as the reel advances, so
       a thrifty connection still ends up with the whole reel — just
       paid for a frame at a time instead of all at once. */
    var warmNext = function () {
      if (warmed >= frames.length) return;
      var img = new Image();
      img.src = frames[warmed];
      warmed += 1;
    };

    var hold = function () {
      window.clearTimeout(timer);
      if (!handedOver || settled || document.hidden || frames.length < 2) return;
      timer = window.setTimeout(function () { turn(0); }, FRAME_MS);
    };

    /* Bring the next picture up in the idle slot, then swap which slot is
       showing. A picture that will not load is dropped from the reel
       rather than left as a gap in it; `tried` stops the search when none
       of them will load. */
    var turn = function (tried) {
      if (!frames.length || tried > frames.length) return;

      cursor = (cursor + 1) % frames.length;
      var index = cursor;
      var slot = slots[idle];
      var pic = slot.querySelector(".reel__pic");
      var blur = slot.querySelector(".reel__blur");

      pic.src = frames[index];
      blur.src = frames[index];   // the same file, so it costs one request

      ready(pic).then(function () {
        slots[idle].classList.add("is-current");
        slots[1 - idle].classList.remove("is-current");
        idle = 1 - idle;
        /* The film only steps aside once a picture has actually landed:
           if none of them load, the hero holds the last frame of the film
           rather than cutting to black. */
        backdrop.classList.add("is-reel");
        warmNext();
        hold();
      })["catch"](function () {
        frames.splice(index, 1);
        cursor = index - 1;
        turn(tried + 1);
      });
    };

    /* The film plays once, then the reel takes over and loops for the
       rest of the visit. It runs once, and a film that fails to load
       hands over rather than leaving the hero on a dead poster. */
    var handOver = function () {
      if (handedOver) return;
      handedOver = true;
      measure();   // the reel is full bleed where the film was contained
      turn(0);
    };

    film.addEventListener("ended", handOver);
    film.addEventListener("error", handOver);

    var apply = function () {
      queued = false;

      var span = Math.max(window.innerHeight * 0.7, 1);
      var next = Math.min(1, Math.max(0, window.scrollY / span));

      // Reduced motion: no scroll-linked zoom, just the two states.
      if (reduceMotion.matches) next = next > 0.35 ? 1 : 0;
      if (next === progress) return;
      progress = next;

      root.style.setProperty("--bg-p", next.toFixed(4));
      // soften early: the zoom reads as receding, not as an upscale
      backdrop.classList.toggle("is-background", next > 0.28);

      if (next === 1) {
        settled = true;
        window.clearTimeout(timer);
        film.pause();
      } else {
        settled = false;
        start();
        hold();
      }
    };

    var schedule = function () {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(apply);
    };

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", function () { measure(); schedule(); });
    film.addEventListener("loadedmetadata", measure);

    warm();      // the reel is in cache long before the film hands over to it
    measure();   // intrinsic size may not be known yet — loadedmetadata re-measures
    apply();     // a reload partway down the page starts as the background
  }

  /* ── reveal ──────────────────────────────────────────────────
     The wordmark section sits below the reel, so it fades up as it
     comes into view rather than being there from the start. ---------- */

  var revealables = document.querySelectorAll(".reveal");

  function revealAll() {
    Array.prototype.forEach.call(revealables, function (node) {
      node.classList.add("is-visible");
    });
  }

  if (reduceMotion.matches || !("IntersectionObserver" in window)) {
    revealAll();
  } else {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.25 });

    Array.prototype.forEach.call(revealables, function (node) { observer.observe(node); });
  }

  render();
})();
