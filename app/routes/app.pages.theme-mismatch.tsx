import { useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";

import db from "../db.server";
import { authenticate } from "../shopify.server";

/**
 * Bulk re-publish for theme-switch recovery.
 *
 * Lists every page with `themeMismatch: true` for the shop. The
 * "Re-publish all" button walks the list one at a time, calling the
 * existing single-page publish route with `acceptDrift: true` (the
 * new theme has no Demeurer files yet, so any pre-existing files
 * count as drift; we own the artifact, so accepting is correct).
 *
 * Sequential, client-side. Failures on individual pages don't abort
 * the batch — failed pages stay flagged for manual retry.
 */

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const pages = await db.page.findMany({
    where: { shop, themeMismatch: true },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      handle: true,
      type: true,
      publishedAt: true,
    },
  });

  return {
    pages: pages.map((p) => ({
      id: p.id,
      title: p.title,
      handle: p.handle,
      type: p.type,
      publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
    })),
  };
};

interface ProgressEntry {
  pageId: string;
  title: string;
  status: "pending" | "running" | "success" | "failed";
  error?: string;
}

export default function ThemeMismatchPage() {
  const { pages } = useLoaderData<typeof loader>();
  const [progress, setProgress] = useState<ProgressEntry[]>(
    pages.map((p) => ({ pageId: p.id, title: p.title, status: "pending" })),
  );
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  async function republishAll() {
    setRunning(true);
    setDone(false);
    const next: ProgressEntry[] = pages.map((p) => ({
      pageId: p.id,
      title: p.title,
      status: "pending",
    }));
    setProgress([...next]);

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      next[i] = { ...next[i], status: "running" };
      setProgress([...next]);
      try {
        const r = await fetch(`/app/api/pages/${page.id}/publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ acceptDrift: true }),
        });
        const body = (await r.json().catch(() => ({}))) as {
          ok?: boolean;
          reason?: string;
          error?: string;
        };
        if (r.ok && body.ok) {
          next[i] = { ...next[i], status: "success" };
        } else {
          next[i] = {
            ...next[i],
            status: "failed",
            error: body.error ?? body.reason ?? `HTTP ${r.status}`,
          };
        }
      } catch (err) {
        next[i] = {
          ...next[i],
          status: "failed",
          error: err instanceof Error ? err.message : "Network error",
        };
      }
      setProgress([...next]);
    }

    setRunning(false);
    setDone(true);
  }

  const succeeded = progress.filter((p) => p.status === "success").length;
  const failed = progress.filter((p) => p.status === "failed").length;
  const running_now = progress.find((p) => p.status === "running");

  return (
    <s-page heading="Pages on a previous theme">
      <s-button slot="primary-action" href="/app">
        Back to pages
      </s-button>

      {pages.length === 0 ? (
        <s-section heading="Nothing to do">
          <s-paragraph>
            Every published page is on your current live theme. 🎯
          </s-paragraph>
        </s-section>
      ) : (
        <s-section
          heading={`${pages.length} page${pages.length === 1 ? "" : "s"} need${pages.length === 1 ? "s" : ""} re-publishing`}
        >
          <s-stack direction="block" gap="base">
            <s-paragraph>
              Re-publishing applies each page to your current live theme.
              The previous theme's files are left alone (Demeurer never
              deletes).
            </s-paragraph>

            <s-stack direction="inline" gap="base">
              <s-button
                variant="primary"
                onClick={() => void republishAll()}
                {...(running ? { disabled: true } : {})}
              >
                {running
                  ? `Re-publishing… (${succeeded + failed} / ${pages.length})`
                  : done
                    ? "Run again"
                    : "Re-publish all"}
              </s-button>
            </s-stack>

            {running_now ? (
              <s-text>
                Re-publishing: <strong>{running_now.title}</strong>…
              </s-text>
            ) : null}

            {done ? (
              <s-banner
                tone={failed === 0 ? "success" : "warning"}
              >
                {failed === 0
                  ? `All ${succeeded} re-published successfully.`
                  : `${succeeded} succeeded, ${failed} failed. Failed pages stay flagged for manual retry.`}
              </s-banner>
            ) : null}

            <s-stack direction="block" gap="small">
              {progress.map((entry) => (
                <div
                  key={entry.pageId}
                  className={`demeurer-bulk-row demeurer-bulk-row--${entry.status}`}
                >
                  <s-stack direction="inline" gap="base">
                    <s-text>{statusIcon(entry.status)}</s-text>
                    <s-link href={`/app/pages/${entry.pageId}`}>
                      {entry.title}
                    </s-link>
                    {entry.error ? (
                      <s-text>
                        <code>{entry.error}</code>
                      </s-text>
                    ) : null}
                  </s-stack>
                </div>
              ))}
            </s-stack>
          </s-stack>
        </s-section>
      )}
    </s-page>
  );
}

function statusIcon(status: ProgressEntry["status"]): string {
  switch (status) {
    case "pending":
      return "○";
    case "running":
      return "⏵";
    case "success":
      return "✓";
    case "failed":
      return "✗";
  }
}
