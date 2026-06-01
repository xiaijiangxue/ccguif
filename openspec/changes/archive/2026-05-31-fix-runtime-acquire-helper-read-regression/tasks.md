## Tasks

- [x] 1.1 Confirm log-derived runtime errors share the acquire/recovery guard chain rather than independent model/rate/thread defects.
- [x] 1.2 Compare desktop and daemon helper read paths for `model_list` and `account_rate_limits`.
- [x] 2.1 Route daemon `model_list` through `ensure_codex_session_for_workspace` before live `model/list`.
- [x] 2.2 Route daemon `account_rate_limits` through `ensure_codex_session_for_workspace` before live `account/rateLimits/read`.
- [x] 3.1 Validate targeted Rust/runtime checks.
- [x] 3.2 Validate OpenSpec strict status for this change.
