# P1.C Segment 2 — Manual visual check

Cannot be automated: requires a live embedded admin session and
visual inspection of the editor. Run after `npm run dev` is up and
you've opened a page in the editor.

## Setup

1. `npm run dev` — Shopify CLI tunnel + Vite.
2. Press `p` to install on dev store, open any page in the editor.
3. Open browser DevTools (you'll need it for localStorage + viewport
   resize checks).

## Checks

- [ ] Title bar shows three breakpoint segments (Mobile / Tablet /
      Desktop) with icons + width labels.
- [ ] The active segment is filled (Polaris brand color), inactive
      segments are outlined and grey.
- [ ] Clicking each segment constrains the iframe:
   - [ ] Mobile → ~390 px frame, centered, darker stage backdrop.
   - [ ] Tablet → ~768 px frame, centered, darker stage backdrop.
   - [ ] Desktop → full canvas width up to ~1440 px, no extra
         backdrop.
- [ ] Width transition between switches animates smoothly (~200 ms
      ease).
- [ ] Cmd/Ctrl+1 / 2 / 3 switch breakpoints when focus is OUTSIDE
      a text field.
- [ ] Cmd/Ctrl+1 / 2 / 3 do NOT fire when focus is inside an input,
      textarea, or contenteditable (typing "1" stays as "1").
- [ ] Outline pane shows the line "Editing: <Breakpoint>" above the
      tree, in muted text.
- [ ] Properties pane shows the advisory strip above the field list:
   - [ ] Mobile: "All edits apply to all breakpoints." (neutral)
   - [ ] Tablet/Desktop: warning-tinted "Edits will create
         &lt;bp&gt; overrides…"
- [ ] Skeleton spinner does NOT flash on quick breakpoint switches
      (the 100 ms delay swallows fast loads).
- [ ] Skeleton DOES appear on a slow load (throttle Network in
      DevTools to "Slow 3G", switch breakpoints — spinner shows).
- [ ] Scroll position is preserved across breakpoint switches (scroll
      mid-page, switch, scroll position survives the reload).
- [ ] localStorage key `demeurer:editor:activeBreakpoint` updates as
      you switch (DevTools → Application → Local Storage).
- [ ] After a full page refresh, the editor opens at the last-used
      breakpoint.
- [ ] Below 1024 px viewport (resize the browser), the breakpoint
      switcher moves to its own row above the canvas, full-width.
      The toolbar slot disappears so exactly one switcher is visible
      at a time.
- [ ] Editing a text field on the tablet/desktop breakpoint updates
      the iframe to reflect the change (the value is being written
      to the canonical mobile layer for now — confirmation prompt
      lands in segment 3).

## Known boundary behavior

For now, edits at any breakpoint mutate the mobile layer (the data
model defaults to "if no override exists, fall through to mobile").
That means the iframe at the tablet/desktop breakpoint reflects the
mobile value. **This is correct for segment 2.** Segment 3 introduces
the override-creation flow; until then, the advisory strip is purely
informational.
