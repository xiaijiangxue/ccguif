import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Menu } from '@ark-ui/react/menu';
import { Portal } from '@ark-ui/react/portal';
import type { ShortcutAction } from '../types';
import { cn } from '@/lib/utils';

interface ShortcutActionsSelectProps {
  actions?: ShortcutAction[];
}

export const ShortcutActionsSelect = ({ actions }: ShortcutActionsSelectProps) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const hasActions = Boolean(actions && actions.length > 0);

  const closeMenuAndFocusTrigger = useCallback(() => {
    setIsOpen(false);
    buttonRef.current?.focus();
  }, []);

  if (!hasActions) {
    return null;
  }

  const menuContentClassName = cn(
    "z-[10001] min-w-[220px] overflow-hidden rounded-[14px] border border-[color:color-mix(in_srgb,var(--border)_74%,#dce5f2_26%)] bg-[color:color-mix(in_srgb,white_96%,var(--accent)_4%)] p-1.5 text-popover-foreground shadow-[0_14px_34px_rgba(15,23,42,0.12),0_2px_8px_rgba(15,23,42,0.06)] backdrop-blur-[10px]",
    "data-[state=open]:animate-in data-[state=closed]:animate-out",
    "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
    "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
    "data-[placement^=bottom]:slide-in-from-top-2 data-[placement^=top]:slide-in-from-bottom-2",
  );

  const menuItemClassName = cn(
    "selector-option selector-option-shortcut selector-option-button selector-option-shortcut-button m-0 rounded-md outline-none",
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
        className="selector-button selector-shortcut-button"
        title={t('chat.shortcutActionsEntry')}
        aria-label={t('chat.shortcutActionsEntry')}
      >
        <span className="codicon codicon-zap" />
      </Menu.Trigger>

      <Portal>
        <Menu.Positioner className="z-[10001] outline-none">
          <Menu.Content className={menuContentClassName}>
            {actions?.map((action) => (
              <Menu.Item
              key={action.key}
              className={menuItemClassName}
              value={`shortcut:${action.key}`}
              onSelect={() => {
                action.onClick();
                closeMenuAndFocusTrigger();
              }}
              >
                <span className="selector-shortcut-label">{action.label}</span>
                <span className="selector-shortcut-trigger">{action.trigger}</span>
              </Menu.Item>
            ))}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};

export default ShortcutActionsSelect;
