import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readCssWithImports(filePath: string): string {
  const css = readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
  const importPattern = /^@import\s+"(.+?)";$/gm;

  return css.replace(importPattern, (_, relativeImportPath: string) =>
    readCssWithImports(resolve(dirname(filePath), relativeImportPath)),
  );
}

const sidebarCss = readCssWithImports(
  fileURLToPath(new URL("./sidebar.css", import.meta.url)),
);

function getCssRuleBlock(css: string, selector: string): string {
  const escapedSelector = selector
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
  return match?.[1] ?? "";
}

describe("sidebar titlebar drag region", () => {
  it("keeps the shell draggable while isolating the sidebar toggle", () => {
    const contentRule = getCssRuleBlock(sidebarCss, ".sidebar-topbar-content");
    const toggleRule = getCssRuleBlock(sidebarCss, ".sidebar-titlebar-toggle");
    const swappedRule = getCssRuleBlock(sidebarCss, ".sidebar-titlebar-toggle.is-layout-swapped");

    expect(contentRule).toContain("justify-content: flex-end;");
    expect(contentRule).toContain("-webkit-app-region: drag;");
    expect(toggleRule).toContain("width: auto;");
    expect(toggleRule).toContain("margin-left: auto;");
    expect(toggleRule).toContain("-webkit-app-region: no-drag;");
    expect(swappedRule).toContain("margin-right: auto;");
  });

  it("keeps expanded workspace children from clipping long session lists", () => {
    const expandedRule = getCssRuleBlock(sidebarCss, ".workspace-children");
    const collapsedRule = getCssRuleBlock(sidebarCss, ".workspace-children.is-collapsed");

    expect(expandedRule).toContain("overflow: visible;");
    expect(expandedRule).toContain("max-height: none;");
    expect(collapsedRule).toContain("overflow: hidden;");
    expect(collapsedRule).toContain("max-height: 0;");
  });
});
