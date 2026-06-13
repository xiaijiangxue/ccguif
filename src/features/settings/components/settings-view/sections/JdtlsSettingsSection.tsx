import { useState } from "react";
import Save from "lucide-react/dist/esm/icons/save";
import TerminalSquare from "lucide-react/dist/esm/icons/terminal-square";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AppSettings } from "@/types";

type JdtlsSettingsSectionProps = {
  appSettings: AppSettings;
  onUpdateAppSettings: (next: AppSettings) => Promise<void>;
};

export function JdtlsSettingsSection({
  appSettings,
  onUpdateAppSettings,
}: JdtlsSettingsSectionProps) {
  const [draft, setDraft] = useState(appSettings.jdtlsJavaPath ?? "");
  const [saving, setSaving] = useState(false);

  const currentValue = appSettings.jdtlsJavaPath ?? "";
  const isDirty = draft !== currentValue;

  async function handleSave() {
    setSaving(true);
    try {
      await onUpdateAppSettings({
        ...appSettings,
        jdtlsJavaPath: draft.trim() || null,
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    setDraft("");
    await onUpdateAppSettings({
      ...appSettings,
      jdtlsJavaPath: null,
    });
  }

  return (
    <Card className="settings-basic-group-card settings-basic-shadcn-card">
      <CardHeader>
        <div className="settings-card-switch-meta">
          <CardTitle className="settings-subsection-title">
            <span className="settings-proxy-card-title">
              <TerminalSquare size={16} aria-hidden />
              JDTLS JDK Path
            </span>
          </CardTitle>
          <CardDescription className="settings-subsection-subtitle">
            Path to JDK 17+ for JDT Language Server (Java code navigation).
            Leave empty for auto-detect.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="settings-basic-sounds-card-content settings-proxy-card-content">
        <div className="settings-proxy-input-row">
          <Label className="settings-visually-hidden" htmlFor="jdtls-java-path">
            JDK Path
          </Label>
          <div className="settings-proxy-input-shell">
            <Input
              id="jdtls-java-path"
              className="settings-proxy-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="/Users/yang/Library/Java/JavaVirtualMachines/ms-17.0.18/Contents/Home"
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className="settings-proxy-save-btn"
            onClick={() => void handleSave()}
            disabled={!isDirty || saving}
            aria-label="Save JDK path"
          >
            <Save size={14} aria-hidden />
            Save
          </Button>
          <Button
            type="button"
            variant="outline"
            className="settings-button-compact"
            onClick={() => void handleClear()}
            disabled={!draft && !currentValue}
            aria-label="Clear JDK path"
          >
            Clear
          </Button>
        </div>
        <div className="settings-help settings-sound-hint settings-sound-hint-shadcn settings-proxy-hint">
          <span className="settings-sound-hint-copy">
            Auto-detection checks installed JDKs first, then JAVA_HOME and system PATH.
            Set a path here only if auto-detect picks the wrong JDK.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
