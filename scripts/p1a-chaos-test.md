# P1.A Chaos Test — Editor Data-Loss Verification

**Purpose**: prove the editor cannot lose user work. This is the P1.A
exit gate. 50/50 rounds must recover the most recent edit without data
loss before P1.B starts.

**Why manual**: instrumenting browser crashes in CI is significantly
more work than the test deserves at this stage. Run by hand; record
the result in `PROJECT_STATUS.md`.

---

## Setup

1. Start dev server (preferably with a slow-network throttle off):
   ```bash
   cd /Users/riteshgupta/Developer/demeurer
   npm run dev
   # press p when prompted to open the install URL on the dev store
   ```
2. From the dev store admin, open Demeurer and create a fresh test
   page named `Chaos Test`. Note its id from the URL.
3. Open Chrome DevTools (Cmd+Opt+I). Pin the **Application** and
   **Network** tabs.
4. Confirm the toolbar shows a **Simulate crash (dev)** button. If
   missing, you're running a production build — restart dev.

For each round:
- Note the test number, what you did, the expected recovery state, and
  whether recovery matched. Five categories × ten rounds = 50 rounds.
- A round PASSES when the recovery banner appears (or autosave
  succeeded) AND the resulting state matches the most recent edit.

## Category 1 — Edit + crash (rounds 1–10)

For each round 1..10:
1. Add 5 stub blocks via the outline (mix of hero / text / image).
2. Edit one block's `props` JSON in the right panel (e.g. change
   `title`).
3. **Within 400ms** of the edit (before the autosave indicator says
   "Saved · just now"), click **Simulate crash (dev)**.
4. After reload: the recovery banner should appear with a recent
   `dirtyAt` timestamp. Click **Restore**.
5. Verify: 5 blocks present, the edited prop change preserved.

Expected pass: 10/10. Failure mode to watch for: banner doesn't
appear (localStorage write didn't fire) or the restored state is
missing the most recent edit.

## Category 2 — Undo/redo + crash (rounds 11–20)

For each round 11..20:
1. Add 4 blocks. Wait for autosave to settle ("Saved · just now").
2. Press Cmd+Z three times. Outline shrinks to 1 block.
3. Press Cmd+Shift+Z once. Outline grows back to 2 blocks.
4. Click **Simulate crash (dev)** before the next autosave.
5. After reload + Restore: outline shows 2 blocks (state from step 3),
   not 4 (pre-undo) or 1 (mid-undo).

Expected pass: 10/10. Watch for: history/future stacks not being
serialized to localStorage (we only persist `document`, which is
correct — the recovered doc IS the post-undo state).

## Category 3 — Drag reorder + crash (rounds 21–30)

For each round 21..30:
1. Add 3 blocks: hero, text, image (in that order).
2. Drag the image up so the order becomes image, hero, text. Wait
   for the drop animation to complete.
3. Drag the text up so order becomes image, text, hero.
4. Click **Simulate crash (dev)** within ~400ms of the second drop.
5. After reload + Restore: outline order is image, text, hero.

Expected pass: 10/10. Watch for: order matches the *last* drop, not
the pre-drop or pre-second-drop state.

## Category 4 — Restore old version then edit + crash (rounds 31–40)

Pre-step (once): create a baseline. Add 2 blocks; click **History →
Save named snapshot** with label `baseline`. Wait for save.

For each round 31..40:
1. Add 3 more blocks. Wait for autosave to settle.
2. Open History, click **Restore** on `baseline`. Confirm.
   Outline collapses to 2 blocks.
3. Edit one of the 2 blocks (change a prop).
4. Click **Simulate crash (dev)** within 400ms.
5. After reload + Restore: outline shows the 2 blocks from
   `baseline` PLUS the prop edit from step 3 — not the 5-block state
   from step 1.

Expected pass: 10/10. Watch for: the recovered state being the
pre-restore (5 blocks) version. That would mean the restore path
isn't dirtying the doc, so localStorage still holds the old draft.

## Category 5 — Offline edit + crash (rounds 41–50)

For each round 41..50:
1. Open DevTools → Network → throttle to **Offline**.
2. Add 2 blocks. Save indicator should flip to **Save failed —
   retrying** (with backoff).
3. Edit a prop on each block.
4. Click **Simulate crash (dev)**.
5. After reload (still offline): recovery banner appears with the
   2 added blocks + edits.
6. Click **Restore**.
7. Switch network back to **Online**. Watch the indicator: should
   transition Save failed → Saving → Saved.

Expected pass: 10/10. Watch for: localStorage path failing because
the autosave kept retrying through the crash, OR the post-restore
autosave never recovering after returning online.

---

## Recording the result

After all 50 rounds, append to `PROJECT_STATUS.md` under "P1.A exit
gate":

```
| Category | Rounds | Passed |
|----------|--------|--------|
| Edit + crash             | 10 | _/10 |
| Undo/redo + crash        | 10 | _/10 |
| Drag reorder + crash     | 10 | _/10 |
| Restore + edit + crash   | 10 | _/10 |
| Offline edit + crash     | 10 | _/10 |
| **Total**                | 50 | _/50 |
```

**50/50 = P1.A complete, proceed to P1.B.**
**Any failure = P1.A blocker. Diagnose the failing category, fix, re-run that category until 10/10, then re-run the full sweep.**

## Common failure investigation

- **Banner missing on reload**: open DevTools → Application →
  Local Storage → check for `demeurer:draft:<page-id>`. If absent,
  the `useDraftMirror` subscription didn't fire. If present but
  `dirtyAt < page.updatedAt`, `inspectDraft` correctly classified
  it as stale — autosave probably succeeded faster than the crash.
- **Restored state missing recent edit**: the autosave debounce
  (400ms) hadn't yet flushed AND the localStorage write also
  hadn't fired. Confirm `useDraftMirror` writes synchronously on
  every doc change; do not debounce it.
- **Restore path loses edits made after restore**: the restore
  doesn't re-flip `isDirty=true`. Check `handleRestore` in
  `app/routes/app.pages.$id.tsx`.
