/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { openSearchPanel, search } from "@codemirror/search";
import {
  createSearchPanelFactory,
  selectFirstSearchMatchOnQueryChange,
  type SearchPanelLabels,
} from "./search-panel";

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
  const originalCreateRange = document.createRange.bind(document);

  beforeEach(() => {
    vi.spyOn(document, "createRange").mockImplementation(() => {
      const range = originalCreateRange();
      range.getClientRects = vi.fn(() => ({
        length: 0,
        item: () => null,
        [Symbol.iterator]: function* () {},
      }) as DOMRectList);
      range.getBoundingClientRect = vi.fn(() => ({
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        toJSON: () => ({}),
      }));
      return range;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it("clears the auto-selected match when the search query is emptied", async () => {
    const parent = document.createElement("div");
    document.body.appendChild(parent);

    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc: "alpha\nbeta\nreturn value",
        extensions: [
          search({
            top: true,
            createPanel: createSearchPanelFactory(labels),
          }),
          selectFirstSearchMatchOnQueryChange,
        ],
      }),
    });

    openSearchPanel(view);

    const input = parent.querySelector<HTMLInputElement>('input[name="search"]');
    expect(input).not.toBeNull();

    input!.value = "r";
    input!.dispatchEvent(new InputEvent("input", { bubbles: true }));
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const selectedMatch = view.state.selection.main;
    expect(selectedMatch.empty).toBe(false);
    expect(view.state.doc.sliceString(selectedMatch.from, selectedMatch.to)).toBe("r");

    input!.value = "";
    input!.dispatchEvent(new InputEvent("input", { bubbles: true }));
    await new Promise((resolve) => requestAnimationFrame(resolve));

    expect(view.state.selection.main.empty).toBe(true);

    view.destroy();
    parent.remove();
  });
});
