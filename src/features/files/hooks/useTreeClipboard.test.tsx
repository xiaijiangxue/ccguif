/** @vitest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirm } from "@tauri-apps/plugin-dialog";
import { trashWorkspaceItem } from "../../../services/tauri";
import { useTreeClipboard } from "./useTreeClipboard";

vi.mock("@tauri-apps/plugin-dialog", () => ({
  confirm: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  revealItemInDir: vi.fn(),
}));

vi.mock("../../../services/tauri", () => ({
  duplicateWorkspaceItem: vi.fn(),
  pasteWorkspaceItem: vi.fn(),
  trashWorkspaceItem: vi.fn(),
}));

const t = (key: string, options?: Record<string, unknown>) =>
  options?.message ? `${key}:${String(options.message)}` : key;

function useHarness() {
  return useTreeClipboard({
    workspaceId: "workspace-1",
    getFileTreeItemName: (path) => path.split("/").pop() ?? path,
    resolvePath: (path) => `/workspace/${path}`,
    resolveParentFolderForNode: (path, type) => {
      if (!path || type === "folder") {
        return path ?? "";
      }
      return path.split("/").slice(0, -1).join("/");
    },
    selectSingle: vi.fn(),
    purgeDeletedFileTreePath: vi.fn(),
    openRenamePrompt: vi.fn(),
    openNewFilePrompt: vi.fn(),
    openNewFolderPrompt: vi.fn(),
    t,
  });
}

describe("useTreeClipboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("copies absolute paths through the browser clipboard API", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const { result } = renderHook(() => useHarness());

    await act(async () => {
      await result.current.copyPath("src/index.ts");
    });

    expect(writeText).toHaveBeenCalledWith("/workspace/src/index.ts");
  });

  it("trashes a confirmed item and reports success", async () => {
    vi.mocked(confirm).mockResolvedValueOnce(true);
    vi.mocked(trashWorkspaceItem).mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useHarness());

    await act(async () => {
      await result.current.trashItem("src/index.ts", false);
    });

    expect(trashWorkspaceItem).toHaveBeenCalledWith("workspace-1", "src/index.ts");
    expect(result.current.operationNotice?.tone).toBe("success");
  });
});
