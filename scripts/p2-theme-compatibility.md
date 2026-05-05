# Theme compatibility matrix — P2 verification target

Demeurer pages must render correctly across the top Shopify
themes without theme-specific code. This matrix tracks
verification across the top 5 themes.

The agent **cannot run** any of the per-theme checks — each
requires installing the theme on the dev store, configuring
required theme settings, and visually inspecting the rendered
storefront. This document pre-fills the structure; the merchant
fills in results.

## Compatibility levels

- **Full** — kitchen-sink renders pixel-correct; variant picker
  on product page works; Lighthouse score within 5 points of the
  theme's baseline (without Demeurer pages).
- **Partial** — sections render but with degraded UX in one or
  more places. Variant picker may need page reload (theme lacks
  `<variant-radios>`). Document the workaround.
- **Incompatible** — fundamental rendering breakage. Do not
  recommend Demeurer to merchants on this theme.

## Themes targeted (P2 — private beta)

| Theme | Vendor | Latest version (date checked) | Variant custom elements? |
|-------|--------|-------------------------------|---------------------------|
| Dawn | Shopify | ___ (___) | ☐ verify |
| Sense | Shopify | ___ (___) | ☐ verify |
| Studio | Shopify | ___ (___) | ☐ verify |
| Refresh | Shopify | ___ (___) | ☐ verify |
| Spotlight | Shopify | ___ (___) | ☐ verify |

## Per-theme results

### Theme: Dawn

| Test | Result |
|------|--------|
| Kitchen-sink renders correctly (all 12 sections visible) | ☐ |
| Hero displays full-width with bg image | ☐ |
| Product-details "image-left" layout: image left, buy area right | ☐ |
| Product-details "image-right" layout: image right, buy area left | ☐ |
| Product-details variant picker: clicking a variant updates price without page reload | ☐ |
| Product-details add-to-cart: adds to cart, redirects or shows toast | ☐ |
| Form section submits via Shopify's `{% form %}` handler | ☐ |
| FAQ accordion expands/collapses with click | ☐ |
| Logo-wall marquee animates smoothly | ☐ |
| Testimonial carousel scrolls horizontally with snap | ☐ |
| Pricing toggle (monthly/yearly) updates prices via 15-line inline JS | ☐ |
| Lighthouse mobile score (Demeurer page) | ___ |
| Lighthouse mobile score (theme baseline page) | ___ |
| Score delta | ___ |
| Compatibility level | ☐ Full / ☐ Partial / ☐ Incompatible |
| Notes | |

**Pre-fill (P1.D smoke):** agent assumes Full per the chaos test
in `p1a-chaos-test.md` (Dawn was the test theme). BLOCKED ON
MERCHANT for the formal P2 sign-off.

### Theme: Sense

| Test | Result |
|------|--------|
| Kitchen-sink renders correctly | ☐ |
| Hero displays full-width | ☐ |
| Product-details image layouts flip correctly | ☐ |
| Variant picker updates without reload | ☐ |
| Form submits | ☐ |
| FAQ accordion works | ☐ |
| Logo-wall marquee animates | ☐ |
| Testimonial carousel works | ☐ |
| Pricing toggle works | ☐ |
| Lighthouse mobile (Demeurer / baseline / delta) | ___ / ___ / ___ |
| Compatibility level | ☐ Full / ☐ Partial / ☐ Incompatible |
| Notes | |

### Theme: Studio

| Test | Result |
|------|--------|
| Kitchen-sink renders correctly | ☐ |
| Hero displays full-width | ☐ |
| Product-details image layouts flip correctly | ☐ |
| Variant picker updates without reload | ☐ |
| Form submits | ☐ |
| FAQ accordion works | ☐ |
| Logo-wall marquee animates | ☐ |
| Testimonial carousel works | ☐ |
| Pricing toggle works | ☐ |
| Lighthouse mobile (Demeurer / baseline / delta) | ___ / ___ / ___ |
| Compatibility level | ☐ Full / ☐ Partial / ☐ Incompatible |
| Notes | |

### Theme: Refresh

| Test | Result |
|------|--------|
| Kitchen-sink renders correctly | ☐ |
| Hero displays full-width | ☐ |
| Product-details image layouts flip correctly | ☐ |
| Variant picker updates without reload | ☐ |
| Form submits | ☐ |
| FAQ accordion works | ☐ |
| Logo-wall marquee animates | ☐ |
| Testimonial carousel works | ☐ |
| Pricing toggle works | ☐ |
| Lighthouse mobile (Demeurer / baseline / delta) | ___ / ___ / ___ |
| Compatibility level | ☐ Full / ☐ Partial / ☐ Incompatible |
| Notes | |

### Theme: Spotlight

| Test | Result |
|------|--------|
| Kitchen-sink renders correctly | ☐ |
| Hero displays full-width | ☐ |
| Product-details image layouts flip correctly | ☐ |
| Variant picker updates without reload | ☐ |
| Form submits | ☐ |
| FAQ accordion works | ☐ |
| Logo-wall marquee animates | ☐ |
| Testimonial carousel works | ☐ |
| Pricing toggle works | ☐ |
| Lighthouse mobile (Demeurer / baseline / delta) | ___ / ___ / ___ |
| Compatibility level | ☐ Full / ☐ Partial / ☐ Incompatible |
| Notes | |

## Per-theme protocol

For each theme:

1. In Shopify Admin → **Online Store** → **Themes**, install the
   theme into the dev store.
2. Customize the theme's basic settings (logo, colors,
   typography) so it renders something — not the unstyled
   fallback.
3. Publish (or activate the theme as draft if you want to keep
   Dawn live).
4. Open the kitchen-sink Demeurer page. Walk through the test
   table for that theme.
5. Open the bound product-details Demeurer page. Verify variant
   picker behavior:
   - Click a variant → price updates without reload → PASS
   - Click a variant → page reloads with new variant → PARTIAL
     (theme lacks `<variant-radios>` custom element)
   - Click a variant → nothing happens → INCOMPATIBLE
6. Run Lighthouse (mobile, Performance + Accessibility).
7. Fill in the table.

### What "Full" requires (canonical definition)

- All sections render. No CSS layout breakage.
- Variant picker works without page reload (theme provides
  `<variant-radios>` or `<variant-selects>` custom elements).
- Form submission goes through Shopify's `{% form %}` and shows
  the theme's success/error states.
- Lighthouse mobile score within 5 points of theme baseline.

### What "Partial" looks like (examples)

- Variant picker reloads on click. **Workaround:** document for
  merchants; not a hard fail.
- Theme uses non-standard CSS variable names (e.g., `--accent`
  vs `--demeurer-accent`). **Workaround:** Demeurer's CSS uses
  `var(--demeurer-accent, fallback)`; merchants can override
  with theme settings.
- FAQ disclosure triangle renders in an unexpected location.
  Browser default; not a Demeurer fix.

### What "Incompatible" looks like

- Theme aggressively resets `<section>` styles to the point that
  Demeurer's inline styles don't apply.
- Theme's CSS uses `!important` everywhere, breaking Demeurer's
  scoped styles.
- Theme blocks JSON templates entirely (some bespoke themes
  do — they only support .liquid templates).

## Aggregate result

| Compatibility level | Theme count |
|---------------------|-------------|
| Full | ___ |
| Partial | ___ |
| Incompatible | ___ |

P2 exit gate target: **5/5 Full** for Shopify-built themes
(Dawn, Sense, Studio, Refresh, Spotlight).

## Architectural notes

- **Demeurer ships zero theme-specific code.** If a theme breaks
  a section, the answer is: document the limitation, lower the
  compatibility level for that theme, and surface a warning to
  merchants on that theme. Never patch our compile output for
  one theme.
- **Variant interaction is theme-dependent by design.** Demeurer
  emits the form markup that themes already parse
  (`<variant-radios>`, `<variant-selects>`). This is the
  Shopify-standard convention. Older themes that don't
  implement these custom elements degrade to page-reload
  behavior, which is acceptable.
- **Inline JavaScript count:** the pricing toggle's ~15 lines of
  inline JS is the only JS Demeurer emits. Everything else is
  CSS-only or relies on theme JS.

## Result

**BLOCKED ON MERCHANT** for all 5 themes — the agent cannot
install themes, customize them, or run Lighthouse against them.
