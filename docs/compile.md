# Compile pipeline (P1.D segment 1)

The compile pipeline turns a `Page` document into a deterministic file
set that segment 2 will write to the merchant's theme via the Asset API.
This document explains the contract between editor state, the shared
section files, and the per-page template JSON.

## Architecture overview

```
Page.source ──compilePage─→ CompileArtifact { files: CompiledFile[] }
                                  │
                                  ├─ sections/demeurer-{type}.liquid  ✕ N (one per used type)
                                  └─ templates/page.demeurer-{handle}.json
                                       (or templates/product.demeurer-{handle}.json)
```

The pipeline is **pure-functional**: no theme reads, no theme writes,
no Shopify API calls. Two compiles of an unchanged page produce
byte-identical files (same `contentHash` arrays). Segment 3's
idempotency check depends on this.

Entry point: `app/lib/compile/compile.ts → compilePage(page)`.

## Files emitted

### `sections/demeurer-{type}.liquid`

The shared section file for one section type — `hero`, `cta-band`, etc.
Same bytes for every merchant. Per-block customization rides in the
page template's `section.settings`, never in the section file itself.

Each shared file follows this skeleton:

```liquid
{%- liquid
  assign scope = section.settings.scope_id | default: 'demeurer-{type}'
-%}
{%- style -%}
  {{ section.settings.mobile_styles }}
  {%- if section.settings.tablet_styles != blank -%}
    @media (min-width: 768px) { .{{ scope }} { {{ section.settings.tablet_styles }} } }
  {%- endif -%}
  {%- if section.settings.desktop_styles != blank -%}
    @media (min-width: 1280px) { .{{ scope }} { {{ section.settings.desktop_styles }} } }
  {%- endif -%}
  {{ section.settings.visibility_styles }}
{%- endstyle -%}

<section class="{{ scope }} demeurer-section demeurer-{type}">
  ... section-specific markup using {{ section.settings.X }} and section.blocks ...
</section>

{% schema %}
{
  "name": "Demeurer {Type}",
  "tag": "section",
  "class": "demeurer-section demeurer-{type}",
  "settings": [ ... schema-derived + the five compile-only settings ... ],
  "blocks": [ ... when the section has list sub-items ... ]
}
{% endschema %}
```

### `templates/page.demeurer-{handle}.json` (landing) or `templates/product.demeurer-{handle}.json` (product)

Standard Shopify JSON template format. One entry under `sections` per
top-level page block. Stable section keys: `main-{first-8-chars-of-block.id}`.

```json
{
  "sections": {
    "main-blk_hero": {
      "type": "demeurer-hero",
      "settings": {
        "alignment": "center",
        "backgroundImage": "",
        "ctaLabel": "Shop now",
        "ctaUrl": "/collections/all",
        "heading": "Welcome home",
        "overlayColor": "#00000040",
        "padding_top": 96, "padding_right": 24, "padding_bottom": 96, "padding_left": 24,
        "subheading": "<p>Subhead.</p>",
        "scope_id": "demeurer-hero-blk_hero_aaaaaaaa",
        "mobile_styles": ".demeurer-hero-blk_hero_aaaaaaaa { padding: 96px 24px 96px 24px;\n  text-align: center; }",
        "tablet_styles": "",
        "desktop_styles": "",
        "visibility_styles": ""
      }
    }
  },
  "order": ["main-blk_hero"]
}
```

For sections with list sub-items (testimonials, FAQ questions, pricing
tiers, logos, features, form fields), each item becomes a Shopify
section block with key `{listKey}-{index}`:

```json
"blocks": {
  "features-0": { "type": "features", "settings": { "icon": "Zap", "title": "Fast", ... } },
  "features-1": { "type": "features", "settings": { "icon": "Shield", "title": "Safe", ... } }
},
"block_order": ["features-0", "features-1"]
```

## The five compile-only settings

Every section's `{% schema %}` declares these AFTER the schema-derived
settings:

| id                  | type     | role |
|---------------------|----------|------|
| `scope_id`          | text     | The unique CSS class for this block (`demeurer-{type}-{blockId}`). |
| `mobile_styles`     | textarea | Full mobile CSS rule with selector and braces. |
| `tablet_styles`     | textarea | Just declarations — section template wraps in `.scope { … }` and `@media (min-width: 768px)`. |
| `desktop_styles`    | textarea | Same, for `@media (min-width: 1280px)`. |
| `visibility_styles` | textarea | Complete CSS for `_visibility` per-breakpoint show/hide. |

Each carries `info: ""` to keep them present in code but unobtrusive in
the theme editor — the values are written by the page template, not by
a human.

## Editor field → Shopify setting mapping

Generic per field kind, in `app/lib/compile/settings-schema.ts`:

| Editor `Field.kind` | Shopify setting type | Notes |
|---|---|---|
| `text`     | `text` (or `textarea` if `max` undefined or > 80) | id = field.key |
| `richtext` | `richtext` | content already serialized HTML |
| `image`    | `image_picker` | value: Shopify CDN ref |
| `url`      | `url` | |
| `select`   | `select` + `options[]` | label/value passthrough |
| `color`    | `color` | hex; theme tokens resolved before compile |
| `number`   | `number` | with min/max/step if present |
| `boolean`  | `checkbox` | |
| `spacing`  | 4 × `number` | keys: `{key}_top` / `{key}_right` / `{key}_bottom` / `{key}_left` |
| `group`    | flatten | child id = `{groupKey}_{childKey}` |
| `list`     | section blocks | child fields generate the block's settings via the same mapping |

## Determinism rules

The compile pipeline is determinism-first. Specifically:

1. **Section templates are static literals** — `buildSectionTemplate()`
   returns the same string for every compile of a given section type.
2. **Stable JSON serialization** — `app/lib/compile/stable-json.ts`
   sorts object keys at every level. The arrays `order` and
   `block_order` preserve user-given order (those are sequences, not
   bags).
3. **Files sorted by path** in the artifact's `files` array.
4. **No timestamps, ids, or environment data inside file content** —
   `compiledAt` lives on the `CompileArtifact`, never inside any file.
5. **Settings record built field-by-field in fixed schema order**;
   compile-only settings appended in fixed order
   (`COMPILE_ONLY_SETTING_KEYS`).
6. **Block keys derived from `block.id`** (cuid; stable across edits).
   First 8 chars are sufficiently unique within one page (32^8 ≈ 1e12
   collision space; pages have at most ~50 blocks). Deterministic
   disambiguation rule: `-{i}` suffix in encounter order.

The snapshot tests at `app/lib/compile/__tests__/compile.test.ts`
include an explicit "compile twice, hashes match" check.

## Trade-offs accepted in segment 1

### Loss of live theme-editor edits for spacing/colors

Before this segment, the per-block `toLiquid` chain (P1.B/P1.C) used the
`mobileLiquid` field on `CssPropMap` so a merchant could nudge a Hero's
padding from the Shopify theme editor without re-publishing from
Demeurer. After segment 1, mobile values are baked into `mobile_styles`
at compile time — theme-editor edits to padding / colors are ignored
until the merchant republishes from Demeurer.

Text/image/url settings remain live: they flow through
`{{ section.settings.X }}` in the section template. Only the CSS values
that affect responsive behavior are baked. This is a deliberate trade
for a simpler determinism story; the merchant should be editing those
in Demeurer (where they have the breakpoint-aware UX) rather than in
the theme editor.

### Validation is via section coerce functions

Each section's `coerceXProps` is the validator: defensive, falls back
to defaults silently. There is no fatal-or-warning validator that runs
before compile. The compile pipeline emits warning diagnostics for
unknown section types and otherwise compiles whatever you give it.
Segment 3 may add a stricter validator.

### `sourceVersion` from `updatedAt`

Initial implementation derives `sourceVersion = page.updatedAt.getTime()`
— monotonic per source mutation, no schema migration needed. If
segment 2 needs a true per-compile counter, add a column.

## Adding a new section

1. Write a new section folder under `app/lib/sections/<type>/` (schema,
   Render, toLiquid, index — see `docs/sections.md`).
2. Write a corresponding section template under
   `app/lib/compile/section-templates/<type>.ts` exporting a
   `SectionTemplate { type, schema, buildSectionTemplate, propMap, toSettings, toBlocks? }`.
3. Add it to the registry at
   `app/lib/compile/section-templates/index.ts`.
4. Run `UPDATE_SNAPSHOTS=1 npm test` to capture the kitchen-sink output
   with the new section, then commit the snapshot diff.

## API endpoint

`GET /app/api/pages/:id/compile` returns the `CompileResult` JSON.
Auth-gated, shop-scoped, never writes to themes. Used by the editor's
"Show compiled output" dev tool and useful for engineer inspection
(`curl …`).

## Dev tool

The "Show compiled output (dev)" button in the page editor toolbar
opens a modal with three tabs: Files, Diagnostics, Metrics. Gated by
`!import.meta.env.PROD` so it dead-codes from the production bundle.
Replaces the per-block "Show Liquid (dev)" tool from P1.B/P1.C.

## Drift detection (P1.D segment 2)

After compile, segment 2 fetches the merchant's published theme and
compares each artifact file against the live theme:

```
CompileArtifact + Theme → DriftReport
                            │
                            ├─ newFiles[]         (will be created)
                            ├─ unchangedFiles[]   (will be skipped)
                            ├─ modifiedFiles[]    (need write; classified)
                            └─ orphanFiles[]      (ours, not in artifact; never deleted)
```

Modified files are classified into:

- **`drifted`** — `ThemeWrite` says we wrote hash X, theme has hash Y ≠ X.
  Manual edit detected. Major severity.
- **`tracked`** — `ThemeWrite` matches theme hash; artifact is just newer.
  Normal publish path. No severity contribution.
- **`stale`** — no `ThemeWrite` record. Could be drift or first publish.
  Minor severity (soft warning).

Hash convention: **md5** matches Shopify's `checksumMd5` field. The
compile artifact's sha256 `contentHash` is internal-only.

Implementation: `app/lib/compile/drift.ts`,
`app/lib/compile/conflict-severity.ts`,
`app/lib/theme/client.server.ts`.

Dev tool: "Show drift (dev)" button → `DriftPanel` modal with
line-by-line diff viewer, lazy-loads per-file content via
`/app/api/pages/{id}/drift/diff?path=...`.

## Publish pipeline (P1.D segment 3)

The apply pipeline closes the loop: compile → drift → write.

```
Page row
  → compilePage() → CompileArtifact            (segment 1)
  → detectDrift() vs published theme           (segment 2)
  → classifyConflicts() → severity gate
  → writeThemeFiles() in phases                (segment 3)
       Phase A: sections/demeurer-*.liquid
       Phase B: snippets/demeurer-*.liquid
       Phase C: templates/{page,product}.demeurer-*.json   (LAST)
  → ThemeWrite.upsert per successful write     (md5 from Shopify)
  → set Page.publishedAt + Page.themeId        (only on full success)
```

**Phase ordering is non-negotiable.** If a section write fails, phase
B and C are skipped — the previous-version page template still
references its (still-present) sections, so the storefront stays
renderable. Idempotent retries pick up where we left off because
`ThemeWrite` records what we wrote and segment 2's drift sees those
files as `tracked` (skipped on the next publish).

**Drift gating**: `severity === "major"` aborts unless the caller
opts in via `{ "acceptDrift": true }` on the publish endpoint. We
never silently overwrite a manual edit.

**Concurrency**: per-`(shop, pageId)` in-memory lock. Second concurrent
publish gets HTTP 409. Single-process only.

**Unpublish**: clears `Page.publishedAt`. Theme files are
**intentionally never deleted** — architectural commitment #1.
`Page.themeId` is preserved.

Implementation: `app/lib/theme/writer.server.ts` (mutation wrapper),
`app/lib/compile/apply.ts` (orchestration),
`app/lib/compile/publish-lock.server.ts` (mutex).

Routes: `app/routes/app.api.pages.$id.publish.ts` (POST),
`app/routes/app.api.pages.$id.unpublish.ts` (POST).

Manual smoke + architectural uninstall test:
`scripts/p1d-segment3-smoke.md`.
