## 1. OpenSpec Readiness

- [x] 1.1 [P0][依赖: 无][输入: bug report + existing Auto Ingestion contract][输出: strict-valid change artifacts][验证: `openspec validate fix-project-map-auto-ingestion-background-scheduler --strict`] 完成后台调度修复提案、设计、任务和 spec delta。

## 2. Scheduler Ownership

- [x] 2.1 [P0][依赖: 1.1][输入: `useProjectMapDataset` Auto Ingestion effect][输出: shared scheduler helper/hook][验证: focused test can invoke scheduling without `ProjectMapPanel`] 抽离自动补充调度逻辑，解除对 Project Map 视图生命周期的依赖。
- [x] 2.2 [P0][依赖: 2.1][输入: active workspace lifecycle][输出: app/workspace-level scheduler mount][验证: regression test shows hidden/unmounted Project Map panel still queues auto run] 将 scheduler 挂到 workspace 常驻层。
- [x] 2.3 [P0][依赖: 2.2][输入: existing hook and scheduler mount][输出: single scheduling owner][验证: test asserts no duplicate queue when Project Map panel is also rendered] 移除视图 hook 中独立扫描 effect，避免双 scheduler。

## 3. Queue Contract Preservation

- [x] 3.1 [P0][依赖: 2.1][输入: persisted Project Map dataset + Project Memory messages][输出: existing `kind="auto"` run metadata and request shape][验证: queued run includes `generationIntent="autoIngestion"` and consumed message hashes] 复用现有 auto run request / metadata 契约。
- [x] 3.2 [P0][依赖: 3.1][输入: interval, threshold, active run guards][输出: unchanged scheduling gates][验证: tests cover interval-not-elapsed and pending/running duplicate guard] 保留间隔、阈值和运行中去重语义。
- [x] 3.3 [P1][依赖: 3.1][输入: persistence failures][输出: explicit failure path without false success][验证: failed enqueue test leaves no successful queued run assumption] 收紧后台调度持久化失败处理。

## 4. Validation

- [x] 4.1 [P0][依赖: 2.*-3.*][输入: focused Project Map suites][输出: tests pass][验证: `npm exec vitest -- run src/features/project-map/components/ProjectMapPanel.test.tsx src/features/project-map/hooks/useProjectMapDataset.test.tsx src/features/project-map/utils/autoIngestion.test.ts src/features/layout/hooks/useLayoutNodes.client-ui-visibility.test.tsx --maxWorkers 1 --minWorkers 1`] 运行聚焦回归测试。
- [x] 4.2 [P0][依赖: 4.1][输入: TypeScript project][输出: typecheck pass][验证: `npm run typecheck`] 运行类型检查。
- [x] 4.3 [P0][依赖: 4.2][输入: OpenSpec change][输出: strict validation pass][验证: `openspec validate fix-project-map-auto-ingestion-background-scheduler --strict`] 运行 OpenSpec 严格校验。
- [x] 4.4 [P1][依赖: 4.3][输入: implementation diff][输出: clean diff hygiene][验证: `git diff --check`] 检查 whitespace 和 patch 卫生。
