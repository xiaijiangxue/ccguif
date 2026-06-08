import { useEffect } from "react";
import {
  isEditableShortcutTarget,
  matchesShortcutForPlatform,
} from "../../../utils/shortcuts";

type UsePanelShortcutsOptions = {
  toggleProjectsSidebarShortcut: string | null;
  toggleDebugPanelShortcut: string | null;
  toggleTerminalShortcut: string | null;
  sidebarCollapsed: boolean;
  onCollapseSidebar: () => void;
  onExpandSidebar: () => void;
  onToggleDebug: () => void;
  onToggleTerminal: () => void;
};

export function usePanelShortcuts({
  toggleProjectsSidebarShortcut,
  toggleDebugPanelShortcut,
  toggleTerminalShortcut,
  sidebarCollapsed,
  onCollapseSidebar,
  onExpandSidebar,
  onToggleDebug,
  onToggleTerminal,
}: UsePanelShortcutsOptions) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.defaultPrevented) {
        return;
      }
      if (
        isEditableShortcutTarget(event.target) ||
        isEditableShortcutTarget(document.activeElement)
      ) {
        return;
      }
      if (matchesShortcutForPlatform(event, toggleProjectsSidebarShortcut)) {
        event.preventDefault();
        if (sidebarCollapsed) {
          onExpandSidebar();
        } else {
          onCollapseSidebar();
        }
        return;
      }
      if (matchesShortcutForPlatform(event, toggleDebugPanelShortcut)) {
        event.preventDefault();
        onToggleDebug();
        return;
      }
      if (matchesShortcutForPlatform(event, toggleTerminalShortcut)) {
        event.preventDefault();
        onToggleTerminal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    onCollapseSidebar,
    onExpandSidebar,
    onToggleDebug,
    onToggleTerminal,
    sidebarCollapsed,
    toggleDebugPanelShortcut,
    toggleProjectsSidebarShortcut,
    toggleTerminalShortcut,
  ]);
}
