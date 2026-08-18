/* ============================================================
   vates — storefront behaviour
   Client-side state only. Nothing is persisted, nothing is sent.
   Three parts: the store (cart, drawer, checkout), the iris (the
   opening's canvas), and the film-to-reel handover in Who we are.
   ============================================================ */
(function () {
  "use strict";

  var PRODUCT = {
    id: "no-01",
    name: "No. 01",
    price: 49,
    /* The drawer shows the bottle on its own — at 4.5rem a whole
       room is a smudge. */
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
            '<span class="line-item__aka"> — smoke</span>' +
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
     Payment Link configured, Checkout leaves for Stripe on the click —
     the attribution token rides along as client_reference_id, so the
     sale lands in the dashboard already credited to whoever sent them.

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
     Stripe. The step in between is where "What's in the box" gets read,
     which is the last thing anyone wants to know before paying. */
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

  // falls back to the demonstration notice when no Payment Link is set
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

  render();

  /* ── The iris ────────────────────────────────────────────────
     The seer's eye behind the opening: band-coloured rings breathing
     out of step around a dark pupil, fine spokes slowly wheeling.
     Runs only while the hero is on screen and the tab is visible;
     reduced motion gets one still frame. --------------------------- */

  var canvas = document.getElementById("iris");

  if (canvas && canvas.getContext) {
    var ctx = canvas.getContext("2d");
    var DPR = Math.min(window.devicePixelRatio || 1, 2);
    var BANDS = ["#76b856", "#f2ba4b", "#e3873d", "#cf4743", "#8b4192", "#4698d3"];
    var PAPER = "244, 238, 227";
    var GROUND = "30, 24, 15";
    var SPOKES = 96;

    var W = 0, H = 0;
    var t = 0, raf = 0, lastFrame = 0, running = false, heroVisible = true;
    var rings = [];

    var seed = function () {
      rings = [];
      for (var i = 0; i < 16; i++) {
        rings.push({
          f: 0.36 + 0.64 * (i / 15),
          color: BANDS[i % 6],
          a: 0.10 + Math.random() * 0.16,
          wob: 1.5 + Math.random() * 3,
          sp: 0.2 + Math.random() * 0.4,
          ph: Math.random() * Math.PI * 2
        });
      }
    };

    var draw = function () {
      ctx.clearRect(0, 0, W, H);
      var cx = W / 2, cy = H * 0.52;
      var R = Math.min(W * 0.46, H * 0.44) * (1 + 0.02 * Math.sin(t * 0.5));
      var i;

      /* the glow behind everything */
      var glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.6);
      glow.addColorStop(0, "rgba(227, 135, 61, 0.16)");
      glow.addColorStop(1, "rgba(227, 135, 61, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(cx - R * 1.7, cy - R * 1.7, R * 3.4, R * 3.4);

      /* fine spokes, slowly wheeling */
      ctx.strokeStyle = "rgba(" + PAPER + ", 0.07)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (i = 0; i < SPOKES; i++) {
        var an = (i / SPOKES) * Math.PI * 2 + t * 0.05;
        var r0 = R * 0.4, r1 = R * (0.96 + 0.03 * Math.sin(t * 0.7 + i));
        ctx.moveTo(cx + Math.cos(an) * r0, cy + Math.sin(an) * r0);
        ctx.lineTo(cx + Math.cos(an) * r1, cy + Math.sin(an) * r1);
      }
      ctx.stroke();

      /* the rings, band-coloured, breathing out of step */
      for (i = 0; i < rings.length; i++) {
        var g = rings[i];
        var rr = R * g.f + Math.sin(t * g.sp + g.ph) * g.wob;
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(1, rr), 0, Math.PI * 2);
        ctx.strokeStyle = g.color;
        ctx.globalAlpha = g.a * (0.8 + 0.2 * Math.sin(t * g.sp * 1.3 + g.ph));
        ctx.lineWidth = 1 + (i % 3) * 0.7;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      /* the pupil, and one still point of light */
      var pu = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.36);
      pu.addColorStop(0, "rgba(" + GROUND + ", 1)");
      pu.addColorStop(0.85, "rgba(" + GROUND + ", 1)");
      pu.addColorStop(1, "rgba(" + GROUND + ", 0)");
      ctx.fillStyle = pu;
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.36, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(" + PAPER + ", 0.9)";
      ctx.beginPath(); ctx.arc(cx - R * 0.09, cy - R * 0.11, 2.4, 0, Math.PI * 2); ctx.fill();
    };

    var resize = function () {
      W = canvas.clientWidth; H = canvas.clientHeight;
      if (!W || !H) return;
      canvas.width = W * DPR; canvas.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      seed();
      if (reduceMotion.matches) { t = 1; draw(); }
    };

    var loop = function (now) {
      if (!running) return;
      var dt = lastFrame ? Math.min(0.05, (now - lastFrame) / 1000) : 0.016;
      lastFrame = now;
      t += dt;
      draw();
      raf = window.requestAnimationFrame(loop);
    };

    var setRunning = function (on) {
      on = on && !reduceMotion.matches && heroVisible && !document.hidden;
      if (on === running) return;
      running = on;
      if (running) { lastFrame = 0; raf = window.requestAnimationFrame(loop); }
      else window.cancelAnimationFrame(raf);
    };

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        heroVisible = entries[0].isIntersecting;
        setRunning(true);
      }, { threshold: 0.05 }).observe(canvas);
    }
    document.addEventListener("visibilitychange", function () { setRunning(true); });
    window.addEventListener("resize", resize);
    if (reduceMotion.addEventListener) {
      reduceMotion.addEventListener("change", function () { resize(); setRunning(true); });
    }

    resize();
    setRunning(true);
  }

  /* ── The film, then the creators ─────────────────────────────
     The archive reel lives inside the film's own frame and takes
     over the moment the film ends. The pictures are named in the
     markup: data-frame-src is the path with {n} standing in for a
     two-digit number, counted from 01 up to data-frame-count.
     Replaying the film puts it back on top; the reel returns at the
     next "ended". Holds its picture when the tab is hidden or the
     section is off screen. ---------------------------------------- */

  var film = document.getElementById("about-film");
  var reel = document.getElementById("about-reel");

  if (film && reel) {
    var frames = (function () {
      var list = [];
      var template = reel.getAttribute("data-frame-src");
      var count = parseInt(reel.getAttribute("data-frame-count"), 10);
      if (!template || !(count > 0)) return list;
      for (var i = 1; i <= count; i++) {
        list.push(template.replace("{n}", (i < 10 ? "0" : "") + i));
      }
      return list;
    })();

    var slots = reel.querySelectorAll("img");
    var idle = 1, cursor = -1, timer = null, visible = true, active = false;
    var warmed = 0;
    var HOLD = 2600;

    /* The sourced quotes, keyed by the frame's two-digit number. A frame
       with a list takes the next entry each time it comes round; a frame
       with no entry runs without a quote. A missing or malformed block
       is caught: the reel runs, it just runs quietly. */
    var quotes = (function () {
      try {
        return JSON.parse(document.getElementById("reel-captions").textContent) || {};
      } catch (e) { return {}; }
    })();
    var quoteTurns = {};
    var quoteBox = document.getElementById("about-quote");

    var say = function (frameIndex) {
      if (!quoteBox) return;
      var key = (frameIndex < 9 ? "0" : "") + (frameIndex + 1);
      var list = quotes[key];
      if (!list || !list.length) { quoteBox.hidden = true; return; }
      var at = quoteTurns[key] || 0;
      quoteTurns[key] = (at + 1) % list.length;
      var entry = list[at];
      quoteBox.querySelector(".about__quote").textContent = entry.q || "";
      quoteBox.querySelector(".about__quote-by").textContent = entry.who || "";
      quoteBox.hidden = false;
    };

    /* Pull the first pictures into cache while the film plays, so the
       handover lands on a decoded frame rather than a fetch. */
    var warmNext = function () {
      if (warmed >= frames.length) return;
      var img = new Image();
      img.src = frames[warmed];
      warmed += 1;
    };

    var turn = function () {
      if (!frames.length) return;
      cursor = (cursor + 1) % frames.length;
      var slot = slots[idle];
      slot.src = frames[cursor];
      var done = function () {
        if (!active) return;
        slot.classList.add("is-current");
        slots[1 - idle].classList.remove("is-current");
        idle = 1 - idle;
        say(cursor);
        warmNext();
        hold();
      };
      if (slot.decode) slot.decode().then(done)["catch"](done);
      else done();
    };

    var hold = function () {
      window.clearTimeout(timer);
      if (!active || document.hidden || !visible || reduceMotion.matches) return;
      timer = window.setTimeout(turn, HOLD);
    };

    film.addEventListener("play", function () {
      /* Replay: the film comes back on top, the reel stands down. */
      active = false;
      window.clearTimeout(timer);
      slots[0].classList.remove("is-current");
      slots[1].classList.remove("is-current");
      if (quoteBox) quoteBox.hidden = true;
      /* a head start for the handover */
      warmNext(); warmNext(); warmNext();
    });

    film.addEventListener("ended", function () {
      active = true;
      turn();   // under reduced motion this lands one still and stays
    });

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        hold();
      }, { threshold: 0.1 }).observe(reel);
    }
    document.addEventListener("visibilitychange", hold);
  }
})();
