## ADDED Requirements

### Requirement: Settings Mail Session Controls MUST Provide Action Feedback
Settings 的邮件会话 tab SHALL expose refresh and cleanup controls that are visibly actionable and report execution state to the user.

#### Scenario: refresh mail sessions reports progress and success
- **WHEN** 用户点击 `刷新会话`
- **THEN** Settings UI MUST show a refresh-in-progress state for that control
- **AND** the UI MUST reload the mail session projection through the typed Tauri bridge
- **AND** the UI MUST show a success notice after the refreshed projection is applied

#### Scenario: refresh mail sessions reports failure
- **WHEN** 用户点击 `刷新会话`
- **AND** the backend refresh or listing call fails
- **THEN** Settings UI MUST clear the refresh-in-progress state
- **AND** the UI MUST show a readable error notice
- **AND** existing mail session rows MUST remain visible unless a successful refresh replaces them

#### Scenario: cleanup processed records reports progress and result
- **WHEN** 用户点击 `清理已处理记录`
- **THEN** Settings UI MUST show a cleanup-in-progress state for that control
- **AND** the UI MUST call the existing typed mail session mutation bridge with the cleanup action
- **AND** the UI MUST refresh the mail session projection after cleanup completes
- **AND** the UI MUST show either a success notice or a readable error notice

### Requirement: Settings Mail Session Detail MUST Stay Visible Near List Controls
Settings 的邮件会话 tab SHALL render the selected mail session detail near the list controls rather than appending it after the full list.

#### Scenario: viewing mail details opens an above-list detail panel
- **WHEN** 用户点击某个邮件会话行的 `查看邮件`
- **THEN** Settings UI MUST render that session's mail detail panel between the action controls and the session list
- **AND** the selected row MUST show a distinct selected state
- **AND** the detail panel MUST identify the selected session

#### Scenario: detail panel can be closed
- **WHEN** a mail session detail panel is visible
- **AND** 用户点击关闭入口
- **THEN** Settings UI MUST clear the selected mail session
- **AND** the detail panel MUST be removed from the visible tab content
- **AND** no existing mail session row or open-session action MUST be removed

#### Scenario: long mail details scroll inside the detail panel
- **WHEN** the selected mail session contains enough mail events to exceed the panel's visible content area
- **THEN** the detail content MUST scroll inside the detail panel
- **AND** the session list MUST NOT be silently pushed below the page without visible feedback

### Requirement: Settings Mail Session Actions MUST Preserve Existing Navigation
Settings 的邮件会话 tab SHALL preserve the existing open-session behavior while adding mail management actions.

#### Scenario: open session behavior remains unchanged
- **WHEN** 用户点击邮件会话行的 `打开会话`
- **THEN** Settings UI MUST call the existing open mail session handler with the same session identity contract as before this change
- **AND** the new view, refresh, cleanup, or delete-mail-records UI states MUST NOT change the target workspace, thread, turn, or session routing
