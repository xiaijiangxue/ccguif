import type { SearchMatchOptions } from "../types";

export const DEFAULT_SEARCH_MATCH_OPTIONS: SearchMatchOptions = {
  caseSensitive: false,
  wholeWord: false,
};

const WORD_CHARACTER_REGEX = /[\p{L}\p{N}_]/u;

export function normalizeSearchQuery(query: string): string {
  return query.trim();
}

function normalizeCase(value: string, caseSensitive: boolean): string {
  return caseSensitive ? value : value.toLocaleLowerCase();
}

function isWordCharacter(value: string | undefined): boolean {
  return typeof value === "string" && WORD_CHARACTER_REGEX.test(value);
}

function isWholeWordMatch(text: string, start: number, length: number): boolean {
  const before = start > 0 ? text[start - 1] : undefined;
  const after = start + length < text.length ? text[start + length] : undefined;
  return !isWordCharacter(before) && !isWordCharacter(after);
}

export function findSearchMatchIndex(
  text: string,
  query: string,
  options: SearchMatchOptions = DEFAULT_SEARCH_MATCH_OPTIONS,
): number {
  const normalizedQuery = normalizeSearchQuery(query);
  if (!normalizedQuery) {
    return -1;
  }

  const haystack = normalizeCase(text, options.caseSensitive);
  const needle = normalizeCase(normalizedQuery, options.caseSensitive);
  let index = haystack.indexOf(needle);

  if (!options.wholeWord) {
    return index;
  }

  while (index >= 0) {
    if (isWholeWordMatch(haystack, index, needle.length)) {
      return index;
    }
    index = haystack.indexOf(needle, index + needle.length);
  }

  return -1;
}

export function searchTextIncludes(
  text: string,
  query: string,
  options: SearchMatchOptions = DEFAULT_SEARCH_MATCH_OPTIONS,
): boolean {
  return findSearchMatchIndex(text, query, options) >= 0;
}
