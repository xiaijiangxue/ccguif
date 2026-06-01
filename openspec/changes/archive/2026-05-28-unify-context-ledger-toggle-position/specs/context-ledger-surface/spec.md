## ADDED Requirements

### Requirement: Context Ledger Surface SHALL Avoid Duplicate Disclosure Headers

系统 MUST 在 readiness bar 右上角拥有 Context Ledger disclosure toggle 时，避免展开后的 Context Ledger detail 再渲染重复 header 或第二个收起入口。

#### Scenario: expanded detail hides duplicate panel header

- **WHEN** 当前 Context Ledger projection 可见
- **AND** ledger detail 已通过 readiness bar 右上角 toggle 展开
- **THEN** Context Ledger detail SHALL render without its own duplicate disclosure header
- **AND** detail body SHALL continue to render truth note, groups, blocks, and management actions

#### Scenario: collapsed state does not render a separate ledger header

- **WHEN** 当前 Context Ledger projection 可见
- **AND** ledger detail 处于 collapsed 状态
- **THEN** Composer SHALL NOT render a separate Context Ledger collapsed header below the readiness bar
- **AND** the only visible disclosure action SHALL remain in the readiness bar top-right context area

#### Scenario: disclosure state does not alter send semantics

- **WHEN** 用户展开或收起 Context Ledger detail
- **THEN** existing send payload, prompt assembly, memory injection, and runtime lifecycle SHALL remain unchanged
