/** @vitest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import type { DragEvent } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { emitTo } from "@tauri-apps/api/event";
import { useTreeDrag } from "./useTreeDrag";
import type { FileTreeNode } from "../utils/treeModel";
import {
  clearFileTreeDragBridge,
  setFileTreeDragBridge,
  setFileTreeDragPosition,
} from "../utils/fileTreeDragBridge";

vi.mock("@tauri-apps/api/event", () => ({
  emitTo: vi.fn(() => Promise.resolve()),
}));

vi.mock("../detachedFileTreeDragBridge", () => ({
  DETACHED_FILE_TREE_DRAG_BRIDGE_EVENT: "detached-file-tree-drag",
  writeDetachedFileTreeDragSnapshot: vi.fn(),
}));

vi.mock("../utils/fileTreeDragBridge", () => ({
  bindChatDropTargetsForTreeDrag: vi.fn(() => vi.fn()),
  clearFileTreeDragBridge: vi.fn(),
  createWindowsFileTreeDragImage: vi.fn(() => null),
  CROSS_WINDOW_TREE_DRAG_REBROADCAST_THROTTLE_MS: 50,
  insertPathsIntoChat: vi.fn(),
  isWindowsDragPreviewRuntime: vi.fn(() => false),
  setFileTreeDragBridge: vi.fn(),
  setFileTreeDragPosition: vi.fn(),
  triggerChatInputInsertFromTreeDrag: vi.fn(() => true),
}));

const node: FileTreeNode = {
  name: "index.ts",
  path: "src/index.ts",
  type: "file",
  children: [],
};

function createDragEvent() {
  return {
    clientX: 10,
    clientY: 20,
    dataTransfer: {
      effectAllowed: "none",
      setData: vi.fn(),
      setDragImage: vi.fn(),
    },
  } as unknown as DragEvent<HTMLButtonElement>;
}

describe("useTreeDrag", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts a file tree drag with absolute paths and cleans up on drag end", () => {
    const setSingleSelection = vi.fn();
    const { result } = renderHook(() =>
      useTreeDrag({
        crossWindowDragTargetLabel: "detached-window",
        orderedSelectedNodePaths: ["src/index.ts"],
        resolvePath: (path) => `/workspace/${path}`,
        setSingleSelection,
      }),
    );
    const event = createDragEvent();

    act(() => {
      result.current.handleDragStart(node, true, event);
    });

    expect(setFileTreeDragBridge).toHaveBeenCalledWith(["/workspace/src/index.ts"]);
    expect(setFileTreeDragPosition).toHaveBeenCalledWith(10, 20);
    expect(emitTo).toHaveBeenCalledWith("detached-window", "detached-file-tree-drag", {
      type: "start",
      paths: ["/workspace/src/index.ts"],
    });
    expect(event.dataTransfer.setData).toHaveBeenCalledWith(
      "application/x-ccgui-file-paths",
      "[\"/workspace/src/index.ts\"]",
    );

    act(() => {
      result.current.handleDragEnd(event);
    });

    expect(clearFileTreeDragBridge).toHaveBeenCalled();
  });
});
