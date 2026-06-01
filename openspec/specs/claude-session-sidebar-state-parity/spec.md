# claude-session-sidebar-state-parity Specification

## Purpose

Define the sidebar-to-native-session truth contract for Claude historical sessions so activation, reopen, and cleanup converge on the real session state.
## Requirements
### Requirement: Claude Sidebar Entry MUST Resolve Against Native Session Truth Before Activation

当用户从左侧栏重新打开 `Claude` 历史会话时，系统 MUST 在 activation / history load 前先确认该 entry 对应的 native session truth，而不是直接把 sidebar projection 当成事实源。

#### Scenario: stale sidebar entry is reconciled before reopen
- **WHEN** 用户选择左侧栏中的 `Claude` 历史会话
- **AND** 该 entry 对应的 native session 已失效、缺失或需要 canonical resolve
- **THEN** 系统 MUST 先执行 existence check、canonical resolve 或等价 reconcile
- **AND** 系统 MUST NOT 直接进入一个与该 entry 不一致的 loaded success 状态

#### Scenario: reopen failure does not silently create a new agent conversation
- **WHEN** `Claude` 历史会话在 reopen / history load 过程中失败
- **THEN** 系统 MUST 将该结果视为当前 entry 的 recoverable failure 或 reconcile 分支
- **AND** 系统 MUST NOT 静默创建一个不相关的新 Agent conversation 来顶替原 entry

#### Scenario: concurrent realtime crossed surface does not rewrite final sidebar truth
- **WHEN** 同一 workspace 下存在多个并行 `Claude` realtime 会话
- **AND** live session rebind 一度需要在多个 pending 之间做隔离
- **THEN** sidebar selected entry 的最终 truth MUST 仍然收敛到对应 native session
- **AND** temporary realtime isolation failure MUST NOT 永久改写历史 reopen 后的 selected conversation truth

### Requirement: Claude Sidebar Projection MUST Converge Back To Session Truth After Not-Found

当 `Claude` sidebar entry 已与底层 session truth 分叉，系统 MUST 在 authoritative not-found 之后收敛回真实状态，而不是保留永久 ghost entry。

#### Scenario: delete not found triggers ghost cleanup
- **WHEN** 用户删除某条 `Claude` sidebar entry
- **AND** authoritative delete path 返回 `SESSION_NOT_FOUND` 或等价 not-found
- **THEN** 系统 MUST 触发 authoritative refresh、ghost cleanup 或等价 reconcile
- **AND** 左侧栏最终 MUST 不再长期保留该失效 entry

### Requirement: Claude Sidebar Reopen Surface MUST Stay Anchored During Late Reconcile

当用户从 sidebar 或 recent conversations 重新激活 `Claude` 历史会话时，只要当前幕布已经存在可读 surface，late reconcile MUST 维持该 surface 或替换为显式 reconcile/failure，不得直接把内容清空。

#### Scenario: late reconcile preserves readable history or explicit reconcile surface
- **WHEN** 用户重新打开某条 `Claude` sidebar entry
- **AND** 当前幕布已经显示出可读 history rows
- **AND** native session truth 仍在 late reconcile、canonical resolve 或 existence check 中
- **THEN** 系统 MUST 保留 readable history surface 或显示显式 reconcile surface
- **AND** 系统 MUST NOT 在无说明的情况下把当前幕布清空

#### Scenario: truth mismatch does not blank the selected sidebar conversation
- **WHEN** 当前选中的 `Claude` sidebar entry 与 authoritative native session truth 不一致
- **THEN** 系统 MUST 将该 entry 置于 reconcile 或 recoverable failure
- **AND** 系统 MUST NOT 先显示该 entry 的历史，再在晚到 truth mismatch 后直接掉回空白 conversation

### Requirement: Canonical Claude Replacement MUST Converge The Selected Sidebar Entry

当 `Claude` 历史 entry 需要 canonical replacement 时，系统 MUST 让 selected sidebar entry 与实际打开的 native session truth 收敛到同一目标，不得留下会自行消失的 duplicate conversation。

#### Scenario: selected sidebar entry converges to canonical replacement
- **WHEN** 当前选中的 `Claude` sidebar entry 经过 canonical resolve 后应当指向另一条 native session identity
- **THEN** selected sidebar state 与 conversation surface MUST 一起收敛到该 canonical replacement
- **AND** 系统 MUST NOT 让旧 entry 与 replacement entry 同时表现为“当前会话”

#### Scenario: canonical replacement does not surface as a temporary ghost thread
- **WHEN** `Claude` reopen / continue 过程中出现 canonical replacement
- **THEN** replacement MUST 作为当前 selected conversation 的 truth convergence 结果呈现
- **AND** 系统 MUST NOT 生成一个短暂可见、完成后又自行消失的 ghost `Claude` thread

### Requirement: Claude Sidebar Listing MUST Be Resilient To Large History Payloads

Claude sidebar session listing MUST treat large inline media payloads and degraded native listing sources as non-blocking optional content and continue projecting valid session summaries from authoritative or last-good Claude session truth.

#### Scenario: large base64 transcript does not remove sidebar sessions
- **WHEN** one or more Claude JSONL files contain multi-megabyte inline base64 image lines
- **THEN** the sidebar session listing MUST still return valid discoverable Claude sessions for the workspace
- **AND** unrelated Claude sessions MUST NOT disappear solely because one transcript contains a large media payload

#### Scenario: session summary excludes large image payloads
- **WHEN** the system builds Claude sidebar summaries
- **THEN** the summary payload MUST NOT include inline base64 image data or data URI strings
- **AND** it MUST include only bounded metadata such as title preview, timestamps, message count, file size, and attribution fields

#### Scenario: Claude listing failure is source-scoped
- **WHEN** a Claude history file is oversized, malformed, or times out during summary extraction
- **THEN** the system MUST degrade or skip that file without clearing the full workspace thread list
- **AND** the degraded state MUST expose a Claude-specific partial source or diagnostic reason

#### Scenario: degraded Claude listing preserves last-good native rows
- **WHEN** the sidebar previously displayed Claude sessions for a workspace from native session truth
- **AND** a later refresh reports `claude-session-timeout`, `claude-session-error`, catalog partial, startup first-page, or an equivalent incomplete Claude source
- **THEN** the sidebar MUST preserve last-good Claude rows that are still in scope
- **AND** the refresh MUST NOT treat the incomplete source as authoritative proof that those sessions no longer exist

#### Scenario: transient empty Claude listing does not clear sidebar truth
- **WHEN** a full-catalog or native refresh returns an empty Claude subset without authoritative delete, archive, hidden, or out-of-scope evidence
- **AND** the system has last-good Claude rows for the workspace
- **THEN** the sidebar MUST keep those last-good rows while exposing degraded or incomplete state
- **AND** it MUST NOT render the workspace as having no Claude sessions solely from that transient empty result

### Requirement: Claude Sidebar Titles MUST Preserve Stable User-Facing Identity

Claude sidebar title projection MUST prevent weaker generic fallback names from overwriting stable mapped, custom, or previously meaningful session titles.

#### Scenario: generic fallback does not overwrite mapped title
- **WHEN** a Claude session has a mapped or custom title
- **AND** a later refresh can only derive a generic title such as `Claude Session` or `Agent N`
- **THEN** the sidebar MUST keep the mapped or custom title
- **AND** the weaker fallback MUST NOT replace it

#### Scenario: existing meaningful title survives lower-confidence refresh
- **WHEN** a Claude sidebar row already has a meaningful non-generic title
- **AND** a later degraded refresh has the same session identity but only a first-message or generic fallback title
- **THEN** the sidebar MUST preserve the meaningful title unless a mapped/custom title or stronger native title is available

### Requirement: Claude Sidebar Continuity MUST Preserve Session Relationships

Claude sidebar continuity MUST preserve parent-child relationship metadata while retaining last-good rows during degraded refreshes.

#### Scenario: parent-child metadata survives continuity merge
- **WHEN** a last-good Claude row contains `parentSessionId`, `parentThreadId`, fork lineage, or equivalent relationship metadata
- **AND** a later incomplete refresh preserves that row through continuity
- **THEN** the preserved row MUST keep the relationship metadata
- **AND** the sidebar MUST NOT flatten parent/child structure solely because the current refresh was incomplete

#### Scenario: authoritative filters still remove preserved rows
- **WHEN** a Claude row is archived, hidden, deleted, control-plane filtered, or proven out of workspace scope by authoritative data
- **THEN** last-good continuity MUST NOT resurrect that row
- **AND** the sidebar MUST honor the authoritative removal/filter decision

### Requirement: Claude Native Sidebar Listing MUST Respect Project Session Display Window

Claude native sidebar listing MUST NOT use a hardcoded fetch window smaller than the user's configured project session display count or the documented stable catalog window.

#### Scenario: configured project display count expands native Claude fetch window
- **GIVEN** a workspace is configured to display more project session roots than the old native Claude hardcoded limit
- **WHEN** the sidebar refreshes Claude native session summaries
- **THEN** the native Claude list request MUST use an effective limit that can cover the configured display count
- **AND** real Claude sessions within that window MUST NOT disappear solely because the native list used a smaller hardcoded value

#### Scenario: display count remains presentation rather than membership
- **WHEN** the user changes the project session display count
- **THEN** the setting MUST affect collapsed root visibility
- **AND** it MUST NOT change project membership, folder assignment, archive filtering, hidden binding filtering, or parent-child session relationships

#### Scenario: effective native window stays bounded
- **WHEN** the configured display count is missing, invalid, or larger than the supported project window
- **THEN** the frontend MUST sanitize the value through the existing project display count bounds
- **AND** native Claude listing MUST remain bounded by the shared catalog page size or an equivalent documented cap

### Requirement: Claude Sidebar Display MUST Be Produced By Stable Session Projection

Claude sidebar display rows MUST be derived through a stable projection step that compares source candidates by canonical identity, title confidence, and membership evidence rather than by source arrival order alone.

#### Scenario: weaker generic row cannot replace stable projection
- **WHEN** the projection already has a Claude row with a meaningful mapped, custom, native, or first-user title
- **AND** a later source candidate for the same canonical session only contains a weak generic title such as `Agent N` or `Claude Session`
- **THEN** the projected sidebar row MUST keep the stronger title
- **AND** the weak generic title MUST NOT become the visible row name

#### Scenario: incomplete refresh cannot delete last-good projection
- **WHEN** a Claude source reports timeout, error, startup partial, catalog partial, or equivalent incomplete membership evidence
- **AND** the projection has last-good in-scope Claude rows
- **THEN** the projected sidebar MUST preserve those rows
- **AND** the incomplete source MUST NOT be treated as authoritative proof that the rows no longer exist

#### Scenario: authoritative removal still wins over projection continuity
- **WHEN** a Claude row is archived, hidden, explicitly deleted, not found by authoritative native truth, control-plane filtered, or proven out of workspace scope
- **THEN** the projection MUST remove or suppress that row
- **AND** last-good continuity MUST NOT resurrect it

#### Scenario: ambiguous pending finalization does not create generic duplicate
- **WHEN** a Claude pending session is finalizing into a native session id
- **AND** the frontend cannot yet prove which pending row should be aliased to the finalized id
- **THEN** the sidebar projection MUST NOT create an additional visible finalized row named only by an ordinal fallback such as `Agent N`
- **AND** the row MUST become visible through explicit alias evidence or meaningful native session truth

### Requirement: Claude Sidebar Listing SHALL Consume Catalog Membership

Claude sidebar listing SHALL use the shared workspace session catalog projection for default active workspace membership and SHALL treat native Claude history listing as a source of transcript truth, diagnostics, or degraded continuity only.

#### Scenario: catalog admits Claude sidebar row
- **WHEN** the shared active projection includes a Claude session for the current workspace scope
- **THEN** the sidebar MUST render that Claude session according to the current display window and filters
- **AND** it MUST preserve the owner and parent relationship metadata from the projection

#### Scenario: native empty does not override catalog row
- **WHEN** native Claude listing returns empty or times out
- **AND** the shared catalog projection still includes Claude rows or marks Claude source as incomplete
- **THEN** the sidebar MUST NOT remove the catalog-backed Claude rows solely because the native list was empty

#### Scenario: authoritative catalog removal wins
- **WHEN** the shared catalog projection proves a Claude row is archived, hidden, deleted, or out of strict workspace scope
- **THEN** the sidebar MUST remove or suppress that row
- **AND** native last-good continuity MUST NOT resurrect it

#### Scenario: native list does not widen complete catalog membership
- **WHEN** the shared catalog projection is complete for Claude in the current strict workspace scope
- **AND** native Claude listing returns an additional session outside that projection
- **THEN** the sidebar MUST NOT add that native-only session to default workspace membership
- **AND** the native-only session MAY be surfaced only through diagnostic, related, global, or explicit transcript lookup surfaces

### Requirement: Claude Sidebar Continuity SHALL Follow Source Completeness

Claude sidebar continuity SHALL be applied only when the current Claude source evidence is incomplete and SHALL remain visibly degraded until authoritative evidence arrives.

#### Scenario: uncertain empty preserves readable continuity
- **WHEN** the current refresh reports uncertain empty for Claude
- **AND** the sidebar has last-good Claude rows for the same workspace scope
- **THEN** the sidebar MUST preserve those rows as continuity placeholders
- **AND** it MUST expose a degraded or incomplete state rather than presenting the list as fully fresh

#### Scenario: authoritative empty clears continuity
- **WHEN** the backend reports authoritative empty for Claude in the current strict scope
- **THEN** the sidebar MUST clear stale Claude continuity rows for that scope
- **AND** it MUST NOT keep them as if they were active sessions

#### Scenario: continuity is keyed by stable session identity
- **WHEN** the sidebar preserves a Claude row across a degraded refresh
- **THEN** it MUST key that row by canonical session identity and owner scope
- **AND** it MUST NOT create duplicate rows for the same underlying Claude session

#### Scenario: continuity remains visually incomplete
- **WHEN** the sidebar preserves last-good Claude rows because the current source status is partial, degraded, or uncertain empty
- **THEN** the preserved rows MUST be distinguishable from fully fresh catalog rows through projection status, source badge, or equivalent state available to the UI
- **AND** the sidebar MUST NOT present the preserved result as an authoritative complete refresh

### Requirement: Claude Sidebar Titles SHALL Use Shared Title Projection

Claude sidebar titles SHALL come from the shared session title projection so weaker generic fallback names do not overwrite meaningful names from catalog, metadata, or previous projection state.

#### Scenario: custom title wins in sidebar
- **WHEN** a Claude session has a custom title in session metadata
- **THEN** the sidebar MUST display that title
- **AND** native first-message or generic fallback text MUST NOT override it

#### Scenario: weak fallback cannot replace meaningful title
- **WHEN** a Claude sidebar row already has a meaningful title
- **AND** a later incomplete refresh only provides a generic name such as `Claude Session` or `Agent N`
- **THEN** the sidebar MUST keep the meaningful title
- **AND** it MUST NOT replace the row name with the generic fallback

#### Scenario: settings and sidebar agree on title
- **WHEN** the same Claude session appears in Sidebar and Session Management
- **THEN** both surfaces MUST display the same resolved title unless one surface explicitly shows additional debug metadata
- **AND** the resolver priority MUST remain consistent across both surfaces

### Requirement: Claude Sidebar Reopen MUST Not Clear Loaded Rows During Late Truth Reconcile

When a Claude sidebar entry is reopened and readable history rows are already loaded, late native truth or catalog reconcile MUST preserve those rows until it can converge to a canonical replacement or explicit failure.

#### Scenario: late reconcile cannot blank issue-shaped Claude history
- **WHEN** a user clicks a Claude sidebar entry for an issue-shaped second-turn session
- **AND** history load returns readable rows for that entry
- **AND** native truth or workspace catalog reconciliation finishes later
- **THEN** the selected conversation MUST keep the readable rows or converge to the canonical replacement rows
- **AND** it MUST NOT clear the conversation into a blank surface without an explicit recoverable failure state

#### Scenario: authoritative removal still wins
- **WHEN** native truth proves the Claude session is deleted, archived, hidden, or out of the current workspace scope
- **THEN** sidebar parity recovery MUST remove or suppress the row
- **AND** it MUST NOT preserve last-good rows as if the session still existed

### Requirement: Claude Sidebar Listing MUST Preserve Last-Good Claude Entries When Native Listing Times Out

当 sidebar thread list 加载过程中 Claude native listing 子请求超时、返回 null、或被拒绝时，系统 MUST 保留上一轮已知良好的 Claude session 条目，并继续与其他子源（Codex / OpenCode / Catalog）的成功结果合并，而不是让 timeout 等同为"Claude 没有任何 session"。

#### Scenario: claude listing timeout preserves last-good claude entries while codex still resolves

- **WHEN** sidebar `listThreadsForWorkspace` 进入 full-catalog hydration
- **AND** `listClaudeSessionsService` 在前端 `withTimeout` 窗口内未返回（resolve 为 `null`）
- **AND** Codex catalog / OpenCode 子源仍然返回非空结果
- **THEN** 最终写入 sidebar store 的 thread 列表 MUST 包含上一轮 last-good 中所有非 archived / 非 shared 的 Claude session 条目
- **AND** Codex / OpenCode 已成功的 session 条目 MUST 同时存在于列表中
- **AND** 列表 MUST NOT 出现"看似已成功但只剩单一子源结果"的残缺态

#### Scenario: claude listing rejected preserves last-good claude entries

- **WHEN** sidebar `listThreadsForWorkspace` 进入 full-catalog hydration
- **AND** `listClaudeSessionsService` 抛出异常（`Promise.allSettled` 中 status 为 `rejected`）
- **THEN** 系统 MUST 与超时分支等价地保留 last-good Claude 条目
- **AND** 系统 MUST 通过 `rememberPartialSource("claude-session-error")` 或等价机制记录这次降级

#### Scenario: full empty fallback path is not regressed

- **WHEN** Claude / Codex / OpenCode / Catalog 全部子源均不可用或返回空
- **AND** 合并后的 `visibleSummaries.length === 0`
- **THEN** 系统 MUST 继续走 `empty-thread-list` last-good fallback 路径
- **AND** 系统 MUST NOT 在该路径下消音 partial-source 诊断

### Requirement: Sidebar Last-Good Snapshot Resolution MUST Reject Degraded State To Prevent Self-Pollution

`getLastGoodThreadSummaries` 在解析"上次良好状态"时 MUST 显式拒绝带 degraded 标记的快照，按 `current → previous → store → sidebar snapshot → []` 顺序逐级 fallback，直到拿到非 degraded 的结果或彻底回空。

#### Scenario: degraded current state is skipped in favor of clean previous state

- **WHEN** 上一轮 partial-source 兜底导致带 degraded 标记的 thread summary 被写入 store
- **AND** 下一次 sidebar refresh 触发 `getLastGoodThreadSummaries(workspaceId)`
- **THEN** 系统 MUST 跳过 `latestThreadsByWorkspaceRef.current[workspaceId]`（因其 degraded）
- **AND** 系统 MUST 优先返回 `previousThreadsByWorkspaceRef.current[workspaceId]` 中的非 degraded 快照
- **AND** 若 previous 亦 degraded，MUST 继续 fallback 到 store 与 sidebar snapshot

#### Scenario: consecutive claude timeouts do not progressively drop more sessions

- **WHEN** 同一 workspace 下连续两次 `listThreadsForWorkspace` 都让 Claude 子源 timeout
- **THEN** 第二次执行时 `getLastGoodThreadSummaries` 取到的 last-good MUST 仍包含首次 first-page 后的完整 Claude 列表
- **AND** 第二次写入 store 的 Claude 条目数 MUST 不少于第一次写入 store 的 Claude 条目数

#### Scenario: healthy non-degraded state still resolves as last-good

- **WHEN** 上一次 sidebar refresh 成功返回完整列表，未带 degraded 标记
- **AND** 触发新的 `getLastGoodThreadSummaries`
- **THEN** 系统 MUST 直接返回 `latestThreadsByWorkspaceRef.current[workspaceId]`，不退化到 previous 或 snapshot

### Requirement: Sidebar Timeout Recovery MUST Remain Observable Through Partial-Source Diagnostics

当 sidebar listing 通过 last-good seed 路径恢复显示时，系统 MUST 保留可观测的 partial-source 诊断信号，以便用户与开发者识别本次列表的真实健康度，不得因为兜底成功而消音问题。

#### Scenario: claude timeout fallback still emits partial-source signal

- **WHEN** sidebar listing 因 Claude 子源 timeout 触发 last-good seed
- **THEN** 系统 MUST 记录 `claude-session-timeout` 或等价 partial-source 值
- **AND** 系统 MUST 通过既有 `onDebug` / Debug 面板事件投递诊断
- **AND** UI 层 MUST 能据此呈现 degraded badge 或 recovery state（如已有该展示）

#### Scenario: successful refresh clears prior degraded marking

- **WHEN** 后续一次 sidebar listing 中 Claude 子源成功返回非空结果
- **THEN** 新写入 store 的 Claude 条目 MUST NOT 继续携带上一次的 degraded 标记
- **AND** 此次 `getLastGoodThreadSummaries` 的下次调用 MUST 把当前状态视为 healthy

### Requirement: Last-Good Claude Seed MUST Survive Codex Catalog Re-Composition

当 Claude 子源被 last-good 条目 seed 进 mergedById 后，后续 Codex catalog 重组（`mergeCodexCatalogSessionSummaries`）MUST 不洗掉已 seed 的 Claude 条目；若架构限制使 seed 必须重复，系统 MUST 在 catalog 重组之后再补一次 seed。

#### Scenario: codex catalog refresh preserves seeded claude entries

- **WHEN** Claude 子源 timeout 触发 last-good seed
- **AND** Codex catalog 子源同一轮返回非空 sessions 并触发 `mergeCodexCatalogSessionSummaries`
- **THEN** 重组后的 mergedById MUST 仍包含 seed 阶段写入的 Claude 条目
- **AND** Codex catalog sessions 与 Claude seed 条目 MUST 按 `updatedAt desc` 共同存在于最终列表

#### Scenario: archived claude session is not resurrected by last-good seed

- **WHEN** last-good 列表中含有已 archived 的 Claude session 条目
- **AND** Claude 子源 timeout 触发 seed
- **THEN** 已 archived 的条目 MUST NOT 被 seed 进 mergedById
- **AND** archive state 的 source-of-truth 仍由 `applySessionArchiveState` 维护

### Requirement: Claude Sidebar Listing MUST Treat Successful Empty Results As Authoritative Only When Attribution Is Complete

当 Claude native listing 成功返回空数组时，系统 MUST 区分"真实没有 Claude session"与"扫描/归属不确定导致暂时没有命中"。只有后端或 catalog 明确提供完整、无 partial、无 attribution ambiguity 的结果时，successful empty 才能覆盖 last-good Claude entries。

#### Scenario: successful empty with uncertain attribution preserves last-good claude entries

- **WHEN** sidebar `listThreadsForWorkspace` 进入 full-catalog hydration
- **AND** `listClaudeSessionsService` 成功返回空数组
- **AND** 当前 workspace 存在上一轮 last-good Claude entries
- **AND** 本轮 listing 或 catalog projection 暴露 partial source、scan ambiguity、workspace family ambiguity、或 attribution uncertainty
- **THEN** 系统 MUST 把该空数组视为 degraded empty
- **AND** 最终 sidebar store MUST 保留 last-good Claude entries
- **AND** 系统 MUST 通过 debug / partial-source 机制记录 successful-empty fallback 原因

#### Scenario: authoritative empty may clear last-good claude entries

- **WHEN** `listClaudeSessionsService` 成功返回空数组
- **AND** 后端确认当前 workspace scan 完整且无 attribution ambiguity
- **AND** catalog / archive / shared filters 均未报告 partial source
- **THEN** 系统 MAY 将 Claude entries 更新为空
- **AND** 该更新 MUST NOT 带 degraded fallback 标记

### Requirement: Claude Session Attribution MUST Prefer Exact Child Workspace Ownership Over Parent Scope

当父 workspace 与子文件夹 workspace 同时存在时，Claude session 的 owner MUST 由最精确的 workspace path / transcript cwd / direct Claude project dir 决定。父 workspace、git root family、parent scope fallback 或 encoded-prefix scan MUST NOT 抢占 exact child workspace 所拥有的 Claude session。

#### Scenario: child workspace cwd remains owned by child projection

- **WHEN** workspace `parent` path 为 `/repo`
- **AND** workspace `child` path 为 `/repo/sub`
- **AND** Claude transcript `cwd` 为 `/repo/sub` 或其子路径
- **THEN** 该 Claude session 的 matched workspace MUST 是 `child`
- **AND** child sidebar projection MUST 显示该 session
- **AND** parent sidebar projection MUST NOT 将该 session 当作 parent-owned native session

#### Scenario: parent scope fallback does not override longer child match

- **WHEN** Claude project directories include both parent encoded path and child encoded path candidates
- **AND** transcript cwd matches both by prefix but child path is longer
- **THEN** longest child match MUST win over parent match
- **AND** parent-scope / git-root inference MUST NOT downgrade this exact child ownership into inferred parent ownership

#### Scenario: ambiguous sibling child matches remain degraded instead of choosing parent

- **WHEN** multiple child workspaces under the same parent can plausibly match a Claude session
- **AND** no exact cwd or direct child project dir evidence disambiguates the owner
- **THEN** the session MUST NOT be silently assigned to the parent workspace as authoritative truth
- **AND** the system MUST expose attribution ambiguity through partial-source, degraded state, or equivalent diagnostics

