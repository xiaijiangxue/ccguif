use chrono::{DateTime, Local};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::Path;

const LOG_SCHEMA_VERSION: u8 = 1;
const MAX_SOURCE_CHARS: usize = 32;
const MAX_LABEL_CHARS: usize = 240;
const MAX_LOG_LINE_BYTES: usize = 64 * 1024;

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ClientErrorLogEntry {
    pub(crate) schema_version: u8,
    pub(crate) timestamp: String,
    pub(crate) source: String,
    pub(crate) label: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) payload: Option<Value>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ClientErrorLogAppendResult {
    pub(crate) file_path: String,
}

#[tauri::command]
pub(crate) fn append_client_error_log(
    entry: ClientErrorLogEntry,
) -> Result<ClientErrorLogAppendResult, String> {
    append_client_error_log_to_dir(&crate::app_paths::error_log_dir()?, entry)
}

fn append_client_error_log_to_dir(
    log_dir: &Path,
    entry: ClientErrorLogEntry,
) -> Result<ClientErrorLogAppendResult, String> {
    fs::create_dir_all(log_dir)
        .map_err(|error| format!("failed to create client error log directory: {error}"))?;

    let file_path = log_dir.join(daily_log_file_name(&entry.timestamp));
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&file_path)
        .map_err(|error| format!("failed to open client error log file: {error}"))?;

    let mut line = serialize_bounded_entry(entry)?;
    line.push('\n');
    file.write_all(line.as_bytes())
        .map_err(|error| format!("failed to append client error log entry: {error}"))?;

    Ok(ClientErrorLogAppendResult {
        file_path: file_path.to_string_lossy().to_string(),
    })
}

fn daily_log_file_name(timestamp: &str) -> String {
    let date = DateTime::parse_from_rfc3339(timestamp)
        .map(|value| value.with_timezone(&Local).format("%Y-%m-%d").to_string())
        .unwrap_or_else(|_| Local::now().format("%Y-%m-%d").to_string());
    format!("{date}.jsonl")
}

fn serialize_bounded_entry(entry: ClientErrorLogEntry) -> Result<String, String> {
    let mut normalized = ClientErrorLogEntry {
        schema_version: LOG_SCHEMA_VERSION,
        timestamp: truncate_chars(&entry.timestamp, 64),
        source: truncate_chars(&entry.source, MAX_SOURCE_CHARS),
        label: truncate_chars(&entry.label, MAX_LABEL_CHARS),
        payload: entry.payload,
    };

    let line = serde_json::to_string(&normalized)
        .map_err(|error| format!("failed to serialize client error log entry: {error}"))?;
    if line.len() <= MAX_LOG_LINE_BYTES {
        return Ok(line);
    }

    normalized.payload = Some(json!({
        "truncated": true,
        "reason": "client-error-log-line-too-large",
        "originalSerializedBytes": line.len(),
    }));
    serde_json::to_string(&normalized)
        .map_err(|error| format!("failed to serialize truncated client error log entry: {error}"))
}

fn truncate_chars(value: &str, max_chars: usize) -> String {
    if value.chars().count() <= max_chars {
        return value.to_string();
    }
    let truncated: String = value.chars().take(max_chars).collect();
    format!("{truncated}...(truncated)")
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::path::PathBuf;
    use uuid::Uuid;

    fn temp_log_dir() -> PathBuf {
        std::env::temp_dir()
            .join("ccgui-client-error-log-tests")
            .join(Uuid::new_v4().to_string())
    }

    #[test]
    fn appends_jsonl_entry_to_daily_log_file() {
        let log_dir = temp_log_dir();
        let result = append_client_error_log_to_dir(
            &log_dir,
            ClientErrorLogEntry {
                schema_version: 1,
                timestamp: "2026-05-29T12:34:56.000Z".to_string(),
                source: "error".to_string(),
                label: "terminal close error".to_string(),
                payload: Some(json!({ "workspaceId": "ws-1", "reason": "boom" })),
            },
        )
        .expect("append error log");

        let file_path = PathBuf::from(&result.file_path);
        assert_eq!(file_path.file_name().unwrap(), "2026-05-29.jsonl");
        let content = fs::read_to_string(&file_path).expect("read jsonl");
        let lines: Vec<&str> = content.lines().collect();
        assert_eq!(lines.len(), 1);
        let parsed: Value = serde_json::from_str(lines[0]).expect("parse jsonl line");
        assert_eq!(parsed["schemaVersion"], 1);
        assert_eq!(parsed["source"], "error");
        assert_eq!(parsed["label"], "terminal close error");
        assert_eq!(parsed["payload"]["workspaceId"], "ws-1");

        let _ = fs::remove_dir_all(log_dir);
    }

    #[test]
    fn replaces_oversized_payload_with_truncation_metadata() {
        let line = serialize_bounded_entry(ClientErrorLogEntry {
            schema_version: 1,
            timestamp: "2026-05-29T12:34:56.000Z".to_string(),
            source: "stderr".to_string(),
            label: "large stderr".to_string(),
            payload: Some(json!({ "stderr": "x".repeat(MAX_LOG_LINE_BYTES + 1000) })),
        })
        .expect("serialize bounded entry");

        assert!(line.len() < MAX_LOG_LINE_BYTES);
        let parsed: Value = serde_json::from_str(&line).expect("parse truncated line");
        assert_eq!(parsed["payload"]["truncated"], true);
        assert_eq!(
            parsed["payload"]["reason"],
            "client-error-log-line-too-large"
        );
    }
}
