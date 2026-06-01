## Context

`FileViewPanel` 负责主编辑区和 detached explorer 内的文件 tab 渲染。现有 `src/features/files/detachedFileExplorer.ts` 已提供 detached file explorer session contract。普通 detached explorer 入口可以继续 `openOrFocusDetachedFileExplorer()`；文件 tab 的独立打开入口使用新的 per-tab window instance，避免多个 tab 共享同一个窗口。

## Goals / Non-Goals

**Goals:**

- 在每个打开文件 tab 的关闭按钮旁新增“独立窗口打开”按钮。
- 按钮使用当前 tab path，而不是当前 active file path，确保可从非激活 tab 直接弹出。
- 复用现有 detached file explorer session、文件读取、tab 和外部变更感知逻辑。
- 文件 tab detached open 每次创建新的 detached window instance。
- 文件 tab detached open 的窗口默认收起左侧 file tree sidebar。

**Non-Goals:**

- 不新增 Tauri command、Rust backend、文件读取服务或持久化 schema。
- 不改变 detached explorer 内部的 tab 状态管理。
- 不改变 OpenAppMenu 的外部编辑器打开语义。

## Decisions

### Decision 1: 复用 detached file explorer 能力，但 tab open 使用多实例窗口

- 选择：在 `FileViewPanel` 内部构建 detached session，调用 `openNewDetachedFileExplorerWindow()`。
- 理由：现有 detached explorer 已处理 session、初始文件、workspace 文件树和外部变更监控；tab 入口的产品语义是“开一个新屏幕”，不是“切换同一个独立窗口”。
- 替代方案：新建 `DetachedSingleFileWindow`。该方案会复制文件预览、编辑、监听、错误处理与窗口恢复逻辑，当前需求不需要。
- 替代方案：继续调用 `openOrFocusDetachedFileExplorer()`。该方案只能复用一个固定 label 窗口，多次点击不同 tab 会互相覆盖，不满足多屏并排阅读。

### Decision 2: per-tab window 使用独立 label 与独立 session snapshot

- 选择：普通窗口继续使用 `file-explorer`；tab 打开的窗口使用 `file-explorer-<instance>` label，并按 label 写入独立 session snapshot。
- 理由：router 仍可按 prefix 识别窗口类型，session 不会被其他 detached window 的 `initialFilePath` 污染。
- 替代方案：所有窗口共用一个 storage key。该方案在多个窗口同时打开时会互相抢占恢复状态。

### Decision 3: 将入口放在 tab close 旁边

- 选择：在 `.fvp-tab` 中新增 icon button，与 `.fvp-tab-close` 同级。
- 理由：用户明确要求放在 `X` 旁边；事件上对按钮 `stopPropagation()`，不污染 tab 主按钮点击。
- 替代方案：放进右键菜单。该方案入口更隐蔽，不满足多屏阅读的高频操作诉求。

### Decision 4: tab detached window 默认收起 sidebar

- 选择：tab detached session 携带 `defaultSidebarCollapsed=true`，`FileExplorerWorkspace` 读取该初始偏好。
- 理由：从 tab 打开的窗口目标是阅读当前文件，左侧 file tree 会挤占多屏阅读空间。由于 per-window session 会异步恢复，`FileExplorerWorkspace` 需要在该 preference 到达后同步一次 sidebar state，而不能只依赖 `useState()` 首帧初始值。
- 替代方案：要求用户手动收起。该方案让每次多屏打开都多一步固定操作。

### Decision 5: tab detached window 复用原 detached menubar 拖拽 contract

- 选择：不把 `FileViewPanel` 文件 header 或 tab strip 做成窗口拖拽区；只复用 `DetachedFileExplorerWindow` 顶部 menubar 的 `data-tauri-drag-region` contract，并让 menubar 内层标题节点显式继承 drag region。
- 理由：原文件模块独立窗口的可拖拽区域就是 detached menubar。tab 打开的窗口应该与原窗口保持同一 chrome contract，避免把内容区 tab、关闭按钮、编辑区点击语义混入窗口移动语义。
- 关键修复：per-tab 窗口使用动态 label `file-explorer-*`，必须在 Tauri capability `windows` 中显式覆盖该 glob，否则动态窗口不会获得与固定 `file-explorer` 相同的 window permission，导致拖拽能力表现不一致。
- 替代方案：在文件 header 上监听 mouse down 并手动调用 native `startDragging()`。该方案会扩大窗口拖拽命中区，容易和 tab activate、detach icon、close button、编辑器点击发生交互冲突，最终不采用。

### Decision 6: 错误处理沿用 toast

- 选择：打开失败时使用 `pushErrorToast()`。
- 理由：detached window 创建失败属于用户可感知操作错误，需要明确反馈；不应静默失败。
- 替代方案：只 `console.error`。该方案不可见，不符合交互反馈要求。

## Risks / Trade-offs

- [Risk] 每个 tab 多一个按钮可能挤压窄 tab 标题 → Mitigation：按钮尺寸保持 20px，tab label 继续 ellipsis。
- [Risk] 多次点击 tab 会创建多个窗口 → Mitigation：仅 tab detached icon 使用多实例；普通 detached explorer 入口继续保持 open-or-focus。
- [Risk] 多窗口 session 恢复互相污染 → Mitigation：session snapshot key 带 window label。
- [Risk] 按钮事件误触发 close/activate → Mitigation：测试覆盖 open button 不调用 `onActivateTab` / `onCloseTab`。
- [Risk] 动态窗口 label 遗漏 Tauri capability → Mitigation：capability `windows` 包含 `file-explorer-*`，并用测试锁定该 contract。

## Migration Plan

- 部署：纯前端 UI 增量，无数据迁移。
- 回滚：移除新增 tab button、i18n 文案和 CSS 即可恢复原行为。

## Open Questions

- 无。
