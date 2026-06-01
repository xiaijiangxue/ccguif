## MODIFIED Requirements

### Requirement: Lightweight in-house graph rendering

The system SHALL render the Project Knowledge Map graph using a lightweight in-house SVG/HTML renderer for the initial release.

#### Scenario: Node body drag works independent of visible edges

- **WHEN** a visible Project Map graph node receives pointer capture from a drag that starts on the node body
- **THEN** pointer move and pointer end events delivered to the node body SHALL update the drag preview and persist the pinned node position
- **AND** this SHALL work regardless of whether the node has a visible SVG edge line in the current graph view
- **AND** nested node action buttons SHALL NOT start node drag

#### Scenario: Root node is visually distinguished

- **WHEN** the Project Map overview graph is rendered
- **THEN** the root node SHALL use a visual treatment that is stronger than ordinary and hub nodes
- **AND** the treatment SHALL include a larger footprint, stronger border/halo, and primary-color anchor styling
- **AND** existing selection, confidence, stale, candidate, and pinned indicators SHALL remain readable

#### Scenario: Duplicate persisted node identity renders once

- **WHEN** Project Map data is loaded or merged and the same `ProjectMapNode.id` appears in multiple lens node payloads
- **THEN** the system SHALL normalize the dataset to a single graph node for that id before layout and render
- **AND** the canonical node SHALL preserve valid parent/child topology
- **AND** duplicate sources, detail arrays, related artifacts, and diagram artifacts SHALL be merged with de-duplication
- **AND** React graph keys, layout positions, minimap dots, selection, and drag state SHALL consume the deduplicated node set
