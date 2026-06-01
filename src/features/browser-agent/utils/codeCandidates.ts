import type {
  BrowserCodeCandidate,
  BrowserContextSnapshot,
  BrowserElementLandmark,
} from "../types";

const MAX_CANDIDATES = 12;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export type BrowserCodeCandidateInput = {
  snapshot: BrowserContextSnapshot;
  workspacePath?: string | null;
  workspaceFiles?: string[];
};

function isLocalSnapshot(snapshot: BrowserContextSnapshot): boolean {
  try {
    const url = new URL(snapshot.source.normalizedUrl);
    return LOCAL_HOSTS.has(url.hostname) || url.hostname.startsWith("127.");
  } catch {
    return false;
  }
}

function routeSegments(pathname: string): string[] {
  return pathname
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .filter((segment) => !/^\d+$/.test(segment));
}

function candidateId(filePath: string, reason: BrowserCodeCandidate["reason"]): string {
  return `${reason}:${filePath}`;
}

function routeCandidatePaths(pathname: string): string[] {
  const segments = routeSegments(pathname);
  if (segments.length === 0) {
    return ["src/App.tsx", "src/main.tsx", "src/routes/index.tsx"];
  }
  const route = segments.join("/");
  const leaf = segments[segments.length - 1] ?? route;
  return [
    `src/pages/${route}.tsx`,
    `src/pages/${route}/index.tsx`,
    `src/routes/${route}.tsx`,
    `src/routes/${route}/index.tsx`,
    `src/app/${route}/page.tsx`,
    `src/features/${leaf}/components/${leaf}.tsx`,
  ];
}

function matchWorkspaceFiles(candidates: string[], workspaceFiles: string[]): string[] {
  if (workspaceFiles.length === 0) {
    return candidates;
  }
  const normalizedFiles = new Set(workspaceFiles.map((file) => file.replace(/\\/g, "/")));
  return candidates.filter((candidate) => normalizedFiles.has(candidate));
}

function textNeedles(snapshot: BrowserContextSnapshot): string[] {
  const headings = snapshot.page.headings.map((heading) => heading.text);
  const buttons = snapshot.page.buttons.map((button) => button.label);
  const landmarks = snapshot.page.elementLandmarks.map((landmark) => landmark.label);
  return [...headings, ...buttons, ...landmarks]
    .map((value) => value.replace(/\s+/g, " ").trim())
    .filter((value) => value.length >= 4)
    .slice(0, 8);
}

function landmarkCandidates(landmarks: BrowserElementLandmark[]): BrowserCodeCandidate[] {
  return landmarks
    .filter((landmark) => landmark.role === "button" || landmark.role === "form" || landmark.role === "input")
    .slice(0, 4)
    .map((landmark) => ({
      candidateId: candidateId(`src/**/*${landmark.label.slice(0, 24)}*`, "landmark_match"),
      filePath: "src/**",
      symbolName: null,
      reason: "landmark_match",
      confidence: "low",
      matchedText: landmark.label,
    }));
}

export function buildBrowserCodeCandidates(
  input: BrowserCodeCandidateInput,
): BrowserCodeCandidate[] {
  const { snapshot, workspaceFiles = [] } = input;
  if (!isLocalSnapshot(snapshot)) {
    return [];
  }

  let pathname = "/";
  try {
    pathname = new URL(snapshot.source.normalizedUrl).pathname || "/";
  } catch {
    pathname = "/";
  }

  const routeMatches = matchWorkspaceFiles(routeCandidatePaths(pathname), workspaceFiles).map(
    (filePath) => ({
      candidateId: candidateId(filePath, "route_match"),
      filePath,
      symbolName: null,
      reason: "route_match" as const,
      confidence: workspaceFiles.length > 0 ? "medium" as const : "low" as const,
      matchedText: pathname,
    }),
  );

  const visibleTextMatches = textNeedles(snapshot).map((needle) => ({
    candidateId: candidateId(`src/**:${needle}`, "visible_text_match"),
    filePath: "src/**",
    symbolName: null,
    reason: "visible_text_match" as const,
    confidence: "low" as const,
    matchedText: needle,
  }));

  const byId = new Map<string, BrowserCodeCandidate>();
  for (const candidate of [
    ...routeMatches,
    ...visibleTextMatches,
    ...landmarkCandidates(snapshot.page.elementLandmarks),
  ]) {
    if (!byId.has(candidate.candidateId)) {
      byId.set(candidate.candidateId, candidate);
    }
  }
  return Array.from(byId.values()).slice(0, MAX_CANDIDATES);
}
