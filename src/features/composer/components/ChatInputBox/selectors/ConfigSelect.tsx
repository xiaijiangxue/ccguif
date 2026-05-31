import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Menu } from '@ark-ui/react/menu';
import { Portal } from '@ark-ui/react/portal';
import { Switch } from 'antd';
import Check from "lucide-react/dist/esm/icons/check";
import { AgentIcon } from '../../../../../components/AgentIcon';
import { agentProvider, CREATE_NEW_AGENT_ID, EMPTY_STATE_ID, type AgentItem } from '../providers/agentProvider';
import type { AccountRateLimitsInfo, CodexSpeedMode, ProviderId, SelectedAgent } from '../types';
import { formatRelativeTime } from '../../../../../utils/time';
import { cn } from '@/lib/utils';
import { announceHoverMenuOpen, createHoverMenuCloseController, subscribeToHoverMenuOpen } from './hoverMenuCoordination';

interface ConfigSelectProps {
  currentProvider: string;
  onProviderChange: (providerId: string) => void;
  providerAvailability?: Partial<Record<ProviderId, boolean>>;
  providerVersions?: Partial<Record<ProviderId, string | null>>;
  alwaysThinkingEnabled?: boolean;
  onToggleThinking?: (enabled: boolean) => void;
  streamingEnabled?: boolean;
  onStreamingEnabledChange?: (enabled: boolean) => void;
  accountRateLimits?: AccountRateLimitsInfo | null;
  usageShowRemaining?: boolean;
  onRefreshAccountRateLimits?: () => Promise<void> | void;
  selectedCollaborationModeId?: string | null;
  onSelectCollaborationMode?: (id: string | null) => void;
  codexSpeedMode?: CodexSpeedMode;
  onCodexSpeedModeChange?: (mode: Exclude<CodexSpeedMode, 'unknown'>) => void;
  onCodexReviewQuickStart?: () => void;
  onForkQuickStart?: () => void;
  selectedAgent?: SelectedAgent | null;
  onAgentSelect?: (agent: SelectedAgent) => void;
  onOpenAgentSettings?: () => void;
}

/**
 * ConfigSelect - Combined Configuration Selector
 * Contains CLI Tool Selection and Thinking Switch
 */
export const ConfigSelect = ({
  currentProvider: providerId,
  alwaysThinkingEnabled,
  onToggleThinking,
  streamingEnabled,
  onStreamingEnabledChange,
  accountRateLimits,
  usageShowRemaining = false,
  onRefreshAccountRateLimits,
  selectedCollaborationModeId,
  onSelectCollaborationMode,
  codexSpeedMode = 'unknown',
  onCodexSpeedModeChange,
  onCodexReviewQuickStart,
  onForkQuickStart,
  selectedAgent,
  onAgentSelect,
  onOpenAgentSettings,
}: ConfigSelectProps) => {
  const hoverMenuId = 'config-select';
  const USAGE_REFRESH_TIMEOUT_MS = 10_000;
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [agentMenuOpen, setAgentMenuOpen] = useState(false);
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);
  const [usageMenuOpen, setUsageMenuOpen] = useState(false);
  const [agentItems, setAgentItems] = useState<AgentItem[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [usageLoading, setUsageLoading] = useState(false);
  
  const buttonRef = useRef<HTMLButtonElement>(null);
  const agentTriggerRef = useRef<HTMLDivElement>(null);
  const speedTriggerRef = useRef<HTMLDivElement>(null);
  const usageTriggerRef = useRef<HTMLDivElement>(null);
  const agentAbortControllerRef = useRef<AbortController | null>(null);
  const usageLoadingRef = useRef(false);

  const isCodexProvider = providerId === 'codex';
  const isClaudeProvider = providerId === 'claude';
  const supportsReviewQuickAction = isCodexProvider || isClaudeProvider;
  const supportsForkQuickAction = isCodexProvider || isClaudeProvider;
  const isPlanModeEnabled = (selectedCollaborationModeId ?? 'code') === 'plan';

  const closeAllMenus = useCallback(() => {
    setAgentMenuOpen(false);
    setSpeedMenuOpen(false);
    setUsageMenuOpen(false);
    setIsOpen(false);
  }, []);
  const hoverCloseControllerRef = useRef(createHoverMenuCloseController(closeAllMenus));

  const handleTriggerPointerLeave = useCallback((event: ReactPointerEvent) => {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Element && nextTarget.closest('[data-scope="menu"]')) {
      return;
    }

    hoverCloseControllerRef.current.schedule();
  }, []);

  const handleMenuPointerLeave = useCallback((event: ReactPointerEvent) => {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Element && nextTarget.closest('[data-scope="menu"]')) {
      return;
    }

    hoverCloseControllerRef.current.schedule();
  }, []);

  const handlePlanModeToggle = useCallback(
    (enabled: boolean) => {
      if (!onSelectCollaborationMode) {
        return;
      }
      onSelectCollaborationMode(enabled ? 'plan' : 'code');
    },
    [onSelectCollaborationMode],
  );

  const resolveUsagePercent = useCallback(
    (usedPercent: number | null | undefined): number | null => {
      if (typeof usedPercent !== 'number' || Number.isNaN(usedPercent)) {
        return null;
      }
      const clamped = Math.max(0, Math.min(100, Math.round(usedPercent)));
      return usageShowRemaining ? 100 - clamped : clamped;
    },
    [usageShowRemaining],
  );

  const formatUsageReset = useCallback(
    (value: number | null | undefined, labelKey: 'usage.sessionReset' | 'usage.weeklyReset') => {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return null;
      }
      const resetMs = value > 1_000_000_000_000 ? value : value * 1000;
      return `${t(labelKey)} ${formatRelativeTime(resetMs)}`;
    },
    [t],
  );

  const usageSnapshot = useMemo(() => {
    const sessionPercent = resolveUsagePercent(accountRateLimits?.primary?.usedPercent);
    const weeklyPercent = resolveUsagePercent(accountRateLimits?.secondary?.usedPercent);
    return {
      sessionPercent,
      weeklyPercent,
      showWeekly: Boolean(accountRateLimits?.secondary),
      sessionResetLabel: formatUsageReset(
        accountRateLimits?.primary?.resetsAt,
        'usage.sessionReset',
      ),
      weeklyResetLabel: formatUsageReset(
        accountRateLimits?.secondary?.resetsAt,
        'usage.weeklyReset',
      ),
    };
  }, [accountRateLimits, formatUsageReset, resolveUsagePercent]);

  const loadAgents = useCallback(async () => {
    if (agentAbortControllerRef.current) {
      agentAbortControllerRef.current.abort();
    }

    const controller = new AbortController();
    agentAbortControllerRef.current = controller;

    setAgentsLoading(true);
    try {
      const list = await agentProvider('', controller.signal);
      if (controller.signal.aborted) return;
      setAgentItems(list);
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
      setAgentItems([{
        id: EMPTY_STATE_ID,
        name: t('settings.agent.loadFailed'),
        prompt: '',
      }, {
        id: CREATE_NEW_AGENT_ID,
        name: t('settings.agent.createAgent'),
        prompt: '',
      }]);
    } finally {
      if (!controller.signal.aborted) {
        setAgentsLoading(false);
      }
    }
  }, [t]);

  const refreshUsageSnapshot = useCallback(async () => {
    if (!onRefreshAccountRateLimits || usageLoadingRef.current) {
      return;
    }
    usageLoadingRef.current = true;
    setUsageLoading(true);
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    try {
      await Promise.race([
        Promise.resolve(onRefreshAccountRateLimits()),
        new Promise<void>((resolve) => {
          timeoutId = setTimeout(resolve, USAGE_REFRESH_TIMEOUT_MS);
        }),
      ]);
    } catch {
      // Ignore refresh failures so the menu remains usable.
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      usageLoadingRef.current = false;
      setUsageLoading(false);
    }
  }, [onRefreshAccountRateLimits]);

  useEffect(() => {
    return subscribeToHoverMenuOpen(hoverMenuId, closeAllMenus);
  }, [closeAllMenus]);

  useEffect(() => {
    const hoverCloseController = hoverCloseControllerRef.current;
    return () => {
      hoverCloseController.cleanup();
    };
  }, []);

  useEffect(() => {
    if (!agentMenuOpen) return;
    loadAgents();
  }, [agentMenuOpen, loadAgents]);

  useEffect(() => {
    if (!usageMenuOpen) return;
    void refreshUsageSnapshot();
  }, [usageMenuOpen, refreshUsageSnapshot]);

  useEffect(() => {
    if (isOpen) {
      return;
    }
    closeAllMenus();
  }, [closeAllMenus, isOpen]);

  useEffect(() => {
    return () => {
      if (agentAbortControllerRef.current) {
        agentAbortControllerRef.current.abort();
      }
    };
  }, []);

  const handleCodexSpeedSelect = useCallback((mode: Exclude<CodexSpeedMode, 'unknown'>) => {
    onCodexSpeedModeChange?.(mode);
    setIsOpen(false);
  }, [onCodexSpeedModeChange]);

  const handleCodexReviewQuickStart = useCallback(() => {
    onCodexReviewQuickStart?.();
    setIsOpen(false);
  }, [onCodexReviewQuickStart]);

  const handleForkQuickStart = useCallback(() => {
    onForkQuickStart?.();
    setIsOpen(false);
  }, [onForkQuickStart]);

  const baseMenuContentClassName = cn(
    "selector-menu-surface z-[10001] overflow-hidden rounded-[14px] p-0 text-popover-foreground",
    "data-[state=open]:animate-in data-[state=closed]:animate-out",
    "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
    "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
    "data-[placement^=bottom]:slide-in-from-top-2 data-[placement^=top]:slide-in-from-bottom-2",
    "data-[placement^=left]:slide-in-from-right-2 data-[placement^=right]:slide-in-from-left-2",
  );

  const menuRowClassName = cn(
    "selector-option m-0 rounded-[12px]",
    "data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground",
    "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
    "outline-none",
  );

  return (
    <Menu.Root
      closeOnSelect={false}
      lazyMount
      onOpenChange={(details) => setIsOpen(details.open)}
      open={isOpen}
      positioning={{
        placement: 'top-start',
        gutter: 4,
        flip: true,
        shift: { padding: 8 },
      }}
    >
      <Menu.Trigger
        ref={buttonRef}
        className="selector-button config-button"
        title={t('settings.configure', 'Configure')}
        onPointerEnter={() => {
          hoverCloseControllerRef.current.cancel();
          announceHoverMenuOpen(hoverMenuId);
          setIsOpen(true);
        }}
        onPointerLeave={handleTriggerPointerLeave}
      >
        <span className="codicon codicon-settings" />
      </Menu.Trigger>

      <Portal>
        <Menu.Positioner className="z-[10001] outline-none">
          <Menu.Content
            className={cn(baseMenuContentClassName, "min-w-[220px]")}
            aria-label={t('settings.configure', 'Configure')}
            onPointerEnter={() => hoverCloseControllerRef.current.cancel()}
            onPointerLeave={handleMenuPointerLeave}
          >
            <Menu.Root
              lazyMount
              onOpenChange={(details) => setAgentMenuOpen(details.open)}
              open={agentMenuOpen}
              positioning={{
                placement: 'right-start',
                gutter: 18,
                flip: true,
                shift: { padding: 8 },
              }}
            >
              <Menu.TriggerItem
                ref={agentTriggerRef}
                className={cn(menuRowClassName, agentMenuOpen && "is-submenu-active")}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setAgentMenuOpen(true);
                }}
                onFocus={() => setAgentMenuOpen(true)}
                onPointerMove={() => setAgentMenuOpen(true)}
              >
                <AgentIcon
                  icon={selectedAgent?.icon}
                  seed={selectedAgent?.id || selectedAgent?.name}
                  fallback="codicon-robot"
                  className="selector-option-agent-icon"
                  size={16}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                  <span>{t('settings.agent.title')}</span>
                  {selectedAgent?.name ? (
                    <span className="model-description" style={{ fontStyle: 'normal' }}>
                      {selectedAgent.name}
                    </span>
                  ) : null}
                </div>
                <span className="codicon codicon-chevron-right ml-auto text-[12px]" />
              </Menu.TriggerItem>

              <Portal>
                <Menu.Positioner className="z-[10002] outline-none">
                  <Menu.Content
                    className={cn(baseMenuContentClassName, "min-w-[320px] max-w-[360px] max-h-[360px] overflow-y-auto overscroll-contain")}
                    onPointerEnter={() => hoverCloseControllerRef.current.cancel()}
                    onPointerLeave={handleMenuPointerLeave}
                  >
                    {agentsLoading ? (
                      <div className={cn(menuRowClassName, "cursor-default")}>
                        <span className="codicon codicon-loading codicon-modifier-spin" />
                        <span>{t('chat.loadingDropdown')}</span>
                      </div>
                    ) : (
                      agentItems.map((agent) => {
                        const isInfo = agent.id === EMPTY_STATE_ID;
                        const isCreate = agent.id === CREATE_NEW_AGENT_ID;
                        const isSelected = !!selectedAgent && selectedAgent.id === agent.id;

                        return (
                          <Menu.Item
                            key={agent.id}
                            className={cn(menuRowClassName, isInfo && "cursor-default", "items-start")}
                            closeOnSelect={!isInfo}
                            disabled={isInfo}
                            value={`agent:${agent.id}`}
                            onSelect={() => {
                              if (isCreate) {
                                setIsOpen(false);
                                onOpenAgentSettings?.();
                                return;
                              }

                              onAgentSelect?.({
                                id: agent.id,
                                name: agent.name,
                                prompt: agent.prompt,
                                icon: agent.icon,
                              });
                              setIsOpen(false);
                            }}
                          >
                            {isCreate ? (
                              <span className="codicon codicon-add" />
                            ) : isInfo ? (
                              <span className="codicon codicon-info" />
                            ) : (
                              <AgentIcon
                                icon={agent.icon}
                                seed={agent.id || agent.name}
                                fallback="codicon-robot"
                                className="selector-option-agent-icon"
                                size={16}
                              />
                            )}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, flex: 1 }}>
                              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{agent.name}</span>
                              {agent.prompt ? (
                                <span className="model-description" style={{ fontStyle: 'normal', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {agent.prompt.length > 60 ? `${agent.prompt.substring(0, 60)}...` : agent.prompt}
                                </span>
                              ) : isCreate ? (
                                <span className="model-description" style={{ fontStyle: 'normal' }}>{t('settings.agent.createAgentHint')}</span>
                              ) : null}
                            </div>
                            {isSelected && <Check size={16} className="check-mark" />}
                          </Menu.Item>
                        );
                      })
                    )}
                  </Menu.Content>
                </Menu.Positioner>
              </Portal>
            </Menu.Root>
            {!isCodexProvider && (
              <>
                <Menu.Item
                  className={cn(menuRowClassName, "selector-option-streaming-toggle justify-between")}
                  closeOnSelect={false}
                  value="toggle:streaming"
                  onSelect={() => onStreamingEnabledChange?.(!(streamingEnabled ?? true))}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="codicon codicon-sync" />
                    <span>{t('settings.basic.streaming.label')}</span>
                  </div>
                  <Switch
                    size="small"
                    checked={streamingEnabled ?? true}
                    onClick={(checked, e) => {
                      e.stopPropagation();
                      onStreamingEnabledChange?.(checked);
                    }}
                  />
                </Menu.Item>

                <Menu.Item
                  className={cn(menuRowClassName, "selector-option-thinking-toggle justify-between")}
                  closeOnSelect={false}
                  value="toggle:thinking"
                  onSelect={() => onToggleThinking?.(!(alwaysThinkingEnabled ?? false))}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="codicon codicon-lightbulb" />
                    <span>{t('common.thinking')}</span>
                  </div>
                  <Switch
                    size="small"
                    checked={alwaysThinkingEnabled ?? false}
                    onClick={(checked, e) => {
                      e.stopPropagation();
                      onToggleThinking?.(checked);
                    }}
                  />
                </Menu.Item>
              </>
            )}

            {isCodexProvider && (
              <>
                <Menu.Item
                  className={cn(menuRowClassName, "selector-option-plan-mode justify-between")}
                  closeOnSelect={false}
                  value="toggle:plan-mode"
                  onSelect={() => handlePlanModeToggle(!isPlanModeEnabled)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="codicon codicon-git-branch" />
                    <span>{t('composer.planModeToggle')}</span>
                  </div>
                  <Switch
                    size="small"
                    checked={isPlanModeEnabled}
                    disabled={!onSelectCollaborationMode}
                    onClick={(checked, e) => {
                      e.stopPropagation();
                      handlePlanModeToggle(checked);
                    }}
                  />
                </Menu.Item>
              </>
            )}

            {isCodexProvider && (
              <>
                <Menu.Root
                  lazyMount
                  onOpenChange={(details) => setSpeedMenuOpen(details.open)}
              open={speedMenuOpen}
              positioning={{
                placement: 'right-start',
                gutter: 18,
                    flip: true,
                    shift: { padding: 8 },
                  }}
                >
                  <Menu.TriggerItem
                    ref={speedTriggerRef}
                    className={cn(menuRowClassName, "selector-option-speed", speedMenuOpen && "is-submenu-active")}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setSpeedMenuOpen(true);
                    }}
                    onFocus={() => setSpeedMenuOpen(true)}
                    onPointerMove={() => setSpeedMenuOpen(true)}
                  >
                    <span className="codicon codicon-zap" />
                    <span>{t('composer.speed')}</span>
                    <span className="codicon codicon-chevron-right ml-auto text-[12px]" />
                  </Menu.TriggerItem>

                  <Portal>
                    <Menu.Positioner className="z-[10002] outline-none">
                      <Menu.Content
                        className={cn(baseMenuContentClassName, "min-w-[180px]")}
                        onPointerEnter={() => hoverCloseControllerRef.current.cancel()}
                        onPointerLeave={handleMenuPointerLeave}
                      >
                        <Menu.Item
                          className={cn(menuRowClassName, "selector-option-speed-standard")}
                          value="speed:standard"
                          onSelect={() => handleCodexSpeedSelect('standard')}
                        >
                          <span>{t('composer.speedStandard')}</span>
                          {codexSpeedMode === 'standard' && <Check size={16} className="check-mark ml-auto" />}
                        </Menu.Item>
                        <Menu.Item
                          className={cn(menuRowClassName, "selector-option-speed-fast")}
                          value="speed:fast"
                          onSelect={() => handleCodexSpeedSelect('fast')}
                        >
                          <span>{t('composer.speedFast')}</span>
                          {codexSpeedMode === 'fast' && <Check size={16} className="check-mark ml-auto" />}
                        </Menu.Item>
                      </Menu.Content>
                    </Menu.Positioner>
                  </Portal>
                </Menu.Root>
              </>
            )}

            {supportsReviewQuickAction && (
              <>
                {supportsForkQuickAction && (
                  <Menu.Item
                    className={cn(menuRowClassName, "selector-option-fork-quick")}
                    value="action:fork"
                    onSelect={handleForkQuickStart}
                  >
                    <span className="codicon codicon-git-branch-create" />
                    <span>{t('composer.forkQuickAction')}</span>
                  </Menu.Item>
                )}
                <Menu.Item
                  className={cn(menuRowClassName, "selector-option-review-quick")}
                  value="action:review"
                  onSelect={handleCodexReviewQuickStart}
                >
                  <span className="codicon codicon-search" />
                  <span>{t('composer.reviewQuickAction')}</span>
                </Menu.Item>
              </>
            )}

            {isCodexProvider && (
              <>
                <Menu.Root
                  lazyMount
                  onOpenChange={(details) => setUsageMenuOpen(details.open)}
                  open={usageMenuOpen}
                  positioning={{
                    placement: 'right-start',
                    gutter: 18,
                    flip: true,
                    shift: { padding: 8 },
                  }}
                >
                  <Menu.TriggerItem
                    ref={usageTriggerRef}
                    className={cn(menuRowClassName, "selector-option-live-usage", usageMenuOpen && "is-submenu-active")}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setUsageMenuOpen(true);
                    }}
                    onFocus={() => setUsageMenuOpen(true)}
                    onPointerMove={() => setUsageMenuOpen(true)}
                  >
                    <span className="codicon codicon-pulse" />
                    <span>{t('composer.liveUsage')}</span>
                    <span className="codicon codicon-chevron-right ml-auto text-[12px]" title={t('home.usageSnapshot')} />
                  </Menu.TriggerItem>

                  <Portal>
                    <Menu.Positioner className="z-[10002] outline-none">
                      <Menu.Content
                        className={cn(baseMenuContentClassName, "selector-usage-dropdown min-w-[280px]")}
                        onPointerEnter={() => hoverCloseControllerRef.current.cancel()}
                        onPointerLeave={handleMenuPointerLeave}
                      >
                        <div className="selector-usage-header">
                          <span>{t('home.usageSnapshot')}</span>
                          <button
                            type="button"
                            className="selector-usage-refresh"
                            onClick={(e) => {
                              e.stopPropagation();
                              void refreshUsageSnapshot();
                            }}
                            title={t('home.refreshUsage')}
                          >
                            <span className={`codicon ${usageLoading ? 'codicon-loading codicon-modifier-spin' : 'codicon-refresh'}`} />
                          </button>
                        </div>

                        <div className="selector-usage-row">
                          <div className="selector-usage-row-top">
                            <span>5h limit</span>
                            <span>
                              {usageSnapshot.sessionPercent === null
                                ? '--'
                                : `${usageSnapshot.sessionPercent}% ${t(
                                    usageShowRemaining ? 'usage.remaining' : 'usage.used',
                                  )}`}
                            </span>
                          </div>
                          <div className="selector-usage-progress-track" aria-hidden>
                            <span
                              className="selector-usage-progress-fill"
                              style={{ width: `${usageSnapshot.sessionPercent ?? 0}%` }}
                            />
                          </div>
                          {usageSnapshot.sessionResetLabel && (
                            <div className="selector-usage-reset">{usageSnapshot.sessionResetLabel}</div>
                          )}
                        </div>

                        {usageSnapshot.showWeekly && (
                          <div className="selector-usage-row">
                            <div className="selector-usage-row-top">
                              <span>Weekly limit</span>
                              <span>
                                {usageSnapshot.weeklyPercent === null
                                  ? '--'
                                  : `${usageSnapshot.weeklyPercent}% ${t(
                                      usageShowRemaining ? 'usage.remaining' : 'usage.used',
                                    )}`}
                              </span>
                            </div>
                            <div className="selector-usage-progress-track" aria-hidden>
                              <span
                                className="selector-usage-progress-fill"
                                style={{ width: `${usageSnapshot.weeklyPercent ?? 0}%` }}
                              />
                            </div>
                            {usageSnapshot.weeklyResetLabel && (
                              <div className="selector-usage-reset">{usageSnapshot.weeklyResetLabel}</div>
                            )}
                          </div>
                        )}
                      </Menu.Content>
                    </Menu.Positioner>
                  </Portal>
                </Menu.Root>
              </>
            )}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};
