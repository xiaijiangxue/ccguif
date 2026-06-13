import { describe, expect, it } from "vitest";
import {
  areFileUrisEquivalent,
  createLocationCacheEntry,
  normalizeJdtlsLocations,
  readFreshCache,
  relativePathFromFileUri,
  toFileUri,
} from "./fileViewNavigationUtils";

describe("fileViewNavigationUtils", () => {
  it("builds Windows file URIs that round-trip to workspace-relative paths", () => {
    const fileUri = toFileUri("C:\\Repo\\src\\Main.ts");

    expect(fileUri).toBe("file:///C:/Repo/src/Main.ts");
    expect(relativePathFromFileUri(fileUri, "C:/Repo")).toBe("src/Main.ts");
  });

  it("builds UNC file URIs that preserve the network host", () => {
    const fileUri = toFileUri("\\\\server\\share\\Repo\\src\\Main.ts");

    expect(fileUri).toBe("file://server/share/Repo/src/Main.ts");
    expect(relativePathFromFileUri(fileUri, "//server/share/Repo")).toBe("src/Main.ts");
  });

  it("compares Windows file URIs case-insensitively when requested", () => {
    expect(
      areFileUrisEquivalent(
        "file:///C:/Repo/src/Main.ts",
        "file:///c:/repo/src/main.ts",
        true,
      ),
    ).toBe(true);
  });

  it("preserves navigation source metadata on fresh cache reads", () => {
    const cache = new Map();
    cache.set(
      "definition",
      createLocationCacheEntry(
        [{ uri: "file:///repo/src/Foo.java", line: 1, character: 2 }],
        "semantic",
      ),
    );

    expect(readFreshCache(cache, "definition")?.source).toBe("semantic");
  });

  it("defaults cache source to fallback", () => {
    const cache = new Map();
    cache.set(
      "definition",
      createLocationCacheEntry([{ uri: "file:///repo/src/Foo.java", line: 1, character: 2 }]),
    );

    expect(readFreshCache(cache, "definition")?.source).toBe("fallback");
  });

  it("normalizes JDTLS single-location and array responses", () => {
    const single = normalizeJdtlsLocations({
      uri: "file:///repo/src/Foo.java",
      range: { start: { line: 4, character: 8 }, end: { line: 4, character: 11 } },
    });
    const multiple = normalizeJdtlsLocations([
      {
        uri: "file:///repo/src/Bar.java",
        range: { start: { line: 6, character: 2 }, end: { line: 6, character: 5 } },
      },
    ]);

    expect(single).toEqual([{ uri: "file:///repo/src/Foo.java", path: null, line: 4, character: 8 }]);
    expect(multiple).toEqual([{ uri: "file:///repo/src/Bar.java", path: null, line: 6, character: 2 }]);
  });
});
