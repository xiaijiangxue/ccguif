import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const diffCss = readFileSync(
  fileURLToPath(new URL("./diff.css", import.meta.url)),
  "utf8",
);
const gitHistoryOverviewCss = readFileSync(
  fileURLToPath(new URL("./git-history.part1.overview.css", import.meta.url)),
  "utf8",
);
const gitHistoryCss = readFileSync(
  fileURLToPath(new URL("./git-history.part1.css", import.meta.url)),
  "utf8",
);

function getCssRuleBlock(css: string, selector: string): string {
  const escapedSelector = selector
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
  return match?.[1] ?? "";
}

describe("diff panel overflow guards", () => {
  it("keeps row hover actions collapsed by default and expands them beside stats on hover", () => {
    const actionRule = getCssRuleBlock(diffCss, ".diff-row-actions");
    const hoverRule = getCssRuleBlock(
      diffCss,
      ".diff-row:hover .diff-row-actions,\n.diff-row:focus-within .diff-row-actions",
    );

    expect(actionRule).toContain("flex: 0 1 auto;");
    expect(actionRule).toContain("justify-content: flex-end;");
    expect(actionRule).toContain("max-width: 0;");
    expect(actionRule).toContain("overflow: hidden;");
    expect(actionRule).not.toContain("position: absolute;");
    expect(actionRule).not.toContain("margin-left:");
    expect(hoverRule).toContain("max-width: 92px;");
    expect(hoverRule).toContain("overflow: visible;");
    expect(hoverRule).not.toContain("width: 72px;");
    expect(hoverRule).not.toContain("flex-basis: 72px;");
    expect(hoverRule).not.toContain("max-width: 148px;");
    expect(hoverRule).not.toContain("margin-left:");
  });

  it("keeps git history worktree hover actions collapsed by default and expanded on hover", () => {
    const actionRule = getCssRuleBlock(
      gitHistoryOverviewCss,
      ".git-history-worktree-file-actions",
    );
    const hoverRule = getCssRuleBlock(
      gitHistoryOverviewCss,
      ".git-history-worktree-file-row:hover .git-history-worktree-file-actions,\n.git-history-worktree-file-row:focus-within .git-history-worktree-file-actions",
    );

    expect(actionRule).toContain("flex: 0 1 auto;");
    expect(actionRule).toContain("justify-content: flex-end;");
    expect(actionRule).toContain("max-width: 0;");
    expect(actionRule).toContain("overflow: hidden;");
    expect(actionRule).not.toContain("position: absolute;");
    expect(actionRule).not.toContain("margin-left:");
    expect(hoverRule).toContain("max-width: 92px;");
    expect(hoverRule).toContain("overflow: visible;");
    expect(hoverRule).not.toContain("width: 72px;");
    expect(hoverRule).not.toContain("flex-basis: 72px;");
    expect(hoverRule).not.toContain("max-width: 148px;");
    expect(hoverRule).not.toContain("margin-left:");
  });

  it("keeps the file list from becoming a horizontal scroll container", () => {
    const listRule = getCssRuleBlock(diffCss, ".diff-list");

    expect(listRule).toContain("overflow-y: auto;");
    expect(listRule).toContain("overflow-x: hidden;");
  });

  it("keeps git history commit details file list scrollable inside the details pane", () => {
    const detailsBodyRule = getCssRuleBlock(gitHistoryCss, ".git-history-details-body");
    const fileListRule = getCssRuleBlock(gitHistoryCss, ".git-history-file-list");

    expect(detailsBodyRule).toContain("flex: 1 1 0;");
    expect(detailsBodyRule).toContain("min-height: 0;");
    expect(detailsBodyRule).toContain("height: 0;");
    expect(detailsBodyRule).toContain("overflow: hidden;");
    expect(fileListRule).toContain("overflow-y: auto;");
    expect(fileListRule).toContain("overflow-x: hidden;");
    expect(fileListRule).toContain("scrollbar-gutter: stable;");
  });

  it("keeps git history details header labels single-line in narrow panes", () => {
    const titleRule = getCssRuleBlock(gitHistoryCss, ".git-history-column-title");
    const titleTextRule = getCssRuleBlock(gitHistoryCss, ".git-history-column-title-text");
    const toggleRule = getCssRuleBlock(gitHistoryCss, ".git-history-details-view-toggle");
    const summaryRule = getCssRuleBlock(gitHistoryCss, ".git-history-file-tree-head-summary");

    expect(titleRule).toContain("min-width: 0;");
    expect(titleRule).toContain("flex: 1 1 auto;");
    expect(titleRule).toContain("white-space: nowrap;");
    expect(titleTextRule).toContain("overflow: hidden;");
    expect(titleTextRule).toContain("text-overflow: ellipsis;");
    expect(titleTextRule).toContain("white-space: nowrap;");
    expect(toggleRule).toContain("min-width: 0;");
    expect(toggleRule).toContain("flex: 0 1 auto;");
    expect(summaryRule).toContain("min-width: 0;");
    expect(summaryRule).toContain("flex: 0 1 auto;");
    expect(summaryRule).toContain("overflow: hidden;");
    expect(summaryRule).toContain("text-overflow: ellipsis;");
    expect(summaryRule).toContain("white-space: nowrap;");
  });
});
