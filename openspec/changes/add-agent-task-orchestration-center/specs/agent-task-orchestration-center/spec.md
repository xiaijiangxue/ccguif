## ADDED Requirements

### Requirement: Orchestration Center SHALL Work Without Spec Or Workflow Providers

系统 SHALL 提供通用 `Agent Task Orchestration Center`，即使 workspace 没有 OpenSpec、spec-kit、Trellis、agent-rule files 或 CI workflow，也必须可用。

#### Scenario: plain workspace opens orchestration center

- **WHEN** active workspace has no `openspec/**`, `.trellis/**`, `.codex/**`, `.claude/**`, spec-kit files, or known workflow files
- **THEN** Orchestration Center SHALL open successfully
- **AND** user SHALL be able to create a manual task draft
- **AND** UI SHALL NOT describe missing optional providers as an error

#### Scenario: provider absence is represented as unavailable

- **WHEN** an optional provider is not detected for the workspace
- **THEN** Orchestration Center SHALL represent that provider as unavailable or empty
- **AND** core manual, Project Map, TaskRun, and session actions SHALL remain usable

### Requirement: Orchestration Center SHALL Aggregate Work Items Through Providers

系统 SHALL aggregate work items through provider-based source references instead of hard-coding one repository workflow.

#### Scenario: center lists provider-backed work items

- **WHEN** manual tasks, Project Map nodes, TaskRuns, sessions, or optional provider candidates are available
- **THEN** Orchestration Center SHALL list corresponding work items in one surface
- **AND** each item SHALL expose provider id, source kind, source label, and availability state

#### Scenario: malformed provider degrades without breaking center

- **WHEN** one provider artifact is missing, malformed, or schema-ambiguous
- **THEN** Orchestration Center SHALL mark that provider candidate as degraded or unknown
- **AND** healthy providers and core sources SHALL remain visible and usable

#### Scenario: provider filters narrow the queue

- **WHEN** user filters by provider id, source kind, status, engine, workspace, or risk marker
- **THEN** Orchestration Center SHALL narrow the visible work-item queue
- **AND** filtering SHALL NOT mutate task state

### Requirement: Orchestration Task SHALL Preserve Source Evidence And Execution Scope

系统 SHALL persist orchestration tasks as work-item projections that keep provider refs, evidence refs, scope, acceptance, and linked execution ids separate from source artifacts.

#### Scenario: task stores provider-backed source references

- **WHEN** an orchestration task is created from any source
- **THEN** the task SHALL store source references with provider id and source kind
- **AND** the task SHALL store evidence references when evidence is available
- **AND** the task SHALL store confidence and stale markers when the source provides them

#### Scenario: manual task does not invent evidence

- **WHEN** user creates a manual task draft without source evidence
- **THEN** the task SHALL store provider id `core:manual` or equivalent
- **AND** evidence references SHALL be empty unless user attaches supported files or refs
- **AND** UI SHALL NOT present manual text as verified project evidence

#### Scenario: task keeps scope and acceptance summary

- **WHEN** a task draft is created
- **THEN** the draft SHALL include a scope summary
- **AND** the draft SHALL include an acceptance summary before it can be dispatched

#### Scenario: task links to runs and sessions by stable ids

- **WHEN** a task is dispatched or associated with prior work
- **THEN** the task SHALL store linked run ids and linked session ids
- **AND** the task SHALL NOT copy complete run or session payloads as its own truth

### Requirement: Dispatch SHALL Require Explicit User Confirmation

系统 SHALL require explicit user confirmation before starting agent execution from an orchestration task.

#### Scenario: user confirms dispatch details before execution

- **WHEN** user dispatches a candidate, planned, or ready orchestration task
- **THEN** the system SHALL show engine, workspace, thread strategy, prompt summary, source references, and acceptance summary
- **AND** execution SHALL start only after the user confirms

#### Scenario: provider ingestion does not auto-start execution

- **WHEN** Project Map, SpecHub, workflow provider, TaskRun, or repository-signal ingestion discovers a candidate task
- **THEN** the system SHALL NOT automatically start an agent run
- **AND** the item SHALL remain candidate or planned until user action promotes it

#### Scenario: low confidence task cannot silently become ready

- **WHEN** a task draft comes from low-confidence, unknown-confidence, or stale Project Map evidence
- **THEN** the task SHALL expose the risk marker
- **AND** the task SHALL NOT become ready without user review

### Requirement: Completed Runs SHALL Enter Review Gate Before Task Completion

系统 SHALL treat agent run completion as evidence for review, not as automatic orchestration task completion.

#### Scenario: completed run creates review-needed task state

- **WHEN** a linked TaskRun reaches completed status
- **THEN** the orchestration task SHALL enter `review_needed` or equivalent review state
- **AND** the task SHALL remain uncompleted until user accepts the result

#### Scenario: failed run keeps task diagnosable

- **WHEN** a linked TaskRun fails or blocks
- **THEN** the orchestration task SHALL expose blocked or failure summary
- **AND** the task SHALL keep links to the failed run and conversation when available

#### Scenario: user requests follow-up from review

- **WHEN** user rejects or requests changes for a review-needed task
- **THEN** the system SHALL support creating a follow-up task or successor run
- **AND** lineage SHALL reference the parent task or parent run

### Requirement: Orchestration Actions SHALL Be Bounded And Provider-Aware

系统 SHALL expose only bounded actions that route to core surfaces, provider source surfaces, or existing execution paths.

#### Scenario: open source artifact from task detail

- **WHEN** task detail includes Project Map, spec provider, workflow provider, file, run, or session references
- **THEN** user SHALL be able to open the corresponding source surface when the route is supported
- **AND** unsupported routes SHALL be disabled or explained

#### Scenario: execution action uses existing run path

- **WHEN** user starts, retries, resumes, or forks execution from Orchestration Center
- **THEN** the action SHALL route through existing TaskRun/thread/runtime control paths
- **AND** Orchestration Center SHALL update from returned run state rather than locally faking success

#### Scenario: archive hides task without deleting source artifacts

- **WHEN** user archives an orchestration task
- **THEN** the task SHALL leave the default active queue
- **AND** the system SHALL NOT delete Project Map, SpecHub, workflow, TaskRun, session, or repository source artifacts

### Requirement: Orchestration Core SHALL Not Depend On Personal Or Repository-Specific Workflow Files

系统 SHALL keep personal/project-specific workflow files outside the orchestration core.

#### Scenario: personal agent rules are optional repository signals

- **WHEN** workspace contains `AGENTS.md`, `.codex/**`, `.claude/**`, or similar agent-rule files
- **THEN** Orchestration Center MAY expose them as optional repository signals
- **AND** the core task model SHALL NOT require them to exist

#### Scenario: Trellis files are optional workflow provider input

- **WHEN** workspace contains `.trellis/tasks/**`
- **THEN** Orchestration Center MAY expose Trellis candidates through an optional workflow provider
- **AND** absence of `.trellis/**` SHALL NOT reduce core functionality
