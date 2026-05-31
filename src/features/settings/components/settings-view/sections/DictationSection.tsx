import { useMemo } from "react";
import type { TFunction } from "i18next";
import { AppSelect } from "@/components/ui/app-select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { AppSettings, DictationModelStatus } from "@/types";
import { formatDownloadSize } from "@/utils/formatting";
import { DICTATION_MODELS } from "../settingsViewConstants";

type DictationSectionProps = {
  active: boolean;
  t: TFunction;
  appSettings: AppSettings;
  onUpdateAppSettings: (next: AppSettings) => Promise<void>;
  dictationModelStatus?: DictationModelStatus | null;
  onDownloadDictationModel?: () => void;
  onCancelDictationDownload?: () => void;
  onRemoveDictationModel?: () => void;
};

export function DictationSection({
  active,
  t,
  appSettings,
  onUpdateAppSettings,
  dictationModelStatus,
  onDownloadDictationModel,
  onCancelDictationDownload,
  onRemoveDictationModel,
}: DictationSectionProps) {
  const dictationModels = useMemo(() => DICTATION_MODELS(t), [t]);
  const selectedDictationModel = useMemo(
    () =>
      dictationModels.find((model) => model.id === appSettings.dictationModelId) ??
      dictationModels[1],
    [appSettings.dictationModelId, dictationModels],
  );
  const dictationReady = dictationModelStatus?.state === "ready";
  const dictationProgress = dictationModelStatus?.progress ?? null;

  if (!active) {
    return null;
  }

  return (
    <section className="settings-section">
      <div className="settings-section-title">{t("settings.dictationTitle")}</div>
      <div className="settings-section-subtitle">
        {t("settings.dictationDescription")}
      </div>
      <div className="settings-toggle-row">
        <div>
          <div className="settings-toggle-title">{t("settings.enableDictation")}</div>
          <div className="settings-toggle-subtitle">
            {t("settings.enableDictationDesc")}
          </div>
        </div>
        <Switch
          checked={appSettings.dictationEnabled}
          onCheckedChange={(checked) => {
            void onUpdateAppSettings({
              ...appSettings,
              dictationEnabled: checked,
            });
            if (
              !checked &&
              dictationModelStatus?.state === "downloading" &&
              onCancelDictationDownload
            ) {
              onCancelDictationDownload();
            }
            if (
              checked &&
              dictationModelStatus?.state === "missing" &&
              onDownloadDictationModel
            ) {
              onDownloadDictationModel();
            }
          }}
        />
      </div>
      <div className="settings-field">
        <label className="settings-field-label" htmlFor="dictation-model">
          {t("settings.dictationModel")}
        </label>
        <AppSelect
          id="dictation-model"
          className="settings-select"
          value={appSettings.dictationModelId}
          ariaLabel={t("settings.dictationModel")}
          onValueChange={(value) =>
            void onUpdateAppSettings({
              ...appSettings,
              dictationModelId: value,
            })
          }
          options={dictationModels.map((model) => ({
            value: model.id,
            label: `${model.label} (${model.size})`,
          }))}
        />
        <div className="settings-help">
          {selectedDictationModel.note} {t("settings.downloadSize")}{" "}
          {selectedDictationModel.size}.
        </div>
      </div>
      <div className="settings-field">
        <label className="settings-field-label" htmlFor="dictation-language">
          {t("settings.preferredDictationLanguage")}
        </label>
        <AppSelect
          id="dictation-language"
          className="settings-select"
          value={appSettings.dictationPreferredLanguage ?? ""}
          ariaLabel={t("settings.preferredDictationLanguage")}
          onValueChange={(value) =>
            void onUpdateAppSettings({
              ...appSettings,
              dictationPreferredLanguage: value || null,
            })
          }
          options={[
            { value: "", label: t("settings.autoDetectOnly") },
            { value: "en", label: t("settings.languageEnglish") },
            { value: "es", label: t("settings.languageSpanish") },
            { value: "fr", label: t("settings.languageFrench") },
            { value: "de", label: t("settings.languageGerman") },
            { value: "it", label: t("settings.languageItalian") },
            { value: "pt", label: t("settings.languagePortuguese") },
            { value: "nl", label: t("settings.languageDutch") },
            { value: "sv", label: t("settings.languageSwedish") },
            { value: "no", label: t("settings.languageNorwegian") },
            { value: "da", label: t("settings.languageDanish") },
            { value: "fi", label: t("settings.languageFinnish") },
            { value: "pl", label: t("settings.languagePolish") },
            { value: "tr", label: t("settings.languageTurkish") },
            { value: "ru", label: t("settings.languageRussian") },
            { value: "uk", label: t("settings.languageUkrainian") },
            { value: "ja", label: t("settings.languageJapanese") },
            { value: "ko", label: t("settings.languageKorean") },
            { value: "zh", label: t("settings.languageChinese") },
          ]}
        />
        <div className="settings-help">
          {t("settings.languageDetectionDesc")}
        </div>
      </div>
      <div className="settings-field">
        <label className="settings-field-label" htmlFor="dictation-hold-key">
          {t("settings.holdToDictateKey")}
        </label>
        <AppSelect
          id="dictation-hold-key"
          className="settings-select"
          value={appSettings.dictationHoldKey ?? ""}
          ariaLabel={t("settings.holdToDictateKey")}
          onValueChange={(value) =>
            void onUpdateAppSettings({
              ...appSettings,
              dictationHoldKey: value,
            })
          }
          options={[
            { value: "", label: t("settings.holdToDictateOff") },
            { value: "alt", label: t("settings.holdToDictateOption") },
            { value: "shift", label: t("settings.holdToDictateShift") },
            { value: "control", label: t("settings.holdToDictateControl") },
            { value: "meta", label: t("settings.holdToDictateCommand") },
          ]}
        />
        <div className="settings-help">
          {t("settings.holdToDictateDesc")}
        </div>
      </div>
      {dictationModelStatus && (
        <div className="settings-field">
          <div className="settings-field-label">
            {t("settings.modelStatus")} ({selectedDictationModel.label})
          </div>
          <div className="settings-help">
            {dictationModelStatus.state === "ready" && t("settings.modelReady")}
            {dictationModelStatus.state === "missing" &&
              t("settings.modelNotDownloaded")}
            {dictationModelStatus.state === "downloading" &&
              t("settings.modelDownloading")}
            {dictationModelStatus.state === "error" &&
              (dictationModelStatus.error ?? t("settings.modelDownloadError"))}
          </div>
          {dictationProgress && (
            <div className="settings-download-progress">
              <div className="settings-download-bar">
                <div
                  className="settings-download-fill"
                  style={{
                    width: dictationProgress.totalBytes
                      ? `${Math.min(
                          100,
                          (dictationProgress.downloadedBytes /
                            dictationProgress.totalBytes) *
                            100,
                        )}%`
                      : "0%",
                  }}
                />
              </div>
              <div className="settings-download-meta">
                {formatDownloadSize(dictationProgress.downloadedBytes)}
              </div>
            </div>
          )}
          <div className="settings-field-actions">
            {dictationModelStatus.state === "missing" && (
              <Button
                type="button"
                onClick={onDownloadDictationModel}
                disabled={!onDownloadDictationModel}
              >
                {t("settings.downloadModel")}
              </Button>
            )}
            {dictationModelStatus.state === "downloading" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="settings-button-compact"
                onClick={onCancelDictationDownload}
                disabled={!onCancelDictationDownload}
              >
                {t("settings.cancelDownload")}
              </Button>
            )}
            {dictationReady && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="settings-button-compact"
                onClick={onRemoveDictationModel}
                disabled={!onRemoveDictationModel}
              >
                {t("settings.removeModel")}
              </Button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
