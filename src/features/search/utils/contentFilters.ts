import type { SearchContentFilter, SearchResult } from "../types";

export function searchResultMatchesContentFilters(
  result: SearchResult,
  filters: SearchContentFilter[],
): boolean {
  if (filters.includes("all")) {
    return true;
  }
  if (result.kind === "content") {
    return filters.includes("content");
  }

  switch (result.sourceKind) {
    case "files":
      return filters.includes("files");
    case "kanban":
      return filters.includes("kanban");
    case "threads":
      return filters.includes("threads");
    case "messages":
      return filters.includes("messages");
    case "history":
      return filters.includes("history");
    case "skills":
      return filters.includes("skills");
    case "commands":
      return filters.includes("commands");
    case "content":
      return filters.includes("content");
    default:
      return false;
  }
}

export function toggleSearchContentFilters(
  previous: SearchContentFilter[],
  nextFilter: SearchContentFilter,
): SearchContentFilter[] {
  if (nextFilter === "all") {
    return ["all"];
  }

  const current = previous.includes("all")
    ? []
    : previous.filter((item) => item !== "all");

  if (current.includes(nextFilter)) {
    const next = current.filter((item) => item !== nextFilter);
    return next.length > 0 ? next : ["all"];
  }

  return [...current, nextFilter];
}
