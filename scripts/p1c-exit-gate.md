# P1.C Exit Gate

Manual verification protocol for closing P1.C (responsive design layer).
Run end-to-end against a dev store with a recent Dawn theme. Tick each
box; record any failure with a one-line root cause and either fix it or
carry it forward as a documented exception.

P1.C added a per-breakpoint cascade (mobile → tablet → desktop) on every
section's props. Mobile is the canonical layer; tablet/desktop are sparse
override layers. The published Liquid emits `@media` rules from the
overrides — no JS, no fluid scales, no container queries.

## Static verification (agent-checkable)

- [x] All 48 unit tests in `responsive-css.test.ts` pass:
      `npm test` → 48 / 48 green.
- [x] All 12 sections' `toLiquid` accept `propsByBreakpoint` (not just
      mobile props) and pass `ctx.blockId` through to `scopeClass`.
- [x] Each section's root element carries the unique scope class
      `demeurer-<type>-<blockId>` so `@media` overrides can target
      exactly one element.
- [x] `emitResponsiveCSS` returns "" for any section with no overrides
      (the freshly-built-page exit-gate criterion). Verified by
      `responsive-css.test.ts > emitResponsiveCSS > emits an empty
      string when there are no overrides`.
- [x] `wrapStyle` returns "" for whitespace, so a section with no
      overrides AND no visibility changes emits zero `{% style %}`
      tags — the published Liquid is indistinguishable from a hand-
      written section.
- [x] `diffOverrides` uses structural equality (`JSON.stringify`) so
      SpacingValue and other object props compare correctly. A tablet
      layer that re-asserts the mobile padding object is NOT treated
      as an override.
- [x] At desktop, `diffOverrides` compares against the tablet-resolved
      value, not mobile — a desktop value identical to the cascaded
      tablet value emits no rule.
- [x] `emitVisibilityCSS` is cascade-aware: it only emits a rule at the
      breakpoint where visibility CHANGES. `_visibility: false` at
      both tablet and desktop emits ONE 768px rule (the cascade applies
      it at desktop too).
- [x] `scopeClass` sanitizes block ids to `[a-z0-9_-]` — defensive
      against hand-edited document JSON.
- [x] `npx tsc --noEmit` is clean for the entire `app/lib/sections/`
      tree (pre-existing TS errors elsewhere in the repo are unrelated
      to P1.C).
- [x] Properties panel passes `block.id` into `toLiquid` ctx — the
      "Show Liquid" dev tool now reflects responsive output.

## Manual verification (dev tunnel required)

These cannot be exercised by the agent; they sit in the merchant's hands.

### Editor

- [ ] Breakpoint switcher (Mobile / Tablet / Desktop) toggles the canvas
      preview width AND the Properties panel context. Editing a field
      at "Tablet" only writes to the `tablet` layer; mobile values are
      preserved.
- [ ] Source badge ("From mobile" / "Tablet override" / "Desktop
      override") appears next to each field at non-mobile breakpoints
      and reflects the current cascade source.
- [ ] "Apply to all breakpoints" inline confirmation appears when
      editing a field at non-mobile and offers to clear overrides.
- [ ] Structural fields (form `formType`, html `html`, spacer
      `showDivider`/`dividerColor`/`dividerWidth`) render read-only
      with a "Same on all breakpoints" badge at tablet/desktop.

### Liquid output (manual paste-test on Dawn theme)

For each of: hero, cta-band, feature-list, image-text, testimonial, faq,
logo-wall, pricing, video, form, html, spacer:

- [ ] Build the section in the editor with overrides on at least one
      prop at tablet AND desktop. Open "Show Liquid" inspector, copy
      the section file output.
- [ ] Save it as `sections/demeurer-<type>.liquid` in Dawn via
      Online Store → Themes → ⋯ → Edit code. Theme save accepts the
      file (no Liquid syntax errors).
- [ ] The published storefront renders the mobile values at <768px and
      transitions to the tablet values at ≥768px and desktop values at
      ≥1280px. Resize the browser; the breakpoints visibly take effect.
- [ ] Setting `_visibility: false` at tablet hides the section at
      ≥768px without affecting mobile or desktop visibility.

### Performance (Lighthouse)

Mobile, throttled, simulated network, on Dawn:

- [ ] Hero (with background image): Lighthouse Performance ≥ 95.
- [ ] CTA band: ≥ 95.
- [ ] Feature list (3-column, no images): ≥ 95.
- [ ] Image+text (with srcset): ≥ 95.
- [ ] Testimonial (carousel layout — pure CSS scroll-snap): ≥ 95.
- [ ] FAQ: ≥ 95.
- [ ] Logo wall (marquee): ≥ 95.
- [ ] Pricing (with billing toggle ON — the only section with inline
      JS): ≥ 90 (toggle script runs on first interaction).
- [ ] Video (YouTube nocookie embed, lazy): ≥ 90 (third-party iframe
      ceiling).
- [ ] Form: ≥ 95.
- [ ] HTML: depends on merchant content (n/a for our gate).
- [ ] Spacer: ≥ 95.

### Architectural commitments

- [ ] Inspect the published Liquid for a representative section. Confirm:
      - No `<script src="...">` tags pulled from a Demeurer domain.
      - No fonts loaded from a Demeurer domain.
      - The only inline `<script>` blocks are the pricing billing-
        toggle (~15 lines, scoped to `section.id`) and nothing else.
      - Every `@media` rule is a plain CSS query — no JS-driven
        breakpoint detection.
- [ ] Uninstall the Demeurer app from the dev store. Reload a published
      page. The page renders unchanged. Resize the browser; tablet/
      desktop overrides STILL apply (they were baked into the theme,
      not served by Demeurer).

## Result

| Category | Pass |
|---|---|
| Unit tests | ✅ 48 / 48 green |
| TypeScript | ✅ sections clean |
| Helper semantics (cascade, equality, visibility) | ✅ verified by tests |
| Section refactor (12/12) | ✅ all sections emit responsive CSS |
| Editor breakpoint UX | ⏳ pending manual run |
| Liquid paste-test on Dawn | ⏳ pending manual run |
| Performance (Lighthouse) | ⏳ pending manual run |
| Post-uninstall verification | ⏳ pending manual run |

P1.C is **code-complete**. The "all green" status of this gate depends
on running the dev tunnel and exercising the editor + Dawn paste-test
across the twelve sections.
