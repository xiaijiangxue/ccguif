## ADDED Requirements

### Requirement: Open File Tabs MUST Provide Detached File Open Affordance

已打开文件 tab MUST 提供独立窗口打开入口，使用户可以从主编辑区 tab 直接在新的 detached file explorer 实例中打开对应文件。

#### Scenario: tab detached icon opens that tab file

- **WHEN** 用户点击已打开文件 tab 上的独立窗口 icon
- **THEN** 系统 MUST 创建新的 detached file explorer 窗口实例
- **AND** detached file explorer MUST 将该 tab 对应文件作为初始打开文件

#### Scenario: tab detached icon opens an independent screen

- **WHEN** 用户连续点击一个或多个文件 tab 上的独立窗口 icon
- **THEN** 每次点击 MUST 创建独立的 detached file explorer 窗口实例
- **AND** 新实例 MUST NOT 复用或重定向既有 tab detached window

#### Scenario: tab detached window prioritizes reading space

- **WHEN** detached file explorer 由文件 tab 独立窗口 icon 创建
- **THEN** 该窗口 MUST 默认收起左侧 file tree sidebar
- **AND** 用户 MUST 仍可通过窗口内 sidebar toggle 重新展开
- **AND** 该默认折叠偏好 MUST 在 per-window session 异步恢复后仍生效

#### Scenario: detached file window can be dragged from its chrome

- **WHEN** 用户打开文件 tab 的独立窗口实例
- **THEN** 窗口顶部 menubar MUST 提供可拖拽区域
- **AND** menubar 标题文字区域 MUST NOT 阻断窗口拖拽
- **AND** 动态 `file-explorer-*` 窗口 MUST 拥有与固定 `file-explorer` 窗口一致的 Tauri window capability
- **AND** 文件内容 header、tab 主按钮、detached icon 与 close button MUST NOT 被改造成窗口拖拽区

#### Scenario: tab detached icon does not replace tab activation or close semantics

- **WHEN** 用户点击已打开文件 tab 上的独立窗口 icon
- **THEN** 系统 MUST NOT 关闭该 tab
- **AND** 系统 MUST NOT 因该按钮点击触发 tab 主区域的激活逻辑

#### Scenario: detached open failure is recoverable

- **WHEN** detached file explorer 创建、聚焦或 session 发送失败
- **THEN** 系统 MUST 向用户展示可恢复错误反馈
- **AND** 当前文件 tab 与主编辑区 MUST 保持可用
