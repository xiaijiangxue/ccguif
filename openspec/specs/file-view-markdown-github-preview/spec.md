# file-view-markdown-github-preview Specification

## Purpose

Defines the file-view-markdown-github-preview behavior contract, covering File View Markdown Preview SHALL Use A Dedicated Renderer.
## Requirements
### Requirement: File View Markdown Preview SHALL Use A Dedicated Renderer

The system SHALL render Markdown files opened from the right-side file tree through a file-preview-specific renderer and MUST NOT route file preview through the message-curtain Markdown renderer.

#### Scenario: markdown file preview is routed to dedicated renderer

- **WHEN** user opens a `*.md` file from the right-side file tree and switches to preview mode
- **THEN** the file view SHALL render the document through a dedicated file-preview Markdown renderer
- **AND** the preview chain MUST NOT depend on `messages/components/Markdown` as its render entry

#### Scenario: mdx file preview follows the file-preview renderer boundary

- **WHEN** user opens a `*.mdx` file from the right-side file tree and switches to preview mode
- **THEN** the file view SHALL keep Markdown preview inside the dedicated file-preview renderer boundary
- **AND** any unsupported MDX-only syntax MUST be handled without falling back to the message-curtain renderer

### Requirement: File View Markdown Preview SHALL Preserve Original Document Structure

The system SHALL treat file Markdown preview as a source-fidelity surface and MUST NOT rewrite document structure for chat readability.

#### Scenario: paragraph boundaries are preserved from source

- **WHEN** a Markdown file contains intentional paragraph breaks and blank lines
- **THEN** the preview SHALL preserve those paragraph boundaries from source
- **AND** the renderer MUST NOT merge fragmented lines or synthesize paragraph joins that are not present in the file

#### Scenario: list indentation is preserved from source

- **WHEN** a Markdown file contains nested lists or mixed ordered and unordered list indentation
- **THEN** the preview SHALL follow the source Markdown structure
- **AND** the renderer MUST NOT apply chat-oriented list auto-correction heuristics that modify the original hierarchy

### Requirement: File View Markdown Preview SHALL Provide A GitHub-Style Reading Baseline

The system SHALL present file Markdown preview with a stable GitHub-style reading baseline for common Markdown elements.

#### Scenario: common block elements follow github-style baseline

- **WHEN** a Markdown file contains headings, paragraphs, blockquotes, horizontal rules, tables, links, and fenced code blocks
- **THEN** the preview SHALL render those elements with a GitHub-style reading baseline
- **AND** the resulting structure SHALL remain readable without requiring message-curtain-specific wrappers

#### Scenario: code blocks remain readable inside file preview

- **WHEN** a Markdown file contains fenced code blocks with or without language hints
- **THEN** the preview SHALL render code blocks with stable spacing, overflow handling, and readable highlighting
- **AND** file preview code blocks MUST NOT inherit message-curtain-only controls or wrappers unless separately specified for file view

#### Scenario: latex formulas render inside markdown file preview

- **WHEN** a Markdown file contains inline `$...$` math or display `$$...$$` math
- **THEN** the preview SHALL render those formulas through KaTeX inside the file-preview renderer
- **AND** raw formula delimiters MUST NOT remain as the primary reading surface for valid formulas

#### Scenario: fenced math blocks render as display formulas

- **WHEN** a Markdown file contains fenced `math`, `latex`, or `tex` blocks
- **THEN** the preview SHALL render valid block contents as KaTeX display formulas
- **AND** those blocks MUST NOT show a source-code card as the primary reading surface for valid formulas

#### Scenario: mermaid diagrams remain lazy renderable beside math support

- **WHEN** a Markdown file contains a fenced `mermaid` block and LaTeX formulas in the same document
- **THEN** the Mermaid block SHALL keep its file-preview Source / Render tab behavior
- **AND** math plugin support MUST NOT force Mermaid rendering during initial source-tab display

### Requirement: File View Markdown Styling SHALL Be Isolated From Message Curtain Styling

The system SHALL scope file-preview Markdown styles and render customizations to the file-view namespace so that message-curtain Markdown remains unaffected.

#### Scenario: file-preview style changes do not alter message markdown

- **WHEN** file-preview Markdown styles are updated to satisfy GitHub-style requirements
- **THEN** message-curtain Markdown rendering SHALL remain visually and structurally unchanged
- **AND** file-preview styles MUST NOT require direct mutation of message-curtain style selectors to take effect

#### Scenario: message renderer remains the active path for message surfaces

- **WHEN** Markdown is rendered inside chat messages, Spec Hub, release notes, or other existing message-based consumers
- **THEN** those surfaces SHALL continue using the existing message Markdown renderer contract
- **AND** they MUST NOT be implicitly migrated to the file-preview renderer by this change

#### Scenario: file-preview katex styles stay file-view scoped

- **WHEN** KaTeX styles are added for Markdown file preview
- **THEN** the selectors SHALL be scoped under the file-view Markdown namespace
- **AND** the change MUST NOT depend on `.message .markdown` selectors for file-preview formula readability

#### Scenario: file-preview math assets load independently from message surfaces

- **WHEN** a user opens a Markdown file preview containing LaTeX formulas before any chat message formula has rendered
- **THEN** the file-preview renderer SHALL load the KaTeX assets needed for formula readability
- **AND** formula readability MUST NOT depend on visiting the message-curtain renderer first

#### Scenario: file-preview annotation lines remain source-stable after math normalization

- **WHEN** file-preview math normalization expands a single source line into multiple render lines for display math
- **THEN** preview annotation actions SHALL map the rendered block back to the original source file line range
- **AND** the submitted annotation MUST NOT drift to transformed renderer-only line numbers

#### Scenario: file-preview mermaid card labels are localized

- **WHEN** the file-preview Mermaid source/render card is displayed
- **THEN** its tab labels, tablist label, render progress, and error text SHALL use i18n keys
- **AND** the component MUST NOT hard-code user-visible English strings

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

### Requirement: File View Markdown Preview SHALL Fail Closed To A Readable File-Preview Surface

The system SHALL keep Markdown rendering failures inside the file-preview boundary and MUST degrade to a readable file-view result instead of escaping into unrelated renderers or leaving the panel unusable.

#### Scenario: markdown-specific render failure stays inside file view
- **WHEN** a Markdown document triggers a file-preview rendering failure
- **THEN** the system MUST keep the failure isolated to the file-view renderer boundary
- **AND** it MUST NOT fall back to the message-curtain Markdown renderer

#### Scenario: markdown render failure still exposes readable content
- **WHEN** the file-preview Markdown renderer cannot complete its richest render path
- **THEN** the user MUST still receive a readable file-preview result for the current document
- **AND** the system MUST NOT replace the document with an empty panel or an uncaught error state

### Requirement: File View Markdown Preview MUST Render Large Documents By Stable Blocks

The file-view Markdown renderer MUST keep large Markdown documents structured and responsive by projecting stable source blocks instead of repeatedly rebuilding one growing Markdown document string.

#### Scenario: large markdown keeps structured rendering

- **WHEN** a Markdown document exceeds the rich-preview budget
- **THEN** the preview MUST keep rendering structured Markdown blocks such as headings, paragraphs, blockquotes, tables, fenced code, math, and Mermaid blocks
- **AND** it MUST NOT degrade to plain text solely because the document is large

#### Scenario: progressive rendering advances by block boundary

- **WHEN** the Markdown preview progressively reveals a large document
- **THEN** each reveal step MUST advance on stable Markdown block boundaries
- **AND** it MUST NOT cut through a fenced code, math, Mermaid, or table block in a way that breaks that block's renderer

#### Scenario: annotation line mapping remains source-stable

- **WHEN** a user creates or views annotations inside a block-rendered Markdown preview
- **THEN** annotation source line ranges MUST map back to original file line numbers
- **AND** block segmentation MUST NOT drift annotation placement to renderer-only line numbers

### Requirement: File View Markdown Preview MUST Avoid Unused Code Preview Work

The file-view Markdown preview MUST NOT precompute full-file code-preview highlighting when the active surface is Markdown preview.

#### Scenario: markdown preview does not compute code-preview highlighted lines

- **WHEN** the active file surface is `markdown-preview`
- **THEN** the file view MUST avoid full-file `highlightLine` work that is only needed by `code-preview`
- **AND** Markdown fenced code blocks MUST continue to render through the Markdown preview code-block renderer

### Requirement: Mermaid Preview Tabs MUST Keep Scroll Position Stable

The file-view Markdown renderer MUST keep a Mermaid block's card geometry stable when users switch between source and rendered views.

#### Scenario: source/render tab switching does not collapse the card body

- **WHEN** a user switches a Mermaid block between source and rendered views
- **THEN** the Mermaid block MUST keep a stable body container
- **AND** the body MUST NOT collapse to a transient loading height between tab states

#### Scenario: cached render does not flicker back to loading

- **WHEN** a Mermaid block has already rendered successfully
- **AND** the user switches away from and back to the rendered view
- **THEN** the block MUST reuse the last successful or cached SVG immediately
- **AND** it MUST NOT show a loading placeholder before restoring the rendered diagram

#### Scenario: Mermaid card is not used as scroll anchor during tab switch

- **WHEN** the user toggles a Mermaid block tab inside a scrolled Markdown preview
- **THEN** the Mermaid block SHOULD opt out of browser scroll anchoring
- **AND** the surrounding preview scroll position MUST remain visually stable

### Requirement: Revealed Markdown Blocks MUST Stay Visible Across Annotation Rerenders

The file-view Markdown renderer MUST keep already revealed heavy blocks visible when annotation UI state or progressive projection causes the preview to rerender.

#### Scenario: revealed table does not return to placeholder

- **WHEN** a table block has already been revealed in a large Markdown preview
- **AND** annotation draft state or parent preview props change without changing that table's source block
- **THEN** the table MUST remain visible
- **AND** it MUST NOT flash back to the deferred placeholder

#### Scenario: annotation affordance does not repaint card body

- **WHEN** a user hovers an annotatable table, code, math, or Mermaid block
- **THEN** the annotation affordance SHOULD render as a lightweight overlay
- **AND** it MUST NOT change the heavy block's content geometry or repaint the card body background

