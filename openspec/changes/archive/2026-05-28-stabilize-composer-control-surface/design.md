## Context

Composer 控制面是高频使用区域。模型、模式、工具、上下文、记忆引用、reasoning 和发送都挤在一个输入框内时，如果缺少明确分区，后续每个功能入口都会继续向底部堆叠，造成按钮尺寸、主题、状态表达和空间占用不断漂移。

本轮实现已经把控制面拆成两个稳定角色：

- 顶部 readiness target：表达并选择“下一次发送用什么目标”。
- 底部 toolbar：表达“下一次发送附带什么工具/上下文，以及发送动作”。

## Decision 1: Readiness target owns model selection

模型选择入口放在顶部 provider/model target 中，而不是底部 toolbar。

理由：
- 模型属于 send target，不属于工具附件。
- 顶部 readiness bar 已经展示 provider / model / mode / access，点击这里选择模型符合视觉语义。
- 底部移除 model selector 后，工具栏可以保持 icon-only 和紧凑。

替代方案：
- 顶部只展示，底部继续选择模型。缺点是重复入口占空间，用户不容易判断哪个 target 会真正发送。

## Decision 2: Model options are built by a pure helper

`modelOptions` 负责统一合并：

- runtime-provided models
- custom models
- selected model fallback
- provider availability
- provider groups

Gemini availability 为 true 时，即使 runtime model list 暂时为空，也必须进入 selector group。

理由：
- `ModelSelect` 保持 presentational，避免在组件里读 localStorage 或猜 provider 状态。
- Gemini “检测到了就应该加上” 是 provider availability contract，不应依赖列表是否已经 hydrated。

## Decision 3: Bottom toolbar uses one collapsible inline tool strip

底部工具由主工具按钮展开/收起，所有辅助动作都纳入 `.button-area-inline-tools`。

包含：
- config
- shortcut actions
- mode
- Codex plan toggle
- context tools
- status panel toggle
- memory reference
- reasoning
- main usage

理由：
- 所有辅助动作在同一层级，避免右侧遗留按钮造成对齐和间距不一致。
- inline strip 比 popover 更稳定，不遮挡输入区，也不需要外部点击自动关闭。
- Escape 可收起，主按钮可显式展开/收起。

## Decision 3.1: Selected context chips live above the editor

selected skill / command / agent chips 不属于底部工具组，而是输入正文的上下文提示。它们必须渲染在 editor 上方的独立 context row。

理由：
- chip 表达“本次输入携带了哪些上下文选择”，语义上贴近正文，而不是工具按钮。
- 底部 toolbar 继续承担紧凑工具控制，避免 chip 数量变化撑宽或挤压 icon strip。
- `ButtonArea` 不再接收 `contextSurface` 后，后续新增工具时不会把 selected context chips 误归回底部视觉顺序。

实现约束：
- `ChatInputBox` owns `.chat-input-context-surface` and renders `ContextBar surface="external"` above `.input-editable-wrapper`.
- `ButtonArea` only owns tool surfaces and send/stop chrome; it MUST NOT render selected context chips.
- chip remove callbacks and selected state stay unchanged; this is layout-only.

## Decision 4: Icon-only visual contract beats pseudo-buttons

inline tools 只展示 icon，不展示 text label；按钮真实 hit area 保持统一，视觉背景透明。

实现约束：
- hit area 约 `28px x 32px`
- gap 约 `1px-2px`
- icon 约 `17px`
- background/border/shadow 默认透明
- hover 只提升 theme color，不恢复 pill/circle 背景

理由：
- 这些工具属于紧凑 composer chrome，不是表单按钮区。
- 去按钮化后仍保留稳定 hit area，避免 hover/click “吃到”相邻 icon。

## Decision 5: Theme color must be inherited, not embedded

模式、reasoning、context、memory 等 icon 必须通过 `currentColor` / theme token 着色。不得使用写死 `stroke="black"` 的 SVG 作为 toolbar icon。

理由：
- 固定黑色 SVG 在 dark theme 下不可见。
- 固定白色或高对比色在 light theme 下突兀。
- codicon 或 lucide icon 继承 `currentColor` 后能被 scoped CSS 统一管理。

## Decision 6: Selected inline tools use one overlay language

邮件提醒、运行跟随、折叠中间步骤、记忆引用这类 boolean/armed 工具必须共享同一种 selected affordance：

- icon 仍是主视觉，不用文字替代。
- selected/armed 时在 icon 上叠加 compact check。
- icon 与 check 使用同一个 `--composer-tool-selected-color`。
- light 默认使用主蓝，dark/dim 使用浅蓝。
- 不再混用绿色圆点、发光 badge、粗边框或按钮底色表达选中。

理由：
- 这些按钮都表示“本次/当前运行态有一个能力已开启”，语义层级一致。
- 叠加 check 比容器背景更不占空间，也不会破坏去按钮化 toolbar。
- 单一 token 能防止 home composer scoped CSS 把 active 色覆盖成另一套视觉语言。

## Decision 7: Composer visual geometry is part of the contract

Composer 外框不再使用大胶囊圆角。默认输入正文区比旧版本减少约两行。

当前约束：
- 普通 composer 圆角约 `14px`。
- Home composer 桌面圆角约 `16px`，窄屏约 `14px`。
- Home input wrapper 默认 min-height 从旧 `138px` 降到约 `93px`。
- 普通 `.input-editable` 默认 min-height 从两行降为一行。

理由：
- Composer 是工作台控件，不是 landing page hero card。
- 默认高度应给用户足够输入空间，但不应压缩 conversation viewport。

## Risks / Mitigations

- [Risk] Home composer 高优先级 CSS 覆盖普通 ChatInputBox 样式。
  - Mitigation: `home-chat.css` 必须为 `.button-area-inline-tools` 提供 scoped override，覆盖 selector/context/memory 三类按钮。
- [Risk] 新增工具入口时又绕过 inline strip。
  - Mitigation: ButtonArea visual order test 固定主要 surface 顺序。
- [Risk] 后续 review 根据旧规则把 `contextSurface` 加回 `ButtonArea`。
  - Mitigation: OpenSpec delta and Trellis frontend guideline explicitly state selected context chips live above the editor and `ButtonArea` must not own them.
- [Risk] Provider catalog hydration 时模型分组丢失 Gemini。
  - Mitigation: `modelOptions.test.ts` 覆盖 provider availability fallback。
- [Risk] 主题切换后 icon 不可见。
  - Mitigation: 禁止固定色 SVG，样式测试和视觉检查覆盖 dark/light。

## Rollback

回滚方式是恢复底部 model slot、移除 readiness target selector、撤销 inline tools scoped CSS 和默认高度/圆角数值。该回滚不涉及 backend 或持久化数据迁移。
