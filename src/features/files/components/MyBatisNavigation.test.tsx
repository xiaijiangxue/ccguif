/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProviderStatusBadge } from "./ProviderStatusBadge";
import { DiagnosticsPanel } from "./DiagnosticsPanel";
import type { DiagnosticEntry } from "../hooks/useDiagnostics";

describe("ProviderStatusBadge", () => {
  it("renders label and status dot", () => {
    render(<ProviderStatusBadge label="JDTLS" status="ready" />);
    expect(screen.getByText("JDTLS")).toBeTruthy();
  });

  it("renders with different statuses", () => {
    const { unmount } = render(<ProviderStatusBadge label="JDTLS" status="ready" />);
    expect(screen.getByText("JDTLS")).toBeTruthy();
    unmount();

    const { unmount: unmount2 } = render(<ProviderStatusBadge label="JDTLS" status="unavailable" />);
    expect(screen.getByText("JDTLS")).toBeTruthy();
    unmount2();

    const { unmount: unmount3 } = render(<ProviderStatusBadge label="JDTLS" status="indexing" />);
    expect(screen.getByText("JDTLS")).toBeTruthy();
    unmount3();
  });

  it("renders custom tooltip", () => {
    render(<ProviderStatusBadge label="JDTLS" status="error" tooltip="Custom error message" />);
    expect(screen.getByText("JDTLS")).toBeTruthy();
  });
});

describe("DiagnosticsPanel", () => {
  it("shows loading state", () => {
    render(<DiagnosticsPanel diagnostics={[]} isLoading={true} error={null} />);
    expect(screen.getByText("Loading diagnostics...")).toBeTruthy();
  });

  it("shows error state", () => {
    render(<DiagnosticsPanel diagnostics={[]} isLoading={false} error="Failed to load" />);
    expect(screen.getByText("Failed to load")).toBeTruthy();
  });

  it("shows empty state", () => {
    render(<DiagnosticsPanel diagnostics={[]} isLoading={false} error={null} />);
    expect(screen.getByText("No diagnostics")).toBeTruthy();
  });

  it("renders error diagnostics", () => {
    const diagnostics: DiagnosticEntry[] = [
      {
        message: "Cannot find symbol",
        filePath: "src/main/java/com/example/UserService.java",
        line: 42,
        column: 5,
        severity: "error",
        source: "jdtls",
      },
    ];
    render(<DiagnosticsPanel diagnostics={diagnostics} isLoading={false} error={null} />);
    expect(screen.getByText("Cannot find symbol")).toBeTruthy();
    expect(screen.getByText("Errors (1)")).toBeTruthy();
  });

  it("renders warning diagnostics", () => {
    const diagnostics: DiagnosticEntry[] = [
      {
        message: "Missing XML statement: countByAge",
        filePath: "src/main/java/com/example/UserMapper.java",
        line: 15,
        column: null,
        severity: "warning",
        source: "mybatis",
        issueType: "missing_statement",
      },
    ];
    render(<DiagnosticsPanel diagnostics={diagnostics} isLoading={false} error={null} />);
    expect(screen.getByText("Missing XML statement: countByAge")).toBeTruthy();
    expect(screen.getByText("Warnings (1)")).toBeTruthy();
  });

  it("groups diagnostics by severity", () => {
    const diagnostics: DiagnosticEntry[] = [
      {
        message: "Error 1",
        filePath: "test.java",
        line: 1,
        column: null,
        severity: "error",
        source: "jdtls",
      },
      {
        message: "Warning 1",
        filePath: "test.java",
        line: 2,
        column: null,
        severity: "warning",
        source: "mybatis",
      },
      {
        message: "Error 2",
        filePath: "test.java",
        line: 3,
        column: null,
        severity: "error",
        source: "jdtls",
      },
    ];
    render(<DiagnosticsPanel diagnostics={diagnostics} isLoading={false} error={null} />);
    expect(screen.getByText("Errors (2)")).toBeTruthy();
    expect(screen.getByText("Warnings (1)")).toBeTruthy();
  });

  it("shows source label for each diagnostic", () => {
    const diagnostics: DiagnosticEntry[] = [
      {
        message: "Java error",
        filePath: "test.java",
        line: 1,
        column: null,
        severity: "error",
        source: "jdtls",
      },
      {
        message: "MyBatis warning",
        filePath: "test.xml",
        line: 5,
        column: null,
        severity: "warning",
        source: "mybatis",
      },
    ];
    const { container } = render(
      <DiagnosticsPanel diagnostics={diagnostics} isLoading={false} error={null} />,
    );
    const text = container.textContent ?? "";
    expect(text).toContain("Java");
    expect(text).toContain("MyBatis");
  });
});
