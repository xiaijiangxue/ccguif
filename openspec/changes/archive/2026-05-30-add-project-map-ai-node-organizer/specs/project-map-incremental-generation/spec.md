## MODIFIED Requirements

### Requirement: Evidence-aware merge semantics

The system SHALL merge generated content with existing content using deterministic evidence-aware rules instead of blind replacement.

#### Scenario: Parent-move candidate confirmation is topology-safe

- **WHEN** a pending Project Map candidate represents a parent move
- **THEN** confirmation SHALL verify that the target node exists, the suggested parent exists, the source parent still matches, and the move does not create a cycle
- **AND** confirmation SHALL reject moves that set the project root or the node itself as parent
- **AND** confirmation SHALL update the old parent `children`, new parent `children`, target `parentId`, manifest update time, and lens stats atomically
- **AND** confirmation SHALL NOT modify node title, summary, detail, sources, confidence, stale, or candidate flags

#### Scenario: Unsafe organizer suggestions fail closed

- **WHEN** AI organizer output proposes a missing parent, root parent, self parent, cycle, stale source parent, or malformed move
- **THEN** the system SHALL ignore or reject that suggestion
- **AND** the Project Map topology SHALL remain unchanged
