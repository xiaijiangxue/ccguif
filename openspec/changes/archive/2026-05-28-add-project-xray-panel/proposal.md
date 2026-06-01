## Why

开发者在真实项目中最缺的不是文件入口，而是一个能快速回答“这个项目现在怎么工作、哪里在变化、哪里不能乱改”的项目认知层。

目标用户优先级为：

1. 正在开发的人：需要快速判断变更影响、关键链路、风险点。
2. 项目负责人 / 架构师：需要看到模块健康度、演化趋势、知识沉淀质量。
3. 新接手项目的人：需要快速 onboarding，建立项目全局地图。

现有右侧面板已有 git/files/search/notes/prompts/memory/activity/radar 等模式，但缺少一个面向“当前打开项目”的只读知识地图。新增 Project Knowledge Map，使项目结构、运行方式、架构分层、核心逻辑、风险、时间演化都能在一个可下钻视图中被 AI 生成、校准、持久化。

## What Changes

- 在右侧 `PanelTabs` 新增项目知识地图入口，使用地球仪类型 icon，点击后在中间区域展开大面板。
- 新增 `projectMap` center mode，复用现有中间区域互斥层机制。
- 新建 `src/features/project-map/` 模块，承载项目知识地图 UI、数据读取、生成编排、节点渲染与详情检查器。
- 项目知识地图以轻量自研 SVG/HTML graph 为主视图，不引入首期第三方 graph 依赖；数据模型按知识图谱组织，支持节点下钻。
- 节点采用混合粒度：顶层以模块 / 子系统为主，子层以用户能力、核心流程、风险点和时间演化为主。
- 节点内容可点击打开详情。详情不是长文档，而是结构化的核心描述、关键事实、关键逻辑、风险信号、关联文件 / symbol / spec / commit / test / conversation 与证据状态。
- 信息层级采用 Project Profile + dynamic Lens，不再写死 Spring / Web / 固定 layer：
  - Overview：项目画像、语言、框架、接口形态和主要风险入口。
  - Business Capabilities：业务能力或产品能力；无业务项目可标为 candidate / notApplicable。
  - Modules：source roots、namespace、package、target、feature slice。
  - API Surface：HTTP、RPC、CLI、library exports、native headers、event topics。
  - Data Model：DTO、schema、entity、message payload、config model。
  - Runtime & Build：启动、构建、测试、配置、native build system。
  - Dependencies：database、cache、queue、SDK、external service、native library。
  - Tests & Quality：unit、integration、contract、lint、typecheck、coverage。
  - Risk / Evidence：过期证据、候选知识、低置信节点和证据链。
- 面板提供整体框架数据收集按钮，用户可手动触发全局生成。
- 首屏采用智能推荐：新项目优先展示 Overview；已有活跃变更、候选或 stale 节点时优先展示 Risk + Timeline。
- 任意节点均可触发 AI 补全、修正、校准，仅更新该节点及其子树。
- 生成前必须选择引擎与模型，并展示范围、预计读取来源、写入位置，由用户二次确认。
- 内容不允许人工手动编辑。用户只能触发生成、补全、校准、刷新、查看证据。
- 生成数据持久化到当前项目磁盘目录：

```text
.ccgui/project-map/<project-name>-<short-hash>/
├── manifest.json
├── profile.json
├── lenses/
│   ├── manifest.json
│   └── <lens-id>/nodes.json
├── candidates/
├── backups/
├── evidence/
├── runs/
├── settings.json
└── memory-ingestion/
```

- 用户在项目问答过程中形成的可验证知识，可以由 AI 追加为候选知识，再经过同样的证据校验与写入流程沉淀到项目知识地图。
- 增加自动补充设置：用户可开启按周期分析项目记忆。当项目记忆中未处理的新会话达到配置阈值（默认 5 个）时，自动触发一次 AI 分析补充到知识地图。
- 自动补充默认采用 `createCandidate` 模式：AI 先生成候选补充，经过 evidence gate 后等待用户确认写入。`autoApplyEvidenceBacked` 仅作为高级选项，默认关闭。
- 自动补充完成后只显示候选 badge，不弹强打断确认框。
- 候选审核入口包括顶部全局 badge 与节点详情内的局部候选列表。
- 已被自动补充流程消费的项目记忆会按 session id + message hash 写入 processed marker；后续分析不得重复使用同一消息作为新输入。
- 支持一键重建地图，但重建前必须备份当前地图。
- 知识过期时节点变灰、confidence 降级，并提供手动校准入口。
- 所有 AI 生成内容必须遵守最简原则：短句、可验证、引用来源；没有证据则标记未知或不生成，不允许编造。

## Implementation Calibration

当前代码事实（2026-05-27）已经从 P0 UI shell 推进到 P2 app-session AI worker + Project Memory Auto Ingestion 队列阶段。Project Knowledge Map 已不再使用 runtime mock 作为默认数据源；确认生成或自动补充触发后会进入可见队列，由单 active slot worker 在当前 app session 内接管并推进。该 change 尚未达到 native durable worker / stale scan / rebuild backup UI / 三平台实机证据完整闭环。

已落地范围：

- `projectMap` center mode 已接入现有中间层互斥机制。
- 右侧 `PanelTabs` 已新增 Project Knowledge Map 地球仪入口。
- `src/features/project-map/` 已建立，包含类型、persistence service、dataset hook、generation request helpers、`ProjectMapPanel` 和 focused component / hook / persistence tests。
- 默认运行态会读取用户级 `~/.ccgui/project-map/<project-name>-<short-hash>/` 与项目内 `.ccgui/project-map/<project-name>-<short-hash>/` 两类 persisted dataset；当前新生成请求默认写用户级目录，用户可在 confirmation dialog 选择 project-local 写入。无 persisted map 时展示 empty state，不再展示 mock 项目知识。
- `mockProjectMapData` 仅保留为测试 fixture / controlled demo data，不再作为用户项目的事实源。
- graph 渲染为 profile-driven lens spider overview，不再使用固定左侧 layer rail。
- UI 已支持 lens strip 折叠、canvas pan/zoom、节点选择、hover、一跳聚焦、节点右上角下钻 / 上钻 icon、浮动 inspector 折叠、canvas controls 默认折叠并以 local UI preference 记忆用户显式折叠态。
- dataset schema 覆盖混合语言 / 混合项目形态场景：Business、Modules、API Surface、Data Model、Runtime & Build、Dependencies、Tests & Quality、Risk、Evidence。
- 用户可见文案已接入 `zh.part5.ts` / `en.part5.ts`，中文场景保留 English technical terms。
- Tauri 已新增 `project_map_read` / `project_map_write_snapshot`，按 workspace identity 派生 storage key，并约束写入在所选 storage root 的 `project-map/<project-name>-<short-hash>/**` 下；project-local 模式对应工作区内 `.ccgui/project-map/<project-name>-<short-hash>/**`。
- 前端 persistence service 已实现 manifest、profile、lenses、lens nodes、settings、memory cursor、runs、candidates、evidence 的读写与 sanitize。
- Collect / Refresh / node completion / calibration 已接入同一 generation confirmation dialog。
- generation confirmation 已从 runtime engine / model catalog 加载可选项，不再要求用户手写 `default`。
- 用户确认生成后，当前实现会先尝试持久化 queued run record；持久化成功后关闭 confirmation dialog、更新 Task 队列，随后 Project Map worker 会把 active run 从 `pending` 推进为 `running`，按阶段执行 evidence collection、AI generation、structured JSON parsing / normalization 和 project-map persistence。
- Project Map worker 在所有 engine dispatch 前统一归一化 evidence packet：限制总 evidence prompt budget，按文件数量动态分配单文件预算，统一 CRLF / LF，并按段落、行、句子边界截断；Markdown 大文件会保留 headings digest，并用 `PROJECT_MAP_TRUNCATED` marker 标记压缩边界。
- Codex generation 走一次性 read-only app-server thread event stream，收集 `agentMessage` delta / snapshot / turn completion，并把 thread id 写回 run metadata；Claude、Gemini、OpenCode 复用同一份归一化 prompt 走现有 read-only synchronous engine message boundary。
- Task button 位于 Refresh 旁边，展示 active / queued / recent runs；多个生成请求形成队列，同时只有一个 active slot。
- Task drawer 已去重：active run 不再重复出现在 queue / recent；queue 只显示等待项，recent 只显示 completed / failed / cancelled。
- Queue 中的 pending run 可取消，取消后变为 `cancelled` 并进入 recent；recent 支持清理 completed / failed / cancelled，不影响 active slot 或 pending queue。
- Active slot 展示 phase、progress、thread id、latest log 和错误信息；用户可感知当前处于 Preparing Sources / Asking AI / Validating / Writing / Completed / Failed 哪个阶段。
- 当前 worker 是前端会话级 worker：ProjectMapPanel 在中心层隐藏时仍保持挂载并继续执行；应用退出、workspace 切换或窗口卸载后不作为 daemon 继续运行。
- Project Memory Auto Ingestion 已从 settings-only substrate 接入真实 Project Map generation queue：启用前必须选择 engine/model；调度尊重 `checkIntervalMinutes`、`memoryCursor.lastCheckedAt`、threshold 与 pending/running auto-run 去重；auto run 会携带 Project Memory evidence 进入同一 worker prompt / active-slot 生命周期；成功后才写 processed marker，失败或取消不消费消息。
- Auto Ingestion 默认保持 `createCandidate` conservative semantics；`autoApplyEvidenceBacked` 不再是伪开关，仍会创建真实 auto run，但 weak / memory-only claims 仍保留 candidate。
- 自动补充和普通生成的 AI structured output 保持 strict JSON validation，并在首次 prose / malformed JSON 失败后仅执行一次同 engine/model 的 JSON-only repair turn；repair 仍失败时 run 保持 failed，不写半成品地图。
- Auto-generated nodes 已通过 merge/read normalization 保持单 root-reachable topology；AI payload 可以引用既有 root parent，即使 payload 未重复 root 节点，持久化 orphan roots 也会在读取时修复到项目 root。
- 候选审核入口已落地：全局 candidate badge 可定位候选节点；inspector 对 pending candidate 提供 confirm/reject；confirm 需通过 evidence gate，失败时不修改 active map。
- 节点 diagram artifacts 已落地：AI 可为适合图解的节点生成 Mermaid Markdown sidecar，写入 Project Map `diagrams/` allowlist 路径，并通过既有文件预览链路打开。

尚未落地范围：

- 未实现 native daemon 级 Project Map worker；当前只保证 app session 内单 active slot 顺序执行。
- structured patch validation substrate 已有；当前 global run 已接入完整 dataset JSON 生成 / parse / normalize / 写入，node-scoped run 已限定为目标节点与子树合并路径，后续仍需更细粒度 patch schema 与 deterministic claim validation。
- `markStaleNodesBySourceHash` substrate 已有，但 source hash stale detection 仍未接入真实项目扫描与自动刷新链路。
- Rust `create_backup` substrate 已有，但一键 rebuild + backup UI 仍未完成。
- 自动补充 review 的主链路已接入真实 queue、candidate-safe merge、processed marker 与 candidate confirm/reject；仍缺 native daemon continuation 与跨 app-session durable worker。
- 未完成 Windows / macOS / Linux 实机 graph + persistence 证据；当前只有 focused Vitest、Rust unit tests、OpenSpec validation 与本地代码层 smoke。

因此，本 change 当前状态应理解为：P0 visual shell complete，P1 persistence + request queue complete，P2 app-session AI worker + auto-ingestion queue complete；native durable worker、真实 stale scan、rebuild backup UI、三平台手工证据仍 pending。

## Goals

- 让开发者在一个面板内快速理解当前项目的关键结构、关键链路和风险点。
- 让架构师能看到项目知识随时间增长、过期、校准的状态。
- 让新成员可从 Overview 下钻到代码、spec、commit、测试，而不是读一堆散文件。
- 用 AI 生成知识，但用 evidence、confidence、source hash 约束输出可信度。
- 将项目知识持久化在项目本地 `.ccgui/project-map/<project-name>-<short-hash>/`，支持跨会话复用。
- 让节点详情承载“可行动的核心信息”，避免图谱节点膨胀成文档。
- 支持从项目记忆增量补充地图，同时避免重复消费已处理记忆。

## Non-Goals

- 不做人工编辑器。
- 不把 AI 结论直接当事实；无证据内容不得作为确定性节点展示。
- 不做完整代码索引器、完整 AST call graph 或 IDE 替代品。
- 不自动改业务代码、spec、测试或项目配置。
- 不在未开启自动补充设置时后台消费项目记忆。
- 不做跨项目对比。
- 首期不做导出 / 分享。
- 不引入远程集中存储；首期只写当前项目本地磁盘。

## Capabilities

### New Capabilities

- `project-xray-panel`: 以 Project Knowledge Map 形态展示当前项目的只读知识地图，支持全局 AI 生成、节点级补全校准、证据下钻和本地持久化。

### Modified Capabilities

- （无）现有 panel / memory / radar 能力不改变，只新增独立入口与中间层。

## Impact

- Affected UI surface
  - 右侧 `PanelTabs` 工具栏新增项目知识地图 icon。
  - 中间区域新增 Project Knowledge Map 全屏层。
  - 新增生成确认弹窗、节点详情检查器、证据列表、运行记录视图。
- Affected code areas
  - `src/features/layout/components/PanelTabs.tsx`
  - `src/features/layout/hooks/useLayoutNodes.tsx`
  - `src/features/layout/components/DesktopLayout.tsx`
  - `src/app-shell-parts/useAppShellLayoutNodesSection.tsx`
  - `src/features/project-map/**`
  - `src/services/tauri/**` 或等价 IPC boundary
  - `src/i18n/locales/zh.part5.ts`
  - `src/i18n/locales/en.part5.ts`
  - `src/styles/project-map.css`
  - `src-tauri/**` 中用于读取项目事实、写入 `.ccgui/project-map/**` 的命令
- Dependencies
  - 复用现有 UI、模型选择、Tauri IPC、文件系统、git 工具链。
  - 图标使用已安装的 lucide 地球仪 icon。
  - 首期不新增第三方 graph 依赖；如果现有组件无法满足可读性，再单独评估。
- Risks
  - AI 幻觉：通过 evidence gate、confidence、source list、未知态约束。
  - 大项目过载：通过全局 / 节点级范围选择、分层写入、增量生成缓解。
  - 知识过期：通过 source hash、lastGeneratedAt、stale 标记和节点校准缓解。
  - 本地写入误伤：仅允许写 `.ccgui/project-map/<project-name>-<short-hash>/**`，并使用原子写入。

## Acceptance Criteria

- 右侧工具栏出现项目知识地图地球仪 icon，tooltip 支持中英文。
- 点击 icon 后，中间区域打开 Project Knowledge Map 大面板，其他中心层进入互斥禁用状态。
- 首次打开空项目知识地图时，展示全局生成按钮与说明，不展示伪造内容。
- 首屏按项目状态智能选择 Overview 或 Risk + Timeline。
- 点击全局生成按钮后，系统要求选择引擎、模型、生成范围，并在二次确认后才开始。
- 点击任意节点后，详情面板展示核心描述、关键事实、关键逻辑、风险信号、证据来源、confidence、stale 状态和生成信息。
- 点击任意 graph node 必须立即切换右侧 inspector 到该节点；canvas pan / zoom pointer handling 不得吞掉节点选择。
- AI 生成的扩展 `nodeKind` / `source.type` 不得显示为 `projectMap.*` 原始 i18n key；已知类型走 zh/en 文案，未知类型走可读 fallback。
- 任意节点详情区提供“补全 / 校准此节点”操作，确认后只更新该节点及其子树。
- 生成结果写入 `.ccgui/project-map/<project-name>-<short-hash>/profile.json`、`lenses/<lens-id>/nodes.json` 等 project-map 文件，并更新 `manifest.json`。
- 节点内容为只读，界面不提供文本编辑入口。
- 每个非空节点至少包含：简短摘要、所属层级、sources、confidence、lastGeneratedAt。
- 证据优先级为 code > spec > tests > commit > memory。
- 没有证据的结论不得以确定事实展示；必须显示 unknown / needs evidence / low confidence。
- 用户问答中形成的项目知识可被 AI 捕获为候选，并在确认与校验后写入对应节点；当前已具备 candidate confirm/reject 与 evidence gate，conversation → candidate 自动捕获仍需后续专门 change 接线。
- 开启自动补充后，项目记忆中达到阈值的新会话会触发分析；成功补充后对应 session id + message hash 被标记为 processed，后续不重复消费。
- 自动补充默认只创建候选，不直接写入地图；用户确认后才持久化。
- 自动补充可以通过真实 auto run 创建或更新 candidate-safe 节点，并通过 topology normalization 保持 root 可达；不得修改无关节点。
- [待实现] 一键重建地图必须先创建 backup，再写入新地图（当前仅有 rust backup substrate，尚未有前端触发入口）。
- P0 mock `ProjectMapDataset` 仅允许作为测试 fixture；真实项目默认从 `.ccgui/project-map/<project-name>-<short-hash>/` 恢复已有地图，无数据时展示空态。
- 首次生成完成且 Task banner 消失后，graph canvas 必须仍占据中心幕布的弹性区域，节点、连线、zoom controls 和 inspector 不得因 grid row 重排而高度为 0。
- 确认生成请求后，UI 必须立即显示 queued run / Task count；不得把用户锁在 confirmation dialog 等待持久化或后台 worker。
- 多个生成请求必须形成可见队列；同一时间只允许一个 active slot，其余请求保持 pending。
- Active / Queue / Recent 必须去重展示，同一 run 不得在 task drawer 中重复出现。
- Queue 中 pending run 必须支持取消；Recent 必须支持清理 completed / failed / cancelled 记录，但不得清理 active / pending run。
- Active run 必须展示真实阶段、进度、thread id 或 latest log；若仍处于 pending，则必须说明正在等待 active slot，不得误导用户以为已经进入 AI generation。
- generation dialog 必须按当前 workspace 的 runtime engine / model catalog 提供选择；不得静默回退为不可选择的 `default` 文本输入。
- 确认生成后，app session 内 worker 必须使用用户选择的 engine / model 读取 normalized bounded workspace evidence；Codex 使用 read-only thread event stream，Claude / Gemini / OpenCode 使用 read-only synchronous engine message boundary，生成结构化 ProjectMapDataset JSON，校验后写入 `.ccgui/project-map/<project-name>-<short-hash>/**`。
- AI 输出不是合法 JSON 或没有有效 nodes 时，run 必须标记为 `failed`，不得写入半成品地图。
- 用户切换中心面板或关闭 Task drawer 时，当前 app session 内的 active run 继续执行；退出应用或切换 workspace 不承诺 daemon 继续运行。
- 开发环境 React StrictMode 的 effect cleanup 不得让 active run 永久停留在 `queued`；worker UI 更新必须按 current workspace id 做防串线。
- 首次生成前只有 queued / running run 而没有 lenses 的持久化目录，仍必须能恢复 run records 并继续进入 active slot。
- 确认生成后，active-slot worker 启动不得依赖第一笔 queued persistence write 完成；UI 必须先进入 running / preparing state，并在 persistence 或 worker 失败时进入 failed。
- Tauri `project_map_read` / `project_map_write_snapshot` 必须使用 async workspace lock，不得在 async command 中调用 `blocking_lock()`。
- graph 渲染与 `.ccgui/project-map/**` 持久化必须兼容 Windows、macOS、Linux，路径拼接不得写死平台分隔符。
- TypeScript、lint、关键组件测试通过。
