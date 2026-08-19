# VATES

Single-product storefront for **No. 01** — a one-piece borosilicate glass bottle, $89.

Static site: plain HTML, CSS and JS. No framework, no build step, no dependencies.

## Run it

Open `index.html` directly, or serve the folder:

```sh
python3 -m http.server 8000   # → http://localhost:8000
```

## Layout

```
index.html                     the storefront
thanks.html                    order confirmation — fires the Purchase event
leaderboard.html               what each creator has earned, ranked
shipping.html privacy.html terms.html    the three Stripe asks for
404.html  robots.txt  sitemap.xml  site.webmanifest  favicon.ico
assets/js/config.js            THE ONLY FILE TO EDIT TO GO LIVE
assets/js/track.js             attribution and the ad pixels
assets/fonts/inter-*.woff2     Inter, self-hosted, three weights
assets/fonts/fraunces-*.woff2  Fraunces, self-hosted — the manifesto voice, one variable file
assets/img/og.jpg              the 1200x630 share card
assets/brand/loom-colors.css   the brand color system — imported first, unmodified
assets/css/styles.css          storefront styles
assets/js/app.js               the iris, order drawer, cart state, film-to-reel handover
assets/js/leaderboard.js       draws the leaderboard from /api/leaderboard
api/leaderboard.mjs            that endpoint — the one server-side file, holds the Stripe key
assets/brand/vates-*.svg       the wordmark, and the "v" cropped square for the favicon
assets/img/reel/01–32.webp     the archive reel of creators, in Who we are
assets/video/intro.mp4/.webm   the film, framed in Who we are — plays on a tap
assets/img/hero-poster.jpg     its poster frame
assets/img/no-01.webp/.jpg     the No. 01 photograph — the pair, on a desk in use
```

## Deployment

Hosting is **Vercel, already configured**, so this repo intentionally contains
**no** deployment configuration: no GitHub Actions workflow, no `vercel.json`,
no Pages settings. The single server-side file is `api/leaderboard.mjs`, which
Vercel picks up automatically because it is in `/api`; it needs environment
variables set in the dashboard, but no configuration in the repository and no
build step. The site is served straight from the repository root — there
is nothing to build and no output directory to point at. If Vercel's project
settings ask for a framework preset, it's "Other"; leave the build command
empty and the output directory as the root.

## Page order

1. **The opening** — the wordmark at masthead scale over the iris (below), a
   ticker chanting the definition — visionaries, seers, revelators — and the
   tagline and promise at the bottom of the same screen.
2. **Who we are** — the manifesto, centred, with the film framed under it.
   When the film ends, the archive reel of creators takes over its frame.
3. **The bottle** — photograph, claim, price, Purchase, and the edition line
   (below).
4. **In hand** — the specs. Height and weight are dashes until the spec sheet
   fills them.
5. **The closing ask** — a last full-width Purchase, then the waitlist for
   anyone not ready yet.
6. **Footer.**

There is no Trusted-by section. It shipped once, with placeholder creators,
and came out again: a proof section with no real proof shouldn't be on the
page. It belongs back only once real creators have agreed to be on it.

`leaderboard.html` sits outside that order, as a plain page.

The page scrolls normally. The scroll-snap paging and the wheel driver that
earlier versions carried are gone with the full-screen reel they served; the
one piece of scroll choreography left is the cue at the foot of the opening.

## The opening

The iris — the seer's eye — is drawn on a `<canvas>` by `app.js`: sixteen rings
in the wordmark's six band colours breathing out of step around a dark pupil,
with fine spokes wheeling slowly. It runs only while the hero is on screen and
the tab is visible, and under `prefers-reduced-motion` it draws one still frame
and stops. The ticker is pure CSS; its squares are the six bands.

Two voices share the page: Fraunces (self-hosted, one latin variable file)
speaks the statement lines — the tagline, the manifesto headline — and the
grotesque keeps the product and the UI. The wordmark remains artwork and is
never re-set in type.

## The film and the reel

The film is back, framed inside **Who we are** rather than in front of the
site: it plays on a tap, with its poster showing until then. The moment it
ends, the archive reel — the same 32 stills, `assets/img/reel/01–32.webp` —
takes over the film's own frame and loops, cutting every 2.6 seconds. Replaying
the film puts it back on top; the reel returns at the next `ended`. The reel is
two `<img>` slots taking turns, the next picture decoded before it is faded up,
and it holds its picture when the tab is hidden or the section is off screen.

## The quotes

Thirteen of the reel's pictures carry something the person in them said,
shown under the frame in Who we are as each picture comes round. The
quotes are declared in `index.html`, in the `#reel-captions` JSON block, for the
same reason the pictures are named there: changing a quote, or moving one from
one frame to another, is an edit to the markup and not to `app.js`. The key is
the frame's two-digit number, so it is the filename — `08` is
`assets/img/reel/08.webp`.

Every entry carries a `src`: the primary source the quote is taken from — a
letter, a transcript, a dated address. Nothing reads that field. It is there so
that adding a quote means finding its source first, which is the whole of what
keeps the list honest.

It started at thirty and lost seventeen to that rule. "E pur si muove" was not
written down until 124 years after Galileo's trial. "We are what we repeatedly
do" is Will Durant summarising Aristotle, not Aristotle. "God must have loved
the common man" is Lincoln's, not Nimitz's. Five lines put into the mouths of
the men on Suribachi are not recorded as having been said by any of them. A
quote that cannot be sourced does not go under a real person's face.

The value is a *list*, because a frame can hold more than one person: The School
of Athens is Plato and Aristotle, Iwo Jima is six men. A frame with a list takes
the next entry each time it comes round, rather than picking one and dropping
the rest — no frame needs it at present, but the reel is a set of group
photographs and the next sourced quote may well land on one. Nineteen frames
have no entry and show none; the wash goes with them, so there is no shadow
across the bottom of a picture with nothing to read on it.

The quote and the picture turn together — `say()` is called from the same
`then()` that swaps the slots, so a line is never left under the wrong face. The
two caption slots hand over differently from the pictures: a picture covers the
one it replaces and text does not, so the outgoing line is cleared first (200ms)
and the incoming one held back until it has gone (460ms after a 200ms delay).
Both fit inside the 1500ms a picture holds.

The reel's backdrop is `aria-hidden`, and the quotes are inside it. That is
deliberate: a line replaced every second and a half is decoration, and
announcing each one would make the page unusable with a screen reader.

## Replacing the imagery

**Reel** — drop numbered files at `assets/img/reel/01.webp` … `32.webp`. The
count and the path are declared in `index.html` on `#reel` (`data-frame-count`
and `data-frame-src`, where `{n}` stands in for the two-digit number), so
changing how many pictures the reel holds is a one-attribute edit, not a code
change. Add the new frame's quote to `#reel-captions` under the same number, or
leave it out and the frame runs without one. `FRAME_MS` in `app.js` is how long
each one holds — 1500ms, or 4s under `prefers-reduced-motion`, where the cuts
would otherwise be the motion — and `--reel-fade` on `.reel` is the dissolve
between them, which wants to stay well inside `FRAME_MS`.

Frame `01` is preloaded by name in the head; renumbering the reel means
changing that line too.

**Product photo** — `no-01.webp` with a `no-01.jpg` fallback, served full-bleed
from `.product__stage`; the photograph's own ground becomes a plate against the
dark page. To replace it, swap both files, update the `width`/`height`
attributes on the `<img>` in `index.html` to the new pixel dimensions, and check
`PRODUCT.image` in `assets/js/app.js`, which the drawer thumbnail uses. The
stage is width-driven — the photo fills it and sets its own height — so any
aspect ratio fits without markup changes; a much taller frame may want a smaller
cap than the 560px on `.product__stage` and its grid track.

## Brand rules encoded here

- `loom-colors.css` is imported globally, once, ahead of `styles.css`, and is
  kept verbatim. Components reference only the semantic aliases
  (`--color-bg`, `--color-text-primary`, …), never the raw `--loom-*` names.
- The page ground is this site's own, not the brand's: `styles.css` re-points
  `--color-bg` to #2e251b, a dark brown, under `[data-theme="dark"]`. The Void
  is still the Void — the brand file is untouched — this page just does not sit
  on it. The `theme-color` meta in `index.html` tracks the same value.

  Only `--color-bg` moved. `--color-bg-elevated` is still Graphite, which is a
  cool grey against a warm ground; it shows on the drawer, the notice and the
  line-item thumbs. It reads as a neutral dark panel rather than a clash, but
  a warmer elevated tone is the obvious next move if it starts to look wrong.
- The wordmark is artwork, not type: `assets/brand/vates-wordmark.svg`, a
  traced outline filled with the six colour bands the logo is built from
  (#76b856, #f2ba4b, #e3873d, #cf4743, #8b4192, #4698d3). It is always
  lowercase, never tracked, stretched or italicized, and never recoloured.
- The primary CTA carries those same six colours, one sixth of the button
  each — the wordmark's own bands are uneven (green is 38% of it), which reads
  as a mistake at button size. It is the only place the bands appear outside
  the wordmark itself, and it is the palette being reused, not the artwork.
  `--color-accent` is no longer on the button; it is left for focus and links.

  The label is true black rather than `--color-bg`, and red is the band that
  decides it. Equal bands put the type mid-ramp, across orange and red, where
  the page ground is 3.97:1 — under the bar — and black is 4.64:1. Measured on
  the rendered button rather than calculated: worst contrast under any row of
  the glyphs is 4.64:1 against a 4.5:1 requirement, so the margin is thin.
  Changing the padding, the type size or the band order moves the label onto
  different bands; re-measure if you do.
- One family for all type, `--font`: Helvetica where it is installed, Inter
  served as the fallback everywhere else, then Arial. The only tracked
  treatment left is `.label`, uppercase at 0.18em.
- Corner radii come from `--radius-sm/md/lg` in `styles.css`; nothing is
  square.

Dark is the shipped theme, and `<html>` carries `data-theme="dark"` outright.
`loom-colors.css` carries a `[data-theme="light"]` block, but no toggle is wired
up: the wordmark's gradient is tuned for a dark ground and loses contrast on
light. The ground override is scoped to `[data-theme="dark"]` so that block is
left intact if a toggle is ever added. If a toggle is added later, the
primary button's ink (`color: var(--color-bg)`) needs an explicit dark override,
since the bands are the same in both themes.

## Going live

Everything below is set in `assets/js/config.js`. There is no build step and no
secret anywhere in this repository — every identifier involved is public by
design.

**1. The domain.** Set `siteUrl`, then change the same origin in the three
places that cannot read it from JavaScript, because crawlers do not run any:
the `canonical`/`og:*` tags at the top of every page, `sitemap.xml`, and
`robots.txt`. It is `https://vates.store` throughout at the moment.

**2. Stripe.** Create a Payment Link for No. 01 and paste it into
`checkout.paymentLink`. In the link's own settings:

| Setting | Value | Why |
|---|---|---|
| Wallets — Apple Pay, Google Pay, Link | on | This is the whole of the twenty seconds. A returning iPhone buyer double-clicks and never types. |
| Receipts | on | Stripe's receipt **is** the order confirmation. There is no server here to send one. |
| After payment → redirect | `<siteUrl>/thanks.html?session_id={CHECKOUT_SESSION_ID}` | Without it no Purchase conversion is ever reported and the ad platforms have nothing to optimise towards. |
| Adjustable quantity | on | It replaces the stepper that used to sit beside the button. |

Until a link is pasted, Purchase falls back to the demonstration drawer, so an
unconfigured checkout can never present a dead button.

**3. Pixels.** Fill in whichever of `pixels.meta`, `pixels.tiktok` and
`pixels.ga4` you are using. An empty string means that platform's script is
never fetched, so unused pixels cost nothing at all.

**4. The edition line.** `product.edition.total` is 500 and `number` is
`null`, so the bottle section reads "An edition of 500 — numbered by hand" —
true as long as the run really is capped there. Once real inventory exists
(Stripe is the source of truth), set `number` and the line upgrades itself to
"No. 041 of 500" with no other change. Never set it from anything that counts
up on its own: a figure nobody put there on purpose is fabricated scarcity,
and both the FTC and the CMA treat a live-ticking claim of demand as a
deceptive practice, not a growth hack.

**5. The waitlist.** The form at the foot of the page has nowhere to send an
address yet — `app.js` shows "The waitlist isn't connected yet" and stops
there. Point its `submit` handler at a real endpoint (a form service such as
Formspree or Buttondown, or a small serverless function) before this ships,
and once it collects an email address, say so on the privacy page.

## The checkout

Two taps: Purchase opens the drawer, the drawer's Checkout leaves for Stripe.
The step in between is not friction for its own sake — it is where "What's in
the box" gets read, which is the last thing anyone wants to know before paying.
From Stripe the buyer lands back on `thanks.html` and is done.

Four events are reported: `view` on load (what the retargeting audiences are
built from), `add` when the drawer opens, `checkout` when the Purchase leaves
for Stripe, and `purchase` on `thanks.html`. Each platform names them
differently; the mapping is one table in `track.js` and callers say "view",
"add", "checkout", "purchase".

`thanks.html` reports the list price of one bottle. There is no server here to
ask Stripe what was actually charged, so a two-bottle order is still reported as
$89 — under-reporting, which is the safe direction, and the true figures are in
Stripe. A webhook into the Conversions API is the fix when the ad spend
justifies it.

## The leaderboard

`leaderboard.html` shows what each creator has earned, ranked, and updates
itself. The line under it points people at the Instagram and TikTok accounts
to ask about joining.

The page fetches `/api/leaderboard` and draws whatever comes back. It holds no
key and never talks to Stripe — everything in `assets/js/` is readable by
anyone who opens view-source, so nothing secret can live there.

### Why there is a function at all

This is otherwise a static site, and the README above says it carries no
deployment configuration. `api/leaderboard.mjs` is the one exception, and it
exists because a Stripe secret key can read every customer's name, address and
email, issue refunds, and change where payouts land. There is no arrangement
in which that key can be shipped to a browser. So it lives in Vercel's
environment, the function reads it server-side, and the browser only ever
receives handles and totals.

No `vercel.json` is needed: anything in `/api` is picked up automatically, and
there is still no build step.

### Configuring it

Set these in **Vercel → Project → Settings → Environment Variables**, then
redeploy. Nothing goes in this repository.

| Variable | Default | |
|---|---|---|
| `STRIPE_SECRET_KEY` | — | Required. Use a **restricted** key with read access to Checkout Sessions and nothing else. |
| `LEADERBOARD_RATE` | `20` | Commission percentage. |
| `LEADERBOARD_MIN` | `1` | Hide creators below this many orders. |

Until `STRIPE_SECRET_KEY` is set the endpoint answers with an empty board and
`ready: false`, sent `no-store`, so the page reads "no sales yet" rather than
breaking and starts working the moment the variable is added — no cache to
wait out.

### What it reads, and what it does not

It reads **Checkout Sessions**, not Charges. `client_reference_id` — the token
`track.js` builds — lives on the session and is not copied onto the
PaymentIntent or the Charge, so the payments list is the wrong end to read it
from. Refunds are deducted (the charge is expanded for `amount_refunded`, so a
refunded order earns nobody a commission) and sessions that completed without
being paid are skipped.

The response carries handles, order counts and totals. No customer name, email
or address is read from Stripe, let alone returned. Stripe's own error text can
name the key, so failures are logged server-side and the caller is told only
that the board is empty.

Responses are cached at Vercel's edge for five minutes, with ten more of
stale-while-revalidate. Without that, every page view would be a round trip to
Stripe and the rate limit would be the ceiling on traffic.

### What the handle is

A label chosen when the link was minted, not a verified account. `?ref=janedoe`
is an arbitrary string; using someone's handle is a convention that makes the
payments list readable. It arrives from a query string a stranger controls, so
the function reduces it to `[a-z0-9-]` and clips it, and the page renders it as
plain text and never links it to a profile that may not be theirs.

## Knowing which creator sold it

Give a creator a link with a tag on it:

```
https://vates.store/?ref=janedoe
https://vates.store/?utm_source=tiktok&utm_medium=paid_social&utm_campaign=launch-aug
```

`ref`, `creator`, `via` and `aff` are all accepted, so whatever a partner
improvises still lands somewhere. `track.js` keeps the **first** touch in
`localStorage` and the last in `sessionStorage`, and only a tagged visit may
write first touch — an untagged return can never overwrite the creator who found
the customer in the first place.

On Purchase, that becomes Stripe's `client_reference_id`:

```
src_tiktok__med_paid-social__cmp_launch-aug__ref_janedoe__t_1787048629
```

which is readable on the payment itself in the Stripe dashboard. That is the
point: the credit is attached to the money, not only to a page view in an
analytics tool, so whoever is paying creators can sort the payments list and
settle up from it directly.

Platform click IDs (`fbclid`, `ttclid`, `gclid` and friends) are captured and
kept too. The pixels do not need them — they match on their own cookies — but a
future server-side Conversions API will.

## Cart behaviour

The drawer is the fallback path only. State lives in memory; the attribution in
`track.js` is the one thing that persists, and clearing browser data removes it.
