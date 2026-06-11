import type { CommandItem, SkillItem } from "../types";

export type SlashCompletionItem =
  | { kind: "command"; command: CommandItem }
  | { kind: "skill"; skill: SkillItem };

type CommandCompletionProvider = (
  query: string,
  signal: AbortSignal,
) => Promise<CommandItem[]>;

type SkillCompletionProvider = (
  query: string,
  signal: AbortSignal,
) => Promise<SkillItem[]>;

export async function resolveSlashCompletionItems({
  query,
  signal,
  commandProvider,
  skillProvider,
  slashMenuSkillsEnabled,
}: {
  query: string;
  signal: AbortSignal;
  commandProvider: CommandCompletionProvider;
  skillProvider?: SkillCompletionProvider;
  slashMenuSkillsEnabled: boolean;
}): Promise<SlashCompletionItem[]> {
  const commands = await commandProvider(query, signal);
  const commandItems = commands.map((command) => ({
    kind: "command" as const,
    command,
  }));

  if (!slashMenuSkillsEnabled || !skillProvider || signal.aborted) {
    return commandItems;
  }

  try {
    const skills = await skillProvider(query, signal);
    if (signal.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    return [
      ...commandItems,
      ...skills.map((skill) => ({
        kind: "skill" as const,
        skill,
      })),
    ];
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    return commandItems;
  }
}
