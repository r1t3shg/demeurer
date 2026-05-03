# Lighthouse Results — P1.B

Recorded against published Liquid sections in a dev store with the Dawn theme.
See `lighthouse-check.md` for methodology. Scores are median of 3 runs.

> **Status: NOT YET MEASURED IN A DEV STORE.**
>
> The published-page measurement requires a working compile pipeline + theme
> writer (not part of P1.B — both are P2 tasks). Current Demeurer state:
> sections render in the editor canvas and emit `toLiquid()` output as a
> JSON+template pair. The merchant cannot yet publish a page to a real
> storefront, so there is no live URL to point Lighthouse at.
>
> The table below records **expected** scores based on the architecture and
> the manual emulation done while authoring each section's Liquid output.
> Replace each row with measured medians once the publish flow lands.

## Mobile

| Section | Performance | Accessibility | Best Practices | SEO | Notes |
|---|---|---|---|---|---|
| Hero | _expected 95+_ | _expected 100_ | _expected 100_ | _expected 100_ | Image-heavy. Pending real measurement. |
| CTA band | _expected 99_ | _expected 100_ | _expected 100_ | _expected 100_ | Text only. |
| Image + text | _expected 96_ | _expected 100_ | _expected 100_ | _expected 100_ | `loading="lazy"` + alt enforced by quality check. |
| Feature list | _expected 98_ | _expected 100_ | _expected 100_ | _expected 100_ | Inline SVG icons. |
| Logo wall | _expected 96_ | _expected 100_ | _expected 100_ | _expected 100_ | Marquee CSS-only animation; logos lazy-loaded. |
| Testimonial | _expected 96_ | _expected 100_ | _expected 100_ | _expected 100_ | Carousel = scroll-snap (no JS). |
| FAQ | _expected 99_ | _expected 100_ | _expected 100_ | _expected 100_ | Native `<details>`. |
| Pricing | _expected 94_ | _expected 100_ | _expected 100_ | _expected 100_ | Toggle JS = ~15 lines, scoped. |
| Video (no autoplay) | _expected 96_ | _expected 100_ | _expected 100_ | _expected 100_ | youtube-nocookie embed. |
| Video (autoplay) | _expected 88_ | _expected 100_ | _expected 100_ | _expected 100_ | Iframe loads on render. |
| Form | _expected 98_ | _expected 100_ | _expected 100_ | _expected 100_ | Native `<form>`, native validation. |
| Spacer | _expected 100_ | _expected 100_ | _expected 100_ | _expected 100_ | Trivial. |
| Custom HTML | depends | depends | depends | depends | Merchant-controlled. Yellow warning explains risk. |

## Desktop

| Section | Performance | Accessibility | Best Practices | SEO |
|---|---|---|---|---|
| _all sections_ | _expected 99+_ | _expected 100_ | _expected 100_ | _expected 100_ |

Desktop is dramatically easier than mobile because of CPU/network throttling
removal. If desktop scores drop below 99, something is wrong.

## Action items once measured

- For any section under 95 mobile Performance: open a P2 ticket. Don't paper
  over with JS. Investigate `image_url` widths, `loading` attrs, and the
  Liquid output size.
- For any section under 95 Accessibility: that's a quality regression — fix
  immediately. The `qualityCheck` callbacks should already be flagging the
  cause in the editor.

## Methodology footnote

Once measurements are real, append the test URL, dev store handle, and
Lighthouse CLI version to each row. That gives a reproducible baseline.
