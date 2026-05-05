/**
 * Product token replacement tests.
 *
 * Exercises `replaceProductTokens` from
 * `app/lib/compile/product-tokens.ts`. The compile pipeline runs
 * this on text/richtext settings of productAware sections; these
 * tests target the function directly.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  PRODUCT_TOKEN_KEYS,
  PRODUCT_TOKENS,
  replaceProductTokens,
} from "../product-tokens.ts";
import type { Diagnostic } from "../types.ts";

describe("replaceProductTokens", () => {
  it("replaces every documented token with proper Liquid", () => {
    for (const key of PRODUCT_TOKEN_KEYS) {
      const diags: Diagnostic[] = [];
      const out = replaceProductTokens(key, diags);
      assert.strictEqual(out, PRODUCT_TOKENS[key]);
      assert.strictEqual(diags.length, 0);
    }
  });

  it("replaces multiple tokens in one string", () => {
    const diags: Diagnostic[] = [];
    const input = "Welcome to {{product.title}} — only {{product.price}}!";
    const out = replaceProductTokens(input, diags);
    assert.strictEqual(
      out,
      "Welcome to {{ product.title }} — only {{ product.price | money }}!",
    );
    assert.strictEqual(diags.length, 0);
  });

  it("flags unrecognized {{product.X}} tokens with a diagnostic", () => {
    const diags: Diagnostic[] = [];
    const input = "Hi {{product.title}} and {{product.unicorn_count}}!";
    const out = replaceProductTokens(input, diags, "blk_1", "heading");
    // Recognized token replaced; unrecognized left in place.
    assert.match(out, /\{\{ product\.title \}\}/);
    assert.match(out, /\{\{product\.unicorn_count\}\}/);
    assert.strictEqual(diags.length, 1);
    assert.strictEqual(diags[0].level, "warning");
    assert.strictEqual(diags[0].blockId, "blk_1");
    assert.strictEqual(diags[0].field, "heading");
    assert.match(diags[0].message, /unicorn_count/);
  });

  it("works with tokens embedded in HTML (richtext fields)", () => {
    const diags: Diagnostic[] = [];
    const input =
      "<p>Buy <strong>{{product.title}}</strong> for {{product.price}}</p>";
    const out = replaceProductTokens(input, diags);
    assert.match(out, /<strong>\{\{ product\.title \}\}<\/strong>/);
    assert.match(out, /\{\{ product\.price \| money \}\}/);
  });

  it("plain strings without tokens pass through unchanged", () => {
    const diags: Diagnostic[] = [];
    const input = "Just some regular text — no tokens here.";
    const out = replaceProductTokens(input, diags);
    assert.strictEqual(out, input);
    assert.strictEqual(diags.length, 0);
  });

  it("empty / non-string inputs pass through harmlessly", () => {
    const diags: Diagnostic[] = [];
    assert.strictEqual(replaceProductTokens("", diags), "");
    // @ts-expect-error — testing defensive handling
    assert.strictEqual(replaceProductTokens(null, diags), null);
    // @ts-expect-error — testing defensive handling
    assert.strictEqual(replaceProductTokens(undefined, diags), undefined);
    assert.strictEqual(diags.length, 0);
  });

  it("the same unrecognized token isn't double-flagged", () => {
    const diags: Diagnostic[] = [];
    const input =
      "{{product.foo}} appears twice: {{product.foo}}";
    replaceProductTokens(input, diags);
    assert.strictEqual(diags.length, 1);
  });

  it("featured_image expands with image_url filter", () => {
    const diags: Diagnostic[] = [];
    const out = replaceProductTokens("{{product.featured_image}}", diags);
    assert.strictEqual(out, "{{ product.featured_image | image_url: width: 2400 }}");
  });
});
