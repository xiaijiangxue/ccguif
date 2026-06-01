# bridge-cleanup-hardening Specification

## Purpose

Defines the bridge-cleanup-hardening behavior contract, covering Bridge Command Boundary Segregation.
## Requirements
### Requirement: Bridge Command Boundary Segregation
The system SHALL separate Bridge command handlers from domain business services and shared adapters using explicit module boundaries.

#### Scenario: Command layer delegates to domain service
- **WHEN** a Tauri command receives a request
- **THEN** command handler MUST perform request parsing/validation and delegate business execution to a domain service module
- **AND** business logic MUST NOT be implemented directly inside command registration module

### Requirement: Bridge Error Contract Normalization
The system SHALL normalize Bridge errors into stable, typed error envelopes consumable by frontend clients.

#### Scenario: Domain error is surfaced through normalized envelope
- **WHEN** a domain service returns an error
- **THEN** Bridge layer MUST map it to a normalized error structure with stable code/category/message fields
- **AND** frontend-facing command contract SHALL remain backward compatible

### Requirement: Bridge Concurrency and File-Lock Enforcement
The system SHALL enforce mutex and file-lock constraints for Bridge operations that access shared state or file storage.

#### Scenario: Shared state command execution
- **WHEN** a command mutates shared in-memory state or project files
- **THEN** implementation MUST use the required mutex/file-lock guard patterns
- **AND** command execution MUST remain retry-safe for idempotent operations

### Requirement: Bridge Refactor Compatibility
The system SHALL preserve existing command names, argument schemas, and response semantics during modularization.

#### Scenario: Existing command invocation after refactor
- **WHEN** existing frontend invokes a pre-refactor command
- **THEN** command resolution and response shape MUST match previous behavior
- **AND** no migration change SHALL be required on the caller side

### Requirement: Frontend Tauri Service Facade Compatibility
The system SHALL preserve the exported API surface of `src/services/tauri.ts` when implementation is modularized into domain submodules.

#### Scenario: Existing import path remains valid after modularization
- **WHEN** frontend code imports functions or types from `src/services/tauri.ts`
- **THEN** the same exported names MUST remain available from that façade file
- **AND** callers MUST NOT require import path migration for the modularization batch

#### Scenario: Extracted domain keeps command contract stable
- **WHEN** a `src/services/tauri.ts` domain is moved into a submodule
- **THEN** the invoked Tauri command names, argument names, and response semantics MUST remain unchanged
- **AND** the modularization MUST preserve existing fallback behavior for that domain, if any

### Requirement: Tauri Bridge Contract Changes MUST Be Checklist-Gated

Any implementation batch in this change that touches frontend Tauri facades, Rust command handlers, command registration, or command payloads MUST record a bridge contract checklist.

#### Scenario: touched command keeps frontend facade compatibility

- **WHEN** a touched command is invoked through `src/services/tauri.ts` or a domain submodule re-exported by that facade
- **THEN** existing exported function and type names MUST remain available unless the proposal explicitly authorizes migration
- **AND** callers MUST NOT be required to change import paths as part of this stabilization batch

#### Scenario: touched command preserves command registration semantics

- **WHEN** a Rust command handler or `command_registry.rs` entry is moved, wrapped, or refactored
- **THEN** the registered Tauri command name MUST remain available
- **AND** argument names and successful response semantics MUST remain backward-compatible

#### Scenario: touched command records error contract impact

- **WHEN** bridge error propagation changes for a touched command
- **THEN** the implementation MUST record whether existing frontend error mapping remains valid
- **AND** user-facing behavior MUST NOT regress from structured or recoverable diagnostics to raw unclassified text

