## ADDED Requirements

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

#### Scenario: Graph renderer uses in-house implementation
- **WHEN** the Project Knowledge Map graph is rendered
- **THEN** the system SHALL use an in-house SVG/HTML implementation
- **AND** the initial implementation SHALL NOT require a third-party graph rendering dependency

#### Scenario: Graph interaction scope
- **WHEN** the user interacts with graph nodes
- **THEN** the graph SHALL support node selection, hover state, one-hop neighborhood focus, and stale/candidate/confidence visual states
- **AND** the graph SHALL NOT expose manual node text editing

#### Scenario: Node selection updates inspector under canvas gestures
- **WHEN** the user clicks a visible graph node while the canvas supports pan and zoom
- **THEN** the selected node SHALL become the inspector subject immediately
- **AND** canvas pointer capture SHALL NOT swallow the node selection event
- **AND** the inspector SHALL reopen if it was collapsed

#### Scenario: Graph remains visible after first generation completes
- **WHEN** the first Project Map generation completes
- **AND** the active task banner disappears from the stage
- **THEN** the graph canvas SHALL remain in the flexible center stage row
- **AND** nodes, edges, zoom controls, and inspector SHALL remain visible
- **AND** the canvas SHALL NOT collapse to zero height because of grid auto-placement

#### Scenario: Complex graph editing is out of scope
- **WHEN** the graph is displayed in the initial release
- **THEN** the system SHALL NOT require freeform node drag editing or force-directed animation

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

#### Scenario: Project profile drives top-level lenses
- **WHEN** the Project Knowledge Map has project evidence or generated mock data
- **THEN** the dataset SHALL include a Project Profile describing language, project shape, framework candidates, interface kinds, and build systems
- **AND** the top-level graph SHALL render lenses from the dataset rather than a hard-coded UI layer list
- **AND** the UI SHALL NOT expose a fixed left-side layer rail as the primary navigation model

#### Scenario: Lens navigation
- **WHEN** the Project Knowledge Map panel is open
- **THEN** the user SHALL be able to drill into detected or candidate lenses such as Overview, Business Capabilities, Modules, API Surface, Data Model, Runtime & Build, Dependencies, Tests & Quality, Risk, or Evidence when they apply to the current project
- **AND** lenses marked `notApplicable` SHALL NOT be shown as active graph choices

#### Scenario: Smart initial lens
- **WHEN** the Project Knowledge Map panel opens
- **THEN** the system SHALL select Overview for an empty or newly generated map
- **AND** the system MAY prioritize Risk, Evidence, or recently changed lenses when stale nodes, pending candidates, or recent high-activity changes exist

#### Scenario: Cross-language API classification
- **WHEN** the system identifies project interfaces
- **THEN** API Surface SHALL support HTTP, RPC, CLI commands, library exports, native headers, and event topics
- **AND** the UI SHALL NOT assume that all APIs are Spring controllers, REST endpoints, or frontend routes

#### Scenario: Mixed node granularity
- **WHEN** the system generates graph nodes
- **THEN** top-level nodes SHALL primarily represent modules or subsystems
- **AND** child nodes MAY represent capabilities, flows, risks, timeline events, or concepts

#### Scenario: Node drill-down
- **WHEN** the user selects a node
- **THEN** the inspector SHALL show its summary, lens, confidence, stale state, sources, last generated time, and generation run
- **AND** the user SHALL be able to inspect linked files, specs, commits, tests, or conversation evidence when available
- **AND** nodes with children SHALL provide a visible drill-down icon
- **AND** focused child views SHALL provide an upward navigation affordance when a parent exists

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

#### Scenario: Generation requires model confirmation
- **WHEN** the user starts global collection
- **THEN** the system SHALL ask the user to choose engine, model, and scope
- **AND** the system SHALL show the planned read sources and write path
- **AND** generation SHALL NOT start until the user confirms

#### Scenario: Generation model options come from runtime catalog
- **WHEN** the generation confirmation dialog opens for a workspace
- **THEN** the engine selector SHALL be populated from runtime engine detection
- **AND** the model selector SHALL be populated from the selected engine's model catalog
- **AND** changing the selected engine SHALL refresh the model choices for that engine
- **AND** the UI SHALL show loading, error, or no-model states instead of silently accepting an unverified `default` model

#### Scenario: Confirmed generation enters background task queue
- **WHEN** the user confirms a global collection request
- **THEN** the system SHALL create a run record for the selected engine, model, scope, read sources, and write path
- **AND** the confirmation dialog SHALL close without waiting for long-running generation work
- **AND** the Task button beside Refresh SHALL show the queued task count
- **AND** the task drawer SHALL expose active, queued, and recent runs

#### Scenario: Active slot does not wait for queued write completion
- **WHEN** the user confirms a global collection request for an empty project map
- **THEN** the app-session worker SHALL be eligible to claim the optimistic queued run immediately
- **AND** the active run SHALL move to `running` / `preparingSources` before the first queued persistence write is required to settle
- **AND** a blocked or failed persistence write SHALL surface as a failed run instead of leaving the run permanently `queued`

#### Scenario: Generation queue has one active slot
- **WHEN** multiple generation requests are confirmed
- **THEN** the requests SHALL be displayed in deterministic queue order
- **AND** only one run SHALL occupy the active slot at a time
- **AND** additional runs SHALL remain pending until the active slot is available
- **AND** closing the Project Knowledge Map panel SHALL NOT discard persisted request records

#### Scenario: Active, queue, and recent sections are not duplicated
- **WHEN** the task drawer is open
- **THEN** the active section SHALL show only the active slot run
- **AND** the queue section SHALL show only pending runs waiting behind the active slot
- **AND** the recent section SHALL show only completed, failed, or cancelled runs
- **AND** the same run SHALL NOT appear in multiple task drawer sections at the same time

#### Scenario: Pending queue runs can be cancelled
- **WHEN** a pending run is waiting in the queue behind the active slot
- **THEN** the task drawer SHALL provide a cancel action for that queued run
- **AND** cancelling the run SHALL mark it `cancelled`
- **AND** cancelled runs SHALL no longer count as active or queued work

#### Scenario: Finished task records can be cleared
- **WHEN** recent runs contain completed, failed, or cancelled records
- **THEN** the task drawer SHALL provide a clear-finished action
- **AND** clearing finished records SHALL remove only completed, failed, and cancelled runs
- **AND** active or pending runs SHALL remain intact

#### Scenario: Active slot exposes honest progress feedback
- **WHEN** a pending run occupies the active slot before the AI generator worker has taken over
- **THEN** the task drawer SHALL show a loading or progress indicator
- **AND** the status copy SHALL explain that the run is queued and waiting for the generator
- **AND** the UI SHALL NOT claim that graph generation is actively running until a worker reports running status

#### Scenario: Active run is executed by an app-session worker
- **WHEN** the Project Map worker claims the active run
- **THEN** the run status SHALL become `running`
- **AND** the task drawer SHALL expose phase, progress, latest log, and thread id when available
- **AND** the worker SHALL collect bounded workspace evidence through existing workspace file APIs
- **AND** the worker SHALL dispatch generation to the user-selected engine and model
- **AND** the worker SHALL use a temporary read-only app-server thread event stream for Codex runs
- **AND** the worker SHALL use the existing read-only synchronous engine message boundary for non-Codex supported engines
- **AND** the worker SHALL keep only one active run executing at a time

#### Scenario: Evidence input is normalized for all engines
- **WHEN** the worker prepares evidence for any supported generation engine
- **THEN** the worker SHALL enforce a bounded total evidence prompt budget
- **AND** the worker SHALL normalize line endings before prompt assembly
- **AND** oversized file content SHALL be truncated on readable paragraph, line, or sentence boundaries
- **AND** oversized Markdown evidence SHALL include a heading digest when headings are available
- **AND** truncation SHALL be explicit through a marker instead of silently cutting content
- **AND** the same normalized evidence packet SHALL be used for Codex, Claude, Gemini, and OpenCode generation paths

#### Scenario: Project-map Tauri commands use async workspace locking
- **WHEN** project-map read or write commands resolve the current workspace entry
- **THEN** the commands SHALL use the async workspace lock contract
- **AND** the commands SHALL NOT call blocking workspace locks from inside async Tauri command execution

#### Scenario: Active run is not cancelled by React StrictMode cleanup
- **WHEN** the Project Knowledge Map panel is mounted in React StrictMode
- **AND** a confirmed generation request is persisted as pending
- **THEN** the active slot worker SHALL still claim the run
- **AND** the run SHALL move from `pending` / `queued` to `running`
- **AND** cleanup from StrictMode effect replay SHALL NOT permanently suppress run progress updates

#### Scenario: Queued run restores before lenses exist
- **WHEN** project-map persistence contains manifest, profile, and run records but no generated lenses yet
- **THEN** the panel SHALL restore the run records
- **AND** pending or running runs SHALL remain visible to the Task drawer
- **AND** the absence of lenses SHALL NOT cause the queue state to be discarded

#### Scenario: AI output is validated before persistence
- **WHEN** the selected AI engine returns generation output
- **THEN** the worker SHALL parse structured ProjectMapDataset JSON before writing files
- **AND** invalid JSON or output without valid nodes SHALL mark the run `failed`
- **AND** failed output SHALL NOT replace the current persisted map

#### Scenario: Worker lifetime is clear
- **WHEN** the user closes the task drawer or switches center panels while the Project Map panel remains mounted
- **THEN** the active app-session worker SHALL continue updating the run record
- **AND** the UI SHALL NOT promise daemon execution after app quit or workspace switch

#### Scenario: Queue persistence failure is visible
- **WHEN** a confirmed generation request cannot be written to project-map persistence
- **THEN** the UI SHALL NOT keep the user stuck in the confirmation dialog
- **AND** the corresponding run SHALL be marked failed with an error message
- **AND** the user SHALL be able to inspect the failed run in the task drawer or recent run list

#### Scenario: Global collection writes persisted lenses
- **WHEN** global collection completes successfully
- **THEN** the system SHALL write generated profile and lens data to `.ccgui/project-map/<project-name>-<short-hash>/`
- **AND** the system SHALL update `manifest.json`
- **AND** the graph SHALL refresh from persisted data

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

#### Scenario: Candidate capture from Q&A
- **WHEN** a conversation produces project knowledge with identifiable evidence
- **THEN** the system MAY create a candidate map patch
- **AND** the candidate SHALL require user confirmation before writing to disk

#### Scenario: Candidate follows evidence gate
- **WHEN** the user confirms a conversation-derived candidate
- **THEN** the candidate SHALL pass the same evidence and persistence rules as global or node-level generation

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
