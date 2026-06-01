## 1. OpenSpec Contracts

- [x] 1.1 Define Project Map hierarchy stabilization proposal/design/spec deltas.
- [x] 1.2 Validate the change with strict OpenSpec validation.

## 2. Role-Aware Topology

- [x] 2.1 Add derived Project Map node role helpers without changing persisted schema.
- [x] 2.2 Add generic `unassigned-discoveries` fallback node creation/reuse.
- [x] 2.3 Change topology normalization so non-structural orphan/root children are not attached directly to root.

## 3. Prompt And Projection

- [x] 3.1 Update auto ingestion prompt output rules to require nearest structural parent or unassigned fallback.
- [x] 3.2 Update overview projection so root ring prioritizes structural/capability hubs.
- [x] 3.3 Preserve focused node navigation for non-structural discoveries.

## 4. Verification

- [x] 4.1 Add/adjust `incrementalGeneration` tests for orphan and direct-root non-structural nodes.
- [x] 4.2 Add/adjust `interactiveLayout` tests for overview and focus behavior.
- [x] 4.3 Add/adjust worker prompt tests.
- [x] 4.4 Run focused Project Map tests.
- [x] 4.5 Run `npm run typecheck`.
- [x] 4.6 Run `openspec validate stabilize-project-map-hierarchy --strict --no-interactive`.
