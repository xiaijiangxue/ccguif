import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Menu } from '@ark-ui/react/menu';
import { Portal } from '@ark-ui/react/portal';
import type { ShortcutAction } from '../types';
import { cn } from '@/lib/utils';
import { announceHoverMenuOpen, createHoverMenuCloseController, subscribeToHoverMenuOpen } from './hoverMenuCoordination';

interface ShortcutActionsSelectProps {
  actions?: ShortcutAction[];
}

export const ShortcutActionsSelect = ({ actions }: ShortcutActionsSelectProps) => {
  const hoverMenuId = 'shortcut-actions-select';
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const hasActions = Boolean(actions && actions.length > 0);
  const hoverCloseControllerRef = useRef(createHoverMenuCloseController(() => setIsOpen(false)));

  const closeMenuAndFocusTrigger = useCallback(() => {
    setIsOpen(false);
    buttonRef.current?.focus();
  }, []);

  const handlePointerLeave = useCallback((event: ReactPointerEvent) => {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Element && nextTarget.closest('[data-scope="menu"]')) {
      return;
    }

    hoverCloseControllerRef.current.schedule();
  }, []);

  useEffect(() => {
    return subscribeToHoverMenuOpen(hoverMenuId, () => setIsOpen(false));
  }, []);

  useEffect(() => {
    const hoverCloseController = hoverCloseControllerRef.current;
    return () => {
      hoverCloseController.cleanup();
    };
  }, []);

  if (!hasActions) {
    return null;
  }

  const menuContentClassName = cn(
    "selector-menu-surface z-[10001] min-w-[220px] overflow-hidden rounded-[14px] p-1.5 text-popover-foreground",
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
        onPointerEnter={() => {
          hoverCloseControllerRef.current.cancel();
          announceHoverMenuOpen(hoverMenuId);
          setIsOpen(true);
        }}
        onPointerLeave={handlePointerLeave}
      >
        <span className="codicon codicon-zap" />
      </Menu.Trigger>

      <Portal>
        <Menu.Positioner className="z-[10001] outline-none">
          <Menu.Content
            className={menuContentClassName}
            onPointerEnter={() => hoverCloseControllerRef.current.cancel()}
            onPointerLeave={handlePointerLeave}
          >
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
