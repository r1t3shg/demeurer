/**
 * Spacer — canvas preview.
 *
 * A bare height-controlled div, optionally containing a centered
 * horizontal rule. Marked `aria-hidden` because a spacer carries no
 * meaning for assistive tech.
 */

import type { SectionRenderProps } from "../types";
import { coerceSpacerProps, dividerThicknessPx } from "./schema";

export function SpacerRender({ props }: SectionRenderProps) {
  const p = coerceSpacerProps(props);
  const containerStyle: React.CSSProperties = {
    height: p.height,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
  const lineStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: 720,
    height: dividerThicknessPx(p.dividerWidth),
    backgroundColor: p.dividerColor,
    border: 0,
    margin: 0,
  };
  return (
    <div aria-hidden="true" style={containerStyle}>
      {p.showDivider ? <hr style={lineStyle} /> : null}
    </div>
  );
}
