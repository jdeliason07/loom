/* ============================================================
   vates — storefront behaviour
   Client-side state only. Nothing is persisted, nothing is sent.
   ============================================================ */
(function () {
  "use strict";

  var PRODUCT = {
    id: "no-01",
    name: "No. 01",
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
          '<span class="line-item__name">' + PRODUCT.name +
            '<span class="line-item__aka">\u2009\u2014\u2009\u201cThe Bottle\u201d</span>' +
          "</span>" +
        "</div>" +
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
    var parts = [];
    if (ref) parts.push("client_reference_id=" + encodeURIComponent(ref));

    /* Stripe carries utm_* through to the redirect URL after payment,
       which client_reference_id does not do — so these are how
       thanks.html knows which campaign the sale belongs to when it
       reports the conversion. */
    try {
      var camp = (window.VATES_TRACK && window.VATES_TRACK.campaign()) || {};
      Object.keys(camp).forEach(function (k) {
        parts.push(encodeURIComponent(k) + "=" + encodeURIComponent(camp[k]));
      });
    } catch (e) {}

    if (!parts.length) return link;
    return link + (link.indexOf("?") < 0 ? "?" : "&") + parts.join("&");
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

  /* Purchase opens the drawer; the drawer's Checkout is what leaves for
     Stripe. The step in between is not friction for its own sake — it is
     where "What's in the box" gets read, which is the last thing anyone
     wants to know before paying. */
  el.form.addEventListener("submit", function (event) {
    event.preventDefault();
    hideNotice();
    addToCart(1);
    openDrawer();
    if (window.VATES_TRACK) window.VATES_TRACK.track("add");
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

  /* ── Paging with a mouse ─────────────────────────────────────
     CSS scroll snapping gives a touchscreen exactly what was asked
     for, because a swipe is one continuous gesture the browser can
     measure against the half-way mark before it settles.

     A mouse wheel is not one gesture. Each notch is its own scroll of
     roughly a hundred pixels, which never reaches half a screen, so
     mandatory snapping pulls every one of them straight back. Measured
     at a 900px viewport: notches of 100, 120 and 240px all landed back
     at 0, and three at a human pace did too — the page could not be
     scrolled at all with a wheel.

     So where the pointer is fine, the wheel is taken over and moves one
     section per turn. A section taller than the screen is left alone
     until its far edge is on screen, which is what keeps the product
     section reading normally rather than paging under the cursor. */

  var PAGES = ".hero, .statement, .section--product";
  var finePointer = window.matchMedia("(pointer: fine)");
  var paging = false;

  function onWheel(event) {
    if (reduceMotion.matches) return;
    if (event.ctrlKey) return;              // pinch to zoom, not a scroll
    if (isOpen()) return;                   // the drawer scrolls itself
    if (Math.abs(event.deltaY) < 4) return; // horizontal or a stray nudge

    var pages = [].slice.call(document.querySelectorAll(PAGES));
    if (!pages.length) return;

    var y = window.scrollY;
    var viewport = window.innerHeight;
    var tops = pages.map(function (el) {
      return Math.round(el.getBoundingClientRect().top + y);
    });

    var here = 0;
    for (var i = 0; i < tops.length; i++) if (y >= tops[i] - 2) here = i;

    var height = pages[here].getBoundingClientRect().height;
    var bottom = tops[here] + height;
    var down = event.deltaY > 0;

    /* Still something of this section left to read in the direction of
       travel: let the browser scroll it the ordinary way. */
    if (down && y + viewport < bottom - 2) return;
    if (!down && y > tops[here] + 2) return;

    var next = here + (down ? 1 : -1);
    /* Past the last section is the footer, which is not a page — let
       normal scrolling carry on into it. */
    if (next < 0 || next >= tops.length) return;

    event.preventDefault();
    if (paging) return;
    paging = true;
    window.scrollTo({ top: tops[next], behavior: "smooth" });
    window.setTimeout(function () { paging = false; }, 520);
  }

  /* Bound only where it is used, never merely guarded from inside. A
     non-passive wheel listener takes scrolling off the compositor for
     the whole document, and on a touch device that was enough on its
     own to break the CSS snapping this is meant to complement — swipes
     stopped advancing at all. Nothing is bound unless there is a mouse. */
  function bindWheel(on) {
    if (on) document.addEventListener("wheel", onWheel, { passive: false });
    else document.removeEventListener("wheel", onWheel, { passive: false });
  }

  bindWheel(finePointer.matches);
  /* A tablet with a trackpad attached mid-visit, and the reverse. */
  if (finePointer.addEventListener) {
    finePointer.addEventListener("change", function (e) { bindWheel(e.matches); });
  }

  /* ── The reel, from hero to page ground ──────────────────────
     At rest the reel is the hero. Scrolling zooms it out to full
     bleed, dims and blurs it back, and — once it has settled —
     stops it: one still picture behind the rest of the site.
     Scroll back to the top and it picks up where it left off.

     There was an intro film in front of all this that played once and
     handed over on its "ended" event. It is gone, and with it the
     handover, the sessionStorage that stopped it playing twice in a
     tab, and the listeners that re-asked for autoplay after iOS
     refused it. The reel is the hero from the first paint. ------- */

  var backdrop = document.getElementById("backdrop");
  var reelEl = document.getElementById("reel");

  if (backdrop && reelEl) {
    var root = document.documentElement;   // --bg-p lives here
    var progress = -1;
    var queued = false;
    var settled = false;
    var timer = null;

    /* A second and a half a picture. It was half a second, which was the
       right cadence for pictures alone and is the wrong one now there is
       a line to read under them: a quote of any length cannot be taken
       in twice a second. The dissolve between cuts is --reel-fade in the
       stylesheet and the caption's own handover is timed off it; both
       have to stay well inside this. Reduced motion gets a slow reel. */
    var FRAME_MS = reduceMotion.matches ? 4000 : 1500;

    /* The zoom out to the background used to be measured, because the
       film was laid out contained — a panel on wide screens, the
       viewport on narrow ones — and the scale that took it to full bleed
       depended on its own size. The reel is full bleed already, so the
       overscan is the whole of it and it is a constant: --bg-zoom in the
       stylesheet. Nothing here has to measure anything any more. */

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        window.clearTimeout(timer);   // a backgrounded tab holds its picture
      } else {
        hold();
      }
    });

    /* ── The reel of stills ──────────────────────────────────────
       The pictures are named in the markup, not here: data-frame-src
       is the path with {n} standing in for a two-digit number,
       counted from 01 up to data-frame-count. The quotes are named
       there too, in #reel-captions, keyed by that same number. ---- */

    /* A missing, empty or malformed block is not worth failing the reel
       over: the pictures still run, they just run without quotes. */
    var quotes = (function () {
      var node = document.getElementById("reel-captions");
      if (!node) return {};
      try {
        var parsed = JSON.parse(node.textContent);
        return (parsed && typeof parsed === "object") ? parsed : {};
      } catch (e) { return {}; }
    })();

    /* Each frame carries its own quotes rather than the two being held
       in step by index: turn() drops a picture that will not load out of
       `frames` entirely, and a parallel list would be left one out of
       line with the reel from there on. `said` is how many times this
       frame has come round, which is what picks the quote on a frame
       that holds more than one person. */
    var frames = (function () {
      var list = [];
      var template = reelEl.getAttribute("data-frame-src");
      var count = parseInt(reelEl.getAttribute("data-frame-count"), 10);
      if (!template || !(count > 0)) return list;
      for (var i = 1; i <= count; i++) {
        var n = (i < 10 ? "0" : "") + i;
        list.push({
          src: template.replace("{n}", n),
          lines: Array.isArray(quotes[n]) ? quotes[n] : [],
          said: 0
        });
      }
      return list;
    })();

    var slots = reelEl.querySelectorAll(".reel__frame");
    var idle = 1;      // the slot the next picture is decoded into
    var cursor = -1;   // how far through `frames` the reel has got
    var warmed = 0;    // how many have been pulled into cache so far

    var caption = document.getElementById("reel-caption");
    var lines = document.querySelectorAll(".reel__caption-line");
    var idleLine = 1;  // the slot the next quote is written into

    /* The quote under the picture. Two slots for the same reason the
       pictures have two — the one being written into is the one that is
       not showing — but they hand over differently: a picture covers the
       one it replaces, and text does not, so two quotes fading through
       each other in the same place would be unreadable. The stylesheet
       clears the outgoing one first and holds the incoming one back
       until it has gone.

       A frame that holds several people takes the next of them each time
       it comes round, so a loop of the reel credits Plato and the next
       credits Aristotle. A frame with nothing to say clears the line. */
    var say = function (frame) {
      if (lines.length < 2) return;

      /* Nothing to say: the words go, and so does the wash behind them.
         It is there to be read against, and on the Declaration or the
         Nike memo — pages of type, and no one to quote — it would be a
         shadow across the bottom of the picture for no reason. */
      if (!frame.lines.length) {
        if (caption) caption.classList.add("is-quiet");
        lines[0].classList.remove("is-current");
        lines[1].classList.remove("is-current");
        return;
      }

      if (caption) caption.classList.remove("is-quiet");

      var line = frame.lines[frame.said % frame.lines.length];
      frame.said += 1;

      var slot = lines[idleLine];
      slot.querySelector(".reel__quote").textContent = line.q || "";
      slot.querySelector(".reel__said").textContent = line.who || "";
      lines[1 - idleLine].classList.remove("is-current");
      slot.classList.add("is-current");
      idleLine = 1 - idleLine;
    };

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

    /* There is no room to fetch a picture between cuts, and no film in
       front of the reel to buy the time any more, so the whole of it is
       pulled into cache while the first picture — preloaded in the head,
       so it is the first thing painted — holds the screen. It is called
       after turn(0) rather than before it for that reason: thirty-two
       requests queued ahead of the one picture anybody is waiting on
       would be thirty-two requests in its way. Detached
       Images are enough: the cache is what the slots actually read from,
       and a picture that fails here fails again in turn(), where it is
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
      frames.slice(0, take).forEach(function (frame) {
        var img = new Image();
        img.src = frame.src;
      });
      warmed = take;
    };

    /* Whatever warm() left behind is picked up as the reel advances, so
       a thrifty connection still ends up with the whole reel — just
       paid for a frame at a time instead of all at once. */
    var warmNext = function () {
      if (warmed >= frames.length) return;
      var img = new Image();
      img.src = frames[warmed].src;
      warmed += 1;
    };

    var hold = function () {
      window.clearTimeout(timer);
      if (settled || document.hidden || frames.length < 2) return;
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

      pic.src = frames[index].src;
      blur.src = frames[index].src;   // the same file, so it costs one request

      ready(pic).then(function () {
        slots[idle].classList.add("is-current");
        slots[1 - idle].classList.remove("is-current");
        idle = 1 - idle;
        /* Set once the first picture has actually landed, not before: it
           is what fades the quote up, and there is nothing to put a quote
           under until there is a picture. If none of them load it is
           never set, and the hero is the page's own ground. */
        backdrop.classList.add("is-reel");
        say(frames[index]);   // the quote turns with the picture, not before it
        warmNext();
        hold();
      })["catch"](function () {
        frames.splice(index, 1);
        cursor = index - 1;
        turn(tried + 1);
      });
    };

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
      } else {
        settled = false;
        hold();
      }
    };

    var schedule = function () {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(apply);
    };

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    apply();     // a reload partway down the page starts as the background
    turn(0);     // the reel is running from the first paint
    warm();      // and the rest of it is fetched behind the picture on screen
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
