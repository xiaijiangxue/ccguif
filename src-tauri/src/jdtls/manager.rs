use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Instant;

use log::*;
use tokio::io::AsyncBufReadExt;
use tokio::process::Command;
use tokio::sync::Mutex;

use super::lsp_client::LspClient;
use super::types::{
    ClientCapabilities, InitializeParams, JdtlsStatus, TextDocumentClientCapabilities,
    TextDocumentSyncClientCapabilities, IDLE_SHUTDOWN_MS,
};

/// Process lifecycle manager for the Eclipse JDT Language Server.
pub struct JdtlsManager {
    lsp_client: Option<Arc<Mutex<LspClient>>>,
    child: Option<tokio::process::Child>,
    status: String,
    /// Tracked open files: textDocument URI -> version.
    open_files: HashMap<String, i32>,
    last_request: Option<Instant>,
    launcher_path: PathBuf,
    data_dir: PathBuf,
    start_time: Option<Instant>,
    java_path: Option<PathBuf>,
    error: Option<String>,
    idle_flag: Arc<AtomicBool>,
    idle_handle: Option<tokio::task::JoinHandle<()>>,
    /// User-configured JDK path for JDTLS (overrides auto-detection).
    configured_java_path: Option<PathBuf>,
}

impl JdtlsManager {
    /// Create a new manager in the unavailable state.
    /// Resolves the JDTLS launcher jar and data directory automatically.
    pub fn new(cache_dir: PathBuf) -> Self {
        let launcher_path = find_launcher_jar_in_cache(&cache_dir);
        let idle_flag = Arc::new(AtomicBool::new(false));
        Self {
            lsp_client: None,
            child: None,
            status: "unavailable".into(),
            open_files: HashMap::new(),
            last_request: None,
            launcher_path,
            data_dir: cache_dir.join("data"),
            start_time: None,
            java_path: None,
            error: None,
            idle_flag,
            idle_handle: None,
            configured_java_path: None,
        }
    }

    /// Set a user-configured JDK path for JDTLS.
    pub fn set_java_path(&mut self, path: Option<PathBuf>) {
        self.configured_java_path = path;
    }


    /// Ensure the JDTLS server is running and ready to accept requests.
    /// Ensure JDTLS is running for the given workspace. Starts it if not.
    pub async fn ensure_started(
        &mut self,
        workspace_root: &Path,
        _file_path: &str,
    ) -> Result<(), String> {
        if let Some(ref mut child) = self.child {
            match child.try_wait() {
                Ok(Some(exit)) => {
                    warn!("[jdtls] process exited unexpectedly: {exit:?}");
                    self.lsp_client = None;
                    self.child = None;
                    self.start_time = None;
                    self.status = "unavailable".into();
                    self.error = Some(format!("process exited: {exit:?}"));
                }
                Ok(None) => {}
                Err(e) => warn!("[jdtls] failed to check process status: {e}"),
            }
        }
        if self.status == "ready" && self.lsp_client.is_some() {
            return Ok(());
        }
        self.start(workspace_root).await
    }

    /// Shut down any running JDTLS instance.
    pub async fn cleanup(state: &crate::state::AppState) {
        let mut manager = state.jdtls_manager.lock().await;
        if let Err(e) = manager.stop().await {
            warn!("[jdtls] cleanup error: {e}");
        }
    }

    pub fn track_open_file(&mut self, uri: String) {
        self.open_files.insert(uri, 1);
    }

    pub fn untrack_open_file(&mut self, uri: &str) {
        self.open_files.remove(uri);
    }

    pub async fn send_request(
        &self,
        method: &str,
        params: serde_json::Value,
    ) -> Result<serde_json::Value, String> {
        let client = self
            .lsp_client
            .as_ref()
            .ok_or_else(|| format!("JDTLS not running (status: {})", self.status))?;
        client
            .lock()
            .await
            .send_request(method, Some(params))
            .await
    }

    pub async fn send_notification(
        &mut self,
        method: &str,
        params: serde_json::Value,
    ) -> Result<(), String> {
        let client = self
            .lsp_client
            .as_ref()
            .ok_or_else(|| format!("JDTLS not running (status: {})", self.status))?;
        let result = client
            .lock()
            .await
            .send_notification(method, Some(params))
            .await;
        self.last_request = Some(Instant::now());
        result
    }

    pub fn get_status(&self) -> JdtlsStatus {
        JdtlsStatus {
            status: self.status.clone(),
            java_version: self.java_path.as_ref().map(|p| p.display().to_string()),
            jdtls_path: Some(self.launcher_path.display().to_string()),
            error: self.error.clone(),
            uptime_seconds: self.start_time.map(|t| t.elapsed().as_secs()),
            open_files_count: self.open_files.len(),
        }
    }

    /// Start the JDTLS process and complete the LSP initialization handshake.
    async fn start(&mut self, workspace_root: &Path) -> Result<(), String> {
        if self.child.is_some() || self.lsp_client.is_some() {
            info!("[jdtls] stopping existing instance before restart");
            self.stop().await.ok();
        }

        self.status = "starting".into();
        self.error = None;

        // 1. Find java binary with JDK >= 17.
        let java_path = self.find_java_binary().await?;
        self.java_path = Some(java_path.clone());

        // 3. Resolve config directory.
        let install_dir = self.launcher_path.parent().and_then(|p| p.parent());
        let config_dir = match install_dir {
            Some(dir) => dir.join(os_config_dir()),
            None => {
                self.status = "unavailable".into();
                let msg: String = "could not resolve JDTLS install directory".into();
                self.error = Some(msg.clone());
                return Err(msg);
            }
        };

        // 4. Create data directory.
        let project_hash = compute_project_hash(workspace_root);
        let data_dir = self.data_dir.join(&project_hash);
        tokio::fs::create_dir_all(&data_dir)
            .await
            .map_err(|e| {
                self.status = "unavailable".into();
                let msg = format!("failed to create data dir: {e}");
                self.error = Some(msg.clone());
                msg
            })?;

        // 5. Spawn JDTLS process.
        if !self.launcher_path.exists() {
            info!("[jdtls] launcher JAR not found, attempting auto-download...");
            self.status = "downloading".into();
            self.error = Some("Downloading JDTLS...".into());

            let install_dir = self.launcher_path.parent().and_then(|p| p.parent());
            if let Some(server_dir) = install_dir {
                match download_jdtls(server_dir).await {
                    Ok(()) => {
                        // Re-scan for launcher JAR
                        if let Some(jar) = find_jar_in_dir(&server_dir.join("plugins")) {
                            self.launcher_path = jar;
                            info!("[jdtls] auto-download complete, launcher: {}", self.launcher_path.display());
                        } else {
                            self.status = "unavailable".into();
                            let msg = "JDTLS downloaded but launcher JAR not found".to_string();
                            self.error = Some(msg.clone());
                            return Err(msg);
                        }
                    }
                    Err(e) => {
                        self.status = "unavailable".into();
                        let msg = format!("Failed to download JDTLS: {e}\n\n\
                            Please install manually:\n\
                            1. brew install jdtls\n\
                            2. Or download from: https://download.eclipse.org/jdtls/snapshots/\n\
                            3. Extract to ~/.ccgui/jdtls/server/");
                        self.error = Some(msg.clone());
                        return Err(msg);
                    }
                }
            } else {
                self.status = "unavailable".into();
                let msg = "Could not determine JDTLS install directory".to_string();
                self.error = Some(msg.clone());
                return Err(msg);
            }
        }

        let mut cmd = Command::new(&java_path);
        cmd.arg("-Declipse.application=org.eclipse.jdt.ls.core.id1")
            .arg("-Dosgi.bundles.defaultStartLevel=4")
            .arg("-Declipse.product=org.eclipse.jdt.ls.core.product")
            .arg("-Xmx1G")
            .arg("-jar")
            .arg(&self.launcher_path)
            .arg("-configuration")
            .arg(&config_dir)
            .arg("-data")
            .arg(&data_dir)
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped());

        #[cfg(unix)]
        unsafe {
            cmd.pre_exec(|| {
                libc::setsid();
                Ok(())
            });
        }

        let mut child = cmd.spawn().map_err(|e| {
            self.status = "unavailable".into();
            let msg = format!("failed to spawn JDTLS: {e}");
            self.error = Some(msg.clone());
            msg
        })?;
        info!("[jdtls] spawned pid={}", child.id().unwrap_or(0));

        // 6. Pipe stderr to log.
        if let Some(stderr) = child.stderr.take() {
            tokio::spawn(async move {
                let mut reader = tokio::io::BufReader::new(stderr);
                let mut line = String::new();
                while let Ok(n) = reader.read_line(&mut line).await {
                    if n == 0 {
                        break;
                    }
                    debug!("[jdtls:stderr] {}", line.trim_end());
                    line.clear();
                }
            });
        }

        let stdin = child.stdin.take().ok_or_else(|| {
            self.status = "unavailable".into();
            "failed to capture JDTLS stdin".to_string()
        })?;
        let stdout = child.stdout.take().ok_or_else(|| {
            self.status = "unavailable".into();
            "failed to capture JDTLS stdout".to_string()
        })?;

        // 7. Build LSP client and start reader.
        let client = Arc::new(Mutex::new(LspClient::new(stdin)));
        client.lock().await.start_reader(stdout);

        // 8. LSP initialize handshake.
        let root_uri = Some(format!("file://{}", workspace_root.display()));
        let init_params = serde_json::to_value(InitializeParams {
            process_id: Some(std::process::id()),
            root_uri,
            capabilities: ClientCapabilities {
                text_document: TextDocumentClientCapabilities {
                    definition: Some(serde_json::json!({})),
                    references: Some(serde_json::json!({})),
                    implementation: Some(serde_json::json!({})),
                    diagnostic: Some(serde_json::json!({})),
                    hover: Some(serde_json::json!({})),
                    synchronization: Some(TextDocumentSyncClientCapabilities {
                        dynamic_registration: Some(false),
                    }),
                },
            },
            initialization_options: None,
        })
        .map_err(|e| {
            self.status = "unavailable".into();
            let msg = format!("failed to serialize init params: {e}");
            self.error = Some(msg.clone());
            msg
        })?;

        info!("[jdtls] sending initialize");
        client
            .lock()
            .await
            .send_request("initialize", Some(init_params))
            .await
            .map_err(|e| {
                self.status = "unavailable".into();
                let msg = format!("initialize failed: {e}");
                self.error = Some(msg.clone());
                msg
            })?;

        info!("[jdtls] sending initialized");
        client
            .lock()
            .await
            .send_notification("initialized", Some(serde_json::json!({})))
            .await
            .map_err(|e| {
                self.status = "unavailable".into();
                let msg = format!("initialized failed: {e}");
                self.error = Some(msg.clone());
                msg
            })?;

        // 9. Send didChangeConfiguration.
        let config = serde_json::json!({
            "java": {
                "configuration": { "updateBuildConfiguration": "automatic" },
                "jdt": { "autobuild": { "enabled": false } },
            },
            "extendedClientCapabilities": {
                "classFileContentsSupport": true,
            },
        });
        if let Err(e) = client
            .lock()
            .await
            .send_notification(
                "workspace/didChangeConfiguration",
                Some(serde_json::json!({ "settings": config })),
            )
            .await
        {
            warn!("[jdtls] didChangeConfiguration failed (non-fatal): {e}");
        }

        // 10. Transition to ready.
        self.start_idle_timer();
        self.lsp_client = Some(client);
        self.child = Some(child);
        self.start_time = Some(Instant::now());
        self.last_request = Some(Instant::now());
        self.status = "ready".into();
        self.error = None;
        info!("[jdtls] ready");
        Ok(())
    }

    async fn stop(&mut self) -> Result<(), String> {
        if let Some(handle) = self.idle_handle.take() {
            handle.abort();
        }

        if let Some(ref client_arc) = self.lsp_client {
            let client_arc = client_arc.clone();
            {
                let client = client_arc.lock().await;
                let _ = tokio::time::timeout(
                    std::time::Duration::from_secs(3),
                    client.send_request("shutdown", Some(serde_json::Value::Null)),
                )
                .await;
            }
            {
                let client = client_arc.lock().await;
                let _ = tokio::time::timeout(
                    std::time::Duration::from_secs(1),
                    client.send_notification("exit", Some(serde_json::Value::Null)),
                )
                .await;
            }
        }

        if let Some(mut child) = self.child.take() {
            let _ = child.kill().await;
            info!("[jdtls] process killed");
        }

        self.lsp_client = None;
        self.start_time = None;
        self.last_request = None;
        self.open_files.clear();
        self.status = "stopped".into();
        self.error = None;
        Ok(())
    }

    /// Find a suitable JDK 17+ binary for JDTLS.
    /// Priority: configured path → auto-scan → JAVA_HOME (if >= 17) → which java
    async fn find_java_binary(&mut self) -> Result<PathBuf, String> {
        // 1. User-configured path takes highest priority.
        if let Some(ref path) = self.configured_java_path.clone() {
            if path.exists() {
                info!("[jdtls] using configured java path: {}", path.display());
                return self.validate_java_version(path).await;
            }
            warn!("[jdtls] configured java path not found: {}", path.display());
        }

        // 2. Auto-scan for JDK 17+ (macOS java_home, common paths).
        if let Some(java_path) = scan_jdk17_plus() {
            info!("[jdtls] auto-scanned java: {}", java_path.display());
            return self.validate_java_version(&java_path).await;
        }

        // 3. Check JAVA_HOME (only if >= 17).
        if let Ok(java_home) = std::env::var("JAVA_HOME") {
            let java_bin = PathBuf::from(&java_home).join("bin/java");
            if java_bin.exists() && is_java_17_plus(&java_bin) {
                info!("[jdtls] using JAVA_HOME: {}", java_bin.display());
                return Ok(java_bin);
            }
            info!("[jdtls] JAVA_HOME is not JDK 17+, skipping: {}", java_home);
        }

        // 4. Fall back to whatever `java` is in PATH.
        let java_path = which::which("java").map_err(|e| {
            self.status = "unavailable".into();
            let msg = format!("java not found: {e}");
            self.error = Some(msg.clone());
            msg
        })?;
        info!("[jdtls] fallback to PATH java: {}", java_path.display());
        self.validate_java_version(&java_path).await
    }

    /// Validate that a java binary is JDK >= 17 and return its path.
    async fn validate_java_version(&mut self, java_path: &Path) -> Result<PathBuf, String> {
        let version_output = get_java_version(java_path).await.map_err(|e| {
            self.status = "unavailable".into();
            let msg = format!("failed to run java version check: {e}");
            self.error = Some(msg.clone());
            msg
        })?;

        let version_text = java_version_output_text(&version_output);
        let version_line = version_text
            .lines()
            .find(|line| !line.trim().is_empty())
            .unwrap_or("")
            .to_string();
        info!("[jdtls] {version_line}");

        match parse_java_major(&version_line) {
            Some(major) if major >= 17 => Ok(java_path.to_path_buf()),
            Some(major) => {
                self.status = "unavailable".into();
                let msg = format!("Java >= 17 required, found version {major}");
                self.error = Some(msg.clone());
                Err(msg)
            }
            None => {
                warn!("[jdtls] could not parse java version: {version_line}");
                // Proceed anyway — might work
                Ok(java_path.to_path_buf())
            }
        }
    }

    fn start_idle_timer(&mut self) {
        if let Some(handle) = self.idle_handle.take() {
            handle.abort();
        }
        let flag = Arc::clone(&self.idle_flag);
        let duration = std::time::Duration::from_millis(IDLE_SHUTDOWN_MS);
        let handle = tokio::spawn(async move {
            tokio::time::sleep(duration).await;
            flag.store(true, Ordering::SeqCst);
        });
        self.idle_handle = Some(handle);
    }
}

// ── Helpers ─────────────────────────────────────────────────────

fn os_config_dir() -> &'static str {
    match std::env::consts::OS {
        "macos" => "config_mac",
        "linux" => "config_linux",
        "windows" => "config_win",
        _ => "config_linux",
    }
}

fn find_launcher_jar_in_cache(cache_dir: &Path) -> PathBuf {
    // Try JDTLS_HOME env
    if let Ok(home) = std::env::var("JDTLS_HOME") {
        if let Some(jar) = find_jar_in_dir(&PathBuf::from(&home).join("plugins")) {
            return jar;
        }
    }
    // Try ~/.ccgui/jdtls/server/
    if let Ok(home) = std::env::var("HOME") {
        let path = PathBuf::from(home).join(".ccgui/jdtls/server/plugins");
        if let Some(jar) = find_jar_in_dir(&path) {
            return jar;
        }
    }
    // Try cache_dir/server/
    let path = cache_dir.join("server/plugins");
    if let Some(jar) = find_jar_in_dir(&path) {
        return jar;
    }
    // Return a placeholder path (will fail at runtime with clear error)
    cache_dir.join("server/plugins/org.eclipse.equinox.launcher_0.0.0.jar")
}

fn find_jar_in_dir(dir: &Path) -> Option<PathBuf> {
    let entries = std::fs::read_dir(dir).ok()?;
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with("org.eclipse.equinox.launcher_") && name.ends_with(".jar") {
            return Some(entry.path());
        }
    }
    None
}

fn compute_project_hash(root: &Path) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(root.to_string_lossy().as_bytes());
    let result = hasher.finalize();
    result[..8].iter().map(|b| format!("{b:02x}")).collect()
}

/// Download and extract JDTLS to the target directory.
async fn download_jdtls(target_dir: &Path) -> Result<(), String> {
    // 1.43.0 is the last JDTLS line compatible with a JDK 17 runtime.
    // 1.44+ requires Java 21 to resolve core language-server bundles.
    let version = "1.43.0";
    let build_id = "202412191447";
    let url = format!(
        "https://download.eclipse.org/jdtls/milestones/{version}/jdt-language-server-{version}-{build_id}.tar.gz"
    );

    info!("[jdtls] downloading from {url}");
    std::fs::create_dir_all(target_dir)
        .map_err(|e| format!("Failed to create JDTLS install dir {}: {e}", target_dir.display()))?;

    // Create temp file for download
    let temp_dir = std::env::temp_dir().join(format!("jdtls-download-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&temp_dir).map_err(|e| format!("Failed to create temp dir: {e}"))?;
    let tarball = temp_dir.join("jdtls.tar.gz");

    // Download with reqwest
    let response = reqwest::get(&url)
        .await
        .map_err(|e| format!("Download failed: {e}"))?;

    if !response.status().is_success() {
        std::fs::remove_dir_all(&temp_dir).ok();
        return Err(format!("Download failed with status: {}", response.status()));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read response: {e}"))?;

    std::fs::write(&tarball, &bytes)
        .map_err(|e| format!("Failed to write tarball: {e}"))?;

    info!("[jdtls] downloaded {} bytes, extracting...", bytes.len());

    // Extract tarball
    let status = std::process::Command::new("tar")
        .arg("-xzf")
        .arg(&tarball)
        .arg("-C")
        .arg(target_dir)
        .status()
        .map_err(|e| format!("Failed to run tar: {e}"))?;

    if !status.success() {
        std::fs::remove_dir_all(&temp_dir).ok();
        return Err(format!("tar extraction failed with status: {status}"));
    }

    // Cleanup
    std::fs::remove_dir_all(&temp_dir).ok();

    info!("[jdtls] extraction complete to {}", target_dir.display());
    Ok(())
}

fn parse_java_major(version_output: &str) -> Option<u32> {
    if let Some(quoted) = version_output.split('"').nth(1) {
        return parse_java_major_token(quoted);
    }

    version_output
        .split_whitespace()
        .find_map(parse_java_major_token)
}

fn parse_java_major_token(version_token: &str) -> Option<u32> {
    let ver = version_token.trim();
    let first = ver.split('.').next()?;
    let major: u32 = first.parse().ok()?;
    if major == 1 {
        // Old format: 1.8.0 -> major is 8
        ver.split('.').nth(1)?.parse().ok()
    } else {
        Some(major)
    }
}

fn java_version_output_text(output: &std::process::Output) -> String {
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    format!("{stdout}\n{stderr}")
}

/// Run `java -version` and return the output (works for both JDK 8 and 9+).
async fn get_java_version(java_path: &Path) -> Result<std::process::Output, std::io::Error> {
    // Try --version first (JDK 9+), fall back to -version (JDK 8).
    let output = Command::new(java_path)
        .arg("--version")
        .output()
        .await?;

    let version_text = java_version_output_text(&output);
    if !output.status.success()
        || version_text.contains("Unrecognized option")
        || parse_java_major(&version_text).is_none()
    {
        // JDK 8: use -version
        Command::new(java_path)
            .arg("-version")
            .output()
            .await
    } else {
        Ok(output)
    }
}

/// Auto-scan for installed JDK 17+ binaries on the system.
fn scan_jdk17_plus() -> Option<PathBuf> {
    // macOS: use /usr/libexec/java_home to list installed JDKs
    #[cfg(target_os = "macos")]
    {
        if let Ok(output) = std::process::Command::new("/usr/libexec/java_home")
            .arg("-V")
            .output()
        {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let stderr = String::from_utf8_lossy(&output.stderr);
            // java_home -V outputs to stderr
            for line in stderr.lines().chain(stdout.lines()) {
                if let Some(start) = line.find('/') {
                    let path = if let Some(end) = line[start..].find(' ') {
                        PathBuf::from(&line[start..start + end])
                    } else {
                        PathBuf::from(&line[start..])
                    };
                    let java_bin = path.join("bin/java");
                    if java_bin.exists() && is_java_17_plus(&java_bin) {
                        return Some(java_bin);
                    }
                }
            }
        }
    }

    // Common JDK installation paths
    let search_paths: Vec<PathBuf> = vec![
        // macOS User-installed JDKs
        dirs()
            .map(|d| d.join("Library/Java/JavaVirtualMachines"))
            .unwrap_or_default(),
        // macOS System JDKs
        PathBuf::from("/Library/Java/JavaVirtualMachines"),
        // Linux common paths
        PathBuf::from("/usr/lib/jvm"),
        // Windows (Program Files)
        dirs()
            .map(|d| d.join("Program Files/Java"))
            .unwrap_or_default(),
    ];

    for base in &search_paths {
        if let Ok(entries) = std::fs::read_dir(base) {
            for entry in entries.flatten() {
                let java_bin = if cfg!(target_os = "macos") {
                    entry.path().join("Contents/Home/bin/java")
                } else {
                    entry.path().join("bin/java")
                };
                if java_bin.exists() && is_java_17_plus(&java_bin) {
                    return Some(java_bin);
                }
            }
        }
    }

    None
}

/// Quick check if a java binary is JDK >= 17 by running `java --version`.
fn is_java_17_plus(java_path: &Path) -> bool {
    let output = match std::process::Command::new(java_path)
        .arg("--version")
        .output()
    {
        Ok(o) => o,
        Err(_) => {
            // Try -version for JDK 8
            let output = match std::process::Command::new(java_path)
                .arg("-version")
                .output()
            {
                Ok(o) => o,
                Err(_) => return false,
            };
            let version_text = java_version_output_text(&output);
            return parse_java_major(&version_text).map_or(false, |m| m >= 17);
        }
    };
    let version_text = java_version_output_text(&output);
    parse_java_major(&version_text).map_or(false, |m| m >= 17)
}

/// Get the user's home directory.
fn dirs() -> Option<PathBuf> {
    std::env::var("HOME")
        .ok()
        .map(PathBuf::from)
        .or_else(|| std::env::var("USERPROFILE").ok().map(PathBuf::from))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_java_major_new_style() {
        assert_eq!(parse_java_major(r#"openjdk version "17.0.2" 2022-01-18"#), Some(17));
        assert_eq!(parse_java_major(r#"openjdk version "21.0.1" 2023-10-17"#), Some(21));
        assert_eq!(parse_java_major(r#"java version "11.0.18" 2023-02-15"#), Some(11));
        assert_eq!(parse_java_major(r#"openjdk 17.0.18 2026-01-20 LTS"#), Some(17));
    }

    #[test]
    fn parse_java_major_old_style() {
        assert_eq!(parse_java_major(r#"java version "1.8.0_361"#), Some(8));
        assert_eq!(parse_java_major(r#"java version "1.7.0_251"#), Some(7));
    }

    #[test]
    fn parse_java_major_invalid() {
        assert_eq!(parse_java_major(""), None);
        assert_eq!(parse_java_major("not a version string"), None);
    }

    #[test]
    fn java_version_output_text_combines_stdout_and_stderr() {
        let output = std::process::Output {
            status: exit_status(0),
            stdout: b"openjdk version \"17.0.18\" 2026-01-20 LTS\n".to_vec(),
            stderr: Vec::new(),
        };

        assert_eq!(parse_java_major(&java_version_output_text(&output)), Some(17));
    }

    #[test]
    fn java_version_output_text_preserves_jdk8_stderr_version() {
        let output = std::process::Output {
            status: exit_status(0),
            stdout: Vec::new(),
            stderr: b"java version \"1.8.0_472\"\n".to_vec(),
        };

        assert_eq!(parse_java_major(&java_version_output_text(&output)), Some(8));
    }

    #[test]
    fn os_config_dir_returns_valid_value() {
        let dir = os_config_dir();
        assert!(["config_mac", "config_linux", "config_win"].contains(&dir));
    }

    #[test]
    fn compute_project_hash_deterministic() {
        let path = PathBuf::from("/tmp/test-project");
        let h1 = compute_project_hash(&path);
        let h2 = compute_project_hash(&path);
        assert_eq!(h1, h2);
        assert_eq!(h1.len(), 16); // 8 bytes * 2 hex chars
    }

    #[test]
    fn compute_project_hash_different_for_different_paths() {
        let h1 = compute_project_hash(&PathBuf::from("/tmp/project-a"));
        let h2 = compute_project_hash(&PathBuf::from("/tmp/project-b"));
        assert_ne!(h1, h2);
    }

    #[test]
    fn find_jar_in_dir_returns_none_for_empty_dir() {
        let dir = std::env::temp_dir().join(format!("jdtls-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        assert!(find_jar_in_dir(&dir).is_none());
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn find_jar_in_dir_finds_launcher_jar() {
        let dir = std::env::temp_dir().join(format!("jdtls-test-{}", uuid::Uuid::new_v4()));
        let plugins = dir.join("plugins");
        std::fs::create_dir_all(&plugins).unwrap();
        std::fs::write(plugins.join("org.eclipse.equinox.launcher_1.2.3.jar"), "").unwrap();
        let result = find_jar_in_dir(&plugins);
        assert!(result.is_some());
        assert!(result.unwrap().to_string_lossy().contains("equinox.launcher"));
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn find_jar_in_dir_ignores_non_launcher_jars() {
        let dir = std::env::temp_dir().join(format!("jdtls-test-{}", uuid::Uuid::new_v4()));
        let plugins = dir.join("plugins");
        std::fs::create_dir_all(&plugins).unwrap();
        std::fs::write(plugins.join("some-other.jar"), "").unwrap();
        assert!(find_jar_in_dir(&plugins).is_none());
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn manager_new_starts_unavailable() {
        let dir = std::env::temp_dir().join(format!("jdtls-test-{}", uuid::Uuid::new_v4()));
        let manager = JdtlsManager::new(dir);
        let status = manager.get_status();
        assert_eq!(status.status, "unavailable");
        assert_eq!(status.open_files_count, 0);
        assert!(status.uptime_seconds.is_none());
    }

    #[test]
    fn track_untrack_open_files() {
        let dir = std::env::temp_dir().join(format!("jdtls-test-{}", uuid::Uuid::new_v4()));
        let mut manager = JdtlsManager::new(dir);
        manager.track_open_file("file:///test/Foo.java".into());
        assert_eq!(manager.get_status().open_files_count, 1);
        manager.track_open_file("file:///test/Bar.java".into());
        assert_eq!(manager.get_status().open_files_count, 2);
        manager.untrack_open_file("file:///test/Foo.java");
        assert_eq!(manager.get_status().open_files_count, 1);
        manager.untrack_open_file("file:///test/Bar.java");
        assert_eq!(manager.get_status().open_files_count, 0);
    }

    #[cfg(unix)]
    fn exit_status(code: i32) -> std::process::ExitStatus {
        use std::os::unix::process::ExitStatusExt;
        std::process::ExitStatus::from_raw(code)
    }

    #[cfg(windows)]
    fn exit_status(code: u32) -> std::process::ExitStatus {
        use std::os::windows::process::ExitStatusExt;
        std::process::ExitStatus::from_raw(code)
    }
}
