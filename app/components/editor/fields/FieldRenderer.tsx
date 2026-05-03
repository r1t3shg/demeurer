/**
 * Single dispatcher for every field kind. Lives apart from
 * `Properties.tsx` so that container-style fields (group, list) can
 * recursively render their nested children without depending on the
 * properties panel.
 */

import { BooleanField } from "./BooleanField";
import { ColorField } from "./ColorField";
import { GroupField } from "./GroupField";
import { ImageField } from "./ImageField";
import { ListField } from "./ListField";
import { NumberField } from "./NumberField";
import { RichTextField } from "./RichTextField";
import { SelectField } from "./SelectField";
import { SpacingField } from "./SpacingField";
import { TextField } from "./TextField";
import { UrlField } from "./UrlField";
import type { FieldRendererProps } from "./types";

export function FieldRenderer({ field, value, onChange }: FieldRendererProps) {
  switch (field.kind) {
    case "text":
      return <TextField field={field} value={value} onChange={onChange} />;
    case "richtext":
      return <RichTextField field={field} value={value} onChange={onChange} />;
    case "image":
      return <ImageField field={field} value={value} onChange={onChange} />;
    case "url":
      return <UrlField field={field} value={value} onChange={onChange} />;
    case "select":
      return <SelectField field={field} value={value} onChange={onChange} />;
    case "color":
      return <ColorField field={field} value={value} onChange={onChange} />;
    case "number":
      return <NumberField field={field} value={value} onChange={onChange} />;
    case "boolean":
      return <BooleanField field={field} value={value} onChange={onChange} />;
    case "spacing":
      return <SpacingField field={field} value={value} onChange={onChange} />;
    case "group":
      return <GroupField field={field} value={value} onChange={onChange} />;
    case "list":
      return <ListField field={field} value={value} onChange={onChange} />;
    default: {
      // Exhaustiveness check — if a new field kind is added to the union
      // and not handled above, TypeScript fails the build here.
      const _exhaustive: never = field;
      void _exhaustive;
      return null;
    }
  }
}
