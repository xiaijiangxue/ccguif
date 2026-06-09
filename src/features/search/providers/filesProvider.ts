import type {
  SearchHighlightRange,
  SearchMatchOptions,
  SearchResult,
} from "../types";
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

function findSubsequenceIndexes(
  text: string,
  query: string,
  caseSensitive: boolean,
): number[] | null {
  const haystack = normalizeCase(text, caseSensitive);
  const needle = normalizeCase(query, caseSensitive);
  if (needle.length < MIN_FUZZY_FILENAME_QUERY_LENGTH) {
    return null;
  }

  const indexes: number[] = [];
  let queryIndex = 0;
  for (let index = 0; index < haystack.length; index += 1) {
    if (haystack[index] !== needle[queryIndex]) {
      continue;
    }
    indexes.push(index);
    queryIndex += 1;
    if (queryIndex === needle.length) {
      return indexes;
    }
  }

  return null;
}

function findFuzzyPathHighlightRanges(
  path: string,
  query: string,
  options: SearchMatchOptions,
): SearchHighlightRange[] | undefined {
  const fileName = getFileName(path);
  const fileStem = getFileStem(fileName);
  const fileNameStart = path.replace(/\\/g, "/").lastIndexOf("/") + 1;
  const candidates = fileStem === fileName
    ? [{ text: fileName, offset: fileNameStart }]
    : [
      { text: fileStem, offset: fileNameStart },
      { text: fileName, offset: fileNameStart },
    ];

  for (const candidate of candidates) {
    const indexes = findSubsequenceIndexes(candidate.text, query, options.caseSensitive);
    if (!indexes) {
      continue;
    }
    return indexes.map((index) => ({
      start: candidate.offset + index,
      end: candidate.offset + index + 1,
    }));
  }

  return undefined;
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
      const highlightRanges = [{ start: index, end: index + normalizedQuery.length }];
      results.push({
        id: `file:${workspaceId}:${path}`,
        kind: "file",
        title: path,
        subtitle: "File",
        score: index === 0 ? 20 : 200 + index,
        workspaceId,
        filePath: path,
        titleHighlightRanges: highlightRanges,
        locationHighlightRanges: highlightRanges,
        sourceKind: "files",
        locationLabel: path,
      });
      continue;
    }

    const fuzzyMatch = findFuzzyFileMatch(path, normalizedQuery, matchOptions);
    if (!fuzzyMatch) {
      continue;
    }

    const highlightRanges = findFuzzyPathHighlightRanges(
      path,
      normalizedQuery,
      matchOptions ?? DEFAULT_SEARCH_MATCH_OPTIONS,
    );
    results.push({
      id: `file:${workspaceId}:${path}`,
      kind: "file",
      title: path,
      subtitle: "File",
      score: 320 + fuzzyMatch.start * 2 + fuzzyMatch.gapCount * 12,
      workspaceId,
      filePath: path,
      titleHighlightRanges: highlightRanges,
      locationHighlightRanges: highlightRanges,
      sourceKind: "files",
      locationLabel: path,
    });
  }
  return results;
}
