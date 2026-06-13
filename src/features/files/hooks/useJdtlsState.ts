import { useEffect, useRef, useState } from "react";
import { getJdtlsStatus, type JdtlsStatus } from "../../../services/tauri";

const POLL_INTERVAL_MS = 5_000;

export type JdtlsProviderState = {
  status: "starting" | "downloading" | "indexing" | "ready" | "unavailable" | "stopped" | "unknown";
  javaVersion: string | null;
  error: string | null;
  uptimeSeconds: number | null;
  openFilesCount: number;
};

const INITIAL_STATE: JdtlsProviderState = {
  status: "unknown",
  javaVersion: null,
  error: null,
  uptimeSeconds: null,
  openFilesCount: 0,
};

function mapStatus(raw: JdtlsStatus): JdtlsProviderState {
  return {
    status: raw.status as JdtlsProviderState["status"],
    javaVersion: raw.javaVersion,
    error: raw.error,
    uptimeSeconds: raw.uptimeSeconds,
    openFilesCount: raw.openFilesCount,
  };
}

export function useJdtlsState() {
  const [state, setState] = useState<JdtlsProviderState>(INITIAL_STATE);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      if (!mountedRef.current) return;
      try {
        const status = await getJdtlsStatus();
        if (mountedRef.current) {
          setState(mapStatus(status));
        }
      } catch {
        if (mountedRef.current) {
          setState((prev) =>
            prev.status === "unknown" ? { ...prev, status: "unavailable" } : prev,
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
  }, []);

  return state;
}
