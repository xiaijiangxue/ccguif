// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ConversationItem } from "../../../../types";
import { ReadToolBlock } from "./ReadToolBlock";

function createReadItem(
  id: string,
  detail: Record<string, unknown>,
  output?: string,
): Extract<ConversationItem, { kind: "tool" }> {
  return {
    id,
    kind: "tool",
    toolType: "read",
    title: "Tool: read",
    detail: JSON.stringify(detail),
    output,
    status: "completed",
  };
}

describe("ReadToolBlock", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders markdown output for markdown file reads", () => {
    const item = createReadItem(
      "tool-read-markdown",
      { file_path: "README.md" },
      "## Section\n\n- item one\n- item two",
    );

    const view = render(<ReadToolBlock item={item} isExpanded={false} onToggle={() => {}} />);

    fireEvent.click(screen.getByText("tools.readFile"));

    expect(view.container.querySelector(".read-tool-markdown")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Section" })).toBeTruthy();
    expect(screen.getByText("item one")).toBeTruthy();
  });

  it("falls back to plain text rendering for non-markdown files", () => {
    const item = createReadItem(
      "tool-read-code",
      { file_path: "src/main.ts" },
      "const value = 1;\nconsole.log(value);",
    );

    const view = render(<ReadToolBlock item={item} isExpanded={false} onToggle={() => {}} />);

    fireEvent.click(screen.getByText("tools.readFile"));

    expect(view.container.querySelector(".read-tool-markdown")).toBeNull();
    expect(screen.getByText(/const value = 1;/)).toBeTruthy();
    expect(screen.getByText(/console\.log\(value\);/)).toBeTruthy();
  });

  it("preserves read output indentation after stripping line numbers", () => {
    const item = createReadItem(
      "tool-read-code-indented",
      { file_path: "src/app-shell.tsx" },
      "46  import {\n47    SidebarCollapseButton,\n48    TitlebarExpandControls,\n49  } from './layout';",
    );

    const view = render(<ReadToolBlock item={item} isExpanded={true} onToggle={() => {}} />);

    const lines = view.container.querySelectorAll(".read-tool-code-line-content");

    expect(lines[1]?.textContent).toBe("  SidebarCollapseButton,");
    expect(lines[2]?.textContent).toBe("  TitlebarExpandControls,");
  });

  it("honors external expansion from the operation timeline", () => {
    const item = createReadItem(
      "tool-read-external-expanded",
      { file_path: "src/main.ts" },
      "export const value = 1;",
    );

    render(<ReadToolBlock item={item} isExpanded={true} onToggle={() => {}} />);

    expect(screen.getByText(/export const value = 1;/)).toBeTruthy();
  });
});
