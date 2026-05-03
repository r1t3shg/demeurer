import type { SectionDefinition } from "../types";
import { VideoRender } from "./Render";
import { VIDEO_TYPE, videoDefaults, videoSchema } from "./schema";
import { videoToLiquid } from "./toLiquid";

export const videoDefinition: SectionDefinition = {
  type: VIDEO_TYPE,
  label: "Video",
  icon: "Play",
  category: "media",
  schema: videoSchema,
  defaults: { ...videoDefaults },
  Render: VideoRender,
  toLiquid: videoToLiquid,
};
