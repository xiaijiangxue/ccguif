## MODIFIED Requirements

### Requirement: 开关控制

系统 MUST 将历史"上下文注入开关"收敛为固定关闭态，并提供 Composer 级显式 Memory Reference 入口作为唯一记忆参考入口。该入口 MUST 支持单次开启与持续开启两种用户显式选择的生命周期。

#### Scenario: 历史开关默认关闭

- **WHEN** 系统初始化对话发送链路
- **THEN** 历史上下文自动注入状态 SHALL 视为 false

#### Scenario: 本地存储值不再驱动静默自动注入

- **WHEN** localStorage 中存在 `projectMemory.contextInjectionEnabled=true`
- **THEN** 系统 SHALL NOT 因该值恢复静默自动注入
- **AND** 静默自动注入能力保持关闭

#### Scenario: Composer Memory Reference 默认关闭

- **WHEN** 用户打开 Composer
- **THEN** Memory Reference 入口 SHALL 默认处于关闭状态
- **AND** 系统 SHALL NOT 查询 Project Memory

#### Scenario: 用户显式开启单次记忆参考

- **WHEN** 用户点击 Composer 底部 Memory Reference icon
- **AND** 在确认面板中选择 `单次开启引用`
- **THEN** Memory Reference SHALL 进入 single 状态
- **AND** 本次发送 SHALL 触发 Memory Scout
- **AND** 该状态 SHALL NOT 自动变成全局永久设置
- **AND** 本次发送完成后 Memory Reference SHALL 回到关闭状态

#### Scenario: 用户显式开启持续记忆参考

- **WHEN** 用户点击 Composer 底部 Memory Reference icon
- **AND** 在确认面板中选择 `一直开启引用`
- **THEN** Memory Reference SHALL 进入 always 状态
- **AND** 本次发送和后续发送 SHALL 触发 Memory Scout
- **AND** 该状态 SHALL NOT 写入全局设置或 localStorage
- **AND** 发送完成后 Memory Reference SHALL 保持 always 状态，直到用户手动关闭或上下文清理

#### Scenario: 用户手动关闭已开启的记忆参考

- **WHEN** Memory Reference 处于 single 或 always 状态
- **AND** 用户点击 Composer 底部 Memory Reference icon
- **THEN** Memory Reference SHALL 回到关闭状态
- **AND** 后续发送 SHALL NOT 触发 Memory Scout，除非用户再次显式开启

### Requirement: 前端消息注入

系统 MUST 在用户发送消息前采用"手动选择优先 + 显式 Memory Reference"注入策略，不再执行静默自动相关性检索注入。

#### Scenario: 未手动选择且未开启 Memory Reference 时不注入

- **WHEN** 用户发送消息且本次未手动选择任何记忆
- **AND** Composer Memory Reference 未处于 single 或 always 状态
- **THEN** 系统 SHALL 直接发送用户原始文本
- **AND** SHALL NOT 自动调用相关性注入流程

#### Scenario: 手动选择后注入

- **WHEN** 用户在本次发送前手动选择了项目记忆
- **THEN** 系统 SHALL 注入这些已选记忆
- **AND** 注入块 SHALL 追加在用户原始文本前
- **AND** 注入来源 SHALL 标记为 `manual-selection`

#### Scenario: 开启 Memory Reference 后注入 Brief

- **WHEN** 用户将 Composer Memory Reference 设为 single 或 always 并发送消息
- **THEN** 系统 SHALL 在发送前执行 Memory Scout 查询
- **AND** 若 Scout 返回可用 Memory Brief，系统 SHALL 注入 Brief
- **AND** 注入来源 SHALL 标记为 `memory-scout`

#### Scenario: 手动选择与 Memory Reference 并存

- **WHEN** 用户已手动选择记忆
- **AND** 同时将 Memory Reference 设为 single 或 always
- **THEN** 系统 SHALL 同时保留 `manual-selection` 和 `memory-scout` 两类来源
- **AND** UI SHALL 区分显示两类注入来源

#### Scenario: 注入记忆作为独立关联资源展示

- **GIVEN** 用户消息包含 `manual-selection` 或 `memory-scout` 的 Project Memory 注入块
- **WHEN** 系统在消息时间线中渲染该轮对话
- **THEN** Project Memory 引用 SHALL 作为独立关联资源卡片展示
- **AND** SHALL NOT 与用户可见输入气泡混排
- **AND** Claude、Codex 和 Gemini 路径 SHALL 使用一致的展示语义

#### Scenario: Codex 历史回放保留 Project Memory 关联资源

- **GIVEN** Codex 历史记录中的 user payload 原始文本包含 `<project-memory source="memory-scout">` 或 `<project-memory source="manual-selection">`
- **WHEN** 系统从 remote resume 或 local JSONL history 回放该线程
- **THEN** history loader SHALL 保留 Project Memory 注入块供消息渲染层解析
- **AND** 用户可见气泡 SHALL 只显示真实用户输入
- **AND** Project Memory 引用 SHALL 独立显示为关联资源卡片

#### Scenario: 当次发送后清理单次上下文

- **WHEN** 注入发送完成（成功或失败后收敛）
- **THEN** 系统 SHALL 清空本次手动选择集合
- **AND** single Memory Reference SHALL 回到关闭状态
- **AND** always Memory Reference SHALL 保持开启状态
