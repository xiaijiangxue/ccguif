# composer-skill-completion Specification

## ADDED Requirements

### Requirement: Slash Menu May Include Skills Behind A Setting

The system SHALL provide a persisted user setting that controls whether Skills appear in the `/` completion menu.

#### Scenario: disabled setting preserves command-only slash menu
- **WHEN** the setting is disabled or missing
- **THEN** the `/` completion menu SHALL use the existing command-only behavior
- **AND** Skills SHALL remain available through the `$` selector

#### Scenario: enabled setting merges skills into slash menu
- **WHEN** the setting is enabled and the user opens `/` completion
- **THEN** the menu SHALL include existing command results
- **AND** the menu SHALL include available Skills that match the query
- **AND** a skill loading failure SHALL NOT prevent command results from being shown

#### Scenario: selecting slash skill reuses skill selection behavior
- **WHEN** the user selects a Skill from the `/` completion menu
- **THEN** the composer SHALL call the existing skill selection callback with the selected skill name
- **AND** the selected Skill SHALL NOT be inserted as slash command text
- **AND** ordinary slash commands SHALL continue to insert their command text
