## Overview

AI node organizer is a small, review-gated Project Map tool. It takes children under `unassigned-discoveries`, asks an AI engine to propose better structural parents, stores those proposals as candidates, and applies them only after user confirmation.

The organizer is deliberately separate from Project Map generation. Generation produces map payloads. Organizer produces topology move suggestions.

## Data Model

Extend `ProjectMapCandidate` with optional move metadata while keeping existing patch candidates compatible:

```ts
type ProjectMapCandidateKind = "contentPatch" | "parentMove";

type ProjectMapParentMoveCandidate = {
  kind: "parentMove";
  nodeId: string;
  fromParentId: string;
  suggestedParentId: string;
  confidence: ProjectMapConfidence;
  reason: string;
};
```

`ProjectMapCandidate` keeps its current fields and adds:

```ts
kind?: ProjectMapCandidateKind;
move?: ProjectMapParentMoveCandidate;
```

Existing candidates without `kind` are treated as `contentPatch`.

## Organizer Service

Add a feature-local service:

```text
src/features/project-map/services/projectMapNodeOrganizer.ts
```

Responsibilities:

- collect direct children of `unassigned-discoveries`
- collect candidate structural parents from root children and structural/capability nodes
- build compact JSON-only prompt
- call `engineSendMessageSync(..., accessMode: "read-only")`
- parse `{ "moves": [...] }`
- sanitize moves into `ProjectMapCandidate[]`

The prompt includes generic evidence:

- node id/title/kind/summary/lens/source paths
- parent candidate id/title/kind/summary/lens/source paths
- explicit rules: do not move to root, do not edit content, return empty moves when unsure

## Safety Check

Add pure helper in `utils/candidates.ts`:

```ts
confirmProjectMapParentMoveCandidate(...)
```

Safety rules:

- candidate must be pending and `kind === "parentMove"`
- target node exists
- suggested parent exists
- current parent still matches `fromParentId`
- source parent is `unassigned-discoveries`
- suggested parent is not root and not the moving node
- suggested parent is not a descendant of the moving node
- applying move updates both old and new parent `children`
- result is normalized through Project Map topology helper and lens stats are recalculated

Reject remains a status-only update.

## UI

MVP UI:

- show toolbar button when `unassigned-discoveries` has children
- clicking button calls `datasetController.organizeUnassignedDiscoveries()`
- pending move candidates appear through the existing candidate badge count
- selected node detail candidate notice can confirm/reject the move
- candidate copy mentions suggested parent and reason when candidate is a parent move

This avoids a new complex review table in the MVP while keeping the review gate.

## Error Handling

- If no unassigned children exist, set a readable error and do not call AI.
- If AI returns malformed JSON, surface error and keep map unchanged.
- If all suggestions fail safety validation, return no candidates and surface a conservative message.
- Candidate confirmation must fail closed if topology changed after suggestion generation.

## Compatibility

- Existing persisted candidates remain valid because new fields are optional.
- Existing candidate confirmation behavior remains unchanged for content patch candidates.
- No backend storage migration is required.

## Tests

- Organizer service:
  - builds prompt with unassigned children and structural parent candidates
  - parses valid moves into parentMove candidates
  - ignores unsafe/malformed moves
- Candidate utils:
  - confirms parent move and updates both parents
  - rejects missing parent, cycle, self parent, root parent, stale fromParent
- Panel/hook:
  - button is visible only when unassigned children exist
  - button calls controller organizer method
