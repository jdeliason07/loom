/* ============================================================
   vates — POST /api/fulfill

   The Stripe webhook that hands a paid order to CJdropshipping.
   A Vercel serverless function, like the leaderboard: it runs on
   Vercel's machines, which is the only reason it may hold either
   key.

   The chain is:
     1. Stripe takes the money and fires checkout.session.completed
     2. This verifies the signature, then re-reads the session for
        its line items and shipping address
     3. Each line item is mapped to a CJ variant and sent to
        createOrderV2
     4. CJ's order id is written back onto the PaymentIntent, where
        it is visible in the Stripe dashboard beside the payment

   Step 4 is not bookkeeping — it is the idempotency record. Stripe
   redelivers a webhook on any non-2xx and several times besides,
   and nothing here may ship a second bottle for one payment. There
   is no database in this project, so Stripe itself is the store:
   a PaymentIntent that already carries cj_order_id is done.

   Failure is deliberately loud and retryable. Anything that might
   succeed later — CJ down, a variant not yet mapped, a token that
   would not mint — answers 503, and Stripe keeps redelivering for
   about three days. That window is long enough to notice an unset
   environment variable and fix it without losing the order.

   Environment
     STRIPE_SECRET_KEY      required. Needs write access to
                            PaymentIntents (for the metadata) as
                            well as read on Checkout Sessions.
     STRIPE_WEBHOOK_SECRET  required. whsec_… from the endpoint's
                            own page in the Stripe dashboard.
     CJ_API_KEY             required. CJ → Authorization → API Key.
     CJ_VARIANTS            required. JSON, Stripe price id → CJ
                            variant id (vid). See variantFor below.
     CJ_FROM_COUNTRY        warehouse to ship from, default US
     CJ_LOGISTIC            shipping method by name. Unset means ask
                            CJ for the cheapest one per order.
     CJ_PAY_TYPE            2 = pay from CJ balance (default, and
                            what makes this automatic). 3 = create
                            the order but leave it unpaid, to be
                            settled by hand in CJ. Start at 3.
     CJ_FALLBACK_PHONE      some carriers reject an order with no
                            phone number. Used only when Stripe did
                            not collect one.
   ============================================================ */

import crypto from "node:crypto";

const STRIPE_API = process.env.STRIPE_API_BASE || "https://api.stripe.com";
const CJ_API = process.env.CJ_API_BASE || "https://developers.cjdropshipping.com/api2.0/v1";

/* Pinned to match api/leaderboard.mjs. It matters here: on this
   version the buyer's address is session.shipping_details, and on
   later ones it moved under collected_information. addressOf reads
   both, but the pin is what makes the first one the truth. */
const STRIPE_VERSION = "2024-06-20";

/* How far out of step a webhook's timestamp may be before it is
   refused. Five minutes is Stripe's own recommendation: long enough
   for clock drift, short enough that a captured request cannot be
   replayed at leisure. */
const TOLERANCE_S = 300;

/* ── the raw body ────────────────────────────────────────────

   The signature is over the exact bytes Stripe sent, so the body
   must not be parsed before it is checked. Vercel parses JSON by
   default; the config export below turns that off. The req.body
   fallback is for the case where something upstream buffered it
   anyway — an already-parsed object cannot be re-serialised back
   into the same bytes, so that case is a hard failure, not a
   silent re-encode. */
export const config = { api: { bodyParser: false } };

async function rawBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") return Buffer.from(req.body, "utf8");
  if (req.body !== undefined && req.body !== null) return null;

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk, "utf8") : chunk);
  }
  return Buffer.concat(chunks);
}

/* ── the signature ───────────────────────────────────────────

   stripe-signature is  t=1755512345,v1=<hex>,v1=<hex>
   and the signed payload is the timestamp, a dot, and the body.
   More than one v1 appears while a secret is being rotated, so
   every one of them is a candidate. */
function verify(body, header, secret) {
  const parts = String(header || "").split(",");
  let timestamp = "";
  const signatures = [];
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    if (k === "t") timestamp = v;
    else if (k === "v1") signatures.push(v);
  }
  if (!timestamp || !signatures.length) return false;

  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > TOLERANCE_S) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(Buffer.concat([Buffer.from(timestamp + ".", "utf8"), body]))
    .digest();

  return signatures.some((sig) => {
    let given;
    try { given = Buffer.from(sig, "hex"); } catch { return false; }
    /* timingSafeEqual throws on a length mismatch rather than
       returning false, which would itself leak the length. */
    return given.length === expected.length && crypto.timingSafeEqual(given, expected);
  });
}

/* ── Stripe ──────────────────────────────────────────────────

   Same shape as leaderboard.mjs: fetch against the REST API, no
   SDK, no dependency. Errors carry the status so the caller can
   tell "retry this" from "this will never work", and the message
   is for the log only — it can name the key or the account. */
async function stripe(path, { method = "GET", query, form } = {}) {
  const key = process.env.STRIPE_SECRET_KEY || "";
  const url = new URL(STRIPE_API + path);
  for (const [k, v] of Object.entries(query || {})) {
    if (Array.isArray(v)) v.forEach((item) => url.searchParams.append(k, item));
    else if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }

  const init = {
    method,
    headers: { Authorization: "Bearer " + key, "Stripe-Version": STRIPE_VERSION }
  };
  if (form) {
    init.headers["Content-Type"] = "application/x-www-form-urlencoded";
    init.body = new URLSearchParams(form).toString();
  }

  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body?.error?.message || res.statusText);
    err.status = res.status;
    throw err;
  }
  return body;
}

/* ── CJ ──────────────────────────────────────────────────────

   CJ answers 200 with {result:false, message:"…"} for business
   failures, so the HTTP status alone is not the test. Both shapes
   are normalised into one thrown Error. */
async function cj(path, { method = "POST", body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["CJ-Access-Token"] = token;

  const res = await fetch(CJ_API + path, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const json = await res.json().catch(() => ({}));

  if (!res.ok || json?.result === false || json?.code >= 300) {
    const err = new Error(json?.message || res.statusText || "CJ request failed");
    err.status = res.status;
    err.cjCode = json?.code;
    throw err;
  }
  return json?.data ?? json;
}

/* An access token lasts fifteen days and the endpoint that mints
   one is rate limited to a call a second, so a token is worth
   holding on to. Module scope survives for as long as Vercel keeps
   the instance warm — which is most of the time at any real order
   rate, and simply costs one extra call when it does not. The
   refresh token is used in preference to the API key so that a
   cold start does not re-authenticate from scratch.

   Sixty seconds of headroom on the expiry: a token that dies
   between this check and the order call would cost the retry. */
let cached = { access: "", accessUntil: 0, refresh: "", refreshUntil: 0 };

function parseExpiry(value) {
  /* CJ returns "2026-08-19T18:28:00" and friends. An unreadable
     date is treated as already expired rather than as forever. */
  const t = Date.parse(String(value || "").replace(" ", "T"));
  return Number.isFinite(t) ? t : 0;
}

function remember(data) {
  cached = {
    access: data?.accessToken || "",
    accessUntil: parseExpiry(data?.accessTokenExpiryDate),
    refresh: data?.refreshToken || "",
    refreshUntil: parseExpiry(data?.refreshTokenExpiryDate)
  };
  return cached.access;
}

async function accessToken() {
  const now = Date.now();
  if (process.env.CJ_ACCESS_TOKEN) return process.env.CJ_ACCESS_TOKEN;
  if (cached.access && cached.accessUntil > now + 60_000) return cached.access;

  if (cached.refresh && cached.refreshUntil > now + 60_000) {
    try {
      return remember(await cj("/authentication/refreshAccessToken", {
        body: { refreshToken: cached.refresh }
      }));
    } catch (err) {
      /* A refused refresh is not fatal — the API key still works.
         Logged because a refresh that stops working every time is
         worth seeing. */
      console.error("CJ token refresh failed, falling back to the API key:", err.message);
    }
  }

  const apiKey = process.env.CJ_API_KEY || "";
  if (!apiKey) throw Object.assign(new Error("CJ_API_KEY is not set"), { retryable: true });
  return remember(await cj("/authentication/getAccessToken", { body: { apiKey } }));
}

/* ── the order ───────────────────────────────────────────────

   CJ_VARIANTS maps what Stripe sold to what CJ ships:

     {"price_1PxyzAbc":"92511400-C758-4474-93CA-66D442F5F787",
      "default":"92511400-C758-4474-93CA-66D442F5F787"}

   The price id is the key to prefer — it is stable, and it is what
   distinguishes two variants of one product. The product id and
   "default" are there so that a single-product storefront can be
   configured with one line and a new Payment Link does not silently
   stop shipping. */
function variantMap() {
  try {
    const parsed = JSON.parse(process.env.CJ_VARIANTS || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    console.error("CJ_VARIANTS is not valid JSON; no line item can be mapped.");
    return {};
  }
}

function variantFor(item, map) {
  const price = item?.price || {};
  const product = typeof price.product === "string" ? price.product : price.product?.id;
  return map[price.id] || (product && map[product]) || map.default || "";
}

/* Stripe gives a two-letter country code and CJ wants both the code
   and the name. Intl does that conversion in the platform, which is
   better than a hand-kept list of two hundred countries going stale
   in this file. */
const COUNTRY_NAMES = new Intl.DisplayNames(["en"], { type: "region" });

function countryName(code) {
  try { return COUNTRY_NAMES.of(code) || code; } catch { return code; }
}

function addressOf(session) {
  /* shipping_details on the pinned API version; collected_information
     on later ones. Reading both means a version bump in the Stripe
     dashboard cannot quietly start shipping to nowhere. */
  const shipping = session.shipping_details
    || session.collected_information?.shipping_details
    || {};
  const a = shipping.address || {};
  if (!a.line1 || !a.country) return null;

  return {
    name: shipping.name || session.customer_details?.name || "",
    phone: shipping.phone || session.customer_details?.phone || process.env.CJ_FALLBACK_PHONE || "",
    line1: a.line1,
    line2: a.line2 || "",
    city: a.city || "",
    state: a.state || "",
    zip: a.postal_code || "",
    country: a.country
  };
}

/* With no CJ_LOGISTIC set, ask CJ what it would charge to send this
   variant to this address and take the cheapest answer. It is one
   extra call per order and it is worth it: logisticName is required
   and a name that is not offered for that route fails the order
   outright, so a hardcoded default is a standing bet that every
   destination supports it. */
async function cheapestLogistic({ vid, quantity, address, from, token }) {
  const quotes = await cj("/logistic/freightCalculate", {
    token,
    body: {
      startCountryCode: from,
      endCountryCode: address.country,
      zip: address.zip,
      quantity,
      vid
    }
  });
  const list = Array.isArray(quotes) ? quotes : [];
  const best = list
    .filter((q) => q?.logisticName)
    .sort((a, b) => Number(a.logisticPrice ?? Infinity) - Number(b.logisticPrice ?? Infinity))[0];
  return best?.logisticName || "";
}

/* CJ rejects a repeated orderNumber, which is the second line of
   defence behind the PaymentIntent metadata: if two deliveries of
   one webhook race each other, the loser is told the order exists
   and treats that as the success it is. */
function isDuplicate(err) {
  return /exist|duplicat|repeat/i.test(err?.message || "");
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  const done = (status, payload) => res.status(status).end(JSON.stringify(payload));

  if (req.method !== "POST") return done(405, { error: "method-not-allowed" });

  const secret = process.env.STRIPE_WEBHOOK_SECRET || "";
  if (!secret || !process.env.STRIPE_SECRET_KEY) {
    console.error("STRIPE_WEBHOOK_SECRET or STRIPE_SECRET_KEY is not set on this deployment.");
    return done(503, { error: "not-configured" });
  }

  const body = await rawBody(req);
  if (!body) {
    console.error("The request body was parsed before it could be verified.");
    return done(400, { error: "bad-request" });
  }
  if (!verify(body, req.headers["stripe-signature"], secret)) {
    /* No detail, deliberately. An unsigned caller learns only that
       it was refused — not the tolerance, not which part failed. */
    console.error("Rejected a webhook with a bad or stale signature.");
    return done(400, { error: "bad-signature" });
  }

  let event;
  try { event = JSON.parse(body.toString("utf8")); } catch { event = null; }
  if (!event?.type) return done(400, { error: "bad-request" });

  /* Everything else Stripe may be configured to send is accepted and
     ignored: an endpoint that 400s on an event it did not ask for
     shows up in the dashboard as a broken one. */
  const HANDLED = ["checkout.session.completed", "checkout.session.async_payment_succeeded"];
  if (!HANDLED.includes(event.type)) return done(200, { ignored: event.type });

  const sessionId = event.data?.object?.id;
  if (!sessionId) return done(200, { ignored: "no-session" });

  try {
    /* Re-read rather than trust the payload. The webhook body has no
       line items at all, and it is a snapshot of the moment the event
       was queued, which may be minutes old by the time of a retry. */
    const session = await stripe("/v1/checkout/sessions/" + encodeURIComponent(sessionId), {
      query: { "expand[]": ["line_items", "payment_intent"] }
    });

    if (session.payment_status !== "paid") {
      /* A completed session is not a paid one. The asynchronous
         methods complete first and settle later, and the settlement
         fires its own event, which is why that one is handled too. */
      return done(200, { skipped: "unpaid" });
    }

    const intent = session.payment_intent;
    const intentId = typeof intent === "string" ? intent : intent?.id;

    if (intent?.metadata?.cj_order_id) {
      return done(200, { skipped: "already-fulfilled", order: intent.metadata.cj_order_id });
    }

    const address = addressOf(session);
    if (!address) {
      /* Nothing to be done by retrying: the address was never
         collected. Answering 200 stops Stripe redelivering for three
         days over something only the Payment Link's own settings can
         fix, and the log line says which setting. */
      console.error(
        "No shipping address on " + sessionId +
        " — switch on 'Collect shipping address' in the Payment Link's settings."
      );
      return done(200, { skipped: "no-address" });
    }

    const map = variantMap();
    const items = (session.line_items?.data || [])
      .map((item) => ({ vid: variantFor(item, map), quantity: item.quantity || 1 }))
      .filter((item) => item.quantity > 0);

    if (!items.length || items.some((item) => !item.vid)) {
      /* Retryable on purpose. This is what an unmapped price looks
         like, and it is fixed by editing CJ_VARIANTS — which the
         next redelivery will pick up, so the order is not lost. */
      console.error("No CJ variant is mapped for a line item on " + sessionId + ".");
      return done(503, { error: "unmapped-variant" });
    }

    const token = await accessToken();
    const from = process.env.CJ_FROM_COUNTRY || "US";

    let logistic = process.env.CJ_LOGISTIC || "";
    if (!logistic) {
      logistic = await cheapestLogistic({
        vid: items[0].vid,
        quantity: items.reduce((n, item) => n + item.quantity, 0),
        address, from, token
      });
    }
    if (!logistic) {
      console.error("CJ offered no shipping method to " + address.country + " for " + sessionId + ".");
      return done(503, { error: "no-logistic" });
    }

    let order;
    try {
      order = await cj("/shopping/order/createOrderV2", {
        token,
        body: {
          orderNumber: session.id,
          fromCountryCode: from,
          logisticName: logistic,
          payType: Number(process.env.CJ_PAY_TYPE ?? 2),
          shippingCustomerName: address.name,
          shippingPhone: address.phone,
          shippingCountryCode: address.country,
          shippingCountry: countryName(address.country),
          shippingProvince: address.state,
          shippingCity: address.city,
          shippingAddress: address.line1,
          shippingAddress2: address.line2,
          shippingZip: address.zip,
          products: items.map((item) => ({ vid: item.vid, quantity: item.quantity }))
        }
      });
    } catch (err) {
      if (!isDuplicate(err)) throw err;
      /* Already placed by a delivery that got here first. Nothing to
         write back — that one will write it. */
      console.error("CJ already holds an order for " + sessionId + "; treating as fulfilled.");
      return done(200, { skipped: "already-placed" });
    }

    const orderId = order?.orderId || order?.orderNumber || "";

    /* The idempotency record, written last: a PaymentIntent marked
       fulfilled before CJ confirmed would be a lie that stops every
       retry. Written on a best effort — if this fails the order is
       still placed, and CJ's duplicate check catches the redelivery.
       Both ids are kept: one to search CJ by, one to prove which
       payment it belongs to. */
    if (intentId && orderId) {
      try {
        await stripe("/v1/payment_intents/" + encodeURIComponent(intentId), {
          method: "POST",
          form: {
            "metadata[cj_order_id]": String(orderId),
            "metadata[cj_order_number]": String(order?.orderNumber || session.id)
          }
        });
      } catch (err) {
        console.error("CJ order " + orderId + " placed, but Stripe metadata did not save:", err.message);
      }
    }

    return done(200, { fulfilled: orderId });
  } catch (err) {
    /* Server-side only, and 503 rather than 500: this is the answer
       that asks Stripe to come back, which is what turns a bad
       minute at CJ into a late order instead of a lost one. */
    console.error("Fulfilment failed for " + sessionId + ":", err.status || "", err.message);
    return done(503, { error: "upstream" });
  }
}
