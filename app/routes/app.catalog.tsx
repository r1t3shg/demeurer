/**
 * Section catalog (internal / dev-only).
 *
 * Lists every section registered in `app/lib/sections` — icon, label,
 * description, category, default-props thumbnail, and an "Add to a new
 * page" action that creates a fresh page seeded with that section.
 *
 * This page doubles as:
 *   - a developer reference for the section library,
 *   - the seed of our App Store screenshot flow (each card is a clean
 *     thumbnail of the section in isolation).
 *
 * NOT for production. The loader hard-404s on production builds. When we
 * eventually expose this to merchants, we'll gate behind a "developer
 * mode" flag instead of NODE_ENV. For now NODE_ENV is the simpler gate.
 */
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import {
  redirect,
  useFetcher,
  useLoaderData,
  useRouteError,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { Prisma } from "@prisma/client";

import db from "../db.server";
import { newBlockId } from "../lib/editor/ids";
import {
  type SectionCategory,
  type SectionDefinition,
  type ThemeTokens,
  getSection,
  listSectionsByCategory,
} from "../lib/sections";
import { getShopFromRequest } from "../lib/shop.server";
import { generateUniqueHandle } from "../lib/slug.server";

// Vite replaces `process.env.NODE_ENV` at build time, so the entire
// catalog page falls out of the production bundle.
const CATALOG_ENABLED = process.env.NODE_ENV !== "production";

const CATEGORY_ORDER: SectionCategory[] = [
  "content",
  "media",
  "form",
  "layout",
  "advanced",
];

const CATEGORY_LABELS: Record<SectionCategory, string> = {
  content: "Content",
  media: "Media",
  form: "Form",
  layout: "Layout",
  advanced: "Advanced",
};

// Reasonable defaults for the catalog thumbnail. The real merchant
// theme tokens flow into the editor canvas via `ThemeTokensContext`;
// the catalog has no live theme so it uses these neutrals.
const CATALOG_TOKENS: ThemeTokens = {
  colors: {
    background: "#ffffff",
    text: "#1a1a1a",
    accent: "#1a73e8",
  },
  typography: {
    headingFont: "Georgia, serif",
    bodyFont: "system-ui, -apple-system, sans-serif",
    scale: 1,
  },
  spacing: { unit: 8 },
};

interface CatalogEntry {
  type: string;
  label: string;
  description: string;
  icon: string;
  category: SectionCategory;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  if (!CATALOG_ENABLED) {
    throw new Response("Not found", { status: 404 });
  }
  await getShopFromRequest(request);

  // Flatten the registry into category-ordered groups for the UI. We
  // don't ship Render/toLiquid functions across the loader boundary
  // (they're not serializable) — the page imports the registry on the
  // client side and looks each definition back up by type to render
  // its preview.
  const grouped = listSectionsByCategory();
  const entries: { category: SectionCategory; sections: CatalogEntry[] }[] =
    CATEGORY_ORDER.filter((cat) => grouped[cat].length > 0).map((cat) => ({
      category: cat,
      sections: grouped[cat].map((def) => ({
        type: def.type,
        label: def.label,
        description: def.description,
        icon: def.icon,
        category: def.category,
      })),
    }));

  return { entries };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  if (!CATALOG_ENABLED) {
    throw new Response("Not found", { status: 404 });
  }
  const shop = await getShopFromRequest(request);
  const formData = await request.formData();
  const sectionType = String(formData.get("sectionType") ?? "");

  const def = getSection(sectionType);
  if (!def) {
    return { error: `Unknown section type: ${sectionType}` };
  }

  const title = `Catalog: ${def.label}`;
  const handle = await generateUniqueHandle(shop, title);

  const seedBlock = {
    id: newBlockId(),
    type: def.type,
    props: { ...def.defaults },
    children: [],
  };

  const page = await db.page.create({
    data: {
      shop,
      title,
      type: "landing",
      handle,
      source: { version: 1, blocks: [seedBlock] } as unknown as Prisma.InputJsonValue,
    },
    select: { id: true },
  });

  return redirect(`/app/pages/${page.id}`);
};

/**
 * Render a section into a fixed 1200×640 frame, scaled down to a
 * thumbnail. The transform scale technique keeps inner pixel sizes
 * intact (so 32px font stays 32px → 8px in the thumbnail) which
 * gives a recognizable preview without the section thinking it's
 * being rendered into a tiny mobile viewport.
 */
function SectionThumb({ def }: { def: SectionDefinition }) {
  const Render = def.Render;
  const FRAME_WIDTH = 1200;
  const FRAME_HEIGHT = 640;
  const SCALE = 0.25;
  return (
    <div
      style={{
        width: FRAME_WIDTH * SCALE,
        height: FRAME_HEIGHT * SCALE,
        overflow: "hidden",
        borderRadius: 8,
        border: "1px solid rgba(0,0,0,0.1)",
        background: "#fafafa",
        position: "relative",
        flexShrink: 0,
      }}
      // Decorative — the label/description below carries the meaning.
      aria-hidden="true"
    >
      <div
        style={{
          width: FRAME_WIDTH,
          height: FRAME_HEIGHT,
          transform: `scale(${SCALE})`,
          transformOrigin: "top left",
          pointerEvents: "none",
        }}
      >
        <Render props={{ ...def.defaults }} themeTokens={CATALOG_TOKENS} />
      </div>
    </div>
  );
}

function CatalogCard({ type }: { type: string }) {
  const def = getSection(type);
  const fetcher = useFetcher<typeof action>();
  if (!def) return null;

  return (
    <s-section heading={def.label}>
      <s-stack direction="block" gap="base">
        <s-stack direction="inline" gap="base">
          <SectionThumb def={def} />
          <s-stack direction="block" gap="base">
            <s-stack direction="inline" gap="base">
              <s-badge>{def.category}</s-badge>
              <s-text tone="neutral">{def.icon}</s-text>
            </s-stack>
            <s-paragraph>{def.description}</s-paragraph>
            <s-text tone="neutral">
              <code>type: {def.type}</code>
            </s-text>
          </s-stack>
        </s-stack>
        <fetcher.Form method="post">
          <input type="hidden" name="sectionType" value={def.type} />
          <s-button
            type="submit"
            variant="primary"
            {...(fetcher.state === "submitting" ? { loading: true } : {})}
          >
            Add to a new page
          </s-button>
        </fetcher.Form>
      </s-stack>
    </s-section>
  );
}

export default function Catalog() {
  const { entries } = useLoaderData<typeof loader>();
  const total = entries.reduce((acc, e) => acc + e.sections.length, 0);

  return (
    <s-page heading="Section catalog">
      <s-banner tone="info">
        <s-paragraph>
          Internal reference. {total} sections registered. Each card creates
          a fresh page seeded with that section so you can screenshot or
          experiment without touching real merchant pages.
        </s-paragraph>
      </s-banner>

      {entries.map((group) => (
        <s-section key={group.category} heading={CATEGORY_LABELS[group.category]}>
          <s-stack direction="block" gap="base">
            {group.sections.map((s) => (
              <CatalogCard key={s.type} type={s.type} />
            ))}
          </s-stack>
        </s-section>
      ))}
    </s-page>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
