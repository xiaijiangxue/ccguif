## Context

邮件会话 tab 现在已经能从本地 email ledger 聚合 Moss 相关邮件事件，并提供 `查看邮件` 与 `打开会话` 两类入口。问题集中在管理面：

- `查看邮件` 的详情渲染在列表底部，内容多时用户很难感知点击是否生效。
- `刷新会话` 与 `清理已处理记录` 缺少按钮执行态、成功态和失败态，表现像“点不了”。
- 用户需要删除列表中的邮件信息，但明确不能删除真实会话、thread、workspace、turn 或 runtime session。

现有实现已经有可复用边界：

- Frontend 通过 `src/services/tauri.ts` typed bridge 调用后端，不应新增 feature 内直接 `invoke()`。
- Backend 的 `src-tauri/src/email/session_continuation.rs` 已有本地 ledger、session projection 与 `mutate_mail_session()` action 分发。
- `EmailSessionLedger` 将 `outgoing`、`commands`、`sessions` 分开存储，因此可以精确删除邮件事件记录，同时保留 session control/state。

当前 OpenSpec 主规格中存在 `email-sending-settings` 与 `conversation-completion-email-notification`。邮件会话列表管理是独立于 completion email 的本地 ledger 管理边界，因此 specs artifact 将新增 `email-mail-session-management` capability，并让 `email-sending-settings` 只承接 Settings UI surface。

## Goals / Non-Goals

**Goals:**

- 让 `查看邮件` 的反馈出现在用户当前视野附近，而不是列表底部。
- 给当前查看的会话行增加选中态，并提供可关闭、可内部滚动的邮件详情面板。
- 让 `刷新会话` 与 `清理已处理记录` 都有 loading、success、error 反馈。
- 增加单行 `删除邮件信息` 操作，只删除该 `sessionId` 对应的本地邮件 ledger 事件。
- 保持 `打开会话`、邮件发送配置、收信监听、completion email 与 mail-driven continuation 主链路不回退。

**Non-Goals:**

- 不做通用邮件客户端。
- 不删除远端邮箱邮件，不执行 IMAP delete/archive/mark-read。
- 不删除真实 conversation/thread/workspace/runtime session。
- 不重写邮件发送、收信解析、dedupe、reply token 或 signature 逻辑。
- 不新增独立邮件管理页面或全局路由。

## Decisions

### Decision 1: `查看邮件` 使用列表上方详情面板

采用当前 tab 内的顶部详情面板：点击行内 `查看邮件` 后，在操作区与会话列表之间展示详情。

理由：

- 解决“点了但反馈在最底下看不到”的核心 UX 断点。
- 不引入新页面、抽屉或跨路由状态。
- 详情面板可以限制 `max-height` 并启用内部滚动，避免事件多时把列表整体向下推到不可见位置。

替代方案：

- 独立邮件管理页面：承载能力更强，但超出当前需求。
- 右侧抽屉：可见性好，但会引入新的 overlay/focus/escape 交互与响应式适配成本。

### Decision 2: 刷新、清理、删除使用局部 operation state

在 `EmailSenderSettings` 内维护邮件会话操作状态，例如：

- `refreshingMailSessions`
- `cleaningMailSessions`
- `deletingMailSessionId`
- `mailSessionNotice`

理由：

- 三类动作互相独立，局部状态足以表达 UX。
- 不需要引入全局 store 或新 abstraction。
- 能精确禁用当前执行中的按钮，避免重复点击造成用户误判。

替代方案：

- 共用一个全局 loading：实现简单，但无法表达“哪一行正在删除”。
- 新建自定义 hook：目前逻辑仍局限在 settings section，先保持组件内收敛，等复用需求出现再抽取。

### Decision 3: 删除邮件信息扩展现有 `mutate_email_mail_session`

新增一个明确 action，例如 `delete_mail_records`，继续走现有 typed bridge 与后端 `mutate_mail_session()`。

后端语义：

- 输入必须包含目标 `sessionId`。
- 从 ledger 的 `outgoing` 中删除匹配该 `session_id` 的记录。
- 从 ledger 的 `commands` 中删除匹配该 `session_id` 的 inbound command 记录。
- 不删除 ledger 的 `sessions` control/state 记录。
- 不触碰任何 conversation/thread/workspace/runtime session 存储。
- mutation 后保存 ledger，并返回刷新后的 projection。

理由：

- 复用既有 command 边界，避免平行 IPC 路径。
- 删除边界能在后端 contract 上固定，前端文案不能成为唯一保护。
- `outgoing` / `commands` / `sessions` 的现有数据结构天然支持 scoped deletion。

替代方案：

- 前端只隐藏列表项：不是删除，刷新后会回来。
- 复用 `cleanup`：语义不清，会把“清理已处理记录”和“删除单个 session 邮件信息”混在一起。
- 新增 Tauri command：当前没有必要，增加 API surface。

### Decision 4: `清理已处理记录` 保持全局 cleanup 语义

`清理已处理记录` 继续清理已完成、重复、过期或忽略的 command 记录；它不是“清空列表”，也不删除 outgoing 邮件记录。

理由：

- 避免“清空”误导用户以为会删除全部邮件会话。
- 保持已有 backend cleanup 行为，不扩大破坏范围。
- 单行删除由新的 `删除邮件信息` 承担。

### Decision 5: 详情删除后的 UI 状态立即收敛

删除当前正在查看的 session 邮件信息后，前端应关闭详情面板并刷新列表。

理由：

- 被删除的邮件事件不应继续展示旧详情，避免“删除了但还在”的错觉。
- 若后端 projection 仍有控制态但没有邮件事件，列表是否保留由现有 projection 规则决定；前端不额外伪造记录。

## Implementation Sketch

1. Frontend type contract
   - 在 `MutateMailSessionRequest.action` 中加入 `delete_mail_records`。
   - 保持 `mutateEmailMailSession()` typed bridge 作为唯一 UI 调用入口。

2. Backend ledger mutation
   - 在 `mutate_mail_session()` action match 中加入 `delete_mail_records`。
   - 校验 `session_id` 必填。
   - `retain` 删除 matching outgoing records 与 inbound command records。
   - 保留 `ledger.sessions`。
   - 添加 focused Rust test 证明 session control 未被删除。

3. Frontend interaction
   - `查看邮件` 只设置 `selectedSessionId`，详情渲染移动到列表上方。
   - 当前行根据 `selectedSessionId` 增加 selected class / aria state。
   - 详情面板包含标题、关闭按钮、内部滚动容器。
   - `刷新会话` 包装 `refreshMailSessions()`，展示 loading 与结果 notice。
   - `清理已处理记录` 包装 `cleanup` action，展示 loading 与结果 notice。
   - `删除邮件信息` 调用新 action；成功后刷新列表，必要时关闭详情。

4. Styling
   - 在现有 settings CSS 范围内补充邮件会话详情面板、选中行、行内危险按钮与 notice 样式。
   - 不改变 settings tab 的整体布局与其他 tab 样式。

5. Tests
   - Vitest 覆盖刷新、清理、查看详情位置/关闭/选中态、删除 action payload。
   - Rust test 覆盖 delete action 只删除 `outgoing` 与 `commands`，保留 `sessions`。

## Risks / Trade-offs

- [Risk] action 命名不清导致误用 → Mitigation: 使用 `delete_mail_records` 这类窄语义名称，避免 `delete_session`。
- [Risk] 用户把 `清理已处理记录` 理解为清空全部邮件 → Mitigation: UI 文案保持“清理已处理记录”，单行删除文案明确“只删除邮件信息”。
- [Risk] 详情面板占用过高导致列表可见区域变小 → Mitigation: 给详情内容设置 `max-height` 与内部滚动。
- [Risk] 删除后 projection 仍返回空壳 session control → Mitigation: 不让 frontend 伪造过滤逻辑，若 projection 仍展示则显示无邮件事件空态；真实列表规则由 backend projection 决定。
- [Risk] 邮件会话管理与邮件发送设置边界混杂 → Mitigation: 新增 `email-mail-session-management` capability 承载 ledger mutation 契约，`email-sending-settings` 只承载 Settings UI 展示与交互契约。

## Migration Plan

- 无数据迁移。
- 新 action 只影响用户主动点击的指定 `sessionId`。
- 回滚方式为 revert 本 change；已被用户主动删除的本地邮件 ledger 记录不会自动恢复。

## Open Questions

- 删除邮件信息后，如果只剩 `sessions` control record 且没有 outgoing/commands，列表是否应继续显示空壳会话？当前设计倾向尊重 backend projection，不在 frontend 额外隐藏。
