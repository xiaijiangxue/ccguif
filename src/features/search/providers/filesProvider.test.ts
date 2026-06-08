import { describe, expect, it } from "vitest";
import { searchFiles } from "./filesProvider";

describe("searchFiles", () => {
  it("matches case-insensitively by default", () => {
    const results = searchFiles("readme", ["README.md"], "ws-1");

    expect(results.map((result) => result.title)).toEqual(["README.md"]);
  });

  it("supports case-sensitive matching", () => {
    const results = searchFiles("readme", ["README.md"], "ws-1", {
      caseSensitive: true,
      wholeWord: false,
    });

    expect(results).toEqual([]);
  });

  it("supports whole-word matching", () => {
    const results = searchFiles("clear", ["src/clear.ts", "src/unclear.ts"], "ws-1", {
      caseSensitive: false,
      wholeWord: true,
    });

    expect(results.map((result) => result.title)).toEqual(["src/clear.ts"]);
  });
});
