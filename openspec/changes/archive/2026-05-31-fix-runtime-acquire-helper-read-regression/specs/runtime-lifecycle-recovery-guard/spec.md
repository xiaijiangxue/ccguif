## MODIFIED Requirements

### Requirement: Helper Runtime Reads MUST Degrade Without Recovery Storms

model list, account rate limit, history load, thread list, and similar helper reads MUST NOT independently trigger unbounded runtime recovery.

#### Scenario: daemon helper reads use the shared acquire guard

- **WHEN** daemon-mode `model/list` or `account/rateLimits/read` needs a live Codex session for a workspace
- **THEN** the system MUST enter the shared guarded Codex session ensure path before sending the live helper request
- **AND** acquire contention or quarantine MUST be surfaced from the shared runtime recovery guard instead of a separate helper-read recovery path
