#!/usr/bin/env node
/* ============================================================
   vates — build the creator leaderboard

   Reads completed Stripe Checkout Sessions, groups them by the
   ref_ tag that track.js wrote into client_reference_id, and
   writes assets/data/leaderboard.json for leaderboard.html.

   Run it here, never in the browser:

     STRIPE_SECRET_KEY=sk_live_… node tools/leaderboard.mjs

   The key is read from the environment and is never written to
   the output, the repository, or anywhere else. The site itself
   only ever sees the JSON this produces, which contains no
   customer data — a handle, an order count and two totals.

   Options
     --rate=20        commission percentage        (default 20)
     --since=2026-01-01   only sessions on or after this date
     --min=1          hide creators below this many orders
     --out=PATH       output file
     --dry            print the table, write nothing
   ============================================================ */

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const API = process.env.STRIPE_API_BASE || "https://api.stripe.com";
const KEY = process.env.STRIPE_SECRET_KEY || "";

/* ── arguments ───────────────────────────────────────────── */

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    return m ? [m[1], m[2] ?? true] : [a, true];
  })
);

const RATE = Number(args.rate ?? 20) / 100;
const MIN_ORDERS = Number(args.min ?? 1);
const OUT = resolve(String(args.out ?? "assets/data/leaderboard.json"));
const SINCE = args.since ? Math.floor(new Date(String(args.since)).getTime() / 1000) : null;

if (!KEY) {
  console.error(
    "No STRIPE_SECRET_KEY in the environment.\n\n" +
    "  STRIPE_SECRET_KEY=sk_live_… node tools/leaderboard.mjs\n\n" +
    "Use a restricted key with read access to Checkout Sessions and\n" +
    "nothing else — this script only ever reads."
  );
  process.exit(1);
}
if (Number.isNaN(RATE) || RATE < 0 || RATE > 1) {
  console.error("--rate must be a percentage between 0 and 100.");
  process.exit(1);
}
if (args.since && SINCE === null) { console.error("--since is not a date I can read."); process.exit(1); }

/* ── Stripe ──────────────────────────────────────────────── */

async function stripe(path, params) {
  const url = new URL(API + path);
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) v.forEach((item) => url.searchParams.append(k, item));
    else if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, {
    headers: { Authorization: "Bearer " + KEY, "Stripe-Version": "2024-06-20" }
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error?.message || res.statusText;
    throw new Error(`Stripe ${res.status}: ${msg}`);
  }
  return body;
}

/* Checkout Sessions, not Charges: client_reference_id lives on the
   session and is not copied onto the PaymentIntent or the Charge, so
   the payments list is the wrong end to read this from. The charge is
   expanded anyway, for amount_refunded — a refunded order must not
   earn anyone a commission. */
async function* sessions() {
  let after;
  for (;;) {
    const page = await stripe("/v1/checkout/sessions", {
      limit: 100,
      status: "complete",
      ...(after ? { starting_after: after } : {}),
      ...(SINCE ? { "created[gte]": SINCE } : {}),
      "expand[]": ["data.payment_intent.latest_charge"]
    });
    const rows = page.data || [];
    for (const row of rows) yield row;
    if (!page.has_more || !rows.length) return;
    after = rows[rows.length - 1].id;
  }
}

/* ── the token ───────────────────────────────────────────── */

/* track.js writes  src_x__med_y__cmp_z__ref_janedoe__t_1755512345
   and the only part a creator leaderboard cares about is ref_. */
function creatorOf(reference) {
  if (!reference) return null;
  for (const part of String(reference).split("__")) {
    if (part.startsWith("ref_")) {
      const handle = part.slice(4).trim();
      if (handle) return handle;
    }
  }
  return null;
}

function refundedMinor(session) {
  const charge = session.payment_intent?.latest_charge;
  return typeof charge?.amount_refunded === "number" ? charge.amount_refunded : 0;
}

/* ── walk ────────────────────────────────────────────────── */

const byCreator = new Map();
let currency = "usd";
let orders = 0, attributed = 0, unattributed = 0, grossMinor = 0;

try {
  for await (const s of sessions()) {
    /* A complete session is not necessarily a paid one — an async
       payment method can complete the session and fail afterwards. */
    if (s.payment_status !== "paid") continue;

    const net = (s.amount_total || 0) - refundedMinor(s);
    orders += 1;
    grossMinor += net;
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
  console.error("\nCould not read Stripe: " + err.message);
  if (/401|invalid api key/i.test(err.message)) {
    console.error("That key was rejected. A restricted key needs read access to Checkout Sessions.");
  }
  process.exit(1);
}

const creators = [...byCreator.values()]
  .map((c) => ({ ...c, earned: Math.round(c.revenue * RATE) }))
  .filter((c) => c.orders >= MIN_ORDERS)
  .sort((a, b) => b.earned - a.earned || a.ref.localeCompare(b.ref));

const payload = {
  generated: new Date().toISOString(),
  currency,
  rate: RATE,
  creators,
  totals: { orders, attributed, unattributed, revenue: grossMinor }
};

/* ── report ──────────────────────────────────────────────── */

const money = (minor) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() })
    .format(minor / 100);

if (!creators.length) {
  console.log("\nNo attributed sales yet — nobody has sold anything through a ?ref= link.");
} else {
  const w = Math.max(6, ...creators.map((c) => c.ref.length));
  console.log("\n" + "creator".padEnd(w) + "  orders      sold     earned");
  console.log("-".repeat(w + 30));
  for (const c of creators) {
    console.log(
      c.ref.padEnd(w) +
      String(c.orders).padStart(8) +
      money(c.revenue).padStart(10) +
      money(c.earned).padStart(11)
    );
  }
}
console.log(
  `\n${orders} paid orders, ${attributed} attributed, ${unattributed} not. ` +
  `Commission at ${(RATE * 100).toFixed(0)}%.`
);

if (args.dry) { console.log("\n--dry: nothing written."); process.exit(0); }

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(payload, null, 2) + "\n");
console.log(`\nWrote ${OUT}`);
