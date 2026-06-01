# runtime-lifecycle-recovery-guard Specification

## Purpose
TBD - created by archiving change harden-client-runtime-environment-recovery. Update Purpose after archive.
## Requirements
### Requirement: Runtime Acquire MUST Be Guarded By Workspace Engine And Generation

系统 MUST guard managed runtime acquire/recovery by `workspaceId + engine + runtime generation` so cleanup, reconnect, and helper reads cannot create concurrent acquire storms.

#### Scenario: automatic acquire sources share one leader

- **WHEN** multiple automatic sources request runtime access for the same workspace and engine
- **THEN** system MUST allow at most one in-flight automatic acquire or recovery leader
- **AND** other automatic callers MUST await that leader, reuse its result, or receive a typed degraded outcome

#### Scenario: stopping runtime is not reused for foreground execution

- **WHEN** a runtime generation is marked `stopping`, `manual-shutdown`, `runtime-ended`, or `stale-reuse-cleanup`
- **THEN** system MUST reject that generation as a foreground execution target
- **AND** user-initiated work MUST start or await a fresh guarded generation

#### Scenario: predecessor diagnostics cannot poison successor generation

- **WHEN** a predecessor runtime generation emits late shutdown or stdout diagnostics after a successor generation exists
- **THEN** diagnostics MUST remain associated with the predecessor generation
- **AND** successor foreground work MUST NOT be failed unless affected work identity matches

### Requirement: Helper Runtime Reads MUST Degrade Without Recovery Storms

model list, account rate limit, history load, thread list, and similar helper reads MUST NOT independently trigger unbounded runtime recovery.

#### Scenario: daemon helper reads use the shared acquire guard

- **WHEN** daemon-mode `model/list` or `account/rateLimits/read` needs a live Codex session for a workspace
- **THEN** the system MUST enter the shared guarded Codex session ensure path before sending the live helper request
- **AND** acquire contention or quarantine MUST be surfaced from the shared runtime recovery guard instead of a separate helper-read recovery path

