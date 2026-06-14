import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Plus from "lucide-react/dist/esm/icons/plus";
import {
  ALL_FILTER_CATEGORIES,
  matchesFilterCategory,
} from "../utils/treeModel";
import { useFileTreeStore, useFileTreeStoreApi } from "../stores/fileTreeStoreContext";
import type { FilterCategory } from "../stores/types";

const CATEGORY_LABELS: Record<FilterCategory, string> = {
  Dependencies: "Dependencies",
  BuildArtifacts: "Build Artifacts",
  IDEConfig: "IDE Config",
};

export function FileTreeFilterControl() {
  const { t } = useTranslation();
  const fileTreeStoreApi = useFileTreeStoreApi();
  const hiddenCategories = useFileTreeStore((s) => s.hiddenCategories);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const visibleCategories = ALL_FILTER_CATEGORIES.filter(
    (cat) => !hiddenCategories.has(cat),
  );
  const hiddenCategoryList = ALL_FILTER_CATEGORIES.filter((cat) =>
    hiddenCategories.has(cat),
  );

  const toggleCategory = useCallback(
    (cat: FilterCategory) => {
      fileTreeStoreApi.getState().toggleCategory(cat);
    },
    [fileTreeStoreApi],
  );

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
    <div className="file-tree-filter-control">
      {visibleCategories.map((cat) => (
        <button
          key={cat}
          type="button"
          className="file-tree-filter-chip"
          onClick={() => toggleCategory(cat)}
          title={`Hide ${CATEGORY_LABELS[cat]}`}
        >
          {CATEGORY_LABELS[cat]}
        </button>
      ))}
      {hiddenCategoryList.length > 0 ? (
        <div className="file-tree-filter-dropdown-wrap" ref={dropdownRef}>
          <button
            type="button"
            className="ghost icon-button file-tree-filter-add"
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
                    toggleCategory(cat);
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
