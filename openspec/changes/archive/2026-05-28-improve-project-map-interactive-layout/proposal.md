## Why

Project Knowledge Map is currently readable but visually static: the layout is computed by code, users cannot correct crowded regions directly, and larger maps still feel like a fixed diagram rather than an exploratory workspace.

This change turns the graph into an interactive map surface while preserving cognitive stability: user-positioned nodes stay pinned, automatic layout is explicit and bounded, and old Project Map snapshots remain compatible.

## 目标与边界

- Make the Project Map graph draggable at both canvas and node level.
- Add bounded automatic layout motion with collision prevention.
- Persist view layout separately from AI-generated knowledge facts.
- Add second-stage navigation aids: multi-select movement, mini map, and layout presets.
- Preserve existing drilldown, evidence link, deletion, task drawer, and split-editor behavior.

## 非目标

- Do not introduce a third-party graph/canvas dependency in this change.
- Do not migrate Project Map storage out of the existing JSON snapshot shape.
- Do not allow AI generation to write or overwrite manual node positions.
- Do not build a full graph editor with edge creation, node creation, or lasso annotations.

## What Changes

- Add graph view-state fields to the Project Map dataset:
  - per-node layout position: `x`, `y`, `pinned`
  - active layout preset
  - optional updated timestamp
- Add interactive graph controls:
  - collapse the Project Map header chrome into a compact toolbar aligned with adjacent editor toolbars
  - render header actions as lightweight icon-and-text toolbar items instead of button-shaped controls
  - drag blank canvas to pan
  - drag a node to reposition and pin it
  - multi-select nodes and drag them as a group
  - unpin / reset manual layout
  - auto layout animation that respects pinned nodes
  - layout preset selector: radial, tree, compact force
  - mini map for viewport awareness and quick repositioning
- Add deterministic layout utilities:
  - initial positions from existing layout rules
  - force settle pass with parent-child springs, repulsion, and collision constraints
  - collision-safe final positions
- Add compatibility handling:
  - old snapshots with no view-state render exactly through generated layout
  - malformed or missing layout entries are ignored
  - deleted nodes prune stale layout entries during persistence updates
- Keep viewport fitting scoped to structural graph changes so ordinary node selection does not reset pan/zoom or the user's current visual context.
- Add tests for interaction, persistence compatibility, and no-overlap behavior.

## 技术方案对比

### Option A: Use a full graph library

Pros: mature drag/zoom/force features.
Cons: larger dependency, styling mismatch, harder to preserve current inspector/drilldown behavior, and more migration risk.

### Option B: Extend current in-house HTML/SVG renderer

Pros: preserves current UI, avoids new dependency, keeps positions and animations feature-local, easier to test with existing component tests.
Cons: requires writing small layout simulation utilities.

### Decision

Use Option B. The existing renderer already owns pan/zoom, node cards, edges, and inspector behavior. A feature-local layout utility gives enough motion and drag behavior without turning this into a dependency migration.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `project-xray-panel`: Add interactive Project Knowledge Map layout, persisted graph view-state, mini map, multi-select drag, and layout presets.

## Impact

- Affected frontend code:
  - `src/features/project-map/types.ts`
  - `src/features/project-map/components/ProjectMapPanel.tsx`
  - `src/features/project-map/hooks/useProjectMapDataset.ts`
  - `src/features/project-map/services/projectMapPersistence.ts`
  - `src/features/project-map/utils/**`
  - `src/i18n/locales/*.part5.ts`
  - `src/styles/project-map.css`
- Affected behavior:
  - Project Map view becomes interactive and user-adjustable.
  - Manual node positions persist with the project map snapshot.
  - Existing snapshots without layout data continue to load.
- Dependencies:
  - No new external dependency.

## 验收标准

- Dragging a node changes its graph position and marks it pinned.
- Dragging selected multiple nodes moves them together without losing selection.
- Auto layout moves unpinned nodes, respects pinned nodes, and leaves nodes non-overlapping.
- Layout preset switching recomputes unpinned positions and preserves pinned positions.
- Mini map reflects graph bounds and allows clicking to move the viewport.
- Selecting another node while the detail panel is open does not refit the graph or reset the current viewport.
- The header chrome can collapse into a compact single-row toolbar, and visible header actions share a consistent lightweight icon-and-text treatment.
- Old Project Map snapshots with no `viewState` load without crashing and render graph nodes.
- Deleting a node removes its persisted layout entry.
- Existing evidence link, drilldown, detail panel, task drawer, and global/node generation interactions remain available.
