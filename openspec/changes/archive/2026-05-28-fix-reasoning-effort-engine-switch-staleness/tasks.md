## 1. Contract Discovery

- [x] 1.1 Locate all composer effort resolution inputs: `activeEngine`, shared-session selected engine, active thread engine source, `selectedEffort`, `selectedComposerSelection`, and model-derived reasoning options. Input: current app-shell/composer code; output: affected file list and resolution flow notes; validation: `rg -n "getEffectiveSelectedEffort|reasoningEffort|handleSelectComposerSelection|engineSendMessage" src/app-shell-parts src/features/composer src/services`; dependencies: none; priority: P0.
- [x] 1.2 Confirm existing Claude backend `--effort` support and capability matrix mismatch. Input: `src-tauri/src/engine/claude.rs`, `src-tauri/src/engine/mod.rs`, `openspec/specs/engine-capability-matrix/fixtures/matrix.json`; output: implementation note identifying current mismatch; validation: `rg -n "CLAUDE_REASONING_EFFORTS|reasoning_effort|reasoning.effort" src-tauri/src openspec/specs/engine-capability-matrix`; dependencies: 1.1; priority: P0.

## 2. Frontend Effort Resolution

- [x] 2.1 Add or refactor a pure effective-engine effort resolver in `src/app-shell-parts/modelSelection.ts`. Input: existing `getEffectiveSelectedEffort` and capability helpers; output: resolver that returns valid effort only for the effective engine; validation: focused unit tests for Claude, Codex, Gemini, OpenCode, stale value, and empty value cases; dependencies: 1.1; priority: P0.
- [x] 2.2 Wire composer UI effort display to the resolver output so engine switches immediately rebind options and selected value. Input: ChatInputBox props and app-shell composer wiring; output: Claude/Codex options shown only when valid, unsupported engines hidden/disabled; validation: focused React/Vitest test or existing app-shell test covering Codex -> Claude -> Gemini switches; dependencies: 2.1; priority: P0.
- [x] 2.3 Update send payload construction to use the same resolver result as UI. Input: composer send handler and `engineSendMessage` call sites; output: `effort` included only when valid for the dispatch engine; validation: focused test asserting Claude `high` survives switch and unsupported engines send `null`/no effective effort; dependencies: 2.1; priority: P0.

## 3. Thread And Draft Selection Consistency

- [x] 3.1 Normalize thread-scoped composer selection reads so invalid effort is ignored for the current effective engine. Input: `useSelectedComposerSession.ts` and `selectedComposerSession.ts`; output: read path drops stale or unsupported effort; validation: unit tests for stored Claude effort read under Codex/Gemini and valid effort restore under Claude; dependencies: 2.1; priority: P0.
- [x] 3.2 Normalize selection writes and pending-to-real migration so only engine-valid effort is persisted. Input: `handleSelectComposerSelection`, draft carry, migration helpers; output: valid effort preserved, invalid effort dropped; validation: existing selected composer session migration tests extended for engine-valid effort; dependencies: 3.1; priority: P1.
- [x] 3.3 Cover shared-session engine selection in effort resolution. Input: shared-session selected engine path and composer send path; output: shared session uses selected engine for effort resolution; validation: focused test for shared `claude` selection after global composer was `codex`; dependencies: 2.3; priority: P1.

## 4. Capability Matrix Alignment

- [x] 4.1 Update OpenSpec fixture so `claude.reasoning.effort` is `supported`, preserving Codex supported and Gemini/OpenCode unsupported. Input: `openspec/specs/engine-capability-matrix/fixtures/matrix.json`; output: updated fixture; validation: fixture diff shows only intended cell change; dependencies: 1.2; priority: P0.
- [x] 4.2 Update TypeScript capability projection so Claude `reasoning.effort` runtime status agrees with the fixture. Input: `src/features/engine/engineCapabilityMatrix.ts` and related types; output: TS projection no longer returns `unknown`/unsupported for Claude effort; validation: focused TS test or `npm run check:engine-capability-matrix`; dependencies: 4.1; priority: P0.
- [x] 4.3 Update Rust `EngineFeatures::claude()` and Rust capability tests to report reasoning effort support. Input: `src-tauri/src/engine/mod.rs`, `src-tauri/src/engine/capability_matrix.rs`; output: Rust capability state matches fixture; validation: focused `cargo test --manifest-path src-tauri/Cargo.toml capability_matrix`; dependencies: 4.1; priority: P0.

## 5. Verification And Closure

- [x] 5.1 Run focused frontend tests for model/effort resolver, composer engine switch, selected composer session persistence, and service payload mapping. Input: implemented frontend changes; output: passing focused Vitest evidence; validation: record exact commands and results in implementation notes or verification artifact; dependencies: 2.1, 2.2, 2.3, 3.1; priority: P0.
- [x] 5.2 Run backend/capability verification. Input: capability matrix changes; output: passing matrix and Rust tests; validation: `npm run check:engine-capability-matrix` and focused Rust capability tests pass; dependencies: 4.1, 4.2, 4.3; priority: P0.
- [x] 5.3 Run final gates and update OpenSpec evidence. Input: completed implementation and tests; output: archive-ready verification notes; validation: `openspec validate --all --strict --no-interactive`, `npm run typecheck`, focused test commands pass or list exact blockers; dependencies: 5.1, 5.2; priority: P0.
