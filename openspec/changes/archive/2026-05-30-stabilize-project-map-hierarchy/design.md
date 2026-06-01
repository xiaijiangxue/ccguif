## Overview

This change fixes Project Map hierarchy drift by introducing a derived node-role layer at the Project Map utility boundary. The role is not persisted in v0.5.4; it is computed from existing node fields and used by prompt rules, topology normalization, and overview projection.

The core rule is simple: root is a project entrypoint, not a task bucket. Structural nodes may be direct root children. Non-structural discoveries must attach to a meaningful structural parent or be grouped under a stable triage container.

## Architecture

### Derived Role Helper

Add feature-local pure helpers in `incrementalGeneration.ts` and export only what the layout layer needs:

```ts
type ProjectMapDerivedNodeRole =
  | "root"
  | "structural"
  | "capability"
  | "task"
  | "risk"
  | "artifact"
  | "evidence"
  | "workflow";

deriveProjectMapNodeRole(node): ProjectMapDerivedNodeRole
canProjectMapNodeAttachToRoot(node): boolean
```

Role inference uses generic project semantics, not this repository's personal workflow:

- `module`, `runtime`, `build`, `tech-stack`, `data`, `dependency`, `cross-cutting`, `api`, `interface` => structural
- `capability`, `flow`, `concept` => capability
- `risk` or risk-heavy title/detail => risk
- `test`, `quality` with test wording => task/evidence depending on wording
- nodeKind/title containing `bugfix`, `task`, `workflow`, `artifact`, `parser test`, `sentry`, `ci` => non-structural discovery

### Triage Container

When a generated or normalized node has no valid parent and cannot attach to root, create or reuse:

```text
id: unassigned-discoveries
nodeKind: cross-cutting
title: Unassigned Discoveries / 待整理发现
parentId: project-core
```

The node is generic and client-wide. It is not Trellis/OpenSpec-specific.

### Topology Normalization

Current behavior:

```ts
normalizeProjectMapNodeTopology(nodes, { attachOrphansToRoot: true })
```

This attaches all orphan nodes to root.

New behavior:

- valid parent remains valid
- root remains root
- orphan structural/capability node may attach to root when `attachOrphansToRoot=true`
- orphan non-structural node attaches to `unassigned-discoveries`
- existing direct root child that is non-structural is reparented to `unassigned-discoveries` during projection/auto normalization, without deleting content

### Overview Projection

`resolveVisibleProjectMapNodes(dataset, null)` should stop treating root direct children as automatically visible if they are non-structural. It should show:

- root
- structural/capability children of root
- triage container if it contains hidden discoveries

Focused node mode remains context-rich and can show non-structural children when the user drills into their parent or into triage.

### Prompt Contract

Auto ingestion currently tells the model that new top-level concepts must use the root id. Replace this with:

- create root children only for durable structural domains/modules
- task/risk/test/artifact/workflow discoveries must use the nearest existing parent
- if no reliable parent is available, use `unassigned-discoveries`
- do not create a second root

## Data Flow

1. AI or persisted snapshot provides nodes.
2. Persistence/merge calls `normalizeProjectMapNodeTopology`.
3. Normalizer deduplicates, validates parent references, applies role-aware root guard, and synthesizes triage container only when needed.
4. Layout projection calls the same normalizer and filters overview nodes through role-aware visibility.
5. Focused view remains based on selected node neighborhood.

## Error Handling

- If the dataset has no root, current fallback root resolution remains.
- If `unassigned-discoveries` already exists, reuse it and merge children.
- If all nodes are malformed/orphaned, do not throw during render; preserve safe fallback behavior and keep nodes reviewable.

## Compatibility

- No persisted schema migration.
- No new dependency.
- Existing candidate/stale/confidence/source behavior remains unchanged.
- Historical maps may render differently because projection now suppresses non-structural root clutter.

## Tests

- `incrementalGeneration.test.ts`
  - non-structural orphan auto node is placed under `unassigned-discoveries`
  - structural orphan can remain root child
  - non-structural direct root child is reparented during role-aware normalization
- `interactiveLayout.test.ts`
  - overview hides task/risk/artifact leaves from root ring
  - focused triage or parent node still reveals non-structural children
- `projectMapGenerationWorker.test.ts`
  - prompt no longer contains the old root-child instruction
  - prompt includes nearest-parent / unassigned-discoveries rule
