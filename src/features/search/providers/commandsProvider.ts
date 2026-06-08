import type { CustomCommandOption } from "../../../types";
import type { SearchResult } from "../types";
import type { SearchMatchOptions } from "../types";
import { findSearchMatchIndex, normalizeSearchQuery } from "../utils/matchOptions";

type NormalizedCommandEntry = {
  name: string;
  description: string;
  argumentHint: string;
  path: string;
  source: string;
};

function normalizeCommandPath(value: string): string {
  return value.replace(/\\/g, "/");
}

function normalizeCommandSource(value: string | undefined): string {
  return value?.trim() ?? "";
}

function buildCommandIdentityKey(entry: NormalizedCommandEntry): string {
  return `${entry.name.toLowerCase()}\u0000${entry.path}\u0000${entry.source.toLowerCase()}`;
}

function buildCommandResultId(entry: NormalizedCommandEntry): string {
  const nameToken = encodeURIComponent(entry.name.toLowerCase());
  const pathToken = encodeURIComponent(entry.path || "-");
  const sourceToken = encodeURIComponent(entry.source.toLowerCase() || "-");
  return `command:${nameToken}:${pathToken}:${sourceToken}`;
}

export function searchCommands(
  query: string,
  commands: CustomCommandOption[],
  matchOptions?: SearchMatchOptions,
): SearchResult[] {
  const normalizedQuery = normalizeSearchQuery(query);
  if (!normalizedQuery) {
    return [];
  }

  const normalizedCommands = new Map<string, NormalizedCommandEntry>();
  const results: SearchResult[] = [];

  for (const command of commands) {
    const name = command.name.trim();
    if (!name) {
      continue;
    }
    const description = command.description?.trim() ?? "";
    const argumentHint = command.argumentHint?.trim() ?? "";
    const path = normalizeCommandPath(command.path?.trim() ?? "");
    const source = normalizeCommandSource(command.source);
    const entry: NormalizedCommandEntry = {
      name,
      description,
      argumentHint,
      path,
      source,
    };
    const identityKey = buildCommandIdentityKey(entry);
    const existing = normalizedCommands.get(identityKey);
    if (!existing) {
      normalizedCommands.set(identityKey, entry);
      continue;
    }
    if (!existing.description && description) {
      normalizedCommands.set(identityKey, entry);
      continue;
    }
    if (!existing.argumentHint && argumentHint) {
      normalizedCommands.set(identityKey, entry);
    }
  }

  for (const command of normalizedCommands.values()) {
    const searchText = `${command.name} ${command.description} ${command.argumentHint}`;
    const index = findSearchMatchIndex(searchText, normalizedQuery, matchOptions);
    if (index < 0) {
      continue;
    }
    const subtitle = command.description || command.argumentHint || "Command";
    results.push({
      id: buildCommandResultId(command),
      kind: "command",
      title: `/${command.name}`,
      subtitle,
      score: index === 0 ? 45 : 230 + index,
      commandName: command.name,
      sourceKind: "commands",
      locationLabel: command.path || command.name,
    });
  }
  return results;
}
