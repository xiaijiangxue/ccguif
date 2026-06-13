use std::path::PathBuf;
use tauri::State;
use serde_json::{json, Value};

use crate::state::AppState;
use super::types::JdtlsStatus;

/// Resolve the absolute file URI and canonicalized workspace root.
fn resolve_file_context(
    workspaces: &std::collections::HashMap<String, crate::types::WorkspaceEntry>,
    workspace_id: &str,
    file_path: &str,
) -> Result<(String, PathBuf), String> {
    let workspace_path = workspaces
        .get(workspace_id)
        .map(|entry| PathBuf::from(&entry.path))
        .ok_or_else(|| {
            log::warn!("[jdtls] workspace not found: {workspace_id}");
            "Workspace not found".to_string()
        })?;
    let workspace_root = workspace_path.canonicalize().map_err(|err| {
        log::warn!("[jdtls] failed to canonicalize workspace root {:?}: {err}", workspace_path);
        format!("Failed to resolve workspace root: {err}")
    })?;
    let absolute_file = if PathBuf::from(file_path).is_absolute() {
        PathBuf::from(file_path).canonicalize().map_err(|err| {
            log::warn!("[jdtls] failed to canonicalize file path {file_path}: {err}");
            format!("Failed to resolve file path: {err}")
        })?
    } else {
        workspace_root.join(file_path).canonicalize().map_err(|err| {
            log::warn!("[jdtls] failed to resolve relative path {file_path}: {err}");
            format!("Failed to resolve file path: {err}")
        })?
    };
    Ok((format!("file://{}", absolute_file.display()), workspace_root))
}

/// Apply JDK path from app settings to the JDTLS manager.
async fn apply_java_path_from_settings(
    manager: &mut crate::jdtls::JdtlsManager,
    settings: &crate::types::AppSettings,
) {
    let java_path = settings.jdtls_java_path.as_ref().map(|p| PathBuf::from(p));
    manager.set_java_path(java_path);
}

// ── LSP Request Commands ────────────────────────────────────────

#[tauri::command]
pub async fn jdtls_definition(
    workspace_id: String,
    file_path: String,
    line: u32,
    character: u32,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let (uri, workspace_root) = {
        let workspaces = state.workspaces.lock().await;
        resolve_file_context(&workspaces, &workspace_id, &file_path)?
    };

    let params = json!({
        "textDocument": { "uri": uri },
        "position": { "line": line, "character": character }
    });

    let mut manager = state.jdtls_manager.lock().await;
    let settings = state.app_settings.lock().await.clone();
    apply_java_path_from_settings(&mut manager, &settings).await;
    manager.ensure_started(&workspace_root, &file_path).await?;
    let result = manager
        .send_request("textDocument/definition", params)
        .await
        .map_err(|err| {
            log::warn!("[jdtls] textDocument/definition failed for {file_path}: {err}");
            err
        })?;
    Ok(result)
}

#[tauri::command]
pub async fn jdtls_references(
    workspace_id: String,
    file_path: String,
    line: u32,
    character: u32,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let (uri, workspace_root) = {
        let workspaces = state.workspaces.lock().await;
        resolve_file_context(&workspaces, &workspace_id, &file_path)?
    };

    let params = json!({
        "textDocument": { "uri": uri },
        "position": { "line": line, "character": character },
        "context": { "includeDeclaration": true }
    });

    let mut manager = state.jdtls_manager.lock().await;
    let settings = state.app_settings.lock().await.clone();
    apply_java_path_from_settings(&mut manager, &settings).await;
    manager.ensure_started(&workspace_root, &file_path).await?;
    let result = manager
        .send_request("textDocument/references", params)
        .await
        .map_err(|err| {
            log::warn!("[jdtls] textDocument/references failed for {file_path}: {err}");
            err
        })?;
    Ok(result)
}

#[tauri::command]
pub async fn jdtls_implementation(
    workspace_id: String,
    file_path: String,
    line: u32,
    character: u32,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let (uri, workspace_root) = {
        let workspaces = state.workspaces.lock().await;
        resolve_file_context(&workspaces, &workspace_id, &file_path)?
    };

    let params = json!({
        "textDocument": { "uri": uri },
        "position": { "line": line, "character": character }
    });

    let mut manager = state.jdtls_manager.lock().await;
    let settings = state.app_settings.lock().await.clone();
    apply_java_path_from_settings(&mut manager, &settings).await;
    manager.ensure_started(&workspace_root, &file_path).await?;
    let result = manager
        .send_request("textDocument/implementation", params)
        .await
        .map_err(|err| {
            log::warn!("[jdtls] textDocument/implementation failed for {file_path}: {err}");
            err
        })?;
    Ok(result)
}

#[tauri::command]
pub async fn jdtls_diagnostics(
    workspace_id: String,
    file_path: String,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let (uri, workspace_root) = {
        let workspaces = state.workspaces.lock().await;
        resolve_file_context(&workspaces, &workspace_id, &file_path)?
    };

    let params = json!({
        "textDocument": { "uri": uri }
    });

    let mut manager = state.jdtls_manager.lock().await;
    let settings = state.app_settings.lock().await.clone();
    apply_java_path_from_settings(&mut manager, &settings).await;
    manager.ensure_started(&workspace_root, &file_path).await?;
    let result = manager
        .send_request("textDocument/diagnostic", params)
        .await
        .map_err(|err| {
            log::warn!("[jdtls] textDocument/diagnostic failed for {file_path}: {err}");
            err
        })?;
    Ok(result)
}

// ── LSP Notification Commands ───────────────────────────────────

#[tauri::command]
pub async fn jdtls_did_open(
    workspace_id: String,
    file_path: String,
    content: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let (uri, workspace_root) = {
        let workspaces = state.workspaces.lock().await;
        resolve_file_context(&workspaces, &workspace_id, &file_path)?
    };

    let language_id = file_path_to_language_id(&file_path);

    let params = json!({
        "textDocument": {
            "uri": uri.clone(),
            "languageId": language_id,
            "version": 1,
            "text": content
        }
    });

    let mut manager = state.jdtls_manager.lock().await;
    let settings = state.app_settings.lock().await.clone();
    apply_java_path_from_settings(&mut manager, &settings).await;
    manager.ensure_started(&workspace_root, &file_path).await?;
    manager.track_open_file(uri);
    manager
        .send_notification("textDocument/didOpen", params)
        .await
        .map_err(|err| {
            log::warn!("[jdtls] textDocument/didOpen failed for {file_path}: {err}");
            err
        })?;
    Ok(())
}

#[tauri::command]
pub async fn jdtls_did_change(
    workspace_id: String,
    file_path: String,
    content: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let (uri, workspace_root) = {
        let workspaces = state.workspaces.lock().await;
        resolve_file_context(&workspaces, &workspace_id, &file_path)?
    };

    let params = json!({
        "textDocument": {
            "uri": uri,
            "version": 2
        },
        "contentChanges": [
            { "text": content }
        ]
    });

    let mut manager = state.jdtls_manager.lock().await;
    let settings = state.app_settings.lock().await.clone();
    apply_java_path_from_settings(&mut manager, &settings).await;
    manager.ensure_started(&workspace_root, &file_path).await?;
    manager
        .send_notification("textDocument/didChange", params)
        .await
        .map_err(|err| {
            log::warn!("[jdtls] textDocument/didChange failed for {file_path}: {err}");
            err
        })?;
    Ok(())
}

#[tauri::command]
pub async fn jdtls_did_close(
    workspace_id: String,
    file_path: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let (uri, _) = {
        let workspaces = state.workspaces.lock().await;
        resolve_file_context(&workspaces, &workspace_id, &file_path)?
    };

    let params = json!({
        "textDocument": { "uri": uri.clone() }
    });

    let mut manager = state.jdtls_manager.lock().await;
    manager.untrack_open_file(&uri);
    // Only send if JDTLS is currently running
    if manager.get_status().status == "ready" {
        manager
            .send_notification("textDocument/didClose", params)
            .await
            .map_err(|err| {
                log::warn!("[jdtls] textDocument/didClose failed: {err}");
                err
            })?;
    }
    Ok(())
}

// ── Status Command ──────────────────────────────────────────────

#[tauri::command]
pub async fn jdtls_get_status(state: State<'_, AppState>) -> Result<JdtlsStatus, String> {
    let manager = state.jdtls_manager.lock().await;
    Ok(manager.get_status())
}

// ── Helpers ─────────────────────────────────────────────────────

fn file_path_to_language_id(file_path: &str) -> &'static str {
    let ext = std::path::Path::new(file_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");
    match ext {
        "java" => "java",
        "kt" | "kts" => "kotlin",
        _ => "java",
    }
}
