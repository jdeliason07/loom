# loom

Single-product storefront for **No. 01** — a one-piece borosilicate glass bottle, $99.

Static site: plain HTML, CSS and JS. No framework, no build step, no dependencies.

## Run it

Open `index.html` directly, or serve the folder:

```sh
python3 -m http.server 8000   # → http://localhost:8000
```

## Layout

```
index.html                     the whole page
assets/brand/loom-colors.css   the brand color system — imported first, unmodified
assets/css/styles.css          storefront styles
assets/js/app.js               quantity stepper, order drawer, cart state
assets/img/hero-still.svg      hero backdrop (placeholder)
assets/img/no-01.webp/.jpg     the No. 01 studio photograph
assets/img/favicon.svg         the wordmark's "lo", cropped square
```

## Deployment

Hosting is **Vercel, already configured**, so this repo intentionally contains
**no** deployment configuration: no GitHub Actions workflow, no `vercel.json`,
no Pages settings. The site is served straight from the repository root — there
is nothing to build and no output directory to point at. If Vercel's project
settings ask for a framework preset, it's "Other"; leave the build command
empty and the output directory as the root.

## The wordmark

The wordmark is a single fixed element. At the top of the page it sits at hero
scale over the reel; as you scroll it shrinks and travels to the centre of the
top banner, docking there. `.hero__wordmark-slot` is an invisible copy that
holds its place in the hero layout and tells `app.js` where it rests; the
banner's mid-line tells it where to land. Under `prefers-reduced-motion` it
docks outright instead of tracking the scroll.

The banner size is `BANNER_SIZE` in `app.js` (34px). Note this is the one place
the site bends a brand rule: the gradient treatment is specified as hero-only
because it loses contrast at small sizes. 34px is the floor at which it still
reads — going smaller will start to muddy it.

The banner holds nothing else, so the order drawer opens from the Purchase
button and closes with its own control, Escape, or the backdrop.

## Placeholder assets

The product photograph is real. The hero backdrop is still a generated SVG
standing in for footage:

**Hero reel** — replace the `<img class="hero__media-el">` inside `.hero__media`
with the video markup already written out as a comment beside it:

```html
<video class="hero__media-el" autoplay muted loop playsinline
       poster="assets/img/hero-poster.jpg">
  <source src="assets/video/hero.webm" type="video/webm">
  <source src="assets/video/hero.mp4"  type="video/mp4">
</video>
```

`.hero__media-el` covers the layer either way, so no CSS changes are needed.

**Product photo** — `no-01.webp` with a `no-01.jpg` fallback, served full-bleed
from `.product__stage`; its own light studio ground becomes a plate against the
dark page. To replace it, swap both files (and `PRODUCT.image` in
`assets/js/app.js`, which the drawer thumbnail uses).

## Brand rules encoded here

- `loom-colors.css` is imported globally, once, ahead of `styles.css`, and is
  kept verbatim. Components reference only the semantic aliases
  (`--color-bg`, `--color-text-primary`, …), never the raw `--loom-*` names.
- The one exception is the accent moment the brand system names directly: the
  wordmark (`.loom-gradient-text`). The primary CTA uses `--color-accent`.
  Accents appear nowhere else — no body text, no routine chrome.
- The wordmark is always lowercase, never tracked, stretched or italicized.
  The gradient runs from hero scale down to the banner (see above); the footer
  uses the flat `--color-text-primary` ink.
- Space Grotesk 500 for display (sentence case, default letter-spacing), Inter
  for body and UI, JetBrains Mono for tracked-uppercase labels and metadata.
- Corner radii come from `--radius-sm/md/lg` in `styles.css`; nothing is
  square.

Dark is the shipped theme. `loom-colors.css` carries a `[data-theme="light"]`
block, but no toggle is wired up: the hero wordmark's gradient is tuned for the
Void background and loses contrast on light. If a toggle is added later, the
primary button's ink (`color: var(--color-bg)`) needs an explicit dark override,
since the accent stays blue in both themes.

## Cart behaviour

State lives in memory only — no storage, no persistence, no backend. Checkout
is inert by design: it reports that the storefront is a demonstration and takes
no payment.
