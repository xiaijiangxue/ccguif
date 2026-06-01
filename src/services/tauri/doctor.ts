import { invoke } from "@tauri-apps/api/core";
import type { CodexDoctorResult, CodexLaunchProfilePreview } from "../../types";

export type PreviewCodexLaunchProfileRequest = {
  codexBin: string | null;
  codexArgs: string | null;
  workspaceId?: string | null;
  useWorkspaceDraft?: boolean;
};

export async function runCodexDoctor(
  codexBin: string | null,
  codexArgs: string | null,
): Promise<CodexDoctorResult> {
  return invoke<CodexDoctorResult>("codex_doctor", { codexBin, codexArgs });
}

export async function runClaudeDoctor(
  claudeBin: string | null,
): Promise<CodexDoctorResult> {
  return invoke<CodexDoctorResult>("claude_doctor", { claudeBin });
}

export async function previewCodexLaunchProfile({
  codexBin,
  codexArgs,
  workspaceId = null,
  useWorkspaceDraft = false,
}: PreviewCodexLaunchProfileRequest): Promise<CodexLaunchProfilePreview> {
  return invoke<CodexLaunchProfilePreview>("codex_preview_launch_profile", {
    codexBin,
    codexArgs,
    workspaceId,
    useWorkspaceDraft,
  });
}
