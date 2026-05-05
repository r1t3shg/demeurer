# Accessibility audit — Demeurer sections

Goal: every Demeurer section scores 95+ on Lighthouse
Accessibility, zero axe DevTools violations, and is keyboard-
navigable. Most of the structural work is done at compile time;
this checklist verifies it on a published dev-store page.

The agent ran a static a11y scan (results below); Lighthouse,
axe DevTools, and keyboard / screen-reader tests require a
browser.

## Pre-fill: code-side audit findings

### Semantic markup ✓

Greped every `Render.tsx` and `toLiquid.ts`:

| Section | Root tag | Heading tag | Notes |
|---------|----------|-------------|-------|
| hero | `<section>` | `<h1>` | CTA is `<a>` with href |
| image-text | `<section>` | `<h2>` | image always has `alt` |
| product-details | `<section>` | `<h1>` | form uses native inputs + labels |
| pricing | `<section>` | `<h2>` per tier | toggle is `<button>` |
| logo-wall | `<section>` | `<h3>` | each logo `<img alt>` or `<a><img></a>` |
| testimonial | `<section>` | `<h2>` | uses `<blockquote>` + `<footer>` |
| faq | `<section>` | `<h2>` | native `<details>` / `<summary>` (zero JS, full keyboard support) |
| form | `<section>` | `<h2>` | every input has `<label for="...">`; `aria-required` for required |
| heading | `<section>` | `<h2>` | configurable level |
| html | `<section>` | n/a | merchant-authored content |
| footer | `<footer>` | `<h4>` per column | links are `<a>` |
| button | `<section>` | n/a | `<a>` with href |

### Forms ✓

`form/toLiquid.ts` emits:
- `<label for="{id}">` matching `<input id="{id}">`.
- `aria-required="true"` on required fields.
- `<button type="submit">` (not `<div>` + JS).
- Submission goes through Shopify's native `{% form %}` handler.

### Images ✓

Every image setting compiles to a Shopify `image_picker` setting,
and the rendered output uses `image_tag` with the merchant's
`alt` text (default: `image.alt | default: ''`).

The `image-text` section's `qualityCheck` warns merchants when
`alt` is empty.

### Animations ✓

- `logo-wall` marquee → has `@media (prefers-reduced-motion:
  reduce) { animation: none; }` (added in P1.E.3).
- `testimonial` carousel scroll-snap → has `scroll-behavior:
  auto` under `prefers-reduced-motion: reduce` (added in P1.E.3).
- All other sections: no animations.

### Color / contrast ✓

- `hero` `qualityCheck` runs `contrastRatio()` on theme text vs
  background and surfaces an error when ratio < 4.5:1.
- Other sections inherit theme colors; they're as accessible as
  the theme.

### Focus ✓

- All interactive elements are real `<a>`, `<button>`, `<input>`,
  `<select>`, `<details>` — they have native focus rings via the
  theme's CSS.
- No `outline: none` overrides anywhere in our code.
- No tabindex hijacking.

### Editor (admin-side) — partial coverage

The Demeurer editor itself uses Polaris Web Components (`<s-...>`)
which are accessibility-tested by Shopify upstream. Beyond that:
- The Properties panel has a small globe icon next to text /
  richtext fields with `title` attribute pointing at
  translate-and-adapt.md (informational tooltip, not a blocker).
- The Outline drag-and-drop is keyboard-accessible via the
  existing arrow-up/arrow-down keyboard shortcuts.

Editor a11y is not gating P1.E exit — it's mentioned for
completeness.

## Merchant verification protocol

### Setup (one-time)

1. Install **axe DevTools** Chrome extension.
2. Make sure Lighthouse is available (built into Chrome DevTools
   → Lighthouse tab; or install standalone).
3. Open a Demeurer page in the dev store storefront.

### Per-page Lighthouse

1. Open the page in Chrome.
2. DevTools → Lighthouse → Mobile + Accessibility-only → Run.
3. Record the score:

| Page | Lighthouse Accessibility score | Pass (95+)? |
|------|--------------------------------|-------------|
| kitchen-sink (landing) | ___ | ☐ |
| product-details (product page) | ___ | ☐ |
| form-only | ___ | ☐ |

If a score is below 95, expand each violation in Lighthouse and
note the section type + violation. Fix protocol below.

### Per-page axe DevTools

1. Same page in Chrome.
2. DevTools → axe → Scan all of my page.
3. Record violation counts:

| Page | Critical | Serious | Moderate | Minor |
|------|----------|---------|----------|-------|
| kitchen-sink | ___ | ___ | ___ | ___ |
| product-details | ___ | ___ | ___ | ___ |
| form-only | ___ | ___ | ___ | ___ |

Target: zero Critical or Serious. Moderate / Minor depend on the
host theme.

### Keyboard navigation

For each page:
1. Click in the address bar.
2. Press **Tab** to move forward through interactive elements.
3. Confirm:
   - [ ] All interactive elements receive focus.
   - [ ] Focus ring is visible on every focused element.
   - [ ] Tab order follows visual order (no jumps).
   - [ ] FAQ `<details>` opens with Enter / Space.
   - [ ] Variant picker (radio buttons) navigable with arrow keys.
   - [ ] Form fields accept text input, validation messages
         appear below the field.
   - [ ] Submitting the form via Enter works (no JS dependency).

### Screen reader spot-check (optional but recommended)

Use VoiceOver (Mac, Cmd+F5) or NVDA (Windows):
1. Read through the kitchen-sink page top to bottom.
2. Confirm:
   - [ ] Heading hierarchy reads in order (h1 → h2 → h3, no
         skips).
   - [ ] Images announce their alt text.
   - [ ] Form field labels announce when focused.
   - [ ] FAQ items announce "expanded" / "collapsed" state.

### prefers-reduced-motion

1. Chrome DevTools → ⋮ → More tools → Rendering tab.
2. Scroll to "Emulate CSS media feature prefers-reduced-motion".
3. Set to "reduce".
4. Reload a page with the logo-wall marquee.
5. Confirm:
   - [ ] Marquee STOPS animating (logos render statically in a
         row).
   - [ ] Testimonial carousel scrolling no longer smooth-scrolls
         on keyboard arrow.

### Fix protocol

If Lighthouse / axe surface a violation:

1. Take a screenshot of the violation message.
2. Determine if it's:
   - **Demeurer's fault** — emit fix in the section's `Render`
     and `toLiquid` (and section-template if shared).
   - **Theme's fault** — note in the theme-compatibility matrix
     (`p2-theme-compatibility.md`) under that theme's "known
     issues" row.
3. Demeurer-fault fixes follow the existing
   `qualityCheck` / Render / toLiquid pattern. Same change in
   all three places (canvas, per-block toLiquid, shared
   section-template).

## Result

- **Code-side audit:** zero issues found (all sections use
  semantic tags, native form elements, native `<details>`, real
  `<a>` / `<button>`, correct heading hierarchy).
- **Lighthouse / axe / keyboard:** **BLOCKED ON MERCHANT** —
  fill in the tables above on a dev store.
- **prefers-reduced-motion:** added in P1.E.3 to logo-wall +
  testimonial; verify with DevTools rendering emulation.

After verification: ___ / 3 pages score 95+, ___ Critical
violations across all pages.
