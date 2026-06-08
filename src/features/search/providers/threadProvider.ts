import type { ThreadSummary } from "../../../types";
import type { SearchResult } from "../types";
import type { SearchMatchOptions } from "../types";
import { findSearchMatchIndex, normalizeSearchQuery } from "../utils/matchOptions";

export function searchThreads(
  query: string,
  threads: ThreadSummary[],
  workspaceId: string,
  matchOptions?: SearchMatchOptions,
): SearchResult[] {
  const normalizedQuery = normalizeSearchQuery(query);
  if (!normalizedQuery) {
    return [];
  }
  const results: SearchResult[] = [];
  for (const thread of threads) {
    const index = findSearchMatchIndex(thread.name, normalizedQuery, matchOptions);
    if (index < 0) {
      continue;
    }
    results.push({
      id: `thread:${workspaceId}:${thread.id}`,
      kind: "thread",
      title: thread.name,
      subtitle: "Thread",
      score: index === 0 ? 15 : 160 + index,
      workspaceId,
      threadId: thread.id,
      sourceKind: "threads",
      locationLabel: thread.id,
      updatedAt: thread.updatedAt,
    });
  }
  return results;
}
