## 1. Right-Top Toggle Ownership

- [x] 1.1 P0 输入：visible Context Ledger projection；输出：readiness bar 右上角渲染唯一 Context Ledger toggle；验证：focused Composer tests。
- [x] 1.2 P0 输入：expanded ledger state；输出：同一右上角按钮从“展开”切换为“收起”；验证：ComposerReadinessBar test。

## 2. Detail Panel De-Duplication

- [x] 2.1 P0 输入：expanded Context Ledger detail；输出：detail panel 隐藏自身重复 header / 收起按钮；验证：ContextLedgerPanel test。
- [x] 2.2 P1 输入：right-top toggle CSS；输出：保留 `.composer-readiness-expand` 作为右上角 toggle 样式；验证：large-file sentry。

## 3. Verification

- [x] 3.1 P0 输入：OpenSpec delta；输出：`openspec validate unify-context-ledger-toggle-position --strict --no-interactive` 通过。
- [x] 3.2 P0 输入：前端改动；输出：focused Vitest suites 通过。
- [x] 3.3 P0 输入：TypeScript 改动；输出：`npm run typecheck` 通过。

> 2026-05-25 note: focused Vitest、ESLint、OpenSpec strict validate、large-file sentry、scoped diff check、全量 `npm run typecheck` 均已通过。
