---
date: 2026-06-13
topic: mybatis-ide-navigation
---

# MyBatis Mapper + Java IDE-Level Navigation Requirements

## Summary

为 ccgui 构建 IDEA 级代码导航能力：通用 Java 语义导航由 JDTLS（Eclipse JDT Language Server）提供，MyBatis Mapper 专属导航由 Rust 后端原生索引器提供，前端在现有 File View 上扩展 gutter 图标、hover 预览、结果面板和诊断界面。目标是让用户在 ccgui 中阅读 Spring Boot + MyBatis 项目代码时，获得接近 IntelliJ IDEA 的跳转、查找和诊断体验。

---

## Problem Frame

Java 全栈开发者阅读 Spring Boot + MyBatis 项目时，最高频的操作不是"打开文件看文本"，而是沿着调用链跨文件跳转：从 Controller 追到 Service，从 Service 追到 Mapper 接口，再从 Mapper 接口跳到对应的 XML SQL 定义。当导航能力缺失或不准确时，开发者被迫全文搜索文件名、肉眼比对 namespace，阅读效率大幅下降。

当前 ccgui 已有代码查看入口、CodeMirror Java 高亮、基础的 definition/references 按钮，以及 `code_intel.rs` 的启发式扫描。但这些能力存在三个核心缺口：

1. **没有 MyBatis 感知**：系统不知道 Mapper 接口和 XML 之间的 namespace + id 对应关系，无法在两者之间跳转。
2. **Java 语义深度不足**：启发式扫描无法理解接口-实现关系、继承链、方法重写等 Java 类型系统特征。
3. **没有诊断能力**：用户无法在打开文件时看到编译错误、Mapper 配置不一致等问题。

如果这些能力缺失，错误的跳转结果比没有跳转更危险——它会让用户误判代码关系。

---

## Key Decisions

- **JDTLS for Java, Rust native for MyBatis.** 通用 Java 语义导航交给 Eclipse JDT Language Server——Java 领域最成熟的开源 LSP，提供 definition、references、implementation、diagnostics、completion 等完整能力。MyBatis Mapper ↔ XML 导航由 Rust 后端构建原生索引器——namespace + id 的匹配规则是确定性的，不需要 LSP 开销即可达到 100% 准确率。两者通过统一前端接口组合。
- **MyBatis 导航独立于 JDTLS。** JDTLS 依赖 JDK 运行时；MyBatis Mapper 导航不依赖 JDK，即使 JDTLS 不可用，Mapper ↔ XML 跳转、SQL 预览、Mapper 校验仍应正常工作。两层导航能力各自独立降级。
- **自动检测 + 引导配置。** 系统自动识别 Maven/Gradle 项目结构、读取 `application.yml`/`application.properties` 中的 `mybatis.mapper-locations` 配置，构建索引。当自动检测失败时（多模块路径复杂、配置非标准），引导用户手动指定 XML 扫描路径。
- **UI 心智对齐 IDEA。** gutter 图标、hover 预览、导航结果面板、诊断面板、快捷键——所有视觉交互遵循 IDEA + MyBatisX 的设计约定，不发明新范式。
- **Provider 状态透明。** 导航按钮旁始终显示当前 provider 状态（JDTLS ready / indexing / unavailable / fallback），用户能区分语义结果和启发式结果。

---

## Actors

- A1. Java full-stack developer：主要用户，使用 Spring Boot + MyBatis 项目阅读后端代码、定位接口逻辑、追踪 Mapper 调用链。
- A2. File View surface：现有文件查看/编辑区域，承载 CodeMirror 代码、导航按钮、gutter 图标、hover 预览、结果面板和诊断提示。
- A3. JDTLS provider：Eclipse JDT Language Server 实例，提供 Java 语义导航（definition、implementation、references、diagnostics、symbols）。
- A4. MyBatis index provider：Rust 后端 MyBatis 索引器，提供 Mapper ↔ XML 导航、SQL 预览、Mapper 校验诊断。
- A5. Project detection service：项目结构自动识别服务，检测 Maven/Gradle 项目、JDK 版本、mapper-locations 配置。

---

## Requirements

**Java Language Navigation (JDTLS)**

- R1. 打开 Java 文件并聚焦代码后，用户 SHALL 能从光标所在 symbol 执行 `Go to Definition`，结果唯一时直接跳转，多结果时展示候选列表。候选 MUST 包含文件路径、行号和 symbol 上下文。
- R2. 用户 SHALL 能从接口方法、抽象方法或父类方法执行 `Go to Implementation`，查看所有实现类/方法候选。候选 MUST 包含文件路径、行号和实现类名。
- R3. 用户 SHALL 能执行 `Find Usages` 查看项目范围内 symbol 的所有使用位置；结果 MUST 按 Java references 和 MyBatis references 分组展示，每条结果包含文件路径、行列和代码上下文。
- R4. 用户 SHALL 能通过 `Go to Super Method` 从 override 方法导航到父类/接口中的声明方法。
- R5. 用户 SHALL 能从字段声明跳转到字段类型的定义位置（Go to Type）。
- R6. JDTLS 提供的导航结果 MUST 标记为 `semantic` 来源，与 MyBatis 索引器和启发式 fallback 结果明确区分。

**MyBatis Mapper Navigation**

- R7. 用户 SHALL 能从 Mapper 接口方法跳转到对应的 XML `<select>/<insert>/<update>/<delete>` 语句（Go to XML Statement）；匹配规则为 namespace（接口全限定名）+ method name = XML statement id。
- R8. 用户 SHALL 能从 XML statement 的 `id` 属性跳转回 Mapper 接口方法（Go to Mapper Method）；这是 R7 的反向导航。
- R9. 当 Mapper 接口方法使用 `@Select`/`@Insert`/`@Update`/`@Delete` 注解定义 SQL 时，用户 SHALL 能 hover 查看完整 SQL 内容，不需要跳转到其他文件。
- R10. 当 SQL 定义在 XML 中时，用户 SHALL 能通过 hover 预览查看该方法对应的 SQL 内容（包含 SQL 类型标签：SELECT/INSERT/UPDATE/DELETE）。
- R11. 用户 SHALL 能从 `<select>` 等标签的 `resultMap` 属性跳转到对应的 `<resultMap>` 定义（ResultMap 导航）。
- R12. 对于 MyBatis-Plus `BaseMapper<T>` 的内置 CRUD 方法（selectById、insert、updateById 等），系统 SHALL 提供导航提示说明这些方法由 MyBatis-Plus 动态生成，不存在对应的 XML statement 或注解 SQL。当实体类 `T` 可解析时，SHOULD 显示实际执行的 SQL 逻辑概要。
- R13. Mapper ↔ XML 导航 MUST 独立于 JDTLS 工作。即使 JDK 不可用或 JDTLS 未就绪，Mapper ↔ XML 跳转、SQL 预览 SHOULD 正常工作。

**Diagnostics and Validation**

- R14. JDTLS 提供的 Java 诊断（编译错误、警告、未解析引用等）SHALL 在文件打开时自动加载，并以行内标记和诊断面板形式展示。诊断 MUST 支持点击跳转到对应行列。
- R15. 系统 SHALL 对 Mapper 接口与 XML 的一致性执行校验：
  - 接口中声明的方法在 XML 中无对应 statement id → 警告 "Missing XML statement"
  - XML 中的 statement id 在接口中无对应方法 → 警告 "Missing interface method"
  - XML `namespace` 与接口全限定名不匹配 → 错误 "Namespace mismatch"
  - 同一 namespace 下存在重复 statement id → 错误 "Duplicate statement id"
- R16. 诊断结果 MUST 在切换文件时正确清理，旧文件的诊断不能残留在新打开文件上。
- R17. 当诊断数据不可用时（JDTLS 未就绪、MyBatis 索引构建中），系统 SHALL 展示明确的不可用状态，而不是空白诊断列表。

**UI and Usability**

- R18. 编辑器 gutter（行号旁）SHALL 根据当前文件类型和光标位置显示导航图标：
  - Java Mapper 接口方法旁：MyBatis 叶子图标（XML statement 存在时），点击跳转到 XML
  - XML statement 旁：Java 类图标，点击跳转回 Mapper 接口方法
  - Java override 方法旁：向上箭头图标，点击跳到 super method
  - Java 方法有实现类时：向下箭头图标，点击查看实现列表
- R19. 鼠标 hover 在 Mapper 方法名、XML statement id、Java symbol 上时，SHALL 显示预览 tooltip，内容包含 symbol 类型、定义位置和简短上下文（SQL 内容、方法签名、类型声明等）。
- R20. File View SHALL 提供导航结果面板（侧边或底部），展示 Find Usages、Go to Implementation 的候选列表。面板 MUST 支持：按类型分组（Java / MyBatis）、点击结果跳转、关闭面板、重新执行查询。
- R21. 快捷键 SHOULD 接近 IDEA 用户习惯：Ctrl/Cmd+Click 跳转定义、Ctrl/Cmd+B 跳转定义、Ctrl/Cmd+Alt+B 跳转实现、Ctrl/Cmd+Alt+F7 查找引用、Ctrl+U 跳到 super method。若与现有快捷键冲突，以当前应用快捷键体系为准。
- R22. 导航按钮旁 SHALL 显示 provider 状态标签：JDTLS（绿色=就绪、黄色=索引中、红色=不可用）、MyBatis（绿色=就绪、灰色=降级）、Fallback（灰色=仅启发式结果）。状态标签 SHOULD 提供 tooltip 说明原因。

**Reliability**

- R23. 所有语义请求 MUST 有 request id guard 和超时机制，避免旧请求覆盖新文件结果。超时后 SHOULD 提供重试入口。
- R24. JDTLS 首次索引期间（可能需要 10-30 秒），系统 SHALL 在 UI 上展示明确的"正在索引"状态（进度指示或文字提示），在此期间 Java 导航 SHOULD 降级到启发式结果而非完全不可用。
- R25. 当 JDK 不可用时，系统 SHALL 明确告知用户 Java 语义导航不可用及解决方式（安装 JDK），MyBatis Mapper 导航 SHOULD 不受影响。
- R26. 当 Maven/Gradle 项目配置异常（依赖未解析、模块未导入）时，JDTLS 诊断 MUST 说明具体原因，而不是只显示"无法解析"。

---

## Key Flows

- F1. Controller → Service → Mapper → XML 调用链导航
  - **Trigger:** 用户打开 `UserController.java`，光标停在 `userService.createUser(...)` 上。
  - **Actors:** A1, A2, A3, A4
  - **Steps:** 用户执行 Ctrl/Cmd+Click；JDTLS 解析 `UserService` 接口，定位到 `createUser` 方法定义（可能在接口声明或实现类）；用户继续从 Service 实现类中的 `userMapper.insert(user)` 跳转，MyBatis 索引器解析 namespace + method name，定位到 XML 中的 `<insert id="insert">` 语句；编辑器打开 XML 文件并聚焦到对应 statement。
  - **Outcome:** 用户能顺着 Controller → Service → Mapper → XML 调用链完成跨文件阅读，无需手动搜索。
  - **Covered by:** R1, R2, R7, R8, R21

- F2. Mapper 方法 SQL 预览
  - **Trigger:** 用户打开 `UserMapper.java`，鼠标 hover 在 `selectById` 方法名上。
  - **Actors:** A1, A2, A4
  - **Steps:** MyBatis 索引器检测到该方法在 XML 中有对应 statement，提取 SQL 内容；前端显示 tooltip，包含 SQL 类型（SELECT）、SQL 内容（`SELECT * FROM user WHERE id = #{id}`）、来源文件和行号。
  - **Outcome:** 用户不需要切换到 XML 文件就能了解该方法执行的 SQL 逻辑。
  - **Covered by:** R10, R19

- F3. Find Usages 跨 Java + MyBatis 分组展示
  - **Trigger:** 用户在 `UserService.createUser` 方法上执行 Find Usages。
  - **Actors:** A1, A2, A3, A4
  - **Steps:** JDTLS 返回 Java 侧的调用点（Controller、Test 等）；MyBatis 索引器返回 XML 侧的 statement 引用；前端合并两组结果，按类型分组展示。
  - **Outcome:** 用户能看到该方法在 Java 代码中被哪里调用，以及在 MyBatis XML 中是否有对应的 SQL statement 定义。
  - **Covered by:** R3, R20

- F4. Mapper 诊断与修复引导
  - **Trigger:** 用户打开一个 Mapper 接口文件。
  - **Actors:** A1, A2, A4
  - **Steps:** MyBatis 索引器对比接口方法与 XML statements；检测到 `countByAge` 方法在 XML 中无对应 statement；在诊断面板和 gutter 中显示黄色警告；用户点击警告跳到 `countByAge` 方法声明行。
  - **Outcome:** 用户能快速发现 Mapper 接口与 XML 的不一致，避免运行时才发现错误。
  - **Covered by:** R15, R16, R17

- F5. 项目自动检测与降级
  - **Trigger:** 用户在 ccgui 中打开一个 Spring Boot Maven 项目文件夹。
  - **Actors:** A1, A5, A3, A4
  - **Steps:** Project detection service 扫描项目结构，识别 Maven `pom.xml`、`application.yml` 中的 `mybatis.mapper-locations`；自动启动 JDTLS（检测 JDK 可用性后）和 MyBatis 索引器；JDTLS 索引期间 UI 显示"正在索引"状态；MyBatis 索引器先完成，Mapper 导航立即可用；如果 JDK 不可用，JDTLS 跳过，MyBatis 导航不受影响；如果 mapper-locations 非标准，引导用户手动配置。
  - **Outcome:** 用户打开项目后能尽快使用导航能力，遇到配置问题时有清晰的引导。
  - **Covered by:** R13, R22, R24, R25

---

## Acceptance Examples

- AE1. Controller method call navigates through to XML SQL
  - **Given:** Spring Boot Maven workspace 已打开，`UserController.java` 中光标位于 `userService.createUser(request)`。
  - **When:** 用户 Ctrl/Cmd+Click 该方法调用。
  - **Then:** 系统打开 `UserServiceImpl.java` 并定位到 `createUser` 方法声明；用户继续 Ctrl/Cmd+Click 方法体内的 `userMapper.insert(user)`，系统打开 `UserMapper.xml` 并定位到 `<insert id="insert">` 语句。
  - **Covers:** R1, R7, R8

- AE2. Mapper SQL preview on hover
  - **Given:** `UserMapper.java` 已打开，光标位于 `selectById` 方法名。
  - **When:** 用户 hover 在方法名上。
  - **Then:** tooltip 显示 SQL 类型（SELECT）、SQL 内容、来源文件路径和行号；如果方法使用 `@Select` 注解，tooltip 直接显示注解中的 SQL。
  - **Covers:** R9, R10, R19

- AE3. Find Usages returns both Java and MyBatis results
  - **Given:** `UserService.createUser` 方法上有 Java 调用和 MyBatis XML statement。
  - **When:** 用户执行 Find Usages。
  - **Then:** 结果面板分两组展示：Java References（包含 Controller 调用、Test 调用等）和 MyBatis References（包含 XML statement），每条结果包含文件路径和行号，点击可跳转。
  - **Covers:** R3, R20

- AE4. Missing XML statement shows diagnostic warning
  - **Given:** `UserMapper.java` 中声明了 `countByAge` 方法，但 `UserMapper.xml` 中无对应 `<select id="countByAge">`。
  - **When:** 用户打开 `UserMapper.java`。
  - **Then:** gutter 中 `countByAge` 方法旁显示黄色警告图标；诊断面板显示"Missing XML statement: countByAge"；点击警告跳转到该方法声明。
  - **Covers:** R15, R16

- AE5. JDTLS unavailable with MyBatis still working
  - **Given:** 用户系统未安装 JDK，但项目有完整的 MyBatis Mapper + XML 结构。
  - **When:** 用户打开 Mapper 接口文件。
  - **Then:** Provider 状态标签显示 JDTLS 红色（不可用，tooltip 说明需安装 JDK）；MyBatis 标签显示绿色（就绪）；Mapper ↔ XML 跳转和 SQL 预览正常工作；Java 的 Go to Definition / Implementation 按钮置灰并提示不可用原因。
  - **Covers:** R13, R22, R25

---

## Success Criteria

- S1. 对典型 Spring Boot + MyBatis 项目的 Controller → Service → Mapper → XML 调用链，用户可以通过语义导航完成全链路跨文件定位，不需要全文搜索。
- S2. 打开 Mapper 接口文件时，每个方法旁都有明确的导航入口（gutter 图标或 hover），能一键跳到对应的 XML statement 或看到 SQL 预览。
- S3. Find Usages 能同时返回 Java 调用点和 MyBatis XML 引用，结果分组清晰、可扫描。
- S4. Mapper 接口与 XML 的不一致（缺失 statement、namespace 不匹配）能在文件打开时通过诊断面板发现，不需要运行时报错才知道。
- S5. JDTLS 不可用时，MyBatis Mapper 导航能力不受影响；两种导航能力各自独立降级。
- S6. 用户能通过 provider 状态标签清楚知道当前哪些导航能力可用、哪些不可用、不可用的原因是什么。
- S7. 现有文件查看、tab、保存、搜索能力不因代码导航改造而退化。

---

## Scope Boundaries

**Deferred for later**

- 调用层级 call hierarchy / incoming calls / outgoing calls。
- Java rename / refactor / organize imports / quick fix code actions。
- Spring Bean 依赖图、endpoint 图、JPA entity 图的可视化。
- 全项目 Problems 工具窗口和批量 inspection 报告。
- Debugger、断点、运行测试、Maven lifecycle 面板。
- Java 代码补全（completion）——JDTLS 支持但 v1 不优先做。
- 多模块 Maven/Gradle 项目的跨模块导航——v1 先覆盖单模块，跨模块作为增强。

**Outside v1 identity**

- 复刻 IntelliJ IDEA 或 VS Code 的完整 IDE。
- 把当前产品主界面替换成独立代码编辑器。
- 对所有语言承诺同等深度的 semantic navigation。

---

## Dependencies and Assumptions

- D1. 当前项目已有 File View / CodeMirror 文件查看与编辑入口，可作为导航能力的承载 surface（`src/features/files/components/FileViewPanel.tsx`）。
- D2. 当前前端服务层已有 code intelligence 与 OpenCode LSP 相关 Tauri 调用基础（`src/services/tauri.ts`）。
- D3. `@codemirror/lang-java` 已在依赖中，覆盖 Java 语法高亮。
- D4. JDTLS 需要 JDK 17+ 运行时；系统 MUST 在项目检测阶段检查 JDK 可用性，并在不可用时给出清晰提示。
- D5. MyBatis Mapper 导航依赖正确的 `mybatis.mapper-locations` 配置或等价的 XML 文件发现机制；自动检测失败时需引导用户配置。
- D6. Spring 动态代理、MyBatis Mapper 动态实现等无法静态解析的模式，结果 MUST 明确降级，不得伪造确定实现。

---

## Sources and Research

- Repo code: `src/features/files/components/FileViewPanel.tsx` — 现有 File View，已有 definition/references 控件和导航面板接线。
- Repo code: `src/features/files/hooks/useFileNavigation.ts` — 现有导航 hook，含 request guard、缓存和超时逻辑。
- Repo code: `src/features/files/components/FileViewNavigationPanel.tsx` — 现有导航结果面板。
- Repo code: `src/services/tauri.ts` — 暴露 `code_intel_*` 和 `opencode_lsp_*` Tauri commands。
- Repo code: `src-tauri/src/code_intel.rs` — 现有启发式 Java definition/references 扫描。
- Repo code: `src-tauri/src/engine/commands_opencode.rs` — 现有 OpenCode LSP 命令包装。
- External: Eclipse JDT Language Server (jdtls) — Java 领域最成熟的开源 LSP，提供 definition、references、implementation、diagnostics、completion。
- External: JetBrains MyBatisX 插件 — IDEA 的 MyBatis 导航标准实现，提供 Mapper ↔ XML 双向跳转、SQL 预览、校验诊断。
- External: MyBatis 3.x — namespace + id 的匹配规则、`@Select`/`@Insert` 等注解 SQL 解析机制。
- External: MyBatis-Plus 3.x — BaseMapper 内置 CRUD 方法的动态代理机制，AbstractMethod 实现。
