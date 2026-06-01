## Context

CodeMoss already has most low-level pieces for reasoning effort:

- frontend `engineSendMessage` preserves `effort` in the Tauri payload;
- Claude backend command building appends `--effort <value>` for allowed values;
- composer selection state stores `{ modelId, effort }` per thread;
- `modelSelection.ts` exposes Claude reasoning options and Codex model-derived reasoning options.

The weak boundary is not the CLI argument itself. The weak boundary is the moment the user switches engine or thread: UI state, thread-scoped selection, capability matrix state, and send-time engine resolution can temporarily disagree. That disagreement creates the visible symptom from issue #619: the user changes reasoning effort, but the next turn can be sent with a stale, missing, or wrong-engine `effort`.

## Goals / Non-Goals

**Goals:**

- Resolve reasoning effort from the same `effectiveEngine` that will receive the next turn.
- Keep Claude and Codex effort values engine-scoped and thread/draft-aware.
- Treat unsupported engines as hard boundaries that clear or ignore stale effort before send.
- Align capability matrix facts with implemented Claude `--effort` support.
- Add regression tests that reproduce engine switch and thread switch paths.

**Non-Goals:**

- No new reasoning options.
- No new persisted global default.
- No changes to Claude model discovery or Codex config persistence semantics.
- No Gemini/OpenCode effort control.

## Decisions

### Decision 1: Add an effective-engine effort resolver

Implementation should introduce or consolidate a pure resolver near `src/app-shell-parts/modelSelection.ts`:

```ts
resolveEffectiveReasoningEffort({
  effectiveEngine,
  selectedEffort,
  activeThreadSelection,
  reasoningOptions,
  capabilityState,
})
```

The resolver MUST return a valid effort only when the `effectiveEngine` supports `reasoning.effort` and the candidate exists in that engine's option set. Unsupported engines return `null`.

Alternatives considered:

- Reuse the current active-engine branch directly in component render. This keeps the current drift risk because render and send can call different branches.
- Clear all effort state on engine switch. This is simple but loses valid per-engine thread choices and does not protect send-time stale reads.

### Decision 2: Make send handler consume the same resolver output as UI

The composer UI may keep local state for display, but send-time payload construction MUST call the resolver using the final engine selected for dispatch. For shared sessions this is the shared-session selected engine; for normal sessions this is the active engine/thread engine source after existing normalization.

This means UI and send payload cannot disagree silently. If UI shows `high` for Claude, the Claude payload carries `high`; if engine changed to Gemini/OpenCode, the payload carries no effective effort.

Alternatives considered:

- Trust the stored `selectedComposerSelection.effort`. This fails when a stored value belongs to a previous engine.
- Trust only the visible select state. This fails for thread restore, draft carry, pending-to-real migration, and background send paths.

### Decision 3: Persist effort with engine validity, not as a model-adjacent free string

Existing `{ modelId, effort }` storage can remain, but writes MUST normalize effort against the effective engine before persistence. Reads MUST also validate the stored effort against the current effective engine before using it.

This preserves backward compatibility with existing storage while making stale values harmless.

Alternatives considered:

- Change storage schema to `{ engine, modelId, effort }`. This is cleaner but introduces migration and compatibility cost not needed for the bug fix.
- Split storage per engine immediately. Useful later, but unnecessary if resolver validates at read/write boundaries.

### Decision 4: Update capability matrix for Claude reasoning effort

Claude already has implemented CLI support for `--effort`, so `engine-capability-matrix` should mark Claude `reasoning.effort` as `supported`. The TypeScript projection, Rust `EngineFeatures::claude()`, Rust capability matrix, and OpenSpec fixture must agree.

Alternatives considered:

- Keep capability matrix as `unsupported` and keep Claude UI hard-coded. This preserves the bug class: capability-driven consumers and hard-coded branches can disagree.
- Mark Claude as `compat-input`. That is inaccurate because this is a first-class user-facing runtime option, not a legacy alias.

## Risks / Trade-offs

- [Risk] Capability matrix update exposes Claude effort controls in more surfaces than intended. → Mitigation: consumers must still use engine-specific option sets; only Claude/Codex have valid options.
- [Risk] Existing stored effort values may be invalid after the change. → Mitigation: read-time normalization returns `null` for unsupported or unknown values.
- [Risk] Background task sends may bypass visible composer state. → Mitigation: task execution paths must call the same resolver or explicitly pass `null` when no user-selected effort is in scope.
- [Risk] Rust `EngineFeatures::claude()` change can fail matrix parity until fixture and tests are updated together. → Mitigation: task ordering requires matrix fixture, TS projection, Rust features, and parity tests in one implementation slice.

## Migration Plan

1. Add focused failing tests for engine switch and thread switch effort resolution.
2. Introduce the pure resolver and replace duplicated effort resolution branches.
3. Route composer send payload construction through the resolver.
4. Normalize persistence reads/writes so invalid effort is not reused across engines.
5. Update Claude `reasoning.effort` capability matrix state across spec fixture, TypeScript, and Rust.
6. Run focused Vitest, Rust tests, capability matrix check, typecheck, and OpenSpec validation.

Rollback strategy:

- Revert resolver wiring and capability matrix change together. Existing backend optional `effort` support is backward-compatible and can remain dormant because missing/invalid effort does not append `--effort`.

## Open Questions

- None for proposal scope.
