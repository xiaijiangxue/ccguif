const HOVER_MENU_OPEN_EVENT = 'ccguif:hover-menu-open';
const HOVER_MENU_CLOSE_DELAY_MS = 140;

type HoverMenuOpenDetail = {
  id: string;
};

export function announceHoverMenuOpen(id: string) {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent<HoverMenuOpenDetail>(HOVER_MENU_OPEN_EVENT, {
    detail: { id },
  }));
}

export function subscribeToHoverMenuOpen(
  id: string,
  onOtherMenuOpen: () => void,
) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleOpen = (event: Event) => {
    const customEvent = event as CustomEvent<HoverMenuOpenDetail>;
    if (customEvent.detail?.id === id) {
      return;
    }

    onOtherMenuOpen();
  };

  window.addEventListener(HOVER_MENU_OPEN_EVENT, handleOpen as EventListener);
  return () => {
    window.removeEventListener(HOVER_MENU_OPEN_EVENT, handleOpen as EventListener);
  };
}

export function createHoverMenuCloseController(
  onClose: () => void,
  delayMs = HOVER_MENU_CLOSE_DELAY_MS,
) {
  let timeoutId: number | null = null;

  return {
    schedule() {
      if (typeof window === 'undefined') {
        onClose();
        return;
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      timeoutId = window.setTimeout(() => {
        timeoutId = null;
        onClose();
      }, delayMs);
    },
    cancel() {
      if (typeof window === 'undefined') {
        return;
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
    },
    cleanup() {
      if (typeof window === 'undefined') {
        return;
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
    },
  };
}
