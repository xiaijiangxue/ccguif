import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { searchWorkspaceText } from "../../../services/tauri";
import type { WorkspaceTextSearchResponse } from "../../../services/tauri";
import {
  PALETTE_CONTENT_SEARCH_MAX_CONCURRENCY,
  PALETTE_CONTENT_SEARCH_MIN_QUERY_LENGTH,
  PALETTE_CONTENT_SEARCH_PAGE_LIMIT,
  PALETTE_CONTENT_SEARCH_RESULT_LIMIT,
  SEARCH_DEBOUNCE_MS,
} from "../perf/limits";
import { reportPaletteContentSearchMetrics } from "../perf/searchMetrics";
import { mapWorkspaceTextSearchToContentResults } from "../providers/contentProvider";
import type {
  PaletteContentSearchStatus,
  SearchContentFilter,
  SearchResult,
  SearchScope,
} from "../types";

export type PaletteContentSearchWorkspace = {
  workspaceId: string;
  workspaceName: string;
  recentRank?: number | null;
};

type WorkspacePageState = {
  workspace: PaletteContentSearchWorkspace;
  cursor: string | null;
  hasMore: boolean;
};

type UsePaletteContentSearchOptions = {
  query: string;
  scope: SearchScope;
  contentFilters: SearchContentFilter[];
  workspaces: PaletteContentSearchWorkspace[];
  activeWorkspaceId?: string | null;
  isPaletteOpen: boolean;
};

type UsePaletteContentSearchResult = {
  contentResults: SearchResult[];
  status: PaletteContentSearchStatus;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
};

function normalizeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function resolveSearchWorkspaces({
  scope,
  workspaces,
  activeWorkspaceId,
}: Pick<UsePaletteContentSearchOptions, "scope" | "workspaces" | "activeWorkspaceId">) {
  const prioritizedWorkspaces = [...workspaces].sort((left, right) => {
    const leftActive = left.workspaceId === activeWorkspaceId;
    const rightActive = right.workspaceId === activeWorkspaceId;
    if (leftActive !== rightActive) {
      return leftActive ? -1 : 1;
    }
    const leftRecent = left.recentRank ?? Number.MAX_SAFE_INTEGER;
    const rightRecent = right.recentRank ?? Number.MAX_SAFE_INTEGER;
    if (leftRecent !== rightRecent) {
      return leftRecent - rightRecent;
    }
    return left.workspaceName.localeCompare(right.workspaceName);
  });

  if (scope === "active-workspace" && activeWorkspaceId) {
    const activeWorkspace = prioritizedWorkspaces.find(
      (workspace) => workspace.workspaceId === activeWorkspaceId,
    );
    return activeWorkspace ? [activeWorkspace] : [];
  }

  return prioritizedWorkspaces;
}

function mergeContentResults(
  previous: SearchResult[],
  incoming: SearchResult[],
  maxResults?: number,
): SearchResult[] {
  if (incoming.length === 0) {
    return previous;
  }
  const byId = new Map(previous.map((result) => [result.id, result]));
  for (const result of incoming) {
    byId.set(result.id, result);
  }
  const merged = [...byId.values()];
  return typeof maxResults === "number" ? merged.slice(0, maxResults) : merged;
}

export function usePaletteContentSearch({
  query,
  scope,
  contentFilters,
  workspaces,
  activeWorkspaceId,
  isPaletteOpen,
}: UsePaletteContentSearchOptions): UsePaletteContentSearchResult {
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [contentResults, setContentResults] = useState<SearchResult[]>([]);
  const [status, setStatus] = useState<PaletteContentSearchStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [loadMoreSignal, setLoadMoreSignal] = useState(0);
  const generationRef = useRef(0);
  const loadMoreGenerationRef = useRef(0);
  const pageStateRef = useRef<Map<string, WorkspacePageState>>(new Map());
  const pendingPageStateQueueRef = useRef<WorkspacePageState[]>([]);
  const contentResultCountRef = useRef(0);
  const startedAtRef = useRef(0);
  const canSearchContent =
    contentFilters.includes("all") || contentFilters.includes("content");

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (
      !isPaletteOpen ||
      !canSearchContent ||
      normalizedQuery.length < PALETTE_CONTENT_SEARCH_MIN_QUERY_LENGTH
    ) {
      setDebouncedQuery("");
      return;
    }
    const timer = setTimeout(() => {
      setDebouncedQuery(normalizedQuery);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [canSearchContent, isPaletteOpen, query]);

  const searchWorkspaces = useMemo(
    () => resolveSearchWorkspaces({ scope, workspaces, activeWorkspaceId }),
    [activeWorkspaceId, scope, workspaces],
  );

  useEffect(() => {
    const normalizedQuery = debouncedQuery.trim();
    generationRef.current += 1;
    const generation = generationRef.current;
    pageStateRef.current = new Map();
    pendingPageStateQueueRef.current = [];
    contentResultCountRef.current = 0;

    if (
      !isPaletteOpen ||
      !canSearchContent ||
      normalizedQuery.length < PALETTE_CONTENT_SEARCH_MIN_QUERY_LENGTH ||
      searchWorkspaces.length === 0
    ) {
      setContentResults([]);
      setStatus("idle");
      setError(null);
      return;
    }

    startedAtRef.current = performance.now();
    setContentResults([]);
    setStatus("loading");
    setError(null);

    let cancelled = false;
    let inFlight = 0;
    let degraded = false;
    let requestedFirstBatchCapacity = 0;
    const queue = searchWorkspaces.map((workspace) => ({
      workspace,
      cursor: null,
      hasMore: true,
    }));

    const commitPage = (
      workspaceState: WorkspacePageState,
      response: WorkspaceTextSearchResponse,
    ) => {
      const mappedResults = mapWorkspaceTextSearchToContentResults({
        query: normalizedQuery,
        workspaceId: workspaceState.workspace.workspaceId,
        workspaceName: workspaceState.workspace.workspaceName,
        response,
        activeWorkspaceId,
      });
      pageStateRef.current.set(workspaceState.workspace.workspaceId, {
        ...workspaceState,
        cursor: response.next_cursor ?? null,
        hasMore: Boolean(response.next_cursor),
      });
      setContentResults((previous) => {
        const merged = mergeContentResults(
          previous,
          mappedResults,
          PALETTE_CONTENT_SEARCH_RESULT_LIMIT,
        );
        contentResultCountRef.current = merged.length;
        return merged;
      });
    };

    const finishIfDone = () => {
      if (cancelled || generationRef.current !== generation) {
        return;
      }
      if (queue.length > 0 || inFlight > 0) {
        return;
      }
      const nextStatus = degraded ? "degraded" : "ready";
      setStatus(nextStatus);
      reportPaletteContentSearchMetrics({
        query: normalizedQuery,
        workspaceCount: searchWorkspaces.length,
        elapsedMs: Math.round(performance.now() - startedAtRef.current),
        resultCount: pageStateRef.current.size,
        status: degraded ? "degraded" : "success",
      });
    };

    const pump = () => {
      if (cancelled || generationRef.current !== generation) {
        return;
      }
      const shouldPauseForFirstBatch = () =>
        queue.length > 0 && requestedFirstBatchCapacity >= PALETTE_CONTENT_SEARCH_RESULT_LIMIT;

      if (shouldPauseForFirstBatch()) {
        pendingPageStateQueueRef.current = queue.splice(0);
      }
      while (
        inFlight < PALETTE_CONTENT_SEARCH_MAX_CONCURRENCY &&
        queue.length > 0 &&
        !shouldPauseForFirstBatch()
      ) {
        const workspaceState = queue.shift();
        if (!workspaceState) {
          continue;
        }
        inFlight += 1;
        requestedFirstBatchCapacity += PALETTE_CONTENT_SEARCH_PAGE_LIMIT;
        void searchWorkspaceText(workspaceState.workspace.workspaceId, {
          query: normalizedQuery,
          caseSensitive: false,
          wholeWord: false,
          isRegex: false,
          includePattern: null,
          excludePattern: null,
          limit: PALETTE_CONTENT_SEARCH_PAGE_LIMIT,
          cursor: workspaceState.cursor,
        })
          .then((response) => {
            if (cancelled || generationRef.current !== generation) {
              return;
            }
            commitPage(workspaceState, response);
          })
          .catch((searchError) => {
            if (cancelled || generationRef.current !== generation) {
              return;
            }
            degraded = true;
            setError(normalizeError(searchError));
          })
          .finally(() => {
            inFlight -= 1;
            pump();
            finishIfDone();
          });
      }
      finishIfDone();
    };

    pump();

    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceId, canSearchContent, debouncedQuery, isPaletteOpen, searchWorkspaces]);

  useEffect(() => {
    if (loadMoreSignal === 0) {
      return;
    }
    const normalizedQuery = debouncedQuery.trim();
    if (
      !isPaletteOpen ||
      !canSearchContent ||
      normalizedQuery.length < PALETTE_CONTENT_SEARCH_MIN_QUERY_LENGTH
    ) {
      return;
    }
    const candidates = [...pageStateRef.current.values()].filter(
      (workspaceState) => workspaceState.hasMore && workspaceState.cursor,
    );
    const pendingCandidates = pendingPageStateQueueRef.current.splice(
      0,
      PALETTE_CONTENT_SEARCH_MAX_CONCURRENCY,
    );
    const cursorCandidates = candidates.slice(
      0,
      Math.max(0, PALETTE_CONTENT_SEARCH_MAX_CONCURRENCY - pendingCandidates.length),
    );
    const nextQueue = [...pendingCandidates, ...cursorCandidates];
    if (nextQueue.length === 0) {
      return;
    }

    loadMoreGenerationRef.current += 1;
    const generation = loadMoreGenerationRef.current;
    let cancelled = false;
    setStatus("loading");

    let inFlight = nextQueue.length;
    let degraded = false;

    for (const workspaceState of nextQueue) {
      void searchWorkspaceText(workspaceState.workspace.workspaceId, {
        query: normalizedQuery,
        caseSensitive: false,
        wholeWord: false,
        isRegex: false,
        includePattern: null,
        excludePattern: null,
        limit: PALETTE_CONTENT_SEARCH_PAGE_LIMIT,
        cursor: workspaceState.cursor,
      })
        .then((response) => {
          if (cancelled || loadMoreGenerationRef.current !== generation) {
            return;
          }
          const mappedResults = mapWorkspaceTextSearchToContentResults({
            query: normalizedQuery,
            workspaceId: workspaceState.workspace.workspaceId,
            workspaceName: workspaceState.workspace.workspaceName,
            response,
            activeWorkspaceId,
          });
          pageStateRef.current.set(workspaceState.workspace.workspaceId, {
            ...workspaceState,
            cursor: response.next_cursor ?? null,
            hasMore: Boolean(response.next_cursor),
          });
          setContentResults((previous) => {
            const merged = mergeContentResults(previous, mappedResults);
            contentResultCountRef.current = merged.length;
            return merged;
          });
        })
        .catch((searchError) => {
          if (cancelled || loadMoreGenerationRef.current !== generation) {
            return;
          }
          degraded = true;
          setError(normalizeError(searchError));
        })
        .finally(() => {
          inFlight -= 1;
          if (
            inFlight === 0 &&
            !cancelled &&
            loadMoreGenerationRef.current === generation
          ) {
            setStatus(degraded ? "degraded" : "ready");
          }
        });
    }

    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceId, canSearchContent, debouncedQuery, isPaletteOpen, loadMoreSignal]);

  const hasMore =
    [...pageStateRef.current.values()].some(
      (workspaceState) => workspaceState.hasMore,
    ) || pendingPageStateQueueRef.current.length > 0;

  const loadMore = useCallback(() => {
    setLoadMoreSignal((previous) => previous + 1);
  }, []);

  return {
    contentResults,
    status,
    error,
    hasMore,
    loadMore,
  };
}
