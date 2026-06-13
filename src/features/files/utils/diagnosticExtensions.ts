import { EditorView, Decoration, type DecorationSet } from "@codemirror/view";
import { StateField, StateEffect, RangeSetBuilder, type Extension } from "@codemirror/state";

export type DiagnosticSeverity = "error" | "warning" | "info";

export type DiagnosticMarker = {
  line: number; // 1-based
  severity: DiagnosticSeverity;
  message: string;
};

const errorDeco = Decoration.line({
  attributes: { class: "cm-diagnostic cm-diagnostic-error" },
});
const warningDeco = Decoration.line({
  attributes: { class: "cm-diagnostic cm-diagnostic-warning" },
});
const infoDeco = Decoration.line({
  attributes: { class: "cm-diagnostic cm-diagnostic-info" },
});

function decoForSeverity(severity: DiagnosticSeverity) {
  switch (severity) {
    case "error":
      return errorDeco;
    case "warning":
      return warningDeco;
    case "info":
      return infoDeco;
  }
}

function buildDecorations(markers: DiagnosticMarker[]): DecorationSet {
  if (markers.length === 0) return Decoration.none;
  const builder = new RangeSetBuilder<Decoration>();
  for (const marker of markers) {
    if (marker.line < 1) continue;
    const lineOffset = (marker.line - 1) * 1;
    builder.add(lineOffset, lineOffset, decoForSeverity(marker.severity));
  }
  return builder.finish();
}

export const setDiagnosticMarkers = StateEffect.define<DiagnosticMarker[]>();

const diagnosticField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    let next = decorations;
    if (tr.docChanged) {
      next = next.map(tr.changes);
    }
    for (const effect of tr.effects) {
      if (effect.is(setDiagnosticMarkers)) {
        next = buildDecorations(effect.value);
      }
    }
    return next;
  },
  provide: (f) => EditorView.decorations.from(f),
});

/** Extension that renders diagnostic inline markers in the gutter area. */
export function diagnosticExtension(): Extension {
  return diagnosticField;
}
