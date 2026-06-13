use std::path::PathBuf;
use tauri::State;
use serde_json::{json, Value};
use serde::Serialize;

use crate::state::AppState;
use super::types::JdtlsStatus;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JavaProjectDetection {
    pub is_java_project: bool,
    pub build_system: Option<String>,
}

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
    let method = if manager.is_file_open(&uri) {
        "textDocument/didChange"
    } else {
        manager.track_open_file(uri);
        "textDocument/didOpen"
    };
    let params = if method == "textDocument/didChange" {
        json!({
            "textDocument": {
                "uri": params["textDocument"]["uri"].clone(),
                "version": 2
            },
            "contentChanges": [
                { "text": content }
            ]
        })
    } else {
        params
    };
    manager
        .send_notification(method, params)
        .await
        .map_err(|err| {
            log::warn!("[jdtls] {method} failed for {file_path}: {err}");
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

#[tauri::command]
pub async fn detect_java_project(workspace_path: String) -> Result<JavaProjectDetection, String> {
    let workspace_root = PathBuf::from(&workspace_path)
        .canonicalize()
        .map_err(|err| format!("failed to resolve workspace path {workspace_path}: {err}"))?;

    Ok(detect_java_project_at(&workspace_root))
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

fn detect_java_project_at(workspace_root: &std::path::Path) -> JavaProjectDetection {
    let mut roots = vec![workspace_root.to_path_buf()];
    if let Ok(entries) = std::fs::read_dir(workspace_root) {
        for entry in entries.flatten() {
            if entry.file_type().map(|file_type| file_type.is_dir()).unwrap_or(false) {
                roots.push(entry.path());
            }
        }
    }

    for root in roots {
        if root.join("pom.xml").is_file() {
            return JavaProjectDetection {
                is_java_project: true,
                build_system: Some("maven".to_string()),
            };
        }
        if root.join("build.gradle").is_file() || root.join("build.gradle.kts").is_file() {
            return JavaProjectDetection {
                is_java_project: true,
                build_system: Some("gradle".to_string()),
            };
        }
    }

    JavaProjectDetection {
        is_java_project: false,
        build_system: None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir() -> PathBuf {
        std::env::temp_dir().join(format!("jdtls-detect-test-{}", uuid::Uuid::new_v4()))
    }

    #[test]
    fn detect_java_project_finds_root_pom() {
        let dir = temp_dir();
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("pom.xml"), "").unwrap();

        let detection = detect_java_project_at(&dir);

        assert!(detection.is_java_project);
        assert_eq!(detection.build_system, Some("maven".to_string()));
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn detect_java_project_finds_one_level_gradle_kts() {
        let dir = temp_dir();
        let app_dir = dir.join("app");
        std::fs::create_dir_all(&app_dir).unwrap();
        std::fs::write(app_dir.join("build.gradle.kts"), "").unwrap();

        let detection = detect_java_project_at(&dir);

        assert!(detection.is_java_project);
        assert_eq!(detection.build_system, Some("gradle".to_string()));
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn detect_java_project_returns_false_without_build_files() {
        let dir = temp_dir();
        std::fs::create_dir_all(&dir).unwrap();

        let detection = detect_java_project_at(&dir);

        assert!(!detection.is_java_project);
        assert_eq!(detection.build_system, None);
        std::fs::remove_dir_all(&dir).ok();
    }
}
