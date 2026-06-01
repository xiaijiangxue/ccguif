## 1. Implementation

- [x] 1.1 Trace the empty Codex draft `thread not found` flow across send, resume, and recovery-card resend entrypoints.
- [x] 1.2 Add or adjust the narrow guard so only Codex empty first-turn drafts can fresh-create and replay the current prompt.
- [x] 1.3 Preserve durable/unknown session behavior on the existing stale recovery path.
- [x] 1.4 Ensure fresh draft replacement does not persist a durable stale alias.
- [x] 1.5 Tighten the legacy malformed `invalid thread id` fallback behind the same draft boundary, with an explicit rollback marker in design.

## 2. Verification

- [x] 2.1 Add focused regression coverage for empty draft first prompt auto replay.
- [x] 2.2 Add focused regression coverage that durable or unknown Codex stale sessions are not silently replaced.
- [x] 2.3 Add focused regression coverage that durable Codex malformed-id failures are not silently replaced.
- [x] 2.4 Run focused Vitest suites for touched frontend behavior.
- [x] 2.5 Run typecheck or explain any blocker.

## 3. OpenSpec

- [x] 3.1 Run `openspec validate fix-codex-empty-draft-stale-thread-auto-replay --strict`.
