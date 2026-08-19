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

  /* The creator programme — everything creators.html needs.

     That page is what a direct message points at once someone says
     yes. It exists so a mailing address is typed into a form rather
     than into an Instagram thread, where it becomes a pile of personal
     data in an inbox with no record of who agreed to what. */
  creators: {
    /* Where the form posts. Any endpoint that accepts a plain
       application/json POST works — Formspree, Basin, Tally, a Vercel
       function, a Zap. There is no server in this repository, so this
       is the one piece that has to live somewhere else.

       Leave it empty and the form falls back to opening a pre-filled
       email to contactEmail below, exactly as an empty paymentLink
       falls back to the demonstration drawer: an unconfigured page
       must never swallow something a person typed. */
    formEndpoint: "",

    /* Where the fallback email goes, and the address of last resort
       for anyone who cannot use the form at all. */
    contactEmail: "hello@vates.store",

    /* What the commission actually is, as it should read on the page —
       "20%", "$10 a bottle", whatever the deal is. Left empty it shows
       an em dash, on the same rule as the unfilled specs: the page
       never invents a number that nobody has agreed to. */
    commission: ""
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
     and the conversion events cannot drift apart. */
  product: {
    id: "no-01",
    sku: "VATES-NO01",
    name: "No. 01",
    price: 49,
    currency: "USD"
  }
};
