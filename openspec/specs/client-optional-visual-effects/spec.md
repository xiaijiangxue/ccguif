# client-optional-visual-effects Specification

## Purpose
TBD - created by archiving change harden-client-runtime-environment-recovery. Update Purpose after archive.
## Requirements
### Requirement: Optional Native Visual Effects MUST Be Safe To Disable

系统 MUST 将 native visual effects 视为 optional capability。当前产品目标为关闭 native glass/blur 时，renderer MUST NOT 调用未注册的 visual effect plugin 来完成关闭动作。

#### Scenario: disabled glass does not call missing plugin

- **WHEN** 客户端启动且当前视觉策略为关闭 native glass/blur
- **THEN** renderer MUST NOT call `tauri-plugin-liquid-glass-api`
- **AND** startup MUST NOT append `liquid-glass/apply-error` to the global error log

#### Scenario: core window effects cleanup remains available

- **WHEN** 客户端需要清理 native window effects
- **THEN** system MUST use supported Tauri core window effect APIs or a platform no-op path
- **AND** cleanup failure MUST NOT block app shell rendering

### Requirement: Optional Visual Effect Failures MUST NOT Pollute Actionable Error Logs

系统 MUST 区分 optional visual capability failure 与 actionable runtime error。Optional visual effect 缺失或不支持 MUST be bounded and non-fatal.

#### Scenario: unsupported platform degrades without persisted error

- **WHEN** Windows, Linux, or a macOS runtime does not support a requested native visual effect
- **THEN** system MUST degrade to no-op visual behavior
- **AND** system MUST NOT persist repeated `source: "error"` entries for that optional capability

#### Scenario: visual warning is deduplicated

- **WHEN** the same optional visual capability failure repeats during one app session
- **THEN** diagnostics MAY record one bounded warning or debug entry
- **AND** diagnostics MUST NOT append an unbounded stream of identical persisted error records
