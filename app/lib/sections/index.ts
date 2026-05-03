/**
 * Section registration entry point.
 *
 * Importing this module registers every section once. The registry is
 * the single source of truth for the editor's surfaces (canvas Render
 * dispatch, outline picker, properties panel) and for the compile
 * pipeline (P1.D `compile()`).
 *
 * To add a new section:
 *  1. Create `app/lib/sections/<type>/` with index.ts, Render.tsx,
 *     toLiquid.ts, schema.ts (clone the hero/ folder).
 *  2. Import its definition here and pass to `registerSection`.
 *  3. The console log below will pick it up automatically.
 */

import { heroDefinition } from "./hero";
import { listSections, registerSection } from "./registry";

registerSection(heroDefinition);

// Make registration visible in dev — silently failing to register a
// section produces a confusing "Unknown section" canvas error that's
// otherwise hard to root-cause.
if (typeof window !== "undefined") {
  const types = listSections().map((s) => s.type);
  // eslint-disable-next-line no-console
  console.log(
    `Demeurer: registered ${types.length} section${types.length === 1 ? "" : "s"}: [${types.join(", ")}]`,
  );
}

export { getSection, listSections, listSectionsByCategory } from "./registry";
export type {
  BooleanField,
  ColorField,
  Field,
  GroupField,
  IconName,
  ImageField,
  ListField,
  LiquidOutput,
  NumberField,
  RichtextField,
  SectionCategory,
  SectionDefinition,
  SectionRenderProps,
  SectionSchema,
  SelectField,
  SelectFieldOption,
  SpacingField,
  SpacingValue,
  TextField,
  ThemeTokens,
  ToLiquidContext,
  UrlField,
} from "./types";
