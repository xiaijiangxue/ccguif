---
date: 2026-06-14
topic: file-tree-loading-architecture-refactor
---

# File Tree Loading Architecture Refactor

## Summary

Extract file tree state management from the monolithic `FileTreePanel.tsx` (3373 lines, 10+ useState) into a Zustand store, and merge the dual rendering paths (recursive `renderNode` vs flat `renderVirtualTreeRow`) into a single flatten-then-virtualize pipeline using the existing `@tanstack/react-virtual`.

## Problem Frame

`FileTreePanel.tsx` has grown into a 3373-line monolith that handles tree building, lazy loading orchestration, virtualization, selection, context menus, file operations, preview, drag-and-drop, and keyboard shortcuts. The lazy loading state alone uses 10+ useState/Ref pairs (`lazyFiles`, `lazyDirectories`, `loadedLazyDirectories`, `loadingLazyDirectories`, `lazyDirectoryLoadErrors`, `lazyDirectoryMetadata`, `lazyLoadableDirectories`, `lazyGitignoredFiles`, `lazyGitignoredDirectories`, `lazyLoadEpochRef`, etc.), with corresponding ref mirrors for async operations.

Two completely separate rendering functions exist — `renderNode` (recursive, used below 250 rows) and `renderVirtualTreeRow` (flat, used above 250 rows) — duplicating click handling, drag logic, keyboard events, and git status display. Maintaining consistency between them is a constant risk.

This architecture makes the component difficult to test, reason about, and extend. State is lost on unmount. Async operations lack proper cancellation. The prefetch queue is unbounded.

## Requirements

### State Management Extraction

- R1. Tree state (expanded folders, children cache, loading states, errors) is managed by a Zustand store, not component-local useState.
- R2. The store exposes selector-based subscriptions so individual tree rows re-render only when their own state changes (expanded, loading, children) — not when unrelated nodes update.
- R3. Children cache is a `Map<path, Node[]>` keyed by directory path, with per-entry loading/error metadata. The store owns this cache; components read from it.
- R4. Lazy load state includes: `loadingDirs: Set<string>`, `loadedDirs: Set<string>`, `loadErrors: Map<string, string>`. Ref-based deduplication for in-flight requests is preserved (prevents duplicate fetches between renders).
- R5. An epoch counter (`lazyLoadEpochRef` equivalent) in the store invalidates stale async responses when the workspace changes.

### Unified Rendering Path

- R6. A single `flattenVisibleTree(data, expandedIds)` function produces the flat list of visible rows with depth information, replacing both `renderNode` and `renderVirtualTreeRow`.
- R7. The flat list feeds `@tanstack/react-virtual`'s `useVirtualizer` unconditionally — virtualization is always active (the 250-row threshold is removed; react-virtual handles small lists efficiently with zero overhead).
- R8. Each row is a `React.memo`-wrapped component receiving minimal props (node data, depth, event handlers). This eliminates the current inline arrow functions that break memoization.
- R9. Event handlers (click, double-click, context menu, drag) are stable callback references via `useCallback` in the store or parent, not recreated per-render inline functions.

### Lazy Loading Pipeline

- R10. Lazy loading follows the standard pattern: expand → check cache → if miss, show loading indicator → fetch via Tauri IPC → write to store cache → hide loading indicator.
- R11. Prefetch logic: after loading a directory's visible children, queue prefetch for immediate child directories. Prefetch is bounded (max N concurrent, configurable).
- R12. The prefetch queue uses a bounded concurrency controller (e.g., p-limit pattern) instead of the current unbounded `pendingPrefetchDirectoryLoadsRef`.

### Maintainability

- R13. `FileTreePanel.tsx` is decomposed into: Zustand store module, tree builder (pure function), row component, tree container component, and event handler hooks.
- R14. The tree builder (`buildTree` / `flattenVisibleTree`) is a pure function with no React dependency — testable independently.
- R15. Existing behaviors are preserved: folder chain collapsing, special directory handling (node_modules, dist, etc.), active editor sync scroll, FileTreeChildren expand/collapse animation.

## Key Decisions

- **Zustand over Context/useReducer.** Zustand's selector pattern prevents the re-render cascade that a single React Context would cause. Each row subscribes to only its own slice. This is the approach used by react-arborist (Redux + useSyncExternalStore, same principle) and recommended across Chinese developer communities for large trees.
- **Always-virtualize over threshold.** The 250-row threshold adds branching logic with no measurable benefit — @tanstack/react-virtual with fixed-size rows costs near-zero for small lists. Removing the threshold eliminates ~200 lines of duplicate rendering code.
- **Incremental migration over big-bang rewrite.** The Zustand store can be introduced alongside the existing useState logic. Components switch to store selectors one at a time. The dual rendering path merges last. This reduces risk compared to rewriting FileTreePanel from scratch.

## Scope Boundaries

**Deferred for later:**
- Backend streaming / pagination API for large directories (the `has_more` field exists in `WorkspaceDirectoryEntry` but is unused in the tree panel — leveraging it requires backend changes)
- Search / filter UI in the file tree
- Expanded state persistence across sessions
- Drag-and-drop architecture improvements

**Outside this refactor:**
- Detached file explorer window (`DetachedFileExplorerWindow.tsx`) — separate component tree, can adopt the store later
- File operations (rename, copy, paste, delete) — stay in their current location, consume store state via selectors
- File watcher / polling logic — lives in `useWorkspaceFiles`, outside the tree component

## Sources / Research

- VS Code file explorer: `AsyncDataTree` with `IAsyncDataSource`, `ObjectTreeModel` with collapse state preservation, `CompressibleObjectTreeModel` for path compression. Source: `src/vs/base/browser/ui/tree/`
- Zed project panel: `SumTree` B-tree with `EntrySummary` accumulators, `UniformList` virtualization, `BackgroundScanner` with channel-based async. Source: `crates/project_panel/src/project_panel.rs`
- react-arborist: Redux store with 6 slices, `flattenTree` via DFS on open nodes, react-window `FixedSizeList`. Source: `github.com/brimdata/react-arborist`
- rc-tree (antd): `flattenTreeData` with `isStart/isEnd` arrays for tree lines, `keyEntities` Map for O(1) lookup. Source: `github.com/react-component/tree`
- Chinese developer community patterns: Zustand + Set\<id\> for expand state, `Map<path, Node[]>` for children cache, `requestIdleCallback` for prefetch scheduling
