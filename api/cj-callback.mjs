/* ============================================================
   vates — POST /api/cj-callback

   The other direction: CJ telling us a parcel has shipped. It
   writes the tracking number onto the PaymentIntent, so the
   payment, the CJ order and the tracking number are all one row
   in the Stripe dashboard and nobody has to hold two tabs open to
   answer "where is my bottle".

   Register the URL under CJ → Settings → Callback (or ask an agent
   to set it), with the shared secret on the query string:

     https://<siteUrl>/api/cj-callback?key=<CJ_CALLBACK_SECRET>

   That secret is the whole of the authentication. CJ does not sign
   its callbacks the way Stripe does, so there is nothing to verify
   against — which is also why this endpoint is careful to be
   boring: it writes two metadata fields onto a PaymentIntent it
   found by order number, and does nothing else. A stranger who
   guessed the secret could mislabel a tracking number. They could
   not spend anything or read a customer's details.

   Environment
     STRIPE_SECRET_KEY     required, same key as the rest.
     CJ_CALLBACK_SECRET    required. Any long random string; it is
                           only ever compared against itself.

   One caveat, stated plainly: CJ's callback payload is not in the
   public API documentation, so the field names below are read
   permissively rather than exactly — orderNum, orderNumber and
   friends all land. The first real callback is worth reading in
   the function log to confirm which names CJ actually sends; if
   none of them match, this answers 200 and logs the whole payload
   rather than failing, so that first one is never lost.
   ============================================================ */

import crypto from "node:crypto";

const STRIPE_API = process.env.STRIPE_API_BASE || "https://api.stripe.com";
const STRIPE_VERSION = "2024-06-20";

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

/* Constant time, and length-safe: timingSafeEqual throws rather
   than returning false when the two differ in length, and the
   throw would itself be a signal. */
function sameSecret(given, expected) {
  const a = Buffer.from(String(given || ""), "utf8");
  const b = Buffer.from(String(expected), "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* The payload is read for the first value that looks like the
   thing being asked for, under any of the names it might carry.
   Nested one level, because CJ wraps some callbacks in a data
   object and sends others flat. */
function pick(payload, names) {
  const sources = [payload, payload?.data, payload?.result].filter(
    (s) => s && typeof s === "object"
  );
  for (const source of sources) {
    for (const name of names) {
      const value = source[name];
      if (typeof value === "string" && value.trim()) return value.trim();
      if (typeof value === "number") return String(value);
    }
  }
  return "";
}

async function readJson(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;

  let raw = req.body;
  if (raw === undefined || raw === null) {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk, "utf8") : chunk);
    }
    raw = Buffer.concat(chunks);
  }
  try { return JSON.parse(raw.toString("utf8")); } catch { return null; }
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  const done = (status, payload) => res.status(status).end(JSON.stringify(payload));

  if (req.method !== "POST") return done(405, { error: "method-not-allowed" });

  const secret = process.env.CJ_CALLBACK_SECRET || "";
  if (!secret || !process.env.STRIPE_SECRET_KEY) {
    console.error("CJ_CALLBACK_SECRET or STRIPE_SECRET_KEY is not set on this deployment.");
    return done(503, { error: "not-configured" });
  }

  /* The key may arrive on the query string or as a header,
     depending on what CJ's callback form allows. */
  const url = new URL(req.url || "/", "https://vates.invalid");
  const given = url.searchParams.get("key") || req.headers["x-callback-key"] || "";
  if (!sameSecret(given, secret)) {
    console.error("Rejected a CJ callback with a bad key.");
    return done(403, { error: "forbidden" });
  }

  const payload = await readJson(req);
  if (!payload) return done(400, { error: "bad-request" });

  /* createOrderV2 was given the Stripe session id as the order
     number, so it is the thread back to the payment. */
  const orderNumber = pick(payload, [
    "orderNumber", "orderNum", "orderNo", "order_number", "cjOrderNumber"
  ]);
  const tracking = pick(payload, [
    "trackNumber", "trackingNumber", "trackNo", "tracking_number", "logisticsNumber"
  ]);
  const carrier = pick(payload, [
    "logisticName", "carrierName", "logisticsName", "shippingMethod"
  ]);

  if (!orderNumber || !tracking) {
    /* 200 on purpose. A callback CJ cannot deliver is a callback CJ
       eventually stops sending, and the payload in the log is what
       makes the field names above correct on the next deploy. */
    console.error("CJ callback carried no order number or tracking number:", JSON.stringify(payload));
    return done(200, { ignored: "unrecognised-payload" });
  }

  if (!orderNumber.startsWith("cs_")) {
    /* Not one of ours: every order this project places is numbered
       with a Stripe Checkout Session id. */
    return done(200, { ignored: "not-a-vates-order" });
  }

  try {
    const session = await stripe("/v1/checkout/sessions/" + encodeURIComponent(orderNumber));
    const intentId = typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;

    if (!intentId) return done(200, { ignored: "no-payment-intent" });

    await stripe("/v1/payment_intents/" + encodeURIComponent(intentId), {
      method: "POST",
      form: {
        "metadata[tracking_number]": tracking,
        ...(carrier ? { "metadata[tracking_carrier]": carrier } : {}),
        "metadata[shipped_at]": new Date().toISOString()
      }
    });

    return done(200, { recorded: tracking });
  } catch (err) {
    /* 503 so CJ retries if it is going to. Nothing about the key or
       the account goes back in the response. */
    console.error("Could not record tracking for " + orderNumber + ":", err.status || "", err.message);
    return done(503, { error: "upstream" });
  }
}
