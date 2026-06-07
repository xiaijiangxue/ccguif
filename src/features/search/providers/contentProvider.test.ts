import { describe, expect, it } from "vitest";
import type { WorkspaceTextSearchResponse } from "../../../services/tauri";
import { mapWorkspaceTextSearchToContentResults } from "./contentProvider";

function makeResponse(): WorkspaceTextSearchResponse {
  return {
    files: [
      {
        path: "src/app.ts",
        match_count: 2,
        matches: [
          { line: 10, column: 5, end_column: 12, preview: "const  codemoss = true" },
          { line: 20, column: 1, end_column: 8, preview: "codemoss again" },
        ],
      },
    ],
    file_count: 1,
    match_count: 2,
    limit_hit: false,
    next_cursor: null,
    invalid_cursor: false,
  };
}

describe("mapWorkspaceTextSearchToContentResults", () => {
  it("maps one backend file with multiple matches to content results", () => {
    const results = mapWorkspaceTextSearchToContentResults({
      query: "codemoss",
      workspaceId: "ws-1",
      workspaceName: "App",
      activeWorkspaceId: "ws-1",
      response: makeResponse(),
    });

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      id: "content:ws-1:src/app.ts:10:5:codemoss",
      kind: "content",
      sourceKind: "content",
      workspaceId: "ws-1",
      workspaceName: "App",
      filePath: "src/app.ts",
      line: 10,
      column: 5,
      preview: "const codemoss = true",
      matchCount: 2,
      matchId: "src/app.ts:10:5",
      locationLabel: "src/app.ts:10:5",
    });
  });

  it("keeps result ids stable for equivalent query casing and spacing", () => {
    const first = mapWorkspaceTextSearchToContentResults({
      query: " codemoss ",
      workspaceId: "ws-1",
      response: makeResponse(),
    });
    const second = mapWorkspaceTextSearchToContentResults({
      query: "CODEMOSS",
      workspaceId: "ws-1",
      response: makeResponse(),
    });

    expect(first.map((result) => result.id)).toEqual(second.map((result) => result.id));
  });

  it("returns empty results for empty query or empty backend response", () => {
    const response = { ...makeResponse(), files: [] };

    expect(
      mapWorkspaceTextSearchToContentResults({
        query: "codemoss",
        workspaceId: "ws-1",
        response,
      }),
    ).toEqual([]);
    expect(
      mapWorkspaceTextSearchToContentResults({
        query: " ",
        workspaceId: "ws-1",
        response: makeResponse(),
      }),
    ).toEqual([]);
  });
});
