## ADDED Requirements

### Requirement: Appearance Settings MUST Control Whole-Client Window Transparency

系统 MUST 在外观设置中提供客户端整体窗口透明度控制，并保持主题模式与主题 preset 的既有语义不变。

#### Scenario: window transparency controls are visible in appearance settings

- **WHEN** 用户打开 `设置 -> 基础设置 -> 外观`
- **THEN** 系统 MUST 展示窗口透明开关
- **AND** 当前开关状态 MUST 与持久化偏好一致

#### Scenario: enabling window transparency applies immediately

- **WHEN** 用户打开窗口透明开关
- **THEN** 系统 MUST 在当前窗口即时调用 native window opacity 能力
- **AND** 应用重启 MUST NOT be required
- **AND** 系统 MUST NOT 通过 renderer `.app` CSS opacity 或局部 panel/surface alpha 来替代 native 窗口透明

#### Scenario: whole-window opacity is configurable when enabled

- **WHEN** 窗口透明已开启
- **THEN** 系统 MUST 展示整体透明度 slider
- **AND** 用户调整百分比后系统 MUST 持久化透明度并即时更新 native 当前窗口
- **AND** 透明度 MUST 被限制在可读范围内

#### Scenario: invalid window opacity falls back safely

- **WHEN** 持久化的整体透明度缺失、非法或越界
- **THEN** 系统 MUST 使用安全默认透明度
- **AND** 设置页与主界面 MUST 保持可用

### Requirement: Whole-Client Transparency MUST Be Cross-Platform Safe

系统 MUST 在 Windows、macOS、Linux 上安全处理窗口透明能力，native/window effect 不可用时必须降级而不是中断 UI。

#### Scenario: transparent window support is available

- **WHEN** 当前平台与运行环境支持 native window opacity
- **THEN** 系统 SHOULD 透出窗口背后的桌面/应用内容
- **AND** `.app` 根节点 MUST NOT 使用 CSS opacity 模拟窗口透明

#### Scenario: transparent window support is unavailable

- **WHEN** 当前平台、compositor 或运行环境不支持 native window opacity
- **THEN** 系统 MAY 退化为普通不透明窗口
- **AND** 用户操作、设置保存与窗口渲染 MUST 继续正常工作

#### Scenario: native window opacity call fails

- **WHEN** native window opacity 调用失败
- **THEN** 系统 MUST 记录可诊断信息
- **AND** MUST NOT 抛出未处理异常、白屏或阻止设置保存

### Requirement: Window Transparency Changes MUST Respect Large File Governance

窗口透明实现涉及 stylesheet 或窗口配置时，系统 MUST 遵守 large-file governance workflow 的 near-threshold 与 hard gate 约束。

#### Scenario: stylesheet changes are validated by large file sentry

- **WHEN** 窗口透明改动修改 CSS 或相关测试治理文件
- **THEN** 验证流程 MUST include large-file sentry commands aligned with `.github/workflows/large-file-governance.yml`
- **AND** 新增样式 SHOULD remain scoped and minimal instead of expanding already-large files unnecessarily
