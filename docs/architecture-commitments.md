# The architectural commitments

Demeurer's product is built around four commitments. They aren't
slogans — they're enforced at the code level. This document explains
what each commitment means, where the code lives, and how a future
change to any of them would have to look.

---

## 1. Pages keep working after uninstall

> When the merchant uninstalls or cancels Demeurer, every page they
> built keeps rendering on their storefront unchanged. Forever.

### Why

Page-builder apps usually do one of two things: they serve every
page from their own infrastructure (so cancellation = pages go down),
or they "export" pages as theme files but with proprietary scripts /
SDKs / dependencies that fail when the app's servers go away.

Demeurer takes a different path. Every page is a real native theme
file inside the merchant's theme. The merchant owns it. We can
disappear; the page survives.

### How

The compile pipeline (`app/lib/compile/compile.ts`) turns each page
into native Shopify theme files:

- One `sections/demeurer-{type}.liquid` per used section type.
  Parameterless — same bytes for every merchant. Every section's
  schema, render template, and rendering logic lives entirely in
  this file.
- One `templates/{page,product}.demeurer-{handle}.json` per page,
  in standard Shopify JSON template format. Section settings carry
  the merchant's edits.

Files use the `demeurer-` prefix everywhere — that's the audit
trail. Merchants can `Online Store → Themes → Edit code` and see
every byte we've written, with no obfuscation.

The publish pipeline (`app/lib/compile/apply.ts` +
`app/lib/theme/writer.server.ts`) writes those files to the
merchant's published theme via Shopify's `themeFilesUpsert`
mutation. We track every write in `ThemeWrite` so future drift
detection is precise.

The uninstall webhook (`app/routes/webhooks.app.uninstalled.tsx`)
deletes ONLY the OAuth `Session` row. Pages, PageVersions,
ThemeWrites, Publishes, and most importantly **theme files** are
intentionally preserved. The handler's docstring restates this
prohibition; any future change that touches theme files is wrong by
definition.

### Verification

`scripts/p1d-exit-gate.md` step (1) is the architectural test: build
a page with all 12 section types, publish, uninstall, confirm the
page still renders 24 hours later. The single most important
verification gate in the project.

---

## 2. No runtime JavaScript from our servers

> Pages render with zero requests to Demeurer's domain. No SDK, no
> tracking script, no fetch. Storefront speed is theme-dependent,
> not Demeurer-dependent.

### Why

Most page-builder apps inject a script tag that fetches their SDK,
which fetches the page configuration, which then renders client-
side. That's a bunch of waterfalls, a hard dependency on the app's
uptime, and a measurable hit on Lighthouse Performance.

Demeurer's pages are pre-rendered Liquid. The browser doesn't know
the app exists.

### How

- Sections are server-rendered Liquid. Inline `style="..."`
  attributes carry compile-time-baked CSS values; per-block
  responsive overrides ride in a `{% style %}` block as `@media`
  rules.
- Forms use Shopify's native `{% form 'contact' %}` /
  `{% form 'customer' %}` — submissions go to Shopify, not to us.
- FAQ accordions use `<details>/<summary>` — zero JS.
- Logo-wall marquee and testimonial carousel use CSS scroll-snap or
  pure CSS animation — zero JS.
- Images go through Shopify's `image_url` + `image_tag` filters for
  CDN sizing, responsive `srcset`, and `loading="lazy"`.

The single carve-out is the **Pricing billing toggle**: ~15 lines
of inline JS, scoped to a single section by its DOM id, opt-in via
the section's `billingToggle` setting, and gracefully degrades to a
monthly-only view if JS is disabled. No external script, no fetch.

The compile pipeline never emits `<script src="...">`. The dev
tools (`Show compiled output`, `Show drift`) are gated by
`import.meta.env.PROD` and dead-coded out of production bundles.

### Verification

`scripts/p1d-exit-gate.md` step (2): view source on a published
page; search for `script src=`, search for `fetch(`, network tab on
load. Zero requests to our domain.

---

## 3. Pages survive theme updates because they ARE the theme

> When the merchant changes themes, switches between Dawn and Sense,
> or accepts a theme update, their Demeurer-built pages don't
> silently break. We detect, surface, and offer a one-click recovery.

### Why

Theme switches are the most disruptive event a merchant can trigger.
Our files exist in the old theme, not the new one. Without recovery
logic, the merchant would visit their storefront, see broken pages,
and assume it's our fault.

### How

The `themes/publish` webhook (`app/routes/webhooks.themes.publish.tsx`)
fires when a theme transitions to MAIN role. The handler walks every
published Page for the shop and marks `themeMismatch = true` on any
whose `themeId` doesn't match the new MAIN. The pure logic lives in
`app/lib/theme/webhook-themes-publish.ts` for testability.

Surfacing:
- Editor banner (`ThemeMismatchBanner.tsx`) appears at the top of
  the editor for affected pages.
- Pages list shows a `⚠ Different theme` badge in place of the
  normal `Published` badge.
- Top-of-app banner notifies the merchant of the count, with a link
  to `/app/pages/theme-mismatch`.

Recovery:
- "Re-publish to current theme" on the banner triggers the standard
  publish flow against the new MAIN. On success, `themeMismatch`
  clears and `themeId` updates.
- Bulk re-publish at `/app/pages/theme-mismatch` walks the list one
  at a time. Per-page failures don't abort the batch — failed pages
  stay flagged for manual retry.

What we deliberately don't do:
- **No automatic re-publish.** Auto-rewriting the merchant's theme
  on a webhook would surprise them. We surface; they decide.
- **No deletion of legacy theme files.** Old theme A still has its
  Demeurer files. If the merchant ever switches back, the page on
  theme A still works.
- **No silent overwrite of manual edits.** Drift detection
  (segment 2) catches any divergence; the publish dialog requires
  explicit `acceptDrift: true` to overwrite.

### Verification

`scripts/p1d-exit-gate.md` step (3): publish to Dawn, switch to
Sense, observe the banner, click re-publish, confirm Sense renders,
switch back to Dawn, confirm Dawn STILL works.

---

## 4. No page-speed penalty

> A merchant's Lighthouse score on a Demeurer-published page should
> be within 5 points of a hand-rolled theme page. Mobile Performance
> ≥ 95 is the target.

### Why

The page builder's job is to speed up the merchant's authoring, not
to slow down their storefront. Most builders trade one for the
other; we don't.

### How

This commitment is enforced architecturally — not by performance
work, but by the design choices in commitments 1–3:

- **Static section files.** No runtime compilation; Shopify's CDN
  serves bytes.
- **Per-block-scoped CSS.** A `{% style %}` block per block, not a
  global stylesheet from our domain. Browsers cache the section
  file; Shopify CDN serves it from edge.
- **Lazy-loaded images** via `image_tag` with `loading: 'lazy'`,
  responsive `srcset`, Shopify-CDN-resized.
- **Zero blocking JS** (commitment 2). The only inline JS is the
  Pricing toggle carve-out, ~15 lines, deferred semantically.
- **No web fonts injected by us.** We respect the theme's font
  choices via the `tokens.server.ts` theme-token reader.
- **No external requests** during page render.

What we don't do:
- Don't ship a CSS bundle. Each section's CSS is in the section
  file.
- Don't inline a font.
- Don't add a tracking pixel. (We'll add product analytics in P5,
  but only via Shopify's own analytics surface — not a third-party
  script tag.)

### Verification

`scripts/lighthouse-benchmark.md` template captures real numbers
from the dev store. Target: every score ≥ 95 mobile, gap to baseline
< 5 points.

---

## How we enforce these commitments

These aren't just architectural intent — they're encoded in the
code:

- **Uninstall handler** (`webhooks.app.uninstalled.tsx`) has a
  long-form comment forbidding any deletion beyond `Session`.
- **Compile pipeline** (`app/lib/compile/`) is pure-functional. The
  output IS the file content; there's no shadow runtime.
- **Theme writer** (`app/lib/theme/writer.server.ts`) only ever
  calls `themeFilesUpsert` on prefixed paths. There's no
  `themeFilesDelete` call anywhere in the codebase.
- **Publish lock** + **drift gating** prevent silent overwrites.
- **Architectural test** in `scripts/p1d-exit-gate.md` is the
  go/no-go gate for shipping P1.D.

If a future change appears to violate any of these — stop. Re-read
this document. The commitment is the product.

---

## Logging audit (for the record)

Demeurer logs at info/warn/error level only:

- Topic + shop on webhook reception (`webhooks.app.uninstalled.tsx`,
  `webhooks.app.scopes_update.tsx`, `webhooks.themes.publish.tsx`,
  `webhooks.themes.update.tsx`).
- Error objects on actual error paths (`entry.server.tsx`,
  `tokens.server.ts`, `stylesheets.server.ts`,
  `preview.$pageId.tsx`).

We do NOT log:
- Page source / block content.
- Theme file content (read or written).
- Any merchant input beyond shop domain.

If you need to add a log line that includes merchant content, gate
it on `process.env.NODE_ENV !== "production"`. Better yet, reach for
a metric instead of a log.

---

This document doubles as the basis for the eventual blog post: *Why
your Shopify pages should keep working when you cancel us.* (See the
build plan, P5 — earned-media phase.) The blog version drops the
file paths, keeps the principles. The principles are the same either
way.
