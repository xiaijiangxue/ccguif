## Why

`Command+W` is a platform-level close-tab habit. In the desktop app it currently can fall through to the WebView/page default behavior, which may blank the current page instead of closing only the active conversation tab.

Users need a configurable shortcut that behaves exactly like clicking the `X` on the currently open topbar session tab: remove that session from the open-tab surface while leaving the underlying conversation/runtime state intact.

## 目标与边界

- Add a configurable shortcut for closing the current open session tab.
- Default the shortcut to `cmd+w` on macOS-style shortcut notation.
- Expose the command in Settings -> Shortcuts so users can rebind or clear it.
- Make the shortcut equivalent to clicking the current topbar session tab close `X`.
- Prevent the native/WebView `Command+W` fallback from blanking the page.

## 非目标

- Do not stop, interrupt, cancel, or kill the active runtime turn.
- Do not delete, archive, or remove the conversation from history/storage.
- Do not change existing archive/delete shortcuts or their semantics.
- Do not redesign the topbar session tab model.
- Do not introduce a backend command or new dependency.

## What Changes

- Add a new app setting: `closeCurrentSessionShortcut`.
- Add a Settings -> Shortcuts command labeled `Close current session` / `关闭当前会话`.
- Register the shortcut in the topbar session tab layer.
- When triggered, dismiss the current active topbar session tab using the same path as the tab close button.
- If another open session tab exists, select the adjacent fallback tab using the existing tab fallback policy.
- If no open session tab remains, return to the workspace/session surface without mutating session history.

## 技术方案对比与取舍

| 方案 | 描述 | 优点 | 风险/成本 | 结论 |
|---|---|---|---|---|
| A | Reuse `archiveThreadShortcut` | No new setting | Wrong semantics: archive/delete is data mutation, not tab close | Reject |
| B | Add `closeCurrentSessionShortcut` and reuse topbar tab dismiss logic | Correct user model, configurable, low blast radius | Needs settings schema/i18n/default sync | Adopt |
| C | Implement a new backend close-session command | Could centralize runtime behavior | Overbuilt; closing an open tab is UI state only | Reject |

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `app-shortcuts`: include the close-current-session command in the shared shortcut metadata/settings contract.
- `workspace-topbar-session-tabs`: add keyboard-triggered close semantics equivalent to clicking a tab close affordance.

## Impact

- Frontend settings schema/defaults:
  - `src/types.ts`
  - `src/features/settings/hooks/useAppSettings.ts`
  - `src/features/settings/components/settings-view/settingsViewShortcuts.ts`
  - `src/features/settings/components/settings-view/sections/ShortcutsSection.tsx`
- Topbar session tab behavior:
  - `src/features/layout/hooks/useLayoutNodes.tsx`
  - `src/app-shell-parts/useAppShellLayoutNodesSection.tsx`
- i18n:
  - `src/i18n/locales/en.part1.ts`
  - `src/i18n/locales/zh.part1.ts`
- Native settings persistence/defaults:
  - `src-tauri/src/types.rs`

## 验收标准

- Pressing `Command+W` closes only the currently open topbar session tab.
- The active turn is not interrupted and no runtime stop command is sent.
- The conversation remains available in session history/sidebar after closing the tab.
- Clicking the tab `X` and pressing the shortcut produce the same open-tab state transition.
- The command appears in Settings -> Shortcuts and can be rebound or cleared.
- `Command+W` no longer causes the app page to blank when a current session tab is open.
