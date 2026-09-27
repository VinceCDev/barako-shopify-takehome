# Barako & Co. — Design System

The visual language for the theme: tokens, scales, and how the 7 design
principles from the QA pass are applied. Tokens live in
[snippets/css-variables.liquid](snippets/css-variables.liquid) and are
exposed as CSS custom properties on `:root`; the base/shared component
styles live in [assets/critical.css](assets/critical.css).

## Colors

One restrained warm-neutral palette plus a single accent. Merchant-editable
via `settings_schema.json` (`color_background`, `color_surface`,
`color_text`, `color_primary`); everything else is derived.

| Token | Value | Use |
|---|---|---|
| `--color-paper` / `--color-background` | `#F6F2EC` | Page background |
| `--color-surface` | `#ECE5DB` | Cards, the mobile nav panel |
| `--color-ink` / `--color-text` | `#1B1612` | Body text; also the footer's background (the one dark section) |
| `--color-text-muted` | `#6B6158` | Meta text on light backgrounds (5.42:1 on paper) |
| `--color-text-muted-on-dark` | `#9E9A95` | Meta text on the dark footer (6.42:1 on ink) — `--color-text-muted` only hits 2.97:1 there, so it gets its own token rather than being reused incorrectly |
| `--color-primary` / `--color-accent` | `#4A2C1D` | The one accent: buttons, links, focus rings |
| `--color-primary-hover` | `color-mix(primary 82%, black)` | Button/link hover |
| `--color-border` | `color-mix(ink 12%, transparent)` | Hairlines |

All pairings were checked against WCAG 2.2 AA before being locked in (see
contrast notes in the token file's comments) — nothing was tuned after the
fact to "pass"; the palette was verified first.

## Type scale

One typeface (a grotesk sans) for both headings and body — set via two
`font_picker` settings (`type_heading_font` / `type_body_font`, defaulting
to Instrument Sans at two weights) so a merchant could still diverge, but
out of the box everything reads as one voice.

| Token | Value | Notes |
|---|---|---|
| `--font-size-xs` | `0.75rem` (12px) | Floor. Eyebrows, meta text, labels only — never body copy |
| `--font-size-sm` | `0.875rem` (14px) | Small UI text |
| `--font-size-base` | `1rem` (16px) | Minimum for body copy |
| `--font-size-md` | `1.0625rem` (17px) | The body-copy size used everywhere prose appears |
| `--font-size-lg` | `clamp(1.375rem, 1.3rem + 0.4vw, 1.5625rem)` | ~22–25px |
| `--font-size-xl` | `clamp(1.75rem, 1.6rem + 0.8vw, 2.1875rem)` | ~28–35px |
| `--font-size-2xl` | `clamp(1.875rem, 1.6rem + 1.5vw, 2.75rem)` | ~30–44px, section headings |
| `--font-size-3xl` | `clamp(2.25rem, 1.7rem + 2.75vw, 3.5rem)` | ~36–56px |

Roughly a 1.25 ratio from `md` upward. Sizes from `lg` up are fluid via
`clamp()` since that's where viewport-responsive scaling actually matters;
`xs`–`md` stay fixed since fluid scaling on 12–17px text adds complexity
without a visible benefit. The hero heading uses its own bespoke
`clamp(2.5rem, 2.2rem + 3vw, 5rem)` because a full-bleed 100vh hero
legitimately wants to go larger than any other h1 on the site.

`--tracking-tight: -0.02em` (headings), `--tracking-label: 0.08em` (nav,
buttons, meta labels), `--tracking-eyebrow: 0.14em` (the hero eyebrow and
the origin-story eyebrow specifically — the one place tracking is
maximized for drama). `--line-height-tight: 1.05` (headings),
`--line-height-base: 1.6` (body).

## Spacing scale

`--space-1` through `--space-10`, `0.25rem` → `7.5rem`, doubling roughly
every 2 steps: `0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 4.5, 7.5` (rem). One
extra alias, `--section-padding: var(--space-9)` (72px), is what every
section uses for its `padding-block`, then overrides to `--space-10`
(120px) at the desktop breakpoint — that's the "~72px mobile / ~120px
desktop" rhythm from a single pair of tokens, not per-section guesses.

`--page-margin` (a `range` setting, default 32px) is the one shared page
gutter. Sections that stay inside the normal `.shopify-section` grid get
it for free; sections that need to opt out of that grid (anything
`position: absolute`, like the transparent homepage header, or anything
full-bleed — see below) use the `.wrap` utility class instead, which
applies the same `--page-margin` and `--page-width` explicitly. Both
paths resolve to the same two tokens — that's what fixed the header's
clipped cart icon: the transparent header variant had fallen outside the
grid's gutter mechanism entirely.

## Full-bleed pattern

Three places need a background that spans the true viewport width while
their content stays aligned to the page gutter: the footer, the hero, and
the header's scrim on the homepage. The `.shopify-section` wrapper
Shopify generates around every section centers content via a 3-column
grid (`margin | content | margin`), so anything that needs to escape that
and touch both edges of the screen needs an explicit pattern — hence
`.full-bleed` in `critical.css`:

```css
.full-bleed {
  width: 100vw;
  margin-inline: calc(50% - 50vw);
}
```

This is the standard "break out of a centered container" technique, and
it's what **footer** and **hero** use directly (`class="footer
full-bleed"`, `class="hero-kapihan full-bleed"`) — both are normal
in-flow block elements, so the `100vw` + negative-margin math resolves
cleanly against their containing block. A global `html { overflow-x:
hidden; }` is the safety net for the well-known edge case where `100vw`
can be a hair wider than the actually-visible viewport when a scrollbar
is present.

The **header's transparent scrim** needed a different implementation of
the same idea, not the same CSS. It's `position: absolute` (so it
overlays the hero instead of pushing it down), and combining
`position: absolute` with percentage-based margins introduces real
ambiguity: per the CSS2.1 abspos resolution algorithm, when `left` and
`width` are both explicitly set and `right` is the only auto value,
`margin-left`/`margin-right` are used exactly as specified rather than
solved for — which doesn't reliably reproduce the "centered container
breakout" math the way it does for an in-flow element. This was a real,
observed bug: both the scrim and the mobile nav dropdown (which also uses
`.header--transparent` as its containing block) were landing inset from
the true left edge. The fix for `.header--transparent` is the
unambiguous version for an already-positioned element — a plain inset
stretch, letting `right: 0` alongside `left: 0` solve `width` to exactly
fill the containing block, with `.full-bleed`'s `width`/`margin-inline`
explicitly overridden back out:

```css
.header--transparent {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  width: auto;
  margin-inline: 0;
}
```

So: one full-bleed **pattern** (span the true viewport, keep content on
the gutter), two CSS **implementations** depending on positioning
context — the `100vw`/margin trick for in-flow elements, plain inset
stretch for already-`position: absolute` ones. Forcing both onto the
identical property set would have meant shipping the header's known-buggy
version just to keep the class name uniform, which wasn't the goal — the
reusable part is the concept and where it's documented, not a single
verbatim CSS ruleset that doesn't fit both mechanics.

## Shape, radius, motion

Square to near-square only: `--radius-sm: 0px` (buttons, inputs),
`--radius-md: 2px` (images, cards). No pill shapes anywhere — the cart
count is plain `(2)` text and the flavor scales are five small squares,
specifically because a circle/pill was the only way either had been
implemented before this pass.

`--transition-fast: 200ms` (hover states — underline offset, color) and
`--transition-image: transform 600ms cubic-bezier(0.4, 0, 0.2, 1)` (the
`1.03` image zoom on hover, via the shared `.hover-zoom` utility). Both are
neutralized under `prefers-reduced-motion: reduce` by a single global rule
in `critical.css` that zeroes all animation/transition durations, so
individual components never need their own reduced-motion query.

## The 7 principles, applied

1. **Hierarchy** — every section follows eyebrow → heading → body → CTA,
   in that literal order in the DOM (hero, origin-story now both have a
   real eyebrow setting, not just a heading). Size contrast between
   levels is deliberate: a section heading is never within one scale step
   of its own body copy.
2. **Contrast** — every text/background pairing was checked with a WCAG
   formula before being adopted (see the Colors table); nothing sits at a
   value that "looks fine." The page alternates light sections and one
   fully dark section (the footer) for rhythm, rather than every section
   being the same paper tone back-to-back.
3. **Balance** — origin-story's alternating rows use `align-items: center`
   so the text column is vertically centered against the image at every
   row, not top-aligned against a taller photo.
4. **Alignment** — one `.wrap` utility (`--page-width` + `--page-margin`)
   and the `.grid-12` utility are the only two layout primitives; every
   section either sits in the implicit `.shopify-section` grid-column or
   opts into `.wrap` explicitly. No section invents its own gutter math.
5. **Repetition** — one spacing scale, one type scale, one `.button`, one
   `.text-link`, one hairline (`--color-border`) — audited by grep before
   calling this done: zero hardcoded px values for spacing/type in any
   active section (the only hardcoded values left live in the unused
   stock `hello-world.liquid` demo section, which nothing renders).
6. **Proportion** — the type scale above; fixed aspect ratios via CSS
   (`aspect-ratio: 4/5` for origin and product images, the hero is
   full-bleed `100vh`/`80vh`), each paired with `object-fit: cover` and,
   for the hero and origin images, `object-position` driven by the
   merchant's actual focal point (`image.presentation.focal_point`), not
   a fixed crop guess.
7. **White space** — `--section-padding` (with its own desktop override)
   is the only vertical rhythm value sections use; nothing hand-tunes its
   own top/bottom padding. Divider hairlines only appear between repeated
   items (origin rows, brew steps), never floating alone.

## Summary of this pass's changes

- **Header**: fixed the clipped cart icon (the transparent/absolute
  homepage header had fallen outside the shared gutter grid — now uses
  `.wrap` explicitly); added a top scrim behind the transparent header so
  nav text keeps contrast over any photo; icons and the mobile toggle now
  have real 44×44px tap targets; desktop nav links get the same via
  invisible padding + a compensating negative margin so the visual layout
  doesn't shift.
- **Hero**: replaced the flat overlay with a layered espresso-tinted
  scrim (strong bottom-left, fading to transparent top-right) via two new
  settings (`overlay_color`, `overlay_strength`); image now uses real
  `image_url`/`image_tag` with a `widths` list, `sizes="100vw"`, focal-point
  `object-position`, and `loading="eager" fetchpriority="high"` for LCP;
  heading `max-width` tightened to `14ch`.
- **Origin story**: added an eyebrow setting; images now use focal-point
  `object-position` (bypassing the generic `image` snippet, which only
  supports fixed server-side crop); collapsed a redundant stacked
  gap+padding into one consistent per-row spacing value.
- **Footer**: full rebuild. Full-bleed dark (`--color-ink`) background
  instead of an inset beige box; newsletter is now a large statement
  heading with the form beside it, both messages and label kept semantic
  (`role="status"`/`role="alert"`, which already imply the equivalent of
  `aria-live`); a real 4-column grid (brand blurb, two independent
  `link_list` settings for "Shop" and "Help", plus a `visit_info`
  richtext) collapsing to 2 then 1 columns; a bottom bar with a hairline
  divider, copyright, a new legal `link_list`, and payment icons in
  grayscale at reduced opacity.
- **Global**: added a `<main id="MainContent">` landmark and a visible
  (focus-revealed) skip link; consolidated three separate icon SVG assets
  into `snippets/icon.liquid`, an inline Lucide-style set (`currentColor`,
  1.25 stroke, `aria-hidden`); fixed a real bug found along the way — the
  cart item count was previously `aria-hidden`, so screen readers never
  heard how many items were in the cart; tightened the type scale to a
  ~1.25 modular ratio with `clamp()` on the larger sizes, which propagated
  to every section automatically since they all already reference the
  same token names.
- Ran `shopify theme check` after every structural change; it caught two
  real bugs along the way (a Liquid HTML parser confusion from an
  attribute-generating filter chain split across lines, and a false-positive
  `RemoteAsset` warning from splitting `image_url`/`image_tag` across two
  `assign` statements) — both fixed by restructuring the Liquid rather than
  suppressing the check.

## Round 2

- **Full-bleed bug fix**: see the dedicated section above — footer and
  header scrim were both landing inset from the true viewport edge.
  Footer just needed the `.full-bleed` class added (it was simply
  missing); the header needed a positioning-aware variant of the same
  concept.
- **Hero eyebrow contrast**: the diagonal scrim alone let the topmost
  line of text (the eyebrow) land in a weaker part of the gradient
  falloff than the heading/buttons below it. Added a second, flat
  full-width band layered under the diagonal one, sized to the whole
  text block, so every line gets the same guaranteed coverage — verified
  numerically (worst case, a pure-white sky behind the current default
  strength) at 4.99:1, comfortably over 4.5:1.
- **Footer grid**: now a real 4-column layout on desktop (brand ~4/12,
  Shop/Help/Visit sharing the remaining 8/12 via explicit
  `grid-column: span`, not `nth-child`, so the widths stay correct
  regardless of which of the three optional columns are actually
  populated) and a 2-column grid for the three link groups on mobile,
  brand always first. Column headings now use `--tracking-eyebrow`
  instead of `--tracking-label`, matching the hero/origin-story eyebrow
  treatment exactly, per the "same eyebrow style everywhere" ask.
- **Origin story rebalance**: the split is now image 5/12, one empty
  gutter column, text 6/12 (both forward and reversed rows use explicit
  `grid-column` spans, not `order` alone, so the 1-column gap is real
  grid space, not just visual left-over). The image keeps its 4:5 ratio
  but gets `max-height: 35rem` at desktop so a wide column doesn't produce
  an oversized photo. The `product_link` (`url`) setting became `product`
  (an actual product reference): when set, altitude and tasting notes are
  read from `linked_product.metafields.custom.altitude`/`.flavor_notes`
  with the block's own settings as a fallback; variety and process have no
  metafield equivalent in this project's metafield set, so they always
  come from the block. A new `<dl>` of up to four facts (Altitude,
  Variety, Process, Tasting notes) gives the text column enough visual
  weight to hold its own against the photo. "Shop this origin" gained an
  arrow icon (a new `arrow-right` entry in `snippets/icon.liquid`) and
  already had its 44px tap target from the shared `.text-link` rule.
