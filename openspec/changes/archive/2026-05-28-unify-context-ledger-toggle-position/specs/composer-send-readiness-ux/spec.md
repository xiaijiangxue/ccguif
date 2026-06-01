## ADDED Requirements

### Requirement: Readiness Context Summary SHALL Own The Top-Right Context Ledger Toggle

Composer readiness UI MUST render the single top-right Context Ledger disclosure toggle when Context Ledger projection is visible. The toggle MUST switch between expand and collapse in the same position.

#### Scenario: readiness summary shows expand in collapsed state

- **WHEN** Context Ledger projection is visible
- **AND** Context Ledger detail is collapsed
- **THEN** the readiness bar top-right context area SHALL render an expand action
- **AND** activating it SHALL expand Context Ledger detail

#### Scenario: readiness summary shows collapse in expanded state

- **WHEN** Context Ledger detail is expanded
- **THEN** the same readiness bar top-right context area SHALL render a collapse action
- **AND** activating it SHALL collapse Context Ledger detail

#### Scenario: toggle does not duplicate management controls

- **WHEN** Context Ledger detail is expanded
- **THEN** readiness UI SHALL only toggle detail visibility
- **AND** source management actions such as keep, exclude, clear, and source detail SHALL remain inside Context Ledger detail
