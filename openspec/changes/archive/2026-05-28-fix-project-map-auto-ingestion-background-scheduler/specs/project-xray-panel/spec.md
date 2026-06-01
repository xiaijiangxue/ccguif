## ADDED Requirements

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
