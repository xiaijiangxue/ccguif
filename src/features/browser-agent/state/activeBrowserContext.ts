import type { BrowserSession } from "../types";

export type ActiveBrowserContextState = {
  workspaceId: string;
  browserSessionId: string;
  session: BrowserSession;
  rendererBound: boolean;
  updatedAt: number;
};

type ActiveBrowserContextListener = (
  state: ActiveBrowserContextState | null,
) => void;

let activeBrowserContextState: ActiveBrowserContextState | null = null;
const activeBrowserContextListeners = new Set<ActiveBrowserContextListener>();

function emitActiveBrowserContextChange(): void {
  for (const listener of activeBrowserContextListeners) {
    listener(activeBrowserContextState);
  }
}

export function getActiveBrowserContext(): ActiveBrowserContextState | null {
  return activeBrowserContextState;
}

export function setActiveBrowserContextSession(
  session: BrowserSession,
  options: { rendererBound: boolean },
): ActiveBrowserContextState {
  const nextState: ActiveBrowserContextState = {
    workspaceId: session.workspaceId,
    browserSessionId: session.browserSessionId,
    session,
    rendererBound: options.rendererBound,
    updatedAt: Date.now(),
  };
  activeBrowserContextState = nextState;
  emitActiveBrowserContextChange();
  return nextState;
}

export function clearActiveBrowserContextSession(
  browserSessionId?: string | null,
): void {
  if (
    browserSessionId &&
    activeBrowserContextState?.browserSessionId !== browserSessionId
  ) {
    return;
  }
  if (!activeBrowserContextState) {
    return;
  }
  activeBrowserContextState = null;
  emitActiveBrowserContextChange();
}

export function subscribeActiveBrowserContext(
  listener: ActiveBrowserContextListener,
): () => void {
  activeBrowserContextListeners.add(listener);
  listener(activeBrowserContextState);
  return () => {
    activeBrowserContextListeners.delete(listener);
  };
}
