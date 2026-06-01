## MODIFIED Requirements

### Requirement: Default Main Surfaces MUST Consume Shared Active Projection

sidebar 与 `Workspace Home` 的默认会话集合 MUST 基于共享 catalog 的 `strict + active + unarchived` projection 决定 membership 与 count；运行时线程状态 MAY 叠加其上，但 MUST NOT 单独扩大或收缩该集合。
When the shared active projection is degraded, sidebar surfaces MAY preserve last-good Claude native rows as continuity placeholders until authoritative projection or native truth resolves membership.
Session organization state for newly created pending engine sessions MAY be kept as a temporary UI overlay, but MUST be reconciled through explicit pending-to-real identity transition before durable folder assignment is written.

#### Scenario: sidebar and home align with session management active strict projection
- **GIVEN** 用户打开某个 workspace，并同时查看 sidebar 或 `Workspace Home`
- **WHEN** 同一 workspace 的 `Session Management` 处于 `strict + active` 默认视图
- **THEN** sidebar / `Workspace Home` 的默认会话集合 MUST 来自同一 active projection
- **AND** count 差异 MUST 只允许来自显式展示窗口差异，而不是 scope 或 archive 口径不同

#### Scenario: runtime overlay does not widen membership
- **GIVEN** 运行时线程缓存中存在尚未完成清理的旧 thread 状态
- **WHEN** 共享 active projection 刷新完成
- **THEN** surface 的默认会话 membership MUST 以共享 projection 为准
- **AND** runtime overlay MUST 只补充 processing、reviewing、selected 等状态

#### Scenario: pending organization overlay follows identity transition
- **GIVEN** 新建 engine session 仍处于 pending identity
- **AND** 用户已经为该 pending session 选择了 folder/root organization intent
- **WHEN** 系统收到明确的 `pendingThreadId -> realThreadId` identity transition
- **THEN** surface MUST migrate organization overlay to `realThreadId`
- **AND** durable folder assignment MUST be written for `realThreadId`
- **AND** the migration MUST NOT select another same-engine session by catalog ordering or candidate count alone

#### Scenario: all pending-finalization rename paths share organization migration
- **GIVEN** frontend code has multiple paths that can dispatch `renameThreadId` for a pending engine session
- **WHEN** any such path finalizes `pendingThreadId` to `realThreadId`
- **THEN** it MUST trigger the same pending organization migration contract
- **AND** no dispatch path MAY rely on catalog-result guessing as its primary folder-intent migration mechanism

#### Scenario: Claude continuity does not bypass archive filters
- **GIVEN** the sidebar preserves last-good Claude rows during a degraded shared projection
- **WHEN** the current projection or authoritative native source proves a row is archived, hidden, deleted, or out of strict workspace scope
- **THEN** that row MUST be removed or filtered
- **AND** continuity MUST NOT widen membership beyond the active strict unarchived contract
