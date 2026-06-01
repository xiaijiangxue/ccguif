import { describe, expect, it } from "vitest";
import {
  buildBrowserContextSnapshot,
  sanitizeBrowserSnapshotText,
} from "./snapshotSanitizer";
import type { BrowserSession } from "../types";

function makeSession(): BrowserSession {
  return {
    browserSessionId: "session-1",
    workspaceId: "workspace-1",
    label: "Fixture",
    url: "https://github.com/example/repo/issues/1",
    normalizedUrl: "https://github.com/example/repo/issues/1",
    origin: "https://github.com",
    title: "Crash on launch",
    status: "ready",
    featurePhase: "read_only_snapshot",
    platformCapability: {
      platform: "macos",
      webviewRuntime: "wkwebview",
      browserDock: "supported",
      snapshotCapture: "supported",
      screenshotCapture: "degraded",
      navigationActions: "degraded",
      elementActions: "unsupported",
      formSubmitActions: "unsupported",
      diagnosticsCapture: "degraded",
      unsupportedReasons: [],
      degradedReasons: [],
    },
    createdAt: 1,
    updatedAt: 1,
    lastActivatedAt: 1,
  };
}

describe("browser snapshot sanitizer", () => {
  it("redacts secrets and contact-like values before AI context injection", () => {
    const result = sanitizeBrowserSnapshotText(
      "password=abc123 token: secret-value user@example.com +1 415 555 1234",
    );

    expect(result.text).not.toContain("abc123");
    expect(result.text).not.toContain("secret-value");
    expect(result.text).toContain("[redacted-email]");
    expect(result.privacy.redactionApplied).toBe(true);
    expect(result.privacy.redactedKinds).toEqual(
      expect.arrayContaining(["password", "token", "email", "phone"]),
    );
  });

  it("sanitizes structured page understanding fields used by fixture regressions", () => {
    const snapshot = buildBrowserContextSnapshot({
      session: makeSession(),
      visibleText: "Navigation Sign in Pricing Footer",
      pageType: "issue",
      primaryContent: {
        text: "Issue body includes token=abc123 and the real crash description.",
        source: "readable_block",
        score: 930,
        truncated: false,
      },
      readableBlocks: [
        {
          blockId: "github-issue-body",
          role: "issue_body",
          text: "Crash happens after clicking Launch.",
          score: 930,
          truncated: false,
        },
      ],
      noiseDiagnostics: [
        {
          diagnosticId: "noise-navigation",
          kind: "navigation_noise",
          severity: "warning",
          message: "Navigation region contains cookie=session.",
          score: 64,
        },
      ],
      visualEvidence: [
        {
          evidenceId: "issue-screenshot",
          kind: "image",
          label: "Screenshot token=secret",
          altText: "Crash stack trace",
          srcOrigin: "https://github.com",
          nearbyText: "Attached screenshot shows the error.",
          visible: true,
          sensitive: false,
        },
      ],
    });

    expect(snapshot.page.pageType).toBe("issue");
    expect(snapshot.page.primaryContent?.text).toContain("[redacted]");
    expect(snapshot.page.primaryContent?.text).not.toContain("abc123");
    expect(snapshot.page.readableBlocks?.[0]?.role).toBe("issue_body");
    expect(snapshot.page.noiseDiagnostics?.[0]?.message).not.toContain("session");
    expect(snapshot.page.visualEvidence?.[0]?.altText).toBe("Crash stack trace");
    expect(snapshot.privacy.redactionApplied).toBe(true);
  });

  it.each([
    {
      name: "GitHub issue",
      pageType: "issue" as const,
      role: "issue_body" as const,
      primary: "The issue body says the branch menu disappears after reload.",
    },
    {
      name: "news article",
      pageType: "article" as const,
      role: "article" as const,
      primary: "The article lead explains the policy change and cites the official response.",
    },
    {
      name: "documentation page",
      pageType: "docs" as const,
      role: "docs_section" as const,
      primary: "The docs section describes the capture API parameters and response contract.",
    },
    {
      name: "form page",
      pageType: "form" as const,
      role: "form" as const,
      primary: "The form asks for project name and deployment target before submit.",
    },
    {
      name: "SPA shell",
      pageType: "spa" as const,
      role: "other" as const,
      primary: "Loading workspace shell",
    },
  ])("keeps primary content ahead of navigation noise for $name fixtures", (fixture) => {
    const snapshot = buildBrowserContextSnapshot({
      session: {
        ...makeSession(),
        normalizedUrl: `https://example.com/${fixture.pageType}`,
        url: `https://example.com/${fixture.pageType}`,
      },
      visibleText: `Skip to content Sign in Pricing ${fixture.primary} Footer`,
      pageType: fixture.pageType,
      primaryContent: {
        text: fixture.primary,
        source: "readable_block",
        score: 800,
        truncated: false,
      },
      readableBlocks: [
        {
          blockId: `${fixture.pageType}-primary`,
          role: fixture.role,
          text: fixture.primary,
          score: 800,
          truncated: false,
        },
      ],
      noiseDiagnostics: [
        {
          diagnosticId: `${fixture.pageType}-noise`,
          kind: "navigation_noise",
          severity: "warning",
          message: "Navigation prefix omitted from primary content.",
          score: 40,
        },
      ],
    });

    expect(snapshot.page.pageType).toBe(fixture.pageType);
    expect(snapshot.page.primaryContent?.text).toBe(fixture.primary);
    expect(snapshot.page.primaryContent?.text).not.toMatch(/^Skip to content/);
    expect(snapshot.page.readableBlocks?.[0]?.role).toBe(fixture.role);
  });
});
