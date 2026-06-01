import { describe, expect, it } from "vitest";
import {
  buildBrowserContextAttachment,
  formatBrowserContextPrompt,
  parseBrowserContextPrompt,
  stripBrowserContextPrompt,
} from "./attachment";
import type { BrowserContextSnapshot } from "../types";

function makeSnapshot(overrides: Partial<BrowserContextSnapshot> = {}): BrowserContextSnapshot {
  return {
    snapshotId: "snapshot-1",
    browserSessionId: "session-1",
    workspaceId: "workspace-1",
    capturedAt: 1000,
    freshness: "fresh",
    source: {
      url: "https://example.com/page",
      normalizedUrl: "https://example.com/page",
      title: "Example Page",
      origin: "https://example.com",
      tabLabel: "Example Page",
      captureReason: "manual_attach",
      workspaceLocalAllowed: false,
    },
    viewport: {
      width: null,
      height: null,
      scrollX: null,
      scrollY: null,
      scrollHeight: null,
      scrollWidth: null,
      devicePixelRatio: null,
    },
    page: {
      visibleText: "Visible page facts for the model.",
      pageType: "article",
      primaryContent: null,
      readableBlocks: [],
      noiseDiagnostics: [],
      visualEvidence: [],
      textTruncated: false,
      headings: [],
      landmarks: [],
      elementLandmarks: [],
      contentRegions: [],
      links: [],
      buttons: [],
      forms: [],
      selectedText: null,
      languageHint: null,
    },
    codeCandidates: [],
    diagnostics: {
      console: [],
      network: null,
      captureWarnings: [],
    },
    evidence: {
      screenshotRef: null,
      htmlExcerptRef: "browser-evidence-snapshot-1",
    },
    privacy: {
      redactionApplied: false,
      redactedKinds: [],
      omittedKinds: ["raw_dom", "cookies", "headers", "scripts", "styles", "hidden_nodes"],
    },
    budget: {
      charLimit: 12_000,
      visibleTextLimit: 8_000,
      elementLimit: 120,
      formFieldLimit: 80,
      diagnosticLimit: 50,
      tokenEstimate: null,
      truncated: false,
      omittedElementCount: 0,
    },
    availability: "available",
    ...overrides,
  };
}

describe("browser attachment utilities", () => {
  it("builds, formats, parses, and strips bounded browser context", () => {
    const attachment = buildBrowserContextAttachment(makeSnapshot(), {
      now: 1100,
      staleAfterMs: 5000,
    });

    const prompt = formatBrowserContextPrompt(attachment);
    const parsed = parseBrowserContextPrompt(`${prompt}\n\nUser request`);

    expect(parsed).toMatchObject({
      title: "Example Page",
      url: "https://example.com/page",
      stale: false,
      pageType: "article",
    });
    expect(stripBrowserContextPrompt(`${prompt}\n\nUser request`)).toBe("User request");
  });

  it("prioritizes primary content, readable blocks, and visual clues over body fallback", () => {
    const attachment = buildBrowserContextAttachment(
      makeSnapshot({
        page: {
          ...makeSnapshot().page,
          visibleText: "Navigation Sign in Pricing Footer",
          pageType: "issue",
          primaryContent: {
            text: "Crash report from the issue body with stack trace evidence.",
            source: "readable_block",
            score: 980,
            truncated: false,
          },
          readableBlocks: [
            {
              blockId: "readable-1",
              role: "issue_body",
              text: "Crash report from the issue body with stack trace evidence.",
              score: 980,
              truncated: false,
            },
          ],
          noiseDiagnostics: [
            {
              diagnosticId: "noise-navigation",
              kind: "navigation_noise",
              severity: "warning",
              message: "Navigation text was detected.",
              score: 42,
            },
          ],
          visualEvidence: [
            {
              evidenceId: "visual-1",
              kind: "image",
              label: "error screenshot",
              altText: "stack trace screenshot",
              srcOrigin: "https://example.com",
              nearbyText: "screenshot of the crash",
              visible: true,
              sensitive: false,
            },
          ],
        },
      }),
      { now: 1100 },
    );

    const prompt = formatBrowserContextPrompt(attachment);

    expect(attachment.summary).toContain("Crash report");
    expect(attachment.visibleTextExcerpt).not.toContain("Navigation Sign in");
    expect(prompt).toContain("pageType: issue");
    expect(prompt).toContain("visualEvidence:");
    expect(prompt).toContain("stack trace screenshot");
    const parsed = parseBrowserContextPrompt(`${prompt}\n\nUser request`);
    expect(parsed?.readableBlocks?.[0]?.role).toBe("issue_body");
    expect(parsed?.visualEvidence?.[0]?.label).toBe("error screenshot");
    expect(parsed?.visualEvidence?.[0]?.altText).toBe("stack trace screenshot");
    expect(parsed?.elementCounts?.visualEvidence).toBe(1);
  });
});
