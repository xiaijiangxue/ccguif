## Why

Project Knowledge Map 当前已经具备 `parentId` / `children` 数据结构，但自动生成、拓扑归一化和 overview 投影共同把过多任务、风险、artifact、workflow 节点直接挂到 root，导致地图退化成根节点星型白板。

现在修复的价值高于继续推进 Work Queue：如果地图本身没有层级，后续从地图派生任务只会继续放大“所有任务绑定根目录”的错位。

## 目标与边界

- 目标：让 root 只承担项目入口和结构域导航职责，任务/风险/测试/artifact/workflow 等发现项必须挂靠到最近的 module/capability/subsystem，无法可靠归属时进入待整理区。
- 目标：保持现有 `ProjectMapNode` 持久化数据向后兼容，不要求立即迁移历史 JSON schema。
- 目标：通过 prompt、merge topology、overview projection 三层一起收口，避免只修 UI 但数据继续污染。
- 边界：本变更只修 Project Map 层级和展示归属，不实现 Agent Work Queue、不新增任务调度中心。

## 非目标

- 不引入新的全局任务系统。
- 不把 OpenSpec/Trellis 或本机个人目录作为 Project Map 必需依赖。
- 不重写 Project Map 渲染器或替换当前 in-house graph layout。
- 不做历史数据批量迁移；旧数据通过加载/投影时的兼容归一化逐步恢复。

## What Changes

- 增加 Project Map 节点层级角色的推导规则，用现有 `nodeKind/title/detail/sources` 判断节点偏结构、能力、任务、风险、artifact、evidence 或 workflow。
- 修改自动生成 prompt，禁止 auto ingestion 把新 top-level concept 默认设为 root child；要求非结构发现项优先挂到最近结构节点。
- 修改 topology normalization：`attachOrphansToRoot` 不再一刀切；非结构 orphan 自动进入稳定的 `unassigned-discoveries` 待整理节点。
- 修改 overview 投影：默认 overview 聚焦 root + 结构 hub，不再把所有非结构 root child 直接铺到根节点周围。
- 增加回归测试，锁定 root child 语义和非结构 orphan 归属。

## 方案对比

| 方案 | 做法 | 优点 | 问题 | 结论 |
|---|---|---|---|---|
| A. 只改 layout | 继续保留所有 root child，只在 UI 上分组显示 | 改动小 | 数据语义仍错，后续任务派生继续污染 root | 不选 |
| B. 新增持久化字段 `nodeRole` | 修改 schema，让生成结果显式输出 role | 语义最清晰 | 需要迁移、prompt/schema/UI 联动较大，0.5.4 收口风险偏高 | 暂不选 |
| C. 先做派生 role + topology guard | 不改持久化 schema，用 helper 推导角色并约束 prompt/merge/projection | 兼容旧数据，能快速止血，测试可覆盖 | 推导不是完美分类，但足够稳定 | 采用 |

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `project-xray-panel`: Project Knowledge Map overview SHALL preserve project hierarchy and avoid presenting task/risk/artifact discoveries as root-level structural hubs.
- `project-map-incremental-generation`: Incremental merge and auto ingestion SHALL route non-structural orphan nodes away from root and into a triage container when no reliable parent exists.

## Impact

- Affected frontend code:
  - `src/features/project-map/utils/incrementalGeneration.ts`
  - `src/features/project-map/utils/interactiveLayout.ts`
  - `src/features/project-map/services/projectMapGenerationWorker.ts`
  - related Project Map Vitest suites
- Affected behavior:
  - Newly generated and normalized Project Map nodes will show stronger hierarchy.
  - Historical maps with many root children can be projected into a cleaner overview without destructive migration.
- Dependencies:
  - No new runtime dependency.

## 验收标准

- Auto ingestion prompt no longer instructs new top-level concepts to set `parentId` to root.
- Non-structural orphan nodes such as `bugfix`, `workflow`, `test module`, `artifact`, `risk` are not normalized as direct root children.
- Overview without focus shows root plus structural/capability hubs first; non-structural discoveries are hidden under their parent or under `unassigned-discoveries`.
- Focused node view still shows selected node, parent, children, and reverse parent context.
- Focused Vitest suites and `openspec validate stabilize-project-map-hierarchy --strict --no-interactive` pass.
