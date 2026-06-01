import { useEffect, useRef, useState } from "react";
import { getClientStoreSync, writeClientStoreValue } from "../../../services/clientStorage";
import { appendRendererDiagnostic } from "../../../services/rendererDiagnostics";
import { setMainWindowOpacity } from "../../../services/tauri";

export const WINDOW_OPACITY_DEFAULT = 88;
export const WINDOW_OPACITY_MIN = 55;
export const WINDOW_OPACITY_MAX = 100;

export function clampWindowOpacity(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return WINDOW_OPACITY_DEFAULT;
  }
  return Math.min(
    WINDOW_OPACITY_MAX,
    Math.max(WINDOW_OPACITY_MIN, Math.round(value)),
  );
}

export function useTransparencyPreference() {
  const [reduceTransparency, setReduceTransparency] = useState(() => {
    const stored = getClientStoreSync<boolean>("layout", "reduceTransparency");
    // Default to true (reduce transparency enabled) if not set
    if (stored === undefined) {
      return true;
    }
    return stored;
  });
  const [windowOpacity, setWindowOpacityState] = useState(() =>
    clampWindowOpacity(getClientStoreSync<number>("layout", "windowOpacity")),
  );

  useEffect(() => {
    writeClientStoreValue("layout", "reduceTransparency", reduceTransparency);
  }, [reduceTransparency]);

  useEffect(() => {
    writeClientStoreValue(
      "layout",
      "windowOpacity",
      windowOpacity,
    );
  }, [windowOpacity]);

  const windowTransparencyEnabled = !reduceTransparency;
  const appliedWindowOpacity = windowTransparencyEnabled
    ? windowOpacity / 100
    : 1;
  const hasRequestedNativeWindowOpacityRef = useRef(windowTransparencyEnabled);

  useEffect(() => {
    if (!windowTransparencyEnabled && !hasRequestedNativeWindowOpacityRef.current) {
      return;
    }
    hasRequestedNativeWindowOpacityRef.current = true;
    let cancelled = false;

    setMainWindowOpacity(appliedWindowOpacity)
      .then((result) => {
        if (cancelled || result.applied) {
          return;
        }
        appendRendererDiagnostic("window-opacity/unsupported", {
          platform: result.platform,
          reason: result.reason,
          requestedOpacity: result.requestedOpacity,
          appliedOpacity: result.appliedOpacity,
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        appendRendererDiagnostic("window-opacity/apply-error", {
          message: error instanceof Error ? error.message : String(error),
          requestedOpacity: appliedWindowOpacity,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [appliedWindowOpacity, windowTransparencyEnabled]);

  return {
    reduceTransparency,
    setReduceTransparency,
    windowTransparencyEnabled,
    setWindowTransparencyEnabled: (enabled: boolean) => {
      setReduceTransparency(!enabled);
    },
    windowOpacity,
    setWindowOpacity: (next: number) => {
      setWindowOpacityState(clampWindowOpacity(next));
    },
  };
}
