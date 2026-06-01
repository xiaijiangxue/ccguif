import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { BrowserContextAttachment, BrowserDiagnostic } from "../types";

type BrowserContextSummaryDiagnostic = Pick<
  BrowserDiagnostic,
  "diagnosticId" | "severity" | "message"
>;

type BrowserContextSummaryBudget = Partial<BrowserContextAttachment["budget"]>;

type BrowserContextSummaryPrivacy = {
  redactionApplied?: boolean;
  redactedKinds: string[];
  omittedKinds: string[];
};

type BrowserContextSummaryCardAttachment = Pick<
  BrowserContextAttachment,
  "title" | "url" | "capturedAt" | "stale" | "summary"
> & {
  visibleTextExcerpt?: BrowserContextAttachment["visibleTextExcerpt"];
  elementCounts?: BrowserContextAttachment["elementCounts"];
  diagnostics?: BrowserContextSummaryDiagnostic[];
  privacy?: BrowserContextSummaryPrivacy;
  budget?: BrowserContextSummaryBudget;
  codeCandidates?: BrowserContextAttachment["codeCandidates"];
  pageType?: BrowserContextAttachment["pageType"];
  primaryContent?: BrowserContextAttachment["primaryContent"];
  readableBlocks?: BrowserContextAttachment["readableBlocks"];
  noiseDiagnostics?: BrowserContextAttachment["noiseDiagnostics"];
  visualEvidence?: BrowserContextAttachment["visualEvidence"];
};

export type BrowserContextSummaryCardProps = {
  attachment: BrowserContextSummaryCardAttachment;
};

function formatBrowserSource(url: string): string {
  try {
    const parsedUrl = new URL(url);
    return `${parsedUrl.hostname}${parsedUrl.pathname}`;
  } catch {
    return url;
  }
}

function compactBrowserSummary(title: string | null, summary: string, excerpt?: string): string {
  const titleText = title?.trim() ?? "";
  const normalizedText = (excerpt || summary).replace(/\s+/g, " ").trim();
  const withoutTitle =
    titleText && normalizedText.startsWith(titleText)
      ? normalizedText.slice(titleText.length).trim()
      : normalizedText;
  return withoutTitle.slice(0, 520);
}

function compactDetailText(value: string, limit = 700): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > limit ? `${normalized.slice(0, limit)}...` : normalized;
}

function hasDiagnostics(
  diagnostics: BrowserContextSummaryDiagnostic[] | undefined,
): diagnostics is BrowserContextSummaryDiagnostic[] {
  return Array.isArray(diagnostics) && diagnostics.length > 0;
}

function buildCopyableBrowserSummary(attachment: BrowserContextSummaryCardAttachment): string {
  const lines = [
    `Browser context: ${attachment.title || attachment.url}`,
    `URL: ${attachment.url}`,
    `Captured: ${new Date(attachment.capturedAt).toISOString()}`,
    `State: ${attachment.stale ? "stale" : "available"}`,
    `Page type: ${attachment.pageType ?? "unknown"}`,
    "Primary content:",
    attachment.primaryContent || attachment.visibleTextExcerpt || attachment.summary,
  ];
  const visualEvidence = attachment.visualEvidence ?? [];
  if (visualEvidence.length > 0) {
    lines.push(
      "Visual clues:",
      ...visualEvidence.map((item) =>
        `- ${item.kind}: ${item.label}${item.altText ? `; alt=${item.altText}` : ""}`,
      ),
    );
  }
  return lines.filter(Boolean).join("\n");
}

export function BrowserContextSummaryCard({
  attachment,
}: BrowserContextSummaryCardProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const counts = attachment.elementCounts;
  const diagnostics = attachment.diagnostics?.slice(0, 2) ?? [];
  const summary = useMemo(
    () =>
      compactBrowserSummary(
        attachment.title,
        attachment.summary,
        attachment.visibleTextExcerpt,
      ),
    [attachment.summary, attachment.title, attachment.visibleTextExcerpt],
  );
  const hasStructuredDetails = Boolean(
    counts ||
    attachment.privacy ||
    attachment.budget ||
    hasDiagnostics(attachment.diagnostics) ||
    attachment.readableBlocks?.length ||
    attachment.visualEvidence?.length ||
    attachment.codeCandidates?.length,
  );
  const copyBrowserSummary = async () => {
    try {
      await navigator.clipboard.writeText(buildCopyableBrowserSummary(attachment));
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  };

  return (
    <div className="browser-context-summary-card">
      <div className="browser-context-summary-header">
        <div className="browser-context-summary-kicker">
          {t("messages.browserContextSummary")}
        </div>
        <span className={`browser-context-summary-state ${attachment.stale ? "is-stale" : "is-available"}`}>
          {attachment.stale
            ? t("messages.browserContextState.stale")
            : t("messages.browserContextState.available")}
        </span>
      </div>
      <div className="browser-context-summary-title-line" title={attachment.title ?? attachment.url}>
        {attachment.title || attachment.url}
      </div>
      <div className="browser-context-summary-source" title={attachment.url}>
        {t("messages.browserContextVisibleSnapshot")}
        {" · "}
        {formatBrowserSource(attachment.url)}
        {" · "}
        {t("messages.browserContextPageType", { type: attachment.pageType ?? "unknown" })}
      </div>
      {summary ? (
        <div className="browser-context-summary-excerpt">
          {summary}
        </div>
      ) : null}
      {counts ? (
        <div className="browser-context-summary-counts" aria-label={t("messages.browserContextIncluded")}>
          <span>{t("messages.browserContextHeadingCount", { count: counts.headings })}</span>
          <span>{t("messages.browserContextLinkCount", { count: counts.links })}</span>
          <span>{t("messages.browserContextButtonCount", { count: counts.buttons })}</span>
          <span>{t("messages.browserContextFormCount", { count: counts.forms })}</span>
          <span>{t("messages.browserContextCodeCandidateCount", { count: counts.codeCandidates })}</span>
        </div>
      ) : null}
      <div className="browser-context-summary-meta">
        {new Date(attachment.capturedAt).toLocaleString()}
        {" · "}
        {t("messages.browserContextNoRawApi")}
      </div>
      <button
        type="button"
        className="browser-context-summary-copy"
        onClick={() => void copyBrowserSummary()}
      >
        {copyState === "copied"
          ? t("messages.browserContextCopyDone")
          : copyState === "failed"
            ? t("messages.browserContextCopyFailed")
            : t("messages.browserContextCopySummary")}
      </button>
      {hasStructuredDetails ? (
        <button
          type="button"
          className="browser-context-summary-toggle"
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded
            ? t("messages.browserContextHideDetails")
            : t("messages.browserContextShowDetails")}
        </button>
      ) : null}
      {expanded ? (
        <div className="browser-context-summary-detail">
          {counts ? (
            <div>
              {t("messages.browserContextDetailCounts", {
                headings: counts.headings,
                links: counts.links,
                buttons: counts.buttons,
                forms: counts.forms,
                landmarks: counts.landmarks,
                candidates: counts.codeCandidates,
              })}
            </div>
          ) : null}
          {attachment.primaryContent ? (
            <section className="browser-context-summary-section">
              <div className="browser-context-summary-section-title">
                {t("messages.browserContextPrimaryContent")}
              </div>
              <p>{compactDetailText(attachment.primaryContent, 1_200)}</p>
            </section>
          ) : null}
          {attachment.readableBlocks && attachment.readableBlocks.length > 0 ? (
            <section className="browser-context-summary-section">
              <div className="browser-context-summary-section-title">
                {t("messages.browserContextReadableBlocks", {
                  count: attachment.readableBlocks.length,
                })}
              </div>
              <ol className="browser-context-summary-evidence-list">
                {attachment.readableBlocks.slice(0, 8).map((block) => (
                  <li key={block.blockId}>
                    <span className="browser-context-summary-evidence-label">
                      {block.role} · score {block.score}
                    </span>
                    <p>{compactDetailText(block.text)}</p>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
          {attachment.visualEvidence && attachment.visualEvidence.length > 0 ? (
            <section className="browser-context-summary-section">
              <div className="browser-context-summary-section-title">
                {t("messages.browserContextVisualEvidence", {
                  count: attachment.visualEvidence.length,
                })}
              </div>
              <ul className="browser-context-summary-evidence-list">
                {attachment.visualEvidence.slice(0, 12).map((item) => (
                  <li key={item.evidenceId}>
                    <span className="browser-context-summary-evidence-label">
                      {item.kind} · {item.label}
                    </span>
                    {item.altText ? <p>alt: {compactDetailText(item.altText, 260)}</p> : null}
                    {item.nearbyText ? <p>{compactDetailText(item.nearbyText, 520)}</p> : null}
                    {item.srcOrigin ? (
                      <p className="browser-context-summary-evidence-origin">{item.srcOrigin}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {attachment.codeCandidates && attachment.codeCandidates.length > 0 ? (
            <section className="browser-context-summary-section">
              <div className="browser-context-summary-section-title">
                {t("messages.browserContextCodeCandidateCount", {
                  count: attachment.codeCandidates.length,
                })}
              </div>
              <ul className="browser-context-summary-evidence-list">
                {attachment.codeCandidates.map((candidate) => (
                  <li key={candidate.candidateId}>
                    <span className="browser-context-summary-evidence-label">
                      {candidate.filePath}
                    </span>
                    <p>{candidate.reason} · {candidate.confidence}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {attachment.privacy ? (
            <div>
              {t("messages.browserContextDetailPrivacy", {
                redacted: attachment.privacy.redactedKinds.length,
                omitted: attachment.privacy.omittedKinds.length,
              })}
            </div>
          ) : null}
          {attachment.budget ? (
            <div>
              {t("messages.browserContextDetailBudget", {
                truncated: attachment.budget.truncated
                  ? t("common.yes", "yes")
                  : t("common.no", "no"),
                omitted: attachment.budget.omittedElementCount ?? 0,
              })}
            </div>
          ) : null}
          {attachment.noiseDiagnostics && attachment.noiseDiagnostics.length > 0 ? (
            <div>
              {t("messages.browserContextNoiseDiagnostics", {
                count: attachment.noiseDiagnostics.length,
              })}
            </div>
          ) : null}
          {diagnostics.length > 0 ? (
            <ul>
              {diagnostics.map((diagnostic) => (
                <li key={diagnostic.diagnosticId}>
                  {diagnostic.severity}: {diagnostic.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
