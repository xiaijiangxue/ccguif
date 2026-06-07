import type { Virtualizer } from "@tanstack/react-virtual";
import { describe, expect, it, vi } from "vitest";
import {
  estimateTimelineProjectionRowSize,
  estimateTimelineProjectionRenderWeight,
  observeTimelineElementOffset,
  shouldIncludeTimelineProjectionRowInVirtualWindow,
  shouldVirtualizeTimelineRows,
  TIMELINE_VIRTUALIZATION_MIN_RENDER_WEIGHT,
  TIMELINE_VIRTUALIZATION_MIN_ROWS,
} from "./messagesTimelineVirtualization";
import type { TimelineProjectionRow } from "./messagesTimelineProjection";

describe("messagesTimelineVirtualization", () => {
  it("enables virtualization only for long stable timelines", () => {
    expect(shouldVirtualizeTimelineRows({
      isThinking: false,
      rowCount: TIMELINE_VIRTUALIZATION_MIN_ROWS,
    })).toBe(true);
    expect(shouldVirtualizeTimelineRows({
      isThinking: false,
      rowCount: TIMELINE_VIRTUALIZATION_MIN_ROWS - 1,
    })).toBe(false);
  });

  it("keeps active streaming timelines out of row-count virtualization", () => {
    expect(shouldVirtualizeTimelineRows({
      isThinking: true,
      rowCount: TIMELINE_VIRTUALIZATION_MIN_ROWS * 2,
    })).toBe(false);
  });

  it("keeps active streaming timelines out of render-weight virtualization", () => {
    expect(shouldVirtualizeTimelineRows({
      isThinking: true,
      rowCount: 12,
      renderWeight: TIMELINE_VIRTUALIZATION_MIN_RENDER_WEIGHT,
    })).toBe(false);
  });

  it("enables render-weight virtualization only for stable timelines", () => {
    expect(shouldVirtualizeTimelineRows({
      isThinking: false,
      rowCount: 12,
      renderWeight: TIMELINE_VIRTUALIZATION_MIN_RENDER_WEIGHT,
    })).toBe(true);
  });

  it("estimates grouped tool rows near their collapsed timeline height", () => {
    const singleRow: TimelineProjectionRow = {
      kind: "entry",
      key: "item:message:1",
      entry: {
        kind: "item",
        item: { id: "message-1", kind: "message", role: "assistant", text: "hello" },
      },
      itemIds: ["message-1"],
      hasActiveUserInputAnchor: false,
    };
    const groupRow: TimelineProjectionRow = {
      kind: "entry",
      key: "readGroup:1:2:2",
      entry: {
        kind: "readGroup",
        items: [
          {
            id: "tool-1",
            kind: "tool",
            toolType: "Read",
            title: "Read",
            detail: "a.ts",
            status: "completed",
          },
          {
            id: "tool-2",
            kind: "tool",
            toolType: "Read",
            title: "Read",
            detail: "b.ts",
            status: "completed",
          },
        ],
      },
      itemIds: ["tool-1", "tool-2"],
      hasActiveUserInputAnchor: false,
    };

    expect(estimateTimelineProjectionRowSize(groupRow)).toBeLessThan(
      estimateTimelineProjectionRowSize(singleRow),
    );
  });

  it("estimates compact file-change groups near their collapsed timeline height", () => {
    const groupRow: TimelineProjectionRow = {
      kind: "entry",
      key: "fileChangeGroup:1:2:2",
      entry: {
        kind: "fileChangeGroup",
        items: [
          {
            id: "tool-1",
            kind: "tool",
            toolType: "fileChange",
            title: "File changes",
            detail: "",
            status: "completed",
            changes: [{ path: "a.ts", kind: "modified", diff: "@@ -1 +1 @@\n-a\n+b" }],
          },
          {
            id: "tool-2",
            kind: "tool",
            toolType: "fileChange",
            title: "File changes",
            detail: "",
            status: "completed",
            changes: [{ path: "b.ts", kind: "modified", diff: "@@ -1 +1 @@\n-a\n+b" }],
          },
        ],
      },
      itemIds: ["tool-1", "tool-2"],
      hasActiveUserInputAnchor: false,
    };

    expect(estimateTimelineProjectionRowSize(groupRow)).toBeLessThan(96);
  });

  it("assigns high render weight to image-heavy message rows", () => {
    const imageRow: TimelineProjectionRow = {
      kind: "entry",
      key: "item:message:image",
      entry: {
        kind: "item",
        item: {
          id: "message-image",
          kind: "message",
          role: "user",
          text: "screenshot",
          images: ["data:image/png;base64,AAA", "data:image/png;base64,BBB"],
        },
      },
      itemIds: ["message-image"],
      hasActiveUserInputAnchor: false,
    };

    expect(estimateTimelineProjectionRenderWeight(imageRow)).toBeGreaterThan(40);
  });

  it("excludes rows that render as null from the virtual window", () => {
    const bashGroupRow: TimelineProjectionRow = {
      kind: "entry",
      key: "bashGroup:1:2:2",
      entry: {
        kind: "bashGroup",
        items: [
          {
            id: "tool-1",
            kind: "tool",
            toolType: "commandExecution",
            title: "Bash",
            detail: "npm test",
            status: "completed",
          },
          {
            id: "tool-2",
            kind: "tool",
            toolType: "commandExecution",
            title: "Bash",
            detail: "npm run typecheck",
            status: "completed",
          },
        ],
      },
      itemIds: ["tool-1", "tool-2"],
      hasActiveUserInputAnchor: false,
    };
    const commandToolRow: TimelineProjectionRow = {
      kind: "entry",
      key: "item:tool:tool-3:",
      entry: {
        kind: "item",
        item: {
          id: "tool-3",
          kind: "tool",
          toolType: "commandExecution",
          title: "Bash",
          detail: "npm test",
          status: "completed",
        },
      },
      itemIds: ["tool-3"],
      hasActiveUserInputAnchor: false,
    };
    const encryptedReasoningRow: TimelineProjectionRow = {
      kind: "entry",
      key: "item:reasoning:reasoning-1:",
      entry: {
        kind: "item",
        item: {
          id: "reasoning-1",
          kind: "reasoning",
          summary: "Encrypted reasoning",
          content: "",
        },
      },
      itemIds: ["reasoning-1"],
      hasActiveUserInputAnchor: false,
    };
    const visibleMessageRow: TimelineProjectionRow = {
      kind: "entry",
      key: "item:message:message-1:",
      entry: {
        kind: "item",
        item: { id: "message-1", kind: "message", role: "assistant", text: "hello" },
      },
      itemIds: ["message-1"],
      hasActiveUserInputAnchor: false,
    };
    const codexInput = {
      activeEngine: "codex" as const,
      claudeHistoryTranscriptFallbackActive: false,
    };

    expect(
      shouldIncludeTimelineProjectionRowInVirtualWindow(bashGroupRow, codexInput),
    ).toBe(false);
    expect(
      shouldIncludeTimelineProjectionRowInVirtualWindow(commandToolRow, codexInput),
    ).toBe(false);
    expect(
      shouldIncludeTimelineProjectionRowInVirtualWindow(encryptedReasoningRow, codexInput),
    ).toBe(false);
    expect(
      shouldIncludeTimelineProjectionRowInVirtualWindow(visibleMessageRow, codexInput),
    ).toBe(true);
  });

  it("keeps hidden rows in the virtual window when they carry the active input anchor", () => {
    const commandToolRow: TimelineProjectionRow = {
      kind: "entry",
      key: "item:tool:tool-anchored:",
      entry: {
        kind: "item",
        item: {
          id: "tool-anchored",
          kind: "tool",
          toolType: "commandExecution",
          title: "Bash",
          detail: "npm test",
          status: "completed",
        },
      },
      itemIds: ["tool-anchored"],
      hasActiveUserInputAnchor: true,
    };

    expect(
      shouldIncludeTimelineProjectionRowInVirtualWindow(commandToolRow, {
        activeEngine: "codex",
        claudeHistoryTranscriptFallbackActive: false,
      }),
    ).toBe(true);
  });

  it("clears pending scroll-end fallback when virtualizer unmounts", () => {
    const listeners = new Map<string, EventListener>();
    const element = {
      scrollLeft: 0,
      scrollTop: 240,
      addEventListener: vi.fn((eventName: string, listener: EventListener) => {
        listeners.set(eventName, listener);
      }),
      removeEventListener: vi.fn(),
    } as unknown as Element & { scrollLeft: number; scrollTop: number };
    const setTimeoutSpy = vi.fn(() => 7);
    const clearTimeoutSpy = vi.fn();
    const targetWindow = {
      setTimeout: setTimeoutSpy,
      clearTimeout: clearTimeoutSpy,
    } as unknown as Window & typeof globalThis;
    const instance = {
      scrollElement: element,
      targetWindow,
      options: {
        horizontal: false,
        isRtl: false,
        isScrollingResetDelay: 150,
        useScrollendEvent: false,
      },
    } as Virtualizer<Element, Element>;
    const callback = vi.fn();

    const cleanup = observeTimelineElementOffset(instance, callback);
    listeners.get("scroll")?.(new Event("scroll"));
    cleanup?.();

    expect(callback).toHaveBeenCalledWith(240, true);
    expect(setTimeoutSpy).toHaveBeenCalled();
    expect(clearTimeoutSpy).toHaveBeenCalledWith(7);
  });
});
