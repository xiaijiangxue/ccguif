---
date: 2026-06-14
topic: jdtls-navigation-priority
---

# JDTLS Navigation Priority Requirements

## Summary

将 Java 文件的跳转到定义从纯正则搜索（code_intel）切换为 JDTLS 语义导航优先、正则兜底的双层策略，并在检测到 Maven/Gradle 项目时后台预热 JDTLS，让 Cmd-B 跳转大概率即时响应。

---

## Problem Frame

当前 `useFileNavigation` 的定义跳转和引用查找只调用 `code_intel_definition`（正则扫描），而 JDTLS 后端（`jdtls_definition`、`jdtls_references`）和前端封装（`getJdtlsDefinition`、`getJdtlsReferences`）已完整存在但从未被导航流程调用——是死代码。JDTLS 仅被用于 Diagnostics。

正则扫描的问题：无类型解析、无 import 解析、无法区分同名不同类的方法，导致 Spring Boot 项目中 Controller -> Service -> Repository 的跳转经常定位到错误位置或返回过多候选。JDTLS 可以提供真正的语义跳转，但需要初始化和索引时间。

此外，JDTLS 的 `initializationOptions` 当前传 `None`，导致语言服务器不知道 JDK 路径和 Maven 配置，索引可能慢或失败。

---

## Key Decisions

- **Smart warmup over lazy start.** 不等到首次导航请求才启动 JDTLS，而是在检测到 pom.xml/build.gradle 时后台预热。与 VS Code Java 扩展策略一致：用户按 Cmd-B 时大概率已就绪。
- **Try JDTLS during indexing, fall back on empty.** 索引期间仍发送 JDTLS 请求（可能返回部分结果），空结果时自动回退正则。不阻塞用户，类似 VS Code 行为。
- **Fix initializationOptions as prerequisite.** 补全 JDTLS `initializationOptions`（runtimes、maven.downloadSources、updateBuildConfiguration），否则预热效果打折扣。这是技术前置条件，不是可选优化。
- **Non-Java files stay regex-only.** Python/Go/TS/YAML 继续使用现有 code_intel 引擎，本次不扩展。

---

## Requirements

**JDTLS Activation**

- R1. When JDTLS status is `ready`，definition 和 references 请求 SHALL 优先发送到 `jdtls_definition` / `jdtls_references`；结果为空时自动回退到 `code_intel_definition` / `code_intel_references`。
- R2. When JDTLS status is `starting` 或 `indexing`，SHALL 仍尝试发送请求到 JDTLS；JDTLS 返回空或错误时回退正则，并在 UI 上显示 JDTLS 加载中的轻量提示。
- R3. When JDTLS status 是 `unavailable` 或 `stopped`，SHALL 直接使用 code_intel 正则引擎，不尝试 JDTLS。
- R4. Navigation 结果 MUST 标注来源（semantic / fallback），延续 2026-06-09 需求文档 R6 的要求。

**Smart Warmup**

- R5. 当工作区根目录或一级子目录存在 `pom.xml` 或 `build.gradle`（含 `.kts`）时，系统 SHOULD 在工作区打开后自动触发 JDTLS 后台启动（`ensure_started`），不需要用户执行导航操作。
- R6. 预热触发 SHOULD 与现有 diagnostics 文档同步（`textDocument/didOpen`）协同：首次打开 Java 文件时同时触发 JDTLS 启动和文件内容同步。
- R7. JDTLS -data 目录 SHOULD 持久化索引（已有实现），后续启动应比首次快很多。如果 -data 缓存存在，状态从 `starting` 到 `ready` 应在数秒内完成。

**Document Sync**

- R8. 当导航流程切换到 JDTLS 时，SHALL 确保当前打开的 Java 文件已通过 `textDocument/didOpen` 同步到 JDTLS。如果尚未同步，SHALL 先发送 `didOpen` 再发送 definition 请求。
- R9. 文件内容变化后（CodeMirror onChange），SHALL 发送 `textDocument/didChange` 保持 JDTLS 文档状态同步，确保后续导航请求基于最新内容。

**Initialization Options**

- R10. JDTLS `initialize` 请求的 `initializationOptions` SHALL 包含 `settings.java.configuration.updateBuildConfiguration: automatic`，使 JDTLS 自动导入 Maven/Gradle 项目模型。
- R11. `initializationOptions` SHOULD 包含用户配置的 JDK 路径（`settings.java.configuration.runtimes`），避免 JDTLS 自行搜索 JDK。
- R12. `initializationOptions` SHOULD 包含 `settings.java.maven.downloadSources: true`，启用依赖源码导航。

**UX Continuity**

- R13. 现有 Cmd-B / Ctrl+Click / Alt-F7 快捷键和按钮行为 MUST 不变——变的只是底层 provider 优先级和结果来源标注。
- R14. 当 JDTLS 返回结果与正则结果不同时（如 JDTLS 找到接口定义而正则找到所有同名方法），SHALL 优先展示 JDTLS 结果。
- R15. JDTLS 状态指示器（已有 `ProviderStatusBadge`）SHALL 继续可见，让用户知道语义引擎是否可用。

---

## Scope Boundaries

**Deferred for later**

- `textDocument/hover`（悬停提示）：JDTLS 已声明 hoverProvider 能力，但当前无 `jdtls_hover` 命令，后续可扩展。
- `textDocument/completion`（代码补全）：需要编辑器侧的补全集成，复杂度高。
- `textDocument/implementation`（跳转到实现）：前端封装 `getJdtlsImplementation` 已存在但未接入导航，可后续启用。
- `$/progress` 通知监听：当前 `LspClient` 只处理请求响应，不处理服务器主动通知。启用后可显示精确的索引进度。

**Outside scope**

- 非 Java 文件的语义导航。
- 完整 IDE 功能（调试、重构、Maven lifecycle）。

---

## Dependencies And Assumptions

- D1. JDTLS 后端集成（`jdtls/commands.rs`、`jdtls/manager.rs`、`jdtls/lsp_client.rs`）已完整存在，主要缺失的是导航流程的接入和 `initializationOptions` 配置。
- D2. JDTLS `-data` 目录持久化已实现（`compute_project_hash`），后续启动复用索引的前提是 workspace root 路径不变。
- D3. JDTLS 需要 JDK 17+ 才能运行；用户机器上必须有可用的 JDK，否则 `jdtls_get_status` 会返回 `unavailable`。
- D4. 正则引擎（`code_intel.rs`）作为永久 fallback 保留，不受本次变更影响。

---

## Sources And Research

- Repo code: `src-tauri/src/jdtls/commands.rs` -- `jdtls_definition` / `jdtls_references` 已实现但未被导航调用。
- Repo code: `src-tauri/src/jdtls/manager.rs` -- `ensure_started` 和 `initializationOptions`（当前 `None`，需补全）。
- Repo code: `src-tauri/src/code_intel.rs` -- 正则引擎，作为 fallback 保留。
- Repo code: `src/features/files/hooks/useFileNavigation.ts` -- 导航入口，当前只调用 code_intel。
- Repo code: `src/features/files/hooks/useJdtlsState.ts` -- JDTLS 状态轮询，仅用于 UI 指示器。
- Repo code: `src/services/tauri.ts` -- `getJdtlsDefinition` / `getJdtlsReferences` 封装已存在。
- External reference: VS Code redhat.java 扩展在检测到 pom.xml/build.gradle 时自动启动 JDTLS，索引期间仍响应导航请求。
- External reference: IntelliJ IDEA 在项目打开时立即扫描构建文件并启动索引，状态栏显示进度。
- Related brainstorm: `docs/brainstorms/2026-06-09-java-code-navigation-requirements.md` -- 整体 Java 导航需求（R6 来源标注、R19 状态可解释）。
