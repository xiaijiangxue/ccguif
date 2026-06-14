import { useTranslation } from "react-i18next";
import {
  ALL_FILTER_CATEGORIES,
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
  const hiddenCategories = useFileTreeStore((s) => s.hiddenCategories);
  const fileTreeStoreApi = useFileTreeStoreApi();

  const visibleCategories = ALL_FILTER_CATEGORIES.filter(
    (cat) => !hiddenCategories.has(cat),
  );

  const toggleCategory = (cat: FilterCategory) => {
    fileTreeStoreApi.getState().toggleCategory(cat);
  };

  if (visibleCategories.length === 0) return null;

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
    </div>
  );
}
