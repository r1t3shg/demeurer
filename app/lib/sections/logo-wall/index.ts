import type { SectionDefinition } from "../types";
import { LogoWallRender } from "./Render";
import { LOGO_WALL_TYPE, logoWallDefaults, logoWallSchema } from "./schema";
import { logoWallToLiquid } from "./toLiquid";

export const logoWallDefinition: SectionDefinition = {
  type: LOGO_WALL_TYPE,
  label: "Logo wall",
  description:
    "A row of partner, press, or customer logos. Choose grid for static layout or marquee for a slow horizontal scroll on the storefront.",
  icon: "Building2",
  category: "content",
  schema: logoWallSchema,
  defaults: { ...logoWallDefaults },
  Render: LogoWallRender,
  toLiquid: logoWallToLiquid,
};
