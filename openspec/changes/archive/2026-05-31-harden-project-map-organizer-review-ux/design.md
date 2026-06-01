# Design

## Context

Project Map organizer suggestions are review candidates, not direct mutations. The user must be able to understand why suggestions were created or skipped, review individual candidates, and optionally accept a large set of safe candidates at once.

The correctness model needs two layers:

- `graph-safe`: the move must not corrupt topology.
- `hierarchy-fit`: the move must preserve the knowledge map's abstraction levels.

## Decisions

### Organizer parent candidates stay project-agnostic

The organizer SHALL NOT hard-code project names, technology stacks, controller/module labels, or repository conventions. It MAY use node ids, titles, node kinds, lens ids, summaries, child counts, and source paths as generic map evidence.

### Graph safety is deterministic

Parent-move candidate creation and confirmation share the same safety expectations:

- source and target nodes must exist
- source parent must still match
- target parent must not be the unassigned container
- target parent must not be the moving node
- target parent must not be a descendant of the moving node
- stale or malformed suggestions fail closed

### Hierarchy fit prevents abstraction inversion

Organizer validation distinguishes broad overview/category nodes from detail/evidence nodes using generic node shape:

- nodes with children are broad
- `concept` and `capability` nodes are broad
- broad nodes may be organized near root or under their own lens-level hub
- detail nodes may be organized under specific deep parents
- detail nodes may not be flattened directly under the project root by organizer confirmation

### Batch confirmation is atomic at the dataset boundary

The top-bar Accept all action runs every pending review candidate through existing `confirmProjectMapCandidate` validation and every standalone node candidate through `confirmProjectMapNodeCandidate`. Passing candidates are applied to an in-memory dataset sequence and persisted once. Failing candidates are skipped and remain available for manual review.

## Risks

- Hierarchy-fit is intentionally heuristic. It reduces obvious abstraction inversions but cannot guarantee semantic perfection.
- Batch accept can apply many valid candidates quickly, so it must continue to rely on the same evidence gate and parent-move validation as individual confirmation.

## Validation

- Focused Project Map unit tests cover organizer candidate generation, hierarchy-fit rejection, parent-move confirmation, batch confirmation, and toolbar UI behavior.
- TypeScript validation ensures the dataset controller contract stays consistent across panel and hook consumers.

