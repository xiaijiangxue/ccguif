// @vitest-environment jsdom
import { createRef, type ComponentProps } from "react";
import { fireEvent, render, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ComposerInput } from "./ComposerInput";

function renderComposerInput(overrides: Partial<ComponentProps<typeof ComposerInput>> = {}) {
  const textareaRef = createRef<HTMLTextAreaElement>();
  return render(
    <ComposerInput
      text=""
      disabled={false}
      sendLabel="Send"
      canStop={false}
      canSend={false}
      isProcessing={false}
      onStop={() => {}}
      onSend={() => {}}
      onTextChange={() => {}}
      onSelectionChange={() => {}}
      onKeyDown={() => {}}
      textareaRef={textareaRef}
      suggestionsOpen={false}
      suggestions={[]}
      highlightIndex={0}
      onHighlightIndex={() => {}}
      onSelectSuggestion={() => {}}
      selectedEngine="codex"
      collaborationModes={[]}
      collaborationModesEnabled={false}
      selectedCollaborationModeId={null}
      onSelectCollaborationMode={() => {}}
      permissionMode="bypassPermissions"
      onModeSelect={() => {}}
      {...overrides}
    />,
  );
}

describe("ComposerInput collaboration mode", () => {
  it("shows the mode menu badge for codex engine", () => {
    const view = renderComposerInput({ collaborationModesEnabled: false });

    expect(view.container.querySelector(".composer-mode-badge")).toBeTruthy();
  });

  it("shows the mode menu badge for Claude engine", () => {
    const view = renderComposerInput({ selectedEngine: "claude", collaborationModesEnabled: true });

    expect(view.container.querySelector(".composer-mode-badge")).toBeTruthy();
  });

  it("switches from codex code to plan through the mode menu", () => {
    const onSelectCollaborationMode = vi.fn();
    const view = renderComposerInput({
      selectedCollaborationModeId: "code",
      onSelectCollaborationMode,
    });

    fireEvent.click(view.container.querySelector(".composer-mode-badge") as HTMLElement);
    fireEvent.click(view.container.querySelector('.selector-option[data-mode-id="plan"]') as HTMLElement);

    expect(onSelectCollaborationMode).toHaveBeenCalledWith("plan");
  });

  it("switches from codex plan to code through the mode menu", () => {
    const onSelectCollaborationMode = vi.fn();
    const onModeSelect = vi.fn();
    const view = renderComposerInput({
      selectedCollaborationModeId: "plan",
      onSelectCollaborationMode,
      onModeSelect,
    });

    fireEvent.click(view.container.querySelector(".composer-mode-badge") as HTMLElement);
    fireEvent.click(view.container.querySelector('.selector-option[data-mode-id="bypassPermissions"]') as HTMLElement);

    expect(onSelectCollaborationMode).toHaveBeenCalledWith("code");
    expect(onModeSelect).toHaveBeenCalledWith("bypassPermissions");
  });

  it("shows Claude default copy for an empty Claude reasoning effort", () => {
    const view = renderComposerInput({
      selectedEngine: "claude",
      reasoningSupported: true,
      reasoningOptions: ["low", "medium", "high", "xhigh", "max"],
      selectedEffort: null,
      onSelectEffort: vi.fn(),
    });

    expect(within(view.container).getAllByText("Claude 默认").length).toBeGreaterThan(0);
  });
});
