import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import X from "lucide-react/dist/esm/icons/x";
import type { BrowserContextAttachment } from "../types";

export type BrowserContextPreviewProps = {
  attachment: BrowserContextAttachment;
  busy: boolean;
  onRefresh: () => void;
  onRemove: () => void;
};

function formatBrowserSource(url: string): string {
  try {
    const parsedUrl = new URL(url);
    return `${parsedUrl.hostname}${parsedUrl.pathname}`;
  } catch {
    return url;
  }
}

function compactDetailText(value: string, limit = 620): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > limit ? `${normalized.slice(0, limit)}...` : normalized;
}

export function BrowserContextPreview({
  attachment,
  busy,
  onRefresh,
  onRemove,
}: BrowserContextPreviewProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const stateLabel = attachment.stale
    ? t("browserAgent.composer.stale")
    : t("browserAgent.composer.fresh");
  const diagnostics = attachment.diagnostics.slice(0, 3);
  const counts = attachment.elementCounts;
  const detailSnapshotText = attachment.visibleTextExcerpt || attachment.summary;
  useEffect(() => {
    setExpanded(false);
  }, [attachment.snapshotId, attachment.title, attachment.url]);

  return (
    <div className="composer-browser-context-card">
      <div className="composer-browser-context-main">
        <div className="composer-browser-context-title-row">
          <div className="composer-browser-context-kicker">
            {t("browserAgent.composer.visibleSnapshot")}
          </div>
          <span className={`composer-browser-context-state ${attachment.stale ? "is-stale" : "is-fresh"}`}>
            {stateLabel}
          </span>
        </div>
        <div className="composer-browser-context-title" title={attachment.url}>
          {attachment.title || attachment.url}
        </div>
        <div className="composer-browser-context-counts" aria-label={t("browserAgent.composer.countSummary")}>
          <span>{t("browserAgent.composer.headingCount", { count: counts.headings })}</span>
          <span>{t("browserAgent.composer.linkCount", { count: counts.links })}</span>
          <span>{t("browserAgent.composer.buttonCount", { count: counts.buttons })}</span>
          <span>{t("browserAgent.composer.formCount", { count: counts.forms })}</span>
          <span>{t("browserAgent.composer.readableBlockCount", { count: counts.readableBlocks ?? 0 })}</span>
          <span>{t("browserAgent.composer.visualEvidenceCount", { count: counts.visualEvidence ?? 0 })}</span>
        </div>
        <button
          type="button"
          className="composer-browser-context-detail-toggle"
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded
            ? t("browserAgent.composer.hideDetails")
            : t("browserAgent.composer.showDetails")}
        </button>
        {expanded ? (
          <div className="composer-browser-context-detail">
            <div className="composer-browser-context-detail-line">
              {formatBrowserSource(attachment.url)}
              {" · "}
              {t("browserAgent.composer.noRawApi")}
            </div>
            {detailSnapshotText ? (
              <section className="composer-browser-context-section">
                <div className="composer-browser-context-section-title">
                  {t("browserAgent.composer.visibleSnapshot")}
                </div>
                <p>{compactDetailText(detailSnapshotText, 1_200)}</p>
              </section>
            ) : null}
            <div className="composer-browser-context-detail-line">
              {t("browserAgent.composer.counts", {
                headings: counts.headings,
                links: counts.links,
                buttons: counts.buttons,
                forms: counts.forms,
                readableBlocks: counts.readableBlocks ?? 0,
                visualEvidence: counts.visualEvidence ?? 0,
                candidates: counts.codeCandidates,
              })}
            </div>
            {attachment.primaryContent ? (
              <section className="composer-browser-context-section">
                <div className="composer-browser-context-section-title">
                  {t("browserAgent.composer.primaryContent")}
                </div>
                <p>{compactDetailText(attachment.primaryContent, 1_000)}</p>
              </section>
            ) : null}
            {attachment.readableBlocks && attachment.readableBlocks.length > 0 ? (
              <section className="composer-browser-context-section">
                <div className="composer-browser-context-section-title">
                  {t("browserAgent.composer.readableBlocks", {
                    count: attachment.readableBlocks.length,
                  })}
                </div>
                <ol className="composer-browser-context-evidence-list">
                  {attachment.readableBlocks.slice(0, 8).map((block) => (
                    <li key={block.blockId}>
                      <span>{block.role} · score {block.score}</span>
                      <p>{compactDetailText(block.text)}</p>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}
            {attachment.visualEvidence && attachment.visualEvidence.length > 0 ? (
              <section className="composer-browser-context-section">
                <div className="composer-browser-context-section-title">
                  {t("browserAgent.composer.visualEvidence", {
                    count: attachment.visualEvidence.length,
                  })}
                </div>
                <ul className="composer-browser-context-evidence-list">
                  {attachment.visualEvidence.slice(0, 12).map((item) => (
                    <li key={item.evidenceId}>
                      <span>{item.kind} · {item.label}</span>
                      {item.altText ? <p>alt: {compactDetailText(item.altText, 240)}</p> : null}
                      {item.nearbyText ? <p>{compactDetailText(item.nearbyText, 460)}</p> : null}
                      {item.srcOrigin ? <p className="composer-browser-context-origin">{item.srcOrigin}</p> : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {attachment.codeCandidates.length > 0 ? (
              <section className="composer-browser-context-section">
                <div className="composer-browser-context-section-title">
                  {t("browserAgent.composer.codeCandidates", {
                    count: attachment.codeCandidates.length,
                  })}
                </div>
                <ul className="composer-browser-context-evidence-list">
                  {attachment.codeCandidates.map((candidate) => (
                    <li key={candidate.candidateId}>
                      <span>{candidate.filePath}</span>
                      <p>{candidate.reason} · {candidate.confidence}</p>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            <div className="composer-browser-context-detail-line">
              {t("browserAgent.composer.privacy", {
                redacted: attachment.privacy.redactedKinds.length,
                omitted: attachment.privacy.omittedKinds.length,
              })}
            </div>
            {diagnostics.length > 0 ? (
              <ul className="composer-browser-context-diagnostics">
                {diagnostics.map((diagnostic) => (
                  <li key={diagnostic.diagnosticId}>
                    <AlertCircle size={12} aria-hidden />
                    <span>{diagnostic.message}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="composer-browser-context-actions">
        <button
          type="button"
          className="composer-browser-context-refresh"
          onClick={onRefresh}
          disabled={busy}
          title={t("browserAgent.composer.refresh")}
        >
          <RefreshCw size={14} aria-hidden />
        </button>
        <button
          type="button"
          className="composer-browser-context-remove"
          onClick={onRemove}
          title={t("browserAgent.composer.remove")}
        >
          <X size={14} aria-hidden />
        </button>
      </div>
    </div>
  );
}
