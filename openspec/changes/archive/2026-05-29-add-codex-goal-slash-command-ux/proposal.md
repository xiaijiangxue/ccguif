# add-codex-goal-slash-command-ux Proposal

## 1. Why

本变更目标已经根据人工测试收敛为：在 `mossx` 的 Codex composer 命令面板中展示 `/goal` 命令族，但不改变 `/goal...` 的发送语义。

最终选择这个方案的原因：

- 人工测试确认：当 `/goal 项目分析` 作为普通消息发送给 Codex 时，Codex 可以正常创建目标并在幕布输出结果。
- 之前的本地拦截方案会让 `/goal...` 不再进入普通 send path，出现“发送后幕布无反应”的回归。
- 用户真实需求是 UX discovery：能在命令面板里看到 `/goal`、`/goal pause`、`/goal resume`、`/goal clear`，不需要客户端重做 Codex Goal runtime。

因此，本次实现的边界是：**command panel discovery only, normal message send preserved**。

## 2. Evidence

截至 2026-05-30，已校准的信息：

- 本机 Codex CLI：`codex --version` 显示 `codex-cli 0.135.0`。
- 本机 feature 查询：`codex features list` 显示 `goals` 为 `stable true`。
- OpenAI 官方 CLI Slash Commands 文档说明 `/goal` 用于设置、暂停、恢复、查看或清除 task goal：
  - `/goal <objective>` 设置目标。
  - `/goal` 查看当前目标。
  - `/goal pause` 暂停目标。
  - `/goal resume` 恢复目标。
  - `/goal clear` 清除目标。
  - objective 最长 `4,000` characters。
- OpenAI 官方 App Commands 文档说明 `/goal` 是 thread composer slash command；如果列表里没有 `/goal`，需要启用 `features.goals`。
- 本机协议探测曾确认 Codex App Server 存在 `thread/goal/get|set|clear`，但本次最终不接这些 RPC，因为客户端直接拦截会破坏当前可用的普通发送路径。

Sources:

- `https://developers.openai.com/codex/cli/slash-commands`
- `https://developers.openai.com/codex/app/commands`

## 3. Final Scope

### 3.1 In Scope

- 在 Codex engine 的命令面板中展示：
  - `/goal`
  - `/goal pause`
  - `/goal resume`
  - `/goal clear`
- 为以上命令补齐中英文描述。
- 选择命令后只把文本填入 composer。
- 发送时继续走原有普通 message send path，由 Codex runtime 自己解释 `/goal...`。

### 3.2 Out of Scope

- 不新增 `parseCodexGoalCommand`。
- 不在 `useQueuedSend` 中新增 `goal` slash command kind。
- 不新增 `startGoal`。
- 不新增 `src/services/codexGoals.ts`。
- 不接 Tauri `thread_goal_*` command。
- 不调用 App Server `thread/goal/*` RPC。
- 不做 composer goal progress row。
- 不解析 assistant prose 作为 goal state。

## 4. Implementation Snapshot

当前真实落地路径：

- `src/features/composer/components/ChatInputBox/ChatInputBoxAdapter.tsx`
  - Codex command popup 增加 `/goal`、`/goal pause`、`/goal resume`、`/goal clear`。
- `src/i18n/locales/zh.part2.ts`
  - 增加中文 command descriptions。
- `src/i18n/locales/en.part2.ts`
  - 增加英文 command descriptions。

同时已回退旧实现噪音：

- `/goal...` 不再被 `useQueuedSend.ts` 识别成本地 command。
- frontend goal parser/service 已删除。
- backend `thread_goal_*` wrappers 已删除。
- composer goal progress row 已删除。
- goal tail autocomplete 已删除。

## 5. Success Criteria

- 用户在 Codex mode 打开命令面板时能看到 `/goal`、`/goal pause`、`/goal resume`、`/goal clear`。
- 点击命令只插入对应文本，不触发本地 goal handler。
- 用户发送 `/goal 项目分析` 后，文本走普通消息发送路径。
- 幕布能看到 Codex runtime 对 `/goal...` 的正常响应。

## 6. Risk Boundary

未来如果要做更强 UX，例如 progress row 或直接 RPC 管理 goal，必须单独开 change，并先证明不会破坏普通 submit 语义。
