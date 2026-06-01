# Project X-Ray Panel Delta

## MODIFIED Requirements

### Requirement: Project profile and dynamic knowledge lenses

The system SHALL derive a Project Profile for the active workspace and organize project knowledge through dynamic lenses instead of a fixed framework-specific layer enum.

#### Scenario: AI organizer proposes parent moves for unassigned discoveries

- **WHEN** the Project Map contains direct children under the generic unassigned discoveries node
- **THEN** the Project Map UI SHALL provide an AI organize action from the toolbar and the Unassigned Discoveries detail panel
- **AND** the action SHALL ask AI for parent-move suggestions using project-generic node summaries, source paths, child counts, and candidate parents from the existing graph
- **AND** the action SHALL create review candidates instead of directly changing Project Map topology

#### Scenario: Organizer candidate review is explicit

- **WHEN** AI organizer suggestions are available
- **THEN** each suggestion SHALL be reviewable as a pending candidate
- **AND** the review SHALL show the target node, suggested parent, confidence, and reason
- **AND** the top-bar candidate badge SHALL navigate to a pending review candidate even when the target node is not marked as a standalone node candidate
- **AND** confirming the candidate SHALL apply only the parent move
- **AND** rejecting the candidate SHALL leave Project Map topology unchanged

#### Scenario: Organizer remains project-agnostic

- **WHEN** the organizer builds prompts or validates suggestions
- **THEN** it SHALL NOT require repository-specific workflow directories, user-local paths, OpenSpec, Trellis, Codex, Claude, technology names, controller names, or other personal workspace conventions
- **AND** source paths MAY be used only as generic evidence for parent matching
- **AND** validation SHALL rely on graph safety and hierarchy fit rather than project-specific allowlists

#### Scenario: Organizer explains skipped and unsafe suggestions

- **WHEN** an organizer run completes with zero or partial candidates
- **THEN** the task drawer SHALL show candidate, skipped, and unsafe suggestion counts
- **AND** it SHALL list representative skipped and unsafe reasons so the user can understand why nodes were not organized
- **AND** the Unassigned Discoveries detail panel SHALL explain that AI organize creates review candidates and does not directly mutate the map

### Requirement: Conversation knowledge capture

The system SHALL support adding verifiable project knowledge from project Q&A into the map through AI-generated candidates.

#### Scenario: Candidate review surfaces

- **WHEN** candidates exist
- **THEN** the top bar SHALL show a candidate count badge
- **AND** the selected node inspector SHALL show candidates related to that node
- **AND** the top bar SHALL provide an Accept all action that attempts to accept every current candidate that passes validation
- **AND** after batch confirmation the UI SHALL show how many candidates were accepted and how many were skipped

