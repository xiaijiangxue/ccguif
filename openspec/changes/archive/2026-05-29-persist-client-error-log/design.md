# persist-client-error-log Design

## 方案选择

| 方案 | 做法 | 优点 | 缺点 | 结论 |
| --- | --- | --- | --- | --- |
| A. 只扩展 diagnostics bundle | 用户手动点击导出时收集 DebugEntry | 复用现有入口，落盘集中 | 卡住或重启前用户未必会导出，不能解决“我不会看日志”的问题 | 不选 |
| B. 前端直接写文件 | renderer 侧用文件 API 写入 `.ccgui` | 接入快 | 浏览器环境不可稳定访问用户 home；绕过 Tauri 安全边界 | 不选 |
| C. Tauri command + DebugEntry 旁路 | 前端筛选核心 DebugEntry，调用 Rust append command 写 JSONL | 复用现有 `.ccgui` 路径和 Tauri 权限边界；主流程可保持 best-effort | 增加一个跨层命令和 sanitizer 维护点 | 采用 |

## 数据流

1. `useDebugLog.addDebugEntry(entry)` 继续作为 DebugEntry 汇入口。
2. 新增 `shouldPersistClientErrorLogEntry(entry)` 只放行核心错误：
   - `source === "error"` 或 `source === "stderr"`
   - thread/session 结算 rejected
   - terminal settlement busy residue / terminal settlement rejected 等卡住相关诊断
3. 新增 `buildClientErrorLogEntry(entry)` 输出脱敏、有界 payload。
4. 前端通过 `append_client_error_log` Tauri command fire-and-forget 写入。
5. Rust command 使用 `app_paths::app_home_dir()` 解析 `.ccgui`，创建 `error-log`，追加 `YYYY-MM-DD.jsonl`。

## JSONL 结构

每行是一个 JSON object：

- `timestamp`: ISO string，来自 DebugEntry timestamp 或当前时间
- `source`: `client | server | event | stderr | error`
- `label`: 有界字符串
- `payload`: sanitizer 后的 JSON value
- `schemaVersion`: 固定版本号

## 脱敏与有界策略

- key 命中 `token/password/secret/apiKey/authorization/cookie` 时输出 `[redacted]`。
- key 命中 `prompt/content/text/output/stdout/stderr/raw/delta` 时输出 `{ redactedText: true, length }`。
- 其他长字符串截断到固定上限并保留原长度。
- 嵌套深度与数组长度有上限，避免大型 payload 导致 UI 或文件写入放大。
- Rust 侧再次限制单行 JSON 大小，防止前端遗漏导致无限写入。

## 失败处理

日志写入失败不得递归生成新的 DebugEntry，避免错误日志系统反过来制造错误风暴。前端调用采用 best-effort；Rust command 返回可诊断错误用于单元测试和未来手动入口。

## 回滚

回滚只需移除前端 DebugEntry 持久化旁路、Tauri service wrapper、Rust command 和 OpenSpec delta。由于不改变业务状态模型、不修改对话生命周期主路径，回滚风险低。
