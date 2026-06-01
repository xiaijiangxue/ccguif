## 1. OpenSpec Contract

- [x] 1.1 Add proposal/design/spec/tasks artifacts for `composer-file-reference-index-availability`; input: issue `#635` report and current workspace file-index lifecycle; output: validated behavior contract; validation: `openspec validate fix-composer-file-reference-without-file-tree-open --strict --no-interactive`; dependencies: none; priority: P0.

## 2. Workspace File Index Lifecycle

- [x] 2.1 Decouple initial workspace file-index loading from file-tree panel visibility; input: `src/app-shell.tsx` `useWorkspaceFiles` options; output: active connected workspace loads initial file index even when right panel/file tree is closed; validation: focused test plus direct code review; dependencies: 1.1; priority: P0.
- [x] 2.2 Preserve file-tree-scoped polling; input: existing `workspaceFilesPollingEnabled` condition; output: closed file tree does not start periodic polling; validation: focused hook test and app-shell wiring review; dependencies: 2.1; priority: P0.

## 3. Regression Coverage

- [x] 3.1 Add or update hook test proving `initialLoadEnabled=true` and `pollingEnabled=false` still performs the first load; input: `useWorkspaceFiles` test harness; output: regression coverage for issue `#635`; validation: `npx vitest run src/features/workspaces/hooks/useWorkspaceFiles.test.tsx`; dependencies: 2.1; priority: P0.
- [x] 3.2 Run existing composer autocomplete test to ensure file suggestion behavior remains unchanged; input: existing autocomplete tests; output: passing `@` completion coverage; validation: `npx vitest run src/features/composer/hooks/useComposerAutocompleteState.test.tsx`; dependencies: 2.1; priority: P1.

## 4. Verification

- [x] 4.1 Run focused frontend validation; input: implemented code/tests; output: passing focused Vitest evidence; validation: `npx vitest run src/features/workspaces/hooks/useWorkspaceFiles.test.tsx src/features/composer/hooks/useComposerAutocompleteState.test.tsx`; dependencies: 3.1, 3.2; priority: P0.
- [x] 4.2 Run TypeScript validation; input: implemented code/tests; output: no type regressions; validation: `npm run typecheck`; dependencies: 4.1; priority: P0.
- [x] 4.3 Run strict OpenSpec validation; input: completed artifacts; output: change validates strictly; validation: `openspec validate fix-composer-file-reference-without-file-tree-open --strict --no-interactive`; dependencies: 1.1; priority: P0.
