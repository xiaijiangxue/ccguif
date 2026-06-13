use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MapperStatement {
    pub namespace: String,
    pub id: String,
    pub statement_type: String, // "select", "insert", "update", "delete"
    pub file_path: String,
    pub line: u32,
    pub column: u32,
    pub sql_content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JavaMapperMethod {
    pub namespace: String,
    pub method_name: String,
    pub file_path: String,
    pub line: u32,
    pub column: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MapperFileStatus {
    pub file_path: String,
    pub status: String, // "ok" | "error"
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidationResult {
    pub errors: Vec<ValidationIssue>,
    pub warnings: Vec<ValidationIssue>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidationIssue {
    pub message: String,
    pub file_path: String,
    pub line: Option<u32>,
    pub issue_type: String, // "missing_statement", "missing_method", "namespace_mismatch", "duplicate_id"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MybatisStatus {
    pub statement_count: usize,
    pub file_count: usize,
    pub parse_errors: usize,
    pub annotation_count: usize,
}
