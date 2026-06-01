## Context

当前“添加工作区”入口位于 frontend workspace action 链路：用户触发添加后，`handleAddWorkspace` 通过 `pickWorkspacePath()` 调用 Tauri directory picker 获取本机路径，再进入打开模式分流与 `handleAddWorkspaceFromPath`。

Web service runtime 的 daemon-side browser shim 对 `plugin:dialog|*` 返回 `null`，因此同一入口在 Web 版无法获得路径。与此同时，底层 `add_workspace` RPC 已支持接收 path 并在 daemon 侧校验目录有效性；问题不在 RPC，而在 Web runtime 缺少远端路径输入入口。

## Goals / Non-Goals

**Goals:**

- Web service runtime 下提供手动输入远端 workspace path 的入口。
- 输入 path 后复用现有 `handleAddWorkspaceFromPath` / `addWorkspaceFromPath` 导入链路。
- Desktop Tauri runtime 保持现有 directory picker 和 `加入当前窗口` / `新开窗口` 分流。
- 目录是否存在、是否为 folder 的最终判断继续由 daemon/runtime 侧负责。

**Non-Goals:**

- 不实现远程文件浏览器。
- 不实现 Windows/UNC 与 Linux path 的自动映射。
- 不修改 `add_workspace`、`is_workspace_path_dir`、`ensure_workspace_path_dir` RPC 协议。
- 不改变 workspace storage schema、engine runtime payload 或 session catalog。
- 不改变图片 picker、普通文件 picker 或其它 dialog plugin 语义。

## Decisions

### Decision 1: 在 frontend workspace action 边界做 runtime-aware 分流

推荐在 `handleAddWorkspace` 入口识别 Web service runtime。Web service runtime 下进入手动路径输入；desktop runtime 继续走 `pickWorkspacePath()`。

Alternatives considered:

- 修改 `pickWorkspacePath()` 自身，让它在 Web mode 下弹输入框。该方案会让 service helper 同时承担 UI 文案与交互职责，边界不如 action 层清晰。
- 修改 Web shim 的 `plugin:dialog|open`。该方案会污染所有 dialog 使用者，尤其图片/文件选择，风险过大。

Rationale:

- `useWorkspaceActions` 已负责“添加工作区”的用户流程、loading、错误提示、打开模式分流，是最窄且最语义化的切入点。
- runtime branch 保持在 frontend action 边界，不扩散到 workspace core 或 daemon。

### Decision 2: 手动路径提交后复用当前窗口导入链路

Web service runtime 下手动输入 path 后，直接调用 `handleAddWorkspaceFromPath(path)`。

Alternatives considered:

- Web service runtime 下继续询问“加入当前窗口 / 新开窗口”。该方案语义不稳，因为 Web service runtime 下新开 desktop window 不一定可用，且本修复目标是 unblock remote workspace registration。
- 直接调用 `addWorkspaceFromPath`，绕开 `handleAddWorkspaceFromPath`。该方案会丢失既有 loading/error handling 与 workspace-added 后处理。

Rationale:

- `handleAddWorkspaceFromPath` 已封装 loading dialog、error toast/debug、workspace added 后激活与 compact tab 切换。
- 复用该链路能减少行为分叉，避免 Web mode 出现第二套导入状态机。

### Decision 3: 不做 frontend 本地目录校验

Web service runtime 下，输入路径只做 trim 和空值保护；路径是否存在、是否为目录由 daemon 的既有 `add_workspace` 逻辑返回。

Alternatives considered:

- 调用 `isWorkspacePathDir` 预校验。该方案在 remote mode 下可行，但会增加一次 RPC，并可能与 `add_workspace` 的最终检查产生 race 或重复错误语义。
- frontend 以浏览器/客户端路径 API 做判断。该方案错误，因为目标路径属于 daemon 所在机器。

Rationale:

- `add_workspace` 已是最终写入前的权威校验点。
- 保持单一错误来源，减少本地/远端路径语义错位。

## Risks / Trade-offs

- [Risk] 手动输入体验弱于文件浏览器。→ Mitigation: 文案明确提示输入 daemon 所在机器的绝对路径；远程文件浏览器另立提案。
- [Risk] 使用 browser prompt 会受浏览器样式限制。→ Mitigation: 首版优先最小修复；若已有项目内 modal/input pattern，可在实现时使用现有 UI，但不得扩大功能范围。
- [Risk] Web mode 与 desktop mode 打开分流不完全一致。→ Mitigation: 规格明确 desktop 保持打开模式分流；Web mode 当前只要求导入当前 Web session，避免虚假的 new-window 承诺。
- [Risk] 错误信息仍可能是底层英文。→ Mitigation: 本变更复用现有失败提示外壳，后续如需精细化错误本地化另开变更。

## Migration Plan

1. 在 frontend 添加 Web service runtime 下的手动路径输入分支。
2. 保持 desktop runtime 原路径不变。
3. 增加 focused frontend tests，覆盖 Web runtime、取消/空输入、desktop runtime 仍调用 picker。
4. 不执行数据迁移，不修改 Rust storage 或 RPC schema。

Rollback strategy:

- 回滚 frontend runtime branch 即可恢复旧行为；daemon、storage、RPC 不涉及迁移或回滚。

## Open Questions

- 实现时优先使用浏览器 `prompt` 还是项目内已有 modal/input 组件？建议以最小修复为准，但若已有稳定通用输入组件，可复用以保持 UI 一致。
