## Context

mossx 的布局系统通过 `centerMode` 控制中间区域内容，通过右侧 `PanelTabs` 切换工作面板。现有 `MemoryPanel` 已证明“右侧入口触发中间大面板”的模式可行。

本变更保留这个交互模型，但产品定位从静态 Project X-Ray 调整为 Project Knowledge Map：一个 AI 生成、只读、可下钻、可持久化的当前项目知识地图。

## Goals / Non-Goals

**Goals:**

- 在右侧 toolbar 新增地球仪 icon，打开中间 Project Knowledge Map。
- 用 graph / mind map 展示项目认知层，不用文件树替代知识地图。
- 支持全局生成与节点级补全 / 校准。
- 所有生成都需要引擎、模型、范围、写入位置的二次确认。
- 将结果持久化到 `.ccgui/project-map/<project-name>-<short-hash>/`。
- 每个节点都必须保留 evidence、confidence、时间戳和来源 hash。
- 内容最简、事实优先、无证据不编造。

**Non-Goals:**

- 不支持人工编辑节点文本。
- 不做完整 IDE 索引器。
- 不默认后台全量扫描大型项目。
- 不把聊天内容无确认地写入磁盘。
- 不写入项目源码、OpenSpec、Trellis spec 或用户文档。

## Current Code Facts

2026-05-26 当前实现已完成 P0 visual shell、P1 本地 persistence substrate、runtime model selector、generation request queue 和 P2 app-session AI generation worker。它仍不是 native daemon 级后台生成服务：应用退出或 workspace 切换后不承诺继续执行。

当前代码事实：

- Entry / layout:
  - `src/features/layout/components/PanelTabs.tsx` 新增 `projectMap` tab，使用 lucide `Globe2`。
  - `src/features/layout/hooks/useLayoutNodes.tsx` 创建 `projectMapPanelNode`，点击 tab 后调用 `setCenterMode("projectMap")`。
  - `src/features/layout/components/DesktopLayout.tsx` 新增 `content-layer--project-map`，复用 center layer mutual-exclusion。
- Feature slice:
  - `src/features/project-map/types.ts` 定义 `ProjectMapProfile`、`ProjectMapLens`、`ProjectMapNode`、`ProjectMapManifest`、`ProjectMapAutoIngestionSettings`、`ProjectMapMemoryIngestionCursor` 等类型。
  - `src/features/project-map/services/projectMapPersistence.ts` 负责 persisted map 的 read / write / sanitize / serialize，并把 missing map 归一为空 dataset。
  - `src/features/project-map/hooks/useProjectMapDataset.ts` 编排 workspace identity、storage key、empty / persisted / error state、generation request、run queue、single active-slot worker lifecycle 和 auto ingestion substrate。
  - `src/features/project-map/hooks/useProjectMapGenerationOptions.ts` 从 runtime engine detection 与 model catalog 加载 engine / model selector 选项。
  - `src/features/project-map/services/projectMapGenerationWorker.ts` 收集 bounded workspace evidence，调用 selected engine / model，解析结构化 JSON，并返回可落盘的 ProjectMapDataset。
  - `src/features/project-map/mockProjectMapData.ts` 仅作为测试 fixture / controlled demo data；用户真实项目默认不从 mock 渲染知识。
  - `src/features/project-map/components/ProjectMapPanel.tsx` 渲染 topbar、collapsed lens shell、spider canvas、floating inspector、drilldown / drill-up controls。
  - `src/styles/project-map.css` 承载 Project Knowledge Map 视觉系统。
- Persistence boundary:
  - `src-tauri/src/project_map.rs` 提供 `project_map_read` 与 `project_map_write_snapshot`。
  - `project_map_read` 根据 workspace id 读取 `.ccgui/project-map/<project-name>-<short-hash>/` 中的 manifest、profile、lenses、nodes、settings、memory cursor、runs、candidates、evidence。
  - `project_map_write_snapshot` 只接受 allowlist 内 relative path，使用 workspace root + project-map root 做路径约束，并用 temp file + rename 写入。
  - storage key 由 project name + workspace identity short hash 派生，同名项目不会共享目录。
- UX decisions already reflected in code:
  - 无左侧 layer rail；总览和 lens drilldown 与中间幕布结合。
  - 顶部压缩为两行：title line + meta/action line。
  - Lens strip 默认折叠，展开后显示动态 detected / candidate lenses。
  - 总览是 spider overview；进入 lens 后只展示 focus node、parent 和 child context，降低节点重叠。
  - 节点右上角使用 icon-only 下钻 / 上钻按钮，保留 accessible button 语义但隐藏可见 button 背板。
  - Inspector 是右侧浮动面板，可折叠；点击节点会重新展开。
  - Refresh 旁边显示 Task button，打开后台任务抽屉，展示 active slot、queued runs、recent runs 和关闭面板后的持久化说明。
  - Confirm Generation dialog 的 engine / model 是 selector；model options 跟随 selected engine 刷新。
  - 用户点击确认后，UI 先 optimistic enqueue：关闭 modal、更新 Task count、显示 queue/drawer；落盘失败再把 run 标记为 failed。
  - Task drawer 去重展示：active slot 只显示当前 active run，queue 只显示等待项，recent 只显示 completed / failed / cancelled。
  - Queue pending run 支持取消；recent finished runs 支持清理。
  - Active run 展示 concrete phase、progress、thread id 和 latest log；pending 说明等待 active slot，running 说明正在执行 evidence / AI / validation / write 阶段。
- Worker execution:
  - 队列为单 active slot：已有 running run 时不再 claim 新 run；否则最早 pending run 被提升为 running。
  - Worker 通过 `list_workspace_files` / `read_workspace_file` 读取有限数量的文本证据，排除 `.git`、`node_modules`、build output、target、`.ccgui` 等重目录。
  - Worker 在调用任何 engine 前统一归一化 evidence packet：限制总 evidence prompt budget，按文件数量动态分配单文件预算，统一 CRLF / LF，并按段落、行、句子边界截断；Markdown 大文件会保留 headings digest，并用 `PROJECT_MAP_TRUNCATED` marker 显式标记压缩边界。
  - Worker 对 Codex 使用 app-server thread event stream 创建一次性 read-only thread，收集 `agentMessage` delta / snapshot / turn completion 后归档 thread，并把 thread id 写回 run metadata。
  - Worker 对 Claude、Gemini、OpenCode 等 sync engines 复用同一份归一化 prompt，通过现有 read-only synchronous engine message boundary 等待最终文本响应后再解析 ProjectMapDataset JSON。
  - AI 输出必须是纯 JSON，包含 `profile`、`lenses`、`nodes`；解析失败或没有有效 nodes 会让 run 进入 `failed`。
  - Global run 会替换 generated profile / lenses / nodes；node-scoped run 只合并目标节点、子树和目标下新增节点。
  - 写入前会更新 manifest、lensStats、sourceRootHash、evidenceRecords 和 node generatedBy。
- Tests:
  - `src/features/project-map/components/ProjectMapPanel.test.tsx` 覆盖 mock overview、lens drilldown、node selection、read-only inspector、detail collapse、drill icon、stale/candidate/confidence state、task drawer。
  - `src/features/project-map/hooks/useProjectMapDataset.test.tsx` 覆盖 workspace storage key stale-read guard、optimistic enqueue、persistence failure -> failed run。
  - `src/features/project-map/hooks/useProjectMapGenerationOptions.test.tsx` 覆盖 Codex workspace model catalog / config model 和 engine change model reload。
  - `src/features/project-map/services/projectMapGenerationWorker.test.ts` 覆盖 selected-engine dispatch、Codex thread-event collection、structured JSON parse、lens id path normalization、oversized Markdown evidence normalization 和 cross-engine prompt budget。
  - `src/features/project-map/services/projectMapPersistence.test.ts` 覆盖 read/write serialization 与 persistence mapping。

当前未实现事实：

- 当前 worker 是 app session 内执行，不是 Tauri native daemon；退出应用后 active run 不会继续在后台跑。
- Evidence gate 纯函数 substrate 已有；global dataset JSON validation 已接入，node patch 仍需更细的 deterministic claim validation。
- source hash stale detection 尚未接入真实项目扫描。
- backup path 约束已在 Rust allowlist 设计中保留，但一键 rebuild + backup UI 仍未完成。
- memory ingestion cursor 与 auto ingestion settings 已落地，但自动 AI 分析与 candidate review apply 尚未完成。

## Product Model

### Primary users

1. Active Developer：打开节点看关键链路、风险和影响面。
2. Architect / Lead：查看架构层、风险层和 timeline，判断知识是否过期。
3. Newcomer：从 overview 进入，逐步下钻到 files / symbols / specs / commits。

### Layout

```text
Project Knowledge Map
├── top bar
│   ├── project name
│   ├── last generated
│   ├── engine / model status
│   └── collect framework button
├── profile-driven lens strip
│   ├── Overview
│   ├── Business Capabilities
│   ├── Modules
│   ├── API Surface
│   ├── Data Model
│   ├── Runtime & Build
│   ├── Dependencies
│   ├── Tests & Quality
│   ├── Risk
│   └── Evidence
├── center graph canvas
├── right node inspector
└── bottom evidence / run log strip
```

节点点击后只展示详情、证据、关联文件、关联 symbol、关联 commit、校准动作和候选审核。任何文本都不可直接编辑。

### Information structure

Project Knowledge Map 的信息构成拆成六层，避免把所有内容塞进 graph 节点。顶层不再是固定 layer enum，而是先生成 Project Profile，再由 Lens Registry 决定当前项目该显示哪些视角。

1. Project Profile：语言、项目形态、框架、接口形态、构建系统和证据强度。
2. Lens：Overview / Business / Modules / API Surface / Data Model / Runtime & Build / Dependencies / Tests & Quality / Risk / Evidence 等动态视角。
3. Node：图谱中的最小定位单元，只显示标题和一句话摘要。
4. Detail：节点点击后的核心详情，展示可行动信息。
5. Evidence：支撑节点和详情的来源集合。
6. Run：一次 AI 生成 / 校准 / 自动补充的运行记录。
7. Memory Ingestion Cursor：项目记忆增量消费游标，记录哪些会话已用于补充地图。

节点详情面板采用固定结构：

```text
Node Detail
├── Core Description
├── Key Facts
├── Key Logic
├── Risk Signals
├── Related Artifacts
│   ├── files
│   ├── symbols
│   ├── specs
│   ├── commits
│   ├── tests
│   └── conversations
├── Confidence / Stale State
└── Generation Run
```

`Core Description` 必须短。`Key Facts` 只放可验证事实。`Key Logic` 只描述与当前节点直接相关的关键逻辑，不展开成教程。`Risk Signals` 只展示当前节点相关的真实风险，不做泛化评价。

### Product decisions

- 节点粒度：混合粒度。顶层节点偏模块 / 子系统，子层节点偏用户能力、核心流程、风险点和时间演化。
- 节点详情信息量：中等。包含描述、事实、关键逻辑、风险、证据；每项短句。
- 默认首屏：智能推荐。空地图 / 新项目展示 Overview；有 stale、候选、近期高活跃变更时展示 Risk / Evidence / 最近变化 lens。
- 候选审核：顶部 badge 显示全局候选数量，节点 inspector 显示与当前节点相关的候选。
- 自动补充通知：静默生成候选，只显示 badge，不弹阻塞确认框。
- processed marker：按 session id + message hash 记录，支持同一 session 后续新增消息被增量消费。
- 同名项目隔离：持久化目录使用 `<project-name>-<short-hash>`。
- 过期展示：节点变灰，confidence 降级，并提供手动校准入口。
- 一键重建：允许，但必须先备份当前地图。
- 证据优先级：code > spec > tests > commit > memory。
- 自动补充更新范围：可创建新节点，可更新匹配节点，不得修改无关节点。
- graph 渲染：首期使用轻量自研 SVG/HTML，不引入第三方 graph library。
- 平台兼容：graph 交互、Tauri 文件读写、`.ccgui/project-map/**` 路径处理必须兼容 Windows、macOS、Linux。
- 导出 / 分享：首期不做。

## Data Model

```typescript
type ProjectMapLensId = string

type ProjectMapLensStatus = "detected" | "candidate" | "notApplicable"

interface ProjectMapProfile {
  primaryLanguage: ProjectMapLanguage
  languages: ProjectMapLanguage[]
  shapes: ProjectMapProjectShape[]
  frameworks: ProjectMapDetectedFramework[]
  interfaceKinds: Array<"http" | "rpc" | "cli" | "library" | "event" | "native" | "unknown">
  buildSystems: string[]
}

interface ProjectMapLens {
  id: ProjectMapLensId
  title: string
  shortTitle: string
  description: string
  status: ProjectMapLensStatus
  confidence: "high" | "medium" | "low" | "unknown"
  evidence: ProjectMapSource[]
}

interface ProjectMapNode {
  id: string
  lensId: ProjectMapLensId
  nodeKind: "module" | "capability" | "api" | "data" | "dependency" | "quality" | "build" | "flow" | "risk" | "timeline" | "concept"
  title: string
  summary: string
  detail: ProjectMapNodeDetail
  parentId?: string
  children: string[]
  sources: ProjectMapSource[]
  confidence: "high" | "medium" | "low" | "unknown"
  stale: boolean
  lastGeneratedAt: string
  generatedBy: {
    engine: string
    model: string
    runId: string
  }
}

interface ProjectMapNodeDetail {
  coreDescription: string
  keyFacts: string[]
  keyLogic: string[]
  riskSignals: string[]
  relatedArtifacts: ProjectMapRelatedArtifact[]
}

interface ProjectMapRelatedArtifact {
  type: "file" | "symbol" | "spec" | "commit" | "test" | "conversation"
  label: string
  path?: string
  line?: number
  ref?: string
}

interface ProjectMapSource {
  type: "file" | "symbol" | "spec" | "commit" | "test" | "conversation"
  label: string
  path?: string
  line?: number
  hash?: string
  excerpt?: string
}
```

`summary` 必须短。复杂解释放到 detail，但 detail 也必须保持事实密度，不允许写成泛泛长文。

自动补充设置单独建模：

```typescript
interface ProjectMapAutoIngestionSettings {
  enabled: boolean
  engine: string
  model: string
  newSessionThreshold: number
  checkIntervalMinutes: number
  applyMode: "autoApplyEvidenceBacked" | "createCandidate"
}

interface ProjectMapMemoryIngestionCursor {
  lastCheckedAt: string
  processedMessages: ProjectMapProcessedMemoryMessage[]
  pendingMessages: ProjectMapProcessedMemoryMessage[]
  lastRunId?: string
}

interface ProjectMapProcessedMemoryMessage {
  sessionId: string
  messageHash: string
  processedAt?: string
  runId?: string
}
```

默认 `enabled = false`。用户开启后必须先选择 engine / model / threshold / applyMode。首期默认阈值为 5 个新项目记忆会话，默认 `applyMode = "createCandidate"`。

## Persistence

写入目录固定为：

```text
.ccgui/project-map/<project-name>-<short-hash>/
```

首期文件布局：

```text
manifest.json
profile.json
lenses/manifest.json
lenses/<lens-id>/nodes.json
candidates/<candidate-id>.json
backups/<backup-id>/
evidence/<run-id>.json
runs/<run-id>.json
settings.json
memory-ingestion/cursor.json
memory-ingestion/processed.json
```

`manifest.json` 记录：

- schemaVersion
- projectName
- workspacePath
- createdAt / updatedAt
- lastRunId
- lens stats
- source root hash
- memory ingestion stats
- storage key short hash

写入规则：

- 只写 `.ccgui/project-map/<project-name>-<short-hash>/**`。
- 使用临时文件 + rename 做原子写入。
- 失败时保留旧版本。
- 读取到 schemaVersion 不兼容时显示只读降级，不执行覆盖。
- 一键重建必须先将当前 manifest、profile、lenses、candidates、evidence、runs 复制到 `backups/<backup-id>/`。

## Generation Flow

全局生成：

```text
用户点击 collect framework
-> 选择 scope / engine / model
-> 展示将读取的来源和写入路径
-> 用户二次确认
-> 立即创建 run record 并进入 Task queue
-> confirmation dialog 关闭，Task button / task drawer 显示 active slot
-> 收集项目事实
-> 调用 AI 生成 ProjectMapNode patch
-> evidence gate 校验
-> 原子写入磁盘
-> 刷新 graph
```

当前实现已接入 app-session 级 active-slot worker：queued run 写入 `runs/latest.json` 后会被提升为 running，随后执行 bounded workspace evidence collection、read-only engine message 调用、结构化 ProjectMapDataset JSON 校验和 `.ccgui/project-map/**` 写入。当前仍不承诺 native daemon 级后台运行；应用退出或 workspace 切换后不会继续作为独立服务执行。

节点级校准：

```text
用户选择节点
-> 点击 complete/calibrate node
-> 选择 engine / model / scope
-> 二次确认
-> 立即创建 node-scoped run record 并进入 Task queue
-> 只读取该节点相关 sources + 邻接节点 + 必要项目事实
-> 生成 node/subtree patch
-> 校验 sources 与 confidence
-> 写入对应 lens 文件
```

多个 generation request 按 run startedAt 排队；UI 同时只展示一个 active slot。用户关闭 Project Knowledge Map 或切换页面，不应丢失已确认的 request record。

Task drawer 展示规则：

```text
Active Slot
-> generationQueue[0]
-> 显示 progress / phase copy

Queue
-> generationQueue.slice(1)
-> 允许取消 pending run

Recent Runs
-> completed / failed / cancelled
-> 允许清理 finished records
```

当前 active slot 的 pending run 只代表“已进入单执行槽，等待 worker claim”。worker claim 后必须进入 running phase，并展示 Preparing Sources / Asking AI / Validating / Writing / Completed / Failed 等阶段；若无法进入 running，必须转为 failed 或保留明确等待说明，不得显示为已开始真实 graph generation。

问答沉淀：

```text
项目问答产生可验证知识
-> AI 生成候选 ProjectMapNode patch
-> 用户确认保存
-> evidence gate 通过后写入
```

自动项目记忆补充：

```text
用户开启 auto ingestion 设置
-> 周期性检查项目记忆中的未处理会话
-> 未处理会话数量达到 threshold
-> 使用已配置 engine / model 创建增量分析 run
-> 只读取未处理会话 + 当前地图相关节点 + 必要 evidence
-> 生成 node/detail patch
-> evidence gate 校验
-> 默认写入 candidates，顶部 badge + 节点 inspector 提醒
-> 用户确认后写入 active lens
-> 成功消费的 session id + message hash 写入 processed marker
```

自动补充不得把已在 `processedMessages` 中的消息作为新输入。若某个自动 run 失败，不得标记 processed。自动补充可以创建新节点，也可以更新匹配节点，但不得修改无关节点。

一键重建：

```text
用户点击 rebuild map
-> 展示影响范围和 backup 路径
-> 用户二次确认
-> 创建 backups/<backup-id>/
-> 重新执行全局生成
-> evidence gate 校验
-> 原子替换 active lens
```

## Grounding Rules

- 每个确定性节点必须至少有一个 source。
- 每条 `keyFacts` 必须至少能追溯到 source；不能追溯的事实不得进入详情。
- `riskSignals` 必须来自实际 evidence，不允许凭感觉生成风险。
- 没有 source 的内容只能显示为 `unknown` 或 `needs evidence`。
- Evidence 优先级为 code > spec > tests > commit > memory；memory 不能单独支撑高 confidence 代码事实。
- AI 输出必须是结构化 patch，不直接拼 Markdown。
- 禁止泛化废话，例如“提高效率”“代码质量较好”。
- 优先短句：节点摘要建议不超过 120 个中文字符。
- 详情字段也要短：`coreDescription` 建议不超过 200 个中文字符，`keyFacts` / `keyLogic` 每条只表达一个事实或逻辑点。
- 引用文件内容时只保存必要 excerpt，不复制大段源码。
- 如果 evidence 与结论冲突，保留 evidence，降低 confidence 或拒绝写入。

## UI Decisions

### D1: `centerMode` 扩展

选择：新增 `"projectMap"` center mode。

理由：复用现有中间层互斥机制，避免创建独立窗口或 iframe。

### D2: 地球仪 icon

选择：使用 lucide 地球仪 icon，作为“项目全局地图”的视觉隐喻。

理由：比扫描 icon 更贴近知识地图和全局视图。

### D3: graph first, inspector second

选择：中心 graph 负责定位，右侧 inspector 负责事实。

理由：图谱用于探索，证据链用于信任。不能让图谱承担全部信息密度。

### D4: AI-only content

选择：不提供人工文本编辑。

理由：项目知识地图的价值在于可追踪生成与校准。如果允许人工随意改，会破坏 evidence / confidence 语义。

### D5: 本地持久化

选择：`.ccgui/project-map/<project-name>-<short-hash>/`。

理由：项目知识属于当前 workspace，跨会话可复用，但不污染源码目录主体。短 hash 防止同名项目互相污染。

### D6: 自动补充默认关闭

选择：项目记忆自动补充通过设置开启，默认关闭。

理由：自动 AI 分析会消耗模型资源并写入本地知识地图，必须由用户明确授权。开启后，配置本身就是周期触发的授权边界。

### D7: 自动补充默认候选模式

选择：自动补充默认使用 `createCandidate`，`autoApplyEvidenceBacked` 仅作为高级选项，默认关闭。

理由：项目记忆是间接知识源。即使 AI 分析通过 evidence gate，也应该先让用户看见候选补充，再决定是否写入地图。这样可以控制知识污染和信任成本。

### D8: 已处理记忆标记

选择：为自动补充维护 memory ingestion cursor 和 processed marker，粒度为 session id + message hash。

理由：项目记忆是持续增长的数据源。session id 粒度过粗，会漏掉同一会话后续新增消息；message hash 粒度能支持增量消费。

### D9: 智能首屏

选择：按状态选择默认视图，新项目 Overview，活跃项目优先 Risk / Evidence / 最近变化 lens。

理由：不同用户进入时的问题不同。空地图需要建立全局印象；活跃项目更需要知道哪里变化、哪里有风险。

### D10: 候选审核入口

选择：顶部 badge + 节点 inspector 双入口。

理由：全局 badge 负责提醒，节点局部列表负责低噪音审核。

### D11: 一键重建带备份

选择：支持 rebuild，但必须先写 backup。

理由：地图是知识资产。重建是高破坏性操作，不能无备份覆盖。

### D12: 自研轻量 graph 渲染

选择：首期使用自研 SVG/HTML graph，不引入专门 graph library。

理由：当前价值核心是可信知识数据、证据链和增量校准，不是复杂图编辑器。自研渲染能减少依赖、降低跨平台 webview 风险，并保持交互范围可控。

首期 graph 能力边界：

- 支持 lens 内节点布局。
- 支持一跳邻居聚焦。
- 支持节点选中、hover、stale/candidate/confidence 状态样式。
- 支持基本 pan / zoom 或滚动定位。
- 不支持自由拖拽编辑节点。
- 不支持复杂 force-directed 动画。

### D13: 三平台兼容

选择：Windows、macOS、Linux 都必须作为实现约束。

理由：Project Knowledge Map 涉及本地路径、文件写入和 webview 渲染。若路径拼接、atomic rename 或图谱事件依赖平台细节，会导致知识地图在某些平台不可用。

### D14: 队列 worker 以 final response 为准

选择：Project Map generation worker 通过现有 read-only synchronous engine message boundary 等待最终 AI 文本，再解析结构化 JSON。

理由：Project Map 是后台生成任务，不需要绑定可见会话流式 UI，也不应让 AI 子会话直接编辑项目文件。依赖 app-server stream events 容易在 React StrictMode、listener 时序或后台线程 id 重绑定时造成“看似排队但无最终结果”的状态。同步 engine boundary 仍然是 async Tauri 调用，UI 通过本地 heartbeat 和 persisted run progress 告知用户正在运行；真实写盘只发生在 JSON 校验通过之后。

### D15: StrictMode-safe active slot

选择：worker effect 不把普通 cleanup 当作任务取消；UI 更新按 current workspace id guard。

理由：React.StrictMode 会在开发环境故意重放 effect cleanup。若 cleanup 直接标记 worker cancelled，真实 worker 可能继续运行但 UI 永远停在 `queued`。workspace id guard 可以防止旧 workspace 的后台结果写回新 workspace，同时避免 StrictMode 误杀当前 active slot。

### D16: Optimistic active-slot claim

选择：确认生成后立即把本地 queued run 提升到可 claim 状态；worker 在第一笔持久化写入完成前先乐观更新 UI 为 `running / preparingSources`，再执行 `.ccgui/project-map/**` 写盘、evidence scan 和 AI generation。

理由：第一笔 queued persistence 是用户确认后的记录动作，不应该成为后台生成启动门槛。若文件系统、Tauri command 或 workspace lock 卡住，用户需要立刻看到 active slot 已被占用或失败，而不是永远停留在 `Queued`。Tauri command 侧也必须使用 async workspace lock，避免在 async command 中用 `blocking_lock()` 造成 runtime 阻塞风险。

### D17: Dynamic labels and node event isolation

选择：graph node 自身阻断 canvas pointer capture，并对动态 `nodeKind` / `source.type` 使用 locale-first、fallback-second 的展示策略。

理由：Project Map 内容来自 AI 结构化输出，不可能只依赖前端写死 enum。已知类型必须进入 zh/en locale，未知类型也必须格式化成人能读懂的 label，不能把 `projectMap.nodeKind.*` 暴露给用户。节点点击同时必须优先于幕布拖拽，否则用户点击 graph node 时 inspector 不更新，会破坏“图谱定位、右侧看事实”的核心交互。

### D18: Stable stage rows after first run

选择：Project Map stage 固定三行语义：Task banner 使用 row 1，lens shell 使用 row 2，graph / empty state 使用 row 3。

理由：Task banner 是可选内容。首次生成完成后 active run 消失，如果不固定 grid row，lens shell 会自动上移到 row 1，graph canvas 会落入 auto row，并被 `min-height: 0` 压缩为 0 高度，表现为“顶部有节点统计但幕布完全空白”。固定 row 能保证首次生成前、生成中、生成后都使用同一块弹性 graph 区域。

## Risks / Mitigations

| Risk | Mitigation |
| --- | --- |
| AI 幻觉 | evidence gate、confidence、unknown state、结构化 patch |
| 大项目生成过慢 | scope 选择、节点级生成、分层文件、运行日志 |
| 知识过期 | source hash、stale 标记、节点校准 |
| 本地写入误伤 | 写入目录白名单、原子写入、schemaVersion |
| 图谱过密 | 默认只展示当前层和一跳邻居，详情放 inspector |
| 用户误以为可编辑 | UI 只读，按钮语义为 generate / calibrate |
| 自动补充重复消费记忆 | memory ingestion cursor、processed marker、失败 run 不标记 processed |
| 自动补充产生低质量内容 | evidence gate、默认 createCandidate，autoApplyEvidenceBacked 默认关闭 |
| 同名项目污染 | `<project-name>-<short-hash>` 存储 key |
| 重建覆盖知识资产 | rebuild 前强制 backup |
| memory 支撑错误事实 | evidence priority 限制 memory 不能单独支撑高置信代码事实 |
| graph 依赖过重或跨平台不稳定 | 首期自研轻量 SVG/HTML graph |
| 平台路径差异导致读写失败 | 统一使用平台安全 path join / normalize，不手写分隔符 |
| dev StrictMode 让队列看似卡死 | worker cleanup 不取消当前任务，使用 workspace guard + regression test |
| 首次生成前没有 lenses 导致 queued run 读盘丢失 | persistence mapper 允许无 lenses dataset 恢复 runs |
| queued write 阻塞导致 worker 永远不启动 | optimistic active-slot claim，running / failed 状态先反馈到 UI，Rust command 使用 async lock |
