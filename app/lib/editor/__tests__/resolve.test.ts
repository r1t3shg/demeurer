/**
 * Tests for the cascade resolution helpers.
 *
 * The cascade is the load-bearing piece of P1.C: every consumer of block
 * props goes through these helpers, so a regression here would visibly
 * break the editor and the preview at once. Exhaustive coverage of the
 * three breakpoints plus the override surface is worth the bytes.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  hasOverride,
  listOverrides,
  resolveProp,
  resolveProps,
} from "../resolve.ts";
import type { Block } from "../types.ts";

function blockFor(props: Block["props"]): Block {
  return { id: "b1", type: "hero", props, children: [] };
}

describe("resolveProps", () => {
  it("mobile-only block returns a clone of mobile at every breakpoint", () => {
    const b = blockFor({ mobile: { heading: "H", color: "#000" } });
    assert.deepEqual(resolveProps(b, "mobile"), { heading: "H", color: "#000" });
    assert.deepEqual(resolveProps(b, "tablet"), { heading: "H", color: "#000" });
    assert.deepEqual(resolveProps(b, "desktop"), { heading: "H", color: "#000" });
  });

  it("tablet override takes effect at tablet and desktop only", () => {
    const b = blockFor({
      mobile: { heading: "H", color: "#000" },
      tablet: { color: "#abc" },
    });
    assert.deepEqual(resolveProps(b, "mobile"), { heading: "H", color: "#000" });
    assert.deepEqual(resolveProps(b, "tablet"), { heading: "H", color: "#abc" });
    assert.deepEqual(resolveProps(b, "desktop"), { heading: "H", color: "#abc" });
  });

  it("desktop override beats tablet override beats mobile", () => {
    const b = blockFor({
      mobile: { heading: "M", color: "#000" },
      tablet: { color: "#aaa" },
      desktop: { color: "#fff", heading: "D" },
    });
    assert.deepEqual(resolveProps(b, "mobile"), { heading: "M", color: "#000" });
    assert.deepEqual(resolveProps(b, "tablet"), { heading: "M", color: "#aaa" });
    assert.deepEqual(resolveProps(b, "desktop"), { heading: "D", color: "#fff" });
  });

  it("returns a fresh object — callers can't mutate the document via the return value", () => {
    const b = blockFor({ mobile: { heading: "H" } });
    const out = resolveProps(b, "mobile");
    out.heading = "MUTATED";
    assert.equal(b.props.mobile.heading, "H");
  });
});

describe("resolveProp", () => {
  it("source is the most-specific layer for a desktop lookup", () => {
    const b = blockFor({
      mobile: { color: "#000", heading: "H" },
      tablet: { color: "#aaa" },
      desktop: { color: "#fff" },
    });
    assert.deepEqual(resolveProp(b, "desktop", "color"), {
      value: "#fff",
      source: "desktop",
    });
    assert.deepEqual(resolveProp(b, "desktop", "heading"), {
      value: "H",
      source: "mobile",
    });
  });

  it("source falls back through tablet to mobile when desktop is missing", () => {
    const b = blockFor({
      mobile: { color: "#000" },
      tablet: { color: "#aaa" },
    });
    assert.deepEqual(resolveProp(b, "desktop", "color"), {
      value: "#aaa",
      source: "tablet",
    });
  });

  it("tablet lookup never reads from desktop", () => {
    const b = blockFor({
      mobile: { color: "#000" },
      desktop: { color: "#fff" },
    });
    assert.deepEqual(resolveProp(b, "tablet", "color"), {
      value: "#000",
      source: "mobile",
    });
  });

  it("mobile lookup ignores any tablet/desktop overrides", () => {
    const b = blockFor({
      mobile: { color: "#000" },
      tablet: { color: "#aaa" },
      desktop: { color: "#fff" },
    });
    assert.deepEqual(resolveProp(b, "mobile", "color"), {
      value: "#000",
      source: "mobile",
    });
  });
});

describe("hasOverride", () => {
  it("mobile is always 'overridden' (canonical)", () => {
    const b = blockFor({ mobile: {} });
    assert.equal(hasOverride(b, "mobile", "anyKey"), true);
  });

  it("returns true only when the key exists in that layer", () => {
    const b = blockFor({
      mobile: { color: "#000", heading: "H" },
      tablet: { color: "#aaa" },
    });
    assert.equal(hasOverride(b, "tablet", "color"), true);
    assert.equal(hasOverride(b, "tablet", "heading"), false);
    assert.equal(hasOverride(b, "desktop", "color"), false);
  });
});

describe("listOverrides", () => {
  it("mobile lists every key on the canonical layer", () => {
    const b = blockFor({ mobile: { color: "#000", heading: "H" } });
    assert.deepEqual(listOverrides(b, "mobile").sort(), ["color", "heading"]);
  });

  it("tablet/desktop list only the keys present in their override layer", () => {
    const b = blockFor({
      mobile: { color: "#000", heading: "H", padding: 16 },
      tablet: { padding: 24 },
      desktop: { padding: 32, heading: "D" },
    });
    assert.deepEqual(listOverrides(b, "tablet"), ["padding"]);
    assert.deepEqual(listOverrides(b, "desktop").sort(), ["heading", "padding"]);
  });

  it("returns an empty array when the override layer is missing", () => {
    const b = blockFor({ mobile: { color: "#000" } });
    assert.deepEqual(listOverrides(b, "tablet"), []);
    assert.deepEqual(listOverrides(b, "desktop"), []);
  });
});
