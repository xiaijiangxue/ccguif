## 1. View Model And Inspector

- [x] 1.1 P0 Create the feature-local task output view-model types and pure projection helpers from subagent rows, task notifications, and token usage. Input: existing frontend facts. Output: `EngineTaskOutputSnapshot`. Validation: unit tests for Claude, Codex, and missing telemetry.
- [x] 1.2 P0 Implement the `EngineTaskOutputInspector` component with status, identity, recent output, output artifact, and token telemetry sections. Depends on 1.1. Validation: component tests for pending/unavailable telemetry and output preview truncation.

## 2. Surface Integration

- [x] 2.1 P0 Extend StatusPanel subagent rows to expose inspector metadata while preserving existing Codex thread navigation and Claude task scroll behavior. Depends on 1.1. Validation: existing StatusPanel tests plus new inspector callback tests.
- [x] 2.2 P0 Add an inspector action to existing conversation task notification cards without changing final result rendering. Depends on 1.2. Validation: Messages test for button presence and callback payload.
- [x] 2.3 P1 Wire inspector state at the StatusPanel and message-card boundaries so both entry points use the same inspector component. Depends on 2.1 and 2.2. Validation: typecheck and focused integration test where feasible.

## 3. Safety And Verification

- [x] 3.1 P0 Add i18n keys and styles with bounded layout, no global chat bubble width changes. Depends on 1.2. Validation: DOM assertions and CSS class review.
- [x] 3.2 P0 Run focused frontend tests for touched components and helpers. Depends on implementation tasks. Validation: Vitest command output.
- [x] 3.3 P0 Run `npm run typecheck` and strict OpenSpec validation. Depends on all implementation tasks. Validation: command output.

## 4. Bounded Artifact Refresh

- [x] 4.1 P0 Extend the snapshot source model to retain `outputFilePath` separately from display name. Validation: projection tests preserve the absolute artifact path without rendering it as identity text.
- [x] 4.2 P0 Add a runtime/service wrapper for bounded task output artifact tail reads. Validation: service mapping test and Rust unit coverage for temp/workspace allowed paths and disallowed paths.
- [x] 4.3 P0 Add an inspector-scoped refresh hook that starts only when the inspector is open and cleans up on close. Validation: hook/component tests for no-path no-call, success update, and failure fallback.
- [x] 4.4 P0 Wire refreshed snapshots into StatusPanel and task-notification inspectors without changing navigation or message streaming. Validation: focused StatusPanel/Messages tests plus typecheck.
