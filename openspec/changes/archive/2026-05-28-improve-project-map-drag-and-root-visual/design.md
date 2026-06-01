## Context

Project Map graph 使用 HTML nodes + SVG lines。现有 drag state 存在于 `ProjectMapPanel`，`handleNodePointerDown` 会对节点调用 pointer capture，但 move/end 主要绑定在 canvas 上。某些浏览器或测试路径下，一旦 pointer capture 由 node 持有，后续 pointer move/up 会发到 node 而不是 canvas；这会让没有明显 edge 参与交互的节点表现为“拖不动”。

Root 视觉上目前只是普通卡片的轻微变体。对知识地图而言，Root 是用户理解拓扑的锚点，应该通过形状、尺寸、层级和颜色区别于 module/subsystem 节点，而不是只依赖 title 文案。

## Decision 1: Share Drag Move/End Logic Across Canvas and Node

保留现有 drag state：

- `nodeDragRef`
- `dragPreviewPositions`
- `persistGraphPositions`
- `suppressNextNodeClickRef`

抽出两个 helper：

- `updateNodeDragPreview(event)`
- `finishNodeDrag(event)`

Canvas `onPointerMove/onPointerUp/onPointerCancel` 和 node `onPointerMove/onPointerUp/onPointerCancel` 都调用同一套 helper。这样无论 pointer event 落在 canvas 还是 node，都能推进 preview 和 persist。

按钮保护保持不变：`handleNodePointerDown` 对 `button` target 直接 return，避免 drill up/down icon 被当作 drag handle。

## Decision 2: Root Visual Hierarchy Without New Copy

Root visual treatment 只通过 CSS 实现，不新增 user-facing text：

- larger footprint: root 比 hub/normal node 更宽更高。
- stronger shape: root 使用更大的 border radius 和双层 box-shadow。
- color hierarchy: 使用 project primary blue `#2563eb` 语义变量 + cyan highlight，避免 warning/error 色。
- anchor marker: root 的 kind badge 和 left border 使用更强的 contrast。
- focus compatibility: selected/group-selected/pinned/candidate 状态继续叠加，不覆盖可访问语义。

## Decision 3: Deduplicate Stable Node Identity Before Layout

Project Map 持久化按 `lenses/<lens>/nodes.json` 分片存储，生成器也允许不同 lens 补充同一概念。读取时必须把这些分片重新归一成全局 node set：

- stable identity 是 `ProjectMapNode.id`，不是 `title` 或 `lensId`。
- 如果同一 id 出现多次，保留 topology 更完整的节点作为 canonical：优先 root、带 `parentId`、带 `children`、带 sources、较高 confidence、较新 generation metadata。
- duplicate 的 `children`、`sources`、detail arrays、diagram artifacts、related artifacts 必须去重合并。
- Graph layout、mini map、React key、selection 和 drag state 只能消费 deduped nodes，不能在 render 层临时过滤。

这个处理放在 `normalizeProjectMapNodeTopology()`，因为 persisted read 与 generation merge 都会经过这里；UI 层不新增 dedupe 状态，避免拖拽、选择、viewState 出现两套 identity。

## Edge Cases

- Drag starts on drill action button: MUST NOT start node drag.
- Drag starts on selected multi-node group: existing group drag semantics remain.
- Pointer move goes to node instead of canvas: preview MUST still update.
- Pointer up goes to node instead of canvas: pinned position MUST persist and click suppression MUST prevent accidental selection toggles.
- Root node is also selected/candidate/stale: root hierarchy stays visible while existing state markers remain readable.
- Same node id appears in multiple lens files: graph renders one node and keeps valid parent/child links.
- Duplicate id carries extra evidence/detail: merged node keeps deduped sources and detail arrays.

## Validation

- `ProjectMapPanel.test.tsx` adds a regression where pointer move/up are dispatched to the node element, not canvas.
- Existing group drag tests continue to pass.
- `projectMapPersistence.test.ts` covers persisted duplicate ids across lens files.
- `incrementalGeneration.test.ts` covers historical duplicate ids during topology normalization.
- CSS smoke expectations verify `.is-core` remains the root marker and has distinct root-card dimensions.
- Run focused Project Map panel tests, OpenSpec strict validate, and typecheck.
