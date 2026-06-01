# persist-client-error-log Proposal

## 目标与边界

用户遇到偶发“对话已经结束但 UI 仍显示生成中”的问题时，当前排障依赖应用内 Debug 面板或诊断包导出。这个路径对普通用户不够直接：客户端卡住后，用户未必知道怎么保存核心证据，也可能因为重启丢失现场。

本 change 增加一个最小持久化错误日志通道：当客户端产生核心 error、stderr、thread/session settlement failure 或终端结算残留类诊断时，将脱敏后的摘要追加写入用户全局目录 `~/.ccgui/error-log/YYYY-MM-DD.jsonl`。

## 非目标

- 不实现自动三证结算、自动结束 stuck turn 或任何 runtime 状态修复策略。
- 不记录完整用户 prompt、assistant 输出、工具输出、stdout/stderr 全文、token、密码或 auth 文件内容。
- 不新增 UI 配置项，不要求用户手动导出。
- 不替代 diagnostics bundle；该日志只作为重启后仍可取到的核心错误证据。

## 关键约束

- 文件路径 MUST 使用现有用户全局 `.ccgui` 目录规则。
- 日志 MUST 按本地日期每日轮转，格式 MUST 是 append-only JSONL。
- 日志写入 MUST best-effort，失败不得影响对话、终端、设置或 Debug 面板主流程。
- payload MUST 有界并脱敏，避免把长文本和敏感信息落盘。

## 验收标准

- 核心 DebugEntry 会触发一次 Tauri 写入命令，普通 client/event 诊断不会大量落盘。
- Rust command 会创建 `~/.ccgui/error-log` 并按日期追加 JSONL。
- JSONL 行包含 timestamp、source、label、payload 摘要等排障字段。
- 前端 sanitizer 会遮蔽 token/password/secret/key，并把 prompt/content/output/stdout/stderr 等长文本字段降级为长度摘要。
