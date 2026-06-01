## Why

用户在主编辑区打开多个文件后，缺少从单个 tab 直接弹出独立文件窗口的入口；多屏阅读文档时必须回到文件树或切换 surface，操作链路过长。

## 目标与边界

- 在已打开文件 tab 的关闭按钮旁提供独立窗口打开入口。
- 独立窗口打开入口必须使用醒目的主题适配色，避免与灰色关闭按钮混淆，并保持点击行为不变。
- 点击文件 tab 入口后创建一个新的 detached file explorer 窗口，并定位到该 tab 对应文件。
- tab 入口打开的 detached file explorer 默认收起左侧 file tree sidebar，优先保留阅读空间。
- 保持现有 tab 激活、关闭、文件读取、编辑与 detached explorer 逻辑不变。

## 非目标

- 不新增第二套文件窗口系统。
- 不改变文件 tab 的打开、排序、关闭、最大化语义。
- 不改文件树、Activity Panel、Spec Hub 或外部 app 打开菜单。

## What Changes

- 文件 tab 在关闭按钮旁新增一个 icon button，用于在独立文件窗口打开该文件。
- 该按钮复用既有 detached file explorer session contract，传入当前 workspace、`initialFilePath` 与 tab-open window preference。
- tab 入口使用 `file-explorer-*` 动态窗口 label，并为每个窗口写入独立 session snapshot，避免多个独立屏互相覆盖。
- Tauri capability 覆盖 `file-explorer-*` 动态窗口，使 tab 打开的独立窗口与原 `file-explorer` 窗口拥有一致的 window permission 和拖拽能力。
- detached file explorer 顶部 menubar 继续作为唯一窗口拖拽 chrome，menubar 内层标题文案显式继承 `data-tauri-drag-region`，避免文字区域阻断拖拽。
- 为按钮补充 i18n、可访问名称和聚焦/hover 样式。

## 技术方案对比

| 方案 | 优点 | 缺点 | 结论 |
|---|---|---|---|
| 多实例 detached file explorer | 复用现有文件读取、tab、外部变更感知，同时允许多屏并排 | 需要 window label / session snapshot 按实例隔离 | 采用 |
| 复用单个 detached file explorer | 实现简单、窗口数量少 | 多次点击不同 tab 会互相覆盖，无法满足多屏阅读 | 不采用 |
| 新建单文件 detached viewer | 可做极简单文件窗口 | 会复制文件读取、编辑、监听和窗口生命周期逻辑 | 不采用 |

## Capabilities

### New Capabilities

### Modified Capabilities

- `session-activity-file-open-affordances`: 扩展文件打开 affordance，要求已打开文件 tab 可直接在新的 detached file explorer 实例中打开对应文件。

## Impact

- 前端：`FileViewPanel` 文件 tab 渲染、文件 tab 样式、i18n 文案、focused Vitest。
- Tauri capability：将动态 `file-explorer-*` window label 纳入现有权限范围；无新增 Rust command，无新依赖。

## 验收标准

- 点击 tab 上新增 icon 后，新建独立文件窗口实例，并打开该 tab 对应文件。
- 新建独立文件窗口实例默认收起左侧 sidebar。
- tab 打开的独立窗口可以从顶部 menubar 正常拖拽移动，行为与原文件模块独立窗口一致。
- 点击新增 icon 不触发 tab 激活或关闭。
- 现有关闭 `X`、tab 主点击、双击最大化行为保持不变。

## 验收结果

- 已验收通过：tab icon 打开的独立窗口可正常拖拽移动。
- 已验收通过：tab icon 每次创建新的 detached file explorer 实例，不复用既有 tab detached window。
- 2026-06-01 补记：tab detached icon 已强化为 accent-based 高可见样式，适配 light/dark 主题且不改变 tab 激活、关闭或 detached open 行为。
- 已验收通过：tab icon 打开的独立窗口默认收起左侧 file tree sidebar。
