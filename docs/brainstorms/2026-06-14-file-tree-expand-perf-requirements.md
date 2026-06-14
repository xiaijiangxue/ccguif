---
date: 2026-06-14
topic: file-tree-expand-perf
---

# File Tree Expand Performance Optimization

## Summary

Optimize the file tree panel's folder-expand response time through two complementary strategies: **smart file filtering** that hides irrelevant files (dependencies, build artifacts, IDE configs) to reduce rendering surface, and **rendering pipeline optimization** that defers non-critical computations and caches expensive backend operations. The combined approach ensures that unfiltered large directories also remain responsive.

## Problem Frame

The file tree panel (`src/features/files/components/FileTreePanel.tsx`) exhibits noticeable lag when users double-click to expand a folder. Investigation reveals that a single expand triggers 10+ `useMemo` recomputations — many performing full recursive walks over the entire 6,000+ node tree. The initial expand for non-special directories makes one Tauri IPC call (`getWorkspaceDirectoryChildren` with Scope::All), but expanding a directory with child directories triggers a prefetch cascade: one visible-then-ignored call per child directory (concurrency-batched). Separately, the root workspace scan acquires per-entry mutex locks for gitignore checks — a bottleneck on initial load and refresh, not on per-expand latency. The project already has solid foundations (virtualization via `@tanstack/react-virtual`, lazy loading, backend scan budgets), but the computation cascade and I/O seriality抵消了 these optimizations.

The user's goal is straightforward: expand response should feel fluid (< 200ms perceived), matching the snappiness of comparable tools like VS Code's file tree. A secondary concern is that the file tree surfaces every file in the workspace including dependency directories, build artifacts, and IDE configuration files. These are often the largest and least relevant directories, yet they occupy visual space and invite expansion into lag-inducing territory.

## Requirements

### Smart File Filtering

R10. The file tree supports **category-based visibility toggles** that hide or show groups of files by category.

R11. Categories are: **Dependencies** (node_modules, vendor, .venv), **Build Artifacts** (dist, build, target, .next, coverage, out, __pycache__), **IDE Config** (.idea, .vscode, .vs, .project, .classpath, .settings). Each category has a user-toggleable on/off state.

R12. Dependencies and Build Artifacts reuse the existing frontend classification logic (`is_special_directory_path`, `SPECIAL_BUILD_ARTIFACT_DIRECTORIES` in `treeModel.ts`) for path matching — no new scanning infrastructure. IDE Config filtering uses frontend-only hardcoded path segment matching since no backend classifier exists for these directories.

R13. Default state: **Dependencies hidden**, **Build Artifacts hidden**, **IDE Config hidden**. Users can reveal any category via a toggle in the file tree panel header.

R14. Filtering operates at tree-build time: excluded directories and their children are omitted from `buildTree()` before flattening, so hidden items consume zero rendering budget.

R15. Filter state persists per-workspace in the existing workspace settings, surviving session restarts.

R16. A collapsed/expandable **filter control** in the file tree panel header shows active categories as chips. Clicking a chip toggles that category off; clicking "+" opens a dropdown to re-enable hidden categories.

### Computation Layer

- R1. **Verified:** `patchTree` (treeModel.ts:515) already implements incremental single-directory sub-tree patching. Confirm it is correctly triggered for all expand operations and that `buildTree` is only invoked on workspace-wide changes.
- R2. **Verified:** `useMemo` dependency audit confirms no expand-state cascade exists — `buildTree`, `allTreeNodePaths`, and `folderNodeMap` depend only on tree-structure inputs, not `expandedFolders`. No code changes needed.
- R3. `folderGitStatusMap` is computed lazily — only for visible rows, not across all `gitStatusFiles` for every folder path on every state change. Include a prefetch or batching strategy (e.g., compute status for the next N rows ahead of the viewport) to avoid scroll jank as rows enter the viewport in large directories.
- R4. **Verified:** `patchDirectoryCacheSnapshot` (treeModel.ts:592) already implements incremental snapshot patching for single-directory cache changes.
- R4b. Non-critical downstream computations (`folderGitStatusMap`, `visibleTreePathOrder`, `visibleTreePathTypeMap`) are deferred using `React.startTransition` so they run after the visible rows are painted. This decouples the first-paint of expanded children from secondary computations.
- R4c. For directories with 50+ children, the flatten-and-render pipeline uses **chunked rendering**: the first batch renders immediately, and remaining rows are appended via `requestIdleCallback` or `setTimeout(0)` to keep the main thread responsive.

### I/O Layer

- R5. The prefetch pipeline makes sequential visible-then-ignored IPC calls per child directory. Merge these into a single call using `getWorkspaceDirectoryChildren` (Scope::All), which already returns both visible and ignored children. This affects the prefetch path (not the primary expand, which already uses Scope::All for non-special directories).
- R6. **Deferred:** Eliminate per-entry `Mutex<Repository>` acquisition during the root workspace scan (`list_workspace_files_inner`). Targets initial load/refresh, not expand latency.
- R7a. Directory scan results are cached in backend memory for the current session so that re-expanding a previously loaded directory does not re-scan the filesystem. Invalidation is frontend-triggered via the store's existing epoch counter / tree refresh mechanism.
- R7c. The `git2::Repository` handle for the workspace root is cached across the workspace session lifetime, instead of calling `Repository::open()` on every directory-children request (currently in `list_workspace_directory_children_cached`). The handle is invalidated on workspace close or git re-init. Expected saving: 10-30ms per expand on large repos.
- R7b. (Future) Filesystem-change-driven cache invalidation via inotify/FSEvents — deferred to a separate document. The codebase currently has no file-watching infrastructure; this is a significant platform-specific subsystem.

### UX Layer

- R8. Folder expand actions are debounced (50ms) to prevent rapid double-clicks from triggering multiple recomputation cascades.
- R9. **Verified:** `loadedLazyDirectoriesRef` / `loadingLazyDirectoriesRef` guards (useLazyFileTree.ts:118-119) already skip redundant backend calls for loading/loaded directories.

### Prioritization

Implementation order by expected impact on expand latency and user experience:

1. **P0 — R8** (debounce): trivial win, zero-risk UX improvement (already implemented, verify)
2. **P1 — R10-R16** (smart file filtering): high user-facing value; hiding large directories (node_modules, dist) directly reduces rendering load and eliminates the most lag-prone expansions
3. **P2 — R4b** (startTransition): keeps unfiltered large directories responsive by deferring secondary computations
4. **P2b — R7c** (Repository handle caching): low-risk backend optimization, ~10-30ms per expand
5. **P3 — R5** (prefetch IPC merge): reduces background IPC calls for directories with many child directories
6. **P4 — R3** (lazy git status with prefetch): addresses scroll smoothness, secondary goal
7. **Deferred — R7a** (session-scoped backend cache): new infrastructure, higher complexity
8. **Deferred — R4c** (chunked rendering): marginal value given virtualization + startTransition; re-evaluate only if S1b not met
9. **Deferred — R6** (root scan mutex): targets initial load, not expand latency

## Key Decisions

- **Category-based over custom regex filtering.** The initial version uses predefined categories backed by the backend's existing path classification. Custom per-workspace regex or glob patterns are deferred — the predefined categories cover the vast majority of noise, and the system can be extended later without breaking the UI contract.
- **Frontend filtering at tree-build time, not backend.** Filtering happens in `buildTree` / `flattenVisibleTree` rather than omitting entries from the backend response. This keeps the backend API stable, lets the frontend toggle filters instantly without a round-trip, and avoids duplicating filter logic across layers.
- **Incremental over full rebuild.** The current `buildTree()` reconstructs the entire tree from `mergedFiles` + `mergedDirectories`. Rather than refactoring to an immutable tree structure, the chosen approach patches the tree in-place when a single directory's children arrive — lower risk, smaller diff, same perceptual result.
- **Single merged IPC call (prefetch path only).** The primary expand already uses Scope::All for non-special directories. The merge targets the prefetch cascade where visible-then-ignored calls are made per child directory.
- **Debounce at 50ms.** Short enough to feel instant on deliberate clicks, long enough to absorb accidental double-clicks. This is a UX safety net, not a performance mechanism — the computation and I/O fixes carry the real weight.
- **`startTransition` for deferred computations, not `useDeferredValue`.** The transition approach batches secondary memos into a single deferred pass, whereas `useDeferredValue` would defer individual values independently with less control over grouping.

## Success Criteria

- S1. Expanding a folder with ~100 children completes in under 200ms (measured from click to visible rows) on the current project. Baseline: measure current expand time before starting optimization to anchor the target and enable before/after comparison.
- S1b. Expanding a folder with ~500+ children completes in under 300ms, ensuring the optimization degrades gracefully at scale (monorepo packages, generated code, large asset directories).
- S2. `useMemo` computations in FileTreePanel that do NOT logically depend on `expandedFolders` (e.g., `gitStatusMap`, `allTreeNodePaths`, `folderNodeMap`) do not recompute when only `expandedFolders` changes.
- S3. The primary expand for non-special directories triggers exactly one Tauri IPC call. Prefetch cascade calls are concurrency-batched in the background.
- S4. Rapid double-click on a folder does not trigger duplicate backend calls or recomputation cascades.
- S4b. Scrolling through a directory with 500+ files does not cause visible git-status flicker or jank — lazy status computation with prefetch keeps the scroll experience smooth.
- SF1. Toggling a category filter perceives as instant (< 50ms from click to tree update, no round-trip).
- SF2. Expand state and scroll position are preserved across filter toggles.
- SF3. All hidden files can be revealed within 2 clicks via the '+' dropdown.

## Scope Boundaries

- **Deferred for later:**
  - Custom user-defined filter rules (regex/glob patterns per workspace)
  - Per-file hide (hide a specific file without hiding its category)
  - Filter profiles (e.g., "minimal", "full", "debug") beyond the single toggle set
  - Backend directory scan caching across sessions (disk-persisted cache)
  - Virtualization tuning (overscan, row height) — already adequate
  - File search performance optimization
  - Keyboard navigation speed (arrow-key expand)
  - Root workspace scan mutex optimization (R6) — targets initial load/refresh, not expand latency. Verified: function is `list_workspace_files_inner`, not `scan_workspace_files_inner`.
  - Deep pre-fetch optimization (prefetching grandchild directories beyond current 3-concurrent)

- **Outside this optimization:**
  - Full architecture rewrite (e.g., adopting an immutable tree library)
  - WebWorker-based tree computation
  - Changes to the git status subscription model

## Open Questions

### From 2026-06-14 review

- **Phased delivery validation:** Should the three optimization layers ship together or sequentially? If R1-R2 alone resolve most of the expand delay, R5-R7 (Rust + Tauri IPC changes) may be unnecessary scope. Consider measuring expand time after R1-R2 only, then deciding whether R5-R7 are needed. (product-lens)

### From 2026-06-14 doc-review

- **IPC call count accuracy:** The problem frame now describes the prefetch cascade (1 + 2N calls for N child directories). Verify this is the actual bottleneck vs. the computation cascade before prioritizing R5. (adversarial, feasibility)
- **Filtering scope:** Consider whether R10-R16 (smart file filtering) should be a separate requirements document with its own lifecycle, or whether there is a hard dependency on shipping it alongside perf work. The filtering feature has no success criteria overlap with the performance criteria. (product-lens, adversarial)
- **Frontend-only filtering limitation:** Frontend filtering at tree-build time does not reduce IPC payload or backend compute — the backend still scans and transfers excluded directories. Confirm this is acceptable for S1/S1b targets, or consider adding a backend-side filter parameter. (product-lens)

## Sources / Research

- Backend file scanning: `src-tauri/src/workspaces/files.rs` (budget constants at lines 660-690, directory children scan at 1396-1533, cache logic at 112-178, `Repository::open` at 1424-1428)
- Frontend tree model: `src/features/files/utils/treeModel.ts` (buildTree at line 353, patchTree at line 515, flattenVisibleTree at line 651)
- Frontend panel memoization: `src/features/files/components/FileTreePanel.tsx` (directoryCacheSnapshot at 219-254, nodes/patchTree at 394-454, visible rows and derived maps at 530-566)
- Virtualization: `src/features/files/components/FileTreeContainer.tsx` (@tanstack/react-virtual, 28px row height, 16 overscan)
- Lazy loading: `src/features/files/hooks/useLazyFileTree.ts` (load flow, prefetch queue, ignored directory queue)
- Backend path classification: `is_special_directory_path()` and `is_special_build_artifact_dir_name()` in files.rs; frontend: `isSpecialDirectoryPath()` and `SPECIAL_BUILD_ARTIFACT_DIRECTORIES` in treeModel.ts
