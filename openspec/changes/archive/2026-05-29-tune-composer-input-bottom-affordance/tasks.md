## 1. Composer Geometry

- [x] 1.1 [P0][depends:none][I: 主界面 Composer 外层布局][O: 底部留白缩小][V: 视觉检查 + CSS diff] 将主 Composer 底部 padding 收到更贴近底部的距离。
- [x] 1.2 [P0][depends:none][I: `useResizableChatInputBox` 默认高度][O: 默认编辑区域减少约两行][V: hook 测试断言新最小高度] 将默认 wrapper 最小高度从旧高度减少两行。
- [x] 1.3 [P0][depends:1.2][I: 旧 v2 localStorage 高度][O: v3 迁移读取][V: hook 测试覆盖 v2 高度减两行] 兼容迁移旧持久化高度，避免升级后继续使用旧大高度。

## 2. Collapse Affordance

- [x] 2.1 [P0][depends:1.2][I: 现有 resize/collapse hook][O: 显式 `collapse()` API][V: hook 测试覆盖显式折叠] 在 hook 内暴露复用现有状态机的折叠入口。
- [x] 2.2 [P0][depends:2.1][I: 顶部 resize grip][O: 对称折叠 icon][V: lint/typecheck + 视觉检查] 在 grip 左右添加同款折叠 icon，点击任一 icon 都折叠到底部。
- [x] 2.3 [P0][depends:2.2][I: hover-only 控件语义][O: 默认隐藏、hover/focus/resize 显示][V: CSS diff + 视觉检查] 保持顶部控件默认隐藏，不改变原 hover 行为。

## 3. Verification

- [x] 3.1 [P0][depends:1.3,2.3][I: hook 行为][O: focused test 结果][V: `npx vitest run src/features/composer/components/ChatInputBox/hooks/useResizableChatInputBox.test.ts`] 跑目标 hook 测试。
- [x] 3.2 [P0][depends:3.1][I: frontend static gates][O: lint/typecheck 结果][V: `npm run lint`、`npm run typecheck`] 跑静态质量门禁。
- [x] 3.3 [P1][depends:3.2][I: OpenSpec artifact][O: strict validate 结果][V: `openspec validate tune-composer-input-bottom-affordance --strict --no-interactive`] 提交前运行 OpenSpec 严格验证。
