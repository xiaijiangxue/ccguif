## MODIFIED Requirements

### Requirement: Recover And Resend MUST Make Fresh Fallback Visible

When a user explicitly chooses a stale Codex thread recovery card continuation action, the system MUST make the continuation target clear and MUST not require the user to discover a separate Fork entry point manually.

#### Scenario: recovery card offers fork shortcut

- **WHEN** the message canvas detects a Codex stale thread recovery error
- **THEN** the recovery card MUST expose a direct Fork action in the canvas
- **AND** the user MUST NOT need to discover a separate bottom toolbar Fork menu to create a usable forked conversation

#### Scenario: recovery card explains stale thread meaning and next step

- **WHEN** the message canvas renders a Codex stale thread recovery card
- **THEN** the card MUST explain that the current Codex thread binding is no longer safe to continue
- **AND** it MUST state that the existing canvas content remains visible while the failed request needs a usable continuation thread
- **AND** it MUST present a recommended next step that tells the user to Fork the current conversation
- **AND** raw provider/runtime details such as `thread not found` MUST be visually secondary to the user-facing explanation

#### Scenario: fork shortcut is a clear primary action

- **WHEN** the stale thread recovery card can offer a continuation action
- **THEN** the primary action MUST combine a Fork-oriented icon with concise text such as `Fork`
- **AND** the action label MUST NOT promise automatic resend semantics
- **AND** the action MUST call the existing shared Fork capability rather than introducing a parallel fork implementation
- **AND** the action MUST NOT call the recover-and-resend path

#### Scenario: fork shortcut does not require runtime reacquire

- **WHEN** the user clicks the stale thread recovery card Fork action
- **THEN** the UI MUST invoke the shared Fork callback without first requiring runtime reacquire for the stale thread
- **AND** runtime reacquire MUST remain scoped to recover-only or non-stale reconnect/resend actions
