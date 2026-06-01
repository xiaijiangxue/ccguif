## 1. OpenSpec Artifacts

- [x] 1.1 输入：用户确认的文件 tab 独立打开需求；输出：proposal/design/spec/tasks artifacts；验证：`openspec validate add-file-tab-detached-open --strict --no-interactive`。

## 2. UI Implementation

- [x] 2.1 输入：`FileViewPanel` 已打开 tab 与 workspace context；输出：tab close 旁新增 detached open icon；验证：点击 icon 调用 detached opener，且不触发 activate/close。
- [x] 2.2 输入：现有 detached file explorer session helpers；输出：按钮复用 detached session contract 并传入 tab path；验证：mock session payload 包含 `initialFilePath`。
- [x] 2.3 输入：现有 i18n 与 CSS；输出：新增可访问文案与 tab icon 样式；验证：按钮具备 `aria-label` / `title`，布局不影响原关闭按钮。
- [x] 2.4 输入：用户确认 tab detached open 需要多屏独立窗口；输出：tab open 使用 per-instance detached window label 与 per-window session snapshot；验证：连续打开创建不同 window label。
- [x] 2.5 输入：tab detached open 阅读空间需求；输出：tab-created detached window 默认收起 file tree sidebar；验证：session preference 传入 `FileExplorerWorkspace`。
- [x] 2.6 输入：per-window session 异步恢复与 custom chrome 拖拽反馈；输出：sidebar collapse preference 在 session 到达后同步，detached menubar/title copy 提供 drag region；验证：focused component tests。
- [x] 2.7 输入：per-tab 动态 window label `file-explorer-*` 与原 `file-explorer` 拖拽能力差异；输出：Tauri capability 覆盖动态 window glob；验证：capability contract test 与用户手工验收 tab detached window 可拖拽。

## 3. Verification

- [x] 3.1 输入：变更后的前端代码；输出：focused Vitest 通过；验证：`npm exec vitest run src/features/files/components/FileViewPanel.test.tsx`。
- [x] 3.2 输入：变更后的 TypeScript；输出：类型检查通过；验证：`npm run typecheck`。
- [x] 3.3 输入：用户实际桌面验证；输出：tab icon 打开的独立窗口可正常拖拽移动；验证：用户确认验收通过。
