# Sitewide Modern-Minimal UI Refactor

## Goal
全站 UI 美化重构，统一视觉语言为现代极简风格，功能不变。

## Plan
实施计划文件：`docs/plans/2026-05-30-001-refactor-sitewide-modern-minimal-ui-plan.md`

## Requirements
- R1: 刷新所有主要页面/窗口族，统一现代极简视觉方向
- R2: 保留现有产品行为、导航语义、响应式布局行为、Tauri 窗口交互
- R3: 使用现有 theme/token 基础设施作为主权威
- R4: 按回归风险分阶段实施
- R5: 保持 shell CSS 选择器合约稳定
- R6: 遵守前端规范（feature-scoped styling、可访问性、i18n、大文件治理）
- R7: 为桌面、平板、手机、独立窗口、overlay、主工作空间提供显式验证覆盖

## Acceptance Criteria
- [ ] 所有顶层窗口/共享 shell/overlay/主工作空间使用统一的现代极简设计语言
- [ ] 无功能回归：shell 导航、overlay、settings takeover、独立窗口、高风险工作空间
- [ ] 共享 primitives 和 theme tokens 成为主要样式权威
- [ ] 不产生新的大文件治理失败

## Implementation Units
- U1: token/primitives 基座
- U2: shell chrome + 响应式布局壳
- U3: sidebar/navigation/settings + 右侧面板
- U4: overlays + 独立窗口
- U5: 样式岛 + 终端 + composer 控制面
- U6: 对话/git/editor/spec/kanban/project map/memory
