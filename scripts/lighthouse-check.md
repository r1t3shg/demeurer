# Lighthouse 95+ Manual Checklist (P1.B)

Demeurer's architectural commitment is that pages are NATIVE Liquid sections.
This means Lighthouse scores must be measured against the published storefront,
not the editor canvas. The editor itself is irrelevant to merchant page speed.

## Prerequisites

1. A development store with a recent Dawn theme installed (Shopify's reference
   theme — represents the "good neighbor" baseline).
2. A page in the dev store published via Demeurer with one or more sections.
3. Chrome DevTools Lighthouse panel (or `npx lighthouse <url> --view`).

## Test methodology

For each section type, create a single-section landing page on the storefront
and measure:

- **Mobile (default Lighthouse mobile preset)** — the canonical score Shopify
  optimises for. Mobile is what merchants brag about.
- **Desktop** — secondary, included for completeness.

Run each test 3 times and take the median (Lighthouse mobile scores have ±3
point variance from network/CPU emulation jitter).

## Per-section targets

Target: **95+** Performance, Accessibility, Best Practices, SEO on mobile.

| Section | Mobile target | Notes |
|---|---|---|
| Hero | 95+ | Largest blocker is the background image — must be `image_url: width: 2400` + `image_tag` to get responsive `srcset`. |
| CTA band | 98+ | No images; text-only — should be near 100. |
| Image + text | 95+ | Real `<img>` with `loading="lazy"` (below-the-fold) + `srcset` from `image_tag`. |
| Feature list | 97+ | Lucide icons emit as inline SVG. No external requests. |
| Logo wall | 95+ | Each logo is `image_url: width: 360` + `loading="lazy"`. CLS risk if logos are different aspect ratios — `aspect-ratio` on the wrapper would help (deferred). |
| Testimonial | 96+ | Avatar images need `loading="lazy"` and a max-width. |
| FAQ | 99+ | Pure `<details>/<summary>` — zero JS, near-instant. |
| Pricing | 94+ | Inline JS for billing toggle is the only carve-out — ~15 lines, scoped to section.id. |
| Video | 95+ (no autoplay) / 88+ (autoplay) | YouTube iframe blocks render; using `youtube-nocookie.com` reduces 3rd-party cost. Vimeo similar. mp4 with `preload="metadata"` is best. |
| Form | 98+ | Native `<form>` posting to Shopify endpoints. No JS. |
| Spacer | 100 | Single `<div>`. |
| Custom HTML | depends | Score is whatever the merchant pasted in. Yellow warning surfaces this risk. |

## Accessibility checks (must pass for 95+ A11y)

- All `<img>` have non-empty `alt` (Image+text quality check enforces this).
- Heading order: `<h1>` (hero) → `<h2>` (other sections) → `<h3>` (cards/FAQ items).
- Forms have `<label htmlFor>` bound to inputs (Form section — `useId` ties them).
- Color contrast: at least 4.5:1 (WCAG AA). The Section quality indicator runs
  `meetsAA` from `_shared/quality.ts` and warns if hero text fails on its bg
  or if cta-band text fails on its background.
- `aria-hidden="true"` on decorative elements (Spacer, FAQ chevrons).
- No autoplaying audio (Video section — autoplay coerces `muted = true`).

## How to run

```bash
# Quick spot-check (one section, mobile)
npx lighthouse \
  https://YOUR-DEV-STORE.myshopify.com/pages/demeurer-hero-test \
  --only-categories=performance,accessibility,best-practices,seo \
  --form-factor=mobile \
  --view

# Full report
npx lighthouse <url> --view
```

Record the median score in `lighthouse-results.md`.

## What to do if a score is below 95

1. **Don't add JS to fix it.** Commitment #2 is non-negotiable.
2. Look at the LCP candidate. For hero, that's almost always the background
   image — confirm it has `fetchpriority="high"` and the right `srcset`.
3. Look at CLS. If a section reflows after fonts load, set `font-display: swap`
   in Dawn theme settings (out of our control) — note as "theme-dependent".
4. For Custom HTML sections that score below 95, that's working as intended:
   the merchant accepted the trade-off. Score becomes their problem.

## Out of scope

- Lab data only. Field/CrUX data needs real merchant traffic — collect post-launch.
- Editor canvas Lighthouse score is irrelevant (it's an admin UI, not a customer page).
