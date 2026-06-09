export type SearchResultKind =
  | "file"
  | "kanban"
  | "thread"
  | "message"
  | "content"
  | "history"
  | "skill"
  | "command";

export type SearchScope = "active-workspace" | "global";
export type PaletteContentSearchStatus = "idle" | "loading" | "ready" | "degraded";
export type SearchMatchOptions = {
  caseSensitive: boolean;
  wholeWord: boolean;
};
export type SearchContentFilter =
  | "all"
  | "files"
  | "content"
  | "kanban"
  | "threads"
  | "messages"
  | "history"
  | "skills"
  | "commands";

export type SearchHighlightRange = {
  start: number;
  end: number;
};

export type SearchResult = {
  id: string;
  kind: SearchResultKind;
  title: string;
  subtitle?: string;
  score: number;
  workspaceId?: string;
  workspaceName?: string;
  threadId?: string;
  messageId?: string;
  panelId?: string;
  taskId?: string;
  filePath?: string;
  line?: number;
  column?: number;
  preview?: string;
  matchedText?: string;
  titleHighlightRanges?: SearchHighlightRange[];
  locationHighlightRanges?: SearchHighlightRange[];
  matchCount?: number;
  matchId?: string;
  historyText?: string;
  skillName?: string;
  commandName?: string;
  sourceKind?:
    | "files"
    | "kanban"
    | "threads"
    | "messages"
    | "content"
    | "history"
    | "skills"
    | "commands";
  locationLabel?: string;
  updatedAt?: number;
};
