# composer-file-reference-index-availability Specification Delta

## ADDED Requirements

### Requirement: Composer file-reference completion MUST NOT require the file tree view

The system MUST make the active workspace file index available to composer `@` file-reference completion without requiring the user to open the right-side file tree first.

#### Scenario: composer can reference files before file tree is opened

- **GIVEN** an active workspace exists
- **AND** the right-side file tree panel has not been opened
- **WHEN** the workspace shell initializes shared workspace file data
- **THEN** the system MUST enable the initial workspace file-index lifecycle independent of file-tree visibility
- **AND** if the active workspace is connected, the system MUST perform the initial workspace file-index load
- **AND** composer `@` file-reference completion MUST receive the resulting file and directory candidates through the existing completion pipeline

#### Scenario: closed file tree does not enable periodic polling

- **GIVEN** an active workspace exists
- **AND** the right-side file tree panel remains closed
- **WHEN** the initial workspace file-index load has completed
- **THEN** the system MUST NOT start the periodic file-tree polling loop only because composer may use `@` completion

#### Scenario: visible file tree keeps existing refresh behavior

- **GIVEN** the right-side file tree panel is visible for the active workspace
- **WHEN** the workspace file-index polling interval is due
- **THEN** the system MUST continue refreshing the shared workspace file index through the existing polling behavior
