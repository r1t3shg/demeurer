/**
 * Tests for the breakpoint-aware mutation helpers and the document
 * migration. Mutations are tested directly against `mutateBlockProps`
 * via the store — that's the same code path the helpers run, but with
 * deterministic before/after states we can assert on.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { promoteOverride, removeOverride, setProp } from "../mutations.ts";
import { useEditorStore } from "../store.ts";
import type { Block, EditorDocument } from "../types.ts";
import { migrateDocument, wrapMobileProps } from "../types.ts";

function freshBlock(props: Block["props"] = wrapMobileProps({})): Block {
  return { id: "b1", type: "hero", props, children: [] };
}

function loadBlock(b: Block): void {
  const doc: EditorDocument = { version: 2, blocks: [b] };
  useEditorStore.getState().loadDocument(doc);
}

function currentBlock(): Block {
  return useEditorStore.getState().document.blocks[0];
}

describe("setProp", () => {
  beforeEach(() => {
    loadBlock(freshBlock(wrapMobileProps({ heading: "H", color: "#000" })));
  });

  it("writes to mobile when breakpoint is mobile", () => {
    setProp("b1", "mobile", "heading", "Updated");
    assert.equal(currentBlock().props.mobile.heading, "Updated");
    assert.equal(currentBlock().props.tablet, undefined);
  });

  it("creates a tablet override layer when first override is set", () => {
    setProp("b1", "tablet", "color", "#abc");
    assert.deepEqual(currentBlock().props.tablet, { color: "#abc" });
    // mobile untouched.
    assert.equal(currentBlock().props.mobile.color, "#000");
  });

  it("appends additional overrides to an existing tablet layer", () => {
    setProp("b1", "tablet", "color", "#abc");
    setProp("b1", "tablet", "heading", "T");
    assert.deepEqual(currentBlock().props.tablet, {
      color: "#abc",
      heading: "T",
    });
  });

  it("with applyToMobile:true at tablet, writes mobile and clears the existing tablet override", () => {
    setProp("b1", "tablet", "color", "#abc");
    assert.deepEqual(currentBlock().props.tablet, { color: "#abc" });

    setProp("b1", "tablet", "color", "#defaulted", { applyToMobile: true });
    assert.equal(currentBlock().props.mobile.color, "#defaulted");
    // The override layer should be gone entirely once empty.
    assert.equal(currentBlock().props.tablet, undefined);
  });

  it("with applyToMobile:true at desktop, clears overrides at BOTH tablet and desktop", () => {
    // Set both tablet and desktop overrides on the same key.
    setProp("b1", "tablet", "color", "#abc");
    setProp("b1", "desktop", "color", "#fff");
    assert.deepEqual(currentBlock().props.tablet, { color: "#abc" });
    assert.deepEqual(currentBlock().props.desktop, { color: "#fff" });

    // Apply-to-all from desktop should mutate mobile AND wipe both
    // override layers — leaving "stale" tablet overrides behind would
    // make "applied to all breakpoints" a lie at the tablet view.
    setProp("b1", "desktop", "color", "#promoted", { applyToMobile: true });
    assert.equal(currentBlock().props.mobile.color, "#promoted");
    assert.equal(currentBlock().props.tablet, undefined);
    assert.equal(currentBlock().props.desktop, undefined);
  });

  it("treats _visibility:false at desktop as a normal override", () => {
    // The synthetic _visibility key is not a section schema field but
    // routes through the same setProp/cascade plumbing — making sure
    // here so the visibility row never has to special-case anything.
    setProp("b1", "desktop", "_visibility", false);
    assert.deepEqual(currentBlock().props.desktop, { _visibility: false });
    // mobile + tablet are untouched — block still visible there.
    assert.equal(currentBlock().props.mobile._visibility, undefined);
    assert.equal(currentBlock().props.tablet, undefined);
  });
});

describe("removeOverride", () => {
  it("is a no-op for mobile", () => {
    loadBlock(freshBlock(wrapMobileProps({ heading: "H" })));
    removeOverride("b1", "mobile", "heading");
    assert.equal(currentBlock().props.mobile.heading, "H");
  });

  it("removes a single key from the desktop layer without touching mobile", () => {
    loadBlock(
      freshBlock({
        mobile: { heading: "H", color: "#000" },
        desktop: { color: "#fff", padding: 16 },
      }),
    );
    removeOverride("b1", "desktop", "color");
    assert.deepEqual(currentBlock().props.desktop, { padding: 16 });
    assert.equal(currentBlock().props.mobile.color, "#000");
  });

  it("removes the layer entirely when its last key is removed", () => {
    loadBlock(
      freshBlock({
        mobile: { color: "#000" },
        tablet: { color: "#abc" },
      }),
    );
    removeOverride("b1", "tablet", "color");
    assert.equal(currentBlock().props.tablet, undefined);
  });
});

describe("promoteOverride", () => {
  it("copies the override value to mobile and strips both non-mobile layers", () => {
    loadBlock(
      freshBlock({
        mobile: { color: "#000" },
        tablet: { color: "#abc" },
        desktop: { color: "#fff" },
      }),
    );
    promoteOverride("b1", "desktop", true, "color");
    assert.equal(currentBlock().props.mobile.color, "#fff");
    assert.equal(currentBlock().props.tablet, undefined);
    assert.equal(currentBlock().props.desktop, undefined);
  });

  it("does nothing when the override doesn't exist at the source breakpoint", () => {
    loadBlock(
      freshBlock({
        mobile: { color: "#000" },
        tablet: { padding: 24 },
      }),
    );
    promoteOverride("b1", "desktop", true, "color");
    assert.equal(currentBlock().props.mobile.color, "#000");
    assert.deepEqual(currentBlock().props.tablet, { padding: 24 });
  });

  it("replaces an existing mobile value when promoting an override", () => {
    // The merchant has already authored a mobile value; promoting an
    // override means "this new value should be the default everywhere".
    // Anything else would silently keep the old default and the
    // override would just look broken.
    loadBlock(
      freshBlock({
        mobile: { color: "#000" },
        desktop: { color: "#promoted" },
      }),
    );
    promoteOverride("b1", "desktop", true, "color");
    assert.equal(currentBlock().props.mobile.color, "#promoted");
    assert.equal(currentBlock().props.desktop, undefined);
  });
});

describe("migrateDocument", () => {
  it("upgrades a v1 flat-props document to v2", () => {
    const v1 = {
      version: 1,
      blocks: [
        {
          id: "x",
          type: "hero",
          props: { heading: "H", color: "#000" },
          children: [],
        },
      ],
    };
    const v2 = migrateDocument(v1);
    assert.equal(v2.version, 2);
    assert.deepEqual(v2.blocks[0].props, {
      mobile: { heading: "H", color: "#000" },
    });
  });

  it("is idempotent on a v2 document", () => {
    const v2In: EditorDocument = {
      version: 2,
      blocks: [
        {
          id: "x",
          type: "hero",
          props: { mobile: { heading: "H" }, tablet: { heading: "T" } },
          children: [],
        },
      ],
    };
    const v2Out = migrateDocument(v2In);
    assert.equal(v2Out.version, 2);
    assert.deepEqual(v2Out.blocks[0].props, {
      mobile: { heading: "H" },
      tablet: { heading: "T" },
    });
  });

  it("recurses into children", () => {
    const v1 = {
      version: 1,
      blocks: [
        {
          id: "outer",
          type: "container",
          props: { gap: 16 },
          children: [
            {
              id: "inner",
              type: "hero",
              props: { heading: "Nested" },
              children: [],
            },
          ],
        },
      ],
    };
    const v2 = migrateDocument(v1);
    assert.deepEqual(v2.blocks[0].props, { mobile: { gap: 16 } });
    assert.deepEqual(v2.blocks[0].children[0].props, {
      mobile: { heading: "Nested" },
    });
  });

  it("returns an empty v2 document for unrecognizable input", () => {
    const out = migrateDocument({ junk: true });
    assert.equal(out.version, 2);
    assert.deepEqual(out.blocks, []);
  });
});
