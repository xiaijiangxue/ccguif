import { useEffect, useMemo, useRef } from "react";
import type { UIEvent } from "react";
import { useTranslation } from "react-i18next";
import SearchIcon from "lucide-react/dist/esm/icons/search";
import projectIconUrl from "../../../../icon.png";
import { isComposingEvent } from "../../../utils/keys";
import { PALETTE_CONTENT_SEARCH_MIN_QUERY_LENGTH } from "../perf/limits";
import type {
  PaletteContentSearchStatus,
  SearchContentFilter,
  SearchHighlightRange,
  SearchMatchOptions,
  SearchResult,
  SearchScope,
} from "../types";
import { DEFAULT_SEARCH_MATCH_OPTIONS, findSearchMatchIndex } from "../utils/matchOptions";

const INVISIBLE_QUERY_CHARS_REGEX = /[\u200B-\u200D\uFEFF]/g;
const LOAD_MORE_SCROLL_THRESHOLD_PX = 72;

function sanitizeSearchQueryInput(value: string): string {
  return value.replace(INVISIBLE_QUERY_CHARS_REGEX, "");
}

function renderHighlightedPreview(
  preview: string,
  matchedText: string | undefined,
  matchOptions: SearchMatchOptions,
) {
  const normalizedMatch = matchedText?.trim();
  if (!normalizedMatch) {
    return preview;
  }

  const segments = [];
  let cursor = 0;
  let matchIndex = findSearchMatchIndex(preview, normalizedMatch, matchOptions);

  while (matchIndex >= 0) {
    if (matchIndex > cursor) {
      segments.push(preview.slice(cursor, matchIndex));
    }
    const matchEnd = matchIndex + normalizedMatch.length;
    segments.push(
      <mark
        className="search-palette-result-highlight"
        key={`${matchIndex}-${matchEnd}`}
      >
        {preview.slice(matchIndex, matchEnd)}
      </mark>,
    );
    cursor = matchEnd;
    const nextMatchIndex = findSearchMatchIndex(
      preview.slice(cursor),
      normalizedMatch,
      matchOptions,
    );
    matchIndex = nextMatchIndex >= 0 ? cursor + nextMatchIndex : -1;
  }

  if (cursor === 0) {
    return preview;
  }
  if (cursor < preview.length) {
    segments.push(preview.slice(cursor));
  }

  return <>{segments}</>;
}

function renderHighlightedRanges(
  text: string,
  ranges: SearchHighlightRange[] | undefined,
) {
  if (!ranges || ranges.length === 0) {
    return text;
  }

  const segments = [];
  let cursor = 0;
  const normalizedRanges = ranges
    .map((range) => ({
      start: Math.max(0, Math.min(text.length, range.start)),
      end: Math.max(0, Math.min(text.length, range.end)),
    }))
    .filter((range) => range.end > range.start)
    .sort((left, right) => left.start - right.start || left.end - right.end);

  for (const range of normalizedRanges) {
    if (range.start < cursor) {
      continue;
    }
    if (range.start > cursor) {
      segments.push(text.slice(cursor, range.start));
    }
    segments.push(
      <mark
        className="search-palette-result-highlight"
        key={`${range.start}-${range.end}`}
      >
        {text.slice(range.start, range.end)}
      </mark>,
    );
    cursor = range.end;
  }

  if (cursor === 0) {
    return text;
  }
  if (cursor < text.length) {
    segments.push(text.slice(cursor));
  }

  return <>{segments}</>;
}

type SearchPaletteProps = {
  isOpen: boolean;
  scope: SearchScope;
  contentFilters: SearchContentFilter[];
  matchOptions?: SearchMatchOptions;
  workspaceName?: string | null;
  query: string;
  results: SearchResult[];
  selectedIndex: number;
  contentSearchStatus?: PaletteContentSearchStatus;
  contentSearchError?: string | null;
  hasMoreContentResults?: boolean;
  onQueryChange: (value: string) => void;
  onMoveSelection: (direction: "up" | "down") => void;
  onSelect: (result: SearchResult) => void;
  onScopeChange: (scope: SearchScope) => void;
  onContentFilterToggle: (filter: SearchContentFilter) => void;
  onMatchOptionsChange?: (options: SearchMatchOptions) => void;
  onLoadMoreContentResults?: () => void;
  onClose: () => void;
};

export function SearchPalette({
  isOpen,
  scope,
  contentFilters,
  matchOptions = DEFAULT_SEARCH_MATCH_OPTIONS,
  workspaceName,
  query,
  results,
  selectedIndex,
  contentSearchStatus = "idle",
  contentSearchError = null,
  hasMoreContentResults = false,
  onQueryChange,
  onMoveSelection,
  onSelect,
  onScopeChange,
  onContentFilterToggle,
  onMatchOptionsChange = () => undefined,
  onLoadMoreContentResults,
  onClose,
}: SearchPaletteProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isComposingRef = useRef(false);
  const lastCompositionEndAtRef = useRef(0);
  const loadMoreArmedRef = useRef(true);
  const badgeLabelByKind: Record<SearchResult["kind"], string> = {
    file: t("searchPalette.typeFile"),
    content: t("searchPalette.typeContent"),
    kanban: t("searchPalette.typeKanban"),
    thread: t("searchPalette.typeThread"),
    message: t("searchPalette.typeMessage"),
    history: t("searchPalette.typeHistory"),
    skill: t("searchPalette.typeSkill"),
    command: t("searchPalette.typeCommand"),
  };

  const sourceLabelByKind: Record<NonNullable<SearchResult["sourceKind"]>, string> = {
    files: t("searchPalette.sourceFiles"),
    kanban: t("searchPalette.sourceKanban"),
    threads: t("searchPalette.sourceThreads"),
    messages: t("searchPalette.sourceMessages"),
    content: t("searchPalette.sourceContent"),
    history: t("searchPalette.sourceHistory"),
    skills: t("searchPalette.sourceSkills"),
    commands: t("searchPalette.sourceCommands"),
  };
  const contentFilterOptions: Array<{
    value: SearchContentFilter;
    label: string;
  }> = [
    { value: "all", label: t("searchPalette.contentAll") },
    { value: "files", label: t("searchPalette.contentFiles") },
    { value: "kanban", label: t("searchPalette.contentKanban") },
    { value: "threads", label: t("searchPalette.contentThreads") },
    { value: "messages", label: t("searchPalette.contentMessages") },
    { value: "history", label: t("searchPalette.contentHistory") },
    { value: "skills", label: t("searchPalette.contentSkills") },
    { value: "commands", label: t("searchPalette.contentCommands") },
    { value: "content", label: t("searchPalette.contentFileContent") },
  ];
  const selectedContentLabels = contentFilterOptions
    .filter((option) => option.value !== "all" && contentFilters.includes(option.value))
    .map((option) => option.label);
  const placeholderText = selectedContentLabels.length
    ? t("searchPalette.placeholderFiltered", { content: selectedContentLabels.join(" / ") })
    : t("searchPalette.placeholder");
  const matchOptionButtons = [
    {
      key: "caseSensitive" as const,
      active: matchOptions.caseSensitive,
      label: t("searchPalette.matchCaseLabel"),
      symbol: t("searchPalette.matchCaseSymbol"),
    },
    {
      key: "wholeWord" as const,
      active: matchOptions.wholeWord,
      label: t("searchPalette.wholeWordLabel"),
      symbol: t("searchPalette.wholeWordSymbol"),
    },
  ];
  const normalizedVisibleQuery = sanitizeSearchQueryInput(query);
  const trimmedVisibleQuery = normalizedVisibleQuery.trim();
  const shouldShowResults = trimmedVisibleQuery.length > 0;
  const isContentOnlyFilter =
    contentFilters.length === 1 && contentFilters.includes("content");
  const shouldShowContentMinLengthHint =
    isContentOnlyFilter &&
    trimmedVisibleQuery.length > 0 &&
    trimmedVisibleQuery.length < PALETTE_CONTENT_SEARCH_MIN_QUERY_LENGTH;
  const visibleResults = useMemo(
    () => (shouldShowResults ? results : []),
    [results, shouldShowResults],
  );
  const contentStatusText = useMemo(() => {
    if (!shouldShowResults) {
      return null;
    }
    if (contentSearchStatus === "loading") {
      return t("searchPalette.contentSearching");
    }
    if (contentSearchStatus === "degraded") {
      return contentSearchError
        ? t("searchPalette.contentDegradedWithReason", { reason: contentSearchError })
        : t("searchPalette.contentDegraded");
    }
    if (hasMoreContentResults) {
      return t("searchPalette.contentMoreAvailable");
    }
    return null;
  }, [
    contentSearchError,
    contentSearchStatus,
    hasMoreContentResults,
    shouldShowResults,
    t,
  ]);

  useEffect(() => {
    loadMoreArmedRef.current = true;
  }, [query, scope, contentFilters, visibleResults.length, hasMoreContentResults]);

  const handleResultsScroll = (event: UIEvent<HTMLDivElement>) => {
    if (!hasMoreContentResults || !onLoadMoreContentResults || !shouldShowResults) {
      return;
    }
    const target = event.currentTarget;
    const distanceToBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
    if (distanceToBottom > LOAD_MORE_SCROLL_THRESHOLD_PX) {
      loadMoreArmedRef.current = true;
      return;
    }
    if (!loadMoreArmedRef.current) {
      return;
    }
    loadMoreArmedRef.current = false;
    onLoadMoreContentResults();
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    inputRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      const isRecentlyComposing = Date.now() - lastCompositionEndAtRef.current < 120;
      if (isComposingRef.current || isRecentlyComposing || isComposingEvent(event)) {
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        onMoveSelection("down");
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        onMoveSelection("up");
        return;
      }
      if (event.key === "Enter") {
        if (!visibleResults.length || selectedIndex < 0 || selectedIndex >= visibleResults.length) {
          return;
        }
        event.preventDefault();
        const selectedResult = visibleResults[selectedIndex];
        if (selectedResult) {
          onSelect(selectedResult);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, onMoveSelection, onSelect, selectedIndex, visibleResults]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="search-palette-overlay" onClick={onClose} role="presentation">
      <div
        className="search-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="search-palette-top-accent" />
        <div className="search-palette-input-row">
          <SearchIcon className="search-palette-search-icon" aria-hidden="true" />
          <input
            ref={inputRef}
            className="search-palette-input"
            placeholder={placeholderText}
            aria-label={t("searchPalette.inputAria")}
            value={query}
            onChange={(event) => onQueryChange(sanitizeSearchQueryInput(event.target.value))}
            onCompositionStart={() => {
              isComposingRef.current = true;
            }}
            onCompositionEnd={(event) => {
              isComposingRef.current = false;
              lastCompositionEndAtRef.current = Date.now();
              onQueryChange(sanitizeSearchQueryInput(event.currentTarget.value));
            }}
          />
          <div
            className="search-palette-match-options"
            role="group"
            aria-label={t("searchPalette.matchOptions")}
          >
            {matchOptionButtons.map((option) => (
              <button
                key={option.key}
                type="button"
                className={`search-palette-match-option-btn${option.active ? " is-active" : ""}`}
                aria-label={option.label}
                aria-pressed={option.active}
                title={option.label}
                onClick={() => {
                  onMatchOptionsChange({
                    ...matchOptions,
                    [option.key]: !option.active,
                  });
                }}
              >
                {option.symbol}
              </button>
            ))}
          </div>
          <span className="search-palette-project-icon-box" aria-hidden="true">
            <img
              className="search-palette-project-icon"
              src={projectIconUrl}
              alt=""
            />
          </span>
        </div>
        <div className="search-palette-scope">
          <span className="search-palette-scope-label">{t("searchPalette.scope")}</span>
          <div className="search-palette-scope-toggle" role="group" aria-label={t("searchPalette.scope")}>
            <button
              type="button"
              className={`search-palette-scope-btn${scope === "active-workspace" ? " is-active" : ""}`}
              onClick={() => onScopeChange("active-workspace")}
            >
              {t("searchPalette.current")}
            </button>
            <button
              type="button"
              className={`search-palette-scope-btn${scope === "global" ? " is-active" : ""}`}
              onClick={() => onScopeChange("global")}
            >
              {t("searchPalette.global")}
            </button>
          </div>
          <span className="search-palette-scope-value">
            {scope === "active-workspace"
              ? `${t("searchPalette.currentWorkspace")}${workspaceName ? ` (${workspaceName})` : ""}`
              : t("searchPalette.allWorkspaces")}
          </span>
        </div>
        <div className="search-palette-content">
          <span className="search-palette-scope-label">{t("searchPalette.content")}</span>
          <div
            className="search-palette-content-toggle"
            role="group"
            aria-label={t("searchPalette.content")}
          >
            {contentFilterOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`search-palette-content-btn${contentFilters.includes(option.value) ? " is-active" : ""}`}
                onClick={() => onContentFilterToggle(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="search-palette-results" onScroll={handleResultsScroll}>
          {visibleResults.length === 0 ? (
            <div className="search-palette-empty">
              <div className="search-palette-empty-title">
                {shouldShowContentMinLengthHint
                  ? t("searchPalette.contentMinLengthTitle")
                  : t("searchPalette.noResults")}
              </div>
              <div className="search-palette-empty-hint">
                {shouldShowContentMinLengthHint
                  ? t("searchPalette.contentMinLengthHint", {
                    count: PALETTE_CONTENT_SEARCH_MIN_QUERY_LENGTH,
                  })
                  : t("searchPalette.noResultsHint")}
              </div>
            </div>
          ) : (
            visibleResults.map((result, index) => (
              <button
                key={result.id}
                type="button"
                className={`search-palette-result${index === selectedIndex ? " is-active" : ""}`}
                onClick={() => onSelect(result)}
              >
                <span className="search-palette-result-main">
                  <span className="search-palette-result-title">
                    {renderHighlightedRanges(result.title, result.titleHighlightRanges)}
                  </span>
                  {result.kind === "content" && result.preview ? (
                    <span className="search-palette-result-preview">
                      {renderHighlightedPreview(
                        result.preview,
                        result.matchedText ?? trimmedVisibleQuery,
                        matchOptions,
                      )}
                    </span>
                  ) : result.subtitle ? (
                    <span className="search-palette-result-subtitle">{result.subtitle}</span>
                  ) : null}
                  <span className="search-palette-result-tags">
                    {result.workspaceName ? (
                      <span className="search-palette-result-tag">
                        {t("searchPalette.projectTag")}: {result.workspaceName}
                      </span>
                    ) : null}
                    <span className="search-palette-result-tag">
                      {t("searchPalette.typeTag")}: {badgeLabelByKind[result.kind]}
                    </span>
                    {result.sourceKind ? (
                      <span className="search-palette-result-tag">
                        {t("searchPalette.sourceTag")}: {sourceLabelByKind[result.sourceKind]}
                      </span>
                    ) : null}
                    {result.locationLabel ? (
                      <span className="search-palette-result-tag">
                        {t("searchPalette.locationTag")}:{" "}
                        {renderHighlightedRanges(
                          result.locationLabel,
                          result.locationHighlightRanges,
                        )}
                      </span>
                    ) : null}
                  </span>
                </span>
                <span className={`search-palette-kind-badge search-kind-${result.kind}`}>
                  {badgeLabelByKind[result.kind]}
                </span>
              </button>
            ))
          )}
        </div>
        <div className="search-palette-footer">
          {contentStatusText ? (
            <span className="search-palette-content-status">
              {contentStatusText}
            </span>
          ) : null}
          <span className="search-palette-key-hint">
            <kbd>↑↓</kbd> {t("searchPalette.navigate")}
          </span>
          <span className="search-palette-key-hint">
            <kbd>Enter</kbd> {t("searchPalette.open")}
          </span>
          <span className="search-palette-key-hint">
            <kbd>Esc</kbd> {t("searchPalette.close")}
          </span>
        </div>
      </div>
    </div>
  );
}
