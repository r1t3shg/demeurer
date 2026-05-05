# P1.D exit gate — manual verification protocol

The single most important verification in the entire project. Walk
every item; document the result. **If anything fails: STOP, diagnose,
fix, re-run.** The architectural commitments must hold to ship P1.D.

## Prerequisites

- Two themes installed on the dev store: **Dawn** and **Sense** (or
  any second theme — Sense is recommended because it differs
  noticeably from Dawn).
- The Demeurer app running (`npm run dev`, accept the tunnel URL,
  install on the dev store).
- A test page with content covering all 12 section types — call it
  the "kitchen sink" page. Use the catalog (`/app/catalog`) to seed
  one quickly.
- The `themeFilesUpsert` mutation exemption granted to the dev app
  (per Shopify docs requirement). If publish fails with `auth_error`,
  this is the reason.

Mark each box: `[ PASS ]`, `[ FAIL ]`, or `[ N/A ]`.

---

## ARCHITECTURAL COMMITMENT VERIFICATION

### (1) Pages keep working after uninstall

[ __ ] Publish a page with each of the 12 section types
[ __ ] Verify storefront URL (`https://{shop}/pages/{handle}`) renders correctly
[ __ ] Uninstall Demeurer (Settings → Apps → Demeurer → Uninstall)
[ __ ] Verify all 12 section types still render unchanged
[ __ ] Check theme code editor: all `demeurer-*` files still present
[ __ ] Check Shopify webhook log: `app/uninstalled` fired and ONLY the
       `Session` row was deleted (Pages, PageVersions, ThemeWrites,
       Publishes, theme files all preserved)
[ __ ] Wait 24 hours; verify storefront URL still renders
       (no time-bomb logic, no scheduled job)

**Result on Dawn:** _____
**Result on second theme (___________):** _____

### (2) No runtime JavaScript injection

[ __ ] On a published page, view source (`view-source:` URL prefix)
[ __ ] Search for `<script src=` — verify NO scripts pointing to our
       tunnel/cloud domain
[ __ ] Search for `fetch(` — verify NO calls to our domain
[ __ ] Open DevTools Network tab during page load
[ __ ] Confirm zero requests to demeurer.app or the tunnel URL
[ __ ] The Pricing toggle inline JS (~15 lines, scoped to its
       `{% if section.settings.billingToggle %}` block) is the ONLY
       JS we emit — verify it's only present when that section is
       used AND the toggle is enabled

**Result:** _____

### (3) Pages survive theme updates

[ __ ] Publish a page to theme A (Dawn)
[ __ ] Confirm storefront URL renders
[ __ ] In Shopify admin, switch published theme to theme B (Sense)
[ __ ] Webhook `themes/publish` fires (check tunnel logs)
[ __ ] Open the page in the editor — banner appears:
       "This page was published to a theme that's no longer your
        live theme. Re-publish to apply it to your current theme."
[ __ ] Pages list (`/app`) shows ⚠ Different theme badge for the page
[ __ ] Top of `/app` shows the "X pages published to a previous theme"
       notification with `Show affected pages` link
[ __ ] Click "Re-publish to current theme" on the editor banner
[ __ ] Pre-publish dialog confirms theme name = Sense
[ __ ] Publish succeeds; banner disappears; pages-list badge returns
       to normal Published
[ __ ] Storefront URL on Sense renders the page correctly
[ __ ] Switch back to theme A (Dawn) — page on Dawn still works
       (legacy theme files were never removed)

**Result:** _____

### (4) No page-speed penalty

Run Lighthouse on a Demeurer-published kitchen-sink page (all 12
sections, realistic content). Compare to a baseline page in the
same theme without Demeurer sections.

Document numbers in `scripts/lighthouse-benchmark.md`. Target:

[ __ ] Mobile Performance ≥ 95
[ __ ] Mobile Accessibility ≥ 95
[ __ ] Mobile Best Practices ≥ 95
[ __ ] Mobile SEO ≥ 95
[ __ ] Gap to baseline (same theme, no Demeurer): < 5 points
[ __ ] Total page weight: reasonable for 12 sections of content
[ __ ] No unused JS in the Coverage tab

**Result (mobile Performance):** _____
**Gap to baseline:** _____

---

## PUBLISH FLOW VERIFICATION

[ __ ] First publish of a fresh page works (toast + first-publish
       modal appears)
[ __ ] Re-publish with no edits: idempotent — `result.written.length === 0`
       and `skipped.length === artifact.files.length`
[ __ ] Re-publish with edits writes only the page template (the
       section file is parameterless and unchanged)
[ __ ] Drift on a section is detected and surfaced in the pre-publish
       drift dialog with `View changes` and inline diff
[ __ ] Drift acceptance overwrites the file; the corresponding
       `ThemeWrite.contentHash` updates (verify in Prisma Studio)
[ __ ] Partial failure: simulate by manually deleting one of our
       sections AND introducing a syntax error somewhere; verify the
       partial-failure modal lists the failed file
[ __ ] Retry from the partial modal succeeds (the partial state
       becomes `tracked` drift on retry → minor severity → publishes)
[ __ ] Two concurrent publishes for the same page: first succeeds,
       second gets HTTP 409 `publish_in_progress`
[ __ ] Two concurrent publishes for DIFFERENT pages: both succeed
       independently
[ __ ] Unpublish hides the page from `/pages/{handle}` but `demeurer-*`
       files remain in the theme code editor
[ __ ] First-publish modal appeared on the very first publish for
       this dev store, and only on the first

**Result:** _____

---

## RECOVERY VERIFICATION

[ __ ] Theme switch detected via webhook → `Page.themeMismatch = true`
       (verify in Prisma Studio)
[ __ ] Editor banner shows; click Re-publish; success
[ __ ] After re-publish: `Page.themeMismatch = false`, `Page.themeId`
       updated to new theme's gid
[ __ ] Bulk re-publish: create 5+ mismatched pages (publish each to
       Dawn, switch to Sense), introduce a deliberate failure on one
       (e.g., put a syntax error in the page source so compile-or-
       publish fails). Run `Re-publish all` from
       `/app/pages/theme-mismatch`. Verify:
       - Progress bar walks the list
       - Failed page stays flagged (`themeMismatch: true`)
       - Other pages succeed (`themeMismatch: false`)
       - Summary banner: `4 succeeded, 1 failed`

**Result:** _____

---

## DESTRUCTION RESISTANCE

[ __ ] Manually delete `sections/demeurer-hero.liquid` from the theme
       code editor
[ __ ] Open `/app/api/pages/{id}/drift` — the deleted file appears as
       `newFiles` (artifact has it; theme doesn't)
[ __ ] Click Publish → drift dialog confirms creation; publish
       succeeds; file restored

**Result:** _____

[ __ ] Manually edit `sections/demeurer-hero.liquid` (introduce a
       comment or whitespace change)
[ __ ] Drift detection on next publish flags it as `drifted`
       (severity: major)
[ __ ] Pre-publish drift dialog shows `View changes` → inline diff
[ __ ] "Replace with my Demeurer version" overwrites; theme file
       returns to artifact bytes

**Result:** _____

---

## REGRESSION

[ __ ] P1.A chaos test: 5 rounds, no data loss
       (`scripts/p1a-chaos-test.md` — pick 5 random rounds across
       the 5 categories)
[ __ ] P1.B catalog page works (`/app/catalog` lists all 12 sections,
       "Add to a new page" creates a fresh page seeded with that
       section)
[ __ ] P1.C responsive overrides survive a publish/edit/republish
       cycle:
       - Create a hero with a tablet padding override
       - Publish
       - View source on the storefront — confirm the section's
         `{% style %}` block contains the `@media (min-width: 768px)`
         rule with the tablet padding declarations and `!important`
       - Edit the override; re-publish
       - View source again — confirm the new value is in the @media
         block

**Result:** _____

---

## CODE-SIDE CHECKS (pre-filled where the agent could verify)

These were verified by the agent before handing off to the merchant:

[ PASS ] `npm run typecheck` clean (modulo 3 pre-existing errors in
         `app/routes/app.tsx` and `app/shopify.server.ts`)
[ PASS ] `npm test` — all green (target: 94 / 94 after segment 5)
[ PASS ] All dev tools gated by `import.meta.env.PROD` /
         `process.env.NODE_ENV !== "production"` (verified via grep:
         CompiledOutput, DriftPanel, Simulate crash, catalog route)
[ PASS ] Logging audit: no merchant page contents or file contents
         logged at any level. Webhook logs include topic + shop only
         (operationally useful, low sensitivity). Error paths log
         error objects only.
[ PASS ] `npx prisma format` — schema is clean
[ PASS ] `npx prisma migrate deploy` ready — three migrations
         (`add_pages_and_versions`, `add_theme_writes`,
         `add_publishes`, `add_theme_mismatch`) apply cleanly

---

## RESULTS (paste into PROJECT_STATUS.md after running)

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

If any item failed and isn't a documented acceptable trade-off,
**P1.D is not shippable**. Diagnose, fix, re-run.
