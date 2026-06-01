## Why

Project Map 画布里部分没有可见连线的节点拖拽不稳定，用户会误以为这类节点不能手动调整位置。同时总览根节点与普通节点视觉差异不足，用户需要额外阅读文本才能判断哪个节点是最顶层入口。

## 目标与边界

- 让所有可见 graph node 都能通过节点本体拖动并持久化位置，不依赖是否存在 edge line。
- 强化总览根节点的视觉层级，让用户一眼识别 Root / Top-level anchor。
- 保持现有 HTML/SVG in-house renderer，不引入第三方 graph dependency。
- 保持现有节点语义、布局算法、持久化 schema 和 inspector 行为不变。

## 非目标

- 不实现自由连线编辑、节点内容编辑或新增节点能力。
- 不重写 layout engine，不引入 force animation。
- 不改变 Project Map generation、candidate review 或 evidence 逻辑。
- 不把所有节点改成新的视觉语言；本轮只强化 root 与拖拽交互稳定性。

## What Changes

- Node drag handling will process pointer move/end from the node element itself as well as the canvas, so pointer capture on a node cannot strand isolated nodes.
- Root node rendering will gain a distinct visual treatment: larger footprint, stronger blue/cyan border, halo, subtle radial highlight, and more prominent badge treatment.
- Dataset normalization will collapse repeated persisted/generated nodes by stable node id before layout, so a node written under multiple lens files renders once while preserving topology and merged evidence.
- Focused tests will cover node-origin pointer move for drag preview and root visual class/shape expectations.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `project-xray-panel`: Project Knowledge Map graph SHALL allow every visible node to be dragged from the node body regardless of edge visibility, SHALL render the root node with an unmistakable top-level visual hierarchy, and SHALL collapse duplicate node ids before graph layout.

## Impact

- Code:
  - `src/features/project-map/components/ProjectMapPanel.tsx`
  - `src/styles/project-map.css`
  - `src/features/project-map/components/ProjectMapPanel.test.tsx`
- API / storage:
  - No Tauri command changes.
  - No persisted schema changes; existing `viewState.nodeLayouts` remains the storage boundary for pinned positions.
- Dependencies:
  - No new dependency.

## 技术方案对比

| 方案 | 做法 | 优点 | 风险 | 结论 |
|---|---|---|---|---|
| A. 只在 canvas 监听 pointer move/end | 保持现有 canvas 统一处理 | 改动最小 | node pointer capture 时 move/up 可能不到 canvas，孤立节点仍不稳 | 不采用 |
| B. canvas + node 双入口复用同一 drag handler | 节点和 canvas 都调用相同 pointer move/end 逻辑 | 修复根因，不改变布局和存储；覆盖 edge/isolated 节点 | 需要避免按钮点击与 drag 冲突 | 采用 |
| C. 引入专用 graph/drag 库 | 用第三方库管理 drag/drop | 功能完整 | 过度设计，违背当前 in-house renderer 约束 | 不采用 |

## 验收标准

- 从没有可见连线或 pointer event 落在节点本体的 graph node 开始拖拽时，节点位置会产生 preview 并在 pointer up 后持久化。
- 节点内部 drill action button 点击不触发节点拖拽。
- Root node 在总览中具有明显不同于普通节点的尺寸、边框、背景和 halo。
- 同一 node id 即使同时存在于多个 lens node 文件，graph 中也只出现一次，并保留父子连接与 evidence。
- Focused Vitest、OpenSpec strict validate、typecheck 通过。
