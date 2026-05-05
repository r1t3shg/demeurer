# P2 backlog

**Minor** issues from the P1.E dogfood (and any subsequent UX
findings before the private beta launches). Triaged from
`scripts/p1e-dogfood-log.md`.

Sorted by impact within priority. The agent has pre-populated
known follow-ups; the merchant adds dogfood findings here after
the run.

## Format

```
- [ ] <one-line summary>
      Source: dogfood page N | code review | merchant feedback
      Impact: short rationale
      Effort: S / M / L
```

## Pre-populated follow-ups (from P1.E)

### Tests + coverage

- [ ] qualityCheck unit tests for hero / image-text / form /
      pricing default-heading / empty-form / identical-tier
      nudges (deferred from P1.E segment 3 — code merged with
      no new tests).
      Source: code review (P1.E segment 3 plan §Tests)
      Impact: regressions in qualityCheck output would silently
      skip merchant nudges.
      Effort: S
- [ ] Visual regression suite for the 13 sections (Playwright
      screenshot per section per breakpoint).
      Source: code review (out of scope per P1.E.3 spec).
      Impact: catches CSS regressions in Render that snapshot
      tests miss (snapshot tests only cover Liquid output).
      Effort: M

### Editor UX (placeholders for dogfood findings)

- [ ] _<dogfood Minor issue 1 — fill from p1e-dogfood-log.md>_
- [ ] _<dogfood Minor issue 2>_
- [ ] _<dogfood Minor issue 3>_

### Sections + features

- [ ] Stats counter section (deferred from P1 scope; useful for
      About / Architecture pages).
      Source: docs/sections.md uses stats-counter as the
      example in the authoring guide but no real implementation
      exists.
      Impact: dogfood likely needs this on the Architecture
      page; for now use feature-list as a workaround.
      Effort: M
- [ ] Newsletter subscribe block as a section variant of `form`
      (rather than the merchant configuring a 1-field form).
      Source: dogfood expected to surface this on Home + CTA.
      Impact: shorter merchant onboarding for the most common
      form use case.
      Effort: S
- [ ] Per-language separate pages workflow (currently merchants
      with per-variant + per-language need to run multiple
      pages; no UI helper).
      Source: docs/translate-and-adapt.md §Limitations.
      Impact: only affects merchants with both axes; usually
      one or the other.
      Effort: L

### Compile pipeline

- [ ] Code-split the editor bundle (`index-SvzRBhpf.js` is
      ~1MB / 200kb gzipped; one chunk-size warning at build).
      Source: `npm run build` warning.
      Impact: editor first-paint latency for new merchants.
      Effort: M
- [ ] Background prewarm of compiled output cache (so publish
      isn't always cold).
      Source: code review.
      Impact: 200-500ms publish latency reduction.
      Effort: M

### Theme compatibility

- [ ] Document workarounds for any theme marked "Partial" in
      `scripts/p2-theme-compatibility.md`. Each "Partial"
      theme deserves a short merchant-facing note: "On Theme
      X, variant changes require a page reload — this is a
      theme limitation; here's how to verify."
      Source: P1.E segment 3.
      Impact: prevents "is Demeurer broken?" support tickets
      on the long tail of Shopify themes.
      Effort: M

### Documentation

- [ ] `docs/architecture-commitments.md` could surface the
      P1.E variant-binding feature in the §1 (uninstall) and
      §3 (theme update) Verification subsections — as it
      stands the doc was last meaningfully updated in P1.D.
      Source: code review.
      Impact: low; docs are correct but feel pre-P1.E.
      Effort: S

## Bar for closing P2

P2 (private beta) closes when:
- Beta cohort of 10-20 merchants has used Demeurer for
  ≥30 days each.
- No item in this backlog flagged Critical or Major after
  beta-merchant feedback.
- Theme compatibility matrix in
  `scripts/p2-theme-compatibility.md` shows 5/5 themes Full
  or 4/5 + workarounds.

Items remaining at P2 close roll into P3 (public beta /
launch).
