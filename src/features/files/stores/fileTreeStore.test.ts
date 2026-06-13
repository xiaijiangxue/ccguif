import { describe, expect, it, vi } from "vitest";
import { createFileTreeStore } from "./fileTreeStore";

describe("fileTreeStore", () => {
  it("toggles expanded folders", () => {
    const store = createFileTreeStore({ workspaceId: "workspace-1" });

    store.getState().toggleExpanded("src");
    expect(store.getState().expandedFolders.has("src")).toBe(true);

    store.getState().toggleExpanded("src");
    expect(store.getState().expandedFolders.has("src")).toBe(false);
  });

  it("tracks visible and ignored load lifecycle independently", () => {
    const store = createFileTreeStore({ workspaceId: "workspace-1" });

    store.getState().startVisibleLoad("src");
    expect(store.getState().loadingVisibleDirs.has("src")).toBe(true);

    store.getState().completeVisibleLoad("src", {
      files: ["src/index.ts"],
      directories: [],
      directory_entries: [{ path: "src", child_state: "loaded" }],
    });
    expect(store.getState().loadingVisibleDirs.has("src")).toBe(false);
    expect(store.getState().loadedVisibleDirs.has("src")).toBe(true);
    expect(store.getState().directoryCache.get("src")?.visibleChildren).toHaveLength(1);

    store.getState().startIgnoredLoad("src");
    store.getState().completeIgnoredLoad("src", {
      files: ["src/.ignored.ts"],
      directories: [],
    });

    const cacheEntry = store.getState().directoryCache.get("src");
    // buildTree builds from full paths, so "src/index.ts" produces a root "src" node
    const srcNode = cacheEntry?.visibleChildren[0];
    expect(srcNode?.children.map((c) => c.path)).toEqual(["src/index.ts"]);
    const srcIgnoredNode = cacheEntry?.ignoredChildren[0];
    expect(srcIgnoredNode?.children.map((c) => c.path)).toEqual(["src/.ignored.ts"]);
  });

  it("updates selection and range selection", () => {
    const store = createFileTreeStore({ workspaceId: "workspace-1" });
    const pathTypes = new Map<string, "file" | "folder" | "root">([
      ["src", "folder"],
      ["src/a.ts", "file"],
      ["src/b.ts", "file"],
    ]);

    store.getState().selectNode("src", "folder");
    store.getState().rangeSelect("src", "src/b.ts", ["src", "src/a.ts", "src/b.ts"], pathTypes);

    expect(Array.from(store.getState().multiSelection)).toEqual([
      "src",
      "src/a.ts",
      "src/b.ts",
    ]);
    expect(store.getState().selectedPath).toBe("src/b.ts");
    expect(store.getState().selectedType).toBe("file");
  });

  it("prunes deleted descendants across tree, lazy, and selection state", () => {
    const store = createFileTreeStore({ workspaceId: "workspace-1" });
    store.getState().toggleExpanded("src");
    store.getState().startVisibleLoad("src/components");
    store.getState().selectNode("src/components/Button.tsx", "file");

    store.getState().pruneDeletedPath("src");

    expect(store.getState().expandedFolders.size).toBe(0);
    expect(store.getState().loadingVisibleDirs.size).toBe(0);
    expect(store.getState().selectedPath).toBe(null);
    expect(store.getState().multiSelection.size).toBe(0);
  });

  it("increments epoch for stale async response invalidation", () => {
    const store = createFileTreeStore({ workspaceId: "workspace-1" });

    expect(store.getState().incrementEpoch()).toBe(1);
    expect(store.getState().epoch).toBe(1);
  });

  it("does not notify selectedPath subscribers for unrelated cache updates", () => {
    const store = createFileTreeStore({ workspaceId: "workspace-1" });
    const listener = vi.fn();

    const unsubscribe = store.subscribe(listener, (state) => state.selectedPath);
    store.getState().completeVisibleLoad("src", { files: ["src/index.ts"], directories: [] });

    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });
});
