/* ============================================================
   vates — the leaderboard

   Reads assets/data/leaderboard.json and draws the table. The
   JSON is written by tools/leaderboard.mjs against the Stripe
   API, on somebody's own machine; nothing here talks to Stripe
   and nothing here needs a key, which is the point — a static
   site has nowhere to keep one that visitors cannot read.

   The file may legitimately not exist yet. That is the state
   the page ships in, so it is a first-class case rather than an
   error: nobody has sold anything, and the page says so.
   ============================================================ */
(function () {
  "use strict";

  var SRC = "assets/data/leaderboard.json";

  var state = document.getElementById("board-state");
  var table = document.getElementById("board-table");
  var rows = document.getElementById("board-rows");
  var updated = document.getElementById("board-updated");
  if (!state || !table || !rows) return;

  function show(message) {
    state.textContent = message;
    state.hidden = false;
    table.hidden = true;
  }

  function money(minor, currency) {
    var amount = (Number(minor) || 0) / 100;
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: (currency || "usd").toUpperCase(),
        maximumFractionDigits: amount % 1 === 0 ? 0 : 2
      }).format(amount);
    } catch (e) {
      return "$" + amount.toFixed(2);
    }
  }

  function cell(row, text, className) {
    var td = document.createElement("td");
    td.textContent = text;
    if (className) td.className = className;
    row.appendChild(td);
    return td;
  }

  function draw(data) {
    var creators = (data && data.creators) || [];
    if (!creators.length) {
      show("No sales through a creator link yet. The first one on the board " +
           "gets the whole thing to themselves.");
      return;
    }

    rows.textContent = "";
    creators.forEach(function (c, i) {
      var tr = document.createElement("tr");

      var rank = document.createElement("td");
      rank.className = "board__rank";
      rank.textContent = String(i + 1);
      tr.appendChild(rank);

      /* The handle is a label chosen when the link was minted, not a
         verified account, so it is written as plain text and never as
         a link to a profile that may not be theirs. */
      var who = document.createElement("td");
      who.className = "board__who";
      who.textContent = "@" + c.ref;
      tr.appendChild(who);

      cell(tr, String(c.orders || 0), "board__num");
      cell(tr, money(c.earned, data.currency), "board__num board__earned");

      if (i < 3) tr.className = "is-top";
      rows.appendChild(tr);
    });

    state.hidden = true;
    table.hidden = false;

    if (data.generated && updated) {
      var when = new Date(data.generated);
      if (!isNaN(when)) {
        updated.textContent = "Last counted " + when.toLocaleDateString(undefined, {
          year: "numeric", month: "long", day: "numeric"
        }) + ".";
        updated.hidden = false;
      }
    }
  }

  /* Cache-busted: the JSON changes without the page changing, and a
     stale leaderboard is worse than a slow one when it is what people
     are being paid against. */
  fetch(SRC + "?t=" + Date.now(), { cache: "no-store" })
    .then(function (res) {
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then(function (data) {
      if (data === null) {
        show("No sales through a creator link yet. The first one on the " +
             "board gets the whole thing to themselves.");
        return;
      }
      draw(data);
    })
    .catch(function () {
      show("The board could not be loaded just now. It will be back.");
    });
})();
