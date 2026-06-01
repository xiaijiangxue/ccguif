## ADDED Requirements

### Requirement: Interactive Project Map node positioning

The Project Knowledge Map SHALL allow users to reposition graph nodes directly while keeping semantic project-map data separate from visual layout state.

#### Scenario: User drags a single node
- **WHEN** the user drags a Project Map node to a new canvas position
- **THEN** the node SHALL move to the dropped position
- **AND** the node layout SHALL be marked pinned
- **AND** the persisted Project Map view-state SHALL store the node position by node id

#### Scenario: Old snapshots have no view-state
- **WHEN** a Project Map snapshot does not contain `viewState`
- **THEN** the graph SHALL render using generated deterministic positions
- **AND** the app SHALL NOT crash or require a migration step

#### Scenario: Deleted nodes remove stale layout entries
- **WHEN** a Project Map node is physically deleted
- **THEN** persisted view-state SHALL remove layout entries for that node and its descendants

### Requirement: Bounded automatic graph layout

The Project Knowledge Map SHALL provide an automatic layout action that moves unpinned nodes into a non-overlapping arrangement while respecting pinned user positions.

#### Scenario: User runs auto layout
- **WHEN** the user activates Auto layout
- **THEN** unpinned visible nodes SHALL settle into a non-overlapping layout
- **AND** pinned nodes SHALL keep their stored positions
- **AND** final positions SHALL be persisted as view-state

#### Scenario: User resets manual layout
- **WHEN** the user activates Reset layout
- **THEN** all manual node layout entries for the current Project Map SHALL be removed
- **AND** the graph SHALL return to deterministic generated layout

### Requirement: Layout presets

The Project Knowledge Map SHALL provide layout presets so the user can switch between radial, tree, and compact force arrangements.

#### Scenario: User switches layout preset
- **WHEN** the user selects a different layout preset
- **THEN** the graph SHALL recompute unpinned node positions using that preset
- **AND** pinned node positions SHALL remain fixed
- **AND** the selected preset SHALL be persisted in Project Map view-state

### Requirement: Multi-select graph movement

The Project Knowledge Map SHALL support lightweight multi-select movement for graph cleanup.

#### Scenario: User toggles multi-select
- **WHEN** the user Shift-clicks or Meta-clicks graph nodes
- **THEN** those nodes SHALL be toggled in the selected group
- **AND** the inspector SHALL continue to show the primary selected node

#### Scenario: User drags a selected group
- **WHEN** multiple nodes are selected
- **AND** the user drags one selected node
- **THEN** all selected nodes SHALL move by the same delta
- **AND** all moved nodes SHALL be pinned in persisted view-state

### Requirement: Project Map mini map

The Project Knowledge Map SHALL provide a compact mini map that shows graph distribution and controls viewport recentering.

#### Scenario: User clicks the mini map
- **WHEN** the user clicks a point in the Project Map mini map
- **THEN** the main graph viewport SHALL recenter around the corresponding graph coordinate
- **AND** the graph selection and inspector state SHALL remain unchanged

#### Scenario: Mini map stays display-only for nodes
- **WHEN** the mini map renders graph dots and viewport bounds
- **THEN** it SHALL NOT expose duplicate node buttons or duplicate inspector controls

### Requirement: Project Map viewport stability

The Project Knowledge Map SHALL preserve the current graph viewport during ordinary node selection and SHALL only auto-fit the viewport for structural graph framing changes.

#### Scenario: User selects another node while details are open
- **WHEN** the detail panel is open
- **AND** the graph has an existing viewport pan and zoom
- **AND** the user selects another visible graph node
- **THEN** the selected node and inspector SHALL update
- **AND** the graph viewport pan and zoom SHALL remain unchanged

### Requirement: Project Map collapsible chrome

The Project Knowledge Map SHALL allow users to collapse the header chrome into a compact toolbar while preserving access to map content and core context.

#### Scenario: User collapses the header chrome
- **WHEN** the user activates the header collapse control
- **THEN** the project map header SHALL render as a compact single-row toolbar
- **AND** the lens summary chrome SHALL be hidden
- **AND** the compact toolbar SHALL keep project identity and map summary visible
- **AND** the graph canvas SHALL move up to use the reclaimed vertical space

#### Scenario: Header action controls share a toolbar height
- **WHEN** the expanded header renders storage, task, profile, candidate, and chrome controls
- **THEN** those controls SHALL use a consistent toolbar height
- **AND** concise i18n labels SHALL be used for visible button text

#### Scenario: Header actions render as toolbar items
- **WHEN** the expanded or collapsed header renders primary chrome actions
- **THEN** those actions SHALL use icon-and-text presentation
- **AND** they SHALL avoid button-shaped borders and heavy filled backgrounds
- **AND** they SHALL preserve semantic button behavior for interactive controls
