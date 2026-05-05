# Multilingual Demeurer pages

Demeurer pages support translation via Shopify's free **Translate &
Adapt** app. Setup is upstream — Demeurer doesn't ship a translation
UI of its own. Once T&A is installed and the merchant has added
languages, every text and rich-text field in our compiled sections
appears for translation automatically.

## Setup

1. Install **Translate & Adapt** from the Shopify App Store.
2. Add the languages you want to support: Shopify Admin → Settings →
   Languages → Add language.
3. Open Translate & Adapt.
4. Find your Demeurer page in the **Pages** or **Products** tab
   (product pages bound via templateSuffix appear under the bound
   product).
5. Translate the section content fields.

## What's translatable

Demeurer compiles section settings using Shopify's standard schema
types. Translate & Adapt picks them up automatically:

| Editor field kind | Shopify type        | Translatable? |
|-------------------|---------------------|---------------|
| `text`            | `text` / `textarea` | ✓             |
| `richtext`        | `richtext`          | ✓             |
| `url`             | `url`               | ✗ (intentional — URLs aren't typically translated) |
| `image`           | `image_picker`      | ✗ (use T&A's "Adapt" tab for localized images) |
| `color`           | `color`             | ✗ (no language semantics) |
| `number`          | `number` / `range`  | ✗ |
| `boolean`         | `checkbox`          | ✗ |
| `select`          | `select`            | ✗ (option values are layout choices, not content) |
| `spacing`         | 4 × `number`        | ✗ |
| `list` items      | block settings      | text / richtext children translatable |

The translatable indicator (a small globe icon) appears next to
text and richtext fields in the Demeurer editor as a reminder.

## Multi-language images

Translation isn't just text. If a page has English-text-on-image and
needs a Spanish-text-on-image equivalent:

1. Upload the localized image to Shopify Files.
2. In Translate & Adapt, switch to the **Adapt** tab for that
   language.
3. Find the section's image setting and select the localized image.

## RTL languages

Demeurer sections automatically reflow for right-to-left languages
(Arabic, Hebrew, etc.) using CSS logical properties (`padding-
inline-start`, `text-align: start`, etc.). No special configuration
needed.

The product-details section's "Image right" layout flips
automatically because it uses `direction: rtl` on the outer
container — the inner blocks reset to `direction: ltr` so prices
and form inputs read correctly.

## Limitations

- **Per-variant content (segment 2) is bound by variant ID, not
  language.** If you need different content per language AND per
  variant, the cleaner approach is separate Demeurer pages per
  language with Shopify's URL structure (`/en/...`, `/es/...`).
- **Demeurer doesn't ship its own translation UI.** Translate &
  Adapt is the source of truth; no per-language fields in the
  editor.
- **Machine translation isn't built in.** T&A integrates with
  Shopify's translation tools (manual + AI-assisted) — none of
  that is Demeurer's concern.

## Verifying the round-trip

The smoke protocol at `scripts/p1e-segment2-smoke.md` (steps 10–13)
walks through installing T&A, translating a hero heading, switching
the storefront language, and confirming the translation displays.

This step requires a real dev store and the merchant — it can't be
agent-run.
