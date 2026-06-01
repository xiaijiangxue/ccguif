## Implementation Evidence: Dock And Stop-Button Closure

Date: 2026-05-22

### Scope

- Composer streaming stop button visual polish:
  - Keep the existing sparkle asset at `src/assets/icon.png`.
  - Render the active stop affordance as a 24px circular button.
  - Preserve the surrounding ingress sparkle/halo pseudo-elements.
- Bottom dock compatibility polish:
  - `StatusPanel` dock gains a left collapse/expand cell.
  - Collapsed StatusPanel remains mounted as a 30px bottom bar.
  - `TerminalDock` aligns with the same flat tab-bar toggle pattern.

### Review Notes

- No backend, Tauri command, database, or persisted settings contract changed.
- No new dependency was introduced.
- StatusPanel collapse/expand uses existing layout callbacks:
  - `onClosePlanPanel`
  - `onOpenPlanPanel`
- Terminal collapse uses the existing terminal toggle callback.
- Composer stop button changes are CSS-only and scoped to `.stop-button`; the normal send button remains unchanged.
- The stop button keeps `assets/icon.png` visible and hides the inner `codicon-debug-stop` glyph, preventing the visual regression where the sparkle icon became a plain stop square.

### Compatibility Matrix

| Surface | Compatibility Check | Result |
| --- | --- | --- |
| Composer stop button | CSS-only visual change, no send path or queue semantics changed | Pass |
| StatusPanel dock | Collapsed state keeps dock entry mounted and reuses existing open/close callbacks | Pass |
| Terminal dock | Toggle callback is passed through existing layout options | Pass |
| Theme | Uses existing tokens, codicon classes, and local asset | Pass |
| Platform | No OS-specific path, shell, Tauri, or backend assumption added | Pass |

### Verification

Commands run during closure:

```bash
npx vitest run src/features/composer/components/ChatInputBox/styles/buttons.test.ts src/features/composer/components/ChatInputBox/ButtonArea.test.tsx
npx vitest run src/features/status-panel/components/StatusPanel.test.tsx src/styles/status-panel-theme.test.ts src/styles/terminal-theme.test.ts
npx vitest run src/features/layout/components/DesktopLayout.test.tsx src/features/layout/hooks/useLayoutNodes.client-ui-visibility.test.tsx
npx eslint src/features/composer/components/ChatInputBox/styles/buttons.test.ts src/features/composer/components/ChatInputBox/ButtonArea.tsx
npx eslint src/features/status-panel/components/StatusPanel.tsx src/features/layout/hooks/useLayoutNodes.tsx src/features/status-panel/components/StatusPanel.test.tsx src/styles/status-panel-theme.test.ts
npm run typecheck
npm run check:large-files
git diff --check
```

## Implementation Evidence: Selected Context Chips Row

Date: 2026-05-22

### Scope

- Move selected skill / command / agent chips from the bottom toolbar into a dedicated row above the editable composer body.
- Keep `ContextBar surface="external"` and existing `onRemoveContextChip` behavior.
- Remove the `contextSurface` prop path from `ChatInputBoxFooter` and `ButtonArea`.
- Move bottom-toolbar-specific selected chip CSS into `.chat-input-context-surface` styling.

### Review Notes

- UI-only change: no send payload, queue, runtime lifecycle, backend, Tauri command, database, or persisted setting changed.
- Selected chip state still originates from the existing composer selection data and removal callbacks.
- `ButtonArea` no longer owns selected context chips, reducing the chance that future toolbar changes reintroduce chip/tool crowding.
- The new row uses standard React DOM and CSS only; no OS-specific selector, file path, shell command, native menu, or platform API is involved.

### Compatibility Matrix

| Surface | Windows Compatibility | macOS Compatibility | Result |
| --- | --- | --- | --- |
| Context chip row | Standard flex/DOM/CSS; no platform API | Standard flex/DOM/CSS; no platform API | Pass |
| Bottom toolbar | Removes chip rendering only; tool callbacks unchanged | Removes chip rendering only; tool callbacks unchanged | Pass |
| Chip remove action | Existing callback path preserved | Existing callback path preserved | Pass |
| Theme | Uses existing `ContextBar` styles and tokens | Uses existing `ContextBar` styles and tokens | Pass |
| Input behavior | Editable wrapper and keyboard handling unchanged | Editable wrapper and keyboard handling unchanged | Pass |

### Verification

Commands run during closure:

```bash
pnpm -s vitest run src/features/composer/components/ChatInputBox/ButtonArea.test.tsx
pnpm -s tsc -p . --noEmit
```
