// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TodoFloatingWindow } from "./TodoFloatingWindow";

describe("TodoFloatingWindow", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1024,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: 768,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("does not render when there are no todos", () => {
    const constraintRef = { current: document.createElement("div") };
    render(
      <TodoFloatingWindow
        todos={[]}
        sessionId="empty"
        constraintRef={constraintRef}
      />,
    );

    expect(screen.queryByText("待办 0/0")).toBeNull();
  });

  it("renders collapsed summary and expands to the todo list", () => {
    const constraintRef = { current: document.createElement("div") };
    render(
      <TodoFloatingWindow
        todos={[
            { content: "已完成", status: "completed" },
            { content: "处理中", status: "in_progress" },
            { content: "待处理", status: "pending" },
        ]}
        sessionId="active"
        constraintRef={constraintRef}
      />,
    );

    const toggle = screen.getByRole("button", { name: "statusPanel.expand" });
    expect(screen.getByText("待办 1/3")).toBeTruthy();
    expect(screen.queryByText("处理中")).toBeNull();

    fireEvent.click(toggle);

    expect(screen.getByText("处理中")).toBeTruthy();
    expect(screen.getByText("待处理")).toBeTruthy();
    expect(document.querySelector(".tfw-window.is-expanded")).toBeTruthy();
    expect(document.querySelector(".tfw-body")).toBeTruthy();
  });
});
