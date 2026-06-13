use serde::{Deserialize, Serialize};

// ── LSP Protocol Types ──────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Position {
    pub line: u32,
    pub character: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Range {
    pub start: Position,
    pub end: Position,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Location {
    pub uri: String,
    pub range: Range,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Diagnostic {
    pub range: Range,
    pub severity: Option<u32>,
    pub code: Option<serde_json::Value>,
    pub source: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextDocumentIdentifier {
    pub uri: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextDocumentItem {
    pub uri: String,
    pub language_id: String,
    pub version: i32,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionedTextDocumentIdentifier {
    pub uri: String,
    pub version: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextDocumentPositionParams {
    #[serde(rename = "textDocument")]
    pub text_document: TextDocumentIdentifier,
    pub position: Position,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublishDiagnosticsParams {
    pub uri: String,
    pub diagnostics: Vec<Diagnostic>,
}

// ── JDTLS Specific Types ────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InitializeParams {
    #[serde(rename = "processId")]
    pub process_id: Option<u32>,
    #[serde(rename = "rootUri")]
    pub root_uri: Option<String>,
    pub capabilities: ClientCapabilities,
    #[serde(rename = "initializationOptions")]
    pub initialization_options: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientCapabilities {
    #[serde(rename = "textDocument")]
    pub text_document: TextDocumentClientCapabilities,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextDocumentClientCapabilities {
    pub definition: Option<serde_json::Value>,
    pub references: Option<serde_json::Value>,
    pub implementation: Option<serde_json::Value>,
    pub diagnostic: Option<serde_json::Value>,
    pub hover: Option<serde_json::Value>,
    pub synchronization: Option<TextDocumentSyncClientCapabilities>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextDocumentSyncClientCapabilities {
    pub dynamic_registration: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InitializeResult {
    pub capabilities: ServerCapabilities,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerCapabilities {
    #[serde(rename = "textDocumentSync")]
    pub text_document_sync: Option<TextDocumentSyncCapability>,
    #[serde(rename = "definitionProvider")]
    pub definition_provider: Option<serde_json::Value>,
    #[serde(rename = "referencesProvider")]
    pub references_provider: Option<serde_json::Value>,
    #[serde(rename = "implementationProvider")]
    pub implementation_provider: Option<serde_json::Value>,
    #[serde(rename = "hoverProvider")]
    pub hover_provider: Option<serde_json::Value>,
    #[serde(rename = "diagnosticProvider")]
    pub diagnostic_provider: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextDocumentSyncCapability {
    pub open_close: Option<bool>,
    pub change: Option<u32>,
}

// ── JSON-RPC Types ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcRequest {
    pub jsonrpc: String,
    pub id: u64,
    pub method: String,
    pub params: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcResponse {
    pub jsonrpc: String,
    pub id: Option<u64>,
    pub result: Option<serde_json::Value>,
    pub error: Option<JsonRpcError>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcNotification {
    pub jsonrpc: String,
    pub method: String,
    pub params: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcError {
    pub code: i32,
    pub message: String,
    pub data: Option<serde_json::Value>,
}

// ── JdtlsManager Status ─────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JdtlsStatus {
    pub status: String, // "starting" | "indexing" | "ready" | "unavailable" | "stopped"
    pub java_version: Option<String>,
    pub jdtls_path: Option<String>,
    pub error: Option<String>,
    pub uptime_seconds: Option<u64>,
    pub open_files_count: usize,
}

// ── Navigation Result ───────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NavigationResult {
    pub file_path: String,
    pub line: u32,
    pub character: u32,
    pub source: String,
    pub locations: Vec<NavigationLocation>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NavigationLocation {
    pub uri: String,
    pub path: String,
    pub range: Range,
}

// ── Constants ───────────────────────────────────────────────────

pub const REQUEST_TIMEOUT_MS: u64 = 8_000;
pub const IDLE_SHUTDOWN_MS: u64 = 30 * 60 * 1_000; // 30 minutes
pub const MAX_INDEXING_WAIT_MS: u64 = 120 * 1_000; // 2 minutes


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn jsonrpc_request_serialization_roundtrip() {
        let req = JsonRpcRequest {
            jsonrpc: "2.0".into(),
            id: 1,
            method: "textDocument/definition".into(),
            params: Some(serde_json::json!({
                "textDocument": { "uri": "file:///test/Foo.java" },
                "position": { "line": 10, "character": 5 }
            })),
        };
        let json = serde_json::to_string(&req).unwrap();
        let deser: JsonRpcRequest = serde_json::from_str(&json).unwrap();
        assert_eq!(deser.id, 1);
        assert_eq!(deser.method, "textDocument/definition");
    }

    #[test]
    fn jsonrpc_request_with_null_params() {
        let req = JsonRpcRequest {
            jsonrpc: "2.0".into(),
            id: 42,
            method: "shutdown".into(),
            params: None,
        };
        let json = serde_json::to_string(&req).unwrap();
        let deser: JsonRpcRequest = serde_json::from_str(&json).unwrap();
        assert!(deser.params.is_none());
    }

    #[test]
    fn jsonrpc_response_success() {
        let json = r#"{"jsonrpc":"2.0","id":1,"result":{"uri":"file:///x.java","range":{"start":{"line":5,"character":0},"end":{"line":5,"character":10}}}}"#;
        let resp: JsonRpcResponse = serde_json::from_str(json).unwrap();
        assert_eq!(resp.id, Some(1));
        assert!(resp.result.is_some());
        assert!(resp.error.is_none());
    }

    #[test]
    fn jsonrpc_response_error() {
        let json = r#"{"jsonrpc":"2.0","id":2,"error":{"code":-32601,"message":"Method not found"}}"#;
        let resp: JsonRpcResponse = serde_json::from_str(json).unwrap();
        assert_eq!(resp.id, Some(2));
        let err = resp.error.unwrap();
        assert_eq!(err.code, -32601);
    }

    #[test]
    fn jsonrpc_notification_has_no_id() {
        let json = r#"{"jsonrpc":"2.0","method":"textDocument/publishDiagnostics","params":{}}"#;
        let resp: JsonRpcResponse = serde_json::from_str(json).unwrap();
        assert!(resp.id.is_none());
    }

    #[test]
    fn jdtls_status_serialization() {
        let status = JdtlsStatus {
            status: "ready".into(),
            java_version: Some("17.0.2".into()),
            jdtls_path: Some("/usr/local/jdtls/launcher.jar".into()),
            error: None,
            uptime_seconds: Some(3600),
            open_files_count: 3,
        };
        let json = serde_json::to_string(&status).unwrap();
        let deser: JdtlsStatus = serde_json::from_str(&json).unwrap();
        assert_eq!(deser.status, "ready");
        assert_eq!(deser.open_files_count, 3);
    }

    #[test]
    fn jdtls_status_unavailable() {
        let status = JdtlsStatus {
            status: "unavailable".into(),
            java_version: None,
            jdtls_path: None,
            error: Some("JDK 17+ not found".into()),
            uptime_seconds: None,
            open_files_count: 0,
        };
        let json = serde_json::to_string(&status).unwrap();
        let deser: JdtlsStatus = serde_json::from_str(&json).unwrap();
        assert_eq!(deser.status, "unavailable");
        assert!(deser.error.is_some());
    }

    #[test]
    fn position_roundtrip() {
        let pos = Position { line: 42, character: 15 };
        let json = serde_json::to_string(&pos).unwrap();
        let deser: Position = serde_json::from_str(&json).unwrap();
        assert_eq!(deser.line, 42);
        assert_eq!(deser.character, 15);
    }

    #[test]
    fn location_roundtrip() {
        let loc = Location {
            uri: "file:///src/UserMapper.java".into(),
            range: Range {
                start: Position { line: 10, character: 4 },
                end: Position { line: 10, character: 20 },
            },
        };
        let json = serde_json::to_string(&loc).unwrap();
        let deser: Location = serde_json::from_str(&json).unwrap();
        assert_eq!(deser.uri, loc.uri);
        assert_eq!(deser.range.start.line, 10);
    }

    #[test]
    fn diagnostic_severity_values() {
        let diag = Diagnostic {
            range: Range {
                start: Position { line: 0, character: 0 },
                end: Position { line: 0, character: 5 },
            },
            severity: Some(1),
            code: Some(serde_json::json!("cannot-find-symbol")),
            source: Some("jdtls".into()),
            message: "Cannot find symbol".into(),
        };
        let json = serde_json::to_string(&diag).unwrap();
        let deser: Diagnostic = serde_json::from_str(&json).unwrap();
        assert_eq!(deser.severity, Some(1));
        assert_eq!(deser.source, Some("jdtls".into()));
    }

    #[test]
    fn constants_are_sane() {
        assert_eq!(REQUEST_TIMEOUT_MS, 8_000);
        assert_eq!(IDLE_SHUTDOWN_MS, 30 * 60 * 1_000);
        assert_eq!(MAX_INDEXING_WAIT_MS, 120 * 1_000);
    }
}
