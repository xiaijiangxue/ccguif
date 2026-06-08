// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { searchWorkspaceText } from "../../../services/tauri";
import {
  PALETTE_CONTENT_SEARCH_MAX_CONCURRENCY,
  SEARCH_DEBOUNCE_MS,
} from "../perf/limits";
import { usePaletteContentSearch } from "./usePaletteContentSearch";
import type { PaletteContentSearchWorkspace } from "./usePaletteContentSearch";

vi.mock("../../../services/tauri", async () => {
  const actual = await vi.importActual<typeof import("../../../services/tauri")>(
    "../../../services/tauri",
  );
  return {
    ...actual,
    searchWorkspaceText: vi.fn(),
  };
});

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });
  return { promise, resolve, reject };
}

function response(path: string, cursor: string | null = null) {
  return {
    files: [
      {
        path,
        match_count: 1,
        matches: [
          {
            line: 7,
            column: 3,
            end_column: 8,
            preview: `match in ${path}`,
          },
        ],
      },
    ],
    file_count: 1,
    match_count: 1,
    limit_hit: Boolean(cursor),
    next_cursor: cursor,
    invalid_cursor: false,
  };
}

function fullPageResponse(path: string) {
  return {
    files: [
      {
        path,
        match_count: 20,
        matches: Array.from({ length: 20 }, (_, index) => ({
          line: index + 1,
          column: 3,
          end_column: 8,
          preview: `match ${index + 1} in ${path}`,
        })),
      },
    ],
    file_count: 1,
    match_count: 20,
    limit_hit: true,
    next_cursor: null,
    invalid_cursor: false,
  };
}

function workspaces(count: number): PaletteContentSearchWorkspace[] {
  return Array.from({ length: count }, (_, index) => ({
    workspaceId: `ws-${index + 1}`,
    workspaceName: `Workspace ${index + 1}`,
    recentRank: index,
  }));
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

async function advanceSearchDebounce() {
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, SEARCH_DEBOUNCE_MS + 10);
    });
    await flushPromises();
  });
}

describe("usePaletteContentSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not call backend for short queries", async () => {
    const searchWorkspaces = workspaces(1);
    renderHook(() =>
      usePaletteContentSearch({
        query: "ab",
        scope: "global",
        contentFilters: ["all"],
        workspaces: searchWorkspaces,
        activeWorkspaceId: "ws-1",
        isPaletteOpen: true,
      }),
    );

    await advanceSearchDebounce();

    expect(searchWorkspaceText).not.toHaveBeenCalled();
  });

  it("does not call backend when content is filtered out", async () => {
    const searchWorkspaces = workspaces(1);
    renderHook(() =>
      usePaletteContentSearch({
        query: "abc",
        scope: "global",
        contentFilters: ["skills"],
        workspaces: searchWorkspaces,
        activeWorkspaceId: "ws-1",
        isPaletteOpen: true,
      }),
    );

    await advanceSearchDebounce();

    expect(searchWorkspaceText).not.toHaveBeenCalled();
  });

  it("does not call backend for file path-only filtering", async () => {
    const searchWorkspaces = workspaces(1);
    renderHook(() =>
      usePaletteContentSearch({
        query: "abc",
        scope: "global",
        contentFilters: ["files"],
        workspaces: searchWorkspaces,
        activeWorkspaceId: "ws-1",
        isPaletteOpen: true,
      }),
    );

    await advanceSearchDebounce();

    expect(searchWorkspaceText).not.toHaveBeenCalled();
  });

  it("calls backend for the dedicated content filter", async () => {
    vi.mocked(searchWorkspaceText).mockResolvedValue(response("content.ts"));
    const searchWorkspaces = workspaces(1);
    const { result } = renderHook(() =>
      usePaletteContentSearch({
        query: "abc",
        scope: "global",
        contentFilters: ["content"],
        workspaces: searchWorkspaces,
        activeWorkspaceId: "ws-1",
        isPaletteOpen: true,
        matchOptions: { caseSensitive: true, wholeWord: true },
      }),
    );

    await advanceSearchDebounce();
    await act(async () => {
      await flushPromises();
    });

    expect(searchWorkspaceText).toHaveBeenCalledWith(
      "ws-1",
      expect.objectContaining({
        query: "abc",
        caseSensitive: true,
        wholeWord: true,
      }),
    );
    expect(result.current.contentResults[0]?.kind).toBe("content");
  });

  it("ignores stale responses after query changes", async () => {
    const first = deferred<ReturnType<typeof response>>();
    const second = deferred<ReturnType<typeof response>>();
    vi.mocked(searchWorkspaceText)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const searchWorkspaces = workspaces(1);

    const { result, rerender } = renderHook(
      ({ query }) =>
        usePaletteContentSearch({
          query,
          scope: "active-workspace",
          contentFilters: ["all"],
          workspaces: searchWorkspaces,
          activeWorkspaceId: "ws-1",
          isPaletteOpen: true,
        }),
      { initialProps: { query: "abc" } },
    );

    await advanceSearchDebounce();
    rerender({ query: "abcd" });
    await advanceSearchDebounce();

    await act(async () => {
      first.resolve(response("old.ts"));
      await Promise.resolve();
    });
    expect(result.current.contentResults).toEqual([]);

    await act(async () => {
      second.resolve(response("new.ts"));
      await Promise.resolve();
    });

    await act(async () => {
      await flushPromises();
    });
    expect(result.current.contentResults[0]?.filePath).toBe("new.ts");
  });

  it("bounds global workspace concurrency and waits for load-more before continuing FIFO", async () => {
    const pending = Array.from({ length: 5 }, () =>
      deferred<ReturnType<typeof response>>(),
    );
    const pendingQueue = [...pending];
    vi.mocked(searchWorkspaceText).mockImplementation(
      (_workspaceId) => pendingQueue.shift()!.promise,
    );
    const searchWorkspaces = workspaces(5);

    const { result } = renderHook(() =>
      usePaletteContentSearch({
        query: "abc",
        scope: "global",
        contentFilters: ["all"],
        workspaces: searchWorkspaces,
        activeWorkspaceId: "ws-1",
        isPaletteOpen: true,
      }),
    );

    await advanceSearchDebounce();

    expect(searchWorkspaceText).toHaveBeenCalledTimes(
      PALETTE_CONTENT_SEARCH_MAX_CONCURRENCY,
    );

    await act(async () => {
      pending[0].resolve(response("one.ts"));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(searchWorkspaceText).toHaveBeenCalledTimes(
      PALETTE_CONTENT_SEARCH_MAX_CONCURRENCY,
    );

    act(() => {
      result.current.loadMore();
    });

    expect(searchWorkspaceText).toHaveBeenCalledTimes(
      PALETTE_CONTENT_SEARCH_MAX_CONCURRENCY + 2,
    );
    expect(vi.mocked(searchWorkspaceText).mock.calls[3]?.[0]).toBe("ws-4");
    expect(vi.mocked(searchWorkspaceText).mock.calls[4]?.[0]).toBe("ws-5");
  });

  it("pauses global workspace queue after the first content batch capacity is covered", async () => {
    vi.mocked(searchWorkspaceText).mockImplementation((workspaceId) =>
      Promise.resolve(fullPageResponse(`${workspaceId}.ts`)),
    );
    const searchWorkspaces = workspaces(6);

    const { result } = renderHook(() =>
      usePaletteContentSearch({
        query: "abc",
        scope: "global",
        contentFilters: ["all"],
        workspaces: searchWorkspaces,
        activeWorkspaceId: "ws-1",
        isPaletteOpen: true,
      }),
    );

    await advanceSearchDebounce();
    await act(async () => {
      await flushPromises();
    });

    expect(searchWorkspaceText).toHaveBeenCalledTimes(3);
    expect(result.current.contentResults).toHaveLength(50);
    expect(result.current.hasMore).toBe(true);

    act(() => {
      result.current.loadMore();
    });
    await act(async () => {
      await flushPromises();
    });

    expect(searchWorkspaceText).toHaveBeenCalledWith(
      "ws-4",
      expect.objectContaining({ query: "abc" }),
    );
  });

  it("falls back to global search when current scope has no active workspace", async () => {
    vi.mocked(searchWorkspaceText).mockResolvedValue(response("global.ts"));
    const searchWorkspaces = workspaces(2);

    renderHook(() =>
      usePaletteContentSearch({
        query: "abc",
        scope: "active-workspace",
        contentFilters: ["all"],
        workspaces: searchWorkspaces,
        activeWorkspaceId: null,
        isPaletteOpen: true,
      }),
    );

    await advanceSearchDebounce();

    expect(searchWorkspaceText).toHaveBeenCalledWith(
      "ws-1",
      expect.objectContaining({ query: "abc" }),
    );
    expect(searchWorkspaceText).toHaveBeenCalledWith(
      "ws-2",
      expect.objectContaining({ query: "abc" }),
    );
  });

  it("loads the next cursor page on demand", async () => {
    vi.mocked(searchWorkspaceText)
      .mockResolvedValueOnce(response("first.ts", "cursor-2"))
      .mockResolvedValueOnce(response("second.ts", null));
    const searchWorkspaces = workspaces(1);

    const { result } = renderHook(() =>
      usePaletteContentSearch({
        query: "abc",
        scope: "active-workspace",
        contentFilters: ["all"],
        workspaces: searchWorkspaces,
        activeWorkspaceId: "ws-1",
        isPaletteOpen: true,
      }),
    );

    await advanceSearchDebounce();
    await act(async () => {
      await flushPromises();
    });
    expect(result.current.hasMore).toBe(true);

    act(() => {
      result.current.loadMore();
    });

    await act(async () => {
      await flushPromises();
    });
    expect(searchWorkspaceText).toHaveBeenLastCalledWith(
      "ws-1",
      expect.objectContaining({ cursor: "cursor-2" }),
    );
    expect(result.current.contentResults.map((item) => item.filePath)).toEqual([
      "first.ts",
      "second.ts",
    ]);
  });

  it("keeps successful workspace results when another workspace fails", async () => {
    vi.mocked(searchWorkspaceText)
      .mockResolvedValueOnce(response("ok.ts"))
      .mockRejectedValueOnce(new Error("scan failed"));
    const searchWorkspaces = workspaces(2);

    const { result } = renderHook(() =>
      usePaletteContentSearch({
        query: "abc",
        scope: "global",
        contentFilters: ["all"],
        workspaces: searchWorkspaces,
        activeWorkspaceId: "ws-1",
        isPaletteOpen: true,
      }),
    );

    await advanceSearchDebounce();

    await act(async () => {
      await flushPromises();
    });
    expect(result.current.status).toBe("degraded");
    expect(result.current.error).toBe("scan failed");
    expect(result.current.contentResults[0]?.filePath).toBe("ok.ts");
  });
});
