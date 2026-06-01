## Verification

Generated on 2026-05-25 for `unify-context-ledger-toggle-position`.

### Commands

| Command | Result | Notes |
|---|---|---|
| `openspec validate unify-context-ledger-toggle-position --strict --no-interactive` | Pass | Change artifact validation passed. |
| `openspec validate --all --strict --no-interactive` | Pass | Full OpenSpec workspace validation passed: 307 items, 0 failed. |
| `npx vitest run src/features/composer/components/ChatInputBox/ComposerReadinessBar.test.tsx src/features/context-ledger/components/ContextLedgerPanel.test.tsx src/features/composer/components/Composer.context-ledger-governance.test.tsx src/features/composer/components/Composer.context-ledger-transition.test.tsx` | Pass | Focused UI coverage for the right-top expand/collapse toggle and duplicate-header suppression passed. |
| `npx eslint src/features/composer/components/Composer.tsx src/features/composer/components/ChatInputBox/ChatInputBox.tsx src/features/composer/components/ChatInputBox/ChatInputBoxAdapter.tsx src/features/composer/components/ChatInputBox/ChatInputBoxHeader.tsx src/features/composer/components/ChatInputBox/ComposerReadinessBar.tsx src/features/context-ledger/components/ContextLedgerPanel.tsx src/features/composer/components/ChatInputBox/ComposerReadinessBar.test.tsx src/features/context-ledger/components/ContextLedgerPanel.test.tsx src/features/composer/components/Composer.context-ledger-governance.test.tsx src/features/composer/components/Composer.context-ledger-transition.test.tsx` | Pass | Touched implementation and focused test files linted cleanly. |
| `npm run check:large-files` | Pass | Large-file sentry found 0 blocking findings. |
| `git diff --check` | Pass | No whitespace errors in the scoped diff. |
| `npm run typecheck` | Pass | Full TypeScript validation passed. |

### Manual QA

- User confirmed the adjusted Composer interaction passes testing on 2026-05-25.

### Evidence Summary

- `ComposerReadinessBar` owns the single Context Ledger disclosure action in the Composer dialog top-right readiness area.
- The same button switches between `展开` and `收起`.
- `ContextLedgerPanel` renders expanded detail with `hideHeader` when Composer delegates disclosure ownership to the readiness bar.
- Collapsed state no longer creates a separate ledger header under the readiness bar.
- Prompt assembly, send payload, memory injection, and runtime lifecycle were not changed.

### Code / Proposal Alignment

| Proposal claim | Code evidence | Status |
|---|---|---|
| Readiness bar owns the single top-right disclosure toggle | `Composer.tsx` passes `onToggleContextSources` and `contextSourcesExpanded` into `ChatInputBoxAdapter`; `ComposerReadinessBar.tsx` renders `.composer-readiness-expand` only when context exists and callback is present. | Match |
| Toggle switches between expand and collapse in the same position | `ComposerReadinessBar.tsx` uses `contextSourcesExpanded ? contextLedgerCollapse : contextLedgerExpand` for the same button; `ComposerReadinessBar.test.tsx` rerenders expanded state and clicks both labels. | Match |
| Collapsed state does not render a separate ledger header below readiness bar | `Composer.tsx` renders `ContextLedgerPanel` only when `contextLedgerExpanded && contextLedgerProjection.visible`; transition/governance tests assert `.composer-context-ledger` and ledger region are absent before expansion. | Match |
| Expanded detail hides duplicate disclosure header | `ContextLedgerPanel.tsx` adds `hideHeader`; `Composer.tsx` passes it for readiness-owned disclosure; panel tests assert visible title/collapse header text is absent while detail region remains. | Match |
| Source management remains inside detail | `ContextLedgerPanel.tsx` keeps batch governance, pin/exclude/clear, and source detail actions in the detail body; no send path or governance helper API was changed. | Match |
| CSS needed for right-top button | Existing `.composer-readiness-expand` class is reused; `e79604ab` has no net change to `ChatInputBox/styles/banners.css`. | Calibrated |

### Residual Risk

- No known residual risk for this scoped UI placement change.
