# TodoList 浮动窗口

## Goal

在消息区添加可拖拽的 TodoList 浮动窗口，让当前会话 todo 进度始终可见。

## Requirements

- 有 todo 数据时显示浮窗；无 todo 数据时隐藏。
- 有未完成 todo 时默认收起；全部完成时自动收起。
- 标题显示完成数/总数。
- 展开显示 todo 列表。
- 支持拖拽，位置持久化。
- 展开状态按会话持久化。
- 保留 StatusPanel todo tab，并复用同一数据源。

## Acceptance Criteria

- [ ] 当前会话有 active todo 时，消息区右上角显示收起浮窗。
- [ ] 全部 completed 时浮窗自动收起但仍显示摘要。
- [ ] 无 todo 数据时浮窗完全隐藏。
- [ ] 切换会话后恢复该会话的展开状态。
- [ ] 拖拽后刷新可恢复位置，且不会越出消息区。
