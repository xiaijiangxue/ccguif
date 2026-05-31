import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Check from "lucide-react/dist/esm/icons/check";
import { DropdownContent } from '@/components/ui/dropdown-content';
import { REASONING_LEVELS, type ReasoningEffort } from '../types';

interface ReasoningSelectProps {
  value: ReasoningEffort | null;
  onChange: (effort: ReasoningEffort | null) => void;
  options?: ReasoningEffort[];
  showDefaultOption?: boolean;
  defaultLabel?: string;
  disabled?: boolean;
}

/**
 * ReasoningSelect - runtime reasoning effort selector.
 * Controls the depth of reasoning for engines that expose an effort option.
 */
export const ReasoningSelect = ({
  value,
  onChange,
  options,
  showDefaultOption = false,
  defaultLabel,
  disabled,
}: ReasoningSelectProps) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const visibleLevels = REASONING_LEVELS.filter((level) => {
    if (options === undefined) {
      return true;
    }
    return options.includes(level.id);
  });
  const fallbackLevel = visibleLevels[0] ?? REASONING_LEVELS[0] ?? {
    id: 'medium' as ReasoningEffort,
    label: 'Medium',
    icon: 'codicon-circle-filled',
    description: 'Balanced thinking',
  };

  const currentLevel = value
    ? REASONING_LEVELS.find(l => l.id === value) ?? fallbackLevel
    : null;
  const resolvedDefaultLabel =
    defaultLabel ?? t('reasoning.default', { defaultValue: 'Default' });

  /**
   * Get translated text for reasoning level
   */
  const getReasoningText = (levelId: ReasoningEffort, field: 'label' | 'description') => {
    const key = `reasoning.${levelId}.${field}`;
    const fallback = REASONING_LEVELS.find(l => l.id === levelId)?.[field] || levelId;
    return t(key, { defaultValue: fallback });
  };
  const triggerLabel = currentLevel ? getReasoningText(currentLevel.id, 'label') : resolvedDefaultLabel;
  const triggerIcon = currentLevel?.icon ?? 'codicon-lightbulb';

  /**
   * Toggle dropdown
   */
  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    setIsOpen(!isOpen);
  }, [isOpen, disabled]);

  /**
   * Select reasoning level
   */
  const handleSelect = useCallback((effort: ReasoningEffort | null) => {
    onChange(effort);
    setIsOpen(false);
  }, [onChange]);


  return (
    <div className="selector-reasoning-wrap" style={{ position: 'relative', display: 'inline-block' }}>
      <button
        ref={buttonRef}
        className={`selector-button selector-reasoning-button${currentLevel ? ' is-icon-only' : ''}`}
        onClick={handleToggle}
        disabled={disabled}
        aria-label={triggerLabel}
        title={t('reasoning.title', { defaultValue: 'Select reasoning depth' })}
      >
        <span className={`codicon ${triggerIcon}`} />
        {!currentLevel && (
          <span className="selector-button-text">
            {resolvedDefaultLabel}
          </span>
        )}
      </button>

      {isOpen && (
        <DropdownContent
            anchorEl={buttonRef.current}
            open={isOpen}
            onClose={() => setIsOpen(false)}
            side="top"
            sideOffset={4}
            align="start"
            minWidth={200}
          >
          {showDefaultOption && (
            <div
              className={`selector-option ${value === null ? 'selected' : ''}`}
              onClick={() => handleSelect(null)}
              title={t('reasoning.defaultDescription', {
                defaultValue: 'Use the engine default reasoning behavior',
              })}
            >
              <span className="codicon codicon-circle-outline" />
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <span>{resolvedDefaultLabel}</span>
                <span className="mode-description">
                  {t('reasoning.defaultDescription', {
                    defaultValue: 'Use the engine default reasoning behavior',
                  })}
                </span>
              </div>
              {value === null && (
                <Check size={16} className="check-mark" />
              )}
            </div>
          )}
          {visibleLevels.map((level) => (
            <div
              key={level.id}
              className={`selector-option selector-option--reasoning ${level.id === value ? 'selected' : ''}`}
              onClick={() => handleSelect(level.id)}
              title={getReasoningText(level.id, 'description')}
            >
              <span className={`codicon ${level.icon}`} />
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <span>{getReasoningText(level.id, 'label')}</span>
                <span className="mode-description">{getReasoningText(level.id, 'description')}</span>
              </div>
              {level.id === value && (
                <Check size={16} className="check-mark" />
              )}
            </div>
          ))}
          </DropdownContent>
        )}
    </div>
  );
};

export default ReasoningSelect;
