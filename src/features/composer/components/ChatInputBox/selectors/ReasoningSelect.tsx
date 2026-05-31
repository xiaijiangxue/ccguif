import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Menu } from '@ark-ui/react/menu';
import { Portal } from '@ark-ui/react/portal';
import Check from "lucide-react/dist/esm/icons/check";
import { REASONING_LEVELS, type ReasoningEffort } from '../types';
import { cn } from '@/lib/utils';

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
   * Select reasoning level
   */
  const handleSelect = useCallback((effort: ReasoningEffort | null) => {
    onChange(effort);
    setIsOpen(false);
  }, [onChange]);

  const menuContentClassName = cn(
    "z-[10001] min-w-[200px] overflow-hidden rounded-[14px] border border-[color:color-mix(in_srgb,var(--border)_74%,#dce5f2_26%)] bg-[color:color-mix(in_srgb,white_96%,var(--accent)_4%)] p-1.5 text-popover-foreground shadow-[0_14px_34px_rgba(15,23,42,0.12),0_2px_8px_rgba(15,23,42,0.06)] backdrop-blur-[10px]",
    "data-[state=open]:animate-in data-[state=closed]:animate-out",
    "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
    "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
    "data-[placement^=bottom]:slide-in-from-top-2 data-[placement^=top]:slide-in-from-bottom-2",
  );

  const menuItemClassName = cn(
    "selector-option m-0 rounded-md outline-none",
    "data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground",
  );

  return (
    <Menu.Root
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
        className={`selector-button selector-reasoning-button${currentLevel ? ' is-icon-only' : ''}`}
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
      </Menu.Trigger>

      <Portal>
        <Menu.Positioner className="z-[10001] outline-none">
          <Menu.Content className={menuContentClassName}>
            {showDefaultOption && (
              <Menu.Item
                className={menuItemClassName}
                title={t('reasoning.defaultDescription', {
                  defaultValue: 'Use the engine default reasoning behavior',
                })}
                value="reasoning:default"
                onSelect={() => handleSelect(null)}
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
              </Menu.Item>
            )}
            {visibleLevels.map((level) => (
              <Menu.Item
                key={level.id}
                className={cn(menuItemClassName, "selector-option--reasoning")}
                title={getReasoningText(level.id, 'description')}
                value={`reasoning:${level.id}`}
                onSelect={() => handleSelect(level.id)}
              >
                <span className={`codicon ${level.icon}`} />
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <span>{getReasoningText(level.id, 'label')}</span>
                  <span className="mode-description">{getReasoningText(level.id, 'description')}</span>
                </div>
                {level.id === value && (
                  <Check size={16} className="check-mark" />
                )}
              </Menu.Item>
            ))}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};

export default ReasoningSelect;
