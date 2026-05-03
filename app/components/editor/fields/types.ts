/**
 * Shared types for properties-panel field renderers.
 *
 * Each field renderer reads its current value from a props bag and
 * pushes a patched copy back via `onChange`. We deliberately keep the
 * surface small so adding a new field renderer in segment 2 means
 * matching this shape and registering it in `Properties.tsx`.
 */

import type { Field } from "../../../lib/sections";

export interface FieldRendererProps<F extends Field = Field> {
  field: F;
  value: unknown;
  onChange: (next: unknown) => void;
}
