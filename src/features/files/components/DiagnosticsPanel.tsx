import type { DiagnosticEntry } from "../hooks/useDiagnostics";

type DiagnosticsPanelProps = {
  diagnostics: DiagnosticEntry[];
  isLoading: boolean;
  error: string | null;
  onNavigate?: (filePath: string, line: number | null, column: number | null) => void;
};

const SEVERITY_STYLES: Record<string, { color: string; bg: string }> = {
  error: { color: "#ff4d4f", bg: "#fff2f0" },
  warning: { color: "#faad14", bg: "#fffbe6" },
  info: { color: "#1890ff", bg: "#e6f7ff" },
};

export function DiagnosticsPanel({ diagnostics, isLoading, error, onNavigate }: DiagnosticsPanelProps) {
  if (isLoading && diagnostics.length === 0) {
    return (
      <div className="fvp-diagnostics-panel" style={{ padding: 8, color: "#8c8c8c", fontSize: 12 }}>
        Loading diagnostics...
      </div>
    );
  }

  if (error) {
    return (
      <div className="fvp-diagnostics-panel" style={{ padding: 8 }}>
        <div
          style={{
            padding: "4px 8px",
            background: "#fff2f0",
            border: "1px solid #ffccc7",
            borderRadius: 4,
            fontSize: 12,
            color: "#ff4d4f",
          }}
        >
          {error}
        </div>
      </div>
    );
  }

  if (diagnostics.length === 0) {
    return (
      <div className="fvp-diagnostics-panel" style={{ padding: 8, color: "#8c8c8c", fontSize: 12 }}>
        No diagnostics
      </div>
    );
  }

  // Group by severity
  const errors = diagnostics.filter((d) => d.severity === "error");
  const warnings = diagnostics.filter((d) => d.severity === "warning");
  const infos = diagnostics.filter((d) => d.severity === "info");

  return (
    <div className="fvp-diagnostics-panel" style={{ maxHeight: 200, overflow: "auto" }}>
      {[
        { items: errors, label: "Errors" },
        { items: warnings, label: "Warnings" },
        { items: infos, label: "Info" },
      ].map(({ items, label }) =>
        items.length > 0 ? (
          <div key={label} style={{ marginBottom: 4 }}>
            <div
              style={{
                padding: "2px 8px",
                fontSize: 11,
                fontWeight: 600,
                color: "#8c8c8c",
                textTransform: "uppercase",
              }}
            >
              {label} ({items.length})
            </div>
            {items.map((diag, index) => {
              const style = SEVERITY_STYLES[diag.severity];
              return (
                <div
                  key={`${diag.source}-${diag.filePath}-${diag.line}-${index}`}
                  style={{
                    padding: "4px 8px",
                    fontSize: 12,
                    cursor: onNavigate ? "pointer" : "default",
                    borderBottom: "1px solid #f0f0f0",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 6,
                  }}
                  onClick={() => {
                    if (onNavigate) {
                      onNavigate(diag.filePath, diag.line, diag.column);
                    }
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      backgroundColor: style.color,
                      marginTop: 4,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: "#262626" }}>{diag.message}</div>
                    <div style={{ color: "#8c8c8c", fontSize: 11 }}>
                      {diag.source === "jdtls" ? "Java" : "MyBatis"}
                      {diag.line != null ? ` @ L${diag.line}` : ""}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null,
      )}
    </div>
  );
}
