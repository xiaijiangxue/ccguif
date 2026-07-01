// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  resetClientStorageForTests,
  writeClientStoreValue,
} from "../../../services/clientStorage";
import type { TodoItem } from "../types";
import { useTodoFloatingState } from "./useTodoFloatingState";

function todos(items: Array<{ content: string; status: TodoItem["status"] }>): TodoItem[] {
  return items;
}

describe("useTodoFloatingState", () => {
  beforeEach(() => {
    resetClientStorageForTests();
    vi.mocked(writeClientStoreValue).mockClear();
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1024,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: 768,
    });
  });

  it("hides when the current session has no todo data", () => {
    const { result } = renderHook(() => useTodoFloatingState([], "session-empty"));

    expect(result.current.visibility).toBe("hidden");
    expect(result.current.summaryText).toBe("待办 0/0");
  });

  it("shows active todos collapsed by default with summary text", () => {
    const { result } = renderHook(() =>
      useTodoFloatingState(
        todos([
            { content: "done", status: "completed" },
            { content: "working", status: "in_progress" },
            { content: "later", status: "pending" },
        ]),
        "session-active",
      ),
    );

    expect(result.current.visibility).toBe("collapsed");
    expect(result.current.summaryText).toBe("待办 1/3");
    expect(result.current.position).toEqual({ x: 728, y: 16 });
  });

  it("migrates the old bottom-right default position to the top-right default", () => {
    writeClientStoreValue("layout", "ccgui.todoFloating.position", {
      x: 728,
      y: 592,
    });

    const { result } = renderHook(() =>
      useTodoFloatingState(
        todos([{ content: "working", status: "in_progress" }]),
        "session-legacy-position",
      ),
    );

    expect(result.current.position).toEqual({ x: 728, y: 16 });
  });

  it("forces all-completed todos into collapsed summary state", () => {
    const { result } = renderHook(() =>
      useTodoFloatingState(
        todos([
            { content: "done", status: "completed" },
            { content: "also done", status: "completed" },
        ]),
        "session-done",
      ),
    );

    act(() => {
      result.current.toggleExpand();
    });

    expect(result.current.visibility).toBe("collapsed");
    expect(result.current.summaryText).toBe("待办 2/2");
  });

  it("persists expansion separately per session", () => {
    const activeItems = todos([{ content: "working", status: "in_progress" }]);
    const hook = renderHook(
      ({ sessionId }: { sessionId: string }) =>
        useTodoFloatingState(activeItems, sessionId),
      {
        initialProps: { sessionId: "session-a" },
      },
    );

    act(() => {
      hook.result.current.toggleExpand();
    });
    expect(hook.result.current.visibility).toBe("expanded");

    hook.rerender({ sessionId: "session-b" });
    expect(hook.result.current.visibility).toBe("collapsed");

    hook.rerender({ sessionId: "session-a" });
    expect(hook.result.current.visibility).toBe("expanded");
  });

  it("clamps and persists dragged position", () => {
    const { result, unmount } = renderHook(() =>
      useTodoFloatingState(
        todos([{ content: "working", status: "in_progress" }]),
        "session-position",
      ),
    );

    act(() => {
      result.current.setPosition({ x: 4000, y: 3000 });
    });

    expect(result.current.position).toEqual({ x: 744, y: 608 });
    unmount();

    const next = renderHook(() =>
      useTodoFloatingState(
        todos([{ content: "working", status: "in_progress" }]),
        "session-position",
      ),
    );
    expect(next.result.current.position).toEqual({ x: 744, y: 608 });
  });

  it("clamps dragged position to the provided center content bounds", () => {
    const { result } = renderHook(() =>
      useTodoFloatingState(
        todos([{ content: "working", status: "in_progress" }]),
        "session-center-bounds",
        { width: 640, height: 520 },
      ),
    );

    act(() => {
      result.current.setPosition({ x: 900, y: 700 });
    });

    expect(result.current.position).toEqual({ x: 360, y: 360 });
  });
});
