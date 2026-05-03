/**
 * Video embed — schema, defaults, metadata.
 *
 * URL-driven: paste any YouTube, Vimeo, or direct mp4/webm/ogg URL and
 * the section detects the kind. Autoplay defaults to OFF — autoplay is
 * hostile and tanks Lighthouse Best Practices anyway. The schema
 * enforces "muted = true if autoplay = true" because every modern
 * browser silently blocks unmuted autoplay; the validation lives in
 * `coerceVideoProps` so the document can never be in a broken state.
 */

import type { SectionSchema, SpacingValue } from "../types";
import {
  coerceBoolean,
  coerceEnum,
  coerceSpacing,
  coerceString,
} from "../_shared/coerce";

export const VIDEO_TYPE = "video";

export type AspectRatio = "16:9" | "4:3" | "1:1" | "9:16";
const RATIOS: AspectRatio[] = ["16:9", "4:3", "1:1", "9:16"];

export interface VideoProps {
  videoUrl: string;
  autoplay: boolean;
  muted: boolean;
  showControls: boolean;
  aspectRatio: AspectRatio;
  heading: string;
  subheading: string;
  padding: SpacingValue;
}

export const videoSchema: SectionSchema = {
  fields: [
    { kind: "text", key: "heading", label: "Heading" },
    { kind: "richtext", key: "subheading", label: "Subheading" },
    { kind: "url", key: "videoUrl", label: "Video URL (YouTube, Vimeo, or .mp4)" },
    {
      kind: "select",
      key: "aspectRatio",
      label: "Aspect ratio",
      options: [
        { value: "16:9", label: "16:9 (widescreen)" },
        { value: "4:3", label: "4:3 (classic)" },
        { value: "1:1", label: "1:1 (square)" },
        { value: "9:16", label: "9:16 (vertical)" },
      ],
      default: "16:9",
    },
    { kind: "boolean", key: "showControls", label: "Show controls" },
    { kind: "boolean", key: "autoplay", label: "Autoplay (muted only)" },
    { kind: "boolean", key: "muted", label: "Start muted" },
    { kind: "spacing", key: "padding", label: "Section padding" },
  ],
};

export const videoDefaults: VideoProps = {
  videoUrl: "",
  autoplay: false,
  muted: true,
  showControls: true,
  aspectRatio: "16:9",
  heading: "",
  subheading: "",
  padding: { top: 64, right: 24, bottom: 64, left: 24 },
};

export function coerceVideoProps(input: Record<string, unknown>): VideoProps {
  const autoplay = coerceBoolean(input.autoplay, videoDefaults.autoplay);
  // Browsers silently block unmuted autoplay. Treat muted=true as
  // implicit when autoplay is on so the document is always coherent.
  const mutedRaw = coerceBoolean(input.muted, videoDefaults.muted);
  const muted = autoplay ? true : mutedRaw;
  return {
    videoUrl: coerceString(input.videoUrl, videoDefaults.videoUrl),
    autoplay,
    muted,
    showControls: coerceBoolean(input.showControls, videoDefaults.showControls),
    aspectRatio: coerceEnum<AspectRatio>(
      input.aspectRatio,
      RATIOS,
      videoDefaults.aspectRatio,
    ),
    heading: coerceString(input.heading, videoDefaults.heading),
    subheading: coerceString(input.subheading, videoDefaults.subheading),
    padding: coerceSpacing(input.padding, videoDefaults.padding),
  };
}
