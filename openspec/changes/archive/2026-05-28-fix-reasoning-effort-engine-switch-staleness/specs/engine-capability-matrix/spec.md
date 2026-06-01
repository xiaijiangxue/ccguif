## ADDED Requirements

### Requirement: Claude Code MUST Declare Reasoning Effort Support

The engine capability matrix MUST declare Claude Code `reasoning.effort` as `supported` because Claude runtime command construction supports the user-facing `--effort` option.

#### Scenario: spec fixture marks Claude effort supported
- **WHEN** the capability matrix fixture is read from `openspec/specs/engine-capability-matrix/fixtures/matrix.json`
- **THEN** the `claude.reasoning.effort` cell MUST be `supported`
- **AND** this cell MUST NOT remain `unsupported` while Claude UI exposes a reasoning effort selector

#### Scenario: TypeScript capability projection agrees with Claude support
- **WHEN** TypeScript code resolves Claude Code capability state for `reasoning.effort`
- **THEN** the projected runtime status MUST be compatible with `supported`
- **AND** UI consumers MUST NOT receive a matrix/runtime disagreement that hides or disables Claude reasoning effort after an engine switch

#### Scenario: Rust capability projection agrees with Claude support
- **WHEN** Rust code resolves `EngineFeatures::claude()` or `capability_state(EngineType::Claude, "reasoning.effort")`
- **THEN** the result MUST report `supported`
- **AND** `npm run check:engine-capability-matrix` MUST fail if Rust, TypeScript, or the spec fixture disagree

#### Scenario: unsupported engines remain unsupported
- **WHEN** the matrix is updated for Claude Code reasoning effort
- **THEN** Gemini and OpenCode `reasoning.effort` cells MUST remain `unsupported`
- **AND** Codex `reasoning.effort` MUST keep its existing supported behavior
