import { useEffect, useState, useMemo, useRef } from "react";
import type { KeyboardEvent } from "react";
import type { LucideIcon } from "lucide-react";
import Archive from "lucide-react/dist/esm/icons/archive";
import Bug from "lucide-react/dist/esm/icons/bug";
import BrainCircuit from "lucide-react/dist/esm/icons/brain-circuit";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import ChevronLeft from "lucide-react/dist/esm/icons/chevron-left";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";
import ChevronUp from "lucide-react/dist/esm/icons/chevron-up";
import CopyPlus from "lucide-react/dist/esm/icons/copy-plus";
import Cpu from "lucide-react/dist/esm/icons/cpu";
import FolderOpen from "lucide-react/dist/esm/icons/folder-open";
import FolderTree from "lucide-react/dist/esm/icons/folder-tree";
import GitBranch from "lucide-react/dist/esm/icons/git-branch";
import GitBranchPlus from "lucide-react/dist/esm/icons/git-branch-plus";
import KanbanSquare from "lucide-react/dist/esm/icons/kanban-square";
import MessageSquare from "lucide-react/dist/esm/icons/message-square";
import MessageSquarePlus from "lucide-react/dist/esm/icons/message-square-plus";
import MonitorCog from "lucide-react/dist/esm/icons/monitor-cog";
import OctagonX from "lucide-react/dist/esm/icons/octagon-x";
import PanelLeftOpen from "lucide-react/dist/esm/icons/panel-left-open";
import PanelRightOpen from "lucide-react/dist/esm/icons/panel-right-open";
import RotateCcw from "lucide-react/dist/esm/icons/rotate-ccw";
import Save from "lucide-react/dist/esm/icons/save";
import Search from "lucide-react/dist/esm/icons/search";
import SearchCode from "lucide-react/dist/esm/icons/search-code";
import Settings from "lucide-react/dist/esm/icons/settings";
import ShieldCheck from "lucide-react/dist/esm/icons/shield-check";
import SquarePlus from "lucide-react/dist/esm/icons/square-plus";
import TerminalSquare from "lucide-react/dist/esm/icons/terminal-square";
import UsersRound from "lucide-react/dist/esm/icons/users-round";
import X from "lucide-react/dist/esm/icons/x";
import ZoomIn from "lucide-react/dist/esm/icons/zoom-in";
import ZoomOut from "lucide-react/dist/esm/icons/zoom-out";
import { Button } from "@/components/ui/button";
import {
  formatShortcutForPlatform,
  getDefaultInterruptShortcut,
  parseShortcut,
} from "@/utils/shortcuts";
import type {
  ShortcutActionMetadata,
  ShortcutCategory,
  ShortcutDraftKey,
  ShortcutDrafts,
  ShortcutSettingKey,
} from "../settingsViewShortcuts";
import {
  shortcutActions,
  shortcutCategoryDefinitions,
} from "../settingsViewShortcuts";
const shortcutIconByActionId: Record<string, LucideIcon> = {
  "open-settings": Settings,
  "new-window": SquarePlus,
  "open-chat-mode": MessageSquare,
  "open-kanban-mode": KanbanSquare,
  "new-agent": MessageSquarePlus,
  "new-worktree-agent": GitBranchPlus,
  "new-clone-agent": CopyPlus,
  "archive-active-thread": Archive,
  "close-current-session": X,
  "cycle-open-session-prev": ChevronLeft,
  "cycle-open-session-next": ChevronRight,
  "toggle-left-conversation-sidebar": PanelLeftOpen,
  "toggle-right-conversation-sidebar": PanelRightOpen,
  "toggle-projects-sidebar": PanelLeftOpen,
  "toggle-git-sidebar": GitBranch,
  "toggle-global-search": Search,
  "toggle-debug-panel": Bug,
  "toggle-terminal": TerminalSquare,
  "toggle-runtime-console": MonitorCog,
  "toggle-files-surface": FolderOpen,
  "composer-cycle-model": Cpu,
  "composer-cycle-access": ShieldCheck,
  "composer-cycle-reasoning": BrainCircuit,
  "composer-cycle-collaboration": UsersRound,
  "interrupt-active-run": OctagonX,
  "save-file": Save,
  "find-in-file": SearchCode,
  "toggle-git-diff-list-view": FolderTree,
  "increase-ui-scale": ZoomIn,
  "decrease-ui-scale": ZoomOut,
  "reset-ui-scale": RotateCcw,
  "cycle-agent-next": ChevronDown,
  "cycle-agent-prev": ChevronUp,
  "cycle-workspace-next": ChevronRight,
  "cycle-workspace-prev": ChevronLeft,
};

/** Normalize Mac symbol modifiers to text equivalents for search. */
function normalizeSearchQuery(query: string): string {
  return query
    .replace(/\u2318/g, "cmd")
    .replace(/\u2325/g, "alt")
    .replace(/\u21E7/g, "shift")
    .replace(/\u2303/g, "ctrl")
    .toLowerCase()
    .trim();
}

/** Input that briefly flashes green after a successful shortcut entry. */
function ShortcutInput({
  className,
  value,
  placeholder,
  onKeyDown,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
}: {
  className?: string;
  value: string;
  placeholder: string;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  "aria-label"?: string;
  "aria-describedby"?: string;
}) {
  const [success, setSuccess] = useState(false);
  const prevValueRef = useRef(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (value === prevValueRef.current) {
      return;
    }

    const previousValue = prevValueRef.current;
    prevValueRef.current = value;

    if (value && value !== previousValue) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setSuccess(true);
      timerRef.current = setTimeout(() => setSuccess(false), 500);
    }
  }, [value]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return (
    <input
      className={`${className ?? ""}${success ? " settings-shortcuts-item-input-success" : ""}`}
      type="text"
      value={value}
      placeholder={placeholder}
      onKeyDown={onKeyDown}
      readOnly
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
    />
  );
}

function resolveDefaultShortcut(action: ShortcutActionMetadata): string | null {
  if (action.setting === "interruptShortcut") {
    return getDefaultInterruptShortcut();
  }
  return action.defaultShortcut;
}

type ShortcutsSectionProps = {
  active: boolean;
  t: (key: string) => string;
  shortcutDrafts: ShortcutDrafts;
  handleShortcutKeyDown: (
    event: KeyboardEvent<HTMLInputElement>,
    setting: ShortcutSettingKey,
  ) => void;
  updateShortcut: (
    setting: ShortcutSettingKey,
    value: string | null,
  ) => Promise<void>;
};

export function ShortcutsSection({
  active,
  t,
  shortcutDrafts,
  handleShortcutKeyDown,
  updateShortcut,
}: ShortcutsSectionProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState<
    Set<ShortcutCategory>
  >(new Set());
  const savedCollapsedRef = useRef<Set<ShortcutCategory>>(new Set());

  const isSearching = searchQuery.trim().length > 0;

  // Filter shortcut groups by search query (KTD1: modifier pre-check + parseShortcut)
  const shortcutGroups = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const normalizedQuery = normalizeSearchQuery(searchQuery.trim());

    // parseShortcut succeeds for any non-empty string (e.g. "save" → {key:"save"}).
    // Only enter key-matching mode when the query contains a modifier keyword,
    // otherwise always use name matching.
    const MODIFIER_RE = /(?:^|\+)(?:cmd|meta|ctrl|control|alt|option|shift)(?:\+|$)/;
    const looksLikeShortcut =
      MODIFIER_RE.test(normalizedQuery) || MODIFIER_RE.test(query);

    return shortcutCategoryDefinitions
      .map((category) => ({
        id: category.id,
        title: t(category.titleKey),
        description: t(category.descriptionKey),
        items: shortcutActions.filter((action) => {
          if (action.category !== category.id) return false;
          if (!query) return true;

          // Key matching: only when query looks like a shortcut
          if (looksLikeShortcut) {
            const parsed = parseShortcut(normalizedQuery || query);
            if (parsed) {
              const draftValue = shortcutDrafts[action.draftKey];
              if (!draftValue) return false;
              const draftParsed = parseShortcut(draftValue);
              if (!draftParsed) return false;
              return (
                parsed.key === draftParsed.key &&
                parsed.meta === draftParsed.meta &&
                parsed.ctrl === draftParsed.ctrl &&
                parsed.alt === draftParsed.alt &&
                parsed.shift === draftParsed.shift
              );
            }
          }

          // Name fuzzy match
          return t(action.labelKey).toLowerCase().includes(query);
        }),
      }))
      .filter((group) => group.items.length > 0);
  }, [searchQuery, shortcutDrafts, t]);

  // Effective collapsed state: search auto-overrides manual
  const effectiveCollapsed = useMemo(() => {
    if (!isSearching) return collapsedCategories;
    const matchingCategoryIds = new Set(
      shortcutGroups.map((g) => g.id),
    );
    return new Set(
      shortcutCategoryDefinitions
        .map((c) => c.id)
        .filter((id) => !matchingCategoryIds.has(id)),
    );
  }, [isSearching, collapsedCategories, shortcutGroups]);

  // Conflict detection: find duplicate shortcut key bindings
  const conflictMap = useMemo(() => {
    const map = new Map<ShortcutDraftKey, ShortcutDraftKey[]>();
    const valueToKeys = new Map<string, ShortcutDraftKey[]>();

    for (const action of shortcutActions) {
      const value = shortcutDrafts[action.draftKey];
      if (!value) continue;
      const normalized = value.toLowerCase().trim();
      if (!normalized) continue;
      const existing = valueToKeys.get(normalized) ?? [];
      existing.push(action.draftKey);
      valueToKeys.set(normalized, existing);
    }

    for (const keys of valueToKeys.values()) {
      if (keys.length > 1) {
        for (const key of keys) {
          map.set(
            key,
            keys.filter((k) => k !== key),
          );
        }
      }
    }

    return map;
  }, [shortcutDrafts]);

  // Lookup action label by draftKey (for conflict messages)
  const labelByDraftKey = useMemo(() => {
    const map = new Map<ShortcutDraftKey, string>();
    for (const action of shortcutActions) {
      map.set(action.draftKey, t(action.labelKey));
    }
    return map;
  }, [t]);

  // --- All hooks must be above this line (React rules) ---
  if (!active) {
    return null;
  }

  const handleSearchChange = (value: string) => {
    const wasSearching = isSearching;
    const nowSearching = value.trim().length > 0;

    if (nowSearching && !wasSearching) {
      // Entering search: save manual collapse state
      savedCollapsedRef.current = new Set(collapsedCategories);
    } else if (!nowSearching && wasSearching) {
      // Leaving search: restore manual collapse state
      setCollapsedCategories(new Set(savedCollapsedRef.current));
    }
    setSearchQuery(value);
  };

  const toggleCategory = (categoryId: ShortcutCategory) => {
    if (isSearching) return;
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  return (
    <section className="settings-section settings-shortcuts-section">
      <div className="settings-section-title">
        {t("settings.shortcutsTitle")}
      </div>
      <div className="settings-section-subtitle">
        {t("settings.shortcutsDescription")}
      </div>

      {/* Search bar */}
      <div className="settings-shortcuts-search">
        <span className="settings-shortcuts-search-icon" aria-hidden="true">
          <Search size={14} />
        </span>
        <input
          className="settings-input settings-shortcuts-search-input"
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder={t("settings.searchShortcuts")}
          aria-label={t("settings.searchShortcuts")}
        />
        {searchQuery && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="settings-shortcuts-search-clear"
            onClick={() => handleSearchChange("")}
            aria-label="Clear search"
          >
            <X size={12} />
          </Button>
        )}
      </div>

      {/* Shortcut groups */}
      <div className="settings-shortcuts-groups">
        {shortcutGroups.length === 0 && (
          <div className="settings-shortcuts-empty">
            {t("settings.noShortcutsFound")}
          </div>
        )}
        {shortcutGroups.map((group) => {
          const isCollapsed = effectiveCollapsed.has(group.id);
          return (
            <div className="settings-shortcuts-group" key={group.id}>
              <button
                type="button"
                className="settings-shortcuts-category-header"
                onClick={() => toggleCategory(group.id)}
                aria-expanded={!isCollapsed}
                aria-label={`${group.title} \u2014 ${isCollapsed ? "collapsed" : "expanded"}`}
              >
                <span className="settings-shortcuts-category-chevron" aria-hidden="true">
                  {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                </span>
                <span className="settings-shortcuts-category-title">{group.title}</span>
                <span className="settings-shortcuts-category-count">{group.items.length}</span>
                <span className="settings-shortcuts-category-description">{group.description}</span>
              </button>
              {!isCollapsed && (
                <div className="settings-shortcuts-grid">
                  {group.items.map((action) => {
                    const Icon = shortcutIconByActionId[action.id];
                    const draftValue = shortcutDrafts[action.draftKey] ?? "";
                    const defaultShortcut = resolveDefaultShortcut(action);
                    const conflicts = conflictMap.get(action.draftKey);
                    const conflictLabel = conflicts?.[0]
                      ? labelByDraftKey.get(conflicts[0])
                      : undefined;
                    return (
                      <div
                        className="settings-shortcuts-item-wrapper"
                        key={action.draftKey}
                      >
                        <div className="settings-shortcuts-item">
                          <span className="settings-shortcuts-item-icon" aria-hidden="true">
                            {Icon ? <Icon size={14} /> : null}
                          </span>
                          <span className="settings-shortcuts-item-title">
                            {t(action.labelKey)}
                          </span>
                          <ShortcutInput
                            className={`settings-input settings-input--shortcut settings-shortcuts-item-input${conflicts?.length ? " settings-shortcuts-item-input--conflict" : ""}`}
                            value={
                              draftValue
                                ? formatShortcutForPlatform(draftValue)
                                : ""
                            }
                            placeholder={t("settings.notSet")}
                            onKeyDown={(e) =>
                              handleShortcutKeyDown(e, action.setting)
                            }
                            aria-label={t(action.labelKey)}
                            aria-describedby={
                              conflicts?.length
                                ? `conflict-${action.draftKey}`
                                : undefined
                            }
                          />
                          <span className="settings-shortcuts-item-default">
                            {t(action.defaultLabelKey ?? "settings.defaultColon")}{" "}
                            {defaultShortcut
                              ? formatShortcutForPlatform(defaultShortcut)
                              : t("settings.notSet")}
                          </span>
                          {draftValue ? (
                            <>
                              {defaultShortcut && draftValue.toLowerCase() !== defaultShortcut.toLowerCase() && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="settings-shortcuts-item-clear"
                                  onClick={() =>
                                    updateShortcut(action.setting, defaultShortcut)
                                  }
                                  aria-label={t("settings.reset")}
                                  title={t("settings.reset")}
                                >
                                  <RotateCcw size={12} />
                                </Button>
                              )}
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="settings-shortcuts-item-clear"
                                onClick={() =>
                                  updateShortcut(action.setting, null)
                                }
                                aria-label={t("settings.clear")}
                              >
                                <X size={12} />
                              </Button>
                            </>
                          ) : defaultShortcut ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="settings-shortcuts-item-clear"
                              onClick={() =>
                                updateShortcut(action.setting, defaultShortcut)
                              }
                              aria-label={t("settings.reset")}
                            >
                              <RotateCcw size={12} />
                            </Button>
                          ) : null}
                        </div>
                        {conflicts?.length ? (
                          <div
                            className="settings-shortcuts-conflict"
                            id={`conflict-${action.draftKey}`}
                            role="alert"
                          >
                            ⚠ 与「{conflictLabel}」冲突
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
