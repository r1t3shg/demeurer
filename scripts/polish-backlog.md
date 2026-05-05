# Polish backlog

**Cosmetic** issues from the P1.E dogfood and code review.
Visual or copy nits — not functionally important; touched
when adjacent code is being modified, not as standalone work.

## Format

```
- [ ] <one-line summary>
      Source: dogfood page N | code review | designer pass
      Notes: optional context
```

## Pre-populated cosmetic notes (from P1.E)

### Empty states

- [ ] The "no product bound — preview shows placeholder data"
      info banner in product-details Render (`Render.tsx:51`)
      could be tighter copy.
- [ ] Empty form in editor renders with no visual hint that
      "fields = 0 means error" — the qualityCheck error fires
      but only after the merchant adds the form.

### Toolbar

- [ ] "Show drift (dev)" + "Show compiled output (dev)" buttons
      in the editor toolbar are dev-only but still take up
      visual space when they appear. Move into a dev-only
      hamburger menu.

### Canvas

- [ ] Variant fade indicator (when `previewVariantId` doesn't
      match a block's `variantBinding`) uses opacity 0.4 — may
      be too subtle for some merchant displays. Test in
      production lighting.

### Properties panel

- [ ] Globe icon on text/richtext fields is small and easily
      missed. Consider a "Translatable" tooltip on hover that
      explicitly mentions Translate & Adapt.

### Outline

- [ ] Variant badge after override dots can be confused with
      the override dots themselves on small screens.

## Format reminder

Items in this file should never block any release. They're
collected so that the next time a designer / UX pass runs, the
list is ready.
