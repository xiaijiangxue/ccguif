# status-panel-latest-user-message-tab Specification

## Purpose

定义右下角 `dock` 状态面板中的 `用户对话` Tab 的可见性、手动查看语义、当前线程时间线范围、逐条四行截断展开、跳转锚点与空态契约，确保用户能在不改动主幕布滚动链路的前提下稳定回看当前线程的用户提问脉络。
## Requirements
### Requirement: Dock Status Panel MUST Expose User Conversation Tab Across Supported Engines

系统 MUST 在右下角 `dock` 状态面板中提供 `用户对话` Tab，并在当前已接入底部状态面板的 `Claude / Codex / Gemini` 会话中保持一致可见。

#### Scenario: dock panel shows user conversation tab for supported engines

- **WHEN** 用户进入使用底部 `dock` 状态面板的 `Claude`、`Codex` 或 `Gemini` 会话
- **THEN** 状态面板 MUST 展示 `用户对话` Tab
- **AND** 该 Tab MUST 与既有 `任务 / 子代理 / 结果 / Plan` Tab 并列存在

#### Scenario: existing tabs remain reachable after adding user conversation tab

- **WHEN** 系统将原 `最新对话` 能力升级为 `用户对话` Tab 后
- **THEN** 既有 `任务 / 子代理 / 结果 / Plan` Tab MUST 保持原有访问方式
- **AND** 新 Tab MUST NOT 替代或隐藏现有状态面板能力

### Requirement: User Conversation Tab MUST Remain Manual-Entry Only

系统 MUST 将 `用户对话` 定义为手动查看入口，不得因新的用户消息、assistant 流式输出或线程恢复而自动切换到该 Tab。

#### Scenario: new user message does not auto-switch active tab

- **WHEN** 当前线程产生新的用户消息
- **THEN** 系统 MUST 更新 `用户对话` Tab 的内容来源
- **AND** MUST NOT 自动把状态面板切换到 `用户对话` Tab

#### Scenario: reopening or restoring thread does not steal current tab focus

- **WHEN** 用户重开线程或线程历史恢复
- **THEN** 状态面板 MUST 维持当前 Tab 选择语义
- **AND** MUST NOT 因存在用户对话时间线而抢占当前已打开的其他 Tab

### Requirement: User Conversation Timeline MUST Reflect Current Thread In Reverse Chronological Order

系统 MUST 在 `用户对话` Tab 中展示当前 active thread 的全部可展示用户消息，并按时间线从新到旧排序；带图片的消息仍需显示数量摘要。

#### Scenario: tab shows multiple user messages instead of only the latest one

- **WHEN** 当前线程包含多条用户消息
- **THEN** `用户对话` Tab MUST 展示全部可展示用户消息
- **AND** 不得退化为只显示最后一条用户消息

#### Scenario: timeline is ordered from newest to oldest

- **WHEN** 当前线程包含按会话顺序排列的多条用户消息
- **THEN** `用户对话` Tab MUST 以最新消息在上、最旧消息在下的顺序展示
- **AND** 该顺序 MUST 与当前线程 `items` 的时间线顺序保持一致

#### Scenario: message with images includes count placeholder

- **WHEN** 某条用户消息包含 `1` 张或多张图片
- **THEN** 该时间线项 MUST 展示该条消息文本
- **AND** MUST 同时展示图片数量占位信息，例如 `含 2 张图片` 或等效本地化表达

#### Scenario: image-only user message still remains informative in timeline

- **WHEN** 某条用户消息没有文本但包含图片
- **THEN** 对应时间线项 MUST 至少展示图片数量占位信息
- **AND** MUST NOT 退化为空态或被忽略

#### Scenario: timeline scope follows active thread only

- **WHEN** 用户切换到另一个 thread
- **THEN** `用户对话` Tab MUST 切换为新 active thread 的用户消息时间线
- **AND** 不得显示前一个 thread 的残留内容

### Requirement: User Conversation Timeline MUST Support Per-Item Four-Line Preview With Explicit Expansion

系统 MUST 对超长用户消息先展示前 `4` 行预览，并提供显式的 `展开 / 收起` 交互；该折叠状态必须按时间线项独立工作。

#### Scenario: long message is limited to first four lines by default

- **WHEN** 某条用户消息超出默认预览长度
- **THEN** 对应时间线项 MUST 默认只展示前 `4` 行内容
- **AND** 截断后的内容 MUST 仍保持可读，不得破坏基础换行语义

#### Scenario: user can expand and collapse one message without affecting others

- **WHEN** 用户点击某条长消息的 `展开`
- **THEN** 状态面板 MUST 只展开该条用户消息的完整内容
- **AND** 其他时间线项 MUST 保持各自原有折叠状态

### Requirement: User Conversation Timeline MUST Support Jumping To The Main Conversation Anchor

系统 MUST 允许用户从 `用户对话` 时间线项跳转到主幕布中对应的消息锚点，且不得引入额外的 tab 自动切换副作用。

#### Scenario: clicking timeline item jumps to the corresponding message anchor

- **WHEN** 用户点击某条时间线项的跳转入口
- **THEN** 系统 MUST 滚动主幕布到对应 `message id` 的消息锚点
- **AND** 当前状态面板 tab 选择 MUST 保持不变

#### Scenario: missing anchor does not break timeline interaction

- **WHEN** 某条时间线项对应的主幕布锚点当前不存在
- **THEN** 跳转动作 MUST 安静失败
- **AND** 状态面板其它时间线内容与交互 MUST 保持可用

### Requirement: User Conversation Tab MUST Provide Stable Empty State

当当前 active thread 尚无可展示的用户消息时，系统 MUST 提供稳定空态。

#### Scenario: thread without user message shows empty state

- **WHEN** 当前 active thread 不存在任何用户消息
- **THEN** `用户对话` Tab MUST 显示 `暂无用户对话`
- **AND** MUST NOT 展示旧线程残留文本或无意义占位内容

### Requirement: First Phase MUST Stay Dock-Scoped And Backward Compatible

该能力第一阶段 MUST 严格限制在右下角 `dock` 状态面板，并保持既有状态面板默认行为向后兼容。

#### Scenario: popover status panel does not gain user conversation tab in phase one

- **WHEN** 用户使用输入框上方的 popover 状态面板
- **THEN** 系统 MUST NOT 在该形态下新增 `用户对话` Tab
- **AND** 该限制 MUST 视为第一阶段的明确边界

#### Scenario: existing default tab strategy remains unchanged

- **WHEN** 系统接入 `用户对话` Tab 后
- **THEN** 状态面板默认激活 Tab 策略 MUST 保持原有行为
- **AND** 新能力 MUST 作为附加入口存在，而不是改变默认打开页

### Requirement: Dock User Conversation Tab MUST Remain Reachable In Collapsed Baseline Dock

系统 MUST 在底部 `dock` 状态面板折叠时继续保留 `用户对话` tab bar 入口；折叠态只隐藏内容区，不得卸载整个 dock 或移除 baseline tab bar。

#### Scenario: collapsed dock keeps user conversation tab visible

- **WHEN** 当前 active thread 存在且底部 activity panel 的 `用户对话` 控制项可见
- **AND** 底部状态面板处于折叠态
- **THEN** 系统 MUST 继续挂载底部 `dock` 状态面板
- **AND** `用户对话` tab MUST 仍然显示在 tab bar 中
- **AND** `用户对话` 内容区 MAY 被隐藏直到用户展开 dock

#### Scenario: OpenCode session keeps user conversation baseline entry

- **WHEN** 用户进入 `OpenCode` 会话且底部 activity panel 的 `用户对话` 控制项可见
- **THEN** 系统 MUST 像 `Claude / Codex / Gemini` 会话一样保留 `用户对话` tab 入口
- **AND** 系统 MUST NOT 因当前引擎为 `OpenCode` 而卸载底部 baseline dock

### Requirement: Composer MUST NOT Duplicate Bottom Dock Collapse Control

系统 MUST 避免在主 Composer 工具栏中展示与底部 `dock` 状态面板折叠/展开语义重复的 status panel toggle；底部 dock 的折叠控制应由 dock 自身入口承担。

#### Scenario: main composer omits duplicate status panel toggle

- **WHEN** 底部 `dock` 状态面板已经作为独立底部面板挂载
- **THEN** 主 Composer 工具栏 MUST NOT 展示重复的 layers/status-panel toggle icon
- **AND** 用户仍 MUST 能通过底部 dock 自身的折叠/展开控件控制面板

