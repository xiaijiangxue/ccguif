# Design: Fix Session Folder Intent And Worktree Move Menu

## Boundary

This change is an organization-layer fix. It does not redefine session existence, workspace ownership, or strict project membership.

```text
Session row
  -> same-project folder move targets
  -> folder assignment mutation
  -> catalog/sidebar reload

New engine session
  -> pending or real thread id
  -> local folder intent
  -> explicit identity transition
  -> durable folder assignment for the real id
```

The key rule is: folder assignment follows a known session identity. It must not be guessed from whichever catalog row appears after a refresh.

## Problem 1: Worktree Menu Target Propagation

Normal root/folder session lists already receive folder move targets and therefore can render `Move to folder`. Worktree rows are rendered through `WorktreeSection`, which currently owns a separate `ThreadList` path. If that path does not receive `moveFolderTargets`, `useSidebarMenus` correctly hides the menu entry because it has no valid targets.

### Decision

Pass `moveFolderTargetsByWorkspaceId` from `Sidebar` into `WorktreeSection`, then pass the current worktree's targets into the internal `ThreadList`.

```text
Sidebar
  moveFolderTargetsByWorkspaceId
    -> WorktreeSection
      -> ThreadList(moveFolderTargets for worktree.id)
        -> useSidebarMenus
```

This keeps folder target computation centralized and avoids duplicating project/folder projection logic inside `WorktreeSection`.

## Problem 2: Claude Pending Session Folder Intent

Codex and Claude differ at creation time:

| Engine | Creation identity | Folder assignment timing |
| --- | --- | --- |
| Codex | real thread/session id returned before UI registration | assign immediately |
| Claude | temporary `claude-pending-*` id first, real session id later | must migrate pending intent |

The fragile path is Claude:

```text
create from folder
  -> remember folder intent for claude-pending-*
  -> real Claude session id arrives
  -> current migration guesses a replacement from same-engine candidates
```

That guess is invalid when multiple Claude sessions exist, because "same engine" is not an identity relation.

### Decision

Make pending folder migration follow explicit identity transition.

When a reducer/action/event path knows that `oldThreadId` is replaced by `newThreadId`, the folder-intent layer must be notified or must observe an explicit mapping. This MUST be centralized at the shared `renameThreadId` boundary, or every dispatch path that can finalize a pending engine id MUST call the same migration helper before/after dispatch.

```text
oldThreadId = claude-pending-...
newThreadId = claude:<real-session-id>

if pending folder intent exists for oldThreadId:
  move local folder override oldThreadId -> newThreadId
  persist folder assignment for newThreadId
  clear pending intent oldThreadId after successful durable assignment
```

The fallback "resolve by unique same-engine real thread" may remain only as a last-resort compatibility path for legacy pending intents, but it must not override an explicit identity transition and must not assign when multiple candidates exist.

## State And Mutation Semantics

- Pending intent state stores `workspaceId`, `pendingThreadId`, and `folderId`.
- Local folder override may temporarily use the pending id so the UI does not jump while the engine starts.
- Durable backend assignment is only written for the real id.
- On explicit rename:
  - pending id local override is copied or moved to real id;
  - pending intent key is updated or settled;
  - backend assignment uses the owner workspace already associated with the create action.
- On failed assignment:
  - previous local assignment is preserved or restored;
  - user-visible state should not silently move the row to root.
  - pending intent is cleared only after a non-retryable, user-visible failure has preserved/restored local state; retryable catalog-not-ready errors keep the intent.

## Compatibility

### Legacy Metadata

This change does not require a metadata schema migration. Existing reads of bare session ids remain valid, and new writes continue through the existing folder assignment service.

### Catalog Degradation

Partial, degraded, or startup-only catalog refreshes are incomplete evidence. They must not delete pending intents, clear last local folder overrides, or guess a real session id.

### Codex Non-Regression

Codex already has a real id before assignment. The implementation must keep that direct path and avoid introducing a Claude-style pending dependency into Codex.

### Cross-Project Moves

Move targets remain scoped to the current project/workspace. Folder assignment must continue to reject sessions outside the target project scope.

Worktree session rows must use move targets keyed by that `worktree.id`. They must not silently fall back to the parent workspace's folder targets unless a separate project-scope folder model explicitly defines shared targets.

## Testing Strategy

- Worktree menu regression:
  - render a worktree session with folder targets;
  - open its menu;
  - assert `Move to folder` or equivalent action is present.
- Claude pending migration:
  - create a pending Claude session with a folder intent;
  - include one or more existing Claude sessions;
  - emit or dispatch a pending-to-real identity transition through each frontend rename source that can finalize a pending engine session;
  - assert the assignment mutation uses the new real id, not an older Claude id.
- Codex non-regression:
  - preserve existing tests that assign folder intent directly for catalog-backed Codex real ids.
- Negative safety:
  - if no explicit real id exists and multiple same-engine candidates exist, no durable assignment is guessed.

## Rollback

The menu propagation can be reverted independently because it is additive prop forwarding.

The pending-intent migration can be reverted to the current compatibility fallback without changing backend metadata schema. Any assignments already written through the existing backend service remain valid.
