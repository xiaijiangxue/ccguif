import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const shellCss = readFileSync(
  fileURLToPath(new URL("./git-history.part1-shell.css", import.meta.url)),
  "utf8",
);

describe("git history toolbar geometry", () => {
  it("keeps the resize handle out of toolbar layout flow", () => {
    expect(shellCss).toMatch(
      /\.git-history-dock-resizer\s*\{[^}]*position:\s*absolute/s,
    );
    expect(shellCss).toMatch(
      /\.git-history-dock-resizer\s*\{[^}]*top:\s*-4px/s,
    );
    expect(shellCss).not.toMatch(
      /\.git-history-dock-resizer\s*\{[^}]*flex:\s*0\s+0\s+auto/s,
    );
  });

  it("keeps toolbar vertical padding symmetric", () => {
    expect(shellCss).toMatch(
      /\.git-history-toolbar\s*\{[^}]*padding:\s*8px\s+10px/s,
    );
  });
});
