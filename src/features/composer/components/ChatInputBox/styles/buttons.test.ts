import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const buttonsCss = readFileSync(
  fileURLToPath(new URL("./buttons.css", import.meta.url)),
  "utf8",
);

describe("chat input button styles", () => {
  it("keeps the streaming stop button as a compact red square", () => {
    expect(buttonsCss).toMatch(/\.stop-button\s*\{[^}]*width:\s*24px/s);
    expect(buttonsCss).toMatch(/\.stop-button\s*\{[^}]*height:\s*24px/s);
    expect(buttonsCss).toMatch(/\.stop-button\s*\{[^}]*aspect-ratio:\s*1 \/ 1/s);
    expect(buttonsCss).toMatch(/\.stop-button\s*\{[^}]*background:\s*var\(--error-color, #f44336\)/s);
    expect(buttonsCss).toMatch(/\.stop-button\s*\{[^}]*border-radius:\s*6px/s);
    expect(buttonsCss).not.toMatch(/\.stop-button\s*\{[^}]*clip-path:/s);
    expect(buttonsCss).not.toMatch(/\.stop-button\s*\{[^}]*overflow:\s*hidden/s);
    expect(buttonsCss).not.toContain("assets/icon.png");
    expect(buttonsCss).not.toContain("stop-button-spin");
    expect(buttonsCss).toMatch(/\.stop-button \.codicon\s*\{[^}]*opacity:\s*1/s);
  });

  it("keeps ingress and waiting phases visually stable", () => {
    expect(buttonsCss).toMatch(/\.stop-button\.is-waiting\s*\{[^}]*filter:\s*none/s);
    expect(buttonsCss).toMatch(/\.stop-button\.is-ingress\s*\{[^}]*filter:\s*none/s);
    expect(buttonsCss).not.toContain(".stop-button.is-ingress::before");
    expect(buttonsCss).not.toContain(".stop-button.is-ingress::after");
  });
});
