# Project X-Ray Panel Specification

## Purpose

Project X-Ray / Project Knowledge Map provides a visual, evidence-backed project knowledge surface for navigating generated project-map nodes, inspecting node details, running AI-backed map generation, reviewing candidates, and adjusting graph view state without mutating semantic project-map data.
## Requirements
### Requirement: Project Knowledge Map tab entry

The system SHALL display a Project Knowledge Map entry in the right panel toolbar using a globe-style icon.

#### Scenario: Globe icon is visible
- **WHEN** a workspace is active and the right panel toolbar is visible
- **THEN** the toolbar SHALL include a Project Knowledge Map tab
- **AND** the tab SHALL use a globe-style lucide icon
- **AND** the tooltip SHALL support Chinese and English locales

#### Scenario: Opening the map
- **WHEN** the user clicks the Project Knowledge Map tab
- **THEN** the system SHALL switch the center area to the Project Knowledge Map panel
- **AND** other center content layers SHALL become inactive through the existing mutual-exclusion mechanism

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

### Requirement: Read-only knowledge map panel

The system SHALL render a read-only Project Knowledge Map panel in the center area.

#### Scenario: Mock dataset is not the runtime fact source
- **WHEN** the Project Knowledge Map opens for a real workspace
- **THEN** the panel SHALL read from the workspace project-map persistence directory
- **AND** the panel SHALL show an empty state when no persisted map exists
- **AND** mock `ProjectMapDataset` values MAY only be used as test fixtures or controlled demo input
- **AND** mock data SHALL NOT be displayed as current project fact by default

#### Scenario: Empty map state
- **WHEN** no persisted project map exists for the active workspace
- **THEN** the panel SHALL show an empty state with a global collection action
- **AND** the panel SHALL NOT display inferred placeholder knowledge as fact

#### Scenario: Existing map restore
- **WHEN** persisted map data exists under `.ccgui/project-map/<project-name>-<short-hash>/`
- **THEN** the panel SHALL load the persisted manifest, profile, lenses, and lens nodes
- **AND** the graph SHALL render the available nodes without requiring regeneration

#### Scenario: Manual text editing is unavailable
- **WHEN** the user opens any node detail
- **THEN** the UI SHALL NOT provide manual text editing controls for generated content
- **AND** available actions SHALL be limited to view, generate, calibrate, refresh, and inspect evidence

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

### Requirement: Structured node detail

The system SHALL provide concise structured details for each selected map node.

#### Scenario: Node detail is shown
- **WHEN** the user selects a map node
- **THEN** the inspector SHALL show a core description, key facts, key logic, risk signals, related artifacts, confidence, stale state, and generation metadata
- **AND** the detail SHALL remain read-only

#### Scenario: Node detail stays concise
- **WHEN** generated detail content is rendered
- **THEN** the core description SHALL be concise
- **AND** each key fact or key logic item SHALL describe one verifiable point
- **AND** long-form narrative SHALL NOT be rendered inside the graph node itself

#### Scenario: Detail facts require evidence
- **WHEN** the node detail includes key facts
- **THEN** each deterministic key fact SHALL be traceable to at least one source
- **AND** unsupported facts SHALL be rejected or marked unknown

#### Scenario: Risk signals require evidence
- **WHEN** the node detail includes risk signals
- **THEN** each risk signal SHALL be traceable to actual project evidence
- **AND** unsupported risk claims SHALL be rejected or marked unknown

### Requirement: Global AI collection

The system SHALL provide a global collection action that generates the project map framework using AI.

#### Scenario: Global collection uses concise framework prompt

- **WHEN** the user confirms a global Project Map collection request
- **THEN** the worker SHALL build a concise prompt for framework-level map generation
- **AND** the prompt SHALL avoid dumping the full existing profile JSON or every existing node id when a compact summary is enough
- **AND** the prompt SHALL still require strict pure JSON output, double-quoted property names, source-backed facts, and low/unknown confidence when evidence is insufficient

#### Scenario: AI output uses object literal syntax

- **WHEN** the AI returns a JSON-shaped object with unquoted property names, bare string values, or trailing commas
- **THEN** the worker SHALL attempt a bounded repair before failing the run
- **AND** the repair SHALL NOT execute arbitrary JavaScript
- **AND** the repaired payload SHALL still flow through the existing profile/node normalization path

#### Scenario: Chinese client locale generates Chinese-first map copy

- **WHEN** the client locale is Chinese and the user confirms a Project Map AI generation request
- **THEN** the generation request SHALL carry a preferred language for Chinese output
- **AND** the worker prompt SHALL require user-visible map copy to use Chinese as the primary language
- **AND** English technical terms, source paths, symbols, API names, commands, package names, and framework names SHALL remain untranslated
- **AND** this language contract SHALL apply to node titles, summaries, core descriptions, key facts, key logic, risk signals, and diagram title/summary fields

### Requirement: Node-level completion and calibration

The system SHALL allow AI generation from any map node to complete, correct, or calibrate that node and its subtree.

#### Scenario: Node-level generation scope
- **WHEN** the user triggers generation from a selected node
- **THEN** the system SHALL scope the run to that node, adjacent nodes, existing sources, and necessary project facts
- **AND** the generated patch SHALL update only that node and its descendants unless the user confirms a wider scope

#### Scenario: Calibration preserves evidence
- **WHEN** calibration changes a node summary or confidence
- **THEN** the system SHALL preserve or update the node's source list
- **AND** the system SHALL record the generation run that caused the change

### Requirement: Local persistence contract

The system SHALL persist project map data under `.ccgui/project-map/<project-name>-<short-hash>/` for the active workspace.

#### Scenario: Lens storage layout
- **WHEN** map data is written
- **THEN** the system SHALL store profile data and lens node data under corresponding profile / lens folders
- **AND** run metadata SHALL be stored under `runs/`
- **AND** evidence metadata SHALL be stored under `evidence/`
- **AND** candidate metadata SHALL be stored under `candidates/`
- **AND** backups SHALL be stored under `backups/`

#### Scenario: Same-name projects are isolated
- **WHEN** a project map storage directory is created
- **THEN** the directory name SHALL include the project name and a short hash derived from the workspace identity
- **AND** two projects with the same display name SHALL NOT share the same active map directory

#### Scenario: Writes are constrained
- **WHEN** the project map persistence layer writes files
- **THEN** writes SHALL be constrained to `.ccgui/project-map/<project-name>-<short-hash>/**`
- **AND** writes SHALL use an atomic write strategy
- **AND** failures SHALL leave the previous valid map readable

#### Scenario: Platform-safe path handling
- **WHEN** the persistence layer builds project-map paths
- **THEN** the system SHALL use platform-safe path join and normalization
- **AND** the implementation SHALL NOT hard-code Windows or POSIX path separators

#### Scenario: Rebuild creates backup
- **WHEN** the user triggers one-click map rebuild
- **THEN** the system SHALL create a backup of the current active map before replacing generated profile or lens data
- **AND** rebuild SHALL require user confirmation before starting

### Requirement: Grounded minimal generation

The system SHALL enforce concise, evidence-backed AI output for all generated map content.

#### Scenario: Deterministic claim requires source
- **WHEN** a node presents a claim as project fact
- **THEN** the node SHALL include at least one source
- **AND** the source SHALL identify a file, symbol, spec, commit, test, or conversation reference

#### Scenario: Evidence priority is enforced
- **WHEN** multiple source types support or conflict on a generated claim
- **THEN** the system SHALL prefer evidence in this order: code, spec, tests, commit, memory
- **AND** memory alone SHALL NOT produce high-confidence code-fact claims

#### Scenario: Unsupported claim is not promoted
- **WHEN** AI output contains a claim without evidence
- **THEN** the system SHALL either reject that claim or mark the node confidence as `unknown`
- **AND** the UI SHALL NOT present the unsupported claim as confirmed fact

#### Scenario: Concise node content
- **WHEN** generated content is rendered as a graph node
- **THEN** the visible summary SHALL be concise
- **AND** extended details SHALL appear only in the node inspector

### Requirement: Conversation knowledge capture

The system SHALL support adding verifiable project knowledge from project Q&A into the map through AI-generated candidates.

#### Scenario: Candidate review surfaces

- **WHEN** candidates exist
- **THEN** the top bar SHALL show a candidate count badge
- **AND** the selected node inspector SHALL show candidates related to that node
- **AND** the top bar SHALL provide an Accept all action that attempts to accept every current candidate that passes validation
- **AND** after batch confirmation the UI SHALL show how many candidates were accepted and how many were skipped

### Requirement: Project memory auto ingestion settings

The system SHALL provide settings for automatic project-memory ingestion into the Project Knowledge Map.

#### Scenario: Auto ingestion is opt-in
- **WHEN** the user has not enabled automatic ingestion
- **THEN** the system SHALL NOT automatically analyze project memory sessions for map updates

#### Scenario: Auto ingestion configuration
- **WHEN** the user enables automatic ingestion
- **THEN** the system SHALL require engine, model, threshold, interval, and apply mode settings
- **AND** the default new-session threshold SHALL be 5
- **AND** the default apply mode SHALL be `createCandidate`
- **AND** `autoApplyEvidenceBacked` SHALL be treated as an advanced opt-in mode

#### Scenario: Threshold triggers ingestion
- **WHEN** automatic ingestion is enabled
- **AND** the count of unprocessed project memory sessions reaches the configured threshold
- **THEN** the system SHALL create an AI analysis run scoped to those unprocessed sessions and relevant existing map nodes

#### Scenario: Default candidate mode requires confirmation
- **WHEN** an automatic ingestion run completes in `createCandidate` mode
- **THEN** accepted updates SHALL be recorded as candidates
- **AND** the candidates SHALL require user confirmation before being written into active map lenses

#### Scenario: Candidate review surfaces
- **WHEN** candidates exist
- **THEN** the top bar SHALL show a candidate count badge
- **AND** the selected node inspector SHALL show candidates related to that node
- **AND** the top bar SHALL provide an Accept all action that attempts to accept every current candidate that passes validation
- **AND** after batch confirmation the UI SHALL show how many candidates were accepted and how many were skipped

#### Scenario: Auto ingestion is non-blocking
- **WHEN** automatic ingestion creates candidates
- **THEN** the system SHALL update candidate indicators without showing a blocking confirmation dialog

#### Scenario: Auto ingestion writes through evidence gate
- **WHEN** an automatic ingestion run produces map updates
- **THEN** the updates SHALL pass the same evidence gate as manual global or node-level generation
- **AND** accepted updates SHALL be persisted under `.ccgui/project-map/<project-name>-<short-hash>/`

#### Scenario: Auto ingestion update scope
- **WHEN** automatic ingestion generates accepted candidate updates
- **THEN** the update MAY create new nodes
- **AND** the update MAY modify matching nodes
- **AND** the update SHALL NOT modify unrelated nodes

### Requirement: Processed project memory marker

The system SHALL mark project memory sessions that have already been used for map supplementation.

#### Scenario: Successful run marks processed sessions
- **WHEN** an automatic ingestion run successfully applies or records accepted candidate updates
- **THEN** the consumed project memory session id and message hash pairs SHALL be recorded as processed

#### Scenario: Processed messages are not reused
- **WHEN** future automatic ingestion scans project memory
- **THEN** messages already recorded as processed SHALL NOT be used again as new input
- **AND** new messages appended to a previously processed session MAY be processed if their message hashes are new

#### Scenario: Failed run does not mark sessions
- **WHEN** an automatic ingestion run fails before accepted updates are persisted or recorded
- **THEN** the involved project memory messages SHALL remain unprocessed

### Requirement: Staleness awareness

The system SHALL mark map nodes stale when their recorded sources no longer match current project facts.

#### Scenario: Source hash mismatch
- **WHEN** a node source hash differs from the current source hash
- **THEN** the node SHALL be marked stale
- **AND** the inspector SHALL offer node calibration

#### Scenario: Stale node visual treatment
- **WHEN** a node is stale
- **THEN** the graph SHALL visually de-emphasize the node
- **AND** the node confidence SHALL be downgraded or marked stale in the inspector

### Requirement: Internationalization

All user-facing Project Knowledge Map labels SHALL support Chinese and English locales.

#### Scenario: Chinese locale
- **WHEN** the application locale is Chinese
- **THEN** panel labels, tooltips, empty states, actions, confirmation dialogs, and confidence states SHALL display Chinese text

#### Scenario: English locale
- **WHEN** the application locale is English
- **THEN** panel labels, tooltips, empty states, actions, confirmation dialogs, and confidence states SHALL display English text

#### Scenario: AI-generated dynamic labels remain readable
- **WHEN** AI-generated map data contains supported extended node kinds such as `record`, `interface`, `runtime`, `tech-stack`, or `cross-cutting`
- **THEN** the UI SHALL render localized human-readable labels instead of raw `projectMap.nodeKind.*` keys
- **AND** source type badges SHALL render localized labels for supported types
- **AND** unsupported dynamic labels SHALL fall back to readable title-case text rather than raw i18n key paths

### Requirement: Cross-platform compatibility

The Project Knowledge Map SHALL work on Windows, macOS, and Linux.

#### Scenario: Supported desktop platforms
- **WHEN** the app runs on Windows, macOS, or Linux
- **THEN** the Project Knowledge Map panel SHALL open and render the graph
- **AND** persisted map data SHALL be readable and writable under the configured `.ccgui/project-map/<project-name>-<short-hash>/` directory

#### Scenario: Platform-specific manual evidence
- **WHEN** implementation is verified for release
- **THEN** verification notes SHALL record the tested platform coverage for graph rendering and persistence

### Requirement: Node-level AI generation

The system SHALL allow AI generation from any map node to complete, correct, or calibrate that node and its subtree.

#### Scenario: Node completion is scoped to the selected node

- **WHEN** the user starts a Complete Node action from a selected Project Map node
- **THEN** the generation request SHALL carry a `completeNode` intent
- **AND** the worker prompt SHALL include the selected node id, title, lens, current summary, confidence, sources, and child summary
- **AND** the prompt SHALL instruct the model to fill missing facts only for the selected node and allowed subtree
- **AND** the prompt SHALL NOT ask the model to rebuild unrelated global or sibling nodes

#### Scenario: Node calibration is scoped to verification

- **WHEN** the user starts a Calibrate Node action from a selected Project Map node
- **THEN** the generation request SHALL carry a `calibrateNode` intent
- **AND** the worker prompt SHALL instruct the model to verify, correct, lower confidence, mark stale/candidate, or improve evidence for the selected node
- **AND** the prompt SHALL treat expansion as secondary to factual correction
- **AND** the prompt SHALL NOT reuse the same task wording as Complete Node

#### Scenario: Legacy node runs remain compatible

- **WHEN** a persisted node generation run lacks an explicit generation intent
- **THEN** the worker SHALL infer a node completion intent from `requestScope.kind === "node"`
- **AND** the run SHALL continue through the existing evidence, AI dispatch, parse, normalize, and scoped merge flow

### Requirement: Conversation-derived project knowledge candidates

The system SHALL support adding verifiable project knowledge from project Q&A into the map through AI-generated candidates.

#### Scenario: Pending candidate can be confirmed from node inspector

- **WHEN** the selected Project Map node has a pending candidate record targeting that node
- **THEN** the inspector SHALL show a confirm candidate action
- **AND** activating confirm SHALL validate the candidate patch through the evidence gate before mutating the active node
- **AND** on success the candidate status SHALL become `confirmed`
- **AND** the candidate evidence SHALL be appended to project map evidence records

#### Scenario: Pending candidate can be rejected from node inspector

- **WHEN** the selected Project Map node has a pending candidate record targeting that node
- **THEN** the inspector SHALL show a reject candidate action
- **AND** activating reject SHALL mark the candidate `rejected`
- **AND** the active node SHALL remain unchanged

#### Scenario: Invalid candidate confirmation is blocked

- **WHEN** a pending candidate patch fails the evidence gate
- **THEN** the inspector confirm action SHALL NOT mutate the active node
- **AND** the UI SHALL expose a readable error message

### Requirement: Project Map inspector action hierarchy
The Project Knowledge Map inspector SHALL expose only high-value primary actions and SHALL NOT duplicate low-value refresh controls across the top bar and selected-node detail.

#### Scenario: Redundant refresh controls are removed
- **WHEN** the Project Knowledge Map panel renders with persisted or generated data
- **THEN** the top toolbar SHALL NOT show a standalone refresh-evidence button
- **AND** the selected-node inspector action row SHALL NOT show a duplicate refresh-evidence button
- **AND** the panel SHALL keep global Collect, Task queue, node Complete, and node Calibrate actions available when applicable

#### Scenario: Node evidence refresh remains reachable through calibration path
- **WHEN** a user needs fresher evidence for a selected node
- **THEN** the inspector SHALL present Calibrate as the primary node-level evidence update action
- **AND** the UI SHALL NOT force users to choose between two visually similar refresh and calibrate commands

### Requirement: Project Map candidate review affordance
The Project Knowledge Map SHALL explain candidate semantics and provide a visible path from the global candidate count to candidate nodes.

#### Scenario: Candidate badge navigates to candidate node
- **WHEN** at least one Project Map node is marked `candidate`
- **THEN** the top toolbar SHALL show an interactive candidate badge
- **AND** activating the badge SHALL select a candidate node
- **AND** the inspector SHALL be expanded for that node

#### Scenario: Candidate meaning is explained in inspector
- **WHEN** the selected node is marked `candidate`
- **THEN** the inspector SHALL show a candidate notice
- **AND** the notice SHALL explain that the node is an evidence-backed draft rather than a confirmed project fact
- **AND** the notice SHALL direct the user toward Calibrate or the future candidate confirmation workflow

#### Scenario: No candidate affordance is shown without candidates
- **WHEN** the Project Map contains zero candidate nodes
- **THEN** the top toolbar SHALL NOT show a candidate review badge
- **AND** no empty candidate review control SHALL occupy toolbar space

### Requirement: Project Map inspector readability
The expanded Project Knowledge Map inspector SHALL provide enough width for structured detail and evidence scanning.

#### Scenario: Expanded inspector is wider
- **WHEN** the Project Knowledge Map inspector is expanded on a desktop-width viewport
- **THEN** the inspector SHALL use a width approximately 1.5 times the previous narrow detail width
- **AND** core description, key facts, related artifacts, and evidence sources SHALL remain readable without excessive chip wrapping

#### Scenario: Collapsed inspector remains compact
- **WHEN** the Project Knowledge Map inspector is collapsed
- **THEN** the collapsed rail SHALL remain compact
- **AND** the expanded-width change SHALL NOT make the collapsed rail consume the graph canvas

### Requirement: Project Map drilldown navigation
The Project Knowledge Map SHALL provide a clear way to return to the previous graph view after drilling into a lower-level node.

#### Scenario: Previous view is available after drilldown
- **WHEN** a user drills into a selected node
- **THEN** the graph SHALL expose a visible Back to previous control
- **AND** the inspector SHALL expose the same previous-view action when expanded
- **AND** activating the control SHALL restore the last focus and selected node state

#### Scenario: Parent fallback is available without history
- **WHEN** the graph is in a focused lower-level view
- **AND** no previous-view history snapshot exists
- **THEN** the graph and inspector SHALL expose a visible parent-level return control
- **AND** activating the control SHALL return to the parent view or overview

#### Scenario: Overview reset clears previous-view history
- **WHEN** a user activates Back to overview
- **THEN** the graph SHALL return to the overview
- **AND** previous-view history SHALL be cleared so stale navigation does not reappear

### Requirement: Project Map compact non-overlapping layout
The Project Knowledge Map graph SHALL reduce excessive empty space between nodes while preserving non-overlap.

#### Scenario: Focused lower-level graph is compact
- **WHEN** a user drills into a node with visible neighbors
- **THEN** the focused nodes SHALL be placed closer to the selected node than the previous wide-radius layout
- **AND** graph node cards SHALL NOT overlap

#### Scenario: Crowded graph still avoids overlap
- **WHEN** overview or focused graph contains many visible nodes
- **THEN** the layout SHALL keep using collision resolution
- **AND** visible node cards SHALL remain mutually exclusive

### Requirement: Project Map grouped view controls
The Project Knowledge Map SHALL group related view-control buttons into compact horizontal button groups and SHALL avoid redundant bilingual helper text inside Chinese buttons.

#### Scenario: Canvas controls are grouped
- **WHEN** the Project Knowledge Map graph canvas renders
- **THEN** zoom out, reset view, zoom in, and available previous-view navigation SHALL render in one horizontal button group
- **AND** the previous-view control SHALL NOT wrap onto a separate row

#### Scenario: Inspector navigation controls are grouped
- **WHEN** the inspector exposes both previous-view and overview navigation
- **THEN** collapse detail, previous-view, and overview navigation SHALL render in one horizontal navigation button group
- **AND** the button labels in Chinese locale SHALL use concise Chinese action text without appended English helper words

### Requirement: Project Map evidence link UX
The Project Knowledge Map inspector SHALL render related artifacts and evidence sources as traceable link-style controls when source metadata provides a path, line, hash, or ref.

#### Scenario: File-like artifact renders as traceable control
- **WHEN** a related artifact or evidence source has type `file`, `test`, or `spec`
- **AND** it has a `path`
- **THEN** the inspector SHALL render it with link-style affordance
- **AND** the visible label SHALL include the artifact label and source type
- **AND** the control title or secondary text SHALL expose the path and line number when available

#### Scenario: Ref-like artifact renders with ref trace
- **WHEN** a related artifact or evidence source has type `symbol`, `commit`, or `conversation`
- **AND** it has a `ref`, `hash`, or `path`
- **THEN** the inspector SHALL render it with link-style affordance
- **AND** the visible or accessible text SHALL expose the trace identifier

#### Scenario: Evidence without trace remains read-only
- **WHEN** a related artifact or evidence source lacks path, ref, and hash metadata
- **THEN** the inspector SHALL render it as a read-only chip
- **AND** the UI SHALL NOT pretend the evidence is clickable

#### Scenario: Evidence excerpt is visible without overwhelming detail
- **WHEN** an evidence source includes an excerpt
- **THEN** the inspector SHALL expose a concise excerpt preview
- **AND** the preview SHALL remain visually subordinate to the source label and trace metadata

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

### Requirement: Project memory auto ingestion run lifecycle

The Project Knowledge Map SHALL wire Auto Ingestion settings into the Project Map generation queue rather than using a hidden synchronous write path, and scheduling SHALL be owned by the active workspace lifecycle rather than by the Project Knowledge Map panel mount lifecycle.

#### Scenario: Threshold creates queued auto run
- **GIVEN** Auto Ingestion is enabled
- **AND** no Project Map auto run is pending or running
- **AND** the configured interval has elapsed since `memoryCursor.lastCheckedAt`
- **WHEN** the count of unprocessed Project Memory messages reaches `newSessionThreshold`
- **THEN** the system SHALL create a queued Project Map run with `kind="auto"`
- **AND** the run SHALL use `scope.kind="auto"` and include the consumed message hashes
- **AND** the background task drawer SHALL be able to render the run using the existing run lifecycle

#### Scenario: Hidden Project Map still queues auto run
- **GIVEN** Auto Ingestion is enabled for the active workspace
- **AND** no Project Map auto run is pending or running
- **AND** the configured interval has elapsed since `memoryCursor.lastCheckedAt`
- **AND** the count of unprocessed Project Memory messages reaches `newSessionThreshold`
- **AND** the Project Knowledge Map panel is not currently rendered or mounted
- **WHEN** the workspace-level scheduler evaluates Auto Ingestion
- **THEN** the system SHALL create a queued Project Map run with `kind="auto"`
- **AND** the run SHALL use the existing Auto Ingestion request shape, consumed message hashes, and Project Memory evidence metadata
- **AND** opening the Project Knowledge Map panel later SHALL show the queued, running, completed, or failed run through the existing task drawer

#### Scenario: Interval prevents repeated scans
- **GIVEN** Auto Ingestion is enabled
- **AND** `memoryCursor.lastCheckedAt` is newer than the configured interval window
- **WHEN** Auto Ingestion evaluates scheduling
- **THEN** the system SHALL NOT scan Project Memory again
- **AND** the system SHALL NOT enqueue a duplicate auto run

#### Scenario: Existing auto run prevents duplicate queueing
- **GIVEN** an Auto Ingestion run is already pending or running
- **WHEN** Auto Ingestion evaluates scheduling
- **THEN** the system SHALL NOT enqueue another Auto Ingestion run

#### Scenario: View lifecycle does not create duplicate scheduler
- **GIVEN** the workspace-level Auto Ingestion scheduler is mounted
- **AND** the Project Knowledge Map panel is also rendered
- **WHEN** Auto Ingestion evaluates scheduling
- **THEN** the system SHALL use a single scheduling owner for the active workspace
- **AND** it SHALL NOT enqueue a duplicate auto run because both the app layer and view layer evaluated the same interval window

#### Scenario: Successful auto run marks memory processed
- **GIVEN** an Auto Ingestion run was created from unprocessed Project Memory messages
- **WHEN** the run completes successfully
- **THEN** the consumed message hashes SHALL be added to `memoryCursor.processedMessages`
- **AND** `memoryCursor.lastRunId` SHALL reference the completed auto run

#### Scenario: Failed auto run does not mark memory processed
- **GIVEN** an Auto Ingestion run was created from unprocessed Project Memory messages
- **WHEN** the run fails or is cancelled
- **THEN** the consumed message hashes SHALL NOT be added to `memoryCursor.processedMessages`
- **AND** the messages SHALL remain eligible for a later retry after the interval gate allows another scan

### Requirement: Auto Ingestion candidate safety

The Project Knowledge Map SHALL keep automatic Project Memory ingestion conservative by default while preserving the advanced evidence-backed apply mode.

#### Scenario: Default candidate mode requires review
- **GIVEN** Auto Ingestion apply mode is `createCandidate`
- **WHEN** an auto run returns generated Project Map nodes or updates
- **THEN** generated updates SHALL remain candidate review items or candidate nodes
- **AND** they SHALL require the existing manual confirm/reject flow before becoming trusted active-map facts

#### Scenario: Advanced apply mode can apply evidence-backed updates
- **GIVEN** Auto Ingestion apply mode is `autoApplyEvidenceBacked`
- **WHEN** unprocessed Project Memory reaches the threshold
- **THEN** the system SHALL still enqueue a real auto run
- **AND** updates with sufficient evidence MAY be written into active map lenses through the existing evidence gate
- **AND** weak, unsupported, or memory-only claims SHALL remain candidates rather than being silently trusted

#### Scenario: Auto apply still preserves candidate visibility
- **GIVEN** Auto Ingestion apply mode is `autoApplyEvidenceBacked`
- **AND** a generated update cannot satisfy the evidence gate
- **WHEN** the auto run completes
- **THEN** the unsupported update SHALL remain visible as a candidate or rejected candidate result
- **AND** the run SHALL NOT promote the unsupported update into trusted active-map facts

### Requirement: Auto Ingestion enablement configuration

The Project Knowledge Map SHALL require an explicit engine and model selection before Auto Ingestion becomes enabled.

#### Scenario: Enable flow selects engine and model
- **GIVEN** Auto Ingestion is currently disabled
- **WHEN** the user clicks the Auto Ingestion enable control
- **THEN** the system SHALL show engine and model controls before persisting `enabled=true`
- **AND** confirmation SHALL persist the selected `engine` and `model` together with `enabled=true`

#### Scenario: Cancelled enable flow remains disabled
- **GIVEN** Auto Ingestion is currently disabled
- **WHEN** the user opens the enable configuration flow and cancels it
- **THEN** the system SHALL keep `enabled=false`
- **AND** the scheduler SHALL NOT enqueue auto runs from hidden default engine or model values

### Requirement: Auto Ingestion graph reachability

The Project Knowledge Map SHALL preserve a single navigable root topology after automatic ingestion.

#### Scenario: Auto-generated top-level concepts remain reachable
- **GIVEN** an Auto Ingestion run returns a new node whose parent is the existing project root
- **AND** the AI payload does not repeat the existing project root node
- **WHEN** the generated result is merged into the dataset
- **THEN** the new node SHALL keep its parent link to the existing root
- **AND** the existing root SHALL include the new node in its children

#### Scenario: Persisted orphan roots are repaired on read
- **GIVEN** a persisted Project Map snapshot contains non-root nodes with no parent link
- **WHEN** the snapshot is read into the Project Map dataset
- **THEN** those orphan nodes SHALL be attached to the project root
- **AND** the map SHALL remain navigable from the project root

### Requirement: Project Map structured output repair

The Project Knowledge Map worker SHALL keep strict JSON validation while allowing one bounded repair attempt for invalid AI output.

#### Scenario: Non-JSON first response is repaired
- **GIVEN** a Project Map generation run receives an AI response that does not contain a valid JSON payload
- **WHEN** the worker detects the structured output validation failure
- **THEN** the worker SHALL request one JSON-only repair response from the same configured engine and model
- **AND** the run SHALL continue only if the repaired response validates as a Project Map payload

#### Scenario: Repair failure keeps the run failed
- **GIVEN** a Project Map generation run receives invalid structured output
- **AND** the one repair response is also invalid
- **WHEN** validation completes
- **THEN** the run SHALL remain failed
- **AND** no Project Map dataset write or Auto Ingestion processed marker update SHALL be treated as successful

### Requirement: Project Map generation dialog layout

The Project Knowledge Map SHALL render generation configuration dialogs with compact defaults and content-adaptive desktop width.

#### Scenario: Confirmation dialog expands for wide content
- **GIVEN** the Confirm Generation dialog contains long write paths or multiple read source chips
- **WHEN** the dialog is rendered on a desktop-sized viewport
- **THEN** the dialog SHALL keep the existing compact width as its minimum width
- **AND** the dialog SHALL expand when content needs more horizontal room
- **AND** the dialog SHALL remain bounded by the viewport-safe maximum width
- **AND** labels, title text, source chips, and footer actions SHALL NOT be clipped by the dialog edge

#### Scenario: Narrow viewport remains usable
- **GIVEN** the Confirm Generation dialog is rendered on a narrow viewport
- **WHEN** available width is below the desktop layout threshold
- **THEN** the dialog SHALL use a single-column layout
- **AND** long write paths and source chips SHALL wrap or truncate within the dialog instead of forcing page-level horizontal overflow

#### Scenario: Enable dialog keeps inline model refresh action
- **GIVEN** the Auto Ingestion enable dialog is rendered with engine and model controls
- **WHEN** the model refresh action is visible
- **THEN** the refresh action SHALL share the model control row on desktop
- **AND** the layout SHALL avoid a dedicated blank row for the refresh action

### Requirement: Project Map canvas controls collapsed preference

The Project Knowledge Map SHALL keep canvas layout controls compact by default while preserving the user's explicit expanded/collapsed preference.

#### Scenario: Canvas controls default collapsed
- **GIVEN** no canvas controls preference has been stored
- **WHEN** the Project Map graph canvas is rendered
- **THEN** the canvas controls SHALL render as a compact collapsed entry
- **AND** zoom, reset, auto layout, reset layout, and layout preset controls SHALL remain hidden until the user expands the control group

#### Scenario: User preference is restored
- **GIVEN** the user explicitly expands or collapses the canvas controls
- **WHEN** the Project Map panel remounts or reloads
- **THEN** the controls SHALL restore the user's last explicit collapsed/expanded preference
- **AND** that preference SHALL be stored as local UI chrome state rather than Project Map dataset content

#### Scenario: Graph actions do not mutate toolbar preference
- **GIVEN** the user has expanded the canvas controls
- **WHEN** the user zooms, resets the view, runs auto layout, resets layout, changes layout preset, drills into a node, returns to previous view, or returns to overview
- **THEN** the canvas controls SHALL remain expanded
- **AND** those graph actions SHALL NOT overwrite the stored collapsed/expanded preference

### Requirement: Project Map stabilization preserves renderer dependency boundary
The Project Knowledge Map stabilization work SHALL preserve the existing in-house SVG/HTML rendering boundary.

#### Scenario: No new graph dependency is introduced
- **WHEN** Project Map stabilization is implemented
- **THEN** the graph SHALL continue using the existing in-house SVG/HTML rendering boundary
- **AND** the implementation SHALL NOT add a third-party graph rendering or graph editing dependency

### Requirement: Project Map generation model fallback
The Project Knowledge Map SHALL keep Codex generation entry available when runtime model catalogs are temporarily unavailable.

#### Scenario: Codex catalog outage still exposes fallback models
- **GIVEN** the selected Project Map generation engine is `codex`
- **AND** runtime engine models, Codex model list, and workspace config do not provide any model option
- **WHEN** Project Map generation options are loaded
- **THEN** the UI SHALL expose fallback Codex model options from the canonical Codex model catalog
- **AND** Project Map SHALL NOT maintain a separate hard-coded Codex fallback model list

### Requirement: Project Map Auto Ingestion background scheduler ownership

Project Map Auto Ingestion SHALL evaluate scheduling from the active workspace lifecycle rather than from the Project Knowledge Map view lifecycle.

#### Scenario: Hidden Project Map still queues auto run
- **GIVEN** Auto Ingestion is enabled for the active workspace
- **AND** no Project Map auto run is pending or running
- **AND** the configured interval has elapsed since `memoryCursor.lastCheckedAt`
- **AND** the count of unprocessed Project Memory messages reaches `newSessionThreshold`
- **AND** the Project Knowledge Map panel is not currently rendered or mounted
- **WHEN** the workspace-level scheduler evaluates Auto Ingestion
- **THEN** the system SHALL create a queued Project Map run with `kind="auto"`
- **AND** the run SHALL use the existing Auto Ingestion request shape, consumed message hashes, and Project Memory evidence metadata

#### Scenario: Returning to Project Map shows background run
- **GIVEN** a workspace-level Auto Ingestion scheduler queued or started a Project Map auto run while the Project Knowledge Map panel was not visible
- **WHEN** the user opens the Project Knowledge Map panel
- **THEN** the panel SHALL load the persisted dataset
- **AND** the existing task/run UI SHALL be able to render the queued, running, completed, or failed auto run

#### Scenario: View lifecycle does not create duplicate scheduler
- **GIVEN** the workspace-level Auto Ingestion scheduler is mounted
- **AND** the Project Knowledge Map panel is also rendered
- **WHEN** Auto Ingestion evaluates scheduling
- **THEN** the system SHALL use a single scheduling owner for the active workspace
- **AND** it SHALL NOT enqueue a duplicate auto run because both the app layer and view layer evaluated the same interval window

#### Scenario: Background scheduler preserves interval gate
- **GIVEN** Auto Ingestion is enabled
- **AND** `memoryCursor.lastCheckedAt` is newer than the configured interval window
- **WHEN** the workspace-level scheduler evaluates Auto Ingestion
- **THEN** the system SHALL NOT scan Project Memory again
- **AND** it SHALL NOT enqueue a Project Map auto run

#### Scenario: Background scheduler preserves success-only processed markers
- **GIVEN** a workspace-level Auto Ingestion scheduler created an auto run from unprocessed Project Memory messages
- **WHEN** the run fails or is cancelled
- **THEN** the consumed message hashes SHALL NOT be added to `memoryCursor.processedMessages`
- **AND** the messages SHALL remain eligible for retry after the interval gate allows another scan

### Requirement: Project Map SHALL Prioritize The Knowledge Canvas

The Project Map surface SHALL present the graph canvas as the primary user focus, with navigation and secondary workflow affordances arranged around it.

#### Scenario: graph canvas is visually primary

- **WHEN** the user opens Project Map with a valid dataset
- **THEN** the graph canvas SHALL be the dominant surface
- **AND** search, tour, path, repair, evidence, and task controls SHALL NOT visually compete as equal primary panels

#### Scenario: graph command bar groups navigation primitives

- **WHEN** search, guided tour, path finder, lens selection, graph health, or task status are available
- **THEN** Project Map SHALL expose them as a compact graph navigation command surface
- **AND** each command SHALL preserve its existing behavior or clearly indicate why it is unavailable

### Requirement: Node Inspector SHALL Explain Understanding, Evidence, Relations, And Actions

The selected node detail area SHALL be structured around the user's graph-understanding workflow.

#### Scenario: selected node explains trust and relation context

- **WHEN** user selects a node
- **THEN** the inspector SHALL show the node summary, key facts, key logic, risk signals, evidence refs, confidence/stale context, incoming/outgoing relations, and bounded actions in a clear hierarchy
- **AND** relation and evidence entries SHOULD remain navigable when existing callbacks support navigation

#### Scenario: dead or future-only actions are not primary

- **WHEN** an action is not wired to a reliable end-to-end behavior
- **THEN** the UI SHALL hide it or render it disabled with an explicit reason
- **AND** the action SHALL NOT be styled as a primary completed workflow

### Requirement: Graph Health And Work Queue SHALL Be Secondary Affordances

Graph repair and Work Queue SHALL remain accessible without dominating the graph experience.

#### Scenario: graph repair is compact by default

- **WHEN** graph integrity issues or repair actions exist
- **THEN** Project Map SHALL summarize them through a compact health affordance
- **AND** detailed repair information SHALL be available on demand

#### Scenario: Work Queue is downgraded

- **WHEN** orchestration or task affordances are available from Project Map
- **THEN** Project Map SHALL present them as secondary actions or compact status
- **AND** unfinished Work Queue controls SHALL NOT dominate the first-screen Project Map experience

### Requirement: Existing Project Map Data Contracts SHALL Remain Compatible

The experience pass SHALL reuse the current Project Map model and utilities unless a later change explicitly expands the schema.

#### Scenario: no schema migration is required

- **WHEN** an existing Project Map dataset is loaded
- **THEN** the redesigned surface SHALL render using the existing nodes, relations, tours, evidence, repair summary, and view state
- **AND** no dataset migration SHALL be required for this change

