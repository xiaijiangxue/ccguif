## Why

`unassigned-discoveries` 解决了 Project Map root 被非结构任务污染的问题，但它只是收纳箱，不是最终层级。用户需要一个可控的 AI 整理入口，把待整理节点建议移动到最合适的结构父节点下。

## 目标与边界

- 目标：提供 Project Map AI node organizer，只针对 `unassigned-discoveries` 下的节点生成归属建议。
- 目标：AI 只生成移动建议，不直接修改图谱。
- 目标：移动建议必须进入 candidate review，用户确认后才应用。
- 目标：应用移动前必须做 topology safety check，避免 parent missing、自挂、cycle、挂回 root 等问题。
- 边界：整理逻辑必须是通用客户端能力，不依赖用户本机 `.trellis`、`openspec`、`.codex` 或特定仓库命名。

## 非目标

- 不做后台自动整理。
- 不让 AI 修改节点标题、摘要、sources、confidence 或 detail 内容。
- 不整理整张图，只整理 `unassigned-discoveries` 的直接子节点。
- 不新增全局任务中心或 Agent Work Queue。
- 不引入新的持久化数据库或外部依赖。

## What Changes

- 新增 AI organizer request：从 Project Map 面板触发一次性整理。
- 新增 organizer prompt：向 AI 提供结构候选父节点、待整理节点、source paths 和摘要，让 AI 返回 JSON moves。
- 新增 organizer candidate 类型：review 记录只表达 `nodeId -> suggestedParentId` 的移动建议和理由。
- 扩展 candidate confirm/reject：确认移动建议时只更新 `parentId/children`，拒绝时只标记 candidate rejected。
- 新增 UI 入口：当存在 `unassigned-discoveries` 且有待整理子节点时，显示“AI 整理”按钮。
- 新增测试：覆盖 organizer prompt、移动安全校验、确认/拒绝、面板入口。

## 方案对比

| 方案 | 做法 | 优点 | 问题 | 结论 |
|---|---|---|---|---|
| A. AI 直接移动节点 | AI 输出后立即改 `parentId` | 交互少 | 误判会污染图谱，难追溯 | 不选 |
| B. 复用 Project Map generation worker | 把整理结果伪装成 map payload | 复用运行队列 | 协议混淆，整理 moves 与 map nodes 语义不同 | 不选 |
| C. 独立 organizer + candidate review | AI 只出 moves，确认后安全应用 | 语义清晰、风险低、可测试 | 需要补少量候选类型和 UI | 采用 |

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `project-xray-panel`: Project Knowledge Map SHALL provide a review-gated AI organizer for unassigned discoveries.
- `project-map-incremental-generation`: Project Map candidate confirmation SHALL support safe parent-move candidates without changing node content.

## Impact

- Affected frontend code:
  - `src/features/project-map/types.ts`
  - `src/features/project-map/utils/candidates.ts`
  - new organizer utility/service under `src/features/project-map/**`
  - `src/features/project-map/hooks/useProjectMapDataset.ts`
  - `src/features/project-map/components/ProjectMapPanel.tsx`
  - i18n locale part files
- Runtime:
  - Uses existing `engineSendMessageSync` with `accessMode: "read-only"`.
  - No Rust/backend command change.
- Dependencies:
  - No new dependency.

## 验收标准

- 当 `unassigned-discoveries` 存在直接子节点时，Project Map 提供 AI 整理入口。
- AI 整理生成 pending candidates，不直接修改节点父级。
- Candidate 确认后移动节点到建议父节点，并同步旧父/新父 `children`。
- Candidate 拒绝后不改变拓扑。
- 安全校验拒绝 missing parent、自挂、cycle、挂回 root、从非待整理父级移动等危险建议。
- Focused tests、`npm run typecheck`、OpenSpec strict validate 通过。
