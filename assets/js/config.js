/* ============================================================
   vates — deployment configuration

   This is the only file that needs editing to take the storefront
   live. Every value here is a public, client-side identifier; no
   secret belongs in this file, and none is needed.
   ============================================================ */

window.VATES = {

  /* The canonical origin, no trailing slash. Used for the canonical
     link, the sitemap, and the absolute OG image URL that Facebook,
     iMessage, Slack and the rest require. */
  siteUrl: "https://loom-one-lime.vercel.app",

  checkout: {
    /* A Stripe Payment Link — https://buy.stripe.com/…

       Leave it empty and Purchase falls back to the demonstration
       drawer, so an unconfigured checkout can never present a broken
       button. Paste the link and the button goes straight to Stripe:
       no cart, no account, no page of our own in between.

       In the Payment Link's own settings, four things matter:

         · Wallets — Apple Pay, Google Pay and Link switched on. This
           is the whole of the "twenty seconds" claim: a returning
           iPhone buyer pays with a double-click and never types.
         · Receipts — on. Stripe's own receipt email IS the order
           confirmation; there is no server here to send one.
         · After payment — redirect to
             <siteUrl>/thanks.html?session_id={CHECKOUT_SESSION_ID}
           That page is what fires the Purchase conversion for the ad
           platforms. Without the redirect the ads cannot be optimised.
         · Adjustable quantity — on. It replaces the stepper that used
           to sit next to the button. */
    paymentLink: "https://buy.stripe.com/test_aFafZh0529pS2Zg34b5Rm00"
  },

  /* Paid-ad and creator tracking. Each is optional: an empty string
     means that platform's script is never fetched at all, so unused
     pixels cost nothing. */
  pixels: {
    meta:   "",   /* Meta (Facebook / Instagram) pixel ID — digits only  */
    tiktok: "",   /* TikTok pixel ID                                     */
    ga4:    ""    /* GA4 measurement ID — G-XXXXXXXXXX                   */
  },

  /* One description of the product, so the page, the structured data
     and the conversion events cannot drift apart. track.js reads
     product.price for every conversion it reports to the ad platforms —
     it is not just copy, changing it here is the whole of the change. */
  product: {
    id: "no-01",
    sku: "VATES-NO01",
    name: "No. 01",
    price: 89,
    currency: "USD",

    /* The edition line under the price. Leave number unset and the page
       reads "An edition of 500 — numbered by hand" — true as long as the
       run is actually capped at `total`. Set number once real inventory
       exists (Stripe is the source of truth) and it upgrades on its own
       to "No. 041 of 500". Never set this from anything that counts up
       by itself — a live-ticking figure is fabricated scarcity, and both
       the FTC and the CMA treat it as a deceptive practice. */
    edition: {
      total: 500,
      number: null
    }
  }
};
