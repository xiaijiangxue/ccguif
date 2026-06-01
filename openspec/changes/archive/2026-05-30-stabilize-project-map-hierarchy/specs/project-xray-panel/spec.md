## MODIFIED Requirements

### Requirement: Project profile and dynamic knowledge lenses

The system SHALL derive a Project Profile for the active workspace and organize project knowledge through dynamic lenses instead of a fixed framework-specific layer enum.

#### Scenario: Overview preserves structural hierarchy

- **WHEN** the Project Knowledge Map overview graph is rendered without a focused node
- **THEN** root-level visible children SHALL primarily represent structural project domains, modules, subsystems, or durable capabilities
- **AND** task, bugfix, risk, workflow, test, artifact, and evidence discoveries SHALL NOT be presented as ordinary root-level structural hubs
- **AND** those non-structural discoveries SHALL remain reachable by drilling into their parent structural node or the generic unassigned discoveries container

#### Scenario: Root node is not used as a task bucket

- **WHEN** persisted or generated Project Map data contains non-structural nodes with missing, invalid, or root parent relationships
- **THEN** the Project Map projection SHALL avoid treating those nodes as direct project root children
- **AND** the projection SHALL preserve the nodes for review instead of deleting them
- **AND** the fallback grouping SHALL use a generic project-agnostic triage concept rather than repository-specific workflow names
