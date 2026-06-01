## 1. Worktree Move Menu

- [x] 1.1 [P0] 输入：`Sidebar` 已计算的 `moveFolderTargetsByWorkspaceId`；输出：`WorktreeSection` 接收并转发对应 `worktree.id` 的 folder/root move targets，且不静默回退到 parent/sibling targets；验证：worktree session menu 能拿到非空 targets 且 target 来源正确。
- [x] 1.2 [P0] 输入：worktree session 行操作菜单；输出：有可用 targets 时展示 `Move to folder` 右侧 flyout 与具体 folder/root targets，large list 仍保留搜索入口但不能替代可见 targets；验证：focused Vitest 覆盖菜单入口。
- [x] 1.3 [P1] 输入：无 folder targets 的 workspace；输出：保持现有隐藏菜单行为；验证：现有 menu 测试不回归。

## 2. Pending Folder Intent Identity Migration

- [x] 2.1 [P0] 输入：Claude pending session id 与目标 folder id；输出：pending 阶段保留 local folder intent，不向猜测的真实 id 写 durable assignment；验证：多 Claude 候选时不会误写旧 session。
- [x] 2.2 [P0] 输入：所有可 finalize pending engine session 的 `renameThreadId` dispatch path；输出：统一调用同一个 folder-intent migration contract，或迁移逻辑集中在共享 rename boundary；验证：`useThreadTurnEvents` 与 `useThreadMessagingThreadResolution` 等 rename 来源均覆盖。
- [x] 2.3 [P0] 输入：`pendingThreadId -> realThreadId` identity transition；输出：folder intent 和 local override 迁移到真实 id；验证：assignment mutation 使用真实 Claude id。
- [x] 2.4 [P0] 输入：assignment 成功、catalog-not-ready retryable 失败、non-retryable 失败；输出：成功后清理 pending intent，retryable 保留 intent，non-retryable 失败必须先保持/恢复本地状态并可见报错；验证：Sidebar focused test。
- [x] 2.5 [P1] 输入：Codex real-id creation path；输出：保持直接 assign 行为；验证：现有 Codex pending/catalog-backed folder intent 测试通过。

## 3. Compatibility And Safety

- [x] 3.1 [P0] 输入：partial/degraded/startup-only catalog refresh；输出：不得把缺失 row 当作 pending intent 删除或真实 id 证明；验证：单元测试或现有 degraded fixture 覆盖。
- [x] 3.2 [P0] 输入：跨 project folder target；输出：继续由现有 owner-aware assignment 拒绝；验证：不新增跨 project target 到菜单。
- [x] 3.3 [P1] 输入：legacy folder metadata；输出：读取兼容保持不变；验证：相关 folder tree/session folder tests 不回归。

## 4. Validation

- [x] 4.1 [P0] 输入：OpenSpec artifacts；输出：proposal/design/tasks/spec deltas 完整；验证：`openspec validate fix-session-folder-intent-and-worktree-move-menu --strict --no-interactive` 通过。
- [x] 4.2 [P0] 输入：前端目标测试；输出：focused Vitest 通过；验证：`npx vitest run` 覆盖 `Sidebar` / `WorktreeSection` / pending identity 相关测试。
- [x] 4.3 [P1] 输入：实现 diff；输出：确认未触碰 Claude scanner ownership、workspace catalog membership 或 backend metadata schema；验证：review checklist 明确记录。
