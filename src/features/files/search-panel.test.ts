/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { openSearchPanel, search } from "@codemirror/search";
import { createSearchPanelFactory, type SearchPanelLabels } from "./search-panel";

const labels: SearchPanelLabels = {
  find: "Find",
  replace: "Replace",
  matchCase: "Match case",
  wholeWord: "Whole word",
  regexp: "Use regular expression",
  previous: "Previous match",
  next: "Next match",
  selectAll: "Select all matches",
  replaceAll: "Replace all",
  close: "Close search",
  resultCount: (count) => `${count} results`,
  resultCountLimit: (limit) => `${limit}+ results`,
};

describe("createSearchPanelFactory", () => {
  it("omits the close button because Escape closes the search panel", () => {
    const parent = document.createElement("div");
    document.body.appendChild(parent);

    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc: "alpha\nbeta\nalpha",
        extensions: [
          search({
            top: true,
            createPanel: createSearchPanelFactory(labels),
          }),
        ],
      }),
    });

    openSearchPanel(view);

    const panel = parent.querySelector(".cm-search-idea");
    const findRow = panel?.querySelector(".cm-search-row--find");
    const mainControls = findRow?.querySelector(".cm-search-row-main");

    expect(panel).not.toBeNull();
    expect(findRow).not.toBeNull();
    expect(mainControls).not.toBeNull();
    expect(panel?.querySelector(".cm-search-close")).toBeNull();
    expect(panel?.querySelector('button[name="close"]')).toBeNull();

    view.destroy();
    parent.remove();
  });
});
