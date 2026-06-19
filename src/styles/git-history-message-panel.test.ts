import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const gitHistoryCss = readFileSync(
  fileURLToPath(new URL("./git-history.part1.css", import.meta.url)),
  "utf8",
);

const gitHistoryOverviewCss = readFileSync(
  fileURLToPath(new URL("./git-history.part1.overview.css", import.meta.url)),
  "utf8",
);

const gitHistoryPanelViewSource = readFileSync(
  fileURLToPath(
    new URL(
      "../features/git-history/components/git-history-panel/components/GitHistoryPanelView.tsx",
      import.meta.url,
    ),
  ),
  "utf8",
);

describe("git history message panel typography", () => {
  it("keeps title and content rows at the same text size", () => {
    expect(gitHistoryCss).toMatch(
      /\.git-history-message-label\s*\{[^}]*font-size:\s*12px/s,
    );
    expect(gitHistoryCss).toMatch(
      /\.git-history-message-title\s*\{[^}]*font-size:\s*12px/s,
    );
    expect(gitHistoryCss).toMatch(
      /\.git-history-message-content\s*\{[^}]*font-size:\s*12px/s,
    );
  });

  it("keeps the title row bold and the content row normal weight", () => {
    expect(gitHistoryPanelViewSource).toContain("git-history-message-row--title");
    expect(gitHistoryPanelViewSource).toContain("git-history-message-row--content");
    expect(gitHistoryCss).toMatch(
      /\.git-history-message-label\s*\{[^}]*color:\s*var\(--text-secondary\)/s,
    );
    expect(gitHistoryCss).toMatch(
      /\.git-history-message-label\s*\{[^}]*font-weight:\s*600/s,
    );
    expect(gitHistoryCss).toMatch(
      /\.git-history-message-title\s*\{[^}]*font-weight:\s*350/s,
    );
    expect(gitHistoryCss).toMatch(
      /\.git-history-message-content\s*\{[^}]*font-weight:\s*inherit/s,
    );
    expect(gitHistoryCss).toMatch(
      /\.git-history-message-row--title\s*\{[^}]*font-weight:\s*700/s,
    );
    expect(gitHistoryCss).toMatch(
      /\.git-history-message-row--content\s*\{[^}]*font-weight:\s*350/s,
    );
  });

  it("separates the commit message panel from the file diff area", () => {
    expect(gitHistoryCss).toMatch(
      /\.git-history-details-resizer::after\s*\{[^}]*background:\s*var\(--border-strong,\s*rgba\(15,\s*23,\s*36,\s*0\.14\)\)/s,
    );
    expect(gitHistoryCss).toMatch(
      /\.git-history-details-resizer::after\s*\{[^}]*top:\s*0/s,
    );
    expect(gitHistoryCss).toMatch(
      /\.git-history-details-resizer::after\s*\{[^}]*opacity:\s*1/s,
    );
    expect(gitHistoryCss).not.toMatch(
      /\.git-history-details-resizer(?:\s*|::after)\s*\{[^}]*var\(--border-default\)/s,
    );
  });

  it("bridges the file-message split line across the details column divider", () => {
    expect(gitHistoryPanelViewSource).toContain("is-details-split-bridge");
    expect(gitHistoryPanelViewSource).toContain("--git-history-details-split-y");
    expect(gitHistoryOverviewCss).toMatch(
      /\.git-history-vertical-resizer\.is-details-split-bridge::before\s*\{[^}]*top:\s*var\(--git-history-details-split-y,\s*-999px\)/s,
    );
    expect(gitHistoryOverviewCss).toMatch(
      /\.git-history-vertical-resizer\.is-details-split-bridge::before\s*\{[^}]*background:\s*var\(--border-strong,\s*rgba\(15,\s*23,\s*36,\s*0\.14\)\)/s,
    );
  });
});
