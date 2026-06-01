import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  DETACHED_FILE_EXPLORER_SESSION_EVENT,
  type DetachedFileExplorerSession,
  normalizeDetachedFileExplorerSession,
  readDetachedFileExplorerSessionSnapshot,
  writeDetachedFileExplorerSessionSnapshot,
} from "../detachedFileExplorer";

export function useDetachedFileExplorerSession() {
  const [windowLabel, setWindowLabel] = useState<string | null>(null);
  const [session, setSession] = useState<DetachedFileExplorerSession | null>(null);

  useEffect(() => {
    let unlisten: (() => void) | null = null;

    try {
      const currentWindow = getCurrentWindow();
      const currentWindowLabel = currentWindow.label ?? null;
      setWindowLabel(currentWindowLabel);
      setSession(readDetachedFileExplorerSessionSnapshot(currentWindowLabel));
      currentWindow
        .listen<DetachedFileExplorerSession>(
          DETACHED_FILE_EXPLORER_SESSION_EVENT,
          (event) => {
            const nextSession = normalizeDetachedFileExplorerSession(event.payload);
            if (!nextSession) {
              return;
            }
            const nextWindowLabel = nextSession.windowLabel ?? currentWindowLabel;
            writeDetachedFileExplorerSessionSnapshot(nextSession, nextWindowLabel);
            setSession(nextSession);
          },
        )
        .then((handler) => {
          unlisten = handler;
        })
        .catch(() => {});
    } catch {
      // Non-Tauri test environments fall back to the persisted snapshot only.
      setSession(readDetachedFileExplorerSessionSnapshot());
    }

    return () => {
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (session || !windowLabel) {
      return;
    }
    setSession(readDetachedFileExplorerSessionSnapshot(windowLabel));
  }, [session, windowLabel]);

  return session;
}
