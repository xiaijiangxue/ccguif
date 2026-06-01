# tasks: add-codex-goal-slash-command-ux

- [x] 1. Evidence and scope calibration
  - [x] 1.1 确认 Codex CLI `/goal` 命令族真实存在。
  - [x] 1.2 确认本机 `features.goals` 为 stable。
  - [x] 1.3 根据人工测试收敛最终方案：命令面板展示，发送链路保持普通消息。

- [x] 2. Rollback unsafe implementation
  - [x] 2.1 删除 `/goal` 在 `useQueuedSend.ts` 中的本地 slash command 识别与拦截。
  - [x] 2.2 删除 `startGoal` frontend tooling 链路。
  - [x] 2.3 删除 Tauri `thread_goal_*` command registry、command wrappers、core RPC wrappers。
  - [x] 2.4 删除 frontend `codexGoals` service 与 `/goal` parser/test。
  - [x] 2.5 删除 goal tail autocomplete、local progress row、相关 CSS 与 i18n。

- [x] 3. Command panel discovery
  - [x] 3.1 在 Codex command popup 增加 `/goal`。
  - [x] 3.2 增加 `/goal pause`。
  - [x] 3.3 增加 `/goal resume`。
  - [x] 3.4 增加 `/goal clear`。
  - [x] 3.5 补齐中英文 command descriptions。

- [x] 4. Artifact calibration
  - [x] 4.1 回写 proposal：明确最终方案是 command panel discovery only。
  - [x] 4.2 回写 design：明确 non-interception contract。
  - [x] 4.3 回写 spec：明确 `/goal...` must use normal send path。

- [x] 5. Manual verification
  - [x] 5.1 人工验证命令面板展示四个 `/goal` entries。
  - [x] 5.2 人工验证 `/goal 项目分析` 发送后幕布正常响应。
  - [x] 5.3 人工验证 `/goal pause|resume|clear` 仍走普通发送。
