import createStore, { type StoreApi } from "zustand/vanilla";
import type { WorkspaceDirectoryEntry, WorkspaceFilesResponse } from "../../../services/tauri";
import {
  buildTree,
  filterDeletedFileTreePathFromMap,
  filterDeletedFileTreePathFromSet,
  isSameOrDescendantFileTreePath,
} from "../utils/treeModel";
import type {
  DirectoryCacheEntry,
  FileTreeDirectoryPhase,
  FileTreeSelectionType,
  FileTreeStore,
  FilterCategory,
} from "./types";

export type FileTreeStoreApi = StoreApi<FileTreeStore>;

export type CreateFileTreeStoreOptions = {
  workspaceId: string;
};

const EMPTY_DIRECTORY_CHILDREN = [] as const;

function normalizeDirectoryMetadata(response: WorkspaceFilesResponse) {
  return Array.isArray(response.directory_entries)
    ? response.directory_entries.filter(
        (entry): entry is WorkspaceDirectoryEntry =>
          Boolean(entry && typeof entry.path === "string" && typeof entry.child_state === "string"),
      )
    : [];
}

function buildChildrenFromResponse(
  response: WorkspaceFilesResponse,
  hiddenCategories?: Set<FilterCategory>,
) {
  const files = [
    ...(Array.isArray(response.files) ? response.files : []),
    ...(Array.isArray(response.gitignored_files) ? response.gitignored_files : []),
  ];
  const directories = [
    ...(Array.isArray(response.directories) ? response.directories : []),
    ...(Array.isArray(response.gitignored_directories) ? response.gitignored_directories : []),
  ];
  const metadataByPath = new Map<string, WorkspaceDirectoryEntry>();
  normalizeDirectoryMetadata(response).forEach((entry) => metadataByPath.set(entry.path, entry));

  return buildTree(files, directories, new Set(), metadataByPath, undefined, hiddenCategories).nodes;
}

function cloneCacheEntry(entry: DirectoryCacheEntry | undefined): DirectoryCacheEntry {
  return {
    visibleChildren: entry?.visibleChildren ?? [...EMPTY_DIRECTORY_CHILDREN],
    ignoredChildren: entry?.ignoredChildren ?? [...EMPTY_DIRECTORY_CHILDREN],
    metadataByPath: new Map(entry?.metadataByPath),
    childState: entry?.childState ?? null,
    visibleStatus: entry?.visibleStatus ?? "idle",
    ignoredStatus: entry?.ignoredStatus ?? "idle",
    visibleError: entry?.visibleError ?? null,
    ignoredError: entry?.ignoredError ?? null,
    confirmedEmpty: entry?.confirmedEmpty ?? false,
    loadedEpoch: entry?.loadedEpoch ?? 0,
  };
}

function removePathFromSet(values: Set<string>, path: string) {
  if (!values.has(path)) {
    return values;
  }
  const next = new Set(values);
  next.delete(path);
  return next;
}

function addPathToSet(values: Set<string>, path: string) {
  if (values.has(path)) {
    return values;
  }
  return new Set(values).add(path);
}

function setLoadError(errors: Map<string, string>, path: string, message: string) {
  const next = new Map(errors);
  next.set(path, message);
  return next;
}

function clearLoadError(errors: Map<string, string>, path: string) {
  if (!errors.has(path)) {
    return errors;
  }
  const next = new Map(errors);
  next.delete(path);
  return next;
}

function resolveSelectionType(
  path: string | null,
  fallback: FileTreeSelectionType,
  pathTypeByPath?: Map<string, "file" | "folder" | "root">,
) {
  if (!path) {
    return null;
  }
  const type = pathTypeByPath?.get(path);
  if (type === "file") {
    return "file";
  }
  if (type === "folder" || type === "root") {
    return "folder";
  }
  return fallback;
}

function mergeDirectoryResponseIntoState(
  state: FileTreeStore,
  path: string,
  response: WorkspaceFilesResponse,
  phase: FileTreeDirectoryPhase,
  options?: { allowParentStateOverride?: boolean; confirmedEmpty?: boolean },
) {
  const allowParentStateOverride = options?.allowParentStateOverride ?? true;
  const nextDirectoryCache = new Map(state.directoryCache);
  const entry = cloneCacheEntry(nextDirectoryCache.get(path));
  const metadata = normalizeDirectoryMetadata(response).filter(
    (item) => allowParentStateOverride || item.path !== path,
  );
  metadata.forEach((item) => entry.metadataByPath.set(item.path, item));

  const parentMetadata = normalizeDirectoryMetadata(response).find((item) => item.path === path);
  if (allowParentStateOverride && parentMetadata?.child_state) {
    entry.childState = parentMetadata.child_state;
  }

  if (phase === "visible") {
    entry.visibleChildren = buildChildrenFromResponse(response, state.hiddenCategories);
    entry.visibleStatus = "loaded";
    entry.visibleError = null;
  } else {
    entry.ignoredChildren = buildChildrenFromResponse(response, state.hiddenCategories);
    entry.ignoredStatus = "loaded";
    entry.ignoredError = null;
  }

  entry.confirmedEmpty = options?.confirmedEmpty ?? entry.confirmedEmpty;
  entry.loadedEpoch = state.epoch;
  nextDirectoryCache.set(path, entry);

  const nextLazyMetadata = new Map(state.lazyMetadata);
  metadata.forEach((item) => nextLazyMetadata.set(item.path, item));

  return {
    directoryCache: nextDirectoryCache,
    lazyMetadata: nextLazyMetadata,
  };
}

const DEFAULT_HIDDEN_CATEGORIES: Set<FilterCategory> = new Set([
  "Dependencies",
  "BuildArtifacts",
  "IDEConfig",
]);

const FILTER_STORAGE_KEY_PREFIX = "fileTree:hiddenCategories:";

function loadHiddenCategories(workspaceId: string): Set<FilterCategory> {
  try {
    const stored = localStorage.getItem(`${FILTER_STORAGE_KEY_PREFIX}${workspaceId}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return new Set(parsed as FilterCategory[]);
      }
    }
  } catch {
    // ignore malformed storage
  }
  return new Set(DEFAULT_HIDDEN_CATEGORIES);
}

function persistHiddenCategories(workspaceId: string, categories: Set<FilterCategory>) {
  try {
    localStorage.setItem(
      `${FILTER_STORAGE_KEY_PREFIX}${workspaceId}`,
      JSON.stringify(Array.from(categories)),
    );
  } catch {
    // ignore storage errors
  }
}

export function createFileTreeStore(options: CreateFileTreeStoreOptions): FileTreeStoreApi {
  return createStore<FileTreeStore>((set, get) => ({
    workspaceId: options.workspaceId,
    expandedFolders: new Set(),
    rootExpanded: true,
    directoryCache: new Map(),
    treeData: [],
    folderPaths: new Set(),
    suppressedDeletedPaths: new Set(),
    loadingVisibleDirs: new Set(),
    loadedVisibleDirs: new Set(),
    visibleLoadErrors: new Map(),
    loadingIgnoredDirs: new Set(),
    loadedIgnoredDirs: new Set(),
    ignoredLoadErrors: new Map(),
    lazyMetadata: new Map(),
    epoch: 0,
    selectedPath: null,
    selectedType: null,
    multiSelection: new Set(),
    selectionAnchor: null,
    hiddenCategories: loadHiddenCategories(options.workspaceId),

    setTreeData: (treeData, folderPaths) => {
      set({ treeData, folderPaths });
    },

    setRootExpanded: (expanded) => {
      set((state) => ({
        rootExpanded: typeof expanded === "function" ? expanded(state.rootExpanded) : expanded,
      }));
    },

    toggleExpanded: (path) => {
      set((state) => {
        const next = new Set(state.expandedFolders);
        if (next.has(path)) {
          next.delete(path);
        } else {
          next.add(path);
        }
        return { expandedFolders: next };
      });
    },

    setExpandedFolders: (folders) => {
      set((state) => ({
        expandedFolders: typeof folders === "function" ? folders(state.expandedFolders) : folders,
      }));
    },

    setSuppressedDeletedPaths: (paths) => {
      set((state) => ({
        suppressedDeletedPaths:
          typeof paths === "function" ? paths(state.suppressedDeletedPaths) : paths,
      }));
    },

    mergeDirectoryResponse: (path, response, phase, mergeOptions) => {
      set((state) => mergeDirectoryResponseIntoState(state, path, response, phase, mergeOptions));
    },

    suppressDeletedPath: (path) => {
      set((state) => ({ suppressedDeletedPaths: addPathToSet(state.suppressedDeletedPaths, path) }));
      get().pruneDeletedPath(path);
    },

    pruneDeletedPath: (path) => {
      set((state) => {
        const nextSelectedPaths = filterDeletedFileTreePathFromSet(state.multiSelection, path);
        const selectedPath =
          state.selectedPath && isSameOrDescendantFileTreePath(state.selectedPath, path)
            ? null
            : state.selectedPath;
        return {
          expandedFolders: filterDeletedFileTreePathFromSet(state.expandedFolders, path),
          directoryCache: filterDeletedFileTreePathFromMap(state.directoryCache, path),
          loadingVisibleDirs: filterDeletedFileTreePathFromSet(state.loadingVisibleDirs, path),
          loadedVisibleDirs: filterDeletedFileTreePathFromSet(state.loadedVisibleDirs, path),
          visibleLoadErrors: filterDeletedFileTreePathFromMap(state.visibleLoadErrors, path),
          loadingIgnoredDirs: filterDeletedFileTreePathFromSet(state.loadingIgnoredDirs, path),
          loadedIgnoredDirs: filterDeletedFileTreePathFromSet(state.loadedIgnoredDirs, path),
          ignoredLoadErrors: filterDeletedFileTreePathFromMap(state.ignoredLoadErrors, path),
          lazyMetadata: filterDeletedFileTreePathFromMap(state.lazyMetadata, path),
          selectedPath,
          selectedType: selectedPath ? state.selectedType : null,
          multiSelection: nextSelectedPaths,
          selectionAnchor:
            state.selectionAnchor && isSameOrDescendantFileTreePath(state.selectionAnchor, path)
              ? selectedPath
              : state.selectionAnchor,
        };
      });
    },

    resetTreeState: () => {
      set({
        expandedFolders: new Set(),
        rootExpanded: true,
        directoryCache: new Map(),
        treeData: [],
        folderPaths: new Set(),
        suppressedDeletedPaths: new Set(),
        selectedPath: null,
        selectedType: null,
        multiSelection: new Set(),
        selectionAnchor: null,
      });
      get().resetLazyState();
    },

    startVisibleLoad: (path) => {
      set((state) => ({
        loadingVisibleDirs: addPathToSet(state.loadingVisibleDirs, path),
        visibleLoadErrors: clearLoadError(state.visibleLoadErrors, path),
      }));
    },

    completeVisibleLoad: (path, response, mergeOptions) => {
      set((state) => ({
        ...mergeDirectoryResponseIntoState(state, path, response, "visible", mergeOptions),
        loadingVisibleDirs: removePathFromSet(state.loadingVisibleDirs, path),
        loadedVisibleDirs: addPathToSet(state.loadedVisibleDirs, path),
        visibleLoadErrors: clearLoadError(state.visibleLoadErrors, path),
      }));
    },

    failVisibleLoad: (path, error) => {
      set((state) => ({
        loadingVisibleDirs: removePathFromSet(state.loadingVisibleDirs, path),
        visibleLoadErrors: setLoadError(state.visibleLoadErrors, path, error),
        directoryCache: new Map(state.directoryCache).set(path, {
          ...cloneCacheEntry(state.directoryCache.get(path)),
          visibleStatus: "error",
          visibleError: error,
          loadedEpoch: state.epoch,
        }),
      }));
    },

    startIgnoredLoad: (path) => {
      set((state) => ({
        loadingIgnoredDirs: addPathToSet(state.loadingIgnoredDirs, path),
        ignoredLoadErrors: clearLoadError(state.ignoredLoadErrors, path),
      }));
    },

    completeIgnoredLoad: (path, response, mergeOptions) => {
      set((state) => ({
        ...mergeDirectoryResponseIntoState(state, path, response, "ignored", mergeOptions),
        loadingIgnoredDirs: removePathFromSet(state.loadingIgnoredDirs, path),
        loadedIgnoredDirs: addPathToSet(state.loadedIgnoredDirs, path),
        ignoredLoadErrors: clearLoadError(state.ignoredLoadErrors, path),
      }));
    },

    failIgnoredLoad: (path, error) => {
      set((state) => ({
        loadingIgnoredDirs: removePathFromSet(state.loadingIgnoredDirs, path),
        ignoredLoadErrors: setLoadError(state.ignoredLoadErrors, path, error),
        directoryCache: new Map(state.directoryCache).set(path, {
          ...cloneCacheEntry(state.directoryCache.get(path)),
          ignoredStatus: "error",
          ignoredError: error,
          loadedEpoch: state.epoch,
        }),
      }));
    },

    incrementEpoch: () => {
      const nextEpoch = get().epoch + 1;
      set({ epoch: nextEpoch });
      return nextEpoch;
    },

    resetLazyState: () => {
      set((state) => ({
        directoryCache: new Map(),
        loadingVisibleDirs: new Set(),
        loadedVisibleDirs: new Set(),
        visibleLoadErrors: new Map(),
        loadingIgnoredDirs: new Set(),
        loadedIgnoredDirs: new Set(),
        ignoredLoadErrors: new Map(),
        lazyMetadata: new Map(),
        epoch: state.epoch + 1,
      }));
    },

    resetWorkspaceSwitchState: () => {
      set((state) => ({
        directoryCache: new Map(),
        loadingVisibleDirs: new Set(),
        loadedVisibleDirs: new Set(),
        visibleLoadErrors: new Map(),
        loadingIgnoredDirs: new Set(),
        loadedIgnoredDirs: new Set(),
        ignoredLoadErrors: new Map(),
        lazyMetadata: new Map(),
        epoch: state.epoch + 1,
        suppressedDeletedPaths: new Set(),
        rootExpanded: true,
        selectedPath: null,
        selectedType: null,
        multiSelection: new Set(),
        selectionAnchor: null,
      }));
    },

    selectNode: (path, type) => {
      set({
        selectedPath: path,
        selectedType: type,
        multiSelection: new Set([path]),
        selectionAnchor: path,
      });
    },

    setSelectionState: (selection) => {
      set(selection);
    },

    setMultiSelection: (selection) => {
      set((state) => ({
        multiSelection:
          typeof selection === "function" ? selection(state.multiSelection) : selection,
      }));
    },

    toggleSelection: (path, type) => {
      set((state) => {
        const next = new Set(state.multiSelection);
        if (next.has(path)) {
          next.delete(path);
        } else {
          next.add(path);
        }
        const fallbackPath = next.has(path) ? path : Array.from(next)[0] ?? null;
        const fallbackType = resolveSelectionType(fallbackPath, type ?? state.selectedType);
        return {
          multiSelection: next,
          selectedPath: fallbackPath,
          selectedType: fallbackType,
          selectionAnchor: path,
        };
      });
    },

    rangeSelect: (from, to, visiblePathOrder, pathTypeByPath) => {
      const fromIndex = visiblePathOrder.indexOf(from);
      const toIndex = visiblePathOrder.indexOf(to);
      if (fromIndex < 0 || toIndex < 0) {
        const type = resolveSelectionType(to, "folder", pathTypeByPath) ?? "folder";
        get().selectNode(to, type);
        return;
      }
      const start = Math.min(fromIndex, toIndex);
      const end = Math.max(fromIndex, toIndex);
      const selectedPaths = visiblePathOrder.slice(start, end + 1);
      set({
        selectedPath: to,
        selectedType: resolveSelectionType(to, "folder", pathTypeByPath),
        multiSelection: new Set(selectedPaths),
        selectionAnchor: from,
      });
    },

    clearSelection: () => {
      set({
        selectedPath: null,
        selectedType: null,
        multiSelection: new Set(),
        selectionAnchor: null,
      });
    },

    toggleCategory: (category) => {
      set((state) => {
        const next = new Set(state.hiddenCategories);
        if (next.has(category)) {
          next.delete(category);
        } else {
          next.add(category);
        }
        persistHiddenCategories(state.workspaceId, next);
        return { hiddenCategories: next };
      });
    },

    pruneSelection: (existingPaths, visiblePathOrder, pathTypeByPath) => {
      set((state) => {
        if (state.multiSelection.size === 0) {
          return {};
        }
        let changed = false;
        const next = new Set<string>();
        state.multiSelection.forEach((path) => {
          if (existingPaths.has(path)) {
            next.add(path);
          } else {
            changed = true;
          }
        });
        if (!changed) {
          return {};
        }
        const nextPrimaryPath =
          state.selectedPath && next.has(state.selectedPath)
            ? state.selectedPath
            : visiblePathOrder?.find((path) => next.has(path)) ?? null;
        return {
          selectedPath: nextPrimaryPath,
          selectedType: resolveSelectionType(nextPrimaryPath, state.selectedType, pathTypeByPath),
          multiSelection: next,
          selectionAnchor:
            state.selectionAnchor && next.has(state.selectionAnchor)
              ? state.selectionAnchor
              : nextPrimaryPath,
        };
      });
    },
  }));
}
