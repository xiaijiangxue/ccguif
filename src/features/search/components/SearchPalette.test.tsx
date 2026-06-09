// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SearchResult } from "../types";
import { SearchPalette } from "./SearchPalette";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      if (key === "searchPalette.placeholderFiltered") {
        return `filtered:${params?.content ?? ""}`;
      }
      return key;
    },
  }),
}));

function makeResult(): SearchResult {
  return {
    id: "skill:w-1:wf-thinking",
    kind: "skill",
    title: "/wf-thinking",
    subtitle: "thinking helper",
    score: 10,
    workspaceId: "w-1",
    sourceKind: "skills",
    skillName: "wf-thinking",
    locationLabel: "/skills/wf-thinking",
  };
}

function makeContentResult(): SearchResult {
  return {
    id: "content:w-1:src/index.ts:3:15:codemoss",
    kind: "content",
    title: "src/index.ts",
    subtitle: "const codemoss = createApp();",
    score: 20,
    workspaceId: "w-1",
    workspaceName: "mossx",
    filePath: "src/index.ts",
    line: 3,
    column: 15,
    preview: "const codemoss = createApp();",
    matchedText: "codemoss",
    sourceKind: "content",
    locationLabel: "src/index.ts:3:15",
  };
}

describe("SearchPalette", () => {
  afterEach(() => {
    cleanup();
  });

  it("does not select result when pressing Enter during IME composition", () => {
    const onSelect = vi.fn();

    render(
      <SearchPalette
        isOpen
        scope="active-workspace"
        contentFilters={["all"]}
        workspaceName="mossx"
        query="nihao"
        results={[makeResult()]}
        selectedIndex={0}
        onQueryChange={() => undefined}
        onMoveSelection={() => undefined}
        onSelect={onSelect}
        onScopeChange={() => undefined}
        onContentFilterToggle={() => undefined}
        onClose={() => undefined}
      />,
    );

    const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true });
    Object.defineProperty(event, "isComposing", { value: true });
    window.dispatchEvent(event);

    expect(onSelect).not.toHaveBeenCalled();
  });

  it("does not select result when local composition is active even without event composing flags", () => {
    const onSelect = vi.fn();

    render(
      <SearchPalette
        isOpen
        scope="active-workspace"
        contentFilters={["all"]}
        workspaceName="mossx"
        query="nihao"
        results={[makeResult()]}
        selectedIndex={0}
        onQueryChange={() => undefined}
        onMoveSelection={() => undefined}
        onSelect={onSelect}
        onScopeChange={() => undefined}
        onContentFilterToggle={() => undefined}
        onClose={() => undefined}
      />,
    );

    const input = screen.getByLabelText("searchPalette.inputAria");
    fireEvent.compositionStart(input);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

    expect(onSelect).not.toHaveBeenCalled();
  });

  it("does not select result when keyCode=229 (IME fallback signal)", () => {
    const onSelect = vi.fn();

    render(
      <SearchPalette
        isOpen
        scope="active-workspace"
        contentFilters={["all"]}
        workspaceName="mossx"
        query="nihao"
        results={[makeResult()]}
        selectedIndex={0}
        onQueryChange={() => undefined}
        onMoveSelection={() => undefined}
        onSelect={onSelect}
        onScopeChange={() => undefined}
        onContentFilterToggle={() => undefined}
        onClose={() => undefined}
      />,
    );

    const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true });
    Object.defineProperty(event, "keyCode", { value: 229 });
    window.dispatchEvent(event);

    expect(onSelect).not.toHaveBeenCalled();
  });

  it("selects current result when pressing Enter outside IME composition", () => {
    const result = makeResult();
    const onSelect = vi.fn();

    render(
      <SearchPalette
        isOpen
        scope="active-workspace"
        contentFilters={["all"]}
        workspaceName="mossx"
        query="app"
        results={[result]}
        selectedIndex={0}
        onQueryChange={() => undefined}
        onMoveSelection={() => undefined}
        onSelect={onSelect}
        onScopeChange={() => undefined}
        onContentFilterToggle={() => undefined}
        onClose={() => undefined}
      />,
    );

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

    expect(onSelect).toHaveBeenCalledWith(result);
  });

  it("syncs query from composition end text", () => {
    const onQueryChange = vi.fn();

    render(
      <SearchPalette
        isOpen
        scope="active-workspace"
        contentFilters={["all"]}
        workspaceName="mossx"
        query=""
        results={[makeResult()]}
        selectedIndex={0}
        onQueryChange={onQueryChange}
        onMoveSelection={() => undefined}
        onSelect={() => undefined}
        onScopeChange={() => undefined}
        onContentFilterToggle={() => undefined}
        onClose={() => undefined}
      />,
    );

    const input = screen.getByLabelText("searchPalette.inputAria");
    fireEvent.compositionEnd(input, {
      currentTarget: { value: "你好" },
      target: { value: "你好" },
    });

    expect(onQueryChange).toHaveBeenCalledWith("你好");
  });

  it("forces empty-state rendering when query is empty even if stale results are passed", () => {
    const onSelect = vi.fn();
    const stale = makeResult();

    render(
      <SearchPalette
        isOpen
        scope="active-workspace"
        contentFilters={["all"]}
        workspaceName="mossx"
        query=""
        results={[stale]}
        selectedIndex={0}
        onQueryChange={() => undefined}
        onMoveSelection={() => undefined}
        onSelect={onSelect}
        onScopeChange={() => undefined}
        onContentFilterToggle={() => undefined}
        onClose={() => undefined}
      />,
    );

    expect(screen.queryByText(stale.title)).toBeNull();
    expect(screen.getByText("searchPalette.noResults")).toBeTruthy();

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("treats invisible-only query as empty and hides stale results", () => {
    const stale = makeResult();

    render(
      <SearchPalette
        isOpen
        scope="active-workspace"
        contentFilters={["all"]}
        workspaceName="mossx"
        query={"\u200B"}
        results={[stale]}
        selectedIndex={0}
        onQueryChange={() => undefined}
        onMoveSelection={() => undefined}
        onSelect={() => undefined}
        onScopeChange={() => undefined}
        onContentFilterToggle={() => undefined}
        onClose={() => undefined}
      />,
    );

    expect(screen.queryByText(stale.title)).toBeNull();
    expect(screen.getByText("searchPalette.noResults")).toBeTruthy();
  });

  it("keeps updating results across multiple composition rounds", () => {
    function Harness() {
      const [query, setQuery] = useState("");
      const dynamicResult: SearchResult = {
        id: "history:dynamic",
        kind: "history",
        title: query || "empty",
        score: 1,
        historyText: query,
      };
      return (
        <SearchPalette
          isOpen
          scope="active-workspace"
          contentFilters={["all"]}
          workspaceName="mossx"
          query={query}
          results={[dynamicResult]}
          selectedIndex={0}
          onQueryChange={setQuery}
          onMoveSelection={() => undefined}
          onSelect={() => undefined}
          onScopeChange={() => undefined}
          onContentFilterToggle={() => undefined}
          onClose={() => undefined}
        />
      );
    }

    render(<Harness />);

    const input = screen.getByLabelText("searchPalette.inputAria");

    fireEvent.compositionStart(input);
    fireEvent.compositionEnd(input, { target: { value: "nihao" } });
    expect(screen.getByText("nihao")).toBeTruthy();

    fireEvent.compositionStart(input);
    fireEvent.compositionEnd(input, { target: { value: "mossx" } });
    expect(screen.getByText("mossx")).toBeTruthy();

    fireEvent.compositionStart(input);
    fireEvent.compositionEnd(input, { target: { value: "search-again" } });
    expect(screen.getByText("search-again")).toBeTruthy();
  });

  it("toggles match case and whole-word options", () => {
    const onMatchOptionsChange = vi.fn();

    render(
      <SearchPalette
        isOpen
        scope="active-workspace"
        contentFilters={["all"]}
        matchOptions={{ caseSensitive: false, wholeWord: true }}
        workspaceName="mossx"
        query="clear"
        results={[makeResult()]}
        selectedIndex={0}
        onQueryChange={() => undefined}
        onMoveSelection={() => undefined}
        onSelect={() => undefined}
        onScopeChange={() => undefined}
        onContentFilterToggle={() => undefined}
        onMatchOptionsChange={onMatchOptionsChange}
        onClose={() => undefined}
      />,
    );

    const caseButton = screen.getByRole("button", {
      name: "searchPalette.matchCaseLabel",
    });
    const wholeWordButton = screen.getByRole("button", {
      name: "searchPalette.wholeWordLabel",
    });

    expect(caseButton.getAttribute("aria-pressed")).toBe("false");
    expect(wholeWordButton.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(caseButton);
    expect(onMatchOptionsChange).toHaveBeenCalledWith({
      caseSensitive: true,
      wholeWord: true,
    });

    fireEvent.click(wholeWordButton);
    expect(onMatchOptionsChange).toHaveBeenCalledWith({
      caseSensitive: false,
      wholeWord: false,
    });
  });

  it("renders content result path, preview, location, and content labels", () => {
    render(
      <SearchPalette
        isOpen
        scope="global"
        contentFilters={["all"]}
        workspaceName="mossx"
        query="codemoss"
        results={[makeContentResult()]}
        selectedIndex={0}
        onQueryChange={() => undefined}
        onMoveSelection={() => undefined}
        onSelect={() => undefined}
        onScopeChange={() => undefined}
        onContentFilterToggle={() => undefined}
        onClose={() => undefined}
      />,
    );

    expect(screen.getByText("src/index.ts")).toBeTruthy();
    const preview = document.querySelector(".search-palette-result-preview");
    expect(preview?.textContent).toBe("const codemoss = createApp();");
    const highlightedMatch = screen.getByText("codemoss");
    expect(highlightedMatch.tagName).toBe("MARK");
    expect(highlightedMatch.classList.contains("search-palette-result-highlight")).toBe(true);
    expect(screen.getAllByText("searchPalette.typeContent").length).toBeGreaterThan(0);
    expect(screen.getByText(/searchPalette.sourceTag: searchPalette.sourceContent/)).toBeTruthy();
    expect(screen.getByText(/searchPalette.locationTag: src\/index\.ts:3:15/)).toBeTruthy();
  });

  it("highlights file result title and location using provider match ranges", () => {
    render(
      <SearchPalette
        isOpen
        scope="active-workspace"
        contentFilters={["files"]}
        workspaceName="mossx"
        query="clear"
        results={[
          {
            id: "file:w-1:src/clear.ts",
            kind: "file",
            title: "src/clear.ts",
            subtitle: "File",
            score: 10,
            workspaceId: "w-1",
            sourceKind: "files",
            locationLabel: "src/clear.ts",
            titleHighlightRanges: [{ start: 4, end: 9 }],
            locationHighlightRanges: [{ start: 4, end: 9 }],
          },
        ]}
        selectedIndex={0}
        onQueryChange={() => undefined}
        onMoveSelection={() => undefined}
        onSelect={() => undefined}
        onScopeChange={() => undefined}
        onContentFilterToggle={() => undefined}
        onClose={() => undefined}
      />,
    );

    const highlightedMatches = screen.getAllByText("clear");
    expect(highlightedMatches.length).toBeGreaterThanOrEqual(2);
    highlightedMatches.forEach((match) => {
      expect(match.tagName).toBe("MARK");
      expect(match.classList.contains("search-palette-result-highlight")).toBe(true);
    });
  });

  it("highlights content preview with the current query when result has no matched text", () => {
    const resultWithoutMatchedText = {
      ...makeContentResult(),
      matchedText: undefined,
    };

    render(
      <SearchPalette
        isOpen
        scope="global"
        contentFilters={["content"]}
        workspaceName="mossx"
        query="clear"
        results={[
          {
            ...resultWithoutMatchedText,
            preview: "Clear and concise guidance",
          },
        ]}
        selectedIndex={0}
        onQueryChange={() => undefined}
        onMoveSelection={() => undefined}
        onSelect={() => undefined}
        onScopeChange={() => undefined}
        onContentFilterToggle={() => undefined}
        onClose={() => undefined}
      />,
    );

    const highlightedMatch = screen.getByText("Clear");
    expect(highlightedMatch.tagName).toBe("MARK");
    expect(highlightedMatch.classList.contains("search-palette-result-highlight")).toBe(true);
  });

  it("highlights query text inside longer matched words in content previews", () => {
    render(
      <SearchPalette
        isOpen
        scope="global"
        contentFilters={["content"]}
        workspaceName="mossx"
        query="clear"
        results={[
          {
            ...makeContentResult(),
            preview: "Use when requirements are unclear or evolving",
            matchedText: "clear",
          },
        ]}
        selectedIndex={0}
        onQueryChange={() => undefined}
        onMoveSelection={() => undefined}
        onSelect={() => undefined}
        onScopeChange={() => undefined}
        onContentFilterToggle={() => undefined}
        onClose={() => undefined}
      />,
    );

    const preview = document.querySelector(".search-palette-result-preview");
    expect(preview?.textContent).toBe("Use when requirements are unclear or evolving");
    const highlightedMatch = screen.getByText("clear");
    expect(highlightedMatch.tagName).toBe("MARK");
    expect(highlightedMatch.classList.contains("search-palette-result-highlight")).toBe(true);
  });

  it("does not highlight partial preview matches when whole-word matching is enabled", () => {
    render(
      <SearchPalette
        isOpen
        scope="global"
        contentFilters={["content"]}
        matchOptions={{ caseSensitive: false, wholeWord: true }}
        workspaceName="mossx"
        query="clear"
        results={[
          {
            ...makeContentResult(),
            preview: "Use when requirements are unclear or evolving",
            matchedText: "clear",
          },
        ]}
        selectedIndex={0}
        onQueryChange={() => undefined}
        onMoveSelection={() => undefined}
        onSelect={() => undefined}
        onScopeChange={() => undefined}
        onContentFilterToggle={() => undefined}
        onClose={() => undefined}
      />,
    );

    expect(document.querySelector(".search-palette-result-highlight")).toBeNull();
  });

  it("renders a dedicated file-content filter button", () => {
    const onContentFilterToggle = vi.fn();

    render(
      <SearchPalette
        isOpen
        scope="active-workspace"
        contentFilters={["content"]}
        workspaceName="mossx"
        query="codemoss"
        results={[makeContentResult()]}
        selectedIndex={0}
        onQueryChange={() => undefined}
        onMoveSelection={() => undefined}
        onSelect={() => undefined}
        onScopeChange={() => undefined}
        onContentFilterToggle={onContentFilterToggle}
        onClose={() => undefined}
      />,
    );

    const contentFilter = screen.getByRole("button", {
      name: "searchPalette.contentFileContent",
    });
    expect(contentFilter.classList.contains("is-active")).toBe(true);

    fireEvent.click(contentFilter);
    expect(onContentFilterToggle).toHaveBeenCalledWith("content");
  });

  it("explains why short content-only queries do not search", () => {
    render(
      <SearchPalette
        isOpen
        scope="active-workspace"
        contentFilters={["content"]}
        workspaceName="mossx"
        query="d"
        results={[]}
        selectedIndex={0}
        onQueryChange={() => undefined}
        onMoveSelection={() => undefined}
        onSelect={() => undefined}
        onScopeChange={() => undefined}
        onContentFilterToggle={() => undefined}
        onClose={() => undefined}
      />,
    );

    expect(screen.getByText("searchPalette.contentMinLengthTitle")).toBeTruthy();
    expect(screen.getByText("searchPalette.contentMinLengthHint")).toBeTruthy();
    expect(screen.queryByText("searchPalette.noResults")).toBeNull();
  });

  it("shows content loading status while keeping lightweight results visible", () => {
    render(
      <SearchPalette
        isOpen
        scope="active-workspace"
        contentFilters={["all"]}
        workspaceName="mossx"
        query="app"
        results={[makeResult()]}
        selectedIndex={0}
        contentSearchStatus="loading"
        onQueryChange={() => undefined}
        onMoveSelection={() => undefined}
        onSelect={() => undefined}
        onScopeChange={() => undefined}
        onContentFilterToggle={() => undefined}
        onClose={() => undefined}
      />,
    );

    expect(screen.getByText("/wf-thinking")).toBeTruthy();
    expect(screen.getByText("searchPalette.contentSearching")).toBeTruthy();
  });

  it("requests more content results when scrolling near the bottom", () => {
    const onLoadMoreContentResults = vi.fn();
    render(
      <SearchPalette
        isOpen
        scope="active-workspace"
        contentFilters={["all"]}
        workspaceName="mossx"
        query="codemoss"
        results={[makeContentResult()]}
        selectedIndex={0}
        hasMoreContentResults
        onQueryChange={() => undefined}
        onMoveSelection={() => undefined}
        onSelect={() => undefined}
        onScopeChange={() => undefined}
        onContentFilterToggle={() => undefined}
        onLoadMoreContentResults={onLoadMoreContentResults}
        onClose={() => undefined}
      />,
    );

    const results = document.querySelector(".search-palette-results");
    if (!results) {
      throw new Error("missing results container");
    }
    Object.defineProperty(results, "scrollHeight", { configurable: true, value: 400 });
    Object.defineProperty(results, "clientHeight", { configurable: true, value: 200 });
    Object.defineProperty(results, "scrollTop", { configurable: true, value: 160 });

    fireEvent.scroll(results);

    expect(onLoadMoreContentResults).toHaveBeenCalledTimes(1);
  });
});
