/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  FileTreeStoreProvider,
  useFileTreeStore,
  useFileTreeStoreApi,
} from "./fileTreeStoreContext";

function StoreProbe({ label }: { label: string }) {
  const selectedPath = useFileTreeStore((state) => state.selectedPath);
  const store = useFileTreeStoreApi();

  return (
    <button
      type="button"
      onClick={() => store.getState().selectNode(`${label}/file.ts`, "file")}
    >
      {label}:{selectedPath ?? "none"}
    </button>
  );
}

describe("FileTreeStoreProvider", () => {
  it("creates isolated stores for providers with the same workspace id", () => {
    render(
      <>
        <FileTreeStoreProvider workspaceId="workspace-1">
          <StoreProbe label="main" />
        </FileTreeStoreProvider>
        <FileTreeStoreProvider workspaceId="workspace-1">
          <StoreProbe label="detached" />
        </FileTreeStoreProvider>
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: "main:none" }));

    expect(screen.getByRole("button", { name: "main:main/file.ts" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "detached:none" })).toBeTruthy();
  });

  it("creates a fresh store when the provider remounts", () => {
    const { rerender } = render(
      <FileTreeStoreProvider workspaceId="workspace-1">
        <StoreProbe label="main" />
      </FileTreeStoreProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "main:none" }));
    expect(screen.getByRole("button", { name: "main:main/file.ts" })).toBeTruthy();

    rerender(
      <FileTreeStoreProvider workspaceId="workspace-2">
        <StoreProbe label="main" />
      </FileTreeStoreProvider>,
    );

    expect(screen.getByRole("button", { name: "main:none" })).toBeTruthy();
  });
});
