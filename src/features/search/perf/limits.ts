export const SEARCH_DEBOUNCE_MS = 120;
export const PALETTE_CONTENT_SEARCH_MIN_QUERY_LENGTH = 3;
export const PALETTE_CONTENT_SEARCH_MAX_CONCURRENCY = 3;
export const PALETTE_CONTENT_SEARCH_PAGE_LIMIT = 20;
export const PALETTE_CONTENT_SEARCH_RESULT_LIMIT = 50;

export const SEARCH_PROVIDER_LIMITS = {
  files: 80,
  kanban: 40,
  threads: 40,
  messages: 80,
  history: 30,
  skills: 25,
  commands: 25,
} as const;

export const SEARCH_TOTAL_LIMIT = 120;
