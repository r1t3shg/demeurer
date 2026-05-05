/**
 * Editor document types — the in-memory shape of `Page.source`.
 *
 * The editor's source-of-truth is a tree of blocks. Each block has a stable
 * id, a string `type` discriminator, a breakpoint-aware `props` bag
 * (`PropsByBreakpoint`), and an array of child blocks.
 *
 * Responsive model (P1.C):
 *   - Mobile is canonical. Every property has a mobile value.
 *   - Tablet and desktop are SPARSE override layers — they only contain
 *     properties that differ from mobile.
 *   - Cascade direction is one-way: mobile → tablet → desktop. Editing at
 *     desktop never writes back to mobile silently.
 *
 * The cascade logic is isolated in `app/lib/editor/resolve.ts`. Every
 * consumer of block props must go through those helpers — no direct
 * access to `block.props.tablet` etc. anywhere else in the codebase.
 *
 * Mutations are isolated in `app/lib/editor/mutations.ts`.
 */

export type BlockId = string;

/**
 * Three breakpoints, no more. The widths themselves are hardcoded in the
 * canvas viewport switcher (P1.C segment 2) — not stored on the document.
 */
export type Breakpoint = "mobile" | "tablet" | "desktop";

export const BREAKPOINTS: readonly Breakpoint[] = [
  "mobile",
  "tablet",
  "desktop",
] as const;

/**
 * The props bag for a block, layered by breakpoint.
 *
 * `mobile` is the canonical layer — every prop the section needs lives
 * here. `tablet` and `desktop` are sparse override layers; they only
 * appear when the merchant has explicitly overridden a property at that
 * breakpoint, and they only contain the keys that differ.
 *
 * Removing the last override at a breakpoint deletes the layer entirely
 * so the persisted JSON stays minimal.
 */
export interface PropsByBreakpoint {
  mobile: Record<string, unknown>;
  tablet?: Record<string, unknown>;
  desktop?: Record<string, unknown>;
}

/**
 * Per-variant content binding (P1.E segment 2).
 *
 * On product pages, a block can be limited to specific variants via
 * `mode: "specific"` + a list of variant GIDs. The shared section
 * template wraps the body in a Liquid `{% if %}` guard at compile
 * time, so the storefront only renders the block when the active
 * variant matches.
 *
 * `mode: "all"` (or `undefined` — the common case) means the block
 * renders on every variant; no Liquid conditional is emitted.
 */
export interface VariantBinding {
  mode: "all" | "specific";
  /** Required when `mode === "specific"`. Shopify variant GIDs. */
  variantIds?: string[];
}

export interface Block {
  id: BlockId;
  type: string;
  props: PropsByBreakpoint;
  children: Block[];
  /** Optional per-block variant filter. See `VariantBinding`. */
  variantBinding?: VariantBinding;
}

export interface EditorDocument {
  /**
   * Schema version. Bump when the persisted shape changes incompatibly.
   *  - v1: `Block.props` was a flat `Record<string, unknown>`.
   *  - v2: `Block.props` is `PropsByBreakpoint` (P1.C).
   *
   * `migrateDocument` upgrades v1 documents to v2 on load.
   */
  version: 2;
  /** Top-level block tree. Empty array = blank page. */
  blocks: Block[];
}

/** Returns a fresh, empty document. */
export function emptyDocument(): EditorDocument {
  return { version: 2, blocks: [] };
}

/** Wrap a flat props bag into the canonical mobile layer. */
export function wrapMobileProps(
  flat: Record<string, unknown>,
): PropsByBreakpoint {
  return { mobile: { ...flat } };
}

/** Narrowing guard for unknown JSON values pulled from the DB. */
export function isBlock(value: unknown): value is Block {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== "string") return false;
  if (typeof v.type !== "string") return false;
  if (!Array.isArray(v.children)) return false;
  if (!v.children.every(isBlock)) return false;
  if (!v.props || typeof v.props !== "object") return false;
  const props = v.props as Record<string, unknown>;
  if (!props.mobile || typeof props.mobile !== "object") return false;
  if (props.tablet !== undefined && (props.tablet === null || typeof props.tablet !== "object")) {
    return false;
  }
  if (props.desktop !== undefined && (props.desktop === null || typeof props.desktop !== "object")) {
    return false;
  }
  // Optional variantBinding — additive in P1.E segment 2; reject only
  // if present-but-malformed (so old documents stay valid).
  if (v.variantBinding !== undefined) {
    const vb = v.variantBinding;
    if (!vb || typeof vb !== "object") return false;
    const vbo = vb as Record<string, unknown>;
    if (vbo.mode !== "all" && vbo.mode !== "specific") return false;
    if (vbo.variantIds !== undefined) {
      if (!Array.isArray(vbo.variantIds)) return false;
      if (!vbo.variantIds.every((x) => typeof x === "string")) return false;
    }
  }
  return true;
}

/**
 * Narrowing guard for unknown JSON values pulled from `Page.source`. Use
 * this at the loader boundary before handing data to the store — but
 * call `migrateDocument` first if the document might still be v1.
 *
 * Only validates v2. v1 documents fail this check and are upgraded by
 * `migrateDocument`.
 */
export function isDocument(value: unknown): value is EditorDocument {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return v.version === 2 && Array.isArray(v.blocks) && v.blocks.every(isBlock);
}

/**
 * Migrate a `Page.source` value to the current v2 shape.
 *
 * v1 → v2: Each block's flat `props` object is wrapped into a canonical
 * `PropsByBreakpoint` with the existing values placed under `mobile`. The
 * tablet and desktop layers start empty (omitted, not `{}`, so the
 * persisted JSON stays minimal).
 *
 * Idempotent: running this on a v2 document is a no-op (apart from a
 * shallow clone). Call freely on every load — old v1 documents are
 * upgraded permanently when the store next saves; new v2 documents pass
 * through untouched.
 *
 * Returns `emptyDocument()` if the input isn't recognizable as a
 * document at all (brand-new pages, corrupt rows, etc.).
 */
export function migrateDocument(value: unknown): EditorDocument {
  if (!value || typeof value !== "object") return emptyDocument();
  const v = value as Record<string, unknown>;
  if (!Array.isArray(v.blocks)) return emptyDocument();
  const blocks = v.blocks
    .map((b) => migrateBlock(b))
    .filter((b): b is Block => b !== null);
  return { version: 2, blocks };
}

function migrateBlock(value: unknown): Block | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== "string" || typeof v.type !== "string") return null;

  // Recurse into children first so a deeply-nested v1 props bag is
  // migrated alongside its v2 ancestor.
  const children = Array.isArray(v.children)
    ? (v.children
        .map(migrateBlock)
        .filter((c): c is Block => c !== null) as Block[])
    : [];

  const rawProps =
    v.props && typeof v.props === "object" ? (v.props as Record<string, unknown>) : {};

  // Detect v2 shape: rawProps has a non-null object `mobile` key. Everything
  // else (including malformed shapes) is treated as v1 flat props and
  // wrapped under `mobile` defensively.
  let props: PropsByBreakpoint;
  if (rawProps.mobile && typeof rawProps.mobile === "object") {
    props = {
      mobile: { ...(rawProps.mobile as Record<string, unknown>) },
    };
    if (rawProps.tablet && typeof rawProps.tablet === "object") {
      props.tablet = { ...(rawProps.tablet as Record<string, unknown>) };
    }
    if (rawProps.desktop && typeof rawProps.desktop === "object") {
      props.desktop = { ...(rawProps.desktop as Record<string, unknown>) };
    }
  } else {
    props = { mobile: { ...rawProps } };
  }

  // Preserve variantBinding if present and well-formed (additive
  // field added in P1.E segment 2; older docs lack it entirely).
  let variantBinding: VariantBinding | undefined;
  const rawVb = v.variantBinding;
  if (rawVb && typeof rawVb === "object") {
    const vb = rawVb as Record<string, unknown>;
    if (vb.mode === "specific" && Array.isArray(vb.variantIds)) {
      const ids = vb.variantIds.filter(
        (x): x is string => typeof x === "string",
      );
      if (ids.length > 0) variantBinding = { mode: "specific", variantIds: ids };
    }
    // mode "all" is the default; we don't store it.
  }

  const block: Block = { id: v.id, type: v.type, props, children };
  if (variantBinding) block.variantBinding = variantBinding;
  return block;
}
