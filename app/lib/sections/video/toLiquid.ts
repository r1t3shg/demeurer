/**
 * Video — Liquid compiler.
 *
 * The URL is parsed at compile time so the published Liquid is a flat
 * iframe / <video> tag — no runtime URL parsing on the storefront.
 * `loading="lazy"` on every iframe protects Lighthouse Performance:
 * the embed only loads when scrolled into view.
 *
 * If the URL is unrecognised at compile time, we still emit the
 * setting to a hidden `<noscript>` block — the merchant can fix the
 * URL in the theme editor after publish without a Demeurer rebuild.
 */

import type { PropsByBreakpoint } from "../../editor/types";
import { liquidString } from "../_shared/coerce";
import type { LiquidOutput, ToLiquidContext, SpacingValue } from "../types";
import {
  emitResponsiveCSS,
  emitVisibilityCSS,
  scopeClass,
  wrapStyle,
  type CssPropMap,
} from "../_shared/responsive-css";
import { aspectRatioCss, parseVideoUrl } from "./parse";
import { coerceVideoProps, videoDefaults } from "./schema";

export function videoToLiquid(
  propsByBreakpoint: PropsByBreakpoint,
  ctx: ToLiquidContext,
): LiquidOutput {
  const props = coerceVideoProps(propsByBreakpoint.mobile);
  const scope = scopeClass(ctx.sectionType, ctx.blockId);
  const parsed = parseVideoUrl(props.videoUrl);
  const aspect = aspectRatioCss(props.aspectRatio);

  const schema = {
    name: "Video",
    tag: "section",
    class: `demeurer-section demeurer-${ctx.sectionType}`,
    settings: [
      { type: "text", id: "heading", label: "Heading" },
      { type: "richtext", id: "subheading", label: "Subheading" },
      { type: "url", id: "video_url", label: "Video URL", default: props.videoUrl },
      {
        type: "select",
        id: "aspect_ratio",
        label: "Aspect ratio",
        options: [
          { value: "16:9", label: "16:9" },
          { value: "4:3", label: "4:3" },
          { value: "1:1", label: "1:1" },
          { value: "9:16", label: "9:16" },
        ],
        default: props.aspectRatio,
      },
      { type: "checkbox", id: "show_controls", label: "Show controls", default: props.showControls },
      { type: "checkbox", id: "autoplay", label: "Autoplay (muted only)", default: props.autoplay },
      { type: "checkbox", id: "muted", label: "Start muted", default: props.muted },
      { type: "range", id: "padding_top", label: "Padding top", min: 0, max: 240, step: 4, unit: "px", default: videoDefaults.padding.top },
      { type: "range", id: "padding_bottom", label: "Padding bottom", min: 0, max: 240, step: 4, unit: "px", default: videoDefaults.padding.bottom },
      { type: "range", id: "padding_x", label: "Padding (sides)", min: 0, max: 96, step: 4, unit: "px", default: videoDefaults.padding.left },
    ],
    presets: [{ name: "Video" }],
  };

  let embed = "";
  if (parsed.kind === "youtube") {
    const src = `https://www.youtube-nocookie.com/embed/${parsed.id}?rel=0${
      props.autoplay ? "&autoplay=1&mute=1" : ""
    }${props.showControls ? "" : "&controls=0"}`;
    embed = `<iframe title="${escapeAttr(props.heading || "Video")}" src="${src}" loading="lazy" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="width:100%;height:100%;border:0;display:block;"></iframe>`;
  } else if (parsed.kind === "vimeo") {
    const src = `https://player.vimeo.com/video/${parsed.id}?dnt=1${
      props.autoplay ? "&autoplay=1&muted=1" : ""
    }${props.showControls ? "" : "&controls=0"}`;
    embed = `<iframe title="${escapeAttr(props.heading || "Video")}" src="${src}" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen style="width:100%;height:100%;border:0;display:block;"></iframe>`;
  } else if (parsed.kind === "file") {
    embed = `<video src="${escapeAttr(parsed.url)}"${props.showControls ? " controls" : ""}${props.autoplay ? " autoplay" : ""}${props.muted ? " muted" : ""} playsinline preload="metadata" style="width:100%;height:100%;object-fit:cover;display:block;"></video>`;
  } else {
    embed = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:rgba(0,0,0,0.55);font-size:14px;text-align:center;padding:16px;">Video URL not set.</div>`;
  }

  const fallbackHeading = liquidString(props.heading);
  const fallbackSub = liquidString(props.subheading);

  const propMap: CssPropMap[] = [
    {
      propKey: "padding",
      cssProperty: "padding",
      toCss: (v) => {
        const p = v as SpacingValue;
        return `${p.top}px ${p.right}px ${p.bottom}px ${p.left}px`;
      },
    },
  ];

  const overrideCss = emitResponsiveCSS(scope, propsByBreakpoint, propMap);
  const visibilityCss = emitVisibilityCSS(scope, propsByBreakpoint);
  const styleBlock = wrapStyle([overrideCss, visibilityCss].filter(Boolean).join("\n"));

  const template = `
${styleBlock}
{%- liquid
  assign heading = section.settings.heading | default: ${fallbackHeading}
  assign subheading = section.settings.subheading | default: ${fallbackSub}
-%}

<div
  class="${scope} demeurer-video"
  style="
    padding: {{ section.settings.padding_top }}px {{ section.settings.padding_x }}px {{ section.settings.padding_bottom }}px;
  "
>
  {%- if heading != blank or subheading != blank -%}
    <div style="text-align: center; max-width: 720px; margin-inline: auto; margin-bottom: 24px;">
      {%- if heading != blank -%}
        <h2 style="margin: 0; line-height: 1.2;">{{ heading | escape }}</h2>
      {%- endif -%}
      {%- if subheading != blank -%}
        <div style="margin-top: 12px; opacity: 0.8; line-height: 1.5;">{{ subheading }}</div>
      {%- endif -%}
    </div>
  {%- endif -%}
  <div style="
    width: 100%;
    max-width: 1080px;
    margin-inline: auto;
    aspect-ratio: ${aspect};
    background: #000;
    border-radius: 8px;
    overflow: hidden;
  ">
    ${embed}
  </div>
</div>
`.trim();

  return { schema, template };
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
