/** @vitest-environment jsdom */
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  detectJavaProject,
  getJdtlsDidOpen,
} from "../../../services/tauri";
import { useJdtlsWarmup } from "./useJdtlsWarmup";

vi.mock("../../../services/tauri", () => ({
  detectJavaProject: vi.fn(),
  getJdtlsDidOpen: vi.fn(),
}));

describe("useJdtlsWarmup", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("starts JDTLS through didOpen for detected Java projects", async () => {
    vi.mocked(detectJavaProject).mockResolvedValue({
      isJavaProject: true,
      buildSystem: "maven",
    });
    vi.mocked(getJdtlsDidOpen).mockResolvedValue();

    renderHook(() =>
      useJdtlsWarmup({
        workspaceId: "ws-1",
        workspacePath: "/repo",
        filePath: "src/Main.java",
        fileContent: "class Main {}",
        isJavaFile: true,
      }),
    );

    await waitFor(() => {
      expect(detectJavaProject).toHaveBeenCalledWith("/repo");
      expect(getJdtlsDidOpen).toHaveBeenCalledWith("ws-1", {
        filePath: "src/Main.java",
        content: "class Main {}",
      });
    });
  });

  it("does not detect or start for non-Java files", () => {
    renderHook(() =>
      useJdtlsWarmup({
        workspaceId: "ws-1",
        workspacePath: "/repo",
        filePath: "src/main.ts",
        fileContent: "export {}",
        isJavaFile: false,
      }),
    );

    expect(detectJavaProject).not.toHaveBeenCalled();
    expect(getJdtlsDidOpen).not.toHaveBeenCalled();
  });
});
