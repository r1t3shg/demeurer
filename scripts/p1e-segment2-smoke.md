# P1.E segment 2 — per-variant content + Translate & Adapt smoke

End-to-end manual protocol against the dev store. **[CODE-SIDE]**
items are pre-verified by the agent. **[MERCHANT]** items require
a real dev store, a multi-variant product, a modern theme, and
(for steps 10–13) the Translate & Adapt app installed.

## Prerequisites

- Demeurer running (`npm run dev`, install on dev store).
- A published product with at least 2 variants (e.g., a T-shirt
  with 2+ Sizes or Colors).
- Theme is Dawn / Sense / Studio / Refresh / Spotlight (or any
  theme that fetches sections via Shopify's section-rendering API
  on variant change).
- For T&A round-trip: Translate & Adapt installed, at least one
  secondary language added.

## [CODE-SIDE] Pre-verification

- [ PASS ] `npm run typecheck` clean (3 pre-existing errors only).
- [ PASS ] `npm test` — 135 / 135 green.
- [ PASS ] `app/lib/compile/__tests__/variant-binding.test.ts` — 7
  scenarios cover the compile output (productAware vs not, all/
  specific modes, GID-strip, shared section guard, migrate
  round-trip).
- [ PASS ] `app/lib/compile/__tests__/translatable-fields.test.ts`
  — every section in the registry passes the T&A mapping audit
  (text/richtext → translatable Shopify types; everything else →
  not).

## [MERCHANT] Variant-binding flow

### 1. Setup

[ __ ] On a product page, click **+** → add a Hero section.
[ __ ] In Properties, expand **Variant visibility** (if it's
       collapsed).
[ __ ] Select **Specific variants**.
[ __ ] Uncheck variant 2 (leave variant 1 checked).
[ __ ] Wait for autosave.

### 2. Editor preview

[ __ ] Outline shows the Hero with a "1 variant" badge.
[ __ ] Toolbar **Preview as** dropdown is visible (next to the
       breakpoint switcher).
[ __ ] Switch **Preview as** to variant 2 → Hero fades in canvas
       with "Hidden for this variant".
[ __ ] Switch back to variant 1 (or "Default variant") → Hero
       visible.

### 3. Publish

[ __ ] Click **Publish page**.
[ __ ] Confirm in the pre-publish dialog.
[ __ ] Success toast.

### 4. [CRITICAL] Storefront variant-conditional behavior

> The architectural moment for this segment. Agent cannot run.

[ __ ] Visit `https://{shop}.myshopify.com/products/{handle}`.
[ __ ] On variant 1: Hero is visible.
[ __ ] Click variant 2 in the picker.
[ __ ] **Hero disappears** (theme refetches the section via
       Shopify's section-rendering API; the `{% if should_render %}`
       guard takes the empty branch).
[ __ ] Click variant 1 again.
[ __ ] Hero reappears.

**Result:** PASS / FAIL — _________________________

If FAIL on this step, the most likely cause: theme doesn't refetch
sections on variant change (older themes do full page reloads
instead). The conditional still works on a full reload — just less
smoothly. Document the theme name in the result.

### 5. Multi-block scenario

[ __ ] Add a second hero, bind it to variant 2 only (the opposite).
[ __ ] Publish, refresh storefront.
[ __ ] On variant 1: only the first hero shows.
[ __ ] On variant 2: only the second hero shows.

## [MERCHANT] Translate & Adapt round-trip

### 6. Install Translate & Adapt

[ __ ] Shopify Admin → Apps → Translate & Adapt → Install (free).
[ __ ] Settings → Languages → Add a secondary language (e.g.,
       French).

### 7. Translate the hero heading

[ __ ] Open Translate & Adapt.
[ __ ] Find the Demeurer page (search by handle or product name).
[ __ ] Locate the hero's `heading` field (it should appear as a
       translatable field).
[ __ ] Enter the French translation.
[ __ ] Save.

### 8. [CRITICAL] Verify on storefront

> Agent cannot run.

[ __ ] Set the storefront language to French (use Shopify's URL
       prefix, e.g., `https://{shop}.myshopify.com/fr/products/{handle}`).
[ __ ] **Hero heading shows the French translation.**

**Result:** PASS / FAIL — _________________________

If FAIL: T&A may not have indexed the page yet (give it ~5
minutes), or the field type may not be marked translatable in the
Shopify schema. Check the agent's
`app/lib/compile/__tests__/translatable-fields.test.ts` —
if it's green, the schema is correct and the issue is upstream.

### 9. Editor translatable indicator

[ __ ] In any text or richtext field in the Properties panel, see a
       small globe icon (Globe2) to the right of (or above) the
       field input.
[ __ ] Hover the globe → tooltip reads "Translatable via Shopify's
       free Translate & Adapt app. See docs/translate-and-adapt.md."

## Result template (paste into PROJECT_STATUS.md)

```
P1.E segment 2 smoke run on YYYY-MM-DD by ____________.
Theme: __________________________________________________

[CODE-SIDE] section: PASS

[MERCHANT] section:
  1. Variant-binding setup in editor:                 PASS / FAIL
  2. Preview-as variant fade in canvas:               PASS / FAIL
  3. Publish:                                         PASS / FAIL
  4. Storefront variant-conditional behavior:         PASS / FAIL
     If FAIL — theme name + version: _________________
  5. Multi-block scenario:                            PASS / FAIL
  6. Translate & Adapt installation:                  PASS / FAIL
  7. Translation entered:                             PASS / FAIL
  8. Storefront shows translation:                    PASS / FAIL
  9. Translatable indicator visible:                  PASS / FAIL

Notes / failures:
  -

Decision: SHIP P1.E segment 2 / DIAGNOSE
```

The variant-conditional storefront test (step 4) and the T&A
round-trip (step 8) are the architectural moments. If either fails
without a documented reason, segment 2 isn't shippable.
