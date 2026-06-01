# workspace-session-catalog-projection Specification

## Purpose

Defines the workspace-session-catalog-projection behavior contract, covering Shared Workspace Session Projection MUST Use One Scope Resolver.
## Requirements
### Requirement: Shared Workspace Session Projection MUST Use One Scope Resolver

系统 MUST 为 sidebar、`Workspace Home` 与 `Session Management` 复用同一套 workspace session scope resolver，不得让不同 surface 各自推导 main/worktree 边界。

#### Scenario: main workspace resolves to project scope

- **WHEN** 用户以某个 main workspace 作为当前项目上下文读取默认会话投影
- **THEN** 系统 MUST 将该 scope 解析为 main workspace 与其 child worktrees
- **AND** 该 scope 解析规则 MUST 与 `Session Management` 的 strict project view 一致

#### Scenario: worktree resolves to isolated scope

- **WHEN** 用户以某个 worktree 作为当前项目上下文读取默认会话投影
- **THEN** 系统 MUST 只解析该 worktree 自身 scope
- **AND** MUST NOT 隐式并入 parent main workspace 或 sibling worktrees

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

### Requirement: Projection Summary MUST Expose Filtered Totals And Degraded State

共享 session projection summary MUST 区分 filtered total 与 surface 当前可见窗口，并暴露 partial/degraded source，避免 UI 把不完整结果误渲染成完整项目事实。
For Claude native sidebar membership, degraded projection MUST be treated as incomplete evidence rather than authoritative deletion evidence.

#### Scenario: filtered total is distinct from visible window

- **WHEN** 某个 surface 只展示 active projection 的窗口子集
- **THEN** 系统 MUST 能同时提供 filtered total 与当前 visible window 信息
- **AND** UI MUST NOT 将当前窗口条目数误标为完整项目会话总量

#### Scenario: degraded source remains explainable

- **GIVEN** 某个 engine/source 的历史读取失败或不可用
- **WHEN** 系统返回 projection summary
- **THEN** summary MUST 暴露 partial/degraded marker
- **AND** 依赖该 summary 的 surface MUST 能说明当前结果是不完整投影

#### Scenario: degraded projection cannot erase Claude native sidebar truth
- **WHEN** shared workspace session projection is partial, degraded, startup-only, or otherwise unable to prove Claude source completeness
- **AND** the sidebar has last-good Claude native rows for the same workspace
- **THEN** the sidebar MUST NOT clear those rows solely because the projection omitted them
- **AND** the projection MUST expose enough degraded evidence for the sidebar to preserve continuity while still showing the result as incomplete

### Requirement: Workspace Projection SHALL Keep Task-Run Aggregates Separate From Session Membership

系统 MUST 在 workspace 级 surface 中把 task-run 聚合与 session membership 分开表达，避免 run 数量污染 session catalog 口径。

#### Scenario: run aggregates do not change shared session membership

- **WHEN** workspace surface 同时展示会话目录与 task-run 摘要
- **THEN** task-run aggregates SHALL 作为独立 projection 呈现
- **AND** 共享 session membership 规则 SHALL 保持不变

#### Scenario: degraded run source stays explainable

- **WHEN** 某个 engine 的 run history 或 telemetry source 暂不可用
- **THEN** workspace-level task-run aggregate SHALL 暴露 degraded marker
- **AND** UI SHALL 能解释当前 run 结果并非完整全量

### Requirement: Workspace Session Projection SHALL Treat Folder Tree As Organization Only

共享 workspace session projection MUST 将 folder tree 作为 presentation/organization layer，而不是 membership resolver；sidebar、Workspace Home 与 Session Management 的 strict project scope 仍 MUST 由同一 resolver 决定。

#### Scenario: folder tree does not widen project scope
- **WHEN** 某 session 被分配到当前 project 的 folder
- **THEN** 该 session 仍 MUST 满足当前 project projection membership 才能显示在 strict project view
- **AND** folder assignment MUST NOT 让其它 project 的 session 进入当前 project projection

#### Scenario: sidebar count is not inflated by folders
- **WHEN** sidebar 或 Workspace Home 展示 project session count
- **THEN** 系统 MUST 按 shared active projection 计算 session membership
- **AND** MUST NOT 因 folder 数量或 folder nesting 增加 session count

#### Scenario: root and folder views share degradation markers
- **WHEN** 某 engine/source 历史读取失败导致 projection degraded
- **THEN** root view 与 folder view MUST 暴露一致的 degraded marker
- **AND** folder tree MUST NOT 把 partial result 渲染成完整项目事实

### Requirement: Workspace Session Projection SHALL Support Bounded Backend Pagination

Workspace session catalog projection MUST acquire backend data through bounded pages, bounded ordered candidates, or capped scans so a first-page request does not require exhausting all engine history sources.

#### Scenario: first page does not exhaust full large history
- **WHEN** project history contains more sessions than the requested catalog page limit
- **THEN** backend catalog construction SHOULD stop after it has enough ordered candidates or reaches a documented scan cap
- **AND** response MUST preserve a stable next cursor or partial/degraded marker when more data may exist

#### Scenario: engine without native cursor uses capped degradation
- **WHEN** an engine history source cannot provide native cursor/limit semantics
- **THEN** backend MAY use a bounded scan cap for that source
- **AND** MUST expose partial/degraded evidence if the cap prevents proving completeness
- **AND** other engine sources MUST continue returning their available entries

#### Scenario: load older preserves filter and source semantics
- **WHEN** 用户点击 Load older with keyword、engine 或 status filter
- **THEN** next page MUST use the same filter semantics as the first page
- **AND** MUST NOT duplicate entries already returned for the same cursor chain

### Requirement: Workspace Session Projection SHALL Be The Default Membership Truth

Sidebar, Workspace Home, and Session Management default workspace session membership SHALL be derived from the shared workspace session catalog projection instead of independently merging engine-specific native lists as parallel truth sources.

#### Scenario: sidebar uses catalog membership for Claude rows
- **WHEN** the sidebar renders default active workspace sessions
- **THEN** Claude rows MUST be admitted through the shared active workspace session projection
- **AND** native Claude listing MUST NOT independently widen or shrink default membership outside that projection

#### Scenario: native Claude list remains detail and diagnostic source
- **WHEN** the UI needs to load a Claude transcript or diagnose Claude native history availability
- **THEN** it MAY call native Claude history commands
- **AND** the native result MUST NOT override catalog membership unless the catalog marks the Claude source as incomplete

#### Scenario: settings and home share projection semantics
- **WHEN** Sidebar, Workspace Home, and Session Management request the same active strict workspace scope
- **THEN** their membership sets MUST be explainable from the same backend projection
- **AND** any difference MUST come from display window, pagination, or explicit UI filters rather than different scope rules

### Requirement: Workspace Session Projection SHALL Expose Claude Source Completeness

Workspace session catalog responses SHALL expose whether Claude source absence is authoritative or incomplete so consumers do not confuse degraded omissions with deletion.

#### Scenario: authoritative Claude empty can clear continuity
- **WHEN** the backend proves Claude scanning is complete for the requested strict scope and no Claude sessions match
- **THEN** the projection MUST expose an authoritative empty state for Claude
- **AND** consumers MAY remove stale Claude continuity rows for that scope

#### Scenario: uncertain Claude empty cannot erase last-good rows
- **WHEN** Claude source scanning returns no rows but cannot prove full workspace coverage
- **THEN** the projection MUST expose uncertain or degraded Claude source status
- **AND** consumers MUST NOT clear last-good Claude rows solely because the current response omitted them

#### Scenario: capped Claude scan remains partial
- **WHEN** Claude scanning stops because a scan cap, timeout, malformed transcript, oversized transcript, or source error prevents complete evaluation
- **THEN** the projection MUST expose partial or degraded Claude source status
- **AND** the UI MUST be able to explain that the visible result may be incomplete

### Requirement: Workspace Session Projection SHALL Merge Source Completeness Conservatively

Workspace session catalog projection SHALL preserve per-engine source completeness and SHALL NOT allow one engine's complete result to hide another engine's incomplete evidence.

#### Scenario: Claude incomplete remains visible beside Codex complete
- **WHEN** Codex scanning completes successfully
- **AND** Claude scanning returns partial, degraded, or uncertain empty evidence
- **THEN** the projection MUST keep Claude's incomplete source status in the response
- **AND** the projection summary MUST NOT describe the overall project result as fully complete without exposing that Claude is incomplete

#### Scenario: authoritative empty is engine and scope specific
- **WHEN** Claude scanning proves authoritative empty for the requested strict workspace scope
- **THEN** that proof MUST apply only to Claude in that requested scope
- **AND** it MUST NOT be reused as proof for related/global history or other engines

#### Scenario: incomplete reasons do not collapse into empty
- **WHEN** Claude storage is unavailable, permission denied, capped, timed out, malformed, oversized, or otherwise not fully evaluated
- **THEN** the projection MUST expose a partial, degraded, or uncertain empty source status
- **AND** it MUST NOT collapse the result into authoritative empty

### Requirement: Workspace Session Projection SHALL Preserve Owner Scope Evidence

Workspace session projection SHALL carry enough owner and scope evidence for frontend consumers to avoid reimplementing workspace membership filters.

#### Scenario: child worktree row survives project aggregate projection
- **GIVEN** a main workspace projection includes child worktree owner scopes
- **WHEN** a Claude session belongs to a child worktree within that project aggregate
- **THEN** the backend projection MUST include the row with its true owner workspace identity
- **AND** the frontend MUST NOT drop it by requiring the owner workspace id to equal the selected main workspace id

#### Scenario: worktree-only projection remains isolated
- **GIVEN** the requested scope is a single worktree
- **WHEN** the backend builds active strict projection
- **THEN** it MUST include only sessions owned by that worktree scope
- **AND** it MUST NOT include parent or sibling workspace rows merely because they share a git root

#### Scenario: unresolved Claude ownership is explainable
- **WHEN** a Claude transcript exists on disk but cannot be uniquely attributed to the requested workspace scope
- **THEN** the projection MUST expose unresolved or ambiguous ownership evidence
- **AND** the transcript MUST NOT silently disappear as if it never existed

#### Scenario: unresolved Claude ownership does not enter strict membership
- **WHEN** a Claude transcript exists on disk
- **AND** the backend cannot uniquely prove its owner workspace for the requested strict scope
- **THEN** the strict active projection MUST NOT include that transcript as a current workspace session
- **AND** the response MUST expose diagnostic evidence so the omission is explainable

#### Scenario: conflict between cwd and project directory is not guessed
- **WHEN** a Claude transcript cwd points to one known workspace
- **AND** its Claude project directory maps to a different known workspace
- **THEN** the projection MUST mark the candidate as unresolved or conflicting
- **AND** it MUST NOT choose either owner without explicit higher-confidence evidence

### Requirement: Session Catalog Stability Evidence MUST Preserve Bounded Projection Semantics

Session catalog stability evidence MUST evaluate scan, cursor, degraded-state, and compatibility behavior without changing membership truth.

#### Scenario: evidence report preserves degraded projection semantics
- **WHEN** session catalog evidence is summarized
- **THEN** degraded or partial projection states MUST remain visible
- **AND** the report MUST NOT treat omitted rows from degraded evidence as authoritative deletion proof

#### Scenario: compatibility list APIs remain diagnostic unless removed by change
- **WHEN** legacy or native list APIs are present for session continuity
- **THEN** reports MUST describe them as compatibility or diagnostic paths
- **AND** they MUST NOT be removed solely because the shared projection is the preferred membership truth

### Requirement: Workspace Session Projection SHALL Carry Reconciliation Evidence

Shared workspace session projection MUST carry enough evidence for consumers to distinguish authoritative absence from degraded or inconsistent source state.

#### Scenario: omission is not deletion during degraded projection
- **WHEN** a projection response omits a session while any source is partial or degraded
- **THEN** consumers MUST NOT treat the omission alone as authoritative deletion
- **AND** stale continuity rows MAY remain marked degraded until authoritative evidence arrives

#### Scenario: missing-on-disk is authoritative cleanup evidence
- **WHEN** a catalog entry is returned with `missing-on-disk`
- **THEN** the management UI MAY offer metadata cleanup
- **AND** sidebar active projection MUST NOT show it as a live session

### Requirement: Projection Mutation Results SHALL Preserve Owner Routing

Archive, unarchive, delete and folder assignment responses MUST remain tied to the actual owner workspace used for mutation.

#### Scenario: project aggregate delete returns owner-aware results
- **WHEN** a project-scoped batch delete includes sessions from multiple child workspaces
- **THEN** each mutation result MUST be attributable to the owner workspace used for deletion
- **AND** frontend selection keys MUST remain stable for partial success handling

### Requirement: Workspace Session Projection MUST Preserve Non-Authoritative Source Status

Workspace session catalog projection MUST NOT report an engine/source as complete when the source was bounded, capped, timed out, cache-degraded, or otherwise unable to prove the requested scope was fully covered.

#### Scenario: bounded scan cap prevents complete status
- **WHEN** an engine source returns one or more rows from a bounded scan
- **AND** the scan reaches the documented cap or lookahead limit before completeness can be proven
- **THEN** the source status MUST be `partial`, `degraded`, `uncertain_empty`, or an equivalent non-authoritative status
- **AND** the response MUST expose cap evidence such as `scanCapReached`, `scannedCandidates`, `reason`, or equivalent diagnostics

#### Scenario: non-authoritative source cannot prove deletion or empty membership
- **WHEN** a source status is partial, degraded, capped, timed out, or uncertain
- **THEN** dependent surfaces MUST NOT treat omitted sessions as deleted, archived, or out of scope
- **AND** continuity rows MAY be preserved with degraded evidence until authoritative source truth is available

#### Scenario: complete status requires coverage proof
- **WHEN** the catalog reports an engine source as complete for a workspace scope
- **THEN** the backend MUST have proof that the source was reachable, not capped, not timed out, and fully evaluated for the requested scope/filter
- **AND** frontend surfaces MAY use that complete status as authoritative empty or authoritative omission evidence

### Requirement: Workspace Session Projection MUST Bound Archived Evidence

Archived evidence used by sidebar or workspace surfaces MUST be acquired through bounded requests, backend-provided archive metadata evidence, or an equivalent finite contract; failure to acquire archived evidence MUST be exposed as degraded rather than interpreted as no archived sessions.

#### Scenario: archived lookup failure is degraded evidence
- **WHEN** a sidebar refresh needs archived metadata to filter last-good continuity rows
- **AND** the archived evidence lookup times out, fails, or cannot prove completeness
- **THEN** the refresh MUST expose archived evidence as degraded or uncertain
- **AND** it MUST NOT interpret the failure as an empty archived map

#### Scenario: archived row is not resurrected by missing archive evidence
- **WHEN** a row is known archived from current projection, authoritative native source, or previous complete archive evidence
- **AND** a later archived evidence lookup is partial, degraded, or failed
- **THEN** sidebar continuity MUST NOT resurrect that archived row as active
- **AND** the UI MUST keep enough degraded evidence to explain why archived truth is incomplete

#### Scenario: archived evidence does not require full catalog exhaustion
- **WHEN** a workspace has more archived or active sessions than the sidebar display window
- **THEN** archived evidence collection for a regular sidebar refresh MUST remain bounded
- **AND** full archive exploration MUST be reserved for Session Management or global history pagination surfaces

### Requirement: Workspace Session Projection MUST Use Stable Continuation Cursors

Workspace session catalog pagination MUST use a stable continuation cursor or equivalent anchor-based model instead of relying solely on mutable list offsets.

#### Scenario: cursor chain survives new session insertion
- **WHEN** a caller reads the first page of a sorted catalog result
- **AND** a newer session is inserted before the caller requests the next page with the returned cursor
- **THEN** the next page MUST NOT skip existing entries that belonged after the original page anchor
- **AND** it MUST NOT duplicate entries already returned in the same cursor chain

#### Scenario: cursor encodes stable ordering anchor
- **WHEN** the backend returns `nextCursor`
- **THEN** the cursor MUST encode or reference stable ordering evidence such as updated timestamp, stable session identity, owner workspace, and filter context
- **AND** callers MUST treat the cursor as opaque

#### Scenario: legacy offset cursor remains compatibility only
- **WHEN** a caller passes an old offset-style cursor
- **THEN** the backend MAY accept it for compatibility
- **AND** any new `nextCursor` returned by the backend SHOULD use the stable cursor format

### Requirement: Workspace Session Projection SHALL Apply Automatic Visibility Classification
Workspace session catalog projection SHALL apply automatic session visibility metadata before producing root, folder, Sidebar, Workspace Home, and Session Management active lists.

#### Scenario: Hidden automatic rows are filtered before surface projection
- **WHEN** backend catalog sources return a session classified as `hidden`
- **THEN** shared workspace session projection SHALL exclude it from normal active user-facing membership
- **AND** Sidebar, Workspace Home, and Session Management SHALL NOT re-add it from native engine lists or runtime overlays

#### Scenario: System-auto rows are excluded from root membership
- **WHEN** backend catalog sources return a session classified as `system-auto`
- **THEN** shared workspace session projection SHALL exclude it from root session rows
- **AND** the projection SHALL expose it through the reserved system-auto grouping contract

#### Scenario: Missing metadata preserves existing behavior
- **WHEN** backend catalog sources return a session without automatic visibility metadata
- **THEN** shared workspace session projection SHALL preserve existing membership behavior
- **AND** it SHALL NOT infer hidden status from title text alone

#### Scenario: Compatibility hide signal is normalized
- **WHEN** a Codex background hide signal or equivalent legacy compatibility marker exists for a session
- **THEN** shared workspace session projection SHALL treat the session as hidden automatic metadata
- **AND** all surfaces SHALL consume the normalized classification rather than parsing engine-specific hide events independently

