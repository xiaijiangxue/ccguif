import { describe, expect, it } from "vitest";
import {
  buildTree,
  collectDirectoryCacheSnapshot,
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
});
