import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function useTodoFloatingState(
  todos: TodoItem[],
  sessionId: string,
): TodoFloatingState {
  const summary = useMemo(() => resolveTodoSummary(todos), [todos]);
  const initialExpanded = readTodoFloatingExpandState(sessionId);
  const [isExpanded, setIsExpanded] = useState(() => initialExpanded ?? false);
  const [position, setPositionState] = useState(() => {
    if (typeof window === "undefined") {
      return { x: 0, y: 0 };
    }
    const defaultPosition = resolveDefaultTodoFloatingPosition(
      window.innerWidth,
      window.innerHeight,
    );
    const stored = readTodoFloatingPosition();
    if (!stored) {
      return defaultPosition;
    }
    if (
      isLegacyDefaultTodoFloatingPosition(
        stored,
        window.innerWidth,
        window.innerHeight,
      )
    ) {
      return defaultPosition;
    }
    return stored;
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

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const handleResize = () => {
      setPositionState((current) =>
        clampTodoFloatingPosition(current, window.innerWidth, window.innerHeight),
      );
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const toggleExpand = useCallback(() => {
    setIsExpanded((current) => !current);
  }, []);

  const setPosition = useCallback((nextPosition: { x: number; y: number }) => {
    if (!isFiniteNumber(nextPosition.x) || !isFiniteNumber(nextPosition.y)) {
      return;
    }
    const viewportWidth = typeof window === "undefined" ? 0 : window.innerWidth;
    const viewportHeight = typeof window === "undefined" ? 0 : window.innerHeight;
    setPositionState(
      clampTodoFloatingPosition(nextPosition, viewportWidth, viewportHeight),
    );
  }, []);

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
