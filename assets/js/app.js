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
    price: 99,
    image: "assets/img/no-01.webp",
    max: 10
  };

  /** @type {{id:string,qty:number}[]} — in-memory only, cleared on reload. */
  var cart = [];

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  var el = {
    year: document.getElementById("year"),
    form: document.getElementById("purchase-form"),
    qty: document.getElementById("qty"),
    drawer: document.getElementById("order-drawer"),
    backdrop: document.getElementById("drawer-backdrop"),
    close: document.getElementById("drawer-close"),
    items: document.getElementById("line-items"),
    empty: document.getElementById("drawer-empty"),
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

  // product stepper
  el.form.addEventListener("click", function (event) {
    var button = event.target.closest("[data-step]");
    if (!button) return;
    el.qty.value = String(clamp(parseInt(el.qty.value, 10) + Number(button.dataset.step), 1, PRODUCT.max));
  });

  el.qty.addEventListener("change", function () {
    el.qty.value = String(clamp(parseInt(el.qty.value, 10), 1, PRODUCT.max));
  });

  el.form.addEventListener("submit", function (event) {
    event.preventDefault();
    hideNotice();
    addToCart(clamp(parseInt(el.qty.value, 10), 1, PRODUCT.max));
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
     bleed, dims and blurs it back, and — once it has settled — pauses
     it: one still frame behind the rest of the site. Scroll back to
     the top and it picks up where it left off. ------------------- */

  var backdrop = document.getElementById("backdrop");
  var reel = document.getElementById("backdrop-video");

  if (backdrop && reel) {
    var root = document.documentElement;
    var progress = -1;
    var queued = false;

    /* The reel is laid out contained (a panel on wide screens, the
       viewport on narrow ones); this is the scale that takes it to full
       bleed. The 6% of overscan keeps the blur from feathering the
       edges of the viewport in. */
    var coverScale = function () {
      var width = reel.offsetWidth;
      var height = reel.offsetHeight;
      if (!width || !height) return 1;
      return Math.max(window.innerWidth / width, window.innerHeight / height) * 1.06;
    };

    var measure = function () {
      root.style.setProperty("--bg-cover", coverScale().toFixed(4));
    };

    /* Autoplay is a request, not a guarantee: iOS refuses it outright in
       Low Power Mode, Low Data Mode does the same, and a per-site setting
       can too. The reel is pointer-events: none, so the play button iOS
       paints over the poster is not tappable either — left alone, a
       refused hero stays one still frame for the whole visit. Ask again
       on the first gesture anywhere on the page, and whenever the tab
       comes back to the foreground. */
    var start = function () {
      if (progress >= 1 || !reel.paused) return;
      reel.muted = true;   // unattended playback is only ever allowed muted
      var playing = reel.play();
      if (playing && typeof playing.catch === "function") playing.catch(function () {});
    };

    /* These stay bound for the life of the page rather than being torn
       down on first play: start() is a no-op once the reel is running,
       and leaving them means a reel stalled or paused later — coming
       back from the background, a mid-visit refusal — heals on the next
       touch instead of staying stuck. */
    ["touchstart", "pointerdown", "click", "keydown"].forEach(function (type) {
      document.addEventListener(type, start, { passive: true });
    });

    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) start();
    });

    /* The intro film plays once, then the reel of faces takes over and
       loops for the rest of the visit. The markup stays the only place
       that names a file; the handover reads them off the element. It runs
       once, and an intro that fails to load hands over rather than
       leaving the hero on a dead poster. */
    var handedOver = false;

    var handOver = function () {
      if (handedOver) return;

      /* Two cuts of the same reel: a wide one framed for a landscape
         screen, and a tall one for a phone, where the pictures sit whole
         over a blurred copy of themselves rather than being cropped to a
         shape they were never shot in. Chosen once, here, off the same
         breakpoint the stylesheet uses. */
      var wide = window.matchMedia && window.matchMedia("(min-width: 900px)").matches;
      var key = wide ? "wide" : "tall";
      var formats = [
        [reel.getAttribute("data-loop-" + key + "-mp4"), "video/mp4"],
        [reel.getAttribute("data-loop-" + key + "-webm"), "video/webm"]
      ].filter(function (pair) { return !!pair[0]; });
      if (!formats.length) return;

      handedOver = true;
      reel.loop = true;            // the reel is where the hero comes to rest
      reel.removeAttribute("poster");

      /* Swap the <source> list rather than assigning src: src would win
         over the children and throw the fallback away, leaving anything
         that cannot decode H.264 on a dead frame. This way the browser
         goes on picking the format it can actually play. */
      while (reel.firstChild) reel.removeChild(reel.firstChild);
      formats.forEach(function (pair) {
        var node = document.createElement("source");
        node.setAttribute("src", pair[0]);
        node.setAttribute("type", pair[1]);
        reel.appendChild(node);
      });

      /* The reel can be cropped to fill the screen; the intro cannot,
         without cutting the lines of type off its top and bottom. */
      backdrop.classList.add("is-reel");

      reel.load();
      measure();                   // the reel is not the shape the intro was
      start();
    };

    reel.addEventListener("ended", handOver);
    reel.addEventListener("error", handOver);

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
        reel.pause();
      } else if (reel.paused) {
        start();
      }
    };

    var schedule = function () {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(apply);
    };

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", function () { measure(); schedule(); });
    reel.addEventListener("loadedmetadata", measure);

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
