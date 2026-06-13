/** @vitest-environment jsdom */
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readWorkspaceFile } from "../../../services/tauri";
import { useFilePreview } from "./useFilePreview";

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) => `asset://${path}`,
}));

vi.mock("../../../services/tauri", () => ({
  readWorkspaceFile: vi.fn(),
}));

describe("useFilePreview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads text preview content and inserts selected lines", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValueOnce({
      content: "first\nsecond\nthird",
      truncated: false,
    });
    const onInsertText = vi.fn();
    const target = document.createElement("button");
    target.getBoundingClientRect = () =>
      ({
        top: 100,
        left: 300,
        height: 24,
        width: 100,
        bottom: 124,
        right: 400,
        x: 300,
        y: 100,
        toJSON: () => ({}),
      }) as DOMRect;

    const { result } = renderHook(() =>
      useFilePreview({
        workspaceId: "workspace-1",
        resolvePath: (path) => `/workspace/${path}`,
        onInsertText,
      }),
    );

    act(() => {
      result.current.open("src/index.ts", target);
    });

    await waitFor(() => {
      expect(result.current.content).toBe("first\nsecond\nthird");
    });

    act(() => {
      result.current.setSelection({ start: 1, end: 2 });
    });
    act(() => {
      result.current.addSelection();
    });

    expect(onInsertText).toHaveBeenCalledWith(
      "src/index.ts:L2-L3\n```typescript\nsecond\nthird\n```",
    );
  });
});
