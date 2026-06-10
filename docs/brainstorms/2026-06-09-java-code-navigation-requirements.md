---
date: 2026-06-09
topic: java-code-navigation
---

# Java Code Navigation Requirements

## Summary

在现有文件查看与 CodeMirror 编辑入口上，强化面向 `Spring Boot / Maven` 项目的 Java 代码阅读能力。第一版聚焦语义导航与问题诊断：开发者打开 Controller、Service、Mapper、Repository 等 Java 文件时，可以从方法调用跳到定义/实现，并在当前文件看到可信的 Java 诊断结果。

这不是把产品扩展成完整 IDE。目标是让当前工程工作台里的“看代码”从文本阅读升级为 Java 全栈开发者可依赖的 code intelligence surface。

---

## Problem Frame

当前项目已经有代码查看入口、CodeMirror Java 高亮、定义/引用按钮、Ctrl/Cmd 点击跳转，以及 Tauri 层的 code intelligence / OpenCode LSP 调用基础。但对 Java 全栈开发者来说，真正高频的阅读路径不是“打开一个文件看文本”，而是：

- 从一个 Spring Controller endpoint 追到 Service 方法，再追到 Mapper / Repository / client 调用。
- 打开文件时先知道语法、编译或项目索引状态是否可信。
- 当导航失败时知道是没有结果、LSP 尚未就绪、Maven/JDK 配置不可用，还是只走了启发式 fallback。

如果这些状态不清楚，错误的跳转结果比没有跳转更危险；它会让用户误判代码关系。

---

## Key Decisions

- **Java semantic navigation is the v1 center.** 第一版以 `Spring Boot / Maven` 的 Java 文件阅读为主，不把所有语言和所有 IDE 功能一起纳入。
- **LSP-first, fallback-labeled.** 语义能力优先使用 LSP 风格结果；启发式扫描只能作为 fallback，并且 UI 必须清楚标注结果来源。
- **Diagnostics must be visible before deep navigation.** 打开 Java 文件时，用户应能直接看到当前文件是否存在 error/warning 或诊断不可用状态。
- **Keep the feature inside the existing file surface.** 复用现有 File View / CodeMirror / navigation panel 心智，不新建一个独立 IDE dashboard。
- **Do not promise full IDEA parity.** 借鉴 IntelliJ IDEA 的跳定义、查用法、实现跳转和问题检查心智，但 v1 不做重构、debugger、复杂 code action、全量调用层级。

---

## Actors

- A1. Java full-stack developer：主要用户，使用 Spring Boot / Maven 项目阅读后端代码、定位接口逻辑和判断修改风险。
- A2. Code viewer surface：现有文件查看/编辑区域，承载代码、导航按钮、快捷键、结果面板和诊断提示。
- A3. Java language intelligence provider：提供 definition、implementation、references、document symbols、diagnostics 等语义结果；可能是 LSP，也可能是明确标注的 fallback。

---

## Requirements

**Semantic Navigation**

- R1. Java 文件打开到可编辑/可聚焦代码视图后，用户 SHALL 能从光标所在 symbol 执行 `Go to Definition`，结果唯一时直接跳转，多结果时展示候选列表。
- R2. 用户 SHALL 能从接口、抽象方法、父类方法或 Spring 注入类型执行 `Go to Implementation`，并看到实现类/方法候选；候选必须包含文件路径与行列位置。
- R3. 用户 SHALL 能从 Controller 方法调用一路跳到 Service、Mapper、Repository 或相关 Java 方法定义，跨文件跳转后必须保持打开文件上下文并聚焦目标位置。
- R4. 用户 SHALL 能执行 `Find References` 查看项目范围内的引用结果；结果应按文件分组或以足够可扫描的方式展示路径、行列和简短上下文。
- R5. 当结果只有一个时，导航 SHOULD 直接打开目标；当结果有多个时，系统 MUST 不随机选择，而是展示候选让用户决定。
- R6. 导航结果 MUST 标注来源状态：`semantic`、`fallback`、`unavailable` 或等价表达，避免用户把启发式结果误认为完整 Java 语义索引。

**Diagnostics**

- R7. 打开 `.java` 文件时，系统 SHALL 展示当前文件诊断摘要，包括 error/warning/info 计数、最近刷新状态，以及诊断来源。
- R8. 诊断条目 SHALL 可定位到具体行列；点击诊断后应跳到对应位置并聚焦代码。
- R9. 当 Maven/JDK/LSP 未就绪、索引中、超时或失败时，系统 SHALL 展示清楚的不可用/降级原因，而不是空白问题列表。
- R10. 诊断结果 MUST 替换旧结果或标记 stale，不能让旧文件的错误残留在新打开文件上。

**Spring Boot / Maven Fit**

- R11. 第一版 SHALL 优先覆盖 Spring Boot 常见阅读路径：Controller endpoint 方法、Service 调用、interface-to-implementation、Mapper/Repository 方法调用。
- R12. Maven 项目中的 `src/main/java`、`src/test/java`、multi-module 子模块路径 SHOULD 保持可导航；如果跨模块不可用，UI MUST 显示能力边界。
- R13. Spring 注解、接口代理、Mapper 动态实现等无法精确解析时，结果 MUST 明确降级，不得伪造确定实现。

**Usability**

- R14. File View 顶部或侧边 SHALL 提供明显但不喧宾夺主的 code intelligence controls：definition、implementation、references、diagnostics。
- R15. 快捷键 SHOULD 接近 Java IDE 用户习惯：definition、references、implementation 都应有键盘入口；现有快捷键若冲突，必须以当前应用快捷键体系为准。
- R16. Ctrl/Cmd click definition SHOULD 保留，并在不可用时给出轻量反馈。
- R17. 结果面板 MUST 支持关闭、重新执行和从结果跳转；跳转后不能丢失用户当前文件 tab 状态。

**Reliability**

- R18. 语义请求 MUST 有超时、取消或 request id guard，避免旧请求覆盖新文件结果。
- R19. 大项目、首次索引、缺依赖、Maven 未导入等状态 MUST 可解释；用户应该知道等待、配置还是改用 fallback。
- R20. 对非 Java 文件，现有轻量能力可保留，但本需求不得要求它们达到 Java v1 的语义深度。

---

## Key Flows

- F1. Controller to Service navigation
  - **Trigger:** 用户打开 `UserController.java`，光标停在 `userService.createUser(...)`。
  - **Actors:** A1, A2, A3
  - **Steps:** 用户执行 definition；系统请求语义结果；若唯一目标为 `UserService#createUser` 或实现类方法，则打开目标文件并聚焦方法名；若存在接口与多个实现，则展示候选。
  - **Outcome:** 用户能顺着 Spring 调用链继续阅读，不需要手动搜索文件。
  - **Covered by:** R1, R2, R3, R5, R11

- F2. Open file diagnostics
  - **Trigger:** 用户打开一个 `.java` 文件。
  - **Actors:** A1, A2, A3
  - **Steps:** 系统加载文件内容，同时请求或读取诊断；UI 显示 error/warning 计数；用户点击某个 error 后跳到对应行列。
  - **Outcome:** 用户在深入阅读前知道该文件当前是否有明显语法/编译问题。
  - **Covered by:** R7, R8, R9, R10

- F3. Degraded intelligence
  - **Trigger:** 用户在 Maven multi-module 项目中执行 implementation 跳转，但 Java language provider 尚未就绪。
  - **Actors:** A1, A2, A3
  - **Steps:** 系统显示 provider 状态；若有启发式 fallback 结果，按 fallback 标记展示；若没有结果，明确说明不可用原因和可重试入口。
  - **Outcome:** 用户不会把不完整结果误认为项目没有实现或没有引用。
  - **Covered by:** R6, R9, R13, R18, R19

---

## Acceptance Examples

- AE1. Controller method call jumps to Service
  - **Given:** Spring Boot Maven workspace 已打开，`UserController.java` 中光标位于 `userService.createUser`。
  - **When:** 用户执行 `Go to Definition`。
  - **Then:** 系统打开 `UserService` 或其实现方法位置；多候选时展示候选列表，不自动选择不确定目标。
  - **Covers:** R1, R3, R5

- AE2. Java diagnostics are visible and actionable
  - **Given:** 当前 `.java` 文件有一个语法或编译诊断。
  - **When:** 文件打开完成。
  - **Then:** 文件 surface 显示诊断摘要；点击诊断后跳到对应行列；切换文件后旧诊断不会继续显示为当前文件问题。
  - **Covers:** R7, R8, R10

- AE3. LSP unavailable is not silent
  - **Given:** 当前 Maven 项目缺 JDK、依赖未解析或 language provider 超时。
  - **When:** 用户执行 definition、implementation 或打开 diagnostics。
  - **Then:** UI 显示不可用/降级原因；fallback 结果带 fallback 标记；没有结果时不得只显示“无引用”。
  - **Covers:** R6, R9, R13, R19

---

## Success Criteria

- S1. 对典型 Spring Boot Controller -> Service -> Repository 阅读路径，用户可以通过语义导航完成跨文件定位，而不是靠全文搜索。
- S2. 打开 Java 文件后，用户能在同一 surface 内看到当前文件诊断摘要，并能点击定位。
- S3. 用户能区分 semantic 结果、fallback 结果和 unavailable 状态。
- S4. 现有文件查看、tab、保存、搜索和 annotation 能力不因 Java code intelligence 改造而退化。

---

## Scope Boundaries

**Deferred for later**

- 调用层级 call hierarchy / incoming calls / outgoing calls。
- Java rename / refactor / organize imports / quick fix code actions。
- Spring Bean graph、endpoint graph、JPA entity graph 的专门可视化。
- 全项目 Problems 工具窗口和批量 inspection 报告。
- Debugger、断点、运行测试、Maven lifecycle 面板。

**Outside v1 identity**

- 复刻 IntelliJ IDEA 或 VS Code 的完整 IDE。
- 把当前产品主界面替换成独立代码编辑器。
- 对所有语言承诺同等深度的 semantic navigation。

---

## Dependencies And Assumptions

- D1. 当前代码库已有 File View / CodeMirror 文件查看与编辑入口，可作为承载 surface。
- D2. 当前前端服务层已有 code intelligence 与 OpenCode LSP 相关 Tauri 调用基础，后续规划需验证 Java LSP provider 的可用性、稳定性和启动成本。
- D3. `@codemirror/lang-java` 已在依赖中存在，可覆盖 Java 语法高亮，但语义导航与 diagnostics 不能只依赖语法高亮。
- D4. Spring 动态代理、Mapper 框架、annotation-driven wiring 可能需要 Java language provider、Maven classpath 与框架知识共同作用；v1 应优先做可信降级，而不是假装完全解析。

---

## Sources And Research

- Repo code: `src/features/files/components/FileViewPanel.tsx` 已有 definition/references 控件、CodeMirror 承载和导航面板接线。
- Repo code: `src/features/files/hooks/useFileNavigation.ts` 已有 definition/references 请求、Ctrl/Cmd click、request guard、缓存和超时逻辑。
- Repo code: `src/features/files/components/FileViewNavigationPanel.tsx` 已有候选/引用结果面板。
- Repo code: `src/services/tauri.ts` 暴露 `code_intel_definition`、`code_intel_references`、`opencode_lsp_diagnostics`、`opencode_lsp_document_symbols`、`opencode_lsp_definition`、`opencode_lsp_references`。
- Repo code: `src-tauri/src/code_intel.rs` 已有 Java 在内的启发式 definition/references 支持。
- Repo code: `src-tauri/src/engine/commands_opencode.rs` 已有 OpenCode `debug lsp` diagnostics / symbols / definition / references 命令包装。
- External reference: JetBrains IntelliJ IDEA Find Usages distinguishes usages, method calls, fields, derived classes and implementing classes, and supports direct navigation when only one usage exists.
- External reference: LSP 3.17 standardizes editor/language-server communication for features such as go to definition, find references, document symbols and diagnostics.
- External reference: CodeMirror 6 provides the editor surface and language extension model; Java syntax support helps rendering, but semantic features require a provider beyond syntax highlighting.
