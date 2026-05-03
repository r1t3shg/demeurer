import { useState } from "react";
import { useEditorStore } from "../../lib/editor/store";
import type { Block } from "../../lib/editor/types";
import { getSection } from "../../lib/sections";
import { FieldRenderer } from "./fields/FieldRenderer";

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

  const handleFieldChange = (key: string, next: unknown) => {
    replaceBlockProps(block.id, { ...block.props, [key]: next });
  };

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

      <div className="demeurer-properties-fields">
        {def ? (
          def.schema.fields.map((field) => (
            <FieldRenderer
              key={field.key}
              field={field}
              value={block.props[field.key]}
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
