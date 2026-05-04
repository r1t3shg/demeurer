/**
 * Publish-flow client state machine tests.
 *
 * Exercises the state transitions in `app/lib/editor/publish-flow.ts`
 * with a stub `fetchImpl` and a stub `saveNow`. Doesn't touch the DB
 * or the real network.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  createPublishFlow,
  type FlowApplyResult,
  type FlowConflictAssessment,
  type FlowDriftReport,
  type PublishStage,
} from "../publish-flow.ts";

const PAGE_ID = "page_test";

function emptyDriftReport(): FlowDriftReport {
  return {
    themeId: "gid://shopify/OnlineStoreTheme/1",
    themeName: "Dawn (test)",
    newFiles: [{ path: "sections/demeurer-hero.liquid", purpose: "section" }],
    unchangedFiles: [],
    modifiedFiles: [],
    orphanFiles: [],
    hasDrift: false,
    totalBytes: 100,
    estimatedWriteCount: 1,
  };
}

function severity(s: "none" | "minor" | "major"): FlowConflictAssessment {
  return {
    severity: s,
    summary: `severity: ${s}`,
    actionable: [],
  };
}

function successResult(): FlowApplyResult {
  return {
    status: "success",
    themeId: "gid://shopify/OnlineStoreTheme/1",
    themeName: "Dawn (test)",
    written: [{ path: "sections/demeurer-hero.liquid", writtenHash: "abc" }],
    failed: [],
    skipped: [],
  };
}

/**
 * Build a fetch stub that responds to /drift and /publish based on a
 * scripted response queue.
 */
function makeFetchStub(responses: Record<string, () => Response>) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : (input as Request).url;
    calls.push({ url, init: init ?? undefined });
    for (const [pattern, build] of Object.entries(responses)) {
      if (url.includes(pattern)) return build();
    }
    return new Response("not stubbed", { status: 500 });
  };
  return { fetcher, calls };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("publish-flow", () => {
  it("scenario 1: idle → saving → checking_drift → confirm (severity: none)", async () => {
    const { fetcher } = makeFetchStub({
      "/drift": () =>
        jsonResponse({ drift: emptyDriftReport(), severity: severity("none") }),
    });
    const flow = createPublishFlow({
      pageId: PAGE_ID,
      saveNow: async () => {},
      fetchImpl: fetcher,
    });
    assert.strictEqual(flow.state.stage, "idle");
    await flow.start();
    assert.strictEqual(flow.state.stage, "confirm");
    const s1 = flow.state as PublishStage;
    if (s1.stage === "confirm") {
      assert.strictEqual(s1.severity.severity, "none");
    }
  });

  it("scenario 2: confirm + acceptDrift=false → publishing → success", async () => {
    const { fetcher } = makeFetchStub({
      "/drift": () =>
        jsonResponse({ drift: emptyDriftReport(), severity: severity("none") }),
      "/publish": () =>
        jsonResponse({ ok: true, result: successResult(), firstPublish: true }),
    });
    const flow = createPublishFlow({
      pageId: PAGE_ID,
      saveNow: async () => {},
      fetchImpl: fetcher,
    });
    await flow.start();
    assert.strictEqual(flow.state.stage, "confirm");
    await flow.confirm(false);
    assert.strictEqual(flow.state.stage, "success");
    const s2 = flow.state as PublishStage;
    if (s2.stage === "success") {
      assert.strictEqual(s2.firstPublish, true);
    }
  });

  it("scenario 3: saveNow rejects → error stage", async () => {
    const { fetcher } = makeFetchStub({});
    const flow = createPublishFlow({
      pageId: PAGE_ID,
      saveNow: async () => {
        throw new Error("Save failed");
      },
      fetchImpl: fetcher,
    });
    await flow.start();
    assert.strictEqual(flow.state.stage, "error");
    const s3 = flow.state;
    if (s3.stage === "error") {
      assert.match(s3.message, /Couldn't save before publishing/);
    }
  });

  it("scenario 4: drift HTTP error → error stage", async () => {
    const { fetcher } = makeFetchStub({
      "/drift": () => new Response("server error", { status: 500 }),
    });
    const flow = createPublishFlow({
      pageId: PAGE_ID,
      saveNow: async () => {},
      fetchImpl: fetcher,
    });
    await flow.start();
    assert.strictEqual(flow.state.stage, "error");
  });

  it("scenario 5: confirm returns 207 partial → partial stage", async () => {
    const partialResult: FlowApplyResult = {
      ...successResult(),
      status: "partial_failure",
      failed: [
        { path: "sections/demeurer-hero.liquid", error: "Boom", errorCode: "bad_content" },
      ],
    };
    const { fetcher } = makeFetchStub({
      "/drift": () =>
        jsonResponse({ drift: emptyDriftReport(), severity: severity("none") }),
      "/publish": () =>
        jsonResponse(
          { ok: false, reason: "partial", result: partialResult, firstPublish: false },
          207,
        ),
    });
    const flow = createPublishFlow({
      pageId: PAGE_ID,
      saveNow: async () => {},
      fetchImpl: fetcher,
    });
    await flow.start();
    await flow.confirm(false);
    assert.strictEqual(flow.state.stage, "partial");
  });

  it("scenario 6: 401 auth → auth_error stage", async () => {
    const { fetcher } = makeFetchStub({
      "/drift": () =>
        jsonResponse({ drift: emptyDriftReport(), severity: severity("none") }),
      "/publish": () =>
        jsonResponse({ ok: false, reason: "auth" }, 401),
    });
    const flow = createPublishFlow({
      pageId: PAGE_ID,
      saveNow: async () => {},
      fetchImpl: fetcher,
    });
    await flow.start();
    await flow.confirm(false);
    assert.strictEqual(flow.state.stage, "auth_error");
  });

  it("scenario 7: 409 drift mid-confirm → bounces back to confirm with new report", async () => {
    let publishCalls = 0;
    const driftedReport: FlowDriftReport = {
      ...emptyDriftReport(),
      modifiedFiles: [
        {
          path: "sections/demeurer-hero.liquid",
          classification: "drifted",
          artifact: { content: "" },
        },
      ],
      hasDrift: true,
    };
    const { fetcher } = makeFetchStub({
      "/drift": () =>
        jsonResponse({ drift: emptyDriftReport(), severity: severity("none") }),
      "/publish": () => {
        publishCalls++;
        if (publishCalls === 1) {
          return jsonResponse(
            {
              ok: false,
              reason: "drift",
              report: driftedReport,
              severity: severity("major"),
            },
            409,
          );
        }
        return jsonResponse({ ok: true, result: successResult(), firstPublish: false });
      },
    });
    const flow = createPublishFlow({
      pageId: PAGE_ID,
      saveNow: async () => {},
      fetchImpl: fetcher,
    });
    await flow.start();
    await flow.confirm(false);
    assert.strictEqual(flow.state.stage, "confirm");
    const s7 = flow.state;
    if (s7.stage === "confirm") {
      assert.strictEqual(s7.severity.severity, "major");
    }
    await flow.confirm(true);
    assert.strictEqual(flow.state.stage, "success");
  });

  it("scenario 8: cancel returns to idle", async () => {
    const { fetcher } = makeFetchStub({
      "/drift": () =>
        jsonResponse({ drift: emptyDriftReport(), severity: severity("none") }),
    });
    const flow = createPublishFlow({
      pageId: PAGE_ID,
      saveNow: async () => {},
      fetchImpl: fetcher,
    });
    await flow.start();
    assert.strictEqual(flow.state.stage, "confirm");
    flow.cancel();
    assert.strictEqual(flow.state.stage, "idle");
  });
});
