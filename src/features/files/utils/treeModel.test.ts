import { describe, expect, it } from "vitest";
import {
  buildTree,
  collectDirectoryCacheSnapshot,
  patchDirectoryCacheSnapshot,
  patchTree,
  flattenVisibleTree,
  hasWorkspaceDirectoryEntries,
  isConfirmedEmptyDirectoryResponse,
  isSpecialDirectoryPath,
} from "./treeModel";

describe("treeModel", () => {
  it("builds and flattens expanded tree rows in depth order", () => {
    const { nodes } = buildTree(
      ["src/features/files/FileTreePanel.tsx", "README.md"],
      ["src", "src/features", "src/features/files"],
      new Set(),
      new Map(),
    );

    const rows = flattenVisibleTree({
      nodes,
      expandedFolders: new Set(["src/features/files"]),
      rootExpanded: true,
      loadingLazyDirectories: new Set(),
      lazyDirectoryLoadErrors: new Map(),
    });

    expect(rows.map((row) => (row.kind === "node" ? [row.entry.path, row.entry.depth] : null)))
      .toEqual([
        ["src/features/files", 1],
        ["src/features/files/FileTreePanel.tsx", 2],
        ["README.md", 1],
      ]);
  });

  it("hides children for collapsed folders", () => {
    const { nodes } = buildTree(
      ["src/index.ts"],
      ["src"],
      new Set(),
      new Map(),
    );

    const rows = flattenVisibleTree({
      nodes,
      expandedFolders: new Set(),
      rootExpanded: true,
      loadingLazyDirectories: new Set(),
      lazyDirectoryLoadErrors: new Map(),
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe("node");
    expect(rows[0]?.kind === "node" ? rows[0].entry.path : "").toBe("src");
  });

  it("adds lazy state rows for expanded uncached lazy folders", () => {
    const { nodes } = buildTree(
      [],
      ["node_modules"],
      new Set(["node_modules"]),
      new Map(),
    );

    const rows = flattenVisibleTree({
      nodes,
      expandedFolders: new Set(["node_modules"]),
      rootExpanded: true,
      loadingLazyDirectories: new Set(["node_modules"]),
      lazyDirectoryLoadErrors: new Map(),
    });

    expect(rows.at(1)).toEqual({
      kind: "lazy-state",
      path: "node_modules",
      depth: 2,
      state: "loading",
      error: null,
    });
  });

  it("recognizes special dependency and build artifact directories", () => {
    expect(isSpecialDirectoryPath("frontend/node_modules")).toBe(true);
    expect(isSpecialDirectoryPath("packages/app/dist")).toBe(true);
    expect(isSpecialDirectoryPath("src/features/files")).toBe(false);
  });

  it("classifies empty and non-empty directory responses", () => {
    expect(
      isConfirmedEmptyDirectoryResponse("src", {
        files: [],
        directories: [],
        gitignored_files: [],
        gitignored_directories: [],
        directory_entries: [{ path: "src", child_state: "empty" }],
      }),
    ).toBe(true);
    expect(
      hasWorkspaceDirectoryEntries({
        files: ["src/index.ts"],
        directories: [],
        gitignored_files: [],
        gitignored_directories: [],
      }),
    ).toBe(true);
  });

  it("collects files, directories, and metadata from directory cache entries", () => {
    const { nodes } = buildTree(
      ["src/index.ts", "src/ignored.log"],
      ["src", "src/generated"],
      new Set(["src/generated"]),
      new Map([
        ["src", { path: "src", child_state: "loaded" }],
        ["src/generated", { path: "src/generated", child_state: "partial", has_more: true }],
      ]),
    );
    const entry = {
      visibleChildren: nodes,
      ignoredChildren: [],
      metadataByPath: new Map([
        ["src/generated", { path: "src/generated", child_state: "partial" as const, has_more: true }],
      ]),
      childState: "loaded" as const,
      visibleStatus: "loaded" as const,
      ignoredStatus: "idle" as const,
      visibleError: null,
      ignoredError: null,
      confirmedEmpty: false,
      loadedEpoch: 1,
    };

    const snapshot = collectDirectoryCacheSnapshot(new Map([["src", entry]]));

    expect(Array.from(snapshot.files).sort()).toEqual(["src/ignored.log", "src/index.ts"]);
    expect(Array.from(snapshot.directories).sort()).toEqual(["src", "src/generated"]);
    expect(snapshot.metadataByPath.get("src/generated")?.has_more).toBe(true);
  });

  describe("patchDirectoryCacheSnapshot", () => {
    it("patches a new directory entry into an existing snapshot", () => {
      const initialCache = new Map();
      const initial = collectDirectoryCacheSnapshot(initialCache);

      // Build children for the new directory
      const { nodes } = buildTree(
        ["src/index.ts", "src/utils.ts"],
        ["src"],
        new Set(),
        new Map(),
      );
      const newEntry = {
        visibleChildren: nodes,
        ignoredChildren: [],
        metadataByPath: new Map(),
      };

      const patched = patchDirectoryCacheSnapshot(initial, "src", undefined, newEntry);

      expect(Array.from(patched.files).sort()).toEqual(["src/index.ts", "src/utils.ts"]);
      expect(patched.directories.has("src")).toBe(true);
    });

    it("replaces an old directory entry's children with new ones", () => {
      // Build initial entry with one file
      const { nodes: oldNodes } = buildTree(
        ["src/old.ts"],
        ["src"],
        new Set(),
        new Map([["src", { path: "src", child_state: "loaded" }]]),
      );
      const oldEntry = {
        visibleChildren: oldNodes,
        ignoredChildren: [],
        metadataByPath: new Map(),
      };
      const initial = collectDirectoryCacheSnapshot(new Map([["src", oldEntry]]));

      expect(initial.files.has("src/old.ts")).toBe(true);

      // Build new entry with different files
      const { nodes: newNodes } = buildTree(
        ["src/new.ts", "src/also.ts"],
        ["src"],
        new Set(),
        new Map([["src", { path: "src", child_state: "loaded" }]]),
      );
      const newEntry = {
        visibleChildren: newNodes,
        ignoredChildren: [],
        metadataByPath: new Map(),
      };

      const patched = patchDirectoryCacheSnapshot(initial, "src", oldEntry, newEntry);

      expect(patched.files.has("src/old.ts")).toBe(false);
      expect(Array.from(patched.files).sort()).toEqual(["src/also.ts", "src/new.ts"]);
      expect(patched.directories.has("src")).toBe(true);
    });

    it("handles patching with ignored children", () => {
      const { nodes: visibleNodes } = buildTree(
        ["src/index.ts"],
        ["src"],
        new Set(),
        new Map(),
      );
      const { nodes: ignoredNodes } = buildTree(
        ["src/.env"],
        [],
        new Set(),
        new Map(),
      );
      const newEntry = {
        visibleChildren: visibleNodes,
        ignoredChildren: ignoredNodes,
        metadataByPath: new Map(),
      };

      const initial = collectDirectoryCacheSnapshot(new Map());
      const patched = patchDirectoryCacheSnapshot(initial, "src", undefined, newEntry);

      expect(patched.files.has("src/index.ts")).toBe(true);
      expect(patched.files.has("src/.env")).toBe(true);
    });

    it("full rebuild matches existing collectDirectoryCacheSnapshot behavior", () => {
      const { nodes } = buildTree(
        ["src/index.ts", "src/ignored.log"],
        ["src", "src/generated"],
        new Set(["src/generated"]),
        new Map([
          ["src", { path: "src", child_state: "loaded" }],
          ["src/generated", { path: "src/generated", child_state: "partial", has_more: true }],
        ]),
      );
      const entry = {
        visibleChildren: nodes,
        ignoredChildren: [],
        metadataByPath: new Map([
          ["src/generated", { path: "src/generated", child_state: "partial" as const, has_more: true }],
        ]),
      };

      const fullSnapshot = collectDirectoryCacheSnapshot(new Map([["src", entry]]));
      const patchedSnapshot = patchDirectoryCacheSnapshot(
        collectDirectoryCacheSnapshot(new Map()),
        "src",
        undefined,
        entry,
      );

      expect(Array.from(patchedSnapshot.files).sort()).toEqual(Array.from(fullSnapshot.files).sort());
      expect(Array.from(patchedSnapshot.directories).sort()).toEqual(Array.from(fullSnapshot.directories).sort());
      expect(patchedSnapshot.metadataByPath.get("src/generated")?.has_more).toBe(true);
    });
  });

  describe("patchTree", () => {
    it("patches children into an existing tree node", () => {
      const { nodes } = buildTree(
        ["src/old.ts"],
        ["src"],
        new Set(["src"]),
        new Map([["src", { path: "src", child_state: "loaded" }]]),
      );

      // Build new children for src
      const { nodes: newChildren } = buildTree(
        ["src/new.ts", "src/also.ts"],
        [],
        new Set(),
        new Map(),
      );

      const patched = patchTree(nodes, "src", newChildren);

      // Find the src node
      const srcNode = patched.find((n) => n.path === "src");
      expect(srcNode).toBeDefined();
      expect(srcNode!.children.map((c) => c.path).sort()).toEqual(["src/also.ts", "src/new.ts"]);
      // Old file should be gone
      expect(srcNode!.children.find((c) => c.path === "src/old.ts")).toBeUndefined();
    });

    it("returns original tree when target path is not found", () => {
      const { nodes } = buildTree(
        ["README.md"],
        ["src"],
        new Set(),
        new Map(),
      );

      const result = patchTree(nodes, "nonexistent", []);
      expect(result).toBe(nodes); // Same reference = no change
    });

    it("handles patching with folder children", () => {
      const { nodes } = buildTree(
        ["src/index.ts"],
        ["src", "src/utils"],
        new Set(),
        new Map(),
      );

      // Patch src with new subdirectories
      const { nodes: newChildren } = buildTree(
        ["src/index.ts", "src/main.ts"],
        ["src/helpers", "src/utils"],
        new Set(),
        new Map(),
      );

      const patched = patchTree(nodes, "src", newChildren);
      const srcNode = patched.find((n) => n.path === "src");

      expect(srcNode).toBeDefined();
      const childNames = srcNode!.children.map((c) => c.name);
      expect(childNames).toContain("helpers");
      expect(childNames).toContain("utils");
      expect(childNames).toContain("index.ts");
    });

    it("preserves unchanged parts of the tree", () => {
      const { nodes } = buildTree(
        ["src/index.ts", "README.md"],
        ["src"],
        new Set(),
        new Map(),
      );

      // Only patch src, README.md should be untouched
      const { nodes: newChildren } = buildTree(
        ["src/new.ts"],
        [],
        new Set(),
        new Map(),
      );

      const patched = patchTree(nodes, "src", newChildren);
      const readmeNode = patched.find((n) => n.path === "README.md");
      expect(readmeNode).toBeDefined();
    });
  });
});
