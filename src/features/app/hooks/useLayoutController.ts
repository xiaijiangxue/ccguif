import { useLayoutMode } from "../../layout/hooks/useLayoutMode";
import { useResizablePanels } from "../../layout/hooks/useResizablePanels";
import { useSidebarToggles } from "../../layout/hooks/useSidebarToggles";
import { usePanelVisibility } from "../../layout/hooks/usePanelVisibility";
import { usePanelShortcuts } from "../../layout/hooks/usePanelShortcuts";

export function useLayoutController({
  activeWorkspaceId,
  setActiveTab,
  setDebugOpen,
  toggleProjectsSidebarShortcut,
  toggleDebugPanelShortcut,
  toggleTerminalShortcut,
}: {
  activeWorkspaceId: string | null;
  setActiveTab: (tab: "projects" | "codex" | "spec" | "git" | "log") => void;
  setDebugOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
  toggleProjectsSidebarShortcut: string | null;
  toggleDebugPanelShortcut: string | null;
  toggleTerminalShortcut: string | null;
}) {
  const {
    sidebarWidth,
    rightPanelWidth,
    setRightPanelWidth,
    onSidebarResizeStart,
    onRightPanelResizeStart,
    planPanelHeight,
    onPlanPanelResizeStart,
    terminalPanelHeight,
    onTerminalPanelResizeStart,
    debugPanelHeight,
    onDebugPanelResizeStart,
    kanbanConversationWidth,
    onKanbanConversationResizeStart,
  } = useResizablePanels();

  const layoutMode = useLayoutMode();
  const isCompact = layoutMode !== "desktop";
  const isTablet = layoutMode === "tablet";
  const isPhone = layoutMode === "phone";

  const {
    sidebarCollapsed,
    rightPanelCollapsed,
    collapseSidebar,
    expandSidebar,
    collapseRightPanel,
    expandRightPanel,
  } = useSidebarToggles({ isCompact });

  const {
    terminalOpen,
    onToggleDebug: handleDebugClick,
    onToggleTerminal: handleToggleTerminal,
    openTerminal,
    closeTerminal,
  } = usePanelVisibility({
    isCompact,
    activeWorkspaceId,
    setActiveTab,
    setDebugOpen,
  });

  usePanelShortcuts({
    toggleProjectsSidebarShortcut,
    toggleDebugPanelShortcut,
    toggleTerminalShortcut,
    sidebarCollapsed,
    onCollapseSidebar: collapseSidebar,
    onExpandSidebar: expandSidebar,
    onToggleDebug: handleDebugClick,
    onToggleTerminal: handleToggleTerminal,
  });

  return {
    layoutMode,
    isCompact,
    isTablet,
    isPhone,
    sidebarWidth,
    rightPanelWidth,
    setRightPanelWidth,
    planPanelHeight,
    terminalPanelHeight,
    debugPanelHeight,
    kanbanConversationWidth,
    onSidebarResizeStart,
    onRightPanelResizeStart,
    onPlanPanelResizeStart,
    onTerminalPanelResizeStart,
    onDebugPanelResizeStart,
    onKanbanConversationResizeStart,
    sidebarCollapsed,
    rightPanelCollapsed,
    collapseSidebar,
    expandSidebar,
    collapseRightPanel,
    expandRightPanel,
    terminalOpen,
    handleDebugClick,
    handleToggleTerminal,
    openTerminal,
    closeTerminal,
  };
}
