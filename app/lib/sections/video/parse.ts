/**
 * Video URL parsing — shared by Render and toLiquid.
 *
 * Recognises YouTube watch / short / embed URLs, Vimeo URLs, and
 * direct mp4/webm/ogg files. Anything unrecognised is returned as
 * `{ kind: "unknown" }` so the caller can render a placeholder
 * instead of guessing.
 */

export type ParsedVideo =
  | { kind: "youtube"; id: string }
  | { kind: "vimeo"; id: string }
  | { kind: "file"; url: string }
  | { kind: "unknown" };

const FILE_EXT = /\.(mp4|webm|ogg|m4v)(?:$|\?)/i;

export function parseVideoUrl(raw: string): ParsedVideo {
  if (!raw) return { kind: "unknown" };
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { kind: "unknown" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { kind: "unknown" };
  }
  const host = url.hostname.toLowerCase();

  // YouTube.
  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    return id ? { kind: "youtube", id } : { kind: "unknown" };
  }
  if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
    const v = url.searchParams.get("v");
    if (v) return { kind: "youtube", id: v };
    const m = url.pathname.match(/^\/(?:embed|shorts)\/([\w-]{6,})/);
    if (m) return { kind: "youtube", id: m[1] };
    return { kind: "unknown" };
  }

  // Vimeo.
  if (host === "vimeo.com" || host.endsWith(".vimeo.com")) {
    const m = url.pathname.match(/(\d{6,})/);
    return m ? { kind: "vimeo", id: m[1] } : { kind: "unknown" };
  }

  // Direct file.
  if (FILE_EXT.test(url.pathname)) {
    return { kind: "file", url: raw };
  }

  return { kind: "unknown" };
}

/** Aspect ratio CSS value for `aspect-ratio` property. */
export function aspectRatioCss(ratio: string): string {
  switch (ratio) {
    case "4:3":
      return "4 / 3";
    case "1:1":
      return "1 / 1";
    case "9:16":
      return "9 / 16";
    case "16:9":
    default:
      return "16 / 9";
  }
}
