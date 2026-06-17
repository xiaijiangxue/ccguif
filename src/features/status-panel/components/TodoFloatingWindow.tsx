import { memo, useEffect, useMemo, useRef, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { motion, useDragControls, useMotionValue } from "framer-motion";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";
import type { TodoItem } from "../types";
import { TodoList } from "./TodoList";
import { useTodoFloatingState } from "../hooks/useTodoFloatingState";
import { hasIncompleteTodo } from "../utils/todoFloatingWindow";

const FLOATING_WIDTH = 280;

interface TodoFloatingWindowProps {
  todos: TodoItem[];
  sessionId: string;
  constraintRef: RefObject<HTMLElement | null>;
  className?: string;
}

export const TodoFloatingWindow = memo(function TodoFloatingWindow({
  todos,
  sessionId,
  constraintRef,
  className,
}: TodoFloatingWindowProps) {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const suppressNextClickRef = useRef(false);
  const state = useTodoFloatingState(todos, sessionId);
  const dragControls = useDragControls();
  const x = useMotionValue(state.position.x);
  const y = useMotionValue(state.position.y);

  useEffect(() => {
    x.set(state.position.x);
    y.set(state.position.y);
  }, [state.position.x, state.position.y, x, y]);

  const windowClassName = useMemo(
    () =>
      [
        "tfw-window",
        state.visibility === "expanded" ? "is-expanded" : "is-collapsed",
        hasIncompleteTodo(state.todos) ? "has-active-todos" : "is-completed",
        className,
      ]
        .filter(Boolean)
        .join(" "),
    [className, state.todos, state.visibility],
  );

  if (state.visibility === "hidden") {
    return null;
  }

  return (
    <motion.div
      ref={rootRef}
      className={windowClassName}
      style={{
        x,
        y,
        width: FLOATING_WIDTH,
      }}
      drag
      dragControls={dragControls}
      dragListener={false}
      dragElastic={0}
      dragMomentum={false}
      dragConstraints={constraintRef}
      onDragStart={() => {
        suppressNextClickRef.current = true;
      }}
      onDragEnd={(_, info) => {
        state.setPosition({
          x: state.position.x + info.offset.x,
          y: state.position.y + info.offset.y,
        });
        window.setTimeout(() => {
          suppressNextClickRef.current = false;
        }, 0);
      }}
    >
      <button
        type="button"
        className="tfw-header"
        onPointerDown={(event) => {
          dragControls.start(event);
        }}
        onClick={() => {
          if (suppressNextClickRef.current) {
            return;
          }
          state.toggleExpand();
        }}
        aria-label={state.isExpanded ? t("statusPanel.collapse") : t("statusPanel.expand")}
        title={state.isExpanded ? t("statusPanel.collapse") : t("statusPanel.expand")}
      >
        <span className="tfw-summary">{state.summaryText}</span>
        {state.isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {state.isExpanded ? (
        <div className="tfw-body">
          <TodoList todos={state.todos} />
        </div>
      ) : null}
    </motion.div>
  );
});
