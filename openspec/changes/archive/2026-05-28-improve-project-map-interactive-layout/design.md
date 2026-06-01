## Context

The Project Map graph currently uses deterministic positions inside `ProjectMapPanel.tsx`: overview nodes are arranged around the project root, focused nodes are arranged around the selected node, and a collision pass prevents overlap. The canvas already supports pan and zoom, but nodes are static.

The new requirement is to make this surface feel alive and correctable: the user can drag nodes, let the map settle automatically, switch layouts, and use a mini map. The key constraint is stability. Knowledge maps are spatial memory tools, so automatic motion must not fight the user.

## Goals / Non-Goals

**Goals:**

- Provide draggable node and multi-node movement.
- Persist manual positions separately from semantic node data.
- Add auto layout motion with collision prevention.
- Add mini map and layout presets.
- Keep existing Project Map actions and evidence navigation stable.

**Non-Goals:**

- No new graph/canvas dependency.
- No edge editing or node authoring UI.
- No AI-generated layout ownership.

## Decisions

### Decision 1: Store layout as Project Map view-state

Add `ProjectMapViewState` to the dataset:

```ts
type ProjectMapLayoutPreset = "radial" | "tree" | "force";

type ProjectMapNodeLayout = {
  x: number;
  y: number;
  pinned?: boolean;
  updatedAt?: string;
};

type ProjectMapViewState = {
  layoutPreset: ProjectMapLayoutPreset;
  nodeLayouts: Record<string, ProjectMapNodeLayout>;
  updatedAt?: string;
};
```

`ProjectMapNode` remains semantic knowledge. `viewState.nodeLayouts[nodeId]` is a user/runtime view overlay. This prevents AI merge logic from treating positions as facts and keeps old snapshots compatible because `viewState` is optional.

### Decision 2: Layout utility owns geometry, component owns interaction

Create feature-local pure helpers under `src/features/project-map/utils/interactiveLayout.ts`. The helpers compute base positions, apply persisted positions, run collision resolution, and produce mini map projection data. `ProjectMapPanel.tsx` handles pointer state and calls dataset controller actions to persist view-state.

This avoids moving DOM/pointer concerns into utilities while keeping layout math testable without React.

### Decision 3: Automatic layout is explicit and bounded

Auto layout runs only when the user clicks the control or switches presets. It MAY animate for a short bounded duration, but it MUST settle into deterministic persisted coordinates. The simulation uses:

- parent-child spring attraction
- node-node repulsion
- collision separation using card footprints
- pinned nodes as fixed anchors

Generated/unpinned nodes can move. Pinned nodes remain fixed unless the user resets layout or drags them again.

### Decision 4: Multi-select stays lightweight

Use click to select, `Shift`/`Meta` click to toggle multi-select. Dragging any selected node moves the selected group. This avoids adding a lasso selection editor in the same change while still supporting practical cleanup of clusters.

### Decision 5: Mini map is a viewport control, not a second graph

Mini map renders simplified dots/edges from the same layout. Clicking the mini map recenters the viewport; it does not duplicate node labels or inspector controls. This keeps it compact and avoids accessibility duplication.

### Decision 6: Automatic viewport fitting is structural only

The graph auto-fit effect runs only when the graph structure or framing context changes: project storage key, focus/drill scope, visible node set, layout preset, or detail-panel collapsed state. Ordinary node selection, hover, inspector updates, drag-preview cleanup, and persisted position updates MUST NOT refit the viewport.

Manual Reset view remains available as an explicit viewport command.

### Decision 7: Header chrome can collapse to an editor-aligned toolbar

The Project Map header and lens summary area are treated as chrome, not map content. The chrome can collapse into a compact single-row toolbar that keeps the project identity visible while letting the graph align visually with an adjacent file editor toolbar.

Top-level action controls use one shared toolbar control height so Task, Profile, storage switch, candidate, and chrome toggle controls do not drift vertically. The primary header controls render as flat icon-and-text toolbar actions instead of button-shaped pills; this keeps the chrome aligned with editor toolbars while preserving semantic button behavior for keyboard and screen reader access.

## Risks / Trade-offs

- [Risk] Persisted positions can become stale after generation changes. → Mitigation: only apply layouts for existing node ids; new nodes get generated positions; deleted nodes prune stale layout.
- [Risk] Auto layout could produce disorienting motion. → Mitigation: bounded animation and pinned anchors.
- [Risk] More interaction state can make `ProjectMapPanel.tsx` larger. → Mitigation: put geometry and view-state normalization into utilities.
- [Risk] Multi-select conflicts with drilldown buttons. → Mitigation: button targets stop propagation; node drag starts only from card body.
- [Risk] Selection-driven rerenders can look like graph reset if they trigger viewport fit. → Mitigation: gate auto-fit behind a structural signature and cover ordinary node selection with a regression test.
- [Risk] Collapsing the header can hide useful context. → Mitigation: keep a compact project title and node/lens summary visible, with an explicit Expand control.

## Data Flow

```text
dataset.nodes + dataset.viewState
  -> buildInteractiveGraphLayout(...)
  -> ProjectMapPanel render positions/edges/mini-map
  -> pointer drag / preset / auto layout action
  -> datasetController.updateGraphViewState(...)
  -> persistDataset(...)
```

No backend/Rust command is added. The existing Project Map JSON snapshot persists the optional `viewState`.

## Migration Plan

1. Add `ProjectMapViewState` types and persistence sanitization.
2. Add pure interactive layout utilities and tests.
3. Wire node drag, multi-select, auto layout, presets, and mini map into `ProjectMapPanel`.
4. Add i18n and CSS.
5. Verify focused component/util tests, typecheck, large-file guard, and OpenSpec strict validation.

Rollback: remove `viewState` handling and the UI controls. Existing snapshots remain readable because `viewState` is optional.

## Open Questions

- Whether future versions should expose named user layouts per workspace.
- Whether lasso selection is worth a separate change after multi-select drag is validated.
