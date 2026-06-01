import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { DropdownProps, DropdownItemData } from '../types';
import { cn } from '@/lib/utils';
import { DropdownItem } from './DropdownItem';
import { getAppViewport } from '../../../utils/viewport';

interface CompletionDropdownProps extends Omit<DropdownProps, 'children'> {
  items: DropdownItemData[];
  loading?: boolean;
  emptyText?: string;
  onSelect?: (item: DropdownItemData, index: number) => void;
  onMouseEnter?: (index: number) => void;
}

/**
 * Dropdown - Generic dropdown menu component
 */
export const Dropdown = ({
  isVisible,
  position,
  width = 300,
  offsetY = 4,
  offsetX = 0,
  selectedIndex: _selectedIndex = 0,
  onClose,
  className,
  containerRef,
  children,
}: DropdownProps) => {
  // selectedIndex is passed from parent component, not directly used here
  void _selectedIndex;
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Ref to avoid stale closure for onClose in event listener
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  /**
   * Close on outside click
   */
  useEffect(() => {
    if (!isVisible) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onCloseRef.current?.();
      }
    };

    // Delay adding event listener to prevent immediate trigger
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isVisible]);

  // After render, measure actual height and adjust position if it overflows viewport
  useLayoutEffect(() => {
    if (!isVisible || !dropdownRef.current) return;
    const rect = dropdownRef.current.getBoundingClientRect();
    if (rect.top < 0) {
      dropdownRef.current.style.bottom = 'auto';
      dropdownRef.current.style.top = '8px';
    }
  }, [isVisible]);

  if (!isVisible || !position) {
    return null;
  }

  // Use #app's bounding rect as the reference viewport.
  // Both #app's rect and position (from getBoundingClientRect on child elements)
  // are in the same coordinate space, so they can be safely compared regardless
  // of the zoom factor applied to #app.
  const { width: viewportWidth, height: viewportHeight, top: viewportTop, left: viewportLeft, fixedPosDivisor } = getAppViewport();

  // Use containerRef to align dropdown to the input box when provided
  const containerRect = containerRef?.current?.getBoundingClientRect();
  let left: number;
  let bottomValue: number;
  let effectiveWidth: number;

  // Estimate dropdown height for boundary detection
  const estimatedDropdownHeight = Math.min(200, viewportHeight * 0.4);

  if (containerRect) {
    effectiveWidth = containerRect.width;
    left = containerRect.left - viewportLeft;

    // Viewport boundary detection: choose best position based on available space
    const spaceAbove = containerRect.top - viewportTop;
    const spaceBelow = viewportHeight - (containerRect.top - viewportTop);

    if (spaceAbove >= estimatedDropdownHeight + offsetY) {
      // Enough space above — position dropdown above the container
      bottomValue = viewportHeight - (containerRect.top - viewportTop) + offsetY;
    } else if (spaceBelow >= estimatedDropdownHeight + offsetY) {
      // Not enough space above, but enough below — position below
      bottomValue = viewportHeight - (containerRect.top - viewportTop) - containerRect.height - offsetY;
    } else {
      // Neither direction has full space — prefer above with available space
      bottomValue = viewportHeight - (containerRect.top - viewportTop) + offsetY;
    }

    // Hard clamp: ensure the dropdown never extends above the viewport
    if (bottomValue + estimatedDropdownHeight > viewportHeight) {
      bottomValue = viewportHeight - estimatedDropdownHeight - 8;
    }
    if (bottomValue < 8) {
      bottomValue = 8;
    }

    // Horizontal edge clamping
    if (left + effectiveWidth + 10 > viewportWidth) {
      left = viewportWidth - effectiveWidth - 10;
    }
    if (left < 10) {
      left = 10;
    }
  } else {
    // Fallback: position at cursor
    left = position.left - viewportLeft + offsetX;
    const edgePadding = 10;
    effectiveWidth = Math.min(width, Math.max(280, viewportWidth - edgePadding * 2));
    if (left + effectiveWidth + edgePadding > viewportWidth) {
      left = viewportWidth - effectiveWidth - edgePadding;
    }
    if (left < edgePadding) {
      left = edgePadding;
    }
    const posInApp = position.top - viewportTop;
    const effectiveTop = Math.max(offsetY, Math.min(posInApp, viewportHeight - offsetY));
    bottomValue = viewportHeight - effectiveTop + offsetY;
  }

  const style: React.CSSProperties = {
    position: 'fixed',
    bottom: `${bottomValue / fixedPosDivisor}px`,
    left: left / fixedPosDivisor,
    width: effectiveWidth / fixedPosDivisor,
    zIndex: 1001,
  };

  return (
    <div
      ref={dropdownRef}
      className={cn("z-50 min-w-[8rem] overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 completion-dropdown", className)}
      style={style}
    >
      {children}
    </div>
  );
};

/**
 * CompletionDropdown - Completion-specific dropdown menu
 */
export const CompletionDropdown = ({
  isVisible,
  position,
  width = 300,
  offsetY = 4,
  offsetX = 0,
  className,
  selectedIndex = 0,
  items,
  loading = false,
  emptyText,
  onClose,
  onSelect,
  onMouseEnter,
  containerRef,
}: CompletionDropdownProps) => {
  const { t } = useTranslation();
  const listRef = useRef<HTMLDivElement>(null);
  const isPromptDropdown = className?.includes('completion-dropdown--prompt') ?? false;

  /**
   * Scroll highlighted item into view
   */
  useEffect(() => {
    if (!listRef.current) return;

    const activeItem = listRef.current.querySelector('.dropdown-item.active');
    if (activeItem) {
      // Use 'auto' for instant scroll to avoid smooth animation delay
      activeItem.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    }
  }, [selectedIndex]);

  /**
   * Handle selection
   */
  const handleSelect = useCallback((item: DropdownItemData, index: number) => {
    // Allow selecting all types (files and directories)
    onSelect?.(item, index);
  }, [onSelect]);

  /**
   * Handle mouse enter
   */
  const handleMouseEnter = useCallback((index: number) => {
    onMouseEnter?.(index);
  }, [onMouseEnter]);

  // Filter selectable items (exclude separators and section headers)
  const selectableItems = items.filter(
    item => item.type !== 'separator' && item.type !== 'section-header'
  );

  return (
    <Dropdown
      isVisible={isVisible}
      position={position}
      width={width}
      offsetY={offsetY}
      offsetX={offsetX}
      className={className}
      selectedIndex={selectedIndex}
      onClose={onClose}
      containerRef={containerRef}
    >
      <div
        ref={listRef}
        className={isPromptDropdown ? 'dropdown-list dropdown-list--prompt-grid' : 'dropdown-list'}
      >
        {loading ? (
          <div className="dropdown-loading">{t('chat.loadingDropdown')}</div>
        ) : items.length === 0 ? (
          <div className="dropdown-empty">{emptyText || t('chat.loadingDropdown')}</div>
        ) : (
          items.map((item) => {
            // Calculate index within selectable items
            const selectableIndex = selectableItems.findIndex(i => i.id === item.id);
            const isActive = selectableIndex === selectedIndex;

            return (
              <DropdownItem
                key={item.id}
                item={item}
                isActive={isActive}
                onClick={() => handleSelect(item, selectableIndex)}
                onMouseEnter={() => {
                  if (item.type !== 'separator' && item.type !== 'section-header') {
                    handleMouseEnter(selectableIndex);
                  }
                }}
              />
            );
          })
        )}
      </div>
    </Dropdown>
  );
};

export { DropdownItem };
export default Dropdown;
