/**
 * Tiny HTML allowlist sanitizer for the canvas richtext preview.
 *
 * The allowlist is intentionally small: <p>, <strong>, <em>, <a href>, <br>.
 * Anything else (script, iframe, style, on* attributes, data-*, etc.) is
 * stripped. The user's authoring tool today is a textarea — this is the
 * floor that lets the canvas render their input safely without pulling
 * in DOMPurify.
 *
 * Two paths:
 *  - Browser (DOMParser available): walk the parsed tree and drop any
 *    element/attribute that isn't on the allowlist.
 *  - Node SSR (no DOMParser): regex-strip dangerous constructs
 *    (<script>, <style>, <iframe>, on* attributes, javascript:/data:/
 *    vbscript: hrefs). Looser than the browser path, but the input
 *    comes from the merchant's own admin textarea, not arbitrary
 *    attacker payloads — defense in depth, not perimeter security.
 *
 * Compile-time sanitization for the published Liquid output happens in
 * P1.D and may use a different (server-side, parser-based) implementation.
 */

const ALLOWED_TAGS = new Set(["P", "STRONG", "EM", "A", "BR"]);
const ALLOWED_ATTRS_PER_TAG: Record<string, Set<string>> = {
  A: new Set(["href"]),
};

export function sanitizeRichText(input: string): string {
  if (!input) return "";
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return sanitizeNode(input);
  }
  return sanitizeBrowser(input);
}

function sanitizeBrowser(input: string): string {
  const parser = new DOMParser();
  // Wrap in a known element so DOMParser doesn't treat fragments oddly.
  const doc = parser.parseFromString(`<div>${input}</div>`, "text/html");
  const root = doc.body.firstElementChild;
  if (!root) return "";

  walk(root);
  return root.innerHTML;
}

function walk(node: Element): void {
  // Iterate over a snapshot — we're going to mutate children.
  const children = Array.from(node.children);
  for (const child of children) {
    const tag = child.tagName;
    if (!ALLOWED_TAGS.has(tag)) {
      // Drop the element. Promote its text content so users don't lose
      // what they typed if they used a disallowed wrapper like <div>.
      const text = child.textContent ?? "";
      child.replaceWith(document.createTextNode(text));
      continue;
    }

    // Strip all attributes that aren't on the per-tag allowlist.
    const allowed = ALLOWED_ATTRS_PER_TAG[tag] ?? new Set<string>();
    for (const attr of Array.from(child.attributes)) {
      if (!allowed.has(attr.name)) {
        child.removeAttribute(attr.name);
        continue;
      }
      // Block javascript:/data: URLs in href to defeat XSS via <a>.
      if (attr.name === "href" && !isSafeHref(attr.value)) {
        child.removeAttribute(attr.name);
      }
    }

    walk(child);
  }
}

function isSafeHref(value: string): boolean {
  const trimmed = value.trim().toLowerCase();
  if (trimmed.startsWith("javascript:")) return false;
  if (trimmed.startsWith("data:")) return false;
  if (trimmed.startsWith("vbscript:")) return false;
  return true;
}

/* ----------------------------- Node fallback ---------------------------- */

const SCRIPT_LIKE = /<\s*(script|style|iframe|object|embed|form)\b[\s\S]*?<\s*\/\s*\1\s*>/gi;
const SELF_CLOSING_DANGEROUS = /<\s*(script|style|iframe|object|embed|form|meta|link)\b[^>]*\/?>/gi;
const ON_ATTR = /\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const HREF_ATTR = /\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi;

function sanitizeNode(input: string): string {
  let s = input;
  s = s.replace(SCRIPT_LIKE, "");
  s = s.replace(SELF_CLOSING_DANGEROUS, "");
  s = s.replace(ON_ATTR, "");
  s = s.replace(HREF_ATTR, (whole, _q, dq, sq, bare) => {
    const value = (dq ?? sq ?? bare ?? "").trim();
    return isSafeHref(value) ? whole : "";
  });
  return s;
}
