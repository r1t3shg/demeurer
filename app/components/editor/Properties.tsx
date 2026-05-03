import { useState } from "react";
import { useEditorStore } from "../../lib/editor/store";
import { setProp } from "../../lib/editor/mutations";
import { resolveProps } from "../../lib/editor/resolve";
import type { Block } from "../../lib/editor/types";
import { getSection } from "../../lib/sections";
import type { SectionQualityIssue } from "../../lib/sections/types";
import { FieldRenderer } from "./fields/FieldRenderer";
import { useThemeTokens } from "./ThemeTokensContext";

// Vite replaces `process.env.NODE_ENV` at build time, so the entire
// "Show Liquid" UI is dead-code-eliminated from production bundles.
const SHOW_LIQUID_ENABLED = process.env.NODE_ENV !== "production";

/**
 * Properties panel — schema-driven inspector for the selected block.
 *
 * Each section declares its editable props via a `SectionSchema`; the
 * shared `FieldRenderer` dispatches on `field.kind` to a renderer in
 * `./fields/`. Field changes shallow-merge into the block's props bag
 * via `replaceBlockProps` (no history push per keystroke) — same
 * rationale as the JSON textarea in P1.A.
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

  const def = getSection(block.type);
  const [showLiquid, setShowLiquid] = useState(false);

  // Cascade-aware view of this block's props at the editor's current
  // breakpoint. Field renderers display these; quality checks run against
  // them. Writes route based on `activeBreakpoint` below.
  const resolved = resolveProps(block, activeBreakpoint);

  const handleFieldChange = (key: string, next: unknown) => {
    if (activeBreakpoint === "mobile") {
      // Mobile is canonical — keep the per-keystroke fast path that
      // skips history. (Segment 3 may revisit this once override
      // editing has its own UI.)
      replaceBlockProps(block.id, { ...block.props.mobile, [key]: next });
    } else {
      // Tablet/desktop: write an override at the active breakpoint.
      setProp(block.id, activeBreakpoint, key, next);
    }
  };

  // Section quality: run the optional `qualityCheck` and reduce to a
  // single severity bucket. Errors override warnings override info.
  // Wrapped in try/catch so a buggy check doesn't break the inspector.
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
      <div className="demeurer-properties-meta">
        <div className="demeurer-properties-type">{def?.label ?? block.type}</div>
        <div className="demeurer-properties-id">
          id: …{block.id.slice(-6)}
        </div>
      </div>

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
            <FieldRenderer
              key={field.key}
              field={field}
              value={resolved[field.key]}
              onChange={(next) => handleFieldChange(field.key, next)}
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
