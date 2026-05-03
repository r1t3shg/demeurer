import { useEffect, useRef, useState } from "react";

import type { NumberField as NumberFieldDef } from "../../../lib/sections";
import type { FieldRendererProps } from "./types";

/**
 * Numeric field. The visible input is local state; we debounce 200 ms
 * before pushing into the editor store so a user dragging through
 * "10" → "100" → "1000" doesn't generate three replaceBlockProps calls
 * per keystroke (the autosave loop and any history bookkeeping notice).
 *
 * If the user clears the input or types something unparseable, we hold
 * the local string so they can keep editing — but never push NaN
 * upstream. The previous numeric value stays in the props bag until the
 * next valid commit.
 */
export function NumberField({
  field,
  value,
  onChange,
}: FieldRendererProps<NumberFieldDef>) {
  const numericValue =
    typeof value === "number" && Number.isFinite(value)
      ? value
      : field.default ?? 0;

  const [local, setLocal] = useState<string>(String(numericValue));
  const lastCommittedRef = useRef<number>(numericValue);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync external changes (undo/redo, version restore) into the input.
  useEffect(() => {
    if (numericValue !== lastCommittedRef.current) {
      lastCommittedRef.current = numericValue;
      setLocal(String(numericValue));
    }
  }, [numericValue]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const commit = (raw: string) => {
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    let clamped = n;
    if (typeof field.min === "number") clamped = Math.max(field.min, clamped);
    if (typeof field.max === "number") clamped = Math.min(field.max, clamped);
    if (clamped === lastCommittedRef.current) return;
    lastCommittedRef.current = clamped;
    onChange(clamped);
  };

  const handleInput = (raw: string) => {
    setLocal(raw);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => commit(raw), 200);
  };

  return (
    <s-text-field
      label={field.label}
      value={local}
      onInput={(e: Event) => {
        const target = e.target as HTMLInputElement;
        handleInput(target.value);
      }}
    />
  );
}
