## MODIFIED Requirements

### Requirement: File View Markdown Preview SHALL Remain Stable During Large Documents And Surface Transitions

The system SHALL keep file-preview Markdown rendering readable and stable when the user switches tabs, switches modes, changes annotation state, or opens larger Markdown documents that stress the renderer.

#### Scenario: switching away from and back to markdown preview does not blank the document
- **WHEN** the user opens a Markdown file in preview mode, switches to another file or mode, and then returns
- **THEN** the Markdown preview MUST recover to a readable rendered state for the current document
- **AND** the file view MUST NOT remain blank or show stale content from a previous file

#### Scenario: large markdown documents can degrade without breaking readability
- **WHEN** the user opens a Markdown document whose full rich preview exceeds the safe rendering budget
- **THEN** the system MUST preserve a readable Markdown preview experience through bounded degradation
- **AND** it MUST NOT freeze indefinitely while attempting the richest possible rendering

#### Scenario: markdown degradation threshold is deterministic across platforms
- **WHEN** a Markdown file exceeds the first-phase rich-preview budget by file size, line count, or `truncated` state
- **THEN** the file view MUST degrade using the same deterministic threshold policy on Windows and macOS
- **AND** it MUST NOT choose different render paths solely because one machine is faster than another

#### Scenario: annotation state changes do not rebuild the entire markdown document
- **WHEN** the user creates, edits, types into, or removes an AI annotation in Markdown preview
- **THEN** the Markdown document content model MUST remain stable for unchanged source content
- **AND** the renderer MUST update only the affected annotation overlay or affected block presentation

#### Scenario: common markdown block types render with file-preview semantics
- **WHEN** the user previews Markdown containing tables, ordered lists, unordered lists, nested lists, task lists, inline math, block math, Mermaid diagrams, flowchart fenced blocks, and code blocks
- **THEN** each supported type MUST render with the existing file-preview GitHub-style semantics
- **AND** fallback behavior for invalid formulas or diagrams MUST stay local to the failed block

#### Scenario: local preview UI updates do not reset unrelated rendered blocks
- **WHEN** hover state, annotation controls, draft typing, table scroll, or same-content refresh updates one part of the Markdown preview
- **THEN** unrelated rendered blocks MUST preserve their DOM identity where source content is unchanged
- **AND** the user MUST NOT see whole-document reset, flash, or visible stutter

#### Scenario: Mermaid rendered tab does not flicker during stable rerender
- **WHEN** a Mermaid block is in rendered mode
- **AND** the Markdown preview rerenders without changing that block content
- **THEN** the Mermaid block MUST remain in rendered mode
- **AND** it MUST NOT flash back to Source mode, an empty block, or a loading-only state

#### Scenario: wide table scroll is stable during preview-local interaction
- **WHEN** the user opens a Markdown table wider than the preview viewport
- **AND** the user scrolls horizontally within the table wrapper
- **AND** annotation controls, hover state, or same-content preview refresh causes a rerender
- **THEN** the table MUST keep the user's horizontal position
- **AND** the preview MUST NOT force the table back to the left edge

#### Scenario: annotation draft typing remains local to the draft composer
- **WHEN** the user types into an AI annotation draft in Markdown preview
- **THEN** the draft composer MUST keep focus, text, selection, and IME composition stable
- **AND** typing MUST NOT trigger visible whole-document preview reset or stutter
