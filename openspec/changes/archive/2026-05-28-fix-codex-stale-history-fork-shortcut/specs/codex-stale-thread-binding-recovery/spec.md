## MODIFIED Requirements

### Requirement: Fresh Continuation MUST Preserve User Intent Visibility

When stale Codex recovery cannot safely revive the original thread, the continuation path MUST preserve the user's immediate intent and MUST prefer a Fork continuation before falling back to a plain fresh thread.

#### Scenario: fork continuation is preferred over plain fresh continuation

- **WHEN** a Codex historical thread fails with a stale binding signal such as `thread not found`, `session not found`, or equivalent invalid thread id
- **AND** verified rebind cannot recover a canonical replacement
- **THEN** the system MUST attempt to fork the stale source thread before creating a plain fresh Codex thread
- **AND** a successful fork MUST become the target for the replayed user prompt

#### Scenario: fork continuation renders the replayed prompt

- **WHEN** manual recover-and-resend or automatic stale-send recovery continues in a forked Codex thread
- **THEN** the replayed user prompt MUST be visibly represented in the forked thread
- **AND** duplicate suppression MUST NOT hide the prompt merely because the action originated from a stale source thread

#### Scenario: fork failure falls back to fresh continuation

- **WHEN** verified rebind fails
- **AND** fork continuation fails or is unavailable
- **THEN** the system MAY fall back to a plain fresh Codex thread when existing fresh-continuation guards allow it
- **AND** the UI MUST distinguish the fallback from recovered original-thread semantics

### Requirement: Recover And Resend MUST Make Fresh Fallback Visible

When a user explicitly chooses to recover and resend from a stale Codex thread recovery card, the system MUST make the continuation target clear and MUST not require the user to discover the Fork menu manually.

#### Scenario: recovery card offers fork resend shortcut

- **WHEN** the message canvas detects a Codex stale thread recovery error
- **AND** a previous prompt is available for replay
- **THEN** the recovery card MUST expose a direct Fork/resend action in the canvas
- **AND** the user MUST NOT need to open the bottom toolbar Fork menu to continue

#### Scenario: forked resend reports fork continuation

- **WHEN** recover-and-resend produces a forked continuation thread
- **THEN** the recovery card MUST report that the prompt continued in a Fork conversation
- **AND** it MUST NOT present the original runtime thread as revived
