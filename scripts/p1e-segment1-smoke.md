# P1.E segment 1 — variant-aware product page smoke test

End-to-end manual protocol against the dev store. Sections marked
**[CODE-SIDE]** are pre-verified by the agent. Sections marked
**[MERCHANT]** require a real dev store, browser, and possibly the
`themeFilesUpsert` exemption + `write_products` scope grant.

## Prerequisites

- Demeurer running (`npm run dev`, accept tunnel, install on dev store).
- The dev store has at least one **published** product with multiple
  variants (e.g., a T-shirt with Size + Color options). Dawn or
  Sense theme is recommended.
- `write_products` scope granted (added in segment 1; merchant must
  re-authorize on next install if upgrading from a prior segment).
- The `themeFilesUpsert` exemption for the dev app (per P1.D segment
  3 prerequisites).

## [CODE-SIDE] Pre-verification

- [ PASS ] `npm run typecheck` clean (3 pre-existing errors only).
- [ PASS ] `npm test` — 109 / 109 green.
- [ PASS ] `npx prisma migrate dev --name add_product_binding` applied.
- [ PASS ] `shopify.app.toml` includes `write_products` in the scopes.
- [ PASS ] `app/lib/compile/__tests__/product-page.test.ts` — section
  file emits with `{% if product %}` guard, page template uses
  `demeurer-product-details` type, determinism holds.
- [ PASS ] `app/lib/compile/__tests__/product-tokens.test.ts` — every
  documented token replaces correctly; unrecognized tokens emit
  diagnostics.

## [MERCHANT] Steps

### 1. Create a product page

[ __ ] In `/app`, click **Create page**.
[ __ ] Select **Product page**.
[ __ ] Click **Pick product** → App Bridge ResourcePicker opens.
[ __ ] Pick the test product. Title pre-fills with the product title;
       editable.
[ __ ] Click **Create**.

**Expected:** Editor opens with a `Product details` section already
inserted.

### 2. Verify editor preview

[ __ ] Canvas shows the actual product title, image, price, variants.
[ __ ] Banner above the section reads "Variant interactions activate
       on the live page."
[ __ ] Variant clicks in the canvas don't update price (expected —
       theme JS only runs on the storefront).

### 3. Add a hero section with a token

[ __ ] Click **+** → add a `Hero` section.
[ __ ] In the Heading field, type: `Buy {{product.title}} now`.
[ __ ] Wait for autosave (status bar shows `Saved · just now`).

### 4. Publish

[ __ ] Click **Publish page**.
[ __ ] Pre-publish dialog summarizes the writes.
[ __ ] Confirm. Banner shows "Publishing…", then success toast.
[ __ ] First-publish modal appears (if this is the merchant's first
       publish on this dev store).

### 5. [CRITICAL] Verify on the storefront

[ __ ] Visit `https://{shop}.myshopify.com/products/{handle}` —
       use the product's actual handle.
[ __ ] Hero heading reads `Buy {Product Title} now` (token expanded).
[ __ ] Product image, price, and variant picker visible.

### 6. [CRITICAL] Variant picker integration

> This is the integration moment that proves the architectural
> approach. The agent cannot run this. **Merchant fills in.**

[ __ ] Click a different variant option (e.g., a different Size).
[ __ ] **Price updates** to reflect the new variant. *(Theme JS
       reading `<script type="application/json">{{ product.variants | json }}</script>`)*
[ __ ] **Image updates** (if the variant has its own image).
[ __ ] **URL updates** to include `?variant=X`.
[ __ ] Quantity input works (typing/incrementing).
[ __ ] Click **Add to cart**. Item appears in the theme's cart drawer
       or cart page (theme-dependent).

**Result:** PASS / FAIL — _________________________

If FAIL on this step, the section's Liquid markup doesn't match the
theme's expectations. Most likely culprits:
- Theme is not Dawn / Sense / Studio / Refresh / Spotlight (i.e.,
  doesn't implement `<variant-radios>` / `<variant-selects>`).
- Theme's product-form JS expects different `data-*` attributes.
- The `<script type="application/json">{{ product.variants | json }}</script>`
  format isn't what the theme reads.

Document the theme name + version in the result. P2 will build a
compatibility matrix.

### 7. Edit + re-publish

[ __ ] In the editor, change the hero heading to
       `Welcome to {{product.title}}`.
[ __ ] Wait for autosave.
[ __ ] Click **Update page**. Confirm.
[ __ ] Refresh the storefront URL.
[ __ ] New heading visible.
[ __ ] **Variant picker still works.**

### 8. Unpublish

[ __ ] In the editor, click **▾** menu → **Unpublish page**.
[ __ ] Confirm.
[ __ ] Visit the storefront URL `https://{shop}.myshopify.com/products/{handle}`.
[ __ ] **Page renders with the theme's DEFAULT product template** (no
       Demeurer template applied; product is back to its original
       theme rendering).
[ __ ] In the Shopify product admin, Theme template field is back to
       the previous value (or "Default product" if nothing was set
       before).

### 9. Demeurer files preserved on unpublish

[ __ ] Online Store → Themes → ⋯ → Edit code.
[ __ ] `sections/demeurer-product-details.liquid` still present.
[ __ ] `templates/product.demeurer-{handle}.json` still present.

The architectural commitment: we don't destroy. The merchant can
manually delete the orphaned files via the theme code editor, or
re-publish to bring them back into use.

### 10. Re-publish (idempotency check)

[ __ ] Click **Publish page** again from the editor.
[ __ ] Pre-publish dialog shows the page template as `tracked` drift
       (we wrote it last; the artifact matches), section file as
       `unchanged`.
[ __ ] Publish proceeds. Storefront URL renders again.

## Result template (paste into PROJECT_STATUS.md)

```
P1.E segment 1 smoke run on YYYY-MM-DD by ____________.
Theme: __________________________________________________

[CODE-SIDE] section: PASS

[MERCHANT] section:
  1. Create product page:                            PASS / FAIL
  2. Editor preview shows real product data:         PASS / FAIL
  3. {{product.title}} token expanded:               PASS / FAIL
  4. Publish succeeds:                               PASS / FAIL
  5. Storefront URL renders:                         PASS / FAIL
  6. Variant picker works (price + image + URL):     PASS / FAIL
     If FAIL — theme name + version: _________________
  7. Edit + re-publish:                              PASS / FAIL
  8. Unpublish reverts to default template:          PASS / FAIL
  9. Theme files preserved after unpublish:          PASS / FAIL
 10. Re-publish idempotency:                         PASS / FAIL

Notes / failures:
  -

Decision: SHIP P1.E segment 1 / DIAGNOSE
```

The variant-picker integration test (step 6) is the architectural
moment for this segment, equivalent to P1.D's uninstall test. If it
fails, the theme integration approach needs revisiting.
