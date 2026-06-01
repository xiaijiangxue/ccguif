## 1. Implementation

- [x] 1.1 Add `closeCurrentSessionShortcut` to frontend and Rust settings defaults.
- [x] 1.2 Add close-current-session shortcut metadata, icon, and i18n labels to Settings -> Shortcuts.
- [x] 1.3 Route the configured shortcut through topbar session tab dismiss logic.
- [x] 1.4 Ensure the shortcut prevents WebView/page fallback while preserving session/runtime lifecycle.

## 2. Verification

- [x] 2.1 Verify pressing `Command+W` closes the active open tab only.
- [x] 2.2 Verify the session remains available in history/sidebar after closing the tab.
- [x] 2.3 Verify active runtime turns are not stopped or interrupted by the shortcut.
- [x] 2.4 Verify Settings -> Shortcuts exposes the close-current-session command.
