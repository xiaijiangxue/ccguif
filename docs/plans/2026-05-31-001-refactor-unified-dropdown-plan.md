# refactor: 统一项目所有下拉组件视觉风格

## Summary（概要）

将所有手写的、视觉不一致的下拉/弹出组件统一为项目已有的 shadcn/ui 设计语言，使用同一套 CSS 变量和视觉 token，消除"设置页好看但底栏选择器丑"的视觉断裂。

---

## Problem Frame（问题描述）

项目有两套视觉体系并存：

- **设置页 / AppSelect**：使用 `@base-ui/react` + 已有的 shadcn `select.tsx`，有 portal、圆角-lg、正确的 `--popover` 主题变量、`Check` 图标——**好看**
- **底栏选择器（6 个） + CompletionDropdown + OpenAppMenu**：手动 `position: absolute` 定位，无 portal，自定义 CSS 变量（`--dropdown-bg`、`--dropdown-border` 等）与系统主题脱节，使用 `xuanzhong.svg` 做勾选图标——**丑**

用户诉求：**所有下拉的地方都统一**。

---

## Requirements（需求）

1. **视觉统一** — 所有下拉弹窗使用同一套视觉 token（`--popover`、`--radius-lg`、`--accent`、`--border` 等），不再有独立的自定义 CSS 变量
2. **主题适配** — light/dark 主题下自动跟随，不再需要手动写 `.selector-dropdown` 的 light/dark override
3. **图标统一** — 所有 check 图标使用 Lucide `Check`，去掉 `xuanzhong.svg`
4. **动画一致** — 弹窗出现/消失有 fade+zoom 动画（与已有的 dropdown-menu 动画一致）
5. **Portal 定位** — 使用 portal 避免 overflow 裁剪
6. **CSS 瘦身** — 干掉 `selectors.css`（~1300 行），降低维护成本

---

## Key Technical Decisions（关键技术决定）

### 策略：保留组件结构，替换视觉层

**不做**：用 `@base-ui/react Select` 或 `radix-ui DropdownMenu` 替换所有选择的器 —— 因为底栏选择器的布局很复杂（分组、子菜单、描述文本、开关切换等），强行套标准 Select 会丢失功能。

**改成**：保留每个选择器的 React 组件结构和交互逻辑，但把它们的**弹窗容器和选项**全部换成统一的视觉组件：

1. 抽取一个 `DropdownContent` 公共组件，共享 shadcn 的视觉样式
2. 所有选择器的弹窗都通过 portal 渲染
3. 主题变量直接从 CSS 变量继承，不再自创一套
4. 入口/退出动画统一

这符合"最小改动量、最大一致性收益"的权衡。

### 具体方案

建立两个可复用组件：

- `<DropdownContent>` — popover 容器（portal + 阴影 + 圆角 + 动画 + 主题继承）
- `<DropdownItem>` — 选项行（hover/selected/disabled 状态 + checkmark）

所有被改的选择器引用这两个组件代替手写 `<div>`。

---

## Implementation Units（实施单元）

### U1. 抽取公共 DropdownContent 组件

**Goal:** 建立一个可复用的弹出层容器组件，视觉上与 `select.tsx` 的 popup 一致

**Files:**
- `src/features/composer/components/ChatInputBox/Dropdown/DropdownContent.tsx` (new)
- `src/features/composer/components/ChatInputBox/Dropdown/DropdownItem.tsx` (改)

**Approach:**
- `DropdownContent` 用 `createPortal` 渲染到 `document.body`，接受 `anchorEl` 定位
- 样式直接从 `select.tsx` 的 popup 样式复制（border、shadow、radius、bg），使用 `--popover` / `--popover-foreground` 等系统变量
- 加 `data-[state=open]:animate-in` 等 Tailwind 入场动画
- `DropdownItem` 保留原有的交互逻辑，但视觉改用 shadcn 的 accent hover + Check 图标
- 删除 `xuanzhong.svg` 引用，换 Lucide `Check`

### U2. 改造 ModeSelect

**Goal:** ModeSelect 弹窗使用统一视觉

**Files:**
- `src/features/composer/components/ChatInputBox/selectors/ModeSelect.tsx` (改)

**Approach:**
- 弹窗 `<div>` 替换为 `DropdownContent`，选项替换为 `DropdownItem`
- 勾选图标从 `<img src={xuanzhonIcon}>` 改为 `<Check size={16}>`
- 删除自定义内联 CSS
- 保持原有的布局结构（图标 + 标题 + 描述）

### U3. 改造 ModelSelect

**Goal:** ModelSelect 弹窗使用统一视觉

**Files:**
- `src/features/composer/components/ChatInputBox/selectors/ModelSelect.tsx` (改)

**Approach:**
- 同 U2，弹窗 + 选项替换
- 分组标题、描述文本样式保持不变（它们本身就是不同内容布局，不是样式问题）
- 勾选图标从 `xuanzhonIcon` 改为 Lucide `Check`

### U4. 改造 ProviderSelect

**Goal:** ProviderSelect 弹窗使用统一视觉

**Files:**
- `src/features/composer/components/ChatInputBox/selectors/ProviderSelect.tsx` (改)

**Approach:**
- 弹窗 + 选项替换为公共组件
- 勾选图标从 `codicon-check` 改为 Lucide `Check`

### U5. 改造 ReasoningSelect

**Goal:** ReasoningSelect 弹窗使用统一视觉

**Files:**
- `src/features/composer/components/ChatInputBox/selectors/ReasoningSelect.tsx` (改)

**Approach:**
- 弹窗 + 选项替换为公共组件
- 勾选图标从 `codicon-check` 改为 Lucide `Check`

### U6. 改造 ShortcutActionsSelect

**Goal:** ShortcutActionsSelect 弹窗使用统一视觉

**Files:**
- `src/features/composer/components/ChatInputBox/selectors/ShortcutActionsSelect.tsx` (改)

**Approach:**
- 弹窗替换为 `DropdownContent`
- 选项按钮保持原有的键盘导航（ArrowUp/Down 等），视觉改用 `DropdownItem`

### U7. 改造 ConfigSelect

**Goal:** ConfigSelect 弹窗（含子菜单）使用统一视觉

**Files:**
- `src/features/composer/components/ChatInputBox/selectors/ConfigSelect.tsx` (改)

**Approach:**
- 主菜单、子菜单（agent/speed/usage）弹窗全部替换为 `DropdownContent`
- 分隔线、switch items 等视觉元素保持功能，颜色继承主题变量
- 注意子菜单定位逻辑（`left: 100%`）保留

### U8. 改造 CompletionDropdown

**Goal:** 自动补全下拉弹窗使用统一视觉

**Files:**
- `src/features/composer/components/ChatInputBox/Dropdown/index.tsx` (改)
- `src/features/composer/components/ChatInputBox/Dropdown/DropdownItem.tsx` (已改)

**Approach:**
- `Dropdown` / `CompletionDropdown` 的容器替换为 `DropdownContent`
- 不再用 `style={{ position: 'fixed', bottom, left }}` 手动算位置，改用 `anchorEl` + portal
- 选项样式用 `DropdownItem`

### U9. 改造 OpenAppMenu

**Goal:** "用 XX 打开"下拉菜单使用统一视觉

**Files:**
- `src/features/app/components/OpenAppMenu.tsx` (改)
- `src/styles/main.css` (删对应样式)

**Approach:**
- 弹窗容器（`.open-app-dropdown`、`.open-app-secondary-group`）替换为 `DropdownContent`
- 选项样式统一

### U10. CSS 清理

**Goal:** 移除不再需要的自定义 CSS

**Files:**
- `src/features/composer/components/ChatInputBox/styles/selectors.css` (删)
- `src/features/composer/components/ChatInputBox/styles/dropdown.css` (大幅精简)
- `src/styles/main.css` (删 `.open-app-dropdown` 等)
- `src/styles/base.css` (删 `.popover-surface` 如不再需要)

**Approach:**
- `selectors.css` 的 ~1300 行降为 0（所有样式由 `DropdownContent` + 系统主题变量承载）
- `dropdown.css` 保留 `.dropdown-item--prompt-grid` 等布局相关样式，去掉 color/shadow/border 等覆盖
- 确保现有功能不丢失（响应式隐藏文字、container query 等）

---

## Risk Analysis（风险 & 依赖）

- **定位准确性风险**：从手动 `position: absolute/fixed` 换 portal + anchor 后，需要确保弹窗位置正确（特别是 ConfigSelect 的子菜单 `left: 100%` 逻辑）
  - 缓解：每个改造单元后人工验收定位
- **键盘导航风险**：ShortcutActionsSelect 和 ConfigSelect 有键盘导航逻辑，改造后不能破坏
  - 缓解：验收时检查 ArrowUp/Down/Escape 行为
- **测试覆盖**：
  - `ModeSelect.test.tsx`、`ModelSelect.test.tsx` 等已有的测试必须通过
  - 每个单元改造后运行 `pnpm test -- --related`

---

## Sequence（执行顺序）

```
U1 (公共组件) → U2-U7 (6个选择器，可并行) → U8 (CompletionDropdown) → U9 (OpenAppMenu) → U10 (CSS清理)
```

U1 必须先做，U2-U7 互不依赖可以并行，U8 依赖 U1 和 U7 的 DropdownItem，U9 依赖 U1，U10 在全部改造完成后做。

---

## Verification（验收标准）

1. **视觉对比**：每个改造后的下拉弹窗与设置页的 `Select` 弹窗视觉上风格一致（border-radius、shadow、bg、hover 状态）
2. **主题切换**：light/dark 模式下颜色正确
3. **功能完整**：选择值后 onValueChange/onChange 正常触发，弹窗正确关闭
4. **Portal 不溢出**：弹窗不会被父容器 overflow:hidden 裁剪
5. **测试通过**：相关的 `.test.tsx` 文件全部 pass

---

## Open Questions（待办事项）

- 无，范围已确认
