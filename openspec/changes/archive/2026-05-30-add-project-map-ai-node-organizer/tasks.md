## 1. OpenSpec Contracts

- [x] 1.1 Define proposal, design, and spec deltas for AI node organizer.
- [x] 1.2 Validate OpenSpec change strictly.

## 2. Data And Safety

- [x] 2.1 Extend candidate types with parent-move metadata.
- [x] 2.2 Add topology-safe parent-move confirmation helper.
- [x] 2.3 Preserve content patch candidate compatibility.

## 3. Organizer Service

- [x] 3.1 Add organizer prompt builder and AI call service.
- [x] 3.2 Parse and sanitize organizer move suggestions.
- [x] 3.3 Ignore malformed or unsafe suggestions.

## 4. UI And Hook

- [x] 4.1 Add dataset controller method to organize unassigned discoveries.
- [x] 4.2 Add Project Map toolbar action gated by unassigned children.
- [x] 4.3 Show parent-move candidate reason/suggested parent in detail review.

## 5. Verification

- [x] 5.1 Add candidate safety tests.
- [x] 5.2 Add organizer service tests.
- [x] 5.3 Add panel/hook tests for organizer entry.
- [x] 5.4 Run focused Project Map tests.
- [x] 5.5 Run `npm run typecheck`.
- [x] 5.6 Run `openspec validate add-project-map-ai-node-organizer --strict --no-interactive`.
