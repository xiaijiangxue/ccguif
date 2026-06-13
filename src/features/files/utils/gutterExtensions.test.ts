/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { mybatisNavigationGutter } from "./gutterExtensions";

describe("mybatisNavigationGutter", () => {
  it("invokes entry onClick from the marker DOM click path", () => {
    const onClick = vi.fn();
    const parent = document.createElement("div");
    document.body.appendChild(parent);

    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc: "interface PostMapper {\n  List<Post> findAll();\n}",
        extensions: [
          mybatisNavigationGutter(() => [
            {
              line: 2,
              type: "mybatis-leaf",
              tooltip: "Go to XML: findAll",
              onClick,
            },
          ]),
        ],
      }),
    });

    const markers = parent.querySelectorAll(".cm-nav-gutter-marker");
    expect(markers).toHaveLength(1);
    const marker = markers[0];
    expect(marker).not.toBeNull();
    marker?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(onClick).toHaveBeenCalledTimes(1);
    view.destroy();
    parent.remove();
  });
});
