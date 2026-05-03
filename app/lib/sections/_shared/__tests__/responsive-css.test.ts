/**
 * Tests for the responsive-CSS emission helpers — `emitResponsiveCSS`,
 * `emitVisibilityCSS`, `diffOverrides`, `wrapStyle`, `scopeClass`. The
 * exit-gate criterion these enforce: a freshly-built page (no
 * overrides anywhere) emits NO media queries.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import type { PropsByBreakpoint } from "../../../editor/types.ts";
import {
  diffOverrides,
  emitResponsiveCSS,
  emitVisibilityCSS,
  pxValue,
  scopeClass,
  textAlignLogical,
  wrapStyle,
} from "../responsive-css.ts";

const SCOPE = "demeurer-hero-abc123";

const PROP_MAP = [
  { propKey: "paddingTop", cssProperty: "padding-top", toCss: pxValue },
  { propKey: "paddingBottom", cssProperty: "padding-bottom", toCss: pxValue },
  { propKey: "alignment", cssProperty: "text-align", toCss: textAlignLogical },
];

function props(
  mobile: Record<string, unknown>,
  tablet?: Record<string, unknown>,
  desktop?: Record<string, unknown>,
): PropsByBreakpoint {
  const p: PropsByBreakpoint = { mobile };
  if (tablet) p.tablet = tablet;
  if (desktop) p.desktop = desktop;
  return p;
}

describe("emitResponsiveCSS", () => {
  it("emits an empty string when there are no overrides", () => {
    const css = emitResponsiveCSS(
      SCOPE,
      props({ paddingTop: 96, paddingBottom: 96, alignment: "center" }),
      PROP_MAP,
    );
    assert.equal(css, "");
  });

  it("emits a single tablet @media block when only tablet has overrides", () => {
    const css = emitResponsiveCSS(
      SCOPE,
      props(
        { paddingTop: 96, paddingBottom: 96, alignment: "center" },
        { paddingTop: 48 },
      ),
      PROP_MAP,
    );
    assert.match(css, /@media \(min-width: 768px\) \{/);
    assert.doesNotMatch(css, /@media \(min-width: 1280px\) \{/);
    assert.match(css, /padding-top: 48px !important;/);
    // paddingBottom and alignment unchanged at tablet — must not emit.
    assert.doesNotMatch(css, /padding-bottom:/);
    assert.doesNotMatch(css, /text-align:/);
  });

  it("emits two @media blocks when tablet AND desktop both override", () => {
    const css = emitResponsiveCSS(
      SCOPE,
      props(
        { paddingTop: 96, alignment: "center" },
        { paddingTop: 48 },
        { alignment: "left", paddingTop: 120 },
      ),
      PROP_MAP,
    );
    assert.match(css, /@media \(min-width: 768px\) \{[\s\S]*padding-top: 48px !important/);
    assert.match(
      css,
      /@media \(min-width: 1280px\) \{[\s\S]*padding-top: 120px !important[\s\S]*text-align: start !important/,
    );
  });

  it("treats a desktop value identical to the cascaded tablet value as NOT an override", () => {
    // tablet sets padding-top to 48; desktop also says 48. The cascade
    // already produces 48 at desktop, so emitting a redundant rule
    // would clutter the published CSS for no behavior change.
    const css = emitResponsiveCSS(
      SCOPE,
      props(
        { paddingTop: 96 },
        { paddingTop: 48 },
        { paddingTop: 48 },
      ),
      [{ propKey: "paddingTop", cssProperty: "padding-top", toCss: pxValue }],
    );
    assert.match(css, /@media \(min-width: 768px\) \{[\s\S]*padding-top: 48px/);
    assert.doesNotMatch(css, /@media \(min-width: 1280px\) \{/);
  });

  it("includes mobile rules when includeMobile is set", () => {
    const css = emitResponsiveCSS(
      SCOPE,
      props({ paddingTop: 96, alignment: "center" }, { paddingTop: 48 }),
      [
        { propKey: "paddingTop", cssProperty: "padding-top", toCss: pxValue },
        { propKey: "alignment", cssProperty: "text-align", toCss: textAlignLogical },
      ],
      { includeMobile: true },
    );
    // Mobile block has both decls, no !important.
    assert.match(css, /\.demeurer-hero-abc123 \{\n  padding-top: 96px;\n  text-align: center;\n\}/);
    // Tablet override does have !important.
    assert.match(css, /padding-top: 48px !important;/);
  });

  it("respects mobileLiquid for runtime Shopify settings", () => {
    const css = emitResponsiveCSS(
      SCOPE,
      props({ paddingTop: 96 }, { paddingTop: 48 }),
      [
        {
          propKey: "paddingTop",
          cssProperty: "padding-top",
          toCss: pxValue,
          mobileLiquid: "{{ section.settings.padding_top | append: 'px' }}",
        },
      ],
      { includeMobile: true },
    );
    assert.match(
      css,
      /padding-top: \{\{ section\.settings\.padding_top \| append: 'px' \}\};/,
    );
  });

  it("uses structural equality so SpacingValue overrides compare correctly", () => {
    const css = emitResponsiveCSS(
      SCOPE,
      props(
        { padding: { top: 96, right: 24, bottom: 96, left: 24 } },
        { padding: { top: 96, right: 24, bottom: 96, left: 24 } }, // same!
      ),
      [
        {
          propKey: "padding",
          cssProperty: "padding",
          toCss: (v) => {
            const p = v as { top: number; right: number; bottom: number; left: number };
            return `${p.top}px ${p.right}px ${p.bottom}px ${p.left}px`;
          },
        },
      ],
    );
    // Even though tablet HAS a `padding` key, the value matches mobile,
    // so it is not a real override.
    assert.equal(css, "");
  });
});

describe("diffOverrides", () => {
  it("returns an empty object when the layer doesn't exist", () => {
    const out = diffOverrides(props({ a: 1 }), "tablet", ["a"]);
    assert.deepEqual(out, {});
  });

  it("returns only keys whose values differ from the cascaded value", () => {
    const out = diffOverrides(
      props({ a: 1, b: 2 }, { a: 1, b: 99 }),
      "tablet",
      ["a", "b"],
    );
    assert.deepEqual(out, { b: 99 });
  });

  it("at desktop, compares against the tablet-resolved value (not mobile)", () => {
    // mobile=1, tablet=99. desktop=99 should NOT be an override (tablet
    // already cascaded that value); desktop=42 SHOULD be an override.
    const noOverride = diffOverrides(
      props({ a: 1 }, { a: 99 }, { a: 99 }),
      "desktop",
      ["a"],
    );
    assert.deepEqual(noOverride, {});
    const realOverride = diffOverrides(
      props({ a: 1 }, { a: 99 }, { a: 42 }),
      "desktop",
      ["a"],
    );
    assert.deepEqual(realOverride, { a: 42 });
  });
});

describe("emitVisibilityCSS", () => {
  it("emits nothing when every breakpoint is visible", () => {
    assert.equal(emitVisibilityCSS(SCOPE, props({})), "");
    assert.equal(emitVisibilityCSS(SCOPE, props({ _visibility: true })), "");
  });

  it("emits a tablet hide rule when tablet has _visibility: false", () => {
    const css = emitVisibilityCSS(SCOPE, props({}, { _visibility: false }));
    assert.match(
      css,
      /@media \(min-width: 768px\) \{ \.demeurer-hero-abc123 \{ display: none !important; \} \}/,
    );
    assert.doesNotMatch(css, /1280px/);
  });

  it("emits a desktop hide rule when desktop has _visibility: false", () => {
    const css = emitVisibilityCSS(SCOPE, props({}, undefined, { _visibility: false }));
    assert.match(css, /@media \(min-width: 1280px\)[\s\S]*display: none !important/);
    assert.doesNotMatch(css, /768px/);
  });

  it("when both tablet and desktop are hidden, emits ONLY the tablet rule (cascade applies it at desktop too)", () => {
    const css = emitVisibilityCSS(
      SCOPE,
      props({}, { _visibility: false }, { _visibility: false }),
    );
    assert.match(css, /@media \(min-width: 768px\)[\s\S]*display: none !important/);
    // Desktop stays hidden — no state change, no rule. The 768px rule
    // already applies at >=1280px via plain CSS cascade.
    assert.doesNotMatch(css, /1280px/);
  });

  it("when mobile is hidden, hides everywhere then reveals at the breakpoints that override back to visible", () => {
    const css = emitVisibilityCSS(
      SCOPE,
      props({ _visibility: false }, { _visibility: true }),
    );
    assert.match(css, /\.demeurer-hero-abc123 \{ display: none !important; \}/);
    assert.match(css, /@media \(min-width: 768px\)[\s\S]*display: revert !important/);
  });
});

describe("wrapStyle", () => {
  it("returns an empty string for whitespace input", () => {
    assert.equal(wrapStyle(""), "");
    assert.equal(wrapStyle("   \n  "), "");
  });

  it("wraps non-empty CSS in a Shopify {% style %} tag", () => {
    const out = wrapStyle(".x { color: red; }");
    assert.equal(out, "{%- style -%}\n.x { color: red; }\n{%- endstyle -%}");
  });
});

describe("scopeClass", () => {
  it("produces a deterministic class name from sectionType + blockId", () => {
    assert.equal(scopeClass("hero", "abc123"), "demeurer-hero-abc123");
  });

  it("lower-cases and sanitizes weird ids to keep the class CSS-valid", () => {
    assert.equal(scopeClass("hero", "BAD ID!"), "demeurer-hero-bad-id-");
  });
});
