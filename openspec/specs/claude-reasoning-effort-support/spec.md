# claude-reasoning-effort-support Specification

## Purpose

Defines the claude-reasoning-effort-support behavior contract, covering Claude Provider MUST Expose Reasoning Effort Selector.
## Requirements
### Requirement: Claude Provider MUST Expose Reasoning Effort Selector

The system MUST expose Claude-supported reasoning effort values when the active composer provider or execution engine is Claude Code, without regressing any existing non-Claude reasoning controls.

#### Scenario: Claude provider shows reasoning selector
- **WHEN** the user is composing a message with Claude Code selected as the provider or execution engine
- **THEN** the composer MUST show a reasoning effort selector
- **AND** the selector MUST offer `low`, `medium`, `high`, `xhigh`, and `max` as selectable values

#### Scenario: providers without reasoning effort support hide Claude selector
- **WHEN** the active provider or execution engine is Gemini, OpenCode, or any engine that does not expose a reasoning effort control
- **THEN** the composer MUST NOT show the Claude reasoning effort selector
- **AND** the system MUST NOT include a Claude-specific effort field in that provider's send payload

#### Scenario: existing Codex reasoning selector is preserved
- **WHEN** the active provider or execution engine is Codex
- **THEN** this change MUST NOT remove or alter the existing Codex reasoning selector contract
- **AND** the Codex selector MUST NOT fall back to Claude-only `max` when Codex runtime model metadata is temporarily empty
- **AND** Codex sends MUST NOT append Claude CLI `--effort` arguments

#### Scenario: no selection preserves CLI default
- **WHEN** the user sends a Claude message without selecting a reasoning effort value
- **THEN** the system MUST omit `effort` from the Claude send params or send it as an empty optional value
- **AND** the Claude engine MUST NOT append `--effort` to the CLI command

### Requirement: Claude Send Params MUST Preserve Selected Effort

The system MUST carry a selected Claude reasoning effort from the frontend composer through the service and IPC boundary to the Claude engine send params.

#### Scenario: selected effort reaches backend params
- **WHEN** the user selects `high` in the Claude reasoning effort selector
- **AND** sends a Claude message
- **THEN** the frontend send payload MUST include `effort` with value `high`
- **AND** the Tauri service or IPC mapping MUST preserve that field when invoking the backend send command

#### Scenario: all supported effort values are accepted by the contract
- **WHEN** the user selects any of `low`, `medium`, `high`, `xhigh`, or `max`
- **AND** sends a Claude message
- **THEN** the send params contract MUST preserve the selected value exactly
- **AND** the value MUST remain distinguishable from the selected model, provider, prompt text, and session identifiers

#### Scenario: effort remains independent from model selection
- **WHEN** the user changes the Claude model selector and the reasoning effort selector before sending
- **THEN** the selected Claude runtime model MUST continue to resolve through the existing model selection contract
- **AND** the selected effort MUST be carried as a separate runtime option rather than being encoded into the model id or model value

### Requirement: Claude Engine MUST Append Effort CLI Argument Only For Allowed Values

The Claude engine MUST validate `params.effort` against the allowed reasoning effort values before appending CLI arguments.

#### Scenario: allowed effort appends CLI argument
- **WHEN** the Claude engine builds a command with `params.effort` set to `high`
- **THEN** the command MUST include `--effort`
- **AND** the command MUST include `high` as the value immediately associated with that option

#### Scenario: every allowed effort maps to CLI argument
- **WHEN** the Claude engine builds a command with `params.effort` set to any of `low`, `medium`, `high`, `xhigh`, or `max`
- **THEN** the command MUST include `--effort <value>` using the same selected value
- **AND** the engine MUST NOT rewrite the value to a model name, prompt fragment, or provider setting

#### Scenario: missing effort does not append CLI argument
- **WHEN** the Claude engine builds a command and `params.effort` is absent or empty
- **THEN** the command MUST NOT include `--effort`
- **AND** message sending MUST continue through the existing Claude default behavior

#### Scenario: invalid effort is ignored safely
- **WHEN** the Claude engine receives `params.effort` with a value outside `low`, `medium`, `high`, `xhigh`, and `max`
- **THEN** the command MUST NOT include `--effort`
- **AND** the invalid value MUST NOT be interpolated into any CLI argument

### Requirement: Reasoning Effort MUST Preserve Existing Claude Model Behavior

Adding reasoning effort support MUST NOT alter Claude model discovery, model refresh, custom model, or runtime model resolution behavior.

#### Scenario: model catalog remains unchanged by effort selection
- **WHEN** the user opens or refreshes the Claude model selector after selecting a reasoning effort
- **THEN** the Claude model catalog MUST continue to be built from the existing settings, environment, and custom model sources
- **AND** the reasoning effort value MUST NOT create, remove, rename, or reorder model options

#### Scenario: runtime model and effort are both passed correctly
- **WHEN** a Claude model option resolves to a runtime model value
- **AND** the user selects a valid reasoning effort before sending
- **THEN** the Claude engine MUST use the existing runtime model resolution result for the model argument
- **AND** it MUST append the selected effort as a separate `--effort <value>` CLI option

#### Scenario: non-Claude engines keep existing behavior
- **WHEN** a message is sent through Codex, Gemini, OpenCode, or another non-Claude engine
- **THEN** reasoning effort support MUST NOT change that engine's model selection, send params, command construction, or runtime behavior

### Requirement: Default Reasoning Trigger MUST Avoid Extra Chevron Chrome

When the reasoning selector is in its engine-default state, the trigger MUST remain visually minimal and MUST NOT add an extra chevron-only affordance.

#### Scenario: default trigger shows label and icon without chevron
- **WHEN** the user is on a Claude or Codex composer surface that exposes a reasoning effort selector
- **AND** no explicit effort is selected for the current thread or draft
- **THEN** the trigger MUST show the default label and icon for that engine state
- **AND** the trigger MUST NOT render an extra chevron glyph in that default state

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
