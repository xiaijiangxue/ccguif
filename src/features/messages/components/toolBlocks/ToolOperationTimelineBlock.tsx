import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import type { ConversationItem } from "../../../../types";
import {
  asRecord,
  buildCommandSummary,
  classifyToolCategory,
  EDIT_CONTENT_KEYS,
  EDIT_NEW_KEYS,
  EDIT_OLD_KEYS,
  EDIT_PATH_KEYS,
  extractToolName,
  getFileName,
  getFirstCommandField,
  getFirstStringField,
  getToolDisplayName,
  parseToolArgs,
  resolveToolStatus,
  truncateText,
  type ToolCategory,
  type ToolStatusTone,
} from "./toolConstants";
import {
  computeDiffFromUnifiedPatch,
  computeDiffStats,
  type DiffStats,
} from "../../utils/diffUtils";
import { FileIcon } from "./FileIcon";

type ToolItem = Extract<ConversationItem, { kind: "tool" }>;

type ToolOperationTimelineKind =
  | "single"
  | "readGroup"
  | "editGroup"
  | "bashGroup"
  | "searchGroup";

interface ToolOperationTimelineBlockProps {
  items: ToolItem[];
  kind: ToolOperationTimelineKind;
  children: ReactNode;
  provenanceNode?: ReactNode;
}

const PATH_KEYS = [
  "file_path",
  "filePath",
  "filepath",
  "path",
  "target_file",
  "targetFile",
  "filename",
  "file",
  "directory",
  "dir",
];

const SEARCH_KEYS = [
  "pattern",
  "query",
  "q",
  "search_term",
  "searchQuery",
  "search_query",
  "text",
];

const COMMAND_KEYS = [
  "command",
  "cmd",
  "script",
  "shell_command",
  "bash",
  "argv",
];

function getNestedRecord(args: Record<string, unknown> | null, key: string) {
  return asRecord(args?.[key]);
}

function pickStringFromArgs(
  item: ToolItem,
  keys: string[],
): string {
  const args = parseToolArgs(item.detail);
  const nestedInput = getNestedRecord(args, "input");
  const nestedArgs = getNestedRecord(args, "arguments");
  return (
    getFirstStringField(args, keys) ||
    getFirstStringField(nestedInput, keys) ||
    getFirstStringField(nestedArgs, keys)
  );
}

function pickCommandFromArgs(item: ToolItem): string {
  const args = parseToolArgs(item.detail);
  const nestedInput = getNestedRecord(args, "input");
  const nestedArgs = getNestedRecord(args, "arguments");
  return (
    getFirstCommandField(args, COMMAND_KEYS) ||
    getFirstCommandField(nestedInput, COMMAND_KEYS) ||
    getFirstCommandField(nestedArgs, COMMAND_KEYS) ||
    buildCommandSummary(item, { includeDetail: false })
  );
}

function getItemStatus(item: ToolItem): ToolStatusTone {
  return resolveToolStatus(
    item.status,
    Boolean(item.output) || Boolean(item.changes?.length),
  );
}

function getGroupStatus(items: ToolItem[]): ToolStatusTone {
  if (items.some((item) => getItemStatus(item) === "processing")) {
    return "processing";
  }
  if (items.some((item) => getItemStatus(item) === "failed")) {
    return "failed";
  }
  return "completed";
}

function emptyDiffStats(): DiffStats {
  return { additions: 0, deletions: 0 };
}

function addDiffStats(left: DiffStats, right: DiffStats): DiffStats {
  return {
    additions: left.additions + right.additions,
    deletions: left.deletions + right.deletions,
  };
}

function getEditLikeDiffStats(item: ToolItem): DiffStats {
  if (item.toolType === "fileChange" && item.changes?.length) {
    return item.changes.reduce(
      (total, change) => addDiffStats(total, computeDiffFromUnifiedPatch(change.diff ?? "")),
      emptyDiffStats(),
    );
  }

  const args = parseToolArgs(item.detail);
  const nestedInput = getNestedRecord(args, "input");
  const nestedArgs = getNestedRecord(args, "arguments");
  const oldString =
    getFirstStringField(args, EDIT_OLD_KEYS) ||
    getFirstStringField(nestedInput, EDIT_OLD_KEYS) ||
    getFirstStringField(nestedArgs, EDIT_OLD_KEYS);
  const newString =
    getFirstStringField(args, EDIT_NEW_KEYS) ||
    getFirstStringField(nestedInput, EDIT_NEW_KEYS) ||
    getFirstStringField(nestedArgs, EDIT_NEW_KEYS);
  if (oldString || newString) {
    return computeDiffStats(oldString, newString);
  }

  const content =
    getFirstStringField(args, EDIT_CONTENT_KEYS) ||
    getFirstStringField(nestedInput, EDIT_CONTENT_KEYS) ||
    getFirstStringField(nestedArgs, EDIT_CONTENT_KEYS);
  if (content) {
    return computeDiffStats("", content);
  }

  return emptyDiffStats();
}

function getTimelineDiffStats(items: ToolItem[], category: ToolCategory): DiffStats | null {
  if (category !== "edit" && category !== "fileChange") {
    return null;
  }
  return items.reduce(
    (total, item) => addDiffStats(total, getEditLikeDiffStats(item)),
    emptyDiffStats(),
  );
}

function resolveTimelineCategory(
  kind: ToolOperationTimelineKind,
  item: ToolItem | undefined,
): ToolCategory {
  if (kind === "readGroup") return "read";
  if (kind === "editGroup") return "edit";
  if (kind === "bashGroup") return "bash";
  if (kind === "searchGroup") return "search";
  return item ? classifyToolCategory(item) : "other";
}

function getIconClass(category: ToolCategory): string {
  if (category === "read") return "codicon-file-code";
  if (category === "edit" || category === "fileChange") return "codicon-edit";
  if (category === "bash") return "codicon-terminal";
  if (category === "search") return "codicon-search";
  if (category === "web") return "codicon-globe";
  if (category === "mcp") return "codicon-plug";
  return "codicon-tools";
}

function getItemTarget(item: ToolItem, category: ToolCategory): string {
  if (category === "bash") {
    return pickCommandFromArgs(item);
  }
  if (category === "search") {
    return pickStringFromArgs(item, SEARCH_KEYS);
  }
  if (category === "edit" || category === "read" || category === "fileChange") {
    const changePath = item.changes?.[0]?.path ?? "";
    return changePath || pickStringFromArgs(item, EDIT_PATH_KEYS) || pickStringFromArgs(item, PATH_KEYS);
  }
  return pickStringFromArgs(item, [...PATH_KEYS, ...SEARCH_KEYS]) || item.detail;
}

function getItemTargets(item: ToolItem, category: ToolCategory): string[] {
  if ((category === "edit" || category === "fileChange") && item.changes?.length) {
    return item.changes
      .map((change) => change.path.trim())
      .filter(Boolean);
  }
  return [getItemTarget(item, category)].filter(Boolean);
}

function isFileTargetCategory(category: ToolCategory): boolean {
  return category === "read" || category === "edit" || category === "fileChange";
}

function getTimelineTargets(items: ToolItem[], category: ToolCategory): string[] {
  const targets = items
    .flatMap((item) => getItemTargets(item, category))
    .map((target) => target.trim())
    .filter(Boolean);
  return Array.from(new Set(targets));
}

function summarizeTargets(targets: string[], category: ToolCategory): string {
  const uniqueTargets = targets.map((target) => {
    if (isFileTargetCategory(category)) {
      return getFileName(target) || target;
    }
    return target;
  });
  if (uniqueTargets.length === 0) {
    return "";
  }
  const visibleTargetLimit =
    category === "edit" || category === "fileChange" ? 5 : 3;
  const visibleTargets = uniqueTargets
    .slice(0, visibleTargetLimit)
    .map((target) => truncateText(target, 28));
  const hiddenCount = uniqueTargets.length - visibleTargets.length;
  return hiddenCount > 0
    ? `${visibleTargets.join(", ")} +${hiddenCount}`
    : visibleTargets.join(", ");
}

function getVisibleFileTargets(targets: string[], category: ToolCategory) {
  if (!isFileTargetCategory(category)) {
    return [];
  }
  const visibleTargetLimit =
    category === "edit" || category === "fileChange" ? 5 : 3;
  return targets.slice(0, visibleTargetLimit).map((target) => {
    const fileName = getFileName(target) || target;
    return {
      displayName: truncateText(fileName, 28),
      fileName,
      fullPath: target,
    };
  });
}

function getFailureSummary(items: ToolItem[]): string {
  const failedItem = items.find((item) => getItemStatus(item) === "failed");
  const output = failedItem?.output?.trim() ?? "";
  if (!output) {
    return "";
  }
  const firstLine = output.split(/\r?\n/).find((line) => line.trim()) ?? output;
  return truncateText(firstLine.trim(), 110);
}

function resolveTitle(input: {
  category: ToolCategory;
  count: number;
  firstItem: ToolItem | undefined;
  kind: ToolOperationTimelineKind;
  t: (key: string, options?: Record<string, unknown>) => string;
}): string {
  const { category, count, firstItem, kind, t } = input;
  if (kind === "readGroup") return t("messages.operationTimeline.readGroup", { count });
  if (kind === "editGroup") return t("messages.operationTimeline.editGroup", { count });
  if (kind === "bashGroup") return t("messages.operationTimeline.bashGroup", { count });
  if (kind === "searchGroup") return t("messages.operationTimeline.searchGroup", { count });
  const toolName = extractToolName(firstItem?.title);
  return getToolDisplayName(toolName || category, String(firstItem?.title ?? ""), (key) => t(key));
}

export const ToolOperationTimelineBlock = memo(function ToolOperationTimelineBlock({
  items,
  kind,
  children,
  provenanceNode = null,
}: ToolOperationTimelineBlockProps) {
  const { t } = useTranslation();
  const firstItem = items[0];
  const status = useMemo(() => getGroupStatus(items), [items]);
  const category = useMemo(
    () => resolveTimelineCategory(kind, firstItem),
    [firstItem, kind],
  );
  const title = useMemo(
    () =>
      resolveTitle({
        category,
        count: items.length,
        firstItem,
        kind,
        t,
      }),
    [category, firstItem, items.length, kind, t],
  );
  const timelineTargets = useMemo(
    () => getTimelineTargets(items, category),
    [category, items],
  );
  const targetSummary = useMemo(
    () => summarizeTargets(timelineTargets, category),
    [category, timelineTargets],
  );
  const visibleFileTargets = useMemo(
    () => getVisibleFileTargets(timelineTargets, category),
    [category, timelineTargets],
  );
  const hiddenFileTargetCount = Math.max(0, timelineTargets.length - visibleFileTargets.length);
  const diffStats = useMemo(
    () => getTimelineDiffStats(items, category),
    [category, items],
  );
  const failureSummary = useMemo(() => getFailureSummary(items), [items]);
  const userTouchedRef = useRef(false);
  const [isExpanded, setIsExpanded] = useState(() => status !== "completed");

  useEffect(() => {
    if (userTouchedRef.current) {
      return;
    }
    setIsExpanded(status !== "completed");
  }, [status]);

  const toggleExpanded = () => {
    userTouchedRef.current = true;
    setIsExpanded((current) => !current);
  };

  const statusLabel = t(`messages.operationTimeline.status.${status}`);
  const detailId = firstItem ? `tool-operation-detail-${firstItem.id}` : undefined;
  const metaParts = [
    statusLabel,
    items.length > 1
      ? t("messages.operationTimeline.operationCount", { count: items.length })
      : null,
  ].filter((part): part is string => Boolean(part));

  return (
    <section
      className={`message-tool-block-shell tool-operation-timeline-block tool-operation-timeline-block--${category} tool-operation-timeline-block--${status}${isExpanded ? " is-expanded" : " is-collapsed"}`}
      data-tool-operation-status={status}
    >
      <span className="tool-operation-timeline-node" aria-hidden />
      <button
        type="button"
        className="tool-operation-timeline-summary"
        aria-expanded={isExpanded}
        aria-controls={detailId}
        onClick={toggleExpanded}
      >
        <span
          className={`codicon ${getIconClass(category)} tool-operation-timeline-icon`}
          aria-hidden
        />
        <span className="tool-operation-timeline-copy">
          <span className="tool-operation-timeline-title">{title}</span>
          {diffStats && (diffStats.additions > 0 || diffStats.deletions > 0) ? (
            <span className="tool-operation-timeline-diff-stats" aria-label={`+${diffStats.additions} -${diffStats.deletions}`}>
              <span className="diff-stat-add">+{diffStats.additions}</span>
              <span className="diff-stat-del">-{diffStats.deletions}</span>
            </span>
          ) : null}
          {visibleFileTargets.length > 0 ? (
            <span className="tool-operation-timeline-file-targets">
              {visibleFileTargets.map((target) => (
                <span
                  key={target.fullPath}
                  className="tool-operation-timeline-file-target"
                  title={target.fullPath}
                >
                  <FileIcon fileName={target.fileName} size={14} />
                  <span className="tool-operation-timeline-file-target-name">
                    {target.displayName}
                  </span>
                </span>
              ))}
              {hiddenFileTargetCount > 0 ? (
                <span className="tool-operation-timeline-file-target-more">
                  +{hiddenFileTargetCount}
                </span>
              ) : null}
            </span>
          ) : targetSummary ? (
            <span className="tool-operation-timeline-target">{targetSummary}</span>
          ) : null}
        </span>
        <span className="tool-operation-timeline-meta">{metaParts.join(" · ")}</span>
      </button>
      {status === "failed" && failureSummary ? (
        <div className="tool-operation-timeline-failure">{failureSummary}</div>
      ) : null}
      {isExpanded ? (
        <div
          id={detailId}
          className={`tool-operation-timeline-detail tool-operation-timeline-detail--${category}`}
        >
          {provenanceNode}
          {children}
        </div>
      ) : null}
    </section>
  );
});

export default ToolOperationTimelineBlock;
