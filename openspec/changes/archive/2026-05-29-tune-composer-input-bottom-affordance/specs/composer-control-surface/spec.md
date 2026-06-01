## MODIFIED Requirements

### Requirement: Composer Geometry MUST Stay Compact

Composer visual geometry MUST remain compact enough for repeated workbench use.

#### Scenario: reduced corner radius

- **WHEN** the Composer input panel renders
- **THEN** its outer radius SHOULD be smaller than the old large-pill treatment
- **AND** home and normal composer variants MUST NOT drift into visibly different corner-radius languages

#### Scenario: reduced default height

- **WHEN** Composer renders without a user-resized persisted height
- **THEN** its default body height SHOULD be reduced by about two text rows from the old home composer default
- **AND** user-driven resize, max-height scrolling, and collapsed behavior MUST remain available

#### Scenario: migrated persisted height remains compact

- **WHEN** Composer restores an old persisted v2 input height
- **THEN** the restored height MUST be migrated about two text rows shorter
- **AND** the migrated height MUST NOT fall below the current minimum wrapper height

#### Scenario: bottom composer spacing remains close to viewport bottom

- **WHEN** the main Composer renders at the bottom of the realtime conversation view
- **THEN** its bottom spacing SHOULD stay compact enough that the input panel visually sits close to the viewport bottom
- **AND** this spacing change MUST NOT apply to the HomeChat curtain input unless that surface is explicitly targeted

#### Scenario: hover-only collapse affordance

- **WHEN** the Composer is not collapsed and the pointer is not hovering the top resize affordance
- **THEN** the top resize grip and collapse icons MUST remain visually hidden
- **AND** hovering, keyboard focusing, or resizing the top affordance MUST reveal the controls

#### Scenario: symmetric explicit collapse controls

- **WHEN** the top resize affordance is revealed
- **THEN** the Composer SHOULD present symmetric collapse icons around the resize grip
- **AND** activating either collapse icon MUST collapse the Composer to the bottom using the same collapsed state as drag-to-collapse

#### Scenario: send button compact square

- **WHEN** the send button renders
- **THEN** it SHOULD be a small rounded square
- **AND** it MUST NOT dominate the bottom toolbar height

