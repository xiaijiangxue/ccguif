# harden-client-runtime-environment-recovery Design

## Context

当前错误日志说明客户端存在一组同源稳定性缺口：renderer、Tauri backend、managed runtime、session history、host environment 都会产生可漂移状态，但现有链路经常把这些状态当作稳定事实使用。

典型表现包括：

- `liquid-glass` 已经不是当前视觉目标，但前端仍调用 `tauri-plugin-liquid-glass-api`，native plugin registration 又已被注释，导致 optional visual capability 缺失被持续写成 error。
- Codex runtime cleanup、recovery、rate limit、model list、history load 会争抢同一个 `workspace + engine` runtime，出现 concurrent acquire 与 quarantine。
- thread/session catalog 仍可能引用已经不存在的 rollout/session file，fork from message 也可能对不存在的 ordinal 重复发起操作。
- GUI app/daemon 的 PATH 与用户 login shell 不一致，且 proxy/network 失败缺少结构化诊断，导致“CLI 已安装但 GUI 误报缺失”。

本设计要求通用跨平台修复，不能通过本机安装插件、手动清理某个 state file、或只给 macOS 注入 PATH 来解决。

## Goals / Non-Goals

**Goals:**

- 将 `liquid-glass` 从当前运行路径中移除或变成 safe no-op，避免 optional visual capability 产生 error-log 风暴。
- 用状态机与 guarded acquire 约束 runtime cleanup/recovery 并发，避免辅助读取请求触发恢复风暴。
- 对 stale session index、missing rollout file、missing fork target 做可解释、可跳过、可修复的 degraded handling。
- 建立跨平台 Environment Doctor，统一 Codex executable、PATH、proxy、network failure 的诊断语义。
- 保持正常会话发送、历史查看、设置保存、已有 error-log 最小证据链不回退。

**Non-Goals:**

- 不恢复 liquid-glass 视觉效果，不新增 glass/blur 主题系统。
- 不重做所有 runtime manager 架构，不引入 active runtime hot replacement。
- 不自动删除真实用户 session 文件；repair 只清理索引或隐藏不可恢复条目。
- 不改变 Codex/Claude/Gemini/OpenCode 的 canonical message contract。
- 不要求 Windows/Linux 提供和 macOS 相同的 native window material。

## Decisions

### Decision 1: 移除当前 `liquid-glass` runtime dependency，而不是恢复 plugin registration

当前 `useLiquidGlassEffect` 的实际行为是在关闭 native glass/blur，并调用 `window.clearEffects()`。既然产品目标不是启用 liquid-glass，就不应继续调用 `tauri-plugin-liquid-glass-api`。

实施方向：

- 前端移除 `isGlassSupported()` 与 `setLiquidGlassEffect()` 调用。
- `useLiquidGlassEffect` 改名或收敛为 window effects cleanup hook，只调用 Tauri core window effects API。
- 删除不再需要的 frontend dependency、Rust dependency、capability permission。
- 若删除 dependency 风险较高，第一阶段可保留 dependency 但不再调用；第二阶段清理依赖。
- optional visual cleanup failure 不进入 `source: "error"` 的 persisted error-log。

备选方案：

- 恢复 `.plugin(tauri_plugin_liquid_glass::init())`：放弃。它会重新引入 platform support 与视觉语义问题，且当前需求只是关闭 native glass。
- 继续捕获错误但降级 warning：只作为过渡，不是最终方案。无用调用仍会消耗噪音预算。

### Decision 2: runtime lifecycle 以 `workspace + engine + generation` 为 guard key

runtime recovery 的根因是多个来源共享同一个 runtime 但缺少统一 lease 边界。设计上应引入 generation-aware guard：

```text
RuntimeKey = workspaceId + engine
RuntimeGeneration = monotonic process/runtime identity
RuntimeState = starting | ready | stopping | stopped | recovering | quarantined
```

规则：

- 同一 `RuntimeKey` 同一时刻最多一个 automatic acquire/recovery leader。
- 非 leader 请求只能 await leader、复用结果、或返回 typed degraded outcome。
- `stopping` / `stale_reuse_cleanup` 中的 runtime 不能作为 foreground execution target。
- predecessor generation 的 late shutdown diagnostic 不能污染 successor generation。
- explicit user retry 可以打开新的 bounded attempt，但仍受 retry budget 约束。
- model list、rate limit、history load 这类辅助请求不得单独启动 aggressive recovery。

备选方案：

- 只增加更长 timeout：放弃。timeout 只能掩盖竞争，不能防止多个 acquire 源重复启动。
- 全局 runtime mutex：放弃。会把不同 workspace/engine 互相阻塞，降低并发能力。

### Decision 3: stale session 作为 catalog degraded data，而不是 fatal history truth

session 文件和索引是本地可漂移数据，不能把索引存在等同于 session 可恢复。

实施方向：

- thread list / history hydrate 在返回前验证 session path 是否存在。
- 缺失条目标记为 `missing`、`staleIndex` 或 `unrecoverableHistory`。
- UI 默认隐藏不可恢复条目，或以 degraded badge 展示，不再反复触发 hydrate/reopen。
- fork from message 前先解析目标 user message identity；ordinal 不存在时返回 typed error。
- repair/prune 只清理索引层或 client catalog reference，不删除真实 session file。

备选方案：

- 启动时全量扫描并重建所有索引：暂不采用。历史量大时成本高，且容易引入启动卡顿。
- 遇到 missing file 直接删除 thread：放弃。会丢失用户可恢复线索，不符合保守治理。

### Decision 4: Environment Doctor 做跨平台 resolver，而不是写死 macOS shell 注入

GUI process 的环境和用户 login shell 天然可能不同。正确做法是把 executable/proxy resolution 显式建模，并按平台分层探测。

Codex executable resolution 顺序：

- 所有平台：
  - user configured path
  - bundled or app-managed candidate
  - process `PATH`
  - platform common candidate paths
  - platform shell/command fallback
  - execute `codex --version` or equivalent validation
- macOS:
  - common paths 包含 `/opt/homebrew/bin`、`/usr/local/bin`、`/usr/bin`
  - fallback 可使用 login shell：`zsh -lc 'command -v codex'` 或 `$SHELL -lc`
- Windows:
  - common paths 包含 `%APPDATA%\npm`、Node/npm global bin、known install locations
  - fallback 使用 `where.exe codex`
  - PowerShell fallback 使用 `Get-Command codex -ErrorAction SilentlyContinue`
  - 结果要区分 `.exe`、`.cmd`、`.ps1` wrapper kind
- Linux:
  - common paths 包含 `/usr/local/bin`、`/usr/bin`、`$HOME/.local/bin`
  - fallback 使用 `$SHELL -lc 'command -v codex'`

Proxy/network diagnosis：

- 优先读取 GUI explicit proxy setting。
- 再读取 process env：`HTTP_PROXY`、`HTTPS_PROXY`、`ALL_PROXY`、`NO_PROXY`。
- macOS/Windows 可补充读取 system proxy，但 system proxy failure 不得覆盖 explicit proxy。
- endpoint probe 将失败归类为 `missingProxy`、`proxyUnreachable`、`dnsFailure`、`tlsFailure`、`timeout`、`httpStatus`、`unknown`。

备选方案：

- 只用 `fix-path-env` 或 login shell：放弃。Windows 不适用，daemon/app 也可能语义不一致。
- 只让用户手动填路径：不够。手动配置必须存在，但 doctor 仍需解释默认探测为什么失败。

### Decision 5: persisted error-log 增加 severity/category 边界

错误日志的价值是保留行动证据，不应被 optional capability 或 transient helper read 淹没。

规则：

- actionable failure 才写 `source: "error"`。
- optional capability missing 使用 bounded `warning` 或 debug-only，且同 key 去重。
- transient runtime state 使用 structured category，如 `runtime/transient`, `runtime/quarantined`, `environment/path-drift`。
- payload 保持脱敏和有界，不写完整 prompt、stdout、stderr、token、secret。

## Risks / Trade-offs

- [Risk] 删除 `liquid-glass` dependency 可能影响打包配置或 capability schema。
  - Mitigation: 先让 runtime path 不调用 plugin，再分阶段删除 dependency，并跑 Tauri build/typecheck。
- [Risk] runtime guard 过严可能让合法用户操作等待 leader 太久。
  - Mitigation: 区分 automatic source 与 explicit user source；用户显式 retry 可启动新的 bounded attempt。
- [Risk] stale session repair 误判可能隐藏仍可恢复的历史。
  - Mitigation: repair 默认只标记/隐藏，不删除真实文件；提供 degraded reason 和诊断入口。
- [Risk] Windows executable detection wrapper 复杂，`.cmd` / `.ps1` / `.exe` 行为不同。
  - Mitigation: resolver 返回 wrapper kind，并用平台测试覆盖 quoting 与 version probe。
- [Risk] system proxy 读取在不同 OS 权限和 API 上表现不一。
  - Mitigation: explicit proxy 与 env proxy 优先；system proxy 只做增强诊断，不作为唯一依赖。

## Migration Plan

1. 先落地 visual cleanup：
   - 移除 `liquid-glass` 调用。
   - 降低 optional visual failure 的 error-log 级别。
   - 验证启动后不再出现 `liquid-glass/apply-error`。
2. 再落地 runtime lifecycle guard：
   - 增加 generation/state 诊断字段。
   - 将 helper read 接入 transient fallback。
   - 补充 concurrent acquire targeted tests。
3. 再落地 session repair：
   - list/hydrate/fork 前做 existence 与 target validation。
   - UI 消费 typed degraded state。
4. 最后落地 Environment Doctor：
   - 抽象 platform resolver。
   - 接入 Codex doctor 和 settings/notice 展示。
   - 增加 proxy/network classification。

Rollback 策略：

- visual cleanup 可独立回滚到仅 no-op，不恢复 plugin。
- runtime guard 可通过 feature flag 或 config 降级为旧 acquire 路径，但保留 diagnostics。
- session repair 回滚时保留只读 validation，不执行 prune。
- Environment Doctor 为 additive 诊断，不替换已有 configured path 启动路径。

## Open Questions

- 是否需要对 Claude/Gemini/OpenCode 复用同一个 Environment Doctor resolver，还是本 change 仅覆盖 Codex 并保留扩展接口？
- stale session repair 是否需要显式 UI 操作入口，还是先做后台 bounded prune 和 degraded badge？
- persisted error-log 是否需要引入 `severity` 字段 schema migration，还是先复用 `source`/`label` 分类？
