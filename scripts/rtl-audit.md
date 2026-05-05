# RTL audit — checklist for right-to-left language verification

Demeurer pages should reflow correctly for RTL languages (Arabic,
Hebrew, etc.) without theme-specific code. This script verifies
that promise.

The agent ran a full code-side audit (results below); the
storefront test requires a real dev store with an RTL language
configured.

## Pre-fill: code-side audit findings

### Standardized on logical CSS properties ✓

Every section's `Render.tsx` and `toLiquid.ts` uses CSS logical
properties. Greped findings:

- `paddingInlineStart` / `paddingInlineEnd` (never
  `paddingLeft` / `paddingRight` in flowing layout).
- `text-align: start` / `text-align: end` (via
  `textAlignLogical()` helper in `_shared/responsive-css.ts`),
  never raw `left` / `right`.
- `margin-inline: auto` for centering (never `margin: 0 auto`).
- `border-inline-start` for borders that should follow reading
  direction.

The `padding` setting's physical names (`padding_top`,
`padding_right`, `padding_bottom`, `padding_left`) intentionally
keep physical semantics — they describe the visual edge, not the
reading-direction edge. Same convention as Shopify's standard
sections.

### Section-by-section

| Section | RTL behavior | Notes |
|---------|--------------|-------|
| hero | ✓ correct | `text-align: start/center/end` via logical helper |
| image-text | ✓ correct | uses `flex-direction: row-reverse` for image-right; flips symmetrically in RTL |
| product-details | ✓ FIXED in P1.E.3 | was using `direction: rtl` on outer container — no-op on RTL parents. Now uses `flex-direction: row-reverse`, matching image-text. |
| pricing | ✓ correct | grid layout is direction-agnostic |
| logo-wall | ✓ correct | flex-wrap grid works in either direction; marquee animation translates `-50%` in either direction (no flip needed) |
| testimonial | ✓ correct | scroll-snap carousel respects writing direction (browsers reverse scroll for RTL) |
| faq | ✓ correct | native `<details>` flips disclosure triangle automatically |
| form | ✓ correct | labels use `text-align: start`, inputs are direction-aware |
| html | n/a | merchant-authored markup; their responsibility |
| footer | ✓ correct | flex layout, logical properties |
| heading | ✓ correct | logical text-align |
| button | ✓ correct | inline-block, no directional CSS |

### Issues found and fixed

**Issue:** `product-details` outer wrapper used CSS Grid +
`{% if layout == 'image-right-content-left' %}direction:
rtl;{% endif %}` to flip column visual order on LTR pages. On
an RTL page (parent already `direction: rtl`), this override was
a no-op — both `image-left` and `image-right` rendered
identically.

**Fix:** Switched to flexbox with `flex-direction: row-reverse`
for the `image-right-content-left` layout. Now the visual flip
works symmetrically in both LTR and RTL contexts. Removed the
inner `direction: ltr` reset (no longer needed).

Files modified:
- `app/lib/sections/product-details/Render.tsx` (already used
  flexbox; no change required)
- `app/lib/sections/product-details/toLiquid.ts`
- `app/lib/compile/section-templates/product-details.ts`

## Merchant verification protocol

### Setup (one-time per dev store)

1. In Shopify Admin → **Settings** → **Languages**, click **Add
   language** and pick **Arabic** (or any other RTL language).
2. Install **Translate & Adapt** if not already installed.
3. Open Translate & Adapt, find a Demeurer page, and translate
   at least the headings into the RTL language so you have
   visible content to evaluate.
4. Publish the language (not just adding it — needs to be active).

### Per-page verification

For each Demeurer page deployed to the dev store:

1. Open the storefront page in default (LTR) language.
2. Switch the storefront language to the RTL language using the
   language picker (or by appending the locale slug to the URL,
   e.g., `/ar/...`).
3. Confirm:
   - [ ] Text reads right-to-left.
   - [ ] Images on `image-text` or `product-details` "image-right"
         layout appear on the LEFT (visual flip vs LTR).
   - [ ] Headings/body text are right-aligned where the LTR
         version was left-aligned.
   - [ ] Buttons and form controls remain readable (LTR-form
         numerals are fine).
   - [ ] No content cut off or overlapping in the right edge.
   - [ ] Logo-wall marquee scrolls (direction is fine either
         way; verify it animates smoothly, not jerkily).
   - [ ] Testimonial carousel scrolls horizontally with native
         RTL gesture (right-to-left swipe goes to the next slide
         in RTL — this is browser-native behavior).

### Sections to specifically validate

Every kitchen-sink section, in this order:

| Section | LTR check | RTL check | Pass? |
|---------|-----------|-----------|-------|
| hero | heading left-aligned (start) | heading right-aligned (start) | ☐ |
| image-text (image-left layout) | image left, text right | image right, text left | ☐ |
| image-text (image-right layout) | image right, text left | image left, text right | ☐ |
| product-details (image-left) | image left, buy area right | image right, buy area left | ☐ |
| product-details (image-right) | image right, buy area left | image left, buy area right | ☐ |
| pricing | tiers in grid | tiers in grid (no flip needed) | ☐ |
| logo-wall (marquee) | scrolls L→R or R→L (browser default) | scrolls smoothly | ☐ |
| logo-wall (grid) | flex-wrap row | flex-wrap row | ☐ |
| testimonial (carousel) | snaps L to R | snaps R to L | ☐ |
| testimonial (grid) | grid | grid | ☐ |
| faq | disclosure ▶ on left | disclosure ▶ on right | ☐ |
| form | labels left-aligned | labels right-aligned | ☐ |
| heading | text-align: start | text-align: start (now right) | ☐ |
| footer | columns flex | columns flex (no flip needed) | ☐ |

### What NOT to expect

- The `padding.right` and `padding.left` settings in the editor
  are physical, not directional. A page with `padding.right: 80`
  and `padding.left: 0` will keep that asymmetry in RTL. This is
  intentional — matches Shopify's convention.
- Per-language content (different copy per language) is **NOT**
  in scope here. That's done via Translate & Adapt
  (docs/translate-and-adapt.md). RTL audit only verifies
  *layout* reflows.

### If something breaks

1. Take a screenshot of LTR + RTL side-by-side.
2. Note the section type and the layout option that's broken.
3. Inspect the rendered DOM with DevTools. Look for hardcoded
   `padding-left`, `text-align: left`, or `margin: 0 0 0 X`
   patterns — these don't flip.
4. File the bug. The fix is almost always: replace the physical
   property with the logical equivalent.

## Result

- **Code-side audit:** 1 issue found (product-details
  `direction: rtl` no-op). Fixed in P1.E.3.
- **Storefront verification:** **BLOCKED ON MERCHANT** — fill in
  the per-section table on a dev store with an RTL language
  configured.

After verification: ___ / 14 sections pass.
