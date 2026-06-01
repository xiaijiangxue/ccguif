## ADDED Requirements

### Requirement: Close Current Session Shortcut MUST Be Configurable

The app SHALL expose a configurable shortcut action for closing the currently open session tab.

#### Scenario: close current session shortcut appears in settings
- **WHEN** the user opens Settings -> Shortcuts
- **THEN** the close-current-session action SHALL be visible in the shortcut list
- **AND** the user SHALL be able to edit or clear the shortcut

#### Scenario: close current session shortcut has a default
- **WHEN** app settings are initialized without an explicit close-current-session shortcut
- **THEN** the default shortcut SHALL be `cmd+w`
- **AND** existing unrelated shortcut customizations SHALL remain unchanged

#### Scenario: configured shortcut is matched through shared shortcut helpers
- **WHEN** the user presses the configured close-current-session shortcut
- **THEN** the event SHALL be evaluated through the shared shortcut parser and platform-aware matcher
