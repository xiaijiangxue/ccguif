import {
  EditorView,
  runScopeHandlers,
  type KeyBinding,
  type Panel,
  type ViewUpdate,
} from "@codemirror/view";
import {
  closeSearchPanel,
  findNext,
  findPrevious,
  getSearchQuery,
  openSearchPanel,
  replaceAll,
  replaceNext,
  SearchQuery,
  selectMatches,
  searchPanelOpen,
  setSearchQuery,
} from "@codemirror/search";

const RESULT_LIMIT = 10_000;
const panelInstances = new WeakMap<HTMLElement, IdeaSearchPanel>();
const replaceVisibilityByView = new WeakMap<EditorView, boolean>();

export interface SearchPanelLabels {
  find: string;
  replace: string;
  matchCase: string;
  wholeWord: string;
  regexp: string;
  previous: string;
  next: string;
  selectAll: string;
  replaceAll: string;
  close: string;
  resultCount(count: number): string;
  resultCountLimit(limit: number): string;
}

function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  attrs?: Record<string, string | boolean>,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      e.setAttribute(k, String(v));
    }
  }
  return e;
}

function createIcon(name: string): HTMLElement {
  const span = document.createElement("span");
  span.className = `codicon codicon-${name}`;
  span.setAttribute("aria-hidden", "true");
  return span;
}

function countMatches(view: EditorView, query: SearchQuery): number {
  if (!query.valid || !query.search) {
    return 0;
  }

  const cursor = query.getCursor(view.state, 0);
  let count = 0;
  while (count < RESULT_LIMIT) {
    const match = cursor.next();
    if (match.done) {
      break;
    }
    count += 1;
  }
  return count;
}

function formatResultCount(
  count: number,
  hasQuery: boolean,
  labels: SearchPanelLabels,
): string {
  if (!hasQuery) {
    return "";
  }
  if (count >= RESULT_LIMIT) {
    return labels.resultCountLimit(RESULT_LIMIT);
  }
  return labels.resultCount(count);
}

function button(
  cls: string,
  attrs: Record<string, string>,
  children: Array<Node | string>,
): HTMLButtonElement {
  const buttonEl = createElement("button", cls, {
    type: "button",
    ...attrs,
  });
  for (const child of children) {
    buttonEl.append(child);
  }
  return buttonEl;
}

function toggle(
  input: HTMLInputElement,
  label: string,
  title: string,
): HTMLLabelElement {
  const labelEl = createElement("label", "cm-search-toggle", { title });
  labelEl.append(input, document.createTextNode(label));
  return labelEl;
}

class IdeaSearchPanel implements Panel {
  readonly dom: HTMLElement;
  readonly top: boolean;

  private query: SearchQuery;
  private readonly searchField: HTMLInputElement;
  private readonly replaceField: HTMLInputElement;
  private readonly caseField: HTMLInputElement;
  private readonly reField: HTMLInputElement;
  private readonly wordField: HTMLInputElement;
  private readonly resultCount: HTMLElement;
  private replaceVisible: boolean;

  constructor(
    private readonly view: EditorView,
    private readonly labels: SearchPanelLabels,
  ) {
    this.query = getSearchQuery(view.state);
    this.top = true;
    this.replaceVisible = replaceVisibilityByView.get(view) ?? false;

    this.searchField = createElement("input", "cm-textfield cm-search-input", {
      type: "text",
      name: "search",
      form: "",
      "main-field": "true",
      "aria-label": labels.find,
      placeholder: labels.find,
      value: this.query.search,
    });
    this.replaceField = createElement("input", "cm-textfield cm-search-input", {
      type: "text",
      name: "replace",
      form: "",
      "aria-label": labels.replace,
      placeholder: labels.replace,
      value: this.query.replace,
    });
    this.caseField = createElement("input", "", {
      type: "checkbox",
      name: "case",
      form: "",
    });
    this.caseField.checked = this.query.caseSensitive;
    this.reField = createElement("input", "", {
      type: "checkbox",
      name: "re",
      form: "",
    });
    this.reField.checked = this.query.regexp;
    this.wordField = createElement("input", "", {
      type: "checkbox",
      name: "word",
      form: "",
    });
    this.wordField.checked = this.query.wholeWord;

    this.resultCount = createElement("span", "cm-search-result-count");
    this.dom = this.createDom();
    this.updateReplaceVisibility();
    this.updateResultCount();
    panelInstances.set(this.dom, this);
  }

  mount() {
    this.searchField.select();
    if (this.replaceVisible) {
      this.replaceField.focus();
      this.replaceField.select();
    }
  }

  update(update: ViewUpdate) {
    for (const transaction of update.transactions) {
      for (const effect of transaction.effects) {
        if (effect.is(setSearchQuery) && !effect.value.eq(this.query)) {
          this.setQuery(effect.value);
        }
      }
    }
    if (update.docChanged) {
      this.updateResultCount();
    }
  }

  destroy() {
    replaceVisibilityByView.delete(this.view);
  }

  toggleReplace() {
    this.replaceVisible = !this.replaceVisible;
    replaceVisibilityByView.set(this.view, this.replaceVisible);
    this.updateReplaceVisibility();
    if (this.replaceVisible) {
      this.replaceField.focus();
      this.replaceField.select();
    } else {
      this.searchField.focus();
    }
  }

  private createDom(): HTMLElement {
    const panel = createElement("div", "cm-search cm-search-idea");
    panel.addEventListener("keydown", this.handleKeyDown);

    const previousButton = button(
      "cm-button cm-search-nav",
      { name: "prev", title: this.labels.previous },
      [createIcon("arrow-up")],
    );
    const nextButton = button(
      "cm-button cm-search-nav",
      { name: "next", title: this.labels.next },
      [createIcon("arrow-down")],
    );
    const selectButton = button(
      "cm-button cm-search-nav",
      { name: "select", title: this.labels.selectAll },
      ["◎"],
    );
    const replaceButton = button(
      "cm-button cm-search-action",
      { name: "replace", title: this.labels.replace },
      [this.labels.replace],
    );
    const replaceAllButton = button(
      "cm-button cm-search-action",
      { name: "replaceAll", title: this.labels.replaceAll },
      [this.labels.replaceAll],
    );
    const findRow = createElement("div", "cm-search-row cm-search-row--find");
    const findRowMain = createElement("div", "cm-search-row-main");
    findRowMain.append(
      createIcon("search"),
      this.searchField,
      toggle(this.caseField, "Aa", this.labels.matchCase),
      toggle(this.wordField, "W", this.labels.wholeWord),
      toggle(this.reField, "*", this.labels.regexp),
      this.resultCount,
      previousButton,
      nextButton,
      selectButton,
    );
    findRow.append(findRowMain);

    const replaceRow = createElement("div", "cm-search-row cm-search-row--replace");
    replaceRow.append(
      createIcon("replace"),
      this.replaceField,
      replaceButton,
      replaceAllButton,
    );

    panel.append(findRow, replaceRow);

    this.searchField.addEventListener("input", this.commit);
    this.searchField.addEventListener("change", this.commit);
    this.replaceField.addEventListener("input", this.commit);
    this.replaceField.addEventListener("change", this.commit);
    this.caseField.addEventListener("change", this.commit);
    this.reField.addEventListener("change", this.commit);
    this.wordField.addEventListener("change", this.commit);
    previousButton.addEventListener("click", () => findPrevious(this.view));
    nextButton.addEventListener("click", () => findNext(this.view));
    selectButton.addEventListener("click", () => selectMatches(this.view));
    replaceButton.addEventListener("click", () => replaceNext(this.view));
    replaceAllButton.addEventListener("click", () => replaceAll(this.view));

    return panel;
  }

  private commit = () => {
    const query = new SearchQuery({
      search: this.searchField.value,
      caseSensitive: this.caseField.checked,
      regexp: this.reField.checked,
      wholeWord: this.wordField.checked,
      replace: this.replaceField.value,
    });
    if (!query.eq(this.query)) {
      this.query = query;
      this.view.dispatch({ effects: setSearchQuery.of(query) });
      this.updateResultCount();
    }
  };

  private handleKeyDown = (event: KeyboardEvent) => {
    if (runScopeHandlers(this.view, event, "search-panel")) {
      event.preventDefault();
      return;
    }
    if (event.key === "Enter" && event.target === this.searchField) {
      event.preventDefault();
      (event.shiftKey ? findPrevious : findNext)(this.view);
      return;
    }
    if (event.key === "Enter" && event.target === this.replaceField) {
      event.preventDefault();
      replaceNext(this.view);
    }
  };

  private setQuery(query: SearchQuery) {
    this.query = query;
    this.searchField.value = query.search;
    this.replaceField.value = query.replace;
    this.caseField.checked = query.caseSensitive;
    this.reField.checked = query.regexp;
    this.wordField.checked = query.wholeWord;
    this.updateResultCount();
  }

  private updateReplaceVisibility() {
    this.dom.setAttribute("data-replace-visible", this.replaceVisible ? "true" : "false");
  }

  private updateResultCount() {
    const count = countMatches(this.view, this.query);
    this.resultCount.textContent = formatResultCount(
      count,
      Boolean(this.query.search),
      this.labels,
    );
  }
}

export function createSearchPanelFactory(labels: SearchPanelLabels): (view: EditorView) => Panel {
  return (view) => new IdeaSearchPanel(view, labels);
}

export function openSearchWithReplace(view: EditorView): boolean {
  if (searchPanelOpen(view.state)) {
    const panel = view.dom.querySelector(".cm-search-idea") as HTMLElement | null;
    const searchPanel = panel ? panelInstances.get(panel) : null;
    if (searchPanel) {
      searchPanel.toggleReplace();
      return true;
    }
    const nextReplaceVisible = !(replaceVisibilityByView.get(view) ?? false);
    replaceVisibilityByView.set(view, nextReplaceVisible);
    panel?.setAttribute("data-replace-visible", nextReplaceVisible ? "true" : "false");
    panel
      ?.querySelector<HTMLInputElement>(
        nextReplaceVisible ? 'input[name="replace"]' : 'input[name="search"]',
      )
      ?.focus();
  } else {
    replaceVisibilityByView.set(view, true);
    openSearchPanel(view);
  }
  return true;
}

export const searchReplaceKeymap: readonly KeyBinding[] = [
  {
    key: "Mod-r",
    run: openSearchWithReplace,
    scope: "editor search-panel",
  },
];
