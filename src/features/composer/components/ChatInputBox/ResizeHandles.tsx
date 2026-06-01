import type { ComponentPropsWithoutRef, KeyboardEvent as ReactKeyboardEvent } from 'react';
import ArrowDownToLine from 'lucide-react/dist/esm/icons/arrow-down-to-line';

type ResizeDirection = 'n';

export function ResizeHandles({
  getHandleProps,
  nudge,
  collapse,
  isCollapsed = false,
  onExpandCollapsed,
}: {
  getHandleProps: (dir: ResizeDirection) => ComponentPropsWithoutRef<'div'>;
  nudge: (delta: { wrapperHeightPx?: number }) => void;
  collapse: () => void;
  isCollapsed?: boolean;
  onExpandCollapsed?: () => void;
}) {
  const handleKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 24 : 8;

    const key = e.key;
    if (key !== 'ArrowUp' && key !== 'ArrowDown') {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    if (key === 'ArrowUp') nudge({ wrapperHeightPx: step });
    if (key === 'ArrowDown') nudge({ wrapperHeightPx: -step });
  };

  const renderCollapseButton = () => {
    if (isCollapsed) return null;

    return (
      <button
        type="button"
        className="resize-handle-collapse-button"
        aria-label="Collapse input to bottom"
        title="Collapse input to bottom"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          collapse();
        }}
      >
        <ArrowDownToLine size={13} aria-hidden />
      </button>
    );
  };

  return (
    <div className="resize-handle-hover-zone">
      <div className="resize-handle-controls">
        {renderCollapseButton()}
        <div
          className="resize-handle resize-handle--n"
          {...getHandleProps('n')}
          onClick={(event) => {
            if (!isCollapsed) return;
            event.preventDefault();
            event.stopPropagation();
            if (onExpandCollapsed) {
              onExpandCollapsed();
              return;
            }
            nudge({ wrapperHeightPx: 24 });
          }}
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize input height"
          tabIndex={0}
          onKeyDown={handleKeyDown}
        />
        {renderCollapseButton()}
      </div>
    </div>
  );
}
