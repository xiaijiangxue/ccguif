import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { EditorView, keymap } from "@codemirror/view";
import { closeSearchPanel, openSearchPanel, searchPanelOpen } from "@codemirror/search";
import type { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { openSearchWithReplace } from "../search-panel";
import {
  getCodeIntelDefinition,
  getCodeIntelReferences,
  getJdtlsDefinition,
  getJdtlsDidOpen,
  getJdtlsImplementation,
  getJdtlsReferences,
} from "../../../services/tauri";
import {
  isAbsoluteFsPath,
  normalizeFsPath,
  resolveWorkspaceRelativePath,
} from "../../../utils/workspacePaths";
import { lspPositionToEditorLocation, offsetToLspPosition } from "../utils/lspPosition";
import {
  areFileUrisEquivalent,
  CODE_INTEL_REPEAT_DEBOUNCE_MS,
  createLocationCacheEntry,
  errorMessageFromUnknown,
  extractLocations,
  filterOriginReferenceLocation,
  makeLocationQueryKey,
  NAVIGATION_REQUEST_TIMEOUT_MS,
  normalizeJdtlsLocations,
  readFreshCache,
  relativePathFromFileUri,
  toFileUri,
  type LocationCacheEntry,
  type LspLocationLike,
  type NavigationSource,
  type RecentTrigger,
  withTimeout,
} from "../utils/fileViewNavigationUtils";
import type { JdtlsProviderState } from "./useJdtlsState";

export function isJavaFile(path: string) {
  return path.toLowerCase().endsWith(".java");
}

export function isXmlMapperFile(path: string) {
  const lower = path.toLowerCase();
  return lower.endsWith(".xml") && lower.includes("mapper");
}

export function isMapperInterface(path: string, content?: string | null) {
  if (!isJavaFile(path) || !content) {
    return false;
  }
  return /@\s*Mapper\b/.test(content) || /\bextends\s+BaseMapper\s*</.test(content);
}

type UseFileNavigationArgs = {
  workspaceId: string;
  workspacePath: string;
  filePath: string;
  absolutePath: string;
  fileContent: string | null;
  jdtlsStatus: JdtlsProviderState["status"];
  caseInsensitivePathCompare: boolean;
  isSameWorkspacePath: (leftPath: string, rightPath: string) => boolean;
  navigationTarget: {
    path: string;
    line: number;
    column: number;
    requestId: number;
  } | null;
  isLoading: boolean;
  t: (key: string) => string;
  onNavigateToLocation?: (
    path: string,
    location: { line: number; column: number },
  ) => void;
  setMode: (mode: "edit") => void;
  cmRef: RefObject<ReactCodeMirrorRef | null>;
};

export function useFileNavigation({
  workspaceId,
  workspacePath,
  filePath,
  absolutePath,
  fileContent,
  jdtlsStatus,
  caseInsensitivePathCompare,
  isSameWorkspacePath,
  navigationTarget,
  isLoading,
  t,
  onNavigateToLocation,
  setMode,
  cmRef,
}: UseFileNavigationArgs) {
  const [isDefinitionLoading, setIsDefinitionLoading] = useState(false);
  const [isReferencesLoading, setIsReferencesLoading] = useState(false);
  const [isImplementationLoading, setIsImplementationLoading] = useState(false);
  const [navigationError, setNavigationError] = useState<string | null>(null);
  const [definitionCandidates, setDefinitionCandidates] = useState<LspLocationLike[]>([]);
  const [implementationCandidates, setImplementationCandidates] = useState<LspLocationLike[]>([]);
  const [referenceResults, setReferenceResults] = useState<LspLocationLike[] | null>(null);
  const lspRequestIdRef = useRef(0);
  const definitionCacheRef = useRef<Map<string, LocationCacheEntry>>(new Map());
  const referencesCacheRef = useRef<Map<string, LocationCacheEntry>>(new Map());
  const recentDefinitionTriggerRef = useRef<RecentTrigger | null>(null);
  const recentReferencesTriggerRef = useRef<RecentTrigger | null>(null);
  const recentImplementationTriggerRef = useRef<RecentTrigger | null>(null);
  const appliedNavigationRequestRef = useRef(0);
  const navigationFocusTimerRef = useRef<number | null>(null);
  const currentFileUri = useMemo(() => toFileUri(absolutePath), [absolutePath]);

  const shouldTryJdtls = isJavaFile(filePath) && jdtlsStatus !== "unavailable" && jdtlsStatus !== "unknown";

  const syncCurrentJavaDocument = useCallback(async () => {
    if (!shouldTryJdtls || fileContent === null) {
      return;
    }
    await getJdtlsDidOpen(workspaceId, { filePath, content: fileContent });
  }, [fileContent, filePath, shouldTryJdtls, workspaceId]);

  const getFallbackDefinitionLocations = useCallback(
    async (position: { line: number; character: number }) => {
      const response = await getCodeIntelDefinition(workspaceId, {
        filePath,
        line: position.line,
        character: position.character,
      });
      return extractLocations(response.result);
    },
    [filePath, workspaceId],
  );

  const getFallbackReferenceLocations = useCallback(
    async (position: { line: number; character: number }) => {
      const response = await getCodeIntelReferences(workspaceId, {
        filePath,
        line: position.line,
        character: position.character,
      });
      return extractLocations(response.result);
    },
    [filePath, workspaceId],
  );

  const resolveDefinitionLocations = useCallback(
    async (position: { line: number; character: number }): Promise<{ locations: LspLocationLike[]; source: NavigationSource }> => {
      if (shouldTryJdtls) {
        try {
          await syncCurrentJavaDocument();
          const response = await getJdtlsDefinition(workspaceId, {
            filePath,
            line: position.line,
            character: position.character,
          });
          const locations = normalizeJdtlsLocations(response);
          if (locations.length > 0) {
            return { locations, source: "semantic" };
          }
        } catch (error) {
          if (jdtlsStatus === "ready") {
            setNavigationError(errorMessageFromUnknown(error, t("files.navigationError")));
          }
        }
      }
      return {
        locations: await getFallbackDefinitionLocations(position),
        source: "fallback",
      };
    },
    [
      filePath,
      getFallbackDefinitionLocations,
      jdtlsStatus,
      shouldTryJdtls,
      syncCurrentJavaDocument,
      t,
      workspaceId,
    ],
  );

  const resolveReferenceLocations = useCallback(
    async (position: { line: number; character: number }): Promise<{ locations: LspLocationLike[]; source: NavigationSource }> => {
      if (shouldTryJdtls) {
        try {
          await syncCurrentJavaDocument();
          const response = await getJdtlsReferences(workspaceId, {
            filePath,
            line: position.line,
            character: position.character,
          });
          const locations = normalizeJdtlsLocations(response);
          if (locations.length > 0) {
            return { locations, source: "semantic" };
          }
        } catch (error) {
          if (jdtlsStatus === "ready") {
            setNavigationError(errorMessageFromUnknown(error, t("files.navigationError")));
          }
        }
      }
      return {
        locations: await getFallbackReferenceLocations(position),
        source: "fallback",
      };
    },
    [
      filePath,
      getFallbackReferenceLocations,
      jdtlsStatus,
      shouldTryJdtls,
      syncCurrentJavaDocument,
      t,
      workspaceId,
    ],
  );

  const resolveImplementationLocations = useCallback(
    async (position: { line: number; character: number }): Promise<LspLocationLike[]> => {
      if (!shouldTryJdtls) {
        return [];
      }
      await syncCurrentJavaDocument();
      const response = await getJdtlsImplementation(workspaceId, {
        filePath,
        line: position.line,
        character: position.character,
      });
      return normalizeJdtlsLocations(response);
    },
    [filePath, shouldTryJdtls, syncCurrentJavaDocument, workspaceId],
  );

  const clearNavigationFocusTimer = useCallback(() => {
    if (navigationFocusTimerRef.current !== null) {
      window.clearTimeout(navigationFocusTimerRef.current);
      navigationFocusTimerRef.current = null;
    }
  }, []);

  const focusEditorAtLocation = useCallback((line: number, column: number) => {
    const view = cmRef.current?.view;
    if (!view) {
      return false;
    }
    if (line < 1 || line > view.state.doc.lines) {
      return false;
    }
    const lineInfo = view.state.doc.line(line);
    const safeColumn = Math.max(1, Math.min(column, lineInfo.length + 1));
    const anchor = lineInfo.from + safeColumn - 1;
    view.dispatch({
      selection: { anchor },
      scrollIntoView: true,
    });
    view.focus();
    return true;
  }, [cmRef]);

  const focusEditorAtLocationWithRetry = useCallback(
    (
      line: number,
      column: number,
      attempt = 0,
      onFocused?: () => void,
    ) => {
      const focused = focusEditorAtLocation(line, column);
      if (focused && attempt >= 4) {
        clearNavigationFocusTimer();
        onFocused?.();
        return;
      }
      if (attempt >= 12) {
        clearNavigationFocusTimer();
        return;
      }
      clearNavigationFocusTimer();
      navigationFocusTimerRef.current = window.setTimeout(() => {
        focusEditorAtLocationWithRetry(line, column, attempt + 1, onFocused);
      }, 16);
    },
    [clearNavigationFocusTimer, focusEditorAtLocation],
  );

  const navigateToLocation = useCallback(
    (location: LspLocationLike) => {
      const relativePathFromUri = relativePathFromFileUri(location.uri, workspacePath);
      const relativePathFromLocation =
        typeof location.path === "string" && location.path.trim().length > 0
          ? resolveWorkspaceRelativePath(
              workspacePath,
              normalizeFsPath(location.path.trim()),
            )
          : null;
      const relativePath =
        relativePathFromLocation && !isAbsoluteFsPath(relativePathFromLocation)
          ? relativePathFromLocation
          : relativePathFromUri;
      const { line, column } = lspPositionToEditorLocation({
        line: location.line,
        character: location.character,
      });

      if (relativePath && onNavigateToLocation) {
        onNavigateToLocation(relativePath, { line, column });
        return;
      }

      const hitsCurrentFileByPath =
        (relativePath && isSameWorkspacePath(relativePath, filePath)) ||
        (relativePathFromUri && isSameWorkspacePath(relativePathFromUri, filePath));
      if (
        hitsCurrentFileByPath ||
        areFileUrisEquivalent(
          location.uri,
          currentFileUri,
          caseInsensitivePathCompare,
        )
      ) {
        setMode("edit");
        focusEditorAtLocationWithRetry(line, column);
      }
    },
    [
      caseInsensitivePathCompare,
      currentFileUri,
      filePath,
      focusEditorAtLocationWithRetry,
      isSameWorkspacePath,
      onNavigateToLocation,
      setMode,
      workspacePath,
    ],
  );

  const resolveDefinitionAtOffset = useCallback(
    async (offset: number, view?: EditorView) => {
      const editorView = view ?? cmRef.current?.view;
      if (!editorView) {
        return;
      }
      const position = offsetToLspPosition(editorView.state.doc, offset);
      const queryKey = makeLocationQueryKey(
        filePath,
        position.line,
        position.character,
      );
      const now = Date.now();
      const recentTrigger = recentDefinitionTriggerRef.current;
      if (
        recentTrigger &&
        recentTrigger.key === queryKey &&
        now - recentTrigger.at < CODE_INTEL_REPEAT_DEBOUNCE_MS
      ) {
        return;
      }
      recentDefinitionTriggerRef.current = { key: queryKey, at: now };
      const requestId = lspRequestIdRef.current + 1;
      lspRequestIdRef.current = requestId;
      setNavigationError(null);
      setDefinitionCandidates([]);
      const cachedEntry = readFreshCache(definitionCacheRef.current, queryKey);
      if (cachedEntry) {
        const cachedLocations = cachedEntry.value;
        setIsDefinitionLoading(false);
        if (cachedLocations.length === 0) {
          setNavigationError(t("files.navigationNoDefinition"));
          return;
        }
        if (cachedLocations.length === 1) {
          const onlyLocation = cachedLocations[0];
          if (onlyLocation) {
            navigateToLocation(onlyLocation);
          }
          return;
        }
        setDefinitionCandidates(cachedLocations);
        return;
      }
      setIsDefinitionLoading(true);
      try {
        const { locations, source } = await withTimeout(
          resolveDefinitionLocations(position),
          NAVIGATION_REQUEST_TIMEOUT_MS,
          t("files.navigationTimeout"),
        );
        if (requestId !== lspRequestIdRef.current) {
          return;
        }
        definitionCacheRef.current.set(queryKey, createLocationCacheEntry(locations, source));
        if (locations.length === 0) {
          setNavigationError(t("files.navigationNoDefinition"));
          return;
        }
        if (locations.length === 1) {
          const onlyLocation = locations[0];
          if (onlyLocation) {
            navigateToLocation(onlyLocation);
          }
          return;
        }
        setDefinitionCandidates(locations);
      } catch (error) {
        if (requestId !== lspRequestIdRef.current) {
          return;
        }
        setNavigationError(errorMessageFromUnknown(error, t("files.navigationError")));
      } finally {
        if (requestId === lspRequestIdRef.current) {
          setIsDefinitionLoading(false);
        }
      }
    },
    [cmRef, filePath, navigateToLocation, resolveDefinitionLocations, t],
  );

  const findReferencesAtOffset = useCallback(
    async (offset: number) => {
      const editorView = cmRef.current?.view;
      if (!editorView) {
        return;
      }
      const position = offsetToLspPosition(editorView.state.doc, offset);
      const queryKey = makeLocationQueryKey(
        filePath,
        position.line,
        position.character,
        false,
      );
      const now = Date.now();
      const recentTrigger = recentReferencesTriggerRef.current;
      if (
        recentTrigger &&
        recentTrigger.key === queryKey &&
        now - recentTrigger.at < CODE_INTEL_REPEAT_DEBOUNCE_MS
      ) {
        return;
      }
      recentReferencesTriggerRef.current = { key: queryKey, at: now };
      const requestId = lspRequestIdRef.current + 1;
      lspRequestIdRef.current = requestId;
      setNavigationError(null);
      setReferenceResults(null);
      const cachedEntry = readFreshCache(referencesCacheRef.current, queryKey);
      if (cachedEntry) {
        setIsReferencesLoading(false);
        setReferenceResults(cachedEntry.value);
        return;
      }
      setIsReferencesLoading(true);
      try {
        const { locations, source } = await withTimeout(
          resolveReferenceLocations(position),
          NAVIGATION_REQUEST_TIMEOUT_MS,
          t("files.navigationTimeout"),
        );
        if (requestId !== lspRequestIdRef.current) {
          return;
        }
        const referenceLocations = filterOriginReferenceLocation(
          locations,
          { uri: currentFileUri, line: position.line, character: position.character },
          caseInsensitivePathCompare,
        );
        referencesCacheRef.current.set(
          queryKey,
          createLocationCacheEntry(referenceLocations, source),
        );
        setReferenceResults(referenceLocations);
      } catch (error) {
        if (requestId !== lspRequestIdRef.current) {
          return;
        }
        setNavigationError(errorMessageFromUnknown(error, t("files.navigationError")));
      } finally {
        if (requestId === lspRequestIdRef.current) {
          setIsReferencesLoading(false);
        }
      }
    },
    [
      caseInsensitivePathCompare,
      cmRef,
      currentFileUri,
      filePath,
      resolveReferenceLocations,
      t,
    ],
  );

  const runDefinitionFromCursor = useCallback(() => {
    const view = cmRef.current?.view;
    if (!view) {
      return;
    }
    void resolveDefinitionAtOffset(view.state.selection.main.head, view as unknown as EditorView);
  }, [cmRef, resolveDefinitionAtOffset]);

  const runReferencesFromCursor = useCallback(() => {
    const view = cmRef.current?.view;
    if (!view) {
      return;
    }
    void findReferencesAtOffset(view.state.selection.main.head);
  }, [cmRef, findReferencesAtOffset]);

  const findImplementationAtOffset = useCallback(
    async (offset: number) => {
      const editorView = cmRef.current?.view;
      if (!editorView) {
        return;
      }
      if (!shouldTryJdtls) {
        setNavigationError(t("files.navigationNoImplementation"));
        return;
      }
      const position = offsetToLspPosition(editorView.state.doc, offset);
      const queryKey = makeLocationQueryKey(filePath, position.line, position.character);
      const now = Date.now();
      const recentTrigger = recentImplementationTriggerRef.current;
      if (
        recentTrigger &&
        recentTrigger.key === queryKey &&
        now - recentTrigger.at < CODE_INTEL_REPEAT_DEBOUNCE_MS
      ) {
        return;
      }
      recentImplementationTriggerRef.current = { key: queryKey, at: now };
      const requestId = lspRequestIdRef.current + 1;
      lspRequestIdRef.current = requestId;
      setNavigationError(null);
      setImplementationCandidates([]);
      setIsImplementationLoading(true);
      try {
        const locations = await withTimeout(
          resolveImplementationLocations(position),
          NAVIGATION_REQUEST_TIMEOUT_MS,
          t("files.navigationTimeout"),
        );
        if (requestId !== lspRequestIdRef.current) {
          return;
        }
        if (locations.length === 0) {
          setNavigationError(t("files.navigationNoImplementation"));
          return;
        }
        if (locations.length === 1) {
          const onlyLocation = locations[0];
          if (onlyLocation) {
            navigateToLocation(onlyLocation);
          }
          return;
        }
        setImplementationCandidates(locations);
      } catch (error) {
        if (requestId !== lspRequestIdRef.current) {
          return;
        }
        setNavigationError(errorMessageFromUnknown(error, t("files.navigationError")));
      } finally {
        if (requestId === lspRequestIdRef.current) {
          setIsImplementationLoading(false);
        }
      }
    },
    [cmRef, filePath, navigateToLocation, resolveImplementationLocations, shouldTryJdtls, t],
  );

  const runImplementationFromCursor = useCallback(() => {
    const view = cmRef.current?.view;
    if (!view) {
      return;
    }
    void findImplementationAtOffset(view.state.selection.main.head);
  }, [cmRef, findImplementationAtOffset]);

  const editorNavigationKeymapExt = useMemo(
    () =>
      keymap.of([
        {
          key: "Mod-f",
          run: (view) => {
            if (searchPanelOpen(view.state)) {
              closeSearchPanel(view);
            } else {
              openSearchPanel(view);
            }
            view.focus();
            return true;
          },
        },
        {
          key: "Mod-b",
          run: () => {
            runDefinitionFromCursor();
            return true;
          },
        },
        {
          key: "Alt-F7",
          run: () => {
            runReferencesFromCursor();
            return true;
          },
        },
        {
          key: "Alt-Shift-b",
          run: () => {
            runImplementationFromCursor();
            return true;
          },
        },
      ]),
    [runDefinitionFromCursor, runReferencesFromCursor, runImplementationFromCursor],
  );

  const ctrlClickDefinitionExt = useMemo(
    () =>
      EditorView.domEventHandlers({
        mousedown: (event, view) => {
          if (event.button !== 0) {
            return false;
          }
          if (!(event.metaKey || event.ctrlKey)) {
            return false;
          }
          const offset = view.posAtCoords({ x: event.clientX, y: event.clientY });
          if (offset == null) {
            return false;
          }
          event.preventDefault();
          void resolveDefinitionAtOffset(offset, view);
          return true;
        },
      }),
    [resolveDefinitionAtOffset],
  );

  useEffect(() => {
    lspRequestIdRef.current += 1;
    recentDefinitionTriggerRef.current = null;
    recentReferencesTriggerRef.current = null;
    recentImplementationTriggerRef.current = null;
    setIsDefinitionLoading(false);
    setIsReferencesLoading(false);
    setIsImplementationLoading(false);
    setNavigationError(null);
    setDefinitionCandidates([]);
    setImplementationCandidates([]);
    setReferenceResults(null);
  }, [filePath]);

  useEffect(() => {
    clearNavigationFocusTimer();
    return () => {
      clearNavigationFocusTimer();
    };
  }, [clearNavigationFocusTimer, filePath]);

  useEffect(() => {
    if (!navigationTarget) {
      return;
    }
    if (!isSameWorkspacePath(navigationTarget.path, filePath)) {
      return;
    }
    if (navigationTarget.requestId === appliedNavigationRequestRef.current) {
      return;
    }
    if (isLoading) {
      return;
    }
    setMode("edit");
    focusEditorAtLocationWithRetry(
      navigationTarget.line,
      navigationTarget.column,
      0,
      () => {
        appliedNavigationRequestRef.current = navigationTarget.requestId;
      },
    );
  }, [
    filePath,
    focusEditorAtLocationWithRetry,
    isLoading,
    isSameWorkspacePath,
    navigationTarget,
    setMode,
  ]);

  const openFindPanelInEditor = useCallback(() => {
    const view = cmRef.current?.view;
    if (!view) {
      return false;
    }
    openSearchPanel(view as unknown as EditorView);
    view.focus();
    return true;
  }, [cmRef]);

  const openReplacePanelInEditor = useCallback(() => {
    const view = cmRef.current?.view;
    if (!view) {
      return false;
    }
    openSearchWithReplace(view as unknown as EditorView);
    return true;
  }, [cmRef]);

  const toggleFindPanelInEditor = useCallback(() => {
    const view = cmRef.current?.view;
    if (!view) {
      return false;
    }
    if (searchPanelOpen(view.state)) {
      closeSearchPanel(view as unknown as EditorView);
    } else {
      openSearchPanel(view as unknown as EditorView);
    }
    view.focus();
    return true;
  }, [cmRef]);

  return {
    isDefinitionLoading,
    isReferencesLoading,
    isImplementationLoading,
    navigationError,
    definitionCandidates,
    setDefinitionCandidates,
    implementationCandidates,
    setImplementationCandidates,
    referenceResults,
    setReferenceResults,
    navigateToLocation,
    runDefinitionFromCursor,
    runReferencesFromCursor,
    runImplementationFromCursor,
    editorNavigationKeymapExt,
    ctrlClickDefinitionExt,
    openFindPanelInEditor,
    openReplacePanelInEditor,
    toggleFindPanelInEditor,
  };
}
