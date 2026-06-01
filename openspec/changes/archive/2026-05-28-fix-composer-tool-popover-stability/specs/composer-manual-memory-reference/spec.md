# composer-manual-memory-reference Specification Delta

## Modified Requirements

### Requirement: 输入工具记忆引用弹层稳定

系统 MUST 在 Composer 输入工具区稳定展示记忆引用模式弹层，避免弹层被父级容器、sidebar 或 viewport 边界遮挡，并确保弹层内部操作可被可靠点击。

#### Scenario: memory reference popover is rendered as viewport-aware overlay

- **GIVEN** 用户已展开 Composer 输入工具区
- **WHEN** 用户点击记忆引用按钮并打开模式选择弹层
- **THEN** 弹层 MUST 以 viewport-aware overlay 渲染
- **AND** 弹层 MUST NOT 被 Composer toolbar 父容器裁剪
- **AND** 弹层 MUST NOT 被左侧 sidebar stacking context 遮挡

#### Scenario: clicking memory reference actions remains stable

- **GIVEN** 记忆引用模式选择弹层处于打开状态
- **WHEN** 用户点击弹层内的取消、关闭、单次启用或始终启用操作
- **THEN** outside-click 关闭逻辑 MUST NOT 在该操作执行前卸载弹层
- **AND** 用户选择的模式 MUST 按原有语义提交

#### Scenario: outside click and Escape still close memory reference popover

- **GIVEN** 记忆引用模式选择弹层处于打开状态
- **WHEN** 用户点击弹层与触发按钮之外的区域或按下 Escape
- **THEN** 弹层 SHOULD 关闭
- **AND** 不应改变当前记忆引用模式
