## Purpose

Governance evidence bridge defines the typed, in-memory evidence substrate that connects workspace governance readers, harness gate outputs, checkpoint policies, and audit surfaces without adding persistence, transport, or a second dashboard.
## Requirements
### Requirement: Governance Evidence MUST Be A Typed In-Memory Discriminated Union

The system MUST expose a single `GovernanceEvidence` discriminated union, keyed by `source`, that normalizes governance signals coming from OpenSpec validation, large-file governance, heavy-test-noise sentry, realtime harness, engine capability matrix, engine runtime contract, and cost budget. Every variant MUST share a common envelope describing `id`, `source`, `status`, `degraded`, `degradationReason?`, `staleAt?`, and `updatedAt`. Variant-specific fields MUST be encoded under a typed `payload` field.

The bridge MUST evolve the existing workspace governance evidence readers under `src/features/governance/evidence/**`, whose current source ids are `openspec`, `trellis`, `script`, and `workflow`, until those readers are explicitly migrated with regression tests. The system MUST NOT introduce a second unconnected governance evidence bridge for policy input.

#### Scenario: every evidence variant carries the common envelope

- **WHEN** any source adapter produces a `GovernanceEvidence` value
- **THEN** the value MUST include `id`, `source`, `status`, `degraded`, and `updatedAt`
- **AND** `status` MUST be one of `pass`, `warn`, `fail`, or `unknown`
- **AND** the variant `payload` MUST conform to the discriminated shape declared for that `source`

#### Scenario: adding a new source requires an OpenSpec change

- **WHEN** a contributor proposes a new evidence `source`
- **THEN** the addition MUST be introduced through an OpenSpec change that updates this capability
- **AND** ad-hoc additions to the union without a corresponding spec change MUST be rejected by typecheck or by the bridge conformance check

#### Scenario: existing governance evidence readers remain compatible

- **WHEN** the bridge is introduced
- **THEN** existing readers under `src/features/governance/evidence/**` MUST continue to compile
- **AND** the current StatusPanel governance evidence surface MUST continue to render `openspec`, `trellis`, `script`, and `workflow` evidence or an explicitly wrapped equivalent

#### Scenario: policy and UI consume the same bridge substrate

- **WHEN** bridge-fed policies consume governance evidence
- **THEN** they MUST consume a snapshot derived from the same canonical bridge substrate used by `useGovernanceEvidence` or its migrated replacement
- **AND** no parallel bridge module may bypass existing workspace evidence compatibility tests

### Requirement: Bridge Snapshot MUST Be Pure, In-Memory, And Deterministic

The system MUST expose a framework-free snapshot core that returns a frozen, deterministic projection of all current evidence. React hooks such as `useGovernanceEvidence` MAY wrap that core for loading and rendering, but policy evaluation MUST receive the snapshot through `CheckpointPolicyEvidence` or an equivalent policy input object. Policy code MUST NOT import React hooks, Tauri workspace readers, or collection runtimes. Snapshots MUST NOT be persisted to disk, IndexedDB, localStorage, or any backend storage, and MUST NOT cross process boundaries.

#### Scenario: snapshot identity is stable within a commit

- **WHEN** the same snapshot is read twice within a single React commit
- **THEN** the returned reference MUST be identical
- **AND** the snapshot contents MUST be deeply equal

#### Scenario: snapshot core is independent from React and Tauri

- **WHEN** the snapshot core is tested in isolation
- **THEN** it MUST construct and freeze snapshots without mounting React hooks
- **AND** it MUST NOT require Tauri workspace ids, `getWorkspaceFiles`, or `readWorkspaceFile`

#### Scenario: snapshot is not persisted

- **WHEN** the bridge produces a snapshot
- **THEN** the snapshot MUST NOT be written to localStorage, IndexedDB, the filesystem, or any backend
- **AND** the snapshot MUST NOT be published over Tauri IPC, WebSocket, worker channel, or any cloud transport

#### Scenario: snapshot is safe to read from policy evaluate

- **WHEN** a policy `evaluate` function receives a snapshot through its evidence input
- **THEN** the policy MUST NOT mutate the snapshot
- **AND** the policy MUST NOT perform I/O while consuming the snapshot
- **AND** the policy MUST NOT call `useGovernanceEvidence` or any other React hook

#### Scenario: snapshot metadata links UI evidence and policy audit

- **WHEN** the same snapshot is used to render `GovernanceEvidenceSection` and evaluate bridge-fed policies
- **THEN** bridge-fed policy decisions MUST reference the snapshot identity through `evidenceSnapshotId`
- **AND** audit consumers MUST be able to trace each policy decision back to the evidence source in that snapshot

### Requirement: Source Adapters MUST Be Pure And Push-Based

Each source adapter MUST convert raw governance output into evidence without performing shell execution, network requests, or arbitrary filesystem reads inside a render or policy path. Reads from on-disk governance artifacts (e.g., OpenSpec validation cache, large-file report) MUST occur in a dedicated collection runtime before snapshot creation. That runtime MUST hand normalized raw input to adapters; adapters and consumers MUST NOT read arbitrary files themselves.

#### Scenario: adapter does not shell out during render or evaluate

- **WHEN** a snapshot is consumed by render code or by a policy `evaluate`
- **THEN** no source adapter or consumer MUST execute a shell command, spawn a child process, perform filesystem I/O, or open a network socket on the consumption path

#### Scenario: collection runtime owns artifact reads

- **WHEN** a governance report must be read from disk
- **THEN** the read MUST happen in the collection runtime before the frozen snapshot is created
- **AND** the resulting adapter input MUST be deterministic and testable without shell execution

#### Scenario: missing source produces unknown evidence

- **WHEN** a source artifact is unavailable (e.g., report file missing)
- **THEN** the adapter MUST produce evidence with `status: 'unknown'`
- **AND** the evidence MUST set `degraded: true` with a documented `degradationReason`

### Requirement: Stale And Degraded Evidence MUST Be Distinguishable From Healthy Evidence

The bridge MUST distinguish three quality states: healthy (`degraded: false`, `staleAt` absent or in future), degraded (`degraded: true` with an explicit `degradationReason`), and stale (`staleAt` indicates the evidence is past its freshness window). Consumers MUST be able to differentiate the three states without inspecting variant-specific payloads.

#### Scenario: degraded evidence carries an explicit reason

- **WHEN** an adapter emits evidence with `degraded: true`
- **THEN** the evidence MUST set `degradationReason` to a documented enum value
- **AND** the reason MUST be representable as an i18n key for downstream rendering

#### Scenario: stale evidence is tagged but still consumable

- **WHEN** evidence has passed its freshness window
- **THEN** the bridge MUST keep the evidence in the snapshot but mark `staleAt`
- **AND** consumers MUST be able to detect staleness without re-running the source

### Requirement: Governance Evidence Consumption MUST Default To Advisory Semantics

The system MUST treat all harness governance evidence consumed by the bridge, existing and new, as advisory by default. Missing artifacts, stale artifacts, malformed advisory reports, platform qualifiers, spec warnings, large-file near-threshold findings, and heavy-test-noise warnings MUST remain visible as governance evidence without automatically creating a blocking checkpoint verdict.

#### Scenario: missing governance artifact remains advisory

- **WHEN** a governance artifact is missing from the workspace
- **THEN** the evidence bridge MUST emit degraded or unknown evidence with a documented degradation reason
- **AND** the emitted evidence MUST NOT by itself force a `blocked` checkpoint verdict

#### Scenario: stale governance artifact remains visible without blocking

- **WHEN** an artifact-backed governance evidence item is stale
- **THEN** the evidence bridge MUST preserve the evidence source, observed time, and stale reason
- **AND** consumers MUST be able to render the stale state as an advisory signal
- **AND** the stale state MUST NOT by itself force a `blocked` checkpoint verdict

#### Scenario: advisory evidence keeps provenance

- **WHEN** governance evidence is rendered as an advisory signal
- **THEN** the evidence MUST still expose source identity and available provenance such as observed time, artifact path, artifact hash, and qualifier
- **AND** the UI MUST NOT hide provenance merely because the signal is non-blocking

### Requirement: Advisory Evidence MUST Preserve AI Execution Continuity

The bridge MUST NOT introduce evidence consumption behavior that requires shell execution, user confirmation, external CI completion, or synchronous artifact generation before an AI turn can continue.

#### Scenario: evidence gap does not block AI turn continuation

- **WHEN** the current workspace has an evidence gap such as a missing OpenSpec consistency artifact or absent platform qualifier
- **THEN** the bridge MUST represent the gap as advisory evidence
- **AND** the application MUST keep the AI execution flow available
- **AND** the evidence gap MUST NOT require immediate user confirmation before the next AI action

#### Scenario: suggested rerun remains optional

- **WHEN** the evidence bridge records a degradation reason that has a known validation command
- **THEN** downstream consumers MAY show the command as a suggested action
- **AND** the bridge MUST NOT execute that command on the render or policy evaluation path

### Requirement: Bridge MUST Be Validated By A Conformance Check

The system MUST provide a check named `npm run check:governance-evidence-bridge` that asserts: union exhaustiveness, snapshot determinism, adapter purity (no shell, filesystem read, or network inside snapshot consumption), absence of persistence/transport calls, compatibility with the existing workspace governance evidence readers, and absence of a second unconnected policy bridge. The check MUST run on Linux, macOS, and Windows.

#### Scenario: conformance check fails on a non-exhaustive consumer

- **WHEN** a consumer adds a switch over `source` that omits a variant
- **THEN** typecheck or the conformance check MUST fail

#### Scenario: conformance check passes on three platforms

- **WHEN** CI executes the conformance check on Linux, macOS, and Windows
- **THEN** the check MUST pass on all three platforms

### Requirement: Evidence Identity And Report Parsing MUST Be Cross-Platform Stable

The bridge MUST produce byte-stable evidence ids, source identifiers, and parsed report payloads across Windows, macOS, and Linux, except for explicitly documented timestamp fields. Evidence identity MUST use repository-relative normalized paths and MUST NOT depend on native path separators, absolute machine paths, platform temp directories, or filesystem case sensitivity.

#### Scenario: native paths are normalized before entering evidence

- **WHEN** a source artifact is discovered through a native filesystem path
- **THEN** the bridge MUST normalize the evidence-facing path to a repository-relative POSIX-style path
- **AND** the emitted evidence MUST NOT include user-specific absolute paths

#### Scenario: Windows path separators do not change evidence identity

- **WHEN** the same report is parsed from `src\\features\\x.ts` on Windows and `src/features/x.ts` on Linux or macOS
- **THEN** the emitted evidence id and source path MUST be identical after normalization

#### Scenario: CRLF and LF reports parse equivalently

- **WHEN** a governance report uses CRLF line endings on Windows and LF line endings on Linux or macOS
- **THEN** the parsed evidence payload MUST be equivalent
- **AND** policy decisions derived from the payload MUST be deterministic

### Requirement: Bridge Tooling MUST Avoid POSIX-Only Shell Assumptions

Bridge collection and validation tooling MUST run through platform-neutral Node/TypeScript entrypoints. Package scripts and checker implementations introduced by this change MUST NOT rely on inline POSIX shell syntax, `bash`-only behavior, `grep` / `sed` / `awk`, `/tmp`, `/dev/null`, shell glob expansion, or executable-bit assumptions.

#### Scenario: package script runs under Windows shell

- **WHEN** `npm run check:governance-evidence-bridge` runs on `windows-latest`
- **THEN** it MUST execute through a Node/TypeScript entrypoint
- **AND** it MUST NOT require `bash`, POSIX utilities, or Unix path syntax

#### Scenario: temp and artifact paths are platform-neutral

- **WHEN** bridge tests create temporary files or artifact paths
- **THEN** they MUST use Node APIs such as `os.tmpdir()` and `path.join()`
- **AND** the evidence-facing output MUST still be normalized to repository-relative POSIX-style paths

### Requirement: Governance Bridge MUST Use Profile-Aware Adapter Selection
The governance evidence bridge MUST select evidence adapters using `ProjectGovernanceProfile` applicability instead of a globally fixed harness checklist. Existing evidence readers MAY remain as implementation helpers, but they MUST be invoked only through applicable adapters or an equivalent profile-aware selection layer.

#### Scenario: global harness script list is not treated as universal
- **WHEN** a workspace does not expose harness governance scripts
- **THEN** the bridge MUST NOT emit a generic harness script evidence row solely because the product knows about mossx harness scripts

#### Scenario: applicable harness adapter preserves current mossx behavior
- **WHEN** a workspace profile detects mossx-style harness scripts and workflows
- **THEN** the bridge MAY emit harness script, workflow, and artifact evidence
- **AND** that evidence MUST continue to use the canonical `GovernanceEvidence` substrate

#### Scenario: adapter selection is deterministic
- **WHEN** the same profile and file contents are collected twice
- **THEN** the selected adapter list and emitted evidence ids MUST be deterministic

### Requirement: Governance Bridge MUST Merge Auto Profile And Optional Config Deterministically
The governance evidence bridge MUST merge automatically detected profile facts and optional `governance.config.json` override facts before adapter selection. Merge order and conflict resolution MUST be deterministic.

#### Scenario: config overrides OpenSpec root
- **WHEN** auto detection finds `openspec/`
- **AND** valid config declares `openspec.root` as `specs`
- **THEN** OpenSpec evidence MUST use the configured root
- **AND** the evidence row MUST preserve enough source metadata to explain that config influenced the root

#### Scenario: config can mark detected script as required
- **WHEN** auto detection finds a package script
- **AND** config marks that script as required
- **THEN** missing result artifacts for that script's declared gate MAY produce degraded evidence
- **AND** the required semantics MUST NOT apply to unrelated projects without that config or detected script

#### Scenario: malformed config does not suppress auto adapters
- **WHEN** config parsing fails
- **THEN** the bridge MUST emit config-degraded evidence
- **AND** adapters that apply from auto profile facts MUST still collect evidence

### Requirement: Non-Applicable Capabilities MUST Not Become Unknown Evidence
The bridge MUST distinguish non-applicable governance capabilities from missing evidence. Non-applicable capabilities MUST be omitted, while missing evidence for applicable capabilities MUST be emitted as degraded or unknown evidence.

#### Scenario: no OpenSpec workspace omits OpenSpec evidence
- **WHEN** a workspace has no OpenSpec directory or configured external OpenSpec workspace
- **THEN** the bridge MUST omit OpenSpec task evidence

#### Scenario: malformed OpenSpec workspace emits degraded evidence
- **WHEN** a workspace has OpenSpec task files but they cannot be parsed
- **THEN** the bridge MUST emit degraded OpenSpec evidence with a parse failure reason

### Requirement: Evidence Rows SHOULD Carry Action Metadata For Non-Pass States
Governance evidence emitted with `warn`, `fail`, `unknown`, stale, or degraded state MUST expose enough metadata for UI consumers to render impact and suggested action without hard-coding source-specific copy in the component.

#### Scenario: missing artifact evidence includes suggested command metadata
- **WHEN** an applicable artifact-backed gate is missing its result artifact
- **THEN** the evidence MUST identify the artifact path
- **AND** the evidence MUST expose a suggested validation command when one is known

#### Scenario: stale evidence includes freshness metadata
- **WHEN** artifact-backed evidence is stale
- **THEN** the evidence MUST include observed time or stale time metadata
- **AND** UI consumers MUST be able to render the stale reason without re-reading the artifact

### Requirement: Bridge Conformance MUST Guard Against Product-Specific Global Evidence Lists
The governance evidence bridge conformance check MUST fail when a new globally fixed product-specific evidence list is introduced without an applicability gate.

#### Scenario: hard-coded product-only adapter without appliesTo fails conformance
- **WHEN** a contributor adds a product-specific evidence adapter or known script list
- **AND** the adapter can emit evidence without checking `ProjectGovernanceProfile`
- **THEN** the conformance check MUST fail

#### Scenario: profile-scoped product adapter passes conformance
- **WHEN** a product-specific adapter declares and tests an applicability predicate
- **THEN** the conformance check MAY pass if non-applicable fixture profiles emit no rows from that adapter

