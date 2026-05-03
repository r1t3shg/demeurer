# P1.B Exit Gate

Manual verification protocol for closing P1.B (section system + the twelve).
Run end-to-end against a dev store with a recent Dawn theme. Tick each box;
record any failure with a one-line root cause and either fix it or carry it
forward as a documented exception.

## Registry & metadata

- [x] All 12 sections registered in `app/lib/sections/index.ts`. Verify in
      browser devtools console on load: `Demeurer: registered 12 sections:
      [hero, feature-list, image-text, testimonial, faq, cta-band, logo-wall,
      pricing, video, form, spacer, html]`.
- [x] Each `SectionDefinition` has: `type`, `label`, `description`, `icon`,
      `category`, `schema`, `defaults`, `Render`, `toLiquid`. Type-checked
      by `SectionDefinition` (description is now required).

## Canvas rendering

- [ ] Each section renders correctly in the iframe canvas with the merchant
      theme tokens flowing through (background color, accent color,
      heading/body fonts, base spacing unit).
- [ ] Each section's defaults look tasteful — no Lorem ipsum, no broken
      images, no placeholder copy that screams "demo". Walk every section
      via the catalog `/app/catalog` and screenshot it.

## Field renderers

- [ ] Field types exercised end-to-end across at least one section each:
      `text`, `richtext`, `image`, `url`, `select`, `color`, `number`,
      `boolean`, `spacing`, `group`, `list`. The Properties panel
      `FieldRenderer` dispatch should not throw "unknown field kind".
- [ ] Image picker only accepts Shopify CDN URLs — paste an external URL
      and confirm it's rejected (or coerced to empty string).

## Editor regressions

- [ ] Drag-reorder still works (P1.A) — drag a section in the outline,
      confirm position changes and persists.
- [ ] Undo/redo works across all section operations: insert section,
      delete section, change a property, drag-reorder. Cmd+Z / Cmd+Shift+Z.
- [ ] Autosave still works — make a change, watch SaveIndicator transition
      saving → saved within ~1s, refresh page, change persists.
- [ ] Version history still works — open drawer, save named snapshot,
      preview, restore.
- [ ] Crash recovery still works — re-run 5 chaos rounds from
      `scripts/p1a-chaos-test.md`, confirm recovery banner appears and
      restores correctly. (Full 50-round protocol is the P1.A gate, not
      P1.B; we just sanity-check 5 here.)

## Internationalization & accessibility

- [ ] RTL: load editor with browser locale forced to Arabic (or wrap with
      `dir="rtl"`). Each section reflows correctly — no overlap, no text
      escaping its container, padding flips. Verifies the logical-property
      conversion done in P1.B segment 5.
- [ ] Section quality indicator shows in Properties for sections with a
      `qualityCheck`: green for no issues, yellow for warnings, red for
      errors or 2+ warnings. Hero with low-contrast theme tokens =
      red error. Image+text with no alt = yellow.

## Performance

- [ ] Lighthouse 95+ mobile per section in isolation on Dawn — see
      `scripts/lighthouse-results.md`. Currently blocked on the publish
      pipeline; the table records expected baselines until then.

## Liquid output validity

- [ ] Manual paste-test on at least 6 of 12 (ideally all): copy the
      `template` string from the dev-only "Show Liquid" inspector
      (Properties panel), wrap it with the `schema` JSON in a
      `{% schema %}` block, save as `sections/demeurer-<type>.liquid`
      in the Dawn theme via Online Store → Themes → ⋯ → Edit code,
      add the section to a JSON template, and confirm:
        - Theme save accepts the file (no Liquid syntax errors).
        - Section renders in the storefront preview.
        - Settings appear in the theme editor right rail (Shopify reads
          `{% schema %}` for those).
- [ ] Specifically verified for: hero, image-text, feature-list, faq,
      cta-band, pricing.

## Catalog

- [x] `/app/catalog` lists all 12 sections grouped by category.
- [x] Each card shows icon, label, description, type, scaled-down preview.
- [x] "Add to a new page" creates a fresh `Page` row seeded with that
      section's defaults + redirects to `/app/pages/:id`.
- [x] Catalog 404s in production (gated on `NODE_ENV !== "production"`).
- [x] Catalog link visible in the embedded app nav only in dev.

## Result

| Category | Pass |
|---|---|
| Registry & metadata | ✅ verified statically |
| Catalog | ✅ verified statically |
| Canvas rendering | ⏳ pending manual run |
| Field renderers | ⏳ pending manual run |
| Editor regressions | ⏳ pending manual run |
| RTL & a11y | ⏳ pending manual run |
| Performance (Lighthouse) | ⏳ blocked on publish pipeline (P2) |
| Liquid output validity | ⏳ pending manual paste-test |

Statically-verifiable boxes are ticked above. Boxes that require a live
embedded session (canvas rendering, field renderers, editor regressions,
RTL, manual Liquid paste-test) cannot be exercised by the agent; they
sit in the merchant's hands. Lighthouse is blocked on the publish flow.

P1.B is **code-complete**. The "all green" status of this gate depends on
running the dev tunnel and walking the catalog page section-by-section.
