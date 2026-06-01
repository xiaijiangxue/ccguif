export { BrowserDock } from "./components/BrowserDock";
export { BrowserContextPreview } from "./components/BrowserContextPreview";
export { BrowserContextSummaryCard } from "./components/BrowserContextSummaryCard";
export { useBrowserContextAttachment } from "./hooks/useBrowserContextAttachment";
export {
  BROWSER_AGENT_ATTACHMENT_STALE_AFTER_MS,
  BROWSER_AGENT_CLOSED_SESSION_CLEANUP_AFTER_MS,
  BROWSER_AGENT_EVIDENCE_RETENTION_DAYS,
  BROWSER_AGENT_EVIDENCE_RETENTION_POLICY,
} from "./constants";
export type { BrowserEvidenceRetentionPolicy } from "./constants";
export {
  buildBrowserContextAttachment,
  buildBrowserContextSnapshot,
  formatBrowserContextPrompt,
  isBrowserContextAttachmentStale,
  parseBrowserContextPrompt,
  sanitizeBrowserSnapshotText,
  stripBrowserContextPrompt,
} from "./utils";
export {
  clearActiveBrowserContextSession,
  getActiveBrowserContext,
  setActiveBrowserContextSession,
  subscribeActiveBrowserContext,
} from "./state/activeBrowserContext";
export type { ActiveBrowserContextState } from "./state/activeBrowserContext";
export type {
  BrowserContextAttachmentOptions,
  BrowserSnapshotBuilderInput,
  BrowserSnapshotSanitizationResult,
} from "./utils";
export type * from "./types";
