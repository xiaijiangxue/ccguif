## ADDED Requirements

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

#### Scenario: helper read during stopping returns transient state

- **WHEN** a helper read targets a workspace runtime currently in `stopping` or cleanup state
- **THEN** system MUST return a transient typed degraded result or last-good snapshot where available
- **AND** system MUST NOT spawn a second automatic runtime acquire for the same workspace and engine

#### Scenario: quarantine pauses automatic recovery

- **WHEN** repeated runtime acquire failures exhaust the configured recovery budget
- **THEN** system MUST enter a quarantined or cooldown state for that workspace and engine
- **AND** subsequent automatic helper reads MUST surface quarantine diagnostics instead of retrying immediately

#### Scenario: explicit retry can open bounded recovery

- **WHEN** the user explicitly retries, reconnects, or starts new runtime-required work after quarantine
- **THEN** system MUST allow a fresh guarded recovery attempt
- **AND** the fresh attempt MUST remain bounded by the same retry and generation contract
