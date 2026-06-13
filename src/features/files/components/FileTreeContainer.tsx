import { useVirtualizer } from "@tanstack/react-virtual";
import LoaderCircle from "lucide-react/dist/esm/icons/loader-circle";
import { type ReactNode, useEffect, useRef } from "react";
import type { VisibleFileTreeRow } from "../utils/treeModel";

export type FileTreeContainerProps = {
  rows: VisibleFileTreeRow[];
  isRootExpanded: boolean;
  isLoading: boolean;
  hasTreeEntries: boolean;
  loadError: string | null;
  loadingLabel: string;
  emptyLabel: string;
  loadErrorLabel: string;
  retryLabel: string;
  onRetry?: () => void;
  renderRow: (row: VisibleFileTreeRow) => ReactNode;
  onRowsReady?: (api: { scrollToIndex: (index: number) => void }) => void;
};

export function FileTreeContainer({
  rows,
  isRootExpanded,
  isLoading,
  hasTreeEntries,
  loadError,
  loadingLabel,
  emptyLabel,
  loadErrorLabel,
  retryLabel,
  onRetry,
  renderRow,
  onRowsReady,
}: FileTreeContainerProps) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 28,
    overscan: 16,
    getItemKey: (index) => {
      const row = rows[index];
      if (!row) {
        return index;
      }
      return row.kind === "node"
        ? row.entry.path
        : `${row.path}:lazy-${row.state}`;
    },
  });

  useEffect(() => {
    onRowsReady?.({
      scrollToIndex: (index) => rowVirtualizer.scrollToIndex(index, { align: "auto" }),
    });
  }, [onRowsReady, rowVirtualizer]);

  return (
    <div
      ref={listRef}
      className="file-tree-list is-virtualized"
      data-file-tree-row-count={rows.length}
    >
      {isLoading ? (
        <div className="file-tree-loading-row" role="status" aria-live="polite">
          <LoaderCircle className="file-tree-loading-spinner" size={13} aria-hidden />
          <span>{loadingLabel}</span>
        </div>
      ) : !isRootExpanded ? null : loadError && !hasTreeEntries ? (
        <div className="file-tree-empty" title={loadError}>
          <div>{loadErrorLabel}</div>
          {onRetry ? (
            <button
              type="button"
              className="file-tree-lazy-retry"
              onClick={onRetry}
              title={loadError}
            >
              {retryLabel}
            </button>
          ) : null}
        </div>
      ) : !hasTreeEntries ? (
        <div className="file-tree-empty">{emptyLabel}</div>
      ) : (
        <div
          className="file-tree-virtual-spacer"
          style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index];
            if (!row) {
              return null;
            }
            return (
              <div
                key={virtualRow.key}
                ref={rowVirtualizer.measureElement}
                data-index={virtualRow.index}
                className="file-tree-virtual-row"
                style={{ transform: `translateY(${virtualRow.start}px)` }}
              >
                {renderRow(row)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
