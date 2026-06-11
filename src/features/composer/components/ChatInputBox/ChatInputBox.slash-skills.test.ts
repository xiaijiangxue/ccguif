import { describe, expect, it, vi } from "vitest";
import { resolveSlashCompletionItems } from "./utils/slashCompletionItems";

describe("resolveSlashCompletionItems", () => {
  it("keeps slash completion command-only when Skills are disabled", async () => {
    const commandProvider = vi.fn().mockResolvedValue([
      { id: "review", label: "/review", category: "workflow" },
    ]);
    const skillProvider = vi.fn().mockResolvedValue([
      { name: "review", path: "/skills/review/SKILL.md" },
    ]);

    const results = await resolveSlashCompletionItems({
      query: "rev",
      signal: new AbortController().signal,
      commandProvider,
      skillProvider,
      slashMenuSkillsEnabled: false,
    });

    expect(results).toEqual([
      {
        kind: "command",
        command: expect.objectContaining({ label: "/review" }),
      },
    ]);
    expect(skillProvider).not.toHaveBeenCalled();
  });

  it("appends Skills to slash completion when enabled", async () => {
    const commandProvider = vi.fn().mockResolvedValue([
      { id: "review", label: "/review", category: "workflow" },
    ]);
    const skillProvider = vi.fn().mockResolvedValue([
      {
        name: "review",
        path: "/skills/review/SKILL.md",
        description: "Review current changes",
      },
    ]);

    const results = await resolveSlashCompletionItems({
      query: "rev",
      signal: new AbortController().signal,
      commandProvider,
      skillProvider,
      slashMenuSkillsEnabled: true,
    });

    expect(results).toEqual([
      {
        kind: "command",
        command: expect.objectContaining({ label: "/review" }),
      },
      {
        kind: "skill",
        skill: expect.objectContaining({ name: "review" }),
      },
    ]);
  });

  it("falls back to command results when Skill loading fails", async () => {
    const commandProvider = vi.fn().mockResolvedValue([
      { id: "clear", label: "/clear", category: "system" },
    ]);
    const skillProvider = vi.fn().mockRejectedValue(new Error("boom"));

    const results = await resolveSlashCompletionItems({
      query: "",
      signal: new AbortController().signal,
      commandProvider,
      skillProvider,
      slashMenuSkillsEnabled: true,
    });

    expect(results).toEqual([
      {
        kind: "command",
        command: expect.objectContaining({ label: "/clear" }),
      },
    ]);
  });
});
