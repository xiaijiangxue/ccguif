## 1. Model And Store Foundation

- [ ] 1.1 [P0][depends:none][I: proposal/design provider-based OrchestrationTask model][O: TypeScript domain types for OrchestrationTask, provider source refs, status, review state, and dispatch draft][V: focused type-level/unit tests compile] Define orchestration domain model without hard-coding OpenSpec or Trellis source kinds.
- [ ] 1.2 [P0][depends:1.1][I: existing client storage pattern][O: workspace-scoped local-first orchestration task store][V: store tests cover create/update/list/archive and reload restore across two workspaces] Implement persistence for orchestration tasks without writing Project Map, provider artifacts, TaskRun, or session artifacts.
- [ ] 1.3 [P0][depends:1.2][I: malformed local task records][O: safe normalization and degraded record handling][V: tests cover missing fields, unknown status, invalid provider refs] Add reader normalization so corrupt local records do not crash the center.
- [ ] 1.4 [P0][depends:1.1][I: current TaskRun Kanban-only definition ref][O: backward-compatible TaskRun source extension for orchestration launches][V: tests cover legacy Kanban runs and new orchestration-linked runs] Extend TaskRun linkage without pretending non-Kanban tasks are Kanban tasks.
- [ ] 1.5 [P1][depends:1.2][I: workspace identity/path conventions][O: normalized workspace-relative source ref helpers][V: tests cover macOS/Windows-style path samples without hard-coded separators] Keep source refs portable across platforms.

## 2. Core Source Providers

- [ ] 2.1 [P0][depends:1.1][I: manual task form input][O: manual provider draft creation][V: tests cover no-evidence manual draft and required scope/acceptance fields] Support plain workspaces with no spec/workflow provider.
- [ ] 2.2 [P0][depends:1.1][I: Project Map persisted dataset/node/evidence][O: project-map provider candidate reader][V: tests cover node id, label, evidence refs, confidence, stale marker] Read Project Map nodes as orchestration candidate inputs without modifying map data.
- [ ] 2.3 [P0][depends:1.4][I: existing TaskRun store/projection][O: TaskRun provider/link reader][V: tests cover active, failed, completed, missing linked session cases] Surface existing runs as linkable orchestration context.
- [ ] 2.4 [P0][depends:2.1,2.2,2.3][I: mixed core source failures][O: aggregate provider result with per-provider degraded markers][V: tests prove one failed provider does not hide healthy core providers] Implement core provider aggregation.

## 3. Optional Provider Ingestion

- [ ] 3.1 [P1][depends:1.1][I: SpecHub provider snapshot][O: provider-neutral spec candidate reader][V: tests cover OpenSpec, spec-kit, unknown/degraded provider states] Read spec work through SpecHub abstraction instead of OpenSpec-specific parsing.
- [ ] 3.2 [P2][depends:1.1][I: `.trellis/tasks/**/task.json` and `prd.md` when present][O: optional Trellis workflow provider][V: tests cover absent Trellis, linked metadata, missing PRD, malformed JSON] Read Trellis tasks without making Trellis required.
- [ ] 3.3 [P2][depends:1.1][I: package scripts, CI workflows, agent-rule files][O: optional repository-signal provider][V: tests cover absent files and detected signals as advisory only] Expose repository workflow signals without treating them as core task sources.

## 4. Project Map Create-Task Bridge

- [ ] 4.1 [P0][depends:1.2,2.2][I: selected Project Map node][O: create-task action that opens task draft][V: component/hook tests cover selected node draft creation] Add create-task entrypoint from Project Map node actions.
- [ ] 4.2 [P0][depends:4.1][I: node evidence/confidence/stale metadata][O: draft with provider sourceRefs, evidenceRefs, risk markers, scope summary seed][V: tests cover no-evidence, low-confidence, stale-node cases] Carry evidence and risk markers into the draft.
- [ ] 4.3 [P0][depends:4.2][I: created draft][O: persisted candidate/planned orchestration task][V: store + UI tests verify no TaskRun is created] Ensure Project Map create-task never auto-starts execution.
- [ ] 4.4 [P1][depends:4.3][I: task source ref][O: navigate from task detail back to Project Map node][V: tests cover existing node focus and missing node fallback] Add back-navigation to source node.

## 5. Orchestration Center UI

- [ ] 5.1 [P0][depends:1.2,2.4][I: aggregated candidates and persisted tasks][O: Orchestration Center route/surface entry][V: render test covers plain workspace empty state, loading, degraded, populated states] Add standalone surface without replacing existing Task Center.
- [ ] 5.2 [P0][depends:5.1][I: task/candidate list][O: queue with provider/status/engine/workspace/risk filters][V: component tests cover filter combinations without state mutation] Implement queue and filters.
- [ ] 5.3 [P0][depends:5.1][I: selected task][O: detail panel with scope, acceptance, provider sources, evidence, linked runs, linked sessions, activity][V: component tests cover degraded refs and empty refs] Implement task detail view.
- [ ] 5.4 [P0][depends:5.3][I: supported source/run/session refs][O: bounded provider-aware action rail][V: tests cover open source, open conversation, disabled unsupported routes] Implement navigation actions.
- [ ] 5.5 [P1][depends:5.2,5.3][I: visual states and i18n][O: zh/en copy, risk chips, status chips, accessible labels][V: focused UI/i18n tests or snapshot coverage] Polish visible UX without implying OpenSpec/Trellis are required.

## 6. Dispatch And TaskRun Linkage

- [ ] 6.1 [P0][depends:5.3][I: candidate/planned/ready task][O: dispatch confirmation dialog with engine, workspace, thread strategy, prompt summary, sources, acceptance][V: tests verify execution cannot start before confirm] Add explicit dispatch gate.
- [ ] 6.2 [P0][depends:6.1,1.4][I: confirmed dispatch draft + existing TaskRun launch path][O: TaskRun created with orchestration task linkage][V: integration/focused tests assert linked run id, non-Kanban source, and task status projection] Route dispatch through existing TaskRun/thread/runtime path.
- [ ] 6.3 [P0][depends:6.2][I: TaskRun active/terminal states][O: orchestration status projection running/waiting_input/blocked/review_needed][V: tests cover completed->review_needed and failed->blocked] Project linked run lifecycle back to orchestration task.
- [ ] 6.4 [P0][depends:6.3][I: linked completed run][O: review actions accept result / request changes / create follow-up][V: tests cover accept->completed and request changes lineage] Implement review gate.
- [ ] 6.5 [P1][depends:6.3][I: existing Task Center run detail][O: navigate from Task Center run to orchestration task][V: focused tests cover linked and unlinked runs] Add reverse navigation from run to task.

## 7. Provider Boundaries And Safety

- [ ] 7.1 [P0][depends:2.4,6.4][I: orchestration task state changes][O: no automatic provider artifact writes][V: tests/static checks assert no OpenSpec/Trellis/spec-kit/agent-rule writes during ingest/dispatch/review] Enforce read-only provider boundary.
- [ ] 7.2 [P0][depends:6.1][I: write-like provider actions][O: explicit future-action placeholder or disabled action with explanation][V: tests cover disabled state and copy] Avoid hidden writes while still showing the next workflow.
- [ ] 7.3 [P1][depends:5.4][I: archive orchestration task][O: task hidden from active queue without deleting source artifacts][V: tests cover source artifacts unchanged] Implement local archive semantics.

## 8. Verification And Release Gates

- [ ] 8.1 [P0][depends:all implementation tasks][I: OpenSpec artifacts][O: strict validation pass][V: `openspec validate add-agent-task-orchestration-center --strict --no-interactive`] Validate this change.
- [ ] 8.2 [P0][depends:1-7][I: changed TypeScript modules][O: type safety pass][V: `npm run typecheck`] Run full TypeScript typecheck.
- [ ] 8.3 [P0][depends:1-7][I: changed UI/store/readers][O: focused test pass][V: focused Vitest suites for orchestration store, core providers, Project Map bridge, center UI, dispatch/review] Run targeted frontend tests.
- [ ] 8.4 [P1][depends:3.1][I: optional SpecHub provider implementation][O: provider-neutral candidate tests][V: focused SpecHub/OpenSpec/spec-kit degraded-state suites] Run optional spec provider tests if implemented.
- [ ] 8.5 [P1][depends:8.3][I: touched runtime/session/backend contracts if any][O: backend/runtime validation][V: `cargo test --manifest-path src-tauri/Cargo.toml` and/or `npm run check:runtime-contracts`, or record not applicable] Run backend gates only if implementation crosses Tauri/Rust/runtime boundaries.
- [ ] 8.6 [P1][depends:8.1,8.2,8.3][I: desktop manual QA][O: manual matrix result][V: plain workspace manual task, Project Map task, optional provider candidate, dispatch, linked run completion, review gate, archive] Complete minimal desktop smoke test before archive.
