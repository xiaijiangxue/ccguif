import { useEffect, useRef, useState } from "react";
import {
  detectJavaProject,
  getJdtlsDidOpen,
} from "../../../services/tauri";
import { errorMessageFromUnknown } from "../utils/fileViewNavigationUtils";

type UseJdtlsWarmupArgs = {
  workspaceId: string;
  workspacePath: string;
  filePath: string;
  fileContent: string | null;
  isJavaFile: boolean;
};

export type JdtlsWarmupState = {
  isWarming: boolean;
  error: string | null;
};

export function useJdtlsWarmup({
  workspaceId,
  workspacePath,
  filePath,
  fileContent,
  isJavaFile,
}: UseJdtlsWarmupArgs): JdtlsWarmupState {
  const [state, setState] = useState<JdtlsWarmupState>({
    isWarming: false,
    error: null,
  });
  const warmedWorkspaceRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isJavaFile || !fileContent || warmedWorkspaceRef.current === workspacePath) {
      return;
    }

    let cancelled = false;
    setState({ isWarming: true, error: null });

    async function warmup() {
      try {
        const detection = await detectJavaProject(workspacePath);
        if (cancelled) {
          return;
        }
        if (!detection.isJavaProject) {
          warmedWorkspaceRef.current = workspacePath;
          setState({ isWarming: false, error: null });
          return;
        }
        await getJdtlsDidOpen(workspaceId, { filePath, content: fileContent });
        if (!cancelled) {
          warmedWorkspaceRef.current = workspacePath;
          setState({ isWarming: false, error: null });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            isWarming: false,
            error: errorMessageFromUnknown(error, "Failed to warm up JDTLS"),
          });
        }
      }
    }

    void warmup();

    return () => {
      cancelled = true;
    };
  }, [fileContent, filePath, isJavaFile, workspaceId, workspacePath]);

  return state;
}
