/* ============================================================
   vates — GET /api/leaderboard

   A Vercel serverless function. It runs on Vercel's machines,
   not in the visitor's browser, which is the only reason it may
   hold a Stripe key at all. The key comes from the project's
   environment variables and is never sent to the client, never
   logged, and never written to this repository.

   What the browser gets back is handles, order counts and
   totals. No customer name, email or address is read from
   Stripe, let alone returned.

   Environment
     STRIPE_SECRET_KEY   required. A RESTRICTED key with read
                         access to Checkout Sessions and nothing
                         else — this function only ever reads.
     LEADERBOARD_RATE    commission percentage, default 20
     LEADERBOARD_MIN     hide creators below N orders, default 1
   ============================================================ */

const API = process.env.STRIPE_API_BASE || "https://api.stripe.com";

/* How long Vercel's edge may serve a cached copy. Every visitor
   hitting Stripe directly would burn the rate limit and add a
   round trip to the page for numbers that change a few times a
   day at best. Five minutes fresh, ten more while revalidating. */
const CACHE = "public, s-maxage=300, stale-while-revalidate=600";

async function stripe(path, params, key) {
  const url = new URL(API + path);
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) v.forEach((item) => url.searchParams.append(k, item));
    else if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, {
    headers: { Authorization: "Bearer " + key, "Stripe-Version": "2024-06-20" }
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    /* The message may name the key or the account, so it is thrown
       for the server log and never handed to the caller. */
    const err = new Error(body?.error?.message || res.statusText);
    err.status = res.status;
    throw err;
  }
  return body;
}

/* Checkout Sessions, not Charges: client_reference_id lives on the
   session and is not copied onto the PaymentIntent or the Charge.
   The charge is expanded for amount_refunded — a refunded order
   must not earn anyone a commission. */
async function* sessions(key) {
  let after;
  /* A hard ceiling on pages, so a runaway loop cannot hold the
     function open until it times out. 50 pages is 5,000 orders. */
  for (let page = 0; page < 50; page++) {
    const body = await stripe("/v1/checkout/sessions", {
      limit: 100,
      status: "complete",
      ...(after ? { starting_after: after } : {}),
      "expand[]": ["data.payment_intent.latest_charge"]
    }, key);
    const rows = body.data || [];
    for (const row of rows) yield row;
    if (!body.has_more || !rows.length) return;
    after = rows[rows.length - 1].id;
  }
}

/* track.js writes  src_x__med_y__cmp_z__ref_janedoe__t_1755512345 */
function creatorOf(reference) {
  if (!reference) return null;
  for (const part of String(reference).split("__")) {
    if (part.startsWith("ref_")) {
      const handle = part.slice(4).trim();
      /* The token is built from a query string a stranger controls,
         so it is treated as untrusted text: clipped, and reduced to
         the alphabet track.js was supposed to have written. */
      if (handle) return handle.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40) || null;
    }
  }
  return null;
}

function refundedMinor(session) {
  const charge = session.payment_intent?.latest_charge;
  return typeof charge?.amount_refunded === "number" ? charge.amount_refunded : 0;
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const key = process.env.STRIPE_SECRET_KEY || "";
  const rate = Math.min(100, Math.max(0, Number(process.env.LEADERBOARD_RATE ?? 20))) / 100;
  const min = Math.max(1, Number(process.env.LEADERBOARD_MIN ?? 1));

  const empty = (reason) => {
    /* An unconfigured or broken board reads as "nothing yet" to the
       visitor rather than as an error, and is not cached at the edge,
       so it fixes itself the moment the key is set. */
    res.setHeader("Cache-Control", "no-store");
    res.status(200).end(JSON.stringify({
      generated: new Date().toISOString(),
      currency: "usd", rate, creators: [],
      totals: { orders: 0, attributed: 0, unattributed: 0, revenue: 0 },
      ready: false, reason
    }));
  };

  if (!key) {
    console.error("STRIPE_SECRET_KEY is not set on this deployment.");
    return empty("not-configured");
  }

  const byCreator = new Map();
  let currency = "usd";
  let orders = 0, attributed = 0, unattributed = 0, revenue = 0;

  try {
    for await (const s of sessions(key)) {
      /* A complete session is not a paid one — an asynchronous payment
         method can complete the session and fail afterwards. */
      if (s.payment_status !== "paid") continue;

      const net = (s.amount_total || 0) - refundedMinor(s);
      orders += 1;
      revenue += net;
      if (s.currency) currency = s.currency;

      const handle = creatorOf(s.client_reference_id);
      if (!handle) { unattributed += 1; continue; }
      attributed += 1;

      const row = byCreator.get(handle) || { ref: handle, orders: 0, revenue: 0 };
      row.orders += 1;
      row.revenue += net;
      byCreator.set(handle, row);
    }
  } catch (err) {
    /* Server-side only. The client is told nothing about the key,
       the account, or what Stripe said. */
    console.error("Stripe read failed:", err.status || "", err.message);
    return empty("upstream");
  }

  const creators = [...byCreator.values()]
    .map((c) => ({ ...c, earned: Math.round(c.revenue * rate) }))
    .filter((c) => c.orders >= min)
    .sort((a, b) => b.earned - a.earned || a.ref.localeCompare(b.ref));

  res.setHeader("Cache-Control", CACHE);
  res.status(200).end(JSON.stringify({
    generated: new Date().toISOString(),
    currency, rate, creators,
    totals: { orders, attributed, unattributed, revenue },
    ready: true
  }));
}
