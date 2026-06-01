# file-markdown-preview-render-architecture Specification

## Purpose
TBD - created by archiving change stabilize-file-markdown-preview-render-architecture. Update Purpose after archive.
## Requirements
### Requirement: Markdown file preview MUST be driven by a stable document snapshot

Markdown file preview MUST consume a stable document snapshot rather than every transient file-sync or UI-state update.

#### Scenario: default reading mode ignores pending external disk changes
- **WHEN** a Markdown file is open in default preview/read mode
- **AND** external change monitoring detects a disk snapshot for the same file
- **THEN** the preview DOM MUST remain bound to the current stable snapshot
- **AND** the system MUST surface a refresh/changed-file affordance instead of replacing the preview content immediately

#### Scenario: live edit preview may advance the snapshot explicitly
- **WHEN** live edit preview is explicitly enabled
- **AND** a file content update is detected for the active Markdown file
- **THEN** the preview MAY advance to the new snapshot
- **AND** it MUST use debounce or hash-equivalent guarding to avoid rebuilding the preview for unchanged content

### Requirement: Markdown compile work MUST be cached independently from annotation UI state

The system MUST separate Markdown compile work from annotation state, hover state, and localized labels.

#### Scenario: annotation draft typing does not recompile markdown
- **WHEN** the user types into an AI annotation draft in Markdown preview
- **THEN** the system MUST NOT re-run full Markdown normalization, frontmatter extraction, line-map construction, or block-key generation for the same content hash
- **AND** only the annotation overlay or affected annotation UI MAY update

#### Scenario: same content rerender reuses compiled markdown model
- **WHEN** the Markdown preview rerenders with the same `documentKey`, same content hash, and same renderer profile
- **THEN** the compiled Markdown document model MUST be reused
- **AND** the render path MUST NOT treat the rerender as a new document parse

### Requirement: AI annotation placement MUST use indexed block placement

AI annotation placement in Markdown preview MUST be resolved through precomputed block/line placement or an equivalent indexed strategy.

#### Scenario: block render does not scan all annotations
- **WHEN** a Markdown block renders
- **THEN** it MUST obtain its draft/marker placement from a precomputed placement index or equivalent bounded lookup
- **AND** it MUST NOT scan the entire annotation list or recursively traverse rendered React children for every block

#### Scenario: nested annotations remain single-placement
- **WHEN** an annotation targets a nested Markdown list item, table cell, code block, or other nested block
- **THEN** the marker or draft MUST render at the most specific valid block
- **AND** it MUST NOT duplicate at parent preview blocks

### Requirement: Heavy Markdown blocks MUST render through isolated cached lifecycles

Mermaid diagrams, KaTeX formulas, large tables, and large code blocks MUST not force the whole Markdown document to remount or flicker.

#### Scenario: Mermaid rendered view survives same-content rerender
- **WHEN** a Mermaid block has successfully rendered as SVG
- **AND** the Markdown preview rerenders with the same block content and theme
- **THEN** the system MUST reuse the rendered SVG or equivalent cached result
- **AND** it MUST NOT switch the block back to Source or a loading placeholder

#### Scenario: Mermaid theme refresh keeps previous svg visible
- **WHEN** a theme change requires Mermaid SVG refresh
- **THEN** the previous successful SVG MUST remain visible until the replacement render succeeds or fails
- **AND** failure MUST stay local to the Mermaid block

#### Scenario: offscreen heavy blocks do not eagerly render
- **WHEN** a heavy Markdown block is outside the active viewport or render budget
- **THEN** the system SHOULD defer expensive rendering for that block
- **AND** the rest of the preview MUST remain readable and interactive

### Requirement: Large Markdown files MUST use deterministic bounded rendering

Large Markdown preview MUST choose degradation, progressive rendering, or virtualization through deterministic document metrics.

#### Scenario: render budget uses document metrics
- **WHEN** the system chooses a Markdown preview render strategy
- **THEN** it MUST use deterministic metrics such as file size, line count, block count, heavy block count, and `truncated`
- **AND** it MUST NOT use machine-local timing as the primary strategy selector

#### Scenario: large markdown does not mount all expensive content at once
- **WHEN** a Markdown file exceeds the rich preview budget
- **THEN** the preview MUST use a bounded strategy such as low-cost fallback, progressive block rendering, or block virtualization
- **AND** it MUST NOT attempt unbounded full-document rich rendering that can freeze the UI indefinitely

### Requirement: Markdown block rendering correctness MUST be type-specific and regression-tested

Markdown preview performance optimizations MUST preserve rendered output semantics for supported Markdown block types.

#### Scenario: table rendering remains correct under optimization
- **WHEN** a Markdown table contains headers, body rows, alignment, wide columns, or inline Markdown inside cells
- **THEN** the preview MUST render it as a table with the expected GitHub-style structure and overflow behavior
- **AND** performance optimizations MUST NOT degrade it into incorrect paragraph or plain-text output

#### Scenario: list rendering remains correct under optimization
- **WHEN** Markdown contains ordered lists, unordered lists, nested lists, task lists, or list items containing paragraphs, code, or formulas
- **THEN** the preview MUST preserve list hierarchy, numbering semantics, check states, and nested content placement
- **AND** annotation placement or progressive rendering MUST NOT duplicate or flatten nested list items

#### Scenario: math and diagram rendering remain correct under optimization
- **WHEN** Markdown contains inline math, block math, Mermaid diagrams, or flowchart fenced blocks
- **THEN** the preview MUST render supported content through the dedicated math/diagram lifecycle
- **AND** invalid math or diagram source MUST fail locally to a readable fallback without corrupting surrounding Markdown blocks

### Requirement: Markdown preview partial refresh MUST not amplify local UI changes

Markdown preview MUST keep non-content UI updates local to the affected block, overlay, or interaction island.

#### Scenario: annotation update does not recreate unrelated blocks
- **WHEN** an annotation marker, draft composer, hover state, or same-content refresh changes
- **THEN** the preview MUST update only the affected annotation overlay or affected block presentation
- **AND** unrelated Markdown block subtrees MUST keep their identity and local rendered state

### Requirement: Markdown preview interaction state MUST survive non-content refreshes

Markdown preview MUST preserve user interaction state inside stable rendered blocks when source content is unchanged.

#### Scenario: wide table horizontal scroll survives same-content rerender
- **WHEN** the user horizontally scrolls a wide Markdown table in preview
- **AND** annotation state, parent view state, or same-content refresh causes the preview to rerender
- **THEN** the table wrapper MUST restore the previous horizontal scroll position
- **AND** it MUST NOT reset `scrollLeft` to the left edge unless the table block content or document identity changed

#### Scenario: annotation draft input survives markdown preview rerender
- **WHEN** the user is typing in an AI annotation draft inside Markdown preview
- **AND** the preview rerenders without changing the underlying Markdown content for that draft target
- **THEN** the draft MUST preserve its current text, focus, selection, and IME composition state
- **AND** the rerender MUST NOT force the user to retype or recover lost input

#### Scenario: heavy block local view state survives unrelated overlay updates
- **WHEN** a Mermaid, flowchart, KaTeX, large table, or large code block has local rendered/expanded/visible state
- **AND** an unrelated annotation overlay or parent preview state changes
- **THEN** that heavy block MUST preserve its local interaction state
- **AND** unrelated overlay updates MUST NOT recreate the heavy block subtree in a way that drops visible rendered output

