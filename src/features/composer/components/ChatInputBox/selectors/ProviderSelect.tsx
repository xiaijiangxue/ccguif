import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Menu } from '@ark-ui/react/menu';
import { Portal } from '@ark-ui/react/portal';
import Check from "lucide-react/dist/esm/icons/check";
import { AVAILABLE_PROVIDERS } from '../types';
import type { ProviderId } from '../types';
import { EngineIcon } from '../../../../engine/components/EngineIcon';
import { cn } from '@/lib/utils';

interface ProviderSelectProps {
  value: string;
  onChange?: (providerId: string) => void;
  providerAvailability?: Partial<Record<ProviderId, boolean>>;
  providerVersions?: Partial<Record<ProviderId, string | null>>;
  providerStatusLabels?: Partial<Record<ProviderId, string | null>>;
  providerDisabledMessages?: Partial<Record<ProviderId, string | null>>;
  iconOnly?: boolean;
}

/**
 * Provider icon mapping
 */
const ProviderIcon = ({ providerId, size = 16 }: { providerId: string; size?: number }) => {
  const imgStyle = { width: size, height: size, flexShrink: 0 } as const;
  switch (providerId) {
    case 'claude':
      return <EngineIcon engine="claude" size={size} style={imgStyle} />;
    case 'codex':
      return <EngineIcon engine="codex" size={size} style={imgStyle} />;
    case 'gemini':
      return <EngineIcon engine="gemini" size={size} style={imgStyle} />;
    case 'opencode':
      return <EngineIcon engine="opencode" size={size} style={imgStyle} />;
    default:
      return <EngineIcon engine="claude" size={size} style={imgStyle} />;
  }
};

/**
 * ProviderSelect - AI provider selector component
 * Supports switching between Claude, Codex, Gemini, and other providers
 */
export const ProviderSelect = ({
  value,
  onChange,
  providerAvailability,
  providerVersions,
  providerStatusLabels,
  providerDisabledMessages,
  iconOnly = false,
}: ProviderSelectProps) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const buttonRef = useRef<HTMLButtonElement>(null);

  const providers = AVAILABLE_PROVIDERS.map((provider) => ({
    ...provider,
    enabled: providerAvailability?.[provider.id] ?? provider.enabled,
    version: providerVersions?.[provider.id] ?? null,
    statusLabel: providerStatusLabels?.[provider.id] ?? null,
    disabledMessage: providerDisabledMessages?.[provider.id] ?? null,
  }));
  const visibleProviders = providers.filter(
    (provider) => provider.enabled || provider.id === value,
  );
  const currentProvider =
    visibleProviders.find((provider) => provider.id === value) ??
    providers.find((provider) => provider.id === value) ??
    visibleProviders[0] ??
    providers[0] ?? {
      id: value,
      label: value,
      enabled: true,
      version: null,
    };

  // Helper function to get translated provider label
  const getProviderLabel = (providerId: string) => {
    return t(`providers.${providerId}.label`);
  };

  /**
   * Show toast message
   */
  const showToastMessage = useCallback((message: string) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 1500);
  }, []);

  /**
   * Select provider
   */
  const handleSelect = useCallback((providerId: string) => {
    const provider = providers.find((entry) => entry.id === providerId);

    if (!provider) return;

    if (!provider.enabled) {
      showToastMessage(provider.disabledMessage || provider.statusLabel || t('settings.provider.featureComingSoon'));
      setIsOpen(false);
      return;
    }

    // Provider available, perform switch
    onChange?.(providerId);
    setIsOpen(false);
  }, [onChange, providers, showToastMessage, t]);

  const menuContentClassName = cn(
    "selector-menu-surface z-[10001] min-w-[180px] overflow-hidden rounded-[14px] p-1.5 text-popover-foreground",
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
    <>
      <Menu.Root
        lazyMount
        onOpenChange={(details) => setIsOpen(details.open)}
        open={isOpen}
        positioning={{
          placement: 'top-start',
          gutter: 4,
          flip: true,
          shift: 8,
        }}
      >
        <Menu.Trigger
          ref={buttonRef}
          className={`selector-button ${iconOnly ? 'selector-provider-button' : ''}`}
          title={`${t('config.switchProvider')}: ${getProviderLabel(currentProvider.id)}${currentProvider.version ? ` (${currentProvider.version})` : ''}${currentProvider.statusLabel ? `（${currentProvider.statusLabel}）` : ''}`}
          aria-label={`${t('config.switchProvider')}: ${getProviderLabel(currentProvider.id)}`}
        >
          <ProviderIcon providerId={currentProvider.id} size={12} />
          {!iconOnly && <span className="selector-button-text">{getProviderLabel(currentProvider.id)}</span>}
          {!iconOnly && (
            <span className={`codicon codicon-chevron-${isOpen ? 'up' : 'down'}`} style={{ fontSize: '10px', marginLeft: '2px' }} />
          )}
        </Menu.Trigger>

        <Portal>
          <Menu.Positioner className="z-[10001] outline-none">
            <Menu.Content className={menuContentClassName}>
              {visibleProviders.map((provider) => (
                <Menu.Item
                  key={provider.id}
                  className={menuItemClassName}
                  disabled={!provider.enabled}
                  value={`provider:${provider.id}`}
                  onSelect={() => handleSelect(provider.id)}
                >
                  <ProviderIcon providerId={provider.id} size={16}  />
                  <span>
                    {getProviderLabel(provider.id)}
                    {provider.version ? ` (${provider.version})` : ''}
                    {provider.statusLabel ? `（${provider.statusLabel}）` : ''}
                  </span>
                  {provider.id === value && (
                    <Check size={16} className="check-mark" />
                  )}
                </Menu.Item>
              ))}
            </Menu.Content>
          </Menu.Positioner>
        </Portal>
      </Menu.Root>
      {showToast && (
        <div className="selector-toast">
          {toastMessage}
        </div>
      )}
    </>
  );
};

export default ProviderSelect;
