import { describe, expect, it } from "vitest";

import {
  createProjectMapDatasetFixture,
  createProjectMapRelationFixture,
} from "../testUtils/fixtures";
import {
  buildProjectMapShortestPath,
  searchProjectMapNodes,
} from "./navigation";

describe("project map navigation utilities", () => {
  it("searches title, summary, kind, lens, and source fields with stable ranking", () => {
    const dataset = createProjectMapDatasetFixture();

    const results = searchProjectMapNodes({
      dataset,
      query: "controller",
    });

    expect(results[0]?.node.id).toBe("api-controller");
    expect(results[0]?.matchedFields).toEqual(expect.arrayContaining(["title", "summary", "source"]));
  });

  it("finds relation-backed shortest paths and exposes edge keys", () => {
    const dataset = createProjectMapDatasetFixture({
      relations: [createProjectMapRelationFixture()],
    });

    const result = buildProjectMapShortestPath({
      dataset,
      sourceNodeId: "api-controller",
      targetNodeId: "data-store",
      emptyMessage: "empty",
      foundMessage: "found",
      notFoundMessage: "not-found",
    });

    expect(result.status).toBe("found");
    expect(result.steps.map((step) => step.via)).toEqual(["self", "relation"]);
    expect(result.edgeKeys.has("api-controller::data-store")).toBe(true);
  });

  it("falls back to hierarchy paths and returns not-found for unreachable endpoints", () => {
    const dataset = createProjectMapDatasetFixture();

    const hierarchyPath = buildProjectMapShortestPath({
      dataset,
      sourceNodeId: "project-core",
      targetNodeId: "api-controller",
      emptyMessage: "empty",
      foundMessage: "found",
      notFoundMessage: "not-found",
    });
    const missingPath = buildProjectMapShortestPath({
      dataset,
      sourceNodeId: "project-core",
      targetNodeId: "missing-node",
      emptyMessage: "empty",
      foundMessage: "found",
      notFoundMessage: "not-found",
    });

    expect(hierarchyPath.status).toBe("found");
    expect(hierarchyPath.steps[0]?.via).toBe("self");
    expect(hierarchyPath.steps.slice(1).every((step) => step.via === "hierarchy")).toBe(true);
    expect(hierarchyPath.steps.at(-1)?.node.id).toBe("api-controller");
    expect(missingPath).toMatchObject({ status: "not-found", message: "not-found" });
  });
});
