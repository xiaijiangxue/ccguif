## ADDED Requirements

### Requirement: Composer Target Selector MUST Live In The Readiness Bar

Composer MUST expose the effective provider/model target through the readiness bar, and that target MAY act as the model selector trigger. The bottom toolbar MUST NOT duplicate the model selector.

#### Scenario: readiness target opens model selector

- **WHEN** the user clicks the provider/model target in the Composer readiness bar
- **THEN** the system MUST open the model selector for the effective composer target
- **AND** the selected model MUST be the same model consumed by the send path

#### Scenario: bottom toolbar omits model selector

- **WHEN** the Composer bottom toolbar renders
- **THEN** it MUST NOT render a second model selector
- **AND** the bottom toolbar SHOULD reserve space for tools, context tools, reasoning, usage, and send/stop controls

### Requirement: Model Selector MUST Use Compact Provider Groups

The model selector MUST present available providers as grouped compact options and avoid long descriptions in the primary list.

#### Scenario: compact model row

- **WHEN** the model selector lists provider models
- **THEN** each option MUST fit one visual row with the model label and selected check affordance
- **AND** it MUST NOT show long descriptive copy in the primary list row

#### Scenario: Gemini availability creates a group

- **WHEN** Gemini is detected as available for composer use
- **THEN** the model selector MUST include a Gemini group
- **AND** this MUST NOT depend on runtime model hydration already returning a non-empty Gemini list

#### Scenario: provider footer actions remain scoped

- **WHEN** the selector footer shows add/refresh actions
- **THEN** those actions MUST apply to the provider context represented by the selected group or effective target
- **AND** refreshing one provider MUST NOT start a conversation

### Requirement: Bottom Composer Tools MUST Be One Collapsible Icon Strip

Composer secondary controls MUST be managed by a single bottom inline tool strip that can be expanded or collapsed from the primary tool button.

#### Scenario: primary tool button toggles strip

- **WHEN** the user clicks the primary tool button
- **THEN** the inline tool strip MUST expand or collapse
- **AND** pressing Escape while expanded SHOULD collapse the strip

#### Scenario: secondary controls share one row

- **WHEN** the strip is expanded
- **THEN** config, shortcut actions, mode, plan toggle, context tools, panel toggle, memory reference, reasoning, and main usage controls SHOULD share the same visual row
- **AND** trailing controls MUST NOT remain outside the strip solely because they used to be right-aligned

#### Scenario: duplicate context usage is suppressed

- **WHEN** context tools render inside the inline strip
- **THEN** duplicate context usage indicators in that tool surface MAY be hidden
- **AND** the primary composer usage indicator MUST remain available in the main strip

### Requirement: Selected Context Chips MUST Live Above The Editor

Selected skill, command, and agent context chips MUST render as input context above the editable text area, not as controls inside the bottom toolbar.

#### Scenario: selected chips render in a separate context row

- **WHEN** skill, command, or agent context chips are selected
- **THEN** the Composer MUST render those chips above the editable text area in a dedicated context row
- **AND** the bottom toolbar MUST NOT render those selected context chips

#### Scenario: chip behavior is unchanged

- **WHEN** the user removes a selected context chip from the context row
- **THEN** the existing remove callback and selected state update MUST be used
- **AND** the move MUST NOT change message payload assembly, command selection, skill selection, agent selection, or send behavior

### Requirement: Inline Tool Icons MUST Be Theme-Safe And Icon-Only

Inline tool controls MUST render as compact icon-only affordances with consistent hit area, spacing, and theme-safe color.

#### Scenario: icon-only selected state

- **WHEN** mode, reasoning, or a related selector is selected
- **THEN** its collapsed toolbar representation MUST remain an icon
- **AND** it MUST NOT replace the icon with visible text

#### Scenario: compact hit area

- **WHEN** inline tool controls render
- **THEN** their hit area SHOULD be consistent and compact, approximately `28px x 32px`
- **AND** adjacent icon spacing SHOULD be minimal without allowing hover or click regions to overlap incoherently

#### Scenario: theme-safe icons

- **WHEN** the app theme is dark, dim, light, or system light
- **THEN** inline tool icons MUST remain visible by inheriting theme color tokens or `currentColor`
- **AND** toolbar icons MUST NOT depend on SVG assets with fixed black or white strokes

#### Scenario: no pseudo-button background

- **WHEN** inline tools render in the normal composer or home composer
- **THEN** they MUST NOT regain circular or pill button backgrounds from broader selector styles
- **AND** hover MAY change icon color but SHOULD NOT reintroduce large button chrome

#### Scenario: selected tool affordance is normalized

- **WHEN** inline tool controls such as completion email, live follow, live collapse, or memory reference are selected or armed
- **THEN** the control MUST keep the same icon-only hit area and MUST show a compact check affordance over the icon
- **AND** selected icon and check colors MUST come from one shared theme-safe selected color token
- **AND** selected state MUST NOT be expressed through inconsistent green dots, glowing badges, text replacement, or heavy button borders/backgrounds

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

#### Scenario: send button compact square

- **WHEN** the send button renders
- **THEN** it SHOULD be a small rounded square
- **AND** it MUST NOT dominate the bottom toolbar height
