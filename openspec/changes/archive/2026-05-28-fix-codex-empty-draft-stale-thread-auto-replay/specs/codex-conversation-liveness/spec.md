## ADDED Requirements

### Requirement: First-Turn Draft Replacement MUST Cover Recovery Entrypoints

Codex first-turn draft replacement MUST apply to every user-visible entrypoint that attempts to continue the current first prompt before `turn/start` acceptance, including direct send retry, runtime resume, and recovery-card resend.

#### Scenario: recovery card does not bypass empty draft replacement
- **WHEN** a newly created Codex draft has no accepted user turn and no durable local activity
- **AND** the provisional thread identity fails with `thread not found` before the current first prompt is accepted
- **THEN** the primary continuation path MUST create or acquire a fresh Codex thread and replay the current prompt there
- **AND** the UI MUST NOT require stale old-session recovery as the primary action for that first prompt

#### Scenario: durable boundary keeps recovery card semantics
- **WHEN** the Codex thread has accepted user work, durable local activity, or unknown accepted-turn facts
- **AND** the thread identity fails with `thread not found`
- **THEN** the system MUST keep durable-safe stale recovery semantics
- **AND** it MUST NOT silently replace the conversation as an empty draft
