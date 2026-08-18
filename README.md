# VATES

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
assets/brand/vates-*.svg       the wordmark, and the "v" cropped square for the favicon
assets/video/intro.mp4/.webm   the intro film — plays once on load
assets/img/reel/01–32.webp     the reel of stills the film hands over to
assets/img/hero-poster.jpg     first frame, shown until the intro starts
assets/img/no-01.webp/.jpg     the No. 01 photograph — the pair, clear and smoke
```

## Deployment

Hosting is **Vercel, already configured**, so this repo intentionally contains
**no** deployment configuration: no GitHub Actions workflow, no `vercel.json`,
no Pages settings. The site is served straight from the repository root — there
is nothing to build and no output directory to point at. If Vercel's project
settings ask for a framework preset, it's "Other"; leave the build command
empty and the output directory as the root.

## Page order

1. **Hero** — the film, then the reel, full viewport, with nothing over it.
2. **The wordmark** — its own near-full-height section (`.statement`), so the
   gradient arrives after you scroll down from the video. It fades up as it
   enters view; under `prefers-reduced-motion` it is simply there.
3. **The bottle** — photograph, price, quantity, Purchase.
4. **Footer.**

There is no fixed header: nothing needed to live in it, so the page has no top
chrome at all. The order drawer opens from the Purchase button and closes with
its own control, Escape, or the backdrop.

## The film and the reel

Two things share the backdrop. `intro.mp4` (H.264) is listed first for Safari
and iOS; `intro.webm` (VP9) is there for browsers without H.264. Both are silent
— the audio track is stripped, which is also what lets the video autoplay.
`hero-poster.jpg` holds the frame until playback starts, and stands in entirely
if autoplay is refused.

The film plays once. On its `ended` event app.js hands over to the **reel**: 32
stills that crossfade one into the next and loop for the rest of the visit.
There is no `loop` attribute on the video on purpose — without `ended` there is
no handover — and a film that fails to load fires `error`, which hands over too
rather than leaving the hero on a dead poster.

The reel is two `<img>` slots taking turns (`.reel__frame`). The next picture is
loaded and decoded into the idle slot before it is faded up, so a frame is never
seen half-drawn, and the one after that is warmed with a detached `Image()` while
the current one holds. A picture that will not load is dropped from the reel
rather than left as a gap in it; if none of them load, `.is-reel` is never set
and the hero simply holds the last frame of the film.

The pictures run from a tall scroll to a wide panorama, so cropping them all to
the shape of the screen would cut the subject out of half of them. Each is shown
whole (`object-fit: contain`) over a blurred, over-scanned copy of itself — what
would otherwise be letterboxing is the picture's own colour. This is the same
treatment the old 9:16 video cut had baked in, done in CSS so one set of files
serves every screen.

Scrolling zooms the reel out to full bleed, dims and blurs it back, and — once
settled — stops it on one still picture behind the site. Scroll back up and it
picks up where it left off. A backgrounded tab holds its picture too.

## Replacing the imagery

**Reel** — drop numbered files at `assets/img/reel/01.webp` … `32.webp`. The
count and the path are declared in `index.html` on `#reel` (`data-frame-count`
and `data-frame-src`, where `{n}` stands in for the two-digit number), so
changing how many pictures the reel holds is a one-attribute edit, not a code
change. `FRAME_MS` in `app.js` is how long each one holds.

**Film** — replace `assets/video/intro.mp4` / `.webm` and `hero-poster.jpg`:

```sh
ffmpeg -i source.mov -an -r 30 -c:v libx264 -pix_fmt yuv420p -crf 24 \
  -preset slow -movflags +faststart assets/video/intro.mp4
ffmpeg -i source.mov -an -r 30 -c:v libvpx-vp9 -crf 36 -b:v 0 -row-mt 1 \
  assets/video/intro.webm
ffmpeg -ss 0.1 -i source.mov -frames:v 1 assets/img/hero-poster.jpg
```

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
- The wordmark is artwork, not type: `assets/brand/vates-wordmark.svg`, a
  traced outline filled with the six colour bands the logo is built from
  (#76b856, #f2ba4b, #e3873d, #cf4743, #8b4192, #4698d3). It is always
  lowercase, never tracked, stretched or italicized, and never recoloured.
  The primary CTA uses `--color-accent`; accents appear nowhere else.
- One family for all type, `--font`: Helvetica where it is installed, Inter
  served as the fallback everywhere else, then Arial. The only tracked
  treatment left is `.label`, uppercase at 0.18em.
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
