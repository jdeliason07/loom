/* ============================================================
   vates — the creator form

   One job: get what somebody typed on creators.html somewhere a
   human will read it, without a server and without ever losing it.

   Two paths, decided by config.js:
     · creators.formEndpoint set → a plain JSON POST
     · not set                  → a pre-filled email, composed here

   The fallback is the point. This repository has no back end, so an
   unconfigured endpoint is the likely state on the day the first
   direct message goes out, and a form that quietly discards a
   mailing address is worse than no form at all.
   ============================================================ */
(function () {
  "use strict";

  var CONFIG = (window.VATES && window.VATES.creators) || {};
  var form = document.getElementById("creator-form");
  if (!form) return;

  var status = document.getElementById("cf-status");
  var submit = document.getElementById("cf-submit");

  /* ── The commission, if there is one ─────────────────────────
     Empty stays an em dash. The specs on the front page leave
     height and weight as dashes until the spec sheet fills them,
     and a rate nobody has agreed to is the same kind of blank. */
  if (CONFIG.commission) {
    var slots = document.querySelectorAll("[data-creator-rate]");
    for (var i = 0; i < slots.length; i++) slots[i].textContent = CONFIG.commission;
  }

  /* ── Saying something back ───────────────────────────────── */

  function say(message, tone) {
    status.textContent = message;
    status.hidden = false;
    status.classList.toggle("is-bad", tone === "bad");
  }

  /* ── Reading the form ────────────────────────────────────── */

  function collect() {
    var data = {};
    var fd = new FormData(form);
    fd.forEach(function (value, key) { data[key] = value; });
    /* Unticked boxes are absent from FormData rather than false, and
       "they did not agree" is a thing the record has to state rather
       than imply. The optional two are permissions; a missing key
       reads as an oversight where an explicit no does not. */
    data.ugc = data.ugc ? "yes" : "no";
    data.portrait = data.portrait ? "yes" : "no";
    data.disclosure = data.disclosure ? "yes" : "no";
    data.submitted = new Date().toISOString();
    data.page = window.location.href;
    return data;
  }

  /* Everything the form holds, as flat text. Used for the email
     body, and it is what a person actually has to read either way. */
  function transcribe(data) {
    return [
      "Name:      " + data.name,
      "Email:     " + data.email,
      "Handle:    " + data.handle,
      "Platform:  " + data.platform,
      "",
      "Send to:",
      data.address,
      "",
      "Disclosure understood:   " + data.disclosure,
      "May ask about paid ads:  " + data.ugc,
      "May use name + portrait: " + data.portrait,
      "",
      "Submitted: " + data.submitted
    ].join("\n");
  }

  /* ── The fallback: hand it to their mail client ──────────── */

  function byEmail(data) {
    var to = CONFIG.contactEmail || "";
    if (!to) {
      say("This form is not connected yet. Please reply to the message that " +
          "sent you here and we will sort it out by hand.", "bad");
      return;
    }
    var url = "mailto:" + to +
      "?subject=" + encodeURIComponent("Creator sample — " + (data.handle || data.name)) +
      "&body=" + encodeURIComponent(transcribe(data));
    window.location.href = url;
    say("Opening your email so you can send it — nothing has been submitted " +
        "until you hit send there.");
  }

  /* ── Sending ─────────────────────────────────────────────── */

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    /* novalidate is on the markup so this runs on our terms rather
       than the browser's, but the constraints are still the
       browser's — required, type="email" and the rest. */
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    var data = collect();

    if (!CONFIG.formEndpoint) { byEmail(data); return; }

    submit.disabled = true;
    say("Sending…");

    fetch(CONFIG.formEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(data)
    }).then(function (response) {
      if (!response.ok) throw new Error("HTTP " + response.status);
      form.reset();
      submit.disabled = false;
      say("Got it. We will get a bottle in the post and come back to you with " +
          "your link.");
    }).catch(function () {
      submit.disabled = false;
      /* A dropped request must not take the address down with it —
         what they typed is still in the fields, and the email path
         is still open. */
      say("That did not send. Opening an email with the same details " +
          "instead — nothing you typed has been lost.", "bad");
      byEmail(data);
    });
  });
})();
