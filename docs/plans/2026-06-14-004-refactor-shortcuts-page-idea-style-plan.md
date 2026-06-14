---
title: "refactor(settings): IDEA-style compact table layout for shortcuts page"
status: active
date: 2026-06-14
origin: docs/brainstorms/2026-06-14-shortcuts-page-refactor-requirements.md
---

# refactor(settings): IDEA-style compact table layout for shortcuts page

## Summary

将快捷键设置页面从卡片网格布局重构为 IntelliJ IDEA Keymap 风格的紧凑表格布局，新增搜索过滤和快捷键冲突检测能力。纯 UI 层重构，不改变数据模型或快捷键分发逻辑。

## Problem Frame

当前 `ShortcutsSection.tsx` 使用 5 列卡片网格（每卡片最小高度 136px），35 个快捷键分 8 个类别。信息密度低，用户难以快速定位特定快捷键。需要提供搜索/过滤、紧凑表格布局、可折叠分类和冲突检测来提升可用性。

## Requirements

（溯源自 origin 文档）

- **F1 紧凑表格布局**：单列表格替换卡片网格，每行一个快捷键，类别可折叠
- **F2 搜索与过滤**：顶部搜索栏，支持名称搜索和按键搜索双向过滤
- **F3 内联编辑**：保持现有录入交互，增加焦点高亮、确认动画和冲突检测
- **F4 视觉设计**：保持项目设计语言，类别头 subtle 背景，行 hover 高亮

---

## Key Technical Decisions

### KTD1: 搜索模式识别策略

搜索框自动区分名称搜索和按键搜索。实现方式：监听输入内容，如果包含修饰键字符（cmd/ctrl/alt/shift 或 Mac 符号 ⌘⌥⇧⌃）或匹配 `parseShortcut` 可解析的格式，则走按键匹配逻辑；否则走名称模糊匹配。使用 `parseShortcut` 复用现有的解析能力。

**理由**：单一搜索框比双模式切换更简洁；修饰键关键词是可靠的模式判断依据。

### KTD2: 冲突检测在组件内完成

冲突检测逻辑放在 `ShortcutsSection` 内部（或其子组件），不在 `SettingsView` 层。组件接收 `shortcutDrafts` 后自行扫描所有 draft 值，找出重复的按键组合。

**理由**：冲突检测是纯展示逻辑，不需要持久化，也不影响 `updateShortcut` 的保存流程。放在组件内避免给 `SettingsView` 增加不必要的状态。

### KTD3: 折叠状态用 local state 管理

类别折叠状态使用 `useState<Set<ShortcutCategory>>` 追踪被折叠的类别。默认全部展开；搜索时自动展开匹配项所在类别、折叠无匹配项。折叠状态不持久化。

**理由**：需求明确仅会话内保持；用 local state 最简单。

---

## Implementation Units

### U1. 搜索栏组件

**Goal**: 在 ShortcutsSection 顶部添加搜索输入框，支持名称和按键双向过滤

**Requirements**: F2

**Dependencies**: none

**Files**:
- Modify: `src/features/settings/components/settings-view/sections/ShortcutsSection.tsx`
- Modify: `src/styles/settings.part2.css`

**Approach**:
- 在 ShortcutsSection 顶部添加一个 `<input>` 搜索框
- 使用 `useState<string>` 管理搜索关键词
- 实现 `useMemo` 派生过滤逻辑：
  - 尝试 `parseShortcut(query)` — 若成功，按按键匹配过滤（比较每个 action 的 `shortcutDrafts[draftKey]`）
  - 若失败，按名称模糊匹配（对 `t(item.labelKey)` 做 `toLowerCase().includes(query)`）
- 搜索框带搜索图标（Lucide `Search`），清空按钮
- 搜索框添加 `aria-label="搜索快捷键"`；外层可用 `<form role="search">` 包裹
- 传入过滤后的 `shortcutGroups` 给下游渲染

**Patterns to follow**: 现有 `settings-input` CSS 类用于输入框样式

**注意**: 当前组件在所有逻辑之前有 `if (!active) return null` 早返回（第 110 行）。U1-U4 引入的 `useState`/`useMemo` hooks 必须在此早返回之前调用（React hooks 规则）。需将早返回移至 hooks 调用之后，或改为条件渲染表达式。

**Test scenarios**:
- 输入 "save" → 仅显示名称包含 "save" 的快捷键（save-file）
- 输入 "cmd+s" → 显示绑定了 cmd+s 的快捷键
- 输入空字符串 → 显示全部
- 输入不存在的内容 → 显示空状态提示
- 搜索 "cmd" → parseShortcut("cmd") 返回 null（不完整），走名称匹配

**Verification**: 搜索框渲染、两种匹配模式正确过滤、空状态显示

---

### U2. 紧凑表格布局

**Goal**: 将卡片网格替换为单列紧凑表格/列表布局

**Requirements**: F1, F4

**Dependencies**: U1（搜索后的 groups 数据结构）

**Files**:
- Modify: `src/features/settings/components/settings-view/sections/ShortcutsSection.tsx`
- Modify: `src/styles/settings.part2.css`

**Approach**:
- 替换 `.settings-shortcuts-grid` grid 布局为单列 flex 布局
- 每行一个快捷键，使用 flex 横向排列：图标（缩小至 14px）+ 操作名 + 快捷键输入框 + 默认值 + 清除/恢复按钮
- 行高紧凑（约 36-40px），用 `border-bottom` 分隔而非卡片边框
- 行 hover 高亮效果
- 响应式：窄窗口隐藏默认值列（`@media` 断点）
- 图标复用现有 `shortcutIconByActionId`，尺寸缩小

**Patterns to follow**: 现有 `settings-input--shortcut` 样式用于快捷键输入框

**Test scenarios**:
- 35 个快捷键全部渲染为紧凑行
- 每行显示图标、名称、快捷键、默认值、操作按钮
- 窄窗口（<1040px）隐藏默认值列
- 行 hover 时背景高亮

**Verification**: 页面高度显著缩短；所有快捷键一屏可显示大部分

---

### U3. 可折叠分类

**Goal**: 类别作为可折叠分组头，支持展开/折叠

**Requirements**: F1

**Dependencies**: U1, U2

**Files**:
- Modify: `src/features/settings/components/settings-view/sections/ShortcutsSection.tsx`
- Modify: `src/styles/settings.part2.css`

**Approach**:
- 添加 `useState<Set<ShortcutCategory>>` 管理折叠状态，默认 `new Set()`（全展开）
- 分组头：ChevronDown/ChevronRight 图标 + 类别标题 + 子项数量 + subtle 背景条
- 点击分组头切换折叠/展开
- 可访问性：分组头使用 `<button>` 元素或 `role="button"` + `onKeyDown` 支持 Enter/Space 键切换；添加 `aria-expanded="true|false"` 和 `aria-label`（含类别名和状态）
- 搜索模式下：自动展开有匹配项的类别，折叠无匹配项的类别（搜索时覆盖手动折叠状态）

**Patterns to follow**: 现有 ChevronDown/ChevronRight 图标已 import

**Test scenarios**:
- 点击分组头折叠该类别 → 行隐藏，仅显示分组头
- 再次点击展开 → 行恢复
- 键盘 Enter/Space 点击分组头 → 切换折叠/展开
- 搜索 "save" → App 类别自动折叠（无匹配），Editor 类别自动展开（有 save-file）
- 清空搜索 → 恢复手动折叠状态

**Verification**: 折叠/展开交互流畅；搜索时自动折叠逻辑正确

---

### U4. 快捷键冲突检测

**Goal**: 编辑快捷键时检测冲突并显示提示

**Requirements**: F3

**Dependencies**: U1, U2

**Files**:
- Modify: `src/features/settings/components/settings-view/sections/ShortcutsSection.tsx`

**Approach**:
- 使用 `useMemo` 从 `shortcutDrafts` 计算冲突映射：`Map<ShortcutDraftKey, ShortcutDraftKey[]>` — 每个 draftKey 映射到使用相同按键组合的其他 draftKeys
- 在每行快捷键下方，若存在冲突，显示一行红色/橙色提示文字（如 "⚠ 与「打开全局搜索」冲突"）
- 冲突提示仅在快捷键非空时显示
- 空值（null 或 ""）不视为冲突
- 可访问性：冲突提示文本包裹在 `aria-live="polite"` 区域，或通过 `aria-describedby` 关联到快捷键输入框，使屏幕阅读器感知动态变化

**Patterns to follow**: 项目中现有的 `var(--text-*)` 颜色变量

**Test scenarios**:
- 将两个不同快捷键设为相同组合 → 两行都显示冲突提示
- 将冲突的快捷键改回不同组合 → 冲突提示消失
- 清除一个快捷键（设为 null）→ 冲突消失
- 搜索过滤时冲突提示仍然正确显示

**Verification**: 冲突检测准确、提示文案包含冲突项名称、清除后提示消失

---

### U5. 编辑体验优化

**Goal**: 优化快捷键编辑的视觉反馈

**Requirements**: F3

**Dependencies**: U2

**Files**:
- Modify: `src/features/settings/components/settings-view/sections/ShortcutsSection.tsx`
- Modify: `src/styles/settings.part2.css`

**Approach**:
- 输入框获得焦点时添加高亮边框样式（CSS `:focus-within` 或 React state 控制 class）
- 录入成功后添加短暂的 success 状态样式（绿色边框闪烁，使用 CSS animation，约 500ms 后恢复）
- 保持现有 Backspace/Delete 清除逻辑不变

**Test scenarios**:
- 点击输入框 → 高亮边框出现
- 按下新快捷键组合 → 输入框短暂绿色闪烁后恢复
- 按下 Backspace → 快捷键清除，输入框显示 placeholder

**Verification**: 焦点和成功状态的视觉反馈清晰可感知

---

## Risks & Dependencies

- **风险**：搜索的"按键匹配"可能对用户输入格式敏感（如输入 `⌘S` vs `cmd+s`）。缓解：搜索时同时尝试 `parseShortcut`（原始值）和对输入做小写规范化后再解析
- **依赖**：现有 `shortcutDrafts`、`updateShortcut`、`handleShortcutKeyDown` 逻辑完全复用，由 `SettingsView` 提供
- **风险**：折叠+搜索的组合状态可能产生意外行为。缓解：搜索时完全接管折叠状态（忽略手动折叠），清空搜索时恢复

## Scope Boundaries

### 在范围内
- ShortcutsSection 组件的完整重构
- 新增搜索过滤逻辑
- 新增折叠分类交互
- 新增冲突检测显示
- 编辑体验视觉优化
- 响应式 CSS 调整

### Deferred to Follow-Up Work
- 快捷键拖拽排序
- 快捷键导入/导出
- 快捷键搜索高亮匹配文本
- 按类别筛选的下拉菜单（搜索框已覆盖此需求）

## Deferred / Open Questions

### From 2026-06-14 review

- **KTD1 vs U1 搜索模式检测逻辑矛盾** — KTD1 vs U1 Approach (P1, coherence, feasibility, confidence 100)

  KTD1 和 U1 描述了不同的搜索模式检测逻辑：KTD1 对含修饰键字符的输入（如 "cmd"）走按键匹配，U1 仅依赖 parseShortcut 返回值走名称匹配，同一输入产生不同行为。实现者无法确定遵循哪种逻辑。

  <!-- dedup-key: section="ktd1 vs u1 approach" title="ktd1 和 u1 描述了不同的搜索模式检测逻辑" evidence="ktd1 如果包含修饰键字符cmd或匹配 parseshortcut 可解析的格式则走按键匹配逻辑" -->

- **搜索输入规范化三处不一致** — KTD1, U1, Risks (P2, coherence, confidence 75)

  搜索输入在文档中有三处不一致描述：KTD1 加修饰键预检，U1 仅用 parseShortcut，Risks 加小写规范化。实现者无法确定遵循哪种逻辑，尤其 Risks 中的 ⌘S vs cmd+s 规范化在 KTD1 和 U1 中均未出现。

  <!-- dedup-key: section="ktd1 u1 and risks" title="搜索输入规范化在文档中有三处不一致描述" evidence="ktd1 提到修饰键检测和 parseshortcut u1 尝试 parseshortcutquery 若成功" -->

- **折叠状态 save/restore 机制未描述** — KTD3, U3, Risks (P1, coherence, feasibility, confidence 100)

  Risks 承诺"清空搜索时恢复"手动折叠状态，但 KTD3 和 U3 仅定义 useState 单变量，搜索覆盖后无法恢复。需要 useRef 快照或双状态机制。

  <!-- dedup-key: section="ktd3 u3 and risks" title="折叠状态保存恢复机制未描述" evidence="ktd3 类别折叠状态使用 usesetstate 追踪被折叠的类别" -->

- **Mac 符号搜索归一化缺失** — KTD1, U1 (P1, feasibility, confidence 75)

  parseShortcut 按 "+" 分割并匹配文本修饰键名称，不对 Unicode Mac 符号（⌘⌥⇧⌃）做归一化。用户输入 "⌘S" 时 parseShortcut 返回 null，按键匹配路径永远不会触发。需新增 normalizeSearchQuery 函数。

  <!-- dedup-key: section="ktd1 and u1" title="parseshortcut 无法解析 mac 符号输入" evidence="ktd1 如果包含修饰键字符或匹配 parseshortcut 可解析的格式" -->

- **折叠含焦点元素的类别时焦点管理缺失** — U3 (P1, design-lens, confidence 75)

  用户编辑快捷键时折叠该类别（手动或搜索自动折叠），焦点输入框被移除 DOM，焦点会跳到 body 或意外元素，打断编辑流程。

  <!-- dedup-key: section="u3 collapsible categories" title="折叠包含焦点元素的类别时焦点管理缺失" evidence="u3 approach 行隐藏仅显示分组头 hides removing focused inputs from dom" -->

- **冲突提示 UX 不完整** — U4 (P1, design-lens, confidence 75)

  冲突警告仅命名一个冲突项，3+ 冲突时信息不完整（数据结构 Map 支持多冲突但 UX 仅处理单冲突）。且无解决冲突的快捷操作，用户需滚动寻找冲突项手动修改。

  <!-- dedup-key: section="u4 shortcut conflict detection" title="冲突提示仅命名一个冲突项无解决冲突的快捷操作" evidence="u4 显示一行红色橙色提示文字 如 与打开全局搜索 冲突" -->

- **响应式断点策略不完整** — U2 (P2, design-lens, confidence 75)

  响应式设计仅指定一个断点（<1040px 隐藏默认值列），现有 CSS 有 4 个断点（1280/1040/760/560）。窄屏下紧凑行布局如何渐进降级未说明。

  <!-- dedup-key: section="u2 compact table layout" title="响应式设计仅指定一个断点忽略现有断点" evidence="u2 响应式窄窗口隐藏默认值列media 断点 existing css has four breakpoints" -->

- **搜索期间手动切换类别的行为未定义** — U3 (P2, design-lens, confidence 75)

  搜索模式下自动折叠覆盖手动状态，但未定义用户在搜索激活期间手动切换类别时的行为：手动操作是否在下次搜索输入前持续生效，还是搜索始终覆盖。

  <!-- dedup-key: section="u3 collapsible categories" title="搜索期间手动切换类别的行为未定义" evidence="u3 搜索模式下自动展开有匹配项的类别折叠无匹配项的类别 搜索时覆盖手动折叠状态" -->
