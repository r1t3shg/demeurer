# P1.D segment 3 — manual smoke test

This protocol exercises the publish pipeline end-to-end against a real
Shopify dev store. The architectural test in **step 12** is the
go/no-go gate for segment 3 — if it fails, segment 3 is broken at the
architectural level and we stop.

## Prerequisites

- A Shopify dev store with the Demeurer app installed and running
  (`npm run dev`, accept the tunnel URL, install on the dev store).
- A landing page with at least one Hero section already created via
  the editor (`/app/pages/{id}`).
- The `write_themes` scope granted (already in `shopify.app.toml`)
  AND, per Shopify's docs, the per-app **"exemption from Shopify to
  modify theme files"** in place. **If this exemption is missing,
  step 4 will fail with `auth_error` regardless of correctness.**
- The session cookie from the embedded admin context. Easiest way to
  POST: open the editor in your dev store, copy the request cookies
  from any DevTools Network entry on `/app/api/pages/...`, paste them
  into your curl `-H 'Cookie: ...'`. Or use a REST client that runs
  inside the iframe (a simple one-button "Publish (dev)" component
  could be added next session if curl is too tedious).

## Steps

### 1. Compile the page

```
GET /app/api/pages/{id}/compile
```

**Expect:** JSON with `artifact.files[]` containing
`sections/demeurer-hero.liquid` + `templates/page.demeurer-{handle}.json`.
Hashes are sha256.

- [ ] Pass / Fail: ___

### 2. Drift report (pre-publish)

```
GET /app/api/pages/{id}/drift
```

**Expect:** `drift.newFiles` lists every artifact file (none are in
the theme yet); `unchanged`, `modified`, `orphan` arrays empty;
`severity.severity === "none"`.

- [ ] Pass / Fail: ___

### 3. Publish

```
POST /app/api/pages/{id}/publish
Content-Type: application/json
{ }
```

**Expect:** HTTP 200, `{ ok: true, result: { status: "success",
written: [ ... section + template ... ], failed: [], skipped: [] } }`.

- [ ] Pass / Fail: ___

### 4. Verify in the theme code editor

In Shopify admin → Online Store → Themes → ⋯ on the published theme
→ **Edit code**.

**Expect:**
- `sections/demeurer-hero.liquid` exists. Open it; the `{% schema %}`
  block at the bottom declares the hero settings + the five compile-
  only settings (`scope_id`, `mobile_styles`, `tablet_styles`,
  `desktop_styles`, `visibility_styles`).
- `templates/page.demeurer-{handle}.json` exists. Open it; the
  `sections.main-{first-8}.settings` block has the heading / cta /
  padding / mobile_styles populated from your editor edits.

- [ ] Pass / Fail: ___

### 5. Verify on the storefront

Visit `https://{shop}.myshopify.com/pages/{handle}` (the page slug
matches the editor's `handle`).

**Expect:** the hero renders styled per the merchant's theme tokens.
Background image / overlay / CTA all in place.

If the page 404s: Shopify's page → template binding might need a
`Page` row in the merchant's content. The MVP assumes the merchant
created a Shopify Online Store page with the same handle and selected
the `demeurer-{handle}` template; document this in segment 4's UI.

- [ ] Pass / Fail: ___

### 6. Re-publish unchanged

`POST /app/api/pages/{id}/publish` with the same body.

**Expect:** `{ ok: true, result: { status: "success", written: [],
skipped: [ ... all artifact files ... ] } }`. **Idempotency** — the
artifact's md5s match the theme's md5s, so nothing is written.

- [ ] Pass / Fail: ___

### 7. Edit the hero and re-publish

In the editor, change the heading. Wait for autosave. POST publish
again.

**Expect:**
- The section file is **unchanged** (shared template — same bytes).
- The page template is **modified**, classification `tracked` (we
  wrote what's currently in the theme; the artifact is just newer).
  Severity stays "none".
- One write happens (page template only).
- `result.written.length === 1`, the path being
  `templates/page.demeurer-{handle}.json`.

- [ ] Pass / Fail: ___

### 8. Manually edit `sections/demeurer-hero.liquid` in the theme editor

Add a comment like `<!-- merchant edit -->` at the bottom and save.

### 9. Drift report sees the manual edit

```
GET /app/api/pages/{id}/drift
```

**Expect:** the section file appears in `drift.modifiedFiles` with
`classification: "drifted"` (we last wrote a different md5 than what's
currently there). `severity.severity === "major"`.

- [ ] Pass / Fail: ___

### 10. Publish without acceptDrift → blocked

```
POST /app/api/pages/{id}/publish
{ }
```

**Expect:** HTTP 409, `{ ok: false, reason: "drift", report: { ... },
severity: { severity: "major", ... } }`. Theme file is **unchanged**;
the merchant's manual edit survives.

- [ ] Pass / Fail: ___

### 11. Publish with `acceptDrift: true` → overwrite

```
POST /app/api/pages/{id}/publish
{ "acceptDrift": true }
```

**Expect:** HTTP 200, `result.status === "success"`. The section file
in the theme code editor reverts to the artifact bytes (manual edit
gone). The corresponding `ThemeWrite` row's `contentHash` updates to
the new md5.

In Prisma Studio (`npx prisma studio`), the `ThemeWrite` table has
one row per published file with the right hash + `pageId` (null for
sections, set for the template).

- [ ] Pass / Fail: ___

---

## Step 12 — THE ARCHITECTURAL TEST (go/no-go gate)

**This single test validates the most important commitment in the
project. If it fails for any reason, segment 3 is broken and we stop.**

### Setup

The page from steps 1–11 is published. Storefront URL renders.

### Test

1. Confirm the storefront page still renders (visit the URL).
2. **Uninstall Demeurer** from the dev store: Settings → Apps and
   sales channels → Demeurer → Uninstall.
3. **Refresh the storefront page.** It MUST still render unchanged.
4. Open the theme code editor (Online Store → Themes → ⋯ → Edit code).
   `sections/demeurer-hero.liquid` and the page template MUST still
   be there, intact.
5. Check the dev tunnel logs for the `app/uninstalled` webhook firing.
   Confirm only the `Session` row was deleted (the webhook handler at
   `app/routes/webhooks.app.uninstalled.tsx` says "MUST NOT touch
   themes / Pages / PageVersions / ThemeWrite").

### Result

- [ ] PASS — page still renders, theme files intact, only Session
      deleted. The architectural commitment holds.
- [ ] FAIL — any of: page broken, files missing, other DB rows
      deleted. **STOP** — diagnose before any further work.

If FAIL, the most likely culprits:
- `webhooks.app.uninstalled.tsx` deleted more than it should have
- A theme file got deleted by something that shouldn't have run
- The page's storefront template binding broke because the theme
  changed (less likely, but worth checking the page handle in the
  Shopify admin)

---

## Result template (paste into PROJECT_STATUS.md after running)

```
P1.D segment 3 manual smoke (run on YYYY-MM-DD):

Steps 1–11: PASS / FAIL
Step 12 (architectural uninstall test): PASS / FAIL

Notes:
  - Exemption-from-Shopify-on-themeFilesUpsert: granted / pending / unknown
  - Any unexpected behavior:
```
