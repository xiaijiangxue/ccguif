# Proposal: Fix Session Folder Intent And Worktree Move Menu

## Why

`refactor-workspace-session-management` and `unify-claude-workspace-session-catalog` have moved workspace session management toward a shared catalog, but two narrow organization regressions remain visible after the refactor:

- Worktree / child-folder session rows can lose the `Move to folder` context-menu entry.
- A Claude Code session created from a child folder can later appear under the parent/root organization after refresh, while Codex sessions created from the same child folder do not show the same drift.

The current code facts point to two separate causes:

- `WorktreeSection` does not receive and forward the workspace folder move targets that normal root/folder session lists already receive.
- Codex starts with a real backend thread/session id, so folder assignment can be persisted immediately. Claude starts with a temporary `claude-pending-*` id and receives the real session id later through an identity transition. The existing pending-folder migration relies on same-engine candidate guessing, which is unsafe when multiple Claude sessions already exist.

This change fixes those two organization-layer regressions without reopening workspace session catalog membership, Claude transcript attribution, or cross-project move semantics.

## Goals

- Worktree and child-folder session context menus MUST expose `Move to folder` whenever the current project/workspace has valid folder/root move targets.
- Claude pending session folder intent MUST be migrated to the real canonical session id when the pending id is replaced by a real session id.
- Pending folder migration MUST NOT rely on "the only real thread for this engine" as the primary identity resolution rule.
- Codex's current real-id creation path MUST remain unchanged.
- Folder assignment MUST remain organization metadata only; it MUST NOT rewrite workspace ownership or catalog membership.
- Existing legacy folder assignment metadata MUST remain readable.

## Non-Goals

- Do not rewrite workspace session catalog projection.
- Do not change Claude/Codex history scanner ownership or source-completeness semantics.
- Do not support cross-project or cross-workspace session moves.
- Do not migrate all existing session folder metadata to a new schema.
- Do not alter chat send, resume, realtime streaming, or transcript loading behavior.
- Do not promote frontend local folder overrides to durable truth; backend folder metadata remains the durable organization state.

## What Changes

- Thread-menu folder move targets are passed into `WorktreeSection` and forwarded to its internal `ThreadList`.
- Pending folder intent migration is bound to explicit session identity transition, such as `pendingThreadId -> realThreadId`, instead of catalog-result guessing.
- Identity-transition handling is centralized: every `renameThreadId` path that can replace a pending engine id MUST trigger the same folder-intent migration contract.
- When a pending Claude session is renamed to a real session id, the UI moves the local folder override and persists the assignment for the real id through the existing folder assignment mutation.
- If the real identity is not yet known, the pending intent remains local and MUST NOT be persisted to a guessed real session.
- Focused frontend regression tests cover the worktree menu path, Claude multi-session pending migration, and Codex non-regression.

## Compatibility

- Existing folder CRUD, folder tree layout, and backend mutation APIs remain in place.
- Legacy bare-session folder metadata remains readable.
- New writes continue to use the existing owner-scoped folder assignment mutation path.
- Workspaces without folder targets continue to hide the menu entry as before.
- Partial/degraded catalog refresh MUST NOT be treated as proof that a pending folder intent should be deleted.
- Codex's immediate real-id path continues to assign folder metadata directly and does not depend on Claude pending-id migration.

## Impact

- Frontend:
  - `src/features/app/components/Sidebar.tsx`
  - `src/features/app/components/WorktreeSection.tsx`
  - `src/features/app/components/ThreadList.tsx`
  - `src/features/app/hooks/useSidebarMenus.ts`
  - `src/features/threads/hooks/useThreadTurnEvents.ts`
  - `src/features/threads/hooks/useThreadMessagingThreadResolution.ts`
  - `src/features/threads/hooks/useThreadsReducer.ts`
- Tests:
  - `src/features/app/components/Sidebar.test.tsx`
  - `src/features/app/components/WorktreeSection.test.tsx`
  - `src/features/threads/hooks/useThreadTurnEvents.test.tsx`
- Specs:
  - `workspace-session-folder-tree`
  - `workspace-session-catalog-projection`

## Acceptance Criteria

1. A worktree / child-folder session row with available folder targets exposes `Move to folder`.
2. Moving a session from a worktree row writes the assignment to that session's owner workspace/project and does not change membership.
3. A Claude session created in a child folder keeps its folder assignment after the pending id is replaced by the real session id and after sidebar/catalog refresh.
4. Multiple existing Claude sessions do not cause a new pending Claude folder intent to be assigned to an older real session.
5. Every frontend `renameThreadId` dispatch path that can finalize a pending engine session uses the same pending-folder migration contract or delegates to a centralized handler.
6. Codex child-folder session creation continues to persist folder assignment through the existing real-id path.
7. Focused Vitest coverage passes for the changed menu and pending-intent paths.
8. `openspec validate fix-session-folder-intent-and-worktree-move-menu --strict --no-interactive` passes.
