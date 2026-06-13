import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import type { MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import TreePine from "lucide-react/dist/esm/icons/tree-pine";
import type { PanelTabId } from "../../layout/components/PanelTabs";
import {
  createWorkspaceDirectory,
  renameWorkspaceItem,
  writeWorkspaceFile,
  type WorkspaceDirectoryEntry,
} from "../../../services/tauri";
import type { GitFileStatus, OpenAppTarget } from "../../../types";
import {
  resolveGitRootWorkspacePrefix,
  resolveGitStatusPathCandidates,
} from "../../../utils/workspacePaths";
import {
  buildTree,
  collectDirectoryCacheSnapshot,
  filterDeletedFileTreePathFromSet,
  filterSuppressedFileTreePaths,
  flattenVisibleTree,
  flattenVisibleTreeEntries,
  getGitignoredFolderAncestorPaths,
  hasKnownFileTreeChild,
  isDirectlyGitignoredFolderPath,
  isGitignoredFileTreeNode,
  isSameOrDescendantFileTreePath,
  isSpecialDirectoryPath,
  isSuppressedFileTreePath,
  type FileTreeNode,
  type VisibleFileTreeRow,
} from "../utils/treeModel";
import { FilePreviewPopover } from "./FilePreviewPopover";
import { FileTreeContainer } from "./FileTreeContainer";
import { FileTreeRootActions } from "./FileTreeRootActions";
import { FileTreeRow } from "./FileTreeRow";
import { useLazyFileTree } from "../hooks/useLazyFileTree";
import { useFilePreview } from "../hooks/useFilePreview";
import { useTreeDialogs } from "../hooks/useTreeDialogs";
import { useTreeDrag } from "../hooks/useTreeDrag";
import { useTreeClipboard } from "../hooks/useTreeClipboard";
import { useFileTreeStore, useFileTreeStoreApi } from "../stores/fileTreeStoreContext";
import { RendererContextMenu } from "../../../components/ui/RendererContextMenu";

type FileTreePanelProps = {
  workspaceId: string;
  workspaceName?: string;
  workspacePath: string;
  gitRoot?: string | null;
  files: string[];
  directories?: string[];
  directoryMetadata?: WorkspaceDirectoryEntry[];
  isLoading: boolean;
  loadError?: string | null;
  filePanelMode: PanelTabId;
  onFilePanelModeChange: (mode: PanelTabId) => void;
  onInsertText?: (text: string) => void;
  onOpenFile?: (path: string, location?: FileOpenLocation) => void;
  openTargets: OpenAppTarget[];
  openAppIconById: Record<string, string>;
  selectedOpenAppId: string;
  onSelectOpenAppId: (id: string) => void;
  onToggleRuntimeConsole?: () => void;
  isRuntimeConsoleVisible?: boolean;
  onOpenSpecHub?: () => void;
  isSpecHubActive?: boolean;
  onOpenDetachedExplorer?: (initialFilePath?: string | null) => void;
  showSpecHubAction?: boolean;
  showDetachedExplorerAction?: boolean;
  crossWindowDragTargetLabel?: string | null;
  gitStatusFiles?: GitFileStatus[];
  gitignoredFiles?: Set<string>;
  gitignoredDirectories?: Set<string>;
  onRefreshFiles?: () => void | Promise<void>;
  activeEditorFilePath?: string | null;
};

type FileOpenLocation = {
  line: number;
  column: number;
};

const EMPTY_DIRECTORIES: string[] = [];
const EMPTY_SET: Set<string> = new Set();
const EMPTY_DIRECTORY_METADATA: WorkspaceDirectoryEntry[] = [];

function resolveWorkspaceRootLabel(workspacePath: string, workspaceName?: string) {
  const fromName = workspaceName?.trim();
  if (fromName) {
    return fromName;
  }
  const normalizedPath = workspacePath.replace(/[\\/]+$/, "");
  const segments = normalizedPath.split(/[\\/]/).filter(Boolean);
  return segments.at(-1) || normalizedPath || "workspace";
}

export function FileTreePanel({
  workspaceId,
  workspaceName,
  workspacePath,
  gitRoot = null,
  files,
  directories,
  directoryMetadata = EMPTY_DIRECTORY_METADATA,
  isLoading,
  loadError = null,
  filePanelMode: _filePanelMode,
  onFilePanelModeChange: _onFilePanelModeChange,
  onInsertText,
  onOpenFile,
  openTargets,
  openAppIconById,
  selectedOpenAppId,
  onSelectOpenAppId,
  onToggleRuntimeConsole: _onToggleRuntimeConsole,
  isRuntimeConsoleVisible: _isRuntimeConsoleVisible = false,
  onOpenSpecHub: _onOpenSpecHub,
  isSpecHubActive: _isSpecHubActive = false,
  onOpenDetachedExplorer,
  showSpecHubAction: _showSpecHubAction = true,
  showDetachedExplorerAction = true,
  crossWindowDragTargetLabel = null,
  gitStatusFiles,
  gitignoredFiles,
  gitignoredDirectories,
  onRefreshFiles,
  activeEditorFilePath = null,
}: FileTreePanelProps) {
  const directoryEntries = directories ?? EMPTY_DIRECTORIES;
  const ignoredFileEntries = gitignoredFiles ?? EMPTY_SET;
  const ignoredDirectoryEntries = gitignoredDirectories ?? EMPTY_SET;
  const { t } = useTranslation();
  const fileTreeStoreApi = useFileTreeStoreApi();
  const expandedFolders = useFileTreeStore((state) => state.expandedFolders);
  const rootExpanded = useFileTreeStore((state) => state.rootExpanded);
  const selectedNodePath = useFileTreeStore((state) => state.selectedPath);
  const selectedNodeType = useFileTreeStore((state) => state.selectedType);
  const selectedNodePaths = useFileTreeStore((state) => state.multiSelection);
  const selectionAnchorPath = useFileTreeStore((state) => state.selectionAnchor);
  const suppressedDeletedPaths = useFileTreeStore((state) => state.suppressedDeletedPaths);
  const directoryCache = useFileTreeStore((state) => state.directoryCache);
  const loadedLazyDirectories = useFileTreeStore((state) => state.loadedVisibleDirs);
  const loadingLazyDirectories = useFileTreeStore((state) => state.loadingVisibleDirs);
  const lazyDirectoryLoadErrors = useFileTreeStore((state) => state.visibleLoadErrors);
  const setExpandedFolders = useCallback(
    (folders: Set<string> | ((current: Set<string>) => Set<string>)) => {
      fileTreeStoreApi.getState().setExpandedFolders(folders);
    },
    [fileTreeStoreApi],
  );
  const setRootExpanded = useCallback(
    (expanded: boolean | ((current: boolean) => boolean)) => {
      fileTreeStoreApi.getState().setRootExpanded(expanded);
    },
    [fileTreeStoreApi],
  );
  const setSelectedNodePath = useCallback(
    (path: string | null) => {
      fileTreeStoreApi.getState().setSelectionState({ selectedPath: path });
    },
    [fileTreeStoreApi],
  );
  const setSelectedNodeType = useCallback(
    (type: "file" | "folder" | null) => {
      fileTreeStoreApi.getState().setSelectionState({ selectedType: type });
    },
    [fileTreeStoreApi],
  );
  const setSelectedNodePaths = useCallback(
    (selection: Set<string> | ((current: Set<string>) => Set<string>)) => {
      fileTreeStoreApi.getState().setMultiSelection(selection);
    },
    [fileTreeStoreApi],
  );
  const setSelectionAnchorPath = useCallback(
    (path: string | null) => {
      fileTreeStoreApi.getState().setSelectionState({ selectionAnchor: path });
    },
    [fileTreeStoreApi],
  );
  const setSuppressedDeletedPaths = useCallback(
    (paths: Set<string> | ((current: Set<string>) => Set<string>)) => {
      fileTreeStoreApi.getState().setSuppressedDeletedPaths(paths);
    },
    [fileTreeStoreApi],
  );
  const panelRef = useRef<HTMLElement | null>(null);
  const fileTreeScrollApiRef = useRef<{ scrollToIndex: (index: number) => void } | null>(null);
  const {
    resetLazyTreeState,
    loadLazyDirectoryChildren,
    purgeLazyDeletedPath,
    createExpandedLazyDirectoryReloader,
  } = useLazyFileTree({
    workspaceId,
    files,
    directories: directoryEntries,
    directoryMetadata,
    ignoredFiles: ignoredFileEntries,
    ignoredDirectories: ignoredDirectoryEntries,
    expandedFolders,
    setExpandedFolders,
  });
  const directoryCacheSnapshot = useMemo(
    () => collectDirectoryCacheSnapshot(directoryCache),
    [directoryCache],
  );

  const workspaceRootLabel = useMemo(
    () => resolveWorkspaceRootLabel(workspacePath, workspaceName),
    [workspaceName, workspacePath],
  );
  const gitRootWorkspacePrefix = useMemo(
    () => resolveGitRootWorkspacePrefix(workspacePath, gitRoot),
    [gitRoot, workspacePath],
  );
  const getFileTreeItemName = useCallback((relativePath: string) => {
    if (!relativePath) {
      return workspaceRootLabel;
    }
    return relativePath.split("/").filter(Boolean).pop() ?? relativePath;
  }, [workspaceRootLabel]);
  const {
    renamePrompt,
    setRenamePrompt,
    renameDraftName,
    setRenameDraftName,
    renameInputRef,
    openRenamePrompt,
    cancelRename,
    newFileParent,
    setNewFileParent,
    newFileName,
    setNewFileName,
    newFileInputRef,
    openNewFilePrompt,
    cancelNewFile,
    newFolderParent,
    setNewFolderParent,
    newFolderName,
    setNewFolderName,
    newFolderInputRef,
    openNewFolderPrompt,
    cancelNewFolder,
    resetDialogs,
  } = useTreeDialogs(getFileTreeItemName);
  const resolvePath = useCallback(
    (relativePath: string) => {
      const usesWindowsSeparator = workspacePath.includes("\\");
      const separator = usesWindowsSeparator ? "\\" : "/";
      const base = workspacePath.replace(/[\\/]+$/, "");
      const normalizedRelative = usesWindowsSeparator
        ? relativePath.replaceAll("/", "\\")
        : relativePath;
      return `${base}${separator}${normalizedRelative}`;
    },
    [workspacePath],
  );
  const preview = useFilePreview({
    workspaceId,
    resolvePath,
    onInsertText,
  });
  const closePreview = preview.close;
  const mergedFiles = useMemo(() => {
    const next = new Set<string>(files);
    directoryCacheSnapshot.files.forEach((path) => next.add(path));
    return Array.from(next).filter((path) => !isSuppressedFileTreePath(path, suppressedDeletedPaths));
  }, [directoryCacheSnapshot.files, files, suppressedDeletedPaths]);
  const mergedDirectories = useMemo(() => {
    const next = new Set<string>(directoryEntries);
    directoryCacheSnapshot.directories.forEach((path) => next.add(path));
    return Array.from(next).filter((path) => !isSuppressedFileTreePath(path, suppressedDeletedPaths));
  }, [directoryCacheSnapshot.directories, directoryEntries, suppressedDeletedPaths]);
  const mergedGitignoredFiles = useMemo(() => {
    const next = new Set<string>(ignoredFileEntries);
    return filterSuppressedFileTreePaths(next, suppressedDeletedPaths);
  }, [ignoredFileEntries, suppressedDeletedPaths]);
  const mergedGitignoredDirectories = useMemo(() => {
    const next = new Set<string>(ignoredDirectoryEntries);
    return filterSuppressedFileTreePaths(next, suppressedDeletedPaths);
  }, [ignoredDirectoryEntries, suppressedDeletedPaths]);
  const directoryMetadataByPath = useMemo(() => {
    const next = new Map<string, WorkspaceDirectoryEntry>();
    directoryMetadata.forEach((entry) => {
      if (entry.path && !isSuppressedFileTreePath(entry.path, suppressedDeletedPaths)) {
        next.set(entry.path, entry);
      }
    });
    directoryCacheSnapshot.metadataByPath.forEach((entry, path) => {
      if (!isSuppressedFileTreePath(path, suppressedDeletedPaths)) {
        next.set(path, entry);
      }
    });
    return next;
  }, [directoryCacheSnapshot.metadataByPath, directoryMetadata, suppressedDeletedPaths]);
  const seededLazyLoadableDirectories = useMemo(() => {
    const result = new Set<string>();
    mergedDirectories.forEach((path) => {
      if (isSpecialDirectoryPath(path)) {
        result.add(path);
      }
      const childState = directoryMetadataByPath.get(path)?.child_state;
      if (
        childState === "unknown" ||
        childState === "partial" ||
        (childState === undefined &&
          !path.includes("/") &&
          !hasKnownFileTreeChild(path, mergedFiles, mergedDirectories))
      ) {
        result.add(path);
      }
    });
    return result;
  }, [directoryMetadataByPath, mergedDirectories, mergedFiles]);
  const hasTreeEntries = mergedFiles.length > 0 || mergedDirectories.length > 0;
  const showLoading = isLoading && !hasTreeEntries;
  const normalizedLoadError =
    typeof loadError === "string" && loadError.trim().length > 0 ? loadError.trim() : null;

  const gitStatusMap = useMemo(() => {
    const map = new Map<string, string>();
    if (gitStatusFiles) {
      for (const entry of gitStatusFiles) {
        const entryPath = entry.path?.trim();
        const entryStatus = entry.status?.trim();
        if (!entryPath || !entryStatus) {
          continue;
        }
        resolveGitStatusPathCandidates(
          workspacePath,
          gitRootWorkspacePrefix,
          entryPath,
        ).forEach((path) => map.set(path, entryStatus));
      }
    }
    return map;
  }, [gitRootWorkspacePrefix, gitStatusFiles, workspacePath]);

  const { nodes, folderPaths } = useMemo(
    () => buildTree(
      mergedFiles,
      mergedDirectories,
      seededLazyLoadableDirectories,
      directoryMetadataByPath,
    ),
    [
      seededLazyLoadableDirectories,
      directoryMetadataByPath,
      mergedDirectories,
      mergedFiles,
    ],
  );
  useEffect(() => {
    fileTreeStoreApi.getState().setTreeData(nodes, folderPaths);
  }, [fileTreeStoreApi, folderPaths, nodes]);

  const gitignoredTreeNodeMap = useMemo(() => {
    const memo = new Map<string, boolean>();
    nodes.forEach((node) => {
      isGitignoredFileTreeNode(
        node,
        mergedGitignoredFiles,
        mergedGitignoredDirectories,
        memo,
      );
    });
    return memo;
  }, [mergedGitignoredDirectories, mergedGitignoredFiles, nodes]);
  const gitignoredFolderAncestorPaths = useMemo(
    () => getGitignoredFolderAncestorPaths(folderPaths, mergedGitignoredDirectories),
    [folderPaths, mergedGitignoredDirectories],
  );
  const effectiveExpandedFolders = useMemo(() => {
    if (gitignoredFolderAncestorPaths.size === 0) {
      return expandedFolders;
    }
    const next = new Set(expandedFolders);
    gitignoredFolderAncestorPaths.forEach((path) => {
      if (folderPaths.has(path)) {
        next.add(path);
      }
    });
    return next;
  }, [expandedFolders, folderPaths, gitignoredFolderAncestorPaths]);
  const folderGitStatusMap = useMemo(() => {
    if (!gitStatusFiles || gitStatusFiles.length === 0) {
      return new Map<string, string>();
    }
    const priority: Record<string, number> = { D: 4, A: 3, M: 2, R: 1, T: 0 };
    const map = new Map<string, string>();
    const assignIfHigherPriority = (folderPath: string, status: string) => {
      const nextStatus = status.trim().toUpperCase();
      const nextPriority = priority[nextStatus];
      if (nextPriority === undefined) {
        return;
      }
      const current = map.get(folderPath);
      const currentPriority = current ? (priority[current] ?? -1) : -1;
      if (nextPriority > currentPriority) {
        map.set(folderPath, nextStatus);
      }
    };

    for (const entry of gitStatusFiles) {
      const entryPath = entry.path?.trim();
      const entryStatus = entry.status?.trim();
      if (!entryPath || !entryStatus) {
        continue;
      }
      const pathCandidates = resolveGitStatusPathCandidates(
        workspacePath,
        gitRootWorkspacePrefix,
        entryPath,
      );
      pathCandidates.forEach((candidatePath) => {
        const segments = candidatePath.split("/").filter(Boolean);
        if (segments.length <= 1) {
          return;
        }
        let folderPath = "";
        for (let index = 0; index < segments.length - 1; index += 1) {
          const segment = segments[index] ?? "";
          folderPath = folderPath
            ? `${folderPath}/${segment}`
            : segment;
          assignIfHigherPriority(folderPath, entryStatus);
        }
      });
    }

    return map;
  }, [gitRootWorkspacePrefix, gitStatusFiles, workspacePath]);

  const isRootVisibleExpanded = rootExpanded;
  const visibleTreeNodeEntries = useMemo(
    () =>
      flattenVisibleTreeEntries({
        nodes,
        expandedFolders: effectiveExpandedFolders,
        rootExpanded,
      }),
    [effectiveExpandedFolders, nodes, rootExpanded],
  );
  const visibleFileTreeRows = useMemo(
    () =>
      flattenVisibleTree({
        nodes,
        expandedFolders: effectiveExpandedFolders,
        rootExpanded,
        loadingLazyDirectories,
        lazyDirectoryLoadErrors,
      }),
    [
      effectiveExpandedFolders,
      lazyDirectoryLoadErrors,
      loadingLazyDirectories,
      nodes,
      rootExpanded,
    ],
  );
  const visibleTreePathOrder = useMemo(
    () => visibleTreeNodeEntries.map((entry) => entry.path),
    [visibleTreeNodeEntries],
  );
  const visibleTreePathTypeMap = useMemo(
    () =>
      new Map<string, "file" | "folder" | "root">(
        visibleTreeNodeEntries.map((entry) => [entry.path, entry.type]),
      ),
    [visibleTreeNodeEntries],
  );
  const allTreeNodePaths = useMemo(() => {
    const result = new Set<string>([""]);
    const visit = (node: FileTreeNode) => {
      result.add(node.path);
      if (node.type === "folder") {
        node.children.forEach(visit);
      }
    };
    nodes.forEach(visit);
    return result;
  }, [nodes]);

  const setSingleSelection = useCallback((path: string, type: "file" | "folder" | "root") => {
    setSelectedNodePaths(new Set([path]));
    setSelectedNodePath(path);
    setSelectedNodeType(type === "root" ? "folder" : type);
    setSelectionAnchorPath(path);
  }, [setSelectedNodePath, setSelectedNodePaths, setSelectedNodeType, setSelectionAnchorPath]);

  const setRangeSelection = useCallback(
    (targetPath: string, targetType: "file" | "folder" | "root") => {
      const anchorPath = selectionAnchorPath ?? selectedNodePath ?? targetPath;
      const anchorIndex = visibleTreePathOrder.indexOf(anchorPath);
      const targetIndex = visibleTreePathOrder.indexOf(targetPath);
      if (anchorIndex < 0 || targetIndex < 0) {
        setSingleSelection(targetPath, targetType);
        return;
      }
      const start = Math.min(anchorIndex, targetIndex);
      const end = Math.max(anchorIndex, targetIndex);
      const rangePaths = visibleTreePathOrder.slice(start, end + 1);
      setSelectedNodePaths(new Set(rangePaths));
      setSelectedNodePath(targetPath);
      setSelectedNodeType(targetType === "root" ? "folder" : targetType);
    },
    [
      selectedNodePath,
      selectionAnchorPath,
      setSelectedNodePath,
      setSelectedNodePaths,
      setSelectedNodeType,
      setSingleSelection,
      visibleTreePathOrder,
    ],
  );

  const togglePathSelection = useCallback((path: string, type: "file" | "folder" | "root") => {
    setSelectedNodePaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      const fallbackPath = next.has(path)
        ? path
        : visibleTreePathOrder.find((entryPath) => next.has(entryPath)) ?? null;
      setSelectedNodePath(fallbackPath);
      setSelectedNodeType(
        fallbackPath ? ((visibleTreePathTypeMap.get(fallbackPath) ?? type) === "root" ? "folder" : (visibleTreePathTypeMap.get(fallbackPath) ?? type) as "file" | "folder") : null,
      );
      setSelectionAnchorPath(path);
      return next;
    });
  }, [
    setSelectedNodePath,
    setSelectedNodePaths,
    setSelectedNodeType,
    setSelectionAnchorPath,
    visibleTreePathOrder,
    visibleTreePathTypeMap,
  ]);

  useEffect(() => {
    setExpandedFolders((prev) => {
      // Keep only folders that still exist; default is all collapsed.
      const next = new Set<string>();
      prev.forEach((path) => {
        if (folderPaths.has(path)) {
          next.add(path);
        }
      });
      if (next.size === prev.size && [...next].every((path) => prev.has(path))) {
        return prev;
      }
      return next;
    });
  }, [folderPaths]);

  useEffect(() => {
    if (gitignoredFolderAncestorPaths.size === 0) {
      return;
    }
    setExpandedFolders((prev) => {
      let changed = false;
      const next = new Set(prev);
      gitignoredFolderAncestorPaths.forEach((path) => {
        if (!folderPaths.has(path) || next.has(path)) {
          return;
        }
        next.add(path);
        changed = true;
      });
      return changed ? next : prev;
    });
  }, [folderPaths, gitignoredFolderAncestorPaths]);

  useEffect(() => {
    setSelectedNodePaths((prev) => {
      if (prev.size === 0) {
        return prev;
      }
      let changed = false;
      const next = new Set<string>();
      prev.forEach((path) => {
        if (allTreeNodePaths.has(path)) {
          next.add(path);
        } else {
          changed = true;
        }
      });
      if (!changed) {
        return prev;
      }
      const nextPrimaryPath =
        selectedNodePath && next.has(selectedNodePath)
          ? selectedNodePath
          : visibleTreePathOrder.find((path) => next.has(path)) ?? null;
      setSelectedNodePath(nextPrimaryPath);
      setSelectedNodeType(
        nextPrimaryPath
          ? (visibleTreePathTypeMap.get(nextPrimaryPath) === "file" ? "file" : "folder")
          : null,
      );
      if (selectionAnchorPath && !next.has(selectionAnchorPath)) {
        setSelectionAnchorPath(nextPrimaryPath);
      }
      return next;
    });
  }, [
    allTreeNodePaths,
    selectedNodePath,
    selectionAnchorPath,
    setSelectedNodePath,
    setSelectedNodePaths,
    setSelectedNodeType,
    setSelectionAnchorPath,
    visibleTreePathOrder,
    visibleTreePathTypeMap,
  ]);

  // --- Sync file tree with active editor file ---
  const pendingEditorScrollRef = useRef<string | null>(null);

  // Lookup: path → FileTreeNode for folder nodes (used to check isLazyLoadable).
  const folderNodeMap = useMemo(() => {
    const map = new Map<string, FileTreeNode>();
    const visit = (node: FileTreeNode) => {
      if (node.type === "folder") {
        map.set(node.path, node);
        node.children.forEach(visit);
      }
    };
    nodes.forEach(visit);
    return map;
  }, [nodes]);

  // Phase 1: when activeEditorFilePath changes, expand ancestor folders and trigger lazy loads.
  useEffect(() => {
    if (!activeEditorFilePath) return;
    const segments = activeEditorFilePath.split("/").filter(Boolean);
    if (segments.length <= 1) return;
    const ancestorFolders: string[] = [];
    for (let i = 1; i < segments.length; i++) {
      ancestorFolders.push(segments.slice(0, i).join("/"));
    }
    pendingEditorScrollRef.current = activeEditorFilePath;
    let needsLazyLoad = false;
    setExpandedFolders((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const folder of ancestorFolders) {
        if (folderPaths.has(folder) && !next.has(folder)) {
          next.add(folder);
          changed = true;
        }
        if (!loadedLazyDirectories.has(folder) && !loadingLazyDirectories.has(folder)) {
          const node = folderNodeMap.get(folder);
          if (node && (node.isLazyLoadable ?? false)) {
            needsLazyLoad = true;
          }
        }
      }
      return changed ? next : prev;
    });
    if (needsLazyLoad) {
      for (const folder of ancestorFolders) {
        if (!loadedLazyDirectories.has(folder) && !loadingLazyDirectories.has(folder)) {
          const node = folderNodeMap.get(folder);
          if (node && (node.isLazyLoadable ?? false)) {
            void loadLazyDirectoryChildren(folder);
          }
        }
      }
    }
  }, [activeEditorFilePath, folderPaths, folderNodeMap, loadedLazyDirectories, loadingLazyDirectories, loadLazyDirectoryChildren]);

  // Phase 2: once rows recompute after expansion/lazy-load, scroll or trigger next lazy load.
  useEffect(() => {
    const filePath = pendingEditorScrollRef.current;
    if (!filePath) return;
    const idx = visibleFileTreeRows.findIndex(
      (r) => r.kind === "node" && r.entry.path === filePath,
    );
    if (idx >= 0) {
      pendingEditorScrollRef.current = null;
      fileTreeScrollApiRef.current?.scrollToIndex(idx);
      return;
    }
    // File not visible yet — check if an intermediate lazy folder just finished loading
    // and now its child folders need expanding / loading.
    const segments = filePath.split("/").filter(Boolean);
    const ancestorFolders: string[] = [];
    for (let i = 1; i < segments.length; i++) {
      ancestorFolders.push(segments.slice(0, i).join("/"));
    }
    let expandedChanged = false;
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      for (const folder of ancestorFolders) {
        if (folderPaths.has(folder) && !next.has(folder)) {
          next.add(folder);
          expandedChanged = true;
        }
      }
      return expandedChanged ? next : prev;
    });
    for (const folder of ancestorFolders) {
      if (!loadedLazyDirectories.has(folder) && !loadingLazyDirectories.has(folder)) {
        const node = folderNodeMap.get(folder);
        if (node && (node.isLazyLoadable ?? false)) {
          void loadLazyDirectoryChildren(folder);
        }
      }
    }
  }, [visibleFileTreeRows, folderPaths, folderNodeMap, loadedLazyDirectories, loadingLazyDirectories, loadLazyDirectoryChildren]);

  useEffect(() => {
    closePreview();
    resetLazyTreeState();
    resetDialogs();
    setSuppressedDeletedPaths(new Set());
    setRootExpanded(true);
    setSelectedNodePath(null);
    setSelectedNodeType(null);
    setSelectedNodePaths(new Set());
    setSelectionAnchorPath(null);
  }, [
    resetLazyTreeState,
    resetDialogs,
    closePreview,
    setRootExpanded,
    setSelectedNodePath,
    setSelectedNodePaths,
    setSelectedNodeType,
    setSelectionAnchorPath,
    setSuppressedDeletedPaths,
    workspaceId,
  ]);

  const expandedFoldersRef = useRef(expandedFolders);
  expandedFoldersRef.current = expandedFolders;

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const toggleFolderExpandedState = useCallback(
    (path: string, isLazyFolder: boolean) => {
      const shouldExpand = !expandedFoldersRef.current.has(path);
      toggleFolder(path);
      if (shouldExpand && isLazyFolder) {
        void loadLazyDirectoryChildren(path);
      }
    },
    [toggleFolder, loadLazyDirectoryChildren],
  );

  const selectionHints = useMemo(
    () =>
      preview.kind === "text"
        ? [t("files.selectionHintShiftClick"), t("files.selectionHintMultiLine")]
        : [],
    [preview.kind, t],
  );

  useEffect(() => {
    setSuppressedDeletedPaths((prev) => {
      if (prev.size === 0) {
        return prev;
      }
      let changed = false;
      const next = new Set(prev);
      prev.forEach((deletedPath) => {
        const stillPresent =
          files.some((path) => isSameOrDescendantFileTreePath(path, deletedPath)) ||
          directoryEntries.some((path) => isSameOrDescendantFileTreePath(path, deletedPath)) ||
          Array.from(directoryCacheSnapshot.files).some((path) =>
            isSameOrDescendantFileTreePath(path, deletedPath),
          ) ||
          Array.from(directoryCacheSnapshot.directories).some((path) =>
            isSameOrDescendantFileTreePath(path, deletedPath),
          );
        if (!stillPresent) {
          next.delete(deletedPath);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [directoryCacheSnapshot.directories, directoryCacheSnapshot.files, directoryEntries, files]);

  const purgeDeletedFileTreePath = useCallback(
    (deletedPath: string) => {
      setSuppressedDeletedPaths((prev) => {
        if (prev.has(deletedPath)) {
          return prev;
        }
        return new Set(prev).add(deletedPath);
      });
      setExpandedFolders((prev) => filterDeletedFileTreePathFromSet(prev, deletedPath));
      purgeLazyDeletedPath(deletedPath);
      setSelectedNodePaths((prev) => {
        const next = filterDeletedFileTreePathFromSet(prev, deletedPath);
        if (next === prev) {
          return prev;
        }
        const nextPrimaryPath =
          selectedNodePath && next.has(selectedNodePath)
            ? selectedNodePath
            : visibleTreePathOrder.find((path) => next.has(path)) ?? null;
        setSelectedNodePath(nextPrimaryPath);
        setSelectedNodeType(
          nextPrimaryPath
            ? (visibleTreePathTypeMap.get(nextPrimaryPath) === "file" ? "file" : "folder")
            : null,
        );
        if (
          selectionAnchorPath &&
          isSameOrDescendantFileTreePath(selectionAnchorPath, deletedPath)
        ) {
          setSelectionAnchorPath(nextPrimaryPath);
        }
        return next;
      });
      setRenamePrompt((prev) =>
        prev && isSameOrDescendantFileTreePath(prev.path, deletedPath) ? null : prev,
      );
      setNewFileParent((prev) =>
        prev && isSameOrDescendantFileTreePath(prev, deletedPath) ? null : prev,
      );
      setNewFolderParent((prev) =>
        prev && isSameOrDescendantFileTreePath(prev, deletedPath) ? null : prev,
      );
      if (preview.path && isSameOrDescendantFileTreePath(preview.path, deletedPath)) {
        closePreview();
      }
    },
    [
      closePreview,
      preview.path,
      selectedNodePath,
      selectionAnchorPath,
      setExpandedFolders,
      purgeLazyDeletedPath,
      visibleTreePathOrder,
      visibleTreePathTypeMap,
      setSelectedNodePath,
      setSelectedNodePaths,
      setSelectedNodeType,
      setSelectionAnchorPath,
      setSuppressedDeletedPaths,
    ],
  );

  const resolveParentFolderForNode = useCallback(
    (relativePath: string | null, nodeType: "file" | "folder" | null) => {
      if (!relativePath) {
        return "";
      }
      if (nodeType === "folder") {
        return relativePath;
      }
      const separatorIndex = relativePath.lastIndexOf("/");
      return separatorIndex >= 0 ? relativePath.slice(0, separatorIndex) : "";
    },
    [],
  );

  const treeClipboard = useTreeClipboard({
    workspaceId,
    getFileTreeItemName,
    resolvePath,
    resolveParentFolderForNode,
    onInsertText,
    onRefreshFiles,
    selectSingle: setSingleSelection,
    purgeDeletedFileTreePath,
    openRenamePrompt,
    openNewFilePrompt,
    openNewFolderPrompt,
    t,
  });
  const {
    normalizeOperationError,
    showOperationNotice,
    copyPath,
    trashItem,
    showContextMenu,
  } = treeClipboard;

  const confirmRename = useCallback(async () => {
    const prompt = renamePrompt;
    const name = renameDraftName.trim();
    if (!prompt || !name) {
      showOperationNotice("error", t("files.renameInvalidName"));
      return;
    }
    try {
      const result = await renameWorkspaceItem(workspaceId, prompt.path, name);
      setSelectedNodePath(result.path);
      setSelectedNodeType(result.kind === "folder" ? "folder" : "file");
      setSelectedNodePaths(new Set([result.path]));
      setRenamePrompt(null);
      setRenameDraftName("");
      showOperationNotice("success", t("files.renameComplete"));
      onRefreshFiles?.();
    } catch (error) {
      showOperationNotice("error", t("files.renameFailed", { message: normalizeOperationError(error) }));
    }
  }, [
    normalizeOperationError,
    onRefreshFiles,
    renameDraftName,
    renamePrompt,
    showOperationNotice,
    t,
    workspaceId,
  ]);

  const confirmNewFile = useCallback(async () => {
    const name = newFileName.trim();
    if (!name || newFileParent === null) {
      cancelNewFile();
      return;
    }
    const relativePath = newFileParent ? `${newFileParent}/${name}` : name;
    try {
      await writeWorkspaceFile(workspaceId, relativePath, "");
      showOperationNotice("success", t("files.createFileComplete"));
      onRefreshFiles?.();
    } catch (error) {
      showOperationNotice("error", t("files.createFileFailed", { message: normalizeOperationError(error) }));
    }
    cancelNewFile();
  }, [
    cancelNewFile,
    newFileName,
    newFileParent,
    workspaceId,
    onRefreshFiles,
    showOperationNotice,
    t,
    normalizeOperationError,
  ]);

  const confirmNewFolder = useCallback(async () => {
    const name = newFolderName.trim();
    if (!name || newFolderParent === null) {
      cancelNewFolder();
      return;
    }
    const relativePath = newFolderParent ? `${newFolderParent}/${name}` : name;
    try {
      await createWorkspaceDirectory(workspaceId, relativePath);
      showOperationNotice("success", t("files.createFolderComplete"));
      onRefreshFiles?.();
    } catch (error) {
      showOperationNotice("error", t("files.createFolderFailed", { message: normalizeOperationError(error) }));
    }
    cancelNewFolder();
  }, [
    cancelNewFolder,
    newFolderName,
    newFolderParent,
    workspaceId,
    onRefreshFiles,
    showOperationNotice,
    t,
    normalizeOperationError,
  ]);

  const detachedInitialFilePath = selectedNodeType === "file" ? selectedNodePath : null;
  const orderedSelectedNodePaths = useMemo(
    () =>
      visibleTreePathOrder.filter((path) => path.length > 0 && selectedNodePaths.has(path)),
    [selectedNodePaths, visibleTreePathOrder],
  );
  const treeDrag = useTreeDrag({
    crossWindowDragTargetLabel,
    orderedSelectedNodePaths,
    resolvePath,
    setSingleSelection,
  });

  const handleRefreshFiles = useCallback(() => {
    const reloadExpandedLazyDirectories = createExpandedLazyDirectoryReloader();
    const refreshResult = onRefreshFiles?.();
    if (refreshResult !== undefined) {
      void Promise.resolve(refreshResult).finally(reloadExpandedLazyDirectories);
      return;
    }
    reloadExpandedLazyDirectories();
  }, [createExpandedLazyDirectoryReloader, onRefreshFiles]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!selectedNodePath || !selectedNodeType) {
        return;
      }
      const target = event.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
        return;
      }
      // Ensure the event originates within the file tree panel
      if (panelRef.current && !panelRef.current.contains(target)) {
        return;
      }

      const isMac = navigator.platform.includes("Mac");
      const primaryModifier = isMac ? event.metaKey : event.ctrlKey;

      // Cmd+Delete / Ctrl+Delete → trash
      if (primaryModifier && (event.key === "Delete" || event.key === "Backspace")) {
        event.preventDefault();
        void trashItem(selectedNodePath, selectedNodeType === "folder");
        return;
      }

      // Cmd+C / Ctrl+C → copy path
      if (primaryModifier && !event.shiftKey && event.key.toLowerCase() === "c") {
        event.preventDefault();
        void copyPath(selectedNodePath);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedNodePath, selectedNodeType, trashItem, copyPath]);

  const handleTreeRowSelect = useCallback(
    (node: FileTreeNode, event: MouseEvent<HTMLButtonElement>) => {
      const isToggleSelect = event.metaKey || event.ctrlKey;
      if (event.shiftKey) {
        setRangeSelection(node.path, node.type);
        return;
      }
      if (isToggleSelect) {
        togglePathSelection(node.path, node.type);
        return;
      }
      setSingleSelection(node.path, node.type);
    },
    [setRangeSelection, setSingleSelection, togglePathSelection],
  );

  const handleTreeRowOpen = useCallback(
    (
      node: FileTreeNode,
      event: MouseEvent<HTMLButtonElement>,
      canExpand: boolean,
      isLazyFolder: boolean,
    ) => {
      event.preventDefault();
      if (node.type === "folder") {
        if (!canExpand) {
          return;
        }
        toggleFolderExpandedState(node.path, isLazyFolder);
        return;
      }
      if (onOpenFile) {
        onOpenFile(node.path);
        return;
      }
      preview.open(node.path, event.currentTarget);
    },
    [onOpenFile, preview.open, toggleFolderExpandedState],
  );

  const handleTreeRowContextMenu = useCallback(
    (node: FileTreeNode, event: MouseEvent<HTMLButtonElement>) => {
      if (!selectedNodePaths.has(node.path)) {
        setSingleSelection(node.path, node.type);
      } else {
        setSelectedNodePath(node.path);
        setSelectedNodeType(node.type);
      }
      showContextMenu(event, node.path, node.type === "folder");
    },
    [selectedNodePaths, setSingleSelection, showContextMenu],
  );

  const handleTreeRowToggleExpanded = useCallback(
    (node: FileTreeNode, isLazyFolder: boolean) => {
      toggleFolderExpandedState(node.path, isLazyFolder);
    },
    [toggleFolderExpandedState],
  );

  const handleTreeRowMention = useCallback(
    (node: FileTreeNode, event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      const absolutePath = resolvePath(node.path);
      if (typeof window !== "undefined" && window.handleFilePathFromJava) {
        window.handleFilePathFromJava(absolutePath);
        return;
      }
      const mentionText = `@${absolutePath}${node.type === "file" ? " " : ""}`;
      onInsertText?.(mentionText);
    },
    [onInsertText, resolvePath],
  );

  const renderFileTreeRow = useCallback(
    (row: VisibleFileTreeRow) => {
      if (row.kind === "lazy-state") {
        if (row.state === "loading") {
          return (
            <div
              className="file-tree-lazy-state"
              style={{ paddingLeft: `${row.depth * 10 + 16}px` }}
            >
              {t("files.loadingFiles")}
            </div>
          );
        }
        if (row.state === "error") {
          return (
            <button
              type="button"
              className="file-tree-lazy-retry"
              style={{ marginLeft: `${row.depth * 10}px` }}
              onClick={() => void loadLazyDirectoryChildren(row.path)}
              title={row.error ?? undefined}
            >
              {t("files.retryLoadFiles")}
            </button>
          );
        }
        return (
          <div
            className="file-tree-lazy-state"
            style={{ paddingLeft: `${row.depth * 10 + 16}px` }}
          >
            {t("files.noFilesAvailable")}
          </div>
        );
      }

      const node = row.entry.node;
      const depth = row.entry.depth;
      const isFolder = node.type === "folder";
      const isLazyFolder = isFolder && (node.isLazyLoadable ?? false);
      const hasChildren = isFolder && node.children.length > 0;
      const canExpand = isFolder && (hasChildren || isLazyFolder);
      const isExpanded = canExpand && expandedFolders.has(node.path);
      const rawGitStatus = isFolder
        ? folderGitStatusMap.get(node.path) ?? null
        : gitStatusMap.get(node.path) ?? null;
      const fileGitStatus =
        isFolder && rawGitStatus?.toUpperCase() === "D"
          ? "M"
          : rawGitStatus;
      const gitStatusClass = fileGitStatus
        ? ` git-${fileGitStatus.toLowerCase()}`
        : "";
      const isGitignored = isFolder
        ? isDirectlyGitignoredFolderPath(node.path, mergedGitignoredDirectories) ||
          gitignoredTreeNodeMap.get(node.path) === true
        : mergedGitignoredFiles.has(node.path);
      const isSelected = selectedNodePaths.has(node.path);
      const isPrimarySelection = selectedNodePath === node.path;
      const isEditorActive = activeEditorFilePath === node.path;

      return (
        <FileTreeRow
          node={node}
          depth={depth}
          isExpanded={isExpanded}
          canExpand={canExpand}
          isLazyFolder={isLazyFolder}
          gitStatusClass={gitStatusClass}
          isGitignored={isGitignored}
          isSelected={isSelected}
          isPrimarySelection={isPrimarySelection}
          isEditorActive={isEditorActive}
          mentionAriaLabel={t("files.mentionFile", { name: node.name })}
          mentionTitle={t("files.mentionInChat")}
          onSelect={handleTreeRowSelect}
          onOpen={handleTreeRowOpen}
          onContextMenu={handleTreeRowContextMenu}
          onToggleExpanded={handleTreeRowToggleExpanded}
          onDragStart={treeDrag.handleDragStart}
          onDrag={treeDrag.handleDrag}
          onDragEnd={treeDrag.handleDragEnd}
          onMention={handleTreeRowMention}
        />
      );
    },
    [
      t,
      loadLazyDirectoryChildren,
      expandedFolders,
      folderGitStatusMap,
      gitStatusMap,
      mergedGitignoredDirectories,
      mergedGitignoredFiles,
      gitignoredTreeNodeMap,
      selectedNodePaths,
      selectedNodePath,
      activeEditorFilePath,
      handleTreeRowSelect,
      handleTreeRowOpen,
      handleTreeRowContextMenu,
      handleTreeRowToggleExpanded,
      treeDrag.handleDragStart,
      treeDrag.handleDrag,
      treeDrag.handleDragEnd,
      handleTreeRowMention,
    ],
  );
  const handleFileTreeRowsReady = useCallback((api: { scrollToIndex: (index: number) => void }) => {
    fileTreeScrollApiRef.current = api;
  }, []);

  return (
    <aside className="diff-panel file-tree-panel" ref={panelRef}>
      <div className="file-tree-top-zone">
        <div className="file-tree-root-row">
          <div className="file-tree-root-wrap">
            <button
              type="button"
              className={`file-tree-row is-folder is-root${selectedNodePaths.has("") ? " is-selected" : ""}${selectedNodePath === "" ? " is-primary" : ""}`}
              onClick={() => {
                setSingleSelection("", "root");
                setRootExpanded((prev) => !prev);
              }}
              onContextMenu={(event) => {
                if (!selectedNodePaths.has("")) {
                  setSingleSelection("", "root");
                } else {
                  setSelectedNodePath("");
                  setSelectedNodeType("folder");
                }
                showContextMenu(event, "", true);
              }}
            >
              <span
                className={`file-tree-chevron file-tree-root-chevron${isRootVisibleExpanded ? " is-open" : ""}`}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setRootExpanded((prev) => !prev);
                }}
              >
                ›
              </span>
              <span className="file-tree-icon file-tree-icon-root-special" aria-hidden>
                <TreePine size={13} />
              </span>
              <span className="file-tree-name">{workspaceRootLabel}</span>
            </button>
          </div>
          <FileTreeRootActions
            onOpenDetachedExplorer={onOpenDetachedExplorer}
            detachedInitialFilePath={detachedInitialFilePath}
            onRefreshFiles={onRefreshFiles ? handleRefreshFiles : undefined}
            showDetachedExplorerAction={showDetachedExplorerAction}
          />
        </div>
      </div>
      <FileTreeContainer
        rows={visibleFileTreeRows}
        isRootExpanded={isRootVisibleExpanded}
        isLoading={showLoading}
        hasTreeEntries={hasTreeEntries}
        loadError={normalizedLoadError}
        loadingLabel={t("files.loadingFiles")}
        emptyLabel={t("files.noFilesAvailable")}
        loadErrorLabel={t("files.loadFilesFailed")}
        retryLabel={t("files.retryLoadFiles")}
        onRetry={onRefreshFiles ? handleRefreshFiles : undefined}
        renderRow={renderFileTreeRow}
        onRowsReady={handleFileTreeRowsReady}
      />
      {preview.path && preview.anchor
        ? createPortal(
            <FilePreviewPopover
              path={preview.path}
              absolutePath={resolvePath(preview.path)}
              content={preview.content}
              truncated={preview.truncated}
              previewKind={preview.kind}
              imageSrc={preview.imageSrc}
              openTargets={openTargets}
              openAppIconById={openAppIconById}
              selectedOpenAppId={selectedOpenAppId}
              onSelectOpenAppId={onSelectOpenAppId}
              selection={preview.selection}
              onSelectLine={preview.selectLine}
              onLineMouseDown={preview.lineMouseDown}
              onLineMouseEnter={preview.lineMouseEnter}
              onLineMouseUp={preview.lineMouseUp}
              onClearSelection={() => preview.setSelection(null)}
              onAddSelection={preview.addSelection}
              onClose={closePreview}
              selectionHints={selectionHints}
              style={{
                position: "fixed",
                top: preview.anchor.top,
                left: preview.anchor.left,
                width: 640,
                maxHeight: preview.anchor.height,
                ["--file-preview-arrow-top" as string]: `${preview.anchor.arrowTop}px`,
              }}
              isLoading={preview.loading}
              error={preview.error}
            />,
            document.body,
          )
        : null}
      {treeClipboard.contextMenu ? (
        <RendererContextMenu
          menu={treeClipboard.contextMenu}
          onClose={() => treeClipboard.setContextMenu(null)}
          className="renderer-context-menu file-tree-context-menu"
        />
      ) : null}
      {treeClipboard.operationNotice ? (
        <div
          className={`file-tree-operation-notice is-${treeClipboard.operationNotice.tone}`}
          role={treeClipboard.operationNotice.tone === "error" ? "alert" : "status"}
        >
          {treeClipboard.operationNotice.message}
        </div>
      ) : null}
      {renamePrompt !== null && (
        <div className="new-file-prompt" role="dialog" aria-modal="true">
          <div className="new-file-prompt-backdrop" onClick={cancelRename} />
          <div className="new-file-prompt-card">
            <div className="new-file-prompt-title">{t("files.renameItem")}</div>
            <input
              id="rename-file-tree-item"
              ref={renameInputRef}
              className="new-file-prompt-input"
              value={renameDraftName}
              onChange={(event) => setRenameDraftName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void confirmRename();
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  cancelRename();
                }
              }}
              placeholder={t("files.renameNamePlaceholder")}
              aria-label={t("files.renameNamePlaceholder")}
            />
            <div className="new-file-prompt-actions">
              <button type="button" onClick={cancelRename}>
                {t("files.cancel")}
              </button>
              <button type="button" onClick={() => void confirmRename()}>
                {t("files.renameItem")}
              </button>
            </div>
          </div>
        </div>
      )}
      {newFileParent !== null && (
        <div className="new-file-prompt" role="dialog" aria-modal="true">
          <div className="new-file-prompt-backdrop" onClick={cancelNewFile} />
          <div className="new-file-prompt-card">
            <div className="new-file-prompt-title">{t("files.newFile")}</div>
            {newFileParent && (
              <div className="new-file-prompt-path">{newFileParent}/</div>
            )}
            <input
              id="new-file-name"
              ref={newFileInputRef}
              className="new-file-prompt-input"
              placeholder={t("files.newFileNamePlaceholder")}
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  cancelNewFile();
                }
                if (e.key === "Enter" && newFileName.trim()) {
                  e.preventDefault();
                  void confirmNewFile();
                }
              }}
            />
            <div className="new-file-prompt-actions">
              <button type="button" className="ghost" onClick={cancelNewFile}>
                {t("files.cancel")}
              </button>
              <button
                type="button"
                className="primary"
                disabled={!newFileName.trim()}
                onClick={() => void confirmNewFile()}
              >
                {t("files.newFile")}
              </button>
            </div>
          </div>
        </div>
      )}
      {newFolderParent !== null && (
        <div className="new-file-prompt" role="dialog" aria-modal="true">
          <div className="new-file-prompt-backdrop" onClick={cancelNewFolder} />
          <div className="new-file-prompt-card">
            <div className="new-file-prompt-title">{t("files.newFolder")}</div>
            {newFolderParent && (
              <div className="new-file-prompt-path">{newFolderParent}/</div>
            )}
            <input
              id="new-folder-name"
              ref={newFolderInputRef}
              className="new-file-prompt-input"
              placeholder={t("files.newFolderNamePlaceholder")}
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  cancelNewFolder();
                }
                if (e.key === "Enter" && newFolderName.trim()) {
                  e.preventDefault();
                  void confirmNewFolder();
                }
              }}
            />
            <div className="new-file-prompt-actions">
              <button type="button" className="ghost" onClick={cancelNewFolder}>
                {t("files.cancel")}
              </button>
              <button
                type="button"
                className="primary"
                disabled={!newFolderName.trim()}
                onClick={() => void confirmNewFolder()}
              >
                {t("files.newFolder")}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
