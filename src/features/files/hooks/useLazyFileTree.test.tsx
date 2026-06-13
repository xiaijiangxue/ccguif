/** @vitest-environment jsdom */
import { act, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getWorkspaceDirectoryChildrenIgnored,
  getWorkspaceDirectoryChildrenVisible,
} from "../../../services/tauri";
import {
  FileTreeStoreProvider,
  useFileTreeStoreApi,
} from "../stores/fileTreeStoreContext";
import { useLazyFileTree } from "./useLazyFileTree";

vi.mock("../../../services/tauri", () => ({
  getWorkspaceDirectoryChildren: vi.fn(),
  getWorkspaceDirectoryChildrenIgnored: vi.fn(),
  getWorkspaceDirectoryChildrenVisible: vi.fn(),
}));

function wrapper({ children }: PropsWithChildren) {
  return <FileTreeStoreProvider workspaceId="workspace-1">{children}</FileTreeStoreProvider>;
}

function useHarness() {
  const store = useFileTreeStoreApi();
  const lazyTree = useLazyFileTree({
    workspaceId: "workspace-1",
    files: [],
    directories: ["src"],
    directoryMetadata: [{ path: "src", child_state: "partial" }],
    ignoredFiles: new Set(),
    ignoredDirectories: new Set(),
    expandedFolders: store.getState().expandedFolders,
    setExpandedFolders: store.getState().setExpandedFolders,
  });
  return { store, lazyTree };
}

describe("useLazyFileTree", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads visible and ignored children into the file tree store", async () => {
    vi.mocked(getWorkspaceDirectoryChildrenVisible).mockResolvedValueOnce({
      files: ["src/index.ts"],
      directories: ["src/components"],
      directory_entries: [
        { path: "src", child_state: "loaded" },
        { path: "src/components", child_state: "empty" },
      ],
    });
    vi.mocked(getWorkspaceDirectoryChildrenIgnored).mockResolvedValueOnce({
      files: ["src/.ignored.ts"],
      directories: [],
    });

    const { result } = renderHook(() => useHarness(), { wrapper });

    await act(async () => {
      await result.current.lazyTree.loadLazyDirectoryChildren("src");
    });

    await waitFor(() => {
      expect(result.current.store.getState().loadedVisibleDirs.has("src")).toBe(true);
    });
    const cacheEntry = result.current.store.getState().directoryCache.get("src");
    // buildTree builds from full paths, so "src/index.ts" and "src/components"
    // produce a root "src" node with children. visibleChildren holds the root nodes.
    const srcNode = cacheEntry?.visibleChildren[0];
    expect(srcNode?.children.map((c) => c.path).sort()).toEqual([
      "src/components",
      "src/index.ts",
    ]);
    // ignoredChildren also goes through buildTree, producing the same structure
    const srcIgnoredNode = cacheEntry?.ignoredChildren[0];
    expect(srcIgnoredNode?.children.map((c) => c.path)).toEqual(["src/.ignored.ts"]);
  });

  it("deduplicates concurrent loads for the same directory", async () => {
    vi.mocked(getWorkspaceDirectoryChildrenVisible).mockResolvedValue({
      files: ["src/index.ts"],
      directories: [],
      directory_entries: [{ path: "src", child_state: "loaded" }],
    });
    vi.mocked(getWorkspaceDirectoryChildrenIgnored).mockResolvedValue({
      files: [],
      directories: [],
    });

    const { result } = renderHook(() => useHarness(), { wrapper });

    await act(async () => {
      await Promise.all([
        result.current.lazyTree.loadLazyDirectoryChildren("src"),
        result.current.lazyTree.loadLazyDirectoryChildren("src"),
      ]);
    });

    expect(getWorkspaceDirectoryChildrenVisible).toHaveBeenCalledTimes(1);
  });
});
