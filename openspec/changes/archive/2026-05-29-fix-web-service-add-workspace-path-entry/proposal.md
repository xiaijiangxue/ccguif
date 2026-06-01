## Why

Web service runtime 下的“添加工作区”入口当前依赖 Tauri desktop directory picker；而 Web shim 对 `plugin:dialog|*` 返回 `null`，导致用户点击添加后无法输入远端 daemon 可识别的 Linux/Unix 路径。

这会直接阻断远程 daemon 模式的首个工作区接入流程。底层 `add_workspace` RPC 已可接收路径并在 daemon 侧校验，因此本变更只补齐 Web/远程入口的路径输入链路，避免扩大到跨平台路径翻译或远程文件浏览器。

## 目标与边界

- 目标：Web service runtime 下允许用户手动输入远端工作区路径，并复用现有 `addWorkspaceFromPath` 导入链路。
- 目标：Desktop Tauri runtime 保持现有 directory picker 与打开模式分流行为。
- 目标：输入路径只做空白裁剪和空值保护，实际目录有效性继续由 daemon/runtime 的既有 `add_workspace` 校验负责。
- 边界：仅修复“添加工作区入口拿不到 path”的交互断链，不改变 workspace storage、engine session 创建、远程 daemon RPC 方法名或 payload 结构。

## 非目标

- 不实现 Web 版远程文件浏览器。
- 不实现 Windows/UNC 路径到 Linux 路径的自动转换。
- 不修改 daemon 的 `add_workspace`、`is_workspace_path_dir`、`ensure_workspace_path_dir` 协议。
- 不改变 desktop 端 `open({ directory: true })` 的选择器行为。
- 不新增依赖库。
- 不处理工作区分组、排序、session catalog 或 engine runtime 启动策略。

## What Changes

- 在“添加工作区”用户入口中增加 Web service runtime 分支：当运行于 Web service runtime 时，不调用本地 Tauri directory picker，而是展示手动路径输入入口。
- 手动输入得到的路径继续走既有 `handleAddWorkspaceFromPath(path)` / `addWorkspaceFromPath(path)`，从而复用当前去重、loading、错误提示和激活逻辑。
- Desktop runtime 继续走 `pickWorkspacePath()`，并保留 `加入当前窗口` / `新开窗口` 分流语义。
- Web service runtime 下的错误反馈继续使用现有 `failedToAddWorkspace` 与 runtime 返回错误，不新增并行错误通道。

## 技术方案选项

### 选项 A：在 frontend 添加 Web service 手动路径输入分支（推荐）

在 `handleAddWorkspace` 的入口处识别 Web service runtime；Web 模式下提示用户输入远端绝对路径，然后调用 `handleAddWorkspaceFromPath`。

取舍：改动面最小，复用现有 add/import 链路；不会把 daemon、workspace core 或 storage 协议卷入本次修复。缺点是体验是手动输入，不提供远程目录浏览。

### 选项 B：扩展 Web shim 的 `plugin:dialog|open` 为自定义输入 UI

在 Web service runtime shim 中拦截 Tauri dialog command，并模拟 directory picker 返回一个字符串路径。

取舍：调用方改动少，但会把“目录选择”和“文本输入”伪装成同一个 plugin contract，容易污染其它 file picker 调用，例如图片/文件选择。该方案过界，不采用。

### 选项 C：在 daemon 侧实现远程目录浏览 RPC

新增远程目录 listing/search RPC，让 Web UI 可以浏览 daemon 所在机器的文件系统。

取舍：体验最好，但涉及权限、安全、路径枚举、错误隔离和 UI 组件，明显超出 issue #638 的最小修复范围。本变更不采用。

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `workspace-open-mode-routing`: 补充 Web service runtime 下添加工作区必须提供手动远端路径输入，并复用当前窗口导入链路；desktop 打开模式分流保持不变。

## Impact

- 预计影响 frontend 添加工作区入口：`src/features/app/hooks/useWorkspaceActions.ts`。
- 可能影响 i18n 文案：`src/i18n/locales/en*.ts`、`src/i18n/locales/zh*.ts`，仅新增 Web 手动路径输入提示文案时涉及。
- 可能影响测试：`src/features/app/hooks/useWorkspaceActions.test.tsx`，覆盖 Web service runtime 下不调用 Tauri directory picker、能把用户输入 path 交给 `addWorkspaceFromPath`。
- 不影响 Rust daemon RPC、workspace core、storage schema、workspace settings schema 或 engine runtime payload。
- 无新增 npm/cargo dependency。

## 验收标准

- Web service runtime 下点击“添加工作区”时，用户可以输入 `/home/user/project` 这类远端路径，并触发现有添加工作区流程。
- Web service runtime 下取消输入、输入空字符串或纯空白时，不创建 workspace，也不显示误导性成功状态。
- Desktop Tauri runtime 下添加工作区仍使用目录选择器，并保留 `加入当前窗口` / `新开窗口` 分流。
- 远端路径不存在或不是目录时，错误仍来自 daemon/runtime 的既有校验，并通过当前添加失败提示展示。
- 不影响其它 picker：图片选择、普通文件选择、文件引用等仍保持原行为。
