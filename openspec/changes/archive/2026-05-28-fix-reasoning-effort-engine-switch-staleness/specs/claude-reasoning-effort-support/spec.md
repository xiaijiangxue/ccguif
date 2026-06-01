## ADDED Requirements

### Requirement: Reasoning Effort MUST Rebind On Engine Switch

The composer MUST resolve reasoning effort against the effective engine selected for the next turn whenever the user changes engines, switches threads, or restores a draft composer selection.

#### Scenario: switching from Codex to Claude rebinds effort options
- **WHEN** the user switches the composer engine from `codex` to `claude`
- **THEN** the composer MUST show the Claude reasoning effort option set `low`, `medium`, `high`, `xhigh`, and `max`
- **AND** the selected effort used for the next Claude send MUST be either a valid Claude effort or empty
- **AND** a stale Codex-only effort value MUST NOT be sent as the Claude `effort`

#### Scenario: switching from Claude to Codex rebinds effort options
- **WHEN** the user switches the composer engine from `claude` to `codex`
- **THEN** the composer MUST resolve reasoning effort from the Codex model/capability path
- **AND** the Codex selector MUST NOT surface Claude-only `max` as a fallback option when the active Codex model metadata is temporarily empty
- **AND** Claude-specific effort state MUST NOT cause Codex to append Claude CLI `--effort`

#### Scenario: switching to unsupported engine clears effective effort
- **WHEN** the user switches the composer engine to `gemini`, `opencode`, or another engine whose `reasoning.effort` capability is not supported
- **THEN** the composer MUST hide or disable the reasoning effort control
- **AND** the next send payload MUST NOT include a stale effective `effort`

### Requirement: Send-Time Effort MUST Use Effective Engine

The system MUST compute the outgoing `effort` from the same effective engine identity that will dispatch the next user turn.

#### Scenario: Claude send uses Claude effort after engine switch
- **WHEN** the effective engine for the next turn is `claude`
- **AND** the user selects `high` after switching to Claude
- **THEN** the frontend send payload MUST include `effort` with value `high`
- **AND** the backend Claude command MUST include `--effort high`

#### Scenario: stale visible or stored effort cannot override effective engine
- **WHEN** the visible composer or stored thread selection contains an effort value from a previous engine
- **AND** the next turn's effective engine does not support that value
- **THEN** send-time resolution MUST ignore that stale effort
- **AND** the payload MUST use `null`, an empty optional value, or the valid effort for the effective engine

#### Scenario: shared session selected engine controls effort resolution
- **WHEN** the user sends from a shared session
- **AND** the shared-session engine selector is set to `claude`
- **THEN** reasoning effort MUST be resolved against Claude options and capabilities
- **AND** the result MUST NOT be resolved against the previously active non-shared composer engine

### Requirement: Thread Composer Effort MUST Be Engine-Valid

Thread-scoped and draft composer selection MUST store and restore reasoning effort only when the value is valid for that thread's effective engine.

#### Scenario: thread switch restores only valid effort
- **WHEN** Thread A has a valid Claude effort and Thread B has a valid Codex effort
- **AND** the user switches between Thread A and Thread B
- **THEN** each thread MUST restore only the effort valid for its own effective engine
- **AND** the restored effort MUST NOT leak into the other thread's send payload

#### Scenario: invalid stored effort is ignored on read
- **WHEN** persisted composer selection contains an effort value that is not supported by the current effective engine
- **THEN** the system MUST treat that effort as absent for UI and send-time resolution
- **AND** message sending MUST continue through the engine's default behavior

#### Scenario: default trigger stays text-and-icon without chevron
- **WHEN** the current engine supports a reasoning effort selector
- **AND** the current thread or draft has no explicit effort selected
- **THEN** the default reasoning trigger MUST render the engine-default label and icon
- **AND** the trigger MUST NOT add an extra chevron-only affordance in that default state

#### Scenario: pending to finalized thread migration preserves valid effort
- **WHEN** a pending thread is finalized to a real engine session id
- **AND** its draft composer selection includes an effort valid for the finalized engine
- **THEN** the migrated thread selection MUST preserve that effort
- **AND** invalid effort for the finalized engine MUST be dropped instead of persisted
