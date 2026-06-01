## 1. Layout entry

- [x] 1.1 Extend center mode / panel mode types with Project Knowledge Map mode.
- [x] 1.2 Add globe-style Project Knowledge Map icon to `PanelTabs`.
- [x] 1.3 Wire tab click to open the center Project Knowledge Map panel.
- [x] 1.4 Add i18n keys for tab tooltip and panel title.

## 2. Feature shell

- [x] 2.1 Create `src/features/project-map/` module.
- [x] 2.2 Build full-center `ProjectMapPanel` shell.
- [x] 2.3 Add top toolbar with project name, last generated state, and global collection button.
- [x] 2.4 Replace the fixed layer rail with a profile-driven lens strip.
- [x] 2.5 Add in-house SVG/HTML graph canvas, node inspector, evidence strip, and run log placeholder.
- [x] 2.6 Implement structured node detail rendering for core description, key facts, key logic, related artifacts, confidence, stale state, and generation metadata.
- [x] 2.7 Add smart initial view selection: Overview for new maps, Risk / Evidence / recent lenses when stale nodes, candidates, or recent high-activity changes exist.
- [x] 2.8 Add candidate review surfaces in the top bar badge and node inspector.
- [x] 2.9 Implement graph node selection, hover state, one-hop neighborhood focus, and stale/candidate/confidence visual states without third-party graph dependencies.

## 3. Persistence contract

- [x] 3.1 Define `ProjectMapManifest`, `ProjectMapProfile`, `ProjectMapLens`, `ProjectMapNode`, `ProjectMapNodeDetail`, `ProjectMapSource`, auto-ingestion settings, cursor, and run metadata types.
- [x] 3.2 Add Tauri / service boundary for reading `.ccgui/project-map/<project-name>-<short-hash>/`.
- [x] 3.3 Add constrained atomic write support for `.ccgui/project-map/<project-name>-<short-hash>/**`.
- [x] 3.4 Implement manifest, profile, and lens file read/write.
- [x] 3.5 Add schemaVersion compatibility handling.
- [x] 3.6 Implement `settings.json`, `memory-ingestion/cursor.json`, and `memory-ingestion/processed.json` read/write.
- [x] 3.7 Add storage key derivation using project name plus workspace short hash.
- [x] 3.8 Implement `candidates/` persistence and `backups/` backup creation before rebuild.
- [x] 3.9 Ensure all project-map path construction uses platform-safe join/normalize APIs and does not hard-code path separators.

## 4. AI generation orchestration

- [x] 4.1 Build generation confirmation dialog with engine, model, scope, read sources, and write path.
- [x] 4.2 Implement global collection request creation.
- [x] 4.3 Implement node-level completion / calibration request creation.
- [x] 4.4 Require structured AI output as validated node patch.
- [x] 4.5 Record generation run metadata under `runs/`.
- [x] 4.6 Support structured detail patch generation without allowing manual text editing.

## 5. Evidence gate

- [x] 5.1 Validate every confirmed node claim has at least one source or `unknown` confidence.
- [x] 5.2 Store evidence metadata under `evidence/`.
- [x] 5.3 Track source hash and mark stale nodes.
- [x] 5.4 Reject unsupported deterministic claims before persistence.
- [x] 5.5 Keep graph node summaries concise; move extended detail to inspector.
- [x] 5.6 Validate key facts in node details against sources.
- [x] 5.7 Enforce evidence priority: code, spec, tests, commit, memory.
- [x] 5.8 Ensure memory alone cannot create high-confidence code-fact claims.

## 6. Graph and inspector

- [x] 6.1 Render lens graph from persisted nodes.
- [x] 6.2 Support node selection and one-hop neighborhood focus.
- [x] 6.3 Show summary, confidence, stale state, sources, lastGeneratedAt, generatedBy, and risk signals in inspector.
- [x] 6.4 Add node actions: complete, calibrate, refresh evidence.
- [x] 6.5 Ensure all node content is read-only.
- [x] 6.6 Visually de-emphasize stale nodes and expose manual calibration entry.

## 7. Project memory auto ingestion

- [x] 7.1 Add Project Knowledge Map settings for auto ingestion toggle, engine, model, threshold, interval, and apply mode, defaulting to `createCandidate`.
- [x] 7.2 Implement unprocessed project memory message discovery by session id + message hash.
- [x] 7.3 Trigger automatic ingestion when unprocessed sessions reach the configured threshold.
- [x] 7.4 Scope automatic ingestion to unprocessed sessions, relevant existing nodes, and necessary evidence.
- [x] 7.5 Store default-mode automatic ingestion results as candidates that require user confirmation before active lens writes.
- [x] 7.6 Keep `autoApplyEvidenceBacked` as an advanced opt-in mode, default off.
- [x] 7.7 Allow automatic ingestion to create new nodes and update matching nodes, while blocking unrelated node changes.
- [x] 7.8 Mark successfully consumed session id + message hash pairs as processed.
- [x] 7.9 Ensure failed runs do not mark messages as processed.
- [x] 7.10 Exclude processed messages from future automatic ingestion.

## 8. Conversation knowledge capture

- [x] 8.1 Detect project-knowledge candidates from Q&A only when evidence is identifiable.
- [x] 8.2 Show candidate save confirmation before writing.
- [x] 8.3 Route confirmed candidates through the same evidence gate and persistence layer.

## 9. Testing

- [x] 9.1 Add unit tests for manifest, profile/lens persistence, settings, and memory ingestion cursor persistence.
- [x] 9.2 Add unit tests for evidence gate validation and key-fact source validation.
- [x] 9.3 Add component tests for empty state, lens drilldown, node selection, structured detail rendering, and read-only inspector.
- [x] 9.4 Add component tests for global, node-level, and automatic ingestion generation confirmation/settings.
- [x] 9.5 Add integration test or focused service test for constrained `.ccgui/project-map/<project-name>-<short-hash>/**` writes.
- [x] 9.6 Add tests ensuring processed project memory messages are not reused and failed runs do not mark messages processed.
- [x] 9.7 Add tests for storage key collision avoidance, rebuild backup creation, candidate badge visibility, and stale node visual treatment.
- [x] 9.8 Add graph renderer tests for node selection, one-hop focus, and stale/candidate/confidence state styling.

## 10. Verification

- [x] 10.1 Run typecheck.
- [x] 10.2 Run lint.
- [x] 10.3 Run focused Project Knowledge Map tests.
- [x] 10.4 Record Windows/macOS/Linux compatibility evidence or explicit platform coverage qualifiers for graph rendering and persistence.
- [x] 10.5 Run OpenSpec validation for `add-project-xray-panel`.
- [x] 10.6 Calibrate proposal, design, and spec artifacts against current P0 mock UI code facts.

## 11. AI worker execution

- [x] 11.1 Recalibrate proposal / design / spec so queued generation requires a real worker handoff instead of request-only recording.
- [x] 11.2 Extend run metadata with phase, progress, thread id, and concise logs for observable background execution.
- [x] 11.3 Add a single active-slot worker that promotes pending runs to running and starts the next pending run only after completion / failure.
- [x] 11.4 Collect bounded workspace evidence through existing Tauri workspace file APIs, excluding dependency / build / binary-heavy paths.
- [x] 11.5 Dispatch the selected engine / model through existing app-server thread or engine message APIs.
- [x] 11.6 Parse and validate structured AI ProjectMapDataset JSON before persistence.
- [x] 11.7 Apply global and node-scoped generation results to `.ccgui/project-map/<project-name>-<short-hash>/**`.
- [x] 11.8 Update Task drawer UX so active runs show concrete phases, progress, thread id, latest log, and queue cancellation.
- [x] 11.9 Add focused tests for worker queue lifecycle, successful generation write, failed generation, and queued cancellation.
- [x] 11.10 Run typecheck, lint, focused project-map tests, large-file check, and OpenSpec validation.

## 12. Queue execution regression closure

- [x] 12.1 Fix React StrictMode cleanup so a claimed Project Map worker keeps updating the active run instead of leaving the UI stuck in `queued`.
- [x] 12.2 Guard worker UI updates by current workspace id so stale workspace runs cannot overwrite the newly selected workspace.
- [x] 12.3 Restore persisted queued / running records even when the map has not generated any lenses yet.
- [x] 12.4 Use the existing read-only synchronous engine message boundary for Project Map generation so completion is based on a final AI response, not only app-server stream events.
- [x] 12.5 Add regression tests for StrictMode queue claiming and queued-run restore before generated lenses exist.

## 13. Active-slot startup closure

- [x] 13.1 Fix `project_map_read` / `project_map_write_snapshot` to use async workspace locking instead of `blocking_lock()` inside Tauri async commands.
- [x] 13.2 Start the app-session active-slot worker from the optimistic queued run without waiting for the first queued persistence write to settle.
- [x] 13.3 Apply running / failed run state optimistically before persistence awaits so the Task drawer never remains visually stuck on `queued`.
- [x] 13.4 Add focused regression tests for worker claim before first persistence settles and failed active-slot persistence.
- [x] 13.5 Run focused Project Map tests and Rust `project_map` tests.

## 14. Inspector selection and i18n fallback closure

- [x] 14.1 Prevent canvas pan pointer capture from swallowing graph node selection clicks.
- [x] 14.2 Add readable localized labels for AI-generated `record`, `interface`, `runtime`, `tech-stack`, and `cross-cutting` node kinds.
- [x] 14.3 Add readable source type labels and fallback formatting so unsupported dynamic keys do not render as raw i18n paths.
- [x] 14.4 Add regression tests for pointer-based node selection, dynamic node-kind fallback, source type fallback, and locale coverage.
- [x] 14.5 Run focused Project Map tests, typecheck, lint, and OpenSpec validation.

## 15. First-run graph visibility closure

- [x] 15.1 Fix Project Map stage CSS so Task banner, lens shell, and graph canvas occupy stable grid rows when the active task banner disappears after first generation.
- [x] 15.2 Keep empty / error states in the same flexible graph row so first-run no-data and generated-data states do not collapse differently.
- [x] 15.3 Add a CSS regression test for the stable stage row contract.
- [x] 15.4 Run focused Project Map tests, typecheck, lint, build, and OpenSpec validation.

## 16. Cross-engine generation stability closure

- [x] 16.1 Route Project Map Codex generation through a temporary read-only app-server thread event stream and persist the generated thread id in run metadata.
- [x] 16.2 Normalize evidence before all engine dispatch paths instead of applying engine-specific prompt fixes.
- [x] 16.3 Enforce a bounded total evidence prompt budget and dynamic per-file budget for large documentation workspaces.
- [x] 16.4 Truncate oversized text on readable paragraph, line, or sentence boundaries instead of raw string slicing.
- [x] 16.5 Preserve Markdown heading digests and explicit `PROJECT_MAP_TRUNCATED` markers for compressed evidence.
- [x] 16.6 Add regression tests for oversized Markdown evidence across Claude, Gemini, OpenCode and for Codex thread id propagation.
- [x] 16.7 Run focused Project Map tests, typecheck, and large-file governance check.
