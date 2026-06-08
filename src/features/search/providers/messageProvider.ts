import type { ConversationItem, ThreadSummary } from "../../../types";
import { buildWorkspaceMessageIndex, makeMessageSnippet } from "../indexing/messageIndex";
import type { SearchResult } from "../types";
import type { SearchMatchOptions } from "../types";
import { findSearchMatchIndex, normalizeSearchQuery } from "../utils/matchOptions";

type SearchMessageOptions = {
  query: string;
  workspaceId: string;
  threads: ThreadSummary[];
  threadItemsByThread: Record<string, ConversationItem[]>;
  matchOptions?: SearchMatchOptions;
};

export function searchMessages({
  query,
  workspaceId,
  threads,
  threadItemsByThread,
  matchOptions,
}: SearchMessageOptions): SearchResult[] {
  const normalizedQuery = normalizeSearchQuery(query);
  if (!normalizedQuery) {
    return [];
  }

  const threadNameById = new Map(threads.map((thread) => [thread.id, thread.name]));
  const threadUpdatedAtById = new Map(threads.map((thread) => [thread.id, thread.updatedAt]));
  const indexedMessages = buildWorkspaceMessageIndex(
    threads.map((thread) => thread.id),
    threadItemsByThread,
  );

  const results: SearchResult[] = [];
  for (const message of indexedMessages) {
    const index = findSearchMatchIndex(message.text, normalizedQuery, matchOptions);
    if (index < 0) {
      continue;
    }
    const threadName = threadNameById.get(message.threadId) ?? "Thread";
    const snippet = makeMessageSnippet(message.text, normalizedQuery, 36, matchOptions);
    const score = index === 0 ? 40 : 260 + index;
    results.push({
      id: `message:${workspaceId}:${message.threadId}:${message.messageId}`,
      kind: "message",
      title: threadName,
      subtitle: snippet,
      score,
      workspaceId,
      threadId: message.threadId,
      messageId: message.messageId,
      sourceKind: "messages",
      locationLabel: `${message.threadId} / ${message.messageId}`,
      updatedAt: threadUpdatedAtById.get(message.threadId) ?? 0,
    });
  }

  return results;
}
