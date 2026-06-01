# codex-goal-slash-command-ux Specification

## Purpose
TBD - created by archiving change add-codex-goal-slash-command-ux. Update Purpose after archive.
## Requirements
### Requirement: Goal Command Panel Discovery

The client MUST expose Codex `/goal` command-family entries in the command panel without taking over execution.

#### Scenario: show goal command entries in Codex mode

- **Given** the selected engine is Codex
- **When** the user opens the command panel
- **Then** the command panel includes `/goal`
- **And** the command panel includes `/goal pause`
- **And** the command panel includes `/goal resume`
- **And** the command panel includes `/goal clear`

#### Scenario: command selection inserts text only

- **Given** the command panel is open
- **When** the user selects `/goal pause`
- **Then** the composer receives the text `/goal pause`
- **And** the client does not execute a local goal handler

### Requirement: Preserve Normal Goal Send Path

The client MUST preserve the normal message send path for `/goal...` text.

#### Scenario: goal objective is sent as normal message

- **Given** the user types `/goal 项目分析`
- **When** the user submits the composer
- **Then** the client sends the text through the normal message path
- **And** the client does not route it to `startGoal`
- **And** the client does not call `thread/goal/*` RPC wrappers

#### Scenario: goal subcommands are sent as normal messages

- **Given** the user types `/goal clear`
- **When** the user submits the composer
- **Then** the client sends `/goal clear` through the normal message path
- **And** Codex runtime, not the client UI, owns the command semantics

### Requirement: No Local Goal Runtime

The client MUST NOT introduce local goal state for this change.

#### Scenario: no progress row state source

- **Given** a goal command was sent
- **When** Codex responds in the canvas
- **Then** the client does not infer current goal state from assistant prose
- **And** the client does not show a local goal progress row based on inferred state
