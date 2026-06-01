import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { DebugEntry } from "../../../types";

type Params = {
  reduceTransparency: boolean;
  onDebug?: (entry: DebugEntry) => void;
};

export function useLiquidGlassEffect({
  reduceTransparency,
  onDebug,
}: Params) {
  useEffect(() => {
    let cancelled = false;

    const apply = async () => {
      try {
        const window = getCurrentWindow();
        await window.clearEffects();
      } catch (error) {
        if (cancelled || !onDebug) {
          return;
        }
        onDebug({
          id: `${Date.now()}-client-window-effects-clear-warning`,
          timestamp: Date.now(),
          source: "client",
          label: "window-effects/clear-warning",
          payload: error instanceof Error ? error.message : String(error),
        });
      }
    };

    void apply();

    return () => {
      cancelled = true;
    };
  }, [onDebug, reduceTransparency]);
}
