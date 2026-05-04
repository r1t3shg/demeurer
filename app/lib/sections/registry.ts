/**
 * Section registry — maps `Block.type` to its `SectionDefinition`.
 *
 * The registry is populated by `app/lib/sections/index.ts`, which is the
 * single import-side-effect entry point. All editor surfaces (canvas,
 * outline picker, properties panel) and the compile pipeline read from
 * this registry — they never import section folders directly.
 */

import type { SectionCategory, SectionDefinition } from "./types.ts";

const registry: Record<string, SectionDefinition> = {};

/** Register a section. Called by the index file at module load. */
export function registerSection(def: SectionDefinition): void {
  if (registry[def.type]) {
    // Loud error in dev — duplicate types silently shadow each other and
    // are nightmarish to debug otherwise.
    // eslint-disable-next-line no-console
    console.error(
      `Demeurer: duplicate section registration for type "${def.type}". ` +
        `The second registration overwrote the first.`,
    );
  }
  registry[def.type] = def;
}

/** Look up a section by type. Returns `null` if unknown. */
export function getSection(type: string): SectionDefinition | null {
  return registry[type] ?? null;
}

/** All registered sections, in registration order. */
export function listSections(): SectionDefinition[] {
  return Object.values(registry);
}

/** All registered sections grouped by category. Empty categories omitted. */
export function listSectionsByCategory(): Record<
  SectionCategory,
  SectionDefinition[]
> {
  const grouped: Record<SectionCategory, SectionDefinition[]> = {
    layout: [],
    content: [],
    media: [],
    form: [],
    advanced: [],
  };
  for (const def of Object.values(registry)) {
    grouped[def.category].push(def);
  }
  return grouped;
}

/** Test-only: reset the registry. Don't call from app code. */
export function _resetRegistry(): void {
  for (const k of Object.keys(registry)) delete registry[k];
}
