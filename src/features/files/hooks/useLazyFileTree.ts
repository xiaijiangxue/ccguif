import { useCallback, useEffect, useRef } from "react";
import {
  getWorkspaceDirectoryChildren,
  getWorkspaceDirectoryChildrenVisible,
  type WorkspaceDirectoryEntry,
  type WorkspaceFilesResponse,
} from "../../../services/tauri";
import { useFileTreeStoreApi } from "../stores/fileTreeStoreContext";
import {
  filterDeletedFileTreePathFromSet,
  filterUnknownExpandedFileTreePaths,
  isConfirmedEmptyDirectoryResponse,
  isSpecialDirectoryPath,
  shouldReloadLazyFileTreePath,
} from "../utils/treeModel";

type RootSnapshot = {
  workspaceId: string;
  files: string[];
  directories: string[];
  directoryMetadata: WorkspaceDirectoryEntry[];
  ignoredFiles: Set<string>;
  ignoredDirectories: Set<string>;
};

export type UseLazyFileTreeOptions = RootSnapshot & {
  expandedFolders: Set<string>;
  setExpandedFolders: (folders: Set<string> | ((current: Set<string>) => Set<string>)) => void;
};

function areStringArraysEqual(a: string[], b: string[]) {
  if (a === b) {
    return true;
  }
  if (a.length !== b.length) {
    return false;
  }
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) {
      return false;
    }
  }
  return true;
}

function areStringSetsEqual(a: Set<string>, b: Set<string>) {
  if (a === b) {
    return true;
  }
  if (a.size !== b.size) {
    return false;
  }
  for (const value of a) {
    if (!b.has(value)) {
      return false;
    }
  }
  return true;
}

function areDirectoryEntriesEqual(a: WorkspaceDirectoryEntry[], b: WorkspaceDirectoryEntry[]) {
  if (a === b) {
    return true;
  }
  if (a.length !== b.length) {
    return false;
  }
  for (let index = 0; index < a.length; index += 1) {
    const left = a[index];
    const right = b[index];
    if (
      left?.path !== right?.path ||
      left?.child_state !== right?.child_state ||
      left?.has_more !== right?.has_more ||
      left?.special_kind !== right?.special_kind
    ) {
      return false;
    }
  }
  return true;
}

function didRootSnapshotChange(previous: RootSnapshot | null, next: RootSnapshot) {
  if (!previous) {
    return false;
  }
  if (previous.workspaceId !== next.workspaceId) {
    return true;
  }
  return !(
    areStringArraysEqual(previous.files, next.files) &&
    areStringArraysEqual(previous.directories, next.directories) &&
    areDirectoryEntriesEqual(previous.directoryMetadata, next.directoryMetadata) &&
    areStringSetsEqual(previous.ignoredFiles, next.ignoredFiles) &&
    areStringSetsEqual(previous.ignoredDirectories, next.ignoredDirectories)
  );
}

function getDirectChildDirectories(path: string, response: WorkspaceFilesResponse) {
  return (Array.isArray(response.directories) ? response.directories : [])
    .filter((childPath) => childPath.startsWith(`${path}/`))
    .filter((childPath) => childPath.slice(path.length + 1).length > 0)
    .filter((childPath) => !childPath.slice(path.length + 1).includes("/"));
}

export function useLazyFileTree({
  workspaceId,
  files,
  directories,
  directoryMetadata,
  ignoredFiles,
  ignoredDirectories,
  expandedFolders,
  setExpandedFolders,
}: UseLazyFileTreeOptions) {
  const fileTreeStoreApi = useFileTreeStoreApi();
  const loadedLazyDirectoriesRef = useRef<Set<string>>(new Set());
  const loadingLazyDirectoriesRef = useRef<Set<string>>(new Set());
  const expandedFoldersRef = useRef<Set<string>>(new Set());
  const activeWorkspaceIdRef = useRef(workspaceId);
  const lazyLoadEpochRef = useRef(0);
  const boundedPrefetchDirectoryQueueRef = useRef<string[]>([]);
  const inFlightPrefetchDirectoryQueueRef = useRef<Set<string>>(new Set());
  const previousRootSnapshotRef = useRef<RootSnapshot | null>(null);

  const resetLazyTreeState = useCallback(() => {
    loadedLazyDirectoriesRef.current = new Set();
    loadingLazyDirectoriesRef.current = new Set();
    boundedPrefetchDirectoryQueueRef.current = [];
    inFlightPrefetchDirectoryQueueRef.current = new Set();
    lazyLoadEpochRef.current += 1;
    fileTreeStoreApi.getState().resetLazyState();
  }, [fileTreeStoreApi]);

  const clearLazyDirectoryLoading = useCallback((path: string) => {
    loadingLazyDirectoriesRef.current = new Set(loadingLazyDirectoriesRef.current);
    loadingLazyDirectoriesRef.current.delete(path);
  }, []);

  const finalizeLazyDirectoryLoad = useCallback(
    (path: string) => {
      clearLazyDirectoryLoading(path);
      loadedLazyDirectoriesRef.current = new Set(loadedLazyDirectoriesRef.current).add(path);
    },
    [clearLazyDirectoryLoading],
  );

  const queuePrefetchDirectoryLoad = useCallback((path: string) => {
    if (!path) {
      return;
    }
    if (isSpecialDirectoryPath(path)) {
      return;
    }
    if (
      loadedLazyDirectoriesRef.current.has(path) ||
      loadingLazyDirectoriesRef.current.has(path) ||
      inFlightPrefetchDirectoryQueueRef.current.has(path) ||
      boundedPrefetchDirectoryQueueRef.current.includes(path)
    ) {
      return;
    }
    boundedPrefetchDirectoryQueueRef.current = [...boundedPrefetchDirectoryQueueRef.current, path];
  }, []);

  const flushPrefetchDirectoryLoadQueue = useCallback(async () => {
    while (
      inFlightPrefetchDirectoryQueueRef.current.size < 3 &&
      boundedPrefetchDirectoryQueueRef.current.length > 0
    ) {
      const nextPath = boundedPrefetchDirectoryQueueRef.current.shift();
      if (!nextPath) {
        return;
      }
      if (
        !expandedFoldersRef.current.has(nextPath.split("/").slice(0, -1).join("/")) ||
        loadedLazyDirectoriesRef.current.has(nextPath) ||
        loadingLazyDirectoriesRef.current.has(nextPath)
      ) {
        continue;
      }
      const requestWorkspaceId = workspaceId;
      const requestEpoch = lazyLoadEpochRef.current;
      inFlightPrefetchDirectoryQueueRef.current = new Set(
        inFlightPrefetchDirectoryQueueRef.current,
      ).add(nextPath);
      loadingLazyDirectoriesRef.current = new Set(loadingLazyDirectoriesRef.current).add(nextPath);
      fileTreeStoreApi.getState().startVisibleLoad(nextPath);
      void getWorkspaceDirectoryChildren(requestWorkspaceId, nextPath)
        .then((response) => {
          if (
            activeWorkspaceIdRef.current !== requestWorkspaceId ||
            lazyLoadEpochRef.current !== requestEpoch
          ) {
            return;
          }
          fileTreeStoreApi.getState().completeVisibleLoad(nextPath, response);
          finalizeLazyDirectoryLoad(nextPath);
        })
        .catch(() => {
          if (
            activeWorkspaceIdRef.current !== requestWorkspaceId ||
            lazyLoadEpochRef.current !== requestEpoch
          ) {
            return;
          }
          clearLazyDirectoryLoading(nextPath);
          fileTreeStoreApi.getState().failVisibleLoad(nextPath, "");
        })
        .finally(() => {
          if (
            activeWorkspaceIdRef.current === requestWorkspaceId &&
            lazyLoadEpochRef.current === requestEpoch
          ) {
            inFlightPrefetchDirectoryQueueRef.current = new Set(
              inFlightPrefetchDirectoryQueueRef.current,
            );
            inFlightPrefetchDirectoryQueueRef.current.delete(nextPath);
            void flushPrefetchDirectoryLoadQueue();
          }
        });
    }
  }, [
    clearLazyDirectoryLoading,
    fileTreeStoreApi,
    finalizeLazyDirectoryLoad,
    workspaceId,
  ]);

  const loadLazyDirectoryChildren = useCallback(
    async (path: string) => {
      if (
        loadedLazyDirectoriesRef.current.has(path) ||
        loadingLazyDirectoriesRef.current.has(path)
      ) {
        return;
      }
      loadingLazyDirectoriesRef.current = new Set(loadingLazyDirectoriesRef.current).add(path);
      fileTreeStoreApi.getState().startVisibleLoad(path);
      const requestWorkspaceId = workspaceId;
      const requestEpoch = lazyLoadEpochRef.current;
      try {
        const isSpecialDirectory = isSpecialDirectoryPath(path);
        const response = await (isSpecialDirectory
          ? getWorkspaceDirectoryChildrenVisible(requestWorkspaceId, path)
          : getWorkspaceDirectoryChildren(requestWorkspaceId, path));
        if (
          activeWorkspaceIdRef.current !== requestWorkspaceId ||
          lazyLoadEpochRef.current !== requestEpoch
        ) {
          return;
        }
        const visibleResponseConfirmedEmpty = isConfirmedEmptyDirectoryResponse(path, response);
        fileTreeStoreApi.getState().completeVisibleLoad(path, response, {
          allowParentStateOverride: !visibleResponseConfirmedEmpty,
          confirmedEmpty: visibleResponseConfirmedEmpty,
        });
        if (!isSpecialDirectory) {
          getDirectChildDirectories(path, response).forEach((childPath) =>
            queuePrefetchDirectoryLoad(childPath),
          );
          void flushPrefetchDirectoryLoadQueue();
        }
        finalizeLazyDirectoryLoad(path);
      } catch (error) {
        if (
          activeWorkspaceIdRef.current !== requestWorkspaceId ||
          lazyLoadEpochRef.current !== requestEpoch
        ) {
          return;
        }
        const message = error instanceof Error ? error.message : String(error);
        fileTreeStoreApi.getState().failVisibleLoad(path, message);
        clearLazyDirectoryLoading(path);
      }
    },
    [
      clearLazyDirectoryLoading,
      fileTreeStoreApi,
      finalizeLazyDirectoryLoad,
      flushPrefetchDirectoryLoadQueue,
      queuePrefetchDirectoryLoad,
      workspaceId,
    ],
  );

  const purgeLazyDeletedPath = useCallback((deletedPath: string) => {
    loadedLazyDirectoriesRef.current = filterDeletedFileTreePathFromSet(
      loadedLazyDirectoriesRef.current,
      deletedPath,
    );
    loadingLazyDirectoriesRef.current = filterDeletedFileTreePathFromSet(
      loadingLazyDirectoriesRef.current,
      deletedPath,
    );
    fileTreeStoreApi.getState().pruneDeletedPath(deletedPath);
  }, [fileTreeStoreApi]);

  const createExpandedLazyDirectoryReloader = useCallback(() => {
    const loadedLazyFolders = Array.from(new Set([
      ...loadedLazyDirectoriesRef.current,
      ...loadingLazyDirectoriesRef.current,
    ])).filter(Boolean);
    const expandedLazyFoldersToReload = loadedLazyFolders.filter((path) =>
      expandedFoldersRef.current.has(path),
    );
    return () => {
      if (expandedLazyFoldersToReload.length === 0 || activeWorkspaceIdRef.current !== workspaceId) {
        return;
      }
      resetLazyTreeState();
      expandedLazyFoldersToReload.forEach((path) => {
        void loadLazyDirectoryChildren(path);
      });
    };
  }, [loadLazyDirectoryChildren, resetLazyTreeState, workspaceId]);

  useEffect(() => {
    expandedFoldersRef.current = expandedFolders;
  }, [expandedFolders]);

  useEffect(() => {
    activeWorkspaceIdRef.current = workspaceId;
  }, [workspaceId]);

  useEffect(() => {
    const nextRootSnapshot = {
      workspaceId,
      files,
      directories,
      directoryMetadata,
      ignoredFiles,
      ignoredDirectories,
    };
    const shouldResetLazyTree = didRootSnapshotChange(
      previousRootSnapshotRef.current,
      nextRootSnapshot,
    );
    previousRootSnapshotRef.current = nextRootSnapshot;
    if (!shouldResetLazyTree) {
      return;
    }
    const previouslyLoadedLazyFolders = new Set<string>([
      ...loadedLazyDirectoriesRef.current,
      ...loadingLazyDirectoriesRef.current,
    ]);
    const rootDirectoryMetadataByPath = new Map<string, WorkspaceDirectoryEntry>();
    directoryMetadata.forEach((entry) => {
      if (entry.path) {
        rootDirectoryMetadataByPath.set(entry.path, entry);
      }
    });
    const expandedLazyFolders = Array.from(previouslyLoadedLazyFolders).filter(
      (path) =>
        path &&
        expandedFoldersRef.current.has(path) &&
        shouldReloadLazyFileTreePath(path, files, directories, rootDirectoryMetadataByPath),
    );

    // Selective reset: only clear directories that need re-fetching from the
    // frontend cache. Directories NOT in this list retain their cached tree
    // nodes, avoiding redundant re-parsing when the backend cache serves the
    // same data (no filesystem change behind those directories).
    if (expandedLazyFolders.length > 0) {
      const dirsToReload = new Set(expandedLazyFolders);
      const state = fileTreeStoreApi.getState();
      const nextDirectoryCache = new Map(state.directoryCache);
      dirsToReload.forEach((dirPath) => nextDirectoryCache.delete(dirPath));
      const nextLoadedVisible = new Set(state.loadedVisibleDirs);
      const nextLoadingVisible = new Set(state.loadingVisibleDirs);
      const nextLoadedIgnored = new Set(state.loadedIgnoredDirs);
      const nextLoadingIgnored = new Set(state.loadingIgnoredDirs);
      const nextVisibleErrors = new Map(state.visibleLoadErrors);
      const nextIgnoredErrors = new Map(state.ignoredLoadErrors);
      const nextLazyMeta = new Map(state.lazyMetadata);
      dirsToReload.forEach((dirPath) => {
        nextLoadedVisible.delete(dirPath);
        nextLoadingVisible.delete(dirPath);
        nextLoadedIgnored.delete(dirPath);
        nextLoadingIgnored.delete(dirPath);
        nextVisibleErrors.delete(dirPath);
        nextIgnoredErrors.delete(dirPath);
        nextLazyMeta.delete(dirPath);
      });
      // Remove from ref tracking so loadLazyDirectoryChildren will re-fetch.
      const removeDirsFromSet = (set: Set<string>) => {
        let changed = false;
        const next = new Set<string>();
        set.forEach((path) => {
          if (dirsToReload.has(path)) {
            changed = true;
          } else {
            next.add(path);
          }
        });
        return changed ? next : set;
      };
      loadedLazyDirectoriesRef.current = removeDirsFromSet(loadedLazyDirectoriesRef.current);
      loadingLazyDirectoriesRef.current = removeDirsFromSet(loadingLazyDirectoriesRef.current);
      fileTreeStoreApi.setState({
        directoryCache: nextDirectoryCache,
        loadingVisibleDirs: nextLoadingVisible,
        loadedVisibleDirs: nextLoadedVisible,
        visibleLoadErrors: nextVisibleErrors,
        loadingIgnoredDirs: nextLoadingIgnored,
        loadedIgnoredDirs: nextLoadedIgnored,
        ignoredLoadErrors: nextIgnoredErrors,
        lazyMetadata: nextLazyMeta,
        epoch: state.epoch + 1,
      });
      lazyLoadEpochRef.current += 1;
    }

    setExpandedFolders((prev) => filterUnknownExpandedFileTreePaths(prev, files, directories));
    expandedLazyFolders.forEach((path) => {
      void loadLazyDirectoryChildren(path);
    });
  }, [
    directories,
    directoryMetadata,
    files,
    ignoredDirectories,
    ignoredFiles,
    loadLazyDirectoryChildren,
    fileTreeStoreApi,
    setExpandedFolders,
    workspaceId,
  ]);

  return {
    resetLazyTreeState,
    loadLazyDirectoryChildren,
    purgeLazyDeletedPath,
    createExpandedLazyDirectoryReloader,
  };
}
