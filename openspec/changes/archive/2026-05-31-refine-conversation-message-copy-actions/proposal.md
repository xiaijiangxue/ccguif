## Why

Conversation assistant replies can be split into multiple visible assistant message rows during streaming or provider reconciliation. Rendering a copy affordance on each assistant segment adds visual noise and makes it unclear which button copies the complete answer.

The message action contract should match the user's mental model: one assistant turn has one final copy action, and that action copies the full assistant answer for the turn.

## 目标与边界

- Keep the existing streaming, message storage, Markdown rendering, fork, and rewind behavior unchanged.
- Refine only the conversation message action surface for assistant copy affordances.
- Preserve user message copy behavior and code block copy behavior.
- Define the copy payload boundary as assistant text segments after the latest user message and before the final assistant message for that turn.

## 非目标

- Do not change engine runtime events, history persistence, or backend conversation assembly.
- Do not merge or rewrite the underlying assistant message items.
- Do not introduce a new clipboard service or dependency.
- Do not change Project Memory copy behavior.

## What Changes

- Assistant message tail actions are rendered only for final assistant message rows.
- The final assistant copy action copies the complete assistant turn text, not just the final segment text.
- Non-final assistant segments no longer show their own assistant tail copy affordance.
- User message copy actions and Markdown/code block copy actions remain unchanged.
- Focused frontend tests cover segmented assistant output and copy payload aggregation.

## 技术方案对比

| 方案 | 描述 | 优点 | 缺点 | 结论 |
|---|---|---|---|---|
| Keep per-segment copy | Continue rendering a copy button on every assistant segment | No code change | UI noise remains; copy payload is ambiguous and often incomplete | 不采用 |
| Merge assistant items before render | Collapse segmented assistant rows into one render item | One row and one action | Violates streaming render contract and risks parent timeline hot-path regressions | 不采用 |
| Final-row action with turn-level copy payload | Keep existing rows, render assistant action only on final row, copy aggregated assistant text | Minimal UI-layer change; preserves streaming/data contracts | Requires a small turn-boundary helper and regression test | 采用 |

## Capabilities

### New Capabilities

- `conversation-message-actions`: Defines assistant turn copy action placement and copy payload behavior in the conversation canvas.

### Modified Capabilities

- None.

## Impact

- Frontend:
  - `src/features/messages/components/Messages.tsx`
  - `src/features/messages/components/MessagesTimeline.tsx`
  - `src/features/messages/components/Messages.test.tsx`
- Backend:
  - No backend changes.
- Storage / data model:
  - No persistence changes.
- Dependencies:
  - No dependency changes.

## 验收标准

- A segmented assistant turn shows only one assistant tail copy button, attached to the final assistant message row.
- Activating that button copies all assistant text segments for the turn in order.
- User message copy behavior still copies the visible user message text.
- Fork and rewind actions still appear only on the latest final assistant reply when callbacks are available.
- Focused Vitest and TypeScript typecheck pass.
