## Context

`ChatInputBox` uses a `contenteditable` surface plus a completion provider for `@` file references. The user report for issue `#618` shows the failure is triggered from the macOS composer while the app shell is otherwise visible, which points to the local completion/render path rather than backend workspace scanning alone.

The current flow has three sensitive boundaries:

1. `ChatInputBoxAdapter` converts workspace file/directory props and lazy `getWorkspaceDirectoryChildren(...)` results into completion items.
2. The dropdown renders those completion items with React keys and labels.
3. `useFileTags` rewrites `contenteditable.innerHTML` to show inline file chips and restores cursor position.

Any exception crossing those boundaries can break the composer interaction and, in React render paths, can escalate to the app-level error boundary.

## Goals / Non-Goals

**Goals:**

- Normalize file-reference completion sources before constructing dropdown items.
- Deduplicate completion items with stable keys so duplicated files/directories cannot destabilize render.
- Treat unexpected lazy workspace-child payloads as empty/partial results rather than fatal errors.
- Guard inline file-tag DOM rendering so failures are logged and composer state can recover.
- Cover the regression with focused frontend tests.

**Non-Goals:**

- No change to backend workspace scan APIs.
- No change to the `@path` text format or send-time file-reference extraction.
- No composer rewrite from `contenteditable` to another editor engine.
- No new dependency.

## Decisions

### Normalize at the adapter boundary

Use small local helpers in `ChatInputBoxAdapter` to accept only non-empty string paths and construct completion item IDs/values from normalized paths.

Alternative considered: enforce stricter types only at props. That is insufficient because Tauri/lazy payloads and persisted state can still violate compile-time assumptions at runtime.

### Deduplicate before dropdown render

Build completion results through a keyed accumulator rather than pushing directly into an array. Directory and file items keep separate type-aware keys, so the same path cannot create repeated React dropdown rows.

Alternative considered: rely on React key warnings and visual duplicates. That leaves the UI in a fragile state and makes issue `#618` harder to reproduce deterministically.

### Isolate rich-tag DOM rewrite failures

Wrap the `innerHTML` rewrite and cursor restoration segment in `useFileTags` with a local `try/catch`. On failure, log via existing diagnostics helpers, clear transient cursor/tag flags, and leave the raw text editable.

Alternative considered: catch only at app `ErrorBoundary`. That turns a localized composer failure into a full app recovery path, which is exactly the white-screen class of issue to avoid.

## Risks / Trade-offs

- Invalid entries are skipped silently at the UI level -> Mitigation: log only actual render failures; invalid path filtering is expected defensive behavior for noisy runtime inputs.
- A DOM rewrite failure may leave raw `@path` text instead of a styled tag -> Mitigation: preserving editability is more important than forcing visual chips.
- Focused tests may not reproduce the exact macOS WebView crash path -> Mitigation: cover the deterministic failure classes around malformed inputs, duplicates, and guarded render boundaries.

## Migration Plan

No data migration is required. Rollback is a normal frontend code rollback of the adapter/tag-render changes.

## Open Questions

- The issue screenshot does not include a renderer stack trace. If user diagnostics later show a distinct stack, this change can be extended under the same capability with a narrower follow-up.
