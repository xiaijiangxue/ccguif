use std::path::Path;

use quick_xml::events::Event;
use quick_xml::Reader;

/// Parsed representation of a MyBatis mapper XML file.
#[derive(Debug, Clone)]
pub struct ParsedMapper {
    pub namespace: String,
    pub statements: Vec<ParsedStatement>,
    pub result_maps: Vec<ParsedResultMap>,
    pub sql_fragments: Vec<ParsedSqlFragment>,
}

/// A parsed SQL statement (select/insert/update/delete).
#[derive(Debug, Clone)]
pub struct ParsedStatement {
    pub id: String,
    pub statement_type: String,
    pub line: u32,
    pub column: u32,
    pub sql_content: String,
    pub result_map: Option<String>,
}

/// A parsed resultMap definition.
#[derive(Debug, Clone)]
pub struct ParsedResultMap {
    pub id: String,
    pub line: u32,
}

/// A parsed sql fragment definition.
#[derive(Debug, Clone)]
pub struct ParsedSqlFragment {
    pub id: String,
    pub content: String,
}

/// Errors that can occur during XML parsing.
#[derive(Debug)]
pub enum ParseError {
    XmlError(String),
}

impl std::fmt::Display for ParseError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ParseError::XmlError(msg) => write!(f, "XML parse error: {}", msg),
        }
    }
}

impl std::error::Error for ParseError {}

impl From<quick_xml::Error> for ParseError {
    fn from(e: quick_xml::Error) -> Self {
        ParseError::XmlError(e.to_string())
    }
}

impl From<String> for ParseError {
    fn from(s: String) -> Self {
        ParseError::XmlError(s)
    }
}

struct StatementState {
    id: String,
    statement_type: String,
    line: u32,
    col: u32,
    sql_content: String,
    result_map: Option<String>,
    depth: u32,
}

struct SqlFragmentState {
    id: String,
    content: String,
    depth: u32,
}

struct LineIndex {
    starts: Vec<usize>,
}

impl LineIndex {
    fn new(input: &str) -> Self {
        let mut starts = vec![0];
        for (i, b) in input.as_bytes().iter().enumerate() {
            if *b == b'\n' {
                starts.push(i + 1);
            }
        }
        Self { starts }
    }

    fn offset_to_line_col(&self, offset: usize) -> (u32, u32) {
        let line = match self.starts.binary_search(&offset) {
            Ok(i) => i,
            Err(i) => i.saturating_sub(1),
        };
        let col = offset - self.starts[line] + 1;
        (line as u32 + 1, col as u32)
    }
}

fn tag_name(e: &quick_xml::events::BytesStart<'_>) -> String {
    String::from_utf8_lossy(e.name().as_ref()).into_owned()
}

fn tag_name_end(e: &quick_xml::events::BytesEnd<'_>) -> String {
    String::from_utf8_lossy(e.name().as_ref()).into_owned()
}

fn get_attribute(e: &quick_xml::events::BytesStart<'_>, name: &str) -> Option<String> {
    let nb = name.as_bytes();
    for attr in e.attributes().flatten() {
        if attr.key.as_ref() == nb {
            return Some(String::from_utf8_lossy(&attr.value).to_string());
        }
    }
    None
}

fn attrs_string(e: &quick_xml::events::BytesStart<'_>) -> String {
    let mut s = String::new();
    for attr in e.attributes().flatten() {
        let key = String::from_utf8_lossy(attr.key.as_ref());
        let val = String::from_utf8_lossy(&attr.value)
            .replace('&', "&amp;")
            .replace('"', "&quot;")
            .replace('<', "&lt;")
            .replace('>', "&gt;");
        s.push_str(&format!(" {}=\"{}\"", key, val));
    }
    s
}

fn is_statement_tag(name: &str) -> bool {
    matches!(name, "select" | "insert" | "update" | "delete")
}

fn normalize_sql(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    let mut prev_was_space = false;
    for ch in s.chars() {
        if ch.is_ascii_whitespace() {
            if !prev_was_space {
                result.push(' ');
                prev_was_space = true;
            }
        } else {
            result.push(ch);
            prev_was_space = false;
        }
    }
    result.trim().to_string()
}

pub fn parse_mapper(xml: &str) -> Result<ParsedMapper, ParseError> {
    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(false);
    let line_index = LineIndex::new(xml);
    let mut buf = Vec::new();
    let mut namespace = String::new();
    let mut statements = Vec::new();
    let mut result_maps = Vec::new();
    let mut sql_fragments = Vec::new();
    let mut in_statement: Option<StatementState> = None;
    let mut in_sql_fragment: Option<SqlFragmentState> = None;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                let name = tag_name(e);
                let pos = reader.buffer_position() as usize;
                let (line, col) = line_index.offset_to_line_col(pos);

                if name == "mapper" {
                    namespace = get_attribute(e, "namespace").unwrap_or_default();
                } else if is_statement_tag(&name) && in_statement.is_none() && in_sql_fragment.is_none() {
                    let id = get_attribute(e, "id").unwrap_or_default();
                    let rm = get_attribute(e, "resultMap");
                    in_statement = Some(StatementState {
                        id, statement_type: name, line, col,
                        sql_content: String::new(), result_map: rm, depth: 1,
                    });
                } else if name == "resultMap" && in_statement.is_none() && in_sql_fragment.is_none() {
                    let id = get_attribute(e, "id").unwrap_or_default();
                    result_maps.push(ParsedResultMap { id, line });
                } else if name == "sql" && in_statement.is_none() && in_sql_fragment.is_none() {
                    let id = get_attribute(e, "id").unwrap_or_default();
                    in_sql_fragment = Some(SqlFragmentState { id, content: String::new(), depth: 1 });
                } else {
                    if let Some(ref mut st) = in_statement {
                        let a = attrs_string(e);
                        st.sql_content.push_str(&format!("<{}{}>", name, a));
                        st.depth += 1;
                    }
                    if let Some(ref mut st) = in_sql_fragment {
                        let a = attrs_string(e);
                        st.content.push_str(&format!("<{}{}>", name, a));
                        st.depth += 1;
                    }
                }
            }
            Ok(Event::End(ref e)) => {
                let name = tag_name_end(e);
                if let Some(ref mut st) = in_statement {
                    if st.depth == 1 {
                        let s = in_statement.take().unwrap();
                        statements.push(ParsedStatement {
                            id: s.id, statement_type: s.statement_type,
                            line: s.line, column: s.col,
                            sql_content: normalize_sql(&s.sql_content),
                            result_map: s.result_map,
                        });
                    } else {
                        st.sql_content.push_str(&format!("</{}>", name));
                        st.depth -= 1;
                    }
                } else if let Some(ref mut st) = in_sql_fragment {
                    if st.depth == 1 {
                        let s = in_sql_fragment.take().unwrap();
                        sql_fragments.push(ParsedSqlFragment {
                            id: s.id, content: normalize_sql(&s.content),
                        });
                    } else {
                        st.content.push_str(&format!("</{}>", name));
                        st.depth -= 1;
                    }
                }
            }
            Ok(Event::Text(ref e)) => {
                let t = String::from_utf8_lossy(e.as_ref()).to_string();
                if let Some(ref mut s) = in_statement { s.sql_content.push_str(&t); }
                if let Some(ref mut s) = in_sql_fragment { s.content.push_str(&t); }
            }
            Ok(Event::CData(ref e)) => {
                let t = String::from_utf8_lossy(e.as_ref()).to_string();
                if let Some(ref mut s) = in_statement { s.sql_content.push_str(&t); }
                if let Some(ref mut s) = in_sql_fragment { s.content.push_str(&t); }
            }
            Ok(Event::Empty(ref e)) => {
                let name = tag_name(e);
                let pos = reader.buffer_position() as usize;
                let (line, _col) = line_index.offset_to_line_col(pos);
                if is_statement_tag(&name) && in_statement.is_none() && in_sql_fragment.is_none() {
                    let id = get_attribute(e, "id").unwrap_or_default();
                    let rm = get_attribute(e, "resultMap");
                    statements.push(ParsedStatement {
                        id, statement_type: name, line, column: _col,
                        sql_content: String::new(), result_map: rm,
                    });
                } else if name == "resultMap" && in_statement.is_none() && in_sql_fragment.is_none() {
                    let id = get_attribute(e, "id").unwrap_or_default();
                    result_maps.push(ParsedResultMap { id, line });
                } else {
                    if let Some(ref mut s) = in_statement {
                        let a = attrs_string(e);
                        s.sql_content.push_str(&format!("<{}{}/>", name, a));
                    }
                    if let Some(ref mut s) = in_sql_fragment {
                        let a = attrs_string(e);
                        s.content.push_str(&format!("<{}{}/>", name, a));
                    }
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => return Err(ParseError::XmlError(e.to_string())),
            _ => {}
        }
        buf.clear();
    }
    Ok(ParsedMapper { namespace, statements, result_maps, sql_fragments })
}

#[cfg(test)]
mod tests {
    use super::*;

    const SIMPLE_MAPPER: &str = r#"<?xml version="1.0" encoding="UTF-8" ?>
<mapper namespace="com.example.mapper.UserMapper">
    <select id="selectById" resultType="com.example.model.User">
        SELECT * FROM user WHERE id = #{id}
    </select>
    <insert id="insert">
        INSERT INTO user (name, email) VALUES (#{name}, #{email})
    </insert>
    <update id="updateById">
        UPDATE user SET name = #{name} WHERE id = #{id}
    </update>
    <delete id="deleteById">
        DELETE FROM user WHERE id = #{id}
    </delete>
</mapper>"#;

    #[test]
    fn parses_namespace() {
        let result = parse_mapper(SIMPLE_MAPPER).unwrap();
        assert_eq!(result.namespace, "com.example.mapper.UserMapper");
    }

    #[test]
    fn parses_all_statement_types() {
        let result = parse_mapper(SIMPLE_MAPPER).unwrap();
        assert_eq!(result.statements.len(), 4);
        let ids: Vec<&str> = result.statements.iter().map(|s| s.id.as_str()).collect();
        assert!(ids.contains(&"selectById"));
        assert!(ids.contains(&"insert"));
        assert!(ids.contains(&"updateById"));
        assert!(ids.contains(&"deleteById"));
    }

    #[test]
    fn parses_statement_types() {
        let result = parse_mapper(SIMPLE_MAPPER).unwrap();
        let types: Vec<&str> = result.statements.iter().map(|s| s.statement_type.as_str()).collect();
        assert!(types.contains(&"select"));
        assert!(types.contains(&"insert"));
        assert!(types.contains(&"update"));
        assert!(types.contains(&"delete"));
    }

    #[test]
    fn extracts_sql_content() {
        let result = parse_mapper(SIMPLE_MAPPER).unwrap();
        let select = result.statements.iter().find(|s| s.id == "selectById").unwrap();
        assert!(select.sql_content.contains("SELECT * FROM user"));
        assert!(select.sql_content.contains("#{id}"));
    }

    #[test]
    fn parses_result_map() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8" ?>
<mapper namespace="com.example.mapper.UserMapper">
    <resultMap id="userResultMap" type="com.example.model.User">
        <id property="id" column="id"/>
    </resultMap>
    <select id="selectById" resultMap="userResultMap">
        SELECT * FROM user WHERE id = #{id}
    </select>
</mapper>"#;
        let result = parse_mapper(xml).unwrap();
        assert_eq!(result.result_maps.len(), 1);
        assert_eq!(result.result_maps[0].id, "userResultMap");
    }

    #[test]
    fn parses_sql_fragments() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8" ?>
<mapper namespace="com.example.mapper.UserMapper">
    <sql id="baseColumns">id, name, email</sql>
    <select id="selectById">
        SELECT <include refid="baseColumns"/> FROM user WHERE id = #{id}
    </select>
</mapper>"#;
        let result = parse_mapper(xml).unwrap();
        assert_eq!(result.sql_fragments.len(), 1);
        assert_eq!(result.sql_fragments[0].id, "baseColumns");
        assert!(result.sql_fragments[0].content.contains("id, name, email"));
    }

    #[test]
    fn handles_cdata() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8" ?>
<mapper namespace="com.example.mapper.UserMapper">
    <select id="selectById">
        <![CDATA[SELECT * FROM user WHERE id > #{id}]]>
    </select>
</mapper>"#;
        let result = parse_mapper(xml).unwrap();
        let select = result.statements.iter().find(|s| s.id == "selectById").unwrap();
        assert!(select.sql_content.contains("SELECT * FROM user WHERE id > #{id}"));
    }

    #[test]
    fn handles_empty_statement() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8" ?>
<mapper namespace="com.example.mapper.UserMapper">
    <select id="countAll" resultType="int"/>
</mapper>"#;
        let result = parse_mapper(xml).unwrap();
        assert_eq!(result.statements.len(), 1);
        assert_eq!(result.statements[0].id, "countAll");
        assert_eq!(result.statements[0].statement_type, "select");
    }

    #[test]
    fn extracts_result_map_attribute() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8" ?>
<mapper namespace="com.example.mapper.UserMapper">
    <select id="selectWithMap" resultMap="userResultMap">
        SELECT * FROM user
    </select>
</mapper>"#;
        let result = parse_mapper(xml).unwrap();
        let select = result.statements.iter().find(|s| s.id == "selectWithMap").unwrap();
        assert_eq!(select.result_map.as_deref(), Some("userResultMap"));
    }

    #[test]
    fn returns_error_on_invalid_xml() {
        let result = parse_mapper("<mapper><broken");
        assert!(result.is_err());
    }

    #[test]
    fn empty_mapper_returns_empty_results() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8" ?>
<mapper namespace="com.example.EmptyMapper">
</mapper>"#;
        let result = parse_mapper(xml).unwrap();
        assert_eq!(result.namespace, "com.example.EmptyMapper");
        assert!(result.statements.is_empty());
        assert!(result.result_maps.is_empty());
        assert!(result.sql_fragments.is_empty());
    }
}

pub fn parse_mapper_file(path: &Path) -> Result<ParsedMapper, String> {
    let content = std::fs::read_to_string(path)
        .map_err(|e| format!("Failed to read {}: {}", path.display(), e))?;
    parse_mapper(&content).map_err(|e| e.to_string())
}
