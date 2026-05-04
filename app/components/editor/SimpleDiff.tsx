/**
 * Hand-rolled line-by-line diff renderer.
 *
 * Walks the two files in lockstep. When lines diverge, looks ahead up
 * to LOOKAHEAD lines on each side to find a re-alignment point so a
 * single inserted line doesn't cascade. Naive — not LCS — but adequate
 * for inspecting `demeurer-*` template differences in a dev tool.
 */

const LOOKAHEAD = 5;

type DiffLine =
  | { kind: "same"; text: string }
  | { kind: "added"; text: string }
  | { kind: "removed"; text: string };

function diff(left: string, right: string): DiffLine[] {
  const a = left.split("\n");
  const b = right.split("\n");
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i >= a.length) {
      out.push({ kind: "added", text: b[j] });
      j++;
      continue;
    }
    if (j >= b.length) {
      out.push({ kind: "removed", text: a[i] });
      i++;
      continue;
    }
    if (a[i] === b[j]) {
      out.push({ kind: "same", text: a[i] });
      i++;
      j++;
      continue;
    }
    // Look ahead for an alignment.
    const aIdx = b.indexOf(a[i], j + 1);
    const bIdx = a.indexOf(b[j], i + 1);
    const aDist = aIdx === -1 ? Infinity : aIdx - j;
    const bDist = bIdx === -1 ? Infinity : bIdx - i;
    if (aDist <= LOOKAHEAD && aDist <= bDist) {
      // a[i] appears later in b. Insert b[j..aIdx-1] as added lines.
      for (let k = j; k < aIdx; k++) out.push({ kind: "added", text: b[k] });
      j = aIdx;
    } else if (bDist <= LOOKAHEAD) {
      // b[j] appears later in a. Mark a[i..bIdx-1] as removed.
      for (let k = i; k < bIdx; k++) out.push({ kind: "removed", text: a[k] });
      i = bIdx;
    } else {
      // No alignment within LOOKAHEAD — emit the divergence as a
      // pair and advance both.
      out.push({ kind: "removed", text: a[i] });
      out.push({ kind: "added", text: b[j] });
      i++;
      j++;
    }
  }
  return out;
}

export interface SimpleDiffProps {
  /** "Theme" content — left-hand side of the diff. */
  left: string;
  /** "Artifact" content — right-hand side of the diff. */
  right: string;
}

export function SimpleDiff({ left, right }: SimpleDiffProps) {
  const lines = diff(left, right);
  return (
    <pre className="demeurer-diff">
      {lines.map((line, i) => (
        <div key={i} className={`demeurer-diff__line demeurer-diff__line--${line.kind}`}>
          <span className="demeurer-diff__sigil">
            {line.kind === "added" ? "+" : line.kind === "removed" ? "-" : " "}
          </span>
          <span className="demeurer-diff__text">{line.text}</span>
        </div>
      ))}
    </pre>
  );
}
