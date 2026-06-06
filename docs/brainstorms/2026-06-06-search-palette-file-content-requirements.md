---
date: 2026-06-06
topic: search-palette-file-content
---

# Search Palette File Content Requirements

## Summary

Add file-content search to the existing Search Palette so a user can type text once and see matching files, threads, messages, skills, commands, and code/content hits in the same global entry point. Content search follows the Palette scope, streams in asynchronously, and shows 50 matches by default with lazy loading as the user scrolls.

---

## Problem Frame

The Search Palette already acts as the cross-workspace finder for files, tasks, threads, messages, skills, and commands, but file results are currently path/name-oriented. When the user remembers code, copy, or configuration text rather than a filename, they must leave the Palette and use a separate file search surface. That breaks the "one place to find the next thing" workflow and makes the Palette feel less capable than the rest of the workbench.

Performance is the main constraint. File-content search must feel additive and fast, not turn every keystroke into an expensive workspace scan. The desired shape is hybrid: lightweight search results appear immediately, content matches arrive after a short pause, and broad scope searches load progressively.

---

## Key Decisions

- **Hybrid automatic search.** Content search runs as part of normal Palette use instead of requiring a separate `content:` command or mode. This keeps the interaction fast for users who do not know which result type they need.
- **Palette scope is authoritative.** The current/global scope toggle continues to define search scope. Current scope searches the active workspace; global scope searches across workspaces progressively.
- **Progressive results over complete blocking results.** Global content search should prioritize useful early results over waiting for every workspace to finish. Active and recent workspaces should appear first, then additional workspaces should fill in as capacity allows.
- **Default 50-match viewport.** The Palette should initially show up to 50 content matches, then load additional batches as the user scrolls. The limit is a presentation and responsiveness boundary, not a claim that only 50 matches exist.
- **Fast entry, advanced search elsewhere.** The first version keeps Palette content search simple. Advanced controls such as regex, case sensitivity, whole-word matching, include globs, and exclude globs stay in the dedicated workspace search surface unless a later requirement brings them into the Palette.

---

## Requirements

**Search behavior**

- R1. The Search Palette must include file-content matches when the user's query is eligible for content search.
- R2. File-content search must follow the existing Palette scope: active workspace scope searches only the active workspace, and global scope searches across eligible workspaces.
- R3. Existing lightweight result types must remain available while content search is loading, including file path/name results, threads, messages, tasks, history, skills, and commands.
- R4. Content results must be distinguishable from file path/name results in the result list.
- R5. Selecting a content result must open the matched file at the matched line and column when location data is available.

**Performance and loading**

- R6. Content search must not run for empty or trivially short queries. The exact minimum query length can be finalized during planning, but it must avoid expensive scans from accidental keystrokes.
- R7. Query changes must cancel or invalidate stale content searches so older responses cannot replace newer results.
- R8. Global content search must load progressively with bounded concurrency rather than searching all workspaces as one blocking operation.
- R9. The initial visible content-result batch must be capped at 50 matches by default.
- R10. The result list must support lazy loading additional content matches when the user scrolls near the end of the available content-result batch.
- R11. Content search must show partial results when only some scoped workspaces have completed.
- R12. Search progress, partial completion, and limit-hit states must be understandable without making the Palette feel like a separate full search panel.

**Result shape**

- R13. Each content result must show the matched file path and enough location context for the user to understand why it matched.
- R14. Each content result must show a short preview line around the match.
- R15. Global scope content results must show workspace identity when the matched file is not from the active workspace.
- R16. Content result ranking must favor active/recent workspaces and useful early matches over perfect global ordering in the first version.

**Scope boundaries**

- R17. This feature must preserve existing Search Palette keyboard behavior for open, close, movement, and selection.
- R18. This feature must not move the dedicated workspace search panel's advanced controls into the Palette in the first version.
- R19. This feature must not require a new persistent full-text index in the first version.
- R20. This feature must not make closed Palette state consume hot thread or file-content indexing work.

---

## Key Flows

- F1. Current workspace content hit
  - **Trigger:** The user opens Search Palette in current workspace scope and types a phrase that exists inside a source file.
  - **Steps:** Lightweight results appear first; content results appear after the query settles; the user selects a content match.
  - **Outcome:** The matched file opens at the matched line and column.
  - **Covered by:** R1, R2, R3, R5, R7, R13, R14, R17.

- F2. Global progressive content search
  - **Trigger:** The user switches Search Palette to global scope and searches for a code or configuration string.
  - **Steps:** Active or recent workspace content matches appear first; other workspace matches arrive progressively; the user can scroll to load additional batches.
  - **Outcome:** The user can act on early useful results without waiting for every workspace to finish.
  - **Covered by:** R2, R8, R9, R10, R11, R15, R16.

- F3. Fast typing with stale searches
  - **Trigger:** The user types several query revisions quickly.
  - **Steps:** Earlier content searches are cancelled or marked stale; only results for the latest eligible query remain visible.
  - **Outcome:** The Palette does not flicker back to old content matches or show misleading stale previews.
  - **Covered by:** R6, R7, R12.

---

## Acceptance Examples

- AE1. **Covers R1, R3, R7.** Given the Palette is open and the user types `codemoss`, when file path results return immediately and content results return later, then both can coexist and the later content response must correspond to the current query.
- AE2. **Covers R8, R9, R10, R11.** Given global scope covers many workspaces, when the user searches for a common term, then the Palette initially shows no more than 50 content matches and can load more as the user scrolls.
- AE3. **Covers R4, R5, R13, R14, R15.** Given a global content match exists in another workspace, when it appears in the Palette, then the result identifies the workspace, file path, line/column, and preview, and selecting it opens the file location.
- AE4. **Covers R18, R19.** Given the user wants regex or include/exclude glob controls, when using the Palette, then those advanced controls are not required in the first version and the dedicated workspace search surface remains the place for advanced search.

---

## Scope Boundaries

Deferred for later:

- Bringing regex, case-sensitive, whole-word, include glob, and exclude glob controls directly into the Palette.
- Building a persistent full-text index for all workspaces.
- Turning Search Palette into a broader Raycast-style command center with action menus for every result type.
- Perfect global relevance ordering across every workspace before any results are shown.

---

## Dependencies / Assumptions

- The product already has a Search Palette that aggregates multiple result types and respects active/global scope.
- The product already has a workspace text search capability that can return file paths, match counts, line/column data, preview text, and limit-hit state.
- The implementation can either extend existing search responses or introduce an equivalent progressive loading contract during planning.
- The first version can prioritize active/recent workspaces in global scope without needing a user-facing preference control.

---

## Sources / Research

- `src/features/search/components/SearchPalette.tsx` shows the current Palette behavior, result rendering, keyboard interaction, and scope/content filter UI.
- `src/features/search/hooks/useUnifiedSearch.ts` shows current lightweight provider aggregation and result limits.
- `src/app-shell-parts/useAppShellSearchRadarSection.ts` shows current active/global scope source preparation and avoids feeding hot thread items into search while the Palette is closed.
- `src/features/search/components/WorkspaceSearchPanel.tsx` shows an existing dedicated workspace text search UI with location-aware file opening.
- `src/services/tauri.ts` exposes `searchWorkspaceText`, and `src-tauri/src/workspaces/files.rs` contains existing workspace text search limits and result shape.
