# Project Map Incremental Generation Delta

## MODIFIED Requirements

### Requirement: Evidence-aware merge semantics

The system SHALL merge generated content with existing content using deterministic evidence-aware rules instead of blind replacement.

#### Scenario: Parent-move candidate confirmation is topology-safe

- **WHEN** a pending Project Map candidate represents a parent move
- **THEN** confirmation SHALL verify that the target node exists, the suggested parent exists, the source parent still matches, and the move does not create a cycle
- **AND** confirmation SHALL reject moves that assign the node as its own parent or assign it below its own descendant
- **AND** confirmation SHALL reject stale moves whose source parent no longer matches the current dataset
- **AND** confirmation SHALL update the old parent `children`, new parent `children`, target `parentId`, manifest update time, and lens stats atomically
- **AND** confirmation SHALL NOT modify node title, summary, detail, sources, confidence, stale, or candidate flags

#### Scenario: Parent-move candidate confirmation preserves hierarchy fit

- **WHEN** a pending Project Map candidate represents an organizer parent move
- **THEN** confirmation SHALL reject detail or evidence nodes that would be flattened directly under the project root
- **AND** confirmation SHALL allow broad overview or category nodes to be restored near the project root
- **AND** confirmation SHALL reject broad overview or category nodes that would be placed below a narrower cross-lens parent
- **AND** the validation SHALL use generic Project Map node shape such as children, node kind, lens id, and graph depth rather than repository-specific names or technologies

#### Scenario: Unsafe organizer suggestions fail closed

- **WHEN** AI organizer output proposes a missing parent, invalid parent, root-level detail flattening, self parent, cycle, stale source parent, hierarchy mismatch, or malformed move
- **THEN** the system SHALL ignore or reject that suggestion
- **AND** the Project Map topology SHALL remain unchanged
- **AND** the run metadata SHALL preserve enough skip or unsafe-suggestion reason text for the task history to explain why no candidate was created

#### Scenario: Batch candidate confirmation uses existing gates

- **WHEN** the user chooses to accept all current Project Map candidates
- **THEN** the system SHALL confirm pending review candidates through the same candidate confirmation rules used by single-candidate confirmation
- **AND** standalone node candidates SHALL be confirmed through the same standalone node-candidate rules used by single-node confirmation
- **AND** candidates that fail validation SHALL be skipped rather than forced through
- **AND** the accepted changes SHALL be persisted as one dataset update after the batch is evaluated

