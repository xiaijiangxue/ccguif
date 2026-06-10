// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ThreadTokenUsage } from "../../../types";
import { ContextUsageIndicator } from "./ContextUsageIndicator";

function makeUsage(overrides: Partial<ThreadTokenUsage> = {}): ThreadTokenUsage {
  return {
    total: {
      totalTokens: 100_000,
      inputTokens: 100_000,
      cachedInputTokens: 0,
      outputTokens: 0,
      reasoningOutputTokens: 0,
    },
    last: {
      totalTokens: 100_000,
      inputTokens: 100_000,
      cachedInputTokens: 0,
      outputTokens: 0,
      reasoningOutputTokens: 0,
    },
    modelContextWindow: 200_000,
    ...overrides,
  };
}

describe("ContextUsageIndicator", () => {
  it("falls back to a 1m display window when usage has no model context window", () => {
    render(
      <ContextUsageIndicator
        contextUsage={makeUsage({
          modelContextWindow: null,
        })}
      />,
    );

    const indicator = screen.getByRole("status");
    expect(indicator.getAttribute("title")).toContain("10% · 100k / 1m");
  });
});
