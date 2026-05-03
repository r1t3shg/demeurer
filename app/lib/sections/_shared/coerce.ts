/**
 * Defensive coercion helpers shared by every section.
 *
 * Each section's `coerceProps` function trusts nothing about the JSON
 * blob it receives — the editor document is user-editable and may
 * predate any current schema. These helpers normalize primitives and
 * surface a typed value or a fallback. They're intentionally tiny so
 * sections stay readable.
 */

import type { SpacingValue } from "../types";

export function coerceString(input: unknown, fallback: string): string {
  return typeof input === "string" ? input : fallback;
}

export function coerceEnum<T extends string>(
  input: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof input === "string" && (allowed as readonly string[]).includes(input)
    ? (input as T)
    : fallback;
}

export function coerceNumber(input: unknown, fallback: number): number {
  return typeof input === "number" && Number.isFinite(input) ? input : fallback;
}

export function coerceBoolean(input: unknown, fallback: boolean): boolean {
  return typeof input === "boolean" ? input : fallback;
}

export function coerceSpacing(
  value: unknown,
  fallback: SpacingValue,
): SpacingValue {
  if (!value || typeof value !== "object") return fallback;
  const v = value as Record<string, unknown>;
  const num = (k: string, fb: number): number =>
    typeof v[k] === "number" && Number.isFinite(v[k]) ? (v[k] as number) : fb;
  return {
    top: num("top", fallback.top),
    right: num("right", fallback.right),
    bottom: num("bottom", fallback.bottom),
    left: num("left", fallback.left),
  };
}

/**
 * Validate a Shopify CDN image URL. Returns the URL if it's safe to
 * render in the canvas / emit into Liquid; otherwise returns "" so the
 * caller can fall back to a placeholder. This is the same allowlist
 * the ImageField picker enforces — the second line of defense for
 * legacy or hand-edited document data.
 */
export function coerceImageUrl(input: unknown): string {
  if (typeof input !== "string" || input === "") return "";
  try {
    const url = new URL(input);
    if (url.protocol !== "https:") return "";
    const host = url.hostname.toLowerCase();
    if (host === "cdn.shopify.com" || host.endsWith(".shopifycdn.com")) {
      return input;
    }
    return "";
  } catch {
    return "";
  }
}

/**
 * Coerce a list of items, applying `coerceItem` to each. Caps at
 * `maxItems` so a corrupted document can't render thousands of nodes.
 */
export function coerceList<T>(
  input: unknown,
  coerceItem: (item: Record<string, unknown>) => T,
  maxItems: number,
  fallback: T[],
): T[] {
  if (!Array.isArray(input)) return fallback;
  const out: T[] = [];
  for (const item of input) {
    if (out.length >= maxItems) break;
    if (item && typeof item === "object" && !Array.isArray(item)) {
      out.push(coerceItem(item as Record<string, unknown>));
    }
  }
  return out;
}

/**
 * Wrap a JS string as a Liquid string literal — single quotes, embedded
 * single quotes escaped, control characters stripped. Used by every
 * `toLiquid` to inject canvas defaults into `{%- liquid ... -%}` blocks.
 */
export function liquidString(s: string): string {
  const cleaned = s.replace(/[\u0000-\u001F\u007F]/g, "");
  return `'${cleaned.replace(/'/g, "\\'")}'`;
}
