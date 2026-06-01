import type {
  BrowserActionTarget,
  BrowserContentRegion,
  BrowserContextSnapshot,
  BrowserDiagnostic,
  BrowserElementLandmark,
  BrowserFormSummary,
  BrowserLandmark,
  BrowserNetworkSummary,
  BrowserNoiseDiagnostic,
  BrowserPageType,
  BrowserPrimaryContent,
  BrowserPrivacyReport,
  BrowserReadableBlock,
  BrowserSession,
  BrowserSnapshotBudget,
  BrowserTextNode,
  BrowserVisualEvidence,
} from "../types";

const SECRET_PATTERNS = [
  /\b(password|passwd|pwd)\b\s*[:=]\s*[^\s,;]+/gi,
  /\b(token|access_token|refresh_token|api[_-]?key|secret)\b\s*[:=]\s*[^\s,;]+/gi,
  /\b(authorization)\b\s*[:=]\s*bearer\s+[^\s,;]+/gi,
  /\b(cookie)\b\s*[:=]\s*[^\n]+/gi,
];

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_PATTERN = /(?<!\d)(?:\+?\d[\d\s().-]{7,}\d)(?!\d)/g;
const QUERY_SECRET_PATTERN =
  /([?&](?:token|access_token|refresh_token|api[_-]?key|secret|password|authorization)=)[^&#]+/gi;
const MAX_SINGLE_FIELD_CHARS = 640;
const PRIMARY_CONTENT_LIMIT = 6_000;
const READABLE_BLOCK_LIMIT = 2_400;
const VISUAL_NEARBY_TEXT_LIMIT = 900;

export type BrowserSnapshotSanitizationResult = {
  text: string;
  privacy: BrowserPrivacyReport;
};

export type BrowserSnapshotBuilderInput = {
  session: BrowserSession;
  visibleText: string;
  headings?: BrowserTextNode[];
  landmarks?: BrowserLandmark[];
  elementLandmarks?: BrowserElementLandmark[];
  contentRegions?: BrowserContentRegion[];
  links?: BrowserActionTarget[];
  buttons?: BrowserActionTarget[];
  forms?: BrowserFormSummary[];
  pageType?: BrowserPageType;
  primaryContent?: BrowserPrimaryContent | null;
  readableBlocks?: BrowserReadableBlock[];
  noiseDiagnostics?: BrowserNoiseDiagnostic[];
  visualEvidence?: BrowserVisualEvidence[];
  selectedText?: string | null;
  consoleDiagnostics?: BrowserDiagnostic[];
  network?: BrowserNetworkSummary | null;
  captureWarnings?: BrowserDiagnostic[];
  budget?: Partial<BrowserSnapshotBudget>;
};

function defaultBudget(): BrowserSnapshotBudget {
  return {
    charLimit: 12_000,
    visibleTextLimit: 8_000,
    elementLimit: 120,
    formFieldLimit: 80,
    diagnosticLimit: 50,
    tokenEstimate: null,
    truncated: false,
    omittedElementCount: 0,
  };
}

function createPrivacyReport(): BrowserPrivacyReport {
  return {
    redactionApplied: false,
    redactedKinds: [],
    omittedKinds: ["raw_dom", "cookies", "headers", "scripts", "styles", "hidden_nodes"],
  };
}

function addRedactionKind(
  privacy: BrowserPrivacyReport,
  kind: BrowserPrivacyReport["redactedKinds"][number],
): void {
  privacy.redactionApplied = true;
  if (!privacy.redactedKinds.includes(kind)) {
    privacy.redactedKinds.push(kind);
  }
}

export function sanitizeBrowserSnapshotText(
  value: string | null | undefined,
): BrowserSnapshotSanitizationResult {
  const privacy = createPrivacyReport();
  let text = String(value ?? "");

  for (const pattern of SECRET_PATTERNS) {
    text = text.replace(pattern, (match) => {
      const key = match.split(/[:=]/)[0]?.trim().toLowerCase() ?? "secret";
      if (key.includes("cookie")) {
        addRedactionKind(privacy, "cookie");
      } else if (key.includes("authorization")) {
        addRedactionKind(privacy, "authorization");
      } else if (key.includes("password") || key.includes("passwd") || key.includes("pwd")) {
        addRedactionKind(privacy, "password");
      } else {
        addRedactionKind(privacy, "token");
      }
      return `${key}: [redacted]`;
    });
  }

  text = text.replace(EMAIL_PATTERN, () => {
    addRedactionKind(privacy, "email");
    return "[redacted-email]";
  });
  text = text.replace(PHONE_PATTERN, () => {
    addRedactionKind(privacy, "phone");
    return "[redacted-phone]";
  });
  text = text.replace(QUERY_SECRET_PATTERN, (_match, prefix: string) => {
    addRedactionKind(privacy, "token");
    return `${prefix}[redacted]`;
  });

  return { text, privacy };
}

function mergePrivacyReports(
  base: BrowserPrivacyReport,
  next: BrowserPrivacyReport,
): BrowserPrivacyReport {
  const redactedKinds = [...base.redactedKinds];
  for (const kind of next.redactedKinds) {
    if (!redactedKinds.includes(kind)) {
      redactedKinds.push(kind);
    }
  }
  const omittedKinds = [...base.omittedKinds];
  for (const kind of next.omittedKinds) {
    if (!omittedKinds.includes(kind)) {
      omittedKinds.push(kind);
    }
  }
  return {
    redactionApplied: base.redactionApplied || next.redactionApplied,
    redactedKinds,
    omittedKinds,
  };
}

function trimField(value: string): string {
  return value.slice(0, MAX_SINGLE_FIELD_CHARS);
}

function trimTo(value: string, limit: number): string {
  return value.slice(0, Math.max(0, limit));
}

function sanitizeTextNode(node: BrowserTextNode): {
  node: BrowserTextNode;
  privacy: BrowserPrivacyReport;
} {
  const sanitized = sanitizeBrowserSnapshotText(node.text);
  return {
    node: {
      ...node,
      text: trimField(sanitized.text),
      truncated: node.truncated || sanitized.text.length > MAX_SINGLE_FIELD_CHARS,
    },
    privacy: sanitized.privacy,
  };
}

function sanitizeTarget(target: BrowserActionTarget): {
  target: BrowserActionTarget;
  privacy: BrowserPrivacyReport;
} {
  let privacy = createPrivacyReport();
  const sensitiveName = [target.label, target.accessibleName, target.placeholder, target.href]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const sensitive =
    target.sensitive ||
    target.kind === "input" ||
    /\b(password|passwd|pwd|token|secret|authorization|api[_-]?key)\b/.test(sensitiveName);
  const label = sanitizeBrowserSnapshotText(target.label);
  const accessibleName = sanitizeBrowserSnapshotText(target.accessibleName);
  const text = sanitizeBrowserSnapshotText(target.text);
  const href = sanitizeBrowserSnapshotText(target.href);
  const placeholder = sanitizeBrowserSnapshotText(target.placeholder);
  const valuePreview = sanitizeBrowserSnapshotText(target.valuePreview);
  privacy = mergePrivacyReports(privacy, label.privacy);
  privacy = mergePrivacyReports(privacy, accessibleName.privacy);
  privacy = mergePrivacyReports(privacy, text.privacy);
  privacy = mergePrivacyReports(privacy, href.privacy);
  privacy = mergePrivacyReports(privacy, placeholder.privacy);
  privacy = mergePrivacyReports(privacy, valuePreview.privacy);
  if (sensitive) {
    addRedactionKind(privacy, target.kind === "input" ? "hidden_input" : "secret_like");
  }
  return {
    target: {
      ...target,
      label: trimField(label.text),
      accessibleName: accessibleName.text ? trimField(accessibleName.text) : target.accessibleName,
      text: text.text ? trimField(text.text) : target.text,
      href: href.text ? trimField(href.text) : target.href,
      placeholder: placeholder.text ? trimField(placeholder.text) : target.placeholder,
      valuePreview: sensitive
        ? target.valuePreview ? "[redacted]" : target.valuePreview
        : valuePreview.text
          ? trimField(valuePreview.text)
          : target.valuePreview,
      sensitive,
    },
    privacy,
  };
}

function limitItems<T>(items: T[] | undefined, limit: number): T[] {
  return (items ?? []).slice(0, Math.max(0, limit));
}

function sanitizeLandmark(landmark: BrowserLandmark): {
  landmark: BrowserLandmark;
  privacy: BrowserPrivacyReport;
} {
  const label = sanitizeBrowserSnapshotText(landmark.label);
  const textPreview = sanitizeBrowserSnapshotText(landmark.textPreview);
  return {
    landmark: {
      ...landmark,
      label: trimField(label.text),
      textPreview: textPreview.text ? trimField(textPreview.text) : landmark.textPreview,
    },
    privacy: mergePrivacyReports(label.privacy, textPreview.privacy),
  };
}

function sanitizeElementLandmark(landmark: BrowserElementLandmark): {
  landmark: BrowserElementLandmark;
  privacy: BrowserPrivacyReport;
} {
  const asTarget = sanitizeTarget({
    targetId: landmark.landmarkId,
    kind:
      landmark.role === "link"
        ? "link"
        : landmark.role === "button"
          ? "button"
          : landmark.role === "textarea"
            ? "textarea"
            : landmark.role === "select"
              ? "select"
              : landmark.role === "input"
                ? "input"
                : "other",
    label: landmark.label,
    text: landmark.textPreview ?? null,
    href: landmark.href ?? null,
    placeholder: landmark.placeholder ?? null,
    valuePreview: null,
    disabled: !landmark.enabled,
    visible: landmark.visible,
    sensitive: landmark.sensitive,
    bounds: landmark.bounds ?? null,
  });
  return {
    landmark: {
      ...landmark,
      label: asTarget.target.label,
      textPreview: asTarget.target.text ?? landmark.textPreview,
      href: asTarget.target.href ?? landmark.href,
      placeholder: asTarget.target.placeholder ?? landmark.placeholder,
      sensitive: asTarget.target.sensitive,
    },
    privacy: asTarget.privacy,
  };
}

function sanitizeContentRegion(region: BrowserContentRegion): {
  region: BrowserContentRegion;
  privacy: BrowserPrivacyReport;
} {
  const label = sanitizeBrowserSnapshotText(region.label);
  const textPreview = sanitizeBrowserSnapshotText(region.textPreview);
  return {
    region: {
      ...region,
      label: trimField(label.text),
      textPreview: trimField(textPreview.text),
      truncated: region.truncated || textPreview.text.length > MAX_SINGLE_FIELD_CHARS,
    },
    privacy: mergePrivacyReports(label.privacy, textPreview.privacy),
  };
}

function sanitizePrimaryContent(content: BrowserPrimaryContent | null | undefined): {
  content: BrowserPrimaryContent | null;
  privacy: BrowserPrivacyReport;
} {
  if (!content) {
    return { content: null, privacy: createPrivacyReport() };
  }
  const text = sanitizeBrowserSnapshotText(content.text);
  return {
    content: {
      ...content,
      text: trimTo(text.text, PRIMARY_CONTENT_LIMIT),
      truncated: content.truncated || text.text.length > PRIMARY_CONTENT_LIMIT,
    },
    privacy: text.privacy,
  };
}

function sanitizeReadableBlock(block: BrowserReadableBlock): {
  block: BrowserReadableBlock;
  privacy: BrowserPrivacyReport;
} {
  const text = sanitizeBrowserSnapshotText(block.text);
  return {
    block: {
      ...block,
      text: trimTo(text.text, READABLE_BLOCK_LIMIT),
      truncated: block.truncated || text.text.length > READABLE_BLOCK_LIMIT,
    },
    privacy: text.privacy,
  };
}

function sanitizeNoiseDiagnostic(diagnostic: BrowserNoiseDiagnostic): {
  diagnostic: BrowserNoiseDiagnostic;
  privacy: BrowserPrivacyReport;
} {
  const message = sanitizeBrowserSnapshotText(diagnostic.message);
  return {
    diagnostic: {
      ...diagnostic,
      message: trimField(message.text),
    },
    privacy: message.privacy,
  };
}

function sanitizeVisualEvidence(item: BrowserVisualEvidence): {
  item: BrowserVisualEvidence;
  privacy: BrowserPrivacyReport;
} {
  let privacy = createPrivacyReport();
  const label = sanitizeBrowserSnapshotText(item.label);
  const altText = sanitizeBrowserSnapshotText(item.altText);
  const srcOrigin = sanitizeBrowserSnapshotText(item.srcOrigin);
  const nearbyText = sanitizeBrowserSnapshotText(item.nearbyText);
  privacy = mergePrivacyReports(privacy, label.privacy);
  privacy = mergePrivacyReports(privacy, altText.privacy);
  privacy = mergePrivacyReports(privacy, srcOrigin.privacy);
  privacy = mergePrivacyReports(privacy, nearbyText.privacy);
  const sensitive = item.sensitive || privacy.redactionApplied;
  if (sensitive) {
    addRedactionKind(privacy, "secret_like");
  }
  return {
    item: {
      ...item,
      label: trimField(label.text),
      altText: altText.text ? trimField(altText.text) : item.altText,
      srcOrigin: srcOrigin.text ? trimField(srcOrigin.text) : item.srcOrigin,
      nearbyText: sensitive
        ? item.nearbyText ? "[redacted]" : item.nearbyText
        : nearbyText.text
          ? trimTo(nearbyText.text, VISUAL_NEARBY_TEXT_LIMIT)
          : item.nearbyText,
      sensitive,
    },
    privacy,
  };
}

function sanitizeDiagnostic(diagnostic: BrowserDiagnostic): {
  diagnostic: BrowserDiagnostic;
  privacy: BrowserPrivacyReport;
} {
  const message = sanitizeBrowserSnapshotText(diagnostic.message);
  const source = sanitizeBrowserSnapshotText(diagnostic.source);
  return {
    diagnostic: {
      ...diagnostic,
      message: trimField(message.text),
      source: source.text ? trimField(source.text) : diagnostic.source,
      redacted:
        diagnostic.redacted ||
        message.privacy.redactionApplied ||
        source.privacy.redactionApplied,
    },
    privacy: mergePrivacyReports(message.privacy, source.privacy),
  };
}

function sanitizeForm(form: BrowserFormSummary, fieldLimit: number): {
  form: BrowserFormSummary;
  privacy: BrowserPrivacyReport;
} {
  let privacy = createPrivacyReport();
  const label = sanitizeBrowserSnapshotText(form.label);
  const actionOrigin = sanitizeBrowserSnapshotText(form.actionOrigin);
  privacy = mergePrivacyReports(privacy, label.privacy);
  privacy = mergePrivacyReports(privacy, actionOrigin.privacy);
  const fields = limitItems(form.fields, fieldLimit).map((field) => {
    const sanitized = sanitizeTarget(field);
    privacy = mergePrivacyReports(privacy, sanitized.privacy);
    return sanitized.target;
  });
  const submitTargets = limitItems(form.submitTargets, fieldLimit).map((target) => {
    const sanitized = sanitizeTarget(target);
    privacy = mergePrivacyReports(privacy, sanitized.privacy);
    return sanitized.target;
  });
  return {
    form: {
      ...form,
      label: trimField(label.text),
      actionOrigin: actionOrigin.text ? trimField(actionOrigin.text) : form.actionOrigin,
      fields,
      submitTargets,
      sensitive: form.sensitive || fields.some((field) => field.sensitive),
    },
    privacy,
  };
}

export function buildBrowserContextSnapshot(
  input: BrowserSnapshotBuilderInput,
): BrowserContextSnapshot {
  const budget = { ...defaultBudget(), ...input.budget };
  const visibleText = sanitizeBrowserSnapshotText(input.visibleText);
  let privacy = visibleText.privacy;

  const headings = limitItems(input.headings, budget.elementLimit).map((heading) => {
    const sanitized = sanitizeTextNode(heading);
    privacy = mergePrivacyReports(privacy, sanitized.privacy);
    return sanitized.node;
  });

  const sanitizeTargets = (targets: BrowserActionTarget[] | undefined) =>
    limitItems(targets, budget.elementLimit).map((target) => {
      const sanitized = sanitizeTarget(target);
      privacy = mergePrivacyReports(privacy, sanitized.privacy);
      return sanitized.target;
    });

  const landmarks = limitItems(input.landmarks, budget.elementLimit).map((landmark) => {
    const sanitized = sanitizeLandmark(landmark);
    privacy = mergePrivacyReports(privacy, sanitized.privacy);
    return sanitized.landmark;
  });

  const elementLandmarks = limitItems(input.elementLandmarks, budget.elementLimit).map((landmark) => {
    const sanitized = sanitizeElementLandmark(landmark);
    privacy = mergePrivacyReports(privacy, sanitized.privacy);
    return sanitized.landmark;
  });

  const contentRegions = limitItems(input.contentRegions, budget.elementLimit).map((region) => {
    const sanitized = sanitizeContentRegion(region);
    privacy = mergePrivacyReports(privacy, sanitized.privacy);
    return sanitized.region;
  });

  const primaryContentResult = sanitizePrimaryContent(input.primaryContent);
  privacy = mergePrivacyReports(privacy, primaryContentResult.privacy);

  const readableBlocks = limitItems(input.readableBlocks, 12).map((block) => {
    const sanitized = sanitizeReadableBlock(block);
    privacy = mergePrivacyReports(privacy, sanitized.privacy);
    return sanitized.block;
  });

  const noiseDiagnostics = limitItems(input.noiseDiagnostics, budget.diagnosticLimit).map((diagnostic) => {
    const sanitized = sanitizeNoiseDiagnostic(diagnostic);
    privacy = mergePrivacyReports(privacy, sanitized.privacy);
    return sanitized.diagnostic;
  });

  const visualEvidence = limitItems(input.visualEvidence, 20).map((item) => {
    const sanitized = sanitizeVisualEvidence(item);
    privacy = mergePrivacyReports(privacy, sanitized.privacy);
    return sanitized.item;
  });

  const forms = limitItems(input.forms, budget.formFieldLimit).map((form) => {
    const sanitized = sanitizeForm(form, budget.formFieldLimit);
    privacy = mergePrivacyReports(privacy, sanitized.privacy);
    return sanitized.form;
  });

  const selectedText = sanitizeBrowserSnapshotText(input.selectedText);
  privacy = mergePrivacyReports(privacy, selectedText.privacy);

  const consoleDiagnostics = limitItems(input.consoleDiagnostics, budget.diagnosticLimit).map((diagnostic) => {
    const sanitized = sanitizeDiagnostic(diagnostic);
    privacy = mergePrivacyReports(privacy, sanitized.privacy);
    return sanitized.diagnostic;
  });
  const captureWarnings = limitItems(input.captureWarnings, budget.diagnosticLimit).map((diagnostic) => {
    const sanitized = sanitizeDiagnostic(diagnostic);
    privacy = mergePrivacyReports(privacy, sanitized.privacy);
    return sanitized.diagnostic;
  });

  const links = sanitizeTargets(input.links);
  const buttons = sanitizeTargets(input.buttons);
  const truncatedText = visibleText.text.length > budget.visibleTextLimit;
  const omittedElementCount =
    Math.max(0, (input.headings?.length ?? 0) - headings.length) +
    Math.max(0, (input.landmarks?.length ?? 0) - landmarks.length) +
    Math.max(0, (input.elementLandmarks?.length ?? 0) - elementLandmarks.length) +
    Math.max(0, (input.contentRegions?.length ?? 0) - contentRegions.length) +
    Math.max(0, (input.readableBlocks?.length ?? 0) - readableBlocks.length) +
    Math.max(0, (input.visualEvidence?.length ?? 0) - visualEvidence.length) +
    Math.max(0, (input.links?.length ?? 0) - links.length) +
    Math.max(0, (input.buttons?.length ?? 0) - buttons.length) +
    Math.max(0, (input.forms?.length ?? 0) - forms.length);
  const resolvedBudget = {
    ...budget,
    truncated: budget.truncated || truncatedText || omittedElementCount > 0,
    omittedElementCount: budget.omittedElementCount + omittedElementCount,
  };

  return {
    snapshotId: `browser-snapshot-${Date.now()}`,
    browserSessionId: input.session.browserSessionId,
    workspaceId: input.session.workspaceId,
    capturedAt: Date.now(),
    freshness: "fresh",
    source: {
      url: input.session.url,
      normalizedUrl: input.session.normalizedUrl,
      title: input.session.title,
      origin: input.session.origin,
      tabLabel: input.session.label,
      captureReason: "manual_attach",
      workspaceLocalAllowed: false,
    },
    viewport: {
      width: null,
      height: null,
      scrollX: null,
      scrollY: null,
      scrollHeight: null,
      scrollWidth: null,
      devicePixelRatio: null,
    },
    page: {
      visibleText: visibleText.text.slice(0, budget.visibleTextLimit),
      pageType: input.pageType ?? "unknown",
      primaryContent: primaryContentResult.content,
      readableBlocks,
      noiseDiagnostics,
      visualEvidence,
      textTruncated: truncatedText,
      headings,
      landmarks,
      elementLandmarks,
      contentRegions,
      links,
      buttons,
      forms,
      selectedText: selectedText.text || null,
      languageHint: null,
    },
    codeCandidates: [],
    diagnostics: {
      console: consoleDiagnostics,
      network: input.network ?? null,
      captureWarnings,
    },
    evidence: {
      screenshotRef: null,
      htmlExcerptRef: null,
    },
    privacy,
    budget: resolvedBudget,
    availability: "available",
  };
}
