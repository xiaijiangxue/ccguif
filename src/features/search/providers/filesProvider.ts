import type { SearchResult } from "../types";
import type { SearchMatchOptions } from "../types";
import { findSearchMatchIndex, normalizeSearchQuery } from "../utils/matchOptions";

export function searchFiles(
  query: string,
  files: string[],
  workspaceId: string,
  matchOptions?: SearchMatchOptions,
): SearchResult[] {
  const normalizedQuery = normalizeSearchQuery(query);
  if (!normalizedQuery) {
    return [];
  }
  const results: SearchResult[] = [];
  for (const path of files) {
    const index = findSearchMatchIndex(path, normalizedQuery, matchOptions);
    if (index < 0) {
      continue;
    }
    results.push({
      id: `file:${workspaceId}:${path}`,
      kind: "file",
      title: path,
      subtitle: "File",
      score: index === 0 ? 20 : 200 + index,
      workspaceId,
      filePath: path,
      sourceKind: "files",
      locationLabel: path,
    });
  }
  return results;
}
