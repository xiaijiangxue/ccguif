// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ConversationItem } from "../../../../types";
import { McpToolBlock } from "./McpToolBlock";

const mcpItem: Extract<ConversationItem, { kind: "tool" }> = {
  id: "mcp-tool-1",
  kind: "tool",
  toolType: "mcpToolCall",
  title: "Tool: mcp__context7__query_docs",
  detail: JSON.stringify({ query: "React docs", libraryId: "/react/docs" }),
  output: "Found React docs",
  status: "completed",
};

describe("McpToolBlock", () => {
  afterEach(() => {
    cleanup();
  });

  it("honors external expansion for timeline details", () => {
    render(
      <McpToolBlock
        item={mcpItem}
        isExpanded={true}
        onToggle={vi.fn()}
      />,
    );

    expect(screen.getByText("Found React docs")).toBeTruthy();
  });
});
