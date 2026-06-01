# Proposal: fix-composer-tool-popover-stability

## Summary

修复 Composer 输入工具区的记忆引用弹层稳定性问题：弹层不应被左侧 sidebar、toolbar 父容器或 viewport 边界遮挡；用户点击弹层内部操作时，外部点击关闭逻辑不应抢先卸载弹层。

## Problem

Issue #617 在 Windows 11 / v0.5.2 反馈两个明确 bug：

- 输入框下方工具栏中的记忆选项弹窗会被软件 UI 左侧边栏遮挡。
- 上下文/工具弹窗点击不稳定，弹窗中的选项未等用户点击就消失。

当前代码中 `composer-memory-reference-popover` 挂在 `ButtonArea` 工具栏 DOM 内，并使用 `position: absolute` 定位。该结构依赖父级 stacking context 与 overflow 行为，容易被 sidebar、toolbar 或窗口边界影响。弹层关闭逻辑也依赖 document-level pointer 判断，portal 化前后都需要明确内部点击优先级。

## Goals

- 记忆引用弹层 MUST 以 viewport-aware overlay 渲染，避免被 Composer toolbar 或 sidebar 裁剪/遮挡。
- 弹层 MUST 根据触发按钮位置定位，并在 viewport 内 clamp。
- 用户点击弹层内部的取消、关闭、单次启用、始终启用操作时，outside-close 逻辑 MUST NOT 抢先关闭弹层。
- Escape 与外部点击 SHOULD 继续关闭弹层。
- 本变更只修复 Composer 输入工具弹层，不修改 rewind、消息密度或记忆注入语义。

## Non-Goals

- 不修改回溯/rewind 功能入口、语义或文案。
- 不修改消息输出行距/紧凑密度。
- 不重构所有 Composer popover，只处理本 issue 明确命中的记忆引用工具弹层。

## Validation

- 添加/更新 `ButtonArea` 回归测试，覆盖：
  - 记忆弹层渲染到 `document.body` portal。
  - 点击弹层内部选项不会被 outside-close 抢先拦截。
  - 外部点击与 Escape 仍可关闭弹层。
- 运行目标 Vitest 与 TypeScript 检查。

## Implementation Notes

- `ButtonArea` 的记忆引用弹层已从 toolbar 内联 DOM 改为 `document.body` portal，避免继承输入区、sidebar 或父级 stacking context 的裁剪/遮挡。
- 弹层位置由触发按钮的 `getBoundingClientRect()` 计算，并按 viewport margin clamp；窗口 resize 与 scroll 时同步重算。
- outside-click 判断同时识别触发按钮区域与 portal 弹层区域，内部按钮的 `mousedown/click` 不会被 document 级关闭逻辑抢先卸载。
- 工具栏收起时同步关闭记忆引用弹层，避免 orphan overlay。

## Verification Log

- `npx vitest run src/features/composer/components/ChatInputBox/ButtonArea.test.tsx`
- `npx eslint src/features/composer/components/ChatInputBox/ButtonArea.tsx src/features/composer/components/ChatInputBox/ButtonArea.test.tsx`
- `npm run typecheck`
- `npm run check:large-files`
- `openspec validate fix-composer-tool-popover-stability --strict --no-interactive`
