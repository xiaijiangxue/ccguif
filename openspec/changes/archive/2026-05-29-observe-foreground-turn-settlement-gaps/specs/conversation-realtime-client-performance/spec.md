## ADDED Requirements

### Requirement: Foreground Terminal Settlement Diagnostics MUST Identify The Failure Class
Realtime client diagnostics MUST emit enough structured evidence to classify foreground turns that render final output but remain in processing state.

#### Scenario: terminal event reaches frontend
- **WHEN** the app-server bridge receives `turn/completed`, `turn/error`, `turn/stalled`, or `runtime/ended` for a foreground conversation turn
- **THEN** diagnostics MUST record that the terminal event reached the frontend bridge
- **AND** the record MUST include workspace id, thread id, turn id when available, event type, and whether final content was present when known

#### Scenario: terminal event is rejected by settlement guard
- **WHEN** a terminal event reaches frontend turn settlement
- **AND** active turn identity or alias guards prevent clearing processing state
- **THEN** diagnostics MUST classify the result as rejected terminal settlement
- **AND** the record MUST include incoming turn id, current active turn id, target thread id, resolved alias when available, and processing state

#### Scenario: terminal event is deferred by lifecycle blockers
- **WHEN** a terminal completion event is intentionally deferred because lifecycle blockers still exist
- **THEN** diagnostics MUST classify the result as deferred terminal settlement
- **AND** the record MUST include blocker names or counts, assistant ingress evidence, and current active turn id

#### Scenario: terminal handling leaves busy residue
- **WHEN** terminal event handling finishes for a foreground turn
- **AND** the thread remains in processing mode or keeps the same active turn id
- **THEN** diagnostics MUST classify the result as terminal settlement busy residue
- **AND** the record MUST distinguish this case from missing terminal event and provider streaming delay

### Requirement: Foreground Settlement Diagnostics MUST Stay Bounded And Content-Safe
Settlement diagnostics MUST be safe to collect during long conversations without storing prompt or assistant body text.

#### Scenario: diagnostic payload excludes conversation content
- **WHEN** frontend emits foreground settlement diagnostics
- **THEN** the payload MUST NOT include full user prompt, assistant response, tool output, command output, or file diff content
- **AND** it MAY include ids, event labels, counts, status strings, timestamps, booleans, and bounded reason strings

#### Scenario: repeated progress evidence remains bounded
- **WHEN** a long-running foreground turn receives many progress events before terminal settlement
- **THEN** diagnostics MUST retain the latest progress evidence source and timestamp rather than appending unbounded per-event content
- **AND** terminal settlement diagnostics MUST be able to reference that latest progress evidence
