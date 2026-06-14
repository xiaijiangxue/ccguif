/** @vitest-environment jsdom */
import { act, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getWorkspaceDirectoryChildren,
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
    vi.mocked(getWorkspaceDirectoryChildren).mockResolvedValueOnce({
      files: ["src/index.ts"],
      directories: ["src/components"],
      directory_entries: [
        { path: "src", child_state: "loaded" },
        { path: "src/components", child_state: "empty" },
      ],
      gitignored_files: ["src/.ignored.ts"],
      gitignored_directories: [],
    });

    const { result } = renderHook(() => useHarness(), { wrapper });

    await act(async () => {
      await result.current.lazyTree.loadLazyDirectoryChildren("src");
    });

    await waitFor(() => {
      expect(result.current.store.getState().loadedVisibleDirs.has("src")).toBe(true);
    });
    const cacheEntry = result.current.store.getState().directoryCache.get("src");
    // buildTree builds from full paths, so "src/index.ts", "src/components",
    // and "src/.ignored.ts" produce a root "src" node with children.
    // The merged all-in-one response puts everything into visibleChildren.
    const srcNode = cacheEntry?.visibleChildren[0];
    expect(srcNode?.children.map((c) => c.path).sort()).toEqual([
      "src/.ignored.ts",
      "src/components",
      "src/index.ts",
    ]);
    // ignoredChildren is empty because the merged call only populates visibleChildren
    expect(cacheEntry?.ignoredChildren).toEqual([]);
  });

  it("deduplicates concurrent loads for the same directory", async () => {
    vi.mocked(getWorkspaceDirectoryChildren).mockResolvedValue({
      files: ["src/index.ts"],
      directories: [],
      directory_entries: [{ path: "src", child_state: "loaded" }],
      gitignored_files: [],
      gitignored_directories: [],
    });

    const { result } = renderHook(() => useHarness(), { wrapper });

    await act(async () => {
      await Promise.all([
        result.current.lazyTree.loadLazyDirectoryChildren("src"),
        result.current.lazyTree.loadLazyDirectoryChildren("src"),
      ]);
    });

    expect(getWorkspaceDirectoryChildren).toHaveBeenCalledTimes(1);
  });

  it("does not prefetch children when expanding a special directory", async () => {
    vi.mocked(getWorkspaceDirectoryChildrenVisible).mockResolvedValueOnce({
      files: [],
      directories: ["target/debug"],
      directory_entries: [
        { path: "target", child_state: "partial", has_more: true },
        { path: "target/debug", child_state: "unknown" },
      ],
      gitignored_files: [],
      gitignored_directories: ["target/debug"],
    });

    const { result } = renderHook(() => useHarness(), { wrapper });

    await act(async () => {
      await result.current.lazyTree.loadLazyDirectoryChildren("target");
    });

    expect(getWorkspaceDirectoryChildren).not.toHaveBeenCalled();
    expect(getWorkspaceDirectoryChildrenVisible).toHaveBeenCalledTimes(1);
    expect(getWorkspaceDirectoryChildrenVisible).toHaveBeenCalledWith("workspace-1", "target");
  });
});
