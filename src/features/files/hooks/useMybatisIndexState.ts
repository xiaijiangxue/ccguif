import { useEffect, useRef, useState } from "react";
import { getMybatisStatus, type MybatisStatus } from "../../../services/tauri";

const POLL_INTERVAL_MS = 5_000;

export type MybatisProviderState = {
  status: "building" | "ready" | "error" | "unknown";
  statementCount: number;
  fileCount: number;
  parseErrors: number;
  annotationCount: number;
};

const INITIAL_STATE: MybatisProviderState = {
  status: "unknown",
  statementCount: 0,
  fileCount: 0,
  parseErrors: 0,
  annotationCount: 0,
};

export function useMybatisIndexState(workspaceId: string | null) {
  const [state, setState] = useState<MybatisProviderState>(INITIAL_STATE);
  const mountedRef = useRef(true);

  useEffect(() => {
    if (!workspaceId) return;
    mountedRef.current = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      if (!mountedRef.current || !workspaceId) return;
      try {
        const status: MybatisStatus = await getMybatisStatus(workspaceId);
        if (mountedRef.current) {
          setState({
            status: "ready",
            statementCount: status.statementCount,
            fileCount: status.fileCount,
            parseErrors: status.parseErrors,
            annotationCount: status.annotationCount,
          });
        }
      } catch {
        if (mountedRef.current) {
          setState((prev) =>
            prev.status === "unknown" ? { ...prev, status: "error" } : prev,
          );
        }
      }
      if (mountedRef.current) {
        timer = setTimeout(poll, POLL_INTERVAL_MS);
      }
    }

    void poll();

    return () => {
      mountedRef.current = false;
      if (timer !== null) clearTimeout(timer);
    };
  }, [workspaceId]);

  return state;
}
