import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import ExternalLink from "lucide-react/dist/esm/icons/external-link";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";

type FileTreeRootActionsProps = {
  onOpenDetachedExplorer?: (initialFilePath?: string | null) => void;
  detachedInitialFilePath?: string | null;
  onRefreshFiles?: () => void | Promise<void>;
  showDetachedExplorerAction?: boolean;
};

export function FileTreeRootActions({
  onOpenDetachedExplorer,
  detachedInitialFilePath,
  onRefreshFiles,
  showDetachedExplorerAction = false,
}: FileTreeRootActionsProps) {
  const { t } = useTranslation();
  const [spinningAction, setSpinningAction] = useState<string | null>(null);
  const spinTimerRef = useRef<number | null>(null);
  const spinRafRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (spinTimerRef.current !== null) {
        window.clearTimeout(spinTimerRef.current);
      }
      if (spinRafRef.current !== null) {
        window.cancelAnimationFrame(spinRafRef.current);
      }
    };
  }, []);

  const triggerActionWithSpin = useCallback((actionId: string, action: () => void) => {
    if (spinTimerRef.current !== null) {
      window.clearTimeout(spinTimerRef.current);
      spinTimerRef.current = null;
    }
    if (spinRafRef.current !== null) {
      window.cancelAnimationFrame(spinRafRef.current);
      spinRafRef.current = null;
    }

    // Reset first so repeated clicks on the same action can replay animation reliably.
    setSpinningAction(null);
    spinRafRef.current = window.requestAnimationFrame(() => {
      spinRafRef.current = null;
      setSpinningAction(actionId);
      spinTimerRef.current = window.setTimeout(() => {
        setSpinningAction((current) => (current === actionId ? null : current));
        spinTimerRef.current = null;
      }, 420);
    });

    try {
      action();
    } catch (error) {
      console.error("[file-tree-root-actions] action handler failed", error);
    }
  }, []);

  return (
    <div className="file-tree-root-actions">
      {showDetachedExplorerAction ? (
        <button
          type="button"
          className={`ghost icon-button file-tree-root-action${spinningAction === "detached" ? " is-spinning" : ""}`}
          onClick={() =>
            triggerActionWithSpin("detached", () => onOpenDetachedExplorer?.(detachedInitialFilePath))
          }
          disabled={!onOpenDetachedExplorer}
          aria-label={t("files.openDetachedExplorer")}
          title={t("files.openDetachedExplorer")}
        >
          <ExternalLink aria-hidden />
        </button>
      ) : null}
      <button
        type="button"
        className={`ghost icon-button file-tree-root-action${spinningAction === "refresh" ? " is-spinning" : ""}`}
        onClick={() => triggerActionWithSpin("refresh", () => onRefreshFiles?.())}
        disabled={!onRefreshFiles}
        aria-label={t("files.refreshFiles")}
        title={t("files.refreshFiles")}
      >
        <RefreshCw aria-hidden />
      </button>
    </div>
  );
}
