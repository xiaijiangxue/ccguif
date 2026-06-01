import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Menu } from '@ark-ui/react/menu';
import { Portal } from '@ark-ui/react/portal';
import { AVAILABLE_MODES, type PermissionMode } from '../types';
import Check from "lucide-react/dist/esm/icons/check";
import { cn } from '@/lib/utils';
import {
  MODE_SELECT_FLASH_DURATION_MS,
  MODE_SELECT_FLASH_EVENT,
} from './modeSelectFlash';
import { announceHoverMenuOpen, createHoverMenuCloseController, subscribeToHoverMenuOpen } from './hoverMenuCoordination';
import { SelectorMenuArrow } from './SelectorMenuArrow';

interface ModeSelectProps {
  value: PermissionMode;
  onChange: (mode: PermissionMode) => void;
  provider?: string;
  selectedCollaborationModeId?: string | null;
  onSelectCollaborationMode?: (id: string | null) => void;
}

type ModeSelectFlashStyle = CSSProperties & {
  '--mode-trigger-flash-name'?: string;
  '--mode-chevron-flash-name'?: string;
};

/**
 * ModeSelect - Mode selector component
 * Supports switching between default, agent, plan, and auto modes
 */
export const ModeSelect = ({
  value,
  onChange,
  provider,
  selectedCollaborationModeId,
  onSelectCollaborationMode,
}: ModeSelectProps) => {
  const hoverMenuId = 'mode-select';
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isChevronFlashing, setIsChevronFlashing] = useState(false);
  const [flashCycle, setFlashCycle] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const flashTimerRef = useRef<number | null>(null);
  const hoverCloseControllerRef = useRef(createHoverMenuCloseController(() => setIsOpen(false)));
  const fallbackMode = AVAILABLE_MODES[0] ?? {
    id: 'default' as PermissionMode,
    label: 'Default Mode',
    icon: 'codicon-comment-discussion',
    tooltip: 'Standard permission behavior',
    description: 'Requires manual confirmation for each operation',
  };

  const modeOptions = useMemo(() => {
    if (provider === 'codex') {
      return AVAILABLE_MODES.filter(
        (mode) => mode.id === 'plan' || mode.id === 'bypassPermissions',
      ).map((mode) => ({ ...mode, disabled: false }));
    }
    if (provider === 'gemini') {
      return AVAILABLE_MODES.map((mode) => ({ ...mode, disabled: false }));
    }
    if (provider === 'claude') {
      return AVAILABLE_MODES.map((mode) => {
        if (
          mode.id === 'default' ||
          mode.id === 'plan' ||
          mode.id === 'bypassPermissions'
        ) {
          return { ...mode, disabled: false };
        }
        return { ...mode, disabled: true };
      });
    }
    // Keep non-Claude providers on the existing restricted path.
    return AVAILABLE_MODES.map((mode) => {
      if (mode.id !== 'bypassPermissions') {
        return { ...mode, disabled: true };
      }
      return mode;
    });
  }, [provider]);

  const selectedModeId =
    provider === 'codex'
      ? selectedCollaborationModeId === 'plan'
        ? 'plan'
        : 'bypassPermissions'
      : value;
  const currentMode = modeOptions.find(m => m.id === selectedModeId) ?? modeOptions[0] ?? fallbackMode;

  // Helper function to get translated mode text
  const getModeText = (modeId: PermissionMode, field: 'label' | 'tooltip' | 'description') => {
    if (provider === 'codex') {
      const codexKey = `codexModes.${modeId}.${field}`;
      const fallbackKey = `modes.${modeId}.${field}`;
      return t(codexKey, { defaultValue: t(fallbackKey) });
    }
    if (provider === 'claude') {
      const claudeKey = `claudeModes.${modeId}.${field}`;
      const fallbackKey = `modes.${modeId}.${field}`;
      return t(claudeKey, { defaultValue: t(fallbackKey) });
    }

    return t(`modes.${modeId}.${field}`);
  };

  /**
   * Select mode
   */
  const handleSelect = useCallback((mode: PermissionMode, disabled?: boolean) => {
    if (disabled) return; // Disabled options cannot be selected
    if (provider === 'codex') {
      if (mode === 'plan') {
        onSelectCollaborationMode?.('plan');
      } else if (mode === 'bypassPermissions') {
        onSelectCollaborationMode?.('code');
        onChange(mode);
      }
      setIsOpen(false);
      return;
    }
    onChange(mode);
    setIsOpen(false);
  }, [onChange, onSelectCollaborationMode, provider]);

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

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const clearFlashTimer = () => {
      if (flashTimerRef.current !== null) {
        window.clearTimeout(flashTimerRef.current);
        flashTimerRef.current = null;
      }
    };

    const handleFlashEvent = () => {
      clearFlashTimer();
      setIsChevronFlashing(true);
      setFlashCycle((previous) => previous + 1);
      flashTimerRef.current = window.setTimeout(() => {
        setIsChevronFlashing(false);
        flashTimerRef.current = null;
      }, MODE_SELECT_FLASH_DURATION_MS);
    };

    window.addEventListener(MODE_SELECT_FLASH_EVENT, handleFlashEvent);
    return () => {
      clearFlashTimer();
      window.removeEventListener(MODE_SELECT_FLASH_EVENT, handleFlashEvent);
    };
  }, []);

  const flashingButtonStyle = useMemo<ModeSelectFlashStyle | undefined>(() => {
    if (!isChevronFlashing) {
      return undefined;
    }
    return {
      '--mode-trigger-flash-name':
        flashCycle % 2 === 0
          ? 'selector-mode-trigger-flash-a'
          : 'selector-mode-trigger-flash-b',
    };
  }, [flashCycle, isChevronFlashing]);

  const flashingChevronStyle = useMemo<ModeSelectFlashStyle | undefined>(() => {
    if (!isChevronFlashing) {
      return { fontSize: '10px', marginLeft: '2px' };
    }
    return {
      fontSize: '10px',
      marginLeft: '2px',
      '--mode-chevron-flash-name':
        flashCycle % 2 === 0
          ? 'selector-mode-chevron-flash-a'
          : 'selector-mode-chevron-flash-b',
    };
  }, [flashCycle, isChevronFlashing]);

  const menuContentClassName = cn(
    "selector-menu-surface selector-menu-surface--anchored z-[10001] min-w-[240px] overflow-visible rounded-[14px] p-1.5 text-popover-foreground",
    "data-[state=open]:animate-in data-[state=closed]:animate-out",
    "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
    "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
    "data-[placement^=bottom]:slide-in-from-top-2 data-[placement^=top]:slide-in-from-bottom-2",
  );

  const menuItemClassName = cn(
    "selector-option m-0 rounded-md outline-none",
    "data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground",
    "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
  );

  return (
    <Menu.Root
      lazyMount
      onOpenChange={(details) => setIsOpen(details.open)}
      open={isOpen}
      positioning={{
        placement: 'top',
        gutter: 4,
        flip: true,
        shift: 8,
      }}
    >
      <Menu.Trigger
        ref={buttonRef}
        className={`selector-button selector-button-mode-trigger${isChevronFlashing ? ' is-flashing' : ''}`}
        style={flashingButtonStyle}
        title={getModeText(currentMode.id, 'tooltip') || `${t('chat.currentMode', { mode: getModeText(currentMode.id, 'label') })}`}
        onPointerEnter={() => {
          hoverCloseControllerRef.current.cancel();
          announceHoverMenuOpen(hoverMenuId);
          setIsOpen(true);
        }}
        onPointerLeave={handlePointerLeave}
      >
        <span
          className={`codicon ${currentMode.icon} selector-button-mode-icon`}
          aria-hidden="true"
        />
        <span className="selector-button-text">{getModeText(currentMode.id, 'label')}</span>
        <span
          className={`codicon codicon-chevron-${isOpen ? 'up' : 'down'} selector-button-mode-chevron${isChevronFlashing ? ' is-flashing' : ''}`}
          style={flashingChevronStyle}
        />
      </Menu.Trigger>

      <Portal>
        <Menu.Positioner className="z-[10001] outline-none">
          <Menu.Content
            className={cn(menuContentClassName, "selector-dropdown--mode")}
            onPointerEnter={() => hoverCloseControllerRef.current.cancel()}
            onPointerLeave={handlePointerLeave}
          >
            <SelectorMenuArrow />
            {modeOptions.map((mode) => (
              <Menu.Item
                key={mode.id}
                className={menuItemClassName}
                data-mode-id={mode.id}
                disabled={mode.disabled}
                title={getModeText(mode.id, 'tooltip')}
                value={`mode:${mode.id}`}
                onSelect={() => handleSelect(mode.id, mode.disabled)}
              >
                <span
                  className={`codicon ${mode.icon} mode-icon`}
                  aria-hidden="true"
                />
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <span>{getModeText(mode.id, 'label')}</span>
                  <span className="mode-description">{getModeText(mode.id, 'description')}</span>
                </div>
                {mode.id === selectedModeId && (
                  <Check size={20} className="check-mark" aria-hidden />
                )}
              </Menu.Item>
            ))}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};

export default ModeSelect;
