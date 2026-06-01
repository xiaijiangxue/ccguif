## ADDED Requirements

### Requirement: Engine Doctor MUST Resolve Executables With Platform-Aware Fallbacks

系统 MUST diagnose engine executable availability through a cross-platform resolver rather than relying only on the GUI process PATH.

#### Scenario: macOS resolver checks common shell paths

- **WHEN** Codex executable is not found in configured path or GUI process PATH on macOS
- **THEN** doctor MUST probe platform common paths including `/opt/homebrew/bin`, `/usr/local/bin`, and `/usr/bin`
- **AND** doctor MAY use a bounded login shell fallback such as `$SHELL -lc 'command -v codex'`

#### Scenario: Windows resolver handles executable wrappers

- **WHEN** Codex executable is not found in configured path or GUI process PATH on Windows
- **THEN** doctor MUST probe npm/global candidate paths and `where.exe codex`
- **AND** doctor MUST classify discovered `.exe`, `.cmd`, or `.ps1` wrappers with a wrapper kind or equivalent metadata

#### Scenario: Linux resolver checks local and shell paths

- **WHEN** Codex executable is not found in configured path or GUI process PATH on Linux
- **THEN** doctor MUST probe `/usr/local/bin`, `/usr/bin`, `$HOME/.local/bin`, and equivalent configured candidates
- **AND** doctor MAY use `$SHELL -lc 'command -v codex'` as a bounded fallback

### Requirement: Engine Doctor MUST Explain Environment Drift

系统 MUST return structured diagnosis when an executable exists in one environment but is invisible to the GUI runtime.

#### Scenario: login shell finds codex but gui path does not

- **WHEN** platform fallback finds a Codex executable that GUI process PATH did not expose
- **THEN** doctor MUST classify the result as environment drift or equivalent category
- **AND** UI MUST explain the resolved path and the reason the GUI path missed it

#### Scenario: configured invalid path is reported before fallback ambiguity

- **WHEN** user configured an explicit engine path and that path is invalid
- **THEN** doctor MUST report the configured path failure
- **AND** fallback discovery MUST NOT silently hide the invalid explicit configuration

### Requirement: Network Doctor MUST Classify Local Probe And Proxy Evidence

系统 MUST diagnose local engine probe failures and process proxy evidence with bounded categories rather than only exposing raw request errors.

#### Scenario: process proxy environment is reported

- **WHEN** doctor inspects network settings
- **THEN** result MUST include whether process proxy env is in effect
- **AND** secret-bearing proxy values MUST be redacted
- **AND** unset proxy variables MUST NOT create noisy normal-state UI rows

#### Scenario: local app-server probe classifies failure

- **WHEN** the local engine app-server probe fails
- **THEN** doctor MUST classify the failure as `missingProxy`, `proxyUnreachable`, `dnsFailure`, `tlsFailure`, `timeout`, `httpStatus`, or `unknown`
- **AND** UI MUST show the category only when it is actionable

#### Scenario: successful probe hides unknown network state

- **WHEN** the local probe succeeds and no actionable network category exists
- **THEN** UI MUST NOT show `unknown` network diagnosis
