## MODIFIED Requirements

### Requirement: Project profile and dynamic knowledge lenses

The system SHALL derive a Project Profile for the active workspace and organize project knowledge through dynamic lenses instead of a fixed framework-specific layer enum.

#### Scenario: AI organizer proposes parent moves for unassigned discoveries

- **WHEN** the Project Map contains direct children under the generic unassigned discoveries node
- **THEN** the Project Map UI SHALL provide an AI organize action
- **AND** the action SHALL ask AI for parent-move suggestions using project-generic node summaries, source paths, and structural parent candidates
- **AND** the action SHALL create review candidates instead of directly changing Project Map topology

#### Scenario: Organizer candidate review is explicit

- **WHEN** AI organizer suggestions are available
- **THEN** each suggestion SHALL be reviewable as a pending candidate
- **AND** the review SHALL show the target node, suggested parent, confidence, and reason
- **AND** confirming the candidate SHALL apply only the parent move
- **AND** rejecting the candidate SHALL leave Project Map topology unchanged

#### Scenario: Organizer remains project-agnostic

- **WHEN** the organizer builds prompts or validates suggestions
- **THEN** it SHALL NOT require repository-specific workflow directories, user-local paths, OpenSpec, Trellis, Codex, Claude, or other personal workspace conventions
- **AND** source paths MAY be used only as generic evidence for parent matching
