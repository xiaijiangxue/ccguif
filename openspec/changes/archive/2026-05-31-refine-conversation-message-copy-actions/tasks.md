## 1. Message Action Contract

- [x] 1.1 [P0][input: `src/features/messages/components/Messages.tsx` effective message sequence][output: final assistant id to assistant turn copy text mapping][validation: TypeScript typecheck] Derive assistant turn copy payloads from canonical `effectiveItems`.
- [x] 1.2 [P0][depends: 1.1][input: `src/features/messages/components/MessagesTimeline.tsx` assistant rows][output: assistant tail actions only on final assistant rows][validation: focused Messages Vitest] Scope assistant tail copy action rendering to final assistant rows.

## 2. Regression Coverage

- [x] 2.1 [P0][depends: 1.1,1.2][input: segmented assistant fixture][output: assertion for one final-row assistant copy action per final reply][validation: `npx vitest run --maxWorkers 1 --minWorkers 1 src/features/messages/components/Messages.test.tsx`] Cover segmented assistant copy action placement.
- [x] 2.2 [P0][depends: 1.1][input: segmented assistant fixture][output: clipboard payload assertion for full assistant turn text][validation: `npx vitest run --maxWorkers 1 --minWorkers 1 src/features/messages/components/Messages.test.tsx`] Cover assistant turn copy payload aggregation.

## 3. Verification

- [x] 3.1 [P0][depends: 1.1-2.2][input: frontend TypeScript project][output: no type errors][validation: `npm run typecheck`] Run TypeScript validation.
- [x] 3.2 [P0][depends: OpenSpec artifacts][input: change artifacts][output: strict validation result][validation: `openspec validate refine-conversation-message-copy-actions --strict --no-interactive`] Validate OpenSpec change.
