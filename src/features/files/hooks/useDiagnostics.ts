import { useEffect, useRef, useState } from "react";
import {
  getJdtlsDidOpen,
  getJdtlsDidChange,
  getJdtlsDidClose,
  getJdtlsDiagnostics,
  getMybatisValidate,
  type ValidationResult,
} from "../../../services/tauri";

export type DiagnosticSeverity = "error" | "warning" | "info";

export type DiagnosticEntry = {
  message: string;
  filePath: string;
  line: number | null;
  column: number | null;
  severity: DiagnosticSeverity;
  source: "jdtls" | "mybatis";
  issueType?: string;
};

type UseDiagnosticsArgs = {
  workspaceId: string;
  filePath: string;
  fileContent: string | null;
  isJavaFile: boolean;
  isMapperFile: boolean;
};

export function useDiagnostics({
  workspaceId,
  filePath,
  fileContent,
  isJavaFile,
  isMapperFile,
}: UseDiagnosticsArgs) {
  const [diagnostics, setDiagnostics] = useState<DiagnosticEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const currentFileRef = useRef(filePath);
  const didOpenRef = useRef(false);

  // Track current file to clean up when switching
  useEffect(() => {
    currentFileRef.current = filePath;
    didOpenRef.current = false;
    setDiagnostics([]);
    setError(null);
  }, [filePath]);

  // Close old file and open new file when content changes
  useEffect(() => {
    if (!isJavaFile || !fileContent) return;
    const messageFromError = (err: unknown) =>
      err instanceof Error ? err.message : String(err || "JDTLS request failed");
    if (didOpenRef.current) {
      // Send didChange
      void getJdtlsDidChange(workspaceId, { filePath, content: fileContent }).catch((err) => {
        if (mountedRef.current && currentFileRef.current === filePath) {
          setError(messageFromError(err));
        }
      });
    } else {
      // Send didOpen
      void getJdtlsDidOpen(workspaceId, { filePath, content: fileContent })
        .then(() => {
          if (mountedRef.current && currentFileRef.current === filePath) {
            didOpenRef.current = true;
            setError(null);
          }
        })
        .catch((err) => {
          if (mountedRef.current && currentFileRef.current === filePath) {
            setError(messageFromError(err));
          }
        });
    }
  }, [filePath, fileContent, isJavaFile, workspaceId]);

  // Fetch diagnostics for Java files
  useEffect(() => {
    if (!isJavaFile) return;
    let cancelled = false;

    async function fetchDiagnostics() {
      if (cancelled) return;
      setIsLoading(true);
      setError(null);
      try {
        const result = await getJdtlsDiagnostics(workspaceId, filePath);
        if (cancelled || currentFileRef.current !== filePath) return;
        const raw = result as unknown;
        const entries = parseJdtlsDiagnostics(raw, filePath);
        setDiagnostics(entries);
      } catch (err) {
        if (!cancelled && currentFileRef.current === filePath) {
          setError(err instanceof Error ? err.message : "Failed to fetch diagnostics");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    // Delay to allow didOpen to be processed
    const timer = setTimeout(fetchDiagnostics, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [filePath, isJavaFile, workspaceId]);

  // Fetch MyBatis validation for mapper files
  useEffect(() => {
    if (!isMapperFile && !isJavaFile) return;
    let cancelled = false;

    async function fetchValidation() {
      if (cancelled) return;
      try {
        const result: ValidationResult = await getMybatisValidate(workspaceId);
        if (cancelled || currentFileRef.current !== filePath) return;
        const entries = parseMybatisValidation(result, filePath);
        setDiagnostics((prev) => {
          // Merge with existing JDTLS diagnostics
          const jdtlsOnly = prev.filter((d) => d.source === "jdtls");
          return [...jdtlsOnly, ...entries];
        });
      } catch {
        // Validation not critical, ignore
      }
    }

    void fetchValidation();
    return () => {
      cancelled = true;
    };
  }, [filePath, isMapperFile, isJavaFile, workspaceId]);

  // Cleanup: send didClose when file changes or unmounts
  useEffect(() => {
    return () => {
      if (didOpenRef.current) {
        void getJdtlsDidClose(workspaceId, filePath).catch(() => {});
      }
    };
  }, [filePath, workspaceId]);

  // Send didClose on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (didOpenRef.current) {
        void getJdtlsDidClose(workspaceId, currentFileRef.current).catch(() => {});
      }
    };
  }, [workspaceId]);

  return {
    diagnostics,
    isLoading,
    error,
  };
}

function parseJdtlsDiagnostics(raw: unknown, filePath: string): DiagnosticEntry[] {
  if (!raw || typeof raw !== "object") return [];
  const obj = raw as Record<string, unknown>;

  // JDTLS returns either a Diagnostic[] or { diagnostics: Diagnostic[] }
  let items: unknown[];
  if (Array.isArray(obj)) {
    items = obj;
  } else if (Array.isArray(obj.diagnostics)) {
    items = obj.diagnostics;
  } else if (obj.result && typeof obj.result === "object") {
    const result = obj.result as Record<string, unknown>;
    if (Array.isArray(result.diagnostics)) {
      items = result.diagnostics;
    } else if (Array.isArray(result)) {
      items = result;
    } else {
      return [];
    }
  } else {
    return [];
  }

  return items
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => {
      const range = item.range as Record<string, unknown> | undefined;
      const start = range?.start as Record<string, unknown> | undefined;
      const severity = mapSeverity(item.severity as number | undefined);
      return {
        message: String(item.message ?? "Unknown error"),
        filePath,
        line: typeof start?.line === "number" ? start.line + 1 : null,
        column: typeof start?.character === "number" ? start.character + 1 : null,
        severity,
        source: "jdtls" as const,
      };
    });
}

function parseMybatisValidation(result: ValidationResult, filePath: string): DiagnosticEntry[] {
  const entries: DiagnosticEntry[] = [];

  for (const issue of result.errors) {
    entries.push({
      message: issue.message,
      filePath: issue.filePath || filePath,
      line: issue.line ?? null,
      column: null,
      severity: "error",
      source: "mybatis",
      issueType: issue.issueType,
    });
  }

  for (const issue of result.warnings) {
    entries.push({
      message: issue.message,
      filePath: issue.filePath || filePath,
      line: issue.line ?? null,
      column: null,
      severity: "warning",
      source: "mybatis",
      issueType: issue.issueType,
    });
  }

  return entries;
}

function mapSeverity(sev: number | undefined): DiagnosticSeverity {
  switch (sev) {
    case 1:
      return "error";
    case 2:
      return "warning";
    case 3:
    case 4:
      return "info";
    default:
      return "info";
  }
}
