## Context

Composer 当前有两层上下文可见面：

- `ComposerReadinessBar`：负责 send target、mode、activity 和 compact context summary。
- `ContextLedgerPanel`：负责 context source detail、grouped blocks、batch governance、pin/exclude/clear 等管理动作。

问题出在 disclosure control 分裂：展开按钮在 readiness bar 右上角，收起按钮在 ledger header。用户期望图 2 位置成为唯一开关，也就是 Composer 对话框右上角。

## Goals / Non-Goals

**Goals:**

- Readiness bar 右上角保留 Context Ledger toggle，并根据状态显示“展开 / 收起”。
- 展开和收起都发生在同一个右上角按钮位置。
- Context Ledger detail 展开后不再显示自己的重复 header。
- 现有 Context Ledger detail、batch governance、source navigation、send path 不变。

**Non-Goals:**

- 不新增持久化设置。
- 不改变 context projection 或 grouping helper。
- 不改 Tauri/backend/runtime contract。
- 不重做 Composer 整体布局。

## Decisions

### Decision 1: ComposerReadinessBar owns the single top-right disclosure toggle

选择：Composer 将 `contextLedgerProjection.visible` 转换为 readiness bar 的 toggle affordance。`ComposerReadinessBar` 接收 `onToggleContextSources` 与 `contextSourcesExpanded`，在同一按钮位置显示“展开 / 收起”。

备选方案：

- 让 `ContextLedgerPanel` 自己渲染 collapsed header。该方案组件边界更纯，但不符合用户指定的右上角位置。
- 新增一个轻量 `ContextLedgerEntrypoint` 组件放在 readiness bar 外层。该方案会复制 summary/toggle 结构，引入 drift。

取舍：readiness bar 已经拥有 context summary 与右侧操作区，最适合作为图 2 位置的唯一 disclosure 入口。

### Decision 2: ContextLedgerPanel can render detail without its own header

选择：给 `ContextLedgerPanel` 增加轻量 presentation prop，使 Composer 在 readiness bar 拥有 toggle 时隐藏 panel 内部 header，只渲染 detail body。

备选方案：

- 保留内部 header，只把右上角按钮也做成收起。这样仍然有两个“收起”。
- 在 Composer 中拆出 panel body JSX。这样会复制 `ContextLedgerPanel` 结构和 detail dialog 逻辑，维护成本高。

取舍：在既有 panel 上加小 prop 改变 presentation，行为和数据逻辑继续集中在 `ContextLedgerPanel`。

## Risks / Trade-offs

- [Risk] Readiness bar 承载 disclosure action 可能被误用为详情管理入口。
  → Mitigation：按钮只负责 expanded boolean，详情管理仍在 `ContextLedgerPanel` body 内。
- [Risk] 测试 mock 仍停留在旧的单向 `onExpandContextSources` 语义。
  → Mitigation：更新 mock 为 `onToggleContextSources`，并覆盖 readiness bar 同一位置的 expand/collapse 双态。
- [Risk] 展开详情缺少 panel title 后可读性下降。
  → Mitigation：readiness bar 上的 context summary 与右上角 toggle 持续可见，detail body 保留 group title、truth note 和 block labels。

## Migration Plan

1. 恢复 readiness bar toggle prop plumbing，并把 action 改成 toggle。
2. Composer 仅在 expanded 时渲染 `ContextLedgerPanel` detail。
3. ContextLedgerPanel 支持隐藏内部 header。
4. 更新 focused tests。
5. 运行 focused vitest、typecheck、large-file sentry。

Rollback：移除 `hideHeader` presentation prop，恢复 ContextLedgerPanel 内部 header 渲染即可；不涉及数据迁移。

## Open Questions

- None.
