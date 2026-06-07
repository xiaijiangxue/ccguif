import { describe, expect, it } from "vitest";
import type { SearchContentFilter } from "../types";
import type { SearchResult } from "../types";
import { searchResultMatchesContentFilters, toggleSearchContentFilters } from "./contentFilters";

describe("toggleSearchContentFilters", () => {
  it("keeps all as exclusive", () => {
    const next = toggleSearchContentFilters(["files", "threads"], "all");
    expect(next).toEqual(["all"]);
  });

  it("switches from all to concrete filters", () => {
    const next = toggleSearchContentFilters(["all"], "files");
    expect(next).toEqual(["files"]);
  });

  it("supports multi-select and fallback to all when emptied", () => {
    let current: SearchContentFilter[] = ["all"];
    current = toggleSearchContentFilters(current, "files");
    current = toggleSearchContentFilters(current, "threads");
    expect(current).toEqual(["files", "threads"]);

    current = toggleSearchContentFilters(current, "files");
    expect(current).toEqual(["threads"]);

    current = toggleSearchContentFilters(current, "threads");
    expect(current).toEqual(["all"]);
  });
});

describe("searchResultMatchesContentFilters", () => {
  it("keeps content results behind the dedicated content filter", () => {
    const contentResult: SearchResult = {
      id: "content:ws:src/app.ts:1:1:q",
      kind: "content",
      title: "src/app.ts",
      score: 100,
      sourceKind: "content",
    };

    expect(searchResultMatchesContentFilters(contentResult, ["all"])).toBe(true);
    expect(searchResultMatchesContentFilters(contentResult, ["files"])).toBe(false);
    expect(searchResultMatchesContentFilters(contentResult, ["content"])).toBe(true);
    expect(searchResultMatchesContentFilters(contentResult, ["messages"])).toBe(false);
  });
});
