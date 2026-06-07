export function reportSearchMetrics(payload: {
  query: string;
  elapsedMs: number;
  resultCount: number;
}): void {
  const isTestMode = (() => {
    try {
      return import.meta.env.MODE === "test";
    } catch {
      return false;
    }
  })();
  if (!import.meta.env.DEV) {
    return;
  }
  if (isTestMode) {
    return;
  }
  if (typeof console === "undefined") {
    return;
  }
  if (payload.query.trim().length === 0) {
    return;
  }
  console.debug("[search]", {
    q: payload.query,
    ms: payload.elapsedMs,
    count: payload.resultCount,
  });
}

export function reportPaletteContentSearchMetrics(payload: {
  query: string;
  workspaceCount: number;
  elapsedMs: number;
  resultCount: number;
  status: "success" | "degraded";
}): void {
  const isTestMode = (() => {
    try {
      return import.meta.env.MODE === "test";
    } catch {
      return false;
    }
  })();
  if (!import.meta.env.DEV || isTestMode || typeof console === "undefined") {
    return;
  }
  if (payload.query.trim().length === 0) {
    return;
  }
  console.debug("[search][content]", {
    q: payload.query,
    workspaces: payload.workspaceCount,
    ms: payload.elapsedMs,
    count: payload.resultCount,
    status: payload.status,
  });
}
