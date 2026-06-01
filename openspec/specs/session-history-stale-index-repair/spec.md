# session-history-stale-index-repair Specification

## Purpose
TBD - created by archiving change harden-client-runtime-environment-recovery. Update Purpose after archive.
## Requirements
### Requirement: Session Catalog MUST Treat Missing Files As Degraded Index Evidence

系统 MUST treat local session index and rollout paths as recoverable metadata, not authoritative proof that history can be opened.

#### Scenario: thread list validates indexed session file

- **WHEN** thread list or session catalog reads an indexed rollout/session path
- **AND** the referenced file no longer exists
- **THEN** system MUST mark that entry as `missing`, `staleIndex`, `unrecoverableHistory`, or equivalent degraded state
- **AND** system MUST NOT repeatedly hydrate that missing file as normal history truth

#### Scenario: missing session does not clear last-good catalog

- **WHEN** a refresh encounters missing session files after a previous successful visible catalog
- **THEN** system MUST preserve the last-good visible catalog where available
- **AND** system MUST expose degraded evidence instead of replacing the surface with unexplained empty truth

### Requirement: Stale Session Repair MUST Be Conservative And Bounded

系统 MUST provide bounded repair/prune behavior for stale session indexes without deleting user session files automatically.

#### Scenario: repair prunes index references only

- **WHEN** system repairs a stale session index entry whose target file is missing
- **THEN** repair MUST only remove or mark the stale catalog/index reference
- **AND** repair MUST NOT delete unrelated session files from disk

#### Scenario: repair leaves traceable diagnostic evidence

- **WHEN** system hides, marks, or prunes a stale session index entry
- **THEN** diagnostics MUST include workspace id, engine, thread/session id when available, stale path category, and repair action
- **AND** diagnostics MUST avoid storing full prompt or assistant content

### Requirement: Fork From Message MUST Validate Target Identity Before Execution

系统 MUST validate the target user message identity before creating a fork from historical Codex or engine sessions.

#### Scenario: missing target ordinal returns typed error

- **WHEN** user requests fork from a message ordinal that does not exist in the resolved session history
- **THEN** backend MUST return a typed missing-target error
- **AND** frontend MUST stop retrying the same fork operation as if the target were valid

#### Scenario: unavailable fork target disables action

- **WHEN** UI can determine that a historical message target is missing, stale, or unrecoverable
- **THEN** UI MUST disable or hide the fork action for that target
- **AND** UI MUST show an explainable degraded reason instead of surfacing repeated generic errors
