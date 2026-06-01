// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLiquidGlassEffect } from "./useLiquidGlassEffect";

const windowApiMock = vi.hoisted(() => ({
  clearEffects: vi.fn(),
  setEffects: vi.fn(),
  getCurrentWindow: vi.fn(),
}));

vi.mock("@tauri-apps/api/window", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tauri-apps/api/window")>();
  return {
    ...actual,
    getCurrentWindow: windowApiMock.getCurrentWindow,
  };
});

describe("useLiquidGlassEffect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    windowApiMock.setEffects.mockResolvedValue(undefined);
    windowApiMock.clearEffects.mockResolvedValue(undefined);
    windowApiMock.getCurrentWindow.mockReturnValue({
      setEffects: windowApiMock.setEffects,
      clearEffects: windowApiMock.clearEffects,
    });
  });

  it("keeps native blur effects disabled for whole-window opacity mode", async () => {
    renderHook(() =>
      useLiquidGlassEffect({
        reduceTransparency: false,
      }),
    );

    await waitFor(() => {
      expect(windowApiMock.clearEffects).toHaveBeenCalled();
    });
    expect(windowApiMock.setEffects).not.toHaveBeenCalled();
  });

  it("clears effects when transparency is reduced", async () => {
    renderHook(() =>
      useLiquidGlassEffect({
        reduceTransparency: true,
      }),
    );

    await waitFor(() => {
      expect(windowApiMock.clearEffects).toHaveBeenCalled();
    });
  });

  it("records bounded client diagnostics instead of throwing when native effects fail", async () => {
    const onDebug = vi.fn();
    windowApiMock.clearEffects.mockRejectedValue(new Error("unsupported"));

    renderHook(() =>
      useLiquidGlassEffect({
        reduceTransparency: false,
        onDebug,
      }),
    );

    await waitFor(() => {
      expect(onDebug).toHaveBeenCalledWith(
        expect.objectContaining({
          source: "client",
          label: "window-effects/clear-warning",
          payload: "unsupported",
        }),
      );
    });
  });
});
