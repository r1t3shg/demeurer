# Demeurer — Project Status

A Shopify landing-page builder. This document tracks foundation setup (P0) and what comes next.

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

## Next 3 things to work on

### 1. Compile pipeline + theme writer (the linchpin) — ~3–5 days

Without this, Demeurer is just a Prisma schema. Build:
- `app/lib/compile.server.ts` — `compile(source: PageSource): { filename: string, liquid: string }`. Pure function; unit-testable. Start with one block type (hero) and a fixed Liquid template; expand block types incrementally.
- `app/lib/theme.server.ts` — `writeSection(adminApi, themeId, filename, liquid)` using Asset API; `removeSection(...)` for in-app page delete; idempotent (write is overwrite-safe).
- A first throwaway route `/dev/compile` that takes a hardcoded `source`, compiles, writes to the dev store's main theme, and prints the resulting filename. Verify in admin **Edit code**.

**Why first:** every other feature depends on the source-tree → Liquid → theme-file path being real and reliable.

### 2. Editor canvas MVP — ~5–8 days

Once compile/write works end-to-end, give the merchant a way to produce `Page.source`:
- Single-page route `/app/pages/:id` with a left rail (block tree), center canvas (rendered preview), right inspector (block props).
- Just two block types to start: **Hero** and **TextBlock**. Add more by extending the JSON schema.
- Autosave to `Page.source` on every change (debounced ~500ms). Don't compile/write on autosave — only on explicit publish.
- No drag-and-drop yet — use up/down arrows on each block in the tree. Drag-and-drop is a polish step.

**Why second:** the canvas closes the loop — merchant edits → Page.source updates → publish writes Liquid. Without it, you can't ship anything to a friendly beta.

### 3. Publish flow + `themes/publish` handler — ~2–3 days

The publish path that ties everything together and honors commitment #3:
- `POST /api/pages/:id/publish` → load `Page` → `compile()` → `writeSection()` → set `publishedAt` + `themeId` → insert `PageVersion` snapshot.
- `app/routes/webhooks.themes.publish.tsx` → list all published `Page` rows for the shop → for each, recompile + write into the newly-published theme. This is what makes "pages survive theme updates because they ARE the theme" actually true.
- `app/routes/webhooks.themes.update.tsx` (lighter — only triggers when *the active theme* is modified by other apps; usually a no-op for us, but log + observe before deciding behavior).

**Why third:** publish is the merchant's mental model of "shipping a page" and the theme-publish hook is the only correct way to keep pages alive across theme switches.

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

**Last updated:** 2026-05-03
