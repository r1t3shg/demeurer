import type { SectionDefinition } from "../types";
import { LogoWallRender } from "./Render";
import { LOGO_WALL_TYPE, logoWallDefaults, logoWallSchema } from "./schema";
import { logoWallToLiquid } from "./toLiquid";

export const logoWallDefinition: SectionDefinition = {
  type: LOGO_WALL_TYPE,
  label: "Logo wall",
  icon: "Building2",
  category: "content",
  schema: logoWallSchema,
  defaults: { ...logoWallDefaults },
  Render: LogoWallRender,
  toLiquid: logoWallToLiquid,
};
