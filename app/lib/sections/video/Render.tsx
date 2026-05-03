/**
 * Video — canvas preview.
 *
 * YouTube/Vimeo render through their privacy-friendly embed endpoints
 * (`youtube-nocookie.com`, `player.vimeo.com`). Direct files render via
 * `<video>`. Unrecognised URLs render a placeholder card so the editor
 * doesn't show a broken iframe while the merchant is still typing.
 */

import { sanitizeRichText } from "../../sanitize";
import type { SectionRenderProps } from "../types";
import { aspectRatioCss, parseVideoUrl } from "./parse";
import { coerceVideoProps } from "./schema";

export function VideoRender({ props, themeTokens }: SectionRenderProps) {
  const p = coerceVideoProps(props);
  const parsed = parseVideoUrl(p.videoUrl);

  const containerStyle: React.CSSProperties = {
    paddingTop: p.padding.top,
    paddingBottom: p.padding.bottom,
    paddingInlineStart: p.padding.left,
    paddingInlineEnd: p.padding.right,
    fontFamily: themeTokens.typography.bodyFont,
    backgroundColor: themeTokens.colors.background,
    color: themeTokens.colors.text,
  };

  const headerStyle: React.CSSProperties = {
    textAlign: "center",
    maxWidth: 720,
    marginInline: "auto",
    marginBottom: themeTokens.spacing.unit * 3,
  };

  const frameStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: 1080,
    marginInline: "auto",
    aspectRatio: aspectRatioCss(p.aspectRatio),
    backgroundColor: "#000",
    borderRadius: 8,
    overflow: "hidden",
    display: "block",
  };

  const iframeStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    border: 0,
    display: "block",
  };

  const placeholderStyle: React.CSSProperties = {
    ...frameStyle,
    backgroundColor: "rgba(0,0,0,0.06)",
    color: "rgba(0,0,0,0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    textAlign: "center",
    padding: 16,
  };

  return (
    <section style={containerStyle}>
      {p.heading || p.subheading ? (
        <div style={headerStyle}>
          {p.heading ? (
            <h2 style={{ margin: 0, lineHeight: 1.2 }}>{p.heading}</h2>
          ) : null}
          {p.subheading ? (
            <div
              style={{ marginTop: 12, opacity: 0.8, lineHeight: 1.5 }}
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: sanitizeRichText(p.subheading) }}
            />
          ) : null}
        </div>
      ) : null}

      {parsed.kind === "youtube" ? (
        <iframe
          title={p.heading || "Video"}
          src={`https://www.youtube-nocookie.com/embed/${parsed.id}?rel=0${
            p.autoplay ? "&autoplay=1&mute=1" : ""
          }${p.showControls ? "" : "&controls=0"}`}
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
          style={{ ...iframeStyle, ...frameStyle }}
        />
      ) : parsed.kind === "vimeo" ? (
        <iframe
          title={p.heading || "Video"}
          src={`https://player.vimeo.com/video/${parsed.id}?dnt=1${
            p.autoplay ? "&autoplay=1&muted=1" : ""
          }${p.showControls ? "" : "&controls=0"}`}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          loading="lazy"
          style={{ ...iframeStyle, ...frameStyle }}
        />
      ) : parsed.kind === "file" ? (
        <video
          src={parsed.url}
          controls={p.showControls}
          autoPlay={p.autoplay}
          muted={p.muted}
          playsInline
          preload="metadata"
          style={{ ...frameStyle, objectFit: "cover" }}
        />
      ) : (
        <div style={placeholderStyle}>
          {p.videoUrl
            ? "Couldn't recognise this URL. Use a YouTube, Vimeo, or .mp4 link."
            : "Paste a video URL to preview."}
        </div>
      )}
    </section>
  );
}
