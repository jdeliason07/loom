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
assets/js/app.js               quantity stepper, order drawer, cart state, reveal
assets/video/hero.mp4/.webm    the hero reel
assets/img/hero-poster.jpg     first frame, shown until the reel starts
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

## Page order

1. **Hero** — the reel, full viewport, with nothing over it.
2. **The wordmark** — its own near-full-height section (`.statement`), so the
   gradient arrives after you scroll down from the video. It fades up as it
   enters view; under `prefers-reduced-motion` it is simply there.
3. **The bottle** — photograph, price, quantity, Purchase.
4. **Footer.**

There is no fixed header: nothing needed to live in it, so the page has no top
chrome at all. The order drawer opens from the Purchase button and closes with
its own control, Escape, or the backdrop.

## The reel

`hero.mp4` (H.264) is listed first for Safari and iOS; `hero.webm` (VP9) is
there for browsers without H.264. Both are silent — the audio track is stripped,
which is also what lets the video autoplay. `hero-poster.jpg` holds the frame
until playback starts, and stands in entirely if autoplay is refused.

The source was 1180×1684 HEVC, 60fps, 5.4s, 6.9 MB. Encoded to 30fps at CRF 24
(x264) and CRF 36 (VP9), it is 727 KB and 340 KB. To re-encode a new cut:

```sh
ffmpeg -i source.mov -an -r 30 -c:v libx264 -pix_fmt yuv420p -crf 24 \
  -preset slow -movflags +faststart assets/video/hero.mp4
ffmpeg -i source.mov -an -r 30 -c:v libvpx-vp9 -crf 36 -b:v 0 -row-mt 1 \
  assets/video/hero.webm
ffmpeg -ss 0.1 -i source.mov -frames:v 1 assets/img/hero-poster.jpg
```

The footage is portrait. On phones it fills the viewport; from 900px up,
filling the screen would mean upscaling a single face past 1440px, so the reel
is shown at its own proportions as a centred, rounded panel on the Void
(`.hero__media-el`, in the `min-width: 900px` block). Swap in landscape footage
and you can delete that block to go full-bleed everywhere.

## Replacing the imagery

**Reel** — drop new files at `assets/video/hero.mp4` / `.webm` and a new
`assets/img/hero-poster.jpg` (see the ffmpeg lines above). No markup changes.

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
  The gradient treatment appears once, at hero scale on the Void, in its own
  section; the footer uses the flat `--color-text-primary` ink.
- Space Grotesk 500 for display (sentence case, default letter-spacing), Inter
  for body and UI, JetBrains Mono for tracked-uppercase labels and metadata.
- Corner radii come from `--radius-sm/md/lg` in `styles.css`; nothing is
  square.

Dark is the shipped theme. `loom-colors.css` carries a `[data-theme="light"]`
block, but no toggle is wired up: the wordmark's gradient is tuned for the Void
background and loses contrast on light. If a toggle is added later, the
primary button's ink (`color: var(--color-bg)`) needs an explicit dark override,
since the accent stays blue in both themes.

## Cart behaviour

State lives in memory only — no storage, no persistence, no backend. Checkout
is inert by design: it reports that the storefront is a demonstration and takes
no payment.
