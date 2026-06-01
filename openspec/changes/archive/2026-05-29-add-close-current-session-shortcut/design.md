## Context

The app already models opened workspace conversations as runtime-local topbar session tabs. Each tab exposes an `X` close affordance that removes only the open-tab entry and preserves the underlying conversation and runtime lifecycle.

`Command+W` is a common close-tab shortcut, but without an app-level handler it can fall through to the WebView/page default path and blank the page. The fix must bind the shortcut to the same UI-only close semantics as the tab `X`, while keeping shortcut configuration visible in Settings.

## Goals / Non-Goals

**Goals:**

- Add `closeCurrentSessionShortcut` as a persisted, configurable shortcut setting.
- Default the shortcut to `cmd+w`.
- Route the shortcut to the existing topbar tab close mutation path.
- Prevent WebView fallback for the configured shortcut.
- Preserve the current session/runtime lifecycle and stored conversation history.

**Non-Goals:**

- Do not stop, interrupt, archive, delete, or remove the session itself.
- Do not add a backend command.
- Do not change topbar tab admission, rotation, or batch-close semantics.
- Do not redesign Settings shortcut grouping.

## Decisions

### Decision: Model close-current-session as a shared app shortcut

`closeCurrentSessionShortcut` is added to the same settings and metadata path as other configurable app shortcuts.

- Alternative A: hardcode `cmd+w` directly in the topbar handler. Rejected because it would not appear in Settings and would violate the shared shortcut contract.
- Alternative B: reuse `archiveThreadShortcut`. Rejected because archive/delete semantics mutate stored session state, while this action only closes an open tab.

### Decision: Reuse topbar tab dismiss logic

The keyboard path calls the same topbar window mutation used by the tab `X`, including existing adjacent fallback selection.

- Alternative A: introduce a new runtime close-session command. Rejected because closing an open tab is runtime-local UI state, not backend lifecycle state.
- Alternative B: clear `activeThreadId` directly. Rejected because it would bypass the existing fallback policy and could diverge from mouse close behavior.

### Decision: Intercept the configured shortcut even from editable focus

The handler prevents the default action once the configured close-current-session shortcut matches. This protects the app from the page/WebView fallback that caused the black screen.

- Alternative: skip editable targets like other global shortcuts. Rejected for this command because `Command+W` must be captured to prevent the destructive native fallback.

## Risks / Trade-offs

- [Risk] Capturing `Command+W` while focus is in composer differs from ordinary editable-target shortcut policy. → Mitigation: scope this exception only to close-current-session and keep the action UI-only.
- [Risk] Shortcut default could collide with platform/window behavior. → Mitigation: expose it in Settings so users can rebind or clear it, and ensure app handling prevents blank-page fallback.
- [Risk] Future tab model changes may bypass this handler. → Mitigation: keep the shortcut routed through existing topbar mutation helpers rather than duplicating tab state logic.
