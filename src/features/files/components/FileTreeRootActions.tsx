import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import ExternalLink from "lucide-react/dist/esm/icons/external-link";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import Plus from "lucide-react/dist/esm/icons/plus";
import type { FilterCategory } from "../stores/types";

const CATEGORY_LABELS: Record<FilterCategory, string> = {
  Dependencies: "Dependencies",
  BuildArtifacts: "Build Artifacts",
  IDEConfig: "IDE Config",
};

type FileTreeRootActionsProps = {
  onOpenDetachedExplorer?: (initialFilePath?: string | null) => void;
  detachedInitialFilePath?: string | null;
  onRefreshFiles?: () => void | Promise<void>;
  showDetachedExplorerAction?: boolean;
  /** Filter dropdown: list of hidden categories to show in the add menu */
  hiddenCategoryList?: FilterCategory[];
  /** Filter dropdown: toggle a category's visibility */
  onToggleCategory?: (cat: FilterCategory) => void;
};

export function FileTreeRootActions({
  onOpenDetachedExplorer,
  detachedInitialFilePath,
  onRefreshFiles,
  showDetachedExplorerAction = false,
  hiddenCategoryList = [],
  onToggleCategory,
}: FileTreeRootActionsProps) {
  const { t } = useTranslation();
  const [spinningAction, setSpinningAction] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
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

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [dropdownOpen]);

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
      {hiddenCategoryList.length > 0 ? (
        <div className="file-tree-filter-dropdown-wrap" ref={dropdownRef}>
          <button
            type="button"
            className="ghost icon-button file-tree-root-action"
            onClick={() => setDropdownOpen((prev) => !prev)}
            title={t("files.showFilterCategories")}
            aria-label={t("files.showFilterCategories")}
            aria-expanded={dropdownOpen}
          >
            <Plus aria-hidden />
          </button>
          {dropdownOpen ? (
            <div className="file-tree-filter-dropdown" role="menu">
              {hiddenCategoryList.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className="file-tree-filter-dropdown-item"
                  role="menuitem"
                  onClick={() => {
                    onToggleCategory?.(cat);
                    setDropdownOpen(false);
                  }}
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
