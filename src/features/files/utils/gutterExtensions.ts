import { EditorView, Decoration, DecorationSet, gutter, GutterMarker } from "@codemirror/view";
import { StateField, StateEffect, RangeSetBuilder, type Extension } from "@codemirror/state";

export type GutterNavigationType =
  | "mybatis-leaf"     // Mapper method → XML statement
  | "java-class"       // XML statement → Java interface
  | "arrow-up"         // Override → super method
  | "arrow-down"       // Interface → implementation
  | "diagnostic-error" // Has error diagnostic
  | "diagnostic-warn"; // Has warning diagnostic

export type GutterNavigationEntry = {
  line: number; // 1-based line number
  type: GutterNavigationType;
  tooltip: string;
  onClick?: () => void;
};

class NavigationGutterMarker extends GutterMarker {
  entry: GutterNavigationEntry;
  constructor(entry: GutterNavigationEntry) {
    super();
    this.entry = entry;
  }
  toDOM() {
    const el = document.createElement("div");
    el.className = `cm-nav-gutter-marker cm-nav-${this.entry.type}`;
    el.title = this.entry.tooltip;
    el.setAttribute("data-nav-type", this.entry.type);
    el.setAttribute("data-nav-line", String(this.entry.line));
    const icon = document.createElement("span");
    icon.className = `cm-nav-icon cm-nav-icon-${this.entry.type}`;
    el.appendChild(icon);
    if (this.entry.onClick) {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        this.entry.onClick?.();
      });
      el.style.cursor = "pointer";
    }
    return el;
  }
  eq(other: NavigationGutterMarker) {
    return (
      this.entry.line === other.entry.line &&
      this.entry.type === other.entry.type &&
      this.entry.tooltip === other.entry.tooltip
    );
  }
}

function buildNavigationDecorations(entries: GutterNavigationEntry[]) {
  if (entries.length === 0) return Decoration.none;
  const builder = new RangeSetBuilder<Decoration>();
  for (const entry of entries) {
    const lineOffset = (entry.line - 1) * 1;
    builder.add(
      lineOffset,
      lineOffset,
      Decoration.line({
        attributes: {
          class: `cm-nav-gutter cm-nav-${entry.type}`,
          "data-nav-type": entry.type,
          "data-nav-tooltip": entry.tooltip,
          "data-nav-line": String(entry.line),
        },
      }),
    );
  }
  return builder.finish();
}

const navigationGutterField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    let nextDecorations = decorations;
    if (tr.docChanged) {
      nextDecorations = nextDecorations.map(tr.changes);
    }
    for (const effect of tr.effects) {
      if (effect.is(setNavigationEntries)) {
        nextDecorations = buildNavigationDecorations(effect.value);
      }
    }
    return nextDecorations;
  },
  provide: (f) => EditorView.decorations.from(f),
});

export const setNavigationEntries = StateEffect.define<GutterNavigationEntry[]>();

export function mybatisNavigationGutter(
  getEntries: (view: EditorView) => GutterNavigationEntry[],
): Extension {
  const gutterExt = gutter({
    class: "cm-navigation-gutter",
    markers: (view) => {
      const entries = getEntries(view);
      const builder = new RangeSetBuilder<GutterMarker>();
      for (const entry of entries) {
        const line = view.state.doc.line(Math.min(entry.line, view.state.doc.lines));
        builder.add(line.from, line.from, new NavigationGutterMarker(entry));
      }
      return builder.finish();
    },
    domEventHandlers: {
      click: (view, _line, event) => {
        const target = event.target as HTMLElement;
        const marker = target.closest(".cm-nav-gutter-marker") as HTMLElement | null;
        if (!marker) return false;
        const lineNo = marker.getAttribute("data-nav-line");
        if (lineNo) {
          const navEvent = new CustomEvent("cm-navigation-click", {
            detail: { line: parseInt(lineNo, 10), type: marker.getAttribute("data-nav-type") },
          });
          view.dom.dispatchEvent(navEvent);
        }
        return true;
      },
    },
  });

  return [navigationGutterField, gutterExt];
}
