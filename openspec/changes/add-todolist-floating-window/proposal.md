# add-todolist-floating-window

## Motivation

StatusPanel 的 Todo tab 需要用户主动切换才能看到进度。长时间运行会话中，todo 进度应在消息区保持可见，同时不能遮挡主阅读流。

## Scope

- 在消息区添加 TodoList 浮动窗口。
- 复用 `useStatusPanelData` 产出的当前会话 todo 数据。
- 支持展开/收起、拖拽定位、跨重启位置记忆、按会话展开状态记忆。
- 保留 StatusPanel 现有 todo tab。

## Non-goals

- 不在浮动窗内编辑、新增或完成 todo。
- 不新增独立 todo 数据源。
- 不重构 StatusPanel tab 系统。
