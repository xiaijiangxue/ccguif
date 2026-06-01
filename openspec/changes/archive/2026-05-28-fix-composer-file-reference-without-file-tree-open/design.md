## Context

The composer receives `files` and `directories` from `useWorkspaceFiles`, then `useComposerAutocompleteState` builds `@` suggestions from those arrays. In the current app shell, both `initialLoadEnabled` and `pollingEnabled` are derived from:

```ts
!isCompact && !rightPanelCollapsed && filePanelMode === "files"
```

That makes the data source unavailable until the file-tree panel is visible. The file tree is only one consumer of the workspace file index; composer file-reference completion is another consumer and should not depend on opening that view.

## Goals / Non-Goals

Goals:

- Load the active workspace file index once when a connected workspace is active.
- Keep polling visibility-scoped to avoid unnecessary background scans.
- Preserve existing hook behavior for disconnected workspaces, stale response guards, retry cleanup, and manual refresh.
- Add a focused regression test around initial load vs polling.

Non-goals:

- No backend scan API changes.
- No autocomplete matching changes.
- No file tree layout or right-panel behavior changes.
- No new cache layer or storage format.

## Decisions

### Separate initial load from polling

Use two booleans in the app shell:

- `workspaceFilesInitialLoadEnabled`: active connected workspace exists.
- `workspaceFilesPollingEnabled`: existing file-tree-visible condition.

`useWorkspaceFiles` already supports separate `initialLoadEnabled` and `pollingEnabled`, so the fix should wire those options correctly rather than introduce a new hook or service.

### Keep single source of truth

Composer and file tree continue consuming the same `files/directories/gitignored*` state. This avoids a second `getWorkspaceFiles()` caller and keeps gitignored filtering and directory metadata consistent.

### Test the hook contract directly

The hook has a clear contract: disabled polling must not suppress initial loading. A focused hook test is cheaper and more stable than mounting the full app shell. The app-shell wiring change remains simple enough to review directly.

## Risks / Trade-offs

- Active workspace startup may run `list_workspace_files` even when the file tree stays closed. This is acceptable because composer `@` is a first-class consumer and the load is one-shot, not periodic.
- Very large workspaces may still rely on the existing scan cap/progressive metadata behavior. This change does not change that backend cap; it only makes the first snapshot available earlier.
- If future startup performance evidence shows this first scan is too expensive, the follow-up should add a shared on-demand index cache with composer-open trigger, not re-couple the data source to the file-tree panel.

## Rollback

Rollback is a normal frontend code rollback of the app-shell option wiring and focused test. No migration or persisted state rollback is required.

## Validation

- `npx vitest run src/features/workspaces/hooks/useWorkspaceFiles.test.tsx src/features/composer/hooks/useComposerAutocompleteState.test.tsx`
- `npm run typecheck`
- `openspec validate fix-composer-file-reference-without-file-tree-open --strict --no-interactive`
