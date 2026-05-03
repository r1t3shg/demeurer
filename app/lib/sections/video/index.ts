import type { SectionDefinition } from "../types";
import { VideoRender } from "./Render";
import { VIDEO_TYPE, videoDefaults, videoSchema } from "./schema";
import { videoToLiquid } from "./toLiquid";

export const videoDefinition: SectionDefinition = {
  type: VIDEO_TYPE,
  label: "Video",
  description:
    "Embed a YouTube, Vimeo, or self-hosted MP4. Iframes lazy-load, third-party domains use no-cookie variants, and autoplay always implies muted.",
  icon: "Play",
  category: "media",
  schema: videoSchema,
  defaults: { ...videoDefaults },
  Render: VideoRender,
  toLiquid: videoToLiquid,
};
