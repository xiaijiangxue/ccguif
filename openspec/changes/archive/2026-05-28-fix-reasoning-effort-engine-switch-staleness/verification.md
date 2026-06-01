# Verification

## Commands

- `npm exec vitest run src/features/models/hooks/useModels.test.tsx src/features/composer/components/ChatInputBox/ChatInputBoxAdapter.test.tsx src/app-shell-parts/modelSelection.test.ts`
  - Result: passed, 3 test files / 80 tests.
  - Regression covered: Codex runtime models with empty reasoning metadata are hydrated from the Codex catalog, and explicit empty reasoning options no longer fall back to the global Claude-inclusive level list.
- `npm exec vitest run src/features/composer/components/ChatInputBox/selectors/ReasoningSelect.test.tsx src/features/composer/components/ChatInputBox/ChatInputBoxAdapter.test.tsx`
  - Result: passed, 2 test files / 49 tests.
  - Regression covered: the default reasoning trigger no longer renders a chevron, while the empty-options guard remains intact.
- `npm exec vitest run src/features/models/hooks/useModels.test.tsx src/features/composer/components/ChatInputBox/selectors/ReasoningSelect.test.tsx src/features/composer/components/ChatInputBox/ChatInputBoxAdapter.test.tsx src/app-shell-parts/modelSelection.test.ts`
  - Result: passed, 4 test files / 83 tests.
  - Regression covered: Codex model fallback metadata, default-trigger chrome cleanup, explicit empty options, and model/effort resolution compatibility across Claude/Codex.
- `npm run typecheck`
  - Result: passed.
- `openspec validate --all --strict --no-interactive`
  - Result: passed, 322 items.

## Prior Commands

- `npx vitest run src/app-shell-parts/selectedComposerSession.test.ts src/app-shell-parts/useSelectedComposerSession.test.tsx src/app-shell-parts/modelSelection.test.ts src/features/engine/engineCapabilityMatrix.test.ts src/features/engine/capabilities/useCapability.test.tsx src/features/threads/hooks/useThreadMessaging.context-injection.test.tsx`
  - Result: passed, 6 test files / 60 tests.
- `npm run check:engine-capability-matrix`
  - Result: passed, `[engine-capability-matrix] ok`.
- `cargo test --manifest-path src-tauri/Cargo.toml capability_matrix`
  - Result: passed, 4 matching Rust tests.
- `npm run typecheck`
  - Result: passed.
- `openspec validate --all --strict --no-interactive`
  - Result: passed, 320 items.

## Notes

- `npm run test -- <focused files>` was attempted first, but the project batched test wrapper rejected path arguments. Focused frontend verification used `npx vitest run ...` instead.
