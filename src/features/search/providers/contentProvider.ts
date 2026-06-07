import type { WorkspaceTextSearchResponse } from "../../../services/tauri";
import type { SearchResult } from "../types";

type MapContentSearchResultsOptions = {
  query: string;
  workspaceId: string;
  workspaceName?: string | null;
  response: WorkspaceTextSearchResponse;
  activeWorkspaceId?: string | null;
};

function normalizePreview(preview: string): string {
  return preview.replace(/\s+/g, " ").trim();
}

function buildContentResultId(
  workspaceId: string,
  filePath: string,
  line: number,
  column: number,
  query: string,
): string {
  return `content:${workspaceId}:${filePath}:${line}:${column}:${query.trim().toLowerCase()}`;
}

export function mapWorkspaceTextSearchToContentResults({
  query,
  workspaceId,
  workspaceName,
  response,
  activeWorkspaceId,
}: MapContentSearchResultsOptions): SearchResult[] {
  const normalizedQuery = query.trim();
  if (!normalizedQuery || response.files.length === 0) {
    return [];
  }

  const isActiveWorkspace = activeWorkspaceId === workspaceId;
  const workspaceBias = isActiveWorkspace ? -12 : 0;
  const results: SearchResult[] = [];

  for (const file of response.files) {
    for (const match of file.matches) {
      const preview = normalizePreview(match.preview);
      const matchId = `${file.path}:${match.line}:${match.column}`;
      const id = buildContentResultId(
        workspaceId,
        file.path,
        match.line,
        match.column,
        normalizedQuery,
      );
      results.push({
        id,
        kind: "content",
        title: file.path,
        subtitle: preview,
        score: 180 + workspaceBias + Math.min(match.line, 500),
        workspaceId,
        workspaceName: workspaceName?.trim() || undefined,
        filePath: file.path,
        line: match.line,
        column: match.column,
        preview,
        matchCount: file.match_count,
        matchId,
        sourceKind: "content",
        locationLabel: `${file.path}:${match.line}:${match.column}`,
      });
    }
  }

  return results;
}
