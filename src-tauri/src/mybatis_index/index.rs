use std::collections::HashMap;
use std::path::Path;

use regex::Regex;
use ignore::WalkBuilder;

use super::types::*;

/// In-memory index for MyBatis mapper files with bidirectional mapping.
pub struct MybatisIndex {
    /// Statements grouped by namespace.
    statements: HashMap<String, Vec<MapperStatement>>,
    /// Statements grouped by file path.
    file_map: HashMap<String, Vec<MapperStatement>>,
    /// Annotation-based SQL keyed by "ClassName.methodName".
    annotation_map: HashMap<String, String>,
    /// SQL fragments keyed by fragment id.
    sql_fragments: HashMap<String, String>,
    /// Parse status for each mapper file.
    file_statuses: Vec<MapperFileStatus>,
    /// All discovered namespaces.
    namespaces: Vec<String>,
    /// Namespace → Java interface file path (e.g., "com.example.mapper.UserMapper" → "/path/to/UserMapper.java").
    namespace_to_java: HashMap<String, String>,
    /// Namespace + method name → Java Mapper method location.
    java_methods: HashMap<String, JavaMapperMethod>,
}

impl MybatisIndex {
    /// Create an empty index.
    pub fn new() -> Self {
        Self {
            statements: HashMap::new(),
            file_map: HashMap::new(),
            annotation_map: HashMap::new(),
            sql_fragments: HashMap::new(),
            file_statuses: Vec::new(),
            namespaces: Vec::new(),
            namespace_to_java: HashMap::new(),
            java_methods: HashMap::new(),
        }
    }

    /// Walk a workspace root and index every MyBatis mapper XML and Java annotation file.
    pub fn index_workspace(&mut self, workspace_root: &Path) {
        self.statements.clear();
        self.file_map.clear();
        self.annotation_map.clear();
        self.sql_fragments.clear();
        self.file_statuses.clear();
        self.namespaces.clear();
        self.namespace_to_java.clear();
        self.java_methods.clear();

        let mut discovered_namespaces: Vec<String> = Vec::new();

        // 1. Walk and parse XML mapper files.
        let walker = WalkBuilder::new(workspace_root)
            .follow_links(false)
            .build();

        for entry in walker.filter_map(|e| e.ok()) {
            let path = entry.path();
            match path.extension().and_then(|e| e.to_str()) {
                Some("xml") => self.index_xml_file(path, &mut discovered_namespaces),
                Some("java") => self.index_java_file(path),
                _ => {}
            }
        }

        self.namespaces = discovered_namespaces;
    }

    /// Find all statements matching a namespace and id.
    pub fn find_statement(&self, namespace: &str, id: &str) -> Vec<&MapperStatement> {
        self.statements
            .get(namespace)
            .map(|v| {
                v.iter()
                    .filter(|s| s.id == id)
                    .collect()
            })
            .unwrap_or_default()
    }

    /// Find all statements declared under a given namespace (mapper interface).
    pub fn find_mapper_method(&self, namespace: &str) -> Vec<&MapperStatement> {
        self.statements
            .get(namespace)
            .map(|v| v.iter().collect())
            .unwrap_or_default()
    }

    /// Find all references to a given statement id across all namespaces.
    pub fn find_references(&self, id: &str) -> Vec<&MapperStatement> {
        let mut results: Vec<&MapperStatement> = Vec::new();
        for stmts in self.statements.values() {
            for s in stmts {
                if s.id == id {
                    results.push(s);
                }
            }
        }
        results
    }

    /// Return a formatted SQL preview for a single statement.
    pub fn get_sql_preview(&self, namespace: &str, id: &str) -> Option<String> {
        self.find_statement(namespace, id)
            .into_iter()
            .next()
            .map(|s| format_sql_preview(&s.statement_type, &s.sql_content))
    }

    /// Retrieve annotation-based SQL for a Java class method.
    pub fn get_annotation_sql(&self, class_name: &str, method_name: &str) -> Option<&str> {
        let key = format!("{}.{}", class_name, method_name);
        self.annotation_map.get(&key).map(|s| s.as_str())
    }

    /// Validate the index for consistency issues.
    pub fn validate(&self) -> ValidationResult {
        let mut errors: Vec<ValidationIssue> = Vec::new();
        let mut warnings: Vec<ValidationIssue> = Vec::new();

        // Check for duplicate statement ids within a namespace.
        for (ns, stmts) in &self.statements {
            let mut seen: HashMap<&str, &MapperStatement> = HashMap::new();
            for s in stmts {
                if let Some(prev) = seen.get(s.id.as_str()) {
                    errors.push(ValidationIssue {
                        message: format!(
                            "duplicate statement id '{}' in namespace '{}' (first at line {})",
                            s.id, ns, prev.line
                        ),
                        file_path: s.file_path.clone(),
                        line: Some(s.line),
                        issue_type: "duplicate_id".to_string(),
                    });
                } else {
                    seen.insert(&s.id, s);
                }
            }
        }

        // Check for file parse errors.
        for status in &self.file_statuses {
            if status.status == "error" {
                if let Some(ref msg) = status.error {
                    errors.push(ValidationIssue {
                        message: msg.clone(),
                        file_path: status.file_path.clone(),
                        line: None,
                        issue_type: "parse_error".to_string(),
                    });
                }
            }
        }

        // Check for namespaces with no statements (possible orphan).
        for ns in &self.namespaces {
            if !self.statements.contains_key(ns) {
                warnings.push(ValidationIssue {
                    message: format!("namespace '{}' has no mapped statements", ns),
                    file_path: String::new(),
                    line: None,
                    issue_type: "missing_statement".to_string(),
                });
            }
        }

        ValidationResult { errors, warnings }
    }

    /// Return aggregate status of the index.
    pub fn get_status(&self) -> MybatisStatus {
        let statement_count: usize = self.statements.values().map(|v| v.len()).sum();
        let file_count = self.file_map.len();
        let parse_errors = self
            .file_statuses
            .iter()
            .filter(|s| s.status == "error")
            .count();
        let annotation_count = self.annotation_map.len();

        MybatisStatus {
            statement_count,
            file_count,
            parse_errors,
            annotation_count,
        }
    }

    /// Extract SQL from MyBatis annotations (`@Select`, `@Insert`, `@Update`,
    /// `@Delete`) in a single Java source file.
    pub fn extract_annotation_sql_from_java(&mut self, path: &Path) {
        let content = match std::fs::read_to_string(path) {
            Ok(c) => c,
            Err(_) => return,
        };

        let path_str = path.to_string_lossy().to_string();

        // Derive a class-level key from the file name.
        let class_name = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Unknown")
            .to_string();

        let annotation_re = Regex::new(
            r#"(?s)@(Select|Insert|Update|Delete)\s*\(\s*(?:"([^"]*)"|\{([^}]*)\})\s*\)"#,
        )
        .unwrap();

        // Extract method name from the line following the annotation.
        let method_re = Regex::new(r#"(?:(?:public|private|protected)\s+)?\S+\s+(\w+)\s*\("#).unwrap();

        let lines: Vec<&str> = content.lines().collect();
        for (i, line) in lines.iter().enumerate() {
            if let Some(caps) = annotation_re.captures(line) {
                let stmt_type = caps.get(1).unwrap().as_str().to_lowercase();
                let sql = if let Some(m) = caps.get(2) {
                    m.as_str().trim().to_string()
                } else if let Some(m) = caps.get(3) {
                    // Concatenate array-style SQL fragments.
                    m.as_str()
                        .lines()
                        .map(|l| l.trim().trim_matches('"').trim())
                        .filter(|l| !l.is_empty())
                        .collect::<Vec<_>>()
                        .join(" ")
                } else {
                    continue;
                };

                // Look downwards for the method signature (annotations are above methods).
                let mut method_name = String::from("unknown");
                for next in (i + 1)..lines.len() {
                    if let Some(mc) = method_re.captures(lines[next]) {
                        method_name = mc.get(1).unwrap().as_str().to_string();
                        break;
                    }
                }

                let key = format!("{}.{}", class_name, method_name);
                self.annotation_map.insert(key, sql.clone());

                // Also store as a pseudo-statement for unified queries.
                let stmt = MapperStatement {
                    namespace: class_name.clone(),
                    id: method_name,
                    statement_type: stmt_type,
                    file_path: path_str.clone(),
                    line: (i + 1) as u32,
                    column: 0,
                    sql_content: sql,
                };
                self.file_map
                    .entry(path_str.clone())
                    .or_default()
                    .push(stmt);
            }
        }
    }

    // -----------------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------------

    fn index_xml_file(&mut self, path: &Path, namespaces: &mut Vec<String>) {
        let path_str = path.to_string_lossy().to_string();
        match super::parser::parse_mapper_file(path) {
            Ok(parsed) => {
                let ns = parsed.namespace;
                if !ns.is_empty() && !namespaces.contains(&ns) {
                    namespaces.push(ns.clone());
                }

                let mapper_stmts: Vec<MapperStatement> = parsed
                    .statements
                    .into_iter()
                    .map(|s| MapperStatement {
                        namespace: ns.clone(),
                        id: s.id,
                        statement_type: s.statement_type,
                        file_path: path_str.clone(),
                        line: s.line,
                        column: s.column,
                        sql_content: s.sql_content,
                    })
                    .collect();

                self.file_map
                    .insert(path_str.clone(), mapper_stmts.clone());
                self.statements
                    .entry(ns.clone())
                    .or_default()
                    .extend(mapper_stmts);

                for frag in parsed.sql_fragments {
                    let key = format!("{}.{}", ns, frag.id);
                    self.sql_fragments.insert(key, frag.content);
                }

                self.file_statuses.push(MapperFileStatus {
                    file_path: path_str,
                    status: "ok".to_string(),
                    error: None,
                });
            }
            Err(e) => {
                self.file_statuses.push(MapperFileStatus {
                    file_path: path_str,
                    status: "error".to_string(),
                    error: Some(e.to_string()),
                });
            }
        }
    }

    fn index_java_file(&mut self, path: &Path) {
        let content = match std::fs::read_to_string(path) {
            Ok(c) => c,
            Err(_) => return,
        };

        // Build namespace → Java file path mapping for @Mapper interfaces
        if content.contains("@Mapper") || content.contains("BaseMapper") {
            if let Some(ns) = self.extract_namespace_from_java(&content) {
                let path_str = path.to_string_lossy().to_string();
                self.namespace_to_java.insert(ns.clone(), path_str.clone());
                self.index_java_mapper_methods(&ns, &path_str, &content);
            }
        }

        // Extract annotation SQL
        if content.contains("@Select")
            || content.contains("@Insert")
            || content.contains("@Update")
            || content.contains("@Delete")
        {
            self.extract_annotation_sql_from_java(path);
        }
    }

    /// Extract fully qualified namespace from Java file's package + class declaration.
    fn extract_namespace_from_java(&self, content: &str) -> Option<String> {
        let pkg = content
            .lines()
            .find(|l| l.trim_start().starts_with("package "))
            .and_then(|l| l.strip_prefix("package ")?.strip_suffix(';'))
            .map(|s| s.trim().to_string())?;

        let class = content
            .lines()
            .find(|l| l.contains("interface ") || l.contains("class "))
            .and_then(|l| {
                let after_mods = l
                    .replace("public", "")
                    .replace("private", "")
                    .replace("protected", "");
                let parts: Vec<&str> = after_mods.split_whitespace().collect();
                // Find "interface" or "class" keyword and take the next token
                for (i, p) in parts.iter().enumerate() {
                    if (*p == "interface" || *p == "class") && i + 1 < parts.len() {
                        let name = parts[i + 1]
                            .split('<')
                            .next()
                            .unwrap_or(parts[i + 1]);
                        return Some(name.to_string());
                    }
                }
                None
            })?;

        Some(format!("{}.{}", pkg, class))
    }

    /// Look up the Java interface file path for a given namespace.
    pub fn find_java_interface(&self, namespace: &str) -> Option<&str> {
        self.namespace_to_java.get(namespace).map(|s| s.as_str())
    }

    /// Look up a Java mapper method location by namespace + method name.
    pub fn find_java_method(&self, namespace: &str, method_name: &str) -> Option<&JavaMapperMethod> {
        self.java_methods
            .get(&format!("{}.{}", namespace, method_name))
    }

    fn index_java_mapper_methods(&mut self, namespace: &str, path_str: &str, content: &str) {
        let method_re = Regex::new(
            r#"^\s*(?:public\s+)?(?:default\s+)?(?:[\w<>\[\].?,]+\s+)+(\w+)\s*\("#,
        )
        .unwrap();

        for (i, line) in content.lines().enumerate() {
            let trimmed = line.trim_start();
            if trimmed.starts_with("package ")
                || trimmed.starts_with("import ")
                || trimmed.starts_with("//")
                || trimmed.starts_with('*')
                || trimmed.starts_with('@')
                || trimmed.contains(" class ")
                || trimmed.contains(" interface ")
            {
                continue;
            }

            let Some(caps) = method_re.captures(line) else {
                continue;
            };
            let Some(method_match) = caps.get(1) else {
                continue;
            };
            let method_name = method_match.as_str().to_string();
            let key = format!("{}.{}", namespace, method_name);
            self.java_methods.insert(
                key,
                JavaMapperMethod {
                    namespace: namespace.to_string(),
                    method_name,
                    file_path: path_str.to_string(),
                    line: (i + 1) as u32,
                    column: (method_match.start() + 1) as u32,
                },
            );
        }
    }
}

/// Pretty-print SQL for preview purposes.
fn format_sql_preview(statement_type: &str, sql: &str) -> String {
    let trimmed = sql.trim();
    format!(
        "-- {} statement\n{}",
        statement_type.to_uppercase(),
        trimmed
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;

    fn temp_dir(label: &str) -> PathBuf {
        let path = std::env::temp_dir().join(format!("mybatis-test-{label}-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&path).unwrap();
        path
    }

    fn write_mapper(dir: &Path, filename: &str, content: &str) -> PathBuf {
        let path = dir.join("mapper").join(filename);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(&path, content).unwrap();
        path
    }

    fn simple_mapper_xml() -> &'static str {
        r#"<?xml version="1.0" encoding="UTF-8" ?>
<mapper namespace="com.example.mapper.UserMapper">
    <select id="selectById" resultType="com.example.model.User">
        SELECT * FROM user WHERE id = #{id}
    </select>
    <insert id="insert">
        INSERT INTO user (name, email) VALUES (#{name}, #{email})
    </insert>
</mapper>"#
    }

    #[test]
    fn index_workspace_discovers_xml_files() {
        let dir = temp_dir("discover");
        write_mapper(&dir, "UserMapper.xml", simple_mapper_xml());
        let mut index = MybatisIndex::new();
        index.index_workspace(&dir);
        let status = index.get_status();
        assert_eq!(status.file_count, 1);
        assert_eq!(status.statement_count, 2);
    }

    #[test]
    fn find_statement_returns_matching_results() {
        let dir = temp_dir("find-stmt");
        write_mapper(&dir, "UserMapper.xml", simple_mapper_xml());
        let mut index = MybatisIndex::new();
        index.index_workspace(&dir);
        let results = index.find_statement("com.example.mapper.UserMapper", "selectById");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].statement_type, "select");
    }

    #[test]
    fn find_statement_returns_empty_for_unknown() {
        let dir = temp_dir("find-unknown");
        write_mapper(&dir, "UserMapper.xml", simple_mapper_xml());
        let mut index = MybatisIndex::new();
        index.index_workspace(&dir);
        let results = index.find_statement("com.example.mapper.UserMapper", "nonExistent");
        assert!(results.is_empty());
    }

    #[test]
    fn find_mapper_method_returns_all_statements() {
        let dir = temp_dir("find-method");
        write_mapper(&dir, "UserMapper.xml", simple_mapper_xml());
        let mut index = MybatisIndex::new();
        index.index_workspace(&dir);
        let results = index.find_mapper_method("com.example.mapper.UserMapper");
        assert_eq!(results.len(), 2);
    }

    #[test]
    fn find_references_finds_across_namespaces() {
        let dir = temp_dir("find-refs");
        write_mapper(&dir, "UserMapper.xml", simple_mapper_xml());
        let other_xml = r#"<?xml version="1.0" encoding="UTF-8" ?>
<mapper namespace="com.example.mapper.OrderMapper">
    <select id="selectById" resultType="com.example.model.Order">
        SELECT * FROM orders WHERE id = #{id}
    </select>
</mapper>"#;
        write_mapper(&dir, "OrderMapper.xml", other_xml);
        let mut index = MybatisIndex::new();
        index.index_workspace(&dir);
        let results = index.find_references("selectById");
        assert_eq!(results.len(), 2);
    }

    #[test]
    fn get_sql_preview_returns_formatted_sql() {
        let dir = temp_dir("sql-preview");
        write_mapper(&dir, "UserMapper.xml", simple_mapper_xml());
        let mut index = MybatisIndex::new();
        index.index_workspace(&dir);
        let preview = index.get_sql_preview("com.example.mapper.UserMapper", "selectById");
        assert!(preview.is_some());
        let sql = preview.unwrap();
        assert!(sql.contains("-- SELECT statement"));
        assert!(sql.contains("SELECT * FROM user"));
    }

    #[test]
    fn get_sql_preview_returns_none_for_unknown() {
        let dir = temp_dir("sql-preview-none");
        write_mapper(&dir, "UserMapper.xml", simple_mapper_xml());
        let mut index = MybatisIndex::new();
        index.index_workspace(&dir);
        let preview = index.get_sql_preview("com.example.mapper.UserMapper", "unknown");
        assert!(preview.is_none());
    }

    #[test]
    fn validate_detects_no_issues_for_valid_index() {
        let dir = temp_dir("validate-valid");
        write_mapper(&dir, "UserMapper.xml", simple_mapper_xml());
        let mut index = MybatisIndex::new();
        index.index_workspace(&dir);
        let result = index.validate();
        assert!(result.errors.is_empty());
    }

    #[test]
    fn validate_detects_parse_errors() {
        let dir = temp_dir("validate-parse");
        write_mapper(&dir, "Bad.xml", r#"<root attr="unterminated"#);
        let mut index = MybatisIndex::new();
        index.index_workspace(&dir);
        let result = index.validate();
        assert!(!result.errors.is_empty());
        assert!(result.errors.iter().any(|e| e.issue_type == "parse_error"));
    }

    #[test]
    fn annotation_sql_extraction() {
        let dir = temp_dir("annotation");
        let java_content = r#"package com.example.mapper;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Insert;

@Mapper
public interface UserMapper {
    @Select("SELECT * FROM user WHERE id = #{id}")
    User selectById(Long id);

    @Insert({"INSERT INTO user (name)", "VALUES (#{name})"})
    int insert(User user);
}
"#;
        let java_path = dir.join("UserMapper.java");
        fs::write(&java_path, java_content).unwrap();

        let mut index = MybatisIndex::new();
        index.extract_annotation_sql_from_java(&java_path);

        let sql = index.get_annotation_sql("UserMapper", "selectById");
        assert!(sql.is_some());
        assert!(sql.unwrap().contains("SELECT * FROM user"));

        let sql2 = index.get_annotation_sql("UserMapper", "insert");
        assert!(sql2.is_some());
        assert!(sql2.unwrap().contains("INSERT INTO user"));
    }

    #[test]
    fn annotation_sql_no_access_modifier() {
        let dir = temp_dir("annotation-no-modifier");
        let java_content = r#"package com.example.mapper;

@Mapper
public interface OrderMapper {
    @Select("SELECT * FROM orders WHERE id = #{id}")
    Order findById(Integer id);
}
"#;
        let java_path = dir.join("OrderMapper.java");
        fs::write(&java_path, java_content).unwrap();

        let mut index = MybatisIndex::new();
        index.extract_annotation_sql_from_java(&java_path);

        let sql = index.get_annotation_sql("OrderMapper", "findById");
        assert!(sql.is_some());
        assert!(sql.unwrap().contains("SELECT * FROM orders"));
    }

    #[test]
    fn status_reports_correct_counts() {
        let dir = temp_dir("status-counts");
        write_mapper(&dir, "UserMapper.xml", simple_mapper_xml());
        let mut index = MybatisIndex::new();
        index.index_workspace(&dir);
        let status = index.get_status();
        assert_eq!(status.statement_count, 2);
        assert_eq!(status.file_count, 1);
        assert_eq!(status.parse_errors, 0);
    }
}
