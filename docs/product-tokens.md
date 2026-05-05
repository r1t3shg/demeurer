# Product tokens

On a product page, merchants can use shorthand tokens in **text** and
**richtext** fields of any `productAware` section. The compile step
expands them into proper Shopify Liquid before publishing.

## Supported tokens

| Token in editor                | Compiled Liquid                                         |
|--------------------------------|---------------------------------------------------------|
| `{{product.title}}`            | `{{ product.title }}`                                   |
| `{{product.handle}}`           | `{{ product.handle }}`                                  |
| `{{product.vendor}}`           | `{{ product.vendor }}`                                  |
| `{{product.type}}`             | `{{ product.type }}`                                    |
| `{{product.price}}`            | `{{ product.price | money }}`                           |
| `{{product.compare_at_price}}` | `{{ product.compare_at_price | money }}`                |
| `{{product.description}}`      | `{{ product.description }}`                             |
| `{{product.url}}`              | `{{ product.url }}`                                     |
| `{{product.featured_image}}`   | `{{ product.featured_image | image_url: width: 2400 }}` |

Implementation: `app/lib/compile/product-tokens.ts`.

## Where they apply

The compile pipeline runs token replacement on every text or richtext
field in a section's settings, but only when:

- the page's `type === "product"`, AND
- the section's `productAware === true`.

Sections that are `productAware` (as of P1.E segment 1):

- `hero` — heading, subheading, ctaLabel
- `image-text` — heading, body, ctaLabel, imageAlt
- `product-details` — addToCartLabel
- (more sections may opt in over time)

URL, select, color, number, boolean, image, and spacing fields are
**not** scanned. This is a deliberate narrow allowlist — prevents
accidental tokenization of color hex strings or URL paths that happen
to contain `{{`.

## Unrecognized tokens

If you write `{{product.unicorn_count}}`, the compile step:

1. Leaves the literal in place.
2. Emits a warning diagnostic in the compile result so the merchant
   can spot the typo via "Show compiled output (dev)".

## Landing pages

Token replacement is **skipped** on landing pages. There's no
`{{ product }}` in the runtime Liquid context for a landing-page
template, so the literal stays as-is and renders as plain text. If you
move a section from a landing page to a product page (by recreating
it), the tokens activate.

## Future expansions

Tokens we may add later (not in MVP):

- `{{product.first_variant.price}}` — explicit first variant
- `{{product.metafield.demeurer.foo}}` — metafield access
- `{{product.tags}}` — comma-separated tags

Open an issue if you need one.
