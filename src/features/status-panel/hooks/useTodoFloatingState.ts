import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { TodoItem } from "../types";
import {
  clampTodoFloatingPosition,
  isLegacyDefaultTodoFloatingPosition,
  readTodoFloatingExpandState,
  readTodoFloatingPosition,
  resolveDefaultTodoFloatingPosition,
  resolveTodoSummary,
  shouldShowTodoFloatingWindow,
  writeTodoFloatingExpandState,
  writeTodoFloatingPosition,
} from "../utils/todoFloatingWindow";

type TodoFloatingState = {
  visibility: "hidden" | "collapsed" | "expanded";
  summaryText: string;
  todos: TodoItem[];
  isExpanded: boolean;
  toggleExpand: () => void;
  position: { x: number; y: number };
  setPosition: (position: { x: number; y: number }) => void;
};

type TodoFloatingBounds = {
  width: number;
  height: number;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function useTodoFloatingState(
  todos: TodoItem[],
  sessionId: string,
  bounds?: TodoFloatingBounds,
): TodoFloatingState {
  const summary = useMemo(() => resolveTodoSummary(todos), [todos]);
  const initialExpanded = readTodoFloatingExpandState(sessionId);
  const boundsWidth = bounds?.width ?? (typeof window === "undefined" ? 0 : window.innerWidth);
  const boundsHeight = bounds?.height ?? (typeof window === "undefined" ? 0 : window.innerHeight);
  const [isExpanded, setIsExpanded] = useState(() => initialExpanded ?? false);
  const [position, setPositionState] = useState(() => {
    if (typeof window === "undefined") {
      return { x: 0, y: 0 };
    }
    const defaultPosition = resolveDefaultTodoFloatingPosition(
      boundsWidth,
      boundsHeight,
    );
    const stored = readTodoFloatingPosition();
    if (!stored) {
      return defaultPosition;
    }
    if (
      isLegacyDefaultTodoFloatingPosition(
        stored,
        boundsWidth,
        boundsHeight,
      )
    ) {
      return defaultPosition;
    }
    return clampTodoFloatingPosition(stored, boundsWidth, boundsHeight);
  });
  const positionRef = useRef(position);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  // NOTE: expand/collapse state is ONLY controlled by toggleExpand (user action).
  // Do NOT auto-collapse on data changes — it breaks the user's manual state.

  useEffect(() => {
    writeTodoFloatingExpandState(sessionId, isExpanded);
  }, [isExpanded, sessionId]);

  useEffect(() => {
    writeTodoFloatingPosition(position);
  }, [position]);

  useLayoutEffect(() => {
    setPositionState((current) =>
      clampTodoFloatingPosition(current, boundsWidth, boundsHeight),
    );
  }, [boundsHeight, boundsWidth]);

  const toggleExpand = useCallback(() => {
    setIsExpanded((current) => !current);
  }, []);

  const setPosition = useCallback((nextPosition: { x: number; y: number }) => {
    if (!isFiniteNumber(nextPosition.x) || !isFiniteNumber(nextPosition.y)) {
      return;
    }
    setPositionState(
      clampTodoFloatingPosition(nextPosition, boundsWidth, boundsHeight),
    );
  }, [boundsHeight, boundsWidth]);

  return {
    visibility: shouldShowTodoFloatingWindow(todos)
      ? isExpanded
        ? "expanded"
        : "collapsed"
      : "hidden",
    summaryText: summary.summaryText,
    todos,
    isExpanded,
    toggleExpand,
    position,
    setPosition,
  };
}
