## 1. OpenSpec Readiness

- [x] 1.1 [P0][依赖: 无][输入: proposal/design/spec][输出: strict-valid change][验证: `openspec validate improve-project-map-interactive-layout --strict`] 完成交互布局 change artifacts。

## 2. Layout Data Contract

- [x] 2.1 [P0][依赖: 1.1][输入: Project Map dataset types][输出: `ProjectMapViewState` / `ProjectMapNodeLayout` / `ProjectMapLayoutPreset`][验证: typecheck] 增加图谱 view-state 类型。
- [x] 2.2 [P0][依赖: 2.1][输入: persisted snapshot unknown payload][输出: sanitized optional view-state][验证: persistence test old snapshot no `viewState` still loads; malformed layouts ignored] 增加持久化兼容层。
- [x] 2.3 [P0][依赖: 2.1][输入: delete-node prune helper][输出: stale layout pruning][验证: unit test deleted subtree removes layout entries] 删除节点时清理布局状态。

## 3. Pure Layout Engine

- [x] 3.1 [P0][依赖: 2.1][输入: nodes/lenses/root/focus/preset/viewState][输出: layout utility][验证: util test old deterministic positions, persisted pinned positions applied] 抽出交互布局 pure helper。
- [x] 3.2 [P0][依赖: 3.1][输入: layout positions + footprints][输出: force settle/collision pass][验证: util test auto layout no overlap and pinned nodes fixed] 实现 bounded auto layout。
- [x] 3.3 [P1][依赖: 3.1][输入: radial/tree/force preset][输出: preset-specific positions][验证: util test preset switching changes unpinned positions] 实现 layout presets。
- [x] 3.4 [P1][依赖: 3.1][输入: positions/viewport][输出: mini map projection helper][验证: util test mini map projects viewport bounds] 实现 mini map 计算。

## 4. ProjectMapPanel Interaction

- [x] 4.1 [P0][依赖: 3.*][输入: ProjectMapPanel graph nodes][输出: node drag + pin][验证: component test pointer drag persists node layout] 节点可拖拽并持久化 pinned 位置。
- [x] 4.2 [P1][依赖: 4.1][输入: node selection gestures][输出: Shift/Meta multi-select + group drag][验证: component test selected group moves together] 支持多选拖拽。
- [x] 4.3 [P1][依赖: 3.2][输入: canvas controls][输出: Auto layout / Reset layout buttons][验证: component test controls call updateDataset and no overlap helper] 增加自动整理与重置布局。
- [x] 4.4 [P1][依赖: 3.3][输入: preset selector][输出: radial/tree/force switch][验证: component test preset selection persists view-state] 增加布局 preset 控制。
- [x] 4.5 [P1][依赖: 3.4][输入: mini map click][输出: viewport recenter][验证: component test mini map click changes viewport transform] 增加 mini map。

## 5. UX / Styling / i18n

- [x] 5.1 [P1][依赖: 4.*][输入: CSS][输出: compact graph controls, pinned/selected/group affordances, mini map styling][验证: `git diff --check` + component render] 完成交互布局视觉。
- [x] 5.2 [P1][依赖: 4.*][输入: zh/en locales][输出: user-facing labels][验证: component test accessible names] 补齐中英文文案。

## 6. Verification

- [x] 6.1 [P0][依赖: 2.*-5.*][输入: Project Map focused suites][输出: tests pass][验证: `npm exec vitest -- run src/features/project-map/components/ProjectMapPanel.test.tsx src/features/project-map/services/projectMapPersistence.test.ts src/features/project-map/utils/interactiveLayout.test.ts src/features/project-map/utils/incrementalGeneration.test.ts --maxWorkers 1 --minWorkers 1`] 运行聚焦测试。
- [x] 6.2 [P0][依赖: 6.1][输入: TypeScript project][输出: typecheck pass][验证: `npm run typecheck`] 运行类型检查。
- [x] 6.3 [P0][依赖: 6.2][输入: style/large-file guards][输出: quality gates][验证: `npm run lint && npm run check:large-files && git diff --check`] 运行质量门禁。
- [x] 6.4 [P0][依赖: 6.3][输入: OpenSpec change][输出: strict validation pass][验证: `openspec validate improve-project-map-interactive-layout --strict`] 最终 OpenSpec 校验。

## 7. Regression Closure

- [x] 7.1 [P0][依赖: 4.*][输入: node selection + open detail panel][输出: viewport stable across ordinary selection][验证: `ProjectMapPanel.test.tsx` keeps viewport transform unchanged after selecting another node] 收窄自动 fit 触发边界，避免普通节点点击重置 graph viewport。

## 8. Header Chrome Polish

- [x] 8.1 [P1][依赖: 5.*][输入: Project Map header/lens toolbar][输出: collapsible compact chrome + unified toolbar control height + icon-and-text actions][验证: `ProjectMapPanel.test.tsx` collapses the project map chrome into a compact header] 将红框头部区域做成可折叠 chrome，折叠后对齐 editor toolbar 视觉节奏，并精简 i18n 文案；主要操作改为 icon+文本的轻量 toolbar item，去掉 button 块感。
