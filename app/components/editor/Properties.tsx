import { useEffect, useState } from "react";

import { useEditorStore } from "../../lib/editor/store";
import type { Block } from "../../lib/editor/types";

/**
 * Properties panel — right-side editor for the selected block.
 *
 * For now: a JSON textarea bound to `block.props`. Updates flow through
 * `replaceBlockProps` (no history push) — see store.ts for the rationale.
 * This is a stopgap until P1.B ships per-block forms.
 *
 * Find the selected block by walking the tree. We don't index by id in
 * the store because (a) the tree is small, (b) keeping id→block in sync
 * with mutations would double the work of every action.
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
          Select a block to edit its properties.
        </div>
      </div>
    );
  }

  return (
    <div className="demeurer-editor-pane demeurer-properties">
      <div className="demeurer-pane-header">Properties</div>
      <div className="demeurer-properties-meta">
        <div className="demeurer-properties-type">{block.type}</div>
        <div className="demeurer-properties-id">
          id: …{block.id.slice(-6)}
        </div>
      </div>
      <PropsEditor
        // Re-mount the editor on selection change so the textarea buffer
        // resets to the new block's props.
        key={block.id}
        block={block}
        onChange={(next) => replaceBlockProps(block.id, next)}
      />
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
          Delete block
        </s-button>
      </div>
    </div>
  );
}

interface PropsEditorProps {
  block: Block;
  onChange: (next: Record<string, unknown>) => void;
}

/**
 * Local-buffered JSON editor. We keep the textarea contents in component
 * state so partial edits ("{ \"title\": \"Hi") don't blow up the parser.
 * On every change, we attempt to parse — on success, push to the store;
 * on failure, mark the field as invalid and leave the store untouched.
 */
function PropsEditor({ block, onChange }: PropsEditorProps) {
  const [text, setText] = useState(() =>
    JSON.stringify(block.props, null, 2),
  );
  const [error, setError] = useState<string | null>(null);

  // If the block's props change from outside this textarea (e.g. undo
  // restored a previous version), resync the buffer.
  useEffect(() => {
    setText(JSON.stringify(block.props, null, 2));
    setError(null);
  }, [block.props]);

  const handleChange = (value: string) => {
    setText(value);
    try {
      const parsed = JSON.parse(value) as unknown;
      if (
        !parsed ||
        typeof parsed !== "object" ||
        Array.isArray(parsed)
      ) {
        setError("Props must be a JSON object.");
        return;
      }
      setError(null);
      onChange(parsed as Record<string, unknown>);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid JSON");
    }
  };

  return (
    <div className="demeurer-props-editor">
      <label
        htmlFor={`props-${block.id}`}
        className="demeurer-props-label"
      >
        Props (JSON)
      </label>
      <textarea
        id={`props-${block.id}`}
        className={
          "demeurer-props-textarea" +
          (error ? " demeurer-props-textarea-error" : "")
        }
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        spellCheck={false}
        rows={14}
      />
      {error ? (
        <div className="demeurer-props-error" role="alert">
          {error}
        </div>
      ) : null}
    </div>
  );
}
