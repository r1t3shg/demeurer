# Section authoring guide

How to add a new section to Demeurer, and the rules every section must
follow. Read this start-to-finish before adding your first one — the
dual-rendering contract and the architectural commitments are the parts
people get wrong if they only skim.

---

## File layout

Each section lives in its own folder under `app/lib/sections/<type>/`:

```
app/lib/sections/<type>/
├── index.ts        # SectionDefinition export — wires the rest together
├── schema.ts       # TYPE constant, Props type, defaults, coerce, schema
├── Render.tsx      # Canvas-only React preview
└── toLiquid.ts     # Compile to native Shopify section (schema + template)
```

Optional helpers live alongside (e.g. `parse.ts` in `video/`,
`Render.tsx` sub-components, etc.). Shared utilities go in
`app/lib/sections/_shared/` — currently `coerce.ts` (defensive prop
coercion) and `quality.ts` (WCAG contrast calculator).

The section is then registered once in `app/lib/sections/index.ts`:

```ts
import { myThingDefinition } from "./my-thing";
// ...
registerSection(myThingDefinition);
```

If you don't add the `registerSection` call, the editor will surface
`Unknown section type` when the merchant tries to insert the block.

---

## The dual-rendering contract

This is the most important rule. **Every section ships TWO renderers:**

| Renderer | Where it runs | What it produces |
|---|---|---|
| `Render.tsx` (React) | Editor canvas only | A React component the merchant sees while authoring |
| `toLiquid.ts` (pure function) | Compile pipeline (P1.D) | A Shopify section file — `{% schema %}` + Liquid template — that runs on the live storefront |

These two renderers **must produce semantically equivalent output**:
same heading, same image, same CTA, same number of testimonials, same
visual layout. Pixel-perfect parity is not required — small differences
(different font fallbacks, sanitized vs. raw HTML preview) are fine.

The reason for two renderers is the **architectural commitment**:
*pages keep rendering after uninstall, with no runtime JS injected by
Demeurer*. The published page is pure Liquid, written into the
merchant's theme. Demeurer doesn't proxy requests, doesn't inject
script tags, and doesn't have a runtime on the storefront. So we
can't reuse the React component on the live page — it has to be
compiled to Liquid ahead of time.

**Why not skip the React renderer and live-preview the Liquid?**
Liquid only runs in Shopify's render pipeline, against a real shop's
data. The editor canvas needs to update on every keystroke without a
storefront round-trip; React + the section's `Render` is what lets us
do that. The iframe theme-preview (segment 3) gives a closer-to-real
preview but is too slow for live editing.

If your two renderers diverge significantly, the merchant's experience
will be "what I saw in the editor isn't what got published" — the
worst possible builder bug. Always change both files together. PR
reviewers should bounce a one-sided change.

---

## Theme tokens

`Render` receives `themeTokens: ThemeTokens`. Available shapes:

```ts
themeTokens.colors.background   // "#ffffff"
themeTokens.colors.text         // "#1a1a1a"
themeTokens.colors.accent       // "#1a73e8"
themeTokens.typography.headingFont   // "Georgia, serif"
themeTokens.typography.bodyFont      // "system-ui, ..."
themeTokens.typography.scale         // 1 (multiplier on base font size)
themeTokens.spacing.unit             // 8 (px)
```

These come from the merchant's live theme (segment 3 plumbing). Use them
for any color/font/spacing that should respect the theme. Use literal
hex / px only for things that should stay constant regardless of theme
(e.g. status banner colors, badge backgrounds).

In `toLiquid`, theme tokens flow naturally because Liquid runs *inside*
the merchant's theme — `font_family` settings, `--demeurer-accent`
CSS variables, etc. Don't hard-code colors that the merchant set in the
theme editor.

---

## Liquid output rules

These are non-negotiable. Reviewers will reject PRs that violate them.

- **Must be valid `{% schema %}` + template.** The schema JSON object
  becomes the Shopify section schema; the template string is the
  Liquid body. Both should pass theme save without errors.
- **Use `image_url` for images.** Always. `{{ image | image_url:
  width: 1600 }}`, never raw asset URLs. This is what gives merchants
  responsive `srcset` and CDN delivery.
- **Use `image_tag` for the `<img>` element.** Threads `loading`,
  `widths`, `sizes`, and `alt` properly.
- **Must NOT load external scripts.** No `<script src="https://..."
  >`, no analytics pixels, no chat widgets. Storefront performance
  budget is sacred.
- **Must NOT load external fonts.** Use `font_family` settings if the
  merchant should be able to choose, otherwise inherit from the theme.
  Web fonts are the merchant's problem, not ours.
- **Forms use Shopify native `{% form %}` tags.** `'contact'`,
  `'create_customer'`, `'customer'` (newsletter via tagged customer).
  Form submissions must keep working after uninstall — that means they
  flow through Shopify's endpoints, never through a Demeurer server.
- **Inline JS must be minimal and scoped.** The Pricing section is the
  only one currently shipping JS — ~15 lines, gated by an `if
  show_billing_toggle`, scoped to `[data-section-id="{{ section.id }}"]`
  so two pricing sections on one page don't collide. If you need more
  than ~20 lines, stop and ask.
- **Use logical properties for RTL.** `padding-inline-start` not
  `padding-left`, `margin-inline: auto` not `margin: 0 auto`,
  `text-align: start` not `text-align: left`. Same rule applies in
  the React `Render`.
- **Escape user content.** `| escape` on every text setting that
  becomes an HTML attribute or text node. Richtext fields are an
  exception (the field renderer pre-sanitizes them).

---

## Adding a section: step-by-step

Worked example: a hypothetical "Stats counter" section showing 3-4
big numbers with labels. Follow this template for any new section.

### 1. Create `app/lib/sections/stats-counter/schema.ts`

```ts
import { coerceList, num, str } from "../_shared/coerce";
import type { SectionSchema } from "../types";

export const STATS_COUNTER_TYPE = "stats-counter";

export interface StatsCounterStat {
  value: string;
  label: string;
}

export interface StatsCounterProps {
  heading: string;
  stats: StatsCounterStat[];
  padding: { top: number; right: number; bottom: number; left: number };
}

export const statsCounterDefaults: StatsCounterProps = {
  heading: "Trusted by makers worldwide",
  stats: [
    { value: "10k+", label: "Happy customers" },
    { value: "99.9%", label: "Uptime" },
    { value: "24/7", label: "Support" },
  ],
  padding: { top: 64, right: 24, bottom: 64, left: 24 },
};

export function coerceStatsCounterProps(
  input: Record<string, unknown>,
): StatsCounterProps {
  // Defensive coercion. Editor `props` bag is `Record<string, unknown>` —
  // coerce every field to its expected type with a fallback. This makes
  // the section robust against schema migrations.
  const stats = coerceList<StatsCounterStat>(
    input.stats,
    statsCounterDefaults.stats,
    (item) => ({
      value: str(item.value, ""),
      label: str(item.label, ""),
    }),
    4, // max items
  );
  // ... etc
  return { /* ... */ };
}

export const statsCounterSchema: SectionSchema = {
  fields: [
    { kind: "text", key: "heading", label: "Heading" },
    {
      kind: "list",
      key: "stats",
      label: "Stats",
      maxItems: 4,
      itemSchema: [
        { kind: "text", key: "value", label: "Value" },
        { kind: "text", key: "label", label: "Label" },
      ],
    },
    { kind: "spacing", key: "padding", label: "Padding" },
  ],
};
```

### 2. Create `app/lib/sections/stats-counter/Render.tsx`

```tsx
import type { SectionRenderProps } from "../types";
import { coerceStatsCounterProps } from "./schema";

export function StatsCounterRender({ props, themeTokens }: SectionRenderProps) {
  const p = coerceStatsCounterProps(props);
  return (
    <section
      style={{
        paddingTop: p.padding.top,
        paddingInlineEnd: p.padding.right,
        paddingBottom: p.padding.bottom,
        paddingInlineStart: p.padding.left,
        backgroundColor: themeTokens.colors.background,
        color: themeTokens.colors.text,
        textAlign: "center",
      }}
    >
      <h2 style={{ fontFamily: themeTokens.typography.headingFont }}>
        {p.heading}
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${p.stats.length}, 1fr)`,
          gap: 24,
          marginTop: 32,
        }}
      >
        {p.stats.map((s, i) => (
          <div key={i}>
            <div style={{ fontSize: 48, fontWeight: 700 }}>{s.value}</div>
            <div style={{ opacity: 0.7 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
```

### 3. Create `app/lib/sections/stats-counter/toLiquid.ts`

```ts
import type { LiquidOutput, ToLiquidContext } from "../types";
import { coerceStatsCounterProps, statsCounterDefaults } from "./schema";

export function statsCounterToLiquid(
  rawProps: Record<string, unknown>,
  ctx: ToLiquidContext,
): LiquidOutput {
  const props = coerceStatsCounterProps(rawProps);

  const schema = {
    name: "Stats counter",
    tag: "section",
    class: `demeurer-section demeurer-${ctx.sectionType}`,
    settings: [
      { type: "text", id: "heading", label: "Heading", default: statsCounterDefaults.heading },
      { type: "range", id: "padding_top", label: "Padding top", min: 0, max: 240, step: 4, unit: "px", default: statsCounterDefaults.padding.top },
      { type: "range", id: "padding_bottom", label: "Padding bottom", min: 0, max: 240, step: 4, unit: "px", default: statsCounterDefaults.padding.bottom },
      { type: "range", id: "padding_x", label: "Padding (sides)", min: 0, max: 96, step: 4, unit: "px", default: statsCounterDefaults.padding.left },
    ],
    blocks: [
      {
        type: "stat",
        name: "Stat",
        settings: [
          { type: "text", id: "value", label: "Value" },
          { type: "text", id: "label", label: "Label" },
        ],
      },
    ],
    max_blocks: 4,
    presets: [
      {
        name: "Stats counter",
        blocks: props.stats.map((s) => ({
          type: "stat",
          settings: { value: s.value, label: s.label },
        })),
      },
    ],
  };

  const template = `
<div
  class="demeurer-stats-counter"
  style="
    padding: {{ section.settings.padding_top }}px {{ section.settings.padding_x }}px {{ section.settings.padding_bottom }}px;
    text-align: center;
  "
>
  {%- if section.settings.heading != blank -%}
    <h2 style="margin: 0 0 32px 0;">{{ section.settings.heading | escape }}</h2>
  {%- endif -%}
  <div
    style="
      display: grid;
      grid-template-columns: repeat({{ section.blocks.size | at_most: 4 }}, 1fr);
      gap: 24px;
      max-width: 1200px;
      margin-inline: auto;
    "
  >
    {%- for block in section.blocks -%}
      <div {{ block.shopify_attributes }}>
        <div style="font-size: 48px; font-weight: 700;">{{ block.settings.value | escape }}</div>
        <div style="opacity: 0.7;">{{ block.settings.label | escape }}</div>
      </div>
    {%- endfor -%}
  </div>
</div>
`.trim();

  return { schema, template };
}
```

### 4. Create `app/lib/sections/stats-counter/index.ts`

```ts
import type { SectionDefinition } from "../types";
import { StatsCounterRender } from "./Render";
import {
  STATS_COUNTER_TYPE,
  statsCounterDefaults,
  statsCounterSchema,
} from "./schema";
import { statsCounterToLiquid } from "./toLiquid";

export const statsCounterDefinition: SectionDefinition = {
  type: STATS_COUNTER_TYPE,
  label: "Stats counter",
  description:
    "A row of 3–4 big numbers with labels. Use it to communicate scale, reliability, or growth at a glance.",
  icon: "TrendingUp",
  category: "content",
  schema: statsCounterSchema,
  defaults: { ...statsCounterDefaults },
  Render: StatsCounterRender,
  toLiquid: statsCounterToLiquid,
};
```

### 5. Register in `app/lib/sections/index.ts`

```ts
import { statsCounterDefinition } from "./stats-counter";
// ...
registerSection(statsCounterDefinition);
```

### 6. Verify

- Open the catalog page (`/app/catalog`) — your section appears with a
  thumbnail.
- Click "Add to a new page" — page is created and opens in the editor.
- Edit a property — the canvas updates immediately.
- Open the dev-only "Show Liquid" inspector in Properties — confirm
  `template` and `schema` look right.
- Manual paste-test (P1.D will automate this): copy `template` into a
  `sections/demeurer-stats-counter.liquid` file in the dev store theme,
  add `{% schema %}{...}{% endschema %}` at the bottom, save, add to
  a JSON template, and confirm it renders on the storefront.

---

## Responsive design (P1.C)

Sections support per-breakpoint overrides on every editable field
(except those flagged structural — see below). Three fixed breakpoints,
mobile-first cascade, pure CSS media queries. **No JavaScript runs on
the storefront for responsive behavior.**

### The breakpoints

| Name | Min width | Source |
|---|---|---|
| Mobile | 0 (base) | canonical layer; always present |
| Tablet | `≥ 768px` | sparse override layer |
| Desktop | `≥ 1280px` | sparse override layer |

These are non-negotiable. The helpers do not accept a fourth. We do
not support container queries or fluid `clamp()` scales.

### Authoring `toLiquid` for responsiveness

Every section's `toLiquid` follows this shape:

```ts
import {
  emitResponsiveCSS,
  emitVisibilityCSS,
  scopeClass,
  wrapStyle,
  type CssPropMap,
} from "../_shared/responsive-css";

export function myToLiquid(
  propsByBreakpoint: PropsByBreakpoint,
  ctx: ToLiquidContext,
): LiquidOutput {
  const props = coerceMyProps(propsByBreakpoint.mobile);
  const scope = scopeClass(ctx.sectionType, ctx.blockId);

  const propMap: CssPropMap[] = [
    {
      propKey: "padding",
      cssProperty: "padding",
      toCss: (v) => {
        const p = v as SpacingValue;
        return `${p.top}px ${p.right}px ${p.bottom}px ${p.left}px`;
      },
    },
    {
      propKey: "alignment",
      cssProperty: "text-align",
      toCss: textAlignLogical,
    },
  ];

  const overrideCss = emitResponsiveCSS(scope, propsByBreakpoint, propMap);
  const visibilityCss = emitVisibilityCSS(scope, propsByBreakpoint);
  const styleBlock = wrapStyle(
    [overrideCss, visibilityCss].filter(Boolean).join("\n"),
  );

  // styleBlock goes at the top of the template; scope class goes on
  // the section root.
  const template = `
${styleBlock}
<div class="${scope} demeurer-my-section" style="...">
  ...
</div>
  `.trim();

  return { schema, template };
}
```

Key rules:

- **Scope class on the root.** `demeurer-<type>-<blockId>` is generated
  by `scopeClass`. Without it, `@media` overrides wouldn't be able to
  target a specific block instance.
- **Mobile values via inline `style="..."`** driven by Liquid runtime
  (`section.settings.foo`). This keeps theme-editor edits live for
  mobile. Tablet/desktop overrides bake compile-time and use
  `!important` to win specificity.
- **Empty when no overrides.** A freshly-built page emits no
  `{% style %}` block at all — the published Liquid is indistinguishable
  from a hand-written section.

### Worked example: Hero padding override

A merchant authors:

```ts
{
  mobile: { padding: { top: 96, right: 24, bottom: 96, left: 24 } },
  tablet: { padding: { top: 64, right: 24, bottom: 64, left: 24 } },
}
```

The compiled section file looks like:

```liquid
{%- style -%}
@media (min-width: 768px) {
  .demeurer-hero-cltf3a8q9 {
    padding: 64px 24px 64px 24px !important;
  }
}
{%- endstyle -%}

<div
  class="demeurer-hero-cltf3a8q9 demeurer-hero ..."
  style="padding-top: {{ section.settings.padding_top }}px; ..."
>
  ...
</div>
```

At <768px the inline mobile style wins (96px). At ≥768px the @media
rule wins (64px) via `!important`.

### Content vs style overrides

Content edits (heading text, image URLs, list-item additions) are
authored at mobile and shared across breakpoints. Tablet/desktop layers
are reserved for **style** overrides — padding, alignment, visibility,
and similar presentational fields. The inspector enforces this with a
"Same on all breakpoints" badge on structural fields.

### Non-responsive (structural) fields

Some fields' meaning would change if the value differed per device. We
mark these `responsive: false` on the schema and the inspector renders
them read-only at tablet/desktop:

| Section | Field | Why |
|---|---|---|
| Form | `formType` | A different submission target per device makes no sense. |
| Form | `fields[]` | Different field set per device creates duplicate content trees. |
| Custom HTML | `html` | Per-device markup creates duplicate content trees. |
| Custom HTML | `notes` | Internal merchant note; not user-facing. |
| Spacer | `showDivider` | Toggling a divider's existence per breakpoint is a different section. |
| Spacer | `dividerColor` | Color is per-design, not per-breakpoint. |
| Spacer | `dividerWidth` | Same as above. |

Layout-changing select fields (Feature list `layout`, Testimonial
`layout`, Logo wall `layout`, Video `aspectRatio`) are also de-facto
non-responsive in P1.C — their CSS targets inner elements that the
shared helper does not scope to. Per-breakpoint column count is a
documented future enhancement.

### Visibility

`_visibility: false` at any layer hides the section at that breakpoint
upward (cascade applies). The helper emits a `display: none !important`
rule only at the breakpoint where visibility CHANGES; if visibility
flips back from hidden to visible at a later breakpoint, the helper
emits `display: revert !important`.

### Architectural commitment

**Every responsive override is plain CSS.** There is no path through
the helpers to emit JS for responsive behavior. The Pricing
billing-toggle (~15 lines, opt-in) remains the only inline JS in any
section. If you find yourself wanting a `ResizeObserver` or a `match
Media` listener for layout, the right move is to add a CSS-only
solution or document a non-responsive limitation.

---

## What NOT to do

- Don't add a 13th section just because adding one is now easy. The
  discipline of stopping at twelve is the whole positioning — Demeurer
  is not a "section marketplace", it's a curated set that ships
  fast pages.
- Don't bypass the registry — never `import { HeroRender }` directly
  from a feature module. Always go through `getSection(type)`.
- Don't reach into another section's folder. Each section is
  self-contained; if you need a behavior in two sections, lift it to
  `_shared/`.
- Don't ship a section without a `description` — it's required and the
  catalog and (eventually) section picker depend on it.
- Don't add a section that requires a runtime JS framework (React on
  the storefront, htmx, alpine, …). Inline `<script>` is the only escape
  hatch and it should be ~15 lines max, scoped to `section.id`.
