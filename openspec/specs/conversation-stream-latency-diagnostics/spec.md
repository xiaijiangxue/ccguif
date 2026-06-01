# conversation-stream-latency-diagnostics Specification

## Purpose

Define correlated stream latency diagnostics so the system can distinguish upstream provider delay, chunk cadence anomalies, and client-side render amplification during realtime conversation turns.
## Requirements
### Requirement: Stream Latency Diagnostics MUST Capture Correlated Turn Evidence

The system MUST record correlated latency evidence for streaming conversation turns so it can distinguish upstream provider delay, chunk cadence anomalies, client render amplification, and visible-output stalls.

#### Scenario: first token and render pacing are recorded with turn correlation

- **WHEN** a streaming conversation turn starts and later receives the first assistant chunk
- **THEN** the system MUST record first-token latency, first visible render latency, and subsequent chunk cadence summary
- **AND** records MUST include `workspaceId`, `threadId`, `engine`, `providerId/providerName/baseUrl`, `model`, and `platform` when available

#### Scenario: prolonged waiting or timeout still emits correlated latency evidence

- **WHEN** a streaming conversation remains in waiting state without receiving the first chunk, or eventually enters `FIRST_PACKET_TIMEOUT` or equivalent timeout
- **THEN** the system MUST record latency diagnostics with the same correlation dimensions
- **AND** diagnostics MUST distinguish no-first-packet from chunk cadence anomalies after ingress

#### Scenario: non-text runtime progress is not classified as backend silence

- **WHEN** a conversation has not yet received assistant text ingress
- **AND** the backend emits command execution, file change, tool output, terminal interaction, or equivalent runtime activity for the active turn
- **THEN** diagnostics MUST record that activity as non-text progress evidence
- **AND** first-token pending warnings MUST NOT fire solely because assistant text has not arrived yet
- **AND** the first assistant text latency MUST remain unset until assistant text ingress actually occurs

#### Scenario: candidate and active mitigation evidence are distinct

- **WHEN** a stream mitigation candidate profile is selected before or during visible render analysis
- **THEN** diagnostics MUST record candidate profile id and candidate reason separately from active mitigation profile id and active mitigation reason
- **AND** disabling active mitigation MUST NOT erase the evidence that a candidate was selected

### Requirement: Stream Latency Diagnostics MUST Reuse Existing Diagnostics Surfaces And Stay Bounded

系统 MUST 复用现有 renderer/runtime/thread diagnostics surfaces 暴露 stream latency 证据，并保持事件数量有界。

#### Scenario: renderer diagnostics append bounded latency events
- **WHEN** 前端记录 stream latency 相关事件
- **THEN** 系统 MUST 复用现有 renderer diagnostics 或等价 diagnostics surface 进行追加
- **AND** 事件缓冲 MUST 保持有界，不能因单个长会话无限增长

#### Scenario: runtime and thread diagnostics remain correlatable
- **WHEN** 同一条慢体验链路同时涉及前端等待态和 runtime-side timeout / degraded evidence
- **THEN** diagnostics MUST 保留可对齐的 correlation dimensions
- **AND** triage 时 MUST 能将 renderer 侧证据与 runtime/thread 侧证据关联到同一次 turn

### Requirement: Latency Diagnostics MUST Distinguish Upstream Delay From Client Render Amplification

The system MUST avoid recording all slow visible text symptoms as one root cause.

#### Scenario: upstream pending is classified without blaming renderer

- **WHEN** a conversation waits for a long time before receiving the first chunk
- **AND** renderer evidence does not show repeated render lag after chunk ingress
- **THEN** diagnostics MUST classify the slow path as upstream pending, first-token delay, or equivalent
- **AND** diagnostics MUST NOT report client render amplification as the primary cause

#### Scenario: render amplification is classified after chunk ingress exists

- **WHEN** a conversation has received chunks and chunk cadence is normal
- **AND** visible text or visible rows lag behind chunk arrival
- **THEN** diagnostics MUST classify the issue as client render amplification, render pacing lag, or equivalent
- **AND** diagnostics MUST retain evidence of active or candidate mitigation profile state

#### Scenario: first visible latency is classified before visible stall

- **WHEN** a Windows Claude Code turn has assistant text ingress
- **AND** the first visible render is delayed beyond the configured first-visible threshold
- **THEN** diagnostics MAY classify the delay separately from `visible-output-stall-after-first-delta`
- **AND** this classification MUST NOT be treated as proof of durable stale-thread recovery failure

### Requirement: Stream Latency Diagnostics MUST Classify Backend Forwarding Stalls Separately

The system MUST distinguish Claude backend event forwarding stalls from upstream first-token delay and frontend visible render stalls.

#### Scenario: backend stall is classified after engine event ingress
- **WHEN** the Claude engine has produced a stream delta inside the backend
- **AND** the corresponding app event is not emitted within the bounded forwarding window
- **THEN** diagnostics MUST classify the slow path as `backend-forwarder-stall` or an equivalent explicit category
- **AND** the classification MUST NOT be collapsed into upstream provider delay

#### Scenario: burst flush is classified when queued deltas arrive together
- **WHEN** multiple Claude deltas are emitted to the frontend after a long backend forwarding gap
- **THEN** diagnostics MUST record burst evidence such as max forwarding gap, queued delta count, or equivalent summary
- **AND** the classification MUST remain distinct from `visible-output-stall-after-first-delta`

#### Scenario: diagnostics correlate runtime sync and process snapshot timing
- **WHEN** backend forwarding latency overlaps runtime sync, process diagnostics, or ledger persistence work
- **THEN** diagnostics MUST preserve enough timing evidence to correlate the stall with that work
- **AND** the evidence MUST include `workspaceId`, `threadId`, `engine`, `platform`, and turn correlation where available

#### Scenario: backend evidence uses existing bounded diagnostics surfaces
- **WHEN** backend forwarding latency evidence is recorded for a Claude turn
- **THEN** the evidence MUST be written to an existing bounded diagnostics surface such as runtime diagnostics, renderer diagnostics correlation, app-server diagnostic events, structured logs, or an equivalent project-approved diagnostics channel
- **AND** the evidence MUST be correlatable by `workspaceId`, `threadId`, `turnId` where available, `engine`, and `platform`
- **AND** adding this evidence MUST NOT require changing the stable Tauri command payload contract for conversation streaming

#### Scenario: frontend classification only consumes backend evidence when surfaced
- **WHEN** backend forwarding evidence is exposed through an existing frontend-consumable diagnostics surface
- **THEN** frontend stream latency diagnostics MAY classify `backend-forwarder-stall` or burst-flush from that evidence
- **AND** when backend evidence is log-only, frontend diagnostics MUST keep using local ingress/render timing and MUST NOT infer backend-forwarder stalls from visible render delay alone

#### Scenario: frontend visible stall remains a separate category
- **WHEN** app events are emitted promptly but visible assistant text does not grow in the frontend
- **THEN** diagnostics MUST continue to classify the issue as `visible-output-stall-after-first-delta` or equivalent frontend render category
- **AND** backend forwarding stall evidence MUST NOT be reported as the primary category for that turn

### Requirement: Stream Diagnostics MUST Include Reducer Render And Composer Client Evidence
Stream latency diagnostics MUST capture frontend client evidence beyond first-token and visible text timing so triage can identify reducer, render, and composer hot paths.

#### Scenario: reducer amplification is observable after chunk ingress
- **WHEN** chunks arrive at normal cadence but reducer processing causes repeated expensive derivation or dispatch amplification
- **THEN** diagnostics MUST record bounded evidence such as batching queue size, flush count, reducer action counts, `prepareThreadItems(...)` call count or equivalent derivation cost, and affected thread id
- **AND** the classification MUST remain separate from upstream pending and backend forwarding stall

#### Scenario: composer responsiveness degradation is observable during streaming
- **WHEN** the user types while a conversation is streaming
- **THEN** diagnostics SHOULD capture bounded evidence of composer-facing update pressure or input responsiveness degradation when available
- **AND** this evidence MUST be correlated with stream engine, thread, turn, render profile, and active mitigation state

### Requirement: Diagnostics MUST Compare Baseline And Optimized Paths

Realtime diagnostics MUST support comparing baseline and optimized behavior without requiring a code rebuild.

#### Scenario: rollback flag keeps comparable diagnostics

- **WHEN** an optimization flag disables batching, incremental derivation, render pacing, or mitigation activation
- **THEN** diagnostics MUST continue emitting comparable evidence dimensions
- **AND** triage MUST be able to determine whether the regression exists in the optimized path, the baseline path, or both

#### Scenario: threshold configuration remains bounded and rollback-safe

- **WHEN** first-visible, render-amplification, visible-output-stall, or preemptive-candidate thresholds are adjusted through an approved config/debug path
- **THEN** diagnostics MUST record the threshold source or effective threshold where practical
- **AND** rollback to default thresholds MUST preserve existing non-Windows and non-Claude behavior

### Requirement: Stream Latency Diagnostics MUST Classify Claude First Token Delay Separately

The system MUST classify Claude Code first-token delay separately from backend forwarding stalls and frontend visible-output stalls.

#### Scenario: no stdout is classified as first-token startup latency
- **WHEN** a Claude Code turn has started and stdin has closed
- **AND** no stdout line has been observed within the bounded diagnostic window
- **THEN** diagnostics MUST classify the wait as Claude first-token or startup latency
- **AND** diagnostics MUST NOT report `backend-forwarder-stall` or `visible-output-stall-after-first-delta` as the primary category

#### Scenario: stdout without valid event is classified before parser ingress
- **WHEN** Claude Code stdout has produced at least one line
- **AND** no valid stream-json event has been parsed within the bounded diagnostic window
- **THEN** diagnostics MUST classify the wait as stdout-without-valid-event or equivalent parser/protocol startup latency
- **AND** diagnostics MUST preserve the distinction from no-stdout upstream delay

#### Scenario: valid event without text is classified before assistant ingress
- **WHEN** a valid Claude Code stream-json event has been parsed
- **AND** no assistant text delta has been emitted yet
- **THEN** diagnostics MUST classify the wait as valid-event-without-text or equivalent first-text latency
- **AND** diagnostics MUST NOT trigger frontend visible-stall mitigation until assistant text delta ingress exists

#### Scenario: malformed timing payloads are ignored safely
- **WHEN** frontend diagnostics receive missing, non-finite, negative, or otherwise malformed timing fields
- **THEN** diagnostics MUST ignore or clamp those fields safely
- **AND** diagnostic gap calculations MUST NOT produce negative durations

