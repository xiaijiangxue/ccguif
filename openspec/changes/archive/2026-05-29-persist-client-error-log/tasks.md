# Tasks

- [x] 1.1 [P0][Input: 用户全局 `.ccgui` 路径约束][Output: client-global-error-log spec][Verify: `openspec validate persist-client-error-log --strict --no-interactive`] 定义核心错误日志持久化 contract。
- [x] 2.1 [P0][Input: `DebugEntry`, `useDebugLog`, Tauri services][Output: core error filter + sanitized client log payload][Verify: focused Vitest] 接入前端 DebugEntry 持久化旁路。
- [x] 2.2 [P0][Input: `app_paths::app_home_dir`, Tauri command registry][Output: `append_client_error_log` command writing daily JSONL][Verify: Rust unit tests] 实现后端追加写入与日期轮转。
- [x] 3.1 [P1][Input: changed frontend/backend files][Output: type/lint/test result][Verify: focused tests + typecheck/lint] 完成最小自测并记录结果。
