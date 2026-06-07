// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SearchResult } from "../features/search/types";
import { useAppShellSearchAndComposerSection } from "./useAppShellSearchAndComposerSection";

vi.mock("../features/app/hooks/useGlobalSearchShortcut", () => ({
  useGlobalSearchShortcut: vi.fn(),
}));

vi.mock("../features/app/hooks/useInterruptShortcut", () => ({
  useInterruptShortcut: vi.fn(),
}));

vi.mock("../features/git/hooks/usePullRequestComposer", () => ({
  usePullRequestComposer: () => ({
    handleSelectPullRequest: vi.fn(),
    resetPullRequestSelection: vi.fn(),
    isPullRequestComposer: false,
    composerSendLabel: "Send",
    handleComposerSend: vi.fn(),
    handleComposerQueue: vi.fn(),
  }),
}));

vi.mock("../features/search/ranking/recencyStore", () => ({
  recordSearchResultOpen: vi.fn(),
}));

function createContentResult(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    id: "content:ws-active:src/app.ts:12:7:query",
    kind: "content",
    title: "src/app.ts",
    subtitle: "const query = value;",
    score: 10,
    workspaceId: "ws-active",
    workspaceName: "Active",
    filePath: "src/app.ts",
    line: 12,
    column: 7,
    preview: "const query = value;",
    sourceKind: "content",
    locationLabel: "src/app.ts:12:7",
    ...overrides,
  };
}

function createBoundary(overrides: Record<string, unknown> = {}) {
  return {
    activeDraft: "",
    activeWorkspace: null,
    activeWorkspaceId: "ws-active",
    appSettings: {
      interruptShortcut: "Escape",
      toggleGlobalSearchShortcut: "Meta+K",
    },
    canInterrupt: false,
    centerMode: "chat",
    clearActiveImages: vi.fn(),
    connectWorkspace: vi.fn(),
    exitDiffView: vi.fn(),
    filePanelMode: "files",
    gitPanelMode: "diff",
    gitPullRequestDiffs: [],
    handleDraftChange: vi.fn(),
    handleOpenFile: vi.fn(),
    handleSend: vi.fn(),
    interruptTurn: vi.fn(),
    isCompact: false,
    isSearchPaletteOpen: true,
    kanbanTasks: [],
    queueMessage: vi.fn(),
    searchPaletteQuery: "query",
    searchResults: [],
    searchScope: "active-workspace",
    selectWorkspace: vi.fn(),
    selectedPullRequest: null,
    sendUserMessageToThread: vi.fn(),
    setActiveTab: vi.fn(),
    setActiveThreadId: vi.fn(),
    setAppMode: vi.fn(),
    setCenterMode: vi.fn(),
    setDiffSource: vi.fn(),
    setGitPanelMode: vi.fn(),
    setIsSearchPaletteOpen: vi.fn(),
    setKanbanViewState: vi.fn(),
    setPrefillDraft: vi.fn(),
    setSearchContentFilters: vi.fn(),
    setSearchPaletteQuery: vi.fn(),
    setSearchPaletteSelectedIndex: vi.fn(),
    setSearchScope: vi.fn(),
    setSelectedCommitSha: vi.fn(),
    setSelectedDiffPath: vi.fn(),
    setSelectedKanbanTaskId: vi.fn(),
    setSelectedPullRequest: vi.fn(),
    startThreadForWorkspace: vi.fn(),
    workspacesByPath: new Map(),
    ...overrides,
  };
}

describe("useAppShellSearchAndComposerSection", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("opens selected content result at its line and column", () => {
    const handleOpenFile = vi.fn();
    const selectWorkspace = vi.fn();
    const boundary = createBoundary({ handleOpenFile, selectWorkspace });
    const contentResult = createContentResult();

    const { result } = renderHook(() =>
      useAppShellSearchAndComposerSection(boundary as never),
    );

    act(() => {
      result.current.handleSelectSearchResult(contentResult);
    });

    expect(selectWorkspace).not.toHaveBeenCalled();
    expect(handleOpenFile).toHaveBeenCalledWith("src/app.ts", { line: 12, column: 7 });
  });

  it("selects target workspace before opening cross-workspace content result", () => {
    const calls: string[] = [];
    const handleOpenFile = vi.fn(() => calls.push("open-file"));
    const selectWorkspace = vi.fn(() => calls.push("select-workspace"));
    const boundary = createBoundary({ handleOpenFile, selectWorkspace });
    const contentResult = createContentResult({
      id: "content:ws-other:README.md:3:1:query",
      workspaceId: "ws-other",
      workspaceName: "Other",
      filePath: "README.md",
      line: 3,
      column: 1,
      locationLabel: "README.md:3:1",
    });

    const { result } = renderHook(() =>
      useAppShellSearchAndComposerSection(boundary as never),
    );

    act(() => {
      result.current.handleSelectSearchResult(contentResult);
    });

    expect(selectWorkspace).toHaveBeenCalledWith("ws-other");
    expect(handleOpenFile).toHaveBeenCalledWith("README.md", { line: 3, column: 1 });
    expect(calls).toEqual(["select-workspace", "open-file"]);
  });
});
