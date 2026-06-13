/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FileTreeContainer } from "./FileTreeContainer";
import type { VisibleFileTreeRow } from "../utils/treeModel";

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        key: index,
        size: 28,
        start: index * 28,
        end: index * 28 + 28,
        lane: 0,
      })),
    getTotalSize: () => count * 28,
    scrollToIndex: vi.fn(),
    measureElement: vi.fn(),
  }),
}));

const rows: VisibleFileTreeRow[] = [
  {
    kind: "node",
    entry: {
      path: "src",
      type: "folder",
      depth: 1,
      node: {
        name: "src",
        path: "src",
        type: "folder",
        children: [],
      },
    },
  },
  {
    kind: "lazy-state",
    path: "src",
    depth: 2,
    state: "loading",
    error: null,
  },
];

describe("FileTreeContainer", () => {
  it("renders rows through the virtualized list", () => {
    render(
      <FileTreeContainer
        rows={rows}
        isRootExpanded
        isLoading={false}
        hasTreeEntries
        loadError={null}
        loadingLabel="Loading"
        emptyLabel="Empty"
        loadErrorLabel="Load failed"
        retryLabel="Retry"
        renderRow={(row) => (
          <div>{row.kind === "node" ? row.entry.path : `${row.path}:${row.state}`}</div>
        )}
      />,
    );

    expect(screen.getByText("src")).toBeInTheDocument();
    expect(screen.getByText("src:loading")).toBeInTheDocument();
    expect(screen.getByText("src").closest("[data-file-tree-row-count]")).toHaveAttribute(
      "data-file-tree-row-count",
      "2",
    );
  });

  it("renders loading and empty states outside the virtualized rows", () => {
    const { rerender } = render(
      <FileTreeContainer
        rows={[]}
        isRootExpanded
        isLoading
        hasTreeEntries={false}
        loadError={null}
        loadingLabel="Loading"
        emptyLabel="Empty"
        loadErrorLabel="Load failed"
        retryLabel="Retry"
        renderRow={() => null}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Loading");

    rerender(
      <FileTreeContainer
        rows={[]}
        isRootExpanded
        isLoading={false}
        hasTreeEntries={false}
        loadError={null}
        loadingLabel="Loading"
        emptyLabel="Empty"
        loadErrorLabel="Load failed"
        retryLabel="Retry"
        renderRow={() => null}
      />,
    );

    expect(screen.getByText("Empty")).toBeInTheDocument();
  });
});
