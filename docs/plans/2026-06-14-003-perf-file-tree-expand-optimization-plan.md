---
title: "perf(file-tree): optimize expand latency with smart filtering and rendering pipeline"
type: perf
status: active
date: 2026-06-14
origin: docs/brainstorms/2026-06-14-file-tree-expand-perf-requirements.md
---

# Optimize File Tree Expand Latency

## Summary

Optimize the file tree panel folder-expand response time through two strategies: category-based smart filtering (hiding dependencies, build artifacts, and IDE config to reduce rendering surface) and rendering pipeline optimization (deferring non-critical computations with `React.startTransition` and caching the git2 Repository handle on the backend).

## Problem Frame

Expanding a folder with 100+ files in the file tree causes visible UI lag. The root cause is a cascade of synchronous `useMemo` recomputations in `FileTreePanel.tsx` — when a directory children arrive, `patchTree` sorts them, `flattenVisibleTree` rebuilds the full visible row list, and downstream memos (`folderGitStatusMap`, `visibleTreePathOrder`, `visibleTreePathTypeMap`) all recompute synchronously before the browser can paint. Additionally, the file tree surfaces every file in the workspace including large dependency directories (node_modules), build artifacts (dist, build), and IDE config files (.idea, .vscode), which occupy visual space and invite expansion into lag-prone territory.

The project already has solid foundations: virtualization via `@tanstack/react-virtual`, lazy directory loading, backend scan budgets (30k entries / 1.2s timeout), and incremental tree patching via `patchTree`. Several requirements from the origin document (R1, R2, R4, R9) are already implemented and only need verification. The remaining work targets the computation cascade, backend git handle overhead, prefetch IPC reduction, and the new filtering feature.

## Requirements

Carried from origin (`docs/brainstorms/2026-06-14-file-tree-expand-perf-requirements.md`):

- R3. Lazy git status with prefetch for visible rows only — **deferred** (see Scope Boundaries; origin P4 deferral)
- R4b. `React.startTransition` for deferred secondary computations
- R5. Merge prefetch visible+ignored IPC calls into one (Scope::All)
- R7c. Cache `git2::Repository` handle across workspace session
- R8. 50ms debounce on folder expand (already implemented, verify)
- R10-R16. Category-based smart file filtering with UI controls
- R1/R2/R4/R9. Already implemented — verification only (no code changes)

Success criteria: S1 (<200ms for ~100 children), S1b (<300ms for ~500+ children), SF1-SF3 (filter toggle instant, state preserved, 2-click reveal).

---

## Key Technical Decisions

KTD1. **Filtering at tree-build time, not backend.** Filtering happens in `buildTree()` / `flattenVisibleTree` and in the incremental `patchTree` call site, rather than adding a backend filter parameter. This keeps the backend API stable, lets the frontend toggle filters instantly without a round-trip, and avoids duplicating filter logic. The trade-off is that the backend still scans and transfers excluded directories — acceptable because rendering surface reduction reduces visual clutter, but the memo cascade (the primary cause of S1/S1b miss) still requires startTransition (U5). (see origin)

KTD2. **Category definitions reuse existing frontend classification.** Dependencies and Build Artifacts reuse `is_special_directory_path()` and `SPECIAL_BUILD_ARTIFACT_DIRECTORIES` from `treeModel.ts`. IDE Config uses frontend-only hardcoded path segments since no backend classifier exists. `__pycache__` maps to Build Artifacts (matching `is_special_build_artifact_dir_name` in `files.rs`), not Dependencies. (see origin)

KTD3. **`startTransition` over `useDeferredValue`.** The transition approach batches secondary memos (`folderGitStatusMap`, `visibleTreePathOrder`, `visibleTreePathTypeMap`) into a single deferred pass. `useDeferredValue` would defer individual values independently with less control over grouping. (see origin)

KTD4. **Prefetch IPC merge targets the prefetch cascade only.** The primary expand for non-special directories already uses `getWorkspaceDirectoryChildren(Scope::All)`. The merge targets the prefetch path where `flushPrefetchDirectoryLoadQueue` makes sequential visible-then-ignored calls per child directory. (see origin)

KTD5. **Repository handles cached per-workspace in `AppState`.** `git2::Repository` handles are stored in `workspace_repo_handles: Mutex<HashMap<String, Arc<Mutex<Repository>>>>` on `AppState`, mirroring the existing `sessions` pattern. Each workspace's handle is opened once per session and invalidated on workspace close or git re-init. Expected saving: 10-30ms per expand on large repos. (see origin)

KTD6. **Filter persistence via localStorage (deviation from R15).** Origin R15 specifies "existing workspace settings," but the project's `WorkspaceSettings` type is a serializable config struct persisted through the backend — adding filter state there would require backend API changes disproportionate to the feature. localStorage keyed by workspace ID provides equivalent per-workspace persistence with zero backend changes. Trade-off: filter state won't sync with workspace backup/restore.

---

## Implementation Units

### U1. Verification audit (R1/R2/R4/R8/R9)

**Goal:** Confirm that five already-implemented requirements are correctly wired and no regressions exist.

**Requirements:** R1 (incremental patchTree), R2 (useMemo dependency audit), R4 (incremental snapshot), R8 (50ms debounce), R9 (skip redundant calls)

**Dependencies:** None

**Files:**
- `src/features/files/utils/treeModel.ts`
- `src/features/files/components/FileTreePanel.tsx`
- `src/features/files/hooks/useLazyFileTree.ts`

**Approach:**
- Verify `patchTree` is invoked for all single-directory expand operations (FileTreePanel.tsx nodes useMemo, lines 394-454)
- Verify `patchDirectoryCacheSnapshot` is invoked for single-entry cache changes (lines 219-254)
- Confirm no `useMemo` depends on `expandedFolders` unless it logically should (visibleTreeNodeEntries, visibleFileTreeRows, folderGitStatusMap)
- Verify debounce via `lastToggleTimeRef` at 50ms (line 836)
- Verify `loadedLazyDirectoriesRef` / `loadingLazyDirectoriesRef` guard redundant calls (useLazyFileTree.ts:118-119)

**Test scenarios:**
- Expand a directory with 50+ children — confirm `patchTree` is called, not full `buildTree`
- Collapse and re-expand the same directory — confirm no redundant IPC call (guard active)
- Double-click a folder rapidly — confirm only one expand fires (debounce active)
- Expand a directory, then expand a child directory — confirm `patchDirectoryCacheSnapshot` patches incrementally

**Verification:** All five requirements pass audit with no code changes needed. Document any findings in Open Questions. **Note:** Re-verify R1 (patchTree invocation) after U4 is implemented, since U4 modifies the patchTree call site to add filtering.

---

### U2. Smart file filtering infrastructure (R10-R13, R15)

**Goal:** Implement category-based filter state management and path matching logic.

**Requirements:** R10 (category toggles), R11 (category definitions), R12 (reuse existing classification), R13 (default hidden), R15 (persistence)

**Dependencies:** U1 (verification audit confirms existing patterns)

**Files:**
- `src/features/files/utils/treeModel.ts` (add `matchesFilterCategory()` function, filter category enum)
- `src/features/files/stores/fileTreeStore.ts` (add `hiddenCategories` state, `toggleCategory` action)
- `src/features/files/stores/types.ts` (add FilterCategory type)

**Approach:**
- Define `FilterCategory` enum: `Dependencies`, `BuildArtifacts`, `IDEConfig`
- Add `FILTER_CATEGORY_PATHS: Record<FilterCategory, string[]>` mapping categories to directory name segments (reusing `SPECIAL_DEPENDENCY_DIRECTORIES` and `SPECIAL_BUILD_ARTIFACT_DIRECTORIES` from treeModel.ts for Dependencies/BuildArtifacts; hardcoded `.idea`, `.vscode`, `.vs`, `.project`, `.classpath`, `.settings` for IDEConfig)
- Add `matchesFilterCategory(dirName: string, hidden: Set<FilterCategory>): boolean`
- Add `hiddenCategories: Set<FilterCategory>` to the file tree store, defaulting to all three categories hidden
- Add `toggleCategory(cat: FilterCategory)` action
- Persist `hiddenCategories` to localStorage keyed by workspace ID (R15)
- Load persisted state on store initialization

**Test scenarios:**
- Create store with defaults — all three categories in `hiddenCategories`
- Toggle Dependencies off — confirm `hiddenCategories` no longer contains Dependencies
- Persist and reload — confirm state survives (mock localStorage)
- `matchesFilterCategory("node_modules", new Set([FilterCategory.Dependencies]))` returns true
- `matchesFilterCategory("src", new Set([FilterCategory.Dependencies]))` returns false
- `matchesFilterCategory("__pycache__", new Set([FilterCategory.BuildArtifacts]))` returns true

**Verification:** Store manages filter state correctly. Path matching covers all three categories. Persistence round-trips correctly.

---

### U3. Filter UI control (R16)

**Goal:** Implement the filter control chips and dropdown in the file tree panel header.

**Requirements:** R16 (filter control with chips and dropdown)

**Dependencies:** U2 (filter state infrastructure)

**Files:**
- `src/features/files/components/FileTreePanel.tsx` (add filter control to header area)
- `src/features/files/components/FileTreeFilterControl.tsx` (new component)

**Approach:**
- Create `FileTreeFilterControl` component that reads `hiddenCategories` from the store
- Render active (visible) categories as clickable chips — clicking a chip hides that category
- Render a "+" button that opens a dropdown showing hidden categories — clicking one reveals it
- Place the filter control between the workspace root row and the virtualized list
- Use existing design language (match button/chip styles from FileTreeRootActions)

**Test scenarios:**
- Default state: all three categories hidden, only "+" button visible (no chips)
- Click "+" and select Dependencies — chip appears, Dependencies directories become visible
- Click Dependencies chip — chip disappears, Dependencies directories hidden again
- Panel width is narrow (200px) — filter control does not overflow or clip
- Filter toggle preserves expanded folders and scroll position

**Verification:** Filter control renders correctly. Chips toggle categories. Dropdown reveals hidden categories. No layout breakage at narrow widths.

---

### U4. Filter integration with tree building (R14)

**Goal:** Integrate category filtering into the tree-build pipeline so hidden items consume zero rendering budget.

**Requirements:** R14 (filtering at tree-build time)

**Dependencies:** U2 (filter state and matching logic)

**Files:**
- `src/features/files/utils/treeModel.ts` (modify `buildTree()` to accept hidden categories; add filter logic in `insertPath()`)
- `src/features/files/components/FileTreePanel.tsx` (pass hiddenCategories to buildTree; filter children before `patchTree` call at the incremental expand path ~line 413)
- `src/features/files/stores/fileTreeStore.ts` (thread `hiddenCategories` through `mergeDirectoryResponseIntoState` → `buildChildrenFromResponse` → `buildTree` so lazy-loaded children are also filtered)
- `src/features/files/utils/treeModel.test.ts` (update all `buildTree()` call sites with new `hiddenCategories` parameter; default to empty Set for existing tests)

**Approach:**
- Add `hiddenCategories: Set<FilterCategory>` parameter to `buildTree()`
- In `insertPath()`, skip directories whose name matches any hidden category via `matchesFilterCategory()`
- Excluded directories and their children are never inserted into the tree — zero rendering budget
- Filter the `changedEntry.visibleChildren` and `changedEntry.ignoredChildren` arrays before passing to `patchTree` at the incremental expand call site (FileTreePanel.tsx ~line 413), ensuring lazy-loaded children respect active filters
- Pass `hiddenCategories` from the store through the useMemo chain to `buildTree()`
- In `fileTreeStore.ts`, add `hiddenCategories` to `FileTreeStoreState` (U2 adds this) and thread it through `mergeDirectoryResponseIntoState` → `buildChildrenFromResponse` → `buildTree` so newly lazy-loaded children are filtered consistently

**Test scenarios:**
- Build tree with Dependencies hidden — node_modules, vendor, .venv directories absent
- Build tree with all categories visible — all directories present
- Toggle filter off (reveal Dependencies) — tree rebuilds, node_modules reappears with correct children
- Hidden directory children are not in the tree (verify no partial state)
- Filter toggle preserves expand state of non-hidden directories

**Verification:** Hidden directories and their children are absent from the rendered tree. Toggle triggers tree rebuild with correct filtering.

---

### U5. startTransition for deferred computations (R4b)

**Goal:** Defer non-critical downstream memo computations using `React.startTransition` so the first paint of expanded children is not blocked.

**Requirements:** R4b (deferred secondary computations)

**Dependencies:** None (independent of filtering work)

**Files:**
- `src/features/files/components/FileTreePanel.tsx` (wrap secondary memo updates in startTransition)

**Approach:**
- Identify the critical path: `visibleFileTreeRows` must compute first (drives the virtualizer)
- Identify the meaningful deferral target: `folderGitStatusMap` (lines 462-527) — a 65-line useMemo with nested iterations across all expanded folders; this is the heaviest secondary computation
- `visibleTreePathOrder` and `visibleTreePathTypeMap` are trivial single-pass `.map()` transforms and do not need deferral
- Refactor `folderGitStatusMap` from `useMemo` to `useState` + `useEffect`, then wrap the state setter in `React.startTransition(() => { setGitStatusMap(computedValue) })` to defer the git status computation to a second render pass
- The primary path (`visibleFileTreeRows`, `visibleTreeNodeEntries`) stays synchronous — only the git status map is deferred

**Test scenarios:**
- Expand a directory with 100+ files — confirm visible rows paint before git status icons appear
- Rapid expand/collapse — confirm no stale git status shown (transition cancelled)
- Filter toggle — confirm tree updates immediately, git status catches up after

**Verification:** Expand feels instant (<100ms to visible rows). Git status populates within 50ms after.

---

### U6. Repository handle caching (R7c)

**Goal:** Cache the `git2::Repository` handle for the workspace root across the session lifetime.

**Requirements:** R7c (Repository handle caching)

**Dependencies:** None (independent backend change)

**Files:**
- `src-tauri/src/workspaces/files.rs` (modify to accept cached repo)
- `src-tauri/src/workspaces/commands.rs` (store repo handle in workspace state)
- `src-tauri/src/state.rs` (add `workspace_repo_handles: Mutex<HashMap<String, Arc<Mutex<Repository>>>>` to `AppState`)

**Approach:**
- On workspace initialization, open the repository once and store in `AppState.workspace_repo_handles` keyed by workspace ID
- Modify `list_workspace_directory_children_cached` to accept `Option<&Repository>`
- Invalidate on workspace close or git re-init (drop the entry from the map)

**Test scenarios:**
- Open workspace — repository opened once
- Expand 10 directories — repo reused from cache
- Close workspace — handle dropped
- Non-git workspace — no gitignore checks

**Verification:** `Repository::open()` called once per workspace session. Expand latency reduced by ~10-30ms.

---

### U7. Prefetch IPC merge (R5)

**Goal:** Merge the sequential visible-then-ignored IPC calls in the prefetch pipeline into a single Scope::All call.

**Requirements:** R5 (prefetch IPC merge)

**Dependencies:** None

**Files:**
- `src/features/files/hooks/useLazyFileTree.ts` (modify prefetch to use Scope::All)

**Approach:**
- In `flushPrefetchDirectoryLoadQueue`, replace two-step visible-then-ignored with single `getWorkspaceDirectoryChildren` (Scope::All)
- Remove separate `queueIgnoredDirectoryLoad` for prefetched directories

**Test scenarios:**
- Expand directory with 5 child dirs — confirm 1 IPC call per child (not 2)
- Directories matching `isSpecialDirectoryPath` remain excluded from prefetch queue (existing guard preserved)
- Prefetched children show ignored files

**Verification:** Prefetch makes one IPC call per child directory instead of two.

---

## Scope Boundaries

**Deferred for later:**
- R3 (lazy git status with prefetch for visible rows only) — addresses scroll smoothness, secondary goal; origin P4 deferral
- Custom user-defined filter rules (regex/glob patterns per workspace)
- Per-file hide (hide a specific file without hiding its category)
- Filter profiles (e.g., minimal, full, debug)
- R4c (chunked rendering) — marginal value given virtualization + startTransition
- R6 (root scan mutex) — targets initial load, not expand latency
- R7a (session-scoped backend disk cache)
- File search performance optimization
- Keyboard navigation speed (arrow-key expand)
- Deep pre-fetch optimization (grandchild directories)

**Outside this optimization:**
- Full architecture rewrite (immutable tree library)
- WebWorker-based tree computation
- Changes to the git status subscription model

---

## Risks and Dependencies

- **Filter toggle may cause tree rebuild flicker.** When categories are toggled, `buildTree()` reruns from scratch. Mitigation: `startTransition` (U5) defers secondary computations; critical path renders immediately.
- **Repository handle staleness.** If git repo is modified externally, cached handle may serve stale gitignore rules. Mitigation: invalidate on explicit refresh.
- **IDE Config false positives.** A workspace containing a legitimate `target/` directory will be filtered as Build Artifact. Mitigation: toggle system lets users reveal any category.

---

## Sources and Research

- Backend: `src-tauri/src/workspaces/files.rs` (budget constants 660-690, dir scan 1396-1533, cache 112-178, Repository::open 1424-1428)
- Frontend tree: `src/features/files/utils/treeModel.ts` (buildTree 353, patchTree 515, flattenVisibleTree 651, is_special_directory_path 297)
- Frontend panel: `src/features/files/components/FileTreePanel.tsx` (memos 219-566, folderGitStatusMap 462-527)
- Virtualization: `src/features/files/components/FileTreeContainer.tsx` (28px rows, 16 overscan)
- Lazy loading: `src/features/files/hooks/useLazyFileTree.ts` (load flow, prefetch queue)
