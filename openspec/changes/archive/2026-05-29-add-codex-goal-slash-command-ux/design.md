# Design: add-codex-goal-slash-command-ux

## 1. Decision

最终设计采用轻量方案：**只做命令面板 discovery，不做客户端本地执行**。

核心原则：

- `/goal...` 是 Codex runtime 已支持的命令文本。
- 客户端不应该抢先解释它。
- 命令面板只负责帮助用户发现和插入命令。
- 发送链路必须保持和普通消息一致。

## 2. UX Model

Codex engine 下，ChatInputBox command popup 展示四个命令：

| Command | Description |
| --- | --- |
| `/goal` | Set or view a persistent Codex goal |
| `/goal pause` | Pause the current Codex goal |
| `/goal resume` | Resume the paused Codex goal |
| `/goal clear` | Clear the current Codex goal |

选择命令后的行为：

1. command popup 把对应文本填入 composer。
2. 用户可以继续编辑，例如把 `/goal` 改成 `/goal 项目分析`。
3. 用户发送后，文本进入普通 `onSend -> useQueuedSend -> sendUserMessage` 链路。
4. Codex runtime 接收文本并处理 `/goal...`。

## 3. Non-Interception Contract

客户端不得为 `/goal...` 增加以下逻辑：

- 不在 `SlashCommandKind` 中增加 `goal`。
- 不在 `parseSlashCommand` 中返回 `goal`。
- 不在 `runSlashCommand` 中处理 `goal`。
- 不调用 `thread/goal/*` RPC。
- 不新增 goal state/progress row。

这条 contract 是本次人工测试后的止血边界：命令面板可以有 `/goal`，发送链路不能被截断。

## 4. File Scope

最终保留的实现文件：

- `src/features/composer/components/ChatInputBox/ChatInputBoxAdapter.tsx`
- `src/i18n/locales/zh.part2.ts`
- `src/i18n/locales/en.part2.ts`

旧方案中被回退的范围：

- frontend parser/service
- `useQueuedSend` goal branch
- `useThreadMessagingSessionTooling` startGoal branch
- Tauri `thread_goal_*` wrappers
- composer progress row
- goal tail autocomplete

## 5. Manual Test Matrix

| Case | Expected |
| --- | --- |
| Open command panel in Codex mode | Shows `/goal`, `/goal pause`, `/goal resume`, `/goal clear` |
| Select `/goal` | Composer contains `/goal` |
| Edit to `/goal 项目分析` and send | Message appears in canvas and Codex responds normally |
| Send `/goal pause` | Message uses normal send path; Codex handles it |
| Send `/goal clear` | Message uses normal send path; Codex handles it |
