/* ============================================================
   vates — the leaderboard

   Reads /api/leaderboard and draws the table. That endpoint is
   a serverless function: it holds the Stripe key, runs on
   Vercel's machines, and hands back handles and totals only.
   Nothing here has a key, and nothing here talks to Stripe —
   which is the point, because everything in this file is
   readable by anyone who opens view-source.

   The endpoint may legitimately have nothing to report: no key
   set yet, or no sales. Both come back as an empty board rather
   than an error, and the page says so plainly.
   ============================================================ */
(function () {
  "use strict";

  var SRC = "/api/leaderboard";

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

  /* The endpoint sets its own caching — five minutes at Vercel's edge,
     and no-store while it is unconfigured so it starts working the
     moment the key is set without anyone waiting out a cache. A 404 is
     the local case: served from a plain file server with no functions
     behind it, which is not an error worth showing a visitor. */
  fetch(SRC)
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
