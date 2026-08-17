/* ============================================================
   loom — storefront behaviour
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
    header: document.querySelector(".site-header"),
    wordmark: document.getElementById("wordmark"),
    slot: document.querySelector(".hero__wordmark-slot"),
    tagline: document.querySelector(".hero__tagline"),
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

  /* ── wordmark: hero scale → centre of the top banner ─────────
     The wordmark is fixed. .hero__wordmark-slot holds its place in the
     hero layout and tells us where it rests at the top of the page; the
     banner's mid-line tells us where it lands. Scroll interpolates
     between the two. --------------------------------------------------- */

  var BANNER_SIZE = 34; // px, the wordmark's font-size once docked

  var wm = { start: 0, end: 0, scale: 1, travel: 1 };

  function measureWordmark() {
    var slot = el.slot.getBoundingClientRect();
    var fontSize = parseFloat(window.getComputedStyle(el.wordmark).fontSize) || 1;

    wm.start = slot.top + window.scrollY + slot.height / 2;
    wm.end = el.header.getBoundingClientRect().height / 2;
    wm.scale = Math.min(1, BANNER_SIZE / fontSize);
    wm.travel = Math.max(1, window.innerHeight * 0.55);
  }

  function paintWordmark() {
    var p = clamp(window.scrollY / wm.travel, 0, 1);

    // reduced motion: dock it outright rather than animating on scroll
    if (reduceMotion.matches) p = window.scrollY > 24 ? 1 : 0;
    else p = p * p * (3 - 2 * p); // smoothstep

    el.wordmark.style.setProperty("--wm-y", (wm.start + (wm.end - wm.start) * p).toFixed(2) + "px");
    el.wordmark.style.setProperty("--wm-s", (1 + (wm.scale - 1) * p).toFixed(4));
    el.tagline.style.opacity = String(clamp(1 - p * 1.8, 0, 1));
  }

  // header treatment on scroll
  var ticking = false;

  function onScroll() {
    el.header.classList.toggle("is-scrolled", window.scrollY > 24);
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      paintWordmark();
      ticking = false;
    });
  }

  function onResize() {
    measureWordmark();
    paintWordmark();
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", onResize);

  // the slot's height depends on Space Grotesk, so measure again once it lands
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(onResize);

  onResize();
  onScroll();

  render();
})();
