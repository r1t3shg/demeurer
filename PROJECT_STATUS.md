# Demeurer — Project Status

A Shopify landing-page builder. **P1.D complete in code (2026-05-04). P1.E segment 1 (variant-aware product pages) and segment 2 (per-variant content + Translate & Adapt verification) complete in code (2026-05-05).** All have merchant-runnable smoke gates. P1.E remaining: internal dogfood.

---

## P1.E segment 2 — per-variant content + Translate & Adapt ✅ COMPLETE (code) 2026-05-05 — variant-conditional storefront test + T&A round-trip BLOCKED ON MERCHANT

Two extensions on top of segment 1:

1. **Per-variant content authoring.** Blocks on product pages can
   be bound to specific variants. The shared section template
   wraps the body in a Liquid `{% if %}` guard that compares the
   current variant id against the bound list. When a variant
   changes, modern themes refetch the section via Shopify's
   section-rendering API and the conditional re-evaluates. **No
   custom JS from us.**

2. **Translate & Adapt verification.** Audited every section's
   field-kind → Shopify-setting-type mapping; `text`/`richtext`
   fields surface as translatable T&A entries automatically. A
   small globe icon next to translatable fields in the editor
   sets the right expectations. Documented in
   `docs/translate-and-adapt.md`.

### What's in place

| Area | Path |
|------|------|
| `VariantBinding` type + Block field + isBlock guard | `app/lib/editor/types.ts` |
| `setVariantBinding` + `previewVariantId` on store | `app/lib/editor/store.ts` |
| `bound_variant_ids` compile-only setting (productAware only) | `app/lib/compile/settings-schema.ts` |
| Variant-guard wrap in shared section template | `app/lib/compile/section-templates/_shared.ts` |
| `bound_variant_ids` written in page-template (GID-stripped) | `app/lib/compile/page-template.ts` |
| VariantBindingRow (Properties panel) | `app/components/editor/VariantBindingRow.tsx` |
| Outline variant badge | `app/components/editor/Outline.tsx` |
| PreviewAsVariantSelect (toolbar) | `app/components/editor/PreviewAsVariantSelect.tsx` |
| Canvas variant fade | `app/components/editor/Canvas.tsx` |
| Globe2 icon on text/richtext fields | `app/components/editor/fields/{TextField,RichTextField}.tsx` |
| 7 variant-binding tests + 19 translatable-fields tests | `app/lib/compile/__tests__/{variant-binding,translatable-fields}.test.ts` |
| Multilingual setup guide | `docs/translate-and-adapt.md` |
| Manual smoke + storefront tests | `scripts/p1e-segment2-smoke.md` |

### How variant binding compiles

Editor mutation → Block JSON:
```json
{
  "variantBinding": {
    "mode": "specific",
    "variantIds": ["gid://shopify/ProductVariant/123", "gid://shopify/ProductVariant/456"]
  }
}
```

Compile output (page template settings):
```json
{ "bound_variant_ids": "123,456" }
```

Shared section file (productAware sections) wraps the body in a
`{% if %}` guard comparing
`product.selected_or_first_available_variant.id` against the
comma-separated list. Empty `bound_variant_ids` (the common case)
takes the `{% else %}` branch — semantically identical to no
guard. Per-section files remain byte-identical regardless of
merchant variant choices; the binding payload lives in the page
template JSON.

### Translate & Adapt audit result

`translatable-fields.test.ts` walks every section in the registry
and asserts:

- `text` / `richtext` fields → Shopify `text` / `textarea` /
  `richtext` (translatable in T&A).
- All other field kinds → non-translatable Shopify types.

**All 13 sections pass.** No schema changes needed — segment 1's
mapping was already correct. The test is the regression net.

### Verification of the four architectural commitments

| # | Commitment | Status after P1.E segment 2 |
|---|------------|---|
| 1 | Pages keep rendering after uninstall | ✅ Unchanged. The variant guard is part of the section file in the merchant's theme; uninstall doesn't touch it. Without us, the conditional still evaluates correctly. |
| 2 | No runtime JS injection from our servers | ✅ Variant-conditional rendering is theme-JS-driven (section-rendering API on variant change). We emit Liquid only. The Pricing toggle carve-out (~15 lines, opt-in, scoped) is unchanged. |
| 3 | Pages survive theme updates | ✅ Unchanged from P1.D segment 5. |
| 4 | Stop if violating 1–3 | ✅ Block.variantBinding is purely additive to the document; no schema migration. Translate & Adapt integration is upstream — Demeurer doesn't ship a per-language editor. |

### Test coverage

`variant-binding.test.ts` — **7 / 7 green**:
1. Non-productAware section: no `bound_variant_ids` in settings.
2. ProductAware section, no binding: `bound_variant_ids: ""`.
3. ProductAware section, mode "all": empty string.
4. ProductAware section, mode "specific": comma-separated numeric
   ids (GID stripped).
5. ProductAware shared file contains the variant guard.
6. Non-productAware shared file lacks the guard.
7. `variantBinding` survives `migrateDocument` round-trip.

`translatable-fields.test.ts` — **19 / 19 green**: per-section
audit + list-field block audit across all 13 sections.

**Project total: 135 / 135 green** (26 new + 109 from segment 1).

### Architectural concerns surfaced

1. **The variant guard adds a layer to every productAware section's
   shared file.** When binding isn't used, the `{% else %}` branch
   runs — semantically no-op. Snapshot tests regenerated to
   capture the new shared-file content.

2. **GID-strip happens at compile time.** Editor stores
   `gid://shopify/ProductVariant/123`; storefront sees numeric
   `123`. Compile normalizes.

3. **`previewVariantId === null` shows all blocks.** Faded-by-
   default would feel broken to merchants who haven't opted into a
   specific preview.

4. **The translatable globe is informational.** Browser-native
   `title` tooltip; no editing UI. In-app T&A deep link is
   post-MVP.

5. **No schema migration.** `Block.variantBinding` is additive;
   `migrateDocument` unchanged.

6. **Per-variant + per-language don't compose cleanly.** Documented
   in `docs/translate-and-adapt.md` under "Limitations".

7. **The variant-conditional storefront test cannot be agent-run.**
   Smoke step 4.

8. **T&A round-trip also merchant-only.** Smoke step 8.

### Storefront variant-conditional confirmation

> Spec asked: "Tell me what you changed and confirm the variant-
> conditional storefront behavior worked."

**The agent cannot confirm this.** Running the test requires a
real dev store with a multi-variant product on a modern theme,
plus a real browser. Smoke script step 4 is the protocol; result
template at the bottom. T&A round-trip (step 8) has the same
constraint.

If step 4 fails, the most likely cause is theme JS doing full
page reloads instead of section-rendering-API refetches. The
conditional still works on a full reload — just less smoothly.

### Known follow-ups

- Internal dogfood — Demeurer's marketing site on Demeurer.
- "Insert product data" UX affordance in field renderers (deferred
  from segment 1).
- Migrate from deprecated `featuredImage` / `images` to `media`.
- Theme compatibility matrix (P2 — private beta).

---

## P1.E segment 1 — variant-aware product pages ✅ COMPLETE (code) 2026-05-05 — variant-picker storefront test BLOCKED ON MERCHANT

Pages can now bind to a Shopify product. A new **Product details**
section renders the variant picker, price, gallery, and add-to-cart
using Shopify's standard `<variant-radios>` / `<variant-selects>`
markup that Dawn/Sense/Studio/Refresh/Spotlight already enhance with
their own JS. Existing sections (`hero`, `image-text`) gained a
`productAware` flag and accept `{{product.title}}` tokens that
expand to real Liquid at compile time.

**No custom JS from us.** The variant picker integration is theme-
driven — we emit the markup pattern themes already understand, and
their existing JS does the work.

### What's in place

| Area | Path |
|------|------|
| Page binding columns + migration | `prisma/schema.prisma`, `prisma/migrations/20260505014840_add_product_binding/` |
| `write_products` scope added | `shopify.app.toml` |
| Product fetch + cache + productUpdate mutation | `app/lib/product/fetch.server.ts` |
| ProductContext + `useProduct()` hook | `app/components/editor/ProductContext.tsx` |
| `productAware?: boolean` on `SectionDefinition` + `product` prop on `SectionRenderProps` | `app/lib/sections/types.ts` |
| Product details section (schema, Render, toLiquid, index) | `app/lib/sections/product-details/` |
| Compile-side product-details template | `app/lib/compile/section-templates/product-details.ts` |
| Token replacement (`{{product.title}}` → `{{ product.title }}` etc.) | `app/lib/compile/product-tokens.ts` |
| page-template integration of token replacement | `app/lib/compile/page-template.ts` |
| Compile-time validation (product page → productId required) | `app/lib/compile/compile.ts` |
| Publish route binds product via `templateSuffix` (only on first publish or when out-of-sync) | `app/routes/app.api.pages.$id.publish.ts` |
| Unpublish route restores `previousTemplateSuffix` | `app/routes/app.api.pages.$id.unpublish.ts` |
| Editor loader fetches product; editor wraps in `ProductContext.Provider` | `app/routes/app.pages.$id.tsx` |
| Canvas passes `product` only to `productAware` sections | `app/components/editor/Canvas.tsx` |
| Product picker (App Bridge `shopify.resourcePicker`) | `app/components/editor/ProductPicker.tsx` |
| Create-page modal: type select + product picker | `app/routes/app._index.tsx` |
| 7 product-page tests + 8 product-token tests | `app/lib/compile/__tests__/{product-page,product-tokens}.test.ts` |
| Product token reference doc | `docs/product-tokens.md` |
| Manual smoke + variant-picker storefront protocol | `scripts/p1e-segment1-smoke.md` |

### Sections marked `productAware: true`

- `hero` — heading, subheading, ctaLabel can use product tokens.
- `image-text` — heading, body, ctaLabel, imageAlt.
- `product-details` — addToCartLabel.

**Total sections: 13** (twelve from P1.B + the new Product details).

### Architectural moment: variant picker

The Product details section's `toLiquid` emits Shopify's standard
custom-element pattern. Dawn/Sense/Studio/Refresh/Spotlight all
implement `<variant-radios>` / `<variant-selects>` as custom
elements that read the variants JSON and update price/image/URL on
change. **We don't ship the JS — the theme does.**

The variant picker working on the storefront is the architectural
proof for this segment. **It cannot be agent-tested.** The smoke
script's step 6 is the gate.

### Verification of the four architectural commitments

| # | Commitment | Status after P1.E segment 1 |
|---|------------|---|
| 1 | Pages keep rendering after uninstall | ✅ Unchanged. Compiled section file + JSON template live in the theme; uninstall doesn't touch them. Product binding via `templateSuffix` is reversible — unpublish restores the previous suffix without deleting our files. |
| 2 | No runtime JS injection from our servers | ✅ Variant interaction is theme-JS-driven. We emit the standard markup; the theme already has the JS. The Pricing toggle carve-out (~15 lines, opt-in, scoped) is unchanged. |
| 3 | Pages survive theme updates | ✅ Unchanged from P1.D segment 5. The `themes/publish` webhook still flags the page; re-publish updates the new theme's templateSuffix on the bound product. |
| 4 | Stop if violating 1–3 | ✅ Unpublish never deletes; previousTemplateSuffix preserved across unpublish. Token replacement runs only on text/richtext fields (narrow allowlist). |

### Test coverage

`product-tokens.test.ts` — **8 / 8 green**: token replacement,
diagnostics for unknowns, idempotency on edge cases.

`product-page.test.ts` — **7 / 7 green**: section emission, `{% if
product %}` guard, page-template binding, determinism, productId
validation, token expansion in productAware sections, no expansion
on landing pages.

**Project total: 109 / 109 green** (15 new + 94 from P1.D segment 5).

### Architectural concerns surfaced

1. **`write_products` scope added.** Existing dev-store installs need
   to re-authorize (Shopify will prompt automatically on next admin
   load).

2. **Variant picker depends on theme JS implementing
   `<variant-radios>` / `<variant-selects>`.** Dawn / Sense / Studio
   / Refresh / Spotlight all do as of 2025. Older themes may need a
   page reload for variant changes. Documented as a code comment in
   `product-details/toLiquid.ts`. P2 builds a compatibility matrix.

3. **`previousTemplateSuffix` is best-effort.** If another app
   changes the templateSuffix between our first publish and our
   unpublish, we restore to whatever was there at OUR first publish.
   Better than blanking; not perfect.

4. **Deprecated GraphQL fields** (`Product.featuredImage`,
   `Product.images`, `ProductVariant.image`) still used. Shopify
   marks them deprecated in favor of `media`. Migration is a
   post-P1.E cleanup that adds video support.

5. **The "Insert product data" UX affordance was deferred.**
   Mentioned in the spec as a small `<s-link>` in text/richtext
   field renderers. Plumbing section + page context to the field
   renderer is non-trivial; not on the critical path. Merchants can
   type tokens manually; `docs/product-tokens.md` lists them.

6. **Token replacement is text/richtext only** — narrow allowlist
   prevents accidental tokenization of color hex strings or URL
   paths.

7. **The variant-picker storefront test cannot be agent-run.** Like
   P1.D's uninstall test, the architectural moment lives with the
   merchant.

### Storefront variant picker test result

> Spec asked: "Tell me what you changed and the result of the
> storefront variant picker test specifically."

**The agent cannot answer this.** Running the test requires a real
dev store, a real product, a modern theme, and a real browser
clicking variant options. The smoke script at
`scripts/p1e-segment1-smoke.md` step 6 is the protocol; result
template at the bottom. Merchant runs it; result lives there.

### Known follow-ups carried into P1.E remaining segments

- "Insert product data" UX affordance in text/richtext field
  renderers (deferred from this segment).
- Per-variant content authoring (segment 2 per the spec).
- Migrate from deprecated `featuredImage` / `images` to `media`
  (post-P1.E cleanup; adds video support).
- Multilingual / Translate & Adapt integration.
- RTL polish across all 13 sections.
- Internal dogfood — Demeurer's marketing site on Demeurer.

---

## P1.D — The compile step — ✅ COMPLETE (code) 2026-05-04 — exit gate BLOCKED ON MERCHANT

The architectural commitment is real: pages compile to native Liquid
section files in the merchant's theme; they survive uninstall, theme
switches, and manual edits. The full compile→drift→write→merchant-UI
pipeline is in place across five segments (1: compile, 2: drift,
3: writer + apply, 4: merchant publish flow, 5: theme-update recovery
+ exit gate).

### What the exit gate verifies (`scripts/p1d-exit-gate.md`)

| Section | Items | Who runs |
|---|---|---|
| Architectural commitment verification | 7 (uninstall on Dawn + 24h delay; no JS; theme switch + recovery; Lighthouse) | merchant |
| Publish flow verification | 11 (idempotency, drift, partial failure, lock contention, first-publish modal) | merchant |
| Recovery verification | 4 (themeMismatch flagging, banner, bulk re-publish with deliberate failure) | merchant |
| Destruction resistance | 6 (manual file deletion + edit; drift catches both) | merchant |
| Regression | 3 (P1.A chaos, P1.B catalog, P1.C responsive overrides round-trip) | merchant |
| Code-side checks | typecheck, tests, dev-tool gating, logging audit, prisma format, migrations | **agent (PASS)** |

The merchant runs the manual sections; results go into the template
at the bottom of the script.

### Result template (paste here after running the exit gate)

```
P1.D exit gate run on YYYY-MM-DD by ____________.

Architectural test on Dawn:                                 PASS / FAIL
Architectural test on second theme (_____________):         PASS / FAIL
Theme-switch + re-publish flow:                             PASS / FAIL
Lighthouse mobile (kitchen sink) Performance:               __ / 100
Lighthouse mobile vs baseline gap:                          __ points
Publish flow verification:                                  __ / 11 PASS
Recovery verification:                                      __ / 4  PASS
Destruction resistance:                                     __ / 6  PASS
Regression:                                                 __ / 3  PASS

Notes / failures:
  -

Decision: SHIP P1.D / DIAGNOSE FAILURES BEFORE SHIPPING
```

---

## P1.D segment 5 — exit-gate verification + theme-update recovery ✅ COMPLETE (code) 2026-05-04

The final segment of P1.D. Closes the loop on theme switches and
delivers the comprehensive exit-gate protocol.

### What's in place

| Area | Path |
|------|------|
| `themeMismatch` column on `Page` + migration | `prisma/schema.prisma`, `prisma/migrations/20260504181241_add_theme_mismatch/` |
| `themes/publish` webhook handler (marks stale pages) | `app/routes/webhooks.themes.publish.tsx`, `app/lib/theme/webhook-themes-publish.ts` |
| `themes/update` webhook stub (drift catches divergence) | `app/routes/webhooks.themes.update.tsx` |
| Publish route clears `themeMismatch` on success | `app/routes/app.api.pages.$id.publish.ts` |
| Acknowledge-mismatch (Dismiss) API | `app/routes/app.api.pages.$id.acknowledge-mismatch.ts` |
| Editor banner with Re-publish + Dismiss | `app/components/editor/ThemeMismatchBanner.tsx` |
| Pages list — `⚠ Different theme` badge + top-of-app warning | `app/routes/app._index.tsx` |
| Bulk re-publish page (sequential, per-page failure isolated) | `app/routes/app.pages.theme-mismatch.tsx` |
| Webhook handler tests (8 scenarios) | `app/lib/theme/__tests__/webhook-themes-publish.test.ts` |
| Comprehensive exit gate protocol | `scripts/p1d-exit-gate.md` |
| Lighthouse benchmark template | `scripts/lighthouse-benchmark.md` |
| Public-facing engineering doc | `docs/architecture-commitments.md` |

### Theme-switch recovery flow

1. Merchant publishes a page (themeId = Dawn's gid).
2. Merchant switches MAIN theme to Sense.
3. Shopify fires `themes/publish` webhook with the new theme's
   numeric id.
4. Handler resolves `gid://shopify/OnlineStoreTheme/{id}` and runs
   `db.page.updateMany` to flag every published page on a different
   theme.
5. Pages list shows `⚠ Different theme`. Editor shows the banner.
6. Merchant clicks Re-publish; standard publish flow runs against
   the new MAIN. `Page.themeMismatch` clears, `themeId` updates.
7. Old theme A still has its Demeurer files — never deleted. If the
   merchant ever switches back, the page on theme A still works.

### Test coverage

`app/lib/theme/__tests__/webhook-themes-publish.test.ts` —
**8 / 8 green**: stale pages flagged, on-theme pages skipped,
unpublished/never-published untouched, malformed/null payloads
no-op, cross-shop isolation, numeric-string id defensiveness.

**Project total: 94 / 94 green** (8 new + 86 from segment 4).

### Logging audit (per spec task 9)

Verified: no merchant page content, file content, or input beyond
shop domain is logged at any level. Webhook handlers log topic +
shop (operationally useful). Error paths log error objects only.
Documented in `docs/architecture-commitments.md` for the record.

### Architectural concerns surfaced

1. **The exit gate cannot be agent-run.** The architectural,
   Lighthouse, and theme-switch tests require a real dev store +
   manual install/uninstall + multiple themes. Script is
   comprehensive; results live with the merchant.
2. **`themes/publish` webhook payload shape is inferred** from
   Shopify's REST webhook conventions (`id` numeric). Handler is
   defensive: malformed payload → no-op. Drift detection on next
   publish is the safety net regardless.
3. **Bulk re-publish is sequential, client-side** — reuses the
   single-page publish route. All guardrails (drift, lock,
   ThemeWrite, Publish row) apply unchanged.
4. **No automatic re-publish.** Even with the webhook detecting a
   mismatch, we never write to the new theme without merchant
   action. Auto-rewriting would surprise them.
5. **Dismiss semantics**: clears `themeMismatch` for one page only.
   The merchant has decided to leave it on the old theme; if they
   ever switch again, the webhook re-flags. They can revert by
   clicking Re-publish.

### What's NOT yet built (carried into P1.E)

- **Variant-aware product page support** — product templates need
  variant context.
- **Translate & Adapt integration** — multi-language hooks.
- **RTL polish** — CSS audit across all 12 sections.
- **Internal dogfood** — rebuilding Demeurer's marketing site on
  Demeurer.

P1.E is the final P1 phase, focused on product-page specifics and
launch polish. After P1.E, P2 (private beta) can begin.

---

## P1.D segment 4 — merchant-facing publish flow ✅ COMPLETE (code) 2026-05-04

The product surface for everything segments 1–3 built. Merchants can
now publish, unpublish, see drift warnings with inline diffs, retry
partial failures, and audit publish history — all from inside the
editor. The first time they publish, a brief modal surfaces the
architectural commitment as a moment of delight.

### What's in place

| Area | Path |
|------|------|
| `Publish` model + migration | `prisma/schema.prisma`, `prisma/migrations/20260504175040_add_publishes/` |
| Client publish-flow state machine | `app/lib/editor/publish-flow.ts` |
| `useAutosave` extended with `saveNow()` | `app/lib/editor/useAutosave.ts` |
| Publish button + status line | `app/components/editor/PublishButton.tsx` |
| Pre-publish dialog (none/minor + major variants with inline `<SimpleDiff>`) | `app/components/editor/PrePublishDialog.tsx` |
| Publish progress (in-flight banner + success/partial/auth/error surfaces) | `app/components/editor/PublishProgress.tsx` |
| Action menu (View page / Copy URL / Theme editor deep link / History / Unpublish) | `app/components/editor/PublishMenu.tsx` |
| Publish history drawer | `app/components/editor/PublishHistory.tsx` |
| First-publish onboarding modal | `app/components/editor/FirstPublishModal.tsx` |
| Unpublish confirmation | `app/components/editor/UnpublishConfirm.tsx` |
| Publish-history API route | `app/routes/app.api.pages.$id.publishes.ts` |
| Publish route extended: inserts `Publish` row + returns `firstPublish` flag | `app/routes/app.api.pages.$id.publish.ts` |
| Pages list with "View live" affordance for published pages | `app/routes/app._index.tsx` |
| Publish-flow tests (8 scenarios) | `app/lib/editor/__tests__/publish-flow.test.ts` |

### Three button shapes (per spec)

- **Unpublished** → primary `Publish page`
- **Published, clean** → outline `Published` + `▾` menu trigger
- **Published, dirty** → primary `Update page` + `▾` menu trigger

Status line below shows relative time (`Published 2 minutes ago`),
unsaved-changes count, or current flow stage (`Saving…` /
`Checking…` / `Publishing…`).

### Pre-publish dialog gating

- `severity: none / minor` — brief confirm summary (file count by
  type, optional orphan note, theme name with the
  "Publishing to a different theme is coming soon" affordance per
  the spec).
- `severity: major` — drift warning with one row per drifted file +
  inline `<SimpleDiff>` (lazy-loaded via `/drift/diff`). Three
  buttons: **Cancel**, **Keep theme version, abort**, **Replace with
  my Demeurer version**.

### Result handling

- `success` → toast banner with auto-dismiss + `View page` link;
  reload after 1.5s to refresh `publishedAt` / `themeId`.
- `partial_failure` → modal listing failed paths with `Retry` (calls
  `confirm(true)` since the partial state is now drift on retry).
- `auth_error` → critical banner with `Refresh` button.
- `error` → critical banner with `Retry` + technical message.
- `drift_blocked` mid-confirm → bounces back to the drift dialog
  with the latest report.

### `Publish` row insertion

Every terminal publish attempt (success or partial_failure) inserts
a `Publish` row with `themeId`, `themeName`, `status`, `fileCount`,
`artifactSourceVersion`, and `failedPaths` (JSON array, null on
success). Pre-flight aborts (`drift_blocked` / `auth_error`) are NOT
recorded — nothing was written.

The "first publish" gate: `db.publish.count({ where: { shop } })` is
captured BEFORE the publish; if zero, the response includes
`firstPublish: true` and the editor pops `FirstPublishModal`.

### Verification of the four architectural commitments

| # | Commitment | Status after P1.D segment 4 |
|---|------------|---|
| 1 | Pages keep rendering after uninstall | ✅ Code-side: unchanged from segment 3. Unpublish copy now makes the no-delete commitment visible to the merchant. The first-publish modal makes the no-vendor-lock-in promise explicit. |
| 2 | No runtime JS injection from our servers | ✅ All publish UI is admin-only React; never reaches the storefront. |
| 3 | Pages survive theme updates | ✅ Unchanged from segment 3. |
| 4 | Stop if violating 1–3 | ✅ Unpublish never deletes. Drift is never auto-resolved (UI surfaces the diff and waits for the merchant's decision). |

### First-publish modal — exact rendered text + ASCII layout

(Per the spec's request to deliver this for review without a screenshot.)

```
┌─────────────────────────────────────────────────────────┐
│  🎉  Your page is live!                                  │
│                                                          │
│  Here's something we want you to know:                   │
│                                                          │
│  The page you just published is now part of your theme.  │
│  That means if you cancel Demeurer, your page keeps      │
│  working. No vendor lock-in. The pages you create with   │
│  Demeurer are yours to keep.                             │
│                                                          │
│  You can audit the files Demeurer created at any time:   │
│    Online Store → Themes → Edit code →                   │
│    look for files starting with `demeurer-`.             │
│                                                          │
│                                          [  Got it  ]    │
└─────────────────────────────────────────────────────────┘
```

The 🎉 in the heading is the only emoji in the entire app. Lives in
`app/components/editor/FirstPublishModal.tsx` if you want to tweak.

### Architectural concerns surfaced

1. **Schema migration applied in dev.** Production needs `npx prisma
   migrate deploy` before this segment ships.
2. **The "first publish" gate is per-shop, not per-user.** If two
   users on the same shop have never seen it, only the first
   publisher sees it. Acceptable for MVP — this is positioning copy,
   not a tutorial.
3. **`<s-link>` doesn't accept `target` / `rel`.** Used native `<a>`
   with `className="demeurer-view-live-link"` for storefront links.
4. **Polaris `<s-menu>` not in the type defs.** The action menu is a
   small custom CSS popover (`.demeurer-publish-menu`) that closes
   on outside-click and Escape.
5. **`useAutosave.saveNow()` failure is a hard stop.** The publish
   flow surfaces "Couldn't save before publishing" and aborts before
   touching `/drift` or `/publish`.
6. **No `@testing-library/react` in deps.** UI rendering correctness
   is covered by the merchant's manual smoke (segment 3's
   `scripts/p1d-segment3-smoke.md` extended with publish-UI steps).
   The data layer + state machine are covered by 86 tests.
7. **Theme editor deep link** uses the numeric portion of the
   Shopify gid (`gid://shopify/OnlineStoreTheme/123` → `123`). If
   the gid format ever changes, the deep link breaks gracefully (it
   still opens Shopify admin's themes section).
8. **Successful publish auto-reloads after 1.5s** to refresh the
   loader's `publishedAt` / `themeId` data. Simpler than wiring
   React Router `revalidate`, and the merchant just saw the success
   banner.

### Test coverage

`app/lib/editor/__tests__/publish-flow.test.ts` — **8 / 8 green**:

1. `idle → saving → checking_drift → confirm` (severity: none).
2. `confirm + acceptDrift=false → publishing → success`.
3. `saveNow` rejection → `error` stage.
4. Drift HTTP error → `error` stage.
5. 207 partial → `partial` stage.
6. 401 auth → `auth_error` stage.
7. 409 drift mid-confirm → bounces back to `confirm` with the new
   report; second `confirm(true)` succeeds.
8. `cancel()` returns to `idle`.

**Project total: 86 / 86 green** (8 new + 78 from segment 3).

### Manual UI smoke (lives with the merchant)

The architectural test from segment 3 is still the go/no-go gate
(`scripts/p1d-segment3-smoke.md` step 12). Segment 4 adds these UI
verifications to the same script (in your dev store):

- Open an unpublished page → primary `Publish page` button visible.
- Click → pre-publish dialog summarizing what will happen.
- Confirm → publishing banner → success toast with `View page` link.
- Visit storefront URL → page renders.
- First-publish modal appeared (only on the very first publish).
- Edit page → button transitions to `Update page`.
- Update → success in 2–5s.
- Manually edit a Demeurer file in the theme code editor.
- Click Publish → drift dialog appears with `View changes` link.
- `View changes` expands the inline diff.
- Choose `Replace with my Demeurer version` → success.
- Open `Show publish history` from the menu → see the attempts.
- Unpublish from the menu → confirmation modal → success.
- Pages list shows Published/Draft badges + `View live ↗` link.

### Known follow-ups

- `themes/publish` + `themes/update` webhook handlers (re-write
  Demeurer files when the merchant switches themes).
- Preview against unpublished/draft themes.
- Redis-backed publish lock (multi-region).
- Polaris `<s-menu>` migration if/when it lands in the type defs.

---

## P1.D segment 3 — theme writer + publish pipeline ✅ COMPLETE (code) 2026-05-04 — architectural test BLOCKED ON MERCHANT

The **write side** of the Themes API integration. Pages now land in
the merchant's theme as real Liquid files via Shopify's
`themeFilesUpsert` mutation, with idempotent writes, per-file write
tracking (`ThemeWrite` rows), drift gating, and phase-ordered apply
that keeps the storefront renderable through partial failures.

This is the segment where the architectural commitment — *"the
merchant uninstalls Demeurer; the page keeps rendering"* — becomes
testable end-to-end. The agent cannot exercise that test (it requires
a real dev store + manual install/uninstall + storefront URL visits).
**The result lives with the merchant.** The protocol is at
`scripts/p1d-segment3-smoke.md`, step 12.

### What's in place

| Area | Path |
|------|------|
| Theme writer (`themeFilesUpsert` wrapper, error classification) | `app/lib/theme/writer.server.ts` |
| Apply pipeline (drift → batched write → ThemeWrite) | `app/lib/compile/apply.ts` |
| Per-page publish lock (in-memory, single-process) | `app/lib/compile/publish-lock.server.ts` |
| Publish API route | `app/routes/app.api.pages.$id.publish.ts` |
| Unpublish API route (no theme deletes — never destroys) | `app/routes/app.api.pages.$id.unpublish.ts` |
| Mock admin extended with `themeFilesUpsert` handler | `app/lib/theme/__mocks__/admin.ts` |
| Writer tests (5 scenarios) | `app/lib/compile/__tests__/writer.test.ts` |
| Apply tests (7 scenarios) | `app/lib/compile/__tests__/apply.test.ts` |
| Manual smoke + architectural uninstall protocol | `scripts/p1d-segment3-smoke.md` |

### Phase ordering — the key correctness property

Section files first → snippets → page template **last**. If a section
write fails mid-publish:

- The **old page template still references the previous-version
  sections (which still exist)**, so the storefront stays renderable.
- The new page template is never written until every section it
  references is confirmed in place.
- Segment 2's drift detection picks up where the failed publish left
  off: previously-written files are `tracked` (recorded in
  `ThemeWrite`, theme matches our last write) so a retry skips them
  and finishes the remaining batch.

The Themes API has **no multi-file transaction**. Determinism (segment
1) + per-file write tracking (segment 2) + phase ordering (segment 3)
are our substitute. Documented in `app/lib/compile/apply.ts`'s
top-of-file comment.

### Drift gating

Every publish runs the segment 2 drift check first:

- `severity === "major"` (a `drifted` file — manual edit detected) →
  HTTP 409 `{ ok: false, reason: "drift", report, severity }`.
  Nothing is written.
- The merchant retries with `{ "acceptDrift": true }` to overwrite.
- `severity === "minor"` (orphans only, or `stale`) and `none` proceed
  to write.

`tracked` modifications (the normal "merchant edited the page,
publishes again" path) don't contribute to severity — segment 2's
deliberate three-classification design pays off here.

### Concurrency

In-memory per-`(shop, pageId)` lock at
`app/lib/compile/publish-lock.server.ts`. A second concurrent publish
for the same page gets HTTP 409 `publish_in_progress`. Single-process
only — multi-region deployments will need a Redis-backed advisory
lock. Limitation documented.

### `Page.publishedAt` and `Page.themeId`

Both fields populated only on **full success**. On `partial_failure`
the merchant retries; we don't lie about state. `themeId` records the
theme the page lives on so a future `themes/publish` webhook handler
(post-segment-4) can reconcile after theme switches. `unpublish`
clears `publishedAt` but **never deletes theme files** and
**preserves** `themeId`.

### Verification of the four architectural commitments

| # | Commitment | Status after P1.D segment 3 |
|---|------------|---|
| 1 | Pages keep rendering after uninstall | **TESTABLE** — `scripts/p1d-segment3-smoke.md` step 12 is the gate. Code-side: `webhooks.app.uninstalled.tsx` deletes only Session; ThemeWrite + Page + PageVersion + theme files are intentionally untouched. |
| 2 | No runtime JS injection from our servers | ✅ Writer is server-side only; no JS is ever sent to a storefront. The Pricing toggle carve-out (~15 lines, opt-in, scoped) is unchanged from P1.B. |
| 3 | Pages survive theme updates because they ARE the theme | ✅ Writes go to the merchant's published theme directly. `Page.themeId` records where; segment 4's webhook will rewrite into newly-published themes. |
| 4 | Stop if violating 1–3 | ✅ Unpublish never deletes; orphans are never deleted; drift is never auto-resolved (merchant must opt-in). |

### Architectural concerns surfaced

1. **`themeFilesUpsert` requires an exemption from Shopify** beyond
   the `write_themes` scope. Per Shopify's docs. If the dev store
   doesn't have the exemption, every publish returns `auth_error`
   regardless of correctness. The smoke script's step 4 is where this
   would surface.
2. **No multi-file transaction.** Phase ordering + idempotency + drift
   tracking cover it. Retry after partial failure picks up cleanly.
3. **In-memory lock is single-process only.** Redis advisory lock
   replacement is a known follow-up.
4. **`Page.publishedAt` is set only on full success.** Intentional
   honesty.
5. **Mock-based `ThemeWrite` testing via dependency injection.**
   `applyArtifact` accepts a `ThemeWriteStore` interface; tests pass
   a small in-memory stub. Production passes the real prisma client.
6. **The architectural uninstall test cannot be agent-run.** Lives
   with the merchant. Result template at the bottom of the smoke
   script.

### Test coverage

`app/lib/compile/__tests__/writer.test.ts` — **5 / 5 green**:
1. Single file success carries Shopify's `checksumMd5`.
2. 15 files batch into two GraphQL calls (10 + 5).
3. Per-file `userError` doesn't poison the rest of the batch.
4. HTTP 401 maps every file in the batch to `errorCode: "auth"`.
5. `bad_content` classification covers `TOO_LARGE`.

`app/lib/compile/__tests__/apply.test.ts` — **7 / 7 green**:
1. Empty theme + new page → all written, `ThemeWrite` populated.
2. Re-publish unchanged → 0 writes, all skipped.
3. Drift on a section, no `acceptDrift` → `drift_blocked`, nothing
   written.
4. Drift + `acceptDrift: true` → overwrite, `ThemeWrite` updated.
5. Section write fails → phase B + C skipped, `partial_failure`.
6. Lock contention → second concurrent call throws
   `PublishInProgressError`.
7. Phase ordering — sections written before templates.

**Project total: 78 / 78 green** (12 new + 66 from segment 2).

### Manual smoke status

`scripts/p1d-segment3-smoke.md` is ready. Steps 1–11 + step 12 (the
architectural test) are the merchant's protocol. **Result fields
empty** until the merchant runs it. The architectural test is the
go/no-go gate.

### Known follow-ups carried into segment 4

- Publish UI (button + drift confirmation modal). Currently the smoke
  script uses curl.
- `themes/publish` + `themes/update` webhook handlers (re-write
  Demeurer files into newly-published themes).
- Preview against unpublished/draft themes.
- Redis-backed publish lock (multi-region).

---

## P1.D segment 2 — theme reads + drift detection ✅ COMPLETE 2026-05-04

Read side of the Themes API integration: fetch current Demeurer-owned
files from the merchant's published theme, compute a diff against a
fresh compile artifact, classify each file, and surface a severity
assessment. **No theme writes yet** — the Asset API mutation is
segment 3. This drift layer is the safety net that makes those writes
safe.

### What's in place

| Area | Path |
|------|------|
| Theme GraphQL client (getPublishedTheme, listDemeurerFiles, readThemeFile, readThemeFiles) | `app/lib/theme/client.server.ts` |
| Per-shop rate limiter (concurrency cap + cost-aware backoff + 429 retry) | `app/lib/theme/rate-limiter.server.ts` |
| Mock admin client for tests | `app/lib/theme/__mocks__/admin.ts` |
| md5 hex helper (Shopify-compat) | `app/lib/compile/md5.ts` |
| Drift detector | `app/lib/compile/drift.ts` |
| Conflict severity classifier | `app/lib/compile/conflict-severity.ts` |
| API route — drift report | `app/routes/app.api.pages.$id.drift.ts` |
| API route — per-file diff content | `app/routes/app.api.pages.$id.drift.diff.ts` |
| SimpleDiff renderer (hand-rolled, ~80 lines) | `app/components/editor/SimpleDiff.tsx` |
| Drift panel (dev-only modal, mirrors CompiledOutput pattern) | `app/components/editor/DriftPanel.tsx` |
| ThemeWrite model + migration | `prisma/schema.prisma`, `prisma/migrations/20260504143612_add_theme_writes/` |
| Drift tests (8 scenarios + caching) | `app/lib/compile/__tests__/drift.test.ts` |

### Drift classification — three categories

A modified file (artifact md5 ≠ theme md5) is one of:

- **`drifted`** — `ThemeWrite` says we last wrote hash X, theme now has
  hash Y ≠ X. Manual edit detected. Severity: **major** (publish UI
  requires explicit acknowledgment).
- **`tracked`** — `ThemeWrite` hash === theme hash. The artifact is just
  newer than the published version — normal publish path. Severity
  contribution: **none**.
- **`stale`** — no `ThemeWrite` record. We can't prove the merchant
  didn't edit, so we err conservative. Severity: **minor** (soft
  warning). Common on the very first publish before segment 3 starts
  populating records.

The plan originally had only `drifted` and `stale`; I added `tracked` to
prevent every routine post-first-publish run from triggering "minor"
severity. Documented in the implementation report.

### Hash convention

Shopify's GraphQL `checksumMd5` is the source of truth for theme-side
file content fingerprints. Drift detection computes md5 of artifact
content on the fly to compare. The compile artifact's `contentHash`
(sha256, P1.D segment 1) stays as is for snapshot tests + internal
idempotency. **Two hash fields, intentionally** — md5 for Shopify
compat, sha256 for internal use.

**No content normalization** in segment 2. We md5 the exact string the
compile pipeline emits. Test scenario 7 documents that a `\r\n` line
ending in the theme today flags the file as drifted; if this surfaces
false positives in the dev store, we add a normalization layer.

### Verification of the four architectural commitments

| # | Commitment | Status after P1.D segment 2 |
|---|------------|---|
| 1 | Pages keep rendering after uninstall | ✅ This segment is read-only — never touches a theme file. |
| 2 | No runtime JS injection from our servers | ✅ Drift detection is server-side. Drift panel is dev-only and gated `!import.meta.env.PROD`. |
| 3 | Pages survive theme updates because they ARE the theme | ✅ The whole point of drift detection: we compare against the live theme so segment 3's writes can be conservative. |
| 4 | Stop if violating 1–3 | ✅ No deletes of orphan files, ever. The merchant's manual edits are surfaced, never overridden silently. |

### Trade-offs accepted

1. **md5 vs sha256.** Shopify's `checksumMd5` forces md5 for theme
   compat. Compile artifact keeps sha256 for snapshot tests. Two hash
   fields by design.
2. **Hash normalization deferred.** Will surface in manual verification
   if the dev store returns content with mixed line endings.
3. **`ThemeWrite` is empty until segment 3.** Every modification before
   then is `stale`. Once segment 3 ships, the table fills and the
   `tracked` / `drifted` distinction becomes the common case.
4. **Mock admin design — switching on operation name in the query
   string is fragile.** Works for our three queries; if theme client
   grows, migrate to a richer mocking approach.
5. **Rate limiter is best-effort.** Per-shop concurrency cap + 429
   retry with exponential backoff + cost-aware preemptive backoff.
   Real production wants per-tenant queues + observability.

### Test coverage

`app/lib/compile/__tests__/drift.test.ts` — **8 / 8 green**:

1. Empty theme → all `new`.
2. Theme matches artifact → all `unchanged`.
3. One differs, no record → `stale`.
4. One differs, record ≠ theme → `drifted` (major).
5. One differs, record === theme → `tracked` (none).
6. Theme has extra demeurer files → orphans (minor).
7. CRLF line ending → flagged as drift (documents the trade-off).
8. Caching: list query reuses 30-second per-(shop, themeId) cache.

**Project total: 66 / 66 green** (8 new + 58 from segment 1).

### Known follow-ups carried into segment 3

- Asset API client + `themeFilesUpsert` mutation.
- `ThemeWrite` row insertion on every successful write.
- Idempotent overwrite (skip writes when artifact md5 matches theme
  md5).
- Rollback strategy for partial-failure writes.
- Hash normalization layer if drift testing surfaces false positives.

---

## P1.D segment 1 — compile pipeline ✅ COMPLETE 2026-05-04

Pure-functional compile from `Page` document → `CompileArtifact`
(in-memory file set). No theme writes yet (segment 2). The artifact
follows the **shared-section-file** model: one
`sections/demeurer-{type}.liquid` per used section type, one
`templates/{page|product}.demeurer-{handle}.json` per page.

### The architectural shift

Before this segment, every page got one section file per block, with
per-block scope CSS, hero values, and overrides all baked into the
Liquid template (P1.B/P1.C `toLiquid` chain). After this segment, every
section TYPE owns one shared, parameterless Liquid file. Per-page
customization rides in `templates/page.demeurer-{handle}.json`, which
calls the section once per block and supplies its values via
`section.settings`. Responsive CSS rides along as compile-time-baked
`mobile_styles` / `tablet_styles` / `desktop_styles` settings consumed
by a `{% style %}` block in the shared section file.

The legacy per-block `toLiquid` functions in `app/lib/sections/<type>/`
are intentionally left intact as a working reference, but are no longer
on the publish path.

### What's in place

| Area | Path |
|------|------|
| Compile types (`CompileArtifact`, `CompiledFile`, `Diagnostic`, etc.) | `app/lib/compile/types.ts` |
| sha256 hex helper | `app/lib/compile/hash.ts` |
| Stable JSON serializer | `app/lib/compile/stable-json.ts` |
| Editor `Field` → Shopify schema mapping | `app/lib/compile/settings-schema.ts` |
| `PropsByBreakpoint` → 4 baked CSS strings | `app/lib/compile/responsive-settings.ts` |
| Per-section template registry (12 sections) | `app/lib/compile/section-templates/{hero,cta-band,image-text,feature-list,logo-wall,testimonial,faq,pricing,video,form,spacer,html}.ts` + `index.ts` |
| Page template builder | `app/lib/compile/page-template.ts` |
| Compile orchestrator | `app/lib/compile/compile.ts` |
| Compile API endpoint | `app/routes/app.api.pages.$id.compile.ts` |
| Editor "Show compiled output (dev)" modal | `app/components/editor/CompiledOutput.tsx` (gated on `!import.meta.env.PROD`) |
| Snapshot tests + 5 fixtures + determinism + product-page assertion | `app/lib/compile/__tests__/` |
| Contract docs | `docs/compile.md` |

### Determinism is non-negotiable

- Section template strings are static literals.
- Object keys sorted at every level via `stableStringify`.
- Files sorted by path in the artifact.
- No timestamps / ids / environment data inside any file's content —
  `compiledAt` lives on the artifact, never in a file.
- Settings record built in fixed schema order; compile-only settings
  appended in fixed order.

The snapshot test suite includes an explicit "compile twice, hashes
match" assertion. **58 / 58 tests green** (10 new + 48 from P1.C).

### The five compile-only settings

Every section's `{% schema %}` declares (after schema-derived settings)
`scope_id`, `mobile_styles`, `tablet_styles`, `desktop_styles`,
`visibility_styles`. All `info: ""` to keep them present in code but
unobtrusive in the theme editor. The page template fills them; humans
never touch them.

### Verification of the four architectural commitments

| # | Commitment | Status after P1.D segment 1 |
|---|------------|---|
| 1 | Pages keep rendering after uninstall | ✅ Every emitted file is a standalone, hand-readable Liquid section or JSON template. Demeurer can disappear; the storefront keeps rendering from the same files. |
| 2 | No runtime JS injection from our servers | ✅ Every responsive override is baked compile-time CSS inside the section's `{% style %}` block. The Pricing billing-toggle carve-out (~15 lines, opt-in) is unchanged. |
| 3 | Pages survive theme updates because they ARE the theme | ✅ Section + template files live in `sections/` and `templates/` of whatever theme the merchant is on; no sandboxed copy. (Actual writes still pending — segment 2.) |
| 4 | Stop if violating 1–3 | ✅ The compile pipeline is pure-functional with no IO; impossible to violate inadvertently. |

### Trade-off accepted in segment 1

P1.C used `mobileLiquid` so a merchant could nudge a Hero's padding from
the Shopify theme editor without redeploying from Demeurer. After
segment 1, mobile values are baked into `mobile_styles`; theme-editor
edits to spacing/colors are ignored until republish from Demeurer.
Text/image/url settings remain live (they go through
`{{ section.settings.X }}`). Documented in `docs/compile.md` as the
convention.

### Known follow-ups carried into segment 2

- Theme-side reads + diff against `CompileArtifact` for idempotent
  publish.
- Asset API client (the actual write).
- Webhook handlers for `themes/update` / `themes/publish`.
- The legacy per-block `toLiquid` chain is dead code on the publish
  path; safe to remove in a dedicated cleanup commit once segment 3
  confirms the new pipeline.

---

## P1.C — Responsive design layer ✅ COMPLETE 2026-05-03

Merchants can now author per-breakpoint overrides on every editable
field of every section. Three fixed breakpoints, mobile-first cascade,
pure CSS media queries — zero JavaScript injection on the storefront.

### Three breakpoints, no fluid scales

- **Mobile** — base layer; canonical values; always present.
- **Tablet** — `min-width: 768px`; sparse override layer.
- **Desktop** — `min-width: 1280px`; sparse override layer.

Container queries / fluid scales / arbitrary user breakpoints are
**explicitly out of scope**. Three is what merchants understand; three
is what we ship. If a section needs a fourth, the helpers won't accept it.

### Mobile-first cascade

Every prop resolves at any breakpoint via cascade: tablet falls through
to mobile if absent; desktop falls through to tablet, then mobile. The
editor stores only the layer the merchant edited — no value duplication.

`PropsByBreakpoint` (in `app/lib/editor/types.ts`):

```ts
{ mobile: Record<string, unknown>;
  tablet?: Record<string, unknown>;
  desktop?: Record<string, unknown>; }
```

`resolveProp` / `resolveProps` (in `app/lib/editor/resolve.ts`) walk
the cascade and return the active value plus its source layer.

### Source badges in the inspector

When the merchant is editing at tablet or desktop, every field shows
a small badge: "From mobile" / "Tablet override" / "Desktop override".
Editing a field at a non-mobile breakpoint writes only to that layer
and surfaces an inline "Apply to all breakpoints" affordance to clear
the override.

### Pure CSS responsive output (no JS)

Every section's `toLiquid` now uses the helpers in
`app/lib/sections/_shared/responsive-css.ts` to emit a `{% style %}`
block with `@media` rules for tablet/desktop overrides. The block is
scoped to a unique class `demeurer-<type>-<blockId>` so per-block
overrides don't leak across the page.

- Mobile values render via inline `style="…"` driven by Liquid
  `section.settings.*` so theme-editor edits stay live for mobile.
- Tablet/desktop overrides bake compile-time and use `!important` to
  win specificity against the inline mobile styles.
- A freshly-built page (no overrides) emits NO `{% style %}` block
  and NO `@media` rules — verified by the unit tests.
- The published Liquid is indistinguishable from a hand-written
  Shopify section. Architectural commitment #2 holds.

### Visibility per breakpoint

`_visibility: false` at any breakpoint hides the section there.
`emitVisibilityCSS` is cascade-aware: it emits a `display: none` rule
only at the breakpoint where visibility CHANGES, never redundantly.
`display: revert !important` at a breakpoint where visibility flips
back from hidden to visible.

### Structural / non-responsive fields

Fields whose semantics break per-device are flagged
`responsive: false` in the schema. The inspector renders them
read-only at tablet/desktop with a "Same on all breakpoints" badge.

| Section | Non-responsive fields |
|---|---|
| Form | `formType`, `fields[]` |
| Custom HTML | `html`, `notes` |
| Spacer | `showDivider`, `dividerColor`, `dividerWidth` |

(Layout-changing select fields like Feature list `layout`, Testimonial
`layout`, Logo wall `layout`, Video `aspectRatio` are also de-facto
non-responsive — their CSS targets inner elements that the shared
helper does not scope to. See `docs/sections.md`.)

### Helpers and tests

`app/lib/sections/_shared/responsive-css.ts` exports:

- `emitResponsiveCSS(scope, propsByBreakpoint, propMap, options?)` —
  emits scope CSS with optional mobile block + tablet/desktop @media
  blocks. Empty string when no overrides AND `includeMobile` is false.
- `emitVisibilityCSS(scope, propsByBreakpoint)` — cascade-aware
  visibility rules.
- `diffOverrides(propsByBreakpoint, breakpoint, keys)` — structural
  equality so SpacingValue / object props compare correctly.
- `wrapStyle(css)` — wraps in `{%- style -%} ... {%- endstyle -%}` or
  returns "" for empty input.
- `scopeClass(sectionType, blockId)` — `demeurer-<type>-<id>` with
  defensive sanitization to `[a-z0-9_-]`.
- `pxValue`, `textAlignLogical` — common transform helpers.

Unit tests at `app/lib/sections/_shared/__tests__/responsive-css.test.ts`
exercise the cascade, structural equality, redundant-override
deduplication, visibility cascade semantics, mobileLiquid pass-through,
and the freshly-built-page exit-gate criterion. **48 / 48 green.**

### Verification of the four architectural commitments

| # | Commitment | Status after P1.C |
|---|------------|---|
| 1 | Pages keep rendering after uninstall | ✅ All responsive overrides bake into the Liquid section file. After uninstall, the page renders unchanged AND tablet/desktop overrides still apply (they're CSS in the theme, not served by Demeurer). |
| 2 | No runtime JavaScript injection from our servers | ✅ Every responsive override is a plain `@media` rule. No JS-driven breakpoint detection anywhere. The Pricing billing-toggle carve-out (~15 lines, opt-in) remains the only inline JS. |
| 3 | Pages survive theme updates because they ARE the theme | ✅ The `{% style %}` block is part of the section file. A theme update doesn't touch it. |
| 4 | Stop if violating 1–3 | ✅ The helper API enforces this — there is no path to emit JS for responsive behavior. |

### P1.C exit gate

Manual verification protocol at `scripts/p1c-exit-gate.md`. Static
boxes (unit tests, TypeScript, helper semantics, section refactor) are
ticked. Manual rows (editor breakpoint UX, Dawn paste-test, Lighthouse,
post-uninstall verification) sit with the merchant.

### Known limitations carried into P1.D and beyond

- **Layout-changing fields aren't responsive.** Per-breakpoint column
  count for Feature list / Testimonial / Logo wall is not currently
  supported. The helper scopes CSS to the section root only; piping
  declarations into inner elements would require a richer API.
  Documented as a future enhancement.
- **No fluid type scaling.** Heading sizes are mobile-default; merchants
  can override them at tablet/desktop, but there's no `clamp()`-based
  fluid scale. Three breakpoints, period.
- **No container queries.** Same rationale.

---

## P1.B — Section library + the twelve ✅ COMPLETE 2026-05-03

**Section count: 12.** All sections render in the canvas, expose typed property inspectors via `SectionSchema`, compile to native Liquid via `toLiquid`, and survive uninstall. `Page.source` block trees containing any combination of these are now publish-ready (publish flow itself is P1.D).

| Sections (12) | Type | Category | Notes |
|---|---|---|---|
| Hero | `hero` | content | Bg image + heading/sub/CTA. Quality: text-vs-bg contrast, missing heading w/ bg. |
| CTA band | `cta-band` | content | One/two CTAs, full-width. Quality: AA-readable text color. |
| Image + text | `image-text` | content | Two-column. Quality: missing alt → yellow. |
| Feature list | `feature-list` | content | 2/3/4-column tiles, optional icons. |
| Logo wall | `logo-wall` | content | Static row in canvas; marquee in Liquid. |
| Testimonial | `testimonial` | content | Single quote or scroll-snap row of multiple. |
| FAQ | `faq` | content | `<details>`-based accordion (zero JS). |
| Pricing | `pricing` | content | Up to 5 tiers; monthly/yearly toggle (the only JS carve-out). |
| Video | `video` | media | YouTube/Vimeo/Shopify-hosted; no autoplay default. |
| Form | `form` | form | Shopify native `{% form %}` (contact/customer/newsletter). |
| Spacer | `spacer` | layout | Theme `spacing.unit` multiples. |
| Custom HTML | `html` | advanced | Unsanitized; merchant trust contract; always yellow warning. |

### The dual-rendering contract

Every section ships **two rendering paths** — they are not interchangeable, and both are mandatory.

- **`Render.tsx`** — React component. Runs in the editor canvas (and in the `/app/catalog`). Inputs: `props` (from the schema) + `themeTokens` (from `ThemeTokensContext`). Output: JSX. Goal: keystroke-fast preview that approximates the published storefront within the iframe canvas.
- **`toLiquid.ts`** — pure function `(props) → { template, schema, presets }`. Runs at compile time (P1.D). Output: a string of Liquid + a `{% schema %}` block. Goal: a native theme section file the merchant could have written by hand. Survives uninstall, runs on Shopify's CDN, has zero Demeurer footprint.

The two **must produce semantically equivalent output** — same DOM order, same content, same accessibility attributes, same responsive behavior. They differ only in how they get there: React for editing, Liquid for publishing. **Every future section must follow this contract.** Authoring guide: `docs/sections.md`.

Why two paths, not one? Liquid is server-rendered and can't keep up with keystroke editing. React is client-side and can't run on the merchant's storefront after uninstall. So we maintain both and lean on `qualityCheck` + manual paste-tests to catch drift.

### Schema-driven inspectors
`app/lib/sections/types.ts` defines `SectionSchema` + field kinds (text, richtext, color, range, select, image, list-of-tier, list-of-question, list-of-feature, list-of-logo, list-of-testimonial, list-of-field). `Properties.tsx` dispatches via `FieldRenderer` — no per-section UI code in the inspector. New sections only declare schemas; the inspector falls out automatically.

### Section quality indicator
Each section may declare an optional `qualityCheck(props, themeTokens) → SectionQualityIssue[]`. `Properties.tsx` renders a green/yellow/red banner. Wired today: hero (text/bg contrast, missing heading w/ bg image), cta-band (no AA-readable text color), image-text (missing alt), html (always warning per `HTML_WARNING_TEXT`). WCAG AA contrast calculator at `app/lib/sections/_shared/quality.ts`.

### Internal section catalog
`/app/catalog` (dev-only — `process.env.NODE_ENV !== "production"` gates loader, action, and the nav link). Lists all 12 sections grouped by category with icon, label, description, type, scaled-down preview rendered into a 1200×640 frame at 0.25 scale. "Add to a new page" creates a fresh `Page` row seeded with the section's defaults and redirects to the editor — useful for development and as the seed of future App Store screenshot flows.

### Verification of the four architectural commitments

| # | Commitment | Status after P1.B |
|---|------------|---------|
| 1 | Pages keep rendering after uninstall | ✅ Editor still writes only `Page.source` / `PageVersion`; uninstall handler still deletes only `Session`. No section's editor code ever touches a theme. |
| 2 | No runtime JavaScript injection from our servers | ✅ One carve-out: Pricing toggle, ~15 lines, scoped, only emitted when the billing toggle is enabled. Fails closed (yearly state ignored if JS off). All other sections ship zero JS. FAQ is `<details>`. Form is native `{% form %}`. |
| 3 | Pages survive theme updates because they ARE the theme | ✅ `toLiquid` is the canonical output; React renderer is preview-only. Every section's `template` + `{% schema %}` is ready to paste into a Dawn theme as `sections/demeurer-<type>.liquid`. (Automated write is P1.D.) |
| 4 | Stop if violating 1–3 | ✅ Enforced in code review; `docs/sections.md` repeats the rules; quality indicator surfaces drift. |

### Lighthouse status

Real measurement requires the publish pipeline (P1.D). Until then, `scripts/lighthouse-results.md` records *expected* mobile scores per section based on the architecture: 95+ for FAQ/Spacer/Form/Image+text/CTA band/Hero/Logo wall/Testimonial/Feature list/Video (iframe cost flagged)/HTML (merchant-controlled). Pricing's toggle JS is the only sub-95 risk, expected ~94 mobile. Methodology in `scripts/lighthouse-check.md`.

### P1.B exit gate

Manual verification protocol at `scripts/p1b-exit-gate.md`. Statically-verifiable rows (registry & metadata, catalog) are ticked. Rows that require a live embedded session (canvas rendering walk, field renderers, editor regressions, RTL reflow, manual Liquid paste-test in a Dawn theme) cannot be exercised by the agent — they sit with the merchant. Lighthouse remains blocked on the publish flow.

### Known limitations carried into P1.C and beyond
- **Responsive editing is preview-only.** Sections use logical properties + sensible breakpoints, but there's no per-breakpoint property-override UI yet. That's the entirety of P1.C.
- **Liquid output is generated but never published.** `toLiquid` produces validated strings; `compile + theme-write` is P1.D.
- **Custom HTML trusts the merchant.** Unsanitized by design; the trust contract is surfaced via the always-on yellow warning. Flagged "advanced" in the catalog.
- **Carousels and marquees render statically in canvas.** Testimonial scroll-snap and Logo-wall marquee animate only in published Liquid. Canvas shows the first slide / a static row. Interactivity in the editor is post-MVP.
- **Form preview does not actually submit.** Canvas success message is a UI hint; real submission goes through Shopify after publish.

### Performance smoke test (manual protocol)

A heavy 12-section page (one of every type, defaults seeded via the catalog "Add to a new page" button) is the canonical stress test. Targets:

| Metric | Target |
|---|---|
| Editor remains responsive while typing in any inspector field | < 16ms per keystroke (60fps) |
| Iframe canvas reload after a property change | < 800ms |
| Autosave does not queue (no overlapping PATCH requests in DevTools Network) | 1 in-flight max |
| Memory footprint over 10 minutes of editing | < 300MB heap |
| Crash recovery from `localStorage` after `Simulate-crash` | < 1s; banner appears, content restores |

Cannot be exercised by the agent — sits with the merchant during the P1.B manual run.

---

## P1.A — Editor MVP (data-loss-proof) ✅ Complete (code) — exit gate pending manual run

**Delivered:**

| Area | Files |
|------|-------|
| In-memory editor state (Zustand + immer, history/future) | `app/lib/editor/store.ts`, `app/lib/editor/types.ts` |
| Persistence — autosave (debounced PATCH) + crash recovery via localStorage mirror | `app/lib/editor/useAutosave.ts`, `app/lib/editor/recovery.ts`, `app/routes/app.api.pages.$id.ts` |
| Three-pane editor shell (outline / canvas / properties) | `app/components/editor/Outline.tsx`, `Canvas.tsx`, `Properties.tsx`, `app/routes/app.pages.$id.tsx`, `app/styles/editor.css` |
| Save indicator + recovery banner + Cmd+Z/Cmd+Shift+Z shortcuts | `app/components/SaveIndicator.tsx`, `app.pages.$id.tsx` |
| Drag-to-reorder (top-level, dnd-kit; nested deferred to P1.B) | `app/components/editor/Outline.tsx`, `app/lib/editor/dnd.ts` |
| Version history drawer + Save-named-snapshot + Preview/Restore | `app/components/editor/VersionHistory.tsx`, `app/routes/app.api.pages.$id.versions.ts`, `app/routes/app.api.pages.$id.snapshot.ts` |
| Dev-only Simulate-crash button (gated on `import.meta.env.PROD`) | `app/routes/app.pages.$id.tsx` |
| 50-round manual chaos test script (P1.A exit gate) | `scripts/p1a-chaos-test.md` |

**Architectural commitments still hold:**
- Editor only writes to `Page.source` and `PageVersion`; no theme writes from the editor.
- Crash recovery is purely client-side localStorage (`demeurer:draft:<page-id>`); never bypasses the server save path.
- Uninstall handler still touches only `Session`. Snapshot and version routes verify `page.shop === request.shop` before any DB read/write.

### P1.A exit gate — chaos test result

The chaos test (`scripts/p1a-chaos-test.md`) is a manual 50-round protocol that requires browser DevTools interaction (Simulate-crash button, Network throttle to Offline, recovery banner inspection). It cannot be executed autonomously by the agent.

| Category | Rounds | Passed |
|----------|--------|--------|
| Edit + crash             | 10 | _/10 |
| Undo/redo + crash        | 10 | _/10 |
| Drag reorder + crash     | 10 | _/10 |
| Restore + edit + crash   | 10 | _/10 |
| Offline edit + crash     | 10 | _/10 |
| **Total**                | 50 | _/50 |

**Status:** script ready, not yet run. Fill in this table after running. 50/50 = P1.A signed off; any failure = blocker.

### Known limitations carried into P1.B
- **No real section rendering** — Canvas shows JSON-preview block placeholders, not Liquid output. The iframe theme-preview lands in P1.B.
- **Properties panel is a JSON textarea** — typed inspectors per block type land in P1.B alongside the schema for hero/text/image.
- **Drag reorder is top-level only** — nested-block drag, cross-parent moves, and keyboard reorder land in P1.B.
- **Version list is unfiltered** — newest 50 with no search or filter; auto vs. labeled snapshots are visually distinguished but not separated.

---

## What was set up (Steps 1–9)

| # | Area | Outcome |
|---|------|---------|
| 1–2 | Scaffold | App created via `pnpm create @shopify/app@latest` with the `shopify-app-template-react-router` template. TypeScript (`.ts`/`.tsx`). |
| 3 | Inventory | Generated structure inspected: React Router 7 + Polaris Web Components + Prisma SQLite + Shopify Web Webhooks. |
| 4 | App config (`shopify.app.toml`) | `name = "Demeurer"`. Scopes set to `write_themes,read_themes,write_content,read_content,read_products,read_files,write_files`. Webhook `api_version = "2025-10"`. Subscriptions added for `themes/update` and `themes/publish` alongside the template's `app/uninstalled` and `app/scopes_update`. Removed template's demo metafield/metaobject blocks. |
| 5 | Non-destructive uninstall | `app/routes/webhooks.app.uninstalled.tsx` rewritten with prominent JSDoc listing the four architectural commitments. Handler deletes only the merchant's `Session` row — no theme files, no `Page` rows, no `PageVersion` rows touched. |
| 6 | Architectural-commitment header | JSDoc block prepended to `app/shopify.server.ts` with all four commitments + a closing "if you find yourself violating 1–3, stop." |
| 7 | Data model | `Page` and `PageVersion` models added to `prisma/schema.prisma`. Migration `20260503043010_add_pages_and_versions` created and applied. SQLite (`prisma/dev.sqlite`) stores `Json` columns as TEXT. `source` is intentionally NOT normalized — the editor schema will evolve frequently. |
| 8 | Git + secrets | `.gitignore` confirmed (added `!.env.example` exception). `.env.example` created with blank `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SCOPES`, `HOST`, `DATABASE_URL`. Initial scaffold commit `ca8b0ad` on top of upstream `e95b51a`. Not pushed. |
| 9 | Smoke test plan | Walkthrough delivered separately: `npm run dev` → tunnel → install → uninstall → verify webhook log line + theme files unchanged in admin **Online Store → Themes → ⋯ → Edit code**. |

### Decisions made along the way

- **Package manager: npm.** Plan started with pnpm, but pnpm wasn't installed and global install required `sudo` without a TTY. Switched to npm per direction. `package-lock.json` is the source of truth.
- **Git history preserved.** Did not rewrite the upstream `Initial commit` — added our changes as a new commit on top.
- **Template demo blocks removed** from `shopify.app.toml`. They would have registered a "Demo Source Info" metafield and an "Example" metaobject in every install. Foreign cruft, not Demeurer foundation.
- **Webhook routes for `themes/update` / `themes/publish` are subscribed but unhandled.** Shopify will start delivering on next deploy; routes will 404 until we wire them up. Acceptable for P0; first thing to address in compile-pipeline work.
- **Polaris Web Components retained.** No swap to Polaris React.

---

## The four architectural commitments

> 1. When the merchant uninstalls or cancels, pages KEEP RENDERING unchanged. The editor goes read-only on cancel; pages stay live forever.
> 2. No runtime JavaScript injection from our servers. Zero page-speed penalty.
> 3. Pages survive theme updates because they ARE the theme.
> 4. If you find yourself writing code that violates 1–3, stop.

These are non-negotiable. They drive every architectural decision: theme-write scopes, native Liquid output, no shadow runtime, non-destructive uninstall, durable `Page` / `PageVersion` rows.

---

## What's NOT yet built

Foundation only is in place. None of the following exist:

- **Editor canvas** — block tree CRUD UI, drag-and-drop, inspector panels, autosave to `Page.source`.
- **Compile pipeline** — function that takes `Page.source` (JSON tree) and emits a Liquid section file (`sections/demeurer-<handle>.liquid`).
- **Theme writer** — Shopify Asset API client that writes the compiled Liquid into the merchant's active theme; idempotent overwrite; rollback on failure.
- **Webhook handlers** for `themes/update` and `themes/publish` (`app/routes/webhooks.themes.update.tsx`, `webhooks.themes.publish.tsx`) — needed to re-write Demeurer sections into newly-published themes so commitment #3 holds across theme switches.
- **Page CRUD routes** — list, create, rename, duplicate, delete pages (in-app delete fires the `Page → PageVersion` cascade; uninstall does not).
- **Publish flow** — `/api/pages/:id/publish` → compile → write Liquid → set `publishedAt` + `themeId` → snapshot a `PageVersion`.
- **Preview** — render the compiled Liquid against the merchant's theme prior to publish (likely via a draft theme or a preview-only template).
- **Version restore UI** — list `PageVersion` rows; restore one to `Page.source`.
- **Billing** — Shopify managed pricing or `appSubscriptionCreate`. Cancellation should flip the editor to read-only, never delete pages (per commitment #1).
- **Production deployment** — hosting, environment variables, DB migration to Postgres if needed (SQLite is dev-only).
- **Observability** — request logging, error reporting, webhook delivery monitoring.

---

## Next 3 things to work on — P1.D (compile pipeline + theme writer)

P1.C closed with every section emitting publish-ready Liquid + responsive
CSS. P1.D is the linchpin: actually writing those files into the
merchant's theme.

### 1. Compile pipeline

A pure function `compilePage(page: Page): { sectionFiles, jsonTemplate }`:
- Walk `page.source` block tree, call each section's `toLiquid` with the
  block's `propsByBreakpoint` and a stable `blockId`.
- Concatenate per-block Liquid into one `sections/demeurer-<handle>.liquid`
  file with the merged `{% schema %}`.
- Emit a JSON template (e.g. `templates/page.<handle>.json`) that
  references the section.
- Idempotent: same `Page` row → byte-identical output.

### 2. Theme writer

Shopify Asset API client at `app/lib/theme/writer.ts`:
- `putAsset(themeId, key, value)` with retries on rate limit.
- Idempotent overwrite — if the file already exists with identical
  content, skip the API call.
- Rollback on partial failure (write all-or-nothing across the section
  file + JSON template).
- Dry-run mode for preview.

### 3. Publish route

`POST /app/api/pages/:id/publish`:
- Authenticate, verify `page.shop === request.shop`.
- Call `compilePage`, then `themeWriter.putAsset` for each emitted file.
- Set `page.publishedAt`, `page.themeId`.
- Snapshot a `PageVersion` labeled "Published".
- Return the storefront URL.

After P1.D: `themes/publish` webhook handler (re-write Demeurer sections
into newly published themes), then preview flow, then billing.

---

## How to run, day-to-day

```bash
cd /Users/riteshgupta/Developer/demeurer
npm run dev          # Shopify CLI: tunnel + register webhooks + Vite
# Press p when prompted to install on dev store
```

Other commands:

```bash
npm run typecheck                # TS + React Router typegen
npm run lint                     # ESLint
npx prisma studio                # Inspect the SQLite DB in a browser
npx prisma migrate dev           # New migration after schema changes
npx prisma migrate reset         # Wipe + reapply (destructive — dev only)
```

---

**Last updated:** 2026-05-05 (P1.E segment 2 COMPLETE in code: per-variant content authoring via `Block.variantBinding` + shared-section `{% if %}` guard, Translate & Adapt audit confirms text/richtext fields are translatable across all 13 sections, globe indicator on text/richtext fields, "Preview as variant" toolbar dropdown; 135 / 135 tests green. **Storefront variant-conditional + T&A round-trip both BLOCKED ON MERCHANT** — protocol at `scripts/p1e-segment2-smoke.md` steps 4 + 8. P1.E remaining: internal dogfood.)
