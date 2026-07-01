import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { confirm } from "@tauri-apps/plugin-dialog";
import { useCallback, useState } from "react";
import type { MouseEvent } from "react";
import {
  duplicateWorkspaceItem,
  pasteWorkspaceItem,
  trashWorkspaceItem,
} from "../../../services/tauri";
import {
  clampRendererContextMenuPosition,
  type RendererContextMenuItem,
  type RendererContextMenuState,
} from "../../../components/ui/RendererContextMenu";

type FileTreeClipboardItem = {
  workspaceId: string;
  path: string;
  kind: "file" | "folder";
  name: string;
};

export function useTreeClipboard({
  workspaceId,
  getFileTreeItemName,
  resolvePath,
  resolveParentFolderForNode,
  onInsertText,
  onRefreshFiles,
  selectSingle,
  purgeDeletedFileTreePath,
  openRenamePrompt,
  openNewFilePrompt,
  openNewFolderPrompt,
  t,
}: {
  workspaceId: string;
  getFileTreeItemName: (relativePath: string) => string;
  resolvePath: (relativePath: string) => string;
  resolveParentFolderForNode: (
    relativePath: string | null,
    nodeType: "file" | "folder" | null,
  ) => string;
  onInsertText?: (text: string) => void;
  onRefreshFiles?: () => void | Promise<void>;
  selectSingle: (path: string, type: "file" | "folder") => void;
  purgeDeletedFileTreePath: (deletedPath: string) => void;
  openRenamePrompt: (path: string, type: "file" | "folder") => void;
  openNewFilePrompt: (parentPath: string) => void;
  openNewFolderPrompt: (parentPath: string) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const [contextMenu, setContextMenu] = useState<RendererContextMenuState | null>(null);
  const [clipboardItem, setClipboardItem] = useState<FileTreeClipboardItem | null>(null);

  const normalizeOperationError = useCallback((error: unknown) => {
    return error instanceof Error ? error.message : String(error);
  }, []);

  const reportOperationError = useCallback(
    (operation: string, error: unknown) => {
      console.warn(`[file-tree] ${operation} failed`, normalizeOperationError(error));
    },
    [normalizeOperationError],
  );

  const clearClipboardForDeletedPath = useCallback((deletedPath: string) => {
    setClipboardItem((prev) =>
      prev && (prev.path === deletedPath || prev.path.startsWith(`${deletedPath}/`)) ? null : prev,
    );
  }, []);

  const copyPath = useCallback(
    async (relativePath: string) => {
      try {
        await navigator.clipboard.writeText(resolvePath(relativePath));
      } catch {
        // clipboard write is not critical
      }
    },
    [resolvePath],
  );

  const trashItem = useCallback(
    async (relativePath: string, isFolder: boolean) => {
      const name = relativePath.split("/").pop() ?? relativePath;
      const confirmMessage = isFolder
        ? t("files.deleteFolderConfirm", { name })
        : t("files.deleteFileConfirm", { name });

      const confirmed = await confirm(confirmMessage, {
        title: t("files.deleteItem"),
        kind: "warning",
        okLabel: t("files.deleteItem"),
        cancelLabel: t("files.cancel"),
      });

      if (!confirmed) {
        return;
      }

      try {
        await trashWorkspaceItem(workspaceId, relativePath);
        clearClipboardForDeletedPath(relativePath);
        purgeDeletedFileTreePath(relativePath);
        onRefreshFiles?.();
      } catch (error) {
        reportOperationError("trash item", error);
      }
    },
    [
      clearClipboardForDeletedPath,
      onRefreshFiles,
      purgeDeletedFileTreePath,
      reportOperationError,
      t,
      workspaceId,
    ],
  );

  const copyFileTreeItem = useCallback(
    (relativePath: string, kind: "file" | "folder") => {
      setClipboardItem({
        workspaceId,
        path: relativePath,
        kind,
        name: getFileTreeItemName(relativePath),
      });
    },
    [getFileTreeItemName, workspaceId],
  );

  const pasteFileTreeItem = useCallback(
    async (targetDirectory: string) => {
      if (!clipboardItem) {
        return;
      }
      if (clipboardItem.workspaceId !== workspaceId) {
        return;
      }
      try {
        const result = await pasteWorkspaceItem(
          workspaceId,
          clipboardItem.path,
          targetDirectory,
        );
        selectSingle(result.path, result.kind === "folder" ? "folder" : "file");
        onRefreshFiles?.();
      } catch (error) {
        reportOperationError("paste item", error);
      }
    },
    [
      clipboardItem,
      onRefreshFiles,
      reportOperationError,
      selectSingle,
      workspaceId,
    ],
  );

  const duplicateItem = useCallback(
    async (relativePath: string) => {
      try {
        const result = await duplicateWorkspaceItem(workspaceId, relativePath);
        selectSingle(result.path, result.kind === "folder" ? "folder" : "file");
        onRefreshFiles?.();
      } catch (error) {
        reportOperationError("duplicate item", error);
      }
    },
    [onRefreshFiles, reportOperationError, selectSingle, workspaceId],
  );

  const showContextMenu = useCallback(
    (event: MouseEvent<HTMLButtonElement>, relativePath: string, isFolder: boolean) => {
      event.preventDefault();
      event.stopPropagation();

      const parentFolder = resolveParentFolderForNode(relativePath, isFolder ? "folder" : "file");
      const isRootActionTarget = relativePath.length === 0;
      const itemKind = isFolder ? "folder" : "file";

      const menuItems: RendererContextMenuItem[] = [
        {
          type: "item",
          id: "new-file",
          label: t("files.newFile"),
          onSelect: () => {
            setContextMenu(null);
            openNewFilePrompt(parentFolder);
          },
        },
        {
          type: "item",
          id: "new-folder",
          label: t("files.newFolder"),
          onSelect: () => {
            setContextMenu(null);
            openNewFolderPrompt(parentFolder);
          },
        },
        ...(isRootActionTarget
          ? []
          : [
              {
                type: "item" as const,
                id: "copy-item",
                label: t("files.copyItem"),
                onSelect: () => {
                  setContextMenu(null);
                  copyFileTreeItem(relativePath, itemKind);
                },
              },
            ]),
        {
          type: "item",
          id: "paste-item",
          label: t("files.pasteItem"),
          onSelect: async () => {
            setContextMenu(null);
            await pasteFileTreeItem(parentFolder);
          },
        },
        ...(isRootActionTarget
          ? []
          : [
              {
                type: "item" as const,
                id: "duplicate",
                label: t("files.duplicateItem"),
                onSelect: async () => {
                  await duplicateItem(relativePath);
                },
              },
              {
                type: "item" as const,
                id: "rename",
                label: t("files.renameItem"),
                onSelect: () => {
                  setContextMenu(null);
                  openRenamePrompt(relativePath, itemKind);
                },
              },
            ]),
        {
          type: "item",
          id: "copy-path",
          label: t("files.copyPath"),
          onSelect: async () => {
            await copyPath(relativePath);
          },
        },
        {
          type: "item",
          id: "reveal",
          label: t("files.revealInFinder"),
          onSelect: async () => {
            await revealItemInDir(resolvePath(relativePath));
          },
        },
        ...(onInsertText && !isFolder
          ? [
              {
                type: "item" as const,
                id: "insert-lsp-diagnostics",
                label: t("files.insertLspDiagnostics"),
                onSelect: () => {
                  onInsertText(`/lsp diagnostics "${relativePath}"`);
                },
              },
              {
                type: "item" as const,
                id: "insert-lsp-document-symbols",
                label: t("files.insertLspDocumentSymbols"),
                onSelect: () => {
                  onInsertText(`/lsp document-symbols "${relativePath}"`);
                },
              },
            ]
          : []),
        ...(isRootActionTarget
          ? []
          : [
              {
                type: "item" as const,
                id: "delete",
                label: t("files.deleteItem"),
                tone: "danger" as const,
                onSelect: async () => {
                  setContextMenu(null);
                  await trashItem(relativePath, isFolder);
                },
              },
            ]),
      ];

      const position = clampRendererContextMenuPosition(event.clientX, event.clientY);
      setContextMenu({
        ...position,
        label: t("files.fileActions"),
        items: menuItems,
      });
    },
    [
      resolvePath,
      copyPath,
      trashItem,
      copyFileTreeItem,
      duplicateItem,
      pasteFileTreeItem,
      onInsertText,
      openRenamePrompt,
      openNewFilePrompt,
      openNewFolderPrompt,
      resolveParentFolderForNode,
      t,
    ],
  );

  return {
    contextMenu,
    setContextMenu,
    reportOperationError,
    clearClipboardForDeletedPath,
    copyPath,
    trashItem,
    showContextMenu,
  };
}
