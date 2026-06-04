# agent-task-orchestration-center Specification

## Purpose

Defines the agent task orchestration center behavior contract.
## Requirements
### Requirement: Orchestration dispatch accepts Browser Snapshot v2 as input evidence
Agent Task Orchestration Center SHALL allow Browser Snapshot v2 evidence and page-to-code candidates to be attached to task dispatch inputs.

#### Scenario: User dispatches a task with browser context
- **WHEN** the user launches an orchestration task while Browser Context Snapshot v2 is attached
- **THEN** the dispatch confirmation SHALL show the browser evidence source, freshness, diagnostics, and candidate code files before launch

#### Scenario: Browser context is degraded
- **WHEN** attached browser context is degraded or stale
- **THEN** orchestration dispatch SHALL surface the degraded/stale state rather than hiding it from the user

### Requirement: Orchestration uses engine-agnostic browser payloads
Agent Task Orchestration Center SHALL pass browser context through the shared BrowserContextAttachment v2 contract and SHALL NOT create engine-specific browser payloads.

#### Scenario: Task is routed to a different engine
- **WHEN** an orchestration task using browser context is routed to Claude, Codex, Gemini, OpenCode, or a custom provider
- **THEN** the browser context SHALL remain in the shared attachment shape with provider-specific formatting limited to final request serialization

### Requirement: Orchestration Tasks SHALL support linked browser context evidence

Agent Task Orchestration Center SHALL allow orchestration tasks to reference Browser Sessions and Browser Context Snapshots as source or execution evidence while preserving the orchestration task as the work-item truth.

#### Scenario: browser snapshot becomes task source evidence
- **WHEN** the user creates or dispatches an orchestration task from a Browser Dock page
- **THEN** the task SHALL store a reference to the browser session or snapshot used as evidence
- **AND** the task surface SHALL show the page title, URL, and capture time when available

#### Scenario: orchestration dispatch includes browser context explicitly
- **WHEN** a task dispatch uses browser context as AI input
- **THEN** the dispatch confirmation SHALL show the browser attachment before launch
- **AND** the dispatched prompt SHALL include only the bounded sanitized snapshot rather than unrestricted live browser state

#### Scenario: browser evidence does not overwrite provider artifacts
- **WHEN** a browser-linked orchestration task also has Project Map, workflow, OpenSpec, or manual source evidence
- **THEN** Browser evidence SHALL be additive
- **AND** the system SHALL NOT delete or rewrite other provider artifacts because browser evidence changed

### Requirement: Orchestration Center Unit Tests SHALL Isolate Runtime Bridges

Orchestration Center component tests SHALL mock Tauri bridge calls when the test assertions do not cover bridge behavior.

#### Scenario: queue UI tests do not load runtime model bridge

- **WHEN** a unit test renders `OrchestrationCenterView` to assert queue, filter, dispatch, review, or source-ref UI behavior
- **THEN** the test SHALL mock model discovery bridge calls such as `getEngineModels`, `getModelList`, and `getConfigModel`
- **AND** the test SHALL NOT import heavy runtime bridge side effects as an incidental dependency

