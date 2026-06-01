## Verification Report: add-project-map-node-diagram-artifacts

### Summary

| Dimension | Status |
|---|---|
| Completeness | 11/11 tasks complete; 2 requirements synced into `project-xray-panel` |
| Correctness | Diagram payload parsing, sidecar persistence, inspector links, storage allowlist, and concurrent write safety mapped to focused tests |
| Consistency | Diagram content is stored as Markdown sidecar artifacts, not embedded into node text fields |

### Evidence

- OpenSpec strict validation recorded in tasks: `openspec validate add-project-map-node-diagram-artifacts --strict` passed.
- Main spec validation in this calibration: `openspec validate project-xray-panel --strict` passed.
- Full workspace validation in this calibration: `openspec validate --all --strict --no-interactive` passed with `317 passed, 0 failed`.
- Diff hygiene in this calibration: `git diff --check` passed.
- Focused validation recorded in tasks:
  - `projectMapPersistence.test.ts`
  - `projectMapGenerationWorker.test.ts`
  - `incrementalGeneration.test.ts`
  - `ProjectMapPanel.test.tsx`
- Rust validation recorded in tasks:
  - `cargo test --manifest-path src-tauri/Cargo.toml project_map`
  - `cargo test --manifest-path src-tauri/Cargo.toml read_external_absolute_file resolve_external_preview_handles_respect_allowed_roots_and_openspec_aliases`

### Requirement Mapping

#### Node diagram artifact links

- Prompt rules allow Mermaid diagrams only when they clarify flow, state, dependency, layering, sequence, or data movement.
- Diagram Markdown is written under Project Map `diagrams/` storage.
- Node detail stores diagram metadata/link only; `coreDescription`, `keyFacts`, `keyLogic`, and `riskSignals` remain text facts.
- Inspector renders diagram links through the existing file opening / Markdown preview path.
- Old snapshots without diagram fields remain compatible.

#### Diagram storage allowlist

- `diagrams/<diagram-id>.md` is accepted only for safe single-segment diagram ids.
- `diagrams/manifest.json` is accepted.
- Nested directories, parent traversal, absolute paths, and arbitrary files under `diagrams/` are rejected.
- Atomic temp names are unique per write attempt to avoid same-process collisions.

### Archive Decision

Ready for archive preparation. The diagram contract is synced into `project-xray-panel` and has frontend plus Rust boundary evidence.
