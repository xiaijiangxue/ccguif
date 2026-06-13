import {
  createContext,
  useContext,
  useMemo,
  type PropsWithChildren,
} from "react";
import create from "zustand";
import type { UseBoundStore } from "zustand";
import type { EqualityChecker, StateSelector } from "zustand/vanilla";
import {
  createFileTreeStore,
  type CreateFileTreeStoreOptions,
  type FileTreeStoreApi,
} from "./fileTreeStore";
import type { FileTreeStore } from "./types";

type FileTreeBoundStore = UseBoundStore<FileTreeStore, FileTreeStoreApi>;

const FileTreeStoreContext = createContext<FileTreeBoundStore | null>(null);

export type FileTreeStoreProviderProps = PropsWithChildren<CreateFileTreeStoreOptions>;

export function FileTreeStoreProvider({
  workspaceId,
  children,
}: FileTreeStoreProviderProps) {
  const store = useMemo(() => {
    const vanillaStore = createFileTreeStore({ workspaceId });
    return create(vanillaStore);
  }, [workspaceId]);

  return (
    <FileTreeStoreContext.Provider value={store}>
      {children}
    </FileTreeStoreContext.Provider>
  );
}

export function useFileTreeStoreApi(): FileTreeStoreApi {
  const store = useContext(FileTreeStoreContext);
  if (!store) {
    throw new Error("useFileTreeStoreApi must be used within FileTreeStoreProvider");
  }
  return store;
}

export function useFileTreeStore<T>(
  selector: StateSelector<FileTreeStore, T>,
  equalityFn?: EqualityChecker<T>,
): T {
  const store = useContext(FileTreeStoreContext);
  if (!store) {
    throw new Error("useFileTreeStore must be used within FileTreeStoreProvider");
  }
  return store(selector, equalityFn);
}
