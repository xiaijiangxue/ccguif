import type {
  WorkspaceDirectoryChildState,
  WorkspaceDirectoryEntry,
  WorkspaceFilesResponse,
} from "../../../services/tauri";
import type { FilterCategory } from "../stores/types";

export type FileTreeNode = {
  name: string;
  path: string;
  type: "file" | "folder";
  children: FileTreeNode[];
  isLazyLoadable?: boolean;
  isGitignored?: boolean;
  childState?: WorkspaceDirectoryChildState;
  hasMore?: boolean;
};

export type FileTreeBuildResult = {
  nodes: FileTreeNode[];
  folderPaths: Set<string>;
};

export type DirectoryCacheSnapshot = {
  files: Set<string>;
  directories: Set<string>;
  metadataByPath: Map<string, WorkspaceDirectoryEntry>;
};

export type DirectoryCacheSnapshotEntry = {
  visibleChildren: FileTreeNode[];
  ignoredChildren: FileTreeNode[];
  metadataByPath: Map<string, WorkspaceDirectoryEntry>;
};

export type VisibleTreeNodeEntry = {
  path: string;
  type: "file" | "folder" | "root";
  depth: number;
  node: FileTreeNode | null;
};

export type FileTreeLazyRowState = "loading" | "error" | "empty";

export type VisibleFileTreeRow =
  | { kind: "node"; entry: VisibleTreeNodeEntry & { node: FileTreeNode } }
  | {
      kind: "lazy-state";
      path: string;
      depth: number;
      state: FileTreeLazyRowState;
      error: string | null;
    };

type FileTreeBuildNode = {
  name: string;
  path: string;
  type: "file" | "folder";
  children: Map<string, FileTreeBuildNode>;
  isLazyLoadable: boolean;
  isGitignored: boolean;
  childState?: WorkspaceDirectoryChildState;
  hasMore: boolean;
};

export const SPECIAL_DEPENDENCY_DIRECTORIES = new Set([
  "node_modules",
  ".pnpm-store",
  ".yarn",
  "bower_components",
  "vendor",
  ".venv",
  "venv",
  "env",
  "__pypackages__",
  "Pods",
  "Carthage",
  ".m2",
  ".ivy2",
  ".cargo",
]);

export const SPECIAL_BUILD_ARTIFACT_DIRECTORIES = new Set([
  "target",
  "dist",
  "build",
  "out",
  "coverage",
  ".next",
  ".nuxt",
  ".svelte-kit",
  ".angular",
  ".parcel-cache",
  ".turbo",
  ".cache",
  ".gradle",
  "CMakeFiles",
  "bin",
  "obj",
  "__pycache__",
  ".pytest_cache",
  ".mypy_cache",
  ".tox",
  ".dart_tool",
]);

export const FILTER_CATEGORY_PATHS: Record<FilterCategory, ReadonlySet<string>> = {
  Dependencies: SPECIAL_DEPENDENCY_DIRECTORIES,
  BuildArtifacts: SPECIAL_BUILD_ARTIFACT_DIRECTORIES,
  IDEConfig: new Set([".idea", ".vscode", ".vs", ".project", ".classpath", ".settings"]),
};

export const ALL_FILTER_CATEGORIES: readonly FilterCategory[] = [
  "Dependencies",
  "BuildArtifacts",
  "IDEConfig",
];

export function matchesFilterCategory(dirName: string, hidden: Set<FilterCategory>): boolean {
  for (const category of hidden) {
    const paths = FILTER_CATEGORY_PATHS[category];
    if (paths.has(dirName)) {
      return true;
    }
  }
  return false;
}

export function isSameOrDescendantFileTreePath(path: string, rootPath: string) {
  return path === rootPath || path.startsWith(`${rootPath}/`);
}

export function isSuppressedFileTreePath(path: string, suppressedPaths: Set<string>) {
  for (const suppressedPath of suppressedPaths) {
    if (isSameOrDescendantFileTreePath(path, suppressedPath)) {
      return true;
    }
  }
  return false;
}

export function filterSuppressedFileTreePaths(
  paths: Set<string>,
  suppressedPaths: Set<string>,
) {
  if (suppressedPaths.size === 0 || paths.size === 0) {
    return paths;
  }
  let changed = false;
  const next = new Set<string>();
  paths.forEach((path) => {
    if (isSuppressedFileTreePath(path, suppressedPaths)) {
      changed = true;
      return;
    }
    next.add(path);
  });
  return changed ? next : paths;
}

export function filterDeletedFileTreePathFromSet(paths: Set<string>, deletedPath: string) {
  if (paths.size === 0) {
    return paths;
  }
  let changed = false;
  const next = new Set<string>();
  paths.forEach((path) => {
    if (isSameOrDescendantFileTreePath(path, deletedPath)) {
      changed = true;
      return;
    }
    next.add(path);
  });
  return changed ? next : paths;
}

export function filterDeletedFileTreePathFromMap<T>(
  valuesByPath: Map<string, T>,
  deletedPath: string,
) {
  if (valuesByPath.size === 0) {
    return valuesByPath;
  }
  let changed = false;
  const next = new Map<string, T>();
  valuesByPath.forEach((value, path) => {
    if (isSameOrDescendantFileTreePath(path, deletedPath)) {
      changed = true;
      return;
    }
    next.set(path, value);
  });
  return changed ? next : valuesByPath;
}

export function isKnownFileTreePath(path: string, files: string[], directories: string[]) {
  return (
    files.some((entry) => isSameOrDescendantFileTreePath(entry, path)) ||
    directories.some((entry) => isSameOrDescendantFileTreePath(entry, path))
  );
}

export function shouldReloadLazyFileTreePath(
  path: string,
  files: string[],
  directories: string[],
  directoryMetadataByPath: Map<string, WorkspaceDirectoryEntry>,
) {
  if (!isKnownFileTreePath(path, files, directories)) {
    return false;
  }
  if (isSpecialDirectoryPath(path)) {
    return true;
  }
  const childState = directoryMetadataByPath.get(path)?.child_state;
  return childState === "unknown" || childState === "partial";
}

export function filterUnknownExpandedFileTreePaths(
  expandedPaths: Set<string>,
  files: string[],
  directories: string[],
) {
  if (expandedPaths.size === 0) {
    return expandedPaths;
  }
  let changed = false;
  const next = new Set<string>();
  expandedPaths.forEach((path) => {
    if (!path || isKnownFileTreePath(path, files, directories)) {
      next.add(path);
      return;
    }
    changed = true;
  });
  return changed ? next : expandedPaths;
}

export function getFileTreePathLeaf(path: string) {
  return path.split("/").filter(Boolean).pop() ?? path;
}

export function isDirectlyGitignoredFolderPath(
  path: string,
  ignoredDirectories: Set<string>,
) {
  if (ignoredDirectories.has(path)) {
    return true;
  }
  const pathLeaf = getFileTreePathLeaf(path);
  for (const ignoredDirectory of ignoredDirectories) {
    if (!ignoredDirectory) {
      continue;
    }
    const ignoredLeaf = getFileTreePathLeaf(ignoredDirectory);
    if (pathLeaf === ignoredDirectory || pathLeaf === ignoredLeaf) {
      return true;
    }
  }
  return false;
}

export function isGitignoredFileTreeNode(
  node: FileTreeNode,
  ignoredFiles: Set<string>,
  ignoredDirectories: Set<string>,
  memo: Map<string, boolean>,
): boolean {
  const memoized = memo.get(node.path);
  if (memoized !== undefined) {
    return memoized;
  }
  if (node.type === "file") {
    const ignored =
      ignoredFiles.has(node.path) ||
      Array.from(ignoredDirectories).some((ignoredDirectory) =>
        isSameOrDescendantFileTreePath(node.path, ignoredDirectory),
      );
    memo.set(node.path, ignored);
    return ignored;
  }
  if (isDirectlyGitignoredFolderPath(node.path, ignoredDirectories)) {
    memo.set(node.path, true);
    return true;
  }
  const ignored =
    node.children.length > 0 &&
    node.children.every((child) =>
      isGitignoredFileTreeNode(child, ignoredFiles, ignoredDirectories, memo),
    );
  memo.set(node.path, ignored);
  return ignored;
}

export function getGitignoredFolderAncestorPaths(
  folderPaths: Set<string>,
  ignoredDirectories: Set<string>,
) {
  const ancestors = new Set<string>();
  if (folderPaths.size === 0 || ignoredDirectories.size === 0) {
    return ancestors;
  }

  folderPaths.forEach((folderPath) => {
    if (!isDirectlyGitignoredFolderPath(folderPath, ignoredDirectories)) {
      return;
    }
    const parts = folderPath.split("/").filter(Boolean);
    for (let index = 1; index < parts.length; index += 1) {
      const ancestorPath = parts.slice(0, index).join("/");
      if (!isSpecialDirectoryPath(ancestorPath)) {
        ancestors.add(ancestorPath);
      }
    }
  });

  return ancestors;
}

export function isSpecialDirectoryPath(path: string) {
  const segments = path.split("/").filter(Boolean);
  if (segments.length === 0) {
    return false;
  }
  const leaf = segments[segments.length - 1] ?? "";
  return (
    segments.some((segment) => SPECIAL_DEPENDENCY_DIRECTORIES.has(segment)) ||
    SPECIAL_BUILD_ARTIFACT_DIRECTORIES.has(leaf) ||
    leaf.startsWith("cmake-build-")
  );
}

export function hasKnownFileTreeChild(
  path: string,
  files: readonly string[],
  directories: readonly string[],
) {
  const childPrefix = `${path}/`;
  return (
    files.some((entry) => entry.startsWith(childPrefix)) ||
    directories.some((entry) => entry !== path && entry.startsWith(childPrefix))
  );
}

export function isConfirmedEmptyDirectoryResponse(
  path: string,
  response: WorkspaceFilesResponse,
) {
  const files = Array.isArray(response.files) ? response.files : [];
  const directories = Array.isArray(response.directories) ? response.directories : [];
  const gitignoredFiles = Array.isArray(response.gitignored_files) ? response.gitignored_files : [];
  const gitignoredDirectories = Array.isArray(response.gitignored_directories)
    ? response.gitignored_directories
    : [];
  const metadata = Array.isArray(response.directory_entries) ? response.directory_entries : [];

  return (
    files.length === 0 &&
    directories.length === 0 &&
    gitignoredFiles.length === 0 &&
    gitignoredDirectories.length === 0 &&
    metadata.some((entry) => entry?.path === path && entry.child_state === "empty")
  );
}

export function hasWorkspaceDirectoryEntries(response: WorkspaceFilesResponse) {
  return (
    (Array.isArray(response.files) && response.files.length > 0) ||
    (Array.isArray(response.directories) && response.directories.length > 0) ||
    (Array.isArray(response.gitignored_files) && response.gitignored_files.length > 0) ||
    (Array.isArray(response.gitignored_directories) &&
      response.gitignored_directories.length > 0)
  );
}

export function buildTree(
  files: string[],
  directories: string[],
  lazyLoadableDirectories: Set<string>,
  directoryMetadataByPath: Map<string, WorkspaceDirectoryEntry>,
  gitignoredDirectories?: Set<string>,
  hiddenCategories?: Set<FilterCategory>,
): FileTreeBuildResult {
  const root = new Map<string, FileTreeBuildNode>();
  const addNode = (
    map: Map<string, FileTreeBuildNode>,
    name: string,
    path: string,
    type: "file" | "folder",
    isLazyLoadable = false,
    isGitignored = false,
    childState?: WorkspaceDirectoryChildState,
    hasMore = false,
  ) => {
    const existing = map.get(name);
    if (existing) {
      if (type === "folder") {
        existing.type = "folder";
      }
      if (isLazyLoadable) {
        existing.isLazyLoadable = true;
      }
      if (isGitignored) {
        existing.isGitignored = true;
      }
      if (childState) {
        existing.childState = childState;
      }
      if (hasMore) {
        existing.hasMore = true;
      }
      return existing;
    }
    const node: FileTreeBuildNode = {
      name,
      path,
      type,
      children: new Map(),
      isLazyLoadable,
      isGitignored,
      childState,
      hasMore,
    };
    map.set(name, node);
    return node;
  };

  const insertPath = (path: string, leafType: "file" | "folder") => {
    const parts = path.split("/").filter(Boolean);
    if (parts.length === 0) {
      return;
    }
    let currentMap = root;
    let currentPath = "";
    parts.forEach((segment, index) => {
      // Skip directories matching hidden filter categories (and their descendants).
      if (hiddenCategories && hiddenCategories.size > 0 && matchesFilterCategory(segment, hiddenCategories)) {
        return;
      }
      const isLeaf = index === parts.length - 1;
      const nextPath = currentPath ? `${currentPath}/${segment}` : segment;
      const nodeType: "file" | "folder" = isLeaf ? leafType : "folder";
      const metadata = nodeType === "folder" ? directoryMetadataByPath.get(nextPath) : undefined;
      const node = addNode(
        currentMap,
        segment,
        nextPath,
        nodeType,
        nodeType === "folder" && lazyLoadableDirectories.has(nextPath),
        nodeType === "folder" && (gitignoredDirectories?.has(nextPath) ?? false),
        metadata?.child_state,
        Boolean(metadata?.has_more),
      );
      if (nodeType === "folder") {
        currentMap = node.children;
        currentPath = nextPath;
      }
    });
  };

  directories.forEach((path) => insertPath(path, "folder"));
  files.forEach((path) => insertPath(path, "file"));

  const folderPaths = new Set<string>();

  const sortNodes = (a: FileTreeBuildNode, b: FileTreeBuildNode) => {
    if (a.type !== b.type) {
      return a.type === "folder" ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  };

  const collapseFolderChain = (
    start: FileTreeBuildNode,
  ): { node: FileTreeBuildNode; label: string; path: string } => {
    let node = start;
    const labels = [start.name];
    let path = start.path;

    for (;;) {
      const children = Array.from(node.children.values());
      const hasDirectFile = children.some((child) => child.type === "file");
      const directFolders = children.filter((child) => child.type === "folder");
      const hasLazyLoadableChild = directFolders.some((child) => child.isLazyLoadable);
      if (
        node.isLazyLoadable ||
        hasDirectFile ||
        hasLazyLoadableChild ||
        directFolders.length !== 1
      ) {
        break;
      }
      const next = directFolders[0];
      if (!next) {
        break;
      }
      labels.push(next.name);
      node = next;
      path = node.path;
    }

    return {
      node,
      label: labels.join("."),
      path,
    };
  };

  const toArray = (map: Map<string, FileTreeBuildNode>): FileTreeNode[] =>
    Array.from(map.values())
      .sort(sortNodes)
      .map((node) => {
        if (node.type === "folder") {
          const collapsed = collapseFolderChain(node);
          folderPaths.add(collapsed.path);
          return {
            name: collapsed.label,
            path: collapsed.path,
            type: "folder" as const,
            children: toArray(collapsed.node.children),
            isLazyLoadable: collapsed.node.isLazyLoadable,
            isGitignored: collapsed.node.isGitignored,
            childState: collapsed.node.childState,
            hasMore: collapsed.node.hasMore,
          };
        }
        return {
          name: node.name,
          path: node.path,
          type: "file" as const,
          children: [],
        };
      });

  return { nodes: toArray(root), folderPaths };
}

/**
 * Incrementally patch a single directory's children in an existing tree.
 * Used when a lazy-loaded directory's children arrive — avoids full rebuild.
 * Handles collapsed chains by searching nodes whose path matches the target.
 */
export function patchTree(
  tree: FileTreeNode[],
  changedPath: string,
  newChildren: FileTreeNode[],
): FileTreeNode[] {
  const segments = changedPath.split("/").filter(Boolean);

  const findNode = (nodes: FileTreeNode[], depth: number): FileTreeNode | null => {
    for (const node of nodes) {
      if (node.path === changedPath) return node;
      if (node.type === "folder" && depth < segments.length) {
        const found = findNode(node.children, depth + 1);
        if (found) return found;
      }
    }
    return null;
  };

  const target = findNode(tree, 0);
  if (!target) {
    // Target not found — fall back to a full rebuild signal
    return tree;
  }

  const sortNodes = (a: FileTreeNode, b: FileTreeNode) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name);
  };

  return tree.map((node) => {
    if (node !== target) return node;
    return {
      ...node,
      children: [...newChildren].sort(sortNodes),
    };
  });
}

export function collectDirectoryCacheSnapshot(
  directoryCache: ReadonlyMap<string, DirectoryCacheSnapshotEntry>,
): DirectoryCacheSnapshot {
  const files = new Set<string>();
  const directories = new Set<string>();
  const metadataByPath = new Map<string, WorkspaceDirectoryEntry>();

  const visit = (node: FileTreeNode) => {
    if (node.type === "folder") {
      directories.add(node.path);
      if (node.childState) {
        metadataByPath.set(node.path, {
          path: node.path,
          child_state: node.childState,
          has_more: node.hasMore,
        });
      }
      node.children.forEach(visit);
      return;
    }
    files.add(node.path);
  };

  directoryCache.forEach((entry) => {
    entry.metadataByPath.forEach((metadata, path) => {
      metadataByPath.set(path, metadata);
    });
    entry.visibleChildren.forEach(visit);
    entry.ignoredChildren.forEach(visit);
  });

  return { files, directories, metadataByPath };
}

/**
 * Incrementally patch a directory cache snapshot when a single directory's
 * cache entry changes. Instead of re-traversing all cache entries, removes
 * the old entry's children and adds the new entry's children.
 */
export function patchDirectoryCacheSnapshot(
  previous: DirectoryCacheSnapshot,
  _changedPath: string,
  oldEntry: DirectoryCacheSnapshotEntry | undefined,
  newEntry: DirectoryCacheSnapshotEntry,
): DirectoryCacheSnapshot {
  const files = new Set(previous.files);
  const directories = new Set(previous.directories);
  const metadataByPath = new Map(previous.metadataByPath);

  // Remove old entry's children from the snapshot
  if (oldEntry) {
    const removeNode = (node: FileTreeNode) => {
      if (node.type === "file") {
        files.delete(node.path);
      } else {
        directories.delete(node.path);
        node.children.forEach(removeNode);
      }
    };
    oldEntry.visibleChildren.forEach(removeNode);
    oldEntry.ignoredChildren.forEach(removeNode);

    // Remove metadata contributed by this entry's children
    for (const [path, metadata] of oldEntry.metadataByPath) {
      const current = metadataByPath.get(path);
      if (current === metadata) {
        metadataByPath.delete(path);
      }
    }
  }

  // Add new entry's children to the snapshot
  const addNode = (node: FileTreeNode) => {
    if (node.type === "file") {
      files.add(node.path);
    } else {
      directories.add(node.path);
      if (node.childState) {
        metadataByPath.set(node.path, {
          path: node.path,
          child_state: node.childState,
          has_more: node.hasMore,
        });
      }
      node.children.forEach(addNode);
    }
  };
  newEntry.visibleChildren.forEach(addNode);
  newEntry.ignoredChildren.forEach(addNode);

  // Add metadata from the new entry's metadataByPath
  newEntry.metadataByPath.forEach((metadata, path) => {
    metadataByPath.set(path, metadata);
  });

  return { files, directories, metadataByPath };
}

export function flattenVisibleTree(options: {
  nodes: FileTreeNode[];
  expandedFolders: Set<string>;
  rootExpanded: boolean;
  loadingLazyDirectories: Set<string>;
  lazyDirectoryLoadErrors: Map<string, string>;
}): VisibleFileTreeRow[] {
  const rows: VisibleFileTreeRow[] = [];

  const visit = (node: FileTreeNode, depth: number) => {
    rows.push({
      kind: "node",
      entry: { path: node.path, type: node.type, depth, node },
    });

    const isLazyFolder = node.type === "folder" && (node.isLazyLoadable ?? false);
    const isExpanded = node.type === "folder" && options.expandedFolders.has(node.path);
    if (!isExpanded) {
      return;
    }

    node.children.forEach((child) => visit(child, depth + 1));

    if (!isLazyFolder || node.children.length > 0) {
      return;
    }
    const lazyLoadError = options.lazyDirectoryLoadErrors.get(node.path) ?? null;
    rows.push({
      kind: "lazy-state",
      path: node.path,
      depth: depth + 1,
      state: options.loadingLazyDirectories.has(node.path)
        ? "loading"
        : lazyLoadError
          ? "error"
          : "empty",
      error: lazyLoadError,
    });
  };

  if (options.rootExpanded) {
    options.nodes.forEach((node) => visit(node, 1));
  }

  return rows;
}

export function flattenVisibleTreeEntries(options: {
  nodes: FileTreeNode[];
  expandedFolders: Set<string>;
  rootExpanded: boolean;
}): VisibleTreeNodeEntry[] {
  const entries: VisibleTreeNodeEntry[] = [{ path: "", type: "root", depth: 0, node: null }];
  const visit = (node: FileTreeNode, depth: number) => {
    entries.push({ path: node.path, type: node.type, depth, node });
    if (node.type === "folder" && options.expandedFolders.has(node.path)) {
      node.children.forEach((child) => visit(child, depth + 1));
    }
  };
  if (options.rootExpanded) {
    options.nodes.forEach((node) => visit(node, 1));
  }
  return entries;
}
