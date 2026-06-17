import { getClientStoreSync, writeClientStoreValue } from "../../../services/clientStorage";
import type { ConversationItem } from "../../../types";
import type { TodoItem } from "../types";
import { extractToolName, parseToolArgs } from "../../messages/components/toolBlocks/toolConstants";

const TODO_FLOATING_POSITION_KEY = "ccgui.todoFloating.position";
const TODO_FLOATING_EXPAND_KEY_PREFIX = "ccgui.todoFloating.expand.";

const DEFAULT_FLOATING_WIDTH = 280;
const DEFAULT_FLOATING_TOP = 16;
const DEFAULT_FLOATING_RIGHT = 16;
const DEFAULT_FLOATING_HEIGHT = 160;
const MIN_X = 0;
const MIN_Y = 0;

type FloatingPosition = {
  x: number;
  y: number;
};

type TaskCreateTodoAccumulator = TodoItem & {
  taskId?: string;
};

type TaskUpdateTarget = {
  description?: string;
  taskId?: string;
  taskIndex?: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getNestedTaskArgCandidates(
  args: Record<string, unknown> | null,
): Record<string, unknown>[] {
  if (!args) {
    return [];
  }
  const input =
    typeof args.input === "object" && args.input !== null
      ? (args.input as Record<string, unknown>)
      : null;
  const nestedArgs =
    typeof args.arguments === "object" && args.arguments !== null
      ? (args.arguments as Record<string, unknown>)
      : null;
  return [args, input, nestedArgs].filter(
    (entry): entry is Record<string, unknown> => Boolean(entry),
  );
}

function normalizeTodoStatus(status: unknown): TodoItem["status"] {
  const normalized = typeof status === "string" ? status.trim().toLowerCase() : "";
  if (normalized === "completed" || normalized === "done" || normalized === "success") {
    return "completed";
  }
  if (
    normalized === "in_progress" ||
    normalized === "in progress" ||
    normalized === "running" ||
    normalized === "processing"
  ) {
    return "in_progress";
  }
  return "pending";
}

function getTaskCreateDescription(args: Record<string, unknown> | null): string | null {
  const candidates = getNestedTaskArgCandidates(args);
  const keys = ["description", "title", "task", "summary", "content"];
  for (const candidate of candidates) {
    for (const key of keys) {
      const value = candidate[key];
      if (typeof value === "string" && value.trim().length > 0) {
        return value.trim();
      }
    }
  }
  return null;
}

function getTaskId(args: Record<string, unknown> | null): string | undefined {
  const candidates = getNestedTaskArgCandidates(args);
  const idKeys = ["task_id", "taskId", "id"];
  for (const candidate of candidates) {
    for (const key of idKeys) {
      const value = candidate[key];
      if (typeof value === "string" && value.trim().length > 0) {
        return value.trim();
      }
    }
  }
  return undefined;
}

function getTaskIndex(args: Record<string, unknown> | null): number | undefined {
  const candidates = getNestedTaskArgCandidates(args);
  const indexKeys = ["taskIndex", "task_index", "index"];
  for (const candidate of candidates) {
    for (const key of indexKeys) {
      const value = candidate[key];
      if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
        return value;
      }
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (/^\d+$/.test(trimmed)) {
          return Number(trimmed);
        }
      }
    }
  }
  return undefined;
}

function isTaskCreateTool(toolName: string, title: string) {
  const normalizedToolName = toolName.replace(/[\s_-]+/g, "");
  const normalizedTitle = title.trim().toLowerCase().replace(/[\s_-]+/g, "");
  return (
    normalizedToolName === "taskcreate" ||
    normalizedToolName === "createtask" ||
    normalizedTitle.includes("taskcreate") ||
    normalizedTitle.includes("createtask")
  );
}

function isTaskUpdateTool(toolName: string, title: string) {
  const normalizedToolName = toolName.replace(/[\s_-]+/g, "");
  const normalizedTitle = title.trim().toLowerCase().replace(/[\s_-]+/g, "");
  return (
    normalizedToolName === "taskupdate" ||
    normalizedToolName === "updatetask" ||
    normalizedTitle.includes("taskupdate") ||
    normalizedTitle.includes("updatetask")
  );
}

function getTaskUpdateTarget(
  args: Record<string, unknown> | null,
): TaskUpdateTarget | null {
  if (!args) return null;

  const candidates = getNestedTaskArgCandidates(args);
  const taskId = getTaskId(args);
  const taskIndex = getTaskIndex(args);

  // Extract description for content-based matching
  const descKeys = ["description", "title", "task", "name", "content"];
  for (const candidate of candidates) {
    for (const key of descKeys) {
      const value = candidate[key];
      if (typeof value === "string" && value.trim().length > 0) {
        return { description: value.trim(), taskId, taskIndex };
      }
    }
  }

  return taskId || taskIndex !== undefined ? { taskId, taskIndex } : null;
}

export function collectTodoItems(items: ConversationItem[]): TodoItem[] {
  let lastTodos: TodoItem[] = [];
  const taskCreateTodos: TaskCreateTodoAccumulator[] = [];
  for (const item of items) {
    if (item.kind !== "tool") continue;
    const title = typeof item.title === "string" ? item.title : "";
    const toolName = extractToolName(title).trim().toLowerCase();
    const args = parseToolArgs(item.detail);
    if (isTaskCreateTool(toolName, title)) {
      const content = getTaskCreateDescription(args);
      if (content) {
        taskCreateTodos.push({
          content,
          status: "pending",
          taskId: getTaskId(args) ?? String(taskCreateTodos.length + 1),
        });
      }
      continue;
    }
    if (isTaskUpdateTool(toolName, title)) {
      const target = getTaskUpdateTarget(args);
      const candidates = getNestedTaskArgCandidates(args);
      const statusKeys = ["status", "state"];
      let rawStatus: string | undefined;
      for (const candidate of candidates) {
        for (const key of statusKeys) {
          const value = candidate[key];
          if (typeof value === "string" && value.trim().length > 0) {
            rawStatus = value.trim();
            break;
          }
        }
        if (rawStatus !== undefined) break;
      }
      const newStatus = normalizeTodoStatus(rawStatus);
      if (target && taskCreateTodos.length > 0) {
        const idIdx = target.taskId
          ? taskCreateTodos.findIndex((todo) => todo.taskId === target.taskId)
          : -1;
        const indexIdx =
          idIdx < 0 &&
          target.taskIndex !== undefined &&
          target.taskIndex < taskCreateTodos.length
            ? target.taskIndex
            : -1;
        const idx = idIdx >= 0
          ? idIdx
          : indexIdx >= 0
          ? indexIdx
          : target.description
          ? taskCreateTodos.findIndex(
              (t) => t.content === target.description,
            )
          : -1;
        if (idx >= 0) {
          taskCreateTodos[idx] = {
            ...taskCreateTodos[idx],
            status: newStatus,
          };
        } else if (target.description) {
          const partialIdx = taskCreateTodos.findIndex(
            (t) =>
              t.content.includes(target.description!) ||
              target.description!.includes(t.content),
          );
          if (partialIdx >= 0) {
            taskCreateTodos[partialIdx] = {
              ...taskCreateTodos[partialIdx],
              status: newStatus,
            };
          }
        }
      }
      continue;
    }
    if (toolName !== "todowrite" && toolName !== "todo_write") continue;
    if (!args) continue;
    const raw = args.todos;
    if (!Array.isArray(raw)) continue;
    lastTodos = raw
      .filter(
        (todo): todo is { content: string; status: unknown; activeForm?: unknown } =>
          typeof todo === "object" &&
          todo !== null &&
          typeof (todo as Record<string, unknown>).content === "string",
      )
      .map((todo) => ({
        content: todo.content,
        status: normalizeTodoStatus(todo.status),
        activeForm:
          typeof todo.activeForm === "string" ? todo.activeForm : undefined,
      }));
  }
  return lastTodos.length > 0
    ? lastTodos
    : taskCreateTodos.map(({ taskId: _taskId, ...todo }) => todo);
}

export function resolveTodoSummary(todos: TodoItem[]) {
  const completed = todos.filter((todo) => todo.status === "completed").length;
  return {
    completed,
    total: todos.length,
    summaryText: `待办 ${completed}/${todos.length}`,
  };
}

export function getTodoFloatingExpandKey(sessionId: string) {
  return `${TODO_FLOATING_EXPAND_KEY_PREFIX}${sessionId}`;
}

export function readTodoFloatingExpandState(sessionId: string): boolean | undefined {
  const stored = getClientStoreSync<unknown>("layout", getTodoFloatingExpandKey(sessionId));
  return stored === "1" ? true : stored === "0" ? false : undefined;
}

export function writeTodoFloatingExpandState(sessionId: string, expanded: boolean) {
  writeClientStoreValue("layout", getTodoFloatingExpandKey(sessionId), expanded ? "1" : "0");
}

export function readTodoFloatingPosition(): FloatingPosition | undefined {
  const stored = getClientStoreSync<unknown>("layout", TODO_FLOATING_POSITION_KEY);
  if (
    typeof stored === "object" &&
    stored !== null &&
    isFiniteNumber((stored as { x?: unknown }).x) &&
    isFiniteNumber((stored as { y?: unknown }).y)
  ) {
    return {
      x: (stored as { x: number }).x,
      y: (stored as { y: number }).y,
    };
  }
  return undefined;
}

export function writeTodoFloatingPosition(position: FloatingPosition) {
  writeClientStoreValue("layout", TODO_FLOATING_POSITION_KEY, position);
}

export function resolveDefaultTodoFloatingPosition(
  viewportWidth: number,
  _viewportHeight: number,
  windowWidth = DEFAULT_FLOATING_WIDTH,
  _windowHeight = DEFAULT_FLOATING_HEIGHT,
): FloatingPosition {
  const safeViewportWidth = Number.isFinite(viewportWidth) ? viewportWidth : 0;
  const maxX = Math.max(MIN_X, Math.floor(safeViewportWidth - windowWidth - DEFAULT_FLOATING_RIGHT));
  return {
    x: clamp(maxX, MIN_X, Math.max(MIN_X, maxX)),
    y: DEFAULT_FLOATING_TOP,
  };
}

export function isLegacyDefaultTodoFloatingPosition(
  position: FloatingPosition,
  viewportWidth: number,
  viewportHeight: number,
  windowWidth = DEFAULT_FLOATING_WIDTH,
  windowHeight = DEFAULT_FLOATING_HEIGHT,
): boolean {
  const safeViewportWidth = Number.isFinite(viewportWidth) ? viewportWidth : 0;
  const safeViewportHeight = Number.isFinite(viewportHeight) ? viewportHeight : 0;
  const legacyX = Math.max(
    MIN_X,
    Math.floor(safeViewportWidth - windowWidth - DEFAULT_FLOATING_RIGHT),
  );
  const legacyY = Math.max(
    MIN_Y,
    Math.floor(safeViewportHeight - windowHeight - DEFAULT_FLOATING_TOP),
  );
  return position.x === legacyX && position.y === legacyY;
}

export function clampTodoFloatingPosition(
  position: FloatingPosition,
  viewportWidth: number,
  viewportHeight: number,
  windowWidth = DEFAULT_FLOATING_WIDTH,
  windowHeight = DEFAULT_FLOATING_HEIGHT,
): FloatingPosition {
  const maxX = Math.max(MIN_X, Math.floor(viewportWidth - windowWidth));
  const maxY = Math.max(MIN_Y, Math.floor(viewportHeight - windowHeight));
  return {
    x: clamp(position.x, MIN_X, maxX),
    y: clamp(position.y, MIN_Y, maxY),
  };
}

export function shouldShowTodoFloatingWindow(todos: TodoItem[]) {
  return todos.length > 0;
}

export function hasIncompleteTodo(todos: TodoItem[]) {
  return todos.some((todo) => todo.status !== "completed");
}
