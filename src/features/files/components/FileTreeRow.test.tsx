/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FileTreeRow } from "./FileTreeRow";
import type { FileTreeNode } from "../utils/treeModel";

const folderNode: FileTreeNode = {
  name: "src",
  path: "src",
  type: "folder",
  children: [],
};

describe("FileTreeRow", () => {
  it("renders folder row state and invokes row callbacks", () => {
    const onSelect = vi.fn();
    const onToggleExpanded = vi.fn();
    const onMention = vi.fn();

    render(
      <FileTreeRow
        node={folderNode}
        depth={3}
        isExpanded
        canExpand
        isLazyFolder={false}
        gitStatusClass=" git-m"
        isGitignored={false}
        isSelected
        isPrimarySelection
        isEditorActive
        mentionAriaLabel="Mention src"
        mentionTitle="Mention in chat"
        onSelect={onSelect}
        onOpen={vi.fn()}
        onContextMenu={vi.fn()}
        onToggleExpanded={onToggleExpanded}
        onDragStart={vi.fn()}
        onDrag={vi.fn()}
        onDragEnd={vi.fn()}
        onMention={onMention}
      />,
    );

    const row = screen.getByText("src").closest("button");
    expect(row).toBeTruthy();
    if (!row) {
      throw new Error("Expected file tree row button");
    }
    expect(row.className).toContain("is-selected");
    expect(row.className).toContain("is-primary");
    expect(row.className).toContain("is-editor-active");
    expect(row).toHaveStyle({ paddingLeft: "30px" });

    fireEvent.click(row);
    expect(onSelect).toHaveBeenCalledWith(folderNode, expect.any(Object));

    fireEvent.click(screen.getByText("›"));
    expect(onToggleExpanded).toHaveBeenCalledWith(folderNode, false);

    fireEvent.click(screen.getByRole("button", { name: "Mention src" }));
    expect(onMention).toHaveBeenCalledWith(folderNode, expect.any(Object));
  });
});
