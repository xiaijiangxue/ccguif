import { convertFileSrc } from "@tauri-apps/api/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { readWorkspaceFile } from "../../../services/tauri";
import { languageFromPath } from "../../../utils/syntax";
import { createFileDocumentSnapshot } from "../utils/fileDocumentSnapshot";

type PreviewAnchor = {
  top: number;
  left: number;
  arrowTop: number;
  height: number;
};

type PreviewSelection = {
  start: number;
  end: number;
};

type PreviewKind = "image" | "text";

const imageExtensions = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "svg",
  "webp",
  "avif",
  "bmp",
  "heic",
  "heif",
  "tif",
  "tiff",
]);

function isImagePath(path: string) {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return imageExtensions.has(ext);
}

export function useFilePreview({
  workspaceId,
  resolvePath,
  onInsertText,
}: {
  workspaceId: string;
  resolvePath: (relativePath: string) => string;
  onInsertText?: (text: string) => void;
}) {
  const [path, setPath] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<PreviewAnchor | null>(null);
  const [content, setContent] = useState("");
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<PreviewSelection | null>(null);
  const [isDragSelecting, setIsDragSelecting] = useState(false);
  const dragAnchorLineRef = useRef<number | null>(null);
  const dragMovedRef = useRef(false);

  const kind = useMemo<PreviewKind>(
    () => (path && isImagePath(path) ? "image" : "text"),
    [path],
  );

  const imageSrc = useMemo(() => {
    if (!path || kind !== "image") {
      return null;
    }
    try {
      return convertFileSrc(resolvePath(path));
    } catch {
      return null;
    }
  }, [kind, path, resolvePath]);

  const close = useCallback(() => {
    setPath(null);
    setAnchor(null);
    setSelection(null);
    setContent("");
    setTruncated(false);
    setError(null);
    setLoading(false);
    setIsDragSelecting(false);
    dragAnchorLineRef.current = null;
    dragMovedRef.current = false;
  }, []);

  const open = useCallback((nextPath: string, target: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    const estimatedWidth = 640;
    const estimatedHeight = 520;
    const padding = 16;
    const maxHeight = Math.min(estimatedHeight, window.innerHeight - padding * 2);
    const left = Math.min(
      Math.max(padding, rect.left - estimatedWidth - padding),
      Math.max(padding, window.innerWidth - estimatedWidth - padding),
    );
    const top = Math.min(
      Math.max(padding, rect.top - maxHeight * 0.35),
      Math.max(padding, window.innerHeight - maxHeight - padding),
    );
    const arrowTop = Math.min(
      Math.max(16, rect.top + rect.height / 2 - top),
      Math.max(16, maxHeight - 16),
    );
    setPath(nextPath);
    setAnchor({ top, left, arrowTop, height: maxHeight });
    setSelection(null);
    setIsDragSelecting(false);
    dragAnchorLineRef.current = null;
    dragMovedRef.current = false;
  }, []);

  useEffect(() => {
    if (!path) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [close, path]);

  useEffect(() => {
    if (!path) {
      return;
    }
    let cancelled = false;
    if (kind === "image") {
      setContent("");
      setTruncated(false);
      setError(null);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }
    setLoading(true);
    setError(null);
    readWorkspaceFile(workspaceId, path)
      .then((response) => {
        if (cancelled) {
          return;
        }
        setContent(response.content ?? "");
        setTruncated(Boolean(response.truncated));
      })
      .catch((loadError) => {
        if (cancelled) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : String(loadError));
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [kind, path, workspaceId]);

  useEffect(() => {
    if (!isDragSelecting) {
      return;
    }
    const handleMouseUp = () => {
      setIsDragSelecting(false);
      dragAnchorLineRef.current = null;
    };
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, [isDragSelecting]);

  const selectRangeFromAnchor = useCallback((anchorIndex: number, index: number) => {
    const start = Math.min(anchorIndex, index);
    const end = Math.max(anchorIndex, index);
    setSelection({ start, end });
  }, []);

  const selectLine = useCallback(
    (index: number, event: MouseEvent<HTMLButtonElement>) => {
      if (dragMovedRef.current) {
        dragMovedRef.current = false;
        return;
      }
      if (event.shiftKey && selection) {
        selectRangeFromAnchor(selection.start, index);
        return;
      }
      setSelection({ start: index, end: index });
    },
    [selectRangeFromAnchor, selection],
  );

  const lineMouseDown = useCallback(
    (index: number, event: MouseEvent<HTMLButtonElement>) => {
      if (kind !== "text" || event.button !== 0) {
        return;
      }
      event.preventDefault();
      setIsDragSelecting(true);
      const anchorIndex = event.shiftKey && selection ? selection.start : index;
      dragAnchorLineRef.current = anchorIndex;
      dragMovedRef.current = false;
      selectRangeFromAnchor(anchorIndex, index);
    },
    [kind, selectRangeFromAnchor, selection],
  );

  const lineMouseEnter = useCallback(
    (index: number) => {
      if (!isDragSelecting) {
        return;
      }
      const anchorIndex = dragAnchorLineRef.current;
      if (anchorIndex === null) {
        return;
      }
      if (anchorIndex !== index) {
        dragMovedRef.current = true;
      }
      selectRangeFromAnchor(anchorIndex, index);
    },
    [isDragSelecting, selectRangeFromAnchor],
  );

  const lineMouseUp = useCallback(() => {
    if (!isDragSelecting) {
      return;
    }
    setIsDragSelecting(false);
    dragAnchorLineRef.current = null;
  }, [isDragSelecting]);

  const documentSnapshot = useMemo(
    () => createFileDocumentSnapshot(content, truncated, 0),
    [content, truncated],
  );

  const addSelection = useCallback(() => {
    if (kind !== "text" || !path || !selection || !onInsertText) {
      return;
    }
    const selected = documentSnapshot.getLines(selection.start, selection.end + 1);
    const language = languageFromPath(path);
    const fence = language ? `\`\`\`${language}` : "```";
    const start = selection.start + 1;
    const end = selection.end + 1;
    const rangeLabel = start === end ? `L${start}` : `L${start}-L${end}`;
    const snippet = `${path}:${rangeLabel}\n${fence}\n${selected.join("\n")}\n\`\`\``;
    onInsertText(snippet);
    close();
  }, [close, documentSnapshot, kind, onInsertText, path, selection]);

  return {
    path,
    anchor,
    content,
    truncated,
    loading,
    error,
    selection,
    kind,
    imageSrc,
    open,
    close,
    setSelection,
    selectLine,
    lineMouseDown,
    lineMouseEnter,
    lineMouseUp,
    addSelection,
  };
}
