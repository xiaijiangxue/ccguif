use std::collections::{HashMap, HashSet};
use std::fs::File;
use std::io::Read;
use std::path::{Component, Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, UNIX_EPOCH};

use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use git2::Repository;
use ignore::WalkBuilder;
use regex::{Regex, RegexBuilder};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::text_encoding::decode_text_bytes;
use crate::utils::normalize_git_path;

// ---------------------------------------------------------------------------
// Session-scoped directory scan cache
// ---------------------------------------------------------------------------

/// Cached result of a directory children scan performed with `Scope::All`.
/// Subsequent requests for the same directory can be served from this cache
/// and filtered by the requested scope, avoiding a redundant filesystem scan.
#[derive(Clone, Debug)]
pub(crate) struct CachedDirectoryChildren {
    pub(crate) files: Vec<String>,
    pub(crate) directories: Vec<String>,
    pub(crate) gitignored_files: Vec<String>,
    pub(crate) gitignored_directories: Vec<String>,
    pub(crate) scan_state: WorkspaceScanState,
    pub(crate) limit_hit: bool,
    /// Directory mtime (millis since UNIX epoch) captured at scan time.
    /// Used for staleness checks on subsequent cache hits.
    pub(crate) cached_mtime_ms: Option<u64>,
}

/// Thread-safe directory scan cache. The key is the **canonical** directory
/// path. When the workspace state (or `AppState`) is dropped the cache is
/// dropped with it, so it is naturally session-scoped.
pub(crate) type DirectoryCache =
    Arc<Mutex<HashMap<PathBuf, CachedDirectoryChildren>>>;

/// Create a new, empty directory cache.
pub(crate) fn new_directory_cache() -> DirectoryCache {
    Arc::new(Mutex::new(HashMap::new()))
}

impl CachedDirectoryChildren {
    fn from_response(response: &WorkspaceFilesResponse) -> Self {
        Self {
            files: response.files.clone(),
            directories: response.directories.clone(),
            gitignored_files: response.gitignored_files.clone(),
            gitignored_directories: response.gitignored_directories.clone(),
            scan_state: response.scan_state,
            limit_hit: response.limit_hit,
            cached_mtime_ms: response.directory_mtime_ms,
        }
    }

    /// Convert the cached `Scope::All` data into a response filtered by the
    /// requested scope.
    fn to_response(
        &self,
        scope: DirectoryChildScanScope,
        parent_path: &str,
    ) -> WorkspaceFilesResponse {
        let (files, directories, gitignored_files, gitignored_directories) = match scope {
            DirectoryChildScanScope::All => (
                self.files.clone(),
                self.directories.clone(),
                self.gitignored_files.clone(),
                self.gitignored_directories.clone(),
            ),
            DirectoryChildScanScope::VisibleOnly => {
                let ignored_file_set: HashSet<&str> =
                    self.gitignored_files.iter().map(String::as_str).collect();
                let ignored_dir_set: HashSet<&str> =
                    self.gitignored_directories.iter().map(String::as_str).collect();
                let files: Vec<String> = self
                    .files
                    .iter()
                    .filter(|f| !ignored_file_set.contains(f.as_str()))
                    .cloned()
                    .collect();
                let directories: Vec<String> = self
                    .directories
                    .iter()
                    .filter(|d| !ignored_dir_set.contains(d.as_str()))
                    .cloned()
                    .collect();
                (files, directories, Vec::new(), Vec::new())
            }
            DirectoryChildScanScope::IgnoredOnly => (
                self.gitignored_files.clone(),
                self.gitignored_directories.clone(),
                self.gitignored_files.clone(),
                self.gitignored_directories.clone(),
            ),
        };
        let directory_entries =
            build_directory_child_entries(parent_path, &files, &directories, self.scan_state);
        workspace_files_response(
            files,
            directories,
            gitignored_files,
            gitignored_directories,
            self.scan_state,
            self.limit_hit,
            directory_entries,
            self.cached_mtime_ms,
        )
    }
}

/// Cached variant of the directory-children scan.  Scope::All responses are
/// cacheable because they contain both visible and ignored children. Scoped
/// cache misses must stay scoped; otherwise expanding generated directories
/// through the visible-only path still pays for a full ignored scan.
pub(crate) fn list_workspace_directory_children_cached(
    root: &PathBuf,
    directory_path: &str,
    max_entries: usize,
    scope: DirectoryChildScanScope,
    cache: Option<&DirectoryCache>,
    cached_repo: Option<&Repository>,
) -> Result<WorkspaceFilesResponse, String> {
    let Some(cache) = cache else {
        return list_workspace_directory_children_scoped_inner_with_scope(
            root,
            directory_path,
            max_entries,
            scope,
            cached_repo,
        );
    };

    // Normalise the path so we can build the cache key and response.
    let normalized_path = normalize_workspace_relative_directory_path(directory_path)?;
    let canonical_root = root
        .canonicalize()
        .map_err(|err| format!("Failed to resolve workspace root: {err}"))?;
    let candidate = canonical_root.join(normalized_relative_to_pathbuf(&normalized_path));
    let canonical_path = candidate
        .canonicalize()
        .map_err(|err| format!("Failed to resolve directory path: {err}"))?;

    // Check cache.
    {
        let cache_guard = cache.lock().map_err(|err| err.to_string())?;
        if let Some(cached) = cache_guard.get(&canonical_path) {
            // Staleness check: if we have a cached mtime, compare against the
            // directory's current mtime. On most OSes the directory mtime
            // updates when direct children are added/removed.
            if let Some(cached_mtime) = cached.cached_mtime_ms {
                let current_mtime = std::fs::metadata(&canonical_path)
                    .ok()
                    .and_then(|m| m.modified().ok())
                    .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                    .map(|d| d.as_millis() as u64);
                if current_mtime == Some(cached_mtime) {
                    return Ok(cached.to_response(scope, &normalized_path));
                }
                // mtime changed — drop stale entry and fall through to rescan.
            } else {
                // No mtime recorded (legacy entry) — serve from cache.
                return Ok(cached.to_response(scope, &normalized_path));
            }
        }
    }

    if scope != DirectoryChildScanScope::All {
        return list_workspace_directory_children_scoped_inner_with_scope(
            root,
            directory_path,
            max_entries,
            scope,
            cached_repo,
        );
    }

    // Cache miss for Scope::All – scan the full result and store it when the
    // response is complete.
    let result = list_workspace_directory_children_scoped_inner_with_scope(
        root,
        directory_path,
        max_entries,
        DirectoryChildScanScope::All,
        cached_repo,
    )?;

    // Store in cache only when the scan was not truncated.
    if !result.limit_hit {
        let mut cache_guard = cache.lock().map_err(|err| err.to_string())?;
        cache_guard.insert(
            canonical_path,
            CachedDirectoryChildren::from_response(&result),
        );
    }

    Ok(result)
}

fn should_always_skip(name: &str) -> bool {
    name == ".git"
}

fn is_special_dependency_dir_name(name: &str) -> bool {
    matches!(
        name,
        "node_modules"
            | ".pnpm-store"
            | ".yarn"
            | "bower_components"
            | "vendor"
            | ".venv"
            | "venv"
            | "env"
            | "__pypackages__"
            | "Pods"
            | "Carthage"
            | ".m2"
            | ".ivy2"
            | ".cargo"
    )
}

fn is_special_build_artifact_dir_name(name: &str) -> bool {
    matches!(
        name,
        "target"
            | "dist"
            | "build"
            | "out"
            | "coverage"
            | ".next"
            | ".nuxt"
            | ".svelte-kit"
            | ".angular"
            | ".parcel-cache"
            | ".turbo"
            | ".cache"
            | ".gradle"
            | "CMakeFiles"
            | "bin"
            | "obj"
            | "__pycache__"
            | ".pytest_cache"
            | ".mypy_cache"
            | ".tox"
            | ".dart_tool"
    ) || name.starts_with("cmake-build-")
}

fn is_special_directory_path(path: &str) -> bool {
    path.rsplit('/')
        .next()
        .map(|name| {
            is_special_dependency_dir_name(name) || is_special_build_artifact_dir_name(name)
        })
        .unwrap_or(false)
}

fn normalized_relative_to_pathbuf(normalized: &str) -> PathBuf {
    let mut path = PathBuf::new();
    for segment in normalized.split('/') {
        if !segment.is_empty() {
            path.push(segment);
        }
    }
    path
}

fn normalize_workspace_relative_path(path: &str) -> Result<String, String> {
    let normalized = path.trim().replace('\\', "/");
    let trimmed = normalized.trim_matches('/');
    if trimmed.is_empty() {
        return Err("Path cannot be empty.".to_string());
    }
    let relative = Path::new(trimmed);
    for component in relative.components() {
        match component {
            Component::ParentDir
            | Component::RootDir
            | Component::Prefix(_)
            | Component::CurDir => {
                return Err("Invalid path.".to_string());
            }
            Component::Normal(_) => {}
        }
    }
    if trimmed == ".git"
        || trimmed.starts_with(".git/")
        || trimmed.contains("/.git/")
        || trimmed.ends_with("/.git")
    {
        return Err("Cannot access .git directory.".to_string());
    }
    Ok(trimmed.to_string())
}

fn normalize_workspace_relative_directory_path(path: &str) -> Result<String, String> {
    if path.is_empty() {
        return Ok(String::new());
    }
    normalize_workspace_relative_path(path)
}

fn validate_workspace_item_basename(name: &str) -> Result<String, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("Name cannot be empty.".to_string());
    }
    if trimmed == "." || trimmed == ".." || trimmed.contains('/') || trimmed.contains('\\') {
        return Err("Invalid item name.".to_string());
    }
    if trimmed.ends_with('.') || trimmed.ends_with(' ') {
        return Err("Invalid item name.".to_string());
    }
    if trimmed
        .chars()
        .any(|ch| ch.is_control() || matches!(ch, '<' | '>' | ':' | '"' | '|' | '?' | '*'))
    {
        return Err("Invalid item name.".to_string());
    }
    let reserved_windows_name = trimmed
        .split('.')
        .next()
        .unwrap_or(trimmed)
        .to_ascii_uppercase();
    if matches!(
        reserved_windows_name.as_str(),
        "CON"
            | "PRN"
            | "AUX"
            | "NUL"
            | "COM1"
            | "COM2"
            | "COM3"
            | "COM4"
            | "COM5"
            | "COM6"
            | "COM7"
            | "COM8"
            | "COM9"
            | "LPT1"
            | "LPT2"
            | "LPT3"
            | "LPT4"
            | "LPT5"
            | "LPT6"
            | "LPT7"
            | "LPT8"
            | "LPT9"
    ) {
        return Err("Invalid item name.".to_string());
    }
    if trimmed == ".git" {
        return Err("Cannot operate on .git directory.".to_string());
    }
    Ok(trimmed.to_string())
}

fn infer_workspace_item_kind(path: &Path) -> Result<WorkspaceFileItemKind, String> {
    let metadata =
        std::fs::metadata(path).map_err(|err| format!("Failed to read path metadata: {err}"))?;
    if metadata.is_dir() {
        return Ok(WorkspaceFileItemKind::Folder);
    }
    if metadata.is_file() {
        return Ok(WorkspaceFileItemKind::File);
    }
    Err("Path is neither a file nor a folder.".to_string())
}

fn resolve_workspace_root(root: &PathBuf) -> Result<PathBuf, String> {
    root.canonicalize()
        .map_err(|err| format!("Failed to resolve workspace root: {err}"))
}

fn resolve_workspace_item_path(
    canonical_root: &Path,
    relative_path: &str,
) -> Result<(String, PathBuf, WorkspaceFileItemKind), String> {
    let normalized_path = normalize_workspace_relative_path(relative_path)?;
    let candidate = canonical_root.join(normalized_relative_to_pathbuf(&normalized_path));
    let canonical_path = candidate
        .canonicalize()
        .map_err(|err| format!("Failed to resolve path {normalized_path}: {err}"))?;

    if !canonical_path.starts_with(canonical_root) {
        return Err("Invalid file path".to_string());
    }

    let kind = infer_workspace_item_kind(&canonical_path)?;
    Ok((normalized_path, canonical_path, kind))
}

fn resolve_workspace_target_directory(
    canonical_root: &Path,
    relative_path: &str,
) -> Result<(String, PathBuf), String> {
    let normalized_path = normalize_workspace_relative_directory_path(relative_path)?;
    let candidate = if normalized_path.is_empty() {
        canonical_root.to_path_buf()
    } else {
        canonical_root.join(normalized_relative_to_pathbuf(&normalized_path))
    };
    let canonical_path = candidate
        .canonicalize()
        .map_err(|err| format!("Failed to resolve target directory {normalized_path}: {err}"))?;

    if !canonical_path.starts_with(canonical_root) {
        return Err("Invalid target directory".to_string());
    }
    if !canonical_path.is_dir() {
        return Err("Target path is not a directory.".to_string());
    }

    Ok((normalized_path, canonical_path))
}

fn relative_path_from_absolute(
    canonical_root: &Path,
    absolute_path: &Path,
) -> Result<String, String> {
    let relative = absolute_path
        .strip_prefix(canonical_root)
        .map_err(|_| "Failed to compute relative path".to_string())?;
    Ok(normalize_git_path(&relative.to_string_lossy()))
}

fn sort_and_dedup_workspace_lists(
    files: &mut Vec<String>,
    directories: &mut Vec<String>,
    gitignored_files: &mut Vec<String>,
    gitignored_directories: &mut Vec<String>,
) {
    files.sort();
    files.dedup();
    directories.sort();
    directories.dedup();
    gitignored_files.sort();
    gitignored_files.dedup();
    gitignored_directories.sort();
    gitignored_directories.dedup();
}

fn sort_and_truncate_named_entries<T>(entries: &mut Vec<(String, T)>, max_entries: usize) {
    entries.sort_by(|a, b| a.0.cmp(&b.0));
    if entries.len() > max_entries {
        entries.truncate(max_entries);
    }
}

#[derive(Serialize, Deserialize, Clone)]
pub(crate) struct WorkspaceFilesResponse {
    pub(crate) files: Vec<String>,
    pub(crate) directories: Vec<String>,
    #[serde(default)]
    pub(crate) gitignored_files: Vec<String>,
    #[serde(default)]
    pub(crate) gitignored_directories: Vec<String>,
    #[serde(default = "default_workspace_scan_state")]
    pub(crate) scan_state: WorkspaceScanState,
    #[serde(default)]
    pub(crate) limit_hit: bool,
    #[serde(default)]
    pub(crate) directory_entries: Vec<WorkspaceDirectoryEntry>,
    /// Directory mtime (millis since UNIX epoch) at scan time, for cache
    /// staleness detection on the frontend.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) directory_mtime_ms: Option<u64>,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum WorkspaceScanState {
    Complete,
    Partial,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum WorkspaceDirectoryChildState {
    Unknown,
    Loaded,
    Empty,
    Partial,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum WorkspaceDirectorySpecialKind {
    Dependency,
    BuildArtifact,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub(crate) struct WorkspaceDirectoryEntry {
    pub(crate) path: String,
    pub(crate) child_state: WorkspaceDirectoryChildState,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) special_kind: Option<WorkspaceDirectorySpecialKind>,
    #[serde(default)]
    pub(crate) has_more: bool,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum WorkspaceFileItemKind {
    File,
    Folder,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub(crate) struct WorkspaceFileOperationResult {
    pub(crate) path: String,
    pub(crate) kind: WorkspaceFileItemKind,
}

fn default_workspace_scan_state() -> WorkspaceScanState {
    WorkspaceScanState::Complete
}

fn workspace_files_response(
    files: Vec<String>,
    directories: Vec<String>,
    gitignored_files: Vec<String>,
    gitignored_directories: Vec<String>,
    scan_state: WorkspaceScanState,
    limit_hit: bool,
    directory_entries: Vec<WorkspaceDirectoryEntry>,
    directory_mtime_ms: Option<u64>,
) -> WorkspaceFilesResponse {
    WorkspaceFilesResponse {
        files,
        directories,
        gitignored_files,
        gitignored_directories,
        scan_state,
        limit_hit,
        directory_entries,
        directory_mtime_ms,
    }
}

fn special_directory_kind(path: &str) -> Option<WorkspaceDirectorySpecialKind> {
    let leaf = path.rsplit('/').next().unwrap_or_default();
    if is_special_dependency_dir_name(leaf) {
        return Some(WorkspaceDirectorySpecialKind::Dependency);
    }
    if is_special_build_artifact_dir_name(leaf) {
        return Some(WorkspaceDirectorySpecialKind::BuildArtifact);
    }
    None
}

fn has_known_direct_child(parent: &str, files: &[String], directories: &[String]) -> bool {
    let prefix = format!("{parent}/");
    files.iter().chain(directories.iter()).any(|path| {
        path.strip_prefix(&prefix)
            .is_some_and(|child| !child.is_empty() && !child.contains('/'))
    })
}

fn build_initial_directory_entries(
    files: &[String],
    directories: &[String],
    scan_state: WorkspaceScanState,
) -> Vec<WorkspaceDirectoryEntry> {
    directories
        .iter()
        .map(|path| {
            let special_kind = special_directory_kind(path);
            let child_state = if special_kind.is_some() {
                WorkspaceDirectoryChildState::Unknown
            } else if has_known_direct_child(path, files, directories) {
                match scan_state {
                    WorkspaceScanState::Complete => WorkspaceDirectoryChildState::Loaded,
                    WorkspaceScanState::Partial => WorkspaceDirectoryChildState::Partial,
                }
            } else {
                match scan_state {
                    WorkspaceScanState::Complete => WorkspaceDirectoryChildState::Empty,
                    WorkspaceScanState::Partial => WorkspaceDirectoryChildState::Unknown,
                }
            };
            WorkspaceDirectoryEntry {
                path: path.clone(),
                child_state,
                special_kind,
                has_more: child_state == WorkspaceDirectoryChildState::Partial,
            }
        })
        .collect()
}

fn build_directory_child_entries(
    parent_path: &str,
    files: &[String],
    directories: &[String],
    scan_state: WorkspaceScanState,
) -> Vec<WorkspaceDirectoryEntry> {
    let parent_child_state = match scan_state {
        WorkspaceScanState::Partial => WorkspaceDirectoryChildState::Partial,
        WorkspaceScanState::Complete if files.is_empty() && directories.is_empty() => {
            WorkspaceDirectoryChildState::Empty
        }
        WorkspaceScanState::Complete => WorkspaceDirectoryChildState::Loaded,
    };
    let mut entries = vec![WorkspaceDirectoryEntry {
        path: parent_path.to_string(),
        child_state: parent_child_state,
        special_kind: special_directory_kind(parent_path),
        has_more: scan_state == WorkspaceScanState::Partial,
    }];

    entries.extend(directories.iter().map(|path| WorkspaceDirectoryEntry {
        path: path.clone(),
        child_state: WorkspaceDirectoryChildState::Unknown,
        special_kind: special_directory_kind(path),
        has_more: false,
    }));
    entries
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum DirectoryChildScanScope {
    All,
    VisibleOnly,
    IgnoredOnly,
}

fn should_include_directory_child(
    is_ignored: bool,
    scope: DirectoryChildScanScope,
) -> bool {
    match scope {
        DirectoryChildScanScope::All => true,
        DirectoryChildScanScope::VisibleOnly => !is_ignored,
        DirectoryChildScanScope::IgnoredOnly => is_ignored,
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub(crate) struct WorkspaceTextSearchMatch {
    pub(crate) line: usize,
    pub(crate) column: usize,
    pub(crate) end_column: usize,
    pub(crate) preview: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub(crate) struct WorkspaceTextSearchCursor {
    pub(crate) query: String,
    pub(crate) case_sensitive: bool,
    pub(crate) whole_word: bool,
    pub(crate) is_regex: bool,
    pub(crate) include_pattern: Option<String>,
    pub(crate) exclude_pattern: Option<String>,
    pub(crate) path: String,
    pub(crate) line: usize,
    pub(crate) column: usize,
    pub(crate) file_len: u64,
    pub(crate) file_modified_ms: Option<u128>,
    pub(crate) file_sha256: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub(crate) struct WorkspaceTextSearchFileResult {
    pub(crate) path: String,
    pub(crate) match_count: usize,
    pub(crate) matches: Vec<WorkspaceTextSearchMatch>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub(crate) struct WorkspaceTextSearchResponse {
    pub(crate) files: Vec<WorkspaceTextSearchFileResult>,
    pub(crate) file_count: usize,
    pub(crate) match_count: usize,
    pub(crate) limit_hit: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) next_cursor: Option<String>,
    #[serde(default)]
    pub(crate) invalid_cursor: bool,
}

#[derive(Clone, Debug)]
pub(crate) struct WorkspaceTextSearchOptions {
    pub(crate) case_sensitive: bool,
    pub(crate) whole_word: bool,
    pub(crate) is_regex: bool,
    pub(crate) include_pattern: Option<String>,
    pub(crate) exclude_pattern: Option<String>,
    pub(crate) limit: Option<usize>,
    pub(crate) cursor: Option<String>,
}

const MAX_SEARCH_MATCHES: usize = 1_000;
const MAX_SEARCH_FILE_BYTES: u64 = 1_024 * 1_024;
const MAX_PREVIEW_CHARS: usize = 180;
const WORKSPACE_SCAN_ENTRY_BUDGET: usize = 30_000;
const WORKSPACE_SCAN_TIME_BUDGET: Duration = Duration::from_millis(1_200);
const WORKSPACE_DIRECTORY_SCAN_BUDGET_MULTIPLIER: usize = 8;
const SPECIAL_DIRECTORY_CHILD_LIMIT: usize = 300;
const MAX_SEARCH_PAGE_MATCHES: usize = 500;

fn workspace_scan_budget_reached(started_at: Instant, scanned_entries: usize) -> bool {
    scanned_entries >= WORKSPACE_SCAN_ENTRY_BUDGET
        || started_at.elapsed() >= WORKSPACE_SCAN_TIME_BUDGET
}

fn directory_child_entry_limit(directory_path: &str, max_entries: usize) -> usize {
    if is_special_directory_path(directory_path) {
        max_entries.min(SPECIAL_DIRECTORY_CHILD_LIMIT)
    } else {
        max_entries
    }
}

fn compile_search_regex(
    query: &str,
    options: &WorkspaceTextSearchOptions,
) -> Result<Regex, String> {
    let trimmed = query.trim();
    if trimmed.is_empty() {
        return Err("Search query cannot be empty.".to_string());
    }
    let pattern = if options.is_regex {
        trimmed.to_string()
    } else {
        regex::escape(trimmed)
    };
    let pattern = if options.whole_word {
        format!(r"\b(?:{})\b", pattern)
    } else {
        pattern
    };
    RegexBuilder::new(&pattern)
        .case_insensitive(!options.case_sensitive)
        .build()
        .map_err(|error| format!("Invalid search pattern: {error}"))
}

fn split_glob_patterns(input: Option<&str>) -> Vec<String> {
    input
        .unwrap_or_default()
        .split([',', '\n'])
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .collect()
}

fn glob_pattern_to_regex(pattern: &str) -> Result<Regex, String> {
    let normalized = pattern
        .replace('\\', "/")
        .trim()
        .trim_matches('/')
        .to_string();
    if normalized.is_empty() {
        return Err("Glob pattern cannot be empty.".to_string());
    }
    let mut regex_source = String::from("^");
    let chars: Vec<char> = normalized.chars().collect();
    let mut index = 0usize;
    while index < chars.len() {
        let current = chars[index];
        if current == '*' {
            let has_double = chars.get(index + 1).copied() == Some('*');
            if has_double {
                regex_source.push_str(".*");
                index += 2;
                continue;
            }
            regex_source.push_str("[^/]*");
            index += 1;
            continue;
        }
        if current == '?' {
            regex_source.push_str("[^/]");
            index += 1;
            continue;
        }
        if matches!(
            current,
            '.' | '+' | '(' | ')' | '|' | '^' | '$' | '{' | '}' | '[' | ']' | '\\'
        ) {
            regex_source.push('\\');
        }
        regex_source.push(current);
        index += 1;
    }
    regex_source.push('$');
    Regex::new(&regex_source).map_err(|error| format!("Invalid glob pattern `{pattern}`: {error}"))
}

fn compile_glob_patterns(input: Option<&str>) -> Result<Vec<Regex>, String> {
    split_glob_patterns(input)
        .into_iter()
        .map(|pattern| glob_pattern_to_regex(&pattern))
        .collect()
}

fn path_matches_patterns(path: &str, patterns: &[Regex]) -> bool {
    patterns.iter().any(|pattern| pattern.is_match(path))
}

fn build_preview(line: &str, start: usize, end: usize) -> String {
    let chars: Vec<char> = line.chars().collect();
    if chars.len() <= MAX_PREVIEW_CHARS {
        return line.trim().to_string();
    }
    let start_char = line[..start].chars().count();
    let end_char = line[..end].chars().count();
    let context = MAX_PREVIEW_CHARS / 2;
    let slice_start = start_char.saturating_sub(context / 2);
    let slice_end = (end_char + context).min(chars.len());
    let mut preview = chars[slice_start..slice_end].iter().collect::<String>();
    if slice_start > 0 {
        preview = format!("…{preview}");
    }
    if slice_end < chars.len() {
        preview.push('…');
    }
    preview.trim().to_string()
}

fn encode_search_cursor(cursor: &WorkspaceTextSearchCursor) -> Result<String, String> {
    serde_json::to_vec(cursor)
        .map(|bytes| BASE64_STANDARD.encode(bytes))
        .map_err(|error| format!("failed to encode search cursor: {error}"))
}

fn decode_search_cursor(cursor: &str) -> Result<WorkspaceTextSearchCursor, String> {
    let bytes = BASE64_STANDARD
        .decode(cursor)
        .map_err(|error| format!("invalid search cursor: {error}"))?;
    serde_json::from_slice::<WorkspaceTextSearchCursor>(&bytes)
        .map_err(|error| format!("invalid search cursor payload: {error}"))
}

fn empty_text_search_response(invalid_cursor: bool) -> WorkspaceTextSearchResponse {
    WorkspaceTextSearchResponse {
        files: Vec::new(),
        file_count: 0,
        match_count: 0,
        limit_hit: false,
        next_cursor: None,
        invalid_cursor,
    }
}

fn normalize_search_pattern_option(value: &Option<String>) -> Option<String> {
    value
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

fn file_modified_ms(metadata: &std::fs::Metadata) -> Option<u128> {
    metadata
        .modified()
        .ok()
        .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis())
}

fn cursor_matches_request(
    cursor: &WorkspaceTextSearchCursor,
    query: &str,
    options: &WorkspaceTextSearchOptions,
) -> bool {
    cursor.query == query.trim()
        && cursor.case_sensitive == options.case_sensitive
        && cursor.whole_word == options.whole_word
        && cursor.is_regex == options.is_regex
        && cursor.include_pattern == normalize_search_pattern_option(&options.include_pattern)
        && cursor.exclude_pattern == normalize_search_pattern_option(&options.exclude_pattern)
}

fn cursor_matches_file(
    cursor: &WorkspaceTextSearchCursor,
    normalized_path: &str,
    metadata: &std::fs::Metadata,
    bytes: &[u8],
) -> bool {
    cursor.path == normalized_path
        && cursor.file_len == metadata.len()
        && cursor.file_modified_ms == file_modified_ms(metadata)
        && cursor.file_sha256 == sha256_hex(bytes)
}

fn sha256_hex(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    digest.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn should_skip_match_for_cursor(
    normalized_path: &str,
    line: usize,
    column: usize,
    cursor: Option<&WorkspaceTextSearchCursor>,
) -> bool {
    let Some(cursor) = cursor else {
        return false;
    };
    if normalized_path < cursor.path.as_str() {
        return true;
    }
    if normalized_path > cursor.path.as_str() {
        return false;
    }
    line < cursor.line || (line == cursor.line && column <= cursor.column)
}

fn build_search_cursor(
    query: &str,
    options: &WorkspaceTextSearchOptions,
    normalized_path: &str,
    line: usize,
    column: usize,
    metadata: &std::fs::Metadata,
    bytes: &[u8],
) -> Result<String, String> {
    encode_search_cursor(&WorkspaceTextSearchCursor {
        query: query.trim().to_string(),
        case_sensitive: options.case_sensitive,
        whole_word: options.whole_word,
        is_regex: options.is_regex,
        include_pattern: normalize_search_pattern_option(&options.include_pattern),
        exclude_pattern: normalize_search_pattern_option(&options.exclude_pattern),
        path: normalized_path.to_string(),
        line,
        column,
        file_len: metadata.len(),
        file_modified_ms: file_modified_ms(metadata),
        file_sha256: sha256_hex(bytes),
    })
}

pub(crate) fn search_workspace_text_inner(
    root: &PathBuf,
    query: &str,
    options: &WorkspaceTextSearchOptions,
) -> Result<WorkspaceTextSearchResponse, String> {
    let regex = compile_search_regex(query, options)?;
    let include_patterns = compile_glob_patterns(options.include_pattern.as_deref())?;
    let exclude_patterns = compile_glob_patterns(options.exclude_pattern.as_deref())?;
    let page_limit = options.limit.map(|limit| {
        if limit == 0 {
            1
        } else {
            limit.min(MAX_SEARCH_PAGE_MATCHES)
        }
    });
    let decoded_cursor = match options.cursor.as_deref().filter(|value| !value.trim().is_empty()) {
        Some(cursor) => match decode_search_cursor(cursor) {
            Ok(decoded) => Some(decoded),
            Err(_) => return Ok(empty_text_search_response(true)),
        },
        None => None,
    };
    if decoded_cursor
        .as_ref()
        .is_some_and(|cursor| !cursor_matches_request(cursor, query, options))
    {
        return Ok(empty_text_search_response(true));
    }
    let mut cursor_file_was_seen = decoded_cursor.is_none();
    let root_for_filter = root.clone();
    let walker = WalkBuilder::new(root)
        .hidden(false)
        .follow_links(false)
        .require_git(false)
        .git_ignore(true)
        .git_global(true)
        .git_exclude(true)
        .sort_by_file_path(|left, right| left.cmp(right))
        .filter_entry(move |entry| {
            if entry.depth() == 0 {
                return true;
            }
            let name = entry.file_name().to_string_lossy();
            if entry.file_type().is_some_and(|ft| ft.is_dir()) {
                if should_always_skip(&name) {
                    return false;
                }
                if let Ok(rel_path) = entry.path().strip_prefix(&root_for_filter) {
                    let normalized = normalize_git_path(&rel_path.to_string_lossy());
                    if !normalized.is_empty() && is_special_directory_path(&normalized) {
                        return false;
                    }
                }
            }
            name != ".DS_Store"
        })
        .build();

    let mut files = Vec::new();
    let mut total_files = 0usize;
    let mut total_matches = 0usize;
    let mut limit_hit = false;
    let mut next_cursor = None;
    let mut last_page_cursor = None;
    let mut current_file: Option<WorkspaceTextSearchFileResult> = None;

    for entry in walker {
        let entry = match entry {
            Ok(entry) => entry,
            Err(_) => continue,
        };
        if !entry.file_type().is_some_and(|ft| ft.is_file()) {
            continue;
        }
        let rel_path = match entry.path().strip_prefix(root) {
            Ok(path) => path,
            Err(_) => continue,
        };
        let normalized = normalize_git_path(&rel_path.to_string_lossy());
        if normalized.is_empty() {
            continue;
        }
        if !include_patterns.is_empty() && !path_matches_patterns(&normalized, &include_patterns) {
            continue;
        }
        if !exclude_patterns.is_empty() && path_matches_patterns(&normalized, &exclude_patterns) {
            continue;
        }
        let metadata = match entry.metadata() {
            Ok(metadata) => metadata,
            Err(_) => continue,
        };
        if metadata.len() > MAX_SEARCH_FILE_BYTES {
            continue;
        }
        let bytes = match std::fs::read(entry.path()) {
            Ok(bytes) => bytes,
            Err(_) => continue,
        };
        if let Some(cursor) = decoded_cursor.as_ref() {
            if normalized == cursor.path {
                if !cursor_matches_file(cursor, &normalized, &metadata, &bytes) {
                    return Ok(empty_text_search_response(true));
                }
                cursor_file_was_seen = true;
            }
        }
        if bytes.contains(&0) {
            continue;
        }
        let content = String::from_utf8_lossy(&bytes);
        let mut file_match_count = 0usize;
        for (line_index, line) in content.lines().enumerate() {
            for capture in regex.find_iter(line) {
                let line_number = line_index + 1;
                let column = line[..capture.start()].chars().count() + 1;
                if should_skip_match_for_cursor(
                    &normalized,
                    line_number,
                    column,
                    decoded_cursor.as_ref(),
                ) {
                    continue;
                }
                if page_limit.is_some_and(|limit| total_matches >= limit) {
                    limit_hit = true;
                    next_cursor = last_page_cursor.clone();
                    break;
                }
                file_match_count += 1;
                total_matches += 1;
                if current_file
                    .as_ref()
                    .is_none_or(|file| file.path != normalized)
                {
                    if let Some(file) = current_file.take() {
                        files.push(file);
                    }
                    current_file = Some(WorkspaceTextSearchFileResult {
                        path: normalized.clone(),
                        match_count: 0,
                        matches: Vec::new(),
                    });
                    total_files += 1;
                }
                if let Some(file) = current_file.as_mut() {
                    file.match_count += 1;
                    if page_limit.is_some() || file.matches.len() < 50 {
                        file.matches.push(WorkspaceTextSearchMatch {
                            line: line_number,
                            column,
                            end_column: line[..capture.end()].chars().count() + 1,
                            preview: build_preview(line, capture.start(), capture.end()),
                        });
                    }
                }
                if let Some(limit) = page_limit {
                    if total_matches == limit {
                        last_page_cursor = Some(build_search_cursor(
                            query,
                            options,
                            &normalized,
                            line_number,
                            column,
                            &metadata,
                            &bytes,
                        )?);
                    }
                } else if total_matches >= MAX_SEARCH_MATCHES {
                    limit_hit = true;
                    break;
                }
            }
            if limit_hit {
                break;
            }
        }
        if limit_hit {
            break;
        }
        if file_match_count > 0 && current_file.as_ref().is_some_and(|file| file.path == normalized)
        {
            if let Some(file) = current_file.take() {
                files.push(file);
            }
        }
    }

    if let Some(file) = current_file.take() {
        files.push(file);
    }

    if !cursor_file_was_seen {
        return Ok(empty_text_search_response(true));
    }

    Ok(WorkspaceTextSearchResponse {
        files,
        file_count: total_files,
        match_count: total_matches,
        limit_hit,
        next_cursor,
        invalid_cursor: false,
    })
}

pub(crate) fn list_workspace_files_inner(
    root: &PathBuf,
    max_files: usize,
) -> WorkspaceFilesResponse {
    let scan_started_at = Instant::now();
    let mut scanned_entries = 0usize;
    let max_directories = max_files.saturating_mul(2).max(1_000);
    let mut files = Vec::new();
    let mut directories = Vec::new();
    let mut gitignored_files = Vec::new();
    let mut gitignored_directories = Vec::new();
    let mut limit_hit = false;
    let pruned_special_directories: Arc<Mutex<HashSet<String>>> =
        Arc::new(Mutex::new(HashSet::new()));
    let pruned_gitignored_directories: Arc<Mutex<HashSet<String>>> =
        Arc::new(Mutex::new(HashSet::new()));

    // Always open the repo so we can tag gitignored files for dimmed styling.
    let repo = Repository::open(root).ok();
    let repo_for_filter = Arc::new(Mutex::new(repo));

    // Seed root-level entries first so the file tree always reflects the real workspace root
    // even when deep traversal later hits the max file cap.
    if let Ok(entries) = std::fs::read_dir(root) {
        let mut root_entries = Vec::new();
        for entry in entries {
            if workspace_scan_budget_reached(scan_started_at, scanned_entries) {
                limit_hit = true;
                break;
            }
            scanned_entries += 1;
            if let Ok(entry) = entry {
                root_entries.push(entry);
            }
        }
        root_entries.sort_by(|a, b| {
            a.file_name()
                .to_string_lossy()
                .cmp(&b.file_name().to_string_lossy())
        });
        for entry in root_entries {
            if workspace_scan_budget_reached(scan_started_at, scanned_entries) {
                limit_hit = true;
                break;
            }
            let path = entry.path();
            let rel_path = match path.strip_prefix(root) {
                Ok(path) => path,
                Err(_) => continue,
            };
            let normalized = normalize_git_path(&rel_path.to_string_lossy());
            if normalized.is_empty() {
                continue;
            }
            let name = entry.file_name().to_string_lossy().to_string();
            let file_type = match entry.file_type() {
                Ok(file_type) => file_type,
                Err(_) => continue,
            };
            let is_ignored = repo_for_filter
                .lock()
                .ok()
                .and_then(|repo| {
                    repo.as_ref()
                        .and_then(|r| r.status_should_ignore(rel_path).ok())
                })
                .unwrap_or(false);
            if file_type.is_dir() {
                if should_always_skip(&name) {
                    continue;
                }
                if directories.len() >= max_directories {
                    limit_hit = true;
                    continue;
                }
                directories.push(normalized.clone());
                if is_ignored {
                    gitignored_directories.push(normalized);
                }
            } else if file_type.is_file() {
                if name == ".DS_Store" {
                    continue;
                }
                files.push(normalized.clone());
                if is_ignored {
                    gitignored_files.push(normalized);
                }
                if files.len() >= max_files {
                    sort_and_dedup_workspace_lists(
                        &mut files,
                        &mut directories,
                        &mut gitignored_files,
                        &mut gitignored_directories,
                    );
                    let scan_state = WorkspaceScanState::Partial;
                    let directory_entries =
                        build_initial_directory_entries(&files, &directories, scan_state);
                    return workspace_files_response(
                        files,
                        directories,
                        gitignored_files,
                        gitignored_directories,
                        scan_state,
                        true,
                        directory_entries,
                    None,
                    );
                }
            }
        }
    }

    let root_for_filter = root.clone();
    let pruned_special_directories_for_filter = Arc::clone(&pruned_special_directories);
    let pruned_gitignored_directories_for_filter = Arc::clone(&pruned_gitignored_directories);
    let repo_for_filter_clone = Arc::clone(&repo_for_filter);
    let walker = WalkBuilder::new(root)
        .hidden(false)
        .follow_links(false)
        .require_git(false)
        .git_ignore(false)
        .filter_entry(move |entry| {
            if entry.depth() == 0 {
                return true;
            }
            let name = entry.file_name().to_string_lossy();
            if entry.file_type().is_some_and(|ft| ft.is_dir()) {
                if should_always_skip(&name) {
                    return false;
                }
                if let Ok(rel_path) = entry.path().strip_prefix(&root_for_filter) {
                    let normalized = normalize_git_path(&rel_path.to_string_lossy());
                    if !normalized.is_empty() && is_special_directory_path(&normalized) {
                        if let Ok(mut special_dirs) = pruned_special_directories_for_filter.lock() {
                            special_dirs.insert(normalized);
                        }
                        return false;
                    }
                    // Prune gitignored directories — their children will be
                    // lazy-loaded on demand instead of scanned eagerly.
                    if !normalized.is_empty() {
                        let is_ignored = repo_for_filter_clone
                            .lock()
                            .ok()
                            .and_then(|repo| {
                                repo.as_ref()
                                    .and_then(|r| r.status_should_ignore(rel_path).ok())
                            })
                            .unwrap_or(false);
                        if is_ignored {
                            if let Ok(mut gitignored_dirs) =
                                pruned_gitignored_directories_for_filter.lock()
                            {
                                gitignored_dirs.insert(normalized);
                            }
                            return false;
                        }
                    }
                }
                return true;
            }
            // Skip OS metadata files
            name != ".DS_Store"
        })
        .build();

    for entry in walker {
        if workspace_scan_budget_reached(scan_started_at, scanned_entries) {
            limit_hit = true;
            break;
        }
        scanned_entries += 1;
        let entry = match entry {
            Ok(entry) => entry,
            Err(_) => continue,
        };
        if entry.depth() <= 1 {
            continue;
        }
        if let Ok(rel_path) = entry.path().strip_prefix(root) {
            let normalized = normalize_git_path(&rel_path.to_string_lossy());
            if normalized.is_empty() {
                continue;
            }
            let is_ignored = repo_for_filter
                .lock()
                .ok()
                .and_then(|repo| {
                    repo.as_ref()
                        .and_then(|r| r.status_should_ignore(rel_path).ok())
                })
                .unwrap_or(false);
            if entry.file_type().is_some_and(|ft| ft.is_dir()) {
                if directories.len() >= max_directories {
                    limit_hit = true;
                    continue;
                }
                directories.push(normalized.clone());
                if is_ignored {
                    gitignored_directories.push(normalized);
                }
            } else if entry.file_type().is_some_and(|ft| ft.is_file()) {
                files.push(normalized.clone());
                if is_ignored {
                    gitignored_files.push(normalized);
                }
                if files.len() >= max_files {
                    limit_hit = true;
                    break;
                }
            }
        }
    }

    if let Ok(special_dirs) = pruned_special_directories.lock() {
        for normalized in special_dirs.iter() {
            directories.push(normalized.clone());
            let relative_path = normalized_relative_to_pathbuf(normalized);
            let is_ignored = repo_for_filter
                .lock()
                .ok()
                .and_then(|repo| {
                    repo.as_ref()
                        .and_then(|r| r.status_should_ignore(&relative_path).ok())
                })
                .unwrap_or(false);
            if is_ignored {
                gitignored_directories.push(normalized.clone());
            }
        }
    }

    // Re-add gitignored directories that were pruned from the walk so the UI
    // knows they exist. Their children are loaded lazily on demand.
    if let Ok(gitignored_dirs) = pruned_gitignored_directories.lock() {
        for normalized in gitignored_dirs.iter() {
            directories.push(normalized.clone());
            gitignored_directories.push(normalized.clone());
        }
    }

    sort_and_dedup_workspace_lists(
        &mut files,
        &mut directories,
        &mut gitignored_files,
        &mut gitignored_directories,
    );
    let scan_state = if limit_hit {
        WorkspaceScanState::Partial
    } else {
        WorkspaceScanState::Complete
    };
    let directory_entries = build_initial_directory_entries(&files, &directories, scan_state);
    workspace_files_response(
        files,
        directories,
        gitignored_files,
        gitignored_directories,
        scan_state,
        limit_hit,
        directory_entries,
        None,
    )
}

fn list_workspace_directory_children_scoped_inner(
    root: &PathBuf,
    directory_path: &str,
    max_entries: usize,
) -> Result<WorkspaceFilesResponse, String> {
    list_workspace_directory_children_scoped_inner_with_scope(
        root,
        directory_path,
        max_entries,
        DirectoryChildScanScope::All,
        None,
    )
}

fn list_workspace_directory_children_scoped_inner_with_scope(
    root: &PathBuf,
    directory_path: &str,
    max_entries: usize,
    scope: DirectoryChildScanScope,
    cached_repo: Option<&Repository>,
) -> Result<WorkspaceFilesResponse, String> {
    let normalized_path = normalize_workspace_relative_directory_path(directory_path)?;
    let entry_limit = directory_child_entry_limit(&normalized_path, max_entries);
    let canonical_root = root
        .canonicalize()
        .map_err(|err| format!("Failed to resolve workspace root: {err}"))?;
    let candidate = canonical_root.join(normalized_relative_to_pathbuf(&normalized_path));
    let canonical_path = candidate
        .canonicalize()
        .map_err(|err| format!("Failed to resolve directory path: {err}"))?;
    if !canonical_path.starts_with(&canonical_root) {
        return Err("Invalid directory path.".to_string());
    }
    let metadata = std::fs::metadata(&canonical_path)
        .map_err(|err| format!("Failed to read directory metadata: {err}"))?;
    if !metadata.is_dir() {
        return Err("Path is not a directory.".to_string());
    }
    let directory_mtime_ms = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64);

    // Enable gitignore detection at root level when scope is All so the
    // frontend knows which directories are gitignored and can lazy-load them.
    let include_gitignore_markers =
        scope == DirectoryChildScanScope::All || !normalized_path.is_empty();
    let owned_repo;
    let repo_ref: Option<&Repository> = if include_gitignore_markers {
        if cached_repo.is_some() {
            cached_repo
        } else {
            owned_repo = Repository::open(&canonical_root).ok();
            owned_repo.as_ref()
        }
    } else {
        None
    };
    let mut files = Vec::new();
    let mut directories = Vec::new();
    let mut gitignored_files = Vec::new();
    let mut gitignored_directories = Vec::new();

    let entries = std::fs::read_dir(&canonical_path)
        .map_err(|err| format!("Failed to read directory: {err}"))?;
    let scan_started_at = Instant::now();
    let max_scanned_entries = entry_limit
        .saturating_mul(WORKSPACE_DIRECTORY_SCAN_BUDGET_MULTIPLIER)
        .max(entry_limit);
    let mut sorted_entries = Vec::new();
    let mut limit_hit = false;
    for entry in entries {
        if scan_started_at.elapsed() >= WORKSPACE_SCAN_TIME_BUDGET {
            limit_hit = true;
            break;
        }
        if sorted_entries.len() >= max_scanned_entries {
            limit_hit = true;
            break;
        }
        if let Ok(entry) = entry {
            sorted_entries.push((entry.file_name().to_string_lossy().to_string(), entry));
        }
    }
    sort_and_truncate_named_entries(&mut sorted_entries, max_scanned_entries);

    for (_, entry) in sorted_entries {
        if scan_started_at.elapsed() >= WORKSPACE_SCAN_TIME_BUDGET {
            limit_hit = true;
            break;
        }
        let path = entry.path();
        let rel_path = match path.strip_prefix(&canonical_root) {
            Ok(value) => value,
            Err(_) => continue,
        };
        let normalized = normalize_git_path(&rel_path.to_string_lossy());
        if normalized.is_empty() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        let file_type = match entry.file_type() {
            Ok(value) => value,
            Err(_) => continue,
        };
        let is_ignored = if include_gitignore_markers {
            repo_ref
                .and_then(|r| r.status_should_ignore(rel_path).ok())
                .unwrap_or(false)
        } else {
            false
        };
        if !should_include_directory_child(is_ignored, scope) {
            continue;
        }

        if file_type.is_dir() {
            if should_always_skip(&name) {
                continue;
            }
            directories.push(normalized.clone());
            if is_ignored && scope != DirectoryChildScanScope::VisibleOnly {
                gitignored_directories.push(normalized);
            }
        } else if file_type.is_file() {
            if name == ".DS_Store" {
                continue;
            }
            files.push(normalized.clone());
            if is_ignored && scope != DirectoryChildScanScope::VisibleOnly {
                gitignored_files.push(normalized);
            }
        }

        if files.len() + directories.len() >= entry_limit {
            limit_hit = true;
            break;
        }
    }

    sort_and_dedup_workspace_lists(
        &mut files,
        &mut directories,
        &mut gitignored_files,
        &mut gitignored_directories,
    );
    let scan_state = if limit_hit {
        WorkspaceScanState::Partial
    } else {
        WorkspaceScanState::Complete
    };
    let directory_entries =
        build_directory_child_entries(&normalized_path, &files, &directories, scan_state);
    Ok(workspace_files_response(
        files,
        directories,
        gitignored_files,
        gitignored_directories,
        scan_state,
        limit_hit,
        directory_entries,
        directory_mtime_ms,
    ))
}

pub(crate) fn list_workspace_directory_children_inner(
    root: &PathBuf,
    directory_path: &str,
    max_entries: usize,
) -> Result<WorkspaceFilesResponse, String> {
    list_workspace_directory_children_scoped_inner_with_scope(
        root,
        directory_path,
        max_entries,
        DirectoryChildScanScope::All,
        None,
    )
}

pub(crate) fn list_workspace_directory_children_visible_inner(
    root: &PathBuf,
    directory_path: &str,
    max_entries: usize,
) -> Result<WorkspaceFilesResponse, String> {
    list_workspace_directory_children_scoped_inner_with_scope(
        root,
        directory_path,
        max_entries,
        DirectoryChildScanScope::VisibleOnly,
        None,
    )
}

pub(crate) fn list_workspace_directory_children_ignored_inner(
    root: &PathBuf,
    directory_path: &str,
    max_entries: usize,
) -> Result<WorkspaceFilesResponse, String> {
    list_workspace_directory_children_scoped_inner_with_scope(
        root,
        directory_path,
        max_entries,
        DirectoryChildScanScope::IgnoredOnly,
        None,
    )
}

pub(crate) fn list_external_absolute_directory_children_inner(
    absolute_directory_path: &str,
    allowed_roots: &[PathBuf],
    max_entries: usize,
) -> Result<WorkspaceFilesResponse, String> {
    let canonical_path = resolve_allowed_external_absolute_path(
        absolute_directory_path,
        allowed_roots,
        "directory",
        "Invalid directory path.",
    )?;

    let entries = std::fs::read_dir(&canonical_path)
        .map_err(|err| format!("Failed to read directory: {err}"))?;
    let scan_started_at = Instant::now();
    let max_scanned_entries = max_entries
        .saturating_mul(WORKSPACE_DIRECTORY_SCAN_BUDGET_MULTIPLIER)
        .max(max_entries);
    let mut sorted_entries = Vec::new();
    let mut limit_hit = false;
    for entry in entries {
        if scan_started_at.elapsed() >= WORKSPACE_SCAN_TIME_BUDGET {
            limit_hit = true;
            break;
        }
        if sorted_entries.len() >= max_scanned_entries {
            limit_hit = true;
            break;
        }
        if let Ok(entry) = entry {
            sorted_entries.push((entry.file_name().to_string_lossy().to_string(), entry));
        }
    }
    sort_and_truncate_named_entries(&mut sorted_entries, max_scanned_entries);

    let mut files = Vec::new();
    let mut directories = Vec::new();
    for (name, entry) in sorted_entries {
        let path = entry.path();
        let normalized = normalize_git_path(&path.to_string_lossy());
        if normalized.is_empty() {
            continue;
        }
        let file_type = match entry.file_type() {
            Ok(value) => value,
            Err(_) => continue,
        };
        if file_type.is_dir() {
            if should_always_skip(&name) {
                continue;
            }
            directories.push(normalized);
        } else if file_type.is_file() {
            if name == ".DS_Store" {
                continue;
            }
            files.push(normalized);
        }

        if files.len() + directories.len() >= max_entries {
            limit_hit = true;
            break;
        }
    }

    files.sort();
    files.dedup();
    directories.sort();
    directories.dedup();
    let scan_state = if limit_hit {
        WorkspaceScanState::Partial
    } else {
        WorkspaceScanState::Complete
    };
    Ok(workspace_files_response(
        files,
        directories,
        Vec::new(),
        Vec::new(),
        scan_state,
        limit_hit,
        Vec::new(),
    None,
    ))
}

const MAX_WORKSPACE_FILE_BYTES: u64 = 400_000;

#[derive(Serialize, Deserialize, Clone)]
pub(crate) struct WorkspaceFileResponse {
    content: String,
    truncated: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkspacePreviewHandleResponse {
    pub(crate) absolute_path: String,
    pub(crate) byte_length: u64,
    pub(crate) extension: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub(crate) struct ExternalSpecFileResponse {
    pub(crate) exists: bool,
    pub(crate) content: String,
    pub(crate) truncated: bool,
}

fn normalize_external_spec_root(spec_root: &str) -> Result<PathBuf, String> {
    let trimmed = spec_root.trim();
    if trimmed.is_empty() {
        return Err("Spec root cannot be empty.".to_string());
    }
    let root = PathBuf::from(trimmed);
    if !root.is_absolute() {
        return Err("Spec root must be an absolute path.".to_string());
    }
    let canonical = root
        .canonicalize()
        .map_err(|err| format!("Failed to resolve custom spec root: {err}"))?;
    if !canonical.is_dir() {
        return Err("Custom spec root is not a directory.".to_string());
    }
    Ok(canonical)
}

struct ResolvedExternalSpecRoot {
    root: PathBuf,
    exists: bool,
}

fn resolve_external_spec_root(spec_root: &str) -> Result<ResolvedExternalSpecRoot, String> {
    let custom_root = normalize_external_spec_root(spec_root)?;
    let file_name = custom_root
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or_default();
    if file_name.eq_ignore_ascii_case("openspec") {
        return Ok(ResolvedExternalSpecRoot {
            root: custom_root,
            exists: true,
        });
    }

    let nested = custom_root.join("openspec");
    if nested.is_dir() {
        let canonical_nested = nested
            .canonicalize()
            .map_err(|err| format!("Failed to resolve custom spec root: {err}"))?;
        return Ok(ResolvedExternalSpecRoot {
            root: canonical_nested,
            exists: true,
        });
    }

    // Backward compatibility: older clients may pass the openspec root directly
    // even if directory name is not literally `openspec`.
    let legacy_root = custom_root.join("changes").is_dir() && custom_root.join("specs").is_dir();
    if legacy_root {
        return Ok(ResolvedExternalSpecRoot {
            root: custom_root,
            exists: true,
        });
    }

    Ok(ResolvedExternalSpecRoot {
        root: nested,
        exists: false,
    })
}

fn resolve_external_spec_logical_path(
    spec_root: &Path,
    logical_path: &str,
) -> Result<PathBuf, String> {
    let normalized = logical_path.trim().replace('\\', "/");
    if normalized == "openspec" {
        return Ok(spec_root.to_path_buf());
    }
    if !normalized.starts_with("openspec/") {
        return Err("External spec path must be under openspec/.".to_string());
    }
    let suffix = normalized["openspec/".len()..].trim();
    if suffix.is_empty() {
        return Ok(spec_root.to_path_buf());
    }
    let relative = Path::new(suffix);
    for component in relative.components() {
        match component {
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                return Err("Invalid external spec path.".to_string());
            }
            _ => {}
        }
    }
    Ok(spec_root.join(relative))
}

pub(crate) fn list_external_spec_tree_inner(
    spec_root: &str,
    max_files: usize,
) -> Result<WorkspaceFilesResponse, String> {
    // External spec probing is a pre-send path for some flows; keep it bounded
    // so deep trees cannot stall the first-turn UX.
    const EXTERNAL_SPEC_TREE_MAX_FILES: usize = 8_000;
    let resolved = resolve_external_spec_root(spec_root)?;
    let effective_max_files = max_files.min(EXTERNAL_SPEC_TREE_MAX_FILES).max(1);
    let max_directories = effective_max_files.saturating_mul(2).max(1_000);
    let scan_started_at = Instant::now();
    let mut scanned_entries = 0usize;
    let mut files = Vec::new();
    let mut directories = vec!["openspec".to_string()];
    let mut limit_hit = false;
    if !resolved.exists {
        let directory_entries =
            build_initial_directory_entries(&files, &directories, WorkspaceScanState::Complete);
        return Ok(workspace_files_response(
            files,
            directories,
            Vec::new(),
            Vec::new(),
            WorkspaceScanState::Complete,
            false,
            directory_entries,
        None,
        ));
    }
    let root = resolved.root;

    let walker = WalkBuilder::new(&root)
        .hidden(false)
        .follow_links(false)
        .require_git(false)
        .git_ignore(false)
        .filter_entry(|entry| {
            if entry.depth() == 0 {
                return true;
            }
            let name = entry.file_name().to_string_lossy();
            if entry.file_type().is_some_and(|ft| ft.is_dir()) {
                return !should_always_skip(&name);
            }
            name != ".DS_Store"
        })
        .build();

    for entry in walker {
        if workspace_scan_budget_reached(scan_started_at, scanned_entries) {
            limit_hit = true;
            break;
        }
        let entry = match entry {
            Ok(entry) => entry,
            Err(_) => continue,
        };
        scanned_entries = scanned_entries.saturating_add(1);
        let rel_path = match entry.path().strip_prefix(&root) {
            Ok(path) => path,
            Err(_) => continue,
        };
        let normalized = normalize_git_path(&rel_path.to_string_lossy());
        if normalized.is_empty() {
            continue;
        }
        let logical = format!("openspec/{normalized}");
        if entry.file_type().is_some_and(|ft| ft.is_dir()) {
            if directories.len() < max_directories {
                directories.push(logical);
            } else {
                limit_hit = true;
            }
        } else if entry.file_type().is_some_and(|ft| ft.is_file()) {
            files.push(logical);
            if files.len() >= effective_max_files {
                limit_hit = true;
                break;
            }
        }
    }

    files.sort();
    files.dedup();
    directories.sort();
    directories.dedup();
    let scan_state = if limit_hit {
        WorkspaceScanState::Partial
    } else {
        WorkspaceScanState::Complete
    };
    let directory_entries = build_initial_directory_entries(&files, &directories, scan_state);
    Ok(workspace_files_response(
        files,
        directories,
        Vec::new(),
        Vec::new(),
        scan_state,
        limit_hit,
        directory_entries,
    None,
    ))
}

pub(crate) fn read_external_spec_file_inner(
    spec_root: &str,
    logical_path: &str,
) -> Result<ExternalSpecFileResponse, String> {
    let resolved = resolve_external_spec_root(spec_root)?;
    if !resolved.exists {
        return Ok(ExternalSpecFileResponse {
            exists: false,
            content: String::new(),
            truncated: false,
        });
    }
    let root = resolved.root;
    let candidate = resolve_external_spec_logical_path(&root, logical_path)?;
    if !candidate.exists() {
        return Ok(ExternalSpecFileResponse {
            exists: false,
            content: String::new(),
            truncated: false,
        });
    }
    let canonical_path = candidate
        .canonicalize()
        .map_err(|err| format!("Failed to resolve external spec file: {err}"))?;
    if !canonical_path.starts_with(&root) {
        return Err("Invalid external spec file path.".to_string());
    }
    let metadata = std::fs::metadata(&canonical_path)
        .map_err(|err| format!("Failed to read external spec file metadata: {err}"))?;
    if !metadata.is_file() {
        return Ok(ExternalSpecFileResponse {
            exists: false,
            content: String::new(),
            truncated: false,
        });
    }

    let file = File::open(&canonical_path)
        .map_err(|err| format!("Failed to open external spec file: {err}"))?;
    let mut buffer = Vec::new();
    file.take(MAX_WORKSPACE_FILE_BYTES + 1)
        .read_to_end(&mut buffer)
        .map_err(|err| format!("Failed to read external spec file: {err}"))?;

    let truncated = buffer.len() > MAX_WORKSPACE_FILE_BYTES as usize;
    if truncated {
        buffer.truncate(MAX_WORKSPACE_FILE_BYTES as usize);
    }
    let content = decode_text_bytes(&buffer, "External spec file")?;
    Ok(ExternalSpecFileResponse {
        exists: true,
        content,
        truncated,
    })
}

pub(crate) fn write_external_spec_file_inner(
    spec_root: &str,
    logical_path: &str,
    content: &str,
) -> Result<(), String> {
    if content.len() > MAX_WORKSPACE_FILE_BYTES as usize {
        return Err("File content exceeds maximum allowed size".to_string());
    }
    let resolved = resolve_external_spec_root(spec_root)?;
    let root = resolved.root;
    let candidate = resolve_external_spec_logical_path(&root, logical_path)?;
    if candidate == root {
        return Err("Cannot write to external spec root directory directly.".to_string());
    }

    let normalized = logical_path.replace('\\', "/");
    if normalized == ".git"
        || normalized.starts_with(".git/")
        || normalized.contains("/.git/")
        || normalized.ends_with("/.git")
    {
        return Err("Cannot write to .git directory".to_string());
    }

    if let Some(parent) = candidate.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|err| format!("Failed to create external spec parent directory: {err}"))?;
        let canonical_root = root
            .canonicalize()
            .map_err(|err| format!("Failed to resolve external spec root: {err}"))?;
        let canonical_parent = parent
            .canonicalize()
            .map_err(|err| format!("Failed to resolve external spec parent directory: {err}"))?;
        if !canonical_parent.starts_with(&canonical_root) {
            return Err("Invalid external spec file path.".to_string());
        }
    } else {
        return Err("Invalid external spec file path.".to_string());
    }

    std::fs::write(&candidate, content)
        .map_err(|err| format!("Failed to write external spec file: {err}"))?;
    Ok(())
}

pub(crate) fn read_workspace_file_inner(
    root: &PathBuf,
    relative_path: &str,
) -> Result<WorkspaceFileResponse, String> {
    let canonical_root = root
        .canonicalize()
        .map_err(|err| format!("Failed to resolve workspace root: {err}"))?;
    let candidate = canonical_root.join(relative_path);
    let canonical_path = candidate
        .canonicalize()
        .map_err(|err| format!("Failed to open file: {err}"))?;
    if !canonical_path.starts_with(&canonical_root) {
        return Err("Invalid file path".to_string());
    }
    let metadata = std::fs::metadata(&canonical_path)
        .map_err(|err| format!("Failed to read file metadata: {err}"))?;
    if !metadata.is_file() {
        return Err("Path is not a file".to_string());
    }

    let file = File::open(&canonical_path).map_err(|err| format!("Failed to open file: {err}"))?;
    let mut buffer = Vec::new();
    file.take(MAX_WORKSPACE_FILE_BYTES + 1)
        .read_to_end(&mut buffer)
        .map_err(|err| format!("Failed to read file: {err}"))?;

    let truncated = buffer.len() > MAX_WORKSPACE_FILE_BYTES as usize;
    if truncated {
        buffer.truncate(MAX_WORKSPACE_FILE_BYTES as usize);
    }

    let content = decode_text_bytes(&buffer, "File")?;
    Ok(WorkspaceFileResponse { content, truncated })
}

pub(crate) fn read_external_absolute_file_inner(
    absolute_path: &str,
    allowed_roots: &[PathBuf],
) -> Result<WorkspaceFileResponse, String> {
    let canonical_path = resolve_allowed_external_absolute_path(
        absolute_path,
        allowed_roots,
        "file",
        "Invalid file path",
    )?;

    let file = File::open(&canonical_path).map_err(|err| format!("Failed to open file: {err}"))?;
    let mut buffer = Vec::new();
    file.take(MAX_WORKSPACE_FILE_BYTES + 1)
        .read_to_end(&mut buffer)
        .map_err(|err| format!("Failed to read file: {err}"))?;

    let truncated = buffer.len() > MAX_WORKSPACE_FILE_BYTES as usize;
    if truncated {
        buffer.truncate(MAX_WORKSPACE_FILE_BYTES as usize);
    }

    let content = decode_text_bytes(&buffer, "File")?;
    Ok(WorkspaceFileResponse { content, truncated })
}

fn build_preview_handle_response(
    canonical_path: &Path,
) -> Result<WorkspacePreviewHandleResponse, String> {
    let metadata = std::fs::metadata(canonical_path)
        .map_err(|err| format!("Failed to read file metadata: {err}"))?;
    if !metadata.is_file() {
        return Err("Path is not a file".to_string());
    }

    Ok(WorkspacePreviewHandleResponse {
        absolute_path: canonical_path.to_string_lossy().to_string(),
        byte_length: metadata.len(),
        extension: canonical_path
            .extension()
            .and_then(|value| value.to_str())
            .map(|value| value.to_ascii_lowercase()),
    })
}

pub(crate) fn resolve_workspace_preview_handle_inner(
    root: &PathBuf,
    relative_path: &str,
) -> Result<WorkspacePreviewHandleResponse, String> {
    let canonical_root = root
        .canonicalize()
        .map_err(|err| format!("Failed to resolve workspace root: {err}"))?;
    let candidate = canonical_root.join(relative_path);
    let canonical_path = candidate
        .canonicalize()
        .map_err(|err| format!("Failed to open file: {err}"))?;
    if !canonical_path.starts_with(&canonical_root) {
        return Err("Invalid file path".to_string());
    }
    build_preview_handle_response(&canonical_path)
}

pub(crate) fn resolve_external_spec_preview_handle_inner(
    spec_root: &str,
    logical_path: &str,
) -> Result<WorkspacePreviewHandleResponse, String> {
    let resolved = resolve_external_spec_root(spec_root)?;
    if !resolved.exists {
        return Err("External spec root does not exist.".to_string());
    }
    let root = resolved.root;
    let candidate = resolve_external_spec_logical_path(&root, logical_path)?;
    let canonical_path = candidate
        .canonicalize()
        .map_err(|err| format!("Failed to resolve external spec file: {err}"))?;
    if !canonical_path.starts_with(&root) {
        return Err("Invalid external spec file path.".to_string());
    }
    build_preview_handle_response(&canonical_path)
}

pub(crate) fn resolve_external_absolute_preview_handle_inner(
    absolute_path: &str,
    allowed_roots: &[PathBuf],
) -> Result<WorkspacePreviewHandleResponse, String> {
    let canonical_path = resolve_allowed_external_absolute_path(
        absolute_path,
        allowed_roots,
        "file",
        "Invalid file path",
    )?;
    build_preview_handle_response(&canonical_path)
}

pub(crate) fn write_external_absolute_file_inner(
    absolute_path: &str,
    allowed_roots: &[PathBuf],
    content: &str,
) -> Result<(), String> {
    if content.len() > MAX_WORKSPACE_FILE_BYTES as usize {
        return Err("File content exceeds maximum allowed size".to_string());
    }

    let canonical_path = resolve_allowed_external_absolute_path(
        absolute_path,
        allowed_roots,
        "file",
        "Invalid file path",
    )?;

    std::fs::write(&canonical_path, content)
        .map_err(|err| format!("Failed to write file: {err}"))?;
    Ok(())
}

fn resolve_allowed_external_absolute_path(
    absolute_path: &str,
    allowed_roots: &[PathBuf],
    expected_kind: &str,
    invalid_path_message: &str,
) -> Result<PathBuf, String> {
    let trimmed = absolute_path.trim();
    if trimmed.is_empty() {
        return Err(invalid_path_message.to_string());
    }

    let raw_path = PathBuf::from(trimmed);
    if !raw_path.is_absolute() {
        return Err(invalid_path_message.to_string());
    }

    let canonical_path = raw_path
        .canonicalize()
        .map_err(|err| format!("Failed to open file: {err}"))?;

    let mut within_allowed_root = false;
    for root in allowed_roots {
        if let Ok(canonical_root) = root.canonicalize() {
            if canonical_path.starts_with(&canonical_root) {
                within_allowed_root = true;
                break;
            }
        }
    }
    if !within_allowed_root {
        return Err("Path is not within allowed directories.".to_string());
    }

    let metadata = std::fs::metadata(&canonical_path)
        .map_err(|err| format!("Failed to read file metadata: {err}"))?;
    let kind_matches = match expected_kind {
        "file" => metadata.is_file(),
        "directory" => metadata.is_dir(),
        _ => false,
    };
    if !kind_matches {
        return Err(format!("Path is not a {expected_kind}."));
    }
    Ok(canonical_path)
}

pub(crate) fn write_workspace_file_inner(
    root: &PathBuf,
    relative_path: &str,
    content: &str,
) -> Result<(), String> {
    let canonical_root = root
        .canonicalize()
        .map_err(|err| format!("Failed to resolve workspace root: {err}"))?;
    let candidate = canonical_root.join(relative_path);

    // Ensure the parent directory exists so we can canonicalize safely.
    if let Some(parent) = candidate.parent() {
        let canonical_parent = parent
            .canonicalize()
            .map_err(|err| format!("Failed to resolve parent directory: {err}"))?;
        if !canonical_parent.starts_with(&canonical_root) {
            return Err("Invalid file path".to_string());
        }
    }

    // Block writes into .git directories.
    let normalized = relative_path.replace('\\', "/");
    if normalized == ".git"
        || normalized.starts_with(".git/")
        || normalized.contains("/.git/")
        || normalized.contains("/.git")
    {
        return Err("Cannot write to .git directory".to_string());
    }

    if content.len() > MAX_WORKSPACE_FILE_BYTES as usize {
        return Err("File content exceeds maximum allowed size".to_string());
    }

    std::fs::write(&candidate, content).map_err(|err| format!("Failed to write file: {err}"))?;
    Ok(())
}

pub(crate) fn create_workspace_directory_inner(
    root: &PathBuf,
    relative_path: &str,
) -> Result<(), String> {
    let normalized_path = normalize_workspace_relative_path(relative_path)?;
    let canonical_root = root
        .canonicalize()
        .map_err(|err| format!("Failed to resolve workspace root: {err}"))?;
    let candidate = canonical_root.join(normalized_relative_to_pathbuf(&normalized_path));

    // Ensure the parent directory exists and resolves inside workspace root.
    if let Some(parent) = candidate.parent() {
        let canonical_parent = parent
            .canonicalize()
            .map_err(|err| format!("Failed to resolve parent directory: {err}"))?;
        if !canonical_parent.starts_with(&canonical_root) {
            return Err("Invalid directory path".to_string());
        }
    }

    if candidate.exists() {
        let metadata = std::fs::metadata(&candidate)
            .map_err(|err| format!("Failed to read path metadata: {err}"))?;
        if metadata.is_dir() {
            return Ok(());
        }
        return Err("Path already exists and is not a directory.".to_string());
    }

    std::fs::create_dir(&candidate).map_err(|err| format!("Failed to create directory: {err}"))?;
    Ok(())
}

pub(crate) fn trash_workspace_item_inner(
    root: &PathBuf,
    relative_path: &str,
) -> Result<(), String> {
    let normalized_path = normalize_workspace_relative_path(relative_path)?;
    let canonical_root = root
        .canonicalize()
        .map_err(|err| format!("Failed to resolve workspace root: {err}"))?;
    let candidate = canonical_root.join(normalized_relative_to_pathbuf(&normalized_path));
    let canonical_path = candidate
        .canonicalize()
        .map_err(|err| format!("Failed to resolve path: {err}"))?;

    if !canonical_path.starts_with(&canonical_root) {
        return Err("Invalid file path".to_string());
    }

    if !canonical_path.exists() {
        return Err("Path does not exist".to_string());
    }

    trash::delete(&canonical_path).map_err(|err| format!("Failed to move to trash: {err}"))?;

    Ok(())
}

/// Copy a file or directory within the workspace, appending " copy" (or " copy N")
/// to avoid name collisions.
pub(crate) fn copy_workspace_item_inner(
    root: &PathBuf,
    relative_path: &str,
) -> Result<String, String> {
    duplicate_workspace_item_inner(root, relative_path).map(|result| result.path)
}

pub(crate) fn duplicate_workspace_item_inner(
    root: &PathBuf,
    relative_path: &str,
) -> Result<WorkspaceFileOperationResult, String> {
    let canonical_root = resolve_workspace_root(root)?;
    let (_normalized_path, canonical_path, kind) =
        resolve_workspace_item_path(&canonical_root, relative_path)?;
    let parent = canonical_path
        .parent()
        .ok_or_else(|| "Invalid file path".to_string())?;
    copy_workspace_item_to_directory(&canonical_root, &canonical_path, kind, parent, false)
}

pub(crate) fn paste_workspace_item_inner(
    root: &PathBuf,
    source_path: &str,
    target_directory: &str,
) -> Result<WorkspaceFileOperationResult, String> {
    let canonical_root = resolve_workspace_root(root)?;
    let (_normalized_source, canonical_source, kind) =
        resolve_workspace_item_path(&canonical_root, source_path)?;
    let (_normalized_target, canonical_target) =
        resolve_workspace_target_directory(&canonical_root, target_directory)?;
    copy_workspace_item_to_directory(
        &canonical_root,
        &canonical_source,
        kind,
        &canonical_target,
        true,
    )
}

pub(crate) fn rename_workspace_item_inner(
    root: &PathBuf,
    relative_path: &str,
    new_name: &str,
) -> Result<WorkspaceFileOperationResult, String> {
    let canonical_root = resolve_workspace_root(root)?;
    let (_normalized_path, canonical_path, kind) =
        resolve_workspace_item_path(&canonical_root, relative_path)?;
    let validated_name = validate_workspace_item_basename(new_name)?;
    let parent = canonical_path
        .parent()
        .ok_or_else(|| "Invalid file path".to_string())?;
    let target = parent.join(validated_name);

    if target.exists() {
        return Err("Target path already exists.".to_string());
    }

    std::fs::rename(&canonical_path, &target)
        .map_err(|err| format!("Failed to rename workspace item: {err}"))?;

    Ok(WorkspaceFileOperationResult {
        path: relative_path_from_absolute(&canonical_root, &target)?,
        kind,
    })
}

pub(crate) fn paste_external_workspace_items_inner(
    _root: &PathBuf,
    _source_paths: &[String],
    _target_directory: &str,
) -> Result<Vec<WorkspaceFileOperationResult>, String> {
    Err("External file import is not supported in this build yet. Use internal file tree Copy and Paste.".to_string())
}

fn build_copy_destination_name(
    source_path: &Path,
    kind: WorkspaceFileItemKind,
    counter: u32,
) -> Result<String, String> {
    let source_name = source_path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "Invalid source file name".to_string())?;
    let source_stem = source_path
        .file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or(source_name);
    let source_extension = source_path
        .extension()
        .and_then(|extension| extension.to_str());
    let suffix = if counter == 0 {
        " copy".to_string()
    } else {
        format!(" copy {counter}")
    };

    Ok(match (kind, source_extension) {
        (WorkspaceFileItemKind::File, Some(extension)) => {
            format!("{source_stem}{suffix}.{extension}")
        }
        _ => format!("{source_stem}{suffix}"),
    })
}

fn resolve_collision_safe_destination(
    target_directory: &Path,
    source_path: &Path,
    kind: WorkspaceFileItemKind,
    prefer_original_name: bool,
) -> Result<PathBuf, String> {
    let source_name = source_path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "Invalid source file name".to_string())?;

    if prefer_original_name {
        let original_destination = target_directory.join(source_name);
        if !original_destination.exists() {
            return Ok(original_destination);
        }
    }

    for counter in 0..=999u32 {
        let destination_name = build_copy_destination_name(source_path, kind, counter)?;
        let destination = target_directory.join(destination_name);
        if !destination.exists() {
            return Ok(destination);
        }
    }

    Err("Too many copies exist".to_string())
}

fn copy_workspace_item_to_directory(
    canonical_root: &Path,
    source_path: &Path,
    source_kind: WorkspaceFileItemKind,
    target_directory: &Path,
    prefer_original_name: bool,
) -> Result<WorkspaceFileOperationResult, String> {
    if source_kind == WorkspaceFileItemKind::Folder && target_directory.starts_with(source_path) {
        return Err("Cannot copy a folder into itself or its descendant.".to_string());
    }

    let destination = resolve_collision_safe_destination(
        target_directory,
        source_path,
        source_kind,
        prefer_original_name,
    )?;

    match source_kind {
        WorkspaceFileItemKind::Folder => copy_dir_recursive(source_path, &destination)?,
        WorkspaceFileItemKind::File => {
            std::fs::copy(source_path, &destination)
                .map_err(|err| format!("Failed to copy file: {err}"))?;
        }
    }

    Ok(WorkspaceFileOperationResult {
        path: relative_path_from_absolute(canonical_root, &destination)?,
        kind: source_kind,
    })
}

fn copy_dir_recursive(src: &std::path::Path, dst: &std::path::Path) -> Result<(), String> {
    std::fs::create_dir_all(dst).map_err(|err| format!("Failed to create directory: {err}"))?;
    for entry in std::fs::read_dir(src).map_err(|err| format!("Failed to read directory: {err}"))? {
        let entry = entry.map_err(|err| format!("Failed to read entry: {err}"))?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());
        let file_type = std::fs::symlink_metadata(&src_path)
            .map_err(|err| format!("Failed to read entry metadata: {err}"))?
            .file_type();
        if file_type.is_symlink() {
            return Err("Cannot copy symbolic links in workspace directories.".to_string());
        }
        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            std::fs::copy(&src_path, &dst_path)
                .map_err(|err| format!("Failed to copy file: {err}"))?;
        }
    }
    Ok(())
}

#[cfg(test)]
#[path = "files/tests.rs"]
mod tests;
