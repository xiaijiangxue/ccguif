# search-palette-file-content Specification

## ADDED Requirements

### Requirement: Search Palette Shall Surface File Content Matches

The system SHALL include file-content matches in Search Palette results for eligible ordinary text queries without requiring a dedicated content mode or command prefix.

#### Scenario: content results append to lightweight results
- **WHEN** the user opens Search Palette and enters an eligible text query
- **THEN** existing lightweight result types SHALL remain visible and selectable
- **AND** file-content matches SHALL be appended as they become available
- **AND** stale file-content responses from older queries MUST NOT replace current-query results

#### Scenario: file-content filter is independently selectable
- **WHEN** the user selects the dedicated file-content content filter
- **THEN** Search Palette SHALL run file-content search for eligible queries
- **AND** ordinary file path/name results SHALL NOT be shown solely because the file-content filter is selected
- **AND** selecting the file path/name filter SHALL NOT start file-content search work

#### Scenario: content result opens matched file location
- **WHEN** the user selects a file-content result with path and line/column metadata
- **THEN** the system SHALL open the matched file
- **AND** the system SHALL navigate to the matched line and column when the file-opening surface supports location metadata

### Requirement: File Content Search Shall Follow Palette Scope

The file-content search SHALL follow the existing Search Palette scope semantics.

#### Scenario: current workspace scope searches active workspace
- **WHEN** Search Palette is in current workspace scope and an active workspace exists
- **THEN** file-content search SHALL search only that workspace

#### Scenario: global scope searches progressively
- **WHEN** Search Palette is in global scope
- **THEN** file-content search SHALL search eligible workspaces progressively
- **AND** active or recent workspaces SHOULD produce results before lower-priority workspaces
- **AND** partial results SHALL be usable before every workspace has completed

### Requirement: File Content Search Shall Preserve Performance Boundaries

The file-content search SHALL be bounded so Search Palette remains responsive.

#### Scenario: short query does not scan content
- **WHEN** the query is empty or below the configured minimum visible length
- **THEN** the system SHALL NOT start file-content search work

#### Scenario: first content batch is bounded
- **WHEN** content matches are available for a query
- **THEN** the initial visible content-result batch SHALL be bounded
- **AND** the user MAY load additional matches by scrolling near the end of the current result set

#### Scenario: Palette close stops hidden content work
- **WHEN** Search Palette closes or the query is cleared
- **THEN** the frontend SHALL stop starting additional content-search requests
- **AND** late responses from in-flight requests SHALL NOT update the closed or cleared Palette state

### Requirement: Workspace Search Panel Shall Remain Compatible

The dedicated Workspace Search Panel SHALL preserve its existing advanced text-search behavior.

#### Scenario: advanced options remain dedicated to Workspace Search Panel
- **WHEN** the user needs regex, case-sensitive, whole-word, include-pattern, or exclude-pattern search
- **THEN** those controls SHALL remain available in the dedicated Workspace Search Panel
- **AND** Search Palette SHALL NOT be required to expose those controls in this change

#### Scenario: existing search command callers remain compatible
- **WHEN** an existing caller invokes workspace text search without pagination fields
- **THEN** the backend SHALL preserve the existing response semantics for that caller
