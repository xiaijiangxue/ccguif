## ADDED Requirements

### Requirement: Empty Draft Fresh Replay MUST Be Single-Shot And Non-Alias-Rebinding

When Codex stale binding recovery replaces an empty first-turn draft with a fresh thread, the replacement MUST behave as a single-shot prompt continuation rather than a verified stale-thread rebind.

#### Scenario: empty draft replay happens at most once
- **WHEN** a first-turn empty Codex draft hits a recoverable missing-thread error
- **THEN** the system MAY create a fresh Codex thread and replay the current prompt once
- **AND** repeated missing-thread failure MUST settle to visible recovery or error state rather than looping through fresh replacements

#### Scenario: empty draft replacement does not persist durable alias
- **WHEN** a first-turn empty Codex draft is replaced by a fresh thread
- **THEN** the system MUST NOT persist an alias that claims the old thread identity was verified as recovered
- **AND** diagnostics MUST distinguish the result from durable stale-thread rebind
