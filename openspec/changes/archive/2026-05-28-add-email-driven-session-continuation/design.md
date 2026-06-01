## Context

mossx 当前已经具备 outbound email sender：Settings 中保存 SMTP 配置，Rust email module 负责 secret 读取、测试发送、SMTP timeout 和结构化错误；conversation completion email 通过 one-shot intent 在目标 turn 完成后发送。现有设计的边界是“对话完成后通知用户”，不是“用户通过邮件继续控制 session”。

用户的新目标是建立一个稳定的邮件驱动式 session 闭环：客户端完成一轮任务后发送精简邮件，用户直接回复邮件表达下一步，客户端读取回复、校验上下文、继续对应 session，并在完成后继续通过邮件交互。

这要求新增一个 control-plane inbox，而不是通用邮箱客户端。系统只接收和 Moss session 有关的有效回复，只存储最小 command/audit 证据，不保存无关邮件。

## Goals / Non-Goals

**Goals:**

- completion email 精简为“本轮用户请求 + 本轮修复信息 + 下一步建议 + 简单回复说明”。
- completion email subject 必须包含 engine、session name、workspace name，并对过长名称字符安全截断，让用户在邮箱列表中一眼识别来源。
- 邮件驱动 continuation 的入口收敛到会话发送时的“发送邮件”选择：用户选择发送 completion email 后，该邮件默认可回复继续；未选择邮件发送的 session 不会被自动纳入邮件闭环。
- 每封 actionable email 都能通过 message thread、session metadata、reply token 和 signature 绑定到唯一 session。
- inbound mail intake 只处理带 Moss protocol 的有效回复，支持过滤、签名校验、过期、去重、状态机和 quarantine。
- 用户回复使用低摩擦自然语言入口表达继续、执行下一步、修改方向、暂停、停止、查询状态；结构化 `ACTION` 协议作为兼容和机器可读 fallback。
- 设置页邮箱设置新增文档、发送配置、收信监听、邮件会话 tab，展示收信监听状态、邮件 session、邮件事件时间线、待确认/异常回复，并支持跳转到对应 session。

**Non-Goals:**

- 不构建普通邮件 inbox、邮件全文搜索、附件同步、HTML 邮件编辑器或多邮箱聚合。
- 不执行无 session 绑定、无 sender allowlist、无 latest actionable target 或高风险/歧义的自然语言回复。
- 不把无关邮件、完整原始邮件、邮箱 secret、reply token 明文写入普通设置、日志或诊断包。
- 不改变现有 SMTP provider、测试发送或 completion email one-shot opt-in 基线。

## Design Summary

本变更采用三层协议：

1. **邮件 thread metadata**：`Message-ID`、`In-Reply-To`、`References`、`X-Moss-Session-Id`、`X-Moss-Reply-Token`、`X-Moss-Signature` 等 header 用于机器识别。
2. **冗余可见锚点**：Subject Tag（例如 `[Moss #ms_xxx]`）和 Body Anchor 作为不同邮件客户端丢自定义 header 时的低成本 fallback。
3. **精简正文**：给用户阅读的状态、本轮用户请求、本轮修复信息、下一步建议和回复方式。
4. **MOSS CONTEXT block**：作为最终 fallback，包含 session/thread/turn/reply/expiry/signature。
5. **可读 Subject**：后端 Subject Tag 保证机器 fallback，前端 base subject 负责人类识别，格式为 `Moss completed - <Engine> · <Session> · <Workspace>`。

入站处理遵循 fail-closed：只有通过 Moss protocol 校验的邮件才会入库为 command；普通邮件直接忽略，不展示、不保存。

## User Experience Review Decisions

从用户视角，邮件闭环必须做到“可理解、可撤退、可跳回现场”：

- Completion email 顶部用一句话说明当前状态，并紧接“本轮用户请求”，让用户在邮件客户端里不用回到 Moss 也能知道这封邮件对应哪次输入。
- 邮件回复区必须有明显分隔线：`Reply above this line`。客户端只解析分隔线以上内容。
- 用户回复不应被迫填写机器格式。`继续`、`下一步`、`暂停`、`停止`、`状态` 要直接可用；用户直接写一句需求时，系统应按 `CHANGE` 处理。
- `ACTION: NEXT` 只执行邮件里明确列出的第一条推荐下一步，不能让模型自由扩写任务范围。
- 设置页邮件会话列表必须能一键打开对应 workspace/thread/turn；用户不应该从邮件记录里猜上下文。
- 邮件会话管理页优先提供“查看邮件 / 打开会话 / 清理已处理记录”等低风险操作；暂停/关闭类控制可通过邮件指令或 backend action 实现，不作为列表里的默认强打扰按钮。

从架构师视角，邮件闭环必须做到“默认不信任、默认最小存储、默认不破坏邮箱”：

- 收信监听默认 read-only：不删除、不移动、不自动标记远端邮件为已读；处理进度由本地 cursor 和 ledger 维护。
- 任何可执行动作都必须同时满足 allowlist、reply chain、signed context、latest token、session state、dedupe。
- 高风险动作或超出邮件推荐范围的回复进入 `needs_confirmation`，由管理页或澄清邮件确认后再执行。
- 自动回复、退信、群发、转发链中的 Moss context 不能触发执行。

## Outbound Email Template

正文模板：

```text
本轮已完成。

本轮用户请求
用户本轮输入的简短上下文

本轮修复信息
- 修复/完成了什么
- 验证结果：通过 / 失败 / 未运行

下一步建议
1. 最推荐的下一步

如何回复
直接点回复，在最上面写一句话即可：
- 继续：执行下一步
- 直接写要求：按你的新要求继续，例如“不要改 UI，先修后端”
- 暂停 / 停止 / 状态

请在下面这条线以上回复；线以下内容用于 Moss 识别会话，请保留原文。
--- Reply above this line ---

--- MOSS CONTEXT ---
session: ms_xxx
workspace: ws_xxx
thread: th_xxx
turn: turn_xxx
reply: rp_xxx
expires: 2026-05-22T10:00:00+08:00
sig: hmac_sha256(...)
--- END MOSS CONTEXT ---
```

正文不再包含 tool output、diff、command log、file change card、review/generated-image card、reasoning/thinking 或附件。`本轮修复信息` 取客户端最终消息中的可见文本，若最终消息过长再做 bounded truncation。长内容可通过客户端 session 跳转查看。

Header 建议：

- `Message-ID`: outbound email id。
- `References` / `In-Reply-To`: 邮件 thread 绑定。
- `Subject`: 后端包含短 Subject Tag，例如 `[Moss #ms_xxx]`，用于 fallback 解析；前端 base subject 包含 engine、session name、workspace name，例如 `Moss completed - Codex · 登录修复... · springboot-demo`，用于邮箱列表可读性。
- `X-Moss-Session-Id`: session id。
- `X-Moss-Workspace-Id`: workspace id。
- `X-Moss-Thread-Id`: thread id。
- `X-Moss-Turn-Id`: turn id。
- `X-Moss-Reply-Token`: opaque reply token 或短 id；本地只保存 hash。
- `X-Moss-Expires-At`: 过期时间。
- `X-Moss-Signature`: context HMAC。
- `Auto-Submitted` / bounce-like headers: 入站处理时用于识别自动回复或退信，默认不执行。

Body Anchor 建议放在 context block 前后之一，使用短行便于用户和 parser 识别：

```text
-- Moss Session: ms_xxx · 请勿删除此行 --
```

Subject Tag 和 Body Anchor 只能用于定位候选 session；真正执行仍必须通过 reply token、signature、latest actionable 状态和 sender allowlist 校验。

## Activation Model

邮件 continuation 有两层开关：

1. **全局收信监听开关**：只控制客户端是否检查邮箱和处理 Moss reply candidates。
2. **会话邮件发送 intent**：用户在 composer / 会话里点选发送 completion email，即表示这一轮完成邮件要带可执行 reply token。

默认行为：

- 用户没有点选发送邮件时，不创建 inbound continuation 状态。
- 用户点选发送邮件后，当前 session 的 completion summary 默认是 actionable，邮件回复默认继续当前 session。
- 邮件回复触发的下一轮执行完成后，客户端会自动 arm 下一封可回复 completion email，保持邮件驱动闭环。
- 每次 actionable summary 只产生一个 latest reply target；新 summary 会 supersede 旧 target。
- 用户可以通过邮件回复“暂停 / 停止”更新 mail-driven session 状态。

## Reply Command Protocol

用户优先使用自然语言短回复。Canonical command 使用 `ACTION` 格式作为兼容格式；为了降低移动端回复成本，MVP 同时接受中文短词、英文短词和 `@moss:` 别名，但只在它是用户新增内容的第一有效行且唯一指令时生效。

最推荐的用户写法：

```text
继续
```

```text
不要改 UI，优先修后端保存原子性。
```

```text
暂停
```

```text
停止
```

```text
状态
```

结构化兼容格式：

```text
ACTION: NEXT
```

继续执行上一封邮件的第一条下一步建议。`继续`、`下一步`、`执行下一步`、`按建议继续`、`continue`、`next` 等等价短回复也映射为 `NEXT`。

兼容别名：

```text
@moss: continue
```

```text
ACTION: CHANGE
DETAIL: 不要改 UI，优先修后端保存原子性。
```

把 `DETAIL` 作为下一轮用户意图，继续当前 session。

若用户没有写 `ACTION`，但分隔线以上存在非空自然语言内容，且内容没有触发高风险/越界规则，系统把该内容作为 `CHANGE` detail 继续当前 session。

```text
ACTION: PAUSE
```

暂停该邮件驱动 session，不消费后续邮件直到用户在客户端恢复或回复新的有效 actionable email。

```text
ACTION: STOP
```

关闭该邮件驱动 session，使最新 reply token 失效。

兼容别名：

```text
@moss: stop
```

```text
ACTION: STATUS
```

只回发当前 session 状态，不启动新执行。

解析规则：

- 只解析 `--- Reply above this line ---` 之前或邮件客户端可识别的用户新增区域。
- 只解析用户新增内容，必须剥离 quoted original text、签名档和转发正文。
- 没有 `ACTION` 但存在清晰自然语言内容时，按 `CHANGE` 执行；没有有效新增内容才进入 `needs_confirmation`。
- 多个 `ACTION` 不自动执行，进入 `needs_confirmation`。
- `ACTION` 与 `@moss:` 同时出现时，除非二者表达同一意图，否则进入 `needs_confirmation`。
- `CHANGE` 没有非空 `DETAIL` 不执行。
- 自然语言可以直接作为 `CHANGE` detail；高风险、越界或歧义内容仍进入 `needs_confirmation`。
- 自动回复、退信、delivery status notification、vacation responder 默认不执行。
- `DETAIL` 若请求内容超出最新邮件推荐或当前 session 边界，进入 `needs_confirmation`。

## Session Binding

Outbound ledger 保存每封可回复邮件：

```text
outgoingMailId
messageId
sessionId
workspaceId
threadId
turnId
replyTokenHash
expiresAt
status: actionable | consumed | superseded | expired | closed
sentAt
```

收到回复后按优先级识别：

1. Moss headers：`X-Moss-Session-Id` / reply token。
2. RFC thread：`In-Reply-To` / `References` 匹配 `messageId`。
3. Subject Tag：`[Moss #<short-session-or-token>]`。
4. Body Anchor：`-- Moss Session: ... --`。
5. 正文 `MOSS CONTEXT` fallback。
6. 签名、发件人、过期时间、latest actionable 状态校验。

只有全部关键校验通过，回复才可进入 accepted command。若旧邮件 token 已被 superseded 或 consumed，回复不执行，并可发送“请回复最新邮件”的提示。

## Implementation Anchors

当前客户端已有可复用接线点：

| 用途 | 当前锚点 |
|---|---|
| completion email 发送后注册 actionable target | `src/features/threads/hooks/useThreadCompletionEmail.ts` 的发送成功分支 |
| completion email 正文与标题构建 | `src/features/threads/utils/conversationCompletionEmail.ts` |
| 邮件驱动 runtime | `src/features/threads/hooks/useMailDrivenSessionContinuation.ts` |
| 续接执行入口 | `sendUserMessageToThread(workspaceId, threadId, text, [], options)` 所在 thread messaging hook |
| terminal settlement 集成 | `src/features/threads/hooks/useThreads.ts` completion integration |
| backend email boundary | `src-tauri/src/email/mod.rs` |
| Tauri command registry | `src-tauri/src/command_registry.rs` |
| frontend typed bridge | `src/services/tauri.ts` |
| settings 类型 | `src/types.ts` / `src-tauri/src/types.rs` |

实现时应优先保持这些边界：parser 和 body builder 做纯函数；inbox reader 使用 trait 抽象，方便 Memory mock 测试和后续替换 IMAP 库。

## Inbound Intake Pipeline

```text
poll mailbox / manual check
  -> read recent messages by local cursor in read-only mode
  -> skip auto-replies and bounces
  -> sender whitelist filter
  -> reply chain / context candidate filter
  -> parse Moss context
  -> verify signature and token
  -> strip quoted content
  -> parse natural reply / ACTION
  -> dedupe by messageId + replyToken + bodyHash
  -> persist minimal InboundMailCommand
  -> route to session queue or management review
```

状态：

- `candidate`: 疑似 Moss 邮件，尚未通过完整校验。
- `accepted`: 已通过校验。
- `queued`: 等待 session 空闲后执行。
- `running`: 已投递到 session。
- `done`: 执行完成。
- `needs_confirmation`: 需要用户澄清。
- `duplicate`: 重复回复。
- `expired`: token 或 action window 过期。
- `rejected`: 签名、发件人、session 状态等校验失败。
- `ignored`: 用户或系统忽略。

普通无关邮件不进入这些状态，不存储。

## Inbound Connection Model

收信监听使用独立 inbound settings，不复用 SMTP transport：

```text
enabled
provider
imapHost
imapPort
security
username
mailboxFolder
allowedSenders
pollIntervalSeconds
readOnlyMode: true by default
```

凭据使用 secret store 或等价安全存储。默认 `readOnlyMode` 下，客户端不修改远端邮件，只保存本地 `lastSeenUid`、`lastCheckedAt` 和 dedupe keys。真实 IMAP 连接对 126/163/QQ/custom provider 做 provider default 映射；126/163 场景下发送 IMAP `ID` 客户端身份信息，避免部分邮箱服务商把第三方 IMAP `SELECT` 识别为 unsafe login。若未来支持“标记已读/移动归档”，必须作为单独显式选项和单独 spec 变更。

## Storage Model

Inbound command ledger 最小字段：

```text
id
mailMessageId
inReplyTo
sessionId
workspaceId
threadId
turnId
replyTokenHash
fromHash / fromDisplay
receivedAt
action
detail
bodyHash
status
rejectReason
linkedOutgoingMailId
subjectTag
```

不默认保存：

- 完整 raw email。
- 附件。
- quoted original body。
- HTML body。
- 无关邮件标题和正文。
- reply token 明文。
- SMTP/IMAP secret。

Debug 模式可短期保存 sanitized raw snippet，但必须有 retention，并且不能进入默认诊断包。

## Settings UX

邮箱设置拆成四个 tab：

```text
文档 | 发送配置 | 收信监听 | 邮件会话
```

### 文档

展示模块用途、配置准备、发送配置说明、收信监听说明、配置完成后怎么用、常见回复示例和安全边界。这个 tab 用于降低邮件配置门槛，避免用户需要去外部文档理解授权码、IMAP folder、allowlist、read-only 等概念。

### 收信监听

展示：

- 收信监听开关。
- 连接状态：正常、认证失败、网络失败、暂停。
- Read-only 状态：默认开启，说明不会删除、移动或标记邮箱邮件。
- 最近检查时间、下次检查时间、有效回复数、待确认数、异常数。
- 默认只接受配置收件箱或白名单发件人。
- 过期时间设置，默认 24 小时。
- Polling interval，默认保守间隔，避免频繁打扰邮箱服务。

操作：

- 立即检查邮箱。
- 暂停/恢复监听。
- 清理已处理记录。

### 邮件会话

以 session 聚合，不以 inbox 聚合：

```text
会话 | 工作区 | 最近邮件 | 状态 | 指令 | 时间 | 操作
```

MVP 每行操作：

- 打开会话：跳转到 workspace + thread + turn anchor。
- 查看邮件：打开该 session 邮件事件时间线抽屉。
- 清理已处理记录：清理 done / duplicate / expired / ignored 等已处理 command 记录。

已由 backend ledger 支持、但不作为默认强曝光按钮的恢复动作：

- pause / close session。
- ignore command。
- resend latest summary。
- request clarification。

邮件时间线抽屉展示 sanitized events：

```text
10:01 Moss -> User  已发送总结
10:24 User -> Moss  ACTION: CHANGE，等待执行
10:31 Moss -> User  执行完成，已发送总结
```

默认不显示完整 raw email。

## Session Jump UX

跳转按三级处理：

1. 根据 `workspaceId` 切换工作区。
2. 根据 `threadId` 打开对应对话；rename 不影响，因为绑定 id。
3. 根据 `turnId` 滚动到 user/assistant turn anchor；若未加载则先加载历史，仍找不到则显示 session metadata 和最近邮件事件。

若 workspace 或 thread 不存在，管理页显示不可用状态，不自动创建新 session。

## Boundary Handling

- **重复回复**：`mailMessageId + replyTokenHash + bodyHash` 去重，标记 duplicate。
- **多封回复**：同 session 串行队列；运行中收到回复则 queued。
- **旧邮件回复**：token 非 latest actionable 时拒绝或回发“请回复最新邮件”。
- **缺失 context**：普通邮件直接忽略；疑似 Moss 回复进入 quarantine/needs_confirmation。
- **歧义指令**：不执行，提供澄清邮件或管理页手动处理。
- **签名失败**：rejected，不显示正文，只显示原因和来源摘要。
- **自动回复/退信**：直接忽略或记录为非执行状态，不进入 session queue。
- **高风险 DETAIL**：进入 needs_confirmation，要求用户在管理页确认或回复澄清邮件。
- **STOP/PAUSE**：停止或暂停邮件驱动，不影响已完成的 conversation 历史。

## Validation Strategy

- Unit tests:
  - natural reply / ACTION parser。
  - `@moss: continue/stop` compatible alias parser。
  - reply-above-line / quoted content stripping。
  - MOSS CONTEXT parser and signature validation。
  - Subject Tag / Body Anchor fallback parsing。
  - dedupe key generation。
  - compact email body builder。
  - email subject builder：engine + session + workspace + char-safe ellipsis。
- Backend tests:
  - inbound filter 不存无关邮件。
  - expired / duplicate / invalid signature / stale token 不执行。
  - read-only mailbox check 不删除、不移动、不标记远端邮件。
  - auto-reply / bounce 不执行。
  - accepted reply creates queued command。
- Frontend tests:
  - 邮件设置 tab 可见。
  - 收信监听 read-only 状态、发送邮件即进入可回复闭环的 UX 可见。
  - 邮件会话列表按 session 聚合。
  - 打开会话触发 workspace/thread/turn jump。
  - 待确认/异常邮件不展示普通无关邮件。
- Manual validation:
  - 发送 completion email -> 直接回复“继续”或自然语言要求 -> 客户端继续 session -> 完成后发送下一封摘要邮件。
  - 126 邮箱 IMAP enabled + app password + `imap.126.com:993 SSL/TLS` -> manual check 可以读取 Moss 回复候选。
  - 邮箱列表 subject 可直接看出 engine、session、workspace；过长 session 自动 `...`。
  - 邮件正文不出现 file change/tool/diff/command/reasoning/card 信息，只出现最终文本。

## Rollback

- 关闭收信监听即可停止 inbound continuation。
- 保留 outbound completion email 不受影响。
- 移除/隐藏邮件会话 tab 不影响 SMTP settings。
- 已保存 command ledger 可按 retention 清理，不需要迁移现有 conversation data。

## Phased Delivery Recommendation

为了降低风险，建议分阶段实现：

1. **正文精简与冗余锚点**：先完成 compact summary、headers、Subject Tag、Body Anchor、context block 和测试。
2. **纯逻辑协议层**：实现 reply slicing、ACTION/parser、alias parser、signature/token validation 和 dedupe。
3. **Session registry / ledger**：落盘 outgoing actionable target、processed message ids、TTL 和 latest/superseded 状态。
4. **Read-only inbox intake**：接入 IMAP 或等价 mailbox reader trait，先以 Memory mock 打通过滤和校验。
5. **前端 continuation runtime**：把 accepted command 投递到 bound thread，busy 时排队。
6. **设置页管理 UX**：增加收信监听和邮件会话 tab、timeline、jump actions、manual recovery。

## Implementation Backwrite

当前工作区实现已经按人工测试反馈做了几轮收敛，最终 MVP 与最初设计相比有三处关键产品取舍：

1. **用户回复从 ACTION-first 改为 natural-language-first**  
   邮件模板不再把 `ACTION: NEXT` 等机器格式放在主路径里，而是告诉用户“直接回复一句话”。解析器仍兼容 `ACTION`，但同时支持 `继续 / 下一步 / 暂停 / 停止 / 状态 / continue / next / status` 等短回复；普通自然语言会作为 `CHANGE` detail 投递到当前 session。

2. **邮件发送选择即默认开启回复闭环**  
   用户在会话里点选发送邮件后，不再需要到管理页点“启用回复继续”。这一轮 completion email 默认 actionable；后续邮件回复执行完后，runtime 自动 arm 下一封 actionable completion email。管理页保留审计与跳转，不再把 pause/close/enable 作为高频按钮堆到 session 列表上。

3. **邮件内容从二次摘要改为“最终可见文本”**  
   早期压缩摘要过度，用户在邮箱里看不懂上下文。当前 builder 会带上本轮用户请求，并把本轮修复信息取自客户端最终消息的可见正文；通过边界规则排除 `推理过程` 之后的内容，并过滤 tool/file/diff/card 信息。邮件不是完整 transcript，也不是模型二次总结，而是“用户刚问了什么 + 客户端最终答了什么 + 下一步怎么回”。

当前实现锚点：

- `conversationCompletionEmail.ts`: subject builder、user request、final assistant text extraction、reply instructions、tool/card exclusion。
- `useThreadCompletionEmail.ts`: completion email intent、target turn binding、首轮竞态 retry、发送后清理。
- `session_continuation.rs`: outgoing/inbound ledger、MOSS CONTEXT、signature、reply parser、sender filter、dedupe、IMAP reader integration、126/163 IMAP ID handshake。
- `useMailDrivenSessionContinuation.ts`: mailbox polling、queued command claiming、thread continuation dispatch、follow-up email arming。
- `EmailSenderSettings.tsx`: docs/send/inbound/sessions tabs、read-only inbound settings、session timeline、open-session jump、cleanup processed。
