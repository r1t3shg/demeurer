# P1 exit gate

The final verification that P1 is complete and private beta (P2)
can begin. Every item must be green before declaring P1 done.

**Items marked ✅ AGENT have been verified by the agent in code.
Items marked ☐ MERCHANT require a real dev store, browser, or
manual editor use — fill in during the dogfood run.**

For each ☐ MERCHANT item that fails: STOP. Diagnose. Fix.
Re-run.

---

## ARCHITECTURAL COMMITMENT VERIFICATION (final)

### (1) Pages keep working after uninstall

- ☐ MERCHANT — On the dogfood store, with all 5 marketing pages
  published, uninstall Demeurer.
- ☐ MERCHANT — Visit each page URL — all 5 render correctly.
- ☐ MERCHANT — Including the product page — variant picker
  still works.
- ☐ MERCHANT — Wait 24 hours, re-test — still works.

**Code-side verification (✅ AGENT):**
- The compile pipeline emits standard Shopify section files
  (`{% schema %}` + Liquid). After uninstall, Shopify keeps
  serving these files. No demeurer.app dependency in the
  emitted Liquid.
- See `app/lib/compile/page-template.ts` (no runtime URLs
  written), `docs/architecture-commitments.md` §1.

### (2) No runtime JavaScript injection from our servers

- ✅ AGENT — Static analysis of compiled `kitchen-sink` and
  `kitchen-sink-responsive` snapshot output:
  - Zero `demeurer.app` references in any emitted Liquid file.
  - Zero `<script src=...>` tags emitted anywhere.
  - The only outbound URLs in compiled output are merchant-
    controlled video iframe embeds (`player.vimeo.com`,
    `www.youtube-nocookie.com`) — these are `<iframe>`, not
    `<script>`, and the merchant explicitly chose them.
  - The pricing toggle is the only JS Demeurer emits — ~15
    inline lines, zero external src.
- ☐ MERCHANT — Confirm by Network tab on the 5 dogfood pages
  (storefront-runtime sanity check that the static guarantee
  holds end-to-end).
- See `docs/architecture-commitments.md` §2.

### (3) Pages survive theme updates

- ☐ MERCHANT — Switch Dawn version (Settings → Theme library →
  Check for updates → Update) — pages render correctly after.
- ☐ MERCHANT — Switch to a completely different theme (Sense)
  → pages broken (expected; pages bound to Dawn template) →
  webhooks fire → banners appear in editor → re-publish each
  page to Sense → pages render correctly on Sense.
- ☐ MERCHANT — Switch back to Dawn — pages still work on Dawn
  (theme files were not removed when re-published to Sense).

**Code-side verification (✅ AGENT):**
- `webhooks.themes.publish.tsx` flags pages on the previous
  active theme as drifted; tested in
  `themes.publish.webhook.test.ts` (8 scenarios, all green).
- `webhooks.themes.update.tsx` and drift detection both wired.
- Theme-mismatch banner in `app/components/editor/ThemeMismatchBanner.tsx`.

### (4) No page-speed penalty

- ☐ MERCHANT — Lighthouse 95+ on all 5 pages, mobile and
  desktop.

**Code-side verification (✅ AGENT):**
- Every emitted `<img>` goes through Shopify's `image_url`
  filter (no raw URLs):
  - hero: `image_url: width: 2400` (CSS background, ultrawide
    + retina coverage).
  - image-text: `image_url: width: 1600 | image_tag` with
    `widths: '400, 600, 800, 1200, 1600'` (full srcset).
  - product-details main: `image_url: width: 1600 | image_tag`
    with `widths: '400, 600, 800, 1200, 1600'`.
  - product-details thumbs: `image_url: width: 200` (rendered
    at 64×64; 3× retina).
  - logo-wall: `image_url: height: logo_h` (rendered at
    24/32/48 px tall; logos don't need srcset).
  - testimonial avatars: `image_url: width: 80` (rendered
    40×40; 2× retina).
- `loading: 'lazy'` on every non-hero image.
- Pricing toggle is the only JavaScript; ~15 inline lines.
- Logo-wall marquee + testimonial scroll-snap respect
  `prefers-reduced-motion`.

---

## EDITOR EXPERIENCE VERIFICATION

All ☐ MERCHANT — agent cannot run editor manually.

- ☐ Build a 4-section page from scratch in under 5 minutes.
- ☐ Build a 10-section page from scratch in under 15 minutes.
- ☐ Edit a published page, re-publish, see changes in under
  30 sec.
- ☐ Undo 20 actions in a row without state corruption.
- ☐ Crash recovery: simulate browser crash mid-edit, recover
  state. (The "Simulate crash" button was removed in P1.E
  segment 4 cleanup; trigger a real crash via `chrome://crash`
  or close the tab during a save in flight.)
- ☐ Version history: restore a 30-version-old snapshot, verify
  correctness.
- ☐ Drag-reorder 8 blocks, no jank.
- ☐ Switch breakpoints rapidly (desktop ↔ mobile ↔ tablet) — no
  layout flicker beyond the iframe reload.
- ☐ Override a property at desktop only, verify cascade in
  editor and in published output.
- ☐ Per-variant content authoring: bind a block to one variant,
  verify storefront variant change shows/hides correctly.
- ☐ All 13 sections present in the picker, render correctly,
  publish correctly.

**Code-side verification (✅ AGENT):**
- All 13 sections registered in `app/lib/sections/index.ts`:
  `hero`, `feature-list`, `image-text`, `testimonial`, `faq`,
  `cta-band`, `logo-wall`, `pricing`, `video`, `form`,
  `spacer`, `html`, `product-details`. Each has a complete
  `{ schema, defaults, Render, toLiquid }` definition.
- The `kitchen-sink` snapshot fixture exercises all 13
  sections; tests pass on every commit (`compile.test.ts`).
- `productAware` sections (`hero`, `image-text`,
  `product-details`) compile with the variant-binding
  `should_render` guard wrapping their body; verified in
  `kitchen-sink.snap` (2 occurrences of `should_render`).

---

## PRODUCT-PAGE VERIFICATION

All ☐ MERCHANT.

- ☐ Variant picker functions on storefront (clicking a variant
  changes price and image).
- ☐ Add to cart works.
- ☐ `{{product.title}}` token replacement works.
- ☐ Out-of-stock variants render disabled (theme handles this;
  we just verify our markup doesn't break it).
- ☐ Translation via Translate & Adapt works for product page
  text fields.

---

## RTL VERIFICATION

All ☐ MERCHANT.

- ☐ Build a single Arabic landing page (translate hero +
  feature list via T&A).
- ☐ Verify RTL flow on storefront for all sections used.
- ☐ No LTR-coded margins/paddings visible.

**Code-side verification (✅ AGENT):**
- `scripts/rtl-audit.md` per-section static audit: 1 issue
  found (product-details `direction: rtl` no-op) and fixed in
  P1.E segment 3.

---

## THEME COMPATIBILITY

- ☐ MERCHANT — At least 4 of 5 top themes documented as "Full"
  compatible (matrix in `scripts/p2-theme-compatibility.md`).
- ☐ MERCHANT — Any "Partial" themes have explicit issue notes
  for beta merchants to be aware of.

---

## REGRESSION

- ✅ AGENT — All previous exit gates' tests still pass.
  - P1.B exit gate: see `scripts/p1b-exit-gate.md`.
  - P1.C exit gate: see `scripts/p1c-exit-gate.md`.
  - P1.D exit gate: see `scripts/p1d-exit-gate.md`.
- ✅ AGENT — All snapshot tests pass.
- ✅ AGENT — All unit tests pass: **135 / 135 green**.
- ✅ AGENT — Prisma schema is clean (`npx prisma format` →
  no diff).

---

## DOGFOOD ARTIFACTS

- ☐ MERCHANT — All 5 marketing pages built and published.
- ☐ MERCHANT — `scripts/p1e-dogfood-log.md` complete with
  severities and decisions.
- ☐ MERCHANT — All Critical and Major issues fixed.
- ☐ MERCHANT — Minor issues triaged into
  `scripts/p2-backlog.md`.
- ☐ MERCHANT — `scripts/lighthouse-benchmark.md` updated with
  per-page scores.

---

## DOCUMENTATION

- ✅ AGENT — `docs/architecture-commitments.md` exists and is
  current (covers all four commitments).
- ✅ AGENT — `docs/sections.md` exists (560+ lines, authoring
  guide).
- ✅ AGENT — `docs/translate-and-adapt.md` exists.
- ✅ AGENT — `docs/product-tokens.md` exists.
- ✅ AGENT — `docs/compile.md` exists (302 lines, compile
  pipeline).
- ☐ MERCHANT — `PROJECT_STATUS.md` is current with P1 marked
  complete (after dogfood passes).

---

## P2 READINESS

- ✅ AGENT — `scripts/p2-theme-compatibility.md` exists
  (template; merchant fills in matrix).
- ✅ AGENT — `scripts/p2-backlog.md` exists (template;
  populated during dogfood).
- ☐ MERCHANT — Beta recruitment plan documented (link to
  build plan P2 section if not standalone).
- ☐ MERCHANT — Free Pro tier flag implementable (don't need
  to ship the billing yet, but the flag-gating must be
  planned).

---

## Final code hygiene

- ✅ AGENT — Dev-only debug code audited:
  - **Removed:** "Simulate crash" button (chaos-test code)
    from `app/routes/app.pages.$id.tsx`.
  - **Kept (gated to `import.meta.env.PROD`):** "Show compiled
    output" and "Show drift" panels.
- ✅ AGENT — `npx prisma format` → no diff.
- ✅ AGENT — `npm test` → 135 / 135 green.
- ✅ AGENT — `npm run build` → clean (one chunk-size warning
  for the editor bundle, expected for an SPA).
- ✅ AGENT — `.env.example` covers all referenced env vars
  (`SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SCOPES`,
  `SHOPIFY_APP_URL`, `HOST`, `DATABASE_URL`,
  `SHOP_CUSTOM_DOMAIN`).
- ✅ AGENT — `.gitignore` covers `node_modules`, `.env`,
  `build`, `.shopify`, `.react-router`, Prisma SQLite,
  macOS `.DS_Store`.
- ✅ AGENT — Typecheck: 3 pre-existing errors (Polaris Web
  Components type defs + Shopify SDK upstream type
  mismatch); all pre-date P1 work.

---

## Result

| Category | Status |
|----------|--------|
| Architectural commitments (1-4) | code-side ✅; merchant verification BLOCKED |
| Editor experience | BLOCKED ON MERCHANT |
| Product-page verification | BLOCKED ON MERCHANT |
| RTL verification | code-side ✅; merchant storefront BLOCKED |
| Theme compatibility | BLOCKED ON MERCHANT |
| Regression (tests / typecheck / build) | ✅ |
| Dogfood artifacts | BLOCKED ON MERCHANT |
| Documentation | ✅ (existing docs current) |
| P2 readiness scaffolding | ✅ |
| Code hygiene | ✅ |

**P1 cannot be marked complete until the dogfood is run by the
merchant and all ☐ MERCHANT items resolve to green.**
