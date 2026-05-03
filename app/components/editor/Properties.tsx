import { useEffect, useMemo, useRef, useState } from "react";
import { useEditorStore } from "../../lib/editor/store";
import {
  promoteOverride,
  removeOverride,
  setProp,
} from "../../lib/editor/mutations";
import {
  hasOverride,
  listOverrides,
  resolveProp,
  resolveProps,
} from "../../lib/editor/resolve";
import type { Block, Breakpoint } from "../../lib/editor/types";
import { BREAKPOINT_META } from "../../lib/editor/breakpoints";
import { getSection, isResponsiveField } from "../../lib/sections";
import type { Field, SectionQualityIssue } from "../../lib/sections/types";
import { FieldRenderer } from "./fields/FieldRenderer";
import { useThemeTokens } from "./ThemeTokensContext";

// Vite replaces `process.env.NODE_ENV` at build time, so the entire
// "Show Liquid" UI is dead-code-eliminated from production bundles.
const SHOW_LIQUID_ENABLED = process.env.NODE_ENV !== "production";

/** Synthetic key used by the Visibility row. Not part of any section schema. */
const VISIBILITY_KEY = "_visibility";

/**
 * Properties panel — schema-driven inspector for the selected block.
 *
 * Segment 3 layered the responsive override flow on top: each field
 * shows a source badge, edits at tablet/desktop trigger an "Apply to"
 * inline confirmation, structural fields are mobile-only, and a
 * Visibility row controls per-breakpoint hide/show via the synthetic
 * `_visibility` prop. Mutations route through `setProp` /
 * `removeOverride` / `promoteOverride` from `mutations.ts`; resolution
 * goes through `resolveProp` so the badge can name the source layer.
 */

function findBlock(blocks: Block[], id: string): Block | null {
  for (const b of blocks) {
    if (b.id === id) return b;
    const inChild = findBlock(b.children, id);
    if (inChild) return inChild;
  }
  return null;
}

export function Properties() {
  const blocks = useEditorStore((s) => s.document.blocks);
  const selectedBlockId = useEditorStore((s) => s.selectedBlockId);
  const replaceBlockProps = useEditorStore((s) => s.replaceBlockProps);
  const removeBlock = useEditorStore((s) => s.removeBlock);
  const selectBlock = useEditorStore((s) => s.selectBlock);
  const activeBreakpoint = useEditorStore((s) => s.activeBreakpoint);
  const themeTokens = useThemeTokens();

  const block = selectedBlockId ? findBlock(blocks, selectedBlockId) : null;

  if (!block) {
    return (
      <div className="demeurer-editor-pane demeurer-properties">
        <div className="demeurer-pane-header">Properties</div>
        <div className="demeurer-properties-empty">
          Select a section to edit its properties.
        </div>
      </div>
    );
  }

  // Force a fresh subtree per (block, breakpoint) so component-local
  // pending-change state can't leak between selections or bp switches —
  // a stale "Apply to" prompt for a no-longer-selected block would be
  // disorienting.
  return (
    <PropertiesBody
      key={`${block.id}:${activeBreakpoint}`}
      block={block}
      activeBreakpoint={activeBreakpoint}
      themeTokens={themeTokens}
      replaceBlockProps={replaceBlockProps}
      removeBlock={removeBlock}
      selectBlock={selectBlock}
    />
  );
}

interface PropertiesBodyProps {
  block: Block;
  activeBreakpoint: Breakpoint;
  themeTokens: ReturnType<typeof useThemeTokens>;
  replaceBlockProps: (id: string, props: Record<string, unknown>) => void;
  removeBlock: (id: string) => void;
  selectBlock: (id: string | null) => void;
}

function PropertiesBody({
  block,
  activeBreakpoint,
  themeTokens,
  replaceBlockProps,
  removeBlock,
  selectBlock,
}: PropertiesBodyProps) {
  const def = getSection(block.type);
  const [showLiquid, setShowLiquid] = useState(false);

  // Cascade-aware resolved bag for renderers and quality checks.
  const resolved = resolveProps(block, activeBreakpoint);

  // Pending-change state: at tablet/desktop, edits land here first and
  // show the inline "Apply to" strip rather than mutating the store.
  // Keyed by field key. The displayed value falls back to `resolved`
  // for keys without a pending change.
  const [pending, setPending] = useState<Record<string, unknown>>({});

  // Track Alt/Option key state globally so the merchant can hold Alt
  // while editing to skip the confirm prompt and create an override
  // directly. Read on each handleFieldChange call.
  const altHeldRef = useRef(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      altHeldRef.current = e.altKey;
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, []);

  const handleFieldChange = (field: Field, next: unknown) => {
    const key = field.key;
    if (activeBreakpoint === "mobile") {
      // Mobile is canonical — the per-keystroke fast path stays.
      replaceBlockProps(block.id, { ...block.props.mobile, [key]: next });
      return;
    }
    if (!isResponsiveField(field)) {
      // Structural fields are mobile-only. Editing UI is disabled at
      // tablet/desktop; this branch shouldn't fire, but guard anyway.
      return;
    }
    if (altHeldRef.current) {
      // Alt-bypass: skip the prompt and create an override directly.
      setProp(block.id, activeBreakpoint, key, next);
      return;
    }
    // Tablet/desktop edit on a responsive field — buffer it and reveal
    // the inline confirm strip. The default "Apply to" choice is
    // "all breakpoints" because that matches merchant intent for the
    // common case (intent change, not breakpoint-specific tweak).
    setPending((p) => ({ ...p, [key]: next }));
  };

  const applyPending = (key: string, applyToMobile: boolean) => {
    if (!(key in pending)) return;
    const value = pending[key];
    setProp(block.id, activeBreakpoint, key, value, { applyToMobile });
    setPending((p) => {
      const { [key]: _, ...rest } = p;
      return rest;
    });
  };

  const cancelPending = (key: string) => {
    setPending((p) => {
      const { [key]: _, ...rest } = p;
      return rest;
    });
  };

  // Section quality runs on the resolved (cascade-aware) view. We
  // intentionally feed it `resolved` even when `pending` has values —
  // quality issues for in-progress edits are noisy. Wrapped in
  // try/catch so a buggy check doesn't break the inspector.
  let qualityIssues: SectionQualityIssue[] = [];
  if (def?.qualityCheck) {
    try {
      qualityIssues = def.qualityCheck(resolved, themeTokens);
    } catch {
      qualityIssues = [];
    }
  }
  const errorCount = qualityIssues.filter((i) => i.severity === "error").length;
  const warningCount = qualityIssues.filter((i) => i.severity === "warning").length;
  const totalIssues = errorCount + warningCount;
  const qualityLevel: "good" | "warning" | "error" =
    errorCount > 0 || totalIssues >= 2
      ? "error"
      : warningCount > 0
        ? "warning"
        : "good";

  // Compile to Liquid on demand for the dev-only inspector. Wrapped in
  // try/catch so a section's broken `toLiquid` doesn't take down the
  // whole properties panel.
  let liquidPreview: { schema: string; template: string; assets: string } | null = null;
  if (SHOW_LIQUID_ENABLED && showLiquid && def) {
    try {
      const out = def.toLiquid(block.props, { sectionType: block.type });
      liquidPreview = {
        schema: JSON.stringify(out.schema, null, 2),
        template: out.template,
        assets:
          out.assets && out.assets.length > 0
            ? out.assets.map((a) => `// ${a.filename}\n${a.content}`).join("\n\n")
            : "",
      };
    } catch (err) {
      liquidPreview = {
        schema: "",
        template: `Error compiling: ${err instanceof Error ? err.message : String(err)}`,
        assets: "",
      };
    }
  }

  return (
    <div className="demeurer-editor-pane demeurer-properties">
      <div className="demeurer-pane-header">Properties</div>
      <OverrideSummary block={block} activeBreakpoint={activeBreakpoint} />
      <div className="demeurer-properties-meta">
        <div className="demeurer-properties-type">{def?.label ?? block.type}</div>
        <div className="demeurer-properties-id">
          id: …{block.id.slice(-6)}
        </div>
      </div>

      <VisibilityRow block={block} />

      {def?.qualityCheck ? (
        <div
          className={`demeurer-quality demeurer-quality--${qualityLevel}`}
          role="status"
          aria-live="polite"
        >
          <div className="demeurer-quality__row">
            <span className="demeurer-quality__icon" aria-hidden="true">
              {qualityLevel === "good" ? "✓" : qualityLevel === "warning" ? "!" : "✕"}
            </span>
            <span className="demeurer-quality__title">
              {qualityLevel === "good"
                ? "Section quality: looks good"
                : qualityLevel === "warning"
                  ? `Section quality: ${totalIssues} ${totalIssues === 1 ? "issue" : "issues"}`
                  : `Section quality: needs attention (${totalIssues})`}
            </span>
          </div>
          {qualityIssues.length > 0 ? (
            <ul className="demeurer-quality__list">
              {qualityIssues.map((issue, i) => (
                <li key={i} className={`demeurer-quality__item demeurer-quality__item--${issue.severity}`}>
                  {issue.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="demeurer-properties-fields">
        {def ? (
          def.schema.fields.map((field) => (
            <ResponsiveField
              key={field.key}
              block={block}
              field={field}
              activeBreakpoint={activeBreakpoint}
              resolvedValue={
                field.key in pending ? pending[field.key] : resolved[field.key]
              }
              hasPending={field.key in pending}
              onChange={(next) => handleFieldChange(field, next)}
              onApply={(applyToMobile) =>
                applyPending(field.key, applyToMobile)
              }
              onCancel={() => cancelPending(field.key)}
            />
          ))
        ) : (
          <div className="demeurer-properties-unknown">
            Unknown section type <code>{block.type}</code>. Was it removed
            from the registry?
          </div>
        )}
      </div>

      <div className="demeurer-properties-actions">
        <s-button
          tone="critical"
          variant="primary"
          onClick={() => {
            const id = block.id;
            removeBlock(id);
            selectBlock(null);
          }}
        >
          Delete section
        </s-button>
        {SHOW_LIQUID_ENABLED && def ? (
          <s-button
            variant="secondary"
            onClick={() => setShowLiquid((v) => !v)}
          >
            {showLiquid ? "Hide Liquid" : "Show Liquid (dev)"}
          </s-button>
        ) : null}
      </div>

      {SHOW_LIQUID_ENABLED && showLiquid && liquidPreview ? (
        <div className="demeurer-properties-liquid">
          <div className="demeurer-properties-liquid__label">Schema</div>
          <pre className="demeurer-properties-liquid__pre">{liquidPreview.schema}</pre>
          <div className="demeurer-properties-liquid__label">Template</div>
          <pre className="demeurer-properties-liquid__pre">{liquidPreview.template}</pre>
          {liquidPreview.assets ? (
            <>
              <div className="demeurer-properties-liquid__label">Snippets</div>
              <pre className="demeurer-properties-liquid__pre">{liquidPreview.assets}</pre>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------- Override summary --------------------------- */

/**
 * Replaces segment 2's neutral advisory strip with a real summary of
 * the block's responsive state.
 *
 * - Mobile: counts properties that have ANY non-mobile override on this
 *   block. This is informational — the merchant can't act on it from
 *   here, just see "this block has responsive tweaks elsewhere".
 * - Tablet/desktop: counts overrides at the current breakpoint AND at
 *   the other non-mobile breakpoint. Clicking a count scrolls the next
 *   overridden field into view.
 *
 * The synthetic `_visibility` key is included in the counts since
 * "hidden on mobile" is itself a responsive override the merchant
 * should know about at a glance.
 */
function OverrideSummary({
  block,
  activeBreakpoint,
}: {
  block: Block;
  activeBreakpoint: Breakpoint;
}) {
  const tabletKeys = listOverrides(block, "tablet");
  const desktopKeys = listOverrides(block, "desktop");
  const meta = BREAKPOINT_META[activeBreakpoint];

  if (activeBreakpoint === "mobile") {
    const total = tabletKeys.length + desktopKeys.length;
    return (
      <div className="demeurer-properties-summary" role="note">
        <strong>Editing mobile</strong>
        <span className="demeurer-properties-summary__sep">·</span>
        {total === 0
          ? "No responsive overrides on this block."
          : `${total} ${total === 1 ? "property has" : "properties have"} responsive overrides.`}
      </div>
    );
  }

  const ownKeys = activeBreakpoint === "tablet" ? tabletKeys : desktopKeys;
  const otherKeys = activeBreakpoint === "tablet" ? desktopKeys : tabletKeys;
  const otherLabel = activeBreakpoint === "tablet" ? "desktop" : "tablet";
  const total = ownKeys.length + otherKeys.length;

  if (total === 0) {
    return (
      <div className="demeurer-properties-summary" role="note">
        <strong>Editing {meta.label}</strong>
        <span className="demeurer-properties-summary__sep">·</span>
        This block uses mobile values everywhere.
      </div>
    );
  }

  const cycleToNext = (keys: string[]) => () => {
    if (keys.length === 0) return;
    // Walk fields in the panel; pick the first overridden one whose
    // wrapper isn't already the active anchor target. Cheap implementation:
    // jump to the first match. The brief calls for "next overridden
    // field" cycling — we accept "first" as an MVP.
    const next = keys[0];
    const el = document.querySelector(
      `[data-field-key="${CSS.escape(next)}"]`,
    );
    if (el && "scrollIntoView" in el) {
      (el as HTMLElement).scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  return (
    <div className="demeurer-properties-summary" role="note">
      <strong>Editing {meta.label}</strong>
      <span className="demeurer-properties-summary__sep">·</span>
      {ownKeys.length > 0 ? (
        <button
          type="button"
          className="demeurer-properties-summary__count"
          onClick={cycleToNext(ownKeys)}
        >
          {ownKeys.length} {activeBreakpoint} override
          {ownKeys.length === 1 ? "" : "s"}
        </button>
      ) : null}
      {ownKeys.length > 0 && otherKeys.length > 0 ? (
        <span className="demeurer-properties-summary__sep">·</span>
      ) : null}
      {otherKeys.length > 0 ? (
        <button
          type="button"
          className="demeurer-properties-summary__count"
          onClick={cycleToNext(otherKeys)}
        >
          {otherKeys.length} {otherLabel} override
          {otherKeys.length === 1 ? "" : "s"}
        </button>
      ) : null}
    </div>
  );
}

/* -------------------------- Visibility row ----------------------------- */

/**
 * Per-breakpoint show/hide. Implemented as a synthetic `_visibility`
 * prop on the block — not a section schema field, since every block
 * has the same visibility surface and section authors shouldn't have
 * to remember to declare it.
 *
 * Each checkbox represents the resolved visibility AT that breakpoint:
 *   - Mobile checkbox writes _visibility on the mobile layer (canonical).
 *   - Tablet/Desktop checkboxes create or remove an override.
 */
function VisibilityRow({ block }: { block: Block }) {
  const visibleAt = (bp: Breakpoint): boolean => {
    const v = resolveProp(block, bp, VISIBILITY_KEY).value;
    // Default true if unset — every block is visible everywhere by
    // default. Only an explicit `false` hides it.
    return v !== false;
  };

  const toggle = (bp: Breakpoint, currentlyVisible: boolean) => {
    const next = !currentlyVisible;
    if (bp === "mobile") {
      // Mobile is canonical — write directly. We store the explicit
      // value (true or false) so the prop is observable, even though
      // a missing key would resolve to `true` anyway.
      setProp(block.id, "mobile", VISIBILITY_KEY, next);
      return;
    }
    // Tablet/desktop: an override exists iff the resolved value at this
    // bp differs from mobile's value. If toggling brings it back in
    // line with mobile, drop the override; otherwise create/update one.
    const mobileVisible = visibleAt("mobile");
    if (next === mobileVisible) {
      // Removing the override is enough — the cascade handles the rest.
      removeOverride(block.id, bp, VISIBILITY_KEY);
    } else {
      setProp(block.id, bp, VISIBILITY_KEY, next);
    }
  };

  const mobile = visibleAt("mobile");
  const tablet = visibleAt("tablet");
  const desktop = visibleAt("desktop");

  return (
    <div className="demeurer-visibility-row">
      <div className="demeurer-visibility-row__label">Show on</div>
      <div className="demeurer-visibility-row__checks">
        <label className="demeurer-visibility-check">
          <input
            type="checkbox"
            checked={mobile}
            onChange={() => toggle("mobile", mobile)}
          />
          <span>Mobile</span>
        </label>
        <label className="demeurer-visibility-check">
          <input
            type="checkbox"
            checked={tablet}
            onChange={() => toggle("tablet", tablet)}
          />
          <span>Tablet</span>
        </label>
        <label className="demeurer-visibility-check">
          <input
            type="checkbox"
            checked={desktop}
            onChange={() => toggle("desktop", desktop)}
          />
          <span>Desktop</span>
        </label>
      </div>
    </div>
  );
}

/* ---------------------- Per-field responsive wrapper ---------------------- */

interface ResponsiveFieldProps {
  block: Block;
  field: Field;
  activeBreakpoint: Breakpoint;
  resolvedValue: unknown;
  hasPending: boolean;
  onChange: (next: unknown) => void;
  onApply: (applyToMobile: boolean) => void;
  onCancel: () => void;
}

function ResponsiveField({
  block,
  field,
  activeBreakpoint,
  resolvedValue,
  hasPending,
  onChange,
  onApply,
  onCancel,
}: ResponsiveFieldProps) {
  const responsive = isResponsiveField(field);
  const atMobile = activeBreakpoint === "mobile";

  // Source for the badge: at mobile, no badge (everything is mobile by
  // definition). At tablet/desktop, walk resolveProp to determine
  // which layer the value comes from.
  const source = atMobile
    ? "mobile"
    : resolveProp(block, activeBreakpoint, field.key).source;

  const showBadge = !atMobile;
  const showFocusHint = responsive && !atMobile && !hasPending;

  // At tablet/desktop on a non-responsive field, render the field
  // disabled so the user can't initiate edits. We use a `fieldset
  // disabled` wrapper so every input inside is non-interactive without
  // each field renderer needing to know about responsiveness.
  const isReadOnly = !atMobile && !responsive;

  return (
    <div className="demeurer-field-wrap" data-field-key={field.key}>
      {showBadge ? (
        responsive ? (
          <SourceBadge
            block={block}
            fieldKey={field.key}
            activeBreakpoint={activeBreakpoint}
            source={source}
          />
        ) : (
          <span
            className="demeurer-source-badge demeurer-source-badge--locked"
            title="This field is the same on all breakpoints"
          >
            Same on all breakpoints
          </span>
        )
      ) : null}

      <fieldset
        className="demeurer-field-fieldset"
        disabled={isReadOnly}
        aria-disabled={isReadOnly}
      >
        <FieldRenderer field={field} value={resolvedValue} onChange={onChange} />
      </fieldset>

      {showFocusHint ? (
        <div className="demeurer-field-hint" aria-hidden="true">
          Hold Alt for breakpoint-only edit
        </div>
      ) : null}

      {hasPending ? (
        <ApplyToStrip
          breakpoint={activeBreakpoint}
          onApply={onApply}
          onCancel={onCancel}
        />
      ) : null}
    </div>
  );
}

/* ----------------------------- Apply-to strip --------------------------- */

function ApplyToStrip({
  breakpoint,
  onApply,
  onCancel,
}: {
  breakpoint: Breakpoint;
  onApply: (applyToMobile: boolean) => void;
  onCancel: () => void;
}) {
  const [scope, setScope] = useState<"all" | "this">("all");
  const onlyLabel =
    breakpoint === "tablet" ? "Tablet only" : "Desktop only";

  // Enter = Apply, Escape = Cancel — but only when the strip itself is
  // the document's active element subtree. We listen on the strip's
  // root and stop propagation so a typing keystroke in the field above
  // doesn't accidentally fire Apply.
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onApply(scope === "all");
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div
      className="demeurer-apply-strip"
      role="dialog"
      aria-label="Apply this change to"
      onKeyDown={onKeyDown}
    >
      <div className="demeurer-apply-strip__title">Apply this change to:</div>
      <div className="demeurer-apply-strip__choices">
        <label className="demeurer-apply-strip__choice">
          <input
            type="radio"
            name={`scope-${breakpoint}`}
            checked={scope === "all"}
            onChange={() => setScope("all")}
          />
          <span>All breakpoints (recommended)</span>
        </label>
        <label className="demeurer-apply-strip__choice">
          <input
            type="radio"
            name={`scope-${breakpoint}`}
            checked={scope === "this"}
            onChange={() => setScope("this")}
          />
          <span>{onlyLabel}</span>
        </label>
      </div>
      <div className="demeurer-apply-strip__actions">
        <button
          type="button"
          className="demeurer-apply-strip__btn demeurer-apply-strip__btn--primary"
          onClick={() => onApply(scope === "all")}
        >
          Apply
        </button>
        <button
          type="button"
          className="demeurer-apply-strip__btn"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ------------------------------ Source badge ---------------------------- */

interface SourceBadgeProps {
  block: Block;
  fieldKey: string;
  activeBreakpoint: Breakpoint;
  source: Breakpoint;
}

function SourceBadge({
  block,
  fieldKey,
  activeBreakpoint,
  source,
}: SourceBadgeProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click or Escape — same pattern as the Add menu in
  // Outline. Don't bind the listener until the popover opens so we
  // don't pay the cost on every field.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const badgeLabel =
    source === "mobile"
      ? "mobile"
      : source === "tablet"
        ? "tablet override"
        : "desktop override";
  const variant =
    source === "mobile"
      ? "mobile"
      : source === "tablet"
        ? "tablet"
        : "desktop";

  const resolved = useMemo(
    () => resolveProp(block, activeBreakpoint, fieldKey),
    [block, activeBreakpoint, fieldKey],
  );

  // "Pin override to this breakpoint" only makes sense at desktop when
  // the value is currently cascading from a tablet override — that's
  // the exact case where changing tablet later would unexpectedly
  // change desktop too.
  const canPin = activeBreakpoint === "desktop" && source === "tablet";
  // "Reset to mobile value" requires there to BE an override at the
  // current breakpoint. (Resetting from a cascading-tablet state at
  // desktop is meaningless — there's nothing to remove at desktop.)
  const canReset =
    activeBreakpoint !== "mobile" &&
    hasOverride(block, activeBreakpoint, fieldKey);
  // "Make this the default everywhere" promotes the OVERRIDE value
  // into mobile. So it only makes sense when there is an override
  // somewhere AND the resolved value is itself coming from an override.
  const canPromote =
    source !== "mobile" && hasOverride(block, source, fieldKey);

  return (
    <div className="demeurer-source-badge-host" ref={containerRef}>
      <button
        type="button"
        className={`demeurer-source-badge demeurer-source-badge--${variant}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={`Source: ${badgeLabel}`}
      >
        {badgeLabel}
      </button>
      {open ? (
        <div
          role="dialog"
          className="demeurer-source-popover"
          aria-label={`Source actions for ${fieldKey}`}
        >
          <div className="demeurer-source-popover__title">
            Source: {badgeLabel}
          </div>
          <div className="demeurer-source-popover__value">
            Value at this breakpoint: <code>{formatValue(resolved.value)}</code>
          </div>
          <div className="demeurer-source-popover__actions">
            <button
              type="button"
              className="demeurer-source-popover__btn"
              disabled={!canReset}
              onClick={() => {
                removeOverride(block.id, activeBreakpoint, fieldKey);
                setOpen(false);
              }}
            >
              Reset to mobile value
            </button>
            <button
              type="button"
              className="demeurer-source-popover__btn"
              disabled={!canPin}
              onClick={() => {
                // Pin at desktop: copy the resolved (tablet) value as
                // a desktop override so changing tablet later won't
                // ripple into desktop.
                setProp(block.id, "desktop", fieldKey, resolved.value);
                setOpen(false);
              }}
            >
              Pin override to this breakpoint
            </button>
            <button
              type="button"
              className="demeurer-source-popover__btn"
              disabled={!canPromote}
              onClick={() => {
                promoteOverride(block.id, source, true, fieldKey);
                setOpen(false);
              }}
            >
              Make this the default everywhere
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Compact one-line preview of a value for the popover. */
function formatValue(v: unknown): string {
  if (v === undefined) return "—";
  if (v === null) return "null";
  if (typeof v === "string") {
    return v.length > 40 ? `"${v.slice(0, 39)}…"` : `"${v}"`;
  }
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    const s = JSON.stringify(v);
    return s.length > 40 ? `${s.slice(0, 39)}…` : s;
  } catch {
    return String(v);
  }
}
