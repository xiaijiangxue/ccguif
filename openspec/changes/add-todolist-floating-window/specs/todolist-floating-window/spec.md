# TodoList Floating Window

## Requirements

### Requirement: Floating todo visibility

The app MUST render a TodoList floating window in the message area when the current session has todo data.

#### Scenario: Active todo exists

- **WHEN** the current session has at least one todo that is not completed
- **THEN** the floating window is visible in collapsed form
- **AND** the title summary shows completed count and total count

#### Scenario: All todos completed

- **WHEN** the current session has todo data and all todos are completed
- **THEN** the floating window remains visible in collapsed summary form

#### Scenario: No todo data

- **WHEN** the current session has no todo data
- **THEN** the floating window is hidden

### Requirement: Floating todo state

The app MUST persist floating todo position globally and expansion state per session.

#### Scenario: Session switch restores expansion

- **WHEN** a user expands the floating window in session A, switches to another session, then returns to session A
- **THEN** session A restores the expanded state

#### Scenario: Position is clamped

- **WHEN** a stored or dragged position is outside the message viewport
- **THEN** the position is clamped so the floating window remains visible
