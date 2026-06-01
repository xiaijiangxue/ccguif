## Platform Compatibility Evidence

Date: 2026-05-26

Scope covered in code:

- Graph rendering is pure React + SVG/HTML and does not branch on platform.
- Project-map storage key normalization treats `\` and `/` as equivalent before hashing.
- Frontend project-map file paths are serialized with `/` as logical relative paths only; native Rust resolves them with `PathBuf`.
- Rust command `project_map_write_snapshot` constrains writes to the derived `.ccgui/project-map/<project-name>-<short-hash>/` root and validates relative path components with `std::path::Component`.
- Rust writes use same-directory temp file + `fs::rename` atomic commit.

Executed evidence:

- `cargo test --manifest-path src-tauri/Cargo.toml project_map --lib`
  - covers platform separator normalization.
  - covers constrained project-map write relative paths.
  - covers project name sanitization fallback.

Coverage qualifier:

- This is code-level compatibility evidence, not packaged-app manual verification.
- Windows/macOS/Linux manual smoke should be repeated when project-map persistence is wired into packaged release QA.
