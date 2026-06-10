// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SearchResult } from "../features/search/types";
import type { AppSettings, WorkspaceInfo } from "../types";
import { useAppShellSearchRadarSection } from "./useAppShellSearchRadarSection";

type PaletteContentSearchMockResult = {
  contentResults: SearchResult[];
  status: "idle" | "loading" | "ready" | "degraded";
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
};

const prewarmSessionRadarForWorkspaceMock = vi.hoisted(() => vi.fn());
const useUnifiedSearchMock = vi.hoisted(() => vi.fn(() => []));
const getWorkspaceFilesMock = vi.hoisted(() =>
  vi.fn<() => Promise<{ files: string[] }>>(async () => ({ files: [] })),
);
const usePaletteContentSearchMock = vi.hoisted(() =>
  vi.fn<() => PaletteContentSearchMockResult>(() => ({
    contentResults: [],
    status: "idle",
    error: null,
    hasMore: false,
    loadMore: vi.fn(),
  })),
);
const isBackgroundRenderGatingEnabledMock = vi.hoisted(() => vi.fn(() => true));

vi.mock("../features/app/hooks/useComposerInsert", () => ({
  useComposerInsert: vi.fn(() => vi.fn()),
}));

vi.mock("../features/composer/hooks/useInputHistoryStore", () => ({
  loadHistoryWithImportance: vi.fn(() => []),
}));

vi.mock("../features/search/hooks/useUnifiedSearch", () => ({
  useUnifiedSearch: useUnifiedSearchMock,
}));

vi.mock("../features/search/hooks/usePaletteContentSearch", () => ({
  usePaletteContentSearch: usePaletteContentSearchMock,
}));

vi.mock("../features/threads/utils/realtimePerfFlags", () => ({
  isBackgroundRenderGatingEnabled: isBackgroundRenderGatingEnabledMock,
}));

vi.mock("../features/session-activity/hooks/useWorkspaceSessionActivity", () => ({
  useWorkspaceSessionActivity: vi.fn(() => ({ sections: [] })),
}));

vi.mock("../features/session-activity/hooks/useSessionRadarFeed", () => ({
  useSessionRadarFeed: vi.fn(() => ({
    runningSessions: [],
    recentCompletedSessions: [],
    runningCountByWorkspaceId: {},
    recentCountByWorkspaceId: {},
  })),
}));

vi.mock("../features/session-activity/utils/performanceCompatibility", () => ({
  isPerformanceCompatibilityModeEnabled: vi.fn((settings) =>
    settings?.performanceCompatibilityModeEnabled === true
  ),
}));

vi.mock("../features/workspaces/hooks/useWorkspaceSessionProjectionSummary", () => ({
  useWorkspaceSessionProjectionSummary: vi.fn(() => ({
    summary: { ownerWorkspaceIds: ["ws-1"] },
  })),
}));

vi.mock("./useWorkspaceThreadListHydration", () => ({
  useWorkspaceThreadListHydration: vi.fn(() => ({
    ensureWorkspaceThreadListLoaded: vi.fn(),
    hydratedThreadListWorkspaceIdsRef: { current: {} },
    listThreadsForWorkspaceTracked: vi.fn(),
    prewarmSessionRadarForWorkspace: prewarmSessionRadarForWorkspaceMock,
  })),
}));

vi.mock("../services/clientStorage", () => ({
  getClientStoreSync: vi.fn(() => null),
  writeClientStoreValue: vi.fn(),
}));

vi.mock("../services/systemNotification", () => ({
  sendSystemNotification: vi.fn(),
}));

vi.mock("../services/tauri", () => ({
  getWorkspaceFiles: getWorkspaceFilesMock,
}));

function createWorkspace(id: string, name: string): WorkspaceInfo {
  return {
    id,
    name,
    path: `/tmp/${id}`,
    settings: { sidebarCollapsed: false },
    connected: true,
    kind: "main",
  } as unknown as WorkspaceInfo;
}

function createBaseOptions(workspace = createWorkspace("ws-1", "Workspace 1")) {
  return {
    activeDraft: "",
    activeItems: [],
    activeThreadId: null,
    activeWorkspace: workspace,
    activeWorkspaceId: workspace.id,
    appSettings: { systemNotificationEnabled: false } as AppSettings,
    commands: [],
    composerInputRef: { current: null },
    completionTrackerBySessionRef: { current: {} },
    completionTrackerReadyRef: { current: false },
    directories: [],
    filePanelMode: "git" as const,
    files: [],
    globalSearchFilesByWorkspace: {},
    handleDraftChange: vi.fn(),
    isCompact: false,
    isFilesLoading: false,
    isProcessing: false,
    isSearchPaletteOpen: true,
    kanbanTasks: [],
    lastAgentMessageByThread: {},
    listThreadsForWorkspace: vi.fn(async () => {}),
    rightPanelCollapsed: false,
    searchContentFilters: ["all" as const],
    searchMatchOptions: { caseSensitive: false, wholeWord: false },
    searchPaletteQuery: "needle",
    searchScope: "active-workspace" as const,
    setGlobalSearchFilesByWorkspace: vi.fn(),
    skills: [],
    t: (key: string) => key,
    threadItemsByThread: {},
    threadListLoadingByWorkspace: {},
    threadParentById: {},
    threadStatusById: {},
    threadsByWorkspace: {},
    workspaces: [workspace],
    workspacesById: new Map([[workspace.id, workspace]]),
  };
}

describe("useAppShellSearchRadarSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prewarmSessionRadarForWorkspaceMock.mockReset();
    useUnifiedSearchMock.mockClear();
    usePaletteContentSearchMock.mockClear();
    usePaletteContentSearchMock.mockReturnValue({
      contentResults: [],
      status: "idle",
      error: null,
      hasMore: false,
      loadMore: vi.fn(),
    });
    isBackgroundRenderGatingEnabledMock.mockReset();
    isBackgroundRenderGatingEnabledMock.mockReturnValue(true);
    getWorkspaceFilesMock.mockReset();
    getWorkspaceFilesMock.mockResolvedValue({ files: [] });
  });

  it("keeps recent thread titles aligned with sidebar thread summaries", () => {
    const workspace = createWorkspace("ws-1", "Workspace 1");
    const appSettings = {
      systemNotificationEnabled: false,
    } as AppSettings;

    const { result } = renderHook(() =>
      useAppShellSearchRadarSection({
        activeDraft: "",
        activeItems: [],
        activeThreadId: null,
        activeWorkspace: workspace,
        activeWorkspaceId: "ws-1",
        appSettings,
        commands: [],
        composerInputRef: { current: null },
        completionTrackerBySessionRef: { current: {} },
        completionTrackerReadyRef: { current: false },
        directories: [],
        filePanelMode: "radar",
        files: [],
        globalSearchFilesByWorkspace: {},
        handleDraftChange: vi.fn(),
        isCompact: false,
        isFilesLoading: false,
        isProcessing: false,
        isSearchPaletteOpen: false,
        kanbanTasks: [],
        lastAgentMessageByThread: {},
        listThreadsForWorkspace: vi.fn(async () => {}),
        rightPanelCollapsed: false,
        searchContentFilters: [],
        searchMatchOptions: { caseSensitive: false, wholeWord: false },
        searchPaletteQuery: "",
        searchScope: "active-workspace",
        setGlobalSearchFilesByWorkspace: vi.fn(),
        skills: [],
        t: (key: string) => key,
        threadItemsByThread: {},
        threadListLoadingByWorkspace: {},
        threadParentById: {},
        threadStatusById: {},
        threadsByWorkspace: {
          "ws-1": [
            {
              id: "codex-agent-1",
              name: "项目分析",
              updatedAt: 2_000,
              engineSource: "codex",
              isDegraded: true,
              partialSource: "local-session-scan-unavailable",
              degradedReason: "partial-thread-list",
            },
            {
              id: "codex-agent-2",
              name: "Agent 20",
              updatedAt: 1_000,
              engineSource: "codex",
            },
          ],
        },
        workspaces: [workspace],
        workspacesById: new Map([[workspace.id, workspace]]),
      }),
    );

    expect(result.current.recentThreads).toEqual([
      expect.objectContaining({
        id: "codex-agent-1",
        threadId: "codex-agent-1",
        title: "项目分析",
        updatedAt: 2_000,
      }),
      expect.objectContaining({
        id: "codex-agent-2",
        threadId: "codex-agent-2",
        title: "Agent 20",
        updatedAt: 1_000,
      }),
    ]);
  });

  it("prewarms session radar through the orchestrated hydration path when radar is visible", () => {
    const workspace = createWorkspace("ws-1", "Workspace 1");
    const appSettings = {
      systemNotificationEnabled: false,
    } as AppSettings;

    renderHook(() =>
      useAppShellSearchRadarSection({
        activeDraft: "",
        activeItems: [],
        activeThreadId: null,
        activeWorkspace: workspace,
        activeWorkspaceId: "ws-1",
        appSettings,
        commands: [],
        composerInputRef: { current: null },
        completionTrackerBySessionRef: { current: {} },
        completionTrackerReadyRef: { current: false },
        directories: [],
        filePanelMode: "radar",
        files: [],
        globalSearchFilesByWorkspace: {},
        handleDraftChange: vi.fn(),
        isCompact: false,
        isFilesLoading: false,
        isProcessing: false,
        isSearchPaletteOpen: false,
        kanbanTasks: [],
        lastAgentMessageByThread: {},
        listThreadsForWorkspace: vi.fn(async () => {}),
        rightPanelCollapsed: false,
        searchContentFilters: [],
        searchMatchOptions: { caseSensitive: false, wholeWord: false },
        searchPaletteQuery: "",
        searchScope: "active-workspace",
        setGlobalSearchFilesByWorkspace: vi.fn(),
        skills: [],
        t: (key: string) => key,
        threadItemsByThread: {},
        threadListLoadingByWorkspace: {},
        threadParentById: {},
        threadStatusById: {},
        threadsByWorkspace: {},
        workspaces: [workspace],
        workspacesById: new Map([[workspace.id, workspace]]),
      }),
    );

    expect(prewarmSessionRadarForWorkspaceMock).toHaveBeenCalledWith("ws-1");
  });

  it("does not feed hot thread items into search while the palette is closed", () => {
    const workspace = createWorkspace("ws-1", "Workspace 1");
    const appSettings = {
      systemNotificationEnabled: false,
    } as AppSettings;

    renderHook(() =>
      useAppShellSearchRadarSection({
        activeDraft: "",
        activeItems: [],
        activeThreadId: "thread-1",
        activeWorkspace: workspace,
        activeWorkspaceId: "ws-1",
        appSettings,
        commands: [],
        composerInputRef: { current: null },
        completionTrackerBySessionRef: { current: {} },
        completionTrackerReadyRef: { current: false },
        directories: [],
        filePanelMode: "git",
        files: [],
        globalSearchFilesByWorkspace: {},
        handleDraftChange: vi.fn(),
        isCompact: false,
        isFilesLoading: false,
        isProcessing: true,
        isSearchPaletteOpen: false,
        kanbanTasks: [],
        lastAgentMessageByThread: {},
        listThreadsForWorkspace: vi.fn(async () => {}),
        rightPanelCollapsed: false,
        searchContentFilters: [],
        searchMatchOptions: { caseSensitive: false, wholeWord: false },
        searchPaletteQuery: "",
        searchScope: "active-workspace",
        setGlobalSearchFilesByWorkspace: vi.fn(),
        skills: [],
        t: (key: string) => key,
        threadItemsByThread: {
          "thread-1": [
            {
              id: "item-1",
              kind: "message",
              role: "assistant",
              text: "streaming output",
            },
          ],
        },
        threadListLoadingByWorkspace: {},
        threadParentById: {},
        threadStatusById: {
          "thread-1": {
            isProcessing: true,
          },
        },
        threadsByWorkspace: {
          "ws-1": [{ id: "thread-1", name: "Thread", updatedAt: 1 }],
        },
        workspaces: [workspace],
        workspacesById: new Map([[workspace.id, workspace]]),
      }),
    );

    expect(useUnifiedSearchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        threadItemsByThread: {},
      }),
    );
  });

  it("passes palette content results into unified search for shared sorting", () => {
    const workspace = createWorkspace("ws-1", "Workspace 1");
    const contentResult: SearchResult = {
      id: "content:ws-1:file.ts:1:1:needle",
      kind: "content" as const,
      title: "file.ts",
      subtitle: "needle",
      score: 100,
      workspaceId: "ws-1",
      sourceKind: "content" as const,
    };
    usePaletteContentSearchMock.mockReturnValue({
      contentResults: [contentResult],
      status: "ready",
      error: null,
      hasMore: false,
      loadMore: vi.fn(),
    });

    renderHook(() =>
      useAppShellSearchRadarSection(createBaseOptions(workspace)),
    );

    expect(usePaletteContentSearchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        query: "needle",
        scope: "active-workspace",
        contentFilters: ["all"],
        activeWorkspaceId: "ws-1",
        isPaletteOpen: true,
      }),
    );
    expect(useUnifiedSearchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        externalResults: [contentResult],
      }),
    );
  });

  it("passes match options into palette content and unified search", () => {
    const workspace = createWorkspace("ws-1", "Workspace 1");
    const matchOptions = { caseSensitive: true, wholeWord: true };

    renderHook(() =>
      useAppShellSearchRadarSection({
        ...createBaseOptions(workspace),
        searchMatchOptions: matchOptions,
      }),
    );

    expect(usePaletteContentSearchMock).toHaveBeenCalledWith(
      expect.objectContaining({ matchOptions }),
    );
    expect(useUnifiedSearchMock).toHaveBeenCalledWith(
      expect.objectContaining({ matchOptions }),
    );
  });

  it("uses full workspace file index for current-scope file palette search", async () => {
    const workspace = createWorkspace("ws-1", "Workspace 1");
    getWorkspaceFilesMock.mockResolvedValue({
      files: ["icon/sousuo.svg", "src/app-shell.tsx"],
    });

    renderHook(() =>
      useAppShellSearchRadarSection({
        ...createBaseOptions(workspace),
        files: ["README.md"],
        searchPaletteQuery: "sousuo",
        searchScope: "active-workspace",
      }),
    );

    await waitFor(() => {
      expect(useUnifiedSearchMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          workspaceSources: [
            expect.objectContaining({
              workspaceId: "ws-1",
              files: ["icon/sousuo.svg", "src/app-shell.tsx"],
            }),
          ],
        }),
      );
    });
  });
});
