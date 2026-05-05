# Lighthouse benchmark — P1.D exit gate item #4

Document numbers from a real Lighthouse run on the dev store. Use
Chrome DevTools (Application → Lighthouse) or the `lighthouse` CLI.

## Run protocol

1. Open the dev store with a target theme (Dawn or Sense).
2. **Baseline run:** Take Lighthouse readings on a vanilla theme page
   that does NOT use Demeurer. Use the theme's default home page or
   a Shopify page without our template.
3. **Demeurer run:** Publish a kitchen-sink page (all 12 sections,
   realistic content; seed one via `/app/catalog`). Take Lighthouse
   readings on `https://{shop}/pages/{handle}`.
4. Run each report at least twice; record the better of the two
   (Lighthouse has run-to-run variance).
5. Record numbers below. Anything below 95 needs a written
   explanation in `Notes / failures`.

## Theme: __________________

### Baseline (no Demeurer)

|                | Mobile | Desktop |
|----------------|--------|---------|
| Performance    |   __   |    __   |
| Accessibility  |   __   |    __   |
| Best Practices |   __   |    __   |
| SEO            |   __   |    __   |

| Metric                     | Mobile  |
|----------------------------|---------|
| Time to Interactive (ms)   |    __   |
| Total page weight (KB)     |    __   |
| HTTP requests              |    __   |

### Demeurer kitchen-sink page

|                | Mobile | Desktop |
|----------------|--------|---------|
| Performance    |   __   |    __   |
| Accessibility  |   __   |    __   |
| Best Practices |   __   |    __   |
| SEO            |   __   |    __   |

| Metric                     | Mobile  |
|----------------------------|---------|
| Time to Interactive (ms)   |    __   |
| Total page weight (KB)     |    __   |
| HTTP requests              |    __   |

### Gap analysis (Demeurer minus baseline)

|                | Mobile  | Desktop |
|----------------|---------|---------|
| Performance    |   __    |    __   |
| Accessibility  |   __    |    __   |
| Best Practices |   __    |    __   |
| SEO            |   __    |    __   |

**Target: gap on every score < 5 points.**

## Notes / failures

Document anything below 95 on Demeurer — what's the cause?

- [ ] Image weight (resolved by `image_url` `width:` parameter? Lazy-
      loaded via `image_tag`?)
- [ ] CSS weight (per-block scope CSS too long? compile-only settings
      too verbose?)
- [ ] Inline JS (Pricing toggle is the only carve-out — count it)
- [ ] Render-blocking resources (theme's own CSS, not ours)
- [ ] LCP element identification — is the largest contentful paint a
      Demeurer image, or a theme element?
- [ ] Other: _________________________________________

## Architecture-side guarantees (pre-verified)

These were enforced at the code level — no Lighthouse run can
violate them:

- [PASS] No runtime JS from our servers. The only inline JS is the
  Pricing billing-toggle carve-out (~15 lines, scoped to a single
  section, opt-in via the section's `billingToggle` setting).
- [PASS] All images use Shopify's `image_url` filter for CDN sizing
  + `image_tag` filter for `loading="lazy"` and a responsive
  `srcset`.
- [PASS] CSS is per-block-scoped in a `{% style %}` block; no global
  stylesheet from us.
- [PASS] Forms use Shopify's native `{% form %}` blocks — no XHR.
- [PASS] FAQ uses native `<details>/<summary>` — no JS.
- [PASS] Logo wall marquee + Testimonial carousel use CSS scroll-
  snap or pure CSS animation — no JS.

## Result

```
Run on YYYY-MM-DD by ____________.

Theme tested: ____________
Mobile Performance (Demeurer kitchen sink): __ / 100
Mobile vs baseline gap (Performance):       __ points
All scores ≥ 95?                            YES / NO
Gap < 5 on every dimension?                 YES / NO

Decision: PASS / FAIL
```
