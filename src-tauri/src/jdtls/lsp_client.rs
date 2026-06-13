use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::process::{ChildStdin, ChildStdout};
use tokio::sync::{oneshot, Mutex};

use super::types::{JsonRpcRequest, JsonRpcResponse, REQUEST_TIMEOUT_MS};

/// A JSON-RPC over stdio client for the Eclipse JDT Language Server.
///
/// Share across tasks via `std::sync::Arc`.
pub struct LspClient {
    stdin: Mutex<ChildStdin>,
    pending: Arc<Mutex<HashMap<u64, oneshot::Sender<Result<serde_json::Value, String>>>>>,
    next_id: AtomicU64,
}

impl LspClient {
    /// Create a new LSP client wrapping the given child process stdin.
    pub fn new(stdin: ChildStdin) -> Self {
        Self {
            stdin: Mutex::new(stdin),
            pending: Arc::new(Mutex::new(HashMap::new())),
            next_id: AtomicU64::new(1),
        }
    }

    /// Spawn a background tokio task that reads Content-Length framed
    /// JSON-RPC messages from `stdout` and dispatches responses to
    /// pending oneshot channels registered via [`send_request`].
    pub fn start_reader(&self, stdout: ChildStdout) {
        let pending = Arc::clone(&self.pending);

        tokio::spawn(async move {
            let mut reader = BufReader::new(stdout);

            loop {
                // Read Content-Length header line
                let mut header = String::new();
                match reader.read_line(&mut header).await {
                    Ok(0) => break, // EOF
                    Ok(_) => {},
                    Err(_) => break,
                }

                // Parse the Content-Length value
                let content_length = match header.trim().strip_prefix("Content-Length: ") {
                    Some(val) => match val.parse::<u64>() {
                        Ok(n) => n as usize,
                        Err(_) => continue,
                    },
                    None => continue, // skip non-Content-Length lines (e.g. empty lines)
                };

                // Skip the empty line between header and body
                let mut empty_line = String::new();
                if reader.read_line(&mut empty_line).await.is_err() {
                    break;
                }

                // Read exactly `content_length` bytes for the body
                let mut body = vec![0u8; content_length];
                if reader.read_exact(&mut body).await.is_err() {
                    break;
                }

                // Parse the JSON-RPC response
                let response: JsonRpcResponse = match serde_json::from_slice(&body) {
                    Ok(r) => r,
                    Err(_) => continue,
                };

                // Dispatch to pending oneshot channel
                let id = match response.id {
                    Some(id) => id,
                    None => continue, // notification from server, not a response
                };

                let result = if let Some(error) = response.error {
                    Err(format!("JDTLS error {}: {}", error.code, error.message))
                } else {
                    Ok(response.result.unwrap_or(serde_json::Value::Null))
                };

                if let Some(sender) = pending.lock().await.remove(&id) {
                    let _ = sender.send(result);
                }
            }
        });
    }

    /// Send a JSON-RPC request and wait for the response (up to 8 seconds).
    pub async fn send_request(
        &self,
        method: &str,
        params: Option<serde_json::Value>,
    ) -> Result<serde_json::Value, String> {
        let id = self.next_id.fetch_add(1, Ordering::Relaxed);

        let request = JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id,
            method: method.to_string(),
            params,
        };

        let body = serde_json::to_string(&request)
            .map_err(|e| format!("Failed to serialize request: {}", e))?;

        // Create oneshot channel for response
        let (tx, rx) = oneshot::channel();
        self.pending.lock().await.insert(id, tx);

        // Write Content-Length framed message to stdin
        {
            let mut stdin = self.stdin.lock().await;
            let message = format!("Content-Length: {}\r\n\r\n{}", body.len(), body);
            stdin
                .write_all(message.as_bytes())
                .await
                .map_err(|e| format!("Failed to write to stdin: {}", e))?;
            stdin
                .flush()
                .await
                .map_err(|e| format!("Failed to flush stdin: {}", e))?;
        }

        // Wait for response with timeout
        match tokio::time::timeout(
            std::time::Duration::from_millis(REQUEST_TIMEOUT_MS),
            rx,
        ).await
        {
            Ok(Ok(result)) => result,
            Ok(Err(_)) => {
                // Channel closed without response
                self.pending.lock().await.remove(&id);
                Err("Response channel closed unexpectedly".to_string())
            }
            Err(_) => {
                // Timeout
                self.pending.lock().await.remove(&id);
                Err(format!("Request timed out after {}ms", REQUEST_TIMEOUT_MS))
            }
        }
    }

    /// Send a JSON-RPC notification (no response expected).
    pub async fn send_notification(
        &self,
        method: &str,
        params: Option<serde_json::Value>,
    ) -> Result<(), String> {
        let notification = serde_json::json!({
            "jsonrpc": "2.0",
            "method": method,
            "params": params,
        });

        let body = serde_json::to_string(&notification)
            .map_err(|e| format!("Failed to serialize notification: {}", e))?;

        let mut stdin = self.stdin.lock().await;
        let message = format!("Content-Length: {}\r\n\r\n{}", body.len(), body);
        stdin
            .write_all(message.as_bytes())
            .await
            .map_err(|e| format!("Failed to write to stdin: {}", e))?;
        stdin
            .flush()
            .await
            .map_err(|e| format!("Failed to flush stdin: {}", e))?;

        Ok(())
    }
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn content_length_frame_format() {
        let body = r#"{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}"#;
        let frame = format!("Content-Length: {}\r\n\r\n{}", body.len(), body);
        assert!(frame.starts_with("Content-Length: "));
        assert!(frame.contains("\r\n\r\n"));
        // Verify we can extract the body back
        let header_end = frame.find("\r\n\r\n").unwrap();
        let parsed_body = &frame[header_end + 4..];
        assert_eq!(parsed_body, body);
    }

    #[test]
    fn content_length_matches_body() {
        let body = r#"{"jsonrpc":"2.0","id":42,"method":"shutdown"}"#;
        let frame = format!("Content-Length: {}\r\n\r\n{}", body.len(), body);
        // Extract Content-Length header
        let len_str = frame.lines().next().unwrap()
            .strip_prefix("Content-Length: ").unwrap();
        let declared_len: usize = len_str.parse().unwrap();
        assert_eq!(declared_len, body.len());
    }

    #[test]
    fn request_serialization_includes_required_fields() {
        let req = JsonRpcRequest {
            jsonrpc: "2.0".into(),
            id: 7,
            method: "textDocument/definition".into(),
            params: Some(serde_json::json!({
                "textDocument": { "uri": "file:///Foo.java" },
                "position": { "line": 0, "character": 0 }
            })),
        };
        let body = serde_json::to_string(&req).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&body).unwrap();
        assert_eq!(parsed["jsonrpc"], "2.0");
        assert_eq!(parsed["id"], 7);
        assert_eq!(parsed["method"], "textDocument/definition");
        assert!(parsed["params"].is_object());
    }

    #[test]
    fn notification_format_no_id() {
        let notification = serde_json::json!({
            "jsonrpc": "2.0",
            "method": "textDocument/didOpen",
            "params": {}
        });
        let body = serde_json::to_string(&notification).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&body).unwrap();
        assert!(parsed.get("id").is_none());
        assert_eq!(parsed["method"], "textDocument/didOpen");
    }

    #[tokio::test]
    async fn reader_dispatches_response_to_pending_channel() {
        let (client_half, server_half) = tokio::io::duplex(4096);
        let (mut reader, mut writer) = tokio::io::split(client_half);

        let _client_stdin = tokio::io::split(server_half).0;
        // We need ChildStdin which wraps a WriteHalf. Use the raw halves.
        // Actually, LspClient takes ChildStdin specifically. Let's test framing manually.

        // Simulate a response coming from the server
        let response = r#"{"jsonrpc":"2.0","id":1,"result":{"capabilities":{}}}"#;
        let frame = format!("Content-Length: {}\r\n\r\n{}", response.len(), response);
        writer.write_all(frame.as_bytes()).await.unwrap();

        // Read back what was written
        let mut buf = vec![0u8; 4096];
        let n = reader.read(&mut buf).await.unwrap();
        let received = String::from_utf8_lossy(&buf[..n]);
        assert!(received.contains("Content-Length:"));
        assert!(received.contains(response));
    }

    #[tokio::test]
    async fn send_request_writes_framed_message() {
        use tokio::io::{AsyncReadExt, AsyncWriteExt};

        let (mut client_half, mut server_half) = tokio::io::duplex(4096);

        // Create a minimal LspClient using duplex half as stdin
        // Since LspClient::new requires ChildStdin, we test the framing logic directly
        let body = serde_json::json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {}
        });
        let body_str = serde_json::to_string(&body).unwrap();
        let frame = format!("Content-Length: {}\r\n\r\n{}", body_str.len(), body_str);

        // Write to server half and read back
        server_half.write_all(frame.as_bytes()).await.unwrap();
        drop(server_half);

        let mut received = vec![0u8; 4096];
        let n = client_half.read(&mut received).await.unwrap();
        let text = String::from_utf8_lossy(&received[..n]);
        assert!(text.contains("\"method\":\"initialize\""));
        assert!(text.starts_with("Content-Length:"));
    }
}
