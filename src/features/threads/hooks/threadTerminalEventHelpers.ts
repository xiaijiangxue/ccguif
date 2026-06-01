export const FOREGROUND_TERMINAL_EVENT_METHODS = new Set([
  "turn/completed",
  "turn/error",
  "turn/stalled",
  "runtime/ended",
]);

function asRuntimeString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function extractTerminalEventThreadId(params: Record<string, unknown>): string {
  const turn = (params.turn as Record<string, unknown> | undefined) ?? {};
  const thread = (params.thread as Record<string, unknown> | undefined) ?? {};
  return asRuntimeString(
    params.threadId ??
      params.thread_id ??
      turn.threadId ??
      turn.thread_id ??
      thread.threadId ??
      thread.thread_id ??
      thread.id ??
      "",
  ).trim();
}

export function extractTerminalEventTurnId(params: Record<string, unknown>): string {
  const turn = (params.turn as Record<string, unknown> | undefined) ?? {};
  return asRuntimeString(params.turnId ?? params.turn_id ?? turn.id ?? "").trim();
}

export function extractTerminalEventResultTextLength(params: Record<string, unknown>): number | null {
  const result = (params.result as Record<string, unknown> | undefined) ?? {};
  const text = [
    params.text,
    result.text,
    result.output_text,
    result.outputText,
    result.content,
  ].find((value) => typeof value === "string" && value.trim().length > 0);
  return typeof text === "string" ? text.length : null;
}

export function normalizeRuntimeEndedCount(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}
