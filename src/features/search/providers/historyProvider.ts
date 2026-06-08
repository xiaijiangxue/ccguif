import type { SearchResult } from "../types";
import type { SearchMatchOptions } from "../types";
import { findSearchMatchIndex, normalizeSearchQuery } from "../utils/matchOptions";

type HistoryEntry = {
  text: string;
  importance: number;
};

export function searchHistory(
  query: string,
  historyItems: HistoryEntry[],
  matchOptions?: SearchMatchOptions,
): SearchResult[] {
  const normalizedQuery = normalizeSearchQuery(query);
  if (!normalizedQuery) {
    return [];
  }
  const results: SearchResult[] = [];
  for (const item of historyItems) {
    const text = item.text.trim();
    if (!text) {
      continue;
    }
    const index = findSearchMatchIndex(text, normalizedQuery, matchOptions);
    if (index < 0) {
      continue;
    }
    results.push({
      id: `history:${text}`,
      kind: "history",
      title: text,
      subtitle: "Input History",
      score: (index === 0 ? 30 : 220 + index) - Math.min(item.importance, 20),
      historyText: text,
      sourceKind: "history",
      locationLabel: "input-history",
    });
  }
  return results;
}
