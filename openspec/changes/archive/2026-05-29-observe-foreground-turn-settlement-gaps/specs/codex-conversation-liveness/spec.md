## ADDED Requirements

### Requirement: Codex Liveness Diagnostics MUST Preserve Settlement Source Without Changing Suspicion Semantics
Codex foreground liveness diagnostics MUST record why a turn did or did not settle while preserving the existing separation between frontend suspicion and authoritative terminal settlement.

#### Scenario: progress evidence records latest source
- **WHEN** a Codex foreground turn receives stream delta, heartbeat, status-active event, item update, tool update, file-change update, approval update, user-input request, or equivalent progress evidence
- **THEN** diagnostics MUST record the latest progress evidence source and timestamp for the active turn
- **AND** this record MUST NOT itself mark the turn terminal or clear active-turn state

#### Scenario: suspected silent remains non-terminal in diagnostics
- **WHEN** a Codex foreground turn enters suspected-silent because frontend no-progress observation expires
- **THEN** diagnostics MUST identify the source as frontend no-progress suspicion
- **AND** diagnostics MUST NOT report this as completed, stalled, runtime-ended, or otherwise authoritative terminal settlement

#### Scenario: authoritative settlement includes previous suspicion and progress evidence
- **WHEN** a Codex foreground turn later receives `turn/completed`, `turn/error`, `turn/stalled`, `runtime/ended`, user stop, or equivalent authoritative terminal evidence
- **THEN** diagnostics MUST include the authoritative settlement source
- **AND** diagnostics MUST preserve whether the same turn was previously suspected-silent and the latest known progress evidence source when available
