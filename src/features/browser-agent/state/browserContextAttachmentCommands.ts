export type BrowserContextAttachmentRequest = {
  workspaceId?: string | null;
};

type BrowserContextAttachmentRequestListener = (
  request: BrowserContextAttachmentRequest,
) => void;

const browserContextAttachmentRequestListeners =
  new Set<BrowserContextAttachmentRequestListener>();

export function requestBrowserContextAttachment(
  request: BrowserContextAttachmentRequest = {},
): void {
  for (const listener of browserContextAttachmentRequestListeners) {
    listener(request);
  }
}

export function subscribeBrowserContextAttachmentRequests(
  listener: BrowserContextAttachmentRequestListener,
): () => void {
  browserContextAttachmentRequestListeners.add(listener);
  return () => {
    browserContextAttachmentRequestListeners.delete(listener);
  };
}
