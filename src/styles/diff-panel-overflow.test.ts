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
});
