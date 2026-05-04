/**
 * Section authoring framework — type definitions.
 *
 * A "section" is a reusable building block (Hero, Testimonials, FAQ, …)
 * that the merchant adds to a Demeurer page. Every section is declared
 * once via a `SectionDefinition` and registered in
 * `app/lib/sections/index.ts`. The framework wires the rest:
 *  - the editor canvas calls `Render` with current props for live preview,
 *  - the compile pipeline (P1.D) calls `toLiquid` to emit a native Shopify
 *    section file (`{% schema %}` + Liquid template) for publishing.
 *
 * Architectural commitment: the React `Render` function is for the canvas
 * ONLY. Published pages are pure Liquid output — no runtime JS injected
 * by Demeurer. If a section needs interactivity on the live storefront,
 * `toLiquid` must emit Liquid + small inline `<script>` tags scoped to
 * the section, exactly as a hand-written Shopify section would do.
 */

import type { ComponentType, ReactNode } from "react";

import type { PropsByBreakpoint } from "../editor/types.ts";

/** Section icon — a lucide-react icon name (e.g. "Sparkles", "Image"). */
export type IconName = string;

export type SectionCategory =
  | "layout"
  | "content"
  | "media"
  | "form"
  | "advanced";

/** Theme tokens passed into Render so the canvas matches the live theme. */
export interface ThemeTokens {
  colors: {
    background: string;
    text: string;
    accent: string;
    [key: string]: string;
  };
  typography: {
    headingFont: string;
    bodyFont: string;
    /** Multiplier on the base font size. 1 = default. */
    scale: number;
  };
  spacing: {
    /** Base spacing unit in px. */
    unit: number;
  };
}

/* ------------------------------ Field types ------------------------------ */

/** Base for every field. */
interface FieldBase {
  /** Object key on the section's props bag. */
  key: string;
  /** Human-readable label for the inspector. */
  label: string;
  /**
   * Whether this field is editable at tablet/desktop as a per-breakpoint
   * override. Default `true`. Set to `false` for STRUCTURAL fields whose
   * meaning would change if the value differed per device — e.g. a
   * form's `formType` (different submission targets per device makes
   * no sense), Custom HTML's markup (creates duplicate content trees),
   * or a spacer's divider toggle.
   *
   * When false:
   *  - The field is editable only at mobile.
   *  - At tablet/desktop the inspector renders it read-only with a
   *    "Same on all breakpoints" badge.
   *  - The "Apply to" inline confirmation never appears for this field.
   */
  responsive?: boolean;
}

/**
 * `field.responsive === false` is opt-out — most fields are responsive.
 */
export function isResponsiveField(field: { responsive?: boolean }): boolean {
  return field.responsive !== false;
}

export interface TextField extends FieldBase {
  kind: "text";
  placeholder?: string;
  max?: number;
  default?: string;
}

export interface RichtextField extends FieldBase {
  kind: "richtext";
  default?: string;
}

export interface ImageField extends FieldBase {
  kind: "image";
  /** Default is a Shopify CDN URL string; "" means unset. */
  default?: string;
}

export interface UrlField extends FieldBase {
  kind: "url";
  default?: string;
}

export interface SelectFieldOption {
  value: string;
  label: string;
}

export interface SelectField extends FieldBase {
  kind: "select";
  options: SelectFieldOption[];
  default?: string;
}

export interface ColorField extends FieldBase {
  kind: "color";
  /** Hex string ("#001122") or theme token reference ("theme.colors.accent"). */
  default?: string;
}

export interface NumberField extends FieldBase {
  kind: "number";
  min?: number;
  max?: number;
  step?: number;
  default?: number;
}

export interface BooleanField extends FieldBase {
  kind: "boolean";
  default?: boolean;
}

export interface SpacingValue {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface SpacingField extends FieldBase {
  kind: "spacing";
  default?: SpacingValue;
}

export interface GroupField extends FieldBase {
  kind: "group";
  fields: Field[];
}

export interface ListField extends FieldBase {
  kind: "list";
  /** Schema for each item in the list. */
  itemSchema: Field[];
  maxItems?: number;
  default?: Record<string, unknown>[];
}

export type Field =
  | TextField
  | RichtextField
  | ImageField
  | UrlField
  | SelectField
  | ColorField
  | NumberField
  | BooleanField
  | SpacingField
  | GroupField
  | ListField;

export interface SectionSchema {
  fields: Field[];
}

/* ------------------------------ Render side ----------------------------- */

export interface SectionRenderProps {
  /** The block's props bag — shape is whatever the section's schema declares. */
  props: Record<string, unknown>;
  /** Live theme tokens. Stub values during P1.B until iframe preview lands. */
  themeTokens: ThemeTokens;
}

/* ----------------------------- Liquid compile --------------------------- */

/** Optional snippets emitted alongside the section file. */
export interface LiquidAsset {
  /** e.g. "demeurer-hero-overlay.liquid" — placed in /snippets. */
  filename: string;
  content: string;
}

/**
 * Output of a section's `toLiquid` compiler. The compile pipeline (P1.D)
 * stitches these into one section file per page.
 */
export interface LiquidOutput {
  /**
   * The Shopify section schema — JSON object that becomes the
   * `{% schema %}` block. Settings, blocks, presets, etc.
   */
  schema: Record<string, unknown>;
  /** The Liquid template body (excluding the {% schema %} block). */
  template: string;
  /** Optional snippets to emit alongside this section. */
  assets?: LiquidAsset[];
}

export interface ToLiquidContext {
  /** The section type, useful for namespacing CSS classes / IDs. */
  sectionType: string;
  /**
   * The Demeurer block id. Used to emit a unique class scope per
   * compiled section so per-block responsive overrides can target
   * exactly one element with media queries (e.g.
   * `.demeurer-hero-cltf3a8q90001`). Stable across recompiles —
   * generated once when the block is created.
   */
  blockId: string;
}

/* --------------------------- Section definition ------------------------- */

/** A surfaced accessibility / readability issue for the inspector. */
export interface SectionQualityIssue {
  severity: "info" | "warning" | "error";
  message: string;
}

export interface SectionDefinition {
  /** Unique identifier used in `Block.type` and the Shopify schema. */
  type: string;
  /** Human-readable label shown in the section picker and inspector. */
  label: string;
  /**
   * Short, plain-English description of what this section is for. 1–2
   * sentences, written for the merchant — surfaces in the catalog and
   * (later) the section picker.
   */
  description: string;
  /** Lucide-react icon name (e.g. "Sparkles"). */
  icon: IconName;
  /** Category for grouping in the section picker. */
  category: SectionCategory;
  /** Field schema for the inspector. */
  schema: SectionSchema;
  /** Default props applied when the merchant inserts a fresh instance. */
  defaults: Record<string, unknown>;
  /** Canvas-only React preview. Never rendered on the live storefront. */
  Render: ComponentType<SectionRenderProps>;
  /**
   * Compile to a native Shopify section. Pure function, server-callable.
   *
   * Receives the full breakpoint-layered props bag (mobile +
   * optional tablet/desktop overrides) so the section can emit media
   * queries that reflect responsive overrides. P1.C segment 4 plumbs
   * the actual responsive CSS through; segment 1 (this one) just
   * extracts mobile and emits the previous output unchanged.
   */
  toLiquid: (
    propsByBreakpoint: PropsByBreakpoint,
    ctx: ToLiquidContext,
  ) => LiquidOutput;
  /**
   * Optional: surface accessibility / readability issues (low contrast,
   * missing alt text, etc.) for the Properties panel quality indicator.
   * Pure function — must not access DOM or storage.
   */
  qualityCheck?: (
    props: Record<string, unknown>,
    themeTokens: ThemeTokens,
  ) => SectionQualityIssue[];
}

/** Helper type for components that pass children through (e.g. wrappers). */
export type WithChildren<T = unknown> = T & { children?: ReactNode };
