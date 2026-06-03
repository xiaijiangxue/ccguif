import type { DragEvent, ReactNode } from "react";
import { useTranslation } from "react-i18next";

type WorkspaceGroupProps = {
  toggleId: string | null;
  name: string;
  showHeader: boolean;
  isCollapsed: boolean;
  isDropTarget?: boolean;
  onToggleCollapse: (groupId: string) => void;
  onWorkspaceDragOver?: (event: DragEvent<HTMLElement>, groupId: string) => void;
  onWorkspaceDragLeave?: (event: DragEvent<HTMLElement>) => void;
  onWorkspaceDrop?: (event: DragEvent<HTMLElement>, groupId: string) => void;
  children: ReactNode;
};

export function WorkspaceGroup({
  toggleId,
  name,
  showHeader,
  isCollapsed,
  isDropTarget = false,
  onToggleCollapse,
  onWorkspaceDragOver,
  onWorkspaceDragLeave,
  onWorkspaceDrop,
  children,
}: WorkspaceGroupProps) {
  const { t } = useTranslation();
  const isToggleable = Boolean(toggleId);
  return (
    <div className={`workspace-group${isDropTarget ? " is-drop-target" : ""}`}>
      {showHeader && (
        <div
          className={`workspace-group-header${isToggleable ? " is-toggleable" : ""}`}
          data-group-id={toggleId ?? undefined}
          onDragOver={
            toggleId
              ? (event) => onWorkspaceDragOver?.(event, toggleId)
              : undefined
          }
          onDragLeave={onWorkspaceDragLeave}
          onDrop={
            toggleId
              ? (event) => onWorkspaceDrop?.(event, toggleId)
              : undefined
          }
          onDoubleClick={
            toggleId
              ? (event) => {
                  if (event.button !== 0) {
                    return;
                  }
                  onToggleCollapse(toggleId);
                }
              : undefined
          }
          onKeyDown={
            toggleId
              ? (event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onToggleCollapse(toggleId);
                  }
                }
              : undefined
          }
          role={isToggleable ? "button" : undefined}
          aria-label={isToggleable ? `${isCollapsed ? "Expand" : "Collapse"} group` : undefined}
          aria-expanded={isToggleable ? !isCollapsed : undefined}
          tabIndex={isToggleable ? 0 : undefined}
        >
          <div className="workspace-group-title">
            <div className="workspace-group-label">{name}</div>
            {isDropTarget ? (
              <div className="workspace-group-drop-hint">{t("sidebar.workspaceDropMoveToGroup")}</div>
            ) : null}
          </div>
          {isToggleable && (
            <button
              className={`group-toggle ${isCollapsed ? "" : "expanded"}`}
              onClick={(event) => {
                event.stopPropagation();
                if (!toggleId) {
                  return;
                }
                onToggleCollapse(toggleId);
              }}
              onDoubleClick={(event) => {
                event.stopPropagation();
              }}
              aria-label={isCollapsed ? "Expand group" : "Collapse group"}
              aria-expanded={!isCollapsed}
              type="button"
            >
              <span className="group-toggle-icon">›</span>
            </button>
          )}
        </div>
      )}
      <div className={`workspace-group-list ${isCollapsed ? "collapsed" : ""}`}>
        <div className="workspace-group-content">{children}</div>
      </div>
    </div>
  );
}
