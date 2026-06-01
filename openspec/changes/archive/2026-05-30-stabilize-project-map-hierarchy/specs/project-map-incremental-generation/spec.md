## MODIFIED Requirements

### Requirement: Incremental global Project Map generation

The system SHALL merge global Project Map generation output into the existing dataset and SHALL NOT delete existing nodes, lenses, sources, or relationships merely because they are absent from the latest AI output.

#### Scenario: Auto merge keeps root children structural

- **WHEN** automatic Project Map ingestion merges generated nodes into an existing map
- **AND** generated nodes are missing valid parents
- **THEN** durable structural or capability nodes MAY be attached under the project root
- **AND** task, bugfix, risk, workflow, test, artifact, and evidence discoveries SHALL NOT be blindly attached under the project root
- **AND** those non-structural orphan discoveries SHALL be grouped under a stable generic unassigned discoveries node when no better parent is available

#### Scenario: Model prompt avoids root-level task flattening

- **WHEN** the worker builds an automatic ingestion prompt
- **THEN** the prompt SHALL instruct the model to attach task, risk, test, artifact, and workflow discoveries to the nearest existing structural parent
- **AND** the prompt SHALL allow a generic unassigned discoveries fallback when no reliable parent exists
- **AND** the prompt SHALL NOT instruct every new top-level concept to use the root node id
