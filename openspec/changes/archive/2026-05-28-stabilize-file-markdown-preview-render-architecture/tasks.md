## 1. Specification

- [x] 1.1 [P0][depends:none][I: user video evidence + current OpenSpec][O: proposal/design/tasks][V: artifacts created] Create the architecture-root proposal.
- [x] 1.2 [P0][depends:1.1][I: existing main specs][O: delta specs][V: modified capabilities listed in proposal have spec deltas] Add spec deltas for file-view runtime stability and Markdown preview architecture.

## 2. Rendering Inventory

- [x] 2.1 [P0][depends:1][I: `FileMarkdownPreview.tsx`][O: render hot-path map][V: Markdown normalization, ReactMarkdown, annotation placement, Mermaid, KaTeX paths documented] Inventory current Markdown preview hot path.
- [x] 2.2 [P0][depends:1][I: `useFileExternalSync.ts` / `FileViewPanel.tsx`][O: snapshot/input map][V: external sync, live preview, dirty buffer, default read mode transitions documented] Inventory file content lifecycle.
- [x] 2.3 [P0][depends:1][I: annotation tests][O: annotation placement map][V: nested list/table/code marker semantics listed] Inventory AI annotation placement semantics.

## 3. Stable Snapshot

- [x] 3.1 [P0][depends:2.2][I: content lifecycle][O: stable preview snapshot controller][V: default read mode does not consume pending external changes] Implement stable Markdown preview snapshot.
- [x] 3.2 [P0][depends:3.1][I: live edit preview][O: explicit live snapshot advancement][V: live preview still updates with debounce/hash guard] Preserve live edit preview opt-in.
- [x] 3.3 [P0][depends:3.1][I: external sync tests][O: regression coverage][V: pending disk change does not disturb preview DOM by default] Add external sync stability tests.

## 4. Compile Cache / Render Model

- [x] 4.1 [P0][depends:2.1][I: Markdown hot-path map][O: `compileFileMarkdownDocument` or equivalent][V: pure helper tests cover content hash cache key] Introduce compile/render model helper.
- [x] 4.2 [P0][depends:4.1][I: math/frontmatter/line map][O: cached normalization pipeline][V: existing math line mapping tests pass] Move frontmatter/math/line map into compile layer.
- [x] 4.3 [P0][depends:4.1][I: same-content rerender][O: compile cache regression][V: annotation state changes do not recompile Markdown] Add no-reparse tests.

## 5. Annotation Overlay

- [x] 5.1 [P0][depends:2.3,4][I: block model + annotations][O: annotation placement index][V: block lookup avoids full annotation scan per block] Implement annotation placement index.
- [x] 5.2 [P0][depends:5.1][I: nested block semantics][O: marker/draft placement tests][V: no duplicate nested list/table/code annotations] Preserve existing annotation behavior.
- [x] 5.3 [P1][depends:5.1][I: large annotation fixture][O: render amplification regression][V: typing annotation does not rebuild full preview] Add focused performance-style regression.

## 6. Heavy Block Isolation

- [x] 6.1 [P0][depends:4][I: Mermaid block descriptors][O: Mermaid SVG cache][V: same-content rerender does not call `mermaid.render`] Implement Mermaid render cache.
- [x] 6.2 [P0][depends:6.1][I: theme mutation][O: background Mermaid refresh][V: previous SVG remains visible during rerender] Prevent Mermaid source/loading flicker.
- [x] 6.3 [P1][depends:4][I: KaTeX formulas][O: KaTeX asset/render cache][V: formula render is cached and failures stay block-local] Harden KaTeX lifecycle.
- [x] 6.4 [P1][depends:4][I: large tables/code blocks][O: lazy heavy block render][V: viewport-out heavy blocks do not start expensive render] Add lazy heavy block budget.

## 7. Large Markdown Progressive / Virtualized Render

- [x] 7.1 [P0][depends:4][I: size/line/block/heavy counts][O: deterministic render budget][V: thresholds are platform-independent] Define render budget thresholds.
- [x] 7.2 [P1][depends:7.1][I: block model][O: progressive block renderer][V: medium Markdown mounts in chunks] Implement progressive render path.
- [x] 7.3 [P1][depends:7.1][I: `@tanstack/react-virtual`][O: block virtualization path][V: large Markdown does not mount all blocks at once] Implement virtualized path or document bounded fallback.

## 8. Validation

- [x] 8.1 [P0][depends:3-6][I: touched TS/TSX][O: type evidence][V: `npm run typecheck`] Run typecheck.
- [x] 8.2 [P0][depends:3-6][I: focused tests][O: regression evidence][V: file preview / annotation / Mermaid tests pass] Run focused Vitest suites.
- [x] 8.3 [P1][depends:7][I: large Markdown fixture][O: perf evidence][V: deterministic degradation/progressive/virtualized path demonstrated] Run large Markdown smoke/perf evidence.
- [x] 8.4 [P0][depends:all][I: OpenSpec artifacts][O: strict validation][V: `openspec validate stabilize-file-markdown-preview-render-architecture --strict --no-interactive`] Validate OpenSpec.
- [x] 8.5 [P1][depends:all][I: file sizes/style changes][O: governance evidence][V: `npm run check:large-files:gate` when policy-relevant files are touched] Run large-file gate as needed.

## 9. 2026-05-28 Markdown Preview Correctness & Interaction Follow-up

- [x] 9.1 [P0][depends:4-7][I: current Markdown fixtures and renderer behavior][O: block-type correctness matrix][V: table, list/nested list, math, Mermaid/flowchart, and code block expected semantics documented] Calibrate Markdown block rendering correctness coverage.
- [x] 9.2 [P0][depends:9.1][I: focused regression fixtures][O: rendering correctness tests][V: table/list/math/Mermaid/flowchart/code block fixtures keep expected rendered output after renderer changes] Add type-specific rendering correctness regressions.
- [x] 9.3 [P0][depends:4-7][I: current `FileMarkdownPreview` table wrapper][O: table interaction state registry][V: horizontal `scrollLeft` survives annotation updates, parent rerender, and same-content refresh] Preserve wide-table horizontal scroll state.
- [x] 9.4 [P0][depends:5][I: current inline annotation draft composer][O: draft input state island contract][V: typing, selection, focus, and IME composition survive Markdown preview rerender without full compile] Harden AI annotation draft input stability.
- [x] 9.5 [P0][depends:6][I: Mermaid / flowchart heavy block renderer][O: stable view-mode/render-result state][V: rendered tab remains rendered and does not flash source/loading during same-content rerender] Preserve Mermaid / flowchart block interaction state.
- [x] 9.6 [P0][depends:5-7,9.2-9.5][I: annotation, hover, scroll, same-content refresh events][O: partial refresh non-amplification guard][V: unrelated block subtrees are not recreated by overlay/local interaction changes] Enforce partial refresh boundaries.
- [x] 9.7 [P1][depends:6,9.3][I: KaTeX and large table/code heavy blocks][O: heavy block prop isolation audit][V: unrelated annotation changes do not recreate unrelated heavy block subtrees] Audit heavy block prop identity and rerender boundaries.
- [x] 9.8 [P0][depends:9.1-9.7][I: focused regression fixtures][O: Vitest coverage][V: tests cover correctness, wide table scroll, annotation draft input, Mermaid rendered view, partial refresh, and many-column large table preview] Add focused follow-up regressions.
- [x] 9.9 [P0][depends:9.1-9.8][I: touched TS/TSX/CSS][O: validation evidence][V: focused Vitest suites + typecheck + `openspec validate stabilize-file-markdown-preview-render-architecture --strict --no-interactive`] Run validation for the follow-up implementation.
