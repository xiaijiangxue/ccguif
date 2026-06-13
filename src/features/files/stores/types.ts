import type {
  WorkspaceDirectoryChildState,
  WorkspaceDirectoryEntry,
  WorkspaceFilesResponse,
} from "../../../services/tauri";
import type { FileTreeNode } from "../utils/treeModel";

export type FileTreeSelectionType = "file" | "folder" | null;
export type FileTreeLoadStatus = "idle" | "loading" | "loaded" | "error";
export type FileTreeDirectoryPhase = "visible" | "ignored";

export type DirectoryCacheEntry = {
  visibleChildren: FileTreeNode[];
  ignoredChildren: FileTreeNode[];
  metadataByPath: Map<string, WorkspaceDirectoryEntry>;
  childState: WorkspaceDirectoryChildState | null;
  visibleStatus: FileTreeLoadStatus;
  ignoredStatus: FileTreeLoadStatus;
  visibleError: string | null;
  ignoredError: string | null;
  confirmedEmpty: boolean;
  loadedEpoch: number;
};

export type FileTreeStoreState = {
  workspaceId: string;
  expandedFolders: Set<string>;
  rootExpanded: boolean;
  directoryCache: Map<string, DirectoryCacheEntry>;
  treeData: FileTreeNode[];
  folderPaths: Set<string>;
  suppressedDeletedPaths: Set<string>;
  loadingVisibleDirs: Set<string>;
  loadedVisibleDirs: Set<string>;
  visibleLoadErrors: Map<string, string>;
  loadingIgnoredDirs: Set<string>;
  loadedIgnoredDirs: Set<string>;
  ignoredLoadErrors: Map<string, string>;
  lazyMetadata: Map<string, WorkspaceDirectoryEntry>;
  epoch: number;
  selectedPath: string | null;
  selectedType: FileTreeSelectionType;
  multiSelection: Set<string>;
  selectionAnchor: string | null;
};

export type FileTreeStoreActions = {
  setTreeData: (treeData: FileTreeNode[], folderPaths: Set<string>) => void;
  setRootExpanded: (expanded: boolean | ((current: boolean) => boolean)) => void;
  toggleExpanded: (path: string) => void;
  setExpandedFolders: (folders: Set<string> | ((current: Set<string>) => Set<string>)) => void;
  setSuppressedDeletedPaths: (
    paths: Set<string> | ((current: Set<string>) => Set<string>),
  ) => void;
  mergeDirectoryResponse: (
    path: string,
    response: WorkspaceFilesResponse,
    phase: FileTreeDirectoryPhase,
    options?: { allowParentStateOverride?: boolean; confirmedEmpty?: boolean },
  ) => void;
  suppressDeletedPath: (path: string) => void;
  pruneDeletedPath: (path: string) => void;
  resetTreeState: () => void;
  startVisibleLoad: (path: string) => void;
  completeVisibleLoad: (
    path: string,
    response: WorkspaceFilesResponse,
    options?: { allowParentStateOverride?: boolean; confirmedEmpty?: boolean },
  ) => void;
  failVisibleLoad: (path: string, error: string) => void;
  startIgnoredLoad: (path: string) => void;
  completeIgnoredLoad: (
    path: string,
    response: WorkspaceFilesResponse,
    options?: { allowParentStateOverride?: boolean; confirmedEmpty?: boolean },
  ) => void;
  failIgnoredLoad: (path: string, error: string) => void;
  incrementEpoch: () => number;
  resetLazyState: () => void;
  selectNode: (path: string, type: Exclude<FileTreeSelectionType, null>) => void;
  setSelectionState: (selection: {
    selectedPath?: string | null;
    selectedType?: FileTreeSelectionType;
    multiSelection?: Set<string>;
    selectionAnchor?: string | null;
  }) => void;
  setMultiSelection: (selection: Set<string> | ((current: Set<string>) => Set<string>)) => void;
  toggleSelection: (path: string, type?: Exclude<FileTreeSelectionType, null>) => void;
  rangeSelect: (
    from: string,
    to: string,
    visiblePathOrder: string[],
    pathTypeByPath?: Map<string, "file" | "folder" | "root">,
  ) => void;
  clearSelection: () => void;
  pruneSelection: (
    existingPaths: Set<string>,
    visiblePathOrder?: string[],
    pathTypeByPath?: Map<string, "file" | "folder" | "root">,
  ) => void;
};

export type FileTreeStore = FileTreeStoreState & FileTreeStoreActions;
