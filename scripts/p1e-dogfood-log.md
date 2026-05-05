# P1.E dogfood log

The dogfood test: rebuild Demeurer's own marketing site using
Demeurer itself, on the demeurer-dev-dawn dev store. The point is
to surface the last batch of UX issues before real beta merchants
encounter them.

**This file is filled in by the merchant during the dogfood run.**
The agent cannot run the editor manually, time page builds, or
encounter UX issues. The agent's role is to scaffold the log and
fix Critical / Major issues after the fact.

## Setup

- [ ] Dev store: `demeurer-dev-dawn.myshopify.com`
- [ ] Theme: Dawn (latest published version) — version: ___
- [ ] Demo product: ☐ Demeurer Cap (or similar) with 2-3
      variants, real images, real description, real price
- [ ] Demeurer installed and authenticated

## Severity rubric

- **Critical** — blocks publishing or causes data loss
- **Major** — significant friction; would generate a 1-star
  review
- **Minor** — noticeable but workable; would generate
  "could be better" feedback in beta
- **Cosmetic** — visual or copy polish

## Issue format

```
Issue: <one-line summary>
Severity: Critical | Major | Minor | Cosmetic
Description: what happened, what I expected
Recreation: steps to reproduce
Decision: Fix in P1.E segment 4 | Defer to P2 | Won't fix
```

## Discipline

Build all 5 pages BEFORE fixing any non-Critical issues. The
discipline matters: if you fix-as-you-go, you don't see how
issues compound.

---

## Page 1: Home

**Goal:** marketing landing page introducing Demeurer to a
visitor. Sections: hero, feature list, testimonial, CTA band,
FAQ.

- Sections used: ___
- Time taken (create page → publish): ___ minutes
- Issue count: Critical ___ / Major ___ / Minor ___ / Cosmetic ___

### Issues encountered

(fill in during build)

---

## Page 2: Pricing

**Goal:** pricing tiers with monthly/yearly toggle. Sections:
hero, pricing, FAQ, CTA band.

- Sections used: ___
- Time taken: ___ minutes
- Issue count: Critical ___ / Major ___ / Minor ___ / Cosmetic ___

### Issues encountered

(fill in during build)

---

## Page 3: About

**Goal:** founder story / company narrative. Sections: hero,
image+text, image+text, CTA band.

- Sections used: ___
- Time taken: ___ minutes
- Issue count: Critical ___ / Major ___ / Minor ___ / Cosmetic ___

### Issues encountered

(fill in during build)

---

## Page 4: Architecture

**Goal:** explain the four architectural commitments to
technical buyers. Sections: hero, feature list, image+text
(technical), CTA band.

- Sections used: ___
- Time taken: ___ minutes
- Issue count: Critical ___ / Major ___ / Minor ___ / Cosmetic ___

### Issues encountered

(fill in during build)

---

## Page 5: Sample product page

**Goal:** prove the product-details section + per-variant
content + variant picker work end-to-end on a real product.
Sections: hero, product-details, feature list, testimonial,
FAQ, CTA band.

- Bound product: ___
- Sections used: ___
- Time taken: ___ minutes
- Issue count: Critical ___ / Major ___ / Minor ___ / Cosmetic ___

### Issues encountered

(fill in during build)

---

## Aggregate

- Total dogfood time across 5 pages: ___ minutes
- Critical issues: ___
- Major issues: ___
- Minor issues: ___
- Cosmetic issues: ___

### P1 readiness check

If the dogfood log has more than **5 Critical** or **10 Major**
issues, P1 is not ready. Pause, fix, and rerun the dogfood. The
bar for P1 exit is that a competent founder can build a competent
marketing site in **under 4 hours total**.

- [ ] Critical count ≤ 5
- [ ] Major count ≤ 10
- [ ] Total dogfood time ≤ 4 hours
- [ ] Critical and Major all fixed before declaring P1 complete

### Triage decisions

After all 5 pages are built:

- Critical / Major → fix in this segment.
- Minor → log in `scripts/p2-backlog.md`.
- Cosmetic → log in `scripts/polish-backlog.md`.

---

## Honest qualitative reflection

After all 5 pages are published and the issues have been
triaged, answer this honestly:

> Would I want a beta merchant going through this same
> experience tomorrow?

Answer: ___

If "no", fix more before declaring P1 complete.

## Status

**BLOCKED ON MERCHANT** — the agent cannot run the editor
manually, time page builds, encounter UX issues, run Lighthouse
on the published pages, or judge editor experience. The
merchant fills this in during the dogfood run.
