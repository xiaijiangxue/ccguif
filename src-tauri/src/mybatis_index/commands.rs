use std::path::PathBuf;

use serde_json::{json, Value};
use tauri::State;

use crate::state::AppState;

#[tauri::command]
pub(crate) async fn mybatis_reindex(
    workspace_id: String,
    workspace_path: String,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let workspaces = state.workspaces.lock().await;
    workspaces
        .get(&workspace_id)
        .ok_or_else(|| format!("workspace '{}' not found", workspace_id))?;
    drop(workspaces);

    let path = PathBuf::from(&workspace_path);
    let mut index = state.mybatis_index.lock().await;
    index.index_workspace(&path);
    let status = index.get_status();
    Ok(json!(status))
}

#[tauri::command]
pub(crate) async fn mybatis_find_statement(
    workspace_id: String,
    namespace: String,
    id: String,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let workspaces = state.workspaces.lock().await;
    workspaces
        .get(&workspace_id)
        .ok_or_else(|| format!("workspace '{}' not found", workspace_id))?;
    drop(workspaces);

    let index = state.mybatis_index.lock().await;
    let results: Vec<&super::types::MapperStatement> = index.find_statement(&namespace, &id);
    let out: Vec<Value> = results.into_iter().map(|s| json!(s)).collect();
    Ok(json!(out))
}

#[tauri::command]
pub(crate) async fn mybatis_find_mapper_method(
    workspace_id: String,
    namespace: String,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let workspaces = state.workspaces.lock().await;
    workspaces
        .get(&workspace_id)
        .ok_or_else(|| format!("workspace '{}' not found", workspace_id))?;
    drop(workspaces);

    let index = state.mybatis_index.lock().await;
    let results = index.find_mapper_method(&namespace);
    let out: Vec<Value> = results.into_iter().map(|s| json!(s)).collect();
    Ok(json!(out))
}

#[tauri::command]
pub(crate) async fn mybatis_find_references(
    workspace_id: String,
    id: String,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let workspaces = state.workspaces.lock().await;
    workspaces
        .get(&workspace_id)
        .ok_or_else(|| format!("workspace '{}' not found", workspace_id))?;
    drop(workspaces);

    let index = state.mybatis_index.lock().await;
    let results = index.find_references(&id);
    let out: Vec<Value> = results.into_iter().map(|s| json!(s)).collect();
    Ok(json!(out))
}

#[tauri::command]
pub(crate) async fn mybatis_get_sql_preview(
    workspace_id: String,
    namespace: String,
    id: String,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let workspaces = state.workspaces.lock().await;
    workspaces
        .get(&workspace_id)
        .ok_or_else(|| format!("workspace '{}' not found", workspace_id))?;
    drop(workspaces);

    let index = state.mybatis_index.lock().await;
    match index.get_sql_preview(&namespace, &id) {
        Some(sql) => Ok(json!({ "sql": sql })),
        None => Ok(json!({ "sql": null, "error": "statement not found" })),
    }
}

#[tauri::command]
pub(crate) async fn mybatis_get_annotation_sql(
    workspace_id: String,
    class_name: String,
    method_name: String,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let workspaces = state.workspaces.lock().await;
    workspaces
        .get(&workspace_id)
        .ok_or_else(|| format!("workspace '{}' not found", workspace_id))?;
    drop(workspaces);

    let index = state.mybatis_index.lock().await;
    match index.get_annotation_sql(&class_name, &method_name) {
        Some(sql) => Ok(json!({ "sql": sql })),
        None => Ok(json!({ "sql": null, "error": "annotation SQL not found" })),
    }
}

#[tauri::command]
pub(crate) async fn mybatis_validate(
    workspace_id: String,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let workspaces = state.workspaces.lock().await;
    workspaces
        .get(&workspace_id)
        .ok_or_else(|| format!("workspace '{}' not found", workspace_id))?;
    drop(workspaces);

    let index = state.mybatis_index.lock().await;
    let result = index.validate();
    Ok(json!(result))
}

#[tauri::command]
pub(crate) async fn mybatis_get_status(
    workspace_id: String,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let workspaces = state.workspaces.lock().await;
    workspaces
        .get(&workspace_id)
        .ok_or_else(|| format!("workspace '{}' not found", workspace_id))?;
    drop(workspaces);

    let index = state.mybatis_index.lock().await;
    let status = index.get_status();
    Ok(json!(status))
}

#[tauri::command]
pub(crate) async fn mybatis_find_java_interface(
    workspace_id: String,
    namespace: String,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let workspaces = state.workspaces.lock().await;
    workspaces
        .get(&workspace_id)
        .ok_or_else(|| format!("workspace '{}' not found", workspace_id))?;
    drop(workspaces);

    let index = state.mybatis_index.lock().await;
    match index.find_java_interface(&namespace) {
        Some(path) => Ok(json!({ "filePath": path })),
        None => Ok(json!({ "filePath": null })),
    }
}

#[tauri::command]
pub(crate) async fn mybatis_find_java_method(
    workspace_id: String,
    namespace: String,
    method_name: String,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let workspaces = state.workspaces.lock().await;
    workspaces
        .get(&workspace_id)
        .ok_or_else(|| format!("workspace '{}' not found", workspace_id))?;
    drop(workspaces);

    let index = state.mybatis_index.lock().await;
    match index.find_java_method(&namespace, &method_name) {
        Some(method) => Ok(json!(method)),
        None => Ok(json!(null)),
    }
}
