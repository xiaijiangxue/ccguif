import { useCallback, useRef, useState } from "react";

export type RenamePromptState = {
  path: string;
  kind: "file" | "folder";
  currentName: string;
};

export function useTreeDialogs(getFileTreeItemName: (relativePath: string) => string) {
  const [renamePrompt, setRenamePrompt] = useState<RenamePromptState | null>(null);
  const [renameDraftName, setRenameDraftName] = useState("");
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const [newFileParent, setNewFileParent] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState("");
  const newFileInputRef = useRef<HTMLInputElement | null>(null);
  const [newFolderParent, setNewFolderParent] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const newFolderInputRef = useRef<HTMLInputElement | null>(null);

  const openRenamePrompt = useCallback(
    (relativePath: string, kind: "file" | "folder") => {
      const currentName = getFileTreeItemName(relativePath);
      setRenamePrompt({
        path: relativePath,
        kind,
        currentName,
      });
      setRenameDraftName(currentName);
      requestAnimationFrame(() => {
        renameInputRef.current?.focus();
        renameInputRef.current?.select();
      });
    },
    [getFileTreeItemName],
  );

  const cancelRename = useCallback(() => {
    setRenamePrompt(null);
    setRenameDraftName("");
  }, []);

  const openNewFilePrompt = useCallback((parentFolder: string) => {
    setNewFileParent(parentFolder);
    setNewFileName("");
    requestAnimationFrame(() => {
      newFileInputRef.current?.focus();
    });
  }, []);

  const cancelNewFile = useCallback(() => {
    setNewFileParent(null);
    setNewFileName("");
  }, []);

  const openNewFolderPrompt = useCallback((parentFolder: string) => {
    setNewFolderParent(parentFolder);
    setNewFolderName("");
    requestAnimationFrame(() => {
      newFolderInputRef.current?.focus();
    });
  }, []);

  const cancelNewFolder = useCallback(() => {
    setNewFolderParent(null);
    setNewFolderName("");
  }, []);

  const resetDialogs = useCallback(() => {
    setRenamePrompt(null);
    setRenameDraftName("");
    setNewFileParent(null);
    setNewFileName("");
    setNewFolderParent(null);
    setNewFolderName("");
  }, []);

  return {
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
  };
}
