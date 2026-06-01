# Design: fix-composer-tool-popover-stability

## Decision 1: 记忆引用弹层改为 portal overlay

`ButtonArea` 中的记忆引用弹层改为通过 `createPortal(..., document.body)` 渲染。定位基于触发按钮 `getBoundingClientRect()`，弹层宽高测量后计算 `left/top`，并按 viewport margin clamp。

原因：

- 避开 toolbar/sidebar 父级 stacking context、overflow 与 z-index 竞争。
- 与现有 `ComposerContextMenuPopover` 的 portal 策略保持一致。
- 不改变按钮本身在工具栏中的视觉顺序。

## Decision 2: 外部点击关闭同时检查 trigger 与 panel

关闭逻辑改为监听 pointer/mouse 事件时同时检查：

- 触发按钮/control root 是否包含 target。
- portal panel 是否包含 target。

只有两者都不包含时才关闭弹层。

原因：

- portal 后 panel 不再是 trigger root 的 DOM 后代。
- 弹层内按钮点击必须先执行自身 action，再关闭。

## Decision 3: 保持局部修复

本变更不引入通用 Popover 基础组件。当前问题只命中记忆引用弹层，直接在 `ButtonArea` 中收口可以避免牵动其他工具菜单。

若后续多个 Composer 工具弹层复现同类问题，再抽取 feature-local helper。

## Risks

- jsdom 中 `getBoundingClientRect()` 默认为 0，测试只断言 portal/交互语义，不依赖像素级定位。
- 需要确保组件 unmount 时清理 window/document listener。

## Rollback

还原 `ButtonArea.tsx` 中 portal 定位逻辑与 `composer.part2.css` 弹层定位样式即可。该变更不涉及持久化数据或 backend contract。
