# Design

## Data Source

`Messages` 使用当前 render source items 调用 `useStatusPanelData`，只读取 `todos`。StatusPanel 仍按原路径读取同一 hook，保持两个 UI surface 的事实来源一致。

## Component Boundary

- `useTodoFloatingState` 负责可见性、摘要、展开状态、位置持久化与边界 clamp。
- `TodoFloatingWindow` 负责渲染标题栏、todo 列表和拖拽交互。
- 样式放在 `src/styles/todo-floating-window.css`，通过 `src/bootstrap.ts` 导入。

## Persistence

使用 `clientStorage` 的 `layout` store：

- `ccgui.todoFloating.position`: 全局窗口位置。
- `ccgui.todoFloating.expand.<sessionId>`: 每个会话独立的展开状态。

读取持久化状态时必须做类型校验和 clamp；写入时只保存有限数值和 boolean。
