import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import Check from "lucide-react/dist/esm/icons/check";
import type { ModelInfo, ProviderId } from '../types';
import type { ProviderModelGroup } from '../modelOptions';
import { EngineIcon } from '../../../../engine/components/EngineIcon';
import { DropdownContent } from '@/components/ui/dropdown-content';
import { announceHoverMenuOpen, createHoverMenuCloseController, subscribeToHoverMenuOpen } from './hoverMenuCoordination';

interface ModelSelectProps {
  value: string;
  onChange: (modelId: string) => void;
  models?: ModelInfo[];  // Optional dynamic model list
  currentProvider?: string;  // Current provider type
  providerLabel?: string;
  triggerVariant?: 'default' | 'readiness';
  modelGroups?: ProviderModelGroup[];
  onProviderModelChange?: (providerId: ProviderId, modelId: string) => void;
  onAddModel?: () => void;  // Navigate to model management
  onRefreshConfig?: () => Promise<void> | void; // Refresh current provider config
  isRefreshingConfig?: boolean;
}

const MODEL_LABEL_KEYS: Record<string, string> = {
  'gpt-5.5': 'models.codex.gpt55.label',
  'gpt-5.4': 'models.codex.gpt54.label',
  'gpt-5.4-mini': 'models.codex.gpt54mini.label',
  'gpt-5.3-codex': 'models.codex.gpt53codex.label',
  'gpt-5.3-codex-spark': 'models.codex.gpt53codexSpark.label',
  'gpt-5.2': 'models.codex.gpt52.label',
};

const MODEL_DESCRIPTION_KEYS: Record<string, string> = {
  'gpt-5.5': 'models.codex.gpt55.description',
  'gpt-5.4': 'models.codex.gpt54.description',
  'gpt-5.4-mini': 'models.codex.gpt54mini.description',
  'gpt-5.3-codex': 'models.codex.gpt53codex.description',
  'gpt-5.3-codex-spark': 'models.codex.gpt53codexSpark.description',
  'gpt-5.2': 'models.codex.gpt52.description',
};

const READINESS_DROPDOWN_ICON_INSET = 11;

/**
 * Model icon component - displays different icons based on provider type
 */
const ModelIcon = ({ provider, size = 16 }: { provider?: string; size?: number }) => {
  const imgStyle = { width: size, height: size, flexShrink: 0 } as const;
  switch (provider) {
    case 'codex':
      return <EngineIcon engine="codex" size={size} style={imgStyle} />;
    case 'gemini':
      return <EngineIcon engine="gemini" size={size} style={imgStyle} />;
    case 'opencode':
      return <EngineIcon engine="opencode" size={size} style={imgStyle} />;
    case 'claude':
    default:
      return <EngineIcon engine="claude" size={size} style={imgStyle} />;
  }
};

/**
 * ModelSelect - Model selector component
 * Supports switching between Sonnet 4.5, Opus 4.5, and other models, including Codex models
 */
export const ModelSelect = ({
  value,
  onChange,
  models = [],
  currentProvider = 'claude',
  providerLabel,
  triggerVariant = 'default',
  modelGroups,
  onProviderModelChange,
  onAddModel,
  onRefreshConfig,
  isRefreshingConfig = false,
}: ModelSelectProps) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [refreshConfigError, setRefreshConfigError] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const isReadiness = triggerVariant === 'readiness';
  const hoverMenuId = isReadiness ? 'model-select-readiness' : 'model-select-default';
  const hoverSurfaceId = `model-select-surface-${triggerVariant}`;
  const hoverCloseControllerRef = useRef(createHoverMenuCloseController(() => setIsOpen(false)));

  const effectiveModels = useMemo(() => {
    if (models.length > 0) {
      return models;
    }
    if (currentProvider !== 'claude' && value && value.trim().length > 0) {
      return [{ id: value, label: value }];
    }
    return [] as ModelInfo[];
  }, [currentProvider, models, value]);

  const selectedModelValue = value.trim();
  const currentModel =
    selectedModelValue.length > 0
      ? effectiveModels.find(m => m.id === selectedModelValue) ?? null
      : null;

  const getModelLabel = (model: ModelInfo): string => {
    // The parent owns refreshed provider/model mapping. Keep this selector
    // presentational so manual config refreshes can update labels immediately.
    const labelKey = MODEL_LABEL_KEYS[model.id];

    if (labelKey) {
      return t(labelKey);
    }

    return model.label;
  };

  const getModelDescription = (model: ModelInfo): string | undefined => {
    const descriptionKey = MODEL_DESCRIPTION_KEYS[model.id];
    if (descriptionKey) {
      return t(descriptionKey);
    }
    return model.description;
  };
  const currentModelLabel = currentModel ? getModelLabel(currentModel) : t('models.selectModel');
  const resolvedProviderLabel = providerLabel ?? t(`providers.${currentProvider}.label`);
  const groupedModelCount = modelGroups?.length ?? 0;
  const hasGroupedModels = groupedModelCount > 0;
  const hasMultipleGroupedModels = groupedModelCount > 1;

  const renderGroupedModels = (compact: boolean) => {
    if (!modelGroups || modelGroups.length === 0) {
      return null;
    }

    if (modelGroups.length === 1) {
      const group = modelGroups[0];
      if (!group) {
        return null;
      }

      return (
        <>
          <div className="selector-dropdown-title">{group.providerLabel}</div>
          {group.models.map((model) => {
            const isSelected = group.providerId === currentProvider && model.id === value;
            return (
              <div
                key={`${group.providerId}:${model.id}`}
                className={`selector-option ${compact ? 'selector-option--model-compact' : ''} ${isSelected ? 'selected' : ''}`}
                onClick={() => handleGroupedSelect(group.providerId, model.id)}
              >
                <ModelIcon provider={group.providerId} size={compact ? 18 : 20} />
                <span className="selector-model-label">{getModelLabel(model)}</span>
                <div className="selector-model-check-slot">
                  {isSelected && (
                    <Check size={18} className="check-mark" aria-hidden />
                  )}
                </div>
              </div>
            );
          })}
        </>
      );
    }

    return (
      <div className="selector-model-groups">
        {modelGroups.map((group, groupIndex) => (
          <div key={group.providerId} className="selector-model-group">
            {groupIndex > 0 && <div className="selector-model-group-divider" />}
            <div className="selector-model-group-title">
              <span>{group.providerLabel}</span>
            </div>
            {group.models.map((model) => {
              const isSelected = group.providerId === currentProvider && model.id === value;
              return (
                <div
                  key={`${group.providerId}:${model.id}`}
                  className={`selector-option selector-option--model-compact ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleGroupedSelect(group.providerId, model.id)}
                >
                  <ModelIcon provider={group.providerId} size={18} />
                  <span className="selector-model-label">{getModelLabel(model)}</span>
                  <div className="selector-model-check-slot">
                    {isSelected && (
                      <Check size={18} className="check-mark" aria-hidden />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  /**
   * Toggle dropdown
   */
  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  }, [isOpen]);

  const handleHoverOpen = useCallback(() => {
    hoverCloseControllerRef.current.cancel();
    announceHoverMenuOpen(hoverMenuId);
    setIsOpen(true);
  }, [hoverMenuId]);

  const isWithinHoverSurface = useCallback((target: EventTarget | null) => {
    if (!(target instanceof Element)) {
      return false;
    }
    if (buttonRef.current?.contains(target)) {
      return true;
    }
    return target.closest(`[data-dropdown-surface="${hoverSurfaceId}"]`) !== null;
  }, [hoverSurfaceId]);

  const handleTriggerPointerLeave = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (isWithinHoverSurface(event.relatedTarget)) {
      return;
    }
    hoverCloseControllerRef.current.schedule();
  }, [isWithinHoverSurface]);

  const handleDropdownPointerLeave = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (isWithinHoverSurface(event.relatedTarget)) {
      return;
    }
    hoverCloseControllerRef.current.schedule();
  }, [isWithinHoverSurface]);

  /**
   * Select model
   */
  const handleSelect = useCallback((modelId: string) => {
    onChange(modelId);
    setIsOpen(false);
  }, [onChange]);

  const handleGroupedSelect = useCallback((providerId: ProviderId, modelId: string) => {
    if (onProviderModelChange) {
      onProviderModelChange(providerId, modelId);
    } else {
      onChange(modelId);
    }
    setIsOpen(false);
  }, [onChange, onProviderModelChange]);

  const handleAddModelClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onAddModel?.();
    setIsOpen(false);
  }, [onAddModel]);

  const handleRefreshConfigClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!onRefreshConfig || isRefreshingConfig) {
      return;
    }
    setRefreshConfigError(null);
    void Promise.resolve(onRefreshConfig()).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      setRefreshConfigError(message);
    });
  }, [isRefreshingConfig, onRefreshConfig]);

  useEffect(() => {
    if (!isReadiness) {
      return;
    }

    return subscribeToHoverMenuOpen(hoverMenuId, () => {
      hoverCloseControllerRef.current.cancel();
      setIsOpen(false);
    });
  }, [hoverMenuId, isReadiness]);

  useEffect(() => {
    const hoverCloseController = hoverCloseControllerRef.current;
    return () => {
      hoverCloseController.cleanup();
    };
  }, []);

  return (
    <div
      className={triggerVariant === 'readiness' ? 'composer-readiness-model-select' : undefined}
      style={{ position: 'relative', display: 'inline-block' }}
    >
      <button
        ref={buttonRef}
        className={triggerVariant === 'readiness' ? 'composer-readiness-target composer-readiness-target-button' : 'selector-button'}
        onClick={handleToggle}
        onPointerEnter={isReadiness ? handleHoverOpen : undefined}
        onPointerLeave={isReadiness ? handleTriggerPointerLeave : undefined}
        title={t('chat.currentModel', { model: currentModelLabel })}
        aria-label={t('chat.currentModel', { model: currentModelLabel })}
      >
        {triggerVariant === 'readiness' ? (
          <>
            <span className="composer-readiness-icon" aria-hidden="true">
              <ModelIcon provider={currentProvider} size={17} />
            </span>
            <span className="composer-readiness-provider">
              {resolvedProviderLabel}
            </span>
            <span className="composer-readiness-divider" aria-hidden="true">
              /
            </span>
            <span className="composer-readiness-model">
              {currentModelLabel}
            </span>
          </>
        ) : (
          <>
            <ModelIcon provider={currentProvider} size={12} />
            <span className="selector-button-text">{currentModelLabel}</span>
            <span className={`codicon codicon-chevron-${isOpen ? 'up' : 'down'}`} style={{ fontSize: '10px', marginLeft: '2px' }} />
          </>
        )}
      </button>

      {isOpen && (
        isReadiness ? (
          <DropdownContent
            anchorEl={buttonRef.current}
            open={isOpen}
            onClose={() => setIsOpen(false)}
            side="top"
            sideOffset={8}
            align="start"
            alignOffset={-READINESS_DROPDOWN_ICON_INSET}
            minWidth={218}
            maxHeight="240px"
            surfaceId={hoverSurfaceId}
            onPointerEnter={isReadiness ? () => hoverCloseControllerRef.current.cancel() : undefined}
            onPointerLeave={isReadiness ? handleDropdownPointerLeave : undefined}
            className={`selector-menu-surface selector-dropdown--model selector-dropdown--readiness-inline selector-dropdown--model-readiness-compact${hasMultipleGroupedModels ? '' : ' selector-dropdown--model-single-group'}`}
          >
            {hasGroupedModels ? (
              renderGroupedModels(true)
            ) : (
              <>
                <div className="selector-dropdown-title">{t('models.selectModel')}</div>
                {effectiveModels.map((model) => (
                  <div
                    key={model.id}
                    className={`selector-option ${model.id === value ? 'selected' : ''}`}
                    onClick={() => handleSelect(model.id)}
                  >
                    <ModelIcon provider={currentProvider} size={20} />
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                      <span>{getModelLabel(model)}</span>
                      {getModelDescription(model) && (
                        <span className="model-description">{getModelDescription(model)}</span>
                      )}
                    </div>
                    <div style={{ width: 20, height: 20, flexShrink: 0, marginLeft: 'auto' }}>
                      {model.id === value && (
                        <Check size={18} className="check-mark" aria-hidden />
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
            {(onAddModel || onRefreshConfig) && (
              <>
                <div className="selector-divider" />
                <div className="selector-action-footer">
                  {onAddModel && (
                    <button
                      type="button"
                      className="selector-footer-action selector-footer-action-add"
                      onClick={handleAddModelClick}
                    >
                      {t('models.addModel')}
                    </button>
                  )}
                  {onRefreshConfig && (
                    <button
                      type="button"
                      className="selector-footer-action selector-footer-action-refresh"
                      onClick={handleRefreshConfigClick}
                      disabled={isRefreshingConfig}
                      aria-busy={isRefreshingConfig}
                      title={t(isRefreshingConfig ? 'models.refreshingConfig' : 'models.refreshConfig')}
                    >
                      <span
                        className={`codicon codicon-refresh${isRefreshingConfig ? ' selector-refresh-icon-spinning' : ''}`}
                        aria-hidden
                      />
                      <span>{t(isRefreshingConfig ? 'models.refreshingConfig' : 'models.refreshConfig')}</span>
                    </button>
                  )}
                </div>
                {refreshConfigError && (
                  <div className="selector-refresh-error" role="status">
                    {t('models.refreshConfigFailed', { message: refreshConfigError })}
                  </div>
                )}
              </>
            )}
          </DropdownContent>
        ) : (
          <DropdownContent
            anchorEl={buttonRef.current}
            open={isOpen}
            onClose={() => setIsOpen(false)}
            side="top"
            sideOffset={4}
            align="start"
            minWidth={252}
            maxHeight="min(48vh, 380px)"
            surfaceId={hoverSurfaceId}
            className={`selector-menu-surface selector-dropdown--model${hasMultipleGroupedModels ? '' : ' selector-dropdown--model-single-group'}`}
          >
            {hasGroupedModels ? (
              renderGroupedModels(false)
            ) : (
              <>
                <div className="selector-dropdown-title">{t('models.selectModel')}</div>
                {effectiveModels.map((model) => (
                  <div
                    key={model.id}
                    className={`selector-option ${model.id === value ? 'selected' : ''}`}
                    onClick={() => handleSelect(model.id)}
                  >
                    <ModelIcon provider={currentProvider} size={20} />
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                      <span>{getModelLabel(model)}</span>
                      {getModelDescription(model) && (
                        <span className="model-description">{getModelDescription(model)}</span>
                      )}
                    </div>
                    <div style={{ width: 20, height: 20, flexShrink: 0, marginLeft: 'auto' }}>
                      {model.id === value && (
                        <Check size={18} className="check-mark" aria-hidden />
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
            {(onAddModel || onRefreshConfig) && (
              <>
                <div className="selector-divider" />
                <div className="selector-action-footer">
                  {onAddModel && (
                    <button
                      type="button"
                      className="selector-footer-action selector-footer-action-add"
                      onClick={handleAddModelClick}
                    >
                      {t('models.addModel')}
                    </button>
                  )}
                  {onRefreshConfig && (
                    <button
                      type="button"
                      className="selector-footer-action selector-footer-action-refresh"
                      onClick={handleRefreshConfigClick}
                      disabled={isRefreshingConfig}
                      aria-busy={isRefreshingConfig}
                      title={t(isRefreshingConfig ? 'models.refreshingConfig' : 'models.refreshConfig')}
                    >
                      <span
                        className={`codicon codicon-refresh${isRefreshingConfig ? ' selector-refresh-icon-spinning' : ''}`}
                        aria-hidden
                      />
                      <span>{t(isRefreshingConfig ? 'models.refreshingConfig' : 'models.refreshConfig')}</span>
                    </button>
                  )}
                </div>
                {refreshConfigError && (
                  <div className="selector-refresh-error" role="status">
                    {t('models.refreshConfigFailed', { message: refreshConfigError })}
                  </div>
                )}
              </>
            )}
          </DropdownContent>
        )
      )}
    </div>
  );
};

export default ModelSelect;
