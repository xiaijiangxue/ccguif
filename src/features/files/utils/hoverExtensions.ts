import {
  hoverTooltip,
  type Tooltip,
} from "@codemirror/view";
import { EditorState } from "@codemirror/state";

export type HoverProvider = {
  /** Check if the hover should trigger at this position */
  shouldTrigger: (state: EditorState, pos: number) => boolean;
  /** Get the tooltip content for this position */
  getTooltip: (state: EditorState, pos: number) => Promise<Tooltip | null>;
};

export function createNavigationHoverProvider(provider: HoverProvider) {
  return hoverTooltip(
    (view, pos, _side) => {
      if (!provider.shouldTrigger(view.state, pos)) {
        return null;
      }
      return {
        pos,
        above: true,
        create: () => {
          const dom = document.createElement("div");
          dom.className = "cm-navigation-hover-tooltip";
          dom.textContent = "Loading...";
          // Async load
          void provider.getTooltip(view.state, pos).then((tooltip) => {
            if (!tooltip) {
              dom.textContent = "No preview available";
              return;
            }
            if (typeof tooltip.create === "function") {
              const { dom: contentDom } = tooltip.create(view);
              dom.textContent = "";
              dom.appendChild(contentDom);
            } else if (typeof tooltip === "string") {
              dom.textContent = tooltip;
            }
          });
          return { dom, offset: { x: 0, y: 8 } };
        },
      };
    },
    {
      // Delay before showing
      hoverTime: 300,
    },
  );
}

export function mybatisSqlHoverProvider(getSqlPreview: (line: number) => Promise<string | null>) {
  return createNavigationHoverProvider({
    shouldTrigger: (state, pos) => {
      // Check if cursor is on a method-like line in a mapper XML
      const line = state.doc.lineAt(pos);
      const text = line.text;
      return (
        /<\s*(select|insert|update|delete)\s/i.test(text) ||
        /@Select|@Insert|@Update|@Delete/.test(text)
      );
    },
    getTooltip: async (state, pos) => {
      const line = state.doc.lineAt(pos);
      const sql = await getSqlPreview(line.number);
      if (!sql) return null;
      return {
        pos,
        above: true,
        create: () => {
          const dom = document.createElement("div");
          dom.className = "cm-sql-preview-tooltip";
          const pre = document.createElement("pre");
          pre.textContent = sql;
          pre.style.cssText = "margin:0;padding:8px;font-size:12px;max-height:300px;overflow:auto;background:#1e1e1e;color:#d4d4d4;border-radius:4px;";
          dom.appendChild(pre);
          return { dom };
        },
      };
    },
  });
}

export function javaSymbolHoverProvider(
  getHoverContent: (line: number, character: number) => Promise<string | null>,
) {
  return createNavigationHoverProvider({
    shouldTrigger: (_state, _pos) => {
      // Always try for Java files; the caller filters by file type
      return true;
    },
    getTooltip: async (state, pos) => {
      const line = state.doc.lineAt(pos);
      const col = pos - line.from;
      const content = await getHoverContent(line.number - 1, col);
      if (!content) return null;
      return {
        pos,
        above: true,
        create: () => {
          const dom = document.createElement("div");
          dom.className = "cm-java-hover-tooltip";
          const pre = document.createElement("pre");
          pre.textContent = content;
          pre.style.cssText = "margin:0;padding:8px;font-size:12px;max-height:300px;overflow:auto;";
          dom.appendChild(pre);
          return { dom };
        },
      };
    },
  });
}
