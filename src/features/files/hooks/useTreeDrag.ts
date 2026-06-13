import { emitTo } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef } from "react";
import type { DragEvent } from "react";
import {
  writeDetachedFileTreeDragSnapshot,
  DETACHED_FILE_TREE_DRAG_BRIDGE_EVENT,
  type DetachedFileTreeDragBridgePayload,
} from "../detachedFileTreeDragBridge";
import {
  bindChatDropTargetsForTreeDrag,
  clearFileTreeDragBridge,
  createWindowsFileTreeDragImage,
  CROSS_WINDOW_TREE_DRAG_REBROADCAST_THROTTLE_MS,
  insertPathsIntoChat,
  isWindowsDragPreviewRuntime,
  setFileTreeDragBridge,
  setFileTreeDragPosition,
  triggerChatInputInsertFromTreeDrag,
} from "../utils/fileTreeDragBridge";
import type { FileTreeNode } from "../utils/treeModel";

export function useTreeDrag({
  crossWindowDragTargetLabel,
  orderedSelectedNodePaths,
  resolvePath,
  setSingleSelection,
}: {
  crossWindowDragTargetLabel?: string | null;
  orderedSelectedNodePaths: string[];
  resolvePath: (relativePath: string) => string;
  setSingleSelection: (path: string, type: "file" | "folder") => void;
}) {
  const activeCrossWindowDragPathsRef = useRef<string[]>([]);
  const lastCrossWindowDragBroadcastRef = useRef(0);
  const dragImageCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      dragImageCleanupRef.current?.();
      dragImageCleanupRef.current = null;
    };
  }, []);

  const broadcastCrossWindowTreeDrag = useCallback(
    (payload: DetachedFileTreeDragBridgePayload) => {
      if (!crossWindowDragTargetLabel) {
        return;
      }
      if (payload.type === "start") {
        writeDetachedFileTreeDragSnapshot(payload.paths);
      }
      void emitTo(
        crossWindowDragTargetLabel,
        DETACHED_FILE_TREE_DRAG_BRIDGE_EVENT,
        payload,
      ).catch(() => {});
    },
    [crossWindowDragTargetLabel],
  );

  const rebroadcastCrossWindowTreeDrag = useCallback(() => {
    if (!crossWindowDragTargetLabel) {
      return;
    }
    const paths = activeCrossWindowDragPathsRef.current;
    if (paths.length === 0) {
      return;
    }
    const now = Date.now();
    if (
      now - lastCrossWindowDragBroadcastRef.current <
      CROSS_WINDOW_TREE_DRAG_REBROADCAST_THROTTLE_MS
    ) {
      return;
    }
    lastCrossWindowDragBroadcastRef.current = now;
    broadcastCrossWindowTreeDrag({
      type: "start",
      paths,
    });
  }, [broadcastCrossWindowTreeDrag, crossWindowDragTargetLabel]);

  const handleDragStart = useCallback(
    (node: FileTreeNode, isSelected: boolean, event: DragEvent<HTMLButtonElement>) => {
      const dragSourcePaths = isSelected ? orderedSelectedNodePaths : [node.path];
      const uniqueSourcePaths = Array.from(new Set(dragSourcePaths));
      if (uniqueSourcePaths.length === 0) {
        return;
      }
      if (!isSelected) {
        setSingleSelection(node.path, node.type);
      }
      if (
        typeof window !== "undefined" &&
        (window.__fileTreeDragActive === true ||
          typeof window.__fileTreeDragCleanup === "function")
      ) {
        clearFileTreeDragBridge();
      }
      const absolutePaths = uniqueSourcePaths.map((path) => resolvePath(path));
      activeCrossWindowDragPathsRef.current = absolutePaths;
      lastCrossWindowDragBroadcastRef.current = Date.now();
      dragImageCleanupRef.current?.();
      dragImageCleanupRef.current = null;
      setFileTreeDragBridge(absolutePaths);
      window.__fileTreeDragCleanup = bindChatDropTargetsForTreeDrag(absolutePaths);
      setFileTreeDragPosition(event.clientX, event.clientY);
      broadcastCrossWindowTreeDrag({ type: "start", paths: absolutePaths });
      if (!event.dataTransfer) {
        return;
      }
      const encodedPaths = JSON.stringify(absolutePaths);
      event.dataTransfer.effectAllowed = "copy";
      event.dataTransfer.setData("application/x-ccgui-file-paths", encodedPaths);
      event.dataTransfer.setData("text/plain", absolutePaths.join("\n"));
      if (
        isWindowsDragPreviewRuntime() &&
        typeof event.dataTransfer.setDragImage === "function"
      ) {
        const preview = createWindowsFileTreeDragImage(
          absolutePaths[0] ?? "",
          absolutePaths.length,
          node.type === "folder",
        );
        if (preview) {
          event.dataTransfer.setDragImage(preview.element, 18, 14);
          dragImageCleanupRef.current = preview.cleanup;
        }
      }
    },
    [broadcastCrossWindowTreeDrag, orderedSelectedNodePaths, resolvePath, setSingleSelection],
  );

  const handleDrag = useCallback(
    (event: DragEvent<HTMLButtonElement>) => {
      setFileTreeDragPosition(event.clientX, event.clientY);
      rebroadcastCrossWindowTreeDrag();
    },
    [rebroadcastCrossWindowTreeDrag],
  );

  const handleDragEnd = useCallback((event: DragEvent<HTMLButtonElement>) => {
    activeCrossWindowDragPathsRef.current = [];
    lastCrossWindowDragBroadcastRef.current = 0;
    dragImageCleanupRef.current?.();
    dragImageCleanupRef.current = null;
    if (typeof window !== "undefined" && window.__fileTreeDragDropped === true) {
      clearFileTreeDragBridge();
      return;
    }
    const inserted = triggerChatInputInsertFromTreeDrag(
      event,
      window.__fileTreeDragPaths ?? [],
    );
    if (!inserted) {
      const fallbackPaths = window.__fileTreeDragPaths ?? [];
      const hasChatInput = Boolean(document.querySelector(".chat-input-box"));
      if (hasChatInput && fallbackPaths.length > 0) {
        insertPathsIntoChat(fallbackPaths);
      }
    }
    clearFileTreeDragBridge();
  }, []);

  return {
    handleDragStart,
    handleDrag,
    handleDragEnd,
  };
}
