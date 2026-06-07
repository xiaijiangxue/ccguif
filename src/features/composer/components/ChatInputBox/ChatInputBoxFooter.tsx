import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { TFunction } from 'i18next';
import Circle from 'lucide-react/dist/esm/icons/circle';
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2';
import Layers3 from 'lucide-react/dist/esm/icons/layers-3';
import Clock3 from 'lucide-react/dist/esm/icons/clock-3';
import Tag from 'lucide-react/dist/esm/icons/tag';
import type { EngineType } from '../../../../types';
import type { ComposerSendReadiness } from '../../utils/composerSendReadiness';
import type {
  AccountRateLimitsInfo,
  DropdownItemData,
  DropdownPosition,
  ModelInfo,
  MemoryReferenceMode,
  PermissionMode,
  ProviderId,
  ReasoningEffort,
  SelectedAgent,
  ShortcutAction,
  StreamActivityPhase,
  TriggerQuery,
} from './types.js';
import type { ProviderModelGroup } from './modelOptions.js';
import type { TooltipState } from './hooks/useTooltip.js';
import { ButtonArea } from './ButtonArea.js';
import { CompletionDropdown, Dropdown } from './Dropdown/index.js';
import { PromptEnhancerDialog } from './PromptEnhancerDialog.js';
import { LocalImage } from '../../../../components/common/LocalImage';
import { Markdown } from '../../../messages/components/Markdown';

interface CompletionController {
  isOpen: boolean;
  position: DropdownPosition | null;
  items: DropdownItemData[];
  activeIndex: number;
  loading: boolean;
  triggerQuery?: TriggerQuery | null;
  close: () => void;
  selectIndex: (index: number) => void;
  handleMouseEnter: (index: number) => void;
}

type NoteCardDropdownData = {
  id: string;
  title: string;
  plainTextExcerpt: string;
  bodyMarkdown: string;
  updatedAt: number;
  archived: boolean;
  imageCount: number;
  previewAttachments: Array<{
    id: string;
    fileName: string;
    contentType: string;
    absolutePath: string;
  }>;
};

const COLLAPSED_NOTE_CARD_PREVIEW_ATTACHMENT_LIMIT = 3;

function asString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function asNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asPreviewAttachments(value: unknown): NoteCardDropdownData["previewAttachments"] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter(
      (attachment): attachment is NoteCardDropdownData["previewAttachments"][number] =>
        typeof attachment === 'object'
        && attachment !== null
        && typeof (attachment as { id?: unknown }).id === 'string'
        && typeof (attachment as { fileName?: unknown }).fileName === 'string'
        && typeof (attachment as { contentType?: unknown }).contentType === 'string'
        && typeof (attachment as { absolutePath?: unknown }).absolutePath === 'string',
    )
    .map((attachment) => ({
      id: attachment.id,
      fileName: attachment.fileName,
      contentType: attachment.contentType,
      absolutePath: attachment.absolutePath,
    }));
}

function asBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : false;
}

function resolveLocalPreviewSrc(path: string) {
  const normalizedPath = path.trim();
  if (!normalizedPath) {
    return '';
  }
  try {
    return convertFileSrc(normalizedPath);
  } catch {
    return normalizedPath;
  }
}

function toNoteCardDropdownData(item: DropdownItemData): NoteCardDropdownData | null {
  const record = (item.data ?? {}) as Record<string, unknown>;
  const noteCardId = asString(record.id) || item.id.replace(/^note-card:/, '');
  if (!noteCardId) {
    return null;
  }
  return {
    id: noteCardId,
    title: asString(record.title) || item.label,
    plainTextExcerpt: asString(record.plainTextExcerpt),
    bodyMarkdown: asString(record.bodyMarkdown),
    updatedAt: asNumber(record.updatedAt) ?? Date.now(),
    archived: asBoolean(record.archived),
    imageCount: asNumber(record.imageCount) ?? 0,
    previewAttachments: asPreviewAttachments(record.previewAttachments),
  };
}

export function ChatInputBoxFooter({
  disabled,
  hasInputContent,
  isLoading,
  streamActivityPhase = 'idle',
  isEnhancing,
  selectedModel,
  models,
  permissionMode,
  currentProvider,
  workspaceId = null,
  providerAvailability,
  providerVersions,
  providerStatusLabels,
  providerDisabledMessages,
  reasoningEffort,
  reasoningOptions,
  accountRateLimits,
  usageShowRemaining,
  onRefreshAccountRateLimits,
  selectedCollaborationModeId,
  onSelectCollaborationMode,
  codexSpeedMode = 'unknown',
  onCodexSpeedModeChange,
  onCodexReviewQuickStart,
  onForkQuickStart,
  memoryReferenceMode,
  onSetMemoryReferenceMode,
  onSubmit,
  onStop,
  onModeSelect,
  onModelSelect,
  onProviderSelect,
  onReasoningChange,
  onEnhancePrompt,
  alwaysThinkingEnabled,
  onToggleThinking,
  streamingEnabled,
  onStreamingEnabledChange,
  sendShortcut,
  selectedAgent,
  onAgentSelect,
  onOpenAgentSettings,
  onAddModel,
  onRefreshModelConfig,
  isModelConfigRefreshing,
  sendReadiness,
  onJumpToRequest,
  onToggleContextSources,
  contextSourcesExpanded,
  modelGroups,
  onProviderModelSelect,
  onClearAgent,
  fileCompletion,
  memoryCompletion,
  noteCardCompletion,
  commandCompletion,
  skillCompletion,
  agentCompletion,
  promptCompletion,
  selectedNoteCardIds = [],
  shortcutActions,
  mainSurface,
  toolSurface,
  panelToggleSurface,
  tooltip,
  promptEnhancer,
  containerRef,
  t,
}: {
  disabled: boolean;
  hasInputContent: boolean;
  isLoading: boolean;
  streamActivityPhase?: StreamActivityPhase;
  isEnhancing: boolean;
  selectedModel: string;
  models?: ModelInfo[];
  permissionMode: PermissionMode;
  currentProvider: string;
  workspaceId?: string | null;
  providerAvailability?: Partial<Record<ProviderId, boolean>>;
  providerVersions?: Partial<Record<ProviderId, string | null>>;
  providerStatusLabels?: Partial<Record<ProviderId, string | null>>;
  providerDisabledMessages?: Partial<Record<ProviderId, string | null>>;
  reasoningEffort: ReasoningEffort | null;
  reasoningOptions?: ReasoningEffort[];
  accountRateLimits?: AccountRateLimitsInfo | null;
  usageShowRemaining?: boolean;
  onRefreshAccountRateLimits?: () => Promise<void> | void;
  selectedCollaborationModeId?: string | null;
  onSelectCollaborationMode?: (id: string | null) => void;
  codexSpeedMode?: 'standard' | 'fast' | 'unknown';
  onCodexSpeedModeChange?: (mode: 'standard' | 'fast') => void;
  onCodexReviewQuickStart?: () => void;
  onForkQuickStart?: () => void;
  memoryReferenceMode?: MemoryReferenceMode;
  onSetMemoryReferenceMode?: (mode: MemoryReferenceMode) => void;
  onSubmit: () => void;
  onStop?: () => void;
  onModeSelect?: (mode: PermissionMode) => void;
  onModelSelect?: (modelId: string) => void;
  onProviderSelect?: (providerId: string) => void;
  onReasoningChange?: (effort: ReasoningEffort | null) => void;
  onEnhancePrompt: () => void;
  alwaysThinkingEnabled?: boolean;
  onToggleThinking?: (enabled: boolean) => void;
  streamingEnabled?: boolean;
  onStreamingEnabledChange?: (enabled: boolean) => void;
  sendShortcut: 'enter' | 'cmdEnter';
  selectedAgent?: SelectedAgent | null;
  onAgentSelect?: (agent: SelectedAgent) => void;
  onOpenAgentSettings?: () => void;
  onAddModel?: (providerId?: string) => void;
  onRefreshModelConfig?: (providerId?: string) => Promise<void> | void;
  isModelConfigRefreshing?: boolean;
  sendReadiness?: ComposerSendReadiness | null;
  onJumpToRequest?: () => void;
  onToggleContextSources?: () => void;
  contextSourcesExpanded?: boolean;
  modelGroups?: ProviderModelGroup[];
  onProviderModelSelect?: (providerId: ProviderId, modelId: string) => void;
  onClearAgent: () => void;
  fileCompletion: CompletionController;
  memoryCompletion: CompletionController;
  noteCardCompletion: CompletionController;
  commandCompletion: CompletionController;
  skillCompletion: CompletionController;
  agentCompletion: CompletionController;
  promptCompletion: CompletionController;
  selectedManualMemoryIds?: string[];
  selectedNoteCardIds?: string[];
  shortcutActions?: ShortcutAction[];
  mainSurface?: React.ReactNode;
  toolSurface?: React.ReactNode;
  panelToggleSurface?: React.ReactNode;
  tooltip: TooltipState | null;
  promptEnhancer: {
    isOpen: boolean;
    isLoading: boolean;
    loadingEngine: EngineType;
    originalPrompt: string;
    enhancedPrompt: string;
    canUseEnhanced: boolean;
    onUseEnhanced: () => void;
    onKeepOriginal: () => void;
    onClose: () => void;
  };
  containerRef?: React.RefObject<HTMLDivElement | null>;
  t: TFunction;
}) {
  const footerHostRef = useRef<HTMLDivElement>(null);
  const [expandedPreviewNoteCardId, setExpandedPreviewNoteCardId] = useState<string | null>(null);
  const [promptDropdownWidth, setPromptDropdownWidth] = useState(820);
  const selectedNoteCardIdSet = useMemo(
    () => new Set(selectedNoteCardIds),
    [selectedNoteCardIds],
  );

  const noteCardEntries = useMemo(
    () =>
      noteCardCompletion.items.map((item, index) => ({
        item,
        index,
        noteCard: toNoteCardDropdownData(item),
      })),
    [noteCardCompletion.items],
  );
  const activeNoteCardEntry =
    noteCardEntries[noteCardCompletion.activeIndex] ?? noteCardEntries[0] ?? null;
  const activeNoteCard = activeNoteCardEntry?.noteCard ?? null;
  const noteCardQueryText = (noteCardCompletion.triggerQuery?.query ?? '').trim();
  const noteCardPickerHeading = useMemo(() => {
    if (!noteCardQueryText) {
      return t('composer.noteCardPickerTitle');
    }
    const query = `@#${noteCardQueryText}`;
    const translated = t('composer.noteCardPickerInputTitle', { query });
    return translated === 'composer.noteCardPickerInputTitle'
      ? `便签：${query}`
      : translated;
  }, [noteCardQueryText, t]);
  const activeNoteCardPreview = (
    activeNoteCard?.bodyMarkdown ||
    activeNoteCard?.plainTextExcerpt ||
    ''
  ).trim();
  const activeNoteCardId = activeNoteCard?.id ?? null;
  const activeNoteCardPreviewExpanded =
    Boolean(activeNoteCardId) && expandedPreviewNoteCardId === activeNoteCardId;
  const activeNoteCardPreviewAttachments = activeNoteCard?.previewAttachments ?? [];
  const activeNoteCardVisiblePreviewAttachments = activeNoteCardPreviewExpanded
    ? activeNoteCardPreviewAttachments
    : activeNoteCardPreviewAttachments.slice(0, COLLAPSED_NOTE_CARD_PREVIEW_ATTACHMENT_LIMIT);
  const activeNoteCardPreviewLong =
    activeNoteCardPreview.length > 220 ||
    activeNoteCardPreviewAttachments.length > COLLAPSED_NOTE_CARD_PREVIEW_ATTACHMENT_LIMIT;

  useEffect(() => {
    if (!noteCardCompletion.isOpen || !activeNoteCardId) {
      setExpandedPreviewNoteCardId(null);
      return;
    }
    setExpandedPreviewNoteCardId((prev) => (prev === activeNoteCardId ? prev : null));
  }, [activeNoteCardId, noteCardCompletion.isOpen]);

  useLayoutEffect(() => {
    const footerHost = footerHostRef.current;
    if (!footerHost || typeof window === 'undefined') {
      return;
    }

    const homeComposerHost = footerHost.closest('.home-chat-composer-host') as HTMLElement | null;
    if (!homeComposerHost) {
      setPromptDropdownWidth((prev) => (prev === 820 ? prev : 820));
      return;
    }

    const syncPromptDropdownWidth = () => {
      const hostWidth = homeComposerHost.getBoundingClientRect().width;
      const nextWidth = Math.round(Math.max(420, Math.min(680, hostWidth * 0.76)));
      setPromptDropdownWidth((prev) => (prev === nextWidth ? prev : nextWidth));
    };

    syncPromptDropdownWidth();

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(syncPromptDropdownWidth) : null;
    resizeObserver?.observe(homeComposerHost);
    window.addEventListener('resize', syncPromptDropdownWidth);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', syncPromptDropdownWidth);
    };
  }, []);

  const formatMemoryDate = useMemo(
    () =>
      (value?: number) => {
        if (!value || !Number.isFinite(value)) {
          return '--';
        }
        return new Intl.DateTimeFormat(undefined, {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }).format(new Date(value));
      },
    [],
  );

  return (
    <div ref={footerHostRef} style={{ display: 'contents' }}>
      {/* Bottom button area */}
      <ButtonArea
        disabled={disabled || isLoading}
        hasInputContent={hasInputContent}
        isLoading={isLoading}
        streamActivityPhase={streamActivityPhase}
        isEnhancing={isEnhancing}
        selectedModel={selectedModel}
        models={models}
        permissionMode={permissionMode}
        currentProvider={currentProvider}
        providerAvailability={providerAvailability}
        providerVersions={providerVersions}
        providerStatusLabels={providerStatusLabels}
        providerDisabledMessages={providerDisabledMessages}
        reasoningEffort={reasoningEffort}
        reasoningOptions={reasoningOptions}
        accountRateLimits={accountRateLimits}
        usageShowRemaining={usageShowRemaining}
        onRefreshAccountRateLimits={onRefreshAccountRateLimits}
        selectedCollaborationModeId={selectedCollaborationModeId}
        onSelectCollaborationMode={onSelectCollaborationMode}
        codexSpeedMode={codexSpeedMode}
        onCodexSpeedModeChange={onCodexSpeedModeChange}
        onCodexReviewQuickStart={onCodexReviewQuickStart}
        onForkQuickStart={onForkQuickStart}
        memoryReferenceMode={memoryReferenceMode}
        onSetMemoryReferenceMode={onSetMemoryReferenceMode}
        onSubmit={onSubmit}
        onStop={onStop}
        onModeSelect={onModeSelect}
        onModelSelect={onModelSelect}
        onProviderSelect={onProviderSelect}
        onReasoningChange={onReasoningChange}
        onEnhancePrompt={onEnhancePrompt}
        alwaysThinkingEnabled={alwaysThinkingEnabled}
        onToggleThinking={onToggleThinking}
        streamingEnabled={streamingEnabled}
        onStreamingEnabledChange={onStreamingEnabledChange}
        sendShortcut={sendShortcut}
        selectedAgent={selectedAgent}
        onAgentSelect={(agent) => onAgentSelect?.(agent)}
        onOpenAgentSettings={onOpenAgentSettings}
        onAddModel={onAddModel}
        onRefreshModelConfig={onRefreshModelConfig}
        isModelConfigRefreshing={isModelConfigRefreshing}
        sendReadiness={sendReadiness}
        onJumpToRequest={onJumpToRequest}
        onToggleContextSources={onToggleContextSources}
        contextSourcesExpanded={contextSourcesExpanded}
        modelGroups={modelGroups}
        onProviderModelSelect={onProviderModelSelect}
        onClearAgent={onClearAgent}
        shortcutActions={shortcutActions}
        mainSurface={mainSurface}
        toolSurface={toolSurface}
        panelToggleSurface={panelToggleSurface}
      />

      {/* @ file reference dropdown menu */}
      <CompletionDropdown
        isVisible={fileCompletion.isOpen}
        position={fileCompletion.position}
        width={450}
        className="completion-dropdown--command"
        containerRef={containerRef}
        items={fileCompletion.items}
        selectedIndex={fileCompletion.activeIndex}
        loading={fileCompletion.loading}
        emptyText={t('chat.noMatchingFiles')}
        onClose={fileCompletion.close}
        onSelect={(_, index) => fileCompletion.selectIndex(index)}
        onMouseEnter={fileCompletion.handleMouseEnter}
      />

      {/* @# note card picker */}
      <Dropdown
        isVisible={noteCardCompletion.isOpen}
        position={noteCardCompletion.position}
        width={760}
        className="completion-dropdown--memory"
        onClose={noteCardCompletion.close}
      >
        {noteCardCompletion.loading ? (
          <div className="dropdown-loading">{t('chat.loadingDropdown')}</div>
        ) : noteCardEntries.length === 0 ? (
          <div className="dropdown-empty">{t('noteCards.emptySearch')}</div>
        ) : (
          <div className="composer-memory-picker" role="listbox">
            <div className="composer-memory-picker-list">
              <div className="composer-memory-picker-head">
                <span className="composer-memory-picker-title">{noteCardPickerHeading}</span>
                <span className="composer-memory-picker-count">
                  {t('composer.noteCardPickerSelectedCount', {
                    count: selectedNoteCardIds.length,
                  })}
                </span>
              </div>
              {noteCardEntries.map(({ item, index, noteCard }) => {
                const noteCardId = noteCard?.id ?? item.id;
                const selected = selectedNoteCardIdSet.has(noteCardId);
                const isActive = index === noteCardCompletion.activeIndex;
                const coverAttachment = noteCard?.previewAttachments[0] ?? null;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`composer-memory-picker-card${isActive ? ' is-active' : ''}${
                      selected ? ' is-selected' : ''
                    }`}
                    role="option"
                    aria-selected={isActive}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => noteCardCompletion.selectIndex(index)}
                    onMouseEnter={() => noteCardCompletion.handleMouseEnter(index)}
                  >
                    <span className="composer-memory-picker-card-check" aria-hidden>
                      {selected ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                    </span>
                    {coverAttachment ? (
                      <span className="composer-note-card-picker-thumb" aria-hidden>
                        <LocalImage
                          src={resolveLocalPreviewSrc(coverAttachment.absolutePath)}
                          localPath={coverAttachment.absolutePath}
                          workspaceId={workspaceId}
                          alt={coverAttachment.fileName}
                          loading="lazy"
                        />
                      </span>
                    ) : null}
                    <span className="composer-memory-picker-card-main">
                      <span className="composer-memory-picker-card-title">
                        {noteCard?.title || item.label}
                      </span>
                      <span className="composer-memory-picker-card-meta">
                        {noteCard?.archived ? (
                          <span className="composer-memory-picker-card-meta-item">
                            {t('composer.noteCardArchivedBadge')}
                          </span>
                        ) : null}
                        <span className="composer-memory-picker-card-meta-item">
                          <Clock3 size={12} />
                          {formatMemoryDate(noteCard?.updatedAt)}
                        </span>
                        {typeof noteCard?.imageCount === 'number' && noteCard.imageCount > 0 ? (
                          <span className="composer-memory-picker-card-meta-item">
                            {t('noteCards.imageCount', { count: noteCard.imageCount })}
                          </span>
                        ) : null}
                      </span>
                      {(noteCard?.plainTextExcerpt || item.description) && (
                        <span className="composer-memory-chip-summary">
                          {noteCard?.plainTextExcerpt || item.description}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
            <aside className="composer-memory-picker-preview">
              {activeNoteCard ? (
                <>
                  <div className="composer-memory-picker-preview-head">
                    <span className="composer-memory-picker-preview-title">
                      {activeNoteCard.title}
                    </span>
                    <span className="composer-memory-picker-preview-shortcut">
                      {selectedNoteCardIdSet.has(activeNoteCard.id)
                        ? t('composer.noteCardPickerShortcutUnselect')
                        : t('composer.noteCardPickerShortcutSelect')}
                    </span>
                  </div>
                  <div
                    className={`composer-memory-picker-preview-body${
                      activeNoteCardPreviewExpanded ? ' is-expanded' : ''
                    }`}
                  >
                    {activeNoteCardPreview ? (
                      <div className="composer-memory-picker-preview-text">
                        <Markdown
                          className="markdown composer-memory-picker-preview-markdown"
                          value={activeNoteCardPreview}
                        />
                      </div>
                    ) : activeNoteCardVisiblePreviewAttachments.length === 0 ? (
                      <div className="composer-memory-picker-preview-text">
                        <Markdown
                          className="markdown composer-memory-picker-preview-markdown"
                          value={t('composer.noteCardPickerPreviewEmpty')}
                        />
                      </div>
                    ) : null}
                    {activeNoteCardVisiblePreviewAttachments.length > 0 ? (
                      <div className="composer-note-card-preview-images" role="list">
                        {activeNoteCardVisiblePreviewAttachments.map((attachment) => (
                          <span
                            key={attachment.id}
                            className="composer-note-card-preview-image"
                            role="listitem"
                            title={attachment.fileName}
                          >
                            <LocalImage
                              src={resolveLocalPreviewSrc(attachment.absolutePath)}
                              localPath={attachment.absolutePath}
                              workspaceId={workspaceId}
                              alt={attachment.fileName}
                              loading="lazy"
                            />
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  {activeNoteCardPreviewLong && (
                    <button
                      type="button"
                      className="composer-memory-picker-preview-toggle"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() =>
                        setExpandedPreviewNoteCardId((prev) =>
                          prev === activeNoteCard.id ? null : activeNoteCard.id,
                        )
                      }
                    >
                      {activeNoteCardPreviewExpanded
                        ? t('composer.noteCardPreviewCollapse')
                        : t('composer.noteCardPreviewExpand')}
                    </button>
                  )}
                  <div className="composer-memory-picker-preview-meta">
                    <span className="composer-memory-picker-preview-meta-item">
                      <Clock3 size={12} />
                      {formatMemoryDate(activeNoteCard.updatedAt)}
                    </span>
                    {activeNoteCard.archived ? (
                      <span className="composer-memory-picker-preview-meta-item">
                        <Layers3 size={12} />
                        {t('composer.noteCardArchivedBadge')}
                      </span>
                    ) : null}
                    {activeNoteCard.imageCount > 0 && (
                      <span className="composer-memory-picker-preview-meta-item">
                        <Tag size={12} />
                        {t('noteCards.imageCount', { count: activeNoteCard.imageCount })}
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <span className="composer-memory-picker-preview-empty">
                  {t('composer.noteCardPickerPreviewFallback')}
                </span>
              )}
            </aside>
          </div>
        )}
      </Dropdown>

      {/* @@ manual memory picker */}
      <CompletionDropdown
        isVisible={memoryCompletion.isOpen}
        position={memoryCompletion.position}
        width={450}
        className="completion-dropdown--command"
        containerRef={containerRef}
        items={memoryCompletion.items}
        selectedIndex={memoryCompletion.activeIndex}
        loading={memoryCompletion.loading}
        emptyText={t('memory.empty')}
        onClose={memoryCompletion.close}
        onSelect={(_, index) => memoryCompletion.selectIndex(index)}
        onMouseEnter={memoryCompletion.handleMouseEnter}
      />

      {/* / slash command dropdown menu */}
      <CompletionDropdown
        isVisible={commandCompletion.isOpen}
        position={commandCompletion.position}
        width={450}
        className="completion-dropdown--command"
        containerRef={containerRef}
        items={commandCompletion.items}
        selectedIndex={commandCompletion.activeIndex}
        loading={commandCompletion.loading}
        emptyText={t('chat.noMatchingCommands')}
        onClose={commandCompletion.close}
        onSelect={(_, index) => commandCompletion.selectIndex(index)}
        onMouseEnter={commandCompletion.handleMouseEnter}
      />

      {/* $ skill dropdown menu */}
      <CompletionDropdown
        isVisible={skillCompletion.isOpen}
        position={skillCompletion.position}
        width={450}
        className="completion-dropdown--command"
        containerRef={containerRef}
        items={skillCompletion.items}
        selectedIndex={skillCompletion.activeIndex}
        loading={skillCompletion.loading}
        emptyText={t('chat.noMatchingCommands')}
        onClose={skillCompletion.close}
        onSelect={(_, index) => skillCompletion.selectIndex(index)}
        onMouseEnter={skillCompletion.handleMouseEnter}
      />

      {/* # agent selection dropdown menu */}
      <CompletionDropdown
        isVisible={agentCompletion.isOpen}
        position={agentCompletion.position}
        width={450}
        className="completion-dropdown--command"
        containerRef={containerRef}
        items={agentCompletion.items}
        selectedIndex={agentCompletion.activeIndex}
        loading={agentCompletion.loading}
        emptyText={t('chat.noAvailableAgents')}
        onClose={agentCompletion.close}
        onSelect={(_, index) => agentCompletion.selectIndex(index)}
        onMouseEnter={agentCompletion.handleMouseEnter}
      />

      {/* ! prompt selection dropdown menu */}
      <CompletionDropdown
        isVisible={promptCompletion.isOpen}
        position={promptCompletion.position}
        width={promptDropdownWidth}
        className="completion-dropdown--prompt"
        items={promptCompletion.items}
        selectedIndex={promptCompletion.activeIndex}
        loading={promptCompletion.loading}
        emptyText={t('settings.prompt.noPromptsDropdown')}
        onClose={promptCompletion.close}
        onSelect={(_, index) => promptCompletion.selectIndex(index)}
        onMouseEnter={promptCompletion.handleMouseEnter}
      />

      {/* Floating Tooltip (uses Portal or Fixed positioning to break overflow limit) */}
      {tooltip && tooltip.visible && (
        <div
          className={`tooltip-popup ${tooltip.isBar ? 'tooltip-bar' : ''}`}
          style={{
            top: `${tooltip.top}px`,
            left: `${tooltip.left}px`,
            width: tooltip.width ? `${tooltip.width}px` : undefined,
            // @ts-expect-error CSS custom properties
            '--tooltip-tx': tooltip.tx || '-50%',
            '--arrow-left': tooltip.arrowLeft || '50%',
          }}
        >
          {tooltip.text}
        </div>
      )}

      {/* Prompt enhancer dialog */}
      <PromptEnhancerDialog
        isOpen={promptEnhancer.isOpen}
        isLoading={promptEnhancer.isLoading}
        loadingEngine={promptEnhancer.loadingEngine}
        originalPrompt={promptEnhancer.originalPrompt}
        enhancedPrompt={promptEnhancer.enhancedPrompt}
        canUseEnhanced={promptEnhancer.canUseEnhanced}
        onUseEnhanced={promptEnhancer.onUseEnhanced}
        onKeepOriginal={promptEnhancer.onKeepOriginal}
        onClose={promptEnhancer.onClose}
      />
    </div>
  );
}
