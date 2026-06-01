## ADDED Requirements

### Requirement: Node diagram artifact links
The Project Knowledge Map SHALL support evidence-backed Mermaid diagram artifacts for nodes whose relationships or execution order are clearer as a diagram than as text.

#### Scenario: Prompt may request diagram artifacts
- **WHEN** Project Map AI generation asks for node detail content
- **THEN** the prompt SHALL require the model to internally choose between text detail and diagram artifact representation
- **AND** the prompt SHALL allow Mermaid diagram output only when it clarifies flow, state, dependency, layering, sequence, or data movement
- **AND** the prompt SHALL allow no diagram when text is clearer or evidence is weak

#### Scenario: Diagram artifact is stored outside node body
- **WHEN** AI generation returns a Mermaid diagram for a Project Map node
- **THEN** the system SHALL write the Mermaid source into a Markdown file under the Project Map `diagrams/` storage directory
- **AND** the node detail SHALL store only diagram artifact metadata and a link path
- **AND** the Mermaid source SHALL NOT be embedded into `coreDescription`, `keyFacts`, `keyLogic`, or `riskSignals`

#### Scenario: Diagram link opens existing file preview
- **WHEN** a node has diagram artifacts
- **THEN** the node inspector SHALL render a diagram link section
- **AND** activating a diagram link SHALL open the Markdown artifact through the existing workspace file opening path
- **AND** the Markdown preview SHALL remain responsible for Mermaid source/render behavior
- **AND** Project Map storage-root absolute paths SHALL be accepted by the existing external file preview without hard-coded user-specific paths

#### Scenario: Old snapshots remain compatible
- **WHEN** a persisted Project Map snapshot has no diagram artifact fields
- **THEN** the Project Knowledge Map SHALL read and render the snapshot without migration failure
- **AND** the node inspector SHALL omit the diagram section for nodes without diagram artifacts

### Requirement: Diagram storage allowlist
The Project Knowledge Map SHALL constrain diagram artifact writes to safe Project Map storage paths.

#### Scenario: Diagram markdown write is allowed
- **WHEN** Project Map persistence writes `diagrams/<diagram-id>.md`
- **THEN** the Tauri project-map write boundary SHALL allow the write only if `<diagram-id>` is a safe single path segment
- **AND** nested diagram directories, parent traversal, absolute paths, and non-Markdown diagram files SHALL be rejected

#### Scenario: Diagram manifest write is allowed
- **WHEN** Project Map persistence writes `diagrams/manifest.json`
- **THEN** the Tauri project-map write boundary SHALL allow the manifest write
- **AND** other arbitrary files under `diagrams/` SHALL be rejected

#### Scenario: Concurrent diagram writes do not collide
- **WHEN** multiple Project Map completion tasks commit files in the same process
- **THEN** atomic temporary file names SHALL be unique per write attempt
- **AND** concurrent writes to the same diagram or manifest path SHALL NOT fail because another write already moved the temp file
