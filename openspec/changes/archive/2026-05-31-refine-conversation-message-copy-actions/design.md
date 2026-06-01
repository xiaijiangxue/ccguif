## Context

The existing conversation canvas can render one assistant answer as several assistant message rows. This is intentional: the streaming render contract keeps live rows segmented so parent timeline derivations do not re-run on every text delta.

Before this change, assistant tail actions were scoped to assistant message rows. That means segmented assistant turns could show multiple assistant copy buttons, and a user could accidentally copy only one segment instead of the complete answer.

## Goals / Non-Goals

**Goals:**

- Make the assistant copy affordance match the user-facing turn model: one final copy action per completed assistant turn.
- Preserve segmented rendering and the live streaming contract.
- Keep the implementation local to the message render/action surface.
- Add focused test coverage for segmented assistant copy payloads.

**Non-Goals:**

- Do not change backend events, persistence, conversation normalization, or Markdown rendering.
- Do not merge assistant items in the render source.
- Do not change user message copy, code block copy, fork, or rewind behavior.

## Decisions

### Decision 1: Compute copy payloads in `Messages`, not in row components

`Messages` already owns the canonical `effectiveItems` sequence and existing assistant action target mapping. It is the correct place to derive a small `copyTextByAssistantId` map keyed by final assistant message id.

Alternative considered: derive copy payload inside `MessagesTimeline` by walking rendered entries. Rejected because timeline entries can include grouped tool rows, virtualized rows, and live overrides; deriving from them would couple copy behavior to presentation details.

### Decision 2: Keep non-final assistant rows visible, but remove their tail copy action

The implementation keeps segmented assistant rows exactly as rendered today. Only the assistant tail action condition changes from "assistant row" to "final assistant row".

Alternative considered: merge assistant rows before rendering so only one bubble exists. Rejected because that violates the streaming render contract and risks reintroducing hot-path parent timeline churn.

### Decision 3: Aggregate only assistant message text within the current user turn

The copy payload starts after the latest user message and accumulates assistant message text until a final assistant message is encountered. Reasoning, tool, approval, image, and other non-assistant-message rows remain visible but are not inserted into the copied assistant answer.

Alternative considered: copy the entire visible turn including tools/reasoning. Rejected because the requested affordance is "copy this AI answer", while tool raw payloads and reasoning rows have their own display/copy semantics.

## Risks / Trade-offs

- [Risk] A provider may emit multiple final assistant messages without an intervening user message. → Mitigation: final rows close the current aggregation window; later final rows produce their own copy payload.
- [Risk] Future row types may need inclusion in assistant copy text. → Mitigation: add explicit spec/test coverage before expanding the payload contract.
- [Risk] Clipboard tests can produce React async state warnings. → Mitigation: wrap copy-click assertions in `act`.

## Migration Plan

1. Add assistant turn copy payload derivation beside existing message action target derivation.
2. Pass the derived payload map into `MessagesTimeline`.
3. Render assistant tail actions only for final assistant rows.
4. Update focused tests for segmented assistant copy behavior.

Rollback strategy:

- Revert the render condition and payload map changes. This restores previous per-assistant-segment copy behavior without touching data persistence or runtime behavior.

## Open Questions

- Whether a future explicit "copy full turn with reasoning/tools" affordance should exist separately from assistant answer copy.
