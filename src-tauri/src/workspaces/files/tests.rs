use super::{
    compile_search_regex, create_workspace_directory_inner, duplicate_workspace_item_inner,
    is_special_directory_path, list_external_absolute_directory_children_inner,
    list_external_spec_tree_inner, list_workspace_directory_children_inner,
    list_workspace_files_inner, normalize_workspace_relative_directory_path,
    normalize_workspace_relative_path, paste_workspace_item_inner,
    read_external_absolute_file_inner, read_external_spec_file_inner,
    read_workspace_file_inner, rename_workspace_item_inner,
    resolve_external_absolute_preview_handle_inner, resolve_external_spec_preview_handle_inner,
    resolve_workspace_preview_handle_inner, search_workspace_text_inner,
    sort_and_truncate_named_entries, write_external_absolute_file_inner,
    WorkspaceDirectoryChildState, WorkspaceScanState, WorkspaceTextSearchOptions,
};
use crate::utils::normalize_git_path;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

#[test]
fn special_directory_path_detection_supports_dependency_dirs() {
    assert!(is_special_directory_path("node_modules"));
    assert!(is_special_directory_path("apps/web/node_modules"));
    assert!(is_special_directory_path("tools/.pnpm-store"));
    assert!(is_special_directory_path("sdk/.m2"));
    assert!(is_special_directory_path("rust/.cargo"));
}

#[test]
fn special_directory_path_detection_supports_build_dirs() {
    assert!(is_special_directory_path("target"));
    assert!(is_special_directory_path("packages/ui/dist"));
    assert!(is_special_directory_path("service/build"));
    assert!(is_special_directory_path("native/cmake-build-debug"));
    assert!(is_special_directory_path("cache/.turbo"));
}

#[test]
fn special_directory_path_detection_does_not_match_source_or_docs() {
    assert!(!is_special_directory_path("src"));
    assert!(!is_special_directory_path("docs"));
    assert!(!is_special_directory_path("apps/web/src"));
}

#[test]
fn normalize_workspace_relative_path_rejects_empty_or_escaped_inputs() {
    assert!(normalize_workspace_relative_path("").is_err());
    assert!(normalize_workspace_relative_path("/").is_err());
    assert!(normalize_workspace_relative_path("../outside").is_err());
    assert!(normalize_workspace_relative_path("./local").is_err());
    assert!(normalize_workspace_relative_path(".git/config").is_err());
}

#[test]
fn normalize_workspace_relative_path_accepts_regular_relative_path() {
    assert_eq!(
        normalize_workspace_relative_path("src/main.ts").expect("valid relative path"),
        "src/main.ts".to_string()
    );
}

#[test]
fn normalize_workspace_relative_directory_path_accepts_root_sentinel() {
    assert_eq!(
        normalize_workspace_relative_directory_path("").expect("root path"),
        ""
    );
    assert!(normalize_workspace_relative_directory_path("   ").is_err());
    assert!(normalize_workspace_relative_directory_path("/").is_err());
    assert!(normalize_workspace_relative_directory_path("../outside").is_err());
    assert!(normalize_workspace_relative_directory_path(".git/config").is_err());
}

#[test]
fn create_workspace_directory_creates_relative_directory() {
    let suffix = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("clock moved backwards")
        .as_nanos();
    let root = std::env::temp_dir().join(format!("mossx-dir-create-{suffix}"));
    std::fs::create_dir_all(&root).expect("create root");

    create_workspace_directory_inner(&PathBuf::from(&root), "docs").expect("create docs");
    assert!(root.join("docs").is_dir());

    std::fs::remove_dir_all(&root).expect("cleanup root");
}

#[test]
fn duplicate_workspace_item_preserves_extension_and_collision_suffix() {
    let root = std::env::temp_dir().join(format!("mossx-duplicate-{}", Uuid::new_v4()));
    std::fs::create_dir_all(root.join("src")).expect("create src");
    std::fs::write(root.join("src/index.ts"), "one").expect("write index");
    std::fs::write(root.join("src/index copy.ts"), "existing").expect("write copy");

    let result = duplicate_workspace_item_inner(&PathBuf::from(&root), "src/index.ts")
        .expect("duplicate file");

    assert_eq!(result.path, "src/index copy 1.ts");
    assert!(root.join("src/index copy 1.ts").is_file());

    std::fs::remove_dir_all(&root).expect("cleanup root");
}

#[test]
fn paste_workspace_item_copies_folder_to_target_directory() {
    let root = std::env::temp_dir().join(format!("mossx-paste-folder-{}", Uuid::new_v4()));
    std::fs::create_dir_all(root.join("src/components")).expect("create source");
    std::fs::create_dir_all(root.join("examples")).expect("create target");
    std::fs::write(root.join("src/components/Button.tsx"), "button").expect("write file");

    let result =
        paste_workspace_item_inner(&PathBuf::from(&root), "src/components", "examples")
            .expect("paste folder");

    assert_eq!(result.path, "examples/components");
    assert!(root.join("examples/components/Button.tsx").is_file());

    std::fs::remove_dir_all(&root).expect("cleanup root");
}

#[test]
fn paste_workspace_item_uses_copy_suffix_on_target_collision() {
    let root = std::env::temp_dir().join(format!("mossx-paste-collision-{}", Uuid::new_v4()));
    std::fs::create_dir_all(root.join("src")).expect("create source");
    std::fs::create_dir_all(root.join("examples/components")).expect("create existing target");
    std::fs::write(root.join("src/components.tsx"), "source").expect("write source");
    std::fs::write(root.join("examples/components.tsx"), "existing").expect("write target");

    let result =
        paste_workspace_item_inner(&PathBuf::from(&root), "src/components.tsx", "examples")
            .expect("paste file");

    assert_eq!(result.path, "examples/components copy.tsx");
    assert!(root.join("examples/components copy.tsx").is_file());

    std::fs::remove_dir_all(&root).expect("cleanup root");
}

#[test]
fn paste_workspace_item_rejects_folder_into_descendant() {
    let root = std::env::temp_dir().join(format!("mossx-paste-descendant-{}", Uuid::new_v4()));
    std::fs::create_dir_all(root.join("src/components")).expect("create dirs");

    let result = paste_workspace_item_inner(&PathBuf::from(&root), "src", "src/components");

    assert!(result.is_err());
    assert_eq!(
        result.err().as_deref(),
        Some("Cannot copy a folder into itself or its descendant.")
    );

    std::fs::remove_dir_all(&root).expect("cleanup root");
}

#[test]
fn rename_workspace_item_renames_file_and_rejects_conflict() {
    let root = std::env::temp_dir().join(format!("mossx-rename-{}", Uuid::new_v4()));
    std::fs::create_dir_all(root.join("docs")).expect("create docs");
    std::fs::write(root.join("docs/readme.md"), "readme").expect("write readme");
    std::fs::write(root.join("docs/guide.md"), "guide").expect("write guide");

    let conflict =
        rename_workspace_item_inner(&PathBuf::from(&root), "docs/readme.md", "guide.md");
    assert!(conflict.is_err());
    assert_eq!(
        conflict.err().as_deref(),
        Some("Target path already exists.")
    );

    let result =
        rename_workspace_item_inner(&PathBuf::from(&root), "docs/readme.md", "intro.md")
            .expect("rename file");
    assert_eq!(result.path, "docs/intro.md");
    assert!(root.join("docs/intro.md").is_file());

    std::fs::remove_dir_all(&root).expect("cleanup root");
}

#[test]
fn rename_workspace_item_rejects_path_like_basename() {
    let root = std::env::temp_dir().join(format!("mossx-rename-invalid-{}", Uuid::new_v4()));
    std::fs::create_dir_all(root.join("docs")).expect("create docs");
    std::fs::write(root.join("docs/readme.md"), "readme").expect("write readme");

    let result =
        rename_workspace_item_inner(&PathBuf::from(&root), "docs/readme.md", "../escape.md");

    assert!(result.is_err());
    assert_eq!(result.err().as_deref(), Some("Invalid item name."));

    std::fs::remove_dir_all(&root).expect("cleanup root");
}

#[test]
fn rename_workspace_item_rejects_windows_reserved_basename() {
    let root = std::env::temp_dir().join(format!("mossx-rename-windows-{}", Uuid::new_v4()));
    std::fs::create_dir_all(root.join("docs")).expect("create docs");
    std::fs::write(root.join("docs/readme.md"), "readme").expect("write readme");

    for name in ["CON", "aux.txt", "bad:name.md", "trailing."] {
        let result = rename_workspace_item_inner(&PathBuf::from(&root), "docs/readme.md", name);
        assert!(result.is_err(), "{name} should be rejected");
        assert_eq!(result.err().as_deref(), Some("Invalid item name."));
    }

    std::fs::remove_dir_all(&root).expect("cleanup root");
}

#[test]
fn compile_search_regex_respects_whole_word() {
    let regex = compile_search_regex(
        "code",
        &WorkspaceTextSearchOptions {
            case_sensitive: false,
            whole_word: true,
            is_regex: false,
            include_pattern: None,
            exclude_pattern: None,
            limit: None,
            cursor: None,
        },
    )
    .expect("regex");

    assert!(regex.is_match("code"));
    assert!(!regex.is_match("codemoss"));
}

#[test]
fn search_workspace_text_finds_matches_and_honors_include_pattern() {
    let root = std::env::temp_dir().join(format!("mossx-search-{}", Uuid::new_v4()));
    std::fs::create_dir_all(root.join("src")).expect("create src dir");
    std::fs::write(
        root.join("src/main.ts"),
        "const codemoss = 1;\nconst code = 2;\n",
    )
    .expect("write main.ts");
    std::fs::write(root.join("README.md"), "codemoss docs\n").expect("write readme");

    let response = search_workspace_text_inner(
        &root,
        "codemoss",
        &WorkspaceTextSearchOptions {
            case_sensitive: false,
            whole_word: false,
            is_regex: false,
            include_pattern: Some("src/**".to_string()),
            exclude_pattern: None,
            limit: None,
            cursor: None,
        },
    )
    .expect("search response");

    assert_eq!(response.file_count, 1);
    assert_eq!(response.match_count, 1);
    assert_eq!(response.files[0].path, "src/main.ts");
    assert_eq!(response.files[0].matches[0].line, 1);

    std::fs::remove_dir_all(&root).expect("cleanup root");
}

#[test]
fn search_workspace_text_paginates_matches_with_cursor() {
    let root = std::env::temp_dir().join(format!("mossx-search-page-{}", Uuid::new_v4()));
    std::fs::create_dir_all(root.join("src")).expect("create src dir");
    std::fs::write(
        root.join("src/main.ts"),
        "codemoss one\ncodemoss two\ncodemoss three\n",
    )
    .expect("write main.ts");

    let first = search_workspace_text_inner(
        &root,
        "codemoss",
        &WorkspaceTextSearchOptions {
            case_sensitive: false,
            whole_word: false,
            is_regex: false,
            include_pattern: Some("src/**".to_string()),
            exclude_pattern: None,
            limit: Some(2),
            cursor: None,
        },
    )
    .expect("first page");

    assert_eq!(first.file_count, 1);
    assert_eq!(first.match_count, 2);
    assert!(first.limit_hit);
    assert!(first.next_cursor.is_some());
    assert_eq!(first.files[0].matches[0].line, 1);
    assert_eq!(first.files[0].matches[1].line, 2);

    let second = search_workspace_text_inner(
        &root,
        "codemoss",
        &WorkspaceTextSearchOptions {
            case_sensitive: false,
            whole_word: false,
            is_regex: false,
            include_pattern: Some("src/**".to_string()),
            exclude_pattern: None,
            limit: Some(2),
            cursor: first.next_cursor,
        },
    )
    .expect("second page");

    assert_eq!(second.file_count, 1);
    assert_eq!(second.match_count, 1);
    assert!(!second.limit_hit);
    assert!(second.next_cursor.is_none());
    assert_eq!(second.files[0].matches[0].line, 3);

    std::fs::remove_dir_all(&root).expect("cleanup root");
}

#[test]
fn search_workspace_text_cursor_continues_across_files_without_duplicates() {
    let root = std::env::temp_dir().join(format!("mossx-search-cross-{}", Uuid::new_v4()));
    std::fs::create_dir_all(root.join("src")).expect("create src dir");
    std::fs::write(root.join("src/a.ts"), "codemoss a1\ncodemoss a2\n")
        .expect("write a");
    std::fs::write(root.join("src/b.ts"), "codemoss b1\ncodemoss b2\n")
        .expect("write b");

    let first = search_workspace_text_inner(
        &root,
        "codemoss",
        &WorkspaceTextSearchOptions {
            case_sensitive: false,
            whole_word: false,
            is_regex: false,
            include_pattern: Some("src/**".to_string()),
            exclude_pattern: None,
            limit: Some(3),
            cursor: None,
        },
    )
    .expect("first page");

    let seen_first = first
        .files
        .iter()
        .flat_map(|file| file.matches.iter().map(move |m| (file.path.as_str(), m.line)))
        .collect::<Vec<_>>();
    assert_eq!(seen_first, vec![("src/a.ts", 1), ("src/a.ts", 2), ("src/b.ts", 1)]);

    let second = search_workspace_text_inner(
        &root,
        "codemoss",
        &WorkspaceTextSearchOptions {
            case_sensitive: false,
            whole_word: false,
            is_regex: false,
            include_pattern: Some("src/**".to_string()),
            exclude_pattern: None,
            limit: Some(3),
            cursor: first.next_cursor,
        },
    )
    .expect("second page");

    let seen_second = second
        .files
        .iter()
        .flat_map(|file| file.matches.iter().map(move |m| (file.path.as_str(), m.line)))
        .collect::<Vec<_>>();
    assert_eq!(seen_second, vec![("src/b.ts", 2)]);

    std::fs::remove_dir_all(&root).expect("cleanup root");
}

#[test]
fn search_workspace_text_rejects_cursor_when_query_or_options_change() {
    let root = std::env::temp_dir().join(format!("mossx-search-stale-{}", Uuid::new_v4()));
    std::fs::create_dir_all(root.join("src")).expect("create src dir");
    std::fs::write(root.join("src/main.ts"), "codemoss one\ncodemoss two\n")
        .expect("write main");

    let first = search_workspace_text_inner(
        &root,
        "codemoss",
        &WorkspaceTextSearchOptions {
            case_sensitive: false,
            whole_word: false,
            is_regex: false,
            include_pattern: Some("src/**".to_string()),
            exclude_pattern: None,
            limit: Some(1),
            cursor: None,
        },
    )
    .expect("first page");

    let changed_query = search_workspace_text_inner(
        &root,
        "moss",
        &WorkspaceTextSearchOptions {
            case_sensitive: false,
            whole_word: false,
            is_regex: false,
            include_pattern: Some("src/**".to_string()),
            exclude_pattern: None,
            limit: Some(1),
            cursor: first.next_cursor.clone(),
        },
    )
    .expect("changed query response");

    assert!(changed_query.invalid_cursor);
    assert!(changed_query.files.is_empty());

    let changed_options = search_workspace_text_inner(
        &root,
        "codemoss",
        &WorkspaceTextSearchOptions {
            case_sensitive: false,
            whole_word: true,
            is_regex: false,
            include_pattern: Some("src/**".to_string()),
            exclude_pattern: None,
            limit: Some(1),
            cursor: first.next_cursor,
        },
    )
    .expect("changed options response");

    assert!(changed_options.invalid_cursor);
    assert!(changed_options.files.is_empty());

    std::fs::remove_dir_all(&root).expect("cleanup root");
}

#[test]
fn search_workspace_text_rejects_cursor_when_cursor_file_changes() {
    let root = std::env::temp_dir().join(format!("mossx-search-modified-{}", Uuid::new_v4()));
    std::fs::create_dir_all(root.join("src")).expect("create src dir");
    let target = root.join("src/main.ts");
    std::fs::write(&target, "codemoss one\ncodemoss two\n").expect("write main");

    let first = search_workspace_text_inner(
        &root,
        "codemoss",
        &WorkspaceTextSearchOptions {
            case_sensitive: false,
            whole_word: false,
            is_regex: false,
            include_pattern: Some("src/**".to_string()),
            exclude_pattern: None,
            limit: Some(1),
            cursor: None,
        },
    )
    .expect("first page");

    std::fs::write(&target, "codemoss one\nchanged\n").expect("modify main");

    let second = search_workspace_text_inner(
        &root,
        "codemoss",
        &WorkspaceTextSearchOptions {
            case_sensitive: false,
            whole_word: false,
            is_regex: false,
            include_pattern: Some("src/**".to_string()),
            exclude_pattern: None,
            limit: Some(1),
            cursor: first.next_cursor,
        },
    )
    .expect("second page");

    assert!(second.invalid_cursor);
    assert!(second.files.is_empty());

    std::fs::remove_dir_all(&root).expect("cleanup root");
}

#[test]
fn search_workspace_text_rejects_malformed_cursor_without_error() {
    let root = std::env::temp_dir().join(format!("mossx-search-bad-cursor-{}", Uuid::new_v4()));
    std::fs::create_dir_all(root.join("src")).expect("create src dir");
    std::fs::write(root.join("src/main.ts"), "codemoss one\n").expect("write main");

    let response = search_workspace_text_inner(
        &root,
        "codemoss",
        &WorkspaceTextSearchOptions {
            case_sensitive: false,
            whole_word: false,
            is_regex: false,
            include_pattern: Some("src/**".to_string()),
            exclude_pattern: None,
            limit: Some(1),
            cursor: Some("not-a-valid-search-cursor".to_string()),
        },
    )
    .expect("malformed cursor response");

    assert!(response.invalid_cursor);
    assert!(response.files.is_empty());

    std::fs::remove_dir_all(&root).expect("cleanup root");
}

#[test]
fn list_workspace_files_keeps_scanning_files_when_directory_cap_reached() {
    let root = std::env::temp_dir().join(format!("mossx-files-cap-{}", Uuid::new_v4()));
    std::fs::create_dir_all(&root).expect("create root");

    for index in 0..1_010usize {
        std::fs::create_dir_all(root.join(format!("a-dir-{index:04}")))
            .expect("create directory");
    }
    std::fs::write(root.join("z-last-file.ts"), "export const ok = true;\n")
        .expect("write test file");

    let response = list_workspace_files_inner(&root, 1);

    assert!(
        response.files.iter().any(|path| path == "z-last-file.ts"),
        "expected file scan to continue after directory cap"
    );
    assert!(
        response.directories.len() <= 1_000,
        "directory list should still honor cap"
    );

    std::fs::remove_dir_all(&root).expect("cleanup root");
}

#[test]
fn list_workspace_files_keeps_scanning_deep_files_when_directory_cap_reached() {
    let root = std::env::temp_dir().join(format!("mossx-files-deep-cap-{}", Uuid::new_v4()));
    std::fs::create_dir_all(&root).expect("create root");

    for index in 0..1_010usize {
        std::fs::create_dir_all(root.join(format!("a-dir-{index:04}")))
            .expect("create directory");
    }
    let deep_dir = root.join("z-deep").join("nested");
    std::fs::create_dir_all(&deep_dir).expect("create deep dir");
    std::fs::write(deep_dir.join("hit.ts"), "export const deep = true;\n")
        .expect("write deep file");

    let response = list_workspace_files_inner(&root, 1);

    assert!(
        response
            .files
            .iter()
            .any(|path| path == "z-deep/nested/hit.ts"),
        "expected walker to keep scanning deep files after directory cap"
    );
    assert!(
        response.directories.len() <= 1_000,
        "directory list should still honor cap"
    );

    std::fs::remove_dir_all(&root).expect("cleanup root");
}

#[test]
fn list_workspace_files_marks_truncated_directory_state_as_partial() {
    let root = std::env::temp_dir().join(format!("mossx-files-partial-{}", Uuid::new_v4()));
    std::fs::create_dir_all(root.join("packages/large")).expect("create large dir");
    std::fs::write(
        root.join("packages/large/index.ts"),
        "export const large = true;\n",
    )
    .expect("write large file");

    let response = list_workspace_files_inner(&root, 1);
    let packages_entry = response
        .directory_entries
        .iter()
        .find(|entry| entry.path == "packages")
        .expect("packages metadata");

    assert_eq!(response.scan_state, WorkspaceScanState::Partial);
    assert!(response.limit_hit);
    assert_eq!(
        packages_entry.child_state,
        WorkspaceDirectoryChildState::Partial
    );

    std::fs::remove_dir_all(&root).expect("cleanup root");
}

#[test]
fn sort_and_truncate_named_entries_sorts_before_truncating() {
    let mut entries = vec![
        ("z-item".to_string(), 1usize),
        ("m-item".to_string(), 2usize),
        ("a-item".to_string(), 3usize),
        ("b-item".to_string(), 4usize),
    ];

    sort_and_truncate_named_entries(&mut entries, 2);

    let names: Vec<String> = entries.into_iter().map(|(name, _)| name).collect();
    assert_eq!(names, vec!["a-item".to_string(), "b-item".to_string()]);
}

#[test]
fn list_workspace_directory_children_returns_sorted_entries() {
    let root = std::env::temp_dir().join(format!("mossx-dir-children-{}", Uuid::new_v4()));
    std::fs::create_dir_all(root.join("bucket")).expect("create bucket dir");
    std::fs::write(root.join("bucket/z.ts"), "z\n").expect("write z");
    std::fs::write(root.join("bucket/a.ts"), "a\n").expect("write a");
    std::fs::write(root.join("bucket/m.ts"), "m\n").expect("write m");

    let response =
        list_workspace_directory_children_inner(&root, "bucket", 3).expect("list children");

    assert_eq!(
        response.files,
        vec![
            "bucket/a.ts".to_string(),
            "bucket/m.ts".to_string(),
            "bucket/z.ts".to_string()
        ]
    );

    std::fs::remove_dir_all(&root).expect("cleanup root");
}

#[test]
fn list_workspace_directory_children_accepts_empty_path_as_root() {
    let root = std::env::temp_dir().join(format!("mossx-root-children-{}", Uuid::new_v4()));
    std::fs::create_dir_all(root.join("src")).expect("create src dir");
    std::fs::write(root.join("README.md"), "# test\n").expect("write readme");
    std::fs::write(root.join("src/main.ts"), "main\n").expect("write nested file");

    let response =
        list_workspace_directory_children_inner(&root, "", 10).expect("list root children");

    assert_eq!(response.files, vec!["README.md".to_string()]);
    assert_eq!(response.directories, vec!["src".to_string()]);
    assert!(!response.files.contains(&"src/main.ts".to_string()));
    assert!(response
        .directory_entries
        .iter()
        .any(|entry| entry.path == "src"
            && entry.child_state == WorkspaceDirectoryChildState::Unknown));

    std::fs::remove_dir_all(&root).expect("cleanup root");
}

#[test]
fn list_workspace_directory_children_defers_root_gitignore_markers() {
    let root = std::env::temp_dir().join(format!("mossx-root-gitignore-{}", Uuid::new_v4()));
    std::fs::create_dir_all(root.join("src")).expect("create src dir");
    std::fs::write(root.join(".gitignore"), "src/ignored.ts\n").expect("write gitignore");
    std::fs::write(root.join("src/ignored.ts"), "ignored\n").expect("write ignored file");
    git2::Repository::init(&root).expect("init git repo");

    let root_response =
        list_workspace_directory_children_inner(&root, "", 10).expect("list root children");
    assert!(root_response.gitignored_files.is_empty());
    assert!(root_response.gitignored_directories.is_empty());

    let src_response =
        list_workspace_directory_children_inner(&root, "src", 10).expect("list src children");
    assert_eq!(
        src_response.gitignored_files,
        vec!["src/ignored.ts".to_string()]
    );

    std::fs::remove_dir_all(&root).expect("cleanup root");
}

#[test]
fn list_workspace_directory_children_reports_empty_directory() {
    let root = std::env::temp_dir().join(format!("mossx-dir-empty-{}", Uuid::new_v4()));
    std::fs::create_dir_all(root.join("empty")).expect("create empty dir");

    let response =
        list_workspace_directory_children_inner(&root, "empty", 20).expect("list children");
    let parent_entry = response
        .directory_entries
        .iter()
        .find(|entry| entry.path == "empty")
        .expect("empty directory metadata");

    assert_eq!(response.scan_state, WorkspaceScanState::Complete);
    assert!(!response.limit_hit);
    assert_eq!(
        parent_entry.child_state,
        WorkspaceDirectoryChildState::Empty
    );

    std::fs::remove_dir_all(&root).expect("cleanup root");
}

#[test]
fn list_workspace_directory_children_reports_partial_when_entry_cap_hits() {
    let root = std::env::temp_dir().join(format!("mossx-dir-partial-{}", Uuid::new_v4()));
    std::fs::create_dir_all(root.join("bucket")).expect("create bucket dir");
    std::fs::write(root.join("bucket/a.ts"), "a\n").expect("write a");
    std::fs::write(root.join("bucket/b.ts"), "b\n").expect("write b");

    let response =
        list_workspace_directory_children_inner(&root, "bucket", 1).expect("list children");
    let parent_entry = response
        .directory_entries
        .iter()
        .find(|entry| entry.path == "bucket")
        .expect("bucket metadata");

    assert_eq!(response.files.len() + response.directories.len(), 1);
    assert_eq!(response.scan_state, WorkspaceScanState::Partial);
    assert!(response.limit_hit);
    assert_eq!(
        parent_entry.child_state,
        WorkspaceDirectoryChildState::Partial
    );
    assert!(parent_entry.has_more);

    std::fs::remove_dir_all(&root).expect("cleanup root");
}

#[test]
fn list_workspace_directory_children_caps_special_directories() {
    let root = std::env::temp_dir().join(format!("mossx-special-dir-cap-{}", Uuid::new_v4()));
    std::fs::create_dir_all(root.join("target")).expect("create target dir");
    for index in 0..305 {
        std::fs::write(root.join(format!("target/file-{index:03}.txt")), "x")
            .expect("write special child");
    }

    let response =
        list_workspace_directory_children_inner(&root, "target", 2_000).expect("list children");
    let parent_entry = response
        .directory_entries
        .iter()
        .find(|entry| entry.path == "target")
        .expect("target metadata");

    assert_eq!(response.files.len() + response.directories.len(), 300);
    assert_eq!(response.scan_state, WorkspaceScanState::Partial);
    assert!(response.limit_hit);
    assert_eq!(
        parent_entry.child_state,
        WorkspaceDirectoryChildState::Partial
    );
    assert!(parent_entry.has_more);

    std::fs::remove_dir_all(&root).expect("cleanup root");
}

#[test]
fn list_external_absolute_directory_children_returns_sorted_entries() {
    let root =
        std::env::temp_dir().join(format!("mossx-external-dir-children-{}", Uuid::new_v4()));
    std::fs::create_dir_all(root.join("skill")).expect("create skill dir");
    std::fs::write(root.join("skill/z.ts"), "z\n").expect("write z");
    std::fs::write(root.join("skill/a.ts"), "a\n").expect("write a");
    std::fs::write(root.join("skill/m.ts"), "m\n").expect("write m");
    let canonical_skill_dir = root
        .join("skill")
        .canonicalize()
        .expect("canonical skill dir");
    let expected_base = normalize_git_path(&canonical_skill_dir.to_string_lossy());

    let response = list_external_absolute_directory_children_inner(
        root.join("skill").to_str().expect("directory path"),
        std::slice::from_ref(&root),
        3,
    )
    .expect("list children");

    assert_eq!(
        response.files,
        vec![
            format!("{expected_base}/a.ts"),
            format!("{expected_base}/m.ts"),
            format!("{expected_base}/z.ts")
        ]
    );

    std::fs::remove_dir_all(&root).expect("cleanup root");
}

#[test]
fn list_external_absolute_directory_children_rejects_relative_path() {
    let root = PathBuf::from("/tmp");
    let result = list_external_absolute_directory_children_inner("relative/path", &[root], 20);
    assert!(result.is_err());
    assert_eq!(result.err().as_deref(), Some("Invalid directory path."));
}

#[test]
fn read_workspace_file_decodes_gb18030_text() {
    let root = std::env::temp_dir().join(format!("mossx-read-{}", Uuid::new_v4()));
    std::fs::create_dir_all(root.join("docs")).expect("create docs");
    let (encoded, _, had_errors) = encoding_rs::GB18030.encode("usb异常断开");
    assert!(!had_errors, "encode should succeed");
    std::fs::write(root.join("docs/main_lin_test.c"), encoded.as_ref()).expect("write file");

    let response = read_workspace_file_inner(&PathBuf::from(&root), "docs/main_lin_test.c")
        .expect("read file");

    assert_eq!(response.content, "usb异常断开");
    assert!(!response.truncated);

    std::fs::remove_dir_all(&root).expect("cleanup root");
}

#[test]
fn read_external_absolute_file_decodes_gb18030_text() {
    let root = std::env::temp_dir().join(format!("mossx-read-absolute-{}", Uuid::new_v4()));
    std::fs::create_dir_all(root.join("docs")).expect("create docs");
    let (encoded, _, had_errors) = encoding_rs::GB18030.encode("外部绝对路径可读取");
    assert!(!had_errors, "encode should succeed");
    let file_path = root.join("docs/skill.md");
    std::fs::write(&file_path, encoded.as_ref()).expect("write file");

    let response = read_external_absolute_file_inner(
        file_path.to_str().expect("file path"),
        std::slice::from_ref(&root),
    )
    .expect("read file");

    assert_eq!(response.content, "外部绝对路径可读取");
    assert!(!response.truncated);

    std::fs::remove_dir_all(&root).expect("cleanup root");
}

#[test]
fn resolve_workspace_preview_handle_keeps_file_backed_payload_bounded() {
    let root = std::env::temp_dir().join(format!("mossx-preview-handle-{}", Uuid::new_v4()));
    std::fs::create_dir_all(root.join("docs")).expect("create docs");
    std::fs::write(root.join("docs/report.pdf"), b"%PDF-1.7").expect("write pdf");

    let response =
        resolve_workspace_preview_handle_inner(&PathBuf::from(&root), "docs/report.pdf")
            .expect("preview handle");

    assert!(response.absolute_path.ends_with("docs/report.pdf"));
    assert_eq!(response.extension.as_deref(), Some("pdf"));
    assert!(response.byte_length > 0);

    std::fs::remove_dir_all(&root).expect("cleanup root");
}

#[test]
fn read_external_absolute_file_rejects_relative_path() {
    let root = PathBuf::from("/tmp");
    let result = read_external_absolute_file_inner("relative/path.md", &[root]);
    assert!(result.is_err());
    assert_eq!(result.err().as_deref(), Some("Invalid file path"));
}

#[test]
fn write_external_absolute_file_updates_existing_file() {
    let root = std::env::temp_dir().join(format!("mossx-write-absolute-{}", Uuid::new_v4()));
    std::fs::create_dir_all(root.join("docs")).expect("create docs");
    let file_path = root.join("docs/skill.md");
    std::fs::write(&file_path, "before").expect("write file");

    write_external_absolute_file_inner(
        file_path.to_str().expect("file path"),
        std::slice::from_ref(&root),
        "after",
    )
    .expect("write absolute file");

    let content = std::fs::read_to_string(&file_path).expect("read updated file");
    assert_eq!(content, "after");

    std::fs::remove_dir_all(&root).expect("cleanup root");
}

#[test]
fn write_external_absolute_file_rejects_relative_path() {
    let root = PathBuf::from("/tmp");
    let result = write_external_absolute_file_inner("relative/path.md", &[root], "content");
    assert!(result.is_err());
    assert_eq!(result.err().as_deref(), Some("Invalid file path"));
}

#[test]
fn write_external_absolute_file_rejects_path_outside_allowed_roots() {
    let root =
        std::env::temp_dir().join(format!("mossx-write-absolute-root-{}", Uuid::new_v4()));
    let outside =
        std::env::temp_dir().join(format!("mossx-write-absolute-outside-{}", Uuid::new_v4()));
    std::fs::create_dir_all(root.join("docs")).expect("create root docs");
    std::fs::create_dir_all(outside.join("docs")).expect("create outside docs");
    let file_path = outside.join("docs/skill.md");
    std::fs::write(&file_path, "before").expect("write file");

    let result = write_external_absolute_file_inner(
        file_path.to_str().expect("file path"),
        &[root.clone()],
        "after",
    );

    assert_eq!(
        result.err().as_deref(),
        Some("Path is not within allowed directories.")
    );

    std::fs::remove_dir_all(&root).expect("cleanup root");
    std::fs::remove_dir_all(&outside).expect("cleanup outside");
}

#[test]
fn resolve_external_preview_handles_respect_allowed_roots_and_openspec_aliases() {
    let project_root =
        std::env::temp_dir().join(format!("mossx-preview-spec-{}", Uuid::new_v4()));
    let openspec_root = project_root.join("openspec");
    std::fs::create_dir_all(&openspec_root).expect("create spec root");
    std::fs::write(openspec_root.join("project.docx"), b"docx").expect("write docx");

    let spec_response = resolve_external_spec_preview_handle_inner(
        project_root.to_str().expect("project root"),
        "openspec/project.docx",
    )
    .expect("spec preview handle");
    assert_eq!(spec_response.extension.as_deref(), Some("docx"));

    let absolute_response = resolve_external_absolute_preview_handle_inner(
        openspec_root
            .join("project.docx")
            .to_str()
            .expect("absolute path"),
        std::slice::from_ref(&project_root),
    )
    .expect("absolute preview handle");
    assert_eq!(absolute_response.extension.as_deref(), Some("docx"));

    std::fs::remove_dir_all(&project_root).expect("cleanup root");
}

#[test]
fn read_external_spec_file_decodes_gb18030_text() {
    let project_root = std::env::temp_dir().join(format!("mossx-spec-{}", Uuid::new_v4()));
    let openspec_root = project_root.join("openspec");
    std::fs::create_dir_all(&openspec_root).expect("create spec root");
    let (encoded, _, had_errors) = encoding_rs::GB18030.encode("重新插拔usb会恢复");
    assert!(!had_errors, "encode should succeed");
    std::fs::write(openspec_root.join("legacy.c"), encoded.as_ref()).expect("write file");

    let response = read_external_spec_file_inner(
        project_root.to_str().expect("root path"),
        "openspec/legacy.c",
    )
    .expect("read file");

    assert!(response.exists);
    assert_eq!(response.content, "重新插拔usb会恢复");
    assert!(!response.truncated);

    std::fs::remove_dir_all(&project_root).expect("cleanup root");
}

#[test]
fn read_external_spec_file_supports_direct_openspec_root_input() {
    let project_root =
        std::env::temp_dir().join(format!("mossx-openspec-direct-{}", Uuid::new_v4()));
    let openspec_root = project_root.join("openspec");
    std::fs::create_dir_all(&openspec_root).expect("create spec root");
    std::fs::write(openspec_root.join("project.md"), "# Project Context").expect("write file");

    let response = read_external_spec_file_inner(
        openspec_root.to_str().expect("root path"),
        "openspec/project.md",
    )
    .expect("read file");

    assert!(response.exists);
    assert_eq!(response.content, "# Project Context");

    std::fs::remove_dir_all(&project_root).expect("cleanup root");
}

#[test]
fn list_external_spec_tree_returns_placeholder_when_project_root_has_no_openspec() {
    let project_root =
        std::env::temp_dir().join(format!("mossx-project-no-openspec-{}", Uuid::new_v4()));
    std::fs::create_dir_all(&project_root).expect("create project root");
    std::fs::write(project_root.join("package.json"), "{}").expect("write project file");

    let response =
        list_external_spec_tree_inner(project_root.to_str().expect("root path"), 100)
            .expect("list tree");

    assert_eq!(response.files, Vec::<String>::new());
    assert_eq!(response.directories, vec!["openspec".to_string()]);

    std::fs::remove_dir_all(&project_root).expect("cleanup root");
}
