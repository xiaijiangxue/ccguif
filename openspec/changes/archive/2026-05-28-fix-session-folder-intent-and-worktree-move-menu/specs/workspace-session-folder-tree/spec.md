## MODIFIED Requirements

### Requirement: Sessions SHALL Be Movable Through Menu

系统 MUST 提供菜单或等价显式控件，使用户可以把 session 移动到同 project folder/root。该能力 MUST 覆盖 root list、folder list、worktree/child workspace list 等共享 strict project session surface；只要当前 project/workspace 有合法 folder/root move targets，行菜单就不得因为渲染路径不同而丢失移动入口。

#### Scenario: move session through menu
- **WHEN** 用户打开某条 session 的操作菜单并选择 `Move to folder`
- **THEN** 系统 MUST 通过右侧 flyout、submenu 或等价不会撑开主菜单的分层 UI 展示当前 project 内可选 folder/root
- **AND** 用户 MUST 能完成同 project session folder assignment

#### Scenario: menu move excludes other projects
- **WHEN** 用户通过 `Move to folder` 选择目标
- **THEN** 系统 MUST 只展示当前 project 的 folder/root
- **AND** MUST NOT 提供其它 project folder 作为可选目标

#### Scenario: worktree session row exposes move menu when targets exist
- **WHEN** 用户在 worktree 或 child workspace session row 上打开操作菜单
- **AND** 当前 worktree/project 存在合法 folder/root move targets
- **THEN** 系统 MUST 展示 `Move to folder` 或等价入口
- **AND** 该入口 MUST 使用该 worktree/project 的 move targets，而不是 parent 或 sibling project 的 targets
- **AND** 系统 MUST NOT 在缺少该 worktree/project targets 时静默回退到 parent workspace targets

#### Scenario: large folder target list remains searchable
- **WHEN** 当前 project 内 folder/root move target 数量超过可扫描阈值
- **THEN** 系统 SHOULD 在 `Move to folder` 的分层 UI 内提供搜索、过滤或等价快速定位入口
- **AND** 搜索入口 MUST NOT 替代分层 UI 内可见的 folder/root targets
- **AND** root target MUST 始终可见或可通过固定入口选择
- **AND** 搜索结果 MUST 仍只包含当前 project 的 folder/root

### Requirement: Folder Tree Assignment SHALL Preserve Projection Semantics

Folder tree assignment MUST 只改变组织层 metadata，不得扩大或缩小当前 project session projection 的 membership。对启动阶段只有 pending identity 的 session，UI MAY 暂存 folder intent；但 durable folder assignment MUST 等到真实 canonical session id 已知后写入。

#### Scenario: same-project menu move does not alter strict membership
- **WHEN** 用户在同一 project 内通过菜单移动 session 到 folder
- **THEN** strict project session membership MUST 保持不变
- **AND** 变化范围 MUST 仅限 folder assignment 和 UI 位置

#### Scenario: pending session folder intent waits for real identity
- **WHEN** 用户从 folder 或 child workspace 创建 engine session
- **AND** engine 先返回 pending session identity
- **THEN** 系统 MAY 在 UI 中保留该 pending session 的 folder intent
- **AND** MUST NOT 将 durable folder assignment 写入一个猜测出来的真实 session id

#### Scenario: pending folder intent migrates on identity transition
- **WHEN** 系统确认 `pendingSessionId` 已被真实 canonical session id 替换
- **AND** 该 pending session 存在 folder intent
- **THEN** 系统 MUST 将 folder intent 迁移到真实 canonical session id
- **AND** durable folder assignment MUST 使用真实 canonical session id 写入
- **AND** MUST NOT 把 intent 写入同 engine 的其它旧 session

#### Scenario: retryable assignment failure keeps pending intent
- **WHEN** pending folder intent 已经迁移到真实 canonical session id
- **AND** durable assignment 因 catalog-not-ready 或等价 retryable 原因失败
- **THEN** 系统 MUST 保留 pending intent 或等价 retry state
- **AND** MUST NOT 把 session 静默移动回 root

#### Scenario: non-retryable assignment failure is visible before intent cleanup
- **WHEN** pending folder intent 已经迁移到真实 canonical session id
- **AND** durable assignment 因 non-retryable 原因失败
- **THEN** 系统 MUST 保持或恢复可解释的本地 UI 状态
- **AND** MUST 向用户暴露失败
- **AND** 才能清理该 pending intent

#### Scenario: filtered and paged catalogs remain stable after folder move
- **WHEN** 当前 session catalog 存在 keyword、engine、status filter 或 cursor pagination
- **AND** 用户移动某条 session 到 folder
- **THEN** 系统 MUST 保持 filter/pagination 语义稳定
- **AND** MUST NOT 用当前可见窗口冒充完整 folder/project total
