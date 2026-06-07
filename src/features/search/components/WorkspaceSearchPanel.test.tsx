// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { searchWorkspaceText } from "../../../services/tauri";

const defaultSearchResponse = {
  files: [
    {
      path: "src/index.ts",
      match_count: 2,
      matches: [
        {
          line: 3,
          column: 15,
          end_column: 23,
          preview: "const codemoss = createApp();",
        },
      ],
    },
  ],
  file_count: 1,
  match_count: 2,
  limit_hit: false,
  next_cursor: null,
  invalid_cursor: false,
};

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (key === "files.searchResultsSummary" && params) {
        return `${params.files} 个文件中有 ${params.matches} 个结果`;
      }
      return key;
    },
  }),
}));

vi.mock("../../../services/tauri", async () => {
  const actual = await vi.importActual<typeof import("../../../services/tauri")>(
    "../../../services/tauri",
  );
  return {
    ...actual,
    searchWorkspaceText: vi.fn(),
  };
});

let WorkspaceSearchPanel: typeof import("./WorkspaceSearchPanel").WorkspaceSearchPanel;

beforeAll(async () => {
  ({ WorkspaceSearchPanel } = await import("./WorkspaceSearchPanel"));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("WorkspaceSearchPanel", () => {
  beforeEach(() => {
    vi.mocked(searchWorkspaceText).mockResolvedValue(defaultSearchResponse);
  });

  it("renders as an independent panel tab view", () => {
    render(
      <WorkspaceSearchPanel
        workspaceId="workspace-1"
        filePanelMode="search"
        onFilePanelModeChange={() => undefined}
        onOpenFile={() => undefined}
      />,
    );

    expect(screen.getByRole("searchbox", { name: "files.filterPlaceholder" })).toBeTruthy();
  });

  it("runs workspace text search and opens a result at line and column", async () => {
    const onOpenFile = vi.fn();
    render(
      <WorkspaceSearchPanel
        workspaceId="workspace-1"
        filePanelMode="search"
        onFilePanelModeChange={() => undefined}
        onOpenFile={onOpenFile}
      />,
    );

    fireEvent.change(screen.getByRole("searchbox", { name: "files.filterPlaceholder" }), {
      target: { value: "codemoss" },
    });

    await waitFor(() => {
      expect(searchWorkspaceText).toHaveBeenCalledWith("workspace-1", {
        query: "codemoss",
        caseSensitive: false,
        wholeWord: false,
        isRegex: false,
        includePattern: null,
        excludePattern: null,
      });
    });

    expect(screen.getByText("src/index.ts")).toBeTruthy();
    expect(screen.getByText(/const codemoss = createApp\(\);/)).toBeTruthy();

    fireEvent.click(screen.getByText(/const codemoss = createApp\(\);/));
    expect(onOpenFile).toHaveBeenCalledWith("src/index.ts", { line: 3, column: 15 });
  });

  it("shows include and exclude inputs when expanding search options", () => {
    render(
      <WorkspaceSearchPanel
        workspaceId="workspace-1"
        filePanelMode="search"
        onFilePanelModeChange={() => undefined}
        onOpenFile={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "files.searchDetails" }));
    expect(screen.getByLabelText("files.includePattern")).toBeTruthy();
    expect(screen.getByLabelText("files.excludePattern")).toBeTruthy();
  });

  it("keeps advanced controls and open location when response includes pagination fields", async () => {
    vi.mocked(searchWorkspaceText).mockResolvedValueOnce({
      files: [
        {
          path: "src/search/palette.ts",
          match_count: 1,
          matches: [
            {
              line: 42,
              column: 7,
              end_column: 14,
              preview: "export const PaletteMatch = true;",
            },
          ],
        },
      ],
      file_count: 1,
      match_count: 1,
      limit_hit: false,
      next_cursor: "cursor-next",
      invalid_cursor: false,
    });

    const onOpenFile = vi.fn();
    render(
      <WorkspaceSearchPanel
        workspaceId="workspace-1"
        filePanelMode="search"
        onFilePanelModeChange={() => undefined}
        onOpenFile={onOpenFile}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "files.searchDetails" }));
    fireEvent.click(screen.getByRole("button", { name: "files.matchCase" }));
    fireEvent.click(screen.getByRole("button", { name: "files.matchWholeWord" }));
    fireEvent.click(screen.getByRole("button", { name: "files.useRegex" }));
    fireEvent.change(screen.getByLabelText("files.includePattern"), {
      target: { value: "src/**/*.ts" },
    });
    fireEvent.change(screen.getByLabelText("files.excludePattern"), {
      target: { value: "node_modules/**" },
    });
    fireEvent.change(screen.getByRole("searchbox", { name: "files.filterPlaceholder" }), {
      target: { value: "PaletteMatch" },
    });

    await waitFor(() => {
      expect(searchWorkspaceText).toHaveBeenCalledWith("workspace-1", {
        query: "PaletteMatch",
        caseSensitive: true,
        wholeWord: true,
        isRegex: true,
        includePattern: "src/**/*.ts",
        excludePattern: "node_modules/**",
      });
    });

    fireEvent.click(screen.getByText(/export const PaletteMatch = true;/));
    expect(onOpenFile).toHaveBeenCalledWith("src/search/palette.ts", { line: 42, column: 7 });
  });
});
