# VATES

Single-product storefront for **No. 01** — a one-piece borosilicate glass bottle, $49.

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
shipping.html privacy.html terms.html    the three Stripe asks for
404.html  robots.txt  sitemap.xml  site.webmanifest  favicon.ico
assets/js/config.js            THE ONLY FILE TO EDIT TO GO LIVE
assets/js/track.js             attribution and the ad pixels
assets/fonts/inter-*.woff2     Inter, self-hosted, three weights
assets/img/og.jpg              the 1200x630 share card
assets/brand/loom-colors.css   the brand color system — imported first, unmodified
assets/css/styles.css          storefront styles
assets/js/app.js               the reel, order drawer, cart state, reveal
assets/brand/vates-*.svg       the wordmark, and the "v" cropped square for the favicon
assets/img/reel/01–32.webp     the reel of stills the hero is made of
assets/img/no-01.webp/.jpg     the No. 01 photograph — the pair, on a desk in use
```

## Deployment

Hosting is **Vercel, already configured**, so this repo intentionally contains
**no** deployment configuration: no GitHub Actions workflow, no `vercel.json`,
no Pages settings. The site is served straight from the repository root — there
is nothing to build and no output directory to point at. If Vercel's project
settings ask for a framework preset, it's "Other"; leave the build command
empty and the output directory as the root.

## Page order

1. **Hero** — the reel, full viewport, with nothing over it.
2. **The wordmark** — its own near-full-height section (`.statement`), so the
   gradient arrives after you scroll down from the hero. It fades up as it
   enters view; under `prefers-reduced-motion` it is simply there.
3. **The bottle** — photograph, price, Purchase.
4. **Footer.**

There is no fixed header: nothing needed to live in it, so the page has no top
chrome at all. The order drawer opens from the Purchase button and closes with
its own control, Escape, or the backdrop.

## Paging

The page moves a screen at a time, the way a reel does: let go past the half way
mark and the rest of the travel is the browser's. There is no resting place
between two sections.

It is CSS, not a script — `scroll-snap-type: y mandatory` on the root, with the
hero, the wordmark and the bottle each a snap point one viewport tall. The hero
and the wordmark also carry `scroll-snap-stop: always`, which is what makes a
hard flick move one screen rather than three.

The known trap with `mandatory` is a section taller than the screen: naively it
becomes unreachable, because every release snaps back to its start. The spec's
own escape hatch avoids it — where a snap area is taller than the scrollport,
every position in which it still covers the scrollport is itself a valid snap
position. So the two short sections page and the product section, which runs
past the screen on a phone, scrolls through normally. The footer is aligned by
its `end` rather than its start, since it is shorter than a screen and snapping
it to the top would strand it above empty ground.

**A mouse needs help that a finger does not.** A swipe is one continuous gesture
the browser can measure against the half way mark. A wheel notch is not: each is
its own scroll of about a hundred pixels, which never reaches half a screen, so
mandatory snapping cancels every one. Measured at a 900px viewport, notches of
100, 120 and 240px all landed back at 0 — the page could not be scrolled at all
with a wheel. So `app.js` takes the wheel over where `(pointer: fine)` matches
and moves one section per turn, leaving a section taller than the screen alone
until its far edge is on screen.

That listener is bound only when there is a mouse, never bound-and-guarded from
inside: a non-passive `wheel` listener takes scrolling off the compositor for
the whole document, and on a touch device that alone was enough to break the
snapping it exists to complement.

Under `prefers-reduced-motion` the snapping is off entirely. Paging takes the
scroll out of the reader's hands and moves the viewport for them, which is the
kind of motion that setting is asking us not to do.

## The reel

The backdrop is the **reel**: 32 stills cut a second and a half apart, running
from the first paint and looping for the rest of the visit — the whole reel
comes round in about forty-eight seconds.

There was an intro film in front of it, `intro.mp4` / `.webm`, which played once
a visit and dissolved into the reel on its `ended` event. It is gone, and so is
everything it needed: the poster frame, the `sessionStorage` key that stopped it
playing twice in one tab, the listeners that re-asked for autoplay after iOS
refused it, and the measuring of its contained size to find the scale that took
it to full bleed. The reel is full bleed already, so that scale is now the
constant `--bg-zoom` in the stylesheet and nothing measures anything. It is
about 3.8 MB less to download and a good deal less to go wrong.

The first frame is preloaded in the head at `fetchpriority="high"`, because with
nothing in front of it that picture is the first thing painted. The rest of the
reel is pulled into cache while it holds the screen.

The reel is two `<img>` slots taking turns (`.reel__frame`). The next picture is
loaded and decoded into the idle slot before it is faded up, so a frame is never
seen half-drawn. A picture that will not load is dropped from the reel rather
than left as a gap in it; if none of them load, `.is-reel` is never set and the
hero is the page's own ground.

The cut itself is not a symmetrical crossfade. The outgoing picture is held at
full opacity underneath and dropped in place only once the incoming one has
covered it — fading both at once dips to the background between every pair,
which a slow dissolve carries and a fast cut reads as a flicker.

The pictures run from a tall scroll to a wide panorama, so cropping them all to
the shape of the screen would cut the subject out of half of them. Each is shown
whole (`object-fit: contain`) over a blurred, over-scanned copy of itself — what
would otherwise be letterboxing is the picture's own colour. This is the same
treatment the old 9:16 video cut had baked in, done in CSS so one set of files
serves every screen.

Scrolling zooms the reel out to full bleed, dims and blurs it back, and — once
settled — stops it on one still picture behind the site. Scroll back up and it
picks up where it left off. A backgrounded tab holds its picture too.

## The quotes

Thirteen of the reel's pictures carry something the person in them said. The
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
$49 — under-reporting, which is the safe direction, and the true figures are in
Stripe. A webhook into the Conversions API is the fix when the ad spend
justifies it.

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
