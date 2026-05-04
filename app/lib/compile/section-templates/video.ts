/**
 * Video — shared section template + per-block adapters.
 *
 * Detects YouTube / Vimeo / direct mp4|webm|ogg from the URL at runtime
 * via Liquid `contains`. No external script tags.
 */

import { coerceVideoProps, videoSchema, VIDEO_TYPE } from "../../sections/video/schema.ts";
import { buildSharedSectionFile, decomposeSpacing, paddingPropMap } from "./_shared.ts";
import type { SectionTemplate } from "./types.ts";

const BODY = `
{%- liquid
  assign url = section.settings.videoUrl
  assign ratio = section.settings.aspectRatio | default: '16:9'
  assign aspect = ratio | replace: ':', ' / '
-%}

<section class="{{ scope }} demeurer-section demeurer-video">
  <div class="demeurer-video__inner" style="max-width: 1200px; margin-inline: auto;">
    {%- if section.settings.heading != blank -%}
      <h2 class="demeurer-video__heading" style="margin: 0 0 24px; text-align: center;">{{ section.settings.heading | escape }}</h2>
    {%- endif -%}
    {%- if section.settings.subheading != blank -%}
      <div class="demeurer-video__subheading" style="margin: 0 0 24px; text-align: center; opacity: 0.75;">{{ section.settings.subheading }}</div>
    {%- endif -%}

    {%- if url != blank -%}
      <div class="demeurer-video__frame" style="position: relative; aspect-ratio: {{ aspect }}; max-width: 1024px; margin-inline: auto; border-radius: 8px; overflow: hidden; background: #000;">
        {%- if url contains 'youtube.com' or url contains 'youtu.be' -%}
          {%- assign yt_id = url | split: 'v=' | last | split: '&' | first -%}
          {%- if url contains 'youtu.be/' -%}
            {%- assign yt_id = url | split: 'youtu.be/' | last | split: '?' | first -%}
          {%- endif -%}
          <iframe
            src="https://www.youtube-nocookie.com/embed/{{ yt_id }}{%- if section.settings.autoplay -%}?autoplay=1&mute=1&playsinline=1{%- endif -%}"
            title="{{ section.settings.heading | default: 'Video' | escape }}"
            loading="lazy"
            referrerpolicy="strict-origin-when-cross-origin"
            allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
            allowfullscreen
            style="position: absolute; inset: 0; width: 100%; height: 100%; border: 0;"></iframe>
        {%- elsif url contains 'vimeo.com' -%}
          {%- assign vimeo_id = url | split: 'vimeo.com/' | last | split: '?' | first -%}
          <iframe
            src="https://player.vimeo.com/video/{{ vimeo_id }}{%- if section.settings.autoplay -%}?autoplay=1&muted=1&playsinline=1{%- endif -%}"
            title="{{ section.settings.heading | default: 'Video' | escape }}"
            loading="lazy"
            referrerpolicy="strict-origin-when-cross-origin"
            allow="autoplay; fullscreen; picture-in-picture"
            allowfullscreen
            style="position: absolute; inset: 0; width: 100%; height: 100%; border: 0;"></iframe>
        {%- else -%}
          <video
            src="{{ url }}"
            {% if section.settings.showControls %}controls{% endif %}
            {% if section.settings.autoplay %}autoplay playsinline{% endif %}
            {% if section.settings.muted %}muted{% endif %}
            preload="metadata"
            style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;">
          </video>
        {%- endif -%}
      </div>
    {%- else -%}
      <div class="demeurer-video__placeholder" style="aspect-ratio: {{ aspect }}; max-width: 1024px; margin-inline: auto; background: #f3f4f6; border-radius: 8px; display: grid; place-items: center; opacity: 0.7;">No video URL set</div>
    {%- endif -%}
  </div>
</section>
`;

export const videoTemplate: SectionTemplate = {
  type: VIDEO_TYPE,
  schema: videoSchema,
  buildSectionTemplate: () =>
    buildSharedSectionFile({
      type: VIDEO_TYPE,
      name: "Demeurer Video",
      body: BODY,
      schema: videoSchema,
      presets: [{ name: "Demeurer Video" }],
    }),
  propMap: [paddingPropMap()],
  toSettings(mobileProps) {
    const p = coerceVideoProps(mobileProps);
    return {
      heading: p.heading,
      subheading: p.subheading,
      videoUrl: p.videoUrl,
      aspectRatio: p.aspectRatio,
      showControls: p.showControls,
      autoplay: p.autoplay,
      muted: p.muted,
      ...decomposeSpacing("padding", p.padding, p.padding),
    };
  },
};
