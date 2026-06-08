/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Composer } from "./Composer";
import type { ComposerSendReadiness } from "../utils/composerSendReadiness";
import type { ContextSelectionChip } from "./ChatInputBox/types";

vi.mock("../../../services/dragDrop", () => ({
  subscribeWindowDragDrop: vi.fn(() => () => {}),
}));

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) => `tauri://${path}`,
  invoke: vi.fn(async () => null),
}));

vi.mock("../../engine/components/EngineSelector", () => ({
  EngineSelector: () => null,
}));

vi.mock("../../opencode/components/OpenCodeControlPanel", () => ({
  OpenCodeControlPanel: () => null,
}));

vi.mock("./ChatInputBox/ChatInputBoxAdapter", () => ({
  ChatInputBoxAdapter: ({
    onTextChange,
    onSend,
    onManualMemorySelect,
    onSelectSkill,
    selectedContextChips,
    sendReadiness,
  }: {
    onTextChange: (next: string, cursor: number | null) => void;
    onSend: () => void;
    sendReadiness?: ComposerSendReadiness | null;
    onSelectSkill?: (skillName: string) => void;
    selectedContextChips?: ContextSelectionChip[];
    onManualMemorySelect?: (memory: {
      id: string;
      title: string;
      summary: string;
      detail: string;
      kind: string;
      importance: string;
      updatedAt: number;
      tags: string[];
    }) => void;
  }) => (
    <div>
      <button
        type="button"
        data-testid="fill-text"
        onClick={() => onTextChange("hello", 5)}
      >
        fill
      </button>
      <button
        type="button"
        data-testid="select-manual-memory"
        onClick={() =>
          onManualMemorySelect?.({
            id: "memory-1",
            title: "Known issue",
            summary: "summary",
            detail: "用户输入：Question\n\n助手输出摘要：Answer",
            kind: "known_issue",
            importance: "high",
            updatedAt: 1,
            tags: [],
          })
        }
      >
        memory
      </button>
      <button
        type="button"
        data-testid="select-skill"
        onClick={() => onSelectSkill?.("ce-plan")}
      >
        skill
      </button>
      <button type="button" data-testid="send-message" onClick={() => onSend()}>
        send
      </button>
      <div data-testid="selected-context-chips">
        {(selectedContextChips ?? []).map((chip) => `${chip.type}:${chip.name}`).join(",")}
      </div>
      <div data-testid="readiness-context-summary">
        {sendReadiness?.contextSummary.compactLabel ?? ""}
      </div>
    </div>
  ),
}));

function renderComposer({
  activeThreadId = "thread-1",
  onSend = vi.fn(() => Promise.resolve()),
}: {
  activeThreadId?: string;
  onSend?: ReturnType<typeof vi.fn>;
} = {}) {
  return render(createComposerElement(activeThreadId, onSend));
}

function createComposerElement(
  activeThreadId: string,
  onSend: ReturnType<typeof vi.fn>,
) {
  return (
    <Composer
      onSend={onSend}
      onQueue={() => {}}
      onStop={() => {}}
      canStop={false}
      isProcessing={false}
      steerEnabled={false}
      collaborationModes={[]}
      collaborationModesEnabled={true}
      selectedCollaborationModeId={null}
      onSelectCollaborationMode={() => {}}
      selectedEngine="claude"
      models={[]}
      selectedModelId={null}
      onSelectModel={() => {}}
      reasoningOptions={[]}
      selectedEffort={null}
      onSelectEffort={() => {}}
      reasoningSupported={false}
      accessMode="current"
      onSelectAccessMode={() => {}}
      skills={[{ name: "ce-plan", path: "/skills/ce-plan/SKILL.md" }]}
      prompts={[]}
      commands={[]}
      files={[]}
      draftText=""
      onDraftChange={() => {}}
      dictationEnabled={false}
      activeWorkspaceId="ws-1"
      activeThreadId={activeThreadId}
    />
  );
}

describe("Composer context ledger transitions", () => {
  afterEach(() => {
    cleanup();
  });

  it("restores selected context chips when switching back to a session", async () => {
    const onSend = vi.fn(() => Promise.resolve());
    const view = renderComposer({ onSend });

    await act(async () => {
      fireEvent.click(screen.getByTestId("fill-text"));
      fireEvent.click(screen.getByTestId("select-skill"));
    });

    expect(screen.getByTestId("readiness-context-summary").textContent).toBe(
      "items:1 · groups:1",
    );
    expect(screen.getByTestId("selected-context-chips").textContent).toBe(
      "skill:ce-plan",
    );
    expect(view.container.querySelector(".composer-context-stack")).toBeTruthy();
    expect(view.container.querySelector(".composer-context-ledger")).toBeNull();
    expect(screen.queryByRole("region", { name: "composer.contextLedgerTitle" })).toBeNull();

    view.rerender(createComposerElement("thread-2", onSend));

    expect(screen.getByTestId("readiness-context-summary").textContent).toBe(
      "no-extra-context",
    );
    expect(screen.getByTestId("selected-context-chips").textContent).toBe("");
    expect(view.container.querySelector(".composer-context-stack")).toBeNull();

    view.rerender(createComposerElement("thread-1", onSend));

    expect(screen.getByTestId("selected-context-chips").textContent).toBe(
      "skill:ce-plan",
    );
    expect(screen.getByTestId("readiness-context-summary").textContent).toBe(
      "items:1 · groups:1",
    );
  });
});
