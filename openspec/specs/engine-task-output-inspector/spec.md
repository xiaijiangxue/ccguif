# engine-task-output-inspector Specification

## Purpose
TBD - created by archiving change add-engine-task-output-inspector. Update Purpose after archive.
## Requirements
### Requirement: Task Output Inspector MUST Open From Delegated Task Surfaces
The system MUST provide a non-blocking inspector for delegated engine tasks from existing task surfaces without replacing normal conversation rendering.

#### Scenario: Claude task row opens inspector
- **WHEN** a StatusPanel subagent row represents a Claude task with a `taskId` or `toolUseId`
- **THEN** activating the row MUST open a task output inspector for that task
- **AND** the parent conversation MUST remain active

#### Scenario: task notification card opens inspector
- **WHEN** a conversation task notification card contains task identity or output facts
- **THEN** the card MUST expose an inspector action
- **AND** activating the action MUST NOT duplicate the task result into the parent conversation

#### Scenario: Codex thread target keeps navigation semantics
- **WHEN** a StatusPanel agent row represents a Codex delegated thread
- **THEN** the existing thread navigation behavior MUST remain available
- **AND** the inspector MAY be shown only when output facts are available for that row

### Requirement: Inspector Snapshot MUST Use Engine-Aware Task Identity
The inspector MUST normalize Claude and Codex delegated work into a shared view model while preserving engine-specific identity fields.

#### Scenario: Claude snapshot preserves task and tool identity
- **WHEN** the source task is a Claude task
- **THEN** the snapshot MUST preserve `taskId` when available
- **AND** the snapshot MUST preserve `toolUseId` when available
- **AND** missing identity fields MUST be represented as `null` rather than guessed
- **AND** when a known output artifact path exists, the snapshot MUST preserve it separately from the display file name

#### Scenario: Codex snapshot preserves thread identity
- **WHEN** the source task is a Codex delegated agent with a thread target
- **THEN** the snapshot MUST preserve `threadId`
- **AND** the snapshot MUST NOT invent a Claude-style `taskId`

#### Scenario: unavailable output remains explicit
- **WHEN** the system has task identity but no output text or output file fact
- **THEN** the inspector MUST render the output state as unavailable or pending
- **AND** it MUST NOT render an empty successful output block as if the task produced no output

### Requirement: Inspector Telemetry MUST Be Truthful And Non-Blocking
The inspector MUST render token and progress telemetry as best-effort facts and MUST NOT use blocking task-output calls.

#### Scenario: token usage is unknown
- **WHEN** no trustworthy token usage exists for the task or active thread
- **THEN** the inspector MUST show telemetry as pending or unavailable
- **AND** it MUST NOT show `0` tokens as a fallback

#### Scenario: token usage is available
- **WHEN** the active thread has normalized token usage
- **THEN** the inspector MAY show input, output, cached, and total token values
- **AND** the display MUST preserve the usage freshness/source when available

#### Scenario: no blocking polling in first slice
- **WHEN** the inspector is opened
- **THEN** the UI MUST NOT call a blocking task-output operation such as `TaskOutput(block=true)`
- **AND** the conversation streaming path MUST remain independent of inspector refresh behavior

#### Scenario: artifact refresh is scoped to inspector lifetime
- **WHEN** an inspector is opened for a task with a known output artifact path
- **THEN** the system MAY refresh a bounded artifact tail for that inspector
- **AND** refresh MUST stop when the inspector closes
- **AND** refresh failure MUST render as unavailable output without affecting the parent conversation

#### Scenario: no artifact path exists
- **WHEN** the inspector source has no output artifact path
- **THEN** the system MUST NOT call the artifact-tail bridge
- **AND** the inspector MUST continue showing existing recent output or unavailable state

### Requirement: Inspector Rendering MUST Not Regress Conversation Streaming
The inspector MUST be implemented as an additive side surface and MUST NOT add heavy derivation to the live message timeline.

#### Scenario: live assistant text continues rendering
- **WHEN** an assistant response is streaming and the inspector is opened
- **THEN** the live assistant row MUST continue using the existing live-row override path
- **AND** inspector state changes MUST NOT force timeline grouping or anchor derivations to recompute from every text delta
- **AND** artifact refresh MUST NOT be a prerequisite for live assistant row rendering

#### Scenario: task notification final result remains stable
- **WHEN** a task notification card has a final result
- **THEN** the final result MUST continue to render through the existing message card behavior
- **AND** the inspector action MUST be additive to that card

