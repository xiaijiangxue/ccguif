# claude-history-transcript-visibility Specification

## Purpose

Defines the claude-history-transcript-visibility behavior contract, covering Claude History Restore MUST Preserve A Readable Transcript Surface.
## Requirements
### Requirement: Claude History Restore MUST Preserve A Readable Transcript Surface

当 `Claude Code` 历史会话的 transcript 主要由 `thinking`、`tool_use`、`tool_result` 组成且普通 assistant 正文极少时，系统 MUST 在 history restore 后保留至少一个可读 transcript surface，不得把该会话误判为 empty thread。

#### Scenario: transcript-heavy Claude history does not render as an empty thread

- **WHEN** 当前引擎为 `claude`
- **AND** 当前线程来自 history restore / reopen，而不是 realtime processing
- **AND** 该会话存在多条 `reasoning` 或 `tool` transcript
- **AND** 普通 assistant `text` 非常少或为空
- **THEN** 消息区 MUST 保留至少一个可读 transcript surface
- **AND** 系统 MUST NOT 渲染为 `messages.emptyThread`

### Requirement: Claude Transcript Fallback MUST Stay Engine-Scoped

针对 transcript-heavy history 的 fallback MUST 限定在 `Claude Code` 引擎，不得扩散到其他引擎。

#### Scenario: non-Claude engines do not inherit Claude transcript fallback

- **WHEN** 当前引擎为 `codex`、`gemini` 或 `opencode`
- **THEN** 系统 MUST NOT 自动套用 `Claude` history transcript fallback
- **AND** 这些引擎既有 history visible-surface contract MUST 保持不变

### Requirement: Claude History Fallback MUST Not Inflate Ordinary Histories

该 fallback MUST 仅用于“空白误判保护”，系统 MUST NOT 把普通 `Claude` 历史统一变成高噪声 command transcript 视图。

#### Scenario: ordinary Claude history keeps the existing text-first reading surface

- **WHEN** 当前引擎为 `claude`
- **AND** 历史会话本身已经包含正常的 assistant 正文消息
- **THEN** 系统 MUST 继续保持现有 text-first 历史阅读体验
- **AND** MUST NOT 仅因为存在 command transcript 就强制展示额外高噪声 tool surface

### Requirement: Claude History MUST Filter Cross-Engine Control Plane Contamination

Claude history parsing MUST filter Codex or GUI control-plane payloads before projecting user-visible sessions or messages.

#### Scenario: control-plane payload is not used as first message
- **WHEN** a Claude JSONL entry contains control-plane text such as JSON-RPC `initialize`, `clientInfo.name=ccgui`, `capabilities.experimentalApi`, `developer_instructions`, or Codex `app-server` launch text
- **THEN** the backend scanner MUST NOT use that text as the session first user message
- **AND** it MUST NOT derive a user-visible session title from that text

#### Scenario: control-plane-only transcript is omitted from session list
- **WHEN** a Claude history transcript contains no real user or assistant conversation after filtering control-plane entries
- **THEN** the backend MUST omit that transcript from the visible Claude session list
- **AND** the frontend MUST NOT recreate a visible conversation from the filtered entries

#### Scenario: mixed transcript keeps valid messages
- **WHEN** a Claude history transcript contains real conversation messages and control-plane contamination
- **THEN** the backend MUST keep the valid conversation messages
- **AND** the frontend loader MUST keep the valid conversation messages if it receives a mixed payload

#### Scenario: normal Claude messages are not over-filtered
- **WHEN** a real user message mentions terms such as `app-server` without matching high-confidence control-plane structure
- **THEN** the system MUST keep that message visible
- **AND** it MUST NOT hide normal conversation content solely because it contains a keyword

### Requirement: Claude History Contamination Filtering MUST Be Cross-Platform

Claude history contamination filtering MUST behave consistently on Windows and macOS because polluted JSONL shape is engine-protocol based rather than OS-specific.

#### Scenario: Windows polluted transcript is filtered
- **WHEN** Windows Claude history contains Codex control-plane payloads produced through wrapper, PATH, or proxy misrouting
- **THEN** the system MUST filter those payloads using the same contamination rules
- **AND** it MUST avoid showing `app-server` or `developer` pseudo sessions

#### Scenario: macOS polluted transcript is filtered
- **WHEN** macOS Claude history contains Codex control-plane payloads produced through custom binary or PATH misrouting
- **THEN** the system MUST filter those payloads using the same contamination rules
- **AND** it MUST preserve real Claude conversation content in mixed transcripts

### Requirement: Claude History Filtering MUST Be Protected By CI Gates

Claude history contamination filtering MUST be covered by backend and frontend tests.

#### Scenario: backend tests cover session scanner behavior
- **WHEN** backend tests exercise Claude history scanning
- **THEN** they MUST prove control-plane-only JSONL transcripts do not produce visible session summaries
- **AND** they MUST prove mixed transcripts retain real user messages

#### Scenario: frontend tests cover loader fallback behavior
- **WHEN** frontend tests exercise Claude history loader parsing
- **THEN** they MUST prove control-plane messages are skipped
- **AND** they MUST prove normal Claude messages remain visible

### Requirement: Claude History Reasoning MUST Respect Thinking Visibility

Claude history restore MUST preserve reasoning transcript data while applying the current Claude thinking visibility state to the user-visible conversation canvas.

#### Scenario: hidden thinking suppresses history reasoning text
- **WHEN** current engine is `claude`
- **AND** Claude thinking visibility is disabled
- **AND** restored Claude history contains `thinking` or `reasoning` blocks
- **THEN** the system MUST NOT render those reasoning blocks as visible reasoning body text in the conversation canvas
- **AND** the underlying parsed transcript data MUST NOT be physically deleted solely because it is hidden

#### Scenario: visible thinking restores history reasoning text
- **WHEN** current engine is `claude`
- **AND** Claude thinking visibility is enabled
- **AND** restored Claude history contains `thinking` or `reasoning` blocks
- **THEN** the system MUST be allowed to render those blocks through the existing reasoning presentation

#### Scenario: hidden reasoning does not create empty thread regression
- **WHEN** current engine is `claude`
- **AND** Claude thinking visibility is disabled
- **AND** restored history contains hidden reasoning plus assistant, tool, approval, or transcript fallback surfaces
- **THEN** the system MUST NOT render the thread as `messages.emptyThread`
- **AND** it MUST preserve the remaining visible transcript surfaces

#### Scenario: reasoning-only history avoids content leakage
- **WHEN** current engine is `claude`
- **AND** Claude thinking visibility is disabled
- **AND** restored history contains only reasoning transcript content and no other visible transcript surface
- **THEN** the system MUST NOT reveal the hidden reasoning body text
- **AND** it SHOULD show a non-content-leaking placeholder instead of treating the transcript as corrupted

### Requirement: Claude History Reasoning Visibility MUST Be Reversible

The system MUST allow Claude history reasoning presentation to follow later visibility changes without requiring the history transcript to be regenerated.

#### Scenario: re-enable thinking after hidden restore
- **WHEN** a Claude history conversation was restored while thinking visibility was disabled
- **AND** the user later enables Claude thinking visibility
- **THEN** the system SHOULD be able to display the previously hidden reasoning from retained transcript data
- **AND** it MUST NOT require creating a new Claude session to recover that reasoning presentation

### Requirement: Claude History Restore MUST Defer Large Inline Image Payloads

Claude history restore MUST preserve readable transcript content while avoiding eager renderer delivery of large inline base64 image payloads.

#### Scenario: large inline image becomes deferred placeholder
- **WHEN** a Claude JSONL message contains an inline base64 image payload above the eager inline budget
- **THEN** history restore MUST return a deferred image placeholder or equivalent media descriptor
- **AND** it MUST NOT return the large base64 payload or data URI in the default history restore response
- **AND** the surrounding user, assistant, reasoning, and tool transcript content MUST remain readable

#### Scenario: small inline image compatibility is preserved
- **WHEN** a Claude JSONL message contains an inline image payload within the eager inline budget
- **THEN** history restore MAY keep using the existing inline image representation
- **AND** existing small-image history behavior MUST remain backward compatible

#### Scenario: deferred image carries stable locator metadata
- **WHEN** history restore defers a Claude image payload
- **THEN** the deferred media descriptor MUST include enough locator metadata to request that specific image later
- **AND** the locator MUST distinguish the session, source message or line, content block, and media type when available

### Requirement: Claude Deferred History Image MUST Be Loadable On Demand

The system MUST allow a user to manually hydrate one deferred Claude history image without reloading all large image payloads for the session.

#### Scenario: user clicks deferred image placeholder
- **WHEN** the conversation curtain displays a deferred Claude image placeholder
- **AND** the user requests to load it
- **THEN** the system MUST request only the selected image payload from the backend
- **AND** it MUST replace or expand the placeholder with the hydrated image when the backend returns a valid payload

#### Scenario: stale deferred image locator is recoverable
- **WHEN** the user requests a deferred Claude image
- **AND** the underlying JSONL file or block no longer matches the locator
- **THEN** the system MUST show a recoverable image-load error for that placeholder
- **AND** it MUST NOT clear the restored conversation transcript

### Requirement: Claude History Scanner SHALL Produce Bounded Session Facts

Claude history scanning SHALL produce bounded session facts and diagnostics for catalog projection without requiring full transcript restoration or leaking large inline payloads into session summaries.

#### Scenario: scanner returns summary without full transcript payload
- **WHEN** the backend scans Claude history for workspace session catalog membership
- **THEN** it MUST return bounded metadata such as canonical session id, timestamps, cwd, physical path, parent id, message count, and first real user message
- **AND** it MUST NOT include full transcript bodies or large inline media payloads in the catalog summary

#### Scenario: malformed transcript is source-scoped degradation
- **WHEN** one Claude transcript is malformed, oversized, or unreadable during catalog scanning
- **THEN** the scanner MUST mark the Claude source or candidate as degraded
- **AND** it MUST NOT clear unrelated valid Claude sessions for the workspace

#### Scenario: control-plane messages do not become title facts
- **WHEN** a Claude transcript contains GUI, Codex, JSON-RPC, or other control-plane payloads
- **THEN** the scanner MUST NOT use those payloads as first real user message or title evidence
- **AND** valid real conversation messages in the same transcript MUST remain eligible as title evidence

#### Scenario: scanner reports candidate diagnostics without leaking transcript body
- **WHEN** a Claude transcript cannot be attributed, parsed, or summarized for catalog membership
- **THEN** the scanner MUST return bounded diagnostic evidence such as reason code, candidate count, redacted path locator, or file metadata
- **AND** it MUST NOT return full transcript body, large inline media payloads, or control-plane payload text as diagnostic content

### Requirement: Claude Transcript Loader SHALL Remain Separate From Workspace Membership

Claude transcript loading SHALL restore readable session history for a selected session but SHALL NOT perform independent workspace membership decisions for default workspace lists.

#### Scenario: loader opens catalog-selected session
- **WHEN** the user opens a Claude session from Sidebar or Session Management
- **THEN** the loader MUST resolve and restore that selected native Claude transcript
- **AND** it MUST NOT infer additional workspace membership from the restored messages

#### Scenario: loader failure does not rewrite catalog membership
- **WHEN** Claude transcript loading fails for a selected catalog row
- **THEN** the UI MUST show a recoverable load failure for that row
- **AND** it MUST NOT silently remove the row from workspace membership unless catalog refresh later proves authoritative removal

#### Scenario: late transcript restore updates content only
- **WHEN** a delayed Claude transcript restore completes after the catalog projection has already rendered the row
- **THEN** it MAY update the readable conversation content
- **AND** it MUST NOT change owner workspace or strict scope membership outside the catalog resolver

### Requirement: Claude Issue 529 Transcript MUST Keep Real Rows Around Synthetic Resume Rows

Claude history restore MUST ignore synthetic resume/no-response rows without dropping adjacent real second-turn user, tool, and assistant rows.

#### Scenario: synthetic resume rows do not hide following real turn
- **WHEN** a Claude JSONL transcript contains synthetic resume rows such as continuation prompts or `No response requested.`
- **AND** later rows contain a real user request and Claude assistant/tool output
- **THEN** the restored transcript MUST omit the synthetic rows
- **AND** it MUST keep the later real user, tool, and assistant rows visible

#### Scenario: missing explicit session id still uses file session identity
- **WHEN** Claude JSONL message rows omit explicit `session_id` fields
- **AND** the JSONL filename and workspace `cwd` identify the session and project
- **THEN** history restore and listing MUST use the file session identity as the canonical session identity
- **AND** the absence of per-line `session_id` MUST NOT make the restored transcript empty

### Requirement: Claude History Restore MUST Recover Interrupted Live Assistant Text From Shadow Transcript

Claude history restore MUST use a trusted local live assistant shadow transcript to preserve a readable assistant surface when the Claude JSONL source lacks the final assistant body for an interrupted long output.

#### Scenario: provider transcript lacks final assistant body but shadow exists
- **WHEN** current engine is `claude`
- **AND** a restored Claude history contains the triggering user turn, thinking, reasoning, or tool transcript entries
- **AND** it does not contain an equivalent assistant final text body for that turn
- **AND** a matching recent live assistant shadow transcript exists
- **THEN** restore MUST insert a readable assistant text surface from the shadow transcript
- **AND** the restored item MUST carry metadata indicating it was recovered from local shadow state

#### Scenario: provider final body prevents shadow duplication
- **WHEN** current engine is `claude`
- **AND** the Claude JSONL source contains a valid assistant final text body for the same turn
- **THEN** restore MUST use the provider transcript as the primary source
- **AND** it MUST NOT add a duplicate recovered assistant item from shadow state

#### Scenario: shadow recovery does not reveal hidden thinking
- **WHEN** Claude thinking visibility is disabled
- **AND** restore recovers assistant text from a shadow transcript
- **THEN** restore MUST preserve the assistant text body
- **AND** it MUST still apply the existing thinking visibility rules to reasoning or thinking content

