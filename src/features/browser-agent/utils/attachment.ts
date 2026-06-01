import type {
  BrowserCodeCandidate,
  BrowserContextAttachment,
  BrowserContextSnapshot,
  BrowserDiagnostic,
  BrowserNoiseDiagnostic,
  BrowserReadableBlock,
  BrowserSnapshotBudget,
  BrowserSnapshotFreshness,
  BrowserVisualEvidence,
} from "../types";

const DEFAULT_STALE_AFTER_MS = 5 * 60 * 1000;
const SUMMARY_CHAR_LIMIT = 360;
const EXCERPT_CHAR_LIMIT = 720;
const PRIMARY_CONTENT_PAYLOAD_LIMIT = 4_000;
const READABLE_BLOCK_PAYLOAD_LIMIT = 1_600;
const VISUAL_NEARBY_PAYLOAD_LIMIT = 520;
const PAYLOAD_CANDIDATE_LIMIT = 8;

type BrowserContextPromptAttachment = Pick<
  BrowserContextAttachment,
  | "attachmentId"
  | "browserSessionId"
  | "snapshotId"
  | "workspaceId"
  | "title"
  | "url"
  | "capturedAt"
  | "stale"
  | "summary"
> & {
  freshness?: BrowserSnapshotFreshness;
  visibleTextExcerpt?: string;
  pageType?: BrowserContextAttachment["pageType"];
  primaryContent?: string;
  readableBlocks?: BrowserReadableBlock[];
  noiseDiagnostics?: BrowserNoiseDiagnostic[];
  visualEvidence?: BrowserVisualEvidence[];
  elementCounts?: BrowserContextAttachment["elementCounts"];
  diagnostics?: Array<Pick<BrowserDiagnostic, "severity" | "message">>;
  budget?: Partial<BrowserSnapshotBudget>;
  codeCandidates?: BrowserCodeCandidate[];
  privacy: {
    redactionApplied: boolean;
    redactedKinds: string[];
    omittedKinds: string[];
  };
};

type ParsedBrowserContextPromptAttachment = Pick<
  BrowserContextAttachment,
  | "title"
  | "url"
  | "capturedAt"
  | "stale"
  | "summary"
> &
  Partial<
    Pick<
      BrowserContextAttachment,
      | "pageType"
      | "primaryContent"
      | "visibleTextExcerpt"
      | "readableBlocks"
      | "visualEvidence"
      | "noiseDiagnostics"
      | "codeCandidates"
      | "elementCounts"
    >
  >;

export type BrowserContextAttachmentOptions = {
  now?: number;
  staleAfterMs?: number;
};

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function primaryContentText(snapshot: BrowserContextSnapshot): string {
  const primary = snapshot.page.primaryContent?.text;
  if (primary?.trim()) {
    return primary;
  }
  const readable = snapshot.page.readableBlocks?.find((block) => block.text.trim());
  if (readable) {
    return readable.text;
  }
  return snapshot.page.visibleText;
}

function buildSnapshotSummary(snapshot: BrowserContextSnapshot): string {
  const title = snapshot.source.title?.trim() || snapshot.source.normalizedUrl;
  const text = compactWhitespace(primaryContentText(snapshot));
  if (!text) {
    return title;
  }
  const excerpt = text.length > SUMMARY_CHAR_LIMIT
    ? `${text.slice(0, SUMMARY_CHAR_LIMIT)}...`
    : text;
  return `${title}\n${excerpt}`;
}

function collectDiagnostics(snapshot: BrowserContextSnapshot): BrowserDiagnostic[] {
  return [
    ...snapshot.diagnostics.captureWarnings,
    ...snapshot.diagnostics.console,
  ].slice(0, snapshot.budget.diagnosticLimit);
}

function limitCodeCandidates(candidates: BrowserCodeCandidate[]): BrowserCodeCandidate[] {
  return candidates.slice(0, PAYLOAD_CANDIDATE_LIMIT);
}

function limitReadableBlocks(blocks: BrowserReadableBlock[] | undefined): BrowserReadableBlock[] {
  return (blocks ?? []).slice(0, 8).map((block) => ({
    ...block,
    text: block.text.slice(0, READABLE_BLOCK_PAYLOAD_LIMIT),
    truncated: block.truncated || block.text.length > READABLE_BLOCK_PAYLOAD_LIMIT,
  }));
}

function limitVisualEvidence(items: BrowserVisualEvidence[] | undefined): BrowserVisualEvidence[] {
  return (items ?? []).slice(0, 12).map((item) => ({
    ...item,
    nearbyText: item.nearbyText?.slice(0, VISUAL_NEARBY_PAYLOAD_LIMIT) ?? item.nearbyText,
  }));
}

export function isBrowserContextAttachmentStale(
  attachment: BrowserContextAttachment,
  now = Date.now(),
  staleAfterMs = DEFAULT_STALE_AFTER_MS,
): boolean {
  return attachment.stale || now - attachment.capturedAt > staleAfterMs;
}

export function buildBrowserContextAttachment(
  snapshot: BrowserContextSnapshot,
  options: BrowserContextAttachmentOptions = {},
): BrowserContextAttachment {
  const now = options.now ?? Date.now();
  const staleAfterMs = options.staleAfterMs ?? DEFAULT_STALE_AFTER_MS;
  const freshness =
    now - snapshot.capturedAt > staleAfterMs ? "expired" : snapshot.freshness;
  const stale = freshness !== "fresh";
  const codeCandidates = limitCodeCandidates(snapshot.codeCandidates ?? []);
  const readableBlocks = limitReadableBlocks(snapshot.page.readableBlocks);
  const visualEvidence = limitVisualEvidence(snapshot.page.visualEvidence);
  const primaryText = compactWhitespace(primaryContentText(snapshot));
  return {
    kind: "browser_snapshot",
    attachmentId: `browser-attachment-${snapshot.snapshotId}`,
    browserSessionId: snapshot.browserSessionId,
    snapshotId: snapshot.snapshotId,
    workspaceId: snapshot.workspaceId,
    title: snapshot.source.title,
    url: snapshot.source.normalizedUrl,
    capturedAt: snapshot.capturedAt,
    stale,
    freshness,
    summary: buildSnapshotSummary(snapshot),
    visibleTextExcerpt: primaryText.slice(0, EXCERPT_CHAR_LIMIT),
    pageType: snapshot.page.pageType ?? "unknown",
    primaryContent: primaryText.slice(0, PRIMARY_CONTENT_PAYLOAD_LIMIT),
    readableBlocks,
    noiseDiagnostics: snapshot.page.noiseDiagnostics ?? [],
    visualEvidence,
    elementCounts: {
      headings: snapshot.page.headings.length,
      links: snapshot.page.links.length,
      buttons: snapshot.page.buttons.length,
      forms: snapshot.page.forms.length,
      landmarks: snapshot.page.elementLandmarks.length + snapshot.page.landmarks.length,
      codeCandidates: codeCandidates.length,
      readableBlocks: readableBlocks.length,
      visualEvidence: visualEvidence.length,
    },
    diagnostics: collectDiagnostics(snapshot),
    budget: snapshot.budget,
    codeCandidates,
    privacy: snapshot.privacy,
  };
}

export function formatBrowserContextPrompt(
  attachment: BrowserContextPromptAttachment,
): string {
  const title = attachment.title?.trim() || attachment.url;
  const freshness = attachment.freshness ?? (attachment.stale ? "stale" : "fresh");
  const diagnostics = (attachment.diagnostics ?? [])
    .map((diagnostic) => `- ${diagnostic.severity}: ${diagnostic.message}`)
    .join("\n") || "none";
  const candidates = (attachment.codeCandidates ?? [])
    .map(
      (candidate) =>
        `- ${candidate.filePath} (${candidate.reason}, ${candidate.confidence})${candidate.matchedText ? `: ${candidate.matchedText}` : ""}`,
    )
    .join("\n") || "none";
  const readableBlocks = (attachment.readableBlocks ?? [])
    .map((block, index) => `- block ${index + 1} (${block.role}, score=${block.score}, truncated=${block.truncated}): ${block.text}`)
    .join("\n") || "none";
  const visualEvidence = (attachment.visualEvidence ?? [])
    .map((item, index) => `- visual ${index + 1} (${item.kind}, sensitive=${item.sensitive}): ${item.label}${item.altText ? `; alt=${item.altText}` : ""}${item.srcOrigin ? `; origin=${item.srcOrigin}` : ""}${item.nearbyText ? `; nearby=${item.nearbyText}` : ""}`)
    .join("\n") || "none";
  const noiseDiagnostics = (attachment.noiseDiagnostics ?? [])
    .map((diagnostic) => `- ${diagnostic.severity}: ${diagnostic.kind} score=${diagnostic.score}; ${diagnostic.message}`)
    .join("\n") || "none";
  return [
    "<browser_context_v2>",
    `snapshotId: ${attachment.snapshotId}`,
    `source: ${title}`,
    `url: ${attachment.url}`,
    `capturedAt: ${new Date(attachment.capturedAt).toISOString()}`,
    `freshness: ${freshness}`,
    `pageType: ${attachment.pageType ?? "unknown"}`,
    "sourceKind: browser_visible_page_snapshot",
    "usageHint: answer questions about the current page from this browser context first; do not switch to CLI/API/raw fetch unless the user explicitly asks for raw/API data or this context is degraded/insufficient.",
    "imageHint: visualEvidence describes visible images/figures/attachments from the browser page; use labels, alt text, origin, and nearby text as clues, but do not invent unseen image contents.",
    `budget.truncated: ${attachment.budget?.truncated ?? false}`,
    `budget.omittedElementCount: ${attachment.budget?.omittedElementCount ?? 0}`,
    `counts: headings=${attachment.elementCounts?.headings ?? 0}, links=${attachment.elementCounts?.links ?? 0}, buttons=${attachment.elementCounts?.buttons ?? 0}, forms=${attachment.elementCounts?.forms ?? 0}, landmarks=${attachment.elementCounts?.landmarks ?? 0}, readableBlocks=${attachment.elementCounts?.readableBlocks ?? 0}, visualEvidence=${attachment.elementCounts?.visualEvidence ?? 0}, codeCandidates=${attachment.elementCounts?.codeCandidates ?? 0}`,
    "summary:",
    attachment.summary,
    "primaryContent:",
    attachment.primaryContent || attachment.visibleTextExcerpt || attachment.summary || "none",
    "readableBlocks:",
    readableBlocks,
    "visualEvidence:",
    visualEvidence,
    "visibleTextExcerpt:",
    attachment.visibleTextExcerpt || attachment.summary || "none",
    "codeCandidates:",
    candidates,
    "diagnostics:",
    diagnostics,
    "noiseDiagnostics:",
    noiseDiagnostics,
    `privacy.omittedKinds: ${attachment.privacy.omittedKinds.join(", ")}`,
    `privacy.redactedKinds: ${attachment.privacy.redactedKinds.join(", ") || "none"}`,
    "</browser_context_v2>",
  ].join("\n");
}

export function parseBrowserContextPrompt(
  text: string,
): ParsedBrowserContextPromptAttachment | null {
  const match =
    text.match(/<browser_context_v2>\n([\s\S]*?)\n<\/browser_context_v2>/) ??
    text.match(/<browser_context>\n([\s\S]*?)\n<\/browser_context>/);
  if (!match) {
    return null;
  }
  const block = match[1] ?? "";
  const readLine = (key: string) => {
    const line = block.split("\n").find((entry) => entry.startsWith(`${key}: `));
    return line ? line.slice(key.length + 2).trim() : "";
  };
  const readSection = (key: string, nextKeys: string[]) => {
    const start = `${key}:\n`;
    const startIndex = block.indexOf(start);
    if (startIndex < 0) {
      return "";
    }
    const contentStart = startIndex + start.length;
    const rest = block.slice(contentStart);
    const endIndex = nextKeys
      .map((nextKey) => rest.indexOf(`\n${nextKey}:`))
      .filter((index) => index >= 0)
      .sort((left, right) => left - right)[0];
    return (endIndex === undefined ? rest : rest.slice(0, endIndex)).trim();
  };
  const url = readLine("url");
  if (!url) {
    return null;
  }
  const capturedAt = Date.parse(readLine("capturedAt"));
  const summaryText = readSection("summary", ["primaryContent", "visibleTextExcerpt", "privacy.omittedKinds"]);
  const primaryContentText = readSection("primaryContent", ["readableBlocks", "visibleTextExcerpt", "privacy.omittedKinds"]);
  const visibleText = readSection("visibleTextExcerpt", ["codeCandidates", "privacy.omittedKinds"]);
  const readableBlocksText = readSection("readableBlocks", ["visualEvidence", "visibleTextExcerpt"]);
  const visualEvidenceText = readSection("visualEvidence", ["visibleTextExcerpt", "codeCandidates"]);
  const candidatesText = readSection("codeCandidates", ["diagnostics", "privacy.omittedKinds"]);
  const noiseDiagnosticsText = readSection("noiseDiagnostics", ["privacy.omittedKinds", "privacy.redactedKinds"]);
  const readableBlocks = readableBlocksText === "none"
    ? []
    : readableBlocksText
      .split("\n")
      .map((line, index) => {
        const matchLine = line.match(/^- block \d+ \(([^,]+), score=(-?\d+), truncated=(true|false)\): ([\s\S]*)$/);
        if (!matchLine) {
          return null;
        }
        return {
          blockId: `parsed-readable-${index + 1}`,
          role: matchLine[1] as BrowserReadableBlock["role"],
          text: matchLine[4] ?? "",
          score: Number.parseInt(matchLine[2] ?? "0", 10),
          truncated: matchLine[3] === "true",
        };
      })
      .filter((entry): entry is BrowserReadableBlock => Boolean(entry));
  const visualEvidence = visualEvidenceText === "none"
    ? []
    : visualEvidenceText
      .split("\n")
      .flatMap((line, index): BrowserVisualEvidence[] => {
        const matchLine = line.match(/^- visual \d+ \(([^,]+), sensitive=(true|false)\): ([\s\S]*)$/);
        if (!matchLine) {
          return [];
        }
        const payload = matchLine[3] ?? "";
        const markers = ["; alt=", "; origin=", "; nearby="] as const;
        const markerPositions = markers
          .map((marker) => ({ marker, index: payload.indexOf(marker) }))
          .filter((entry) => entry.index >= 0)
          .sort((left, right) => left.index - right.index);
        const labelEnd = markerPositions[0]?.index ?? payload.length;
        const readMarkerValue = (marker: typeof markers[number]) => {
          const current = markerPositions.find((entry) => entry.marker === marker);
          if (!current) {
            return "";
          }
          const next = markerPositions.find((entry) => entry.index > current.index);
          const valueStart = current.index + marker.length;
          const valueEnd = next?.index ?? payload.length;
          return payload.slice(valueStart, valueEnd).trim();
        };
        return [{
          evidenceId: `parsed-visual-${index + 1}`,
          kind: matchLine[1] as BrowserVisualEvidence["kind"],
          label: payload.slice(0, labelEnd).trim(),
          altText: readMarkerValue("; alt=") || null,
          srcOrigin: readMarkerValue("; origin=") || null,
          nearbyText: readMarkerValue("; nearby=") || null,
          visible: true,
          sensitive: matchLine[2] === "true",
        }];
      });
  const codeCandidates = candidatesText === "none"
    ? []
    : candidatesText
      .split("\n")
      .flatMap((line, index): BrowserCodeCandidate[] => {
        const matchLine = line.match(/^- (.+?) \(([^,]+), ([^)]+)\)(?:: ([\s\S]*))?$/);
        if (!matchLine) {
          return [];
        }
        return [{
          candidateId: `parsed-candidate-${index + 1}`,
          filePath: matchLine[1] ?? "",
          reason: matchLine[2] as BrowserCodeCandidate["reason"],
          confidence: matchLine[3] as BrowserCodeCandidate["confidence"],
          matchedText: matchLine[4] ?? null,
        }];
      });
  const noiseDiagnostics = noiseDiagnosticsText === "none"
    ? []
    : noiseDiagnosticsText
      .split("\n")
      .map((line, index) => {
        const matchLine = line.match(/^- (info|warning): ([^\s]+) score=(-?\d+); ([\s\S]*)$/);
        if (!matchLine) {
          return null;
        }
        return {
          diagnosticId: `parsed-noise-${index + 1}`,
          severity: matchLine[1] as BrowserNoiseDiagnostic["severity"],
          kind: matchLine[2] as BrowserNoiseDiagnostic["kind"],
          score: Number.parseInt(matchLine[3] ?? "0", 10),
          message: matchLine[4] ?? "",
        };
      })
      .filter((entry): entry is BrowserNoiseDiagnostic => Boolean(entry));
  const countsText = readLine("counts");
  const countFor = (key: string) => {
    const matchCount = countsText.match(new RegExp(`${key}=(-?\\d+)`));
    return Number.parseInt(matchCount?.[1] ?? "0", 10);
  };
  const state = readLine("freshness") || readLine("state");
  return {
    title: readLine("source") || url,
    url,
    capturedAt: Number.isFinite(capturedAt) ? capturedAt : Date.now(),
    stale: state === "stale" || state === "expired" || state === "degraded",
    summary: summaryText,
    pageType: (readLine("pageType") as BrowserContextAttachment["pageType"]) || "unknown",
    primaryContent: primaryContentText || undefined,
    visibleTextExcerpt: visibleText || undefined,
    readableBlocks,
    visualEvidence,
    noiseDiagnostics,
    codeCandidates,
    elementCounts: {
      headings: countFor("headings"),
      links: countFor("links"),
      buttons: countFor("buttons"),
      forms: countFor("forms"),
      landmarks: countFor("landmarks"),
      codeCandidates: countFor("codeCandidates") || codeCandidates.length,
      readableBlocks: countFor("readableBlocks") || readableBlocks.length,
      visualEvidence: countFor("visualEvidence") || visualEvidence.length,
    },
  };
}

export function stripBrowserContextPrompt(text: string): string {
  return text
    .replace(/<browser_context_v2>\n[\s\S]*?\n<\/browser_context_v2>\n*/g, "")
    .replace(/<browser_context>\n[\s\S]*?\n<\/browser_context>\n*/g, "")
    .trim();
}
