## ADDED Requirements

### Requirement: Close Current Session Shortcut MUST Mirror Tab Close Button Semantics

The app SHALL make the configured close-current-session shortcut equivalent to activating the current topbar session tab close button.

#### Scenario: shortcut closes only the active open tab
- **WHEN** a topbar session tab is active
- **AND** the user presses the configured close-current-session shortcut
- **THEN** the active tab SHALL be removed from the open topbar window
- **AND** the underlying thread SHALL remain in session history
- **AND** the runtime turn SHALL NOT be stopped, interrupted, deleted, or archived

#### Scenario: shortcut uses existing adjacent fallback
- **GIVEN** the active topbar session tab has adjacent remaining tabs
- **WHEN** the user closes it with the configured shortcut
- **THEN** the app SHALL select the same fallback tab that the tab close button would select

#### Scenario: shortcut prevents page blank fallback
- **WHEN** the user presses the configured close-current-session shortcut
- **THEN** the app SHALL prevent the native/WebView default action
- **AND** the app page SHALL remain rendered
