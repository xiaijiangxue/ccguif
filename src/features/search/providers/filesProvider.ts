import type { SearchResult } from "../types";
import type { SearchMatchOptions } from "../types";
import {
  DEFAULT_SEARCH_MATCH_OPTIONS,
  findSearchMatchIndex,
  normalizeSearchQuery,
} from "../utils/matchOptions";

const MIN_FUZZY_FILENAME_QUERY_LENGTH = 4;

type SubsequenceMatch = {
  start: number;
  gapCount: number;
};

function getFileName(path: string): string {
  const normalizedPath = path.replace(/\\/g, "/");
  const lastSlashIndex = normalizedPath.lastIndexOf("/");
  return lastSlashIndex >= 0 ? normalizedPath.slice(lastSlashIndex + 1) : normalizedPath;
}

function getFileStem(fileName: string): string {
  const extensionIndex = fileName.lastIndexOf(".");
  return extensionIndex > 0 ? fileName.slice(0, extensionIndex) : fileName;
}

function normalizeCase(value: string, caseSensitive: boolean): string {
  return caseSensitive ? value : value.toLocaleLowerCase();
}

function findSubsequenceMatch(
  text: string,
  query: string,
  caseSensitive: boolean,
): SubsequenceMatch | null {
  const haystack = normalizeCase(text, caseSensitive);
  const needle = normalizeCase(query, caseSensitive);
  if (needle.length < MIN_FUZZY_FILENAME_QUERY_LENGTH) {
    return null;
  }

  let queryIndex = 0;
  let start = -1;
  let lastMatchIndex = -1;

  for (let index = 0; index < haystack.length; index += 1) {
    if (haystack[index] !== needle[queryIndex]) {
      continue;
    }
    if (start < 0) {
      start = index;
    }
    lastMatchIndex = index;
    queryIndex += 1;
    if (queryIndex === needle.length) {
      return {
        start,
        gapCount: lastMatchIndex - start + 1 - needle.length,
      };
    }
  }

  return null;
}

function findFuzzyFileMatch(
  path: string,
  query: string,
  options: SearchMatchOptions = DEFAULT_SEARCH_MATCH_OPTIONS,
): SubsequenceMatch | null {
  if (options.wholeWord) {
    return null;
  }

  const fileName = getFileName(path);
  const fileStem = getFileStem(fileName);
  const candidates = fileStem === fileName ? [fileName] : [fileStem, fileName];

  let bestMatch: SubsequenceMatch | null = null;
  for (const candidate of candidates) {
    const match = findSubsequenceMatch(candidate, query, options.caseSensitive);
    if (!match) {
      continue;
    }
    if (
      !bestMatch
      || match.gapCount < bestMatch.gapCount
      || (match.gapCount === bestMatch.gapCount && match.start < bestMatch.start)
    ) {
      bestMatch = match;
    }
  }

  return bestMatch;
}

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
    if (index >= 0) {
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
      continue;
    }

    const fuzzyMatch = findFuzzyFileMatch(path, normalizedQuery, matchOptions);
    if (!fuzzyMatch) {
      continue;
    }

    results.push({
      id: `file:${workspaceId}:${path}`,
      kind: "file",
      title: path,
      subtitle: "File",
      score: 320 + fuzzyMatch.start * 2 + fuzzyMatch.gapCount * 12,
      workspaceId,
      filePath: path,
      sourceKind: "files",
      locationLabel: path,
    });
  }
  return results;
}
