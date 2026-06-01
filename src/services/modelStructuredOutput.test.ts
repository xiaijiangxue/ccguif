import { describe, expect, it } from "vitest";

import { parseModelStructuredJsonObject } from "./modelStructuredOutput";

type TestPayload = {
  moves?: Array<{ nodeId: string }>;
  profile?: { primaryLanguage: string };
  nodes?: unknown[];
};

function isTestPayload(value: unknown): value is TestPayload {
  return Boolean(value && typeof value === "object" && ("moves" in value || "profile" in value || "nodes" in value));
}

describe("model structured output", () => {
  it("extracts markdown-wrapped JSON before validation", () => {
    const payload = parseModelStructuredJsonObject({
      text: "Here is the JSON:\n```json\n{\"moves\":[{\"nodeId\":\"a\"}]}\n```",
      validator: isTestPayload,
      payloadDescription: "test payload",
    });

    expect(payload.moves?.[0]?.nodeId).toBe("a");
  });

  it("repairs common relaxed JSON without model-specific branches", () => {
    const payload = parseModelStructuredJsonObject({
      text: "{ profile: { primaryLanguage: typescript, }, nodes: [web,], }",
      validator: isTestPayload,
      payloadDescription: "test payload",
    });

    expect(payload).toMatchObject({
      profile: { primaryLanguage: "typescript" },
      nodes: ["web"],
    });
  });

  it("repairs a missing array closer before an object closer", () => {
    const payload = parseModelStructuredJsonObject({
      text: '{"moves":[{"nodeId":"a"}],"skips":[{"nodeId":"b"} }',
      validator: isTestPayload,
      payloadDescription: "test payload",
    });

    expect(payload.moves?.[0]?.nodeId).toBe("a");
  });

  it("rejects valid JSON that does not match the caller validator", () => {
    expect(() =>
      parseModelStructuredJsonObject({
        text: '{"unrelated":true}',
        validator: isTestPayload,
        payloadDescription: "test payload",
      }),
    ).toThrow("AI output did not contain a test payload.");
  });
});
